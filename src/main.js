const { invoke } = window.__TAURI__.core;

// ==================== 性能优化：缓存系统 ====================

/**
 * API 响应缓存对象
 * 用于减少重复的 API 请求，提升性能
 */
const API_CACHE = {
  // 账号详细信息缓存
  accountDetail: {
    data: null,
    timestamp: 0,
    ttl: 30000, // 30秒缓存
    key: null // 存储缓存的 key（accessToken）
  },
  // Cursor 数据库账号缓存
  cursorAccount: {
    data: null,
    timestamp: 0,
    ttl: 5000 // 5秒缓存（数据库读取频繁）
  },
  // 账号列表缓存
  accountsList: {
    data: null,
    timestamp: 0,
    ttl: 10000 // 10秒缓存
  }
};

/**
 * 页面加载状态缓存
 * 记录每个页面是否已加载，避免重复加载
 */
const PAGE_LOAD_STATE = {
  backup: {
    loaded: false,
    timestamp: 0,
    ttl: 60000 // 备份列表 60秒缓存
  },
  accounts: {
    loaded: false,
    timestamp: 0,
    ttl: 30000 // 账号列表 30秒缓存
  },
  dashboard: {
    loaded: false,
    timestamp: 0,
    ttl: 0 // 仪表盘每次都加载（实时性要求高）
  }
};

/**
 * 通用缓存获取函数
 * @param {string} cacheKey - 缓存键名（API_CACHE 中的键）
 * @param {Function} fetchFn - 获取数据的异步函数
 * @param {boolean} forceRefresh - 是否强制刷新缓存
 * @param {string} dataKey - 数据唯一标识（如 accessToken）
 * @returns {Promise<any>} 缓存或新获取的数据
 */
async function getCachedData(cacheKey, fetchFn, forceRefresh = false, dataKey = null) {
  const cache = API_CACHE[cacheKey];

  if (!cache) {
    console.warn(`缓存键 "${cacheKey}" 不存在`);
    return await fetchFn();
  }

  const now = Date.now();
  const isCacheValid = cache.data && (now - cache.timestamp < cache.ttl);
  const isKeyMatch = !dataKey || cache.key === dataKey;

  // 检查缓存是否有效
  if (!forceRefresh && isCacheValid && isKeyMatch) {
    console.log(`使用缓存数据 [${cacheKey}]，剩余有效时间: ${Math.round((cache.ttl - (now - cache.timestamp)) / 1000)}s`);
    return cache.data;
  }

  // 缓存失效或强制刷新，重新获取数据
  console.log(`缓存失效或强制刷新 [${cacheKey}]，重新获取数据...`);
  const data = await fetchFn();

  // 更新缓存
  cache.data = data;
  cache.timestamp = now;
  if (dataKey) {
    cache.key = dataKey;
  }

  return data;
}

/**
 * 清除指定缓存
 * @param {string} cacheKey - 缓存键名，如果为 null 则清除所有缓存
 */
function clearCache(cacheKey = null) {
  if (cacheKey) {
    if (API_CACHE[cacheKey]) {
      API_CACHE[cacheKey].data = null;
      API_CACHE[cacheKey].timestamp = 0;
      API_CACHE[cacheKey].key = null;
      console.log(`已清除缓存 [${cacheKey}]`);
    }
  } else {
    // 清除所有缓存
    Object.keys(API_CACHE).forEach(key => {
      API_CACHE[key].data = null;
      API_CACHE[key].timestamp = 0;
      if (API_CACHE[key].key !== undefined) {
        API_CACHE[key].key = null;
      }
    });
    console.log('已清除所有缓存');
  }
}

/**
 * 检查页面是否需要重新加载
 * @param {string} pageName - 页面名称
 * @returns {boolean} true 表示需要加载，false 表示使用缓存
 */
function shouldLoadPage(pageName) {
  const pageState = PAGE_LOAD_STATE[pageName];

  if (!pageState) {
    console.log(`页面 "${pageName}" 无缓存配置，默认加载`);
    return true;
  }

  // TTL 为 0 表示每次都加载（如仪表盘）
  if (pageState.ttl === 0) {
    return true;
  }

  const now = Date.now();
  const isExpired = !pageState.loaded || (now - pageState.timestamp >= pageState.ttl);

  if (isExpired) {
    console.log(`页面 "${pageName}" 缓存已过期，需要加载`);
    return true;
  }

  const remainingTime = Math.round((pageState.ttl - (now - pageState.timestamp)) / 1000);
  console.log(`页面 "${pageName}" 使用缓存，剩余有效时间: ${remainingTime}s`);
  return false;
}

/**
 * 标记页面已加载
 * @param {string} pageName - 页面名称
 */
function markPageLoaded(pageName) {
  const pageState = PAGE_LOAD_STATE[pageName];

  if (pageState) {
    pageState.loaded = true;
    pageState.timestamp = Date.now();
    console.log(`页面 "${pageName}" 已标记为已加载`);
  }
}

/**
 * 清除页面加载状态
 * @param {string} pageName - 页面名称，如果为 null 则清除所有页面状态
 */
function clearPageState(pageName = null) {
  if (pageName) {
    const pageState = PAGE_LOAD_STATE[pageName];
    if (pageState) {
      pageState.loaded = false;
      pageState.timestamp = 0;
      console.log(`已清除页面状态 [${pageName}]`);
    }
  } else {
    Object.keys(PAGE_LOAD_STATE).forEach(key => {
      PAGE_LOAD_STATE[key].loaded = false;
      PAGE_LOAD_STATE[key].timestamp = 0;
    });
    console.log('已清除所有页面状态');
  }
}

// ==================== 性能优化：数据库读取缓存 ====================

/**
 * 获取 Cursor 当前账号（带缓存）
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Promise<Object>} 当前账号信息
 */
async function getCursorCurrentAccount(forceRefresh = false) {
  return getCachedData(
    'cursorAccount',
    async () => await invoke("get_current_cursor_account_cmd"),
    forceRefresh
  );
}

/**
 * 获取账号详细信息（带缓存）
 * @param {string} accessToken - 访问令牌
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Promise<Object>} 账号详细信息
 */
async function getAccountDetailInfo(accessToken, forceRefresh = false) {
  return getCachedData(
    'accountDetail',
    async () => await invoke("get_account_detail_info", { accessToken }),
    forceRefresh,
    accessToken // 使用 accessToken 作为缓存 key
  );
}

// 页面加载完成后初始化
window.addEventListener("DOMContentLoaded", async () => {
  console.log("=== DOMContentLoaded 事件触发 ===");
  console.log("时间戳:", new Date().toLocaleTimeString());

  // 恢复 Cursor 页面的窗口大小（如果从 Windsurf 切换过来）
  try {
    const { getCurrentWindow } = window.__TAURI__.window;
    const currentWindow = getCurrentWindow();

    const { LogicalSize } = window.__TAURI__.dpi;
    await currentWindow.setSize(new LogicalSize(900, 720));
    await currentWindow.setMinSize(new LogicalSize(800, 600));
    console.log("  ✓ 窗口大小已恢复为 900x720");
  } catch (error) {
    console.error("  ⚠ 调整窗口大小失败:", error);
  }

  // 检查用户之前选择的 IDE，如果是 Windsurf 则自动跳转
  console.log("📍 Step 0: 检查 IDE 配置...");
  const savedIde = window.getSelectedIde();
  console.log(`  - 当前保存的 IDE 配置: ${savedIde}`);

  if (savedIde === "windsurf") {
    console.log("  ➜ 检测到用户选择了 Windsurf，自动跳转到 windsurf.html");
    window.location.href = "/windsurf.html";
    return; // 停止后续初始化
  }

  console.log("  ✓ 当前配置为 Cursor，继续加载 index.html");

  // 绑定导航菜单事件
  console.log("📍 Step 1: 初始化导航菜单...");
  initNavigation();
  console.log("✓ 导航菜单初始化完成");

  // 设置验证码监听器（页面加载时就设置好）
  console.log("📍 Step 2: 设置验证码监听器...");
  setupVerificationCodeListener();
  console.log("✓ 验证码监听器设置完成");

  // 绑定刷新按钮事件
  console.log("📍 Step 3: 绑定按钮事件...");
  const refreshBtn = document.querySelector("#refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", handleRefresh);
    console.log("  ✓ 刷新按钮已绑定");
  }

  // IDE 切换由 common.js 统一绑定；此处仅同步 Cursor 页的展示状态
  const ideSwitchBtn = document.querySelector("#ide-switch-btn");
  if (ideSwitchBtn) {
    ideSwitchBtn.setAttribute("data-active", "cursor");
    window.setSelectedIde("cursor");
    console.log(`  ✓ IDE 状态已设置为: cursor`);
  }

  // 绑定一键换号按钮事件
  const switchAccountBtn = document.querySelector("#switch-account-btn");
  if (switchAccountBtn) {
    switchAccountBtn.addEventListener("click", handleSwitchAccount);
    console.log("  ✓ 一键换号按钮已绑定");
  }

  // ...existing code... (其他按钮绑定)

  const resetDeviceBtn = document.querySelector("#reset-device-btn");
  if (resetDeviceBtn) {
    resetDeviceBtn.addEventListener("click", handleResetDevice);
  }

  const checkUpdateBtn = document.querySelector("#check-update-btn");
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener("click", handleCheckUpdate);
  }

  const buyAccountBtn = document.querySelector("#buy-account-btn");
  if (buyAccountBtn) {
    buyAccountBtn.addEventListener("click", handleBuyAccount);
  }

  // 教程页面 - 打开在线文档按钮
  const openTutorialDocBtn = document.querySelector("#open-tutorial-doc-btn");
  if (openTutorialDocBtn) {
    openTutorialDocBtn.addEventListener("click", handleOpenTutorialDoc);
  }

  const menuToggle = document.querySelector("#menu-toggle");
  if (menuToggle) {
    menuToggle.addEventListener("click", handleMenuToggle);
  }

  const createBackupBtn = document.querySelector("#create-backup-btn");
  if (createBackupBtn) {
    createBackupBtn.addEventListener("click", handleCreateBackup);
  }

  const refreshBackupsBtn = document.querySelector("#refresh-backups-btn");
  if (refreshBackupsBtn) {
    refreshBackupsBtn.addEventListener("click", handleRefreshBackups);
  }

  const addAccountBtn = document.querySelector("#add-account-btn");
  if (addAccountBtn) {
    addAccountBtn.addEventListener("click", handleAddAccount);
  }

  const importAccountBtn = document.querySelector("#import-account-btn");
  if (importAccountBtn) {
    importAccountBtn.addEventListener("click", handleImportAccount);
  }

  const refreshAccountsBtn = document.querySelector("#refresh-accounts-btn");
  if (refreshAccountsBtn) {
    refreshAccountsBtn.addEventListener("click", handleRefreshAccounts);
  }

  const copyTokenBtn = document.querySelector("#copy-token-btn");
  if (copyTokenBtn) {
    copyTokenBtn.addEventListener("click", handleCopyToken);
  }

  const copyMachineGuidBtn = document.querySelector("#copy-machine-guid-btn");
  if (copyMachineGuidBtn) {
    copyMachineGuidBtn.addEventListener("click", handleCopyMachineGuid);
  }

  const exportAccountBtn = document.querySelector("#export-account-btn");
  if (exportAccountBtn) {
    exportAccountBtn.addEventListener("click", handleExportAccount);
  }

  // 绑定设置 Cursor 路径按钮
  const selectCursorPathBtn = document.querySelector("#select-cursor-path-btn");
  if (selectCursorPathBtn) {
    selectCursorPathBtn.addEventListener("click", handleSelectCursorPath);
    console.log("  ✓ 设置 Cursor 路径按钮已绑定");
  }

  const deleteAccountBtn = document.querySelector("#delete-account-btn");
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", handleDeleteAccount);
  }

  const exportAllAccountsBtn = document.querySelector("#export-all-accounts-btn");
  if (exportAllAccountsBtn) {
    exportAllAccountsBtn.addEventListener("click", handleExportAllAccounts);
  }

  const accountFileInput = document.querySelector("#account-file-input");
  if (accountFileInput) {
    accountFileInput.addEventListener("change", handleFileSelect);
  }

  console.log("✓ 所有按钮事件已绑定");

  // 初始化自定义弹窗
  console.log("📍 Step 4: 初始化自定义弹窗...");
  initCustomDialog();
  console.log("✓ 自定义弹窗初始化完成");

  // 初始化版本显示
  console.log("📍 Step 5: 初始化版本显示...");
  initVersionDisplay();
  console.log("✓ 版本显示初始化完成");

  const openCursorLoginBtn = document.querySelector("#open-cursor-login-btn");
  if (openCursorLoginBtn) {
    openCursorLoginBtn.addEventListener("click", handleOpenCursorLogin);
  }

  const parseSessionTokenBtn = document.querySelector("#parse-session-token-btn");
  if (parseSessionTokenBtn) {
    parseSessionTokenBtn.addEventListener("click", handleParseSessionToken);
  }

  const disableHttp2Btn = document.querySelector("#disable-http2-btn");
  if (disableHttp2Btn) {
    disableHttp2Btn.addEventListener("click", handleDisableHttp2);
  }

  const enableHttp2Btn = document.querySelector("#enable-http2-btn");
  if (enableHttp2Btn) {
    enableHttp2Btn.addEventListener("click", handleEnableHttp2);
  }

  const setProxyBtn = document.querySelector("#set-proxy-btn");
  if (setProxyBtn) {
    setProxyBtn.addEventListener("click", handleSetProxy);
  }

  const removeProxyBtn = document.querySelector("#remove-proxy-btn");
  if (removeProxyBtn) {
    removeProxyBtn.addEventListener("click", handleRemoveProxy);
  }

  const togglePrivacyBtn = document.querySelector("#toggle-privacy-btn");
  if (togglePrivacyBtn) {
    togglePrivacyBtn.addEventListener("click", handleTogglePrivacy);
  }

  const toggleUpdateDisableBtn = document.querySelector("#toggle-update-disable-btn");
  if (toggleUpdateDisableBtn) {
    toggleUpdateDisableBtn.addEventListener("click", handleToggleDisableUpdate);
  }

  const unlimitedQuotaBtn = document.querySelector("#unlimited-quota-btn");
  if (unlimitedQuotaBtn) {
    unlimitedQuotaBtn.addEventListener("click", handleUnlimitedQuota);
  }

  const clearLogBtn = document.querySelector("#clear-log-btn");
  if (clearLogBtn) {
    clearLogBtn.addEventListener("click", handleClearLog);
  }

  const testSmsBtn = document.querySelector("#test-sms-btn");
  if (testSmsBtn) {
    testSmsBtn.addEventListener("click", handleTestSms);
  }

  const testAddressBtn = document.querySelector("#test-address-btn");
  if (testAddressBtn) {
    testAddressBtn.addEventListener("click", handleTestAddress);
  }

  console.log("✓ 所有按钮事件绑定完成");

  // 初始化邮箱隐私状态显示
  console.log("📍 Step 6: 初始化邮箱隐私状态...");
  updatePrivacyStatus();
  console.log("✓ 邮箱隐私状态初始化完成");

  // 初始加载数据（异步执行，不阻塞页面渲染）
  console.log("📍 Step 7: 异步加载使用情况数据...");
  setTimeout(() => {
    console.log("⏳ 开始执行 loadUsageData (延迟100ms)...");
    loadUsageData().catch(error => {
      console.error("❌ 初始数据加载失败:", error);
    }).finally(() => {
      console.log("✓ loadUsageData 执行完成（成功或失败）");
    });
  }, 100);

  // 初始加载 Cursor 安装路径
  console.log("📍 Step 8: 加载 Cursor 安装路径...");
  loadCursorPath();
  console.log("✓ Cursor 路径加载完成");

  // 启动时自动检查更新（异步执行，不阻塞页面渲染）
  console.log("📍 Step 8: 异步检查更新...");
  setTimeout(() => {
    console.log("⏳ 开始执行 checkUpdateOnStartup (延迟500ms)...");
    checkUpdateOnStartup().catch(error => {
      console.error("❌ 启动检查更新失败:", error);
    }).finally(() => {
      console.log("✓ checkUpdateOnStartup 执行完成（成功或失败）");
    });
  }, 500);

  console.log("=== ✅ DOMContentLoaded 事件处理完成 ===");
});

