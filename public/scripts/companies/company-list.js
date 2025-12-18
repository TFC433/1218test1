// views/scripts/company-list.js
// 職責：管理「公司總覽列表頁」的載入、圖表渲染、篩選與搜尋功能

// 全域變數
let allCompaniesData = [];
let companyListFilters = { type: 'all', stage: 'all', rating: 'all' };
let currentSort = { field: 'lastActivity', direction: 'desc' };

/**
 * 載入並渲染公司列表頁面的主函式
 */
async function loadCompaniesListPage() {
    const container = document.getElementById('page-companies');
    if (!container) return;

    // 1. 渲染頁面骨架
    container.innerHTML = `
        <div id="companies-dashboard-container" class="dashboard-grid-flexible" style="margin-bottom: 24px;">
            <div class="loading show" style="grid-column: span 12;"><div class="spinner"></div><p>載入分析圖表中...</p></div>
        </div>
        <div class="dashboard-widget">
            <div class="widget-header">
                <h2 class="widget-title">公司總覽</h2>
            </div>
            
            <div class="search-pagination" style="padding: 0 1.5rem 1rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; position: relative;">
                <input type="text" class="search-box" id="company-list-search" placeholder="搜尋公司名稱..." style="flex-grow: 1;">
                
                <button class="action-btn small primary" onclick="toggleQuickCreateCard(true)" id="btn-toggle-create" style="flex-shrink: 0; display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 1.2em; line-height: 1;">+</span> 快速新增
                </button>

                <div id="company-list-filters" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <select id="company-type-filter" class="form-select-sm" data-filter="type"><option value="all">所有類型</option></select>
                    <select id="company-stage-filter" class="form-select-sm" data-filter="stage"><option value="all">所有階段</option></select>
                    <select id="company-rating-filter" class="form-select-sm" data-filter="rating"><option value="all">所有評級</option></select>
                </div>
            </div>

            <div id="company-quick-create-card" style="display: none; margin: 0 1.5rem 1.5rem; padding: 1.25rem; background-color: var(--secondary-bg); border: 2px solid var(--accent-blue); border-radius: var(--rounded-lg); box-shadow: 0 4px 12px rgba(0,0,0,0.1); animation: slideDown 0.3s ease-out;">
                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <div style="font-weight: 700; color: var(--accent-blue); display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
                        <span style="font-size: 1.2rem;">🏢</span> 新增公司
                    </div>
                    
                    <input type="text" id="quick-create-name-input" class="form-input" 
                           placeholder="請輸入完整公司名稱 (例如: 台灣積體電路製造股份有限公司)" 
                           style="flex-grow: 1; min-width: 250px; background: var(--primary-bg);"
                           onkeydown="if(event.key === 'Enter') submitQuickCreateCompany()">
                    
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="action-btn secondary small" onclick="toggleQuickCreateCard(false)">取消</button>
                        <button class="action-btn primary small" onclick="submitQuickCreateCompany()">🚀 建立並前往</button>
                    </div>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted); margin-left: 2rem;">
                    * 系統將自動填入預設分類，建立後將自動跳轉至詳細頁面。
                </div>
            </div>

            <div id="companies-list-content" class="widget-content">
                <div class="loading show"><div class="spinner"></div><p>載入公司列表中...</p></div>
            </div>
        </div>
    `;

    // 2. 一次性獲取數據
    try {
        const [dashboardResult, listResult, systemConfigResult] = await Promise.all([
            authedFetch(`/api/companies/dashboard`),
            authedFetch(`/api/companies`), 
            authedFetch(`/api/config`) 
        ]);

        // 渲染圖表
        if (dashboardResult.success && dashboardResult.data && dashboardResult.data.chartData) {
             if (systemConfigResult && typeof systemConfigResult === 'object') {
                 window.CRM_APP.systemConfig = systemConfigResult;
             }
            renderCompaniesDashboardCharts(dashboardResult.data.chartData);
        } else {
            document.getElementById('companies-dashboard-container').innerHTML = `<div class="alert alert-error" style="grid-column: span 12;">圖表資料載入失敗</div>`;
        }

        // 填充篩選器
        if (systemConfigResult && typeof systemConfigResult === 'object') {
             populateFilterOptions('company-type-filter', systemConfigResult['公司類型'], '所有類型');
             populateFilterOptions('company-stage-filter', systemConfigResult['客戶階段'], '所有階段');
             populateFilterOptions('company-rating-filter', systemConfigResult['互動評級'], '所有評級');

             document.querySelectorAll('#company-list-filters select').forEach(select => {
                 select.addEventListener('change', handleCompanyFilterChange);
             });
        }

        // 渲染列表
        if (listResult.success) {
            allCompaniesData = listResult.data || []; 
            filterAndRenderCompanyList();

            const searchInput = document.getElementById('company-list-search');
            if (searchInput) {
                searchInput.addEventListener('keyup', handleCompanyListSearch);
            }
        } else {
             throw new Error(listResult.error || '無法獲取公司列表');
        }

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('載入公司列表失敗:', error);
            document.getElementById('companies-dashboard-container').innerHTML = '';
            document.getElementById('companies-list-content').innerHTML = `<div class="alert alert-error">載入公司列表失敗: ${error.message}</div>`;
        }
    }
}

