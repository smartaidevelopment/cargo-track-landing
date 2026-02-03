# Quick Start Guide - Deploy in 5 Minutes

## Option 1: Vercel (Fastest - Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   cd cargo-track-landing
   vercel
   ```

3. **Follow prompts** - Your site will be live in 30 seconds!

## Option 2: Netlify (No CLI needed)

1. Go to [app.netlify.com](https://app.netlify.com)
2. Sign up/login
3. Drag and drop the `cargo-track-landing` folder
4. Done! Your site is live.

## Option 3: GitHub Pages

1. **Create GitHub repo**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/cargotrack-pro.git
   git push -u origin main
   ```

2. **Enable Pages**:
   - Go to repo Settings → Pages
   - Source: `main` branch
   - Folder: `/ (root)`
   - Save

3. **Your site**: `https://YOUR_USERNAME.github.io/cargotrack-pro/`

## Test Locally First

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .

# Then visit: http://localhost:8000
```

## What to Test

1. ✅ Landing page loads
2. ✅ Order form creates account
3. ✅ Login works
4. ✅ Dashboard displays
5. ✅ Device management works
6. ✅ 4G LTE tracker connects (simulation mode)

## Need Help?

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

