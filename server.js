const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { sendToDeliveryService } = require('./delivery-integration');
const { printOrder } = require('./printer-service');

// Optional: load environment variables from .env (useful for production without PM2 env wiring)
try {
    // PM2 may run with a different cwd (e.g. /root). Always resolve .env next to this file.
    require('dotenv').config({ path: path.join(__dirname, '.env') });
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
const UPLOADS_DIR = path.join(__dirname, 'uploads');

function resolveUploadsPathFromImageUrl(imageUrl) {
    const raw = (imageUrl ?? '').toString().trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return null;

    const prefixes = [
        `${BASE_PATH}/uploads/`,
        '/uploads/',
        'uploads/'
    ];

    let filename = null;
    for (const p of prefixes) {
        if (raw.startsWith(p)) {
            filename = raw.slice(p.length);
            break;
        }
    }
    if (!filename) return null;

    filename = filename.split('?')[0].split('#')[0].trim();
    if (!filename) return null;
    // Only allow direct filenames, not nested paths.
    filename = filename.replace(/\\/g, '/');
    if (filename.includes('/') || filename.includes('..')) return null;

    const full = path.resolve(path.join(UPLOADS_DIR, filename));
    const root = path.resolve(UPLOADS_DIR);
    if (!(full === root || full.startsWith(root + path.sep))) return null;
    return full;
}

function deleteLocalProductImages(product) {
    const deleted = [];
    const tryUnlink = (fullPath) => {
        if (!fullPath) return;
        try {
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                deleted.push(path.basename(fullPath));
            }
        } catch (e) {
            // Best-effort: never fail the API because file delete failed.
            console.warn('[DELETE] Failed to delete image:', fullPath, e?.message || e);
        }
    };

    // Delete the currently referenced file (if local)
    tryUnlink(resolveUploadsPathFromImageUrl(product?.image));

    // Also delete id-based bulk images (e.g. 1.jpg) for this product.
    const id = parseInt(product?.id, 10);
    if (Number.isFinite(id)) {
        for (const ext of ['.jpg', '.jpeg', '.png', '.gif', '.webp']) {
            tryUnlink(path.join(UPLOADS_DIR, `${id}${ext}`));
        }
    }

    return deleted;
}

function extractUploadsFilenameFromUrl(imageUrl) {
    const raw = (imageUrl ?? '').toString().trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return null;

    const prefixes = [
        `${BASE_PATH}/uploads/`,
        '/uploads/',
        'uploads/'
    ];

    let filename = null;
    for (const p of prefixes) {
        if (raw.startsWith(p)) {
            filename = raw.slice(p.length);
            break;
        }
    }
    if (!filename) return null;

    filename = filename.split('?')[0].split('#')[0].trim();
    if (!filename) return null;
    filename = filename.replace(/\\/g, '/');
    if (filename.includes('/') || filename.includes('..')) return null;
    return filename;
}

function isSafeUploadsFilename(filename) {
    const name = (filename ?? '').toString().trim();
    if (!name) return false;
    if (name.replace(/\\/g, '/').includes('/')) return false;
    if (name.includes('..')) return false;
    if (name !== path.basename(name)) return false;
    return true;
}

function getReferencedUploadsFilenames(db) {
    const set = new Set();
    const products = Array.isArray(db?.products) ? db.products : [];
    for (const p of products) {
        const fn = extractUploadsFilenameFromUrl(p?.image);
        if (fn) set.add(fn);
    }
    return set;
}

function listUploadImages(db, { unlinkedOnly = true } = {}) {
    const referenced = getReferencedUploadsFilenames(db);
    const products = Array.isArray(db?.products) ? db.products : [];
    const productIds = new Set(products.map(p => Number(p?.id)).filter(Number.isFinite));

    let files = [];
    try {
        files = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })
            .filter(d => d && d.isFile && d.isFile())
            .map(d => d.name);
    } catch (e) {
        return [];
    }

    const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

    const items = [];
    for (const name of files) {
        const ext = path.extname(name).toLowerCase();
        if (!allowedExt.has(ext)) continue;

        const isReferenced = referenced.has(name);
        if (unlinkedOnly && isReferenced) continue;

        const base = path.basename(name, ext).trim();
        const id = parseInt(base, 10);
        const productIdFromFilename = (Number.isFinite(id) && String(id) === base) ? id : null;
        const productExists = productIdFromFilename != null ? productIds.has(productIdFromFilename) : false;

        let size = 0;
        let mtimeMs = 0;
        try {
            const st = fs.statSync(path.join(UPLOADS_DIR, name));
            size = Number(st.size) || 0;
            mtimeMs = Number(st.mtimeMs) || 0;
        } catch (e) {
            // ignore
        }

        items.push({
            filename: name,
            url: `/uploads/${name}`,
            size,
            mtimeMs,
            referenced: isReferenced,
            productIdFromFilename,
            productExists
        });
    }

    items.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
    return items;
}

// Multi-tenant authentication system
// Each restaurant has its own credentials and API key
// In production: use environment variables, hash passwords with bcrypt, use proper JWT tokens

// Token storage: Map of token -> { restaurantId, username, expiresAt }
const activeTokens = new Map();

function ensureAuthTokensStore(db) {
    if (!db || typeof db !== 'object') return {};
    if (!db.authTokens || typeof db.authTokens !== 'object') db.authTokens = {};
    return db.authTokens;
}

function persistToken(token, tokenData) {
    try {
        const db = readDatabase();
        const store = ensureAuthTokensStore(db);
        store[String(token)] = {
            restaurantId: String(tokenData.restaurantId || ''),
            username: String(tokenData.username || ''),
            expiresAt: Number(tokenData.expiresAt) || (Date.now() + 86400000)
        };
        writeDatabase(db);
    } catch (e) {
        console.error('[AUTH] Failed to persist token:', e?.message || e);
    }
}

function deletePersistedToken(token) {
    try {
        const db = readDatabase();
        const store = ensureAuthTokensStore(db);
        delete store[String(token)];
        writeDatabase(db);
    } catch (e) {
        console.error('[AUTH] Failed to delete persisted token:', e?.message || e);
    }
}

function hydrateTokensFromDb() {
    try {
        const db = readDatabase();
        const store = ensureAuthTokensStore(db);
        const now = Date.now();
        let changed = false;

        for (const [token, data] of Object.entries(store)) {
            const expiresAt = Number(data?.expiresAt) || 0;
            if (!expiresAt || expiresAt < now) {
                delete store[token];
                changed = true;
                continue;
            }
            if (!activeTokens.has(token)) {
                activeTokens.set(token, {
                    restaurantId: String(data?.restaurantId || ''),
                    username: String(data?.username || ''),
                    expiresAt
                });
            }
        }

        if (changed) writeDatabase(db);
    } catch (e) {
        console.error('[AUTH] Failed to hydrate tokens:', e?.message || e);
    }
}

// Generate simple token
function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function migrateRestaurantAuthDefaults() {
    try {
        const db = readDatabase();
        if (!db || typeof db !== 'object') return;
        if (!Array.isArray(db.restaurants) || db.restaurants.length === 0) return;

        // LAUTA defaults requested by user
        const desiredId = 'rest_lauta_002';
        const primaryUsername = 'lauta_admin';
        const primaryPassword = 'lauta123';
        const secondaryUsername = 'crystal';
        const secondaryPassword = 'crystal123';

        const restaurant = db.restaurants.find(r => r && r.id === desiredId) || db.restaurants[0];
        if (!restaurant || typeof restaurant !== 'object') return;

        let changed = false;

        if (restaurant.id !== desiredId) {
            restaurant.id = desiredId;
            changed = true;
        }

        if (restaurant.username !== primaryUsername) {
            restaurant.username = primaryUsername;
            changed = true;
        }
        if (restaurant.password !== primaryPassword) {
            restaurant.password = primaryPassword;
            changed = true;
        }

        if (!Array.isArray(restaurant.adminUsers)) {
            restaurant.adminUsers = [];
            changed = true;
        }

        const hasSecondary = restaurant.adminUsers.some(u => u && u.username === secondaryUsername);
        if (!hasSecondary) {
            restaurant.adminUsers.push({ username: secondaryUsername, password: secondaryPassword });
            changed = true;
        }

        if (changed) {
            writeDatabase(db);
            console.log('[AUTH] Migrated restaurant auth defaults (primary + secondary admin).');
        }
    } catch (e) {
        console.error('[AUTH] Failed to migrate auth defaults:', e?.message || e);
    }
}

// Helper function to get restaurant by credentials
function getRestaurantByCredentials(username, password) {
    console.log('[GET RESTAURANT] Called with username:', username);
    const db = readDatabase();
    console.log('[GET RESTAURANT] After readDatabase, db type:', typeof db);
    console.log('[GET RESTAURANT] Restaurants in database:', db.restaurants ? db.restaurants.length : 'NONE');
    if (db.restaurants) {
        const first = db.restaurants[0] || {};
        console.log('[GET RESTAURANT] First restaurant:', JSON.stringify({
            id: first.id,
            name: first.name,
            username: first.username,
            active: first.active
        }));
    }

    const u = (username ?? '').toString();
    const p = (password ?? '').toString();
    if (!u || !p) return null;

    const direct = db.restaurants?.find(r => r && r.username === u && r.password === p);
    if (direct) {
        console.log('[GET RESTAURANT] Found (primary):', direct.name);
        return direct;
    }

    const viaSecondary = db.restaurants?.find(r => {
        const users = Array.isArray(r?.adminUsers) ? r.adminUsers : [];
        return users.some(x => x && x.username === u && x.password === p);
    });
    console.log('[GET RESTAURANT] Found (secondary):', viaSecondary ? viaSecondary.name : 'NOT FOUND');
    return viaSecondary || null;
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
        deletePersistedToken(token);
        return null;
    }
    
    const db = readDatabase();
    return db.restaurants?.find(r => r.id === tokenData.restaurantId);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// React Native / some HTTP clients may send JSON as text/plain unless Content-Type is set.
// Accept text bodies and (when possible) parse them into JSON so API endpoints remain robust.
app.use(express.text({ type: ['text/plain', 'text/*'], limit: '50mb' }));
app.use((req, res, next) => {
    if (typeof req.body !== 'string') return next();
    const trimmed = req.body.trim();
    if (!trimmed) return next();
    // Only attempt JSON parse when it looks like JSON.
    const looksLikeJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
    if (!looksLikeJson) return next();

    try {
        req.body = JSON.parse(trimmed);
    } catch (e) {
        // Leave req.body as-is; downstream handlers can return a 400 if needed.
    }

    next();
});

// Compatibility: some clients mistakenly call `${baseUrl}/api/...` while baseUrl already ends with `/api`.
// Example: `/resturant-website/api/api/login` -> `/resturant-website/api/login`
app.use((req, res, next) => {
    const base = (BASE_PATH || '');
    const legacyPrefix = (base + '/api/api/');

    if (req.url.startsWith(legacyPrefix)) {
        req.url = (base + '/api/') + req.url.slice(legacyPrefix.length);
        return next();
    }

    // Also handle root-mounted proxies that expose `/api` without BASE_PATH.
    if (req.url.startsWith('/api/api/')) {
        req.url = '/api/' + req.url.slice('/api/api/'.length);
        return next();
    }

    // Root /api -> BASE_PATH /api (common nginx setup: public /api, internal app at /resturant-website).
    if (base && base !== '/' && (req.url === '/api' || req.url.startsWith('/api/'))) {
        req.url = base + req.url;
        return next();
    }

    next();
});

// Static files & uploads served under BASE_PATH if defined
if (BASE_PATH) {
    app.use(BASE_PATH, express.static(path.join(__dirname, 'public'), {
        index: false,
        setHeaders: (res, servedPath) => {
            if (typeof servedPath === 'string' && servedPath.toLowerCase().endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-store');
            }
        }
    }));
    app.use(BASE_PATH + '/uploads', express.static(path.join(__dirname, 'uploads')));
    // Also expose uploads at the root. Frontend auto-detects BASE_PATH from the URL,
    // and on root-mounted deployments it will request /uploads/... directly.
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    // Minimal vendor assets (served from node_modules)
    app.use(BASE_PATH + '/vendor', express.static(path.join(__dirname, 'node_modules', 'jszip', 'dist')));
} else {
    app.use(express.static(path.join(__dirname, 'public'), {
        index: false,
        setHeaders: (res, servedPath) => {
            if (typeof servedPath === 'string' && servedPath.toLowerCase().endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-store');
            }
        }
    }));
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    app.use('/vendor', express.static(path.join(__dirname, 'node_modules', 'jszip', 'dist')));
}

// Vendor static assets (keeps the UI working without external CDNs; helps E2E tests)
const fontawesomeDir = path.join(__dirname, 'node_modules', '@fortawesome', 'fontawesome-free');
if (fs.existsSync(fontawesomeDir)) {
    const mount = (BASE_PATH ? BASE_PATH : '') + '/vendor/fontawesome';
    app.use(mount, express.static(fontawesomeDir));
}

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Setup multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
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

// Favicon upload (allows .ico in addition to normal images)
const faviconStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const original = (file?.originalname || '').toString();
        const mime = (file?.mimetype || '').toString().toLowerCase();
        let ext = path.extname(original).toLowerCase();
        if (!ext) {
            if (mime === 'image/png') ext = '.png';
            else if (mime === 'image/jpeg') ext = '.jpg';
            else if (mime === 'image/webp') ext = '.webp';
            else if (mime === 'image/gif') ext = '.gif';
            else if (mime.includes('icon') || mime.includes('x-icon')) ext = '.ico';
            else ext = '.png';
        }
        cb(null, `favicon${ext}`);
    }
});

const uploadFavicon = multer({
    storage: faviconStorage,
    limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
    fileFilter: function (req, file, cb) {
        const original = (file?.originalname || '').toString().toLowerCase();
        const mime = (file?.mimetype || '').toString().toLowerCase();
        const ext = path.extname(original).toLowerCase();
        const okExt = ['.ico', '.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) || !ext;
        const okMime = mime.startsWith('image/') || mime.includes('icon') || mime.includes('x-icon');
        if (okExt && okMime) return cb(null, true);
        cb(new Error('Only favicon image files are allowed (.ico, .png, .jpg, .webp, .gif)'));
    }
});

// Footer "About us" logo upload
const footerAboutLogoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const original = (file?.originalname || '').toString();
        const mime = (file?.mimetype || '').toString().toLowerCase();
        let ext = path.extname(original).toLowerCase();
        if (!ext) {
            if (mime === 'image/png') ext = '.png';
            else if (mime === 'image/jpeg') ext = '.jpg';
            else if (mime === 'image/webp') ext = '.webp';
            else if (mime === 'image/gif') ext = '.gif';
            else if (mime === 'image/svg+xml') ext = '.svg';
            else ext = '.png';
        }
        cb(null, `footer-about-logo${ext}`);
    }
});

const uploadFooterAboutLogo = multer({
    storage: footerAboutLogoStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: function (req, file, cb) {
        const original = (file?.originalname || '').toString().toLowerCase();
        const mime = (file?.mimetype || '').toString().toLowerCase();
        const ext = path.extname(original).toLowerCase();
        const okExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext) || !ext;
        const okMime = mime.startsWith('image/');
        if (okExt && okMime) return cb(null, true);
        cb(new Error('Only image files are allowed (.png, .jpg, .webp, .gif, .svg)'));
    }
});

// Bulk product image upload: filename base must match product id (e.g. 1.jpg -> id 1)
const productImageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext).trim();
        const parsedId = parseInt(base, 10);

        // If the base name is a clean integer, normalize to <id><ext>.
        if (Number.isFinite(parsedId) && String(parsedId) === base) {
            return cb(null, `${parsedId}${ext}`);
        }

        // Otherwise keep a sanitized version (won't be auto-matched).
        const safe = file.originalname
            .toString()
            .replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, safe);
    }
});

const uploadProductImages = multer({
    storage: productImageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
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

// In-memory upload for small XLSX files (product import/template workflows)
const uploadXlsx = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const name = (file?.originalname ?? '').toString().toLowerCase();
        const ok = file && (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || name.endsWith('.xlsx'));
        if (!ok) return cb(new Error('Only .xlsx files are allowed'));
        cb(null, true);
    }
});

function normalizeXlsxHeaderKey(value) {
    return (value ?? '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function parseBoolLikeServer(value) {
    const v = (value ?? '').toString().trim().toLowerCase();
    if (!v) return false;
    if (['1', 'true', 'yes', 'y', 'on', 'да', 'ok'].includes(v)) return true;
    if (['0', 'false', 'no', 'n', 'off', 'не'].includes(v)) return false;
    return false;
}

function parsePriceLike(value) {
    const raw = (value ?? '').toString().trim();
    if (!raw) return NaN;
    const cleaned = raw
        .replace(/\s+/g, '')
        .replace(/[€$£]/g, '')
        .replace(/(eur|bgn|lv|usd|gbp)$/i, '')
        .replace(/,/g, '.');
    const match = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!match) return NaN;
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : NaN;
}

function buildXlsxHeaderIndexMap(headerRow) {
    const idx = {};
    const aliases = {
        id: ['id'],
        code: ['code', 'код', 'product code'],
        // Legacy single-language columns
        // NOTE: Do NOT include plain 'name'/'category' here, because customer files use them
        // as EN columns and we want them to map to *_en.
        name: ['наименование', 'продукт', 'name (legacy)', 'име (legacy)'],
        category: ['категория (legacy)', 'category (legacy)'],
        info: ['info', 'описание/състав', 'състав'],

        // Bilingual columns (preferred)
        name_bg: ['име', 'име bg', 'име (bg)'],
        name_en: ['name', 'name en', 'name (en)'],
        category_bg: ['категория', 'категория bg', 'категория (bg)'],
        category_en: ['category', 'category en', 'category (en)'],
        description_bg: ['описание', 'описание bg', 'описание (bg)'],
        description_en: ['description', 'discription', 'description en', 'description (en)'],
        weight: ['weight/quantity', 'weight', 'quantity', 'грамаж', 'тегло', 'количество'],

        subcategory: ['subcategory', 'подкатегория', 'подкат.', 'група', 'подгрупа'],
        price: ['price', 'цена'],
        promo_price: ['promo price', 'promo_price', 'промо цена', 'цена промо'],
        promo_percentage: ['promo %', 'promo%', 'promo_percentage', 'промо %', 'отстъпка %', 'discount %'],
        is_promo: ['is promo', 'is_promo', 'промо', 'promo'],
        available: ['available', 'availability', 'наличност', 'наличен', 'активен'],
        img_url: ['img / url', 'img_url', 'image', 'image url', 'снимка', 'снимки', 'линк', 'снимки / линк'],
        // Keep old keys for compatibility (some files might still use these)
        description: ['description']
    };

    const normalizedCells = (headerRow || []).map(h => normalizeXlsxHeaderKey(h));
    for (let i = 0; i < normalizedCells.length; i++) {
        const cell = normalizedCells[i];
        if (!cell) continue;
        for (const [key, keys] of Object.entries(aliases)) {
            if (idx[key] != null) continue;
            if (keys.includes(cell)) idx[key] = i;
        }
    }
    return idx;
}

function findLikelyHeaderRowIndex(rows) {
    const maxScan = Math.min(10, rows.length);
    for (let i = 0; i < maxScan; i++) {
        const idx = buildXlsxHeaderIndexMap(rows[i] || []);
        const hasIdOrCode = (idx.code != null || idx.id != null);
        const hasName = (idx.name_bg != null || idx.name_en != null || idx.name != null);
        const hasCategory = (idx.category_bg != null || idx.category_en != null || idx.category != null);
        if (hasIdOrCode && hasName && hasCategory && idx.price != null) return i;
    }
    return -1;
}

function coerceCellString(row, i) {
    if (!row || i == null || i < 0) return '';
    return (row[i] ?? '').toString().trim();
}

function generateUniqueProductId(db, requestedId) {
    const parsed = (requestedId !== undefined && requestedId !== null && requestedId !== '') ? parseInt(requestedId, 10) : NaN;
    let nextId = Number.isFinite(parsed) ? parsed : Date.now();
    const used = new Set((db.products || []).map(p => p?.id).filter(v => v !== undefined && v !== null));
    if (used.has(nextId)) {
        nextId = Date.now() + Math.floor(Math.random() * 1000);
        while (used.has(nextId)) nextId += 1;
    }
    return nextId;
}

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
            restaurantName: "Restaurant Lauta",
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
                    id: "rest_lauta_002",
                    name: "Restaurant Lauta",
                    username: "lauta_admin",
                    password: "lauta123", // In production: hash with bcrypt
                    apiKey: "lauta_api_key_12345",
                    address: "София, бул. Витоша 100",
                    phone: "+359888123456",
                    email: "contact@restaurant-lauta.bg",
                    orderNotificationEmail: "contact@restaurant-lauta.bg",
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
            promoCodes: [],
            authTokens: {}
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    }
}

// Read database
function readDatabase() {
    const debugLogs = process.env.DEBUG_DB_LOGS === '1' || process.env.DEBUG_DB_LOGS === 'true';
    const bakFile = `${DB_FILE}.bak`;

    const normalizeDbShape = (db) => {
        const parsed = (db && typeof db === 'object') ? db : {};
        if (!Array.isArray(parsed.restaurants)) parsed.restaurants = [];
        if (!Array.isArray(parsed.products)) parsed.products = [];
        if (!Array.isArray(parsed.orders)) parsed.orders = [];
        if (!Array.isArray(parsed.promoCodes)) parsed.promoCodes = [];
        if (!parsed.authTokens || typeof parsed.authTokens !== 'object') parsed.authTokens = {};
        if (!parsed.restaurantName) parsed.restaurantName = "Restaurant Name";
        return parsed;
    };

    const tryReadJson = (filePath) => {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    };

    try {
        const parsed = normalizeDbShape(tryReadJson(DB_FILE));
        if (debugLogs) {
            console.log('[READ DB] file:', DB_FILE);
            console.log('[READ DB] Keys in database:', Object.keys(parsed));
            console.log('[READ DB] Has restaurants?', parsed.restaurants ? `YES (${parsed.restaurants.length})` : 'NO');
        }
        return parsed;
    } catch (error) {
        // If the main DB file is missing/corrupted (e.g. partial write), try the last known good backup.
        try {
            if (fs.existsSync(bakFile)) {
                const parsedBak = normalizeDbShape(tryReadJson(bakFile));
                console.warn('[DB] Falling back to backup DB due to read/parse error:', error?.message || error);
                if (debugLogs) console.warn('[DB] Using backup file:', bakFile);
                return parsedBak;
            }
        } catch (bakErr) {
            console.error('[DB] Backup DB read also failed:', bakErr);
        }

        console.error('Error reading database:', error);
        return normalizeDbShape({});
    }
}

