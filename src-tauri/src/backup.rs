// 配置备份模块
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 备份元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub cursor_version: Option<String>,
    pub files: Vec<BackupFileInfo>,
}

/// 备份文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFileInfo {
    pub name: String,
    pub size: u64,
}

/// 备份列表项（用于前端显示）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupListItem {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub file_count: usize,
    pub total_size: u64,
}

/// 获取备份根目录
fn get_backup_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

    let backup_dir = app_data_dir.join("backups");

    // 确保目录存在
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;
    }

    Ok(backup_dir)
}

/// 获取 Cursor 配置文件路径
fn get_cursor_config_files() -> Result<Vec<(String, PathBuf)>, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;
        let localappdata = std::env::var("LOCALAPPDATA")
            .map_err(|_| "无法获取 LOCALAPPDATA 环境变量".to_string())?;

        Ok(vec![
            (
                "storage.json".to_string(),
                PathBuf::from(&appdata)
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("storage.json"),
            ),
            (
                "state.vscdb".to_string(),
                PathBuf::from(&appdata)
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
            ),
            (
                "main.js".to_string(),
                PathBuf::from(&localappdata)
                    .join("Programs")
                    .join("cursor")
                    .join("resources")
                    .join("app")
                    .join("out")
                    .join("main.js"),
            ),
        ])
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;

        Ok(vec![
            (
                "storage.json".to_string(),
                PathBuf::from(&home)
                    .join("Library")
                    .join("Application Support")
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("storage.json"),
            ),
            (
                "state.vscdb".to_string(),
                PathBuf::from(&home)
                    .join("Library")
                    .join("Application Support")
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
            ),
            (
                "main.js".to_string(),
                PathBuf::from("/Applications")
                    .join("Cursor.app")
                    .join("Contents")
                    .join("Resources")
                    .join("app")
                    .join("out")
                    .join("main.js"),
            ),
        ])
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;

        Ok(vec![
            (
                "storage.json".to_string(),
                PathBuf::from(&home)
                    .join(".config")
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("storage.json"),
            ),
            (
                "state.vscdb".to_string(),
                PathBuf::from(&home)
                    .join(".config")
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
            ),
            (
                "main.js".to_string(),
                PathBuf::from(&home)
                    .join(".local")
                    .join("share")
                    .join("cursor")
                    .join("resources")
                    .join("app")
                    .join("out")
                    .join("main.js"),
            ),
        ])
    }
}

