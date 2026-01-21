# Development Guide - Restaurant Menu System

## Quick Start for Developers

### Prerequisites
- **Node.js:** v14.0.0 or higher (v20.19.6 recommended)
- **npm:** v6.0.0 or higher (comes with Node.js)
- **Git:** For version control
- **Code Editor:** VS Code recommended
- **Browser:** Chrome, Firefox, or Edge (latest versions)

### Initial Setup

**1. Install Dependencies:**
```bash
cd C:\Users\User\Desktop\resturant-template
npm install
```

**2. Start Development Server:**
```bash
npm start
```

**3. Access Application:**
- Customer Menu: http://localhost:3003/resturant-website/
- Admin Panel: http://localhost:3003/resturant-website/admin
- Login Page: http://localhost:3003/resturant-website/login

**4. Default Admin Credentials:**
- Username: `admin`
- Password: `admin123`

---

## Project Structure

```
resturant-template/
├── server.js                    # Express server, API endpoints
├── package.json                 # Dependencies and scripts
├── database.json                # JSON database (auto-created)
├── deploy-to-server.ps1         # Deployment script
├── PROJECT_CONTEXT.md           # Project overview and context
├── API_REFERENCE.md             # Complete API documentation
├── FRONTEND_ARCHITECTURE.md     # Frontend technical details
├── BACKEND_ARCHITECTURE.md      # Backend technical details
├── DEVELOPMENT_GUIDE.md         # This file
├── README.md                    # User-facing documentation
├── TEST_SUITE.md                # Comprehensive test cases
│
├── public/                      # Frontend files (served by Express)
│   ├── index.html               # Customer menu page
│   ├── app.js                   # Menu logic (product display, cart)
│   ├── styles.css               # Menu styling
│   │
│   ├── admin.html               # Admin panel interface
│   ├── admin.js                 # Admin logic (CRUD, settings)
│   ├── admin-styles.css         # Admin panel styling
│   │
│   ├── checkout.html            # Checkout page
│   ├── checkout.js              # Checkout logic
│   │
│   └── login.html               # Login page
│
└── uploads/                     # Uploaded images (auto-created)
```

---

## Common Development Tasks

### 1. Adding a New Product Field

**Example: Add "allergens" field to products**

**Step 1: Update Database Schema**
Edit `database.json`:
```json
{
  "products": [
    {
      "id": "prod_123",
      "name": "Caesar Salad",
      "allergens": ["dairy", "eggs"],  // NEW FIELD
      // ... existing fields
    }
  ]
}
```

**Step 2: Update Backend API**
Edit `server.js` (POST and PUT product endpoints):
```javascript
app.post(API_PREFIX + '/products', requireAuth, (req, res) => {
    const newProduct = {
        id: `prod_${Date.now()}`,
        name: req.body.name,
        allergens: req.body.allergens || [],  // NEW FIELD
        // ... other fields
    };
    // ...
});
```

**Step 3: Update Admin Panel Form**
Edit `admin.html`:
```html
<div class="form-group">
    <label>Allergens</label>
    <select id="product-allergens" multiple>
        <option value="dairy">Dairy</option>
        <option value="eggs">Eggs</option>
        <option value="nuts">Nuts</option>
        <option value="gluten">Gluten</option>
    </select>
</div>
```

Edit `admin.js` (save product function):
```javascript
function saveProduct() {
    const allergenSelect = document.getElementById('product-allergens');
    const allergens = Array.from(allergenSelect.selectedOptions).map(o => o.value);
    
    const productData = {
        name: document.getElementById('product-name').value,
        allergens: allergens,  // NEW FIELD
        // ... other fields
    };
    // ...
}
```

**Step 4: Update Customer Display**
Edit `app.js` (product card rendering):
```javascript
function renderProductCard(product) {
    let allergenBadges = '';
    if (product.allergens && product.allergens.length > 0) {
        allergenBadges = product.allergens.map(a => 
            `<span class="allergen-badge">${a}</span>`
        ).join('');
    }
    
    return `
        <div class="product-card">
            <!-- existing card content -->
            <div class="allergen-info">${allergenBadges}</div>
        </div>
    `;
}
```

Edit `styles.css`:
```css
.allergen-badge {
    display: inline-block;
    background: #ff9800;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    margin: 2px;
}
```

---

### 2. Adding a New API Endpoint

