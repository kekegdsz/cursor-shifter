// ==================== Windsurf 相关函数 ====================

// 导入 Tauri API
const { invoke } = window.__TAURI__.core;

// 对话框 resolve 函数
let dialogResolve = null;

/**
 * 显示提示对话框
 * @param {string} title - 标题
 * @param {string} message - 消息内容
 * @param {string} type - 类型：success, error, info
 * @returns {Promise<boolean>}
 */
function showAlert(title, message, type = "info") {
	return new Promise((resolve) => {
		dialogResolve = resolve;

		const dialogOverlay = document.querySelector("#custom-dialog");
		const dialogTitle = document.querySelector("#dialog-title");
		const dialogMessage = document.querySelector("#dialog-message");
		const dialogIcon = document.querySelector("#dialog-icon");
		const dialogFooter = document.querySelector("#dialog-footer");
		const dialogCancel = document.querySelector("#dialog-cancel");
		const dialogConfirm = document.querySelector("#dialog-confirm");

		// 设置内容
		dialogTitle.textContent = title;
		dialogMessage.textContent = message;

		// 根据类型设置图标
		let iconSvg = "";
		let iconClass = "dialog-icon";

		switch (type) {
			case "success":
				iconSvg = `
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
				`;
				iconClass += " dialog-icon-success";
				break;
			case "error":
				iconSvg = `
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<line x1="15" y1="9" x2="9" y2="15" />
						<line x1="9" y1="9" x2="15" y2="15" />
					</svg>
				`;
				iconClass += " dialog-icon-error";
				break;
			default: // info
				iconSvg = `
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="16" x2="12" y2="12" />
						<line x1="12" y1="8" x2="12.01" y2="8" />
					</svg>
				`;
				iconClass += " dialog-icon-info";
				break;
		}

		dialogIcon.innerHTML = iconSvg;
		dialogIcon.className = iconClass;

		// 只显示确定按钮
		dialogFooter.style.display = "flex";
		dialogCancel.style.display = "none";
		dialogConfirm.style.display = "block";

		// 显示弹窗
		dialogOverlay.classList.add("show");
	});
}

/**
 * 关闭对话框
 * @param {boolean} result - 对话框结果
 */
function closeDialog(result) {
	const dialogOverlay = document.querySelector("#custom-dialog");
	const dialogInput = document.querySelector("#dialog-input");
	const dialogForm = document.querySelector("#dialog-form");
	const dialogMessage = document.querySelector("#dialog-message");

	// 如果是表单弹窗
	if (dialogForm && dialogForm.style.display !== "none") {
		closeFormDialog(null); // 取消时返回 null
		return;
	}

	// 如果是输入框弹窗
	if (dialogInput && dialogInput.style.display !== "none") {
		const inputValue = result ? dialogInput.value : null;
		closeDialogWithInput(inputValue);
		return;
	}

	dialogOverlay.classList.remove("show");
	dialogMessage.style.display = "block";

	if (dialogResolve) {
		dialogResolve(result);
		dialogResolve = null;
	}
}

/**
 * 显示确认对话框
 * @param {string} title - 标题
 * @param {string} message - 消息内容
 * @param {string} type - 类型：success, error, info, warning
 * @returns {Promise<boolean>} 用户是否确认
 */
function showConfirm(title, message, type = "warning") {
	return new Promise((resolve) => {
		dialogResolve = resolve;

		const dialogOverlay = document.querySelector("#custom-dialog");
		const dialogTitle = document.querySelector("#dialog-title");
		const dialogMessage = document.querySelector("#dialog-message");
		const dialogIcon = document.querySelector("#dialog-icon");
		const dialogFooter = document.querySelector("#dialog-footer");
		const dialogCancel = document.querySelector("#dialog-cancel");
		const dialogConfirm = document.querySelector("#dialog-confirm");

		// 设置内容
		dialogTitle.textContent = title;
		dialogMessage.textContent = message;

		// 根据类型设置图标
		let iconSvg = "";
		let iconClass = "dialog-icon";

		switch (type) {
			case "warning":
				iconSvg = `
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
						<line x1="12" y1="9" x2="12" y2="13" />
						<line x1="12" y1="17" x2="12.01" y2="17" />
					</svg>
				`;
				iconClass += " dialog-icon-warning";
				break;
			case "success":
				iconSvg = `
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
				`;
				iconClass += " dialog-icon-success";
				break;
			case "error":
				iconSvg = `
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<line x1="15" y1="9" x2="9" y2="15" />
						<line x1="9" y1="9" x2="15" y2="15" />
					</svg>
				`;
				iconClass += " dialog-icon-error";
				break;
			default: // info
				iconSvg = `
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="16" x2="12" y2="12" />
						<line x1="12" y1="8" x2="12.01" y2="8" />
					</svg>
				`;
				iconClass += " dialog-icon-info";
				break;
		}

		dialogIcon.innerHTML = iconSvg;
		dialogIcon.className = iconClass;

		// 显示取消和确定按钮
		dialogFooter.style.display = "flex";
		dialogCancel.style.display = "block";
		dialogConfirm.style.display = "block";

		// 显示弹窗
		dialogOverlay.classList.add("show");
	});
}

/**
 * 邮箱隐私保护（打码）- 已禁用，直接返回原始邮箱
 * @param {string} email - 原始邮箱
 * @returns {string} 原始邮箱
 */
function maskEmail(email) {
	// 直接返回完整邮箱，不进行打码
	return email;
}

/**
 * 更新账号信息显示
 * @param {Object} accountInfo - 账号信息对象
 */
function updateAccountDisplay(accountInfo) {
	// 更新用户姓名
	const nameElement = document.querySelector("#account-name");
	if (nameElement) {
		nameElement.textContent = accountInfo.name || "Unknown User";
	}

	// 更新邮箱（应用隐私保护）
	const emailElement = document.querySelector("#account-email");
	if (emailElement) {
		emailElement.textContent = maskEmail(accountInfo.email);
		emailElement.setAttribute("data-original-email", accountInfo.email);
	}

	// 更新套餐信息
	const subscriptionBadge = document.querySelector(".badge-pro");
	if (subscriptionBadge) {
		let displaySub = accountInfo.subscription;
		if (displaySub === "Trial") {
			displaySub = "试用版";
		}
		subscriptionBadge.textContent = displaySub;

		// 根据套餐类型更新样式
		subscriptionBadge.className = "badge-pro";
		if (displaySub.toLowerCase().includes("trial") || displaySub.toLowerCase().includes("试用")) {
			subscriptionBadge.classList.add("trial-plan");
		} else if (displaySub.toLowerCase().includes("ultra")) {
			subscriptionBadge.classList.add("ultra-plan");
		} else if (displaySub.toLowerCase().includes("pro_plus")) {
			subscriptionBadge.classList.add("pro_plus-plan");
		} else if (displaySub.toLowerCase().includes("pro")) {
			subscriptionBadge.classList.add("pro-plan");
		} else {
			subscriptionBadge.classList.add("free");
		}
	}

	// 更新状态
	const statusElement = document.querySelector(".status-verified, .status-expired");
	if (statusElement) {
		if (accountInfo.status === "Token已失效") {
			statusElement.textContent = "✗ Token已失效";
			statusElement.classList.remove("status-verified");
			statusElement.classList.add("status-expired");
		} else {
			statusElement.textContent = `✓ ${accountInfo.status}`;
			statusElement.classList.remove("status-expired");
			statusElement.classList.add("status-verified");
		}
	}

	// 更新 Token 预览
	const tokenElement = document.querySelector("#token-preview");
	if (tokenElement && accountInfo.token_preview) {
		tokenElement.textContent = accountInfo.token_preview;
	}
}

/**
 * 获取 Windsurf 当前账号信息
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Promise<Object>} 当前账号信息
 */
async function getWindsurfCurrentAccount(forceRefresh = false) {
	console.log("🔄 开始从 Windsurf 数据库读取当前账号...");

	try {
		// 调用后端命令读取 Windsurf 数据库
		const account = await invoke("get_current_windsurf_account_cmd");

		console.log("✓ 成功读取 Windsurf 账号:", account.email);

		// 返回账号信息对象
		return {
			email: account.email,
			id_token: account.id_token,
			access_token: account.access_token,
			refresh_token: account.refresh_token,
			user_id: account.user_id || "unknown",
		};
	} catch (error) {
		console.error("❌ 读取 Windsurf 账号失败:", error);
		throw error;
	}
}

/**
 * 加载 Windsurf 使用情况数据（从用户设置读取）
 */
