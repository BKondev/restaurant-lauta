const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendToDeliveryService } = require('./delivery-integration');
const { printOrder } = require('./printer-service');

let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    // Optional dependency; emails will be disabled if not installed.
}

const app = express();
const PORT = process.env.PORT || 3003;
// Base path for mounting the app (e.g. '/resturant-website'). Empty string means root.
const BASE_PATH = process.env.BASE_PATH || '/resturant-website';

// Multi-tenant authentication system
// Each restaurant has its own credentials and API key
// In production: use environment variables, hash passwords with bcrypt, use proper JWT tokens

// Token storage: Map of token -> { restaurantId, username, expiresAt }
const activeTokens = new Map();

// Generate simple token
function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Helper function to get restaurant by credentials
function getRestaurantByCredentials(username, password) {
    console.log('[GET RESTAURANT] Called with username:', username);
    const db = readDatabase();
    console.log('[GET RESTAURANT] After readDatabase, db type:', typeof db);
    console.log('[GET RESTAURANT] Restaurants in database:', db.restaurants ? db.restaurants.length : 'NONE');
    if (db.restaurants) {
        console.log('[GET RESTAURANT] First restaurant:', JSON.stringify(db.restaurants[0]));
    }
    const found = db.restaurants?.find(r => r.username === username && r.password === password);
    console.log('[GET RESTAURANT] Found:', found ? found.name : 'NOT FOUND');
    return found;
}

// Helper function to get restaurant by API key
function getRestaurantByApiKey(apiKey) {
    const db = readDatabase();
    return db.restaurants?.find(r => r.apiKey === apiKey);
}

// Helper function to get restaurant from auth token
function getRestaurantFromToken(token) {
    const tokenData = activeTokens.get(token);
    if (!tokenData) return null;
    
    // Check if token expired
    if (tokenData.expiresAt < Date.now()) {
        activeTokens.delete(token);
        return null;
    }
    
    const db = readDatabase();
    return db.restaurants?.find(r => r.id === tokenData.restaurantId);
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
            restaurantLogo: "",
            slideshowEnabled: false,
            slideshowInterval: 5000,
            customization: {
                topBarColor: "#2c3e50",
                backgroundColor: "#f5f5f5",
                backgroundImage: "",
                highlightColor: "#3498db",
                priceColor: "#e74c3c"
            },
            restaurants: [
                {
                    id: "rest_bojole_001",
                    name: "BOJOLE",
                    username: "bojole_admin",
                    password: "bojole123", // In production: hash with bcrypt
                    apiKey: "bojole_api_key_12345",
                    address: "София, бул. Витоша 100",
                    phone: "+359888123456",
                    email: "contact@bojole.bg",
                    orderNotificationEmail: "contact@bojole.bg",
                    active: true,
                    createdAt: new Date().toISOString()
                }
            ],
            products: [],
            orders: [],
            promoCodes: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    }
}

// Read database
function readDatabase() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        console.log('[READ DB] Keys in database:', Object.keys(parsed));
        console.log('[READ DB] Has restaurants?', parsed.restaurants ? `YES (${parsed.restaurants.length})` : 'NO');
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
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
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

