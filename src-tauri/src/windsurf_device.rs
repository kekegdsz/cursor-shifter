// Windsurf 机器码重置模块
// 用于重置 Windsurf 的设备标识符

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

/// 机器码信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineIds {
    /// 64位十六进制机器ID
    pub machine_id: String,
    /// SQM ID (带括号的UUID)
    pub sqm_id: String,
    /// 开发设备ID (UUID)
    pub dev_device_id: String,
    /// 独立的 machineid (UUID)
    pub machineid: String,
}

/// 生成64位十六进制机器ID
fn generate_machine_id() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let chars = "0123456789abcdef";
    (0..64)
        .map(|_| {
            let idx = rng.gen_range(0..chars.len());
            chars.chars().nth(idx).unwrap()
        })
        .collect()
}

/// 生成UUID (RFC 4122 v4)
fn generate_uuid() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();

    format!(
        "{:08x}-{:04x}-4{:03x}-{:x}{:03x}-{:012x}",
        rng.gen::<u32>(),
        rng.gen::<u16>(),
        rng.gen::<u16>() & 0x0fff,
        (rng.gen::<u8>() & 0x3f) | 0x80,
        rng.gen::<u16>() & 0x0fff,
        rng.gen::<u64>() & 0xffffffffffff
    )
}

/// 生成SQM ID (带括号的UUID)
fn generate_sqm_id() -> String {
    format!("{{{}}}", generate_uuid())
}

/// 生成新的机器码
pub fn generate_machine_ids() -> MachineIds {
    MachineIds {
        machine_id: generate_machine_id(),
        sqm_id: generate_sqm_id(),
        dev_device_id: generate_uuid(),
        machineid: generate_uuid(),
    }
}

/// 获取 Windsurf 配置目录路径
fn get_windsurf_config_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;
        Ok(PathBuf::from(appdata).join("Windsurf"))
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("Windsurf"))
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        Ok(PathBuf::from(home).join(".config").join("Windsurf"))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("不支持的操作系统".to_string())
    }
}

/// 检查 Windsurf 是否正在运行
fn is_windsurf_running() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("tasklist")
            .args(&["/FI", "IMAGENAME eq Windsurf.exe", "/NH"])
            .output()
            .map_err(|e| format!("执行 tasklist 失败: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_lowercase().contains("windsurf.exe"))
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("pgrep")
            .args(&["-x", "Windsurf"])
            .output()
            .map_err(|e| format!("执行 pgrep 失败: {}", e))?;

        Ok(output.status.success())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(false)
    }
}

/// 关闭 Windsurf 进程
fn kill_windsurf_process() -> Result<(), String> {
    println!("正在关闭 Windsurf 进程...");

    #[cfg(target_os = "windows")]
    {
        // 尝试正常关闭
        let _ = Command::new("taskkill")
            .args(&["/IM", "Windsurf.exe"])
            .output();

        std::thread::sleep(std::time::Duration::from_secs(2));

        // 强制关闭
        let output = Command::new("taskkill")
            .args(&["/F", "/IM", "Windsurf.exe"])
            .output()
            .map_err(|e| format!("执行 taskkill 失败: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.contains("未找到") && !stderr.contains("not found") {
                return Err(format!("关闭 Windsurf 失败: {}", stderr));
            }
        }

        std::thread::sleep(std::time::Duration::from_secs(2));
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("killall")
            .args(&["-9", "Windsurf"])
            .output()
            .map_err(|e| format!("执行 killall 失败: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.contains("No matching processes") {
                return Err(format!("关闭 Windsurf 失败: {}", stderr));
            }
        }

        std::thread::sleep(std::time::Duration::from_secs(2));
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(())
    }
}

/// 删除缓存目录
fn delete_cache_dirs(config_dir: &PathBuf) -> Result<(), String> {
    println!("正在删除缓存目录...");

    let cache_dirs = vec![
        "Cache",
        "CachedData",
        "CachedExtensionVSIXs",
        "CachedProfilesData",
        "Code Cache",
        "Cookies",
        "Cookies-journal",
        "Crashpad",
        "DawnGraphiteCache",
        "DawnWebGPUCache",
        "GPUCache",
        "Local Storage",
        "Session Storage",
        "Shared Dictionary",
        "Shared Storage", // 修复：原为 "SharedStorage"，统一使用空格分隔的命名格式
        "TransportSecurity",
        "Trust Tokens",
        "Trust Tokens-journal",
        "blob_storage",
        "logs",
        "Network Persistent State",
    ];

    for dir_name in cache_dirs {
        let dir_path = config_dir.join(dir_name);
        if dir_path.exists() {
            if let Err(e) = std::fs::remove_dir_all(&dir_path) {
                println!("⚠ 删除 {} 失败: {}", dir_name, e);
            } else {
                println!("✓ 已删除: {}", dir_name);
            }
        }
    }

    Ok(())
}

