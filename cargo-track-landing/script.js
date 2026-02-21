// ══════════════════════════════════════════════════════════════
// Polarsat — Multi-Industry 3-Tier Pricing
// ══════════════════════════════════════════════════════════════

const TIER_DEFAULTS = {
    track:   { lora: { price: 2.95, annual: 35.40 }, '4g': { price: 7.95, annual: 95.40 },  interval: '5 min',  data: '50 MB' },
    monitor: { lora: { price: 4.95, annual: 59.40 }, '4g': { price: 9.95, annual: 119.40 }, interval: '1 min',  data: '200 MB' },
    predict: { lora: { price: 7.95, annual: 95.40 }, '4g': { price: 14.95, annual: 179.40 }, interval: '10 sec', data: '500 MB' }
};

const TIER_BASE = JSON.parse(JSON.stringify(TIER_DEFAULTS));

function applyPackagesToTiers(stored) {
    if (!stored || typeof stored !== 'object') return;
    Object.keys(TIER_BASE).forEach(key => {
        const pkg = stored[key];
        if (!pkg) return;
        if (pkg.priceLora)        TIER_BASE[key].lora.price  = pkg.priceLora;
        if (pkg.annualPriceLora)  TIER_BASE[key].lora.annual = pkg.annualPriceLora;
        if (pkg.price4g)          TIER_BASE[key]['4g'].price  = pkg.price4g;
        if (pkg.annualPrice4g)    TIER_BASE[key]['4g'].annual = pkg.annualPrice4g;
        if (pkg.interval)         TIER_BASE[key].interval     = pkg.interval;
        if (pkg.data)             TIER_BASE[key].data         = pkg.data;
        if (pkg.name)             TIER_BASE[key].name         = pkg.name;
        if (pkg.features)         TIER_BASE[key].features     = pkg.features;
        if (pkg.description)      TIER_BASE[key].description  = pkg.description;
    });
}

function fetchAndApplyPackages() {
    fetch('/api/packages')
        .then(r => r.json())
        .then(data => {
            if (data && data.packages) {
                applyPackagesToTiers(data.packages);
                refreshAllPrices();
            }
        })
        .catch(() => {});
}

function refreshAllPrices() {
    const conn = selectedConnectivity || '4g';
    updatePricingCards(conn);
    updateTierSelectPrices(conn);
    if (typeof updateRoiTierOptions === 'function') updateRoiTierOptions();
    updateOrderSummary();
}

const TIER_ALIASES = {
    locate: 'track', manage: 'monitor', protect: 'predict',
    comply: 'track', validate: 'monitor', certify: 'predict',
    assess: 'track', underwrite: 'monitor',
    secure: 'track', optimise: 'monitor', command: 'predict'
};

let selectedConnectivity = 'lora';

function resolveTierKey(key) {
    const k = (key || 'monitor').toLowerCase();
    return TIER_ALIASES[k] || k;
}

function getTierBase(tierKey) {
    return TIER_BASE[resolveTierKey(tierKey)] || TIER_BASE.monitor;
}
const HARDWARE_COST = 0;
const CONTRACT_MONTHS = 24;

function formatEur(value) {
    return '\u20ac' + value.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTierPricing(tierKey, connectivity) {
    const base = getTierBase(tierKey);
    const conn = connectivity || selectedConnectivity || '4g';
    const pricing = base[conn] || base['4g'];
    return { price: pricing.price, annual: pricing.annual, interval: base.interval, data: base.data };
}

// ── Order Summary ──

function updateOrderSummary() {
    const devicesEl = document.getElementById('devices');
    const tierEl = document.getElementById('tier');
    const connEl = document.getElementById('connectivity');
    if (!devicesEl) return;

    const assets = Math.max(1, parseInt(devicesEl.value) || 1);
    const tierKey = tierEl ? tierEl.value : 'monitor';
    const conn = connEl ? connEl.value : selectedConnectivity;
    const tier = getTierPricing(tierKey, conn);
    const monthlyCost = assets * tier.price;
    const annualCost = assets * tier.annual;

    const summaryPackage = document.getElementById('summaryPackage');
    const summaryDevices = document.getElementById('summaryDevices');
    const summaryMonthly = document.getElementById('summaryMonthly');
    const summaryTotal = document.getElementById('summaryTotal');
    const summaryConn = document.getElementById('summaryConnectivity');

    if (summaryPackage) summaryPackage.textContent = tierKey.charAt(0).toUpperCase() + tierKey.slice(1);
    if (summaryDevices) summaryDevices.textContent = assets.toString();
    if (summaryMonthly) summaryMonthly.textContent = formatEur(monthlyCost);
    if (summaryTotal) summaryTotal.textContent = formatEur(annualCost);
    if (summaryConn) summaryConn.textContent = conn === 'lora' ? 'LoRaWAN' : '4G/LTE';

    updateTierSelectPrices(conn);
}

function updateTierSelectPrices(conn) {
    const tierEl = document.getElementById('tier');
    if (!tierEl) return;
    Array.from(tierEl.options).forEach(opt => {
        const base = getTierBase(opt.value);
        if (!base) return;
        const p = base[conn || selectedConnectivity] || base['4g'];
        const label = opt.value.charAt(0).toUpperCase() + opt.value.slice(1);
        opt.textContent = `${label} (\u20ac${p.price.toFixed(2)}/asset/mo)`;
    });
}

// No-op stubs for backward compatibility
function updatePackageSelect() {}
function updatePackageSelectionButtons() {}
window.selectPackage = function() {
    const el = document.getElementById('order');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return false;
};

// ── Mobile Menu ──

document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => navMenu.classList.toggle('active'));
    }
});

