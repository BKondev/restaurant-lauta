const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { sendToDeliveryService } = require('./delivery-integration');
const { printOrder } = require('./printer-service');

// Optional: load environment variables from .env (useful for production without PM2 env wiring)
try {
    require('dotenv').config();
} catch (e) {
    // dotenv is optional
}

let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    // Optional dependency; emails will be disabled if not installed.
}

const app = express();
const PORT = process.env.PORT || 3003;
// Base path for mounting the app (e.g. '/resturant-website'). Empty string means root.
const BASE_PATH = (process.env.BASE_PATH ?? '/resturant-website');

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

// Vendor static assets (keeps the UI working without external CDNs; helps E2E tests)
const fontawesomeDir = path.join(__dirname, 'node_modules', '@fortawesome', 'fontawesome-free');
if (fs.existsSync(fontawesomeDir)) {
    const mount = (BASE_PATH ? BASE_PATH : '') + '/vendor/fontawesome';
    app.use(mount, express.static(fontawesomeDir));
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
// Allows tests to run against an isolated DB file without touching production/local data.
const DB_FILE = process.env.DB_FILE_PATH
    ? path.resolve(process.env.DB_FILE_PATH)
    : path.join(__dirname, 'database.json');

// Initialize database if it doesn't exist
function initDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        // Ensure DB directory exists (needed for test DB paths like .tmp/database.test.json)
        try {
            fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
        } catch (e) {
            // ignore; writeFileSync will surface errors if it still fails
        }
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
                    borica: {
                        enabled: false,
                        debugMode: true,
                        terminalId: "",
                        privateKeyPem: "",
                        publicCertPem: ""
                    },
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
        try {
            fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
        } catch (e) {
            // ignore
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

function padLeft(value, length, char = '0') {
    let str = String(value ?? '');
    while (str.length < length) str = char + str;
    return str;
}

function padRight(value, length, char = ' ') {
    let str = String(value ?? '');
    while (str.length < length) str = str + char;
    return str;
}

function getDateYMDHS() {
    const d = new Date();
    const yyyy = d.getFullYear().toString();
    const MM = padLeft(d.getMonth() + 1, 2);
    const dd = padLeft(d.getDate(), 2);
    const hh = padLeft(d.getHours(), 2);
    const mm = padLeft(d.getMinutes(), 2);
    const ss = padLeft(d.getSeconds(), 2);
    return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
}

function generateBoricaProviderOrderId() {
    // BORICA orderId field is 15 chars; keep numeric-only for broad compatibility.
    const ts = String(Date.now()); // 13 digits
    const rnd = padLeft(Math.floor(Math.random() * 100), 2); // 2 digits
    return `${ts}${rnd}`.slice(0, 15);
}

function boricaGetGatewayBaseUrl(boricaOrDebugMode) {
    const ensureSlash = (url) => {
        const u = (url || '').toString().trim();
        if (!u) return u;
        return u.endsWith('/') ? u : (u + '/');
    };

    if (boricaOrDebugMode && typeof boricaOrDebugMode === 'object') {
        const b = boricaOrDebugMode;
        const modeRaw = (b.mode || '').toString().trim().toLowerCase();
        const isTest = modeRaw
            ? (modeRaw === 'test' || modeRaw === 'sandbox')
            : !!b.debugMode;

        const override = isTest ? b.gatewayBaseUrlTest : b.gatewayBaseUrlProd;
        if (override) return ensureSlash(override);

        return isTest ? 'https://gatet.borica.bg/boreps/' : 'https://gate.borica.bg/boreps/';
    }

    const debugMode = !!boricaOrDebugMode;
    return debugMode ? 'https://gatet.borica.bg/boreps/' : 'https://gate.borica.bg/boreps/';
}

function boricaInferIntegrationType(borica) {
    const preferred = (borica?.integration || borica?.integrationType || '').toString().trim().toLowerCase();
    if (preferred === 'cgi_link' || preferred === 'cgi' || preferred === 'cgi-link') return 'cgi_link';
    if (preferred === 'eborica' || preferred === 'e_borica') return 'eBorica';

    const urls = [borica?.gatewayBaseUrlTest, borica?.gatewayBaseUrlProd]
        .map(v => (v || '').toString().trim())
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    if (urls.includes('boreps') || urls.includes('registertransaction')) return 'eBorica';
    if (urls.includes('cgi_link') || urls.includes('cgi-bin') || urls.includes('3dsgate')) return 'cgi_link';

    // Merchant ID is required for CGI_LINK and typically unused for eBorica.
    if ((borica?.merchantId || '').toString().trim()) return 'cgi_link';

    return 'eBorica';
}

function boricaGetCgiLinkGatewayUrl(borica) {
    const b = borica && typeof borica === 'object' ? borica : {};
    const modeRaw = (b.mode || '').toString().trim().toLowerCase();
    const isTest = modeRaw
        ? (modeRaw === 'test' || modeRaw === 'sandbox')
        : !!b.debugMode;

    const override = (isTest ? b.gatewayBaseUrlTest : b.gatewayBaseUrlProd) || '';
    const u = override.toString().trim();
    if (u) {
        if (/cgi_link/i.test(u)) return u;
        if (/cgi-bin\/?$/i.test(u)) return u.replace(/\/?$/, '/') + 'cgi_link';
        if (u.endsWith('/')) return u + 'cgi_link';
        return u;
    }

    return isTest
        ? 'https://3dsgate-dev.borica.bg/cgi-bin/cgi_link'
        : 'https://3dsgate.borica.bg/cgi-bin/cgi_link';
}

function boricaPart(value) {
    if (value === null || value === undefined) return '-';
    const s = String(value);
    if (!s) return '-';
    return `${s.length}${s}`;
}

function boricaGetUtcTimestampYmdHis(date = new Date()) {
    const yyyy = String(date.getUTCFullYear());
    const MM = padLeft(date.getUTCMonth() + 1, 2);
    const dd = padLeft(date.getUTCDate(), 2);
    const hh = padLeft(date.getUTCHours(), 2);
    const mm = padLeft(date.getUTCMinutes(), 2);
    const ss = padLeft(date.getUTCSeconds(), 2);
    return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
}

function boricaMakeNonceHexUpper(byteLen = 16) {
    return crypto.randomBytes(byteLen).toString('hex').toUpperCase();
}

function getIanaTimeZoneOffsetMinutes(date, timeZone) {
    try {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const parts = dtf.formatToParts(date);
        const map = {};
        for (const p of parts) {
            if (p.type !== 'literal') map[p.type] = p.value;
        }
        const asUtc = Date.UTC(
            Number(map.year),
            Number(map.month) - 1,
            Number(map.day),
            Number(map.hour),
            Number(map.minute),
            Number(map.second)
        );
        return Math.round((asUtc - date.getTime()) / 60000);
    } catch (e) {
        return null;
    }
}

function formatOffsetMinutesToGmtString(offsetMinutes) {
    if (!Number.isFinite(offsetMinutes)) return '+00:00';
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const hh = padLeft(Math.floor(abs / 60), 2);
    const mm = padLeft(abs % 60, 2);
    return `${sign}${hh}:${mm}`;
}

function boricaGetMerchGmtEuropeSofia(date = new Date()) {
    const offsetMinutes = getIanaTimeZoneOffsetMinutes(date, 'Europe/Sofia');
    if (Number.isFinite(offsetMinutes)) return formatOffsetMinutesToGmtString(offsetMinutes);

    // Fallback to server timezone if Intl/timeZone data is missing.
    const localOffsetMinutes = -date.getTimezoneOffset();
    return formatOffsetMinutesToGmtString(localOffsetMinutes);
}

function boricaSignHexSha256(symbol, privateKeyPem) {
    const sig = crypto.sign('RSA-SHA256', Buffer.from(String(symbol || ''), 'utf8'), privateKeyPem);
    return sig.toString('hex').toUpperCase();
}

function boricaVerifyHexSha256(symbol, signatureHex, publicCertPem) {
    const hex = (signatureHex || '').toString().trim();
    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return false;
    const sig = Buffer.from(hex, 'hex');
    try {
        return crypto.verify('RSA-SHA256', Buffer.from(String(symbol || ''), 'utf8'), publicCertPem, sig);
    } catch (e) {
        return false;
    }
}

function getRequestOrigin(req) {
    const xfProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
    const xfHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
    const proto = xfProto || req.protocol || 'http';
    const host = xfHost || req.get('host');
    return `${proto}://${host}`;
}

function generateBoricaOrder6(existingOrders) {
    const used = new Set(
        (Array.isArray(existingOrders) ? existingOrders : [])
            .map(o => o?.payment?.order6)
            .filter(v => typeof v === 'string' && /^\d{6}$/.test(v))
    );

    for (let i = 0; i < 10; i++) {
        const candidate = padLeft(Math.floor(Math.random() * 1_000_000), 6, '0');
        if (!used.has(candidate)) return candidate;
    }

    // deterministic fallback
    const fallback = padLeft(Date.now() % 1_000_000, 6, '0');
    if (!used.has(fallback)) return fallback;
    return padLeft(Math.floor(Math.random() * 1_000_000), 6, '0');
}

function boricaBuildRegisterTransactionMessage({
    amountBGN,
    terminalId,
    providerOrderId,
    orderDescription,
    language = 'BG',
    protocolVersion = '1.1'
}) {
    const messageType = '10';
    const timestamp = getDateYMDHS();

    const amountCents = Math.round(Number(amountBGN) * 100);
    const amountField = padLeft(Number.isFinite(amountCents) ? amountCents : 0, 12, '0');

    const terminalField = padLeft(String(terminalId ?? '').trim(), 8, '0');
    const orderIdField = padRight(String(providerOrderId ?? '').trim(), 15, ' ');
    const descField = padRight(String(orderDescription ?? ''), 125, ' ');
    const langField = padRight(String(language ?? 'BG').toUpperCase().slice(0, 2), 2, ' ');
    const protocolField = padRight(String(protocolVersion ?? '1.1').slice(0, 3), 3, ' ');

    return `${messageType}${timestamp}${amountField}${terminalField}${orderIdField}${descField}${langField}${protocolField}`;
}

function boricaSignMessageToEBoricaBase64(message, privateKeyPem, algorithm = 'RSA-SHA1') {
    const dataBuffer = Buffer.from(message, 'utf8');
    const sign = crypto.createSign(algorithm);
    sign.update(dataBuffer);
    sign.end();
    const signature = sign.sign(privateKeyPem);
    return Buffer.concat([dataBuffer, signature]).toString('base64');
}

function boricaVerifyAndParseEBorica(eBoricaBase64, publicCertPem, algorithms = ['RSA-SHA1', 'RSA-SHA256']) {
    const signedBuffer = Buffer.from(String(eBoricaBase64 || ''), 'base64');
    if (!signedBuffer || signedBuffer.length < 60) {
        return { ok: false, error: 'Invalid eBorica payload' };
    }

    let sigLen = 128;
    try {
        const publicKey = crypto.createPublicKey(publicCertPem);
        const modulusBits = publicKey.asymmetricKeyDetails?.modulusLength;
        if (modulusBits && Number.isFinite(modulusBits)) {
            sigLen = Math.floor(modulusBits / 8);
        }
    } catch (e) {
        // fallback to default
    }

    if (signedBuffer.length <= sigLen) {
        return { ok: false, error: 'eBorica payload too short' };
    }

    const dataBuffer = signedBuffer.slice(0, signedBuffer.length - sigLen);
    const signatureBuffer = signedBuffer.slice(signedBuffer.length - sigLen);

    let ok = false;
    let usedAlg = '';
    for (const alg of (Array.isArray(algorithms) ? algorithms : ['RSA-SHA1'])) {
        try {
            const verify = crypto.createVerify(alg);
            verify.update(dataBuffer);
            verify.end();
            if (verify.verify(publicCertPem, signatureBuffer)) {
                ok = true;
                usedAlg = alg;
                break;
            }
        } catch (e) {
            // try next
        }
    }

    const text = dataBuffer.toString('utf8');
    const transactionCode = text.substring(0, 2);
    const transactionTime = text.substring(2, 16);
    const amountField = text.substring(16, 28);
    const terminalId = text.substring(28, 36);
    const orderIdField = text.substring(36, 51);
    const responseCode = text.substring(51, 53);
    const protocolVersion = text.substring(53, 56);

    const amountCents = Number.parseInt(String(amountField || '').trim(), 10);
    const amountBGN = Number.isFinite(amountCents) ? amountCents / 100 : null;
    const providerOrderId = String(orderIdField || '').trim();

    return {
        ok,
        data: {
            transactionCode,
            transactionTime,
            amountBGN,
            terminalId,
            providerOrderId,
            responseCode,
                        protocolVersion,
                        signatureAlg: usedAlg
        }
    };
}

function normalizeText(value, maxLen) {
    const s = (value ?? '').toString();
    const trimmed = s.replace(/\r/g, '').trim();
    if (!maxLen || maxLen <= 0) return trimmed;
    return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function getActiveRestaurantForPublicRequest(db, req) {
    const headerRestaurantId = (req.headers['x-restaurant-id'] || '').toString().trim();
    const queryRestaurantId = (req.query?.restaurantId || '').toString().trim();
    const targetRestaurantId = queryRestaurantId || headerRestaurantId;

    const activeRestaurants = (db.restaurants || []).filter(r => r && r.active);

    if (targetRestaurantId) {
        return activeRestaurants.find(r => r.id === targetRestaurantId) || null;
    }

    if (activeRestaurants.length === 1) return activeRestaurants[0];
    return null;
}

function getDefaultSiteSettings() {
    return {
        search: { mode: 'names_and_descriptions' },
        map: { enabled: false, lat: null, lng: null, zoom: 16, label: '' },
        footer: {
            contacts: { phone: '', email: '', address: '', addressMapsUrl: '' },
            aboutText: '',
            socials: []
        },
        legal: { privacyHtml: '', termsHtml: '' }
    };
}

function normalizeSiteSettings(input) {
    const base = getDefaultSiteSettings();
    const src = input && typeof input === 'object' ? input : {};

    const toFiniteNumberOrNull = (value) => {
        if (value === null || value === undefined) return null;
        const n = typeof value === 'number' ? value : parseFloat(value);
        return Number.isFinite(n) ? n : null;
    };

    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

    const modeRaw = (src.search?.mode || base.search.mode).toString();
    const mode = (modeRaw === 'names_only' || modeRaw === 'names_and_descriptions') ? modeRaw : base.search.mode;

    const mapSrc = src.map && typeof src.map === 'object' ? src.map : {};
    const mapEnabledRequested = !!mapSrc.enabled;
    const mapLat = toFiniteNumberOrNull(mapSrc.lat);
    const mapLng = toFiniteNumberOrNull(mapSrc.lng);
    const mapZoomRaw = toFiniteNumberOrNull(mapSrc.zoom);
    const mapZoom = mapZoomRaw === null ? base.map.zoom : clamp(Math.round(mapZoomRaw), 1, 19);
    const mapLabel = normalizeText(mapSrc.label, 140);

    const hasCoords = mapLat !== null && mapLng !== null;

    const map = {
        enabled: mapEnabledRequested && hasCoords,
        // Preserve coordinates even when disabled so admins don't lose them.
        lat: mapLat !== null ? clamp(mapLat, -90, 90) : null,
        lng: mapLng !== null ? clamp(mapLng, -180, 180) : null,
        zoom: mapZoom,
        label: mapLabel
    };

    const contacts = src.footer?.contacts || {};
    const footer = {
        contacts: {
            phone: normalizeText(contacts.phone, 100),
            email: normalizeText(contacts.email, 120),
            address: normalizeText(contacts.address, 240),
            addressMapsUrl: normalizeText(contacts.addressMapsUrl, 500)
        },
        aboutText: normalizeText(src.footer?.aboutText, 600),
        socials: Array.isArray(src.footer?.socials)
            ? src.footer.socials.slice(0, 6).map(s => ({
                label: normalizeText(s?.label, 40),
                url: normalizeText(s?.url, 300),
                iconClass: normalizeText(s?.iconClass, 60)
            })).filter(s => s.url)
            : []
    };

    const legal = {
        privacyHtml: normalizeText(src.legal?.privacyHtml, 20000),
        termsHtml: normalizeText(src.legal?.termsHtml, 20000)
    };

    return { search: { mode }, map, footer, legal };
}

function isOrderForRestaurant(order, restaurantId, db) {
    if (!order) return false;
    if (order.restaurantId) return order.restaurantId === restaurantId;
    const activeRestaurants = (db.restaurants || []).filter(r => r && r.active);
    return activeRestaurants.length === 1 && activeRestaurants[0].id === restaurantId;
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

        const orderPlacedTpl = restaurant.emailTemplates?.orderPlaced || {};

        res.json({
            id: restaurant.id,
            name: restaurant.name,
            email: restaurant.email || '',
            orderNotificationEmail: restaurant.orderNotificationEmail || '',
            emailTemplates: {
                orderPlaced: {
                    subject: (orderPlacedTpl.subject || '').toString(),
                    body: (orderPlacedTpl.body || '').toString()
                }
            },
            borica: {
                enabled: !!restaurant.borica?.enabled,
                mode: (restaurant.borica?.mode || (restaurant.borica?.debugMode ? 'test' : 'prod') || 'test').toString(),
                debugMode: restaurant.borica?.debugMode !== undefined ? !!restaurant.borica.debugMode : true,
                integration: (restaurant.borica?.integration || restaurant.borica?.integrationType || '').toString(),
                currency: (restaurant.borica?.currency || '').toString(),
                terminalId: (restaurant.borica?.terminalId || '').toString(),
                merchantId: (restaurant.borica?.merchantId || '').toString(),
                merchName: (restaurant.borica?.merchName || '').toString(),
                merchUrl: (restaurant.borica?.merchUrl || '').toString(),
                backrefUrl: (restaurant.borica?.backrefUrl || '').toString(),
                gatewayBaseUrlTest: (restaurant.borica?.gatewayBaseUrlTest || '').toString(),
                gatewayBaseUrlProd: (restaurant.borica?.gatewayBaseUrlProd || '').toString(),
                privateKeyPem: (restaurant.borica?.privateKeyPem || '').toString(),
                publicCertPem: (restaurant.borica?.publicCertPem || '').toString()
            }
        });
    } catch (e) {
        console.error('Error loading restaurant profile:', e);
        res.status(500).json({ error: 'Failed to load restaurant profile' });
    }
});

app.put(API_PREFIX + '/restaurants/me', requireAuth, (req, res) => {
    try {
        const { orderNotificationEmail, borica, emailTemplates } = req.body;
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

        if (borica !== undefined) {
            const enabled = !!borica.enabled;
            const modeRaw = (borica.mode || '').toString().trim().toLowerCase();
            const mode = (modeRaw === 'prod' || modeRaw === 'production') ? 'prod' : 'test';
            const debugMode = borica.debugMode !== undefined ? !!borica.debugMode : (mode === 'test');
            const integration = (borica.integration || borica.integrationType || '').toString().trim();
            const currencyRaw = (borica.currency || '').toString().trim().toUpperCase();
            const currency = (currencyRaw === 'BGN' || currencyRaw === 'EUR') ? currencyRaw : '';
            const terminalId = (borica.terminalId || '').toString().trim();
            const merchantId = (borica.merchantId || '').toString().trim();
            const merchName = (borica.merchName || '').toString().trim();
            const merchUrl = (borica.merchUrl || '').toString().trim();
            const backrefUrl = (borica.backrefUrl || '').toString().trim();
            const gatewayBaseUrlTest = (borica.gatewayBaseUrlTest || '').toString().trim();
            const gatewayBaseUrlProd = (borica.gatewayBaseUrlProd || '').toString().trim();
            const privateKeyPemRaw = (borica.privateKeyPem || '').toString();
            const publicCertPemRaw = (borica.publicCertPem || '').toString();

            const looksLikeHttpsUrl = (u) => /^https?:\/\//i.test((u || '').toString().trim());

            const normalizePemBlock = (value, typeLabel) => {
                const s = (value || '').toString().trim();
                if (!s) return '';

                const upper = s.toUpperCase();
                if (upper.includes('BEGIN') && upper.includes(typeLabel)) {
                    return s.replace(/\r\n/g, '\n').trim();
                }

                // Base64-only (common when copy/pasting from .cer/.key exports)
                const compact = s.replace(/\s+/g, '');
                if (compact.length > 80 && /^[A-Z0-9+/=]+$/i.test(compact)) {
                    const lines = compact.match(/.{1,64}/g) || [compact];
                    return `-----BEGIN ${typeLabel}-----\n${lines.join('\n')}\n-----END ${typeLabel}-----`;
                }

                return s;
            };

            const privateKeyPem = normalizePemBlock(privateKeyPemRaw, 'PRIVATE KEY');
            const publicCertPem = normalizePemBlock(publicCertPemRaw, 'CERTIFICATE');

            if (enabled) {
                if (!/^[A-Za-z0-9]{1,8}$/.test(terminalId)) {
                    return res.status(400).json({ error: 'BORICA Terminal ID must be 1-8 characters (letters/digits)' });
                }
                if (!merchantId) {
                    return res.status(400).json({ error: 'BORICA Merchant ID is required' });
                }
                if (merchUrl && !looksLikeHttpsUrl(merchUrl)) {
                    return res.status(400).json({ error: 'BORICA Merchant URL must start with http:// or https://' });
                }
                if (backrefUrl && !looksLikeHttpsUrl(backrefUrl)) {
                    return res.status(400).json({ error: 'BORICA Backref URL must start with http:// or https://' });
                }
                if (gatewayBaseUrlTest && !looksLikeHttpsUrl(gatewayBaseUrlTest)) {
                    return res.status(400).json({ error: 'BORICA Test Gateway URL must start with http:// or https://' });
                }
                if (gatewayBaseUrlProd && !looksLikeHttpsUrl(gatewayBaseUrlProd)) {
                    return res.status(400).json({ error: 'BORICA Production Gateway URL must start with http:// or https://' });
                }
                const pkUpper = privateKeyPem.toUpperCase();
                if (!pkUpper.includes('BEGIN') || !pkUpper.includes('PRIVATE KEY')) {
                    return res.status(400).json({ error: 'BORICA Private Key PEM looks invalid' });
                }
                const certUpper = publicCertPem.toUpperCase();
                if (!certUpper.includes('BEGIN') || !certUpper.includes('CERTIFICATE')) {
                    return res.status(400).json({ error: 'BORICA Public Certificate PEM looks invalid' });
                }
            }

            db.restaurants[idx].borica = {
                enabled,
                mode,
                debugMode,
                integration,
                currency,
                terminalId,
                merchantId,
                merchName,
                merchUrl,
                backrefUrl,
                gatewayBaseUrlTest,
                gatewayBaseUrlProd,
                privateKeyPem,
                publicCertPem
            };
        }

        if (emailTemplates !== undefined) {
            const orderPlaced = emailTemplates?.orderPlaced || {};
            const subject = normalizeEmailTemplateText(orderPlaced.subject, 500);
            const body = normalizeEmailTemplateText(orderPlaced.body, 8000);

            if (!db.restaurants[idx].emailTemplates) db.restaurants[idx].emailTemplates = {};
            db.restaurants[idx].emailTemplates.orderPlaced = {
                subject,
                body
            };
        }

        if (writeDatabase(db)) {
            const orderPlacedTpl = db.restaurants[idx].emailTemplates?.orderPlaced || {};
            res.json({
                id: db.restaurants[idx].id,
                name: db.restaurants[idx].name,
                email: db.restaurants[idx].email || '',
                orderNotificationEmail: db.restaurants[idx].orderNotificationEmail || '',
                emailTemplates: {
                    orderPlaced: {
                        subject: (orderPlacedTpl.subject || '').toString(),
                        body: (orderPlacedTpl.body || '').toString()
                    }
                },
                borica: {
                    enabled: !!db.restaurants[idx].borica?.enabled,
                    mode: (db.restaurants[idx].borica?.mode || (db.restaurants[idx].borica?.debugMode ? 'test' : 'prod') || 'test').toString(),
                    debugMode: db.restaurants[idx].borica?.debugMode !== undefined ? !!db.restaurants[idx].borica.debugMode : true,
                    integration: (db.restaurants[idx].borica?.integration || db.restaurants[idx].borica?.integrationType || '').toString(),
                    currency: (db.restaurants[idx].borica?.currency || '').toString(),
                    terminalId: (db.restaurants[idx].borica?.terminalId || '').toString(),
                    merchantId: (db.restaurants[idx].borica?.merchantId || '').toString(),
                    merchName: (db.restaurants[idx].borica?.merchName || '').toString(),
                    merchUrl: (db.restaurants[idx].borica?.merchUrl || '').toString(),
                    backrefUrl: (db.restaurants[idx].borica?.backrefUrl || '').toString(),
                    gatewayBaseUrlTest: (db.restaurants[idx].borica?.gatewayBaseUrlTest || '').toString(),
                    gatewayBaseUrlProd: (db.restaurants[idx].borica?.gatewayBaseUrlProd || '').toString(),
                    privateKeyPem: (db.restaurants[idx].borica?.privateKeyPem || '').toString(),
                    publicCertPem: (db.restaurants[idx].borica?.publicCertPem || '').toString()
                }
            });
        } else {
            res.status(500).json({ error: 'Failed to update restaurant profile' });
        }
    } catch (e) {
        console.error('Error updating restaurant profile:', e);
        res.status(500).json({ error: 'Failed to update restaurant profile' });
    }
});

// Public: expose whether card payments are enabled for a restaurant
app.get(API_PREFIX + '/payments/config', (req, res) => {
    try {
        const data = readDatabase();
        const headerRestaurantId = req.headers['x-restaurant-id'];
        let targetRestaurantId = req.query.restaurantId || headerRestaurantId;

        if (!targetRestaurantId) {
            const activeRestaurants = (data.restaurants || []).filter(r => r && r.active);
            if (activeRestaurants.length === 1) {
                targetRestaurantId = activeRestaurants[0].id;
            }
        }

        const restaurant = data.restaurants?.find(r => r.id === targetRestaurantId && r.active);
        const borica = restaurant?.borica;
        const integration = boricaInferIntegrationType(borica);
        const enabled = integration === 'cgi_link'
            ? !!(borica?.enabled && borica?.terminalId && borica?.merchantId && borica?.privateKeyPem && borica?.publicCertPem)
            : !!(borica?.enabled && borica?.terminalId && borica?.privateKeyPem && borica?.publicCertPem);

        res.json({
            cardPayments: {
                enabled,
                provider: enabled ? 'borica' : null
            },
            borica: {
                enabled
            }
        });
    } catch (e) {
        res.json({ cardPayments: { enabled: false, provider: null }, borica: { enabled: false } });
    }
});

// BORICA initiation page (POST to gateway; avoids GET limitations)
app.get(API_PREFIX + '/payments/borica/start', (req, res) => {
        try {
                const orderId = (req.query.orderId || '').toString().trim();
                if (!orderId) return res.status(400).send('Missing orderId');

                const db = readDatabase();
                const order = (db.orders || []).find(o => o?.id === orderId);
                if (!order) return res.status(404).send('Order not found');

                const restaurant = (db.restaurants || []).find(r => r?.id === order.restaurantId);
                if (!restaurant || !restaurant.borica?.enabled) {
                        return res.status(400).send('BORICA not configured');
                }

                const borica = restaurant.borica;
                const integration = boricaInferIntegrationType(borica);

                if (integration === 'cgi_link') {
                        if (!borica.terminalId || !borica.merchantId || !borica.privateKeyPem) {
                                return res.status(400).send('BORICA not configured');
                        }

                        const origin = getRequestOrigin(req);

                        const TRTYPE = '1';
                        const CURRENCY = (order.payment?.currency || borica.currency || 'EUR').toString().trim().toUpperCase();
                        const currency = (CURRENCY === 'BGN' || CURRENCY === 'EUR') ? CURRENCY : 'EUR';
                        const amountNum = parseNumber(order.payment?.amount, parseNumber(order.total, 0));
                        const amount = Number.isFinite(amountNum) ? amountNum : 0;
                        const AMOUNT = amount.toFixed(2);

                        const ORDER = (order.payment?.order6 || '').toString().trim();
                        if (!/^\d{6}$/.test(ORDER)) {
                                return res.status(400).send('Missing BORICA ORDER');
                        }

                        const MERCHANT = (borica.merchantId || '').toString().trim();
                        const TERMINAL = (borica.terminalId || '').toString().trim();
                        const MERCH_NAME = (borica.merchName || req.get('host') || restaurant.name || '').toString().trim();
                        const MERCH_URL = (borica.merchUrl || origin).toString().trim();

                        const EMAIL = (order.customerInfo?.email || restaurant.email || '').toString().trim();
                        const COUNTRY = 'BG';
                        const LANG = 'BG';
                        const MERCH_GMT = boricaGetMerchGmtEuropeSofia(new Date());

                        const TIMESTAMP = boricaGetUtcTimestampYmdHis(new Date());
                        const NONCE = boricaMakeNonceHexUpper(16);
                        const ADDENDUM = 'AD,TD';
                        const AD_CUST_BOR_ORDER_ID = ORDER;
                        const DESC = `${MERCH_NAME}:${order.id}`.slice(0, 50);

                        const configuredBackref = (borica.backrefUrl || '').toString().trim();
                        const backrefBase = configuredBackref || `${origin}${API_PREFIX}/payments/borica/return`;
                        const BACKREF = `${backrefBase}${backrefBase.includes('?') ? '&' : '?'}order_id=${encodeURIComponent(order.id)}&order6=${encodeURIComponent(ORDER)}`;

                        const symbol =
                                boricaPart(TERMINAL) +
                                boricaPart(TRTYPE) +
                                boricaPart(AMOUNT) +
                                boricaPart(currency) +
                                boricaPart(ORDER) +
                                boricaPart(TIMESTAMP) +
                                boricaPart(NONCE) +
                                '-';

                        const P_SIGN = boricaSignHexSha256(symbol, borica.privateKeyPem);
                        const gatewayUrl = boricaGetCgiLinkGatewayUrl(borica);

                        const hidden = (name, value) => `<input type="hidden" name="${String(name).replace(/"/g, '&quot;')}" value="${String(value ?? '').replace(/"/g, '&quot;')}" />`;
                        const html = `<!doctype html>
<html lang="bg">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Пренасочване към BORICA...</title>
    </head>
    <body>
        <form id="boricaForm" method="POST" action="${String(gatewayUrl).replace(/"/g, '&quot;')}">
            ${hidden('TRTYPE', TRTYPE)}
            ${hidden('AMOUNT', AMOUNT)}
            ${hidden('CURRENCY', currency)}
            ${hidden('ORDER', ORDER)}
            ${hidden('MERCHANT', MERCHANT)}
            ${hidden('TERMINAL', TERMINAL)}
            ${hidden('MERCH_NAME', MERCH_NAME)}
            ${hidden('MERCH_URL', MERCH_URL)}
            ${hidden('DESC', DESC)}
            ${hidden('EMAIL', EMAIL)}
            ${hidden('COUNTRY', COUNTRY)}
            ${hidden('LANG', LANG)}
            ${hidden('MERCH_GMT', MERCH_GMT)}
            ${hidden('TIMESTAMP', TIMESTAMP)}
            ${hidden('NONCE', NONCE)}
            ${hidden('ADDENDUM', ADDENDUM)}
            ${hidden('AD.CUST_BOR_ORDER_ID', AD_CUST_BOR_ORDER_ID)}
            ${hidden('P_SIGN', P_SIGN)}
            ${hidden('BACKREF', BACKREF)}
            <noscript>
                <button type="submit">Плати</button>
            </noscript>
        </form>
        <script>try{document.getElementById('boricaForm').submit();}catch(e){}</script>
    </body>
</html>`;

                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        return res.status(200).send(html);
                }

                // Fallback: eBorica flow
                if (!borica.terminalId || !borica.privateKeyPem) {
                        return res.status(400).send('BORICA not configured');
                }

                const eBorica = (order.payment && order.payment.eBorica)
                        ? String(order.payment.eBorica)
                        : null;

                if (!eBorica) {
                        return res.status(400).send('Missing eBorica payload');
                }

                const gateway = boricaGetGatewayBaseUrl(borica);
                const action = `${gateway}registerTransaction`;

                const html = `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Redirecting to payment...</title>
    </head>
    <body>
        <form id="boricaForm" method="POST" action="${action}">
            <input type="hidden" name="eBorica" value="${String(eBorica).replace(/"/g, '&quot;')}" />
        </form>
        <script>try{document.getElementById('boricaForm').submit();}catch(e){}</script>
        <noscript>
            <p>JavaScript is required to continue. Please click:</p>
            <button type="submit" form="boricaForm">Continue to payment</button>
        </noscript>
    </body>
</html>`;

                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.status(200).send(html);
        } catch (e) {
                console.error('BORICA start error:', e);
                return res.status(500).send('Payment initialization error');
        }
});

// BORICA return endpoint (configured in BORICA portal)
function handleBoricaReturn(req, res) {
    try {
        const post = (req.body && typeof req.body === 'object') ? req.body : {};
        const looksLikeCgiReturn = !!(post.P_SIGN || post.RC || post.ACTION || post.ORDER);

        if (looksLikeCgiReturn) {
            const ACTION = (post.ACTION || '').toString();
            const RC = (post.RC || '').toString();
            const APPROVAL = (post.APPROVAL || '').toString();
            const TERMINAL = (post.TERMINAL || '').toString();
            const TRTYPE = (post.TRTYPE || '').toString();
            const AMOUNT = (post.AMOUNT || '').toString();
            const CURRENCY = (post.CURRENCY || '').toString();
            const ORDER = (post.ORDER || '').toString();
            const RRN = (post.RRN || '').toString();
            const INT_REF = (post.INT_REF || '').toString();
            const PARES_STATUS = (post.PARES_STATUS || '').toString();
            const ECI = (post.ECI || '').toString();
            const TIMESTAMP = (post.TIMESTAMP || '').toString();
            const NONCE = (post.NONCE || '').toString();
            const P_SIGN = (post.P_SIGN || '').toString();

            const db = readDatabase();

            let order = null;
            const orderId = (req.query.order_id || req.query.orderId || req.query.order || '').toString().trim();
            if (orderId) {
                order = (db.orders || []).find(o => o?.id === orderId) || null;
            }

            if (!order && ORDER) {
                order = (db.orders || []).find(o =>
                    o?.payment?.provider === 'borica' &&
                    String(o.payment.order6 || '') === String(ORDER || '')
                ) || null;
            }

            const restaurant = order
                ? (db.restaurants || []).find(r => r?.id === order.restaurantId)
                : (db.restaurants || []).find(r => r?.borica?.terminalId && String(r.borica.terminalId) === String(TERMINAL));

            if (!restaurant || !restaurant.borica?.publicCertPem) {
                return res.status(400).send('Unknown terminal / restaurant');
            }

            const symbol =
                boricaPart(ACTION) +
                boricaPart(RC) +
                boricaPart(APPROVAL) +
                boricaPart(TERMINAL) +
                boricaPart(TRTYPE) +
                boricaPart(AMOUNT) +
                boricaPart(CURRENCY) +
                boricaPart(ORDER) +
                boricaPart(RRN) +
                boricaPart(INT_REF) +
                boricaPart(PARES_STATUS) +
                boricaPart(ECI) +
                boricaPart(TIMESTAMP) +
                boricaPart(NONCE) +
                '-';

            const ok = boricaVerifyHexSha256(symbol, P_SIGN, restaurant.borica.publicCertPem);
            if (!ok) {
                console.error('[BORICA] Invalid signature (cgi_link)');
                return res.status(400).send('Invalid BORICA signature');
            }

            if (!order) {
                return res.status(404).send('Order not found');
            }

            // Amount/currency sanity check on success
            if (RC === '00') {
                const paid = parseNumber(AMOUNT, NaN);
                const expected = parseNumber(order.payment?.amount, parseNumber(order.total, NaN));
                const expectedCur = (order.payment?.currency || 'EUR').toString().toUpperCase();
                const cur = (CURRENCY || '').toString().toUpperCase();
                if (expectedCur && cur && expectedCur !== cur) {
                    console.error('[BORICA] Currency mismatch', { expectedCur, cur, orderId: order.id });
                    return res.status(400).send('Currency mismatch');
                }
                if (Number.isFinite(paid) && Number.isFinite(expected) && Math.abs(paid - expected) > 0.02) {
                    console.error('[BORICA] Amount mismatch', { expected, paid, orderId: order.id });
                    return res.status(400).send('Amount mismatch');
                }
            }

            order.payment = order.payment || { method: 'card', provider: 'borica' };
            order.payment.lastResponseCode = RC;
            order.payment.lastResponseAt = new Date().toISOString();
            order.payment.borica = {
                integration: 'cgi_link',
                action: ACTION,
                rc: RC,
                approval: APPROVAL,
                terminal: TERMINAL,
                trtype: TRTYPE,
                amount: AMOUNT,
                currency: CURRENCY,
                order6: ORDER,
                rrn: RRN,
                intRef: INT_REF
            };

            const success = RC === '00';
            if (success) {
                order.payment.status = 'paid';
                order.payment.paidAt = new Date().toISOString();
                if (order.status === 'pending_payment') {
                    order.status = 'pending';
                }

                setImmediate(() => {
                    try {
                        sendOrderPlacedEmails(order, restaurant)
                            .then(() => console.log('[EMAIL] order placed emails attempted (post-payment):', order.id))
                            .catch(err => console.error('[EMAIL] order placed emails failed (post-payment):', err));
                    } catch (e) {
                        console.error('[EMAIL] post-payment emails error:', e);
                    }
                });
            } else {
                const actionLower = ACTION.toString().trim().toLowerCase();
                const cancelled = RC === '17' || actionLower === 'cancel' || actionLower === 'canceled' || actionLower === 'cancelled';
                order.payment.status = cancelled ? 'cancelled' : 'failed';
                if (order.status === 'pending_payment') {
                    order.status = 'cancelled';
                }
            }

            writeDatabase(db);

            const redirectTarget = `${BASE_PATH || ''}/thank-you?order=${encodeURIComponent(order.id)}&status=${success ? 'success' : 'failed'}&code=${encodeURIComponent(RC || '')}`;
            return res.redirect(302, redirectTarget);
        }

        // Fallback: eBorica flow
        const eBorica = (req.query.eBorica || req.query.eborica || req.body?.eBorica || req.body?.eborica);
        if (!eBorica) {
            return res.status(400).send('Missing eBorica');
        }

        const db = readDatabase();

        // Guess terminalId from payload prefix to select correct cert.
        let terminalIdGuess = '';
        try {
            const buf = Buffer.from(String(eBorica), 'base64');
            terminalIdGuess = buf.slice(28, 36).toString('utf8');
        } catch (e) {
            terminalIdGuess = '';
        }

        const restaurant = (db.restaurants || []).find(r => r?.borica?.terminalId === terminalIdGuess);
        if (!restaurant || !restaurant.borica?.publicCertPem) {
            return res.status(400).send('Unknown terminal / restaurant');
        }

        const parsed = boricaVerifyAndParseEBorica(eBorica, restaurant.borica.publicCertPem);
        if (!parsed.ok) {
            console.error('[BORICA] Invalid signature', parsed.error, parsed.data);
            return res.status(400).send('Invalid BORICA signature');
        }

        const providerOrderId = parsed.data?.providerOrderId;
        const responseCode = parsed.data?.responseCode;

        const orderIndex = (db.orders || []).findIndex(o =>
            o?.restaurantId === restaurant.id &&
            o?.payment?.provider === 'borica' &&
            String(o.payment.providerOrderId || '') === String(providerOrderId || '')
        );

        if (orderIndex === -1) {
            return res.status(404).send('Order not found');
        }

        const order = db.orders[orderIndex];
        order.payment = order.payment || { method: 'card', provider: 'borica' };
        order.payment.lastResponseCode = responseCode;
        order.payment.lastResponseAt = new Date().toISOString();

        const success = responseCode === '00';
        if (success) {
            order.payment.status = 'paid';
            order.payment.paidAt = new Date().toISOString();
            if (order.status === 'pending_payment') {
                order.status = 'pending';
            }

            // Send emails now that payment is confirmed
            setImmediate(() => {
                try {
                    sendOrderPlacedEmails(order, restaurant)
                        .then(() => console.log('[EMAIL] order placed emails attempted (post-payment):', order.id))
                        .catch(err => console.error('[EMAIL] order placed emails failed (post-payment):', err));
                } catch (e) {
                    console.error('[EMAIL] post-payment emails error:', e);
                }
            });
        } else {
            order.payment.status = responseCode === '17' ? 'cancelled' : 'failed';
            if (order.status === 'pending_payment') {
                order.status = 'cancelled';
            }
        }

        writeDatabase(db);

        const redirectTarget = `${BASE_PATH || ''}/thank-you?order=${encodeURIComponent(order.id)}&status=${success ? 'success' : 'failed'}&code=${encodeURIComponent(responseCode || '')}`;
        return res.redirect(302, redirectTarget);
    } catch (error) {
        console.error('BORICA return error:', error);
        res.status(500).send('Payment processing error');
    }
}

app.get(API_PREFIX + '/payments/borica/return', handleBoricaReturn);
app.post(API_PREFIX + '/payments/borica/return', express.urlencoded({ extended: false }), handleBoricaReturn);

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

let cachedSmtpCreds = null;

function loadSmtpCredentials() {
    if (cachedSmtpCreds) return cachedSmtpCreds;

    const directUser = (process.env.SMTP_USER || '').toString().trim();
    const directPass = (process.env.SMTP_PASS || '').toString();

    // Prefer explicit env vars when present.
    if (directUser && directPass) {
        cachedSmtpCreds = { user: directUser, pass: directPass };
        return cachedSmtpCreds;
    }

    const credsFile = (process.env.SMTP_CREDENTIALS_FILE || process.env.SMTP_PASS_FILE || '').toString().trim();
    if (!credsFile) {
        cachedSmtpCreds = { user: directUser, pass: directPass };
        return cachedSmtpCreds;
    }

    try {
        const raw = fs.readFileSync(credsFile, 'utf8');
        const text = raw.replace(/\r/g, '');

        let user = directUser;
        let pass = directPass;

        for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('#')) continue;
            if (trimmed.startsWith('user=')) user = trimmed.slice('user='.length).trim();
            if (trimmed.startsWith('pass=')) pass = trimmed.slice('pass='.length);
        }

        // If file is just a password (legacy), treat as pass.
        if (!pass && !text.includes('pass=') && text.trim().length > 0) {
            pass = text.trim();
        }

        cachedSmtpCreds = { user: (user || '').trim(), pass: pass || '' };
        return cachedSmtpCreds;
    } catch (err) {
        console.error('[EMAIL] Failed to read SMTP credentials file:', credsFile, err?.message || err);
        cachedSmtpCreds = { user: directUser, pass: directPass };
        return cachedSmtpCreds;
    }
}

