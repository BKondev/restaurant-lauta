param(
    [string]$ServerIp = "46.62.174.218",
    [string]$ServerUser = "root",
    [string]$DeployDir = "/opt/resturant-website",
    [string]$Branch = "main",
    [string]$RemoteName = "origin",
    [string]$RepoUrl = "",
    [string]$Pm2Process = "restaurant-backend",
    [string]$CommitMessage = "deploy"
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
Write-Host "Git Deployment Script" -ForegroundColor Cyan
Write-Host "Target: $ServerUser@${ServerIp}:$DeployDir" -ForegroundColor Cyan
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

# Commit & push
Write-Host "\nStep 1: Commit and push" -ForegroundColor Green
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

# Deploy on server (init/clone if needed, then hard-reset to remote)
Write-Host "\nStep 2: Pull on server and restart" -ForegroundColor Green

$remoteCmd = @'
set -e
DEPLOY_DIR="__DEPLOY_DIR__"
BRANCH="__BRANCH__"
REMOTE="__REMOTE__"
REPO_URL="__REPO_URL__"
PM2_NAME="__PM2__"

PRESERVE_DIR="$DEPLOY_DIR/.preserve"
TS=$(date +%Y%m%d-%H%M%S)

mkdir -p "$PRESERVE_DIR"

# Preserve production-only files (they should not be committed)
if [ -f "$DEPLOY_DIR/database.json" ]; then
  cp -a "$DEPLOY_DIR/database.json" "$PRESERVE_DIR/database.json.$TS" || true
fi
if [ -f "$DEPLOY_DIR/.env" ]; then
  cp -a "$DEPLOY_DIR/.env" "$PRESERVE_DIR/.env.$TS" || true
fi
if [ -d "$DEPLOY_DIR/uploads" ]; then
  tar -czf "$PRESERVE_DIR/uploads.$TS.tgz" -C "$DEPLOY_DIR" uploads || true
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Installing git..."
  apt-get update -y
  apt-get install -y git
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is not installed on the server. Install Node.js first."
  exit 3
fi

mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

if [ ! -d .git ]; then
  if [ -z "$REPO_URL" ]; then
    echo "ERROR: Repo URL missing on server side."
    exit 2
  fi
  echo "Initializing server repo in $DEPLOY_DIR"
  git init
  git remote add "$REMOTE" "$REPO_URL" || true
fi

# If server working tree has local changes, preserve a patch and force reset.
# (Production should be driven by Git; database/.env/uploads are preserved separately above.)
if [ -d .git ]; then
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
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

# Remove internal/dev docs from the production server
rm -f "$DEPLOY_DIR/GUIDE-AI.md" || true

# Ensure preserved files still exist after switching branches
if [ ! -f "$DEPLOY_DIR/database.json" ] && [ -f "$PRESERVE_DIR/database.json.$TS" ]; then
  cp -a "$PRESERVE_DIR/database.json.$TS" "$DEPLOY_DIR/database.json" || true
fi
if [ ! -f "$DEPLOY_DIR/.env" ] && [ -f "$PRESERVE_DIR/.env.$TS" ]; then
  cp -a "$PRESERVE_DIR/.env.$TS" "$DEPLOY_DIR/.env" || true
fi

echo "Installing dependencies (production)..."
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

# Ensure uploads dir exists (server.js also creates it, but keep it explicit)
mkdir -p uploads

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" || pm2 start server.js --name "$PM2_NAME"
  pm2 save || true
else
  echo "pm2 not found; installing pm2 globally..."
  npm install -g pm2
  pm2 restart "$PM2_NAME" || pm2 start server.js --name "$PM2_NAME"
  pm2 save || true
fi

echo "Deploy done."
'@

$remoteCmd = $remoteCmd.Replace("__DEPLOY_DIR__", $DeployDir)
$remoteCmd = $remoteCmd.Replace("__BRANCH__", $Branch)
$remoteCmd = $remoteCmd.Replace("__REMOTE__", $RemoteName)
$remoteCmd = $remoteCmd.Replace("__REPO_URL__", $RepoUrl)
$remoteCmd = $remoteCmd.Replace("__PM2__", $Pm2Process)

# Avoid fragile quoting: upload a temp script then execute it.
$tmp = [System.IO.Path]::GetTempFileName()
try {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tmp, $remoteCmd, $utf8NoBom)
  scp $tmp "${ServerUser}@${ServerIp}:/tmp/deploy_git.sh" | Out-Null
  ssh ${ServerUser}@${ServerIp} "sed -i 's/\r$//' /tmp/deploy_git.sh; bash /tmp/deploy_git.sh"
} finally {
  Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}

Write-Host "\n========================================" -ForegroundColor Cyan
Write-Host "Git Deployment Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