// ── Form Submission ──

document.addEventListener('DOMContentLoaded', function() {
    const orderForm = document.getElementById('orderForm');
    if (!orderForm) return;

    orderForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(orderForm);
        const orderData = {
            industry: formData.get('industry') || 'general',
            tier: formData.get('tier') || 'monitor',
            package: formData.get('tier') || formData.get('package') || 'monitor',
            connectivity: formData.get('connectivity') || selectedConnectivity || '4g',
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

        if (!orderData.company || !orderData.company.trim()) { alert('Please enter your company name'); return; }
        if (!orderData.email || !orderData.email.trim()) { alert('Please enter your email address'); return; }
        if (!orderData.phone || !orderData.phone.trim()) { alert('Please enter your phone number'); return; }
        if (!orderData.address || !orderData.address.trim()) { alert('Please enter your shipping address'); return; }

        if (orderData.payment === 'credit') {
            if (!orderData.cardNumber || !orderData.cardNumber.trim()) { alert('Please enter your credit card number'); return; }
            if (!orderData.expiry || !orderData.expiry.trim()) { alert('Please enter card expiry date'); return; }
            if (!orderData.cvv || !orderData.cvv.trim()) { alert('Please enter CVV'); return; }
        }

        const password = formData.get('password') || (document.getElementById('password') ? document.getElementById('password').value : '');
        if (!password || password.length < 6) { alert('Please create a password with at least 6 characters'); return; }

        if (typeof createUser !== 'function' || typeof authenticateUser !== 'function') {
            alert('Error: Authentication system not loaded. Please refresh the page.');
            return;
        }

        const submitButton = orderForm.querySelector('button[type="submit"]');
        if (submitButton) { submitButton.textContent = 'Processing...'; submitButton.disabled = true; }
        const formWrapper = document.querySelector('.order-form-wrapper');
        if (formWrapper) { formWrapper.style.opacity = '0.7'; formWrapper.style.pointerEvents = 'none'; }

        setTimeout(() => {
            try {
                const userResult = createUser({
                    email: orderData.email,
                    password: password,
                    company: orderData.company,
                    phone: orderData.phone,
                    package: orderData.tier,
                    devices: parseInt(orderData.devices) || 1
                });

                if (userResult.success) {
                    if (typeof window.sendWelcomeEmail === 'function') {
                        try {
                            const users = getUsers();
                            const newUser = users.find(u => u.email === orderData.email);
                            if (newUser) window.sendWelcomeEmail(newUser);
                        } catch (_) {}
                    }

                    const authResult = authenticateUser(orderData.email, password);
                    if (authResult.success) {
                        const deviceCount = parseInt(orderData.devices) || 1;
                        const tier = getTierPricing(orderData.tier, orderData.connectivity);
                        const monthlyPrice = deviceCount * tier.price;
                        const annualPrice = deviceCount * tier.annual;
                        const tierLabel = orderData.tier.charAt(0).toUpperCase() + orderData.tier.slice(1);
                        const connLabel = orderData.connectivity === 'lora' ? 'LoRaWAN' : '4G/LTE';
                        alert(`Order placed successfully!\n\nPlan: ${tierLabel}\nConnectivity: ${connLabel}\nIndustry: ${orderData.industry}\nAssets: ${deviceCount}\nMonthly: ${formatEur(monthlyPrice)}\nAnnual: ${formatEur(annualPrice)}\nHardware: Free (24-month plan)\n\nRedirecting to your dashboard...`);
                        window.location.replace('dashboard.html');
                    } else {
                        alert('Account created but login failed. Please login manually.');
                        window.location.replace('login.html');
                    }
                } else {
                    const authResult = authenticateUser(orderData.email, password);
                    if (authResult.success) {
                        alert('Welcome back! Redirecting to your dashboard...');
                        window.location.replace('dashboard.html');
                    } else {
                        alert(userResult.message || 'Failed to create account. Please try again.');
                        if (submitButton) { submitButton.textContent = 'Create Account & Start'; submitButton.disabled = false; }
                        if (formWrapper) { formWrapper.style.opacity = '1'; formWrapper.style.pointerEvents = 'auto'; }
                    }
                }
            } catch (error) {
                alert('An error occurred: ' + error.message);
                if (submitButton) { submitButton.textContent = 'Create Account & Start'; submitButton.disabled = false; }
                if (formWrapper) { formWrapper.style.opacity = '1'; formWrapper.style.pointerEvents = 'auto'; }
            }
        }, 1500);
    });
});

