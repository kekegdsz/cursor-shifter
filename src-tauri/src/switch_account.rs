// 一键换号模块
use rand::Rng;
use regex::Regex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256, Sha512};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;
use uuid::Uuid;

// 导入 cursor_path 模块的函数
use crate::cursor_path::get_or_detect_cursor_path;

// ============================================
// 文件权限管理函数
// ============================================

/// 设置文件为可写状态
///
/// # 参数
/// - `path`: 文件路径
///
/// # 返回值
/// 成功返回 Ok(())
fn set_file_writable<P: AsRef<Path>>(path: P) -> Result<(), String> {
    let path = path.as_ref();
    
    #[cfg(target_os = "windows")]
    {
        // Windows: 移除只读属性
        let mut perms = fs::metadata(path)
            .map_err(|e| format!("读取文件属性失败: {}", e))?
            .permissions();
        perms.set_readonly(false);
        fs::set_permissions(path, perms)
            .map_err(|e| format!("设置文件可写失败: {}", e))?;
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        // macOS/Linux: 设置为可读写 (644)
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o644);
        fs::set_permissions(path, perms)
            .map_err(|e| format!("设置文件可写失败: {}", e))?;
    }

    Ok(())
}

/// 设置文件为只读状态
///
/// # 参数
/// - `path`: 文件路径
///
/// # 返回值
/// 成功返回 Ok(())
fn set_file_readonly<P: AsRef<Path>>(path: P) -> Result<(), String> {
    let path = path.as_ref();
    
    #[cfg(target_os = "windows")]
    {
        // Windows: 添加只读属性
        let mut perms = fs::metadata(path)
            .map_err(|e| format!("读取文件属性失败: {}", e))?
            .permissions();
        perms.set_readonly(true);
        fs::set_permissions(path, perms)
            .map_err(|e| format!("设置文件只读失败: {}", e))?;
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        // macOS/Linux: 设置为只读 (444)
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o444);
        fs::set_permissions(path, perms)
            .map_err(|e| format!("设置文件只读失败: {}", e))?;
    }

    Ok(())
}

// ============================================
// 机器ID生成和管理
// ============================================

/// 机器ID数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineIds {
    pub mac_machine_id: String, // SHA512哈希 (128字符)
    pub machine_id: String,     // SHA256哈希 (64字符)
    pub dev_device_id: String,  // UUID v4
    pub sqm_id: String,         // 大写UUID花括号格式
}

/// 生成新的机器ID
///
/// 按照Cursor官方格式规范生成设备标识符：
/// - dev_device_id: UUID v4格式
/// - machine_id: SHA256哈希 (64字符)
/// - mac_machine_id: SHA512哈希 (128字符)  
/// - sqm_id: 大写UUID花括号格式
pub fn generate_machine_ids() -> MachineIds {
    // 1. dev_device_id: UUID v4格式
    let dev_device_id = Uuid::new_v4().to_string();

    // 2. machine_id: SHA256哈希 (64字符)
    let mut machine_id_data = [0u8; 32];
    rand::thread_rng().fill(&mut machine_id_data);
    let machine_id = format!("{:x}", Sha256::digest(&machine_id_data));

    // 3. mac_machine_id: SHA512哈希 (128字符)
    let mut mac_machine_id_data = [0u8; 64];
    rand::thread_rng().fill(&mut mac_machine_id_data);
    let mac_machine_id = format!("{:x}", Sha512::digest(&mac_machine_id_data));

    // 4. sqm_id: 大写UUID花括号格式
    let sqm_id = format!("{{{}}}", Uuid::new_v4().to_string().to_uppercase());

    MachineIds {
        dev_device_id,
        machine_id,
        mac_machine_id,
        sqm_id,
    }
}

