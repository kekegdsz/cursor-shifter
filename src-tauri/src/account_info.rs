// 账号信息模块
use base64::{engine::general_purpose, Engine as _};
use chrono;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// JWT Payload 结构
#[derive(Debug, Deserialize, Serialize)]
pub struct JwtPayload {
    pub sub: String,        // 用户标识，格式：auth0|user_xxxxx
    pub time: String,       // 时间戳
    pub randomness: String, // 随机字符串
    pub exp: i64,           // 过期时间戳
    pub iss: String,        // 签发者
    pub scope: String,      // 权限范围
    pub aud: String,        // 受众
    #[serde(rename = "type")]
    pub token_type: Option<String>, // Token类型（可选）
}

/// 账号信息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    pub user_id: String,
    pub email: String,
    pub name: String,                  // 用户姓名
    pub subscription: String,          // Pro/Trial/Free
    pub status: String,                // 账号状态
    pub token_preview: String,         // Token预览（前6位+...）
    pub access_token: Option<String>,  // AccessToken (纯JWT，type=session)
    pub refresh_token: Option<String>, // RefreshToken (完整SessionToken格式)
    pub expires_at: Option<i64>,       // 过期时间
    pub updated_at: Option<String>,    // 最后更新时间
}

/// 用量明细
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageBreakdown {
    /// 计划内包含的
    pub included: i32,
    /// 额外透支额度
    pub bonus: i32,
    /// 总使用额度（included + bonus）
    pub total: i32,
}

/// 用量计划详情
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanUsage {
    /// 是否启用
    pub enabled: bool,
    /// 已使用（计划内）
    pub used: i32,
    /// 总限额（计划内）
    pub limit: i32,
    /// 剩余额度（计划内）
    pub remaining: i32,
    /// 明细
    pub breakdown: UsageBreakdown,
}

/// 按需用量（透支）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnDemandUsage {
    /// 是否启用
    pub enabled: bool,
    /// 已使用（按需额度）
    pub used: i32,
    /// 限额
    pub limit: Option<i32>,
    /// 剩余
    pub remaining: Option<i32>,
}

/// 个人用量
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndividualUsage {
    /// 计划用量
    pub plan: PlanUsage,
    /// 按需用量（透支）
    pub on_demand: OnDemandUsage,
}

/// 使用情况摘要
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageSummary {
    /// 会员类型：free, pro, 或其他（pro试用）
    pub membership_type: String,
    /// 计费周期开始
    pub billing_cycle_start: String,
    /// 计费周期结束
    pub billing_cycle_end: String,
    /// 个人用量
    pub individual_usage: IndividualUsage,
}

/// 计费周期信息（已废弃，保留用于兼容）
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BillingCycle {
    /// 开始日期（毫秒时间戳）
    pub start_date_epoch_millis: String,
    /// 结束日期（毫秒时间戳）
    pub end_date_epoch_millis: String,
}

/// Stripe 订阅信息（用于获取剩余天数）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StripeSubscription {
    /// 会员类型
    pub membership_type: Option<String>,
    /// 支付ID
    pub payment_id: Option<String>,
    /// 试用期剩余天数
    pub days_remaining_on_trial: Option<i32>,
    /// 订阅状态
    pub subscription_status: Option<String>,
    /// 试用长度（天数）
    pub trial_length_days: Option<i32>,
    /// 是否为团队成员
    pub is_team_member: Option<bool>,
    /// 团队会员类型
    pub team_membership_type: Option<String>,
    /// 个人会员类型
    pub individual_membership_type: Option<String>,
}

