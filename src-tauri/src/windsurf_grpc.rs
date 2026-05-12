// Windsurf gRPC 接口客户端
// 用于获取 API Key 和配置信息

use serde::{Deserialize, Serialize};
use serde_json::json;

/// RegisterUser 响应
#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterUserResponse {
    pub api_key: String,
    pub name: String,
    pub api_server_url: String,
}

/// 获取 API Key（简化版本，直接使用 access_token）
pub async fn get_api_key(access_token: &str) -> Result<RegisterUserResponse, String> {
    println!("🔑 [get_api_key] 正在获取 API Key...");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    // 使用文档中的简化接口
    let url =
        "https://register.windsurf.com/exa.seat_management_pb.SeatManagementService/RegisterUser";

    let body = json!({
        "firebase_id_token": access_token
    });

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Windsurf/1.0.0",
        )
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("获取 API Key 失败 ({}): {}", status, text));
    }

    let result: RegisterUserResponse =
        serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {}", e))?;

    println!("✓ [get_api_key] API Key 获取成功");
    Ok(result)
}

/// 更新 API Server URL 配置
pub async fn update_api_server_config(api_server_url: &str) -> Result<(), String> {
    println!("🔧 [update_api_server_config] 更新 API Server URL...");

    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;

        let config_path = std::path::PathBuf::from(appdata)
            .join("Windsurf")
            .join("User")
            .join("globalStorage")
            .join("storage.json");

        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)
                .map_err(|e| format!("读取 storage.json 失败: {}", e))?;

            let mut data: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("解析 storage.json 失败: {}", e))?;

            if let Some(obj) = data.as_object_mut() {
                obj.insert("apiServerUrl".to_string(), json!(api_server_url));
            }

            let updated_content = serde_json::to_string_pretty(&data)
                .map_err(|e| format!("序列化 JSON 失败: {}", e))?;

            std::fs::write(&config_path, updated_content)
                .map_err(|e| format!("写入 storage.json 失败: {}", e))?;

            println!("✓ API Server URL 已更新: {}", api_server_url);
        } else {
            println!("⚠ storage.json 文件不存在，跳过 API Server URL 更新");
        }
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;

        let config_path = std::path::PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("Windsurf")
            .join("User")
            .join("globalStorage")
            .join("storage.json");

        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)
                .map_err(|e| format!("读取 storage.json 失败: {}", e))?;

            let mut data: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("解析 storage.json 失败: {}", e))?;

            if let Some(obj) = data.as_object_mut() {
                obj.insert("apiServerUrl".to_string(), json!(api_server_url));
            }

            let updated_content = serde_json::to_string_pretty(&data)
                .map_err(|e| format!("序列化 JSON 失败: {}", e))?;

            std::fs::write(&config_path, updated_content)
                .map_err(|e| format!("写入 storage.json 失败: {}", e))?;

            println!("✓ API Server URL 已更新: {}", api_server_url);
        } else {
            println!("⚠ storage.json 文件不存在，跳过 API Server URL 更新");
        }
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;

        let config_path = std::path::PathBuf::from(home)
            .join(".config")
            .join("Windsurf")
            .join("User")
            .join("globalStorage")
            .join("storage.json");

        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)
                .map_err(|e| format!("读取 storage.json 失败: {}", e))?;

            let mut data: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("解析 storage.json 失败: {}", e))?;

            if let Some(obj) = data.as_object_mut() {
                obj.insert("apiServerUrl".to_string(), json!(api_server_url));
            }

            let updated_content = serde_json::to_string_pretty(&data)
                .map_err(|e| format!("序列化 JSON 失败: {}", e))?;

            std::fs::write(&config_path, updated_content)
                .map_err(|e| format!("写入 storage.json 失败: {}", e))?;

            println!("✓ API Server URL 已更新: {}", api_server_url);
        } else {
            println!("⚠ storage.json 文件不存在，跳过 API Server URL 更新");
        }
    }

    Ok(())
}
