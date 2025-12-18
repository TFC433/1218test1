// views/scripts/company-details-events.js
// 職責：處理「公司詳細資料頁」的所有使用者互動事件
// V-Fixed-AI: 修正 AI 生成後自動填入電話/地址/縣市，並保護分類欄位不被覆蓋

let _currentCompanyInfo = null;

function initializeCompanyEventListeners(companyInfo) {
    _currentCompanyInfo = companyInfo;
    
    // 綁定全域變數
    window.toggleCompanyEditMode = toggleCompanyEditMode;
    window.saveCompanyInfo = saveCompanyInfo;
    window.confirmDeleteCompany = confirmDeleteCompany;
    window.generateCompanyProfile = generateCompanyProfile;
    window.showEditContactModal = showEditContactModal;
    window.closeEditContactModal = closeEditContactModal;
}

// =============================================
// 切換編輯模式 (呼叫 ui.js 的渲染函式)
// =============================================

function toggleCompanyEditMode(isEditing, aiData = null) {
    const container = document.getElementById('company-info-card-container');
    if (!container) return;

    // 準備資料：如果有 AI 資料則合併，否則使用當前資料
    let dataToRender = _currentCompanyInfo;

    if (aiData) {
        dataToRender = { ..._currentCompanyInfo, ...aiData };
    } else if (isEditing) {
        // 如果只是單純切換到編輯模式，確保讀取最新狀態
        dataToRender = _currentCompanyInfo;
    }

    // 重新渲染整個卡片容器
    if (typeof renderCompanyInfoCard === 'function') {
        const newHtml = renderCompanyInfoCard(dataToRender, isEditing);
        
        // 替換 DOM
        const parent = container.parentElement;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHtml;
        const newElement = tempDiv.firstElementChild;
        
        container.replaceWith(newElement);
    } else {
        console.error('找不到 renderCompanyInfoCard 函式，無法切換模式');
    }
}

// =============================================
// 儲存與其他邏輯
// =============================================

async function saveCompanyInfo(event) {
    if (event) event.preventDefault();
    
    const form = document.getElementById('company-edit-form');
    if (!form) return;

    const formData = new FormData(form);
    const updateData = Object.fromEntries(formData.entries());
    const oldCompanyName = _currentCompanyInfo.companyName;
    const encodedOldName = encodeURIComponent(oldCompanyName);

    // 簡單前端驗證
    if (!updateData.companyName || updateData.companyName.trim() === '') {
        showNotification('公司名稱為必填項目', 'warning');
        return;
    }

    // 按鈕 loading 狀態
    const saveBtn = form.querySelector('.btn-save');
    const originalBtnContent = saveBtn ? saveBtn.innerHTML : '💾 儲存';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>儲存中...</span>';
    }

    try {
        const result = await authedFetch(`/api/companies/${encodedOldName}`, {
            method: 'PUT',
            body: JSON.stringify(updateData),
            headers: { 'Content-Type': 'application/json' }
        });

        if (result.success) {
            showNotification('公司資料已更新', 'success');
            
            // 更新本地資料快取
            _currentCompanyInfo = { ..._currentCompanyInfo, ...updateData };

            if (updateData.companyName !== oldCompanyName) {
                // 名稱變更 -> 導向新 URL (頁面會自動重整)
                window.location.hash = `#/companies/${encodeURIComponent(updateData.companyName)}`;
            } else {
                // 名稱未變 -> 切換回唯讀模式 (這會觸發重新渲染)
                toggleCompanyEditMode(false);
            }
        } else {
            throw new Error(result.error || '儲存失敗');
        }
    } catch (error) {
        console.error('儲存失敗:', error);
        showNotification('儲存失敗: ' + error.message, 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnContent;
        }
    }
}

/**
 * AI 生成簡介與自動填入資料
 * 修正重點：
 * 1. 抓取表單當前輸入 (保留使用者選好的分類/評級)
 * 2. 完整提取 AI 回傳的電話、地址、縣市
 * 3. 智慧合併，確保既有資料不流失
 */
