// Windsurf 路径管理模块
// 用于选择和管理 Windsurf 安装路径

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Windsurf 路径信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindsurfPathInfo {
    /// Windsurf 可执行文件路径
    pub exe_path: String,
    /// Windsurf 安装目录
    pub install_dir: String,
    /// 版本号（如果可以获取）
    pub version: Option<String>,
}

/// 验证选择的文件是否为有效的 Windsurf 可执行文件
///
/// # 参数
/// - `path`: 文件路径
///
/// # 返回值
/// - `Ok(WindsurfPathInfo)`: 验证通过，返回路径信息
/// - `Err(String)`: 验证失败，返回错误信息
pub fn validate_windsurf_exe(path: PathBuf) -> Result<WindsurfPathInfo, String> {
    println!("正在验证 Windsurf 路径: {:?}", path);

    // 1. 检查文件是否存在
    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    // 2. 检查是否为文件
    if !path.is_file() {
        return Err("选择的路径不是文件".to_string());
    }

    // 3. 获取文件名
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "无法获取文件名".to_string())?;

    // 4. 检查文件名是否为 Windsurf.exe（Windows）或 Windsurf（macOS/Linux）
    #[cfg(target_os = "windows")]
    let is_valid_name = file_name.to_lowercase() == "windsurf.exe";

    #[cfg(not(target_os = "windows"))]
    let is_valid_name = file_name == "Windsurf" || file_name == "windsurf";

    if !is_valid_name {
        return Err(format!(
            "文件名不正确，期望 Windsurf.exe，实际: {}",
            file_name
        ));
    }

    // 5. 获取安装目录
    let install_dir = path
        .parent()
        .ok_or_else(|| "无法获取安装目录".to_string())?
        .to_str()
        .ok_or_else(|| "安装目录路径无效".to_string())?
        .to_string();

    println!("✓ 验证通过");
    println!("  可执行文件: {}", path.display());
    println!("  安装目录: {}", install_dir);

    Ok(WindsurfPathInfo {
        exe_path: path.to_str().unwrap_or_default().to_string(),
        install_dir,
        version: None, // TODO: 可以尝试读取版本信息
    })
}

/// 获取保存的 Windsurf 路径配置文件位置
fn get_windsurf_path_config_file() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;
        let mut path = PathBuf::from(appdata);
        path.push("Cursor-Shifter");

        if !path.exists() {
            std::fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
        }

        path.push("windsurf_path.json");
        Ok(path)
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let mut path = PathBuf::from(home);
        path.push("Library/Application Support/Cursor-Shifter");

        if !path.exists() {
            std::fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
        }

        path.push("windsurf_path.json");
        Ok(path)
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let mut path = PathBuf::from(home);
        path.push(".config/Cursor-Shifter");

        if !path.exists() {
            std::fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
        }

        path.push("windsurf_path.json");
        Ok(path)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("不支持的操作系统".to_string())
    }
}

/// 读取保存的 Windsurf 路径
pub fn get_saved_windsurf_path() -> Result<WindsurfPathInfo, String> {
    let config_file = get_windsurf_path_config_file()?;

    if !config_file.exists() {
        return Err("未保存 Windsurf 路径配置".to_string());
    }

    let content =
        std::fs::read_to_string(&config_file).map_err(|e| format!("读取配置文件失败: {}", e))?;

    let path_info: WindsurfPathInfo =
        serde_json::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))?;

    println!("✓ 读取到保存的 Windsurf 路径: {}", path_info.exe_path);

    Ok(path_info)
}

/// 保存 Windsurf 路径配置
pub fn save_windsurf_path(path_info: &WindsurfPathInfo) -> Result<(), String> {
    let config_file = get_windsurf_path_config_file()?;

    let content =
        serde_json::to_string_pretty(path_info).map_err(|e| format!("序列化配置失败: {}", e))?;

    std::fs::write(&config_file, content).map_err(|e| format!("保存配置文件失败: {}", e))?;

    println!("✓ Windsurf 路径已保存: {}", path_info.exe_path);

    Ok(())
}

/// 获取或自动检测 Windsurf 路径
///
/// # 返回值
/// 返回 Windsurf 路径信息，如果无法获取则返回错误
pub fn get_or_detect_windsurf_path() -> Result<WindsurfPathInfo, String> {
    // 1. 尝试读取保存的路径
    if let Ok(saved_path) = get_saved_windsurf_path() {
        // 验证路径是否仍然有效
        if PathBuf::from(&saved_path.exe_path).exists() {
            return Ok(saved_path);
        } else {
            println!("⚠ 保存的路径已失效: {}", saved_path.exe_path);
        }
    }

    // 2. 尝试自动检测默认路径
    if let Some(default_path) = get_default_windsurf_path() {
        let path_info = validate_windsurf_exe(default_path)?;

        // 自动保存检测到的路径
        save_windsurf_path(&path_info)?;

        return Ok(path_info);
    }

    // 3. 无法自动检测
    Err("无法自动检测 Windsurf 安装路径，请手动选择".to_string())
}

/// 获取 Windsurf 的默认安装路径
///
/// # 返回值
/// 返回默认安装路径，如果不存在则返回 None
pub fn get_default_windsurf_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        // Windows 平台的默认路径
        let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
        let windsurf_path = PathBuf::from(local_app_data)
            .join("Programs")
            .join("windsurf")
            .join("Windsurf.exe");

        if windsurf_path.exists() {
            return Some(windsurf_path);
        }

        // 尝试其他可能的路径
        let windsurf_alt_path = PathBuf::from(std::env::var("LOCALAPPDATA").ok()?)
            .join("Windsurf")
            .join("Windsurf.exe");

        if windsurf_alt_path.exists() {
            return Some(windsurf_alt_path);
        }

        None
    }

    #[cfg(target_os = "macos")]
    {
        // macOS 平台的默认路径
        let windsurf_path = PathBuf::from("/Applications/Windsurf.app/Contents/MacOS/Windsurf");
        if windsurf_path.exists() {
            return Some(windsurf_path);
        }
        None
    }

    #[cfg(target_os = "linux")]
    {
        // Linux 平台可能的安装路径
        let home = std::env::var("HOME").ok()?;
        let paths = vec![
            PathBuf::from(&home).join(".windsurf/windsurf"),
            PathBuf::from("/usr/bin/windsurf"),
            PathBuf::from("/usr/local/bin/windsurf"),
        ];

        for path in paths {
            if path.exists() {
                return Some(path);
            }
        }
        None
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}
