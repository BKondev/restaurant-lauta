# Backend Architecture - Restaurant Menu System

## Overview

**Technology:** Node.js + Express.js  
**Port:** 3003 (configurable via `PORT` environment variable)  
**Database:** JSON file storage (`database.json`)  
**File Upload:** Multer middleware  
**Authentication:** Simple token-based (no JWT)  

---

## Server Configuration

### Base Path Support
```javascript
const BASE_PATH = process.env.BASE_PATH || '/resturant-website';
```

**Purpose:** Allows deployment under subdirectory (e.g., `/resturant-website`)

**Usage:**
- Static files: `app.use(BASE_PATH, express.static('public'))`
- API routes: `app.post(BASE_PATH + '/api/login', ...)`
- Uploads: `app.use(BASE_PATH + '/uploads', express.static('uploads'))`

---

## Middleware Stack

### 1. CORS
```javascript
app.use(cors());
```
**Purpose:** Allow cross-origin requests from any domain  
**Production Note:** Should restrict to specific domains

### 2. Body Parsers
```javascript
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```
**Purpose:** Parse JSON and URL-encoded request bodies  
**Limit:** 50MB for large image uploads via base64

### 3. Static File Serving
```javascript
if (BASE_PATH) {
    app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));
    app.use(BASE_PATH + '/uploads', express.static(path.join(__dirname, 'uploads')));
} else {
    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}
```
**Purpose:** Serve HTML/CSS/JS files and uploaded images

---

## Database System

### JSON File Storage

**File:** `database.json`  
**Location:** Root directory  
**Format:** Pretty-printed JSON with 2-space indentation

**Advantages:**
- No database server required
- Human-readable for debugging
- Easy backup (single file copy)
- Git-friendly (text format)
- Atomic writes prevent corruption

**Disadvantages:**
- Not suitable for high concurrency
- No complex queries
- Full file read/write on each operation
- Limited to single server (no clustering)

### Database Schema
```json
{
  "restaurantName": "BOJOLE Restaurant",
  "logo": "/resturant-website/uploads/logo.png",
  "products": [
    {
      "id": "prod_1702345678901",
      "name": "Caesar Salad",
      "description": "Fresh romaine lettuce with parmesan cheese",
      "price": 8.99,
      "category": "Salads",
      "image": "/resturant-website/uploads/caesar.jpg",
      "weight": "250g",
      "promo": {
        "enabled": true,
        "promoPrice": 6.99,
        "discountPercentage": 22
      },
      "translations": {
        "bg": {
          "name": "Салата Цезар",
          "description": "Пресен ромен с пармезан",
          "category": "Салати"
        }
      }
    }
  ],
  "promoCodes": [
    {
      "id": "promo_123",
      "code": "SUMMER20",
      "discount": 20,
      "category": "All Categories",
      "active": true
    }
  ],
  "deliverySettings": {
    "enabled": true,
    "standardFee": 5.00,
    "freeDeliveryThreshold": 50.00,
    "enableFreeDelivery": true
  },
  "deliveryCities": [
    {
      "id": "city_123",
      "name": "София",
      "price": 5.00
    }
  ],
  "workingHours": {
    "opening": "09:00",
    "closing": "22:00"
  },
  "currencySettings": {
    "eurToBgnRate": 1.9558,
    "showBgnPrices": true
  },
  "customization": {
    "topBarColor": "#2c3e50",
    "backgroundColor": "#f5f5f5",
    "highlightColor": "#e74c3c",
    "priceColor": "#e74c3c",
    "backgroundImage": ""
  },
  "slideshowEnabled": true,
  "slideshowInterval": 5000,
  "slides": [
    {
      "id": "slide_123",
      "image": "/resturant-website/uploads/banner1.jpg",
      "title": "Summer Special"
    }
  ],
  "orders": [
    {
      "id": "order_123",
      "items": [
        {
          "id": "prod_123",
          "name": "Caesar Salad",
          "price": 8.99,
          "quantity": 2
        }
      ],
      "total": 22.98,
      "deliveryMethod": "delivery",
      "deliveryFee": 5.00,
      "deliveryAddress": "ул. Витоша 123, София",
      "deliveryCity": "София",
      "customerName": "Иван Иванов",
      "customerPhone": "+359888123456",
      "customerEmail": "ivan@example.com",
      "status": "pending",
      "createdAt": "2025-12-19T10:30:00.000Z"
    }
  ]
}
```