/// 账号详细信息（包含试用期）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountDetailInfo {
    /// 用户ID
    pub user_id: String,
    /// 邮箱
    pub email: String,
    /// 用户名
    pub name: String,
    /// 订阅类型
    pub subscription: String,
    /// 账号状态
    pub status: String,
    /// Token预览
    pub token_preview: String,
    /// 会员类型
    pub membership_type: String,
    /// 试用期/使用期开始时间（毫秒时间戳）
    pub trial_start_ms: Option<i64>,
    /// 试用期/使用期结束时间（毫秒时间戳）
    pub trial_end_ms: Option<i64>,
    /// 剩余天数
    pub days_remaining: Option<i32>,
    /// 是否过期
    pub is_expired: bool,
    /// 计划内已使用额度（原始值，需除以100）
    pub usage_used: Option<i32>,
    /// 计划内总限额（原始值，需除以100）
    pub usage_limit: Option<i32>,
    /// 计划内剩余额度（原始值，需除以100）
    pub usage_remaining: Option<i32>,
    /// 额外透支额度 bonus（原始值，需除以100）
    pub usage_overdraft: Option<i32>,
}

/// 解码JWT获取Payload
pub fn decode_jwt_payload(jwt_token: &str) -> Result<JwtPayload, String> {
    // JWT分为三部分：header.payload.signature
    let parts: Vec<&str> = jwt_token.split('.').collect();

    if parts.len() != 3 {
        return Err("无效的JWT格式".to_string());
    }

    // 解码payload（第二部分）
    let payload_b64 = parts[1];

    // Base64 URL解码
    let decoded = general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|e| format!("Base64解码失败: {}", e))?;

    // 转换为字符串
    let payload_str = String::from_utf8(decoded).map_err(|e| format!("UTF-8转换失败: {}", e))?;

    // 解析JSON
    let payload: JwtPayload =
        serde_json::from_str(&payload_str).map_err(|e| format!("JSON解析失败: {}", e))?;

    Ok(payload)
}

/// 从JWT提取用户ID（移除auth0|前缀）
pub fn extract_user_id(sub: &str) -> String {
    if sub.starts_with("auth0|") {
        sub[6..].to_string() // 去掉前缀auth0|
    } else {
        sub.to_string()
    }
}

/// 构造WorkosCursorSessionToken
pub fn create_session_token(user_id: &str, jwt_token: &str) -> String {
    // 格式：user_id::jwt_token，然后URL编码
    let raw_token = format!("{}::{}", user_id, jwt_token);

    // URL编码（::变成%3A%3A）
    raw_token.replace("::", "%3A%3A")
}

/// 获取账号信息（未使用，保留给未来扩展）
#[allow(dead_code)]
pub async fn fetch_account_info(session_token: &str) -> Result<AccountInfo, String> {
    let client = crate::create_http_client();

    // 构造Cookie头
    let cookie_header = format!("WorkosCursorSessionToken={}", session_token);

    // 请求Cursor API获取账号信息
    let response = client
        .get("https://api2.cursor.sh/auth/me")
        .header("Cookie", cookie_header)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Origin", "https://cursor.com")
        .header("Referer", "https://cursor.com/")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API请求失败: HTTP {}", response.status()));
    }

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    // 解析响应数据（根据实际API结构调整）
    let user_id = data
        .get("id")
        .or_else(|| data.get("userId"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let email = data
        .get("email")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown@example.com")
        .to_string();

    let name = data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown User")
        .to_string();

    // 尝试获取订阅信息
    let subscription = if let Some(sub_data) = data.get("subscription") {
        sub_data
            .get("type")
            .or_else(|| sub_data.get("plan"))
            .and_then(|v| v.as_str())
            .unwrap_or("Free")
            .to_string()
    } else {
        "Free".to_string()
    };

    let updated_at = data
        .get("updated_at")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // 账号状态
    let status = if data
        .get("verified")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        "已认证".to_string()
    } else {
        "未认证".to_string()
    };

    Ok(AccountInfo {
        user_id,
        email,
        name,
        subscription,
        status,
        token_preview: format!("{}...", &session_token[..20]), // 显示前20个字符
        access_token: None,                                    // 此函数不返回 access_token
        refresh_token: None,                                   // 此函数不返回 refresh_token
        expires_at: None,                                      // 可以从JWT的exp字段获取
        updated_at,                                            // 添加updated_at字段
    })
}

