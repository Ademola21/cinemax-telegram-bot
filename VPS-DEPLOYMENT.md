# VPS Deployment Guide

This guide will help you deploy the Cinemax AI Platform to your VPS (Virtual Private Server).

## Prerequisites

Your VPS should have:
- **Node.js 18+** (required for yt-dlp-exec and modern JavaScript features)
- **Git** (to clone the repository)
- **PM2** (optional, for process management)
- **FFmpeg** (for video/audio processing)

## Step 1: Server Setup

```bash
# Update your system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 (using NodeSource repository)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg for video/audio processing
sudo apt install ffmpeg -y

# Verify installations
node --version  # Should be v18.x.x
ffmpeg -version  # Should show FFmpeg version

# Note: yt-dlp-exec (Node.js package) will be installed automatically via npm install

# Optional: Install PM2 for process management
sudo npm install -g pm2
```

## Step 2: Deploy Your Application

```bash
# Clone your repository (replace with your repo URL)
git clone <your-repo-url>
cd cinemax-ai-platform

# Install dependencies
npm install

# Build the application (includes Tailwind CSS compilation)
npm run build

# IMPORTANT: For production deployments, ensure Tailwind CSS is built into your bundle
# The CDN version (cdn.tailwindcss.com) should NOT be used in production
```

## Step 3: Environment Configuration

Create a `.env` file in your project root:

```bash
# VPS Configuration
NODE_ENV=production
PORT=5019

# Security Configuration (REQUIRED - Generate with command below)
SESSION_ENCRYPTION_KEY=your-32-byte-base64-encoded-key
CSRF_SECRET=your-32-byte-base64-encoded-secret

# Telegram Bot Configuration (optional)
TELEGRAM_BOT_TOKEN=your-bot-token
ADMIN_TELEGRAM_USER_ID=your-user-id

# Azure Storage Configuration (optional - for poster uploads)
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_CONTAINER_NAME=media
CDN_BASE_URL=your-cdn-url

# YouTube API (optional - for enhanced video info)
YOUTUBE_API_KEY=your-youtube-api-key
```

**Note**: Cinemax AI works completely offline without external AI services. No AI API keys required!

**Generate Security Keys:**
```bash
# Generate SESSION_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate CSRF_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

⚠️ **IMPORTANT**: The application will NOT start without these security keys!

## Step 4: Start the Application

### Option A: Direct Start
```bash
# Start in production mode
npm start
```

### Option B: Using PM2 (Recommended)
```bash
# Start with PM2
pm2 start npm --name "cinemax-ai" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown by the command above
```

## Step 5: Configure Firewall

Make sure port 5019 is open:

```bash
# For UFW (Ubuntu Firewall)
sudo ufw allow 5019

# For iptables
sudo iptables -A INPUT -p tcp --dport 5019 -j ACCEPT
```

## Step 6: Access Your Application

Your application will be available at:
- `http://your-vps-ip:5019`
- Or configure a domain with a reverse proxy (nginx/apache)

## Troubleshooting

### Cinemax AI Features Not Working
If you see "AI service temporarily unavailable" errors:

1. **Check Cinemax AI Service:**
   ```bash
   # Test AI endpoint
   curl http://localhost:5019/api/cinemax-ai
   ```

2. **Verify Application Logs:**
   ```bash
   # Check if AI is initializing properly
   pm2 logs cinemax-ai
   ```

3. **Restart Service:**
   ```bash
   pm2 restart cinemax-ai
   ```

**Note**: Cinemax AI runs locally and doesn't require external API connections.

### YouTube Downloader Not Working
If you see YouTube downloader errors:

1. **Check yt-dlp-exec installation:**
   ```bash
   # Verify Node.js dependencies are installed
   npm install
   
   # Test the YouTube functionality
   curl http://localhost:5019/api/test-ytdlp
   ```

2. **Check FFmpeg installation:**
   ```bash
   ffmpeg -version
   
   # Install if missing
   sudo apt install ffmpeg -y
   ```

3. **Network Issues:**
   ```bash
   # Test YouTube connectivity
   curl -I https://youtube.com
   ```

### General Debug Steps

1. **Check Application Logs:**
   ```bash
   # If using PM2
   pm2 logs cinemax-ai
   
   # If running directly
   npm start  # Check console output
   ```

2. **Test API Endpoints:**
   ```bash
   # Test yt-dlp
   curl http://localhost:5019/api/test-ytdlp
   
   # Test server health
   curl http://localhost:5019/
   ```

3. **Check Process:**
   ```bash
   # See if app is running
   netstat -tlnp | grep 5019
   ps aux | grep node
   ```

## Reverse Proxy Setup (Optional)

To use a domain name instead of IP:port, configure nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5019;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Hardening (Recommended)

### Remove Tailwind CDN for Production

The application currently uses `cdn.tailwindcss.com` for development convenience. For production:

1. **Build Tailwind into your bundle** (already done by `npm run build`)
2. **Remove CDN reference** from `index.html` if present
3. **Tighten CSP** in `api/securityHeaders.ts` by removing CDN domains

This will eliminate the need for `'unsafe-inline'` and `'unsafe-eval'` in the Content Security Policy, significantly improving XSS protection.

## Maintenance

```bash
# Update application
git pull
npm install
npm run build
pm2 restart cinemax-ai

# Monitor logs
pm2 monit

# Backup data files
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

## Need Help?

- Check the console logs for specific error messages
- Ensure all environment variables are correctly set
- Verify network connectivity to external services
- Contact your VPS provider for network-related issues