// 初始化导航菜单
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

    // 检查是否需要加载页面数据（使用缓存机制）

    // 如果切换到备份页面，按需加载备份列表
    if (pageName === "backup") {
      if (shouldLoadPage("backup")) {
        console.log("  📍 触发: 加载备份列表");
        loadBackupList();
      }
    }

    // 如果切换到仪表盘页面，自动加载账号信息（实时性要求高，每次都加载）
    if (pageName === "dashboard") {
      console.log("  📍 触发: 加载使用情况数据");
      loadUsageData();
    }

    // 如果切换到账号管理页面，按需加载账号信息
    if (pageName === "accounts") {
      if (shouldLoadPage("accounts")) {
        console.log("  📍 触发: 加载账号管理页面");
        loadAccountsPage();
      }
    }

    // 如果切换到工具页面，更新状态显示（轻量操作，不需要缓存）
    if (pageName === "tools") {
      console.log("  📍 触发: 更新工具页面状态");
      updatePrivacyStatus();
      loadDisableUpdateStatus();
    }

    // 如果切换到无感换号页面，初始化页面
    if (pageName === "seamless") {
      console.log("  📍 触发: 初始化无感换号页面");
      initSeamlessPage();
    }

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

// 刷新使用情况数据
async function handleRefresh() {
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
    // 清除所有缓存和页面状态，强制刷新
    console.log("🗑️ 清除所有缓存和页面状态，强制从服务器获取最新数据");
    clearCache();
    clearPageState();

    // 直接从 Cursor 数据库读取当前账号（强制刷新）
    const cursorAccount = await getCursorCurrentAccount(true);
    console.log("✓ 刷新：从 Cursor 数据库读取到账号:", cursorAccount.email);

    // 使用 AccessToken 获取账号信息（强制刷新）
    await loadAccountInfo(cursorAccount.access_token, true);

  } catch (dbError) {
    console.log("ℹ Cursor 数据库读取失败:", dbError);
    await showAlert("提示", "Cursor 未登录，请先登录 Cursor", "info");
  } finally {
    // 恢复按钮状态
    refreshBtn.disabled = false;

    // 动画完成后重置
    setTimeout(() => {
      svg.style.transform = "rotate(0deg)";
    }, 300);
  }
}

// 存储当前的账号列表（内存缓存）
let cachedAccountsStorage = null;

// 从本地文件加载账号列表
async function loadLocalAccountsStorage() {
  try {
    const storage = await invoke("get_accounts");
    console.log("✓ 已从本地加载账号列表:", storage.accounts.length, "个账号");
    cachedAccountsStorage = storage;
    return storage;
  } catch (error) {
    console.log("ℹ 本地暂无账号数据:", error);
    return { current_account: null, accounts: [] };
  }
}

// 加载使用情况数据（带超时保护）
async function loadUsageData() {
  const totalTimeout = 15000; // 总体 15 秒超时（提高容错）
  const cursorDbTimeout = 3000; // Cursor 数据库读取 3 秒超时（快速失败）
  console.log(`\n=== 🔄 [loadUsageData] 开始 (总超时: ${totalTimeout}ms, 数据库超时: ${cursorDbTimeout}ms) ===`);
  const startTime = performance.now();

  try {
    // 使用 Promise.race 实现超时保护
    console.log("  ⏳ 等待数据加载...");
    await Promise.race([
      (async () => {
        try {
          // 1. 尝试直接从 Cursor 官方数据库读取当前账号（带独立超时）
          console.log(`  📍 Step 1: 调用 getCursorCurrentAccount (带缓存, ${cursorDbTimeout}ms 超时)...`);
          const cursorAccount = await Promise.race([
            getCursorCurrentAccount(), // 使用缓存版本
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Cursor 数据库读取超时")), cursorDbTimeout)
            ),
          ]);
          console.log("  ✓ Step 2: 从 Cursor 数据库读取到账号:", cursorAccount.email);

          // 2. 使用 AccessToken 获取详细账号信息
          console.log("  📍 Step 3: 调用 loadAccountInfo 获取详细信息...");
          await loadAccountInfo(cursorAccount.access_token);
          console.log("  ✓ Step 4: 账号信息加载完成");
        } catch (error) {
          // get_current_cursor_account_cmd 失败，意味着 Cursor 未登录或数据库无法访问
          console.log("  ⚠️ Cursor 未登录或数据库读取失败:", error.message);
          // 直接显示未登录状态，不从账号列表读取
          console.log("  ⚠️ 显示 Cursor 未登录状态");
          throw new Error("Cursor未登录");
        }
      })(),
      new Promise((_, reject) => {
        setTimeout(() => {
          console.error(`  ❌ 数据加载总超时 (${totalTimeout}ms)`);
          reject(new Error(`数据加载超时 (${totalTimeout}ms)`));
        }, totalTimeout);
      }),
    ]);

    const elapsed = performance.now() - startTime;
    console.log(`✓ [loadUsageData] 成功完成 (耗时: ${elapsed.toFixed(2)}ms)\n`);

  } catch (error) {
    // 统一处理所有错误（超时、无账号、invoke失败等）
    console.error(`❌ [loadUsageData] 最终失败 (${error.message})`);

    // 判断错误类型，显示不同的提示
    const isCursorNotLoggedIn = error.message.includes("Cursor未登录") ||
      error.message.includes("Cursor 未登录或数据库中没有账号信息");

    // 显示默认的空或错误状态
    console.log("  📍 显示默认状态...");

    // 根据错误类型显示不同的提示信息
    let statusMessage = "Cursor未登录";
    let infoMessage = "请先登录 Cursor";

    // 如果是 Cursor 未登录，统一显示"Cursor未登录"
    if (isCursorNotLoggedIn) {
      statusMessage = "Cursor未登录";
      infoMessage = "请先登录 Cursor";
    } else if (error.message.includes("数据库读取超时") ||
      error.message.includes("数据库连接失败") ||
      error.message.includes("数据库读取失败") ||
      error.message.includes("Cursor 数据库被锁定")) {
      statusMessage = "数据库连接失败，请登录 Cursor";
      infoMessage = "数据库连接失败，请登录 Cursor";
    } else if (error.message.includes("数据加载超时")) {
      statusMessage = "加载超时";
      infoMessage = "数据加载超时，请重试";
    }

    updateAccountDisplay({
      user_id: "unknown",
      email: infoMessage,
      name: statusMessage,
      subscription: "Free",
      status: statusMessage,
      token_preview: "N/A",
    });
    // 确保用量统计也显示为0或隐藏
    const usageStatsDiv = document.querySelector("#usage-statistics");
    if (usageStatsDiv) usageStatsDiv.style.display = "none";

    const elapsed = performance.now() - startTime;
    console.log(`✓ [loadUsageData] 错误处理完成 (耗时: ${elapsed.toFixed(2)}ms)\n`);
  }
}

// 加载真实账号信息
async function loadAccountInfo(accessToken, forceRefresh = false) {
  console.log("🔄 [loadAccountInfo] 开始...");
  const startTime = performance.now();

  try {
    console.log("  📍 Step 1: 准备调用 getAccountDetailInfo (带缓存, 5s 超时)...");

    // 给 API 调用设置 5 秒超时，避免卡住太久
    const accountDetailInfo = await Promise.race([
      getAccountDetailInfo(accessToken, forceRefresh), // 使用缓存版本
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("API 调用超时 (5000ms)")), 5000)
      ),
    ]);

    console.log("  ✓ Step 2: 成功获取账号详细信息:", accountDetailInfo);

    // 更新页面显示（包含试用期）
    console.log("  📍 Step 3: 调用 updateAccountDisplayWithTrial...");
    updateAccountDisplayWithTrial(accountDetailInfo);
    console.log("  ✓ Step 4: 页面已更新");

  } catch (error) {
    console.error("  ⚠️ 获取账号详细信息失败 (非致命):", error.message);

    // 降级：尝试只获取基本信息
    try {
      console.log("  📍 降级尝试: 调用 get_account_info (带 3s 超时)...");
      const accountInfo = await Promise.race([
        invoke("get_account_info", { accessToken }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("基本信息API超时 (3000ms)")), 3000)
        ),
      ]);
      console.log("  ✓ 成功获取基本账号信息:", accountInfo);
      updateAccountDisplay(accountInfo);
    } catch (fallbackError) {
      console.error("  ⚠️ 降级获取基本信息也失败 (非致命):", fallbackError.message);

      // 最终降级：仅显示 Token 预览（不阻塞 UI）
      console.log("  📍 显示 Token 预览状态（最小化信息）...");

      // 尝试解析 Token 的基本信息
      let tokenEmail = "未知邮箱";
      try {
        // 假设 accessToken 格式为 JWT，可以解析出邮箱
        const tokenParts = accessToken.split(".");
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          tokenEmail = payload.email || payload.sub || "未知邮箱";
        }
      } catch (e) {
        console.log("    ⚠️ Token 解析失败，使用默认值");
      }

      updateAccountDisplay({
        user_id: "unknown",
        email: tokenEmail,
        name: "网络连接失败",
        subscription: "Unknown",
        status: "⚠️cursor官方API连接失败,请检查网络连接",
        token_preview: accessToken.substring(0, 20) + "...",
        expires_at: null,
        updated_at: null
      });

      // 显示友好提示（不阻塞）
      console.warn("  💡 提示: API 暂时无法连接，已切换到本地模式。部分功能可能受限。");
    }
  }

  const elapsed = performance.now() - startTime;
  console.log(`✓ [loadAccountInfo] 完成 (耗时: ${elapsed.toFixed(2)}ms)`);

  // 加载 Machine GUID（独立异步执行，不阻塞主流程）
  loadMachineGuid();
}

/**
 * 加载 Machine GUID
 */
async function loadMachineGuid() {
  try {
    console.log("  📍 加载 Machine GUID...");
    const machineGuid = await invoke("get_machine_guid_cmd");
    console.log("  ✓ Machine GUID:", machineGuid);

    // 更新显示
    const machineGuidElement = document.querySelector("#machine-guid");
    if (machineGuidElement) {
      machineGuidElement.textContent = machineGuid || "未读取到";
      machineGuidElement.title = machineGuid || "无法读取 Windows 注册表 MachineGuid";
    }
  } catch (error) {
    console.error("  ⚠️ 读取 Machine GUID 失败:", error);
    const machineGuidElement = document.querySelector("#machine-guid");
    if (machineGuidElement) {
      machineGuidElement.textContent = "读取失败";
      machineGuidElement.title = `无法读取: ${error}`;
    }
  }
}

/**
 * 计算Pro/Ultra专业版的剩余天数（基于更新时间）
 * 注意：此函数已废弃，后端已实现完整的回退计算逻辑
 * 后端会使用 billingCycleStart + 7天 作为回退方案
 * 前端应直接使用后端返回的 days_remaining 字段
 * @param {Object} info - 账号详细信息
 * @returns {number|null} 剩余天数，如果无法计算返回null
 * @deprecated 请直接使用后端返回的 days_remaining
 */