### Database Functions

#### Initialize Database
```javascript
function initDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            restaurantName: "Restaurant Name",
            products: [],
            promoCodes: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
}
```
**Called:** On server startup

#### Read Database
```javascript
function readDatabase() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        // Ensure required arrays exist
        if (!parsed.promoCodes) parsed.promoCodes = [];
        if (!parsed.products) parsed.products = [];
        if (!parsed.deliveryCities) parsed.deliveryCities = [];
        if (!parsed.slides) parsed.slides = [];
        if (!parsed.orders) parsed.orders = [];
        
        return parsed;
    } catch (error) {
        console.error('Error reading database:', error);
        return { 
            restaurantName: "Restaurant Name", 
            products: [], 
            promoCodes: [],
            deliveryCities: [],
            slides: [],
            orders: []
        };
    }
}
```
**Thread Safety:** Node.js is single-threaded; synchronous read is safe

#### Write Database
```javascript
function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}
```
**Atomic Writes:** `writeFileSync` is atomic on most filesystems

---

## Authentication System

### Credentials
```javascript
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'  // ⚠️ Plain text - should be bcrypt in production
};
```

### Token Storage
```javascript
const activeTokens = new Set();

function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
```
**Storage:** In-memory Set (cleared on server restart)  
**Format:** Random alphanumeric string  
**Lifetime:** Until logout or server restart

### Authentication Middleware
```javascript
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required' 
        });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer '
    
    if (!activeTokens.has(token)) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
    
    next();
}
```

**Usage:**
```javascript
app.post('/api/products', requireAuth, (req, res) => {
    // Protected route - requires valid token
});
```

### Login Endpoint
```javascript
app.post(API_PREFIX + '/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_CREDENTIALS.username && 
        password === ADMIN_CREDENTIALS.password) {
        
        const token = generateToken();
        activeTokens.add(token);
        
        res.json({
            success: true,
            token: token,
            message: 'Login successful'
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }
});
```

### Logout Endpoint
```javascript
app.post(API_PREFIX + '/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        activeTokens.delete(token);
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});
```

---

## File Upload System

### Multer Configuration
```javascript
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});
```

**Filename Format:** `{timestamp}-{random9digits}.{extension}`  
**Example:** `1702345678901-987654321.jpg`

### Upload Endpoint
```javascript
app.post(API_PREFIX + '/upload', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Return URL with BASE_PATH for subdirectory deployment
    const imageUrl = `${BASE_PATH}/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
});
```

**Request Format:** `multipart/form-data` with field name `image`  
**Response:** `{ "url": "/resturant-website/uploads/1702345678901-987654321.jpg" }`

### Upload Directory
```javascript
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
```
**Created:** On server startup if missing

---

## API Route Structure

### Route Naming Convention
```
/api/resource          # GET all, POST create
/api/resource/:id      # GET one, PUT update, DELETE delete
/api/resource/batch    # Batch operations
```

### Example: Products API
```javascript
const API_PREFIX = BASE_PATH + '/api';

// Public routes (no auth)
app.get(API_PREFIX + '/products', (req, res) => { /* ... */ });
app.get(API_PREFIX + '/products/:id', (req, res) => { /* ... */ });

