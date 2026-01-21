# Restaurant Menu Platform - Complete Test Suite

**Project:** BOJOLE Restaurant Menu System  
**URL:** https://www.crystalautomation.eu/resturant-website/  
**Admin Panel:** https://www.crystalautomation.eu/resturant-website/admin  
**Test Date:** December 18, 2025  
**Version:** 1.0

---

## Test Environment Setup

### Admin Credentials
- **Username:** admin
- **Password:** admin123

### Test Devices Required
- Desktop browser (Chrome/Firefox/Edge)
- Mobile device or mobile emulator (viewport 768px or less)
- Tablet (optional, for responsive testing)

---

## 1. FRONTEND - CUSTOMER MENU TESTING

### 1.1 Homepage & Language Switching
**Priority:** HIGH

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.1.1 | Open main menu page | Page loads with all categories visible in navigation bar | ☐ |
| 1.1.2 | Click "EN" button to switch to English | All text translates to English including categories, product names, descriptions | ☐ |
| 1.1.3 | Verify weight units in English | "г" becomes "g", "мл" becomes "ml" | ☐ |
| 1.1.4 | Click "BG" button to switch back | All text returns to Bulgarian | ☐ |
| 1.1.5 | Refresh page | Language preference is remembered | ☐ |

### 1.2 Product Display & Categories
**Priority:** HIGH

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.2.1 | View "All Items" category | All products displayed with images, names, prices (BGN/EUR), categories | ☐ |
| 1.2.2 | Click different category (e.g., "Salads") | Only products from that category are shown | ☐ |
| 1.2.3 | Click "Promotions" category | Only products with active promotions are displayed | ☐ |
| 1.2.4 | Check promotional badge | Products with promos show red badge with discount percentage | ☐ |
| 1.2.5 | Verify price display | Original price is crossed out, promo price is in red/highlight color | ☐ |
| 1.2.6 | Check weight badges | Weight is displayed in bottom-left corner of product images | ☐ |

### 1.3 Promotional Slideshow
**Priority:** MEDIUM

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.3.1 | Navigate to "All Items" category | Slideshow is visible at top if enabled in admin | ☐ |
| 1.3.2 | Wait for auto-play | Slides transition automatically based on interval setting | ☐ |
| 1.3.3 | Click left/right arrows | Manual navigation through slides works | ☐ |
| 1.3.4 | Click slide dots | Jumps to corresponding slide | ☐ |
| 1.3.5 | Navigate to another category | Slideshow disappears (only shows in "All Items") | ☐ |
| 1.3.6 | Mobile: swipe slides | Touch gestures work for navigation (optional) | ☐ |

### 1.4 Search Functionality
**Priority:** MEDIUM

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.4.1 | Type product name in search | Results filter in real-time | ☐ |
| 1.4.2 | Search with partial name | Shows all matching products | ☐ |
| 1.4.3 | Search in Bulgarian | Finds products by Bulgarian name | ☐ |
| 1.4.4 | Switch to English and search | Finds products by English name | ☐ |
| 1.4.5 | Search non-existent product | Shows "No products found" message | ☐ |
| 1.4.6 | Clear search | All products reappear | ☐ |

### 1.5 Product Modal (Details View)
**Priority:** HIGH

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.5.1 | Click on any product card | Modal opens with enlarged image, full description | ☐ |
| 1.5.2 | Check modal content | Shows weight, category, price (with promo if applicable) | ☐ |
| 1.5.3 | Click "Add to Cart" in modal | Product added to cart, modal closes | ☐ |
| 1.5.4 | Click outside modal or X button | Modal closes without adding to cart | ☐ |
| 1.5.5 | Press Escape key | Modal closes | ☐ |

