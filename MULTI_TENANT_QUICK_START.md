# MULTI-TENANT СИСТЕМА - КРАТКО РЕЗЮМЕ

## 🎯 Какво е направено?

Системата е **обновена от single-tenant към multi-tenant**, което означава:

- ✅ **ЕДИН СЪРВЪР** обслужва множество ресторанти
- ✅ **ЕДНО МОБИЛНО ПРИЛОЖЕНИЕ** за всички персонали
- ✅ **ОТДЕЛНИ УЕБ ПРИЛОЖЕНИЯ** (копия) за всеки ресторант
- ✅ **ПЪЛНА ИЗОЛАЦИЯ** - всеки ресторант вижда само своите поръчки

---

## 📊 Архитектура

```
                    ┌─────────────────────┐
                    │   ЕДИН СЪРВЪР       │
                    │   database.json     │
                    │                     │
                    │  Restaurants:       │
                    │  • BOJOLE           │
                    │  • Pizza Italia     │
                    │  • Sushi Master     │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
    ┌─────▼─────┐      ┌──────▼──────┐      ┌─────▼─────┐
    │  BOJOLE   │      │Pizza Italia │      │Sushi Master│
    │  Web Copy │      │  Web Copy   │      │  Web Copy  │
    └───────────┘      └─────────────┘      └───────────┘
          │                    │                    │
          └────────────────────┴────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ ЕДНО Мобилно App    │
                    │ (Избор на ресторант)│
                    └─────────────────────┘
```

---

## 🔑 Ключови Компоненти

### 1. База Данни (database.json)

**Нова структура:**
```json
{
  "restaurants": [
    {
      "id": "rest_bojole_001",
      "name": "BOJOLE",
      "username": "lauta_admin",
      "password": "lauta123",
      "apiKey": "bojole_api_key_12345",
      "active": true
    }
  ],
  "orders": [
    {
      "id": "order_123",
      "restaurantId": "rest_bojole_001",  ← ново поле
      "restaurantName": "BOJOLE",         ← ново поле
      "status": "pending",
      ...
    }
  ]
}
```

---

### 2. Автентикация

#### Web Admin (Token-based)
```javascript
// Login
POST /api/login
Body: { username: "lauta_admin", password: "lauta123" }
Response: { token: "abc123", restaurant: { id: "rest_001" } }

// Get Orders
GET /api/orders
Headers: { Authorization: "Bearer abc123" }
→ Returns only orders where restaurantId = rest_001
```

#### Mobile App (API Key)
```javascript
// Get Orders
GET /api/orders/mobile/pending
Headers: { "X-API-Key": "bojole_api_key_12345" }
→ Returns only orders where restaurantId = rest_001
```

---

### 3. API Endpoints

#### Нови Mobile Endpoints (API Key Auth)
- `GET /api/orders/mobile/pending` - Pending orders за ресторанта
- `PUT /api/orders/mobile/:id` - Одобряване на поръчка

#### Обновени Web Endpoints (Token Auth)
- `GET /api/orders` - Всички поръчки **филтрирани по restaurantId**
- `GET /api/orders/pending` - Pending поръчки **филтрирани по restaurantId**
- `PUT /api/orders/:id` - Update поръчка (403 ако е за друг ресторант)

#### Public Endpoints
- `POST /api/orders` - Създаване на поръчка (изисква `restaurantId`)
- `GET /api/orders/track/:id` - Tracking (работи за всички ресторанти)

---

## 📱 Мобилно Приложение

### Нови Файлове

1. **src/config/restaurants.js**
   ```javascript
   export const RESTAURANTS = [
     {
       id: 'rest_bojole_001',
       name: 'BOJOLE',
       apiKey: 'bojole_api_key_12345',
       apiBaseUrl: 'https://...',
       logo: require('../assets/bojole-logo.png')
     }
   ];
   ```

2. **src/screens/RestaurantSelectScreen.js**
   - Показва списък с ресторанти
   - При избор запазва в AsyncStorage
   - Навигира към OrdersScreen

### Модифицирани Файлове

