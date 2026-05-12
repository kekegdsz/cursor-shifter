// Windsurf 加密解密模块
// 用于处理 Sessions 数据的加密存储

use base64::Engine;
use serde::{Deserialize, Serialize};

/// Windsurf Sessions 数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindsurfSession {
    pub id: String,
    pub access_token: String,
    pub account: WindsurfAccount,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindsurfAccount {
    pub label: String,
    pub id: String,
}

/// 简单的加密函数（基于 Base64，用于兼容性）
/// 在实际生产环境中，应该使用更强的加密方式
pub fn encrypt_sessions(sessions: &[WindsurfSession]) -> Result<Vec<u8>, String> {
    let json =
        serde_json::to_string(sessions).map_err(|e| format!("序列化 sessions 失败: {}", e))?;

    // 使用 Base64 编码作为简单的"加密"方式
    // 这样可以与 VSCode/Windsurf 的存储格式兼容
    let engine = base64::engine::general_purpose::STANDARD;
    let encoded = engine.encode(json.as_bytes());
    Ok(encoded.into_bytes())
}

/// 解密 Buffer 数据为 Sessions
pub fn decrypt_sessions(encrypted_data: &[u8]) -> Result<Vec<WindsurfSession>, String> {
    let encoded =
        String::from_utf8(encrypted_data.to_vec()).map_err(|e| format!("转换字符串失败: {}", e))?;

    let engine = base64::engine::general_purpose::STANDARD;
    let decoded = engine
        .decode(&encoded)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;

    let json = String::from_utf8(decoded).map_err(|e| format!("UTF-8 解码失败: {}", e))?;

    serde_json::from_str(&json).map_err(|e| format!("反序列化 sessions 失败: {}", e))
}

/// 将加密数据转换为 state.vscdb 存储格式
pub fn format_for_storage(encrypted_data: Vec<u8>) -> String {
    format!(
        "{{\"type\":\"Buffer\",\"data\":[{}]}}",
        encrypted_data
            .into_iter()
            .map(|b| b.to_string())
            .collect::<Vec<_>>()
            .join(",")
    )
}

/// 从 state.vscdb 格式解析加密数据
pub fn parse_from_storage(storage_value: &str) -> Result<Vec<u8>, String> {
    // 解析 {"type":"Buffer","data":[1,2,3]} 格式
    let re = regex::Regex::new(r#"\{"type":"Buffer","data":\[(.*?)\]\}"#)
        .map_err(|e| format!("编译正则表达式失败: {}", e))?;

    if let Some(captures) = re.captures(storage_value) {
        let data_str = captures.get(1).unwrap().as_str();
        let numbers: Vec<u8> = data_str
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();

        Ok(numbers)
    } else {
        Err("无法解析 Buffer 数据格式".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_encryption_decryption() {
        let sessions = vec![WindsurfSession {
            id: "test-id".to_string(),
            access_token: "test-token".to_string(),
            account: WindsurfAccount {
                label: "Test User".to_string(),
                id: "test-user".to_string(),
            },
            scopes: vec!["scope1".to_string()],
        }];

        let encrypted = encrypt_sessions(&sessions).unwrap();
        let decrypted = decrypt_sessions(&encrypted).unwrap();

        assert_eq!(sessions.len(), decrypted.len());
        assert_eq!(sessions[0].access_token, decrypted[0].access_token);
        assert_eq!(sessions[0].account.label, decrypted[0].account.label);
    }

    #[test]
    fn test_storage_format() {
        let test_data = vec![1, 2, 3, 255];
        let formatted = format_for_storage(test_data.clone());

        assert!(formatted.contains("\"type\":\"Buffer\""));
        assert!(formatted.contains("\"data\":[1,2,3,255]"));

        let parsed = parse_from_storage(&formatted).unwrap();
        assert_eq!(parsed, test_data);
    }
}
