const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendToDeliveryService } = require('./delivery-integration');
const { printOrder } = require('./printer-service');

const app = express();
const PORT = process.env.PORT || 3003;
// Base path for mounting the app (e.g. '/resturant-website'). Empty string means root.
const BASE_PATH = process.env.BASE_PATH || '/resturant-website';

// Simple authentication credentials (in production, use environment variables and hashed passwords)
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123' // In production, this should be hashed with bcrypt
};

// Simple token storage (in production, use JWT or sessions with Redis)
const activeTokens = new Set();

// Generate simple token
function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files & uploads served under BASE_PATH if defined
if (BASE_PATH) {
    app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));
    app.use(BASE_PATH + '/uploads', express.static(path.join(__dirname, 'uploads')));
} else {
    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Setup multer for image uploads
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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

// Database file path
const DB_FILE = path.join(__dirname, 'database.json');

// Initialize database if it doesn't exist
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

// Read database
function readDatabase() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        // Ensure promoCodes array exists
        if (!parsed.promoCodes) {
            parsed.promoCodes = [];
        }
        return parsed;
    } catch (error) {
        console.error('Error reading database:', error);
        return { restaurantName: "Restaurant Name", products: [], promoCodes: [] };
    }
}

// Write database
function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

// Initialize database on startup
initDatabase();

// ==================== API ROUTES ====================

const API_PREFIX = BASE_PATH + '/api';

// Login endpoint
app.post(API_PREFIX + '/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
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
            message: 'Invalid username or password'
        });
    }
});

// Logout endpoint
app.post(API_PREFIX + '/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
        activeTokens.delete(token);
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Middleware to check authentication for protected routes
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token || !activeTokens.has(token)) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please login to access this resource'
        });
    }
    
    next();
}

// Get all products (public route)
app.get(API_PREFIX + '/products', (req, res) => {
    const db = readDatabase();
    res.json(db.products);
});