/// 尝试多个API端点获取账号信息
pub async fn fetch_account_info_with_fallback(session_token: &str) -> Result<AccountInfo, String> {
    // 根据官网请求文档，使用正确的API端点
    let api_endpoints = vec![
        "https://cursor.com/api/auth/me", // 主端点（从官网文档获得）
        "https://api2.cursor.sh/auth/me", // 备用端点
        "https://api2.cursor.sh/user/me", // 备用端点
        "https://cursor.com/api/dashboard/get-me", // 新增后备端点
    ];

    let client = crate::create_http_client();
    let cookie_header = format!("WorkosCursorSessionToken={}", session_token);

    for endpoint in api_endpoints {
        println!("尝试请求: {}", endpoint);

        // 根据端点提取正确的 Host
        let host = if endpoint.contains("api2.cursor.sh") {
            "api2.cursor.sh"
        } else {
            "cursor.com"
        };

        let response = client
            .get(endpoint)
            .header("Cookie", cookie_header.clone())
            .header("Host", host)
            .header("Connection", "keep-alive")
            .header("sec-ch-ua-arch", "x86")
            .header("sec-ch-ua-platform", "Windows")
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
            .header("sec-ch-ua", "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"")
            .header("sec-ch-ua-bitness", "64")
            .header("sec-ch-ua-mobile", "?0")
            .header("sec-ch-ua-platform-version", "19.0.0")
            .header("Accept", "*/*")
            .header("Sec-Fetch-Site", "same-origin")
            .header("Sec-Fetch-Mode", "cors")
            .header("Sec-Fetch-Dest", "empty")
            .header("Referer", "https://cursor.com/cn/dashboard")
            .header("Accept-Encoding", "gzip, deflate, br, zstd")
            .header("Accept-Language", "zh-CN,zh;q=0.9")
            .send()
            .await;

        match response {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(data) = resp.json::<Value>().await {
                    println!("✓ 成功获取账号信息: {}", endpoint);

                    // 根据官网文档响应格式解析字段
                    // {"email":"xxx@91gmail.cn","email_verified":true,"name":"xxx","sub":"user_xxx","updated_at":"...","picture":null}

                    let user_id = data
                        .get("sub") // 官网API使用sub字段
                        .or_else(|| data.get("id"))
                        .or_else(|| data.get("userId"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();

                    let email = data
                        .get("email")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown@example.com")
                        .to_string();

                    // 从名称推断套餐类型（API可能不直接提供subscription字段）
                    let name = data
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown User")
                        .to_string();

                    let updated_at = data
                        .get("updated_at")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    let subscription = if name.to_lowercase().contains("pro") {
                        "Pro".to_string()
                    } else if email.contains("trial")
                        || email.contains("temp")
                        || email.contains("91gmail.cn")
                    {
                        "Trial".to_string()
                    } else {
                        // 默认推断为Pro（因为有有效token）
                        "Pro".to_string()
                    };

                    let status = if data
                        .get("email_verified") // 官网API使用email_verified字段
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false)
                    {
                        "已认证".to_string()
                    } else {
                        "未认证".to_string()
                    };

                    return Ok(AccountInfo {
                        user_id,
                        email,
                        name,
                        subscription,
                        status,
                        token_preview: format!(
                            "{}...",
                            &session_token[..std::cmp::min(20, session_token.len())]
                        ),
                        access_token: None,  // 此函数不返回 access_token
                        refresh_token: None, // 此函数不返回 refresh_token
                        expires_at: None,
                        updated_at,
                    });
                }
            }
            Ok(resp) => {
                println!("⚠ API响应失败: {} - HTTP {}", endpoint, resp.status());
            }
            Err(e) => {
                println!("⚠ 请求失败: {} - {}", endpoint, e);
            }
        }
    }

    // 所有端点均失败后，尝试使用 usage-summary 作为回退，至少拿到会员类型
    match fetch_usage_summary(session_token).await {
        Ok(usage) => {
            let subscription = match usage.membership_type.to_lowercase().as_str() {
                "pro" => "Pro".to_string(),
                "free" => "Free".to_string(),
                other => other.to_string(),
            };

            return Ok(AccountInfo {
                user_id: "unknown".to_string(),
                email: "unknown@**".to_string(),
                name: "Unknown User".to_string(),
                subscription,
                status: "已认证".to_string(),
                token_preview: format!(
                    "{}...",
                    &session_token[..std::cmp::min(20, session_token.len())]
                ),
                access_token: None,
                refresh_token: None,
                expires_at: None,
                updated_at: None,
            });
        }
        Err(_) => Err("所有API端点都请求失败".to_string()),
    }
}

/// 获取使用情况摘要
///
/// # 参数
/// - `session_token`: SessionToken (格式: user_xxx%3A%3AAccessToken)
///
/// # 返回值
/// 返回使用情况摘要，包含会员类型
pub async fn fetch_usage_summary(session_token: &str) -> Result<UsageSummary, String> {
    println!("正在获取使用情况摘要...");

    let client = crate::create_http_client();
    let cookie_header = format!("WorkosCursorSessionToken={}", session_token);

    let response = client
        .get("https://cursor.com/api/usage-summary")
        .header("Cookie", cookie_header)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API 返回错误状态: {}", response.status()));
    }

    let usage: UsageSummary = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    println!("✓ 会员类型: {}", usage.membership_type);
    println!(
        "✓ 用量统计: 计划内 {}/{}, 透支 {}, 总使用 {}",
        usage.individual_usage.plan.used,
        usage.individual_usage.plan.limit,
        usage.individual_usage.plan.breakdown.bonus,
        usage.individual_usage.plan.breakdown.total
    );

    Ok(usage)
}

