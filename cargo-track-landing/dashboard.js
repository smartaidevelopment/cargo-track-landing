// Dashboard functionality

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn('localStorage write failed (QuotaExceeded?):', key, e);
    }
}

function showSectionLoading(containerEl) {
    if (!containerEl) return null;
    containerEl.style.position = containerEl.style.position || 'relative';
    let overlay = containerEl.querySelector('.section-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'section-loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div>';
        containerEl.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
    return overlay;
}
function hideSectionLoading(containerEl) {
    if (!containerEl) return;
    const overlay = containerEl.querySelector('.section-loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

let map = null;
let globalMap = null;
let areasMap = null;
let activeFullscreenMap = null;
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
let historyRoutePointMarkers = [];
let historyRouteMapInstance = null;
let historyRequestId = 0;
let mapAutoRefreshInterval = null;
let mapAutoRefreshEnabled = false;
let liveLocationInterval = null;
let initialApiSessionReadyPromise = Promise.resolve(false);
let hasValidatedApiSession = false;
const LIVE_LOCATION_POLL_MS = 5000;
const DASHBOARD_LAYOUT_KEY = 'cargotrack_dashboard_layout_v1';
const STALE_DEVICE_MS = 2 * 60 * 1000;
const AREAS_STORAGE_KEY = 'cargotrack_areas';
const AREA_STATE_STORAGE_KEY = 'cargotrack_area_state';
const ASSETS_STORAGE_KEY = 'cargotrack_assets';
const ASSET_CATEGORY_FILTER_KEY = 'cargotrack_asset_category_filter';
const GROUPS_STORAGE_KEY = 'cargotrack_groups';
const USERS_STORAGE_KEY = 'cargotrack_users';
const DELIVERIES_STORAGE_KEY = 'cargotrack_deliveries';
const DELIVERIES_API_ENDPOINT = '/api/deliveries';
const DELIVERY_HISTORY_API_ENDPOINT = '/api/delivery-history';
const DEVICE_REGISTRY_KEY = 'cargotrack_device_registry';
const LOGISTICS_STATE_KEY = 'cargotrack_logistics_state';
const SMS_NOTIFICATIONS_KEY = 'cargotrack_sms_notifications';
const MOBILE_PUSH_NOTIFICATIONS_KEY = 'cargotrack_mobile_push_notifications';
const ANALYTICS_SAMPLE_INTERVAL_MS = 5 * 60 * 1000;
const ANALYTICS_REFRESH_MS = 2 * 60 * 1000;
const ANALYTICS_SAMPLE_ENDPOINT = '/api/analytics';
const ALERTS_STORAGE_KEY = 'cargotrack_alerts';
const ALERTS_SYNC_ENDPOINT = '/api/events';
const ALERTS_MAX_ENTRIES = 2000;
const LOGISTICS_SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_MAP_LIST_RENDER = 300;
let alertsSyncTimeoutId = null;
let isHydratingAlertsFromServer = false;
let deliveriesSyncTimeoutId = null;
let isHydratingDeliveriesFromServer = false;
const CONFIG_SECTIONS = new Set([
    'devices-management',
    'config-deliveries',
    'config-areas',
    'config-assets',
    'config-groups',
    'config-users'
]);
const INTELLIGENCE_SECTIONS = new Set([
    'risk-overview',
    'compliance-reports',
    'insurance-pricing'
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

function getUserInitials(currentUser) {
    if (!currentUser || typeof currentUser !== 'object') return 'U';
    const source = String(currentUser.nickname || currentUser.company || currentUser.name || currentUser.email || '').trim();
    if (!source) return 'U';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function setAvatarElement(el, currentUser) {
    if (!el) return;
    const avatarUrl = currentUser?.avatarUrl;
    const initials = getUserInitials(currentUser);
    let img = el.querySelector('img');
    if (avatarUrl) {
        if (!img) {
            img = document.createElement('img');
            img.alt = 'Avatar';
            el.appendChild(img);
        }
        img.src = avatarUrl;
        img.style.display = '';
        el.childNodes.forEach(n => { if (n !== img && n.nodeType === Node.TEXT_NODE) n.textContent = ''; });
    } else {
        if (img) img.remove();
        el.textContent = initials;
    }
}

function updateCurrentUserUi(currentUser) {
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    if (userNameEl) {
        userNameEl.textContent = currentUser?.nickname || currentUser?.company || 'User';
    }
    if (userEmailEl) {
        userEmailEl.textContent = currentUser?.email || '';
    }

    const toolbarAccountAvatar = document.getElementById('toolbarAccountAvatar');
    const toolbarAccountBtn = document.getElementById('toolbarAccountBtn');
    setAvatarElement(toolbarAccountAvatar, currentUser);
    if (toolbarAccountBtn) {
        const displayName = currentUser?.nickname || currentUser?.company || currentUser?.email || 'Current account';
        const emailSuffix = currentUser?.email ? ` (${currentUser.email})` : '';
        toolbarAccountBtn.title = `${displayName}${emailSuffix}`;
    }
    const ddAvatar = document.getElementById('accountDropdownAvatar');
    const ddName = document.getElementById('accountDropdownName');
    const ddEmail = document.getElementById('accountDropdownEmail');
    setAvatarElement(ddAvatar, currentUser);
    if (ddName) ddName.textContent = currentUser?.nickname || currentUser?.company || currentUser?.name || 'User';
    if (ddEmail) ddEmail.textContent = currentUser?.email || '';
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
        const expMs = Number(claims.exp) < 1e12 ? Number(claims.exp) * 1000 : Number(claims.exp);
        return expMs > (Date.now() + safetyWindowMs);
    } catch (error) {
        return false;
    }
}

async function ensureApiSessionToken(currentUser, options = {}) {
    try {
        const { forceRefresh = false } = options || {};
        const existingToken = localStorage.getItem('cargotrack_session_token');
        if (!forceRefresh && isSessionTokenValid(existingToken)) return true;
        if (!currentUser || !currentUser.email) {
            return isSessionTokenValid(existingToken);
        }
        if (typeof window.requestSessionToken !== 'function') {
            return isSessionTokenValid(existingToken);
        }
        if (typeof window.getUsers !== 'function') {
            return isSessionTokenValid(existingToken);
        }

        const users = window.getUsers();
        const matching = Array.isArray(users)
            ? users.find((item) => item.email === currentUser.email)
            : null;
        if (!matching || !matching.password) {
            // Keep any still-valid token if local password is unavailable.
            return isSessionTokenValid(existingToken);
        }

        const tokenResult = await window.requestSessionToken('user', matching.email, matching.password);
        if (!tokenResult?.success) {
            // Do not treat refresh failure as fatal if current token is still valid.
            return isSessionTokenValid(existingToken);
        }
        const refreshedToken = localStorage.getItem('cargotrack_session_token');
        return isSessionTokenValid(refreshedToken) || isSessionTokenValid(existingToken);
    } catch (error) {
        console.warn('Failed to ensure API session token:', error);
        const fallbackToken = localStorage.getItem('cargotrack_session_token');
        return isSessionTokenValid(fallbackToken);
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
    // Ensure an API session token exists, but keep valid existing tokens.
    initialApiSessionReadyPromise = ensureApiSessionToken(currentUser, { forceRefresh: false })
        .then((ok) => {
            hasValidatedApiSession = Boolean(ok);
            return ok;
        })
        .catch(() => false);
    if (currentUser) {
        updateCurrentUserUi(currentUser);
    } else {
        // Retry a few times, but not indefinitely
        let retryCount = 0;
        const maxRetries = 5;
        const retryUserInfo = () => {
            retryCount++;
            const currentUser = safeGetCurrentUser();
            if (currentUser) {
                updateCurrentUserUi(currentUser);
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
    if (globalMap) {
        setTimeout(() => globalMap.invalidateSize(), 150);
    }
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

    const toolbarAccountBtn = document.getElementById('toolbarAccountBtn');
    const accountDropdownWrap = document.getElementById('accountDropdownWrap');
    if (toolbarAccountBtn && accountDropdownWrap) {
        toolbarAccountBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = accountDropdownWrap.classList.toggle('is-open');
            toolbarAccountBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        document.addEventListener('click', (e) => {
            if (!accountDropdownWrap.contains(e.target)) {
                accountDropdownWrap.classList.remove('is-open');
                toolbarAccountBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
    const acctSettings = document.getElementById('accountDropdownSettings');
    if (acctSettings) {
        acctSettings.addEventListener('click', () => {
            accountDropdownWrap?.classList.remove('is-open');
            setActiveSection('settings', { updateHash: true });
        });
    }
    const acctBilling = document.getElementById('accountDropdownBilling');
    if (acctBilling) {
        acctBilling.addEventListener('click', () => {
            accountDropdownWrap?.classList.remove('is-open');
            setActiveSection('billing', { updateHash: true });
        });
    }
    
    // Load initial data
    loadDashboardData();
    loadDevices();
    loadAlerts();
    const mainEl = document.querySelector('.main-content');
    showSectionLoading(mainEl);
    initialApiSessionReadyPromise
        .then(() => Promise.allSettled([
            hydrateDeliveriesFromServer(),
            hydrateAlertsFromServer()
        ]))
        .then(() => {
            loadDeliveries();
            loadDashboardData();
            loadDevices();
            loadAlerts();
        })
        .catch(() => {})
        .finally(() => { hideSectionLoading(mainEl); });
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
        const renderAnalytics =
            typeof renderAnalyticsCharts === 'function'
                ? renderAnalyticsCharts
                : (typeof window.renderAnalyticsCharts === 'function' ? window.renderAnalyticsCharts : null);
        if (document.querySelector('#analytics.content-section.active') && renderAnalytics) {
            renderAnalytics();
        }
    };

    window.addEventListener('cargotrack:storage-sync-complete', refreshAfterStorageSync, { once: true });
    if (window.AurionStorageSync?.hasCompletedInitialSync?.()) {
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

    window.addEventListener('beforeunload', () => {
        if (alertsSyncTimeoutId) {
            clearTimeout(alertsSyncTimeoutId);
            alertsSyncTimeoutId = null;
        }
    });

    // Email verification banner
    initEmailVerificationBanner();
});

function initEmailVerificationBanner() {
    const banner = document.getElementById('emailVerifyBanner');
    if (!banner) return;

    const params = new URLSearchParams(window.location.search);
    const verifiedParam = params.get('emailVerified');
    if (verifiedParam === 'true') {
        banner.style.display = 'flex';
        banner.classList.add('success');
        banner.querySelector('.email-verify-banner-content span').textContent = 'Your email has been verified successfully!';
        const resendBtn = document.getElementById('resendVerifyBtn');
        if (resendBtn) resendBtn.style.display = 'none';
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        setTimeout(() => { banner.style.display = 'none'; }, 8000);
        return;
    }
    if (verifiedParam === 'already') {
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        return;
    }

    const checkAndShow = () => {
        const currentUser = safeGetCurrentUser();
        if (!currentUser || !currentUser.email) return;
        const users = getUsers();
        const serverUser = users.find(u => u.email === currentUser.email);
        if (serverUser && serverUser.emailVerified === false) {
            banner.style.display = 'flex';
            banner.classList.remove('success');
        } else {
            banner.style.display = 'none';
        }
    };

    // Check after hydration completes
    initialApiSessionReadyPromise
        .then(() => new Promise(r => setTimeout(r, 1500)))
        .then(checkAndShow)
        .catch(() => {});
    window.addEventListener('cargotrack:storage-sync-complete', () => setTimeout(checkAndShow, 500), { once: true });

    const dismissBtn = document.getElementById('dismissVerifyBanner');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => { banner.style.display = 'none'; });
    }

    const resendBtn = document.getElementById('resendVerifyBtn');
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            resendBtn.disabled = true;
            resendBtn.textContent = 'Sending...';
            try {
                const response = await fetch('/api/resend-verification', {
                    method: 'POST',
                    headers: getApiAuthHeaders()
                });
                const data = await response.json();
                if (data.alreadyVerified) {
                    banner.style.display = 'none';
                    if (typeof showToast === 'function') showToast('Email already verified!', 'success');
                } else if (data.emailSent) {
                    resendBtn.textContent = 'Sent!';
                    if (typeof showToast === 'function') showToast('Verification email sent. Check your inbox.', 'success');
                } else {
                    resendBtn.textContent = 'Resend email';
                    if (typeof showToast === 'function') showToast(data.reason || 'Could not send email.', 'warning');
                }
            } catch (err) {
                resendBtn.textContent = 'Resend email';
                if (typeof showToast === 'function') showToast('Failed to send. Try again later.', 'error');
            } finally {
                setTimeout(() => { resendBtn.disabled = false; resendBtn.textContent = 'Resend email'; }, 5000);
            }
        });
    }
}

// Navigation
function setActiveSection(targetSection, options = {}) {
    const updateHash = options.updateHash !== false;
    const requestedSectionId = (targetSection || '').replace('#', '').trim();
    const sectionId = requestedSectionId === 'privacy' ? 'settings' : requestedSectionId;
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
        'config-deliveries': 'Deliveries',
        'config-areas': 'Areas',
        'config-assets': 'Assets',
        'config-groups': 'Groups',
        'config-users': 'Users',
                'billing': 'Billing & Invoices',
                'settings': 'Settings',
        'risk-overview': 'Risk Overview',
        'compliance-reports': 'Compliance',
        'insurance-pricing': 'Insurance'
            };
    const titleIcons = {
        'dashboard': 'fa-home',
        'devices': 'fa-map-marked-alt',
        'alerts': 'fa-bell',
        'analytics': 'fa-chart-line',
        'devices-management': 'fa-microchip',
        'config-deliveries': 'fa-calendar-check',
        'config-areas': 'fa-draw-polygon',
        'config-assets': 'fa-boxes',
        'config-groups': 'fa-layer-group',
        'config-users': 'fa-users',
        'billing': 'fa-file-invoice-dollar',
        'settings': 'fa-user-cog',
        'risk-overview': 'fa-shield-halved',
        'compliance-reports': 'fa-file-circle-check',
        'insurance-pricing': 'fa-hand-holding-dollar'
    };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = titles[sectionId] || 'Dashboard';
    }
    const globalTitle = document.getElementById('globalToolbarTitle');
    if (globalTitle) {
        const icon = titleIcons[sectionId] || 'fa-home';
        const label = titles[sectionId] || 'Dashboard';
        globalTitle.innerHTML = '<i class="fas ' + icon + '"></i> ' + label;
    }
    const dashActions = document.querySelector('.global-toolbar-dashboard-actions');
    if (dashActions) {
        dashActions.style.display = sectionId === 'dashboard' ? '' : 'none';
    }
            
    if (sectionId === 'dashboard' && globalMap) {
        setTimeout(() => globalMap.invalidateSize(), 50);
    }
    if (sectionId === 'devices') {
        if (!map) {
            initMap();
        }
        if (map) {
            setTimeout(() => map.invalidateSize(), 50);
        }
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
    if (sectionId === 'config-deliveries') {
        hydrateDeliveriesFromServer().then(() => loadDeliveries()).catch(() => {});
        refreshDeliveryDeviceOptions();
        refreshDeliveryAreaOptions();
        loadDeliveries();
    }
    if (sectionId === 'billing') {
                loadUserInvoices();
            }
    if (sectionId === 'settings') {
                loadAccountSettings();
                loadNotificationSettings();
            }
    if (sectionId === 'risk-overview') {
        refreshRiskData(false);
    }
    if (sectionId === 'compliance-reports') {
        initComplianceDateDefaults();
    }
    if (sectionId === 'insurance-pricing') {
        refreshInsuranceData();
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

    const intelGroup = document.getElementById('intelligenceNavGroup');
    const intelToggle = document.querySelector('.nav-item-toggle[data-toggle="intelligence-menu"]');
    if (intelGroup) {
        const shouldOpen = INTELLIGENCE_SECTIONS.has(sectionId);
        intelGroup.classList.toggle('is-open', shouldOpen);
        if (intelToggle) {
            intelToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
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
    const configMenu = document.getElementById('config-menu');

    const syncConfigSubmenuPosition = () => {
        if (!configToggle || !configMenu) return;
        const toggleRect = configToggle.getBoundingClientRect();
        configMenu.style.setProperty('--config-submenu-top', `${Math.round(toggleRect.top)}px`);
    };

    if (configToggle && configGroup) {
        configToggle.addEventListener('click', (e) => {
            e.preventDefault();
            syncConfigSubmenuPosition();
            const isOpen = configGroup.classList.toggle('is-open');
            configToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        document.addEventListener('click', (event) => {
            if (!configGroup.contains(event.target)) {
                configGroup.classList.remove('is-open');
                configToggle.setAttribute('aria-expanded', 'false');
            }
        });

        window.addEventListener('resize', syncConfigSubmenuPosition);
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (sidebarNav) {
            sidebarNav.addEventListener('scroll', syncConfigSubmenuPosition, { passive: true });
        }
        syncConfigSubmenuPosition();
    }

    // Intelligence nav group toggle
    const intelToggle = document.querySelector('.nav-item-toggle[data-toggle="intelligence-menu"]');
    const intelGroup = document.getElementById('intelligenceNavGroup');
    const intelMenu = document.getElementById('intelligence-menu');

    const syncIntelSubmenuPosition = () => {
        if (!intelToggle || !intelMenu) return;
        const toggleRect = intelToggle.getBoundingClientRect();
        intelMenu.style.setProperty('--config-submenu-top', `${Math.round(toggleRect.top)}px`);
    };

    if (intelToggle && intelGroup) {
        intelToggle.addEventListener('click', (e) => {
            e.preventDefault();
            syncIntelSubmenuPosition();
            const isOpen = intelGroup.classList.toggle('is-open');
            intelToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        document.addEventListener('click', (event) => {
            if (!intelGroup.contains(event.target)) {
                intelGroup.classList.remove('is-open');
                intelToggle.setAttribute('aria-expanded', 'false');
            }
        });

        window.addEventListener('resize', syncIntelSubmenuPosition);
        const sidebarNavEl = document.querySelector('.sidebar-nav');
        if (sidebarNavEl) {
            sidebarNavEl.addEventListener('scroll', syncIntelSubmenuPosition, { passive: true });
        }
        syncIntelSubmenuPosition();
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

    const dashboardHomeSearch = document.getElementById('dashboardHomeSearch');
    if (dashboardHomeSearch && searchInput) {
        dashboardHomeSearch.addEventListener('input', () => {
            searchInput.value = dashboardHomeSearch.value;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    const viewDelayReportBtn = document.getElementById('viewDelayReportBtn');
    if (viewDelayReportBtn) {
        viewDelayReportBtn.addEventListener('click', () => {
            setActiveSection('analytics', { updateHash: true });
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
    safeSetItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(order));
}

// Load dashboard data
function loadDashboardData() {
    const devices = applyDeliveryPlansToDevices(getDevices());
    const alerts = getAlerts();
    const activeDevices = devices.filter(device => (device.status || '').toLowerCase() === 'active');
    const deliveries = getDeliveries();
    const plannedDeliveries = deliveries.filter((delivery) => normalizeDeliveryStatus(delivery.status) === 'planned');
    const activeDeliveries = deliveries.filter((delivery) => normalizeDeliveryStatus(delivery.status) === 'in_transit');
    const unreadAlerts = alerts.filter((alert) => !alert.read);
    
    // Update stats
    const totalDevicesEl = document.getElementById('totalDevices');
    if (totalDevicesEl) totalDevicesEl.textContent = activeDevices.length;
    const activeShipmentsEl = document.getElementById('activeShipments');
    if (activeShipmentsEl) activeShipmentsEl.textContent = String(activeDeliveries.length);
    const activeAlertsEl = document.getElementById('activeAlerts');
    if (activeAlertsEl) activeAlertsEl.textContent = String(unreadAlerts.length);
    const completedShipmentsEl = document.getElementById('completedShipments');
    if (completedShipmentsEl) {
        completedShipmentsEl.textContent = String(deliveries.filter(d => isDeliveryCompleted(d)).length);
    }
    const plannedDeliveriesEl = document.getElementById('plannedDeliveriesStat');
    if (plannedDeliveriesEl) {
        plannedDeliveriesEl.textContent = String(plannedDeliveries.length);
    }
    const devicesKpiSubtext = document.getElementById('devicesKpiSubtext');
    if (devicesKpiSubtext) {
        devicesKpiSubtext.textContent = 'Active';
    }
    const shipmentsKpiSubtext = document.getElementById('shipmentsKpiSubtext');
    if (shipmentsKpiSubtext) {
        shipmentsKpiSubtext.textContent = 'In Transit';
    }
    const plannedKpiSubtext = document.getElementById('plannedKpiSubtext');
    if (plannedKpiSubtext) {
        plannedKpiSubtext.textContent = 'Upcoming';
    }
    const alertsKpiSubtext = document.getElementById('alertsKpiSubtext');
    if (alertsKpiSubtext) {
        alertsKpiSubtext.textContent = 'Unread';
    }
    updateDelayReportWidget(deliveries);
    
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
    if (liveLocationInterval) {
        clearInterval(liveLocationInterval);
    }
    fetchLiveLocations();
    liveLocationInterval = setInterval(fetchLiveLocations, LIVE_LOCATION_POLL_MS);
}

async function fetchLiveLocations() {
    try {
        await initialApiSessionReadyPromise;
        const currentUser = safeGetCurrentUser();
        const registryIds = Array.from(getDeviceRegistry());
        const devices = getDevices();
        const knownIds = new Set();
        devices.forEach((device) => {
            getIdLookupVariants(device?.id).forEach((id) => knownIds.add(id));
            getIdLookupVariants(device?.lte?.imei).forEach((id) => knownIds.add(id));
        });
        const staleCandidateIds = new Set();
        devices.forEach((device) => {
            const best = getMostRecentDeviceTimestamp(device);
            const threshold = getDeviceStaleThresholdMs(device);
            const isStaleOrUnknown = !best || (Date.now() - best.ms > threshold);
            if (!isStaleOrUnknown) return;
            getIdLookupVariants(device?.id).forEach((id) => staleCandidateIds.add(id));
            getIdLookupVariants(device?.deviceId).forEach((id) => staleCandidateIds.add(id));
            getIdLookupVariants(device?.lte?.imei).forEach((id) => staleCandidateIds.add(id));
            getIdLookupVariants(device?.imei).forEach((id) => staleCandidateIds.add(id));
        });
        registryIds.forEach((id) => knownIds.add(id));
        const idsList = Array.from(knownIds).filter(Boolean);
        const idsQuery = idsList.join(',');
        const authEndpoint = idsQuery && idsQuery.length < 1800
            ? `/api/locations?ids=${encodeURIComponent(idsQuery)}`
            : '/api/locations';

        const fetchPublicIdsFallback = async () => {
            const fallbackPool = staleCandidateIds.size
                ? Array.from(staleCandidateIds)
                : [];
            if (!fallbackPool.length) return false;
            const fallbackIds = fallbackPool.slice(0, 50);
            if (!fallbackIds.length) return false;
            const fallbackEndpoint = `/api/locations?ids=${encodeURIComponent(fallbackIds.join(','))}`;
            const fallbackResponse = await fetch(fallbackEndpoint, { cache: 'no-store' });
            if (!fallbackResponse.ok) return false;
            const fallbackData = await fallbackResponse.json();
            if (!fallbackData || !Array.isArray(fallbackData.devices) || fallbackData.devices.length === 0) return false;
            mergeLiveLocations(fallbackData.devices);
            return true;
        };

        if (!hasValidatedApiSession) {
            const refreshedAtPollStart = await ensureApiSessionToken(currentUser, { forceRefresh: true });
            if (!refreshedAtPollStart) {
                await fetchPublicIdsFallback();
                return;
            }
            hasValidatedApiSession = true;
        }
        const hasSession = await ensureApiSessionToken(currentUser);
        if (!hasSession) {
            hasValidatedApiSession = false;
            await fetchPublicIdsFallback();
            return;
        }
        // Avoid oversized query strings that can be dropped by proxies/CDN.
        const response = await fetch(authEndpoint, {
            cache: 'no-store',
            headers: getApiAuthHeaders()
        });
        if (response.status === 401) {
            const refreshed = await ensureApiSessionToken(currentUser, { forceRefresh: true });
            if (!refreshed) {
                hasValidatedApiSession = false;
                await fetchPublicIdsFallback();
                return;
            }
            hasValidatedApiSession = true;
            const retryResponse = await fetch(authEndpoint, {
                cache: 'no-store',
                headers: getApiAuthHeaders()
            });
            if (!retryResponse.ok) {
                await fetchPublicIdsFallback();
                return;
            }
            const retryData = await retryResponse.json();
            if (!retryData || !Array.isArray(retryData.devices)) {
                await fetchPublicIdsFallback();
                return;
            }
            mergeLiveLocations(retryData.devices);
            if (retryData.devices.length === 0) {
                await fetchPublicIdsFallback();
            }
            return;
        }
        if (!response.ok) {
            await fetchPublicIdsFallback();
            return;
        }
        const data = await response.json();
        if (!data || !Array.isArray(data.devices)) {
            await fetchPublicIdsFallback();
            return;
        }
        mergeLiveLocations(data.devices);
        // Fallback: if scoped-id query returns nothing, request tenant-scoped latest data
        // without ids to recover from temporary registry/query mismatches.
        if (idsQuery && data.devices.length === 0) {
            const fallbackResponse = await fetch('/api/locations', {
                cache: 'no-store',
                headers: getApiAuthHeaders()
            });
            if (!fallbackResponse.ok) return;
            const fallbackData = await fallbackResponse.json();
            if (!fallbackData || !Array.isArray(fallbackData.devices)) return;
            mergeLiveLocations(fallbackData.devices);
            if (fallbackData.devices.length === 0) {
                await fetchPublicIdsFallback();
            }
        }
    } catch (error) {
        console.warn('Live location fetch failed:', error);
    }
}

function normalizeLivePayload(live) {
    const latitude = live.latitude ?? live.lat;
    const longitude = live.longitude ?? live.lng;
    const rawDeviceId = live.deviceId || live.id || live.imei;
    const normalizedDeviceId = rawDeviceId !== undefined && rawDeviceId !== null
        ? String(rawDeviceId).trim()
        : '';
    return {
        deviceId: normalizedDeviceId || null,
        imei: normalizeImeiLike(live.imei || normalizedDeviceId),
        latitude: Number.isFinite(parseFloat(latitude)) ? parseFloat(latitude) : null,
        longitude: Number.isFinite(parseFloat(longitude)) ? parseFloat(longitude) : null,
        temperature: live.temperature ?? null,
        humidity: live.humidity ?? null,
        collision: live.collision ?? live.collisionG ?? live.impact ?? null,
        tilt: live.tilt ?? live.tiltAngle ?? null,
        battery: live.battery ?? null,
        rssi: live.rssi ?? null,
        speed: live.speed ?? null,
        heading: live.heading ?? live.course ?? live.bearing ?? null,
        accuracy: live.accuracy ?? null,
        satellites: live.satellites ?? null,
        timestamp: live.updatedAt || live.timestamp || live.receivedAt || new Date().toISOString()
    };
}

function getMostRecentDeviceTimestamp(device) {
    const candidates = [
        { key: 'lastUpdate', value: device?.lastUpdate },
        { key: 'updatedAt', value: device?.updatedAt },
        { key: 'tracker.lastFix', value: device?.tracker?.lastFix }
    ];
    let best = null;
    candidates.forEach((candidate) => {
        const ms = parseTimestampToMs(candidate.value);
        if (!Number.isFinite(ms)) return;
        if (!best || ms > best.ms) {
            best = { ms, raw: candidate.value, key: candidate.key };
        }
    });
    return best;
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
    const deviceIndex = new Map();
    devices.forEach((device) => {
        getIdLookupVariants(device?.id).forEach((id) => deviceIndex.set(id, device));
        getIdLookupVariants(device?.lte?.imei).forEach((id) => deviceIndex.set(id, device));
    });
    let hasUpdates = false;

    liveDevices.forEach(live => {
        const normalized = normalizeLivePayload(live);
        if (!normalized.deviceId) return;

        const incomingLookupIds = new Set([
            ...getIdLookupVariants(normalized.deviceId),
            ...getIdLookupVariants(normalized.imei)
        ]);
        let device = null;
        for (const lookupId of incomingLookupIds) {
            device = deviceIndex.get(lookupId);
            if (device) break;
        }
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
                    imei: normalized.imei || normalizeImeiLike(normalized.deviceId) || normalized.deviceId
                },
                createdAt: new Date().toISOString()
            };
            devices.push(device);
            getIdLookupVariants(device.id).forEach((id) => deviceIndex.set(id, device));
            getIdLookupVariants(device?.lte?.imei).forEach((id) => deviceIndex.set(id, device));
            registerDeviceIds([normalized.deviceId, normalized.imei]);
        }
        if (!device.lte) {
            device.lte = { imei: normalized.imei || normalizeImeiLike(normalized.deviceId) || normalized.deviceId };
        } else if (!device.lte.imei) {
            device.lte.imei = normalized.imei || normalizeImeiLike(normalized.deviceId) || normalized.deviceId;
        }

        // Guard against alias duplicates returning out of order from API.
        // Never let an older payload overwrite a newer device snapshot.
        const incomingTs = parseTimestampToMs(normalized.timestamp);
        const existingTsMeta = getMostRecentDeviceTimestamp(device);
        const existingTs = existingTsMeta && Number.isFinite(existingTsMeta.ms) ? existingTsMeta.ms : null;
        if (Number.isFinite(incomingTs) && Number.isFinite(existingTs) && incomingTs < existingTs) {
            return;
        }

        const hasCoordinates = hasValidCoordinates(normalized.latitude, normalized.longitude);
        if (hasCoordinates) {
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
        if (normalized.speed !== null && normalized.speed !== undefined) {
            device.speed = normalized.speed;
        }
        if (normalized.heading !== null && normalized.heading !== undefined) {
            device.heading = normalized.heading;
        }

        device.lastUpdate = normalized.timestamp;
        device.updatedAt = normalized.timestamp;
        device.status = hasCoordinates ? 'active' : 'warning';

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
        if (normalized.speed !== null && normalized.speed !== undefined) {
            device.tracker.speed = normalized.speed;
        }
        if (normalized.heading !== null && normalized.heading !== undefined) {
            device.tracker.heading = normalized.heading;
        }

        updateAreaAlerts(device);
        evaluateDeviceLogisticsConditions(device);
        appendRoutePointToActiveDelivery(device, normalized.timestamp);
        hasUpdates = true;
    });

    if (hasUpdates) {
        safeSetItem('cargotrack_devices', JSON.stringify(devices));
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
            attribution: ''
        }),
        'Streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: ''
        }),
        'Topography': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: ''
        })
    };
}

function normalizeMapLayersForBounds(layers) {
    if (!Array.isArray(layers)) return [];
    return layers.filter(layer => {
        if (!layer) return false;
        if (typeof layer.getLatLng === 'function') return true;
        if (typeof layer.getBounds === 'function') {
            const bounds = layer.getBounds();
            return Boolean(bounds && typeof bounds.isValid === 'function' && bounds.isValid());
        }
        return false;
    });
}

function centerMapToContent(mapInstance, options = {}) {
    if (!mapInstance) return;

    const layers = normalizeMapLayersForBounds(
        typeof options.getFitLayers === 'function' ? options.getFitLayers() : []
    );

    if (layers.length > 0) {
        const group = L.featureGroup(layers);
        const bounds = group.getBounds();
        if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
            mapInstance.fitBounds(bounds.pad(0.1));
            return;
        }
    }

    const fallback = options.defaultView || { center: [20, 0], zoom: 2 };
    mapInstance.setView(fallback.center, fallback.zoom);
}

function setMapFullscreen(mapInstance, fullscreen, toggleButton = null) {
    if (!mapInstance) return;
    const container = mapInstance.getContainer();
    if (!container) return;

    if (fullscreen) {
        if (activeFullscreenMap && activeFullscreenMap !== mapInstance) {
            setMapFullscreen(activeFullscreenMap, false);
        }
        container.classList.add('aurion-map-fullscreen');
        document.body.classList.add('map-fullscreen-active');
        activeFullscreenMap = mapInstance;
    } else {
        container.classList.remove('aurion-map-fullscreen');
        if (activeFullscreenMap === mapInstance) {
            activeFullscreenMap = null;
        }
        if (!activeFullscreenMap) {
            document.body.classList.remove('map-fullscreen-active');
        }
    }

    if (toggleButton) {
        toggleButton.innerHTML = fullscreen ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>';
        toggleButton.setAttribute('aria-label', fullscreen ? 'Exit full size map' : 'Open full size map');
        toggleButton.title = fullscreen ? 'Exit full size' : 'Full size';
    }

    setTimeout(() => mapInstance.invalidateSize(), 80);
}

function attachMapControls(mapInstance, options = {}) {
    if (!mapInstance || mapInstance._cargoTrackControlsAttached) return;

    const control = L.control({ position: options.position || 'topleft' });
    control.onAdd = function () {
        const container = L.DomUtil.create('div', 'leaflet-bar aurion-map-controls');

        const centerButton = L.DomUtil.create('a', 'aurion-map-control-btn', container);
        centerButton.href = '#';
        centerButton.innerHTML = '<i class="fas fa-crosshairs"></i>';
        centerButton.setAttribute('aria-label', 'Center map');
        centerButton.title = 'Center map';

        const fullscreenButton = L.DomUtil.create('a', 'aurion-map-control-btn', container);
        fullscreenButton.href = '#';
        fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
        fullscreenButton.setAttribute('aria-label', 'Open full size map');
        fullscreenButton.title = 'Full size';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        L.DomEvent.on(centerButton, 'click', function (event) {
            L.DomEvent.preventDefault(event);
            centerMapToContent(mapInstance, options);
        });

        L.DomEvent.on(fullscreenButton, 'click', function (event) {
            L.DomEvent.preventDefault(event);
            const open = !mapInstance.getContainer().classList.contains('aurion-map-fullscreen');
            setMapFullscreen(mapInstance, open, fullscreenButton);
        });

        return container;
    };

    control.addTo(mapInstance);
    mapInstance._cargoTrackControlsAttached = true;
}

function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || map) return;
    
    map = L.map('map', {
        attributionControl: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false
    }).setView([40.7128, -74.0060], 2);
    const baseLayers = createMapBaseLayers();
    baseLayers.Basic.addTo(map);
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);
    mapAreasLayerGroup = L.layerGroup().addTo(map);
    attachMapControls(map, {
        defaultView: { center: [40.7128, -74.0060], zoom: 2 },
        getFitLayers: () => [...deviceMarkers, ...(mapAreasLayerGroup ? mapAreasLayerGroup.getLayers() : [])]
    });
    
    updateMap();
}

// Global Map for Dashboard
function initGlobalMap() {
    const globalMapElement = document.getElementById('globalMap');
    if (!globalMapElement) return;
    
    // Initialize global map
    globalMap = L.map('globalMap', {
        attributionControl: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false
    }).setView([20, 0], 2);
    const baseLayers = createMapBaseLayers();
    baseLayers.Basic.addTo(globalMap);
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(globalMap);
    globalAreasLayerGroup = L.layerGroup().addTo(globalMap);
    attachMapControls(globalMap, {
        defaultView: { center: [20, 0], zoom: 2 },
        getFitLayers: () => {
            const areaLayers = globalAreasLayerGroup ? globalAreasLayerGroup.getLayers() : [];
            const routeLayers = historyRouteLayer
                ? [historyRouteLayer, ...historyRouteMarkers, ...historyRoutePointMarkers]
                : [...historyRouteMarkers, ...historyRoutePointMarkers];
            return [...globalDeviceMarkers, ...areaLayers, ...routeLayers];
        }
    });
    
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
    
    const devices = applyDeliveryPlansToDevices(getDevicesFn());
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
            const plannedDelivery = device.plannedDelivery || null;
            const plannedInfo = plannedDelivery
                ? `<strong>Delivery:</strong> ${plannedDelivery.reference || 'Planned'}<br>
                   <strong>Destination:</strong> ${plannedDelivery.dropoffAreaName || 'N/A'}<br>
                   <strong>Schedule:</strong> ${plannedDelivery.plannedArrivalAt ? formatTime(plannedDelivery.plannedArrivalAt) : 'N/A'}<br>`
                : '';
            
            const marker = L.marker([device.latitude, device.longitude], { icon: customIcon })
                .addTo(globalMap)
                .bindPopup(`
                    <div style="min-width: 200px;">
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">${device.name || 'Device ' + device.id}</h3>
                        <div style="margin-bottom: 0.5rem;">
                            <span class="status-badge ${device.status}">${device.status || 'unknown'}</span>
                        </div>
                        ${sensorInfo}
                        ${plannedInfo}
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
    if (!Array.isArray(points)) return;
    const devicesSectionActive = Boolean(document.querySelector('#devices.content-section.active'));
    const targetMap = (devicesSectionActive && map)
        ? map
        : (globalMap || map);
    if (!targetMap) return;
    clearHistoryRoute();
    const latLngs = points
        .map(point => [Number(point?.latitude), Number(point?.longitude)])
        .filter(coords => hasValidCoordinates(coords[0], coords[1]));
    if (latLngs.length === 0) {
        setHistoryStatus('No valid coordinates in history.', 'error');
        return;
    }

    historyRouteLayer = L.polyline(latLngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.9
    }).addTo(targetMap);
    historyRouteMapInstance = targetMap;

    const startMarker = L.circleMarker(latLngs[0], {
        radius: 6,
        color: '#16a34a',
        fillColor: '#16a34a',
        fillOpacity: 0.9
    }).addTo(targetMap);
    const endMarker = L.circleMarker(latLngs[latLngs.length - 1], {
        radius: 6,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.9
    }).addTo(targetMap);
    historyRouteMarkers = [startMarker, endMarker];

    // Show sampled intermediate points so long trips are visible as location marks.
    historyRoutePointMarkers = [];
    if (latLngs.length > 2) {
        const maxIntermediateMarkers = 250;
        const step = Math.max(1, Math.ceil((latLngs.length - 2) / maxIntermediateMarkers));
        for (let i = 1; i < latLngs.length - 1; i += step) {
            const marker = L.circleMarker(latLngs[i], {
                radius: 2,
                color: '#60a5fa',
                fillColor: '#60a5fa',
                fillOpacity: 0.7,
                weight: 1
            }).addTo(targetMap);
            historyRoutePointMarkers.push(marker);
        }
    }

    if (typeof targetMap.invalidateSize === 'function') {
        setTimeout(() => targetMap.invalidateSize(), 0);
    }
    targetMap.fitBounds(historyRouteLayer.getBounds().pad(0.2));
}

function normalizeRoutePoints(points) {
    if (!Array.isArray(points)) return [];
    const normalized = points
        .map((point) => {
            const latitude = Number(
                point?.latitude
                ?? point?.lat
                ?? point?.location?.lat
                ?? point?.location?.latitude
                ?? point?.gps?.lat
                ?? point?.gps?.latitude
            );
            const longitude = Number(
                point?.longitude
                ?? point?.lng
                ?? point?.lon
                ?? point?.location?.lng
                ?? point?.location?.longitude
                ?? point?.gps?.lng
                ?? point?.gps?.longitude
            );
            const timestamp = point?.timestamp || point?.recordedAt || point?.updatedAt || point?.ts || null;
            return { latitude, longitude, timestamp };
        })
        .filter((point) => hasValidCoordinates(point.latitude, point.longitude));

    normalized.sort((a, b) => {
        const aTs = parseTimestampToMs(a.timestamp) || 0;
        const bTs = parseTimestampToMs(b.timestamp) || 0;
        return aTs - bTs;
    });
    return normalized;
}

function mergeRoutePoints(primaryPoints, secondaryPoints) {
    const merged = [];
    const seen = new Set();
    const addPoint = (point) => {
        if (!point || !hasValidCoordinates(point.latitude, point.longitude)) return;
        const latitude = Number(point.latitude);
        const longitude = Number(point.longitude);
        const ts = parseTimestampToMs(point.timestamp) || 0;
        const key = `${latitude.toFixed(6)}:${longitude.toFixed(6)}:${ts}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push({ latitude, longitude, timestamp: point.timestamp || null });
    };
    (Array.isArray(primaryPoints) ? primaryPoints : []).forEach(addPoint);
    (Array.isArray(secondaryPoints) ? secondaryPoints : []).forEach(addPoint);
    merged.sort((a, b) => (parseTimestampToMs(a.timestamp) || 0) - (parseTimestampToMs(b.timestamp) || 0));
    return merged;
}

function clearHistoryRoute() {
    if (historyRouteLayer && historyRouteMapInstance && historyRouteMapInstance.hasLayer(historyRouteLayer)) {
        historyRouteMapInstance.removeLayer(historyRouteLayer);
    } else if (historyRouteLayer && globalMap && globalMap.hasLayer(historyRouteLayer)) {
        globalMap.removeLayer(historyRouteLayer);
    } else if (historyRouteLayer && map && map.hasLayer(historyRouteLayer)) {
        map.removeLayer(historyRouteLayer);
    }
    historyRouteLayer = null;
    if (historyRouteMarkers.length && historyRouteMapInstance) {
        historyRouteMarkers.forEach(marker => {
            if (marker && historyRouteMapInstance.hasLayer(marker)) {
                historyRouteMapInstance.removeLayer(marker);
            } else if (marker && globalMap && globalMap.hasLayer(marker)) {
                globalMap.removeLayer(marker);
            } else if (marker && map && map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
    }
    historyRouteMarkers = [];
    if (historyRoutePointMarkers.length && historyRouteMapInstance) {
        historyRoutePointMarkers.forEach(marker => {
            if (marker && historyRouteMapInstance.hasLayer(marker)) {
                historyRouteMapInstance.removeLayer(marker);
            } else if (marker && globalMap && globalMap.hasLayer(marker)) {
                globalMap.removeLayer(marker);
            } else if (marker && map && map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
    }
    historyRoutePointMarkers = [];
    historyRouteMapInstance = null;
}

function updateMap() {
    if (!map) return;
    
    // Clear existing markers
    deviceMarkers.forEach(marker => map.removeLayer(marker));
    deviceMarkers = [];
    renderAreasInLayerGroup(mapAreasLayerGroup);
    
    const getDevicesFn = window.getDevices || (typeof getDevices !== 'undefined' ? getDevices : null);
    if (!getDevicesFn) return;
    
    const devices = applyDeliveryPlansToDevices(getDevicesFn());
    
    devices.forEach(device => {
        if (hasValidCoordinates(device.latitude, device.longitude)) {
            const plannedDelivery = device.plannedDelivery || null;
            const plannedSummary = plannedDelivery
                ? `<br>Planned destination: ${plannedDelivery.dropoffAreaName || 'N/A'}`
                : '';
            const marker = L.marker([device.latitude, device.longitude])
                .addTo(map)
                .bindPopup(`
                    <strong>${device.name}</strong><br>
                    Status: ${device.status}<br>
                    Temperature: ${device.temperature !== null && device.temperature !== undefined ? device.temperature + '°C' : 'N/A'}<br>
                    Last Update: ${formatTime(device.lastUpdate)}
                    ${plannedSummary}
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
let selectedRouteDeliveryId = null;
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
    const deliveryForm = document.getElementById('deliveryForm');
    const assetForm = document.getElementById('assetForm');
    const groupForm = document.getElementById('groupForm');
    const userForm = document.getElementById('userForm');
    const addAreaBtn = document.getElementById('addAreaBtn');
    const addDeliveryBtn = document.getElementById('addDeliveryBtn');
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

    if (addDeliveryBtn) {
        addDeliveryBtn.addEventListener('click', () => {
            const input = document.getElementById('deliveryReference');
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

    if (deliveryForm) {
        deliveryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveDeliveryFromForm();
        });
    }
    const bindDeliveryTableActions = (tableBodyId) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody || tableBody.dataset.actionsBound === '1') return;
        tableBody.dataset.actionsBound = '1';
        tableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action][data-delivery-id]');
            if (!button) return;
            const action = String(button.getAttribute('data-action') || '').trim();
            const deliveryId = String(button.getAttribute('data-delivery-id') || '').trim();
            if (!deliveryId) return;
            if (action === 'view-route') {
                viewDeliveryRoute(deliveryId);
                return;
            }
            if (action === 'export-route') {
                exportDeliveryRoute(deliveryId);
                return;
            }
            if (action === 'edit-delivery') {
                editDelivery(deliveryId);
                return;
            }
            if (action === 'delete-delivery') {
                deleteDelivery(deliveryId);
            }
        });
    };
    bindDeliveryTableActions('deliveriesTableBody');
    bindDeliveryTableActions('deliveredTableBody');
    const assetCategoryFilter = document.getElementById('assetCategoryFilter');
    if (assetCategoryFilter) {
        assetCategoryFilter.addEventListener('change', () => {
            safeSetItem(ASSET_CATEGORY_FILTER_KEY, assetCategoryFilter.value);
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
    refreshDeliveryAreaOptions();
    refreshDeliveryDeviceOptions();
    loadDeliveries();
    loadAreas();
    loadAssets();
    loadGroups();
    loadUsers();
}

function initAreasMap() {
    const mapElement = document.getElementById('areasMap');
    if (!mapElement || areasMap) return;

    areasMap = L.map('areasMap', {
        attributionControl: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false
    }).setView([20, 0], 2);
    const baseLayers = createMapBaseLayers();
    baseLayers.Basic.addTo(areasMap);
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(areasMap);
    areasLayerGroup = L.layerGroup().addTo(areasMap);
    attachMapControls(areasMap, {
        defaultView: { center: [20, 0], zoom: 2 },
        getFitLayers: () => {
            const persistedAreaLayers = areasLayerGroup ? areasLayerGroup.getLayers() : [];
            const draftLayers = [
                areaDraftMarker,
                areaDraftCircle,
                areaDraftPolyline,
                areaDraftPolygon,
                ...areaDraftPolygonMarkers
            ];
            return [...persistedAreaLayers, ...draftLayers];
        }
    });

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

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeFullscreenMap) {
        setMapFullscreen(activeFullscreenMap, false);
    }
});

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
    safeSetItem(AREAS_STORAGE_KEY, JSON.stringify(areas));
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
    safeSetItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
}

function getDeliveries() {
    const stored = localStorage.getItem(DELIVERIES_STORAGE_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to parse deliveries:', error);
        return [];
    }
}

function normalizeDeliveryRecordForStorage(record) {
    if (!record || typeof record !== 'object') return null;
    const id = String(record.id || '').trim();
    const deviceId = String(record.deviceId || '').trim();
    if (!id || !deviceId) return null;
    const status = normalizeDeliveryStatus(record.status);
    return {
        ...record,
        id,
        deviceId,
        status,
        updatedAt: record.updatedAt || new Date().toISOString()
    };
}

function normalizeDeliveriesForStorage(deliveries) {
    if (!Array.isArray(deliveries)) return [];
    const byId = new Map();
    deliveries.forEach((item) => {
        const normalized = normalizeDeliveryRecordForStorage(item);
        if (!normalized) return;
        const existing = byId.get(normalized.id);
        if (!existing) {
            byId.set(normalized.id, normalized);
            return;
        }
        const existingTs = parseTimestampToMs(existing.updatedAt)
            || parseTimestampToMs(existing.createdAt)
            || 0;
        const nextTs = parseTimestampToMs(normalized.updatedAt)
            || parseTimestampToMs(normalized.createdAt)
            || 0;
        if (nextTs >= existingTs) {
            byId.set(normalized.id, { ...existing, ...normalized });
        }
    });
    return Array.from(byId.values());
}

function mergeDeliveryLists(localList, remoteList) {
    const mergedById = new Map();
    normalizeDeliveriesForStorage(remoteList).forEach((item) => mergedById.set(item.id, item));
    normalizeDeliveriesForStorage(localList).forEach((item) => {
        const existing = mergedById.get(item.id);
        if (!existing) {
            mergedById.set(item.id, item);
            return;
        }
        const existingTs = parseTimestampToMs(existing.updatedAt)
            || parseTimestampToMs(existing.createdAt)
            || 0;
        const nextTs = parseTimestampToMs(item.updatedAt)
            || parseTimestampToMs(item.createdAt)
            || 0;
        if (nextTs >= existingTs) {
            mergedById.set(item.id, { ...existing, ...item });
        }
    });
    return Array.from(mergedById.values());
}

async function fetchDeliveriesFromServer() {
    const authHeaders = getApiAuthHeaders();
    if (!authHeaders.Authorization) return null;
    try {
        const response = await fetch(DELIVERIES_API_ENDPOINT, {
            cache: 'no-store',
            headers: authHeaders
        });
        if (!response.ok) return null;
        const data = await response.json();
        return Array.isArray(data.deliveries) ? normalizeDeliveriesForStorage(data.deliveries) : [];
    } catch (error) {
        console.warn('Failed to fetch deliveries from server:', error);
        return null;
    }
}

async function persistDeliveriesToServer(deliveries) {
    const authHeaders = getApiAuthHeaders();
    if (!authHeaders.Authorization) return false;
    try {
        const response = await fetch(DELIVERIES_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({
                deliveries: normalizeDeliveriesForStorage(deliveries)
            })
        });
        return response.ok;
    } catch (error) {
        console.warn('Failed to persist deliveries to server:', error);
        return false;
    }
}

function scheduleDeliveriesSync(deliveries) {
    if (deliveriesSyncTimeoutId) {
        clearTimeout(deliveriesSyncTimeoutId);
    }
    deliveriesSyncTimeoutId = setTimeout(() => {
        deliveriesSyncTimeoutId = null;
        persistDeliveriesToServer(deliveries);
    }, 250);
}

async function hydrateDeliveriesFromServer() {
    if (isHydratingDeliveriesFromServer) return false;
    isHydratingDeliveriesFromServer = true;
    try {
        const remote = await fetchDeliveriesFromServer();
        if (!Array.isArray(remote)) return false;
        const local = getDeliveries();
        const merged = mergeDeliveryLists(local, remote);
        safeSetItem(DELIVERIES_STORAGE_KEY, JSON.stringify(merged));
        await persistDeliveriesToServer(merged);
        return true;
    } finally {
        isHydratingDeliveriesFromServer = false;
    }
}

function saveDeliveries(deliveries) {
    const normalized = normalizeDeliveriesForStorage(deliveries);
    safeSetItem(DELIVERIES_STORAGE_KEY, JSON.stringify(normalized));
    scheduleDeliveriesSync(normalized);
}

function normalizeDeliveryStatus(value) {
    const next = (value || '').toString().trim().toLowerCase();
    if (next === 'delivered' || next === 'complete' || next === 'completed') {
        return 'arrived';
    }
    if (['planned', 'in_transit', 'arrived', 'delayed', 'missed'].includes(next)) {
        return next;
    }
    if (next) console.warn('Unknown delivery status normalized to planned:', value);
    return 'planned';
}

function isDeliveryCompleted(delivery) {
    if (!delivery) return false;
    const normalizedStatus = normalizeDeliveryStatus(delivery.status);
    if (normalizedStatus === 'arrived') return true;
    if (parseTimestampToMs(delivery.completedAt)) return true;
    if (parseTimestampToMs(delivery.actualArrivalAt)) return true;
    if (parseTimestampToMs(delivery.actualArrival)) return true;
    return false;
}

function formatDurationMinutes(totalMinutes) {
    const minutesValue = Number(totalMinutes);
    if (!Number.isFinite(minutesValue) || minutesValue <= 0) return '0m';
    const rounded = Math.floor(minutesValue);
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    if (hours <= 0) return `${minutes}m`;
    if (minutes <= 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function getDeliveryCurrentDelayMinutes(delivery, nowMs = Date.now()) {
    if (!delivery) return 0;
    if (isDeliveryCompleted(delivery)) return 0;
    const status = normalizeDeliveryStatus(delivery.status);
    const arrivalTs = parseTimestampToMs(delivery.plannedArrivalAt);
    const delayStartTs = parseTimestampToMs(delivery.delayStartedAt);
    const eligibleStatus = ['planned', 'in_transit', 'delayed', 'missed'].includes(status);
    if (!eligibleStatus || !Number.isFinite(arrivalTs) || nowMs <= arrivalTs) return 0;
    const startTs = Number.isFinite(delayStartTs) ? delayStartTs : arrivalTs;
    return Math.max(0, Math.floor((nowMs - startTs) / 60000));
}

function getDeliveryTotalDelayMinutes(delivery, nowMs = Date.now()) {
    if (!delivery) return 0;
    const storedTotal = Number(delivery.totalDelayMinutes);
    const safeStoredTotal = Number.isFinite(storedTotal) && storedTotal > 0 ? Math.floor(storedTotal) : 0;
    const liveCurrent = getDeliveryCurrentDelayMinutes(delivery, nowMs);
    return safeStoredTotal + liveCurrent;
}

function updateDelayReportWidget(deliveries = null) {
    const todayEl = document.getElementById('delayTodayStat');
    const weekEl = document.getElementById('delayWeekStat');
    const monthEl = document.getElementById('delayMonthStat');
    const delayedCountEl = document.getElementById('delayActiveCount');
    const topList = document.getElementById('delayTopDelaysList');
    const topBody = document.getElementById('delayTopShipmentsBody');
    if (!todayEl && !weekEl && !monthEl && !delayedCountEl && !topList && !topBody) return;

    const list = Array.isArray(deliveries) ? deliveries : getDeliveries();
    const nowMs = Date.now();

    const startOfToday = new Date(nowMs);
    startOfToday.setHours(0, 0, 0, 0);
    const startTodayMs = startOfToday.getTime();

    const startOfWeek = new Date(startOfToday);
    const dayOfWeek = startOfWeek.getDay();
    const shiftToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - shiftToMonday);
    const startWeekMs = startOfWeek.getTime();

    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
    const startMonthMs = startOfMonth.getTime();

    const metrics = {
        today: 0,
        week: 0,
        month: 0,
        delayedCount: 0
    };

    list.forEach((delivery) => {
        const status = normalizeDeliveryStatus(delivery?.status);
        const delayTotalMinutes = getDeliveryTotalDelayMinutes(delivery, nowMs);
        if (delayTotalMinutes <= 0) return;

        if (status === 'delayed' || status === 'missed') {
            metrics.delayedCount += 1;
        }

        const anchorTs = parseTimestampToMs(delivery.delayStartedAt)
            || parseTimestampToMs(delivery.plannedArrivalAt)
            || parseTimestampToMs(delivery.updatedAt)
            || parseTimestampToMs(delivery.createdAt)
            || 0;

        if (anchorTs >= startTodayMs && anchorTs <= nowMs) metrics.today += delayTotalMinutes;
        if (anchorTs >= startWeekMs && anchorTs <= nowMs) metrics.week += delayTotalMinutes;
        if (anchorTs >= startMonthMs && anchorTs <= nowMs) metrics.month += delayTotalMinutes;
    });

    if (todayEl) todayEl.textContent = formatDurationMinutes(metrics.today);
    if (weekEl) weekEl.textContent = formatDurationMinutes(metrics.week);
    if (monthEl) monthEl.textContent = formatDurationMinutes(metrics.month);
    if (delayedCountEl) delayedCountEl.textContent = String(metrics.delayedCount);

    const topDelayed = list
        .map((delivery) => ({
            delivery,
            delayMinutes: getDeliveryTotalDelayMinutes(delivery, nowMs)
        }))
        .filter((row) => row.delayMinutes > 0)
        .sort((a, b) => b.delayMinutes - a.delayMinutes)
        .slice(0, 3);

    if (topList) {
        if (!topDelayed.length) {
            topList.innerHTML = `
                <div class="delay-report-item is-empty">
                    <div class="delay-report-item-content">
                        <p class="delay-report-item-title">No delay data yet.</p>
                        <p class="delay-report-item-meta">Add deliveries to generate insights.</p>
                    </div>
                </div>
            `;
        } else {
            topList.innerHTML = topDelayed
                .map(({ delivery, delayMinutes }) => {
                    const status = getDeliveryStatusBadge(delivery.status);
                    const title = delivery.destinationName
                        || delivery.routeName
                        || delivery.reference
                        || delivery.id
                        || 'Unknown delivery';
                    const locationHint = delivery.destinationCode
                        || delivery.destination
                        || delivery.route
                        || '';
                    const displayTitle = locationHint ? `${title} (${locationHint})` : title;
                    return `
                        <div class="delay-report-item">
                            <span class="delay-report-item-icon" aria-hidden="true">
                                <i class="${getDelayReportIconClass(status.className)}"></i>
                            </span>
                            <div class="delay-report-item-content">
                                <p class="delay-report-item-title">${displayTitle}</p>
                                <p class="delay-report-item-meta">${status.label} · ${formatDurationMinutes(delayMinutes)}</p>
                            </div>
                        </div>
                    `;
                })
                .join('');
        }
    }

    if (topBody) {
        if (!topDelayed.length) {
            topBody.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-state">No delay data yet.</td>
                </tr>
            `;
        } else {
            topBody.innerHTML = topDelayed
                .map(({ delivery, delayMinutes }) => {
                    const status = getDeliveryStatusBadge(delivery.status);
                    return `
                        <tr>
                            <td>${delivery.reference || delivery.id || '—'}</td>
                            <td><span class="status-badge ${status.className}">${status.label}</span></td>
                            <td>${formatDurationMinutes(delayMinutes)}</td>
                        </tr>
                    `;
                })
                .join('');
        }
    }
}

function getDelayReportIconClass(statusClassName) {
    if (statusClassName === 'error') return 'fas fa-triangle-exclamation';
    if (statusClassName === 'warning') return 'fas fa-ship';
    if (statusClassName === 'active') return 'fas fa-route';
    return 'fas fa-truck';
}

function getDeliveryForDevice(device, deliveries = null) {
    if (!device) return null;
    const list = Array.isArray(deliveries) ? deliveries : getDeliveries();
    const deviceIds = new Set([
        ...getIdLookupVariants(device?.id),
        ...getIdLookupVariants(device?.deviceId),
        ...getIdLookupVariants(device?.imei),
        ...getIdLookupVariants(device?.lte?.imei)
    ]);
    if (!deviceIds.size) return null;
    const now = Date.now();
    const relevant = list
        .filter((item) => {
            if (!item) return false;
            const deliveryIds = new Set([
                ...getIdLookupVariants(item.deviceId),
                ...getIdLookupVariants(item.imei),
                ...getIdLookupVariants(item.deviceImei),
                ...getIdLookupVariants(item.trackerId)
            ]);
            for (const id of deliveryIds) {
                if (deviceIds.has(id)) return true;
            }
            return false;
        })
        .sort((a, b) => {
            const statusRank = (status) => {
                const normalized = normalizeDeliveryStatus(status);
                if (normalized === 'in_transit') return 0;
                if (normalized === 'delayed') return 1;
                if (normalized === 'planned') return 2;
                if (normalized === 'missed') return 3;
                return 4; // arrived/finalized
            };
            const aPriority = statusRank(a.status);
            const bPriority = statusRank(b.status);
            if (aPriority !== bPriority) return aPriority - bPriority;
            const aTs = parseTimestampToMs(a.updatedAt)
                || parseTimestampToMs(a.actualArrivalAt)
                || parseTimestampToMs(a.plannedArrivalAt)
                || parseTimestampToMs(a.plannedDepartureAt)
                || parseTimestampToMs(a.createdAt)
                || now;
            const bTs = parseTimestampToMs(b.updatedAt)
                || parseTimestampToMs(b.actualArrivalAt)
                || parseTimestampToMs(b.plannedArrivalAt)
                || parseTimestampToMs(b.plannedDepartureAt)
                || parseTimestampToMs(b.createdAt)
                || now;
            return bTs - aTs;
        });
    return relevant[0] || null;
}

function findDeliveryById(deliveryId, deliveries = null) {
    const normalizedId = String(deliveryId || '').trim();
    if (!normalizedId) return null;
    const list = Array.isArray(deliveries) ? deliveries : getDeliveries();
    return list.find((item) => String(item?.id || '').trim() === normalizedId) || null;
}

function deliveryMatchesDevice(delivery, device) {
    if (!delivery || !device) return false;
    const deliveryIds = new Set([
        ...getIdLookupVariants(delivery.deviceId),
        ...getIdLookupVariants(delivery.imei),
        ...getIdLookupVariants(delivery.deviceImei),
        ...getIdLookupVariants(delivery.trackerId)
    ]);
    if (!deliveryIds.size) return false;
    const deviceIds = new Set([
        ...getIdLookupVariants(device?.id),
        ...getIdLookupVariants(device?.deviceId),
        ...getIdLookupVariants(device?.imei),
        ...getIdLookupVariants(device?.lte?.imei)
    ]);
    for (const id of deliveryIds) {
        if (deviceIds.has(id)) return true;
    }
    return false;
}

function getDeliveryTransportPlate(delivery, device = null) {
    const candidates = [
        delivery?.transportPlateNumber,
        delivery?.transportPlate,
        delivery?.plateNumber,
        delivery?.vehiclePlate,
        device?.transportPlateNumber,
        device?.transportPlate,
        device?.plateNumber,
        device?.vehiclePlate,
        device?.registrationNumber,
        device?.vehicleRegistration
    ];
    for (const value of candidates) {
        const normalized = String(value || '').trim();
        if (normalized) return normalized;
    }
    return '';
}

function getPreferredDeliveryForDevice(device, deliveries = null) {
    const list = Array.isArray(deliveries) ? deliveries : getDeliveries();
    if (selectedRouteDeliveryId) {
        const selected = findDeliveryById(selectedRouteDeliveryId, list);
        if (selected && deliveryMatchesDevice(selected, device)) {
            return selected;
        }
    }
    return getDeliveryForDevice(device, list);
}

function getDeviceDeliverySummary(device, deliveries = null) {
    const list = Array.isArray(deliveries) ? deliveries : getDeliveries();
    const matched = list
        .filter((delivery) => deliveryMatchesDevice(delivery, device))
        .sort((a, b) => {
            const aTs = parseTimestampToMs(a.updatedAt)
                || parseTimestampToMs(a.actualArrivalAt)
                || parseTimestampToMs(a.plannedArrivalAt)
                || parseTimestampToMs(a.plannedDepartureAt)
                || parseTimestampToMs(a.createdAt)
                || 0;
            const bTs = parseTimestampToMs(b.updatedAt)
                || parseTimestampToMs(b.actualArrivalAt)
                || parseTimestampToMs(b.plannedArrivalAt)
                || parseTimestampToMs(b.plannedDepartureAt)
                || parseTimestampToMs(b.createdAt)
                || 0;
            return bTs - aTs;
        });
    const active = matched.filter((delivery) => !isDeliveryCompleted(delivery));
    const latestRefs = matched
        .map((delivery) => String(delivery.reference || '').trim())
        .filter(Boolean)
        .slice(0, 3);
    return {
        total: matched.length,
        active: active.length,
        refs: latestRefs
    };
}

function applyDeliveryPlansToDevices(devices) {
    if (!Array.isArray(devices) || !devices.length) return devices || [];
    const deliveries = getDeliveries();
    const areas = getAreas();
    const areaById = new Map(areas.map((area) => [area.id, area]));
    devices.forEach((device) => {
        const planned = getDeliveryForDevice(device, deliveries);
        if (!planned) {
            delete device.plannedDelivery;
            return;
        }
        const pickupArea = planned.pickupAreaId ? areaById.get(planned.pickupAreaId) : null;
        const dropoffArea = planned.dropoffAreaId ? areaById.get(planned.dropoffAreaId) : null;
        const status = normalizeDeliveryStatus(planned.status);
        device.plannedDelivery = {
            ...planned,
            status,
            pickupAreaName: pickupArea?.name || planned.pickupAreaName || '',
            dropoffAreaName: dropoffArea?.name || planned.dropoffAreaName || ''
        };
        device.logistics = {
            ...(device.logistics || {}),
            startAreaId: pickupArea?.id || device.logistics?.startAreaId || null,
            startAreaName: pickupArea?.name || device.logistics?.startAreaName || '',
            destinationAreaId: dropoffArea?.id || device.logistics?.destinationAreaId || null,
            destinationAreaName: dropoffArea?.name || device.logistics?.destinationAreaName || '',
            expectedDeliveryAt: planned.plannedArrivalAt || device.logistics?.expectedDeliveryAt || null
        };
    });
    return devices;
}

function getDeliveryStatusBadge(status) {
    const normalized = normalizeDeliveryStatus(status);
    if (normalized === 'arrived') return { label: 'Delivered', className: 'active' };
    if (normalized === 'in_transit') return { label: 'In transit', className: 'info' };
    if (normalized === 'delayed') return { label: 'Delayed', className: 'warning' };
    if (normalized === 'missed') return { label: 'Missed', className: 'inactive' };
    return { label: 'Planned', className: 'warning' };
}

function refreshDeliveryDeviceOptions(devices = null) {
    const select = document.getElementById('deliveryDeviceId');
    if (!select) return;
    const list = Array.isArray(devices) ? devices : getDevices();
    const current = select.value;
    const options = list.map((device) => {
        const imei = (device?.lte?.imei || '').toString().trim();
        const label = `${device.name || device.id}${imei ? ` (${imei})` : ''}`;
        return `<option value="${device.id}">${label}</option>`;
    }).join('');
    select.innerHTML = `<option value="">Select device</option>${options}`;
    if (current && list.some((device) => device.id === current)) {
        select.value = current;
    }
}

function refreshDeliveryAreaOptions(areas = null) {
    const pickupSelect = document.getElementById('deliveryPickupAreaId');
    const dropoffSelect = document.getElementById('deliveryDropoffAreaId');
    if (!pickupSelect && !dropoffSelect) return;
    const list = Array.isArray(areas) ? areas : getAreas();
    const options = list.map((area) => `<option value="${area.id}">${area.name}</option>`).join('');
    const currentPickup = pickupSelect ? pickupSelect.value : '';
    const currentDropoff = dropoffSelect ? dropoffSelect.value : '';
    if (pickupSelect) {
        pickupSelect.innerHTML = `<option value="">Select pickup area</option>${options}`;
        if (currentPickup && list.some((area) => area.id === currentPickup)) pickupSelect.value = currentPickup;
    }
    if (dropoffSelect) {
        dropoffSelect.innerHTML = `<option value="">Select destination area</option>${options}`;
        if (currentDropoff && list.some((area) => area.id === currentDropoff)) dropoffSelect.value = currentDropoff;
    }
}

function resetDeliveryForm() {
    const form = document.getElementById('deliveryForm');
    if (form) form.reset();
    const deliveryId = document.getElementById('deliveryIdInput');
    if (deliveryId) deliveryId.value = '';
    const status = document.getElementById('deliveryStatus');
    if (status) status.value = 'planned';
    const priority = document.getElementById('deliveryPriority');
    if (priority) priority.value = 'normal';
}

function saveDeliveryFromForm() {
    const idInput = document.getElementById('deliveryIdInput');
    const referenceInput = document.getElementById('deliveryReference');
    const deviceSelect = document.getElementById('deliveryDeviceId');
    const pickupSelect = document.getElementById('deliveryPickupAreaId');
    const dropoffSelect = document.getElementById('deliveryDropoffAreaId');
    const departureInput = document.getElementById('deliveryDepartureAt');
    const arrivalInput = document.getElementById('deliveryArrivalAt');
    const statusSelect = document.getElementById('deliveryStatus');
    const prioritySelect = document.getElementById('deliveryPriority');
    const plateInput = document.getElementById('deliveryTransportPlate');
    const notesInput = document.getElementById('deliveryNotes');
    if (!referenceInput || !deviceSelect) return;

    const reference = referenceInput.value.trim();
    const deviceId = (deviceSelect.value || '').trim();
    if (!reference) {
        alert('Please enter a delivery reference.');
        referenceInput.focus();
        return;
    }
    if (!deviceId) {
        alert('Please select a device for this delivery.');
        deviceSelect.focus();
        return;
    }

    const plannedDepartureAt = departureInput?.value ? new Date(departureInput.value).toISOString() : null;
    const plannedArrivalAt = arrivalInput?.value ? new Date(arrivalInput.value).toISOString() : null;
    if (plannedDepartureAt && plannedArrivalAt && Date.parse(plannedDepartureAt) > Date.parse(plannedArrivalAt)) {
        alert('Planned arrival must be later than planned departure.');
        return;
    }

    const areas = getAreas();
    const pickupArea = areas.find((area) => area.id === (pickupSelect?.value || '')) || null;
    const dropoffArea = areas.find((area) => area.id === (dropoffSelect?.value || '')) || null;
    const now = new Date().toISOString();
    const deliveryId = (idInput?.value || '').trim();
    const deliveries = getDeliveries();
    const normalizedStatus = normalizeDeliveryStatus(statusSelect?.value || 'planned');
    const existingRecord = deliveryId ? deliveries.find((item) => item.id === deliveryId) : null;
    const previousStatus = normalizeDeliveryStatus(existingRecord?.status);
    const nextRecord = {
        id: deliveryId || `delivery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        reference,
        deviceId,
        pickupAreaId: pickupArea?.id || null,
        pickupAreaName: pickupArea?.name || '',
        dropoffAreaId: dropoffArea?.id || null,
        dropoffAreaName: dropoffArea?.name || '',
        plannedDepartureAt,
        plannedArrivalAt,
        status: normalizedStatus,
        priority: (prioritySelect?.value || 'normal').toString().trim() || 'normal',
        transportPlateNumber: (plateInput?.value || '').toString().trim(),
        notes: (notesInput?.value || '').toString().trim(),
        updatedAt: now
    };
    if (!existingRecord && normalizedStatus === 'in_transit') {
        nextRecord.startedAt = now;
    } else if (existingRecord && previousStatus !== 'in_transit' && normalizedStatus === 'in_transit') {
        nextRecord.startedAt = existingRecord.startedAt || now;
    }
    if (normalizedStatus === 'arrived') {
        nextRecord.completedAt = existingRecord?.completedAt || now;
        nextRecord.actualArrivalAt = existingRecord?.actualArrivalAt || now;
    }
    if (!deliveryId) {
        nextRecord.createdAt = now;
        deliveries.push(nextRecord);
    } else {
        const idx = deliveries.findIndex((item) => item.id === deliveryId);
        if (idx >= 0) {
            deliveries[idx] = { ...deliveries[idx], ...nextRecord, createdAt: deliveries[idx].createdAt || now };
        } else {
            deliveries.push({ ...nextRecord, createdAt: now });
        }
    }

    saveDeliveries(deliveries);
    resetDeliveryForm();
    loadDeliveries();
    loadDevices();
    loadDashboardData();
    showToast('Delivery saved.', 'success');
}

function editDelivery(deliveryId) {
    const record = getDeliveries().find((item) => item.id === deliveryId);
    if (!record) return;
    const idInput = document.getElementById('deliveryIdInput');
    const referenceInput = document.getElementById('deliveryReference');
    const deviceSelect = document.getElementById('deliveryDeviceId');
    const pickupSelect = document.getElementById('deliveryPickupAreaId');
    const dropoffSelect = document.getElementById('deliveryDropoffAreaId');
    const departureInput = document.getElementById('deliveryDepartureAt');
    const arrivalInput = document.getElementById('deliveryArrivalAt');
    const statusSelect = document.getElementById('deliveryStatus');
    const prioritySelect = document.getElementById('deliveryPriority');
    const plateInput = document.getElementById('deliveryTransportPlate');
    const notesInput = document.getElementById('deliveryNotes');
    if (idInput) idInput.value = record.id;
    if (referenceInput) referenceInput.value = record.reference || '';
    if (deviceSelect) deviceSelect.value = record.deviceId || '';
    if (pickupSelect) pickupSelect.value = record.pickupAreaId || '';
    if (dropoffSelect) dropoffSelect.value = record.dropoffAreaId || '';
    if (departureInput) departureInput.value = record.plannedDepartureAt ? toLocalDatetimeValue(new Date(record.plannedDepartureAt)) : '';
    if (arrivalInput) arrivalInput.value = record.plannedArrivalAt ? toLocalDatetimeValue(new Date(record.plannedArrivalAt)) : '';
    if (statusSelect) statusSelect.value = normalizeDeliveryStatus(record.status);
    if (prioritySelect) prioritySelect.value = record.priority || 'normal';
    if (plateInput) plateInput.value = record.transportPlateNumber || record.transportPlate || '';
    if (notesInput) notesInput.value = record.notes || '';
    const form = document.getElementById('deliveryForm');
    if (form && typeof form.scrollIntoView === 'function') {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (referenceInput) {
        referenceInput.focus();
    }
}

function deleteDelivery(deliveryId) {
    try {
        const deliveries = getDeliveries();
        const record = deliveries.find((item) => item.id === deliveryId);
        if (!record) {
            showToast?.('Delivery not found.', 'error');
            return;
        }
        if (!confirm(`Delete delivery "${record.reference}"?`)) return;
        if (String(selectedRouteDeliveryId || '').trim() === String(deliveryId || '').trim()) {
            selectedRouteDeliveryId = null;
        }
        saveDeliveries(deliveries.filter((item) => item.id !== deliveryId));
        loadDeliveries();
        loadDevices();
        loadDashboardData();
    } catch (error) {
        console.error('Failed to delete delivery:', error);
        showToast?.('Failed to delete delivery.', 'error');
    }
}

function loadDeliveries() {
    const tableBody = document.getElementById('deliveriesTableBody');
    const deliveredTableBody = document.getElementById('deliveredTableBody');
    if (!tableBody) return;
    let deliveries, devices;
    try {
        deliveries = getDeliveries();
        devices = getDevices();
    } catch (error) {
        console.error('Failed to load deliveries data:', error);
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">Error loading deliveries.</td></tr>';
        return;
    }
    const deviceById = new Map();
    devices.forEach((device) => {
        if (device?.id) deviceById.set(device.id, device);
        if (device?.lte?.imei) deviceById.set(device.lte.imei, device);
    });
    const nowMs = Date.now();
    const renderDeliveryRow = (delivery) => {
        const deliveryIdAttr = String(delivery.id || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const status = getDeliveryStatusBadge(delivery.status);
        const device = deviceById.get(delivery.deviceId);
        const deviceLabel = device ? (device.name || device.id) : delivery.deviceId;
        const routeText = `${delivery.pickupAreaName || 'N/A'} -> ${delivery.dropoffAreaName || 'N/A'}`;
        const windowText = `${delivery.plannedDepartureAt ? formatTime(delivery.plannedDepartureAt) : 'N/A'} / ${delivery.plannedArrivalAt ? formatTime(delivery.plannedArrivalAt) : 'N/A'}`;
        const currentDelay = getDeliveryCurrentDelayMinutes(delivery, nowMs);
        const totalDelay = Number.isFinite(Number(delivery.totalDelayMinutes)) ? Number(delivery.totalDelayMinutes) : 0;
        const delayText = currentDelay > 0
            ? `${formatDurationMinutes(currentDelay)} live`
            : totalDelay > 0
                ? `${formatDurationMinutes(totalDelay)} total`
                : 'On time';
        return `
            <tr>
                <td>${delivery.reference || '—'}</td>
                <td>${deviceLabel || '—'}</td>
                <td>${routeText}</td>
                <td>${windowText}</td>
                <td><span class="status-badge ${status.className}">${status.label}</span></td>
                <td>${delayText}</td>
                <td>${delivery.priority || 'normal'}</td>
                <td>
                    <button type="button" class="btn btn-outline btn-small" data-action="view-route" data-delivery-id="${deliveryIdAttr}" title="View route">
                        <i class="fas fa-route"></i>
                    </button>
                    <button type="button" class="btn btn-outline btn-small" data-action="export-route" data-delivery-id="${deliveryIdAttr}" title="Export route JSON">
                        <i class="fas fa-download"></i>
                    </button>
                    <button type="button" class="btn btn-outline btn-small" data-action="edit-delivery" data-delivery-id="${deliveryIdAttr}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-outline btn-small" data-action="delete-delivery" data-delivery-id="${deliveryIdAttr}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    };

    const sortedDeliveries = deliveries
        .slice()
        .sort((a, b) => (parseTimestampToMs(a.plannedDepartureAt) || 0) - (parseTimestampToMs(b.plannedDepartureAt) || 0));

    const deliveredDeliveries = sortedDeliveries.filter((delivery) => isDeliveryCompleted(delivery));
    const plannedDeliveries = sortedDeliveries.filter((delivery) => !isDeliveryCompleted(delivery));

    tableBody.innerHTML = plannedDeliveries.length
        ? plannedDeliveries.map(renderDeliveryRow).join('')
        : `
            <tr>
                <td colspan="8" class="empty-state">No planned deliveries.</td>
            </tr>
        `;

    if (deliveredTableBody) {
        deliveredTableBody.innerHTML = deliveredDeliveries.length
            ? deliveredDeliveries.map(renderDeliveryRow).join('')
            : `
                <tr>
                    <td colspan="8" class="empty-state">No delivered shipments yet.</td>
                </tr>
            `;
    }
    updateDelayReportWidget(deliveries);
}

function appendRoutePointToActiveDelivery(device, timestampIso) {
    if (!device || !hasValidCoordinates(device.latitude, device.longitude)) return false;
    const deviceIds = new Set([
        ...getIdLookupVariants(device?.id),
        ...getIdLookupVariants(device?.deviceId),
        ...getIdLookupVariants(device?.imei),
        ...getIdLookupVariants(device?.lte?.imei)
    ]);
    if (!deviceIds.size) return false;

    const deliveries = getDeliveries();
    const nowIso = timestampIso || new Date().toISOString();
    const nowMs = parseTimestampToMs(nowIso) || Date.now();
    let changed = false;

    deliveries.forEach((delivery) => {
        if (!delivery) return;
        const status = normalizeDeliveryStatus(delivery.status);
        if (!['planned', 'in_transit', 'delayed', 'missed'].includes(status)) return;

        const deliveryIds = new Set([
            ...getIdLookupVariants(delivery.deviceId),
            ...getIdLookupVariants(delivery.imei),
            ...getIdLookupVariants(delivery.deviceImei),
            ...getIdLookupVariants(delivery.trackerId)
        ]);
        let isMatch = false;
        for (const id of deliveryIds) {
            if (deviceIds.has(id)) {
                isMatch = true;
                break;
            }
        }
        if (!isMatch) return;

        const points = Array.isArray(delivery.routePoints) ? delivery.routePoints : [];
        const lastPoint = points.length ? points[points.length - 1] : null;
        const lastTs = parseTimestampToMs(lastPoint?.timestamp);
        const lastLat = Number(lastPoint?.latitude);
        const lastLng = Number(lastPoint?.longitude);
        const lat = Number(device.latitude);
        const lng = Number(device.longitude);
        const movedEnough = !Number.isFinite(lastLat) || !Number.isFinite(lastLng)
            || Math.abs(lastLat - lat) >= 0.00005
            || Math.abs(lastLng - lng) >= 0.00005;
        const timeGapEnough = !Number.isFinite(lastTs) || (nowMs - lastTs >= 20 * 1000);
        if (!movedEnough && !timeGapEnough) return;

        points.push({
            latitude: lat,
            longitude: lng,
            timestamp: nowIso
        });
        if (points.length > 4000) {
            points.splice(0, points.length - 4000);
        }
        delivery.routePoints = points;
        delivery.updatedAt = nowIso;
        changed = true;
    });

    if (changed) {
        saveDeliveries(deliveries);
    }
    return changed;
}

function exportDeliveryRoute(deliveryId) {
    const normalizedId = (deliveryId || '').toString().trim();
    if (!normalizedId) return;
    const delivery = getDeliveries().find((item) => String(item?.id || '').trim() === normalizedId) || null;
    if (!delivery) {
        setHistoryStatus('Delivery not found.', 'error');
        return;
    }
    const routePoints = Array.isArray(delivery.routePoints) ? delivery.routePoints : [];
    if (!routePoints.length) {
        setHistoryStatus('No captured route points to export.', 'warning');
        return;
    }
    const exportPayload = {
        deliveryId: delivery.id,
        reference: delivery.reference || '',
        deviceId: delivery.deviceId || '',
        status: delivery.status || '',
        exportedAt: new Date().toISOString(),
        pointsCount: routePoints.length,
        routePoints
    };
    const safeBase = (delivery.reference || delivery.id || 'delivery-route')
        .toString()
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'delivery-route';
    const filename = `${safeBase}-route-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    setHistoryStatus(`Route JSON exported (${routePoints.length} points).`, 'success');
}

async function viewDeliveryRoute(deliveryId) {
    const normalizedId = (deliveryId || '').toString().trim();
    if (!normalizedId) return;
    const routeContainer = document.getElementById('deliveryHistoryPanel') || document.getElementById('historyPanel');
    showSectionLoading(routeContainer);
    try {
        const delivery = findDeliveryById(normalizedId);
        if (!delivery) {
            setHistoryStatus('Delivery not found.', 'error');
            return;
        }
        selectedRouteDeliveryId = normalizedId;
        const params = new URLSearchParams({ deliveryId: normalizedId, limit: '5000' });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        let response;
        try {
            response = await fetch(`${DELIVERY_HISTORY_API_ENDPOINT}?${params.toString()}`, {
                cache: 'no-store',
                headers: getApiAuthHeaders(),
                signal: controller.signal
            });
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            if (fetchErr.name === 'AbortError') {
                setHistoryStatus('Request timed out loading delivery route.', 'error');
            } else {
                setHistoryStatus('Network error loading delivery route.', 'error');
            }
            return;
        }
        clearTimeout(timeoutId);
        if (!response.ok) {
            setHistoryStatus('Failed to load delivery route.', 'error');
            return;
        }
        let data;
        try {
            data = await response.json();
        } catch (jsonErr) {
            setHistoryStatus('Invalid response from server.', 'error');
            return;
        }
        let points = normalizeRoutePoints(Array.isArray(data.points) ? data.points : []);
        if (points.length < 2 && data && data.debug) {
            console.warn('Delivery route debug', data.debug);
        }
        if (points.length < 2 && delivery) {
            const now = Date.now();
            const primaryFrom = parseTimestampToMs(delivery.actualDepartureAt)
                || parseTimestampToMs(delivery.startedAt)
                || parseTimestampToMs(delivery.plannedDepartureAt)
                || parseTimestampToMs(delivery.createdAt)
                || (now - 24 * 60 * 60 * 1000);
            const primaryTo = parseTimestampToMs(delivery.completedAt)
                || parseTimestampToMs(delivery.actualArrivalAt)
                || parseTimestampToMs(delivery.delayResolvedAt)
                || parseTimestampToMs(delivery.updatedAt)
                || parseTimestampToMs(delivery.plannedArrivalAt)
                || now;
            const minTs = Math.min(primaryFrom, primaryTo);
            const maxTs = Math.max(primaryFrom, primaryTo);

            const devices = getDevices();
            const deliveryAliasSet = new Set();
            getIdLookupVariants(delivery.deviceId).forEach((id) => deliveryAliasSet.add(id));
            getIdLookupVariants(delivery.imei).forEach((id) => deliveryAliasSet.add(id));
            getIdLookupVariants(delivery.deviceImei).forEach((id) => deliveryAliasSet.add(id));

            const matchingDevice = devices.find((device) => {
                const aliases = new Set();
                getIdLookupVariants(device?.id).forEach((id) => aliases.add(id));
                getIdLookupVariants(device?.deviceId).forEach((id) => aliases.add(id));
                getIdLookupVariants(device?.imei).forEach((id) => aliases.add(id));
                getIdLookupVariants(device?.lte?.imei).forEach((id) => aliases.add(id));
                for (const alias of aliases) {
                    if (deliveryAliasSet.has(alias)) return true;
                }
                return false;
            });

            const aliasIds = new Set(deliveryAliasSet);
            if (matchingDevice) {
                getIdLookupVariants(matchingDevice?.id).forEach((id) => aliasIds.add(id));
                getIdLookupVariants(matchingDevice?.deviceId).forEach((id) => aliasIds.add(id));
                getIdLookupVariants(matchingDevice?.imei).forEach((id) => aliasIds.add(id));
                getIdLookupVariants(matchingDevice?.lte?.imei).forEach((id) => aliasIds.add(id));
            }

            // Resolve live aliases from backend to catch cases where history is
            // stored under an internal device key (e.g. DeviceTest2) while the
            // delivery references an IMEI.
            const seedAliasList = Array.from(aliasIds).filter(Boolean).slice(0, 30);
            if (seedAliasList.length) {
                try {
                    const idsParam = encodeURIComponent(seedAliasList.join(','));
                    const locationResponse = await fetch(`/api/locations?ids=${idsParam}`, {
                        cache: 'no-store',
                        headers: getApiAuthHeaders()
                    });
                    if (locationResponse.ok) {
                        const locationData = await locationResponse.json();
                        const liveDevices = Array.isArray(locationData?.devices) ? locationData.devices : [];
                        liveDevices.forEach((live) => {
                            getIdLookupVariants(live?.id).forEach((id) => aliasIds.add(id));
                            getIdLookupVariants(live?.deviceId).forEach((id) => aliasIds.add(id));
                            getIdLookupVariants(live?.imei).forEach((id) => aliasIds.add(id));
                            getIdLookupVariants(live?.lte?.imei).forEach((id) => aliasIds.add(id));
                        });
                    }
                } catch (error) {
                    // Soft fallback only.
                }
            }

            const ranges = [
                [minTs, maxTs],
                [Math.max(0, minTs - (6 * 60 * 60 * 1000)), maxTs + (6 * 60 * 60 * 1000)],
                [Math.max(0, minTs - (24 * 60 * 60 * 1000)), maxTs + (24 * 60 * 60 * 1000)],
                [Math.max(0, now - (7 * 24 * 60 * 60 * 1000)), now],
                [Math.max(0, now - (90 * 24 * 60 * 60 * 1000)), now]
            ];
            const aliasList = Array.from(aliasIds).filter(Boolean).slice(0, 20);
            for (const [fromTs, toTs] of ranges) {
                for (const alias of aliasList) {
                    const historyParams = new URLSearchParams({
                        deviceId: alias,
                        from: new Date(fromTs).toISOString(),
                        to: new Date(toTs).toISOString(),
                        limit: '5000'
                    });
                    const historyResponse = await fetch(`/api/history?${historyParams.toString()}`, {
                        cache: 'no-store',
                        headers: getApiAuthHeaders()
                    });
                    if (!historyResponse.ok) continue;
                    const historyData = await historyResponse.json();
                    const fallbackPoints = normalizeRoutePoints(Array.isArray(historyData.points) ? historyData.points : []);
                    if (fallbackPoints.length) {
                        points = mergeRoutePoints(points, fallbackPoints);
                    }
                    if (points.length >= 2) {
                        break;
                    }
                }
                if (points.length >= 2) break;
            }
        }
        if (points.length < 2 && delivery && Array.isArray(delivery.routePoints)) {
            points = mergeRoutePoints(points, normalizeRoutePoints(delivery.routePoints));
        }
        if (points.length < 2 && delivery) {
            const fallbackAliases = new Set();
            getIdLookupVariants(delivery.deviceId).forEach((id) => fallbackAliases.add(id));
            getIdLookupVariants(delivery.imei).forEach((id) => fallbackAliases.add(id));
            getIdLookupVariants(delivery.deviceImei).forEach((id) => fallbackAliases.add(id));
            getIdLookupVariants(delivery.trackerId).forEach((id) => fallbackAliases.add(id));
            const aliases = Array.from(fallbackAliases).filter(Boolean).slice(0, 30);
            if (aliases.length) {
                try {
                    const idsParam = encodeURIComponent(aliases.join(','));
                    const locationResponse = await fetch(`/api/locations?ids=${idsParam}`, {
                        cache: 'no-store',
                        headers: getApiAuthHeaders()
                    });
                    if (locationResponse.ok) {
                        const locationData = await locationResponse.json();
                        const liveDevices = Array.isArray(locationData?.devices) ? locationData.devices : [];
                        points = mergeRoutePoints(points, normalizeRoutePoints(
                            liveDevices.map((device) => ({
                                latitude: device?.latitude,
                                longitude: device?.longitude,
                                timestamp: device?.updatedAt || device?.lastUpdate || null
                            }))
                        ));
                    }
                } catch (error) {
                    // Soft fallback only.
                }
            }
        }
        if (!points.length) {
            setHistoryStatus('No route points for this delivery.', 'warning');
            return;
        }
        const routeDevice = getDevices().find((device) => deliveryMatchesDevice(delivery, device)) || null;
        setActiveSection('devices', { updateHash: true });
        drawHistoryRoute(points);
        if (routeDevice?.id) {
            setTimeout(() => selectDevice(routeDevice.id), 80);
        }
        const referenceLabel = delivery.reference ? ` ${delivery.reference}` : '';
        setHistoryStatus(`Showing ${points.length} route points for delivery${referenceLabel}.`, 'success');
    } catch (error) {
        console.warn('Delivery route fetch failed:', error);
        setHistoryStatus('Failed to load delivery route.', 'error');
    } finally {
        hideSectionLoading(routeContainer);
    }
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
        refreshDeliveryAreaOptions([]);
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
    refreshDeliveryAreaOptions(areas);
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
        const inside = isCoordinatesInsideArea(latitude, longitude, area);
        if (inside) {
            return area;
        }
    }
    return null;
}

function isCoordinatesInsideArea(latitude, longitude, area) {
    if (!area || !hasValidCoordinates(latitude, longitude)) return false;
    if (area.shape === 'polygon' && Array.isArray(area.polygon) && area.polygon.length >= 3) {
        return isPointInPolygon({ lat: latitude, lng: longitude }, area.polygon);
    }
    if (area.center && area.radiusMeters) {
        const distance = getDistanceMeters(
            { lat: latitude, lng: longitude },
            area.center
        );
        return distance <= area.radiusMeters;
    }
    return false;
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
    safeSetItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
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
    safeSetItem(USERS_STORAGE_KEY, JSON.stringify(users));
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
    const devices = applyDeliveryPlansToDevices(getDevices());
    refreshDeliveryDeviceOptions(devices);
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
            const deliverySummary = getDeviceDeliverySummary(device);
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
                <span><i class="fas fa-battery-half"></i> ${batteryText}</span>
                <span><i class="fas fa-thermometer-half"></i> ${device.temperature !== null && device.temperature !== undefined ? device.temperature + '°C' : 'N/A'}</span>
                <span><i class="fas fa-tachometer-alt"></i> ${device.speed !== null && device.speed !== undefined ? device.speed + ' km/h' : 'N/A'}</span>
                <span><i class="fas fa-clock"></i> ${getLastSeenText(device)}</span>
                </div>
                <div class="device-item-submeta">
                <span><i class="fas fa-map-marker-alt"></i> ${device.location || 'Unknown'}</span>
                    <span><i class="fas fa-layer-group"></i> ${device.group || 'Ungrouped'}</span>
            </div>
            <div class="device-item-submeta">
                <span><i class="fas fa-shipping-fast"></i> Shipments: ${deliverySummary.active} active / ${deliverySummary.total} total</span>
                <span><i class="fas fa-hashtag"></i> ${deliverySummary.refs.length ? deliverySummary.refs.join(', ') : 'No refs'}</span>
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
    if (document.getElementById('deliveriesTableBody')) {
        loadDeliveries();
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
    const best = getMostRecentDeviceTimestamp(device);
    return best && Number.isFinite(best.ms) ? best.ms : 0;
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
        const plannedDelivery = getPreferredDeliveryForDevice(device);
        const telemetryTemperature = toFiniteNumber(device.temperature);
        const telemetryHumidity = getDeviceHumidityTelemetry(device);
        const telemetryBattery = toFiniteNumber(device.battery);
        const telemetrySpeed = toFiniteNumber(device.speed);
        const telemetrySignal = device.signalStrength || (toFiniteNumber(device.rssi) !== null ? `${device.rssi} dBm` : null);
        const telemetrySatellites = toFiniteNumber(device.satellites);
        const transportPlate = getDeliveryTransportPlate(plannedDelivery, device);
        const deliverySummary = getDeviceDeliverySummary(device);
        const hasTelemetryCoordinates = hasValidCoordinates(device.latitude, device.longitude);
        const telemetryLocationText = hasTelemetryCoordinates
            ? `${Number(device.latitude).toFixed(5)}, ${Number(device.longitude).toFixed(5)}`
            : 'Not reported by tracker';
        const latestTelemetry = getMostRecentDeviceTimestamp(device);
        const telemetryTimestamp = latestTelemetry ? latestTelemetry.raw : null;
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
            <div class="detail-item">
                <span class="detail-label">Speed:</span>
                <span class="detail-value">${telemetrySpeed !== null ? `${telemetrySpeed} km/h` : 'Not reported by tracker'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Signal:</span>
                <span class="detail-value">${telemetrySignal || 'Not reported by tracker'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Satellites:</span>
                <span class="detail-value">${telemetrySatellites !== null ? String(telemetrySatellites) : 'Not reported by tracker'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Delivery reference:</span>
                <span class="detail-value">${plannedDelivery?.reference || 'Not scheduled'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Planned destination:</span>
                <span class="detail-value">${plannedDelivery?.dropoffAreaName || 'Not scheduled'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Planned ETA:</span>
                <span class="detail-value">${plannedDelivery?.plannedArrivalAt ? formatTime(plannedDelivery.plannedArrivalAt) : 'Not scheduled'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Transport plate:</span>
                <span class="detail-value">${transportPlate || 'Not set'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Shipments on this tracker:</span>
                <span class="detail-value">${deliverySummary.active} active / ${deliverySummary.total} total</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Recent references:</span>
                <span class="detail-value">${deliverySummary.refs.length ? deliverySummary.refs.join(', ') : 'None'}</span>
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
    const value = device.lastUpdate || device.updatedAt || (device.tracker && device.tracker.lastFix);
    return parseTimestampToMs(value);
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
            if (now - updateTs <= getDeviceStaleThresholdMs(device)) connectedDevices += 1;
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

    const deliveries = typeof getDeliveries === 'function' ? getDeliveries() : [];
    const inTransitCount = deliveries.filter(d => normalizeDeliveryStatus(d.status) === 'in_transit').length;
    const deliveredCount = deliveries.filter(d => isDeliveryCompleted(d)).length;
    const delayedCount = deliveries.filter(d => {
        if (isDeliveryCompleted(d)) return false;
        return getDeliveryCurrentDelayMinutes(d, now) > 0;
    }).length;

    const sample = {
        timestamp: new Date(now).toISOString(),
        connectedDevices,
        recentDevices,
        inTransitCount,
        deliveredCount,
        delayedCount,
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
        if (updateTs && now - updateTs <= getDeviceStaleThresholdMs(device)) return count + 1;
        return count;
    }, 0);

    const deliveries = typeof getDeliveries === 'function' ? getDeliveries() : [];
    const inTransitCount = deliveries.filter(d => {
        const s = normalizeDeliveryStatus(d.status);
        return s === 'in_transit';
    }).length;
    const deliveredCount = deliveries.filter(d => isDeliveryCompleted(d)).length;
    const delayedCount = deliveries.filter(d => {
        if (isDeliveryCompleted(d)) return false;
        return getDeliveryCurrentDelayMinutes(d, now) > 0;
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
        inTransitNote.textContent = 'Deliveries currently in transit';
    }
    const deliveredNote = document.getElementById('analyticsDeliveredNote');
    if (deliveredNote) {
        deliveredNote.textContent = 'Deliveries marked as arrived';
    }
    const delayedNote = document.getElementById('analyticsDelayedNote');
    if (delayedNote) {
        delayedNote.textContent = 'Deliveries past their ETA';
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

function getDeliveryTrendSeries(deliveries, bucketStarts, bucketMs, statusFilter) {
    const counts = new Array(bucketStarts.length).fill(0);
    const base = bucketStarts[0]?.getTime();
    if (!Number.isFinite(base)) return counts;
    const rangeEnd = base + bucketStarts.length * bucketMs;
    deliveries.forEach(delivery => {
        if (statusFilter === 'in_transit') {
            const startTs = parseTimestampToMs(delivery.startedAt)
                || parseTimestampToMs(delivery.actualDepartureAt)
                || parseTimestampToMs(delivery.plannedDepartureAt);
            const endTs = parseTimestampToMs(delivery.completedAt)
                || parseTimestampToMs(delivery.actualArrivalAt)
                || (isDeliveryCompleted(delivery) ? startTs : null);
            if (!Number.isFinite(startTs)) return;
            const effectiveEnd = Number.isFinite(endTs) ? endTs : rangeEnd;
            for (let i = 0; i < bucketStarts.length; i++) {
                const bucketStart = bucketStarts[i].getTime();
                const bucketEnd = bucketStart + bucketMs;
                if (startTs < bucketEnd && effectiveEnd > bucketStart) {
                    counts[i] += 1;
                }
            }
        } else if (statusFilter === 'delivered') {
            const completedTs = parseTimestampToMs(delivery.completedAt)
                || parseTimestampToMs(delivery.actualArrivalAt);
            if (!Number.isFinite(completedTs)) return;
            const index = Math.floor((completedTs - base) / bucketMs);
            if (index >= 0 && index < counts.length) {
                counts[index] += 1;
            }
        } else if (statusFilter === 'created') {
            const createdTs = parseTimestampToMs(delivery.createdAt)
                || parseTimestampToMs(delivery.plannedDepartureAt);
            if (!Number.isFinite(createdTs)) return;
            const index = Math.floor((createdTs - base) / bucketMs);
            if (index >= 0 && index < counts.length) {
                counts[index] += 1;
            }
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
    const deliveries = typeof getDeliveries === 'function' ? getDeliveries() : [];
    const alerts = getAlerts();
    const range = getAnalyticsRangeConfig();
    const buckets = range.unit === 'hour'
        ? getLastNHours(range.count, range.endTime)
        : getLastNDays(range.count, range.endTime);
    const labels = buckets.map(date => formatBucketLabel(date, range.unit));
    const inTransitSeries = getDeliveryTrendSeries(deliveries, buckets, range.bucketMs, 'in_transit');
    const deliveredSeries = getDeliveryTrendSeries(deliveries, buckets, range.bucketMs, 'delivered');
    const createdSeries = getDeliveryTrendSeries(deliveries, buckets, range.bucketMs, 'created');
    const alertCounts = getAlertDistribution(alerts);

    // Shipment Trends Chart
    const trendsCtx = document.getElementById('shipmentTrendsChart');
    if (trendsCtx) {
        charts.shipmentTrends = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'In Transit',
                        data: inTransitSeries,
                        borderColor: 'rgb(37, 99, 235)',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Delivered',
                        data: deliveredSeries,
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Created',
                        data: createdSeries,
                        borderColor: 'rgb(168, 85, 247)',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        tension: 0.4,
                        fill: false,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { usePointStyle: true, boxWidth: 8 }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
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
        const updatedInTransit = getAnalyticsSeriesFromSamples(samples, buckets, range.bucketMs, 'inTransitCount');
        const updatedDelivered = getAnalyticsSeriesFromSamples(samples, buckets, range.bucketMs, 'deliveredCount');
        const hasHistoricalData = updatedInTransit.some(v => v > 0) || updatedDelivered.some(v => v > 0);
        if (hasHistoricalData) {
            charts.shipmentTrends.data.datasets[0].data = updatedInTransit;
            charts.shipmentTrends.data.datasets[1].data = updatedDelivered;
            charts.shipmentTrends.update();
        }
    }
}

async function refreshAnalyticsCharts() {
    if (charts.shipmentTrends) {
        const deliveries = typeof getDeliveries === 'function' ? getDeliveries() : [];
        const range = getAnalyticsRangeConfig();
        const buckets = range.unit === 'hour'
            ? getLastNHours(range.count, range.endTime)
            : getLastNDays(range.count, range.endTime);
        const labels = buckets.map(date => formatBucketLabel(date, range.unit));
        const inTransitSeries = getDeliveryTrendSeries(deliveries, buckets, range.bucketMs, 'in_transit');
        const deliveredSeries = getDeliveryTrendSeries(deliveries, buckets, range.bucketMs, 'delivered');
        const createdSeries = getDeliveryTrendSeries(deliveries, buckets, range.bucketMs, 'created');
        charts.shipmentTrends.data.labels = labels;
        charts.shipmentTrends.data.datasets[0].data = inTransitSeries;
        charts.shipmentTrends.data.datasets[1].data = deliveredSeries;
        charts.shipmentTrends.data.datasets[2].data = createdSeries;
        charts.shipmentTrends.update();

        const samples = await fetchAnalyticsSamples(range);
        if (samples.length && getAnalyticsGroupFilter() === 'all') {
            const updatedInTransit = getAnalyticsSeriesFromSamples(samples, buckets, range.bucketMs, 'inTransitCount');
            const updatedDelivered = getAnalyticsSeriesFromSamples(samples, buckets, range.bucketMs, 'deliveredCount');
            const hasHistoricalData = updatedInTransit.some(v => v > 0) || updatedDelivered.some(v => v > 0);
            if (hasHistoricalData) {
                charts.shipmentTrends.data.datasets[0].data = updatedInTransit;
                charts.shipmentTrends.data.datasets[1].data = updatedDelivered;
                charts.shipmentTrends.update();
            }
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

function getShipmentVolumeSeries(daysCount = 30) {
    const bucketMs = 24 * 60 * 60 * 1000;
    const buckets = getLastNDays(daysCount);
    const labels = buckets.map(date => formatBucketLabel(date, 'day'));
    const counts = new Array(buckets.length).fill(0);
    const base = buckets[0]?.getTime();

    const deliveries = getDeliveries();
    deliveries.forEach(delivery => {
        const ts = Date.parse(
            delivery.createdAt ||
            delivery.updatedAt ||
            delivery.actualArrival ||
            delivery.expectedArrival ||
            delivery.preferredDeliveryDate
        );
        if (!Number.isFinite(ts) || !Number.isFinite(base)) return;
        const index = Math.floor((ts - base) / bucketMs);
        if (index >= 0 && index < counts.length) {
            counts[index] += 1;
        }
    });

    // Fallback to device activity if there are no dated delivery records.
    if (!counts.some(value => value > 0)) {
        return {
            labels,
            data: getDeviceActivitySeries(getDevices(), buckets, bucketMs)
        };
    }

    return { labels, data: counts };
}

function getOnTimeDeliveryRatePercent() {
    const deliveries = getDeliveries();
    if (!deliveries.length) return 0;

    const completed = deliveries.filter(d => isDeliveryCompleted(d));
    if (!completed.length) return 0;

    let onTimeCount = 0;
    completed.forEach(delivery => {
        const plannedArrivalTs = parseTimestampToMs(delivery.plannedArrivalAt);
        const actualArrivalTs = parseTimestampToMs(delivery.completedAt)
            || parseTimestampToMs(delivery.actualArrivalAt)
            || parseTimestampToMs(delivery.actualArrival);
        if (!plannedArrivalTs || !actualArrivalTs) {
            onTimeCount += 1;
            return;
        }
        if (actualArrivalTs <= plannedArrivalTs) {
            onTimeCount += 1;
        }
    });

    return Math.max(0, Math.min(100, Math.round((onTimeCount / completed.length) * 100)));
}

function getFuelComparisonSeriesFromSamples(samples, dayCount = 7) {
    const bucketMs = 24 * 60 * 60 * 1000;
    const totalDays = dayCount * 2;
    const buckets = getLastNDays(totalDays, getStartOfToday());
    const fullSeries = getAnalyticsSeriesFromSamples(samples, buckets, bucketMs, 'avgBattery');
    return {
        labels: buckets.slice(dayCount).map(date => formatBucketLabel(date, 'day')),
        previous: fullSeries.slice(0, dayCount),
        current: fullSeries.slice(dayCount)
    };
}

function updateTemperatureChart() {
    const canvas = document.getElementById('temperatureChart');
    if (!canvas) return;

    if (charts.temperature) {
        charts.temperature.destroy();
    }

    const ctx = canvas.getContext('2d');
    const shipmentSeries = getShipmentVolumeSeries(30);
    const maxValue = Math.max(...shipmentSeries.data, 0);
    const yMax = Math.max(200, Math.ceil(maxValue / 50) * 50);

    charts.temperature = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: shipmentSeries.labels,
            datasets: [{
                label: 'Shipments',
                data: shipmentSeries.data,
                backgroundColor: 'rgba(37, 99, 235, 0.75)',
                borderColor: 'rgb(37, 99, 235)',
                borderWidth: 1,
                borderRadius: 4,
                maxBarThickness: 18
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
                        label: context => `${context.parsed.y} shipments`
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 10
                    }
                },
                y: {
                    beginAtZero: true,
                    max: yMax,
                    ticks: {
                        stepSize: 50
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.2)'
                    }
                }
            }
        }
    });
}

function updateHumidityChart() {
    const canvas = document.getElementById('humidityChart');
    if (!canvas) return;

    if (charts.humidity) {
        charts.humidity.destroy();
    }

    const ctx = canvas.getContext('2d');
    const rate = getOnTimeDeliveryRatePercent();
    const rateLabelPlugin = {
        id: 'onTimeRateLabel',
        afterDraw(chart) {
            const { ctx: drawCtx } = chart;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || !meta.data.length) return;
            const center = meta.data[0];

            drawCtx.save();
            drawCtx.textAlign = 'center';
            drawCtx.textBaseline = 'middle';
            drawCtx.fillStyle = '#1f2937';
            drawCtx.font = '700 20px Inter, sans-serif';
            drawCtx.fillText(`${rate}%`, center.x, center.y - 4);
            drawCtx.fillStyle = '#6b7280';
            drawCtx.font = '500 11px Inter, sans-serif';
            drawCtx.fillText('On-time', center.x, center.y + 16);
            drawCtx.restore();
        }
    };

    charts.humidity = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['On-time', 'Remaining'],
            datasets: [{
                data: [rate, 100 - rate],
                backgroundColor: ['rgb(37, 99, 235)', 'rgba(148, 163, 184, 0.25)'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context => `${context.label}: ${context.parsed}%`
                    }
                }
            }
        },
        plugins: [rateLabelPlugin]
    });
}

function updateBatteryChart() {
    const canvas = document.getElementById('batteryChart');
    if (!canvas) return;

    if (charts.battery) {
        charts.battery.destroy();
    }

    const fallbackAvg = (() => {
        const values = getDevices()
            .map(device => Number(device.battery))
            .filter(value => Number.isFinite(value));
        if (!values.length) return 0;
        return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
    })();

    const initial = getFuelComparisonSeriesFromSamples(analyticsSamplesCache, 7);
    const labels = initial.labels.length ? initial.labels : getLastNDays(7, getStartOfToday()).map(date => formatBucketLabel(date, 'day'));
    const currentSeries = initial.current.some(value => Number.isFinite(value) && value > 0)
        ? initial.current
        : new Array(labels.length).fill(fallbackAvg);
    const previousSeries = initial.previous.some(value => Number.isFinite(value) && value > 0)
        ? initial.previous
        : new Array(labels.length).fill(null);

    charts.battery = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Previous 7 days',
                    data: previousSeries,
                    backgroundColor: 'rgba(148, 163, 184, 0.45)',
                    borderColor: 'rgba(100, 116, 139, 0.9)',
                    borderWidth: 1,
                    borderRadius: 5
                },
                {
                    label: 'Current 7 days',
                    data: currentSeries,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1,
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12
                    }
                },
                tooltip: {
                    callbacks: {
                        label: context => `${context.dataset.label}: ${Number(context.parsed.y || 0).toFixed(1)}% battery`
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
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Battery %' },
                    ticks: {
                        callback: value => `${value}%`
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.2)'
                    }
                }
            }
        }
    });

    const comparisonRange = {
        unit: 'day',
        count: 14,
        bucketMs: 24 * 60 * 60 * 1000,
        endTime: getStartOfToday()
    };

    fetchAnalyticsSamples(comparisonRange).then(samples => {
        if (!charts.battery || !Array.isArray(samples) || !samples.length) return;
        const liveSeries = getFuelComparisonSeriesFromSamples(samples, 7);
        if (!liveSeries.labels.length) return;
        charts.battery.data.labels = liveSeries.labels;
        charts.battery.data.datasets[0].data = liveSeries.previous;
        charts.battery.data.datasets[1].data = liveSeries.current;
        charts.battery.update();
    }).catch(() => {});
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
    safeSetItem('lte_tracker_settings', JSON.stringify(settings));
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
    
    // Update device status/details even when GPS fix is missing.
    // This keeps connection state accurate as "No GPS" instead of "Not connected".
        updateDeviceFromTracker(displayData);
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
    // Match by device ID, tracker name, or IMEI so configurator packets bind reliably.
    const devices = getDevices();
    const device = devices.find((d) =>
        d.id === data.deviceId ||
        d.name === data.deviceId ||
        (data.imei && d.id === data.imei) ||
        (d.lte && d.lte.imei && (d.lte.imei === data.deviceId || d.lte.imei === data.imei))
    );
    
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
        device.status = hasValidCoordinates(device.latitude, device.longitude) ? 'active' : 'warning';
        
        // Update tracker info
        if (device.tracker) {
            device.tracker.lastFix = data.timestamp;
            device.tracker.satellites = data.satellites;
            device.tracker.accuracy = data.accuracy;
        }
        evaluateDeviceLogisticsConditions(device);
        
        safeSetItem('cargotrack_devices', JSON.stringify(devices));
        
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
window.viewDeliveryRoute = viewDeliveryRoute;
window.exportDeliveryRoute = exportDeliveryRoute;
window.editDelivery = editDelivery;
window.deleteDelivery = deleteDelivery;
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
                <td colspan="7" class="empty-state">No devices match the current filter.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.slice(0, 10).map(device => {
        const batteryVal = toFiniteNumber(device.battery);
        const tempVal = toFiniteNumber(device.temperature);
        const speedVal = toFiniteNumber(device.speed);
        const connection = getConnectionStatus(device);
        return `
        <tr>
            <td>${device.id}</td>
            <td><span class="status-badge ${connection.className}">${connection.label}</span></td>
            <td>${batteryVal !== null ? batteryVal + '%' : 'N/A'}</td>
            <td>${tempVal !== null ? tempVal + '°C' : 'N/A'}</td>
            <td>${speedVal !== null ? speedVal + ' km/h' : 'N/A'}</td>
            <td>${formatTime(device.lastUpdate)}</td>
            <td>
                <button class="btn btn-outline btn-small" onclick="viewDevice('${device.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        </tr>
    `;
    }).join('');
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

    const header = ['Device ID', 'Connection', 'Battery', 'Temperature', 'Speed', 'Latitude', 'Longitude', 'Last Update'];
    const rows = filtered.map(device => {
        const connection = getConnectionStatus(device);
        const batteryVal = toFiniteNumber(device.battery);
        const tempVal = toFiniteNumber(device.temperature);
        const speedVal = toFiniteNumber(device.speed);
        return [
            device.id,
            connection.label,
            batteryVal !== null ? `${batteryVal}%` : 'N/A',
            tempVal !== null ? `${tempVal}` : 'N/A',
            speedVal !== null ? `${speedVal}` : 'N/A',
            device.latitude ?? 'N/A',
            device.longitude ?? 'N/A',
            formatTime(device.lastUpdate)
        ];
    });

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
    return token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {};
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
            return new Set(
                ids
                    .map((id) => String(id || '').trim())
                    .filter(Boolean)
            );
        }
    } catch (error) {
        console.warn('Failed to parse device registry:', error);
    }
    return new Set();
}

function saveDeviceRegistry(registry) {
    safeSetItem(DEVICE_REGISTRY_KEY, JSON.stringify(Array.from(registry)));
}

function normalizeImeiLike(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 10 ? digits : '';
}

function getIdLookupVariants(value) {
    const raw = String(value || '').trim();
    if (!raw) return [];
    const variants = new Set([raw]);
    const imeiLike = normalizeImeiLike(raw);
    if (imeiLike) variants.add(imeiLike);
    return Array.from(variants);
}

function registerDeviceIds(ids) {
    if (!Array.isArray(ids)) return;
    const registry = getDeviceRegistry();
    let updated = false;
    ids.forEach((id) => {
        const variants = getIdLookupVariants(id);
        variants.forEach((variant) => {
            if (!registry.has(variant)) {
                registry.add(variant);
                updated = true;
            }
        });
    });
    if (updated) {
        saveDeviceRegistry(registry);
        syncDeviceRegistryToServer(Array.from(registry));
    }
}

async function syncDeviceRegistryToServer(deviceIds) {
    if (!Array.isArray(deviceIds) || !deviceIds.length) return;
    try {
        const currentUser = safeGetCurrentUser();
        const hasSession = await ensureApiSessionToken(currentUser);
        if (!hasSession) return;
        let response = await fetch('/api/device-registry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getApiAuthHeaders()
            },
            body: JSON.stringify({ deviceIds })
        });
        if (response.status === 401) {
            const refreshed = await ensureApiSessionToken(currentUser, { forceRefresh: true });
            if (!refreshed) return;
            response = await fetch('/api/device-registry', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getApiAuthHeaders()
                },
                body: JSON.stringify({ deviceIds })
            });
        }
        if (!response.ok) {
            console.warn('Device registry sync failed with status:', response.status);
        }
    } catch (error) {
        console.warn('Device registry sync failed:', error);
    }
}

async function unregisterDeviceIdsOnServer(deviceIds) {
    if (!Array.isArray(deviceIds) || !deviceIds.length) return;
    try {
        const currentUser = safeGetCurrentUser();
        const hasSession = await ensureApiSessionToken(currentUser);
        if (!hasSession) return;
        let response = await fetch('/api/device-registry', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...getApiAuthHeaders()
            },
            body: JSON.stringify({ deviceIds })
        });
        if (response.status === 401) {
            const refreshed = await ensureApiSessionToken(currentUser, { forceRefresh: true });
            if (!refreshed) return;
            response = await fetch('/api/device-registry', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...getApiAuthHeaders()
                },
                body: JSON.stringify({ deviceIds })
            });
        }
        if (!response.ok) {
            console.warn('Device registry remove sync failed with status:', response.status);
        }
    } catch (error) {
        console.warn('Device registry remove sync failed:', error);
    }
}

function syncDeviceRegistryFromDevices(devices) {
    if (!Array.isArray(devices)) return;
    const previousRegistry = getDeviceRegistry();
    const registry = new Set();
    devices.forEach((device) => {
        getIdLookupVariants(device?.id).forEach((id) => registry.add(id));
        getIdLookupVariants(device?.lte?.imei).forEach((id) => registry.add(id));
    });
    const nextRegistry = Array.from(registry).sort();
    const prevRegistry = Array.from(previousRegistry).sort();
    if (nextRegistry.length === prevRegistry.length) {
        let unchanged = true;
        for (let i = 0; i < nextRegistry.length; i += 1) {
            if (nextRegistry[i] !== prevRegistry[i]) {
                unchanged = false;
                break;
            }
        }
        if (unchanged) return;
    }
    saveDeviceRegistry(registry);
    syncDeviceRegistryToServer(Array.from(registry));
}

function getDeviceIdentity(device) {
    if (!device || typeof device !== 'object') return null;
    const imei = normalizeImeiLike(device?.lte?.imei);
    const id = (device?.id || device?.deviceId || '').toString().trim();
    const idDigits = normalizeImeiLike(id);
    return imei || idDigits || id || null;
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
        safeSetItem(devicesKey, JSON.stringify([]));
        return [];
    }
    
    const parsed = JSON.parse(devices);
    const parsedList = Array.isArray(parsed) ? parsed : [];
    const deduped = dedupeDevicesByIdentity(parsedList);
    const filtered = deduped;
    if (filtered.length !== parsedList.length) {
        safeSetItem(devicesKey, JSON.stringify(filtered));
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
            safeSetItem(devicesKey, JSON.stringify(filtered));
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
    
    safeSetItem('cargotrack_devices', JSON.stringify(devices));
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

function normalizeAlertEntry(alert) {
    if (!alert || typeof alert !== 'object') return null;
    const ts = parseTimestampToMs(alert.timestamp) || Date.now();
    const severity = ['critical', 'warning', 'info'].includes(alert.severity) ? alert.severity : 'info';
    return {
        id: String(alert.id || `alert-${ts}-${Math.random().toString(36).slice(2, 7)}`),
        title: String(alert.title || 'Alert'),
        message: String(alert.message || ''),
        severity,
        icon: String(alert.icon || 'fas fa-bell'),
        read: Boolean(alert.read),
        timestamp: new Date(ts).toISOString()
    };
}

function normalizeAlertList(alerts) {
    if (!Array.isArray(alerts)) return [];
    const unique = new Map();
    alerts.forEach((item) => {
        const alert = normalizeAlertEntry(item);
        if (!alert) return;
        const existing = unique.get(alert.id);
        if (!existing) {
            unique.set(alert.id, alert);
            return;
        }
        const existingTs = parseTimestampToMs(existing.timestamp) || 0;
        const incomingTs = parseTimestampToMs(alert.timestamp) || 0;
        if (incomingTs >= existingTs) {
            unique.set(alert.id, {
                ...alert,
                // Keep unread if any source still has unread to avoid
                // flickering counts during server/local re-hydration.
                read: existing.read && alert.read
            });
        } else {
            unique.set(alert.id, {
                ...existing,
                read: existing.read && alert.read
            });
        }
    });
    return Array.from(unique.values())
        .sort((a, b) => (parseTimestampToMs(b.timestamp) || 0) - (parseTimestampToMs(a.timestamp) || 0))
        .slice(0, ALERTS_MAX_ENTRIES);
}

function getAlerts() {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) {
        safeSetItem(ALERTS_STORAGE_KEY, JSON.stringify([]));
        return [];
    }
    try {
        const normalized = normalizeAlertList(JSON.parse(raw));
        if (JSON.stringify(normalized) !== raw) {
            safeSetItem(ALERTS_STORAGE_KEY, JSON.stringify(normalized));
        }
        return normalized;
    } catch (error) {
        safeSetItem(ALERTS_STORAGE_KEY, JSON.stringify([]));
        return [];
    }
}

async function persistAlertsToServer(alerts) {
    const headers = getApiAuthHeaders();
    if (!headers.Authorization) return false;
    try {
        const response = await fetch(ALERTS_SYNC_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify({ events: normalizeAlertList(alerts) })
        });
        if (response.status === 401) {
            const currentUser = safeGetCurrentUser();
            if (currentUser) {
                await ensureApiSessionToken(currentUser, { forceRefresh: true });
            }
        }
        return response.ok;
    } catch (error) {
        console.warn('persistAlertsToServer failed:', error?.message || error);
        return false;
    }
}

function scheduleAlertsServerSync(alerts) {
    if (alertsSyncTimeoutId) {
        clearTimeout(alertsSyncTimeoutId);
        alertsSyncTimeoutId = null;
    }
    alertsSyncTimeoutId = setTimeout(() => {
        persistAlertsToServer(alerts).catch(() => {});
    }, 200);
}

function saveAlerts(alerts, options = {}) {
    const normalized = normalizeAlertList(alerts);
    safeSetItem(ALERTS_STORAGE_KEY, JSON.stringify(normalized));
    if (!options.skipServerSync && !isHydratingAlertsFromServer) {
        scheduleAlertsServerSync(normalized);
    }
}

function mergeAlertHistories(localAlerts, remoteAlerts) {
    return normalizeAlertList([...(Array.isArray(remoteAlerts) ? remoteAlerts : []), ...(Array.isArray(localAlerts) ? localAlerts : [])]);
}

async function hydrateAlertsFromServer(retryCount = 0) {
    if (isHydratingAlertsFromServer) return;
    const headers = getApiAuthHeaders();
    if (!headers.Authorization) return;
    isHydratingAlertsFromServer = true;
    try {
        const response = await fetch(ALERTS_SYNC_ENDPOINT, {
            method: 'GET',
            headers
        });
        if (response.status === 401 && retryCount < 1) {
            isHydratingAlertsFromServer = false;
            const currentUser = safeGetCurrentUser();
            if (currentUser) {
                await ensureApiSessionToken(currentUser, { forceRefresh: true });
            }
            return hydrateAlertsFromServer(retryCount + 1);
        }
        if (!response.ok) {
            console.warn('hydrateAlertsFromServer: server returned', response.status);
            return;
        }
        const payload = await response.json();
        const remoteAlerts = Array.isArray(payload?.events) ? payload.events : [];
        const merged = mergeAlertHistories(getAlerts(), remoteAlerts);
        saveAlerts(merged, { skipServerSync: true });
        loadAlerts();
        loadDashboardData();
    } catch (error) {
        console.warn('hydrateAlertsFromServer failed:', error?.message || error);
    } finally {
        isHydratingAlertsFromServer = false;
    }
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
    safeSetItem(LOGISTICS_STATE_KEY, JSON.stringify(state || {}));
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
    safeSetItem(storageKey, JSON.stringify(items));
}

function dispatchAlertChannels(alertEntry) {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) return;
    const settings = getLogisticsMonitoringSettings();
    if (settings.alertNotifications === false) return;

    if (settings.emailAlerts !== false && typeof sendEmail === 'function' && currentUser.email) {
        sendEmail(
            currentUser.email,
            `[Aurion] ${alertEntry.title}`,
            `${alertEntry.message}\n\nSeverity: ${alertEntry.severity}\nTime: ${new Date(alertEntry.timestamp).toLocaleString()}`,
            'logisticsAlert'
        );
    }

    if (settings.smsAlerts) {
        pushChannelNotification(SMS_NOTIFICATIONS_KEY, {
            id: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            to: settings.mobilePhone || currentUser.phone || '',
            message: `[Aurion] ${alertEntry.title}: ${alertEntry.message}`,
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
    const plannedDelivery = getDeliveryForDevice(device);
    if (plannedDelivery) {
        device.logistics = {
            ...(device.logistics || {}),
            expectedDeliveryAt: plannedDelivery.plannedArrivalAt || device?.logistics?.expectedDeliveryAt || null,
            startAreaId: plannedDelivery.pickupAreaId || device?.logistics?.startAreaId || null,
            startAreaName: plannedDelivery.pickupAreaName || device?.logistics?.startAreaName || '',
            destinationAreaId: plannedDelivery.dropoffAreaId || device?.logistics?.destinationAreaId || null,
            destinationAreaName: plannedDelivery.dropoffAreaName || device?.logistics?.destinationAreaName || ''
        };
    }
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

            // Auto-finalize the currently active delivery for this tracker
            // once the device enters the configured destination area.
            const deliveryList = getDeliveries();
            const deviceIds = new Set([
                ...getIdLookupVariants(device?.id),
                ...getIdLookupVariants(device?.lte?.imei)
            ]);
            const activeCandidates = deliveryList
                .filter((delivery) => {
                    if (!delivery) return false;
                    const status = normalizeDeliveryStatus(delivery.status);
                    if (!['planned', 'in_transit', 'delayed', 'missed'].includes(status)) return false;
                    return deviceIds.has(String(delivery.deviceId || '').trim());
                })
                .sort((a, b) => {
                    const rank = (status) => {
                        const normalized = normalizeDeliveryStatus(status);
                        if (normalized === 'in_transit') return 0;
                        if (normalized === 'delayed') return 1;
                        if (normalized === 'planned') return 2;
                        return 3;
                    };
                    const aRank = rank(a.status);
                    const bRank = rank(b.status);
                    if (aRank !== bRank) return aRank - bRank;
                    const aTs = parseTimestampToMs(a.updatedAt)
                        || parseTimestampToMs(a.plannedArrivalAt)
                        || parseTimestampToMs(a.plannedDepartureAt)
                        || parseTimestampToMs(a.createdAt)
                        || 0;
                    const bTs = parseTimestampToMs(b.updatedAt)
                        || parseTimestampToMs(b.plannedArrivalAt)
                        || parseTimestampToMs(b.plannedDepartureAt)
                        || parseTimestampToMs(b.createdAt)
                        || 0;
                    return bTs - aTs;
                });
            if (activeCandidates.length) {
                const active = activeCandidates[0];
                const resolvedAtIso = new Date(now).toISOString();
                active.status = 'arrived';
                active.actualArrivalAt = active.actualArrivalAt || resolvedAtIso;
                active.completedAt = active.completedAt || resolvedAtIso;
                active.currentDelayMinutes = 0;
                active.updatedAt = resolvedAtIso;
                saveDeliveries(deliveryList);
                loadDeliveries();
                loadDevices();
                loadDashboardData();
            }
        }
        routeState.lastAreaId = currentAreaId;
    }
    state[routeStateKey] = routeState;

    const temp = toFiniteNumber(device.temperature);
    const humidity = toFiniteNumber(device.humidity);
    const tilt = toFiniteNumber(device.tilt ?? device?.tracker?.tilt);
    const collision = toFiniteNumber(device.collision ?? device?.tracker?.collision);
    const expectedDeliveryAt = device?.logistics?.expectedDeliveryAt || plannedDelivery?.plannedArrivalAt || device?.expectedDeliveryAt || null;
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
    let deliveryDelayMinutes = 0;
    if (expectedDeliveryAt && normalizeDeliveryStatus(plannedDelivery?.status || logistics.status || 'planned') !== 'arrived') {
        const expectedTs = parseTimestampToMs(expectedDeliveryAt);
        if (Number.isFinite(expectedTs)) {
            const graceMs = Math.max(0, Number(deliveryGraceMinutes || 0)) * 60 * 1000;
            deliveryDelayActive = now > expectedTs + graceMs;
            if (deliveryDelayActive) {
                deliveryDelayMinutes = Math.max(0, Math.floor((now - (expectedTs + graceMs)) / 60000));
            }
        }
    }
    triggerCondition({
        key: 'delivery-delay',
        active: deliveryDelayActive,
        title: 'Delivery Delay Alert',
        message: `${device.name || deviceKey} delivery ETA has been exceeded by ${formatDurationMinutes(deliveryDelayMinutes)}.`,
        severity: 'warning',
        icon: 'fas fa-clock'
    });

    saveLogisticsState(state);
}

function runLogisticsMonitoringSweep() {
    const devices = applyDeliveryPlansToDevices(getDevices());
    devices.forEach((device) => evaluateDeviceLogisticsConditions(device));
    evaluateDeliveryScheduleConditions();
}

function evaluateDeliveryScheduleConditions() {
    const deliveries = getDeliveries();
    if (!deliveries.length) return;
    const now = Date.now();
    const state = getLogisticsState();
    const cooldownMs = 15 * 60 * 1000;
    let hasDeliveryUpdates = false;

    // Reconcile stale overlapping deliveries for the same device:
    // when a newer trip has already started (or should have started),
    // older active trips are auto-closed as arrived.
    const activeStatuses = new Set(['planned', 'in_transit', 'delayed', 'missed']);
    const byDevice = new Map();
    deliveries.forEach((delivery) => {
        if (!delivery) return;
        if (isDeliveryCompleted(delivery)) return;
        const status = normalizeDeliveryStatus(delivery.status);
        if (!activeStatuses.has(status)) return;
        const key = String(delivery.deviceId || delivery.imei || delivery.deviceImei || delivery.trackerId || '').trim();
        if (!key) return;
        if (!byDevice.has(key)) byDevice.set(key, []);
        byDevice.get(key).push(delivery);
    });
    byDevice.forEach((deviceDeliveries) => {
        if (!Array.isArray(deviceDeliveries) || deviceDeliveries.length < 2) return;
        const anchorTs = (delivery) => (
            parseTimestampToMs(delivery.plannedDepartureAt)
            || parseTimestampToMs(delivery.startedAt)
            || parseTimestampToMs(delivery.updatedAt)
            || parseTimestampToMs(delivery.createdAt)
            || 0
        );
        const sorted = deviceDeliveries.slice().sort((a, b) => anchorTs(a) - anchorTs(b));
        for (let i = 0; i < sorted.length - 1; i += 1) {
            const current = sorted[i];
            const next = sorted[i + 1];
            if (!current || !next || isDeliveryCompleted(current)) continue;
            const nextStatus = normalizeDeliveryStatus(next.status);
            const nextDepartureTs = parseTimestampToMs(next.plannedDepartureAt);
            const nextStarted = nextStatus !== 'planned' || (Number.isFinite(nextDepartureTs) && now >= nextDepartureTs);
            if (!nextStarted) continue;
            const resolvedAtTs = Number.isFinite(nextDepartureTs)
                ? nextDepartureTs
                : (parseTimestampToMs(next.startedAt) || parseTimestampToMs(next.updatedAt) || now);
            const resolvedAtIso = new Date(resolvedAtTs).toISOString();
            current.status = 'arrived';
            current.actualArrivalAt = current.actualArrivalAt || resolvedAtIso;
            current.completedAt = current.completedAt || resolvedAtIso;
            current.currentDelayMinutes = 0;
            current.updatedAt = resolvedAtIso;
            hasDeliveryUpdates = true;
        }
    });

    deliveries.forEach((delivery) => {
        let status = normalizeDeliveryStatus(delivery.status);
        const isCompleted = isDeliveryCompleted(delivery);
        const departureTs = parseTimestampToMs(delivery.plannedDepartureAt);
        const arrivalTs = parseTimestampToMs(delivery.plannedArrivalAt);
        const existingDelayStartTs = parseTimestampToMs(delivery.delayStartedAt);
        const destinationArea = getAreaById(delivery.dropoffAreaId);
        if (!isCompleted && destinationArea && Array.isArray(delivery.routePoints) && delivery.routePoints.length) {
            const departureAnchorTs = Number.isFinite(departureTs)
                ? departureTs
                : (parseTimestampToMs(delivery.startedAt) || parseTimestampToMs(delivery.createdAt) || 0);
            const routePoints = normalizeRoutePoints(delivery.routePoints);
            const reachedDestinationPoint = routePoints
                .filter((point) => {
                    const pointTs = parseTimestampToMs(point.timestamp) || 0;
                    if (departureAnchorTs && pointTs && pointTs < departureAnchorTs) return false;
                    return isCoordinatesInsideArea(point.latitude, point.longitude, destinationArea);
                })
                .pop();
            if (reachedDestinationPoint) {
                const reachedTs = parseTimestampToMs(reachedDestinationPoint.timestamp) || now;
                const reachedIso = new Date(reachedTs).toISOString();
                delivery.status = 'arrived';
                delivery.actualArrivalAt = delivery.actualArrivalAt || reachedIso;
                delivery.completedAt = delivery.completedAt || reachedIso;
                delivery.currentDelayMinutes = 0;
                delivery.updatedAt = reachedIso;
                status = 'arrived';
                hasDeliveryUpdates = true;
            }
        }
        const shouldTrackDelay = !isCompleted
            && Number.isFinite(arrivalTs)
            && now > arrivalTs
            && ['planned', 'in_transit', 'delayed', 'missed'].includes(status);
        const delayStartTs = Number.isFinite(existingDelayStartTs) ? existingDelayStartTs : (shouldTrackDelay ? arrivalTs : null);
        const currentDelayMinutes = Number.isFinite(delayStartTs)
            ? Math.max(0, Math.floor((now - delayStartTs) / 60000))
            : 0;

        if (isCompleted && status !== 'arrived') {
            delivery.status = 'arrived';
            hasDeliveryUpdates = true;
        }

        if (shouldTrackDelay && !Number.isFinite(existingDelayStartTs)) {
            delivery.delayStartedAt = new Date(delayStartTs).toISOString();
            hasDeliveryUpdates = true;
        }
        if (Number(delivery.currentDelayMinutes || 0) !== currentDelayMinutes) {
            delivery.currentDelayMinutes = currentDelayMinutes;
            hasDeliveryUpdates = true;
        }
        if (shouldTrackDelay && status !== 'delayed') {
            delivery.status = 'delayed';
            hasDeliveryUpdates = true;
        }
        if (!shouldTrackDelay && Number(delivery.currentDelayMinutes || 0) !== 0) {
            delivery.currentDelayMinutes = 0;
            hasDeliveryUpdates = true;
        }
        if (!shouldTrackDelay && delivery.delayStartedAt && isCompleted) {
            const completionTs = parseTimestampToMs(delivery.actualArrivalAt)
                || parseTimestampToMs(delivery.actualArrival)
                || parseTimestampToMs(delivery.completedAt)
                || now;
            if (!delivery.delayResolvedAt) {
                const sessionDelayMinutes = Number.isFinite(existingDelayStartTs)
                    ? Math.max(0, Math.floor((completionTs - existingDelayStartTs) / 60000))
                    : 0;
                const previousTotal = Number(delivery.totalDelayMinutes);
                const safePreviousTotal = Number.isFinite(previousTotal) ? previousTotal : 0;
                delivery.totalDelayMinutes = safePreviousTotal + sessionDelayMinutes;
                delivery.delayResolvedAt = new Date(completionTs).toISOString();
                hasDeliveryUpdates = true;
            }
        }
        if (status === 'arrived' && Number.isFinite(existingDelayStartTs) && !delivery.delayResolvedAt) {
            const resolvedAt = parseTimestampToMs(delivery.actualArrivalAt) || now;
            const sessionDelayMinutes = Math.max(0, Math.floor((resolvedAt - existingDelayStartTs) / 60000));
            const previousTotal = Number(delivery.totalDelayMinutes);
            const safePreviousTotal = Number.isFinite(previousTotal) ? previousTotal : 0;
            delivery.totalDelayMinutes = safePreviousTotal + sessionDelayMinutes;
            delivery.currentDelayMinutes = 0;
            delivery.delayResolvedAt = new Date(resolvedAt).toISOString();
            hasDeliveryUpdates = true;
        }
        const statusKeyPrefix = `delivery-schedule:${delivery.id}`;
        const trigger = (suffix, active, payload) => {
            const key = `${statusKeyPrefix}:${suffix}`;
            const current = state[key] || { active: false, lastAlertAt: 0 };
            if (active && (!current.active || now - Number(current.lastAlertAt || 0) >= cooldownMs)) {
                addAlertEntry(payload);
                state[key] = { active: true, lastAlertAt: now };
                return;
            }
            if (!active && current.active) {
                state[key] = { active: false, lastAlertAt: Number(current.lastAlertAt || 0) };
                return;
            }
            if (!state[key]) {
                state[key] = { active: false, lastAlertAt: 0 };
            }
        };

        trigger(
            'missed-departure',
            Number.isFinite(departureTs) && now > departureTs && status === 'planned',
            {
                title: 'Planned Departure Missed',
                message: `${delivery.reference || delivery.id} has not departed on schedule.`,
                severity: 'warning',
                icon: 'fas fa-clock'
            }
        );
        trigger(
            'missed-arrival',
            Number.isFinite(arrivalTs) && now > arrivalTs && (status === 'planned' || status === 'in_transit'),
            {
                title: 'Planned Arrival Missed',
                message: `${delivery.reference || delivery.id} has exceeded planned arrival time by ${formatDurationMinutes(currentDelayMinutes)}.`,
                severity: 'warning',
                icon: 'fas fa-hourglass-end'
            }
        );
    });
    if (hasDeliveryUpdates) {
        saveDeliveries(deliveries);
        loadDeliveries();
    }
    saveLogisticsState(state);
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
    safeSetItem(AREA_STATE_STORAGE_KEY, JSON.stringify(state));
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
    const activities = [];
    const now = Date.now();

    const deliveries = typeof getDeliveries === 'function' ? getDeliveries() : [];
    deliveries.forEach(delivery => {
        if (!delivery) return;
        const ref = delivery.reference || delivery.id || 'Unknown';

        const completedTs = parseTimestampToMs(delivery.completedAt) || parseTimestampToMs(delivery.actualArrivalAt);
        if (completedTs) {
            activities.push({
                title: 'Delivery Completed',
                description: `${ref} delivered to ${delivery.dropoffAreaName || 'destination'}`,
                icon: 'fas fa-check-circle',
                color: '#22c55e',
                time: formatTimeAgo(completedTs),
                ts: completedTs
            });
        }

        const startedTs = parseTimestampToMs(delivery.startedAt) || parseTimestampToMs(delivery.actualDepartureAt);
        if (startedTs && normalizeDeliveryStatus(delivery.status) === 'in_transit') {
            activities.push({
                title: 'Shipment Departed',
                description: `${ref} departed from ${delivery.pickupAreaName || 'origin'}`,
                icon: 'fas fa-truck',
                color: '#3b82f6',
                time: formatTimeAgo(startedTs),
                ts: startedTs
            });
        }

        const createdTs = parseTimestampToMs(delivery.createdAt);
        if (createdTs && !completedTs && !startedTs) {
            activities.push({
                title: 'Delivery Planned',
                description: `${ref} scheduled for ${delivery.dropoffAreaName || 'destination'}`,
                icon: 'fas fa-calendar-plus',
                color: '#8b5cf6',
                time: formatTimeAgo(createdTs),
                ts: createdTs
            });
        }

        if (getDeliveryCurrentDelayMinutes(delivery, now) > 0) {
            const delayTs = parseTimestampToMs(delivery.delayStartedAt) || parseTimestampToMs(delivery.plannedArrivalAt) || now;
            activities.push({
                title: 'Delivery Delayed',
                description: `${ref} is delayed by ${formatDurationMinutes(getDeliveryCurrentDelayMinutes(delivery, now))}`,
                icon: 'fas fa-exclamation-triangle',
                color: '#f59e0b',
                time: formatTimeAgo(delayTs),
                ts: delayTs
            });
        }
    });

    const alerts = typeof getAlerts === 'function' ? getAlerts() : [];
    alerts.filter(a => !a.read).slice(0, 5).forEach(alert => {
        const ts = parseTimestampToMs(alert.timestamp) || now;
        activities.push({
            title: alert.title || 'Alert',
            description: alert.message || '',
            icon: alert.icon || 'fas fa-bell',
            color: alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6',
            time: formatTimeAgo(ts),
            ts
        });
    });

    const devices = typeof getDevices === 'function' ? getDevices() : [];
    devices.forEach(device => {
        const updateTs = getDeviceLastUpdateTimestamp(device);
        if (updateTs && now - updateTs <= 5 * 60 * 1000) {
            activities.push({
                title: 'Device Updated',
                description: `${device.name || device.id} reported location`,
                icon: 'fas fa-satellite-dish',
                color: '#06b6d4',
                time: formatTimeAgo(updateTs),
                ts: updateTs
            });
        }
    });

    activities.sort((a, b) => b.ts - a.ts);
    return activities.slice(0, 10);
}

function formatTimeAgo(timestamp) {
    const ms = typeof timestamp === 'number' ? timestamp : parseTimestampToMs(timestamp);
    if (!ms || !Number.isFinite(ms)) return '';
    const diff = Date.now() - ms;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

// Utility functions
function parseTimestampToMs(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null;
        return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
    }

    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    const normalized = String(value).trim();
    if (!normalized) return null;

    if (/^\d+(\.\d+)?$/.test(normalized)) {
        const numeric = Number(normalized);
        if (!Number.isFinite(numeric)) return null;
        return numeric < 1e12 ? Math.round(numeric * 1000) : Math.round(numeric);
    }

    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseIntervalToMs(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0) return null;
        return value < 1000 ? Math.round(value * 1000) : Math.round(value);
    }

    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return null;
    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|m|min|mins|h|hr|hrs)?$/i);
    if (!match) return null;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const unit = (match[2] || '').toLowerCase();
    if (!unit) {
        return amount < 1000 ? Math.round(amount * 1000) : Math.round(amount);
    }
    if (unit === 'ms') return Math.round(amount);
    if (unit === 's' || unit === 'sec' || unit === 'secs') return Math.round(amount * 1000);
    if (unit === 'm' || unit === 'min' || unit === 'mins') return Math.round(amount * 60 * 1000);
    if (unit === 'h' || unit === 'hr' || unit === 'hrs') return Math.round(amount * 60 * 60 * 1000);
    return null;
}

function getDeviceStaleThresholdMs(device) {
    const configuredIntervalMs = parseIntervalToMs(device?.lte?.dataLogFrequency);
    if (!configuredIntervalMs) return STALE_DEVICE_MS;

    // Consider device stale only after several missed reports plus a small buffer.
    const adaptiveThreshold = Math.round((configuredIntervalMs * 4) + 30000);
    return Math.max(STALE_DEVICE_MS, Math.min(adaptiveThreshold, 30 * 60 * 1000));
}

function formatTime(isoString) {
    const ts = parseTimestampToMs(isoString);
    if (!Number.isFinite(ts)) return 'Unknown';
    const date = new Date(ts);
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
    const ts = parseTimestampToMs(isoString);
    if (!Number.isFinite(ts)) return 'Unknown';
    return new Date(ts).toLocaleDateString();
}

function hasValidCoordinates(latitude, longitude) {
    return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function getConnectionStatus(device) {
    const best = getMostRecentDeviceTimestamp(device);
    if (!best) {
        return { label: 'Not connected', className: 'inactive' };
    }
    const lastSeen = best.ms;
    const isStale = Date.now() - lastSeen > getDeviceStaleThresholdMs(device);
    const status = isStale
        ? { label: 'Stale', className: 'warning' }
        : (hasValidCoordinates(device.latitude, device.longitude)
            ? { label: 'Connected', className: 'active' }
            : { label: 'No GPS', className: 'warning' });

    if (isStale) {
        return { label: 'Stale', className: 'warning' };
    }
    if (hasValidCoordinates(device.latitude, device.longitude)) {
        return { label: 'Connected', className: 'active' };
    }
    // Telemetry can be present without a usable GPS fix.
    // In that case do not report "Connected" for map/location accuracy.
    return { label: 'No GPS', className: 'warning' };
}

function getLastSeenText(device) {
    const best = getMostRecentDeviceTimestamp(device);
    if (!best) return 'No data yet';
    return formatTime(best.raw);
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

async function deleteDevice(deviceId) {
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
    safeSetItem('cargotrack_devices', JSON.stringify(updatedDevices));
    const registry = getDeviceRegistry();
    registry.delete(deviceId);
    if (device.lte?.imei) {
        registry.delete(device.lte.imei);
    }
    saveDeviceRegistry(registry);
    await unregisterDeviceIdsOnServer([deviceId, device.lte?.imei].filter(Boolean));

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
        showToast('Please login to export your data.', 'warning');
        return;
    }
    
    if (confirm('This will download a JSON file containing all your personal data. Continue?')) {
        const data = exportUserData(currentUser.id);
        if (data) {
            showToast('Your data has been exported successfully!', 'success');
        }
    }
}

function deleteMyAccount() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) {
        showToast('Please login to delete your account.', 'warning');
        return;
    }
    
    const confirmText = prompt('Type "DELETE" to confirm permanent account deletion:');
    if (confirmText === 'DELETE') {
        const result = deleteUserData(currentUser.id);
        if (result.success) {
            showToast('Your account and all data have been permanently deleted.', 'success');
            setTimeout(() => logout(), 1500);
        } else {
            showToast(result.message || 'Deletion failed.', 'error');
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
        showToast('Please login to save settings.', 'warning');
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
    showToast('Notification preferences saved successfully!', 'success');
}

// Support Functions
function openSupportChat() {
    if (window.supportBot) {
        window.supportBot.toggle();
    } else {
        showToast('Support chat is loading. Please try again in a moment.', 'info');
    }
}

function openEmailSupport() {
    const currentUser = safeGetCurrentUser();
    const email = 'info@aurion.io';
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
    const nicknameInput = document.getElementById('settingsNickname');
    
    if (companyInput) companyInput.value = currentUser.company || '';
    if (emailInput) emailInput.value = currentUser.email || '';
    if (phoneInput) phoneInput.value = currentUser.phone || '';
    if (nicknameInput) nicknameInput.value = currentUser.nickname || '';

    const previewInitials = document.getElementById('settingsAvatarInitials');
    const previewImg = document.getElementById('settingsAvatarImg');
    const removeBtn = document.getElementById('settingsAvatarRemove');
    if (previewInitials) previewInitials.textContent = getUserInitials(currentUser);
    if (currentUser.avatarUrl) {
        if (previewImg) { previewImg.src = currentUser.avatarUrl; previewImg.style.display = ''; }
        if (previewInitials) previewInitials.style.display = 'none';
        if (removeBtn) removeBtn.style.display = '';
    } else {
        if (previewImg) previewImg.style.display = 'none';
        if (previewInitials) previewInitials.style.display = '';
        if (removeBtn) removeBtn.style.display = 'none';
    }

    const avatarInput = document.getElementById('settingsAvatarInput');
    if (avatarInput && !avatarInput._bound) {
        avatarInput._bound = true;
        avatarInput.addEventListener('change', handleAvatarUpload);
    }
    if (removeBtn && !removeBtn._bound) {
        removeBtn._bound = true;
        removeBtn.addEventListener('click', handleAvatarRemove);
    }
}

function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
        showToast('Image must be under 512 KB.', 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(ev) {
        const dataUrl = ev.target.result;
        const previewImg = document.getElementById('settingsAvatarImg');
        const previewInitials = document.getElementById('settingsAvatarInitials');
        const removeBtn = document.getElementById('settingsAvatarRemove');
        if (previewImg) { previewImg.src = dataUrl; previewImg.style.display = ''; }
        if (previewInitials) previewInitials.style.display = 'none';
        if (removeBtn) removeBtn.style.display = '';
        document.getElementById('settingsAvatarInput')._pendingUrl = dataUrl;
    };
    reader.readAsDataURL(file);
}

function handleAvatarRemove() {
    const previewImg = document.getElementById('settingsAvatarImg');
    const previewInitials = document.getElementById('settingsAvatarInitials');
    const removeBtn = document.getElementById('settingsAvatarRemove');
    const avatarInput = document.getElementById('settingsAvatarInput');
    if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
    if (previewInitials) previewInitials.style.display = '';
    if (removeBtn) removeBtn.style.display = 'none';
    if (avatarInput) { avatarInput.value = ''; avatarInput._pendingUrl = null; }
    document.getElementById('settingsAvatarInput')._pendingRemove = true;
}

function saveAccountSettings() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) {
        showToast('Please login to save settings.', 'warning');
        return;
    }
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex !== -1) {
        users[userIndex].company = document.getElementById('settingsCompany').value;
        users[userIndex].email = document.getElementById('settingsEmail').value;
        users[userIndex].phone = document.getElementById('settingsPhone').value;
        users[userIndex].nickname = document.getElementById('settingsNickname')?.value || '';

        const avatarInput = document.getElementById('settingsAvatarInput');
        if (avatarInput?._pendingRemove) {
            delete users[userIndex].avatarUrl;
            avatarInput._pendingRemove = false;
        } else if (avatarInput?._pendingUrl) {
            users[userIndex].avatarUrl = avatarInput._pendingUrl;
            avatarInput._pendingUrl = null;
        }
        
        saveUsers(users);
        
        // Update current session
        const session = JSON.parse(localStorage.getItem('cargotrack_auth'));
        if (session) {
            session.user = users[userIndex];
            safeSetItem('cargotrack_auth', JSON.stringify(session));
        }

        updateCurrentUserUi(users[userIndex]);
        
        showToast('Account settings saved successfully!', 'success');
    }
}

function submitSupportRequest(e) {
    e.preventDefault();
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showToast('Please login to submit a support request.', 'warning');
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
    safeSetItem(supportRequestsKey, JSON.stringify(requests));
    
    // Send confirmation email
    if (typeof sendEmail === 'function') {
        sendEmail(
            currentUser.email,
            'Support Request Received - Aurion',
            `Dear ${currentUser.company || currentUser.email.split('@')[0]},\n\nWe have received your support request:\n\nSubject: ${subject}\nCategory: ${category}\n\nOur team will review your request and respond within 24 hours.\n\nThank you for contacting Aurion support.\n\nBest regards,\nAurion Support Team`,
            'supportRequest'
        );
    }
    
    showToast('Support request submitted successfully! We will respond within 24 hours.', 'success');
    document.getElementById('supportRequestForm').reset();
}

/* ═══════════════════════════════════════════════════════════════
   INTELLIGENCE — Risk Engine, Compliance Reports, Insurance
   ═══════════════════════════════════════════════════════════════ */

let riskGaugeChart = null;
let riskTrendChart = null;
let insuranceComparisonChart = null;
let _lastRiskData = null;
let _lastComplianceData = null;
let _lastInsuranceData = null;

function formatEurInt(v) {
    return '€' + Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function riskLevelClass(level) {
    const l = (level || '').toLowerCase();
    if (l === 'low') return 'risk-low';
    if (l === 'medium') return 'risk-medium';
    if (l === 'high') return 'risk-high';
    return 'risk-critical';
}

function riskColor(level) {
    const l = (level || '').toLowerCase();
    if (l === 'low') return '#22c55e';
    if (l === 'medium') return '#eab308';
    if (l === 'high') return '#f97316';
    return '#ef4444';
}

function factorLevel(v) {
    if (v <= 30) return 'low';
    if (v <= 60) return 'medium';
    if (v <= 80) return 'high';
    return 'critical';
}

// ── Risk Overview ──

async function refreshRiskData(forceRefresh) {
    const headers = getSessionAuthHeaders();
    if (!headers.Authorization) return;
    try {
        const url = '/api/risk-engine' + (forceRefresh ? '?refresh=true' : '');
        const resp = await fetch(url, { headers });
        if (!resp.ok) throw new Error('Risk API error ' + resp.status);
        const data = await resp.json();
        _lastRiskData = data;
        renderRiskGauge(data);
        renderRiskTrend(data);
        renderRiskDeviceTable(data);
        renderAiSummary(data);
    } catch (err) {
        console.warn('[intelligence] risk fetch failed:', err);
    }
}

function renderRiskGauge(data) {
    const canvas = document.getElementById('riskGaugeChart');
    if (!canvas) return;
    const score = data.fleetScore ?? 0;
    const level = data.fleetLevel || 'low';
    const color = riskColor(level);
    const remaining = 100 - score;

    if (riskGaugeChart) riskGaugeChart.destroy();
    riskGaugeChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, remaining],
                backgroundColor: [color, '#e2e8f0'],
                borderWidth: 0,
                cutout: '78%'
            }]
        },
        options: {
            responsive: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            rotation: -90,
            circumference: 180
        }
    });

    const label = document.getElementById('riskGaugeLabel');
    const badge = document.getElementById('riskGaugeLevel');
    if (label) label.textContent = score + '/100';
    if (badge) {
        badge.textContent = level.charAt(0).toUpperCase() + level.slice(1) + ' Risk';
        badge.className = 'risk-level-badge ' + riskLevelClass(level);
    }
}

function renderRiskTrend(data) {
    const canvas = document.getElementById('riskTrendChart');
    if (!canvas) return;
    const trend = data.trend || [];
    const labels = trend.map((_, i) => (i === trend.length - 1) ? 'Today' : `-${trend.length - 1 - i}d`);

    if (riskTrendChart) riskTrendChart.destroy();
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(99,102,241,0.15)');
    gradient.addColorStop(1, 'rgba(99,102,241,0)');

    riskTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Fleet Risk Score',
                data: trend,
                borderColor: '#6366f1',
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 5,
                borderWidth: 2.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 100, ticks: { stepSize: 25 } },
                x: { ticks: { maxTicksLimit: 8 } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderFactorBar(value) {
    const level = factorLevel(value);
    const width = Math.max(2, value);
    return `<span class="factor-bar"><span class="factor-bar-fill ${level}" style="width:${width}%"></span></span> ${value}`;
}

function renderRiskDeviceTable(data) {
    const tbody = document.getElementById('riskDeviceTableBody');
    if (!tbody) return;
    const devices = data.devices || [];
    if (!devices.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No device risk data available yet.</td></tr>';
        return;
    }
    tbody.innerHTML = devices.map(d => {
        const f = d.factors || {};
        const summaryShort = (d.aiSummary || '').substring(0, 120) + ((d.aiSummary || '').length > 120 ? '...' : '');
        return `<tr>
            <td><strong>${escapeHtml(d.deviceId)}</strong></td>
            <td><strong>${d.score}</strong></td>
            <td><span class="risk-level-badge ${riskLevelClass(d.level)}">${d.level}</span></td>
            <td>${renderFactorBar(f.delay || 0)}</td>
            <td>${renderFactorBar(f.temperature || 0)}</td>
            <td>${renderFactorBar(f.speed || 0)}</td>
            <td>${renderFactorBar(f.battery || 0)}</td>
            <td>${renderFactorBar(f.geofence || 0)}</td>
            <td>${renderFactorBar(f.signal || 0)}</td>
            <td title="${escapeHtml(d.aiSummary || '')}">${escapeHtml(summaryShort)}</td>
        </tr>`;
    }).join('');
}

function renderAiSummary(data) {
    const panel = document.getElementById('aiSummaryPanel');
    const content = document.getElementById('aiSummaryContent');
    if (!panel || !content) return;
    const devices = data.devices || [];
    const highRisk = devices.filter(d => d.score > 30 && d.aiSummary);
    if (!highRisk.length) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = '';
    content.innerHTML = highRisk.map(d =>
        `<p><strong>${escapeHtml(d.deviceId)}</strong> (${d.level}, score ${d.score}): ${escapeHtml(d.aiSummary)}</p>`
    ).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Compliance Reports ──

function initComplianceDateDefaults() {
    const fromEl = document.getElementById('complianceFrom');
    const toEl = document.getElementById('complianceTo');
    if (fromEl && !fromEl.value) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromEl.value = d.toISOString().slice(0, 10);
    }
    if (toEl && !toEl.value) {
        toEl.value = new Date().toISOString().slice(0, 10);
    }
}

async function generateComplianceReport() {
    const type = document.getElementById('complianceReportType')?.value;
    const from = document.getElementById('complianceFrom')?.value;
    const to = document.getElementById('complianceTo')?.value;
    const deviceId = document.getElementById('complianceDevice')?.value?.trim();
    const headers = getSessionAuthHeaders();
    if (!headers.Authorization) return;

    const btn = document.getElementById('generateComplianceBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; }

    try {
        let url = `/api/compliance?type=${encodeURIComponent(type)}`;
        if (from) url += `&from=${encodeURIComponent(new Date(from).toISOString())}`;
        if (to) url += `&to=${encodeURIComponent(new Date(to + 'T23:59:59').toISOString())}`;
        if (deviceId) url += `&deviceId=${encodeURIComponent(deviceId)}`;

        const resp = await fetch(url, { headers });
        if (!resp.ok) throw new Error('Compliance API error ' + resp.status);
        const data = await resp.json();
        _lastComplianceData = data;
        renderComplianceSummary(data);
        renderComplianceTable(data);
    } catch (err) {
        console.warn('[intelligence] compliance fetch failed:', err);
        showToast('Failed to generate compliance report.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-export"></i> Generate'; }
    }
}

function renderComplianceSummary(data) {
    const card = document.getElementById('complianceSummaryCard');
    const titleEl = document.getElementById('complianceSummaryTitle');
    const statsEl = document.getElementById('complianceSummaryStats');
    if (!card || !statsEl) return;
    card.style.display = '';

    const typeLabels = {
        'temperature': 'Temperature Compliance Report',
        'chain-of-custody': 'Chain of Custody Report',
        'delivery-sla': 'Delivery SLA Report',
        'route-adherence': 'Route Adherence Report'
    };
    if (titleEl) titleEl.textContent = typeLabels[data.type] || 'Report Summary';

    const s = data.summary || {};
    let html = '';

    if (data.type === 'temperature') {
        html += statCard(s.totalReadings || 0, 'Readings');
        html += statCard(s.totalExcursions || 0, 'Excursions');
        html += statCard((s.overallCompliance || 0) + '%', 'Compliance');
        html += statCard(s.totalDevices || 0, 'Devices');
    } else if (data.type === 'chain-of-custody') {
        html += statCard(s.totalDevices || 0, 'Devices');
        html += statCard(s.totalDataPoints || 0, 'Data Points');
    } else if (data.type === 'delivery-sla') {
        html += statCard(s.totalDeliveries || 0, 'Deliveries');
        html += statCard(s.onTimeCount || 0, 'On-Time');
        html += statCard(s.lateCount || 0, 'Late');
        html += statCard(s.slaHitRate !== null ? s.slaHitRate + '%' : 'N/A', 'SLA Rate');
        html += statCard(s.avgDelayMinutes ? s.avgDelayMinutes + 'min' : '0', 'Avg Delay');
    } else if (data.type === 'route-adherence') {
        html += statCard(s.totalDevices || 0, 'Devices');
        html += statCard(s.totalGpsPoints || 0, 'GPS Points');
        html += statCard(s.totalAnomalies || 0, 'Anomalies');
        html += statCard((s.overallAdherence || 0) + '%', 'Adherence');
    }
    statsEl.innerHTML = html;
}

function statCard(value, label) {
    return `<div class="intel-stat"><div class="intel-stat-value">${value}</div><div class="intel-stat-label">${label}</div></div>`;
}

function renderComplianceTable(data) {
    const card = document.getElementById('complianceResultsCard');
    const thead = document.getElementById('complianceTableHead');
    const tbody = document.getElementById('complianceTableBody');
    if (!card || !thead || !tbody) return;
    card.style.display = '';

    const records = data.records || data.devices || data.events || [];
    if (!records.length) {
        thead.innerHTML = '<tr><th>Info</th></tr>';
        tbody.innerHTML = '<tr><td>No records found for this period.</td></tr>';
        return;
    }

    if (data.type === 'temperature') {
        thead.innerHTML = '<tr><th>Device</th><th>Timestamp</th><th>Temp (°C)</th><th>Humidity (%)</th><th>Excursion</th></tr>';
        tbody.innerHTML = records.map(r => `<tr>
            <td>${escapeHtml(r.deviceId)}</td>
            <td>${r.timestamp ? new Date(r.timestamp).toLocaleString() : '-'}</td>
            <td>${r.temperature !== null ? r.temperature : '-'}</td>
            <td>${r.humidity !== null ? r.humidity : '-'}</td>
            <td>${r.excursion ? '<span class="status-badge error">Yes</span>' : '<span class="status-badge active">No</span>'}</td>
        </tr>`).join('');
    } else if (data.type === 'chain-of-custody') {
        thead.innerHTML = '<tr><th>Device</th><th>First Seen</th><th>Last Seen</th><th>Data Points</th><th>Locations</th><th>Status</th></tr>';
        tbody.innerHTML = records.map(r => `<tr>
            <td>${escapeHtml(r.deviceId)}</td>
            <td>${r.firstSeen ? new Date(r.firstSeen).toLocaleString() : '-'}</td>
            <td>${r.lastSeen ? new Date(r.lastSeen).toLocaleString() : '-'}</td>
            <td>${r.totalPoints}</td>
            <td>${r.locationsRecorded}</td>
            <td><span class="status-badge active">${r.status}</span></td>
        </tr>`).join('');
    } else if (data.type === 'delivery-sla') {
        thead.innerHTML = '<tr><th>ID</th><th>Reference</th><th>Device</th><th>Status</th><th>Delay (min)</th><th>On Time</th></tr>';
        tbody.innerHTML = records.map(r => `<tr>
            <td>${escapeHtml(r.id)}</td>
            <td>${escapeHtml(r.reference)}</td>
            <td>${escapeHtml(r.deviceId)}</td>
            <td><span class="status-badge ${r.status === 'arrived' ? 'active' : (r.status === 'delayed' ? 'error' : 'warning')}">${r.status}</span></td>
            <td>${r.delayMinutes !== null ? r.delayMinutes : '-'}</td>
            <td>${r.onTime === true ? '<span class="status-badge active">Yes</span>' : (r.onTime === false ? '<span class="status-badge error">No</span>' : '-')}</td>
        </tr>`).join('');
    } else if (data.type === 'route-adherence') {
        const items = data.events || data.devices || [];
        if (data.events && data.events.length) {
            thead.innerHTML = '<tr><th>Device</th><th>Type</th><th>Timestamp</th><th>Detail</th></tr>';
            tbody.innerHTML = items.map(r => `<tr>
                <td>${escapeHtml(r.deviceId)}</td>
                <td><span class="status-badge warning">${escapeHtml(r.type)}</span></td>
                <td>${r.timestamp ? new Date(r.timestamp).toLocaleString() : '-'}</td>
                <td>${escapeHtml(r.detail)}</td>
            </tr>`).join('');
        } else {
            thead.innerHTML = '<tr><th>Device</th><th>GPS Points</th><th>Unauth. Stops</th><th>Shock Events</th><th>Speed Violations</th><th>Adherence</th></tr>';
            tbody.innerHTML = (data.devices || []).map(r => `<tr>
                <td>${escapeHtml(r.deviceId)}</td>
                <td>${r.gpsPoints}</td>
                <td>${r.unauthorizedStops}</td>
                <td>${r.shockEvents}</td>
                <td>${r.speedViolations}</td>
                <td>${r.adherenceRate}%</td>
            </tr>`).join('');
        }
    }
}

function exportComplianceCsv() {
    const data = _lastComplianceData;
    if (!data) { showToast('Generate a report first.', 'warning'); return; }

    const records = data.records || data.devices || data.events || [];
    if (!records.length) { showToast('No data to export.', 'warning'); return; }

    const keys = Object.keys(records[0]);
    const header = keys.join(',');
    const rows = records.map(r => keys.map(k => {
        let v = r[k];
        if (v === null || v === undefined) v = '';
        v = String(v).replace(/"/g, '""');
        return `"${v}"`;
    }).join(','));

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance_${data.type}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Insurance Pricing ──

async function refreshInsuranceData() {
    const headers = getSessionAuthHeaders();
    if (!headers.Authorization) return;
    try {
        const resp = await fetch('/api/insurance', { headers });
        if (!resp.ok) throw new Error('Insurance API error ' + resp.status);
        const data = await resp.json();
        _lastInsuranceData = data;
        renderInsuranceOverview(data);
        renderInsuranceChart(data);
        renderInsuranceRecommendations(data);
        renderInsuranceTiers(data);
    } catch (err) {
        console.warn('[intelligence] insurance fetch failed:', err);
    }
}

function renderInsuranceOverview(data) {
    const scoreEl = document.getElementById('insuranceRiskScore');
    const levelEl = document.getElementById('insuranceRiskLevel');
    const fleetEl = document.getElementById('insuranceFleetSize');
    const savingsEl = document.getElementById('insuranceSavingsAmount');
    const savingsDetailEl = document.getElementById('insuranceSavingsDetail');
    const industryEl = document.getElementById('insuranceIndustryPremium');
    const yourEl = document.getElementById('insuranceYourPremium');
    const monthlyEl = document.getElementById('insuranceMonthly');

    if (scoreEl) scoreEl.textContent = data.fleetRiskScore ?? '--';
    if (levelEl) {
        const level = data.fleetRiskLevel || 'low';
        levelEl.textContent = level.charAt(0).toUpperCase() + level.slice(1) + ' Risk';
        levelEl.className = 'risk-level-badge ' + riskLevelClass(level);
    }
    if (fleetEl) fleetEl.textContent = (data.fleetSize || 0) + ' assets';

    const p = data.pricing || {};
    if (savingsEl) {
        const savings = p.annualSavings || 0;
        savingsEl.textContent = formatEurInt(Math.abs(savings));
        if (savings < 0) {
            savingsEl.style.color = '#dc2626';
            if (savingsDetailEl) savingsDetailEl.textContent = 'above industry average premium';
        } else {
            savingsEl.style.color = '#059669';
            if (savingsDetailEl) savingsDetailEl.textContent = 'vs. industry average premium (' + (p.savingsPercent || 0) + '% lower)';
        }
    }
    if (industryEl) industryEl.textContent = formatEurInt(p.industryAnnualPremium);
    if (yourEl) yourEl.textContent = formatEurInt(p.yourAnnualPremium);
    if (monthlyEl) monthlyEl.textContent = formatEurInt(p.monthlyEstimate) + '/mo';
}

function renderInsuranceChart(data) {
    const canvas = document.getElementById('insuranceComparisonChart');
    if (!canvas) return;
    const p = data.pricing || {};

    if (insuranceComparisonChart) insuranceComparisonChart.destroy();
    insuranceComparisonChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Industry Average', 'Your Fleet'],
            datasets: [{
                label: 'Annual Premium (€)',
                data: [p.industryAnnualPremium || 0, p.yourAnnualPremium || 0],
                backgroundColor: ['#94a3b8', '#6366f1'],
                borderRadius: 8,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: { beginAtZero: true, ticks: { callback: v => '€' + v.toLocaleString() } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => '€' + ctx.parsed.x.toLocaleString() } }
            }
        }
    });
}

function renderInsuranceRecommendations(data) {
    const container = document.getElementById('insuranceRecommendations');
    if (!container) return;
    const recs = data.recommendations || [];
    if (!recs.length) {
        container.innerHTML = '<p>No recommendations at this time.</p>';
        return;
    }
    container.innerHTML = recs.map(r => `
        <div class="insurance-rec-card">
            <div class="insurance-rec-icon priority-${r.priority || 'medium'}">
                <i class="${r.icon || 'fas fa-lightbulb'}"></i>
            </div>
            <div class="insurance-rec-body">
                <h4>${escapeHtml(r.title)}</h4>
                <p>${escapeHtml(r.description)}</p>
            </div>
        </div>
    `).join('');
}

function renderInsuranceTiers(data) {
    const tbody = document.getElementById('insuranceTierTableBody');
    if (!tbody) return;
    const tiers = data.tiers || [];
    const currentLevel = data.fleetRiskLevel || '';
    tbody.innerHTML = tiers.map(t => {
        const isCurrent = t.level === currentLevel;
        return `<tr${isCurrent ? ' style="background:rgba(99,102,241,0.06);font-weight:600;"' : ''}>
            <td><span class="risk-level-badge ${riskLevelClass(t.level)}">${t.label.split(' ')[0]} ${t.label.split(' ')[1] || ''}</span>${isCurrent ? ' <em>(you)</em>' : ''}</td>
            <td>${t.label.match(/\(.*\)/)?.[0] || ''}</td>
            <td>${t.multiplier}x</td>
            <td>${formatEurInt(t.premiumPerAsset)}</td>
            <td>${t.savingsVsAvg}</td>
        </tr>`;
    }).join('');
}
