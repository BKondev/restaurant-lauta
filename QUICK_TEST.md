# Quick Test Suite - Restaurant Menu Platform

**Project:** BOJOLE Restaurant Menu System  
**URL:** https://www.crystalautomation.eu/resturant-website/  
**Admin:** https://www.crystalautomation.eu/resturant-website/admin  
**Credentials:** admin / admin123

**Estimated Time:** 15-20 minutes

---

## ✅ QUICK SMOKE TEST CHECKLIST

### 1. FRONTEND - Customer Experience (5 min)

| # | Test | Expected | Status |
|---|------|----------|--------|
| 1.1 | Open menu page | Loads without errors, shows products | ☐ |
| 1.2 | Switch to English (EN button) | All text translates, "г"→"g", "мл"→"ml" | ☐ |
| 1.3 | Click any category | Filters products correctly | ☐ |
| 1.4 | Click "Add to Cart" | Cart icon shows count (1) | ☐ |
| 1.5 | Open cart, change quantity | Updates correctly, trash icon removes item | ☐ |
| 1.6 | Proceed to Checkout | Opens checkout page, top bar is 32px | ☐ |
| 1.7 | Select Pickup or Delivery | Form displays correctly based on selection | ☐ |
| 1.8 | Fill form & submit order | Order submits successfully | ☐ |

**Mobile Check (2 min):**
- [ ] "Add to Cart" shows as "Add"
- [ ] BGN price is 12px (readable)
- [ ] Product names wrap to 2 lines

---

### 2. ADMIN PANEL - Core Functions (7 min)

| # | Test | Expected | Status |
|---|------|----------|--------|
| 2.1 | Login with admin/admin123 | Redirects to admin panel (no loops) | ☐ |
| 2.2 | Navigate to Manage Products | Product list loads | ☐ |
| 2.3 | Add new product | Appears in menu immediately | ☐ |
| 2.4 | Enable promo on product | Shows promo badge in menu | ☐ |
| 2.5 | Go to Slideshow section | Check "Enable" checkbox | ☐ |
| 2.6 | Add slide (upload image) | Image uploads, shows correct URL with /resturant-website/uploads/ | ☐ |
| 2.7 | Add 2nd slide, use Move Up/Down | Reordering works | ☐ |
| 2.8 | Save Slideshow Settings | Slideshow appears in "All Items" menu | ☐ |
| 2.9 | Go to Delivery Settings | Enable/disable delivery checkbox | ☐ |
| 2.10 | Add delivery city with price | City appears in checkout dropdown | ☐ |
| 2.11 | Check Orders tab | New test order appears (from step 1.8) | ☐ |
| 2.12 | Logout | Returns to login page | ☐ |

---

### 3. DATA PERSISTENCE (3 min)

| # | Test | Expected | Status |
|---|------|----------|--------|
| 3.1 | Note current slideshow slides count | Example: 2 slides | ☐ |
| 3.2 | Note delivery cities count | Example: 3 cities | ☐ |
| 3.3 | Simulate deployment: restart service | `ssh root@46.62.174.218 "systemctl restart restaurant"` | ☐ |
| 3.4 | Refresh admin, check slideshow | Same slides exist (not deleted) | ☐ |
| 3.5 | Check delivery cities | Same cities exist (not deleted) | ☐ |

---

### 4. CRITICAL BUG CHECK (3 min)

| # | Issue | Check | Status |
|---|-------|-------|--------|
| 4.1 | Console errors on menu page | Open DevTools Console (F12), no red errors | ☐ |
| 4.2 | 404 errors for images/files | Network tab shows no 404s except placeholders | ☐ |
| 4.3 | Slideshow images load | Check Network: images come from /resturant-website/uploads/ | ☐ |
| 4.4 | /api/orders endpoint | No 500 error (orders array exists in database) | ☐ |
| 4.5 | Delivery checkbox saves | Toggle on/off, refresh page, state persists | ☐ |
| 4.6 | Checkout delivery option | When disabled in admin, checkout shows only Pickup | ☐ |

---

## 🔥 CRITICAL PATH TEST (5 min)

**Complete End-to-End Flow:**

1. **Customer Side:**
   - [ ] Open menu → Switch to Bulgarian
   - [ ] Add 3 products to cart
   - [ ] Go to checkout
   - [ ] Select Delivery, choose city
   - [ ] Fill contact form
   - [ ] Place order

2. **Admin Side:**
   - [ ] Login to admin
   - [ ] Check Orders tab
   - [ ] Verify order shows with correct items, prices, delivery info
   - [ ] Change status to "Accepted"

3. **Result:** If all steps work → ✅ Core system functional

---

## 📱 MOBILE QUICK CHECK (2 min)

**Open on mobile device or set browser to mobile view (F12 → Toggle device toolbar → iPhone/Android):**

- [ ] Menu loads and scrolls smoothly
- [ ] "Add" button text (not "Add to Cart")
- [ ] BGN price is readable (12px)
- [ ] Cart opens and works
- [ ] Checkout form fields are tappable
- [ ] Top bar is 32px (not too tall)

---

## 🚨 INSTANT FAIL CONDITIONS

**Stop testing and report immediately if:**

- ❌ Menu doesn't load (blank page/infinite loading)
- ❌ JavaScript errors in console preventing functionality
- ❌ Cannot login to admin (redirect loop)
- ❌ Cart doesn't work (can't add items)
- ❌ Checkout form doesn't submit
- ❌ Orders don't appear in admin panel
- ❌ Slideshow images return 404
- ❌ Deployment wipes all slideshow/city data

---

## 📊 QUICK TEST RESULT

**Pass/Fail:** ☐ PASS  ☐ FAIL  

**Total Tests:** 36  
**Passed:** _____  
**Failed:** _____  

**Critical Issues Found:**
1. ________________________________
2. ________________________________
3. ________________________________

**Tested By:** ___________________  
**Date:** ___________________  
**Time Taken:** _____ minutes

---

## 🔧 QUICK FIXES REFERENCE

**If you encounter these common issues:**

| Issue | Quick Fix |
|-------|-----------|
| Menu not loading | Check browser console for errors, clear cache (Ctrl+Shift+R) |
| Admin login loop | Clear sessionStorage, try incognito mode |
| Slideshow images 404 | Verify URL has /resturant-website/uploads/ prefix |
| Orders 500 error | Check database.json has "orders": [] field |
| Data lost after deploy | Verify deploy-to-server.ps1 has database.json commented out |
| Delivery checkbox not saving | Check browser console for API errors |

---

## ✨ REGRESSION TEST (After Any Code Change)

**Run these 10 tests in 3 minutes:**

1. [ ] Menu loads
2. [ ] Language switch works
3. [ ] Add to cart works
4. [ ] Checkout submits
5. [ ] Admin login works
6. [ ] Slideshow displays
7. [ ] Weight units translate (г→g)
8. [ ] BGN price is 12px mobile
9. [ ] Top bar 32px checkout
10. [ ] Orders appear in admin

**All pass?** → ✅ Safe to go live  
**Any fail?** → ❌ Debug before deployment

---

**END OF QUICK TEST**
