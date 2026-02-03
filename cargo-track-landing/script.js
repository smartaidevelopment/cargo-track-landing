// Package pricing data - Load from storage or use defaults
const PACKAGES_STORAGE_KEY = 'cargotrack_packages';

function loadPackagesFromStorage() {
    const stored = localStorage.getItem(PACKAGES_STORAGE_KEY);
    if (stored) {
        const packagesObj = JSON.parse(stored);
        // Convert to format expected by the rest of the code
        const packages = {};
        Object.keys(packagesObj).forEach(key => {
            const pkg = packagesObj[key];
            packages[key] = {
                name: pkg.name,
                price: pkg.price,
                maxDevices: pkg.maxDevices === 0 ? Infinity : pkg.maxDevices,
                extraDevicePrice: pkg.extraDevicePrice || 10,
                description: pkg.description || `${pkg.name} - $${pkg.price}/month`
            };
        });
        return packages;
    }
    // Default packages if none stored
    return {
        basic: {
            name: 'Basic',
            price: 99,
            maxDevices: 10,
            extraDevicePrice: 10,
            description: 'Basic - $99/month'
        },
        professional: {
            name: 'Professional',
            price: 249,
            maxDevices: 50,
            extraDevicePrice: 10,
            description: 'Professional - $249/month'
        },
        enterprise: {
            name: 'Enterprise',
            price: 499,
            maxDevices: Infinity,
            extraDevicePrice: 0,
            description: 'Enterprise - $499/month'
        }
    };
}

// Load packages
let packages = loadPackagesFromStorage();

// Function to update packages (called when admin changes packages)
window.updatePackagesInOrderForm = function(newPackages) {
    packages = {};
    Object.keys(newPackages).forEach(key => {
        const pkg = newPackages[key];
        packages[key] = {
            name: pkg.name,
            price: pkg.price,
            maxDevices: pkg.maxDevices === 0 ? Infinity : pkg.maxDevices,
            extraDevicePrice: pkg.extraDevicePrice || 10,
            description: pkg.description || `${pkg.name} - $${pkg.price}/month`
        };
    });
    // Update package select dropdown
    updatePackageSelect();
    // Update order summary
    updateOrderSummary();
};

// Update package select dropdown
function updatePackageSelect() {
    const packageSelect = document.getElementById('package');
    if (!packageSelect) return;
    
    // Clear existing options except the first one
    while (packageSelect.options.length > 1) {
        packageSelect.remove(1);
    }
    
    // Add packages
    Object.keys(packages).forEach(key => {
        const pkg = packages[key];
        if (pkg.active !== false) { // Only show active packages
            const option = document.createElement('option');
            option.value = key;
            option.textContent = pkg.description;
            packageSelect.appendChild(option);
        }
    });
}

// Mobile menu toggle - Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
});

// Package selection handlers - Initialize when DOM is ready
let packageSelect, devicesInput;

// Update package selection buttons dynamically
function updatePackageSelectionButtons() {
    const packageCards = document.querySelectorAll('.package-card');
    packageCards.forEach(card => {
        const packageType = card.getAttribute('data-package');
        if (packages[packageType]) {
            const pkg = packages[packageType];
            // Update price display
            const priceAmount = card.querySelector('.package-price .amount');
            if (priceAmount) {
                priceAmount.textContent = pkg.price;
            }
        }
    });
}

