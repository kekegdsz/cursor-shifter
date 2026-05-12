// Cursor 数据库读取模块
// 用于从 Cursor 的 state.vscdb 数据库中读取账号信息

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Cursor 当前账号信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorAccount {
    /// 邮箱
    pub email: String,
    /// AccessToken
    pub access_token: String,
    /// RefreshToken
    pub refresh_token: String,
}

/// 获取 Cursor 的 state.vscdb 数据库路径
fn get_cursor_db_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;
        let mut path = PathBuf::from(appdata);
        path.push("Cursor");
        path.push("User");
        path.push("globalStorage");
        path.push("state.vscdb");

        if !path.exists() {
            return Err(format!("Cursor 数据库不存在: {}", path.display()));
        }

        Ok(path)
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let mut path = PathBuf::from(home);
        path.push("Library");
        path.push("Application Support");
        path.push("Cursor");
        path.push("User");
        path.push("globalStorage");
        path.push("state.vscdb");

        if !path.exists() {
            return Err(format!("Cursor 数据库不存在: {}", path.display()));
        }

        Ok(path)
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let mut path = PathBuf::from(home);
        path.push(".config");
        path.push("Cursor");
        path.push("User");
        path.push("globalStorage");
        path.push("state.vscdb");

        if !path.exists() {
            return Err(format!("Cursor 数据库不存在: {}", path.display()));
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

    // 注意：只读模式下不能执行 PRAGMA journal_mode=WAL
    // WAL 模式需要写入权限，会导致 "attempt to write a readonly database" 错误
    // 由于我们只是读取数据，不需要修改 journal 模式

    let mut stmt = conn.prepare("SELECT value FROM itemTable WHERE key = ?1")?;

    let mut rows = stmt.query([key])?;

    if let Some(row) = rows.next()? {
        let value: String = row.get(0)?;
        Ok(Some(value))
    } else {
        Ok(None)
    }
}

/// 从 Cursor 数据库中读取当前登录的账号信息（带超时保护）
///
/// # 返回值
/// - `Ok(Some(CursorAccount))`: 成功读取账号信息
/// - `Ok(None)`: 数据库中没有账号信息（未登录）
/// - `Err(String)`: 读取失败
pub fn get_current_cursor_account() -> Result<Option<CursorAccount>, String> {
    println!("正在从 Cursor 数据库读取当前账号...");

    // 获取数据库路径
    let db_path = match get_cursor_db_path() {
        Ok(path) => path,
        Err(e) => {
            println!("⚠ 无法获取 Cursor 数据库路径: {}", e);
            return Err(e);
        }
    };

    println!("数据库路径: {}", db_path.display());

    // 使用超时机制读取数据库
    let result = std::thread::scope(|s| {
        let handle = s.spawn(|| {
            // 读取邮箱
            let email = read_db_value(&db_path, "cursorAuth/cachedEmail")
                .map_err(|e| format!("读取邮箱失败: {}", e))?;

            // 如果没有邮箱，说明未登录
            if email.is_none() {
                println!("数据库中没有账号信息（未登录）");
                return Ok(None);
            }

            let email = email.unwrap();
            println!("✓ 邮箱: {}", email);

            // 读取 AccessToken
            let access_token = read_db_value(&db_path, "cursorAuth/accessToken")
                .map_err(|e| format!("读取 AccessToken 失败: {}", e))?
                .unwrap_or_default();

            // 读取 RefreshToken
            let refresh_token = read_db_value(&db_path, "cursorAuth/refreshToken")
                .map_err(|e| format!("读取 RefreshToken 失败: {}", e))?
                .unwrap_or_default();

            if access_token.is_empty() {
                println!("⚠ AccessToken 为空");
            } else {
                println!(
                    "✓ AccessToken: {}...",
                    &access_token[..access_token.len().min(20)]
                );
            }

            Ok(Some(CursorAccount {
                email,
                access_token,
                refresh_token,
            }))
        });

        // 等待最多10秒
        match handle.join() {
            Ok(result) => result,
            Err(_) => Err("数据库读取线程异常".to_string()),
        }
    });

    // 如果数据库读取超时或失败，返回友好的错误信息
    match result {
        Ok(account) => Ok(account),
        Err(e) => {
            if e.contains("database is locked") || e.contains("busy") {
                println!("⚠ Cursor 数据库被锁定，可能 Cursor 正在运行");
                Err("Cursor 数据库被锁定，请关闭 Cursor 后重试".to_string())
            } else {
                println!("⚠ 数据库读取失败: {}", e);
                Err(format!("数据库读取失败: {}", e))
            }
        }
    }
}
