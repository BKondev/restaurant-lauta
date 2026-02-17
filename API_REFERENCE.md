# API Reference - Restaurant Menu System

## Base Configuration

**Base URL:** `http://localhost:3003` (development) or `https://www.crystalautomation.eu/resturant-website` (production)  
**API Prefix:** `/api`  
**Content-Type:** `application/json`  
**CORS:** Enabled for all origins

## Authentication

### Overview
Simple token-based authentication for admin operations.

### Login
**POST** `/api/login`

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "abc123xyz789def456...",
  "message": "Login successful"
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**Storage:** Token saved in `sessionStorage.adminToken`

---

### Logout
**POST** `/api/logout`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Protected Routes
All admin operations require authentication header:
```
Authorization: Bearer {token}
```

**401 Response if token missing/invalid:**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

---

## Products API

### Get All Products
**GET** `/api/products`

**Authentication:** None (public)

**Response (200 OK):**
```json
[
  {
    "id": "prod_1702345678901",
    "name": "Caesar Salad",
    "description": "Fresh romaine lettuce with parmesan",
    "price": 8.99,
    "category": "Salads",
    "image": "/resturant-website/uploads/1702345678901-caesar.jpg",
    "weight": "250g",
    "promo": {
      "enabled": true,
      "promoPrice": 6.99,
      "discountPercentage": 22
    },
    "translations": {
      "bg": {
        "name": "Салата Цезар",
        "description": "Пресен ромен с пармезан",
        "category": "Салати"
      }
    }
  }
]
```

---

### Get Single Product
**GET** `/api/products/:id`

**Authentication:** None (public)

**Response (200 OK):**
```json
{
  "id": "prod_1702345678901",
  "name": "Caesar Salad",
  "description": "Fresh romaine lettuce...",
  "price": 8.99,
  "category": "Salads",
  "image": "/resturant-website/uploads/1702345678901-caesar.jpg",
  "weight": "250g",
  "promo": null,
  "translations": {
    "bg": {
      "name": "Салата Цезар",
      "description": "Пресен ромен...",
      "category": "Салати"
    }
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Product not found"
}
```

---

