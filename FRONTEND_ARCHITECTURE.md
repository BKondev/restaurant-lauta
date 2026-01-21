# Frontend Architecture - Restaurant Menu System

## Overview

The frontend consists of three main applications:
1. **Customer Menu** (index.html, app.js, styles.css)
2. **Admin Panel** (admin.html, admin.js, admin-styles.css)
3. **Checkout Page** (checkout.html, checkout.js)

All use Vanilla JavaScript (no frameworks) for maximum performance and simplicity.

---

## Customer Menu Application

### File Structure
```
public/
├── index.html          # Main customer-facing menu page
├── app.js              # Menu logic, product rendering, cart management
└── styles.css          # Menu styling, responsive design
```

### Core Functionality

#### 1. Language System
**Storage:** `localStorage.language` (persistent across sessions)  
**Supported Languages:** English (en), Bulgarian (bg)

```javascript
// Translation Object Structure
const translations = {
    en: {
        categories: 'Menu Categories',
        searchPlaceholder: 'Search for dishes...',
        addToCart: 'Add to Cart',
        // ... more keys
    },
    bg: {
        categories: 'Категории Меню',
        searchPlaceholder: 'Търсене на ястия...',
        addToCart: 'Добави',
        // ... Bulgarian translations
    }
};

// Switch Language Function
function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    
    // Update UI elements with [data-i18n] attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });
    
    // Re-render products to apply translations
    renderProducts();
}
```

**Translation Application:**
- **UI Elements:** Use `data-i18n="key"` attribute
- **Product Names:** From `product.translations.bg.name`
- **Categories:** From `product.translations.bg.category`
- **Weight Units:** `translateWeight()` function (г→g, мл→ml)

#### 2. Product Display System

**Product Rendering Flow:**
1. Fetch products from `/api/products`
2. Extract unique categories
3. Render category navigation
4. Filter by selected category
5. Apply search filter
6. Render product cards

**Product Card HTML Structure:**
```html
<div class="product-card" onclick="openProductModal(product)">
    <div class="product-image-wrapper">
        <img src="/uploads/image.jpg" alt="Product Name">
        <span class="product-badge-promo">-23%</span>
        <span class="product-weight-badge">250g</span>
    </div>
    <div class="product-info">
        <h3 class="product-name">Caesar Salad</h3>
        <p class="product-category">Salads</p>
        <p class="product-description">Fresh romaine lettuce...</p>
        <div class="product-price-row">
            <div class="product-price">
                <span class="price-eur">€8.99</span>
                <span class="price-bgn">(17.58 лв)</span>
            </div>
            <button class="add-to-cart-btn">Add to Cart</button>
        </div>
    </div>
</div>
```

**Promo Badge Logic:**
```javascript
if (product.promo && product.promo.enabled) {
    const discount = product.promo.discountPercentage || 
                     Math.round(((product.price - product.promo.promoPrice) / product.price) * 100);
    badgeHTML = `<span class="product-badge-promo">-${discount}%</span>`;
}
```

#### 3. Search & Filter System

**Search Functionality:**
- Real-time filtering on keyup
- Searches in: product name, description, category (current language)
- Case-insensitive
- Works across translated content

**Category Filtering:**
- "All Items" shows all products
- "Promotions" shows only products with active promos
- Other categories filter by `product.category`

**Combined Search + Category:**
```javascript
let filteredProducts = products;

// Filter by category
if (currentCategory !== 'all') {
    if (currentCategory === 'Promotions') {
        filteredProducts = filteredProducts.filter(p => 
            p.promo && (p.promo.isActive || p.promo.enabled)
        );
    } else {
        filteredProducts = filteredProducts.filter(p => 
            p.category === currentCategory
        );
    }
}

// Filter by search term
if (searchTerm) {
    filteredProducts = filteredProducts.filter(p => {
        const name = currentLanguage === 'bg' && p.translations?.bg?.name 
                     ? p.translations.bg.name 
                     : p.name;
        const description = currentLanguage === 'bg' && p.translations?.bg?.description 
                           ? p.translations.bg.description 
                           : p.description;
        return name.toLowerCase().includes(searchTerm) || 
               description.toLowerCase().includes(searchTerm);
    });
}
```

#### 4. Cart System

**Storage:** `localStorage.cart` (persists across sessions)

**Cart Item Structure:**
```javascript
{
    id: "prod_123",
    name: "Caesar Salad",  // English name (original)
    price: 8.99,
    promoPrice: 6.99,      // If promo active
    image: "/uploads/image.jpg",
    quantity: 2,
    category: "Salads",
    translations: {
        bg: {
            name: "Салата Цезар",
            category: "Салати"
        }
    }
}
```

