// Cursor 版本检测和更新管理模块
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Cursor版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorVersionInfo {
    pub version: String,
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
    pub is_045_plus: bool, // 是否 >= 0.45.0
}

/// 获取Cursor安装路径
fn get_cursor_installation_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            paths.push(
                PathBuf::from(localappdata)
                    .join("Programs")
                    .join("cursor")
                    .join("resources")
                    .join("app")
                    .join("package.json"),
            );
        }
    }

    #[cfg(target_os = "macos")]
    {
        paths.push(
            PathBuf::from("/Applications")
                .join("Cursor.app")
                .join("Contents")
                .join("Resources")
                .join("app")
                .join("package.json"),
        );
    }

    #[cfg(target_os = "linux")]
    {
        // Linux可能有多个安装位置
        let linux_paths = vec![
            "/opt/Cursor/resources/app/package.json",
            "/usr/share/cursor/resources/app/package.json",
            "/usr/local/share/cursor/resources/app/package.json",
        ];

        for path_str in linux_paths {
            let path = PathBuf::from(path_str);
            if path.exists() {
                paths.push(path);
                break;
            }
        }
    }

    paths
}

/// 解析版本号字符串
fn parse_version(version_str: &str) -> Result<(u32, u32, u32), String> {
    let parts: Vec<&str> = version_str.split('.').collect();

    if parts.len() < 3 {
        return Err(format!("版本号格式错误: {}", version_str));
    }

    let major = parts[0]
        .parse::<u32>()
        .map_err(|_| format!("无法解析主版本号: {}", parts[0]))?;
    let minor = parts[1]
        .parse::<u32>()
        .map_err(|_| format!("无法解析次版本号: {}", parts[1]))?;
    let patch = parts[2]
        .parse::<u32>()
        .map_err(|_| format!("无法解析补丁版本号: {}", parts[2]))?;

    Ok((major, minor, patch))
}

/// 检测Cursor版本
pub fn detect_cursor_version() -> Result<CursorVersionInfo, String> {
    println!("正在检测Cursor版本...");

    let package_paths = get_cursor_installation_paths();

    for package_path in &package_paths {
        if package_path.exists() {
            println!("找到Cursor安装路径: {}", package_path.display());

            // 读取package.json文件
            let content = fs::read_to_string(package_path)
                .map_err(|e| format!("读取package.json失败: {}", e))?;

            // 解析JSON
            let package_json: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("解析package.json失败: {}", e))?;

            // 获取版本号
            let version_str = package_json["version"]
                .as_str()
                .ok_or("package.json中缺少version字段")?
                .to_string();

            println!("检测到Cursor版本: {}", version_str);

            // 解析版本号
            let (major, minor, patch) = parse_version(&version_str)?;

            // 判断是否 >= 0.45.0
            let is_045_plus = (major > 0) || (major == 0 && minor >= 45);

            let version_info = CursorVersionInfo {
                version: version_str,
                major,
                minor,
                patch,
                is_045_plus,
            };

            println!(
                "✓ 版本检测完成: {} (>= 0.45.0: {})",
                version_info.version, version_info.is_045_plus
            );

            return Ok(version_info);
        }
    }

    Err("未找到Cursor安装路径，请确保Cursor已正确安装".to_string())
}

/// 获取版本检测结果（带默认值）
pub fn get_cursor_version_info() -> CursorVersionInfo {
    match detect_cursor_version() {
        Ok(info) => info,
        Err(e) => {
            println!("⚠ 版本检测失败: {}，使用默认值", e);
            CursorVersionInfo {
                version: "unknown".to_string(),
                major: 0,
                minor: 0,
                patch: 0,
                is_045_plus: false, // 默认使用轻量级策略
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version() {
        assert_eq!(parse_version("0.45.0").unwrap(), (0, 45, 0));
        assert_eq!(parse_version("1.0.0").unwrap(), (1, 0, 0));
        assert_eq!(parse_version("0.44.5").unwrap(), (0, 44, 5));
    }

    #[test]
    fn test_version_comparison() {
        let v045 = CursorVersionInfo {
            version: "0.45.0".to_string(),
            major: 0,
            minor: 45,
            patch: 0,
            is_045_plus: true,
        };

        let v044 = CursorVersionInfo {
            version: "0.44.5".to_string(),
            major: 0,
            minor: 44,
            patch: 5,
            is_045_plus: false,
        };

        assert!(v045.is_045_plus);
        assert!(!v044.is_045_plus);
    }
}

// ============ Cursor 自动更新禁用功能 ============

/// 获取 cursor-updater 路径
fn get_updater_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let localappdata = std::env::var("LOCALAPPDATA")
            .map_err(|_| "无法获取 LOCALAPPDATA 环境变量".to_string())?;
        Ok(PathBuf::from(localappdata).join("cursor-updater"))
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("cursor-updater"))
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        Ok(PathBuf::from(home).join(".config").join("cursor-updater"))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("不支持的操作系统".to_string())
    }
}

