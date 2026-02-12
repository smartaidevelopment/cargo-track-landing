// Dashboard functionality

let map = null;
let globalMap = null;
let areasMap = null;
let areasLayerGroup = null;
let mapAreasLayerGroup = null;
let globalAreasLayerGroup = null;
let areaDraftMarker = null;
let areaDraftCircle = null;
let areaDraftPolygonPoints = [];
let areaDraftPolyline = null;
let areaDraftPolygon = null;
let areaDraftPolygonClosed = false;
let areaDraftPolygonMarkers = [];
let deviceMarkers = [];
let globalDeviceMarkers = [];
let charts = {};
let historyRouteLayer = null;
let historyRouteMarkers = [];
let historyRequestId = 0;
let mapAutoRefreshInterval = null;
let mapAutoRefreshEnabled = false;
let liveLocationInterval = null;
const LIVE_LOCATION_POLL_MS = 5000;
const DASHBOARD_LAYOUT_KEY = 'cargotrack_dashboard_layout_v1';
const STALE_DEVICE_MS = 2 * 60 * 1000;
const AREAS_STORAGE_KEY = 'cargotrack_areas';
const AREA_STATE_STORAGE_KEY = 'cargotrack_area_state';
const ASSETS_STORAGE_KEY = 'cargotrack_assets';
const ASSET_CATEGORY_FILTER_KEY = 'cargotrack_asset_category_filter';
const GROUPS_STORAGE_KEY = 'cargotrack_groups';
const USERS_STORAGE_KEY = 'cargotrack_users';
const DEVICE_REGISTRY_KEY = 'cargotrack_device_registry';
const LOGISTICS_STATE_KEY = 'cargotrack_logistics_state';
const SMS_NOTIFICATIONS_KEY = 'cargotrack_sms_notifications';
const MOBILE_PUSH_NOTIFICATIONS_KEY = 'cargotrack_mobile_push_notifications';
const ANALYTICS_SAMPLE_INTERVAL_MS = 5 * 60 * 1000;
const ANALYTICS_REFRESH_MS = 2 * 60 * 1000;
const ANALYTICS_SAMPLE_ENDPOINT = '/api/analytics';
const LOGISTICS_SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_MAP_LIST_RENDER = 300;
const CONFIG_SECTIONS = new Set([
    'devices-management',
    'config-areas',
    'config-assets',
    'config-groups',
    'config-users'
]);
const DEVICE_MODEL_PRESETS = [
    {
        id: 'teltonika-fmc130',
        label: 'Teltonika FMC130 (4G LTE)',
        networks: ['4G LTE', 'GPS/GNSS'],
        dataFormat: 'codec8',
        dataLogFrequency: 5000
    },
    {
        id: 'teltonika-fmm130',
        label: 'Teltonika FMM130 (LTE Cat-M1)',
        networks: ['LTE Cat-M1', 'GPS/GNSS'],
        dataFormat: 'codec8',
        dataLogFrequency: 5000
    },
    {
        id: 'teltonika-fmb920',
        label: 'Teltonika FMB920 (2G)',
        networks: ['2G', 'GPS/GNSS'],
        dataFormat: 'codec8',
        dataLogFrequency: 10000
    },
    {
        id: 'teltonika-tat140',
        label: 'TAT140 (4G LTE Cat 1)',
        networks: ['4G LTE', 'GPS/GNSS', 'BLE'],
        dataFormat: 'codec8ext',
        dataLogFrequency: 5000
    },
    {
        id: 'teltonika-tat141',
        label: 'TAT141 (LTE Cat-M1)',
        networks: ['LTE Cat-M1', 'GPS/GNSS', 'BLE'],
        dataFormat: 'codec8ext',
        dataLogFrequency: 5000
    },
    {
        id: 'concox-gt06n',
        label: 'Concox GT06N (2G)',
        networks: ['2G', 'GPS/GNSS'],
        dataFormat: 'binary',
        dataLogFrequency: 10000
    },
    {
        id: 'meitrack-t366g',
        label: 'Meitrack T366G (4G LTE)',
        networks: ['4G LTE', 'GPS/GNSS'],
        dataFormat: 'auto',
        dataLogFrequency: 10000
    },
    {
        id: 'queclink-gv300',
        label: 'Queclink GV300 (3G)',
        networks: ['3G', 'GPS/GNSS'],
        dataFormat: 'auto',
        dataLogFrequency: 10000
    },
    {
        id: 'queclink-gv500',
        label: 'Queclink GV500 (4G LTE)',
        networks: ['4G LTE', 'GPS/GNSS'],
        dataFormat: 'auto',
        dataLogFrequency: 10000
    },
    {
        id: 'calamp-lmu3030',
        label: 'CalAmp LMU-3030 (4G LTE)',
        networks: ['4G LTE', 'GPS/GNSS'],
        dataFormat: 'auto',
        dataLogFrequency: 10000
    },
    {
        id: 'suntech-st4300',
        label: 'Suntech ST4300 (3G)',
        networks: ['3G', 'GPS/GNSS'],
        dataFormat: 'auto',
        dataLogFrequency: 10000
    },
    {
        id: 'ruptela-trace5',
        label: 'Ruptela Trace5 (4G LTE)',
        networks: ['4G LTE', 'GPS/GNSS'],
        dataFormat: 'auto',
        dataLogFrequency: 10000
    },
    {
        id: 'jimi-vl110',
        label: 'Jimi VL110 (4G LTE)',
        networks: ['4G LTE', 'GPS/GNSS'],
        dataFormat: 'auto',
        dataLogFrequency: 10000
    },
    {
        id: 'xirgo-xt63xx',
        label: 'Xirgo XT63xx (4G LTE)',
        networks: ['4G LTE', 'GPS/GNSS'],
        dataFormat: 'auto',
        dataLogFrequency: 10000
    }
];

// Helper function to safely get current user
function safeGetCurrentUser() {
    // Check both window.getCurrentUser and global getCurrentUser
    const getCurrentUserFn = window.getCurrentUser || (typeof getCurrentUser !== 'undefined' ? getCurrentUser : null);
    
    if (typeof getCurrentUserFn === 'function') {
        try {
            return getCurrentUserFn();
        } catch (e) {
            console.warn('Error calling getCurrentUser:', e);
            return null;
        }
    }
    return null;
}

function isSessionTokenValid(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const body = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const pad = body.length % 4 ? '='.repeat(4 - (body.length % 4)) : '';
    try {
        const claims = JSON.parse(atob(body + pad));
        if (!claims || typeof claims !== 'object') return false;
        if (!claims.exp || Number.isNaN(Number(claims.exp))) return false;
        const safetyWindowMs = 30 * 1000;
        return Number(claims.exp) > (Date.now() + safetyWindowMs);
    } catch (error) {
        return false;
    }
}

async function ensureApiSessionToken(currentUser, options = {}) {
    try {
        const { forceRefresh = false } = options || {};
        const existingToken = localStorage.getItem('cargotrack_session_token');
        if (!forceRefresh && isSessionTokenValid(existingToken)) return true;
        if (!currentUser || !currentUser.email) return false;
        if (typeof window.requestSessionToken !== 'function') return false;
        if (typeof window.getUsers !== 'function') return false;

        const users = window.getUsers();
        const matching = Array.isArray(users)
            ? users.find((item) => item.email === currentUser.email)
            : null;
        if (!matching || !matching.password) return false;

        if (forceRefresh) {
            localStorage.removeItem('cargotrack_session_token');
        }
        const tokenResult = await window.requestSessionToken('user', matching.email, matching.password);
        if (!tokenResult?.success) return false;
        const refreshedToken = localStorage.getItem('cargotrack_session_token');
        return isSessionTokenValid(refreshedToken);
    } catch (error) {
        console.warn('Failed to ensure API session token:', error);
        return false;
    }
}

// Skip authentication check here - it's handled by dashboard.html inline script
// This prevents duplicate checks and flickering

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Skip if redirect is in progress
    if (window.authRedirectInProgress) {
        return;
    }
    
    // Final safety check - only if auth wasn't verified by inline script
    if (!window.authVerified) {
        // Wait a moment for inline script to complete
        setTimeout(() => {
            if (window.authRedirectInProgress) {
                return;
            }
            
            if (!window.authVerified && typeof isAuthenticated !== 'undefined') {
                if (!isAuthenticated()) {
                    window.authRedirectInProgress = true;
                    const loadingOverlay = document.getElementById('authLoadingOverlay');
                    if (loadingOverlay) {
                        loadingOverlay.innerHTML = '<div style="text-align: center;"><div style="font-size: 2rem; margin-bottom: 1rem;">🔒</div><div>Redirecting to login...</div></div>';
                    }
                    setTimeout(() => {
                        window.location.replace('login.html');
                    }, 300);
                    return;
                } else {
                    window.authVerified = true;
                }
            }
            
            // Hide overlay if auth is verified
            if (window.authVerified) {
                hideAuthOverlay();
            }
        }, 100);
    } else {
        // Auth already verified - hide overlay immediately
        hideAuthOverlay();
    }
    
    function hideAuthOverlay() {
        const loadingOverlay = document.getElementById('authLoadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 300);
        }
    }
    
    // Show content with fade in
    document.body.classList.add('auth-verified');
    // Get current user (ensure function is available)
    const currentUser = safeGetCurrentUser();
    ensureApiSessionToken(currentUser).catch(() => {});
    if (currentUser) {
        // Update user info in sidebar
        const userNameEl = document.getElementById('userName');
        const userEmailEl = document.getElementById('userEmail');
        if (userNameEl) {
            userNameEl.textContent = currentUser.company || 'User';
        }
        if (userEmailEl) {
            userEmailEl.textContent = currentUser.email;
        }
    } else {
        // Retry a few times, but not indefinitely
        let retryCount = 0;
        const maxRetries = 5;
        const retryUserInfo = () => {
            retryCount++;
            const currentUser = safeGetCurrentUser();
            if (currentUser) {
                const userNameEl = document.getElementById('userName');
                const userEmailEl = document.getElementById('userEmail');
                if (userNameEl) {
                    userNameEl.textContent = currentUser.company || 'User';
                }
                if (userEmailEl) {
                    userEmailEl.textContent = currentUser.email;
                }
            } else if (retryCount < maxRetries) {
                setTimeout(retryUserInfo, 200);
            } else {
                console.warn('getCurrentUser not available after retries, user info will not be updated');
            }
        };
        setTimeout(retryUserInfo, 200);
    }
    
    // Initialize navigation
    initNavigation();
    
    // Initialize sections
    initDashboard();
    initLiveTracking();
    initGlobalMap();
    initAlerts();
    initNotifications();
    initAnalytics();
    initDevicesManagement();
    initConfigurationManagement();
    initSettings();
    initLiveLocationPolling();
    
    // Initialize logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (typeof logout === 'function') {
                logout();
            } else {
                console.warn('logout function not available');
                // Fallback: clear auth and redirect
                localStorage.removeItem('cargotrack_auth');
                window.location.replace('login.html');
            }
        });
    }
    
    // Load initial data
    loadDashboardData();
    loadDevices();
    loadAlerts();
    runLogisticsMonitoringSweep();

    // Rehydrate once after storage sync finishes to avoid "needs refresh" first-load gaps.
    let hasRefreshedAfterStorageSync = false;
    const refreshAfterStorageSync = () => {
        if (hasRefreshedAfterStorageSync) return;
        hasRefreshedAfterStorageSync = true;
        loadDashboardData();
        loadDevices();
        loadAlerts();
        runLogisticsMonitoringSweep();
        if (document.querySelector('#analytics.content-section.active')) {
            renderAnalyticsCharts();
        }
    };

    window.addEventListener('cargotrack:storage-sync-complete', refreshAfterStorageSync, { once: true });
    if (window.CargoTrackStorageSync?.hasCompletedInitialSync?.()) {
        refreshAfterStorageSync();
    }
    
    // Set up auto-refresh
    setInterval(() => {
        if (document.querySelector('#devices.content-section.active')) {
            updateMap();
        }
        loadDashboardData();
        loadAlerts();
        runLogisticsMonitoringSweep();
    }, 30000); // Refresh every 30 seconds

    setInterval(runLogisticsMonitoringSweep, LOGISTICS_SWEEP_INTERVAL_MS);
});

// Navigation
function setActiveSection(targetSection, options = {}) {
    const updateHash = options.updateHash !== false;
    const sectionId = (targetSection || '').replace('#', '').trim();
    if (!sectionId) return;

    const sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;

    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(nav => nav.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    sections.forEach(section => section.classList.remove('active'));
    sectionEl.classList.add('active');

    // Always reset scroll position when switching sections.
    // Main content is the active scroll container in this layout.
    const mainContent = document.querySelector('.main-content');
    if (mainContent && typeof mainContent.scrollTo === 'function') {
        mainContent.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } else if (mainContent) {
        mainContent.scrollTop = 0;
    }
    sectionEl.scrollTop = 0;

    if (updateHash) {
        window.location.hash = sectionId;
    }

    const titles = {
        'dashboard': 'Dashboard',
        'devices': 'Map',
        'alerts': 'Alerts',
        'analytics': 'Analytics',
        'devices-management': 'Devices',
        'config-areas': 'Areas',
        'config-assets': 'Assets',
        'config-groups': 'Groups',
        'config-users': 'Users',
        'privacy': 'Privacy & Data',
        'billing': 'Billing & Invoices',
        'settings': 'Settings'
    };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = titles[sectionId] || 'Dashboard';
    }

    if (sectionId === 'devices' && !map) {
        initMap();
    }
    if (sectionId === 'analytics') {
        ensureAnalyticsChartsReady();
    }
    if (sectionId === 'config-areas') {
        if (!areasMap) {
            initAreasMap();
        }
        if (areasMap) {
            setTimeout(() => areasMap.invalidateSize(), 0);
        }
        loadAreas();
    }
    if (sectionId === 'billing') {
        loadUserInvoices();
    }
    if (sectionId === 'settings') {
        loadAccountSettings();
        loadNotificationSettings();
    }

    const configGroup = document.getElementById('configNavGroup');
    const configToggle = document.querySelector('.nav-item-toggle[data-toggle="config-menu"]');
    if (configGroup) {
        const shouldOpen = CONFIG_SECTIONS.has(sectionId);
        configGroup.classList.toggle('is-open', shouldOpen);
        if (configToggle) {
            configToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        }
    }
}

function ensureAnalyticsChartsReady() {
    const hasShipmentChart = !!charts.shipmentTrends;
    const hasAlertChart = !!charts.alertDistribution;
    if (!hasShipmentChart || !hasAlertChart) {
        initCharts();
        return;
    }
    refreshAnalyticsCharts();
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.classList.contains('nav-item-toggle')) {
            return;
        }
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('data-section');
            setActiveSection(targetSection, { updateHash: true });
        });
    });

    const configToggle = document.querySelector('.nav-item-toggle[data-toggle="config-menu"]');
    const configGroup = document.getElementById('configNavGroup');
    if (configToggle && configGroup) {
        configToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = configGroup.classList.toggle('is-open');
            configToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    const initialSection = window.location.hash ? window.location.hash.slice(1) : 'dashboard';
    setActiveSection(initialSection, { updateHash: false });

    window.addEventListener('hashchange', () => {
        const hashSection = window.location.hash ? window.location.hash.slice(1) : 'dashboard';
        setActiveSection(hashSection, { updateHash: false });
    });
}

function initNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationViewAll = document.getElementById('notificationViewAll');
    const notificationMarkAllRead = document.getElementById('notificationMarkAllRead');
    if (!notificationBtn || !notificationDropdown) return;

    const closeDropdown = () => {
        notificationDropdown.classList.remove('open');
        notificationBtn.setAttribute('aria-expanded', 'false');
        notificationDropdown.setAttribute('aria-hidden', 'true');
    };

    const toggleDropdown = () => {
        const isOpen = notificationDropdown.classList.contains('open');
        if (isOpen) {
            closeDropdown();
        } else {
            notificationDropdown.classList.add('open');
            notificationBtn.setAttribute('aria-expanded', 'true');
            notificationDropdown.setAttribute('aria-hidden', 'false');
        }
    };

    notificationBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleDropdown();
    });

    if (notificationViewAll) {
        notificationViewAll.addEventListener('click', () => {
            closeDropdown();
            setActiveSection('alerts', { updateHash: true });
        });
    }

    if (notificationMarkAllRead) {
        notificationMarkAllRead.addEventListener('click', () => {
            markAllAlertsRead();
            loadAlerts();
            closeDropdown();
        });
    }

    document.addEventListener('click', (event) => {
        if (!notificationDropdown.contains(event.target) && !notificationBtn.contains(event.target)) {
            closeDropdown();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeDropdown();
        }
    });
}

function renderNotificationDropdown(alerts) {
    const container = document.getElementById('notificationDropdownBody');
    if (!container) return;

    if (!alerts || alerts.length === 0) {
        container.innerHTML = '<p class="empty-state">No alerts at this time</p>';
        return;
    }

    const preview = alerts.slice(0, 5);
    container.innerHTML = preview.map(alert => `
        <div class="notification-item ${alert.severity} ${alert.read ? '' : 'unread'}" onclick="markAlertRead('${alert.id}')">
            <div class="notification-item-icon">
                <i class="${alert.icon}"></i>
            </div>
            <div class="notification-item-content">
                <p class="notification-item-title">${alert.title}</p>
                <p class="notification-item-message">${alert.message}</p>
                <span class="notification-item-time">${formatTime(alert.timestamp)}</span>
            </div>
        </div>
    `).join('');
}

// Dashboard initialization
function initDashboard() {
    // Activity list will be populated by loadDashboardData
    initDashboardLayout();
    initDashboardActions();
    initOverviewNavigation();
}

function initDashboardActions() {
    const cardMenuButtons = document.querySelectorAll('.card-menu-btn');
    cardMenuButtons.forEach(button => {
        button.addEventListener('click', () => {
            const label = button.getAttribute('data-card-menu') || 'this card';
            alert(`More actions for ${label} are coming soon.`);
        });
    });

    const filterBtn = document.getElementById('deviceStatusFilterBtn');
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            applyDeviceStatusFilter();
        });
    }

    const exportBtn = document.getElementById('deviceStatusExportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportDeviceStatusTable();
        });
    }

    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            deviceSearchTerm = getDeviceSearchTerm();
            loadDevices();
            updateDevicesTable(getDevices());
        });
    }
}

function initOverviewNavigation() {
    const goToSection = (sectionId) => {
        if (!sectionId) return;
        setActiveSection(sectionId, { updateHash: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const shortcutButtons = document.querySelectorAll('.dashboard-shortcut[data-dashboard-shortcut]');
    shortcutButtons.forEach((button) => {
        button.addEventListener('click', () => {
            goToSection(button.getAttribute('data-dashboard-shortcut'));
        });
    });

    const overviewCards = document.querySelectorAll('.mini-stat-card[data-target-section]');
    overviewCards.forEach((card) => {
        const targetSection = card.getAttribute('data-target-section');
        if (!targetSection) return;
        card.addEventListener('click', () => {
            goToSection(targetSection);
        });
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                goToSection(targetSection);
            }
        });
    });
}

function showToast(message, tone = 'success') {
    if (!message) return;

    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${tone || 'info'}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 250);
    }, 2400);
}

function initDashboardLayout() {
    const layoutContainer = document.getElementById('dashboardLayout');
    const toggleBtn = document.getElementById('toggleDashboardLayout');
    const resetBtn = document.getElementById('resetDashboardLayout');
    if (!layoutContainer || !toggleBtn) return;

    const cards = Array.from(layoutContainer.querySelectorAll('.dashboard-card[data-layout-id]'));
    const defaultOrder = cards.map((card) => card.dataset.layoutId);
    const savedOrder = getSavedDashboardLayout();
    if (savedOrder.length) {
        applyDashboardLayout(layoutContainer, cards, savedOrder);
    }

    toggleBtn.addEventListener('click', () => {
        const dashboardSection = document.getElementById('dashboard');
        const isEditing = dashboardSection.classList.toggle('layout-editing');
        toggleBtn.innerHTML = isEditing
            ? '<i class="fas fa-check"></i>'
            : '<i class="fas fa-sliders-h"></i>';
        toggleBtn.setAttribute(
            'aria-label',
            isEditing ? 'Finish layout editing' : 'Modify layout'
        );
        setDashboardDragState(layoutContainer, isEditing);
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            localStorage.removeItem(DASHBOARD_LAYOUT_KEY);
            applyDashboardLayout(layoutContainer, cards, defaultOrder);
            const dashboardSection = document.getElementById('dashboard');
            dashboardSection.classList.remove('layout-editing');
            toggleBtn.innerHTML = '<i class="fas fa-sliders-h"></i>';
            toggleBtn.setAttribute('aria-label', 'Modify layout');
            setDashboardDragState(layoutContainer, false);
            if (globalMap) {
                setTimeout(() => globalMap.invalidateSize(), 50);
            }
            showToast('Dashboard layout reset to default.', 'success');
        });
    }

    setDashboardDragState(layoutContainer, false);
}

function setDashboardDragState(layoutContainer, enabled) {
    const cards = Array.from(layoutContainer.querySelectorAll('.dashboard-card[data-layout-id]'));
    cards.forEach(card => {
        card.draggable = enabled;
        card.removeEventListener('dragstart', handleDashboardDragStart);
        card.removeEventListener('dragover', handleDashboardDragOver);
        card.removeEventListener('dragend', handleDashboardDragEnd);
        card.removeEventListener('drop', handleDashboardDrop);

        if (enabled) {
            card.addEventListener('dragstart', handleDashboardDragStart);
            card.addEventListener('dragover', handleDashboardDragOver);
            card.addEventListener('dragend', handleDashboardDragEnd);
            card.addEventListener('drop', handleDashboardDrop);
        } else {
            card.classList.remove('dragging');
        }
    });
}

function getSavedDashboardLayout() {
    try {
        const raw = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function applyDashboardLayout(container, cards, order) {
    const cardMap = new Map(cards.map(card => [card.dataset.layoutId, card]));
    order.forEach(id => {
        const card = cardMap.get(id);
        if (card) container.appendChild(card);
    });
    cards.forEach(card => {
        if (!order.includes(card.dataset.layoutId)) {
            container.appendChild(card);
        }
    });
}

function handleDashboardDragStart(event) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', event.currentTarget.dataset.layoutId);
    event.currentTarget.classList.add('dragging');
}

function handleDashboardDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const target = event.currentTarget;
    const dragging = document.querySelector('#dashboardLayout .dashboard-card.dragging');
    if (!dragging || dragging === target) return;

    const rect = target.getBoundingClientRect();
    const isAfter = event.clientY > rect.top + rect.height / 2;
    const container = target.parentElement;
    if (isAfter) {
        container.insertBefore(dragging, target.nextSibling);
    } else {
        container.insertBefore(dragging, target);
    }
}

function handleDashboardDrop(event) {
    event.preventDefault();
    saveDashboardLayout();
}

function handleDashboardDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    saveDashboardLayout();
    if (globalMap) {
        setTimeout(() => {
            globalMap.invalidateSize();
        }, 50);
    }
}

function saveDashboardLayout() {
    const layoutContainer = document.getElementById('dashboardLayout');
    if (!layoutContainer) return;
    const order = Array.from(
        layoutContainer.querySelectorAll('.dashboard-card[data-layout-id]')
    ).map(card => card.dataset.layoutId);
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(order));
}