**Cart Operations:**
```javascript
// Add to Cart
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            promoPrice: product.promo?.enabled ? product.promo.promoPrice : null,
            image: product.image,
            quantity: 1,
            category: product.category,
            translations: product.translations
        });
    }
    saveCart();
    updateCartIcon();
}

// Update Quantity
function updateCartQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            renderCart();
        }
    }
}

// Save to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}
```

**Cart Icon Badge:**
```javascript
function updateCartIcon() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.querySelector('.cart-badge');
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
}
```

#### 5. Slideshow System

**Display Rules:**
- Only visible in "All Items" category
- Hidden when viewing specific categories
- Hidden when search is active

**Slideshow Configuration:**
```javascript
let slideshowSettings = {
    enabled: false,
    slides: [
        {
            id: "slide_123",
            image: "/uploads/banner1.jpg",
            title: "Summer Special"
        }
    ],
    autoPlayInterval: 5000  // milliseconds
};
```

**Auto-Play Logic:**
```javascript
function startSlideshow() {
    if (slideshowSettings.enabled && slideshowSettings.slides.length > 0) {
        slideInterval = setInterval(() => {
            currentSlide = (currentSlide + 1) % slideshowSettings.slides.length;
            showSlide(currentSlide);
        }, slideshowSettings.autoPlayInterval);
    }
}

function showSlide(index) {
    const slidesContainer = document.querySelector('.slideshow-slides');
    slidesContainer.style.transform = `translateX(-${index * 100}%)`;
    
    // Update dots
    document.querySelectorAll('.slideshow-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}
```

#### 6. Product Modal

**Modal HTML Structure:**
```html
<div id="product-modal" class="modal">
    <div class="modal-content">
        <span class="modal-close">&times;</span>
        <div class="modal-body">
            <img class="modal-image" src="/uploads/image.jpg" alt="Product">
            <div class="modal-details">
                <h2 class="modal-product-name">Caesar Salad</h2>
                <p class="modal-product-category">Salads</p>
                <p class="modal-product-weight">250g</p>
                <p class="modal-product-description">Full description...</p>
                <div class="modal-price">
                    <span class="modal-price-eur">€8.99</span>
                    <span class="modal-price-bgn">(17.58 лв)</span>
                </div>
                <button class="modal-add-to-cart">Add to Cart</button>
            </div>
        </div>
    </div>
</div>
```

**Open/Close Logic:**
```javascript
function openProductModal(product) {
    // Populate modal with product data
    document.querySelector('.modal-image').src = product.image;
    document.querySelector('.modal-product-name').textContent = 
        currentLanguage === 'bg' && product.translations?.bg?.name 
        ? product.translations.bg.name 
        : product.name;
    
    // Show modal
    document.getElementById('product-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';  // Prevent background scroll
}

function closeModal() {
    document.getElementById('product-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close on outside click
window.onclick = function(event) {
    const modal = document.getElementById('product-modal');
    if (event.target === modal) {
        closeModal();
    }
}
```

---

## Admin Panel Application

### File Structure
```
public/
├── admin.html          # Admin interface
├── admin.js            # Admin logic, CRUD operations
└── admin-styles.css    # Admin-specific styling
```

### Core Functionality

#### 1. Authentication System

**Token Storage:** `sessionStorage.adminToken` (cleared on browser close)

**Login Flow:**
```javascript
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    if (data.success) {
        sessionStorage.setItem('adminToken', data.token);
        window.location.href = '/resturant-website/admin';
    } else {
        showError('Invalid credentials');
    }
}
```

**Auth Guard:**
```javascript
function checkAuth() {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/resturant-website/login';
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', checkAuth);
```

**Protected API Calls:**
```javascript
async function makeAuthRequest(url, method = 'GET', body = null) {
    const token = sessionStorage.getItem('adminToken');
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (response.status === 401) {
        // Token expired or invalid
        sessionStorage.removeItem('adminToken');
        window.location.href = '/resturant-website/login';
    }
    
    return response.json();
}
```

#### 2. Admin Language System

**Storage:** `sessionStorage.adminLanguage` (cleared on browser close)

**Translation Object:**
```javascript
const translations = {
    en: {
        adminPanel: 'Admin Panel',
        logout: 'Logout',
        pendingOrders: 'Pending Orders',
        manageProducts: 'Manage Products',
        restaurantSettings: 'Restaurant Settings',
        // ... 40+ keys
    },
    bg: {
        adminPanel: 'Админ Панел',
        logout: 'Изход',
        pendingOrders: 'Чакащи Поръчки',
        manageProducts: 'Управление на Продукти',
        restaurantSettings: 'Настройки на Ресторант',
        // ... Bulgarian translations
    }
};
```

