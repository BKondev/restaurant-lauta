param(
    [string]$ServerIp = "46.62.174.218",
    [string]$ServerUser = "root",
    [string]$CommitMessage = "deploy",
    [string]$DeployDir = "",  # Auto-detected based on restaurant-config.js
    [string]$Domain = ""      # Optional; auto-detected from restaurant id
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

if ($configContent -match 'id:\s*''(rest_\w+)''') {
    $restaurantId = $matches[1]
}

if ($configContent -match 'name:\s*''([^'']+)''') {
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

# Auto-detect domain for post-deploy verification
if (-not $Domain) {
    if ($restaurantId -eq "rest_bojole_001") {
        $Domain = "bojole.bg"
    } elseif ($restaurantId -eq "rest_lauta_002") {
        $Domain = "lautarestaurant.com"
    }
}

Write-Host "Restaurant: $restaurantName" -ForegroundColor Yellow
Write-Host "Restaurant ID: $restaurantId" -ForegroundColor Yellow
Write-Host "Target Directory: $targetDir" -ForegroundColor Yellow
if ($Domain) {
    Write-Host "Domain: $Domain" -ForegroundColor Yellow
}
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

$remoteScript = @'
set -e

DEPLOY_DIR="{DEPLOY_DIR}"
PRESERVE_DIR="$DEPLOY_DIR/.preserve"
RESTAURANT_ID="{RESTAURANT_ID}"
DOMAIN="{DOMAIN}"

is_root() { [ "$(id -u)" -eq 0 ]; }

run() {
    if is_root; then
        "$@"
    else
        if command -v sudo >/dev/null 2>&1; then
            sudo -n "$@"
        else
            echo "ERROR: sudo not available (and not running as root)" >&2
            exit 1
        fi
    fi
}

pm2_bin() {
    # sudo can drop PATH; try common locations too.
    command -v pm2 2>/dev/null || true
}

echo "→ Deploying {RESTAURANT_NAME} to $DEPLOY_DIR"

if [ ! -d "$DEPLOY_DIR" ]; then
  echo "ERROR: Directory does not exist: $DEPLOY_DIR"
  echo "Please run initial setup first"
  exit 1
fi

cd "$DEPLOY_DIR"

# Avoid git safe.directory issues when running under sudo/root.
run git config --global --add safe.directory "$DEPLOY_DIR" >/dev/null 2>&1 || true

# Preserve production files
echo "  Preserving production data..."
run mkdir -p "$PRESERVE_DIR"
[ -f database.json ] && run cp database.json "$PRESERVE_DIR/" || true
[ -f .env ] && run cp .env "$PRESERVE_DIR/" || true
[ -d uploads ] && run cp -r uploads "$PRESERVE_DIR/" || true

# Pull latest code
echo "  Fetching latest code..."
run git fetch origin
run git reset --hard origin/main 2>/dev/null || run git reset --hard origin/master

# Restore production files
echo "  Restoring production data..."
[ -f "$PRESERVE_DIR/database.json" ] && run cp "$PRESERVE_DIR/database.json" . || true
[ -f "$PRESERVE_DIR/.env" ] && run cp "$PRESERVE_DIR/.env" . || true
[ -d "$PRESERVE_DIR/uploads" ] && run cp -r "$PRESERVE_DIR/uploads" . || true

# Install dependencies
echo "  Installing dependencies..."
run npm ci --omit=dev 2>/dev/null || run npm install --omit=dev

# Get PM2 process name from .env
PM2_PROCESS="restaurant-backend"
if [ "$RESTAURANT_ID" = "rest_lauta_002" ]; then
    PM2_PROCESS="restaurant-backend-lauta"
fi
if [ -f .env ]; then
    ENV_PM2_NAME=$(run grep -E '^(PM2_NAME|PM2_PROCESS|PM2_APP_NAME)=' .env | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs)
  if [ -n "$ENV_PM2_NAME" ]; then
    PM2_PROCESS="$ENV_PM2_NAME"
  fi
fi

PM2_BIN=$(pm2_bin)
if [ -z "$PM2_BIN" ] && [ -x /usr/local/bin/pm2 ]; then PM2_BIN=/usr/local/bin/pm2; fi
if [ -z "$PM2_BIN" ] && [ -x /usr/bin/pm2 ]; then PM2_BIN=/usr/bin/pm2; fi

# Restart PM2
echo "  Restarting PM2 process: $PM2_PROCESS"
if [ -n "$PM2_BIN" ]; then
    # Ensure common npm global bin locations are in PATH
    run env PATH="$PATH:/usr/local/bin:/usr/bin" "$PM2_BIN" restart "$PM2_PROCESS" || run env PATH="$PATH:/usr/local/bin:/usr/bin" "$PM2_BIN" start server.js --name "$PM2_PROCESS"
    run env PATH="$PATH:/usr/local/bin:/usr/bin" "$PM2_BIN" save || true
else
    echo "  WARNING: pm2 not found; trying systemd..."
    if command -v systemctl >/dev/null 2>&1; then
        run systemctl restart restaurant.service || true
        run systemctl restart restaurant-lauta.service || true
    fi
fi

echo "  Deployed commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

if [ -n "$DOMAIN" ] && command -v curl >/dev/null 2>&1; then
    echo "  Health check: https://$DOMAIN/api/health"
    curl -fsS "https://$DOMAIN/api/health" || curl -fsS "https://www.$DOMAIN/api/health" || true
    echo ""
fi

echo "✓ {RESTAURANT_NAME} deployment complete!"
'@

$remoteScript = $remoteScript.Replace("{DEPLOY_DIR}", $targetDir).Replace("{RESTAURANT_NAME}", $restaurantName).Replace("{RESTAURANT_ID}", $restaurantId).Replace("{DOMAIN}", $Domain)

# Convert to Unix line endings (LF only)
$remoteScript = $remoteScript -replace "`r`n", "`n"
$remoteScript = $remoteScript -replace "`r", "`n"

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
