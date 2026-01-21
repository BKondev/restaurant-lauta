# Quick Deployment Guide - Mobile App Order Processing v2.0

## 🚀 Deploy in 3 Steps

### Step 1: Deploy Backend (5 minutes)
```powershell
cd C:\Users\User\Desktop\resturant-template
# One-time: set your GitHub repo URL
# Example (SSH): git@github.com:YOUR_ORG/resturant-template.git
# Then deploy:
.\deploy-git.ps1 -RepoUrl "<YOUR_GITHUB_REPO_URL>" -CommitMessage "deploy"
```
**What happens:**
- Commits + pushes your local changes to GitHub
- Server pulls the latest code via git
- Installs production dependencies
- Restarts PM2 process automatically

**Verify:** Visit https://www.crystalautomation.eu/resturant-website/

---

### Step 2: Update Mobile App (3 minutes)
```powershell
cd C:\Users\User\Desktop\restaurant-orders-mobile
npm install @react-native-picker/picker
npx expo start
```
**Or use install script:**
```powershell
.\install-dependencies.ps1
```

**Verify:** App opens without errors

---

### Step 3: Quick Test (5 minutes)

**Test Phone Validation:**
1. Go to menu → checkout
2. Try phone: `0888123456` → ❌ Should fail
3. Try phone: `+359888123456` → ✅ Should work
4. Complete order → Should redirect to tracking page

**Test Mobile App:**
1. Open app → See pending order
2. Tap "Приеми" → Select time
3. Tap "1. Обади се" → Opens dialer
4. Tap "2. Одобри" → Order disappears

**Done!** ✅

---

## 📋 What Changed?

### Customer Experience 🛍️
- **Phone validation:** Must enter `+359XXXXXXXXX` format
- **Order tracking:** See countdown timer after placing order
- **2-hour window:** Can track order for 2 hours

### Staff Experience 📱
- **3-step process:** Accept → Call → Approve
- **Time selection:** Choose 60, 65, or 70 minutes
- **Returning customers:** See green "✓ Редовен клиент" badge
- **Forced workflow:** Can't approve without calling

### System Behavior ⚙️
- **Printing:** Only delivery orders print (on approve)
- **Delivery service:** Only delivery orders sent to dispatcher
- **Order IDs:** Now strings like `order_1703165432101_842`

---

## 🔧 If Something Breaks

### Backend Issues
```bash
# Check logs
ssh root@46.62.174.218
journalctl -u restaurant.service -f

# Restart service
systemctl restart restaurant

# Verify service running
systemctl status restaurant
```

### Mobile App Issues
```bash
# Clear cache
npx expo start --clear

# Reinstall packages
rm -rf node_modules
npm install

# Rebuild
npx expo run:android
```

### Phone Validation Too Strict?
Edit `public/checkout.js`, find phone validation section, adjust regex pattern.

---

## 📞 Support Checklist

**Before calling for help, check:**
- [ ] Service is running: `systemctl status restaurant`
- [ ] Logs show errors: `journalctl -u restaurant.service -n 50`
- [ ] Network printer accessible: `curl http://192.168.x.x:9100`
- [ ] Database.json exists and valid: `cat database.json | jq '.'`
- [ ] Mobile app packages installed: `npm list @react-native-picker/picker`

**Documentation:**
- Full workflow: `MOBILE_APP_WORKFLOW.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Printer & delivery: `DELIVERY_PRINTER_INTEGRATION.md`

---

## ✅ Quick Test Script

Copy-paste this to test everything:

```bash
# Backend test
curl https://www.crystalautomation.eu/resturant-website/api/orders

# Tracking page test
curl -I https://www.crystalautomation.eu/resturant-website/track-order.html

# Printer test (on server)
ssh root@46.62.174.218 'cd /var/www/resturant-website && node -e "require(\"./printer-service\").findNetworkPrinters().then(console.log)"'
```

---

## 🎯 Success Criteria

System is working correctly when:
- ✅ Invalid phones rejected at checkout
- ✅ Valid phones create order + redirect to tracking
- ✅ Tracking page shows countdown timer
- ✅ Mobile app shows 3 buttons in sequence
- ✅ Can't approve without calling
- ✅ Delivery orders print automatically
- ✅ Pickup orders don't print
- ✅ Returning customer badge appears

---

## 📊 Key Metrics to Monitor

**First Week After Deployment:**
- Orders with invalid phone format (should be 0)
- Failed approvals due to network errors
- Printer failures (check logs)
- Tracking page access count
- Time from pending → approved (average)

---

**Version:** 2.0  
**Date:** December 21, 2025  
**Status:** Ready for Deployment

**Need help?** See full documentation in `MOBILE_APP_WORKFLOW.md`
