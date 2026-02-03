// Invoice and Billing Document System

const INVOICES_KEY = 'cargotrack_invoices';

// Generate invoice
function generateInvoice(transaction, user) {
    const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const invoiceNumber = `INV-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
    
    // Load packages from storage or use defaults
    function getPackageInfo(packageId) {
        const stored = localStorage.getItem('cargotrack_packages');
        if (stored) {
            const packagesObj = JSON.parse(stored);
            const pkg = packagesObj[packageId];
            if (pkg) {
                return { name: pkg.name + ' Package', price: pkg.price };
            }
        }
        // Fallback to defaults
        const defaultPackages = {
            basic: { name: 'Basic Package', price: 99 },
            professional: { name: 'Professional Package', price: 249 },
            enterprise: { name: 'Enterprise Package', price: 499 }
        };
        return defaultPackages[packageId] || defaultPackages.professional;
    }
    
    const packageInfo = getPackageInfo(transaction.package);
    const subtotal = packageInfo.price;
    const tax = 0; // 0% tax
    const total = subtotal + tax;
    
    const invoice = {
        id: invoiceId,
        invoiceNumber: invoiceNumber,
        transactionId: transaction.id,
        userId: user.id,
        userEmail: user.email,
        userCompany: user.company || '',
        userPhone: user.phone || '',
        userAddress: user.address || '',
        date: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        items: [{
            description: packageInfo.name + ' - Monthly Subscription',
            quantity: 1,
            unitPrice: subtotal,
            total: subtotal
        }],
        subtotal: subtotal,
        tax: tax,
        taxRate: 0,
        total: total,
        currency: 'USD',
        status: transaction.status === 'completed' ? 'paid' : 'pending',
        paymentMethod: transaction.method,
        notes: 'Thank you for your business!'
    };
    
    // Save invoice
    saveInvoice(invoice);
    
    // Send payment thank you email
    if (typeof sendPaymentThankYouEmail === 'function') {
        sendPaymentThankYouEmail(user, invoice);
    }
    
    return invoice;
}

// Save invoice
function saveInvoice(invoice) {
    let invoices = getInvoices();
    invoices.push(invoice);
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
}

// Get all invoices
function getInvoices() {
    const invoices = localStorage.getItem(INVOICES_KEY);
    return invoices ? JSON.parse(invoices) : [];
}

// Get user invoices
function getUserInvoices(userId) {
    const invoices = getInvoices();
    return invoices.filter(inv => inv.userId === userId);
}

// Get invoice by ID
function getInvoiceById(invoiceId) {
    const invoices = getInvoices();
    return invoices.find(inv => inv.id === invoiceId);
}

// Generate invoice PDF (HTML to PDF simulation)
function generateInvoicePDF(invoice) {
    const invoiceHTML = createInvoiceHTML(invoice);
    
    // Create a new window with invoice
    const printWindow = window.open('', '_blank');
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = function() {
        printWindow.print();
    };
}

// Create invoice HTML
function createInvoiceHTML(invoice) {
    const date = new Date(invoice.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice ${invoice.invoiceNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        .invoice-container { max-width: 800px; margin: 0 auto; background: white; }
        .invoice-header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .invoice-logo { font-size: 24px; font-weight: bold; color: #667eea; }
        .invoice-info { text-align: right; }
        .invoice-title { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
        .invoice-number { color: #666; }
        .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .detail-section h3 { margin-bottom: 10px; color: #667eea; }
        .detail-section p { margin: 5px 0; }
        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .invoice-table th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; }
        .invoice-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
        .invoice-table tr:last-child td { border-bottom: none; }
        .text-right { text-align: right; }
        .invoice-totals { margin-left: auto; width: 300px; }
        .total-row { display: flex; justify-content: space-between; padding: 10px 0; }
        .total-row.grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #667eea; padding-top: 15px; margin-top: 10px; }
        .invoice-status { padding: 8px 16px; border-radius: 4px; display: inline-block; font-weight: 600; }
        .status-paid { background: #d1fae5; color: #065f46; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .invoice-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="invoice-header">
            <div>
                <div class="invoice-logo">CargoTrack Pro</div>
                <p style="margin-top: 5px; color: #666;">Real-Time Cargo Tracking Solutions</p>
            </div>
            <div class="invoice-info">
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-number">${invoice.invoiceNumber}</div>
            </div>
        </div>
        
        <div class="invoice-details">
            <div class="detail-section">
                <h3>Bill To:</h3>
                <p><strong>${invoice.userCompany || invoice.userEmail}</strong></p>
                <p>${invoice.userEmail}</p>
                ${invoice.userPhone ? `<p>${invoice.userPhone}</p>` : ''}
                ${invoice.userAddress ? `<p>${invoice.userAddress}</p>` : ''}
            </div>
            <div class="detail-section">
                <h3>Invoice Details:</h3>
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Due Date:</strong> ${dueDate}</p>
                <p><strong>Status:</strong> <span class="invoice-status status-${invoice.status}">${invoice.status.toUpperCase()}</span></p>
                <p><strong>Payment Method:</strong> ${invoice.paymentMethod}</p>
            </div>
        </div>
        
        <table class="invoice-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-right">Quantity</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items.map(item => `
                    <tr>
                        <td>${item.description}</td>
                        <td class="text-right">${item.quantity}</td>
                        <td class="text-right">$${item.unitPrice.toFixed(2)}</td>
                        <td class="text-right">$${item.total.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="invoice-totals">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>$${invoice.subtotal.toFixed(2)}</span>
            </div>
            ${invoice.taxRate > 0 ? `
            <div class="total-row">
                <span>Tax (${invoice.taxRate}%):</span>
                <span>$${invoice.tax.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row grand-total">
                <span>Total:</span>
                <span>$${invoice.total.toFixed(2)}</span>
            </div>
        </div>
        
        ${invoice.notes ? `<div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 4px;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
        
        <div class="invoice-footer">
            <p>Thank you for your business!</p>
            <p style="margin-top: 10px;">CargoTrack Pro | support@cargotrackpro.com | www.cargotrackpro.com</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Generate receipt (simplified invoice)
function generateReceipt(transaction, user) {
    const receipt = generateInvoice(transaction, user);
    receipt.type = 'receipt';
    receipt.receiptNumber = receipt.invoiceNumber.replace('INV-', 'RCP-');
    return receipt;
}

// Download invoice as PDF (simulation - opens print dialog)
function downloadInvoicePDF(invoice) {
    generateInvoicePDF(invoice);
}

// Download invoice as JSON
function downloadInvoiceJSON(invoice) {
    const blob = new Blob([JSON.stringify(invoice, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoice.invoiceNumber}.json`;
    a.click();
}

// Auto-generate invoices for existing transactions
function generateInvoicesForTransactions() {
    const users = getUsers();
    const transactions = getPaymentTransactions();
    const existingInvoices = getInvoices();
    
    transactions.forEach(txn => {
        // Check if invoice already exists
        const existingInvoice = existingInvoices.find(inv => inv.transactionId === txn.id);
        if (!existingInvoice) {
            const user = users.find(u => u.id === txn.userId);
            if (user) {
                generateInvoice(txn, user);
            }
        }
    });
}

// Initialize invoices on load
if (typeof window !== 'undefined') {
    // Generate invoices for existing transactions when needed
    setTimeout(() => {
        if (typeof getUsers === 'function' && typeof getPaymentTransactions === 'function') {
            generateInvoicesForTransactions();
        }
    }, 1000);
}

