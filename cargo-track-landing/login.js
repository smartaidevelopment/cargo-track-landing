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
            window.location.replace('dashboard.html');
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
        
        // Small delay to ensure UI updates before auth check
        setTimeout(async () => {
            // Authenticate user
            const result = authenticateUser(email, password);
            
            if (result.success) {
                // Verify session was saved multiple times
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
                        } catch (e) {
                            console.error('Session parse error:', e);
                        }
                    }
                    // Small delay between checks
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                if (!sessionVerified) {
                    // Session not saved, try again
                    document.body.classList.remove('logging-in');
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonText;
                    loadingOverlay.remove();
                    errorMessage.textContent = 'Login failed. Please try again.';
                    errorMessage.style.display = 'block';
                    return;
                }
                
                // Update overlay message
                loadingOverlay.innerHTML = '<div style="text-align: center;"><div style="font-size: 2rem; margin-bottom: 1rem;">✅</div><div>Login successful! Redirecting...</div></div>';
                
                // Clear redirect flags before redirecting
                window.authRedirectInProgress = false;
                window.authCheckDone = false;
                window.authVerified = false;
                
                // Force a synchronous localStorage flush by reading it back
                // This ensures the data is committed before redirect
                try {
                    const verifyAuth = localStorage.getItem('cargotrack_auth');
                    if (!verifyAuth) {
                        throw new Error('Session not saved');
                    }
                } catch (e) {
                    console.error('Session verification failed:', e);
                    document.body.classList.remove('logging-in');
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonText;
                    loadingOverlay.remove();
                    errorMessage.textContent = 'Login failed. Please try again.';
                    errorMessage.style.display = 'block';
                    return;
                }
                
                // Session verified, redirect after a delay to ensure localStorage is synced
                setTimeout(() => {
                    // Use replace to avoid adding to history and prevent back button issues
                    window.location.replace('dashboard.html');
                }, 300); // Increased delay to ensure localStorage is fully synced across browser contexts
            } else {
                // Re-enable form and show error
                document.body.classList.remove('logging-in');
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
                loadingOverlay.remove();
                errorMessage.textContent = result.message || 'Invalid email or password';
                errorMessage.style.display = 'block';
            }
        }, 100);
    });
});

