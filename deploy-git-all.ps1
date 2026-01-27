param(
    [string]$ServerIp = "46.62.174.218",
    [string]$ServerUser = "root",

    # Root folder that contains all instances
    [string]$DeployRoot = "/opt",

    # If -DeployDirs is not provided, auto-discover instance folders as: $DeployRoot/$DeployDirGlob
    [string]$DeployDirGlob = "resturant-website*",

    # Explicit list of deploy dirs (overrides auto-discovery)
    [string[]]$DeployDirs = @(),

    [string]$Branch = "main",
    [string]$RemoteName = "origin",
    [string]$RepoUrl = "",

    # Default PM2 name for the primary instance (/opt/resturant-website)
    [string]$DefaultPm2Process = "restaurant-backend",

    [string]$CommitMessage = "deploy-all"
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

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Git Deployment Script (ALL INSTANCES)" -ForegroundColor Cyan
Write-Host "Target: $ServerUser@${ServerIp}:$DeployRoot/$DeployDirGlob" -ForegroundColor Cyan
Write-Host "Branch: $Branch" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Ensure local repo
$inside = $false
try {
    $inside = (git rev-parse --is-inside-work-tree 2>$null) -eq "true"
} catch {
    $inside = $false
}

if (-not $inside) {
    Write-Host "Local folder is not a git repo. Initializing..." -ForegroundColor Yellow
    git init | Out-Null
    git checkout -B $Branch | Out-Null
}

# Ensure remote
$hasRemote = $false
try {
    $remotes = git remote 2>$null
    $hasRemote = $remotes -contains $RemoteName
} catch {
    $hasRemote = $false
}

if (-not $hasRemote) {
    if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
        throw "Git remote '$RemoteName' is not set. Re-run with -RepoUrl <your GitHub repo URL>."
    }
    Write-Host "Adding remote '$RemoteName' => $RepoUrl" -ForegroundColor Green
    git remote add $RemoteName $RepoUrl
}

# If RepoUrl not explicitly provided, use the configured local remote URL.
if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
    try {
        $RepoUrl = (git remote get-url $RemoteName).Trim()
    } catch {
        throw "RepoUrl is empty and could not read remote URL for '$RemoteName'. Pass -RepoUrl explicitly."
    }
}

# Commit & push once
Write-Host "`nStep 1: Commit and push" -ForegroundColor Green

git add -A
$changes = git status --porcelain
if ($changes) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $msg = "$CommitMessage ($ts)"
    Write-Host "Committing: $msg" -ForegroundColor Yellow
    git commit -m $msg | Out-Null
} else {
    Write-Host "No local changes to commit." -ForegroundColor DarkGray
}

Write-Host "Pushing to $RemoteName/$Branch ..." -ForegroundColor Yellow
git push $RemoteName $Branch

Write-Host "`nStep 2: Deploy to ALL instances on server" -ForegroundColor Green

# Serialize explicit dirs (if provided) for the remote script
$deployDirsSerialized = ""
if ($DeployDirs -and $DeployDirs.Count -gt 0) {
    # Use '|' to avoid clashing with spaces
    $deployDirsSerialized = ($DeployDirs -join "|")
}

$remoteCmd = @'
set -e

DEPLOY_ROOT="__DEPLOY_ROOT__"
DIR_GLOB="__DIR_GLOB__"
DEPLOY_DIRS_SERIALIZED="__DEPLOY_DIRS__"
BRANCH="__BRANCH__"
REMOTE="__REMOTE__"
REPO_URL="__REPO_URL__"
DEFAULT_PM2="__DEFAULT_PM2__"

if ! command -v git >/dev/null 2>&1; then
  echo "Installing git..."
  apt-get update -y
  apt-get install -y git
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is not installed on the server. Install Node.js first."
  exit 3
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found; installing pm2 globally..."
  npm install -g pm2
fi

# Build list of instance dirs
INSTANCE_DIRS=""
if [ -n "$DEPLOY_DIRS_SERIALIZED" ]; then
  IFS='|' read -r -a INSTANCE_DIRS <<< "$DEPLOY_DIRS_SERIALIZED"
else
  # Auto-discover
  shopt -s nullglob
  INSTANCE_DIRS=("$DEPLOY_ROOT"/$DIR_GLOB)
  shopt -u nullglob
fi

# Filter out non-instance folders and any weirdly-named directories
FILTERED_INSTANCE_DIRS=()
declare -A SEEN_DIRS
for d in "${INSTANCE_DIRS[@]}"; do
  if [ ! -d "$d" ]; then
    continue
  fi

  base=$(basename "$d")
  base_clean=$(printf '%s' "$base" | tr -d '\r')

  # Skip directories whose name contains a carriage return (breaks discovery/output)
  if [ "$base_clean" != "$base" ]; then
    echo "Skip (invalid dir name contains CR): $d"
    continue
  fi

  # Skip backups folders
  if printf '%s' "$base" | grep -qi 'backup'; then
    echo "Skip (backup dir): $d"
    continue
  fi

  if [ -n "${SEEN_DIRS[$d]+x}" ]; then
    continue
  fi
  SEEN_DIRS[$d]=1
  FILTERED_INSTANCE_DIRS+=("$d")
done
INSTANCE_DIRS=("${FILTERED_INSTANCE_DIRS[@]}")