function calculateProUltraRemainingDays(info) {
  console.warn("calculateProUltraRemainingDays 已废弃，应使用后端返回的 days_remaining");

  // 兜底逻辑：如果前端真的需要计算（不应该发生）
  if (info.updated_at || info.created_at) {
    const updateTime = new Date(info.updated_at || info.created_at);
    const now = new Date();
    const expiryTime = new Date(updateTime.getTime() + 7 * 24 * 60 * 60 * 1000);
    const diffTime = expiryTime - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return null;
}

// 更新账号信息显示（带试用期数据）
function updateAccountDisplayWithTrial(detailInfo) {
  const membershipType = detailInfo.membership_type;

  // 根据会员类型确定套餐显示文本
  let subscriptionText = "未知";
  if (membershipType === "free") {
    subscriptionText = "仅auto";
  } else if (membershipType === "pro") {
    subscriptionText = "Pro 专业版";
  } else if (membershipType === "ultra") {
    subscriptionText = "Ultra 超级版";
  } else if (membershipType === "pro_plus") {
    subscriptionText = "ProPlus 专业版";
  } else if (membershipType === "free_trial") {
    subscriptionText = "Pro 试用版";
  } else {
    subscriptionText = "未知";
  }

  // 提取基本信息，覆盖 subscription
  const accountInfo = {
    user_id: detailInfo.user_id || detailInfo.account_info?.user_id,
    email: detailInfo.email || detailInfo.account_info?.email,
    name: detailInfo.name || detailInfo.account_info?.name,
    subscription: subscriptionText,
    status: detailInfo.status || detailInfo.account_info?.status,
    token_preview: detailInfo.token_preview || detailInfo.account_info?.token_preview,
  };

  // 调用基本更新函数
  updateAccountDisplay(accountInfo);

  // 更新试用期/使用期显示
  const statusBadge = document.querySelector(".status-badge");
  const statusLabel = document.querySelector(".status-label");
  const progressFill = document.querySelector(".progress-fill");
  const progressLabel = document.querySelector(".progress-label");

  if (statusBadge && statusLabel && progressFill && progressLabel) {
    const daysRemaining = detailInfo.days_remaining || 0;
    let isExpired = detailInfo.is_expired;

    // 根据会员类型设置显示
    if (membershipType === "free") {
      // Free 用户
      statusBadge.textContent = "仅auto";
      statusBadge.className = "status-badge free";
      statusLabel.textContent = "仅auto";
      progressLabel.textContent = "无试用期，仅auto，大概每天两美刀额度";
      progressFill.style.width = "0%";
      progressFill.className = "progress-fill";
    } else if (membershipType === "pro") {
      // Pro 用户（付费）
      let calculatedDaysRemaining = daysRemaining;

      // 如果Pro专业版没有days_remaining字段，需要计算
      if (calculatedDaysRemaining === undefined || calculatedDaysRemaining === null) {
        const diffDays = calculateProUltraRemainingDays(detailInfo);

        if (diffDays !== null) {
          calculatedDaysRemaining = diffDays;
          // 如果计算出来是负数或0，设为0
          if (calculatedDaysRemaining <= 0) {
            calculatedDaysRemaining = 0;
            isExpired = true;
          }
        } else if (detailInfo.subscription_status === "past_due") {
          // 如果状态是past_due，说明已经过期
          calculatedDaysRemaining = 0;
          isExpired = true;
        } else {
          // 没有足够信息，假设还有7天
          calculatedDaysRemaining = 7;
        }
      }

      statusBadge.textContent = `剩余 ${calculatedDaysRemaining} 天`;
      statusBadge.className = "status-badge pro-plan";
      statusLabel.textContent = "Pro 使用期";
      progressLabel.textContent = "Pro 使用期";

      // 计算进度（7天总计）
      const progressPercent = Math.min((calculatedDaysRemaining / 7) * 100, 100);
      progressFill.style.width = `${progressPercent}%`;
      progressFill.className = isExpired ? "progress-fill expired-fill" : "progress-fill pro-fill";
    } else if (membershipType === "ultra" || membershipType === "pro_plus") {
      // Ultra 用户（付费）
      let calculatedDaysRemaining = daysRemaining;

      // 如果Ultra专业版没有days_remaining字段，需要计算
      if (calculatedDaysRemaining === undefined || calculatedDaysRemaining === null) {
        const diffDays = calculateProUltraRemainingDays(detailInfo);

        if (diffDays !== null) {
          calculatedDaysRemaining = diffDays;
          // 如果计算出来是负数或0，设为0
          if (calculatedDaysRemaining <= 0) {
            calculatedDaysRemaining = 0;
            isExpired = true;
          }
        } else if (detailInfo.subscription_status === "past_due") {
          // 如果状态是past_due，说明已经过期
          calculatedDaysRemaining = 0;
          isExpired = true;
        } else {
          // 没有足够信息，假设还有7天
          calculatedDaysRemaining = 7;
        }
      }

      statusBadge.textContent = `剩余 ${calculatedDaysRemaining} 天`;
      statusBadge.className = membershipType === "ultra" ? "status-badge ultra-plan" : "status-badge pro_plus-plan";
      statusLabel.textContent = membershipType === "ultra" ? "Ultra 使用期" : "ProPlus 使用期";
      progressLabel.textContent = membershipType === "ultra" ? "Ultra 使用期" : "ProPlus 使用期";

      // 计算进度（7天总计）
      const progressPercent = Math.min((calculatedDaysRemaining / 7) * 100, 100);
      progressFill.style.width = `${progressPercent}%`;
      progressFill.className = isExpired ? "progress-fill expired-fill" : "progress-fill ultra-fill";
    } else {
      // Pro Trial 用户（试用）
      statusBadge.textContent = `剩余 ${daysRemaining} 天`;
      statusBadge.className = "status-badge trial-plan";
      statusLabel.textContent = "Pro 试用期";
      progressLabel.textContent = "Pro 试用期";

      // 计算进度（7天总计）
      const progressPercent = Math.min((daysRemaining / 7) * 100, 100);
      progressFill.style.width = `${progressPercent}%`;
      progressFill.className = isExpired ? "progress-fill expired-fill" : "progress-fill trial-fill";
    }

    // 如果已过期，特殊处理
    if (isExpired && daysRemaining < 0) {
      statusBadge.textContent = "已过期";
      statusBadge.className = "status-badge expired";
      progressFill.style.width = "100%";
      progressFill.className = "progress-fill expired-fill";
    }
  }

  // 更新用量统计（仅 Pro 和 Pro Trial 显示）
  const usageStatsDiv = document.querySelector("#usage-statistics");
  const usageLabel = document.querySelector("#usage-label");
  const usageProgressFill = document.querySelector("#usage-progress-fill");

  if (usageStatsDiv && usageLabel && usageProgressFill) {
    // 只有 Pro、Ultra 和 Pro Trial 用户才显示用量统计
    if (membershipType === "pro" || membershipType === "ultra" || membershipType !== "free" || membershipType === "free_trial") {
      // API 返回的数据需要除以 100 转换为美元
      const usedRaw = detailInfo.usage_used || 0;           // 计划内已使用
      const limitRaw = detailInfo.usage_limit || 0;         // 计划内限额
      const bonusRaw = detailInfo.usage_overdraft || 0;     // 透支额度（bonus）

      // 转换为美元（除以100）
      const used = (usedRaw / 100).toFixed(2);
      const limit = (limitRaw / 100).toFixed(0);
      const bonus = (bonusRaw / 100).toFixed(2);

      // 计算总使用额度（total = used + bonus）
      const totalRaw = usedRaw + bonusRaw;
      const total = (totalRaw / 100).toFixed(2);

      // 显示用量统计
      let displayText;
      let usagePercent;

      // Ultra 订阅特殊处理（400$ 额度）
      if (membershipType === "ultra") {
        // Ultra 用户显示总使用量
        displayText = `用量统计：${total}$ / 400$ （建议用到 380$+ 再换号）`;
        usagePercent = Math.min((totalRaw / 40000) * 100, 100); // 400$ = 40000原始值
      } else if (membershipType === "pro_plus") {
        // ProPlus 用户显示总使用量
        displayText = `用量统计：${total}$ / 100$ （建议用到 70$+ 再换号）`;
        usagePercent = Math.min((totalRaw / 10000) * 100, 100); // 100$ = 10000原始值
      } else if (membershipType === "pro_trial" || membershipType === "free_trial") {
        // Pro Trial 单独逻辑
        if (Number(used) >= 10) {
          displayText = `用量统计：${total}$ / 10$（试用额度已用完，只能使用auto模式对话！）`;
        } else if (Number(used) >= 8 && Number(used) < 10) {
          displayText = `用量统计：${used}$ / 10$（试用额度快用完，建议使用auto模式还能对话！）`;
        } else {
          displayText = `用量统计：${used}$ / 10$`;
        }
        usagePercent = Math.min((usedRaw / 1000) * 100, 100); // 10$ = 1000原始值
      } else if (membershipType === "pro") {
        // Pro 会员逻辑
        // 判断是否已用完计划内额度
        if (usedRaw >= limitRaw) {
          // 已用完计划内额度，按总共70$为100%显示
          const maxTotalLimit = 7000; // 70$ = 7000原始值
          displayText = `用量统计：${total}$（${used}$ + ${bonus}$）/ 70$ （额外额度70$，额度用完在换号）`;
          usagePercent = Math.min((totalRaw / maxTotalLimit) * 100, 100);
        } else {
          // 未用完计划内额度，按 used/limit 显示
          displayText = `用量统计：${used}$ / ${limit}$ + ${bonus}$（额外额度在70$，请把额度用完在换号）`;
          usagePercent = Math.min((usedRaw / limitRaw) * 100, 100);
        }
      } else {
        // 其余类型，一律隐藏
        displayText = "";
        usagePercent = 0;
      }

      usageLabel.textContent = displayText;
      usageProgressFill.style.width = `${usagePercent}%`;

      // 根据使用情况设置颜色
      if (usagePercent >= 90) {
        usageProgressFill.className = "progress-fill usage-fill usage-high";
      } else if (usagePercent >= 70) {
        usageProgressFill.className = "progress-fill usage-fill usage-medium";
      } else {
        usageProgressFill.className = "progress-fill usage-fill usage-low";
      }

      usageStatsDiv.style.display = "block";
    } else {
      // Free 用户不显示用量统计
      usageStatsDiv.style.display = "none";
    }
  }

  console.log("✓ 账号详细信息已更新到界面（含试用期）");
}

// 更新账号信息显示（基础版本）
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
    // 保存原始邮箱到 data 属性（方便调试）
    emailElement.setAttribute("data-original-email", accountInfo.email);
  }

  // 更新套餐信息
  const subscriptionBadge = document.querySelector(".badge-pro");
  if (subscriptionBadge) {
    let displaySub = accountInfo.subscription;
    if (displaySub === 'Trial') {
      displaySub = '试用版';
    }
    subscriptionBadge.textContent = displaySub;

    // 根据套餐类型更新样式（清除所有类名后重新设置）
    subscriptionBadge.className = "badge-pro";
    // 优先判断试用版，避免被 "pro" 关键字误判
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
    // 根据状态更新样式和文本
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

  // 更新Token显示
  const tokenElement = document.querySelector("#account-token");
  if (tokenElement) {
    tokenElement.textContent = accountInfo.token_preview;
  }

  console.log("✓ 账号基本信息已更新到界面");
}

/**
 * 从混杂文本中智能提取Token
 * 支持三种格式：
 * 1. AccessToken (JWT): eyJhbGciOiJI...
 * 2. WebToken: user_xxx%3A%3AeyJhbGciOiJI... 或 user_xxx::eyJhbGciOiJI...
 * 3. SessionToken: user_xxx%3Asess_xxx%7CeyJhbGciOiJI... 或 user_xxx:sess_xxx|eyJhbGciOiJI...
 * 
 * 自动过滤中文和其他无关字符
 */
function extractTokenFromText(text) {
  if (!text) return null;

  // 首先尝试查找SessionToken格式 (user_xxx:sess_xxx|JWT)
  // 支持URL编码格式
  const sessionTokenPattern = /user_[A-Z0-9]+(?:%3A|:)sess_[A-Z0-9]+(?:%7C|\|)[A-Za-z0-9\-_\.]+/gi;
  const sessionTokenMatch = text.match(sessionTokenPattern);
  if (sessionTokenMatch) {
    console.log("检测到 SessionToken 格式");
    // 找到最长的匹配（避免截断）
    let longestMatch = sessionTokenMatch[0];
    for (const match of sessionTokenMatch) {
      if (match.length > longestMatch.length) {
        longestMatch = match;
      }
    }
    return longestMatch;
  }

  // 尝试查找WebToken格式 (user_xxx::JWT)
  // 支持URL编码格式 %3A%3A 和非编码格式 ::
  // 更宽松的匹配规则，允许后面跟任意字符直到遇到空格或中文
  const webTokenPattern = /user_[A-Z0-9]+(?:%3A%3A|::)[A-Za-z0-9\-_\.]+/gi;
  const webTokenMatch = text.match(webTokenPattern);
  if (webTokenMatch) {
    console.log("检测到 WebToken 格式");
    // 找到最长的匹配（避免截断）
    let longestMatch = webTokenMatch[0];
    for (const match of webTokenMatch) {
      if (match.length > longestMatch.length) {
        longestMatch = match;
      }
    }
    return longestMatch;
  }

  // 尝试查找纯AccessToken格式 (JWT)
  // JWT格式：header.payload.signature，每部分都是base64url编码
  // 更准确的JWT匹配，确保能匹配完整的token
  const jwtPattern = /eyJ[A-Za-z0-9\-_]+={0,2}\.[A-Za-z0-9\-_]+={0,2}\.[A-Za-z0-9\-_]+={0,2}/g;
  const jwtMatches = text.match(jwtPattern);
  if (jwtMatches) {
    console.log("检测到 AccessToken (JWT) 格式");
    // 找到最长的匹配（避免截断）
    let longestMatch = jwtMatches[0];
    for (const match of jwtMatches) {
      if (match.length > longestMatch.length) {
        longestMatch = match;
      }
    }
    return longestMatch;
  }

  // 如果都没找到，返回null
  return null;
}

/**
 * 检查 Cursor 是否已登录（即数据库是否可访问）
 * @returns {Promise<boolean>} 如果已登录返回 true，否则显示提示并返回 false
 */
async function checkCursorLogin() {
  try {
    console.log("正在检查 Cursor 登录状态...");
    await invoke("get_current_cursor_account_cmd");
    console.log("✓ Cursor 已登录，数据库可访问");
    return true;
  } catch (error) {
    console.warn("⚠ Cursor 未登录或数据库不可访问:", error);

    // 显示友好的错误提示
    await showAlert(
      "Cursor 未登录",
      "检测到 Cursor 编辑器未登录！\n\n" +
      "在使用换号功能前，请先完成以下操作：\n\n" +
      "1. 打开 Cursor 编辑器\n" +
      "2. 登录任意 Cursor 账号\n" +
      "3. 登录成功后返回本程序\n" +
      "4. 再次尝试换号操作\n\n" +
      "这是为了确保程序可以正确访问 Cursor 配置数据库。",
      "warning"
    );
    return false;
  }
}

// 一键换号功能
async function handleSwitchAccount() {
  const switchBtn = document.querySelector("#switch-account-btn");
  let originalDisabled = false;

  try {
    // 首先检查 Cursor 是否已登录
    const isCursorLoggedIn = await checkCursorLogin();
    if (!isCursorLoggedIn) {
      console.log("❌ Cursor 未登录，换号操作已取消");
      return;
    }

    // 弹出输入框让用户输入 Token
    const inputText = await showInput(
      "输入Token换号",
      "粘贴包含Token的文本，系统会自动识别提取"
    );

    if (!inputText || inputText.trim() === "") {
      // 用户取消或输入为空
      return;
    }

    // 智能提取Token
    const extractedToken = extractTokenFromText(inputText);
    if (!extractedToken) {
      await showAlert(
        "提取失败",
        "未能从输入内容中识别出有效的Token\n\n支持以下格式：\n• JWT Token: eyJhbGci...\n• WebToken: user_xxx::eyJhbGci...\n• SessionToken: user_xxx:sess_xxx|eyJhbGci...\n\n系统会自动过滤中文和其他无关字符",
        "error"
      );
      return;
    }

    console.log("成功提取Token:", extractedToken);

    // 判断Token类型并处理
    let token;
    if (extractedToken.startsWith("user_")) {
      // WebToken或SessionToken格式，需要先解析
      const tokenType = extractedToken.includes("sess_") ? "SessionToken" : "WebToken";
      console.log(`识别为 ${tokenType}，调用解析接口...`);

      try {
        const result = await invoke("parse_session_token_cmd", { sessionToken: extractedToken });
        token = result.access_token;
        console.log(`✓ ${tokenType} 解析成功，获取到 AccessToken`);
      } catch (parseError) {
        console.error(`${tokenType} 解析失败:`, parseError);
        await showAlert("解析失败", `无法解析 ${tokenType}：${parseError}`, "error");
        return;
      }
    } else {
      // 纯AccessToken格式，直接使用
      token = extractedToken;
      console.log("识别为 AccessToken (JWT)，直接使用");
    }

    // 禁用按钮，防止重复点击
    if (switchBtn) {
      originalDisabled = switchBtn.disabled;
      switchBtn.disabled = true;
      switchBtn.textContent = "换号中...";
    }

    // 获取邮箱隐私设置
    const emailPrivacyEnabled = getEmailPrivacySetting();

    // 调用 Tauri 后端命令执行换号操作
    const resultJson = await invoke("switch_account", {
      accessToken: token,
      enableEmailPrivacy: emailPrivacyEnabled
    });

    // 解析返回结果
    const result = JSON.parse(resultJson);

    // 显示成功提示
    await showAlert("换号成功", result.message, "success");

    // 保存账号数据到本地文件（包含机器ID）
    try {
      // 先尝试获取账号信息以获取邮箱等详细信息
      let accountInfo;
      try {
        accountInfo = await invoke("get_account_info", { accessToken: token });
      } catch (err) {
        console.warn("获取账号信息失败，使用默认值:", err);
        accountInfo = { email: "unknown@example.com" };
      }

      // 构造账号数据（包含新生成的机器ID）
      const accountData = {
        email: accountInfo.email || "unknown@example.com",
        plan: accountInfo.subscription || "free_trial",
        sign_up_type: "Auth_0",
        auth_id: "",
        access_token: token,
        refresh_token: token,
        machine_id: result.machine_ids?.machine_id || "",
        service_machine_id: "",
        dev_device_id: result.machine_ids?.dev_device_id || "",
        mac_machine_id: result.machine_ids?.mac_machine_id || "",
        machine_id_telemetry: "",
        sqm_id: result.machine_ids?.sqm_id || "",
        note: ""
      };

      // 保存到本地
      await invoke("add_account", { data: accountData });
      console.log("✓ 账号数据已保存到本地（含机器ID）");

      // 更新缓存
      cachedAccountsStorage = await loadLocalAccountsStorage();

    } catch (saveError) {
      console.error("保存账号数据失败:", saveError);
    }

    // 刷新页面数据（现在会使用真实的Token信息）
    await loadUsageData();

  } catch (error) {
    console.error("换号失败:", error);

    // 显示详细错误信息
    let errorMessage = error.toString();
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // 检查是否是权限问题，提供更友好的提示
    if (errorMessage.includes("权限不足") || errorMessage.includes("拒绝访问") || errorMessage.includes("Access is denied")) {
      errorMessage = "❌ 权限不足\n\n" + errorMessage;

      // 如果是权限问题，提供额外的操作建议
      const retry = await showConfirm(
        "权限问题",
        errorMessage + "\n\n是否尝试以管理员身份重启程序？"
      );

      if (retry) {
        // 提示用户如何以管理员身份运行
        await showAlert(
          "操作指南",
          "请按以下步骤操作：\n\n1. 关闭当前程序\n2. 右键点击程序图标\n3. 选择「以管理员身份运行」\n4. 重新尝试换号操作",
          "info"
        );
      }
    } else {
      await showAlert("换号失败", errorMessage, "error");
    }
  } finally {
    // 恢复按钮状态
    if (switchBtn) {
      switchBtn.disabled = originalDisabled;
      switchBtn.textContent = "输入Token一键换号";
    }
  }
}