// Write database
function writeDatabase(data) {
    const dir = path.dirname(DB_FILE);
    const bakFile = `${DB_FILE}.bak`;
    const tmpFile = `${DB_FILE}.tmp`;

    try {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
            // ignore
        }

        const payload = JSON.stringify(data, null, 2);
        fs.writeFileSync(tmpFile, payload, 'utf8');

        // Best-effort: keep a last-known-good backup.
        try {
            if (fs.existsSync(DB_FILE)) {
                try { fs.unlinkSync(bakFile); } catch (e) {}
                try {
                    fs.renameSync(DB_FILE, bakFile);
                } catch (e) {
                    // Fallback if rename isn't possible (e.g. across devices)
                    fs.copyFileSync(DB_FILE, bakFile);
                }
            }
        } catch (e) {
            console.warn('[DB] Failed to rotate DB backup:', e?.message || e);
        }

        // Replace main DB file with tmp (attempt to be resilient on Windows).
        try {
            try { fs.unlinkSync(DB_FILE); } catch (e) {}
            fs.renameSync(tmpFile, DB_FILE);
        } catch (e) {
            // Fallback: copy then remove tmp
            fs.copyFileSync(tmpFile, DB_FILE);
            try { fs.unlinkSync(tmpFile); } catch (e2) {}
        }

        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        try { fs.unlinkSync(tmpFile); } catch (e) {}
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

function parseHHMMToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return null;
    const m = hhmm.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
}

const DEFAULT_WORKING_HOURS_TZ = 'Europe/Sofia';
const WORKING_HOURS_WEEK_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function getWeekdayKeyInTimeZone(timeZone, date = new Date()) {
    const tz = (timeZone || DEFAULT_WORKING_HOURS_TZ).toString();
    try {
        const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
        const map = {
            Mon: 'mon',
            Tue: 'tue',
            Wed: 'wed',
            Thu: 'thu',
            Fri: 'fri',
            Sat: 'sat',
            Sun: 'sun'
        };
        return map[weekdayShort] || null;
    } catch (e) {
        return null;
    }
}

function normalizeWorkingHoursDay(rawDay, fallbackDay) {
    const fallback = fallbackDay || { closed: false, openingTime: '09:00', closingTime: '22:00' };
    const closed = rawDay?.closed === true;
    const openingTime = (rawDay?.openingTime || fallback.openingTime || '09:00').toString().trim();
    const closingTime = (rawDay?.closingTime || fallback.closingTime || '22:00').toString().trim();
    return {
        closed,
        openingTime: openingTime || '09:00',
        closingTime: closingTime || '22:00'
    };
}

function normalizeWorkingHoursConfig(raw) {
    const timeZone = (raw?.timezone || raw?.timeZone || DEFAULT_WORKING_HOURS_TZ).toString().trim() || DEFAULT_WORKING_HOURS_TZ;

    const legacyOpening = (raw?.openingTime || '09:00').toString().trim() || '09:00';
    const legacyClosing = (raw?.closingTime || '22:00').toString().trim() || '22:00';
    const legacyDay = { closed: false, openingTime: legacyOpening, closingTime: legacyClosing };

    const weeklyIn = (raw && typeof raw.weekly === 'object' && raw.weekly) ? raw.weekly : null;
    const weekly = {};
    for (const key of WORKING_HOURS_WEEK_KEYS) {
        weekly[key] = normalizeWorkingHoursDay(weeklyIn ? weeklyIn[key] : null, legacyDay);
    }

    // Keep top-level opening/closing as a backward-compatible fallback.
    return {
        timezone: timeZone,
        weekly,
        openingTime: weekly.mon.openingTime,
        closingTime: weekly.mon.closingTime
    };
}

function getWorkingHoursForDate(rawWorkingHours, date = new Date(), timeZoneFallback = DEFAULT_WORKING_HOURS_TZ) {
    const cfg = normalizeWorkingHoursConfig(rawWorkingHours);
    const tz = (cfg?.timezone || timeZoneFallback || DEFAULT_WORKING_HOURS_TZ).toString();
    const dayKey = getWeekdayKeyInTimeZone(tz, date) || 'mon';
    const day = (cfg.weekly && cfg.weekly[dayKey]) ? cfg.weekly[dayKey] : normalizeWorkingHoursDay(null, null);
    return {
        timezone: tz,
        dayKey,
        closed: day.closed === true,
        openingTime: day.openingTime,
        closingTime: day.closingTime
    };
}

function getMinutesOfDayInTimeZone(timeZone, date = new Date()) {
    try {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const parts = dtf.formatToParts(date);
        const map = {};
        for (const p of parts) {
            if (p.type !== 'literal') map[p.type] = p.value;
        }
        const hh = Number(map.hour);
        const mm = Number(map.minute);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
        return hh * 60 + mm;
    } catch (e) {
        return null;
    }
}

function isMinutesWithinWindow(nowMinutes, openMinutes, closeMinutes) {
    if (!Number.isFinite(nowMinutes) || !Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) return false;
    if (openMinutes === closeMinutes) return false;
    // Normal window (same day)
    if (closeMinutes > openMinutes) {
        return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    }
    // Overnight window (e.g. 18:00 - 02:00)
    return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
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
        theme: 'classic',
        faviconUrl: '',
        seo: {
            title: '',
            description: '',
            canonicalUrl: '',
            ogImageUrl: '',
            robots: '',
            googleSiteVerification: ''
        },
        search: { mode: 'names_and_descriptions' },
        map: { enabled: false, lat: null, lng: null, zoom: 16, label: '' },
        email: { webmailUrl: '' },
        categories: { order: [], labels: {} },
        footer: {
            contacts: { phone: '', email: '', address: '', addressMapsUrl: '' },
            aboutText: '',
            aboutLogoUrl: '',
            socials: []
        },
        legal: { privacyHtml: '', termsHtml: '' }
    };
}

