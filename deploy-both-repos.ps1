param(
    [string]$ServerIp = "46.62.174.218",
    [string]$ServerUser = "adminuser",
    [string]$CommitMessage = "deploy all",
    [string]$BojoleRepoPath = "C:\Users\User\Desktop\resturant-template",
    [string]$LautaRepoPath = "C:\Users\User\Desktop\restaurant-lauta"
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
Write-Host "Deploy BOTH Restaurant Repositories" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Function to deploy a single repo
function Deploy-Repo {
    param(
        [string]$RepoPath,
        [string]$RestaurantName,
        [string]$ServerDir,
        [string]$Message
    )
    
    Write-Host "`n→ Deploying $RestaurantName..." -ForegroundColor Yellow
    Write-Host "  Repo: $RepoPath" -ForegroundColor DarkGray
    Write-Host "  Server: $ServerDir" -ForegroundColor DarkGray
    
    if (!(Test-Path $RepoPath)) {
        Write-Host "  ⚠ Repository not found: $RepoPath" -ForegroundColor Red
        Write-Host "  Skipping $RestaurantName" -ForegroundColor Red
        return $false
    }
    
    Push-Location $RepoPath
    
    try {
        # Commit and push
        git add -A
        $changes = git status --porcelain
        if ($changes) {
            $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $commitMsg = "$Message - $RestaurantName ($ts)"
            Write-Host "  Committing: $commitMsg" -ForegroundColor Gray
            git commit -m $commitMsg | Out-Null
        } else {
            Write-Host "  No changes to commit" -ForegroundColor DarkGray
        }
        
        Write-Host "  Pushing to remote..." -ForegroundColor Gray
        git push
        
        Write-Host "  ✓ $RestaurantName code pushed" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "  ✗ Failed to push $RestaurantName : $_" -ForegroundColor Red
        return $false
    }
    finally {
        Pop-Location
    }
}

# Deploy both repos
Write-Host "Step 1: Push changes to GitHub" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Green

$bojoleSuccess = Deploy-Repo -RepoPath $BojoleRepoPath -RestaurantName "BOJOLE" -ServerDir "/opt/resturant-website" -Message $CommitMessage
$lautaSuccess = Deploy-Repo -RepoPath $LautaRepoPath -RestaurantName "LAUTA" -ServerDir "/opt/resturant-website-lauta" -Message $CommitMessage

if (!$bojoleSuccess -and !$lautaSuccess) {
    Write-Host "`nNo repositories were successfully pushed. Aborting deployment." -ForegroundColor Red
    exit 1
}

# Deploy to server
Write-Host "`n`nStep 2: Deploy to server" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Green

$remoteScript = @'
set -e

# Switch to root for deployment operations
sudo su - << 'ROOTEOF'
set -e

echo "→ Deploying to both restaurants..."

deploy_instance() {
    local DIR=$1
    local NAME=$2
    local PRESERVE_DIR="$DIR/.preserve"
    
    echo ""
    echo "→ Deploying $NAME: $DIR"
    
    if [ ! -d "$DIR" ]; then
        echo "  ⚠ Directory not found: $DIR - Skipping"
        return 1
    fi
    
    cd "$DIR"
    
    # Preserve production files
    echo "  Preserving production data..."
    mkdir -p "$PRESERVE_DIR"
    [ -f database.json ] && cp database.json "$PRESERVE_DIR/" || true
    [ -f .env ] && cp .env "$PRESERVE_DIR/" || true
    [ -d uploads ] && cp -r uploads "$PRESERVE_DIR/" || true
    
    # Pull latest code
    echo "  Fetching latest code..."
    git fetch origin
    git reset --hard origin/main 2>/dev/null || git reset --hard origin/master
    
    # Restore production files
    echo "  Restoring production data..."
    [ -f "$PRESERVE_DIR/database.json" ] && cp "$PRESERVE_DIR/database.json" . || true
    [ -f "$PRESERVE_DIR/.env" ] && cp "$PRESERVE_DIR/.env" . || true
    [ -d "$PRESERVE_DIR/uploads" ] && cp -r "$PRESERVE_DIR/uploads" . || true
    
    # Install dependencies
    echo "  Installing dependencies..."
    npm ci --omit=dev 2>/dev/null || npm install --omit=dev
    
    # Get PM2 process name from .env
    PM2_PROCESS="restaurant-backend"
    if [ -f .env ]; then
        ENV_PM2_NAME=$(grep -E '^PM2_(NAME|PROCESS|APP_NAME)=' .env | cut -d= -f2 | tr -d '"' | head -1)
        if [ -n "$ENV_PM2_NAME" ]; then
            PM2_PROCESS="$ENV_PM2_NAME"
        fi
    fi
    
    # Restart PM2
    echo "  Restarting PM2 process: $PM2_PROCESS"
    pm2 restart "$PM2_PROCESS" || pm2 start server.js --name "$PM2_PROCESS"
    
    echo "  ✓ $NAME deployment complete!"
    return 0
}

# Deploy both instances
BOJOLE_SUCCESS=0
LAUTA_SUCCESS=0

deploy_instance "/opt/resturant-website" "BOJOLE" && BOJOLE_SUCCESS=1 || BOJOLE_SUCCESS=0
deploy_instance "/opt/resturant-website-lauta" "LAUTA" && LAUTA_SUCCESS=1 || LAUTA_SUCCESS=0

# Save PM2 state
pm2 save

echo ""
echo "========================================"
echo "DEPLOYMENT SUMMARY"
echo "========================================"
if [ $BOJOLE_SUCCESS -eq 1 ]; then
    echo "✓ BOJOLE: Success"
else
    echo "✗ BOJOLE: Failed"
fi

if [ $LAUTA_SUCCESS -eq 1 ]; then
    echo "✓ LAUTA: Success"
else
    echo "✗ LAUTA: Failed"
fi
echo "========================================"

if [ $BOJOLE_SUCCESS -eq 1 ] || [ $LAUTA_SUCCESS -eq 1 ]; then
    exit 0
else
    exit 1
fi

ROOTEOF
'@

$remoteScript | ssh "$ServerUser@$ServerIp" "bash -s"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "DEPLOYMENT SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Both restaurants updated!" -ForegroundColor Cyan
    Write-Host "`nURLs:" -ForegroundColor Yellow
    Write-Host "  BOJOLE: https://bojole.bg" -ForegroundColor Gray
    Write-Host "  LAUTA:  https://lautarestaurant.com" -ForegroundColor Gray
    Write-Host "`nVerify:" -ForegroundColor Yellow
    Write-Host "  ssh $ServerUser@$ServerIp" -ForegroundColor Gray
    Write-Host "  pm2 status" -ForegroundColor Gray
} else {
    Write-Host "`nDeployment had errors. Check messages above." -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Done! 🎉" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