function isEmailEnabled() {
    const host = (process.env.SMTP_HOST || '').toString().trim();
    const from = (process.env.SMTP_FROM || '').toString().trim();
    const creds = loadSmtpCredentials();
    return !!(nodemailer && host && from && creds.user && creds.pass);
}

function getEmailDiagnostics() {
    const host = (process.env.SMTP_HOST || '').toString().trim();
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = (process.env.SMTP_SECURE || '').toString().toLowerCase() === 'true';
    const from = (process.env.SMTP_FROM || '').toString().trim();
    const replyTo = (process.env.SMTP_REPLY_TO || '').toString().trim();
    const directUser = (process.env.SMTP_USER || '').toString().trim();
    const directPass = (process.env.SMTP_PASS || '').toString();
    const credsFile = (process.env.SMTP_CREDENTIALS_FILE || process.env.SMTP_PASS_FILE || '').toString().trim();
    const credsFileExists = credsFile ? fs.existsSync(credsFile) : false;
    const creds = loadSmtpCredentials();

    const missing = [];
    if (!nodemailer) missing.push('nodemailer');
    if (!host) missing.push('SMTP_HOST');
    if (!from) missing.push('SMTP_FROM');
    if (!creds.user) missing.push('SMTP_USER (or credentials file user=)');
    if (!creds.pass) missing.push('SMTP_PASS (or credentials file pass=)');

    const credsSource = (directUser && directPass)
        ? 'env'
        : (credsFile ? (credsFileExists ? 'file' : 'file_missing') : 'missing');

    return {
        enabled: isEmailEnabled(),
        missing,
        nodemailerLoaded: !!nodemailer,
        smtp: {
            host: host || null,
            port: Number.isFinite(port) ? port : 587,
            secure,
            from: from || null,
            replyTo: replyTo || null,
            credsSource,
            credsFile: credsFile || null,
            credsFileExists,
            userPresent: !!creds.user,
            passPresent: !!creds.pass
        }
    };
}

