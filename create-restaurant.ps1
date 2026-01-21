# ============================================
# CREATE NEW RESTAURANT - Helper Script
# Generates configuration for new restaurant
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CREATE NEW RESTAURANT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Collect information
Write-Host "Enter restaurant details:`n" -ForegroundColor Yellow

$restaurantName = Read-Host "Restaurant name (e.g. 'Pizza Italia')"
$restaurantSlug = Read-Host "URL slug (e.g. 'pizza-italia')"
$username = Read-Host "Admin username (e.g. 'pizza_admin')"
$password = Read-Host "Admin password"
$address = Read-Host "Address"
$phone = Read-Host "Phone (format: +359888123456)"
$email = Read-Host "Email"

# Generate unique ID
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$restaurantId = "rest_" + $restaurantSlug.Replace("-", "_") + "_" + $timestamp.Substring(0, 6)

# Generate secure API key
Write-Host "`nGenerating secure API key..." -ForegroundColor Yellow

if (Get-Command openssl -ErrorAction SilentlyContinue) {
    $apiKey = openssl rand -hex 32
    Write-Host "✓ API key generated using OpenSSL" -ForegroundColor Green
} else {
    # Fallback: Generate random string in PowerShell
    $apiKey = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
    Write-Host "✓ API key generated using PowerShell (install OpenSSL for stronger keys)" -ForegroundColor Yellow
}

# Generate timestamp
$createdAt = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"

# Create output
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "GENERATED CONFIGURATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$databaseEntry = @"
{
  "id": "$restaurantId",
  "name": "$restaurantName",
  "username": "$username",
  "password": "$password",
  "apiKey": "$apiKey",
  "address": "$address",
  "phone": "$phone",
  "email": "$email",
  "active": true,
  "createdAt": "$createdAt"
}
"@

Write-Host "1️⃣  DATABASE.JSON ENTRY" -ForegroundColor Yellow
Write-Host "   Add this to 'restaurants' array in database.json:`n" -ForegroundColor Gray
Write-Host $databaseEntry -ForegroundColor White

$webConfig = @"
// ========================================
// RESTAURANT CONFIGURATION FOR WEB APP
// File: $restaurantSlug-web/checkout.js
// ========================================

const RESTAURANT_CONFIG = {
    id: '$restaurantId',
    name: '$restaurantName',
    apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api'
};

// In placeOrder() function, add:
const orderData = {
    restaurantId: RESTAURANT_CONFIG.id,
    items: cartItems,
    customerInfo: customerInfo,
    deliveryMethod: deliveryMethod,
    total: totalAmount
};

// In fetch() headers, add:
headers: {
    'Content-Type': 'application/json',
    'X-Restaurant-Id': RESTAURANT_CONFIG.id
}
"@

Write-Host "`n2️⃣  WEB APP CONFIGURATION" -ForegroundColor Yellow
Write-Host "   Add this to the beginning of checkout.js:`n" -ForegroundColor Gray
Write-Host $webConfig -ForegroundColor White

$mobileConfig = @"
// ========================================
// MOBILE APP CONFIGURATION
// File: src/config/restaurants.js
// ========================================

// Add to RESTAURANTS array:
{
  id: '$restaurantId',
  name: '$restaurantName',
  apiKey: '$apiKey',
  apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api',
  logo: require('../assets/$restaurantSlug-logo.png'),
  primaryColor: '#YOUR_COLOR_HERE'
}
"@

Write-Host "`n3️⃣  MOBILE APP CONFIGURATION" -ForegroundColor Yellow
Write-Host "   Add this to src/config/restaurants.js:`n" -ForegroundColor Gray
Write-Host $mobileConfig -ForegroundColor White

$nginxConfig = @"
# ========================================
# NGINX CONFIGURATION (Optional)
# File: /etc/nginx/sites-available/$restaurantSlug
# ========================================

server {
    listen 80;
    server_name $restaurantSlug.crystalautomation.eu;
    root /var/www/$restaurantSlug;
    index index.html;
    
    location / {
        try_files `$uri `$uri/ =404;
    }
    
    location /api {
        proxy_pass http://localhost:3003/resturant-website/api;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
    }
}
"@

Write-Host "`n4️⃣  NGINX CONFIGURATION (OPTIONAL)" -ForegroundColor Yellow
Write-Host "   For subdomain setup:`n" -ForegroundColor Gray
Write-Host $nginxConfig -ForegroundColor White

# Save to file
$outputFile = "restaurant_$restaurantSlug`_config.txt"
$allOutput = @"
========================================
RESTAURANT CONFIGURATION
========================================
Generated: $(Get-Date)

Restaurant: $restaurantName
ID: $restaurantId
Username: $username
Password: $password
API Key: $apiKey

========================================
1. DATABASE.JSON ENTRY
========================================

$databaseEntry

========================================
2. WEB APP CONFIGURATION
========================================

$webConfig

========================================
3. MOBILE APP CONFIGURATION
========================================

$mobileConfig

========================================
4. NGINX CONFIGURATION
========================================

$nginxConfig

========================================
DEPLOYMENT STEPS
========================================

1. UPDATE DATABASE:
   ssh root@46.62.174.218
   nano /root/resturant-website/database.json
   # Add the database entry above to 'restaurants' array
   systemctl restart restaurant.service

2. CREATE WEB APP:
   cd C:\Users\User\Desktop\resturant-template
   cp -r public $restaurantSlug-web
   # Edit $restaurantSlug-web/checkout.js - add RESTAURANT_CONFIG
   # Upload to server:
   scp -r $restaurantSlug-web root@46.62.174.218:/var/www/$restaurantSlug/

3. UPDATE MOBILE APP:
   # Edit src/config/restaurants.js - add restaurant entry
   # Add logo to src/assets/$restaurantSlug-logo.png
   # Rebuild APK:
   npx eas build --platform android

4. TEST:
   # Web: Visit http://$restaurantSlug.crystalautomation.eu
   # Mobile: Select '$restaurantName' from restaurant list
   # Place test order and verify it appears in mobile app

========================================
SECURITY REMINDERS
========================================

⚠️  IMPORTANT:
   • Change default password immediately
   • Keep API key secret
   • Use HTTPS in production
   • Enable rate limiting
   • Monitor logs for suspicious activity

========================================
"@

$allOutput | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ Configuration saved to: $outputFile" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# Deployment commands
Write-Host "📋 Quick Deployment Commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "# 1. Copy web app template" -ForegroundColor Gray
Write-Host "cp -r public $restaurantSlug-web" -ForegroundColor White
Write-Host ""
Write-Host "# 2. Upload database entry (after editing database.json)" -ForegroundColor Gray
Write-Host "scp database.json root@46.62.174.218:/root/resturant-website/" -ForegroundColor White
Write-Host ""
Write-Host "# 3. Restart service" -ForegroundColor Gray
Write-Host "ssh root@46.62.174.218 'systemctl restart restaurant.service'" -ForegroundColor White
Write-Host ""
Write-Host "# 4. Upload web app" -ForegroundColor Gray
Write-Host "scp -r $restaurantSlug-web root@46.62.174.218:/var/www/$restaurantSlug/" -ForegroundColor White
Write-Host ""

Write-Host "`n🎉 Restaurant configuration generated successfully!" -ForegroundColor Green
Write-Host "   Review $outputFile and follow deployment steps.`n" -ForegroundColor Gray
