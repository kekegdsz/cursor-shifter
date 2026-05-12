// 无感换号模块 - Cursor版本检测与JS替换规则引擎
// 用于自动识别Cursor版本并应用正确的workbench.desktop.main.js替换规则

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 替换规则
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplacementRule {
    /// 规则名称
    pub name: String,
    /// 规则描述
    pub description: String,
    /// 要匹配的原始字符串（正则或精确匹配）
    pub old_pattern: String,
    /// 替换后的字符串
    pub replacement: String,
    /// 是否为正则表达式
    pub is_regex: bool,
    /// 是否必须成功
    pub required: bool,
}

/// 版本规则配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionRuleConfig {
    /// 版本范围描述（如 "0.44.x", "0.45.x", "0.46+"）
    pub version_range: String,
    /// 最小版本（包含）
    pub min_version: Option<String>,
    /// 最大版本（不包含）
    pub max_version: Option<String>,
    /// 替换规则列表
    pub rules: Vec<ReplacementRule>,
}

/// 无感换号配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeamlessSwitchConfig {
    /// 配置版本
    pub config_version: String,
    /// 客户ID（用于API调用）
    pub customer_id: String,
    /// API基础地址
    pub api_base_url: String,
    /// 是否启用
    pub enabled: bool,
    /// 版本规则映射
    pub version_rules: Vec<VersionRuleConfig>,
}

/// 检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionResult {
    /// Cursor版本
    pub cursor_version: String,
    /// workbench.desktop.main.js路径
    pub workbench_path: Option<String>,
    /// 匹配的版本规则
    pub matched_rule: Option<String>,
    /// 是否已应用补丁
    pub is_patched: bool,
    /// 补丁状态详情
    pub patch_details: Vec<PatchDetail>,
}

/// 补丁详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchDetail {
    pub rule_name: String,
    pub status: PatchStatus,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PatchStatus {
    Applied,
    NotApplied,
    Failed,
    Skipped,
}

/// 获取workbench.desktop.main.js路径
pub fn get_workbench_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let localappdata = std::env::var("LOCALAPPDATA")
            .map_err(|_| "无法获取 LOCALAPPDATA 环境变量".to_string())?;

        let path = PathBuf::from(&localappdata)
            .join("Programs")
            .join("cursor")
            .join("resources")
            .join("app")
            .join("out")
            .join("vs")
            .join("workbench")
            .join("workbench.desktop.main.js");

        if path.exists() {
            return Ok(path);
        }

        // 尝试备选路径
        let alt_path = PathBuf::from(localappdata)
            .join("Programs")
            .join("Cursor")
            .join("resources")
            .join("app")
            .join("out")
            .join("vs")
            .join("workbench")
            .join("workbench.desktop.main.js");

        if alt_path.exists() {
            return Ok(alt_path);
        }

        Err("未找到 workbench.desktop.main.js".to_string())
    }

    #[cfg(target_os = "macos")]
    {
        let path = PathBuf::from("/Applications")
            .join("Cursor.app")
            .join("Contents")
            .join("Resources")
            .join("app")
            .join("out")
            .join("vs")
            .join("workbench")
            .join("workbench.desktop.main.js");

        if path.exists() {
            Ok(path)
        } else {
            Err("未找到 workbench.desktop.main.js".to_string())
        }
    }

    #[cfg(target_os = "linux")]
    {
        let linux_paths = vec![
            "/opt/Cursor/resources/app/out/vs/workbench/workbench.desktop.main.js",
            "/usr/share/cursor/resources/app/out/vs/workbench/workbench.desktop.main.js",
        ];

        for path_str in linux_paths {
            let path = PathBuf::from(path_str);
            if path.exists() {
                return Ok(path);
            }
        }

        Err("未找到 workbench.desktop.main.js".to_string())
    }
}

