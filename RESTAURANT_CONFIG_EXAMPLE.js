// ============================================================
// MULTI-TENANT RESTAURANT CONFIGURATION EXAMPLES
// ============================================================
// Each restaurant gets:
// 1. Copy of web application with unique RESTAURANT_ID
// 2. Entry in database.json with credentials and API key
// 3. Mobile app staff logs in with restaurant credentials
// ============================================================

// ============================================================
// EXAMPLE 1: Web Application Configuration (public/checkout.js)
// ============================================================

// FOR BOJOLE RESTAURANT - Copy folder to: bojole-web/
const BOJOLE_CONFIG = {
    // Unique restaurant identifier
    RESTAURANT_ID: 'rest_bojole_001',
    
    // API base URL (same server for all restaurants)
    API_BASE_URL: 'https://www.crystalautomation.eu/resturant-website/api',
    
    // Restaurant branding
    RESTAURANT_NAME: 'BOJOLE',
    PRIMARY_COLOR: '#e74c3c',
    LOGO_URL: '/uploads/bojole-logo.png'
};

// When placing order in checkout.js, include restaurantId:
function placeOrder() {
    const orderData = {
        restaurantId: BOJOLE_CONFIG.RESTAURANT_ID, // ← Add this field
        items: cartItems,
        customerInfo: customerInfo,
        deliveryMethod: deliveryMethod,
        total: totalAmount
    };
    
    fetch(BOJOLE_CONFIG.API_BASE_URL + '/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Restaurant-Id': BOJOLE_CONFIG.RESTAURANT_ID // ← Or use header
        },
        body: JSON.stringify(orderData)
    });
}

// ============================================================
// EXAMPLE 2: Second Restaurant Web App Configuration
// ============================================================

// FOR PIZZA ITALIA - Copy folder to: pizza-italia-web/
const PIZZA_ITALIA_CONFIG = {
    RESTAURANT_ID: 'rest_pizza_italia_002',
    API_BASE_URL: 'https://www.crystalautomation.eu/resturant-website/api',
    RESTAURANT_NAME: 'Pizza Italia',
    PRIMARY_COLOR: '#27ae60',
    LOGO_URL: '/uploads/pizza-italia-logo.png'
};

// ============================================================
// EXAMPLE 3: Third Restaurant Web App Configuration
// ============================================================

// FOR SUSHI MASTER - Copy folder to: sushi-master-web/
const SUSHI_MASTER_CONFIG = {
    RESTAURANT_ID: 'rest_sushi_master_003',
    API_BASE_URL: 'https://www.crystalautomation.eu/resturant-website/api',
    RESTAURANT_NAME: 'Sushi Master',
    PRIMARY_COLOR: '#8e44ad',
    LOGO_URL: '/uploads/sushi-master-logo.png'
};

// ============================================================
// EXAMPLE 4: Mobile App Configuration
// ============================================================

// In mobile app: src/config/restaurants.js
export const RESTAURANTS = [
    {
        id: 'rest_bojole_001',
        name: 'BOJOLE',
        apiKey: 'bojole_api_key_12345',
        apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api',
        logo: require('../assets/bojole-logo.png')
    },
    {
        id: 'rest_pizza_italia_002',
        name: 'Pizza Italia',
        apiKey: 'pizza_italia_api_key_67890',
        apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api',
        logo: require('../assets/pizza-italia-logo.png')
    },
    {
        id: 'rest_sushi_master_003',
        name: 'Sushi Master',
        apiKey: 'sushi_master_api_key_11223',
        apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api',
        logo: require('../assets/sushi-master-logo.png')
    }
];

// ============================================================
// EXAMPLE 5: Mobile App API Service (src/services/api.js)
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// Get selected restaurant from storage
export const getSelectedRestaurant = async () => {
    const restaurant = await AsyncStorage.getItem('selectedRestaurant');
    return restaurant ? JSON.parse(restaurant) : null;
};

// Fetch pending orders with API key
export const getPendingOrders = async () => {
    const restaurant = await getSelectedRestaurant();
    
    if (!restaurant) {
        throw new Error('No restaurant selected');
    }
    
    const response = await fetch(
        `${restaurant.apiBaseUrl}/orders/mobile/pending`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': restaurant.apiKey  // ← API key authentication
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('Failed to fetch orders');
    }
    
    return await response.json();
};

// Update order status
export const updateOrder = async (orderId, orderData) => {
    const restaurant = await getSelectedRestaurant();
    
    if (!restaurant) {
        throw new Error('No restaurant selected');
    }
    
    const response = await fetch(
        `${restaurant.apiBaseUrl}/orders/mobile/${orderId}`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': restaurant.apiKey  // ← API key authentication
            },
            body: JSON.stringify(orderData)
        }
    );
    
    if (!response.ok) {
        throw new Error('Failed to update order');
    }
    
    return await response.json();
};

// ============================================================
// EXAMPLE 6: Mobile App Restaurant Selection Screen
// ============================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RESTAURANTS } from '../config/restaurants';

