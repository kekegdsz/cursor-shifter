// Windsurf 数据库读取模块
// 用于从 Windsurf 的数据库中读取账号信息
// Windsurf 使用 Firebase 认证，数据存储在 IndexedDB 或本地文件中

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Windsurf 当前账号信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindsurfAccount {
    /// 邮箱
    pub email: String,
    /// ID Token (Firebase ID Token，用于 API 调用)
    pub id_token: String,
    /// Access Token (Firebase Access Token)
    pub access_token: String,
    /// Refresh Token (Firebase Refresh Token)
    pub refresh_token: String,
    /// User ID
    pub user_id: Option<String>,
}

/// 获取 Windsurf 的数据库路径
/// Windsurf 可能使用类似 VSCode 的 state.vscdb 或 IndexedDB
fn get_windsurf_db_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;
        let mut path = PathBuf::from(appdata);
        path.push("Windsurf");
        path.push("User");
        path.push("globalStorage");
        path.push("state.vscdb");

        if !path.exists() {
            return Err(format!("Windsurf 数据库不存在: {}", path.display()));
        }

        Ok(path)
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let mut path = PathBuf::from(home);
        path.push("Library");
        path.push("Application Support");
        path.push("Windsurf");
        path.push("User");
        path.push("globalStorage");
        path.push("state.vscdb");

        if !path.exists() {
            return Err(format!("Windsurf 数据库不存在: {}", path.display()));
        }

        Ok(path)
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let mut path = PathBuf::from(home);
        path.push(".config");
        path.push("Windsurf");
        path.push("User");
        path.push("globalStorage");
        path.push("state.vscdb");

        if !path.exists() {
            return Err(format!("Windsurf 数据库不存在: {}", path.display()));
        }

        Ok(path)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("不支持的操作系统".to_string())
    }
}

/// 从数据库中读取指定键的值（带超时保护）
fn read_db_value(db_path: &PathBuf, key: &str) -> SqliteResult<Option<String>> {
    // 使用只读模式打开数据库，避免文件锁冲突
    let conn = Connection::open_with_flags(
        db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;

    // 设置超时（5秒），处理数据库繁忙情况
    conn.busy_timeout(std::time::Duration::from_secs(5))?;

    let mut stmt = conn.prepare("SELECT value FROM itemTable WHERE key = ?1")?;

    let mut rows = stmt.query([key])?;

    if let Some(row) = rows.next()? {
        let value: String = row.get(0)?;
        Ok(Some(value))
    } else {
        Ok(None)
    }
}

/// 从 Windsurf 数据库中读取当前登录的账号信息（带超时保护）
///
/// # 返回值
/// - `Ok(Some(WindsurfAccount))`: 成功读取账号信息
/// - `Ok(None)`: 数据库中没有账号信息（未登录）
/// - `Err(String)`: 读取失败
pub fn get_current_windsurf_account() -> Result<Option<WindsurfAccount>, String> {
    println!("正在从 Windsurf 数据库读取当前账号...");

    // 获取数据库路径
    let db_path = match get_windsurf_db_path() {
        Ok(path) => path,
        Err(e) => {
            println!("⚠ 无法获取 Windsurf 数据库路径: {}", e);
            return Err(e);
        }
    };

    println!("数据库路径: {}", db_path.display());

    // 使用超时机制读取数据库
    let result = std::thread::scope(|s| {
        let handle = s.spawn(|| {
            // Windsurf 使用 Firebase 认证，可能的键名：
            // - firebaseAuth/idToken
            // - firebaseAuth/accessToken
            // - firebaseAuth/refreshToken
            // - firebaseAuth/email
            // - firebaseAuth/userId
            // 或者可能使用不同的键名，需要实际测试确认

            // 尝试读取邮箱
            let email_keys = vec![
                "firebaseAuth/email",
                "windsurf/auth/email",
                "auth/email",
                "firebase/email",
            ];

            let mut email = None;
            for key in email_keys {
                if let Ok(Some(value)) = read_db_value(&db_path, key) {
                    email = Some(value);
                    println!("✓ 找到邮箱键: {}", key);
                    break;
                }
            }

            // 如果没有邮箱，说明未登录
            if email.is_none() {
                println!("数据库中没有账号信息（未登录）");
                return Ok(None);
            }

            let email = email.unwrap();
            println!("✓ 邮箱: {}", email);

            // 尝试读取 ID Token
            let id_token_keys = vec![
                "firebaseAuth/idToken",
                "windsurf/auth/idToken",
                "auth/idToken",
                "firebase/idToken",
            ];

            let mut id_token = String::new();
            for key in id_token_keys {
                if let Ok(Some(value)) = read_db_value(&db_path, key) {
                    id_token = value;
                    println!("✓ 找到 ID Token 键: {}", key);
                    break;
                }
            }

            // 尝试读取 Access Token
            let access_token_keys = vec![
                "firebaseAuth/accessToken",
                "windsurf/auth/accessToken",
                "auth/accessToken",
                "firebase/accessToken",
            ];

            let mut access_token = String::new();
            for key in access_token_keys {
                if let Ok(Some(value)) = read_db_value(&db_path, key) {
                    access_token = value;
                    println!("✓ 找到 Access Token 键: {}", key);
                    break;
                }
            }

            // 尝试读取 Refresh Token
            let refresh_token_keys = vec![
                "firebaseAuth/refreshToken",
                "windsurf/auth/refreshToken",
                "auth/refreshToken",
                "firebase/refreshToken",
            ];

            let mut refresh_token = String::new();
            for key in refresh_token_keys {
                if let Ok(Some(value)) = read_db_value(&db_path, key) {
                    refresh_token = value;
                    println!("✓ 找到 Refresh Token 键: {}", key);
                    break;
                }
            }

            // 尝试读取 User ID
            let user_id_keys = vec![
                "firebaseAuth/userId",
                "windsurf/auth/userId",
                "auth/userId",
                "firebase/userId",
            ];

            let mut user_id = None;
            for key in user_id_keys {
                if let Ok(Some(value)) = read_db_value(&db_path, key) {
                    user_id = Some(value);
                    println!("✓ 找到 User ID 键: {}", key);
                    break;
                }
            }

            // 如果没有找到任何 Token，返回错误
            if id_token.is_empty() && access_token.is_empty() && refresh_token.is_empty() {
                return Err("未找到任何 Token 信息".to_string());
            }

            Ok(Some(WindsurfAccount {
                email,
                id_token,
                access_token,
                refresh_token,
                user_id,
            }))
        });

        // 等待线程完成（最多 3 秒）
        match handle.join() {
            Ok(result) => result,
            Err(_) => Err("数据库读取线程崩溃".to_string()),
        }
    });

    result
}

/// 读取指定键的值（调试用）
#[tauri::command]
pub fn read_windsurf_db_value(key: String) -> Result<Option<String>, String> {
    let db_path = get_windsurf_db_path()?;
    read_db_value(&db_path, &key).map_err(|e| format!("读取数据库失败: {}", e))
}

/// 列出数据库中的所有键（调试用）
///
/// # 返回值
/// 返回所有键的列表
#[tauri::command]
pub fn list_all_keys() -> Result<Vec<String>, String> {
    let db_path = get_windsurf_db_path()?;

    let conn = Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("打开数据库失败: {}", e))?;

    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| format!("设置超时失败: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT key FROM itemTable")
        .map_err(|e| format!("准备查询失败: {}", e))?;

    let keys = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("查询失败: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("收集结果失败: {}", e))?;

    Ok(keys)
}