**Example: Add "favorites" endpoint**

**Step 1: Define Route in server.js**
```javascript
// Get favorites
app.get(API_PREFIX + '/favorites', requireAuth, (req, res) => {
    const db = readDatabase();
    res.json(db.favorites || []);
});

// Add to favorites
app.post(API_PREFIX + '/favorites', requireAuth, (req, res) => {
    const db = readDatabase();
    
    if (!db.favorites) {
        db.favorites = [];
    }
    
    const newFavorite = {
        id: `fav_${Date.now()}`,
        productId: req.body.productId,
        userId: req.body.userId,
        createdAt: new Date().toISOString()
    };
    
    db.favorites.push(newFavorite);
    writeDatabase(db);
    
    res.status(201).json(newFavorite);
});

// Remove from favorites
app.delete(API_PREFIX + '/favorites/:id', requireAuth, (req, res) => {
    const db = readDatabase();
    const index = db.favorites.findIndex(f => f.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Favorite not found' });
    }
    
    db.favorites.splice(index, 1);
    writeDatabase(db);
    
    res.json({ message: 'Favorite removed successfully' });
});
```

**Step 2: Call from Frontend**
```javascript
async function addToFavorites(productId) {
    const token = sessionStorage.getItem('adminToken');
    
    const response = await fetch(`${API_URL}/favorites`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId, userId: 'user_123' })
    });
    
    const data = await response.json();
    console.log('Added to favorites:', data);
}
```

---

### 3. Adding Translation Keys

**Step 1: Add to app.js translations object:**
```javascript
const translations = {
    en: {
        // ... existing keys
        favorites: 'Favorites',
        addToFavorites: 'Add to Favorites',
        removeFromFavorites: 'Remove from Favorites'
    },
    bg: {
        // ... existing keys
        favorites: 'Любими',
        addToFavorites: 'Добави в Любими',
        removeFromFavorites: 'Премахни от Любими'
    }
};
```

**Step 2: Use in HTML with data-i18n attribute:**
```html
<button data-i18n="addToFavorites">Add to Favorites</button>
```

**Step 3: Translation applies automatically on language switch**

---

### 4. Modifying Styles

**Global Styles (Customer Menu):**
Edit `public/styles.css`

**Admin Styles:**
Edit `public/admin-styles.css`

**CSS Variables for Theming:**
```css
:root {
    --top-bar-color: #2c3e50;
    --background-color: #f5f5f5;
    --highlight-color: #e74c3c;
    --price-color: #e74c3c;
}

/* Use in styles */
.price {
    color: var(--price-color);
}
```

**Responsive Design Pattern:**
```css
/* Mobile first (base styles for < 768px) */
.product-card {
    width: 100%;
}

/* Tablet */
@media (min-width: 768px) {
    .product-card {
        width: 48%;
    }
}

/* Desktop */
@media (min-width: 1024px) {
    .product-card {
        width: 32%;
    }
}
```

---

### 5. Debugging

**Enable Server Logging:**
```javascript
// Add to server.js
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
```

**Browser DevTools:**
- **Console Tab:** View JavaScript errors and logs
- **Network Tab:** Inspect API requests/responses
- **Application Tab:** View localStorage/sessionStorage

**Common Issues:**

**Issue: "CORS error"**
```javascript
// Solution: Ensure CORS middleware is enabled
app.use(cors());
```

**Issue: "401 Unauthorized"**
```javascript
// Check if token is present
const token = sessionStorage.getItem('adminToken');
console.log('Token:', token);

// Check if token is in Authorization header
console.log('Headers:', fetch.headers);
```

**Issue: "Product not saving"**
```javascript
// Check database write permissions
const db = readDatabase();
console.log('Current products:', db.products);

// Check if writeDatabase succeeds
const success = writeDatabase(db);
console.log('Write success:', success);
```

---

## Testing

### Manual Testing Checklist

**Customer Menu:**
- [ ] Products display correctly
- [ ] Search filters products
- [ ] Category filtering works
- [ ] Language switch translates content
- [ ] Add to cart updates badge
- [ ] Cart shows correct totals
- [ ] Slideshow auto-plays
- [ ] Modal opens and closes

