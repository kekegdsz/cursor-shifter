// Windsurf 换号主模块
// 实现完整的一键换号功能

use crate::backup::create_backup;
use crate::windsurf_crypto::{
    encrypt_sessions, format_for_storage, WindsurfAccount, WindsurfSession,
};
use crate::windsurf_device::reset_windsurf_machine_id;
use crate::windsurf_grpc::{get_api_key, update_api_server_config};
use rusqlite::Connection;
use serde_json::json;
use std::path::PathBuf;

/// Windsurf 一键换号命令
#[tauri::command]
pub async fn switch_windsurf_account(
    refresh_token: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    println!("=== 开始 Windsurf 一键换号 ===");

    // 0. 换号前自动备份
    println!("\n[0/7] 正在创建换号前备份...");
    match create_backup(&app, Some("Windsurf换号前自动备份".to_string())) {
        Ok(backup) => {
            println!("✓ 自动备份已创建: {}", backup.id);
        }
        Err(e) => {
            println!("⚠ 自动备份失败（继续执行）: {}", e);
        }
    }

    // 1. 刷新 Access Token
    println!("\n[1/7] 正在刷新 Access Token...");
    let access_token = refresh_windsurf_token(&refresh_token).await?;
    println!("✓ Access Token 已刷新");

    // 2. 获取 API Key
    println!("\n[2/7] 正在获取 API Key...");
    let api_response = get_api_key(&access_token).await?;
    println!("✓ API Key 已获取: {}", api_response.name);

    // 3. 生成 Sessions 数据
    println!("\n[3/7] 正在生成 Sessions 数据...");
    let sessions = vec![WindsurfSession {
        id: "d4c224ed-ab9a-4a55-bbc8-a2573c13c764".to_string(), // 固定 UUID
        access_token: api_response.api_key.clone(),
        account: WindsurfAccount {
            label: api_response.name.clone(),
            id: api_response.name.clone(),
        },
        scopes: vec![],
    }];

    // 4. 加密 Sessions
    println!("\n[4/7] 正在加密 Sessions 数据...");
    let encrypted_sessions = encrypt_sessions(&sessions)?;
    let storage_format = format_for_storage(encrypted_sessions);
    println!("✓ Sessions 数据已加密");

    // 5. 更新 state.vscdb
    println!("\n[5/7] 正在更新 state.vscdb...");
    update_windsurf_state_db(&storage_format)?;
    println!("✓ state.vscdb 已更新");

    // 6. 更新 API Server URL（可选）
    if !api_response.api_server_url.is_empty() {
        println!("\n[6/7] 正在更新 API Server URL...");
        update_api_server_config(&api_response.api_server_url).await?;
        println!("✓ API Server URL 已更新");
    } else {
        println!("\n[6/7] 跳过 API Server URL 更新（URL 为空）");
    }

    // 7. 重置机器码
    println!("\n[7/7] 正在重置机器码...");
    let machine_ids = reset_windsurf_machine_id()?;
    println!("✓ 机器码已重置");

    // 8. 重新打开 Windsurf
    println!("\n正在重新打开 Windsurf...");
    reopen_windsurf()?;

    println!("\n✅ Windsurf 一键换号完成！");

    let response = json!({
        "success": true,
        "message": "Windsurf 账号切换成功！请等待 Windsurf 启动。",
        "account": {
            "name": api_response.name,
            "api_key": api_response.api_key,
        },
        "machine_ids": {
            "machine_id": machine_ids.machine_id,
            "sqm_id": machine_ids.sqm_id,
            "dev_device_id": machine_ids.dev_device_id,
            "machineid": machine_ids.machineid,
        }
    });

    Ok(response.to_string())
}

