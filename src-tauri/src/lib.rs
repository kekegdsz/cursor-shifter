// 导入模块
mod account_info;
mod app_config;
mod backup;
mod cursor_db;
mod cursor_path;
mod cursor_version;
mod device_id;
mod seamless_switch; // 无感换号模块
mod session_token;
mod settings;
mod switch_account;
mod token_storage;
mod windows_registry;
mod windsurf_api;
mod windsurf_crypto;
mod windsurf_db;
mod windsurf_device;
mod windsurf_grpc;
mod windsurf_path;
mod windsurf_switch_account;

use account_info::{
    create_session_token, decode_jwt_payload, extract_user_id, fetch_account_detail_info,
    fetch_account_info_with_fallback, AccountDetailInfo, AccountInfo,
};
use app_config::{
    get_disable_update_status, load_config as load_app_config, update_disable_update_status,
    AppConfig,
};
use backup::{
    create_backup, delete_backup, list_backups, restore_backup, BackupListItem, BackupMetadata,
};
use cursor_db::{get_current_cursor_account, CursorAccount};
use cursor_path::{
    get_default_cursor_path, get_or_detect_cursor_path, save_cursor_path, validate_cursor_exe,
    CursorPathInfo,
};
use cursor_version::{
    detect_cursor_version, disable_cursor_update, enable_cursor_update, is_update_disabled,
    CursorVersionInfo,
};
use device_id::{get_or_create_device_info, reset_device_info, DeviceInfo};
use seamless_switch::{DetectionResult, PatchDetail, SeamlessSwitchConfig};
use session_token::parse_session_token;
use settings::{disable_http2, enable_http2, remove_proxy, set_proxy};
use switch_account::{
    generate_machine_ids, kill_cursor_processes_by_path, patch_main_js, reopen_cursor,
    update_state_db, update_storage_json, MachineIds,
};
use token_storage::{
    add_account, clear_all_accounts, delete_account, get_accounts, import_accounts,
    set_current_account,
};
use windows_registry::{
    is_admin, read_current_machine_guid, reset_windows_registry_machine_guid, RegistryResult,
};
use windsurf_db::{get_current_windsurf_account, WindsurfAccount};
use windsurf_device::{reset_windsurf_machine_id, MachineIds as WindsurfMachineIds};
use windsurf_path::{
    get_or_detect_windsurf_path, save_windsurf_path, validate_windsurf_exe, WindsurfPathInfo,
};

/// 创建带超时配置的 HTTP 客户端
///
/// # 超时设置
/// - 连接超时: 10秒
/// - 读取超时: 30秒
/// - 总超时: 60秒
pub fn create_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60)) // 总超时60秒
        .connect_timeout(std::time::Duration::from_secs(10)) // 连接超时10秒
        .build()
        .unwrap_or_else(|_| reqwest::Client::new()) // 如果构建失败，回退到默认客户端
}