if [ ${#INSTANCE_DIRS[@]} -eq 0 ]; then
  echo "No instance folders found. Check DeployRoot/DeployDirGlob or pass -DeployDirs explicitly."
  exit 4
fi

echo "Found ${#INSTANCE_DIRS[@]} instance(s)."

restart_one() {
  local DIR="$1"

  if [ ! -d "$DIR" ]; then
    echo "Skip (not a dir): $DIR"
    return 0
  fi

  echo "----------------------------------------"
  echo "Deploying: $DIR"

  local PRESERVE_DIR="$DIR/.preserve"
  local TS
  TS=$(date +%Y%m%d-%H%M%S)
  mkdir -p "$PRESERVE_DIR"

  # Preserve production-only files
  if [ -f "$DIR/database.json" ]; then
    cp -a "$DIR/database.json" "$PRESERVE_DIR/database.json.$TS" || true
  fi
  if [ -f "$DIR/.env" ]; then
    cp -a "$DIR/.env" "$PRESERVE_DIR/.env.$TS" || true
  fi
  if [ -d "$DIR/uploads" ]; then
    tar -czf "$PRESERVE_DIR/uploads.$TS.tgz" -C "$DIR" uploads || true
  fi

  mkdir -p "$DIR"
  cd "$DIR"

  if [ ! -d .git ]; then
    echo "Initializing server repo in $DIR"
    git init
    git remote add "$REMOTE" "$REPO_URL" || true
  fi

  # If server working tree has local changes, preserve a patch and force reset.
  # (database/.env/uploads are preserved separately above.)
  if [ -d .git ]; then
    # Ignore untracked files (like .preserve/) when checking for local changes.
    if [ -n "$(git status --porcelain -uno 2>/dev/null)" ]; then
      echo "Server repo has local changes; preserving patch and resetting..."
      git diff > "$PRESERVE_DIR/local-changes.$TS.patch" || true
      git diff --cached > "$PRESERVE_DIR/local-staged.$TS.patch" || true
      git reset --hard || true
      # Keep backups/uploads while cleaning untracked repo junk
      git clean -fd -e .preserve -e uploads || true
    fi
  fi

  git remote set-url "$REMOTE" "$REPO_URL" || true
  git fetch "$REMOTE" --prune
  git checkout -f -B "$BRANCH" "$REMOTE/$BRANCH"
  git reset --hard "$REMOTE/$BRANCH"

  # Remove internal/dev docs from production
  rm -f "$DIR/GUIDE-AI.md" || true

  # Restore preserved files if missing
  if [ ! -f "$DIR/database.json" ] && [ -f "$PRESERVE_DIR/database.json.$TS" ]; then
    cp -a "$PRESERVE_DIR/database.json.$TS" "$DIR/database.json" || true
  fi
  if [ ! -f "$DIR/.env" ] && [ -f "$PRESERVE_DIR/.env.$TS" ]; then
    cp -a "$PRESERVE_DIR/.env.$TS" "$DIR/.env" || true
  fi

  echo "Installing dependencies (production)..."
  if [ -f package-lock.json ]; then
    npm ci --omit=dev
  else
    npm install --omit=dev
  fi

  mkdir -p uploads

  # Determine pm2 process name
  local PM2_NAME=""
  if [ -f "$DIR/.env" ]; then
    PM2_NAME=$(grep -E '^(PM2_NAME|PM2_PROCESS|PM2_APP_NAME)=' "$DIR/.env" | tail -n 1 | cut -d= -f2- | tr -d '\r' | tr -d '"')
  fi

  if [ -z "$PM2_NAME" ]; then
    local base
    base=$(basename "$DIR")
    if [ "$DIR" = "$DEPLOY_ROOT/resturant-website" ] || [ "$base" = "resturant-website" ]; then
      PM2_NAME="$DEFAULT_PM2"
    else
      # Example: restaurant-backend-resturant-website-foo
      PM2_NAME="$DEFAULT_PM2-$base"
    fi
  fi

  echo "Restarting PM2: $PM2_NAME"
  pm2 restart "$PM2_NAME" || pm2 start server.js --name "$PM2_NAME"
}

for d in "${INSTANCE_DIRS[@]}"; do
  restart_one "$d"
done

pm2 save || true

echo "----------------------------------------"
echo "Deploy done for all instances."
'@

$remoteCmd = $remoteCmd.Replace("__DEPLOY_ROOT__", $DeployRoot)
$remoteCmd = $remoteCmd.Replace("__DIR_GLOB__", $DeployDirGlob)
$remoteCmd = $remoteCmd.Replace("__DEPLOY_DIRS__", $deployDirsSerialized)
$remoteCmd = $remoteCmd.Replace("__BRANCH__", $Branch)
$remoteCmd = $remoteCmd.Replace("__REMOTE__", $RemoteName)
$remoteCmd = $remoteCmd.Replace("__REPO_URL__", $RepoUrl)
$remoteCmd = $remoteCmd.Replace("__DEFAULT_PM2__", $DefaultPm2Process)

$tmp = [System.IO.Path]::GetTempFileName()
try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tmp, $remoteCmd, $utf8NoBom)

    scp $tmp "${ServerUser}@${ServerIp}:/tmp/deploy_git_all.sh" | Out-Null
    ssh ${ServerUser}@${ServerIp} "sed -i 's/\r$//' /tmp/deploy_git_all.sh; bash /tmp/deploy_git_all.sh"
} finally {
    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ALL-INSTANCES DEPLOY COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