// Make selectPackage globally available
window.selectPackage = function(packageType) {
    console.log('=== selectPackage called ===');
    console.log('Package type:', packageType);
    
    if (!packageType) {
        console.error('No package type provided');
        alert('Error: No package selected. Please try again.');
        return false;
    }
    
    // Get elements fresh (don't rely on global variables)
    const packageSelectEl = document.getElementById('package');
    const devicesInputEl = document.getElementById('devices');
    
    if (!packageSelectEl) {
        console.error('Package select element not found');
        alert('Error: Package selection form not found. Please refresh the page.');
        return false;
    }
    
    if (!packages[packageType]) {
        console.error('Package not found:', packageType);
        console.log('Available packages:', Object.keys(packages));
        alert('This package is not available. Please select another package.');
        return false;
    }
    
    // Update global variables
    packageSelect = packageSelectEl;
    if (devicesInputEl) {
        devicesInput = devicesInputEl;
    }
    
    // Set the package value
    packageSelectEl.value = packageType;
    console.log('Package selected in dropdown:', packageType, 'Value set to:', packageSelectEl.value);
    
    // Trigger change event to ensure all listeners fire
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    packageSelectEl.dispatchEvent(changeEvent);
    console.log('Change event dispatched');
    
    // Force update order summary immediately (multiple times to ensure it works)
    updateOrderSummary();
    setTimeout(() => {
        updateOrderSummary();
        console.log('Order summary updated (delayed)');
    }, 50);
    setTimeout(() => {
        updateOrderSummary();
        console.log('Order summary updated (second delay)');
    }, 200);
    
    // Scroll to order section
    const orderSection = document.getElementById('order');
    if (orderSection) {
        orderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log('Scrolled to order section');
    } else {
        console.warn('Order section not found');
    }
    
    // Visual feedback - highlight the selected card
    document.querySelectorAll('.package-card').forEach(card => {
        card.style.borderColor = '';
        card.style.borderWidth = '';
        card.style.transform = '';
    });
    
    const selectedCard = document.querySelector(`.package-card[data-package="${packageType}"]`);
    if (selectedCard) {
        selectedCard.style.borderColor = 'var(--primary-color)';
        selectedCard.style.borderWidth = '3px';
        selectedCard.style.transform = 'scale(1.02)';
        console.log('Visual feedback applied to card');
    } else {
        console.warn('Selected card not found:', packageType);
    }
    
    console.log('=== selectPackage complete ===');
    return false; // Prevent default behavior
};