**Language Switcher:**
```html
<div class="language-switcher">
    <button class="lang-btn" data-lang="en" onclick="switchLanguage('en')">EN</button>
    <button class="lang-btn" data-lang="bg" onclick="switchLanguage('bg')">BG</button>
</div>
```

**Switch Function:**
```javascript
function switchLanguage(lang) {
    currentLanguage = lang;
    sessionStorage.setItem('adminLanguage', lang);
    
    // Update all [data-translate] elements
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });
    
    // Update button active states
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
}
```

#### 3. Product Management (CRUD)

**Create Product:**
```javascript
async function createProduct(productData) {
    const response = await makeAuthRequest(`${API_URL}/products`, 'POST', productData);
    await loadProducts();  // Refresh product list
    closeProductForm();
    showSuccessMessage('Product created successfully');
}
```

**Update Product:**
```javascript
async function updateProduct(productId, productData) {
    const response = await makeAuthRequest(
        `${API_URL}/products/${productId}`, 
        'PUT', 
        productData
    );
    await loadProducts();
    closeProductForm();
    showSuccessMessage('Product updated successfully');
}
```

**Delete Product:**
```javascript
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    await makeAuthRequest(`${API_URL}/products/${productId}`, 'DELETE');
    await loadProducts();
    showSuccessMessage('Product deleted successfully');
}
```

**Batch Delete:**
```javascript
async function bulkDeleteProducts() {
    const selectedIds = getSelectedProductIds();
    if (selectedIds.length === 0) {
        alert('No products selected');
        return;
    }
    
    if (!confirm(`Delete ${selectedIds.length} products?`)) {
        return;
    }
    
    await makeAuthRequest(`${API_URL}/products/batch`, 'DELETE', { ids: selectedIds });
    await loadProducts();
    showSuccessMessage(`${selectedIds.length} products deleted`);
}
```

#### 4. Image Upload

**Upload Form:**
```html
<input type="file" id="product-image-upload" accept="image/*" onchange="uploadImage(this)">
```

**Upload Function:**
```javascript
async function uploadImage(input) {
    const file = input.files[0];
    if (!file) return;
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit');
        return;
    }
    
    const formData = new FormData();
    formData.append('image', file);
    
    const token = sessionStorage.getItem('adminToken');
    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData  // Don't set Content-Type, browser sets it with boundary
    });
    
    const data = await response.json();
    
    // Set image URL in form
    document.getElementById('product-image').value = data.url;
    
    // Show preview
    document.getElementById('image-preview').src = data.url;
    document.getElementById('image-preview').style.display = 'block';
}
```

#### 5. Slideshow Management

**Slideshow Settings Structure:**
```javascript
{
    enabled: true,
    autoPlayInterval: 5000,  // milliseconds
    slides: [
        {
            id: "slide_1702345678901",
            image: "/resturant-website/uploads/banner1.jpg",
            title: "Summer Special"
        }
    ]
}
```

**Add Slide:**
```javascript
function addSlide() {
    if (slides.length >= 10) {
        alert('Maximum 10 slides allowed');
        return;
    }
    
    const newSlide = {
        id: `slide_${Date.now()}`,
        image: '',
        title: ''
    };
    
    slides.push(newSlide);
    renderSlides();
}
```

**Reorder Slides:**
```javascript
function moveSlideUp(index) {
    if (index > 0) {
        [slides[index], slides[index - 1]] = [slides[index - 1], slides[index]];
        renderSlides();
    }
}

function moveSlideDown(index) {
    if (index < slides.length - 1) {
        [slides[index], slides[index + 1]] = [slides[index + 1], slides[index]];
        renderSlides();
    }
}
```

**Auto-Save on Blur:**
```javascript
function setupSlideAutoSave() {
    document.querySelectorAll('.slide-title-input').forEach(input => {
        input.addEventListener('blur', async () => {
            await saveSlideshowSettings();
            showSuccessMessage('Slide title saved');
        });
    });
}
```

#### 6. Delivery Cities Management

**Add City:**
```javascript
async function addDeliveryCity() {
    const name = document.getElementById('city-name').value.trim();
    const price = parseFloat(document.getElementById('city-price').value);
    
    if (!name || isNaN(price)) {
        alert('Please enter city name and price');
        return;
    }
    
    await makeAuthRequest(`${API_URL}/delivery/cities`, 'POST', { name, price });
    await loadDeliveryCities();
    
    // Clear inputs
    document.getElementById('city-name').value = '';
    document.getElementById('city-price').value = '';
}
```