// Load dashboard data
function loadDashboardData() {
    const devices = getDevices();
    const alerts = getAlerts();
    const activeDevices = devices.filter(device => (device.status || '').toLowerCase() === 'active');
    
    // Update stats
    const totalDevicesEl = document.getElementById('totalDevices');
    if (totalDevicesEl) totalDevicesEl.textContent = activeDevices.length;
    const activeShipmentsEl = document.getElementById('activeShipments');
    if (activeShipmentsEl) activeShipmentsEl.textContent = activeDevices.length;
    const activeAlertsEl = document.getElementById('activeAlerts');
    if (activeAlertsEl) activeAlertsEl.textContent = alerts.filter(a => !a.read).length;
    const completedShipmentsEl = document.getElementById('completedShipments');
    if (completedShipmentsEl) {
        completedShipmentsEl.textContent = devices.filter(d => d.status === 'completed').length;
    }
    
    // Update activity list
    const activityList = document.getElementById('activityList');
    if (activityList) {
        const activities = getRecentActivities();
        if (activities.length === 0) {
            activityList.innerHTML = '<p class="empty-state">No activity yet</p>';
        } else {
            activityList.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon" style="background: ${activity.color};">
                        <i class="${activity.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <h4>${activity.title}</h4>
                        <p>${activity.description}</p>
                    </div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            `).join('');
        }
    }
    
    // Update devices table
    updateDevicesTable(devices);
    refreshHistoryDeviceOptions();
    
    // Update monitoring charts
    updateTemperatureChart();
    updateHumidityChart();
    updateBatteryChart();
    recordAnalyticsSample(devices, alerts);
    updateAnalyticsMetrics(devices, alerts);
    refreshAnalyticsCharts();
}

// Live Tracking
function initLiveTracking() {
    const refreshBtn = document.getElementById('refreshMapBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            updateMap();
        });
    }

    const mapSearchInput = document.getElementById('mapDeviceSearch');
    if (mapSearchInput) {
        mapSearchInput.addEventListener('input', () => {
            loadDevices();
        });
    }

    const mapStatusFilter = document.getElementById('mapDeviceStatusFilter');
    if (mapStatusFilter) {
        mapStatusFilter.addEventListener('change', () => {
            loadDevices();
        });
    }

    const mapSortSelect = document.getElementById('mapDeviceSort');
    if (mapSortSelect) {
        mapSortSelect.addEventListener('change', () => {
            loadDevices();
        });
    }
}

function initLiveLocationPolling() {
    fetchLiveLocations();
    if (liveLocationInterval) {
        clearInterval(liveLocationInterval);
    }
    liveLocationInterval = setInterval(fetchLiveLocations, LIVE_LOCATION_POLL_MS);
}

async function fetchLiveLocations() {
    try {
        const currentUser = safeGetCurrentUser();
        const hasSession = await ensureApiSessionToken(currentUser);
        if (!hasSession) {
            return;
        }
        const registryIds = Array.from(getDeviceRegistry());
        const knownIds = new Set(registryIds);
        const devices = getDevices();
        devices.forEach((device) => {
            if (device?.id) knownIds.add(device.id);
            if (device?.lte?.imei) knownIds.add(device.lte.imei);
        });
        const idsQuery = Array.from(knownIds).filter(Boolean).join(',');
        const endpoint = idsQuery ? `/api/locations?ids=${encodeURIComponent(idsQuery)}` : '/api/locations';
        const response = await fetch(endpoint, {
            cache: 'no-store',
            headers: getApiAuthHeaders()
        });
        if (response.status === 401) {
            const refreshed = await ensureApiSessionToken(currentUser, { forceRefresh: true });
            if (!refreshed) return;
            const retryResponse = await fetch(endpoint, {
                cache: 'no-store',
                headers: getApiAuthHeaders()
            });
            if (!retryResponse.ok) return;
            const retryData = await retryResponse.json();
            if (!retryData || !Array.isArray(retryData.devices)) return;
            mergeLiveLocations(retryData.devices);
            return;
        }
        if (!response.ok) return;
        const data = await response.json();
        if (!data || !Array.isArray(data.devices)) return;
        mergeLiveLocations(data.devices);
    } catch (error) {
        console.warn('Live location fetch failed:', error);
    }
}

function normalizeLivePayload(live) {
    const latitude = live.latitude ?? live.lat;
    const longitude = live.longitude ?? live.lng;
    return {
        deviceId: live.deviceId || live.id || live.imei,
        latitude: Number.isFinite(parseFloat(latitude)) ? parseFloat(latitude) : null,
        longitude: Number.isFinite(parseFloat(longitude)) ? parseFloat(longitude) : null,
        temperature: live.temperature ?? null,
        humidity: live.humidity ?? null,
        collision: live.collision ?? live.collisionG ?? live.impact ?? null,
        tilt: live.tilt ?? live.tiltAngle ?? null,
        battery: live.battery ?? null,
        rssi: live.rssi ?? null,
        accuracy: live.accuracy ?? null,
        satellites: live.satellites ?? null,
        timestamp: live.timestamp || live.updatedAt || new Date().toISOString()
    };
}

function updateDeviceSensorValue(device, type, value) {
    if (!device || value === null || value === undefined) return;
    if (!Array.isArray(device.sensors)) {
        device.sensors = [];
    }
    const sensor = device.sensors.find((item) => item.type === type);
    if (sensor) {
        sensor.value = value;
    } else {
        device.sensors.push({
            type,
            name: type === 'temperature' ? 'Temperature Sensor' : 'Humidity Sensor',
            unit: type === 'temperature' ? '°C' : '%',
            description: type === 'temperature' ? 'Ambient temperature monitoring' : 'Relative humidity monitoring',
            value
        });
    }
}

function mergeLiveLocations(liveDevices) {
    if (!Array.isArray(liveDevices) || liveDevices.length === 0) return;

    const devices = getDevices();
    const currentUser = safeGetCurrentUser();
    const deviceIndex = new Map(devices.map(device => [device.id, device]));
    const imeiIndex = new Map(
        devices
            .filter(device => device.lte && device.lte.imei)
            .map(device => [device.lte.imei, device])
    );
    let hasUpdates = false;

    liveDevices.forEach(live => {
        const normalized = normalizeLivePayload(live);
        if (!normalized.deviceId) return;

        let device = deviceIndex.get(normalized.deviceId) || imeiIndex.get(normalized.deviceId);
        if (!device) {
            device = {
                id: normalized.deviceId,
                name: normalized.deviceId,
                type: 'Tracker',
                status: 'active',
                location: 'Live',
                networks: ['4G LTE', 'GPS/GNSS'],
                sensors: [],
                lastUpdate: null,
                ownerId: currentUser ? currentUser.id : null,
                lte: {
                    imei: normalized.deviceId
                },
                createdAt: new Date().toISOString()
            };
            devices.push(device);
            deviceIndex.set(normalized.deviceId, device);
            registerDeviceIds([normalized.deviceId]);
        }
        if (!device.lte) {
            device.lte = { imei: normalized.deviceId };
        } else if (!device.lte.imei) {
            device.lte.imei = normalized.deviceId;
        }

        if (hasValidCoordinates(normalized.latitude, normalized.longitude)) {
            device.latitude = normalized.latitude;
            device.longitude = normalized.longitude;
        }
        if (normalized.temperature !== null && normalized.temperature !== undefined) {
            device.temperature = normalized.temperature;
            updateDeviceSensorValue(device, 'temperature', normalized.temperature);
        }
        if (normalized.humidity !== null && normalized.humidity !== undefined) {
            device.humidity = normalized.humidity;
            updateDeviceSensorValue(device, 'humidity', normalized.humidity);
        }
        if (normalized.collision !== null && normalized.collision !== undefined) {
            device.collision = normalized.collision;
        }
        if (normalized.tilt !== null && normalized.tilt !== undefined) {
            device.tilt = normalized.tilt;
        }
        if (normalized.battery !== null && normalized.battery !== undefined) {
            device.battery = normalized.battery;
        }
        if (normalized.rssi !== null && normalized.rssi !== undefined) {
            device.signalStrength = normalized.rssi + ' dBm';
        }
        if (normalized.accuracy !== null && normalized.accuracy !== undefined) {
            device.accuracy = normalized.accuracy;
        }
        if (normalized.satellites !== null && normalized.satellites !== undefined) {
            device.satellites = normalized.satellites;
        }

        device.lastUpdate = normalized.timestamp;
        device.status = 'active';

        if (currentUser && !device.ownerId) {
            device.ownerId = currentUser.id;
        }

        if (!device.tracker) {
            device.tracker = {};
        }
        device.tracker.lastFix = normalized.timestamp;
        if (normalized.accuracy !== null && normalized.accuracy !== undefined) {
            device.tracker.accuracy = normalized.accuracy;
        }
        if (normalized.satellites !== null && normalized.satellites !== undefined) {
            device.tracker.satellites = normalized.satellites;
        }
        if (normalized.collision !== null && normalized.collision !== undefined) {
            device.tracker.collision = normalized.collision;
        }
        if (normalized.tilt !== null && normalized.tilt !== undefined) {
            device.tracker.tilt = normalized.tilt;
        }

        updateAreaAlerts(device);
        evaluateDeviceLogisticsConditions(device);
        hasUpdates = true;
    });

    if (hasUpdates) {
        localStorage.setItem('cargotrack_devices', JSON.stringify(devices));
        if (map) {
            updateMap();
        }
        if (globalMap) {
            updateGlobalMap();
        }
        loadDevices();
        loadDashboardData();
    }
}

function createMapBaseLayers() {
    return {
        'Basic': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO'
        }),
        'Streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }),
        'Topography': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors © OpenTopoMap'
        })
    };
}

function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || map) return;
    
    map = L.map('map').setView([40.7128, -74.0060], 2);
    const baseLayers = createMapBaseLayers();
    baseLayers.Basic.addTo(map);
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);
    mapAreasLayerGroup = L.layerGroup().addTo(map);
    
    updateMap();
}

// Global Map for Dashboard
function initGlobalMap() {
    const globalMapElement = document.getElementById('globalMap');
    if (!globalMapElement) return;
    
    // Initialize global map
    globalMap = L.map('globalMap').setView([20, 0], 2);
    const baseLayers = createMapBaseLayers();
    baseLayers.Basic.addTo(globalMap);
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(globalMap);
    globalAreasLayerGroup = L.layerGroup().addTo(globalMap);
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshGlobalMapBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            updateGlobalMap();
            showToast('Live map refreshed.', 'success');
        });
    }
    
    // Auto-refresh toggle
    const autoRefreshBtn = document.getElementById('toggleMapAutoRefresh');
    if (autoRefreshBtn) {
        autoRefreshBtn.addEventListener('click', function() {
            toggleMapAutoRefresh();
        });
    }
    
    // Initial map update
    updateGlobalMap();
    initHistoryControls();
}

function toggleMapAutoRefresh() {
    mapAutoRefreshEnabled = !mapAutoRefreshEnabled;
    const btn = document.getElementById('toggleMapAutoRefresh');
    
    if (mapAutoRefreshEnabled) {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            btn.classList.add('active');
        }
        mapAutoRefreshInterval = setInterval(() => {
            updateGlobalMap();
        }, 10000); // Update every 10 seconds
    } else {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-play"></i> Auto Refresh';
            btn.classList.remove('active');
        }
        if (mapAutoRefreshInterval) {
            clearInterval(mapAutoRefreshInterval);
            mapAutoRefreshInterval = null;
        }
    }
}

function updateGlobalMap() {
    if (!globalMap) return;
    
    // Clear existing markers
    if (globalDeviceMarkers && globalDeviceMarkers.length > 0) {
        globalDeviceMarkers.forEach(marker => {
            if (marker && globalMap.hasLayer(marker)) {
                globalMap.removeLayer(marker);
            }
        });
    }
    globalDeviceMarkers = [];
    renderAreasInLayerGroup(globalAreasLayerGroup);
    
    const getDevicesFn = window.getDevices || (typeof getDevices !== 'undefined' ? getDevices : null);
    if (!getDevicesFn) return;
    
    const devices = getDevicesFn();
    let deviceCount = 0;
    
    devices.forEach(device => {
        if (hasValidCoordinates(device.latitude, device.longitude)) {
            deviceCount++;
            
            // Determine marker color based on status
            let markerColor = '#10b981'; // Green for active
            if (device.status === 'inactive' || device.status === 'offline') {
                markerColor = '#ef4444'; // Red for inactive
            } else if (device.status === 'warning' || device.temperature > 25) {
                markerColor = '#f59e0b'; // Orange for warning
            }
            
            // Create custom icon
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="width: 20px; height: 20px; background: ${markerColor}; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            // Build sensor info HTML
            let sensorInfo = '';
            if (device.temperature !== undefined) {
                sensorInfo += `<strong>Temperature:</strong> ${device.temperature}°C<br>`;
            }
            if (device.humidity !== undefined) {
                sensorInfo += `<strong>Humidity:</strong> ${device.humidity}%<br>`;
            }
            if (device.battery !== undefined) {
                sensorInfo += `<strong>Battery:</strong> ${device.battery}%<br>`;
            }
            if (device.sensors && device.sensors.length > 0) {
                sensorInfo += `<strong>Sensors:</strong> ${device.sensors.length} active<br>`;
            }
            
            const marker = L.marker([device.latitude, device.longitude], { icon: customIcon })
                .addTo(globalMap)
                .bindPopup(`
                    <div style="min-width: 200px;">
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">${device.name || 'Device ' + device.id}</h3>
                        <div style="margin-bottom: 0.5rem;">
                            <span class="status-badge ${device.status}">${device.status || 'unknown'}</span>
                        </div>
                        ${sensorInfo}
                        <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #666;">
                            <strong>Last Update:</strong> ${device.lastUpdate ? formatTime(device.lastUpdate) : 'Never'}<br>
                            ${device.location ? `<strong>Location:</strong> ${device.location}<br>` : ''}
                        </div>
                    </div>
                `);
            
            globalDeviceMarkers.push(marker);
        }
    });
    
    // Update device count
    const deviceCountEl = document.getElementById('mapDeviceCount');
    if (deviceCountEl) {
        deviceCountEl.textContent = deviceCount;
    }
    
    // Fit map to show device markers and area overlays
    const globalAreaLayers = globalAreasLayerGroup ? globalAreasLayerGroup.getLayers() : [];
    const globalFitLayers = [...globalDeviceMarkers, ...globalAreaLayers];
    if (globalFitLayers.length > 0) {
        const group = L.featureGroup(globalFitLayers);
        globalMap.fitBounds(group.getBounds().pad(0.1));
    } else {
        // Default view if no devices
        globalMap.setView([20, 0], 2);
    }
}

function initHistoryControls() {
    const deviceSelect = document.getElementById('historyDeviceSelect');
    const rangeSelect = document.getElementById('historyRangeSelect');
    const startInput = document.getElementById('historyStart');
    const endInput = document.getElementById('historyEnd');
    const applyBtn = document.getElementById('historyApplyBtn');
    const clearBtn = document.getElementById('historyClearBtn');
    if (!deviceSelect || !rangeSelect || !startInput || !endInput || !applyBtn || !clearBtn) {
        return;
    }

    refreshHistoryDeviceOptions();
    syncHistoryRangeInputs();

    rangeSelect.addEventListener('change', () => {
        syncHistoryRangeInputs();
    });

    applyBtn.addEventListener('click', () => {
        applyHistoryRoute();
    });

    clearBtn.addEventListener('click', () => {
        clearHistoryRoute();
        setHistoryStatus('Route cleared.', 'success');
    });
}

function refreshHistoryDeviceOptions() {
    const deviceSelect = document.getElementById('historyDeviceSelect');
    if (!deviceSelect) return;
    const devices = getDevices();
    const current = deviceSelect.value;
    const options = devices.map(device => `
        <option value="${device.id}">${device.name || device.id}</option>
    `).join('');
    deviceSelect.innerHTML = options || '<option value="">No devices</option>';
    if (current && devices.some(device => device.id === current)) {
        deviceSelect.value = current;
    }
}

function syncHistoryRangeInputs() {
    const rangeSelect = document.getElementById('historyRangeSelect');
    const startInput = document.getElementById('historyStart');
    const endInput = document.getElementById('historyEnd');
    const customStart = document.getElementById('historyCustomStart');
    const customEnd = document.getElementById('historyCustomEnd');
    if (!rangeSelect || !startInput || !endInput || !customStart || !customEnd) {
        return;
    }

    const range = rangeSelect.value;
    const now = new Date();
    let from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (range === '7d') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '30d') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === '90d') {
        from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    const isCustom = range === 'custom';
    customStart.classList.toggle('is-visible', isCustom);
    customEnd.classList.toggle('is-visible', isCustom);

    if (!isCustom) {
        startInput.value = toLocalDatetimeValue(from);
        endInput.value = toLocalDatetimeValue(now);
    } else {
        if (!startInput.value) startInput.value = toLocalDatetimeValue(from);
        if (!endInput.value) endInput.value = toLocalDatetimeValue(now);
    }
}

function toLocalDatetimeValue(date) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setHistoryStatus(message, tone) {
    const statusEl = document.getElementById('historyStatus');
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.classList.remove('error', 'success');
    }
    if (message) {
        const toastTone = tone === 'error'
            ? 'error'
            : tone === 'success'
                ? 'success'
                : tone === 'warning'
                    ? 'warning'
                    : 'info';
        showToast(message, toastTone);
    }
}

function applyHistoryRoute() {
    const deviceSelect = document.getElementById('historyDeviceSelect');
    const rangeSelect = document.getElementById('historyRangeSelect');
    const startInput = document.getElementById('historyStart');
    const endInput = document.getElementById('historyEnd');
    if (!deviceSelect || !rangeSelect || !startInput || !endInput) return;

    const deviceId = deviceSelect.value;
    if (!deviceId) {
        setHistoryStatus('Select a device to view history.', 'error');
        return;
    }

    let from = new Date(startInput.value);
    let to = new Date(endInput.value);
    if (rangeSelect.value !== 'custom') {
        const now = new Date();
        to = now;
        if (rangeSelect.value === '7d') {
            from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (rangeSelect.value === '30d') {
            from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (rangeSelect.value === '90d') {
            from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        } else {
            from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
    }

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
        setHistoryStatus('Select a valid time range.', 'error');
        return;
    }

    fetchHistoryRoute(deviceId, from, to);
}

async function fetchHistoryRoute(deviceId, from, to) {
    if (!globalMap) return;
    const requestId = ++historyRequestId;
    setHistoryStatus('Loading route...', '');
    try {
        const params = new URLSearchParams({
            deviceId,
            from: from.toISOString(),
            to: to.toISOString(),
            limit: '5000'
        });
        const response = await fetch(`/api/history?${params.toString()}`, {
            cache: 'no-store',
            headers: getApiAuthHeaders()
        });
        if (!response.ok) {
            setHistoryStatus('Failed to load history.', 'error');
            return;
        }
        const data = await response.json();
        if (requestId !== historyRequestId) return;
        const points = Array.isArray(data.points) ? data.points : [];
        if (points.length === 0) {
            clearHistoryRoute();
            setHistoryStatus('No history points in this range.', 'error');
            return;
        }
        drawHistoryRoute(points);
        setHistoryStatus(`Showing ${points.length} points.`, 'success');
    } catch (error) {
        console.warn('History fetch failed:', error);
        setHistoryStatus('Failed to load history.', 'error');
    }
}

function drawHistoryRoute(points) {
    if (!globalMap || !Array.isArray(points)) return;
    clearHistoryRoute();
    const latLngs = points
        .map(point => [point.latitude, point.longitude])
        .filter(coords => hasValidCoordinates(coords[0], coords[1]));
    if (latLngs.length === 0) {
        setHistoryStatus('No valid coordinates in history.', 'error');
        return;
    }

    historyRouteLayer = L.polyline(latLngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.9
    }).addTo(globalMap);

    const startMarker = L.circleMarker(latLngs[0], {
        radius: 6,
        color: '#16a34a',
        fillColor: '#16a34a',
        fillOpacity: 0.9
    }).addTo(globalMap);
    const endMarker = L.circleMarker(latLngs[latLngs.length - 1], {
        radius: 6,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.9
    }).addTo(globalMap);
    historyRouteMarkers = [startMarker, endMarker];

    globalMap.fitBounds(historyRouteLayer.getBounds().pad(0.2));
}

function clearHistoryRoute() {
    if (historyRouteLayer && globalMap) {
        globalMap.removeLayer(historyRouteLayer);
    }
    historyRouteLayer = null;
    if (historyRouteMarkers.length && globalMap) {
        historyRouteMarkers.forEach(marker => {
            if (marker && globalMap.hasLayer(marker)) {
                globalMap.removeLayer(marker);
            }
        });
    }
    historyRouteMarkers = [];
}

function updateMap() {
    if (!map) return;
    
    // Clear existing markers
    deviceMarkers.forEach(marker => map.removeLayer(marker));
    deviceMarkers = [];
    renderAreasInLayerGroup(mapAreasLayerGroup);
    
    const getDevicesFn = window.getDevices || (typeof getDevices !== 'undefined' ? getDevices : null);
    if (!getDevicesFn) return;
    
    const devices = getDevicesFn();
    
    devices.forEach(device => {
        if (hasValidCoordinates(device.latitude, device.longitude)) {
            const marker = L.marker([device.latitude, device.longitude])
                .addTo(map)
                .bindPopup(`
                    <strong>${device.name}</strong><br>
                    Status: ${device.status}<br>
                    Temperature: ${device.temperature !== null && device.temperature !== undefined ? device.temperature + '°C' : 'N/A'}<br>
                    Last Update: ${formatTime(device.lastUpdate)}
                `);
            
            deviceMarkers.push(marker);
        }
    });
    
    // Fit map to show markers and area overlays
    const liveAreaLayers = mapAreasLayerGroup ? mapAreasLayerGroup.getLayers() : [];
    const liveFitLayers = [...deviceMarkers, ...liveAreaLayers];
    if (liveFitLayers.length > 0) {
        const group = L.featureGroup(liveFitLayers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Devices Management
let selectedDeviceId = null;
let editingDeviceId = null;

function initDevicesManagement() {
    const addDeviceBtn = document.getElementById('addDeviceBtn');
    if (addDeviceBtn) {
        addDeviceBtn.addEventListener('click', function() {
            showDeviceForm();
        });
    }

    initDeviceModelSelect();
    refreshDeviceGroupOptions();
    
    // Modal close handlers
    document.getElementById('closeModal').addEventListener('click', function() {
        closeDeviceModal();
    });
    
    document.getElementById('closeDeviceFormModal').addEventListener('click', function() {
        closeDeviceFormModal();
    });
    
    // Close modals on outside click
    document.getElementById('deviceModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeDeviceModal();
        }
    });
    
    document.getElementById('deviceFormModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeDeviceFormModal();
        }
    });
    
    // Device form submission
    document.getElementById('deviceForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveDeviceFromForm();
    });
}

function initDeviceModelSelect() {
    const modelInput = document.getElementById('deviceModel');
    const modelOptions = document.getElementById('deviceModelOptions');
    if (!modelInput || !modelOptions) return;

    modelOptions.innerHTML = DEVICE_MODEL_PRESETS.map(preset => `
        <option value="${preset.label}"></option>
    `).join('');

    modelInput.addEventListener('change', () => {
        const preset = DEVICE_MODEL_PRESETS.find(item => item.label === modelInput.value);
        applyDeviceModelPreset(preset ? preset.id : '');
    });
}

// Configuration (Groups / Users)
function initConfigurationManagement() {
    const areaForm = document.getElementById('areaForm');
    const assetForm = document.getElementById('assetForm');
    const groupForm = document.getElementById('groupForm');
    const userForm = document.getElementById('userForm');
    const addAreaBtn = document.getElementById('addAreaBtn');
    const addAssetBtn = document.getElementById('addAssetBtn');
    const addGroupBtn = document.getElementById('addGroupBtn');
    const addUserBtn = document.getElementById('addUserBtn');

    if (addAreaBtn) {
        addAreaBtn.addEventListener('click', () => {
            const input = document.getElementById('areaName');
            if (input) {
                input.focus();
            }
        });
    }

    if (addAssetBtn) {
        addAssetBtn.addEventListener('click', () => {
            const input = document.getElementById('assetName');
            if (input) {
                input.focus();
            }
        });
    }

    if (addGroupBtn) {
        addGroupBtn.addEventListener('click', () => {
            const input = document.getElementById('groupName');
            if (input) {
                input.focus();
            }
        });
    }

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            const input = document.getElementById('userNameInput');
            if (input) {
                input.focus();
            }
        });
    }

    if (areaForm) {
        areaForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveAreaFromForm();
        });
    }
    const areaRadiusInput = document.getElementById('areaRadius');
    if (areaRadiusInput) {
        areaRadiusInput.addEventListener('input', () => {
            if (areaDraftMarker) {
                updateAreaDraftCircle(areaDraftMarker.getLatLng());
            }
        });
    }
    const areaShapeSelect = document.getElementById('areaShape');
    if (areaShapeSelect) {
        areaShapeSelect.addEventListener('change', () => {
            syncAreaShapeControls();
            clearAreaDraft();
        });
    }
    const polygonStartBtn = document.getElementById('polygonStartBtn');
    if (polygonStartBtn) {
        polygonStartBtn.addEventListener('click', () => {
            areaDraftPolygonPoints = [];
            areaDraftPolygonClosed = false;
            renderPolygonDraft();
            updateAreaCenterDisplay();
        });
    }
    const polygonFinishBtn = document.getElementById('polygonFinishBtn');
    if (polygonFinishBtn) {
        polygonFinishBtn.addEventListener('click', () => {
            if (areaDraftPolygonPoints.length < 3) {
                alert('Add at least 3 points to finish the polygon.');
                return;
            }
            areaDraftPolygonClosed = true;
            renderPolygonDraft();
            updateAreaCenterDisplay();
        });
    }
    const polygonUndoBtn = document.getElementById('polygonUndoBtn');
    if (polygonUndoBtn) {
        polygonUndoBtn.addEventListener('click', () => {
            if (!areaDraftPolygonPoints.length) return;
            areaDraftPolygonPoints.pop();
            areaDraftPolygonClosed = false;
            renderPolygonDraft();
            updateAreaCenterDisplay();
        });
    }
    const polygonClearBtn = document.getElementById('polygonClearBtn');
    if (polygonClearBtn) {
        polygonClearBtn.addEventListener('click', () => {
            clearAreaDraft();
        });
    }

    if (assetForm) {
        assetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveAssetFromForm();
        });
    }
    const assetCategoryFilter = document.getElementById('assetCategoryFilter');
    if (assetCategoryFilter) {
        assetCategoryFilter.addEventListener('change', () => {
            localStorage.setItem(ASSET_CATEGORY_FILTER_KEY, assetCategoryFilter.value);
            loadAssets();
        });
    }

    if (groupForm) {
        groupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveGroupFromForm();
        });
    }

    if (userForm) {
        userForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveUserFromForm();
        });
    }

    initAreasMap();
    syncAreaShapeControls();
    loadAreas();
    loadAssets();
    loadGroups();
    loadUsers();
}

function initAreasMap() {
    const mapElement = document.getElementById('areasMap');
    if (!mapElement || areasMap) return;

    areasMap = L.map('areasMap').setView([20, 0], 2);
    const baseLayers = createMapBaseLayers();
    baseLayers.Basic.addTo(areasMap);
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(areasMap);
    areasLayerGroup = L.layerGroup().addTo(areasMap);

    areasMap.on('click', event => {
        const shape = getAreaShape();
        if (shape === 'polygon') {
            areaDraftPolygonPoints.push([event.latlng.lat, event.latlng.lng]);
            areaDraftPolygonClosed = false;
            renderPolygonDraft();
            updateAreaCenterDisplay();
            return;
        }
        setAreaDraftCenter(event.latlng);
    });
}

function setAreaDraftCenter(latlng) {
    if (!areasMap) return;
    if (areaDraftMarker) {
        areaDraftMarker.setLatLng(latlng);
    } else {
        areaDraftMarker = L.marker(latlng).addTo(areasMap);
    }
    updateAreaDraftCircle(latlng);
    updateAreaCenterDisplay();
}

function updateAreaDraftCircle(latlng) {
    if (getAreaShape() !== 'circle') return;
    const radiusInput = document.getElementById('areaRadius');
    const radiusMeters = radiusInput ? Number(radiusInput.value) : 0;
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return;
    if (areaDraftCircle) {
        areaDraftCircle.setLatLng(latlng);
        areaDraftCircle.setRadius(radiusMeters);
    } else {
        areaDraftCircle = L.circle(latlng, {
            radius: radiusMeters,
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.2
        }).addTo(areasMap);
    }
}

function renderPolygonDraft() {
    if (!areasMap) return;
    if (areaDraftPolyline) {
        areaDraftPolyline.remove();
        areaDraftPolyline = null;
    }
    if (areaDraftPolygon) {
        areaDraftPolygon.remove();
        areaDraftPolygon = null;
    }
    areaDraftPolygonMarkers.forEach(marker => marker.remove());
    areaDraftPolygonMarkers = [];
    if (areaDraftPolygonPoints.length === 0) return;
    areaDraftPolygonPoints.forEach((point, index) => {
        const marker = L.marker(point, { draggable: true }).addTo(areasMap);
        marker.on('drag', event => {
            const latlng = event.target.getLatLng();
            areaDraftPolygonPoints[index] = [latlng.lat, latlng.lng];
            renderPolygonDraft();
            updateAreaCenterDisplay();
        });
        marker.on('click', () => {
            if (index === 0 && areaDraftPolygonPoints.length >= 3) {
                areaDraftPolygonClosed = true;
                renderPolygonDraft();
                updateAreaCenterDisplay();
            }
        });
        areaDraftPolygonMarkers.push(marker);
    });
    if (areaDraftPolygonClosed) {
        areaDraftPolygon = L.polygon(areaDraftPolygonPoints, {
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.2
        }).addTo(areasMap);
    } else {
        areaDraftPolyline = L.polyline(areaDraftPolygonPoints, {
            color: '#2563eb'
        }).addTo(areasMap);
    }
}

function updateAreaCenterDisplay() {
    const display = document.getElementById('areaCenterDisplay');
    if (!display) return;
    const shape = getAreaShape();
    if (shape === 'polygon') {
        if (areaDraftPolygonPoints.length === 0) {
            display.value = '';
            return;
        }
        const centroid = getPolygonCentroid(areaDraftPolygonPoints);
        display.value = `${centroid.lat.toFixed(5)}, ${centroid.lng.toFixed(5)}`;
        return;
    }
    if (areaDraftMarker) {
        const center = areaDraftMarker.getLatLng();
        display.value = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
    } else {
        display.value = '';
    }
}

function getPolygonCentroid(points) {
    if (!points.length) return { lat: 0, lng: 0 };
    const sum = points.reduce(
        (acc, point) => ({ lat: acc.lat + point[0], lng: acc.lng + point[1] }),
        { lat: 0, lng: 0 }
    );
    return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

function getAreaShape() {
    const select = document.getElementById('areaShape');
    return select ? select.value : 'circle';
}

function syncAreaShapeControls() {
    const shape = getAreaShape();
    const radiusGroup = document.getElementById('areaRadiusGroup');
    const radiusInput = document.getElementById('areaRadius');
    const polygonControls = document.getElementById('areaPolygonControls');
    if (radiusGroup) {
        radiusGroup.style.display = shape === 'circle' ? 'block' : 'none';
    }
    if (radiusInput) {
        radiusInput.required = shape === 'circle';
    }
    if (polygonControls) {
        polygonControls.style.display = shape === 'polygon' ? 'block' : 'none';
    }
}

function clearAreaDraft() {
    if (areaDraftMarker) {
        areaDraftMarker.remove();
        areaDraftMarker = null;
    }
    if (areaDraftCircle) {
        areaDraftCircle.remove();
        areaDraftCircle = null;
    }
    if (areaDraftPolyline) {
        areaDraftPolyline.remove();
        areaDraftPolyline = null;
    }
    if (areaDraftPolygon) {
        areaDraftPolygon.remove();
        areaDraftPolygon = null;
    }
    areaDraftPolygonMarkers.forEach(marker => marker.remove());
    areaDraftPolygonMarkers = [];
    areaDraftPolygonPoints = [];
    areaDraftPolygonClosed = false;
    const display = document.getElementById('areaCenterDisplay');
    if (display) display.value = '';
}

function getAreas() {
    const stored = localStorage.getItem(AREAS_STORAGE_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to parse areas:', error);
        return [];
    }
}

function saveAreas(areas) {
    localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(areas));
}

function getAssets() {
    const stored = localStorage.getItem(ASSETS_STORAGE_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to parse assets:', error);
        return [];
    }
}

function saveAssets(assets) {
    localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
}

function refreshDeviceAssetOptions(assets = null) {
    const deviceAssetList = document.getElementById('deviceAssetList');
    if (!deviceAssetList) return;
    const assetList = Array.isArray(assets) ? assets : getAssets();
    const names = Array.from(
        new Set(
            assetList
                .map(asset => (asset?.name || '').toString().trim())
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));
    deviceAssetList.innerHTML = names
        .map(name => `<option value="${name}"></option>`)
        .join('');
}

function ensureAssetExists(assetName, category = '') {
    const normalizedName = (assetName || '').toString().trim();
    if (!normalizedName) return false;

    const assets = getAssets();
    const alreadyExists = assets.some(asset => (
        (asset.name || '').toString().trim().toLowerCase() === normalizedName.toLowerCase()
    ));
    if (alreadyExists) {
        return false;
    }

    assets.push({
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: normalizedName,
        category: (category || '').toString().trim(),
        createdAt: new Date().toISOString()
    });
    saveAssets(assets);
    return true;
}

function saveAreaFromForm() {
    const nameInput = document.getElementById('areaName');
    const typeSelect = document.getElementById('areaType');
    const radiusInput = document.getElementById('areaRadius');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    const type = typeSelect ? typeSelect.value : 'Custom';
    const radiusMeters = radiusInput ? Number(radiusInput.value) : 0;
    const shape = getAreaShape();
    if (!name) {
        alert('Please enter an area name.');
        nameInput.focus();
        return;
    }
    if (shape === 'circle' && !areaDraftMarker) {
        alert('Please click on the map to set the area center.');
        return;
    }
    if (shape === 'circle' && (!Number.isFinite(radiusMeters) || radiusMeters <= 0)) {
        alert('Please enter a valid radius in meters.');
        if (radiusInput) radiusInput.focus();
        return;
    }
    if (shape === 'polygon') {
        if (areaDraftPolygonPoints.length < 3) {
            alert('Please add at least 3 polygon points.');
            return;
        }
        if (!areaDraftPolygonClosed) {
            alert('Click Finish to close the polygon before saving.');
            return;
        }
    }

    const areas = getAreas();
    const exists = areas.some(area => area.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert('An area with this name already exists.');
        nameInput.focus();
        return;
    }

    const center = shape === 'circle'
        ? { lat: areaDraftMarker.getLatLng().lat, lng: areaDraftMarker.getLatLng().lng }
        : getPolygonCentroid(areaDraftPolygonPoints);
    areas.push({
        id: `area-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        type,
        shape,
        center,
        radiusMeters: shape === 'circle' ? radiusMeters : null,
        polygon: shape === 'polygon' ? areaDraftPolygonPoints : null,
        createdAt: new Date().toISOString()
    });

    saveAreas(areas);
    nameInput.value = '';
    if (typeSelect) typeSelect.value = 'Warehouse';
    if (radiusInput) radiusInput.value = '';
    clearAreaDraft();
    loadAreas();
}