function initPackageSelection() {
    packageSelect = document.getElementById('package');
    devicesInput = document.getElementById('devices');
    
    console.log('=== Initializing package selection ===');
    console.log('Package select element:', packageSelect);
    console.log('Devices input element:', devicesInput);
    console.log('Available packages:', Object.keys(packages));
    
    if (!packageSelect || !devicesInput) {
        console.error('Package select or devices input not found');
        // Retry after a short delay
        setTimeout(() => {
            console.log('Retrying package selection initialization...');
            initPackageSelection();
        }, 500);
        return;
    }
    
    // Get all package cards
    const packageCards = document.querySelectorAll('.package-card');
    console.log('Found package cards:', packageCards.length);
    
    // Get all select buttons BEFORE any cloning
    const selectPackageButtons = document.querySelectorAll('.select-package');
    console.log('Found select buttons:', selectPackageButtons.length);
    
    // Add click handlers to package cards (entire card is clickable)
    packageCards.forEach((card, index) => {
        const packageType = card.getAttribute('data-package');
        if (!packageType) {
            console.warn('Package card missing data-package attribute at index', index);
            return;
        }
        
        // Check if already initialized (prevent duplicate listeners)
        if (card.dataset.initialized === 'true') {
            console.log('Card already initialized, skipping:', packageType);
            return;
        }
        
        // Mark as initialized
        card.dataset.initialized = 'true';
        
        // Add click handler to the card
        card.addEventListener('click', function(e) {
            // Don't trigger if clicking the button (button has its own handler)
            if (e.target.closest('.select-package')) {
                console.log('Click on button, ignoring card click');
                return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Package card clicked:', packageType, e);
            selectPackage(packageType);
        });
        
        // Add cursor pointer style
        card.style.cursor = 'pointer';
        
        console.log('✓ Added click handler to card:', packageType);
    });
    
    // Add click handlers to package selection buttons
    selectPackageButtons.forEach((button, index) => {
        const packageType = button.getAttribute('data-package');
        if (!packageType) {
            console.warn('Button missing data-package attribute at index', index);
            return;
        }
        
        // Check if already initialized
        if (button.dataset.initialized === 'true') {
            console.log('Button already initialized, skipping:', packageType);
            return;
        }
        
        // Mark as initialized
        button.dataset.initialized = 'true';
        
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Package button clicked:', packageType, e);
            selectPackage(packageType);
            
            // Visual feedback on button
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
        
        console.log('✓ Added click handler to button:', packageType);
    });
    
    console.log('=== Package selection initialization complete ===');
    
    // Update order summary when package or devices change
    if (packageSelect) {
        packageSelect.addEventListener('change', function() {
            console.log('Package dropdown changed:', this.value);
            updateOrderSummary();
        });
    }
    if (devicesInput) {
        devicesInput.addEventListener('input', function() {
            console.log('Devices input changed:', this.value);
            updateOrderSummary();
        });
    }
    
    console.log('Package selection initialized successfully');
}

function updateOrderSummary() {
    console.log('=== updateOrderSummary called ===');
    
    // Get elements fresh each time (don't rely on global variables)
    const packageSelectEl = document.getElementById('package');
    const devicesInputEl = document.getElementById('devices');
    
    if (!packageSelectEl) {
        console.warn('Package select element not found');
        return;
    }
    
    if (!devicesInputEl) {
        console.warn('Devices input element not found');
        return;
    }
    
    const selectedPackage = packageSelectEl.value;
    const devices = parseInt(devicesInputEl.value) || 1;
    
    console.log('Order summary inputs:', { selectedPackage, devices });
    console.log('Available packages:', Object.keys(packages));
    
    const summaryPackage = document.getElementById('summaryPackage');
    const summaryDevices = document.getElementById('summaryDevices');
    const summaryMonthly = document.getElementById('summaryMonthly');
    const summaryTotal = document.getElementById('summaryTotal');
    
    if (!summaryPackage || !summaryDevices || !summaryMonthly || !summaryTotal) {
        console.error('Summary elements not found:', {
            summaryPackage: !!summaryPackage,
            summaryDevices: !!summaryDevices,
            summaryMonthly: !!summaryMonthly,
            summaryTotal: !!summaryTotal
        });
        return;
    }
    
    if (selectedPackage && packages[selectedPackage]) {
        const packageData = packages[selectedPackage];
        console.log('Package data found:', packageData);
        
        // Calculate cost: base price if within limit, otherwise charge per device
        let monthlyCost;
        const extraDevicePrice = packageData.extraDevicePrice || 10;
        
        if (devices <= packageData.maxDevices) {
            // Within package limit - use base price only
            monthlyCost = packageData.price;
        } else {
            // Exceeds package limit - charge base price + extra devices
            const extraDevices = devices - packageData.maxDevices;
            const extraCost = extraDevices * extraDevicePrice;
            monthlyCost = packageData.price + extraCost;
        }
        
        console.log('Calculated monthly cost:', monthlyCost);
        
        // Update the summary elements
        summaryPackage.textContent = packageData.name;
        summaryDevices.textContent = devices.toString();
        summaryMonthly.textContent = `$${monthlyCost.toLocaleString()}`;
        summaryTotal.textContent = `$${monthlyCost.toLocaleString()}`;
        
        console.log('Order summary updated:', {
            package: packageData.name,
            devices: devices,
            monthly: `$${monthlyCost.toLocaleString()}`,
            total: `$${monthlyCost.toLocaleString()}`
        });
    } else {
        console.log('No package selected or package not found. Selected:', selectedPackage);
        summaryPackage.textContent = '-';
        summaryDevices.textContent = '-';
        summaryMonthly.textContent = '-';
        summaryTotal.textContent = '-';
    }
    
    console.log('=== updateOrderSummary complete ===');
}

// Payment method toggle
const paymentRadios = document.querySelectorAll('input[name="payment"]');
const paymentDetails = document.getElementById('paymentDetails');

paymentRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'credit') {
            paymentDetails.style.display = 'block';
            // Make credit card fields required
            document.getElementById('cardNumber').required = true;
            document.getElementById('expiry').required = true;
            document.getElementById('cvv').required = true;
        } else {
            paymentDetails.style.display = 'none';
            // Remove required from credit card fields
            document.getElementById('cardNumber').required = false;
            document.getElementById('expiry').required = false;
            document.getElementById('cvv').required = false;
        }
    });
});

