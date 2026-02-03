// Script to create a test user account
// Run this in browser console or as a standalone script

// Test user credentials
const TEST_USER = {
    email: 'test@cargotrackpro.com',
    password: 'test123456',
    company: 'Test Company',
    phone: '+1 (555) 123-4567',
    package: 'professional',
    devices: 5
};

// Create test user function
function createTestUser() {
    // Check if auth.js functions are available
    if (typeof createUser === 'undefined' || typeof authenticateUser === 'undefined') {
        console.error('Auth functions not loaded. Make sure auth.js is loaded first.');
        return false;
    }
    
    // Check if user already exists
    if (typeof getUsers === 'function') {
        const users = getUsers();
        const existingUser = users.find(u => u.email === TEST_USER.email);
        if (existingUser) {
            console.log('Test user already exists:', existingUser);
            console.log('Email:', TEST_USER.email);
            console.log('Password:', TEST_USER.password);
            return true;
        }
    }
    
    // Create the user
    const result = createUser({
        email: TEST_USER.email,
        password: TEST_USER.password,
        company: TEST_USER.company,
        phone: TEST_USER.phone,
        package: TEST_USER.package,
        devices: TEST_USER.devices
    });
    
    if (result.success) {
        console.log('✅ Test user created successfully!');
        console.log('Email:', TEST_USER.email);
        console.log('Password:', TEST_USER.password);
        console.log('Company:', TEST_USER.company);
        console.log('Package:', TEST_USER.package);
        return true;
    } else {
        console.error('Failed to create test user:', result.message);
        return false;
    }
}

// Auto-create on load (if running in browser)
if (typeof window !== 'undefined') {
    // Wait for auth.js to load
    if (typeof createUser !== 'undefined') {
        createTestUser();
    } else {
        window.addEventListener('load', () => {
            setTimeout(() => {
                if (typeof createUser !== 'undefined') {
                    createTestUser();
                }
            }, 1000);
        });
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createTestUser, TEST_USER };
}