/// 从workbench.desktop.main.js中提取版本特征
pub fn extract_version_signature(content: &str) -> VersionSignature {
    let mut signature = VersionSignature::default();

    // 检测常见的混淆变量名模式
    // 不同版本的 RATE_LIMITED_CHANGEABLE 对应的枚举变量名不同

    // 查找 RATE_LIMITED_CHANGEABLE 相关代码
    if content.contains("RATE_LIMITED_CHANGEABLE") {
        signature.has_rate_limited = true;
    }

    // 检测枚举变量名（Vu, Wu, Xu 等）
    let enum_patterns = [
        "Vu.RATE_LIMITED_CHANGEABLE",
        "Wu.RATE_LIMITED_CHANGEABLE",
        "Xu.RATE_LIMITED_CHANGEABLE",
        "Yu.RATE_LIMITED_CHANGEABLE",
    ];
    for pattern in &enum_patterns {
        if content.contains(pattern) {
            signature.enum_var_name = Some(pattern.split('.').next().unwrap().to_string());
            break;
        }
    }

    // 检测 database.getItems 模式
    if content.contains("this.database.getItems())") {
        signature.has_database_getitems = true;
    }

    // 检测返回值变量名（ge, he, ie 等）
    let return_patterns = [
        "return ge.warningTwo",
        "return he.warningTwo",
        "return ie.warningTwo",
        "return je.warningTwo",
    ];
    for pattern in &return_patterns {
        if content.contains(pattern) {
            signature.return_var_name = Some(
                pattern
                    .split('.')
                    .next()
                    .unwrap()
                    .replace("return ", "")
                    .to_string(),
            );
            break;
        }
    }

    signature
}

/// 版本特征签名
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VersionSignature {
    /// 是否包含 RATE_LIMITED_CHANGEABLE
    pub has_rate_limited: bool,
    /// 枚举变量名（如 Vu, Wu）
    pub enum_var_name: Option<String>,
    /// 返回值变量名（如 ge, he）
    pub return_var_name: Option<String>,
    /// 是否包含 database.getItems
    pub has_database_getitems: bool,
}

/// 根据版本签名生成动态替换规则
pub fn generate_rules_from_signature(
    signature: &VersionSignature,
    customer_id: &str,
    api_base_url: &str,
) -> Vec<ReplacementRule> {
    let mut rules = Vec::new();

    let enum_var = signature.enum_var_name.as_deref().unwrap_or("Vu");
    let return_var = signature.return_var_name.as_deref().unwrap_or("ge");

    // 规则1: 注入store和通知系统
    if signature.has_database_getitems {
        let notification_script = generate_notification_script(customer_id, api_base_url);
        rules.push(ReplacementRule {
            name: "注入通知系统和store".to_string(),
            description: "注入VSCode风格通知系统，暴露store对象到window".to_string(),
            old_pattern: "this.database.getItems()))".to_string(),
            replacement: format!("this.database.getItems())){}", notification_script),
            is_regex: false,
            required: true,
        });
    }

    // 规则2: 拦截限流错误
    if signature.has_rate_limited {
        let old_pattern = format!(
            r#"case {}.RATE_LIMITED_CHANGEABLE:case"ERROR_RATE_LIMITED_CHANGEABLE":return {}.warningTwo;"#,
            enum_var, return_var
        );

        let switch_script = generate_switch_script(customer_id, api_base_url, return_var);
        let replacement = format!(
            r#"case {}.RATE_LIMITED_CHANGEABLE:case"ERROR_RATE_LIMITED_CHANGEABLE":{}"#,
            enum_var, switch_script
        );

        rules.push(ReplacementRule {
            name: "拦截限流错误触发换号".to_string(),
            description: "检测到限流错误时自动调用后端接口换号".to_string(),
            old_pattern,
            replacement,
            is_regex: false,
            required: true,
        });
    }

    rules
}