async function loadWindsurfUsageData() {
	console.log(`\n=== 🔄 [loadWindsurfUsageData] 开始 ===`);
	const startTime = performance.now();

	try {
		// 1. 获取用户设置的当前账号 ID
		console.log("  📍 Step 1: 获取用户设置的当前账号 ID...");
		const currentAccountId = await invoke("get_current_windsurf_account_setting_cmd");

		if (!currentAccountId) {
			// 用户未设置账号，显示提示
			console.log("  ⚠️ 用户未设置当前账号");
			throw new Error("未设置账号");
		}

		console.log("  ✓ Step 2: 当前账号 ID:", currentAccountId);

		// 2. 从账号列表中获取该账号的信息
		console.log("  📍 Step 3: 从账号列表中查找账号...");
		const storage = await invoke("get_accounts");
		const accounts = storage.accounts || [];

		// 转换为 Windsurf 格式
		const windsurfAccounts = accounts.map(convertAccountDataToWindsurf);

		// 查找对应账号
		const account = windsurfAccounts.find(acc => {
			const accId = acc.id || acc.email;
			return accId === currentAccountId;
		});

		if (!account) {
			console.error("  ❌ 未找到账号，可能已被删除");
			throw new Error("账号不存在");
		}

		console.log("  ✓ Step 4: 找到账号:", account.email);

		// 3. 获取 AccessToken（convertAccountDataToWindsurf 返回的字段名是 apiKey）
		let accessToken = account.apiKey || account.access_token || account.accessToken;
		const refreshToken = account.refreshToken || account.refresh_token;

		if (!accessToken && !refreshToken) {
			console.error("  ❌ 账号没有 AccessToken 和 RefreshToken");
			console.error("  账号数据:", account);
			throw new Error("账号缺少 Token");
		}

		// 4. 如果有 refreshToken 或邮箱密码，先尝试刷新 Token（防止过期）
		const email = account.email;
		const password = account.password;

		if (refreshToken || (email && password)) {
			try {
				console.log("  📍 Step 5: 使用智能刷新方法获取新 Token...");
				const tokenData = await fetchWindsurfTokenByCredentials(
					email,
					password || "",
					refreshToken || ""
				);
				accessToken = tokenData.access_token || tokenData.id_token;
				console.log("  ✓ Token 刷新成功");

				// 更新账号的 Token 信息到存储
				try {
					const storage = await invoke("get_accounts");
					const accountToUpdate = storage.accounts.find(acc => {
						return (acc.auth_id || acc.email) === currentAccountId;
					});

					if (accountToUpdate) {
						// 更新 note 中的额外数据
						let noteData = {};
						try {
							noteData = JSON.parse(accountToUpdate.note || "{}");
						} catch (e) {
							noteData = { name: accountToUpdate.note || "" };
						}

						await invoke("add_account", {
							authId: tokenData.user_id || accountToUpdate.auth_id || currentAccountId,
							email: accountToUpdate.email,
							accessToken: tokenData.access_token,
							refreshToken: tokenData.refresh_token,
							plan: accountToUpdate.plan,
							note: JSON.stringify(noteData)
						});
						console.log("  ✓ 新 Token 已保存");
					}
				} catch (saveError) {
					console.warn("  ⚠️ 保存新 Token 失败:", saveError);
				}
			} catch (refreshError) {
				console.warn("  ⚠️ Token 刷新失败，尝试使用原有 access_token:", refreshError.message);
				if (!accessToken) {
					throw new Error("Token 已过期且刷新失败");
				}
			}
		}

		if (!accessToken) {
			console.error("  ❌ 无法获取有效的 AccessToken");
			throw new Error("账号缺少有效 Token");
		}

		// 5. 使用 AccessToken 获取详细信息（传递 refreshToken 和 accountId 以支持401自动重试）
		console.log("  📍 Step 6: 调用 loadWindsurfAccountInfo 获取详细信息...");
		await loadWindsurfAccountInfo(accessToken, refreshToken, currentAccountId);
		console.log("  ✓ Step 7: 账号信息加载完成");

		const elapsed = performance.now() - startTime;
		console.log(`✓ [loadWindsurfUsageData] 成功完成 (耗时: ${elapsed.toFixed(2)}ms)\n`);

	} catch (error) {
		console.error(`❌ [loadWindsurfUsageData] 失败: ${error.message}`);

		// 判断错误类型
		if (error.message.includes("未设置账号")) {
			// 用户未设置账号，显示提示并弹窗
			updateAccountDisplay({
				user_id: "unknown",
				email: "请设置当前使用账号",
				name: "未设置账号",
				subscription: "-",
				status: "-",
			});

			// 弹窗提示用户设置账号
			const result = await showConfirm(
				"未设置当前账号",
				"您还未设置当前使用的 Windsurf 账号。\n\n请先到「账号管理」页面添加账号，并设置为当前账号。",
				"跳转到账号管理",
				"稍后再说"
			);

			if (result) {
				// 跳转到账号管理页面
				const accountsLink = document.querySelector('.nav-item[data-page="accounts"]');
				if (accountsLink) {
					accountsLink.click();
				}
			}
		} else if (error.message.includes("账号不存在")) {
			// 设置的账号已被删除
			updateAccountDisplay({
				user_id: "unknown",
				email: "账号已被删除",
				name: "账号不存在",
				subscription: "-",
				status: "-",
			});

			// 清除设置并提示
			await invoke("set_current_windsurf_account_cmd", { accountId: null });

			const result = await showConfirm(
				"账号已被删除",
				"您设置的当前账号已被删除。\n\n请重新到「账号管理」页面设置新的当前账号。",
				"跳转到账号管理",
				"稍后再说"
			);

			if (result) {
				const accountsLink = document.querySelector('.nav-item[data-page="accounts"]');
				if (accountsLink) {
					accountsLink.click();
				}
			}
		} else if (error.message.includes("Token 已过期且刷新失败") || error.message.includes("账号缺少有效 Token")) {
			// Token 过期且刷新失败
			updateAccountDisplay({
				user_id: "unknown",
				email: "Token 已过期",
				name: "Token 无效",
				subscription: "-",
				status: "-",
			});

			const result = await showConfirm(
				"Token 已过期",
				"当前账号的 Token 已过期且无法刷新。\n\n请到「账号管理」页面刷新或重新添加账号。",
				"跳转到账号管理",
				"稍后再说"
			);

			if (result) {
				const accountsLink = document.querySelector('.nav-item[data-page="accounts"]');
				if (accountsLink) {
					accountsLink.click();
				}
			}
		} else if (error.message.includes("账号缺少 Token")) {
			// 账号没有 Token
			updateAccountDisplay({
				user_id: "unknown",
				email: "账号缺少 Token",
				name: "Token 无效",
				subscription: "-",
				status: "-",
			});

			await showAlert("错误", "当前账号缺少 AccessToken，请重新添加账号。", "error");
		} else {
			// 其他错误
			updateAccountDisplay({
				user_id: "unknown",
				email: "加载失败",
				name: "错误",
				subscription: "-",
				status: "-",
			});
		}

		// 隐藏用量统计
		const usageStatsDiv = document.querySelector("#usage-statistics");
		if (usageStatsDiv) {
			usageStatsDiv.style.display = "none";
		}

		const elapsed = performance.now() - startTime;
		console.log(`⚠️ [loadWindsurfUsageData] 失败处理完成 (耗时: ${elapsed.toFixed(2)}ms)\n`);
	}
}

// /**
//  * 加载 Windsurf 真实账号信息
//  * @param {string} accessToken - Windsurf access token (id_token from Firebase)
//  * @param {boolean} forceRefresh - 是否强制刷新
//  */
// async function loadWindsurfAccountInfo(accessToken, forceRefresh = false) {
// 	console.log("🔄 [loadWindsurfAccountInfo] 开始...");
// 	const startTime = performance.now();

// 	try {
// 		console.log("  📍 Step 1: 调用 getWindsurfPlanStatus 获取套餐信息...");

// 		// 调用官方接口获取套餐和用量信息
// 		const planData = await getWindsurfPlanStatus(accessToken);

// 		if (!planData || !planData.planStatus) {
// 			throw new Error("未能获取有效的套餐信息");
// 		}

// 		const planStatus = planData.planStatus;
// 		const planInfo = planStatus.planInfo || {};

// 		console.log("  ✓ Step 2: 套餐信息获取成功");
// 		console.log("  📊 套餐类型:", planInfo.planName);
// 		console.log("  📊 可用积分:", {
// 			prompt: planStatus.availablePromptCredits,
// 			flow: planStatus.availableFlowCredits,
// 			flex: planStatus.availableFlexCredits
// 		});

// 		// 解析 Token 获取邮箱信息
// 		let email = "Unknown Email";
// 		try {
// 			const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
// 			email = tokenPayload.email || "Unknown Email";
// 			console.log("  📧 邮箱:", email);
// 		} catch (e) {
// 			console.warn("  ⚠️ 无法解析 Token 获取邮箱:", e);
// 		}

// 		// 计算套餐使用情况（积分值需要除以100，因为API返回的是"分"）
// 		const totalCredits = Math.round((planInfo.monthlyPromptCredits || 0) / 100);
// 		const usedCredits = Math.round((totalCredits * 100 - (planStatus.availablePromptCredits || 0)) / 100);
// 		const usagePercent = totalCredits > 0 ? (usedCredits / totalCredits * 100).toFixed(1) : 0;

// 		// 格式化日期
// 		const planEnd = planStatus.planEnd ? new Date(planStatus.planEnd).toLocaleDateString('zh-CN') : '未知';

// 		console.log("  📍 Step 3: 更新界面显示...");

// 		// 更新账号信息显示
// 		updateAccountDisplay({
// 			email: email,
// 			name: planInfo.planName || "Pro",
// 			subscription: planInfo.planName || "Pro",
// 			status: "已认证",
// 		});

// 		// 更新用量统计显示
// 		const usageStatsDiv = document.querySelector("#usage-statistics");
// 		const usageLabel = document.querySelector("#usage-label");
// 		const usageProgressFill = document.querySelector("#usage-progress-fill");

// 		if (usageStatsDiv && usageLabel && usageProgressFill) {
// 			usageStatsDiv.style.display = "block";
// 			usageLabel.textContent = `Prompt 积分：${usedCredits.toLocaleString()} / ${totalCredits.toLocaleString()} (${usagePercent}%)`;
// 			usageProgressFill.style.width = `${usagePercent}%`;

// 			// 根据使用率设置颜色
// 			if (usagePercent >= 90) {
// 				usageProgressFill.style.backgroundColor = "#ef4444"; // 红色
// 			} else if (usagePercent >= 70) {
// 				usageProgressFill.style.backgroundColor = "#f59e0b"; // 橙色
// 			} else {
// 				usageProgressFill.style.backgroundColor = "#10b981"; // 绿色
// 			}
// 		}

// 		// 更新试用期状态（如果有结束日期）
// 		const statusBadge = document.querySelector(".status-badge");
// 		const statusLabel = document.querySelector(".status-label");
// 		const progressLabel = document.querySelector(".progress-label");

// 		if (planStatus.planEnd && statusBadge && statusLabel) {
// 			const daysLeft = Math.ceil((new Date(planStatus.planEnd) - new Date()) / (1000 * 60 * 60 * 24));
// 			if (daysLeft > 0) {
// 				// 显示剩余天数
// 				statusBadge.textContent = `${daysLeft}天`;
// 				statusBadge.className = "status-badge active";

// 				// 显示套餐类型（Pro专业版）
// 				const planTypeName = planInfo.planName || "Pro";
// 				statusLabel.textContent = `${planTypeName}专业版`;

// 				// 更新进度条标签，显示试用期和剩余天数
// 				if (progressLabel) {
// 					progressLabel.textContent = `试用期 (${daysLeft}天)`;
// 				}
// 			}
// 		}

// 		const elapsed = performance.now() - startTime;
// 		console.log(`✓ [loadWindsurfAccountInfo] 成功完成 (耗时: ${elapsed.toFixed(2)}ms)`);

// 	} catch (error) {
// 		console.error("❌ [loadWindsurfAccountInfo] 失败:", error);
// 		throw error;
// 	}
// }
/**
 * 加载 Windsurf 真实账号信息（支持401自动重试）
 * @param {string} accessToken - Windsurf access token (id_token from Firebase)
 * @param {string} refreshToken - Windsurf refresh token (用于401自动重试)
 * @param {string} accountId - 账号ID (用于保存新Token)
 * @param {boolean} forceRefresh - 是否强制刷新
 */