async function generateCompanyProfile() {
    const input = document.getElementById('company-keywords-input');
    const keywords = input ? input.value : '';
    
    // 1. 取得當前表單已輸入的內容 (包含使用者剛選好的下拉選單)
    const form = document.getElementById('company-edit-form');
    let currentInputData = {};
    if (form) {
        const currentFormData = new FormData(form);
        currentInputData = Object.fromEntries(currentFormData.entries());
    }

    showLoading('AI 正在撰寫簡介並查找資料...');
    
    try {
        const encodedCompanyName = encodeURIComponent(_currentCompanyInfo.companyName);
        const result = await authedFetch(`/api/companies/${encodedCompanyName}/generate-profile`, {
            method: 'POST',
            body: JSON.stringify({ userKeywords: keywords }),
            skipRefresh: true 
        });

        if (result.success && result.data) {
            // 2. 準備 AI 回傳的資料更新 (只取特定欄位，避免覆蓋分類設定)
            const aiUpdates = {};
            
            // 簡介
            if (result.data.introduction) aiUpdates.introduction = result.data.introduction;
            
            // 自動填入：電話、地址、縣市 (如果 AI 有抓到的話)
            if (result.data.phone) aiUpdates.phone = result.data.phone;
            if (result.data.address) aiUpdates.address = result.data.address;
            if (result.data.county) aiUpdates.county = result.data.county;
            
            // 注意：這裡刻意不放入 companyType, customerStage, engagementRating
            // 這樣就會保留 currentInputData 中的值 (使用者的選擇)

            // 3. 合併資料
            const mergedData = {
                ..._currentCompanyInfo, // A. 備用：原始資料
                ...currentInputData,    // B. 基礎：使用者當前畫面上的輸入 (優先權 > 原始資料)
                ...aiUpdates            // C. 覆蓋：AI 的新發現 (優先權 > 使用者輸入，實現自動填入)
            };
            
            // 4. 重新渲染編輯模式並填入資料
            toggleCompanyEditMode(true, mergedData);
            
            showNotification('AI 簡介與聯絡資訊已生成！', 'success');
        } else {
            throw new Error(result.message || '生成失敗');
        }
    } catch (error) {
        showNotification('AI 生成失敗: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showEventLogModalByCompany() {
    if (_currentCompanyInfo && _currentCompanyInfo.companyId) {
        if (typeof showEventLogFormModal === 'function') {
            showEventLogFormModal({
                companyId: _currentCompanyInfo.companyId,
                companyName: _currentCompanyInfo.companyName
            });
        } else {
            showNotification('無法開啟事件表單 (函式未定義)', 'error');
        }
    } else {
        showNotification('無法讀取公司資訊', 'warning');
    }
}

async function confirmDeleteCompany() {
    if (!_currentCompanyInfo) return;
    const name = _currentCompanyInfo.companyName;
    
    const message = `確定要刪除「${name}」嗎？此操作無法復原。`;
    
    const performDelete = async () => {
        showLoading('刪除中...');
        try {
            const result = await authedFetch(`/api/companies/${encodeURIComponent(name)}`, { method: 'DELETE' });
            if (result.success) {
                showNotification('公司已刪除', 'success');
                window.location.hash = '#/companies';
            } else {
                showNotification('刪除失敗: ' + (result.error || '未知錯誤'), 'error');
            }
        } catch (e) {
            showNotification('刪除請求失敗', 'error');
        } finally {
            hideLoading();
        }
    };

    if (typeof showConfirmDialog === 'function') {
        showConfirmDialog(message, performDelete);
    } else if (confirm(message)) {
        performDelete();
    }
}

// 聯絡人編輯相關 (維持原樣)
function showEditContactModal(contact) {
    const modalContainer = document.createElement('div');
    modalContainer.id = 'edit-contact-modal-container';
    modalContainer.innerHTML = `
        <div id="edit-contact-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">編輯聯絡人: ${contact.name}</h2>
                    <button class="close-btn" onclick="closeEditContactModal()">&times;</button>
                </div>
                <form id="edit-contact-form">
                    <input type="hidden" id="edit-contact-id" value="${contact.contactId}">
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">部門</label><input type="text" class="form-input" id="edit-contact-department" value="${contact.department || ''}"></div>
                        <div class="form-group"><label class="form-label">職位</label><input type="text" class="form-input" id="edit-contact-position" value="${contact.position || ''}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">手機</label><input type="tel" class="form-input" id="edit-contact-mobile" value="${contact.mobile || ''}"></div>
                        <div class="form-group"><label class="form-label">公司電話</label><input type="tel" class="form-input" id="edit-contact-phone" value="${contact.phone || ''}"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="edit-contact-email" value="${contact.email || ''}"></div>
                    <button type="submit" class="submit-btn">💾 儲存變更</button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modalContainer);
    document.getElementById('edit-contact-form').addEventListener('submit', handleSaveContact);
}
function closeEditContactModal() {
    const el = document.getElementById('edit-contact-modal-container');
    if (el) el.remove();
}
async function handleSaveContact(e) {
    e.preventDefault();
    const id = document.getElementById('edit-contact-id').value;
    const data = {
        department: document.getElementById('edit-contact-department').value,
        position: document.getElementById('edit-contact-position').value,
        mobile: document.getElementById('edit-contact-mobile').value,
        phone: document.getElementById('edit-contact-phone').value,
        email: document.getElementById('edit-contact-email').value,
    };
    try {
        await authedFetch(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        showNotification('聯絡人已更新', 'success');
        closeEditContactModal();
        if (_currentCompanyInfo) {
             if(window.CRM_APP && window.CRM_APP.pageModules['company-details']) {
                 window.CRM_APP.pageModules['company-details'](encodeURIComponent(_currentCompanyInfo.companyName));
             }
        }
    } catch(e) { 
        console.error(e); 
        showNotification('更新失敗', 'error');
    }
}