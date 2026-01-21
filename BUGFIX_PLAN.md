# Bug Fix Plan - December 17, 2025

## Issues Identified

### 1. Mobile UI Issues
- [ ] Add to Cart button text: "Add to Cart" → "Add" on mobile
- [ ] Product names wrapping: Long names should wrap to 2 lines on mobile
- [ ] Checkout top bar height: Should match menu page height (min-height: 32px)

### 2. Admin Panel - Promotional Slideshow Issues
- [ ] Checkbox and label spacing: Too much space, needs inline layout
- [ ] Add Slide functionality: Removes old slide instead of adding new one
- [ ] Should support up to 10 slides
- [ ] Slides not displaying on homepage after being added
- [ ] Slide input method: Should be image file upload, not URL links

### 3. Admin Panel - Working Hours Issues
- [ ] Settings not being saved/persisted
- [ ] Important: Checkout clock depends on these hours

### 4. Admin Panel - Delivery Cities Issues
- [ ] Existing cities not displaying in the list
- [ ] Cannot create new cities - "Failed to save cities" error
- [ ] "Enable Delivery" toggle not saving state

---

## Technical Analysis

### Mobile UI (Frontend - styles.css, app.js)
- Button text controlled in app.js translations or inline HTML
- Product name wrapping needs CSS changes
- Top bar height in checkout.html styles

### Slideshow System (Admin + Frontend)
**Files involved:**
- `public/admin.html` - Admin UI for slideshow management
- `public/admin.js` - Admin slideshow logic
- `public/app.js` - Frontend slideshow display
- `database.json` - Data storage
- `server.js` - API endpoints

**Current issues:**
- Slide management logic replacing instead of appending
- Display logic not rendering slides
- Input method using text fields instead of file upload

### Working Hours (Admin + Server)
**Files involved:**
- `public/admin.html` - Working hours form
- `public/admin.js` - Save logic
- `server.js` - Save endpoint
- `database.json` - Storage

**Current issues:**
- Save operation failing or not persisting
- Data not being read correctly on load

### Delivery Cities (Admin + Server)
**Files involved:**
- `public/admin.html` - Cities management UI
- `public/admin.js` - Cities CRUD logic
- `server.js` - Cities API endpoints
- `database.json` - Storage

**Current issues:**
- GET endpoint not returning data or UI not displaying
- POST endpoint failing with error
- Toggle state not persisting

---

## Implementation Plan

### Phase 1: Mobile UI Fixes (Simple, Frontend Only)
**Priority: HIGH | Complexity: LOW | Time: 15 min**

1. Change "Add to Cart" → "Add" on mobile
   - File: `public/app.js` or translation system
   - Add media query check or modify button generation

2. Product name wrapping on mobile
   - File: `public/styles.css`
   - Add wrapping styles to product name in mobile media query

3. Checkout top bar height
   - File: `public/checkout.html`
   - Change min-height from 44px to 32px in existing styles

---

### Phase 2: Admin Panel Data Issues (Backend Focus)
**Priority: CRITICAL | Complexity: MEDIUM | Time: 45 min**

#### 2A: Working Hours Fix
**Steps:**
1. Verify database.json structure for `workingHours`
2. Check server.js POST endpoint for working hours
3. Check admin.js save function
4. Test data persistence

#### 2B: Delivery Cities Fix
**Steps:**
1. Check database.json structure for `deliveryCities` and `deliveryEnabled`
2. Verify server.js GET/POST endpoints for cities
3. Check admin.js load/save functions
4. Fix error handling and data parsing

---

### Phase 3: Slideshow System Overhaul (Complex)
**Priority: MEDIUM | Complexity: HIGH | Time: 90 min**

#### 3A: Change Input Method (URLs → File Upload)
**Steps:**
1. Modify admin.html: Replace text inputs with file inputs
2. Add file upload handling in admin.js
3. Add server.js endpoint for image upload (similar to logo/product uploads)
4. Store uploaded image paths in database.json

#### 3B: Fix Slide Management (Support Multiple Slides)
**Steps:**
1. Change database structure: `slides` should be array, not single object
2. Modify admin.js:
   - Load all slides on page load
   - Display slides list with delete buttons
   - Add slide appends to array (max 10)
   - Delete slide removes from array
3. Update server.js save endpoint to handle array

#### 3C: Fix Slideshow Display on Homepage
**Steps:**
1. Check app.js slideshow initialization
2. Verify data fetch from server
3. Fix rendering logic to display all slides
4. Test navigation between slides

---

## Order of Execution

### Step 1: Mobile UI Fixes (Quick Wins)
- Fix button text
- Fix product name wrapping  
- Fix checkout top bar height
- **Deploy and test**

### Step 2: Working Hours (Critical for Checkout)
- Investigate save/load logic
- Fix persistence
- Test checkout clock
- **Deploy and test**

### Step 3: Delivery Cities (Critical for Orders)
- Fix display of existing cities
- Fix save functionality
- Fix enable/disable toggle
- **Deploy and test**

### Step 4: Slideshow System (Most Complex)
- Change to file upload
- Fix multi-slide support
- Fix display on homepage
- **Deploy and test**

---

## Risk Assessment

**Low Risk:**
- Mobile UI changes (CSS/text only)

**Medium Risk:**
- Working hours fix (depends on finding root cause)
- Delivery cities fix (database read/write)

**High Risk:**
- Slideshow overhaul (multiple systems, file uploads, data structure change)

---

## Testing Checklist

### Mobile UI
- [ ] Button shows "Add" on mobile, full text on desktop
- [ ] Long product names wrap to 2 lines on mobile
- [ ] Checkout top bar matches menu height

### Working Hours
- [ ] Hours save successfully
- [ ] Hours persist after page reload
- [ ] Checkout clock reflects saved hours

### Delivery Cities
- [ ] Existing cities display in list
- [ ] New cities can be created
- [ ] Cities can be deleted
- [ ] Enable/disable toggle works and persists

### Slideshow
- [ ] Can upload image files
- [ ] Can add up to 10 slides
- [ ] Can delete individual slides
- [ ] Slides display on homepage
- [ ] Slide navigation works
- [ ] Old slide data cleaned up