// 购买账号卡密功能
async function handleBuyAccount() {
  try {
    const buyUrl = "https://pay.ldxp.cn/shop/cursor-shifter";
    console.log("正在打开购买页面:", buyUrl);

    // 调用后端命令打开浏览器
    await invoke("open_url", { url: buyUrl });

    console.log("✓ 已在浏览器中打开购买页面");

  } catch (error) {
    console.error("打开购买页面失败:", error);
    await showAlert("打开失败", `无法打开浏览器：${error}`, "error");
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

// 重置Cursor机器码功能（手动重置，不换号）
async function handleResetDevice() {
  try {
    // 1. 检测Cursor版本
    console.log("正在检测Cursor版本...");
    let versionInfo;
    try {
      versionInfo = await invoke("detect_cursor_version_cmd");
      console.log("✓ Cursor版本检测成功:", versionInfo);
    } catch (error) {
      console.warn("版本检测失败，使用默认策略:", error);
      versionInfo = {
        version: "unknown",
        is_045_plus: false
      };
    }

    // 2. 检查管理员权限（仅Windows且Cursor >= 0.45.0）
    let needsAdmin = false;
    if (versionInfo.is_045_plus && navigator.platform.includes("Win")) {
      console.log("检测到需要管理员权限...");
      try {
        const isAdmin = await invoke("check_admin_privileges");
        if (!isAdmin) {
          needsAdmin = true;
          console.warn("⚠ 缺少管理员权限");
        } else {
          console.log("✓ 已具有管理员权限");
        }
      } catch (error) {
        console.warn("权限检测失败:", error);
        needsAdmin = true; // 默认假设需要权限
      }
    }

    // 3. 如果需要管理员权限但用户没有，则强制阻止操作
    if (needsAdmin) {
      await showAlert(
        "需要管理员权限",
        "⚠️ 重置Cursor机器码需要管理员权限！\n\n请按以下步骤操作：\n1. 关闭本程序\n2. 右键点击程序图标\n3. 选择\"以管理员身份运行\"\n4. 重新执行重置操作\n\n提示：Cursor 0.45.0及以上版本需要修改注册表，必须使用管理员权限。",
        "error"
      );
      console.log("操作已阻止：缺少管理员权限");
      return;
    }

    // 4. 显示确认对话框
    let confirmMessage = `此操作将重置Cursor的设备ID。\n\n⚠️ 注意事项：\n• 不会切换账号，只是重置设备标识\n• 会自动关闭并重启Cursor\n\n是否确认重置？`;

    const confirmed = await showConfirm(
      "确认重置Cursor机器码",
      confirmMessage
    );

    if (!confirmed) {
      console.log("用户取消了重置操作");
      return;
    }

    console.log("正在重置Cursor机器码...");

    // 5. 显示加载提示（5秒后自动确认）
    await Promise.race([
      showAlert("处理中", "正在重置Cursor机器码，请稍候...", "info"),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    // 6. 调用 Tauri 后端命令重置Cursor机器码
    const result = await invoke("reset_cursor_machine_id");
    const resultData = JSON.parse(result);

    console.log("✓ Cursor机器码已重置:", resultData);

    // 7. 显示详细结果
    let successMessage = `Cursor机器码重置${resultData.success ? '成功' : '完成'}！\n\n🆔 新的设备ID：\n• macMachineId: ${resultData.machine_ids.mac_machine_id.substring(0, 16)}...\n• machineId: ${resultData.machine_ids.machine_id.substring(0, 16)}...\n• devDeviceId: ${resultData.machine_ids.dev_device_id}\n• sqmId: ${resultData.machine_ids.sqm_id}`;

    // if (resultData.reset_details && resultData.reset_details.length > 0) {
    //   successMessage += `\n\n✅ 执行步骤：\n${resultData.reset_details.map(detail => `• ${detail}`).join('\n')}`;
    // }

    successMessage += `\n\nCursor已重新启动，现在被识别为新设备。`;

    await showAlert(
      resultData.success ? "重置成功" : "重置完成",
      successMessage,
      resultData.success ? "success" : "warning"
    );

  } catch (error) {
    console.error("重置Cursor机器码失败:", error);
    await showAlert("重置失败", error.toString(), "error");
  }
}

/**
 * 自动一键换号功能
 */
async function handleUnlimitedQuota() {
  const switchBtn = document.querySelector("#unlimited-quota-btn");
  let originalDisabled = false;

  try {
    const isCursorLoggedIn = await checkCursorLogin();
    if (!isCursorLoggedIn) {
      console.log("❌ Cursor 未登录，自动换号操作已取消");
      return;
    }

    if (switchBtn) {
      originalDisabled = switchBtn.disabled;
      switchBtn.disabled = true;
      switchBtn.textContent = "功能已移除";
    }

    await showAlert(
      "功能已移除",
      "开源版已移除云端激活与自动注册相关能力，自动一键换号入口已禁用。",
      "info"
    );
  } catch (error) {
    console.error("处理自动换号入口失败:", error);
    await showAlert("操作失败", error.toString(), "error");
  } finally {
    if (switchBtn) {
      switchBtn.disabled = originalDisabled;
      switchBtn.textContent = "自动一键换号";
    }
  }
}


/**
 * 检查当前账号用量
 * @returns {Object} { allowed: boolean, needConfirm: boolean, message: string }
 */
async function checkCurrentAccountUsage() {
  try {
    // 尝试从Cursor数据库读取当前账号
    let currentAccount;
    try {
      currentAccount = await invoke("get_current_cursor_account_cmd");
    } catch (error) {
      console.log("ℹ Cursor未登录或无法读取账号信息，跳过用量检查");
      return { allowed: true, needConfirm: false };
    }

    console.log("正在检查当前账号用量...");

    // 获取账号详细信息（含用量）
    const accountDetail = await invoke("get_account_detail_info", {
      accessToken: currentAccount.access_token
    });

    const membershipType = accountDetail.membership_type;
    const usedRaw = accountDetail.usage_used || 0;           // 计划内已使用
    const limitRaw = accountDetail.usage_limit || 0;         // 计划内限额
    const bonusRaw = accountDetail.usage_overdraft || 0;     // 透支额度

    // 转换为美元
    const used = usedRaw / 100;
    const limit = limitRaw / 100;
    const bonus = bonusRaw / 100;
    const total = used + bonus;

    console.log(`账号类型: ${membershipType}, 已使用: ${used}$, 限额: ${limit}$, 透支: ${bonus}$, 总计: ${total}$`);

    // 规则1：Ultra号（400$限额）
    if (membershipType === "ultra") {
      // 检查是否过期
      const isExpired = accountDetail.is_expired;

      // 如果过期了，直接允许换号
      if (isExpired) {
        return {
          allowed: true,
          needConfirm: false
        };
      }

      // Ultra号未用到380$
      if (total < 380) {
        return {
          allowed: false,
          needConfirm: false,
          message: `当前Ultra账号还有额度未使用完。\n\n已使用：${total.toFixed(2)}$ / 400$\n剩余：${(400 - total).toFixed(2)}$\n\n建议用到 380$+ 后再换号，避免浪费。`
        };
      }

      // 总额度超过380$，允许换号
      if (total >= 380) {
        return {
          allowed: true,
          needConfirm: false
        };
      }
    }

    // 规则1：pro 20+50$
    if (membershipType === "pro") {
      // Pro号未用完20$
      if (used < 20) {
        return {
          allowed: false,
          needConfirm: false,
          message: `当前Pro账号还有额度未使用完。\n\n已使用：${total.toFixed(2)}$ / 70$\n剩余：${(70 - total).toFixed(2)}$\n\n请把额度用完后再换号，避免浪费。`
        };
      }

      // Pro号用满20$，检查透支
      if (used >= 20) {
        // 总额度超过60$，允许换号
        if (total >= 60) {
          return {
            allowed: true,
            needConfirm: false
          };
        }

        // 总消耗不足60$，需要确认
        if (total < 60) {
          return {
            allowed: true,
            needConfirm: true,
            message: `当前Pro账号透支额度未用完。\n\n总计：${total.toFixed(2)}$/70$\n\n建议把额度用完后再换号（一般在60-70$）。`
          };
        }
      }
    }

    // 规则3：试用号（10$限额）
    if (membershipType !== "pro" && membershipType !== "ultra" && membershipType !== "free" && membershipType !== "pro_plus") {
      // 试用号未用完10$
      if (used < 10) {
        return {
          allowed: false,
          needConfirm: false,
          message: `当前试用账号还有额度未使用完。\n\n已使用：${used.toFixed(2)}$ / 10$\n剩余：${(10 - used).toFixed(2)}$\n\n请把额度用完后再换号，避免浪费。`
        };
      } else {
        // 试用号用满10$，允许换号
        if (total >= 10) {
          return {
            allowed: true,
            needConfirm: false
          };
        }
      }

    }

    // 默认允许换号
    return { allowed: true, needConfirm: false };

  } catch (error) {
    console.error("检查用量失败:", error);
    // 如果检查失败，允许用户继续（不阻断流程）
    return { allowed: true, needConfirm: false };
  }
}

/**
 * 计算剩余等待时间
 */
function calculateRemainingWaitTime(nextAvailableTime) {
  const now = new Date();
  const next = new Date(nextAvailableTime);
  const diff = next - now;

  if (diff <= 0) {
    return "已可换号";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}

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
  }
}

/**
 * 启动时自动检查更新（带超时保护）
 */
async function checkUpdateOnStartup() {
  try {
    console.log("启动时检查更新...");

    // 使用 Promise.race 实现超时保护（5秒超时）
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("检查更新超时（5秒）")), 5000);
    });

    const updatePromise = checkUpdateFromAPI();

    const updateInfo = await Promise.race([updatePromise, timeoutPromise]);

    if (!updateInfo.has_update) {
      console.log("✓ 当前已是最新版本");
      return;
    }

    console.log(`发现新版本: ${updateInfo.latest_version}`);

    // 构造更新提示消息
    const message = `发现新版本 v${updateInfo.latest_version}！\n\n更新内容：\n${updateInfo.changelog || "暂无更新说明"}\n\n${updateInfo.is_critical ? "⚠️ 这是强制更新，不更新将无法使用软件。" : ""}是否前往下载？`;

    const confirmed = await showConfirm(
      updateInfo.is_critical ? "⚠️ 强制更新" : "发现新版本",
      message
    );

    if (confirmed) {
      // 打开下载链接
      await invoke("open_url", { url: updateInfo.download_url });

      // 如果是强制更新，打开下载后退出软件
      if (updateInfo.is_critical) {
        await showAlert("请更新后重新启动", "软件将在确认后退出，请下载新版本后重新安装。", "info");
        await exitApp();
      }
    } else {
      // 用户拒绝更新
      if (updateInfo.is_critical) {
        // 强制更新被拒绝，退出软件
        await showAlert("无法继续使用", "此版本已停止支持，必须更新才能继续使用。\n\n软件将在确认后退出。", "error");
        await exitApp();
      }
    }

  } catch (error) {
    console.error("启动检查更新失败:", error);
    // 启动时检查失败不影响软件使用
  }
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
 * 退出应用
 */
async function exitApp() {
  try {
    // 调用 Tauri 的退出命令
    await invoke("exit_app");
  } catch (error) {
    console.error("退出应用失败:", error);
    // 降级方案：关闭窗口
    window.close();
  }
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

/**
 * 菜单折叠/展开功能
 */
function handleMenuToggle() {
  const sidebar = document.querySelector(".sidebar");
  const body = document.body;

  // 切换折叠状态
  sidebar.classList.toggle("collapsed");
  body.classList.toggle("sidebar-collapsed");
}

// ============= 自定义弹窗系统 =============

let dialogResolve = null;

/**
 * 初始化自定义弹窗
 */
function initCustomDialog() {
  const dialogOverlay = document.querySelector("#custom-dialog");
  const dialogClose = document.querySelector("#dialog-close");
  const dialogCancel = document.querySelector("#dialog-cancel");
  const dialogConfirm = document.querySelector("#dialog-confirm");

  // 点击关闭按钮
  dialogClose.addEventListener("click", () => {
    closeDialog(false);
  });

  // 点击取消按钮
  dialogCancel.addEventListener("click", () => {
    closeDialog(false);
  });

  // 点击确定按钮
  dialogConfirm.addEventListener("click", () => {
    closeDialog(true);
  });

  // 点击遮罩层关闭（可选）
  dialogOverlay.addEventListener("click", (e) => {
    if (e.target === dialogOverlay) {
      closeDialog(false);
    }
  });

  // ESC 键关闭
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dialogOverlay.classList.contains("show")) {
      closeDialog(false);
    }
  });
}

/**
 * 显示确认对话框
 * @param {string} title - 标题
 * @param {string} message - 消息内容
 * @returns {Promise<boolean>} 用户是否确认
 */
function showConfirm(title, message) {
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

    // 设置图标（问号图标）
    dialogIcon.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    `;
    dialogIcon.className = "dialog-icon dialog-icon-question";

    // 显示取消和确定按钮
    dialogFooter.style.display = "flex";
    dialogCancel.style.display = "block";
    dialogConfirm.style.display = "block";

    // 显示弹窗
    dialogOverlay.classList.add("show");
  });
}

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
 * 显示输入对话框
 * @param {string} title - 标题
 * @param {string} placeholder - 输入框占位符
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
 * 关闭弹窗
 * @param {boolean} result - 返回结果
 */
function closeDialog(result) {
  const dialogOverlay = document.querySelector("#custom-dialog");
  const dialogInput = document.querySelector("#dialog-input");
  const dialogMessage = document.querySelector("#dialog-message");

  // 如果是输入框弹窗
  if (dialogInput.style.display !== "none") {
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

// ============= 配置备份功能 =============

/**
 * 创建备份
 */
async function handleCreateBackup() {
  const createBtn = document.querySelector("#create-backup-btn");

  try {
    // 禁用按钮
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.textContent = "备份中...";
    }

    // 调用后端创建备份
    const metadata = await invoke("create_config_backup", { name: null });

    // 显示成功提示
    await showAlert("备份成功", `备份已创建：${metadata.name}`, "success");

    // 刷新备份列表
    await loadBackupList();
  } catch (error) {
    console.error("创建备份失败:", error);
    await showAlert("备份失败", error.toString(), "error");
  } finally {
    // 恢复按钮状态
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        备份当前配置
      `;
    }
  }
}

