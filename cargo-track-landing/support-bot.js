// AI Technical Support Bot

class SupportBot {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.init();
    }

    init() {
        this.createWidget();
        this.loadChatHistory();
        this.setupEventListeners();
    }

    createWidget() {
        // Create bot container
        const botContainer = document.createElement('div');
        botContainer.id = 'supportBotContainer';
        botContainer.innerHTML = `
            <div id="supportBotWidget" class="support-bot-widget">
                <div class="bot-header" id="botHeader">
                    <div class="bot-header-content">
                        <div class="bot-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="bot-info">
                            <h3>AI Support Assistant</h3>
                            <p class="bot-status">Online</p>
                        </div>
                    </div>
                    <button class="bot-close" id="botCloseBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="bot-messages" id="botMessages">
                    <div class="bot-message bot-message-system">
                        <div class="message-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="message-content">
                            <p>Hello! I'm your AI support assistant. How can I help you today?</p>
                        </div>
                    </div>
                </div>
                <div class="bot-input-container">
                    <input type="text" id="botInput" placeholder="Type your message..." autocomplete="off">
                    <button id="botSendBtn" class="bot-send-btn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="bot-quick-actions" id="botQuickActions">
                    <button class="quick-action-btn" data-action="tracking">Tracking Issues</button>
                    <button class="quick-action-btn" data-action="billing">Billing Questions</button>
                    <button class="quick-action-btn" data-action="devices">Device Setup</button>
                    <button class="quick-action-btn" data-action="account">Account Help</button>
                </div>
            </div>
            <button id="botToggleBtn" class="bot-toggle-btn">
                <i class="fas fa-comments"></i>
                <span class="bot-badge" id="botBadge" style="display: none;">1</span>
            </button>
        `;
        document.body.appendChild(botContainer);
    }

    setupEventListeners() {
        const toggleBtn = document.getElementById('botToggleBtn');
        const closeBtn = document.getElementById('botCloseBtn');
        const sendBtn = document.getElementById('botSendBtn');
        const input = document.getElementById('botInput');
        const quickActions = document.querySelectorAll('.quick-action-btn');

        toggleBtn.addEventListener('click', () => this.toggle());
        closeBtn.addEventListener('click', () => this.close());
        sendBtn.addEventListener('click', () => this.sendMessage());
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        quickActions.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });
    }

    toggle() {
        this.isOpen = !this.isOpen;
        const widget = document.getElementById('supportBotWidget');
        if (this.isOpen) {
            widget.classList.add('open');
            document.getElementById('botInput').focus();
        } else {
            widget.classList.remove('open');
        }
    }

    close() {
        this.isOpen = false;
        document.getElementById('supportBotWidget').classList.remove('open');
    }

    sendMessage() {
        const input = document.getElementById('botInput');
        const message = input.value.trim();
        
        if (!message) return;

        this.addMessage(message, 'user');
        input.value = '';
        
        // Simulate AI response
        setTimeout(() => {
            const response = this.generateResponse(message);
            this.addMessage(response, 'bot');
        }, 500);
    }

    handleQuickAction(action) {
        const questions = {
            tracking: "How do I track my cargo in real-time?",
            billing: "I have a question about my billing or invoice.",
            devices: "How do I set up a new tracking device?",
            account: "I need help with my account settings."
        };

        const question = questions[action] || "How can I help you?";
        this.addMessage(question, 'user');
        
        setTimeout(() => {
            const response = this.generateResponse(question);
            this.addMessage(response, 'bot');
        }, 500);
    }

    generateResponse(userMessage) {
        const message = userMessage.toLowerCase();
        
        // AI Response Logic (simulated - in production, connect to actual AI API)
        if (message.includes('tracking') || message.includes('track') || message.includes('location')) {
            return "To track your cargo in real-time, go to the Dashboard and click on 'Live Tracking'. You'll see all your devices on an interactive map. Click on any device to see detailed location information, sensor data, and movement history.";
        }
        
        if (message.includes('billing') || message.includes('invoice') || message.includes('payment') || message.includes('receipt')) {
            return "You can view and download your invoices and receipts from the 'Billing & Invoices' section in your dashboard. For billing questions, you can also contact our support team. Would you like me to show you where to find your invoices?";
        }
        
        if (message.includes('device') || message.includes('setup') || message.includes('add device')) {
            return "To add a new device, go to 'Device Management' in your dashboard and click 'Add Device'. You'll need to provide: Device Group, Device Type, and Device ID. Then configure network settings, sensors, and GPS settings. Need help with a specific step?";
        }
        
        if (message.includes('account') || message.includes('profile') || message.includes('settings')) {
            return "You can manage your account settings in the 'Settings' section of your dashboard. There you can update your profile, change password, and manage privacy settings. What specific account setting do you need help with?";
        }
        
        if (message.includes('login') || message.includes('password') || message.includes('forgot')) {
            return "If you've forgotten your password, you can reset it from the login page. Click 'Forgot password?' and enter your email address. You'll receive a password reset link. If you're having trouble logging in, make sure you're using the correct email and password.";
        }
        
        if (message.includes('lte') || message.includes('4g') || message.includes('cellular')) {
            return "LTE tracker connection is available in the '4G LTE Tracker' section. You'll need your Device ID, IMEI, SIM ICCID, carrier, and APN. You can set the reporting interval to control update frequency. Need help configuring your LTE tracker?";
        }
        
        if (message.includes('help') || message.includes('support')) {
            return "I'm here to help! I can assist with tracking, billing, device setup, account management, and more. Just ask me a question or use the quick action buttons above. You can also contact our support team for more complex issues.";
        }
        
        // Default response
        const responses = [
            "I understand you're asking about: " + userMessage + ". Let me help you with that. Could you provide more details?",
            "That's a great question! Based on what you've asked, I'd recommend checking the relevant section in your dashboard. Would you like me to guide you to a specific feature?",
            "I can help you with that. For the best assistance, could you tell me more about what you're trying to accomplish?",
            "Thanks for your question! I'm here to help. You might find the answer in your dashboard, or I can guide you through the process. What specific issue are you experiencing?"
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    addMessage(text, sender) {
        const messagesContainer = document.getElementById('botMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `bot-message bot-message-${sender}`;
        
        if (sender === 'bot') {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <p>${this.escapeHtml(text)}</p>
                    <span class="message-time">${this.getTime()}</span>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <p>${this.escapeHtml(text)}</p>
                    <span class="message-time">${this.getTime()}</span>
                </div>
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
            `;
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Save to history
        this.messages.push({ text, sender, time: new Date().toISOString() });
        this.saveChatHistory();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getTime() {
        return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    saveChatHistory() {
        try {
            localStorage.setItem('support_bot_history', JSON.stringify(this.messages));
        } catch (e) {
            console.error('Error saving chat history:', e);
        }
    }

    loadChatHistory() {
        try {
            const history = localStorage.getItem('support_bot_history');
            if (history) {
                this.messages = JSON.parse(history);
                // Load last 10 messages
                const recentMessages = this.messages.slice(-10);
                recentMessages.forEach(msg => {
                    if (msg.sender !== 'system') {
                        this.addMessageToUI(msg.text, msg.sender);
                    }
                });
            }
        } catch (e) {
            console.error('Error loading chat history:', e);
        }
    }

    addMessageToUI(text, sender) {
        const messagesContainer = document.getElementById('botMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `bot-message bot-message-${sender}`;
        
        if (sender === 'bot') {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <p>${this.escapeHtml(text)}</p>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <p>${this.escapeHtml(text)}</p>
                </div>
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
            `;
        }
        
        messagesContainer.appendChild(messageDiv);
    }

    showNotification() {
        const badge = document.getElementById('botBadge');
        badge.style.display = 'block';
    }

    hideNotification() {
        const badge = document.getElementById('botBadge');
        badge.style.display = 'none';
    }
}

// Initialize bot when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.supportBot = new SupportBot();
    });
} else {
    window.supportBot = new SupportBot();
}

