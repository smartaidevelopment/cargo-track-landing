// Dashboard functionality

let map = null;
let globalMap = null;
let deviceMarkers = [];
let globalDeviceMarkers = [];
let charts = {};
let mapAutoRefreshInterval = null;
let mapAutoRefreshEnabled = false;
let liveLocationInterval = null;
const LIVE_LOCATION_POLL_MS = 5000;
const DASHBOARD_LAYOUT_KEY = 'cargotrack_dashboard_layout_v1';
const STALE_DEVICE_MS = 2 * 60 * 1000;

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
    
    // Set up auto-refresh
    setInterval(() => {
        if (document.querySelector('#devices.content-section.active')) {
            updateMap();
        }
        loadDashboardData();
        loadAlerts();
    }, 30000); // Refresh every 30 seconds
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

    if (updateHash) {
        window.location.hash = sectionId;
    }

    const titles = {
        'dashboard': 'Dashboard',
        'devices': 'Live Tracking',
        'alerts': 'Alerts',
        'analytics': 'Analytics',
        'devices-management': 'Devices',
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
    if (sectionId === 'analytics' && Object.keys(charts).length === 0) {
        initCharts();
    }
    if (sectionId === 'billing') {
        loadUserInvoices();
    }
    if (sectionId === 'settings') {
        loadAccountSettings();
        loadNotificationSettings();
    }
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('data-section');
            setActiveSection(targetSection, { updateHash: true });
        });
    });

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
}

function initDashboardLayout() {
    const layoutContainer = document.getElementById('dashboardLayout');
    const toggleBtn = document.getElementById('toggleDashboardLayout');
    if (!layoutContainer || !toggleBtn) return;

    const cards = Array.from(layoutContainer.querySelectorAll('.dashboard-card[data-layout-id]'));
    const savedOrder = getSavedDashboardLayout();
    if (savedOrder.length) {
        applyDashboardLayout(layoutContainer, cards, savedOrder);
    }

    toggleBtn.addEventListener('click', () => {
        const dashboardSection = document.getElementById('dashboard');
        const isEditing = dashboardSection.classList.toggle('layout-editing');
        toggleBtn.innerHTML = isEditing
            ? '<i class="fas fa-check"></i> Done'
            : '<i class="fas fa-sliders-h"></i> Modify Layout';
        setDashboardDragState(layoutContainer, isEditing);
    });

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
    document.getElementById('totalDevices').textContent = activeDevices.length;
    document.getElementById('activeShipments').textContent = activeDevices.length;
    document.getElementById('activeAlerts').textContent = alerts.filter(a => !a.read).length;
    document.getElementById('completedShipments').textContent = devices.filter(d => d.status === 'completed').length;
    
    // Update activity list
    const activityList = document.getElementById('activityList');
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
    
    // Update devices table
    updateDevicesTable(devices);
    
    // Update monitoring charts
    updateTemperatureChart();
    updateHumidityChart();
}

// Live Tracking
function initLiveTracking() {
    const refreshBtn = document.getElementById('refreshMapBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            updateMap();
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
        const response = await fetch('/api/locations', { cache: 'no-store' });
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
        deviceId: live.deviceId || live.id,
        latitude: Number.isFinite(parseFloat(latitude)) ? parseFloat(latitude) : null,
        longitude: Number.isFinite(parseFloat(longitude)) ? parseFloat(longitude) : null,
        temperature: live.temperature ?? null,
        humidity: live.humidity ?? null,
        battery: live.battery ?? null,
        rssi: live.rssi ?? null,
        accuracy: live.accuracy ?? null,
        satellites: live.satellites ?? null,
        timestamp: live.timestamp || live.updatedAt || new Date().toISOString()
    };
}