async function loadWindsurfAccountInfo(accessToken, refreshToken = null, accountId = null, forceRefresh = false) {
	console.log("🔄 [loadWindsurfAccountInfo] 开始...");
	const startTime = performance.now();

	let currentAccessToken = accessToken;
	let hasRetried = false;

	while (true) {
		try {
			console.log("  📍 Step 1: 调用 getWindsurfPlanStatus 获取套餐信息...");

			// 调用官方接口获取套餐和用量信息
			const planData = await getWindsurfPlanStatus(currentAccessToken);

			if (!planData || !planData.planStatus) {
				throw new Error("未能获取有效的套餐信息");
			}

			const planStatus = planData.planStatus;
			const planInfo = planStatus.planInfo || {};

			console.log("  ✓ Step 2: 套餐信息获取成功");
			console.log("  📊 套餐类型:", planInfo.planName);
			console.log("  📊 可用积分:", {
				prompt: planStatus.availablePromptCredits,
				flow: planStatus.availableFlowCredits,
				flex: planStatus.availableFlexCredits
			});

			// 解析 Token 获取邮箱信息
			let email = "Unknown Email";
			try {
				const tokenPayload = JSON.parse(atob(currentAccessToken.split('.')[1]));
				email = tokenPayload.email || "Unknown Email";
				console.log("  📧 邮箱:", email);
			} catch (e) {
				console.warn("  ⚠️ 无法解析 Token 获取邮箱:", e);
			}

			// 计算套餐使用情况（积分值需要除以100，因为API返回的是"分"）
			// 总积分 = availablePromptCredits + availableFlexCredits（如果存在）
			const availablePrompt = planStatus.availablePromptCredits || 0;
			const availableFlex = planStatus.availableFlexCredits || 0;
			const totalCredits = Math.round((availablePrompt + availableFlex) / 100);

			// 已使用积分直接从 usedPromptCredits 获取
			const usedCredits = Math.round((planStatus.usedPromptCredits || 0) / 100);

			const usagePercent = totalCredits > 0 ? (usedCredits / totalCredits * 100).toFixed(1) : 0;

			console.log("  📊 积分统计:", {
				availablePrompt: `${availablePrompt} (${Math.round(availablePrompt / 100)})`,
				availableFlex: availableFlex ? `${availableFlex} (${Math.round(availableFlex / 100)})` : "不存在",
				totalCredits: totalCredits,
				usedCredits: usedCredits,
				usagePercent: usagePercent + "%"
			});

			// 格式化日期
			const planEnd = planStatus.planEnd ? new Date(planStatus.planEnd).toLocaleDateString('zh-CN') : '未知';

			console.log("  📍 Step 3: 更新界面显示...");

			// 更新账号信息显示
			updateAccountDisplay({
				email: email,
				name: planInfo.planName || "Pro",
				subscription: planInfo.planName || "Pro",
				status: "已认证",
			});

			// 更新用量统计显示
			const usageStatsDiv = document.querySelector("#usage-statistics");
			const usageLabel = document.querySelector("#usage-label");
			const usageProgressFill = document.querySelector("#usage-progress-fill");

			if (usageStatsDiv && usageLabel && usageProgressFill) {
				usageStatsDiv.style.display = "block";
				usageLabel.textContent = `Prompt 积分：${usedCredits.toLocaleString()} / ${totalCredits.toLocaleString()} (${usagePercent}%)`;
				usageProgressFill.style.width = `${usagePercent}%`;

				// 根据使用率设置颜色
				if (usagePercent >= 90) {
					usageProgressFill.style.backgroundColor = "#ef4444"; // 红色
				} else if (usagePercent >= 70) {
					usageProgressFill.style.backgroundColor = "#f59e0b"; // 橙色
				} else {
					usageProgressFill.style.backgroundColor = "#10b981"; // 绿色
				}
			}

			// 更新试用期状态（如果有结束日期）
			const statusBadge = document.querySelector(".status-badge");
			const statusLabel = document.querySelector(".status-label");
			const progressLabel = document.querySelector(".progress-label");

			if (planStatus.planEnd && statusBadge && statusLabel) {
				const daysLeft = Math.ceil((new Date(planStatus.planEnd) - new Date()) / (1000 * 60 * 60 * 24));
				if (daysLeft > 0) {
					// 显示剩余天数
					statusBadge.textContent = `${daysLeft}天`;
					statusBadge.className = "status-badge active";

					// 显示套餐类型（Pro专业版）
					const planTypeName = planInfo.planName || "Pro";
					statusLabel.textContent = `${planTypeName}专业版`;

					// 更新进度条标签，显示试用期和剩余天数
					if (progressLabel) {
						progressLabel.textContent = `试用期 (${daysLeft}天)`;
					}
				}
			}

			const elapsed = performance.now() - startTime;
			console.log(`✓ [loadWindsurfAccountInfo] 成功完成 (耗时: ${elapsed.toFixed(2)}ms)`);
			return; // 成功，退出循环

		} catch (error) {
			// 检查是否为401错误
			const is401Error = error.message && (
				error.message.includes("401") ||
				error.message.includes("Unauthorized") ||
				error.message.includes("unauthenticated") ||
				error.message.includes("invalid token")
			);

			if (is401Error && refreshToken && !hasRetried) {
				console.warn("  ⚠️ 遇到401错误，尝试刷新Token并重试...");
				hasRetried = true;

				try {
					// 刷新Token
					console.log("  📍 使用 refresh_token 刷新 Token...");
					const tokenData = await refreshWindsurfToken(refreshToken);
					currentAccessToken = tokenData.id_token || tokenData.access_token;
					console.log("  ✓ Token 刷新成功，准备重试...");

					// 保存新Token到存储
					if (accountId) {
						try {
							const storage = await invoke("get_accounts");
							const accountToUpdate = storage.accounts.find(acc => {
								return (acc.auth_id || acc.email) === accountId;
							});

							if (accountToUpdate) {
								await invoke("add_account", {
									authId: accountToUpdate.auth_id || accountId,
									email: accountToUpdate.email,
									accessToken: currentAccessToken,
									refreshToken: tokenData.refresh_token || refreshToken,
									plan: accountToUpdate.plan,
									note: accountToUpdate.note
								});
								console.log("  ✓ 新 Token 已保存");
							}
						} catch (saveError) {
							console.warn("  ⚠️ 保存新 Token 失败:", saveError);
						}
					}

					// 继续循环，重试
					continue;

				} catch (refreshError) {
					console.error("  ❌ Token刷新失败:", refreshError);
					throw new Error(`Token已过期且刷新失败: ${refreshError.message}`);
				}
			} else {
				// 非401错误或已重试过
				console.error("❌ [loadWindsurfAccountInfo] 失败:", error);
				throw error;
			}
		}
	}
}

/**
 * 刷新 Windsurf Token（旧接口）
 * @param {string} refreshToken - Windsurf refresh token
 * @returns {Promise<Object>} 新的 token 信息
 */
async function refreshWindsurfToken(refreshToken) {
	console.log("🔄 [refreshWindsurfToken] 刷新 Windsurf Token...");

	try {
		// 通过 Tauri 后端调用，避免 CORS
		const responseText = await invoke("refresh_windsurf_token", { refreshToken });
		const data = JSON.parse(responseText);
		console.log("✓ [refreshWindsurfToken] Token 刷新成功");
		return data; // 返回包含 access_token, id_token, refresh_token 等
	} catch (error) {
		console.error("❌ [refreshWindsurfToken] 失败:", error);
		throw new Error(`Token 刷新失败: ${error}`);
	}
}

/**
 * 使用 Firebase Auth 登录接口获取 Token
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @returns {Promise<Object>} Token 信息
 */
async function loginWithFirebase(email, password) {
	console.log("🔑 [loginWithFirebase] 使用 Firebase Auth 登录...");
	console.log("  📧 邮箱:", email);

	try {
		// 通过 Tauri 后端调用，避免 CORS
		const responseText = await invoke("firebase_login", { email, password });
		const data = JSON.parse(responseText);
		console.log("✓ [loginWithFirebase] Firebase 登录成功");

		// 返回标准格式
		return {
			access_token: data.idToken,
			id_token: data.idToken,
			refresh_token: data.refreshToken,
			expires_in: data.expiresIn,
			user_id: data.localId,
			email: data.email
		};
	} catch (error) {
		console.error("❌ [loginWithFirebase] 失败:", error);
		throw new Error(`Firebase 登录失败: ${error}`);
	}
}

/**
 * 使用邮箱密码获取 Windsurf Token
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @param {string} refreshToken - 可选的 refresh_token
 * @returns {Promise<Object>} Token 信息
 */
async function fetchWindsurfTokenByCredentials(email, password, refreshToken = "") {
	console.log("🔄 [fetchWindsurfTokenByCredentials] 使用邮箱密码获取 Token...");
	console.log("  📧 邮箱:", email);

	// 如果有 refresh_token，尝试使用特殊接口
	if (refreshToken) {
		try {
			console.log("  🔄 尝试使用 refresh_token 接口...");
			const responseText = await invoke("fetch_token_with_credentials", {
				email,
				password,
				refreshToken
			});
			const data = JSON.parse(responseText);
			console.log("✓ [fetchWindsurfTokenByCredentials] Token 获取成功（refresh_token 接口）");
			return data;
		} catch (error) {
			console.warn("  ⚠️ refresh_token 接口失败，回退到 Firebase 登录:", error);
		}
	}

	// 回退到 Firebase Auth 登录接口
	console.log("  🔑 使用 Firebase Auth 登录接口...");
	return await loginWithFirebase(email, password);
}

/**
 * 获取 Windsurf 套餐和用量信息
 * @param {string} idToken - Windsurf id_token
 * @returns {Promise<Object>} 套餐和用量信息
 */
async function getWindsurfPlanStatus(idToken) {
	console.log("🔄 [getWindsurfPlanStatus] 调用 Windsurf 官方接口获取套餐信息...");

	try {
		// 通过 Tauri 后端调用，避免 CORS
		const responseText = await invoke("get_plan_status", { idToken });
		const data = JSON.parse(responseText);
		console.log("✓ [getWindsurfPlanStatus] 套餐信息获取成功");
		return data;
	} catch (error) {
		console.error("❌ [getWindsurfPlanStatus] 失败:", error);
		throw new Error(`获取套餐信息失败: ${error}`);
	}
}

/**
 * 显示加载状态
 * @param {string} message - 加载消息
 */