### 1.6 Shopping Cart
**Priority:** HIGH

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.6.1 | Click "Add to Cart" on product | Cart icon shows item count (1) | ☐ |
| 1.6.2 | Add multiple products | Cart count increases correctly | ☐ |
| 1.6.3 | Click cart icon | Opens cart sidebar with all added items | ☐ |
| 1.6.4 | Check cart item display | Shows image, name (translated), price, quantity controls | ☐ |
| 1.6.5 | Click "+" to increase quantity | Quantity increases, subtotal updates | ☐ |
| 1.6.6 | Click "-" to decrease quantity | Quantity decreases, subtotal updates | ☐ |
| 1.6.7 | Decrease to 0 | Item is removed from cart | ☐ |
| 1.6.8 | Click trash icon | Item is removed immediately | ☐ |
| 1.6.9 | Check total calculation | Subtotal + delivery fee = Total (if delivery selected) | ☐ |
| 1.6.10 | Add promo product | Cart shows both original and promo price | ☐ |
| 1.6.11 | Close cart sidebar | Cart remains populated (not cleared) | ☐ |

### 1.7 Checkout Process
**Priority:** CRITICAL

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.7.1 | Add items to cart, click "Proceed to Checkout" | Redirects to checkout page | ☐ |
| 1.7.2 | Verify top bar height | Top bar is 32px height (same as menu page) | ☐ |
| 1.7.3 | Check cart summary | Shows all items with quantities and prices | ☐ |
| 1.7.4 | Select "Pickup" option | Delivery fields are hidden, only pickup info shown | ☐ |
| 1.7.5 | Select "Delivery" option (if enabled) | Shows delivery address fields and city selector | ☐ |
| 1.7.6 | If delivery disabled in admin | Only "Pickup" option is visible | ☐ |
| 1.7.7 | Select city for delivery | Delivery fee updates based on city price | ☐ |
| 1.7.8 | Fill contact form | Name, phone, email fields accept input | ☐ |
| 1.7.9 | Leave required field empty | Shows validation error on submit | ☐ |
| 1.7.10 | Enter promo code | Discount applies correctly | ☐ |
| 1.7.11 | Check free delivery threshold | Fee removed if order exceeds configured amount | ☐ |
| 1.7.12 | Click "Place Order" | Order submits successfully | ☐ |
| 1.7.13 | Verify order confirmation | Shows success message or confirmation page | ☐ |

### 1.8 Mobile Responsiveness
**Priority:** HIGH

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.8.1 | Open menu on mobile (≤768px) | Layout adapts to mobile view | ☐ |
| 1.8.2 | Check "Add to Cart" button | Shows "Add" instead of "Add to Cart" | ☐ |
| 1.8.3 | Check product name length | Long names wrap to 2 lines correctly | ☐ |
| 1.8.4 | Verify BGN price size | Font size is 12px, readable | ☐ |
| 1.8.5 | Check checkout top bar | Height is 32px (not 44px) | ☐ |
| 1.8.6 | Test form inputs on mobile | All fields are tappable and keyboard-friendly | ☐ |
| 1.8.7 | Test slideshow on mobile | Slides display correctly, navigation works | ☐ |

---

## 2. ADMIN PANEL TESTING

### 2.1 Authentication
**Priority:** CRITICAL

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.1.1 | Access /admin without login | Redirects to /login page | ☐ |
| 2.1.2 | Enter wrong credentials | Shows error message, stays on login | ☐ |
| 2.1.3 | Enter correct credentials (admin/admin123) | Redirects to admin panel | ☐ |
| 2.1.4 | Verify admin token | Token saved in sessionStorage as 'adminToken' | ☐ |
| 2.1.5 | Refresh admin page while logged in | Stays logged in, no redirect loop | ☐ |
| 2.1.6 | Click "Logout" button | Clears token, redirects to /login | ☐ |
| 2.1.7 | Try accessing /admin after logout | Redirects to /login | ☐ |

### 2.2 Product Management
**Priority:** HIGH

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.2.1 | Navigate to "Manage Products" tab | Shows product list with search/filter | ☐ |
| 2.2.2 | Click "Add Product" | Opens product creation form | ☐ |
| 2.2.3 | Fill all product fields | Name, description, price, category, weight, image URL | ☐ |
| 2.2.4 | Add Bulgarian translation | BG name, description, category fields work | ☐ |
| 2.2.5 | Upload product image | Image uploads and displays correctly | ☐ |
| 2.2.6 | Set product weight | Weight displays in menu with correct units | ☐ |
| 2.2.7 | Enable promotion on product | Set promo price, displays with badge in menu | ☐ |
| 2.2.8 | Save product | Product appears in menu immediately | ☐ |
| 2.2.9 | Edit existing product | Changes reflect in menu after save | ☐ |
| 2.2.10 | Delete product | Product removed from menu | ☐ |
| 2.2.11 | Bulk enable promo | Select multiple products, apply promo to all | ☐ |
| 2.2.12 | Search products | Filter works by name/category | ☐ |

