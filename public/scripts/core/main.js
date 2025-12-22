// public/scripts/core/main.js (動態載入增強版)
// 職責：系統初始化入口與動態腳本調度

window.CRM_APP = window.CRM_APP || {
    systemConfig: {},
    pageModules: {},
    formTemplates: {},
    pageConfig: {
        'dashboard': { title: '儀表板', subtitle: '以機會為核心的客戶關係管理平台', loaded: false },
        'contacts': { title: '潛在客戶管理', subtitle: '管理名片掃描與初步接觸的客戶資料', loaded: false },
        'opportunities': { title: '機會案件', subtitle: '追蹤所有銷售機會的進度與金額', loaded: false },
        'opportunity-details': { title: '機會詳情', subtitle: '查看與編輯特定機會的完整資訊', loaded: false },
        'events': { title: '事件紀錄', subtitle: '管理所有的會議、電訪與技術拜訪紀錄', loaded: false },
        'weekly-business': { title: '週間業務', subtitle: '管理每週的業務重點與行動計畫', loaded: false },
        'companies': { title: '公司管理', subtitle: '集中管理客戶公司與通路的基礎資料', loaded: false },
        'company-details': { title: '公司詳情', subtitle: '查看公司的聯絡人、機會與互動歷程', loaded: false },
        'interactions': { title: '互動總覽', subtitle: '查看系統中所有的互動時間軸', loaded: false },
        'announcements': { title: '佈告欄', subtitle: '查看系統最新公告與消息', loaded: false },
        'sales-analysis': { title: '受注分析', subtitle: '分析業務受注狀況與地圖分布', loaded: false },
        'follow-up': { title: '待追蹤提醒', subtitle: '顯示最近需要跟進的機會與任務', loaded: false }
    }
};

/**
 * 腳本動態載入工具
 */
CRM_APP.ScriptLoader = {
    loadedScripts: new Set(),

    async load(urls) {
        if (!Array.isArray(urls)) urls = [urls];
        const promises = urls.map(url => this.loadSingle(url));
        return Promise.all(promises);
    },

    loadSingle(url) {
        if (this.loadedScripts.has(url)) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url.startsWith('http') ? url : `/${url}?v=${Date.now()}`;
            script.async = false; // 保持清單中的執行順序
            script.onload = () => {
                this.loadedScripts.add(url);
                resolve();
            };
            script.onerror = () => reject(new Error(`無法載入腳本: ${url}`));
            document.body.appendChild(script);
        });
    }
};

CRM_APP.init = async function() {
    console.log('🚀 [Main] TFC CRM系統啟動中...');
    try {
        // 1. 載入腳本設定與核心腳本 (這會載入 Router, API, UI 等)
        await this.ScriptLoader.loadSingle('scripts/core/scripts-config.js');
        await this.ScriptLoader.load(window.CRM_SCRIPTS_CONFIG.core);
        console.log('📦 [Main] 核心腳本載入完成');

        // 2. 載入靜態資源 (HTML 組件與事件樣板)
        await this.loadResources();

        // 3. 載入伺服器設定
        await this.loadConfig();

        // 4. 初始化 UI 佈局
        if (window.LayoutManager) LayoutManager.init();

        // 5. 啟動資料輪詢
        this.startDataPolling();

        // 6. 初始化導航系統 (此時 Router 已經載入)
        if (window.Router) Router.init();

        // 7. 處理初始路徑
        await this.handleInitialRoute();

        console.log('✅ [Main] 系統完全載入！');
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            console.error('❌ [Main] 初始化失敗:', err);
            if (window.showNotification) showNotification(`初始化失敗: ${err.message}`, 'error', 10000);
        }
    }
};

CRM_APP.loadConfig = async function() {
    try {
        const data = await authedFetch('/api/config');
        if (data && this.updateAllDropdowns) {
            this.systemConfig = data;
            this.updateAllDropdowns();
        }
    } catch (err) {
        console.error('[Main] 載入 Config 失敗:', err);
    }
};

CRM_APP.handleInitialRoute = async function() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const [pageName, paramsString] = hash.split('?');
        if (this.pageConfig[pageName]) {
            let params = {};
            if (paramsString) params = Object.fromEntries(new URLSearchParams(paramsString));
            await this.navigateTo(pageName, params, false);
            return;
        }
    }
    await this.navigateTo('dashboard', {}, false);
    window.history.replaceState(null, '', '#dashboard');
};

CRM_APP.loadResources = async function() {
    const components = [
        'contact-modals', 'opportunity-modals', 'meeting-modals', 
        'system-modals', 'event-log-modal', 'link-contact-modal', 
        'link-opportunity-modal', 'announcement-modals'
    ];
    
    const container = document.getElementById('modal-container');
    if (container) {
        const htmls = await Promise.all(components.map(c => 
            fetch(`/components/modals/${c}.html`).then(res => res.text())
        ));
        container.innerHTML = htmls.join('');
    }

    const types = ['general', 'iot', 'dt', 'dx'];
    const templates = await Promise.all(types.map(t => {
        const file = `/components/forms/event-form-${t === 'dx' ? 'general' : t}.html`;
        return fetch(file).then(res => res.text()).then(html => ({ t, html }));
    }));
    templates.forEach(({ t, html }) => this.formTemplates[t] = html);
};

// 全域啟動監聽
document.addEventListener('DOMContentLoaded', () => {
    if (!window.CRM_APP_INITIALIZED) {
        window.CRM_APP_INITIALIZED = true;
        CRM_APP.init();
    }
});

// 全域小工具
function getCurrentUser() {
    return window.CRM_APP?.currentUser || localStorage.getItem('crmCurrentUserName') || '系統';
}

function logout() {
    localStorage.removeItem('crm-token');
    localStorage.removeItem('crmCurrentUserName');
    window.location.href = '/';
}

// 支援原本的資料輪詢 (如有需要)
CRM_APP.startDataPolling = function() {
    if (window.SyncService && typeof window.SyncService.start === 'function') {
        window.SyncService.start();
    }
};