// Protected routes (require auth)
app.post(API_PREFIX + '/products', requireAuth, (req, res) => { /* ... */ });
app.put(API_PREFIX + '/products/:id', requireAuth, (req, res) => { /* ... */ });
app.delete(API_PREFIX + '/products/:id', requireAuth, (req, res) => { /* ... */ });
app.delete(API_PREFIX + '/products/batch', requireAuth, (req, res) => { /* ... */ });
```

---

## Error Handling

### Standard Error Response Format
```javascript
res.status(400).json({ 
    error: 'Error message',
    details: 'Additional context' 
});
```

### Common HTTP Status Codes
- **200 OK:** Successful GET, PUT, DELETE
- **201 Created:** Successful POST (resource created)
- **400 Bad Request:** Invalid input data
- **401 Unauthorized:** Missing or invalid auth token
- **404 Not Found:** Resource doesn't exist
- **500 Internal Server Error:** Server-side error

### Global Error Handler
```javascript
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});
```

---

## CRUD Operations Pattern

### Generic CRUD Template
```javascript
// GET all
app.get(API_PREFIX + '/resource', (req, res) => {
    const db = readDatabase();
    res.json(db.resources || []);
});

// GET one
app.get(API_PREFIX + '/resource/:id', (req, res) => {
    const db = readDatabase();
    const item = db.resources.find(r => r.id === req.params.id);
    
    if (!item) {
        return res.status(404).json({ error: 'Resource not found' });
    }
    
    res.json(item);
});

// POST create
app.post(API_PREFIX + '/resource', requireAuth, (req, res) => {
    const db = readDatabase();
    
    const newItem = {
        id: `resource_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    
    db.resources.push(newItem);
    writeDatabase(db);
    
    res.status(201).json(newItem);
});

// PUT update
app.put(API_PREFIX + '/resource/:id', requireAuth, (req, res) => {
    const db = readDatabase();
    const index = db.resources.findIndex(r => r.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Resource not found' });
    }
    
    db.resources[index] = {
        ...db.resources[index],
        ...req.body,
        id: req.params.id,  // Preserve ID
        updatedAt: new Date().toISOString()
    };
    
    writeDatabase(db);
    res.json(db.resources[index]);
});

// DELETE
app.delete(API_PREFIX + '/resource/:id', requireAuth, (req, res) => {
    const db = readDatabase();
    const index = db.resources.findIndex(r => r.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Resource not found' });
    }
    
    db.resources.splice(index, 1);
    writeDatabase(db);
    
    res.json({ message: 'Resource deleted successfully' });
});
```

---

## Server Startup

### Entry Point
```javascript
const PORT = process.env.PORT || 3003;

initDatabase();  // Create DB file if missing

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Base path: ${BASE_PATH || '/'}`);
    console.log(`API available at: http://localhost:${PORT}${BASE_PATH}/api`);
});
```

### Process Management (Production)

**systemd Service File:** `/etc/systemd/system/restaurant.service`
```ini
[Unit]
Description=Restaurant Menu Node Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/resturant-website
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=restaurant

Environment=NODE_ENV=production
Environment=PORT=3003
Environment=BASE_PATH=/resturant-website

