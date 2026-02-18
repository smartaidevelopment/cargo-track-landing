// Admin Dashboard functionality

let adminCharts = {};
let adminGlobalMap = null;
let adminGlobalDeviceMarkers = [];
let adminMapAutoRefreshInterval = null;
let adminMapAutoRefreshEnabled = false;
let adminDevicesCache = [];

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check admin authentication
    const requireAdminAuthFn = window.requireAdminAuth || (typeof requireAdminAuth !== 'undefined' ? requireAdminAuth : null);
    if (!requireAdminAuthFn || !requireAdminAuthFn()) {
        return;
    }
    
    const getCurrentAdminFn = window.getCurrentAdmin || (typeof getCurrentAdmin !== 'undefined' ? getCurrentAdmin : null);
    if (getCurrentAdminFn) {
        const currentAdmin = getCurrentAdminFn();
        if (currentAdmin) {
            const adminUserNameEl = document.getElementById('adminUserName');
            const adminUserEmailEl = document.getElementById('adminUserEmail');
            if (adminUserNameEl) {
                adminUserNameEl.textContent = 'Admin';
            }
            if (adminUserEmailEl) {
                adminUserEmailEl.textContent = currentAdmin.email;
            }
            const adminAccountEmailEl = document.getElementById('adminAccountEmail');
            if (adminAccountEmailEl) {
                adminAccountEmailEl.value = currentAdmin.email;
            }
            const resellerNav = document.querySelector('.sidebar-nav .nav-item[data-section="admin-reseller"]');
            if (resellerNav) {
                resellerNav.style.display = (currentAdmin.role === 'admin' || currentAdmin.role === 'reseller' || currentAdmin.role === 'super_admin')
                    ? ''
                    : 'none';
            }
        }
    }
    
    // One-time cleanup of seeded sample data
    if (!localStorage.getItem('cargotrack_fake_data_cleaned')) {
        var txns = JSON.parse(localStorage.getItem('cargotrack_payments') || '[]');
        if (Array.isArray(txns) && txns.length > 0) {
            txns = txns.filter(function(t) { return !/^TXN-0{5}\d$/.test(t.id); });
            localStorage.setItem('cargotrack_payments', JSON.stringify(txns));
        }
        var reqs = JSON.parse(localStorage.getItem('cargotrack_privacy_requests') || '[]');
        if (Array.isArray(reqs) && reqs.length > 0) {
            reqs = reqs.filter(function(r) { return !/^PR-0{5}\d$/.test(r.id); });
            localStorage.setItem('cargotrack_privacy_requests', JSON.stringify(reqs));
        }
        localStorage.setItem('cargotrack_fake_data_cleaned', '1');
    }

    // Initialize navigation
    initAdminNavigation();
    
    // Initialize sections
    initAdminDashboard();
    initAdminGlobalMap();
    initUserManagement();
    initPackageManagement();
    initPaymentManagement();
    initInvoiceManagement();
    initFinancialAnalytics();
    initSecurityPrivacy();
    initResellerManagement();
    initAdminDeviceManagement();
    initAdminSettings();
    initTrackerLibrary();

    fetchTenants().then(() => fetchUsers()).then(() => cleanOrphanedTenants()).catch(() => {});
    
    // Initialize logout
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) {
        const adminLogoutFn = window.adminLogout || (typeof adminLogout !== 'undefined' ? adminLogout : null);
        if (adminLogoutFn) {
            adminLogoutBtn.addEventListener('click', adminLogoutFn);
        } else {
            adminLogoutBtn.addEventListener('click', function() {
                localStorage.removeItem('cargotrack_admin');
                window.location.href = 'admin-login.html';
            });
        }
    }
    
    // Load initial data
    loadAdminDashboard();
    loadAllUsers();
    fetchAdminDevices();
    fetchTenants().catch(() => {});
    loadPaymentTransactions();
    loadSecurityAuditLog();
    loadPrivacyRequests();
    
    // Search functionality
    const searchInput = document.getElementById('adminSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleAdminSearch);
    }

    // Notification bell
    const notifBtn = document.getElementById('adminNotificationBtn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            showNotification('No new notifications.', 'info');
        });
    }
});

// Navigation
function setActiveAdminSection(targetSection, options = {}) {
    const updateHash = options.updateHash !== false;
    const sectionId = (targetSection || '').replace('#', '').trim();
    if (!sectionId) return;

    const sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;

    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(nav => nav.classList.remove('active'));
    const activeNav = document.querySelector(`.sidebar-nav .nav-item[data-section="${sectionId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    sections.forEach(section => section.classList.remove('active'));
    sectionEl.classList.add('active');

    if (updateHash) {
        window.location.hash = sectionId;
    }

    const titles = {
        'admin-dashboard': 'Admin Dashboard',
        'admin-users': 'User Management',
        'admin-packages': 'Package Management',
        'admin-payments': 'Payment Management',
        'admin-invoices': 'Invoices & Billing',
        'admin-analytics': 'Financial & Analytics',
        'admin-devices': 'All Devices',
        'admin-reseller': 'Reseller Workspaces',
        'admin-security': 'Security & Privacy',
        'admin-settings': 'Admin Settings'
    };
    const pageTitle = document.getElementById('adminPageTitle');
    if (pageTitle) {
        pageTitle.textContent = titles[sectionId] || 'Admin Dashboard';
    }

    if (sectionId === 'admin-dashboard') {
        loadAdminDashboard();
    } else if (sectionId === 'admin-users') {
        loadAllUsers();
    } else if (sectionId === 'admin-packages') {
        loadPackages();
    } else if (sectionId === 'admin-payments') {
        loadPaymentTransactions();
    } else if (sectionId === 'admin-invoices') {
        loadAdminInvoices();
    } else if (sectionId === 'admin-analytics') {
        loadFinancialAnalytics();
    } else if (sectionId === 'admin-devices') {
        loadAllDevices();
    } else if (sectionId === 'admin-reseller') {
        loadResellerData();
    } else if (sectionId === 'admin-security') {
        loadSecurityAuditLog();
        loadPrivacyRequests();
    }
}

function initAdminNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('data-section');
            setActiveAdminSection(targetSection, { updateHash: true });
        });
    });

    const initialSection = window.location.hash ? window.location.hash.slice(1) : 'admin-dashboard';
    setActiveAdminSection(initialSection, { updateHash: false });

    window.addEventListener('hashchange', () => {
        const hashSection = window.location.hash ? window.location.hash.slice(1) : 'admin-dashboard';
        setActiveAdminSection(hashSection, { updateHash: false });
    });
}

function getApiAuthHeaders() {
    if (typeof window.getSessionAuthHeaders === 'function') {
        return window.getSessionAuthHeaders();
    }
    const token = localStorage.getItem('cargotrack_session_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchAdminDevices() {
    try {
        const response = await fetch('/api/admin-devices', {
            cache: 'no-store',
            headers: getApiAuthHeaders()
        });
        if (!response.ok) {
            console.warn('Admin devices fetch failed:', response.status);
            return adminDevicesCache;
        }
        const data = await response.json();
        adminDevicesCache = Array.isArray(data.devices) ? data.devices : [];
        return adminDevicesCache;
    } catch (error) {
        console.warn('Admin devices fetch failed:', error);
        return adminDevicesCache;
    }
}

// Admin Dashboard
function initAdminDashboard() {
    // Charts will be initialized when dashboard is viewed
}

// Admin Global Map
function initAdminGlobalMap() {
    const adminGlobalMapElement = document.getElementById('adminGlobalMap');
    if (!adminGlobalMapElement) return;
    
    // Check if Leaflet is available
    if (typeof L === 'undefined') {
        console.error('Leaflet library not loaded');
        return;
    }
    
    // Initialize admin global map
    adminGlobalMap = L.map('adminGlobalMap').setView([20, 0], 2);
    const baseLayers = {
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
    baseLayers.Basic.addTo(adminGlobalMap);
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(adminGlobalMap);
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshAdminGlobalMapBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            updateAdminGlobalMap();
        });
    }
    
    // Auto-refresh toggle
    const autoRefreshBtn = document.getElementById('toggleAdminMapAutoRefresh');
    if (autoRefreshBtn) {
        autoRefreshBtn.addEventListener('click', function() {
            toggleAdminMapAutoRefresh();
        });
    }
    
    // Initial map update
    updateAdminGlobalMap();
}

function toggleAdminMapAutoRefresh() {
    adminMapAutoRefreshEnabled = !adminMapAutoRefreshEnabled;
    const btn = document.getElementById('toggleAdminMapAutoRefresh');
    
    if (adminMapAutoRefreshEnabled) {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            btn.classList.add('active');
        }
        adminMapAutoRefreshInterval = setInterval(() => {
            updateAdminGlobalMap();
        }, 10000); // Update every 10 seconds
    } else {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-play"></i> Auto Refresh';
            btn.classList.remove('active');
        }
        if (adminMapAutoRefreshInterval) {
            clearInterval(adminMapAutoRefreshInterval);
            adminMapAutoRefreshInterval = null;
        }
    }
}

async function updateAdminGlobalMap() {
    if (!adminGlobalMap) return;
    
    // Clear existing markers
    adminGlobalDeviceMarkers.forEach(marker => adminGlobalMap.removeLayer(marker));
    adminGlobalDeviceMarkers = [];
    
    // Get all devices from all users
    const getUsersFn = window.getUsers || (typeof getUsers !== 'undefined' ? getUsers : null);
    await fetchAdminDevices();
    const allDevices = getAllDevices();
    let deviceCount = 0;
    
    allDevices.forEach(device => {
        if (device.latitude && device.longitude) {
            deviceCount++;
            
            // Determine marker color based on status
            let markerColor = '#10b981'; // Green for active
            if (device.status === 'inactive' || device.status === 'offline') {
                markerColor = '#ef4444'; // Red for inactive
            } else if (device.status === 'warning' || (device.temperature && device.temperature > 25)) {
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
            
            // Get user info if available
            let userInfo = '';
            if (getUsersFn && device.userId) {
                const users = getUsersFn();
                const user = users.find(u => u.id === device.userId);
                if (user) {
                    userInfo = `<strong>User:</strong> ${user.company || user.email}<br>`;
                }
            }
            
            const marker = L.marker([device.latitude, device.longitude], { icon: customIcon })
                .addTo(adminGlobalMap)
                .bindPopup(`
                    <div style="min-width: 200px;">
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">${device.name || 'Device ' + device.id}</h3>
                        ${userInfo}
                        <div style="margin-bottom: 0.5rem;">
                            <span class="status-badge ${device.status}">${device.status || 'unknown'}</span>
                        </div>
                        ${sensorInfo}
                        <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #666;">
                            <strong>Last Update:</strong> ${device.lastUpdate ? formatDate(device.lastUpdate) : 'Never'}<br>
                            ${device.location ? `<strong>Location:</strong> ${device.location}<br>` : ''}
                        </div>
                    </div>
                `);
            
            adminGlobalDeviceMarkers.push(marker);
        }
    });
    
    // Update device count
    const deviceCountEl = document.getElementById('adminMapDeviceCount');
    if (deviceCountEl) {
        deviceCountEl.textContent = deviceCount;
    }
    
    // Fit map to show all markers
    if (adminGlobalDeviceMarkers.length > 0) {
        const group = L.featureGroup(adminGlobalDeviceMarkers);
        adminGlobalMap.fitBounds(group.getBounds().pad(0.1));
    } else {
        // Default view if no devices
        adminGlobalMap.setView([20, 0], 2);
    }
}

function loadAdminDashboard() {
    const getUsersFn = window.getUsers || (typeof getUsers !== 'undefined' ? getUsers : null);
    const getAllDevicesFn = window.getAllDevices || (typeof getAllDevices !== 'undefined' ? getAllDevices : null);
    const getPaymentTransactionsFn = window.getPaymentTransactions || (typeof getPaymentTransactions !== 'undefined' ? getPaymentTransactions : null);
    
    const users = getUsersFn ? getUsersFn() : [];
    const devices = getAllDevicesFn ? getAllDevicesFn() : [];
    const payments = getPaymentTransactionsFn ? getPaymentTransactionsFn() : [];

    const activeUsers = users.filter(u => u.isActive);
    
    document.getElementById('adminTotalUsers').textContent = users.length;
    document.getElementById('adminTotalDevices').textContent = devices.length;
    document.getElementById('adminActiveSubscriptions').textContent = activeUsers.length;
    
    const completedPayments = payments.filter(p => p.status === 'completed');
    const totalRevenue = completedPayments.reduce((sum, p) => sum + parseAmount(p.amount), 0);
    document.getElementById('adminTotalRevenue').textContent = formatEurAdmin(totalRevenue);

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const newUsersThisWeek = users.filter(u => u.createdAt && new Date(u.createdAt) >= oneWeekAgo).length;
    renderChangeIndicator('adminUsersChange', newUsersThisWeek, 'this week', true);

    const revenueThisMonth = completedPayments
        .filter(p => p.date && new Date(p.date) >= thisMonthStart)
        .reduce((sum, p) => sum + parseAmount(p.amount), 0);
    const revenueLastMonth = completedPayments
        .filter(p => p.date && new Date(p.date) >= lastMonthStart && new Date(p.date) <= lastMonthEnd)
        .reduce((sum, p) => sum + parseAmount(p.amount), 0);
    const revenuePct = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : (revenueThisMonth > 0 ? 100 : 0);
    renderChangeIndicator('adminRevenueChange', revenuePct, 'this month', false, true);

    const newDevicesThisMonth = devices.filter(d => {
        const created = d.createdAt || d.addedAt;
        return created && new Date(created) >= thisMonthStart;
    }).length;
    renderChangeIndicator('adminDevicesChange', newDevicesThisMonth, 'this month', true);

    const activeRate = users.length > 0 ? Math.round((activeUsers.length / users.length) * 100) : 0;
    renderChangeIndicator('adminSubscriptionsChange', activeRate, 'active rate', false, true);

    loadRecentUsers(users.slice(-5).reverse());
    loadAdminActivity();
    initRevenueChart(payments);
}

function renderChangeIndicator(elementId, value, label, isCount, isPercent) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const isPositive = value > 0;
    const isNeutral = value === 0;
    el.className = 'stat-change ' + (isNeutral ? 'neutral' : (isPositive ? 'positive' : 'negative'));
    const icon = isNeutral ? 'fas fa-minus' : (isPositive ? 'fas fa-arrow-up' : 'fas fa-arrow-down');
    const prefix = isCount ? (isPositive ? '+' : '') : (isPositive ? '+' : '');
    const suffix = isPercent ? '%' : '';
    el.innerHTML = '<i class="' + icon + '"></i> ' + prefix + value + suffix + ' ' + label;
}

function setChangeIndicator(elementId, pctValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const v = parseFloat(pctValue) || 0;
    const isPositive = v > 0;
    const isNeutral = v === 0;
    el.className = 'stat-change ' + (isNeutral ? 'neutral' : (isPositive ? 'positive' : 'negative'));
    const icon = isNeutral ? 'fas fa-minus' : (isPositive ? 'fas fa-arrow-up' : 'fas fa-arrow-down');
    el.innerHTML = '<i class="' + icon + '"></i> ' + (isPositive ? '+' : '') + Math.abs(v).toFixed(1) + '%';
}

function loadRecentUsers(users) {
    const tableBody = document.getElementById('recentUsersTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 32px; height: 32px; background: var(--primary-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem;">
                        ${user.company ? user.company.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                        <div style="font-weight: 600;">${user.company || user.email}</div>
                        <div style="font-size: 0.75rem; color: var(--text-light);">${user.email}</div>
                    </div>
                </div>
            </td>
            <td><span class="status-badge">${resolvePackageName(user.package)}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td><span class="status-badge ${user.isActive ? 'active' : 'inactive'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
        </tr>
    `).join('');
}

function loadAdminActivity() {
    const activityList = document.getElementById('adminActivityList');
    if (!activityList) return;

    const activities = [];
    const iconMap = {
        admin_login: { icon: 'fas fa-sign-in-alt', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        user_created: { icon: 'fas fa-user-plus', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        user_updated: { icon: 'fas fa-user-edit', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
        user_deletion: { icon: 'fas fa-user-times', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
        user_status_change: { icon: 'fas fa-user-cog', color: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)' },
        privacy_request_processed: { icon: 'fas fa-shield-alt', color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
        settings_update: { icon: 'fas fa-cog', color: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' }
    };
    const defaultIcon = { icon: 'fas fa-circle', color: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' };

    const auditLog = typeof getSecurityAuditLog === 'function' ? getSecurityAuditLog(10) : [];
    auditLog.forEach(entry => {
        const mapping = iconMap[entry.event] || defaultIcon;
        activities.push({
            title: (entry.event || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: entry.user || '',
            icon: mapping.icon,
            color: mapping.color,
            timestamp: entry.timestamp
        });
    });

    const getUsersFn = window.getUsers || (typeof getUsers !== 'undefined' ? getUsers : null);
    const users = getUsersFn ? getUsersFn() : [];
    users.slice(-5).reverse().forEach(u => {
        if (u.createdAt) {
            activities.push({
                title: 'User registered',
                description: (u.company || u.email),
                icon: 'fas fa-user-plus',
                color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                timestamp: u.createdAt
            });
        }
    });

    activities.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    const display = activities.slice(0, 10);

    if (display.length === 0) {
        activityList.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-light);">No recent activity</div>';
        return;
    }

    activityList.innerHTML = display.map(activity => `
        <div class="activity-item">
            <div class="activity-icon" style="background: ${activity.color};">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <h4>${activity.title}</h4>
                <p>${activity.description}</p>
            </div>
            <div class="activity-time">${activity.timestamp ? timeAgo(activity.timestamp) : ''}</div>
        </div>
    `).join('');
}

function timeAgo(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' hour' + (Math.floor(diff / 3600000) > 1 ? 's' : '') + ' ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' day' + (Math.floor(diff / 86400000) > 1 ? 's' : '') + ' ago';
    return formatDate(dateStr);
}

function initRevenueChart(payments) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    if (adminCharts.revenue) {
        adminCharts.revenue.destroy();
    }
    
    // Group payments by date (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    
    const revenueByDay = last7Days.map(() => 0);
    payments.filter(p => p.status === 'completed').forEach(payment => {
        const paymentDate = new Date(payment.date);
        const daysAgo = Math.floor((Date.now() - paymentDate) / (1000 * 60 * 60 * 24));
        if (daysAgo >= 0 && daysAgo < 7) {
            revenueByDay[6 - daysAgo] += parseAmount(payment.amount);
        }
    });
    
    adminCharts.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Revenue',
                data: revenueByDay,
                borderColor: 'rgb(37, 99, 235)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// User Management
function initUserManagement() {
    document.getElementById('addUserBtn').addEventListener('click', showAddUserForm);
    document.getElementById('exportUsersBtn').addEventListener('click', exportUsers);
    document.getElementById('filterUserStatus').addEventListener('change', filterUsers);
    document.getElementById('filterUserPackage').addEventListener('change', filterUsers);
    document.getElementById('userSearchInput').addEventListener('input', filterUsers);
    
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearUserFilters);
    }
    
    // User details modal
    document.getElementById('closeUserModal').addEventListener('click', closeUserModal);
    document.getElementById('userDetailsModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeUserModal();
        }
    });
    
    // Add User Modal
    const addUserModal = document.getElementById('addUserModal');
    const closeAddUserModal = document.getElementById('closeAddUserModal');
    const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
    const addUserForm = document.getElementById('addUserForm');
    
    if (closeAddUserModal) {
        closeAddUserModal.addEventListener('click', () => addUserModal.classList.remove('active'));
    }
    if (cancelAddUserBtn) {
        cancelAddUserBtn.addEventListener('click', () => addUserModal.classList.remove('active'));
    }
    if (addUserModal) {
        addUserModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    }
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUserSubmit);
    }
    
    // Edit User Modal
    const editUserModal = document.getElementById('editUserModal');
    const closeEditUserModal = document.getElementById('closeEditUserModal');
    const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');
    const editUserForm = document.getElementById('editUserForm');
    
    if (closeEditUserModal) {
        closeEditUserModal.addEventListener('click', () => editUserModal.classList.remove('active'));
    }
    if (cancelEditUserBtn) {
        cancelEditUserBtn.addEventListener('click', () => editUserModal.classList.remove('active'));
    }
    if (editUserModal) {
        editUserModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    }
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUserSubmit);
    }
}

function clearUserFilters() {
    document.getElementById('filterUserStatus').value = 'all';
    document.getElementById('filterUserPackage').value = 'all';
    document.getElementById('userSearchInput').value = '';
    filterUsers();
}