**Admin Panel:**
- [ ] Login with admin/admin123
- [ ] Products list loads
- [ ] Create new product
- [ ] Edit existing product
- [ ] Delete product
- [ ] Upload image
- [ ] Add slideshow slide
- [ ] Reorder slides
- [ ] Add delivery city
- [ ] Save settings
- [ ] Logout

**Checkout:**
- [ ] Cart items display
- [ ] Delivery method selection
- [ ] City selector populates
- [ ] Form validation works
- [ ] Order submission succeeds

### Automated Testing (Future Enhancement)

**Unit Tests with Jest:**
```javascript
// tests/product.test.js
const { createProduct } = require('../server');

test('creates product with valid data', () => {
    const product = createProduct({
        name: 'Test Product',
        price: 9.99
    });
    
    expect(product).toHaveProperty('id');
    expect(product.name).toBe('Test Product');
    expect(product.price).toBe(9.99);
});
```

**Integration Tests with Supertest:**
```javascript
const request = require('supertest');
const app = require('../server');

test('GET /api/products returns products array', async () => {
    const response = await request(app).get('/api/products');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
});
```

---

## Deployment

### Deploy to Production Server

**Option 1: PowerShell Script (Recommended)**
```powershell
.\deploy-to-server.ps1
```

**Option 2: Manual Deployment**
```bash
# 1. Upload files via SCP
scp -r public server.js package.json root@46.62.174.218:/opt/resturant-website/

# 2. SSH into server
ssh root@46.62.174.218

# 3. Install dependencies
cd /opt/resturant-website
npm install

# 4. Restart service
systemctl restart restaurant

# 5. Check status
systemctl status restaurant
```

**What Gets Deployed:**
- ✅ `server.js`
- ✅ `package.json`
- ✅ `public/` directory (all frontend files)
- ❌ `database.json` (excluded to preserve production data)
- ❌ `node_modules/` (installed on server)
- ❌ `uploads/` (preserved on server)

---

## Database Management

### Backup Database
```bash
# Download from server
ssh root@46.62.174.218 "cat /opt/resturant-website/database.json" > backup.json
```

### Restore Database
```bash
# Upload to server
scp backup.json root@46.62.174.218:/opt/resturant-website/database.json

# Restart service
ssh root@46.62.174.218 "systemctl restart restaurant"
```

### Reset Database to Initial State
```javascript
// On server or local
const initialData = {
    restaurantName: "Restaurant Name",
    products: [],
    promoCodes: [],
    deliverySettings: { enabled: false },
    deliveryCities: [],
    workingHours: { opening: "09:00", closing: "22:00" },
    currencySettings: { eurToBgnRate: 1.9558, showBgnPrices: true },
    customization: {
        topBarColor: "#2c3e50",
        backgroundColor: "#f5f5f5",
        highlightColor: "#e74c3c",
        priceColor: "#e74c3c"
    },
    slideshowEnabled: false,
    slideshowInterval: 5000,
    slides: [],
    orders: []
};

fs.writeFileSync('database.json', JSON.stringify(initialData, null, 2));
```

---

## Git Workflow

### Initialize Git Repository
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/restaurant-menu.git
git push -u origin main
```

### Recommended .gitignore
```
node_modules/
uploads/
database.json
.env
*.log
.DS_Store
```

### Feature Branch Workflow
```bash
# Create feature branch
git checkout -b feature/add-favorites

# Make changes, commit
git add .
git commit -m "Add favorites functionality"

# Push to remote
git push origin feature/add-favorites

# Merge to main
git checkout main
git merge feature/add-favorites
git push origin main
```

---

## Environment Variables

### Create .env File
```bash
# .env (local development)
PORT=3003
BASE_PATH=/resturant-website
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
NODE_ENV=development
```

### Load in server.js
```javascript
require('dotenv').config();

const PORT = process.env.PORT || 3003;
const BASE_PATH = process.env.BASE_PATH || '';
```

### Production Environment Variables
Set in systemd service file:
```ini
[Service]
Environment=NODE_ENV=production
Environment=PORT=3003
Environment=BASE_PATH=/resturant-website
```

---

## Code Style Guide

### JavaScript

**Naming Conventions:**
- **Variables/Functions:** `camelCase` (e.g., `currentLanguage`, `switchLanguage`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `API_URL`, `BASE_PATH`)
- **Classes:** `PascalCase` (e.g., `ProductManager`)

**Indentation:** 4 spaces (or 2 spaces, be consistent)

**Quotes:** Single quotes `'` for strings

