param(
    [string]$ServerIp = "46.62.174.218",
    [string]$ServerUser = "root",
    [string]$CommitMessage = "deploy-lauta"
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$name) {
    if (!(Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $name"
    }
}

Require-Command git
Require-Command ssh
Require-Command scp

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Deploy LAUTA Restaurant ONLY" -ForegroundColor Cyan
Write-Host "Target: $ServerUser@${ServerIp}:/opt/resturant-website-lauta" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Replace restaurant-config.js with LAUTA version
Write-Host "Step 1: Configuring for LAUTA restaurant..." -ForegroundColor Green
if (Test-Path "public\restaurant-config-lauta.js") {
    Copy-Item -Path "public\restaurant-config-lauta.js" -Destination "public\restaurant-config.js" -Force
    Write-Host "  ✓ LAUTA configuration applied" -ForegroundColor DarkGray
} else {
    Write-Host "  ⊘ public\restaurant-config-lauta.js not found; using existing public\restaurant-config.js" -ForegroundColor DarkGray
}

# Step 2: Commit and push
Write-Host "`nStep 2: Commit and push to repository" -ForegroundColor Green
git add -A
$changes = git status --porcelain
if ($changes) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $msg = "$CommitMessage ($ts)"
    Write-Host "  Committing: $msg" -ForegroundColor Yellow
    git commit -m $msg | Out-Null
} else {
    Write-Host "  No local changes to commit" -ForegroundColor DarkGray
}

Write-Host "  Pushing to origin/main..." -ForegroundColor Yellow
git push origin main

# Step 3: Deploy to LAUTA on server
Write-Host "`nStep 3: Deploy to LAUTA instance on server" -ForegroundColor Green

$remoteScript = @'
set -e

DEPLOY_DIR="/opt/resturant-website-lauta"
PRESERVE_DIR="$DEPLOY_DIR/.preserve"

echo "→ Deploying to LAUTA: $DEPLOY_DIR"

if [ ! -d "$DEPLOY_DIR" ]; then
  echo "ERROR: LAUTA directory does not exist: $DEPLOY_DIR"
  echo "Please run the initial setup first"
  exit 1
fi

cd "$DEPLOY_DIR"

# Preserve production files
echo "  Preserving production data..."
mkdir -p "$PRESERVE_DIR"
[ -f database.json ] && cp database.json "$PRESERVE_DIR/" || true
[ -f .env ] && cp .env "$PRESERVE_DIR/" || true
[ -d uploads ] && cp -r uploads "$PRESERVE_DIR/" || true

# Pull latest code
echo "  Fetching latest code..."
git fetch origin
git reset --hard origin/main

# Restore production files
echo "  Restoring production data..."
[ -f "$PRESERVE_DIR/database.json" ] && cp "$PRESERVE_DIR/database.json" . || true
[ -f "$PRESERVE_DIR/.env" ] && cp "$PRESERVE_DIR/.env" . || true
[ -d "$PRESERVE_DIR/uploads" ] && cp -r "$PRESERVE_DIR/uploads" . || true

# Install dependencies
echo "  Installing dependencies..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Get PM2 process name from .env
PM2_PROCESS="restaurant-backend-lauta"
if [ -f .env ]; then
  ENV_PM2_NAME=$(grep -E '^PM2_(NAME|PROCESS|APP_NAME)=' .env | cut -d= -f2 | tr -d '"' | head -1)
  if [ -n "$ENV_PM2_NAME" ]; then
    PM2_PROCESS="$ENV_PM2_NAME"
  fi
fi

# Restart PM2
echo "  Restarting PM2 process: $PM2_PROCESS"
pm2 restart "$PM2_PROCESS" || pm2 start server.js --name "$PM2_PROCESS"
pm2 save

echo "✓ LAUTA deployment complete!"
'@

ssh "$ServerUser@$ServerIp" "bash -s" <<< $remoteScript

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "DEPLOYMENT SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "LAUTA restaurant updated at: https://lautarestaurant.com" -ForegroundColor Cyan
    Write-Host "BOJOLE restaurant unchanged" -ForegroundColor DarkGray
    Write-Host "`nVerify deployment:" -ForegroundColor Yellow
    Write-Host "  ssh $ServerUser@$ServerIp" -ForegroundColor Gray
    Write-Host "  pm2 status" -ForegroundColor Gray
    Write-Host "  pm2 logs restaurant-backend-lauta --lines 20" -ForegroundColor Gray
} else {
    Write-Host "`nDeployment failed! Check error messages above." -ForegroundColor Red
    exit 1
}

# Step 4: Restore BOJOLE config locally
Write-Host "`nStep 4: Restoring BOJOLE configuration locally..." -ForegroundColor Green
git checkout public/restaurant-config.js
Write-Host "  ✓ Local repository restored to BOJOLE config" -ForegroundColor DarkGray

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Done! 🎉" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