/// Windows 平台：智能获取 main.js 路径
///
/// 优先从用户保存的 Cursor 路径反推，否则使用默认路径
#[cfg(target_os = "windows")]
fn get_main_js_path_windows() -> Result<PathBuf, String> {
    // 1. 尝试从保存的 Cursor 路径反推
    if let Ok(cursor_info) = get_or_detect_cursor_path() {
        // 从 Cursor.exe 路径反推 resources 目录
        // 例如: D:\Programs\cursor\Cursor.exe
        //   -> D:\Programs\cursor\resources\app\out\main.js
        let exe_path = PathBuf::from(&cursor_info.exe_path);

        if let Some(install_dir) = exe_path.parent() {
            let main_js = install_dir
                .join("resources")
                .join("app")
                .join("out")
                .join("main.js");

            if main_js.exists() {
                println!("✓ 从自定义路径找到 main.js: {:?}", main_js);
                return Ok(main_js);
            }
        }
    }

    // 2. 使用默认路径（C盘）
    let localappdata =
        std::env::var("LOCALAPPDATA").map_err(|_| "无法获取 LOCALAPPDATA 环境变量".to_string())?;

    let default_main_js = PathBuf::from(&localappdata)
        .join("Programs")
        .join("cursor")
        .join("resources")
        .join("app")
        .join("out")
        .join("main.js");

    if default_main_js.exists() {
        println!("✓ 使用默认路径 main.js: {:?}", default_main_js);
        return Ok(default_main_js);
    }

    // 3. 找不到，返回错误
    Err(format!(
        "无法找到 main.js 文件。\n\
        请在设置页面指定 Cursor 安装路径，或确保 Cursor 已正确安装。\n\
        已尝试路径: {:?}",
        default_main_js
    ))
}

/// 获取 Cursor 相关路径
///
/// 优先使用用户保存的自定义路径，否则使用默认路径
fn get_cursor_paths() -> Result<(PathBuf, PathBuf, PathBuf), String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;

        // storage.json 和 state.vscdb 总是在 APPDATA 下
        let storage_path = PathBuf::from(&appdata)
            .join("Cursor")
            .join("User")
            .join("globalStorage")
            .join("storage.json");

        let db_path = PathBuf::from(&appdata)
            .join("Cursor")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");

        // main.js 路径需要从实际安装位置获取
        let main_js_path = get_main_js_path_windows()?;

        Ok((storage_path, db_path, main_js_path))
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;

        let storage_path = PathBuf::from(&home)
            .join("Library")
            .join("Application Support")
            .join("Cursor")
            .join("User")
            .join("globalStorage")
            .join("storage.json");

        let db_path = PathBuf::from(&home)
            .join("Library")
            .join("Application Support")
            .join("Cursor")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");

        let main_js_path = PathBuf::from("/Applications")
            .join("Cursor.app")
            .join("Contents")
            .join("Resources")
            .join("app")
            .join("out")
            .join("main.js");

        Ok((storage_path, db_path, main_js_path))
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;

        let storage_path = PathBuf::from(&home)
            .join(".config")
            .join("Cursor")
            .join("User")
            .join("globalStorage")
            .join("storage.json");

        let db_path = PathBuf::from(&home)
            .join(".config")
            .join("Cursor")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");

        // Linux 需要根据实际安装路径配置
        let main_js_path = PathBuf::from(&home)
            .join(".local")
            .join("share")
            .join("cursor")
            .join("resources")
            .join("app")
            .join("out")
            .join("main.js");

        Ok((storage_path, db_path, main_js_path))
    }
}

/// 检测 Cursor 进程是否正在运行
///
/// # 返回值
/// - `true`: Cursor 正在运行
/// - `false`: Cursor 未运行或检测失败
fn is_cursor_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        // Windows: 使用 tasklist 命令检测
        let output = Command::new("tasklist")
            .args(&["/FI", "IMAGENAME eq Cursor.exe"])
            .output();

        if let Ok(output) = output {
            let output_str = String::from_utf8_lossy(&output.stdout);
            return output_str.contains("Cursor.exe");
        }
        false
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: 使用 pgrep 命令检测
        let output = Command::new("pgrep").args(&["-f", "Cursor"]).output();

        if let Ok(output) = output {
            return !output.stdout.is_empty();
        }
        false
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 使用 pgrep 检测（避免匹配到本程序）
        let output = Command::new("pgrep").args(&["-f", "cursor.*--"]).output();

        if let Ok(output) = output {
            return !output.stdout.is_empty();
        }
        false
    }
}