### Create Product
**POST** `/api/products`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Greek Salad",
  "description": "Tomatoes, cucumber, feta cheese",
  "price": 7.99,
  "category": "Salads",
  "image": "https://example.com/greek-salad.jpg",
  "weight": "300g",
  "promo": {
    "enabled": false,
    "promoPrice": 0,
    "discountPercentage": 0
  },
  "translations": {
    "bg": {
      "name": "Гръцка Салата",
      "description": "Домати, краставици, сирене фета",
      "category": "Салати"
    }
  }
}
```

**Response (201 Created):**
```json
{
  "id": "prod_1702345678902",
  "name": "Greek Salad",
  "description": "Tomatoes, cucumber, feta cheese",
  "price": 7.99,
  "category": "Salads",
  "image": "https://example.com/greek-salad.jpg",
  "weight": "300g",
  "promo": null,
  "translations": {
    "bg": {
      "name": "Гръцка Салата",
      "description": "Домати, краставици, сирене фета",
      "category": "Салати"
    }
  }
}
```

---

### Update Product
**PUT** `/api/products/:id`

**Authentication:** Required

**Request Body:** Same as Create Product (all fields)

**Response (200 OK):**
```json
{
  "id": "prod_1702345678902",
  "name": "Greek Salad (Updated)",
  "description": "Updated description...",
  "price": 8.49,
  "category": "Salads",
  "image": "/resturant-website/uploads/new-image.jpg",
  "weight": "350g",
  "promo": {
    "enabled": true,
    "promoPrice": 6.99,
    "discountPercentage": 18
  },
  "translations": {
    "bg": {
      "name": "Гръцка Салата (Обновена)",
      "description": "Обновено описание...",
      "category": "Салати"
    }
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Product not found"
}
```

---

### Delete Product
**DELETE** `/api/products/:id`

**Authentication:** Required

**Response (200 OK):**
```json
{
  "message": "Product deleted successfully"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Product not found"
}
```

---

### Batch Delete Products
**DELETE** `/api/products/batch`

**Authentication:** Required

**Request Body:**
```json
{
  "ids": ["prod_1702345678901", "prod_1702345678902", "prod_1702345678903"]
}
```

**Response (200 OK):**
```json
{
  "message": "3 products deleted successfully",
  "deletedIds": ["prod_1702345678901", "prod_1702345678902", "prod_1702345678903"]
}
```

---

## Image Upload API

### Upload Image
**POST** `/api/upload`

**Authentication:** Required

**Content-Type:** `multipart/form-data`

**Form Data:**
- `image`: File (max 5MB, formats: jpeg, jpg, png, gif, webp)

**Response (200 OK):**
```json
{
  "url": "/resturant-website/uploads/1702345678901-123456789.jpg"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "No file uploaded"
}
```

**Response (413 Payload Too Large):**
```json
{
  "error": "File size exceeds 5MB limit"
}
```

**Notes:**
- Images saved to `uploads/` directory
- Filename format: `{timestamp}-{random}.{ext}`
- URL includes BASE_PATH for subdirectory deployment

---

## Settings API

### Get All Settings
**GET** `/api/settings`

**Authentication:** None (public)

**Response (200 OK):**
```json
{
  "name": "BOJOLE Restaurant",
  "logo": "/resturant-website/uploads/logo.png"
}
```

---

### Get Restaurant Name
**GET** `/api/settings/name`

**Authentication:** None (public)

**Response (200 OK):**
```json
{
  "name": "BOJOLE Restaurant"
}
```

---

### Update Restaurant Name
**PUT** `/api/settings/name`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "New Restaurant Name"
}
```

**Response (200 OK):**
```json
{
  "name": "New Restaurant Name"
}
```

---

### Get Customization Settings
**GET** `/api/settings/customization`

**Authentication:** None (public)

**Response (200 OK):**
```json
{
  "topBarColor": "#2c3e50",
  "backgroundColor": "#f5f5f5",
  "highlightColor": "#e74c3c",
  "priceColor": "#e74c3c",
  "backgroundImage": ""
}
```

---

### Update Customization
**PUT** `/api/settings/customization`

**Authentication:** Required

**Request Body:**
```json
{
  "topBarColor": "#3498db",
  "backgroundColor": "#ecf0f1",
  "highlightColor": "#e67e22",
  "priceColor": "#27ae60",
  "backgroundImage": "https://example.com/bg.jpg"
}
```

**Response (200 OK):**
```json
{
  "topBarColor": "#3498db",
  "backgroundColor": "#ecf0f1",
  "highlightColor": "#e67e22",
  "priceColor": "#27ae60",
  "backgroundImage": "https://example.com/bg.jpg"
}
```

---

### Get Currency Settings
**GET** `/api/settings/currency`

**Authentication:** None (public)

**Response (200 OK):**
```json
{
  "eurToBgnRate": 1.9558,
  "showBgnPrices": true
}
```

---

### Update Currency Settings
**PUT** `/api/settings/currency`

**Authentication:** Required

**Request Body:**
```json
{
  "eurToBgnRate": 1.96,
  "showBgnPrices": false
}
```

**Response (200 OK):**
```json
{
  "eurToBgnRate": 1.96,
  "showBgnPrices": false
}
```

---

## Delivery API

### Get Delivery Settings
**GET** `/api/settings/delivery`

**Authentication:** None (public)

**Response (200 OK):**
```json
{
  "enabled": true,
  "standardFee": 5.00,
  "freeDeliveryThreshold": 50.00,
  "enableFreeDelivery": true
}
```

---

### Update Delivery Settings
**PUT** `/api/settings/delivery`

**Authentication:** Required

**Request Body:**
```json
{
  "enabled": true,
  "standardFee": 4.50,
  "freeDeliveryThreshold": 45.00,
  "enableFreeDelivery": true
}
```

**Response (200 OK):**
```json
{
  "enabled": true,
  "standardFee": 4.50,
  "freeDeliveryThreshold": 45.00,
  "enableFreeDelivery": true
}
```

---

### Get Delivery Cities
**GET** `/api/delivery/cities`

**Authentication:** None (public)

**Response (200 OK):**
```json
[
  {
    "id": "city_1702345678901",
    "name": "София",
    "price": 5.00
  },
  {
    "id": "city_1702345678902",
    "name": "Пловдив",
    "price": 7.00
  }
]
```

---

### Add Delivery City
**POST** `/api/delivery/cities`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Варна",
  "price": 8.00
}
```

**Response (201 Created):**
```json
{
  "id": "city_1702345678903",
  "name": "Варна",
  "price": 8.00
}
```

---

### Update Delivery City
**PUT** `/api/delivery/cities/:id`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Варна",
  "price": 7.50
}
```

**Response (200 OK):**
```json
{
  "id": "city_1702345678903",
  "name": "Варна",
  "price": 7.50
}
```

---

### Delete Delivery City
**DELETE** `/api/delivery/cities/:id`

**Authentication:** Required

**Response (200 OK):**
```json
{
  "message": "City deleted successfully"
}
```

---

## Working Hours API

### Get Working Hours
**GET** `/api/working-hours`

**Authentication:** None (public)

**Response (200 OK):**
```json
{
  "opening": "09:00",
  "closing": "22:00"
}
```

---

### Update Working Hours
**PUT** `/api/working-hours`

**Authentication:** Required

**Request Body:**
```json
{
  "opening": "10:00",
  "closing": "23:00"
}
```

**Response (200 OK):**
```json
{
  "opening": "10:00",
  "closing": "23:00"
}
```

---

## Slideshow API

### Get Slideshow Settings
**GET** `/api/slideshow`

**Authentication:** None (public)