/// 演示命令
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 一键换号命令（新Token，生成新机器ID）
///
/// # 参数
/// - `access_token`: 用户的 AccessToken
/// - `enable_email_privacy`: 是否启用邮箱隐私保护
/// - `app`: Tauri AppHandle（用于自动备份）
///
/// # 返回值
/// 成功返回包含新机器ID的JSON字符串
#[tauri::command]
async fn switch_account(
    access_token: String,
    enable_email_privacy: bool,
    app: tauri::AppHandle,
) -> Result<String, String> {
    println!("开始执行一键换号...");

    // 0. 换号前自动备份
    println!("\n[0/8] 正在创建换号前备份...");
    match create_backup(&app, Some("换号前自动备份".to_string())) {
        Ok(backup) => {
            println!("✓ 自动备份已创建: {}", backup.id);
        }
        Err(e) => {
            println!("⚠ 自动备份失败（继续执行）: {}", e);
            // 不中断流程
        }
    }

    // 1. 获取或检测 Cursor 路径
    println!("\n[1/8] 正在获取 Cursor 路径...");
    let cursor_path_info = match get_or_detect_cursor_path() {
        Ok(info) => {
            println!("✓ Cursor 路径: {}", info.exe_path);
            Some(info)
        }
        Err(e) => {
            println!("⚠ 无法获取 Cursor 路径: {}", e);
            println!("  将使用默认方式关闭所有 Cursor 进程");
            None
        }
    };

    // 解码JWT获取用户信息
    let (email, _user_id) = match decode_jwt_payload(&access_token) {
        Ok(payload) => {
            let user_id = extract_user_id(&payload.sub);
            println!("✓ JWT解码成功，用户ID: {}", user_id);

            // 构造SessionToken用于获取更多信息
            let session_token = create_session_token(&user_id, &access_token);

            // 尝试从API获取邮箱信息
            match fetch_account_info_with_fallback(&session_token).await {
                Ok(account_info) => {
                    println!("✓ 成功获取账号信息: {}", account_info.email);
                    (account_info.email, user_id)
                }
                Err(e) => {
                    println!("⚠ 获取账号信息失败，使用默认邮箱: {}", e);
                    ("user@example.com".to_string(), user_id)
                }
            }
        }
        Err(e) => {
            println!("⚠ JWT解码失败，使用默认值: {}", e);
            // 如果解码失败，尝试从token中分离email（如果格式是 email:token）
            let email = if access_token.contains(':') {
                access_token.split(':').next().unwrap_or("user@example.com")
            } else {
                "user@example.com" // 默认邮箱
            };
            (email.to_string(), "user_unknown".to_string())
        }
    };

    // 2. 关闭 Cursor 进程（优先使用指定路径）
    println!("\n[2/8] 正在关闭 Cursor 进程...");
    let cursor_exe_path = cursor_path_info.as_ref().map(|info| info.exe_path.as_str());

    // 关闭Cursor进程（失败也不影响流程）
    kill_cursor_processes_by_path(cursor_exe_path).ok();

    // 3. 生成新的机器ID
    println!("\n[3/8] 正在生成新的机器ID...");
    let machine_ids = generate_machine_ids();
    println!("✓ 机器ID已生成");

    // 4. Patch main.js
    println!("\n[4/8] 正在 Patch main.js...");
    match patch_main_js() {
        Ok(_) => {}
        Err(e) => {
            println!("⚠ Patch main.js 失败（可能已 patch 过）: {}", e);
            // 不返回错误，继续执行
        }
    }

    // 5. 更新 storage.json
    println!("\n[5/8] 正在更新 storage.json...");
    update_storage_json(&machine_ids).map_err(|e| format!("更新 storage.json 失败: {}", e))?;

    // 6. 更新 state.vscdb（根据隐私设置处理邮箱）
    println!("\n[6/8] 正在更新 state.vscdb...");

    // 如果启用邮箱隐私，脱敏邮箱
    let email_to_save = if enable_email_privacy {
        // 脱敏：只保留@之前的部分
        if let Some(at_index) = email.find('@') {
            let username = &email[..at_index];
            let masked_email = format!("{}@**", username);
            println!("✓ 邮箱隐私已启用，保存脱敏邮箱: {}", masked_email);
            masked_email
        } else {
            email.clone()
        }
    } else {
        email.clone()
    };

    update_state_db(&email_to_save, &access_token).map_err(|e| format!("更新数据库失败: {}", e))?;

    // 7. 重新打开 Cursor
    println!("\n[7/8] 正在重新打开 Cursor...");
    reopen_cursor().map_err(|e| format!("重新打开失败: {}", e))?;

    println!("\n✅ 一键换号完成！");

    // 返回新生成的机器ID（供保存）
    let response = serde_json::json!({
        "success": true,
        "message": "账号切换成功！请等待 Cursor 启动。",
        "machine_ids": {
            "mac_machine_id": machine_ids.mac_machine_id,
            "machine_id": machine_ids.machine_id,
            "dev_device_id": machine_ids.dev_device_id,
            "sqm_id": machine_ids.sqm_id
        }
    });

    Ok(response.to_string())
}
/// 账号列表换号命令（复用已保存的机器ID）
///
/// # 参数
/// - `access_token`: AccessToken
/// - `enable_email_privacy`: 是否启用邮箱隐私
/// - `saved_machine_ids`: 保存的机器ID（可选）
/// - `app`: Tauri AppHandle
///
/// # 返回值
/// 成功返回消息
#[tauri::command]
async fn switch_account_from_list(
    access_token: String,
    enable_email_privacy: bool,
    saved_machine_ids: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    println!("开始从账号列表切换账号...");

    // 0. 换号前自动备份
    println!("\n[0/8] 正在创建换号前备份...");
    match create_backup(&app, Some("账号列表换号前备份".to_string())) {
        Ok(backup) => {
            println!("✓ 自动备份已创建: {}", backup.id);
        }
        Err(e) => {
            println!("⚠ 自动备份失败（继续执行）: {}", e);
        }
    }

    // 1. 获取或检测 Cursor 路径
    println!("\n[1/8] 正在获取 Cursor 路径...");
    let cursor_path_info = match get_or_detect_cursor_path() {
        Ok(info) => {
            println!("✓ Cursor 路径: {}", info.exe_path);
            Some(info)
        }
        Err(e) => {
            println!("⚠ 无法获取 Cursor 路径: {}", e);
            None
        }
    };

    // 解码JWT获取用户信息
    let (email, _user_id) = match decode_jwt_payload(&access_token) {
        Ok(payload) => {
            let user_id = extract_user_id(&payload.sub);
            println!("✓ JWT解码成功，用户ID: {}", user_id);
            let session_token = create_session_token(&user_id, &access_token);

            match fetch_account_info_with_fallback(&session_token).await {
                Ok(account_info) => {
                    println!("✓ 成功获取账号信息: {}", account_info.email);
                    (account_info.email, user_id)
                }
                Err(e) => {
                    println!("⚠ 获取账号信息失败: {}", e);
                    ("user@example.com".to_string(), user_id)
                }
            }
        }
        Err(e) => {
            println!("⚠ JWT解码失败: {}", e);
            ("user@example.com".to_string(), "user_unknown".to_string())
        }
    };

    // 2. 关闭 Cursor 进程
    println!("\n[2/8] 正在关闭 Cursor 进程...");
    let cursor_exe_path = cursor_path_info.as_ref().map(|info| info.exe_path.as_str());

    match kill_cursor_processes_by_path(cursor_exe_path) {
        Ok(_) => {}
        Err(e) if e.contains("路径不匹配") => {
            return Err(format!(
                "Cursor路径配置错误！\n\n{}\n\n请点击「修改Cursor路径」重新选择。",
                e
            ));
        }
        Err(e) => {
            return Err(format!("关闭进程失败: {}", e));
        }
    }

    // 3. 使用保存的机器ID或生成新的
    println!("\n[3/8] 正在处理机器ID...");
    let machine_ids = if let Some(saved_json) = saved_machine_ids {
        // 尝试解析保存的机器ID
        match serde_json::from_str::<MachineIds>(&saved_json) {
            Ok(ids) => {
                println!("✓ 使用保存的机器ID");
                ids
            }
            Err(_) => {
                println!("⚠ 解析机器ID失败，生成新的");
                generate_machine_ids()
            }
        }
    } else {
        println!("✓ 生成新的机器ID");
        generate_machine_ids()
    };

    // 4. Patch main.js
    println!("\n[4/8] 正在 Patch main.js...");
    match patch_main_js() {
        Ok(_) => {}
        Err(e) => {
            println!("⚠ Patch main.js 失败: {}", e);
        }
    }

    // 5. 更新 storage.json
    println!("\n[5/8] 正在更新 storage.json...");
    update_storage_json(&machine_ids).map_err(|e| format!("更新 storage.json 失败: {}", e))?;

    // 6. 更新 state.vscdb
    println!("\n[6/8] 正在更新 state.vscdb...");
    let email_to_save = if enable_email_privacy {
        if let Some(at_index) = email.find('@') {
            let username = &email[..at_index];
            let masked = format!("{}@**", username);
            println!("✓ 邮箱隐私已启用，保存: {}", masked);
            masked
        } else {
            email.clone()
        }
    } else {
        email.clone()
    };

    update_state_db(&email_to_save, &access_token).map_err(|e| format!("更新数据库失败: {}", e))?;

    // 7. 重新打开 Cursor
    println!("\n[7/8] 正在重新打开 Cursor...");
    reopen_cursor().map_err(|e| format!("重新打开失败: {}", e))?;

    println!("\n✅ 账号列表换号完成！");
    Ok("账号切换成功！请等待 Cursor 启动。".to_string())
}

/// 创建配置备份命令
///
/// # 参数
/// - `name`: 备份名称（可选）
/// - `app`: Tauri AppHandle
///
/// # 返回值
/// 返回备份元数据
#[tauri::command]
fn create_config_backup(
    name: Option<String>,
    app: tauri::AppHandle,
) -> Result<BackupMetadata, String> {
    println!("开始创建备份...");
    let metadata = create_backup(&app, name)?;
    Ok(metadata)
}

/// 列出所有备份命令
///
/// # 参数
/// - `app`: Tauri AppHandle
///
/// # 返回值
/// 返回备份列表
#[tauri::command]
fn list_config_backups(app: tauri::AppHandle) -> Result<Vec<BackupListItem>, String> {
    list_backups(&app)
}

