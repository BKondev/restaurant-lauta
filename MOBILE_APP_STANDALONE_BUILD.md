# 📱 Mobile App - Standalone Build Guide

## 🎯 Цел

Създаване на **standalone APK файл** който:
- ✅ Работи **без Expo** development server
- ✅ Работи **навсякъде** (не само в локална мрежа)
- ✅ Може да се **инсталира на всеки Android телефон**
- ✅ Свързва се с **production сървър** (crystalautomation.eu)
- ✅ Персоналът го инсталира и използва в ресторанта

---

## 📋 Prerequisite

### 1. Expo Account (Безплатен)

```bash
# Създай account на https://expo.dev
# Или от command line:
npx expo register
```

### 2. EAS CLI

```powershell
# Install globally
npm install -g eas-cli

# Login
eas login
```

---

## 🔧 Конфигурация на Проекта

### 1. Create EAS Configuration

```powershell
cd C:\Users\User\Desktop\restaurant-orders-mobile
eas build:configure
```

Това ще създаде `eas.json`:

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

### 2. Update app.json

```json
{
  "expo": {
    "name": "Restaurant Orders",
    "slug": "restaurant-orders-mobile",
    "version": "2.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.bojole.restaurantorders"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.bojole.restaurantorders",
      "versionCode": 2,
      "permissions": [
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "YOUR_PROJECT_ID_HERE"
      }
    }
  }
}
```

---

### 3. Create Production Config File

**Create:** `src/config/api.config.js`

```javascript
// API Configuration for Production
// This file contains the server URL that will be used in the built APK

const ENV = {
  dev: {
    apiUrl: 'http://localhost:3003/resturant-website/api',
  },
  staging: {
    apiUrl: 'https://www.crystalautomation.eu/resturant-website/api',
  },
  prod: {
    apiUrl: 'https://www.crystalautomation.eu/resturant-website/api',
  }
};

// Change this to 'prod' before building APK
const environment = __DEV__ ? 'dev' : 'prod';

export const API_CONFIG = ENV[environment];

// For testing: set to specific environment
// export const API_CONFIG = ENV.prod;
```

---

### 4. Update restaurants.js to Use Production Config

**File:** `src/config/restaurants.js`

```javascript
import { API_CONFIG } from './api.config';

export const RESTAURANTS = [
    {
        id: 'rest_bojole_001',
        name: 'BOJOLE',
        apiKey: 'bojole_api_key_12345_CHANGE_THIS',
        apiBaseUrl: API_CONFIG.apiUrl,  // ← Use config
        logo: require('../assets/bojole-logo.png'),
        primaryColor: '#e74c3c'
    },
    // Add more restaurants...
];

export const getRestaurantById = (id) => {
    return RESTAURANTS.find(r => r.id === id);
};
```

---

## 🏗️ Build Process

### Method 1: EAS Build (Recommended)

#### A. Preview Build (Internal Testing)

```powershell
cd C:\Users\User\Desktop\restaurant-orders-mobile

# Build APK for testing
eas build --platform android --profile preview

# Wait 5-10 minutes...
# Download link will be provided in console
```

#### B. Production Build

```powershell
# Build production APK
eas build --platform android --profile production

# This creates optimized APK ready for distribution
```

**Build Output:**
- Expo generates APK in the cloud
- Download link provided (valid 30 days)
- File size: ~30-50 MB
- Ready to install on any Android device

---

### Method 2: Local Build (Alternative)

If you want to build locally without EAS:

```powershell
# Install Android Studio and set ANDROID_HOME
# Then:

npx expo prebuild
cd android
./gradlew assembleRelease

# APK will be in:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 📦 APK Distribution

### Option 1: Direct File Sharing (Simplest)

```powershell
# After EAS build completes:

# 1. Download APK from EAS link
# Example: https://expo.dev/artifacts/eas/abc123.apk

# 2. Upload to your server
scp restaurant-orders.apk root@46.62.174.218:/var/www/downloads/

# 3. Share link with staff
# https://www.crystalautomation.eu/downloads/restaurant-orders.apk
```

### Option 2: Google Drive

```
1. Download APK from EAS
2. Upload to Google Drive
3. Share link with staff
4. Staff downloads and installs
```

### Option 3: Internal App Store

If you have many restaurants, consider:
- Firebase App Distribution (free)
- TestFlight (iOS)
- Internal server with download page

---

## 📲 Installation on Staff Phones

### Step 1: Enable Unknown Sources

**On Android:**
1. Settings → Security
2. Enable "Unknown Sources" or "Install Unknown Apps"
3. Allow installation from Chrome/Files

### Step 2: Download & Install

```
1. Open link in mobile browser
2. Download APK file
3. Tap "Install"
4. Open app
5. Select restaurant from list
6. Start using!
```

### Step 3: Verify Connection

```
1. Open app
2. Select "BOJOLE" restaurant
3. Should show "No pending orders" (if empty)
4. Place test order from web
5. Should appear in mobile app within 10 seconds
```

---

## 🔧 Configuration Management

### Hardcoded Server URL

The APK will have **hardcoded server URL**:
- Production: `https://www.crystalautomation.eu/resturant-website/api`
- No need for user configuration
- Works immediately after installation