function saveAssetFromForm() {
    const nameInput = document.getElementById('assetName');
    const categoryInput = document.getElementById('assetCategory');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    const category = categoryInput ? categoryInput.value.trim() : '';
    if (!name) {
        alert('Please enter an asset name.');
        nameInput.focus();
        return;
    }

    const assets = getAssets();
    const exists = assets.some(asset => asset.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert('An asset with this name already exists.');
        nameInput.focus();
        return;
    }

    assets.push({
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        category,
        createdAt: new Date().toISOString()
    });

    saveAssets(assets);
    nameInput.value = '';
    if (categoryInput) categoryInput.value = '';
    loadAssets();
}

function loadAreas() {
    const tableBody = document.getElementById('areasTableBody');
    if (!tableBody) return;

    const areas = getAreas();
    if (areas.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">No areas configured yet.</td>
            </tr>
        `;
        renderAreasOnMap([]);
        renderAreasInLayerGroup(mapAreasLayerGroup, []);
        renderAreasInLayerGroup(globalAreasLayerGroup, []);
        populateDeviceAreaOptions();
        return;
    }

    tableBody.innerHTML = areas.map(area => `
        <tr>
            <td>${area.name}</td>
            <td>${area.type || 'Custom'}</td>
            <td>${area.shape === 'polygon' ? 'Polygon' : 'Circle'}</td>
            <td>${area.shape === 'polygon'
                ? `${area.polygon ? area.polygon.length : 0} pts`
                : (area.radiusMeters ? `${Math.round(area.radiusMeters)} m` : '—')}</td>
            <td>${area.center ? `${area.center.lat.toFixed(4)}, ${area.center.lng.toFixed(4)}` : '—'}</td>
            <td>${formatDate(area.createdAt)}</td>
            <td>
                <button class="btn btn-outline btn-small" onclick="focusAreaOnMap('${area.id}')" title="View on map">
                    <i class="fas fa-map-marked-alt"></i>
                </button>
                <button class="btn btn-outline btn-small" onclick="deleteArea('${area.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    renderAreasOnMap(areas);
    renderAreasInLayerGroup(mapAreasLayerGroup, areas);
    renderAreasInLayerGroup(globalAreasLayerGroup, areas);
    populateDeviceAreaOptions();
}

function renderAreasInLayerGroup(layerGroup, areas = null) {
    if (!layerGroup) return;
    const areaList = Array.isArray(areas) ? areas : getAreas();
    layerGroup.clearLayers();
    areaList.forEach(area => {
        if (area.shape === 'polygon' && Array.isArray(area.polygon) && area.polygon.length >= 3) {
            L.polygon(area.polygon, {
                color: '#16a34a',
                fillColor: '#22c55e',
                fillOpacity: 0.15
            }).addTo(layerGroup).bindPopup(`${area.name} (Polygon)`);
            return;
        }
        if (!area.center || !area.radiusMeters) return;
        L.circle(area.center, {
            radius: area.radiusMeters,
            color: '#16a34a',
            fillColor: '#22c55e',
            fillOpacity: 0.15
        }).addTo(layerGroup).bindPopup(`${area.name} (${Math.round(area.radiusMeters)} m)`);
    });
}

function renderAreasOnMap(areas) {
    if (!areasMap || !areasLayerGroup) return;
    renderAreasInLayerGroup(areasLayerGroup, areas);
}

function focusAreaOnMap(areaId) {
    const areas = getAreas();
    const area = areas.find(item => item.id === areaId);
    if (!area) return;
    if (!areasMap) {
        initAreasMap();
    }
    if (!areasMap) return;

    areasMap.invalidateSize();
    if (area.shape === 'polygon' && Array.isArray(area.polygon) && area.polygon.length >= 3) {
        const bounds = L.polygon(area.polygon).getBounds();
        areasMap.fitBounds(bounds, { padding: [20, 20] });
        return;
    }
    if (!area.center || !area.radiusMeters) return;
    const bounds = L.circle(area.center, { radius: area.radiusMeters }).getBounds();
    areasMap.fitBounds(bounds, { padding: [20, 20] });
}

function getAreaById(areaId) {
    const normalizedId = (areaId || '').toString().trim();
    if (!normalizedId) return null;
    const areas = getAreas();
    return areas.find(area => area.id === normalizedId) || null;
}

function getContainingAreaForCoordinates(latitude, longitude, areas = null) {
    if (!hasValidCoordinates(latitude, longitude)) return null;
    const areaList = Array.isArray(areas) ? areas : getAreas();
    for (const area of areaList) {
        let inside = false;
        if (area.shape === 'polygon' && Array.isArray(area.polygon) && area.polygon.length >= 3) {
            inside = isPointInPolygon({ lat: latitude, lng: longitude }, area.polygon);
        } else if (area.center && area.radiusMeters) {
            const distance = getDistanceMeters(
                { lat: latitude, lng: longitude },
                area.center
            );
            inside = distance <= area.radiusMeters;
        }
        if (inside) {
            return area;
        }
    }
    return null;
}

function populateDeviceAreaOptions({ startAreaId = '', destinationAreaId = '', device = null } = {}) {
    const startSelect = document.getElementById('logisticsStartAreaId');
    const destinationSelect = document.getElementById('logisticsDestinationAreaId');
    const currentAreaInput = document.getElementById('logisticsCurrentArea');
    if (!startSelect && !destinationSelect && !currentAreaInput) return;

    const areas = getAreas();
    const options = areas
        .map(area => `<option value="${area.id}">${area.name}</option>`)
        .join('');

    if (startSelect) {
        startSelect.innerHTML = `<option value="">Select start area</option>${options}`;
        startSelect.value = areas.some(area => area.id === startAreaId) ? startAreaId : '';
    }

    if (destinationSelect) {
        destinationSelect.innerHTML = `<option value="">Select destination area</option>${options}`;
        destinationSelect.value = areas.some(area => area.id === destinationAreaId) ? destinationAreaId : '';
    }

    if (currentAreaInput) {
        const currentArea = device
            ? getContainingAreaForCoordinates(device.latitude, device.longitude, areas)
            : null;
        currentAreaInput.value = currentArea ? currentArea.name : 'Outside saved areas';
    }
}

function loadAssets() {
    const tableBody = document.getElementById('assetsTableBody');
    const assets = getAssets();
    refreshDeviceAssetOptions(assets);
    if (!tableBody) return;
    const categoryFilter = document.getElementById('assetCategoryFilter');
    const categoryDatalist = document.getElementById('assetCategoryList');
    const categories = Array.from(
        new Set(
            assets
                .map(asset => (asset.category || '').trim())
                .filter(category => category.length)
        )
    ).sort((a, b) => a.localeCompare(b));

    if (categoryFilter) {
        const savedFilter = localStorage.getItem(ASSET_CATEGORY_FILTER_KEY) || 'all';
        categoryFilter.innerHTML = [
            '<option value="all">All categories</option>',
            ...categories.map(category => `<option value="${category}">${category}</option>`)
        ].join('');
        categoryFilter.value = categories.includes(savedFilter) ? savedFilter : 'all';
    }

    if (categoryDatalist) {
        categoryDatalist.innerHTML = categories
            .map(category => `<option value="${category}"></option>`)
            .join('');
    }

    const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
    const visibleAssets = selectedCategory === 'all'
        ? assets
        : assets.filter(asset => (asset.category || '').trim() === selectedCategory);

    if (assets.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">No assets configured yet.</td>
            </tr>
        `;
        return;
    }
    if (visibleAssets.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">No assets in this category.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = visibleAssets.map(asset => `
        <tr>
            <td>${asset.name}</td>
            <td>${asset.category || '—'}</td>
            <td>${formatDate(asset.createdAt)}</td>
            <td>
                <button class="btn btn-outline btn-small" onclick="deleteAsset('${asset.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function deleteArea(areaId) {
    const areas = getAreas();
    const area = areas.find(item => item.id === areaId);
    if (!area) return;

    if (!confirm(`Delete area "${area.name}"?`)) {
        return;
    }

    const updatedAreas = areas.filter(item => item.id !== areaId);
    saveAreas(updatedAreas);
    loadAreas();
    pruneAreaState(areaId);
    populateDeviceAreaOptions();
}

function deleteAsset(assetId) {
    const assets = getAssets();
    const asset = assets.find(item => item.id === assetId);
    if (!asset) return;

    if (!confirm(`Delete asset "${asset.name}"?`)) {
        return;
    }

    const updatedAssets = assets.filter(item => item.id !== assetId);
    saveAssets(updatedAssets);
    loadAssets();
}

function getGroups() {
    const stored = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to parse groups:', error);
        return [];
    }
}

function saveGroups(groups) {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
}

function getUsers() {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to parse users:', error);
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function saveGroupFromForm() {
    const nameInput = document.getElementById('groupName');
    const descriptionInput = document.getElementById('groupDescription');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    const description = descriptionInput ? descriptionInput.value.trim() : '';
    if (!name) {
        alert('Please enter a group name.');
        nameInput.focus();
        return;
    }

    const groups = getGroups();
    const exists = groups.some(group => group.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert('A group with this name already exists.');
        nameInput.focus();
        return;
    }

    groups.push({
        id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        description,
        createdAt: new Date().toISOString()
    });

    saveGroups(groups);
    if (descriptionInput) descriptionInput.value = '';
    nameInput.value = '';
    loadGroups();
    loadUsers();
}

function saveUserFromForm() {
    const nameInput = document.getElementById('userNameInput');
    const emailInput = document.getElementById('userEmailInput');
    const roleSelect = document.getElementById('userRole');
    const groupSelect = document.getElementById('userGroupSelect');
    if (!nameInput || !emailInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const role = roleSelect ? roleSelect.value : 'Viewer';
    const groupId = groupSelect ? groupSelect.value : '';

    if (!name) {
        alert('Please enter the user name.');
        nameInput.focus();
        return;
    }
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address.');
        emailInput.focus();
        return;
    }

    const users = getUsers();
    const exists = users.some(user => user.email.toLowerCase() === email.toLowerCase());
    if (exists) {
        alert('A user with this email already exists.');
        emailInput.focus();
        return;
    }

    users.push({
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        email,
        role,
        groupId: groupId || '',
        createdAt: new Date().toISOString()
    });

    saveUsers(users);
    nameInput.value = '';
    emailInput.value = '';
    if (roleSelect) roleSelect.value = 'Viewer';
    if (groupSelect) groupSelect.value = '';
    loadUsers();
}

function loadGroups() {
    const tableBody = document.getElementById('groupsTableBody');
    if (!tableBody) return;

    const groups = getGroups();
    if (groups.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">No groups configured yet.</td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = groups.map(group => `
            <tr>
                <td>${group.name}</td>
                <td>${group.description || '—'}</td>
                <td>${formatDate(group.createdAt)}</td>
                <td>
                    <button class="btn btn-outline btn-small" onclick="deleteGroup('${group.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    refreshUserGroupOptions(groups);
    refreshDeviceGroupOptions(groups);
}

function refreshUserGroupOptions(groups = null) {
    const select = document.getElementById('userGroupSelect');
    if (!select) return;

    const list = groups || getGroups();
    const current = select.value;
    select.innerHTML = `<option value="">Unassigned</option>` + list.map(group => `
        <option value="${group.id}">${group.name}</option>
    `).join('');

    if (current) {
        select.value = current;
    }
}

function refreshDeviceGroupOptions(groups = null) {
    const listEl = document.getElementById('deviceGroupOptions');
    if (!listEl) return;

    const list = groups || getGroups();
    listEl.innerHTML = list.map(group => `
        <option value="${group.name}"></option>
    `).join('');

    refreshAnalyticsGroupOptions(list);
}

function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    const users = getUsers();
    const groups = getGroups();
    const groupLookup = new Map(groups.map(group => [group.id, group.name]));

    if (users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">No users configured yet.</td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role || 'Viewer'}</td>
                <td>${groupLookup.get(user.groupId) || 'Unassigned'}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td>
                    <button class="btn btn-outline btn-small" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

function deleteGroup(groupId) {
    const groups = getGroups();
    const group = groups.find(item => item.id === groupId);
    if (!group) return;

    if (!confirm(`Delete group "${group.name}"?`)) {
        return;
    }

    const updatedGroups = groups.filter(item => item.id !== groupId);
    saveGroups(updatedGroups);

    const users = getUsers();
    const updatedUsers = users.map(user => (
        user.groupId === groupId ? { ...user, groupId: '' } : user
    ));
    saveUsers(updatedUsers);

    loadGroups();
    loadUsers();
}

function deleteUser(userId) {
    const users = getUsers();
    const user = users.find(item => item.id === userId);
    if (!user) return;

    if (!confirm(`Delete user "${user.name}"?`)) {
        return;
    }

    const updatedUsers = users.filter(item => item.id !== userId);
    saveUsers(updatedUsers);
    loadUsers();
}

function applyDeviceModelPreset(presetId) {
    if (!presetId) return;
    const preset = DEVICE_MODEL_PRESETS.find(item => item.id === presetId);
    if (!preset) return;

    if (preset.deviceType) {
        setDeviceTypeSelect(preset.deviceType);
    } else {
        setDeviceTypeSelect('Tracker');
    }

    if (preset.networks && preset.networks.length) {
        const networkCheckboxes = document.querySelectorAll('input[name="networks"]');
        networkCheckboxes.forEach(checkbox => {
            checkbox.checked = preset.networks.includes(checkbox.value);
        });
    }

    if (preset.sensors && preset.sensors.length) {
        const sensorCheckboxes = document.querySelectorAll('input[name="sensors"]');
        sensorCheckboxes.forEach(checkbox => {
            checkbox.checked = preset.sensors.includes(checkbox.value);
        });
    }

    if (preset.dataFormat) {
        document.getElementById('lteDataFormat').value = preset.dataFormat;
    }
    if (preset.dataLogFrequency) {
        document.getElementById('lteDataLogFrequency').value = preset.dataLogFrequency;
    }
    if (preset.gpsStatus) {
        document.getElementById('gpsStatus').value = preset.gpsStatus;
    }
}

function loadDevices() {
    const devices = getDevices();
    const searchedDevices = filterDevicesBySearch(devices);
    const mapFilteredDevices = getMapFilteredDevices(searchedDevices);
    const renderableMapDevices = mapFilteredDevices.slice(0, MAX_MAP_LIST_RENDER);
    
    // Update device list
    const deviceList = document.getElementById('deviceList');
    if (deviceList) {
        if (!renderableMapDevices.length) {
            deviceList.innerHTML = '<p class="empty-state">No devices match the current map filters.</p>';
        } else {
            const itemsHtml = renderableMapDevices.map(device => {
            const connection = getConnectionStatus(device);
            const batteryValue = Number(device.battery);
            const batteryText = Number.isFinite(batteryValue) ? `${batteryValue.toFixed(0)}%` : 'N/A';
            const safeId = String(device.id || '').replace(/'/g, "\\'");
            const selectedClass = selectedDeviceId === device.id ? ' selected' : '';
            return `
            <div class="device-item${selectedClass}" data-device-id="${device.id}" onclick="selectDevice('${safeId}')">
                <div class="device-item-top">
                    <div class="device-item-main">
                        <span class="device-item-name">${device.name || device.id}</span>
                        <span class="device-item-id">${device.id}</span>
                    </div>
                    <span class="status-badge ${connection.className}">${connection.label}</span>
                </div>
                <div class="device-item-info">
                    <span><i class="fas fa-thermometer-half"></i> ${device.temperature !== null && device.temperature !== undefined ? device.temperature + '°C' : 'N/A'}</span>
                    <span><i class="fas fa-battery-half"></i> ${batteryText}</span>
                    <span><i class="fas fa-clock"></i> ${getLastSeenText(device)}</span>
                </div>
                <div class="device-item-submeta">
                    <span><i class="fas fa-map-marker-alt"></i> ${device.location || 'Unknown'}</span>
                    <span><i class="fas fa-layer-group"></i> ${device.group || 'Ungrouped'}</span>
                </div>
            </div>
        `;
            }).join('');

            const overflowHint = mapFilteredDevices.length > MAX_MAP_LIST_RENDER
                ? `<div class="device-list-overflow-hint">Showing ${MAX_MAP_LIST_RENDER} of ${mapFilteredDevices.length} devices. Narrow filters to find specific devices faster.</div>`
                : '';
            deviceList.innerHTML = `${itemsHtml}${overflowHint}`;
        }
    }

    const mapCountEl = document.getElementById('mapDeviceListCount');
    if (mapCountEl) {
        mapCountEl.textContent = `${mapFilteredDevices.length}/${searchedDevices.length}`;
    }
    
    // Update management table
    const tableBody = document.getElementById('devicesManagementTableBody');
    if (tableBody) {
        tableBody.innerHTML = searchedDevices.map(device => {
            const sensors = device.sensors || [];
            const sensorCount = sensors.length;
            const connection = getConnectionStatus(device);
            const lastSeen = getLastSeenText(device);
            const batteryValue = Number(device.battery);
            const batteryText = Number.isFinite(batteryValue) ? `${batteryValue.toFixed(1)}%` : 'N/A';

            return `
                <tr>
                    <td>${device.id}</td>
                    <td>${device.name}</td>
                    <td>${device.type || 'Standard'}</td>
                    <td><span class="status-badge ${connection.className}">${connection.label}</span></td>
                    <td>${sensorCount} sensor${sensorCount !== 1 ? 's' : ''}</td>
                    <td>${batteryText}</td>
                    <td>${lastSeen}</td>
                    <td>
                        <button class="btn btn-outline btn-small" onclick="viewFullDeviceDetails('${device.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline btn-small" onclick="editDevice('${device.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline btn-small" onclick="deleteDevice('${device.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

function getMapDeviceFilterState() {
    const searchInput = document.getElementById('mapDeviceSearch');
    const statusSelect = document.getElementById('mapDeviceStatusFilter');
    const sortSelect = document.getElementById('mapDeviceSort');
    return {
        search: searchInput ? searchInput.value.trim().toLowerCase() : '',
        status: statusSelect ? statusSelect.value : 'all',
        sort: sortSelect ? sortSelect.value : 'lastSeenDesc'
    };
}

function matchesMapDeviceFilter(device, filterState) {
    if (!device) return false;
    if (filterState.search && !matchesDeviceSearch(device, filterState.search)) {
        return false;
    }
    if (!filterState.status || filterState.status === 'all') {
        return true;
    }
    const connection = getConnectionStatus(device);
    if (filterState.status === 'connected') {
        return connection.label === 'Connected';
    }
    if (filterState.status === 'stale') {
        return connection.label === 'Stale';
    }
    if (filterState.status === 'not-connected') {
        return connection.label === 'Not connected';
    }
    if (filterState.status === 'warning') {
        return connection.className === 'warning';
    }
    return true;
}

function getLastSeenTimestamp(device) {
    const value = device?.lastUpdate || device?.updatedAt || device?.tracker?.lastFix || null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getNumericDeviceValue(value, fallback = -1) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sortMapDevices(devices, sortMode) {
    const list = Array.isArray(devices) ? [...devices] : [];
    if (sortMode === 'nameAsc') {
        list.sort((a, b) => String(a.name || a.id || '').localeCompare(String(b.name || b.id || '')));
        return list;
    }
    if (sortMode === 'batteryDesc') {
        list.sort((a, b) => getNumericDeviceValue(b.battery) - getNumericDeviceValue(a.battery));
        return list;
    }
    if (sortMode === 'tempDesc') {
        list.sort((a, b) => getNumericDeviceValue(b.temperature) - getNumericDeviceValue(a.temperature));
        return list;
    }
    list.sort((a, b) => getLastSeenTimestamp(b) - getLastSeenTimestamp(a));
    return list;
}

function getMapFilteredDevices(devices) {
    if (!Array.isArray(devices)) return [];
    const filterState = getMapDeviceFilterState();
    const filtered = devices.filter(device => matchesMapDeviceFilter(device, filterState));
    return sortMapDevices(filtered, filterState.sort);
}

function selectDevice(deviceId) {
    selectedDeviceId = deviceId;
    const devices = getDevices();
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) return;
    
    // Update selected state
    const deviceItems = document.querySelectorAll('.device-item');
    deviceItems.forEach(item => {
        item.classList.remove('selected');
    });
    const selectedItem = document.querySelector(`[data-device-id="${deviceId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // Show view full details button
    const viewBtn = document.getElementById('viewFullDetailsBtn');
    if (viewBtn) {
        viewBtn.style.display = 'block';
    }
    
    // Update device details
    const details = document.getElementById('deviceDetails');
    if (details) {
        const connectionStatus = getConnectionStatus(device);
        const lastSeenText = getLastSeenText(device);
        const telemetryTemperature = toFiniteNumber(device.temperature);
        const telemetryHumidity = getDeviceHumidityTelemetry(device);
        const telemetryBattery = toFiniteNumber(device.battery);
        const hasTelemetryCoordinates = hasValidCoordinates(device.latitude, device.longitude);
        const telemetryLocationText = hasTelemetryCoordinates
            ? `${Number(device.latitude).toFixed(5)}, ${Number(device.longitude).toFixed(5)}`
            : 'Not reported by tracker';
        const telemetryTimestamp = device.lastUpdate || device.updatedAt || device?.tracker?.lastFix || null;
        const telemetryLastUpdateText = telemetryTimestamp
            ? formatTime(telemetryTimestamp)
            : 'Not reported by tracker';
        details.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">Device ID:</span>
                <span class="detail-value">${device.id}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Name:</span>
                <span class="detail-value">${device.name}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Status:</span>
                <span class="detail-value"><span class="status-badge ${device.status}">${device.status}</span></span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Connection:</span>
                <span class="detail-value"><span class="status-badge ${connectionStatus.className}">${connectionStatus.label}</span></span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Last seen:</span>
                <span class="detail-value">${lastSeenText}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Temperature:</span>
                <span class="detail-value">${telemetryTemperature !== null ? `${telemetryTemperature}°C` : 'Not reported by tracker'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Humidity:</span>
                <span class="detail-value">${telemetryHumidity !== null ? `${telemetryHumidity}%` : 'Not reported by tracker'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Location:</span>
                <span class="detail-value">${telemetryLocationText}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Last Update:</span>
                <span class="detail-value">${telemetryLastUpdateText}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Battery:</span>
                <span class="detail-value">${telemetryBattery !== null ? `${telemetryBattery}%` : 'Not reported by tracker'}</span>
            </div>
        `;
    }
    
    // Center map on device if map exists
    if (map && hasValidCoordinates(device.latitude, device.longitude)) {
        map.setView([device.latitude, device.longitude], 10);
    }
}

function viewFullDeviceDetails(deviceId) {
    const devices = getDevices();
    const device = devices.find(d => d.id === (deviceId || selectedDeviceId));
    
    if (!device) return;
    
    selectedDeviceId = device.id;
    
    // Update modal title
    document.getElementById('modalTitle').textContent = `Device Details: ${device.name}`;
    
    // Build device details HTML
    const networks = device.networks || [];
    const sensors = device.sensors || [];
    const tracker = device.tracker || {};
    
    const modalBody = document.getElementById('deviceModalBody');
    const connectionStatus = getConnectionStatus(device);
    const lastSeenText = getLastSeenText(device);
    const batteryLevelText = Number.isFinite(Number(device.battery))
        ? `${Number(device.battery).toFixed(1)}%`
        : 'Not reported by tracker';
    const firmwareText = device.firmware && String(device.firmware).trim()
        ? String(device.firmware)
        : 'Not reported by tracker';
    const uptimeText = device.uptime && String(device.uptime).trim()
        ? String(device.uptime)
        : 'Not reported by tracker';
    const dataTransmittedText = device.dataTransmitted && String(device.dataTransmitted).trim()
        ? String(device.dataTransmitted)
        : 'Not reported by tracker';
    modalBody.innerHTML = `
        <div class="device-details-grid">
            <!-- Basic Information -->
            <div class="details-section">
                <h3><i class="fas fa-info-circle"></i> Basic Information</h3>
                <div class="detail-item">
                    <span class="detail-label">Device ID:</span>
                    <span class="detail-value">${device.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Group:</span>
                    <span class="detail-value">${device.group || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${device.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Connection:</span>
                    <span class="detail-value"><span class="status-badge ${connectionStatus.className}">${connectionStatus.label}</span></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last seen:</span>
                    <span class="detail-value">${lastSeenText}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Asset:</span>
                    <span class="detail-value">${device.asset || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${device.type || 'Standard'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value"><span class="status-badge ${device.status}">${device.status}</span></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Package:</span>
                    <span class="detail-value">${(safeGetCurrentUser()?.package) || 'Professional'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Registered:</span>
                    <span class="detail-value">${formatDate(device.createdAt)}</span>
                </div>
            </div>
            
            <!-- Location Information -->
            <div class="details-section">
                <h3><i class="fas fa-map-marker-alt"></i> Location</h3>
                <div class="detail-item">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${device.location || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Coordinates:</span>
                <span class="detail-value">${hasValidCoordinates(device.latitude, device.longitude) ? `${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}` : 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last Update:</span>
                    <span class="detail-value">${formatTime(device.lastUpdate)}</span>
                </div>
            </div>
            
            <!-- Network Connectivity -->
            <div class="details-section">
                <h3><i class="fas fa-network-wired"></i> Network Connectivity</h3>
                <div class="network-badges">
                    ${networks.length > 0 ? networks.map(network => `
                        <span class="network-badge active">
                            <i class="fas fa-wifi"></i> ${network}
                        </span>
                    `).join('') : '<span class="network-badge">No networks configured</span>'}
                </div>
                <div class="detail-item" style="margin-top: 1rem;">
                    <span class="detail-label">Primary Network:</span>
                    <span class="detail-value">${networks[0] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Signal Strength:</span>
                    <span class="detail-value">${device.signalStrength || 'N/A'}</span>
                </div>
            </div>
            
            <!-- GPS/GNSS Tracker -->
            <div class="details-section">
                <h3><i class="fas fa-satellite"></i> GPS/GNSS Tracker</h3>
                <div class="tracker-info">
                    <div class="tracker-item">
                        <div class="tracker-item-label">GPS Status</div>
                        <div class="tracker-item-value">${tracker.gpsStatus || device.gpsStatus || 'Active'}</div>
                    </div>
                    <div class="tracker-item">
                        <div class="tracker-item-label">Satellites</div>
                        <div class="tracker-item-value">${tracker.satellites || device.satellites || 'N/A'}</div>
                    </div>
                    <div class="tracker-item">
                        <div class="tracker-item-label">Accuracy</div>
                        <div class="tracker-item-value">${tracker.accuracy ? tracker.accuracy + 'm' : device.accuracy ? device.accuracy + 'm' : 'N/A'}</div>
                    </div>
                    <div class="tracker-item">
                        <div class="tracker-item-label">Last Fix</div>
                        <div class="tracker-item-value">${tracker.lastFix ? formatTime(tracker.lastFix) : formatTime(device.lastUpdate)}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Sensors -->
        <div class="details-section" style="margin-top: 1.5rem;">
            <h3><i class="fas fa-microchip"></i> Sensors</h3>
            <div class="sensor-list">
                ${sensors.length > 0 ? sensors.map(sensor => {
                    const icons = {
                        'temperature': 'fas fa-thermometer-half',
                        'humidity': 'fas fa-tint',
                        'accelerometer': 'fas fa-compress-arrows-alt',
                        'gyroscope': 'fas fa-sync',
                        'magnetometer': 'fas fa-compass',
                        'pressure': 'fas fa-weight',
                        'light': 'fas fa-lightbulb',
                        'proximity': 'fas fa-hand-paper'
                    };
                    const colors = {
                        'temperature': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        'humidity': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        'accelerometer': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                        'gyroscope': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                        'magnetometer': 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
                        'pressure': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                        'light': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                        'proximity': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    };
                    const icon = icons[sensor.type] || 'fas fa-circle';
                    const color = colors[sensor.type] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    
                    return `
                        <div class="sensor-item">
                            <div class="sensor-item-left">
                                <div class="sensor-icon" style="background: ${color};">
                                    <i class="${icon}"></i>
                                </div>
                                <div class="sensor-info">
                                    <h4>${sensor.name || sensor.type.charAt(0).toUpperCase() + sensor.type.slice(1)}</h4>
                                    <p>${sensor.description || 'Sensor reading'}</p>
                                </div>
                            </div>
                            <div class="sensor-value">
                                ${sensor.value} ${sensor.unit || ''}
                            </div>
                        </div>
                    `;
                }).join('') : '<p class="empty-state">No sensors configured</p>'}
            </div>
        </div>
        
        <!-- Additional Information -->
        <div class="details-section" style="margin-top: 1.5rem;">
            <h3><i class="fas fa-battery-full"></i> Device Status</h3>
            <div class="detail-item">
                <span class="detail-label">Battery Level:</span>
                <span class="detail-value">${batteryLevelText}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Firmware Version:</span>
                <span class="detail-value">${firmwareText}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Uptime:</span>
                <span class="detail-value">${uptimeText}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Data Transmitted:</span>
                <span class="detail-value">${dataTransmittedText}</span>
            </div>
        </div>
        
        <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
            <button class="btn btn-primary" onclick="editDevice('${device.id}'); closeDeviceModal();">
                <i class="fas fa-edit"></i> Edit Device
            </button>
            <button class="btn btn-outline" onclick="deleteDevice('${device.id}'); closeDeviceModal();">
                <i class="fas fa-trash"></i> Delete
            </button>
            <button class="btn btn-outline" onclick="closeDeviceModal()">
                Close
            </button>
        </div>
    `;
    
    // Show modal
    document.getElementById('deviceModal').classList.add('active');
}

// Alerts
const DEFAULT_ALERT_FILTERS = {
    severity: 'all',
    status: 'all',
    query: ''
};
let alertFilters = { ...DEFAULT_ALERT_FILTERS };

function initAlerts() {
    document.getElementById('markAllReadBtn').addEventListener('click', function() {
        markAllAlertsRead();
        loadAlerts();
        loadDashboardData();
    });

    const severityFilter = document.getElementById('alertsSeverityFilter');
    const statusFilter = document.getElementById('alertsStatusFilter');
    const searchFilter = document.getElementById('alertsSearchFilter');
    const clearFiltersBtn = document.getElementById('clearAlertsFilterBtn');

    if (severityFilter) {
        severityFilter.addEventListener('change', function () {
            alertFilters.severity = severityFilter.value || 'all';
            loadAlerts();
        });
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', function () {
            alertFilters.status = statusFilter.value || 'all';
            loadAlerts();
        });
    }
    if (searchFilter) {
        searchFilter.addEventListener('input', function () {
            alertFilters.query = (searchFilter.value || '').trim().toLowerCase();
            loadAlerts();
        });
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function () {
            alertFilters = { ...DEFAULT_ALERT_FILTERS };
            if (severityFilter) severityFilter.value = DEFAULT_ALERT_FILTERS.severity;
            if (statusFilter) statusFilter.value = DEFAULT_ALERT_FILTERS.status;
            if (searchFilter) searchFilter.value = DEFAULT_ALERT_FILTERS.query;
            loadAlerts();
        });
    }
}

function filterAlerts(alerts) {
    if (!Array.isArray(alerts) || alerts.length === 0) return [];
    return alerts.filter(alert => {
        if (!alert) return false;

        if (alertFilters.severity !== 'all' && (alert.severity || 'info') !== alertFilters.severity) {
            return false;
        }

        if (alertFilters.status === 'read' && !alert.read) {
            return false;
        }
        if (alertFilters.status === 'unread' && alert.read) {
            return false;
        }

        if (alertFilters.query) {
            const title = (alert.title || '').toLowerCase();
            const message = (alert.message || '').toLowerCase();
            if (!title.includes(alertFilters.query) && !message.includes(alertFilters.query)) {
                return false;
            }
        }

        return true;
    });
}

function loadAlerts() {
    const alerts = getAlerts();
    const filteredAlerts = filterAlerts(alerts);
    const unreadCount = alerts.filter(a => !a.read).length;
    
    // Update badge
    document.getElementById('alertsBadge').textContent = unreadCount;
    document.getElementById('notificationCount').textContent = unreadCount;
    renderNotificationDropdown(alerts);
    
    // Update alerts container
    const container = document.getElementById('alertsContainer');
    if (alerts.length === 0) {
        container.innerHTML = '<p class="empty-state">No alerts at this time</p>';
        return;
    }

    if (filteredAlerts.length === 0) {
        container.innerHTML = '<p class="empty-state">No alerts match current filters</p>';
        return;
    }

    container.innerHTML = filteredAlerts.map(alert => `
        <div class="alert-item ${alert.severity} ${alert.read ? '' : 'unread'}" onclick="markAlertRead('${alert.id}')">
            <div class="alert-icon">
                <i class="${alert.icon}"></i>
            </div>
            <div class="alert-content">
                <h4>${alert.title}</h4>
                <p>${alert.message}</p>
                <span class="alert-time">${formatTime(alert.timestamp)}</span>
            </div>
        </div>
    `).join('');
}

function markAlertRead(alertId) {
    const alerts = getAlerts();
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
        alert.read = true;
        saveAlerts(alerts);
        loadAlerts();
        loadDashboardData();
    }
}

function markAllAlertsRead() {
    const alerts = getAlerts();
    alerts.forEach(alert => alert.read = true);
    saveAlerts(alerts);
}

// Analytics
let analyticsSamplesCache = [];
let analyticsSamplesCacheKey = '';
let analyticsSamplesFetchedAt = 0;
let lastAnalyticsSampleTs = 0;

function getAnalyticsAuthToken() {
    if (typeof window !== 'undefined' && window.ANALYTICS_TOKEN) {
        return window.ANALYTICS_TOKEN;
    }
    const stored = localStorage.getItem('cargotrack_analytics_token');
    return stored || '';
}

function getAnalyticsAuthHeaders() {
    const token = getAnalyticsAuthToken();
    if (!token) return {};
    return {
        Authorization: `Bearer ${token}`
    };
}

async function fetchAnalyticsSamples(range) {
    const authHeaders = getAnalyticsAuthHeaders();
    if (!authHeaders.Authorization) {
        return analyticsSamplesCache;
    }
    const rangeMs = range.bucketMs * range.count;
    const now = Date.now();
    const endTimeMs = range.endTime ? range.endTime.getTime() : now;
    const cacheKey = `${rangeMs}:${endTimeMs}`;
    if (analyticsSamplesCacheKey === cacheKey && now - analyticsSamplesFetchedAt < ANALYTICS_REFRESH_MS) {
        return analyticsSamplesCache;
    }

    try {
        const since = endTimeMs - rangeMs;
        const response = await fetch(
            `${ANALYTICS_SAMPLE_ENDPOINT}?rangeMs=${encodeURIComponent(rangeMs)}&since=${encodeURIComponent(since)}`,
            {
                cache: 'no-store',
                headers: authHeaders
            }
        );
        if (!response.ok) return analyticsSamplesCache;
        const data = await response.json();
        if (!data || !Array.isArray(data.samples)) return analyticsSamplesCache;
        analyticsSamplesCache = data.samples;
        analyticsSamplesCacheKey = cacheKey;
        analyticsSamplesFetchedAt = now;
    } catch (error) {
        console.warn('Failed to fetch analytics samples:', error);
    }

    return analyticsSamplesCache;
}

function getDeviceLastUpdateTimestamp(device) {
    const ts = Date.parse(
        device.lastUpdate || device.updatedAt || (device.tracker && device.tracker.lastFix)
    );
    return Number.isFinite(ts) ? ts : null;
}

function recordAnalyticsSample(devices, alerts) {
    const authHeaders = getAnalyticsAuthHeaders();
    if (!authHeaders.Authorization) {
        return;
    }
    const now = Date.now();
    if (lastAnalyticsSampleTs && now - lastAnalyticsSampleTs < ANALYTICS_SAMPLE_INTERVAL_MS) {
        return;
    }
    lastAnalyticsSampleTs = now;

    let connectedDevices = 0;
    let recentDevices = 0;
    let batterySum = 0;
    let batteryCount = 0;
    let tempSum = 0;
    let tempCount = 0;
    const recentWindowMs = 15 * 60 * 1000;

    devices.forEach(device => {
        const updateTs = getDeviceLastUpdateTimestamp(device);
        if (updateTs) {
            if (now - updateTs <= STALE_DEVICE_MS) connectedDevices += 1;
            if (now - updateTs <= recentWindowMs) recentDevices += 1;
        }
        const batteryValue = Number(device.battery);
        if (Number.isFinite(batteryValue)) {
            batterySum += batteryValue;
            batteryCount += 1;
        }
        const temperatureValue = Number(device.temperature);
        if (Number.isFinite(temperatureValue)) {
            tempSum += temperatureValue;
            tempCount += 1;
        }
    });

    const avgBattery = batteryCount ? batterySum / batteryCount : null;
    const avgTemperature = tempCount ? tempSum / tempCount : null;
    const alerts24h = alerts.filter(alert => {
        const ts = Date.parse(alert.timestamp);
        return Number.isFinite(ts) && now - ts <= 24 * 60 * 60 * 1000;
    }).length;

    const sample = {
        timestamp: new Date(now).toISOString(),
        connectedDevices,
        recentDevices,
        avgBattery,
        avgTemperature,
        alerts24h
    };

    if (analyticsSamplesCache.length) {
        analyticsSamplesCache.push(sample);
    }

    fetch(ANALYTICS_SAMPLE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders
        },
        body: JSON.stringify(sample)
    }).catch(error => {
        console.warn('Failed to persist analytics sample:', error);
    });
}

function updateAnalyticsMetrics(devices, alerts) {
    const filteredDevices = getAnalyticsFilteredDevices(devices);
    const now = Date.now();
    const connectedCount = filteredDevices.reduce((count, device) => {
        const updateTs = getDeviceLastUpdateTimestamp(device);
        if (updateTs && now - updateTs <= STALE_DEVICE_MS) return count + 1;
        return count;
    }, 0);
    const inTransitCount = filteredDevices.filter(device => {
        return (device.status || '').toLowerCase() === 'active';
    }).length;
    const deliveredCount = filteredDevices.filter(device => {
        return (device.status || '').toLowerCase() === 'completed';
    }).length;
    const delayedCount = filteredDevices.filter(device => {
        const connection = getConnectionStatus(device);
        return connection.label === 'Stale' || connection.label === 'No GPS';
    }).length;

    const avgBattery = (() => {
        const values = filteredDevices
            .map(device => Number(device.battery))
            .filter(value => Number.isFinite(value));
        if (!values.length) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    })();

    const avgTemperature = (() => {
        const values = filteredDevices
            .map(device => Number(device.temperature))
            .filter(value => Number.isFinite(value));
        if (!values.length) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    })();

    const alerts24h = alerts.filter(alert => {
        const ts = Date.parse(alert.timestamp);
        return Number.isFinite(ts) && now - ts <= 24 * 60 * 60 * 1000;
    }).length;
    const conditionCounts = filteredDevices.reduce((acc, device) => {
        const logistics = device?.logistics || {};
        if (logistics.monitoringEnabled === false) return acc;

        acc.monitored += 1;

        const temp = toFiniteNumber(device.temperature);
        const humidity = toFiniteNumber(device.humidity);
        const tilt = toFiniteNumber(device.tilt ?? device?.tracker?.tilt);
        const collision = toFiniteNumber(device.collision ?? device?.tracker?.collision);

        const tempMin = toFiniteNumber(logistics.tempMin) ?? -10;
        const tempMax = toFiniteNumber(logistics.tempMax) ?? 30;
        const humidityMin = toFiniteNumber(logistics.humidityMin) ?? 20;
        const humidityMax = toFiniteNumber(logistics.humidityMax) ?? 80;
        const tiltMax = toFiniteNumber(logistics.tiltMax) ?? 30;
        const collisionMaxG = toFiniteNumber(logistics.collisionMaxG) ?? 2.5;
        const deliveryGraceMinutes = toFiniteNumber(logistics.deliveryGraceMinutes) ?? 30;

        if (temp !== null && (temp < tempMin || temp > tempMax)) acc.temp += 1;
        if (humidity !== null && (humidity < humidityMin || humidity > humidityMax)) acc.humidity += 1;
        if (tilt !== null && Math.abs(tilt) > tiltMax) acc.tilt += 1;
        if (collision !== null && Math.abs(collision) > collisionMaxG) acc.collision += 1;

        const expectedDeliveryAt = logistics.expectedDeliveryAt || device?.expectedDeliveryAt || null;
        if (expectedDeliveryAt) {
            const expectedTs = new Date(expectedDeliveryAt).getTime();
            const graceMs = Math.max(0, Number(deliveryGraceMinutes || 0)) * 60 * 1000;
            if (Number.isFinite(expectedTs) && now > expectedTs + graceMs) {
                acc.deliveryDelay += 1;
            }
        }

        return acc;
    }, {
        monitored: 0,
        temp: 0,
        humidity: 0,
        tilt: 0,
        collision: 0,
        deliveryDelay: 0
    });

    const activeDevicesEl = document.getElementById('analyticsActiveDevices');
    if (activeDevicesEl) activeDevicesEl.textContent = String(connectedCount);
    const inTransitEl = document.getElementById('analyticsInTransit');
    if (inTransitEl) inTransitEl.textContent = String(inTransitCount);
    const deliveredEl = document.getElementById('analyticsDelivered');
    if (deliveredEl) deliveredEl.textContent = String(deliveredCount);
    const delayedEl = document.getElementById('analyticsDelayed');
    if (delayedEl) delayedEl.textContent = String(delayedCount);
    const avgBatteryEl = document.getElementById('analyticsAvgBattery');
    if (avgBatteryEl) {
        avgBatteryEl.textContent = Number.isFinite(avgBattery)
            ? `${avgBattery.toFixed(1)}%`
            : '-';
    }
    const avgTempEl = document.getElementById('analyticsAvgTemp');
    if (avgTempEl) {
        avgTempEl.textContent = Number.isFinite(avgTemperature)
            ? `${avgTemperature.toFixed(1)}°C`
            : '-';
    }
    const alerts24hEl = document.getElementById('analyticsAlert24h');
    if (alerts24hEl) alerts24hEl.textContent = String(alerts24h);
    const monitoredDevicesEl = document.getElementById('analyticsMonitoredDevices');
    if (monitoredDevicesEl) monitoredDevicesEl.textContent = String(conditionCounts.monitored);
    const tempViolationsEl = document.getElementById('analyticsTempViolations');
    if (tempViolationsEl) tempViolationsEl.textContent = String(conditionCounts.temp);
    const humidityViolationsEl = document.getElementById('analyticsHumidityViolations');
    if (humidityViolationsEl) humidityViolationsEl.textContent = String(conditionCounts.humidity);
    const tiltViolationsEl = document.getElementById('analyticsTiltViolations');
    if (tiltViolationsEl) tiltViolationsEl.textContent = String(conditionCounts.tilt);
    const collisionViolationsEl = document.getElementById('analyticsCollisionViolations');
    if (collisionViolationsEl) collisionViolationsEl.textContent = String(conditionCounts.collision);
    const deliveryDelaysEl = document.getElementById('analyticsDeliveryDelays');
    if (deliveryDelaysEl) deliveryDelaysEl.textContent = String(conditionCounts.deliveryDelay);

    const activeDevicesNote = document.getElementById('analyticsActiveDevicesNote');
    if (activeDevicesNote) {
        activeDevicesNote.textContent = 'Recently active devices';
    }
    const avgBatteryNote = document.getElementById('analyticsAvgBatteryNote');
    if (avgBatteryNote) {
        avgBatteryNote.textContent = 'Across devices with battery';
    }
    const avgTempNote = document.getElementById('analyticsAvgTempNote');
    if (avgTempNote) {
        avgTempNote.textContent = 'Across devices with temperature';
    }
    const alerts24hNote = document.getElementById('analyticsAlert24hNote');
    if (alerts24hNote) {
        alerts24hNote.textContent = 'Last 24 hours';
    }
    const inTransitNote = document.getElementById('analyticsInTransitNote');
    if (inTransitNote) {
        inTransitNote.textContent = 'Active shipments in transit';
    }
    const deliveredNote = document.getElementById('analyticsDeliveredNote');
    if (deliveredNote) {
        deliveredNote.textContent = 'Marked as completed';
    }
    const delayedNote = document.getElementById('analyticsDelayedNote');
    if (delayedNote) {
        delayedNote.textContent = 'Stale or no GPS';
    }
    const monitoredDevicesNote = document.getElementById('analyticsMonitoredDevicesNote');
    if (monitoredDevicesNote) {
        monitoredDevicesNote.textContent = 'With logistics monitoring enabled';
    }
    const tempViolationsNote = document.getElementById('analyticsTempViolationsNote');
    if (tempViolationsNote) {
        tempViolationsNote.textContent = 'Current threshold violations';
    }
    const humidityViolationsNote = document.getElementById('analyticsHumidityViolationsNote');
    if (humidityViolationsNote) {
        humidityViolationsNote.textContent = 'Current threshold violations';
    }
    const tiltViolationsNote = document.getElementById('analyticsTiltViolationsNote');
    if (tiltViolationsNote) {
        tiltViolationsNote.textContent = 'Current threshold violations';
    }
    const collisionViolationsNote = document.getElementById('analyticsCollisionViolationsNote');
    if (collisionViolationsNote) {
        collisionViolationsNote.textContent = 'Current threshold violations';
    }
    const deliveryDelaysNote = document.getElementById('analyticsDeliveryDelaysNote');
    if (deliveryDelaysNote) {
        deliveryDelaysNote.textContent = 'ETA exceeded with grace';
    }
}

function getAnalyticsSeriesFromSamples(samples, bucketStarts, bucketMs, field) {
    const sums = new Array(bucketStarts.length).fill(0);
    const counts = new Array(bucketStarts.length).fill(0);
    const base = bucketStarts[0]?.getTime();
    if (!Number.isFinite(base)) return sums;

    samples.forEach(sample => {
        const ts = Date.parse(sample.timestamp);
        if (!Number.isFinite(ts)) return;
        const index = Math.floor((ts - base) / bucketMs);
        if (index < 0 || index >= sums.length) return;
        const value = sample[field];
        if (!Number.isFinite(value)) return;
        sums[index] += value;
        counts[index] += 1;
    });

    return sums.map((sum, index) => {
        if (!counts[index]) return 0;
        return Math.round((sum / counts[index]) * 10) / 10;
    });
}

function initAnalytics() {
    const rangeSelect = document.getElementById('analyticsRangeSelect');
    if (rangeSelect) {
        rangeSelect.addEventListener('change', () => {
            refreshAnalyticsCharts();
        });
    }

    const groupSelect = document.getElementById('analyticsGroupFilter');
    if (groupSelect) {
        groupSelect.addEventListener('change', () => {
            updateAnalyticsMetrics(getDevices(), getAlerts());
            refreshAnalyticsCharts();
        });
    }

    refreshAnalyticsGroupOptions();
}

function getStartOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function getAnalyticsRangeConfig() {
    const select = document.getElementById('analyticsRangeSelect');
    const value = select ? select.value : 'today';
    switch (value) {
        case 'yesterday': {
            const endTime = getStartOfToday();
            return { unit: 'hour', count: 24, bucketMs: 60 * 60 * 1000, endTime };
        }
        case 'today':
            return { unit: 'hour', count: 24, bucketMs: 60 * 60 * 1000, endTime: new Date() };
        case '30d':
            return { unit: 'day', count: 30, bucketMs: 24 * 60 * 60 * 1000, endTime: getStartOfToday() };
        case '90d':
            return { unit: 'day', count: 90, bucketMs: 24 * 60 * 60 * 1000, endTime: getStartOfToday() };
        case '6m':
            return { unit: 'day', count: 180, bucketMs: 24 * 60 * 60 * 1000, endTime: getStartOfToday() };
        case '12m':
            return { unit: 'day', count: 365, bucketMs: 24 * 60 * 60 * 1000, endTime: getStartOfToday() };
        case '24m':
            return { unit: 'day', count: 730, bucketMs: 24 * 60 * 60 * 1000, endTime: getStartOfToday() };
        case '7d':
        default:
            return { unit: 'day', count: 7, bucketMs: 24 * 60 * 60 * 1000, endTime: getStartOfToday() };
    }
}

function getLastNHours(hoursCount, endTime) {
    const hours = [];
    const now = endTime ? new Date(endTime) : new Date();
    now.setMinutes(0, 0, 0);
    for (let i = hoursCount - 1; i >= 0; i -= 1) {
        const hour = new Date(now);
        hour.setHours(now.getHours() - i);
        hours.push(hour);
    }
    return hours;
}

function getLastNDays(daysCount, endTime) {
    const days = [];
    const today = endTime ? new Date(endTime) : new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = daysCount - 1; i >= 0; i -= 1) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        days.push(day);
    }
    return days;
}

function formatBucketLabel(date, unit) {
    if (unit === 'hour') {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDeviceActivitySeries(devices, bucketStarts, bucketMs) {
    const counts = new Array(bucketStarts.length).fill(0);
    const base = bucketStarts[0]?.getTime();
    if (!Number.isFinite(base)) return counts;
    devices.forEach(device => {
        const ts = Date.parse(
            device.lastUpdate || device.updatedAt || (device.tracker && device.tracker.lastFix)
        );
        if (!Number.isFinite(ts)) return;
        const index = Math.floor((ts - base) / bucketMs);
        if (index >= 0 && index < counts.length) {
            counts[index] += 1;
        }
    });
    return counts;
}

function getAlertDistribution(alerts) {
    const counts = { critical: 0, warning: 0, info: 0 };
    alerts.forEach(alert => {
        const severity = (alert.severity || 'info').toLowerCase();
        if (severity === 'critical') counts.critical += 1;
        else if (severity === 'warning') counts.warning += 1;
        else counts.info += 1;
    });
    return counts;
}

async function initCharts() {
    if (charts.shipmentTrends) {
        charts.shipmentTrends.destroy();
        delete charts.shipmentTrends;
    }
    if (charts.alertDistribution) {
        charts.alertDistribution.destroy();
        delete charts.alertDistribution;
    }

    const devices = getAnalyticsFilteredDevices(getDevices());
    const alerts = getAlerts();
    const range = getAnalyticsRangeConfig();
    const buckets = range.unit === 'hour'
        ? getLastNHours(range.count, range.endTime)
        : getLastNDays(range.count, range.endTime);
    const labels = buckets.map(date => formatBucketLabel(date, range.unit));
    const activityData = getDeviceActivitySeries(devices, buckets, range.bucketMs);
    const alertCounts = getAlertDistribution(alerts);

    // Shipment Trends Chart
    const trendsCtx = document.getElementById('shipmentTrendsChart');
    if (trendsCtx) {
        charts.shipmentTrends = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Device activity',
                    data: activityData,
                    borderColor: 'rgb(37, 99, 235)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // Alert Distribution Chart
    const alertCtx = document.getElementById('alertDistributionChart');
    if (alertCtx) {
        charts.alertDistribution = new Chart(alertCtx, {
            type: 'doughnut',
            data: {
                labels: ['Critical', 'Warning', 'Info'],
                datasets: [{
                    data: [alertCounts.critical, alertCounts.warning, alertCounts.info],
                    backgroundColor: [
                        'rgb(239, 68, 68)',
                        'rgb(245, 158, 11)',
                        'rgb(37, 99, 235)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    const samples = await fetchAnalyticsSamples(range);
    if (charts.shipmentTrends && samples.length && getAnalyticsGroupFilter() === 'all') {
        const updated = getAnalyticsSeriesFromSamples(
            samples,
            buckets,
            range.bucketMs,
            'recentDevices'
        );
        charts.shipmentTrends.data.datasets[0].data = updated;
        charts.shipmentTrends.update();
    }
}

async function refreshAnalyticsCharts() {
    if (charts.shipmentTrends) {
        const range = getAnalyticsRangeConfig();
        const buckets = range.unit === 'hour'
            ? getLastNHours(range.count, range.endTime)
            : getLastNDays(range.count, range.endTime);
        const labels = buckets.map(date => formatBucketLabel(date, range.unit));
        const activityData = getDeviceActivitySeries(
            getAnalyticsFilteredDevices(getDevices()),
            buckets,
            range.bucketMs
        );
        charts.shipmentTrends.data.labels = labels;
        charts.shipmentTrends.data.datasets[0].data = activityData;
        charts.shipmentTrends.update();

        const samples = await fetchAnalyticsSamples(range);
        if (samples.length && getAnalyticsGroupFilter() === 'all') {
            const updated = getAnalyticsSeriesFromSamples(
                samples,
                buckets,
                range.bucketMs,
                'recentDevices'
            );
            charts.shipmentTrends.data.datasets[0].data = updated;
            charts.shipmentTrends.update();
        }
    }

    if (charts.alertDistribution) {
        const alertCounts = getAlertDistribution(getAlerts());
        charts.alertDistribution.data.datasets[0].data = [
            alertCounts.critical,
            alertCounts.warning,
            alertCounts.info
        ];
        charts.alertDistribution.update();
    }
}

function createSensorChart(canvasId, label, values, color, unit) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 300);
    gradient.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.35)'));
    gradient.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ', 0)'));

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: values.labels,
            datasets: [{
                label: `${label} (${unit})`,
                data: values.data,
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 2,
                tension: 0.45,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: color,
                fill: true,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context => `${context.parsed.y}${unit}`
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(148, 163, 184, 0.2)'
                    }
                }
            }
        }
    });
}

function updateTemperatureChart() {
    const canvas = document.getElementById('temperatureChart');
    if (!canvas) return;

    if (charts.temperature) {
        charts.temperature.destroy();
    }

    const devices = getDevices();
    const labels = devices.slice(0, 7).map(d => d.name);
    const data = devices.slice(0, 7).map(d => d.temperature ?? null);

    charts.temperature = createSensorChart(
        'temperatureChart',
        'Temperature',
        { labels, data },
        'rgb(244, 114, 182)',
        '°C'
    );
}

function updateHumidityChart() {
    const canvas = document.getElementById('humidityChart');
    if (!canvas) return;

    if (charts.humidity) {
        charts.humidity.destroy();
    }

    const devices = getDevices();
    const labels = devices.slice(0, 7).map(d => d.name);
    const data = devices.slice(0, 7).map(d => d.humidity ?? null);

    charts.humidity = createSensorChart(
        'humidityChart',
        'Humidity',
        { labels, data },
        'rgb(59, 130, 246)',
        '%'
    );
}

function updateBatteryChart() {
    const canvas = document.getElementById('batteryChart');
    if (!canvas) return;

    if (charts.battery) {
        charts.battery.destroy();
    }

    const devices = getDevices();
    const labels = devices.slice(0, 7).map(d => d.name);
    const data = devices.slice(0, 7).map(d => d.battery ?? null);

    charts.battery = createSensorChart(
        'batteryChart',
        'Battery',
        { labels, data },
        'rgb(34, 197, 94)',
        '%'
    );
}

// 4G LTE Tracker Connection
let trackerConnection = null;
let trackerInterval = null;
let messageCount = 0;
let uplinkCount = 0;

function initTrackerConnection() {
    const connectBtn = document.getElementById('connectTrackerBtn');
    const disconnectBtn = document.getElementById('disconnectTrackerBtn');
    const clearBtn = document.getElementById('clearDataBtn');
    const trackerForm = document.getElementById('trackerConnectionForm');
    
    // Prevent form submission
    if (trackerForm) {
        trackerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Don't submit form, let the button handler do the work
            return false;
        });
    }
    
    // Ensure buttons don't submit form
    if (connectBtn) {
        connectBtn.type = 'button';
        
        // Remove any existing listeners by cloning
        const newConnectBtn = connectBtn.cloneNode(true);
        connectBtn.parentNode.replaceChild(newConnectBtn, connectBtn);
        
        // Get the new button reference
        const freshConnectBtn = document.getElementById('connectTrackerBtn');
        
        // Add click handler to the new button
        if (freshConnectBtn) {
            freshConnectBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Connect Tracker button clicked');
                
                // Validate form before connecting
                if (!validateTrackerForm()) {
                    return false;
                }
                
                connectTracker();
                return false;
            });
        }
    }
    
    if (disconnectBtn) {
        disconnectBtn.type = 'button';
        disconnectBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            disconnectTracker();
        });
    }
    
    if (clearBtn) {
        clearBtn.type = 'button';
        clearBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            clearMessageLog();
        });
    }
    
    // Load saved connection settings
    loadTrackerSettings();
}

function handleNetworkServerChange() {
    // No-op: LTE trackers don't require network server selection
}

function loadTrackerSettings() {
    const savedSettings = localStorage.getItem('lte_tracker_settings');
    const systemSettings = JSON.parse(localStorage.getItem('lte_system_settings') || '{}');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        const trackerDeviceId = document.getElementById('trackerDeviceId');
        if (trackerDeviceId) {
            trackerDeviceId.value = settings.deviceId || '';
        }
        const trackerImei = document.getElementById('trackerImei');
        if (trackerImei) {
            trackerImei.value = settings.imei || '';
        }
        const trackerSimIccid = document.getElementById('trackerSimIccid');
        if (trackerSimIccid) {
            trackerSimIccid.value = settings.simIccid || '';
        }
        const trackerCarrier = document.getElementById('trackerCarrier');
        if (trackerCarrier) {
            trackerCarrier.value = settings.carrier || systemSettings.defaultCarrier || '';
        }
        const trackerApn = document.getElementById('trackerApn');
        if (trackerApn) {
            trackerApn.value = settings.apn || systemSettings.defaultApn || '';
        }
        const dataLogFrequency = document.getElementById('dataLogFrequency');
        if (dataLogFrequency) {
            dataLogFrequency.value = settings.dataLogFrequency || '5000';
        }
        const dataFormat = document.getElementById('dataFormat');
        if (dataFormat) {
            dataFormat.value = settings.dataFormat || 'json';
        }
    } else {
        const trackerCarrier = document.getElementById('trackerCarrier');
        if (trackerCarrier && systemSettings.defaultCarrier) {
            trackerCarrier.value = systemSettings.defaultCarrier;
        }
        const trackerApn = document.getElementById('trackerApn');
        if (trackerApn && systemSettings.defaultApn) {
            trackerApn.value = systemSettings.defaultApn;
        }
    }
}

function saveTrackerSettings() {
    const trackerImei = document.getElementById('trackerImei');
    const trackerSimIccid = document.getElementById('trackerSimIccid');
    const trackerCarrier = document.getElementById('trackerCarrier');
    const trackerApn = document.getElementById('trackerApn');
    const dataLogFrequency = document.getElementById('dataLogFrequency');
    const trackerDeviceId = document.getElementById('trackerDeviceId');
    const dataFormat = document.getElementById('dataFormat');

    const settings = {
        deviceId: trackerDeviceId ? trackerDeviceId.value : '',
        imei: trackerImei ? trackerImei.value : '',
        simIccid: trackerSimIccid ? trackerSimIccid.value : '',
        carrier: trackerCarrier ? trackerCarrier.value : '',
        apn: trackerApn ? trackerApn.value : '',
        dataLogFrequency: dataLogFrequency ? dataLogFrequency.value : '5000',
        dataFormat: dataFormat ? dataFormat.value : 'json'
    };
    localStorage.setItem('lte_tracker_settings', JSON.stringify(settings));
}

// Validate tracker form before connecting
function validateTrackerForm() {
    const deviceIdInput = document.getElementById('trackerDeviceId');
    const imeiInput = document.getElementById('trackerImei');
    const simIccidInput = document.getElementById('trackerSimIccid');
    const carrierInput = document.getElementById('trackerCarrier');
    const apnInput = document.getElementById('trackerApn');
    
    if (!deviceIdInput || !imeiInput || !simIccidInput || !carrierInput || !apnInput) {
        console.error('Tracker form inputs not found');
        alert('Error: Form elements not found. Please refresh the page.');
        return false;
    }
    
    const deviceId = deviceIdInput.value.trim();
    const imei = imeiInput.value.trim();
    const simIccid = simIccidInput.value.trim();
    const carrier = carrierInput.value.trim();
    const apn = apnInput.value.trim();
    
    if (!deviceId) {
        alert('Please enter a Device ID');
        deviceIdInput.focus();
        return false;
    }
    
    if (!imei || !/^\d{15}$/.test(imei)) {
        alert('Please enter a valid 15-digit IMEI');
        imeiInput.focus();
        return false;
    }
    
    if (!simIccid || !/^\d{18,22}$/.test(simIccid)) {
        alert('Please enter a valid SIM ICCID (18-22 digits)');
        simIccidInput.focus();
        return false;
    }
    
    if (!carrier) {
        alert('Please enter your carrier name');
        carrierInput.focus();
        return false;
    }
    
    if (!apn) {
        alert('Please enter your APN');
        apnInput.focus();
        return false;
    }
    
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,}$/.test(deviceId)) {
        alert('Device ID should be at least 2 characters and use letters, numbers, dots, dashes, or underscores.');
        deviceIdInput.focus();
        return false;
    }
    
    return true;
}

async function connectTracker() {
    console.log('connectTracker called');
    
    try {
        const deviceIdInput = document.getElementById('trackerDeviceId');
        const imeiInput = document.getElementById('trackerImei');
        const simIccidInput = document.getElementById('trackerSimIccid');
        const carrierInput = document.getElementById('trackerCarrier');
        const apnInput = document.getElementById('trackerApn');

        if (!deviceIdInput || !imeiInput || !simIccidInput || !carrierInput || !apnInput) {
            console.error('Required form elements not found');
            alert('Error: Form elements not found. Please refresh the page.');
            return;
        }

        const deviceId = deviceIdInput.value.trim();
        const imei = imeiInput.value.trim();

        console.log('Connection settings:', { deviceId, imei });

        // Validate form (validation already done by button handler, but double-check for safety)
        if (!validateTrackerForm()) {
            return;
        }
        
        // Save settings
        saveTrackerSettings();

        if (typeof registerDeviceIds === 'function') {
            registerDeviceIds([deviceId, imei].filter(Boolean));
        }
        // Fetch live locations soon so app shows connection once ingest has data
        if (typeof fetchLiveLocations === 'function') {
            setTimeout(fetchLiveLocations, 600);
        }

        // Update UI
        const connectBtn = document.getElementById('connectTrackerBtn');
        const disconnectBtn = document.getElementById('disconnectTrackerBtn');
        const realtimeDataCard = document.getElementById('realtimeDataCard');
        
        if (!connectBtn || !disconnectBtn) {
            console.error('Connect/Disconnect buttons not found');
            alert('Error: Buttons not found. Please refresh the page.');
            return;
        }
        
        connectBtn.style.display = 'none';
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        disconnectBtn.style.display = 'block';
        
        if (realtimeDataCard) {
            realtimeDataCard.style.display = 'block';
        }
        
        updateConnectionStatus('connecting');
        updateTrackerStatusBadge('Connecting...', '#f59e0b');
        
        // Disable form fields while connected
        const formFields = [
            'trackerDeviceId', 'trackerImei', 'trackerSimIccid',
            'trackerCarrier', 'trackerApn', 'dataLogFrequency', 'dataFormat'
        ];
        
        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.disabled = true;
            }
        });
        
        // Start receiving data
        console.log('Starting LTE connection');
        try {
            await startRealConnection();
            connectBtn.textContent = 'Connect Tracker';
            connectBtn.disabled = false;
            
            // Show success message
            showConnectionMessage('Connected successfully! Waiting for tracker data...', 'success');
        } catch (error) {
            console.error('Connection error:', error);
            let errorMessage = error.message || 'Connection failed';

            showConnectionMessage('Connection failed: ' + errorMessage, 'error');
            disconnectTracker();
            connectBtn.textContent = 'Connect Tracker';
            connectBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error in connectTracker:', error);
        alert('An error occurred: ' + error.message);
    }
}

function disconnectTracker() {
    // Stop data reception
    if (trackerInterval) {
        clearInterval(trackerInterval);
        trackerInterval = null;
    }
    
    // Update UI
    document.getElementById('connectTrackerBtn').style.display = 'block';
    document.getElementById('connectTrackerBtn').disabled = false;
    document.getElementById('connectTrackerBtn').textContent = 'Connect Tracker';
    document.getElementById('disconnectTrackerBtn').style.display = 'none';
    updateConnectionStatus('disconnected');
    updateTrackerStatusBadge('Disconnected', '#ef4444');
    
    // Enable form fields
    const formFieldsToEnable = [
        'trackerDeviceId', 'trackerImei', 'trackerSimIccid',
        'trackerCarrier', 'trackerApn', 'dataLogFrequency', 'dataFormat'
    ];
    
    formFieldsToEnable.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.disabled = false;
        }
    });
    
    // Reset frequency display
    document.getElementById('logFrequencyValue').textContent = '-';
    
    // Clear real-time data
    clearRealtimeData();
}

async function startRealConnection() {
    updateConnectionStatus('connecting');
    showConnectionMessage('Connecting to LTE network...', 'info');

    await new Promise(resolve => setTimeout(resolve, 600));

    updateConnectionStatus('connected');
    updateTrackerStatusBadge('Connected', '#10b981');

    const dataLogFreqEl = document.getElementById('dataLogFrequency');
    const frequency = dataLogFreqEl ? parseInt(dataLogFreqEl.value) || 5000 : 5000;

    updateFrequencyDisplay(frequency);
    showConnectionMessage('Connected. Waiting for live LTE data...', 'info');
}

// Show connection status messages
function showConnectionMessage(message, type = 'info') {
    // Remove existing message if any
    let messageDiv = document.getElementById('connectionMessage');
    if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'connectionMessage';
        messageDiv.style.cssText = 'margin: 1rem 0; padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.875rem;';
        const statusCard = document.querySelector('#connectionStatus').parentElement;
        statusCard.insertBefore(messageDiv, document.getElementById('connectionStatus'));
    }
    
    // Set style based on type
    if (type === 'success') {
        messageDiv.style.backgroundColor = '#d1fae5';
        messageDiv.style.color = '#065f46';
        messageDiv.style.border = '1px solid #10b981';
    } else if (type === 'error') {
        messageDiv.style.backgroundColor = '#fee2e2';
        messageDiv.style.color = '#991b1b';
        messageDiv.style.border = '1px solid #ef4444';
    } else {
        messageDiv.style.backgroundColor = '#dbeafe';
        messageDiv.style.color = '#1e40af';
        messageDiv.style.border = '1px solid #3b82f6';
    }
    
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    
    // Auto-hide info messages after 5 seconds
    if (type === 'info') {
        setTimeout(() => {
            if (messageDiv && messageDiv.textContent === message) {
                messageDiv.style.display = 'none';
            }
        }, 5000);
    }
}

function processRealTrackerData(data) {
    // Convert raw data to display format
    const parsed = data.parsed || {};
    const parsedLatitude = parseFloat(data.latitude);
    const parsedLongitude = parseFloat(data.longitude);
    const hasCoords = Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);
    const displayData = {
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        imei: data.imei,
        latitude: hasCoords ? parsedLatitude : null,
        longitude: hasCoords ? parsedLongitude : null,
        accuracy: parsed.accuracy || 5,
        satellites: parsed.satellites || parsed.gps_satellites || null,
        temperature: data.temperature || null,
        humidity: data.humidity || null,
        battery: data.battery || null,
        rssi: data.rssi || null,
        snr: data.snr || null,
        accelX: data.accelerometer?.x || null,
        accelY: data.accelerometer?.y || null,
        accelZ: data.accelerometer?.z || null,
        motion: data.motion || (data.accelerometer ? 'Detected' : 'No'),
        frameCounter: data.frameCounter || uplinkCount + 1
    };
    
    // Update real-time data display
    updateRealtimeData(displayData);
    
    // Update message log
    addMessageToLog(displayData);
    
    // Update counters
    messageCount++;
    uplinkCount++;
    document.getElementById('messagesReceivedValue').textContent = messageCount;
    document.getElementById('uplinkCountValue').textContent = uplinkCount;
    document.getElementById('lastMessageValue').textContent = formatTime(displayData.timestamp);
    
    if (displayData.rssi !== null) {
        document.getElementById('signalStrengthValue').textContent = displayData.rssi + ' dBm';
    }
    
    // Update device on map if it exists
    if (hasValidCoordinates(displayData.latitude, displayData.longitude)) {
        updateDeviceFromTracker(displayData);
    }
}

function updateRealtimeData(data) {
    document.getElementById('dataLatitude').textContent = data.latitude !== null && data.latitude !== undefined ? data.latitude.toFixed(6) + '°' : '-';
    document.getElementById('dataLongitude').textContent = data.longitude !== null && data.longitude !== undefined ? data.longitude.toFixed(6) + '°' : '-';
    document.getElementById('dataAccuracy').textContent = data.accuracy !== null && data.accuracy !== undefined ? data.accuracy + ' m' : '-';
    document.getElementById('dataSatellites').textContent = data.satellites !== null && data.satellites !== undefined ? data.satellites : '-';
    document.getElementById('dataTemperature').textContent = data.temperature !== null && data.temperature !== undefined ? data.temperature + ' °C' : '-';
    document.getElementById('dataHumidity').textContent = data.humidity !== null && data.humidity !== undefined ? data.humidity + ' %' : '-';
    document.getElementById('dataBattery').textContent = data.battery !== null && data.battery !== undefined ? data.battery + ' %' : '-';
    document.getElementById('dataRSSI').textContent = data.rssi !== null && data.rssi !== undefined ? data.rssi + ' dBm' : '-';
    document.getElementById('dataAccelX').textContent = data.accelX !== null && data.accelX !== undefined ? data.accelX + ' g' : '-';
    document.getElementById('dataAccelY').textContent = data.accelY !== null && data.accelY !== undefined ? data.accelY + ' g' : '-';
    document.getElementById('dataAccelZ').textContent = data.accelZ !== null && data.accelZ !== undefined ? data.accelZ + ' g' : '-';
    document.getElementById('dataMotion').textContent = data.motion !== null && data.motion !== undefined ? data.motion : '-';
}

function clearRealtimeData() {
    document.getElementById('dataLatitude').textContent = '-';
    document.getElementById('dataLongitude').textContent = '-';
    document.getElementById('dataAccuracy').textContent = '-';
    document.getElementById('dataSatellites').textContent = '-';
    document.getElementById('dataTemperature').textContent = '-';
    document.getElementById('dataHumidity').textContent = '-';
    document.getElementById('dataBattery').textContent = '-';
    document.getElementById('dataRSSI').textContent = '-';
    document.getElementById('dataAccelX').textContent = '-';
    document.getElementById('dataAccelY').textContent = '-';
    document.getElementById('dataAccelZ').textContent = '-';
    document.getElementById('dataMotion').textContent = '-';
}

function addMessageToLog(data) {
    const log = document.getElementById('messageLog');
    const emptyState = log.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-item';
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-time">${formatTime(data.timestamp)}</span>
            <span class="message-deveui">Device ID: ${data.deviceId || '-'}</span>
            <span class="message-deveui">IMEI: ${data.imei || '-'}</span>
        </div>
        <div class="message-content">
            <div class="message-data">
                <span>📍 ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}</span>
                <span>🌡️ ${data.temperature}°C</span>
                <span>💧 ${data.humidity}%</span>
                <span>🔋 ${data.battery}%</span>
                <span>📶 ${data.rssi} dBm</span>
            </div>
        </div>
    `;
    
    log.insertBefore(messageDiv, log.firstChild);
    
    // Keep only last 20 messages
    while (log.children.length > 20) {
        log.removeChild(log.lastChild);
    }
}

function clearMessageLog() {
    const log = document.getElementById('messageLog');
    log.innerHTML = '<p class="empty-state">No messages received yet</p>';
    messageCount = 0;
    uplinkCount = 0;
    document.getElementById('messagesReceivedValue').textContent = '0';
    document.getElementById('uplinkCountValue').textContent = '0';
}

function updateConnectionStatus(status) {
    const statusValue = document.getElementById('connectionStatusValue');
    if (status === 'connected') {
        statusValue.innerHTML = '<span class="status-indicator connected"></span> Connected';
    } else if (status === 'connecting') {
        statusValue.innerHTML = '<span class="status-indicator" style="background: #f59e0b;"></span> Connecting...';
    } else {
        statusValue.innerHTML = '<span class="status-indicator disconnected"></span> Disconnected';
    }
}

function updateFrequencyDisplay(frequencyMs) {
    // Format frequency for display
    let frequencyText = '';
    if (frequencyMs < 1000) {
        frequencyText = frequencyMs + 'ms';
    } else if (frequencyMs < 60000) {
        frequencyText = (frequencyMs / 1000) + 's';
    } else if (frequencyMs < 3600000) {
        frequencyText = (frequencyMs / 60000) + ' min';
    } else {
        frequencyText = (frequencyMs / 3600000) + ' hour';
    }
    
    // Update status display
    const logFrequencyValue = document.getElementById('logFrequencyValue');
    if (logFrequencyValue) {
        logFrequencyValue.textContent = frequencyText;
    }
}

function updateTrackerStatusBadge(text, color) {
    const badge = document.getElementById('trackerStatusBadge');
    if (badge) {
        badge.textContent = text;
        badge.style.background = color;
    }
}

function updateDeviceFromTracker(data) {
    // If a device with matching Device ID exists, update it
    const devices = getDevices();
    const device = devices.find(d => d.id === data.deviceId || d.name === data.deviceId);
    
    if (device) {
        if (hasValidCoordinates(data.latitude, data.longitude)) {
            device.latitude = data.latitude;
            device.longitude = data.longitude;
        }
        device.temperature = data.temperature;
        device.humidity = data.humidity;
        device.battery = data.battery;
        device.satellites = data.satellites;
        device.accuracy = data.accuracy;
        device.lastUpdate = data.timestamp;
        device.signalStrength = data.rssi + ' dBm';
        
        // Update tracker info
        if (device.tracker) {
            device.tracker.lastFix = data.timestamp;
            device.tracker.satellites = data.satellites;
            device.tracker.accuracy = data.accuracy;
        }
        evaluateDeviceLogisticsConditions(device);
        
        localStorage.setItem('cargotrack_devices', JSON.stringify(devices));
        
        // Update map if it's open
        if (map) {
            updateMap();
        }
        
        // Refresh dashboard
        loadDashboardData();
    }
}

// Settings - with retry limit to prevent infinite loops
let initSettingsRetryCount = 0;
const MAX_INIT_SETTINGS_RETRIES = 10;

function initSettings() {
    // Check if getCurrentUser is available (check both window and global)
    const getCurrentUserFn = window.getCurrentUser || (typeof getCurrentUser !== 'undefined' ? getCurrentUser : null);
    const currentUser = safeGetCurrentUser();
    
    if (!currentUser && typeof getCurrentUserFn !== 'function') {
        initSettingsRetryCount++;
        if (initSettingsRetryCount < MAX_INIT_SETTINGS_RETRIES) {
            console.warn(`getCurrentUser not available in initSettings, retrying... (${initSettingsRetryCount}/${MAX_INIT_SETTINGS_RETRIES})`);
            setTimeout(initSettings, 200);
            return;
        } else {
            console.error('getCurrentUser not available after maximum retries, skipping settings initialization');
            // Try to continue without user - settings might still work
            initSettingsRetryCount = 0;
            return;
        }
    }
    
    // Reset retry count on success
    initSettingsRetryCount = 0;
    
    // Load current settings
    loadAccountSettings();
    loadNotificationSettings();

    const capabilities = getPlanCapabilities();
    const apiKeysCard = document.getElementById('apiKeysCard');
    if (apiKeysCard && !capabilities.allowApiKeys) {
        apiKeysCard.style.display = 'none';
    }
    
    // Account settings form
    const accountForm = document.getElementById('accountSettingsForm');
    if (accountForm) {
        accountForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAccountSettings();
        });
    }
    
    // Notification settings form
    const notificationForm = document.getElementById('notificationSettingsForm');
    if (notificationForm) {
        notificationForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveNotificationSettings();
        });
    }
    
    // Support request form
    const supportForm = document.getElementById('supportRequestForm');
    if (supportForm) {
        supportForm.addEventListener('submit', submitSupportRequest);
    }
    
    // Password change form
    const passwordForm = document.getElementById('passwordChangeForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (newPassword !== confirmPassword) {
                alert('New passwords do not match');
                return;
            }
            
            const result = changePassword(currentUser.id, currentPassword, newPassword);
            if (result.success) {
                alert('Password changed successfully!');
                document.getElementById('passwordChangeForm').reset();
            } else {
                alert(result.message);
            }
        });
    }
    
    // API Key generation
    const generateApiKeyBtn = document.getElementById('generateApiKeyBtn');
    if (generateApiKeyBtn) {
        generateApiKeyBtn.addEventListener('click', () => {
            generateUserApiKey();
        });
    }
    
    // Load user API keys
    loadUserApiKeys();
}

// User API Key Management
async function fetchTenantApiKeys() {
    const authHeaders = getApiAuthHeaders();
    if (!authHeaders.Authorization) {
        return [];
    }
    const response = await fetch('/api/api-keys', {
        headers: authHeaders,
        cache: 'no-store'
    });
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    return Array.isArray(data.keys) ? data.keys : [];
}

async function createTenantApiKey(name) {
    const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getApiAuthHeaders()
        },
        body: JSON.stringify({ name })
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || 'Failed to generate API key');
    }
    const data = await response.json();
    return data.key;
}

async function updateTenantApiKey(id, active) {
    const response = await fetch('/api/api-keys', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...getApiAuthHeaders()
        },
        body: JSON.stringify({ id, active })
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || 'Failed to update API key');
    }
}

async function deleteTenantApiKey(id) {
    const response = await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            ...getApiAuthHeaders()
        },
        body: JSON.stringify({ id })
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || 'Failed to delete API key');
    }
}

async function generateUserApiKey() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) {
        alert('Please login to generate API keys');
        return;
    }

    const capabilities = getPlanCapabilities();
    if (!capabilities.allowApiKeys) {
        alert('API key generation is not available on your plan.');
        return;
    }

    const keyName = prompt('Enter a name for this API key (e.g., "ERP Integration", "Custom Dashboard"):');
    if (!keyName || !keyName.trim()) {
        return;
    }

    try {
        const keyData = await createTenantApiKey(keyName.trim());
        showApiKeyModal(keyData);
        loadUserApiKeys();
    } catch (error) {
        alert(error.message || 'Failed to generate API key.');
    }
}

async function loadUserApiKeys() {
    const container = document.getElementById('userApiKeysList');
    if (!container) return;
    const capabilities = getPlanCapabilities();
    if (!capabilities.allowApiKeys) {
        container.innerHTML = '<p style="color: var(--text-light); padding: 2rem; text-align: center;">API key management is available on Enterprise plans.</p>';
        return;
    }
    const keys = await fetchTenantApiKeys();
    
    if (keys.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); padding: 2rem; text-align: center;">No API keys generated yet. Click "Generate New API Key" to create one.</p>';
        return;
    }
    
    container.innerHTML = keys.map(key => `
        <div class="api-key-item" style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 0.5rem; margin-bottom: 1rem; background: var(--bg-light);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <div>
                    <h4 style="margin: 0 0 0.25rem 0;">${key.name}</h4>
                    <small style="color: var(--text-light);">Created: ${new Date(key.createdAt).toLocaleDateString()}</small>
                    ${key.lastUsed ? `<br><small style="color: var(--text-light);">Last used: ${new Date(key.lastUsed).toLocaleDateString()}</small>` : ''}
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <span class="status-badge ${key.active ? 'active' : 'inactive'}">${key.active ? 'Active' : 'Inactive'}</span>
                    <button class="btn btn-outline btn-small" onclick="toggleApiKey('${key.id}', ${key.active ? 'true' : 'false'})">
                        <i class="fas fa-${key.active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn btn-outline btn-small" onclick="deleteApiKey('${key.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div style="background: var(--bg-dark); padding: 0.75rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.875rem; word-break: break-all;">
                ${key.key ? `${key.key.substring(0, 20)}...${key.key.substring(key.key.length - 10)}` : 'Hidden'}
            </div>
            <small style="color: var(--text-light); display: block; margin-top: 0.5rem;">
                <i class="fas fa-info-circle"></i> Full key is only shown once when created. Copy it securely.
            </small>
        </div>
    `).join('');
}

async function toggleApiKey(keyId, isActive) {
    try {
        await updateTenantApiKey(keyId, !isActive);
        loadUserApiKeys();
    } catch (error) {
        alert(error.message || 'Failed to update API key.');
    }
}

async function deleteApiKey(keyId) {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
        return;
    }

    try {
        await deleteTenantApiKey(keyId);
        loadUserApiKeys();
    } catch (error) {
        alert(error.message || 'Failed to delete API key.');
    }
}

function showApiKeyModal(keyData) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>API Key Generated</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p><strong>Important:</strong> Copy this API key now. You won't be able to see it again!</p>
                <div style="background: var(--bg-dark); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
                    <div style="font-family: monospace; font-size: 0.875rem; word-break: break-all; user-select: all;">${keyData.key}</div>
                </div>
                <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${keyData.key}').then(() => alert('API key copied to clipboard!'))">
                    <i class="fas fa-copy"></i> Copy to Clipboard
                </button>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Make functions globally available
window.toggleApiKey = toggleApiKey;
window.deleteApiKey = deleteApiKey;
window.viewDevice = viewDevice;
window.editDevice = editDevice;
window.deleteDevice = deleteDevice;
window.viewFullDeviceDetails = viewFullDeviceDetails;
window.deleteArea = deleteArea;
window.deleteAsset = deleteAsset;
window.deleteGroup = deleteGroup;
window.deleteUser = deleteUser;

let deviceStatusFilter = 'all';
let deviceSearchTerm = '';

function getDeviceSearchTerm() {
    const input = document.getElementById('deviceSearchInput');
    if (!input) return '';
    return input.value.trim().toLowerCase();
}

function matchesDeviceSearch(device, term) {
    if (!term) return true;
    const id = (device.id || '').toString().toLowerCase();
    const name = (device.name || '').toString().toLowerCase();
    const location = (device.location || '').toString().toLowerCase();
    const status = (device.status || '').toString().toLowerCase();
    const type = (device.type || '').toString().toLowerCase();
    const imei = (device.imei || '').toString().toLowerCase();
    const lteImei = (device?.lte?.imei || '').toString().toLowerCase();
    return (
        id.includes(term) ||
        name.includes(term) ||
        location.includes(term) ||
        status.includes(term) ||
        type.includes(term) ||
        imei.includes(term) ||
        lteImei.includes(term)
    );
}

function filterDevicesBySearch(devices) {
    if (!Array.isArray(devices)) return [];
    const term = deviceSearchTerm || getDeviceSearchTerm();
    if (!term) return devices;
    return devices.filter(device => matchesDeviceSearch(device, term));
}

function getAnalyticsGroupFilter() {
    const select = document.getElementById('analyticsGroupFilter');
    return select ? select.value : 'all';
}

function filterDevicesByGroup(devices, groupName) {
    if (!Array.isArray(devices)) return [];
    if (!groupName || groupName === 'all') return devices;
    const normalized = groupName.toLowerCase();
    return devices.filter(device => {
        const deviceGroup = (device.group || '').toString().toLowerCase();
        return deviceGroup === normalized;
    });
}

function getAnalyticsFilteredDevices(devices) {
    const groupFilter = getAnalyticsGroupFilter();
    return filterDevicesByGroup(devices, groupFilter);
}

function refreshAnalyticsGroupOptions(groups = null) {
    const select = document.getElementById('analyticsGroupFilter');
    if (!select) return;
    const current = select.value || 'all';
    const list = groups || getGroups();
    const options = ['<option value="all">All groups</option>']
        .concat(list.map(group => `<option value="${group.name}">${group.name}</option>`));
    select.innerHTML = options.join('');
    select.value = list.some(group => group.name === current) ? current : 'all';
}

// Update devices table
function updateDevicesTable(devices) {
    const tableBody = document.getElementById('devicesTableBody');
    if (!tableBody) return;
    const filtered = filterDevicesForStatusTable(devices);

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">No devices match the current filter.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.slice(0, 10).map(device => `
        <tr>
            <td>${device.id}</td>
            <td><span class="status-badge ${device.status}">${device.status}</span></td>
            <td>${device.location || 'Unknown'}</td>
            <td>${device.temperature !== null && device.temperature !== undefined ? device.temperature + '°C' : 'N/A'}</td>
            <td>${formatTime(device.lastUpdate)}</td>
            <td>
                <button class="btn btn-outline btn-small" onclick="viewDevice('${device.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

function filterDevicesForStatusTable(devices) {
    if (!Array.isArray(devices)) return [];
    const searched = filterDevicesBySearch(devices);
    if (deviceStatusFilter === 'all') return searched;

    return searched.filter(device => {
        if (deviceStatusFilter === 'connected') {
            return getConnectionStatus(device).label === 'Connected';
        }
        if (deviceStatusFilter === 'stale') {
            return getConnectionStatus(device).label === 'Stale';
        }
        if (deviceStatusFilter === 'no-gps') {
            return getConnectionStatus(device).label === 'No GPS';
        }
        return device.status === deviceStatusFilter;
    });
}

function applyDeviceStatusFilter() {
    const selection = prompt(
        'Filter devices by status:\n' +
        '- all\n' +
        '- active\n' +
        '- inactive\n' +
        '- warning\n' +
        '- connected\n' +
        '- stale\n' +
        '- no-gps',
        deviceStatusFilter
    );

    if (selection === null) return;
    const value = selection.trim().toLowerCase();
    const allowed = new Set(['all', 'active', 'inactive', 'warning', 'connected', 'stale', 'no-gps']);
    if (!allowed.has(value)) {
        alert('Invalid filter. Try: all, active, inactive, warning, connected, stale, no-gps.');
        return;
    }

    deviceStatusFilter = value;
    loadDashboardData();
}

function exportDeviceStatusTable() {
    const devices = getDevices();
    const filtered = filterDevicesForStatusTable(devices);
    if (!filtered.length) {
        alert('No devices to export for the current filter.');
        return;
    }

    const header = ['Device ID', 'Status', 'Location', 'Temperature', 'Last Update'];
    const rows = filtered.map(device => [
        device.id,
        device.status,
        device.location || 'Unknown',
        device.temperature !== null && device.temperature !== undefined ? `${device.temperature}` : 'N/A',
        formatTime(device.lastUpdate)
    ]);

    const csv = [header, ...rows]
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `device-status-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function getApiAuthHeaders() {
    if (typeof window.getSessionAuthHeaders === 'function') {
        return window.getSessionAuthHeaders();
    }
    const token = localStorage.getItem('cargotrack_session_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function decodeSessionPayload() {
    const token = localStorage.getItem('cargotrack_session_token');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const body = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const pad = body.length % 4 ? '='.repeat(4 - (body.length % 4)) : '';
    try {
        return JSON.parse(atob(body + pad));
    } catch (error) {
        return null;
    }
}

function getPlanTier() {
    const claims = decodeSessionPayload();
    if (claims?.planTier) return claims.planTier;
    const currentUser = safeGetCurrentUser();
    return currentUser?.planTier || currentUser?.package || 'individual';
}

function getPlanCapabilities() {
    const tier = (getPlanTier() || '').toString().toLowerCase();
    const defaults = {
        deviceLimit: 3,
        allowApiKeys: false,
        allowAdvancedAnalytics: false
    };
    if (tier.includes('enterprise')) {
        return { deviceLimit: 1000, allowApiKeys: true, allowAdvancedAnalytics: true };
    }
    if (tier.includes('smb') || tier.includes('pro') || tier.includes('business')) {
        return { deviceLimit: 25, allowApiKeys: false, allowAdvancedAnalytics: true };
    }
    if (tier.includes('reseller')) {
        return { deviceLimit: 10000, allowApiKeys: true, allowAdvancedAnalytics: true };
    }
    return defaults;
}

function getDeviceRegistry() {
    const stored = localStorage.getItem(DEVICE_REGISTRY_KEY);
    if (!stored) return new Set();
    try {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
            return new Set(ids.filter(Boolean));
        }
    } catch (error) {
        console.warn('Failed to parse device registry:', error);
    }
    return new Set();
}

function saveDeviceRegistry(registry) {
    localStorage.setItem(DEVICE_REGISTRY_KEY, JSON.stringify(Array.from(registry)));
}

function registerDeviceIds(ids) {
    if (!Array.isArray(ids)) return;
    const registry = getDeviceRegistry();
    let updated = false;
    ids.forEach((id) => {
        if (id && !registry.has(id)) {
            registry.add(id);
            updated = true;
        }
    });
    if (updated) {
        saveDeviceRegistry(registry);
        syncDeviceRegistryToServer(Array.from(registry));
    }
}

async function syncDeviceRegistryToServer(deviceIds) {
    if (!Array.isArray(deviceIds) || !deviceIds.length) return;
    try {
        await fetch('/api/device-registry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getApiAuthHeaders()
            },
            body: JSON.stringify({ deviceIds })
        });
    } catch (error) {
        console.warn('Device registry sync failed:', error);
    }
}

async function unregisterDeviceIdsOnServer(deviceIds) {
    if (!Array.isArray(deviceIds) || !deviceIds.length) return;
    try {
        await fetch('/api/device-registry', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...getApiAuthHeaders()
            },
            body: JSON.stringify({ deviceIds })
        });
    } catch (error) {
        console.warn('Device registry remove sync failed:', error);
    }
}

function syncDeviceRegistryFromDevices(devices) {
    if (!Array.isArray(devices)) return;
    const registry = new Set();
    devices.forEach((device) => {
        if (device?.id) registry.add(device.id);
        if (device?.lte?.imei) registry.add(device.lte.imei);
    });
    saveDeviceRegistry(registry);
    syncDeviceRegistryToServer(Array.from(registry));
}

function getDeviceIdentity(device) {
    if (!device || typeof device !== 'object') return null;
    const imei = (device?.lte?.imei || '').toString().trim();
    const id = (device?.id || device?.deviceId || '').toString().trim();
    return imei || id || null;
}

function dedupeDevicesByIdentity(devices) {
    if (!Array.isArray(devices)) return [];
    const merged = new Map();
    devices.forEach((device) => {
        const identity = getDeviceIdentity(device);
        if (!identity) return;
        const existing = merged.get(identity);
        if (!existing) {
            merged.set(identity, device);
            return;
        }
        merged.set(identity, {
            ...existing,
            ...device,
            lte: {
                ...(existing.lte || {}),
                ...(device.lte || {})
            },
            tracker: {
                ...(existing.tracker || {}),
                ...(device.tracker || {})
            }
        });
    });
    return Array.from(merged.values());
}

// Data management functions
function getDevices() {
    const devicesKey = 'cargotrack_devices';
    const devices = localStorage.getItem(devicesKey);
    
    if (!devices) {
        localStorage.setItem(devicesKey, JSON.stringify([]));
        return [];
    }
    
    const parsed = JSON.parse(devices);
    const parsedList = Array.isArray(parsed) ? parsed : [];
    const deduped = dedupeDevicesByIdentity(parsedList);
    const filtered = deduped;
    if (filtered.length !== parsedList.length) {
        localStorage.setItem(devicesKey, JSON.stringify(filtered));
    }
    const currentUser = safeGetCurrentUser();
    if (currentUser) {
        let updated = false;
        filtered.forEach((device) => {
            if (device && !device.ownerId) {
                device.ownerId = currentUser.id;
                updated = true;
            }
        });
        if (updated) {
            localStorage.setItem(devicesKey, JSON.stringify(filtered));
        }
    }
    syncDeviceRegistryFromDevices(filtered);
    return filtered;
}

function closeDeviceModal() {
    document.getElementById('deviceModal').classList.remove('active');
}

function closeDeviceFormModal() {
    document.getElementById('deviceFormModal').classList.remove('active');
    document.getElementById('deviceForm').reset();
    const copySource = document.getElementById('logisticsCopySource');
    if (copySource) {
        copySource.innerHTML = '<option value="">Select a source device</option>';
    }
    const currentAreaInput = document.getElementById('logisticsCurrentArea');
    if (currentAreaInput) {
        currentAreaInput.value = '';
    }
    editingDeviceId = null;
    goToStep1(); // Reset to first step
}

function goToStep1() {
    document.getElementById('step1').classList.add('active');
    document.getElementById('step2').classList.remove('active');
}

function goToStep2() {
    // Validate step 1 fields
    const group = document.getElementById('deviceGroup').value.trim();
    const deviceType = document.getElementById('deviceType').value;
    const deviceId = document.getElementById('deviceId').value.trim();
    
    if (!group) {
        alert('Please enter a device group');
        document.getElementById('deviceGroup').focus();
        return;
    }
    
    if (!deviceType) {
        alert('Please select a device type');
        document.getElementById('deviceType').focus();
        return;
    }
    
    if (!deviceId) {
        alert('Please enter a device ID');
        document.getElementById('deviceId').focus();
        return;
    }
    
    // Check if device ID already exists (only for new devices)
    if (!editingDeviceId) {
        const devices = getDevices();
        const existingDevice = devices.find(d => d.id === deviceId);
        if (existingDevice) {
            alert('Device ID already exists. Please use a different ID.');
            document.getElementById('deviceId').focus();
            return;
        }
    }
    
    // Move to step 2
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step2').classList.add('active');
}

function setDeviceTypeSelect(value) {
    const select = document.getElementById('deviceType');
    if (!select) return;
    const options = Array.from(select.options).map(option => option.value);
    const nextValue = options.includes(value) ? value : 'Tracker';
    select.value = nextValue;
}

function populateLogisticsCopySourceOptions(currentDeviceId = null) {
    const select = document.getElementById('logisticsCopySource');
    if (!select) return;
    const devices = getDevices().filter(device => device && device.id && device.id !== currentDeviceId);
    const options = devices.map(device => {
        const imei = (device?.lte?.imei || '').toString().trim();
        const label = `${device.name || device.id}${imei ? ` (${imei})` : ''}`;
        return `<option value="${device.id}">${label}</option>`;
    });
    select.innerHTML = `<option value="">Select a source device</option>${options.join('')}`;
    select.disabled = options.length === 0;
}

function applyCopiedLogisticsRules() {
    const select = document.getElementById('logisticsCopySource');
    if (!select) return;
    const sourceDeviceId = (select.value || '').trim();
    if (!sourceDeviceId) {
        alert('Please select a source device first.');
        return;
    }

    const sourceDevice = getDevices().find(device => device.id === sourceDeviceId);
    if (!sourceDevice) {
        alert('Source device not found. Please refresh and try again.');
        return;
    }

    const logistics = sourceDevice.logistics || {};
    const monitoringEnabledEl = document.getElementById('logisticsMonitoringEnabled');
    if (monitoringEnabledEl) monitoringEnabledEl.checked = logistics.monitoringEnabled !== false;
    const tempMinEl = document.getElementById('logisticsTempMin');
    if (tempMinEl) tempMinEl.value = toFiniteNumber(logistics.tempMin) ?? -10;
    const tempMaxEl = document.getElementById('logisticsTempMax');
    if (tempMaxEl) tempMaxEl.value = toFiniteNumber(logistics.tempMax) ?? 30;
    const humidityMinEl = document.getElementById('logisticsHumidityMin');
    if (humidityMinEl) humidityMinEl.value = toFiniteNumber(logistics.humidityMin) ?? 20;
    const humidityMaxEl = document.getElementById('logisticsHumidityMax');
    if (humidityMaxEl) humidityMaxEl.value = toFiniteNumber(logistics.humidityMax) ?? 80;
    const tiltMaxEl = document.getElementById('logisticsTiltMax');
    if (tiltMaxEl) tiltMaxEl.value = toFiniteNumber(logistics.tiltMax) ?? 30;
    const collisionMaxEl = document.getElementById('logisticsCollisionMaxG');
    if (collisionMaxEl) collisionMaxEl.value = toFiniteNumber(logistics.collisionMaxG) ?? 2.5;
    const deliveryGraceEl = document.getElementById('deliveryGraceMinutes');
    if (deliveryGraceEl) deliveryGraceEl.value = toFiniteNumber(logistics.deliveryGraceMinutes) ?? 30;
    const cooldownEl = document.getElementById('logisticsAlertCooldownMinutes');
    if (cooldownEl) cooldownEl.value = toFiniteNumber(logistics.alertCooldownMinutes) ?? 15;
    const startAreaEl = document.getElementById('logisticsStartAreaId');
    if (startAreaEl) {
        startAreaEl.value = logistics.startAreaId || '';
    }
    const destinationAreaEl = document.getElementById('logisticsDestinationAreaId');
    if (destinationAreaEl) {
        destinationAreaEl.value = logistics.destinationAreaId || '';
    }

    if (typeof showToast === 'function') {
        showToast(`Copied logistics rules from ${sourceDevice.name || sourceDevice.id}.`, 'success');
    }
}

function showDeviceForm(deviceId = null) {
    editingDeviceId = deviceId;
    const form = document.getElementById('deviceForm');
    const formTitle = document.getElementById('deviceFormTitle');
    refreshDeviceAssetOptions();
    
    // Always start at step 1
    goToStep1();
    
    if (deviceId) {
        // Editing existing device
        formTitle.textContent = 'Edit Device';
        const devices = getDevices();
        const device = devices.find(d => d.id === deviceId);
        
        if (device) {
            // Populate step 1 fields
            document.getElementById('deviceGroup').value = device.group || '';
            setDeviceTypeSelect(device.type || 'Tracker');
            document.getElementById('deviceId').value = device.id || '';
            const modelSelect = document.getElementById('deviceModel');
            if (modelSelect) {
                modelSelect.value = device.model || device.lte?.model || '';
            }
            
            // Populate step 2 fields
            document.getElementById('deviceName').value = device.name || '';
            document.getElementById('deviceAsset').value = device.asset || '';
            const locationField = document.getElementById('deviceLocation');
            if (locationField) {
                locationField.value = device?.logistics?.routeNote || device.location || '';
            }
            populateDeviceAreaOptions({
                startAreaId: device?.logistics?.startAreaId || '',
                destinationAreaId: device?.logistics?.destinationAreaId || '',
                device
            });
            const expectedDeliveryField = document.getElementById('expectedDeliveryAt');
            if (expectedDeliveryField) {
                expectedDeliveryField.value = device?.logistics?.expectedDeliveryAt
                    ? toLocalDatetimeValue(new Date(device.logistics.expectedDeliveryAt))
                    : '';
            }
            const deliveryGraceField = document.getElementById('deliveryGraceMinutes');
            if (deliveryGraceField) {
                deliveryGraceField.value = device?.logistics?.deliveryGraceMinutes ?? 30;
            }
            const logisticsEnabledField = document.getElementById('logisticsMonitoringEnabled');
            if (logisticsEnabledField) {
                logisticsEnabledField.checked = device?.logistics?.monitoringEnabled !== false;
            }
            const logisticsTempMinField = document.getElementById('logisticsTempMin');
            if (logisticsTempMinField) {
                logisticsTempMinField.value = device?.logistics?.tempMin ?? -10;
            }
            const logisticsTempMaxField = document.getElementById('logisticsTempMax');
            if (logisticsTempMaxField) {
                logisticsTempMaxField.value = device?.logistics?.tempMax ?? 30;
            }
            const logisticsHumidityMinField = document.getElementById('logisticsHumidityMin');
            if (logisticsHumidityMinField) {
                logisticsHumidityMinField.value = device?.logistics?.humidityMin ?? 20;
            }
            const logisticsHumidityMaxField = document.getElementById('logisticsHumidityMax');
            if (logisticsHumidityMaxField) {
                logisticsHumidityMaxField.value = device?.logistics?.humidityMax ?? 80;
            }
            const logisticsTiltMaxField = document.getElementById('logisticsTiltMax');
            if (logisticsTiltMaxField) {
                logisticsTiltMaxField.value = device?.logistics?.tiltMax ?? 30;
            }
            const logisticsCollisionMaxField = document.getElementById('logisticsCollisionMaxG');
            if (logisticsCollisionMaxField) {
                logisticsCollisionMaxField.value = device?.logistics?.collisionMaxG ?? 2.5;
            }
            const logisticsCooldownField = document.getElementById('logisticsAlertCooldownMinutes');
            if (logisticsCooldownField) {
                logisticsCooldownField.value = device?.logistics?.alertCooldownMinutes ?? 15;
            }
            // Status and runtime telemetry are set from live data
            
            // Set networks
            const networkCheckboxes = form.querySelectorAll('input[name="networks"]');
            networkCheckboxes.forEach(checkbox => {
                checkbox.checked = device.networks && device.networks.includes(checkbox.value);
            });
            
            // Set sensors
            const sensorCheckboxes = form.querySelectorAll('input[name="sensors"]');
            sensorCheckboxes.forEach(checkbox => {
                checkbox.checked = device.sensors && device.sensors.some(s => s.type === checkbox.value);
            });
            
            // Set GPS settings
            if (device.tracker) {
                document.getElementById('gpsStatus').value = device.tracker.gpsStatus || 'Active';
            }

            // Set LTE settings (optional)
            if (device.lte) {
                document.getElementById('lteImei').value = device.lte.imei || '';
                document.getElementById('lteSimIccid').value = device.lte.simIccid || '';
                document.getElementById('lteCarrier').value = device.lte.carrier || '';
                document.getElementById('lteApn').value = device.lte.apn || '';
                document.getElementById('lteDataFormat').value = device.lte.dataFormat || 'json';
                document.getElementById('lteDataLogFrequency').value = device.lte.dataLogFrequency || '5000';
            }
        }
        populateLogisticsCopySourceOptions(deviceId);
    } else {
        // Adding new device
        formTitle.textContent = 'Add New Device';
        form.reset();
        
        // Set defaults for step 2
        setDeviceTypeSelect('Tracker');
        const modelSelect = document.getElementById('deviceModel');
        if (modelSelect) {
            modelSelect.value = '';
        }
        document.getElementById('gpsStatus').value = 'Active';

        const systemSettings = JSON.parse(localStorage.getItem('lte_system_settings') || '{}');
        document.getElementById('lteDataFormat').value = 'json';
        document.getElementById('lteDataLogFrequency').value = 5000;
        if (systemSettings.defaultCarrier) {
            document.getElementById('lteCarrier').value = systemSettings.defaultCarrier;
        }
        if (systemSettings.defaultApn) {
            document.getElementById('lteApn').value = systemSettings.defaultApn;
        }
        const expectedDeliveryField = document.getElementById('expectedDeliveryAt');
        if (expectedDeliveryField) {
            expectedDeliveryField.value = '';
        }
        const locationField = document.getElementById('deviceLocation');
        if (locationField) {
            locationField.value = '';
        }
        populateDeviceAreaOptions();
        const deliveryGraceField = document.getElementById('deliveryGraceMinutes');
        if (deliveryGraceField) {
            deliveryGraceField.value = 30;
        }
        const logisticsEnabledField = document.getElementById('logisticsMonitoringEnabled');
        if (logisticsEnabledField) {
            logisticsEnabledField.checked = true;
        }
        const logisticsTempMinField = document.getElementById('logisticsTempMin');
        if (logisticsTempMinField) {
            logisticsTempMinField.value = -10;
        }
        const logisticsTempMaxField = document.getElementById('logisticsTempMax');
        if (logisticsTempMaxField) {
            logisticsTempMaxField.value = 30;
        }
        const logisticsHumidityMinField = document.getElementById('logisticsHumidityMin');
        if (logisticsHumidityMinField) {
            logisticsHumidityMinField.value = 20;
        }
        const logisticsHumidityMaxField = document.getElementById('logisticsHumidityMax');
        if (logisticsHumidityMaxField) {
            logisticsHumidityMaxField.value = 80;
        }
        const logisticsTiltMaxField = document.getElementById('logisticsTiltMax');
        if (logisticsTiltMaxField) {
            logisticsTiltMaxField.value = 30;
        }
        const logisticsCollisionMaxField = document.getElementById('logisticsCollisionMaxG');
        if (logisticsCollisionMaxField) {
            logisticsCollisionMaxField.value = 2.5;
        }
        const logisticsCooldownField = document.getElementById('logisticsAlertCooldownMinutes');
        if (logisticsCooldownField) {
            logisticsCooldownField.value = 15;
        }
        populateLogisticsCopySourceOptions();
        
        // Check GPS/GNSS and temperature by default
        document.querySelector('input[name="networks"][value="GPS/GNSS"]').checked = true;
        document.querySelector('input[name="sensors"][value="temperature"]').checked = true;
    }
    
    document.getElementById('deviceFormModal').classList.add('active');
}

function saveDeviceFromForm() {
    const form = document.getElementById('deviceForm');
    const formData = new FormData(form);
    const currentUser = safeGetCurrentUser();
    
    // Get step 1 info
    const deviceGroupRaw = formData.get('deviceGroup');
    const deviceGroup = (deviceGroupRaw || '').toString().trim();
    const deviceType = formData.get('deviceType');
    const deviceId = formData.get('deviceId');
    const deviceModel = (formData.get('deviceModel') || '').toString().trim();
    
    // Get step 2 info
    const deviceName = formData.get('deviceName') || deviceId; // Use ID as name if name not provided
    const deviceAsset = (formData.get('deviceAsset') || '').toString().trim();
    
    // Get step 3 info
    const deviceLocation = (formData.get('deviceLocation') || '').toString().trim();
    const logisticsStartAreaIdRaw = (formData.get('logisticsStartAreaId') || '').toString().trim();
    const logisticsDestinationAreaIdRaw = (formData.get('logisticsDestinationAreaId') || '').toString().trim();
    const logisticsStartAreaId = logisticsStartAreaIdRaw || null;
    const logisticsDestinationAreaId = logisticsDestinationAreaIdRaw || null;
    const startArea = logisticsStartAreaId ? getAreaById(logisticsStartAreaId) : null;
    const destinationArea = logisticsDestinationAreaId ? getAreaById(logisticsDestinationAreaId) : null;
    const destinationLocation = destinationArea?.name || '';
    const routeNote = deviceLocation;
    const expectedDeliveryAtRaw = (formData.get('expectedDeliveryAt') || '').toString().trim();
    const deliveryGraceMinutesRaw = (formData.get('deliveryGraceMinutes') || '').toString().trim();
    const logisticsMonitoringEnabled = formData.get('logisticsMonitoringEnabled') !== null;
    const logisticsTempMinRaw = (formData.get('logisticsTempMin') || '').toString().trim();
    const logisticsTempMaxRaw = (formData.get('logisticsTempMax') || '').toString().trim();
    const logisticsHumidityMinRaw = (formData.get('logisticsHumidityMin') || '').toString().trim();
    const logisticsHumidityMaxRaw = (formData.get('logisticsHumidityMax') || '').toString().trim();
    const logisticsTiltMaxRaw = (formData.get('logisticsTiltMax') || '').toString().trim();
    const logisticsCollisionMaxGRaw = (formData.get('logisticsCollisionMaxG') || '').toString().trim();
    const logisticsAlertCooldownMinutesRaw = (formData.get('logisticsAlertCooldownMinutes') || '').toString().trim();
    const deliveryGraceMinutes = deliveryGraceMinutesRaw ? Number(deliveryGraceMinutesRaw) : null;
    const logisticsTempMin = logisticsTempMinRaw ? Number(logisticsTempMinRaw) : null;
    const logisticsTempMax = logisticsTempMaxRaw ? Number(logisticsTempMaxRaw) : null;
    const logisticsHumidityMin = logisticsHumidityMinRaw ? Number(logisticsHumidityMinRaw) : null;
    const logisticsHumidityMax = logisticsHumidityMaxRaw ? Number(logisticsHumidityMaxRaw) : null;
    const logisticsTiltMax = logisticsTiltMaxRaw ? Number(logisticsTiltMaxRaw) : null;
    const logisticsCollisionMaxG = logisticsCollisionMaxGRaw ? Number(logisticsCollisionMaxGRaw) : null;
    const logisticsAlertCooldownMinutes = logisticsAlertCooldownMinutesRaw ? Number(logisticsAlertCooldownMinutesRaw) : null;
    const logisticsSettings = {
        monitoringEnabled: logisticsMonitoringEnabled,
        startAreaId: startArea ? startArea.id : null,
        startAreaName: startArea ? startArea.name : '',
        destinationAreaId: destinationArea ? destinationArea.id : null,
        destinationAreaName: destinationArea ? destinationArea.name : '',
        routeNote: routeNote || '',
        expectedDeliveryAt: expectedDeliveryAtRaw ? new Date(expectedDeliveryAtRaw).toISOString() : null,
        deliveryGraceMinutes: Number.isFinite(deliveryGraceMinutes) ? deliveryGraceMinutes : 30,
        tempMin: Number.isFinite(logisticsTempMin) ? logisticsTempMin : -10,
        tempMax: Number.isFinite(logisticsTempMax) ? logisticsTempMax : 30,
        humidityMin: Number.isFinite(logisticsHumidityMin) ? logisticsHumidityMin : 20,
        humidityMax: Number.isFinite(logisticsHumidityMax) ? logisticsHumidityMax : 80,
        tiltMax: Number.isFinite(logisticsTiltMax) ? logisticsTiltMax : 30,
        collisionMaxG: Number.isFinite(logisticsCollisionMaxG) ? logisticsCollisionMaxG : 2.5,
        alertCooldownMinutes: Number.isFinite(logisticsAlertCooldownMinutes) ? logisticsAlertCooldownMinutes : 15
    };
    
    // Get selected networks
    const selectedNetworks = [];
    form.querySelectorAll('input[name="networks"]:checked').forEach(checkbox => {
        selectedNetworks.push(checkbox.value);
    });
    
    // Get selected sensors
    const selectedSensorTypes = [];
    form.querySelectorAll('input[name="sensors"]:checked').forEach(checkbox => {
        selectedSensorTypes.push(checkbox.value);
    });
    
    // Build sensors array with values
    const sensorDefinitions = {
        'temperature': { name: 'Temperature Sensor', unit: '°C', description: 'Ambient temperature monitoring' },
        'humidity': { name: 'Humidity Sensor', unit: '%', description: 'Relative humidity monitoring' },
        'accelerometer': { name: 'Accelerometer', unit: 'g', description: 'Motion and vibration detection' },
        'gyroscope': { name: 'Gyroscope', unit: '°/s', description: 'Angular velocity measurement' },
        'magnetometer': { name: 'Magnetometer', unit: 'μT', description: 'Magnetic field detection' },
        'pressure': { name: 'Pressure Sensor', unit: 'hPa', description: 'Atmospheric pressure monitoring' },
        'light': { name: 'Light Sensor', unit: 'lux', description: 'Ambient light detection' },
        'proximity': { name: 'Proximity Sensor', unit: 'cm', description: 'Object proximity detection' }
    };
    
    const sensors = selectedSensorTypes.map(type => {
        const def = sensorDefinitions[type];
        return {
            type: type,
            name: def.name,
            unit: def.unit,
            description: def.description,
            value: null
        };
    });
    
    // Get GPS settings
    const gpsStatus = formData.get('gpsStatus');
    let latitude = null;
    let longitude = null;
    let satellites = null;
    let accuracy = null;
    
    // Get device status info
    const deviceStatus = (gpsStatus || '').toLowerCase() === 'active' ? 'active' : 'inactive';

    const lteImei = (formData.get('lteImei') || '').toString().trim();
    const lteSimIccid = (formData.get('lteSimIccid') || '').toString().trim();
    const lteCarrier = (formData.get('lteCarrier') || '').toString().trim();
    const lteApn = (formData.get('lteApn') || '').toString().trim();
    const lteDataFormat = (formData.get('lteDataFormat') || 'json').toString().trim();
    const lteDataLogFrequency = (formData.get('lteDataLogFrequency') || '5000').toString().trim();
    const lteSettings = {
        model: deviceModel,
        imei: lteImei,
        simIccid: lteSimIccid,
        carrier: lteCarrier,
        apn: lteApn,
        dataFormat: lteDataFormat,
        dataLogFrequency: lteDataLogFrequency
    };
    const devices = getDevices();

    if (deviceGroup) {
        const groups = getGroups();
        const exists = groups.some(group => group.name.toLowerCase() === deviceGroup.toLowerCase());
        if (!exists) {
            groups.push({
                id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name: deviceGroup,
                description: '',
                createdAt: new Date().toISOString()
            });
            saveGroups(groups);
            refreshUserGroupOptions(groups);
            refreshDeviceGroupOptions(groups);
            loadGroups();
            if (typeof showToast === 'function') {
                showToast(`Group "${deviceGroup}" created and linked to this device.`, 'success');
            }
        }
    }

    const wasAssetCreated = ensureAssetExists(deviceAsset);
    if (wasAssetCreated) {
        loadAssets();
    }
    
    if (editingDeviceId) {
        // Update existing device
        const deviceIndex = devices.findIndex(d => d.id === editingDeviceId);
        if (deviceIndex !== -1) {
            const existingDevice = devices[deviceIndex];
            latitude = existingDevice.latitude ?? null;
            longitude = existingDevice.longitude ?? null;
            satellites = existingDevice.satellites ?? existingDevice.tracker?.satellites ?? null;
            accuracy = existingDevice.accuracy ?? existingDevice.tracker?.accuracy ?? null;
            devices[deviceIndex] = {
                ...existingDevice,
                id: deviceId, // Allow ID update
                ownerId: existingDevice.ownerId || (currentUser ? currentUser.id : null),
                name: deviceName,
                group: deviceGroup,
                model: deviceModel,
                type: deviceType,
                asset: deviceAsset || '',
                location: destinationLocation || routeNote || 'Unknown',
                status: deviceStatus,
                latitude: latitude,
                longitude: longitude,
                battery: existingDevice.battery ?? null,
                signalStrength: existingDevice.signalStrength ?? null,
                firmware: existingDevice.firmware ?? null,
                uptime: existingDevice.uptime ?? null,
                satellites: satellites,
                accuracy: accuracy,
                networks: selectedNetworks.length > 0 ? selectedNetworks : ['GPS/GNSS'],
                sensors: sensors,
                tracker: {
                    gpsStatus: gpsStatus,
                    satellites: satellites,
                    accuracy: accuracy,
                    lastFix: new Date().toISOString()
                },
                lte: lteSettings,
                logistics: {
                    ...existingDevice.logistics,
                    ...logisticsSettings,
                    currentAreaId: existingDevice?.logistics?.currentAreaId || null,
                    currentAreaName: existingDevice?.logistics?.currentAreaName || ''
                },
            temperature: existingDevice.temperature ?? null,
            humidity: existingDevice.humidity ?? null,
                lastUpdate: existingDevice.lastUpdate || null
            };
        }
    } else {
        // Create new device
        const capabilities = getPlanCapabilities();
        if (devices.length >= capabilities.deviceLimit) {
            alert(`Device limit reached for your plan (${capabilities.deviceLimit}). Please upgrade to add more devices.`);
            return;
        }
        const newDevice = {
            id: deviceId, // Use provided ID
            ownerId: currentUser ? currentUser.id : null,
            name: deviceName,
            group: deviceGroup,
            model: deviceModel,
            type: deviceType,
            asset: deviceAsset || '',
            status: deviceStatus,
            location: destinationLocation || routeNote || 'Unknown',
            latitude: latitude,
            longitude: longitude,
            temperature: null,
            humidity: null,
            battery: null,
            signalStrength: null,
            satellites: satellites,
            accuracy: accuracy,
            firmware: null,
            uptime: null,
            dataTransmitted: null,
            networks: selectedNetworks.length > 0 ? selectedNetworks : ['GPS/GNSS'],
            sensors: sensors,
            tracker: {
                gpsStatus: gpsStatus,
                satellites: satellites,
                accuracy: accuracy,
                lastFix: null
            },
            lte: lteSettings,
            logistics: logisticsSettings,
            lastUpdate: null,
            createdAt: new Date().toISOString()
        };
        
        devices.push(newDevice);
    }
    
    localStorage.setItem('cargotrack_devices', JSON.stringify(devices));
    registerDeviceIds([deviceId, lteImei]);
    closeDeviceFormModal();
    loadDevices();
    loadDashboardData();
    if (typeof fetchLiveLocations === 'function') {
        setTimeout(fetchLiveLocations, 600);
    }

    // Show success message
    alert(editingDeviceId ? 'Device updated successfully!' : 'Device added successfully!');
}

function getAlerts() {
    const alertsKey = 'cargotrack_alerts';
    const alerts = localStorage.getItem(alertsKey);
    
    if (!alerts) {
        localStorage.setItem(alertsKey, JSON.stringify([]));
        return [];
    }
    
    return JSON.parse(alerts);
}

function saveAlerts(alerts) {
    localStorage.setItem('cargotrack_alerts', JSON.stringify(alerts));
}

function getLogisticsMonitoringSettings() {
    const currentUser = safeGetCurrentUser();
    const defaults = {
        mobilePhone: ''
    };
    if (!currentUser || typeof getUserNotificationSettings !== 'function') {
        return defaults;
    }
    const settings = getUserNotificationSettings(currentUser.id) || {};
    return {
        ...defaults,
        ...settings
    };
}

function getLogisticsState() {
    const raw = localStorage.getItem(LOGISTICS_STATE_KEY);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('Failed to parse logistics monitoring state:', error);
        return {};
    }
}

function saveLogisticsState(state) {
    localStorage.setItem(LOGISTICS_STATE_KEY, JSON.stringify(state || {}));
}

function getDeviceLogisticsKey(device) {
    if (!device) return null;
    const imei = (device?.lte?.imei || '').toString().trim();
    const id = (device?.id || '').toString().trim();
    return imei || id || null;
}

function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function getDeviceHumidityTelemetry(device) {
    if (!device) return null;
    const directHumidity = toFiniteNumber(device.humidity);
    if (directHumidity !== null) return directHumidity;

    const trackerHumidity = toFiniteNumber(device?.tracker?.humidity);
    if (trackerHumidity !== null) return trackerHumidity;

    const humiditySensor = Array.isArray(device.sensors)
        ? device.sensors.find(sensor => (sensor?.type || '').toString().toLowerCase() === 'humidity')
        : null;
    return toFiniteNumber(humiditySensor?.value);
}

function pushChannelNotification(storageKey, payload) {
    const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
    items.unshift(payload);
    if (items.length > 500) {
        items.splice(500);
    }
    localStorage.setItem(storageKey, JSON.stringify(items));
}

function dispatchAlertChannels(alertEntry) {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) return;
    const settings = getLogisticsMonitoringSettings();
    if (settings.alertNotifications === false) return;

    if (settings.emailAlerts !== false && typeof sendEmail === 'function' && currentUser.email) {
        sendEmail(
            currentUser.email,
            `[CargoTrack] ${alertEntry.title}`,
            `${alertEntry.message}\n\nSeverity: ${alertEntry.severity}\nTime: ${new Date(alertEntry.timestamp).toLocaleString()}`,
            'logisticsAlert'
        );
    }

    if (settings.smsAlerts) {
        pushChannelNotification(SMS_NOTIFICATIONS_KEY, {
            id: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            to: settings.mobilePhone || currentUser.phone || '',
            message: `[CargoTrack] ${alertEntry.title}: ${alertEntry.message}`,
            severity: alertEntry.severity,
            timestamp: alertEntry.timestamp
        });
    }

    if (settings.pushNotifications !== false) {
        pushChannelNotification(MOBILE_PUSH_NOTIFICATIONS_KEY, {
            id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: alertEntry.title,
            message: alertEntry.message,
            severity: alertEntry.severity,
            timestamp: alertEntry.timestamp
        });

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(alertEntry.title, { body: alertEntry.message });
            } catch (error) {
                // Notification API not available in current browser context.
            }
        }
    }
}

function evaluateDeviceLogisticsConditions(device) {
    const deviceKey = getDeviceLogisticsKey(device);
    if (!deviceKey) return;
    const logistics = device?.logistics || {};
    if (logistics.monitoringEnabled === false) return;
    const settings = getLogisticsMonitoringSettings();

    const now = Date.now();
    const cooldownMinutes = toFiniteNumber(logistics.alertCooldownMinutes) ?? 15;
    const cooldownMs = Math.max(1, Number(cooldownMinutes) || 15) * 60 * 1000;
    const state = getLogisticsState();

    const triggerCondition = ({ key, active, title, message, severity = 'warning', icon = 'fas fa-truck-loading' }) => {
        const stateKey = `${deviceKey}:${key}`;
        const current = state[stateKey] || { active: false, lastAlertAt: 0 };
        if (active && (!current.active || now - Number(current.lastAlertAt || 0) >= cooldownMs)) {
            addAlertEntry({
                title,
                message,
                severity,
                icon,
                skipChannelDispatch: false
            });
            state[stateKey] = { active: true, lastAlertAt: now };
            return;
        }
        if (!active && current.active) {
            state[stateKey] = { active: false, lastAlertAt: Number(current.lastAlertAt || 0) };
            return;
        }
        if (!state[stateKey]) {
            state[stateKey] = { active: false, lastAlertAt: 0 };
        }
    };

    const areas = getAreas();
    const currentArea = getContainingAreaForCoordinates(device.latitude, device.longitude, areas);
    const currentAreaId = currentArea ? currentArea.id : null;
    const currentAreaName = currentArea ? currentArea.name : '';
    const startAreaId = (logistics.startAreaId || '').toString().trim() || null;
    const destinationAreaId = (logistics.destinationAreaId || '').toString().trim() || null;
    const startArea = startAreaId ? areas.find(area => area.id === startAreaId) : null;
    const destinationArea = destinationAreaId ? areas.find(area => area.id === destinationAreaId) : null;

    device.logistics = {
        ...logistics,
        startAreaId: startArea ? startArea.id : null,
        startAreaName: startArea ? startArea.name : (logistics.startAreaName || ''),
        destinationAreaId: destinationArea ? destinationArea.id : null,
        destinationAreaName: destinationArea ? destinationArea.name : (logistics.destinationAreaName || ''),
        currentAreaId,
        currentAreaName
    };

    const routeStateKey = `${deviceKey}:route-progress`;
    const existingRouteState = state[routeStateKey];
    let routeState = existingRouteState && typeof existingRouteState === 'object'
        ? existingRouteState
        : null;
    const routeConfigChanged = routeState
        ? routeState.startAreaId !== startAreaId || routeState.destinationAreaId !== destinationAreaId
        : true;
    if (!routeState || routeConfigChanged) {
        routeState = {
            startAreaId,
            destinationAreaId,
            seenStartArea: Boolean(startAreaId && currentAreaId === startAreaId),
            lastAreaId: currentAreaId,
            initializedAt: now
        };
    } else {
        if (startAreaId && currentAreaId === startAreaId) {
            routeState.seenStartArea = true;
        }
        if (startAreaId && routeState.seenStartArea && routeState.lastAreaId === startAreaId && currentAreaId !== startAreaId) {
            addAlertEntry({
                title: 'Shipment Departed Start Area',
                message: `${device.name || deviceKey} left ${startArea?.name || 'the start area'}.`,
                severity: 'info',
                icon: 'fas fa-truck-moving'
            });
        }
        if (destinationAreaId && routeState.lastAreaId !== destinationAreaId && currentAreaId === destinationAreaId) {
            addAlertEntry({
                title: 'Shipment Arrived at Destination',
                message: `${device.name || deviceKey} arrived at ${destinationArea?.name || 'the destination area'}.`,
                severity: 'success',
                icon: 'fas fa-flag-checkered'
            });
        }
        routeState.lastAreaId = currentAreaId;
    }
    state[routeStateKey] = routeState;

    const temp = toFiniteNumber(device.temperature);
    const humidity = toFiniteNumber(device.humidity);
    const tilt = toFiniteNumber(device.tilt ?? device?.tracker?.tilt);
    const collision = toFiniteNumber(device.collision ?? device?.tracker?.collision);
    const expectedDeliveryAt = device?.logistics?.expectedDeliveryAt || device?.expectedDeliveryAt || null;
    const tempMin = toFiniteNumber(logistics.tempMin) ?? -10;
    const tempMax = toFiniteNumber(logistics.tempMax) ?? 30;
    const humidityMin = toFiniteNumber(logistics.humidityMin) ?? 20;
    const humidityMax = toFiniteNumber(logistics.humidityMax) ?? 80;
    const tiltMax = toFiniteNumber(logistics.tiltMax) ?? 30;
    const collisionMaxG = toFiniteNumber(logistics.collisionMaxG) ?? 2.5;
    const deliveryGraceMinutes = toFiniteNumber(logistics.deliveryGraceMinutes) ?? 30;

    triggerCondition({
        key: 'temp-range',
        active: temp !== null && (temp < tempMin || temp > tempMax),
        title: 'Temperature Out of Range',
        message: `${device.name || deviceKey} temperature is ${temp}°C (allowed ${tempMin}°C to ${tempMax}°C).`,
        severity: 'critical',
        icon: 'fas fa-thermometer-half'
    });

    triggerCondition({
        key: 'humidity-range',
        active: humidity !== null && (humidity < humidityMin || humidity > humidityMax),
        title: 'Humidity Out of Range',
        message: `${device.name || deviceKey} humidity is ${humidity}% (allowed ${humidityMin}% to ${humidityMax}%).`,
        severity: 'warning',
        icon: 'fas fa-tint'
    });

    triggerCondition({
        key: 'tilt-threshold',
        active: tilt !== null && Math.abs(tilt) > tiltMax,
        title: 'Excessive Tilt Detected',
        message: `${device.name || deviceKey} tilt reached ${tilt}° (max ${tiltMax}°).`,
        severity: 'critical',
        icon: 'fas fa-exclamation-triangle'
    });

    triggerCondition({
        key: 'collision-threshold',
        active: collision !== null && Math.abs(collision) > collisionMaxG,
        title: 'Collision / Impact Alert',
        message: `${device.name || deviceKey} impact reached ${collision}g (max ${collisionMaxG}g).`,
        severity: 'critical',
        icon: 'fas fa-car-crash'
    });

    let deliveryDelayActive = false;
    if (expectedDeliveryAt) {
        const expectedTs = new Date(expectedDeliveryAt).getTime();
        if (Number.isFinite(expectedTs)) {
            const graceMs = Math.max(0, Number(deliveryGraceMinutes || 0)) * 60 * 1000;
            deliveryDelayActive = now > expectedTs + graceMs;
        }
    }
    triggerCondition({
        key: 'delivery-delay',
        active: deliveryDelayActive,
        title: 'Delivery Delay Alert',
        message: `${device.name || deviceKey} delivery ETA has been exceeded.`,
        severity: 'warning',
        icon: 'fas fa-clock'
    });

    saveLogisticsState(state);
}

function runLogisticsMonitoringSweep() {
    const devices = getDevices();
    devices.forEach((device) => evaluateDeviceLogisticsConditions(device));
}

function addAlertEntry({ title, message, severity = 'info', icon = 'fas fa-bell', skipChannelDispatch = false }) {
    const alerts = getAlerts();
    const entry = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        message,
        severity,
        icon,
        read: false,
        timestamp: new Date().toISOString()
    };
    alerts.unshift(entry);
    saveAlerts(alerts);
    loadAlerts();
    loadDashboardData();
    if (!skipChannelDispatch) {
        dispatchAlertChannels(entry);
    }
}

function getAreaStateMap() {
    const stored = localStorage.getItem(AREA_STATE_STORAGE_KEY);
    if (!stored) return {};
    try {
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('Failed to parse area state:', error);
        return {};
    }
}

function saveAreaStateMap(state) {
    localStorage.setItem(AREA_STATE_STORAGE_KEY, JSON.stringify(state));
}

function pruneAreaState(areaId) {
    const state = getAreaStateMap();
    const nextState = Object.fromEntries(
        Object.entries(state).filter(([key]) => !key.endsWith(`:${areaId}`))
    );
    saveAreaStateMap(nextState);
}

function getDistanceMeters(a, b) {
    const toRad = value => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return earthRadius * c;
}

function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][1];
        const yi = polygon[i][0];
        const xj = polygon[j][1];
        const yj = polygon[j][0];
        const intersects = yi > point.lat !== yj > point.lat &&
            point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
    }
    return inside;
}

function updateAreaAlerts(device) {
    if (!device || !hasValidCoordinates(device.latitude, device.longitude)) return;
    const areas = getAreas();
    if (areas.length === 0) return;
    const state = getAreaStateMap();
    const deviceKey = device.id || device.deviceId || device.imei;
    if (!deviceKey) return;

    areas.forEach(area => {
        let inside = false;
        if (area.shape === 'polygon' && Array.isArray(area.polygon) && area.polygon.length >= 3) {
            inside = isPointInPolygon(
                { lat: device.latitude, lng: device.longitude },
                area.polygon
            );
        } else if (area.center && area.radiusMeters) {
            const distance = getDistanceMeters(
                { lat: device.latitude, lng: device.longitude },
                area.center
            );
            inside = distance <= area.radiusMeters;
        } else {
            return;
        }
        const stateKey = `${deviceKey}:${area.id}`;
        const previous = state[stateKey];
        if (previous === undefined) {
            state[stateKey] = inside;
            return;
        }
        if (previous !== inside) {
            state[stateKey] = inside;
            addAlertEntry({
                title: inside ? 'Area Entered' : 'Area Left',
                message: `${device.name || deviceKey} ${inside ? 'entered' : 'left'} ${area.name}.`,
                severity: inside ? 'info' : 'warning',
                icon: inside ? 'fas fa-location-arrow' : 'fas fa-route'
            });
        }
    });

    saveAreaStateMap(state);
}

function getRecentActivities() {
    return [];
}

// Utility functions
function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString();
}

function hasValidCoordinates(latitude, longitude) {
    return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function getConnectionStatus(device) {
    const lastUpdate = device.lastUpdate || device.updatedAt || device?.tracker?.lastFix || null;
    if (!lastUpdate) {
        return { label: 'Not connected', className: 'inactive' };
    }
    const lastSeen = new Date(lastUpdate).getTime();
    const isStale = Number.isFinite(lastSeen) && Date.now() - lastSeen > STALE_DEVICE_MS;
    if (isStale) {
        return { label: 'Stale', className: 'warning' };
    }
    if (hasValidCoordinates(device.latitude, device.longitude)) {
        return { label: 'Connected', className: 'active' };
    }
    // Recent data but no GPS yet: show Connected so app reflects tracker is sending
    const recentMs = 5 * 60 * 1000;
    if (Number.isFinite(lastSeen) && Date.now() - lastSeen <= recentMs) {
        return { label: 'Connected', className: 'active' };
    }
    return { label: 'No GPS', className: 'warning' };
}

function getLastSeenText(device) {
    const lastUpdate = device.lastUpdate || device.updatedAt || device?.tracker?.lastFix || null;
    if (!lastUpdate) return 'No data yet';
    return formatTime(lastUpdate);
}

function viewDevice(deviceId) {
    // Switch to devices section and select device
    document.querySelector('[data-section="devices"]').click();
    setTimeout(() => selectDevice(deviceId), 100);
}

function editDevice(deviceId) {
    closeDeviceModal(); // Close details modal if open
    showDeviceForm(deviceId);
}

function deleteDevice(deviceId) {
    const devices = getDevices();
    const device = devices.find(d => d.id === deviceId);

    if (!device) {
        alert('Device not found.');
        return;
    }

    const confirmDelete = confirm(`Delete device "${device.name}" (${device.id})? This cannot be undone.`);
    if (!confirmDelete) {
        return;
    }

    const updatedDevices = devices.filter(d => d.id !== deviceId);
    localStorage.setItem('cargotrack_devices', JSON.stringify(updatedDevices));
    const registry = getDeviceRegistry();
    registry.delete(deviceId);
    if (device.lte?.imei) {
        registry.delete(device.lte.imei);
    }
    saveDeviceRegistry(registry);
    syncDeviceRegistryToServer(Array.from(registry));
    unregisterDeviceIdsOnServer([deviceId, device.lte?.imei].filter(Boolean));

    if (selectedDeviceId === deviceId) {
        selectedDeviceId = null;
        const details = document.getElementById('deviceDetails');
        if (details) {
            details.innerHTML = '<p class="empty-state">Select a device to view details</p>';
        }
        const viewBtn = document.getElementById('viewFullDetailsBtn');
        if (viewBtn) {
            viewBtn.style.display = 'none';
        }
    }

    loadDevices();
    loadDashboardData();
    if (map) {
        updateMap();
    }
    if (globalMap) {
        updateGlobalMap();
    }
}

// Privacy functions (for user dashboard)
function exportMyData() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) {
        alert('Please login to export your data');
        return;
    }
    
    if (confirm('This will download a JSON file containing all your personal data. Continue?')) {
        const data = exportUserData(currentUser.id);
        if (data) {
            alert('Your data has been exported successfully!');
        }
    }
}

function deleteMyAccount() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) {
        alert('Please login to delete your account');
        return;
    }
    
    const confirmText = prompt('Type "DELETE" to confirm permanent account deletion:');
    if (confirmText === 'DELETE') {
        const result = deleteUserData(currentUser.id);
        if (result.success) {
            alert('Your account and all data have been permanently deleted. You will be logged out.');
            logout();
        } else {
            alert(result.message);
        }
    }
}

// Billing & Invoices Functions
function loadUserInvoices() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) return;
    
    // Generate invoices for existing transactions
    if (typeof generateInvoicesForTransactions === 'function') {
        try {
            generateInvoicesForTransactions();
        } catch (error) {
            console.warn('Invoice generation failed:', error);
        }
    }
    
    const userInvoices = getUserInvoices(currentUser.id);
    const invoices = Array.isArray(userInvoices)
        ? [...userInvoices].sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime())
        : [];
    const tableBody = document.getElementById('invoicesTable');
    
    if (!tableBody) return;
    
    if (invoices.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    No invoices found. Invoices will be generated automatically when you make a payment.
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = invoices.map(invoice => `
            <tr>
                <td><strong>${invoice.invoiceNumber}</strong></td>
                <td>${formatDate(invoice.date)}</td>
                <td><span class="status-badge">${getInvoicePackageLabel(invoice)}</span></td>
                <td><strong>$${getInvoiceTotalAmount(invoice).toFixed(2)}</strong></td>
                <td><span class="status-badge ${invoice.status === 'paid' ? 'active' : 'warning'}">${invoice.status}</span></td>
                <td>${invoice.paymentMethod || 'Unknown'}</td>
                <td>
                    <div class="user-actions">
                        <button class="btn-icon-small view" onclick="viewInvoice('${invoice.id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon-small edit" onclick="downloadInvoice('${invoice.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // Update billing summary
    updateBillingSummary(invoices);
    loadPaymentMethods();
}

function getInvoicePackageLabel(invoice) {
    const description = invoice?.items?.[0]?.description;
    if (!description || typeof description !== 'string') {
        return 'Subscription';
    }
    const [label] = description.split(' - ');
    return label || 'Subscription';
}

function getInvoiceTotalAmount(invoice) {
    const total = Number(invoice?.total);
    return Number.isFinite(total) ? total : 0;
}

function updateBillingSummary(invoices) {
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + getInvoiceTotalAmount(inv), 0);
    
    const now = new Date();
    const thisMonthInvoices = paidInvoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
    });
    const monthlyPaid = thisMonthInvoices.reduce((sum, inv) => sum + getInvoiceTotalAmount(inv), 0);
    
    const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + getInvoiceTotalAmount(inv), 0);
    
    document.getElementById('totalPaid').textContent = '$' + totalPaid.toFixed(2);
    document.getElementById('monthlyPaid').textContent = '$' + monthlyPaid.toFixed(2);
    document.getElementById('pendingAmount').textContent = '$' + pendingAmount.toFixed(2);
    document.getElementById('totalInvoices').textContent = invoices.length;
}

