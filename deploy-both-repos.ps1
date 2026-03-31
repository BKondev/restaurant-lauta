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
    
    Write-Host "`n-> Deploying $RestaurantName..." -ForegroundColor Yellow
    Write-Host "  Repo: $RepoPath" -ForegroundColor DarkGray
    Write-Host "  Server: $ServerDir" -ForegroundColor DarkGray
    
    if (!(Test-Path $RepoPath)) {
        Write-Host "  WARNING: Repository not found: $RepoPath" -ForegroundColor Red
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
        
        Write-Host "  OK: $RestaurantName code pushed" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "  FAILED to push $RestaurantName : $_" -ForegroundColor Red
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

$remoteScriptLines = @(
    'set -e',
    '',
    'echo "Deploying to both restaurants..."',
    '',
    'deploy_instance() {',
    '  local DIR="$1"',
    '  local NAME="$2"',
    '  local PRESERVE_DIR="${DIR}/.preserve"',
    '',
    '  echo ""',
    '  echo "Deploying ${NAME}: ${DIR}"',
    '',
    '  if [ ! -d "${DIR}" ]; then',
    '    echo "  Directory not found: ${DIR} - Skipping"',
    '    return 1',
    '  fi',
    '',
    '  cd "${DIR}"',
    '',
    '  echo "  Preserving production data..."',
    '  sudo mkdir -p "${PRESERVE_DIR}"',
    '  [ -f database.json ] && sudo cp database.json "${PRESERVE_DIR}/" || true',
    '  [ -f .env ] && sudo cp .env "${PRESERVE_DIR}/" || true',
    '  [ -d uploads ] && sudo cp -r uploads "${PRESERVE_DIR}/" || true',
    '',
    '  echo "  Fetching latest code..."',
    '  sudo git fetch origin',
    '  sudo git reset --hard origin/main 2>/dev/null || sudo git reset --hard origin/master',
    '',
    '  echo "  Restoring production data..."',
    '  [ -f "${PRESERVE_DIR}/database.json" ] && sudo cp "${PRESERVE_DIR}/database.json" . || true',
    '  [ -f "${PRESERVE_DIR}/.env" ] && sudo cp "${PRESERVE_DIR}/.env" . || true',
    '  [ -d "${PRESERVE_DIR}/uploads" ] && sudo cp -r "${PRESERVE_DIR}/uploads" . || true',
    '',
    '  echo "  Installing dependencies..."',
    '  sudo npm ci --omit=dev 2>/dev/null || sudo npm install --omit=dev',
    '',
    '  # BOJOLE is served by systemd (restaurant.service) on this server.',
    '  # LAUTA continues to run via PM2.',
    '  if [ "${DIR}" = "/opt/resturant-website" ]; then',
    '    echo "  Restarting systemd service: restaurant.service"',
    '    sudo systemctl restart restaurant.service',
    '  else',
    '    PM2_PROCESS="restaurant-backend"',
    '    if [ -f .env ]; then',
    '      ENV_PM2_NAME=$(sudo grep -E "^PM2_(NAME|PROCESS|APP_NAME)=" .env | cut -d= -f2 | head -1)',
    '      ENV_PM2_NAME=${ENV_PM2_NAME%\"}',
    '      ENV_PM2_NAME=${ENV_PM2_NAME#\"}',
    '      if [ -n "${ENV_PM2_NAME}" ]; then',
    '        PM2_PROCESS="${ENV_PM2_NAME}"',
    '      fi',
    '    fi',
    '',
    '    echo "  Restarting PM2 process: ${PM2_PROCESS}"',
    '    sudo pm2 restart "${PM2_PROCESS}" || sudo pm2 start server.js --name "${PM2_PROCESS}"',
    '  fi',
    '',
    '  echo "  ${NAME} deployment complete"',
    '  return 0',
    '}',
    '',
    'BOJOLE_SUCCESS=0',
    'LAUTA_SUCCESS=0',
    '',
    'if deploy_instance "/opt/resturant-website" "BOJOLE"; then BOJOLE_SUCCESS=1; fi',
    'if deploy_instance "/opt/resturant-website-lauta" "LAUTA"; then LAUTA_SUCCESS=1; fi',
    '',
    '# Persist PM2 process list (LAUTA)',
    'if command -v pm2 >/dev/null 2>&1; then sudo pm2 save; fi',
    '',
    'echo ""',
    'echo "========================================"',
    'echo "DEPLOYMENT SUMMARY"',
    'echo "========================================"',
    'if [ ${BOJOLE_SUCCESS} -eq 1 ]; then echo "BOJOLE: Success"; else echo "BOJOLE: Failed"; fi',
    'if [ ${LAUTA_SUCCESS} -eq 1 ]; then echo "LAUTA: Success"; else echo "LAUTA: Failed"; fi',
    'echo "========================================"',
    '',
    'if [ ${BOJOLE_SUCCESS} -eq 1 ] || [ ${LAUTA_SUCCESS} -eq 1 ]; then exit 0; else exit 1; fi'
)

$remoteScript = ($remoteScriptLines -join "`n")

# Convert to Unix line endings (LF only)
$remoteScript = $remoteScript -replace "`r`n", "`n"
$remoteScript = $remoteScript -replace "`r", "`n"

$tmpRemoteScriptPath = Join-Path $env:TEMP ("deploy-both-repos-remote-{0}.sh" -f ([Guid]::NewGuid().ToString("N")))
try {
    # Write as UTF-8 without BOM to avoid remote bash parsing issues.
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tmpRemoteScriptPath, ($remoteScript + "`n"), $utf8NoBom)

    # Windows PowerShell 5.1 does not support `< file` redirection; use cmd.exe for that.
    $sshTarget = "$ServerUser@$ServerIp"
    $cmdLine = "ssh $sshTarget `"bash -s`" < `"$tmpRemoteScriptPath`""
    cmd /c $cmdLine
}
finally {
    Remove-Item -LiteralPath $tmpRemoteScriptPath -ErrorAction SilentlyContinue
}

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
Write-Host "Done!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