export default function RestaurantSelectionScreen({ navigation }) {
    const selectRestaurant = async (restaurant) => {
        await AsyncStorage.setItem('selectedRestaurant', JSON.stringify(restaurant));
        navigation.navigate('OrdersScreen');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Изберете ресторант</Text>
            
            {RESTAURANTS.map(restaurant => (
                <TouchableOpacity
                    key={restaurant.id}
                    style={styles.restaurantCard}
                    onPress={() => selectRestaurant(restaurant)}
                >
                    <Image source={restaurant.logo} style={styles.logo} />
                    <Text style={styles.restaurantName}>{restaurant.name}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center'
    },
    restaurantCard: {
        backgroundColor: 'white',
        padding: 20,
        marginBottom: 15,
        borderRadius: 10,
        alignItems: 'center',
        elevation: 3
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: 10
    },
    restaurantName: {
        fontSize: 18,
        fontWeight: 'bold'
    }
});

// ============================================================
// EXAMPLE 7: Database.json Structure (server-side)
// ============================================================

const DATABASE_EXAMPLE = {
    "restaurants": [
        {
            "id": "rest_bojole_001",
            "name": "BOJOLE",
            "username": "bojole_admin",
            "password": "bojole123",
            "apiKey": "bojole_api_key_12345",
            "address": "София, бул. Витоша 100",
            "phone": "+359888123456",
            "email": "contact@bojole.bg",
            "active": true,
            "createdAt": "2025-12-22T10:00:00.000Z"
        },
        {
            "id": "rest_pizza_italia_002",
            "name": "Pizza Italia",
            "username": "pizza_admin",
            "password": "pizza123",
            "apiKey": "pizza_italia_api_key_67890",
            "address": "Пловдив, ул. Главна 50",
            "phone": "+359877654321",
            "email": "info@pizza-italia.bg",
            "active": true,
            "createdAt": "2025-12-22T11:00:00.000Z"
        },
        {
            "id": "rest_sushi_master_003",
            "name": "Sushi Master",
            "username": "sushi_admin",
            "password": "sushi123",
            "apiKey": "sushi_master_api_key_11223",
            "address": "Варна, бул. Приморски 30",
            "phone": "+359899112233",
            "email": "orders@sushi-master.bg",
            "active": true,
            "createdAt": "2025-12-22T12:00:00.000Z"
        }
    ],
    "products": [
        // Products shared across all restaurants OR
        // Add restaurantId field to products if each restaurant has unique menu
    ],
    "orders": [
        {
            "id": "order_1703251234567_123",
            "restaurantId": "rest_bojole_001",  // ← Links order to restaurant
            "restaurantName": "BOJOLE",
            "items": [...],
            "total": 45.50,
            "status": "pending",
            "customerInfo": {
                "name": "Иван Петров",
                "phone": "+359888123456",
                "previousOrders": 3  // ← Counted per restaurant
            },
            "deliveryMethod": "delivery",
            "createdAt": "2025-12-22T14:30:00.000Z",
            "trackingExpiry": "2025-12-22T16:30:00.000Z"
        }
    ],
    "promoCodes": []
};

// ============================================================
// DEPLOYMENT STEPS
// ============================================================

/*

STEP 1: Update Database (database.json)
----------------------------------------
1. Add "restaurants" array with all restaurant configurations
2. Each restaurant needs:
   - Unique ID (rest_name_001)
   - Username/password for web admin login
   - API key for mobile app
   - Contact details

STEP 2: Deploy Updated Server
------------------------------
1. Upload modified server.js to server
2. Restart service: sudo systemctl restart restaurant.service
3. Verify API: curl https://www.crystalautomation.eu/resturant-website/api/orders/mobile/pending \
                   -H "X-API-Key: bojole_api_key_12345"

STEP 3: Create Web Application Copies
--------------------------------------
For each restaurant:
1. Copy public/ folder: cp -r public bojole-web/
2. Edit bojole-web/checkout.js:
   - Add RESTAURANT_ID constant at top
   - Modify placeOrder() to include restaurantId
3. Deploy to subdomain:
   - bojole.crystalautomation.eu → bojole-web/
   - pizza-italia.crystalautomation.eu → pizza-italia-web/
   - sushi-master.crystalautomation.eu → sushi-master-web/

STEP 4: Update Mobile App
--------------------------
1. Create src/config/restaurants.js with restaurant list
2. Update API service to use X-API-Key header
3. Add restaurant selection screen on first launch
4. Store selected restaurant in AsyncStorage
5. Build and distribute APK

STEP 5: Test Each Restaurant
-----------------------------
1. Web: Place order from bojole.crystalautomation.eu
2. Mobile: Select "BOJOLE" → See pending order
3. Mobile: Approve order → Verify printing
4. Web Admin: Login with bojole_admin/bojole123 → See only BOJOLE orders
5. Repeat for other restaurants

*/

// ============================================================
// SECURITY NOTES
// ============================================================

/*

1. API Keys should be:
   - Long random strings (min 32 characters)
   - Generated with: openssl rand -hex 32
   - Stored securely in mobile app (not in source code)

2. Passwords should be:
   - Hashed with bcrypt before storing in database.json
   - Changed from default values immediately

3. HTTPS Required:
   - All API calls must use HTTPS
   - Certificate must be valid

4. Rate Limiting:
   - Add rate limiting to prevent API abuse
   - Example: 100 requests per minute per API key

5. Logging:
   - Log all order updates with restaurantId
   - Monitor for suspicious activity

*/
