# Mobile App Specification - Restaurant Order Management

## Overview

**App Name:** BOJOLE Orders  
**Platform:** iOS & Android (React Native + Expo)  
**Purpose:** Mobile application for restaurant staff to manage incoming orders  
**Connected System:** Restaurant Menu System (same API)  

---

## Phase 1 Features (Current Implementation)

### 1. Authentication
- **Login Screen**
  - Username input (admin)
  - Password input (admin123)
  - Same credentials as web admin panel
  - Uses `/api/login` endpoint
  - Token saved in AsyncStorage

### 2. Pending Orders List
- **Display pending orders** from `/api/orders?status=pending`
- **Auto-refresh** every 10 seconds
- **Order Card shows:**
  - Order ID
  - Customer name
  - Customer phone number
  - Order items with quantities
  - Total amount
  - Delivery method (Pickup/Delivery)
  - Delivery address (if applicable)
  - Order timestamp

### 3. Call Customer Feature
- **"Обади се" button** on each order card
- Automatically opens phone dialer with customer's number
- Uses React Native Linking API
- Format: `tel:+359888123456`

### 4. Confirm Order Feature
- **"Потвърди" button** on each order card
- Changes order status from "pending" to "accepted"
- Uses `/api/orders/:id` PUT endpoint
- Shows success message
- Removes order from pending list
- Updates UI immediately

---

## Technical Architecture

### Technology Stack
- **Framework:** React Native 0.72+
- **Development Tool:** Expo SDK 49+
- **State Management:** React Hooks (useState, useEffect)
- **HTTP Client:** fetch API
- **Storage:** AsyncStorage (for token persistence)
- **Navigation:** React Navigation 6
- **UI Components:** React Native Paper (Material Design)

### Project Structure
```
mobile-app/
├── App.js                  # Main app entry point
├── package.json            # Dependencies
├── app.json                # Expo configuration
│
├── src/
│   ├── screens/
│   │   ├── LoginScreen.js      # Login interface
│   │   └── OrdersScreen.js     # Orders list
│   │
│   ├── components/
│   │   └── OrderCard.js        # Individual order card component
│   │
│   ├── services/
│   │   └── api.js              # API calls to backend
│   │
│   └── utils/
│       └── constants.js        # API URL, colors, etc.
│
└── assets/
    └── icon.png                # App icon
```

### API Integration

**Base URL:** `https://www.crystalautomation.eu/resturant-website/api`

**Endpoints Used:**
1. `POST /api/login` - Authentication
2. `GET /api/orders` - Fetch all orders
3. `PUT /api/orders/:id` - Update order status

**Authentication:**
```javascript
// Store token after login
await AsyncStorage.setItem('authToken', token);

// Include token in API calls
headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
}
```

---

## Screen Designs

### Login Screen
```
┌─────────────────────────────┐
│                             │
│      🍽️ BOJOLE ORDERS      │
│                             │
│  ┌───────────────────────┐  │
│  │ Username              │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Password              │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │      ВЛЕЗ             │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### Orders Screen
```
┌─────────────────────────────┐
│  BOJOLE Orders    [Logout]  │
├─────────────────────────────┤
│                             │
│  Чакащи Поръчки (3)         │
│                             │
│  ┌─────────────────────────┐│
│  │ Поръчка #12345          ││
│  │ Иван Иванов             ││
│  │ 📞 +359888123456        ││
│  │                         ││
│  │ 2x Салата Цезар         ││
│  │ 1x Пица Маргарита       ││
│  │                         ││
│  │ Сума: 45.00 лв          ││
│  │ Доставка: гр. София     ││
│  │                         ││
│  │ [📞 Обади се] [✓ Потвърди]│
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ Поръчка #12346          ││
│  │ ...                     ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

---

## User Flow

### 1. Login Flow
```
App Launch → Login Screen
    ↓
Enter credentials (admin/admin123)
    ↓
Tap "ВЛЕЗ"
    ↓
API call to /api/login
    ↓
Success? → Save token → Navigate to Orders Screen
Fail? → Show error message
```