// handleRefreshBackups 函数已在下面定义

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
function formatFileSize(bytes) {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(2)} GB`;
  } else if (bytes >= MB) {
    return `${(bytes / MB).toFixed(2)} MB`;
  } else if (bytes >= KB) {
    return `${(bytes / KB).toFixed(2)} KB`;
  } else {
    return `${bytes} B`;
  }
}

// ==================== 账号管理页面功能 ====================

/**
 * 加载账号管理页面
 */
async function loadAccountsPage() {
  console.log("加载账号管理页面...");

  try {
    // 优先从 Cursor 官方数据库读取当前账号（使用缓存）
    let currentAccount = null;

    try {
      const cursorAccount = await getCursorCurrentAccount();
      console.log("✓ 从 Cursor 数据库读取到当前账号:", cursorAccount.email);

      // 转换为显示格式
      currentAccount = {
        email: cursorAccount.email,
        access_token: cursorAccount.access_token,
        refresh_token: cursorAccount.refresh_token,
        plan: "未知", // 需要解析 token 才能知道
      };
    } catch (dbError) {
      console.log("ℹ Cursor 数据库读取失败:", dbError);
      // Cursor 未登录时，不显示账号列表中的账号
      currentAccount = null;
    }

    if (currentAccount) {
      // 显示当前账号信息
      displayCurrentAccount(currentAccount);
    } else {
      // 显示空状态
      showEmptyAccountState();
    }

    // 渲染本地保存的账号列表（仅显示基本信息，不自动加载详细信息）
    const storage = await loadLocalAccountsStorage();

    console.log(`✓ 加载了 ${storage.accounts.length} 个本地账号（仅基本信息）`);
    console.log("💡 提示: 点击账号旁的刷新按钮可以获取详细信息和剩余时间");

    // 直接渲染账号列表，不自动加载详细信息
    renderAccountsList(storage.accounts);

    // 标记页面已加载
    markPageLoaded("accounts");

  } catch (error) {
    console.error("加载账号信息失败:", error);
    showEmptyAccountState();
    renderAccountsList([]);
    // 即使失败也标记为已加载
    markPageLoaded("accounts");
  }
}

/**
 * 显示空状态
 */
function showEmptyAccountState() {
  const currentAccountInfo = document.querySelector("#current-account-info");
  const detailsCard = document.querySelector("#account-details-card");

  if (currentAccountInfo) {
    currentAccountInfo.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <p>暂无账号数据</p>
        <p class="empty-hint">请先使用"一键换号"功能或点击"导入账号"</p>
      </div>
    `;
  }

  if (detailsCard) {
    detailsCard.style.display = "none";
  }
}

/**
 * 显示当前账号信息
 * @param {Object} accountData - 当前账号数据
 */
function displayCurrentAccount(accountData) {
  const currentAccountInfo = document.querySelector("#current-account-info");

  if (currentAccountInfo) {
    // 获取邮箱的首字母作为头像
    const initial = accountData.email ? accountData.email.charAt(0).toUpperCase() : "?";

    // 确定套餐类型的显示样式
    let planClass = "free";
    let planText = accountData.plan || "Free";
    if (planText.toLowerCase().includes("ultra")) {
      planClass = "ultra";
      planText = "Ultra";
    } else if (planText.toLowerCase().includes("pro") && !planText.toLowerCase().includes("trial")) {
      planClass = "pro";
      planText = "Pro";
    } else if (planText.toLowerCase().includes("pro_plus")) {
      planClass = "pro_plus";
      planText = "ProPlus";
    } else if (planText.toLowerCase().includes("trial")) {
      planClass = "trial";
      planText = "Pro Trial";
    }

    // 应用邮箱隐私保护
    const displayEmail = maskEmail(accountData.email || "未知邮箱");

    currentAccountInfo.innerHTML = `
      <div class="simple-account-info">
        <div class="account-avatar">${initial}</div>
        <div class="account-main-info">
          <div class="account-email" data-original-email="${accountData.email || ""}">${displayEmail}</div>
          <span class="account-plan-badge ${planClass}">${planText}</span>
        </div>
      </div>
    `;
  }
}

/**
 * 更新单个账号行的显示
 * @param {HTMLElement} row - 账号行元素
 * @param {Object} account - 更新后的账号对象
 */
function updateAccountRow(row, account) {
  // 确定套餐显示文本和样式
  let planClass = "free";
  let planText = account.plan || "Free";
  let statusDetail = "";

  if (planText.toLowerCase().includes("ultra")) {
    planClass = "ultra";
    planText = "Ultra";
    if (account.days_remaining !== undefined) {
      statusDetail = ` (剩余${account.days_remaining}天)`;
    }
  } else if (planText.toLowerCase().includes("pro_plus")) {
    planClass = "pro_plus";
    planText = "ProPlus";
  } else if (planText.toLowerCase().includes("pro") && !planText.toLowerCase().includes("trial")) {
    planClass = "pro";
    planText = "Pro";
    if (account.days_remaining !== undefined) {
      statusDetail = ` (剩余${account.days_remaining}天)`;
    }
  } else if (planText.toLowerCase().includes("trial")) {
    planClass = "trial";
    planText = "Pro试用";
    if (account.days_remaining !== undefined) {
      statusDetail = ` (剩余${account.days_remaining}天)`;
    }
  }

  // 更新订阅状态列
  const planBadge = row.querySelector('.plan-badge');
  if (planBadge) {
    planBadge.className = `plan-badge ${planClass}`;
    planBadge.textContent = planText + statusDetail;
  }

  // 更新剩余时间列
  const remainingTime = row.querySelector('.remaining-time');
  if (remainingTime) {
    remainingTime.innerHTML = calculateAccountRemainingTime(account);
  }

  console.log(`✓ 已更新账号 ${account.email} 的显示`);
}

/**
 * 渲染账号列表表格
 * @param {Array} accounts - 账号数组
 */
function renderAccountsList(accounts) {
  const accountsTableBody = document.querySelector("#accounts-table-body");

  if (!accountsTableBody) {
    return;
  }

  // 如果没有账号，显示空状态
  if (accounts.length === 0) {
    accountsTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">
          <div class="empty-state-small">
            <p>暂无账号</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // 性能优化：使用 DocumentFragment 批量创建 DOM 元素
  const fragment = document.createDocumentFragment();

  accounts.forEach(account => {
    // 确定套餐显示文本和样式
    let planClass = "free";
    let planText = account.plan || "Free";
    let statusDetail = "";

    if (planText.toLowerCase().includes("ultra")) {
      planClass = "ultra";
      planText = "Ultra";
      if (account.days_remaining !== undefined) {
        statusDetail = ` (剩余${account.days_remaining}天)`;
      }
    } else if (planText.toLowerCase().includes("pro_plus")) {
      planClass = "pro_plus";
      planText = "ProPlus";
    } else if (planText.toLowerCase().includes("pro") && !planText.toLowerCase().includes("trial")) {
      planClass = "pro";
      planText = "Pro";
      if (account.days_remaining !== undefined) {
        statusDetail = ` (剩余${account.days_remaining}天)`;
      }
    } else if (planText.toLowerCase().includes("trial")) {
      planClass = "trial";
      planText = "Pro试用";
      if (account.days_remaining !== undefined) {
        statusDetail = ` (剩余${account.days_remaining}天)`;
      }
    }

    // 应用邮箱隐私保护
    const displayEmail = maskEmail(account.email);

    // 创建行元素（使用模板字符串 + innerHTML 比 createElement 快）
    const tr = document.createElement('tr');
    tr.dataset.email = account.email;
    tr.innerHTML = `
      <td class="col-email" data-label="邮箱账号" data-original-email="${account.email}">${displayEmail}</td>
      <td class="col-plan" data-label="订阅状态">
        <div class="plan-status-group">
          <span class="plan-badge ${planClass}">${planText}${statusDetail}</span>
          <button class="refresh-status-btn" data-action="refresh-status" data-email="${account.email}" title="刷新状态">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
        </div>
      </td>
      <td class="col-remaining" data-label="剩余时间">
        <div class="remaining-time-group">
          <span class="remaining-time" data-email="${account.email}">${calculateAccountRemainingTime(account)}</span>
          <button class="refresh-time-btn" data-action="refresh-time" data-email="${account.email}" title="刷新剩余时间">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
        </div>
      </td>
      <td class="col-actions" data-label="操作">
        <div class="table-action-btns">
          <button class="table-btn switch" data-action="switch" data-email="${account.email}">
            一键换号
          </button>
          <button class="table-btn delete" data-action="delete" data-email="${account.email}">
            删除
          </button>
        </div>
      </td>
    `;

    fragment.appendChild(tr);
  });

  // 一次性更新 DOM，减少重排重绘
  accountsTableBody.innerHTML = '';
  accountsTableBody.appendChild(fragment);

  // 添加事件委托处理账号操作按钮
  const accountsTable = document.querySelector("#accounts-table-body");
  if (accountsTable) {
    // 移除旧的事件监听器（如果有）
    const newAccountsTable = accountsTable.cloneNode(true);
    accountsTable.parentNode.replaceChild(newAccountsTable, accountsTable);

    // 添加新的事件监听器
    newAccountsTable.addEventListener("click", async (e) => {
      const button = e.target.closest("button[data-action]");
      if (!button) return;

      const action = button.dataset.action;
      const email = button.dataset.email;

      console.log(`📍 账号操作: ${action}, 邮箱: "${email}"`);

      switch (action) {
        case "switch":
          await handleSwitchToAccount(email);
          break;
        case "delete":
          await handleDeleteAccountFromList(email);
          break;
        case "refresh-status":
          await handleRefreshAccountStatus(email);
          break;
        case "refresh-time":
          await handleRefreshRemainingTime(email);
          break;
      }
    });
  }
}

/**
 * 计算账号剩余时间
 * @param {Object} account - 账号对象
 * @returns {string} 剩余时间显示文本
 */
function calculateAccountRemainingTime(account) {
  // 如果没有详细信息，显示加载中
  if (!account.detailed_info) {
    return '<span class="text-muted">-</span>';
  }

  const info = account.detailed_info;
  const membershipType = info.membership_type;
  let daysRemaining = info.days_remaining;
  const isExpired = info.is_expired;

  // 根据会员类型显示不同的剩余时间
  if (membershipType === "free") {
    return '<span class="text-muted">仅auto</span>';
  }

  // 处理Pro和Ultra专业版特殊情况：没有days_remaining字段
  if ((membershipType === "pro" || membershipType === "ultra" || membershipType === "pro_plus") && (daysRemaining === undefined || daysRemaining === null)) {
    // Pro/Ultra专业版没有剩余时间字段，需要根据更新时间计算
    const diffDays = calculateProUltraRemainingDays(info);

    if (diffDays !== null) {
      if (diffDays <= 0) {
        return '<span class="text-danger">已过期</span>';
      } else if (diffDays > 7) {
        return `<span class="text-warning">${diffDays} 天</span>`;
      } else {
        return `<span class="text-danger">${diffDays} 天</span>`;
      }
    } else if (info.subscription_status === "past_due") {
      // 如果状态是past_due，说明已经过期
      return '<span class="text-danger">已过期</span>';
    } else {
      // 没有足够信息计算
      const typeText = membershipType === "pro" ? "Pro专业版" : membershipType === "ultra" ? "Ultra专业版" : "ProPlus专业版";
      return `<span class="text-muted">${typeText}</span>`;
    }
  }

  // 其他情况：有明确的过期标志或剩余天数
  if (isExpired) {
    return '<span class="text-danger">已过期</span>';
  } else if (daysRemaining !== undefined && daysRemaining !== null) {
    if (daysRemaining > 30) {
      return `<span class="text-success">${daysRemaining} 天</span>`;
    } else if (daysRemaining > 7) {
      return `<span class="text-warning">${daysRemaining} 天</span>`;
    } else {
      return `<span class="text-danger">${daysRemaining} 天</span>`;
    }
  } else {
    return '<span class="text-muted">未知</span>';
  }
}

/**
 * 刷新指定账号的剩余时间
 * @param {string} email - 账号邮箱
 */
async function handleRefreshRemainingTime(email) {
  // 找到对应的行和按钮
  const row = document.querySelector(`tr[data-email="${email}"]`);
  const btn = row?.querySelector('.refresh-time-btn');
  const svg = btn?.querySelector('svg');
  const timeSpan = row?.querySelector('.remaining-time');

  if (!btn || !svg) {
    console.error("未找到刷新按钮");
    return;
  }

  // 添加旋转动画
  svg.style.animation = 'rotate 1s linear infinite';

  try {
    // 获取账号信息
    const storage = await loadLocalAccountsStorage();
    const account = storage.accounts.find(acc => acc.email === email);

    if (!account || !account.access_token) {
      await showAlert("刷新失败", "账号信息不完整", "error");
      return;
    }

    // 检查会员类型，如果是免费账号则直接返回
    if (account && (account.membership_type === "free" || account.membership_type === undefined)) {
      console.log("免费账号或会员类型未知，跳过获取详细用量信息");
      return;
    }

    // 获取账号详细信息（5秒超时）
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("获取账号信息超时（5秒）")), 5000);
    });

    const detailPromise = invoke("get_account_detail_info", {
      accessToken: account.access_token
    });

    const detailInfo = await Promise.race([detailPromise, timeoutPromise]);

    // 更新账号对象
    account.detailed_info = detailInfo;
    account.days_remaining = detailInfo.days_remaining;
    account.membership_type = detailInfo.membership_type;

    // 保存更新
    await invoke("add_account", { data: account });

    // 更新显示
    if (timeSpan) {
      timeSpan.innerHTML = calculateAccountRemainingTime(account);
    }

    console.log(`✓ 已刷新账号 ${email} 的剩余时间`);

  } catch (error) {
    console.error("刷新剩余时间失败:", error);
    await showAlert("刷新失败", error.toString(), "error");
  } finally {
    // 停止动画
    if (svg) {
      svg.style.animation = '';
    }
  }
}

/**
 * 处理新增账号（智能识别Token）
 */
