# Test Credentials

## 🧪 Test User Account

**Email:** `test@cargotrackpro.com`  
**Password:** `test123456`

**Account Details:**
- Company: Test Company
- Package: Professional ($249/month)
- Devices: 5

## 🔐 Admin Account

**Email:** `admin@cargotrackpro.com`  
**Password:** `admin123`

⚠️ **Important:** Change the admin password in production!

## 🚀 Quick Login URLs

### User Login:
```
https://your-vercel-url.vercel.app/login
```

### Admin Login:
```
https://your-vercel-url.vercel.app/admin-login
```

## 📝 How to Use

1. **Test User Login:**
   - Go to login page
   - Enter: `test@cargotrackpro.com` / `test123456`
   - Access dashboard and test all features

2. **Admin Login:**
   - Go to admin-login page
   - Enter: `admin@cargotrackpro.com` / `admin123`
   - Access admin dashboard

## 🧹 Reset Test User

If you need to reset the test user, clear browser localStorage:
```javascript
localStorage.removeItem('cargotrack_users');
localStorage.removeItem('cargotrack_auth');
```

Then refresh the landing page - the test user will be auto-created.

## 📋 Test Scenarios

### User Dashboard:
- ✅ View dashboard
- ✅ Add devices
- ✅ Connect 4G LTE tracker
- ✅ View alerts
- ✅ Check analytics
- ✅ Manage settings

### Admin Dashboard:
- ✅ View all users
- ✅ Manage packages
- ✅ View payments
- ✅ System settings

## 🔒 Security Note

These are **test credentials only**. For production:
- Change all default passwords
- Use strong passwords
- Implement proper authentication
- Use backend API for user management