**Edit City:**
```javascript
async function editCity(cityId) {
    const city = deliveryCities.find(c => c.id === cityId);
    if (!city) return;
    
    const newName = prompt('City name:', city.name);
    const newPrice = prompt('Delivery price:', city.price);
    
    if (newName && newPrice) {
        await makeAuthRequest(
            `${API_URL}/delivery/cities/${cityId}`, 
            'PUT', 
            { name: newName, price: parseFloat(newPrice) }
        );
        await loadDeliveryCities();
    }
}
```

---

## Checkout Application

### File Structure
```
public/
├── checkout.html       # Checkout page
└── checkout.js         # Checkout logic, form validation
```

### Core Functionality

#### 1. Cart Display
Reads from `localStorage.cart` and displays items with quantities and prices.

#### 2. Delivery Method Selection
```javascript
function selectDeliveryMethod(method) {
    if (method === 'pickup') {
        document.getElementById('delivery-fields').style.display = 'none';
        deliveryFee = 0;
    } else {
        document.getElementById('delivery-fields').style.display = 'block';
        calculateDeliveryFee();
    }
    updateTotals();
}
```

#### 3. Form Validation
```javascript
function validateCheckoutForm() {
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const email = document.getElementById('customer-email').value.trim();
    
    if (!name || !phone || !email) {
        alert('Please fill all required fields');
        return false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return false;
    }
    
    // Phone validation (Bulgarian format)
    const phoneRegex = /^(\+359|0)[0-9]{9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        alert('Please enter a valid Bulgarian phone number');
        return false;
    }
    
    return true;
}
```

#### 4. Order Submission
```javascript
async function submitOrder() {
    if (!validateCheckoutForm()) {
        return;
    }
    
    const orderData = {
        items: cart,
        total: calculateTotal(),
        deliveryMethod: selectedDeliveryMethod,
        deliveryFee: deliveryFee,
        deliveryAddress: document.getElementById('delivery-address').value,
        deliveryCity: document.getElementById('delivery-city').value,
        customerName: document.getElementById('customer-name').value,
        customerPhone: document.getElementById('customer-phone').value,
        customerEmail: document.getElementById('customer-email').value
    };
    
    const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    });
    
    const data = await response.json();
    
    if (data.success) {
        // Clear cart
        localStorage.removeItem('cart');
        
        // Show confirmation
        showOrderConfirmation(data.orderId);
    } else {
        alert('Failed to place order. Please try again.');
    }
}
```

---

## Responsive Design Strategy

### Breakpoints
```css
/* Mobile First Approach */

/* Base styles: Mobile (< 768px) */

/* Tablet */
@media (min-width: 768px) {
    /* Tablet-specific styles */
}

/* Desktop */
@media (min-width: 1024px) {
    /* Desktop-specific styles */
}

/* Large Desktop */
@media (min-width: 1440px) {
    /* Large screen optimizations */
}
```

### Mobile Optimizations

**Product Cards:**
- Single column layout
- Larger touch targets (min 44x44px)
- Shorter "Add" button text
- 2-line name truncation with ellipsis

**Search:**
- Toggle button instead of always-visible search bar
- Full-width search on mobile
- Close button in search field

**Navigation:**
- Hamburger menu for categories
- Sticky bottom cart button

**Pricing:**
- BGN price: 12px font (was reduced for better readability)

**Checkout:**
- Top bar height: 32px (consistent with menu)
- Larger form inputs
- Simplified layout

---

## Performance Optimizations

### 1. Image Lazy Loading
```javascript
<img src="placeholder.jpg" data-src="actual-image.jpg" loading="lazy" alt="Product">
```

### 2. Debounced Search
```javascript
let searchTimeout;
function handleSearch(event) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        renderProducts();
    }, 300);  // Wait 300ms after last keypress
}
```

### 3. Virtual Scrolling (Future Enhancement)
For menus with 1000+ products, implement virtual scrolling to render only visible items.

### 4. Image Optimization Recommendations
- **Format:** WebP with JPEG fallback
- **Product Images:** Max 800x600px, 80% quality
- **Slideshow Banners:** Desktop 1200x400px, Mobile 800x600px
- **Compression:** TinyPNG or similar

---

## Browser Compatibility

**Tested Browsers:**
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅
- Samsung Internet 14+ ✅

**Polyfills Required:** None (uses modern JavaScript supported by all target browsers)

**Graceful Degradation:**
- No JavaScript: Shows static HTML with message to enable JavaScript
- Old browsers: Falls back to standard layouts without modern CSS features
