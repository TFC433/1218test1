// public/scripts/dashboard/dashboard_widgets.js

const DashboardWidgets = {
    /**
     * 渲染儀表板上方的統計數字卡片
     * @param {Object} stats - 統計資料物件
     */
    renderStats(stats = {}) {
        const updateText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        // 1. 潛在客戶
        updateText('contacts-count', stats.contactsCount || 0);
        const contactsTrend = document.getElementById('contacts-trend');
        if (contactsTrend) contactsTrend.textContent = stats.contactsCountMonth > 0 ? `+ ${stats.contactsCountMonth} 本月` : '';

        // 2. 機會案件
        updateText('opportunities-count', stats.opportunitiesCount || 0);
        const opportunitiesTrend = document.getElementById('opportunities-trend');
        if (opportunitiesTrend) opportunitiesTrend.textContent = stats.opportunitiesCountMonth > 0 ? `+ ${stats.opportunitiesCountMonth} 本月` : '';
        
        // 3. 事件紀錄
        updateText('event-logs-count', stats.eventLogsCount || 0);
        const eventLogsTrend = document.getElementById('event-logs-trend');
        if (eventLogsTrend) eventLogsTrend.textContent = stats.eventLogsCountMonth > 0 ? `+ ${stats.eventLogsCountMonth} 本月` : '';

        // 4. 成交案件數 (New)
        updateText('won-count', stats.wonCount || 0);
        const wonTrend = document.getElementById('won-trend');
        if (wonTrend) wonTrend.textContent = stats.wonCountMonth > 0 ? `+ ${stats.wonCountMonth} 本月` : '';

        // 5. 拜訪公司 MTU (New)
        updateText('mtu-count', stats.mtuCount || 0);
        const mtuTrend = document.getElementById('mtu-trend');
        if (mtuTrend) mtuTrend.textContent = stats.mtuCountMonth > 0 ? `+ ${stats.mtuCountMonth} 本月` : '';

        // 6. 拜訪公司 SI (New)
        updateText('si-count', stats.siCount || 0);
        const siTrend = document.getElementById('si-trend');
        if (siTrend) siTrend.textContent = stats.siCountMonth > 0 ? `+ ${stats.siCountMonth} 本月` : '';

        // 待追蹤 (舊有邏輯，雖然移除了卡片，但若有其他地方用到可保留)
        updateText('followup-count', stats.followUpCount || 0);
    },

    /**
     * 渲染公告區塊
     * @param {Array} announcements - 公告列表
     */
    renderAnnouncements(announcements) {
        const container = document.querySelector('#announcement-widget .widget-content');
        const header = document.querySelector('#announcement-widget .widget-header');
        if (!container || !header) return;

        // 清除舊按鈕避免重複
        const oldBtn = header.querySelector('.action-btn');
        if(oldBtn) oldBtn.remove();

        const viewAllBtn = document.createElement('button');
        viewAllBtn.className = 'action-btn secondary';
        viewAllBtn.textContent = '查看更多公告';
        viewAllBtn.onclick = () => CRM_APP.navigateTo('announcements');
        header.appendChild(viewAllBtn);

        if (!announcements || announcements.length === 0) {
            container.innerHTML = `<div class="alert alert-info" style="text-align: center;">目前沒有公告</div>`;
            return;
        }

        let html = '<div class="announcement-list">';
        // 僅顯示最新的一則
        announcements.slice(0, 1).forEach(item => {
            const isPinnedIcon = item.isPinned ? '<span class="pinned-icon" title="置頂公告">📌</span>' : '';
            html += `
                <div class="announcement-item" data-announcement-id="${item.id}">
                    <div class="announcement-header">
                        <h4 class="announcement-title">${isPinnedIcon}${item.title}</h4>
                        <span class="announcement-creator">👤 ${item.creator}</span>
                    </div>
                    <p class="announcement-content">${item.content}</p>
                    <div class="announcement-footer">
                        <span class="announcement-time">發佈於 ${formatDateTime(item.lastUpdateTime)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

        // 處理過長內容的展開收合
        const announcementItem = container.querySelector('.announcement-item');
        if (announcementItem) {
            const contentP = announcementItem.querySelector('.announcement-content');
            if (contentP.scrollHeight > contentP.clientHeight) {
                const footer = announcementItem.querySelector('.announcement-footer');
                const toggleBtn = document.createElement('button');
                toggleBtn.textContent = '展開';
                toggleBtn.className = 'action-btn small secondary announcement-toggle';
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    contentP.classList.toggle('expanded');
                    toggleBtn.textContent = contentP.classList.contains('expanded') ? '收合' : '展開';
                };
                footer.prepend(toggleBtn);
            }
        }
        
        // 注入樣式
        this._ensureStyles();
    },

    /**
     * 渲染最新動態列表
     * @param {Array} feedData - 動態資料列表
     * @returns {string} HTML 字串 (僅回傳字串，由 Controller 注入 DOM)
     */
    renderActivityFeed(feedData) {
        if (!feedData || feedData.length === 0) return '<div class="alert alert-info">尚無最新動態</div>';
        
        const iconMap = { '系統事件': '⚙️', '會議討論': '📅', '事件報告': '📝', '電話聯繫': '📞', '郵件溝通': '📧', 'new_contact': '👤' };
        let html = '<ul class="activity-feed-list">';
        
        feedData.forEach(item => {
            html += `<li class="activity-feed-item">`;
            if (item.type === 'interaction') {
                const i = item.data;
                let contextLink = i.contextName || '系統活動';
                // 產生連結
                if (i.opportunityId) {
                    contextLink = `<a href="#" class="text-link" onclick="event.preventDefault(); CRM_APP.navigateTo('opportunity-details', { opportunityId: '${i.opportunityId}' })">${i.contextName}</a>`;
                } else if (i.companyId && i.contextName !== '系統活動' && i.contextName !== '未知公司' && i.contextName !== '未指定') {
                    const encodedCompanyName = encodeURIComponent(i.contextName);
                    contextLink = `<a href="#" class="text-link" onclick="event.preventDefault(); CRM_APP.navigateTo('company-details', { companyName: '${encodedCompanyName}' })">${i.contextName}</a>`;
                }
                
                // 處理連結內容的 markdown 格式
                let summaryHTML = i.contentSummary || '';
                const linkRegex = /\[(.*?)\]\(event_log_id=([a-zA-Z0-9]+)\)/g;
                summaryHTML = summaryHTML.replace(linkRegex, (fullMatch, text, eventId) => {
                    const safeEventId = eventId.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    return `<a href="#" class="text-link" onclick="event.preventDefault(); showEventLogReport('${safeEventId}')">${text}</a>`;
                });

                html += `<div class="feed-icon">${iconMap[i.eventType] || '🔔'}</div>
                         <div class="feed-content">
                            <div class="feed-text"><strong>${i.recorder}</strong> 在 <strong>${contextLink}</strong> ${i.eventTitle ? `建立了${i.eventTitle}` : `新增了一筆${i.eventType}`}</div>
                            <div class="feed-summary">${summaryHTML}</div>
                            <div class="feed-time">${formatDateTime(i.interactionTime)}</div>
                         </div>`;
            } else if (item.type === 'new_contact') {
                const c = item.data;
                const creator = c.userNickname ? `<strong>${c.userNickname}</strong> 新增了潛在客戶:` : `<strong>新增潛在客戶:</strong>`;
                html += `<div class="feed-icon">${iconMap['new_contact']}</div>
                         <div class="feed-content">
                            <div class="feed-text">${creator} ${c.name || '(無姓名)'}</div>
                            <div class="feed-summary">🏢 ${c.company || '(無公司資訊)'}</div>
                            <div class="feed-time">${formatDateTime(c.createdTime)}</div>
                         </div>`;
            }
            html += `</li>`;
        });
        html += '</ul>';
        return html;
    },

    _ensureStyles() {
        if (!document.getElementById('announcement-styles')) {
            const style = document.createElement('style');
            style.id = 'announcement-styles';
            style.innerHTML = `
                .announcement-item { padding: 1rem; border-radius: var(--rounded-lg); cursor: pointer; transition: background-color 0.2s ease; border: 1px solid var(--border-color); }
                .announcement-item:hover { background-color: var(--glass-bg); }
                .announcement-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; gap: 1rem; }
                .announcement-title { font-weight: 600; color: var(--text-primary); margin: 0; }
                .pinned-icon { margin-right: 0.5rem; }
                .announcement-creator { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); background: var(--glass-bg); padding: 2px 8px; border-radius: 1rem; flex-shrink: 0; }
                .announcement-content { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin: 0; white-space: pre-wrap; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
                .announcement-content.expanded { -webkit-line-clamp: unset; max-height: none; }
                .announcement-footer { margin-top: 0.75rem; display:flex; justify-content: space-between; align-items: center; }
                .announcement-toggle { margin-right: auto; }
                .announcement-time { font-size: 0.8rem; color: var(--text-muted); }
            `;
            document.head.appendChild(style);
        }
    }
};

window.DashboardWidgets = DashboardWidgets;