/// 获取 Stripe 订阅信息（用于获取剩余天数）
///
/// # 参数
/// - `session_token`: SessionToken
///
/// # 返回值
/// 返回 Stripe 订阅信息
pub async fn fetch_stripe_subscription(session_token: &str) -> Result<StripeSubscription, String> {
    let client = crate::create_http_client();
    let cookie_header = format!("WorkosCursorSessionToken={}", session_token);

    let response = client
        .get("https://cursor.com/api/auth/stripe")
        .header("Cookie", cookie_header)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .send()
        .await
        .map_err(|e| {
            println!("❌ [ERROR] 请求 Stripe API失败: {}", e);
            format!("请求失败: {}", e)
        })?;

    let status = response.status();

    if !status.is_success() {
        println!("❌ [ERROR] API返回非成功状态码: {}", status);
        return Err(format!("API 返回错误状态: {}", status));
    }

    // 先获取原始文本查看
    let response_text = response.text().await.map_err(|e| {
        println!("❌ [ERROR] 读取响应文本失败: {}", e);
        format!("读取响应失败: {}", e)
    })?;

    // 解析JSON
    let subscription: StripeSubscription = serde_json::from_str(&response_text).map_err(|e| {
        println!("❌ [ERROR] 解析JSON失败: {}", e);
        println!("❌ [ERROR] 原始响应内容: {}", response_text);
        format!("解析响应失败: {}", e)
    })?;

    println!("✅ [SUCCESS] Stripe 订阅信息解析成功");
    println!("  - 会员类型: {:?}", subscription.membership_type);
    println!("  - 剩余天数: {:?}", subscription.days_remaining_on_trial);
    println!("  - 订阅状态: {:?}", subscription.subscription_status);
    println!("========== Stripe 订阅信息获取完成 ==========\n");

    Ok(subscription)
}

