// public/scripts/core/scripts-config.js
// 職責：定義系統所有腳本的加載順序與依賴關係

window.CRM_SCRIPTS_CONFIG = {
    // 1. 核心腳本：系統啟動時必須立即載入，且順序不可調換
    core: [
        'scripts/core/theme-toggle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
        'scripts/core/utils.js',
        'scripts/services/api.js',
        'scripts/services/ui.js',
        'scripts/services/charting.js',
        'scripts/core/constants.js',
        'scripts/core/layout-manager.js',
        'scripts/core/sync-service.js',
        'scripts/core/router.js',
        'scripts/components/chip-wall.js',
        'scripts/meetings.js',
        'scripts/interactions.js',
        'scripts/announcements.js',
        'scripts/map-manager.js',
        'scripts/kanban-board.js'
    ],

    // 2. 功能頁面腳本：切換到該 Hash 頁面時才會動態載入
    features: {
        'dashboard': [
            'scripts/dashboard/dashboard_ui.js',
            'scripts/dashboard/dashboard_widgets.js',
            'scripts/dashboard/dashboard_weekly.js',
            'scripts/dashboard/dashboard_kanban.js',
            'scripts/dashboard/dashboard.js'
        ],
        'contacts': [
            'scripts/contacts/contact-potential-manager.js',
            'scripts/contacts/contacts.js'
        ],
        'opportunities': [
            'scripts/opportunities/opportunities.js',
            'scripts/opportunities/opportunity-modals.js'
        ],
        'opportunity-details': [
            'scripts/opportunities/details/opportunity-stepper.js',
            'scripts/opportunities/details/opportunity-interactions.js',
            'scripts/opportunities/details/opportunity-associated-contacts.js',
            'scripts/opportunities/details/opportunity-event-reports.js',
            'scripts/opportunities/details/opportunity-info-view.js',
            'scripts/opportunities/details/opportunity-details-components.js',
            'scripts/opportunities/opportunity-details-events.js',
            'scripts/opportunities/opportunity-details.js'
        ],
        'sales-analysis': [
            'scripts/sales/sales-analysis-helper.js',
            'scripts/sales/sales-analysis-components.js',
            'scripts/sales/sales-analysis.js'
        ],
        'events': [
            'scripts/events/event-charts.js',
            'scripts/events/event-list.js',
            'scripts/events/event-report-manager.js',
            'scripts/events/event-wizard.js',
            'scripts/events/event-modal-manager.js',
            'scripts/events/event-editor-standalone.js',
            'scripts/events/events.js'
        ],
        'weekly-business': [
            'scripts/weekly/weekly-business.js'
        ],
        'companies': [
            'scripts/companies/company-list.js',
            'scripts/companies/company-details-ui.js',
            'scripts/companies/company-details-events.js',
            'scripts/companies/companies.js'
        ],
        'announcements': [
            'scripts/announcements.js'
        ]
    }
};