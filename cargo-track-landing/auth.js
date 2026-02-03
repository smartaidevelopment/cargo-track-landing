// Authentication System
// Simple localStorage-based authentication for demo purposes

const AUTH_KEY = 'cargotrack_auth';
const USERS_KEY = 'cargotrack_users';

// Initialize users storage if it doesn't exist
function initUsersStorage() {
    if (!localStorage.getItem(USERS_KEY)) {
        localStorage.setItem(USERS_KEY, JSON.stringify([]));
    }
}

// Get all users
function getUsers() {
    initUsersStorage();
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
}

// Save users
function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Create a new user account
function createUser(userData) {
    const users = getUsers();
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === userData.email);
    if (existingUser) {
        return { success: false, message: 'User already exists' };
    }
    
    // Create user object
    const user = {
        id: Date.now().toString(),
        email: userData.email,
        password: userData.password, // In production, this should be hashed
        company: userData.company,
        phone: userData.phone,
        package: userData.package,
        devices: userData.devices || 1,
        createdAt: new Date().toISOString(),
        isActive: true
    };
    
    users.push(user);
    saveUsers(users);
    
    return { success: true, user };
}

// Authenticate user
function authenticateUser(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user && user.isActive) {
        // Set current session
        const session = {
            userId: user.id,
            email: user.email,
            company: user.company,
            package: user.package,
            loginTime: new Date().toISOString()
        };
        
        try {
            // Save session and verify it was saved
            localStorage.setItem(AUTH_KEY, JSON.stringify(session));
            
            // Verify the session was actually saved
            const savedSession = localStorage.getItem(AUTH_KEY);
            if (!savedSession || JSON.parse(savedSession).userId !== user.id) {
                return { success: false, message: 'Failed to save session. Please try again.' };
            }
            
            return { success: true, user };
        } catch (error) {
            console.error('Error saving session:', error);
            return { success: false, message: 'Failed to save session. Please check browser storage.' };
        }
    }
    
    return { success: false, message: 'Invalid email or password' };
}

// Get current user session
function getCurrentUser() {
    const authData = localStorage.getItem(AUTH_KEY);
    if (!authData) return null;
    
    try {
        const session = JSON.parse(authData);
        const users = getUsers();
        const user = users.find(u => u.id === session.userId);
        return user ? { ...user, ...session } : null;
    } catch (e) {
        return null;
    }
}

// Check if user is authenticated
function isAuthenticated() {
    return getCurrentUser() !== null;
}

// Logout user
function logout() {
    localStorage.removeItem(AUTH_KEY);
    window.location.replace('login.html');
}

// Require authentication (redirect to login if not authenticated)
function requireAuth() {
    if (!isAuthenticated()) {
        // Use replace to avoid adding to history (prevents back button issues)
        window.location.replace('login.html');
        return false;
    }
    return true;
}

// Update user settings
function updateUserSettings(userId, settings) {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        return { success: false, message: 'User not found' };
    }
    
    users[userIndex] = { ...users[userIndex], ...settings };
    saveUsers(users);
    
    // Update session if it's the current user
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
        const session = JSON.parse(localStorage.getItem(AUTH_KEY));
        session.company = settings.company || session.company;
        session.email = settings.email || session.email;
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    }
    
    return { success: true, user: users[userIndex] };
}

// Change user password
function changePassword(userId, currentPassword, newPassword) {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        return { success: false, message: 'User not found' };
    }
    
    if (users[userIndex].password !== currentPassword) {
        return { success: false, message: 'Current password is incorrect' };
    }
    
    users[userIndex].password = newPassword; // In production, hash this
    saveUsers(users);
    
    return { success: true };
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.getUsers = getUsers;
    window.createUser = createUser;
    window.authenticateUser = authenticateUser;
    window.getCurrentUser = getCurrentUser;
    window.isAuthenticated = isAuthenticated;
    window.logout = logout;
    window.requireAuth = requireAuth;
    window.updateUserSettings = updateUserSettings;
    window.changePassword = changePassword;
    window.saveUsers = saveUsers;
    window.initUsersStorage = initUsersStorage;
}