async function handleAddAccount() {
  try {
    // 弹出输入框让用户输入 Token
    const inputText = await showInput(
      "新增账号",
      "粘贴Token，系统会自动识别格式"
    );

    if (!inputText || inputText.trim() === "") {
      // 用户取消或输入为空
      return;
    }

    // 智能提取Token
    const extractedToken = extractTokenFromText(inputText);
    if (!extractedToken) {
      await showAlert(
        "提取失败",
        "未能从输入内容中识别出有效的Token\n\n支持以下格式：\n• JWT Token: eyJhbGci...\n• WebToken: user_xxx::eyJhbGci...\n• SessionToken: user_xxx:sess_xxx|eyJhbGci...\n\n系统会自动过滤中文和其他无关字符",
        "error"
      );
      return;
    }

    console.log("成功提取Token:", extractedToken);

    // 判断Token类型并处理
    let accountInfo;
    if (extractedToken.startsWith("user_")) {
      // WebToken或SessionToken格式，需要先解析
      const tokenType = extractedToken.includes("sess_") ? "SessionToken" : "WebToken";
      console.log(`识别为 ${tokenType}，调用解析接口...`);

      try {
        const result = await invoke("parse_session_token_cmd", { sessionToken: extractedToken });
        accountInfo = result;
        console.log(`✓ ${tokenType} 解析成功`);
        console.log(`✓ AccessToken: ${accountInfo.access_token.substring(0, 50)}...`);

        // 检查是否为长效 Token（自动转换完成）
        if (accountInfo.access_token) {
          console.log("✓ Token 已自动处理（如果是短效 Token 已尝试转换）");
        }
      } catch (parseError) {
        console.error(`${tokenType} 解析失败:`, parseError);

        // 更友好的错误提示
        let errorMsg = parseError.toString();
        if (errorMsg.includes("type=web")) {
          errorMsg = "检测到短效 Web Token\n\n系统已自动尝试转换，但转换失败。\n请确保网络连接正常，或使用长效 Session Token。";
        }

        await showAlert("解析失败", errorMsg, "error");
        return;
      }
    } else {
      // 纯JWT格式，需要转换为 SessionToken
      console.log("识别为 AccessToken (JWT)，需要转换为 SessionToken...");

      try {
        // 调用解析命令，会自动转换为 SessionToken
        accountInfo = await invoke("get_account_info", { accessToken: extractedToken });

        // 尝试将 JWT 解析为长效 SessionToken（后端会自动处理 web→session 转换）
        const parseResult = await invoke("parse_session_token_cmd", { sessionToken: `user_unknown::${extractedToken}` });
        accountInfo = parseResult;
        console.log(`✓ 已转换为 SessionToken: ${accountInfo.access_token.substring(0, 50)}...`);
      } catch (error) {
        console.error("转换 SessionToken 失败:", error);

        // 如果转换失败，至少保存基础信息（使用 JWT）
        accountInfo = {
          email: `unknown_${Date.now()}@cursor.sh`,
          access_token: extractedToken,
          user_id: "unknown",
          plan: "unknown"
        };

        await showAlert(
          "提示",
          "无法转换为 SessionToken，将保存 JWT Token。\n\n注意：JWT Token 有效期较短，建议使用 WebToken 格式。",
          "warning"
        );
      }
    }

    // 保存账号到本地
    try {
      const accountData = {
        email: accountInfo.email || `unknown_${Date.now()}@cursor.sh`,
        plan: accountInfo.plan || accountInfo.subscription || "unknown",
        sign_up_type: "Auth_0",
        auth_id: "",
        access_token: accountInfo.access_token,
        // 优先使用后端返回的 refresh_token；
        // 若用户输入为 user_ 前缀的 Session/Web Token，则回退为原始输入；
        // 再不行则退到 access_token（不推荐，但避免为空）。
        refresh_token: accountInfo.refresh_token || (extractedToken && extractedToken.startsWith("user_") ? extractedToken : accountInfo.access_token),
        machine_id: "",
        service_machine_id: "",
        dev_device_id: "",
        mac_machine_id: "",
        machine_id_telemetry: "",
        sqm_id: "",
        sqm_id: "",
        note: `手动添加 - ${new Date().toLocaleString()}`
      };

      await invoke("add_account", { data: accountData });
      console.log("✓ 账号已保存到本地");

      // 刷新缓存
      cachedAccountsStorage = await loadLocalAccountsStorage();

      // 应用邮箱隐私保护
      const displayEmail = maskEmail(accountInfo.email);
      await showAlert("添加成功", `账号 ${displayEmail} 已成功添加到账号列表！`, "success");

      // 刷新账号列表页面
      await loadAccountsPage();

    } catch (saveError) {
      console.error("保存账号失败:", saveError);
      await showAlert("保存失败", `账号信息获取成功但保存失败：${saveError}`, "error");
    }

  } catch (error) {
    console.error("新增账号失败:", error);
    await showAlert("新增失败", error.toString(), "error");
  }
}

/**
 * 处理导入账号（触发文件选择）
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

    // 判断是单个账号还是数组
    let accounts = [];
    if (Array.isArray(data)) {
      accounts = data;
    } else if (data.email && data.access_token) {
      accounts = [data];
    } else {
      await showAlert("导入失败", "JSON 格式不正确，需要账号对象或账号数组", "error");
      return;
    }

    // 验证账号数据
    const validAccounts = accounts.filter(acc => acc.email && acc.access_token);
    if (validAccounts.length === 0) {
      await showAlert("导入失败", "没有找到有效的账号数据", "error");
      return;
    }

    // 调用后端导入
    const result = await invoke("import_accounts", { accounts: validAccounts });

    // 显示成功提示
    await showAlert("导入成功", result, "success");

    // 刷新页面
    await loadAccountsPage();

  } catch (error) {
    console.error("导入账号失败:", error);
    await showAlert("导入失败", error.toString(), "error");
  } finally {
    // 清空文件输入，允许再次选择相同文件
    event.target.value = '';
  }
}

/**
 * 导出所有账号为JSON文件
 */
async function handleExportAllAccounts() {
  try {
    const storage = await loadLocalAccountsStorage();

    if (storage.accounts.length === 0) {
      await showAlert("导出失败", "没有可导出的账号数据", "error");
      return;
    }

    // 检查是否开启邮箱隐私
    const emailPrivacyEnabled = getEmailPrivacySetting();

    // 如果开启了邮箱隐私，对导出数据进行脱敏
    let accountsToExport = storage.accounts;
    if (emailPrivacyEnabled) {
      accountsToExport = storage.accounts.map(account => ({
        ...account,
        email: maskEmail(account.email)  // 应用邮箱脱敏
      }));
      console.log("✓ 邮箱隐私已启用，导出数据将隐藏邮箱后缀");
    }

    // 转换为 JSON 字符串
    const jsonData = JSON.stringify(accountsToExport, null, 2);

    // 生成默认文件名
    const defaultFileName = `cursor-accounts-${Date.now()}.json`;

    // 调用后端打开保存对话框
    const savedPath = await invoke("save_file_dialog", {
      defaultName: defaultFileName,
      content: jsonData
    });

    if (savedPath) {
      const privacyNote = emailPrivacyEnabled ? "\n\n（已应用邮箱隐私保护）" : "";
      await showAlert("导出成功", `已导出 ${storage.accounts.length} 个账号\n\n保存位置：${savedPath}${privacyNote}`, "success");
    } else {
      console.log("用户取消了保存");
    }

  } catch (error) {
    console.error("导出账号失败:", error);
    await showAlert("导出失败", error.toString(), "error");
  }
}

/**
 * 切换到指定账号（从账号列表）
 * @param {string} email - 账号邮箱
 */
async function handleSwitchToAccount(email) {
  try {
    // 首先检查 Cursor 是否已登录
    const isCursorLoggedIn = await checkCursorLogin();
    if (!isCursorLoggedIn) {
      console.log("❌ Cursor 未登录，账号切换操作已取消");
      return;
    }

    // 调用后端设置当前账号
    await invoke("set_current_account", { email });

    // 获取账号数据
    const storage = await loadLocalAccountsStorage();
    const account = storage.accounts.find(acc => acc.email === email);

    if (!account || !account.access_token) {
      await showAlert("切换失败", "账号数据不完整", "error");
      return;
    }

    // 获取邮箱隐私设置
    const emailPrivacyEnabled = getEmailPrivacySetting();

    // 准备保存的机器ID（如果有）
    let savedMachineIds = null;
    if (account.mac_machine_id && account.machine_id && account.dev_device_id) {
      savedMachineIds = JSON.stringify({
        mac_machine_id: account.mac_machine_id,
        machine_id: account.machine_id,
        dev_device_id: account.dev_device_id,
        sqm_id: account.sqm_id || ""
      });
      console.log("✓ 将复用保存的机器ID");
    } else {
      console.log("ℹ 该账号无保存的机器ID，将生成新的");
    }

    // 调用账号列表专用的换号命令
    await invoke("switch_account_from_list", {
      accessToken: account.access_token,
      enableEmailPrivacy: emailPrivacyEnabled,
      savedMachineIds: savedMachineIds
    });

    // 应用邮箱隐私显示
    const displayEmail = maskEmail(email);
    await showAlert("换号成功", `已切换到账号：${displayEmail}`, "success");

    // 刷新页面
    await loadAccountsPage();

  } catch (error) {
    console.error("切换账号失败:", error);
    await showAlert("切换失败", error.toString(), "error");
  }
}

/**
 * 从列表删除账号
 * @param {string} email - 账号邮箱
 */
async function handleDeleteAccountFromList(email) {
  try {
    console.log("📍 [handleDeleteAccountFromList] 收到删除请求");
    console.log("  - 原始邮箱参数:", email);
    console.log("  - 参数类型:", typeof email);
    console.log("  - 参数长度:", email ? email.length : 'null');

    // 获取邮箱隐私设置
    const emailPrivacyEnabled = getEmailPrivacySetting();
    const displayEmail = emailPrivacyEnabled ? maskEmail(email) : email;

    // 确认删除
    const confirmed = await showConfirm(
      "确认删除",
      `确定要删除账号 ${displayEmail} 吗？\n\n此操作不可恢复。`
    );

    if (!confirmed) {
      console.log("  ✗ 用户取消删除");
      return;
    }

    console.log("  ✓ 用户确认删除");
    console.log("  📍 调用后端 delete_account，传递邮箱:", email);

    // 调用后端删除账号
    const result = await invoke("delete_account", { email: email });

    console.log("  ✓ 后端返回:", result);

    await showAlert("删除成功", "账号已删除", "success");

    // 刷新页面
    await loadAccountsPage();

  } catch (error) {
    console.error("❌ 删除账号失败:", error);
    console.error("  - 错误详情:", error.toString());
    console.error("  - 传递的邮箱:", email);

    // 尝试加载账号列表，检查实际存储的邮箱格式
    try {
      const storage = await invoke("load_accounts_storage");
      console.log("  📋 当前存储的所有账号邮箱:");
      storage.accounts.forEach((acc, index) => {
        console.log(`    ${index + 1}. "${acc.email}" (${acc.email.length} 字符)`);
      });
    } catch (e) {
      console.error("  ⚠️ 无法加载账号列表:", e);
    }

    await showAlert("删除失败", error.toString(), "error");
  }
}

/**
 * 刷新单个账号的订阅状态
 * @param {string} email - 账号邮箱
 */
async function handleRefreshAccountStatus(email) {
  try {
    console.log("正在刷新账号状态:", email);

    // 获取账号数据
    const storage = await loadLocalAccountsStorage();
    const account = storage.accounts.find(acc => acc.email === email);

    if (!account || !account.access_token) {
      await showAlert("刷新失败", "账号数据不完整", "error");
      return;
    }

    // 检查会员类型，如果是免费账号则直接返回
    if (account.membership_type === "free") {
      console.log("免费账号，跳过刷新状态");
      await showAlert("提示", "免费账号状态已更新", "info");
      return;
    }

    // 找到对应的刷新按钮并添加旋转动画
    const row = document.querySelector(`tr[data-email="${email}"]`);
    const refreshBtn = row?.querySelector('.refresh-status-btn svg');
    if (refreshBtn) {
      refreshBtn.style.animation = "rotate 1s linear infinite";
    }

    try {
      // 调用后端获取账号详细信息（5秒超时）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("获取账号信息超时（5秒）")), 5000);
      });

      const detailPromise = invoke("get_account_detail_info", {
        accessToken: account.access_token
      });

      const accountDetail = await Promise.race([detailPromise, timeoutPromise]);

      console.log("账号详细信息:", accountDetail);

      // 更新账号的订阅状态
      const membershipType = accountDetail.membership_type;
      const daysRemaining = accountDetail.days_remaining || 0;

      // 确定新的订阅状态
      let newPlan = "free";
      if (membershipType === "free") {
        newPlan = "free";
      } else if (membershipType === "pro") {
        newPlan = "pro";
      } else if (membershipType === "ultra") {
        newPlan = "ultra";
      } else if (membershipType === "pro_plus") {
        newPlan = "pro_plus";
      } else {
        newPlan = "pro_trial";
      }

      // 更新账号对象（添加 detailed_info）
      account.plan = newPlan;
      account.days_remaining = daysRemaining;
      account.membership_type = membershipType;
      account.detailed_info = accountDetail; // 添加详细信息
      account.updated_at = formatISODateTime(new Date().toISOString());

      // 保存更新后的账号
      await invoke("add_account", { data: account });

      // 停止动画
      if (refreshBtn) {
        refreshBtn.style.animation = "";
      }

      // 更新该行的显示（不重新加载整个页面）
      if (row) {
        updateAccountRow(row, account);
      }

      // 显示成功提示
      let statusText;
      if (membershipType === "free") {
        statusText = "Free";
      } else if (membershipType === "pro") {
        statusText = `Pro (剩余${daysRemaining}天)`;
      } else if (membershipType === "ultra") {
        statusText = `Ultra (剩余${daysRemaining}天)`;
      } else if (membershipType === "pro_plus") {
        statusText = `ProPlus (剩余${daysRemaining}天)`;
      } else {
        statusText = `Pro试用 (剩余${daysRemaining}天)`;
      }

      console.log(`✓ 账号状态已更新: ${statusText}`);

    } catch (detailError) {
      console.error("获取账号详细信息失败:", detailError);

      // 停止动画
      if (refreshBtn) {
        refreshBtn.style.animation = "";
      }

      throw detailError;
    }

  } catch (error) {
    console.error("刷新账号状态失败:", error);
    await showAlert("刷新失败", error.toString(), "error");

    // 停止动画
    const row = document.querySelector(`tr[data-email="${email}"]`);
    const refreshBtn = row?.querySelector('.refresh-status-btn svg');
    if (refreshBtn) {
      refreshBtn.style.animation = "";
    }
  }
}

// 挂载账号管理函数到 window 对象
window.handleSwitchToAccount = handleSwitchToAccount;
window.handleDeleteAccountFromList = handleDeleteAccountFromList;
window.handleRefreshAccountStatus = handleRefreshAccountStatus;
window.handleRefreshRemainingTime = handleRefreshRemainingTime;

/**
 * 处理刷新账号信息
 */
async function handleRefreshAccounts() {
  const refreshBtn = document.querySelector("#refresh-accounts-btn");
  const svg = refreshBtn.querySelector("svg");

  // 添加旋转动画
  svg.style.transform = "rotate(360deg)";
  svg.style.transition = "transform 0.3s ease";

  try {
    await loadAccountsPage();
  } catch (error) {
    console.error("刷新失败:", error);
  }

  // 动画完成后重置
  setTimeout(() => {
    svg.style.transform = "rotate(0deg)";
  }, 300);
}

/**
 * 处理复制 Token
 */
async function handleCopyToken() {
  try {
    const tokenDisplay = document.querySelector("#token-display code");
    if (!tokenDisplay) {
      return;
    }

    const token = tokenDisplay.textContent;

    // 使用现代剪贴板 API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(token);
      await showAlert("复制成功", "Token 已复制到剪贴板", "success");
    } else {
      // 降级方案：创建临时文本框
      const textarea = document.createElement("textarea");
      textarea.value = token;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);

      await showAlert("复制成功", "Token 已复制到剪贴板", "success");
    }
  } catch (error) {
    console.error("复制失败:", error);
    await showAlert("复制失败", error.toString(), "error");
  }
}

/**
 * 复制 Machine GUID 到剪贴板
 */
async function handleCopyMachineGuid() {
  try {
    const machineGuidElement = document.querySelector("#machine-guid");
    if (!machineGuidElement) {
      return;
    }

    const machineGuid = machineGuidElement.textContent;

    // 使用现代剪贴板 API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(machineGuid);
      console.log("✓ Machine GUID 已复制到剪贴板");
    } else {
      // 降级方案：创建临时文本框
      const textarea = document.createElement("textarea");
      textarea.value = machineGuid;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  } catch (error) {
    console.error("复制 Machine GUID 失败:", error);
  }
}

/**
 * 处理导出单个账号数据（废弃，使用导出所有账号）
 */
async function handleExportAccount() {
  // 重定向到导出所有账号
  await handleExportAllAccounts();
}

/**
 * 处理删除所有账号数据
 */
async function handleDeleteAccount() {
  try {
    // 确认删除操作
    const confirmed = await showConfirm(
      "确认删除",
      "确定要删除所有本地账号数据吗？\n\n此操作不可恢复。\n删除后需要重新使用「一键换号」功能。"
    );

    if (!confirmed) {
      return;
    }

    // 调用后端删除所有账号数据
    await invoke("clear_all_accounts");

    // 清空缓存
    cachedAccountsStorage = null;

    // 显示空状态
    showEmptyAccountState();
    renderAccountsList([]);

    // 显示成功提示
    await showAlert("删除成功", "所有账号数据已删除", "success");

  } catch (error) {
    console.error("删除账号数据失败:", error);
    await showAlert("删除失败", error.toString(), "error");
  }
}

// ==================== 时间格式化工具函数 ====================

/**
 * 将 ISO 时间字符串转换为友好的显示格式
 * @param {string} isoString - ISO 格式的时间字符串
 * @returns {string} 格式化后的时间字符串
 */