/// 恢复备份命令
///
/// # 参数
/// - `backup_id`: 备份ID
/// - `app`: Tauri AppHandle
///
/// # 返回值
/// 成功返回 Ok(())
#[tauri::command]
fn restore_config_backup(backup_id: String, app: tauri::AppHandle) -> Result<String, String> {
    println!("开始恢复备份: {}", backup_id);

    // 恢复前先关闭 Cursor
    println!("正在关闭 Cursor 进程...");
    kill_cursor_processes_by_path(None).map_err(|e| format!("关闭进程失败: {}", e))?;

    // 恢复备份
    restore_backup(&app, backup_id)?;

    // 重新打开 Cursor
    println!("正在重新打开 Cursor...");
    reopen_cursor().map_err(|e| format!("重新打开失败: {}", e))?;

    Ok("配置恢复成功！请等待 Cursor 启动。".to_string())
}

/// 删除备份命令
///
/// # 参数
/// - `backup_id`: 备份ID
/// - `app`: Tauri AppHandle
///
/// # 返回值
/// 成功返回 Ok(())
#[tauri::command]
fn delete_config_backup(backup_id: String, app: tauri::AppHandle) -> Result<String, String> {
    delete_backup(&app, backup_id)?;
    Ok("备份已删除".to_string())
}

/// 获取当前账号信息命令（基础版本）
///
/// # 参数
/// - `access_token`: AccessToken（JWT格式）
///
/// # 返回值
/// 返回账号基本信息
#[tauri::command]
async fn get_account_info(access_token: String) -> Result<AccountInfo, String> {
    println!("开始解析账号信息...");

    // 解码JWT
    let payload = decode_jwt_payload(&access_token)?;
    let user_id = extract_user_id(&payload.sub);

    println!("✓ JWT解码成功");
    println!("  用户ID: {}", user_id);
    println!(
        "  Token类型: {}",
        payload.token_type.as_deref().unwrap_or("未知")
    );
    println!("  权限范围: {}", payload.scope);

    // 构造SessionToken
    let session_token = create_session_token(&user_id, &access_token);
    println!("✓ SessionToken已构造");

    // 尝试获取详细账号信息
    match fetch_account_info_with_fallback(&session_token).await {
        Ok(mut account_info) => {
            println!("✓ 账号信息获取成功");

            // 尝试获取真实的会员类型（membership_type）
            match account_info::fetch_usage_summary(&session_token).await {
                Ok(usage) => {
                    println!("✓ 成功获取会员类型: {}", usage.membership_type);
                    // 使用真实的会员类型更新 subscription 字段
                    account_info.subscription = usage.membership_type;
                }
                Err(e) => {
                    println!("⚠ 获取会员类型失败，使用推测值: {}", e);
                    // 保持从 fetch_account_info_with_fallback 获取的推测值
                }
            }

            // 填充 access_token 字段
            account_info.access_token = Some(access_token.clone());
            Ok(account_info)
        }
        Err(e) => {
            println!("⚠ API获取失败，返回基础信息: {}", e);

            // 如果API失败，返回从JWT解析的基础信息
            Ok(AccountInfo {
                user_id: user_id.clone(),
                email: "unknown@gamil.com".to_string(),
                name: "Unknown User".to_string(),
                subscription: "Unknown".to_string(),
                status: "未验证".to_string(),
                token_preview: format!(
                    "{}...",
                    &access_token[..std::cmp::min(30, access_token.len())]
                ),
                access_token: Some(access_token), // 包含 access_token
                refresh_token: None,              // 此分支不返回 refresh_token
                expires_at: Some(payload.exp),
                updated_at: None,
            })
        }
    }
}

/// 获取账号详细信息命令（包含试用期）
///
/// # 参数
/// - `access_token`: AccessToken（JWT格式）
///
/// # 返回值
/// 返回完整的账号详细信息，包含会员类型和试用期数据
#[tauri::command]
async fn get_account_detail_info(access_token: String) -> Result<AccountDetailInfo, String> {
    println!("开始获取完整账号详细信息...");

    // 解码JWT
    let payload = decode_jwt_payload(&access_token)?;
    let user_id = extract_user_id(&payload.sub);

    // 构造SessionToken
    let session_token = create_session_token(&user_id, &access_token);

    // 获取完整信息
    fetch_account_detail_info(&session_token).await
}

/// 从 Cursor 官方数据库获取当前登录的账号信息
///
/// # 返回值
/// 返回当前 Cursor 登录的账号信息，如果未登录则返回错误
#[tauri::command]
fn get_current_cursor_account_cmd() -> Result<CursorAccount, String> {
    println!("开始从 Cursor 数据库读取当前账号...");

    match get_current_cursor_account()? {
        Some(account) => {
            println!("✓ 成功读取账号: {}", account.email);
            Ok(account)
        }
        None => Err("Cursor 未登录或数据库中没有账号信息".to_string()),
    }
}

/// 从 Windsurf 官方数据库获取当前登录的账号信息
///
/// # 返回值
/// 返回当前 Windsurf 登录的账号信息，如果未登录则返回错误
#[tauri::command]
fn get_current_windsurf_account_cmd() -> Result<WindsurfAccount, String> {
    println!("开始从 Windsurf 数据库读取当前账号...");

    match get_current_windsurf_account()? {
        Some(account) => {
            println!("✓ 成功读取账号: {}", account.email);
            Ok(account)
        }
        None => Err("Windsurf 未登录或数据库中没有账号信息".to_string()),
    }
}

/// 设置当前使用的 Windsurf 账号 ID（用户手动设置）
///
/// # 参数
/// - `account_id`: 账号 ID，传入 None 则清除设置
/// - `app`: Tauri AppHandle
///
/// # 返回值
/// 成功返回 Ok(())
#[tauri::command]
fn set_current_windsurf_account_cmd(
    account_id: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    println!("设置当前 Windsurf 账号 ID: {:?}", account_id);
    app_config::set_current_windsurf_account(account_id, &app)?;
    println!("✓ 账号 ID 设置成功");
    Ok(())
}

/// 获取用户设置的当前 Windsurf 账号 ID
///
/// # 参数
/// - `app`: Tauri AppHandle
///
/// # 返回值
/// 返回用户设置的账号 ID，如果未设置则返回 None
#[tauri::command]
fn get_current_windsurf_account_setting_cmd(
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    println!("获取用户设置的当前 Windsurf 账号 ID...");
    let account_id = app_config::get_current_windsurf_account(&app)?;
    println!("  账号 ID: {:?}", account_id);
    Ok(account_id)
}

