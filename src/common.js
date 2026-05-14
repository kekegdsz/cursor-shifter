// ==================== 通用功能模块 ====================
// 此文件包含 Cursor 和 Windsurf 共享的通用功能

// ==================== 导航相关 ====================

/**
 * 初始化导航菜单
 */
function initNavigation() {
	console.log("🎯 [initNavigation] 开始初始化...");
	const navItems = document.querySelectorAll(".nav-item");
	console.log(`  - 找到 ${navItems.length} 个导航项`);

	navItems.forEach((item, index) => {
		item.addEventListener("click", (e) => {
			e.preventDefault();

			// 移除所有导航项的活动状态
			navItems.forEach(nav => nav.classList.remove("active"));

			// 添加当前导航项的活动状态
			item.classList.add("active");

			// 获取页面类型
			const page = item.getAttribute("data-page");
			console.log(`  📌 导航项 ${index + 1} 被点击 -> page: "${page}"`);

			// 执行页面切换
			switchPage(page);
		});
	});

	console.log("✓ [initNavigation] 初始化完成");
}

/**
 * 页面切换函数
 * @param {string} pageName - 要切换到的页面名称
 */
function switchPage(pageName) {
	console.log(`📄 页面切换请求: ${pageName}`);
	const startTime = performance.now();

	// 获取所有页面内容容器
	const allPages = document.querySelectorAll(".page-content");
	console.log(`  - 找到 ${allPages.length} 个页面容器`);

	// 隐藏所有页面
	allPages.forEach(page => {
		page.classList.remove("active");
	});
	console.log("  ✓ 已隐藏所有页面");

	// 显示目标页面
	const targetPage = document.querySelector(`#page-${pageName}`);
	if (targetPage) {
		console.log(`  - 找到目标页面: #page-${pageName}`);
		targetPage.classList.add("active");
		console.log("  ✓ 目标页面已激活");

		// 触发页面加载事件（由各自的 main.js 或 windsurf.js 处理）
		const event = new CustomEvent('pageSwitch', { detail: { pageName } });
		window.dispatchEvent(event);

		const elapsed = performance.now() - startTime;
		console.log(`✓ 页面切换完成 (耗时: ${elapsed.toFixed(2)}ms)`);
	} else {
		console.warn(`❌ 页面不存在: #page-${pageName}`);
		// 如果页面不存在，显示仪表盘
		const dashboardPage = document.querySelector("#page-dashboard");
		if (dashboardPage) {
			console.log("  ➜ 回退到仪表盘页面");
			dashboardPage.classList.add("active");
		}
	}
}

// ==================== IDE 切换相关 ====================

function isWindsurfIdeSwitchEnabled() {
	return window.AppConfig?.enableWindsurfIdeSwitch !== false;
}

/**
 * 获取当前选中的 IDE
 * @returns {string} "cursor" 或 "windsurf"，默认为 "cursor"
 */
function getSelectedIde() {
	if (!isWindsurfIdeSwitchEnabled()) {
		return "cursor";
	}
	const stored = localStorage.getItem("selectedIde");
	return stored === "windsurf" ? "windsurf" : "cursor";
}

/**
 * 保存选中的 IDE
 * @param {string} ide - "cursor" 或 "windsurf"
 */
function setSelectedIde(ide) {
	let next = ide;
	if (!isWindsurfIdeSwitchEnabled() && next === "windsurf") {
		next = "cursor";
	}
	localStorage.setItem("selectedIde", next);
	console.log(`✓ IDE 选择已保存: ${next}`);
}

// 将函数暴露到全局作用域，供其他模块使用
window.getSelectedIde = getSelectedIde;
window.setSelectedIde = setSelectedIde;

/**
 * 处理 IDE 切换
 */
function handleIdeSwitch() {
	const ideSwitchBtn = document.querySelector("#ide-switch-btn");
	if (!ideSwitchBtn) {
		return;
	}
	const currentActive = ideSwitchBtn.getAttribute("data-active");

	// 切换状态
	const newActive = currentActive === "cursor" ? "windsurf" : "cursor";

	if (newActive === "windsurf" && !isWindsurfIdeSwitchEnabled()) {
		return;
	}

	// 保存到 localStorage
	setSelectedIde(newActive);

	console.log(`IDE 切换: ${currentActive} -> ${newActive}`);

	// 跳转到对应的 HTML 页面
	if (newActive === "windsurf") {
		window.location.href = "/windsurf.html";
	} else {
		window.location.href = "/index.html";
	}
}

// ==================== 侧边栏折叠 ====================

/**
 * 初始化侧边栏折叠功能
 */
function initSidebarToggle() {
	const menuToggle = document.querySelector("#menu-toggle");
	const sidebar = document.querySelector(".sidebar");

	if (menuToggle && sidebar) {
		menuToggle.addEventListener("click", () => {
			sidebar.classList.toggle("collapsed");
			console.log("侧边栏状态切换");
		});
	}
}

// ==================== 页面初始化 ====================

/**
 * 通用页面初始化
 */
window.addEventListener("DOMContentLoaded", () => {
	console.log("=== 🔧 [common.js] 通用模块初始化 ===");

	// 初始化导航
	initNavigation();

	// 初始化侧边栏折叠
	initSidebarToggle();

	// 初始化 IDE 切换按钮
	const ideSwitchBtn = document.querySelector("#ide-switch-btn");
	if (ideSwitchBtn) {
		const savedIde = getSelectedIde();
		ideSwitchBtn.setAttribute("data-active", savedIde);
		console.log(`  ✓ IDE 初始化为: ${savedIde}`);

		if (!isWindsurfIdeSwitchEnabled()) {
			const path = (window.location.pathname || "").toLowerCase();
			if (!path.includes("windsurf")) {
				ideSwitchBtn.closest(".ide-switch-container")?.classList.add("ide-switch--cursor-only");
			}
		}

		ideSwitchBtn.addEventListener("click", handleIdeSwitch);
		console.log("  ✓ IDE 切换按钮已绑定");
	}

	console.log("=== ✅ [common.js] 通用模块初始化完成 ===");
});