### 2.3 Promotional Slideshow Management
**Priority:** MEDIUM

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.3.1 | Navigate to "Restaurant Settings" tab | Find "Promotional Slideshow Banner" section | ☐ |
| 2.3.2 | Check "Enable Promotional Slideshow" | Checkbox works and saves state | ☐ |
| 2.3.3 | Set auto-play interval (3-30 seconds) | Input accepts valid range | ☐ |
| 2.3.4 | Click "Add Slide" | New slide entry appears in list | ☐ |
| 2.3.5 | Upload slide image (file upload) | Image uploads successfully | ☐ |
| 2.3.6 | Verify uploaded image path | URL includes BASE_PATH: /resturant-website/uploads/ | ☐ |
| 2.3.7 | Add slide title (optional) | Title field accepts text | ☐ |
| 2.3.8 | Title saves on blur | Leaving field triggers auto-save | ☐ |
| 2.3.9 | Add multiple slides (up to 10) | Can add up to 10 slides | ☐ |
| 2.3.10 | Try adding 11th slide | Shows error or prevents adding | ☐ |
| 2.3.11 | Check slide numbering | Each slide shows "Slide #1", "Slide #2", etc. | ☐ |
| 2.3.12 | Click "Move Up" button (↑) | Slide moves up in order | ☐ |
| 2.3.13 | Click "Move Down" button (↓) | Slide moves down in order | ☐ |
| 2.3.14 | Delete slide | Confirmation dialog appears, slide removed on confirm | ☐ |
| 2.3.15 | Click "Save Slideshow Settings" | Settings persist after page refresh | ☐ |
| 2.3.16 | Verify slideshow in menu | Enabled slideshow displays in "All Items" category | ☐ |
| 2.3.17 | Disable slideshow | Slideshow disappears from menu | ☐ |

### 2.4 Working Hours Settings
**Priority:** MEDIUM

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.4.1 | Navigate to "Working Hours" section | Shows opening and closing time inputs | ☐ |
| 2.4.2 | Set opening time (e.g., 09:00) | Time picker accepts input | ☐ |
| 2.4.3 | Set closing time (e.g., 22:00) | Time picker accepts input | ☐ |
| 2.4.4 | Click "Save Working Hours" | Shows success message | ☐ |
| 2.4.5 | Refresh admin page | Settings persist correctly | ☐ |
| 2.4.6 | Verify hours display in checkout | Working hours shown to customers | ☐ |

### 2.5 Delivery Settings
**Priority:** HIGH

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.5.1 | Navigate to "Delivery Settings" tab | Shows delivery configuration section | ☐ |
| 2.5.2 | Check "Enable Delivery" checkbox | Checkbox state saves immediately (auto-save) | ☐ |
| 2.5.3 | When enabled | Shows delivery settings section (fee, free delivery) | ☐ |
| 2.5.4 | When disabled | Hides delivery settings section in admin | ☐ |
| 2.5.5 | Disable delivery | Checkout only shows "Pickup" option (no "Delivery") | ☐ |
| 2.5.6 | Enable free delivery above amount | Checkbox works, shows amount input field | ☐ |
| 2.5.7 | Set free delivery amount (e.g., 50 EUR) | Input accepts decimal values | ☐ |
| 2.5.8 | Set standard delivery fee (e.g., 5 EUR) | Input accepts decimal values | ☐ |
| 2.5.9 | Click "Save Delivery Settings" | All settings persist after refresh | ☐ |
| 2.5.10 | Test in checkout | Free delivery applies when threshold met | ☐ |

### 2.6 Delivery Cities Management
**Priority:** HIGH

