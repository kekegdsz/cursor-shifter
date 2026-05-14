// 应用配置文件
const AppConfig = {
	// 应用版本信息
	version: "0.5.1",

	// API 配置
	api: {
		baseURL: "https://cursor.sxuan.top",
		endpoints: {
			checkUpdate: "/api/version/check",  // 检查更新接口
			latestVersion: "/api/version/latest", // 获取最新版本
		},
	},

	// 一键续杯：获取 Cursor AccessToken 的公开接口（实际请求由 Tauri 后端发起）
	cardRenewUrl: "https://undersky.tech/api/public/csk-card-renew",

	// 是否在界面中启用「切换到 Windsurf」；设为 false 时仅保留 Cursor，并阻止进入 windsurf 页面
	enableWindsurfIdeSwitch: false,

	// 应用信息
	appName: "Cursor-Shifter",
	appSubtitle: "Cursor 一键续杯换号助手",
	author: {
		qq: "1421148240"
	}
};

// 导出配置（兼容模块化和全局使用）
if (typeof module !== 'undefined' && module.exports) {
	module.exports = AppConfig;
} else {
	window.AppConfig = AppConfig;
}

