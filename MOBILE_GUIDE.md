# Mobile guide (internal)

This repo contains the website + APK download folder.
The **mobile app source** lives in a separate folder:

- `C:\Users\User\Desktop\restaurant-orders-mobile`

## Do not switch directories

Always build from `C:\Users\User\Desktop\restaurant-orders-mobile` (single source-of-truth).

## Tenant label (LAUTA / BOJOLE)

- Orders header text should come from the saved `tenantId` on the device (set on successful login).
- If LAUTA login still shows “BOJOLE”, clear app storage (or uninstall + reinstall) and log in again.

## Launcher icon (KONKAR)

Icon source:
- `C:\Users\User\Desktop\konkar.png.png`

Regenerate Android icon resources:
- `python tools/generate-android-icons.py` (run inside the mobile repo)

## Build + publish APK

1) Bump version in the mobile repo:
- `android/app/build.gradle`: increment `versionCode` and update `versionName`

2) Build:
- `cd android`
- `./gradlew assembleRelease`

3) Copy the APK to this repo so it’s downloadable:
- Put it into [public/apk](public/apk)