### 2. View Orders Flow
```
Orders Screen Load
    ↓
API call to /api/orders (with auth token)
    ↓
Filter orders where status === "pending"
    ↓
Display order cards
    ↓
Auto-refresh every 10 seconds
```

### 3. Call Customer Flow
```
User taps "Обади се" on order card
    ↓
Extract phone number from order
    ↓
Open phone dialer with tel: link
    ↓
User makes call outside app
    ↓
User returns to app
```

### 4. Confirm Order Flow
```
User taps "Потвърди" on order card
    ↓
Show confirmation dialog
    ↓
User confirms
    ↓
API call to PUT /api/orders/:id { status: "accepted" }
    ↓
Success? → Remove order from list → Show success message
Fail? → Show error message
```

---

## Data Models

### Order Object (from API)
```javascript
{
    id: "order_1702345678901",
    items: [
        {
            id: "prod_123",
            name: "Caesar Salad",
            price: 8.99,
            quantity: 2
        }
    ],
    total: 22.98,
    deliveryMethod: "delivery", // or "pickup"
    deliveryFee: 5.00,
    deliveryAddress: "ул. Витоша 123, София",
    deliveryCity: "София",
    customerName: "Иван Иванов",
    customerPhone: "+359888123456",
    customerEmail: "ivan@example.com",
    status: "pending",
    createdAt: "2025-12-19T10:30:00.000Z"
}
```

### Auth Token Storage
```javascript
// AsyncStorage
{
    'authToken': 'abc123xyz789def456...'
}
```

---

## Key Features Implementation

### Auto-Refresh Orders
```javascript
useEffect(() => {
    fetchOrders(); // Initial load
    
    const interval = setInterval(() => {
        fetchOrders(); // Refresh every 10 seconds
    }, 10000);
    
    return () => clearInterval(interval); // Cleanup
}, []);
```

### Phone Call Integration
```javascript
import { Linking } from 'react-native';

const handleCall = (phoneNumber) => {
    const url = `tel:${phoneNumber}`;
    Linking.openURL(url).catch(err => {
        console.error('Failed to open dialer:', err);
    });
};
```

### Order Confirmation
```javascript
const confirmOrder = async (orderId) => {
    try {
        const token = await AsyncStorage.getItem('authToken');
        
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'accepted' })
        });
        
        if (response.ok) {
            // Remove order from list
            setOrders(orders.filter(order => order.id !== orderId));
            Alert.alert('Успех', 'Поръчката е потвърдена');
        } else {
            Alert.alert('Грешка', 'Неуспешно потвърждаване');
        }
    } catch (error) {
        console.error('Error confirming order:', error);
        Alert.alert('Грешка', 'Проблем с връзката');
    }
};
```

---

## Phase 2 Features (Future)

### Planned Enhancements
1. **Order History** - View accepted/completed orders
2. **Push Notifications** - Real-time alerts for new orders
3. **Order Details Screen** - Full order view with navigation
4. **Change Order Status** - Accept → Completed → Cancelled flow
5. **Order Search** - Filter by date, customer, status
6. **Statistics Dashboard** - Daily/weekly order metrics
7. **Multi-user Support** - Different staff accounts
8. **Offline Mode** - Cache orders when no internet
9. **Sound Alerts** - Audio notification for new orders
10. **Order Timer** - Show time since order was placed

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on phone (iOS/Android)

### Installation Steps
```bash
# Create new Expo project
npx create-expo-app restaurant-orders-mobile
cd restaurant-orders-mobile

# Install dependencies
npm install @react-navigation/native @react-navigation/stack
npm install react-native-paper
npm install @react-native-async-storage/async-storage
npm install react-native-screens react-native-safe-area-context

# Start development server
npx expo start
```

### Running on Device
1. Install Expo Go app from App Store/Play Store
2. Scan QR code from terminal
3. App opens in Expo Go
4. Live reload on code changes

---

## Testing Checklist

### Login Tests
- [ ] Login with correct credentials (admin/admin123)
- [ ] Login with wrong credentials shows error
- [ ] Token saved to AsyncStorage
- [ ] Token persists after app restart
- [ ] Logout clears token

