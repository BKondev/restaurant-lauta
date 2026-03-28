const axios = require('axios');
const path = require('path');
const fs = require('fs');

const DELIVERY_API_URL = 'https://karakashkov.com/delivery/api.php?path=/orders';

// Delivery platform expects delivery price in BGN.
// Business requirement: always submit a fixed delivery price to the platform.
const DELIVERY_PLATFORM_PRICE_BGN = 8.02;

// Defaults (fallbacks) if we can't resolve a match.
// LAUTA delivery system directory:
// id=51, name=Р-т Лаута, zone=1, price_default=8.02, lat=42.137007, lon=24.770407
const RESTAURANT_ID = '51';
const RESTAURANT_ZONE = '1';
const RESTAURANT_NAME_DEFAULT = 'Р-т Лаута';

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

function resolveDeliveryRestaurantConfig(order, options = {}) {
    // If the order already contains an explicit delivery directory id, honor it.
    const explicitId = order?.deliveryRestaurantId ?? order?.delivery_service_restaurant_id;
    if (explicitId !== undefined && explicitId !== null && String(explicitId).trim()) {
        const byId = DELIVERY_RESTAURANT_BY_ID.get(String(explicitId).trim());
        if (byId) return byId;
    }

    // Prefer explicit per-restaurant overrides when provided.
    // This avoids brittle restaurantName matching and keeps multi-restaurant installs safe.
    const restaurant = options?.restaurant;
    const overrideId =
        restaurant?.deliveryRestaurantId ??
        restaurant?.delivery_restaurant_id ??
        restaurant?.delivery_service_restaurant_id ??
        restaurant?.deliveryServiceRestaurantId ??
        restaurant?.delivery_service?.restaurant_id;

    const overrideZone =
        restaurant?.deliveryRestaurantZone ??
        restaurant?.delivery_restaurant_zone ??
        restaurant?.deliveryServiceRestaurantZone ??
        restaurant?.delivery_service?.restaurant_zone;

    const overrideName =
        restaurant?.deliveryRestaurantName ??
        restaurant?.delivery_restaurant_name ??
        restaurant?.deliveryServiceRestaurantName ??
        restaurant?.delivery_service?.restaurant_name;

    if (overrideId !== undefined && overrideId !== null && String(overrideId).trim()) {
        const byId = DELIVERY_RESTAURANT_BY_ID.get(String(overrideId).trim());
        if (byId) {
            return {
                ...byId,
                ...(overrideZone ? { zone: String(overrideZone) } : null),
                ...(overrideName ? { name: String(overrideName) } : null)
            };
        }

        return {
            id: String(overrideId).trim(),
            name: String(overrideName || RESTAURANT_NAME_DEFAULT || restaurant?.name || '').trim(),
            zone: String(overrideZone || RESTAURANT_ZONE || '').trim(),
            priceDefault: 0,
            priceDefaultCurrency: 'BGN'
        };
    }

    // Default for this deployment.
    return {
        id: RESTAURANT_ID,
        name: String(overrideName || RESTAURANT_NAME_DEFAULT || restaurant?.name || '').trim(),
        zone: String(overrideZone || RESTAURANT_ZONE || '').trim(),
        priceDefault: 0,
        priceDefaultCurrency: 'BGN'
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

        const restaurantCfg = resolveDeliveryRestaurantConfig(order, options);

        // Delivery platform expects delivery price in BGN.
        // We intentionally do NOT use admin-panel city delivery fees here (those are displayed to customers in EUR).
        const priceBgn = DELIVERY_PLATFORM_PRICE_BGN;

        // Подготовка на данните за delivery API
        const deliveryData = {
            client_id: clientId,
            restaurant_id: restaurantCfg.id,
            restaurant_name: restaurantCfg.name || RESTAURANT_NAME_DEFAULT,
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
    generateClientId,
    resolveDeliveryRestaurantConfig
};