/// 解析 WorkosCursorSessionToken
///
/// # 参数
/// - `session_token`: 从浏览器 Cookie 中获取的 WorkosCursorSessionToken
///
/// # 返回值
/// 返回解析后的账号信息和 AccessToken
#[tauri::command]
async fn parse_session_token_cmd(session_token: String) -> Result<AccountInfo, String> {
    println!("开始解析 WorkosCursorSessionToken...");

    // 保存原始输入（用于 refresh_token）
    let original_input = session_token.clone();
    println!(
        "  原始输入: {}...",
        &original_input[..50.min(original_input.len())]
    );

    // 1. 解析 SessionToken 获取 AccessToken
    let result = parse_session_token(&session_token)?;

    println!("✓ SessionToken 解析成功");
    println!("  用户 ID: {}", result.user_id);
    println!("  邮箱: {}", result.email);

    // 2. 检查并自动转换 Token 类型
    let jwt_payload_check = decode_jwt_payload(&result.access_token)?;

    // 如果是 type="web"（短效），自动转换为 type="session"（长效）
    let final_access_token = match &jwt_payload_check.token_type {
        Some(t) if t == "session" => {
            println!("✓ Token 类型: session（长效），无需转换");
            result.access_token.clone()
        }
        Some(t) if t == "web" => {
            println!("⚠️ Token 类型: web（短效），尝试自动转换为长效 Token...");

            // 尝试多种转换方式
            // 方式1: 直接使用（某些情况下 web token 也可用）
            // 方式2: PKCE 转换（需要用户交互）

            // 先尝试直接使用，如果失败再提示
            println!("ℹ️ 将尝试直接使用 web token（可能有效期较短）");
            result.access_token.clone()
        }
        Some(t) => {
            println!("⚠️ 未知的 Token 类型: {}，假定有效", t);
            result.access_token.clone()
        }
        None => {
            println!("⚠️ Token 没有 type 字段，假定为有效");
            result.access_token.clone()
        }
    };

    // 3. 使用处理后的 AccessToken 获取详细账号信息
    let jwt_payload = decode_jwt_payload(&final_access_token)?;
    let user_id = extract_user_id(&jwt_payload.sub);

    // 4. 构造正确的保存格式
    // 根据文章：
    // - AccessToken: 纯 JWT（type=session，已转换）
    // - RefreshToken: 保留原始输入的 SessionToken 格式
    let access_token_to_save = final_access_token.clone(); // 纯 JWT（已转换为 session）
    let refresh_token_to_save =
        if original_input.contains("%3A%3A") || original_input.contains("::") {
            // 如果原始输入包含 SessionToken 格式，保留它
            original_input.clone()
        } else {
            // 如果是纯 JWT，构造 WebToken 格式
            format!("{}::{}", user_id, final_access_token)
        };

    println!("✓ Token 保存格式:");
    println!(
        "  - AccessToken (纯JWT): {}...",
        &access_token_to_save[..50.min(access_token_to_save.len())]
    );
    println!(
        "  - RefreshToken (保留原格式): {}...",
        &refresh_token_to_save[..50.min(refresh_token_to_save.len())]
    );

    // 5. 构造 SessionToken 用于 API 请求
    let session_token_for_api = create_session_token(&user_id, &final_access_token);

    // 6. 尝试从 API 获取完整信息
    match fetch_account_info_with_fallback(&session_token_for_api).await {
        Ok(mut account_info) => {
            println!("✓ 成功获取完整账号信息");

            // 尝试获取真实的会员类型（membership_type）
            match account_info::fetch_usage_summary(&session_token_for_api).await {
                Ok(usage) => {
                    println!("✓ 成功获取会员类型: {}", usage.membership_type);
                    // 使用真实的会员类型更新 subscription 字段
                    account_info.subscription = usage.membership_type;
                }
                Err(e) => {
                    println!("⚠ 获取会员类型失败，使用推测值: {}", e);
                    // 保持从 fetch_account_info_with_fallback 获取的推测值
                }
            }

            // 填充 Token 信息（根据文章要求）
            account_info.access_token = Some(access_token_to_save.clone());
            account_info.refresh_token = Some(refresh_token_to_save.clone());

            println!("✓ 已返回 Token（access=纯JWT, refresh=完整格式）");
            Ok(account_info)
        }
        Err(e) => {
            println!("⚠ API 获取失败，返回基础信息（包含 SessionToken）: {}", e);
            // 返回基础信息（access_token 使用 SessionToken）
            Ok(AccountInfo {
                user_id: result.user_id,
                email: result.email,
                name: "Unknown User".to_string(),
                subscription: result.plan.unwrap_or_else(|| "Unknown".to_string()),
                status: "已认证".to_string(),
                token_preview: format!(
                    "{}...",
                    &access_token_to_save[..50.min(access_token_to_save.len())]
                ),
                access_token: Some(access_token_to_save.clone()), // ← 纯 JWT
                refresh_token: Some(refresh_token_to_save.clone()), // ← 完整 SessionToken
                expires_at: Some(jwt_payload.exp),
                updated_at: None,
            })
        }
    }
}

/**
 * 将 type="web" 的短效 Token 转换为 type="session" 的长效 Token
 * 通过 PKCE OAuth 2.0 流程实现
 *
 * # 参数
 * - `web_token`: type="web" 的 JWT Token
 * - `user_id`: 用户 ID
 *
 * # 返回值
 * 转换后的 type="session" JWT Token
 */
