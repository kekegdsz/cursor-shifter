// 设备序列号生成和管理模块
// 基于硬件信息生成唯一设备ID

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

/// 设备信息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    /// 设备序列号（SHA256 哈希值）
    pub device_id: String,
    /// 设备名称
    pub device_name: String,
    /// 操作系统信息
    pub os_info: String,
}

/// 获取设备序列号存储路径
fn get_device_id_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;
        let mut path = PathBuf::from(appdata);
        path.push("Cursor-Shifter");

        // 确保目录存在
        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
        }

        path.push("device_id.json");
        Ok(path)
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let mut path = PathBuf::from(home);
        path.push("Library");
        path.push("Application Support");
        path.push("Cursor-Shifter");

        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
        }

        path.push("device_id.json");
        Ok(path)
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let mut path = PathBuf::from(home);
        path.push(".config");
        path.push("Cursor-Shifter");

        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
        }

        path.push("device_id.json");
        Ok(path)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("不支持的操作系统".to_string())
    }
}

/// 生成设备唯一ID
///
/// 基于硬件信息（CPU、主板、MAC地址等）生成 SHA256 哈希
fn generate_device_id() -> Result<String, String> {
    use sysinfo::System;

    println!("正在生成设备序列号...");

    let mut system = System::new_all();
    system.refresh_all();

    // 收集硬件信息
    let mut hardware_info = String::new();

    // 1. CPU 信息
    if let Some(cpu) = system.cpus().first() {
        hardware_info.push_str(&format!("CPU:{}", cpu.brand()));
    }

    // 2. 系统信息
    hardware_info.push_str(&format!("OS:{}", System::name().unwrap_or_default()));
    hardware_info.push_str(&format!("VER:{}", System::os_version().unwrap_or_default()));

    // 3. 主机名
    hardware_info.push_str(&format!("HOST:{}", System::host_name().unwrap_or_default()));

    // 4. 总内存（作为硬件指纹的一部分）
    hardware_info.push_str(&format!("MEM:{}", system.total_memory()));

    println!("硬件信息: {}", hardware_info);

    // 生成 SHA256 哈希
    let mut hasher = Sha256::new();
    hasher.update(hardware_info.as_bytes());
    let result = hasher.finalize();

    // 转换为十六进制字符串
    let device_id = format!("{:x}", result);

    println!("✓ 设备序列号已生成: {}...", &device_id[..16]);

    Ok(device_id)
}

/// 获取设备名称
fn get_device_name() -> String {
    use sysinfo::System;
    System::host_name().unwrap_or_else(|| "Unknown Device".to_string())
}

/// 获取操作系统信息
fn get_os_info() -> String {
    use sysinfo::System;
    let os_name = System::name().unwrap_or_else(|| "Unknown OS".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown Version".to_string());
    format!("{} {}", os_name, os_version)
}

/// 读取本地存储的设备信息
fn read_device_info() -> Result<DeviceInfo, String> {
    let path = get_device_id_path()?;

    if !path.exists() {
        return Err("设备信息文件不存在".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取设备信息失败: {}", e))?;

    let device_info: DeviceInfo =
        serde_json::from_str(&content).map_err(|e| format!("解析设备信息失败: {}", e))?;

    Ok(device_info)
}

/// 保存设备信息到本地
fn save_device_info(device_info: &DeviceInfo) -> Result<(), String> {
    let path = get_device_id_path()?;

    let content = serde_json::to_string_pretty(device_info)
        .map_err(|e| format!("序列化设备信息失败: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("保存设备信息失败: {}", e))?;

    println!("✓ 设备信息已保存: {}", path.display());

    Ok(())
}

/// 获取或生成设备信息
///
/// 如果本地已有设备信息，直接读取
/// 否则生成新的设备ID并保存
pub fn get_or_create_device_info() -> Result<DeviceInfo, String> {
    // 尝试读取本地设备信息
    if let Ok(device_info) = read_device_info() {
        println!("✓ 从本地读取设备信息");
        return Ok(device_info);
    }

    println!("本地无设备信息，生成新的设备序列号...");

    // 生成新的设备信息
    let device_id = generate_device_id()?;
    let device_name = get_device_name();
    let os_info = get_os_info();

    let device_info = DeviceInfo {
        device_id,
        device_name,
        os_info,
    };

    // 保存到本地
    save_device_info(&device_info)?;

    Ok(device_info)
}

/// 重置设备信息
///
/// 删除本地存储的设备ID，强制重新生成新的机器码
pub fn reset_device_info() -> Result<DeviceInfo, String> {
    println!("正在重置本地机器码...");

    let path = get_device_id_path()?;

    // 如果文件存在，删除它
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("删除设备信息文件失败: {}", e))?;
        println!("✓ 已删除旧的设备信息文件");
    }

    // 生成新的设备信息
    println!("正在生成新的设备序列号...");
    let device_id = generate_device_id()?;
    let device_name = get_device_name();
    let os_info = get_os_info();

    let device_info = DeviceInfo {
        device_id,
        device_name,
        os_info,
    };

    // 保存到本地
    save_device_info(&device_info)?;

    println!("✓ 本地机器码已重置并生成新ID");

    Ok(device_info)
}
