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

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Git Deployment Script" -ForegroundColor Cyan
Write-Host "Target: $ServerUser@$ServerIp:$DeployDir" -ForegroundColor Cyan
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

# Deploy on server (clone if needed, then hard-reset to remote)
Write-Host "\nStep 2: Pull on server and restart" -ForegroundColor Green

$remoteCmd = @'
set -e
DEPLOY_DIR="__DEPLOY_DIR__"
BRANCH="__BRANCH__"
REMOTE="__REMOTE__"
REPO_URL="__REPO_URL__"
PM2_NAME="__PM2__"

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

git remote set-url "$REMOTE" "$REPO_URL" || true

git fetch "$REMOTE" --prune

git checkout -B "$BRANCH" "$REMOTE/$BRANCH"

git reset --hard "$REMOTE/$BRANCH"

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
  echo "WARNING: pm2 not installed. Starting with node (not recommended for prod)."
  nohup node server.js >/tmp/restaurant.out 2>&1 &
fi

echo "Deploy done."
'@

$remoteCmd = $remoteCmd.Replace("__DEPLOY_DIR__", $DeployDir)
$remoteCmd = $remoteCmd.Replace("__BRANCH__", $Branch)
$remoteCmd = $remoteCmd.Replace("__REMOTE__", $RemoteName)
$remoteCmd = $remoteCmd.Replace("__REPO_URL__", $RepoUrl)
$remoteCmd = $remoteCmd.Replace("__PM2__", $Pm2Process)

# Run using bash -lc and a heredoc to avoid PowerShell quoting problems
$escaped = $remoteCmd -replace "'","'\\''"
ssh ${ServerUser}@${ServerIp} "bash -lc 'cat > /tmp/deploy_git.sh <<\''EOF\''
$escaped
EOF
bash /tmp/deploy_git.sh'"

Write-Host "\n========================================" -ForegroundColor Cyan
Write-Host "Git Deployment Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
