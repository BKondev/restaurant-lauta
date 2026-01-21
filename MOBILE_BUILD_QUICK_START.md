# 📱 Mobile App - Quick Build Guide

## 🎯 Цел: Standalone APK за Ресторанти

Създаване на APK който работи навсякъде (не само в локална мрежа).

---

## ⚡ Quick Start (5 Steps)

### Step 1: Setup (Еднократно)

```powershell
# Install EAS CLI
npm install -g eas-cli

# Login (create account at expo.dev if needed)
eas login

# Navigate to project
cd C:\Users\User\Desktop\restaurant-orders-mobile

# Configure
eas build:configure
```

---

### Step 2: Create Production Config

**Create file:** `src/config/api.config.js`

```javascript
export const API_CONFIG = {
  apiUrl: 'https://www.crystalautomation.eu/resturant-website/api'
};
```

---

### Step 3: Update Restaurants Config

**Edit:** `src/config/restaurants.js`

```javascript
import { API_CONFIG } from './api.config';

export const RESTAURANTS = [
    {
        id: 'rest_bojole_001',
        name: 'BOJOLE',
        apiKey: 'YOUR_REAL_API_KEY_HERE',  // ← Replace with real key
        apiBaseUrl: API_CONFIG.apiUrl,      // ← Use production URL
        logo: require('../assets/bojole-logo.png'),
        primaryColor: '#e74c3c'
    }
    // Add more restaurants...
];
```

---

### Step 4: Build APK

```powershell
# Build production APK
eas build --platform android --profile production

# Wait 5-10 minutes...
# Copy the download URL when build completes
```

**Output:**
```
✔ Build finished
Download URL: https://expo.dev/artifacts/eas/abc123xyz.apk
Valid for 30 days
```

---

### Step 5: Distribute

```powershell
# Option A: Upload to your server
scp downloaded-file.apk root@46.62.174.218:/var/www/downloads/restaurant-app.apk

# Option B: Share download link directly
# Send the Expo URL to staff via email/WhatsApp

# Option C: Upload to Google Drive
# Share link with staff
```

---

## 📲 Installation Instructions for Staff

### Android Phone Setup

1. **Enable Unknown Sources**
   - Settings → Security
   - Enable "Install unknown apps" for Chrome/Files

2. **Download APK**
   - Open link on phone
   - Download APK file

3. **Install**
   - Tap downloaded file
   - Tap "Install"
   - Wait for installation

4. **First Use**
   - Open "Restaurant Orders" app
   - Select your restaurant (e.g., "BOJOLE")
   - Start working!

---

## 🔧 Troubleshooting

### Build Fails

```powershell
# Clear cache and retry
eas build --platform android --profile production --clear-cache

# Check login
eas whoami
```

### APK Won't Install

- Enable "Unknown Sources" in phone settings
- Uninstall old version first
- Reboot phone and try again

### Can't Connect to Server

**Check API URL in code:**
```javascript
// src/config/api.config.js
export const API_CONFIG = {
  apiUrl: 'https://www.crystalautomation.eu/resturant-website/api'
  // ↑ Make sure this is correct!
};
```

**Test server from browser:**
```
https://www.crystalautomation.eu/resturant-website/api/orders/mobile/pending
Should return: {"error": "Unauthorized"} (normal without API key)
```

### Orders Not Showing

1. ✅ Server running? `systemctl status restaurant.service`
2. ✅ API key matches database.json?
3. ✅ Restaurant selected in app?
4. ✅ Phone has internet connection?

---

## 🔄 Updating the App

When you need to release an update:

```powershell
# 1. Update code
# Fix bugs, add features

# 2. Increment version in app.json
# "version": "2.1.0"
# "versionCode": 3

# 3. Build new APK
eas build --platform android --profile production

# 4. Distribute new version
# Staff uninstalls old app, installs new APK
```

---

## 📋 Complete eas.json Configuration

**File:** `eas.json`

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
  }
}
```

---

## 📋 Complete app.json Configuration

**File:** `app.json`

```json
{
  "expo": {
    "name": "Restaurant Orders",
    "slug": "restaurant-orders-mobile",
    "version": "2.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "android": {
      "package": "com.bojole.restaurantorders",
      "versionCode": 2,
      "permissions": [
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ],
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "extra": {
      "eas": {
        "projectId": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

---

## ✅ Pre-Build Checklist

Before building APK:

- [ ] Update `src/config/api.config.js` with production URL
- [ ] Update `src/config/restaurants.js` with real API keys
- [ ] Test locally: `npx expo start`
- [ ] Verify connection to production server
- [ ] Increment version in `app.json`
- [ ] Commit changes to git (optional)

---

## 📊 Build Profiles

### Preview Build (Testing)

```powershell
# Faster build, for testing
eas build --platform android --profile preview

# Use this for internal testing before production
```

### Production Build (Distribution)

```powershell
# Optimized build for end users
eas build --platform android --profile production

# Use this for distributing to restaurant staff
```

---

## 🌐 Alternative: Test Build Locally

If EAS is not working, you can build locally:

```powershell
# Generate Android project
npx expo prebuild

# Build APK
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

**Note:** Local build requires:
- Android Studio installed
- ANDROID_HOME environment variable set
- Java JDK installed

---

## 📞 Support

**Expo Docs:** https://docs.expo.dev/build/introduction/  
**EAS Build Docs:** https://docs.expo.dev/build/setup/  
**Community:** https://forums.expo.dev

---

## 🎯 Expected Timeline

- **Setup (first time):** 30 minutes
- **Build time:** 5-10 minutes per APK
- **Testing:** 15-30 minutes
- **Distribution:** 5 minutes

**Total first build:** ~1 hour  
**Subsequent builds:** ~20 minutes

---

## 💰 Cost

**EAS Build:**
- Free tier: Limited builds per month
- Paid: $29/month for unlimited builds
- For this project: Free tier is enough

**Alternative:**
- Local build: Free but requires Android Studio setup

---

## ✅ Success!

Your APK is ready when:

1. ✅ Build completes without errors
2. ✅ APK installs on test device
3. ✅ App connects to production server
4. ✅ Orders show correctly
5. ✅ Approval workflow works
6. ✅ Printing functions properly

**Ready to distribute to restaurant staff!** 🎉

---

## 📱 Quick Commands Reference

```powershell
# Login
eas login

# Build
eas build --platform android --profile production

# Check build status
eas build:list

# View build details
eas build:view [BUILD_ID]

# Cancel build
eas build:cancel [BUILD_ID]
```

---

**Last Updated:** December 22, 2025  
**Version:** 2.0  
**Platform:** Android 8.0+
