const axios = require('axios');
const path = require('path');
const fs = require('fs');

const DELIVERY_API_URL = 'https://karakashkov.com/delivery/api.php?path=/orders';

// Defaults (fallbacks) if we can't resolve a match.
const RESTAURANT_ID = '45';
const RESTAURANT_ZONE = '5';
const RESTAURANT_NAME_DEFAULT = 'Божоле';

// Delivery service restaurants directory (auto-loaded from file if present).
// Expected schema: [{ id, name, zone, price_default, ... }]
const DELIVERY_RESTAURANTS_FILE = path.join(__dirname, 'data', 'delivery-restaurants.json');
let DELIVERY_RESTAURANTS = [];
try {
    if (fs.existsSync(DELIVERY_RESTAURANTS_FILE)) {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        DELIVERY_RESTAURANTS = require(DELIVERY_RESTAURANTS_FILE);
    }
} catch (e) {
    console.warn('[DELIVERY] Failed to load delivery restaurants directory:', e?.message || e);
    DELIVERY_RESTAURANTS = [];
}

const DELIVERY_RESTAURANT_BY_ID = new Map();
const DELIVERY_RESTAURANT_BY_NAME = new Map();

for (const entry of Array.isArray(DELIVERY_RESTAURANTS) ? DELIVERY_RESTAURANTS : []) {
    if (!entry || entry.id === undefined || entry.id === null) continue;
    const id = String(entry.id);
    const name = (entry.name || '').toString();
    const zone = entry.zone !== undefined && entry.zone !== null ? String(entry.zone) : '';
    const priceDefault = Number(entry.price_default);

    const normalizedName = normalizeRestaurantName(name);
    const normalized = {
        id,
        name,
        zone,
        // Directory price_default is in BGN
        priceDefault: Number.isFinite(priceDefault) ? priceDefault : 0,
        priceDefaultCurrency: 'BGN'
    };

    DELIVERY_RESTAURANT_BY_ID.set(id, normalized);
    if (normalizedName) DELIVERY_RESTAURANT_BY_NAME.set(normalizedName, normalized);
}

function normalizeRestaurantName(name) {
    return (name || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function resolveDeliveryRestaurantConfig(order) {
    const rawName = (order?.restaurantName || '').toString();
    let name = normalizeRestaurantName(rawName);

    // If the order already contains an explicit delivery directory id, honor it.
    const explicitId = order?.deliveryRestaurantId ?? order?.delivery_service_restaurant_id;
    if (explicitId !== undefined && explicitId !== null && String(explicitId).trim()) {
        const byId = DELIVERY_RESTAURANT_BY_ID.get(String(explicitId).trim());
        if (byId) return byId;
    }

    // Known aliases / latin spellings.
    if (name.includes('bojole') || name.includes('bojo')) {
        name = 'божоле';
    }

    // Prefer exact normalized match.
    const exact = DELIVERY_RESTAURANT_BY_NAME.get(name);
    if (exact) return exact;

    // Fuzzy match (longest contained match) to handle minor formatting differences.
    if (name) {
        let best = null;
        for (const [dirName, entry] of DELIVERY_RESTAURANT_BY_NAME.entries()) {
            if (!dirName) continue;
            if (name.includes(dirName) || dirName.includes(name)) {
                if (!best || dirName.length > best.dirName.length) {
                    best = { dirName, entry };
                }
            }
        }
        if (best?.entry) return best.entry;
    }

    // Fallback: use configured defaults (and use our own delivery fee in EUR).
    return {
        id: RESTAURANT_ID,
        name: RESTAURANT_NAME_DEFAULT,
        zone: RESTAURANT_ZONE,
        // Our system's deliveryFee is expected to already be in EUR
        priceDefault: Number(order?.deliveryFee || 0) || 0,
        priceDefaultCurrency: 'EUR'
    };
}

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function convertToBgn(amount, currency, eurToBgnRate) {
    const amt = toNumber(amount, 0);
    const cur = (currency || 'EUR').toString().trim().toUpperCase();
    if (cur === 'EUR') {
        const rate = toNumber(eurToBgnRate, 0);
        if (rate > 0) return amt * rate;
    }
    return amt;
}

/**
 * Изпращане на поръчка за доставка към delivery API
 * @param {Object} order - Поръчката от нашата система
 * @returns {Promise<Object>} - Резултат от API-то
 */
async function sendToDeliveryService(order, options = {}) {
    try {
        // Проверка дали е поръчка с доставка
        if (order.deliveryMethod !== 'delivery') {
            console.log('Order is not for delivery, skipping delivery service');
            return { success: false, reason: 'not_delivery' };
        }

        // Генериране на уникален client_id (10 символа)
        const clientId = generateClientId();

        const restaurantCfg = resolveDeliveryRestaurantConfig(order);

        const eurToBgnRate =
            options?.eurToBgnRate ??
            options?.currencySettings?.eurToBgnRate ??
            options?.restaurantCurrencySettings?.eurToBgnRate ??
            1.9558;

        // Delivery service expects delivery price in BGN.
        // Bojole directory price_default is 8.02 BGN, so we must send 8.02 (not ~4.10 EUR).
        const priceBgn = convertToBgn(
            restaurantCfg.priceDefault,
            restaurantCfg.priceDefaultCurrency,
            eurToBgnRate
        );

        // Подготовка на данните за delivery API
        const deliveryData = {
            client_id: clientId,
            restaurant_id: restaurantCfg.id,
            restaurant_name: restaurantCfg.name || order.restaurantName || RESTAURANT_NAME_DEFAULT,
            restaurant_zone: restaurantCfg.zone,
            address: `${order.customerInfo?.address || ''}, ${order.customerInfo?.city || ''}`.trim(),
            phone: order.customerInfo?.phone || null,
            notes: order.customerInfo?.notes || null,
            // Delivery service price (matches delivery restaurants directory default)
            price: Number(priceBgn || 0).toFixed(2),
            submitted_at: Math.floor(Date.now() / 1000), // Unix timestamp
            status: 'queued' // Начален статус
        };

        console.log('Sending order to delivery service:', deliveryData);

        // POST заявка към delivery API
        const response = await axios.post(DELIVERY_API_URL, deliveryData, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 секунди timeout
        });

        console.log('Delivery service response:', response.data);

        return {
            success: true,
            deliveryId: response.data?.id || clientId,
            clientId: clientId,
            data: response.data
        };

    } catch (error) {
        console.error('Error sending to delivery service:', error.message);
        
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }

        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
}

/**
 * Генериране на уникален client_id (10 символа, главни букви и цифри)
 */
function generateClientId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Проверка на статуса на доставка
 * @param {string} deliveryId - ID на доставката
 */
async function checkDeliveryStatus(deliveryId) {
    try {
        const response = await axios.get(`${DELIVERY_API_URL}/${deliveryId}`, {
            timeout: 5000
        });

        return {
            success: true,
            status: response.data?.status,
            statusLabel: response.data?.status_label,
            driverId: response.data?.driver_id,
            data: response.data
        };
    } catch (error) {
        console.error('Error checking delivery status:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    sendToDeliveryService,
    checkDeliveryStatus,
    generateClientId
};
