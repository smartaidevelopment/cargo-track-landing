// Admin Dashboard functionality

let adminCharts = {};
let adminGlobalMap = null;
let adminGlobalDeviceMarkers = [];
let adminMapAutoRefreshInterval = null;
let adminMapAutoRefreshEnabled = false;

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
        }
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
    initAdminSettings();
    
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
    loadPaymentTransactions();
    loadSecurityAuditLog();
    loadPrivacyRequests();
    
    // Search functionality
    const searchInput = document.getElementById('adminSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleAdminSearch);
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
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(adminGlobalMap);
    
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

function updateAdminGlobalMap() {
    if (!adminGlobalMap) return;
    
    // Clear existing markers
    adminGlobalDeviceMarkers.forEach(marker => adminGlobalMap.removeLayer(marker));
    adminGlobalDeviceMarkers = [];
    
    // Get all devices from all users
    const getUsersFn = window.getUsers || (typeof getUsers !== 'undefined' ? getUsers : null);
    const getAllDevicesFn = window.getAllDevices || (typeof getAllDevices !== 'undefined' ? getAllDevices : null);
    
    if (!getAllDevicesFn) {
        console.warn('getAllDevices function not available');
        return;
    }
    
    const allDevices = getAllDevicesFn();
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
    // Safe function calls with fallbacks
    const getUsersFn = window.getUsers || (typeof getUsers !== 'undefined' ? getUsers : null);
    const getAllDevicesFn = window.getAllDevices || (typeof getAllDevices !== 'undefined' ? getAllDevices : null);
    const getPaymentTransactionsFn = window.getPaymentTransactions || (typeof getPaymentTransactions !== 'undefined' ? getPaymentTransactions : null);
    
    const users = getUsersFn ? getUsersFn() : [];
    const devices = getAllDevicesFn ? getAllDevicesFn() : [];
    const payments = getPaymentTransactionsFn ? getPaymentTransactionsFn() : [];
    
    // Update stats
    document.getElementById('adminTotalUsers').textContent = users.length;
    document.getElementById('adminTotalDevices').textContent = devices.length;
    document.getElementById('adminActiveSubscriptions').textContent = users.filter(u => u.isActive).length;
    
    // Calculate revenue
    const totalRevenue = payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.amount.replace('$', '').replace(',', '')), 0);
    document.getElementById('adminTotalRevenue').textContent = '$' + totalRevenue.toLocaleString();
    
    // Load recent users
    loadRecentUsers(users.slice(-5).reverse());
    
    // Load activity
    loadAdminActivity();
    
    // Initialize revenue chart
    initRevenueChart(payments);
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
            <td><span class="status-badge">${user.package || 'Professional'}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td><span class="status-badge ${user.isActive ? 'active' : 'inactive'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
        </tr>
    `).join('');
}

function loadAdminActivity() {
    const activityList = document.getElementById('adminActivityList');
    if (!activityList) return;
    
    const activities = [
        { title: 'New user registered', description: 'Company: ABC Corp', icon: 'fas fa-user-plus', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', time: '5 min ago' },
        { title: 'Payment received', description: '$249 from Professional package', icon: 'fas fa-dollar-sign', color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', time: '15 min ago' },
        { title: 'Device added', description: 'New device registered by user', icon: 'fas fa-microchip', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', time: '1 hour ago' },
        { title: 'Security alert', description: 'Failed login attempt detected', icon: 'fas fa-shield-alt', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', time: '2 hours ago' }
    ];
    
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
            const amount = parseFloat(payment.amount.replace('$', '').replace(',', ''));
            revenueByDay[6 - daysAgo] += amount;
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

function loadAllUsers() {
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
    
    tableBody.innerHTML = users.map(user => {
        const packageColors = {
            'basic': '#667eea',
            'professional': '#f093fb',
            'enterprise': '#4facfe'
        };
        const packageColor = packageColors[user.package] || '#667eea';
        
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
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${user.email}</div>
                    ${user.company ? `<div style="font-size: 0.875rem; color: var(--text-light);">${user.company}</div>` : ''}
                </div>
            </td>
            <td>${user.company || '<span style="color: var(--text-light);">-</span>'}</td>
            <td>
                <span class="status-badge" style="background: ${packageColor}; color: white; text-transform: capitalize;">
                    ${(user.package || 'Professional').charAt(0).toUpperCase() + (user.package || 'Professional').slice(1)}
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
        filtered = filtered.filter(u => (u.package || 'professional').toLowerCase() === packageFilter);
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
        'basic': '#667eea',
        'professional': '#f093fb',
        'enterprise': '#4facfe'
    };
    
    tableBody.innerHTML = filtered.map(user => {
        const packageColor = packageColors[user.package] || '#667eea';
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
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${user.email}</div>
                    ${user.company ? `<div style="font-size: 0.875rem; color: var(--text-light);">${user.company}</div>` : ''}
                </div>
            </td>
            <td>${user.company || '<span style="color: var(--text-light);">-</span>'}</td>
            <td>
                <span class="status-badge" style="background: ${packageColor}; color: white; text-transform: capitalize;">
                    ${(user.package || 'Professional').charAt(0).toUpperCase() + (user.package || 'Professional').slice(1)}
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
        'basic': '#667eea',
        'professional': '#f093fb',
        'enterprise': '#4facfe'
    };
    const packageColor = packageColors[user.package] || '#667eea';
    
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
                        ${(user.package || 'Professional').charAt(0).toUpperCase() + (user.package || 'Professional').slice(1)}
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
                            ${(user.package || 'Professional').charAt(0).toUpperCase() + (user.package || 'Professional').slice(1)}
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
    document.getElementById('editUserPackage').value = user.package || 'professional';
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

function deleteUser(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (confirm(`Are you sure you want to delete user ${user.email}? This action cannot be undone.`)) {
        const filtered = users.filter(u => u.id !== userId);
        saveUsers(filtered);
        logSecurityEvent('user_deletion', user.email, 'success');
        loadAllUsers();
        alert('User deleted successfully!');
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
    const transactions = localStorage.getItem(transactionsKey);
    
    if (!transactions) {
        // Generate sample transactions
        const users = getUsers();
        const sampleTransactions = users.slice(0, 10).map((user, index) => {
            const packages = { basic: 99, professional: 249, enterprise: 499 };
            const packageType = user.package || 'professional';
            const amount = packages[packageType] || 249;
            
            return {
                id: `TXN-${String(index + 1).padStart(6, '0')}`,
                userId: user.id,
                userEmail: user.email,
                package: packageType,
                amount: `$${amount}`,
                method: index % 3 === 0 ? 'Stripe' : (index % 3 === 1 ? 'PayPal' : 'Bank Transfer'),
                status: index < 8 ? 'completed' : (index === 8 ? 'pending' : 'failed'),
                date: new Date(Date.now() - index * 24 * 3600000).toISOString()
            };
        });
        localStorage.setItem(transactionsKey, JSON.stringify(sampleTransactions));
        return sampleTransactions;
    }
    
    return JSON.parse(transactions);
}

function loadPaymentTransactions() {
    const transactions = getPaymentTransactions();
    const tableBody = document.getElementById('paymentsTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = transactions.map(txn => `
        <tr>
            <td>${txn.id}</td>
            <td>${txn.userEmail}</td>
            <td><span class="status-badge">${txn.package}</span></td>
            <td><strong>${txn.amount}</strong></td>
            <td>${txn.method}</td>
            <td><span class="status-badge ${txn.status === 'completed' ? 'active' : (txn.status === 'pending' ? 'warning' : 'error')}">${txn.status}</span></td>
            <td>${formatDate(txn.date)}</td>
            <td>
                <button class="btn-icon-small view" onclick="viewTransaction('${txn.id}')" title="View">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    updatePaymentStats(transactions);
}