function loadPaymentMethods() {
    const methodsList = document.getElementById('paymentMethodsList');
    if (!methodsList) return;
    
    // Get payment methods from transactions
    const currentUser = safeGetCurrentUser();
    if (!currentUser) return;
    
    const invoices = getUserInvoices(currentUser.id);
    const methods = [...new Set(invoices.map(inv => inv.paymentMethod))];
    
    if (methods.length === 0) {
        methodsList.innerHTML = '<p style="color: var(--text-light);">No payment methods on file</p>';
    } else {
        methodsList.innerHTML = methods.map(method => `
            <div class="payment-method-item-small">
                <i class="fas fa-${method === 'Stripe' ? 'credit-card' : (method === 'PayPal' ? 'paypal' : 'university')}"></i>
                <span>${method}</span>
            </div>
        `).join('');
    }
}

function viewInvoice(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) {
        alert('Invoice not found');
        return;
    }
    
    // Open invoice in new window
    const invoiceHTML = createInvoiceHTML(invoice);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
}

function downloadInvoice(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) {
        alert('Invoice not found');
        return;
    }
    
    // Download as PDF (opens print dialog)
    downloadInvoicePDF(invoice);
}

function refreshInvoices() {
    if (typeof generateInvoicesForTransactions === 'function') {
        try {
            generateInvoicesForTransactions();
        } catch (error) {
            console.warn('Invoice refresh generation failed:', error);
        }
    }
    loadUserInvoices();
    if (typeof showToast === 'function') {
        showToast('Invoices refreshed.', 'success');
    } else {
        alert('Invoices refreshed!');
    }
}

