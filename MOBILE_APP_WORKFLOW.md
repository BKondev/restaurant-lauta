# Mobile App Order Processing - Implementation Guide

## Overview
This document describes the complete multi-step order processing workflow implemented in the restaurant mobile app and web system.

## System Flow

### 1. Customer Places Order (Web)
- Customer visits menu, adds items to cart
- Proceeds to checkout
- **Phone validation**: Must enter phone in format `+359` followed by exactly 9 digits (e.g., `+359888123456`)
- System validates phone format before allowing order submission
- System counts previous orders from this phone number
- Order is created with status `pending`
- Customer is redirected to tracking page with 2-hour tracking window

### 2. Order Appears in Mobile App
- Restaurant staff sees new pending order in mobile app
- If customer has previous orders: **"✓ Редовен клиент"** badge is displayed
- Order shows all details: customer info, items, delivery method, total

### 3. Multi-Step Approval Process

#### Step 1: Accept Order & Select Time
- Staff taps **"Приеми"** button
- Dropdown appears with time options:
  - 60 минути
  - 65 минути
  - 70 минути
- After selecting time, button disappears
- Selected time is saved to order (`estimatedTime`)

#### Step 2: Call Customer
- **"1. 📞 Обади се"** button becomes active
- Tapping button opens phone dialer with customer's number
- After returning from call, button changes to **"✓ Обадено"** (greyed out, disabled)
- Call timestamp is recorded (`callMadeAt`)

#### Step 3: Approve Order
- **"2. ✓ Одобри"** button is only enabled AFTER call is made
- Tapping shows confirmation dialog with customer name and estimated time
- On confirmation:
  - Order status changes to `approved`
  - `approvedAt` timestamp is saved
  - **If delivery order**: Receipt is printed to network printer
  - **If delivery order**: Order is sent to delivery service API
  - Order is removed from pending list in mobile app

### 4. Error Handling
- If API fails during approval:
  - Red error message is displayed
  - Process is blocked
  - User must contact support or retry