async function loadAllUsers() {
    try {
        const response = await fetch('/api/users', {
            headers: getApiAuthHeaders(),
            cache: 'no-store'
        });
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.users)) {
                saveUsers(data.users);
            }
        }
    } catch (e) {
        // Fall back to localStorage
    }
    const users = getUsers();
    const tableBody = document.getElementById('usersManagementTable');
    if (!tableBody) return;
    
    // Update stats
    updateUserStats(users);
    
    if (users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-light);">
                    <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
                    <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No users found</p>
                    <p>Click "Add User" to create your first user</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const renderUserEmailBadge = (u) => u.emailVerified ? '<span style="display:inline-block;margin-left:0.4rem;font-size:0.7rem;padding:0.1rem 0.4rem;background:#dcfce7;color:#166534;border-radius:9999px;font-weight:500;vertical-align:middle;">Verified</span>' : '<span style="display:inline-block;margin-left:0.4rem;font-size:0.7rem;padding:0.1rem 0.4rem;background:#fef3c7;color:#92400e;border-radius:9999px;font-weight:500;vertical-align:middle;">Unverified</span>';

    tableBody.innerHTML = users.map(user => {
        const packageColors = {
            'track': '#3b82f6', 'monitor': '#10b981', 'predict': '#f59e0b',
            'basic': '#3b82f6', 'professional': '#10b981', 'enterprise': '#f59e0b'
        };
        const packageColor = packageColors[resolvePackageId(user.package)] || '#3b82f6';
        
        return `
        <tr style="transition: background 0.2s; cursor: pointer;" onclick="viewUserDetails('${user.id}')" onmouseover="this.style.background='var(--bg-light)'" onmouseout="this.style.background=''">
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 36px; height: 36px; background: ${packageColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.875rem;">
                        ${(user.company || user.email).charAt(0).toUpperCase()}
                    </div>
                    <span style="font-family: monospace; font-size: 0.875rem; color: var(--text-light);">${user.id.substring(0, 8)}...</span>
                </div>
            </td>
            <td>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${user.email} ${renderUserEmailBadge(user)}</div>
                    ${user.company ? `<div style="font-size: 0.875rem; color: var(--text-light);">${user.company}</div>` : ''}
                </div>
            </td>
            <td>${user.company || '<span style="color: var(--text-light);">-</span>'}</td>
            <td>
                <span class="status-badge" style="background: ${packageColor}; color: white; text-transform: capitalize;">
                    ${resolvePackageName(user.package)}
                </span>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-microchip" style="color: var(--text-light);"></i>
                    <span>${user.devices || 1}</span>
                </div>
            </td>
            <td>
                <span class="status-badge ${user.isActive !== false ? 'active' : 'inactive'}">
                    ${user.isActive !== false ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td style="color: var(--text-light); font-size: 0.875rem;">${formatDate(user.createdAt)}</td>
            <td onclick="event.stopPropagation();">
                <div class="user-actions" style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-outline btn-small" onclick="event.stopPropagation(); viewUserDetails('${user.id}')" title="View Details" style="padding: 0.375rem 0.75rem;">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline btn-small" onclick="event.stopPropagation(); showEditUserForm('${user.id}')" title="Edit" style="padding: 0.375rem 0.75rem;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline btn-small ${user.isActive !== false ? 'warning' : 'success'}" onclick="event.stopPropagation(); toggleUserStatus('${user.id}')" title="${user.isActive !== false ? 'Suspend' : 'Activate'}" style="padding: 0.375rem 0.75rem;">
                        <i class="fas fa-${user.isActive !== false ? 'ban' : 'check'}"></i>
                    </button>
                    <button class="btn btn-outline btn-small danger" onclick="event.stopPropagation(); deleteUser('${user.id}')" title="Delete" style="padding: 0.375rem 0.75rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function updateUserStats(users) {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive !== false).length;
    
    const totalUsersEl = document.getElementById('totalUsersCount');
    const activeUsersEl = document.getElementById('activeUsersCount');
    
    if (totalUsersEl) totalUsersEl.textContent = totalUsers;
    if (activeUsersEl) activeUsersEl.textContent = activeUsers;
}

function filterUsers() {
    const statusFilter = document.getElementById('filterUserStatus').value;
    const packageFilter = document.getElementById('filterUserPackage').value;
    const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
    
    const users = getUsers();
    let filtered = users;
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(u => {
            if (statusFilter === 'active') return u.isActive !== false;
            if (statusFilter === 'inactive') return u.isActive === false;
            if (statusFilter === 'suspended') return u.status === 'suspended';
            return true;
        });
    }
    
    if (packageFilter !== 'all') {
        filtered = filtered.filter(u => resolvePackageId(u.package) === packageFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(u => 
            u.email.toLowerCase().includes(searchTerm) ||
            (u.company && u.company.toLowerCase().includes(searchTerm))
        );
    }
    
    // Update filtered count
    const filteredCountEl = document.getElementById('filteredUsersCount');
    if (filteredCountEl) {
        filteredCountEl.textContent = filtered.length;
    }
    
    const tableBody = document.getElementById('usersManagementTable');
    if (!tableBody) return;
    
    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-light);">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
                    <p style="font-size: 1.1rem;">No users match your filters</p>
                    <button class="btn btn-outline btn-small" onclick="clearUserFilters()" style="margin-top: 1rem;">Clear Filters</button>
                </td>
            </tr>
        `;
        return;
    }
    
    const packageColors = {
        'track': '#3b82f6', 'monitor': '#10b981', 'predict': '#f59e0b',
        'basic': '#3b82f6', 'professional': '#10b981', 'enterprise': '#f59e0b'
    };
    
    const renderFilteredEmailBadge = (u) => u.emailVerified ? '<span style="display:inline-block;margin-left:0.4rem;font-size:0.7rem;padding:0.1rem 0.4rem;background:#dcfce7;color:#166534;border-radius:9999px;font-weight:500;vertical-align:middle;">Verified</span>' : '<span style="display:inline-block;margin-left:0.4rem;font-size:0.7rem;padding:0.1rem 0.4rem;background:#fef3c7;color:#92400e;border-radius:9999px;font-weight:500;vertical-align:middle;">Unverified</span>';

    tableBody.innerHTML = filtered.map(user => {
        const packageColor = packageColors[resolvePackageId(user.package)] || '#3b82f6';
        return `
        <tr style="transition: background 0.2s; cursor: pointer;" onclick="viewUserDetails('${user.id}')" onmouseover="this.style.background='var(--bg-light)'" onmouseout="this.style.background=''">
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 36px; height: 36px; background: ${packageColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.875rem;">
                        ${(user.company || user.email).charAt(0).toUpperCase()}
                    </div>
                    <span style="font-family: monospace; font-size: 0.875rem; color: var(--text-light);">${user.id.substring(0, 8)}...</span>
                </div>
            </td>
            <td>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${user.email} ${renderFilteredEmailBadge(user)}</div>
                    ${user.company ? `<div style="font-size: 0.875rem; color: var(--text-light);">${user.company}</div>` : ''}
                </div>
            </td>
            <td>${user.company || '<span style="color: var(--text-light);">-</span>'}</td>
            <td>
                <span class="status-badge" style="background: ${packageColor}; color: white; text-transform: capitalize;">
                    ${resolvePackageName(user.package)}
                </span>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-microchip" style="color: var(--text-light);"></i>
                    <span>${user.devices || 1}</span>
                </div>
            </td>
            <td>
                <span class="status-badge ${user.isActive !== false ? 'active' : 'inactive'}">
                    ${user.isActive !== false ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td style="color: var(--text-light); font-size: 0.875rem;">${formatDate(user.createdAt)}</td>
            <td onclick="event.stopPropagation();">
                <div class="user-actions" style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-outline btn-small" onclick="event.stopPropagation(); viewUserDetails('${user.id}')" title="View Details" style="padding: 0.375rem 0.75rem;">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline btn-small" onclick="event.stopPropagation(); showEditUserForm('${user.id}')" title="Edit" style="padding: 0.375rem 0.75rem;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline btn-small ${user.isActive !== false ? 'warning' : 'success'}" onclick="event.stopPropagation(); toggleUserStatus('${user.id}')" title="${user.isActive !== false ? 'Suspend' : 'Activate'}" style="padding: 0.375rem 0.75rem;">
                        <i class="fas fa-${user.isActive !== false ? 'ban' : 'check'}"></i>
                    </button>
                    <button class="btn btn-outline btn-small danger" onclick="event.stopPropagation(); deleteUser('${user.id}')" title="Delete" style="padding: 0.375rem 0.75rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function viewUserDetails(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    const getAllDevicesFn = window.getAllDevices || (typeof getAllDevices !== 'undefined' ? getAllDevices : null);
    const devices = getAllDevicesFn ? getAllDevicesFn().filter(d => d.userId === userId) : [];
    
    const packageColors = {
        'track': '#3b82f6', 'monitor': '#10b981', 'predict': '#f59e0b',
        'basic': '#3b82f6', 'professional': '#10b981', 'enterprise': '#f59e0b'
    };
    const packageColor = packageColors[resolvePackageId(user.package)] || '#3b82f6';
    
    document.getElementById('userDetailsTitle').textContent = `User Profile: ${user.email}`;
    const modalBody = document.getElementById('userDetailsBody');
    
    modalBody.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 2px solid var(--border-color);">
            <div style="width: 80px; height: 80px; background: ${packageColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: 600;">
                ${(user.company || user.email).charAt(0).toUpperCase()}
            </div>
            <div style="flex: 1;">
                <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem;">${user.company || 'No Company Name'}</h2>
                <p style="margin: 0; color: var(--text-light); font-size: 1rem;">${user.email}</p>
                <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <span class="status-badge ${user.isActive !== false ? 'active' : 'inactive'}">${user.isActive !== false ? 'Active' : 'Inactive'}</span>
                    <span class="status-badge" style="background: ${packageColor}; color: white; text-transform: capitalize;">
                        ${resolvePackageName(user.package)}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="device-details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <div class="details-section" style="background: var(--bg-light); padding: 1.5rem; border-radius: 0.5rem;">
                <h3 style="margin: 0 0 1rem 0; color: var(--text-dark); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-info-circle" style="color: var(--primary-color);"></i> Contact Information
                </h3>
                <div class="detail-item" style="margin-bottom: 1rem;">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">User ID:</span>
                    <span class="detail-value" style="font-size: 0.9rem; color: var(--text-dark);"><code>${user.id}</code></span>
                </div>
                <div class="detail-item" style="margin-bottom: 1rem;">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">Email:</span>
                    <span class="detail-value" style="font-size: 1rem; color: var(--text-dark);">${user.email}</span>
                </div>
                <div class="detail-item" style="margin-bottom: 1rem;">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">Company:</span>
                    <span class="detail-value" style="font-size: 1rem; color: var(--text-dark);">${user.company || '<span style="color: var(--text-light);">Not provided</span>'}</span>
                </div>
                <div class="detail-item" style="margin-bottom: 1rem;">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">Phone:</span>
                    <span class="detail-value" style="font-size: 1rem; color: var(--text-dark);">${user.phone || '<span style="color: var(--text-light);">Not provided</span>'}</span>
                </div>
            </div>
            
            <div class="details-section" style="background: var(--bg-light); padding: 1.5rem; border-radius: 0.5rem;">
                <h3 style="margin: 0 0 1rem 0; color: var(--text-dark); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-cog" style="color: var(--primary-color);"></i> Account Details
                </h3>
                <div class="detail-item" style="margin-bottom: 1rem;">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">Package:</span>
                    <span class="detail-value" style="font-size: 1rem;">
                        <span class="status-badge" style="background: ${packageColor}; color: white; text-transform: capitalize;">
                            ${resolvePackageName(user.package)}
                        </span>
                    </span>
                </div>
                <div class="detail-item" style="margin-bottom: 1rem;">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">Devices:</span>
                    <span class="detail-value" style="font-size: 1rem; color: var(--text-dark);">
                        <i class="fas fa-microchip" style="margin-right: 0.5rem;"></i>${user.devices || 1} device(s)
                    </span>
                </div>
                <div class="detail-item" style="margin-bottom: 1rem;">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">Status:</span>
                    <span class="detail-value" style="font-size: 1rem;">
                        <span class="status-badge ${user.isActive !== false ? 'active' : 'inactive'}">${user.isActive !== false ? 'Active' : 'Inactive'}</span>
                    </span>
                </div>
                <div class="detail-item" style="margin-bottom: 1rem;">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">Plan Tier:</span>
                    <span class="detail-value" style="font-size: 1rem; color: var(--text-dark);">${user.planTier || 'individual'}</span>
                </div>
                <div class="detail-item" style="margin-bottom: 1rem;">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">Tenant ID:</span>
                    <span class="detail-value" style="font-size: 0.9rem; color: var(--text-dark);"><code>${user.tenantId || 'None'}</code></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">Joined:</span>
                    <span class="detail-value" style="font-size: 1rem; color: var(--text-dark);">${formatDate(user.createdAt)}</span>
                </div>
            </div>
        </div>
        
        ${devices.length > 0 ? `
        <div class="details-section" style="margin-bottom: 2rem;">
            <h3 style="margin: 0 0 1rem 0; color: var(--text-dark); display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-microchip" style="color: var(--primary-color);"></i> User Devices (${devices.length})
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                ${devices.map(device => `
                    <div style="padding: 1rem; background: var(--bg-light); border-radius: 0.5rem; border: 1px solid var(--border-color);">
                        <div style="font-weight: 600; margin-bottom: 0.5rem;">${device.name || device.id}</div>
                        <div style="font-size: 0.875rem; color: var(--text-light);">
                            <span class="status-badge ${device.status || 'active'}">${device.status || 'Active'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid var(--border-color); display: flex; gap: 1rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="closeUserModal(); showEditUserForm('${user.id}');" style="flex: 1; min-width: 150px;">
                <i class="fas fa-edit"></i> Edit Profile
            </button>
            <button class="btn btn-outline ${user.isActive !== false ? 'warning' : 'success'}" onclick="closeUserModal(); toggleUserStatus('${user.id}');" style="flex: 1; min-width: 150px;">
                <i class="fas fa-${user.isActive !== false ? 'ban' : 'check'}"></i> ${user.isActive !== false ? 'Suspend' : 'Activate'} User
            </button>
            <button class="btn btn-outline danger" onclick="closeUserModal(); deleteUser('${user.id}');" style="flex: 1; min-width: 150px;">
                <i class="fas fa-trash"></i> Delete User
            </button>
            <button class="btn btn-outline" onclick="closeUserModal()" style="flex: 1; min-width: 150px;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    
    document.getElementById('userDetailsModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userDetailsModal').classList.remove('active');
}

function showEditUserForm(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
        alert('User not found');
        return;
    }
    
    // Populate form
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserCompany').value = user.company || '';
    document.getElementById('editUserPhone').value = user.phone || '';
    document.getElementById('editUserPackage').value = resolvePackageId(user.package);
    document.getElementById('editUserDevices').value = user.devices || 1;
    document.getElementById('editUserActive').checked = user.isActive !== false;
    document.getElementById('editUserPassword').value = '';
    
    // Show modal
    document.getElementById('editUserModal').classList.add('active');
}

function handleEditUserSubmit(e) {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
        alert('User not found');
        return;
    }
    
    // Update user data
    user.email = document.getElementById('editUserEmail').value.trim();
    user.company = document.getElementById('editUserCompany').value.trim() || '';
    user.phone = document.getElementById('editUserPhone').value.trim() || '';
    user.package = document.getElementById('editUserPackage').value;
    user.devices = parseInt(document.getElementById('editUserDevices').value) || 1;
    user.isActive = document.getElementById('editUserActive').checked;
    
    // Update password if provided
    const newPassword = document.getElementById('editUserPassword').value.trim();
    if (newPassword && newPassword.length >= 6) {
        user.password = newPassword;
    }
    
    // Save
    saveUsers(users);
    logSecurityEvent('user_updated', user.email, 'success');
    
    // Close modal and refresh
    document.getElementById('editUserModal').classList.remove('active');
    document.getElementById('editUserForm').reset();
    loadAllUsers();
    
    // Show success message
    showNotification('User updated successfully!', 'success');
}

function editUser(userId) {
    showEditUserForm(userId);
}

function toggleUserStatus(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const action = user.isActive !== false ? 'suspend' : 'activate';
    if (confirm(`Are you sure you want to ${action} this user?`)) {
        user.isActive = action === 'activate';
        if (action === 'suspend') {
            user.status = 'suspended';
        } else {
            user.status = 'active';
        }
        saveUsers(users);
        logSecurityEvent('user_status_change', user.email, 'success', { action: action });
        loadAllUsers();
        alert(`User ${action}d successfully!`);
    }
}

async function deleteUser(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    const userLabel = user ? user.email : userId;

    if (!confirm(`Are you sure you want to delete user ${userLabel}? This action cannot be undone.`)) return;

    let serverOk = false;
    try {
        const response = await fetch(`/api/users?userId=${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: getApiAuthHeaders()
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            alert('Failed to delete user: ' + (data.error || response.statusText));
            return;
        }
        serverOk = true;
    } catch (err) {
        console.warn('Server delete request failed:', err);
        alert('Failed to delete user: network error. Please try again.');
        return;
    }

    if (serverOk) {
        const freshUsers = getUsers();
        const filtered = freshUsers.filter(u => u.id !== userId);
        saveUsers(filtered);
        logSecurityEvent('user_deletion', userLabel, 'success');
        loadAllUsers();
        fetchTenants().then(() => {
            if (typeof renderResellerTenants === 'function') renderResellerTenants();
        }).catch(() => {});
        showNotification('User deleted successfully.', 'success');
    }
}

function showAddUserForm() {
    // Reset form
    document.getElementById('addUserForm').reset();
    document.getElementById('newUserPackage').value = 'professional';
    document.getElementById('newUserDevices').value = 1;
    document.getElementById('newUserActive').checked = true;
    document.getElementById('sendWelcomeEmail').checked = true;
    
    // Show modal
    document.getElementById('addUserModal').classList.add('active');
}

function handleAddUserSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const company = document.getElementById('newUserCompany').value.trim();
    const phone = document.getElementById('newUserPhone').value.trim();
    const packageType = document.getElementById('newUserPackage').value;
    const devices = parseInt(document.getElementById('newUserDevices').value) || 1;
    const isActive = document.getElementById('newUserActive').checked;
    const sendWelcomeEmail = document.getElementById('sendWelcomeEmail').checked;
    
    // Validate
    if (!email || !password) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    // Check if user already exists
    const existingUsers = getUsers();
    if (existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        showNotification('A user with this email already exists', 'error');
        return;
    }
    
    // Create user
    const result = createUser({
        email: email,
        password: password,
        company: company,
        phone: phone,
        package: packageType,
        devices: devices
    });
    
    if (result.success) {
        // Set active status
        const users = getUsers();
        const newUser = users.find(u => u.email === email);
        if (newUser) {
            newUser.isActive = isActive;
            saveUsers(users);
        }
        
        // Simulate welcome email if requested
        if (sendWelcomeEmail) {
            console.log(`Welcome email would be sent to ${email} with login credentials`);
        }
        
        // Close modal and refresh
        document.getElementById('addUserModal').classList.remove('active');
        document.getElementById('addUserForm').reset();
        loadAllUsers();
        
        // Show success message
        showNotification(`User "${email}" created successfully!`, 'success');
    } else {
        showNotification(result.message || 'Failed to create user', 'error');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Make functions globally available
window.clearUserFilters = clearUserFilters;
window.viewUserDetails = viewUserDetails;
window.showEditUserForm = showEditUserForm;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.editUser = editUser;
window.savePayPalSettings = savePayPalSettings;

function exportUsers() {
    const users = getUsers();
    const csv = [
        ['Email', 'Company', 'Package', 'Status', 'Joined'],
        ...users.map(u => [
            u.email,
            u.company || '',
            u.package || 'Professional',
            u.isActive !== false ? 'Active' : 'Inactive',
            formatDate(u.createdAt)
        ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Payment Management
function initPaymentManagement() {
    document.getElementById('exportPaymentsBtn').addEventListener('click', exportPayments);
    loadPaymentSettings();
}

function loadPaymentSettings() {
    const settings = JSON.parse(localStorage.getItem('payment_settings')) || {};
    
    if (settings.stripe) {
        document.getElementById('stripePublishableKey').value = settings.stripe.publishableKey || '';
        document.getElementById('stripeSecretKey').value = settings.stripe.secretKey ? '••••••••' : '';
        document.getElementById('stripeStatus').textContent = 'Connected';
        document.getElementById('stripeStatus').className = 'status-badge active';
    }
    
    if (settings.paypal) {
        const paypalClientIdEl = document.getElementById('paypalClientId');
        const paypalUseSmartButtonsEl = document.getElementById('paypalUseSmartButtons');
        const paypalSandboxModeEl = document.getElementById('paypalSandboxMode');
        
        if (paypalClientIdEl) {
            paypalClientIdEl.value = settings.paypal.clientId || '';
        }
        if (paypalUseSmartButtonsEl) {
            paypalUseSmartButtonsEl.checked = settings.paypal.useSmartButtons !== false;
        }
        if (paypalSandboxModeEl) {
            paypalSandboxModeEl.checked = settings.paypal.sandboxMode === true;
        }
        
        // Update status - PayPal is always available (Standard works without Client ID)
        const paypalStatusEl = document.getElementById('paypalStatus');
        if (paypalStatusEl) {
            if (settings.paypal.clientId) {
                paypalStatusEl.textContent = 'Smart Buttons Enabled';
                paypalStatusEl.className = 'status-badge active';
            } else {
                paypalStatusEl.textContent = 'Standard Mode (No Setup)';
                paypalStatusEl.className = 'status-badge active';
            }
        }
    } else {
        // Default: PayPal Standard (works without any setup)
        const paypalStatusEl = document.getElementById('paypalStatus');
        if (paypalStatusEl) {
            paypalStatusEl.textContent = 'Standard Mode (Ready)';
            paypalStatusEl.className = 'status-badge active';
        }
    }
    
    if (settings.bank) {
        document.getElementById('bankDetails').value = settings.bank.details || '';
    }
    
    updatePaymentStats();
}

function savePayPalSettings() {
    const clientId = document.getElementById('paypalClientId').value.trim();
    const useSmartButtons = document.getElementById('paypalUseSmartButtons').checked;
    const sandboxMode = document.getElementById('paypalSandboxMode').checked;
    
    // PayPal Standard works without Client ID, Smart Buttons require it
    if (useSmartButtons && !clientId) {
        const proceed = confirm(
            'PayPal Smart Buttons require a Client ID.\n\n' +
            'Would you like to:\n' +
            '1. Use PayPal Standard (no Client ID needed) - Click Cancel\n' +
            '2. Get Client ID from PayPal Business account - Click OK to continue without saving\n\n' +
            'You can get Client ID from: PayPal Business → Account Settings → Website Preferences'
        );
        if (!proceed) {
            // User wants to use Standard mode
            document.getElementById('paypalUseSmartButtons').checked = false;
        } else {
            return; // Don't save, let user get Client ID first
        }
    }
    
    const settings = JSON.parse(localStorage.getItem('payment_settings')) || {};
    settings.paypal = {
        clientId: clientId || '',
        useSmartButtons: useSmartButtons,
        sandboxMode: sandboxMode
    };
    
    localStorage.setItem('payment_settings', JSON.stringify(settings));
    
    // Update status
    const paypalStatusEl = document.getElementById('paypalStatus');
    if (paypalStatusEl) {
        if (clientId && useSmartButtons) {
            paypalStatusEl.textContent = 'Smart Buttons Enabled';
            paypalStatusEl.className = 'status-badge active';
        } else {
            paypalStatusEl.textContent = 'Standard Mode (Ready)';
            paypalStatusEl.className = 'status-badge active';
        }
    }
    
    showNotification('PayPal settings saved successfully! ' + (clientId && useSmartButtons ? 'Smart Buttons enabled.' : 'Standard mode enabled (works without Client ID).'), 'success');
}

function configurePaymentMethod(method) {
    if (method === 'paypal') {
        // PayPal now uses inline form, no modal needed
        savePayPalSettings();
        return;
    }
    
    document.getElementById('paymentConfigTitle').textContent = `Configure ${method.toUpperCase()}`;
    const form = document.getElementById('paymentConfigForm');
    
    if (method === 'stripe') {
        document.getElementById('paymentKey1Label').textContent = 'Publishable Key';
        document.getElementById('paymentKey2Label').textContent = 'Secret Key';
    }
    
    document.getElementById('paymentConfigModal').classList.add('active');
    
    form.onsubmit = function(e) {
        e.preventDefault();
        const key1 = document.getElementById('paymentKey1').value;
        const key2 = document.getElementById('paymentKey2').value;
        const testMode = document.getElementById('useTestModePayment').checked;
        
        const settings = JSON.parse(localStorage.getItem('payment_settings')) || {};
        settings[method] = {
            [method === 'stripe' ? 'publishableKey' : 'clientId']: key1,
            [method === 'stripe' ? 'secretKey' : 'secret']: key2,
            testMode: testMode
        };
        
        localStorage.setItem('payment_settings', JSON.stringify(settings));
        closePaymentConfigModal();
        loadPaymentSettings();
        alert(`${method.toUpperCase()} configured successfully!`);
    };
}

function closePaymentConfigModal() {
    document.getElementById('paymentConfigModal').classList.remove('active');
    document.getElementById('paymentConfigForm').reset();
}

function saveBankDetails() {
    const details = document.getElementById('bankDetails').value;
    const settings = JSON.parse(localStorage.getItem('payment_settings')) || {};
    settings.bank = { details: details };
    localStorage.setItem('payment_settings', JSON.stringify(settings));
    alert('Bank details saved!');
}

function getPaymentTransactions() {
    const transactionsKey = 'cargotrack_payments';
    const raw = localStorage.getItem(transactionsKey);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function loadPaymentTransactions() {
    const transactions = getPaymentTransactions();
    const tableBody = document.getElementById('paymentsTable');
    if (!tableBody) return;

    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-light);">No payment transactions yet</td></tr>';
    } else {
        tableBody.innerHTML = transactions.map(txn => `
            <tr>
                <td>${txn.id}</td>
                <td>${txn.userEmail || 'N/A'}</td>
                <td><span class="status-badge">${txn.package || 'N/A'}</span></td>
                <td><strong>${txn.amount || '\u20ac0'}</strong></td>
                <td>${txn.method || 'N/A'}</td>
                <td><span class="status-badge ${txn.status === 'completed' ? 'active' : (txn.status === 'pending' ? 'warning' : 'error')}">${txn.status || 'unknown'}</span></td>
                <td>${formatDate(txn.date)}</td>
                <td>
                    <button class="btn-icon-small view" onclick="viewTransaction('${txn.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    updatePaymentStats(transactions);
}

function parseAmount(amt) {
    if (!amt) return 0;
    return parseFloat(String(amt).replace(/[\$\u20ac]/g, '').replace(',', '')) || 0;
}

function updatePaymentStats(transactions = null) {
    if (!transactions) {
        transactions = getPaymentTransactions();
    }

    const completed = transactions.filter(t => t.status === 'completed');
    const totalRevenue = completed.reduce((sum, t) => sum + parseAmount(t.amount), 0);

    const now = new Date();
    const thisMonth = completed.filter(t => {
        const txnDate = new Date(t.date);
        return txnDate.getMonth() === now.getMonth() && txnDate.getFullYear() === now.getFullYear();
    });
    const monthlyRevenue = thisMonth.reduce((sum, t) => sum + parseAmount(t.amount), 0);

    const pending = transactions.filter(t => t.status === 'pending');
    const pendingRevenue = pending.reduce((sum, t) => sum + parseAmount(t.amount), 0);
    
    document.getElementById('totalRevenue').textContent = formatEurAdmin(totalRevenue);
    document.getElementById('monthlyRevenue').textContent = formatEurAdmin(monthlyRevenue);
    document.getElementById('pendingRevenue').textContent = formatEurAdmin(pendingRevenue);
    document.getElementById('failedPayments').textContent = transactions.filter(t => t.status === 'failed').length;
}

// Invoice Management
function initInvoiceManagement() {
    document.getElementById('exportInvoicesBtn').addEventListener('click', exportAllInvoices);
    document.getElementById('filterInvoiceStatus').addEventListener('change', filterAdminInvoices);
    document.getElementById('filterInvoiceDateRange').addEventListener('change', filterAdminInvoices);
    document.getElementById('invoiceSearchInput').addEventListener('input', filterAdminInvoices);
    document.getElementById('createInvoiceBtn').addEventListener('click', showCreateInvoiceModal);
    document.getElementById('closeInvoiceFormModal').addEventListener('click', closeInvoiceFormModal);
    document.getElementById('invoiceForm').addEventListener('submit', handleInvoiceFormSubmit);
    document.getElementById('closeInvoiceDetailModal').addEventListener('click', closeInvoiceDetailModal);
    document.getElementById('closeSendInvoiceModal').addEventListener('click', closeSendInvoiceModal);
    document.getElementById('sendInvoiceForm').addEventListener('submit', handleSendInvoice);
    document.getElementById('invoiceTaxRate').addEventListener('input', recalcAllInvoiceItems);
    document.getElementById('selectAllInvoices').addEventListener('change', toggleSelectAllInvoices);
}

function renderInvoiceRow(invoice, users) {
    const user = users.find(u => u.id === invoice.userId) || { email: invoice.userEmail || 'Unknown', company: invoice.userCompany || 'Unknown' };
    const isOverdue = invoice.status === 'pending' && new Date(invoice.dueDate) < new Date();
    const displayStatus = invoice.status === 'void' ? 'void' : (isOverdue ? 'overdue' : invoice.status);
    const statusClass = invoice.status === 'paid' ? 'active' : (invoice.status === 'void' ? 'void' : (isOverdue ? 'error' : 'warning'));

    return `
        <tr data-invoice-id="${invoice.id}">
            <td><input type="checkbox" class="invoice-select-cb" value="${invoice.id}"></td>
            <td><strong>${invoice.invoiceNumber}</strong></td>
            <td>
                <div>${user.company || user.email}</div>
                <div style="font-size: 0.75rem; color: var(--text-light);">${user.email}</div>
            </td>
            <td>${formatDate(invoice.date)}</td>
            <td>${formatDate(invoice.dueDate)}</td>
            <td><strong>$${invoice.total.toFixed(2)}</strong></td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${displayStatus}
                </span>
            </td>
            <td>${invoice.paymentMethod || 'N/A'}</td>
            <td>
                <div class="invoice-action-group">
                    <button class="btn-icon-small view" onclick="viewAdminInvoice('${invoice.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon-small edit" onclick="editAdminInvoice('${invoice.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <div class="invoice-action-dropdown">
                        <button class="btn-icon-small" onclick="toggleInvoiceMenu(this)" title="More actions">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="invoice-dropdown-menu">
                            <button onclick="downloadAdminInvoice('${invoice.id}')"><i class="fas fa-download"></i> Download PDF</button>
                            <button onclick="sendAdminInvoice('${invoice.id}')"><i class="fas fa-paper-plane"></i> Send to Customer</button>
                            ${invoice.status === 'pending' ? `<button onclick="markInvoicePaid('${invoice.id}')"><i class="fas fa-check-circle"></i> Mark as Paid</button>` : ''}
                            ${invoice.status === 'paid' ? `<button onclick="markInvoiceUnpaid('${invoice.id}')"><i class="fas fa-undo"></i> Mark as Unpaid</button>` : ''}
                            ${(invoice.status === 'pending' && new Date(invoice.dueDate) < new Date()) ? `<button onclick="sendPaymentReminder('${invoice.id}')"><i class="fas fa-bell"></i> Send Reminder</button>` : ''}
                            <button onclick="duplicateAdminInvoice('${invoice.id}')"><i class="fas fa-copy"></i> Duplicate</button>
                            ${invoice.status !== 'void' ? `<button onclick="voidAdminInvoice('${invoice.id}')"><i class="fas fa-ban"></i> Void Invoice</button>` : ''}
                            <div class="dropdown-divider"></div>
                            <button class="dropdown-danger" onclick="deleteAdminInvoice('${invoice.id}')"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function loadAdminInvoices() {
    if (typeof generateInvoicesForTransactions === 'function') {
        generateInvoicesForTransactions();
    }

    const invoices = getInvoices();
    const tableBody = document.getElementById('adminInvoicesTable');
    if (!tableBody) return;

    if (invoices.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    No invoices found. Click "Create Invoice" or "Generate Missing" to get started.
                </td>
            </tr>
        `;
    } else {
        const users = getUsers();
        tableBody.innerHTML = invoices.map(inv => renderInvoiceRow(inv, users)).join('');
    }

    updateInvoiceStatistics(invoices);
    loadRecentInvoices(invoices);
    updateBulkActions();
}

function updateInvoiceStatistics(invoices) {
    const paid = invoices.filter(inv => inv.status === 'paid');
    const pending = invoices.filter(inv => inv.status === 'pending');
    const overdue = invoices.filter(inv => inv.status === 'pending' && new Date(inv.dueDate) < new Date());
    const totalRevenue = paid.reduce((sum, inv) => sum + inv.total, 0);

    document.getElementById('adminTotalInvoices').textContent = invoices.length;
    document.getElementById('adminInvoiceRevenue').textContent = formatEurAdmin(totalRevenue);
    document.getElementById('adminPaidInvoices').textContent = paid.length;
    document.getElementById('adminPendingInvoices').textContent = pending.length;

    const overdueEl = document.getElementById('adminOverdueInvoices');
    if (overdueEl) overdueEl.textContent = overdue.length;
}

function loadRecentInvoices(invoices) {
    const recentList = document.getElementById('recentInvoicesList');
    if (!recentList) return;

    const recent = invoices.slice(-5).reverse();

    if (recent.length === 0) {
        recentList.innerHTML = '<p style="color: var(--text-light); padding: 1rem;">No recent invoices</p>';
    } else {
        recentList.innerHTML = recent.map(invoice => `
            <div class="recent-invoice-item" onclick="viewAdminInvoice('${invoice.id}')" style="cursor:pointer;">
                <div class="recent-invoice-header">
                    <strong>${invoice.invoiceNumber}</strong>
                    <span class="status-badge ${invoice.status === 'paid' ? 'active' : (invoice.status === 'void' ? 'void' : 'warning')}">${invoice.status}</span>
                </div>
                <div class="recent-invoice-details">
                    <span>${invoice.userEmail || 'N/A'}</span>
                    <span>$${invoice.total.toFixed(2)}</span>
                </div>
                <div class="recent-invoice-date">${formatDate(invoice.date)}</div>
            </div>
        `).join('');
    }
}

function getFilteredInvoices() {
    const statusFilter = document.getElementById('filterInvoiceStatus').value;
    const dateRange = document.getElementById('filterInvoiceDateRange').value;
    const searchTerm = document.getElementById('invoiceSearchInput').value.toLowerCase();

    let invoices = getInvoices();
    const users = getUsers();

    if (statusFilter !== 'all') {
        invoices = invoices.filter(inv => {
            if (statusFilter === 'overdue') return inv.status === 'pending' && new Date(inv.dueDate) < new Date();
            return inv.status === statusFilter;
        });
    }

    if (dateRange !== 'all') {
        const now = new Date();
        let startDate;
        if (dateRange === 'today') { startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
        else if (dateRange === 'week') { startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); }
        else if (dateRange === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
        else if (dateRange === 'quarter') { startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); }
        if (startDate) invoices = invoices.filter(inv => new Date(inv.date) >= startDate);
    }

    if (searchTerm) {
        invoices = invoices.filter(inv => {
            const user = users.find(u => u.id === inv.userId);
            return (inv.invoiceNumber || '').toLowerCase().includes(searchTerm) ||
                (inv.userEmail || '').toLowerCase().includes(searchTerm) ||
                (user && ((user.email || '').toLowerCase().includes(searchTerm) ||
                    (user.company && user.company.toLowerCase().includes(searchTerm))));
        });
    }

    return invoices;
}

function filterAdminInvoices() {
    const filtered = getFilteredInvoices();
    const tableBody = document.getElementById('adminInvoicesTable');
    if (!tableBody) return;

    const users = getUsers();
    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    No invoices match the current filters.
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = filtered.map(inv => renderInvoiceRow(inv, users)).join('');
    }
    updateBulkActions();
}

// ---- Create / Edit Invoice Modal ----
function showCreateInvoiceModal() {
    document.getElementById('invoiceEditId').value = '';
    document.getElementById('invoiceFormTitle').innerHTML = '<i class="fas fa-file-invoice"></i> Create Invoice';
    document.getElementById('invoiceFormSubmitBtn').textContent = 'Create Invoice';
    document.getElementById('invoiceForm').reset();

    const today = new Date().toISOString().split('T')[0];
    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    document.getElementById('invoiceDueDate').value = due;

    populateCustomerDropdown();
    resetInvoiceItems();
    document.getElementById('invoiceFormModal').classList.add('active');
}

function editAdminInvoice(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) { alert('Invoice not found'); return; }

    document.getElementById('invoiceEditId').value = invoiceId;
    document.getElementById('invoiceFormTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Invoice';
    document.getElementById('invoiceFormSubmitBtn').textContent = 'Save Changes';

    populateCustomerDropdown(invoice.userId);
    document.getElementById('invoiceStatus').value = invoice.status || 'pending';
    document.getElementById('invoiceDate').value = (invoice.date || '').split('T')[0];
    document.getElementById('invoiceDueDate').value = (invoice.dueDate || '').split('T')[0];
    document.getElementById('invoicePaymentMethod').value = invoice.paymentMethod || 'N/A';
    document.getElementById('invoiceTaxRate').value = invoice.taxRate || 0;
    document.getElementById('invoiceNotes').value = invoice.notes || '';

    const itemsBody = document.getElementById('invoiceItemsBody');
    itemsBody.innerHTML = '';
    (invoice.items || []).forEach(item => {
        addInvoiceLineItem(item);
    });
    if (!invoice.items || invoice.items.length === 0) addInvoiceLineItem();

    recalcAllInvoiceItems();
    document.getElementById('invoiceFormModal').classList.add('active');
}

function closeInvoiceFormModal() {
    document.getElementById('invoiceFormModal').classList.remove('active');
}

function populateCustomerDropdown(selectedId) {
    const select = document.getElementById('invoiceCustomer');
    const users = getUsers();
    select.innerHTML = '<option value="">Select customer...</option>';
    users.forEach(u => {
        const label = (u.company ? u.company + ' — ' : '') + u.email;
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = label;
        if (selectedId && u.id === selectedId) opt.selected = true;
        select.appendChild(opt);
    });
}

function addInvoiceLineItem(data) {
    const tbody = document.getElementById('invoiceItemsBody');
    const tr = document.createElement('tr');
    tr.className = 'invoice-item-row';
    const desc = data ? data.description : '';
    const qty = data ? data.quantity : 1;
    const price = data ? data.unitPrice : 0;
    const total = data ? (data.total || qty * price) : 0;
    tr.innerHTML = `
        <td><input type="text" class="item-description" value="${desc}" placeholder="Item description" required></td>
        <td><input type="number" class="item-quantity" min="1" value="${qty}" onchange="recalcInvoiceItemRow(this)"></td>
        <td><input type="number" class="item-unit-price" min="0" step="0.01" value="${price}" placeholder="0.00" onchange="recalcInvoiceItemRow(this)"></td>
        <td class="item-total">$${total.toFixed(2)}</td>
        <td><button type="button" class="btn-icon-small delete" onclick="removeInvoiceLineItem(this)" title="Remove"><i class="fas fa-times"></i></button></td>
    `;
    tbody.appendChild(tr);
    recalcAllInvoiceItems();
}

function removeInvoiceLineItem(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    if (tbody.querySelectorAll('.invoice-item-row').length <= 1) return;
    row.remove();
    recalcAllInvoiceItems();
}

function recalcInvoiceItemRow(input) {
    const row = input.closest('tr');
    const qty = parseFloat(row.querySelector('.item-quantity').value) || 0;
    const price = parseFloat(row.querySelector('.item-unit-price').value) || 0;
    row.querySelector('.item-total').textContent = '\u20ac' + (qty * price).toFixed(2);
    recalcAllInvoiceItems();
}

function recalcAllInvoiceItems() {
    const rows = document.querySelectorAll('#invoiceItemsBody .invoice-item-row');
    let subtotal = 0;
    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(row.querySelector('.item-unit-price').value) || 0;
        subtotal += qty * price;
    });
    const taxRate = parseFloat(document.getElementById('invoiceTaxRate').value) || 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    document.getElementById('invoiceFormSubtotal').textContent = '\u20ac' + subtotal.toFixed(2);
    document.getElementById('invoiceFormTax').textContent = '\u20ac' + tax.toFixed(2);
    document.getElementById('invoiceFormTotal').textContent = '\u20ac' + total.toFixed(2);
}

function resetInvoiceItems() {
    const tbody = document.getElementById('invoiceItemsBody');
    tbody.innerHTML = '';
    addInvoiceLineItem();
}

function handleInvoiceFormSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('invoiceEditId').value;
    const userId = document.getElementById('invoiceCustomer').value;
    const users = getUsers();
    const user = users.find(u => u.id === userId);

    const rows = document.querySelectorAll('#invoiceItemsBody .invoice-item-row');
    const items = [];
    rows.forEach(row => {
        items.push({
            description: row.querySelector('.item-description').value,
            quantity: parseFloat(row.querySelector('.item-quantity').value) || 1,
            unitPrice: parseFloat(row.querySelector('.item-unit-price').value) || 0
        });
    });

    const data = {
        userId: userId,
        userEmail: user ? user.email : '',
        userCompany: user ? (user.company || '') : '',
        userPhone: user ? (user.phone || '') : '',
        userAddress: user ? (user.address || '') : '',
        date: new Date(document.getElementById('invoiceDate').value).toISOString(),
        dueDate: new Date(document.getElementById('invoiceDueDate').value).toISOString(),
        status: document.getElementById('invoiceStatus').value,
        paymentMethod: document.getElementById('invoicePaymentMethod').value,
        taxRate: parseFloat(document.getElementById('invoiceTaxRate').value) || 0,
        notes: document.getElementById('invoiceNotes').value,
        items: items
    };

    const subtotal = items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);
    const tax = subtotal * (data.taxRate / 100);
    data.subtotal = subtotal;
    data.tax = tax;
    data.total = subtotal + tax;
    data.currency = 'USD';
    data.items = items.map(it => ({ ...it, total: it.quantity * it.unitPrice }));

    if (editId) {
        updateInvoice(editId, data);
    } else {
        createManualInvoice(data);
    }

    closeInvoiceFormModal();
    loadAdminInvoices();
}

// ---- View Invoice Detail Modal ----
function viewAdminInvoice(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) { alert('Invoice not found'); return; }

    const users = getUsers();
    const user = users.find(u => u.id === invoice.userId) || {};
    const isOverdue = invoice.status === 'pending' && new Date(invoice.dueDate) < new Date();
    const displayStatus = invoice.status === 'void' ? 'Void' : (isOverdue ? 'Overdue' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1));
    const statusClass = invoice.status === 'paid' ? 'active' : (invoice.status === 'void' ? 'void' : (isOverdue ? 'error' : 'warning'));

    const body = document.getElementById('invoiceDetailBody');
    body.innerHTML = `
        <div class="invoice-detail-view">
            <div class="invoice-detail-top">
                <div>
                    <h3 style="font-size:1.4rem;margin-bottom:0.25rem;">${invoice.invoiceNumber}</h3>
                    <span class="status-badge ${statusClass}" style="font-size:0.85rem;">${displayStatus}</span>
                </div>
                <div class="invoice-detail-actions">
                    <button class="btn btn-small btn-outline" onclick="editAdminInvoice('${invoice.id}');closeInvoiceDetailModal();"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn btn-small btn-outline" onclick="downloadAdminInvoice('${invoice.id}')"><i class="fas fa-download"></i> Download</button>
                    <button class="btn btn-small btn-outline" onclick="sendAdminInvoice('${invoice.id}');closeInvoiceDetailModal();"><i class="fas fa-paper-plane"></i> Send</button>
                    ${invoice.status === 'pending' ? `<button class="btn btn-small btn-primary" onclick="markInvoicePaid('${invoice.id}');closeInvoiceDetailModal();"><i class="fas fa-check-circle"></i> Mark Paid</button>` : ''}
                    <button class="btn btn-small btn-outline" onclick="printAdminInvoice('${invoice.id}')"><i class="fas fa-print"></i> Print</button>
                </div>
            </div>
            <div class="invoice-detail-grid">
                <div>
                    <h4>Bill To</h4>
                    <p><strong>${invoice.userCompany || user.company || 'N/A'}</strong></p>
                    <p>${invoice.userEmail || user.email || 'N/A'}</p>
                    ${invoice.userPhone ? `<p>${invoice.userPhone}</p>` : ''}
                    ${invoice.userAddress ? `<p>${invoice.userAddress}</p>` : ''}
                </div>
                <div>
                    <h4>Invoice Info</h4>
                    <p><strong>Date:</strong> ${formatDate(invoice.date)}</p>
                    <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
                    <p><strong>Payment:</strong> ${invoice.paymentMethod || 'N/A'}</p>
                    <p><strong>Currency:</strong> ${invoice.currency || 'USD'}</p>
                </div>
            </div>
            <table class="data-table" style="margin-top:1.25rem;">
                <thead>
                    <tr><th>Description</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Total</th></tr>
                </thead>
                <tbody>
                    ${(invoice.items || []).map(item => `
                        <tr>
                            <td>${item.description}</td>
                            <td style="text-align:right;">${item.quantity}</td>
                            <td style="text-align:right;">$${(item.unitPrice || 0).toFixed(2)}</td>
                            <td style="text-align:right;">$${(item.total || 0).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="invoice-detail-totals">
                <div class="total-line"><span>Subtotal:</span> <span>$${(invoice.subtotal || 0).toFixed(2)}</span></div>
                ${invoice.taxRate > 0 ? `<div class="total-line"><span>Tax (${invoice.taxRate}%):</span> <span>$${(invoice.tax || 0).toFixed(2)}</span></div>` : ''}
                <div class="total-line grand"><span>Total:</span> <span>$${(invoice.total || 0).toFixed(2)}</span></div>
            </div>
            ${invoice.notes ? `<div class="invoice-detail-notes"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
        </div>
    `;

    document.getElementById('invoiceDetailTitle').innerHTML = `<i class="fas fa-file-invoice"></i> ${invoice.invoiceNumber}`;
    document.getElementById('invoiceDetailModal').classList.add('active');
}

function closeInvoiceDetailModal() {
    document.getElementById('invoiceDetailModal').classList.remove('active');
}

function printAdminInvoice(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) return;
    const html = createInvoiceHTML(invoice);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.onload = function() { w.print(); };
}

// ---- Download ----
function downloadAdminInvoice(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) { alert('Invoice not found'); return; }
    downloadInvoicePDF(invoice);
}

// ---- Status Changes ----
function markInvoicePaid(invoiceId) {
    if (!confirm('Mark this invoice as paid?')) return;
    updateInvoice(invoiceId, { status: 'paid' });
    loadAdminInvoices();
}

function markInvoiceUnpaid(invoiceId) {
    if (!confirm('Mark this invoice as unpaid (pending)?')) return;
    updateInvoice(invoiceId, { status: 'pending' });
    loadAdminInvoices();
}

function voidAdminInvoice(invoiceId) {
    if (!confirm('Void this invoice? This will mark it as void.')) return;
    updateInvoice(invoiceId, { status: 'void' });
    loadAdminInvoices();
}

// ---- Delete ----
function deleteAdminInvoice(invoiceId) {
    if (!confirm('Are you sure you want to permanently delete this invoice? This cannot be undone.')) return;
    deleteInvoice(invoiceId);
    loadAdminInvoices();
}

// ---- Duplicate ----
function duplicateAdminInvoice(invoiceId) {
    const newInv = duplicateInvoice(invoiceId);
    if (newInv) {
        loadAdminInvoices();
        alert('Invoice duplicated as ' + newInv.invoiceNumber);
    }
}

// ---- Send Invoice ----
function sendAdminInvoice(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) { alert('Invoice not found'); return; }

    document.getElementById('sendInvoiceId').value = invoiceId;
    document.getElementById('sendInvoiceEmail').value = invoice.userEmail || '';
    document.getElementById('sendInvoiceSubject').value = 'Invoice ' + invoice.invoiceNumber + ' from Aurion';
    document.getElementById('sendInvoiceMessage').value = 'Dear Customer,\n\nPlease find attached invoice ' + invoice.invoiceNumber + ' for $' + invoice.total.toFixed(2) + '.\n\nDue date: ' + formatDate(invoice.dueDate) + '\n\nThank you for your business!\n\nAurion Team';
    document.getElementById('sendInvoiceModal').classList.add('active');
}

function closeSendInvoiceModal() {
    document.getElementById('sendInvoiceModal').classList.remove('active');
}

function handleSendInvoice(e) {
    e.preventDefault();
    const invoiceId = document.getElementById('sendInvoiceId').value;
    const email = document.getElementById('sendInvoiceEmail').value;
    const subject = document.getElementById('sendInvoiceSubject').value;
    const message = document.getElementById('sendInvoiceMessage').value;

    const invoice = getInvoiceById(invoiceId);
    if (!invoice) return;

    if (typeof sendPaymentThankYouEmail === 'function') {
        const users = getUsers();
        const user = users.find(u => u.id === invoice.userId) || { email: email };
        sendPaymentThankYouEmail(user, invoice);
    }

    updateInvoice(invoiceId, { lastSentAt: new Date().toISOString(), lastSentTo: email });
    closeSendInvoiceModal();
    alert('Invoice sent to ' + email);
    loadAdminInvoices();
}

// ---- Send Reminder ----
function sendPaymentReminder(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) return;
    if (!confirm('Send a payment reminder to ' + (invoice.userEmail || 'the customer') + '?')) return;

    if (typeof sendPaymentThankYouEmail === 'function') {
        const users = getUsers();
        const user = users.find(u => u.id === invoice.userId) || { email: invoice.userEmail };
        sendPaymentThankYouEmail(user, invoice);
    }

    updateInvoice(invoiceId, { lastReminderAt: new Date().toISOString() });
    alert('Payment reminder sent to ' + (invoice.userEmail || 'customer'));
}

// ---- Generate All Missing ----
function generateAllInvoices() {
    if (typeof generateInvoicesForTransactions === 'function') {
        generateInvoicesForTransactions();
        loadAdminInvoices();
        alert('All missing invoices have been generated!');
    }
}

// ---- Export ----
function exportAllInvoices() {
    const invoices = getFilteredInvoices();
    const users = getUsers();

    const csv = [
        ['Invoice #', 'Customer', 'Email', 'Date', 'Due Date', 'Amount', 'Tax', 'Total', 'Status', 'Payment Method'],
        ...invoices.map(inv => {
            const user = users.find(u => u.id === inv.userId) || { email: inv.userEmail || 'Unknown', company: inv.userCompany || 'Unknown' };
            return [
                inv.invoiceNumber,
                '"' + (user.company || user.email).replace(/"/g, '""') + '"',
                user.email,
                formatDate(inv.date),
                formatDate(inv.dueDate),
                '\u20ac' + (inv.subtotal || inv.total || 0).toFixed(2),
                '\u20ac' + (inv.tax || 0).toFixed(2),
                '\u20ac' + (inv.total || 0).toFixed(2),
                inv.status,
                inv.paymentMethod || 'N/A'
            ];
        })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ---- Bulk Actions ----
function toggleSelectAllInvoices() {
    const checked = document.getElementById('selectAllInvoices').checked;
    document.querySelectorAll('.invoice-select-cb').forEach(cb => { cb.checked = checked; });
    updateBulkActions();
}

function updateBulkActions() {
    const selected = document.querySelectorAll('.invoice-select-cb:checked');
    const bar = document.getElementById('invoiceBulkActions');
    const count = document.getElementById('invoiceSelectedCount');
    if (selected.length > 0) {
        bar.style.display = 'flex';
        count.textContent = selected.length + ' selected';
    } else {
        bar.style.display = 'none';
    }
}

function getSelectedInvoiceIds() {
    return Array.from(document.querySelectorAll('.invoice-select-cb:checked')).map(cb => cb.value);
}

function bulkMarkInvoicesPaid() {
    const ids = getSelectedInvoiceIds();
    if (!ids.length) return;
    if (!confirm('Mark ' + ids.length + ' invoice(s) as paid?')) return;
    ids.forEach(id => updateInvoice(id, { status: 'paid' }));
    loadAdminInvoices();
}

function bulkSendInvoices() {
    const ids = getSelectedInvoiceIds();
    if (!ids.length) return;
    if (!confirm('Send ' + ids.length + ' invoice(s) to their respective customers?')) return;
    ids.forEach(id => {
        const inv = getInvoiceById(id);
        if (inv && typeof sendPaymentThankYouEmail === 'function') {
            const users = getUsers();
            const user = users.find(u => u.id === inv.userId) || { email: inv.userEmail };
            sendPaymentThankYouEmail(user, inv);
            updateInvoice(id, { lastSentAt: new Date().toISOString() });
        }
    });
    alert(ids.length + ' invoice(s) sent.');
    loadAdminInvoices();
}

function bulkDeleteInvoices() {
    const ids = getSelectedInvoiceIds();
    if (!ids.length) return;
    if (!confirm('Permanently delete ' + ids.length + ' invoice(s)? This cannot be undone.')) return;
    ids.forEach(id => deleteInvoice(id));
    loadAdminInvoices();
}

// ---- Dropdown Menu ----
function toggleInvoiceMenu(btn) {
    const menu = btn.nextElementSibling;
    document.querySelectorAll('.invoice-dropdown-menu.show').forEach(m => { if (m !== menu) m.classList.remove('show'); });
    menu.classList.toggle('show');
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.invoice-action-dropdown')) {
        document.querySelectorAll('.invoice-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    }
});

document.addEventListener('change', function(e) {
    if (e.target.classList.contains('invoice-select-cb')) {
        updateBulkActions();
    }
});

// Package Management
const PACKAGES_KEY = 'cargotrack_packages';

function initPackageManagement() {
    document.getElementById('addPackageBtn').addEventListener('click', showAddPackageForm);
    document.getElementById('packageForm').addEventListener('submit', savePackage);
    document.getElementById('closePackageModal').addEventListener('click', closePackageModal);
    
    initDefaultPackages();
    populatePackageDropdowns();
}

function initDefaultPackages() {
    const storedPackages = localStorage.getItem(PACKAGES_KEY);
    const needsMigration = storedPackages && (() => {
        try {
            const p = JSON.parse(storedPackages);
            return p.basic || p.professional || p.enterprise;
        } catch (_) { return false; }
    })();
    if (!storedPackages || needsMigration) {
        const defaultPackages = {
            track: {
                id: 'track',
                name: 'Track',
                price: 9.95,
                annualPrice: 119.40,
                interval: '5 min',
                data: '50 MB',
                maxDevices: 0,
                description: 'Live GPS fleet map, basic geofence alerts, device management, mobile app access, email notifications',
                features: ['Live GPS fleet map', 'Basic geofence alerts', 'Device management', 'Mobile app access', 'Email notifications'],
                active: true
            },
            monitor: {
                id: 'monitor',
                name: 'Monitor',
                price: 14.95,
                annualPrice: 179.40,
                interval: '1 min',
                data: '200 MB',
                maxDevices: 0,
                description: 'Everything in Track plus delay intelligence, route replay, condition monitoring, compliance reports, analytics dashboard',
                features: ['Everything in Track', 'Delay intelligence & SLA tracking', 'Route replay & proof reports', 'Condition monitoring (temp, humidity)', 'Compliance reports & audit trails', 'Analytics dashboard', 'Automated alert rules'],
                featured: true,
                active: true
            },
            predict: {
                id: 'predict',
                name: 'Predict',
                price: 24.95,
                annualPrice: 299.40,
                interval: '10 sec',
                data: '500 MB',
                maxDevices: 0,
                description: 'Everything in Monitor plus AI risk engine, smart insurance pricing, API access, dedicated account manager, priority support',
                features: ['Everything in Monitor', 'AI risk engine & predictive analytics', 'Smart insurance pricing', 'API access & custom integrations', 'Dedicated account manager', 'Priority 24/7 support'],
                active: true
            }
        };
        localStorage.setItem(PACKAGES_KEY, JSON.stringify(defaultPackages));
    }
}

const PACKAGE_ALIASES = {
    basic: 'track', professional: 'monitor', enterprise: 'predict',
    locate: 'track', manage: 'monitor', protect: 'predict',
    comply: 'track', validate: 'monitor', certify: 'predict',
    assess: 'track', underwrite: 'monitor', secure: 'track',
    optimise: 'monitor', command: 'predict'
};

function resolvePackageId(raw) {
    const key = (raw || '').toString().toLowerCase().trim();
    return PACKAGE_ALIASES[key] || key || 'monitor';
}

function resolvePackageName(raw) {
    const id = resolvePackageId(raw);
    const names = { track: 'Track', monitor: 'Monitor', predict: 'Predict' };
    return names[id] || id.charAt(0).toUpperCase() + id.slice(1);
}

function resolvePackagePrice(raw) {
    const id = resolvePackageId(raw);
    const prices = { track: 9.95, monitor: 14.95, predict: 24.95 };
    return prices[id] || 14.95;
}

function formatEurAdmin(value) {
    return '\u20ac' + Number(value).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function populatePackageDropdowns() {
    const packages = getPackages();
    const selectors = ['#newUserPackage', '#editUserPackage', '#filterUserPackage'];
    selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) return;
        const current = el.value;
        const isFilter = sel.includes('filter');
        el.innerHTML = '';
        if (isFilter) {
            const allOpt = document.createElement('option');
            allOpt.value = 'all';
            allOpt.textContent = 'All Packages';
            el.appendChild(allOpt);
        }
        Object.values(packages).filter(p => p.active !== false).forEach(pkg => {
            const opt = document.createElement('option');
            opt.value = pkg.id;
            opt.textContent = `${pkg.name} (\u20ac${Number(pkg.price).toFixed(2)}/asset/mo)`;
            if (pkg.featured && !isFilter) opt.selected = true;
            el.appendChild(opt);
        });
        if (current && el.querySelector(`option[value="${current}"]`)) {
            el.value = current;
        }
    });
}

function getPackages() {
    const packages = localStorage.getItem(PACKAGES_KEY);
    if (!packages) {
        initDefaultPackages();
        return JSON.parse(localStorage.getItem(PACKAGES_KEY));
    }
    return JSON.parse(packages);
}

function savePackages(packagesObj) {
    localStorage.setItem(PACKAGES_KEY, JSON.stringify(packagesObj));
    // Also update the packages in script.js context if possible
    if (typeof window !== 'undefined' && window.updatePackagesInOrderForm) {
        window.updatePackagesInOrderForm(packagesObj);
    }
}

function loadPackages() {
    const packages = getPackages();
    const tableBody = document.getElementById('packagesTable');
    if (!tableBody) return;
    
    const packagesArray = Object.values(packages);
    
    if (packagesArray.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    No packages found. Click "Add Package" to create one.
                </td>
            </tr>
        `;
    } else {
        const tierColors = { track: '#3b82f6', monitor: '#10b981', predict: '#f59e0b' };
        tableBody.innerHTML = packagesArray.map(pkg => {
            const color = tierColors[pkg.id] || '#6b7280';
            const featuresHtml = Array.isArray(pkg.features) && pkg.features.length
                ? `<div style="margin-top:0.5rem;">${pkg.features.map(f => `<span style="display:inline-block;font-size:0.7rem;padding:0.15rem 0.5rem;background:${color}18;color:${color};border-radius:9999px;margin:0.15rem 0.25rem 0.15rem 0;">${f}</span>`).join('')}</div>`
                : '';
            return `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span style="width:4px;height:2.5rem;background:${color};border-radius:4px;display:inline-block;"></span>
                        <div>
                            <strong>${pkg.name}</strong>${pkg.featured ? ' <span style="font-size:0.65rem;padding:0.1rem 0.4rem;background:#fef3c7;color:#92400e;border-radius:9999px;">Popular</span>' : ''}
                            <br><small style="color: var(--text-light);">ID: ${pkg.id}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <strong>\u20ac${Number(pkg.price).toFixed(2)}</strong><span style="color:var(--text-light);font-size:0.8rem;">/asset/mo</span>
                    <br><small style="color:var(--text-light);">\u20ac${Number(pkg.annualPrice || pkg.price * 12).toFixed(2)}/asset/yr</small>
                </td>
                <td>
                    <span style="display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-clock" style="color:${color};font-size:0.75rem;"></i> ${pkg.interval || '-'}</span>
                    <br><span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.85rem;color:var(--text-light);"><i class="fas fa-database" style="font-size:0.7rem;"></i> ${pkg.data || '-'}</span>
                </td>
                <td>${pkg.maxDevices === 0 || !pkg.maxDevices ? '<span style="color:#10b981;">Unlimited</span>' : pkg.maxDevices}</td>
                <td><span class="status-badge ${pkg.active ? 'active' : 'inactive'}">${pkg.active ? 'Active' : 'Inactive'}</span></td>
                <td style="max-width:280px;">${featuresHtml || '<span style="color:var(--text-light);font-size:0.85rem;">—</span>'}</td>
                <td>
                    <div class="user-actions">
                        <button class="btn-icon-small edit" onclick="editPackage('${pkg.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon-small delete" onclick="deletePackage('${pkg.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }
}

function showAddPackageForm() {
    document.getElementById('packageFormTitle').textContent = 'Add Package';
    document.getElementById('packageForm').reset();
    document.getElementById('packageId').disabled = false;
    document.getElementById('packageActive').checked = true;
    document.getElementById('packageFeatured').checked = false;
    document.getElementById('packageFormModal').classList.add('active');
}

function editPackage(packageId) {
    const packages = getPackages();
    const pkg = packages[packageId];
    if (!pkg) {
        alert('Package not found');
        return;
    }
    
    document.getElementById('packageFormTitle').textContent = 'Edit Package';
    document.getElementById('packageId').value = pkg.id;
    document.getElementById('packageId').disabled = true;
    document.getElementById('packageName').value = pkg.name;
    document.getElementById('packageDescription').value = pkg.description || '';
    document.getElementById('packagePrice').value = pkg.price;
    document.getElementById('packageAnnualPrice').value = pkg.annualPrice || '';
    document.getElementById('packageInterval').value = pkg.interval || '';
    document.getElementById('packageData').value = pkg.data || '';
    document.getElementById('packageMaxDevices').value = pkg.maxDevices || 0;
    document.getElementById('packageFeatured').checked = pkg.featured === true;
    document.getElementById('packageActive').checked = pkg.active !== false;
    const featuresEl = document.getElementById('packageFeatures');
    if (featuresEl) featuresEl.value = Array.isArray(pkg.features) ? pkg.features.join('\n') : '';
    
    document.getElementById('packageFormModal').classList.add('active');
}

function savePackage(e) {
    e.preventDefault();
    
    const packageId = document.getElementById('packageId').value.trim().toLowerCase().replace(/\s+/g, '-');
    const packageName = document.getElementById('packageName').value.trim();
    const packageDescription = document.getElementById('packageDescription').value.trim();
    const packagePrice = parseFloat(document.getElementById('packagePrice').value);
    const packageAnnualPrice = parseFloat(document.getElementById('packageAnnualPrice').value) || (packagePrice * 12);
    const packageInterval = document.getElementById('packageInterval').value.trim();
    const packageData = document.getElementById('packageData').value.trim();
    const packageMaxDevices = parseInt(document.getElementById('packageMaxDevices').value) || 0;
    const packageFeatured = document.getElementById('packageFeatured').checked;
    const packageActive = document.getElementById('packageActive').checked;
    const featuresRaw = (document.getElementById('packageFeatures')?.value || '').trim();
    const features = featuresRaw ? featuresRaw.split('\n').map(f => f.trim()).filter(Boolean) : [];
    
    if (!packageId || !packageName) {
        alert('Please fill in all required fields');
        return;
    }
    
    if (isNaN(packagePrice) || packagePrice < 0) {
        alert('Please enter a valid price per asset');
        return;
    }
    
    const packages = getPackages();
    const isEditing = document.getElementById('packageId').disabled;
    
    if (!isEditing && packages[packageId]) {
        alert('Package ID already exists. Please use a different ID.');
        return;
    }
    
    packages[packageId] = {
        id: packageId,
        name: packageName,
        description: packageDescription || `${packageName} — \u20ac${packagePrice.toFixed(2)}/asset/mo`,
        price: packagePrice,
        annualPrice: packageAnnualPrice,
        interval: packageInterval,
        data: packageData,
        maxDevices: packageMaxDevices,
        features: features,
        featured: packageFeatured,
        active: packageActive
    };
    
    savePackages(packages);
    closePackageModal();
    loadPackages();
    populatePackageDropdowns();
    
    showNotification('Package saved successfully.', 'success');
}

function deletePackage(packageId) {
    const packages = getPackages();
    const pkg = packages[packageId];
    
    if (!pkg) {
        alert('Package not found');
        return;
    }
    
    if (confirm(`Are you sure you want to delete the "${pkg.name}" package? This action cannot be undone.`)) {
        delete packages[packageId];
        savePackages(packages);
        loadPackages();
        populatePackageDropdowns();
        showNotification('Package deleted successfully.', 'success');
    }
}

function closePackageModal() {
    document.getElementById('packageFormModal').classList.remove('active');
    document.getElementById('packageForm').reset();
}

function exportPayments() {
    const transactions = getPaymentTransactions();
    const csv = [
        ['Transaction ID', 'User', 'Package', 'Amount', 'Method', 'Status', 'Date'],
        ...transactions.map(t => [
            t.id,
            t.userEmail,
            t.package,
            t.amount,
            t.method,
            t.status,
            formatDate(t.date)
        ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function viewTransaction(txnId) {
    const transactions = getPaymentTransactions();
    const txn = transactions.find(t => t.id === txnId);
    if (!txn) return;

    const modal = document.getElementById('adminDeviceModal') || createTempModal();
    const title = modal.querySelector('.modal-header h2') || modal.querySelector('h2');
    const body = modal.querySelector('.modal-body') || modal.querySelector('[id$="ModalBody"]');
    if (!title || !body) {
        showNotification(`Transaction ${txn.id}: ${txn.userEmail} - $${txn.amount} (${txn.status})`, 'info');
        return;
    }
    title.textContent = 'Transaction Details';
    body.innerHTML = `
        <div class="settings-form">
            <div class="form-row">
                <div class="form-group"><label>Transaction ID</label><input type="text" value="${txn.id}" readonly></div>
                <div class="form-group"><label>Date</label><input type="text" value="${formatDate(txn.date)}" readonly></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>User</label><input type="text" value="${txn.userEmail || 'Unknown'}" readonly></div>
                <div class="form-group"><label>Package</label><input type="text" value="${txn.package || 'N/A'}" readonly></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Amount</label><input type="text" value="\u20ac${txn.amount}" readonly></div>
                <div class="form-group"><label>Method</label><input type="text" value="${txn.method || 'N/A'}" readonly></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Status</label><input type="text" value="${txn.status}" readonly></div>
                <div class="form-group"><label>Invoice</label><input type="text" value="${txn.invoiceId || 'N/A'}" readonly></div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

// Financial & Analytics
function initFinancialAnalytics() {
    document.getElementById('exportFinancialReportBtn').addEventListener('click', exportFinancialReport);
    document.getElementById('revenuePeriod').addEventListener('change', function() {
        loadFinancialAnalytics();
    });
    document.getElementById('growthPeriod').addEventListener('change', function() {
        loadFinancialAnalytics();
    });
}

function loadFinancialAnalytics() {
    const users = getUsers();
    const transactions = getPaymentTransactions();
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + parseAmount(t.amount), 0);

    const now = new Date();
    const thisMonth = completedTransactions.filter(t => {
        const txnDate = new Date(t.date);
        return txnDate.getMonth() === now.getMonth() && txnDate.getFullYear() === now.getFullYear();
    });
    const monthlyRevenue = thisMonth.reduce((sum, t) => sum + parseAmount(t.amount), 0);

    const lastMonth = completedTransactions.filter(t => {
        const txnDate = new Date(t.date);
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
        return txnDate.getMonth() === lastMonthDate.getMonth() && txnDate.getFullYear() === lastMonthDate.getFullYear();
    });
    const lastMonthRevenue = lastMonth.reduce((sum, t) => sum + parseAmount(t.amount), 0);

    const thisYear = completedTransactions.filter(t => {
        const txnDate = new Date(t.date);
        return txnDate.getFullYear() === now.getFullYear();
    });
    const yearlyRevenue = thisYear.reduce((sum, t) => sum + parseAmount(t.amount), 0);
    
    // Calculate MRR (Monthly Recurring Revenue)
    const activeUsers = users.filter(u => u.isActive !== false);
    const mrr = activeUsers.reduce((sum, u) => {
        const assetCount = Math.max(parseInt(u.devices) || 1, 1);
        return sum + (resolvePackagePrice(u.package) * assetCount);
    }, 0);
    
    // Calculate ARPU (Average Revenue Per User)
    const arpu = activeUsers.length > 0 ? totalRevenue / activeUsers.length : 0;
    
    // Calculate Churn Rate (simplified)
    const churned = users.filter(u => u.isActive === false || u.status === 'suspended').length;
    const churnRate = users.length > 0 ? (churned / users.length) * 100 : 0;
    
    // Update main stats
    document.getElementById('totalRevenueAnalytics').textContent = formatEurAdmin(totalRevenue);
    document.getElementById('monthlyRecurringRevenue').textContent = formatEurAdmin(mrr);
    document.getElementById('averageRevenuePerUser').textContent = formatEurAdmin(Math.round(arpu));
    document.getElementById('churnRate').textContent = churnRate.toFixed(1) + '%';
    
    const revenueGrowth = lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : (monthlyRevenue > 0 ? 100 : 0);

    const lastMonthUsers = users.filter(u => {
        const d = new Date(u.createdAt);
        const lm = new Date(now.getFullYear(), now.getMonth() - 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    });
    const lastMonthActiveUsers = lastMonthUsers.filter(u => u.isActive !== false);
    const lastMrr = lastMonthActiveUsers.reduce((sum, u) => {
        const assetCount = Math.max(parseInt(u.devices) || 1, 1);
        return sum + (resolvePackagePrice(u.package) * assetCount);
    }, 0);
    const mrrGrowth = lastMrr > 0 ? ((mrr - lastMrr) / lastMrr) * 100 : (mrr > 0 ? 100 : 0);

    const lastArpu = lastMonthActiveUsers.length > 0 ? lastMonthRevenue / lastMonthActiveUsers.length : 0;
    const arpuGrowth = lastArpu > 0 ? ((arpu - lastArpu) / lastArpu) * 100 : (arpu > 0 ? 100 : 0);

    const churnChange = churnRate > 0 ? -churnRate : 0;

    setChangeIndicator('revenueChange', revenueGrowth);
    setChangeIndicator('mrrChange', mrrGrowth);
    setChangeIndicator('arpuChange', arpuGrowth);
    setChangeIndicator('churnChange', churnChange);
    
    // Update breakdown
    document.getElementById('breakdownTotalRevenue').textContent = formatEurAdmin(totalRevenue);
    document.getElementById('breakdownMonthlyRevenue').textContent = formatEurAdmin(monthlyRevenue);
    document.getElementById('breakdownLastMonthRevenue').textContent = formatEurAdmin(lastMonthRevenue);
    document.getElementById('breakdownYearlyRevenue').textContent = formatEurAdmin(yearlyRevenue);
    document.getElementById('breakdownGrowthRate').textContent = revenueGrowth.toFixed(1) + '%';
    
    document.getElementById('breakdownTotalCustomers').textContent = users.length;
    const newThisMonth = users.filter(u => {
        const userDate = new Date(u.createdAt);
        return userDate.getMonth() === now.getMonth() && userDate.getFullYear() === now.getFullYear();
    }).length;
    document.getElementById('breakdownNewCustomers').textContent = newThisMonth;
    document.getElementById('breakdownActiveSubscriptions').textContent = activeUsers.length;
    document.getElementById('breakdownChurned').textContent = churned;
    
    // Calculate CLV (Customer Lifetime Value) - simplified
    const avgMonthlyRevenue = monthlyRevenue / Math.max(activeUsers.length, 1);
    const avgLifetimeMonths = 12; // Simplified assumption
    const clv = avgMonthlyRevenue * avgLifetimeMonths;
    document.getElementById('breakdownCLV').textContent = formatEurAdmin(Math.round(clv));
    
    // Package performance
    const packageRevenue = { track: 0, monitor: 0, predict: 0 };
    const packageCounts = { track: 0, monitor: 0, predict: 0 };
    
    completedTransactions.forEach(txn => {
        const amount = parseAmount(txn.amount);
        const pkg = resolvePackageId(txn.package);
        if (packageRevenue[pkg] !== undefined) {
            packageRevenue[pkg] += amount;
            packageCounts[pkg]++;
        }
    });
    
    document.getElementById('breakdownTrackRevenue').textContent = formatEurAdmin(packageRevenue.track);
    document.getElementById('breakdownMonitorRevenue').textContent = formatEurAdmin(packageRevenue.monitor);
    document.getElementById('breakdownPredictRevenue').textContent = formatEurAdmin(packageRevenue.predict);
    
    const popularPackage = Object.keys(packageCounts).reduce((a, b) => packageCounts[a] > packageCounts[b] ? a : b, 'monitor');
    document.getElementById('breakdownPopularPackage').textContent = resolvePackageName(popularPackage);
    
    const avgPackageValue = Object.values(packageRevenue).reduce((a, b) => a + b, 0) / Math.max(Object.values(packageCounts).reduce((a, b) => a + b, 0), 1);
    document.getElementById('breakdownAvgPackageValue').textContent = formatEurAdmin(avgPackageValue);
    
    const payingUsers = completedTransactions.map(t => t.userId).filter((v, i, a) => a.indexOf(v) === i).length;
    const conversionRate = users.length > 0 ? (payingUsers / users.length) * 100 : 0;
    const retentionRate = users.length > 0 ? (activeUsers.length / users.length) * 100 : 0;
    const avgMonthlyRevenuePerUser = activeUsers.length > 0 ? mrr / activeUsers.length : 0;
    const estimatedCac = 50;
    const ltvRatio = estimatedCac > 0 ? (clv / estimatedCac) : 0;
    const monthlyGrowth = revenueGrowth;

    document.getElementById('kpiConversionRate').textContent = conversionRate.toFixed(1) + '%';
    document.getElementById('kpiRetentionRate').textContent = retentionRate.toFixed(1) + '%';
    document.getElementById('kpiLTVRatio').textContent = ltvRatio.toFixed(1) + ':1';
    document.getElementById('kpiMonthlyGrowth').textContent = monthlyGrowth.toFixed(1) + '%';
    
    // Initialize charts
    initRevenueTrendChart(completedTransactions);
    initRevenueByPackageChart(packageRevenue);
    initUserGrowthChart(users);
    initSubscriptionDistributionChart(users);
    initPaymentMethodChart(transactions);
    initRevenueForecastChart(monthlyRevenue, revenueGrowth);
}

function initRevenueTrendChart(transactions) {
    const ctx = document.getElementById('revenueTrendChart');
    if (!ctx) return;
    
    const period = parseInt(document.getElementById('revenuePeriod').value) || 30;
    const now = new Date();
    const labels = [];
    const data = [];
    
    for (let i = period - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        const dayTransactions = transactions.filter(t => {
            const txnDate = new Date(t.date);
            return txnDate.toDateString() === date.toDateString();
        });
        const dayRevenue = dayTransactions.reduce((sum, t) => sum + parseAmount(t.amount), 0);
        data.push(dayRevenue);
    }
    
    if (adminCharts.revenueTrend) {
        adminCharts.revenueTrend.destroy();
    }
    
    adminCharts.revenueTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: data,
                borderColor: 'rgb(37, 99, 235)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '\u20ac' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function initRevenueByPackageChart(packageRevenue) {
    const ctx = document.getElementById('revenueByPackageChart');
    if (!ctx) return;
    
    if (adminCharts.revenueByPackage) {
        adminCharts.revenueByPackage.destroy();
    }
    
    adminCharts.revenueByPackage = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Track', 'Monitor', 'Predict'],
            datasets: [{
                data: [packageRevenue.track, packageRevenue.monitor, packageRevenue.predict],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function initUserGrowthChart(users) {
    const ctx = document.getElementById('userGrowthChart');
    if (!ctx) return;
    
    const period = parseInt(document.getElementById('growthPeriod').value) || 30;
    const now = new Date();
    const labels = [];
    const data = [];
    
    for (let i = period - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        const dayUsers = users.filter(u => {
            const userDate = new Date(u.createdAt);
            return userDate.toDateString() === date.toDateString();
        });
        data.push(dayUsers.length);
    }
    
    // Cumulative
    let cumulative = 0;
    const cumulativeData = data.map(count => {
        cumulative += count;
        return cumulative;
    });
    
    if (adminCharts.userGrowth) {
        adminCharts.userGrowth.destroy();
    }
    
    adminCharts.userGrowth = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'New Users',
                data: data,
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }, {
                label: 'Total Users',
                data: cumulativeData,
                borderColor: 'rgb(37, 99, 235)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function initSubscriptionDistributionChart(users) {
    const ctx = document.getElementById('subscriptionDistributionChart');
    if (!ctx) return;
    
    const packageCounts = { track: 0, monitor: 0, predict: 0 };
    users.forEach(u => {
        const pkg = resolvePackageId(u.package);
        if (packageCounts[pkg] !== undefined) {
            packageCounts[pkg]++;
        }
    });
    
    if (adminCharts.subscriptionDistribution) {
        adminCharts.subscriptionDistribution.destroy();
    }
    
    adminCharts.subscriptionDistribution = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Track', 'Monitor', 'Predict'],
            datasets: [{
                label: 'Subscriptions',
                data: [packageCounts.track, packageCounts.monitor, packageCounts.predict],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function initPaymentMethodChart(transactions) {
    const ctx = document.getElementById('paymentMethodChart');
    if (!ctx) return;
    
    const methodCounts = {};
    transactions.forEach(txn => {
        methodCounts[txn.method] = (methodCounts[txn.method] || 0) + 1;
    });
    
    if (adminCharts.paymentMethod) {
        adminCharts.paymentMethod.destroy();
    }
    
    adminCharts.paymentMethod = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(methodCounts),
            datasets: [{
                label: 'Transactions',
                data: Object.values(methodCounts),
                backgroundColor: [
                    'rgba(37, 99, 235, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function initRevenueForecastChart(currentRevenue, growthRate) {
    const ctx = document.getElementById('revenueForecastChart');
    if (!ctx) return;
    
    const months = ['Current', 'Next Month', 'Month 2', 'Month 3', 'Month 4', 'Month 5'];
    const forecast = [currentRevenue];
    
    for (let i = 1; i < 6; i++) {
        forecast.push(forecast[i - 1] * (1 + growthRate / 100));
    }
    
    if (adminCharts.revenueForecast) {
        adminCharts.revenueForecast.destroy();
    }
    
    adminCharts.revenueForecast = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Forecasted Revenue',
                data: forecast,
                borderColor: 'rgb(245, 158, 11)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                fill: true,
                borderDash: [5, 5]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '\u20ac' + Math.round(value).toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function exportFinancialReport() {
    const users = getUsers();
    const transactions = getPaymentTransactions();
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + parseAmount(t.amount), 0);

    const report = {
        generated: new Date().toISOString(),
        summary: {
            totalRevenue: totalRevenue,
            totalUsers: users.length,
            activeUsers: users.filter(u => u.isActive !== false).length,
            totalTransactions: completedTransactions.length
        },
        transactions: completedTransactions,
        users: users.map(u => ({
            email: u.email,
            company: u.company,
            package: u.package,
            status: u.isActive !== false ? 'active' : 'inactive',
            createdAt: u.createdAt
        }))
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

// All Devices

const ADMIN_STALE_MS = 5 * 60 * 1000;

function adminParseTimestamp(val) {
    if (!val) return null;
    if (typeof val === 'number') return Number.isFinite(val) ? val : null;
    const ms = Date.parse(val);
    return Number.isFinite(ms) ? ms : null;
}

function adminGetBestTimestamp(device) {
    const candidates = [device?.lastUpdate, device?.updatedAt, device?.tracker?.lastFix];
    let best = null;
    candidates.forEach(c => {
        const ms = adminParseTimestamp(c);
        if (ms && (!best || ms > best.ms)) best = { ms, raw: c };
    });
    return best;
}

function adminGetStaleThreshold(device) {
    const interval = Number(device?.lte?.dataLogFrequency);
    if (!interval || !Number.isFinite(interval)) return ADMIN_STALE_MS;
    const adaptive = Math.round((interval * 4) + 30000);
    return Math.max(ADMIN_STALE_MS, Math.min(adaptive, 30 * 60 * 1000));
}

function adminHasCoords(device) {
    return Number.isFinite(device?.latitude) && Number.isFinite(device?.longitude);
}

function adminConnectionStatus(device) {
    const best = adminGetBestTimestamp(device);
    if (!best) return { label: 'Not connected', cls: 'inactive', group: 'offline' };
    const stale = Date.now() - best.ms > adminGetStaleThreshold(device);
    if (stale) return { label: 'Stale', cls: 'warning', group: 'stale' };
    if (adminHasCoords(device)) return { label: 'Connected', cls: 'active', group: 'online' };
    return { label: 'No GPS', cls: 'warning', group: 'stale' };
}

function adminLastSeenText(device) {
    const best = adminGetBestTimestamp(device);
    if (!best) return 'No data';
    return formatTime(best.raw);
}

function adminSensorSummary(device) {
    const parts = [];
    const t = device.temperature;
    if (t != null && Number.isFinite(Number(t))) parts.push(`${Number(t).toFixed(1)}°C`);
    const h = device.humidity;
    if (h != null && Number.isFinite(Number(h))) parts.push(`${Number(h).toFixed(0)}%`);
    const b = device.battery;
    if (b != null && Number.isFinite(Number(b))) parts.push(`🔋${Number(b).toFixed(0)}%`);
    return parts.length ? parts.join(' · ') : '—';
}

async function loadAllDevices() {
    await fetchAdminDevices();
    const devices = getAllDevices();
    const searchEl = document.getElementById('adminDeviceSearch');
    const filterEl = document.getElementById('adminDeviceFilter');
    const search = (searchEl?.value || '').toLowerCase().trim();
    const filter = filterEl?.value || 'all';

    let online = 0, stale = 0, offline = 0;
    const rows = [];

    devices.forEach(device => {
        const conn = adminConnectionStatus(device);
        if (conn.group === 'online') online++;
        else if (conn.group === 'stale') stale++;
        else offline++;

        if (filter !== 'all' && conn.group !== filter) return;

        if (!device.tenantName && device.ownerNamespace) {
            if (device.ownerNamespace.startsWith('tenant:')) {
                const tId = device.ownerNamespace.replace('tenant:', '');
                const t = resellerTenantsCache.find(x => x.id === tId);
                if (t) { device.tenantName = t.name; device.tenantId = tId; }
            } else if (device.ownerNamespace.startsWith('user:')) {
                const uId = device.ownerNamespace.replace('user:', '');
                const allUsers = getUsers();
                const u = allUsers.find(x => x.id === uId);
                if (u?.tenantId) {
                    const t = resellerTenantsCache.find(x => x.id === u.tenantId);
                    if (t) { device.tenantName = t.name; device.tenantId = u.tenantId; }
                }
            }
        }

        const searchStr = `${device.id} ${device.name} ${device.ownerEmail} ${device.tenantName || ''} ${device.type || ''}`.toLowerCase();
        if (search && !searchStr.includes(search)) return;

        const ownerLabel = device.ownerEmail || device.tenantName || 'Unknown';
        const tenantLabel = device.tenantName ? `<small style="display:block;color:var(--text-light);">${device.tenantName}</small>` : '';
        const hasLoc = adminHasCoords(device);
        const locText = hasLoc
            ? `<a href="#" onclick="event.preventDefault();adminLocateDevice('${device.id}')" title="Show on map" style="font-size:0.8rem;">${Number(device.latitude).toFixed(3)}, ${Number(device.longitude).toFixed(3)}</a>`
            : '<span style="color:var(--text-light);">—</span>';

        rows.push(`
            <tr>
                <td><code style="font-size:0.8rem;">${device.id}</code></td>
                <td><strong>${device.name || '—'}</strong></td>
                <td>${ownerLabel}${tenantLabel}</td>
                <td>${device.type || 'Standard'}</td>
                <td><span class="status-badge ${conn.cls}">${conn.label}</span></td>
                <td>${locText}</td>
                <td style="font-size:0.8rem;">${adminSensorSummary(device)}</td>
                <td style="font-size:0.8rem;">${adminLastSeenText(device)}</td>
                <td>
                    <button class="btn btn-outline btn-small" onclick="viewDeviceAdmin('${device.id}')" title="View Details"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-outline btn-small" onclick="editDeviceAdmin('${device.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline btn-small" onclick="deleteDeviceAdmin('${device.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `);
    });

    const tableBody = document.getElementById('allDevicesTable');
    if (tableBody) {
        tableBody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="9" class="empty-state" style="text-align:center;padding:2rem;">No devices found</td></tr>';
    }

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('adminDevTotal', devices.length);
    el('adminDevOnline', online);
    el('adminDevStale', stale);
    el('adminDevOffline', offline);
}

function getAllDevices() {
    return adminDevicesCache;
}

function adminLocateDevice(deviceId) {
    const device = getAllDevices().find(d => d.id === deviceId);
    if (!device || !adminHasCoords(device)) {
        showNotification('No coordinates available for this device.', 'warning');
        return;
    }
    document.querySelector('[data-section="admin-dashboard"]')?.click();
    setTimeout(() => {
        if (adminGlobalMap) {
            adminGlobalMap.setView([device.latitude, device.longitude], 15);
            adminGlobalDeviceMarkers.forEach(m => {
                const ll = m.getLatLng();
                if (Math.abs(ll.lat - device.latitude) < 0.0001 && Math.abs(ll.lng - device.longitude) < 0.0001) {
                    m.openPopup();
                }
            });
        }
    }, 300);
}

function initAdminDeviceManagement() {
    const addBtn = document.getElementById('adminAddDeviceBtn');
    if (addBtn) addBtn.addEventListener('click', () => showAdminDeviceForm());
    const exportBtn = document.getElementById('exportDevicesBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportAdminDevices);
    const closeBtn = document.getElementById('closeAdminDeviceModal');
    if (closeBtn) closeBtn.addEventListener('click', closeAdminDeviceModal);
    const modal = document.getElementById('adminDeviceModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeAdminDeviceModal(); });

    const closeTenantBtn = document.getElementById('closeTenantEditModal');
    if (closeTenantBtn) closeTenantBtn.addEventListener('click', closeTenantEditModal);
    const tenantModal = document.getElementById('tenantEditModal');
    if (tenantModal) tenantModal.addEventListener('click', (e) => { if (e.target === tenantModal) closeTenantEditModal(); });

    const refreshBtn = document.getElementById('refreshDeviceListBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
        refreshBtn.querySelector('i').classList.add('fa-spin');
        loadAllDevices().then(() => {
            setTimeout(() => refreshBtn.querySelector('i')?.classList.remove('fa-spin'), 500);
            showNotification('Device list refreshed.', 'success');
        });
    });

    const searchEl = document.getElementById('adminDeviceSearch');
    const filterEl = document.getElementById('adminDeviceFilter');
    if (searchEl) searchEl.addEventListener('input', () => loadAllDevices());
    if (filterEl) filterEl.addEventListener('change', () => loadAllDevices());
}

function exportAdminDevices() {
    const devices = getAllDevices();
    if (!devices.length) {
        showNotification('No devices to export.', 'warning');
        return;
    }
    const csv = [
        ['Device ID', 'Name', 'Type', 'Status', 'Owner', 'Company', 'Tenant', 'Lat', 'Lng', 'Last Update'].join(','),
        ...devices.map(d => [
            d.id, d.name, d.type || '', d.status || '',
            d.ownerEmail || '', d.ownerCompany || '', d.tenantName || d.tenantId || '',
            d.latitude || '', d.longitude || '', d.lastUpdate || ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devices-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Devices exported successfully.', 'success');
}

function closeAdminDeviceModal() {
    const modal = document.getElementById('adminDeviceModal');
    if (modal) modal.style.display = 'none';
}

function viewDeviceAdmin(deviceId) {
    const devices = getAllDevices();
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    const modal = document.getElementById('adminDeviceModal');
    const title = document.getElementById('adminDeviceModalTitle');
    const body = document.getElementById('adminDeviceModalBody');
    if (!modal || !body) return;

    title.textContent = `Device: ${device.name || device.id}`;

    if (!device.tenantName && device.ownerNamespace) {
        if (device.ownerNamespace.startsWith('tenant:')) {
            const tId = device.ownerNamespace.replace('tenant:', '');
            const t = resellerTenantsCache.find(x => x.id === tId);
            if (t) { device.tenantName = t.name; device.tenantId = tId; }
        } else if (device.ownerNamespace.startsWith('user:')) {
            const uId = device.ownerNamespace.replace('user:', '');
            const allUsers = getUsers();
            const owner = allUsers.find(u => u.id === uId);
            if (owner?.tenantId) {
                const t = resellerTenantsCache.find(x => x.id === owner.tenantId);
                if (t) { device.tenantName = t.name; device.tenantId = owner.tenantId; }
            }
        }
    }

    const conn = adminConnectionStatus(device);
    const lastSeen = adminLastSeenText(device);
    const networks = device.networks || [];
    const sensors = device.sensors || [];
    const tracker = device.tracker || {};
    const lte = device.lte || {};
    const logistics = device.logistics || {};
    const hasLoc = adminHasCoords(device);
    const coordsText = hasLoc ? `${Number(device.latitude).toFixed(5)}, ${Number(device.longitude).toFixed(5)}` : 'No coordinates';
    const vv = (val, suffix) => (val != null && Number.isFinite(Number(val))) ? `${Number(val)}${suffix || ''}` : 'Not reported';

    const sensorIcons = {
        'temperature': 'fas fa-thermometer-half', 'humidity': 'fas fa-tint',
        'accelerometer': 'fas fa-compress-arrows-alt', 'gyroscope': 'fas fa-sync',
        'magnetometer': 'fas fa-compass', 'pressure': 'fas fa-weight',
        'light': 'fas fa-lightbulb', 'proximity': 'fas fa-hand-paper'
    };
    const sensorColors = {
        'temperature': '#f5576c', 'humidity': '#4facfe', 'accelerometer': '#43e97b',
        'gyroscope': '#fa709a', 'magnetometer': '#30cfd0', 'pressure': '#a8edea',
        'light': '#fcb69f', 'proximity': '#764ba2'
    };

    const sensorHtml = sensors.length > 0 ? sensors.map(s => {
        const icon = sensorIcons[s.type] || 'fas fa-circle';
        const color = sensorColors[s.type] || '#667eea';
        return `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:var(--bg-light);border-radius:0.5rem;border:1px solid var(--border-color);">
            <div style="width:36px;height:36px;border-radius:0.5rem;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;"><i class="${icon}"></i></div>
            <div><strong>${s.name || s.type}</strong><br><small style="color:var(--text-light);">${s.value != null ? s.value + ' ' + (s.unit || '') : 'Awaiting data'}</small></div>
        </div>`;
    }).join('') : '<p style="color:var(--text-light);">No sensors configured</p>';

    const networkBadgesHtml = networks.length > 0 ? networks.map(n =>
        `<span style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.35rem 0.75rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:1rem;font-size:0.8rem;color:#1d4ed8;"><i class="fas fa-wifi"></i> ${n}</span>`
    ).join(' ') : '<span style="color:var(--text-light);">None</span>';

    body.innerHTML = `
        <div class="device-details-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;">
            <div class="form-section">
                <h4><i class="fas fa-info-circle"></i> Basic Information</h4>
                <div class="detail-item"><span class="detail-label">Device ID:</span><span class="detail-value"><code>${device.id}</code></span></div>
                <div class="detail-item"><span class="detail-label">Name:</span><span class="detail-value">${device.name || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Model:</span><span class="detail-value">${device.model || lte.model || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Type:</span><span class="detail-value">${device.type || 'Standard'}</span></div>
                <div class="detail-item"><span class="detail-label">Group:</span><span class="detail-value">${device.group || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Asset:</span><span class="detail-value">${device.asset || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Status:</span><span class="detail-value"><span class="status-badge ${device.status}">${device.status || 'unknown'}</span></span></div>
                <div class="detail-item"><span class="detail-label">Connection:</span><span class="detail-value"><span class="status-badge ${conn.cls}">${conn.label}</span></span></div>
                <div class="detail-item"><span class="detail-label">Last Seen:</span><span class="detail-value">${lastSeen}</span></div>
                <div class="detail-item"><span class="detail-label">Registered:</span><span class="detail-value">${device.createdAt ? formatTime(device.createdAt) : '—'}</span></div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-user"></i> Ownership</h4>
                <div class="detail-item"><span class="detail-label">Owner Email:</span><span class="detail-value">${device.ownerEmail || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Company:</span><span class="detail-value">${device.ownerCompany || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Tenant:</span><span class="detail-value">${device.tenantName || device.tenantId || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Namespace:</span><span class="detail-value"><code style="font-size:0.8rem;">${device.ownerNamespace || '—'}</code></span></div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-map-marker-alt"></i> Location</h4>
                <div class="detail-item"><span class="detail-label">Coordinates:</span><span class="detail-value">${coordsText}${hasLoc ? ` <a href="#" onclick="event.preventDefault();closeAdminDeviceModal();adminLocateDevice('${device.id}')" style="margin-left:0.5rem;font-size:0.8rem;"><i class="fas fa-crosshairs"></i> Locate</a>` : ''}</span></div>
                <div class="detail-item"><span class="detail-label">Temperature:</span><span class="detail-value">${vv(device.temperature, '°C')}</span></div>
                <div class="detail-item"><span class="detail-label">Humidity:</span><span class="detail-value">${vv(device.humidity, '%')}</span></div>
                <div class="detail-item"><span class="detail-label">Battery:</span><span class="detail-value">${vv(device.battery, '%')}</span></div>
                <div class="detail-item"><span class="detail-label">Signal:</span><span class="detail-value">${device.signalStrength || 'Not reported'}</span></div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-satellite"></i> GPS / GNSS Tracker</h4>
                <div class="detail-item"><span class="detail-label">GPS Status:</span><span class="detail-value">${tracker.gpsStatus || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Satellites:</span><span class="detail-value">${tracker.satellites ?? device.satellites ?? 'Not reported'}</span></div>
                <div class="detail-item"><span class="detail-label">Accuracy:</span><span class="detail-value">${tracker.accuracy ? tracker.accuracy + 'm' : 'Not reported'}</span></div>
                <div class="detail-item"><span class="detail-label">Last Fix:</span><span class="detail-value">${tracker.lastFix ? formatTime(tracker.lastFix) : '—'}</span></div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-signal"></i> 4G LTE Settings</h4>
                <div class="detail-item"><span class="detail-label">IMEI:</span><span class="detail-value"><code>${lte.imei || '—'}</code></span></div>
                <div class="detail-item"><span class="detail-label">SIM ICCID:</span><span class="detail-value"><code>${lte.simIccid || '—'}</code></span></div>
                <div class="detail-item"><span class="detail-label">Carrier:</span><span class="detail-value">${lte.carrier || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">APN:</span><span class="detail-value">${lte.apn || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Data Format:</span><span class="detail-value">${lte.dataFormat || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Reporting Interval:</span><span class="detail-value">${lte.dataLogFrequency ? lte.dataLogFrequency + 'ms' : '—'}</span></div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-truck"></i> Logistics Monitoring</h4>
                <div class="detail-item"><span class="detail-label">Monitoring:</span><span class="detail-value"><span class="status-badge ${logistics.monitoringEnabled !== false ? 'active' : 'inactive'}">${logistics.monitoringEnabled !== false ? 'Enabled' : 'Disabled'}</span></span></div>
                <div class="detail-item"><span class="detail-label">Temp Range:</span><span class="detail-value">${logistics.tempMin ?? '-10'}°C — ${logistics.tempMax ?? '30'}°C</span></div>
                <div class="detail-item"><span class="detail-label">Humidity Range:</span><span class="detail-value">${logistics.humidityMin ?? '20'}% — ${logistics.humidityMax ?? '80'}%</span></div>
                <div class="detail-item"><span class="detail-label">Max Tilt:</span><span class="detail-value">${logistics.tiltMax ?? '30'}°</span></div>
                <div class="detail-item"><span class="detail-label">Max Collision:</span><span class="detail-value">${logistics.collisionMaxG ?? '2.5'}g</span></div>
                <div class="detail-item"><span class="detail-label">Delivery Grace:</span><span class="detail-value">${logistics.deliveryGraceMinutes ?? '30'} min</span></div>
                <div class="detail-item"><span class="detail-label">Alert Cooldown:</span><span class="detail-value">${logistics.alertCooldownMinutes ?? '15'} min</span></div>
            </div>
        </div>

        <div class="form-section" style="margin-top:1.25rem;">
            <h4><i class="fas fa-network-wired"></i> Network Connectivity</h4>
            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">${networkBadgesHtml}</div>
        </div>

        <div class="form-section" style="margin-top:1.25rem;">
            <h4><i class="fas fa-microchip"></i> Sensors</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.75rem;">${sensorHtml}</div>
        </div>

        <div class="form-actions" style="margin-top:1.5rem;">
            <button class="btn btn-outline" onclick="closeAdminDeviceModal()"><i class="fas fa-times"></i> Close</button>
            ${hasLoc ? `<button class="btn btn-outline" onclick="closeAdminDeviceModal();adminLocateDevice('${device.id}')"><i class="fas fa-crosshairs"></i> Locate on Map</button>` : ''}
            <button class="btn btn-outline" onclick="editDeviceAdmin('${device.id}')"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn btn-outline danger" onclick="deleteDeviceAdmin('${device.id}')"><i class="fas fa-trash"></i> Delete</button>
        </div>
    `;
    modal.style.display = 'flex';
}

function showAdminDeviceForm(deviceId) {
    const devices = getAllDevices();
    const device = deviceId ? devices.find(d => d.id === deviceId) : null;
    const isEdit = !!device;

    const modal = document.getElementById('adminDeviceModal');
    const title = document.getElementById('adminDeviceModalTitle');
    const body = document.getElementById('adminDeviceModalBody');
    if (!modal || !body) return;

    title.textContent = isEdit ? 'Edit Device' : 'Add New Device';

    const currentNs = device ? (device.ownerNamespace || '') : '';
    const namespaceOptions = getAvailableNamespaceOptions(currentNs);

    const lte = device?.lte || {};
    const logistics = device?.logistics || {};
    const nets = device?.networks || ['GPS/GNSS'];
    const sensorTypes = (device?.sensors || []).map(s => s.type || s);

    function chk(arr, val) { return arr.includes(val) ? 'checked' : ''; }
    function sel(a, b) { return a === b ? 'selected' : ''; }
    function v(val, fallback) { return val != null ? val : (fallback != null ? fallback : ''); }

    const profileOptions = TRACKER_PROFILES.map(p =>
        `<option value="${p.id}">${p.manufacturer} ${p.model} (${p.protocol})</option>`
    ).join('');

    body.innerHTML = `
        <form id="adminDeviceForm" class="settings-form" onsubmit="return false;">

            ${!isEdit ? `<div class="form-section" style="background:var(--bg-light);padding:1rem;border-radius:0.5rem;margin-bottom:1rem;">
            <h4 style="margin-top:0;"><i class="fas fa-microchip"></i> Device Profile</h4>
            <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:0.75rem;">Select a pre-built profile to auto-fill model, data format, and sensors, or choose manual entry.</p>
            <select id="adminDeviceProfile" style="width:100%;padding:0.5rem;border:1px solid var(--border-color);border-radius:0.25rem;">
                <option value="">Custom / Manual Entry</option>
                <optgroup label="Pre-built Profiles">${profileOptions}</optgroup>
            </select>
            </div>` : ''}

            <div class="form-section"><h4><i class="fas fa-info-circle"></i> Basic Information</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminDeviceId">Device ID *</label>
                    <input type="text" id="adminDeviceId" value="${device ? device.id : ''}" ${isEdit ? 'readonly' : 'required'} placeholder="e.g. TRK-001">
                </div>
                <div class="form-group">
                    <label for="adminDeviceName">Name *</label>
                    <input type="text" id="adminDeviceName" value="${v(device?.name)}" required placeholder="e.g. Truck A GPS">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminDeviceType">Device Type *</label>
                    <select id="adminDeviceType">
                        <option value="Tracker" ${sel(device?.type,'Tracker')}>Tracker</option>
                        <option value="Sensor" ${sel(device?.type,'Sensor')}>Sensor</option>
                        <option value="Gateway" ${sel(device?.type,'Gateway')}>Gateway</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="adminDeviceModel">Device Model</label>
                    <input type="text" id="adminDeviceModel" value="${v(device?.model || lte.model)}" placeholder="e.g. Teltonika FMB920">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminDeviceStatus">Status</label>
                    <select id="adminDeviceStatus">
                        <option value="active" ${sel(device?.status,'active') || (!device ? 'selected' : '')}>Active</option>
                        <option value="inactive" ${sel(device?.status,'inactive')}>Inactive</option>
                        <option value="maintenance" ${sel(device?.status,'maintenance')}>Maintenance</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="adminDeviceNamespace">Assign To *</label>
                    <select id="adminDeviceNamespace" required>${namespaceOptions}</select>
                    <small>User or tenant workspace that owns this device</small>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminDeviceGroup">Group</label>
                    <input type="text" id="adminDeviceGroup" value="${v(device?.group)}" placeholder="e.g. Fleet A">
                </div>
                <div class="form-group">
                    <label for="adminDeviceAsset">Asset</label>
                    <input type="text" id="adminDeviceAsset" value="${v(device?.asset)}" placeholder="e.g. Trailer T-100">
                </div>
            </div>
            </div>

            <div class="form-section"><h4><i class="fas fa-network-wired"></i> Network Connectivity</h4>
            <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:0.75rem;">Select all network types supported by this device</p>
            <div class="checkbox-grid">
                <label class="checkbox-item"><input type="checkbox" name="adNetworks" value="GPS/GNSS" ${chk(nets,'GPS/GNSS')}><span><i class="fas fa-satellite"></i> GPS/GNSS</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adNetworks" value="4G LTE" ${chk(nets,'4G LTE')}><span><i class="fas fa-signal"></i> 4G LTE</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adNetworks" value="2G" ${chk(nets,'2G')}><span><i class="fas fa-signal"></i> 2G</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adNetworks" value="3G" ${chk(nets,'3G')}><span><i class="fas fa-signal"></i> 3G</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adNetworks" value="5G" ${chk(nets,'5G')}><span><i class="fas fa-signal"></i> 5G</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adNetworks" value="LTE Cat-M1" ${chk(nets,'LTE Cat-M1')}><span><i class="fas fa-signal"></i> LTE Cat-M1</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adNetworks" value="BLE" ${chk(nets,'BLE')}><span><i class="fas fa-bluetooth"></i> BLE</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adNetworks" value="NFC" ${chk(nets,'NFC')}><span><i class="fas fa-credit-card"></i> NFC</span></label>
            </div>
            </div>

            <div class="form-section"><h4><i class="fas fa-signal"></i> 4G LTE Tracker Settings</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminLteImei">IMEI</label>
                    <input type="text" id="adminLteImei" value="${v(lte.imei)}" placeholder="15-digit IMEI" pattern="[0-9]{15}">
                </div>
                <div class="form-group">
                    <label for="adminLteSimIccid">SIM ICCID</label>
                    <input type="text" id="adminLteSimIccid" value="${v(lte.simIccid)}" placeholder="18-22 digit ICCID" pattern="[0-9]{18,22}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminLteCarrier">Carrier</label>
                    <input type="text" id="adminLteCarrier" value="${v(lte.carrier)}" placeholder="e.g. AT&T, Vodafone">
                </div>
                <div class="form-group">
                    <label for="adminLteApn">APN</label>
                    <input type="text" id="adminLteApn" value="${v(lte.apn)}" placeholder="e.g. internet, iot">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminLteDataFormat">Data Format</label>
                    <select id="adminLteDataFormat">
                        <option value="json" ${sel(lte.dataFormat,'json')}>JSON</option>
                        <option value="nmea" ${sel(lte.dataFormat,'nmea')}>NMEA</option>
                        <option value="binary" ${sel(lte.dataFormat,'binary')}>Binary</option>
                        <option value="codec8" ${sel(lte.dataFormat,'codec8')}>Codec 8</option>
                        <option value="codec8ext" ${sel(lte.dataFormat,'codec8ext')}>Codec 8 Extended</option>
                        <option value="auto" ${sel(lte.dataFormat,'auto')}>Auto-detect</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="adminLteFrequency">Reporting Interval (ms)</label>
                    <input type="number" id="adminLteFrequency" value="${v(lte.dataLogFrequency, 5000)}" min="1000" max="60000" step="1000">
                </div>
            </div>
            </div>

            <div class="form-section"><h4><i class="fas fa-microchip"></i> Sensors</h4>
            <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:0.75rem;">Select sensors available on this device</p>
            <div class="checkbox-grid">
                <label class="checkbox-item"><input type="checkbox" name="adSensors" value="temperature" ${chk(sensorTypes,'temperature')}><span><i class="fas fa-thermometer-half"></i> Temperature</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adSensors" value="humidity" ${chk(sensorTypes,'humidity')}><span><i class="fas fa-tint"></i> Humidity</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adSensors" value="accelerometer" ${chk(sensorTypes,'accelerometer')}><span><i class="fas fa-compress-arrows-alt"></i> Accelerometer</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adSensors" value="gyroscope" ${chk(sensorTypes,'gyroscope')}><span><i class="fas fa-sync"></i> Gyroscope</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adSensors" value="magnetometer" ${chk(sensorTypes,'magnetometer')}><span><i class="fas fa-compass"></i> Magnetometer</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adSensors" value="pressure" ${chk(sensorTypes,'pressure')}><span><i class="fas fa-weight"></i> Pressure</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adSensors" value="light" ${chk(sensorTypes,'light')}><span><i class="fas fa-lightbulb"></i> Light</span></label>
                <label class="checkbox-item"><input type="checkbox" name="adSensors" value="proximity" ${chk(sensorTypes,'proximity')}><span><i class="fas fa-hand-paper"></i> Proximity</span></label>
            </div>
            </div>

            <div class="form-section"><h4><i class="fas fa-satellite"></i> GPS / Location</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminGpsStatus">GPS Status</label>
                    <select id="adminGpsStatus">
                        <option value="Active" ${sel(device?.tracker?.gpsStatus,'Active') || (!device ? 'selected' : '')}>Active</option>
                        <option value="Inactive" ${sel(device?.tracker?.gpsStatus,'Inactive')}>Inactive</option>
                        <option value="Searching" ${sel(device?.tracker?.gpsStatus,'Searching')}>Searching</option>
                    </select>
                </div>
                <div class="form-group"></div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminDeviceLat">Latitude</label>
                    <input type="number" step="any" id="adminDeviceLat" value="${device?.latitude != null ? device.latitude : ''}" placeholder="e.g. 56.946">
                </div>
                <div class="form-group">
                    <label for="adminDeviceLng">Longitude</label>
                    <input type="number" step="any" id="adminDeviceLng" value="${device?.longitude != null ? device.longitude : ''}" placeholder="e.g. 24.105">
                </div>
            </div>
            </div>

            <div class="form-section"><h4><i class="fas fa-truck"></i> Logistics Monitoring</h4>
            <div class="form-row">
                <div class="form-group checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="adminLogisticsEnabled" ${logistics.monitoringEnabled !== false ? 'checked' : ''}>
                        <span>Enable logistics monitoring for this device</span>
                    </label>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminTempMin">Temperature Min (&deg;C)</label>
                    <input type="number" step="0.1" id="adminTempMin" value="${v(logistics.tempMin, -10)}">
                </div>
                <div class="form-group">
                    <label for="adminTempMax">Temperature Max (&deg;C)</label>
                    <input type="number" step="0.1" id="adminTempMax" value="${v(logistics.tempMax, 30)}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminHumidityMin">Humidity Min (%)</label>
                    <input type="number" step="0.1" id="adminHumidityMin" value="${v(logistics.humidityMin, 20)}">
                </div>
                <div class="form-group">
                    <label for="adminHumidityMax">Humidity Max (%)</label>
                    <input type="number" step="0.1" id="adminHumidityMax" value="${v(logistics.humidityMax, 80)}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminTiltMax">Max Tilt (deg)</label>
                    <input type="number" step="0.1" id="adminTiltMax" value="${v(logistics.tiltMax, 30)}">
                </div>
                <div class="form-group">
                    <label for="adminCollisionMaxG">Max Collision (g)</label>
                    <input type="number" step="0.1" id="adminCollisionMaxG" value="${v(logistics.collisionMaxG, 2.5)}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="adminDeliveryGrace">Delivery Grace (min)</label>
                    <input type="number" id="adminDeliveryGrace" min="0" max="1440" step="5" value="${v(logistics.deliveryGraceMinutes, 30)}">
                </div>
                <div class="form-group">
                    <label for="adminAlertCooldown">Alert Cooldown (min)</label>
                    <input type="number" id="adminAlertCooldown" min="1" max="720" step="1" value="${v(logistics.alertCooldownMinutes, 15)}">
                </div>
            </div>
            </div>

            <div class="form-actions" style="margin-top:1.25rem;">
                <button type="button" class="btn btn-outline" onclick="closeAdminDeviceModal()">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="saveAdminDevice('${isEdit ? device.id : ''}')"><i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Create'} Device</button>
            </div>
        </form>
    `;

    if (isEdit && device.ownerNamespace) {
        const nsSelect = document.getElementById('adminDeviceNamespace');
        if (nsSelect) {
            nsSelect.value = device.ownerNamespace;
            if (!nsSelect.value && device.ownerEmail) {
                const allUsers = getUsers();
                const matchUser = allUsers.find(u => u.email === device.ownerEmail);
                if (matchUser) nsSelect.value = 'user:' + matchUser.id;
            }
        }
    }

    const profileSelect = document.getElementById('adminDeviceProfile');
    if (profileSelect) {
        profileSelect.addEventListener('change', function() {
            const profileId = this.value;
            if (!profileId) return;
            const profile = TRACKER_PROFILES.find(p => p.id === profileId);
            if (!profile) return;

            const modelEl = document.getElementById('adminDeviceModel');
            const typeEl = document.getElementById('adminDeviceType');
            const dataFmtEl = document.getElementById('adminLteDataFormat');
            const apnEl = document.getElementById('adminLteApn');

            if (modelEl) modelEl.value = profile.manufacturer + ' ' + profile.model;

            if (typeEl) {
                const catMap = { 'Vehicle': 'Tracker', 'Asset': 'Tracker', 'Fleet': 'Tracker', 'Personal': 'Tracker', 'Sensor': 'Sensor', 'Gateway': 'Gateway' };
                typeEl.value = catMap[profile.category] || 'Tracker';
            }

            if (dataFmtEl) {
                const fmtMap = { 'HTTP': 'json', 'TCP': 'codec8', 'TCP/UDP': 'codec8', 'MQTT': 'json' };
                dataFmtEl.value = fmtMap[profile.protocol] || 'json';
            }

            if (apnEl && profile.apn) {
                apnEl.value = profile.apn.replace(/\s*\(.*\)/, '');
            }

            if (profile.sensors && profile.sensors.length) {
                const sensorMap = {
                    'GPS': null, 'Wi-Fi positioning': null,
                    'Accelerometer': 'accelerometer', 'Gyroscope': 'gyroscope',
                    'Temperature': 'temperature', 'Humidity': 'humidity',
                    'Magnetometer': 'magnetometer', 'Pressure': 'pressure',
                    'Light': 'light', 'Fuel': null, 'OBD-II': null
                };
                document.querySelectorAll('#adminDeviceForm input[name="adSensors"]').forEach(cb => cb.checked = false);
                profile.sensors.forEach(s => {
                    const mapped = sensorMap[s];
                    if (mapped) {
                        const cb = document.querySelector(`#adminDeviceForm input[name="adSensors"][value="${mapped}"]`);
                        if (cb) cb.checked = true;
                    }
                });
            }

            showNotification(`Profile "${profile.manufacturer} ${profile.model}" applied. You can override any field.`, 'info');
        });
    }

    const nsSelect = document.getElementById('adminDeviceNamespace');
    if (nsSelect) {
        nsSelect.addEventListener('change', function() {
            applyTenantNetworkDefaults(this.value);
        });
    }

    modal.style.display = 'flex';
}

function applyTenantNetworkDefaults(namespaceValue) {
    if (!namespaceValue || !namespaceValue.startsWith('tenant:')) return;
    const tenantId = namespaceValue.replace('tenant:', '');
    const tenant = resellerTenantsCache.find(t => t.id === tenantId);
    if (!tenant) return;

    const carrierEl = document.getElementById('adminLteCarrier');
    const apnEl = document.getElementById('adminLteApn');

    if (carrierEl && !carrierEl.value && tenant.defaultCarrier) {
        carrierEl.value = tenant.defaultCarrier;
    }
    if (apnEl && !apnEl.value && tenant.defaultApn) {
        apnEl.value = tenant.defaultApn;
    }
}

function getAvailableNamespaceOptions(selectedValue) {
    let options = '<option value="">Select owner...</option>';

    const users = getUsers();
    if (users.length > 0) {
        options += '<optgroup label="Users">';
        users.forEach(u => {
            const val = `user:${u.id}`;
            const sel = selectedValue === val ? ' selected' : '';
            const label = (u.company ? u.company + ' — ' : '') + u.email;
            options += `<option value="${val}"${sel}>${label}</option>`;
        });
        options += '</optgroup>';
    }

    const tenants = resellerTenantsCache.length ? resellerTenantsCache : [];
    if (tenants.length > 0) {
        options += '<optgroup label="Tenant Workspaces">';
        tenants.forEach(t => {
            const val = `tenant:${t.id}`;
            const sel = selectedValue === val ? ' selected' : '';
            options += `<option value="${val}"${sel}>${t.name || t.id}</option>`;
        });
        options += '</optgroup>';
    }

    if (users.length === 0 && tenants.length === 0) {
        options = '<option value="">No users or tenants available</option>';
    }

    return options;
}

function editDeviceAdmin(deviceId) {
    closeAdminDeviceModal();
    showAdminDeviceForm(deviceId);
}

async function saveAdminDevice(existingId) {
    const id = existingId || (document.getElementById('adminDeviceId')?.value || '').trim();
    const name = (document.getElementById('adminDeviceName')?.value || '').trim();
    const type = document.getElementById('adminDeviceType')?.value || 'Tracker';
    const model = (document.getElementById('adminDeviceModel')?.value || '').trim();
    const status = document.getElementById('adminDeviceStatus')?.value || 'active';
    const namespace = document.getElementById('adminDeviceNamespace')?.value || '';
    const group = (document.getElementById('adminDeviceGroup')?.value || '').trim();
    const asset = (document.getElementById('adminDeviceAsset')?.value || '').trim();
    const lat = document.getElementById('adminDeviceLat')?.value;
    const lng = document.getElementById('adminDeviceLng')?.value;

    if (!id || !name) {
        showNotification('Device ID and Name are required.', 'error');
        return;
    }
    if (!namespace) {
        showNotification('Please select an owner for the device.', 'error');
        return;
    }

    const selectedNetworks = [];
    document.querySelectorAll('#adminDeviceForm input[name="adNetworks"]:checked').forEach(cb => selectedNetworks.push(cb.value));

    const sensorDefs = {
        'temperature': { name: 'Temperature Sensor', unit: '°C', description: 'Ambient temperature monitoring' },
        'humidity': { name: 'Humidity Sensor', unit: '%', description: 'Relative humidity monitoring' },
        'accelerometer': { name: 'Accelerometer', unit: 'g', description: 'Motion and vibration detection' },
        'gyroscope': { name: 'Gyroscope', unit: '°/s', description: 'Angular velocity measurement' },
        'magnetometer': { name: 'Magnetometer', unit: 'μT', description: 'Magnetic field detection' },
        'pressure': { name: 'Pressure Sensor', unit: 'hPa', description: 'Atmospheric pressure monitoring' },
        'light': { name: 'Light Sensor', unit: 'lux', description: 'Ambient light detection' },
        'proximity': { name: 'Proximity Sensor', unit: 'cm', description: 'Object proximity detection' }
    };
    const selectedSensors = [];
    document.querySelectorAll('#adminDeviceForm input[name="adSensors"]:checked').forEach(cb => {
        const def = sensorDefs[cb.value];
        if (def) selectedSensors.push({ type: cb.value, name: def.name, unit: def.unit, description: def.description, value: null });
    });

    const gpsStatus = document.getElementById('adminGpsStatus')?.value || 'Active';
    const deviceStatus = gpsStatus.toLowerCase() === 'active' ? (status || 'active') : status;

    const lteImei = (document.getElementById('adminLteImei')?.value || '').trim();
    const lteSimIccid = (document.getElementById('adminLteSimIccid')?.value || '').trim();
    const lteCarrier = (document.getElementById('adminLteCarrier')?.value || '').trim();
    const lteApn = (document.getElementById('adminLteApn')?.value || '').trim();
    const lteDataFormat = document.getElementById('adminLteDataFormat')?.value || 'json';
    const lteFrequency = document.getElementById('adminLteFrequency')?.value || '5000';

    const logisticsEnabled = document.getElementById('adminLogisticsEnabled')?.checked !== false;
    const toNum = (id, fallback) => { const raw = document.getElementById(id)?.value; return raw !== '' && raw != null ? Number(raw) : fallback; };

    const payload = {
        id,
        name,
        type,
        model,
        status: deviceStatus,
        group: group || undefined,
        asset: asset || '',
        latitude: lat ? parseFloat(lat) : undefined,
        longitude: lng ? parseFloat(lng) : undefined,
        networks: selectedNetworks.length > 0 ? selectedNetworks : ['GPS/GNSS'],
        sensors: selectedSensors,
        tracker: {
            gpsStatus,
            satellites: null,
            accuracy: null,
            lastFix: existingId ? undefined : null
        },
        lte: {
            model,
            imei: lteImei,
            simIccid: lteSimIccid,
            carrier: lteCarrier,
            apn: lteApn,
            dataFormat: lteDataFormat,
            dataLogFrequency: lteFrequency
        },
        logistics: {
            monitoringEnabled: logisticsEnabled,
            tempMin: toNum('adminTempMin', -10),
            tempMax: toNum('adminTempMax', 30),
            humidityMin: toNum('adminHumidityMin', 20),
            humidityMax: toNum('adminHumidityMax', 80),
            tiltMax: toNum('adminTiltMax', 30),
            collisionMaxG: toNum('adminCollisionMaxG', 2.5),
            deliveryGraceMinutes: toNum('adminDeliveryGrace', 30),
            alertCooldownMinutes: toNum('adminAlertCooldown', 15)
        }
    };

    if (namespace.startsWith('user:')) {
        const userId = namespace.replace('user:', '');
        const allUsers = getUsers();
        const owner = allUsers.find(u => u.id === userId);
        if (owner) {
            payload.ownerEmail = owner.email;
            payload.ownerCompany = owner.company || '';
            if (owner.tenantId) {
                payload.tenantId = owner.tenantId;
                const tenant = resellerTenantsCache.find(t => t.id === owner.tenantId);
                if (tenant) payload.tenantName = tenant.name;
            }
        }
    } else if (namespace.startsWith('tenant:')) {
        const tId = namespace.replace('tenant:', '');
        payload.tenantId = tId;
        const tenant = resellerTenantsCache.find(t => t.id === tId);
        if (tenant) payload.tenantName = tenant.name;
    }

    try {
        const response = await fetch('/api/admin-devices', {
            method: existingId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', ...getApiAuthHeaders() },
            body: JSON.stringify({ namespace, device: payload })
        });
        const result = await response.json();
        if (!response.ok) {
            showNotification(result.error || 'Failed to save device.', 'error');
            return;
        }
        showNotification(`Device ${existingId ? 'updated' : 'created'} successfully.`, 'success');
        closeAdminDeviceModal();
        await loadAllDevices();
        updateAdminGlobalMap();
    } catch (error) {
        console.error('Save device error:', error);
        showNotification('Failed to save device.', 'error');
    }
}

async function deleteDeviceAdmin(deviceId) {
    const device = getAllDevices().find(d => d.id === deviceId);
    if (!device) {
        showNotification('Device not found.', 'error');
        return;
    }
    if (!confirm(`Delete device "${device.name || deviceId}"? This action cannot be undone.`)) {
        return;
    }

    const namespace = device.ownerNamespace;
    if (!namespace) {
        showNotification('Cannot determine device namespace.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin-devices', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...getApiAuthHeaders() },
            body: JSON.stringify({ namespace, deviceId })
        });
        const result = await response.json();
        if (!response.ok) {
            showNotification(result.error || 'Failed to delete device.', 'error');
            return;
        }
        showNotification('Device deleted successfully.', 'success');
        closeAdminDeviceModal();
        await loadAllDevices();
        updateAdminGlobalMap();
    } catch (error) {
        console.error('Delete device error:', error);
        showNotification('Failed to delete device.', 'error');
    }
}

let resellerTenantsCache = [];
let resellerUsersCache = [];

function initResellerManagement() {
    const form = document.getElementById('createTenantForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createTenantWorkspace();
        });
    }
    const userForm = document.getElementById('createTenantUserForm');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createTenantUser();
        });
    }
}

async function fetchTenants() {
    const response = await fetch('/api/tenants', {
        headers: getApiAuthHeaders(),
        cache: 'no-store'
    });
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    resellerTenantsCache = Array.isArray(data.tenants) ? data.tenants : [];
    return resellerTenantsCache;
}

async function fetchUsers() {
    const response = await fetch('/api/users', {
        headers: getApiAuthHeaders(),
        cache: 'no-store'
    });
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    resellerUsersCache = Array.isArray(data.users) ? data.users : [];
    return resellerUsersCache;
}

async function loadResellerData() {
    const admin = typeof getCurrentAdmin === 'function' ? getCurrentAdmin() : null;
    if (!admin) return;
    if (admin.role !== 'reseller' && admin.role !== 'super_admin') {
        return;
    }
    await fetchTenants();
    await fetchUsers();
    await cleanOrphanedTenants();
    renderResellerTenants();
    renderResellerUsers();
    populateTenantSelect();
}

async function cleanOrphanedTenants() {
    if (!resellerTenantsCache.length) return;
    const allUsers = [...resellerUsersCache, ...getUsers()];
    const usedTenantIds = new Set(allUsers.map(u => u.tenantId).filter(Boolean));

    const orphans = resellerTenantsCache.filter(t => !usedTenantIds.has(t.id));
    if (!orphans.length) return;

    for (const tenant of orphans) {
        try {
            const resp = await fetch(`/api/tenants?tenantId=${encodeURIComponent(tenant.id)}`, {
                method: 'DELETE',
                headers: getApiAuthHeaders()
            });
            if (resp.ok) {
                console.log(`Cleaned orphaned tenant: ${tenant.name} (${tenant.id})`);
            }
        } catch (e) {
            console.warn('Failed to clean orphaned tenant:', tenant.id, e);
        }
    }
    await fetchTenants();
}

function renderResellerTenants() {
    const table = document.getElementById('resellerTenantsTable');
    if (!table) return;
    if (!resellerTenantsCache.length) {
        table.innerHTML = '<tr><td colspan="6">No workspaces found.</td></tr>';
        return;
    }
    table.innerHTML = resellerTenantsCache.map((tenant) => {
        const netParts = [tenant.defaultCarrier, tenant.defaultApn].filter(Boolean);
        const netLabel = netParts.length ? netParts.join(' / ') : '<span style="color:var(--text-light);">Not set</span>';
        return `<tr>
            <td>${tenant.name}</td>
            <td>${tenant.planTier || 'individual'}</td>
            <td style="font-size:0.9rem;">${netLabel}</td>
            <td>${tenant.resellerId || 'Direct'}</td>
            <td>${tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '-'}</td>
            <td>
                <button class="btn btn-outline btn-small" onclick="editTenant('${tenant.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-outline btn-small" onclick="deleteTenant('${tenant.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function editTenant(tenantId) {
    const tenant = resellerTenantsCache.find(t => t.id === tenantId);
    if (!tenant) return;

    document.getElementById('tenantEditId').value = tenant.id;
    document.getElementById('tenantEditName').value = tenant.name || '';
    document.getElementById('tenantEditPlan').value = tenant.planTier || 'individual';
    document.getElementById('tenantEditCarrier').value = tenant.defaultCarrier || '';
    document.getElementById('tenantEditApn').value = tenant.defaultApn || '';
    document.getElementById('tenantEditSimProvider').value = tenant.simProvider || '';
    document.getElementById('tenantEditNetworkNotes').value = tenant.networkNotes || '';

    document.getElementById('tenantEditModalTitle').textContent = `Edit Tenant — ${tenant.name}`;
    document.getElementById('tenantEditModal').style.display = 'flex';
}

function closeTenantEditModal() {
    document.getElementById('tenantEditModal').style.display = 'none';
}

async function saveTenantEdit() {
    const tenantId = document.getElementById('tenantEditId').value;
    const name = document.getElementById('tenantEditName').value.trim();
    if (!name) { showNotification('Tenant name is required.', 'error'); return; }

    const payload = {
        id: tenantId,
        name,
        planTier: document.getElementById('tenantEditPlan').value,
        defaultCarrier: document.getElementById('tenantEditCarrier').value.trim(),
        defaultApn: document.getElementById('tenantEditApn').value.trim(),
        simProvider: document.getElementById('tenantEditSimProvider').value.trim(),
        networkNotes: document.getElementById('tenantEditNetworkNotes').value.trim()
    };

    try {
        const response = await fetch('/api/tenants', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getApiAuthHeaders() },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const r = await response.json();
            showNotification(r.error || 'Failed to update tenant.', 'error');
            return;
        }
        showNotification('Tenant updated.', 'success');
        closeTenantEditModal();
        await loadResellerData();
    } catch (error) {
        showNotification('Failed to update tenant.', 'error');
    }
}

async function deleteTenant(tenantId) {
    const tenant = resellerTenantsCache.find(t => t.id === tenantId);
    if (!tenant) return;
    if (!confirm(`Delete tenant "${tenant.name}"? This cannot be undone.`)) return;
    try {
        const response = await fetch(`/api/tenants?tenantId=${encodeURIComponent(tenantId)}`, {
            method: 'DELETE',
            headers: getApiAuthHeaders()
        });
        if (!response.ok) {
            const r = await response.json();
            showNotification(r.error || 'Failed to delete tenant.', 'error');
            return;
        }
        showNotification('Tenant deleted.', 'success');
        await loadResellerData();
    } catch (error) {
        showNotification('Failed to delete tenant.', 'error');
    }
}

function renderResellerUsers() {
    const table = document.getElementById('resellerUsersTable');
    if (!table) return;
    if (!resellerUsersCache.length) {
        table.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
        return;
    }
    const tenantMap = new Map(resellerTenantsCache.map((tenant) => [tenant.id, tenant]));
    table.innerHTML = resellerUsersCache.map((user) => `
        <tr>
            <td>${user.email}</td>
            <td>${tenantMap.get(user.tenantId)?.name || user.tenantId || '-'}</td>
            <td>${user.planTier || user.package || 'individual'}</td>
            <td>${user.isActive === false ? 'Inactive' : 'Active'}</td>
            <td>
                <button class="btn btn-outline btn-small" onclick="deleteTenantUser('${user.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function deleteTenantUser(userId) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
        const response = await fetch(`/api/users?userId=${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: getApiAuthHeaders()
        });
        if (!response.ok) {
            const r = await response.json();
            showNotification(r.error || 'Failed to delete user.', 'error');
            return;
        }
        showNotification('User deleted.', 'success');
        await loadResellerData();
    } catch (error) {
        showNotification('Failed to delete user.', 'error');
    }
}

function populateTenantSelect() {
    const select = document.getElementById('tenantUserWorkspace');
    if (!select) return;
    select.innerHTML = resellerTenantsCache.map((tenant) => `
        <option value="${tenant.id}">${tenant.name} (${tenant.planTier || 'individual'})</option>
    `).join('');
}

async function createTenantWorkspace() {
    const name = document.getElementById('tenantName').value.trim();
    const planTier = document.getElementById('tenantPlanTier').value;
    if (!name) {
        alert('Workspace name is required.');
        return;
    }
    const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getApiAuthHeaders()
        },
        body: JSON.stringify({ name, planTier })
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        alert(text || 'Failed to create workspace.');
        return;
    }
    document.getElementById('createTenantForm').reset();
    await loadResellerData();
}

async function createTenantUser() {
    const tenantId = document.getElementById('tenantUserWorkspace').value;
    const email = document.getElementById('tenantUserEmail').value.trim();
    const password = document.getElementById('tenantUserPassword').value.trim();
    if (!tenantId || !email || !password) {
        alert('Please complete all fields.');
        return;
    }
    const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getApiAuthHeaders()
        },
        body: JSON.stringify({ tenantId, email, password, planTier: 'individual' })
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        alert(text || 'Failed to create user.');
        return;
    }
    document.getElementById('createTenantUserForm').reset();
    await loadResellerData();
}

// Security & Privacy
function initSecurityPrivacy() {
    document.getElementById('securitySettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveSecuritySettings();
    });
    
    document.getElementById('privacySettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        savePrivacySettings();
    });
    
    loadSecuritySettings();
    loadPrivacySettings();
}

function loadSecuritySettings() {
    const settings = JSON.parse(localStorage.getItem('security_settings')) || {};
    document.getElementById('passwordPolicy').value = settings.passwordPolicy || 'standard';
    document.getElementById('require2FA').checked = settings.require2FA !== false;
    document.getElementById('sessionTimeout').checked = settings.sessionTimeout || false;
    document.getElementById('ipWhitelist').checked = settings.ipWhitelist || false;
    document.getElementById('encryptionLevel').value = settings.encryptionLevel || 'high';
}

function saveSecuritySettings() {
    const settings = {
        passwordPolicy: document.getElementById('passwordPolicy').value,
        require2FA: document.getElementById('require2FA').checked,
        sessionTimeout: document.getElementById('sessionTimeout').checked,
        ipWhitelist: document.getElementById('ipWhitelist').checked,
        encryptionLevel: document.getElementById('encryptionLevel').value
    };
    
    localStorage.setItem('security_settings', JSON.stringify(settings));
    logSecurityEvent('security_settings_update', getCurrentAdmin().email, 'success');
    alert('Security settings saved!');
}

function loadPrivacySettings() {
    const settings = JSON.parse(localStorage.getItem('privacy_settings')) || {};
    document.getElementById('gdprCompliance').checked = settings.gdprCompliance !== false;
    document.getElementById('dataEncryption').checked = settings.dataEncryption !== false;
    document.getElementById('dataRetention').checked = settings.dataRetention || false;
    document.getElementById('dataRetentionPeriod').value = settings.dataRetentionPeriod || '90';
    document.getElementById('userDataExport').checked = settings.userDataExport !== false;
    document.getElementById('userDataDeletion').checked = settings.userDataDeletion !== false;
}

function savePrivacySettings() {
    const settings = {
        gdprCompliance: document.getElementById('gdprCompliance').checked,
        dataEncryption: document.getElementById('dataEncryption').checked,
        dataRetention: document.getElementById('dataRetention').checked,
        dataRetentionPeriod: document.getElementById('dataRetentionPeriod').value,
        userDataExport: document.getElementById('userDataExport').checked,
        userDataDeletion: document.getElementById('userDataDeletion').checked
    };
    
    localStorage.setItem('privacy_settings', JSON.stringify(settings));
    logSecurityEvent('privacy_settings_update', getCurrentAdmin().email, 'success');
    alert('Privacy settings saved!');
}

function loadPrivacyRequests() {
    const requestsKey = 'cargotrack_privacy_requests';
    let requests = [];
    try { requests = JSON.parse(localStorage.getItem(requestsKey)) || []; } catch (_) {}

    const tableBody = document.getElementById('privacyRequestsTable');
    if (!tableBody) return;

    if (requests.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-light);">No privacy requests</td></tr>';
        return;
    }

    tableBody.innerHTML = requests.map(req => `
        <tr>
            <td>${req.id}</td>
            <td>${req.userEmail}</td>
            <td>${(req.type || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
            <td><span class="status-badge ${req.status === 'completed' ? 'active' : (req.status === 'pending' ? 'warning' : 'info')}">${req.status}</span></td>
            <td>${formatDate(req.requested)}</td>
            <td>
                <button class="btn-icon-small view" onclick="processPrivacyRequest('${req.id}')" title="Process">
                    <i class="fas fa-check"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function processPrivacyRequest(requestId) {
    const requestsKey = 'cargotrack_privacy_requests';
    const requests = JSON.parse(localStorage.getItem(requestsKey)) || [];
    const request = requests.find(r => r.id === requestId);
    
    if (request && request.status === 'pending') {
        if (confirm(`Process ${request.type} request for ${request.userEmail}?`)) {
            request.status = 'processing';
            request.processedAt = new Date().toISOString();
            localStorage.setItem(requestsKey, JSON.stringify(requests));
            logSecurityEvent('privacy_request_processed', request.userEmail, 'success', { type: request.type });
            loadPrivacyRequests();
            alert('Privacy request is being processed!');
        }
    }
}

function loadSecurityAuditLog() {
    const auditLog = getSecurityAuditLog(50);
    const tableBody = document.getElementById('securityAuditLog');
    if (!tableBody) return;
    
    tableBody.innerHTML = auditLog.map(entry => `
        <tr class="audit-log-item ${entry.status}">
            <td>${formatTime(entry.timestamp)}</td>
            <td>${entry.event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
            <td>${entry.user}</td>
            <td>${entry.ipAddress}</td>
            <td><span class="status-badge ${entry.status === 'success' ? 'active' : (entry.status === 'failed' ? 'error' : 'warning')}">${entry.status}</span></td>
        </tr>
    `).join('');
}

// Admin Settings
function initAdminSettings() {
    document.getElementById('appSettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveAppSettings();
    });
    
    document.getElementById('adminAccountForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateAdminAccount();
    });
    
    // LTE Settings
    const lteForm = document.getElementById('lteSettingsForm');
    if (lteForm) {
        lteForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveLteSettings();
        });
        loadLteSettings();
    }
    
    // Test LTE Connection button
    const testLteBtn = document.getElementById('testLteConnection');
    if (testLteBtn) {
        testLteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            testLteConnection();
        });
    }

    // LoRaWAN Settings
    const lorawanForm = document.getElementById('lorawanSettingsForm');
    if (lorawanForm) {
        lorawanForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveLorawanSettings();
        });
        loadLorawanSettings();
    }

    const testLorawanBtn = document.getElementById('testLorawanConnection');
    if (testLorawanBtn) {
        testLorawanBtn.addEventListener('click', function(e) {
            e.preventDefault();
            testLorawanConnection();
        });
    }

    // Load server-side maintenance mode status into the dropdown
    fetch('/api/maintenance').then(r => r.json()).then(data => {
        const el = document.getElementById('maintenanceMode');
        if (el) el.value = data.enabled ? 'on' : 'off';
    }).catch(() => {});
}

async function saveAppSettings() {
    const settings = {
        appName: document.getElementById('appName').value,
        supportEmail: document.getElementById('supportEmail').value,
        supportPhone: document.getElementById('supportPhone').value,
        maintenanceMode: document.getElementById('maintenanceMode').value
    };

    localStorage.setItem('app_settings', JSON.stringify(settings));

    // Sync maintenance mode to server so all visitors see it
    try {
        const token = localStorage.getItem('adminToken');
        await fetch('/api/maintenance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (token || '')
            },
            body: JSON.stringify({
                enabled: settings.maintenanceMode === 'on'
            })
        });
    } catch (e) {
        console.warn('Failed to sync maintenance mode to server:', e);
    }

    alert('Application settings saved!');
}

async function updateAdminAccount() {
    const currentAdmin = getCurrentAdmin();
    if (!currentAdmin) {
        showNotification('Admin session not found.', 'error');
        return;
    }
    const newPassword = document.getElementById('adminNewPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    
    if (newPassword) {
        if (newPassword.length < 8) {
            showNotification('Password must be at least 8 characters.', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showNotification('Passwords do not match!', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/admin-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getApiAuthHeaders() },
                body: JSON.stringify({ newPassword })
            });
            const result = await response.json();
            if (!response.ok) {
                showNotification(result.error || 'Password update failed.', 'error');
                return;
            }
            showNotification('Password updated successfully!', 'success');
            document.getElementById('adminNewPassword').value = '';
            document.getElementById('adminConfirmPassword').value = '';
        } catch (error) {
            console.error('Password update error:', error);
            showNotification('Failed to update password.', 'error');
        }
    }
}

function loadLteSettings() {
    const settings = JSON.parse(localStorage.getItem('lte_system_settings') || '{}');
    const defaultCarrierEl = document.getElementById('lteDefaultCarrier');
    const defaultApnEl = document.getElementById('lteDefaultApn');
    const ingestEndpointEl = document.getElementById('lteIngestEndpoint');
    const providerApiKeyEl = document.getElementById('lteProviderApiKey');
    const allowUserApiKeysEl = document.getElementById('allowUserApiKeys');
    
    if (defaultCarrierEl && settings.defaultCarrier) {
        defaultCarrierEl.value = settings.defaultCarrier;
    }
    if (defaultApnEl && settings.defaultApn) {
        defaultApnEl.value = settings.defaultApn;
    }
    if (ingestEndpointEl && settings.ingestEndpoint) {
        ingestEndpointEl.value = settings.ingestEndpoint;
    }
    if (providerApiKeyEl && settings.providerApiKey) {
        providerApiKeyEl.value = settings.providerApiKey;
    }
    if (allowUserApiKeysEl && settings.allowUserApiKeys !== undefined) {
        allowUserApiKeysEl.checked = settings.allowUserApiKeys;
    }
}

function validateLteSettings(settings) {
    if (settings.ingestEndpoint && !/^https?:\/\//i.test(settings.ingestEndpoint)) {
        return { valid: false, message: 'Data ingest endpoint must be a valid URL (http or https).' };
    }
    return { valid: true, message: 'LTE settings look good. Defaults will be applied to new trackers.' };
}

// Show validation status
function showValidationStatus(statusEl, isValid, message) {
    statusEl.style.display = 'block';
    statusEl.style.background = isValid ? '#e8f5e9' : '#ffebee';
    statusEl.style.borderLeft = `4px solid ${isValid ? '#4caf50' : '#f44336'}`;
    statusEl.style.color = isValid ? '#2e7d32' : '#c62828';
    statusEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas ${isValid ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <div>
                <strong>${isValid ? 'Connection Successful' : 'Connection Failed'}</strong>
                <div style="margin-top: 0.25rem; font-size: 0.875rem; white-space: pre-line;">${message}</div>
            </div>
        </div>
    `;
}

// Test LTE Connection
async function testLteConnection() {
    const statusEl = document.getElementById('lteValidationStatus');
    const testBtn = document.getElementById('testLteConnection');

    if (!statusEl || !testBtn) {
        alert('Required form elements not found');
        return;
    }

    const settings = {
        defaultCarrier: document.getElementById('lteDefaultCarrier')?.value.trim() || '',
        defaultApn: document.getElementById('lteDefaultApn')?.value.trim() || '',
        ingestEndpoint: document.getElementById('lteIngestEndpoint')?.value.trim() || '',
        providerApiKey: document.getElementById('lteProviderApiKey')?.value.trim() || ''
    };

    // Disable button and show loading
    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    statusEl.style.display = 'block';
    statusEl.style.background = '#fff3e0';
    statusEl.style.borderLeft = '4px solid #ff9800';
    statusEl.style.color = '#e65100';
    statusEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-spinner fa-spin"></i>
            <div>
                <strong>Testing Connection...</strong>
                <div style="margin-top: 0.25rem; font-size: 0.875rem;">Validating LTE defaults...</div>
            </div>
        </div>
    `;

    try {
        const result = validateLteSettings(settings);
        showValidationStatus(statusEl, result.valid, result.message);
    } catch (error) {
        showValidationStatus(statusEl, false, `Validation error: ${error.message}`);
    } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';
    }
}

function saveLteSettings() {
    const settings = {
        defaultCarrier: document.getElementById('lteDefaultCarrier')?.value.trim() || '',
        defaultApn: document.getElementById('lteDefaultApn')?.value.trim() || '',
        ingestEndpoint: document.getElementById('lteIngestEndpoint')?.value.trim() || '',
        providerApiKey: document.getElementById('lteProviderApiKey')?.value.trim() || '',
        allowUserApiKeys: document.getElementById('allowUserApiKeys')?.checked ?? true
    };
    
    const statusEl = document.getElementById('lteValidationStatus');
    if (statusEl && statusEl.style.display === 'block') {
        const isValid = statusEl.style.background.includes('e8f5e9') || statusEl.style.background.includes('rgb(232, 245, 233)');
        if (!isValid) {
            if (!confirm('The LTE validation failed. Do you want to save these settings anyway?')) {
                return;
            }
        }
    }
    
    localStorage.setItem('lte_system_settings', JSON.stringify(settings));
    alert('LTE settings saved successfully!');
}

// LoRaWAN Settings
function loadLorawanSettings() {
    const settings = JSON.parse(localStorage.getItem('lorawan_settings') || '{}');
    const fields = {
        lorawanProvider: 'provider',
        lorawanServerUrl: 'serverUrl',
        lorawanApiKey: 'apiKey',
        lorawanAppEui: 'appEui',
        lorawanJoinEui: 'joinEui',
        lorawanDeviceProfile: 'deviceProfile',
        lorawanFreqPlan: 'freqPlan'
    };
    Object.entries(fields).forEach(([elId, key]) => {
        const el = document.getElementById(elId);
        if (el && settings[key]) el.value = settings[key];
    });

    // Auto-fill webhook URL
    const webhookEl = document.getElementById('lorawanWebhookUrl');
    if (webhookEl) webhookEl.value = window.location.origin + '/api/ingest';

    const tokenEl = document.getElementById('lorawanWebhookToken');
    if (tokenEl) tokenEl.value = 'Use your LTE_INGEST_TOKEN env variable';
}

function saveLorawanSettings() {
    const settings = {
        provider: document.getElementById('lorawanProvider')?.value || '',
        serverUrl: document.getElementById('lorawanServerUrl')?.value.trim() || '',
        apiKey: document.getElementById('lorawanApiKey')?.value.trim() || '',
        appEui: document.getElementById('lorawanAppEui')?.value.trim() || '',
        joinEui: document.getElementById('lorawanJoinEui')?.value.trim() || '',
        deviceProfile: document.getElementById('lorawanDeviceProfile')?.value || 'classA',
        freqPlan: document.getElementById('lorawanFreqPlan')?.value || 'EU868'
    };
    localStorage.setItem('lorawan_settings', JSON.stringify(settings));
    alert('LoRaWAN settings saved successfully!');
}

function testLorawanConnection() {
    const statusEl = document.getElementById('lorawanValidationStatus');
    const testBtn = document.getElementById('testLorawanConnection');
    if (!statusEl || !testBtn) return;

    const provider = document.getElementById('lorawanProvider')?.value;
    const serverUrl = document.getElementById('lorawanServerUrl')?.value.trim();

    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    statusEl.style.display = 'block';
    statusEl.style.background = '#fff3e0';
    statusEl.style.borderLeft = '4px solid #ff9800';
    statusEl.style.color = '#e65100';
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating LoRaWAN configuration...';

    setTimeout(() => {
        let isValid = true;
        let message = '';
        if (!provider) {
            isValid = false;
            message = 'Please select a network server provider.';
        } else if (!serverUrl) {
            isValid = false;
            message = 'Please enter the network server URL.';
        } else if (!/^https?:\/\//i.test(serverUrl)) {
            isValid = false;
            message = 'Server URL must start with http:// or https://';
        } else {
            message = 'Configuration looks valid. Webhook endpoint is set to ' + window.location.origin + '/api/ingest';
        }
        showValidationStatus(statusEl, isValid, message);
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';
    }, 800);
}

// Search functionality
function handleAdminSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    // Implement global search across users, devices, etc.
    // For now, just filter users table
    if (document.getElementById('admin-users').classList.contains('active')) {
        document.getElementById('userSearchInput').value = searchTerm;
        filterUsers();
    }
}

// Utility functions
function saveUsers(users) {
    localStorage.setItem('cargotrack_users', JSON.stringify(users));
}

function getUsers() {
    initUsersStorage();
    return JSON.parse(localStorage.getItem('cargotrack_users')) || [];
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString();
}

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

// ============================================================
// Tracker Library -- pre-built configuration profiles
// ============================================================

const TRACKER_PROFILES = [
    {
        id: 'dm-oyster3',
        manufacturer: 'Digital Matter',
        model: 'Oyster3',
        protocol: 'HTTP',
        compatibility: 'plug-and-play',
        icon: 'fa-satellite-dish',
        category: 'Asset',
        connectivity: 'LTE-M / NB-IoT',
        batteryLife: '~5 years',
        sensors: ['GPS', 'Accelerometer'],
        bestFor: 'Pallets, containers, non-powered assets',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'HTTP POST',
            contentType: 'application/json',
            authHeader: 'Bearer <LTE_INGEST_TOKEN>'
        },
        payloadExample: JSON.stringify({
            deviceId: "OY3-861234567890",
            latitude: 51.5074,
            longitude: -0.1278,
            timestamp: 1706792400,
            battery: 98,
            speed: 0,
            heading: 180,
            satellites: 12
        }, null, 2),
        fieldMapping: [
            ['deviceId', 'deviceId / serial'],
            ['latitude / longitude', 'latitude / longitude'],
            ['timestamp', 'timestamp (Unix)'],
            ['battery', 'battery (%)'],
            ['speed', 'speed (km/h)'],
            ['heading', 'heading (degrees)']
        ],
        setupSteps: [
            'Log in to the Digital Matter OEM Server or your device management portal.',
            'Navigate to System Parameters > Server settings.',
            'Set the server URL to your Aurion ingest endpoint.',
            'Set Upload Code to JSON and enable HTTP POST mode.',
            'Under Headers, add Authorization: Bearer <your_LTE_INGEST_TOKEN>.',
            'Set the tracking interval (e.g. 15 minutes for asset tracking).',
            'Configure APN settings to match your SIM carrier.',
            'Save and reboot the device. Data should appear within one reporting cycle.'
        ],
        notes: 'IP67 rated. Ideal for long-life unattended asset tracking. Configure movement detection to extend battery life.'
    },
    {
        id: 'dm-yabby-edge',
        manufacturer: 'Digital Matter',
        model: 'Yabby Edge',
        protocol: 'HTTP',
        compatibility: 'plug-and-play',
        icon: 'fa-satellite-dish',
        category: 'Asset',
        connectivity: 'LTE-M / NB-IoT',
        batteryLife: '~5 years',
        sensors: ['GPS', 'Wi-Fi positioning', 'Accelerometer'],
        bestFor: 'Small packages, returnable crates, tools',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'HTTP POST',
            contentType: 'application/json',
            authHeader: 'Bearer <LTE_INGEST_TOKEN>'
        },
        payloadExample: JSON.stringify({
            deviceId: "YBE-861234567891",
            latitude: 48.8566,
            longitude: 2.3522,
            timestamp: 1706792400,
            battery: 95
        }, null, 2),
        fieldMapping: [
            ['deviceId', 'deviceId / serial'],
            ['latitude / longitude', 'latitude / longitude'],
            ['timestamp', 'timestamp (Unix)'],
            ['battery', 'battery (%)']
        ],
        setupSteps: [
            'Access Yabby Edge settings via the Digital Matter OEM portal.',
            'Set server URL to your Aurion /api/ingest endpoint.',
            'Enable JSON payload format under Upload settings.',
            'Add Authorization header: Bearer <your_LTE_INGEST_TOKEN>.',
            'Set tracking interval and movement thresholds.',
            'Configure APN for your carrier.',
            'Save settings. Device will report on next scheduled upload.'
        ],
        notes: 'Ultra-compact form factor. Combines GPS with Wi-Fi positioning for indoor/outdoor use.'
    },
    {
        id: 'dm-sensornode',
        manufacturer: 'Digital Matter',
        model: 'SensorNode',
        protocol: 'HTTP',
        compatibility: 'plug-and-play',
        icon: 'fa-temperature-half',
        category: 'Sensor',
        connectivity: 'LTE-M / NB-IoT',
        batteryLife: '~3 years',
        sensors: ['GPS', 'Temperature', 'Humidity', 'Accelerometer'],
        bestFor: 'Cold chain, pharma, food logistics',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'HTTP POST',
            contentType: 'application/json',
            authHeader: 'Bearer <LTE_INGEST_TOKEN>'
        },
        payloadExample: JSON.stringify({
            deviceId: "SN-861234567892",
            latitude: 52.5200,
            longitude: 13.4050,
            timestamp: 1706792400,
            temperature: 4.5,
            humidity: 62,
            battery: 88
        }, null, 2),
        fieldMapping: [
            ['deviceId', 'deviceId / serial'],
            ['latitude / longitude', 'latitude / longitude'],
            ['timestamp', 'timestamp (Unix)'],
            ['temperature', 'temperature (C)'],
            ['humidity', 'humidity (%)'],
            ['battery', 'battery (%)']
        ],
        setupSteps: [
            'Access SensorNode via Digital Matter OEM Server.',
            'Set server URL to your /api/ingest endpoint.',
            'Enable JSON POST mode.',
            'Add Authorization: Bearer <your_LTE_INGEST_TOKEN>.',
            'Enable temperature and humidity sensor reporting.',
            'Set sensor sampling interval (e.g. every 5 minutes).',
            'Configure temperature thresholds if alerting is needed on the tracker side.',
            'Set APN for your carrier and save.'
        ],
        notes: 'Purpose-built for environmental monitoring. Supports external probe sensors for precise cold-chain compliance.'
    },
    {
        id: 'queclink-gl320mg',
        manufacturer: 'Queclink',
        model: 'GL320MG',
        protocol: 'HTTP',
        compatibility: 'plug-and-play',
        icon: 'fa-location-dot',
        category: 'Asset',
        connectivity: 'LTE-M / 2G fallback',
        batteryLife: '~4 years',
        sensors: ['GPS', 'Accelerometer', 'Temperature (optional)'],
        bestFor: 'Trailers, containers, heavy equipment',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'HTTP POST',
            contentType: 'application/json',
            authHeader: 'Bearer <LTE_INGEST_TOKEN>'
        },
        payloadExample: JSON.stringify({
            deviceId: "GL320-353234567890123",
            imei: "353234567890123",
            latitude: 40.7128,
            longitude: -74.0060,
            timestamp: "2026-02-01T14:30:00Z",
            battery: 75,
            speed: 0,
            temperature: 22.3
        }, null, 2),
        fieldMapping: [
            ['deviceId / imei', 'deviceId or IMEI'],
            ['latitude / longitude', 'latitude / longitude'],
            ['timestamp', 'timestamp (ISO 8601)'],
            ['battery', 'batteryLevel (%)'],
            ['speed', 'speed (km/h)'],
            ['temperature', 'temperature (C, optional)']
        ],
        setupSteps: [
            'Connect to the GL320MG via Queclink Tool or AT commands over USB.',
            'Set the backend protocol to HTTP using the AT+GTBSI command.',
            'Set the server URL: AT+GTSRI=... with your /api/ingest endpoint.',
            'Configure the authorization header with your ingest token.',
            'Set reporting interval with AT+GTFRI (e.g. 900 for 15 min).',
            'Configure APN: AT+GTQSS=... with your carrier APN.',
            'Save and restart the device.'
        ],
        notes: 'IP67 waterproof. Supports optional temperature sensor via Bluetooth. 2G fallback for areas without LTE-M coverage.'
    },
    {
        id: 'queclink-gv300',
        manufacturer: 'Queclink',
        model: 'GV300',
        protocol: 'HTTP',
        compatibility: 'plug-and-play',
        icon: 'fa-truck',
        category: 'Vehicle',
        connectivity: '2G/3G/4G',
        batteryLife: 'Vehicle powered',
        sensors: ['GPS', 'Accelerometer', 'OBD-II (optional)'],
        bestFor: 'Fleet vehicles, trucks, vans',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'HTTP POST',
            contentType: 'application/json',
            authHeader: 'Bearer <LTE_INGEST_TOKEN>'
        },
        payloadExample: JSON.stringify({
            deviceId: "GV300-862345678901234",
            imei: "862345678901234",
            latitude: 34.0522,
            longitude: -118.2437,
            timestamp: "2026-02-01T10:15:00Z",
            speed: 65,
            heading: 270,
            battery: 100,
            satellites: 14
        }, null, 2),
        fieldMapping: [
            ['deviceId / imei', 'deviceId or IMEI'],
            ['latitude / longitude', 'latitude / longitude'],
            ['timestamp', 'timestamp (ISO 8601)'],
            ['speed', 'speed (km/h)'],
            ['heading', 'heading (degrees)'],
            ['battery', 'battery (%)'],
            ['satellites', 'satellites']
        ],
        setupSteps: [
            'Wire the GV300 to the vehicle power supply (9-36V DC).',
            'Connect via Queclink Tool over USB.',
            'Set protocol to HTTP POST and enter your /api/ingest URL.',
            'Add Authorization: Bearer <your_LTE_INGEST_TOKEN>.',
            'Configure tracking: AT+GTFRI for fixed interval reporting.',
            'Set ignition detection if needed (AT+GTIGN/AT+GTIGF).',
            'Configure APN for your SIM carrier.',
            'Save and verify data flow to your dashboard.'
        ],
        notes: 'Hardwired vehicle tracker. Supports harsh acceleration, braking, and cornering events. Can connect to OBD-II for fuel/engine data.'
    },
    {
        id: 'teltonika-fmb120',
        manufacturer: 'Teltonika',
        model: 'FMB120',
        protocol: 'TCP',
        compatibility: 'gateway-required',
        icon: 'fa-car',
        category: 'Vehicle',
        connectivity: '2G (GSM)',
        batteryLife: 'Vehicle powered + backup battery',
        sensors: ['GPS', 'GLONASS', 'Accelerometer', 'Digital I/O'],
        bestFor: 'Budget fleet tracking, light vehicles',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'TCP (Codec 8 Extended)',
            port: '(gateway-defined)',
            authHeader: 'N/A -- device uses IMEI as identifier'
        },
        payloadExample: '// Teltonika Codec 8E binary protocol\n// Gateway converts to JSON:\n' + JSON.stringify({
            imei: "352094080745317",
            latitude: 54.6872,
            longitude: 25.2797,
            timestamp: 1706792400,
            speed: 55,
            heading: 130,
            satellites: 10,
            battery: 100
        }, null, 2),
        fieldMapping: [
            ['imei', 'IMEI (auto-identified)'],
            ['latitude / longitude', 'GPS coordinates'],
            ['timestamp', 'timestamp (Unix ms)'],
            ['speed', 'speed (km/h)'],
            ['heading', 'angle (degrees)'],
            ['satellites', 'satellite count'],
            ['battery', 'external voltage mapped']
        ],
        setupSteps: [
            'Connect FMB120 to a vehicle (OBD or hardwire 10-30V DC).',
            'Access the device via Teltonika Configurator over USB or Bluetooth.',
            'Navigate to GPRS settings and set the APN for your SIM carrier.',
            'Under Server Settings, set Domain/IP and Port to your TCP gateway server.',
            'Set protocol to Codec 8 Extended (TCP).',
            'Configure Data Acquisition to set which I/O elements to send.',
            'Set tracking interval (e.g. on-moving: 30s, on-stop: 5 min).',
            'Save and verify that data reaches the gateway and is forwarded to /api/ingest.'
        ],
        notes: 'Requires a TCP-to-HTTP gateway (e.g. Traccar, flespi, or custom) to convert Codec 8E binary data to JSON POST for the Aurion ingest API. Very cost-effective for large fleet rollouts.'
    },
    {
        id: 'teltonika-fmb920',
        manufacturer: 'Teltonika',
        model: 'FMB920',
        protocol: 'TCP',
        compatibility: 'gateway-required',
        icon: 'fa-car',
        category: 'Vehicle',
        connectivity: '2G (GSM)',
        batteryLife: 'Vehicle powered + 170 mAh backup',
        sensors: ['GPS', 'GLONASS', 'Accelerometer', 'Bluetooth'],
        bestFor: 'Compact fleet tracking, ride-sharing',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'TCP (Codec 8 Extended)',
            port: '(gateway-defined)',
            authHeader: 'N/A -- device uses IMEI as identifier'
        },
        payloadExample: '// Teltonika Codec 8E binary protocol\n// Gateway converts to JSON:\n' + JSON.stringify({
            imei: "352094081234567",
            latitude: 52.2297,
            longitude: 21.0122,
            timestamp: 1706792400,
            speed: 42,
            heading: 88,
            satellites: 8,
            battery: 100
        }, null, 2),
        fieldMapping: [
            ['imei', 'IMEI (auto-identified)'],
            ['latitude / longitude', 'GPS coordinates'],
            ['timestamp', 'timestamp (Unix ms)'],
            ['speed', 'speed (km/h)'],
            ['heading', 'angle (degrees)'],
            ['satellites', 'satellite count']
        ],
        setupSteps: [
            'Install FMB920 in the vehicle (OBD-II plug or hardwire).',
            'Configure via Teltonika Configurator (USB/Bluetooth).',
            'Set APN under GPRS settings.',
            'Set server Domain/IP and Port to your TCP gateway.',
            'Set protocol to Codec 8 Extended.',
            'Enable Bluetooth if using BLE sensors (temperature beacons).',
            'Set tracking intervals and save configuration.',
            'Verify data flow through your gateway to /api/ingest.'
        ],
        notes: 'Smallest Teltonika tracker. Bluetooth 4.0 support allows connecting external temperature/humidity BLE beacons. Requires a TCP gateway.'
    },
    {
        id: 'teltonika-fmc130',
        manufacturer: 'Teltonika',
        model: 'FMC130',
        protocol: 'TCP',
        compatibility: 'gateway-required',
        icon: 'fa-truck',
        category: 'Vehicle',
        connectivity: '4G LTE (Cat 1) + 2G fallback',
        batteryLife: 'Vehicle powered + 170 mAh backup',
        sensors: ['GPS', 'GLONASS', 'Galileo', 'Accelerometer', 'Bluetooth', 'CAN data'],
        bestFor: 'Heavy fleet, trucks, advanced telematics',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'TCP (Codec 8 Extended)',
            port: '(gateway-defined)',
            authHeader: 'N/A -- device uses IMEI as identifier'
        },
        payloadExample: '// Teltonika Codec 8E binary protocol\n// Gateway converts to JSON:\n' + JSON.stringify({
            imei: "352094089876543",
            latitude: 55.6761,
            longitude: 12.5683,
            timestamp: 1706792400,
            speed: 78,
            heading: 310,
            satellites: 16,
            battery: 100,
            temperature: 18.5
        }, null, 2),
        fieldMapping: [
            ['imei', 'IMEI (auto-identified)'],
            ['latitude / longitude', 'GPS coordinates'],
            ['timestamp', 'timestamp (Unix ms)'],
            ['speed', 'speed (km/h)'],
            ['heading', 'angle (degrees)'],
            ['satellites', 'satellite count'],
            ['temperature', 'via BLE sensor or 1-Wire (I/O element)']
        ],
        setupSteps: [
            'Hardwire FMC130 to vehicle power (10-30V DC).',
            'Configure via Teltonika Configurator over USB.',
            'Set APN under GPRS settings for your 4G SIM.',
            'Set server IP/Domain and Port to your TCP gateway.',
            'Set protocol to Codec 8 Extended.',
            'Configure CAN bus parameters if needed for fuel/RPM data.',
            'Enable Bluetooth and pair BLE temperature beacons if needed.',
            'Set I/O elements and tracking intervals. Save and deploy.',
            'Verify data reaches your gateway and forwards to /api/ingest.'
        ],
        notes: '4G LTE tracker with CAN bus support for engine diagnostics. Best for modern truck fleets. Requires a TCP-to-HTTP gateway (Traccar, flespi, etc.).'
    },
    {
        id: 'concox-at4',
        manufacturer: 'Concox',
        model: 'AT4',
        protocol: 'TCP',
        compatibility: 'gateway-required',
        icon: 'fa-box',
        category: 'Asset',
        connectivity: '4G LTE (Cat 1)',
        batteryLife: '~3 years (10,000 mAh)',
        sensors: ['GPS', 'Wi-Fi positioning', 'Accelerometer', 'Light sensor'],
        bestFor: 'High-value cargo, containers, equipment',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'TCP (proprietary protocol)',
            port: '(gateway-defined)',
            authHeader: 'N/A -- device uses IMEI'
        },
        payloadExample: '// Concox proprietary binary protocol\n// Gateway converts to JSON:\n' + JSON.stringify({
            imei: "868345678901234",
            latitude: 1.3521,
            longitude: 103.8198,
            timestamp: 1706792400,
            battery: 85,
            speed: 0
        }, null, 2),
        fieldMapping: [
            ['imei', 'IMEI (auto-identified)'],
            ['latitude / longitude', 'GPS coordinates'],
            ['timestamp', 'timestamp (Unix)'],
            ['battery', 'battery (%)'],
            ['speed', 'speed (km/h)']
        ],
        setupSteps: [
            'Configure AT4 using Concox SMS commands or the CXTRACK app.',
            'Set APN via SMS: APN,<apn_name>#',
            'Set server address: SERVER,1,<gateway_ip>,<port>,0#',
            'Set reporting interval: TIMER,<seconds>#',
            'Enable motion detection for smart reporting.',
            'Verify connection status via SMS: STATUS#',
            'Ensure gateway forwards parsed data to /api/ingest as JSON POST.'
        ],
        notes: 'Large battery for multi-year deployments. Light sensor detects container opening. IP67 waterproof. Requires a TCP gateway (Traccar, flespi, etc.).'
    },
    {
        id: 'ruptela-fmpro4',
        manufacturer: 'Ruptela',
        model: 'FM-Pro4',
        protocol: 'TCP',
        compatibility: 'gateway-required',
        icon: 'fa-truck',
        category: 'Vehicle',
        connectivity: '4G LTE (Cat 1) + 2G',
        batteryLife: 'Vehicle powered + backup',
        sensors: ['GPS', 'GLONASS', 'Accelerometer', 'CAN', 'RS-232/RS-485', '1-Wire'],
        bestFor: 'Advanced fleet telematics, fuel monitoring',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'TCP (Ruptela binary protocol)',
            port: '(gateway-defined)',
            authHeader: 'N/A -- device uses IMEI'
        },
        payloadExample: '// Ruptela binary protocol\n// Gateway converts to JSON:\n' + JSON.stringify({
            imei: "867456789012345",
            latitude: 56.9496,
            longitude: 24.1052,
            timestamp: 1706792400,
            speed: 60,
            heading: 45,
            battery: 100,
            temperature: 7.2
        }, null, 2),
        fieldMapping: [
            ['imei', 'IMEI (auto-identified)'],
            ['latitude / longitude', 'GPS coordinates'],
            ['timestamp', 'timestamp (Unix)'],
            ['speed', 'speed (km/h)'],
            ['heading', 'heading (degrees)'],
            ['temperature', 'via 1-Wire / CAN sensor']
        ],
        setupSteps: [
            'Install FM-Pro4 in the vehicle (10-32V DC).',
            'Configure via Ruptela Device Center software over USB.',
            'Set APN under Operator settings.',
            'Set server IP and port to your TCP gateway.',
            'Configure I/O parameters (fuel sensor, temperature, etc.).',
            'Set data sending intervals.',
            'Connect CAN bus or RS-232 sensors if needed.',
            'Save and restart. Verify data reaches gateway and /api/ingest.'
        ],
        notes: 'Professional-grade fleet tracker with CAN bus, fuel sensors, and driver ID. 1-Wire port for Dallas temperature probes. Requires TCP gateway.'
    },
    {
        id: 'calamp-lmu3640',
        manufacturer: 'CalAmp',
        model: 'LMU-3640',
        protocol: 'MQTT',
        compatibility: 'gateway-required',
        icon: 'fa-truck-moving',
        category: 'Vehicle',
        connectivity: '4G LTE (Cat 1)',
        batteryLife: 'Vehicle powered + internal backup',
        sensors: ['GPS', 'GLONASS', 'Accelerometer', 'OBD-II'],
        bestFor: 'Heavy-duty vehicles, regulatory compliance',
        apn: 'internet (carrier-specific)',
        serverSetup: {
            method: 'MQTT (CalAmp LM Direct)',
            broker: '(CalAmp cloud or custom)',
            authHeader: 'N/A -- device uses ESN/IMEI'
        },
        payloadExample: '// CalAmp LM Direct / MQTT protocol\n// Bridge converts to JSON:\n' + JSON.stringify({
            deviceId: "LMU-012345678",
            imei: "354123456789012",
            latitude: 37.7749,
            longitude: -122.4194,
            timestamp: 1706792400,
            speed: 45,
            heading: 200,
            battery: 100
        }, null, 2),
        fieldMapping: [
            ['deviceId / imei', 'ESN or IMEI'],
            ['latitude / longitude', 'GPS coordinates'],
            ['timestamp', 'timestamp (Unix)'],
            ['speed', 'speed (km/h)'],
            ['heading', 'heading (degrees)']
        ],
        setupSteps: [
            'Install LMU-3640 in the vehicle (hardwire 8-32V DC or OBD-II).',
            'Provision the device via CalAmp Application Management platform.',
            'Set the MQTT broker to your MQTT-to-HTTP bridge, or use CalAmp cloud.',
            'Configure reporting rules and PEG scripts for event types.',
            'Set APN for your carrier SIM.',
            'Create an MQTT bridge to forward messages as HTTP POST to /api/ingest.',
            'Map CalAmp message fields to Aurion JSON fields.',
            'Test and verify data flow to your dashboard.'
        ],
        notes: 'Enterprise-grade tracker used in regulated industries. Supports CalAmp PEG (Programmable Event Generator) for custom logic. Requires an MQTT-to-HTTP bridge for Aurion integration.'
    },
    {
        id: 'abeeway-micro',
        manufacturer: 'Abeeway (Actility)',
        model: 'Micro Tracker',
        protocol: 'HTTP',
        compatibility: 'plug-and-play',
        icon: 'fa-location-crosshairs',
        category: 'Asset',
        connectivity: 'LoRaWAN + Wi-Fi + BLE + GPS',
        batteryLife: '~2-5 years (usage dependent)',
        sensors: ['GPS', 'Wi-Fi sniffing', 'BLE', 'Accelerometer', 'Temperature'],
        bestFor: 'Parcels, pallets, high-value small assets, indoor/outdoor',
        apn: 'N/A (LoRaWAN)',
        serverSetup: {
            method: 'HTTP POST (via ThingPark webhook)',
            contentType: 'application/json',
            authHeader: 'Bearer <LTE_INGEST_TOKEN>'
        },
        payloadExample: JSON.stringify({
            deviceId: "ABEEWAY-0018B20000012345",
            latitude: 48.8566,
            longitude: 2.3522,
            timestamp: "2026-02-01T12:00:00Z",
            temperature: 21.5,
            battery: 92
        }, null, 2),
        fieldMapping: [
            ['deviceId', 'DevEUI / device identifier'],
            ['latitude / longitude', 'latitude / longitude (resolved)'],
            ['timestamp', 'timestamp (ISO 8601)'],
            ['temperature', 'temperature (C)'],
            ['battery', 'battery (%)']
        ],
        setupSteps: [
            'Register the Micro Tracker on the Actility ThingPark platform (or your LoRaWAN network server).',
            'Ensure the device is provisioned with the correct AppKey/AppEUI for OTAA join.',
            'In ThingPark, go to Application Settings and create an HTTP connector (webhook).',
            'Set the destination URL to your Aurion /api/ingest endpoint.',
            'Add an HTTP header: Authorization: Bearer <your_LTE_INGEST_TOKEN>.',
            'Configure the payload decoder to output JSON with deviceId, latitude, longitude, temperature, battery fields.',
            'Use the Abeeway Device Manager to set the tracker profile (motion tracking, static, etc.).',
            'Set geolocation strategy: GPS for outdoor, Wi-Fi/BLE scan for indoor.',
            'Test by moving the device and verifying data appears on your dashboard.'
        ],
        notes: 'Multi-mode geolocation (GPS + Wi-Fi + BLE) enables indoor/outdoor tracking without infrastructure changes. Data flows: Tracker -> LoRaWAN Gateway -> ThingPark -> HTTP webhook -> Aurion. Use the Abeeway Device Manager for advanced configuration (geofencing, motion profiles, SOS button).'
    },
    {
        id: 'abeeway-industrial',
        manufacturer: 'Abeeway (Actility)',
        model: 'Industrial Tracker',
        protocol: 'HTTP',
        compatibility: 'plug-and-play',
        icon: 'fa-industry',
        category: 'Asset',
        connectivity: 'LoRaWAN + Wi-Fi + BLE + GPS',
        batteryLife: '~5-7 years',
        sensors: ['GPS', 'Wi-Fi sniffing', 'BLE', 'Accelerometer', 'Temperature'],
        bestFor: 'Containers, heavy equipment, industrial assets, outdoor yards',
        apn: 'N/A (LoRaWAN)',
        serverSetup: {
            method: 'HTTP POST (via ThingPark webhook)',
            contentType: 'application/json',
            authHeader: 'Bearer <LTE_INGEST_TOKEN>'
        },
        payloadExample: JSON.stringify({
            deviceId: "ABEEWAY-IND-0018B20000067890",
            latitude: 52.5200,
            longitude: 13.4050,
            timestamp: "2026-02-01T09:30:00Z",
            temperature: 8.2,
            battery: 97
        }, null, 2),
        fieldMapping: [
            ['deviceId', 'DevEUI / device identifier'],
            ['latitude / longitude', 'latitude / longitude (resolved)'],
            ['timestamp', 'timestamp (ISO 8601)'],
            ['temperature', 'temperature (C)'],
            ['battery', 'battery (%)']
        ],
        setupSteps: [
            'Register the Industrial Tracker on ThingPark or your LoRaWAN network server.',
            'Provision with OTAA credentials (AppKey/AppEUI).',
            'In ThingPark, create an HTTP connector with your /api/ingest endpoint URL.',
            'Add Authorization: Bearer <your_LTE_INGEST_TOKEN> as an HTTP header.',
            'Configure the payload decoder for JSON output.',
            'Use the Abeeway Device Manager to set the operating mode (motion tracking, periodic, activity-based).',
            'Set GPS timeout and scan strategies for your environment.',
            'Mount the tracker on the asset (IP68 rated, use the mounting bracket).',
            'Test and verify data flow to your Aurion dashboard.'
        ],
        notes: 'IP68 ruggedized for harsh environments. Very long battery life due to LoRaWAN low-power design. Ideal for assets that move between outdoor yards and warehouses. Supports BLE beacon scanning for zone-level indoor positioning.'
    },
    {
        id: 'abeeway-compact',
        manufacturer: 'Abeeway (Actility)',
        model: 'Compact Tracker',
        protocol: 'HTTP',
        compatibility: 'plug-and-play',
        icon: 'fa-cube',
        category: 'Asset',
        connectivity: 'LoRaWAN + Wi-Fi + BLE + GPS',
        batteryLife: '~3-5 years',
        sensors: ['GPS', 'Wi-Fi sniffing', 'BLE', 'Accelerometer', 'Temperature', 'Buzzer'],
        bestFor: 'Reusable containers, roll cages, medical equipment',
        apn: 'N/A (LoRaWAN)',
        serverSetup: {
            method: 'HTTP POST (via ThingPark webhook)',
            contentType: 'application/json',
            authHeader: 'Bearer <LTE_INGEST_TOKEN>'
        },
        payloadExample: JSON.stringify({
            deviceId: "ABEEWAY-CMP-0018B20000098765",
            latitude: 51.5074,
            longitude: -0.1278,
            timestamp: "2026-02-01T15:45:00Z",
            temperature: 19.8,
            battery: 88
        }, null, 2),
        fieldMapping: [
            ['deviceId', 'DevEUI / device identifier'],
            ['latitude / longitude', 'latitude / longitude (resolved)'],
            ['timestamp', 'timestamp (ISO 8601)'],
            ['temperature', 'temperature (C)'],
            ['battery', 'battery (%)']
        ],
        setupSteps: [
            'Register on ThingPark or your LoRaWAN network server with OTAA.',
            'Create an HTTP webhook connector in ThingPark pointing to /api/ingest.',
            'Set the Authorization header to Bearer <your_LTE_INGEST_TOKEN>.',
            'Decode the uplink payload to JSON (use Actility/Abeeway standard decoder).',
            'Configure the tracker via Abeeway Device Manager:',
            '  - Set operating mode (motion tracking recommended for logistics).',
            '  - Configure geofence alerts if needed.',
            '  - Enable the buzzer for asset-finding scenarios.',
            'Attach to the asset and verify data on your dashboard.'
        ],
        notes: 'Mid-size form factor with an audible buzzer for "find my asset" functionality. Supports angle detection for tilt monitoring. Same ThingPark webhook integration as other Abeeway devices -- configure once and all Abeeway devices use the same data pipeline.'
    },
    {
        id: 'abeeway-smart-badge',
        manufacturer: 'Abeeway (Actility)',
        model: 'Smart Badge',
        protocol: 'HTTP',
        compatibility: 'plug-and-play',
        icon: 'fa-id-badge',
        category: 'Personnel',
        connectivity: 'LoRaWAN + Wi-Fi + BLE + GPS',
        batteryLife: '~1-3 months (rechargeable)',
        sensors: ['GPS', 'Wi-Fi sniffing', 'BLE', 'Accelerometer', 'SOS button'],
        bestFor: 'Worker safety, lone worker tracking, visitor management',
        apn: 'N/A (LoRaWAN)',
        serverSetup: {
            method: 'HTTP POST (via ThingPark webhook)',
            contentType: 'application/json',
            authHeader: 'Bearer <LTE_INGEST_TOKEN>'
        },
        payloadExample: JSON.stringify({
            deviceId: "ABEEWAY-SB-0018B20000054321",
            latitude: 45.7640,
            longitude: 4.8357,
            timestamp: "2026-02-01T08:15:00Z",
            battery: 74
        }, null, 2),
        fieldMapping: [
            ['deviceId', 'DevEUI / device identifier'],
            ['latitude / longitude', 'latitude / longitude (resolved)'],
            ['timestamp', 'timestamp (ISO 8601)'],
            ['battery', 'battery (%)']
        ],
        setupSteps: [
            'Register the Smart Badge on ThingPark.',
            'Set up the HTTP webhook to /api/ingest with Bearer token auth.',
            'Configure the payload decoder for JSON output.',
            'Use Abeeway Device Manager to configure the badge profile:',
            '  - Set tracking mode (motion, periodic, or on-demand).',
            '  - Configure the SOS button behavior.',
            '  - Set BLE scanning for indoor zone tracking.',
            'Charge the badge and distribute to personnel.',
            'Test SOS alert and location reporting on the dashboard.'
        ],
        notes: 'Wearable form factor with an SOS button for emergency alerts. Rechargeable via USB-C. Best suited for personnel tracking and lone-worker safety. Uses the same ThingPark webhook as other Abeeway devices.'
    }
];

function getIngestUrl() {
    return window.location.origin + '/api/ingest';
}

function initTrackerLibrary() {
    const container = document.getElementById('trackerLibraryGrid');
    if (!container) return;

    renderTrackerCards(TRACKER_PROFILES);

    const searchInput = document.getElementById('trackerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterTrackerLibrary();
        });
    }

    const filterBtns = document.querySelectorAll('.tracker-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterTrackerLibrary();
        });
    });
}

function filterTrackerLibrary() {
    const searchVal = (document.getElementById('trackerSearch')?.value || '').toLowerCase();
    const activeFilter = document.querySelector('.tracker-filter-btn.active');
    const protocolFilter = activeFilter ? activeFilter.dataset.filter : 'all';

    const filtered = TRACKER_PROFILES.filter(t => {
        const matchesSearch = !searchVal ||
            t.manufacturer.toLowerCase().includes(searchVal) ||
            t.model.toLowerCase().includes(searchVal) ||
            t.category.toLowerCase().includes(searchVal) ||
            t.connectivity.toLowerCase().includes(searchVal) ||
            t.bestFor.toLowerCase().includes(searchVal);

        const matchesProtocol = protocolFilter === 'all' || t.protocol === protocolFilter;

        return matchesSearch && matchesProtocol;
    });

    renderTrackerCards(filtered);
}

function renderTrackerCards(profiles) {
    const container = document.getElementById('trackerLibraryGrid');
    if (!container) return;

    if (profiles.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:2rem;">No trackers match your search.</p>';
        return;
    }

    container.innerHTML = profiles.map(t => `
        <div class="tracker-card" onclick="showTrackerConfig('${t.id}')">
            <div class="tracker-card-icon"><i class="fas ${t.icon}"></i></div>
            <div class="tracker-card-body">
                <div class="tracker-card-title">${t.model}</div>
                <div class="tracker-card-manufacturer">${t.manufacturer}</div>
                <div class="tracker-card-tags">
                    <span class="tracker-badge tracker-badge-${t.protocol.toLowerCase()}">${t.protocol}</span>
                    <span class="tracker-badge tracker-badge-${t.compatibility === 'plug-and-play' ? 'ok' : 'gw'}">${t.compatibility === 'plug-and-play' ? 'Plug & Play' : 'Gateway'}</span>
                </div>
                <div class="tracker-card-meta">${t.category} &middot; ${t.connectivity}</div>
            </div>
        </div>
    `).join('');
}

function showTrackerConfig(trackerId) {
    const t = TRACKER_PROFILES.find(p => p.id === trackerId);
    if (!t) return;

    const ingestUrl = getIngestUrl();

    const modal = document.getElementById('trackerConfigModal');
    if (!modal) return;

    document.getElementById('tcmTitle').textContent = t.manufacturer + ' ' + t.model;

    const body = document.getElementById('tcmBody');
    body.innerHTML = `
        <div class="tracker-detail-header">
            <span class="tracker-badge tracker-badge-${t.protocol.toLowerCase()}">${t.protocol}</span>
            <span class="tracker-badge tracker-badge-${t.compatibility === 'plug-and-play' ? 'ok' : 'gw'}">${t.compatibility === 'plug-and-play' ? 'Plug & Play' : 'Requires Gateway'}</span>
            <span class="tracker-badge">${t.category}</span>
            <span class="tracker-badge">${t.connectivity}</span>
        </div>

        <div class="tracker-detail-section">
            <h4><i class="fas fa-info-circle"></i> Overview</h4>
            <table class="tracker-specs-table">
                <tr><td>Best for</td><td>${t.bestFor}</td></tr>
                <tr><td>Battery</td><td>${t.batteryLife}</td></tr>
                <tr><td>Sensors</td><td>${t.sensors.join(', ')}</td></tr>
                <tr><td>Default APN</td><td>${t.apn}</td></tr>
            </table>
        </div>

        <div class="tracker-detail-section">
            <h4><i class="fas fa-server"></i> Server Configuration</h4>
            <table class="tracker-specs-table">
                <tr><td>Method</td><td>${t.serverSetup.method}</td></tr>
                <tr>
                    <td>${t.protocol === 'HTTP' ? 'Endpoint URL' : 'Server'}</td>
                    <td>
                        <code id="tcmIngestUrl">${t.protocol === 'HTTP' ? ingestUrl : (t.serverSetup.broker || t.serverSetup.port || 'See setup steps')}</code>
                        ${t.protocol === 'HTTP' ? `<button class="btn-copy" onclick="copyTrackerConfig('tcmIngestUrl')" title="Copy"><i class="fas fa-copy"></i></button>` : ''}
                    </td>
                </tr>
                <tr><td>Auth</td><td><code>${t.serverSetup.authHeader || 'N/A'}</code></td></tr>
            </table>
        </div>

        <div class="tracker-detail-section">
            <h4><i class="fas fa-code"></i> Payload Example</h4>
            <pre class="tracker-code" id="tcmPayload">${escapeHtml(t.payloadExample)}</pre>
            <button class="btn btn-outline btn-small" onclick="copyTrackerConfig('tcmPayload')"><i class="fas fa-copy"></i> Copy Payload</button>
        </div>

        <div class="tracker-detail-section">
            <h4><i class="fas fa-exchange-alt"></i> Field Mapping</h4>
            <table class="tracker-specs-table">
                <tr><th>Aurion Field</th><th>Tracker Field</th></tr>
                ${t.fieldMapping.map(([ctField, trackerField]) => `<tr><td><code>${ctField}</code></td><td>${trackerField}</td></tr>`).join('')}
            </table>
        </div>

        <div class="tracker-detail-section">
            <h4><i class="fas fa-list-ol"></i> Setup Steps</h4>
            <ol class="tracker-setup-steps">
                ${t.setupSteps.map(step => `<li>${step.replace(/<LTE_INGEST_TOKEN>/g, '&lt;LTE_INGEST_TOKEN&gt;').replace(/\/api\/ingest/g, '<code>' + ingestUrl + '</code>')}</li>`).join('')}
            </ol>
        </div>

        <div class="tracker-detail-section tracker-notes">
            <h4><i class="fas fa-sticky-note"></i> Notes</h4>
            <p>${t.notes}</p>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeTrackerConfigModal() {
    const modal = document.getElementById('trackerConfigModal');
    if (modal) modal.style.display = 'none';
}

function copyTrackerConfig(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.textContent || el.innerText;
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('Copied to clipboard!', 'success');
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}