/// 获取当前计费周期（已废弃，保留用于兼容）
///
/// # 参数
/// - `session_token`: SessionToken
///
/// # 返回值
/// 返回计费周期信息
#[allow(dead_code)]
pub async fn fetch_billing_cycle(session_token: &str) -> Result<BillingCycle, String> {
    let client = crate::create_http_client();
    let cookie_header = format!("WorkosCursorSessionToken={}", session_token);

    let response = client
        .get("https://cursor.com/api/dashboard/get-current-billing-cycle")
        .header("Cookie", cookie_header)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .send()
        .await
        .map_err(|e| {
            println!("❌ [ERROR] 请求计费周期API失败: {}", e);
            format!("请求失败: {}", e)
        })?;

    let status = response.status();

    if !status.is_success() {
        println!("❌ [ERROR] API返回非成功状态码: {}", status);
        return Err(format!("API 返回错误状态: {}", status));
    }

    // 先获取原始文本查看
    let response_text = response.text().await.map_err(|e| {
        println!("❌ [ERROR] 读取响应文本失败: {}", e);
        format!("读取响应失败: {}", e)
    })?;

    // 解析JSON
    let cycle: BillingCycle = serde_json::from_str(&response_text).map_err(|e| {
        println!("❌ [ERROR] 解析JSON失败: {}", e);
        println!("❌ [ERROR] 原始响应内容: {}", response_text);
        format!("解析响应失败: {}", e)
    })?;

    println!("✅ [SUCCESS] 计费周期解析成功");
    println!("  - 开始时间（原始值）: {}", cycle.start_date_epoch_millis);
    println!("  - 结束时间（原始值）: {}", cycle.end_date_epoch_millis);
    println!("========== 计费周期获取完成 ==========\n");

    Ok(cycle)
}