function formatISODateTime(isoString) {
  if (!isoString) return "-";

  try {
    const date = new Date(isoString);

    // 检查是否为有效日期
    if (isNaN(date.getTime())) {
      return isoString; // 如果解析失败，返回原始字符串
    }

    // 格式化为：YYYY-MM-DD HH:mm:ss
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error("时间格式化失败:", error);
    return isoString;
  }
}

/**
 * 将时间转换为相对时间描述
 * @param {string} timeString - 时间字符串
 * @returns {string} 相对时间描述
 */
function getRelativeTime(timeString) {
  if (!timeString) return "-";

  try {
    const date = new Date(timeString);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffSeconds < 60) {
      return "刚刚";
    } else if (diffMinutes < 60) {
      return `${diffMinutes} 分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours} 小时前`;
    } else if (diffDays < 7) {
      return `${diffDays} 天前`;
    } else {
      // 超过7天显示具体日期
      return formatISODateTime(timeString);
    }
  } catch (error) {
    return timeString;
  }
}

// ==================== 获取令牌页面功能 ====================

/**
 * 打开 Cursor 登录页
 */
async function handleOpenCursorLogin() {
  try {
    const loginUrl = "https://authenticator.cursor.sh/sign-in";
    console.log("正在打开 Cursor 登录页:", loginUrl);

    // 调用后端命令打开浏览器
    await invoke("open_url", { url: loginUrl });

    // 可选：显示提示
    console.log("✓ 已在浏览器中打开 Cursor 登录页");

  } catch (error) {
    console.error("打开登录页失败:", error);
    await showAlert("打开失败", `无法打开浏览器：${error}`, "error");
  }
}

/**
 * 解析 SessionToken 并添加账号
 */
async function handleParseSessionToken() {
  try {
    const sessionTokenInput = document.querySelector("#session-token-input");
    const sessionToken = sessionTokenInput.value.trim();

    if (!sessionToken) {
      await showAlert("提示", "请先粘贴 Token（支持 WebToken 或 SessionToken 格式）", "info");
      return;
    }

    console.log("正在解析 Token...");

    // 智能提取 Token（过滤无关字符）
    const extractedToken = extractTokenFromText(sessionToken);
    if (!extractedToken) {
      await showAlert("提取失败", "未能从输入内容中识别出有效的Token", "error");
      return;
    }

    console.log("提取的 Token:", extractedToken.substring(0, 50) + "...");

    // 显示加载提示
    const statusDiv = document.querySelector("#token-result");
    if (statusDiv) {
      statusDiv.innerHTML = '<p style="color: #ffa500;">正在解析 Token，请稍候...</p>';
    }

    // 调用后端命令解析 Token（自动检测并转换格式）
    const result = await invoke("parse_session_token_cmd", { sessionToken: extractedToken });

    console.log("✓ 解析成功:", result);

    // 提示用户已自动处理
    if (result.access_token) {
      console.log("✓ Token 已自动处理（短效 Token 会自动转换）");
    }

    // 显示解析结果
    displayTokenResult(result);

    // 验证必要字段存在
    if (!result.access_token) {
      console.error("❌ 解析结果缺少 access_token 字段", result);
      await showAlert("解析失败", "Token 解析不完整，缺少 AccessToken 字段\n\n请检查输入的 Token 是否完整", "error");
      return;
    }

    // 确保返回的是 SessionToken 格式
    if (!result.access_token.includes("%3A%3A")) {
      console.warn("⚠️ 返回的不是 SessionToken 格式");
    }

    // 自动保存到账号列表（使用 SessionToken）
    try {
      // 确保 access_token 是 SessionToken 格式
      if (!result.access_token.includes("%3A%3A")) {
        console.warn("⚠️ access_token 不是 SessionToken 格式，可能导致后续刷新失败");
      }

      const accountData = {
        email: result.email || "unknown@example.com",
        plan: result.plan || "unknown",
        sign_up_type: "Auth_0",
        auth_id: "",
        access_token: result.access_token,        // ← SessionToken
        refresh_token: result.refresh_token || result.access_token.replace("%3A%3A", "::"), // ← 未编码版本
        machine_id: "",
        service_machine_id: "",
        dev_device_id: "",
        mac_machine_id: "",
        machine_id_telemetry: "",
        sqm_id: "",
        sqm_id: "",
        note: `从 SessionToken 导入于 ${new Date().toLocaleString()}`
      };

      await invoke("add_account", { data: accountData });
      console.log("✓ 账号已保存到本地");

      // 刷新缓存
      cachedAccountsStorage = await loadLocalAccountsStorage();

      // 清空输入框
      sessionTokenInput.value = "";

      // 显示成功并询问是否立即切换
      const shouldSwitch = await showConfirm(
        "导入成功",
        `账号 ${result.email} 已成功导入到账号列表！\n\n是否立即切换到此账号？`
      );

      if (shouldSwitch) {
        try {
          // 首先检查 Cursor 是否已登录
          const isCursorLoggedIn = await checkCursorLogin();
          if (!isCursorLoggedIn) {
            console.log("❌ Cursor 未登录，账号切换操作已取消");
            await showAlert("提示", "账号已成功导入，但切换操作已取消。\n\n请登录 Cursor 后，在账号列表中手动切换。", "info");
            return;
          }

          // 获取邮箱隐私设置
          const emailPrivacyEnabled = getEmailPrivacySetting();

          // 直接使用解析得到的 access_token 进行换号
          const switchResult = await invoke("switch_account", {
            accessToken: result.access_token,
            enableEmailPrivacy: emailPrivacyEnabled
          });

          await showAlert("切换成功", "已成功切换到新账号！", "success");

          // 切换到使用情况页面并刷新数据
          const usageLink = document.querySelector('.nav-item[data-page="usage"]');
          if (usageLink) {
            usageLink.click();
          }
          await loadUsageData();

        } catch (switchError) {
          console.error("切换账号失败:", switchError);
          await showAlert("切换失败", `切换账号时出错：${switchError}`, "error");
        }
      }

    } catch (saveError) {
      console.error("保存账号失败:", saveError);
      await showAlert("保存失败", `账号解析成功但保存失败：${saveError}`, "error");
    }

  } catch (error) {
    console.error("解析 Token 失败:", error);
    await showAlert("解析失败", `无法解析 Token：${error}\n\n请检查：\n1. 是否完整复制了 Token 的值\n2. Token 格式是否正确（支持 WebToken 和 SessionToken）`, "error");
  }
}

/**
 * 显示 Token 解析结果
 * @param {Object} result - 解析结果
 */
function displayTokenResult(result) {
  const resultCard = document.querySelector("#token-result-card");
  const resultContent = document.querySelector("#token-result-content");

  if (!resultCard || !resultContent) {
    return;
  }

  // 防御性检查：确保 access_token 存在
  if (!result.access_token) {
    console.error("❌ 解析结果中缺少 access_token 字段", result);
    resultContent.innerHTML = `
      <div class="error-message">
        <p>⚠️ Token 解析失败：缺少 AccessToken</p>
        <p>请检查输入的 Token 格式是否正确</p>
      </div>
    `;
    resultCard.style.display = "block";
    return;
  }

  // 应用邮箱隐私保护
  const displayEmail = maskEmail(result.email);

  // 构造结果 HTML
  const html = `
    <div class="result-info-grid">
      <div class="result-info-item">
        <span class="result-label">邮箱</span>
        <span class="result-value" data-original-email="${result.email}">${displayEmail}</span>
      </div>
      <div class="result-info-item">
        <span class="result-label">用户 ID</span>
        <span class="result-value monospace">${result.user_id || "未知"}</span>
      </div>
      <div class="result-info-item">
        <span class="result-label">套餐</span>
        <span class="result-value">${result.plan || "未知"}</span>
      </div>
      <div class="result-info-item full-width">
        <span class="result-label">AccessToken</span>
        <div class="result-token">
          <code>${result.access_token.substring(0, 50)}...</code>
          <button class="copy-token-btn" onclick="copyToClipboard('${result.access_token}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;

  resultContent.innerHTML = html;
  resultCard.style.display = "block";

  // 滚动到结果区域
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      console.log("✓ 已复制到剪贴板");
    } else {
      // 降级方案
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    // 简单的视觉反馈（可选）
    const btn = event.target.closest("button");
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      `;
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 1000);
    }
  } catch (error) {
    console.error("复制失败:", error);
  }
}

// 挂载复制函数到 window 对象
window.copyToClipboard = copyToClipboard;

// ==================== 邮箱隐私保护功能 ====================

// 激活码
const ACTIVATION_CODE = "1421148240";

/**
 * 获取邮箱隐私设置
 * 默认开启隐私保护
 */
function getEmailPrivacySetting() {
  const setting = localStorage.getItem("emailPrivacyEnabled");
  // 如果没有设置过，默认返回 true（开启）
  if (setting === null) {
    return true;
  }
  return setting === "true";
}

/**
 * 设置邮箱隐私
 */
function setEmailPrivacySetting(enabled) {
  localStorage.setItem("emailPrivacyEnabled", enabled.toString());
}

/**
 * 邮箱脱敏函数
 * @param {string} email - 原始邮箱
 * @returns {string} 脱敏后的邮箱
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") {
    return email;
  }

  // 如果隐私保护未开启，直接返回原邮箱
  if (!getEmailPrivacySetting()) {
    return email;
  }

  // 提取 @ 前面的部分
  const atIndex = email.indexOf("@");
  if (atIndex === -1) {
    return email;
  }

  const username = email.substring(0, atIndex);
  return `${username}@**`;
}

/**
 * 更新邮箱隐私状态显示
 */
function updatePrivacyStatus() {
  const statusText = document.querySelector("#privacy-status-text");
  const statusBadge = document.querySelector("#privacy-status-badge");

  if (!statusText || !statusBadge) {
    return;
  }

  const isEnabled = getEmailPrivacySetting();

  if (isEnabled) {
    statusText.textContent = "当前状态：已开启";
    statusBadge.textContent = "已开启";
    statusBadge.className = "status-badge active";
  } else {
    statusText.textContent = "当前状态：已关闭";
    statusBadge.textContent = "已关闭";
    statusBadge.className = "status-badge inactive";
  }
}

/**
 * 切换邮箱隐私模式
 */
async function handleTogglePrivacy() {
  try {
    // 弹出输入框要求输入激活码
    const code = await showInput("请输入激活码以切换邮箱隐私模式", "激活码");

    if (!code || code.trim() === "") {
      return;
    }

    // 验证激活码
    if (code.trim() !== ACTIVATION_CODE) {
      await showAlert("激活码错误", "激活码不正确，请重试", "error");
      return;
    }

    // 切换状态
    const currentState = getEmailPrivacySetting();
    const newState = !currentState;
    setEmailPrivacySetting(newState);

    // 更新显示
    updatePrivacyStatus();

    // 刷新所有显示邮箱的页面
    await loadUsageData();

    // 显示成功提示
    const message = newState
      ? "邮箱隐私保护已开启\n所有邮箱地址将隐藏后缀部分"
      : "邮箱隐私保护已关闭\n所有邮箱地址将完整显示";
    await showAlert("设置成功", message, "success");

  } catch (error) {
    console.error("切换邮箱隐私失败:", error);
  }
}

// ==================== 实用工具页面功能 ====================

/**
 * 切换禁用更新状态
 */
async function handleToggleDisableUpdate() {
  try {
    console.log("正在切换禁用更新状态...");

    // 获取当前状态
    const currentStatus = await invoke("is_cursor_update_disabled_cmd");
    const newStatus = !currentStatus; // 切换状态

    // 调用切换命令
    const result = await invoke("toggle_disable_update_cmd", { disabled: newStatus });

    console.log(`✓ 已${newStatus ? "禁用" : "启用"}更新`);

    // 更新 UI 显示
    updateDisableUpdateStatus(newStatus);

    // 显示成功提示
    await showAlert(
      newStatus ? "已禁用更新" : "已启用更新",
      result,
      "success"
    );

  } catch (error) {
    console.error("切换禁用更新状态失败:", error);
    await showAlert("操作失败", error.toString(), "error");
  }
}

/**
 * 更新禁用更新状态显示
 */
function updateDisableUpdateStatus(disabled) {
  const statusText = document.querySelector("#update-status-text");
  const statusBadge = document.querySelector("#update-status-badge");

  if (disabled) {
    if (statusText) statusText.textContent = "当前状态：已禁用更新";
    if (statusBadge) {
      statusBadge.textContent = "已禁用";
      statusBadge.classList.add("active");
    }
  } else {
    if (statusText) statusText.textContent = "当前状态：已启用更新";
    if (statusBadge) {
      statusBadge.textContent = "已启用";
      statusBadge.classList.remove("active");
    }
  }
}

/**
 * 加载禁用更新状态
 */
async function loadDisableUpdateStatus() {
  try {
    const disabled = await invoke("is_cursor_update_disabled_cmd");
    updateDisableUpdateStatus(disabled);
  } catch (error) {
    console.error("加载禁用更新状态失败:", error);
    const statusText = document.querySelector("#update-status-text");
    if (statusText) statusText.textContent = "当前状态：读取失败";
  }
}

/**
 * 禁用 HTTP/2
 */
async function handleDisableHttp2() {
  try {
    console.log("正在禁用 HTTP/2...");

    const result = await invoke("disable_http2_cmd");

    console.log("✓ HTTP/2 已禁用");
    await showAlert("禁用成功", result, "success");

  } catch (error) {
    console.error("禁用 HTTP/2 失败:", error);
    await showAlert("操作失败", error.toString(), "error");
  }
}

/**
 * 恢复 HTTP/2
 */
async function handleEnableHttp2() {
  try {
    console.log("正在恢复 HTTP/2...");

    const result = await invoke("enable_http2_cmd");

    console.log("✓ HTTP/2 已恢复");
    await showAlert("恢复成功", result, "success");

  } catch (error) {
    console.error("恢复 HTTP/2 失败:", error);
    await showAlert("操作失败", error.toString(), "error");
  }
}

/**
 * 设置代理
 */
async function handleSetProxy() {
  try {
    const portInput = document.querySelector("#proxy-port-input");
    const port = parseInt(portInput.value);

    // 验证端口号
    if (!port || port < 1 || port > 65535) {
      await showAlert("参数错误", "请输入有效的端口号（1-65535）", "error");
      return;
    }

    console.log(`正在设置代理端口: ${port}...`);

    const result = await invoke("set_proxy_cmd", { port });

    console.log("✓ 代理已设置");
    await showAlert("设置成功", result, "success");

  } catch (error) {
    console.error("设置代理失败:", error);
    await showAlert("操作失败", error.toString(), "error");
  }
}

/**
 * 移除代理
 */
async function handleRemoveProxy() {
  try {
    console.log("正在移除代理...");

    const result = await invoke("remove_proxy_cmd");

    console.log("✓ 代理已移除");
    await showAlert("移除成功", result, "success");

  } catch (error) {
    console.error("移除代理失败:", error);
    await showAlert("操作失败", error.toString(), "error");
  }
}

// ==================== 验证码监听器 ====================

/**
 * 设置验证码事件监听器
 * 使用 Tauri 事件系统监听 Rust 发送的事件
 * 注意：此函数在页面加载时调用，确保监听器一直存在
 */
