# Deployment Guide - CargoTrack Pro

This guide will help you deploy CargoTrack Pro online for real-time testing.

## Quick Deploy Options

### Option 1: Vercel (Recommended - Easiest)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```
   Follow the prompts. Your site will be live in seconds!

3. **Or use Vercel Dashboard**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login
   - Click "New Project"
   - Import your Git repository or drag & drop the folder
   - Deploy!

### Option 2: Netlify

1. **Install Netlify CLI**:
   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

3. **Or use Netlify Dashboard**:
   - Go to [netlify.com](https://netlify.com)
   - Sign up/login
   - Drag & drop your project folder
   - Your site is live!

### Option 3: GitHub Pages

1. **Create a GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/cargotrack-pro.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Select branch: `main`
   - Select folder: `/ (root)`
   - Save

3. **Your site will be at**: `https://yourusername.github.io/cargotrack-pro/`

### Option 4: Firebase Hosting

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login and initialize**:
   ```bash
   firebase login
   firebase init hosting
   ```
   - Select existing project or create new
   - Public directory: `.` (current directory)
   - Single-page app: `No`
   - Overwrite index.html: `No`

3. **Deploy**:
   ```bash
   firebase deploy
   ```

### Option 5: Traditional Web Hosting

1. **Upload all files** via FTP/SFTP to your web server
2. **Ensure**:
   - All files are in the root directory or a subdirectory
   - Web server supports static file serving
   - No special server configuration needed

## Local Testing Before Deployment

### Using Python (if installed):
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

### Using Node.js:
```bash
npm install -g serve
serve .
```

### Using PHP:
```bash
php -S localhost:8000
```

Then visit: `http://localhost:8000`

## Important Notes for Production

### 1. **Authentication**
- Currently uses localStorage (client-side only)
- For production, implement proper backend authentication
- Consider: Firebase Auth, Auth0, or custom backend

### 2. **Data Storage**
- Currently uses localStorage (browser-only)
- For production, use:
  - Backend API (Node.js, Python, etc.)
  - Database (PostgreSQL, MongoDB, etc.)
  - Cloud services (Firebase, Supabase, AWS)

### 3. **LTE Integration**
- Simulation mode is enabled by default
- For real LTE connection:
  - Integrate with your carrier or cellular IoT platform
  - Use a backend ingest endpoint for device data

### 4. **Payment Processing**
- Currently simulated
- Integrate with:
  - Stripe
  - PayPal
  - Square
  - Or other payment gateways

### 5. **HTTPS Required**
- Most hosting services provide HTTPS automatically
- Required for:
  - Geolocation API (GPS)
  - Secure authentication
  - Modern browser features

## Environment Variables (if needed)

If you add backend services, you may need:

```env
# Example .env file (don't commit this!)
API_URL=https://your-api.com
LTE_INGEST_TOKEN=your-key
STRIPE_PUBLIC_KEY=your-stripe-key
```

## File Structure

```
cargo-track-landing/
├── index.html          # Landing page
├── login.html          # Login page
├── dashboard.html      # Main dashboard
├── styles.css          # Landing page styles
├── dashboard.css       # Dashboard styles
├── script.js           # Landing page scripts
├── auth.js             # Authentication system
├── login.js            # Login functionality
├── dashboard.js        # Dashboard functionality
├── package.json        # NPM configuration
├── vercel.json         # Vercel deployment config
├── netlify.toml        # Netlify deployment config
└── README.md           # Documentation
```

## Testing Checklist

Before going live, test:

- [ ] Landing page loads correctly
- [ ] Order form creates user account
- [ ] Login works with created account
- [ ] Dashboard displays correctly
- [ ] Device management works
- [ ] 4G LTE tracker connection works (simulation mode)
- [ ] All navigation links work
- [ ] Mobile responsive design
- [ ] Forms validate correctly
- [ ] No console errors

## Troubleshooting

### Issue: Routes not working (404 errors)
**Solution**: Ensure your hosting service supports SPA routing or use the provided redirect configurations.

### Issue: Assets not loading
**Solution**: Check all file paths are relative (not absolute). All paths should start with `./` or just the filename.

### Issue: localStorage not persisting
**Solution**: This is normal - localStorage is browser-specific. For production, use a backend database.

### Issue: CORS errors
**Solution**: If connecting to external APIs, ensure CORS is properly configured on the server side.

## Support

For issues or questions:
- Check browser console for errors
- Verify all files are uploaded
- Test in different browsers
- Check hosting service documentation

## License

MIT License - Feel free to use for your projects.

