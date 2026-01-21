# ============================================
# MULTI-TENANT DEPLOYMENT SCRIPT
# Deploy updated multi-tenant system to server
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "MULTI-TENANT RESTAURANT SYSTEM DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$SERVER = "root@46.62.174.218"
$REMOTE_PATH = "/root/resturant-website"
$LOCAL_PATH = "C:\Users\User\Desktop\resturant-template"

# Step 1: Backup current database
Write-Host "[1/6] Backing up current database..." -ForegroundColor Yellow
ssh $SERVER "cp $REMOTE_PATH/database.json $REMOTE_PATH/database.json.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database backed up successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Backup failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Upload updated server.js
Write-Host "`n[2/6] Uploading updated server.js..." -ForegroundColor Yellow
scp "$LOCAL_PATH\server.js" "${SERVER}:${REMOTE_PATH}/server.js"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ server.js uploaded successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Upload failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Upload updated database.json (with restaurants array)
Write-Host "`n[3/6] Uploading updated database.json..." -ForegroundColor Yellow
$uploadDb = Read-Host "Upload database.json? (y/n)"

if ($uploadDb -eq 'y') {
    scp "$LOCAL_PATH\database.json" "${SERVER}:${REMOTE_PATH}/database.json"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ database.json uploaded successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Upload failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⊘ Skipped database.json upload" -ForegroundColor Gray
    Write-Host "  Remember to manually add 'restaurants' array!" -ForegroundColor Yellow
}

# Step 4: Restart service
Write-Host "`n[4/6] Restarting restaurant service..." -ForegroundColor Yellow
ssh $SERVER "systemctl restart restaurant.service"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Service restarted successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Service restart failed!" -ForegroundColor Red
    exit 1
}

# Wait for service to start
Start-Sleep -Seconds 3

# Step 5: Check service status
Write-Host "`n[5/6] Checking service status..." -ForegroundColor Yellow
ssh $SERVER "systemctl is-active restaurant.service"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Service is running" -ForegroundColor Green
} else {
    Write-Host "✗ Service is not running!" -ForegroundColor Red
    Write-Host "`nShowing logs:" -ForegroundColor Yellow
    ssh $SERVER "journalctl -u restaurant.service -n 50 --no-pager"
    exit 1
}

# Step 6: Test API endpoints
Write-Host "`n[6/6] Testing API endpoints..." -ForegroundColor Yellow

# Test login endpoint
Write-Host "`n  Testing login endpoint..." -ForegroundColor Cyan
$loginTest = ssh $SERVER "curl -s -X POST https://www.crystalautomation.eu/resturant-website/api/login -H 'Content-Type: application/json' -d '{\"username\":\"bojole_admin\",\"password\":\"bojole123\"}'"

if ($loginTest -like "*success*") {
    Write-Host "  ✓ Login endpoint working" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Login endpoint may have issues" -ForegroundColor Yellow
    Write-Host "  Response: $loginTest" -ForegroundColor Gray
}

# Test mobile pending orders endpoint (requires API key in database)
Write-Host "`n  Testing mobile orders endpoint..." -ForegroundColor Cyan
$apiKeyTest = Read-Host "  Enter API key to test (or press Enter to skip)"

if ($apiKeyTest) {
    $ordersTest = ssh $SERVER "curl -s https://www.crystalautomation.eu/resturant-website/api/orders/mobile/pending -H 'X-API-Key: $apiKeyTest'"
    
    if ($ordersTest -like "*[*") {
        Write-Host "  ✓ Mobile orders endpoint working (returns array)" -ForegroundColor Green
    } elseif ($ordersTest -like "*Unauthorized*") {
        Write-Host "  ⚠ API key invalid or not in database" -ForegroundColor Yellow
    } else {
        Write-Host "  Response: $ordersTest" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⊘ Skipped mobile endpoint test" -ForegroundColor Gray
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n✅ Multi-tenant server deployed successfully!" -ForegroundColor Green

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Verify database.json has 'restaurants' array" -ForegroundColor White
Write-Host "   2. Generate secure API keys: openssl rand -hex 32" -ForegroundColor White
Write-Host "   3. Create web app copies (one per restaurant)" -ForegroundColor White
Write-Host "   4. Update mobile app with restaurant selection" -ForegroundColor White
Write-Host "   5. Test with multiple restaurants" -ForegroundColor White

Write-Host "`n📚 Documentation:" -ForegroundColor Yellow
Write-Host "   • MULTI_TENANT_GUIDE.md - Complete guide" -ForegroundColor White
Write-Host "   • MULTI_TENANT_QUICK_START.md - Quick reference" -ForegroundColor White
Write-Host "   • RESTAURANT_CONFIG_EXAMPLE.js - Code examples" -ForegroundColor White

Write-Host "`n🔧 Useful Commands:" -ForegroundColor Yellow
Write-Host "   View logs:    ssh $SERVER 'journalctl -u restaurant.service -f'" -ForegroundColor White
Write-Host "   Check status: ssh $SERVER 'systemctl status restaurant.service'" -ForegroundColor White
Write-Host "   Edit DB:      ssh $SERVER 'nano $REMOTE_PATH/database.json'" -ForegroundColor White

Write-Host "`n🆘 Rollback (if needed):" -ForegroundColor Yellow
Write-Host "   ssh $SERVER 'cp $REMOTE_PATH/database.json.backup_* $REMOTE_PATH/database.json'" -ForegroundColor White
Write-Host "   ssh $SERVER 'systemctl restart restaurant.service'" -ForegroundColor White

Write-Host "`n========================================`n" -ForegroundColor Cyan