function showLoading(message = "加载中...") {
	// 创建或获取 loading overlay
	let overlay = document.querySelector("#loading-overlay");
	if (!overlay) {
		overlay = document.createElement("div");
		overlay.id = "loading-overlay";
		overlay.innerHTML = `
			<div class="loading-content">
				<div class="loading-spinner"></div>
				<p class="loading-text">${message}</p>
			</div>
		`;
		overlay.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.7);
			display: flex;
			justify-content: center;
			align-items: center;
			z-index: 9999;
		`;
		const content = overlay.querySelector(".loading-content");
		content.style.cssText = `
			text-align: center;
			color: white;
		`;
		const spinner = overlay.querySelector(".loading-spinner");
		spinner.style.cssText = `
			width: 40px;
			height: 40px;
			border: 3px solid rgba(255, 255, 255, 0.3);
			border-top: 3px solid #ffffff;
			border-radius: 50%;
			animation: spin 1s linear infinite;
			margin: 0 auto 16px;
		`;
		// 添加动画样式
		const style = document.createElement("style");
		style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
		document.head.appendChild(style);
		document.body.appendChild(overlay);
	} else {
		overlay.querySelector(".loading-text").textContent = message;
		overlay.style.display = "flex";
	}
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
	const overlay = document.querySelector("#loading-overlay");
	if (overlay) {
		overlay.style.display = "none";
	}
}

/**
 * 处理 Windsurf 一键换号
 * @param {string} token - Windsurf token (可以是 refresh_token 或 id_token)
 */
async function handleWindsurfSwitchAccount(token) {
	console.log("🔄 开始 Windsurf 换号流程...");

	try {
		// 验证 token
		if (!token || token.trim().length === 0) {
			throw new Error("请输入有效的 Refresh Token");
		}

		// 显示加载状态
		showLoading("正在切换 Windsurf 账号...");

		// 调用 Rust 后端的一键换号命令
		const result = await invoke("switch_windsurf_account", {
			refreshToken: token.trim()
		});

		const data = JSON.parse(result);

		if (data.success) {
			// 显示成功信息
			await showAlert("换号成功", data.message, "success");

			// 显示账号信息
			if (data.account) {
				console.log("✅ 账号信息:", data.account);
			}

			// 显示机器码信息
			if (data.machine_ids) {
				console.log("✅ 机器码信息:", data.machine_ids);
			}

			// 刷新当前账号显示（使用已存在的函数）
			await loadWindsurfUsageData();

		} else {
			throw new Error(data.message || "换号失败");
		}

	} catch (error) {
		console.error("❌ Windsurf 换号失败:", error);
		await showAlert("换号失败", error.message || String(error), "error");
	} finally {
		hideLoading();
	}
}

// ==================== 账号管理功能 ====================

/**
 * 显示输入对话框
 * @param {string} title - 标题
 * @param {string} placeholder - 占位符文本
 * @returns {Promise<string|null>} 用户输入的内容，取消则返回 null
 */
function showInput(title, placeholder = "请输入...") {
	return new Promise((resolve) => {
		dialogResolve = resolve;

		const dialogOverlay = document.querySelector("#custom-dialog");
		const dialogTitle = document.querySelector("#dialog-title");
		const dialogMessage = document.querySelector("#dialog-message");
		const dialogIcon = document.querySelector("#dialog-icon");
		const dialogInput = document.querySelector("#dialog-input");
		const dialogFooter = document.querySelector("#dialog-footer");
		const dialogCancel = document.querySelector("#dialog-cancel");
		const dialogConfirm = document.querySelector("#dialog-confirm");

		// 设置内容
		dialogTitle.textContent = title;
		dialogMessage.style.display = "none"; // 隐藏消息文本

		// 设置图标（键盘图标）
		dialogIcon.innerHTML = `
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="2" y="7" width="20" height="12" rx="2" />
				<path d="M6 11h.01M10 11h.01M6 15h.01M10 15h.01M14 11h.01M14 15h.01M18 11h.01M18 15h.01" />
			</svg>
		`;
		dialogIcon.className = "dialog-icon dialog-icon-input";

		// 显示并配置输入框
		dialogInput.style.display = "block";
		dialogInput.value = "";
		dialogInput.placeholder = placeholder;

		// 显示取消和确定按钮
		dialogFooter.style.display = "flex";
		dialogCancel.style.display = "block";
		dialogConfirm.style.display = "block";

		// 显示弹窗
		dialogOverlay.classList.add("show");

		// 延迟聚焦到输入框（等待动画完成）
		setTimeout(() => {
			dialogInput.focus();
		}, 300);

		// 回车键确认
		const handleEnter = (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				dialogInput.removeEventListener("keydown", handleEnter);
				closeDialogWithInput(dialogInput.value);
			}
		};
		dialogInput.addEventListener("keydown", handleEnter);
	});
}

/**
 * 关闭弹窗（输入框特殊处理）
 * @param {string} inputValue - 输入框的值
 */
function closeDialogWithInput(inputValue) {
	const dialogOverlay = document.querySelector("#custom-dialog");
	const dialogInput = document.querySelector("#dialog-input");
	const dialogMessage = document.querySelector("#dialog-message");

	dialogOverlay.classList.remove("show");

	// 恢复消息显示
	dialogMessage.style.display = "block";
	dialogInput.style.display = "none";

	if (dialogResolve) {
		dialogResolve(inputValue || null);
		dialogResolve = null;
	}
}

/**
 * 从文本中提取 Token（适配 Windsurf 格式）
 * @param {string} text - 输入文本
 * @returns {string|null} 提取的 Token
 */
function extractTokenFromText(text) {
	if (!text) return null;

	// 首先尝试查找 SessionToken 格式 (user_xxx:sess_xxx|JWT)
	// 支持 URL 编码格式
	const sessionTokenPattern = /user_[A-Z0-9]+(?:%3A|:)sess_[A-Z0-9]+(?:%7C|\|)[A-Za-z0-9\-_\.]+/gi;
	const sessionTokenMatch = text.match(sessionTokenPattern);
	if (sessionTokenMatch) {
		console.log("检测到 SessionToken 格式");
		let longestMatch = sessionTokenMatch[0];
		for (const match of sessionTokenMatch) {
			if (match.length > longestMatch.length) {
				longestMatch = match;
			}
		}
		return longestMatch;
	}

	// 尝试查找 WebToken 格式 (user_xxx::JWT)
	const webTokenPattern = /user_[A-Z0-9]+(?:%3A%3A|::)[A-Za-z0-9\-_\.]+/gi;
	const webTokenMatch = text.match(webTokenPattern);
	if (webTokenMatch) {
		console.log("检测到 WebToken 格式");
		let longestMatch = webTokenMatch[0];
		for (const match of webTokenMatch) {
			if (match.length > longestMatch.length) {
				longestMatch = match;
			}
		}
		return longestMatch;
	}

	// 尝试查找 JWT Token 格式 (eyJ...)
	const jwtPattern = /eyJ[A-Za-z0-9\-_\.]+/g;
	const jwtMatch = text.match(jwtPattern);
	if (jwtMatch) {
		console.log("检测到 JWT Token 格式");
		let longestMatch = jwtMatch[0];
		for (const match of jwtMatch) {
			if (match.length > longestMatch.length) {
				longestMatch = match;
			}
		}
		return longestMatch;
	}

	return null;
}

/**
 * 将 Windsurf 账号格式转换为后端存储格式
 * @param {Object} windsurfAccount - Windsurf 账号对象
 * @returns {Object} 后端 AccountData 格式
 */
function convertWindsurfToAccountData(windsurfAccount) {
	const { generate_machine_ids } = window.__TAURI__ || {};

	// 生成默认机器ID（如果后端没有提供）
	const defaultMachineId = "00000000-0000-0000-0000-000000000000";

	// 将密码和额外信息存储在 note 字段中（JSON 格式）
	const noteData = {
		email: windsurfAccount.email || "", // 也在note中存储email，防止丢失
		name: windsurfAccount.name || windsurfAccount.email?.split("@")[0] || "",
		password: windsurfAccount.password || "",
		apiServerUrl: windsurfAccount.apiServerUrl || "https://server.self-serve.windsurf.com",
		createdAt: windsurfAccount.createdAt || new Date().toISOString(),
		extraData: {
			credits: windsurfAccount.credits,
			usage: windsurfAccount.usage,
			plan_end: windsurfAccount.plan_end,
			available_prompt_credits: windsurfAccount.available_prompt_credits,
			available_flow_credits: windsurfAccount.available_flow_credits,
			available_flex_credits: windsurfAccount.available_flex_credits,
		}
	};

	return {
		email: windsurfAccount.email || "",
		plan: windsurfAccount.type || "Free",
		sign_up_type: "windsurf",
		auth_id: windsurfAccount.id || Date.now().toString(),
		access_token: windsurfAccount.apiKey || windsurfAccount.refreshToken || "",
		refresh_token: windsurfAccount.refreshToken || windsurfAccount.apiKey || "",
		machine_id: defaultMachineId,
		service_machine_id: defaultMachineId,
		dev_device_id: defaultMachineId,
		mac_machine_id: defaultMachineId,
		machine_id_telemetry: defaultMachineId,
		sqm_id: defaultMachineId,
		note: JSON.stringify(noteData), // 将额外信息存储为 JSON
	};
}

/**
 * 将后端存储格式转换为 Windsurf 显示格式
 * @param {Object} accountData - 后端 AccountData 格式
 * @returns {Object} Windsurf 显示格式
 */
function convertAccountDataToWindsurf(accountData) {
	// 尝试从 note 字段解析额外信息
	let noteData = {};
	try {
		if (accountData.note) {
			noteData = JSON.parse(accountData.note);
		}
	} catch (e) {
		// 如果解析失败，说明 note 是普通字符串
		noteData = { name: accountData.note || "" };
	}

	// 尝试从 note 中解析额外的账号信息
	let extraData = {};
	try {
		const noteParsed = JSON.parse(accountData.note || "{}");
		extraData = noteParsed.extraData || {};
	} catch (e) {
		// 忽略解析错误
	}

	console.log("📦 [convertAccountDataToWindsurf] 原始数据:", {
		email: accountData.email,
		noteData: noteData,
		notePassword: noteData.password
	});

	return {
		id: accountData.auth_id || Date.now().toString(),
		email: accountData.email || noteData.email || "", // 优先使用 accountData.email，其次是 noteData.email
		password: noteData.password || "", // 从 note 中恢复密码
		name: noteData.name || accountData.email?.split("@")[0] || accountData.email,
		apiKey: accountData.access_token,
		apiServerUrl: noteData.apiServerUrl || "https://server.self-serve.windsurf.com",
		refreshToken: accountData.refresh_token,
		createdAt: noteData.createdAt || new Date().toISOString(),
		type: accountData.plan || "Free",
		credits: extraData.credits || 500, // 从额外数据中恢复或使用默认值
		usage: extraData.usage || 0,
		plan_end: extraData.plan_end,
		available_prompt_credits: extraData.available_prompt_credits,
		available_flow_credits: extraData.available_flow_credits,
		available_flex_credits: extraData.available_flex_credits,
	};
}

/**
 * 加载账号管理页面
 */
async function loadWindsurfAccountsPage() {
	console.log("📋 加载 Windsurf 账号管理页面...");

	try {
		// 获取账号列表
		const storage = await invoke("get_accounts");
		const accounts = storage.accounts || [];

		console.log(`✓ 加载了 ${accounts.length} 个账号`);

		// 转换为 Windsurf 显示格式
		const windsurfAccounts = accounts.map(convertAccountDataToWindsurf);

		// 更新统计卡片
		updateAccountStats(windsurfAccounts);

		// 渲染账号列表
		renderAccountsList(windsurfAccounts);

		// 标记页面已加载
		console.log("✓ 账号管理页面加载完成");
	} catch (error) {
		console.error("❌ 加载账号管理页面失败:", error);
		await showAlert("加载失败", `无法加载账号列表：${error}`, "error");
	}
}

/**
 * 处理刷新账号列表按钮点击
 */
async function handleRefreshAccountsList() {
	const refreshBtn = document.querySelector("#refresh-accounts-btn");
	if (!refreshBtn) return;

	const svg = refreshBtn.querySelector("svg");

	// 防止重复点击
	if (refreshBtn.disabled) {
		console.log("⚠️ 刷新操作进行中，请勿重复点击");
		return;
	}

	// 禁用按钮，防止重复点击
	refreshBtn.disabled = true;

	// 添加旋转动画
	if (svg) {
		svg.style.transition = "transform 0.6s ease";
		svg.style.transform = "rotate(360deg)";
	}

	try {
		console.log("🔄 刷新账号列表...");
		await loadWindsurfAccountsPage();
		console.log("✓ 账号列表刷新完成");
	} catch (error) {
		console.error("❌ 刷新账号列表失败:", error);
		await showAlert("刷新失败", `无法刷新账号列表：${error}`, "error");
	} finally {
		// 恢复按钮状态
		refreshBtn.disabled = false;

		// 动画完成后重置
		if (svg) {
			setTimeout(() => {
				svg.style.transform = "rotate(0deg)";
			}, 600);
		}
	}
}

/**
 * 显示账号详情弹窗
 * @param {string} accountId - 账号ID
 */
async function showAccountDetail(accountId) {
	console.log("📋 [showAccountDetail] 显示账号详情:", accountId);

	try {
		// 获取所有账号
		const storage = await invoke("get_accounts");
		const accounts = storage.accounts || [];

		// 转换为 Windsurf 格式
		const windsurfAccounts = accounts.map(convertAccountDataToWindsurf);

		// 查找目标账号
		const account = windsurfAccounts.find(acc => {
			const accId = acc.id || acc.email;
			return accId === accountId;
		});

		if (!account) {
			await showAlert("错误", "未找到该账号", "error");
			return;
		}

		console.log("🔍 [showAccountDetail] 账号数据:", account);
		console.log("  - email:", account.email);
		console.log("  - password:", account.password);
		console.log("  - id:", account.id);

		// 填充详情数据
		document.querySelector("#detail-email").textContent = account.email || "-";
		document.querySelector("#detail-password").textContent = account.password || "Windsurf@123456";
		document.querySelector("#detail-user-id").textContent = account.id || "-";

		// 创建时间
		let createdAt = "-";
		if (account.createdAt) {
			try {
				const date = new Date(account.createdAt);
				createdAt = date.toLocaleString('zh-CN');
			} catch (e) {
				createdAt = account.createdAt;
			}
		}
		document.querySelector("#detail-created-at").textContent = createdAt;

		// 到期时间
		let expiryDate = "-";
		let remainingDays = "";
		if (account.plan_end) {
			try {
				const endDate = new Date(account.plan_end);
				expiryDate = endDate.toLocaleDateString('zh-CN');

				// 计算剩余天数
				const now = new Date();
				const diff = endDate - now;
				const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
				if (days > 0) {
					remainingDays = ` (剩余${days}天)`;
					expiryDate += remainingDays;
				} else if (days === 0) {
					remainingDays = " (今天到期)";
					expiryDate += remainingDays;
				} else {
					remainingDays = " (已到期)";
					expiryDate += remainingDays;
				}
			} catch (e) {
				expiryDate = "-";
			}
		}
		document.querySelector("#detail-expiry").textContent = expiryDate;

		// 订阅信息
		document.querySelector("#detail-plan-type").textContent = account.type || "Pro";

		// 积分和使用率
		const totalCredits = account.credits || 0;
		const availableCredits = account.available_prompt_credits;

		if (availableCredits !== undefined) {
			document.querySelector("#detail-credits").textContent = availableCredits.toLocaleString();
			if (totalCredits > 0) {
				const usagePercent = Math.round(((totalCredits - availableCredits) / totalCredits) * 100);
				document.querySelector("#detail-usage").textContent = `${usagePercent}%`;
			} else {
				document.querySelector("#detail-usage").textContent = "-";
			}
		} else {
			document.querySelector("#detail-credits").textContent = totalCredits.toLocaleString();
			document.querySelector("#detail-usage").textContent = "-";
		}

		// API Key
		const apiKey = account.apiKey || account.refreshToken || "-";
		document.querySelector("#detail-api-key").textContent = apiKey;

		// 显示弹窗
		const dialog = document.querySelector("#account-detail-dialog");
		if (dialog) {
			dialog.classList.add("show");
		}

	} catch (error) {
		console.error("❌ [showAccountDetail] 失败:", error);
		await showAlert("错误", `无法显示账号详情：${error}`, "error");
	}
}

/**
 * 关闭账号详情弹窗
 */
function closeAccountDetail() {
	const dialog = document.querySelector("#account-detail-dialog");
	if (dialog) {
		dialog.classList.remove("show");
	}
}

/**
 * 处理查看账号按钮点击（全局函数，供HTML调用）
 * @param {string} accountId - 账号ID
 */
window.handleViewAccount = async function (accountId) {
	await showAccountDetail(accountId);
};

/**
 * 复制API Key
 */
async function copyDetailApiKey() {
	const apiKeyElement = document.querySelector("#detail-api-key");
	if (!apiKeyElement) return;

	const apiKey = apiKeyElement.textContent;
	if (apiKey === "-") {
		await showAlert("提示", "没有可复制的 API Key", "info");
		return;
	}

	try {
		await navigator.clipboard.writeText(apiKey);
		await showAlert("成功", "API Key 已复制到剪贴板", "success");
	} catch (error) {
		console.error("复制失败:", error);
		await showAlert("错误", "复制失败，请手动复制", "error");
	}
}

/**
 * 一键获取所有账号的Token
 */
async function handleFetchAllTokens() {
	console.log("🔑 [handleFetchAllTokens] 开始批量获取Token...");

	const fetchBtn = document.querySelector("#fetch-all-tokens-btn");
	const svg = fetchBtn?.querySelector("svg");

	// 防止重复点击
	if (fetchBtn && fetchBtn.disabled) {
		console.log("⚠️ 获取Token操作进行中，请勿重复点击");
		return;
	}

	// 禁用按钮
	if (fetchBtn) {
		fetchBtn.disabled = true;
		fetchBtn.style.opacity = "0.6";
	}

	// 添加旋转动画
	if (svg) {
		svg.style.transition = "transform 0.6s linear";
		svg.style.transform = "rotate(360deg)";
		const rotateInterval = setInterval(() => {
			const currentRotation = parseInt(svg.style.transform.match(/\d+/)?.[0] || 0);
			svg.style.transform = `rotate(${currentRotation + 360}deg)`;
		}, 600);
		svg._rotateInterval = rotateInterval;
	}

	try {
		// 获取所有账号
		const storage = await invoke("get_accounts");
		const accounts = storage.accounts || [];

		if (accounts.length === 0) {
			await showAlert("提示", "暂无账号，请先添加账号", "info");
			return;
		}

		// 转换为 Windsurf 格式
		const windsurfAccounts = accounts.map(convertAccountDataToWindsurf);

		// 筛选有邮箱和密码的账号
		const accountsWithCredentials = windsurfAccounts.filter(acc => acc.email && acc.password);

		if (accountsWithCredentials.length === 0) {
			await showAlert("提示", "没有找到包含邮箱和密码的账号", "info");
			return;
		}

		console.log(`  📋 找到 ${accountsWithCredentials.length} 个有效账号`);

		let successCount = 0;
		let failCount = 0;
		const results = [];

		// 批量获取Token
		for (let i = 0; i < accountsWithCredentials.length; i++) {
			const account = accountsWithCredentials[i];
			console.log(`\n  [${i + 1}/${accountsWithCredentials.length}] 处理账号: ${account.email}`);

			try {
				// 调用新接口获取Token
				const tokenData = await fetchWindsurfTokenByCredentials(
					account.email,
					account.password,
					account.refreshToken || ""
				);

				// 更新账号的Token信息
				account.apiKey = tokenData.access_token;
				account.refreshToken = tokenData.refresh_token;
				account.id = tokenData.user_id || account.id;

				// 保存更新后的账号
				const accountData = convertWindsurfToAccountData(account);
				await invoke("add_account", { data: accountData });

				console.log(`  ✓ 账号 ${account.email} Token 获取成功`);
				successCount++;
				results.push({ email: account.email, success: true });

			} catch (error) {
				console.error(`  ❌ 账号 ${account.email} Token 获取失败:`, error.message);
				failCount++;
				results.push({ email: account.email, success: false, error: error.message });
			}

			// 添加延迟，避免请求过快
			if (i < accountsWithCredentials.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}

		// 刷新列表显示
		await loadWindsurfAccountsPage();

		// 显示结果
		const resultMessage = `
成功: ${successCount} 个账号
失败: ${failCount} 个账号

${results.map(r => `${r.email}: ${r.success ? '✓ 成功' : '✗ ' + r.error}`).join('\n')}
		`.trim();

		await showAlert(
			"Token 获取完成",
			resultMessage,
			successCount > 0 ? "success" : "error"
		);

	} catch (error) {
		console.error("❌ [handleFetchAllTokens] 批量获取Token失败:", error);
		await showAlert("获取失败", `批量获取Token失败：${error.message}`, "error");
	} finally {
		// 清理动画和恢复按钮状态
		if (svg?._rotateInterval) {
			clearInterval(svg._rotateInterval);
			delete svg._rotateInterval;
		}
		if (svg) {
			setTimeout(() => {
				svg.style.transform = "rotate(0deg)";
			}, 100);
		}
		if (fetchBtn) {
			fetchBtn.disabled = false;
			fetchBtn.style.opacity = "1";
		}
	}
}

/**
 * 更新账号统计卡片
 */
function updateAccountStats(accounts) {
	const total = accounts.length;
	let available = 0;
	let expiringSoon = 0;
	let expired = 0;

	const now = new Date();
	const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

	accounts.forEach(account => {
		// 这里需要根据实际的到期时间字段来判断
		// 暂时使用简单的逻辑
		if (account.type && account.type !== "Free") {
			available++;
		}
	});

	// 更新统计数字
	const totalAccountsEl = document.querySelector("#total-accounts");
	const availableAccountsEl = document.querySelector("#available-accounts");
	const expiringAccountsEl = document.querySelector("#expiring-accounts");
	const expiredAccountsEl = document.querySelector("#expired-accounts");

	if (totalAccountsEl) totalAccountsEl.textContent = total;
	if (availableAccountsEl) availableAccountsEl.textContent = available;
	if (expiringAccountsEl) expiringAccountsEl.textContent = expiringSoon;
	if (expiredAccountsEl) expiredAccountsEl.textContent = expired;
}

/**
 * 渲染账号列表
 */
async function renderAccountsList(accounts) {
	const tbody = document.querySelector("#accounts-table-body");
	if (!tbody) return;

	if (accounts.length === 0) {
		tbody.innerHTML = `
			<tr>
				<td colspan="9" style="text-align: center; padding: 40px; color: #888;">
					暂无账号，请点击“添加账号”或“导入账号”添加
				</td>
			</tr>
		`;
		return;
	}

	// 获取当前设置的账号 ID
	let currentAccountId = null;
	try {
		currentAccountId = await invoke("get_current_windsurf_account_setting_cmd");
		console.log("📍 当前设置的账号 ID:", currentAccountId);
	} catch (error) {
		console.warn("⚠️ 获取当前账号 ID 失败:", error);
	}

	tbody.innerHTML = accounts.map((account, index) => {
		const email = maskEmail(account.email || "未知");
		const type = account.type || "Free";

		// 积分计算逻辑：总积分 = availablePromptCredits + availableFlexCredits（如果存在）
		// account.credits 已经在刷新时计算好了总积分
		const totalCredits = account.credits || 0;
		const availablePromptCredits = account.available_prompt_credits || 0;
		const availableFlexCredits = account.available_flex_credits || 0;
		const usedCredits = account.usage || 0; // 已使用积分，从 usedPromptCredits 获取

		// 计算可用积分和使用率
		const availableCredits = availablePromptCredits + availableFlexCredits;
		let usagePercent = 0;
		let displayCredits = availableCredits;

		if (totalCredits > 0 && usedCredits >= 0) {
			// 使用已存储的使用数据计算
			usagePercent = Math.round((usedCredits / totalCredits) * 100);
			displayCredits = totalCredits - usedCredits;
		}

		const accountId = account.id || account.email || index.toString(); // 使用 id、email 或索引作为标识

		// 到期时间
		let expiryDate = '-';
		if (account.plan_end) {
			try {
				const endDate = new Date(account.plan_end);
				expiryDate = endDate.toLocaleDateString('zh-CN');
			} catch (e) {
				expiryDate = '-';
			}
		}

		// Token 状态
		const hasToken = account.refreshToken || account.apiKey || account.refresh_token || account.access_token;
		const tokenStatus = hasToken ?
			'<span style="color: #10b981;">Token 正常</span>' :
			'<span style="color: #ef4444;">未设置</span>';

		// 转义账号ID，防止XSS
		const safeAccountId = accountId.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		const safeEmail = (account.email || "").replace(/"/g, '&quot;').replace(/'/g, '&#39;');

		// 检查是否为当前账号
		const isCurrentAccount = currentAccountId && accountId === currentAccountId;
		const currentBadge = isCurrentAccount ? '<span class="badge" style="background: #10b981; color: white; margin-left: 8px; padding: 2px 8px; border-radius: 4px; font-size: 12px;">当前</span>' : '';

		return `
			<tr${isCurrentAccount ? ' style="background-color: rgba(16, 185, 129, 0.1);"' : ''}>
				<td>${index + 1}</td>
				<td title="${safeEmail}">${email}${currentBadge}</td>
				<td>
					<button class="icon-btn" onclick="togglePassword(this, '${safeAccountId}')" title="显示/隐藏密码">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
							<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
							<circle cx="12" cy="12" r="3"/>
						</svg>
					</button>
					<span class="password-text" data-password="${(account.password || '').replace(/"/g, '&quot;')}" style="display: none;">••••••</span>
				</td>
				<td><span class="badge badge-${type.toLowerCase()}">${type}</span></td>
				<td>${displayCredits.toLocaleString()}</td>
				<td>${usagePercent}%</td>
				<td>${expiryDate}</td>
				<td>${tokenStatus}</td>
				<td>
					<div class="action-buttons">
						<button class="icon-btn" onclick="handleSetCurrentAccount('${safeAccountId}')" title="设置为当前账号">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
								<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
								<circle cx="8.5" cy="7" r="4"/>
								<polyline points="17 11 19 13 23 9"/>
							</svg>
						</button>
						<button class="icon-btn" onclick="handleViewAccount('${safeAccountId}')" title="查看详情">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
								<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
								<circle cx="12" cy="12" r="3"/>
							</svg>
						</button>
						<button class="icon-btn" onclick="handleRefreshAccount('${safeAccountId}')" title="刷新账号信息">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
								<path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
							</svg>
						</button>
						<button class="icon-btn" onclick="handleFetchAccountToken('${safeAccountId}')" title="获取Token">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
								<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
							</svg>
						</button>
						<button class="icon-btn danger" onclick="handleDeleteAccount('${safeAccountId}')" title="删除账号">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
								<polyline points="3 6 5 6 21 6"/>
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
							</svg>
						</button>
					</div>
				</td>
			</tr>
		`;
	}).join('');
}

// 全局函数供 HTML onclick 调用
window.togglePassword = function (btn, accountId) {
	const span = btn.nextElementSibling;
	if (span.style.display === "none") {
		span.style.display = "inline";
		span.textContent = span.dataset.password;
	} else {
		span.style.display = "none";
		span.textContent = "••••••";
	}
};

window.handleSetCurrentAccount = async function (accountId) {
	console.log("设置当前账号:", accountId);

	try {
		// 1. 先获取账号信息，拿到 refresh_token
		const storage = await invoke("get_accounts");
		const accounts = storage.accounts || [];
		const windsurfAccounts = accounts.map(convertAccountDataToWindsurf);

		const account = windsurfAccounts.find(acc => {
			const accId = acc.id || acc.email;
			return accId === accountId;
		});

		if (!account) {
			await showAlert("错误", "未找到该账号", "error");
			return;
		}

		const refreshToken = account.refreshToken || account.refresh_token;

		if (!refreshToken) {
			await showAlert("错误", "该账号没有 Refresh Token，无法换号", "error");
			return;
		}

		// 2. 确认是否执行换号
		const confirmResult = await showConfirm(
			"确认换号",
			`确定要切换到账号 ${account.email} 吗？\n\n换号将会：\n• 刷新 Token\n• 更新 Windsurf 登录状态\n• 重置机器码\n• 重启 Windsurf`,
			"warning"
		);

		if (!confirmResult) {
			console.log("用户取消换号");
			return;
		}

		// 3. 调用后端设置当前账号（保存选择）
		await invoke("set_current_windsurf_account_cmd", { accountId });
		console.log("✓ 账号已设置为当前账号");

		// 4. 执行 Windsurf 一键换号
		console.log("🔄 开始执行 Windsurf 换号...");
		await handleWindsurfSwitchAccount(refreshToken);

		// 5. 刷新账号列表显示当前标记
		await loadWindsurfAccountsPage();

	} catch (error) {
		console.error("❌ 设置当前账号失败:", error);
		await showAlert("错误", `换号失败：${error}`, "error");
	}
};

// handleViewAccount 已在前面定义，这里不需要重复定义

window.handleRefreshAccount = async function (accountId) {
	console.log("🔄 刷新账号:", accountId);

	// 查找刷新按钮并添加动画
	const refreshBtn = event?.target?.closest('.icon-btn');
	const svg = refreshBtn?.querySelector('svg');

	if (refreshBtn) {
		refreshBtn.disabled = true;
		refreshBtn.style.opacity = '0.6';
	}
	if (svg) {
		svg.style.transition = 'transform 0.6s linear';
		svg.style.transform = 'rotate(360deg)';
		// 持续旋转动画
		const rotateInterval = setInterval(() => {
			const currentRotation = parseInt(svg.style.transform.match(/\d+/)?.[0] || 0);
			svg.style.transform = `rotate(${currentRotation + 360}deg)`;
		}, 600);
		svg._rotateInterval = rotateInterval;
	}

	try {
		// 获取所有账号
		const storage = await invoke("get_accounts");
		const accounts = storage.accounts || [];

		// 转换为 Windsurf 格式方便操作
		const windsurfAccounts = accounts.map(convertAccountDataToWindsurf);

		// 查找目标账号
		const account = windsurfAccounts.find(acc => {
			const accId = acc.id || acc.email;
			return accId === accountId;
		});

		if (!account) {
			console.error("  ❌ 未找到账号，accountId:", accountId);
			console.log("  可用的账号ID列表:", windsurfAccounts.map(a => a.id || a.email));
			await showAlert("错误", "未找到该账号", "error");
			return;
		}

		console.log("  📧 账号邮箱:", account.email);

		// 检查是否有 Token
		const refreshToken = account.refreshToken || account.refresh_token;
		const accessToken = account.apiKey || account.access_token;

		if (!refreshToken && !accessToken) {
			await showAlert("提示", "该账号没有 Token 信息，无法刷新", "info");
			return;
		}

		// 显示加载提示（可选）
		console.log("  🔄 正在调用 Windsurf API...");

		// 如果有 refresh_token，先刷新获取新的 token
		let currentAccessToken = accessToken;
		if (refreshToken) {
			try {
				console.log("  📍 Step 1: 使用 refresh_token 刷新 Token...");
				const tokenData = await refreshWindsurfToken(refreshToken);
				currentAccessToken = tokenData.id_token || tokenData.access_token;

				// 更新账号的 token 信息（Windsurf 格式）
				account.apiKey = currentAccessToken;
				account.refreshToken = tokenData.refresh_token || refreshToken;
				console.log("  ✓ Token 刷新成功");
			} catch (error) {
				console.warn("  ⚠️ Token 刷新失败，尝试使用原有 access_token:", error.message);
			}
		}

		if (!currentAccessToken) {
			await showAlert("错误", "无法获取有效的 Access Token", "error");
			return;
		}

		// 调用 API 获取套餐信息
		console.log("  📍 Step 2: 获取套餐信息...");
		const planData = await getWindsurfPlanStatus(currentAccessToken);

		if (!planData || !planData.planStatus) {
			await showAlert("错误", "未能获取有效的套餐信息", "error");
			return;
		}

		const planStatus = planData.planStatus;
		const planInfo = planStatus.planInfo || {};

		// 更新账号信息（积分值需要除以100，因为API返回的是"分"）
		account.type = planInfo.planName || "Pro";

		// 总积分 = availablePromptCredits + availableFlexCredits（如果存在）
		const availablePrompt = planStatus.availablePromptCredits || 0;
		const availableFlex = planStatus.availableFlexCredits || 0;
		account.credits = Math.round((availablePrompt + availableFlex) / 100);

		// 已使用积分直接从 usedPromptCredits 获取
		account.usage = Math.round((planStatus.usedPromptCredits || 0) / 100);

		account.plan_end = planStatus.planEnd;
		account.available_prompt_credits = Math.round(availablePrompt / 100);
		account.available_flow_credits = Math.round((planStatus.availableFlowCredits || 0) / 100);
		account.available_flex_credits = Math.round(availableFlex / 100);

		console.log("  ✓ 账号信息已更新:", {
			type: account.type,
			credits: account.credits,
			usage: account.usage,
			planEnd: account.plan_end
		});

		// 保存更新后的账号信息（使用 add_account，它会自动更新已存在的账号）
		console.log("  📍 Step 3: 保存账号信息...");
		const accountData = convertWindsurfToAccountData(account);
		await invoke("add_account", {
			data: accountData
		});

		console.log("  ✓ 账号信息已保存");

		// 刷新列表显示
		await loadWindsurfAccountsPage();

		await showAlert("刷新成功", `账号 ${account.email} 信息已更新`, "success");

	} catch (error) {
		console.error("❌ 刷新账号失败:", error);
		await showAlert("刷新失败", `无法刷新账号信息：${error.message}`, "error");
	} finally {
		// 清理动画和恢复按钮状态
		if (svg?._rotateInterval) {
			clearInterval(svg._rotateInterval);
			delete svg._rotateInterval;
		}
		if (svg) {
			setTimeout(() => {
				svg.style.transform = 'rotate(0deg)';
			}, 100);
		}
		if (refreshBtn) {
			refreshBtn.disabled = false;
			refreshBtn.style.opacity = '1';
		}
	}
};

/**
 * 获取单个账号的Token
 */
window.handleFetchAccountToken = async function (accountId) {
	console.log("🔑 开始获取账号Token:", accountId);

	// 查找按钮并添加动画
	const btn = event?.target?.closest('.icon-btn');
	const svg = btn?.querySelector('svg');

	if (btn) {
		btn.disabled = true;
		btn.style.opacity = '0.6';
	}
	if (svg) {
		svg.style.transition = 'transform 0.6s linear';
		svg.style.transform = 'rotate(360deg)';
		const rotateInterval = setInterval(() => {
			const currentRotation = parseInt(svg.style.transform.match(/\d+/)?.[0] || 0);
			svg.style.transform = `rotate(${currentRotation + 360}deg)`;
		}, 600);
		svg._rotateInterval = rotateInterval;
	}

	try {
		// 获取所有账号
		const storage = await invoke("get_accounts");
		const accounts = storage.accounts || [];

		// 转换为 Windsurf 格式
		const windsurfAccounts = accounts.map(convertAccountDataToWindsurf);

		// 查找目标账号
		const account = windsurfAccounts.find(acc => {
			const accId = acc.id || acc.email;
			return accId === accountId;
		});

		if (!account) {
			console.error("❌ 未找到账号");
			await showAlert("错误", "未找到该账号", "error");
			return;
		}

		if (!account.email || !account.password) {
			await showAlert("提示", "该账号缺少邮箱或密码信息", "info");
			return;
		}

		console.log(`  📍 处理账号: ${account.email}`);

		// 调用智能刷新方法获取Token
		const tokenData = await fetchWindsurfTokenByCredentials(
			account.email,
			account.password,
			account.refreshToken || ""
		);

		// 更新账号的Token信息
		account.apiKey = tokenData.access_token;
		account.refreshToken = tokenData.refresh_token;
		account.id = tokenData.user_id || account.id;

		// 保存更新后的账号
		const accountData = convertWindsurfToAccountData(account);
		await invoke("add_account", { data: accountData });

		console.log(`✓ 账号 ${account.email} Token 获取成功`);

		// 刷新列表显示
		await loadWindsurfAccountsPage();

		await showAlert(
			"Token 获取成功",
			`账号 ${account.email} 的 Token 已更新`,
			"success"
		);

	} catch (error) {
		console.error("❌ 获取Token失败:", error);
		await showAlert("获取失败", `Token 获取失败：${error.message}`, "error");
	} finally {
		// 清理动画和恢复按钮状态
		if (svg?._rotateInterval) {
			clearInterval(svg._rotateInterval);
			delete svg._rotateInterval;
		}
		if (svg) {
			setTimeout(() => {
				svg.style.transform = 'rotate(0deg)';
			}, 100);
		}
		if (btn) {
			btn.disabled = false;
			btn.style.opacity = '1';
		}
	}
};

window.handleDeleteAccount = async function (accountId) {
	const confirmed = await showConfirm(
		"删除账号",
		"确定要删除这个账号吗？此操作不可恢复。",
		"warning"
	);

	if (!confirmed) return;

	try {
		// 根据邮箱删除账号
		const storage = await invoke("get_accounts");
		const account = storage.accounts.find(acc => {
			const windsurfAcc = convertAccountDataToWindsurf(acc);
			return windsurfAcc.id === accountId;
		});

		if (!account) {
			await showAlert("删除失败", "未找到要删除的账号", "error");
			return;
		}

		await invoke("delete_account", { email: account.email });
		await showAlert("删除成功", "账号已删除", "success");
		await loadWindsurfAccountsPage();
	} catch (error) {
		console.error("删除账号失败:", error);
		await showAlert("删除失败", `无法删除账号：${error}`, "error");
	}
};

/**
 * 显示表单对话框（用于新增账号）
 * @returns {Promise<Object|null>} 返回表单数据对象，取消则返回 null
 */
function showFormDialog() {
	return new Promise((resolve) => {
		dialogResolve = resolve;

		const dialogOverlay = document.querySelector("#custom-dialog");
		const dialogTitle = document.querySelector("#dialog-title");
		const dialogMessage = document.querySelector("#dialog-message");
		const dialogIcon = document.querySelector("#dialog-icon");
		const dialogForm = document.querySelector("#dialog-form");
		const dialogInput = document.querySelector("#dialog-input");
		const dialogFooter = document.querySelector("#dialog-footer");
		const dialogCancel = document.querySelector("#dialog-cancel");
		const dialogConfirm = document.querySelector("#dialog-confirm");
		const emailInput = document.querySelector("#dialog-email");
		const passwordInput = document.querySelector("#dialog-password");
		const apiKeyInput = document.querySelector("#dialog-apikey");

		// 设置内容
		dialogTitle.textContent = "添加账号";
		dialogMessage.style.display = "none"; // 隐藏消息文本
		dialogInput.style.display = "none"; // 隐藏单行输入框

		// 设置图标（用户图标）
		dialogIcon.innerHTML = `
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		`;
		dialogIcon.className = "dialog-icon dialog-icon-info";

		// 显示表单
		dialogForm.style.display = "block";

		// 清空表单
		emailInput.value = "";
		passwordInput.value = "";
		apiKeyInput.value = "";

		// 显示取消和确定按钮
		dialogFooter.style.display = "flex";
		dialogCancel.style.display = "block";
		dialogConfirm.textContent = "添加";
		dialogConfirm.style.display = "block";

		// 显示弹窗
		dialogOverlay.classList.add("show");

		// 延迟聚焦到邮箱输入框
		setTimeout(() => {
			emailInput.focus();
		}, 300);

		// 回车键确认（在最后一个输入框按回车）
		const handleEnter = (e) => {
			if (e.key === "Enter" && e.target === apiKeyInput) {
				e.preventDefault();
				handleFormSubmit();
			}
		};
		apiKeyInput.addEventListener("keydown", handleEnter);

		// 表单提交处理
		function handleFormSubmit() {
			const email = emailInput.value.trim();
			const password = passwordInput.value.trim();
			const apiKey = apiKeyInput.value.trim();

			// 验证邮箱
			if (!email || !email.includes("@")) {
				emailInput.focus();
				return;
			}

			// 验证密码
			if (!password) {
				passwordInput.focus();
				return;
			}

			// 关闭对话框并返回数据
			closeFormDialog({
				email,
				password,
				apiKey: apiKey || undefined,
			});
		}

		// 绑定确认按钮事件
		const handleConfirmClick = () => {
			handleFormSubmit();
		};
		dialogConfirm.addEventListener("click", handleConfirmClick);

		// 保存事件处理函数，用于清理
		dialogForm._enterHandler = handleEnter;
		dialogForm._confirmHandler = handleConfirmClick;
	});
}

/**
 * 关闭表单对话框
 * @param {Object|null} formData - 表单数据
 */
function closeFormDialog(formData) {
	const dialogOverlay = document.querySelector("#custom-dialog");
	const dialogForm = document.querySelector("#dialog-form");
	const dialogMessage = document.querySelector("#dialog-message");
	const dialogInput = document.querySelector("#dialog-input");
	const dialogConfirm = document.querySelector("#dialog-confirm");
	const apiKeyInput = document.querySelector("#dialog-apikey");

	dialogOverlay.classList.remove("show");

	// 恢复显示
	dialogMessage.style.display = "block";
	dialogForm.style.display = "none";
	dialogInput.style.display = "none";
	dialogConfirm.textContent = "确定";

	// 清理事件监听器
	if (dialogForm._enterHandler && apiKeyInput) {
		apiKeyInput.removeEventListener("keydown", dialogForm._enterHandler);
		delete dialogForm._enterHandler;
	}
	if (dialogForm._confirmHandler && dialogConfirm) {
		dialogConfirm.removeEventListener("click", dialogForm._confirmHandler);
		delete dialogForm._confirmHandler;
	}

	if (dialogResolve) {
		dialogResolve(formData);
		dialogResolve = null;
	}
}

/**
 * 处理新增账号
 */
async function handleAddAccount() {
	try {
		// 显示表单对话框
		const formData = await showFormDialog();

		if (!formData) {
			// 用户取消
			return;
		}

		const { email, password, apiKey } = formData;

		// 构造账号数据（Windsurf 格式）
		const windsurfAccount = {
			id: Date.now().toString(),
			email: email,
			password: password,
			name: email.split("@")[0], // 使用邮箱前缀作为名称
			apiKey: apiKey || "",
			apiServerUrl: "https://server.self-serve.windsurf.com",
			refreshToken: apiKey || "", // 如果没有 API Key，使用空字符串
			createdAt: new Date().toISOString(),
			type: "Pro", // 默认 Pro，后续可以从 API 获取
			credits: 500, // 默认值，需要从 API 获取
			usage: 0, // 默认值，需要从 API 获取
		};

		// 转换为后端存储格式
		const accountData = convertWindsurfToAccountData(windsurfAccount);

		// 保存账号
		console.log("正在保存账号...", accountData.email);
		await invoke("add_account", { data: accountData });

		await showAlert("添加成功", `账号 ${accountData.email} 已添加`, "success");

		// 刷新账号列表
		await loadWindsurfAccountsPage();

	} catch (error) {
		console.error("新增账号失败:", error);
		await showAlert("添加失败", `无法添加账号：${error}`, "error");
	}
}

/**
 * 处理导出所有账号
 */
async function handleExportAllAccounts() {
	try {
		const storage = await invoke("get_accounts");

		if (storage.accounts.length === 0) {
			await showAlert("导出失败", "没有可导出的账号数据", "error");
			return;
		}

		// 转换为 Windsurf 格式
		const windsurfAccounts = storage.accounts.map(convertAccountDataToWindsurf);

		// 构造导出数据（参考 JSON 文件格式）
		const exportData = {
			exportTime: new Date().toISOString(),
			exportTimeLocal: new Date().toLocaleString("zh-CN"),
			totalCount: windsurfAccounts.length,
			accounts: windsurfAccounts,
		};

		// 转换为 JSON 字符串
		const jsonData = JSON.stringify(exportData, null, 2);

		// 生成默认文件名
		const defaultFileName = `windsurf-accounts-${Date.now()}.json`;

		// 调用后端打开保存对话框
		const savedPath = await invoke("save_file_dialog", {
			defaultName: defaultFileName,
			content: jsonData
		});

		if (savedPath) {
			await showAlert(
				"导出成功",
				`已导出 ${windsurfAccounts.length} 个账号\n\n保存位置：${savedPath}`,
				"success"
			);
		} else {
			console.log("用户取消了保存");
		}

	} catch (error) {
		console.error("导出账号失败:", error);
		await showAlert("导出失败", error.toString(), "error");
	}
}

/**
 * 处理导入账号
 */
async function handleImportAccount() {
	const fileInput = document.querySelector("#account-file-input");
	if (fileInput) {
		fileInput.click();
	}
}

/**
 * 处理文件选择
 */
async function handleFileSelect(event) {
	const file = event.target.files[0];
	if (!file) {
		return;
	}

	try {
		// 读取文件内容
		const fileContent = await file.text();

		// 解析 JSON
		let data;
		try {
			data = JSON.parse(fileContent);
		} catch (parseError) {
			await showAlert("导入失败", "无效的 JSON 格式", "error");
			return;
		}

		// 判断数据格式
		let accounts = [];

		if (data.accounts && Array.isArray(data.accounts)) {
			// Windsurf 导出格式：{exportTime, totalCount, accounts: [...]}
			accounts = data.accounts;
			console.log(`检测到 Windsurf 导出格式，共 ${accounts.length} 个账号`);
		} else if (Array.isArray(data)) {
			// 数组格式：[{...}, {...}]
			accounts = data;
			console.log(`检测到数组格式，共 ${accounts.length} 个账号`);
		} else if (data.email && (data.apiKey || data.refreshToken)) {
			// 单个 Windsurf 账号对象
			accounts = [data];
			console.log("检测到单个账号对象");
		} else if (data.email && data.access_token) {
			// 后端 AccountData 格式
			accounts = [data];
			console.log("检测到后端 AccountData 格式");
		} else {
			await showAlert(
				"导入失败",
				"JSON 格式不正确\n\n支持以下格式：\n• Windsurf 导出格式：{\"accounts\":[...]}\n• 账号数组：[{...}, {...}]\n• 单个账号对象：{email, apiKey, ...}",
				"error"
			);
			return;
		}

		// 验证并转换账号数据
		const validAccounts = [];
		for (const acc of accounts) {
			// 检查是否为 Windsurf 格式
			if (acc.email && (acc.apiKey || acc.refreshToken)) {
				validAccounts.push(convertWindsurfToAccountData(acc));
			} else if (acc.email && acc.access_token) {
				// 已经是后端格式，直接使用
				validAccounts.push(acc);
			} else {
				console.warn("跳过无效账号:", acc);
			}
		}

		if (validAccounts.length === 0) {
			await showAlert("导入失败", "没有找到有效的账号数据", "error");
			return;
		}

		// 调用后端导入
		const result = await invoke("import_accounts", { accounts: validAccounts });

		// 显示成功提示
		await showAlert("导入成功", result, "success");

		// 刷新页面
		await loadWindsurfAccountsPage();

	} catch (error) {
		console.error("导入账号失败:", error);
		await showAlert("导入失败", error.toString(), "error");
	} finally {
		// 清空文件输入，允许再次选择相同文件
		const fileInput = document.querySelector("#account-file-input");
		if (fileInput) {
			fileInput.value = "";
		}
	}
}

/**
 * 重置 Windsurf 机器码
 */
async function handleResetWindsurfDevice() {
	try {
		console.log("🔄 开始重置 Windsurf 机器码...");

		// 显示确认对话框
		const confirmed = await showConfirm(
			"重置 Windsurf 机器码",
			"此操作将：\n\n1. 关闭 Windsurf 应用\n2. 删除所有缓存和临时文件\n3. 重置机器码\n\n确定要继续吗？",
			"warning"
		);

		if (!confirmed) {
			console.log("用户取消重置");
			return;
		}

		// 调用后端命令重置机器码
		console.log("📡 调用后端重置命令...");
		const result = await invoke("reset_windsurf_machine_id_cmd");

		console.log("✓ 机器码重置成功:", result);

		// 验证返回结果
		if (!result || !result.machine_id) {
			throw new Error("后端返回的机器码数据不完整");
		}

		// 显示成功提示（显示完整的机器码信息）
		const machineIdPreview = result.machine_id.length > 32
			? `${result.machine_id.substring(0, 32)}...`
			: result.machine_id;

		await showAlert(
			"重置成功",
			`Windsurf 机器码已重置！\n\n新的机器码：\n• Machine ID: ${machineIdPreview}\n• SQM ID: ${result.sqm_id || 'N/A'}\n• Device ID: ${result.dev_device_id || 'N/A'}\n• Machine ID File: ${result.machineid || 'N/A'}\n\n请重新启动 Windsurf 以使更改生效。`,
			"success"
		);
	} catch (error) {
		console.error("❌ 重置 Windsurf 机器码失败:", error);

		// 格式化错误消息
		const errorMsg = error?.message || error?.toString() || String(error);

		await showAlert(
			"重置失败",
			`无法重置 Windsurf 机器码：\n\n${errorMsg}\n\n请确保：\n1. Windsurf 已安装\n2. 有足够的文件访问权限\n3. Windsurf 未被其他程序占用`,
			"error"
		);
	}
}

/**
 * 选择 Windsurf 安装路径
 */
async function handleSelectWindsurfPath() {
	try {
		console.log("📂 打开 Windsurf 路径选择对话框...");

		// 调用后端命令打开文件选择对话框
		const pathInfo = await invoke("select_windsurf_exe");

		if (pathInfo && pathInfo.exe_path) {
			console.log("✓ Windsurf 路径已保存:", pathInfo.exe_path);

			// 更新显示
			const pathDisplay = document.querySelector("#windsurf-path-display");
			if (pathDisplay) {
				pathDisplay.value = pathInfo.exe_path;
				pathDisplay.placeholder = "";
			}

			// 显示成功提示
			await showAlert(
				"设置成功",
				`Windsurf 路径已设置：\n${pathInfo.exe_path}\n\n后续换号操作将使用此路径。`,
				"success"
			);
		}
	} catch (error) {
		console.error("❌ 选择 Windsurf 路径失败:", error);

		// 如果用户取消，不显示错误
		if (error.toString().includes("取消") || error.toString().includes("cancel")) {
			console.log("用户取消选择");
			return;
		}

		await showAlert(
			"选择失败",
			`无法设置 Windsurf 路径：\n${error}`,
			"error"
		);
	}
}

/**
 * 加载 Windsurf 安装路径
 */
async function loadWindsurfPath() {
	try {
		console.log("📂 加载 Windsurf 安装路径...");

		// 调用后端命令获取或检测 Windsurf 路径
		const pathInfo = await invoke("get_or_detect_windsurf_path_cmd");

		if (pathInfo && pathInfo.exe_path) {
			console.log("✓ Windsurf 路径:", pathInfo.exe_path);

			// 更新显示
			const pathDisplay = document.querySelector("#windsurf-path-display");
			if (pathDisplay) {
				pathDisplay.value = pathInfo.exe_path;
				pathDisplay.placeholder = "";
			}
		} else {
			console.log("⚠️ 未检测到 Windsurf 安装路径");
			const pathDisplay = document.querySelector("#windsurf-path-display");
			if (pathDisplay) {
				pathDisplay.placeholder = "未检测到 Windsurf，请手动设置路径";
			}
		}
	} catch (error) {
		console.error("❌ 加载 Windsurf 路径失败:", error);
		const pathDisplay = document.querySelector("#windsurf-path-display");
		if (pathDisplay) {
			pathDisplay.placeholder = "未检测到 Windsurf，请手动设置路径";
		}
	}
}

/**
 * 打开在线帮助文档
 * 在浏览器中打开腾讯文档的使用教程
 */
async function handleOpenTutorialDoc() {
	try {
		const tutorialUrl = "https://docs.qq.com/aio/DT0p2dU9jb3NUSnhH";
		console.log("正在打开在线帮助文档:", tutorialUrl);

		// 调用后端命令打开浏览器
		await invoke("open_url", { url: tutorialUrl });

		console.log("✓ 已在浏览器中打开帮助文档");

	} catch (error) {
		console.error("打开帮助文档失败:", error);
		await showAlert("打开失败", `无法打开浏览器：${error}`, "error");
	}
}

/**
 * 获取当前平台
 */
function getCurrentPlatform() {
	const platform = navigator.platform.toLowerCase();
	const userAgent = navigator.userAgent.toLowerCase();

	if (platform.includes('win') || userAgent.includes('win')) {
		return 'windows';
	} else if (platform.includes('mac') || userAgent.includes('mac')) {
		return 'macos';
	} else if (platform.includes('linux') || userAgent.includes('linux')) {
		return 'linux';
	}

	return 'windows'; // 默认
}

/**
 * 从API检查更新
 */
async function checkUpdateFromAPI() {
	const apiURL = `${window.AppConfig.api.baseURL}${window.AppConfig.api.endpoints.checkUpdate}`;
	const currentVersion = window.AppConfig.version;

	const response = await fetch(apiURL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			current_version: currentVersion,
			platform: getCurrentPlatform()
		})
	});

	if (!response.ok) {
		throw new Error(`HTTP 错误: ${response.status}`);
	}

	const data = await response.json();

	if (data.error) {
		throw new Error(data.message || data.error);
	}

	return data;
}

/**
 * 检查更新功能（手动触发）
 */
async function handleCheckUpdate() {
	const checkUpdateBtn = document.querySelector("#check-update-btn");
	const btnIcon = checkUpdateBtn.querySelector("svg");

	// 添加旋转动画
	btnIcon.style.animation = "rotate 1s linear infinite";
	checkUpdateBtn.disabled = true;

	try {
		console.log("手动检查更新...");

		const updateInfo = await checkUpdateFromAPI();

		// 处理更新信息
		if (updateInfo.has_update) {
			const message = `发现新版本 v${updateInfo.latest_version}！\n\n更新内容：\n${updateInfo.changelog || "暂无更新说明"}\n\n是否前往下载？`;
			const confirmed = await showConfirm("发现新版本", message);

			if (confirmed) {
				// 打开下载链接
				await invoke("open_url", { url: updateInfo.download_url });
			}
		} else {
			await showAlert("检查更新", `当前已是最新版本 v${updateInfo.current_version}`, "success");
		}
	} catch (error) {
		console.error("检查更新失败:", error);
		await showAlert("检查更新失败", `${error.message}\n\n请检查网络连接或稍后重试`, "error");
	} finally {
		// 恢复按钮状态
		btnIcon.style.animation = "";
		checkUpdateBtn.disabled = false;
	}
}

// ==================== 页面初始化 ====================

/**
 * 初始化版本显示
 */
function initVersionDisplay() {
	if (window.AppConfig) {
		const version = `v${window.AppConfig.version}`;

		// 更新关于页面的版本号
		const appVersionElement = document.querySelector("#app-version");
		if (appVersionElement) {
			appVersionElement.textContent = version;
		}

		// 更新关于页面底部的版本号
		const currentVersionElement = document.querySelector("#current-version");
		if (currentVersionElement) {
			currentVersionElement.textContent = version;
		}

		console.log(`  ✓ 版本号已更新为: ${version}`);
	}
}

/**
 * 处理刷新按钮点击
 */
async function handleWindsurfRefresh() {
	const refreshBtn = document.querySelector("#refresh-btn");
	const svg = refreshBtn.querySelector("svg");

	// 防止重复点击
	if (refreshBtn.disabled) {
		console.log("⚠️ 刷新操作进行中，请勿重复点击");
		return;
	}

	// 禁用按钮，防止重复点击
	refreshBtn.disabled = true;

	// 添加旋转动画
	svg.style.transform = "rotate(360deg)";

	try {
		console.log("🗑️ 清除缓存，强制刷新 Windsurf 数据");

		// 调用 Windsurf 的数据加载函数
		await loadWindsurfUsageData();

	} catch (error) {
		console.error("❌ 刷新失败:", error);
		await showAlert("提示", "Windsurf 未登录或刷新失败，请先登录 Windsurf", "info");
	} finally {
		// 恢复按钮状态
		refreshBtn.disabled = false;

		// 动画完成后重置
		setTimeout(() => {
			svg.style.transform = "rotate(0deg)";
		}, 300);
	}
}

// 页面加载完成后初始化
window.addEventListener("DOMContentLoaded", async () => {
	console.log("=== 🌊 [windsurf.js] Windsurf 模块初始化 ===");

	// 检查用户之前选择的 IDE，如果是 Cursor 则自动跳转
	console.log("📍 Step 0: 检查 IDE 配置...");
	const savedIde = getSelectedIde();
	console.log(`  - 当前保存的 IDE 配置: ${savedIde}`);

	if (savedIde === "cursor") {
		console.log("  ➜ 检测到用户选择了 Cursor，自动跳转到 index.html");
		window.location.href = "/index.html";
		return; // 停止后续初始化
	}

	console.log("  ✓ 当前配置为 Windsurf，继续加载 windsurf.html");

	// 调整 Windsurf 页面的窗口大小
	try {
		const { getCurrentWindow } = window.__TAURI__.window;
		const currentWindow = getCurrentWindow();

		const { LogicalSize } = window.__TAURI__.dpi;
		await currentWindow.setSize(new LogicalSize(1080, 720));
		await currentWindow.setMinSize(new LogicalSize(1000, 650));
		console.log("  ✓ 窗口大小已调整为 1080x720");
	} catch (error) {
		console.error("  ⚠ 调整窗口大小失败:", error);
	}

	// 确保 IDE 切换按钮状态正确设置为 windsurf
	const ideSwitchBtn = document.querySelector("#ide-switch-btn");
	if (ideSwitchBtn) {
		ideSwitchBtn.setAttribute("data-active", "windsurf");
		setSelectedIde("windsurf"); // 保存到 localStorage
		console.log("  ✓ IDE 状态已设置为: windsurf");
	}

	// 绑定 Windsurf 路径选择按钮事件
	const selectWindsurfPathBtn = document.querySelector("#select-windsurf-path-btn");
	if (selectWindsurfPathBtn) {
		selectWindsurfPathBtn.addEventListener("click", handleSelectWindsurfPath);
		console.log("  ✓ Windsurf 路径选择按钮已绑定");
	}

	// 绑定刷新按钮事件
	const refreshBtn = document.querySelector("#refresh-btn");
	if (refreshBtn) {
		refreshBtn.addEventListener("click", handleWindsurfRefresh);
		console.log("  ✓ Windsurf 刷新按钮已绑定");
	}

	// 绑定重置机器码按钮事件
	const resetDeviceBtn = document.querySelector("#reset-device-btn");
	if (resetDeviceBtn) {
		resetDeviceBtn.addEventListener("click", handleResetWindsurfDevice);
		console.log("  ✓ Windsurf 重置机器码按钮已绑定");
	}

	// 绑定检查更新按钮事件
	const checkUpdateBtn = document.querySelector("#check-update-btn");
	if (checkUpdateBtn) {
		checkUpdateBtn.addEventListener("click", handleCheckUpdate);
		console.log("  ✓ Windsurf 检查更新按钮已绑定");
	}

	// 绑定打开使用教程按钮事件
	const openTutorialDocBtn = document.querySelector("#open-tutorial-doc-btn");
	if (openTutorialDocBtn) {
		openTutorialDocBtn.addEventListener("click", handleOpenTutorialDoc);
		console.log("  ✓ Windsurf 打开使用教程按钮已绑定");
	}

	// 绑定自定义对话框事件按钮事件
	const dialogConfirm = document.querySelector("#dialog-confirm");
	const dialogCancel = document.querySelector("#dialog-cancel");
	const dialogClose = document.querySelector("#dialog-close");
	const dialogOverlay = document.querySelector("#custom-dialog");

	if (dialogConfirm) {
		dialogConfirm.addEventListener("click", () => {
			// 检查是否是表单对话框，如果是则不处理（交给 formConfirmHandler）
			const dialogForm = document.querySelector("#dialog-form");
			if (dialogForm && dialogForm.style.display !== "none") {
				return; // 表单对话框由 formConfirmHandler 处理
			}
			closeDialog(true);
		});
	}
	if (dialogCancel) {
		dialogCancel.addEventListener("click", () => {
			// 检查是否是表单对话框，如果是则不处理
			const dialogForm = document.querySelector("#dialog-form");
			if (dialogForm && dialogForm.style.display !== "none") {
				closeFormDialog(null); // 表单对话框直接关闭返回 null
				return;
			}
			closeDialog(false);
		});
	}
	if (dialogClose) {
		dialogClose.addEventListener("click", () => closeDialog(false));
	}
	if (dialogOverlay) {
		// 点击遮罩层关闭对话框
		dialogOverlay.addEventListener("click", (e) => {
			if (e.target === dialogOverlay) {
				closeDialog(false);
			}
		});
	}
	console.log("  ✓ 对话框按钮已绑定");

	// 初始加载 Windsurf 安装路径
	console.log("📍 加载 Windsurf 安装路径...");
	loadWindsurfPath();
	console.log("✓ Windsurf 路径加载完成");

	// 初始加载 Windsurf 使用数据
	console.log("📊 加载 Windsurf 使用数据...");
	loadWindsurfUsageData();

	// 初始化版本显示
	console.log("📍 初始化版本显示...");
	initVersionDisplay();

	// 绑定账号管理页面按钮事件
	const addAccountBtn = document.querySelector("#add-account-btn");
	if (addAccountBtn) {
		addAccountBtn.addEventListener("click", handleAddAccount);
		console.log("  ✓ 新增账号按钮已绑定");
	}

	const exportAllAccountsBtn = document.querySelector("#export-all-accounts-btn");
	if (exportAllAccountsBtn) {
		exportAllAccountsBtn.addEventListener("click", handleExportAllAccounts);
		console.log("  ✓ 导出账号按钮已绑定");
	}

	const importAccountBtn = document.querySelector("#import-account-btn");
	if (importAccountBtn) {
		importAccountBtn.addEventListener("click", handleImportAccount);
		console.log("  ✓ 导入账号按钮已绑定");
	}

	const refreshAccountsBtn = document.querySelector("#refresh-accounts-btn");
	if (refreshAccountsBtn) {
		refreshAccountsBtn.addEventListener("click", handleRefreshAccountsList);
		console.log("  ✓ 刷新账号列表按钮已绑定");
	}

	const fetchAllTokensBtn = document.querySelector("#fetch-all-tokens-btn");
	if (fetchAllTokensBtn) {
		fetchAllTokensBtn.addEventListener("click", handleFetchAllTokens);
		console.log("  ✓ 一键获取Token按钮已绑定");
	}

	// 绑定文件输入事件
	const accountFileInput = document.querySelector("#account-file-input");
	if (accountFileInput) {
		accountFileInput.addEventListener("change", handleFileSelect);
		console.log("  ✓ 账号文件输入已绑定");
	}

	// 监听页面切换事件
	window.addEventListener('pageSwitch', (e) => {
		const pageName = e.detail.pageName;
		console.log(`📄 [windsurf.js] 页面切换到: ${pageName}`);

		if (pageName === 'accounts') {
			loadWindsurfAccountsPage();
		} else if (pageName === 'dashboard') {
			// 切换到仪表盘时自动刷新账号信息
			console.log("  🔄 自动刷新仪表盘数据...");
			loadWindsurfUsageData();
		}
	});

	// 绑定账号详情弹窗的关闭按钮
	const detailDialogClose = document.querySelector("#detail-dialog-close");
	const detailDialogCloseBtn = document.querySelector("#detail-dialog-close-btn");
	const detailDialog = document.querySelector("#account-detail-dialog");

	if (detailDialogClose) {
		detailDialogClose.addEventListener("click", closeAccountDetail);
	}
	if (detailDialogCloseBtn) {
		detailDialogCloseBtn.addEventListener("click", closeAccountDetail);
	}
	if (detailDialog) {
		// 点击背景关闭
		detailDialog.addEventListener("click", (e) => {
			if (e.target === detailDialog) {
				closeAccountDetail();
			}
		});
	}

	// 绑定复制API Key按钮
	const copyApiKeyBtn = document.querySelector("#copy-detail-api-key");
	if (copyApiKeyBtn) {
		copyApiKeyBtn.addEventListener("click", copyDetailApiKey);
	}

	console.log("=== ✅ [windsurf.js] Windsurf 模块初始化完成 ===");
});