- Button states prevent incorrect workflow (e.g., can't approve without calling)

### 5. Order Tracking (Customer View)
- After placing order, customer sees tracking page
- Shows:
  - Order ID
  - Order status
  - Countdown timer (based on estimated time)
  - Progress bar
  - Delivery address (if delivery)
- Auto-refreshes every 30 seconds
- **Expires after 2 hours** - tracking link becomes invalid

## Technical Implementation

### Mobile App Changes

**Files Modified:**
- `src/components/OrderCard.js` - Complete rewrite with multi-step UI
- `src/services/api.js` - Updated `confirmOrder()` to send approval data
- `src/screens/OrdersScreen.js` - Updated to return API result to OrderCard

**New Dependencies:**
- `@react-native-picker/picker` - For time selection dropdown

**Installation:**
```bash
cd C:\Users\User\Desktop\restaurant-orders-mobile
npm install @react-native-picker/picker
```

### Web Changes

**Files Modified:**
- `public/checkout.js` - Added strict phone validation
- `public/track-order.html` - **NEW FILE** - Customer order tracking page

**Phone Validation:**
- Regex: `/^\+359\d{9}$/`
- Format: `+359XXXXXXXXX` (9 digits after +359)
- Real-time validation with visual feedback
- Blocks order submission if invalid

### Server API Changes

**Files Modified:**
- `server.js` - Multiple endpoint updates

**New/Modified Endpoints:**

1. **POST /api/orders** (public)
   - Now generates string ID: `order_[timestamp]_[random]`
   - Counts `previousOrders` by phone number
   - Sets `trackingExpiry` to 2 hours from creation
   - Returns order object with ID

2. **PUT /api/orders/:id** (authenticated)
   - Accepts new fields: `estimatedTime`, `callMadeAt`, `approvedAt`
   - Handles `status: 'approved'` from mobile app
   - **Printing logic**: Only prints if `status === 'approved'` AND `deliveryMethod === 'delivery'`
   - Delivery service: Only sends if delivery order
   - Legacy `status: 'confirmed'` from web admin still works

3. **GET /api/orders/track/:id** (public, NEW)
   - No authentication required
   - Returns order details if within 2-hour window
   - Returns `410 Gone` if tracking expired
   - Hides sensitive data, returns only necessary info

## Deployment Instructions

### 1. Deploy Server Changes

```powershell
cd C:\Users\User\Desktop\resturant-template

# Deploy to server
.\deploy-to-server.ps1
```

This will:
- Upload modified `server.js`
- Upload new `track-order.html`
- Upload modified `checkout.js`
- Restart service

### 2. Update Mobile App

```bash
cd C:\Users\User\Desktop\restaurant-orders-mobile

# Install new dependency
npm install @react-native-picker/picker

# For Android
npx expo run:android

# Or build new APK
eas build --platform android
```

### 3. Test Complete Flow

1. **Test Phone Validation:**
   - Try ordering with invalid phone: `0888123456` → Should fail
   - Try ordering with invalid phone: `+35988812345` (8 digits) → Should fail
   - Try ordering with valid phone: `+359888123456` → Should succeed

2. **Test Order Tracking:**
   - Place order, verify redirect to tracking page
   - Check countdown timer works
   - Wait 2+ hours, verify tracking expires

3. **Test Mobile App Workflow:**
   - See pending order in app
   - Tap "Приеми" → Select time → Verify button disappears
   - Tap "Обади се" → Verify phone dialer opens
   - Return to app → Verify "Обади се" is marked complete
   - Try tapping "Одобри" before call → Should be disabled
   - After call, tap "Одобри" → Verify order is removed
   - Check server logs for printer and delivery service actions

4. **Test Returning Customer Badge:**
   - Place 2+ orders with same phone number
   - Verify "✓ Редовен клиент" badge appears on subsequent orders

5. **Test Printer Logic:**
   - Approve delivery order → Should print
   - Approve pickup order → Should NOT print
   - Check logs: `journalctl -u restaurant.service -f`

## Database Schema Changes

### Order Object (New/Modified Fields)

```javascript
{
  id: "order_1703165432101_842",  // String ID (changed from integer)
  items: [...],
  total: 45.50,
  deliveryMethod: "delivery",  // or "pickup"
  customerInfo: {
    name: "Иван Иванов",
    phone: "+359888123456",    // Validated format
    email: "ivan@example.com",
    address: "ул. Витоша 123",
    city: "София",
    previousOrders: 3          // NEW: Count of previous orders
  },
  status: "approved",           // NEW: 'pending' | 'approved' | 'confirmed' | 'cancelled'
  estimatedTime: 65,            // NEW: Minutes (60, 65, or 70)
  callMadeAt: "2025-12-21T10:30:00Z",  // NEW: Timestamp
  approvedAt: "2025-12-21T10:31:00Z",  // NEW: Timestamp
  createdAt: "2025-12-21T10:15:00Z",
  trackingExpiry: "2025-12-21T12:15:00Z",  // NEW: createdAt + 2 hours
  updatedAt: "2025-12-21T10:31:00Z",
  deliveryServiceId: "ABC123",  // If sent to delivery
  deliveryClientId: "RMJCQPVS0"  // If sent to delivery
}
```

## Security Notes

- Phone validation prevents spam/invalid data
- Tracking endpoint is public but time-limited (2 hours)
- Tracking only reveals necessary info (no customer email/phone exposed)
- Mobile app approval requires authentication
- All admin actions require Bearer token

## Troubleshooting

### Mobile App Issues

**"Dropdown not showing"**
- Ensure `@react-native-picker/picker` is installed
- Run `npx expo start --clear` to clear cache

**"Can't approve without calling"**
- This is correct behavior - call button must be pressed first
- If button stuck, close and reopen app

**"Order still shows after approval"**
- Check server logs - API may have failed
- Verify network connection
- Try pull-to-refresh gesture

### Web Issues

**"Phone validation too strict"**
- This is intentional - only `+359XXXXXXXXX` format accepted
- Educate users or add placeholder text

**"Tracking page shows error"**
- Check order ID in URL
- Verify order exists in database
- Check if 2 hours have passed (tracking expired)

**"Tracking countdown wrong"**
- Verify `estimatedTime` field is set correctly (60-70)
- Check timezone settings on server

### Server Issues

**"Printer not printing"**
- Verify printer is on network (port 9100)
- Check logs: `grep "print" /var/log/restaurant.log`
- Test endpoint: `GET /api/printer/find`

**"Delivery service not receiving orders"**
- Check delivery API endpoint is accessible
- Verify `RESTAURANT_ID` in `delivery-integration.js`
- Check logs for API response errors

**"previousOrders count wrong"**
- Phone numbers must match exactly (including +359 format)
- Old orders with different format won't be counted

## API Reference

### Public Endpoints

**POST /api/orders**
```json
Request:
{
  "items": [...],
  "total": 45.50,
  "deliveryMethod": "delivery",
  "customerInfo": {
    "name": "Иван Иванов",
    "phone": "+359888123456",
    "email": "ivan@example.com",
    "address": "ул. Витоша 123",
    "city": "София"
  }
}

Response:
{
  "success": true,
  "message": "Order placed successfully",
  "order": {
    "id": "order_1703165432101_842",
    ...
  }
}
```

**GET /api/orders/track/:id**
```json
Response (success):
{
  "success": true,
  "order": {
    "id": "order_1703165432101_842",
    "status": "approved",
    "total": 45.50,
    "deliveryMethod": "delivery",
    "estimatedTime": 65,
    "createdAt": "2025-12-21T10:15:00Z",
    "trackingExpiry": "2025-12-21T12:15:00Z",
    "customerInfo": {
      "city": "София",
      "address": "ул. Витоша 123"
    }
  }
}

Response (expired):
{
  "error": "Order tracking has expired",
  "message": "Order tracking is only available for 2 hours after order creation"
}
```

### Authenticated Endpoints

**PUT /api/orders/:id**
```json
Request (from mobile app):
{
  "status": "approved",
  "estimatedTime": 65,
  "callMadeAt": "2025-12-21T10:30:00Z",
  "approvedAt": "2025-12-21T10:31:00Z"
}

Response:
{
  "message": "Order status updated successfully"
}
```

## User Training

### For Restaurant Staff

1. **When you see a new order:**
   - Check if customer is returning (green badge)
   - Review items and delivery details

2. **Accept the order:**
   - Tap "Приеми"
   - Select realistic time (60-70 minutes)
   - Time cannot be changed after selection

3. **Call the customer:**
   - Tap "1. Обади се"
   - Phone dialer opens automatically
   - Confirm order availability and details

4. **Approve the order:**
   - After call, tap "2. Одобри"
   - Confirm in dialog
   - Wait for success message
   - Order disappears from list

5. **If error occurs:**
   - Take screenshot
   - Note order ID
   - Contact support
   - Do NOT try to approve again (may duplicate)

### For Customers

1. **Entering phone number:**
   - Must start with `+359`
   - Followed by 9 digits
   - Example: `+359888123456`
   - No spaces or dashes

2. **After placing order:**
   - Save the tracking link
   - You can track order for 2 hours
   - Countdown shows estimated time
   - Progress bar shows completion

3. **Order status meanings:**
   - **Pending** - Restaurant is reviewing
   - **Approved** - Order confirmed, being prepared
   - **Completed** - Order ready/delivered

## Monitoring & Logs

### Key Log Messages

```bash
# Watch live logs
ssh root@46.62.174.218
journalctl -u restaurant.service -f

# Look for:
"Order approved, processing..."
"Delivery order - printing receipt..."
"Order printed successfully to: 192.168.x.x"
"Order sent to delivery service: ABC123"
"Failed to print order: [error]"
"Failed to send to delivery service: [error]"
```

### Database Queries

```bash
# On server
cd /var/www/resturant-website

# Count orders by phone
cat database.json | jq '.orders[] | select(.customerInfo.phone == "+359888123456") | .id'

# Find orders with approval data
cat database.json | jq '.orders[] | select(.approvedAt != null)'

# Check recent orders
cat database.json | jq '.orders[-5:]'
```

## Changelog

### Version 2.0 - December 2025

**Added:**
- Multi-step order approval workflow in mobile app
- Strict phone validation (+359 format)
- Order tracking page with countdown timer
- Returning customer badge
- Selective printing (delivery orders only)
- Time selection for order fulfillment

**Changed:**
- Order ID format from integer to string with timestamp
- Printer triggering logic (approved + delivery)
- API endpoints to support new fields

**Fixed:**
- Phone format inconsistencies
- Premature order approval
- Over-printing of pickup orders

---

**Last Updated:** December 21, 2025  
**Author:** GitHub Copilot  
**Support:** See QUICK_REFERENCE.md for contact info