1. **src/services/api.js**
   - Взема selected restaurant от AsyncStorage
   - Праща X-API-Key в headers
   - Използва restaurant.apiBaseUrl

2. **src/screens/OrdersScreen.js**
   - Показва име на избран ресторант
   - Бутон "Смени" за смяна на ресторант
   - Филтрирани поръчки

3. **src/App.js**
   - Проверява дали има избран ресторант
   - Ако няма → RestaurantSelectScreen
   - Ако има → OrdersScreen

---

## 🌐 Уеб Приложение

### Структура

```
resturant-template/
├── public/              ← Оригинал (template)
│   └── checkout.js
│
├── bojole-web/          ← Копие за BOJOLE
│   └── checkout.js      (модифициран)
│
├── pizza-italia-web/    ← Копие за Pizza Italia
│   └── checkout.js      (модифициран)
```

### Модификация на checkout.js

```javascript
// ДОБАВИв началото на файла:
const RESTAURANT_CONFIG = {
    id: 'rest_bojole_001',      // ← Уникално за всеки
    name: 'BOJOLE',
    apiBaseUrl: 'https://...'
};

// МОДИФИЦИРАЙ placeOrder():
const orderData = {
    restaurantId: RESTAURANT_CONFIG.id,  // ← ДОБАВИ
    items: cartItems,
    ...
};

fetch(RESTAURANT_CONFIG.apiBaseUrl + '/orders', {
    headers: {
        'X-Restaurant-Id': RESTAURANT_CONFIG.id  // ← ДОБАВИ
    },
    body: JSON.stringify(orderData)
});
```

---

## 🚀 Deployment

### Бърз Deployment Guide

```bash
# 1. UPDATE SERVER
ssh root@46.62.174.218
cd /root/resturant-website

# Backup
cp database.json database.json.backup

# Edit database.json - add restaurants array
nano database.json

# Upload new server.js
exit
scp server.js root@46.62.174.218:/root/resturant-website/
ssh root@46.62.174.218
systemctl restart restaurant.service

# 2. CREATE WEB APP COPY
cp -r public bojole-web
# Edit bojole-web/checkout.js (add RESTAURANT_CONFIG)

# Upload
scp -r bojole-web root@46.62.174.218:/var/www/bojole/

# 3. UPDATE MOBILE APP
cd restaurant-orders-mobile
# Create src/config/restaurants.js
# Create src/screens/RestaurantSelectScreen.js
# Modify api.js, OrdersScreen.js, App.js

npm install @react-native-async-storage/async-storage
npx expo start

# Build APK
npx eas build --platform android
```

---

## ➕ Добавяне на Нов Ресторант

### 5-минутна Checklist

1. **Generate API Key**
   ```bash
   openssl rand -hex 32
   ```

2. **Update database.json**
   ```json
   {
     "restaurants": [
       ...existing,
       {
         "id": "rest_new_004",
         "name": "New Restaurant",
         "username": "new_admin",
         "password": "new_password",
         "apiKey": "GENERATED_KEY_HERE",
         "active": true
       }
     ]
   }
   ```

3. **Create Web Copy**
   ```bash
   cp -r public new-restaurant-web
   # Edit new-restaurant-web/checkout.js
   # Change RESTAURANT_CONFIG.id to "rest_new_004"
   ```

4. **Update Mobile Config**
   ```javascript
   // src/config/restaurants.js
   export const RESTAURANTS = [
     ...existing,
     {
       id: 'rest_new_004',
       name: 'New Restaurant',
       apiKey: 'GENERATED_KEY_HERE',
       ...
     }
   ];
   ```

5. **Deploy & Test**
   - Upload database.json
   - Upload web app
   - Rebuild mobile APK
   - Test end-to-end

---

## 🔒 Сигурност

### Препоръки

1. **API Keys:**
   ```bash
   # Generate secure keys
   openssl rand -hex 32
   # Result: 64-char random string
   ```

2. **Passwords:**
   - Не използвайте прости пароли като "lauta123"
   - В production: hash with bcrypt
   ```javascript
   const bcrypt = require('bcrypt');
   const hashed = await bcrypt.hash('password', 10);
   ```