function getMailTransport() {
    if (!isEmailEnabled()) return null;
    if (mailTransport) return mailTransport;

    // Credentials may have changed between restarts.
    cachedSmtpCreds = null;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = (process.env.SMTP_SECURE || '').toString().toLowerCase() === 'true';
    const creds = loadSmtpCredentials();

    mailTransport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user: creds.user,
            pass: creds.pass
        }
    });

    return mailTransport;
}

async function sendEmail({ to, subject, text, html, replyTo }) {
    const transport = getMailTransport();
    if (!transport) {
        const diag = getEmailDiagnostics();
        console.log('[EMAIL] Disabled or missing SMTP config; skipping email to:', to, 'missing:', diag.missing);
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
        return {
            success: true,
            messageId: info?.messageId,
            accepted: info?.accepted,
            rejected: info?.rejected,
            pending: info?.pending,
            response: info?.response
        };
    } catch (err) {
        console.error('[EMAIL] sendMail failed:', err);
        return {
            success: false,
            error: err?.message || String(err),
            code: err?.code,
            command: err?.command,
            response: err?.response
        };
    }
}

// Email diagnostics & test (admin only)
app.get(API_PREFIX + '/email/status', requireAuth, (req, res) => {
    try {
        res.json(getEmailDiagnostics());
    } catch (e) {
        res.status(500).json({ enabled: false, error: e?.message || 'Failed to get email status' });
    }
});

