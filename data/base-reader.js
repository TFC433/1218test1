// data/base-reader.js
const config = require('../config');

// 集中管理所有資料的快取狀態
const cache = {
    opportunities: { data: null, timestamp: 0 },
    contacts: { data: null, timestamp: 0 }, // 潛在客戶
    interactions: { data: null, timestamp: 0 },
    eventLogs: { data: null, timestamp: 0 },
    systemConfig: { data: null, timestamp: 0 },
    companyList: { data: null, timestamp: 0 },
    contactList: { data: null, timestamp: 0 }, // 已建檔聯絡人
    users: { data: null, timestamp: 0 },
    weeklyBusiness: { data: null, timestamp: 0 }, // 快取週間業務的完整資料
    weeklyBusinessSummary: { data: null, timestamp: 0 }, // 快取週間業務的摘要資料
    oppContactLinks: { data: null, timestamp: 0 },
    announcements: { data: null, timestamp: 0 }, // 新增佈告欄快取
    
    // 全域最後寫入時間戳
    _globalLastWrite: { data: Date.now(), timestamp: 0 }
};

// 快取時間設定 (維持 30 秒，平衡即時性與效能)
const CACHE_DURATION = 30 * 1000; 

/**
 * 所有 Reader 的基礎類別，負責處理通用的快取邏輯和 API 互動
 * 【更新】新增請求合併 (Request Deduplication) 機制
 */
class BaseReader {
    /**
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets - 已認證的 Google Sheets API 實例
     */
    constructor(sheets) {
        if (!sheets) {
            throw new Error('BaseReader 需要一個已認證的 Sheets API 實例');
        }
        this.sheets = sheets;
        this.config = config;
        this.cache = cache; // 直接使用共享的 cache 物件
        this.CACHE_DURATION = CACHE_DURATION;
        
        // 【新增】用來儲存「正在進行中」的 Promise，避免重複請求
        this._pendingPromises = {}; 
    }

    /**
     * 使指定的快取失效
     * @param {string} [key=null] - 要失效的快取鍵名
     */
    invalidateCache(key = null) {
        if (key && this.cache[key]) {
            this.cache[key].timestamp = 0;
            console.log(`✅ [Cache] 快取已失效: ${key}`);
        } else if (key === null) {
            Object.keys(this.cache).forEach(k => {
                if (this.cache[k]) this.cache[k].timestamp = 0;
            });
            console.log('✅ [Cache] 所有快取已失效');
        }

        // 更新全域時間戳
        this.cache._globalLastWrite.data = Date.now();
        console.log(`[Cache] Global write timestamp updated to: ${this.cache._globalLastWrite.data}`);
    }

    /**
     * [核心方法] 執行 "先讀快取 -> 檢查進行中請求 -> 若無則從 API 獲取" 的流程
     */
    async _fetchAndCache(cacheKey, range, rowParser, sorter = null) {
        const now = Date.now();

        // 1. 初始化快取結構
        if (!this.cache[cacheKey]) {
            console.warn(`⚠️ [Cache] 初始化不存在的快取鍵: ${cacheKey}`);
            this.cache[cacheKey] = { data: null, timestamp: 0 };
        }

        // 2. 檢查有效快取
        if (this.cache[cacheKey].data && (now - this.cache[cacheKey].timestamp < this.CACHE_DURATION)) {
            console.log(`✅ [Cache] 從快取讀取 ${cacheKey}...`);
            return this.cache[cacheKey].data;
        }

        // 3. 【核心修正】檢查是否有正在進行的請求 (Request Deduplication)
        if (this._pendingPromises[cacheKey]) {
            console.log(`⏳ [API] 偵測到併發請求，正在等待並沿用結果: ${cacheKey}`);
            return this._pendingPromises[cacheKey];
        }

        console.log(`🔄 [API] 從 Google Sheet 讀取 ${cacheKey} (${range})...`);

        // 4. 建立新的 Promise 並存入 _pendingPromises
        const fetchPromise = (async () => {
            try {
                const response = await this.sheets.spreadsheets.values.get({
                    spreadsheetId: this.config.SPREADSHEET_ID,
                    range: range,
                });

                const rows = response.data.values || [];
                let data = [];
                
                if (rows.length > 1) {
                    data = rows.slice(1).map((row, index) => {
                        const parsedRow = rowParser(row, index);
                        if (parsedRow && typeof parsedRow.rowIndex === 'undefined') {
                           parsedRow.rowIndex = index + 2;
                        }
                        return parsedRow;
                    }).filter(item => item !== null && item !== undefined);
                } else {
                     console.log(`[DataReader] 工作表 ${range} 為空或只有標頭。`);
                }

                if (sorter) {
                    data = data.sort(sorter);
                }

                // 寫入快取
                this.cache[cacheKey] = { data, timestamp: Date.now() };
                console.log(`[Cache] ${cacheKey} 快取已更新，共 ${data.length} 筆紀錄。`);
                return data;

            } catch (error) {
                console.error(`❌ [DataReader] 讀取 ${range} 時發生錯誤:`, error.message);

                if (error.code === 400 && error.message.includes('Unable to parse range')) {
                     console.warn(`⚠️ [DataReader] 工作表或範圍不存在: ${range}，快取空陣列。`);
                     this.cache[cacheKey] = { data: [], timestamp: Date.now() };
                     return [];
                }

                // 發生錯誤時，若有舊快取則回傳舊快取，否則回傳空陣列 (避免前端崩潰)
                console.warn(`⚠️ [DataReader] API 失敗，嘗試回傳舊資料或空陣列。`);
                return this.cache[cacheKey].data || [];
            } finally {
                // 【重要】無論成功失敗，都要移除 pending 標記
                delete this._pendingPromises[cacheKey];
            }
        })();

        // 儲存 Promise 以供搭便車
        this._pendingPromises[cacheKey] = fetchPromise;
        return fetchPromise;
    }

    /**
     * 在指定範圍內根據欄位值查找特定列
     */
    async findRowByValue(range, columnIndex, value) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.SPREADSHEET_ID,
                range: range,
            });
            const rows = response.data.values || [];
            
            if (rows.length > 0 && columnIndex >= rows[0].length) {
                 return null;
            }
            for (let i = 1; i < rows.length; i++) { 
                if (rows[i] && rows[i][columnIndex] !== undefined && rows[i][columnIndex] !== null) {
                   if (String(rows[i][columnIndex]).toLowerCase() === String(value).toLowerCase()) {
                        return { rowData: rows[i], rowIndex: i + 1 }; 
                   }
                }
            }
            return null;
        } catch (error) {
            if (error.code === 400 && error.message.includes('Unable to parse range')) {
                 return null;
            }
            console.error(`❌ [DataReader] 查找值失敗:`, error.message);
            throw error; 
        }
    }
}

module.exports = BaseReader;