**Response (200 OK):**
```json
{
  "enabled": true,
  "autoPlayInterval": 5000,
  "slides": [
    {
      "id": "slide_1702345678901",
      "image": "/resturant-website/uploads/banner1.jpg",
      "title": "Summer Special"
    },
    {
      "id": "slide_1702345678902",
      "image": "/resturant-website/uploads/banner2.jpg",
      "title": "New Menu Items"
    }
  ]
}
```

---

### Update Slideshow Settings
**PUT** `/api/slideshow`

**Authentication:** Required

**Request Body:**
```json
{
  "enabled": true,
  "autoPlayInterval": 7000,
  "slides": [
    {
      "id": "slide_1702345678901",
      "image": "/resturant-website/uploads/banner1.jpg",
      "title": "Summer Special"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "message": "Slideshow settings updated successfully",
  "settings": {
    "enabled": true,
    "autoPlayInterval": 7000,
    "slides": [ /* same as request */ ]
  }
}
```

**Notes:**
- Maximum 10 slides allowed
- Slides displayed only in "All Items" category
- Auto-play interval: 3000-30000ms (3-30 seconds)

---

## Orders API

### Get All Orders
**GET** `/api/orders`

**Authentication:** Required

**Query Parameters (optional):**
- `status` - Filter by status (`pending`, `approved`, `rejected`, etc.)
- `date` - Filter by date (`YYYY-MM-DD`) in the client timezone (requires `tzOffsetMinutes`)
- `from` / `to` - Filter by date range. Accepts `YYYY-MM-DD` (uses `tzOffsetMinutes`) or full ISO timestamps
- `tzOffsetMinutes` - Timezone offset in minutes (use JS `new Date().getTimezoneOffset()`)

**Response (200 OK):**
```json
[
  {
    "id": "order_1702345678901",
    "items": [
      {
        "id": "prod_1702345678901",
        "name": "Caesar Salad",
        "price": 8.99,
        "quantity": 2
      }
    ],
    "total": 17.98,
    "deliveryMethod": "delivery",
    "deliveryAddress": "ул. Витоша 123, София",
    "customerName": "Иван Иванов",
    "customerPhone": "+359888123456",
    "customerEmail": "ivan@example.com",
    "status": "pending",
    "createdAt": "2025-12-19T10:30:00.000Z"
  }
]
```

---

### Get Today's Orders
**GET** `/api/orders/today`

**Authentication:** Required

**Query Parameters (optional):**
- `status` - Filter by status
- `tzOffsetMinutes` - Timezone offset in minutes (use JS `new Date().getTimezoneOffset()`)

**Response (200 OK):** Same shape as **Get All Orders**

---

### Create Order
**POST** `/api/orders`

**Authentication:** None (public - customer action)

**Request Body:**
```json
{
  "items": [
    {
      "id": "prod_1702345678901",
      "name": "Caesar Salad",
      "price": 8.99,
      "quantity": 2
    }
  ],
  "total": 22.98,
  "deliveryMethod": "delivery",
  "deliveryFee": 5.00,
  "deliveryAddress": "ул. Витоша 123, София",
  "deliveryCity": "София",
  "customerName": "Иван Иванов",
  "customerPhone": "+359888123456",
  "customerEmail": "ivan@example.com"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "orderId": "order_1702345678901",
  "message": "Order placed successfully"
}
```

---

### Update Order Status
**PUT** `/api/orders/:id`

**Authentication:** Required

**Request Body:**
```json
{
  "status": "accepted"
}
```

**Valid Statuses:** `"pending"`, `"accepted"`, `"completed"`, `"cancelled"`

**Response (200 OK):**
```json
{
  "message": "Order status updated successfully",
  "order": {
    "id": "order_1702345678901",
    "status": "accepted",
    /* ...other order fields */
  }
}
```

---

## Error Responses

### Common Error Formats

**400 Bad Request:**
```json
{
  "error": "Invalid request data",
  "details": "Missing required field: name"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**404 Not Found:**
```json
{
  "error": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "Failed to read database"
}
```

---

## Rate Limiting

Currently **no rate limiting** implemented. For production, consider:
- 100 requests/minute for public endpoints
- 1000 requests/minute for authenticated admin

---

## CORS Configuration

**Current:** Allows all origins (`*`)

**Production Recommendation:** Restrict to specific domains:
```javascript
cors({
  origin: ['https://www.crystalautomation.eu', 'https://crystalautomation.eu'],
  credentials: true
})
```

---

## Testing with cURL

### Login Example
```bash
curl -X POST http://localhost:3003/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Get Products Example
```bash
curl http://localhost:3003/api/products
```

### Create Product Example
```bash
curl -X POST http://localhost:3003/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"name":"Test Product","price":9.99,"category":"Test","image":"https://example.com/img.jpg"}'
```

### Upload Image Example
```bash
curl -X POST http://localhost:3003/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "image=@/path/to/image.jpg"
```
