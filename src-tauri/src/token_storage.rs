// Token 存储模块
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// 账号数据结构（按照用户提供的格式）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccountData {
    pub email: String,
    pub plan: String,
    pub sign_up_type: String,
    pub auth_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub machine_id: String,
    pub service_machine_id: String,
    pub dev_device_id: String,
    pub mac_machine_id: String,
    pub machine_id_telemetry: String,
    pub sqm_id: String,
    pub note: String,
}

/// 账号列表存储结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccountsStorage {
    pub current_account: Option<AccountData>, // 当前激活的账号
    pub accounts: Vec<AccountData>,           // 账号列表
}

/// 获取账号数据文件路径
fn get_account_data_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;

    // 确保目录存在
    fs::create_dir_all(&app_data_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    Ok(app_data_dir.join("account_data.json"))
}

/// 保存账号列表到本地文件
fn save_accounts_storage(app: &tauri::AppHandle, storage: &AccountsStorage) -> Result<(), String> {
    let file_path = get_account_data_path(app)?;

    // 序列化为 JSON
    let json_data =
        serde_json::to_string_pretty(storage).map_err(|e| format!("序列化失败: {}", e))?;

    // 写入文件
    fs::write(&file_path, json_data).map_err(|e| format!("写入文件失败: {}", e))?;

    println!("✓ 账号数据已保存到: {:?}", file_path);
    Ok(())
}

/// 从本地文件加载账号列表
fn load_accounts_storage(app: &tauri::AppHandle) -> Result<AccountsStorage, String> {
    let file_path = get_account_data_path(app)?;

    // 检查文件是否存在
    if !file_path.exists() {
        return Ok(AccountsStorage {
            current_account: None,
            accounts: Vec::new(),
        });
    }

    // 读取文件
    let json_data = fs::read_to_string(&file_path).map_err(|e| format!("读取文件失败: {}", e))?;

    // 尝试解析为新格式
    if let Ok(storage) = serde_json::from_str::<AccountsStorage>(&json_data) {
        println!("✓ 账号列表已加载: {} 个账号", storage.accounts.len());
        return Ok(storage);
    }

    // 如果失败，尝试解析为旧格式（单个账号）并迁移
    if let Ok(old_data) = serde_json::from_str::<AccountData>(&json_data) {
        println!("⚠ 检测到旧格式数据，正在迁移...");
        let storage = AccountsStorage {
            current_account: Some(old_data.clone()),
            accounts: vec![old_data],
        };
        // 保存新格式
        save_accounts_storage(app, &storage)?;
        return Ok(storage);
    }

    Err("解析账号数据失败".to_string())
}

/// Tauri 命令：添加或更新账号到列表
#[tauri::command]
pub fn add_account(data: AccountData, app: tauri::AppHandle) -> Result<String, String> {
    let mut storage = load_accounts_storage(&app)?;

    // 检查账号是否已存在（根据邮箱判断）
    if let Some(index) = storage
        .accounts
        .iter()
        .position(|acc| acc.email == data.email)
    {
        // 更新现有账号
        storage.accounts[index] = data.clone();
        println!("✓ 账号已更新: {}", data.email);
    } else {
        // 添加新账号
        storage.accounts.push(data.clone());
        println!("✓ 账号已添加: {}", data.email);
    }

    // 如果当前没有激活账号，自动设为当前账号
    if storage.current_account.is_none() {
        storage.current_account = Some(data);
    }

    save_accounts_storage(&app, &storage)?;
    Ok("账号已保存".to_string())
}

/// Tauri 命令：获取所有账号列表
#[tauri::command]
pub fn get_accounts(app: tauri::AppHandle) -> Result<AccountsStorage, String> {
    load_accounts_storage(&app)
}

/// Tauri 命令：设置当前账号
#[tauri::command]
pub fn set_current_account(email: String, app: tauri::AppHandle) -> Result<String, String> {
    let mut storage = load_accounts_storage(&app)?;

    // 查找账号
    if let Some(account) = storage
        .accounts
        .iter()
        .find(|acc| acc.email == email)
        .cloned()
    {
        storage.current_account = Some(account);
        save_accounts_storage(&app, &storage)?;
        println!("✓ 当前账号已切换到: {}", email);
        Ok("当前账号已切换".to_string())
    } else {
        Err(format!("未找到账号: {}", email))
    }
}

/// Tauri 命令：删除指定账号
#[tauri::command]
pub fn delete_account(email: String, app: tauri::AppHandle) -> Result<String, String> {
    let mut storage = load_accounts_storage(&app)?;

    // 查找并删除账号
    if let Some(index) = storage.accounts.iter().position(|acc| acc.email == email) {
        storage.accounts.remove(index);
        println!("✓ 账号已删除: {}", email);

        // 如果删除的是当前账号，清空当前账号
        if let Some(current) = &storage.current_account {
            if current.email == email {
                storage.current_account = storage.accounts.first().cloned();
            }
        }

        save_accounts_storage(&app, &storage)?;
        Ok("账号已删除".to_string())
    } else {
        Err(format!("未找到账号: {}", email))
    }
}

/// Tauri 命令：导入账号数组（从文件内容）
#[tauri::command]
pub fn import_accounts(
    accounts: Vec<AccountData>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    if accounts.is_empty() {
        return Err("账号列表为空".to_string());
    }

    let storage = AccountsStorage {
        current_account: Some(accounts[0].clone()),
        accounts,
    };

    save_accounts_storage(&app, &storage)?;
    Ok(format!("已导入 {} 个账号", storage.accounts.len()))
}

/// Tauri 命令：清空所有账号数据
#[tauri::command]
pub fn clear_all_accounts(app: tauri::AppHandle) -> Result<String, String> {
    let file_path = get_account_data_path(&app)?;

    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| format!("删除文件失败: {}", e))?;
        println!("✓ 所有账号数据已清空");
    }

    Ok("所有账号数据已清空".to_string())
}