/// 禁用 Cursor 自动更新
///
/// 通过创建一个同名文件来阻止更新程序创建目录
pub fn disable_cursor_update() -> Result<String, String> {
    println!("[更新管理] 正在禁用 Cursor 自动更新...");

    let updater_path = get_updater_path()?;
    println!("[更新管理] 目标路径: {}", updater_path.display());

    // 1. 检查并删除现有的目录或文件
    if updater_path.exists() {
        let metadata =
            fs::metadata(&updater_path).map_err(|e| format!("无法读取路径信息: {}", e))?;

        if metadata.is_file() {
            // 如果已经是阻止文件，检查是否需要更新权限
            println!("[更新管理] 阻止文件已存在");

            // 设置只读属性（确保权限正确）
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::fs::MetadataExt;
                let mut perms = fs::metadata(&updater_path)
                    .map_err(|e| format!("读取文件属性失败: {}", e))?
                    .permissions();
                perms.set_readonly(true);
                fs::set_permissions(&updater_path, perms)
                    .map_err(|e| format!("设置只读属性失败: {}", e))?;
            }

            #[cfg(any(target_os = "macos", target_os = "linux"))]
            {
                use std::os::unix::fs::PermissionsExt;
                let perms = fs::Permissions::from_mode(0o444); // 只读权限
                fs::set_permissions(&updater_path, perms)
                    .map_err(|e| format!("设置只读权限失败: {}", e))?;
            }

            return Ok("Cursor 自动更新已禁用（已存在阻止文件）".to_string());
        }

        if metadata.is_dir() {
            // 删除现有目录
            println!("[更新管理] 发现现有的 cursor-updater 目录，正在删除...");

            #[cfg(target_os = "windows")]
            {
                // Windows: 先移除只读属性，然后删除
                remove_readonly_recursive(&updater_path)?;
            }

            fs::remove_dir_all(&updater_path).map_err(|e| {
                format!(
                    "删除目录失败: {}。请手动删除: {}",
                    e,
                    updater_path.display()
                )
            })?;

            println!("[更新管理] ✓ 成功删除旧目录");
        }
    }

    // 2. 创建阻止文件
    println!("[更新管理] 正在创建阻止文件...");
    fs::write(&updater_path, "").map_err(|e| format!("创建阻止文件失败: {}", e))?;

    // 3. 设置只读属性
    println!("[更新管理] 正在设置文件属性（只读）...");

    #[cfg(target_os = "windows")]
    {
        let mut perms = fs::metadata(&updater_path)
            .map_err(|e| format!("读取文件属性失败: {}", e))?
            .permissions();
        perms.set_readonly(true);
        fs::set_permissions(&updater_path, perms)
            .map_err(|e| format!("设置只读属性失败: {}", e))?;
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o444); // r--r--r--
        fs::set_permissions(&updater_path, perms)
            .map_err(|e| format!("设置只读权限失败: {}", e))?;
    }

    println!("[更新管理] ✓ Cursor 自动更新已禁用！");
    Ok("Cursor 自动更新已禁用成功".to_string())
}

/// 启用 Cursor 自动更新
///
/// 删除阻止文件，恢复更新功能
pub fn enable_cursor_update() -> Result<String, String> {
    println!("[更新管理] 正在启用 Cursor 自动更新...");

    let updater_path = get_updater_path()?;
    println!("[更新管理] 目标路径: {}", updater_path.display());

    if !updater_path.exists() {
        println!("[更新管理] 阻止文件不存在，无需操作");
        return Ok("Cursor 自动更新已启用（无阻止文件）".to_string());
    }

    let metadata = fs::metadata(&updater_path).map_err(|e| format!("无法读取路径信息: {}", e))?;

    if metadata.is_file() {
        // 删除阻止文件
        println!("[更新管理] 正在删除阻止文件...");

        #[cfg(target_os = "windows")]
        {
            // Windows: 先移除只读属性
            let mut perms = metadata.permissions();
            perms.set_readonly(false);
            fs::set_permissions(&updater_path, perms)
                .map_err(|e| format!("移除只读属性失败: {}", e))?;
        }

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = fs::Permissions::from_mode(0o644); // rw-r--r--
            fs::set_permissions(&updater_path, perms)
                .map_err(|e| format!("修改权限失败: {}", e))?;
        }

        fs::remove_file(&updater_path).map_err(|e| format!("删除阻止文件失败: {}", e))?;

        println!("[更新管理] ✓ Cursor 自动更新已启用！");
        Ok("Cursor 自动更新已启用成功".to_string())
    } else {
        println!("[更新管理] ⚠ 发现目录而非文件，可能是正常的更新目录");
        Ok("Cursor 自动更新已启用（检测到更新目录）".to_string())
    }
}

/// 检查 Cursor 自动更新是否已禁用
pub fn is_update_disabled() -> Result<bool, String> {
    let updater_path = get_updater_path()?;

    if !updater_path.exists() {
        return Ok(false); // 路径不存在，更新未被禁用
    }

    let metadata = fs::metadata(&updater_path).map_err(|e| format!("无法读取路径信息: {}", e))?;

    // 如果是文件，说明更新已被禁用
    Ok(metadata.is_file())
}

/// Windows 专用: 递归移除只读属性
#[cfg(target_os = "windows")]
fn remove_readonly_recursive(path: &PathBuf) -> Result<(), String> {
    use std::fs;

    let metadata = fs::metadata(path).map_err(|e| format!("读取元数据失败: {}", e))?;
    let mut perms = metadata.permissions();

    if perms.readonly() {
        perms.set_readonly(false);
        fs::set_permissions(path, perms).map_err(|e| format!("移除只读属性失败: {}", e))?;
    }

    if metadata.is_dir() {
        for entry in fs::read_dir(path).map_err(|e| format!("读取目录失败: {}", e))? {
            let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
            remove_readonly_recursive(&entry.path())?;
        }
    }

    Ok(())
}