// Format card number input
const cardNumberInput = document.getElementById('cardNumber');
if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s/g, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
        e.target.value = formattedValue;
    });
}

// Format expiry date input
const expiryInput = document.getElementById('expiry');
if (expiryInput) {
    expiryInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value;
    });
}

// Format CVV input (numbers only)
const cvvInput = document.getElementById('cvv');
if (cvvInput) {
    cvvInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });
}

// Form submission
document.addEventListener('DOMContentLoaded', function() {
    const orderForm = document.getElementById('orderForm');
    
    if (!orderForm) {
        console.error('Order form not found!');
        return;
    }
    
    console.log('Order form found, adding submit listener...');
    
    orderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Form submitted!');
        
        // Get form data
        const formData = new FormData(orderForm);
        const orderData = {
            package: formData.get('package'),
            devices: formData.get('devices'),
            company: formData.get('company'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: formData.get('address'),
            payment: formData.get('payment'),
            cardNumber: formData.get('cardNumber'),
            expiry: formData.get('expiry'),
            cvv: formData.get('cvv')
        };
        
        console.log('Form data:', orderData);
        
        // Validate form
        if (!orderData.package) {
            alert('Please select a package');
            return;
        }
        
        if (!orderData.company || !orderData.company.trim()) {
            alert('Please enter your company name');
            return;
        }
        
        if (!orderData.email || !orderData.email.trim()) {
            alert('Please enter your email address');
            return;
        }
        
        if (!orderData.phone || !orderData.phone.trim()) {
            alert('Please enter your phone number');
            return;
        }
        
        if (!orderData.address || !orderData.address.trim()) {
            alert('Please enter your shipping address');
            return;
        }
        
        if (orderData.payment === 'credit') {
            if (!orderData.cardNumber || !orderData.cardNumber.trim()) {
                alert('Please enter your credit card number');
                return;
            }
            if (!orderData.expiry || !orderData.expiry.trim()) {
                alert('Please enter card expiry date');
                return;
            }
            if (!orderData.cvv || !orderData.cvv.trim()) {
                alert('Please enter CVV');
                return;
            }
        }
        
        // Get password
        const password = formData.get('password') || document.getElementById('password').value;
        
        if (!password || password.length < 6) {
            alert('Please create a password with at least 6 characters');
            return;
        }
        
        // Check if auth functions are available
        if (typeof createUser !== 'function') {
            console.error('createUser function not found! Make sure auth.js is loaded.');
            alert('Error: Authentication system not loaded. Please refresh the page.');
            return;
        }
        
        if (typeof authenticateUser !== 'function') {
            console.error('authenticateUser function not found! Make sure auth.js is loaded.');
            alert('Error: Authentication system not loaded. Please refresh the page.');
            return;
        }
        
        // Simulate order processing
        const submitButton = orderForm.querySelector('button[type="submit"]');
        if (!submitButton) {
            console.error('Submit button not found!');
            alert('Error: Submit button not found. Please refresh the page.');
            return;
        }
        
        submitButton.textContent = 'Processing...';
        submitButton.disabled = true;
        
        // Add visual feedback
        const formWrapper = document.querySelector('.order-form-wrapper');
        if (formWrapper) {
            formWrapper.style.opacity = '0.7';
            formWrapper.style.pointerEvents = 'none';
        }
        
        // Simulate API call
        setTimeout(() => {
            try {
                // Create user account
                const userResult = createUser({
                    email: orderData.email,
                    password: password,
                    company: orderData.company,
                    phone: orderData.phone,
                    package: orderData.package,
                    devices: parseInt(orderData.devices) || 1
                });
                
                if (userResult.success) {
                    // Send welcome email
                    const sendWelcomeEmailFn = window.sendWelcomeEmail || (typeof sendWelcomeEmail !== 'undefined' ? sendWelcomeEmail : null);
                    if (typeof sendWelcomeEmailFn === 'function') {
                        // Get users from auth.js - use the function directly, not window.getUsers
                        try {
                            const users = getUsers();
                            const newUser = users.find(u => u.email === orderData.email);
                            if (newUser) {
                                console.log('Sending welcome email to:', newUser.email);
                                sendWelcomeEmailFn(newUser);
                                console.log('Welcome email sent successfully');
                            } else {
                                console.warn('New user not found in users list after creation');
                            }
                        } catch (emailError) {
                            console.error('Error sending welcome email:', emailError);
                        }
                    } else {
                        console.warn('sendWelcomeEmail function not available. Available functions:', {
                            windowSendWelcomeEmail: typeof window.sendWelcomeEmail,
                            sendWelcomeEmail: typeof sendWelcomeEmail
                        });
                    }
                    
                    // Auto-login the user
                    const authResult = authenticateUser(orderData.email, password);
                    
                    if (authResult.success) {
                        // Calculate final price
                        const packageData = packages[orderData.package];
                        const deviceCount = parseInt(orderData.devices) || 1;
                        const extraDevicePrice = packageData.extraDevicePrice || 10;
                        let finalPrice;
                        if (deviceCount <= packageData.maxDevices) {
                            finalPrice = packageData.price;
                        } else {
                            const extraDevices = deviceCount - packageData.maxDevices;
                            finalPrice = packageData.price + (extraDevices * extraDevicePrice);
                        }
                        
                        // Redirect to dashboard
                        alert(`Order placed successfully!\n\nPackage: ${packageData.name}\nDevices: ${orderData.devices}\nTotal: $${finalPrice.toLocaleString()}\n\nA welcome email has been sent to ${orderData.email}\n\nRedirecting to your dashboard...`);
                        window.location.replace('dashboard.html');
                    } else {
                        alert('Account created but login failed. Please login manually.');
                        window.location.replace('login.html');
                    }
                } else {
                    // User might already exist, try to login
                    const authResult = authenticateUser(orderData.email, password);
                    if (authResult.success) {
                        alert(`Welcome back! Redirecting to your dashboard...`);
                        window.location.replace('dashboard.html');
                    } else {
                        alert(userResult.message || 'Failed to create account. Please try again.');
                        submitButton.textContent = 'Place Order';
                        submitButton.disabled = false;
                        if (formWrapper) {
                            formWrapper.style.opacity = '1';
                            formWrapper.style.pointerEvents = 'auto';
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing order:', error);
                alert('An error occurred: ' + error.message + '\n\nPlease check the browser console for details.');
                submitButton.textContent = 'Place Order';
                submitButton.disabled = false;
                if (formWrapper) {
                    formWrapper.style.opacity = '1';
                    formWrapper.style.pointerEvents = 'auto';
                }
            }
        }, 1500);
    });
    
    // Also add click handler as fallback
    const submitButton = orderForm.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.addEventListener('click', function(e) {
            // Let the form submit handler do its work
            console.log('Submit button clicked');
        });
    }
    
    console.log('Order form submit listener added successfully');
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // Close mobile menu if open
            const navMenu = document.querySelector('.nav-menu');
            if (navMenu && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
            }
        }
    });
});