/// 清理用户数据
fn clean_user_data(config_dir: &PathBuf) -> Result<(), String> {
    println!("正在清理用户数据...");

    let user_dir = config_dir.join("User");

    // 清理 workspaceStorage
    let workspace_storage = user_dir.join("workspaceStorage");
    if workspace_storage.exists() {
        std::fs::remove_dir_all(&workspace_storage)
            .map_err(|e| format!("删除 workspaceStorage 失败: {}", e))?;
        println!("✓ 已清理 workspaceStorage");
    }

    // 清理 History
    let history_dir = user_dir.join("History");
    if history_dir.exists() {
        std::fs::remove_dir_all(&history_dir).map_err(|e| format!("删除 History 失败: {}", e))?;
        println!("✓ 已清理 History");
    }

    Ok(())
}

/// 重置机器码
pub fn reset_windsurf_machine_id() -> Result<MachineIds, String> {
    println!("=== 开始重置 Windsurf 机器码 ===");

    // 1. 检查并关闭 Windsurf
    if is_windsurf_running()? {
        println!("检测到 Windsurf 正在运行，正在关闭...");
        kill_windsurf_process()?;
        println!("✓ Windsurf 已关闭");
    } else {
        println!("✓ Windsurf 未运行");
    }

    // 2. 获取配置目录
    let config_dir = get_windsurf_config_dir()?;
    println!("配置目录: {}", config_dir.display());

    if !config_dir.exists() {
        return Err("Windsurf 配置目录不存在，请先运行 Windsurf".to_string());
    }

    // 3. 删除缓存
    delete_cache_dirs(&config_dir)?;

    // 4. 清理用户数据
    clean_user_data(&config_dir)?;

    // 5. 生成新的机器码
    let new_ids = generate_machine_ids();
    println!("✓ 已生成新的机器码");

    // 6. 更新 storage.json
    let user_dir = config_dir.join("User");
    let global_storage = user_dir.join("globalStorage");
    let storage_json = global_storage.join("storage.json");

    // 确保目录存在
    std::fs::create_dir_all(&global_storage)
        .map_err(|e| format!("创建 globalStorage 目录失败: {}", e))?;

    // 创建 storage.json
    let storage_data = serde_json::json!({
        "telemetry.machineId": new_ids.machine_id,
        "telemetry.sqmId": new_ids.sqm_id,
        "telemetry.devDeviceId": new_ids.dev_device_id,
        "theme": "vs-dark",
        "themeBackground": "#1f1f1f"
    });

    std::fs::write(
        &storage_json,
        serde_json::to_string_pretty(&storage_data)
            .map_err(|e| format!("序列化 storage.json 失败: {}", e))?,
    )
    .map_err(|e| format!("写入 storage.json 失败: {}", e))?;

    println!("✓ 已更新 storage.json");

    // 7. 更新 machineid 文件
    let machineid_file = config_dir.join("machineid");
    std::fs::write(&machineid_file, format!("{}\n", new_ids.machineid))
        .map_err(|e| format!("写入 machineid 文件失败: {}", e))?;

    println!("✓ 已更新 machineid 文件");

    // 8. 创建 settings.json (如果不存在)
    let settings_json = user_dir.join("settings.json");
    if !settings_json.exists() {
        let settings = serde_json::json!({
            "workbench.startupEditor": "none",
            "workbench.welcomePage.walkthroughs.openOnInstall": false,
            "telemetry.telemetryLevel": "off",
            "window.commandCenter": true,
            "explorer.confirmDragAndDrop": false,
            "explorer.confirmDelete": false
        });

        std::fs::write(
            &settings_json,
            serde_json::to_string_pretty(&settings)
                .map_err(|e| format!("序列化 settings.json 失败: {}", e))?,
        )
        .map_err(|e| format!("写入 settings.json 失败: {}", e))?;

        println!("✓ 已创建 settings.json");
    }

    println!("=== ✅ Windsurf 机器码重置完成 ===");

    Ok(new_ids)
}