// ── Payment Method Toggle ──

document.addEventListener('DOMContentLoaded', function() {
    const paymentRadios = document.querySelectorAll('input[name="payment"]');
    const paymentDetails = document.getElementById('paymentDetails');
    if (!paymentRadios.length || !paymentDetails) return;

    paymentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isCreditCard = e.target.value === 'credit';
            paymentDetails.style.display = isCreditCard ? 'block' : 'none';
            ['cardNumber', 'expiry', 'cvv'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.required = isCreditCard;
            });
        });
    });

    const cardNumberInput = document.getElementById('cardNumber');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\s/g, '');
            e.target.value = v.match(/.{1,4}/g)?.join(' ') || v;
        });
    }

    const expiryInput = document.getElementById('expiry');
    if (expiryInput) {
        expiryInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 4);
            e.target.value = v;
        });
    }

    const cvvInput = document.getElementById('cvv');
    if (cvvInput) {
        cvvInput.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
    }
});

// ── Smooth Scroll ──

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const navMenu = document.querySelector('.nav-menu');
            if (navMenu && navMenu.classList.contains('active')) navMenu.classList.remove('active');
        }
    });
});

// ── Scroll-based nav highlighting ──

window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-menu a[href="#${sectionId}"]`);
        if (scrollY > sectionTop && scrollY <= sectionTop + section.offsetHeight) {
            document.querySelectorAll('.nav-menu a').forEach(link => link.classList.remove('active'));
            if (navLink) navLink.classList.add('active');
        }
    });
});

// ── Connectivity toggle (pricing section) ──

function initConnectivityToggle() {
    const toggle = document.getElementById('connectivityToggle');
    if (!toggle) return;
    toggle.querySelectorAll('.conn-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            toggle.querySelectorAll('.conn-toggle-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedConnectivity = this.getAttribute('data-conn');
            updatePricingCards(selectedConnectivity);
            updateRoiTierOptions();
            const connEl = document.getElementById('connectivity');
            if (connEl) connEl.value = selectedConnectivity;
            const roiConn = document.getElementById('roiConnectivity');
            if (roiConn) roiConn.value = selectedConnectivity;
            updateOrderSummary();
        });
    });
}

function updatePricingCards(conn) {
    document.querySelectorAll('.tier-card').forEach(card => {
        const tierKey = card.getAttribute('data-tier-key');
        if (!tierKey) return;
        const base = getTierBase(tierKey);
        if (!base) return;
        const p = base[conn] || base['4g'];
        const amountEl = card.querySelector('.tier-amount');
        const annualEl = card.querySelector('.tier-annual');
        if (amountEl) amountEl.textContent = p.price.toFixed(2);
        if (annualEl) annualEl.textContent = `Billed annually at \u20ac${p.annual.toFixed(2)}/asset/year`;
        const specs = card.querySelectorAll('.tier-spec');
        if (specs.length >= 1 && base.interval) specs[0].innerHTML = `<i class="fas fa-clock"></i> Every ${base.interval}`;
        if (specs.length >= 2 && base.data) specs[1].innerHTML = `<i class="fas fa-database"></i> ${base.data}/mo`;
        if (base.name) {
            const nameEl = card.querySelector('.tier-name');
            if (nameEl) nameEl.textContent = base.name;
        }
        if (base.features && Array.isArray(base.features)) {
            const featList = card.querySelector('.tier-features');
            if (featList) featList.innerHTML = base.features.map(f => `<li><i class="fas fa-check"></i> ${f}</li>`).join('');
        }
    });
}

// ── Tier CTA buttons (scroll to order & pre-select tier) ──

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-tier]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const tierKey = this.getAttribute('data-tier');
            const tierSelect = document.getElementById('tier');
            if (tierSelect) {
                tierSelect.value = tierKey;
                updateOrderSummary();
            }
        });
    });
});

// ── Order Form Initialisation ──

function initializePackageSelection() {
    const devicesEl = document.getElementById('devices');
    const tierEl = document.getElementById('tier');
    const connEl = document.getElementById('connectivity');
    if (!devicesEl) return;

    const update = () => updateOrderSummary();
    devicesEl.addEventListener('input', update);
    devicesEl.addEventListener('change', update);
    if (tierEl) tierEl.addEventListener('change', update);
    if (connEl) connEl.addEventListener('change', () => {
        selectedConnectivity = connEl.value;
        updatePricingCards(selectedConnectivity);
        const toggle = document.getElementById('connectivityToggle');
        if (toggle) {
            toggle.querySelectorAll('.conn-toggle-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-conn') === selectedConnectivity);
            });
        }
        update();
    });
    update();
}

// ── ROI Calculator (works across all industry pages) ──

function updateRoiTierOptions() {
    const tierSelect = document.getElementById('roiTier');
    if (!tierSelect) return;
    const conn = selectedConnectivity || '4g';
    Array.from(tierSelect.options).forEach(opt => {
        const tierKey = opt.getAttribute('data-tier-key');
        if (!tierKey) return;
        const base = getTierBase(tierKey);
        if (!base) return;
        const p = base[conn] || base['4g'];
        opt.value = p.price.toFixed(2);
        const label = opt.getAttribute('data-label') || tierKey;
        opt.textContent = `${label} (\u20ac${p.price.toFixed(2)})`;
    });
}

function initRoiCalculator() {
    const slider = document.getElementById('roiVehicles');
    const countEl = document.getElementById('roiCount');
    const costEl = document.getElementById('roiCost');
    const timeEl = document.getElementById('roiTime');
    const fuelEl = document.getElementById('roiFuel');
    const netEl = document.getElementById('roiNet');
    const tierSelect = document.getElementById('roiTier');
    const roiConnSelect = document.getElementById('roiConnectivity');

    if (!slider || !countEl || !costEl || !timeEl || !fuelEl || !netEl) return;

    const fmtMo = (v) => formatEur(Math.round(v)) + '/mo';

    const calculate = () => {
        const assets = parseInt(slider.value, 10) || 1;
        const defaultPrice = getTierPricing('track').price;
        const pricePerAsset = tierSelect ? parseFloat(tierSelect.value) || defaultPrice : defaultPrice;
        const platformCost = assets * pricePerAsset;
        const timeSavings = assets * 48;
        const fuelSavings = assets * 35;
        const netRoi = timeSavings + fuelSavings - platformCost;

        countEl.textContent = assets.toString();
        costEl.textContent = fmtMo(platformCost);
        timeEl.textContent = fmtMo(timeSavings);
        fuelEl.textContent = fmtMo(fuelSavings);
        netEl.textContent = `${netRoi >= 0 ? '+' : ''}${formatEur(Math.round(netRoi))}/mo`;
    };

    slider.addEventListener('input', calculate);
    if (tierSelect) tierSelect.addEventListener('change', calculate);
    if (roiConnSelect) {
        roiConnSelect.addEventListener('change', () => {
            selectedConnectivity = roiConnSelect.value;
            updateRoiTierOptions();
            updatePricingCards(selectedConnectivity);
            const mainToggle = document.getElementById('connectivityToggle');
            if (mainToggle) {
                mainToggle.querySelectorAll('.conn-toggle-btn').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-conn') === selectedConnectivity);
                });
            }
            const orderConn = document.getElementById('connectivity');
            if (orderConn) orderConn.value = selectedConnectivity;
            updateOrderSummary();
            calculate();
        });
    }
    updateRoiTierOptions();
    calculate();
}

// ── Pricing Calculator (hub page, if present) ──

function initPricingCalculator() {
    const input = document.getElementById('pricingAssets');
    const resultEl = document.getElementById('pricingCalcResult');
    const annualEl = document.getElementById('pricingCalcAnnual');
    if (!input || !resultEl || !annualEl) return;

    const calc = () => {
        const count = Math.max(1, parseInt(input.value) || 1);
        const tier = getTierPricing('monitor');
        const monthly = count * tier.price;
        const annual = count * tier.annual;
        resultEl.textContent = formatEur(monthly) + '/mo';
        annualEl.textContent = formatEur(annual) + ' billed annually';
    };

    input.addEventListener('input', calc);
    input.addEventListener('change', calc);
    calc();
}

// ── Init ──

function initLandingPage() {
    initConnectivityToggle();
    updatePricingCards(selectedConnectivity);
    updateTierSelectPrices(selectedConnectivity);
    initializePackageSelection();
    initPricingCalculator();
    initRoiCalculator();
    fetchAndApplyPackages();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLandingPage);
} else {
    initLandingPage();
}

setTimeout(() => {
    const devicesEl = document.getElementById('devices');
    if (devicesEl) initializePackageSelection();
}, 1000);