// Add active class to navigation on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;
    
    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-menu a[href="#${sectionId}"]`);
        
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            document.querySelectorAll('.nav-menu a').forEach(link => {
                link.classList.remove('active');
            });
            if (navLink) {
                navLink.classList.add('active');
            }
        }
    });
});

// Initialize package selection - Simple and reliable approach
function initializePackageSelection() {
    console.log('=== Initializing package selection ===');
    
    // Get elements fresh
    const packageSelectEl = document.getElementById('package');
    const devicesInputEl = document.getElementById('devices');
    
    if (!packageSelectEl || !devicesInputEl) {
        console.error('Form elements not found, retrying...');
        setTimeout(initializePackageSelection, 500);
        return;
    }
    
    // Set global variables for compatibility
    packageSelect = packageSelectEl;
    devicesInput = devicesInputEl;
    
    // Use event delegation on the packages section WITHOUT cloning (preserves inline handlers)
    const packagesSection = document.getElementById('packages');
    if (packagesSection) {
        // Add event delegation for package cards and buttons (don't clone, just add listener)
        packagesSection.addEventListener('click', function(e) {
            // Check if clicked on a select button
            const button = e.target.closest('.select-package');
            if (button) {
                const packageType = button.getAttribute('data-package');
                if (packageType) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Button clicked via delegation:', packageType);
                    selectPackage(packageType);
                    
                    // Visual feedback
                    button.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        button.style.transform = '';
                    }, 150);
                    return false;
                }
            }
            
            // Check if clicked on a package card (but not on button)
            const card = e.target.closest('.package-card');
            if (card && !e.target.closest('.select-package')) {
                const packageType = card.getAttribute('data-package');
                if (packageType) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Card clicked via delegation:', packageType);
                    selectPackage(packageType);
                    return false;
                }
            }
        });
        
        // Ensure all cards have pointer cursor
        const cards = packagesSection.querySelectorAll('.package-card');
        cards.forEach(card => {
            card.style.cursor = 'pointer';
        });
        
        // Ensure all buttons have pointer cursor
        const buttons = packagesSection.querySelectorAll('.select-package');
        buttons.forEach(button => {
            button.style.cursor = 'pointer';
        });
        
        console.log('✓ Event delegation set up for', cards.length, 'cards and', buttons.length, 'buttons');
    } else {
        console.error('Packages section not found');
    }
    
    // Set up form change listeners (simple approach, no cloning needed)
    if (packageSelectEl) {
        packageSelectEl.addEventListener('change', function() {
            console.log('Package dropdown changed:', this.value);
            updateOrderSummary();
        });
    }
    
    if (devicesInputEl) {
        devicesInputEl.addEventListener('input', function() {
            console.log('Devices input changed:', this.value);
            updateOrderSummary();
        });
        devicesInputEl.addEventListener('change', function() {
            console.log('Devices input changed (change event):', this.value);
            updateOrderSummary();
        });
    }
    
    // Update package dropdown
    updatePackageSelect();
    
    // Update order summary
    updateOrderSummary();
    
    console.log('=== Package selection initialization complete ===');
}

// Initialize when DOM is ready
function initLandingPage() {
    console.log('=== Initializing landing page ===');
    
    // Initialize package selection
    initializePackageSelection();
    
    // Update package buttons
    updatePackageSelectionButtons();
    
    console.log('=== Landing page initialization complete ===');
}

// Try multiple initialization strategies
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLandingPage);
} else {
    // DOM already loaded
    initLandingPage();
}

// Also try after a short delay as fallback
setTimeout(() => {
    const cards = document.querySelectorAll('.package-card');
    const buttons = document.querySelectorAll('.select-package');
    
    if (cards.length > 0 && buttons.length > 0) {
        // Check if handlers are working
        let handlersWorking = false;
        cards.forEach(card => {
            if (card.onclick || card.getAttribute('data-handler-attached')) {
                handlersWorking = true;
            }
        });
        
        if (!handlersWorking) {
            console.log('Handlers not detected, re-initializing...');
            initializePackageSelection();
        }
    }
}, 1000);

// Listen for package changes from admin (if on same domain)
window.addEventListener('storage', function(e) {
    if (e.key === PACKAGES_STORAGE_KEY) {
        packages = loadPackagesFromStorage();
        updatePackageSelect();
        updatePackageSelectionButtons();
        updateOrderSummary();
    }
});
