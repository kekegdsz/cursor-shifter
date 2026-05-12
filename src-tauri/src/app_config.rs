// 应用配置管理模块
// 用于保存应用级别的设置

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// 应用配置结构
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// 是否禁用 Cursor 自动更新（默认: true）
    #[serde(default = "default_disable_update")]
    pub disable_cursor_update: bool,

    /// 当前使用的 Windsurf 账号 ID（用户手动设置）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_windsurf_account: Option<String>,
}

fn default_disable_update() -> bool {
    true // 默认禁用 Cursor 自动更新
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            disable_cursor_update: true,
            current_windsurf_account: None,
        }
    }
}

/// 获取配置文件路径
fn get_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

    // 确保目录存在
    fs::create_dir_all(&app_dir).map_err(|e| format!("创建应用数据目录失败: {}", e))?;

    let config_path = app_dir.join("app_config.json");
    Ok(config_path)
}

/// 加载应用配置
/// 如果文件不存在，返回默认配置
pub fn load_config(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let config_path = get_config_path(app)?;

    if !config_path.exists() {
        println!("[AppConfig] 配置文件不存在，使用默认配置");
        return Ok(AppConfig::default());
    }

    let content =
        fs::read_to_string(&config_path).map_err(|e| format!("读取配置文件失败: {}", e))?;

    let config: AppConfig =
        serde_json::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))?;

    println!("[AppConfig] ✅ 配置加载成功");
    Ok(config)
}

/// 保存应用配置
pub fn save_config(config: &AppConfig, app: &tauri::AppHandle) -> Result<(), String> {
    let config_path = get_config_path(app)?;

    let content =
        serde_json::to_string_pretty(config).map_err(|e| format!("序列化配置失败: {}", e))?;

    fs::write(&config_path, content).map_err(|e| format!("保存配置文件失败: {}", e))?;

    println!("[AppConfig] ✅ 配置保存成功: {:?}", config_path);
    Ok(())
}

/// 更新禁用更新状态
pub fn update_disable_update_status(disabled: bool, app: &tauri::AppHandle) -> Result<(), String> {
    let mut config = load_config(app)?;
    config.disable_cursor_update = disabled;
    save_config(&config, app)
}

/// 获取禁用更新状态
pub fn get_disable_update_status(app: &tauri::AppHandle) -> Result<bool, String> {
    let config = load_config(app)?;
    Ok(config.disable_cursor_update)
}

/// 设置当前使用的 Windsurf 账号 ID
pub fn set_current_windsurf_account(
    account_id: Option<String>,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let mut config = load_config(app)?;
    config.current_windsurf_account = account_id;
    save_config(&config, app)
}

/// 获取当前使用的 Windsurf 账号 ID
pub fn get_current_windsurf_account(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let config = load_config(app)?;
    Ok(config.current_windsurf_account)
}