// Notification Settings Functions
function loadNotificationSettings() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) return;
    
    const settings = getUserNotificationSettings(currentUser.id);
    
    document.getElementById('emailAlerts').checked = settings.emailAlerts !== false;
    document.getElementById('smsAlerts').checked = settings.smsAlerts || false;
    document.getElementById('pushNotifications').checked = settings.pushNotifications !== false;
    document.getElementById('alertNotifications').checked = settings.alertNotifications !== false;
    document.getElementById('systemNotifications').checked = settings.systemNotifications !== false;
    document.getElementById('paymentThankYou').checked = settings.paymentThankYou !== false;
    document.getElementById('subscriptionReminder').checked = settings.subscriptionReminder !== false;
    const mobilePhoneEl = document.getElementById('mobilePhone');
    if (mobilePhoneEl) mobilePhoneEl.value = settings.mobilePhone || currentUser.phone || '';
}

function saveNotificationSettings() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) {
        alert('Please login to save settings');
        return;
    }
    
    const settings = {
        emailAlerts: document.getElementById('emailAlerts').checked,
        smsAlerts: document.getElementById('smsAlerts').checked,
        pushNotifications: document.getElementById('pushNotifications').checked,
        alertNotifications: document.getElementById('alertNotifications').checked,
        systemNotifications: document.getElementById('systemNotifications').checked,
        paymentThankYou: document.getElementById('paymentThankYou').checked,
        subscriptionReminder: document.getElementById('subscriptionReminder').checked,
        mobilePhone: (document.getElementById('mobilePhone')?.value || '').trim()
    };
    
    saveUserNotificationSettings(currentUser.id, settings);
    if (settings.pushNotifications && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
    alert('Notification preferences saved successfully!');
}

