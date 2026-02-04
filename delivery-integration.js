const axios = require('axios');

const DELIVERY_API_URL = 'https://karakashkov.com/delivery/api.php?path=/orders';

// Defaults (fallbacks) if we can't resolve a match.
const RESTAURANT_ID = '45';
const RESTAURANT_ZONE = '5';
const RESTAURANT_NAME_DEFAULT = 'Божоле';

// Delivery service restaurants database (excerpt): Bojole => id 45, zone 5, price_default 8.02
const DELIVERY_RESTAURANT_DIRECTORY = {
    bojole: {
        id: '45',
        name: 'Божоле',
        zone: '5',
        // Directory price_default is in BGN
        priceDefault: 8.02,
        priceDefaultCurrency: 'BGN'
    }
};

function normalizeRestaurantName(name) {
    return (name || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function resolveDeliveryRestaurantConfig(order) {
    const name = normalizeRestaurantName(order?.restaurantName);

    // Match both latin and cyrillic spellings.
    if (name.includes('bojole') || name.includes('bojo') || name.includes('божоле') || name.includes('божол')) {
        return DELIVERY_RESTAURANT_DIRECTORY.bojole;
    }

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

function convertToEur(amount, currency, eurToBgnRate) {
    const amt = toNumber(amount, 0);
    const cur = (currency || 'EUR').toString().trim().toUpperCase();
    if (cur === 'BGN') {
        const rate = toNumber(eurToBgnRate, 0);
        if (rate > 0) return amt / rate;
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

        const priceEur = convertToEur(
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
            price: Number(priceEur || 0).toFixed(2),
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