/// 创建备份
pub fn create_backup(app: &AppHandle, name: Option<String>) -> Result<BackupMetadata, String> {
    let backup_root = get_backup_root_dir(app)?;

    // 生成备份ID（时间戳）
    let now = Local::now();
    let backup_id = format!("backup_{}", now.format("%Y%m%d_%H%M%S"));
    let backup_name = name.unwrap_or_else(|| format!("备份 {}", now.format("%Y-%m-%d %H:%M:%S")));

    // 创建备份目录
    let backup_dir = backup_root.join(&backup_id);
    fs::create_dir_all(&backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;

    // 获取要备份的文件
    let config_files = get_cursor_config_files()?;
    let mut file_infos = Vec::new();

    // 复制文件
    for (file_name, source_path) in config_files {
        if !source_path.exists() {
            println!("⚠ 文件不存在，跳过: {:?}", source_path);
            continue;
        }

        let dest_path = backup_dir.join(&file_name);

        // 复制文件
        fs::copy(&source_path, &dest_path)
            .map_err(|e| format!("复制文件 {} 失败: {}", file_name, e))?;

        // 获取文件大小
        let metadata = fs::metadata(&dest_path).map_err(|e| format!("获取文件信息失败: {}", e))?;

        file_infos.push(BackupFileInfo {
            name: file_name.clone(),
            size: metadata.len(),
        });

        println!("✓ 已备份: {}", file_name);
    }

    if file_infos.is_empty() {
        return Err("没有找到可备份的文件".to_string());
    }

    // 创建元数据
    let metadata = BackupMetadata {
        id: backup_id,
        name: backup_name,
        created_at: now.to_rfc3339(),
        cursor_version: None, // 可以后续添加版本检测
        files: file_infos,
    };

    // 保存元数据
    let metadata_path = backup_dir.join("metadata.json");
    let metadata_json =
        serde_json::to_string_pretty(&metadata).map_err(|e| format!("序列化元数据失败: {}", e))?;

    fs::write(&metadata_path, metadata_json).map_err(|e| format!("保存元数据失败: {}", e))?;

    println!("✓ 备份创建成功: {}", metadata.id);

    // 检查备份数量限制（最多保留5份）
    let cleanup_result = cleanup_old_backups(app, 5);
    if let Err(e) = cleanup_result {
        println!("⚠ 自动清理旧备份失败: {}", e);
        // 不影响备份创建，继续
    }

    Ok(metadata)
}

/// 列出所有备份
pub fn list_backups(app: &AppHandle) -> Result<Vec<BackupListItem>, String> {
    let backup_root = get_backup_root_dir(app)?;

    if !backup_root.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();

    // 遍历备份目录
    let entries = fs::read_dir(&backup_root).map_err(|e| format!("读取备份目录失败: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            let metadata_path = path.join("metadata.json");

            if metadata_path.exists() {
                // 读取元数据
                let metadata_json = fs::read_to_string(&metadata_path)
                    .map_err(|e| format!("读取元数据失败: {}", e))?;

                let metadata: BackupMetadata = serde_json::from_str(&metadata_json)
                    .map_err(|e| format!("解析元数据失败: {}", e))?;

                // 计算总大小
                let total_size: u64 = metadata.files.iter().map(|f| f.size).sum();

                backups.push(BackupListItem {
                    id: metadata.id,
                    name: metadata.name,
                    created_at: metadata.created_at,
                    file_count: metadata.files.len(),
                    total_size,
                });
            }
        }
    }

    // 按创建时间降序排序
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(backups)
}

/// 恢复备份
pub fn restore_backup(app: &AppHandle, backup_id: String) -> Result<(), String> {
    let backup_root = get_backup_root_dir(app)?;
    let backup_dir = backup_root.join(&backup_id);

    if !backup_dir.exists() {
        return Err(format!("备份不存在: {}", backup_id));
    }

    // 读取元数据
    let metadata_path = backup_dir.join("metadata.json");
    let metadata_json =
        fs::read_to_string(&metadata_path).map_err(|e| format!("读取元数据失败: {}", e))?;

    let metadata: BackupMetadata =
        serde_json::from_str(&metadata_json).map_err(|e| format!("解析元数据失败: {}", e))?;

    // 获取目标路径
    let config_files = get_cursor_config_files()?;

    // 恢复文件
    for file_info in metadata.files {
        let source_path = backup_dir.join(&file_info.name);

        // 查找目标路径
        let dest_path = config_files
            .iter()
            .find(|(name, _)| name == &file_info.name)
            .map(|(_, path)| path.clone())
            .ok_or_else(|| format!("找不到目标路径: {}", file_info.name))?;

        // 复制文件（覆盖）
        fs::copy(&source_path, &dest_path)
            .map_err(|e| format!("恢复文件 {} 失败: {}", file_info.name, e))?;

        println!("✓ 已恢复: {}", file_info.name);
    }

    println!("✓ 备份恢复成功: {}", backup_id);
    Ok(())
}

/// 删除备份
pub fn delete_backup(app: &AppHandle, backup_id: String) -> Result<(), String> {
    let backup_root = get_backup_root_dir(app)?;
    let backup_dir = backup_root.join(&backup_id);

    if !backup_dir.exists() {
        return Err(format!("备份不存在: {}", backup_id));
    }

    // 删除整个备份目录
    fs::remove_dir_all(&backup_dir).map_err(|e| format!("删除备份失败: {}", e))?;

    println!("✓ 备份已删除: {}", backup_id);
    Ok(())
}

/// 清理旧备份（保留最新的N个）
fn cleanup_old_backups(app: &AppHandle, keep_count: usize) -> Result<(), String> {
    let mut backups = list_backups(app)?;

    if backups.len() <= keep_count {
        return Ok(());
    }

    let to_delete_count = backups.len() - keep_count;
    println!(
        "⚠ 备份数量超过限制（{}份），将自动删除最旧的{}份备份",
        keep_count, to_delete_count
    );

    // 已经按时间降序排序，删除超出数量的旧备份
    for (index, backup) in backups.drain(keep_count..).enumerate() {
        delete_backup(app, backup.id.clone())?;
        println!(
            "  ✓ 已删除旧备份 [{}/{}]: {}",
            index + 1,
            to_delete_count,
            backup.name
        );
    }

    println!("✓ 自动清理完成，当前保留{}份最新备份", keep_count);

    Ok(())
}

/// 格式化文件大小（预留给前端使用，暂时标记为允许未使用）
#[allow(dead_code)]
pub fn format_size(size: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if size >= GB {
        format!("{:.2} GB", size as f64 / GB as f64)
    } else if size >= MB {
        format!("{:.2} MB", size as f64 / MB as f64)
    } else if size >= KB {
        format!("{:.2} KB", size as f64 / KB as f64)
    } else {
        format!("{} B", size)
    }
}