/// 生成通知系统注入脚本
fn generate_notification_script(customer_id: &str, api_base_url: &str) -> String {
    // 判断模式：customer_id 为空表示本地模式，其余配置统一视为云端模式
    let mode = if customer_id.is_empty() {
        "local"
    } else {
        "cloud"
    };

    // 使用字符串替换避免format!宏转义问题
    let template = r#";await (async function idealHookStore(e){if(e.get('releaseNotes/lastVersion')){window.store=e;window.__idealMode='{{MODE}}';window.__idealCustomerId='{{CUSTOMER_ID}}';window.__idealApiUrl='{{API_BASE_URL}}';if(!window.$success){(function(){let c=null,i=0;function initC(){if(!c){c=document.createElement('div');c.id='vscode-notifications';c.style.cssText='position:fixed;top:20px;right:20px;z-index:999999;display:flex;flex-direction:column;gap:8px;max-width:400px';document.body.appendChild(c);if(!document.getElementById('vscode-notification-styles')){const s=document.createElement('style');s.id='vscode-notification-styles';s.textContent='@keyframes slideInRight{from{transform:translateX(450px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOutRight{from{transform:translateX(0);opacity:1}to{transform:translateX(450px);opacity:0}}@keyframes progressIndeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}';document.head.appendChild(s);}}return c}function createNotification(msg,type,opts){opts=opts||{};const container=initC();const id=++i;const n=document.createElement('div');n.dataset.id=id;const styles={success:{color:'#4ec9b0',icon:'[OK]',borderColor:'#4ec9b0'},error:{color:'#f48771',icon:'[X]',borderColor:'#f48771'},warning:{color:'#cca700',icon:'[!]',borderColor:'#cca700'},info:{color:'#3794ff',icon:'[i]',borderColor:'#3794ff'}};const st=styles[type]||styles.info;n.style.cssText=`background:#252526;border-left:3px solid ${st.borderColor};padding:12px 16px;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:flex-start;gap:12px;animation:slideInRight .3s ease-out;min-width:350px`;const iconEl=document.createElement('div');iconEl.style.cssText=`width:20px;height:20px;border-radius:50%;background:${st.color};color:#252526;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;flex-shrink:0;margin-top:2px`;iconEl.textContent=st.icon;const content=document.createElement('div');content.style.cssText='flex:1;display:flex;flex-direction:column;gap:8px';const messageEl=document.createElement('div');messageEl.style.cssText='color:#cccccc;font-size:13px;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';messageEl.textContent=msg;content.appendChild(messageEl);if(opts.loading){const progressBar=document.createElement('div');progressBar.style.cssText='width:100%;height:2px;background:rgba(255,255,255,.1);border-radius:1px;overflow:hidden;margin-top:4px';const progressFill=document.createElement('div');progressFill.style.cssText=`height:100%;background:${st.color};width:100%;animation:progressIndeterminate 1.5s ease-in-out infinite`;progressBar.appendChild(progressFill);content.appendChild(progressBar)}const closeBtn=document.createElement('button');closeBtn.textContent='X';closeBtn.style.cssText='background:transparent;border:none;color:#ccc;font-size:16px;cursor:pointer;padding:4px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px';closeBtn.onclick=()=>removeNotification(id);n.appendChild(iconEl);n.appendChild(content);n.appendChild(closeBtn);container.appendChild(n);if(!opts.loading){setTimeout(()=>removeNotification(id),opts.duration||5000)}return id}function removeNotification(id){if(!c)return;const n=c.querySelector(`[data-id="${id}"]`);if(n){n.style.animation='slideOutRight .3s ease-in';setTimeout(()=>{if(n.parentNode){n.parentNode.removeChild(n)}if(c.children.length===0&&c.parentNode){c.parentNode.removeChild(c);c=null}},300)}}window.$success=(msg,opts)=>createNotification(msg,'success',opts);window.$error=(msg,opts)=>createNotification(msg,'error',opts);window.$warning=(msg,opts)=>createNotification(msg,'warning',opts);window.$info=(msg,opts)=>createNotification(msg,'info',opts);window.$loading=(msg)=>createNotification(msg,'info',{loading:true});window.$hideLoading=(id)=>removeNotification(id);})();console.log('[Seamless] 无感换号已启用，模式:',window.__idealMode);}}})(this)"#;

    template
        .replace("{{MODE}}", mode)
        .replace("{{CUSTOMER_ID}}", customer_id)
        .replace("{{API_BASE_URL}}", api_base_url)
}

