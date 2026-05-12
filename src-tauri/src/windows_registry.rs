// Windows 注册表操作模块
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Windows注册表操作结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryResult {
    pub success: bool,
    pub message: String,
    pub original_guid: Option<String>,
    pub new_guid: Option<String>,
    pub backup_path: Option<String>,
}

/// 检查是否具有管理员权限
#[cfg(target_os = "windows")]
pub fn is_admin() -> bool {
    use std::process::Command;

    let output = Command::new("net").args(&["session"]).output();

    match output {
        Ok(result) => result.status.success(),
        Err(_) => false,
    }
}

/// 请求管理员权限重启
#[cfg(target_os = "windows")]
pub fn restart_as_admin() -> Result<(), String> {
    use std::process::Command;

    let exe_path = std::env::current_exe().map_err(|e| format!("获取当前程序路径失败: {}", e))?;

    let args: Vec<String> = std::env::args().skip(1).collect();

    let output = Command::new("powershell")
        .args(&[
            "-Command",
            &format!(
                "Start-Process -FilePath '{}' -ArgumentList '{}' -Verb RunAs",
                exe_path.display(),
                args.join(" ")
            ),
        ])
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                println!("✓ 已请求管理员权限重启");
                Ok(())
            } else {
                Err("请求管理员权限失败".to_string())
            }
        }
        Err(e) => Err(format!("执行管理员权限请求失败: {}", e)),
    }
}

/// 备份Windows注册表MachineGuid
#[cfg(target_os = "windows")]
pub fn backup_registry_machine_guid() -> Result<String, String> {
    use std::process::Command;

    // 创建备份目录
    let appdata = std::env::var("APPDATA").map_err(|_| "无法获取APPDATA环境变量".to_string())?;
    let backup_dir = PathBuf::from(&appdata)
        .join("Cursor-Shifter")
        .join("backups");

    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;
    }

    // 生成备份文件名
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let backup_filename = format!("MachineGuid_backup_{}.reg", timestamp);
    let backup_path = backup_dir.join(&backup_filename);

    // 导出注册表
    let output = Command::new("reg")
        .args(&[
            "export",
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography",
            &backup_path.to_string_lossy(),
            "/y",
        ])
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                println!("✓ 注册表备份已创建: {}", backup_path.display());
                Ok(backup_path.to_string_lossy().to_string())
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                Err(format!("注册表备份失败: {}", stderr))
            }
        }
        Err(e) => Err(format!("执行注册表备份命令失败: {}", e)),
    }
}

/// 读取当前MachineGuid
#[cfg(target_os = "windows")]
pub fn read_current_machine_guid() -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("reg")
        .args(&[
            "query",
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography",
            "/v",
            "MachineGuid",
        ])
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                let stdout = String::from_utf8_lossy(&result.stdout);

                // 解析输出，提取GUID值
                for line in stdout.lines() {
                    if line.contains("MachineGuid") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 3 {
                            return Ok(parts[2].to_string());
                        }
                    }
                }

                Err("无法从注册表输出中解析MachineGuid".to_string())
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                Err(format!("读取注册表失败: {}", stderr))
            }
        }
        Err(e) => Err(format!("执行注册表查询命令失败: {}", e)),
    }
}

/// 生成新的GUID
#[cfg(target_os = "windows")]
pub fn generate_new_guid() -> String {
    use uuid::Uuid;
    Uuid::new_v4().to_string()
}

/// 更新Windows注册表MachineGuid
#[cfg(target_os = "windows")]
pub fn update_registry_machine_guid(new_guid: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("reg")
        .args(&[
            "add",
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography",
            "/v",
            "MachineGuid",
            "/t",
            "REG_SZ",
            "/d",
            new_guid,
            "/f",
        ])
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                println!("✓ 注册表MachineGuid已更新: {}", new_guid);
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                Err(format!("更新注册表失败: {}", stderr))
            }
        }
        Err(e) => Err(format!("执行注册表更新命令失败: {}", e)),
    }
}

/// 重置Windows注册表MachineGuid（完整流程）
#[cfg(target_os = "windows")]
pub fn reset_windows_registry_machine_guid() -> Result<RegistryResult, String> {
    println!("开始重置Windows注册表MachineGuid...");

    // 1. 检查管理员权限
    if !is_admin() {
        return Err("需要管理员权限才能修改注册表。请以管理员身份运行程序。".to_string());
    }

    // 2. 读取当前GUID
    let original_guid = match read_current_machine_guid() {
        Ok(guid) => {
            println!("当前MachineGuid: {}", guid);
            Some(guid)
        }
        Err(e) => {
            println!("⚠ 无法读取当前MachineGuid: {}", e);
            None
        }
    };

    // 3. 创建备份
    let backup_path = match backup_registry_machine_guid() {
        Ok(path) => {
            println!("✓ 注册表备份已创建");
            Some(path)
        }
        Err(e) => {
            println!("⚠ 备份创建失败: {}", e);
            None
        }
    };

    // 4. 生成新GUID
    let new_guid = generate_new_guid();
    println!("新MachineGuid: {}", new_guid);

    // 5. 更新注册表
    match update_registry_machine_guid(&new_guid) {
        Ok(()) => {
            // 6. 验证更新
            match read_current_machine_guid() {
                Ok(verify_guid) => {
                    if verify_guid == new_guid {
                        println!("✓ 注册表MachineGuid重置成功");
                        Ok(RegistryResult {
                            success: true,
                            message: "Windows注册表MachineGuid重置成功".to_string(),
                            original_guid,
                            new_guid: Some(new_guid),
                            backup_path,
                        })
                    } else {
                        Err("注册表更新验证失败".to_string())
                    }
                }
                Err(e) => Err(format!("验证注册表更新失败: {}", e)),
            }
        }
        Err(e) => Err(format!("更新注册表失败: {}", e)),
    }
}

/// 非Windows平台的空实现
#[cfg(not(target_os = "windows"))]
pub fn is_admin() -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
pub fn restart_as_admin() -> Result<(), String> {
    Err("此功能仅在Windows平台可用".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn backup_registry_machine_guid() -> Result<String, String> {
    Err("此功能仅在Windows平台可用".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn read_current_machine_guid() -> Result<String, String> {
    Err("此功能仅在Windows平台可用".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn generate_new_guid() -> String {
    use uuid::Uuid;
    Uuid::new_v4().to_string()
}

#[cfg(not(target_os = "windows"))]
pub fn update_registry_machine_guid(_new_guid: &str) -> Result<(), String> {
    Err("此功能仅在Windows平台可用".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn reset_windows_registry_machine_guid() -> Result<RegistryResult, String> {
    Err("此功能仅在Windows平台可用".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_new_guid() {
        let guid1 = generate_new_guid();
        let guid2 = generate_new_guid();

        assert_ne!(guid1, guid2);
        assert_eq!(guid1.len(), 36); // UUID格式长度
        assert!(guid1.contains('-'));
    }
}