| Test Case | Steps | expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.6.1 | Navigate to "Delivery Cities & Prices" | Shows city management section | ☐ |
| 2.6.2 | Enter city name (e.g., "Пловдив") | Input accepts Cyrillic text | ☐ |
| 2.6.3 | Enter delivery price (e.g., 5.00) | Input accepts decimal values | ☐ |
| 2.6.4 | Click "Add City" | City appears in list below | ☐ |
| 2.6.5 | Add multiple cities | All cities saved and displayed | ☐ |
| 2.6.6 | Edit city price | Click edit, change price, save | ☐ |
| 2.6.7 | Delete city | City removed from list | ☐ |
| 2.6.8 | Refresh admin page | All cities persist correctly | ☐ |
| 2.6.9 | Check checkout city selector | All added cities appear in dropdown | ☐ |
| 2.6.10 | Select city in checkout | Delivery fee updates to city-specific price | ☐ |

### 2.7 Promo Codes Management
**Priority:** MEDIUM

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.7.1 | Navigate to "Promo Codes" tab | Shows promo code management interface | ☐ |
| 2.7.2 | Create new promo code | Enter code (auto-uppercase), select category, set discount % | ☐ |
| 2.7.3 | Set discount percentage (1-100%) | Input accepts valid range | ☐ |
| 2.7.4 | Select "All Categories" | Promo applies to entire menu | ☐ |
| 2.7.5 | Select specific category | Promo only applies to products in that category | ☐ |
| 2.7.6 | Set promo status (Active/Inactive) | Toggle works correctly | ☐ |
| 2.7.7 | Save promo code | Code appears in promo codes list | ☐ |
| 2.7.8 | Edit existing promo code | Changes save correctly | ☐ |
| 2.7.9 | Delete promo code | Code removed from list | ☐ |
| 2.7.10 | Test promo in checkout | Enter code, discount applies correctly | ☐ |
| 2.7.11 | Test inactive promo | Shows "Invalid promo code" error | ☐ |

### 2.8 Combo & Bundle Offers
**Priority:** MEDIUM

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.8.1 | Navigate to combo management section | Shows combo creation interface | ☐ |
| 2.8.2 | Select multiple products for combo | Products selectable from list | ☐ |
| 2.8.3 | Set bundle price | Input accepts price lower than sum of products | ☐ |
| 2.8.4 | Add combo name and description | Text fields accept input | ☐ |
| 2.8.5 | Save combo | Combo appears in menu with bundle badge | ☐ |
| 2.8.6 | Verify discount calculation | Shows correct % discount vs individual prices | ☐ |
| 2.8.7 | Add combo to cart | All bundled items added together | ☐ |
| 2.8.8 | Edit combo | Changes reflect in menu | ☐ |
| 2.8.9 | Delete combo | Bundle removed from menu | ☐ |

### 2.9 Orders Management
**Priority:** CRITICAL

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.9.1 | Navigate to "Orders" tab | Shows list of all orders | ☐ |
| 2.9.2 | View pending orders | Pending orders highlighted/filtered | ☐ |
| 2.9.3 | Auto-refresh every 30 seconds | New orders appear automatically | ☐ |
| 2.9.4 | Browser notification for new order | Desktop notification shows (if permitted) | ☐ |
| 2.9.5 | Click on order | Opens order details view | ☐ |
| 2.9.6 | Check order details | Shows all items, quantities, prices, delivery info, customer contact | ☐ |
| 2.9.7 | Change order status (Pending → Accepted) | Status updates and order moves to "Accepted" list | ☐ |
| 2.9.8 | Change to "Completed" | Order marked as completed | ☐ |
| 2.9.9 | Change to "Cancelled" | Order marked as cancelled | ☐ |
| 2.9.10 | Print order | Order details printable | ☐ |
| 2.9.11 | Filter orders by status | Filter dropdown works correctly | ☐ |
| 2.9.12 | Filter by date range | Date filters work correctly | ☐ |

### 2.10 Customization Settings
**Priority:** LOW

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.10.1 | Navigate to "Customization" section | Shows color and styling options | ☐ |
| 2.10.2 | Change top bar color | Color picker updates preview | ☐ |
| 2.10.3 | Change background color | Color applies to menu background | ☐ |
| 2.10.4 | Change highlight color | Applies to buttons, promo prices | ☐ |
| 2.10.5 | Change price color | EUR/BGN prices update color | ☐ |
| 2.10.6 | Upload background image | Image applies as menu background | ☐ |
| 2.10.7 | Save customization | Changes persist and reflect in menu immediately | ☐ |