/**
 * 【快速新增】切換卡片顯示
 */
function toggleQuickCreateCard(show) {
    const card = document.getElementById('company-quick-create-card');
    const input = document.getElementById('quick-create-name-input');
    const btn = document.getElementById('btn-toggle-create');
    
    if (!card) return;

    if (show) {
        card.style.display = 'block';
        if(btn) btn.style.display = 'none';
        if (input) {
            input.value = ''; 
            setTimeout(() => input.focus(), 100);
        }
    } else {
        card.style.display = 'none';
        if(btn) btn.style.display = 'flex';
    }
}
window.toggleQuickCreateCard = toggleQuickCreateCard;

/**
 * 【快速新增】送出請求
 */
async function submitQuickCreateCompany() {
    const input = document.getElementById('quick-create-name-input');
    const name = input?.value.trim();
    
    if (!name) {
        showNotification('請輸入公司名稱', 'warning');
        input.focus();
        return;
    }
    
    showLoading('正在建立...');
    try {
        const res = await authedFetch('/api/companies', {
            method: 'POST',
            body: JSON.stringify({ companyName: name })
        });
        
        hideLoading();
        
        if (res.success) {
            showNotification('建立成功！正在前往詳細頁面...', 'success');
            toggleQuickCreateCard(false);
            
            // 【重要】優先使用 companyName，沒有則 fallback 到 name
            const targetName = res.data.companyName || res.data.name;
            
            if (targetName) {
                CRM_APP.navigateTo('company-details', { companyName: encodeURIComponent(targetName) });
            } else {
                console.error("建立成功但無法取得公司名稱", res.data);
                showNotification('建立成功但自動跳轉失敗，請手動刷新列表', 'warning');
            }
        } else {
            // 已存在處理
            if (res.reason === 'EXISTS') {
                const existingName = res.data.companyName || res.data.name;
                showConfirmDialog(`公司「${name}」已存在，是否直接前往查看？`, () => {
                    CRM_APP.navigateTo('company-details', { companyName: encodeURIComponent(existingName) });
                });
            } else {
                showNotification(res.error || '建立失敗', 'error');
            }
        }
    } catch (e) {
        hideLoading();
        if (e.message !== 'Unauthorized') {
             showNotification('建立失敗: ' + e.message, 'error');
        }
    }
}
window.submitQuickCreateCompany = submitQuickCreateCompany;

// --- 輔助函式 ---

