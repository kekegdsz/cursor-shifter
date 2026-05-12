// SessionToken 解析模块
// 用于解析 Cursor 的 WorkosCursorSessionToken

use crate::account_info::{decode_jwt_payload, extract_user_id};
use serde::{Deserialize, Serialize};

/// SessionToken 解析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTokenResult {
    /// 用户 ID
    pub user_id: String,
    /// 邮箱
    pub email: String,
    /// AccessToken (JWT)
    pub access_token: String,
    /// 套餐类型
    pub plan: Option<String>,
}

/// 解析 WorkosCursorSessionToken 或 WebToken
///
/// 支持两种格式：
/// 1. SessionToken 格式：`user_xxx%3Asess_xxx%7C<AccessToken>`
///    - %3A 是 URL 编码的 `:`
///    - %7C 是 URL 编码的 `|`
///    - 实际格式是：`user_xxx:sess_xxx|<AccessToken>`
///
/// 2. WebToken 格式：`user_xxx%3A%3A<AccessToken>`
///    - %3A%3A 是 URL 编码的 `::`
///    - 实际格式是：`user_xxx::<AccessToken>`
///
/// # 参数
/// - `session_token`: 从 Cookie 中获取的 Token（SessionToken 或 WebToken）
///
/// # 返回值
/// - `Ok(SessionTokenResult)`: 解析成功，包含用户信息和 AccessToken
/// - `Err(String)`: 解析失败的错误信息
pub fn parse_session_token(session_token: &str) -> Result<SessionTokenResult, String> {
    println!("开始解析 Token...");
    println!("Token 长度: {} 字符", session_token.len());

    // 1. URL 解码
    let decoded = urlencoding::decode(session_token)
        .map_err(|e| format!("URL 解码失败: {}", e))?
        .to_string();

    println!("✓ URL 解码成功");
    println!("解码后格式: {}...", &decoded[..decoded.len().min(50)]);

    // 2. 智能识别格式并解析
    let (user_id_str, access_token) = if decoded.contains("::") {
        // WebToken 格式：user_xxx::<AccessToken>
        println!("检测到 WebToken 格式");

        let parts: Vec<&str> = decoded.splitn(2, "::").collect();
        if parts.len() != 2 {
            return Err(format!(
                "WebToken 格式错误：未找到 :: 分隔符。预期格式：user_xxx::<AccessToken>"
            ));
        }

        (parts[0].to_string(), parts[1].to_string())
    } else if decoded.contains('|') {
        // SessionToken 格式：user_xxx:sess_xxx|<AccessToken>
        println!("检测到 SessionToken 格式");

        let parts: Vec<&str> = decoded.split('|').collect();
        if parts.len() < 2 {
            return Err(format!(
                "SessionToken 格式错误：未找到 | 分隔符。预期格式：user_xxx:sess_xxx|<AccessToken>"
            ));
        }

        let user_session_part = parts[0];
        let access_token = parts[1].to_string();

        // 解析 user_session_part 获取 user_id
        let user_session_parts: Vec<&str> = user_session_part.split(':').collect();
        if user_session_parts.is_empty() {
            return Err(format!(
                "SessionToken 格式错误：用户会话部分格式不正确。预期格式：user_xxx:sess_xxx"
            ));
        }

        (user_session_parts[0].to_string(), access_token)
    } else {
        return Err(format!(
            "Token 格式错误：无法识别的格式。支持的格式：\n1. WebToken: user_xxx::<AccessToken>\n2. SessionToken: user_xxx:sess_xxx|<AccessToken>"
        ));
    };

    println!("✓ 成功提取 AccessToken");
    println!("  用户ID部分: {}", user_id_str);
    println!(
        "  AccessToken: {}...",
        &access_token[..access_token.len().min(30)]
    );

    // 3. 解析 AccessToken（JWT）获取详细信息
    let jwt_payload = decode_jwt_payload(&access_token)?;
    let user_id = extract_user_id(&jwt_payload.sub);

    println!("✓ JWT 解析成功");
    println!("  用户 ID (从JWT): {}", user_id);
    println!("  Token 类型: {}", jwt_payload.token_type.as_deref().unwrap_or("未知"));

    // 4. JWT 的 payload 不包含 email，需要通过 API 获取
    // 这里我们先返回一个占位符，parse_session_token_cmd 会调用 API 获取完整信息
    let placeholder_email = format!("{}@cursor.sh", user_id);

    println!("  邮箱（占位符）: {}", placeholder_email);

    Ok(SessionTokenResult {
        user_id,
        email: placeholder_email,
        access_token,
        plan: None, // 需要通过 API 获取
    })
}
