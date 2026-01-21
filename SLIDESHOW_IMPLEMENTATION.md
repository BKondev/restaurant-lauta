# Slideshow System Overhaul - Implementation Steps

## Current Issues
1. ❌ Checkbox and label spacing too large
2. ❌ Add slide replaces instead of appends
3. ❌ No support for multiple slides (max 10)
4. ❌ Slides not displaying on homepage  
5. ❌ Using URL text inputs instead of file upload

## Step-by-Step Implementation

### Step 1: Fix Admin UI - Checkbox Inline ✅
**File:** `public/admin.html`
- Find slideshow checkbox section
- Add `display: inline` or flex styling
- Test in browser

### Step 2: Change Input Method - URL → File Upload
**Files:** `public/admin.html`, `public/admin.js`, `server.js`

**admin.html changes:**
```html
<!-- OLD -->
<input type="text" id="slide-url" placeholder="Banner Image URL">
<input type="text" id="slide-link" placeholder="Link (optional)">

<!-- NEW -->
<input type="file" id="slide-image" accept="image/*">
<input type="text" id="slide-title" placeholder="Slide Title (optional)">
```

**admin.js changes:**
- Remove URL handling
- Add FormData for file upload
- Upload to `/upload-slide` endpoint
- Store returned image path

**server.js changes:**
- Add `/upload-slide` endpoint (similar to `/upload-logo`)
- Handle multer upload to `/uploads/slides/`
- Return image path

### Step 3: Multi-Slide Support (Array-based)
**Files:** `public/admin.js`, `server.js`, `database.json`

**database.json structure:**
```json
{
  "slides": [
    { "id": 1, "image": "/uploads/slides/banner1.jpg", "title": "Holiday Sale" },
    { "id": 2, "image": "/uploads/slides/banner2.jpg", "title": "New Menu" }
  ]
}
```

**admin.js changes:**
- Load all slides on init
- Display slides list with delete buttons
- Add slide button appends to array (check max 10)
- Delete button removes specific slide by ID
- Save all slides to server

**server.js changes:**
- GET `/slides` returns array
- PUT `/slides` saves entire array
- No localStorage - use database.json

### Step 4: Fix Homepage Display
**File:** `public/app.js`

**Current issues to check:**
- Is slideshow HTML container present?
- Is fetch working?
- Is render logic correct?
- Are slide images loading?

**Implementation:**
```javascript
// Load slides from server
async function loadSlideshow() {
    const response = await fetch(`${BASE_PATH}/slides`);
    const slides = await response.json();
    
    if (!slides || slides.length === 0) {
        document.getElementById('slideshow-container').style.display = 'none';
        return;
    }
    
    renderSlides(slides);
    initSlideshow();
}

function renderSlides(slides) {
    const container = document.getElementById('slides');
    slides.forEach((slide, index) => {
        const slideDiv = document.createElement('div');
        slideDiv.className = 'slide' + (index === 0 ? ' active' : '');
        slideDiv.innerHTML = `<img src="${BASE_PATH}${slide.image}" alt="${slide.title || 'Slide'}">`;
        container.appendChild(slideDiv);
    });
}
```

### Step 5: Clean Up Old Data
- Remove localStorage slideshow settings
- Remove old URL-based slides from admin.js
- Test full flow: upload → save → display

## Testing Checklist

### Admin Panel
- [ ] Checkbox is inline with label
- [ ] Can upload image file
- [ ] Can add multiple slides (up to 10)
- [ ] Slides list shows all slides
- [ ] Can delete individual slides
- [ ] Slides persist after page reload

### Homepage
- [ ] Slideshow displays when slides exist
- [ ] Slideshow hidden when no slides
- [ ] Images load correctly
- [ ] Navigation works (prev/next)
- [ ] Auto-play works

### Server
- [ ] `/upload-slide` endpoint works
- [ ] Files saved to `/uploads/slides/`
- [ ] GET `/slides` returns array
- [ ] PUT `/slides` saves to database.json
- [ ] Images served correctly