function populateFilterOptions(selectId, options, defaultText) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="all">${defaultText}</option>`;
    if (options && Array.isArray(options)) {
        options.forEach(opt => {
            selectElement.innerHTML += `<option value="${opt.value}">${opt.note || opt.value}</option>`;
        });
    }
}

function handleCompanyFilterChange(event) {
    const filterKey = event.target.dataset.filter;
    const filterValue = event.target.value;
    companyListFilters[filterKey] = filterValue;
    filterAndRenderCompanyList();
}

function handleCompanyListSearch(event) {
    handleSearch(() => {
        filterAndRenderCompanyList();
    });
}

function handleCompanySort(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'desc';
    }
    filterAndRenderCompanyList();
}

function filterAndRenderCompanyList() {
    const query = document.getElementById('company-list-search')?.value.toLowerCase() || '';
    const { type, stage, rating } = companyListFilters;

    let filteredCompanies = allCompaniesData.filter(company => {
        const nameMatch = query ? (company.companyName || '').toLowerCase().includes(query) : true;
        const typeMatch = type === 'all' ? true : company.companyType === type;
        const stageMatch = stage === 'all' ? true : company.customerStage === stage;
        const ratingMatch = rating === 'all' ? true : company.engagementRating === rating;
        return nameMatch && typeMatch && stageMatch && ratingMatch;
    });

    filteredCompanies.sort((a, b) => {
        let valA = a[currentSort.field];
        let valB = b[currentSort.field];
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'number' && typeof valB === 'number') {
            return currentSort.direction === 'asc' ? valA - valB : valB - valA;
        }
        valA = String(valA);
        valB = String(valB);
        return currentSort.direction === 'asc' 
            ? valA.localeCompare(valB, 'zh-Hant') 
            : valB.localeCompare(valA, 'zh-Hant');
    });

    const listContent = document.getElementById('companies-list-content');
    if (listContent) {
        listContent.innerHTML = renderCompaniesTable(filteredCompanies);
    }
}

function renderCompaniesDashboardCharts(chartData) {
    const container = document.getElementById('companies-dashboard-container');
    if (!container) return;
    container.innerHTML = `
        <div class="dashboard-widget grid-col-3">
            <div class="widget-header"><h2 class="widget-title">公司新增趨勢</h2></div>
            <div id="company-trend-chart" class="widget-content" style="height: 250px;"></div>
        </div>
        <div class="dashboard-widget grid-col-3">
            <div class="widget-header"><h2 class="widget-title">公司類型分佈</h2></div>
            <div id="company-type-chart" class="widget-content" style="height: 250px;"></div>
        </div>
        <div class="dashboard-widget grid-col-3">
            <div class="widget-header"><h2 class="widget-title">客戶階段分佈</h2></div>
            <div id="customer-stage-chart" class="widget-content" style="height: 250px;"></div>
        </div>
        <div class="dashboard-widget grid-col-3">
            <div class="widget-header"><h2 class="widget-title">互動評級</h2></div>
            <div id="engagement-rating-chart" class="widget-content" style="height: 250px;"></div>
        </div>
    `;

    const systemConfig = window.CRM_APP?.systemConfig;
    const typeNameMap = new Map((systemConfig?.['公司類型'] || []).map(i => [i.value, i.note]));
    const stageNameMap = new Map((systemConfig?.['客戶階段'] || []).map(i => [i.value, i.note]));
    const ratingNameMap = new Map((systemConfig?.['互動評級'] || []).map(i => [i.value, i.note]));

    setTimeout(() => {
        if (typeof Highcharts !== 'undefined' && chartData) {
            renderCompanyTrendChart(chartData.trend);
            createThemedChart('company-type-chart', getCompanyPieChartOptions('類型', chartData.type, 'companyType', typeNameMap));
            createThemedChart('customer-stage-chart', getCompanyPieChartOptions('階段', chartData.stage, 'customerStage', stageNameMap));
            createThemedChart('engagement-rating-chart', getCompanyBarChartOptions('評級', chartData.rating, 'engagementRating', ratingNameMap));
        } else {
             ['company-trend-chart', 'company-type-chart', 'customer-stage-chart', 'engagement-rating-chart'].forEach(id => {
                 const el = document.getElementById(id);
                 if (el) el.innerHTML = '<div class="alert alert-warning" style="text-align:center;padding:10px;">圖表無法載入</div>';
             });
        }
    }, 0);
}

function renderCompanyTrendChart(data) {
    if (!data || !Array.isArray(data)) return;
    const specificOptions = {
        chart: { type: 'line' },
        title: { text: '' },
        xAxis: { categories: data.map(d => d[0] ? d[0].substring(5) : '') },
        yAxis: { title: { text: '數量' }, allowDecimals: false },
        legend: { enabled: false },
        series: [{ name: '新增公司數', data: data.map(d => d[1] || 0) }]
    };
    createThemedChart('company-trend-chart', specificOptions);
}

function getCompanyPieChartOptions(seriesName, data, filterKey, nameMap) {
    if (!data || !Array.isArray(data)) data = [];
    const chartData = data.map(d => ({
        name: nameMap.get(d.name) || d.name || '未分類',
        y: d.y || 0,
        internalValue: d.name
    }));
    return {
        chart: { type: 'pie' },
        title: { text: '' },
        tooltip: { pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b> ({point.y} 家)' },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: { enabled: true, format: '<b>{point.name}</b>: {point.percentage:.1f} %', distance: 20 },
                showInLegend: false,
                point: { events: { click: function() { handleCompanyChartClick(this, filterKey); } } }
            }
        },
        series: [{ name: '家數', data: chartData }]
    };
}

function getCompanyBarChartOptions(seriesName, data, filterKey, nameMap) {
     if (!data || !Array.isArray(data)) data = [];
      const chartData = data.map(d => ({
         name: nameMap.get(d.name) || d.name || '未分類',
         y: d.y || 0,
         internalValue: d.name
     }));
     return {
        chart: { type: 'bar' },
        title: { text: '' },
        xAxis: { categories: chartData.map(d => d.name), title: { text: null } },
        yAxis: { min: 0, title: { text: '公司數量', align: 'high' }, allowDecimals: false },
        legend: { enabled: false },
        series: [{ name: '數量', data: chartData }],
        plotOptions: { bar: { cursor: 'pointer', point: { events: { click: function() { handleCompanyChartClick(this, filterKey, true); } } } } }
    };
}

function handleCompanyChartClick(point, filterKey, isBarChart = false) {
    const filterValue = isBarChart ? point.options.internalValue : point.internalValue;
    const filterSelect = document.getElementById(`company-${filterKey.replace('company', '').toLowerCase()}-filter`);
    if (!filterSelect) return;

    if (point.selected) {
        companyListFilters[filterKey] = 'all';
        filterSelect.value = 'all';
        point.select(false, true);
    } else {
        companyListFilters[filterKey] = filterValue;
        filterSelect.value = filterValue;
        point.select(true, true);
    }
    filterAndRenderCompanyList();
}

function renderCompaniesTable(companies) {
    const styleId = 'company-list-table-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .company-list-table .col-index { width: 50px; text-align: center; color: var(--text-muted); font-weight: 700; }
            .company-list-table th { white-space: nowrap; }
            .company-list-table th.sortable { cursor: pointer; transition: background-color 0.2s; }
            .company-list-table th.sortable:hover { background-color: var(--glass-bg); }
            .sort-icon { display: inline-block; margin-left: 4px; font-size: 0.8em; color: var(--accent-blue); }
            @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
            @media (max-width: 768px) {
                .company-list-table .col-index { width: auto; text-align: left; border-bottom: 1px solid var(--border-color); margin-bottom: 8px; padding-bottom: 8px; display: block; }
                .company-list-table .col-index::before { content: attr(data-label); font-weight: 600; color: var(--text-secondary); padding-right: var(--spacing-4); }
            }
        `;
        document.head.appendChild(style);
    }

    if (!companies || companies.length === 0) return '<div class="alert alert-info" style="text-align:center;">找不到符合條件的公司資料</div>';

    const systemConfig = window.CRM_APP?.systemConfig;
    const typeConfigMap = new Map((systemConfig?.['公司類型'] || []).map(t => [t.value, { note: t.note, color: t.color }]));
    const stageNameMap = new Map((systemConfig?.['客戶階段'] || []).map(t => [t.value, t.note]));
    const ratingNameMap = new Map((systemConfig?.['互動評級'] || []).map(t => [t.value, t.note]));

    const renderSortHeader = (field, label) => {
        let icon = '';
        if (currentSort.field === field) icon = currentSort.direction === 'asc' ? '↑' : '↓';
        return `<th class="sortable" onclick="handleCompanySort('${field}')">${label} <span class="sort-icon">${icon}</span></th>`;
    };

    let tableHTML = `
        <table class="data-table company-list-table">
            <thead>
                <tr>
                    <th class="col-index">項次</th>
                    ${renderSortHeader('companyName', '公司名稱')}
                    ${renderSortHeader('opportunityCount', '機會數')}
                    <th>公司類型</th>
                    <th>客戶階段</th>
                    <th>互動評級</th>
                    ${renderSortHeader('lastActivity', '最後活動')}
                </tr>
            </thead>
            <tbody>`;

    companies.forEach((company, index) => {
        const companyName = company.companyName || '';
        const encodedCompanyName = encodeURIComponent(companyName);
        const typeConfig = typeConfigMap.get(company.companyType);
        const rowColor = typeConfig?.color || 'transparent';
        const typeName = typeConfig?.note || company.companyType || '-';

        tableHTML += `
            <tr style="--card-brand-color: ${rowColor};">
                <td data-label="項次" class="col-index">${index + 1}</td>
                <td data-label="公司名稱">
                    <a href="#" class="text-link" onclick="event.preventDefault(); CRM_APP.navigateTo('company-details', { companyName: '${encodedCompanyName}' })">
                        <strong>${companyName || '-'}</strong>
                    </a>
                </td>
                <td data-label="機會數" style="font-weight: 700; color: var(--text-primary); text-align: center;">${company.opportunityCount}</td>
                <td data-label="公司類型">${typeName}</td>
                <td data-label="客戶階段">${stageNameMap.get(company.customerStage) || company.customerStage || '-'}</td>
                <td data-label="互動評級">${ratingNameMap.get(company.engagementRating) || company.engagementRating || '-'}</td>
                <td data-label="最後活動">${formatDateTime(company.lastActivity)}</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    return tableHTML;
}

if (window.CRM_APP) {
    if (!window.CRM_APP.pageModules) window.CRM_APP.pageModules = {};
    window.CRM_APP.pageModules.companies = loadCompaniesListPage;
}