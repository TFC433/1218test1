// public/scripts/core/router.js (動態載入增強版)
// 職責：處理導航並按需加載腳本

window.CRM_APP = window.CRM_APP || {};

const Router = {
    init() {
        console.log('🌐 [Router] 初始化導航監聽...');
        window.addEventListener('hashchange', () => this.handleHashChange());
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-page]');
            if (target) {
                e.preventDefault();
                const pageName = target.dataset.page;
                let params = {};
                if (target.dataset.params) {
                    try { params = JSON.parse(target.dataset.params); } catch (err) {}
                }
                this.navigateTo(pageName, params);
            }
        });
    },

    async navigateTo(pageName, params = {}, updateHistory = true) {
        const config = window.CRM_APP.pageConfig[pageName];
        if (!config) return this.navigateTo('dashboard', {}, false);

        // --- 【新增：動態載入腳本邏輯】 ---
        const featureScripts = window.CRM_SCRIPTS_CONFIG?.features[pageName];
        if (featureScripts) {
            console.log(`📦 [Router] 正在載入頁面腳本: ${pageName}...`);
            await CRM_APP.ScriptLoader.load(featureScripts);
        }
        // --- 【結束】 ---

        // 更新 URL
        if (updateHistory) {
            let newHash = `#${pageName}`;
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => { if (v != null) searchParams.set(k, String(v)); });
            if (searchParams.toString()) newHash += `?${searchParams.toString()}`;
            if (window.location.hash !== newHash) window.history.pushState(null, '', newHash);
        }

        // 切換 UI
        this.updateActiveState(pageName, config);
        this.switchView(pageName);

        // 執行模組載入
        if (pageName === 'dashboard') {
            if (window.dashboardManager?.refresh) await window.dashboardManager.refresh();
        } else {
            const loadFn = window.CRM_APP.pageModules[pageName];
            if (loadFn) {
                const isDetailPage = pageName.includes('-details');
                if (isDetailPage) {
                    let paramValue = params.weekId || params.opportunityId || params.companyName || Object.values(params)[0];
                    await loadFn(paramValue);
                } else if (!config.loaded) {
                    await loadFn();
                    config.loaded = true;
                }
            }
        }
    },

    updateActiveState(pageName, config) {
        const titleEl = document.getElementById('page-title');
        const subtitleEl = document.getElementById('page-subtitle');
        if (titleEl) titleEl.textContent = config.title;
        if (subtitleEl) subtitleEl.textContent = config.subtitle;

        document.querySelectorAll('.nav-list .nav-item').forEach(i => i.classList.remove('active'));
        const isDetailPage = pageName.includes('-details');
        let activePage = pageName;
        if (pageName === 'opportunity-details') activePage = 'opportunities';
        if (pageName === 'company-details') activePage = 'companies';
        
        document.querySelector(`.nav-link[data-page="${activePage}"]`)?.closest('.nav-item')?.classList.add('active');
    },

    switchView(pageName) {
        document.querySelectorAll('.page-view').forEach(v => v.style.display = 'none');
        const targetView = document.getElementById(`page-${pageName}`);
        if (targetView) targetView.style.display = 'block';
    },

    handleHashChange() {
        const hash = window.location.hash.substring(1);
        const [pageName, paramsString] = hash.split('?');
        if (window.CRM_APP.pageConfig[pageName]) {
            const params = Object.fromEntries(new URLSearchParams(paramsString));
            this.navigateTo(pageName, params, false);
        }
    }
};

window.CRM_APP.navigateTo = Router.navigateTo.bind(Router);
window.Router = Router;