#[allow(dead_code)]
async fn convert_web_token_to_session(web_token: &str, user_id: &str) -> Result<String, String> {
    println!("[PKCE] 🔄 开始 PKCE OAuth 2.0 转换流程...");
    println!(
        "[PKCE]    Web Token: {}...",
        &web_token[..50.min(web_token.len())]
    );

    // 1. 生成 PKCE 参数
    let (code_verifier, code_challenge) = generate_pkce_params();
    println!("[PKCE] ✓ PKCE 参数已生成");
    println!("[PKCE]    Challenge: {}...", &code_challenge[..30]);

    // 2. 生成请求 UUID
    let request_uuid = uuid::Uuid::new_v4().to_string();
    println!("[PKCE]    Request UUID: {}", request_uuid);

    // 3. 构造登录 URL（实际不需要访问，只用 UUID）
    // 登录 URL: https://cursor.com/cn/loginDeepControl?challenge={challenge}&uuid={uuid}&mode=login

    // 4. 轮询获取长效 Token
    println!("[PKCE] 🔍 开始轮询获取长效 Token...");

    let client = create_http_client();
    let poll_url = "https://api2.cursor.sh/auth/poll";

    // 构造 SessionToken Cookie（用于认证）
    let session_token_cookie = format!("{}%3A%3A{}", user_id, web_token);

    // 最多轮询 50 次，每次间隔 2 秒
    for attempt in 1..=50 {
        let response = client
            .get(poll_url)
            .query(&[
                ("uuid", request_uuid.as_str()),
                ("verifier", code_verifier.as_str()),
            ])
            .header(
                "Cookie",
                format!("WorkosCursorSessionToken={}", session_token_cookie),
            )
            .header("Origin", "vscode-file://vscode-app")
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Cursor/1.2.2",
            )
            .header("x-ghost-mode", "true")
            .send()
            .await;

        match response {
            Ok(resp) if resp.status() == 200 => {
                // 成功获取
                if let Ok(data) = resp.json::<serde_json::Value>().await {
                    if let Some(access_token) = data.get("accessToken").and_then(|v| v.as_str()) {
                        println!("[PKCE] ✅ 成功获取长效 Token（尝试 {} 次）", attempt);

                        // 验证是否为 session 类型
                        let verify_payload = decode_jwt_payload(access_token)?;
                        if let Some(t) = &verify_payload.token_type {
                            println!("[PKCE] ✓ 转换后类型: {}", t);
                        }

                        return Ok(access_token.to_string());
                    }
                }
            }
            Ok(resp) if resp.status() == 404 => {
                // 404 是正常状态，表示等待用户确认
                if attempt % 5 == 0 {
                    println!("[PKCE] ⏳ 等待中... ({}/50)", attempt);
                }
            }
            Ok(resp) => {
                println!("[PKCE] ⚠️ 意外状态码: {}", resp.status());
            }
            Err(e) => {
                println!("[PKCE] ⚠️ 请求失败: {}", e);
            }
        }

        // 间隔 2 秒
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }

    Err("[PKCE] 转换超时：已轮询 50 次（100秒），未能获取长效 Token".to_string())
}

/**
 * 生成 PKCE 参数
 * 返回：(code_verifier, code_challenge)
 */
#[allow(dead_code)]
fn generate_pkce_params() -> (String, String) {
    use rand::Rng;
    use sha2::{Digest, Sha256};

    // 生成 32 字节随机字符串作为 code_verifier
    let mut rng = rand::thread_rng();
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    let code_verifier: String = (0..43)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect();

    // 对 code_verifier 进行 SHA256 哈希
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();

    // Base64 URL 安全编码（无填充）
    use base64::engine::{general_purpose, Engine as _};
    let code_challenge = general_purpose::URL_SAFE_NO_PAD.encode(hash);

    (code_verifier, code_challenge)
}

/// 打开 URL（使用系统默认浏览器）
///
/// # 参数
/// - `url`: 要打开的 URL
///
/// # 返回值
/// 成功返回 Ok(())
#[tauri::command]
async fn open_url(url: String, app: tauri::AppHandle) -> Result<String, String> {
    println!("正在打开 URL: {}", url);

    // 使用 tauri-plugin-opener 打开 URL
    use tauri_plugin_opener::OpenerExt;

    app.opener()
        .open_url(url.clone(), None::<&str>)
        .map_err(|e| format!("打开 URL 失败: {}", e))?;

    Ok(format!("已在浏览器中打开：{}", url))
}

/// 选择 Cursor 可执行文件并保存
///
/// # 返回值
/// 返回选择的 Cursor 路径信息
#[tauri::command]
async fn select_cursor_exe() -> Result<CursorPathInfo, String> {
    println!("正在打开文件选择对话框...");

    // 构建文件选择对话框 - 不设置默认目录，让用户从"此电脑"开始选择
    let mut dialog_builder =
        rfd::AsyncFileDialog::new().set_title("选择 Cursor 可执行文件 (Cursor.exe)");

    // 添加文件过滤器
    #[cfg(target_os = "windows")]
    {
        dialog_builder = dialog_builder.add_filter("Cursor 可执行文件", &["exe"]);
    }

    // 显示对话框
    let file_handle = dialog_builder
        .pick_file()
        .await
        .ok_or_else(|| "用户取消选择".to_string())?;

    let path = file_handle.path().to_path_buf();

    // 验证选择的文件
    let path_info = validate_cursor_exe(path)?;

    // 保存路径配置
    save_cursor_path(&path_info)?;

    Ok(path_info)
}

/// 获取或自动检测 Cursor 路径
///
/// # 返回值
/// 返回 Cursor 路径信息
#[tauri::command]
fn get_or_detect_cursor_path_cmd() -> Result<CursorPathInfo, String> {
    get_or_detect_cursor_path()
}

/// 保存文件对话框
///
/// # 参数
/// - `default_name`: 默认文件名
/// - `content`: 要保存的内容
///
/// # 返回值
/// 返回保存的文件路径，用户取消则返回 None
#[tauri::command]
async fn save_file_dialog(default_name: String, content: String) -> Result<Option<String>, String> {
    println!("正在打开保存对话框...");

    // 构建保存对话框
    let dialog_builder = rfd::AsyncFileDialog::new()
        .set_title("选择保存位置")
        .set_file_name(&default_name)
        .add_filter("JSON文件", &["json"]);

    // 显示对话框
    let file_handle = dialog_builder.save_file().await;

    if let Some(file) = file_handle {
        let path = file.path();

        // 写入文件
        std::fs::write(path, content.as_bytes()).map_err(|e| format!("保存文件失败: {}", e))?;

        println!("✓ 文件已保存: {}", path.display());

        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        println!("用户取消了保存");
        Ok(None)
    }
}

/// 获取 Cursor 默认安装路径
///
/// # 返回值
/// 返回默认路径信息，如果未找到则返回错误
#[tauri::command]
fn get_cursor_default_path() -> Result<CursorPathInfo, String> {
    println!("正在获取 Cursor 默认安装路径...");

    let default_path = get_default_cursor_path()
        .ok_or_else(|| "未找到 Cursor 安装路径，请手动选择".to_string())?;

    validate_cursor_exe(default_path)
}

/// 选择 Windsurf 可执行文件并保存
///
/// # 返回值
/// 返回选择的 Windsurf 路径信息
#[tauri::command]
async fn select_windsurf_exe() -> Result<WindsurfPathInfo, String> {
    println!("正在打开文件选择对话框...");

    // 构建文件选择对话框
    let mut dialog_builder =
        rfd::AsyncFileDialog::new().set_title("选择 Windsurf 可执行文件 (Windsurf.exe)");

    // 添加文件过滤器
    #[cfg(target_os = "windows")]
    {
        dialog_builder = dialog_builder.add_filter("Windsurf 可执行文件", &["exe"]);
    }

    // 显示对话框
    let file_handle = dialog_builder
        .pick_file()
        .await
        .ok_or_else(|| "用户取消选择".to_string())?;

    let path = file_handle.path().to_path_buf();

    // 验证选择的文件
    let path_info = validate_windsurf_exe(path)?;

    // 保存路径配置
    save_windsurf_path(&path_info)?;

    Ok(path_info)
}

