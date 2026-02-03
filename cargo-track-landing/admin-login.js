// Admin login page functionality

document.addEventListener('DOMContentLoaded', function() {
    // Initialize admin storage first
    if (typeof initAdminStorage === 'function') {
        initAdminStorage();
    }
    
    const adminLoginForm = document.getElementById('adminLoginForm');
    const errorMessage = document.getElementById('adminLoginError');
    
    if (!adminLoginForm) {
        console.error('Admin login form not found');
        return;
    }
    
    // Check if already logged in
    if (typeof isAdminAuthenticated === 'function' && isAdminAuthenticated()) {
        window.location.href = 'admin.html';
        return;
    }
    
    adminLoginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const twoFA = document.getElementById('admin2FA') ? document.getElementById('admin2FA').value : '';
        
        // Validate inputs
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }
        
        // Clear previous errors
        if (errorMessage) {
            errorMessage.style.display = 'none';
            errorMessage.textContent = '';
        }
        
        // Authenticate admin
        if (typeof authenticateAdmin !== 'function') {
            showError('Authentication system not loaded. Please refresh the page.');
            console.error('authenticateAdmin function not found');
            return;
        }
        
        try {
            const result = authenticateAdmin(email, password, twoFA);
            
            if (result && result.success) {
                // Redirect to admin dashboard
                window.location.href = 'admin.html';
            } else {
                // Show error message
                const errorMsg = result ? (result.message || 'Invalid admin credentials') : 'Invalid admin credentials';
                showError(errorMsg);
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('An error occurred during login. Please try again.');
        }
    });
    
    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        } else {
            alert(message);
        }
    }
});