### Restaurant Configuration

Create `src/config/restaurants.production.js`:

```javascript
// Production restaurants configuration
// Update this file before building APK

export const RESTAURANTS = [
    {
        id: 'rest_bojole_001',
        name: 'BOJOLE',
        apiKey: 'REAL_API_KEY_HERE',  // ← Real production key
        apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api',
        logo: require('../assets/bojole-logo.png'),
        primaryColor: '#e74c3c'
    },
    {
        id: 'rest_pizza_italia_002',
        name: 'Pizza Italia',
        apiKey: 'REAL_API_KEY_HERE',  // ← Real production key
        apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api',
        logo: require('../assets/pizza-italia-logo.png'),
        primaryColor: '#27ae60'
    }
];
```

---

## 🚀 Complete Build & Deploy Workflow

### 1. Prepare for Build

```powershell
cd C:\Users\User\Desktop\restaurant-orders-mobile

# 1. Install dependencies
npm install

# 2. Update API config
# Edit src/config/api.config.js
# Set environment to 'prod'

# 3. Update restaurants
# Edit src/config/restaurants.js
# Add real API keys

# 4. Test locally first
npx expo start
# Verify it works with production server
```

### 2. Build APK

```powershell
# Login to EAS
eas login

# Configure project (first time only)
eas build:configure

# Build APK
eas build --platform android --profile production

# Wait 5-10 minutes...
# Note down the build URL
```

### 3. Download & Test

```powershell
# 1. Download APK from EAS build URL
# Example: https://expo.dev/artifacts/eas/abc123def456.apk

# 2. Rename for clarity
mv abc123def456.apk restaurant-orders-v2.0.apk

# 3. Test on physical device
# Install and verify all features work
```

### 4. Distribute to Staff

```powershell
# Option A: Upload to your server
scp restaurant-orders-v2.0.apk root@46.62.174.218:/var/www/downloads/

# Option B: Upload to Google Drive
# Manually upload via browser

# Option C: Email directly
# For small teams
```

---

## 📝 Version Management

### Versioning Strategy

```json
// app.json
{
  "expo": {
    "version": "2.0.0",  // User-facing version
    "android": {
      "versionCode": 2   // Android internal version (increment each build)
    }
  }
}
```

### Update Workflow

When you need to update the app:

```powershell
# 1. Update code
# Fix bugs, add features, etc.

# 2. Increment version
# Edit app.json:
#   "version": "2.1.0"
#   "versionCode": 3

# 3. Build new APK
eas build --platform android --profile production

# 4. Distribute new version
# Staff uninstalls old app, installs new one
```

---

## 🔐 Security Considerations

### API Keys in APK

⚠️ **Important:** API keys are visible in APK (can be extracted)

**Mitigation strategies:**

1. **Rotate Keys Regularly**
   ```javascript
   // Generate new keys every 3 months
   openssl rand -hex 32
   ```

2. **Use Backend Validation**
   ```javascript
   // Server checks API key + device fingerprint
   // Block suspicious patterns
   ```

3. **Rate Limiting**
   ```javascript
   // Server-side rate limiting per API key
   // Max 100 requests per minute
   ```

### SSL Pinning (Advanced)

For extra security, pin SSL certificate:

```javascript
// expo-ssl-pinning (optional)
import { SSLPinning } from 'expo-ssl-pinning';

await SSLPinning.fetch('https://api.example.com', {
  method: 'GET',
  sslPinning: {
    certs: ['sha256/AAAAAAAAAAAAAAAAAAAAAA==']
  }
});
```

---

## 🧪 Testing Checklist

### Pre-Build Testing

- [ ] Test with production API URL locally
- [ ] Verify all restaurants load
- [ ] Test order fetching
- [ ] Test order approval workflow
- [ ] Test phone dialer integration
- [ ] Test error handling
- [ ] Test offline behavior

### Post-Build Testing

- [ ] Install APK on physical device
- [ ] Test without WiFi (mobile data only)
- [ ] Test in different locations (not local network)
- [ ] Verify connection to production server
- [ ] Place test order from web
- [ ] Approve order from mobile
- [ ] Verify printing works
- [ ] Test with different restaurants
- [ ] Test app restart
- [ ] Test background/foreground transitions

---

## 🆘 Troubleshooting

### Build Fails

**Error:** `No Expo account found`
```powershell
# Login again
eas login
```

**Error:** `Project not configured`
```powershell
# Run configure
eas build:configure
```

**Error:** `Build timeout`
```powershell
# Try again (Expo servers might be busy)
eas build --platform android --profile production --clear-cache
```

---

### APK Won't Install

**Error:** `App not installed`

**Solutions:**
1. Enable "Unknown Sources" in phone settings
2. Uninstall old version first
3. Clear download cache
4. Try different browser to download

---

### Can't Connect to Server

**Error:** `Network request failed`

