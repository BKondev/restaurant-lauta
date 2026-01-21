# PowerShell Deployment Script for Restaurant Menu
# Target: www.crystalautomation.eu/resturant-website
# Server: 46.62.174.218

# NOTE (2026-01-21): Prefer git-based deploy to avoid SCP/PowerShell quoting issues.
# Use: .\deploy-git.ps1 -RepoUrl "<YOUR_GITHUB_REPO_URL>" -CommitMessage "deploy"

$SERVER_IP = "46.62.174.218"
$SERVER_USER = "root"
$DEPLOY_DIR = "/opt/resturant-website"
$LOCAL_DIR = "C:\Users\User\Desktop\resturant-template"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Restaurant Menu Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if SCP is available
if (!(Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: SCP not found. Please install OpenSSH Client:" -ForegroundColor Red
    Write-Host "  1. Settings > Apps > Optional Features" -ForegroundColor Yellow
    Write-Host "  2. Add a feature > OpenSSH Client" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Testing SSH connection..." -ForegroundColor Green
ssh -o ConnectTimeout=5 ${SERVER_USER}@${SERVER_IP} "echo 'Connection successful!'"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot connect to server. Check IP and SSH access." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Creating directories on server..." -ForegroundColor Green
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p $DEPLOY_DIR"

Write-Host ""
Write-Host "Step 3: Uploading project files..." -ForegroundColor Green
Write-Host "  This may take a few minutes..." -ForegroundColor Yellow

# Upload files (excluding node_modules and other unnecessary files)
scp -r "$LOCAL_DIR\server.js" "${SERVER_USER}@${SERVER_IP}:${DEPLOY_DIR}/"
scp -r "$LOCAL_DIR\package.json" "${SERVER_USER}@${SERVER_IP}:${DEPLOY_DIR}/"
scp -r "$LOCAL_DIR\package-lock.json" "${SERVER_USER}@${SERVER_IP}:${DEPLOY_DIR}/" 2>$null
# Skip database.json to preserve server data (slides, cities, orders, etc.)
# scp -r "$LOCAL_DIR\database.json" "${SERVER_USER}@${SERVER_IP}:${DEPLOY_DIR}/"
scp -r "$LOCAL_DIR\public" "${SERVER_USER}@${SERVER_IP}:${DEPLOY_DIR}/"
scp -r "$LOCAL_DIR\deploy.sh" "${SERVER_USER}@${SERVER_IP}:${DEPLOY_DIR}/"

# Create uploads directory
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${DEPLOY_DIR}/uploads"

Write-Host ""
Write-Host "Step 4: Running deployment script on server..." -ForegroundColor Green
ssh ${SERVER_USER}@${SERVER_IP} "cd $DEPLOY_DIR && chmod +x deploy.sh && ./deploy.sh"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your restaurant menu is now live at:" -ForegroundColor Green
Write-Host "  Menu:  http://www.crystalautomation.eu/resturant-website/" -ForegroundColor Yellow
Write-Host "  Admin: http://www.crystalautomation.eu/resturant-website/admin" -ForegroundColor Yellow
Write-Host "  Login: http://www.crystalautomation.eu/resturant-website/login" -ForegroundColor Yellow
Write-Host ""
Write-Host "Default credentials:" -ForegroundColor Cyan
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Install SSL certificate for HTTPS:" -ForegroundColor Red
Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Yellow
Write-Host "  certbot --nginx -d crystalautomation.eu -d www.crystalautomation.eu" -ForegroundColor Yellow
Write-Host ""
Write-Host "View logs:" -ForegroundColor Cyan
Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Yellow
Write-Host "  journalctl -u restaurant.service -f" -ForegroundColor Yellow
Write-Host ""