// Support Functions
function openSupportChat() {
    if (window.supportBot) {
        window.supportBot.toggle();
    } else {
        alert('Support chat is loading. Please try again in a moment.');
    }
}

function openEmailSupport() {
    const currentUser = safeGetCurrentUser();
    const email = 'support@cargotrackpro.com';
    const subject = encodeURIComponent('Support Request from ' + (currentUser ? currentUser.email : 'Customer'));
    window.location.href = `mailto:${email}?subject=${subject}`;
}

// Account Settings Functions
function loadAccountSettings() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) return;
    
    const companyInput = document.getElementById('settingsCompany');
    const emailInput = document.getElementById('settingsEmail');
    const phoneInput = document.getElementById('settingsPhone');
    
    if (companyInput) companyInput.value = currentUser.company || '';
    if (emailInput) emailInput.value = currentUser.email || '';
    if (phoneInput) phoneInput.value = currentUser.phone || '';
}

function saveAccountSettings() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) {
        alert('Please login to save settings');
        return;
    }
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex !== -1) {
        users[userIndex].company = document.getElementById('settingsCompany').value;
        users[userIndex].email = document.getElementById('settingsEmail').value;
        users[userIndex].phone = document.getElementById('settingsPhone').value;
        
        saveUsers(users);
        
        // Update current session
        const session = JSON.parse(localStorage.getItem('cargotrack_auth'));
        if (session) {
            session.user = users[userIndex];
            localStorage.setItem('cargotrack_auth', JSON.stringify(session));
        }
        
        alert('Account settings saved successfully!');
    }
}

