// Email Notification System

const EMAIL_NOTIFICATIONS_KEY = 'cargotrack_email_notifications';
const EMAIL_TEMPLATES_KEY = 'cargotrack_email_templates';

// Initialize email templates
function initEmailTemplates() {
    const templates = localStorage.getItem(EMAIL_TEMPLATES_KEY);
    if (!templates) {
        const defaultTemplates = {
            welcome: {
                subject: 'Welcome to CargoTrack Pro!',
                body: `Dear {{userName}},

Welcome to CargoTrack Pro! We're excited to have you on board.

Your account has been successfully created:
- Email: {{userEmail}}
- Package: {{packageName}}
- Devices: {{deviceCount}}

You can now access your dashboard and start tracking your cargo in real-time.

If you have any questions, our support team is here to help.

Best regards,
CargoTrack Pro Team`
            },
            paymentThankYou: {
                subject: 'Thank You for Your Payment - CargoTrack Pro',
                body: `Dear {{userName}},

Thank you for your payment!

Payment Details:
- Invoice: {{invoiceNumber}}
- Amount: {{amount}}
- Date: {{paymentDate}}
- Package: {{packageName}}

Your subscription has been renewed and is active until {{expiryDate}}.

We appreciate your business!

Best regards,
CargoTrack Pro Team`
            },
            subscriptionReminder: {
                subject: 'Subscription Renewal Reminder - CargoTrack Pro',
                body: `Dear {{userName}},

This is a friendly reminder that your CargoTrack Pro subscription will expire on {{expiryDate}}.

Your current package: {{packageName}}

To ensure uninterrupted service, please renew your subscription before the expiration date.

You can renew your subscription from your dashboard or by clicking here: {{renewalLink}}

If you have any questions, please contact our support team.

Best regards,
CargoTrack Pro Team`
            },
            subscriptionExpired: {
                subject: 'Subscription Expired - CargoTrack Pro',
                body: `Dear {{userName}},

Your CargoTrack Pro subscription has expired on {{expiryDate}}.

Your account access has been temporarily suspended. To restore service, please renew your subscription.

You can renew from your dashboard or contact support for assistance.

Best regards,
CargoTrack Pro Team`
            }
        };
        localStorage.setItem(EMAIL_TEMPLATES_KEY, JSON.stringify(defaultTemplates));
    }
}

// Get email templates
function getEmailTemplates() {
    initEmailTemplates();
    return JSON.parse(localStorage.getItem(EMAIL_TEMPLATES_KEY));
}

// Replace template variables
function replaceTemplateVariables(template, variables) {
    let result = template;
    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, variables[key] || '');
    });
    return result;
}

// Send welcome email
function sendWelcomeEmail(user) {
    const templates = getEmailTemplates();
    const template = templates.welcome;
    
    const packages = getPackages();
    const packageInfo = packages[user.package] || { name: user.package };
    
    const variables = {
        userName: user.company || user.email.split('@')[0],
        userEmail: user.email,
        packageName: packageInfo.name || user.package,
        deviceCount: user.devices || 1
    };
    
    const subject = replaceTemplateVariables(template.subject, variables);
    const body = replaceTemplateVariables(template.body, variables);
    
    sendEmail(user.email, subject, body, 'welcome');
}

// Send payment thank you email
function sendPaymentThankYouEmail(user, invoice) {
    if (!shouldSendNotification(user, 'paymentThankYou')) {
        return;
    }
    
    const templates = getEmailTemplates();
    const template = templates.paymentThankYou;
    
    const packages = getPackages();
    const packageInfo = packages[user.package] || { name: user.package };
    
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    
    const variables = {
        userName: user.company || user.email.split('@')[0],
        invoiceNumber: invoice.invoiceNumber,
        amount: '$' + invoice.total.toFixed(2),
        paymentDate: new Date(invoice.date).toLocaleDateString(),
        packageName: packageInfo.name || user.package,
        expiryDate: expiryDate.toLocaleDateString()
    };
    
    const subject = replaceTemplateVariables(template.subject, variables);
    const body = replaceTemplateVariables(template.body, variables);
    
    sendEmail(user.email, subject, body, 'paymentThankYou');
}

// Send subscription reminder
function sendSubscriptionReminder(user) {
    if (!shouldSendNotification(user, 'subscriptionReminder')) {
        return;
    }
    
    const templates = getEmailTemplates();
    const template = templates.subscriptionReminder;
    
    const packages = getPackages();
    const packageInfo = packages[user.package] || { name: user.package };
    
    // Calculate expiry date (30 days from now for demo)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days reminder
    
    const variables = {
        userName: user.company || user.email.split('@')[0],
        expiryDate: expiryDate.toLocaleDateString(),
        packageName: packageInfo.name || user.package,
        renewalLink: window.location.origin + '/dashboard.html#billing'
    };
    
    const subject = replaceTemplateVariables(template.subject, variables);
    const body = replaceTemplateVariables(template.body, variables);
    
    sendEmail(user.email, subject, body, 'subscriptionReminder');
}

