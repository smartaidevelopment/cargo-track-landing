// Admin Authentication System

const ADMIN_KEY = 'cargotrack_admin';
const ADMIN_USERS_KEY = 'cargotrack_admin_users';
const DEFAULT_ADMIN = {
    email: 'admin@cargotrackpro.com',
    password: 'admin123', // Change this in production!
    role: 'super_admin',
    createdAt: new Date().toISOString(),
    lastLogin: null
};

// Initialize admin storage
function initAdminStorage() {
    try {
        if (!localStorage.getItem(ADMIN_USERS_KEY)) {
            const admins = [DEFAULT_ADMIN];
            localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(admins));
        }
    } catch (e) {
        console.error('Error initializing admin storage:', e);
    }
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
    initAdminStorage();
}

// Get all admin users
function getAdminUsers() {
    initAdminStorage();
    return JSON.parse(localStorage.getItem(ADMIN_USERS_KEY)) || [];
}

// Save admin users
function saveAdminUsers(admins) {
    localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(admins));
}

// Authenticate admin
function authenticateAdmin(email, password, twoFA = null) {
    const admins = getAdminUsers();
    const admin = admins.find(a => a.email === email && a.password === password);
    
    if (admin) {
        // In production, verify 2FA here
        if (twoFA && admin.twoFAEnabled) {
            // Verify 2FA code
            // For demo, we'll skip 2FA validation
        }
        
        // Set admin session
        const session = {
            adminId: admin.email,
            email: admin.email,
            role: admin.role,
            loginTime: new Date().toISOString(),
            ipAddress: '127.0.0.1' // In production, get real IP
        };
        localStorage.setItem(ADMIN_KEY, JSON.stringify(session));
        
        // Update last login
        admin.lastLogin = new Date().toISOString();
        saveAdminUsers(admins);
        
        // Log security event
        logSecurityEvent('admin_login', admin.email, 'success');
        
        return { success: true, admin };
    }
    
    // Log failed attempt
    logSecurityEvent('admin_login', email, 'failed');
    
    return { success: false, message: 'Invalid admin credentials' };
}

// Get current admin session
function getCurrentAdmin() {
    const adminData = localStorage.getItem(ADMIN_KEY);
    if (!adminData) return null;
    
    try {
        const session = JSON.parse(adminData);
        const admins = getAdminUsers();
        const admin = admins.find(a => a.email === session.email);
        return admin ? { ...admin, ...session } : null;
    } catch (e) {
        return null;
    }
}

// Check if admin is authenticated
function isAdminAuthenticated() {
    return getCurrentAdmin() !== null;
}

// Admin logout
function adminLogout() {
    const admin = getCurrentAdmin();
    if (admin) {
        logSecurityEvent('admin_logout', admin.email, 'success');
    }
    localStorage.removeItem(ADMIN_KEY);
    window.location.href = 'admin-login.html';
}

// Require admin authentication
function requireAdminAuth() {
    if (!isAdminAuthenticated()) {
        window.location.href = 'admin-login.html';
        return false;
    }
    return true;
}

// Security event logging
function logSecurityEvent(event, user, status, details = {}) {
    const auditLogKey = 'cargotrack_security_audit';
    let auditLog = JSON.parse(localStorage.getItem(auditLogKey)) || [];
    
    const logEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        event: event,
        user: user,
        status: status,
        ipAddress: details.ipAddress || '127.0.0.1',
        userAgent: navigator.userAgent,
        details: details
    };
    
    auditLog.unshift(logEntry);
    
    // Keep only last 1000 entries
    if (auditLog.length > 1000) {
        auditLog = auditLog.slice(0, 1000);
    }
    
    localStorage.setItem(auditLogKey, JSON.stringify(auditLog));
}

// Get security audit log
function getSecurityAuditLog(limit = 100) {
    const auditLogKey = 'cargotrack_security_audit';
    const auditLog = JSON.parse(localStorage.getItem(auditLogKey)) || [];
    return auditLog.slice(0, limit);
}

// Update admin password
function updateAdminPassword(adminEmail, currentPassword, newPassword) {
    const admins = getAdminUsers();
    const adminIndex = admins.findIndex(a => a.email === adminEmail);
    
    if (adminIndex === -1) {
        return { success: false, message: 'Admin not found' };
    }
    
    if (admins[adminIndex].password !== currentPassword) {
        logSecurityEvent('password_change', adminEmail, 'failed');
        return { success: false, message: 'Current password is incorrect' };
    }
    
    admins[adminIndex].password = newPassword; // In production, hash this
    admins[adminIndex].passwordChangedAt = new Date().toISOString();
    saveAdminUsers(admins);
    
    logSecurityEvent('password_change', adminEmail, 'success');
    
    return { success: true };
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.initAdminStorage = initAdminStorage;
    window.getAdminUsers = getAdminUsers;
    window.saveAdminUsers = saveAdminUsers;
    window.authenticateAdmin = authenticateAdmin;
    window.getCurrentAdmin = getCurrentAdmin;
    window.isAdminAuthenticated = isAdminAuthenticated;
    window.adminLogout = adminLogout;
    window.requireAdminAuth = requireAdminAuth;
    window.logSecurityEvent = logSecurityEvent;
    window.getSecurityAuditLog = getSecurityAuditLog;
    window.updateAdminPassword = updateAdminPassword;
}

