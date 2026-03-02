param(
    [string]$ServerIp = "46.62.174.218",
    [string]$ServerUser = "root",
    [string]$CommitMessage = "deploy",
    [string]$DeployDir = ""  # Auto-detected based on restaurant-config.js
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$name) {
    if (!(Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $name"
    }
}

Require-Command git
Require-Command ssh

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Deploy Current Restaurant Repository" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Detect which restaurant this is
$configFile = "public\restaurant-config.js"
if (!(Test-Path $configFile)) {
    throw "restaurant-config.js not found. Are you in the correct directory?"
}

$configContent = Get-Content $configFile -Raw
$restaurantName = "UNKNOWN"
$restaurantId = ""
$targetDir = ""

if ($configContent -match "id:\s*'(rest_\w+)'") {
    $restaurantId = $matches[1]
}

if ($configContent -match "name:\s*'(\w+)'") {
    $restaurantName = $matches[1]
}

# Determine server directory based on restaurant
if ($DeployDir) {
    $targetDir = $DeployDir
} elseif ($restaurantId -eq "rest_bojole_001") {
    $targetDir = "/opt/resturant-website"
} elseif ($restaurantId -eq "rest_lauta_002") {
    $targetDir = "/opt/resturant-website-lauta"
} else {
    throw "Unknown restaurant ID: $restaurantId. Please specify -DeployDir manually."
}

Write-Host "Restaurant: $restaurantName" -ForegroundColor Yellow
Write-Host "Restaurant ID: $restaurantId" -ForegroundColor Yellow
Write-Host "Target Directory: $targetDir" -ForegroundColor Yellow
Write-Host ""

# Confirm we're in a git repo
$isGit = $false
try {
    $isGit = (git rev-parse --is-inside-work-tree 2>$null) -eq "true"
} catch {
    $isGit = $false
}

if (-not $isGit) {
    throw "Not a git repository. Initialize with 'git init' first."
}

# Step 1: Commit and push
Write-Host "Step 1: Commit and push changes" -ForegroundColor Green
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

Write-Host "  Pushing to remote..." -ForegroundColor Yellow
git push

# Step 2: Deploy to server
Write-Host "`nStep 2: Deploy to server: $targetDir" -ForegroundColor Green

$remoteScript = @"
set -e

DEPLOY_DIR="$targetDir"
PRESERVE_DIR="`$DEPLOY_DIR/.preserve"

echo "→ Deploying $restaurantName to `$DEPLOY_DIR"

if [ ! -d "`$DEPLOY_DIR" ]; then
  echo "ERROR: Directory does not exist: `$DEPLOY_DIR"
  echo "Please run initial setup first"
  exit 1
fi

cd "`$DEPLOY_DIR"

# Preserve production files
echo "  Preserving production data..."
mkdir -p "`$PRESERVE_DIR"
[ -f database.json ] && cp database.json "`$PRESERVE_DIR/" || true
[ -f .env ] && cp .env "`$PRESERVE_DIR/" || true
[ -d uploads ] && cp -r uploads "`$PRESERVE_DIR/" || true

# Pull latest code
echo "  Fetching latest code..."
git fetch origin
git reset --hard origin/main 2>/dev/null || git reset --hard origin/master

# Restore production files
echo "  Restoring production data..."
[ -f "`$PRESERVE_DIR/database.json" ] && cp "`$PRESERVE_DIR/database.json" . || true
[ -f "`$PRESERVE_DIR/.env" ] && cp "`$PRESERVE_DIR/.env" . || true
[ -d "`$PRESERVE_DIR/uploads" ] && cp -r "`$PRESERVE_DIR/uploads" . || true

# Install dependencies
echo "  Installing dependencies..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Get PM2 process name from .env
PM2_PROCESS="restaurant-backend"
if [ -f .env ]; then
  ENV_PM2_NAME=`$(grep -E '^PM2_(NAME|PROCESS|APP_NAME)=' .env | cut -d= -f2 | tr -d '"' | head -1)
  if [ -n "`$ENV_PM2_NAME" ]; then
    PM2_PROCESS="`$ENV_PM2_NAME"
  fi
fi

# Restart PM2
echo "  Restarting PM2 process: `$PM2_PROCESS"
pm2 restart "`$PM2_PROCESS" || pm2 start server.js --name "`$PM2_PROCESS"
pm2 save

echo "✓ $restaurantName deployment complete!"
"@

$remoteScript | ssh "$ServerUser@$ServerIp" "bash -s"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "DEPLOYMENT SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "$restaurantName restaurant updated!" -ForegroundColor Cyan
    Write-Host "`nVerify deployment:" -ForegroundColor Yellow
    Write-Host "  ssh $ServerUser@$ServerIp" -ForegroundColor Gray
    Write-Host "  pm2 status" -ForegroundColor Gray
    Write-Host "  cd $targetDir && git log -1 --oneline" -ForegroundColor Gray
} else {
    Write-Host "`nDeployment failed! Check error messages above." -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Done! 🎉" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
