// Login page functionality

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('loginError');
    
    // Clear any redirect flags when on login page
    window.authRedirectInProgress = false;
    window.authCheckDone = false;
    
    // Check if already logged in (with a small delay to prevent race conditions)
    setTimeout(() => {
        if (isAuthenticated()) {
            window.location.replace('dashboard.html?v=20260213e');
            return;
        }
    }, 50);
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        const submitButton = loginForm.querySelector('button[type="submit"]');
        
        // Clear previous errors
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
        
        // Disable form and show loading state
        submitButton.disabled = true;
        const originalButtonText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        
        // Add class to body to prevent interactions
        document.body.classList.add('logging-in');
        
        // Add loading overlay to prevent flicker
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loginLoadingOverlay';
        loadingOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.95); z-index: 9999; display: flex; align-items: center; justify-content: center;';
        loadingOverlay.innerHTML = '<div style="text-align: center;"><div style="font-size: 2rem; margin-bottom: 1rem;">📦</div><div>Signing in...</div></div>';
        document.body.appendChild(loadingOverlay);
        
        setTimeout(async () => {
            const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            const showError = (msg) => {
                document.body.classList.remove('logging-in');
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
                loadingOverlay.remove();
                errorMessage.textContent = msg;
                errorMessage.style.display = 'block';
            };

            const requestTokenWithRetry = async (role, loginEmail, loginPassword, maxAttempts = 3) => {
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    const tokenResult = await requestSessionToken(role, loginEmail, loginPassword);
                    if (tokenResult && tokenResult.success) {
                        return tokenResult;
                    }
                    if (attempt < maxAttempts) {
                        await wait(250 * attempt);
                    }
                }
                return { success: false, message: 'Unable to establish secure API session.' };
            };

            const serverLogin = async () => {
                try {
                    const resp = await fetch('/api/session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role: 'user', email, password })
                    });
                    if (!resp.ok) return null;
                    const data = await resp.json();
                    if (!data || !data.token) return null;
                    return data;
                } catch (e) {
                    return null;
                }
            };

            let result = authenticateUser(email, password);

            if (!result.success) {
                const serverData = await serverLogin();
                if (serverData && serverData.token && serverData.user) {
                    const u = serverData.user;
                    const users = getUsers();
                    if (!users.find(x => x.email === u.email)) {
                        users.push({
                            id: u.id,
                            email: u.email,
                            password: password,
                            company: u.company || '',
                            phone: u.phone || '',
                            package: u.package || '',
                            planTier: u.planTier || 'individual',
                            tenantId: u.tenantId || null,
                            role: 'user',
                            devices: u.devices || 1,
                            createdAt: u.createdAt || new Date().toISOString(),
                            isActive: true
                        });
                        saveUsers(users);
                    }
                    const session = {
                        userId: u.id,
                        email: u.email,
                        company: u.company || '',
                        package: u.package || '',
                        planTier: u.planTier || 'individual',
                        tenantId: u.tenantId || null,
                        loginTime: new Date().toISOString()
                    };
                    try { localStorage.setItem('cargotrack_auth', JSON.stringify(session)); } catch(e) {}
                    try { localStorage.setItem('cargotrack_session_token', serverData.token); } catch(e) {}
                    try { localStorage.setItem('cargotrack_session_role', 'user'); } catch(e) {}

                    if (window.AurionStorageSync && typeof window.AurionStorageSync.refresh === 'function') {
                        window.AurionStorageSync.refresh();
                    }

                    loadingOverlay.innerHTML = '<div style="text-align: center;"><div style="font-size: 2rem; margin-bottom: 1rem;">✅</div><div>Login successful! Redirecting...</div></div>';
                    window.authRedirectInProgress = false;
                    window.authCheckDone = false;
                    window.authVerified = false;
                    setTimeout(() => { window.location.replace('dashboard.html?v=20260213e'); }, 300);
                    return;
                }
                showError(result.message || 'Invalid email or password');
                return;
            }

            let sessionVerified = false;
            for (let i = 0; i < 5; i++) {
                const sessionCheck = localStorage.getItem('cargotrack_auth');
                if (sessionCheck) {
                    try {
                        const parsed = JSON.parse(sessionCheck);
                        if (parsed && parsed.userId && parsed.email === email) {
                            sessionVerified = true;
                            break;
                        }
                    } catch (e) {}
                }
                await wait(50);
            }

            if (!sessionVerified) {
                showError('Login failed. Please try again.');
                return;
            }

            if (typeof requestSessionToken === 'function') {
                const tokenResult = await requestTokenWithRetry('user', email, password, 3);
                if (!tokenResult.success) {
                    localStorage.removeItem('cargotrack_session_token');
                    localStorage.removeItem('cargotrack_session_role');
                    localStorage.removeItem('cargotrack_auth');
                    showError('Secure session setup failed. Please try again.');
                    return;
                } else if (window.AurionStorageSync && typeof window.AurionStorageSync.refresh === 'function') {
                    window.AurionStorageSync.refresh();
                }
            }

            loadingOverlay.innerHTML = '<div style="text-align: center;"><div style="font-size: 2rem; margin-bottom: 1rem;">✅</div><div>Login successful! Redirecting...</div></div>';
            window.authRedirectInProgress = false;
            window.authCheckDone = false;
            window.authVerified = false;

            try {
                const verifyAuth = localStorage.getItem('cargotrack_auth');
                if (!verifyAuth) throw new Error('Session not saved');
            } catch (e) {
                showError('Login failed. Please try again.');
                return;
            }

            setTimeout(() => {
                window.location.replace('dashboard.html?v=20260213e');
            }, 300);
        }, 100);
    });
});