function submitSupportRequest(e) {
    e.preventDefault();
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Please login to submit a support request');
        return;
    }
    
    const subject = document.getElementById('supportSubject').value;
    const category = document.getElementById('supportCategory').value;
    const message = document.getElementById('supportMessage').value;
    const urgent = document.getElementById('supportUrgent').checked;
    
    // Save support request
    const supportRequestsKey = 'cargotrack_support_requests';
    const requests = JSON.parse(localStorage.getItem(supportRequestsKey)) || [];
    
    const request = {
        id: 'SR-' + Date.now(),
        userId: currentUser.id,
        userEmail: currentUser.email,
        subject: subject,
        category: category,
        message: message,
        urgent: urgent,
        status: 'open',
        createdAt: new Date().toISOString()
    };
    
    requests.unshift(request);
    localStorage.setItem(supportRequestsKey, JSON.stringify(requests));
    
    // Send confirmation email
    if (typeof sendEmail === 'function') {
        sendEmail(
            currentUser.email,
            'Support Request Received - CargoTrack Pro',
            `Dear ${currentUser.company || currentUser.email.split('@')[0]},\n\nWe have received your support request:\n\nSubject: ${subject}\nCategory: ${category}\n\nOur team will review your request and respond within 24 hours.\n\nThank you for contacting CargoTrack Pro support.\n\nBest regards,\nCargoTrack Pro Support Team`,
            'supportRequest'
        );
    }
    
    alert('Support request submitted successfully! We will respond within 24 hours. A confirmation email has been sent.');
    document.getElementById('supportRequestForm').reset();
}