### Orders List Tests
- [ ] Orders load on screen open
- [ ] Only pending orders shown
- [ ] Auto-refresh works every 10 seconds
- [ ] Pull-to-refresh works
- [ ] Empty state shows when no orders
- [ ] Loading indicator shows during fetch

### Call Feature Tests
- [ ] "Обади се" button opens phone dialer
- [ ] Correct phone number pre-filled
- [ ] Works on both iOS and Android
- [ ] Returns to app after call

### Confirm Feature Tests
- [ ] "Потвърди" button shows confirmation dialog
- [ ] Confirming sends PUT request
- [ ] Order removed from list on success
- [ ] Success message shown
- [ ] Error handling for failed requests

### UI/UX Tests
- [ ] All text in Bulgarian
- [ ] Buttons are touch-friendly (min 44x44px)
- [ ] Smooth scrolling on orders list
- [ ] Responsive on different screen sizes
- [ ] Works in portrait and landscape
- [ ] Dark mode support (optional)

---

## Deployment

### Build for Production

**Android (APK):**
```bash
expo build:android -t apk
```

**iOS (IPA):**
```bash
expo build:ios
```

**App Stores:**
```bash
# Android - Google Play
expo build:android -t app-bundle

# iOS - App Store
expo build:ios -t archive
```

### Environment Configuration
```javascript
// app.json
{
  "expo": {
    "name": "BOJOLE Orders",
    "slug": "bojole-orders",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#667eea"
    },
    "android": {
      "package": "com.bojole.orders",
      "versionCode": 1
    },
    "ios": {
      "bundleIdentifier": "com.bojole.orders",
      "buildNumber": "1.0.0"
    }
  }
}
```

---

## API Compatibility

### Backend Requirements
No changes needed to existing backend! App uses existing endpoints:

✅ `POST /api/login` - Already implemented  
✅ `GET /api/orders` - Already implemented  
✅ `PUT /api/orders/:id` - Already implemented  

### CORS Configuration
Ensure CORS allows mobile app requests:
```javascript
// server.js
app.use(cors({
    origin: '*', // Or specific mobile app origin
    credentials: true
}));
```

---

## Security Considerations

### Token Storage
- ✅ Tokens stored in AsyncStorage (encrypted on iOS)
- ✅ Tokens cleared on logout
- ✅ Token validation on each API call

### HTTPS
- ✅ All API calls use HTTPS
- ✅ Production URL: `https://www.crystalautomation.eu`

### Best Practices
- No hardcoded passwords in code
- No sensitive data in logs
- Secure token transmission (HTTPS)
- Token expiration handling (401 redirect to login)

---

## Performance Optimization

### Efficient Rendering
- Use FlatList for order list (virtual scrolling)
- Memoize order cards with React.memo
- Debounce auto-refresh if screen not focused

### Network Optimization
- Cache orders locally
- Only fetch if data changed (ETag headers)
- Show cached data while fetching

### Battery Optimization
- Pause auto-refresh when app in background
- Reduce refresh interval to 30 seconds if many orders

---

## Support & Maintenance

**Repository:** `C:\Users\User\Desktop\restaurant-orders-mobile`  
**Backend API:** Same as web application  
**Deployment:** Expo OTA updates (no app store resubmission for updates)  

**Common Issues:**
1. **"Network Error"** - Check API URL and internet connection
2. **"Unauthorized"** - Token expired, re-login required
3. **"Phone dialer not opening"** - Check permissions on Android

---

## Future Integration Ideas

### Connect with Kitchen Display System (KDS)
- Orders from mobile app sync to KDS
- Kitchen marks items as prepared
- Mobile app shows preparation status

### Connect with Delivery Tracking
- Driver app shows assigned orders
- Mobile app tracks delivery status
- Real-time updates on map

### Connect with Analytics Dashboard
- Order statistics from mobile app
- Staff performance metrics
- Peak hours analysis

---

**Ready to start development?** 🚀

Next steps:
1. Create React Native project with Expo
2. Implement Login screen
3. Implement Orders list screen
4. Test with live API
5. Build APK for Android testing