/// 生成换号脚本（支持本地模式和激活码模式）
fn generate_switch_script(customer_id: &str, _api_base_url: &str, return_var: &str) -> String {
    // 判断模式
    if customer_id.is_empty() {
        // 本地模式：通过Tauri invoke调用本地换号命令（从账号列表获取）
        let template = r#"(async()=>{if(!window.__idealLastSwitchTime)window.__idealLastSwitchTime=0;const now=Date.now();if(now-window.__idealLastSwitchTime<5000){console.log('[Seamless] 防抖中，跳过重复触发');return;}window.__idealLastSwitchTime=now;if(!window.store){console.warn('[Seamless] store未初始化');if(window.$warning)window.$warning('无感换号未初始化');return;}let loadingId;try{console.log('[Seamless] 检测到限流，开始本地自动换号...');if(window.$loading)loadingId=window.$loading('检测到限流，正在从本地账号池切换...');const{invoke}=window.__TAURI__.core;const result=await invoke('seamless_switch_from_local');if(window.$hideLoading&&loadingId)window.$hideLoading(loadingId);if(result&&result.success){const newToken=result.access_token;if(newToken){window.store.set('cursorAuth/accessToken',newToken);if(result.machine_ids){window.store.set('telemetry.devDeviceId',result.machine_ids.devDeviceId||'');window.store.set('telemetry.machineId',result.machine_ids.machineId||'');window.store.set('telemetry.macMachineId',result.machine_ids.macMachineId||'');window.store.set('telemetry.sqmId',result.machine_ids.sqmId||'');}console.log('[Seamless] 本地换号成功');if(window.$success)window.$success(`账号已切换: ${result.email||'新账号'}`);}}else{console.error('[Seamless] 本地换号失败:',result?.error||'未知错误');if(window.$error)window.$error(`换号失败: ${result?.error||'本地账号池为空'}`);}return {{RETURN_VAR}}.warningTwo;}catch(err){if(window.$hideLoading&&loadingId)window.$hideLoading(loadingId);console.error('[Seamless] 本地换号异常:',err);if(window.$error)window.$error('换号失败，请检查本地账号池');return {{RETURN_VAR}}.warningTwo;}})();return {{RETURN_VAR}}.warningTwo;"#;

        template.replace("{{RETURN_VAR}}", return_var)
    } else {
        // 其他模式统一提示配置错误，避免继续走已移除的激活码链路
        let template = r#"(async()=>{console.warn('[Seamless] 无感换号模式不可用');if(window.$warning)window.$warning('当前开源版仅支持本地账号池模式');return {{RETURN_VAR}}.warningTwo;})();return {{RETURN_VAR}}.warningTwo;"#;

        template.replace("{{RETURN_VAR}}", return_var)
    }
}

/// 检测当前Cursor状态
pub fn detect_cursor_state() -> Result<DetectionResult, String> {
    // 获取版本信息
    let version_info = crate::cursor_version::detect_cursor_version().unwrap_or_else(|_| {
        crate::cursor_version::CursorVersionInfo {
            version: "unknown".to_string(),
            major: 0,
            minor: 0,
            patch: 0,
            is_045_plus: false,
        }
    });

    // 获取workbench路径
    let workbench_path = get_workbench_path().ok();

    let mut result = DetectionResult {
        cursor_version: version_info.version.clone(),
        workbench_path: workbench_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
        matched_rule: None,
        is_patched: false,
        patch_details: Vec::new(),
    };

    // 读取workbench内容检测补丁状态
    if let Some(ref path) = workbench_path {
        if let Ok(content) = fs::read_to_string(path) {
            // 检测是否已应用补丁
            if content.contains("window.__idealCustomerId")
                || content.contains("window.__idealApiUrl")
            {
                result.is_patched = true;
                result.patch_details.push(PatchDetail {
                    rule_name: "无感换号注入".to_string(),
                    status: PatchStatus::Applied,
                    message: "已检测到无感换号补丁".to_string(),
                });
            }

            // 提取版本签名
            let signature = extract_version_signature(&content);
            if let Some(ref enum_var) = signature.enum_var_name {
                result.matched_rule = Some(format!("动态检测: 枚举变量={}", enum_var));
            }
        }
    }

    Ok(result)
}