function normalizeSiteSettings(input) {
    const base = getDefaultSiteSettings();
    const src = input && typeof input === 'object' ? input : {};

    const themeRaw = (src.theme || base.theme).toString().trim().toLowerCase();
    const theme = (themeRaw === 'modern' || themeRaw === 'classic') ? themeRaw : base.theme;

    const faviconRaw = normalizeText(src.faviconUrl, 320);
    let faviconUrl = '';
    if (faviconRaw) {
        const clean = faviconRaw.split('#')[0].trim();
        if (/^\/uploads\/favicon\.(ico|png|jpe?g|gif|webp)(\?v=\d+)?$/i.test(clean)) {
            faviconUrl = clean;
        }
    }

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

    const aboutLogoRaw = normalizeText(src.footer?.aboutLogoUrl, 500);
    let aboutLogoUrl = '';
    if (aboutLogoRaw) {
        const clean = aboutLogoRaw.split('#')[0].trim();
        if (/^https?:\/\//i.test(clean)) {
            aboutLogoUrl = clean;
        } else if (/^\/uploads\/footer-about-logo\.(png|jpe?g|gif|webp|svg)(\?v=\d+)?$/i.test(clean)) {
            aboutLogoUrl = clean;
        }
    }

    const footer = {
        contacts: {
            phone: normalizeText(contacts.phone, 100),
            email: normalizeText(contacts.email, 120),
            address: normalizeText(contacts.address, 240),
            addressMapsUrl: normalizeText(contacts.addressMapsUrl, 500)
        },
        aboutText: normalizeText(src.footer?.aboutText, 600),
        aboutLogoUrl,
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

    const email = {
        webmailUrl: normalizeText(src.email?.webmailUrl, 500)
    };

    const seoSrc = (src.seo && typeof src.seo === 'object') ? src.seo : {};
    const seoTitle = normalizeText(seoSrc.title, 120);
    const seoDescription = normalizeText(seoSrc.description, 260);
    const seoCanonicalRaw = normalizeText(seoSrc.canonicalUrl, 500);
    const seoOgImageRaw = normalizeText(seoSrc.ogImageUrl, 500);
    const seoRobots = normalizeText(seoSrc.robots, 120);
    const seoGsv = normalizeText(seoSrc.googleSiteVerification, 120);

    const normalizeOptionalAbsUrl = (raw) => {
        const s = (raw || '').toString().trim();
        if (!s) return '';
        if (/^https?:\/\//i.test(s)) return s;
        return '';
    };

    const normalizeOptionalPublicImageUrl = (raw) => {
        const s = (raw || '').toString().trim();
        if (!s) return '';
        if (/^https?:\/\//i.test(s)) return s;
        // Allow local uploads only.
        if (/^\/uploads\//i.test(s)) return s;
        return '';
    };

    const seo = {
        title: seoTitle,
        description: seoDescription,
        canonicalUrl: normalizeOptionalAbsUrl(seoCanonicalRaw),
        ogImageUrl: normalizeOptionalPublicImageUrl(seoOgImageRaw),
        robots: seoRobots,
        googleSiteVerification: seoGsv
    };

    const categoriesSrc = src.categories && typeof src.categories === 'object' ? src.categories : {};
    const orderSrc = Array.isArray(categoriesSrc.order) ? categoriesSrc.order : [];
    const order = [];
    const seen = new Set();
    for (const rawKey of orderSrc.slice(0, 200)) {
        const key = normalizeText(rawKey, 80);
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        order.push(key);
    }

    const labelsSrc = categoriesSrc.labels && typeof categoriesSrc.labels === 'object' ? categoriesSrc.labels : {};
    const labels = {};
    const labelEntries = Object.entries(labelsSrc).slice(0, 200);
    for (const [rawKey, rawValue] of labelEntries) {
        const key = normalizeText(rawKey, 80);
        if (!key) continue;
        const value = rawValue && typeof rawValue === 'object' ? rawValue : {};
        const en = normalizeText(value.en, 80);
        const bg = normalizeText(value.bg, 80);
        if (!en && !bg) continue;
        labels[key] = { en, bg };
    }

    const categories = { order, labels };

    return { theme, faviconUrl, seo, search: { mode }, map, email, categories, footer, legal };
}

function isOrderForRestaurant(order, restaurantId, db) {
    if (!order) return false;
    if (order.restaurantId) return order.restaurantId === restaurantId;
    const activeRestaurants = (db.restaurants || []).filter(r => r && r.active);
    return activeRestaurants.length === 1 && activeRestaurants[0].id === restaurantId;
}

// Initialize database on startup
initDatabase();
migrateRestaurantAuthDefaults();
hydrateTokensFromDb();

// ==================== API ROUTES ====================

const API_PREFIX = BASE_PATH + '/api';

// Simple health check endpoint (useful for mobile app connectivity debugging)
app.get(API_PREFIX + '/health', (req, res) => {
    res.json({
        ok: true,
        time: new Date().toISOString(),
        basePath: BASE_PATH,
        apiPrefix: API_PREFIX
    });
});

// Login endpoint - multi-tenant support
app.post(API_PREFIX + '/login', (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const username = (body.username ?? '').toString();
    const password = (body.password ?? '').toString();

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Missing username or password'
        });
    }
    
    console.log('[LOGIN] Attempt for username:', username);
    
    const restaurant = getRestaurantByCredentials(username, password);
    
    console.log('[LOGIN] Found restaurant:', restaurant ? restaurant.name : 'NOT FOUND');
    
    if (restaurant && restaurant.active) {
        const token = generateToken();

        // Store token with restaurant info and long expiration (~1 year)
        const tokenData = {
            restaurantId: restaurant.id,
            username: restaurant.username,
            expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000)
        };

        activeTokens.set(token, tokenData);
        persistToken(token, tokenData);
        
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
        deletePersistedToken(token);
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Current restaurant profile (Bearer token or API key)
app.get(API_PREFIX + '/restaurants/me', requireAuthOrApiKey, (req, res) => {
    try {
        const db = readDatabase();
        const restaurant = db.restaurants?.find(r => r.id === req.restaurantId);
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const orderPlacedTpl = getEffectiveOrderPlacedTemplate(restaurant);
        const printerNormalized = normalizePrinterConfig(restaurant.printer);

        res.json({
            id: restaurant.id,
            name: restaurant.name,
            email: restaurant.email || '',
            orderNotificationEmail: restaurant.orderNotificationEmail || '',
            printer: printerNormalized.ok ? printerNormalized.value : { enabled: false, ip: '', port: 9100, autoPrintOnApproved: true, printPickup: true, allowAutoDiscovery: false },
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

// Admin: download the restaurant APK (Bearer token required)
app.get(API_PREFIX + '/admin/apk', requireAuth, (req, res) => {
    try {
        const filename = 'konkar-2.0.33-vc35-lauta.apk';
        const apkPath = path.join(__dirname, 'public', 'apk', filename);
        if (!fs.existsSync(apkPath)) {
            return res.status(404).json({ error: 'APK not configured' });
        }
        return res.download(apkPath, filename);
    } catch (e) {
        console.error('Error downloading APK:', e);
        return res.status(500).json({ error: 'Failed to download APK' });
    }
});

// Restaurant API key (admin only; Bearer token required)
app.get(API_PREFIX + '/restaurants/me/api-key', requireAuth, (req, res) => {
    try {
        const db = readDatabase();
        const restaurant = db.restaurants?.find(r => r.id === req.restaurantId);
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        return res.json({ apiKey: (restaurant.apiKey || '').toString() });
    } catch (e) {
        console.error('Error loading restaurant apiKey:', e);
        return res.status(500).json({ error: 'Failed to load apiKey' });
    }
});

app.put(API_PREFIX + '/restaurants/me', requireAuth, (req, res) => {
    try {
        const { orderNotificationEmail, borica, emailTemplates, printer, username, password } = req.body;
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

        if (username !== undefined) {
            const nextUsername = (username || '').toString().trim();
            if (!nextUsername) {
                return res.status(400).json({ error: 'Admin username cannot be empty' });
            }
            if (nextUsername.length < 3 || nextUsername.length > 64) {
                return res.status(400).json({ error: 'Admin username must be 3-64 characters' });
            }
            if (!/^[A-Za-z0-9_.-]+$/.test(nextUsername)) {
                return res.status(400).json({ error: 'Admin username contains invalid characters' });
            }

            const usernameTaken = (db.restaurants || []).some(r => r && r.id !== req.restaurantId && (r.username || '') === nextUsername);
            if (usernameTaken) {
                return res.status(400).json({ error: 'Admin username is already taken' });
            }

            db.restaurants[idx].username = nextUsername;

            // Keep current Bearer token metadata consistent
            try {
                const token = (req.headers.authorization || '').toString().replace('Bearer ', '').trim();
                if (token && activeTokens.has(token)) {
                    const tokenData = activeTokens.get(token);
                    const updated = { ...tokenData, username: nextUsername };
                    activeTokens.set(token, updated);
                    persistToken(token, updated);
                }
            } catch (e) {
                // ignore
            }
        }

        if (password !== undefined) {
            const nextPassword = (password || '').toString();
            if (!nextPassword.trim()) {
                return res.status(400).json({ error: 'Admin password cannot be empty' });
            }
            if (nextPassword.trim().length < 6) {
                return res.status(400).json({ error: 'Admin password must be at least 6 characters' });
            }
            db.restaurants[idx].password = nextPassword;
        }

        if (borica !== undefined) {
            const parseLooseBoolean = (value, defaultValue = false) => {
                if (value === true || value === false) return value;
                if (value === 1 || value === 0) return value === 1;
                const s = (value ?? '').toString().trim().toLowerCase();
                if (s === '') return false;
                if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(s)) return true;
                if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(s)) return false;
                return defaultValue;
            };

            const enabled = parseLooseBoolean(borica.enabled, false);
            const modeRaw = (borica.mode || '').toString().trim().toLowerCase();
            const mode = (modeRaw === 'prod' || modeRaw === 'production') ? 'prod' : 'test';
            const debugMode = borica.debugMode !== undefined ? parseLooseBoolean(borica.debugMode, (mode === 'test')) : (mode === 'test');
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

        if (printer !== undefined) {
            const normalized = normalizePrinterConfig(printer);
            if (!normalized.ok) {
                return res.status(400).json({ error: normalized.error || 'Invalid printer configuration' });
            }
            db.restaurants[idx].printer = normalized.value;
        }

        if (writeDatabase(db)) {
            const orderPlacedTpl = getEffectiveOrderPlacedTemplate(db.restaurants[idx]);
            const printerNormalized = normalizePrinterConfig(db.restaurants[idx].printer);
            res.json({
                id: db.restaurants[idx].id,
                name: db.restaurants[idx].name,
                email: db.restaurants[idx].email || '',
                orderNotificationEmail: db.restaurants[idx].orderNotificationEmail || '',
                printer: printerNormalized.ok ? printerNormalized.value : { enabled: false, ip: '', port: 9100, autoPrintOnApproved: true, printPickup: true, allowAutoDiscovery: false },
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

        function triggerAutoApprovedSideEffects(order, restaurant, eurToBgnRate) {
            setImmediate(() => {
                try {
                    const printerNormalized = normalizePrinterConfig(restaurant?.printer);
                    const printerCfg = printerNormalized.ok
                        ? printerNormalized.value
                        : { enabled: false, ip: '', port: 9100, autoPrintOnApproved: true, printPickup: true, allowAutoDiscovery: false };

                    const method = (order.deliveryMethod || order.deliveryType || '').toString();
                    const isPickup = method === 'pickup';
                    const hasTargetPrinter = !!printerCfg.ip || printerCfg.allowAutoDiscovery;
                    const shouldPrint = printerCfg.enabled && printerCfg.autoPrintOnApproved && hasTargetPrinter && (!isPickup || printerCfg.printPickup);

                    if (shouldPrint) {
                        const printerTarget = printerCfg.ip ? { ip: printerCfg.ip, port: printerCfg.port } : null;
                        printOrder(order, printerTarget)
                            .then(printResult => {
                                if (printResult.success) {
                                    console.log('Card payment order auto-approved and printed successfully to:', printResult.printer);
                                } else {
                                    console.error('Card payment auto-approved order print failed:', printResult.error);
                                }
                            })
                            .catch(err => console.error('Card payment auto-approved order print error:', err));
                    }

                    try {
                        sendOrderStatusEmail(order, 'approved')
                            .then(() => console.log('[EMAIL] card auto-approved order email attempted:', order.id))
                            .catch(err => console.error('[EMAIL] card auto-approved order email failed:', err));
                    } catch (e) {
                        console.error('[EMAIL] card auto-approved order email error:', e);
                    }
                } catch (e) {
                    console.error('Error processing card auto-approved order side-effects:', e);
                }
            });

            if ((order.deliveryMethod || order.deliveryType) === 'delivery') {
                setImmediate(() => {
                    (async () => {
                        try {
                            const deliveryResult = await sendToDeliveryService(order, { eurToBgnRate });

                            if (!deliveryResult.success) {
                                console.error('Failed to send card auto-approved order to delivery service:', deliveryResult.error);
                                return;
                            }

                            const db2 = readDatabase();
                            const idx = (db2.orders || []).findIndex(o => o && o.id === order.id);
                            if (idx === -1) return;

                            db2.orders[idx].deliveryServiceId = deliveryResult.deliveryId;
                            db2.orders[idx].deliveryClientId = deliveryResult.clientId;
                            db2.orders[idx].updatedAt = new Date().toISOString();
                            writeDatabase(db2);
                        } catch (err) {
                            console.error('Card auto-approved delivery service error:', err);
                        }
                    })();
                });
            }
        }

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
            const eurToBgnRate = db?.currencySettings?.eurToBgnRate;
            const autoApproveCardPayments = db.orderSettings?.autoApproveCardPayments !== false;

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

            const statusBeforePayment = (order.status || '').toString();

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
                order.paymentMethod = 'card';
                order.paymentStatus = 'paid';
                const nowIso = new Date().toISOString();
                if (autoApproveCardPayments) {
                    if (order.status === 'pending_payment' || order.status === 'pending') {
                        order.status = 'approved';
                        order.approvedAt = order.approvedAt || nowIso;
                        order.updatedAt = nowIso;
                    }
                } else if (order.status === 'pending_payment') {
                    order.status = 'pending';
                    order.updatedAt = nowIso;
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

                const transitionedToApproved = autoApproveCardPayments && statusBeforePayment !== 'approved' && order.status === 'approved';
                if (transitionedToApproved) {
                    triggerAutoApprovedSideEffects(order, restaurant, eurToBgnRate);
                }
            } else {
                const actionLower = ACTION.toString().trim().toLowerCase();
                const cancelled = RC === '17' || actionLower === 'cancel' || actionLower === 'canceled' || actionLower === 'cancelled';
                order.payment.status = cancelled ? 'cancelled' : 'failed';
                order.paymentMethod = 'card';
                order.paymentStatus = order.payment.status;
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
        const eurToBgnRate = db?.currencySettings?.eurToBgnRate;
        const autoApproveCardPayments = db.orderSettings?.autoApproveCardPayments !== false;

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
        const statusBeforePayment = (order.status || '').toString();
        order.payment = order.payment || { method: 'card', provider: 'borica' };
        order.payment.lastResponseCode = responseCode;
        order.payment.lastResponseAt = new Date().toISOString();

        const success = responseCode === '00';
        if (success) {
            order.payment.status = 'paid';
            order.payment.paidAt = new Date().toISOString();
            order.paymentMethod = 'card';
            order.paymentStatus = 'paid';
            const nowIso = new Date().toISOString();
            if (autoApproveCardPayments) {
                if (order.status === 'pending_payment' || order.status === 'pending') {
                    order.status = 'approved';
                    order.approvedAt = order.approvedAt || nowIso;
                    order.updatedAt = nowIso;
                }
            } else if (order.status === 'pending_payment') {
                order.status = 'pending';
                order.updatedAt = nowIso;
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

            const transitionedToApproved = autoApproveCardPayments && statusBeforePayment !== 'approved' && order.status === 'approved';
            if (transitionedToApproved) {
                triggerAutoApprovedSideEffects(order, restaurant, eurToBgnRate);
            }
        } else {
            order.payment.status = responseCode === '17' ? 'cancelled' : 'failed';
            order.paymentMethod = 'card';
            order.paymentStatus = order.payment.status;
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

// Middleware to allow either Bearer token or x-api-key.
function requireAuthOrApiKey(req, res, next) {
    const rawAuth = (req.headers.authorization || '').toString();
    const bearerToken = rawAuth.startsWith('Bearer ') ? rawAuth.slice('Bearer '.length).trim() : '';

    if (bearerToken && activeTokens.has(bearerToken)) {
        const tokenData = activeTokens.get(bearerToken);
        req.restaurantId = tokenData.restaurantId;
        req.username = tokenData.username;
        return next();
    }

    const apiKey = (req.headers['x-api-key'] || '').toString();
    if (apiKey) {
        const restaurant = getRestaurantByApiKey(apiKey);
        if (restaurant && restaurant.active) {
            req.restaurantId = restaurant.id;
            req.restaurantName = restaurant.name;
            return next();
        }
    }

    return res.status(401).json({
        error: 'Unauthorized',
        message: 'Please login (Bearer token) or provide API key'
    });
}

function looksLikeIPv4(value) {
    const s = (value || '').toString().trim();
    if (!s) return false;
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s)) return false;
    const parts = s.split('.').map(n => Number(n));
    return parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
}

function normalizePrinterConfig(input) {
    const src = (input && typeof input === 'object') ? input : {};
    const enabled = src.enabled !== undefined ? !!src.enabled : false;
    const ip = (src.ip || src.host || src.printerIp || '').toString().trim();
    const port = Math.max(1, Math.min(65535, parseInt(src.port || 9100, 10) || 9100));
    const autoPrintOnApproved = src.autoPrintOnApproved !== undefined ? !!src.autoPrintOnApproved : true;
    const printPickup = src.printPickup !== undefined ? !!src.printPickup : true;
    const allowAutoDiscovery = src.allowAutoDiscovery !== undefined ? !!src.allowAutoDiscovery : false;

    if (ip && !looksLikeIPv4(ip)) {
        return { ok: false, error: 'Invalid printer IP address' };
    }

    return {
        ok: true,
        value: {
            enabled,
            ip,
            port,
            autoPrintOnApproved,
            printPickup,
            allowAutoDiscovery
        }
    };
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

// Supports either:
// - Resend (preferred): RESEND_API_KEY + RESEND_FROM
// - SMTP fallback: SMTP_* env vars (nodemailer)

let mailTransport = null;

let cachedSmtpCreds = null;

let cachedResendClient = null;
let cachedResendClientLoadAttempted = false;
let cachedResendClientLoadError = null;

const RESEND_MIN_NODE_MAJOR = 20;

function getNodeMajorVersion() {
    const raw = (process.versions && process.versions.node) ? String(process.versions.node) : '';
    const major = parseInt(raw.split('.')[0] || '0', 10);
    return Number.isFinite(major) ? major : 0;
}

function isNodeAtLeast(major) {
    return getNodeMajorVersion() >= major;
}

function isResendEmailEnabled() {
    const apiKey = (process.env.RESEND_API_KEY || '').toString().trim();
    const from = (process.env.RESEND_FROM || '').toString().trim();
    return !!(apiKey && from);
}

function getResendClient() {
    if (!isResendEmailEnabled()) return null;
    if (cachedResendClient) return cachedResendClient;

    // Avoid spamming logs by retrying on every request.
    if (cachedResendClientLoadAttempted) return null;

    cachedResendClientLoadAttempted = true;

    // Resend SDK requires Node >= 20 (per package.json engines).
    if (!isNodeAtLeast(RESEND_MIN_NODE_MAJOR)) {
        cachedResendClientLoadError = `Resend requires Node >= ${RESEND_MIN_NODE_MAJOR} (current: ${process.versions.node})`;
        console.warn('[EMAIL] Resend disabled:', cachedResendClientLoadError);
        return null;
    }

    // Lazy-require so environments without Resend (or older Node) don't crash at startup.
    try {
        const { Resend } = require('resend');
        const apiKey = (process.env.RESEND_API_KEY || '').toString().trim();
        cachedResendClient = new Resend(apiKey);
        cachedResendClientLoadError = null;
        return cachedResendClient;
    } catch (e) {
        cachedResendClientLoadError = e?.message || String(e);
        console.error('[EMAIL] Resend SDK not available:', cachedResendClientLoadError);
        return null;
    }
}

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

function isSmtpEmailEnabled() {
    const host = (process.env.SMTP_HOST || '').toString().trim();
    const from = (process.env.SMTP_FROM || '').toString().trim();
    const creds = loadSmtpCredentials();
    return !!(nodemailer && host && from && creds.user && creds.pass);
}

function isEmailEnabled() {
    return isResendEmailEnabled() || isSmtpEmailEnabled();
}

function getEmailProvider() {
    // Prefer Resend when configured.
    if (isResendEmailEnabled() && getResendClient()) return 'resend';
    if (isSmtpEmailEnabled()) return 'smtp';
    return null;
}

function getEmailDiagnostics() {
    const resendApiKey = (process.env.RESEND_API_KEY || '').toString().trim();
    const resendFrom = (process.env.RESEND_FROM || '').toString().trim();
    const resendReplyTo = (process.env.RESEND_REPLY_TO || '').toString().trim();
    const resendRegion = (process.env.RESEND_REGION || '').toString().trim();

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

    const missingSmtp = [];
    if (!nodemailer) missingSmtp.push('nodemailer');
    if (!host) missingSmtp.push('SMTP_HOST');
    if (!from) missingSmtp.push('SMTP_FROM');
    if (!creds.user) missingSmtp.push('SMTP_USER (or credentials file user=)');
    if (!creds.pass) missingSmtp.push('SMTP_PASS (or credentials file pass=)');

    const missingResend = [];
    if (!resendApiKey) missingResend.push('RESEND_API_KEY');
    if (!resendFrom) missingResend.push('RESEND_FROM');

    const resendConfigured = !!(resendApiKey && resendFrom);
    const resendNodeOk = isNodeAtLeast(RESEND_MIN_NODE_MAJOR);
    const resendSdkLoaded = !!getResendClient();

    if (resendConfigured && !resendNodeOk) {
        missingResend.push(`Node >= ${RESEND_MIN_NODE_MAJOR} (required for Resend SDK)`);
    }
    if (resendConfigured && resendNodeOk && !resendSdkLoaded) {
        missingResend.push('Resend SDK load failed');
    }

    const credsSource = (directUser && directPass)
        ? 'env'
        : (credsFile ? (credsFileExists ? 'file' : 'file_missing') : 'missing');

    const provider = getEmailProvider() || 'disabled';
    const enabled = provider !== 'disabled';
    const missing = enabled ? [] : Array.from(new Set([...missingResend, ...missingSmtp]));

    return {
        enabled,
        provider,
        missing,

        resend: {
            apiKeyPresent: !!resendApiKey,
            from: resendFrom || null,
            replyTo: resendReplyTo || null,
            region: resendRegion || null,
            sdkLoaded: resendSdkLoaded,
            sdkError: cachedResendClientLoadError,
            nodeVersion: (process.versions && process.versions.node) ? String(process.versions.node) : null,
            minNodeMajor: RESEND_MIN_NODE_MAJOR,
            nodeVersionOk: resendNodeOk
        },

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
    if (!isSmtpEmailEnabled()) return null;
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
    const provider = getEmailProvider();
    if (!provider) {
        const diag = getEmailDiagnostics();
        console.log('[EMAIL] Disabled or missing email config; skipping email to:', to, 'missing:', diag.missing);
        return { skipped: true };
    }

    if (!to || !isValidEmail(to)) {
        console.log('[EMAIL] Invalid recipient; skipping email to:', to);
        return { skipped: true };
    }

    if (provider === 'resend') {
        const resend = getResendClient();
        if (!resend) {
            console.log('[EMAIL] Resend not available; skipping email to:', to);
            return { skipped: true };
        }

        const from = (process.env.RESEND_FROM || '').toString().trim();
        const finalReplyTo = (replyTo || process.env.RESEND_REPLY_TO || '').toString().trim();
        const region = (process.env.RESEND_REGION || '').toString().trim();

        try {
            const { data, error } = await resend.emails.send({
                from,
                to,
                subject: (subject || '').toString(),
                ...(text ? { text: String(text) } : {}),
                ...(html ? { html: String(html) } : {}),
                ...(finalReplyTo ? { replyTo: finalReplyTo } : {}),
                ...(region ? { region } : {})
            });

            if (error) {
                return {
                    success: false,
                    error: error?.message || 'Resend error',
                    code: error?.name,
                    response: error
                };
            }

            return {
                success: true,
                provider: 'resend',
                messageId: data?.id
            };
        } catch (err) {
            console.error('[EMAIL] Resend send failed:', err);
            return {
                success: false,
                error: err?.message || String(err)
            };
        }
    }

    const transport = getMailTransport();
    if (!transport) {
        const diag = getEmailDiagnostics();
        console.log('[EMAIL] SMTP disabled or missing config; skipping email to:', to, 'missing:', diag.missing);
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
            provider: 'smtp',
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
            provider: 'smtp',
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
            return res.status(400).json({ success: false, diagnostics: diag, error: 'Email is not enabled (missing provider config)' });
        }

        const to = (req.body?.to || req.restaurantEmail || '').toString().trim();
        if (!to || !isValidEmail(to)) {
            return res.status(400).json({ success: false, diagnostics: diag, error: 'Valid "to" email is required' });
        }

        const provider = diag.provider || getEmailProvider() || 'disabled';
        let verifyResult = null;
        if (provider === 'smtp') {
            const transport = getMailTransport();
            try {
                verifyResult = await transport.verify();
            } catch (e) {
                return res.status(500).json({ success: false, diagnostics: diag, stage: 'verify', error: e?.message || String(e), code: e?.code, response: e?.response });
            }
        }

        const sendResult = await sendEmail({
            to,
            subject: `${provider === 'resend' ? 'Resend' : 'SMTP'} test (${new Date().toISOString()})`,
            text: `This is a test email from ${req.restaurantName || 'restaurant-backend'}\nProvider: ${provider}`
        });

        res.json({ success: !!sendResult?.success, verify: verifyResult, send: sendResult, diagnostics: diag });
    } catch (e) {
        res.status(500).json({ success: false, error: e?.message || 'Failed to send test email' });
    }
});

// POST body: { to: string, subject: string, text: string }
app.post(API_PREFIX + '/email/send', requireAuth, async (req, res) => {
    try {
        const diag = getEmailDiagnostics();
        if (!diag.enabled) {
            return res.status(400).json({ success: false, diagnostics: diag, error: 'Email is not enabled (missing provider config)' });
        }

        const to = (req.body?.to || '').toString().trim();
        const subject = (req.body?.subject || '').toString().trim();
        const text = (req.body?.text || '').toString();

        if (!to || !isValidEmail(to)) {
            return res.status(400).json({ success: false, diagnostics: diag, error: 'Valid "to" email is required' });
        }

        if (!subject) {
            return res.status(400).json({ success: false, diagnostics: diag, error: 'Subject is required' });
        }

        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, diagnostics: diag, error: 'Message body is required' });
        }

        // Verify SMTP transport once (catches auth/TLS issues early). Not applicable for Resend.
        const provider = diag.provider || getEmailProvider() || 'disabled';
        if (provider === 'smtp') {
            const transport = getMailTransport();
            try {
                await transport.verify();
            } catch (e) {
                return res.status(500).json({ success: false, diagnostics: diag, stage: 'verify', error: e?.message || String(e), code: e?.code, response: e?.response });
            }
        }

        const sendResult = await sendEmail({
            to,
            subject,
            text
        });

        if (!sendResult?.success) {
            return res.status(500).json({ success: false, diagnostics: diag, ...sendResult });
        }

        return res.json({ success: true, provider: sendResult.provider || provider, messageId: sendResult.messageId, accepted: sendResult.accepted, rejected: sendResult.rejected, diagnostics: diag });
    } catch (e) {
        return res.status(500).json({ success: false, error: e?.message || 'Failed to send email' });
    }
});

function getRestaurantNotificationEmail(restaurant) {
    const email = (restaurant?.orderNotificationEmail || restaurant?.email || '').toString().trim();
    return isValidEmail(email) ? email : '';
}

function formatOrderItemsText(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (items.length === 0) return '(Няма артикули)';

    // Plain-text alignment (best-effort; email clients differ).
    const qtyCol = 6;
    const nameCol = 38;
    const priceCol = 12;

    return items
        .map(it => {
            const unit = parseNumber(it?.price, 0);
            const qty = Math.max(0, parseNumber(it?.quantity, 0));
            const lineTotal = roundMoneyEUR(unit * qty);

            const qtyText = `${qty}x`;
            const nameText = (it?.name || '').toString().trim();
            const priceText = formatMoneyEUR(lineTotal);

            const line = `${qtyText.padEnd(qtyCol)}${nameText.padEnd(nameCol)}${priceText.padStart(priceCol)}`;

            const note = (it?.note || it?.notes || '').toString().replace(/\r/g, '').trim();
            if (!note) return line;
            return `${line}\n${' '.repeat(qtyCol)}Бележка: ${note}`;
        })
        .join('\n');
}

function formatOrderTotalsText(order) {
    const subtotalNum = Math.max(0, parseNumber(order?.subtotal, 0));
    const discountAmountNum = Math.max(0, parseNumber(order?.discountAmount, 0));
    const intermediateSubtotalNum = Math.max(0, parseNumber(
        order?.intermediateSubtotal,
        Math.max(0, subtotalNum - discountAmountNum)
    ));
    const deliveryFeeNum = Math.max(0, parseNumber(order?.deliveryFee, 0));
    const totalNum = Math.max(0, parseNumber(order?.total, 0));
    const isDelivery = order?.deliveryMethod === 'delivery';

    // Match checkout ordering: Subtotal, Discount, Intermediate subtotal, Delivery (if applicable), Total.
    const labelCol = 34;
    const lines = [];

    if (subtotalNum > 0) {
        lines.push(`${'Сума:'.padEnd(labelCol)}${formatMoneyEUR(subtotalNum)}`);
    }
    if (discountAmountNum > 0) {
        lines.push(`${'Отстъпка:'.padEnd(labelCol)}-${formatMoneyEUR(discountAmountNum)}`);
        lines.push(`${'Междинна сума:'.padEnd(labelCol)}${formatMoneyEUR(intermediateSubtotalNum)}`);
    }
    if (isDelivery) {
        lines.push(`${'Доставка:'.padEnd(labelCol)}${formatMoneyEUR(deliveryFeeNum)}`);
    }
    lines.push(`${'Общо:'.padEnd(labelCol)}${formatMoneyEUR(totalNum)}`);
    return lines.join('\n');
}

function looksLikePlaceholderEmailTemplateText(text) {
    const t = (text || '').toString().trim().toLowerCase();
    if (!t) return true;
    if (t === 'assdasdasdasd' || t === 'asdasdasdasd' || t === 'asdasd' || t === 'asd') return true;
    // Common keyboard-smash placeholders (kept conservative to avoid overriding real templates).
    if (t.length <= 40 && /^[asd]+$/.test(t)) return true;
    return false;
}

function getDefaultOrderPlacedTemplate() {
    return {
        subject: 'Поръчка - {{orderId}} - успешно направена.',
        body: [
            'Здравейте {{customerName}},',
            '',
            'Получихме Вашата поръчка.',
            '{{fulfillmentTimeLine}}',
            'Номер: {{orderId}}',
            '{{deliveryText}}',
            '',
            'Артикули:',
            '{{itemsText}}',
            '',
            '{{totalsText}}',
            '{{promoText}}',
            '{{orderNoteText}}',
            '{{trackUrlLine}}',
            '',
            'Благодарим Ви!'
        ].join('\n')
    };
}

function getEffectiveOrderPlacedTemplate(restaurant) {
    const tpl = restaurant?.emailTemplates?.orderPlaced || {};
    const subject = (tpl.subject || '').toString().trim();
    const body = (tpl.body || '').toString().trim();

    const defaults = getDefaultOrderPlacedTemplate();
    const effectiveSubject = (!subject || looksLikePlaceholderEmailTemplateText(subject)) ? defaults.subject : subject;
    const effectiveBody = looksLikePlaceholderEmailTemplateText(body) ? defaults.body : body;

    return {
        subject: effectiveSubject,
        body: effectiveBody
    };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMoneyBGN(value) {
    return `${parseNumber(value, 0).toFixed(2)} лв`;
}

function roundMoneyEUR(value) {
    const n = parseNumber(value, 0);
    // Stabilize common floating-point edge cases (e.g. 20.985 -> 20.99)
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatMoneyEUR(value) {
    return `${roundMoneyEUR(value).toFixed(2)} €`;
}

// Email formatting: keep currency symbol (users expect it in the email).
function formatMoneyEmail(value) {
    return formatMoneyEUR(value);
}

function computeItemsPromoSavingsEUR(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const savings = items.reduce((acc, it) => {
        const qty = Math.max(0, parseNumber(it?.quantity, 0));
        const price = Math.max(0, parseNumber(it?.price, 0));
        const originalPrice = parseNumber(it?.originalPrice, NaN);
        if (!Number.isFinite(originalPrice) || originalPrice <= price) return acc;
        return acc + ((originalPrice - price) * qty);
    }, 0);
    return roundMoneyEUR(savings);
}

function getDeliverySummaryText(order) {
    return order?.deliveryMethod === 'delivery'
        ? `Доставка до: ${(order?.customerInfo?.city || '').toString().trim()} ${(order?.customerInfo?.address || '').toString().trim()}`.trim()
        : 'Взимане от място';
}

function getFulfillmentTimeHeader(order) {
    const method = (order?.deliveryMethod || order?.deliveryType || '').toString();
    const isDelivery = method === 'delivery';
    const scheduledRaw = (order?.scheduledTime ?? order?.scheduled_time ?? order?.scheduleTime ?? '').toString().trim();
    const scheduledMatch = scheduledRaw.match(/(\d{1,2}:\d{2})/);
    const scheduledHHMM = scheduledMatch ? scheduledMatch[1].padStart(5, '0') : '';
    const isLater = (order?.orderTime || '').toString().toLowerCase() === 'later' || !!scheduledHHMM;

    if (isLater && scheduledHHMM) {
        return {
            label: isDelivery ? 'Доставка за' : 'Взимане за',
            value: scheduledHHMM
        };
    }

    const estMin = Number(order?.estimatedTime);
    const minutes = Number.isFinite(estMin) && estMin > 0 ? Math.round(estMin) : 60;
    return {
        label: isDelivery ? 'Очаквана доставка след' : 'Готово за взимане след',
        value: `${minutes} мин`
    };
}

function formatOrderItemsHtml(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (items.length === 0) return '<p>(Няма артикули)</p>';

    const rows = items.map((it) => {
        const name = escapeHtml(it?.name || '');
        const note = (it?.note || it?.notes || '').toString().replace(/\r/g, '').trim();
        const discountLabelRaw = (it?.discountLabel || it?.discount_label || '').toString().replace(/\r/g, '').trim();
        const discountLabel = discountLabelRaw ? discountLabelRaw.slice(0, 80) : '';
        const qty = parseNumber(it?.quantity, 0);
        const price = parseNumber(it?.price, 0);
        const originalPrice = parseNumber(it?.originalPrice, NaN);
        const hasItemPromo = Number.isFinite(originalPrice) && originalPrice > price;

        const lineTotal = roundMoneyEUR(Math.max(0, qty) * Math.max(0, price));
        const lineTotalText = formatMoneyEUR(lineTotal);

        return `
            <tr>
                <td style="padding:6px 0; vertical-align:top;">
                    <table style="width:100%; border-collapse:collapse;">
                        <tr>
                            <td style="padding:0 10px 0 0; vertical-align:top; font-weight:800;"><strong>${escapeHtml(qty)}x</strong>&nbsp;&nbsp;${name}</td>
                            <td style="padding:0; width:110px; text-align:right; white-space:nowrap; vertical-align:top; font-weight:900;">${escapeHtml(lineTotalText)}</td>
                        </tr>
                    </table>
                    ${(discountLabel || hasItemPromo) ? `<div style="margin-top:4px; font-size:13px;"><strong>Промо:</strong> ${escapeHtml(discountLabel || 'Промо')}</div>` : ''}
                    ${note ? `<div style="margin-top:4px; color:#c62828; font-size:13px; font-weight:700;">Бележка: ${escapeHtml(note)}</div>` : ''}
                </td>
            </tr>`;
    }).join('');

    return `
        <table style="width:100%; border-collapse:collapse;">
            <tbody>${rows}</tbody>
        </table>`;
}

function buildOrderPlacedCustomerEmailHtml(order, restaurant, trackUrl, contactPhone) {
    const restaurantName = escapeHtml((process.env.RESTAURANT_NAME || restaurant?.name || order?.restaurantName || 'Ресторант').toString());
    const orderId = escapeHtml(order?.id || '');
    const customerName = escapeHtml(order?.customerInfo?.name || '');
    const deliverySummary = escapeHtml(getDeliverySummaryText(order));
    const subtotalNum = Math.max(0, parseNumber(order?.subtotal, 0));
    const discountAmountNum = Math.max(0, parseNumber(order?.discountAmount, 0));
    const intermediateSubtotalNum = Math.max(0, parseNumber(
        order?.intermediateSubtotal,
        Math.max(0, subtotalNum - discountAmountNum)
    ));
    const deliveryFeeNum = Math.max(0, parseNumber(order?.deliveryFee, 0));
    const itemsSavingsNum = computeItemsPromoSavingsEUR(order);
    const totalSavingsNum = roundMoneyEUR(discountAmountNum + itemsSavingsNum);
    const total = escapeHtml(formatMoneyEUR(order?.total));
    const paymentMethod = escapeHtml((order?.payment?.method || order?.paymentMethod || '').toString());
    const fulfillment = getFulfillmentTimeHeader(order);
    const promoCode = (order?.promoCode || '').toString().trim();
    const discountPct = Math.max(0, Math.min(100, parseNumber(order?.discount, 0)));
    const orderNote = (order?.customerInfo?.notes || '').toString().replace(/\r/g, '').trim();
    const phone = (contactPhone || '').toString().trim();

    const trackBlock = trackUrl
        ? `<p style="margin:16px 0;">Проследяване: <a href="${escapeHtml(trackUrl)}">${escapeHtml(trackUrl)}</a></p>`
        : '';

    const paymentBlock = paymentMethod
        ? `<p style="margin:6px 0;">Начин на плащане: <strong>${paymentMethod}</strong></p>`
        : '';

    const promoBlock = promoCode
        ? `<p style="margin:6px 0; text-align:right;">Промо код: <strong>${escapeHtml(promoCode)}</strong>${discountPct ? ` (-${escapeHtml(discountPct)}%)` : ''}</p>`
        : '';

    const savingsBlock = totalSavingsNum > 0
        ? `<p style="margin:6px 0; text-align:right;">Спестявате: <strong>${escapeHtml(formatMoneyEUR(totalSavingsNum))}</strong></p>`
        : '';

    const isDelivery = order?.deliveryMethod === 'delivery';
    const totalsBlock = `
        <table style="margin:16px 0 0 auto; border-collapse:collapse; width:auto;">
            ${(subtotalNum > 0) ? `
            <tr>
                <td style="padding:4px 0; text-align:right; color:#374151;">Сума:</td>
                <td style="padding:4px 0 4px 16px; text-align:right; font-weight:800; white-space:nowrap;">${escapeHtml(formatMoneyEUR(subtotalNum))}</td>
            </tr>` : ''}
            ${(discountAmountNum > 0) ? `
            <tr>
                <td style="padding:4px 0; text-align:right; color:#374151;">Отстъпка:</td>
                <td style="padding:4px 0 4px 16px; text-align:right; font-weight:800; white-space:nowrap;">-${escapeHtml(formatMoneyEUR(discountAmountNum))}</td>
            </tr>
            <tr>
                <td style="padding:4px 0; text-align:right; color:#374151;">Междинна сума:</td>
                <td style="padding:4px 0 4px 16px; text-align:right; font-weight:800; white-space:nowrap;">${escapeHtml(formatMoneyEUR(intermediateSubtotalNum))}</td>
            </tr>` : ''}
            ${isDelivery ? `
            <tr>
                <td style="padding:4px 0; text-align:right; color:#374151;">Доставка:</td>
                <td style="padding:4px 0 4px 16px; text-align:right; font-weight:800; white-space:nowrap;">${escapeHtml(formatMoneyEUR(deliveryFeeNum))}</td>
            </tr>` : ''}
            <tr>
                <td style="padding:6px 0; text-align:right; color:#111827; font-size:16px; font-weight:900;">Общо:</td>
                <td style="padding:6px 0 6px 16px; text-align:right; font-size:16px; font-weight:900; white-space:nowrap;">${total}</td>
            </tr>
        </table>
    `;

    const orderNoteBlock = orderNote
        ? `<div style="margin:16px 0 0 0; padding: 12px; border: 1px solid #f0b4b4; border-radius: 10px; background: #fff5f5;">
            <div style="font-weight:800; color:#c62828; margin-bottom:6px;">Бележка към поръчката</div>
            <div style="color:#c62828; font-weight:700; white-space: pre-line;">${escapeHtml(orderNote)}</div>
          </div>`
        : '';

        const contactBlock = phone
                ? `<p style="margin:16px 0 0 0;">
                        <a href="tel:${encodeURIComponent(phone)}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#111827; color:#ffffff; text-decoration:none; font-weight:800;">Обади се на ресторанта</a>
                    </p>`
                : '';

    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2 style="margin:0 0 12px 0;">${restaurantName}</h2>
            <p style="margin:0 0 12px 0;">Здравейте${customerName ? `, <strong>${customerName}</strong>` : ''},</p>
            <p style="margin:0 0 12px 0;">Получихме Вашата поръчка.</p>

            <div style="margin:12px 0 14px 0; padding: 14px; border-radius: 12px; background: #f3f4f6;">
                <div style="font-size: 14px; color:#374151; font-weight: 800;">${escapeHtml(fulfillment.label)}</div>
                <div style="font-size: 28px; color:#111827; font-weight: 900; margin-top: 2px;">${escapeHtml(fulfillment.value)}</div>
            </div>

            <p style="margin:6px 0;">Номер: <strong>${orderId}</strong></p>
            <p style="margin:6px 0;">${deliverySummary}</p>
            ${paymentBlock}

            <h3 style="margin:18px 0 8px 0;">Артикули</h3>
            ${formatOrderItemsHtml(order)}

            ${(promoBlock || savingsBlock) ? `
                <div style="margin:12px 0 0 0; padding: 12px; border-radius: 10px; background: #f9fafb; text-align:right;">
                    ${promoBlock}
                    ${savingsBlock}
                </div>
            ` : ''}

            ${orderNoteBlock}
            ${totalsBlock}
            ${trackBlock}
            ${contactBlock}

            <p style="margin:20px 0 0 0;">Благодарим Ви!</p>
        </div>`;
}

function getPublicOrderTrackUrl(orderId) {
    const base = (process.env.PUBLIC_BASE_URL || '').toString().trim().replace(/\/$/, '');
    if (!base) return '';

    // PUBLIC_BASE_PATH controls how links are rendered to the outside world.
    // This allows nginx to expose the app at '/' (e.g. https://restaurant-lauta.bg/checkout)
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
    const db = readDatabase();
    const contactPhone = (db?.siteSettings?.footer?.contacts?.phone || '').toString().trim();
    const trackUrl = getPublicOrderTrackUrl(order.id);
    const customerTo = (order.customerInfo?.email || '').toString().trim();

    const itemsText = formatOrderItemsText(order);
    const totalText = `Общо: ${formatMoneyEUR(order.total)}`;
    const totalsText = formatOrderTotalsText(order);
    const deliveryText = getDeliverySummaryText(order);
    const fulfillment = getFulfillmentTimeHeader(order);
    const promoCode = (order?.promoCode || '').toString().trim();
    const discountPct = Math.max(0, Math.min(100, parseNumber(order?.discount, 0)));
    const subtotalNum = Math.max(0, parseNumber(order?.subtotal, 0));
    const discountAmountNum = Math.max(0, parseNumber(order?.discountAmount, 0));
    const intermediateSubtotalNum = Math.max(0, parseNumber(
        order?.intermediateSubtotal,
        Math.max(0, subtotalNum - discountAmountNum)
    ));
    const deliveryFeeNum = Math.max(0, parseNumber(order?.deliveryFee, 0));
    const totalNum = Math.max(0, parseNumber(order?.total, 0));
    const promoText = promoCode ? `Промо код: ${promoCode}${discountPct ? ` (-${discountPct}%)` : ''}` : '';
    const orderNote = (order?.customerInfo?.notes || '').toString().replace(/\r/g, '').trim();
    const orderNoteText = orderNote ? `Бележка към поръчката: ${orderNote}` : '';

    const templateVars = {
        orderId: order.id,
        deliveryMethod: order.deliveryMethod,
        customerName: order.customerInfo?.name || '',
        customerPhone: order.customerInfo?.phone || '',
        customerEmail: order.customerInfo?.email || '',
        currency: (order.currency || 'EUR').toString(),
        itemsText,
        totalText,
        totalsText,
        subtotal: subtotalNum,
        discountPercent: discountPct,
        discountAmount: discountAmountNum,
        intermediateSubtotal: intermediateSubtotalNum,
        deliveryFee: deliveryFeeNum,
        total: totalNum,
        subtotalText: formatMoneyEUR(subtotalNum),
        discountAmountText: formatMoneyEUR(discountAmountNum),
        intermediateSubtotalText: formatMoneyEUR(intermediateSubtotalNum),
        deliveryFeeText: formatMoneyEUR(deliveryFeeNum),
        totalAmountText: formatMoneyEUR(totalNum),
        deliveryText,
        fulfillmentTimeLine: `${fulfillment.label}: ${fulfillment.value}`,
        promoText,
        orderNoteText,
        trackUrl,
        trackUrlLine: trackUrl ? `Проследяване: ${trackUrl}` : ''
    };

    const tpl = getEffectiveOrderPlacedTemplate(restaurant);
    const subjectCustomer = (tpl.subject || '').toString().trim() || `Поръчка - ${order.id} - успешно направена.`;
    const bodyCustomer = (tpl.body || '').toString().trim() || getDefaultOrderPlacedTemplate().body;

    const customerText = renderTemplateText(bodyCustomer, templateVars);
    const finalSubjectCustomer = renderTemplateText(subjectCustomer, templateVars);

    let customerHtml = '';
    try {
        customerHtml = buildOrderPlacedCustomerEmailHtml(order, restaurant, trackUrl, contactPhone);
    } catch (e) {
        console.error('[EMAIL] buildOrderPlacedCustomerEmailHtml failed; falling back to text-only:', e);
        customerHtml = '';
    }

    // Customer email
    const sendResult = await sendEmail({
        to: customerTo,
        subject: finalSubjectCustomer,
        text: customerText,
        html: customerHtml
    });

    if (sendResult && sendResult.success === false) {
        console.error('[EMAIL] customer order placed email failed:', { orderId: order?.id, to: customerTo, error: sendResult.error, code: sendResult.code, response: sendResult.response });
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

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>Поръчката Ви <strong>${escapeHtml(order.id)}</strong> е одобрена.</p>
            <p>${escapeHtml(order.deliveryMethod === 'delivery' ? 'Очаквайте доставка скоро.' : 'Поръчката ще бъде готова за взимане.')}</p>
            ${trackUrl ? `<p>Проследяване: <a href="${escapeHtml(trackUrl)}">${escapeHtml(trackUrl)}</a></p>` : ''}
        </div>`;

    await sendEmail({ to: customerTo, subject, text, html });
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

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>${escapeHtml(firstLine)}</p>
            ${trackUrl ? `<p>Проследяване: <a href="${escapeHtml(trackUrl)}">${escapeHtml(trackUrl)}</a></p>` : ''}
        </div>`;

    await sendEmail({ to: customerTo, subject, text, html });
}

// Get all products (public route)
app.get(API_PREFIX + '/products', (req, res) => {
    const db = readDatabase();
    res.json(db.products);
});

// Download product import template (XLSX)
// Matches the commonly used customer file layout (two header rows).
app.get(API_PREFIX + '/products/template-xlsx', requireAuth, (req, res) => {
    try {
        const row0 = ['', '', '', '', '', '', '', '', '', '', '', '', 'Снимки / линк', 'Описание', '', ''];
        const row1 = [
            'ID',
            'CODE',
            'Име',
            'Name',
            'Категория',
            'Category',
            'Subcategory',
            'Price',
            'Promo Price',
            'Promo %',
            'Is promo',
            'available',
            'Img / URL',
            'Описание',
            'Description',
            'Weight/Quantity'
        ];
        const example = [
            '1',
            'PIZZA_MARGHERITA',
            'Шопска салата 300гр.',
            'Shopska salad 300g',
            'Салати',
            'Salads',
            'Салата',
            '7.60 €',
            '6.80 €',
            '10',
            '1',
            '1',
            '',
            'домат, краставица, лук, чушка, сирене, маслини',
            'tomato, cucumber, onion, pepper, cheese, olives',
            '300 g'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([row0, row1, example]);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const fileName = 'Асортимент- доставка.xlsx';
        const fileNameStar = encodeURIComponent(fileName);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="products-template.xlsx"; filename*=UTF-8''${fileNameStar}`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(buf);
    } catch (e) {
        console.error('Failed to generate XLSX template:', e);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Import products from XLSX (bulk)
// - Skips duplicates by code (case-insensitive)
// - Populates translations.bg.{name,description,category} from the file's NAME/Info/Category columns
app.post(API_PREFIX + '/products/import-xlsx', requireAuth, uploadXlsx.single('file'), (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const wb = XLSX.read(req.file.buffer, { type: 'buffer', raw: false, cellDates: false });
        const sheetName = wb.SheetNames?.[0];
        if (!sheetName) {
            return res.status(400).json({ error: 'XLSX contains no sheets' });
        }

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        if (!Array.isArray(rows) || rows.length < 2) {
            return res.status(400).json({ error: 'XLSX is empty or invalid' });
        }

        const headerRowIndex = findLikelyHeaderRowIndex(rows);
        if (headerRowIndex < 0) {
            return res.status(400).json({
                error: 'Could not find a header row. Expected columns like CODE, NAME, Category, Price.'
            });
        }

        const headerRow = rows[headerRowIndex] || [];
        const idx = buildXlsxHeaderIndexMap(headerRow);

        const db = readDatabase();
        const existingCodes = new Set((db.products || [])
            .map(p => (p?.code ?? '').toString().trim().toLowerCase())
            .filter(Boolean));

        const created = [];
        // Historically we skipped duplicates by code; now we auto-adjust codes to import every row.
        // Keep counters for UI feedback.
        let duplicateCount = 0; // number of rows whose code had to be adjusted due to collision
        let invalidCount = 0; // number of rows we could not import (should be 0 unless something is very wrong)

        for (let r = headerRowIndex + 1; r < rows.length; r++) {
            const row = rows[r] || [];
            const hasAny = row.some(v => (v ?? '').toString().trim() !== '');
            if (!hasAny) continue;

            const requestedId = (idx.id != null) ? coerceCellString(row, idx.id) : '';

            let codeRaw = coerceCellString(row, idx.code);
            // If the file doesn't provide a code, generate one so every row can be imported.
            if (!codeRaw) {
                const base = requestedId ? `AUTO-${requestedId}` : `AUTO-ROW-${r}`;
                codeRaw = base;
            }

            // Ensure uniqueness: if code already exists, append a numeric suffix.
            let codeNorm = codeRaw.toLowerCase();
            if (existingCodes.has(codeNorm)) {
                duplicateCount++;
                let suffix = 2;
                let candidate = `${codeRaw}-${suffix}`;
                while (existingCodes.has(candidate.toLowerCase())) {
                    suffix++;
                    candidate = `${codeRaw}-${suffix}`;
                }
                codeRaw = candidate;
                codeNorm = codeRaw.toLowerCase();
            }

            const nameEn = coerceCellString(row, idx.name_en) || coerceCellString(row, idx.name);
            const nameBg = coerceCellString(row, idx.name_bg);

            const categoryEn = coerceCellString(row, idx.category_en) || coerceCellString(row, idx.category);
            const categoryBg = coerceCellString(row, idx.category_bg);

            const descEn = coerceCellString(row, idx.description_en);
            const descBg = coerceCellString(row, idx.description_bg) || coerceCellString(row, idx.info) || coerceCellString(row, idx.description);

            const name = (nameEn || nameBg || codeRaw);
            const category = (categoryEn || categoryBg || 'Other');
            const subcategory = coerceCellString(row, idx.subcategory);
            const description = (descEn || descBg || '');

            const weight = coerceCellString(row, idx.weight);

            let price = parsePriceLike(row[idx.price]);
            // Allow blank/zero prices so every row can be imported.
            if (!Number.isFinite(price) || price < 0) price = 0;

            const image = (coerceCellString(row, idx.img_url) || 'https://via.placeholder.com/300x200?text=No+Image');

            const promoPrice = (idx.promo_price != null) ? parsePriceLike(row[idx.promo_price]) : NaN;
            const promoPctRaw = (idx.promo_percentage != null) ? coerceCellString(row, idx.promo_percentage) : '';
            const promoPctClean = promoPctRaw ? String(promoPctRaw).replace('%', '').replace(',', '.').trim() : '';
            const promoPctMatch = promoPctClean ? promoPctClean.match(/-?\d+(?:\.\d+)?/) : null;
            const promoPctParsed = promoPctMatch ? Number(promoPctMatch[0]) : NaN;
            const promoPct = Number.isFinite(promoPctParsed) ? Math.max(0, Math.min(100, promoPctParsed)) : NaN;
            const isPromoCell = (idx.is_promo != null) ? row[idx.is_promo] : '';
            // Per spec: Is promo == 1 means promo; 0 means no promo.
            const isPromo = parseBoolLikeServer(isPromoCell);

            const availableCell = (idx.available != null) ? row[idx.available] : '';
            const availabilityStatus = (idx.available != null)
                ? (parseBoolLikeServer(availableCell) ? 'available' : 'not_available')
                : 'available';

            const newProduct = {
                id: generateUniqueProductId(db, requestedId),
                code: codeRaw,
                name: name,
                description: description,
                price: price,
                category: category,
                subcategory: subcategory || '',
                availabilityStatus,
                availability: deriveAvailabilityBoolean(availabilityStatus),
                promoPercentage: (isPromo && Number.isFinite(promoPct) && promoPct > 0) ? promoPct : null,
                image,
                weight: weight || '',
                promo: null,
                translations: {
                    bg: {
                        name: nameBg || nameEn || name || '',
                        description: descBg || descEn || description || '',
                        category: categoryBg || categoryEn || category || ''
                    },
                    en: {
                        name: nameEn || '',
                        description: descEn || '',
                        category: categoryEn || ''
                    }
                },
                isCombo: false,
                comboType: null,
                comboProducts: null,
                specialLabel: null
            };

            if (isPromo) {
                let finalPromoPrice = promoPrice;
                // Promo Price is the discounted price. If empty, derive from promo %.
                if (!Number.isFinite(finalPromoPrice) && Number.isFinite(promoPct) && promoPct > 0 && price > 0) {
                    finalPromoPrice = Math.round((price * (1 - Math.max(0, Math.min(100, promoPct)) / 100)) * 100) / 100;
                }
                if (Number.isFinite(finalPromoPrice) && finalPromoPrice > 0 && (price <= 0 || finalPromoPrice < price)) {
                    newProduct.promo = {
                        enabled: true,
                        isActive: true,
                        price: finalPromoPrice,
                        type: 'permanent',
                        startDate: null,
                        endDate: null
                    };
                }
            }

            db.products.push(newProduct);
            created.push(newProduct);
            existingCodes.add(codeNorm);
        }

        if (created.length === 0) {
            return res.status(400).json({
                error: 'No valid products found in XLSX',
                duplicates: duplicateCount,
                invalid: invalidCount
            });
        }

        if (!writeDatabase(db)) {
            return res.status(500).json({ error: 'Failed to save products' });
        }

        return res.json({
            ok: true,
            imported: created.length,
            duplicates: duplicateCount,
            invalid: invalidCount
        });
    } catch (e) {
        console.error('XLSX import failed:', e);
        return res.status(500).json({ error: 'XLSX import failed' });
    }
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

    const requestedId = req.body?.id;
    const parsedRequestedId = (requestedId !== undefined && requestedId !== null) ? parseInt(requestedId, 10) : NaN;
    let newId = Number.isFinite(parsedRequestedId) ? parsedRequestedId : Date.now();
    if ((db.products || []).some(p => p && p.id === newId)) {
        newId = Date.now() + Math.floor(Math.random() * 1000);
    }

    const codeRaw = (req.body?.code ?? '').toString().trim();
    const codeNorm = codeRaw.toLowerCase();
    if (codeRaw) {
        const codeExists = (db.products || []).some(p => (p?.code ?? '').toString().trim().toLowerCase() === codeNorm);
        if (codeExists) {
            return res.status(409).json({ error: 'Product code already exists' });
        }
    }

    const promoPercentageRaw = req.body?.promoPercentage;
    const promoPercentage = (promoPercentageRaw === undefined || promoPercentageRaw === null || promoPercentageRaw === '')
        ? null
        : Number(promoPercentageRaw);

    const availabilityStatus = pickRequestedAvailabilityStatus(req.body, null) || 'available';

    const newProduct = {
        id: newId,
        code: codeRaw,
        name: req.body.name,
        description: req.body.description,
        price: parseFloat(req.body.price) || 0,
        category: req.body.category,
        subcategory: req.body.subcategory || '',
        availabilityStatus,
        availability: deriveAvailabilityBoolean(availabilityStatus),
        promoPercentage: (promoPercentage !== null && Number.isFinite(promoPercentage)) ? promoPercentage : null,
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
        const codeRaw = (req.body?.code ?? db.products[index]?.code ?? '').toString().trim();
        const codeNorm = codeRaw.toLowerCase();
        if (codeRaw) {
            const codeExists = (db.products || []).some((p, i) => i !== index && (p?.code ?? '').toString().trim().toLowerCase() === codeNorm);
            if (codeExists) {
                return res.status(409).json({ error: 'Product code already exists' });
            }
        }

        const promoPercentageRaw = req.body?.promoPercentage;
        const promoPercentage = (promoPercentageRaw === undefined || promoPercentageRaw === null || promoPercentageRaw === '')
            ? (db.products[index]?.promoPercentage ?? null)
            : Number(promoPercentageRaw);

        const availabilityStatus = pickRequestedAvailabilityStatus(req.body, db.products[index]) || 'available';

        db.products[index] = {
            id: parseInt(req.params.id),
            code: codeRaw,
            name: req.body.name,
            description: req.body.description,
            price: parseFloat(req.body.price) || 0,
            category: req.body.category,
            subcategory: req.body.subcategory || (db.products[index].subcategory || ''),
            availabilityStatus,
            availability: deriveAvailabilityBoolean(availabilityStatus),
            promoPercentage: (promoPercentage !== null && Number.isFinite(promoPercentage)) ? promoPercentage : null,
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

// Quick update: product availability only
app.put(API_PREFIX + '/products/:id/availability', requireAuth, (req, res) => {
    const db = readDatabase();
    const index = db.products.findIndex(p => p.id === parseInt(req.params.id));

    if (index === -1) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const availabilityStatus = pickRequestedAvailabilityStatus(req.body, db.products[index]);
    if (!availabilityStatus) {
        return res.status(400).json({ error: 'Invalid availability status' });
    }

    db.products[index] = {
        ...db.products[index],
        availabilityStatus,
        availability: deriveAvailabilityBoolean(availabilityStatus)
    };

    if (writeDatabase(db)) {
        res.json(db.products[index]);
    } else {
        res.status(500).json({ error: 'Failed to update product availability' });
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
        // Best-effort local image cleanup
        for (const p of deleted) deleteLocalProductImages(p);
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
            // Best-effort local image cleanup
            deleteLocalProductImages(deletedProduct[0]);
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
    
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl: imageUrl });
});

// Bulk upload product images (match by product id)
// - Upload multiple files at once
// - Filenames must be like: 1.jpg, 2.png, 3.webp ...
// - Each file updates the product with matching numeric id
app.post(API_PREFIX + '/products/upload-images', requireAuth, uploadProductImages.array('images', 500), (req, res) => {
    try {
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const db = readDatabase();
        const products = Array.isArray(db.products) ? db.products : [];

        let updated = 0;
        let skipped = 0;
        const unmatched = [];

        for (const file of files) {
            const filename = (file?.filename ?? '').toString();
            const ext = path.extname(filename);
            const base = path.basename(filename, ext).trim();
            const id = parseInt(base, 10);
            if (!Number.isFinite(id) || String(id) !== base) {
                skipped++;
                unmatched.push(filename);
                continue;
            }

            const product = products.find(p => p && p.id === id);
            if (!product) {
                skipped++;
                unmatched.push(filename);
                continue;
            }

            product.image = `/uploads/${filename}`;
            updated++;
        }

        if (!writeDatabase(db)) {
            return res.status(500).json({ error: 'Failed to save products' });
        }

        return res.json({
            ok: true,
            uploaded: files.length,
            updated,
            skipped,
            unmatched
        });
    } catch (e) {
        console.error('Bulk product image upload failed:', e);
        return res.status(500).json({ error: 'Bulk image upload failed' });
    }
});

// Admin: list unlinked upload images (files in /uploads not referenced by any product)
app.get(API_PREFIX + '/uploads/images', requireAuth, (req, res) => {
    try {
        const db = readDatabase();
        const unlinkedOnlyRaw = (req.query?.unlinkedOnly ?? '1').toString();
        const unlinkedOnly = unlinkedOnlyRaw !== '0' && unlinkedOnlyRaw.toLowerCase() !== 'false';
        const items = listUploadImages(db, { unlinkedOnly });
        res.json({ ok: true, items });
    } catch (e) {
        console.error('[UPLOADS] Failed to list images:', e);
        res.status(500).json({ error: 'Failed to list images', message: e?.message || String(e) });
    }
});

// Admin: delete selected unlinked upload images
app.delete(API_PREFIX + '/uploads/images', requireAuth, (req, res) => {
    const filenames = Array.isArray(req.body?.filenames) ? req.body.filenames : [];
    if (!filenames.length) {
        return res.status(400).json({ error: 'No filenames provided' });
    }

    const db = readDatabase();
    const referenced = getReferencedUploadsFilenames(db);

    let deleted = 0;
    let skippedReferenced = 0;
    let notFound = 0;
    const errors = [];

    for (const raw of filenames) {
        const name = (raw ?? '').toString().trim();
        if (!isSafeUploadsFilename(name)) {
            errors.push({ filename: name, error: 'Invalid filename' });
            continue;
        }

        if (referenced.has(name)) {
            skippedReferenced++;
            continue;
        }

        const full = path.join(UPLOADS_DIR, name);
        try {
            if (!fs.existsSync(full)) {
                notFound++;
                continue;
            }
            fs.unlinkSync(full);
            deleted++;
        } catch (e) {
            errors.push({ filename: name, error: e?.message || String(e) });
        }
    }

    res.json({ ok: true, deleted, skippedReferenced, notFound, errors });
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
        priceColor: '#e74c3c',
        headerLogoSize: 50,
        footerLogoMaxWidth: 180
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

// Upload/update favicon (admin only)
app.post(API_PREFIX + '/settings/site/favicon', requireAuth, (req, res) => {
    uploadFavicon.single('favicon')(req, res, (err) => {
        try {
            if (err) {
                return res.status(400).json({ error: err.message || 'Invalid favicon upload' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'Missing favicon file' });
            }

            const db = readDatabase();
            const restaurant = db.restaurants?.find(r => r.id === req.restaurantId);
            if (!restaurant) {
                return res.status(404).json({ error: 'Restaurant not found' });
            }

            const allowedExt = ['.ico', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
            const ext = path.extname(req.file.filename).toLowerCase();
            const safeExt = allowedExt.includes(ext) ? ext : '.ico';

            // Remove any previous favicon files with other extensions
            for (const e of allowedExt) {
                if (e === safeExt) continue;
                try {
                    fs.unlinkSync(path.join(UPLOADS_DIR, `favicon${e}`));
                } catch (e2) {
                    // ignore
                }
            }

            const v = Date.now();
            const faviconUrl = `/uploads/favicon${safeExt}?v=${v}`;

            const current = normalizeSiteSettings(restaurant.siteSettings);
            restaurant.siteSettings = normalizeSiteSettings({ ...current, faviconUrl });

            if (!writeDatabase(db)) {
                return res.status(500).json({ error: 'Failed to save favicon setting' });
            }

            return res.json({ ok: true, faviconUrl: restaurant.siteSettings.faviconUrl });
        } catch (e) {
            console.error('Error uploading favicon:', e);
            return res.status(500).json({ error: 'Failed to upload favicon' });
        }
    });
});

// Upload/update footer "About us" logo (admin only)
app.post(API_PREFIX + '/settings/site/footer-about-logo', requireAuth, (req, res) => {
    uploadFooterAboutLogo.single('aboutLogo')(req, res, (err) => {
        try {
            if (err) {
                return res.status(400).json({ error: err.message || 'Invalid logo upload' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'Missing logo file' });
            }

            const db = readDatabase();
            const restaurant = db.restaurants?.find(r => r.id === req.restaurantId);
            if (!restaurant) {
                return res.status(404).json({ error: 'Restaurant not found' });
            }

            const allowedExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
            const ext = path.extname(req.file.filename).toLowerCase();
            const safeExt = allowedExt.includes(ext) ? ext : '.png';

            // Remove any previous logo files with other extensions
            for (const e of allowedExt) {
                if (e === safeExt) continue;
                try {
                    fs.unlinkSync(path.join(UPLOADS_DIR, `footer-about-logo${e}`));
                } catch (e2) {
                    // ignore
                }
            }

            const v = Date.now();
            const aboutLogoUrl = `/uploads/footer-about-logo${safeExt}?v=${v}`;

            const current = normalizeSiteSettings(restaurant.siteSettings);
            restaurant.siteSettings = normalizeSiteSettings({
                ...current,
                footer: {
                    ...(current.footer || {}),
                    aboutLogoUrl
                }
            });

            if (!writeDatabase(db)) {
                return res.status(500).json({ error: 'Failed to save logo setting' });
            }

            return res.json({ ok: true, aboutLogoUrl: restaurant.siteSettings.footer?.aboutLogoUrl || '' });
        } catch (e) {
            console.error('Error uploading footer about logo:', e);
            return res.status(500).json({ error: 'Failed to upload footer logo' });
        }
    });
});

// Update customization settings
app.put(API_PREFIX + '/settings/customization', requireAuth, (req, res) => {
    const db = readDatabase();

    const clampInt = (value, min, max, fallback) => {
        const n = Number.parseInt(value, 10);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    };

    const prev = (db.customization && typeof db.customization === 'object') ? db.customization : {};
    const body = (req.body && typeof req.body === 'object') ? req.body : {};

    const next = {
        ...prev,
        ...body
    };

    next.headerLogoSize = clampInt(next.headerLogoSize, 24, 96, 50);
    next.footerLogoMaxWidth = clampInt(next.footerLogoMaxWidth, 80, 360, 180);

    db.customization = next;
    
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
    const defaults = {
        deliveryEnabled: true,
        freeDeliveryEnabled: false,
        freeDeliveryAmount: 50,
        freeDeliveryCities: null,
        deliveryFee: 5,
        deliveryHours: {
            openingTime: '11:00',
            closingTime: '21:30'
        },
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
    };

    const raw = db.deliverySettings || {};
    const merged = {
        ...defaults,
        ...raw,
        deliveryHours: {
            ...defaults.deliveryHours,
            ...(raw.deliveryHours || {})
        },
        cityPrices: raw.cityPrices || defaults.cityPrices
    };

    res.json(merged);
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
    const raw = db.orderSettings || {};
    const defaults = {
        minimumOrderAmount: 0,
        minimumOrderDeliveryEnabled: false,
        minimumOrderDeliveryAmount: 0,
        minimumOrderPickupEnabled: false,
        minimumOrderPickupAmount: 0,
        allowOrderLater: true,
        temporarilyClosed: false,
        pickupEnabled: true,
        autoApproveOrders: false,
        autoApproveCardPayments: true
    };

    const merged = {
        ...defaults,
        ...raw
    };

    // Backward compatibility: if only the legacy global minimum exists, treat it as
    // the minimum for both delivery and pickup (enabled).
    const legacyMin = Math.max(0, parseNumber(merged.minimumOrderAmount, 0));
    const hasDeliveryToggle = Object.prototype.hasOwnProperty.call(raw, 'minimumOrderDeliveryEnabled');
    const hasPickupToggle = Object.prototype.hasOwnProperty.call(raw, 'minimumOrderPickupEnabled');
    const hasDeliveryAmount = Object.prototype.hasOwnProperty.call(raw, 'minimumOrderDeliveryAmount');
    const hasPickupAmount = Object.prototype.hasOwnProperty.call(raw, 'minimumOrderPickupAmount');
    if (!hasDeliveryToggle && !hasPickupToggle && !hasDeliveryAmount && !hasPickupAmount && legacyMin > 0) {
        merged.minimumOrderDeliveryEnabled = true;
        merged.minimumOrderDeliveryAmount = legacyMin;
        merged.minimumOrderPickupEnabled = true;
        merged.minimumOrderPickupAmount = legacyMin;
    }

    res.json(merged);
});

// Update order settings
app.put(API_PREFIX + '/settings/order', requireAuth, (req, res) => {
    const db = readDatabase();

    const legacyProvided = req.body.minimumOrderAmount !== undefined;
    const legacyMinimumOrderAmountRaw = legacyProvided ? Number(req.body.minimumOrderAmount) : NaN;
    const legacyMinimumOrderAmount = Number.isFinite(legacyMinimumOrderAmountRaw)
        ? Math.max(0, legacyMinimumOrderAmountRaw)
        : NaN;

    const deliveryEnabledProvided = req.body.minimumOrderDeliveryEnabled !== undefined;
    const deliveryAmountProvided = req.body.minimumOrderDeliveryAmount !== undefined;
    const pickupEnabledProvided = req.body.minimumOrderPickupEnabled !== undefined;
    const pickupAmountProvided = req.body.minimumOrderPickupAmount !== undefined;

    // If the caller only sends the legacy field, mirror it into both per-method fields
    // so older admin UIs keep working.
    const deliveryEnabled = deliveryEnabledProvided
        ? coerceBoolean(req.body.minimumOrderDeliveryEnabled, false)
        : (legacyProvided ? (Number.isFinite(legacyMinimumOrderAmount) && legacyMinimumOrderAmount > 0) : coerceBoolean(db.orderSettings?.minimumOrderDeliveryEnabled, false));
    const deliveryAmount = deliveryAmountProvided
        ? Math.max(0, parseNumber(req.body.minimumOrderDeliveryAmount, 0))
        : (legacyProvided ? (Number.isFinite(legacyMinimumOrderAmount) ? legacyMinimumOrderAmount : 0) : Math.max(0, parseNumber(db.orderSettings?.minimumOrderDeliveryAmount, 0)));

    const pickupEnabled = pickupEnabledProvided
        ? coerceBoolean(req.body.minimumOrderPickupEnabled, false)
        : (legacyProvided ? (Number.isFinite(legacyMinimumOrderAmount) && legacyMinimumOrderAmount > 0) : coerceBoolean(db.orderSettings?.minimumOrderPickupEnabled, false));
    const pickupAmount = pickupAmountProvided
        ? Math.max(0, parseNumber(req.body.minimumOrderPickupAmount, 0))
        : (legacyProvided ? (Number.isFinite(legacyMinimumOrderAmount) ? legacyMinimumOrderAmount : 0) : Math.max(0, parseNumber(db.orderSettings?.minimumOrderPickupAmount, 0)));

    db.orderSettings = {
        // Keep the legacy field for old clients. If per-method fields are used, we
        // store the maximum as a conservative fallback.
        minimumOrderAmount: Number.isFinite(legacyMinimumOrderAmount)
            ? legacyMinimumOrderAmount
            : Math.max(0, deliveryEnabled ? deliveryAmount : 0, pickupEnabled ? pickupAmount : 0),
        minimumOrderDeliveryEnabled: deliveryEnabled,
        minimumOrderDeliveryAmount: deliveryAmount,
        minimumOrderPickupEnabled: pickupEnabled,
        minimumOrderPickupAmount: pickupAmount,
        allowOrderLater: req.body.allowOrderLater !== false,
        temporarilyClosed: req.body.temporarilyClosed === true,
        pickupEnabled: req.body.pickupEnabled !== false,
        autoApproveOrders: req.body.autoApproveOrders !== undefined
            ? (req.body.autoApproveOrders === true)
            : (db.orderSettings?.autoApproveOrders === true),
        autoApproveCardPayments: req.body.autoApproveCardPayments !== undefined
            ? (req.body.autoApproveCardPayments === true)
            : (db.orderSettings?.autoApproveCardPayments !== false)
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
    res.json(normalizeWorkingHoursConfig(db.workingHours || null));
});

// Update working hours
app.put(API_PREFIX + '/settings/working-hours', requireAuth, (req, res) => {
    const db = readDatabase();
    const next = normalizeWorkingHoursConfig(req.body || null);
    db.workingHours = {
        timezone: next.timezone,
        weekly: next.weekly,
        openingTime: next.openingTime,
        closingTime: next.closingTime
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

function normalizePromoCodeCategories(value) {
    if (!Array.isArray(value)) return [];
    const cleaned = value
        .map(v => (v === undefined || v === null) ? '' : String(v))
        .map(s => s.trim())
        .filter(Boolean);
    const unique = Array.from(new Set(cleaned));
    return unique.slice(0, 200);
}

function getPromoTargetCategories(promo) {
    const fromArray = normalizePromoCodeCategories(promo?.categories);
    if (fromArray.length) return fromArray;
    const fromSingle = (promo?.category || '').toString().trim();
    return fromSingle ? [fromSingle] : [];
}

function normalizePromoCodeScope(promo) {
    const scopeRaw = (promo?.scope || '').toString().trim().toLowerCase();
    if (scopeRaw === 'all' || scopeRaw === 'category' || scopeRaw === 'products') return scopeRaw;

    const productIds = Array.isArray(promo?.productIds) ? promo.productIds : [];
    if (productIds.length) return 'products';

    const categories = getPromoTargetCategories(promo);
    const hasCategory = categories.some(c => (c || '').toString().trim().toLowerCase() !== 'all');
    const hasAll = categories.some(c => (c || '').toString().trim().toLowerCase() === 'all');
    if (hasCategory && !hasAll) return 'category';

    const category = (promo?.category || 'all').toString();
    return category && category !== 'all' ? 'category' : 'all';
}

function normalizePromoCodeProductIds(value) {
    if (!Array.isArray(value)) return [];
    const ids = value
        .map(v => {
            if (typeof v === 'number') return v;
            const n = parseInt(String(v), 10);
            return Number.isFinite(n) ? n : NaN;
        })
        .filter(n => Number.isFinite(n));
    return Array.from(new Set(ids)).slice(0, 5000);
}

function isPromoWindowActiveNow(promo, nowMs = Date.now()) {
    const startRaw = (promo?.startDate || promo?.start || '').toString().trim();
    const endRaw = (promo?.endDate || promo?.end || '').toString().trim();

    const hasStart = !!startRaw;
    const hasEnd = !!endRaw;
    if (!hasStart && !hasEnd) return true;

    const startMs = hasStart ? new Date(startRaw).getTime() : null;
    const endMs = hasEnd ? new Date(endRaw).getTime() : null;
    if (hasStart && !Number.isFinite(startMs)) return false;
    if (hasEnd && !Number.isFinite(endMs)) return false;
    if (hasStart && hasEnd && endMs < startMs) return false;

    if (hasStart && nowMs < startMs) return false;
    if (hasEnd && nowMs > endMs) return false;
    return true;
}

function computePromoEligibleSubtotal(items, promo, db) {
    const safeItems = Array.isArray(items) ? items : [];
    if (!promo) return 0;
    const scope = normalizePromoCodeScope(promo);
    const targetCategories = getPromoTargetCategories(promo);
    const targetNorms = new Set(targetCategories.map(c => (c || '').toString().toLowerCase()));
    const category = (promo?.category || 'all').toString();
    const productIds = normalizePromoCodeProductIds(promo?.productIds);
    const productIdSet = new Set(productIds.map(String));

    const products = Array.isArray(db?.products) ? db.products : [];
    const productById = new Map(products.map(p => [String(p?.id), p]));

    return safeItems.reduce((sum, it) => {
        const line = (parseNumber(it?.price, 0) * parseNumber(it?.quantity, 0));
        if (line <= 0) return sum;

        if (scope === 'all' || category === 'all' || targetNorms.has('all')) {
            return sum + line;
        }

        const id = it?.id;
        const idStr = (id === undefined || id === null) ? '' : String(id);
        const product = idStr ? productById.get(idStr) : null;
        const itemCategory = (product?.category || it?.category || '').toString();
        const itemCategoryNorm = itemCategory.toLowerCase();

        if (scope === 'category') {
            return targetNorms.has(itemCategoryNorm) ? (sum + line) : sum;
        }
        if (scope === 'products') {
            return productIdSet.has(idStr) ? (sum + line) : sum;
        }

        return sum;
    }, 0);
}

// Get all promo codes
app.get(API_PREFIX + '/promo-codes', requireAuth, (req, res) => {
    const db = readDatabase();
    res.json(db.promoCodes || []);
});

// Apply promo to batch of products
app.put(API_PREFIX + '/products/promo/batch', requireAuth, (req, res) => {
    const { ids, discount, type, startDate, endDate } = req.body || {};
    if (!Array.isArray(ids) || !discount || discount <= 0 || discount >= 100) {
        return res.status(400).json({ error: 'ids (array) and discount (1-99) required' });
    }

    const promoTypeRaw = (type || 'permanent').toString().trim().toLowerCase();
    const promoType = (promoTypeRaw === 'timed' || promoTypeRaw === 'permanent') ? promoTypeRaw : 'permanent';
    const start = (startDate || '').toString().trim();
    const end = (endDate || '').toString().trim();
    if (promoType === 'timed') {
        const startMs = new Date(start).getTime();
        const endMs = new Date(end).getTime();
        if (!start || !end || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
            return res.status(400).json({ error: 'Timed promo requires valid startDate and endDate (end after start)' });
        }
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
                type: promoType,
                ...(promoType === 'timed' ? { startDate: start, endDate: end } : {})
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
    const { discount, type, startDate, endDate } = req.body || {};
    if (!category || !discount || discount <= 0 || discount >= 100) {
        return res.status(400).json({ error: 'category and discount (1-99) required' });
    }

    const promoTypeRaw = (type || 'permanent').toString().trim().toLowerCase();
    const promoType = (promoTypeRaw === 'timed' || promoTypeRaw === 'permanent') ? promoTypeRaw : 'permanent';
    const start = (startDate || '').toString().trim();
    const end = (endDate || '').toString().trim();
    if (promoType === 'timed') {
        const startMs = new Date(start).getTime();
        const endMs = new Date(end).getTime();
        if (!start || !end || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
            return res.status(400).json({ error: 'Timed promo requires valid startDate and endDate (end after start)' });
        }
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
                type: promoType,
                ...(promoType === 'timed' ? { startDate: start, endDate: end } : {})
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
    const { code, category, categories, productIds, deliveryMethod } = req.body;

    const normalizedMethod = (deliveryMethod === 'delivery' || deliveryMethod === 'pickup') ? deliveryMethod : null;
    
    const inCategory = (category || '').toString();
    const inCategories = Array.isArray(categories) ? categories.map(c => (c || '').toString()) : [];
    const inProductIds = normalizePromoCodeProductIds(productIds);

    const promoCode = (db.promoCodes || []).find(pc => {
        if (!pc) return false;
        const pcCode = (pc.code || '').toString().toLowerCase();
        const inCode = (code || '').toString().toLowerCase();
        if (!pcCode || !inCode || pcCode !== inCode) return false;
        if (!pc.isActive) return false;

        if (!isPromoWindowActiveNow(pc)) return false;

        const allowed = (pc.allowedMethod || 'all').toString().trim().toLowerCase();
        if (allowed === 'delivery' || allowed === 'pickup') {
            if (normalizedMethod && allowed !== normalizedMethod) return false;
        }

        // Eligibility in cart: if caller provides category/categories/productIds, enforce target match.
        const scope = normalizePromoCodeScope(pc);
        const targetCategories = getPromoTargetCategories(pc);
        const targetNorms = new Set(targetCategories.map(c => (c || '').toString().toLowerCase()));
        const targetCategory = (pc.category || (targetCategories[0] || 'all')).toString();
        const targetProductIds = normalizePromoCodeProductIds(pc.productIds);
        const targetSet = new Set(targetProductIds.map(String));

        if (scope === 'all' || targetCategory === 'all' || targetNorms.has('all')) {
            return true;
        }

        if (scope === 'category') {
            if (!inCategory && (!inCategories || inCategories.length === 0)) {
                // Browse-mode validation
                return true;
            }
            if (inCategory && targetNorms.has(inCategory.toLowerCase())) return true;
            if (inCategories && inCategories.some(c => targetNorms.has((c || '').toString().toLowerCase()))) return true;
            return false;
        }

        if (scope === 'products') {
            if (!inProductIds || inProductIds.length === 0) {
                // Browse-mode validation
                return true;
            }
            return inProductIds.some(pid => targetSet.has(String(pid)));
        }

        return true;
    });
    
    if (promoCode) {
        const targetCategories = getPromoTargetCategories(promoCode);
        res.json({
            valid: true,
            discount: promoCode.discount,
            scope: normalizePromoCodeScope(promoCode),
            category: (promoCode.category || (targetCategories[0] || 'all')),
            categories: targetCategories.length ? targetCategories : undefined,
            productIds: normalizePromoCodeProductIds(promoCode.productIds),
            allowedMethod: (promoCode.allowedMethod || 'all'),
            startDate: promoCode.startDate || null,
            endDate: promoCode.endDate || null
        });
    } else {
        res.json({ valid: false });
    }
});

// Create promo code
app.post(API_PREFIX + '/promo-codes', requireAuth, (req, res) => {
    const db = readDatabase();
    const allowedMethodRaw = (req.body.allowedMethod || 'all').toString().trim().toLowerCase();
    const allowedMethod = (allowedMethodRaw === 'delivery' || allowedMethodRaw === 'pickup' || allowedMethodRaw === 'all') ? allowedMethodRaw : 'all';
    const scope = normalizePromoCodeScope(req.body);
    let categories = normalizePromoCodeCategories(req.body.categories);
    let category = (req.body.category || 'all').toString();
    const productIds = normalizePromoCodeProductIds(req.body.productIds);
    const startDate = (req.body.startDate || '').toString().trim();
    const endDate = (req.body.endDate || '').toString().trim();
    if (startDate || endDate) {
        const startMs = startDate ? new Date(startDate).getTime() : NaN;
        const endMs = endDate ? new Date(endDate).getTime() : NaN;
        if ((startDate && !Number.isFinite(startMs)) || (endDate && !Number.isFinite(endMs)) || (startDate && endDate && endMs <= startMs)) {
            return res.status(400).json({ error: 'Invalid start/end date range' });
        }
    }

    if (scope === 'products' && productIds.length === 0) {
        return res.status(400).json({ error: 'productIds required for products-scoped promo codes' });
    }

    if (scope === 'category') {
        if (!categories.length) {
            categories = category ? [category] : [];
        }
        const hasAll = categories.some(c => (c || '').toString().trim().toLowerCase() === 'all');
        if (hasAll) {
            categories = ['all'];
            category = 'all';
        } else {
            category = (categories[0] || 'all').toString();
        }
    } else {
        categories = [];
        if (scope === 'all') category = 'all';
    }

    const newPromoCode = {
        id: Date.now(),
        code: req.body.code.toUpperCase(),
        scope,
        category,
        ...(scope === 'category' ? { categories } : {}),
        ...(scope === 'products' ? { productIds } : {}),
        discount: parseFloat(req.body.discount),
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        allowedMethod,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
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

// Bulk create promo codes
// Body: { count: number, discount: number, category: string, isActive?: boolean, codePrefix?: string }
app.post(API_PREFIX + '/promo-codes/bulk', requireAuth, (req, res) => {
    const db = readDatabase();
    if (!db.promoCodes) db.promoCodes = [];

    const countRaw = parseInt(req.body?.count, 10);
    const count = Number.isFinite(countRaw) ? Math.max(1, Math.min(5000, countRaw)) : 0;
    const discount = parseFloat(req.body?.discount);
    const category = (req.body?.category || 'all').toString();
    const isActive = req.body?.isActive !== undefined ? !!req.body.isActive : true;
    const allowedMethodRaw = (req.body?.allowedMethod || 'all').toString().trim().toLowerCase();
    const allowedMethod = (allowedMethodRaw === 'delivery' || allowedMethodRaw === 'pickup' || allowedMethodRaw === 'all') ? allowedMethodRaw : 'all';

    let prefix = (req.body?.codePrefix || 'FLY').toString().trim().toUpperCase();
    prefix = prefix.replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (!prefix) prefix = 'FLY';

    if (!count) {
        return res.status(400).json({ error: 'count (1-5000) required' });
    }

    if (!discount || discount < 1 || discount > 100) {
        return res.status(400).json({ error: 'discount (1-100) required' });
    }

    const existing = new Set((db.promoCodes || []).map(pc => (pc?.code || '').toString().toUpperCase()));
    const nowIso = new Date().toISOString();
    const created = [];

    for (let i = 0; i < count; i++) {
        let code = '';
        for (let tries = 0; tries < 25; tries++) {
            const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
            const candidate = `${prefix}${suffix}`;
            if (!existing.has(candidate)) {
                code = candidate;
                existing.add(candidate);
                break;
            }
        }
        if (!code) {
            return res.status(500).json({ error: 'Failed to generate unique promo codes' });
        }

        const newPromoCode = {
            id: Date.now() + i,
            code,
            scope: (category && category !== 'all') ? 'category' : 'all',
            category,
            discount: parseFloat(discount),
            isActive,
            allowedMethod,
            createdAt: nowIso
        };

        db.promoCodes.push(newPromoCode);
        created.push(newPromoCode);
    }

    if (writeDatabase(db)) {
        return res.status(201).json({ success: true, createdCount: created.length, promoCodes: created });
    }

    res.status(500).json({ error: 'Failed to save promo codes' });
});

// Update promo code
app.put(API_PREFIX + '/promo-codes/:id', requireAuth, (req, res) => {
    const db = readDatabase();
    const index = (db.promoCodes || []).findIndex(pc => pc.id === parseInt(req.params.id));
    
    if (index !== -1) {
        const allowedMethodRaw = (req.body.allowedMethod || 'all').toString().trim().toLowerCase();
        const allowedMethod = (allowedMethodRaw === 'delivery' || allowedMethodRaw === 'pickup' || allowedMethodRaw === 'all') ? allowedMethodRaw : 'all';

        const scope = normalizePromoCodeScope(req.body);
        let categories = normalizePromoCodeCategories(req.body.categories);
        let category = (req.body.category || 'all').toString();
        const productIds = normalizePromoCodeProductIds(req.body.productIds);
        const startDate = (req.body.startDate || '').toString().trim();
        const endDate = (req.body.endDate || '').toString().trim();

        if (scope === 'products' && productIds.length === 0) {
            return res.status(400).json({ error: 'productIds required for products-scoped promo codes' });
        }

        if (startDate || endDate) {
            const startMs = startDate ? new Date(startDate).getTime() : NaN;
            const endMs = endDate ? new Date(endDate).getTime() : NaN;
            if ((startDate && !Number.isFinite(startMs)) || (endDate && !Number.isFinite(endMs)) || (startDate && endDate && endMs <= startMs)) {
                return res.status(400).json({ error: 'Invalid start/end date range' });
            }
        }

        if (scope === 'category') {
            if (!categories.length) {
                categories = category ? [category] : [];
            }
            const hasAll = categories.some(c => (c || '').toString().trim().toLowerCase() === 'all');
            if (hasAll) {
                categories = ['all'];
                category = 'all';
            } else {
                category = (categories[0] || 'all').toString();
            }
        } else {
            categories = [];
            if (scope === 'all') category = 'all';
        }

        db.promoCodes[index] = {
            id: parseInt(req.params.id),
            code: req.body.code.toUpperCase(),
            scope,
            category,
            ...(scope === 'category' ? { categories } : {}),
            ...(scope === 'products' ? { productIds } : {}),
            discount: parseFloat(req.body.discount),
            isActive: req.body.isActive,
            allowedMethod,
            ...(startDate ? { startDate } : {}),
            ...(endDate ? { endDate } : {}),
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

// Mark promo codes as printed on flyers
// Body: { ids: number[] }
app.post(API_PREFIX + '/promo-codes/flyers/mark-printed', requireAuth, (req, res) => {
    const ids = (req.body && Array.isArray(req.body.ids)) ? req.body.ids : null;
    if (!ids || !ids.length) {
        return res.status(400).json({ error: 'ids (array) required' });
    }

    const db = readDatabase();
    const now = new Date().toISOString();
    let updated = 0;

    db.promoCodes = (db.promoCodes || []).map(pc => {
        if (ids.includes(pc.id)) {
            updated++;
            return {
                ...pc,
                flyerGenerated: true,
                flyerGeneratedAt: now
            };
        }
        return pc;
    });

    writeDatabase(db);
    res.json({ success: true, updated });
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
    if (s === 'accepted') return 'approved';
    if (s === 'accept') return 'approved';
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

function coerceBoolean(value, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const s = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off'].includes(s)) return false;
    return fallback;
}

function normalizeAvailabilityStatus(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim().toLowerCase();
    if (!s) return null;

    if (['available', 'in_stock', 'instock', 'active', 'enabled'].includes(s)) return 'available';
    if (['limited', 'low_stock', 'lowstock'].includes(s)) return 'limited';
    if (['out_of_stock', 'outofstock', 'out-of-stock', 'sold_out', 'soldout'].includes(s)) return 'out_of_stock';
    if (['not_available', 'notavailable', 'not-available', 'inactive', 'disabled'].includes(s)) return 'not_available';

    return null;
}

function getProductAvailabilityStatus(product) {
    const statusFromField = normalizeAvailabilityStatus(product?.availabilityStatus ?? product?.availability_status);
    if (statusFromField) return statusFromField;

    if (product?.availability === undefined || product?.availability === null) return 'available';
    return coerceBoolean(product.availability, true) ? 'available' : 'not_available';
}

function isProductOrderable(product) {
    const status = getProductAvailabilityStatus(product);
    return status === 'available' || status === 'limited';
}

function deriveAvailabilityBoolean(status) {
    return status === 'available' || status === 'limited';
}

function pickRequestedAvailabilityStatus(body, existingProduct) {
    const raw = body?.availabilityStatus ?? body?.availability_status ?? body?.status;
    const parsed = normalizeAvailabilityStatus(raw);
    if (parsed) return parsed;

    // Backward compatibility: boolean availability field
    if (body && (body.availability !== undefined && body.availability !== null)) {
        return coerceBoolean(body.availability, true) ? 'available' : 'not_available';
    }

    // Fall back to current
    return getProductAvailabilityStatus(existingProduct);
}

function getEffectiveMinimumOrderAmount(orderSettings, method) {
    const settings = orderSettings || {};
    const normalized = (method === 'delivery' || method === 'pickup') ? method : null;
    const legacyAmount = Math.max(0, parseNumber(settings.minimumOrderAmount, 0));

    const hasDeliveryToggle = typeof settings.minimumOrderDeliveryEnabled === 'boolean';
    const hasPickupToggle = typeof settings.minimumOrderPickupEnabled === 'boolean';

    // If the new fields are not configured yet, fall back to the legacy global minimum.
    if (!hasDeliveryToggle && !hasPickupToggle) {
        return legacyAmount;
    }

    if (normalized === 'delivery') {
        if (settings.minimumOrderDeliveryEnabled !== true) return 0;
        return Math.max(0, parseNumber(settings.minimumOrderDeliveryAmount, 0));
    }
    if (normalized === 'pickup') {
        if (settings.minimumOrderPickupEnabled !== true) return 0;
        return Math.max(0, parseNumber(settings.minimumOrderPickupAmount, 0));
    }

    return legacyAmount;
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
            const originalPriceRaw = parseNumber(it?.originalPrice, NaN);
            const originalPrice = Number.isFinite(originalPriceRaw) ? Math.max(0, originalPriceRaw) : undefined;
            const id = it?.id;
            const weight = it?.weight;
            const image = it?.image;
            const noteRaw = (it?.note || it?.notes || '').toString();
            const note = noteRaw.replace(/\r/g, '').trim();
            const discountLabelRaw = (it?.discountLabel || it?.discount_label || '').toString().replace(/\r/g, '').trim();
            const discountLabel = discountLabelRaw ? discountLabelRaw.slice(0, 80) : '';
            return {
                ...(id !== undefined ? { id } : {}),
                name,
                price,
                ...(originalPrice !== undefined ? { originalPrice } : {}),
                quantity,
                ...(weight !== undefined ? { weight } : {}),
                ...(image !== undefined ? { image } : {}),
                ...(note ? { note: note.slice(0, 500) } : {}),
                ...(discountLabel ? { discountLabel } : {})
            };
        })
        .filter(it => it.name && it.quantity > 0);

    if (sanitized.length === 0) return null;
    return sanitized;
}

function recomputeOrderTotals(order, db) {
    const items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce((sum, it) => sum + (parseNumber(it.price, 0) * parseNumber(it.quantity, 0)), 0);

    let discountPercent = Math.max(0, Math.min(100, parseNumber(order.discount, 0)));
    let discountBaseSubtotal = Number.isFinite(parseNumber(order.discountBaseSubtotal, NaN))
        ? Math.max(0, parseNumber(order.discountBaseSubtotal, 0))
        : subtotal;

    const promoCodeNormalized = (order?.promoCode || '').toString().trim().toLowerCase();
    const method = (order?.deliveryType || order?.deliveryMethod || '').toString().trim().toLowerCase();
    const normalizedMethod = (method === 'delivery' || method === 'pickup') ? method : null;

    if (db && promoCodeNormalized) {
        const promo = (db.promoCodes || []).find(pc => (pc?.code || '').toString().trim().toLowerCase() === promoCodeNormalized);
        if (promo && promo.isActive && isPromoWindowActiveNow(promo)) {
            const allowed = (promo.allowedMethod || 'all').toString().trim().toLowerCase();
            if (!normalizedMethod || allowed === 'all' || allowed === normalizedMethod) {
                discountPercent = Math.max(0, Math.min(100, parseNumber(promo.discount, 0)));
                discountBaseSubtotal = computePromoEligibleSubtotal(items, promo, db);
                order.discountScope = normalizePromoCodeScope(promo);
                order.discountCategory = (promo.category || 'all');
                order.discountCategories = (order.discountScope === 'category') ? getPromoTargetCategories(promo) : undefined;
                order.discountProductIds = normalizePromoCodeProductIds(promo.productIds);
            }
        }
    }

    if (!Number.isFinite(discountBaseSubtotal) || discountBaseSubtotal < 0) discountBaseSubtotal = 0;
    if (discountBaseSubtotal > subtotal) discountBaseSubtotal = subtotal;

    const discountAmount = discountBaseSubtotal * (discountPercent / 100);
    const deliveryFee = Math.max(0, parseNumber(order.deliveryFee, 0));
    const total = Math.max(0, subtotal - discountAmount + deliveryFee);
    const intermediateSubtotal = Math.max(0, subtotal - discountAmount);

    order.subtotal = roundMoneyEUR(subtotal);
    order.discount = discountPercent;
    order.discountBaseSubtotal = roundMoneyEUR(discountBaseSubtotal);
    order.discountAmount = roundMoneyEUR(discountAmount);
    order.intermediateSubtotal = roundMoneyEUR(intermediateSubtotal);
    order.deliveryFee = roundMoneyEUR(deliveryFee);
    order.total = roundMoneyEUR(total);

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

function normalizeCityPriceEntry(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number' || typeof value === 'string') {
        const fee = parseFloat(value);
        return Number.isFinite(fee) ? { fee } : null;
    }
    if (typeof value !== 'object') return null;

    const feeRaw = value.fee ?? value.price ?? value.deliveryFee ?? value.deliveryPrice;
    const minRaw = value.minimumOrderAmount ?? value.minOrderAmount ?? value.minimumOrder ?? value.min;
    const freeRaw = value.freeDeliveryAmount ?? value.freeDeliveryOverAmount ?? value.freeOverAmount;

    const fee = parseFloat(feeRaw);
    const minimumOrderAmount = parseFloat(minRaw);
    const freeDeliveryAmount = parseFloat(freeRaw);

    const out = {};
    if (Number.isFinite(fee)) out.fee = fee;
    if (Number.isFinite(minimumOrderAmount)) out.minimumOrderAmount = minimumOrderAmount;
    if (Number.isFinite(freeDeliveryAmount)) out.freeDeliveryAmount = freeDeliveryAmount;
    return Object.keys(out).length ? out : null;
}

function getCityDeliveryEntry(deliverySettings, cityRaw) {
    const city = (cityRaw || '').toString().trim();
    const prices = deliverySettings?.cityPrices || {};
    if (!city) return null;

    if (prices && prices[city] !== undefined) {
        return normalizeCityPriceEntry(prices[city]);
    }

    const cityNorm = city.toLowerCase();
    for (const [key, value] of Object.entries(prices)) {
        if (String(key).trim().toLowerCase() === cityNorm) {
            return normalizeCityPriceEntry(value);
        }
    }

    const fallbackKeys = ['Други', 'Other', 'other', '*', 'default'];
    for (const k of fallbackKeys) {
        if (prices && prices[k] !== undefined) {
            return normalizeCityPriceEntry(prices[k]);
        }
    }

    return null;
}

function computeEffectiveDeliveryFee(deliverySettings, cityRaw, subtotal) {
    const settings = deliverySettings || {};
    const cityEntry = getCityDeliveryEntry(settings, cityRaw);
    const baseFee = Number.isFinite(parseFloat(cityEntry?.fee)) ? parseFloat(cityEntry.fee) : 0;

    // Delivery fee / minimum order / free delivery are defined ONLY by the per-city configuration.
    const threshold = (Number.isFinite(parseFloat(cityEntry?.freeDeliveryAmount)))
        ? Math.max(0, parseFloat(cityEntry.freeDeliveryAmount))
        : null;

    if (threshold !== null && subtotal >= threshold) return 0;
    return Math.max(0, baseFee);
}

function decorateOrderPayment(order) {
    const src = (order && typeof order === 'object') ? order : {};
    const paymentObj = (src.payment && typeof src.payment === 'object') ? src.payment : {};

    const method = (paymentObj.method || src.paymentMethod || src.payment_method || '').toString().trim().toLowerCase() || 'cash';
    const status = (paymentObj.status || src.paymentStatus || src.payment_status || '').toString().trim().toLowerCase() || (method === 'card' ? 'pending' : 'unpaid');

    return {
        ...src,
        payment: {
            ...paymentObj,
            method,
            status
        },
        paymentMethod: method,
        paymentStatus: status
    };
}

function getOrderTimestampMs(order) {
    const ts = order?.timestamp || order?.createdAt || order?.updatedAt;
    const ms = ts ? new Date(ts).getTime() : NaN;
    return Number.isFinite(ms) ? ms : NaN;
}

function parseYmdDateString(value) {
    const str = (value || '').toString().trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    return { year, month, day };
}

function parseDateOrYmdToMs(value, tzOffsetMinutes, endOfDay) {
    const raw = (value || '').toString().trim();
    if (!raw) return null;

    const ymd = parseYmdDateString(raw);
    if (ymd) {
        const offsetMs = (Number(tzOffsetMinutes) || 0) * 60 * 1000;
        const h = endOfDay ? 23 : 0;
        const mi = endOfDay ? 59 : 0;
        const s = endOfDay ? 59 : 0;
        const ms = endOfDay ? 999 : 0;
        return Date.UTC(ymd.year, ymd.month - 1, ymd.day, h, mi, s, ms) + offsetMs;
    }

    const parsed = new Date(raw);
    const t = parsed.getTime();
    return Number.isFinite(t) ? t : null;
}

function computeTodayYmdForOffset(tzOffsetMinutes) {
    const offsetMs = (Number(tzOffsetMinutes) || 0) * 60 * 1000;
    const shifted = new Date(Date.now() - offsetMs);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get all orders (admin only - filtered by restaurant)
app.get(API_PREFIX + '/orders', requireAuthOrApiKey, (req, res) => {
    try {
        const data = readDatabase();
        const orders = data.orders || [];
        
        // Filter orders by restaurant
        let restaurantOrders = orders.filter(order => isOrderForRestaurant(order, req.restaurantId, data));

        const statusQuery = (req.query.status || '').toString().trim();
        if (statusQuery) {
            const normalized = normalizeOrderStatus(statusQuery);
            restaurantOrders = restaurantOrders.filter(o => normalizeOrderStatus(o.status) === normalized);
        }

        const tzOffsetMinutes = Number.isFinite(Number(req.query.tzOffsetMinutes))
            ? Number(req.query.tzOffsetMinutes)
            : 0;

        let fromRaw = (req.query.from || '').toString().trim();
        let toRaw = (req.query.to || '').toString().trim();
        const dateRaw = (req.query.date || '').toString().trim();

        if (dateRaw && !fromRaw && !toRaw) {
            fromRaw = dateRaw;
            toRaw = dateRaw;
        }
        if (fromRaw && !toRaw) toRaw = fromRaw;
        if (!fromRaw && toRaw) fromRaw = toRaw;

        const fromMs = parseDateOrYmdToMs(fromRaw, tzOffsetMinutes, false);
        const toMs = parseDateOrYmdToMs(toRaw, tzOffsetMinutes, true);
        if (fromMs != null || toMs != null) {
            restaurantOrders = restaurantOrders.filter(o => {
                const t = getOrderTimestampMs(o);
                if (!Number.isFinite(t)) return false;
                if (fromMs != null && t < fromMs) return false;
                if (toMs != null && t > toMs) return false;
                return true;
            });
        }

        res.json(restaurantOrders.map(decorateOrderPayment));
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve orders' });
    }
});

// Get today's orders (filtered by restaurant)
// Optional query: tzOffsetMinutes (from JS Date.getTimezoneOffset())
// Optional query: status
app.get(API_PREFIX + '/orders/today', requireAuthOrApiKey, (req, res) => {
    try {
        const tzOffsetMinutes = Number.isFinite(Number(req.query.tzOffsetMinutes))
            ? Number(req.query.tzOffsetMinutes)
            : 0;

        const todayYmd = computeTodayYmdForOffset(tzOffsetMinutes);
        const fromMs = parseDateOrYmdToMs(todayYmd, tzOffsetMinutes, false);
        const toMs = parseDateOrYmdToMs(todayYmd, tzOffsetMinutes, true);

        const data = readDatabase();
        const orders = data.orders || [];
        let restaurantOrders = orders.filter(order => isOrderForRestaurant(order, req.restaurantId, data));

        const statusQuery = (req.query.status || '').toString().trim();
        if (statusQuery) {
            const normalized = normalizeOrderStatus(statusQuery);
            restaurantOrders = restaurantOrders.filter(o => normalizeOrderStatus(o.status) === normalized);
        }

        restaurantOrders = restaurantOrders
            .filter(o => {
                const t = getOrderTimestampMs(o);
                if (!Number.isFinite(t)) return false;
                return t >= fromMs && t <= toMs;
            })
            .sort((a, b) => getOrderTimestampMs(b) - getOrderTimestampMs(a));

        res.json(restaurantOrders.map(decorateOrderPayment));
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve today\'s orders' });
    }
});

// Get pending orders (admin only - filtered by restaurant)
app.get(API_PREFIX + '/orders/pending', requireAuthOrApiKey, (req, res) => {
    try {
        const data = readDatabase();
        const orders = data.orders || [];
        
        // Filter by restaurant and pending status
        const pendingOrders = orders.filter(order => 
            isOrderForRestaurant(order, req.restaurantId, data) && order.status === 'pending'
        );
        res.json(pendingOrders.map(decorateOrderPayment));
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
        
        res.json(pendingOrders.map(decorateOrderPayment));
    } catch (error) {
        console.error('Error retrieving mobile pending orders:', error);
        res.status(500).json({ error: 'Failed to retrieve pending orders' });
    }
});

// Mark order as printed (Bearer token or API key)
app.post(API_PREFIX + '/orders/:id/printed', requireAuthOrApiKey, (req, res) => {
    try {
        const orderId = req.params.id;
        const { printedAt, printerIp, printerPort, source } = req.body || {};

        const data = readDatabase();
        if (!data.orders) {
            return res.status(404).json({ error: 'No orders found' });
        }

        const idx = data.orders.findIndex(o => o && o.id === orderId);
        if (idx === -1) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = data.orders[idx];
        if (!isOrderForRestaurant(order, req.restaurantId, data)) {
            return res.status(403).json({ error: 'Access denied - order belongs to different restaurant' });
        }

        const nowIso = new Date().toISOString();
        order.printerPrintedAt = (printedAt ? new Date(printedAt).toISOString() : nowIso);
        order.printerPrintedBy = (source || req.username || req.restaurantName || 'printer-agent').toString();
        if (printerIp) order.printerPrintedIp = String(printerIp).trim();
        if (printerPort != null) order.printerPrintedPort = parseInt(printerPort, 10) || 9100;

        // If an order was reprinted via reprintRequested=true, clear the flag after a successful print.
        // Otherwise the printer agent will keep reprinting on every poll.
        if (order.reprintRequested === true) {
            order.reprintRequested = false;
            order.reprintRequestedClearedAt = nowIso;
            order.reprintRequestedClearedBy = (source || req.username || req.restaurantName || 'printer-agent').toString();
        }

        order.updatedAt = nowIso;

        data.orders[idx] = order;
        writeDatabase(data);

        res.json({ success: true, orderId, printerPrintedAt: order.printerPrintedAt });
    } catch (error) {
        console.error('Error marking order as printed:', error);
        res.status(500).json({ error: 'Failed to mark order as printed' });
    }
});

// Request order reprint (Bearer token or API key)
// Used by mobile "Confirmed" tab to trigger the printer agent to reprint an order.
app.post(API_PREFIX + '/orders/:id/reprint', requireAuthOrApiKey, (req, res) => {
    try {
        const orderId = req.params.id;

        const data = readDatabase();
        if (!data.orders) {
            return res.status(404).json({ success: false, message: 'No orders found', expired: true });
        }

        const idx = data.orders.findIndex(o => o && o.id === orderId);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Order not found', expired: true });
        }

        const order = data.orders[idx];
        if (!isOrderForRestaurant(order, req.restaurantId, data)) {
            return res.status(403).json({ success: false, message: 'Access denied', expired: false });
        }

        // Professional reprint flow:
        // - Reset the printed markers ONLY.
        // - Do not change updatedAt, do not set timestamps, do not rely on time comparisons.
        // The printer agent will see printerPrintedAt=null and will print exactly once,
        // then it will call /orders/:id/printed which stores a new printerPrintedAt.
        order.printerPrintedAt = null;
        order.printerPrintedBy = null;

        data.orders[idx] = order;
        writeDatabase(data);

        res.json({ success: true, expired: false, orderId });
    } catch (error) {
        console.error('Error requesting order reprint:', error);
        res.status(500).json({ success: false, message: 'Failed to request reprint', expired: false });
    }
});

// Request order NOTE reprint (Bearer token or API key)
// Used by mobile to print only the order note (customer notes) by order ID.
app.post(API_PREFIX + '/orders/:id/reprint-note', requireAuthOrApiKey, (req, res) => {
    try {
        const orderId = req.params.id;

        const data = readDatabase();
        if (!data.orders) {
            return res.status(404).json({ success: false, message: 'No orders found', expired: true });
        }

        const idx = data.orders.findIndex(o => o && o.id === orderId);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Order not found', expired: true });
        }

        const order = data.orders[idx];
        if (!isOrderForRestaurant(order, req.restaurantId, data)) {
            return res.status(403).json({ success: false, message: 'Access denied', expired: false });
        }

        const nowIso = new Date().toISOString();
        order.forceReprintNote = true;
        order.forceReprintNoteRequestedAt = nowIso;
        order.forceReprintNoteRequestedBy = (req.username || req.restaurantName || 'api').toString();
        order.updatedAt = nowIso;

        data.orders[idx] = order;
        writeDatabase(data);

        res.json({ success: true, message: 'Note reprint requested', expired: false, orderId });
    } catch (error) {
        console.error('Error requesting order note reprint:', error);
        res.status(500).json({ success: false, message: 'Failed to request note reprint', expired: false });
    }
});

// Clear order reprint flag (Bearer token or API key)
// Called by printer agent after a successful print so the order returns to normal printed behavior.
app.post(API_PREFIX + '/orders/:id/clear-reprint', requireAuthOrApiKey, (req, res) => {
    try {
        const orderId = req.params.id;

        const data = readDatabase();
        if (!data.orders) {
            return res.status(404).json({ success: false, message: 'No orders found' });
        }

        const idx = data.orders.findIndex(o => o && o.id === orderId);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const order = data.orders[idx];
        if (!isOrderForRestaurant(order, req.restaurantId, data)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const nowIso = new Date().toISOString();
        order.forceReprint = false;
        order.forceReprintClearedAt = nowIso;
        order.forceReprintClearedBy = (req.username || req.restaurantName || 'api').toString();
        order.updatedAt = nowIso;

        data.orders[idx] = order;
        writeDatabase(data);

        res.json({ success: true, message: 'Reprint flag cleared', orderId });
    } catch (error) {
        console.error('Error clearing reprint flag:', error);
        res.status(500).json({ success: false, message: 'Failed to clear reprint flag' });
    }
});

// Clear order NOTE reprint flag (Bearer token or API key)
// Called by printer agent after a successful note-only print.
app.post(API_PREFIX + '/orders/:id/clear-reprint-note', requireAuthOrApiKey, (req, res) => {
    try {
        const orderId = req.params.id;

        const data = readDatabase();
        if (!data.orders) {
            return res.status(404).json({ success: false, message: 'No orders found' });
        }

        const idx = data.orders.findIndex(o => o && o.id === orderId);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const order = data.orders[idx];
        if (!isOrderForRestaurant(order, req.restaurantId, data)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const nowIso = new Date().toISOString();
        order.forceReprintNote = false;
        order.forceReprintNoteClearedAt = nowIso;
        order.forceReprintNoteClearedBy = (req.username || req.restaurantName || 'api').toString();
        order.updatedAt = nowIso;

        data.orders[idx] = order;
        writeDatabase(data);

        res.json({ success: true, message: 'Note reprint flag cleared', orderId });
    } catch (error) {
        console.error('Error clearing note reprint flag:', error);
        res.status(500).json({ success: false, message: 'Failed to clear note reprint flag' });
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

            const restaurant = (data.restaurants || []).find(r => r && r.id === req.restaurantId);
            const printerNormalized = normalizePrinterConfig(restaurant?.printer);
            const printerCfg = printerNormalized.ok
                ? printerNormalized.value
                : { enabled: false, ip: '', port: 9100, autoPrintOnApproved: true, printPickup: true, allowAutoDiscovery: false };

            const method = (order.deliveryMethod || order.deliveryType || '').toString();
            const isPickup = method === 'pickup';
            const hasTargetPrinter = !!printerCfg.ip || printerCfg.allowAutoDiscovery;
            const shouldPrint = printerCfg.enabled && printerCfg.autoPrintOnApproved && hasTargetPrinter && (!isPickup || printerCfg.printPickup);

            if (shouldPrint) {
                console.log(`Printing receipt... (configured=${!!printerCfg.ip}, autoDiscovery=${printerCfg.allowAutoDiscovery})`);
                const printerTarget = printerCfg.ip ? { ip: printerCfg.ip, port: printerCfg.port } : null;
                printOrder(order, printerTarget)
                    .then(printResult => {
                        if (printResult.success) {
                            console.log('Order printed successfully to:', printResult.printer);
                        } else {
                            console.error('Printing failed:', printResult.error);
                        }
                    })
                    .catch(err => {
                        console.error('Printing error:', err);
                    });
            } else {
                console.log('Printing skipped (printer disabled or settings)');
            }

            if (method === 'delivery') {
                try {
                    const deliveryResult = await sendToDeliveryService(order, { eurToBgnRate: data?.currencySettings?.eurToBgnRate });
                    if (deliveryResult.success) {
                        order.deliveryServiceId = deliveryResult.deliveryId;
                        console.log('Order sent to delivery service:', deliveryResult.deliveryId);
                    }
                } catch (err) {
                    console.error('Delivery service error:', err);
                }
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
        // Prevent intermediary/proxy caching of tracking responses.
        res.set('Cache-Control', 'no-store');

        const orderId = (req.params.id ?? '').toString().trim();
        const data = readDatabase();
        const orders = data.orders || [];
        
        const order = orders.find(o => {
            const candidates = [
                o?.id,
                o?.orderId,
                o?.order_id,
                o?.payment?.order6,
                o?.payment?.providerOrderId,
                o?.payment?.provider_order_id,
                o?.providerOrderId,
            ]
                .filter((v) => v != null)
                .map((v) => String(v).trim())
                .filter(Boolean);

            return candidates.some((c) => c === orderId);
        });
        
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

        function sanitizeOrderItemsLoose(itemsLike) {
            if (!Array.isArray(itemsLike)) return null;

            const sanitized = itemsLike
                .map(it => {
                    const raw = (it && typeof it === 'object') ? it : {};
                    const name = (raw.name || raw.baseName || raw.title || raw.productName || raw.itemName || '').toString().trim();
                    const qtyRaw = raw.quantity ?? raw.qty ?? raw.count ?? raw.amount ?? raw.q;
                    const quantity = Math.max(0, Math.floor(parseNumber(qtyRaw, 0)));
                    const priceRaw = raw.price ?? raw.unitPrice ?? raw.unit_price ?? raw.priceEUR ?? raw.value;
                    const price = Math.max(0, parseNumber(priceRaw, 0));

                    const originalPriceRaw = raw.originalPrice ?? raw.original_price;
                    const originalParsed = parseNumber(originalPriceRaw, NaN);
                    const originalPrice = Number.isFinite(originalParsed) ? Math.max(0, originalParsed) : undefined;

                    const noteRaw = (raw.note || raw.notes || raw.comment || raw.remark || '').toString();
                    const note = noteRaw.replace(/\r/g, '').trim();
                    const discountLabelRaw = (raw.discountLabel || raw.discount_label || '').toString().replace(/\r/g, '').trim();
                    const discountLabel = discountLabelRaw ? discountLabelRaw.slice(0, 80) : '';

                    const id = raw.id ?? raw.productId ?? raw.itemId;
                    const weight = raw.weight;
                    const image = raw.image;

                    return {
                        ...(id !== undefined ? { id } : {}),
                        name,
                        price,
                        ...(originalPrice !== undefined ? { originalPrice } : {}),
                        quantity,
                        ...(weight !== undefined ? { weight } : {}),
                        ...(image !== undefined ? { image } : {}),
                        ...(note ? { note: note.slice(0, 500) } : {}),
                        ...(discountLabel ? { discountLabel } : {})
                    };
                })
                .filter(it => it.name && it.quantity > 0);

            return sanitized.length ? sanitized : null;
        }

        let items = sanitizeOrderItems(order.items);
        if (!items) {
            items = sanitizeOrderItemsLoose(order.items);
        }
        if (!items) {
            items = [];
        }

        function extractPromoCodeAny(o) {
            const candidates = [
                o?.promoCode,
                o?.promo_code,
                o?.promo,
                o?.promo?.code,
                o?.coupon,
                o?.couponCode,
                o?.coupon_code,
                o?.coupon?.code,
                o?.discountCode,
                o?.discount_code
            ];
            for (const c of candidates) {
                if (typeof c === 'string') {
                    const trimmed = c.trim();
                    if (trimmed) return trimmed;
                }
            }
            return '';
        }

        // Some legacy/alternate order writers may omit computed totals or use different keys.
        // Derive safe display values for public tracking pages.
        const computedItemsSubtotal = (items || []).reduce((sum, it) => sum + (parseNumber(it.price, 0) * parseNumber(it.quantity, 0)), 0);
        const subtotalRaw = order.subtotal ?? order.sub_total ?? order.itemsSubtotal ?? order.items_subtotal;
        const subtotalNum = parseNumber(subtotalRaw, NaN);
        const effectiveSubtotal = (Number.isFinite(subtotalNum) && subtotalNum > 0) ? subtotalNum : computedItemsSubtotal;

        const discountPctRaw = order.discount ?? order.discountPercent ?? order.discount_percent ?? order.promoDiscount ?? order.promo_discount;
        const discountPctNum = Math.max(0, Math.min(100, parseNumber(discountPctRaw, 0)));

        const discountAmountRaw = order.discountAmount ?? order.discount_amount ?? order.promoDiscountAmount ?? order.promo_discount_amount;
        const discountAmountNumRaw = parseNumber(discountAmountRaw, NaN);
        const effectiveDiscountAmount = Number.isFinite(discountAmountNumRaw)
            ? discountAmountNumRaw
            : (effectiveSubtotal * (discountPctNum / 100));

        const deliveryFeeRaw = order.deliveryFee ?? order.delivery_fee ?? order.deliveryPrice ?? order.delivery_price;
        const deliveryFeeNum = Math.max(0, parseNumber(deliveryFeeRaw, 0));

        const totalRaw = order.total ?? order.totalAmount ?? order.total_amount;
        const totalNum = parseNumber(totalRaw, NaN);
        const effectiveTotal = Number.isFinite(totalNum)
            ? totalNum
            : Math.max(0, effectiveSubtotal - effectiveDiscountAmount + deliveryFeeNum);

        function extractHHMM(value) {
            if (value == null) return '';
            const s = String(value).trim();
            if (!s) return '';
            const m = s.match(/(\d{1,2}):(\d{2})/);
            if (!m) return '';
            const hh = m[1].padStart(2, '0');
            const mm = m[2];
            return `${hh}:${mm}`;
        }

        const scheduledTimeRaw =
            order.scheduledTime ??
            order.scheduled_time ??
            order.scheduleTime ??
            order.scheduledAt ??
            order.scheduled_for;
        const scheduledTime = extractHHMM(scheduledTimeRaw);
        const inferredOrderTime = scheduledTime ? 'later' : undefined;

        const apiVersion = '2026-02-20-track-v2';

        // Return limited order info (hide sensitive data)
        const orderNote = (order?.customerInfo?.notes || '').toString().replace(/\r/g, '').trim();

        const publicOrderInfo = {
            id: order.id,
            status: order.status,
            currency: 'EUR',
            subtotal: parseNumber(effectiveSubtotal, 0),
            discount: discountPctNum,
            discountAmount: parseNumber(effectiveDiscountAmount, 0),
            deliveryFee: parseNumber(deliveryFeeNum, 0),
            promoCode: extractPromoCodeAny(order) || null,
            total: parseNumber(effectiveTotal, 0),
            deliveryMethod: order.deliveryMethod,
            estimatedTime: order.estimatedTime || 60,
            createdAt: order.createdAt,
            trackingExpiry: order.trackingExpiry,
            orderTime: ((order.orderTime === 'now' || order.orderTime === 'later') ? order.orderTime : inferredOrderTime) || null,
            scheduledTime: scheduledTime || null,
            orderNote: orderNote || null,
            items,
            customerInfo: order.deliveryMethod === 'delivery' ? {
                city: order.customerInfo?.city,
                address: order.customerInfo?.address
            } : null
        };

        res.json({ success: true, apiVersion, order: publicOrderInfo });
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

        // Be tolerant of legacy/alternate clients.
        const promoCodeAny = promoCode ?? req.body?.promo_code ?? req.body?.couponCode ?? req.body?.coupon_code;
        const totalAny = total ?? req.body?.totalAmount ?? req.body?.total_amount;
        
        // Get restaurant ID from body or X-Restaurant-Id header.
        // In single-restaurant deployments we allow a safe fallback.
        let targetRestaurantId = restaurantId || req.headers['x-restaurant-id'];
        
        const sanitizedItems = sanitizeOrderItems(items);
        if (!sanitizedItems || sanitizedItems.length === 0 || !customerInfo || !deliveryMethod) {
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

        if (data.orderSettings?.temporarilyClosed === true) {
            return res.status(423).json({
                error: 'Restaurant temporarily closed',
                message: 'Restaurant is temporarily closed and not accepting orders'
            });
        }

        // Working hours enforcement (server-side)
        // - Manual close: always blocks.
        // - Outside hours: blocks "order now"; scheduled orders are allowed only if orderSettings.allowOrderLater is enabled and scheduledTime is within the allowed window.
        const orderSettings = data.orderSettings || {};
        const allowOrderLater = orderSettings.allowOrderLater !== false;

        // Fulfillment method enable/disable (server-side)
        const pickupEnabled = orderSettings.pickupEnabled !== false;
        const deliveryEnabled = data.deliverySettings?.deliveryEnabled !== false;
        const normalizedDeliveryMethod = (deliveryMethod === 'delivery' || deliveryType === 'delivery')
            ? 'delivery'
            : (deliveryMethod === 'pickup' ? 'pickup' : null);

        if (!normalizedDeliveryMethod) {
            return res.status(400).json({
                error: 'Invalid deliveryMethod',
                message: 'deliveryMethod must be either "delivery" or "pickup"'
            });
        }

        if ((normalizedDeliveryMethod === 'delivery' && !deliveryEnabled) || (normalizedDeliveryMethod === 'pickup' && !pickupEnabled)) {
            return res.status(423).json({
                error: 'Ordering method disabled',
                message: normalizedDeliveryMethod === 'delivery'
                    ? 'Delivery orders are currently disabled by the restaurant'
                    : 'Pickup orders are currently disabled by the restaurant'
            });
        }

        const workingHours = data.workingHours || { openingTime: '09:00', closingTime: '22:00' };
        const deliveryHours = (data.deliverySettings && data.deliverySettings.deliveryHours) || { openingTime: '11:00', closingTime: '21:30' };

        const whForNow = getWorkingHoursForDate(workingHours, new Date(), DEFAULT_WORKING_HOURS_TZ);
        const workingHoursNormalized = normalizeWorkingHoursConfig(workingHours);

        const whOpen = parseHHMMToMinutes(whForNow.openingTime) ?? (9 * 60);
        const whClose = parseHHMMToMinutes(whForNow.closingTime) ?? (22 * 60);
        const dhOpen = parseHHMMToMinutes(deliveryHours.openingTime) ?? (11 * 60);
        const dhClose = parseHHMMToMinutes(deliveryHours.closingTime) ?? (21 * 60 + 30);

        const nowMinutes = getMinutesOfDayInTimeZone('Europe/Sofia') ?? (new Date().getHours() * 60 + new Date().getMinutes());

        const requiresDeliveryWindow = normalizedDeliveryMethod === 'delivery';
        const withinWorking = (whForNow.closed === true)
            ? false
            : isMinutesWithinWindow(nowMinutes, whOpen, whClose);
        const withinDelivery = !requiresDeliveryWindow || isMinutesWithinWindow(nowMinutes, dhOpen, dhClose);

        const normalizedOrderTime = (orderTime === 'now' || orderTime === 'later') ? orderTime : 'now';
        const scheduledMinutes = parseHHMMToMinutes(typeof scheduledTime === 'string' ? scheduledTime : '');

        if (normalizedOrderTime === 'later') {
            if (!allowOrderLater) {
                return res.status(423).json({
                    error: 'Ordering later is disabled',
                    message: 'Scheduling orders for later is disabled by the restaurant'
                });
            }
            if (!Number.isFinite(scheduledMinutes)) {
                return res.status(400).json({
                    error: 'Invalid scheduledTime',
                    message: 'scheduledTime must be in HH:MM format'
                });
            }

            const withinScheduledWorking = (whForNow.closed === true)
                ? false
                : isMinutesWithinWindow(scheduledMinutes, whOpen, whClose);
            const withinScheduledDelivery = !requiresDeliveryWindow || isMinutesWithinWindow(scheduledMinutes, dhOpen, dhClose);
            if (!withinScheduledWorking || !withinScheduledDelivery) {
                return res.status(423).json({
                    error: 'Restaurant closed',
                    reason: 'hours',
                    message: 'The restaurant is not accepting orders at the selected time',
                    workingHours: workingHoursNormalized,
                    deliveryHours
                });
            }
        } else {
            if (!withinWorking || !withinDelivery) {
                return res.status(423).json({
                    error: 'Restaurant closed',
                    reason: 'hours',
                    message: 'The restaurant is not accepting orders right now',
                    workingHours: workingHoursNormalized,
                    deliveryHours
                });
            }
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

        // Verify ordered items exist and are orderable
        const unavailableItems = [];
        for (const item of sanitizedItems) {
            const itemId = item?.id;
            const parsedId = (itemId === undefined || itemId === null) ? NaN : parseInt(itemId, 10);
            if (!Number.isFinite(parsedId)) {
                // Legacy clients might not send IDs; skip strict enforcement.
                continue;
            }

            const product = (data.products || []).find(p => p && p.id === parsedId);
            if (!product) {
                unavailableItems.push({ id: parsedId, name: item?.name || '' });
                continue;
            }
            if (!isProductOrderable(product)) {
                unavailableItems.push({ id: parsedId, name: product?.name || item?.name || '', status: getProductAvailabilityStatus(product) });
            }
        }

        if (unavailableItems.length > 0) {
            return res.status(409).json({
                error: 'Some items are not available',
                items: unavailableItems
            });
        }

        // Count previous orders from this phone number FOR THIS RESTAURANT ONLY
        const previousOrders = data.orders.filter(
            o => o.restaurantId === targetRestaurantId && 
                 o.customerInfo && 
                 o.customerInfo.phone === customerInfo.phone
        ).length;

        const createdAt = new Date();
        const trackingExpiry = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

        const customerNotesRaw = (customerInfo?.notes || '').toString().replace(/\r/g, '').trim();
        const customerNotes = customerNotesRaw ? customerNotesRaw.slice(0, 1000) : '';

        const newOrder = {
            id: 'order_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            restaurantId: targetRestaurantId,
            restaurantName: restaurant.name,
            items: sanitizedItems,
            promoCode: (promoCodeAny || '').toString().trim() || undefined,
            discount: 0,
            total: parseNumber(totalAny, 0),
            reprintRequested: false,
            // Keep existing field for backward compatibility across UI surfaces
            deliveryMethod,
            // Normalized field for future flows
            deliveryType: deliveryType || deliveryMethod,
            deliveryFee: typeof deliveryFee === 'number' ? deliveryFee : (deliveryFee ? Number(deliveryFee) : 0),
            orderTime: (orderTime === 'now' || orderTime === 'later') ? orderTime : undefined,
            scheduledTime: (typeof scheduledTime === 'string' && scheduledTime.trim()) ? scheduledTime.trim() : undefined,
            customerInfo: {
                ...customerInfo,
                ...(customerNotes ? { notes: customerNotes } : {}),
                previousOrders: previousOrders
            },
            timestamp: timestamp || createdAt.toISOString(),
            status: 'pending',
            createdAt: createdAt.toISOString(),
            trackingExpiry: trackingExpiry.toISOString()
        };

        // Enforce promo validity server-side (active + date window + method + target eligibility).
        const promoCodeNormalized = (newOrder.promoCode || '').toString().trim().toLowerCase();
        if (promoCodeNormalized) {
            const promo = (data.promoCodes || []).find(pc => (pc?.code || '').toString().trim().toLowerCase() === promoCodeNormalized);
            if (!promo || !promo.isActive || !isPromoWindowActiveNow(promo)) {
                return res.status(400).json({
                    error: 'Invalid promo code',
                    message: 'Promo code is invalid or expired'
                });
            }

            const allowed = (promo.allowedMethod || 'all').toString().trim().toLowerCase();
            if ((allowed === 'delivery' || allowed === 'pickup') && allowed !== normalizedDeliveryMethod) {
                return res.status(400).json({
                    error: 'Promo code not valid for delivery method',
                    message: 'Promo code is not allowed for this delivery method',
                    allowedMethod: allowed,
                    deliveryMethod: normalizedDeliveryMethod
                });
            }

            const eligibleSubtotal = computePromoEligibleSubtotal(sanitizedItems, promo, data);
            if (!(eligibleSubtotal > 0)) {
                return res.status(400).json({
                    error: 'Promo code not applicable',
                    message: 'Promo code does not apply to the items in your cart'
                });
            }

            newOrder.discount = Math.max(0, Math.min(100, parseNumber(promo.discount, 0)));
            newOrder.discountBaseSubtotal = eligibleSubtotal;
        }

        // Enforce delivery fee/free-delivery server-side (do not trust client-provided deliveryFee).
        const itemsSubtotal = (sanitizedItems || []).reduce((sum, it) => sum + (parseNumber(it.price, 0) * parseNumber(it.quantity, 0)), 0);
        const deliverySettings = data.deliverySettings || {};
        if (normalizedDeliveryMethod === 'delivery') {
            const city = (newOrder.customerInfo?.city || '').toString().trim();
            newOrder.deliveryFee = computeEffectiveDeliveryFee(deliverySettings, city, itemsSubtotal);
        } else {
            newOrder.deliveryFee = 0;
        }

        // Ensure totals are consistent server-side (and rounded correctly).
        recomputeOrderTotals(newOrder, data);

        // Enforce minimum order amount (server-side)
        // Rules are defined ONLY by the per-city configuration (delivery only). Pickup has no minimum.
        let effectiveMinAmount = 0;
        if (normalizedDeliveryMethod === 'delivery') {
            const city = (newOrder.customerInfo?.city || '').toString().trim();
            const cityEntry = getCityDeliveryEntry(deliverySettings, city);
            const cityMin = cityEntry && Number.isFinite(parseFloat(cityEntry.minimumOrderAmount))
                ? Math.max(0, parseFloat(cityEntry.minimumOrderAmount))
                : 0;
            effectiveMinAmount = cityMin;
        }

        // Minimum order compares against items subtotal (excluding delivery fee).
        if (effectiveMinAmount > 0 && parseNumber(newOrder.subtotal, 0) < effectiveMinAmount) {
            return res.status(400).json({
                error: 'Minimum order amount not reached',
                message: 'Order total is below the minimum required amount',
                minimumOrderAmount: effectiveMinAmount,
                currentSubtotal: parseNumber(newOrder.subtotal, 0),
                deliveryMethod: normalizedDeliveryMethod
            });
        }

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
                    ? parseNumber(newOrder.total, 0) * eurToBgnRate
                    : parseNumber(newOrder.total, 0);

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
                if (!writeDatabase(data)) {
                    return res.status(500).json({ error: 'Failed to persist order' });
                }

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
            const amountBGN = parseNumber(newOrder.total, 0) * eurToBgnRate;
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
            if (!writeDatabase(data)) {
                return res.status(500).json({ error: 'Failed to persist order' });
            }

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

        // Cash (or non-card) orders: store explicit payment metadata for printing/UI.
        newOrder.payment = {
            method: normalizedPaymentMethod || 'cash',
            status: 'unpaid'
        };
        newOrder.paymentMethod = newOrder.payment.method;
        newOrder.paymentStatus = newOrder.payment.status;

        const shouldAutoApprove = orderSettings.autoApproveOrders === true
            && newOrder.status === 'pending';

        if (shouldAutoApprove) {
            const nowIso = new Date().toISOString();
            newOrder.status = 'approved';
            newOrder.approvedAt = newOrder.approvedAt || nowIso;
            newOrder.updatedAt = nowIso;
        }

        data.orders.push(newOrder);
        if (!writeDatabase(data)) {
            return res.status(500).json({ error: 'Failed to persist order' });
        }

        if (shouldAutoApprove) {
            // Fire-and-forget: reuse the same side-effects as manual approval.
            setImmediate(() => {
                try {
                    const printerNormalized = normalizePrinterConfig(restaurant?.printer);
                    const printerCfg = printerNormalized.ok
                        ? printerNormalized.value
                        : { enabled: false, ip: '', port: 9100, autoPrintOnApproved: true, printPickup: true, allowAutoDiscovery: false };

                    const method = (newOrder.deliveryMethod || newOrder.deliveryType || '').toString();
                    const isPickup = method === 'pickup';
                    const hasTargetPrinter = !!printerCfg.ip || printerCfg.allowAutoDiscovery;
                    const shouldPrint = printerCfg.enabled && printerCfg.autoPrintOnApproved && hasTargetPrinter && (!isPickup || printerCfg.printPickup);

                    if (shouldPrint) {
                        const printerTarget = printerCfg.ip ? { ip: printerCfg.ip, port: printerCfg.port } : null;
                        printOrder(newOrder, printerTarget)
                            .then(printResult => {
                                if (printResult.success) {
                                    console.log('Order auto-approved and printed successfully to:', printResult.printer);
                                } else {
                                    console.error('Auto-approved order print failed:', printResult.error);
                                }
                            })
                            .catch(err => console.error('Auto-approved order print error:', err));
                    }

                    // Email customer on approval (non-blocking)
                    try {
                        sendOrderStatusEmail(newOrder, 'approved')
                            .then(() => console.log('[EMAIL] auto-approved order email attempted:', newOrder.id))
                            .catch(err => console.error('[EMAIL] auto-approved order email failed:', err));
                    } catch (e) {
                        console.error('[EMAIL] auto-approved order email error:', e);
                    }
                } catch (e) {
                    console.error('Error processing auto-approved order side-effects:', e);
                }
            });

            if ((newOrder.deliveryMethod || newOrder.deliveryType) === 'delivery') {
                setImmediate(() => {
                    (async () => {
                        try {
                            const deliveryResult = await sendToDeliveryService(newOrder, { eurToBgnRate: data?.currencySettings?.eurToBgnRate });

                            if (!deliveryResult.success) {
                                console.error('Failed to send auto-approved order to delivery service:', deliveryResult.error);
                                return;
                            }

                            const db2 = readDatabase();
                            const idx = (db2.orders || []).findIndex(o => o && o.id === newOrder.id);
                            if (idx === -1) return;

                            db2.orders[idx].deliveryServiceId = deliveryResult.deliveryId;
                            db2.orders[idx].deliveryClientId = deliveryResult.clientId;
                            db2.orders[idx].updatedAt = new Date().toISOString();
                            writeDatabase(db2);
                        } catch (err) {
                            console.error('Auto-approved delivery service error:', err);
                        }
                    })();
                });
            }
        }

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
app.put(API_PREFIX + '/orders/:id', requireAuthOrApiKey, async (req, res) => {
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
            items,
            reprintRequested
        } = req.body;

        const isEditOperation = (
            deliveryMethod !== undefined ||
            deliveryType !== undefined ||
            deliveryFee !== undefined ||
            discount !== undefined ||
            promoCode !== undefined ||
            customerInfo !== undefined ||
            items !== undefined
        );

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
        if (!isOrderForRestaurant(order, req.restaurantId, data)) {
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

        // Validate final customer email (required for edits that touch customer/order fields).
        // Status-only updates from mobile clients should not fail if legacy orders lack email.
        if (isEditOperation && !isValidEmail(order.customerInfo?.email)) {
            return res.status(400).json({ error: 'Valid customer email is required' });
        }

        // Validate delivery fields for delivery orders (only when editing).
        if (isEditOperation && (order.deliveryMethod || order.deliveryType) === 'delivery') {
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

        // Allow clients (e.g. mobile app) to request a reprint without changing status.
        // This is separate from forceReprint (used by /orders/:id/reprint).
        if (reprintRequested !== undefined) {
            const nowIso = new Date().toISOString();
            const requested = coerceBoolean(reprintRequested, false);
            order.reprintRequested = requested;
            if (requested) {
                order.reprintRequestedAt = nowIso;
                order.reprintRequestedBy = (req.username || req.restaurantName || 'api').toString();
            } else {
                order.reprintRequestedClearedAt = nowIso;
                order.reprintRequestedClearedBy = (req.username || req.restaurantName || 'api').toString();
            }
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
        recomputeOrderTotals(order, data);

        // Ако статусът е 'approved'
        if (hasStatusUpdate && normalizedStatus === 'approved' && previousStatus !== 'approved') {
            console.log('Order approved, processing...');

            const restaurant = (data.restaurants || []).find(r => r && r.id === req.restaurantId);
            const printerNormalized = normalizePrinterConfig(restaurant?.printer);
            const printerCfg = printerNormalized.ok
                ? printerNormalized.value
                : { enabled: false, ip: '', port: 9100, autoPrintOnApproved: true, printPickup: true, allowAutoDiscovery: false };

            const method = (order.deliveryMethod || order.deliveryType || '').toString();
            const isPickup = method === 'pickup';
            const hasTargetPrinter = !!printerCfg.ip || printerCfg.allowAutoDiscovery;
            const shouldPrint = printerCfg.enabled && printerCfg.autoPrintOnApproved && hasTargetPrinter && (!isPickup || printerCfg.printPickup);

            if (shouldPrint) {
                console.log(`Printing receipt... (configured=${!!printerCfg.ip}, autoDiscovery=${printerCfg.allowAutoDiscovery})`);
                const printerTarget = printerCfg.ip ? { ip: printerCfg.ip, port: printerCfg.port } : null;
                printOrder(order, printerTarget)
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
            } else {
                console.log('Printing skipped (printer disabled or settings)');
            }

            if (method === 'delivery') {
                try {
                    const deliveryResult = await sendToDeliveryService(order, { eurToBgnRate: data?.currencySettings?.eurToBgnRate });

                    if (deliveryResult.success) {
                        console.log('Order sent to delivery service:', deliveryResult.deliveryId);
                        order.deliveryServiceId = deliveryResult.deliveryId;
                        order.deliveryClientId = deliveryResult.clientId;
                    } else {
                        console.error('Failed to send to delivery service:', deliveryResult.error);
                    }
                } catch (err) {
                    console.error('Delivery service error:', err);
                }
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isPrivateIPv4(ip) {
    const s = (ip || '').toString().trim();
    if (!looksLikeIPv4(s)) return false;
    if (s.startsWith('10.')) return true;
    if (s.startsWith('192.168.')) return true;
    if (s.startsWith('127.')) return true;
    if (s.startsWith('169.254.')) return true;
    const parts = s.split('.').map(n => parseInt(n, 10));
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    return false;
}

function ensureAgentStore(data) {
    if (!data || typeof data !== 'object') return { commands: [], results: {} };
    if (!data.agent || typeof data.agent !== 'object') data.agent = {};
    if (!Array.isArray(data.agent.commands)) data.agent.commands = [];
    if (!data.agent.results || typeof data.agent.results !== 'object') data.agent.results = {};
    return data.agent;
}

function generateAgentCommandId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function enqueueAgentCommand(data, restaurantId, type, payload) {
    const agent = ensureAgentStore(data);
    const now = new Date().toISOString();
    const cmd = {
        id: generateAgentCommandId(),
        restaurantId: String(restaurantId || ''),
        type: String(type || ''),
        payload: (payload && typeof payload === 'object') ? payload : {},
        status: 'queued',
        createdAt: now,
        updatedAt: now
    };
    agent.commands.push(cmd);
    return cmd;
}

function findRecentPendingCommand(data, restaurantId, type, payload, maxAgeMs = 15000) {
    const agent = ensureAgentStore(data);
    const rid = String(restaurantId || '');
    const now = Date.now();
    const payloadStr = JSON.stringify((payload && typeof payload === 'object') ? payload : {});

    return agent.commands.find(c => {
        if (!c || c.restaurantId !== rid || c.type !== type) return false;
        if (c.status !== 'queued' && c.status !== 'dispatched') return false;
        const createdAt = c.createdAt ? new Date(c.createdAt).getTime() : 0;
        if (!createdAt || (now - createdAt) > maxAgeMs) return false;
        try {
            return JSON.stringify((c.payload && typeof c.payload === 'object') ? c.payload : {}) === payloadStr;
        } catch {
            return false;
        }
    });
}

async function waitForAgentCommandCompletion(restaurantId, commandId, timeoutMs = 6000, intervalMs = 300) {
    const rid = String(restaurantId || '');
    const started = Date.now();
    while ((Date.now() - started) < timeoutMs) {
        const data = readDatabase();
        const agent = ensureAgentStore(data);
        const cmd = agent.commands.find(c => c && c.id === commandId && c.restaurantId === rid);
        if (cmd && (cmd.status === 'completed' || cmd.status === 'failed')) return cmd;
        await delay(intervalMs);
    }
    return null;
}

// Agent commands (polled by the on-prem printer agent)
app.get(API_PREFIX + '/agent/commands', requireApiKey, (req, res) => {
    try {
        const data = readDatabase();
        const agent = ensureAgentStore(data);
        const rid = String(req.restaurantId || '');

        const queued = agent.commands
            .filter(c => c && c.restaurantId === rid && c.status === 'queued')
            .slice(0, 5);

        const now = new Date().toISOString();
        for (const c of queued) {
            c.status = 'dispatched';
            c.dispatchedAt = now;
            c.updatedAt = now;
        }

        writeDatabase(data);

        return res.json({
            success: true,
            commands: queued.map(c => ({
                id: c.id,
                type: c.type,
                payload: c.payload || {},
                createdAt: c.createdAt
            }))
        });
    } catch (e) {
        console.error('Error serving agent commands:', e);
        return res.status(500).json({ error: 'Failed to load agent commands' });
    }
});

app.post(API_PREFIX + '/agent/commands/:id/complete', requireApiKey, (req, res) => {
    try {
        const rid = String(req.restaurantId || '');
        const commandId = String(req.params.id || '');
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const ok = body.success === true;
        const result = (body.result && typeof body.result === 'object') ? body.result : null;
        const error = (body.error || '').toString();

        const data = readDatabase();
        const agent = ensureAgentStore(data);
        const cmd = agent.commands.find(c => c && c.id === commandId && c.restaurantId === rid);
        if (!cmd) {
            return res.status(404).json({ error: 'Command not found' });
        }

        const now = new Date().toISOString();
        cmd.status = ok ? 'completed' : 'failed';
        cmd.completedAt = now;
        cmd.updatedAt = now;
        if (ok) {
            cmd.result = result;
            cmd.error = '';
        } else {
            cmd.result = null;
            cmd.error = error || 'Command failed';
        }

        if (!agent.results[rid] || typeof agent.results[rid] !== 'object') agent.results[rid] = {};

        if (cmd.type === 'printer.scan' && ok) {
            const printers = Array.isArray(result?.printers) ? result.printers : [];
            agent.results[rid].printerScan = {
                printers,
                at: now,
                subnet: (result?.subnet || result?.subnetUsed || '').toString(),
                port: Number.isFinite(Number(result?.port || result?.portUsed)) ? Number(result.port || result.portUsed) : undefined,
                commandId
            };
        }

        if (cmd.type === 'printer.test') {
            agent.results[rid].printerTest = {
                success: ok,
                at: now,
                ip: (result?.ip || '').toString(),
                port: Number.isFinite(Number(result?.port)) ? Number(result.port) : undefined,
                tested: (result?.tested || result?.ip || '').toString(),
                error: ok ? '' : (cmd.error || ''),
                commandId
            };
        }

        writeDatabase(data);
        return res.json({ success: true });
    } catch (e) {
        console.error('Error completing agent command:', e);
        return res.status(500).json({ error: 'Failed to complete command' });
    }
});

// Test printer connection (Bearer token or API key)
app.get(API_PREFIX + '/printer/test', requireAuthOrApiKey, async (req, res) => {
    try {
        const ip = (req.query.ip || '').toString().trim();
        const port = Number.isFinite(Number(req.query.port)) ? Number(req.query.port) : 9100;

        if (!ip) {
            return res.status(400).json({ success: false, error: 'IP is required for printer test' });
        }

        // Private/LAN IPs must be tested from the on-prem agent network.
        if (isPrivateIPv4(ip)) {
            const restaurantId = req.restaurantId;
            const payload = { ip, port };

            let data = readDatabase();
            const existing = findRecentPendingCommand(data, restaurantId, 'printer.test', payload, 15000);
            const cmd = existing || enqueueAgentCommand(data, restaurantId, 'printer.test', payload);
            writeDatabase(data);

            const waitMs = Number.isFinite(Number(req.query.wait)) ? Math.min(15000, Math.max(0, Number(req.query.wait))) : 7000;
            if (waitMs > 0) {
                await waitForAgentCommandCompletion(restaurantId, cmd.id, waitMs, 300);
            }

            data = readDatabase();
            const agent = ensureAgentStore(data);
            const rid = String(restaurantId || '');
            const last = agent.results?.[rid]?.printerTest;

            if (last && last.commandId === cmd.id) {
                if (last.success) {
                    return res.json({ success: true, tested: last.tested || ip, port });
                }
                return res.json({ success: false, error: last.error || 'Printer test failed', tested: last.tested || ip, port });
            }

            return res.json({ success: false, error: 'Printer test queued. Please retry in a few seconds.', queued: true, commandId: cmd.id });
        }

        // Public/non-private IPs can be tested server-side.
        const { testPrinter } = require('./printer-service');
        const ok = await testPrinter(ip, port);
        return res.json({ success: ok, printers: [{ ip, port, name: `Network Printer at ${ip}` }], tested: ip, port });
    } catch (error) {
        console.error('Error testing printer:', error);
        res.status(500).json({ error: 'Failed to test printer', details: error.message });
    }
});

// Find printers on network (Bearer token or API key)
app.get(API_PREFIX + '/printer/find', requireAuthOrApiKey, async (req, res) => {
    try {
        const restaurantId = req.restaurantId;
        const subnet = (req.query.subnet || '').toString().trim();
        const port = Number.isFinite(Number(req.query.port)) ? Number(req.query.port) : undefined;
        const timeout = Number.isFinite(Number(req.query.timeout)) ? Number(req.query.timeout) : undefined;
        const concurrency = Number.isFinite(Number(req.query.concurrency)) ? Number(req.query.concurrency) : undefined;

        const payload = { subnet, port, timeout, concurrency };

        let data = readDatabase();
        const agent = ensureAgentStore(data);
        const rid = String(restaurantId || '');
        const prev = agent.results?.[rid]?.printerScan;

        const existing = findRecentPendingCommand(data, restaurantId, 'printer.scan', payload, 15000);
        const cmd = existing || enqueueAgentCommand(data, restaurantId, 'printer.scan', payload);
        writeDatabase(data);

        const waitMs = Number.isFinite(Number(req.query.wait)) ? Math.min(20000, Math.max(0, Number(req.query.wait))) : 5000;
        if (waitMs > 0) {
            await waitForAgentCommandCompletion(restaurantId, cmd.id, waitMs, 300);
        }

        data = readDatabase();
        const agent2 = ensureAgentStore(data);
        const scan = agent2.results?.[rid]?.printerScan;
        const printers = Array.isArray(scan?.printers)
            ? scan.printers
            : (Array.isArray(prev?.printers) ? prev.printers : []);

        return res.json({
            success: true,
            queued: true,
            commandId: cmd.id,
            printers,
            count: printers.length,
            scannedAt: scan?.at || prev?.at || null,
            message: (scan && scan.commandId === cmd.id)
                ? `Found ${printers.length} printer(s)`
                : 'Scan requested. Please retry in a few seconds for updated results.'
        });
    } catch (error) {
        console.error('Error finding printers:', error);
        res.status(500).json({ error: 'Failed to find printers', details: error.message });
    }
});

// Print specific order (Bearer token or API key)
app.post(API_PREFIX + '/printer/print/:orderId', requireAuthOrApiKey, async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { printerIp, port } = req.body || {};

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

        let printerTarget = null;
        if (printerIp) {
            printerTarget = { ip: printerIp, port: Number.isFinite(Number(port)) ? Number(port) : 9100 };
        } else {
            const restaurant = (data.restaurants || []).find(r => r && r.id === req.restaurantId);
            const printerNormalized = normalizePrinterConfig(restaurant?.printer);
            const printerCfg = printerNormalized.ok
                ? printerNormalized.value
                : { enabled: false, ip: '', port: 9100, autoPrintOnApproved: true, printPickup: true, allowAutoDiscovery: false };

            const hasTargetPrinter = !!printerCfg.ip || printerCfg.allowAutoDiscovery;
            if (printerCfg.enabled && hasTargetPrinter) {
                printerTarget = printerCfg.ip ? { ip: printerCfg.ip, port: printerCfg.port } : null;
            }
        }

        const result = await printOrder(order, printerTarget);

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

function getPublicOrigin(req) {
    const env = (process.env.PUBLIC_BASE_URL || '').toString().trim().replace(/\/$/, '');
    if (env) return env;

    const xfProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
    const proto = xfProto || (req.protocol || 'https');
    const xfHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
    const host = xfHost || (req.get('host') || '').toString().split(',')[0].trim();
    if (!host) return '';
    return `${proto}://${host}`;
}

function normalizePublicBasePath(raw) {
    let p = (raw ?? '').toString().trim();
    if (p === '/') p = '';
    if (p && !p.startsWith('/')) p = `/${p}`;
    if (p.endsWith('/') && p.length > 1) p = p.slice(0, -1);
    return p;
}

function getPublicBasePath(req) {
    const env = (process.env.PUBLIC_BASE_PATH ?? '').toString().trim();
    if (env) return normalizePublicBasePath(env);

    const original = (req.originalUrl || '').toString();
    if (BASE_PATH && original.startsWith(BASE_PATH)) return normalizePublicBasePath(BASE_PATH);
    return '';
}

function toPublicAbsoluteUrl(req, rawPath) {
    const origin = getPublicOrigin(req);
    if (!origin) return rawPath;
    const basePath = getPublicBasePath(req);

    let p = (rawPath || '').toString().trim();
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;

    // Backward compatibility: stored paths may contain the internal mount prefix.
    if (p.startsWith('/resturant-website/')) p = p.replace(/^\/resturant-website/, '');

    if (p.startsWith('/')) {
        const merged = basePath ? `${basePath}${p}` : p;
        return `${origin}${merged}`;
    }
    return `${origin}/${p}`;
}

function buildSeoSnapshot(req) {
    const db = readDatabase();
    const restaurant = getActiveRestaurantForPublicRequest(db, req) || null;
    const name = (restaurant?.name || db.restaurantName || 'Restaurant').toString().trim();
    const site = restaurant ? normalizeSiteSettings(restaurant.siteSettings) : getDefaultSiteSettings();

    const seo = (site?.seo && typeof site.seo === 'object') ? site.seo : {};

    const contacts = site?.footer?.contacts || {};
    const origin = getPublicOrigin(req);
    const basePath = getPublicBasePath(req);
    const canonical = origin ? `${origin}${basePath}/` : '';

    const canonicalOverride = (seo?.canonicalUrl || '').toString().trim();
    const canonicalEffective = canonicalOverride || canonical;

    const aboutLogo = (site?.footer?.aboutLogoUrl || '').toString().trim();
    const logo = (db.restaurantLogo || '').toString().trim();
    const imageCandidate = aboutLogo || logo || '';
    const ogImage = imageCandidate ? toPublicAbsoluteUrl(req, imageCandidate) : '';

    const title = (seo?.title || '').toString().trim() || `${name} | Online Menu`;
    const description = (seo?.description || '').toString().trim() || `${name} online menu. Order for delivery or pickup.`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name,
        url: canonicalEffective || undefined,
        image: ogImage ? [ogImage] : undefined,
        telephone: (contacts.phone || '').toString().trim() || undefined,
        email: (contacts.email || '').toString().trim() || undefined,
        address: (contacts.address || '').toString().trim()
            ? {
                '@type': 'PostalAddress',
                streetAddress: (contacts.address || '').toString().trim()
            }
            : undefined
    };

    const robotsDefault = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
    const robotsEffective = (seo?.robots || '').toString().trim() || robotsDefault;

    return {
        name,
        canonical: canonicalEffective,
        title,
        description,
        ogTitle: title,
        ogDescription: description,
        ogImage: (seo?.ogImageUrl || '').toString().trim() ? toPublicAbsoluteUrl(req, seo.ogImageUrl) : ogImage,
        robots: robotsEffective,
        googleSiteVerification: (seo?.googleSiteVerification || '').toString().trim(),
        jsonLd
    };
}

// Serve frontend HTML under BASE_PATH
const INDEX_PATH = path.join(__dirname, 'public', 'index.html');
const ADMIN_PATH = path.join(__dirname, 'public', 'admin.html');
const LOGIN_PATH = path.join(__dirname, 'public', 'login.html');
const PRIVACY_PATH = path.join(__dirname, 'public', 'privacy.html');
const TERMS_PATH = path.join(__dirname, 'public', 'terms.html');
const THANK_YOU_PATH = path.join(__dirname, 'public', 'thank-you.html');

let INDEX_HTML_TEMPLATE = '';
try {
    INDEX_HTML_TEMPLATE = fs.readFileSync(INDEX_PATH, 'utf8');
} catch (e) {
    console.warn('[SEO] Failed to read index.html for template rendering:', e?.message || e);
}

function escapeHtmlAttr(s) {
    return (s ?? '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderIndexHtml(req) {
    const seo = buildSeoSnapshot(req);
    const jsonLdSafe = JSON.stringify(seo.jsonLd)
        .replace(/</g, '\\u003c')
        .replace(/-->/g, '--\\u003e');

    return (INDEX_HTML_TEMPLATE || '')
        .replace(/__SEO_TITLE__/g, escapeHtmlAttr(seo.title))
        .replace(/__SEO_DESCRIPTION__/g, escapeHtmlAttr(seo.description))
        .replace(/__SEO_ROBOTS__/g, escapeHtmlAttr(seo.robots || ''))
        .replace(/__SEO_GOOGLE_SITE_VERIFICATION__/g, escapeHtmlAttr(seo.googleSiteVerification || ''))
        .replace(/__SEO_CANONICAL__/g, escapeHtmlAttr(seo.canonical || ''))
        .replace(/__SEO_SITE_NAME__/g, escapeHtmlAttr(seo.name))
        .replace(/__SEO_OG_TITLE__/g, escapeHtmlAttr(seo.ogTitle))
        .replace(/__SEO_OG_DESCRIPTION__/g, escapeHtmlAttr(seo.ogDescription))
        .replace(/__SEO_OG_IMAGE__/g, escapeHtmlAttr(seo.ogImage || ''))
        .replace(/__SEO_JSON_LD__/g, jsonLdSafe);
}

// robots.txt and sitemap.xml should be reachable at the public root.
app.get(['/robots.txt', BASE_PATH ? `${BASE_PATH}/robots.txt` : '/robots.txt'], (req, res) => {
    const origin = getPublicOrigin(req);
    const basePath = getPublicBasePath(req);
    const sitemap = origin ? `${origin}${basePath}/sitemap.xml` : `${basePath}/sitemap.xml`;

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send([
        'User-agent: *',
        'Allow: /',
        `Sitemap: ${sitemap}`,
        ''
    ].join('\n'));
});

app.get(['/sitemap.xml', BASE_PATH ? `${BASE_PATH}/sitemap.xml` : '/sitemap.xml'], (req, res) => {
    const origin = getPublicOrigin(req);
    const basePath = getPublicBasePath(req);
    const root = origin ? `${origin}${basePath}` : basePath;
    const lastmod = new Date().toISOString().slice(0, 10);

    const urls = [
        `${root}/`,
        `${root}/privacy`,
        `${root}/terms`
    ].filter(Boolean);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map(u => (
            `  <url>\n` +
            `    <loc>${escapeHtmlAttr(u)}</loc>\n` +
            `    <lastmod>${lastmod}</lastmod>\n` +
            `    <changefreq>weekly</changefreq>\n` +
            `    <priority>${u.endsWith('/') ? '1.0' : '0.3'}</priority>\n` +
            `  </url>`
        )).join('\n') +
        `\n</urlset>\n`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
});

if (BASE_PATH) {
    // Normalize: allow access without trailing slash
    app.get(BASE_PATH, (req, res, next) => {
        const originalPath = (req.originalUrl || '').split('?')[0];
        if (originalPath === BASE_PATH) {
            return res.redirect(301, BASE_PATH + '/');
        }
        return next();
    });
}

app.get(BASE_PATH + '/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(renderIndexHtml(req));
    } catch (e) {
        res.sendFile(INDEX_PATH);
    }
});

app.get(BASE_PATH + '/admin', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(ADMIN_PATH);
});

app.get(BASE_PATH + '/login', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(LOGIN_PATH);
});

app.get(BASE_PATH + '/checkout', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

app.get(BASE_PATH + '/thank-you', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(THANK_YOU_PATH);
});

app.get(BASE_PATH + '/privacy', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(PRIVACY_PATH);
});

app.get(BASE_PATH + '/terms', (req, res) => {
    res.set('Cache-Control', 'no-store');
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
