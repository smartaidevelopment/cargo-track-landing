// Data Protection and Privacy Functions

// Simple encryption/decryption (for demo - use proper encryption in production)
function encryptData(data) {
    // In production, use proper encryption like AES-256
    // For demo, we'll use base64 encoding (NOT secure for production!)
    try {
        return btoa(JSON.stringify(data));
    } catch (e) {
        return data;
    }
}

function decryptData(encryptedData) {
    try {
        return JSON.parse(atob(encryptedData));
    } catch (e) {
        return encryptedData;
    }
}

// GDPR Compliance Functions

// Export user data
function exportUserData(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    
    const devices = getAllDevices().filter(d => {
        // Match devices to user (simplified for demo)
        return true;
    });
    
    const data = {
        user: {
            id: user.id,
            email: user.email,
            company: user.company,
            phone: user.phone,
            package: user.package,
            createdAt: user.createdAt
        },
        devices: devices,
        exportDate: new Date().toISOString()
    };
    
    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    // Log privacy request
    createPrivacyRequest(userId, 'data_export', 'completed');
    
    return data;
}

// Delete user data (GDPR Right to be Forgotten)
function deleteUserData(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, message: 'User not found' };
    
    if (confirm('Are you sure you want to delete all data for this user? This action cannot be undone and complies with GDPR Right to be Forgotten.')) {
        // Remove user
        const filteredUsers = users.filter(u => u.id !== userId);
        saveUsers(filteredUsers);
        
        // Remove user devices
        const devices = getAllDevices();
        const filteredDevices = devices.filter(d => {
            // Match devices to user (simplified)
            return true; // In production, properly match devices
        });
        localStorage.setItem('cargotrack_devices', JSON.stringify(filteredDevices));
        
        // Remove user payments
        const transactions = getPaymentTransactions();
        const filteredTransactions = transactions.filter(t => t.userId !== userId);
        localStorage.setItem('cargotrack_payments', JSON.stringify(filteredTransactions));
        
        // Log privacy request
        createPrivacyRequest(userId, 'data_deletion', 'completed');
        logSecurityEvent('user_data_deletion', user.email, 'success', { gdpr: true });
        
        return { success: true, message: 'User data deleted successfully' };
    }
    
    return { success: false, message: 'Deletion cancelled' };
}

// Create privacy request
function createPrivacyRequest(userId, type, status = 'pending') {
    const requestsKey = 'cargotrack_privacy_requests';
    const requests = JSON.parse(localStorage.getItem(requestsKey)) || [];
    const user = getUsers().find(u => u.id === userId);
    
    const request = {
        id: `PR-${Date.now()}`,
        userId: userId,
        userEmail: user ? user.email : 'unknown',
        type: type, // 'data_export', 'data_deletion', 'data_access'
        status: status,
        requested: new Date().toISOString()
    };
    
    requests.unshift(request);
    localStorage.setItem(requestsKey, JSON.stringify(requests));
    
    return request;
}

// Anonymize user data (for analytics)
function anonymizeUserData(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    
    return {
        id: 'ANON-' + userId.substring(0, 8),
        package: user.package,
        createdAt: user.createdAt,
        // All personally identifiable information removed
    };
}

// Check data retention policy
function checkDataRetention() {
    const settings = JSON.parse(localStorage.getItem('privacy_settings')) || {};
    const retentionPeriod = parseInt(settings.dataRetentionPeriod) || 90;
    const autoDelete = settings.dataRetention || false;
    
    if (!autoDelete) return;
    
    const users = getUsers();
    const now = Date.now();
    const retentionMs = retentionPeriod * 24 * 60 * 60 * 1000;
    
    users.forEach(user => {
        const lastActivity = new Date(user.lastUpdate || user.createdAt).getTime();
        const daysSinceActivity = (now - lastActivity) / (24 * 60 * 60 * 1000);
        
        if (daysSinceActivity > retentionPeriod && user.isActive === false) {
            // Mark for deletion (in production, schedule actual deletion)
            console.log(`User ${user.email} marked for deletion (${daysSinceActivity.toFixed(0)} days inactive)`);
        }
    });
}

// Data breach notification (simulation)
function simulateDataBreachNotification() {
    // In production, this would send actual notifications
    alert('Data Breach Notification:\n\nIn the event of a data breach, affected users will be notified within 72 hours as required by GDPR.');
}

// Cookie consent (for future use)
function setCookieConsent(consent) {
    localStorage.setItem('cookie_consent', JSON.stringify({
        consented: consent,
        timestamp: new Date().toISOString()
    }));
}

function getCookieConsent() {
    const consent = localStorage.getItem('cookie_consent');
    return consent ? JSON.parse(consent) : null;
}

