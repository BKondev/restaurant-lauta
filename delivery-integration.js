const axios = require('axios');

const DELIVERY_API_URL = 'https://karakashkov.com/delivery/api.php?path=/orders';
const RESTAURANT_ID = '10'; // BOJOLE Restaurant ID (може да се промени от настройките)
const RESTAURANT_ZONE = '1'; // Зона на ресторанта

/**
 * Изпращане на поръчка за доставка към delivery API
 * @param {Object} order - Поръчката от нашата система
 * @returns {Promise<Object>} - Резултат от API-то
 */
async function sendToDeliveryService(order) {
    try {
        // Проверка дали е поръчка с доставка
        if (order.deliveryMethod !== 'delivery') {
            console.log('Order is not for delivery, skipping delivery service');
            return { success: false, reason: 'not_delivery' };
        }

        // Генериране на уникален client_id (10 символа)
        const clientId = generateClientId();

        // Подготовка на данните за delivery API
        const deliveryData = {
            client_id: clientId,
            restaurant_id: RESTAURANT_ID,
            restaurant_name: 'BOJOLE',
            restaurant_zone: RESTAURANT_ZONE,
            address: `${order.customerInfo?.address || ''}, ${order.customerInfo?.city || ''}`.trim(),
            phone: order.customerInfo?.phone || null,
            notes: order.customerInfo?.notes || null,
            price: parseFloat(order.total).toFixed(1), // Доставка цена (може да е delivery fee)
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