function mergeLiveLocations(liveDevices) {
    if (!Array.isArray(liveDevices) || liveDevices.length === 0) return;

    const blockedIds = getBlockedDeviceIds();
    const devices = getDevices();
    const deviceIndex = new Map(devices.map(device => [device.id, device]));
    let hasUpdates = false;

    liveDevices.forEach(live => {
        const normalized = normalizeLivePayload(live);
        if (!normalized.deviceId) return;
        if (blockedIds.has(normalized.deviceId)) return;

        let device = deviceIndex.get(normalized.deviceId);
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
                createdAt: new Date().toISOString()
            };
            devices.push(device);
            deviceIndex.set(normalized.deviceId, device);
        }

        if (hasValidCoordinates(normalized.latitude, normalized.longitude)) {
            device.latitude = normalized.latitude;
            device.longitude = normalized.longitude;
        }
        if (normalized.temperature !== null && normalized.temperature !== undefined) {
            device.temperature = normalized.temperature;
        }
        if (normalized.humidity !== null && normalized.humidity !== undefined) {
            device.humidity = normalized.humidity;
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

function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || map) return;
    
    map = L.map('map').setView([40.7128, -74.0060], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    updateMap();
}

// Global Map for Dashboard
function initGlobalMap() {
    const globalMapElement = document.getElementById('globalMap');
    if (!globalMapElement) return;
    
    // Initialize global map
    globalMap = L.map('globalMap').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(globalMap);
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshGlobalMapBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            updateGlobalMap();
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
    
    // Fit map to show all markers
    if (globalDeviceMarkers.length > 0) {
        const group = L.featureGroup(globalDeviceMarkers);
        globalMap.fitBounds(group.getBounds().pad(0.1));
    } else {
        // Default view if no devices
        globalMap.setView([20, 0], 2);
    }
}

function updateMap() {
    if (!map) return;
    
    // Clear existing markers
    deviceMarkers.forEach(marker => map.removeLayer(marker));
    deviceMarkers = [];
    
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
    
    // Fit map to show all markers
    if (deviceMarkers.length > 0) {
        const group = L.featureGroup(deviceMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Devices Management
let selectedDeviceId = null;
let editingDeviceId = null;

function initDevicesManagement() {
    document.getElementById('addDeviceBtn').addEventListener('click', function() {
        showDeviceForm();
    });
    
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

function loadDevices() {
    const devices = getDevices();
    
    // Update device list
    const deviceList = document.getElementById('deviceList');
    if (deviceList) {
        deviceList.innerHTML = devices.map(device => {
            const connection = getConnectionStatus(device);
            return `
            <div class="device-item" data-device-id="${device.id}" onclick="selectDevice('${device.id}')">
                <div class="device-item-header">
                    <span class="device-item-name">${device.name}</span>
                    <span class="status-badge ${connection.className}">${connection.label}</span>
                </div>
            <div class="device-item-info">
                <span><i class="fas fa-thermometer-half"></i> ${device.temperature !== null && device.temperature !== undefined ? device.temperature + '°C' : 'N/A'}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${device.location || 'Unknown'}</span>
            </div>
            </div>
        `;
        }).join('');
    }
    
    // Update management table
    const tableBody = document.getElementById('devicesManagementTableBody');
    if (tableBody) {
        tableBody.innerHTML = devices.map(device => {
            const networks = device.networks || [];
            const sensors = device.sensors || [];
            const networkDisplay = networks.length > 0 ? networks.slice(0, 2).join(', ') + (networks.length > 2 ? '...' : '') : 'N/A';
            const sensorCount = sensors.length;
            
            return `
                <tr>
                    <td>${device.id}</td>
                    <td>${device.name}</td>
                    <td>${device.type || 'Standard'}</td>
                    <td><span class="status-badge ${device.status}">${device.status}</span></td>
                    <td><span class="network-badge">${networkDisplay}</span></td>
                    <td>${sensorCount} sensor${sensorCount !== 1 ? 's' : ''}</td>
                    <td>${(safeGetCurrentUser()?.package) || 'Professional'}</td>
                    <td>${formatDate(device.createdAt)}</td>
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
                <span class="detail-value">${device.temperature !== null && device.temperature !== undefined ? device.temperature + '°C' : 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Humidity:</span>
                <span class="detail-value">${device.humidity !== null && device.humidity !== undefined ? device.humidity + '%' : 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Location:</span>
                <span class="detail-value">${device.location || 'Unknown'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Last Update:</span>
                <span class="detail-value">${device.lastUpdate ? formatTime(device.lastUpdate) : 'No data yet'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Battery:</span>
                <span class="detail-value">${device.battery !== null && device.battery !== undefined ? device.battery + '%' : 'N/A'}</span>
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
                <span class="detail-value">${device.battery || 'N/A'}%</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Firmware Version:</span>
                <span class="detail-value">${device.firmware || 'v1.0.0'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Uptime:</span>
                <span class="detail-value">${device.uptime || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Data Transmitted:</span>
                <span class="detail-value">${device.dataTransmitted || '0 MB'}</span>
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
function initAlerts() {
    document.getElementById('markAllReadBtn').addEventListener('click', function() {
        markAllAlertsRead();
        loadAlerts();
        loadDashboardData();
    });
}

function loadAlerts() {
    const alerts = getAlerts();
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
    
    container.innerHTML = alerts.map(alert => `
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
function initAnalytics() {
    // Charts will be initialized when analytics section is viewed
}

function initCharts() {
    // Shipment Trends Chart
    const trendsCtx = document.getElementById('shipmentTrendsChart');
    if (trendsCtx) {
        charts.shipmentTrends = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Shipments',
                    data: [12, 19, 15, 25, 22, 18, 24],
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
                    data: [5, 12, 8],
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
        generateApiKeyBtn.addEventListener('click', generateUserApiKey);
    }
    
    // Load user API keys
    loadUserApiKeys();
}

// User API Key Management
function generateUserApiKey() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) {
        alert('Please login to generate API keys');
        return;
    }
    
    // Check if user API keys are allowed
    const systemSettings = JSON.parse(localStorage.getItem('lte_system_settings') || '{}');
    if (systemSettings.allowUserApiKeys === false) {
        alert('API key generation is currently disabled by administrator. Please contact support.');
        return;
    }
    
    const keyName = prompt('Enter a name for this API key (e.g., "ERP Integration", "Custom Dashboard"):');
    if (!keyName || !keyName.trim()) {
        return;
    }
    
    // Generate API key
    const apiKey = generateSecureApiKey();
    const keyData = {
        id: 'key_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: keyName.trim(),
        key: apiKey,
        userId: currentUser.id,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        active: true
    };
    
    // Save API key
    const userApiKeys = getUserApiKeys();
    userApiKeys.push(keyData);
    saveUserApiKeys(userApiKeys);
    
    // Show the key (only shown once)
    showApiKeyModal(keyData);
    
    // Reload list
    loadUserApiKeys();
}

function generateSecureApiKey() {
    // Generate a secure API key for integrations
    const prefix = 'CTRK';
    const segment1 = generateRandomString(40);
    const segment2 = generateRandomString(50);
    return `${prefix}.${segment1}.${segment2}`;
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getUserApiKeys() {
    const currentUser = safeGetCurrentUser();
    if (!currentUser) return [];
    
    const allKeys = JSON.parse(localStorage.getItem('user_api_keys') || '[]');
    return allKeys.filter(key => key.userId === currentUser.id);
}

function saveUserApiKeys(keys) {
    const allKeys = JSON.parse(localStorage.getItem('user_api_keys') || '[]');
    const otherKeys = allKeys.filter(key => {
        const userKeys = keys.map(k => k.id);
        return !userKeys.includes(key.id);
    });
    localStorage.setItem('user_api_keys', JSON.stringify([...otherKeys, ...keys]));
}

function loadUserApiKeys() {
    const keys = getUserApiKeys();
    const container = document.getElementById('userApiKeysList');
    if (!container) return;
    
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
                    <button class="btn btn-outline btn-small" onclick="toggleApiKey('${key.id}')">
                        <i class="fas fa-${key.active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn btn-outline btn-small" onclick="deleteApiKey('${key.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div style="background: var(--bg-dark); padding: 0.75rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.875rem; word-break: break-all;">
                ${key.key.substring(0, 20)}...${key.key.substring(key.key.length - 10)}
            </div>
            <small style="color: var(--text-light); display: block; margin-top: 0.5rem;">
                <i class="fas fa-info-circle"></i> Full key is only shown once when created. Copy it securely.
            </small>
        </div>
    `).join('');
}

function toggleApiKey(keyId) {
    const keys = getUserApiKeys();
    const key = keys.find(k => k.id === keyId);
    if (key) {
        key.active = !key.active;
        saveUserApiKeys(keys);
        loadUserApiKeys();
    }
}

function deleteApiKey(keyId) {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
        return;
    }
    
    const keys = getUserApiKeys();
    const filtered = keys.filter(k => k.id !== keyId);
    saveUserApiKeys(filtered);
    loadUserApiKeys();
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

// Update devices table
function updateDevicesTable(devices) {
    const tableBody = document.getElementById('devicesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = devices.slice(0, 10).map(device => `
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

function getBlockedDeviceIds() {
    const key = 'cargotrack_blocked_devices';
    const stored = localStorage.getItem(key);
    if (!stored) return new Set();
    try {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
            return new Set(ids.filter(Boolean));
        }
    } catch (error) {
        console.warn('Failed to parse blocked devices list:', error);
    }
    return new Set();
}

function isDemoDevice(device) {
    if (!device) return false;
    const demoLocations = new Set(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami']);
    const demoGroups = new Set(['Warehouse A', 'Fleet 1', 'Cold Chain', 'Warehouse B', 'Fleet 2']);
    const demoIds = new Set(['TEST-123', 'TAT140-868373079552768']);
    const hasDemoId = typeof device.id === 'string' && /^DEV-\d{4}$/.test(device.id);
    const hasExplicitDemoId = typeof device.id === 'string' && (demoIds.has(device.id) || device.id.startsWith('TEST-'));
    const hasDemoName = typeof device.name === 'string' && /^Device \d+$/.test(device.name);
    const hasDemoLocation = demoLocations.has(device.location);
    const hasDemoGroup = demoGroups.has(device.group);
    if (hasExplicitDemoId) return true;
    return hasDemoId && hasDemoName && hasDemoLocation && hasDemoGroup;
}

function setBlockedDeviceIds(ids) {
    const key = 'cargotrack_blocked_devices';
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
}

// Data management functions
function getDevices() {
    const devicesKey = 'cargotrack_devices';
    const devicesResetKey = 'cargotrack_devices_cleared_v2';
    if (!localStorage.getItem(devicesResetKey)) {
        localStorage.setItem(devicesKey, JSON.stringify([]));
        localStorage.setItem(devicesResetKey, 'true');
    }
    const devices = localStorage.getItem(devicesKey);
    
    if (!devices) {
        localStorage.setItem(devicesKey, JSON.stringify([]));
        return [];
    }
    
    const blockedIds = getBlockedDeviceIds();
    const parsed = JSON.parse(devices);
    const filtered = Array.isArray(parsed)
        ? parsed.filter(device => !blockedIds.has(device.id)).filter(device => !isDemoDevice(device))
        : [];
    if (filtered.length !== parsed.length) {
        localStorage.setItem(devicesKey, JSON.stringify(filtered));
    }
    return filtered;
}

function closeDeviceModal() {
    document.getElementById('deviceModal').classList.remove('active');
}

function closeDeviceFormModal() {
    document.getElementById('deviceFormModal').classList.remove('active');
    document.getElementById('deviceForm').reset();
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

function showDeviceForm(deviceId = null) {
    editingDeviceId = deviceId;
    const form = document.getElementById('deviceForm');
    const formTitle = document.getElementById('deviceFormTitle');
    
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
            
            // Populate step 2 fields
            document.getElementById('deviceName').value = device.name || '';
            document.getElementById('deviceAsset').value = device.asset || '';
            document.getElementById('deviceLocation').value = device.location || '';
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
    } else {
        // Adding new device
        formTitle.textContent = 'Add New Device';
        form.reset();
        
        // Set defaults for step 2
        setDeviceTypeSelect('Tracker');
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
        
        // Check GPS/GNSS and temperature by default
        document.querySelector('input[name="networks"][value="GPS/GNSS"]').checked = true;
        document.querySelector('input[name="sensors"][value="temperature"]').checked = true;
    }
    
    document.getElementById('deviceFormModal').classList.add('active');
}

function saveDeviceFromForm() {
    const form = document.getElementById('deviceForm');
    const formData = new FormData(form);
    
    // Get step 1 info
    const deviceGroup = formData.get('deviceGroup');
    const deviceType = formData.get('deviceType');
    const deviceId = formData.get('deviceId');
    
    // Get step 2 info
    const deviceName = formData.get('deviceName') || deviceId; // Use ID as name if name not provided
    const deviceAsset = formData.get('deviceAsset');
    
    // Get step 3 info
    const deviceLocation = formData.get('deviceLocation');
    
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
        imei: lteImei,
        simIccid: lteSimIccid,
        carrier: lteCarrier,
        apn: lteApn,
        dataFormat: lteDataFormat,
        dataLogFrequency: lteDataLogFrequency
    };
    
    const devices = getDevices();
    
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
                name: deviceName,
                group: deviceGroup,
                type: deviceType,
                asset: deviceAsset || '',
                location: deviceLocation || 'Unknown',
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
            temperature: existingDevice.temperature ?? null,
            humidity: existingDevice.humidity ?? null,
                lastUpdate: existingDevice.lastUpdate || null
            };
        }
    } else {
        // Create new device
        const newDevice = {
            id: deviceId, // Use provided ID
            name: deviceName,
            group: deviceGroup,
            type: deviceType,
            asset: deviceAsset || '',
            status: deviceStatus,
            location: deviceLocation || 'Unknown',
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
            dataTransmitted: '0 MB',
            networks: selectedNetworks.length > 0 ? selectedNetworks : ['GPS/GNSS'],
            sensors: sensors,
            tracker: {
                gpsStatus: gpsStatus,
                satellites: satellites,
                accuracy: accuracy,
                lastFix: null
            },
            lte: lteSettings,
            lastUpdate: null,
            createdAt: new Date().toISOString()
        };
        
        devices.push(newDevice);
    }
    
    localStorage.setItem('cargotrack_devices', JSON.stringify(devices));
    closeDeviceFormModal();
    loadDevices();
    loadDashboardData();
    
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
    if (!device.lastUpdate) {
        return { label: 'Not connected', className: 'inactive' };
    }
    const lastSeen = new Date(device.lastUpdate).getTime();
    const isStale = Number.isFinite(lastSeen) && Date.now() - lastSeen > STALE_DEVICE_MS;
    if (isStale) {
        return { label: 'Stale', className: 'warning' };
    }
    return hasValidCoordinates(device.latitude, device.longitude)
        ? { label: 'Connected', className: 'active' }
        : { label: 'No GPS', className: 'warning' };
}

function getLastSeenText(device) {
    if (!device.lastUpdate) return 'No data yet';
    return formatTime(device.lastUpdate);
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
    const blockedIds = getBlockedDeviceIds();
    blockedIds.add(deviceId);
    setBlockedDeviceIds(blockedIds);

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
        generateInvoicesForTransactions();
    }
    
    const invoices = getUserInvoices(currentUser.id);
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
                <td><span class="status-badge">${invoice.items[0].description.split(' - ')[0]}</span></td>
                <td><strong>$${invoice.total.toFixed(2)}</strong></td>
                <td><span class="status-badge ${invoice.status === 'paid' ? 'active' : 'warning'}">${invoice.status}</span></td>
                <td>${invoice.paymentMethod}</td>
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

function updateBillingSummary(invoices) {
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    
    const now = new Date();
    const thisMonthInvoices = paidInvoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
    });
    const monthlyPaid = thisMonthInvoices.reduce((sum, inv) => sum + inv.total, 0);
    
    const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.total, 0);
    
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
        generateInvoicesForTransactions();
    }
    loadUserInvoices();
    alert('Invoices refreshed!');
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
        subscriptionReminder: document.getElementById('subscriptionReminder').checked
    };
    
    saveUserNotificationSettings(currentUser.id, settings);
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

