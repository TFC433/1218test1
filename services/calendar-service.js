// services/calendar-service.js - 日曆服務模組 (含快取優化)
const { google } = require('googleapis');
const config = require('../config');

class CalendarService {
    constructor(authClient) {
        if (!authClient) throw new Error('CalendarService 需要 authClient');
        this.calendar = google.calendar({ version: 'v3', auth: authClient });
        this.config = config;
        this.holidayCalendarId = 'zh-TW.taiwan#holiday@group.v.calendar.google.com';

        // 【新增】簡單的內部快取
        this._cache = {
            weekEvents: { data: null, timestamp: 0 }
        };
        // 快取時間設為 60 秒
        this.CACHE_DURATION = 60 * 1000;
    }

    /**
     * 建立日曆事件 (支援全天事件)
     */
    async createCalendarEvent(eventData) {
        try {
            console.log(`📅 [CalendarService] 建立日曆事件: ${eventData.title} (全天: ${eventData.isAllDay})`);
            
            const event = {
                summary: eventData.title,
                description: eventData.description || '',
                location: eventData.location || '',
            };

            if (eventData.isAllDay) {
                const startDateStr = new Date(eventData.startTime).toLocaleDateString('en-CA', { 
                    timeZone: this.config.TIMEZONE 
                });
                
                const startDate = new Date(eventData.startTime);
                const endDateDate = new Date(startDate);
                endDateDate.setDate(endDateDate.getDate() + 1);
                
                const endDateStr = endDateDate.toLocaleDateString('en-CA', { 
                    timeZone: this.config.TIMEZONE 
                });

                event.start = { date: startDateStr };
                event.end = { date: endDateStr };
            } else {
                const startTime = new Date(eventData.startTime);
                let endTime = eventData.endTime ? new Date(eventData.endTime) : null;
                if (!endTime) {
                    const duration = eventData.duration || 60;
                    endTime = new Date(startTime.getTime() + duration * 60000);
                }

                event.start = { dateTime: startTime.toISOString(), timeZone: this.config.TIMEZONE };
                event.end = { dateTime: endTime.toISOString(), timeZone: this.config.TIMEZONE };
            }
    
            const response = await this.calendar.events.insert({
                calendarId: this.config.CALENDAR_ID,
                resource: event,
            });
            
            console.log('✅ [CalendarService] 日曆事件建立成功:', response.data.id);

            // 【新增】因為有新事件，讓快取失效，確保下次讀取到最新的
            this._cache.weekEvents.data = null;

            return { success: true, eventId: response.data.id, eventUrl: response.data.htmlLink };
        } catch (error) {
            console.error('❌ [CalendarService] 建立Calendar事件失敗:', error.response ? error.response.data.error : error.message);
            throw error;
        }
    }

    async getThisWeekEvents() {
        // 【新增】檢查快取
        const now = Date.now();
        if (this._cache.weekEvents.data && (now - this._cache.weekEvents.timestamp < this.CACHE_DURATION)) {
            console.log('✅ [CalendarService] 使用本週事件快取 (60s)');
            return this._cache.weekEvents.data;
        }

        try {
            // console.log('🔄 [CalendarService] 呼叫 Google API 讀取本週事件...');
            const nowTime = new Date();
            const startOfWeek = new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate() - nowTime.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            
            const response = await this.calendar.events.list({
                calendarId: this.config.CALENDAR_ID,
                timeMin: startOfWeek.toISOString(),
                timeMax: endOfWeek.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            
            const events = response.data.items || [];
            const today = new Date().toDateString();
            
            const todayEvents = events.filter(event => {
                const eventDate = new Date(event.start.dateTime || event.start.date);
                return eventDate.toDateString() === today;
            });
            
            const result = {
                todayCount: todayEvents.length,
                weekCount: events.length,
                todayEvents: todayEvents.slice(0, 3),
                allEvents: events
            };

            // 【新增】寫入快取
            this._cache.weekEvents = { data: result, timestamp: now };
            
            return result;

        } catch (error) {
            console.error('❌ [CalendarService] 讀取Calendar事件失敗:', error);
            // 失敗時回傳空結構，不快取錯誤
            return { todayCount: 0, weekCount: 0, todayEvents: [], allEvents: [] };
        }
    }

    /**
     * 【修改】取得指定期間的所有日曆事件 (支援指定 calendarId)
     */
    async getEventsForPeriod(startDate, endDate, calendarId = null) {
        const targetCalendarId = calendarId || this.config.CALENDAR_ID;
        
        if (!targetCalendarId) {
            console.warn('⚠️ [CalendarService] 未設定 Calendar ID，跳過查詢。');
            return [];
        }

        try {
            const response = await this.calendar.events.list({
                calendarId: targetCalendarId,
                timeMin: startDate.toISOString(),
                timeMax: endDate.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            
            return response.data.items || [];
        } catch (error) {
            console.warn(`⚠️ [CalendarService] 讀取日曆 (${targetCalendarId}) 失敗:`, error.message);
            return [];
        }
    }

    async getHolidaysForPeriod(startDate, endDate) {
        try {
            // console.log(`[CalendarService] 查詢國定假日: ${startDate.toISOString()} - ${endDate.toISOString()}`);
            const response = await this.calendar.events.list({
                calendarId: this.holidayCalendarId,
                timeMin: startDate.toISOString(),
                timeMax: endDate.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });

            const holidays = new Map();
            if (response.data.items) {
                response.data.items.forEach(event => {
                    const holidayDate = event.start.date; 
                    if (holidayDate) {
                        holidays.set(holidayDate, event.summary);
                    }
                });
            }
            return holidays;
        } catch (error) {
            console.error('❌ [CalendarService] 獲取國定假日失敗:', error.message);
            return new Map();
        }
    }
}

module.exports = CalendarService;