### 2.11 Currency Settings
**Priority:** MEDIUM

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.11.1 | Navigate to currency settings | Shows EUR to BGN conversion rate | ☐ |
| 2.11.2 | Update conversion rate | Input accepts decimal values | ☐ |
| 2.11.3 | Toggle "Show BGN Prices" | Checkbox controls BGN price visibility | ☐ |
| 2.11.4 | Save currency settings | Settings apply to all menu prices | ☐ |
| 2.11.5 | Verify prices in menu | BGN prices calculated correctly using rate | ☐ |

---

## 3. DATA PERSISTENCE TESTING

### 3.1 Data Retention After Deployment
**Priority:** CRITICAL

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 3.1.1 | Add slideshow slides in admin | Slides saved to database | ☐ |
| 3.1.2 | Simulate deployment (backend restart) | Slideshow data persists (not overwritten) | ☐ |
| 3.1.3 | Add delivery cities | Cities saved to database | ☐ |
| 3.1.4 | Simulate deployment | Cities data persists | ☐ |
| 3.1.5 | Place test orders | Orders saved to database | ☐ |
| 3.1.6 | Simulate deployment | Orders persist | ☐ |
| 3.1.7 | Verify database.json not overwritten | Local database.json excluded from deployment script | ☐ |

### 3.2 Session & State Management
**Priority:** HIGH

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 3.2.1 | Add items to cart | Cart persists in sessionStorage | ☐ |
| 3.2.2 | Refresh page | Cart items remain in cart | ☐ |
| 3.2.3 | Close and reopen browser | Cart is cleared (sessionStorage behavior) | ☐ |
| 3.2.4 | Login to admin | adminToken saved in sessionStorage | ☐ |
| 3.2.5 | Refresh admin page | Session persists, no re-login needed | ☐ |
| 3.2.6 | Close and reopen browser | Session cleared, must login again | ☐ |

---

## 4. SECURITY TESTING

### 4.1 API Authentication
**Priority:** CRITICAL

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 4.1.1 | Try accessing /api/orders without token | Returns 401 Unauthorized | ☐ |
| 4.1.2 | Try accessing /api/upload without token | Returns 401 Unauthorized | ☐ |
| 4.1.3 | Try accessing /api/slideshow PUT without token | Returns 401 Unauthorized | ☐ |
| 4.1.4 | Access public endpoints (products, menu) | Works without authentication | ☐ |
| 4.1.5 | Use invalid/expired token | Returns 401 Unauthorized | ☐ |

### 4.2 Input Validation
**Priority:** HIGH

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 4.2.1 | Submit checkout form with empty required fields | Shows validation errors | ☐ |
| 4.2.2 | Enter invalid email format | Shows email validation error | ☐ |
| 4.2.3 | Enter invalid phone format | Shows phone validation error | ☐ |
| 4.2.4 | Try SQL injection in search | No database errors, input sanitized | ☐ |
| 4.2.5 | Try XSS in product name | Input escaped, no script execution | ☐ |
| 4.2.6 | Upload non-image file to slideshow | Shows error or rejects file | ☐ |
| 4.2.7 | Try uploading file > max size | Shows file size error | ☐ |

---

## 5. PERFORMANCE TESTING

### 5.1 Load Times
**Priority:** MEDIUM

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 5.1.1 | Measure menu page load time | Loads in < 3 seconds on 3G | ☐ |
| 5.1.2 | Measure checkout page load time | Loads in < 2 seconds | ☐ |
| 5.1.3 | Measure admin panel load time | Loads in < 3 seconds | ☐ |
| 5.1.4 | Test with 100+ products | Page remains responsive | ☐ |

### 5.2 Image Optimization
**Priority:** MEDIUM

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 5.2.1 | Check product image sizes | Images lazy-load or optimized | ☐ |
| 5.2.2 | Check slideshow image sizes | Large images don't block page load | ☐ |
| 5.2.3 | Test with slow connection | Progressive image loading works | ☐ |