**Semicolons:** Use semicolons (or consistently omit)

**Example:**
```javascript
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            quantity: 1
        });
    }
    
    saveCart();
}
```

### HTML

**Indentation:** 4 spaces

**Attributes:** Use double quotes `"`

**Example:**
```html
<div class="product-card" data-id="123">
    <img src="/uploads/image.jpg" alt="Product Name">
    <h3 class="product-name">Product Name</h3>
    <button onclick="addToCart('123')">Add to Cart</button>
</div>
```

### CSS

**Indentation:** 4 spaces

**Property Order:** Alphabetical or grouped by type

**Example:**
```css
.product-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    padding: 16px;
    transition: transform 0.3s;
}

.product-card:hover {
    transform: translateY(-4px);
}
```

---

## Troubleshooting

### Server Won't Start

**Error: "Port 3003 already in use"**
```bash
# Find process using port
netstat -ano | findstr :3003

# Kill process (replace PID)
taskkill /PID 12345 /F
```

**Error: "Cannot find module 'express'"**
```bash
# Install dependencies
npm install
```

### Database Corruption

**Symptoms:** JSON parse errors, missing data

**Solution:**
```bash
# 1. Backup corrupted file
mv database.json database.json.corrupted

# 2. Restore from backup
cp backup-20251219.json database.json

# 3. Restart server
systemctl restart restaurant
```

### CSS Changes Not Reflecting

**Solution:** Hard refresh browser
- Chrome/Firefox: `Ctrl + Shift + R`
- Or clear browser cache

### Images Not Loading

**Check:**
1. File exists in `uploads/` directory
2. File permissions (should be readable)
3. URL includes BASE_PATH (e.g., `/resturant-website/uploads/image.jpg`)
4. Image size < 5MB

---

## Performance Optimization

### 1. Enable Gzip Compression
```javascript
const compression = require('compression');
app.use(compression());
```

### 2. Cache Static Assets (Nginx)
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. Lazy Load Images
```html
<img src="placeholder.jpg" data-src="actual-image.jpg" loading="lazy" alt="Product">
```

### 4. Minify CSS/JS (Production)
```bash
npm install -g uglify-js cssnano

# Minify JS
uglifyjs public/app.js -o public/app.min.js

# Minify CSS
cssnano public/styles.css public/styles.min.css
```

---

## Useful Commands

### Development
```bash
npm start              # Start server
npm run dev            # Start with nodemon (auto-restart)
node server.js         # Start server directly
```

### Production
```bash
# Server management
systemctl start restaurant
systemctl stop restaurant
systemctl restart restaurant
systemctl status restaurant

# View logs
journalctl -u restaurant -f
journalctl -u restaurant --since today

# Nginx
nginx -t               # Test config
systemctl reload nginx # Reload config
systemctl status nginx # Check status
```

### Database
```bash
# Backup
ssh root@46.62.174.218 "cat /opt/resturant-website/database.json" > backup.json

# Restore
scp backup.json root@46.62.174.218:/opt/resturant-website/database.json

# View database
ssh root@46.62.174.218 "cat /opt/resturant-website/database.json"
```

---

## Resources

### Official Documentation
- **Node.js:** https://nodejs.org/docs
- **Express:** https://expressjs.com/
- **Multer:** https://github.com/expressjs/multer

### Tools
- **VS Code:** https://code.visualstudio.com/
- **Postman:** https://www.postman.com/ (API testing)
- **Git:** https://git-scm.com/

### Learning
- **MDN Web Docs:** https://developer.mozilla.org/
- **Express Tutorial:** https://expressjs.com/en/starter/installing.html
- **JavaScript.info:** https://javascript.info/

---

## Getting Help

**Internal Documentation:**
- `PROJECT_CONTEXT.md` - Project overview and business context
- `API_REFERENCE.md` - Complete API documentation
- `FRONTEND_ARCHITECTURE.md` - Frontend technical details
- `BACKEND_ARCHITECTURE.md` - Backend technical details
- `TEST_SUITE.md` - Comprehensive test cases

**Server Access:**
- SSH: `ssh root@46.62.174.218`
- Logs: `journalctl -u restaurant -f`

**Contact:**
- Developer: GitHub Copilot + User
- Repository: `C:\Users\User\Desktop\resturant-template`