// Get single product
app.get(API_PREFIX + '/products/:id', (req, res) => {
    const db = readDatabase();
    const product = db.products.find(p => p.id === parseInt(req.params.id));
    
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// Create new product
app.post(API_PREFIX + '/products', requireAuth, (req, res) => {
    const db = readDatabase();
    const newProduct = {
        id: Date.now(),
        name: req.body.name,
        description: req.body.description,
        price: parseFloat(req.body.price),
        category: req.body.category,
        image: req.body.image || 'https://via.placeholder.com/280x200?text=No+Image',
        weight: req.body.weight || '',
        promo: req.body.promo || null,
        translations: req.body.translations || null,
        // Bundle/Combo fields
        isCombo: req.body.isCombo || false,
        comboType: req.body.comboType || null,
        comboProducts: req.body.comboProducts || null,
        specialLabel: req.body.specialLabel || null
    };
    
    db.products.push(newProduct);
    
    if (writeDatabase(db)) {
        res.status(201).json(newProduct);
    } else {
        res.status(500).json({ error: 'Failed to save product' });
    }
});

// Update product
app.put(API_PREFIX + '/products/:id', requireAuth, (req, res) => {
    const db = readDatabase();
    const index = db.products.findIndex(p => p.id === parseInt(req.params.id));
    
    if (index !== -1) {
        db.products[index] = {
            id: parseInt(req.params.id),
            name: req.body.name,
            description: req.body.description,
            price: parseFloat(req.body.price),
            category: req.body.category,
            image: req.body.image || db.products[index].image,
            weight: req.body.weight || '',
            promo: req.body.promo || null,
            translations: req.body.translations || null,
            // Bundle/Combo fields
            isCombo: req.body.isCombo || false,
            comboType: req.body.comboType || null,
            comboProducts: req.body.comboProducts || null,
            specialLabel: req.body.specialLabel || null
        };
        
        if (writeDatabase(db)) {
            res.json(db.products[index]);
        } else {
            res.status(500).json({ error: 'Failed to update product' });
        }
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// Batch delete products (MUST be before single delete to avoid route conflict)
app.delete(API_PREFIX + '/products/batch', requireAuth, (req, res) => {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty ids array' });
    }
    
    const db = readDatabase();
    const idsToDelete = ids.map(id => parseInt(id));
    const deleted = [];
    
    db.products = db.products.filter(p => {
        if (idsToDelete.includes(p.id)) {
            deleted.push(p);
            return false;
        }
        return true;
    });
    
    if (writeDatabase(db)) {
        res.json({ message: 'Products deleted', count: deleted.length, deleted });
    } else {
        res.status(500).json({ error: 'Failed to delete products' });
    }
});

// Delete single product
app.delete(API_PREFIX + '/products/:id', requireAuth, (req, res) => {
    const db = readDatabase();
    const index = db.products.findIndex(p => p.id === parseInt(req.params.id));
    
    if (index !== -1) {
        const deletedProduct = db.products.splice(index, 1);
        
        if (writeDatabase(db)) {
            res.json({ message: 'Product deleted', product: deletedProduct[0] });
        } else {
            res.status(500).json({ error: 'Failed to delete product' });
        }
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// Upload image
app.post(API_PREFIX + '/upload', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const imageUrl = `${BASE_PATH}/uploads/${req.file.filename}`;
    res.json({ imageUrl: imageUrl });
});

// Get restaurant settings (name and logo)
app.get(API_PREFIX + '/settings', (req, res) => {
    const db = readDatabase();
    res.json({ 
        name: db.restaurantName,
        logo: db.restaurantLogo || ''
    });
});

// Get restaurant name (backward compatibility)
app.get(API_PREFIX + '/settings/name', (req, res) => {
    const db = readDatabase();
    res.json({ name: db.restaurantName });
});

// Update restaurant settings (name and logo)
app.put(API_PREFIX + '/settings', requireAuth, (req, res) => {
    const db = readDatabase();
    if (req.body.name !== undefined) {
        db.restaurantName = req.body.name;
    }
    if (req.body.logo !== undefined) {
        db.restaurantLogo = req.body.logo;
    }
    
    if (writeDatabase(db)) {
        res.json({ 
            name: db.restaurantName,
            logo: db.restaurantLogo || ''
        });
    } else {
        res.status(500).json({ error: 'Failed to update restaurant settings' });
    }
});

// Update restaurant name (backward compatibility)
app.put(API_PREFIX + '/settings/name', requireAuth, (req, res) => {
    const db = readDatabase();
    db.restaurantName = req.body.name;
    
    if (writeDatabase(db)) {
        res.json({ name: db.restaurantName });
    } else {
        res.status(500).json({ error: 'Failed to update restaurant name' });
    }
});

// Get customization settings
app.get(API_PREFIX + '/settings/customization', (req, res) => {
    const db = readDatabase();
    res.json(db.customization || {
        topBarColor: '#2c3e50',
        backgroundColor: '#f5f5f5',
        backgroundImage: '',
        highlightColor: '#e74c3c',
        priceColor: '#e74c3c'
    });
});

// Update customization settings
app.put(API_PREFIX + '/settings/customization', requireAuth, (req, res) => {
    const db = readDatabase();
    db.customization = req.body;
    
    if (writeDatabase(db)) {
        res.json(db.customization);
    } else {
        res.status(500).json({ error: 'Failed to update customization' });
    }
});

// Get currency settings
app.get(API_PREFIX + '/settings/currency', (req, res) => {
    const db = readDatabase();
    res.json(db.currencySettings || {
        eurToBgnRate: 1.9558,
        showBgnPrices: true
    });
});

// Update currency settings
app.put(API_PREFIX + '/settings/currency', requireAuth, (req, res) => {
    const db = readDatabase();
    db.currencySettings = {
        eurToBgnRate: parseFloat(req.body.eurToBgnRate) || 1.9558,
        showBgnPrices: req.body.showBgnPrices !== undefined ? req.body.showBgnPrices : true
    };
    
    if (writeDatabase(db)) {
        res.json(db.currencySettings);
    } else {
        res.status(500).json({ error: 'Failed to update currency settings' });
    }
});

// Get delivery settings
app.get(API_PREFIX + '/settings/delivery', (req, res) => {
    const db = readDatabase();
    res.json(db.deliverySettings || {
        deliveryEnabled: true,
        freeDeliveryEnabled: false,
        freeDeliveryAmount: 50,
        deliveryFee: 5,
        cityPrices: {
            'Пловдив': 5,
            'София': 5,
            'Варна': 5,
            'Бургас': 5,
            'Русе': 5,
            'Стара Загора': 5,
            'Плевен': 5,
            'Сливен': 5
        }
    });
});

// Update delivery settings
app.put(API_PREFIX + '/settings/delivery', requireAuth, (req, res) => {
    const db = readDatabase();
    db.deliverySettings = req.body;
    
    if (writeDatabase(db)) {
        res.json(db.deliverySettings);
    } else {
        res.status(500).json({ error: 'Failed to update delivery settings' });
    }
});

// Get order settings
app.get(API_PREFIX + '/settings/order', (req, res) => {
    const db = readDatabase();
    res.json(db.orderSettings || {
        minimumOrderAmount: 0
    });
});

// Update order settings
app.put(API_PREFIX + '/settings/order', requireAuth, (req, res) => {
    const db = readDatabase();
    db.orderSettings = {
        minimumOrderAmount: parseFloat(req.body.minimumOrderAmount) || 0
    };
    
    if (writeDatabase(db)) {
        res.json(db.orderSettings);
    } else {
        res.status(500).json({ error: 'Failed to update order settings' });
    }
});

// Get working hours
app.get(API_PREFIX + '/settings/working-hours', (req, res) => {
    const db = readDatabase();
    res.json(db.workingHours || {
        openingTime: '09:00',
        closingTime: '22:00'
    });
});

// Update working hours
app.put(API_PREFIX + '/settings/working-hours', requireAuth, (req, res) => {
    const db = readDatabase();
    db.workingHours = {
        openingTime: req.body.openingTime || '09:00',
        closingTime: req.body.closingTime || '22:00'
    };
    
    if (writeDatabase(db)) {
        res.json(db.workingHours);
    } else {
        res.status(500).json({ error: 'Failed to update working hours' });
    }
});

// Get delivery zones
app.get(API_PREFIX + '/delivery-zones', (req, res) => {
    const db = readDatabase();
    res.json(db.deliveryZones || []);
});

// Update delivery zones
app.put(API_PREFIX + '/delivery-zones', requireAuth, (req, res) => {
    const db = readDatabase();
    db.deliveryZones = req.body.zones || [];
    
    if (writeDatabase(db)) {
        res.json({ message: 'Delivery zones updated successfully', zones: db.deliveryZones });
    } else {
        res.status(500).json({ error: 'Failed to update delivery zones' });
    }
});

// Calculate delivery fee based on coordinates
app.post(API_PREFIX + '/delivery-zones/calculate-fee', (req, res) => {
    const { lat, lng } = req.body;
    const db = readDatabase();
    const zones = db.deliveryZones || [];
    
    // Find which zone contains the point
    for (const zone of zones) {
        if (isPointInPolygon([lat, lng], zone.coordinates)) {
            return res.json({
                inZone: true,
                zoneName: zone.name,
                deliveryFee: zone.price
            });
        }
    }
    
    // Not in any zone
    res.json({
        inZone: false,
        message: 'Address is outside delivery zones'
    });
});

// Helper function: Point in polygon check (Ray casting algorithm)
function isPointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        
        const intersect = ((yi > y) !== (yj > y)) && 
                         (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

// Get slideshow settings and slides
app.get(API_PREFIX + '/slideshow', (req, res) => {
    const db = readDatabase();
    res.json({
        enabled: db.slideshowEnabled || false,
        autoPlayInterval: db.slideshowInterval || 5000,
        slides: db.slides || []
    });
});

// Update slideshow settings
app.put(API_PREFIX + '/slideshow', requireAuth, (req, res) => {
    const db = readDatabase();
    
    if (typeof req.body.enabled !== 'undefined') {
        db.slideshowEnabled = req.body.enabled;
    }
    if (typeof req.body.autoPlayInterval !== 'undefined') {
        db.slideshowInterval = req.body.autoPlayInterval;
    }
    if (Array.isArray(req.body.slides)) {
        // Limit to 10 slides maximum
        db.slides = req.body.slides.slice(0, 10);
    }
    
    if (writeDatabase(db)) {
        res.json({ 
            message: 'Slideshow settings updated successfully',
            enabled: db.slideshowEnabled,
            autoPlayInterval: db.slideshowInterval,
            slides: db.slides 
        });
    } else {
        res.status(500).json({ error: 'Failed to update slideshow settings' });
    }
});

// Import data
app.post(API_PREFIX + '/import', requireAuth, (req, res) => {
    const data = req.body;
    
    if (data.products && Array.isArray(data.products)) {
        if (writeDatabase(data)) {
            res.json({ message: 'Data imported successfully' });
        } else {
            res.status(500).json({ error: 'Failed to import data' });
        }
    } else {
        res.status(400).json({ error: 'Invalid data format' });
    }
});

// Export data
app.get(API_PREFIX + '/export', requireAuth, (req, res) => {
    const db = readDatabase();
    res.json(db);
});

// Reset database
app.post(API_PREFIX + '/reset', requireAuth, (req, res) => {
    const initialData = {
        restaurantName: "Restaurant Name",
        products: [],
        promoCodes: []
    };
    
    if (writeDatabase(initialData)) {
        res.json({ message: 'Database reset successfully' });
    } else {
        res.status(500).json({ error: 'Failed to reset database' });
    }
});

// ==================== PROMO CODE ROUTES ====================

// Get all promo codes
app.get(API_PREFIX + '/promo-codes', requireAuth, (req, res) => {
    const db = readDatabase();
    res.json(db.promoCodes || []);
});

// Apply promo to batch of products
app.put(API_PREFIX + '/products/promo/batch', requireAuth, (req, res) => {
    const { ids, discount } = req.body || {};
    if (!Array.isArray(ids) || !discount || discount <= 0 || discount >= 100) {
        return res.status(400).json({ error: 'ids (array) and discount (1-99) required' });
    }
    const db = readDatabase();
    let updated = 0;
    db.products = (db.products || []).map(p => {
        if (ids.includes(p.id)) {
            const originalPrice = p.price;
            const promoPrice = originalPrice * (1 - discount / 100);
            p.promo = {
                isActive: true,
                enabled: true,
                price: Math.round(promoPrice * 100) / 100, // Round to 2 decimals
                type: 'permanent'
            };
            updated++;
        }
        return p;
    });
    writeDatabase(db);
    res.json({ success: true, updated });
});

// Apply promo to all products in a category
app.put(API_PREFIX + '/products/promo/category/:category', requireAuth, (req, res) => {
    const category = req.params.category;
    const { discount } = req.body || {};
    if (!category || !discount || discount <= 0 || discount >= 100) {
        return res.status(400).json({ error: 'category and discount (1-99) required' });
    }
    const db = readDatabase();
    let updated = 0;
    db.products = (db.products || []).map(p => {
        if ((p.category || '').toLowerCase() === category.toLowerCase()) {
            const originalPrice = p.price;
            const promoPrice = originalPrice * (1 - discount / 100);
            p.promo = {
                isActive: true,
                enabled: true,
                price: Math.round(promoPrice * 100) / 100, // Round to 2 decimals
                type: 'permanent'
            };
            updated++;
        }
        return p;
    });
    writeDatabase(db);
    res.json({ success: true, updated, category });
});

// Validate promo code (public route for customers)
app.post(API_PREFIX + '/promo-codes/validate', (req, res) => {
    const db = readDatabase();
    const { code, category } = req.body;
    
    const promoCode = (db.promoCodes || []).find(pc => 
        pc.code.toLowerCase() === code.toLowerCase() && 
        pc.isActive &&
        (pc.category === 'all' || pc.category === category)
    );
    
    if (promoCode) {
        res.json({
            valid: true,
            discount: promoCode.discount,
            category: promoCode.category
        });
    } else {
        res.json({ valid: false });
    }
});

// Create promo code
app.post(API_PREFIX + '/promo-codes', requireAuth, (req, res) => {
    const db = readDatabase();
    const newPromoCode = {
        id: Date.now(),
        code: req.body.code.toUpperCase(),
        category: req.body.category,
        discount: parseFloat(req.body.discount),
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        createdAt: new Date().toISOString()
    };
    
    // Check if code already exists
    const existingCode = (db.promoCodes || []).find(pc => 
        pc.code.toLowerCase() === newPromoCode.code.toLowerCase()
    );
    
    if (existingCode) {
        return res.status(400).json({ error: 'Promo code already exists' });
    }
    
    if (!db.promoCodes) {
        db.promoCodes = [];
    }
    
    db.promoCodes.push(newPromoCode);
    
    if (writeDatabase(db)) {
        res.status(201).json(newPromoCode);
    } else {
        res.status(500).json({ error: 'Failed to save promo code' });
    }
});

// Update promo code
app.put(API_PREFIX + '/promo-codes/:id', requireAuth, (req, res) => {
    const db = readDatabase();
    const index = (db.promoCodes || []).findIndex(pc => pc.id === parseInt(req.params.id));
    
    if (index !== -1) {
        db.promoCodes[index] = {
            id: parseInt(req.params.id),
            code: req.body.code.toUpperCase(),
            category: req.body.category,
            discount: parseFloat(req.body.discount),
            isActive: req.body.isActive,
            createdAt: db.promoCodes[index].createdAt,
            updatedAt: new Date().toISOString()
        };
        
        if (writeDatabase(db)) {
            res.json(db.promoCodes[index]);
        } else {
            res.status(500).json({ error: 'Failed to update promo code' });
        }
    } else {
        res.status(404).json({ error: 'Promo code not found' });
    }
});

// Delete promo code
app.delete(API_PREFIX + '/promo-codes/:id', requireAuth, (req, res) => {
    const db = readDatabase();
    const index = (db.promoCodes || []).findIndex(pc => pc.id === parseInt(req.params.id));
    
    if (index !== -1) {
        const deletedPromoCode = db.promoCodes.splice(index, 1);
        
        if (writeDatabase(db)) {
            res.json({ message: 'Promo code deleted', promoCode: deletedPromoCode[0] });
        } else {
            res.status(500).json({ error: 'Failed to delete promo code' });
        }
    } else {
        res.status(404).json({ error: 'Promo code not found' });
    }
});

// ==================== CATEGORY MANAGEMENT ====================

// Get all categories with product counts
app.get(API_PREFIX + '/categories', requireAuth, (req, res) => {
    const db = readDatabase();
    const categoryMap = new Map();
    
    // Build category map with EN/BG names and counts
    db.products.forEach(product => {
        const enName = product.category || 'Uncategorized';
        const bgName = product.translations?.bg?.category || enName;
        
        if (!categoryMap.has(enName)) {
            categoryMap.set(enName, { en: enName, bg: bgName, count: 0 });
        }
        categoryMap.get(enName).count++;
    });
    
    const categories = Array.from(categoryMap.values());
    res.json(categories);
});

// Update category (rename EN and/or BG)
app.put(API_PREFIX + '/categories/:oldName', requireAuth, (req, res) => {
    const oldName = decodeURIComponent(req.params.oldName);
    const { en, bg } = req.body;
    
    if (!en) {
        return res.status(400).json({ error: 'English name required' });
    }
    
    const db = readDatabase();
    let updated = 0;
    
    db.products = db.products.map(p => {
        if (p.category === oldName) {
            p.category = en;
            if (bg && p.translations && p.translations.bg) {
                p.translations.bg.category = bg;
            } else if (bg) {
                if (!p.translations) p.translations = {};
                if (!p.translations.bg) p.translations.bg = {};
                p.translations.bg.category = bg;
            }
            updated++;
        }
        return p;
    });
    
    if (writeDatabase(db)) {
        res.json({ success: true, updated, oldName, newName: en });
    } else {
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category (reassign products to a new category)
app.delete(API_PREFIX + '/categories/:name', requireAuth, (req, res) => {
    const categoryName = decodeURIComponent(req.params.name);
    const { reassignTo } = req.body;
    
    if (!reassignTo) {
        return res.status(400).json({ error: 'reassignTo category required' });
    }
    
    const db = readDatabase();
    let updated = 0;
    
    db.products = db.products.map(p => {
        if (p.category === categoryName) {
            p.category = reassignTo;
            // Keep BG translation or set to reassignTo
            if (p.translations && p.translations.bg) {
                p.translations.bg.category = reassignTo;
            }
            updated++;
        }
        return p;
    });
    
    if (writeDatabase(db)) {
        res.json({ success: true, deleted: categoryName, reassignedTo: reassignTo, updated });
    } else {
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Bulk assign products to category
app.put(API_PREFIX + '/products/category/bulk-assign', requireAuth, (req, res) => {
    const { ids, category, categoryBg } = req.body;
    
    if (!Array.isArray(ids) || !category) {
        return res.status(400).json({ error: 'ids array and category required' });
    }
    
    const db = readDatabase();
    let updated = 0;
    
    db.products = db.products.map(p => {
        if (ids.includes(p.id)) {
            p.category = category;
            if (categoryBg) {
                if (!p.translations) p.translations = {};
                if (!p.translations.bg) p.translations.bg = {};
                p.translations.bg.category = categoryBg;
            }
            updated++;
        }
        return p;
    });
    
    if (writeDatabase(db)) {
        res.json({ success: true, updated });
    } else {
        res.status(500).json({ error: 'Failed to bulk assign category' });
    }
});

// ==================== ORDERS API ====================

// Get all orders (admin only)
app.get(API_PREFIX + '/orders', requireAuth, (req, res) => {
    try {
        const data = readDatabase();
        const orders = data.orders || [];
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve orders' });
    }
});

// Get pending orders (admin only)
app.get(API_PREFIX + '/orders/pending', requireAuth, (req, res) => {
    try {
        const data = readDatabase();
        const orders = data.orders || [];
        const pendingOrders = orders.filter(order => order.status === 'pending');
        res.json(pendingOrders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve pending orders' });
    }
});

// Create new order (public endpoint)
app.post(API_PREFIX + '/orders', (req, res) => {
    try {
        const { items, promoCode, discount, total, deliveryMethod, customerInfo, timestamp } = req.body;
        
        if (!items || !items.length || !customerInfo || !deliveryMethod) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const data = readDatabase();
        if (!data.orders) {
            data.orders = [];
        }

        const newOrder = {
            id: data.orders.length > 0 ? Math.max(...data.orders.map(o => o.id)) + 1 : 1,
            items,
            promoCode,
            discount: discount || 0,
            total,
            deliveryMethod,
            customerInfo,
            timestamp: timestamp || new Date().toISOString(),
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        data.orders.push(newOrder);
        writeDatabase(data);

        res.status(201).json(newOrder);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Update order status (admin only)
app.put(API_PREFIX + '/orders/:id', requireAuth, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { status, ownerDiscount } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const data = readDatabase();
        if (!data.orders) {
            return res.status(404).json({ error: 'No orders found' });
        }

        const orderIndex = data.orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = data.orders[orderIndex];
        
        // Apply owner discount if provided and status is confirmed
        if (status === 'confirmed' && ownerDiscount && ownerDiscount > 0) {
            const discountAmount = (order.total * ownerDiscount) / 100;
            order.ownerDiscount = ownerDiscount;
            order.ownerDiscountAmount = discountAmount;
            order.finalTotal = order.total - discountAmount;
        } else {
            order.finalTotal = order.total;
        }
        
        order.status = status;
        order.updatedAt = new Date().toISOString();

        // Ако статусът е confirmed и е за доставка - изпращаме към delivery service и принтираме
        if (status === 'confirmed') {
            console.log('Order confirmed, processing delivery and printing...');
            
            // Изпращане към delivery service (ако е за доставка)
            if (order.deliveryMethod === 'delivery') {
                const deliveryResult = await sendToDeliveryService(order);
                
                if (deliveryResult.success) {
                    console.log('Order sent to delivery service:', deliveryResult.deliveryId);
                    order.deliveryServiceId = deliveryResult.deliveryId;
                    order.deliveryClientId = deliveryResult.clientId;
                } else {
                    console.error('Failed to send to delivery service:', deliveryResult.error);
                    // Не спираме процеса, само логваме грешката
                }
            }
            
            // Принтиране на поръчката
            printOrder(order).then(printResult => {
                if (printResult.success) {
                    console.log('Order printed successfully on printer:', printResult.printer);
                } else {
                    console.error('Failed to print order:', printResult.error);
                }
            }).catch(err => {
                console.error('Printer error:', err);
            });
        }

        writeDatabase(data);
        res.json(order);
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Delete order (admin only)
app.delete(API_PREFIX + '/orders/:id', requireAuth, (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const data = readDatabase();

        if (!data.orders) {
            return res.status(404).json({ error: 'No orders found' });
        }

        const orderIndex = data.orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Order not found' });
        }

        data.orders.splice(orderIndex, 1);
        writeDatabase(data);

        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// ==================== PRINTER & DELIVERY ENDPOINTS ====================

// Test printer connection (admin only)
app.get(API_PREFIX + '/printer/test', requireAuth, async (req, res) => {
    try {
        const { testPrinter, findNetworkPrinters } = require('./printer-service');
        
        // Намиране на принтери
        const printers = await findNetworkPrinters();
        
        if (printers.length === 0) {
            return res.json({ 
                success: false, 
                error: 'No printers found on network',
                printers: []
            });
        }

        // Тестване на първия принтер
        const testResult = await testPrinter(printers[0].ip);
        
        res.json({
            success: testResult,
            printers: printers,
            tested: printers[0].ip
        });
    } catch (error) {
        console.error('Error testing printer:', error);
        res.status(500).json({ error: 'Failed to test printer', details: error.message });
    }
});

// Find printers on network (admin only)
app.get(API_PREFIX + '/printer/find', requireAuth, async (req, res) => {
    try {
        const { findNetworkPrinters } = require('./printer-service');
        const printers = await findNetworkPrinters();
        
        res.json({
            success: true,
            printers: printers,
            count: printers.length
        });
    } catch (error) {
        console.error('Error finding printers:', error);
        res.status(500).json({ error: 'Failed to find printers', details: error.message });
    }
});

// Print specific order (admin only)
app.post(API_PREFIX + '/printer/print/:orderId', requireAuth, async (req, res) => {
    try {
        const orderId = parseInt(req.params.orderId);
        const { printerIp } = req.body;

        const data = readDatabase();
        const order = data.orders?.find(o => o.id === orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const { printOrder } = require('./printer-service');
        const result = await printOrder(order, printerIp);

        res.json(result);
    } catch (error) {
        console.error('Error printing order:', error);
        res.status(500).json({ error: 'Failed to print order', details: error.message });
    }
});

// Check delivery service status (admin only)
app.get(API_PREFIX + '/delivery/status/:deliveryId', requireAuth, async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const { checkDeliveryStatus } = require('./delivery-integration');
        
        const result = await checkDeliveryStatus(deliveryId);
        res.json(result);
    } catch (error) {
        console.error('Error checking delivery status:', error);
        res.status(500).json({ error: 'Failed to check delivery status', details: error.message });
    }
});

// ==================== FRONTEND ROUTES ====================

// Serve frontend HTML under BASE_PATH
const INDEX_PATH = path.join(__dirname, 'public', 'index.html');
const ADMIN_PATH = path.join(__dirname, 'public', 'admin.html');
const LOGIN_PATH = path.join(__dirname, 'public', 'login.html');

if (BASE_PATH) {
    // Normalize: allow access without trailing slash
    app.get(BASE_PATH, (req, res) => res.redirect(BASE_PATH + '/'));
}

app.get(BASE_PATH + '/', (req, res) => {
    res.sendFile(INDEX_PATH);
});

app.get(BASE_PATH + '/admin', (req, res) => {
    res.sendFile(ADMIN_PATH);
});

app.get(BASE_PATH + '/login', (req, res) => {
    res.sendFile(LOGIN_PATH);
});

app.get(BASE_PATH + '/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('==================================================');
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log(`📁 Database file: ${DB_FILE}`);
    console.log(`🔧 BASE_PATH: '${BASE_PATH || '/'}'`);
    console.log(`🌐 Index URL: http://localhost:${PORT}${BASE_PATH}/`);
    console.log(`�️ Admin URL: http://localhost:${PORT}${BASE_PATH}/admin`);
    console.log(`� Login URL: http://localhost:${PORT}${BASE_PATH}/login`);
    console.log('==================================================');
});
