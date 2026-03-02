param(
    [string]$ServerIp = "46.62.174.218",
    [string]$ServerUser = "adminuser",
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

run() { "$@"; }

run_maybe_sudo() {
    # Try as current user; if it fails and sudo is available, retry with sudo.
    "$@" && return 0
    if is_root; then
        return 1
    fi
    if command -v sudo >/dev/null 2>&1; then
        sudo -n "$@"
        return $?
    fi
    return 1
}

run_sudo() {
    if is_root; then
        "$@"
        return 0
    fi
    if command -v sudo >/dev/null 2>&1; then
        sudo -n "$@"
        return $?
    fi
    echo "ERROR: sudo not available (and not running as root)" >&2
    return 1
}

# If the deploy directory is root-owned/non-writable, prefer sudo for all filesystem operations
# (avoids confusing permission-denied noise from a first non-sudo attempt).
USE_SUDO_FS=0
run_fs() {
    if [ "${USE_SUDO_FS:-0}" -eq 1 ]; then
        run_sudo "$@"
    else
        "$@"
    fi
}

pm2_bin() {
    command -v pm2 2>/dev/null || true
}

echo "→ Deploying {RESTAURANT_NAME} to $DEPLOY_DIR"

if [ ! -d "$DEPLOY_DIR" ]; then
  echo "ERROR: Directory does not exist: $DEPLOY_DIR"
  echo "Please run initial setup first"
  exit 1
fi

cd "$DEPLOY_DIR"

if [ ! -w "$DEPLOY_DIR" ] || [ ! -w "$DEPLOY_DIR/.git" 2>/dev/null ]; then
    USE_SUDO_FS=1
    echo "WARN: $DEPLOY_DIR not writable by $(id -un); will use sudo for file operations." >&2
fi

# Avoid git safe.directory issues when running under sudo/root.
git config --global --add safe.directory "$DEPLOY_DIR" >/dev/null 2>&1 || true
run_sudo git config --global --add safe.directory "$DEPLOY_DIR" >/dev/null 2>&1 || true

# Preserve production files
echo "  Preserving production data..."
run_fs mkdir -p "$PRESERVE_DIR"
[ -f database.json ] && run_fs cp database.json "$PRESERVE_DIR/" || true
[ -f .env ] && run_fs cp .env "$PRESERVE_DIR/" || true
[ -d uploads ] && run_fs cp -r uploads "$PRESERVE_DIR/" || true

# Pull latest code
echo "  Fetching latest code..."
run_fs git fetch origin
run_fs git reset --hard origin/main 2>/dev/null || run_fs git reset --hard origin/master

# Restore production files
echo "  Restoring production data..."
[ -f "$PRESERVE_DIR/database.json" ] && run_fs cp "$PRESERVE_DIR/database.json" . || true
[ -f "$PRESERVE_DIR/.env" ] && run_fs cp "$PRESERVE_DIR/.env" . || true
[ -d "$PRESERVE_DIR/uploads" ] && run_fs cp -r "$PRESERVE_DIR/uploads" . || true

# Install dependencies
echo "  Installing dependencies..."
run_fs npm ci --omit=dev 2>/dev/null || run_fs npm install --omit=dev

# Get PM2 process name from .env
PM2_PROCESS="restaurant-backend"
if [ "$RESTAURANT_ID" = "rest_lauta_002" ]; then
    PM2_PROCESS="restaurant-backend-lauta"
fi
if [ -f .env ]; then
        ENV_PM2_NAME=$(grep -E '^(PM2_NAME|PM2_PROCESS|PM2_APP_NAME)=' .env | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs)
  if [ -n "$ENV_PM2_NAME" ]; then
    PM2_PROCESS="$ENV_PM2_NAME"
  fi
fi

PM2_BIN=$(pm2_bin)
if [ -z "$PM2_BIN" ] && [ -x /usr/local/bin/pm2 ]; then PM2_BIN=/usr/local/bin/pm2; fi
if [ -z "$PM2_BIN" ] && [ -x /usr/bin/pm2 ]; then PM2_BIN=/usr/bin/pm2; fi
if [ -z "$PM2_BIN" ] && [ -x "$HOME/.npm-global/bin/pm2" ]; then PM2_BIN="$HOME/.npm-global/bin/pm2"; fi
if [ -z "$PM2_BIN" ] && command -v npm >/dev/null 2>&1; then
    NPM_BIN=$(npm bin -g 2>/dev/null || true)
    if [ -n "$NPM_BIN" ] && [ -x "$NPM_BIN/pm2" ]; then PM2_BIN="$NPM_BIN/pm2"; fi
fi

restart_via_systemd_if_present() {
    if ! command -v systemctl >/dev/null 2>&1; then
        return 1
    fi
    # Try to find a unit file that references the deploy dir.
    UNIT_FILE=$(run_sudo sh -lc "grep -Rsl --fixed-strings '$DEPLOY_DIR' /etc/systemd/system /lib/systemd/system 2>/dev/null | head -n 1" || true)
    if [ -n "$UNIT_FILE" ]; then
        UNIT_NAME=$(basename "$UNIT_FILE")
        echo "  Restarting systemd unit: $UNIT_NAME"
        run_sudo systemctl restart "$UNIT_NAME" && return 0
    fi
    # Backwards-compatible guesses
    run_sudo systemctl restart restaurant-lauta.service && return 0
    run_sudo systemctl restart restaurant.service && return 0
    return 1
}

restart_via_pm2_if_present() {
    if [ -z "$PM2_BIN" ]; then
        return 1
    fi
    # Prefer restarting by exec path (reliable even if the process name differs).
    PM2_ID=$(run_sudo -u root sh -lc "env PATH='$PATH:/usr/local/bin:/usr/bin:/bin' '$PM2_BIN' jlist 2>/dev/null" \
      | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const list=JSON.parse(d||'[]');const m=list.find(p=>p?.pm2_env?.pm_exec_path==='$DEPLOY_DIR/server.js');if(m) process.stdout.write(String(m.pm_id));}catch(e){}});")
    if [ -n "$PM2_ID" ]; then
        echo "  Restarting PM2 (root) process id: $PM2_ID"
        run_sudo -u root env PATH="$PATH:/usr/local/bin:/usr/bin:/bin" "$PM2_BIN" restart "$PM2_ID" || return 1
        run_sudo -u root env PATH="$PATH:/usr/local/bin:/usr/bin:/bin" "$PM2_BIN" save || true
        return 0
    fi

    # Fallback to name-based restarts.
    echo "  Restarting PM2 process (by name): $PM2_PROCESS"
    env PATH="$PATH:/usr/local/bin:/usr/bin:$HOME/.npm-global/bin" "$PM2_BIN" restart "$PM2_PROCESS" \
      || run_sudo -u root env PATH="$PATH:/usr/local/bin:/usr/bin:/bin" "$PM2_BIN" restart "$PM2_PROCESS" \
      || return 1
    run_sudo -u root env PATH="$PATH:/usr/local/bin:/usr/bin:/bin" "$PM2_BIN" save || true
    return 0
}

