#!/usr/bin/env node

/**
 * Auto-deploy script for Vercel
 * Watches for file changes and automatically deploys to Vercel
 */

const { exec } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');

let deployTimeout = null;
const DEPLOY_DELAY = 2000; // Wait 2 seconds after last change before deploying
let isDeploying = false;

console.log('🚀 Auto-deploy watcher started...');
console.log('📁 Watching for file changes...\n');

// Watch all relevant files
const watcher = chokidar.watch([
  '**/*.html',
  '**/*.js',
  '**/*.css',
  '**/*.json',
  '**/*.md',
  '**/*.txt',
  '**/*.xml'
], {
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/.vercel/**',
    '**/package-lock.json',
    '**/*.log'
  ],
  persistent: true,
  ignoreInitial: true
});

function deploy() {
  if (isDeploying) {
    console.log('⏳ Deployment already in progress, skipping...');
    return;
  }

  isDeploying = true;
  console.log('\n📦 Changes detected! Deploying to Vercel...\n');
  
  const deployCommand = process.env.VERCEL_PREVIEW === 'true' 
    ? 'npx vercel' 
    : 'npx vercel --prod';

  exec(deployCommand, (error, stdout, stderr) => {
    isDeploying = false;
    
    if (error) {
      console.error('❌ Deployment failed:', error.message);
      if (stderr) console.error(stderr);
      return;
    }
    
    // Extract URL from output
    const urlMatch = stdout.match(/https:\/\/[^\s]+/);
    if (urlMatch) {
      console.log('✅ Deployment successful!');
      console.log('🌐 URL:', urlMatch[0]);
    } else {
      console.log('✅ Deployment completed');
    }
    console.log('\n👀 Watching for changes...\n');
  });
}

watcher
  .on('add', file => {
    console.log(`📄 File added: ${path.relative(process.cwd(), file)}`);
    scheduleDeploy();
  })
  .on('change', file => {
    console.log(`✏️  File changed: ${path.relative(process.cwd(), file)}`);
    scheduleDeploy();
  })
  .on('unlink', file => {
    console.log(`🗑️  File deleted: ${path.relative(process.cwd(), file)}`);
    scheduleDeploy();
  })
  .on('error', error => {
    console.error('❌ Watcher error:', error);
  })
  .on('ready', () => {
    console.log('✅ Watcher ready! All files are being monitored.\n');
  });

function scheduleDeploy() {
  // Clear existing timeout
  if (deployTimeout) {
    clearTimeout(deployTimeout);
  }
  
  // Schedule new deployment
  deployTimeout = setTimeout(() => {
    deploy();
  }, DEPLOY_DELAY);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping watcher...');
  watcher.close();
  if (deployTimeout) {
    clearTimeout(deployTimeout);
  }
  process.exit(0);
});