**Check:**
```javascript
// 1. Verify API URL in app
console.log(API_CONFIG.apiUrl);
// Should be: https://www.crystalautomation.eu/resturant-website/api

// 2. Test server from browser
// Visit: https://www.crystalautomation.eu/resturant-website/api/orders/mobile/pending

// 3. Check API key
// Make sure it matches database.json on server
```

---

### Orders Not Showing

**Checklist:**
1. ✅ Server running? `systemctl status restaurant.service`
2. ✅ API key valid in database.json?
3. ✅ Orders have restaurantId matching selected restaurant?
4. ✅ Mobile app connected to internet?
5. ✅ Correct server URL in API_CONFIG?

**Debug:**
```javascript
// Add console logs in api.js
export const getPendingOrders = async () => {
    const restaurant = await getSelectedRestaurant();
    console.log('Selected restaurant:', restaurant);
    console.log('API URL:', restaurant.apiBaseUrl);
    console.log('API Key:', restaurant.apiKey);
    
    const response = await fetch(...);
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Orders:', data);
    
    return data;
};
```

---

## 📊 Build Size Optimization

### Reduce APK Size

```json
// app.json
{
  "expo": {
    "android": {
      "enableProguardInReleaseBuilds": true,  // Minify code
      "enableShrinkResourcesInReleaseBuilds": true  // Remove unused resources
    }
  }
}
```

### Asset Optimization

```powershell
# Compress images before building
# Use tinypng.com or similar

# Keep only necessary assets
# Remove unused fonts, images, icons
```

**Typical APK sizes:**
- Minimal app: 20-30 MB
- With images/fonts: 30-50 MB
- Large app: 50-80 MB

---

## 🎯 Distribution Best Practices

### For Small Teams (1-5 restaurants)

✅ **Google Drive / Dropbox**
- Upload APK
- Share link with staff
- Update instructions in shared doc

### For Medium Teams (5-20 restaurants)

✅ **Internal Download Page**
```html
<!-- Create simple download page -->
<!DOCTYPE html>
<html>
<head>
    <title>Restaurant App Download</title>
</head>
<body>
    <h1>Restaurant Orders Mobile App</h1>
    <p>Version: 2.0.0 | Updated: Dec 22, 2025</p>
    <a href="/downloads/restaurant-orders-v2.0.apk" download>
        Download APK (35 MB)
    </a>
    
    <h2>Installation Instructions:</h2>
    <ol>
        <li>Download APK</li>
        <li>Enable "Unknown Sources" in phone settings</li>
        <li>Install APK</li>
        <li>Select your restaurant</li>
        <li>Start working!</li>
    </ol>
</body>
</html>
```

### For Large Teams (20+ restaurants)

✅ **Firebase App Distribution** (Free)
```powershell
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Upload APK
firebase appdistribution:distribute restaurant-orders.apk \
  --app YOUR_FIREBASE_APP_ID \
  --groups "restaurant-staff"

# Staff gets email with download link
```

---

## 📱 Alternative: Progressive Web App (PWA)

If APK distribution is too complex, consider PWA:

**Pros:**
- No installation needed
- Updates automatically
- Works on all devices (Android, iOS)
- Accessible via URL

**Cons:**
- Requires Safari/Chrome
- Some features limited (phone dialer)
- Needs internet always

**Implementation:**
```javascript
// Convert existing mobile app to PWA
// Use React + Service Workers
// Host on server
// Staff adds to home screen
```

---

## 🚀 Quick Start Commands

```powershell
# Complete build workflow

# 1. Setup (first time only)
cd C:\Users\User\Desktop\restaurant-orders-mobile
npm install -g eas-cli
eas login
eas build:configure

# 2. Update config
# Edit src/config/api.config.js (set prod)
# Edit src/config/restaurants.js (add real API keys)

# 3. Build
eas build --platform android --profile production

# 4. Download & test
# Get URL from build output
# Install on test device

# 5. Distribute
# Upload to server or share link with staff
```

---

## 📞 Support

### Build Issues

**EAS Support:** https://expo.dev/eas  
**Community:** https://forums.expo.dev

### Testing

**Android Emulator:**
```powershell
# Install Android Studio
# Create AVD (Android Virtual Device)
# Run: npx expo run:android
```

**Physical Device:**
```powershell
# Enable USB debugging on phone
# Connect via USB
# Run: npx expo run:android
```

---

## ✅ Success Criteria

App is ready for production when:

1. ✅ APK builds successfully
2. ✅ Installs on Android devices
3. ✅ Connects to production server
4. ✅ Shows correct restaurants
5. ✅ Fetches pending orders
6. ✅ Approves orders successfully
7. ✅ Prints delivery orders
8. ✅ Works on mobile data (not just WiFi)
9. ✅ Works outside local network
10. ✅ Handles errors gracefully

---

**Version:** 2.0  
**Build Method:** EAS Build (Expo Application Services)  
**Target:** Android 8.0+ (API 26+)  
**Distribution:** Direct APK download

🎉 **Ready to build production APK!** 🎉