restart_via_pid_fallback() {
    # Last-resort restart if the app is a standalone node process (common when running as root).
    PIDS=$(run_sudo pgrep -f "node .*${DEPLOY_DIR}/server\.js" 2>/dev/null || true)
    if [ -z "$PIDS" ]; then
        return 1
    fi

    echo "  Restarting standalone node process(es): $PIDS"
    run_sudo kill -TERM $PIDS 2>/dev/null || true
    # Wait up to ~10s for shutdown
    for i in $(seq 1 20); do
        STILL=$(run_sudo pgrep -f "node .*${DEPLOY_DIR}/server\.js" 2>/dev/null || true)
        [ -z "$STILL" ] && break
        sleep 0.5
    done

    # Load environment (best-effort) and start again.
    DEFAULT_PORT=""
    if [ "$RESTAURANT_ID" = "rest_lauta_002" ]; then DEFAULT_PORT="3005"; fi
    if [ "$RESTAURANT_ID" = "rest_bojole_001" ]; then DEFAULT_PORT="3004"; fi
    LOG_FILE="/var/log/resturant-website-$RESTAURANT_ID.log"
    run_sudo sh -lc "cd '$DEPLOY_DIR'; set -a; [ -f .env ] && . ./.env >/dev/null 2>&1 || true; set +a; \
        [ -n '$DEFAULT_PORT' ] && [ -z \"$PORT\" ] && export PORT='$DEFAULT_PORT'; \
        [ -z \"$BASE_PATH\" ] && export BASE_PATH='/resturant-website'; \
        nohup /usr/bin/node server.js >>'$LOG_FILE' 2>&1 & disown" || return 1
    return 0
}

echo "  Restarting application..."
restart_via_systemd_if_present \
  || restart_via_pm2_if_present \
  || restart_via_pid_fallback \
  || echo "  WARNING: Could not determine restart mechanism; deployment may require manual restart." >&2

echo "  Deployed commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

if [ -n "$DOMAIN" ] && command -v curl >/dev/null 2>&1; then
    echo "  Health check: https://$DOMAIN"
    curl -fsS "https://$DOMAIN/api/health" || true
    curl -fsS "https://$DOMAIN/resturant-website/api/health" || true
    curl -fsS "https://www.$DOMAIN/api/health" || true
    curl -fsS "https://www.$DOMAIN/resturant-website/api/health" || true
    echo ""
fi

echo "✓ {RESTAURANT_NAME} deployment complete!"
'@

$remoteScript = $remoteScript.Replace("{DEPLOY_DIR}", $targetDir).Replace("{RESTAURANT_NAME}", $restaurantName).Replace("{RESTAURANT_ID}", $restaurantId).Replace("{DOMAIN}", $Domain)

# Convert to Unix line endings (LF only)
$remoteScript = $remoteScript -replace "`r`n", "`n"
$remoteScript = $remoteScript -replace "`r", "`n"

$remoteScript | ssh -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 "$ServerUser@$ServerIp" "bash -s"

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