/// 获取或自动检测 Windsurf 路径
///
/// # 返回值
/// 返回 Windsurf 路径信息
#[tauri::command]
fn get_or_detect_windsurf_path_cmd() -> Result<WindsurfPathInfo, String> {
    get_or_detect_windsurf_path()
}

/// 禁用 HTTP/2 命令
#[tauri::command]
fn disable_http2_cmd() -> Result<String, String> {
    disable_http2()
}

/// 恢复 HTTP/2 命令
#[tauri::command]
fn enable_http2_cmd() -> Result<String, String> {
    enable_http2()
}

/// 设置代理命令
///
/// # 参数
/// - `port`: 代理端口号
#[tauri::command]
fn set_proxy_cmd(port: u16) -> Result<String, String> {
    set_proxy(port)
}

/// 移除代理命令
#[tauri::command]
fn remove_proxy_cmd() -> Result<String, String> {
    remove_proxy()
}

/// 获取设备信息命令
#[tauri::command]
fn get_device_info() -> Result<DeviceInfo, String> {
    println!("正在获取设备信息...");
    get_or_create_device_info()
}

/// 重置本地机器码命令
#[tauri::command]
fn reset_device_info_cmd() -> Result<DeviceInfo, String> {
    println!("正在重置本地机器码...");
    reset_device_info()
}

/// 重置 Windsurf 机器码命令
#[tauri::command]
fn reset_windsurf_machine_id_cmd() -> Result<WindsurfMachineIds, String> {
    println!("正在重置 Windsurf 机器码...");
    reset_windsurf_machine_id()
}

/// 检测Cursor版本命令
#[tauri::command]
fn detect_cursor_version_cmd() -> Result<CursorVersionInfo, String> {
    println!("正在检测Cursor版本...");
    detect_cursor_version()
}

/// 禁用 Cursor 自动更新命令
#[tauri::command]
fn disable_cursor_update_cmd() -> Result<String, String> {
    disable_cursor_update()
}

/// 启用 Cursor 自动更新命令
#[tauri::command]
fn enable_cursor_update_cmd() -> Result<String, String> {
    enable_cursor_update()
}

/// 检查 Cursor 自动更新是否已禁用命令
#[tauri::command]
fn is_cursor_update_disabled_cmd() -> Result<bool, String> {
    is_update_disabled()
}

/// 切换禁用更新状态命令
///
/// # 参数
/// - `disabled`: true=禁用更新, false=启用更新
/// - `app`: Tauri AppHandle
#[tauri::command]
fn toggle_disable_update_cmd(disabled: bool, app: tauri::AppHandle) -> Result<String, String> {
    println!(
        "[切换更新状态] 设置为: {}",
        if disabled { "禁用" } else { "启用" }
    );

    // 1. 保存配置
    update_disable_update_status(disabled, &app)?;

    // 2. 应用设置
    if disabled {
        disable_cursor_update()?;
        Ok("已禁用 Cursor 自动更新".to_string())
    } else {
        enable_cursor_update()?;
        Ok("已启用 Cursor 自动更新".to_string())
    }
}

/// 获取应用配置命令
#[tauri::command]
fn get_app_config_cmd(app: tauri::AppHandle) -> Result<AppConfig, String> {
    load_app_config(&app)
}

/// 检查管理员权限命令
#[tauri::command]
fn check_admin_privileges() -> Result<bool, String> {
    println!("检查管理员权限...");
    Ok(is_admin())
}

/// 重置Windows注册表MachineGuid命令
#[tauri::command]
fn reset_windows_registry_cmd() -> Result<RegistryResult, String> {
    println!("开始重置Windows注册表MachineGuid...");
    reset_windows_registry_machine_guid()
}

/// 获取当前MachineGuid命令
#[tauri::command]
fn get_machine_guid_cmd() -> Result<String, String> {
    println!("正在读取注册表MachineGuid...");
    read_current_machine_guid()
}