// Check if notification should be sent
function shouldSendNotification(user, notificationType) {
    const settings = getUserNotificationSettings(user.id);
    
    switch(notificationType) {
        case 'paymentThankYou':
            return settings.paymentThankYou !== false;
        case 'subscriptionReminder':
            return settings.subscriptionReminder !== false;
        case 'systemNotifications':
            return settings.systemNotifications !== false;
        default:
            return true;
    }
}

// Get user notification settings
function getUserNotificationSettings(userId) {
    const settingsKey = `cargotrack_user_notifications_${userId}`;
    const settings = localStorage.getItem(settingsKey);
    if (settings) {
        return JSON.parse(settings);
    }
    // Default settings
    return {
        emailAlerts: true,
        smsAlerts: false,
        pushNotifications: true,
        paymentThankYou: true,
        subscriptionReminder: true,
        systemNotifications: true,
        alertNotifications: true
    };
}

// Save user notification settings
function saveUserNotificationSettings(userId, settings) {
    const settingsKey = `cargotrack_user_notifications_${userId}`;
    localStorage.setItem(settingsKey, JSON.stringify(settings));
}

// Send email (simulated - in production, this would call an email API)
function sendEmail(to, subject, body, type) {
    // Store email in notifications log
    const notifications = JSON.parse(localStorage.getItem(EMAIL_NOTIFICATIONS_KEY)) || [];
    const email = {
        id: Date.now().toString(),
        to: to,
        subject: subject,
        body: body,
        type: type,
        sent: new Date().toISOString(),
        status: 'sent'
    };
    
    notifications.unshift(email);
    
    // Keep only last 1000 emails
    if (notifications.length > 1000) {
        notifications.splice(1000);
    }
    
    localStorage.setItem(EMAIL_NOTIFICATIONS_KEY, JSON.stringify(notifications));
    
    // In production, this would actually send the email via API
    console.log('Email sent:', { to, subject, type });
    
    // Show notification to user if they're logged in
    if (typeof showEmailSentNotification === 'function') {
        showEmailSentNotification(type);
    }
}

// Get sent emails
function getSentEmails(limit = 100) {
    const notifications = JSON.parse(localStorage.getItem(EMAIL_NOTIFICATIONS_KEY)) || [];
    return notifications.slice(0, limit);
}

// Check and send subscription reminders (should be called periodically)
function checkAndSendReminders() {
    const users = getUsers();
    const now = new Date();
    
    users.forEach(user => {
        if (user.isActive !== false) {
            // Check if reminder should be sent (7 days before expiry)
            // For demo, we'll check if user was created more than 23 days ago
            const userDate = new Date(user.createdAt);
            const daysSinceCreation = (now - userDate) / (1000 * 60 * 60 * 24);
            
            // Send reminder if it's been 23 days (7 days before 30-day expiry)
            if (daysSinceCreation >= 23 && daysSinceCreation < 30) {
                const lastReminderKey = `last_reminder_${user.id}`;
                const lastReminder = localStorage.getItem(lastReminderKey);
                const lastReminderDate = lastReminder ? new Date(lastReminder) : null;
                
                // Only send if not sent in last 24 hours
                if (!lastReminderDate || (now - lastReminderDate) / (1000 * 60 * 60) > 24) {
                    sendSubscriptionReminder(user);
                    localStorage.setItem(lastReminderKey, now.toISOString());
                }
            }
        }
    });
}

// Initialize and start reminder checks
if (typeof window !== 'undefined') {
    initEmailTemplates();
    
    // Check reminders every hour
    setInterval(checkAndSendReminders, 60 * 60 * 1000);
    
    // Check immediately on load
    setTimeout(checkAndSendReminders, 5000);
}

// Helper function to get packages (from script.js or admin.js)
function getPackages() {
    if (typeof getPackagesFromStorage === 'function') {
        return getPackagesFromStorage();
    }
    // Fallback
    const stored = localStorage.getItem('cargotrack_packages');
    if (stored) {
        return JSON.parse(stored);
    }
    return {
        basic: { name: 'Basic', price: 99 },
        professional: { name: 'Professional', price: 249 },
        enterprise: { name: 'Enterprise', price: 499 }
    };
}

// Helper function to get users
function getUsers() {
    // Try to use getUsers from auth.js (check if it's defined and not this function)
    if (typeof window.getUsers === 'function' && window.getUsers !== getUsers) {
        return window.getUsers();
    }
    // Fallback to direct localStorage access
    const USERS_KEY = 'cargotrack_users';
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.sendWelcomeEmail = sendWelcomeEmail;
    window.sendPaymentThankYouEmail = sendPaymentThankYouEmail;
    window.sendSubscriptionReminder = sendSubscriptionReminder;
    window.getUserNotificationSettings = getUserNotificationSettings;
    window.saveUserNotificationSettings = saveUserNotificationSettings;
    window.shouldSendNotification = shouldSendNotification;
}

