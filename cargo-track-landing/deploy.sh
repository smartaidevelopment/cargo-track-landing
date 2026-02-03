#!/bin/bash

# CargoTrack Pro Deployment Script
# This script helps prepare and deploy the application

echo "🚀 CargoTrack Pro Deployment Helper"
echo "===================================="
echo ""

# Check if files exist
echo "📋 Checking files..."
files=("index.html" "login.html" "dashboard.html" "styles.css" "dashboard.css" "script.js" "auth.js" "login.js" "dashboard.js")
missing_files=()

for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ All required files present"
else
    echo "❌ Missing files: ${missing_files[*]}"
    exit 1
fi

echo ""
echo "📦 Deployment Options:"
echo "1. Vercel (recommended)"
echo "2. Netlify"
echo "3. GitHub Pages"
echo "4. Test locally"
echo ""
read -p "Select option (1-4): " option

case $option in
    1)
        echo ""
        echo "Deploying to Vercel..."
        if command -v vercel &> /dev/null; then
            vercel
        else
            echo "Vercel CLI not found. Install with: npm install -g vercel"
            echo "Or visit: https://vercel.com and drag & drop this folder"
        fi
        ;;
    2)
        echo ""
        echo "Deploying to Netlify..."
        if command -v netlify &> /dev/null; then
            netlify deploy --prod
        else
            echo "Netlify CLI not found. Install with: npm install -g netlify-cli"
            echo "Or visit: https://netlify.com and drag & drop this folder"
        fi
        ;;
    3)
        echo ""
        echo "GitHub Pages Setup:"
        echo "1. Create a GitHub repository"
        echo "2. Push this folder to the repository"
        echo "3. Go to Settings → Pages"
        echo "4. Select 'main' branch and '/ (root)' folder"
        echo "5. Your site will be live at: https://YOUR_USERNAME.github.io/REPO_NAME/"
        ;;
    4)
        echo ""
        echo "Starting local server..."
        if command -v python3 &> /dev/null; then
            echo "Server running at: http://localhost:8000"
            python3 -m http.server 8000
        elif command -v python &> /dev/null; then
            echo "Server running at: http://localhost:8000"
            python -m SimpleHTTPServer 8000
        elif command -v npx &> /dev/null; then
            echo "Server running at: http://localhost:3000"
            npx serve . -l 3000
        else
            echo "No server found. Install Python or Node.js, or open index.html directly in browser"
        fi
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