// POST body: { to?: string }
app.post(API_PREFIX + '/email/test', requireAuth, async (req, res) => {
    try {
        const diag = getEmailDiagnostics();
        if (!diag.enabled) {
            return res.status(400).json({ success: false, diagnostics: diag, error: 'Email is not enabled (missing SMTP config)' });
        }

        const to = (req.body?.to || req.restaurantEmail || '').toString().trim();
        if (!to || !isValidEmail(to)) {
            return res.status(400).json({ success: false, diagnostics: diag, error: 'Valid "to" email is required' });
        }

        const transport = getMailTransport();
        let verifyResult = null;
        try {
            verifyResult = await transport.verify();
        } catch (e) {
            return res.status(500).json({ success: false, diagnostics: diag, stage: 'verify', error: e?.message || String(e), code: e?.code, response: e?.response });
        }

        const sendResult = await sendEmail({
            to,
            subject: `SMTP test (${new Date().toISOString()})`,
            text: `This is a test email from ${req.restaurantName || 'restaurant-backend'}\nHost: ${diag.smtp.host}:${diag.smtp.port}\nSecure: ${diag.smtp.secure}`
        });

        res.json({ success: !!sendResult?.success, verify: verifyResult, send: sendResult, diagnostics: diag });
    } catch (e) {
        res.status(500).json({ success: false, error: e?.message || 'Failed to send test email' });
    }
});

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

    // PUBLIC_BASE_PATH controls how links are rendered to the outside world.
    // This allows nginx to expose the app at '/' (e.g. https://bojole.bg/checkout)
    // while the internal Express mount path stays at /resturant-website.
    const rawPublicBasePath = (process.env.PUBLIC_BASE_PATH ?? BASE_PATH ?? '').toString().trim();
    let publicBasePath = rawPublicBasePath;
    if (publicBasePath === '/') publicBasePath = '';
    if (publicBasePath.endsWith('/') && publicBasePath.length > 1) publicBasePath = publicBasePath.slice(0, -1);
    if (!publicBasePath) {
        return `${base}/track-order.html?id=${encodeURIComponent(orderId)}`;
    }

    return `${base}${publicBasePath}/track-order.html?id=${encodeURIComponent(orderId)}`;
}