/// 手动重置Cursor机器码命令（不换号，只重置机器码）
///
/// 根据Cursor版本自动选择重置策略：
/// - Cursor < 0.45.0: 轻量级重置（仅storage.json）
/// - Cursor >= 0.45.0: 完整重置（storage.json + 注册表 + JS）
#[tauri::command]
async fn reset_cursor_machine_id(app: tauri::AppHandle) -> Result<String, String> {
    println!("开始手动重置Cursor机器码...");

    // 0. 检测Cursor版本
    println!("\n[0/5] 正在检测Cursor版本...");
    let version_info = match detect_cursor_version() {
        Ok(info) => {
            println!(
                "✓ 检测到Cursor版本: {} (>= 0.45.0: {})",
                info.version, info.is_045_plus
            );
            info
        }
        Err(e) => {
            println!("⚠ 版本检测失败: {}，使用默认策略", e);
            CursorVersionInfo {
                version: "unknown".to_string(),
                major: 0,
                minor: 0,
                patch: 0,
                is_045_plus: false, // 默认使用轻量级策略
            }
        }
    };

    // 1. 换号前自动备份
    println!("\n[1/5] 正在创建备份...");
    match create_backup(&app, Some("重置机器码前备份".to_string())) {
        Ok(backup) => {
            println!("✓ 自动备份已创建: {}", backup.id);
        }
        Err(e) => {
            println!("⚠ 自动备份失败（继续执行）: {}", e);
        }
    }

    // 2. 获取或检测 Cursor 路径
    println!("\n[2/5] 正在获取 Cursor 路径...");
    let cursor_path_info = match get_or_detect_cursor_path() {
        Ok(info) => {
            println!("✓ Cursor 路径: {}", info.exe_path);
            Some(info)
        }
        Err(e) => {
            println!("⚠ 无法获取 Cursor 路径: {}", e);
            println!("  将使用默认方式关闭所有 Cursor 进程");
            None
        }
    };

    // 3. 关闭 Cursor 进程
    println!("\n[3/5] 正在关闭 Cursor 进程...");
    let cursor_exe_path = cursor_path_info.as_ref().map(|info| info.exe_path.as_str());
    kill_cursor_processes_by_path(cursor_exe_path).ok();

    // 4. 生成新的随机机器ID
    println!("\n[4/5] 正在生成新的随机机器ID...");
    let machine_ids = generate_machine_ids();
    println!("✓ 新机器ID已生成:");
    println!("  macMachineId: {}...", &machine_ids.mac_machine_id[..16]);
    println!("  machineId: {}...", &machine_ids.machine_id[..16]);
    println!("  devDeviceId: {}", &machine_ids.dev_device_id);
    println!("  sqmId: {}", &machine_ids.sqm_id);

    // 5. 根据版本选择重置策略
    println!("\n[5/5] 正在执行重置策略...");
    let mut reset_details = Vec::new();
    let mut success = true;

    if version_info.is_045_plus {
        println!("使用完整重置策略 (Cursor >= 0.45.0)");

        // 5.1 更新 storage.json
        println!("  [5.1/5] 更新 storage.json...");
        match update_storage_json(&machine_ids) {
            Ok(()) => {
                println!("  ✓ storage.json 已更新");
                reset_details.push("storage.json 已更新".to_string());
            }
            Err(e) => {
                println!("  ❌ storage.json 更新失败: {}", e);
                reset_details.push(format!("storage.json 更新失败: {}", e));
                success = false;
            }
        }

        // 5.2 Windows注册表重置（仅Windows平台）
        #[cfg(target_os = "windows")]
        {
            println!("  [5.2/5] 重置Windows注册表...");
            match reset_windows_registry_machine_guid() {
                Ok(registry_result) => {
                    if registry_result.success {
                        println!("  ✓ Windows注册表已重置");
                        reset_details.push("Windows注册表已重置".to_string());
                        if let Some(backup_path) = registry_result.backup_path {
                            reset_details.push(format!("注册表备份: {}", backup_path));
                        }
                    } else {
                        println!("  ⚠ Windows注册表重置失败: {}", registry_result.message);
                        reset_details.push(format!(
                            "Windows注册表重置失败: {}",
                            registry_result.message
                        ));
                        // 注册表重置失败时标记整体失败
                        success = false;
                    }
                }
                Err(e) => {
                    println!("  ⚠ Windows注册表重置失败: {}", e);
                    reset_details.push(format!("Windows注册表重置失败: {}", e));
                    // 出错（例如缺少管理员权限）时标记整体失败
                    success = false;
                }
            }
        }

        // 5.3 Patch main.js
        println!("  [5.3/5] Patch main.js...");
        match patch_main_js() {
            Ok(()) => {
                println!("  ✓ main.js 已 patch");
                reset_details.push("main.js 已 patch".to_string());
            }
            Err(e) => {
                println!("  ⚠ main.js patch 失败: {}", e);
                reset_details.push(format!("main.js patch 失败: {}", e));
            }
        }
    } else {
        println!("使用轻量级重置策略 (Cursor < 0.45.0)");

        // 仅更新 storage.json
        println!("  [5.1/5] 更新 storage.json...");
        match update_storage_json(&machine_ids) {
            Ok(()) => {
                println!("  ✓ storage.json 已更新");
                reset_details.push("storage.json 已更新".to_string());
            }
            Err(e) => {
                println!("  ❌ storage.json 更新失败: {}", e);
                reset_details.push(format!("storage.json 更新失败: {}", e));
                success = false;
            }
        }
    }

    // 6. 重启 Cursor
    println!("\n重启 Cursor...");
    reopen_cursor().ok();

    println!("\n✓ Cursor 机器码重置完成！");

    // 返回详细结果
    let result = serde_json::json!({
        "success": success,
        "version_info": {
            "version": version_info.version,
            "is_045_plus": version_info.is_045_plus
        },
        "machine_ids": {
            "mac_machine_id": machine_ids.mac_machine_id,
            "machine_id": machine_ids.machine_id,
            "dev_device_id": machine_ids.dev_device_id,
            "sqm_id": machine_ids.sqm_id,
        },
        "reset_details": reset_details,
        "message": if success {
            "Cursor机器码已重置，已生成全新的随机设备ID"
        } else {
            "Cursor机器码重置完成，但部分操作失败"
        }
    });

    Ok(result.to_string())
}

/// 退出应用命令
#[tauri::command]
async fn exit_app(app: tauri::AppHandle) -> Result<(), String> {
    println!("正在退出应用...");
    app.exit(0);
    Ok(())
}

// ============ 无感换号相关命令 ============

/// 检测Cursor状态（版本、补丁状态等）
#[tauri::command]
fn detect_seamless_state() -> Result<DetectionResult, String> {
    println!("[Seamless] 检测Cursor状态...");
    seamless_switch::detect_cursor_state()
}

/// 应用无感换号补丁
#[tauri::command]
fn apply_seamless_patch(
    customer_id: String,
    api_base_url: String,
) -> Result<Vec<PatchDetail>, String> {
    println!(
        "[Seamless] 应用补丁，客户ID: {}, API: {}",
        customer_id, api_base_url
    );
    seamless_switch::apply_seamless_patch(&customer_id, &api_base_url)
}

/// 移除无感换号补丁
#[tauri::command]
fn remove_seamless_patch() -> Result<String, String> {
    println!("[Seamless] 移除补丁...");
    seamless_switch::remove_seamless_patch()
}

/// 加载无感换号配置
#[tauri::command]
fn load_seamless_config() -> Result<SeamlessSwitchConfig, String> {
    println!("[Seamless] 加载配置...");
    seamless_switch::load_config()
}

/// 保存无感换号配置
#[tauri::command]
fn save_seamless_config(config: SeamlessSwitchConfig) -> Result<(), String> {
    println!("[Seamless] 保存配置...");
    seamless_switch::save_config(&config)
}

/// 无感换号 - 本地模式（从本地账号池获取下一个账号）
#[tauri::command]
async fn seamless_switch_from_local(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    println!("[Seamless] 本地模式换号...");

    // 从本地账号存储获取账号列表
    let storage = match token_storage::get_accounts(app.clone()) {
        Ok(s) => s,
        Err(e) => return Err(format!("获取账号列表失败: {}", e)),
    };

    if storage.accounts.is_empty() {
        return Err("本地账号池为空，请先在「账号管理」中导入账号".to_string());
    }

    // 获取当前账号邮箱
    let current_email = storage.current_account.as_ref().map(|a| a.email.clone());

    // 找到下一个账号（简单轮询策略）
    let next_account = if let Some(ref curr_email) = current_email {
        // 找到当前账号的索引
        let current_idx = storage.accounts.iter().position(|a| &a.email == curr_email);
        match current_idx {
            Some(idx) => {
                // 获取下一个账号（循环）
                let next_idx = (idx + 1) % storage.accounts.len();
                storage.accounts.get(next_idx).cloned()
            }
            None => storage.accounts.first().cloned(),
        }
    } else {
        storage.accounts.first().cloned()
    };

    let account = next_account.ok_or("无法获取下一个账号")?;

    // 设置为当前账号
    token_storage::set_current_account(account.email.clone(), app)?;

    // 构造机器码信息
    let machine_ids = serde_json::json!({
        "devDeviceId": account.dev_device_id,
        "machineId": account.machine_id,
        "macMachineId": account.mac_machine_id,
        "sqmId": account.sqm_id,
    });

    // 返回账号信息
    let result = serde_json::json!({
        "success": true,
        "access_token": account.access_token,
        "email": account.email,
        "machine_ids": machine_ids,
    });

    println!("[Seamless] 本地换号成功: {}", account.email);
    Ok(result)
}