function setupVerificationCodeListener() {
  try {
    console.log("🔧 注册验证码事件监听器...");

    // 使用 Tauri Core 事件系统
    const { event } = window.__TAURI__;

    if (!event || !event.listen) {
      console.error("❌ Tauri 事件系统不可用");
      return;
    }

    // 监听 Python 日志输出（同时显示在控制台和注册日志）
    event.listen("python-log", (ev) => {
      const message = ev.payload;
      console.log("[Python]", message);

      // 同时添加到页面注册日志
      // 过滤掉一些调试信息，只显示关键日志
      if (!message.includes("[DEBUG]") && !message.includes("sys.argv")) {
        // 仅在自动注册页面时添加日志
        const addRegisterLogFn = window.addRegisterLog || (() => { });
        addRegisterLogFn(message);
      }
    });

    // 监听验证码请求事件
    event.listen("verification-code-request", async (ev) => {
      console.log("🔔 收到验证码请求事件", ev);
      console.log("🔔 准备弹出验证码输入框...");

      try {
        const addRegisterLogFn = window.addRegisterLog || (() => { });
        addRegisterLogFn("📱 需要输入验证码");

        // 弹窗让用户输入
        const code = await showInput("输入验证码", "请输入邮箱收到的6位验证码：");
        console.log("✅ 用户输入的验证码:", code);

        if (code && /^\d{6}$/.test(code)) {
          try {
            // 发送验证码给 Python
            await invoke("send_verification_code", { code });
            addRegisterLogFn(`✅ 验证码已发送: ${code}`);
            console.log("✅ 验证码已发送给 Python");
          } catch (error) {
            console.error("发送验证码失败:", error);
            addRegisterLogFn(`❌ 发送验证码失败: ${error}`);
          }
        } else if (code) {
          addRegisterLogFn(`❌ 验证码格式错误: ${code}`);
          await showAlert("验证码错误", "验证码必须是6位数字", "error");
        } else {
          console.log("⚠️ 用户取消输入");
          addRegisterLogFn("❌ 用户取消输入验证码");
        }
      } catch (error) {
        console.error("❌ 处理验证码请求失败:", error);
      }
    });

    console.log("✅ 验证码监听器已设置（全局）");
  } catch (error) {
    console.error("❌ 设置验证码监听器失败:", error);
  }
}

// ==================== 配置备份页面功能 ====================

// ============= 配置备份功能 =============

// handleCreateBackup 函数已在上面定义

/**
 * 刷新备份列表
 */
async function handleRefreshBackups() {
  const refreshBtn = document.querySelector("#refresh-backups-btn");
  const svg = refreshBtn.querySelector("svg");

  // 添加旋转动画
  svg.style.transform = "rotate(360deg)";
  svg.style.transition = "transform 0.3s ease";

  try {
    await loadBackupList();
    await showAlert("刷新成功", "备份列表已更新", "success");
  } catch (error) {
    console.error("刷新备份列表失败:", error);
    await showAlert("刷新失败", error.toString(), "error");
  } finally {
    // 重置动画
    setTimeout(() => {
      svg.style.transform = "";
    }, 300);
  }
}

/**
 * 加载备份列表
 */
async function loadBackupList() {
  try {
    const backups = await invoke("list_config_backups");
    displayBackupList(backups);
    // 标记页面已加载
    markPageLoaded("backup");
  } catch (error) {
    console.error("加载备份列表失败:", error);
    displayBackupList([]);
    // 即使失败也标记为已加载，避免重复尝试
    markPageLoaded("backup");
  }
}

/**
 * 显示备份列表
 */
function displayBackupList(backups) {
  const backupList = document.querySelector("#backup-list");

  if (!backups || backups.length === 0) {
    backupList.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">
          <div class="empty-state-small">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <p>暂无备份记录</p>
            <p class="empty-hint">点击"备份当前配置"创建第一个备份</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  backupList.innerHTML = backups.map(backup => {
    // 处理配置文件列表
    const filesHTML = backup.files && backup.files.length > 0
      ? `<div class="backup-files-tags">
          ${backup.files.map(file => `<span class="backup-file-tag">${file}</span>`).join('')}
         </div>`
      : '<span class="backup-file-tag">无文件信息</span>';

    return `
      <tr>
        <td class="col-backup-name">
          <span class="backup-name">${backup.name || '未命名备份'}</span>
        </td>
        <td class="col-backup-files">
          ${filesHTML}
        </td>
        <td class="col-backup-time">
          <span class="backup-time">${backup.created_at ? formatISODateTime(backup.created_at) : '未知时间'}</span>
        </td>
        <td class="col-backup-actions">
          <div class="backup-actions-group">
            <button class="backup-action-btn restore" onclick="handleRestoreBackup('${backup.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              恢复
            </button>
            <button class="backup-action-btn delete" onclick="handleDeleteBackup('${backup.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              删除
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/**
 * 恢复备份
 */
async function handleRestoreBackup(backupId) {
  const confirmed = await showConfirm(
    "恢复备份",
    "恢复备份将覆盖当前配置，此操作不可撤销。是否继续？"
  );

  if (!confirmed) return;

  try {
    await invoke("restore_config_backup", { backupId });
    await showAlert("恢复成功", "配置已恢复，请重启 Cursor", "success");
    await loadBackupList();
  } catch (error) {
    console.error("恢复备份失败:", error);
    await showAlert("恢复失败", error.toString(), "error");
  }
}

// 将函数暴露到全局作用域，供 onclick 调用
window.handleRestoreBackup = handleRestoreBackup;

/**
 * 加载并显示当前 Cursor 安装路径
 */
async function loadCursorPath() {
  const pathDisplay = document.querySelector("#cursor-path-display");
  if (!pathDisplay) return;

  try {
    // 调用后端命令获取当前保存的或自动检测的 Cursor 路径
    // Tauri 的 invoke 会自动处理 JSON 序列化，返回的已经是 JavaScript 对象
    const pathInfo = await invoke("get_or_detect_cursor_path_cmd");

    if (pathInfo && pathInfo.exe_path) {
      pathDisplay.value = pathInfo.exe_path;
      pathDisplay.placeholder = "";
      console.log("✓ Cursor 路径已加载:", pathInfo.exe_path);
    } else {
      pathDisplay.value = "";
      pathDisplay.placeholder = "未检测到 Cursor 安装路径，请手动设置";
      console.log("⚠ 未检测到 Cursor 路径");
    }
  } catch (error) {
    console.warn("⚠ 加载 Cursor 路径失败:", error);
    pathDisplay.value = "";
    pathDisplay.placeholder = "未检测到 Cursor（请手动设置）";
  }
}

/**
 * 选择 Cursor 安装路径
 */
async function handleSelectCursorPath() {
  try {
    console.log("📂 打开 Cursor 路径选择对话框...");

    // 调用后端命令打开文件选择对话框
    // Tauri 的 invoke 会自动处理 JSON 序列化，返回的已经是 JavaScript 对象
    const pathInfo = await invoke("select_cursor_exe");

    if (pathInfo && pathInfo.exe_path) {
      console.log("✓ Cursor 路径已保存:", pathInfo.exe_path);

      // 更新显示
      const pathDisplay = document.querySelector("#cursor-path-display");
      if (pathDisplay) {
        pathDisplay.value = pathInfo.exe_path;
        pathDisplay.placeholder = "";
      }

      // 显示成功提示
      await showAlert(
        "设置成功",
        `Cursor 路径已设置：\n${pathInfo.exe_path}\n\n后续换号和补丁操作将使用此路径。`,
        "success"
      );
    }
  } catch (error) {
    console.error("❌ 选择 Cursor 路径失败:", error);

    // 如果用户取消，不显示错误
    if (error.toString().includes("取消") || error.toString().includes("cancel")) {
      console.log("用户取消选择");
      return;
    }

    await showAlert(
      "选择失败",
      `无法设置 Cursor 路径：\n${error}`,
      "error"
    );
  }
}

/**
 * 删除备份
 */
async function handleDeleteBackup(backupId) {
  const confirmed = await showConfirm(
    "删除备份",
    "确定要删除这个备份吗？此操作不可撤销。"
  );

  if (!confirmed) return;

  try {
    await invoke("delete_config_backup", { backupId });
    await showAlert("删除成功", "备份已删除", "success");
    await loadBackupList();
  } catch (error) {
    console.error("删除备份失败:", error);
    await showAlert("删除失败", error.toString(), "error");
  }
}

// 将函数暴露到全局作用域，供 onclick 调用
window.handleDeleteBackup = handleDeleteBackup;

// ==================== 无感换号功能 ====================

/**
 * 初始化无感换号页面
 */
async function initSeamlessPage() {
  console.log("📍 [Seamless] 初始化无感换号页面...");

  // 绑定按钮事件
  const detectBtn = document.querySelector("#seamless-detect-btn");
  if (detectBtn) {
    detectBtn.addEventListener("click", handleSeamlessDetect);
  }

  const applyBtn = document.querySelector("#seamless-apply-btn");
  if (applyBtn) {
    applyBtn.addEventListener("click", handleSeamlessApply);
  }

  const removeBtn = document.querySelector("#seamless-remove-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", handleSeamlessRemove);
  }

  const saveConfigBtn = document.querySelector("#seamless-save-config-btn");
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener("click", handleSeamlessSaveConfig);
  }

  // 绑定模式切换事件
  const modeRadios = document.querySelectorAll('input[name="seamless-mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener("change", handleSeamlessModeChange);
  });

  // 加载配置
  await loadSeamlessConfig();

  // 检测状态
  await handleSeamlessDetect();

  console.log("✓ [Seamless] 页面初始化完成");
}

/**
 * 处理换号模式切换
 */
function handleSeamlessModeChange(e) {
  const mode = e.target.value;
  console.log("[Seamless] 模式切换为:", mode === "local" ? "本地账号池" : "激活码换号");
}

/**
 * 加载无感换号配置
 */
async function loadSeamlessConfig() {
  try {
    const config = await invoke("load_seamless_config");
    console.log("[Seamless] 配置加载成功:", config);

    // 设置模式（local 或 activation）
    const mode = config.mode || "local";
    const modeRadio = document.querySelector(`input[name="seamless-mode"][value="${mode}"]`);
    if (modeRadio) {
      modeRadio.checked = true;
    }
  } catch (error) {
    console.error("[Seamless] 加载配置失败:", error);
  }
}

/**
 * 检测Cursor状态
 */
async function handleSeamlessDetect() {
  console.log("[Seamless] 开始检测状态...");

  const versionEl = document.querySelector("#seamless-cursor-version");
  const pathEl = document.querySelector("#seamless-workbench-path");
  const statusEl = document.querySelector("#seamless-patch-status");
  const signatureEl = document.querySelector("#seamless-version-signature");

  try {
    // 设置检测中状态
    if (versionEl) versionEl.textContent = "检测中...";
    if (pathEl) pathEl.textContent = "检测中...";
    if (statusEl) {
      statusEl.textContent = "检测中";
      statusEl.className = "status-badge";
    }

    const result = await invoke("detect_seamless_state");
    console.log("[Seamless] 检测结果:", result);

    // 更新版本
    if (versionEl) {
      versionEl.textContent = result.cursor_version || "未知";
    }

    // 更新路径
    if (pathEl) {
      if (result.workbench_path) {
        // 截取显示路径
        const path = result.workbench_path;
        pathEl.textContent = path.length > 50 ? "..." + path.slice(-50) : path;
        pathEl.title = path;
      } else {
        pathEl.textContent = "未找到";
      }
    }

    // 更新补丁状态
    if (statusEl) {
      if (result.is_patched) {
        statusEl.textContent = "已应用";
        statusEl.className = "status-badge patched";
      } else {
        statusEl.textContent = "未应用";
        statusEl.className = "status-badge not-patched";
      }
    }

    // 更新版本特征
    if (signatureEl) {
      signatureEl.textContent = result.matched_rule || "自动检测";
    }

  } catch (error) {
    console.error("[Seamless] 检测失败:", error);

    if (versionEl) versionEl.textContent = "检测失败";
    if (pathEl) pathEl.textContent = error.toString();
    if (statusEl) {
      statusEl.textContent = "错误";
      statusEl.className = "status-badge error";
    }
  }
}

/**
 * 应用无感换号补丁
 */
async function handleSeamlessApply() {
  console.log("[Seamless] 开始应用补丁...");

  // 获取模式选择
  const modeRadio = document.querySelector('input[name="seamless-mode"]:checked');
  const mode = modeRadio?.value || "local";

  // 模式描述
  const modeDesc = mode === "local"
    ? "本地模式：将从「账号管理」中的账号列表自动切换"
    : "激活码模式：将复用「自动一键换号」功能从后端获取账号";

  const confirmed = await showConfirm(
    "应用补丁",
    `确定要应用无感换号补丁吗？\n\n${modeDesc}\n\n请确保已关闭Cursor编辑器。\n补丁会修改Cursor的核心文件，更新Cursor后需要重新应用。`
  );

  if (!confirmed) return;

  try {
    // 根据模式构建参数
    // local模式: customerId为空，使用本地账号池
    // activation模式: customerId设置为"activation"，使用激活码机制
    const customerId = mode === "activation" ? "activation" : "";
    const apiBaseUrl = "";  // 不再需要API地址配置

    const details = await invoke("apply_seamless_patch", {
      customerId,
      apiBaseUrl
    });

    console.log("[Seamless] 补丁应用成功:", details);

    // 显示详细结果
    let message = "补丁应用成功！\n\n";
    for (const detail of details) {
      const icon = detail.status === "Applied" ? "[OK]" :
        detail.status === "Skipped" ? "[跳过]" : "[失败]";
      message += `${icon} ${detail.rule_name}\n`;
    }
    message += `\n当前模式: ${mode === "local" ? "本地账号池" : "激活码换号"}`;
    message += "\n重新启动Cursor后生效。";

    await showAlert("应用成功", message, "success");

    // 重新检测状态
    await handleSeamlessDetect();

  } catch (error) {
    console.error("[Seamless] 应用补丁失败:", error);
    await showAlert("应用失败", error.toString(), "error");
  }
}

/**
 * 移除无感换号补丁
 */
async function handleSeamlessRemove() {
  console.log("[Seamless] 开始移除补丁...");

  const confirmed = await showConfirm(
    "移除补丁",
    "确定要移除无感换号补丁吗？\n\n将从备份恢复原始文件。"
  );

  if (!confirmed) return;

  try {
    const message = await invoke("remove_seamless_patch");
    console.log("[Seamless] 补丁移除成功:", message);

    await showAlert("移除成功", message, "success");

    // 重新检测状态
    await handleSeamlessDetect();

  } catch (error) {
    console.error("[Seamless] 移除补丁失败:", error);
    await showAlert("移除失败", error.toString(), "error");
  }
}

/**
 * 保存无感换号配置
 */
async function handleSeamlessSaveConfig() {
  console.log("[Seamless] 保存配置...");

  const modeRadio = document.querySelector('input[name="seamless-mode"]:checked');
  const mode = modeRadio?.value || "local";

  const config = {
    config_version: "1.0.0",
    mode: mode,
    customer_id: mode === "activation" ? "activation" : "",
    api_base_url: "",
    enabled: true,
    version_rules: []
  };

  try {
    await invoke("save_seamless_config", { config });
    console.log("[Seamless] 配置保存成功");
    await showAlert("保存成功", `配置已保存\n当前模式: ${mode === "local" ? "本地账号池" : "激活码换号"}`, "success");
  } catch (error) {
    console.error("[Seamless] 保存配置失败:", error);
    await showAlert("保存失败", error.toString(), "error");
  }
}

// 在页面切换时初始化无感换号页面
const originalInitNavigation = initNavigation;

// 重写导航初始化以支持无感换号页面
(function () {
  const originalNavItems = document.querySelectorAll(".nav-item");

  // 监听hash变化来触发无感换号页面初始化
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "seamless") {
      initSeamlessPage();
    }
  });

  // 如果当前就在seamless页面
  if (window.location.hash === "#seamless") {
    setTimeout(initSeamlessPage, 100);
  }
})();