// Login endpoint - multi-tenant support
app.post(API_PREFIX + '/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('[LOGIN] Attempt for username:', username);
    
    const restaurant = getRestaurantByCredentials(username, password);
    
    console.log('[LOGIN] Found restaurant:', restaurant ? restaurant.name : 'NOT FOUND');
    
    if (restaurant && restaurant.active) {
        const token = generateToken();
        
        // Store token with restaurant info and expiration (24 hours)
        activeTokens.set(token, {
            restaurantId: restaurant.id,
            username: restaurant.username,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000)
        });
        
        res.json({
            success: true,
            token: token,
            restaurant: {
                id: restaurant.id,
                name: restaurant.name,
                username: restaurant.username
            },
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

// Current restaurant profile (admin only)
app.get(API_PREFIX + '/restaurants/me', requireAuth, (req, res) => {
    try {
        const db = readDatabase();
        const restaurant = db.restaurants?.find(r => r.id === req.restaurantId);
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        res.json({
            id: restaurant.id,
            name: restaurant.name,
            email: restaurant.email || '',
            orderNotificationEmail: restaurant.orderNotificationEmail || ''
        });
    } catch (e) {
        console.error('Error loading restaurant profile:', e);
        res.status(500).json({ error: 'Failed to load restaurant profile' });
    }
});

app.put(API_PREFIX + '/restaurants/me', requireAuth, (req, res) => {
    try {
        const { orderNotificationEmail } = req.body;
        const db = readDatabase();

        const idx = db.restaurants?.findIndex(r => r.id === req.restaurantId);
        if (idx === -1 || idx === undefined) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        if (orderNotificationEmail !== undefined) {
            const email = (orderNotificationEmail || '').toString().trim();
            if (email && !isValidEmail(email)) {
                return res.status(400).json({ error: 'Invalid notification email' });
            }
            db.restaurants[idx].orderNotificationEmail = email;
        }

        if (writeDatabase(db)) {
            res.json({
                id: db.restaurants[idx].id,
                name: db.restaurants[idx].name,
                email: db.restaurants[idx].email || '',
                orderNotificationEmail: db.restaurants[idx].orderNotificationEmail || ''
            });
        } else {
            res.status(500).json({ error: 'Failed to update restaurant profile' });
        }
    } catch (e) {
        console.error('Error updating restaurant profile:', e);
        res.status(500).json({ error: 'Failed to update restaurant profile' });
    }
});

// Middleware to check authentication for protected routes (web admin)
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token || !activeTokens.has(token)) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please login to access this resource'
        });
    }
    
    // Attach restaurant info to request
    const tokenData = activeTokens.get(token);
    req.restaurantId = tokenData.restaurantId;
    req.username = tokenData.username;
    
    next();
}

// Middleware to check API key authentication (for mobile app)
function requireApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key required'
        });
    }
    
    const restaurant = getRestaurantByApiKey(apiKey);
    
    if (!restaurant || !restaurant.active) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key'
        });
    }
    
    // Attach restaurant info to request
    req.restaurantId = restaurant.id;
    req.restaurantName = restaurant.name;
    
    next();
}

// ==================== EMAIL (SMTP) ====================

let mailTransport = null;