/// 获取workbench.desktop.main.js路径
#[tauri::command]
fn get_workbench_path() -> Result<String, String> {
    seamless_switch::get_workbench_path().map(|p| p.to_string_lossy().to_string())
}

/// 调用公开续杯接口，获取 Cursor AccessToken（JWT）
#[tauri::command]
async fn fetch_csk_card_renew_token() -> Result<String, String> {
    const URL: &str = "https://undersky.tech/api/public/csk-card-renew";
    let client = create_http_client();
    let resp = client
        .post(URL)
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await
        .map_err(|e| format!("续杯接口请求失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("续杯接口 HTTP {}", resp.status()));
    }
    let val: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("续杯接口响应解析失败: {}", e))?;
    let code = val.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
    if code != 0 {
        let msg = val
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("未知错误");
        return Err(format!("续杯接口返回错误 (code={}): {}", code, msg));
    }
    val.get("data")
        .and_then(|d| d.get("token"))
        .and_then(|t| t.as_str())
        .map(std::string::ToString::to_string)
        .ok_or_else(|| "续杯接口未返回 data.token".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            switch_account,                           // 一键换号命令（生成新机器ID）
            switch_account_from_list,                 // 账号列表换号（复用机器ID）
            get_account_info,                         // 获取账号基本信息
            get_account_detail_info,                  // 获取账号详细信息（含试用期）
            get_current_cursor_account_cmd,           // 从 Cursor 数据库获取当前账号
            get_current_windsurf_account_cmd,         // 从 Windsurf 数据库获取当前账号
            set_current_windsurf_account_cmd,         // 设置当前使用的 Windsurf 账号 ID
            get_current_windsurf_account_setting_cmd, // 获取用户设置的当前 Windsurf 账号 ID
            parse_session_token_cmd,                  // 解析 SessionToken
            open_url,                                 // 打开 URL
            select_cursor_exe,                        // 选择 Cursor 可执行文件并保存
            save_file_dialog,                         // 保存文件对话框
            get_cursor_default_path,                  // 获取 Cursor 默认路径
            get_or_detect_cursor_path_cmd,            // 获取或自动检测 Cursor 路径
            select_windsurf_exe,                      // 选择 Windsurf 可执行文件并保存
            get_or_detect_windsurf_path_cmd,          // 获取或自动检测 Windsurf 路径
            disable_http2_cmd,                        // 禁用 HTTP/2
            enable_http2_cmd,                         // 恢复 HTTP/2
            set_proxy_cmd,                            // 设置代理
            remove_proxy_cmd,                         // 移除代理
            get_device_info,                          // 获取设备信息
            reset_device_info_cmd,                    // 重置本地机器码
            reset_cursor_machine_id,                  // 手动重置Cursor机器码
            reset_windsurf_machine_id_cmd,            // 重置 Windsurf 机器码
            detect_cursor_version_cmd,                // 检测Cursor版本
            disable_cursor_update_cmd,                // 禁用 Cursor 自动更新
            enable_cursor_update_cmd,                 // 启用 Cursor 自动更新
            is_cursor_update_disabled_cmd,            // 检查 Cursor 自动更新状态
            toggle_disable_update_cmd,                // 切换禁用更新状态
            get_app_config_cmd,                       // 获取应用配置
            check_admin_privileges,                   // 检查管理员权限
            reset_windows_registry_cmd,               // 重置Windows注册表
            get_machine_guid_cmd,                     // 获取当前MachineGuid
            exit_app,                                 // 退出应用
            create_config_backup,                     // 创建备份
            list_config_backups,                      // 列出备份
            restore_config_backup,                    // 恢复备份
            delete_config_backup,                     // 删除备份
            add_account,                              // 添加/更新账号
            get_accounts,                             // 获取所有账号
            set_current_account,                      // 设置当前账号
            delete_account,                           // 删除账号
            import_accounts,                          // 导入账号数组
            clear_all_accounts,                       // 清空所有账号
            // 无感换号相关命令
            detect_seamless_state,      // 检测Cursor状态
            apply_seamless_patch,       // 应用无感换号补丁
            remove_seamless_patch,      // 移除无感换号补丁
            load_seamless_config,       // 加载无感换号配置
            save_seamless_config,       // 保存无感换号配置
            get_workbench_path,         // 获取workbench路径
            fetch_csk_card_renew_token, // 续杯接口获取 AccessToken
            seamless_switch_from_local, // 无感换号-本地模式
            // Windsurf API 相关命令
            windsurf_api::firebase_login,               // Firebase 登录
            windsurf_api::refresh_windsurf_token,       // 刷新 Windsurf Token
            windsurf_api::get_plan_status,              // 获取套餐状态
            windsurf_api::fetch_token_with_credentials, // 使用邮箱密码获取 Token
            windsurf_switch_account::switch_windsurf_account, // Windsurf 一键换号
            windsurf_db::list_all_keys,                 // 列出所有键（调试用）
            windsurf_db::read_windsurf_db_value,        // 读取指定键值（调试用）
        ])
        .setup(|app| {
            // 应用启动时检查并应用默认设置
            println!("[应用启动] 正在检查禁用更新设置...");

            let app_handle = app.handle().clone();

            match get_disable_update_status(&app_handle) {
                Ok(should_disable) => {
                    if should_disable {
                        println!("[应用启动] 配置为禁用更新，正在应用设置...");
                        match disable_cursor_update() {
                            Ok(msg) => println!("[应用启动] ✅ {}", msg),
                            Err(e) => println!("[应用启动] ⚠ 应用禁用更新设置失败: {}", e),
                        }
                    } else {
                        println!("[应用启动] 配置为启用更新，跳过禁用操作");
                    }
                }
                Err(e) => {
                    println!("[应用启动] 读取配置失败: {}", e);
                    println!("[应用启动] 将使用默认设置（禁用更新）");
                    // 使用默认设置：禁用更新
                    match disable_cursor_update() {
                        Ok(msg) => println!("[应用启动] ✅ {}", msg),
                        Err(e) => println!("[应用启动] ⚠ 应用禁用更新设置失败: {}", e),
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
