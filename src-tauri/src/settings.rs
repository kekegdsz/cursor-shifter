// Cursor settings.json 管理模块
// 用于修改 Cursor 的用户设置

use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

/// 获取 Cursor 的 settings.json 路径
fn get_settings_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;
        let path = PathBuf::from(appdata)
            .join("Cursor")
            .join("User")
            .join("settings.json");
        Ok(path)
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let path = PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("Cursor")
            .join("User")
            .join("settings.json");
        Ok(path)
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let path = PathBuf::from(home)
            .join(".config")
            .join("Cursor")
            .join("User")
            .join("settings.json");
        Ok(path)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("不支持的操作系统".to_string())
    }
}

/// 修复 JSON 格式错误（去除尾随逗号、注释等）
fn fix_json_format(content: &str) -> String {
    let mut fixed = content.to_string();

    // 1. 去除 C 风格注释 (// 和 /* */)
    // 移除单行注释
    let re = regex::Regex::new(r"//.*?(\r?\n|$)").unwrap();
    fixed = re.replace_all(&fixed, "$1").to_string();

    // 移除多行注释
    let re = regex::Regex::new(r"/\*[\s\S]*?\*/").unwrap();
    fixed = re.replace_all(&fixed, "").to_string();

    // 2. 去除尾随逗号（对象和数组中）
    // 匹配 "key": value, } 或 "key": value, ] 格式
    let re = regex::Regex::new(r",\s*([}\]])").unwrap();
    fixed = re.replace_all(&fixed, "$1").to_string();

    fixed
}

/// 读取 settings.json 文件（带自动修复）
fn read_settings() -> Result<Value, String> {
    let path = get_settings_path()?;

    println!("正在读取 settings.json: {}", path.display());

    if !path.exists() {
        println!("settings.json 不存在，创建新文件");
        return Ok(json!({}));
    }

    let content =
        fs::read_to_string(&path).map_err(|e| format!("读取 settings.json 失败: {}", e))?;

    // 尝试解析 JSON
    match serde_json::from_str::<Value>(&content) {
        Ok(settings) => {
            // 解析成功，直接返回
            Ok(settings)
        }
        Err(e) => {
            // 解析失败，尝试自动修复
            println!("⚠ settings.json 解析失败: {}", e);
            println!("🔧 尝试自动修复 JSON 格式...");

            let fixed_content = fix_json_format(&content);

            // 尝试解析修复后的内容
            match serde_json::from_str::<Value>(&fixed_content) {
                Ok(settings) => {
                    println!("✓ JSON 格式已自动修复");

                    // 保存修复后的文件
                    println!("正在保存修复后的 settings.json...");
                    fs::write(&path, serde_json::to_string_pretty(&settings).unwrap())
                        .map_err(|e| format!("保存修复后的文件失败: {}", e))?;

                    println!("✓ 已自动修复并保存 settings.json");
                    Ok(settings)
                }
                Err(fix_err) => {
                    // 修复后仍然失败
                    println!("❌ 自动修复失败: {}", fix_err);
                    Err(format!(
                        "settings.json 格式错误且无法自动修复。\n\n原始错误: {}\n修复后错误: {}\n\n请手动检查文件: {}",
                        e, fix_err, path.display()
                    ))
                }
            }
        }
    }
}

/// 写入 settings.json 文件
fn write_settings(settings: &Value) -> Result<(), String> {
    let path = get_settings_path()?;

    println!("正在写入 settings.json: {}", path.display());

    // 确保目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    // 格式化输出
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化 settings.json 失败: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("写入 settings.json 失败: {}", e))?;

    println!("✓ settings.json 已更新");

    Ok(())
}

/// 禁用 HTTP/2
pub fn disable_http2() -> Result<String, String> {
    println!("正在禁用 HTTP/2...");

    let mut settings = read_settings()?;

    // 设置 cursor.general.disableHttp2 为 true
    settings["cursor.general.disableHttp2"] = json!(true);

    write_settings(&settings)?;

    Ok("HTTP/2 已禁用，请重启 Cursor 生效".to_string())
}

/// 恢复 HTTP/2
pub fn enable_http2() -> Result<String, String> {
    println!("正在恢复 HTTP/2...");

    let mut settings = read_settings()?;

    // 移除 cursor.general.disableHttp2 配置
    if let Some(obj) = settings.as_object_mut() {
        obj.remove("cursor.general.disableHttp2");
    }

    write_settings(&settings)?;

    Ok("HTTP/2 已恢复，请重启 Cursor 生效".to_string())
}

/// 设置代理
///
/// # 参数
/// - `port`: 代理端口号
pub fn set_proxy(port: u16) -> Result<String, String> {
    println!("正在设置代理端口: {}", port);

    let mut settings = read_settings()?;

    // 设置 http.proxy
    let proxy_url = format!("http://127.0.0.1:{}", port);
    settings["http.proxy"] = json!(proxy_url);

    write_settings(&settings)?;

    Ok(format!("代理已设置为：{}，请重启 Cursor 生效", proxy_url))
}

/// 移除代理
pub fn remove_proxy() -> Result<String, String> {
    println!("正在移除代理设置...");

    let mut settings = read_settings()?;

    // 移除 http.proxy 配置
    if let Some(obj) = settings.as_object_mut() {
        obj.remove("http.proxy");
    }

    write_settings(&settings)?;

    Ok("代理已移除，请重启 Cursor 生效".to_string())
}

/// 获取当前设置信息（用于调试或显示）
#[allow(dead_code)]
pub fn get_current_settings() -> Result<Value, String> {
    read_settings()
}
