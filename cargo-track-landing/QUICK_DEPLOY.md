# Quick Deploy Guide

## 🚀 Automatic Deployment Options

### Option 1: Watch Script (Instant Auto-Deploy)

**Start watching and auto-deploying:**
```bash
npm run watch
```

This will:
- ✅ Watch for file changes
- ✅ Automatically deploy to Vercel after 2 seconds of inactivity
- ✅ Show deployment URL when complete
- ✅ Keep running until you stop it (Ctrl+C)

**For preview deployments (testing):**
```bash
npm run watch:preview
```

**Watch + Local Dev Server:**
```bash
npm run watch:dev
```

### Option 2: Git Integration (Recommended)

**Setup once:**
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Import your Git repository
4. Vercel will auto-deploy on every `git push`

**Then just:**
```bash
git add .
git commit -m "Your changes"
git push
# Vercel deploys automatically!
```

### Option 3: Manual Deploy

**Production:**
```bash
npm run deploy
```

**Preview:**
```bash
npm run deploy:preview
```

## 📝 Current Setup

✅ Vercel project linked: `cargo-track-landing`
✅ Watch script ready: `watch-deploy.js`
✅ Auto-deploy configured

## 🎯 Quick Start

**Start auto-deploying now:**
```bash
npm run watch
```

Make any changes to your files, and they'll automatically deploy!

## 🔗 Your URLs

After deployment, check:
- Landing: `https://cargo-track-landing-*.vercel.app/`
- Login: `https://cargo-track-landing-*.vercel.app/login`
- Admin: `https://cargo-track-landing-*.vercel.app/admin-login`

## ⚠️ Note

The watch script deploys on every file save. For production, use Git integration instead.