async function sendOrderPlacedEmails(order, restaurant) {
    const trackUrl = getPublicOrderTrackUrl(order.id);
    const restaurantTo = getRestaurantNotificationEmail(restaurant);
    const customerTo = (order.customerInfo?.email || '').toString().trim();

    const subjectRestaurant = `New order ${order.id} (${order.deliveryMethod})`;

    const itemsText = formatOrderItemsText(order);
    const totalText = `Total: ${parseNumber(order.total, 0).toFixed(2)} лв`;
    const deliveryText = order.deliveryMethod === 'delivery'
        ? `Delivery to: ${order.customerInfo?.city || ''}, ${order.customerInfo?.address || ''}`
        : 'Pickup';

    const templateVars = {
        orderId: order.id,
        deliveryMethod: order.deliveryMethod,
        customerName: order.customerInfo?.name || '',
        customerPhone: order.customerInfo?.phone || '',
        customerEmail: order.customerInfo?.email || '',
        itemsText,
        totalText,
        deliveryText,
        trackUrl,
        trackUrlLine: trackUrl ? `Track your order: ${trackUrl}` : ''
    };

    const tpl = restaurant?.emailTemplates?.orderPlaced || {};
    const subjectCustomer = (tpl.subject || '').toString().trim() || `Order successfully placed: ${order.id}`;
    const bodyCustomer = (tpl.body || '').toString().trim() || [
        'Order successfully placed.',
        `Order ID: {{orderId}}`,
        '{{deliveryText}}',
        '{{itemsText}}',
        '{{totalText}}',
        '{{trackUrlLine}}'
    ].join('\n');

    const customerText = renderTemplateText(bodyCustomer, templateVars);
    const finalSubjectCustomer = renderTemplateText(subjectCustomer, templateVars);

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
        subject: finalSubjectCustomer,
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

// Get site settings (public) - search mode, footer, legal pages
app.get(API_PREFIX + '/settings/site', (req, res) => {
    try {
        const db = readDatabase();
        const restaurant = getActiveRestaurantForPublicRequest(db, req);
        if (!restaurant) {
            return res.json(getDefaultSiteSettings());
        }

        const normalized = normalizeSiteSettings(restaurant.siteSettings);
        res.json(normalized);
    } catch (error) {
        console.error('Error getting site settings:', error);
        res.status(500).json({ error: 'Failed to get site settings' });
    }
});

// Update site settings (admin only) - stored per restaurant
app.put(API_PREFIX + '/settings/site', requireAuth, (req, res) => {
    try {
        const db = readDatabase();
        const restaurant = db.restaurants?.find(r => r.id === req.restaurantId);
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        restaurant.siteSettings = normalizeSiteSettings(req.body);
        if (writeDatabase(db)) {
            res.json(restaurant.siteSettings);
        } else {
            res.status(500).json({ error: 'Failed to update site settings' });
        }
    } catch (error) {
        console.error('Error updating site settings:', error);
        res.status(500).json({ error: 'Failed to update site settings' });
    }
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
    const existing = db.currencySettings || {};
    res.json({
        eurToBgnRate: existing.eurToBgnRate || 1.9558,
        showBgnPrices: false
    });
});

// Update currency settings
app.put(API_PREFIX + '/settings/currency', requireAuth, (req, res) => {
    const db = readDatabase();
    db.currencySettings = {
        eurToBgnRate: parseFloat(req.body.eurToBgnRate) || 1.9558,
        showBgnPrices: false
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
        'pending_payment',
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

function normalizeEmailTemplateText(value, maxLen = 8000) {
    const s = (value === undefined || value === null) ? '' : String(value);
    // Prevent huge payloads from bloating database.json
    return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function renderTemplateText(template, variables) {
    const vars = variables || {};
    return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        const v = vars[key];
        return (v === undefined || v === null) ? '' : String(v);
    });
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
        const restaurantOrders = orders.filter(order => isOrderForRestaurant(order, req.restaurantId, data));
        
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
            isOrderForRestaurant(order, req.restaurantId, data) && order.status === 'pending'
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
            isOrderForRestaurant(order, req.restaurantId, data) && order.status === 'pending'
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
        if (!isOrderForRestaurant(order, req.restaurantId, data)) {
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
                    const deliveryResult = await sendToDeliveryService(order, { eurToBgnRate: data?.currencySettings?.eurToBgnRate });
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
            orderTime,
            scheduledTime,
            customerInfo,
            timestamp,
            restaurantId,
            paymentMethod
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
            orderTime: (orderTime === 'now' || orderTime === 'later') ? orderTime : undefined,
            scheduledTime: (typeof scheduledTime === 'string' && scheduledTime.trim()) ? scheduledTime.trim() : undefined,
            customerInfo: {
                ...customerInfo,
                previousOrders: previousOrders
            },
            timestamp: timestamp || createdAt.toISOString(),
            status: 'pending',
            createdAt: createdAt.toISOString(),
            trackingExpiry: trackingExpiry.toISOString()
        };

        const normalizedPaymentMethod = (paymentMethod || 'cash').toString().trim().toLowerCase();
        if (normalizedPaymentMethod === 'card') {
            const borica = restaurant.borica;
            const integration = boricaInferIntegrationType(borica);
            const boricaEnabled = integration === 'cgi_link'
                ? !!(borica?.enabled && borica?.terminalId && borica?.merchantId && borica?.privateKeyPem && borica?.publicCertPem)
                : !!(borica?.enabled && borica?.terminalId && borica?.privateKeyPem && borica?.publicCertPem);
            if (!boricaEnabled) {
                return res.status(400).json({ error: 'Card payments are not enabled for this restaurant' });
            }

            if (integration === 'cgi_link') {
                const order6 = generateBoricaOrder6(data.orders);
                const currencySettings = data.currencySettings || { eurToBgnRate: 1.9558 };
                const eurToBgnRate = parseNumber(currencySettings.eurToBgnRate, 1.9558);

                const currencyRaw = (borica.currency || 'EUR').toString().trim().toUpperCase();
                const currency = (currencyRaw === 'BGN' || currencyRaw === 'EUR') ? currencyRaw : 'EUR';

                const amount = currency === 'BGN'
                    ? parseNumber(total, 0) * eurToBgnRate
                    : parseNumber(total, 0);

                const redirectUrl = `${API_PREFIX}/payments/borica/start?orderId=${encodeURIComponent(newOrder.id)}`;

                newOrder.payment = {
                    method: 'card',
                    provider: 'borica',
                    integration: 'cgi_link',
                    status: 'pending',
                    order6,
                    currency,
                    amount: Math.round(amount * 100) / 100
                };
                newOrder.status = 'pending_payment';

                data.orders.push(newOrder);
                writeDatabase(data);

                return res.status(201).json({
                    success: true,
                    message: 'Payment required',
                    order: newOrder,
                    payment: {
                        provider: 'borica',
                        redirectUrl
                    }
                });
            }

            const providerOrderId = generateBoricaProviderOrderId();
            const currencySettings = data.currencySettings || { eurToBgnRate: 1.9558 };
            const eurToBgnRate = parseNumber(currencySettings.eurToBgnRate, 1.9558);
            const amountBGN = parseNumber(total, 0) * eurToBgnRate;
            const orderDescription = `Order ${newOrder.id}`;
            const message = boricaBuildRegisterTransactionMessage({
                amountBGN,
                terminalId: borica.terminalId,
                providerOrderId,
                orderDescription,
                language: 'BG',
                protocolVersion: '1.1'
            });
            const eBorica = boricaSignMessageToEBoricaBase64(message, borica.privateKeyPem);
            const redirectUrl = `${API_PREFIX}/payments/borica/start?orderId=${encodeURIComponent(newOrder.id)}`;

            newOrder.payment = {
                method: 'card',
                provider: 'borica',
                status: 'pending',
                providerOrderId,
                amountBGN,
                eBorica
            };
            newOrder.status = 'pending_payment';

            data.orders.push(newOrder);
            writeDatabase(data);

            return res.status(201).json({
                success: true,
                message: 'Payment required',
                order: newOrder,
                payment: {
                    provider: 'borica',
                    redirectUrl
                }
            });
        }

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
                const deliveryResult = await sendToDeliveryService(order, { eurToBgnRate: data?.currencySettings?.eurToBgnRate });
                
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
        if (!isOrderForRestaurant(data.orders[orderIndex], req.restaurantId, data)) {
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
        if (!isOrderForRestaurant(order, req.restaurantId, data)) {
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

// Batch print approved orders by date range (admin only)
// Query params: from=YYYY-MM-DD, to=YYYY-MM-DD
app.post(API_PREFIX + '/printer/print-approved', requireAuth, async (req, res) => {
    try {
        const fromRaw = (req.query.from || '').toString().trim();
        const toRaw = (req.query.to || '').toString().trim();

        if (!fromRaw || !toRaw) {
            return res.status(400).json({ success: false, error: 'from and to are required (YYYY-MM-DD)' });
        }

        const from = new Date(fromRaw);
        const to = new Date(toRaw);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
        }
        to.setHours(23, 59, 59, 999);

        const data = readDatabase();
        const restaurantId = req.restaurantId;

        const approvedOrders = (data.orders || [])
            .filter(o => o && isOrderForRestaurant(o, restaurantId, data))
            .filter(o => {
                const s = (o.status || '').toString();
                const normalized = s === 'confirmed' ? 'approved' : s;
                return normalized === 'approved';
            })
            .filter(o => {
                const ts = o.timestamp || o.createdAt;
                const d = new Date(ts);
                if (Number.isNaN(d.getTime())) return false;
                return d >= from && d <= to;
            })
            .sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));

        if (approvedOrders.length === 0) {
            return res.json({ success: true, printed: 0, failed: 0, results: [], message: 'No approved orders in range' });
        }

        const { printOrder } = require('./printer-service');
        let printed = 0;
        let failed = 0;
        const results = [];

        for (const order of approvedOrders) {
            try {
                const r = await printOrder(order);
                if (r?.success) {
                    printed += 1;
                } else {
                    failed += 1;
                }
                results.push({ orderId: order.id, success: !!r?.success, error: r?.error });
            } catch (e) {
                failed += 1;
                results.push({ orderId: order.id, success: false, error: e?.message || 'Print failed' });
            }
        }

        res.json({ success: true, printed, failed, results });
    } catch (error) {
        console.error('Error batch printing approved orders:', error);
        res.status(500).json({ success: false, error: 'Failed to batch print approved orders', details: error.message });
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
const PRIVACY_PATH = path.join(__dirname, 'public', 'privacy.html');
const TERMS_PATH = path.join(__dirname, 'public', 'terms.html');
const THANK_YOU_PATH = path.join(__dirname, 'public', 'thank-you.html');

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

app.get(BASE_PATH + '/thank-you', (req, res) => {
    res.sendFile(THANK_YOU_PATH);
});

app.get(BASE_PATH + '/privacy', (req, res) => {
    res.sendFile(PRIVACY_PATH);
});

app.get(BASE_PATH + '/terms', (req, res) => {
    res.sendFile(TERMS_PATH);
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