function updatePaymentStats(transactions = null) {
    if (!transactions) {
        transactions = getPaymentTransactions();
    }
    
    const completed = transactions.filter(t => t.status === 'completed');
    const totalRevenue = completed.reduce((sum, t) => {
        return sum + parseFloat(t.amount.replace('$', '').replace(',', ''));
    }, 0);
    
    const thisMonth = completed.filter(t => {
        const txnDate = new Date(t.date);
        const now = new Date();
        return txnDate.getMonth() === now.getMonth() && txnDate.getFullYear() === now.getFullYear();
    });
    const monthlyRevenue = thisMonth.reduce((sum, t) => {
        return sum + parseFloat(t.amount.replace('$', '').replace(',', ''));
    }, 0);
    
    const pending = transactions.filter(t => t.status === 'pending');
    const pendingRevenue = pending.reduce((sum, t) => {
        return sum + parseFloat(t.amount.replace('$', '').replace(',', ''));
    }, 0);
    
    document.getElementById('totalRevenue').textContent = '$' + totalRevenue.toLocaleString();
    document.getElementById('monthlyRevenue').textContent = '$' + monthlyRevenue.toLocaleString();
    document.getElementById('pendingRevenue').textContent = '$' + pendingRevenue.toLocaleString();
    document.getElementById('failedPayments').textContent = transactions.filter(t => t.status === 'failed').length;
}

