// Admin Authentication System

const ADMIN_KEY = 'cargotrack_admin';

// Authenticate admin via server-side /api/session endpoint
async function authenticateAdmin(email, password) {
    try {
        const response = await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'admin', email, password })
        });

        if (response.status === 429) {
            return { success: false, message: 'Too many login attempts. Try again later.' };
        }

        const data = await response.json();

        if (!response.ok || !data.token) {
            return { success: false, message: data.error || 'Invalid admin credentials' };
        }

        // Store session token
        try { localStorage.setItem('cargotrack_session_token', data.token); } catch (_) {}
        try { localStorage.setItem('cargotrack_session_role', 'admin'); } catch (_) {}

        // Store admin session for client-side checks
        const session = {
            adminId: email,
            email: email,
            role: 'admin',
            loginTime: new Date().toISOString()
        };
        try { localStorage.setItem(ADMIN_KEY, JSON.stringify(session)); } catch (_) {}

        logSecurityEvent('admin_login', email, 'success');

        if (window.AurionStorageSync && typeof window.AurionStorageSync.refresh === 'function') {
            window.AurionStorageSync.refresh();
        }

        return { success: true, admin: session };
    } catch (error) {
        console.error('Admin auth request failed:', error);
        return { success: false, message: 'Network error. Please try again.' };
    }
}

// Get current admin session
function getCurrentAdmin() {
    const adminData = localStorage.getItem(ADMIN_KEY);
    if (!adminData) return null;
    try {
        return JSON.parse(adminData);
    } catch (e) {
        return null;
    }
}

// Check if admin is authenticated (validates both local session and token)
function isAdminAuthenticated() {
    if (!getCurrentAdmin()) return false;
    const token = localStorage.getItem('cargotrack_session_token');
    if (!token) return false;
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return false;
        const body = parts[0].replace(/-/g, '+').replace(/_/g, '/');
        const pad = body.length % 4 ? '='.repeat(4 - body.length % 4) : '';
        const payload = JSON.parse(atob(body + pad));
        if (payload.exp && Date.now() > payload.exp) {
            localStorage.removeItem('cargotrack_session_token');
            localStorage.removeItem('cargotrack_session_role');
            localStorage.removeItem(ADMIN_KEY);
            return false;
        }
        return payload.role === 'admin' || payload.role === 'reseller';
    } catch (_) {
        return false;
    }
}

// Admin logout
function adminLogout() {
    const admin = getCurrentAdmin();
    if (admin) {
        logSecurityEvent('admin_logout', admin.email, 'success');
    }
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem('cargotrack_session_token');
    localStorage.removeItem('cargotrack_session_role');
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
    let auditLog = [];
    try { auditLog = JSON.parse(localStorage.getItem(auditLogKey)) || []; } catch (_) {}

    const logEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        event: event,
        user: user,
        status: status,
        userAgent: navigator.userAgent,
        details: details
    };

    auditLog.unshift(logEntry);
    if (auditLog.length > 1000) {
        auditLog = auditLog.slice(0, 1000);
    }

    try { localStorage.setItem(auditLogKey, JSON.stringify(auditLog)); } catch (_) {}
}

// Get security audit log
function getSecurityAuditLog(limit = 100) {
    const auditLogKey = 'cargotrack_security_audit';
    try {
        const auditLog = JSON.parse(localStorage.getItem(auditLogKey)) || [];
        return auditLog.slice(0, limit);
    } catch (_) {
        return [];
    }
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.authenticateAdmin = authenticateAdmin;
    window.getCurrentAdmin = getCurrentAdmin;
    window.isAdminAuthenticated = isAdminAuthenticated;
    window.adminLogout = adminLogout;
    window.requireAdminAuth = requireAdminAuth;
    window.logSecurityEvent = logSecurityEvent;
    window.getSecurityAuditLog = getSecurityAuditLog;
}