/// 刷新 Windsurf Token
async fn refresh_windsurf_token(refresh_token: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    // 使用现有的 windsurf_api.rs 中的接口
    let url = "https://windsurf.crispvibe.cn/";

    let body = json!({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "api_key": "AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY"
    });

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/plain, */*")
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
        return Err(format!("刷新Token失败 ({}): {}", status, text));
    }

    let result: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {}", e))?;

    let access_token = result
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("响应中没有 access_token")?;

    Ok(access_token.to_string())
}

/// 更新 Windsurf state.vscdb
fn update_windsurf_state_db(sessions_data: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;

        let db_path = PathBuf::from(appdata)
            .join("Windsurf")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");

        if !db_path.exists() {
            return Err(format!("Windsurf 数据库不存在: {}", db_path.display()));
        }

        // 连接数据库
        let conn = Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

        let session_key =
            "secret://{\"extensionId\":\"codeium.windsurf\",\"key\":\"windsurf_auth.sessions\"}";

        // 检查是否存在
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM itemTable WHERE key = ?1",
                [session_key],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)
            .unwrap_or(false);

        if exists {
            // 更新
            conn.execute(
                "UPDATE itemTable SET value = ?1 WHERE key = ?2",
                [sessions_data, session_key],
            )
            .map_err(|e| format!("更新 sessions 失败: {}", e))?;
            println!("✓ 已更新 windsurf_auth.sessions");
        } else {
            // 插入
            conn.execute(
                "INSERT INTO itemTable (key, value) VALUES (?1, ?2)",
                [session_key, sessions_data],
            )
            .map_err(|e| format!("插入 sessions 失败: {}", e))?;
            println!("✓ 已插入 windsurf_auth.sessions");
        }
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;

        let db_path = PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("Windsurf")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");

        if !db_path.exists() {
            return Err(format!("Windsurf 数据库不存在: {}", db_path.display()));
        }

        // 连接数据库
        let conn = Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

        let session_key =
            "secret://{\"extensionId\":\"codeium.windsurf\",\"key\":\"windsurf_auth.sessions\"}";

        // 检查是否存在
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM itemTable WHERE key = ?1",
                [session_key],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)
            .unwrap_or(false);

        if exists {
            // 更新
            conn.execute(
                "UPDATE itemTable SET value = ?1 WHERE key = ?2",
                [sessions_data, session_key],
            )
            .map_err(|e| format!("更新 sessions 失败: {}", e))?;
            println!("✓ 已更新 windsurf_auth.sessions");
        } else {
            // 插入
            conn.execute(
                "INSERT INTO itemTable (key, value) VALUES (?1, ?2)",
                [session_key, sessions_data],
            )
            .map_err(|e| format!("插入 sessions 失败: {}", e))?;
            println!("✓ 已插入 windsurf_auth.sessions");
        }
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;

        let db_path = PathBuf::from(home)
            .join(".config")
            .join("Windsurf")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");

        if !db_path.exists() {
            return Err(format!("Windsurf 数据库不存在: {}", db_path.display()));
        }

        // 连接数据库
        let conn = Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

        let session_key =
            "secret://{\"extensionId\":\"codeium.windsurf\",\"key\":\"windsurf_auth.sessions\"}";

        // 检查是否存在
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM itemTable WHERE key = ?1",
                [session_key],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)
            .unwrap_or(false);

        if exists {
            // 更新
            conn.execute(
                "UPDATE itemTable SET value = ?1 WHERE key = ?2",
                [sessions_data, session_key],
            )
            .map_err(|e| format!("更新 sessions 失败: {}", e))?;
            println!("✓ 已更新 windsurf_auth.sessions");
        } else {
            // 插入
            conn.execute(
                "INSERT INTO itemTable (key, value) VALUES (?1, ?2)",
                [session_key, sessions_data],
            )
            .map_err(|e| format!("插入 sessions 失败: {}", e))?;
            println!("✓ 已插入 windsurf_auth.sessions");
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("Windsurf 换号功能目前仅支持 Windows、macOS 和 Linux".to_string());
    }

    Ok(())
}

/// 重新打开 Windsurf
fn reopen_windsurf() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(&["/C", "start", "windsurf://"])
            .spawn();
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("-a")
            .arg("Windsurf")
            .spawn();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg("windsurf://")
            .spawn();
    }

    println!("✓ 正在重新打开 Windsurf...");
    Ok(())
}