/// 应用无感换号补丁
pub fn apply_seamless_patch(
    customer_id: &str,
    api_base_url: &str,
) -> Result<Vec<PatchDetail>, String> {
    let workbench_path = get_workbench_path()?;

    // 读取原始内容
    let content = fs::read_to_string(&workbench_path)
        .map_err(|e| format!("读取 workbench.desktop.main.js 失败: {}", e))?;

    // 检测是否已应用补丁
    if content.contains("window.__idealCustomerId") {
        return Err("补丁已应用，无需重复操作".to_string());
    }

    // 提取版本签名
    let signature = extract_version_signature(&content);

    if !signature.has_rate_limited || !signature.has_database_getitems {
        return Err("无法识别Cursor版本特征，请确认Cursor版本是否支持".to_string());
    }

    // 生成规则
    let rules = generate_rules_from_signature(&signature, customer_id, api_base_url);

    // 创建备份
    let backup_path = workbench_path.with_extension("js.backup");
    fs::copy(&workbench_path, &backup_path).map_err(|e| format!("创建备份失败: {}", e))?;

    // 应用规则
    let mut patched_content = content.clone();
    let mut details = Vec::new();

    for rule in &rules {
        if patched_content.contains(&rule.old_pattern) {
            patched_content = patched_content.replace(&rule.old_pattern, &rule.replacement);
            details.push(PatchDetail {
                rule_name: rule.name.clone(),
                status: PatchStatus::Applied,
                message: format!("规则 '{}' 应用成功", rule.name),
            });
        } else if rule.required {
            // 回滚备份
            fs::copy(&backup_path, &workbench_path).ok();
            return Err(format!("必需规则 '{}' 无法匹配，已回滚", rule.name));
        } else {
            details.push(PatchDetail {
                rule_name: rule.name.clone(),
                status: PatchStatus::Skipped,
                message: format!("规则 '{}' 未匹配，已跳过", rule.name),
            });
        }
    }

    // 写入修改后的内容
    fs::write(&workbench_path, patched_content).map_err(|e| format!("写入补丁失败: {}", e))?;

    println!("[Seamless] 补丁应用完成，共处理 {} 条规则", details.len());

    Ok(details)
}

/// 移除无感换号补丁（恢复备份）
pub fn remove_seamless_patch() -> Result<String, String> {
    let workbench_path = get_workbench_path()?;
    let backup_path = workbench_path.with_extension("js.backup");

    if !backup_path.exists() {
        return Err("未找到备份文件，无法恢复".to_string());
    }

    fs::copy(&backup_path, &workbench_path).map_err(|e| format!("恢复备份失败: {}", e))?;

    Ok("补丁已移除，已恢复原始文件".to_string())
}

/// 获取默认配置文件路径
fn get_config_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 环境变量".to_string())?;
        let mut path = PathBuf::from(appdata);
        path.push("Cursor-Shifter");

        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
        }

        path.push("seamless_switch_config.json");
        Ok(path)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let mut path = PathBuf::from(home);

        #[cfg(target_os = "macos")]
        path.push("Library/Application Support/Cursor-Shifter");

        #[cfg(target_os = "linux")]
        path.push(".config/cursor-shifter");

        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
        }

        path.push("seamless_switch_config.json");
        Ok(path)
    }
}

/// 保存配置
pub fn save_config(config: &SeamlessSwitchConfig) -> Result<(), String> {
    let config_path = get_config_path()?;
    let json =
        serde_json::to_string_pretty(config).map_err(|e| format!("序列化配置失败: {}", e))?;

    fs::write(&config_path, json).map_err(|e| format!("写入配置失败: {}", e))?;

    Ok(())
}

/// 加载配置
pub fn load_config() -> Result<SeamlessSwitchConfig, String> {
    let config_path = get_config_path()?;

    if !config_path.exists() {
        // 返回默认配置
        return Ok(SeamlessSwitchConfig {
            config_version: "1.0.0".to_string(),
            customer_id: String::new(),
            api_base_url: "http://localhost:8080".to_string(),
            enabled: false,
            version_rules: Vec::new(),
        });
    }

    let content = fs::read_to_string(&config_path).map_err(|e| format!("读取配置失败: {}", e))?;

    serde_json::from_str(&content).map_err(|e| format!("解析配置失败: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_signature_extraction() {
        let content = r#"case Vu.RATE_LIMITED_CHANGEABLE:case"ERROR_RATE_LIMITED_CHANGEABLE":return ge.warningTwo;this.database.getItems())"#;
        let signature = extract_version_signature(content);

        assert!(signature.has_rate_limited);
        assert_eq!(signature.enum_var_name, Some("Vu".to_string()));
        assert_eq!(signature.return_var_name, Some("ge".to_string()));
        assert!(signature.has_database_getitems);
    }

    #[test]
    fn test_generate_rules() {
        let signature = VersionSignature {
            has_rate_limited: true,
            enum_var_name: Some("Vu".to_string()),
            return_var_name: Some("ge".to_string()),
            has_database_getitems: true,
        };

        let rules =
            generate_rules_from_signature(&signature, "test_customer", "http://localhost:8080");
        assert_eq!(rules.len(), 2);
    }
}