/// 获取账号详细信息（包含试用期）
///
/// # 参数
/// - `session_token`: SessionToken
///
/// # 返回值
/// 返回完整的账号详细信息，包含试用期数据
pub async fn fetch_account_detail_info(session_token: &str) -> Result<AccountDetailInfo, String> {
    println!("正在获取完整账号信息...");

    // 1. 获取基本账号信息
    let account_info = fetch_account_info_with_fallback(session_token).await?;

    // 2. 获取使用情况摘要（会员类型）
    let usage = fetch_usage_summary(session_token).await?;

    // 3. 获取 Stripe 订阅信息（剩余天数）
    println!("\n========== 步骤3: 获取剩余天数 ==========");
    let stripe_subscription = match fetch_stripe_subscription(session_token).await {
        Ok(sub) => {
            println!("[SUCCESS] 获取 Stripe 订阅信息成功");
            Some(sub)
        }
        Err(e) => {
            println!("[ERROR] 获取 Stripe 订阅信息失败: {}", e);
            println!("[WARNING] 将无法获取剩余天数");
            None
        }
    };
    println!("========================================\n");

    // 4. 计算试用期/使用期
    println!("\n========== 开始计算 ==========");
    let (trial_start_ms, trial_end_ms, days_remaining, is_expired) = if let Some(sub) =
        stripe_subscription
    {
        // 获取剩余天数（None 走回退计算，避免误判为 0）
        let remaining_days = if let Some(v) = sub.days_remaining_on_trial {
            v
        } else {
            // 回退：Pro专业版等无剩余天数时，按账单周期或参考时间+7天计算
            println!("  - API 未返回剩余天数，启用回退计算");

            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64;

            let trial_length = sub.trial_length_days.unwrap_or(7) as i64;
            let day_ms = 24 * 60 * 60 * 1000;

            if let Ok(cycle_start_dt) =
                chrono::DateTime::parse_from_rfc3339(&usage.billing_cycle_start)
            {
                let cycle_start_ms = cycle_start_dt
                    .with_timezone(&chrono::Utc)
                    .timestamp_millis();
                let end_ms = cycle_start_ms + (trial_length * day_ms);
                println!("  - 使用 billingCycleStart + {} 天", trial_length);
                println!("    billingCycleStart: {}", usage.billing_cycle_start);
                println!("    计算结束时间: {} ms", end_ms);
                let diff_ms = end_ms - now_ms;
                if diff_ms <= 0 {
                    0
                } else {
                    ((diff_ms + day_ms - 1) / day_ms) as i32
                }
            }
            // 备用策略: 使用 updated_at + 7天
            else if let Some(updated_at_ms) = account_info.updated_at.as_deref().and_then(|s| {
                chrono::DateTime::parse_from_rfc3339(s)
                    .ok()
                    .map(|dt| dt.with_timezone(&chrono::Utc).timestamp_millis())
            }) {
                let end_ms = updated_at_ms + (trial_length * day_ms);
                println!("  - 使用 updated_at + {} 天: {} ms", trial_length, end_ms);
                let diff_ms = end_ms - now_ms;
                if diff_ms <= 0 {
                    0
                } else {
                    ((diff_ms + day_ms - 1) / day_ms) as i32
                }
            }
            // 兜底：无可用参考时间
            else {
                println!("  - 无可用参考时间，返回 0");
                0
            }
        };

        if sub.days_remaining_on_trial.is_some() {
            println!("  - 计算得到剩余天数(来自API): {} 天", remaining_days);
        } else {
            println!("  - 计算得到剩余天数(回退计算): {} 天", remaining_days);
        }

        // 判断是否过期
        let expired = remaining_days <= 0;
        println!("  - 是否过期: {}", expired);

        // 计算开始和结束时间戳（用于显示）
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        // 假设从现在开始计算，剩余天数为 remaining_days
        let end_ms = now_ms + (remaining_days as i64 * 24 * 60 * 60 * 1000);

        // 假设试用期长度为 trial_length_days，如果没有则默认 7 天
        let trial_length = sub.trial_length_days.unwrap_or(7) as i64;
        let start_ms = end_ms - (trial_length * 24 * 60 * 60 * 1000);

        println!("\n✅ [RESULT] 最终计算结果:");
        println!("  - trial_start_ms: {:?}", Some(start_ms));
        println!("  - trial_end_ms: {:?}", Some(end_ms));
        println!("  - days_remaining: {:?}", Some(remaining_days));
        println!("  - is_expired: {}", expired);
        println!("========== 试用期/使用期计算完成 ==========\n");

        (Some(start_ms), Some(end_ms), Some(remaining_days), expired)
    } else {
        println!("⚠️  [WARNING] Stripe 订阅信息为 None");
        println!("  - trial_start_ms: None");
        println!("  - trial_end_ms: None");
        println!("  - days_remaining: None");
        println!("  - is_expired: false");
        println!("========== 试用期/使用期计算完成（无数据） ==========\n");
        (None, None, None, false)
    };

    // 计算透支额度
    // 如果 onDemand.enabled = true，透支额度 = bonus + onDemand.used
    // 否则，透支额度 = bonus
    let mut total_overdraft = usage.individual_usage.plan.breakdown.bonus;
    if usage.individual_usage.on_demand.enabled {
        total_overdraft += usage.individual_usage.on_demand.used;
        println!(
            "✓ onDemand 已启用，总透支额度 = bonus({}) + onDemand.used({}) = {}",
            usage.individual_usage.plan.breakdown.bonus,
            usage.individual_usage.on_demand.used,
            total_overdraft
        );
    }

    Ok(AccountDetailInfo {
        user_id: account_info.user_id,
        email: account_info.email,
        name: account_info.name,
        subscription: account_info.subscription,
        status: account_info.status,
        token_preview: account_info.token_preview,
        membership_type: usage.membership_type,
        trial_start_ms,
        trial_end_ms,
        days_remaining,
        is_expired,
        usage_used: Some(usage.individual_usage.plan.used),
        usage_limit: Some(usage.individual_usage.plan.limit),
        usage_remaining: Some(usage.individual_usage.plan.remaining),
        usage_overdraft: Some(total_overdraft), // 透支额度 = bonus + onDemand.used（如果启用）
    })
}