[Install]
WantedBy=multi-user.target
```

**Commands:**
```bash
systemctl start restaurant    # Start service
systemctl stop restaurant     # Stop service
systemctl restart restaurant  # Restart service
systemctl status restaurant   # Check status
journalctl -u restaurant -f   # View logs
```

---

## Nginx Configuration

**Reverse Proxy:** Nginx forwards requests from port 80/443 to Node.js on port 3003

**Config File:** `/etc/nginx/sites-available/restaurant`
```nginx
server {
    listen 80;
    server_name www.crystalautomation.eu crystalautomation.eu;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.crystalautomation.eu crystalautomation.eu;

    ssl_certificate /etc/letsencrypt/live/crystalautomation.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crystalautomation.eu/privkey.pem;

    # Restaurant app under /resturant-website
    location /resturant-website/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**SSL Certificate:** Let's Encrypt via Certbot

---

## Performance Considerations

### Current Performance Profile
- **Concurrency:** Single-threaded, suitable for <100 concurrent users
- **Database Read/Write:** Synchronous file I/O (acceptable for small datasets)
- **Memory Usage:** ~1MB RAM (database held in memory during operations)

### Optimization Strategies

**1. Caching:**
```javascript
let cachedProducts = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

app.get('/api/products', (req, res) => {
    const now = Date.now();
    if (cachedProducts && (now - cacheTimestamp) < CACHE_TTL) {
        return res.json(cachedProducts);
    }
    
    const db = readDatabase();
    cachedProducts = db.products;
    cacheTimestamp = now;
    
    res.json(cachedProducts);
});
```

**2. Async File Operations:**
```javascript
function readDatabaseAsync() {
    return new Promise((resolve, reject) => {
        fs.readFile(DB_FILE, 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(JSON.parse(data));
        });
    });
}
```

**3. Database Migration (Future):**
- SQLite for moderate scale (1000-10000 products)
- PostgreSQL for high scale (10000+ products, multi-location)

---

## Security Hardening (Production)

### 1. Environment Variables
```javascript
require('dotenv').config();

const ADMIN_CREDENTIALS = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD_HASH  // bcrypt hash
};
```

### 2. Password Hashing
```javascript
const bcrypt = require('bcrypt');

// Hash password on signup
const hash = await bcrypt.hash(password, 10);

// Verify on login
const match = await bcrypt.compare(password, hash);
```

### 3. JWT Tokens
```javascript
const jwt = require('jsonwebtoken');

// Generate token
const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });

// Verify token
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### 4. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 5. Input Sanitization
```javascript
const validator = require('validator');

function sanitizeProductInput(data) {
    return {
        name: validator.escape(data.name),
        description: validator.escape(data.description),
        price: parseFloat(data.price),
        category: validator.escape(data.category)
    };
}
```

---

## Deployment Process

### Deployment Script
**File:** `deploy-to-server.ps1`

**Steps:**
1. Test SSH connection
2. Create directories on server
3. Upload files via SCP (excludes `database.json`, `node_modules`, `uploads`)
4. Install npm dependencies on server
5. Restart systemd service
6. Reload Nginx configuration
7. Check service status

**Key Exclusion:**
```powershell
# database.json is NOT uploaded to preserve production data
```

### Manual Deployment
```bash
# SSH into server
ssh root@46.62.174.218

# Navigate to app directory
cd /opt/resturant-website

# Pull latest code (if using Git)
git pull origin main

# Install dependencies
npm install

# Restart service
systemctl restart restaurant

# Check status
systemctl status restaurant
```

---

## Monitoring & Logging

### View Logs
```bash
# Real-time logs
journalctl -u restaurant -f

# Last 100 lines
journalctl -u restaurant -n 100

# Today's logs
journalctl -u restaurant --since today
```

### Custom Logging
```javascript
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        data
    };
    console.log(JSON.stringify(logEntry));
}

// Usage
log('INFO', 'Product created', { productId: newProduct.id });
log('ERROR', 'Database write failed', { error: err.message });
```

---

## Backup & Recovery

### Database Backup
```bash
# Manual backup
ssh root@46.62.174.218 "cat /opt/resturant-website/database.json" > backup-$(date +%Y%m%d).json

# Automated daily backup (cron)
0 2 * * * /usr/bin/ssh root@46.62.174.218 "cat /opt/resturant-website/database.json" > /backups/restaurant-$(date +\%Y\%m\%d).json
```

### Restore Database
```bash
# Upload backup to server
scp backup-20251219.json root@46.62.174.218:/opt/resturant-website/database.json

# Restart service
ssh root@46.62.174.218 "systemctl restart restaurant"
```

### Image Backup
```bash
# Backup uploads directory
rsync -avz root@46.62.174.218:/opt/resturant-website/uploads/ ./uploads-backup/
```
