# Automatic Deployment Setup

This project is configured for automatic deployment to Vercel. You have two options:

## Option 1: Git Integration (Recommended for Production)

Vercel automatically deploys when you push to Git. This is the best option for production.

### Setup Steps:

1. **Connect Vercel to Git:**
   ```bash
   # Go to Vercel Dashboard
   # https://vercel.com/dashboard
   
   # Or use CLI:
   npx vercel --prod
   ```

2. **Link to Git Repository:**
   - Go to Vercel Dashboard → Your Project → Settings → Git
   - Connect your GitHub/GitLab/Bitbucket repository
   - Vercel will automatically deploy on every push

3. **Auto-deploy on push:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   # Vercel will automatically deploy!
   ```

## Option 2: Watch Script (For Development)

Automatically deploy on file changes during development.

### Usage:

**Preview Deployments (for testing):**
```bash
npm run watch:preview
```

**Production Deployments:**
```bash
npm run watch
```

**Watch + Local Dev Server:**
```bash
npm run watch:dev
```

### How it works:

- Watches for changes in `.html`, `.js`, `.css`, `.json` files
- Waits 2 seconds after last change (debounce)
- Automatically deploys to Vercel
- Shows deployment URL when complete

### Stop watching:

Press `Ctrl+C` to stop the watcher

## Manual Deployment

**Production:**
```bash
npm run deploy
# or
npx vercel --prod
```

**Preview:**
```bash
npm run deploy:preview
# or
npx vercel
```

## Current Deployment URLs

After deployment, your URLs will be:
- **Landing Page:** `https://your-project.vercel.app/`
- **User Login:** `https://your-project.vercel.app/login`
- **Admin Login:** `https://your-project.vercel.app/admin-login`
- **Dashboard:** `https://your-project.vercel.app/dashboard`

## Troubleshooting

### Watch script not working?
- Make sure `chokidar` is installed: `npm install`
- Check file permissions: `chmod +x watch-deploy.js`

### Git integration not deploying?
- Check Vercel Dashboard → Deployments
- Verify Git repository is connected
- Check deployment logs for errors

### Want to disable auto-deploy?
- Stop the watch script: `Ctrl+C`
- Or disconnect Git integration in Vercel Dashboard

## Best Practices

1. **Development:** Use `watch:preview` for testing changes
2. **Production:** Use Git integration for stable deployments
3. **Quick fixes:** Use manual `deploy` command
4. **Testing:** Always test on preview URL before production

