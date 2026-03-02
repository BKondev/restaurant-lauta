# Multi-Tenant Restaurant System - Complete Guide

## 📋 Съдържание

1. [Обща Информация](#обща-информация)
2. [Архитектура на Системата](#архитектура-на-системата)
3. [База Данни](#база-данни)
4. [Автентикация](#автентикация)
5. [API Endpoints](#api-endpoints)
6. [Уеб Приложение](#уеб-приложение)
7. [Мобилно Приложение](#мобилно-приложение)
8. [Deployment](#deployment)
9. [Добавяне на Нов Ресторант](#добавяне-на-нов-ресторант)
10. [Сигурност](#сигурност)
11. [Troubleshooting](#troubleshooting)

---

## Обща Информация

### Какво е Multi-Tenant Система?

**Multi-tenant** означава че една система обслужва **множество ресторанти** едновременно, като всеки ресторант:
- Вижда **само своите поръчки**
- Има **собствена автентикация**
- Използва **общ сървър и мобилно приложение**
- Има **отделно уеб приложение** (копие)

### Как Работи?

```
┌─────────────────────────────────────────────────────────────┐
│                      ЕДИН СЪРВЪР                            │
│              46.62.174.218:3003                             │
│                                                             │
│  Restaurants DB:                                            │
│  ┌──────────────┬──────────────┬──────────────┐           │
│  │   BOJOLE     │ Pizza Italia │ Sushi Master │           │
│  │ ID: rest_001 │ ID: rest_002 │ ID: rest_003 │           │
│  └──────────────┴──────────────┴──────────────┘           │
└─────────────────────────────────────────────────────────────┘
           │                  │                  │
           │                  │                  │
    ┌──────▼──────┐   ┌───────▼──────┐   ┌──────▼──────┐
    │  BOJOLE     │   │ Pizza Italia │   │Sushi Master │
    │  Web App    │   │   Web App    │   │   Web App   │
    │  (Copy #1)  │   │   (Copy #2)  │   │  (Copy #3)  │
    └─────────────┘   └──────────────┘   └─────────────┘
           │                  │                  │
           └──────────────────┴──────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ ЕДНО Мобилно App │
                    │ (За всички staff)│
                    └──────────────────┘
```

---

## Архитектура на Системата

### Компоненти

1. **Сървър (Node.js/Express)**
   - Един сървър за всички ресторанти
   - База данни: `database.json`
   - Филтрира данни по `restaurantId`

2. **Уеб Приложения (Копия)**
   - Всеки ресторант = отделно копие на папка `public/`
   - Конфигурация: `RESTAURANT_ID` в `checkout.js`
   - Поддомейн или субпапка

3. **Мобилно Приложение (React Native)**
   - Едно приложение за всички ресторанти
   - Персоналът избира ресторант при влизане
   - Използва API key за автентикация

### Поток на Данни

```
Customer                 Mobile App Staff         Server
   │                           │                    │
   │ Place Order               │                    │
   │ (bojole.site.com)         │                    │
   ├──────────────────────────────────────────────►│
   │  restaurantId: rest_001   │                    │
   │                           │                    │
   │                           │ Fetch Orders       │
   │                           │ (X-API-Key: bojole)│
   │                           ├───────────────────►│
   │                           │                    │
   │                           │◄───────────────────┤
   │                           │ Filter by rest_001 │
   │                           │                    │
   │◄──────────────────────────┼────────────────────┤
   │  Track Order              │                    │
   │  (public, no auth)        │                    │
```

---

## База Данни

### Структура на `database.json`

```json
{
  "restaurants": [
    {
      "id": "rest_bojole_001",
      "name": "BOJOLE",
    "username": "lauta_admin",
    "password": "lauta123",
      "apiKey": "bojole_api_key_12345_CHANGE_THIS",
      "address": "София, бул. Витоша 100",
      "phone": "+359888123456",
      "email": "contact@bojole.bg",
      "active": true,
      "createdAt": "2025-12-22T10:00:00.000Z"
    }
  ],
  "products": [...],
  "orders": [
    {
      "id": "order_1703251234567_123",
      "restaurantId": "rest_bojole_001",
      "restaurantName": "BOJOLE",
      "items": [...],
      "customerInfo": {
        "name": "Иван Петров",
        "phone": "+359888123456",
        "previousOrders": 3
      },
      "status": "pending",
      "deliveryMethod": "delivery",
      "total": 45.50,
      "createdAt": "2025-12-22T14:30:00.000Z",
      "trackingExpiry": "2025-12-22T16:30:00.000Z"
    }
  ],
  "promoCodes": []
}
```

### Важни Полета

| Поле | Описание | Пример |
|------|----------|--------|
| `restaurantId` | Уникален ID на ресторанта | `rest_bojole_001` |
| `username` | За web admin login | `lauta_admin` |
| `password` | За web admin (hash в production) | `lauta123` |
| `apiKey` | За mobile app API calls | `bojole_api_key_12345` |
| `active` | Ресторантът активен ли е? | `true` / `false` |

---

## Автентикация

### Два Типа Автентикация

#### 1. Token-Based (Web Admin)

**Как работи:**
```
1. Admin влиза с username/password в web app
2. Server връща token (24h validity)
3. Web app праща token в Authorization header
4. Server проверява token и извлича restaurantId
```

**Пример:**
```javascript
// Login
POST /api/login
Body: { "username": "lauta_admin", "password": "lauta123" }
Response: { "token": "abc123xyz", "restaurant": { "id": "rest_001" } }

// Get Orders
GET /api/orders
Headers: { "Authorization": "Bearer abc123xyz" }
Response: [ ...orders filtered by rest_001... ]
```

#### 2. API Key (Mobile App)

**Как работи:**
```
1. Mobile app съхранява API key (от конфигурация)
2. Всяко API call праща X-API-Key header
3. Server проверява API key и извлича restaurantId
```

**Пример:**
```javascript
// Get Pending Orders
GET /api/orders/mobile/pending
Headers: { "X-API-Key": "bojole_api_key_12345" }
Response: [ ...pending orders for rest_001... ]

// Approve Order
PUT /api/orders/mobile/order_123
Headers: { "X-API-Key": "bojole_api_key_12345" }
Body: { "status": "approved", "estimatedTime": 60 }
Response: { "success": true, "order": {...} }
```

---

## API Endpoints

### 🔐 Web Admin Endpoints (Token Auth)

| Method | Endpoint | Auth | Description | Filter by Restaurant |
|--------|----------|------|-------------|---------------------|
| `POST` | `/api/login` | ❌ | Login with username/password | N/A |
| `POST` | `/api/logout` | ✅ | Logout (delete token) | N/A |
| `GET` | `/api/orders` | ✅ | Get all orders | ✅ Yes |
| `GET` | `/api/orders/pending` | ✅ | Get pending orders | ✅ Yes |
| `PUT` | `/api/orders/:id` | ✅ | Update order status | ✅ Yes (403 if wrong restaurant) |

**Example:**
```bash
# Login
curl -X POST https://site.com/api/login \
  -H "Content-Type: application/json" \
    -d '{"username": "lauta_admin", "password": "lauta123"}'

# Response: {"success": true, "token": "abc123xyz", "restaurant": {...}}

# Get Orders
curl https://site.com/api/orders \
  -H "Authorization: Bearer abc123xyz"

# Response: [...orders for BOJOLE only...]
```

---

### 📱 Mobile App Endpoints (API Key Auth)

| Method | Endpoint | Auth | Description | Filter by Restaurant |
|--------|----------|------|-------------|---------------------|
| `GET` | `/api/orders/mobile/pending` | API Key | Get pending orders | ✅ Yes |
| `PUT` | `/api/orders/mobile/:id` | API Key | Update order (approve) | ✅ Yes (403 if wrong restaurant) |

**Example:**
```bash
# Get Pending Orders
curl https://site.com/api/orders/mobile/pending \
  -H "X-API-Key: bojole_api_key_12345"

# Response: [...pending orders for BOJOLE only...]

# Approve Order
curl -X PUT https://site.com/api/orders/mobile/order_123 \
  -H "X-API-Key: bojole_api_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved", "estimatedTime": 65, "callMadeAt": "2025-12-22T15:00:00Z"}'

# Response: {"success": true, "message": "Order updated", "order": {...}}
```

---

### 🌐 Public Endpoints (No Auth)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/orders` | ❌ | Create order (from web checkout) |
| `GET` | `/api/orders/track/:id` | ❌ | Track order (2h window) |

**Example:**
```bash
# Create Order
curl -X POST https://site.com/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Restaurant-Id: rest_bojole_001" \
  -d '{
    "restaurantId": "rest_bojole_001",
    "items": [...],
    "customerInfo": {...},
    "deliveryMethod": "delivery",
    "total": 45.50
  }'

# Track Order
curl https://site.com/api/orders/track/order_123456
# Response: {"success": true, "order": {...limited data...}}
```

---

## Уеб Приложение

### Структура на Файлове

```
resturant-template/
│
├── public/              ← Оригинална версия
│   ├── checkout.js      ← Трябва да се модифицира
│   ├── checkout.html
│   ├── admin.html
│   └── ...
│
├── bojole-web/          ← Копие за BOJOLE
│   ├── checkout.js      ← Модифициран
│   ├── checkout.html
│   └── ...
│
├── pizza-italia-web/    ← Копие за Pizza Italia
│   ├── checkout.js      ← Модифициран
│   └── ...
```

### Модификация на `checkout.js`

**Стъпка 1:** Добави конфигурация в началото на файла

```javascript
// ========================================
// RESTAURANT CONFIGURATION
// ========================================
const RESTAURANT_CONFIG = {
    id: 'rest_bojole_001',           // ← Смени за всеки ресторант
    name: 'BOJOLE',
    apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api'
};
```

**Стъпка 2:** Модифицирай функцията `placeOrder()`

```javascript
async function placeOrder() {
    // ... existing validation code ...
    
    const orderData = {
        restaurantId: RESTAURANT_CONFIG.id,  // ← ДОБАВИthis
        items: cartItems,
        customerInfo: customerInfo,
        deliveryMethod: deliveryMethod,
        total: totalAmount
    };
    
    const response = await fetch(RESTAURANT_CONFIG.apiBaseUrl + '/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Restaurant-Id': RESTAURANT_CONFIG.id  // ← ДОБАВИ this
        },
        body: JSON.stringify(orderData)
    });
    
    // ... rest of code ...
}
```

**Стъпка 3:** Модифицирай `admin.html` login

```javascript
// In admin.html or admin.js
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const response = await fetch(RESTAURANT_CONFIG.apiBaseUrl + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
        // Store token
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('restaurant', JSON.stringify(result.restaurant));
        
        // Redirect to admin panel
        window.location.href = 'admin.html';
    } else {
        alert('Invalid credentials');
    }
}
```

---

## Мобилно Приложение

### Структура на Проекта

```
restaurant-orders-mobile/
│
├── src/
│   ├── config/
│   │   └── restaurants.js        ← Нов файл
│   │
│   ├── screens/
│   │   ├── RestaurantSelectScreen.js   ← Нов екран
│   │   ├── OrdersScreen.js             ← Модифициран
│   │   └── OrderCard.js
│   │
│   ├── services/
│   │   └── api.js                ← Модифициран
│   │
│   └── App.js                    ← Модифициран
```

### 1. Създай `src/config/restaurants.js`

```javascript
export const RESTAURANTS = [
    {
        id: 'rest_bojole_001',
        name: 'BOJOLE',
        apiKey: 'bojole_api_key_12345_CHANGE_THIS',
        apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api',
        logo: require('../assets/bojole-logo.png'),
        primaryColor: '#e74c3c'
    },
    {
        id: 'rest_pizza_italia_002',
        name: 'Pizza Italia',
        apiKey: 'pizza_italia_api_key_67890_CHANGE_THIS',
        apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api',
        logo: require('../assets/pizza-italia-logo.png'),
        primaryColor: '#27ae60'
    },
    {
        id: 'rest_sushi_master_003',
        name: 'Sushi Master',
        apiKey: 'sushi_master_api_key_11223_CHANGE_THIS',
        apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api',
        logo: require('../assets/sushi-master-logo.png'),
        primaryColor: '#8e44ad'
    }
];

// Helper function
export const getRestaurantById = (id) => {
    return RESTAURANTS.find(r => r.id === id);
};
```

### 2. Създай `src/screens/RestaurantSelectScreen.js`

```javascript
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RESTAURANTS } from '../config/restaurants';

export default function RestaurantSelectScreen({ navigation }) {
    const selectRestaurant = async (restaurant) => {
        try {
            await AsyncStorage.setItem('selectedRestaurant', JSON.stringify(restaurant));
            navigation.replace('OrdersScreen');
        } catch (error) {
            console.error('Error saving restaurant:', error);
            alert('Грешка при запазване на избора');
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Изберете Ресторант</Text>
            <Text style={styles.subtitle}>
                Ще виждате само поръчки за избрания ресторант
            </Text>
            
            {RESTAURANTS.map(restaurant => (
                <TouchableOpacity
                    key={restaurant.id}
                    style={[styles.restaurantCard, { borderColor: restaurant.primaryColor }]}
                    onPress={() => selectRestaurant(restaurant)}
                    activeOpacity={0.7}
                >
                    <Image source={restaurant.logo} style={styles.logo} />
                    <Text style={styles.restaurantName}>{restaurant.name}</Text>
                    <Text style={styles.selectButton}>Избери →</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
        color: '#333'
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30
    },
    restaurantCard: {
        backgroundColor: 'white',
        padding: 25,
        marginBottom: 20,
        borderRadius: 15,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        borderWidth: 3
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 15,
        borderRadius: 50
    },
    restaurantName: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333'
    },
    selectButton: {
        fontSize: 16,
        color: '#2196F3',
        fontWeight: '600'
    }
});
```

### 3. Модифицирай `src/services/api.js`

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get selected restaurant from storage
export const getSelectedRestaurant = async () => {
    try {
        const restaurant = await AsyncStorage.getItem('selectedRestaurant');
        return restaurant ? JSON.parse(restaurant) : null;
    } catch (error) {
        console.error('Error getting restaurant:', error);
        return null;
    }
};

// Clear selected restaurant (logout)
export const clearSelectedRestaurant = async () => {
    await AsyncStorage.removeItem('selectedRestaurant');
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
                'X-API-Key': restaurant.apiKey
            }
        }
    );
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch orders');
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
                'X-API-Key': restaurant.apiKey
            },
            body: JSON.stringify(orderData)
        }
    );
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update order');
    }
    
    return await response.json();
};
```

### 4. Модифицирай `src/App.js`

```javascript
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import RestaurantSelectScreen from './src/screens/RestaurantSelectScreen';
import OrdersScreen from './src/screens/OrdersScreen';

const Stack = createStackNavigator();

export default function App() {
    const [initialRoute, setInitialRoute] = useState(null);
    
    useEffect(() => {
        checkRestaurantSelection();
    }, []);
    
    const checkRestaurantSelection = async () => {
        const restaurant = await AsyncStorage.getItem('selectedRestaurant');
        
        if (restaurant) {
            setInitialRoute('OrdersScreen');
        } else {
            setInitialRoute('RestaurantSelect');
        }
    };
    
    if (!initialRoute) {
        return null; // Show splash screen
    }
    
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName={initialRoute}>
                <Stack.Screen
                    name="RestaurantSelect"
                    component={RestaurantSelectScreen}
                    options={{ title: 'Избор на Ресторант', headerShown: false }}
                />
                <Stack.Screen
                    name="OrdersScreen"
                    component={OrdersScreen}
                    options={{
                        title: 'Pending Orders',
                        headerRight: () => (
                            <Button title="Switch" onPress={switchRestaurant} />
                        )
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
    
    const switchRestaurant = async () => {
        await AsyncStorage.removeItem('selectedRestaurant');
        navigation.replace('RestaurantSelect');
    };
}
```

### 5. Модифицирай `src/screens/OrdersScreen.js`

```javascript
import React, { useState, useEffect } from 'react';
import { View, FlatList, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { getPendingOrders, getSelectedRestaurant } from '../services/api';
import OrderCard from '../components/OrderCard';

export default function OrdersScreen({ navigation }) {
    const [orders, setOrders] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [restaurant, setRestaurant] = useState(null);
    
    useEffect(() => {
        loadRestaurant();
        fetchOrders();
        
        const interval = setInterval(fetchOrders, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, []);
    
    const loadRestaurant = async () => {
        const rest = await getSelectedRestaurant();
        setRestaurant(rest);
    };
    
    const fetchOrders = async () => {
        try {
            const pendingOrders = await getPendingOrders();
            setOrders(pendingOrders);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    };
    
    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOrders();
        setRefreshing(false);
    };
    
    return (
        <View style={{ flex: 1, padding: 10 }}>
            {restaurant && (
                <View style={styles.header}>
                    <Text style={styles.restaurantName}>
                        📍 {restaurant.name}
                    </Text>
                    <TouchableOpacity onPress={switchRestaurant}>
                        <Text style={styles.switchButton}>Смени →</Text>
                    </TouchableOpacity>
                </View>
            )}
            
            <FlatList
                data={orders}
                renderItem={({ item }) => <OrderCard order={item} onRefresh={fetchOrders} />}
                keyExtractor={item => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        Няма чакащи поръчки за {restaurant?.name}
                    </Text>
                }
            />
        </View>
    );
    
    const switchRestaurant = async () => {
        await AsyncStorage.removeItem('selectedRestaurant');
        navigation.replace('RestaurantSelect');
    };
}
```

---

## Deployment

### Стъпка 1: Подготовка на Сървъра

```bash
# 1. Backup current database
ssh root@46.62.174.218
cd /root/resturant-website
cp database.json database.json.backup

# 2. Edit database.json - add restaurants array
nano database.json

# Add:
{
  "restaurants": [
    {
      "id": "rest_bojole_001",
      "name": "BOJOLE",
    "username": "lauta_admin",
    "password": "lauta123",
      "apiKey": "GENERATE_SECURE_KEY_HERE",
      "address": "...",
      "phone": "...",
      "email": "...",
      "active": true,
      "createdAt": "2025-12-22T10:00:00.000Z"
    }
  ],
  ...
}

# 3. Upload new server.js
exit
scp c:\Users\User\Desktop\resturant-template\server.js root@46.62.174.218:/root/resturant-website/

# 4. Restart service
ssh root@46.62.174.218
systemctl restart restaurant.service
systemctl status restaurant.service

# 5. Test API
curl https://www.crystalautomation.eu/resturant-website/api/orders/mobile/pending \
  -H "X-API-Key: YOUR_API_KEY"
```

### Стъпка 2: Deploy Web Apps

```powershell
# On Windows

# 1. Create copy for BOJOLE
cd C:\Users\User\Desktop
cp -r resturant-template\public bojole-web

# 2. Edit bojole-web\checkout.js
# Add at top:
const RESTAURANT_CONFIG = {
    id: 'rest_bojole_001',
    name: 'BOJOLE',
    apiBaseUrl: 'https://www.crystalautomation.eu/resturant-website/api'
};

# 3. Upload to server
scp -r bojole-web root@46.62.174.218:/var/www/bojole/

# 4. Configure Nginx
ssh root@46.62.174.218
nano /etc/nginx/sites-available/bojole

# Add:
server {
    listen 80;
    server_name bojole.crystalautomation.eu;
    root /var/www/bojole;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    location /api {
        proxy_pass http://localhost:3003/resturant-website/api;
    }
}

# Enable site
ln -s /etc/nginx/sites-available/bojole /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# 5. Test
curl http://bojole.crystalautomation.eu
```

### Стъпка 3: Deploy Mobile App

```bash
# 1. Install dependencies
cd C:\Users\User\Desktop\restaurant-orders-mobile
npm install @react-native-async-storage/async-storage

# 2. Create config file
# Create src/config/restaurants.js (see above)

# 3. Add restaurant logos
# Add images to src/assets/

# 4. Test locally
npx expo start

# 5. Build APK
npx eas build --platform android

# 6. Distribute to staff
# Email or Google Drive link to APK
```

---

## Добавяне на Нов Ресторант

### Checklist

- [ ] **1. Generate API Key**
  ```bash
  openssl rand -hex 32
  # Output: 8a7f6e5d4c3b2a1...
  ```

- [ ] **2. Add to database.json**
  ```json
  {
    "id": "rest_new_004",
    "name": "New Restaurant",
    "username": "new_admin",
    "password": "new_password_123",
    "apiKey": "8a7f6e5d4c3b2a1...",
    "address": "...",
    "phone": "+359...",
    "email": "...",
    "active": true,
    "createdAt": "2025-12-22T12:00:00.000Z"
  }
  ```

- [ ] **3. Create Web App Copy**
  ```bash
  cp -r public new-restaurant-web
  # Edit new-restaurant-web/checkout.js
  # Change RESTAURANT_CONFIG.id to "rest_new_004"
  ```

- [ ] **4. Update Mobile App Config**
  ```javascript
  // src/config/restaurants.js
  export const RESTAURANTS = [
    ...existing,
    {
      id: 'rest_new_004',
      name: 'New Restaurant',
      apiKey: '8a7f6e5d4c3b2a1...',
      apiBaseUrl: '...',
      logo: require('../assets/new-logo.png'),
      primaryColor: '#ff5722'
    }
  ];
  ```

- [ ] **5. Deploy**
  - Upload new database.json
  - Upload web app to server
  - Configure Nginx subdomain
  - Rebuild mobile app APK
  - Test end-to-end

---

## Сигурност

### 1. API Keys

❌ **Не правете това:**
```javascript
apiKey: "bojole_api_key_12345"  // Too short, predictable
```

✅ **Правете това:**
```bash
# Generate secure key
openssl rand -hex 32

# Result:
apiKey: "8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7"
```

### 2. Passwords

❌ **Plain text (current):**
```json
"password": "lauta123"
```

✅ **Hashed (production):**
```javascript
const bcrypt = require('bcrypt');

// When creating restaurant
const hashedPassword = await bcrypt.hash('lauta123', 10);
// Store: "$2b$10$KlQqV..."

// When logging in
const match = await bcrypt.compare(inputPassword, hashedPassword);
```

### 3. HTTPS

✅ **Always use HTTPS:**
```javascript
apiBaseUrl: 'https://www.crystalautomation.eu'  // ✅
apiBaseUrl: 'http://www.crystalautomation.eu'   // ❌
```

### 4. Token Expiry

✅ **Current implementation:**
```javascript
activeTokens.set(token, {
    restaurantId: restaurant.id,
    username: restaurant.username,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000)  // 24 hours
});
```

### 5. Rate Limiting

⚠️ **TODO: Add rate limiting**
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', apiLimiter);
```

---

## Troubleshooting

### Problem 1: "Order belongs to different restaurant"

**Symptom:**
```json
{"error": "Access denied - order belongs to different restaurant"}
```

**Причина:** API key или token са за различен ресторант

**Решение:**
```bash
# Check order's restaurantId
ssh root@46.62.174.218
cat /root/resturant-website/database.json | jq '.orders[] | select(.id=="order_123") | .restaurantId'

# Check API key's restaurant
cat /root/resturant-website/database.json | jq '.restaurants[] | select(.apiKey=="YOUR_KEY") | .id'

# Should match!
```

---

### Problem 2: "API key required"

**Symptom:**
```json
{"error": "Unauthorized", "message": "API key required"}
```

**Причина:** Mobile app не праща X-API-Key header

**Решение:**
```javascript
// In mobile app api.js
const response = await fetch(url, {
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': restaurant.apiKey  // ← Make sure this is included!
    }
});
```

---

### Problem 3: No orders showing in mobile app

**Checklist:**
1. ✅ Restaurant selected in app?
   ```javascript
   const rest = await AsyncStorage.getItem('selectedRestaurant');
   console.log('Selected:', rest);
   ```

2. ✅ Orders have correct restaurantId in database?
   ```bash
   cat database.json | jq '.orders[] | {id, restaurantId, status}'
   ```

3. ✅ API key valid?
   ```bash
   curl https://site.com/api/orders/mobile/pending \
     -H "X-API-Key: YOUR_KEY" -v
   ```

---

### Problem 4: Customer orders not appearing

**Причина:** Web app не праща `restaurantId`

**Решение:**
```javascript
// In checkout.js placeOrder()
const orderData = {
    restaurantId: RESTAURANT_CONFIG.id,  // ← Must be included!
    items: [...],
    ...
};

// Also check header
headers: {
    'Content-Type': 'application/json',
    'X-Restaurant-Id': RESTAURANT_CONFIG.id  // ← Optional but recommended
}
```

---

### Logs

**Server logs:**
```bash
ssh root@46.62.174.218
journalctl -u restaurant.service -f

# Filter by restaurant
journalctl -u restaurant.service -f | grep "rest_bojole_001"

# Look for errors
journalctl -u restaurant.service -f | grep -i "error\|denied\|unauthorized"
```

**Mobile app logs:**
```bash
# React Native logs
npx expo start
# Check Metro bundler console

# Or in app:
console.log('API Call:', {
    url: restaurant.apiBaseUrl + endpoint,
    headers: { 'X-API-Key': restaurant.apiKey },
    body: data
});
```

---

## Поддръжка

### Backup Strategy

```bash
# Daily backup
0 2 * * * /root/backup-database.sh

# /root/backup-database.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp /root/resturant-website/database.json \
   /root/backups/database_$DATE.json

# Keep only last 30 days
find /root/backups -name "database_*.json" -mtime +30 -delete
```

### Monitoring

```bash
# Check service status
systemctl status restaurant.service

# Check memory usage
ps aux | grep node

# Check disk space
df -h

# Check order counts per restaurant
cat database.json | jq '
  .orders | group_by(.restaurantId) | 
  map({restaurant: .[0].restaurantName, count: length})
'
```

---

## Summary

### Ключови Промени

1. ✅ **Database:** Добавен `restaurants` масив
2. ✅ **Auth:** Двойна автентикация (token + API key)
3. ✅ **Orders:** Филтриране по `restaurantId`
4. ✅ **Web Apps:** Копия с различна конфигурация
5. ✅ **Mobile:** Restaurant selection screen
6. ✅ **API:** Нови endpoints `/orders/mobile/*`

### Бъдещи Подобрения

- [ ] Hashed passwords (bcrypt)
- [ ] JWT tokens instead of random strings
- [ ] Rate limiting
- [ ] Restaurant admin panel (add/edit restaurants)
- [ ] Multi-language support per restaurant
- [ ] Restaurant-specific product menus
- [ ] Analytics dashboard per restaurant

---

**Дата:** December 22, 2025  
**Версия:** 2.0 Multi-Tenant  
**Автор:** BOJOLE Restaurant System