3. **HTTPS:**
   - Винаги използвайте HTTPS
   - Проверете SSL сертификата

4. **Token Expiry:**
   - Текущо: 24 часа
   - Може да се промени в server.js

---

## 📝 Testing Checklist

### Test Scenario 1: Web → Mobile Flow

- [ ] Customer place order на bojole.site.com
- [ ] Order има `restaurantId: "rest_bojole_001"`
- [ ] Mobile app (с BOJOLE API key) вижда поръчката
- [ ] Mobile app (с друг API key) НЕ вижда поръчката
- [ ] Approve в mobile app
- [ ] Delivery order се принтира
- [ ] Pickup order НЕ се принтира

### Test Scenario 2: Multiple Restaurants

- [ ] Place order на bojole.site.com
- [ ] Place order на pizza-italia.site.com
- [ ] Mobile app: select BOJOLE → вижда само BOJOLE поръчки
- [ ] Mobile app: switch to Pizza Italia → вижда само Pizza поръчки
- [ ] Web admin: login lauta_admin → вижда само BOJOLE поръчки
- [ ] Web admin: login pizza_admin → вижда само Pizza поръчки

### Test Scenario 3: Security

- [ ] Try access Pizza order с BOJOLE API key → 403 Forbidden
- [ ] Try login със wrong password → 401 Unauthorized
- [ ] Try GET /api/orders без token → 401 Unauthorized
- [ ] Try update order за друг ресторант → 403 Forbidden

---

## 🆘 Troubleshooting

### Error: "Access denied - order belongs to different restaurant"

**Причина:** API key е за различен ресторант

**Решение:**
```bash
# Check order's restaurantId
cat database.json | jq '.orders[] | select(.id=="order_123") | .restaurantId'

# Check API key's restaurant
cat database.json | jq '.restaurants[] | select(.apiKey=="KEY") | .id'

# Must match!
```

---

### Error: "API key required"

**Причина:** Mobile app не праща X-API-Key header

**Решение:**
```javascript
// In api.js
headers: {
    'X-API-Key': restaurant.apiKey  // ← Ensure this exists
}
```

---

### Error: "No orders showing"

**Checklist:**
1. Restaurant selected? `AsyncStorage.getItem('selectedRestaurant')`
2. Orders have correct `restaurantId`?
3. API key valid in database.json?
4. Server running? `systemctl status restaurant.service`

---

## 📞 Support

### Logs

```bash
# Server logs
ssh root@46.62.174.218
journalctl -u restaurant.service -f

# Filter by restaurant
journalctl -u restaurant.service -f | grep "rest_bojole_001"
```

### Database Queries

```bash
# Count orders per restaurant
cat database.json | jq '
  .orders | group_by(.restaurantId) | 
  map({restaurant: .[0].restaurantName, count: length})
'

# List all restaurants
cat database.json | jq '.restaurants[] | {id, name, active}'

# Find order by ID
cat database.json | jq '.orders[] | select(.id=="order_123")'
```

---

## 📚 Документация

1. **MULTI_TENANT_GUIDE.md** - Пълен guide (този файл)
2. **RESTAURANT_CONFIG_EXAMPLE.js** - Code examples
3. **MOBILE_APP_WORKFLOW.md** - Workflow guide
4. **IMPLEMENTATION_SUMMARY.md** - Original implementation

---

## ✅ Summary

### Какво Сега Можете?

✅ Множество ресторанти използват една система  
✅ Всеки ресторант има собствено уеб приложение  
✅ Персоналът избира ресторант в мобилното приложение  
✅ Пълна изолация на данни между ресторанти  
✅ Централизирано управление на сървъра  
✅ Лесно добавяне на нови ресторанти

### Next Steps

1. Deploy updated server.js
2. Update database.json with restaurants
3. Create web app copies
4. Update mobile app
5. Test with multiple restaurants
6. Go live!

---

**Версия:** 2.0 Multi-Tenant  
**Дата:** December 22, 2025  
**Автор:** BOJOLE Restaurant System