function isEmailEnabled() {
    return !!(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}

function getMailTransport() {
    if (!isEmailEnabled()) return null;
    if (mailTransport) return mailTransport;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = (process.env.SMTP_SECURE || '').toString().toLowerCase() === 'true';

    mailTransport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    return mailTransport;
}

async function sendEmail({ to, subject, text, html, replyTo }) {
    const transport = getMailTransport();
    if (!transport) {
        console.log('[EMAIL] Disabled or missing SMTP config; skipping email to:', to);
        return { skipped: true };
    }

    if (!to || !isValidEmail(to)) {
        console.log('[EMAIL] Invalid recipient; skipping email to:', to);
        return { skipped: true };
    }

    const from = process.env.SMTP_FROM;
    const finalReplyTo = replyTo || process.env.SMTP_REPLY_TO || undefined;

    try {
        const info = await transport.sendMail({
            from,
            to,
            subject,
            text,
            html,
            ...(finalReplyTo ? { replyTo: finalReplyTo } : {})
        });
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error('[EMAIL] sendMail failed:', err);
        return { success: false, error: err.message };
    }
}

function getRestaurantNotificationEmail(restaurant) {
    const email = (restaurant?.orderNotificationEmail || restaurant?.email || '').toString().trim();
    return isValidEmail(email) ? email : '';
}

function formatOrderItemsText(order) {
    return (order.items || [])
        .map(it => `- ${it.name} x${it.quantity} = ${(parseNumber(it.price, 0) * parseNumber(it.quantity, 0)).toFixed(2)} лв`)
        .join('\n');
}

function getPublicOrderTrackUrl(orderId) {
    const base = (process.env.PUBLIC_BASE_URL || '').toString().trim().replace(/\/$/, '');
    if (!base) return '';
    return `${base}${BASE_PATH}/track-order.html?id=${encodeURIComponent(orderId)}`;
}

async function sendOrderPlacedEmails(order, restaurant) {
    const trackUrl = getPublicOrderTrackUrl(order.id);
    const restaurantTo = getRestaurantNotificationEmail(restaurant);
    const customerTo = (order.customerInfo?.email || '').toString().trim();

    const subjectRestaurant = `New order ${order.id} (${order.deliveryMethod})`;
    const subjectCustomer = `Поръчката е получена: ${order.id}`;

    const itemsText = formatOrderItemsText(order);
    const totalText = `Обща сума: ${parseNumber(order.total, 0).toFixed(2)} лв`;
    const deliveryText = order.deliveryMethod === 'delivery'
        ? `Доставка до: ${order.customerInfo?.city || ''}, ${order.customerInfo?.address || ''}`
        : 'Взимане от място';

    const customerText = [
        'Благодарим Ви за поръчката!',
        `Номер: ${order.id}`,
        deliveryText,
        itemsText,
        totalText,
        trackUrl ? `Проследяване: ${trackUrl}` : ''
    ].filter(Boolean).join('\n');

    const restaurantText = [
        `New order received: ${order.id}`,
        `Customer: ${order.customerInfo?.name || ''} / ${order.customerInfo?.phone || ''} / ${order.customerInfo?.email || ''}`,
        deliveryText,
        itemsText,
        totalText
    ].filter(Boolean).join('\n');

    // Customer email
    await sendEmail({
        to: customerTo,
        subject: subjectCustomer,
        text: customerText
    });

    // Restaurant notification email
    if (restaurantTo) {
        await sendEmail({
            to: restaurantTo,
            subject: subjectRestaurant,
            text: restaurantText,
            replyTo: customerTo
        });
    }
}

async function sendOrderApprovedEmail(order) {
    const customerTo = (order.customerInfo?.email || '').toString().trim();
    const trackUrl = getPublicOrderTrackUrl(order.id);
    const subject = `Поръчката е одобрена: ${order.id}`;

    const text = [
        `Поръчката Ви ${order.id} е одобрена.`,
        order.deliveryMethod === 'delivery' ? 'Очаквайте доставка скоро.' : 'Поръчката ще бъде готова за взимане.',
        trackUrl ? `Проследяване: ${trackUrl}` : ''
    ].filter(Boolean).join('\n');

    await sendEmail({ to: customerTo, subject, text });
}

async function sendOrderStatusEmail(order, status) {
    const normalized = normalizeOrderStatus(status);
    const customerTo = (order.customerInfo?.email || '').toString().trim();
    const trackUrl = getPublicOrderTrackUrl(order.id);

    let subject = `Update for order: ${order.id}`;
    let firstLine = `Статус на поръчката ${order.id} е обновен.`;

    if (normalized === 'delivering') {
        subject = `Поръчката е за доставка: ${order.id}`;
        firstLine = `Поръчката Ви ${order.id} е за доставка.`;
    } else if (normalized === 'ready_for_pickup') {
        subject = `Поръчката е готова за взимане: ${order.id}`;
        firstLine = `Поръчката Ви ${order.id} е готова за взимане.`;
    } else if (normalized === 'completed') {
        subject = `Поръчката е завършена: ${order.id}`;
        firstLine = `Поръчката Ви ${order.id} е завършена.`;
    } else if (normalized === 'cancelled') {
        subject = `Поръчката е отказана: ${order.id}`;
        firstLine = `Поръчката Ви ${order.id} е отказана.`;
    } else if (normalized === 'approved') {
        return sendOrderApprovedEmail(order);
    }

    const text = [
        firstLine,
        trackUrl ? `Проследяване: ${trackUrl}` : ''
    ].filter(Boolean).join('\n');

    await sendEmail({ to: customerTo, subject, text });
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

function normalizeOrderStatus(rawStatus) {
    const s = (rawStatus || '').toString().trim().toLowerCase();
    if (s === 'confirmed') return 'approved';
    if (s === 'done') return 'completed';
    if (s === 'picked_up') return 'completed';
    if (s === 'delivered') return 'completed';
    return s;
}

function isAllowedOrderStatus(status) {
    return [
        'pending',
        'approved',
        'delivering',
        'ready_for_pickup',
        'completed',
        'cancelled'
    ].includes(status);
}

function parseNumber(value, fallback = 0) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function isValidEmail(email) {
    const e = (email || '').toString().trim();
    return !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function sanitizeOrderItems(items) {
    if (!Array.isArray(items)) return null;
    const sanitized = items
        .map(it => {
            const name = (it?.name || '').toString().trim();
            const quantity = Math.max(0, Math.floor(parseNumber(it?.quantity, 0)));
            const price = Math.max(0, parseNumber(it?.price, 0));
            const id = it?.id;
            const weight = it?.weight;
            const image = it?.image;
            return {
                ...(id !== undefined ? { id } : {}),
                name,
                price,
                quantity,
                ...(weight !== undefined ? { weight } : {}),
                ...(image !== undefined ? { image } : {})
            };
        })
        .filter(it => it.name && it.quantity > 0);

    if (sanitized.length === 0) return null;
    return sanitized;
}

function recomputeOrderTotals(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce((sum, it) => sum + (parseNumber(it.price, 0) * parseNumber(it.quantity, 0)), 0);
    const discountPercent = Math.max(0, Math.min(100, parseNumber(order.discount, 0)));
    const discountAmount = subtotal * (discountPercent / 100);
    const deliveryFee = Math.max(0, parseNumber(order.deliveryFee, 0));
    const total = Math.max(0, subtotal - discountAmount + deliveryFee);

    order.subtotal = subtotal;
    order.discount = discountPercent;
    order.discountAmount = discountAmount;
    order.deliveryFee = deliveryFee;
    order.total = total;

    const ownerDiscount = Math.max(0, Math.min(100, parseNumber(order.ownerDiscount, 0)));
    if (ownerDiscount > 0 && order.status === 'approved') {
        const ownerDiscountAmount = (total * ownerDiscount) / 100;
        order.ownerDiscount = ownerDiscount;
        order.ownerDiscountAmount = ownerDiscountAmount;
        order.finalTotal = Math.max(0, total - ownerDiscountAmount);
    } else {
        order.ownerDiscountAmount = 0;
        order.finalTotal = total;
    }
}

// Get all orders (admin only - filtered by restaurant)
app.get(API_PREFIX + '/orders', requireAuth, (req, res) => {
    try {
        const data = readDatabase();
        const orders = data.orders || [];
        
        // Filter orders by restaurant
        const restaurantOrders = orders.filter(order => order.restaurantId === req.restaurantId);
        
        res.json(restaurantOrders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve orders' });
    }
});

// Get pending orders (admin only - filtered by restaurant)
app.get(API_PREFIX + '/orders/pending', requireAuth, (req, res) => {
    try {
        const data = readDatabase();
        const orders = data.orders || [];
        
        // Filter by restaurant and pending status
        const pendingOrders = orders.filter(order => 
            order.restaurantId === req.restaurantId && order.status === 'pending'
        );
        res.json(pendingOrders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve pending orders' });
    }
});

// Get pending orders for mobile app (API key auth - filtered by restaurant)
app.get(API_PREFIX + '/orders/mobile/pending', requireApiKey, (req, res) => {
    try {
        const data = readDatabase();
        const orders = data.orders || [];
        
        // Filter by restaurant and pending status
        const pendingOrders = orders.filter(order => 
            order.restaurantId === req.restaurantId && order.status === 'pending'
        );
        
        res.json(pendingOrders);
    } catch (error) {
        console.error('Error retrieving mobile pending orders:', error);
        res.status(500).json({ error: 'Failed to retrieve pending orders' });
    }
});

// Update order from mobile app (API key auth - filtered by restaurant)
app.put(API_PREFIX + '/orders/mobile/:id', requireApiKey, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status, estimatedTime, callMadeAt, approvedAt } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const normalizedStatus = normalizeOrderStatus(status);
        if (!isAllowedOrderStatus(normalizedStatus)) {
            return res.status(400).json({ error: 'Invalid status value' });
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
        
        // Verify order belongs to this restaurant
        if (order.restaurantId !== req.restaurantId) {
            return res.status(403).json({ error: 'Access denied - order belongs to different restaurant' });
        }
        
        // Update status and timestamps
        const previousStatus = order.status;
        order.status = normalizedStatus;
        order.updatedAt = new Date().toISOString();

        if (estimatedTime) order.estimatedTime = estimatedTime;
        if (callMadeAt) order.callMadeAt = callMadeAt;
        if (approvedAt) order.approvedAt = approvedAt;

        // Handle approval actions (print, delivery service)
        if (normalizedStatus === 'approved' && previousStatus !== 'approved') {
            console.log(`Order ${orderId} approved by mobile app (Restaurant: ${req.restaurantName})`);
            
            if (order.deliveryMethod === 'delivery') {
                console.log('Delivery order - printing receipt...');
                
                printOrder(order).then(printResult => {
                    if (printResult.success) {
                        console.log('Order printed successfully to:', printResult.printer);
                    } else {
                        console.error('Printing failed:', printResult.error);
                    }
                }).catch(err => {
                    console.error('Printing error:', err);
                });

                try {
                    const deliveryResult = await sendToDeliveryService(order);
                    if (deliveryResult.success) {
                        order.deliveryServiceId = deliveryResult.deliveryId;
                        console.log('Order sent to delivery service:', deliveryResult.deliveryId);
                    }
                } catch (err) {
                    console.error('Delivery service error:', err);
                }
            } else {
                console.log('Pickup order - no printing needed');
            }

            // Email customer on approval (non-blocking)
            setImmediate(() => {
                try {
                    sendOrderStatusEmail(order, 'approved')
                        .then(() => console.log('[EMAIL] order approved email attempted:', order.id))
                        .catch(err => console.error('[EMAIL] order approved email failed:', err));
                } catch (e) {
                    console.error('[EMAIL] order approved email error:', e);
                }
            });
        }

        // Email customer on other status transitions (non-blocking)
        if (normalizedStatus !== previousStatus && ['delivering', 'ready_for_pickup', 'completed', 'cancelled'].includes(normalizedStatus)) {
            setImmediate(() => {
                try {
                    sendOrderStatusEmail(order, normalizedStatus)
                        .then(() => console.log('[EMAIL] order status email attempted:', order.id, normalizedStatus))
                        .catch(err => console.error('[EMAIL] order status email failed:', err));
                } catch (e) {
                    console.error('[EMAIL] order status email error:', e);
                }
            });
        }

        data.orders[orderIndex] = order;
        writeDatabase(data);

        res.json({ success: true, message: 'Order updated successfully', order });
    } catch (error) {
        console.error('Error updating order from mobile:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Track order by ID (public endpoint - no auth required)
app.get(API_PREFIX + '/orders/track/:id', (req, res) => {
    try {
        const orderId = req.params.id;
        const data = readDatabase();
        const orders = data.orders || [];
        
        const order = orders.find(o => o.id === orderId);
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if tracking has expired (2 hours)
        const now = new Date();
        const expiryTime = new Date(order.trackingExpiry);
        
        if (now > expiryTime) {
            return res.status(410).json({ 
                error: 'Order tracking has expired',
                message: 'Order tracking is only available for 2 hours after order creation'
            });
        }

        // Return limited order info (hide sensitive data)
        const publicOrderInfo = {
            id: order.id,
            status: order.status,
            total: order.total,
            deliveryMethod: order.deliveryMethod,
            estimatedTime: order.estimatedTime || 60,
            createdAt: order.createdAt,
            trackingExpiry: order.trackingExpiry,
            customerInfo: order.deliveryMethod === 'delivery' ? {
                city: order.customerInfo?.city,
                address: order.customerInfo?.address
            } : null
        };

        res.json({ success: true, order: publicOrderInfo });
    } catch (error) {
        console.error('Error tracking order:', error);
        res.status(500).json({ error: 'Failed to track order' });
    }
});

// Create new order (public endpoint - requires restaurantId in body or header)
app.post(API_PREFIX + '/orders', (req, res) => {
    try {
        const {
            items,
            promoCode,
            discount,
            total,
            deliveryMethod,
            deliveryType,
            deliveryFee,
            customerInfo,
            timestamp,
            restaurantId
        } = req.body;
        
        // Get restaurant ID from body or X-Restaurant-Id header.
        // In single-restaurant deployments we allow a safe fallback.
        let targetRestaurantId = restaurantId || req.headers['x-restaurant-id'];
        
        if (!items || !items.length || !customerInfo || !deliveryMethod) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Email is required for ordering; validate early.
        const customerEmail = (customerInfo.email || '').toString().trim();
        const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
        if (!customerEmail || !emailLooksValid) {
            return res.status(400).json({ error: 'Valid customer email is required' });
        }

        const data = readDatabase();
        if (!data.orders) {
            data.orders = [];
        }

        // Single-restaurant fallback for restaurantId
        if (!targetRestaurantId) {
            const activeRestaurants = (data.restaurants || []).filter(r => r && r.active);
            if (activeRestaurants.length === 1) {
                targetRestaurantId = activeRestaurants[0].id;
            } else {
                return res.status(400).json({ error: 'Restaurant ID required' });
            }
        }
        
        // Verify restaurant exists and is active
        const restaurant = data.restaurants?.find(r => r.id === targetRestaurantId && r.active);
        if (!restaurant) {
            return res.status(400).json({ error: 'Invalid restaurant ID' });
        }

        // Count previous orders from this phone number FOR THIS RESTAURANT ONLY
        const previousOrders = data.orders.filter(
            o => o.restaurantId === targetRestaurantId && 
                 o.customerInfo && 
                 o.customerInfo.phone === customerInfo.phone
        ).length;

        const createdAt = new Date();
        const trackingExpiry = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

        const newOrder = {
            id: 'order_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            restaurantId: targetRestaurantId,
            restaurantName: restaurant.name,
            items,
            promoCode,
            discount: discount || 0,
            total,
            // Keep existing field for backward compatibility across UI surfaces
            deliveryMethod,
            // Normalized field for future flows
            deliveryType: deliveryType || deliveryMethod,
            deliveryFee: typeof deliveryFee === 'number' ? deliveryFee : (deliveryFee ? Number(deliveryFee) : 0),
            customerInfo: {
                ...customerInfo,
                previousOrders: previousOrders
            },
            timestamp: timestamp || createdAt.toISOString(),
            status: 'pending',
            createdAt: createdAt.toISOString(),
            trackingExpiry: trackingExpiry.toISOString()
        };

        data.orders.push(newOrder);
        writeDatabase(data);

        // Fire-and-forget emails (don't block checkout)
        setImmediate(() => {
            try {
                sendOrderPlacedEmails(newOrder, restaurant)
                    .then(() => console.log('[EMAIL] order placed emails attempted:', newOrder.id))
                    .catch(err => console.error('[EMAIL] order placed emails failed:', err));
            } catch (e) {
                console.error('[EMAIL] order placed emails error:', e);
            }
        });

        res.status(201).json({ 
            success: true, 
            message: 'Order placed successfully',
            order: newOrder 
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Update order status (admin only - filtered by restaurant)
app.put(API_PREFIX + '/orders/:id', requireAuth, async (req, res) => {
    try {
        const orderId = req.params.id; // Keep as string now
        const {
            status,
            ownerDiscount,
            estimatedTime,
            callMadeAt,
            approvedAt,
            deliveryMethod,
            deliveryType,
            deliveryFee,
            discount,
            promoCode,
            customerInfo,
            items
        } = req.body;

        const hasStatusUpdate = status !== undefined && status !== null && `${status}`.trim() !== '';
        const normalizedStatus = hasStatusUpdate ? normalizeOrderStatus(status) : null;
        if (hasStatusUpdate && !isAllowedOrderStatus(normalizedStatus)) {
            return res.status(400).json({ error: 'Invalid status value' });
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
        
        // Verify order belongs to this restaurant
        if (order.restaurantId !== req.restaurantId) {
            return res.status(403).json({ error: 'Access denied - order belongs to different restaurant' });
        }
        
        // Update basic status
        const previousStatus = order.status;
        if (hasStatusUpdate) {
            order.status = normalizedStatus;
        }
        order.updatedAt = new Date().toISOString();

        // Apply editable fields (full editing)
        if (deliveryMethod !== undefined || deliveryType !== undefined) {
            const method = (deliveryMethod || deliveryType || order.deliveryMethod || order.deliveryType || '').toString();
            if (!['delivery', 'pickup'].includes(method)) {
                return res.status(400).json({ error: 'Invalid delivery method' });
            }
            order.deliveryMethod = method;
            order.deliveryType = method;
        }

        if (promoCode !== undefined) {
            order.promoCode = promoCode ? String(promoCode).trim() : null;
        }

        if (discount !== undefined) {
            order.discount = Math.max(0, Math.min(100, parseNumber(discount, 0)));
        }

        if (deliveryFee !== undefined) {
            order.deliveryFee = Math.max(0, parseNumber(deliveryFee, 0));
        }

        if (items !== undefined) {
            const sanitizedItems = sanitizeOrderItems(items);
            if (!sanitizedItems) {
                return res.status(400).json({ error: 'Order must have at least one valid item' });
            }
            order.items = sanitizedItems;
        }

        if (customerInfo !== undefined) {
            const merged = {
                ...(order.customerInfo || {}),
                ...(customerInfo || {})
            };

            // Preserve previousOrders if client doesn't send it
            if (order.customerInfo && order.customerInfo.previousOrders !== undefined && merged.previousOrders === undefined) {
                merged.previousOrders = order.customerInfo.previousOrders;
            }

            order.customerInfo = merged;
        }

        // Validate final customer email (required)
        if (!isValidEmail(order.customerInfo?.email)) {
            return res.status(400).json({ error: 'Valid customer email is required' });
        }

        // Validate delivery fields for delivery orders
        if ((order.deliveryMethod || order.deliveryType) === 'delivery') {
            const city = (order.customerInfo?.city || '').toString().trim();
            const address = (order.customerInfo?.address || '').toString().trim();
            if (!city || !address) {
                return res.status(400).json({ error: 'City and address are required for delivery orders' });
            }
        }

        // Save estimated time if provided
        if (estimatedTime) {
            order.estimatedTime = estimatedTime;
        }

        // Save call timestamp if provided
        if (callMadeAt) {
            order.callMadeAt = callMadeAt;
        }

        // Save approval timestamp if provided
        if (approvedAt) {
            order.approvedAt = approvedAt;
        }

        // Set milestone timestamps when status changes
        if (hasStatusUpdate && normalizedStatus !== previousStatus) {
            const nowIso = new Date().toISOString();
            if (normalizedStatus === 'approved' && !order.approvedAt) order.approvedAt = nowIso;
            if (normalizedStatus === 'delivering' && !order.deliveringAt) order.deliveringAt = nowIso;
            if (normalizedStatus === 'ready_for_pickup' && !order.readyAt) order.readyAt = nowIso;
            if (normalizedStatus === 'completed' && !order.completedAt) order.completedAt = nowIso;
            if (normalizedStatus === 'cancelled' && !order.cancelledAt) order.cancelledAt = nowIso;
        }

        // Owner discount can be set on approval (or via edits)
        if (ownerDiscount !== undefined) {
            order.ownerDiscount = Math.max(0, Math.min(100, parseNumber(ownerDiscount, 0)));
        }

        // Always recompute totals after any edits
        recomputeOrderTotals(order);

        // Ако статусът е 'approved'
        if (hasStatusUpdate && normalizedStatus === 'approved' && previousStatus !== 'approved') {
            console.log('Order approved, processing...');
            
            // Принтиране САМО ако е за доставка
            if (order.deliveryMethod === 'delivery') {
                console.log('Delivery order - printing receipt...');
                printOrder(order)
                    .then(printResult => {
                        if (printResult.success) {
                            console.log('Order printed successfully to:', printResult.printer);
                        } else {
                            console.error('Failed to print order:', printResult.error);
                        }
                    })
                    .catch(err => {
                        console.error('Print error:', err);
                    });

                // Изпращане към delivery service
                const deliveryResult = await sendToDeliveryService(order);
                
                if (deliveryResult.success) {
                    console.log('Order sent to delivery service:', deliveryResult.deliveryId);
                    order.deliveryServiceId = deliveryResult.deliveryId;
                    order.deliveryClientId = deliveryResult.clientId;
                } else {
                    console.error('Failed to send to delivery service:', deliveryResult.error);
                    // Не спираме процеса, само логваме грешката
                }
            } else {
                console.log('Pickup order - no printing needed');
            }

            // Email customer on approval (non-blocking)
            setImmediate(() => {
                try {
                    sendOrderStatusEmail(order, 'approved')
                        .then(() => console.log('[EMAIL] order approved email attempted:', order.id))
                        .catch(err => console.error('[EMAIL] order approved email failed:', err));
                } catch (e) {
                    console.error('[EMAIL] order approved email error:', e);
                }
            });
        }

        // Email customer on other status transitions (non-blocking)
        if (hasStatusUpdate && normalizedStatus !== previousStatus && ['delivering', 'ready_for_pickup', 'completed', 'cancelled'].includes(normalizedStatus)) {
            setImmediate(() => {
                try {
                    sendOrderStatusEmail(order, normalizedStatus)
                        .then(() => console.log('[EMAIL] order status email attempted:', order.id, normalizedStatus))
                        .catch(err => console.error('[EMAIL] order status email failed:', err));
                } catch (e) {
                    console.error('[EMAIL] order status email error:', e);
                }
            });
        }
        
        // Legacy compatibility: treat 'confirmed' as 'approved' (handled above via normalization)

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
        const orderId = req.params.id;
        const data = readDatabase();

        if (!data.orders) {
            return res.status(404).json({ error: 'No orders found' });
        }

        const orderIndex = data.orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Verify order belongs to this restaurant
        if (data.orders[orderIndex].restaurantId !== req.restaurantId) {
            return res.status(403).json({ error: 'Access denied - order belongs to different restaurant' });
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
        const orderId = req.params.orderId;
        const { printerIp } = req.body;

        const data = readDatabase();
        const order = data.orders?.find(o => o.id === orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Verify order belongs to this restaurant
        if (order.restaurantId !== req.restaurantId) {
            return res.status(403).json({ error: 'Access denied - order belongs to different restaurant' });
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
