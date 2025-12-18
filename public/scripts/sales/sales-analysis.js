// views/scripts/sales-analysis.js

let salesAnalysisData = null; 
let salesStartDate = null;
let salesEndDate = null;
let allWonDeals = [];         // 所有的成交案件 (未排序、未分頁)
let displayedDeals = [];      // 經過篩選和排序後的案件 (準備分頁用)
let currentSalesModelFilter = 'all';

// 列表狀態
let currentSortState = { field: 'wonDate', direction: 'desc' };
let currentPage = 1;
let rowsPerPage = 10; 

async function loadSalesAnalysisPage(startDateISO, endDateISO) {
    const container = document.getElementById('page-sales-analysis');
    if (!container) return;

    if (!startDateISO || !endDateISO) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setDate(startDate.getDate() + 1);

        salesEndDate = endDate.toISOString().split('T')[0];
        salesStartDate = startDate.toISOString().split('T')[0];
    } else {
        salesStartDate = startDateISO;
        salesEndDate = endDateISO;
    }

    // 注入 CSS 樣式 
    const styleId = 'sales-analysis-custom-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            /* =========================================
               1. KPI 卡片樣式 (強制不反白)
               ========================================= */
            .stat-card.solid-fill {
                border-left: none !important;
                color: white !important;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            .stat-card.solid-fill:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
                filter: none !important; 
            }
            
            /* 分別鎖定各顏色的 hover 背景，確保不變色 */
            .stat-card.solid-fill.solid-green:hover { background-color: #10b981 !important; }
            .stat-card.solid-fill.solid-teal:hover { background-color: #0d9488 !important; }
            .stat-card.solid-fill.solid-blue:hover { background-color: #3b82f6 !important; }
            .stat-card.solid-fill.solid-purple:hover { background-color: #8b5cf6 !important; }

            .stat-card.solid-fill .stat-label, 
            .stat-card.solid-fill .stat-number,
            .stat-card.solid-fill .stat-icon {
                color: white !important;
            }
            .stat-card.solid-fill .stat-icon {
                background: rgba(255, 255, 255, 0.2) !important;
            }
            
            /* 基礎顏色定義 */
            .solid-green { background-color: #10b981; }
            .solid-teal { background-color: #0d9488; }
            .solid-blue { background-color: #3b82f6; }
            .solid-purple { background-color: #8b5cf6; }
            .stat-card.orange { border-left-color: #f97316; }

            /* =========================================
               2. Chips (膠囊) 樣式
               ========================================= */
            
            /* 銷售模式 (標準膠囊) */
            .sales-chip {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 12px; /* 圓潤 */
                font-size: 0.85rem;
                font-weight: 500;
                color: white;
                white-space: nowrap;
                line-height: 1.2;
            }

            /* 機會種類 (方型圓角) */
            .type-chip {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 4px; /* 【修正】方型圓角 */
                font-size: 0.85rem;
                font-weight: 500;
                color: white;
                white-space: nowrap;
                line-height: 1.2;
            }

            .channel-chip {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.85rem;
                border: 1px solid #e5e7eb;
                background-color: #f9fafb;
                color: #374151;
            }

            /* =========================================
               3. 控制項樣式 (下拉選單、分頁)
               ========================================= */
            .custom-select-control {
                background-color: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                padding: 6px 10px;
                font-size: 0.9rem;
                color: #374151;
                cursor: pointer;
                transition: all 0.2s;
                outline: none;
            }
            .custom-select-control:hover {
                border-color: #9ca3af;
                background-color: #e5e7eb;
            }
            .custom-select-control:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }

            .sortable-header {
                cursor: pointer;
                user-select: none;
                transition: background-color 0.2s;
            }
            .sortable-header:hover {
                background-color: rgba(0,0,0,0.05);
            }
            .sort-icon {
                display: inline-block;
                margin-left: 4px;
                font-size: 0.8em;
                color: #9ca3af;
            }
            .sortable-header.active .sort-icon {
                color: var(--primary-color);
            }

            .pagination-container {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 15px;
                margin-top: 20px;
                padding: 10px;
            }
            .page-btn {
                padding: 6px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                background-color: white;
                cursor: pointer;
                transition: all 0.2s;
            }
            .page-btn:hover:not(:disabled) {
                background-color: #f3f4f6;
                border-color: #9ca3af;
            }
            .page-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .page-info {
                font-size: 0.9rem;
                color: #6b7280;
                font-weight: 500;
            }

            /* --- 4欄 Grid 佈局 --- */
            @media (min-width: 1000px) {
                .four-charts-row {
                    display: grid !important;
                    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                    gap: 16px !important;
                    width: 100%;
                }
                .four-charts-row > .dashboard-widget {
                    grid-column: span 1 !important;
                    width: 100% !important;
                    min-width: 0 !important;
                }
            }
            @media (max-width: 999px) {
                .four-charts-row {
                    display: grid !important;
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 16px;
                }
            }
            @media (max-width: 600px) {
                .four-charts-row {
                    grid-template-columns: 1fr !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = `
        <div class="dashboard-widget">
            <div class="widget-header" style="align-items: flex-start;">
                <div>
                    <h2 class="widget-title">績效概覽</h2>
                    <p id="sales-date-range-display" style="color: var(--text-muted); font-size: 0.9rem; margin-top: 5px;">
                        資料期間：${new Date(salesStartDate + 'T00:00:00').toLocaleDateString('zh-TW')} - ${new Date(salesEndDate + 'T00:00:00').toLocaleDateString('zh-TW')}
                    </p>
                </div>
                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="sales-start-date" class="form-label" style="font-size: 0.8rem;">開始日期</label>
                        <input type="date" id="sales-start-date" class="form-input form-input-sm" value="${salesStartDate}">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="sales-end-date" class="form-label" style="font-size: 0.8rem;">結束日期</label>
                        <input type="date" id="sales-end-date" class="form-input form-input-sm" value="${salesEndDate}">
                    </div>
                    <button class="action-btn primary" style="height: 40px; margin-top: 20px;" onclick="refreshSalesAnalysis()">
                        查詢
                    </button>
                </div>
            </div>
            
            <div id="sales-overview-content" class="widget-content">
                <div class="loading show"><div class="spinner"></div></div>
            </div>

            <div id="sales-kpi-content" class="widget-content" style="margin-top: 16px;">
                 </div>
        </div>

        <div id="sales-charts-container" class="dashboard-grid-flexible four-charts-row" style="margin-top: 24px; display:block;"> 
             <div class="loading show" style="padding: 20px;"><div class="spinner"></div><p>載入圖表中...</p></div>
        </div>

        <div class="dashboard-widget" style="margin-top: 24px;">
            <div class="widget-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; padding-bottom: 15px; border-bottom: 1px solid var(--border-color); gap: 15px;">
                <div style="display: flex; align-items: baseline; gap: 15px;">
                    <h2 class="widget-title" style="margin-bottom: 0; white-space: nowrap;">成交案件列表</h2>
                    <span style="font-size: 0.9rem; color: var(--text-muted); white-space: nowrap;">
                       共 <span id="deals-count-display">0</span> 筆
                    </span>
                </div>
                
                <div style="display: flex; gap: 15px; align-items: center;">
                    <button class="action-btn secondary" onclick="exportSalesToCSV()" title="匯出當前期間所有成交資料">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px; margin-right:5px;">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        匯出 CSV
                    </button>

                    <div class="form-group" style="margin-bottom: 0; display: flex; align-items: center; gap: 8px;">
                        <label for="rows-per-page-select" style="font-size: 0.9rem; color: #4b5563;">每頁顯示：</label>
                        <select id="rows-per-page-select" class="custom-select-control" onchange="handleRowsPerPageChange()" style="width: 80px;">
                            </select>
                    </div>

                    <div class="form-group" style="margin-bottom: 0; display: flex; align-items: center; gap: 8px;">
                        <label for="sales-model-filter" style="font-size: 0.9rem; font-weight: 500; color: #4b5563;">商流篩選：</label>
                        <select id="sales-model-filter" class="custom-select-control" onchange="handleSalesModelFilterChange()" style="min-width: 140px;">
                            <option value="all">全部顯示</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div id="won-deals-content" class="widget-content" style="padding: 0;">
                <div class="loading show" style="padding: 20px;"><div class="spinner"></div><p>載入成交列表...</p></div>
            </div>

            <div id="pagination-container" class="pagination-container" style="display: none;">
                <button class="page-btn" onclick="changePage(-1)" id="btn-prev-page">上一頁</button>
                <span class="page-info" id="page-info-display">第 1 頁 / 共 1 頁</span>
                <button class="page-btn" onclick="changePage(1)" id="btn-next-page">下一頁</button>
            </div>
        </div>
    `;

    await fetchAndRenderSalesData(salesStartDate, salesEndDate);
}

function refreshSalesAnalysis() {
    const startDateInput = document.getElementById('sales-start-date');
    const endDateInput = document.getElementById('sales-end-date');
    if (!startDateInput || !endDateInput) return;

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (startDate && endDate && startDate <= endDate) {
        document.getElementById('sales-overview-content').innerHTML = '<div class="loading show"><div class="spinner"></div></div>';
        document.getElementById('sales-kpi-content').innerHTML = '';
        document.getElementById('won-deals-content').innerHTML = '<div class="loading show" style="padding: 20px;"><div class="spinner"></div></div>';
        loadSalesAnalysisPage(startDate, endDate);
    } else {
        showNotification('請選擇有效的開始和結束日期', 'warning');
    }
}

async function fetchAndRenderSalesData(startDate, endDate) {
    try {
        const result = await authedFetch(`/api/sales-analysis?startDate=${startDate}&endDate=${endDate}`);
        if (!result.success || !result.data) throw new Error(result.error || '無法獲取分析數據');
        
        salesAnalysisData = result.data;
        allWonDeals = salesAnalysisData.wonDeals || [];

        // 1. 初始化篩選器與頁面設定
        initSalesModelFilterOptions();
        initPaginationOptions();

        // 2. 預設先依日期降序排一次，並複製到 displayedDeals 準備顯示
        sortDeals('wonDate', 'desc');
        displayedDeals = [...allWonDeals];

        // 3. 渲染儀表板與列表
        updateDashboard(allWonDeals); // KPI 與圖表使用全量數據
        renderPaginatedTable();       // 列表使用分頁數據

        const dRange = document.getElementById('sales-date-range-display');
        if(dRange) dRange.textContent = `資料期間：${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;

    } catch (error) {
        console.error('載入失敗:', error);
        document.getElementById('sales-charts-container').innerHTML = `<div class="alert alert-error">載入失敗: ${error.message}</div>`;
    }
}

function initSalesModelFilterOptions() {
    const select = document.getElementById('sales-model-filter');
    if (!select) return;

    const models = new Set();
    allWonDeals.forEach(d => { if (d.salesModel) models.add(d.salesModel); });

    const currentVal = select.value;
    select.innerHTML = '<option value="all">全部顯示</option>';
    Array.from(models).sort().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        select.appendChild(opt);
    });
    if (currentVal && (currentVal === 'all' || models.has(currentVal))) select.value = currentVal;
}

function initPaginationOptions() {
    const select = document.getElementById('rows-per-page-select');
    if (!select) return;
    
    // 從後端獲取選項，若無則使用預設
    const options = salesAnalysisData.paginationOptions || [10, 20, 50, 100];
    
    select.innerHTML = '';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = `${opt} 筆`;
        select.appendChild(option);
    });

    // 設定初始值
    rowsPerPage = options[0];
    select.value = rowsPerPage;
}

// ======================= 篩選與排序邏輯 =======================

window.handleSalesModelFilterChange = function() {
    const select = document.getElementById('sales-model-filter');
    currentSalesModelFilter = select ? select.value : 'all';
    applyFilterAndRender();
};

function applyFilterAndRender() {
    // 1. 篩選
    if (currentSalesModelFilter !== 'all') {
        displayedDeals = allWonDeals.filter(d => d.salesModel === currentSalesModelFilter);
    } else {
        displayedDeals = [...allWonDeals];
    }
    
    // 2. 重新排序篩選後的結果
    sortDeals(currentSortState.field, currentSortState.direction, true);

    // 3. 重置分頁並渲染列表
    currentPage = 1;
    renderPaginatedTable();
    
    // 4. 更新 KPI 與圖表
    updateDashboard(displayedDeals);
}

window.handleSortTable = function(field) {
    if (currentSortState.field === field) {
        currentSortState.direction = currentSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortState.field = field;
        currentSortState.direction = 'desc';
    }
    
    // 對當前顯示的資料進行排序
    sortDeals(currentSortState.field, currentSortState.direction, true);
    
    // 渲染
    renderPaginatedTable();
};

function sortDeals(field, direction, sortDisplayedOnly = false) {
    const targetArray = sortDisplayedOnly ? displayedDeals : allWonDeals;
    
    targetArray.sort((a, b) => {
        let valA, valB;
        if (field === 'wonDate') {
            valA = a.wonDate ? new Date(a.wonDate).getTime() : 0;
            valB = b.wonDate ? new Date(b.wonDate).getTime() : 0;
        } else if (field === 'numericValue') {
            valA = a.numericValue || 0;
            valB = b.numericValue || 0;
        } else {
            return 0;
        }

        if (direction === 'asc') {
            return valA - valB;
        } else {
            return valB - valA;
        }
    });

    if (!sortDisplayedOnly) {
        displayedDeals = [...allWonDeals];
    }
}

// ======================= 分頁功能 =======================

window.handleRowsPerPageChange = function() {
    const select = document.getElementById('rows-per-page-select');
    if (select) {
        rowsPerPage = parseInt(select.value);
        currentPage = 1; 
        renderPaginatedTable();
    }
};

window.changePage = function(delta) {
    const totalPages = Math.ceil(displayedDeals.length / rowsPerPage);
    const newPage = currentPage + delta;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderPaginatedTable();
    }
};

function renderPaginatedTable() {
    const countDisplay = document.getElementById('deals-count-display');
    if (countDisplay) countDisplay.textContent = displayedDeals.length;

    // 計算分頁區間
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageDeals = displayedDeals.slice(startIndex, endIndex);

    // 渲染表格
    renderWonDealsTable(pageDeals);
    
    // 更新分頁控制項
    updatePaginationControls();
}

function updatePaginationControls() {
    const container = document.getElementById('pagination-container');
    const info = document.getElementById('page-info-display');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');

    if (!container || displayedDeals.length === 0) {
        if(container) container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    const totalPages = Math.ceil(displayedDeals.length / rowsPerPage) || 1;
    
    if (info) info.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁`;
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

// ======================= 核心運算與渲染 =======================

function updateDashboard(deals) {
    const overview = calculateOverview(deals);
    const kpis = calculateKpis(deals);
    renderSalesOverviewAndKpis(overview, kpis);

    const typeData = calculateGroupStats(deals, 'opportunityType', 'value');
    const sourceData = calculateGroupStats(deals, 'opportunitySource', 'value');
    const productData = calculateProductStats(deals);
    const channelData = calculateChannelStats(deals);

    renderAllCharts(typeData, sourceData, productData, channelData);
}

function calculateOverview(deals) {
    let totalVal = 0;
    let totalDays = 0;
    let cycleCount = 0;
    deals.forEach(d => {
        totalVal += d.numericValue;
        if (d.createdTime && d.wonDate) {
            const diff = Math.ceil(Math.abs(new Date(d.wonDate) - new Date(d.createdTime)) / 86400000);
            if (!isNaN(diff)) { totalDays += diff; cycleCount++; }
        }
    });
    return {
        totalWonValue: totalVal,
        totalWonDeals: deals.length,
        averageDealValue: deals.length ? totalVal / deals.length : 0,
        averageSalesCycleInDays: cycleCount ? Math.round(totalDays / cycleCount) : 0
    };
}

function calculateKpis(deals) {
    const calcUnique = (keyword) => {
        const unique = new Set();
        deals.forEach(d => {
            const m = (d.salesModel || '').trim();
            if (m.includes(keyword) && d.customerCompany) {
                unique.add(d.customerCompany.trim());
            }
        });
        return unique.size;
    };
    return {
        direct: calcUnique('直販') || calcUnique('直接販售') || calcUnique('Direct'),
        si: calcUnique('SI') || calcUnique('系統整合'),
        mtb: calcUnique('MTB') || calcUnique('工具機')
    };
}

function calculateGroupStats(deals, field, metric='count') {
    const map = {};
    deals.forEach(d => {
        const k = d[field] || '未分類';
        if (!map[k]) map[k] = { count: 0, value: 0 };
        map[k].count++;
        map[k].value += d.numericValue;
    });
    return Object.entries(map).map(([n, v]) => ({ name: n, y: metric === 'value' ? v.value : v.count })).sort((a,b) => b.y - a.y);
}

function calculateProductStats(deals) {
    const map = {};
    deals.forEach(d => {
        try {
            if (d.potentialSpecification) {
                const specs = JSON.parse(d.potentialSpecification);
                Object.entries(specs).forEach(([name, qty]) => {
                    const q = parseInt(qty) || 0;
                    if (q > 0) map[name] = (map[name] || 0) + q;
                });
            }
        } catch(e){}
    });
    return Object.entries(map).map(([n, q]) => ({ name: n, y: q })).sort((a,b) => b.y - a.y);
}

function calculateChannelStats(deals) {
    const map = {};
    deals.forEach(d => {
        let ch = d.channelDetails || d.salesChannel || '直接販售';
        if (ch === '-' || ch === '無') ch = '直接販售';
        map[ch] = (map[ch] || 0) + d.numericValue;
    });
    return Object.entries(map).map(([n, v]) => ({ name: n, y: v })).sort((a,b) => b.y - a.y);
}

function renderSalesOverviewAndKpis(ov, kpis) {
    const container = document.getElementById('sales-overview-content');
    const kpiContainer = document.getElementById('sales-kpi-content');
    if(!container || !kpiContainer) return;
    
    const fmtMoney = (v, maxDigits=0) => (v||0).toLocaleString('zh-TW', {style:'currency', currency:'TWD', minimumFractionDigits:0, maximumFractionDigits: maxDigits});
    const fmtNum = v => (v||0).toLocaleString('zh-TW');

    container.innerHTML = `
        <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);"> 
            <div class="stat-card solid-fill solid-green">
                <div class="stat-header">
                    <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>
                    <div class="stat-label">總成交金額</div>
                </div>
                <div class="stat-content"><div class="stat-number">${fmtMoney(ov.totalWonValue)}</div></div>
            </div>
            <div class="stat-card blue">
                <div class="stat-header"><div class="stat-icon" style="background: var(--accent-blue);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div><div class="stat-label">總成交案件數</div></div>
                <div class="stat-content"><div class="stat-number">${fmtNum(ov.totalWonDeals)} 件</div></div>
            </div>
            <div class="stat-card purple">
                <div class="stat-header"><div class="stat-icon" style="background: var(--accent-purple);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg></div><div class="stat-label">平均成交金額</div></div>
                <div class="stat-content"><div class="stat-number">${fmtMoney(ov.averageDealValue, 0)}</div></div>
            </div>
            <div class="stat-card orange">
                <div class="stat-header"><div class="stat-icon" style="background: var(--accent-orange);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div><div class="stat-label">平均成交週期</div></div>
                <div class="stat-content"><div class="stat-number">${fmtNum(ov.averageSalesCycleInDays)} 天</div></div>
            </div>
        </div>
    `;

    kpiContainer.innerHTML = `
        <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);"> 
            <div class="stat-card solid-fill solid-teal">
                <div class="stat-header"><div class="stat-label">直販</div></div>
                <div class="stat-content"><div class="stat-number">${fmtNum(kpis.direct)} 家</div></div>
            </div>
            <div class="stat-card solid-fill solid-blue">
                <div class="stat-header"><div class="stat-label">SI販售</div></div>
                <div class="stat-content"><div class="stat-number">${fmtNum(kpis.si)} 家</div></div>
            </div>
            <div class="stat-card solid-fill solid-purple">
                <div class="stat-header"><div class="stat-label">MTB販售</div></div>
                <div class="stat-content"><div class="stat-number">${fmtNum(kpis.mtb)} 家</div></div>
            </div>
        </div>
    `;
}

function renderAllCharts(typeData, sourceData, productData, channelData) {
    const container = document.getElementById('sales-charts-container');
    if (!container) return;
    
    container.className = 'dashboard-grid-flexible four-charts-row';

    const productChartHeight = Math.max(300, productData.length * 30);
    const channelChartHeight = Math.max(300, channelData.length * 30);

    container.innerHTML = `
        <div class="dashboard-widget">
            <div class="widget-header"><h2 class="widget-title">成交類型 (依金額計)</h2></div>
            <div id="chart-pie-type" class="widget-content" style="height: 300px;"></div>
        </div>
        <div class="dashboard-widget">
            <div class="widget-header"><h2 class="widget-title">成交來源 (依金額計)</h2></div>
            <div id="chart-pie-source" class="widget-content" style="height: 300px;"></div>
        </div>
        
        <div class="dashboard-widget">
            <div class="widget-header"><h2 class="widget-title">熱銷商品</h2></div>
            <div style="max-height: 300px; overflow-y: auto;">
                <div id="chart-bar-product" class="widget-content" style="height: ${productChartHeight}px;"></div>
            </div>
        </div>
        
        <div class="dashboard-widget">
            <div class="widget-header"><h2 class="widget-title">商流通路</h2></div>
             <div style="max-height: 300px; overflow-y: auto;">
                <div id="chart-bar-channel" class="widget-content" style="height: ${channelChartHeight}px;"></div>
            </div>
        </div>
    `;

    setTimeout(() => {
        if (typeof createThemedChart === 'function') {
            createThemedChart('chart-pie-type', {
                chart: { type: 'pie', margin: [0, 0, 0, 0] }, title: { text: '' }, 
                tooltip: { pointFormat: '<b>{point.percentage:.1f}%</b> ({point.y:,.0f})' },
                plotOptions: { 
                    pie: { 
                        dataLabels: { enabled: true, format: '<b>{point.name}</b>: {point.percentage:.1f} %', distance: 10 }, 
                        showInLegend: true 
                    } 
                },
                legend: { align: 'center', verticalAlign: 'bottom', layout: 'horizontal', itemStyle: { fontSize: '10px' } },
                series: [{ name: '類型', data: typeData }]
            });
            createThemedChart('chart-pie-source', {
                chart: { type: 'pie', margin: [0, 0, 0, 0] }, title: { text: '' }, 
                tooltip: { pointFormat: '<b>{point.percentage:.1f}%</b> ({point.y:,.0f})' },
                plotOptions: { 
                    pie: { 
                        dataLabels: { enabled: true, format: '<b>{point.name}</b>: {point.percentage:.1f} %', distance: 10 }, 
                        showInLegend: true 
                    } 
                },
                legend: { align: 'center', verticalAlign: 'bottom', layout: 'horizontal', itemStyle: { fontSize: '10px' } },
                series: [{ name: '來源', data: sourceData }]
            });

            createThemedChart('chart-bar-product', {
                chart: { type: 'bar' }, title: { text: '' }, xAxis: { categories: productData.map(d => d.name) }, yAxis: { title: { text: '數量' } }, legend: { enabled: false },
                tooltip: { pointFormat: '<b>{point.y}</b> 個' }, series: [{ name: '數量', data: productData.map(d => d.y), color: '#8b5cf6' }]
            });
            createThemedChart('chart-bar-channel', {
                chart: { type: 'bar' }, title: { text: '' }, xAxis: { categories: channelData.map(d => d.name) }, yAxis: { title: { text: '金額' } }, legend: { enabled: false },
                tooltip: { pointFormat: '<b>{point.y:,.0f}</b> 元' }, series: [{ name: '業績', data: channelData.map(d => d.y), color: '#10b981' }]
            });
        }
    }, 50);
}

function renderWonDealsTable(deals) {
    const container = document.getElementById('won-deals-content');
    if (!container) return;

    if (!deals || deals.length === 0) {
        container.innerHTML = '<div class="alert alert-info" style="margin: 20px; text-align:center;">此分頁沒有資料</div>';
        return;
    }

    const fmtMoney = v => (v || 0).toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 });

    const modelColorMap = salesAnalysisData.salesModelColors || {};
    const typeColorMap = salesAnalysisData.eventTypeColors || {};
    
    // 輔助函式：取得排序狀態的 Icon
    const getSortIcon = (field) => {
        if (currentSortState.field !== field) return '↕';
        return currentSortState.direction === 'asc' ? '↑' : '↓';
    };
    const getHeaderClass = (field) => {
        return currentSortState.field === field ? 'sortable-header active' : 'sortable-header';
    };

    let html = `
    <div class="table-container" style="overflow-x: auto;">
    <table class="data-table sticky-header">
        <thead>
            <tr style="white-space: nowrap;">
                <th>項次</th>
                <th class="${getHeaderClass('wonDate')}" onclick="handleSortTable('wonDate')">
                    成交日期 ${getSortIcon('wonDate')}
                </th>
                <th>機會種類</th>
                <th>機會名稱</th>
                <th>終端客戶</th>
                <th>銷售模式</th>
                <th>主要通路/下單方</th>
                <th>目前階段</th>
                <th style="text-align: right;" class="${getHeaderClass('numericValue')}" onclick="handleSortTable('numericValue')">
                    機會價值 ${getSortIcon('numericValue')}
                </th>
                <th>負責業務</th>
            </tr>
        </thead>
        <tbody>`;

    deals.forEach((deal, index) => {
        const globalIndex = ((currentPage - 1) * rowsPerPage) + index + 1;
        
        const oppId = deal.opportunityId || '';
        const oppName = deal.opportunityName || '(未命名)';
        const safeOppName = oppName.replace(/"/g, '&quot;'); 
        const detailLink = oppId ? `<a href="#" class="text-link" onclick="event.preventDefault(); CRM_APP.navigateTo('opportunity-details', { opportunityId: '${oppId}' })"><strong>${safeOppName}</strong></a>` : `<strong>${safeOppName}</strong>`;
        
        // --- 通路 Chips ---
        const channelVal = deal.channelDetails || deal.salesChannel || '-';
        let channelHtml = `<span style="color: #9ca3af;">-</span>`;
        if (channelVal !== '-' && channelVal !== '無') {
            channelHtml = `<span class="channel-chip">${channelVal}</span>`;
        }

        // --- 銷售模式 Chips (使用 modelColorMap, 膠囊) ---
        const modelVal = deal.salesModel || '-';
        let modelHtml = `<span style="color: #9ca3af;">-</span>`;
        if (modelVal !== '-') {
            const bg = modelColorMap[modelVal] || '#6b7280'; // 預設灰
            modelHtml = `<span class="sales-chip" style="background-color: ${bg};">${modelVal}</span>`;
        }

        // --- 機會種類 Chips (使用 typeColorMap, 方型圓角) ---
        const typeVal = deal.opportunityType || '-';
        let typeHtml = `<span style="color: #9ca3af;">-</span>`;
        if (typeVal !== '-') {
            const bg = typeColorMap[typeVal] || '#6b7280'; // 預設灰
            typeHtml = `<span class="type-chip" style="background-color: ${bg};">${typeVal}</span>`;
        }

        html += `
            <tr>
                <td>${globalIndex}</td>
                <td>${formatDateTime(deal.wonDate).split(' ')[0]}</td>
                <td>${typeHtml}</td>
                <td>${detailLink}</td>
                <td>${deal.customerCompany || '-'}</td>
                <td>${modelHtml}</td>
                <td>${channelHtml}</td>
                <td><span class="status-badge status-won">${deal.currentStage || '-'}</span></td>
                <td style="text-align: right; font-weight: 600;">${fmtMoney(deal.numericValue)}</td>
                <td>${deal.assignee || '-'}</td>
            </tr>`;
    });
    html += '</tbody></table></div>';
    
    container.innerHTML = html;
}

/**
 * 匯出 CSV 功能：匯出該期間內所有的成交案件資料
 */
window.exportSalesToCSV = function() {
    if (!allWonDeals || allWonDeals.length === 0) {
        showNotification('沒有資料可供匯出', 'warning');
        return;
    }

    // 1. 定義 CSV 標題
    const headers = [
        '成交日期', '機會種類', '機會名稱', '終端客戶', 
        '銷售模式', '主要通路/下單方', '目前階段', '機會價值', '負責業務'
    ];

    // 2. 轉換資料內容
    const rows = allWonDeals.map(deal => {
        const channelVal = deal.channelDetails || deal.salesChannel || '-';
        const dateStr = deal.wonDate ? formatDateTime(deal.wonDate).split(' ')[0] : '-';
        
        return [
            dateStr,
            deal.opportunityType || '-',
            deal.opportunityName || '(未命名)',
            deal.customerCompany || '-',
            deal.salesModel || '-',
            channelVal === '無' ? '-' : channelVal,
            deal.currentStage || '-',
            deal.numericValue || 0,
            deal.assignee || '-'
        ].map(val => {
            // 處理 CSV 特殊字元：如果包含逗點或換行，需用雙引號包起來並處理內部的雙引號
            let s = String(val).replace(/"/g, '""');
            return `"${s}"`;
        }).join(',');
    });

    // 3. 組合 CSV 字串 (包含 UTF-8 BOM 避免 Excel 亂碼)
    const csvContent = '\ufeff' + headers.join(',') + '\n' + rows.join('\n');

    // 4. 觸發下載
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileName = `成交案件分析_${salesStartDate}_至_${salesEndDate}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`已開始下載：${fileName}`, 'success');
};

if (window.CRM_APP) {
     if (!window.CRM_APP.pageModules) window.CRM_APP.pageModules = {};
    window.CRM_APP.pageModules['sales-analysis'] = loadSalesAnalysisPage;
}