/// 关闭 Cursor 进程
///
/// # 参数
/// - `cursor_exe_path`: Cursor 可执行文件的完整路径（仅用于日志，不影响关闭逻辑）
///
/// # 返回值
/// 成功返回 Ok(())
///
/// # 实现策略
/// - **Windows**: 智能权限处理 - 先尝试优雅关闭，失败后再强制关闭
/// - **macOS**: 使用 pkill -f Cursor（可靠）
/// - **Linux**: 使用 pkill -f cursor（避免误杀）
pub fn kill_cursor_processes_by_path(cursor_exe_path: Option<&str>) -> Result<(), String> {
    println!("正在关闭 Cursor 进程...");

    if let Some(path) = cursor_exe_path {
        println!("目标路径: {}", path);
    }

    // 先检测是否有进程运行
    if !is_cursor_running() {
        println!("ℹ 未找到运行中的 Cursor 进程");
        return Ok(());
    }

    println!("检测到 Cursor 进程，正在关闭...");

    #[cfg(target_os = "windows")]
    {
        // Windows: 智能权限处理策略

        // 步骤1：先尝试优雅关闭（不使用 /F 参数）
        println!("尝试优雅关闭 Cursor 进程...");
        let graceful_output = Command::new("taskkill")
            .args(&["/IM", "Cursor.exe"])
            .output();

        match graceful_output {
            Ok(out) => {
                if out.status.success() {
                    println!("✓ 已优雅关闭 Cursor 进程");
                    // 快速检查进程是否已退出
                    let mut quick_check = 0;
                    while quick_check < 10 && is_cursor_running() {
                        // 最多等待1秒
                        thread::sleep(Duration::from_millis(100));
                        quick_check += 1;
                    }
                    if quick_check < 10 {
                        println!("✓ Cursor 进程已快速退出（{}ms）", quick_check * 100);
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    println!("⚠ 优雅关闭失败: {}", stderr);
                }
            }
            Err(e) => {
                println!("⚠ 执行优雅关闭失败: {}", e);
            }
        }

        // 步骤2：如果优雅关闭失败，尝试强制关闭
        if is_cursor_running() {
            println!("尝试强制关闭 Cursor 进程...");
            let force_output = Command::new("taskkill")
                .args(&["/F", "/IM", "Cursor.exe"])
                .output();

            match force_output {
                Ok(out) => {
                    if out.status.success() {
                        println!("✓ 已强制关闭 Cursor 进程");
                        // closed 变量会在后续通过 is_cursor_running() 最终验证
                    } else {
                        let stderr = String::from_utf8_lossy(&out.stderr);
                        // 检查是否是权限问题
                        if stderr.contains("拒绝访问") || stderr.contains("Access is denied") {
                            println!("❌ 权限不足：无法关闭 Cursor 进程");
                            return Err(
                                "权限不足：无法关闭 Cursor 进程。\n\n请尝试以下方法：\n1. 手动关闭 Cursor 后再试\n2. 以管理员身份运行本程序\n3. 确保 Cursor 不是以管理员权限启动的".to_string()
                            );
                        } else {
                            println!("⚠ 强制关闭输出: {}", stderr);
                        }
                    }
                }
                Err(e) => {
                    println!("⚠ 执行强制关闭失败: {}", e);
                }
            }
        }

        // 等待进程完全终止（智能等待）
        let mut wait_count = 0;
        let max_wait_attempts = 20; // 最多等待2秒（20 * 100ms）

        while wait_count < max_wait_attempts && is_cursor_running() {
            thread::sleep(Duration::from_millis(100));
            wait_count += 1;
        }

        if wait_count >= max_wait_attempts {
            println!("⚠ 警告: Cursor 进程关闭较慢，但继续执行");
        } else {
            println!("✓ Cursor 进程已快速关闭（{}ms）", wait_count * 100);
        }

        // 步骤3：最终验证
        if is_cursor_running() {
            println!("❌ 警告: Cursor 进程未能关闭");
            return Err(
                "无法关闭 Cursor 进程。\n\n请手动关闭 Cursor 后重试。\n\n如果问题持续，请确保：\n1. Cursor 不是以管理员权限运行\n2. 没有其他程序阻止关闭 Cursor".to_string()
            );
        } else {
            println!("✓ 确认 Cursor 进程已完全关闭");
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: 使用 pkill 命令关闭进程
        println!("使用 pkill 命令关闭 Cursor 进程...");

        let output = Command::new("pkill").args(&["-f", "Cursor"]).output();

        match output {
            Ok(out) => {
                if out.status.success() {
                    println!("✓ 已使用 pkill 关闭 Cursor 进程");
                } else {
                    println!("⚠ pkill 未找到进程（可能已关闭）");
                }
            }
            Err(e) => {
                return Err(format!("执行 pkill 失败: {}", e));
            }
        }

        // 等待进程完全退出（智能等待）
        let mut wait_count = 0;
        let max_wait_attempts = 20; // 最多等待2秒（20 * 100ms）

        while wait_count < max_wait_attempts && is_cursor_running() {
            thread::sleep(Duration::from_millis(100));
            wait_count += 1;
        }

        if wait_count >= max_wait_attempts {
            println!("⚠ 警告: macOS Cursor 进程关闭较慢，但继续执行");
        } else {
            println!("✓ macOS Cursor 进程已快速关闭（{}ms）", wait_count * 100);
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 使用 pkill（避免误杀 cursor-shifter 本身）
        let output = Command::new("pkill").args(&["-f", "cursor.*--"]).output();

        match output {
            Ok(out) => {
                if out.status.success() {
                    println!("✓ 已关闭 Cursor 进程");
                } else {
                    println!("⚠ pkill 未找到进程");
                }
            }
            Err(e) => {
                return Err(format!("执行 pkill 失败: {}", e));
            }
        }

        // Linux: 智能等待进程退出
        let mut wait_count = 0;
        let max_wait_attempts = 10; // 最多等待1秒（10 * 100ms）

        while wait_count < max_wait_attempts && is_cursor_running() {
            thread::sleep(Duration::from_millis(100));
            wait_count += 1;
        }

        if wait_count >= max_wait_attempts {
            println!("⚠ 警告: Linux Cursor 进程关闭较慢，但继续执行");
        } else {
            println!("✓ Linux Cursor 进程已快速关闭（{}ms）", wait_count * 100);
        }
    }

    Ok(())
}

/// 修改 storage.json 文件
pub fn update_storage_json(ids: &MachineIds) -> Result<(), String> {
    let (storage_path, _, _) = get_cursor_paths()?;

    if !storage_path.exists() {
        return Err(format!("storage.json 不存在: {:?}", storage_path));
    }

    // 1. 设置文件为可写（防止之前被设置为只读）
    println!("  正在设置 storage.json 为可写状态...");
    set_file_writable(&storage_path)?;

    // 2. 读取现有内容
    let content =
        fs::read_to_string(&storage_path).map_err(|e| format!("读取 storage.json 失败: {}", e))?;

    // 3. 解析 JSON
    let mut data: Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 storage.json 失败: {}", e))?;

    // 4. 更新机器ID
    if let Some(obj) = data.as_object_mut() {
        obj.insert(
            "telemetry.macMachineId".to_string(),
            json!(ids.mac_machine_id),
        );
        obj.insert("telemetry.machineId".to_string(), json!(ids.machine_id));
        obj.insert(
            "telemetry.devDeviceId".to_string(),
            json!(ids.dev_device_id),
        );
        obj.insert("telemetry.sqmId".to_string(), json!(ids.sqm_id));
    }

    // 5. 写回文件
    let updated_content =
        serde_json::to_string_pretty(&data).map_err(|e| format!("序列化 JSON 失败: {}", e))?;

    fs::write(&storage_path, updated_content)
        .map_err(|e| format!("写入 storage.json 失败: {}", e))?;

    // 6. 设置文件为只读（防止 Cursor 覆盖 devDeviceId）
    println!("  正在设置 storage.json 为只读状态...");
    set_file_readonly(&storage_path)?;

    println!("✓ storage.json 已更新并设置为只读");
    Ok(())
}

/// 修改 state.vscdb 数据库
pub fn update_state_db(email: &str, access_token: &str) -> Result<(), String> {
    let (_, db_path, _) = get_cursor_paths()?;

    if !db_path.exists() {
        return Err(format!("state.vscdb 不存在: {:?}", db_path));
    }

    // 连接数据库
    let conn = Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

    // 定义要更新的键值对
    let updates = vec![
        ("cursorAuth/cachedEmail", email),
        ("cursorAuth/accessToken", access_token),
        ("cursorAuth/refreshToken", access_token), // 通常 refresh_token 和 access_token 相同
    ];

    for (key, value) in updates {
        // 先检查是否存在
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM itemTable WHERE key = ?1",
                [key],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)
            .unwrap_or(false);

        if exists {
            // 更新
            conn.execute(
                "UPDATE itemTable SET value = ?1 WHERE key = ?2",
                [value, key],
            )
            .map_err(|e| format!("更新 {} 失败: {}", key, e))?;
            println!("✓ 已更新 {}", key.split('/').last().unwrap_or(key));
        } else {
            // 插入
            conn.execute(
                "INSERT INTO itemTable (key, value) VALUES (?1, ?2)",
                [key, value],
            )
            .map_err(|e| format!("插入 {} 失败: {}", key, e))?;
            println!("✓ 已插入 {}", key.split('/').last().unwrap_or(key));
        }
    }

    println!("✓ state.vscdb 已更新");
    Ok(())
}

/// Patch main.js 文件 - 移除机器码检查
///
/// 支持多个版本的 Cursor 代码结构
pub fn patch_main_js() -> Result<(), String> {
    let (_, _, main_js_path) = get_cursor_paths()?;

    if !main_js_path.exists() {
        return Err(format!("main.js 不存在: {:?}", main_js_path));
    }

    // 读取文件内容
    let content =
        fs::read_to_string(&main_js_path).map_err(|e| format!("读取 main.js 失败: {}", e))?;

    // 定义多组正则表达式模式，支持不同版本的 Cursor
    let pattern_groups = vec![
        // 模式 1: 旧版 Cursor (0.45.x - 0.4x.x)
        // async getMachineId(){return await xxx??fallback}
        vec![
            (
                r"async getMachineId\(\)\{return [^??]+\?\?([^}]+)\}",
                "async getMachineId(){return $1}",
            ),
            (
                r"async getMacMachineId\(\)\{return [^??]+\?\?([^}]+)\}",
                "async getMacMachineId(){return $1}",
            ),
            // ⬇️ 新增：防止 devDeviceId 被 Cursor 覆盖
            (
                r"async getDevDeviceId\(\)\{return [^??]+\?\?([^}]+)\}",
                "async getDevDeviceId(){return $1}",
            ),
        ],
        // 模式 2: 新版 Cursor (0.4x.x+) - 已注释
        // 说明：新版本 Cursor 会从 storage.json 读取配置，直接修改 storage.json 即可
        // 不需要修改 main.js，因为 Cursor 会直接读取我们设置的值
        // vec![
        //     (
        //         r"async getMachineId\(\)\{return this\._telemetryService\.machineId\}",
        //         "async getMachineId(){return this._telemetryService.devDeviceId}",
        //     ),
        //     (
        //         r"async getMacMachineId\(\)\{return this\._telemetryService\.macMachineId\}",
        //         "async getMacMachineId(){return this._telemetryService.devDeviceId}",
        //     ),
        // ],
    ];

    let mut updated_content = content.clone();
    let mut patched = false;

    // 尝试每组模式
    for patterns in pattern_groups {
        let mut group_matched = false;
        let mut temp_content = updated_content.clone();

        for (pattern, replacement) in patterns {
            let re = Regex::new(pattern).map_err(|e| format!("编译正则表达式失败: {}", e))?;

            if re.is_match(&temp_content) {
                temp_content = re.replace_all(&temp_content, replacement).to_string();
                group_matched = true;
            }
        }

        // 如果这组模式有匹配，使用这组的结果
        if group_matched {
            updated_content = temp_content;
            patched = true;
            break; // 找到匹配的模式组就停止
        }
    }

    if !patched {
        println!("⚠ main.js 可能已经 patch 过或不支持当前版本");
        println!("  这不影响换号功能，storage.json 的机器码仍会更新");
        return Ok(()); // 不是错误，继续执行
    }

    // 写回文件
    fs::write(&main_js_path, updated_content).map_err(|e| format!("写入 main.js 失败: {}", e))?;

    println!("✓ main.js 已成功 patch");
    Ok(())
}

/// 重新打开 Cursor
pub fn reopen_cursor() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(&["/C", "start", "cursor://"])
            .spawn();
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: 优先使用 open -a 打开应用程序
        println!("使用 open 命令启动 Cursor.app...");
        let output = std::process::Command::new("open")
            .arg("-a")
            .arg("Cursor")
            .output();

        match output {
            Ok(out) if out.status.success() => {
                println!("✓ Cursor.app 已启动");
            }
            _ => {
                // 降级：使用 cursor:// URL scheme
                println!("⚠ open -a 失败，尝试使用 cursor:// scheme...");
                let _ = std::process::Command::new("open").arg("cursor://").spawn();
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg("cursor://")
            .spawn();
    }

    println!("✓ 正在重新打开 Cursor...");
    Ok(())
}