// Invoice Management
function initInvoiceManagement() {
    document.getElementById('exportInvoicesBtn').addEventListener('click', exportAllInvoices);
    document.getElementById('filterInvoiceStatus').addEventListener('change', filterAdminInvoices);
    document.getElementById('invoiceSearchInput').addEventListener('input', filterAdminInvoices);
}

function loadAdminInvoices() {
    // Generate invoices for all transactions
    if (typeof generateInvoicesForTransactions === 'function') {
        generateInvoicesForTransactions();
    }
    
    const invoices = getInvoices();
    const tableBody = document.getElementById('adminInvoicesTable');
    
    if (!tableBody) return;
    
    if (invoices.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    No invoices found. Click "Generate Missing Invoices" to create invoices from transactions.
                </td>
            </tr>
        `;
    } else {
        const users = getUsers();
        tableBody.innerHTML = invoices.map(invoice => {
            const user = users.find(u => u.id === invoice.userId) || { email: 'Unknown', company: 'Unknown' };
            const isOverdue = invoice.status === 'pending' && new Date(invoice.dueDate) < new Date();
            
            return `
                <tr>
                    <td><strong>${invoice.invoiceNumber}</strong></td>
                    <td>
                        <div>${user.company || user.email}</div>
                        <div style="font-size: 0.75rem; color: var(--text-light);">${user.email}</div>
                    </td>
                    <td>${formatDate(invoice.date)}</td>
                    <td>${formatDate(invoice.dueDate)}</td>
                    <td><strong>$${invoice.total.toFixed(2)}</strong></td>
                    <td>
                        <span class="status-badge ${invoice.status === 'paid' ? 'active' : (isOverdue ? 'error' : 'warning')}">
                            ${isOverdue ? 'Overdue' : invoice.status}
                        </span>
                    </td>
                    <td>${invoice.paymentMethod}</td>
                    <td>
                        <div class="user-actions">
                            <button class="btn-icon-small view" onclick="viewAdminInvoice('${invoice.id}')" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon-small edit" onclick="downloadAdminInvoice('${invoice.id}')" title="Download">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    updateInvoiceStatistics(invoices);
    loadRecentInvoices(invoices);
}

function updateInvoiceStatistics(invoices) {
    const paid = invoices.filter(inv => inv.status === 'paid');
    const pending = invoices.filter(inv => inv.status === 'pending');
    const totalRevenue = paid.reduce((sum, inv) => sum + inv.total, 0);
    
    document.getElementById('adminTotalInvoices').textContent = invoices.length;
    document.getElementById('adminInvoiceRevenue').textContent = '$' + totalRevenue.toFixed(2);
    document.getElementById('adminPaidInvoices').textContent = paid.length;
    document.getElementById('adminPendingInvoices').textContent = pending.length;
}

function loadRecentInvoices(invoices) {
    const recentList = document.getElementById('recentInvoicesList');
    if (!recentList) return;
    
    const recent = invoices.slice(-5).reverse();
    
    if (recent.length === 0) {
        recentList.innerHTML = '<p style="color: var(--text-light); padding: 1rem;">No recent invoices</p>';
    } else {
        recentList.innerHTML = recent.map(invoice => `
            <div class="recent-invoice-item">
                <div class="recent-invoice-header">
                    <strong>${invoice.invoiceNumber}</strong>
                    <span class="status-badge ${invoice.status === 'paid' ? 'active' : 'warning'}">${invoice.status}</span>
                </div>
                <div class="recent-invoice-details">
                    <span>${invoice.userEmail}</span>
                    <span>$${invoice.total.toFixed(2)}</span>
                </div>
                <div class="recent-invoice-date">${formatDate(invoice.date)}</div>
            </div>
        `).join('');
    }
}

function filterAdminInvoices() {
    const statusFilter = document.getElementById('filterInvoiceStatus').value;
    const searchTerm = document.getElementById('invoiceSearchInput').value.toLowerCase();
    
    const invoices = getInvoices();
    let filtered = invoices;
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(inv => {
            if (statusFilter === 'overdue') {
                return inv.status === 'pending' && new Date(inv.dueDate) < new Date();
            }
            return inv.status === statusFilter;
        });
    }
    
    if (searchTerm) {
        const users = getUsers();
        filtered = filtered.filter(inv => {
            const user = users.find(u => u.id === inv.userId);
            return inv.invoiceNumber.toLowerCase().includes(searchTerm) ||
                   (user && (user.email.toLowerCase().includes(searchTerm) || 
                            (user.company && user.company.toLowerCase().includes(searchTerm))));
        });
    }
    
    const tableBody = document.getElementById('adminInvoicesTable');
    if (!tableBody) return;
    
    const users = getUsers();
    tableBody.innerHTML = filtered.map(invoice => {
        const user = users.find(u => u.id === invoice.userId) || { email: 'Unknown', company: 'Unknown' };
        const isOverdue = invoice.status === 'pending' && new Date(invoice.dueDate) < new Date();
        
        return `
            <tr>
                <td><strong>${invoice.invoiceNumber}</strong></td>
                <td>
                    <div>${user.company || user.email}</div>
                    <div style="font-size: 0.75rem; color: var(--text-light);">${user.email}</div>
                </td>
                <td>${formatDate(invoice.date)}</td>
                <td>${formatDate(invoice.dueDate)}</td>
                <td><strong>$${invoice.total.toFixed(2)}</strong></td>
                <td>
                    <span class="status-badge ${invoice.status === 'paid' ? 'active' : (isOverdue ? 'error' : 'warning')}">
                        ${isOverdue ? 'Overdue' : invoice.status}
                    </span>
                </td>
                <td>${invoice.paymentMethod}</td>
                <td>
                    <div class="user-actions">
                        <button class="btn-icon-small view" onclick="viewAdminInvoice('${invoice.id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon-small edit" onclick="downloadAdminInvoice('${invoice.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function viewAdminInvoice(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) {
        alert('Invoice not found');
        return;
    }
    
    const invoiceHTML = createInvoiceHTML(invoice);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
}

function downloadAdminInvoice(invoiceId) {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) {
        alert('Invoice not found');
        return;
    }
    
    downloadInvoicePDF(invoice);
}

function generateAllInvoices() {
    if (typeof generateInvoicesForTransactions === 'function') {
        generateInvoicesForTransactions();
        loadAdminInvoices();
        alert('All missing invoices have been generated!');
    }
}

function exportAllInvoices() {
    const invoices = getInvoices();
    const users = getUsers();
    
    const csv = [
        ['Invoice #', 'Customer', 'Email', 'Date', 'Due Date', 'Amount', 'Status', 'Payment Method'],
        ...invoices.map(inv => {
            const user = users.find(u => u.id === inv.userId) || { email: 'Unknown', company: 'Unknown' };
            return [
                inv.invoiceNumber,
                user.company || user.email,
                user.email,
                formatDate(inv.date),
                formatDate(inv.dueDate),
                '$' + inv.total.toFixed(2),
                inv.status,
                inv.paymentMethod
            ];
        })
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Package Management
const PACKAGES_KEY = 'cargotrack_packages';

function initPackageManagement() {
    document.getElementById('addPackageBtn').addEventListener('click', showAddPackageForm);
    document.getElementById('packageForm').addEventListener('submit', savePackage);
    document.getElementById('closePackageModal').addEventListener('click', closePackageModal);
    
    // Initialize default packages if none exist
    initDefaultPackages();
}

function initDefaultPackages() {
    const storedPackages = localStorage.getItem(PACKAGES_KEY);
    if (!storedPackages) {
        const defaultPackages = {
            basic: {
                id: 'basic',
                name: 'Basic',
                price: 99,
                maxDevices: 10,
                extraDevicePrice: 10,
                description: 'Basic - $99/month',
                active: true
            },
            professional: {
                id: 'professional',
                name: 'Professional',
                price: 249,
                maxDevices: 50,
                extraDevicePrice: 10,
                description: 'Professional - $249/month',
                active: true
            },
            enterprise: {
                id: 'enterprise',
                name: 'Enterprise',
                price: 499,
                maxDevices: 0, // 0 = unlimited
                extraDevicePrice: 0,
                description: 'Enterprise - $499/month',
                active: true
            }
        };
        localStorage.setItem(PACKAGES_KEY, JSON.stringify(defaultPackages));
    }
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
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    No packages found. Click "Add Package" to create one.
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = packagesArray.map(pkg => `
            <tr>
                <td><strong>${pkg.name}</strong><br><small style="color: var(--text-light);">ID: ${pkg.id}</small></td>
                <td>$${pkg.price.toFixed(2)}</td>
                <td>${pkg.maxDevices === 0 ? 'Unlimited' : pkg.maxDevices}</td>
                <td>$${pkg.extraDevicePrice.toFixed(2)}</td>
                <td><span class="status-badge ${pkg.active ? 'active' : 'inactive'}">${pkg.active ? 'Active' : 'Inactive'}</span></td>
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
            </tr>
        `).join('');
    }
}

function showAddPackageForm() {
    document.getElementById('packageFormTitle').textContent = 'Add Package';
    document.getElementById('packageForm').reset();
    document.getElementById('packageId').disabled = false;
    document.getElementById('packageActive').checked = true;
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
    document.getElementById('packageId').disabled = true; // Can't change ID
    document.getElementById('packageName').value = pkg.name;
    document.getElementById('packageDescription').value = pkg.description || '';
    document.getElementById('packagePrice').value = pkg.price;
    document.getElementById('packageMaxDevices').value = pkg.maxDevices;
    document.getElementById('packageExtraDevicePrice').value = pkg.extraDevicePrice;
    document.getElementById('packageActive').checked = pkg.active !== false;
    
    document.getElementById('packageFormModal').classList.add('active');
}

function savePackage(e) {
    e.preventDefault();
    
    const packageId = document.getElementById('packageId').value.trim().toLowerCase();
    const packageName = document.getElementById('packageName').value.trim();
    const packageDescription = document.getElementById('packageDescription').value.trim();
    const packagePrice = parseFloat(document.getElementById('packagePrice').value);
    const packageMaxDevices = parseInt(document.getElementById('packageMaxDevices').value);
    const packageExtraDevicePrice = parseFloat(document.getElementById('packageExtraDevicePrice').value);
    const packageActive = document.getElementById('packageActive').checked;
    
    // Validation
    if (!packageId || !packageName) {
        alert('Please fill in all required fields');
        return;
    }
    
    if (isNaN(packagePrice) || packagePrice < 0) {
        alert('Please enter a valid price');
        return;
    }
    
    if (isNaN(packageMaxDevices) || packageMaxDevices < 0) {
        alert('Please enter a valid max devices (use 0 for unlimited)');
        return;
    }
    
    if (isNaN(packageExtraDevicePrice) || packageExtraDevicePrice < 0) {
        alert('Please enter a valid extra device price');
        return;
    }
    
    const packages = getPackages();
    const isEditing = document.getElementById('packageId').disabled;
    
    // Check if ID already exists (only for new packages)
    if (!isEditing && packages[packageId]) {
        alert('Package ID already exists. Please use a different ID.');
        return;
    }
    
    // Save package
    packages[packageId] = {
        id: packageId,
        name: packageName,
        description: packageDescription || `${packageName} - $${packagePrice}/month`,
        price: packagePrice,
        maxDevices: packageMaxDevices,
        extraDevicePrice: packageExtraDevicePrice,
        active: packageActive
    };
    
    savePackages(packages);
    closePackageModal();
    loadPackages();
    
    alert('Package saved successfully! The changes will be reflected in the order form.');
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
        alert('Package deleted successfully!');
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
    
    alert(`Transaction Details:\n\nID: ${txn.id}\nUser: ${txn.userEmail}\nPackage: ${txn.package}\nAmount: ${txn.amount}\nMethod: ${txn.method}\nStatus: ${txn.status}\nDate: ${formatDate(txn.date)}`);
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
    
    // Calculate financial metrics
    const totalRevenue = completedTransactions.reduce((sum, t) => {
        return sum + parseFloat(t.amount.replace('$', '').replace(',', ''));
    }, 0);
    
    const now = new Date();
    const thisMonth = completedTransactions.filter(t => {
        const txnDate = new Date(t.date);
        return txnDate.getMonth() === now.getMonth() && txnDate.getFullYear() === now.getFullYear();
    });
    const monthlyRevenue = thisMonth.reduce((sum, t) => {
        return sum + parseFloat(t.amount.replace('$', '').replace(',', ''));
    }, 0);
    
    const lastMonth = completedTransactions.filter(t => {
        const txnDate = new Date(t.date);
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
        return txnDate.getMonth() === lastMonthDate.getMonth() && txnDate.getFullYear() === lastMonthDate.getFullYear();
    });
    const lastMonthRevenue = lastMonth.reduce((sum, t) => {
        return sum + parseFloat(t.amount.replace('$', '').replace(',', ''));
    }, 0);
    
    const thisYear = completedTransactions.filter(t => {
        const txnDate = new Date(t.date);
        return txnDate.getFullYear() === now.getFullYear();
    });
    const yearlyRevenue = thisYear.reduce((sum, t) => {
        return sum + parseFloat(t.amount.replace('$', '').replace(',', ''));
    }, 0);
    
    // Calculate MRR (Monthly Recurring Revenue)
    const activeUsers = users.filter(u => u.isActive !== false);
    const mrr = activeUsers.reduce((sum, u) => {
        const packages = { basic: 99, professional: 249, enterprise: 499 };
        return sum + (packages[u.package] || 249);
    }, 0);
    
    // Calculate ARPU (Average Revenue Per User)
    const arpu = activeUsers.length > 0 ? totalRevenue / activeUsers.length : 0;
    
    // Calculate Churn Rate (simplified)
    const churned = users.filter(u => u.isActive === false || u.status === 'suspended').length;
    const churnRate = users.length > 0 ? (churned / users.length) * 100 : 0;
    
    // Update main stats
    document.getElementById('totalRevenueAnalytics').textContent = '$' + totalRevenue.toLocaleString();
    document.getElementById('monthlyRecurringRevenue').textContent = '$' + mrr.toLocaleString();
    document.getElementById('averageRevenuePerUser').textContent = '$' + Math.round(arpu).toLocaleString();
    document.getElementById('churnRate').textContent = churnRate.toFixed(1) + '%';
    
    // Calculate growth rates
    const revenueGrowth = lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;
    const mrrGrowth = 5.2; // Simulated
    const arpuGrowth = 3.1; // Simulated
    const churnChange = -0.5; // Simulated improvement
    
    document.getElementById('revenueChange').innerHTML = `<i class="fas fa-arrow-${revenueGrowth >= 0 ? 'up' : 'down'}"></i> ${Math.abs(revenueGrowth).toFixed(1)}%`;
    document.getElementById('mrrChange').innerHTML = `<i class="fas fa-arrow-up"></i> ${mrrGrowth.toFixed(1)}%`;
    document.getElementById('arpuChange').innerHTML = `<i class="fas fa-arrow-up"></i> ${arpuGrowth.toFixed(1)}%`;
    document.getElementById('churnChange').innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(churnChange).toFixed(1)}%`;
    
    // Update breakdown
    document.getElementById('breakdownTotalRevenue').textContent = '$' + totalRevenue.toLocaleString();
    document.getElementById('breakdownMonthlyRevenue').textContent = '$' + monthlyRevenue.toLocaleString();
    document.getElementById('breakdownLastMonthRevenue').textContent = '$' + lastMonthRevenue.toLocaleString();
    document.getElementById('breakdownYearlyRevenue').textContent = '$' + yearlyRevenue.toLocaleString();
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
    document.getElementById('breakdownCLV').textContent = '$' + Math.round(clv).toLocaleString();
    
    // Package performance
    const packageRevenue = { basic: 0, professional: 0, enterprise: 0 };
    const packageCounts = { basic: 0, professional: 0, enterprise: 0 };
    
    completedTransactions.forEach(txn => {
        const amount = parseFloat(txn.amount.replace('$', '').replace(',', ''));
        const pkg = txn.package || 'professional';
        if (packageRevenue[pkg] !== undefined) {
            packageRevenue[pkg] += amount;
            packageCounts[pkg]++;
        }
    });
    
    document.getElementById('breakdownBasicRevenue').textContent = '$' + packageRevenue.basic.toLocaleString();
    document.getElementById('breakdownProRevenue').textContent = '$' + packageRevenue.professional.toLocaleString();
    document.getElementById('breakdownEnterpriseRevenue').textContent = '$' + packageRevenue.enterprise.toLocaleString();
    
    const popularPackage = Object.keys(packageCounts).reduce((a, b) => packageCounts[a] > packageCounts[b] ? a : b, 'professional');
    document.getElementById('breakdownPopularPackage').textContent = popularPackage.charAt(0).toUpperCase() + popularPackage.slice(1);
    
    const avgPackageValue = Object.values(packageRevenue).reduce((a, b) => a + b, 0) / Math.max(Object.values(packageCounts).reduce((a, b) => a + b, 0), 1);
    document.getElementById('breakdownAvgPackageValue').textContent = '$' + Math.round(avgPackageValue).toLocaleString();
    
    // KPIs
    const conversionRate = 12.5; // Simulated
    const retentionRate = 95.2; // Simulated
    const ltvRatio = 3.2; // Simulated
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
        const dayRevenue = dayTransactions.reduce((sum, t) => {
            return sum + parseFloat(t.amount.replace('$', '').replace(',', ''));
        }, 0);
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
                            return '$' + value.toLocaleString();
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
            labels: ['Basic', 'Professional', 'Enterprise'],
            datasets: [{
                data: [packageRevenue.basic, packageRevenue.professional, packageRevenue.enterprise],
                backgroundColor: [
                    'rgba(37, 99, 235, 0.8)',
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
    
    const packageCounts = { basic: 0, professional: 0, enterprise: 0 };
    users.forEach(u => {
        const pkg = u.package || 'professional';
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
            labels: ['Basic', 'Professional', 'Enterprise'],
            datasets: [{
                label: 'Subscriptions',
                data: [packageCounts.basic, packageCounts.professional, packageCounts.enterprise],
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
                            return '$' + Math.round(value).toLocaleString();
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
    
    const totalRevenue = completedTransactions.reduce((sum, t) => {
        return sum + parseFloat(t.amount.replace('$', '').replace(',', ''));
    }, 0);
    
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
function loadAllDevices() {
    const devices = getAllDevices();
    const tableBody = document.getElementById('allDevicesTable');
    if (!tableBody) return;
    
    const users = getUsers();
    
    tableBody.innerHTML = devices.map(device => {
        // Try to find device owner
        const owner = users.find(u => u.id === device.ownerId || device.id.includes(u.id.substring(0, 4))) || { email: 'Unknown', company: 'Unknown' };
        const networks = device.networks || [];
        
        return `
            <tr>
                <td>${device.id}</td>
                <td>${owner.email}</td>
                <td>${device.name}</td>
                <td>${device.type || 'Standard'}</td>
                <td><span class="status-badge ${device.status}">${device.status}</span></td>
                <td>${networks.slice(0, 2).join(', ')}${networks.length > 2 ? '...' : ''}</td>
                <td>${formatTime(device.lastUpdate)}</td>
                <td>
                    <button class="btn-icon-small view" onclick="viewDeviceAdmin('${device.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getAllDevices() {
    // Get devices from all users
    const devicesKey = 'cargotrack_devices';
    const devices = localStorage.getItem(devicesKey);
    return devices ? JSON.parse(devices) : [];
}

function viewDeviceAdmin(deviceId) {
    const devices = getAllDevices();
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;
    
    alert(`Device Details:\n\nID: ${device.id}\nName: ${device.name}\nType: ${device.type}\nStatus: ${device.status}\nLocation: ${device.location}\nNetworks: ${(device.networks || []).join(', ')}`);
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
    let requests = JSON.parse(localStorage.getItem(requestsKey)) || [];
    
    // Generate sample requests if none exist
    if (requests.length === 0) {
        const users = getUsers().slice(0, 3);
        requests = users.map((user, index) => ({
            id: `PR-${String(index + 1).padStart(6, '0')}`,
            userId: user.id,
            userEmail: user.email,
            type: index === 0 ? 'data_export' : (index === 1 ? 'data_deletion' : 'data_access'),
            status: index === 0 ? 'pending' : (index === 1 ? 'completed' : 'processing'),
            requested: new Date(Date.now() - index * 2 * 24 * 3600000).toISOString()
        }));
        localStorage.setItem(requestsKey, JSON.stringify(requests));
    }
    
    const tableBody = document.getElementById('privacyRequestsTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = requests.map(req => `
        <tr>
            <td>${req.id}</td>
            <td>${req.userEmail}</td>
            <td>${req.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
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
}

function saveAppSettings() {
    const settings = {
        appName: document.getElementById('appName').value,
        supportEmail: document.getElementById('supportEmail').value,
        supportPhone: document.getElementById('supportPhone').value,
        maintenanceMode: document.getElementById('maintenanceMode').value
    };
    
    localStorage.setItem('app_settings', JSON.stringify(settings));
    alert('Application settings saved!');
}

function updateAdminAccount() {
    const currentAdmin = getCurrentAdmin();
    const newPassword = document.getElementById('adminNewPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    
    if (newPassword) {
        if (newPassword !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        
        const result = updateAdminPassword(currentAdmin.email, currentAdmin.password, newPassword);
        if (result.success) {
            alert('Password updated successfully!');
            document.getElementById('adminAccountForm').reset();
        } else {
            alert(result.message);
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

