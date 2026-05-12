use serde::{Deserialize, Serialize};
use serde_json::json;

/// Firebase 登录响应
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirebaseLoginResponse {
    pub id_token: String,
    pub refresh_token: String,
    pub expires_in: String,
    pub local_id: String,
    pub email: String,
}

/// Token 刷新响应
#[derive(Debug, Serialize, Deserialize)]
pub struct TokenRefreshResponse {
    pub access_token: String,
    pub id_token: String,
    pub refresh_token: String,
    pub expires_in: String,
    pub user_id: Option<String>,
    pub project_id: Option<String>,
}

/// 套餐状态响应
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanStatusResponse {
    pub plan_status: serde_json::Value,
}

/// 使用 Firebase Auth 登录
#[tauri::command]
pub async fn firebase_login(email: String, password: String) -> Result<String, String> {
    println!("🔑 [firebase_login] Firebase 登录: {}", email);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    let url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY";

    let body = json!({
        "email": email,
        "password": password,
        "returnSecureToken": true
    });

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "*/*")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("登录失败 ({}): {}", status, text));
    }

    println!("✓ [firebase_login] 登录成功");
    Ok(text)
}

/// 刷新 Windsurf Token
#[tauri::command]
pub async fn refresh_windsurf_token(refresh_token: String) -> Result<String, String> {
    println!("🔄 [refresh_windsurf_token] 刷新 Token");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    let url = "https://windsurf.crispvibe.cn/";

    let body = json!({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "api_key": "AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY"
    });

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/plain, */*")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("刷新Token失败 ({}): {}", status, text));
    }

    println!("✓ [refresh_windsurf_token] Token刷新成功");
    Ok(text)
}

/// 获取套餐状态
#[tauri::command]
pub async fn get_plan_status(id_token: String) -> Result<String, String> {
    println!("📊 [get_plan_status] 获取套餐状态");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    let url = "https://web-backend.windsurf.com/exa.seat_management_pb.SeatManagementService/GetPlanStatus";

    // 请求体需要包含 auth_token
    let body = json!({
        "auth_token": id_token.clone()
    });

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/plain, */*")
        .header("X-Auth-Token", &id_token)
        .header("x-client-version", "Chrome/JsCore/11.0.0/FirebaseCore-web")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Windsurf/5.0.0 Chrome/116.0.5845.228 Electron/26.6.10 Safari/537.36")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("获取套餐状态失败 ({}): {}", status, text));
    }

    println!("✓ [get_plan_status] 获取成功");
    Ok(text)
}

/// 使用邮箱密码获取 Token（带 refresh_token 的特殊接口）
#[tauri::command]
pub async fn fetch_token_with_credentials(
    email: String,
    password: String,
    refresh_token: String,
) -> Result<String, String> {
    println!("🔑 [fetch_token_with_credentials] 获取Token: {}", email);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    let url = "https://jolly-leaf-328a.92xh6jhdym.workers.dev/";

    let body = json!({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "api_key": "AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY",
        "email": email,
        "password": password
    });

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/plain, */*")
        .header("X-Secret-Key", "CkBj8zc7cR8aX4NMuGAj")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Windsurf/5.0.0 Chrome/116.0.5845.228 Electron/26.6.10 Safari/537.36")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("获取Token失败 ({}): {}", status, text));
    }

    println!("✓ [fetch_token_with_credentials] Token获取成功");
    Ok(text)
}