---

## 6. CROSS-BROWSER TESTING

### 6.1 Browser Compatibility
**Priority:** HIGH

| Browser | Version | Desktop | Mobile | Status |
|---------|---------|---------|--------|--------|
| Chrome | Latest | ☐ | ☐ | |
| Firefox | Latest | ☐ | ☐ | |
| Safari | Latest | ☐ | ☐ | |
| Edge | Latest | ☐ | ☐ | |
| Samsung Internet | Latest | N/A | ☐ | |

---

## 7. CRITICAL USER FLOWS

### 7.1 Complete Order Flow (End-to-End)
**Priority:** CRITICAL

**Steps:**
1. Open menu page
2. Switch language to English
3. Browse categories (Salads → Pasta → All Items)
4. Search for specific product
5. Click product to view details in modal
6. Add product to cart from modal
7. Add 2 more products from cards directly
8. Open cart sidebar
9. Increase quantity of one item
10. Remove one item
11. Click "Proceed to Checkout"
12. Select delivery method (Pickup or Delivery)
13. If delivery: select city, enter address
14. Fill contact form (name, phone, email)
15. Apply promo code
16. Review order summary and total
17. Click "Place Order"
18. Verify order confirmation
19. **Admin side:** Login to admin panel
20. **Admin side:** Check new order appears in Orders list
21. **Admin side:** Change order status to Accepted

**Expected Result:** Complete flow works without errors, order appears in admin panel with correct details.

---

## 8. REGRESSION TESTING CHECKLIST

After any deployment, verify these core features:

- [ ] Menu loads without JavaScript errors
- [ ] Products display correctly with images and prices
- [ ] Language switching works (EN/BG)
- [ ] Cart functionality (add/remove/update quantities)
- [ ] Checkout form submission
- [ ] Admin login works
- [ ] Slideshow displays if enabled
- [ ] Delivery cities populate in checkout
- [ ] Weight units translate correctly (г → g)
- [ ] BGN price font size is 12px on mobile
- [ ] Top bar height is 32px in checkout
- [ ] "Add to Cart" shows as "Add" on mobile
- [ ] database.json not overwritten on deployment

---

## 9. KNOWN ISSUES & NOTES

### Current Limitations
- Slideshow only displays in "All Items" category (by design)
- Language preference stored in sessionStorage (clears on browser close)
- Cart clears on browser close (sessionStorage)
- Admin session expires on browser close

### Recent Fixes Applied
- ✅ Fixed upload endpoint to use BASE_PATH for image URLs
- ✅ Added orders array to database.json
- ✅ Fixed slideshow API to use correct BASE_PATH
- ✅ Added slideshow reordering (Move Up/Down buttons)
- ✅ Fixed weight unit translation (г → g, мл → ml)
- ✅ Fixed syntax error in app.js badge rendering
- ✅ Increased BGN price font size to 12px on mobile
- ✅ Excluded database.json from deployment script to preserve data

---

## TEST EXECUTION SUMMARY

**Tester Name:** ___________________  
**Test Date:** ___________________  
**Build/Version:** 1.0  

### Overall Test Results

| Category | Total Tests | Passed | Failed | Blocked | Pass Rate |
|----------|-------------|--------|--------|---------|-----------|
| Frontend Customer | 68 | | | | |
| Admin Panel | 102 | | | | |
| Data Persistence | 13 | | | | |
| Security | 12 | | | | |
| Performance | 7 | | | | |
| Cross-Browser | 5 | | | | |
| **TOTAL** | **207** | | | | |

### Critical Bugs Found
1. 
2. 
3. 

### High Priority Bugs
1. 
2. 
3. 

### Medium/Low Priority Issues
1. 
2. 
3. 

### Recommendations
- 
- 
- 

---

## CONTACT & SUPPORT

**Developer:** GitHub Copilot  
**Project Repository:** C:\Users\User\Desktop\resturant-template  
**Server:** 46.62.174.218  
**Deployment Script:** deploy-to-server.ps1

For any issues or questions during testing, document with:
- Test case number
- Steps to reproduce
- Expected vs actual result
- Screenshots/console errors
- Browser and device used

---

**END OF TEST SUITE**
