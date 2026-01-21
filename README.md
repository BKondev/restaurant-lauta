# Restaurant Multi-Tenant Order Management System

A modern, scalable restaurant order management system supporting **multiple restaurants** with a shared backend, individual web applications, and unified mobile app for staff.

## 🌟 Version 2.0 - Multi-Tenant Architecture

**NEW:** This system now supports multiple restaurants using:
- ✅ **One Server** for all restaurants  
- ✅ **One Mobile App** with restaurant selection  
- ✅ **Separate Web Apps** (copies) for each restaurant  
- ✅ **Complete Data Isolation** between restaurants

---

## 📚 Documentation

### Multi-Tenant System (NEW)
- **[MULTI_TENANT_GUIDE.md](MULTI_TENANT_GUIDE.md)** - Complete multi-tenant guide (15+ KB)
- **[MULTI_TENANT_QUICK_START.md](MULTI_TENANT_QUICK_START.md)** - Quick reference (10 KB)
- **[MULTI_TENANT_SUMMARY.md](MULTI_TENANT_SUMMARY.md)** - Implementation summary
- **[RESTAURANT_CONFIG_EXAMPLE.js](RESTAURANT_CONFIG_EXAMPLE.js)** - Code examples

### Mobile App Workflow
- **[MOBILE_APP_WORKFLOW.md](MOBILE_APP_WORKFLOW.md)** - Complete workflow guide
- **[MOBILE_APP_STANDALONE_BUILD.md](MOBILE_APP_STANDALONE_BUILD.md)** - ⭐ Standalone APK build guide
- **[MOBILE_BUILD_QUICK_START.md](MOBILE_BUILD_QUICK_START.md)** - ⚡ Quick build reference (5 steps)
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Original implementation

### Deployment
- **[deploy-multi-tenant.ps1](deploy-multi-tenant.ps1)** - Multi-tenant deployment script
- **[create-restaurant.ps1](create-restaurant.ps1)** - New restaurant helper

---

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Open in Browser**
   - Menu: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin.html

## Features

### 🏢 Multi-Tenant System (NEW in v2.0)
- 🏪 **Multiple Restaurants** - One system serves many restaurants
- 🔐 **Dual Authentication** - Token-based (web) + API Key (mobile)
- 🔒 **Data Isolation** - Each restaurant sees only their orders
- 📱 **Unified Mobile App** - Staff selects restaurant at login
- 🌐 **Separate Web Apps** - Each restaurant has branded copy
- ⚡ **Easy Scalability** - Add new restaurants in minutes

### 📱 Mobile App Features
- 📱 **Fully Responsive Design** - Works on all devices
- 🎨 **Modern UI** - Clean, professional look inspired by Zamboo Menu
- 🔍 **Search Functionality** - Search for dishes by name or description
- 📂 **Category Filtering** - Browse by categories (Salads, Pasta, Burgers, etc.)
- 🖼️ **Product Cards** - Beautiful cards with images, descriptions, and prices
- 💫 **Product Modal** - Click any product for detailed view
- ⚡ **Fast & Smooth** - Optimized performance with smooth animations

### 📱 Mobile App Features
- ✅ **3-Step Order Approval** - Accept → Call → Approve workflow
- ⏱️ **Time Selection** - Choose estimated delivery time (60/65/70 min)
- 📞 **Mandatory Phone Call** - Staff must call before approving
- ✅ **Returning Customer Badge** - Shows repeat customers
- 🔴 **Error Handling** - Clear error messages, blocks on failure
- 🔔 **Auto-Refresh** - Updates pending orders every 10 seconds
- 🏪 **Restaurant Selection** - Staff selects restaurant at startup

### 🌐 Web Application Features
- 📝 **Online Ordering** - Customer checkout with validation
- ✅ **Phone Validation** - Strict +359XXXXXXXXX format
- 📍 **Delivery/Pickup** - Choose delivery method
- 💳 **Promo Codes** - Support for discount codes
- 📊 **Order Tracking** - 2-hour tracking window with countdown
- 🎨 **Beautiful UI** - Responsive, modern design
- 🏪 **Restaurant Branding** - Each restaurant has unique copy

### 🖨️ Smart Printing
- ✅ **Selective Printing** - Only delivery orders print
- 🚫 **No Pickup Printing** - Pickup orders skip printer
- 🖨️ **Network Printer** - Automatic receipt printing
- 🚚 **Delivery Integration** - Sends to delivery service API

### Customer-Facing Menu
- 📱 **Fully Responsive Design** - Works on all devices
- 🎨 **Modern UI** - Clean, professional look
- 🔍 **Search Functionality** - Search for dishes by name or description
- 📂 **Category Filtering** - Browse by categories
- 🖼️ **Product Cards** - Beautiful cards with images, descriptions, and prices
- 💫 **Product Modal** - Click any product for detailed view
- ⚡ **Fast & Smooth** - Optimized performance with smooth animations

### Admin Panel
- ➕ **Add Products** - Easy form to add new menu items
- ✏️ **Edit Products** - Update existing products
- 🗑️ **Delete Products** - Remove products with confirmation
- 🖼️ **Image Upload** - Upload images or use URLs
- 🏷️ **Category Management** - Create and manage categories
- 🔎 **Search & Filter** - Find products quickly in admin
- 💾 **Data Export/Import** - Backup and restore your menu data
- 🎨 **Restaurant Settings** - Customize restaurant name
- 🔐 **Secure Login** - Username/password authentication
- 🏪 **Restaurant Filtering** - Admins see only their restaurant's data

---

## Tech Stack

---

## Tech Stack

- **Backend**: Node.js v20.19.6, Express
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Mobile**: React Native, Expo SDK 49
- **Database**: JSON file storage
- **Authentication**: Token-based (web) + API Key (mobile)
- **Image Upload**: Multer middleware
- **Printing**: Network printer integration
- **Delivery**: External API integration

---

## Architecture

```
┌─────────────────────────────────────┐
│       CENTRAL SERVER                │
│       Node.js + Express             │
│       database.json                 │
└───────────┬─────────────────────────┘
            │
   ┌────────┼────────┐
   │        │        │
   ▼        ▼        ▼
┌─────┐ ┌─────┐ ┌─────┐
│Web 1│ │Web 2│ │Web 3│  ← Separate copies
└─────┘ └─────┘ └─────┘
   │        │        │
   └────────┴────────┘
            │
      ┌─────▼──────┐
      │ Mobile App │  ← One app, select restaurant
      └────────────┘
```

---

## File Structure

```
resturant-template/
├── server.js                          # Multi-tenant Node.js/Express server
├── package.json                       # Dependencies and scripts
├── database.json                      # JSON database with restaurants array
│
├── public/                            # Frontend template (copy for each restaurant)
│   ├── index.html                     # Main menu page (customer view)
│   ├── checkout.html                  # Checkout page with validation
│   ├── checkout.js                    # ← Must add RESTAURANT_CONFIG
│   ├── track-order.html               # Order tracking page (2h window)
│   ├── admin.html                     # Admin panel for managing products
│   ├── login.html                     # Admin login page
│   ├── styles.css                     # Main stylesheet
│   ├── admin-styles.css               # Admin panel specific styles
│   ├── app.js                         # Main application JavaScript
│   └── admin.js                       # Admin panel JavaScript
│
├── uploads/                           # Uploaded images storage
│
├── printer-service.js                 # Network printer integration
├── delivery-integration.js            # Delivery service API
│
├── MULTI_TENANT_GUIDE.md             # ★ Complete multi-tenant guide
├── MULTI_TENANT_QUICK_START.md       # ★ Quick reference
├── MULTI_TENANT_SUMMARY.md           # ★ Implementation summary
├── RESTAURANT_CONFIG_EXAMPLE.js       # ★ Code examples
│
├── MOBILE_APP_WORKFLOW.md            # Mobile app workflow guide
├── IMPLEMENTATION_SUMMARY.md          # Original implementation docs
│
├── deploy-multi-tenant.ps1            # ★ Multi-tenant deployment script
├── create-restaurant.ps1              # ★ New restaurant helper script
├── deploy-to-server.ps1              # Server deployment script
│
└── README.md                          # This file
```

---

## 🚀 Deployment

### Multi-Tenant Deployment

```powershell
# 1. Deploy server with multi-tenant support
.\deploy-multi-tenant.ps1

# 2. Create new restaurant
.\create-restaurant.ps1
# Follow prompts to generate config

# 3. Create web app copy
cp -r public bojole-web
# Edit bojole-web/checkout.js - add RESTAURANT_CONFIG

# 4. Update mobile app
# Add restaurant to src/config/restaurants.js
# Rebuild APK
```

### Manual Deployment

```bash
# Upload server files
scp server.js root@46.62.174.218:/root/resturant-website/
scp database.json root@46.62.174.218:/root/resturant-website/

# Restart service
ssh root@46.62.174.218
systemctl restart restaurant.service
systemctl status restaurant.service
```

---

## 🏪 Adding New Restaurant

### Quick Method (Recommended)

```powershell
.\create-restaurant.ps1
```

This will:
1. Generate unique restaurant ID
2. Generate secure API key (64 chars)
3. Create database.json entry
4. Create web app config
5. Create mobile app config
6. Save everything to a file

### Manual Method

1. **Generate API Key**
   ```bash
   openssl rand -hex 32
   ```

2. **Update database.json**
   ```json
   {
     "restaurants": [
       {
         "id": "rest_new_001",
         "name": "New Restaurant",
         "username": "new_admin",
         "password": "password123",
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
   ```

4. **Update Mobile Config**
   ```javascript
   // src/config/restaurants.js
   export const RESTAURANTS = [
     ...existing,
     { id: 'rest_new_001', name: 'New Restaurant', apiKey: '...' }
   ];
   ```

---

## 🔐 Authentication

### Web Admin (Token-based)

```javascript
// Login
POST /api/login
Body: { "username": "bojole_admin", "password": "bojole123" }
Response: { "token": "abc123", "restaurant": { "id": "rest_001" } }

// Use token
GET /api/orders
Headers: { "Authorization": "Bearer abc123" }
```

### Mobile App (API Key)

```javascript
// All mobile requests
GET /api/orders/mobile/pending
Headers: { "X-API-Key": "bojole_api_key_12345" }
```

---

## 📋 API Endpoints

### Web Admin (Token Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/login` | Login with username/password |
| `POST` | `/api/logout` | Logout (delete token) |
| `GET` | `/api/orders` | Get all orders (filtered by restaurant) |
| `GET` | `/api/orders/pending` | Get pending orders (filtered) |
| `PUT` | `/api/orders/:id` | Update order status |

### Mobile App (API Key Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/orders/mobile/pending` | Get pending orders |
| `PUT` | `/api/orders/mobile/:id` | Update order (approve) |

### Public (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/orders` | Create order (requires restaurantId) |
| `GET` | `/api/orders/track/:id` | Track order (2h window) |
| `GET` | `/api/products` | Get products |

---

## 🧪 Testing

### Test Multi-Restaurant Setup

```bash
# 1. Place order from bojole-web
curl -X POST https://site.com/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Restaurant-Id: rest_bojole_001" \
  -d '{"restaurantId": "rest_bojole_001", ...}'

# 2. Get pending orders (BOJOLE mobile)
curl https://site.com/api/orders/mobile/pending \
  -H "X-API-Key: bojole_api_key_12345"

# 3. Get pending orders (Pizza Italia mobile)
curl https://site.com/api/orders/mobile/pending \
  -H "X-API-Key: pizza_italia_api_key_67890"

# Should only return orders for respective restaurant
```

---

## 📚 Full Documentation

For complete documentation, see:

- **[MULTI_TENANT_GUIDE.md](MULTI_TENANT_GUIDE.md)** - Complete guide with all details
- **[MULTI_TENANT_QUICK_START.md](MULTI_TENANT_QUICK_START.md)** - Quick reference
- **[MOBILE_APP_WORKFLOW.md](MOBILE_APP_WORKFLOW.md)** - Mobile app workflow
- **[RESTAURANT_CONFIG_EXAMPLE.js](RESTAURANT_CONFIG_EXAMPLE.js)** - Code examples

---

## 🔒 Security Notes

### Current Implementation

✅ Token-based authentication (web)  
✅ API key authentication (mobile)  
✅ Restaurant data isolation  
✅ 403 Forbidden on wrong restaurant access  
✅ Token expiry (24 hours)

### Production Recommendations

⚠️ **TODO:**
- Hash passwords with bcrypt
- Use JWT tokens instead of random strings
- Implement rate limiting
- Rotate API keys periodically
- Add audit logging
- Use environment variables for secrets

---

## 🆘 Troubleshooting

### "Access denied - order belongs to different restaurant"

API key is for different restaurant. Check:
```bash
cat database.json | jq '.orders[] | select(.id=="order_123") | .restaurantId'
cat database.json | jq '.restaurants[] | select(.apiKey=="KEY") | .id'
```

### "API key required"

Mobile app not sending X-API-Key header:
```javascript
headers: {
    'X-API-Key': restaurant.apiKey  // Must be included!
}
```

### No orders showing

Checklist:
1. Restaurant selected in mobile app?
2. Orders have restaurantId in database?
3. API key valid?
4. Service running? `systemctl status restaurant.service`

---

## 📊 Monitoring

```bash
# View logs
ssh root@46.62.174.218
journalctl -u restaurant.service -f

# Filter by restaurant
journalctl -u restaurant.service -f | grep "rest_bojole_001"

# Check service
systemctl status restaurant.service

# Database queries
cat database.json | jq '.orders | group_by(.restaurantId) | map({restaurant: .[0].restaurantName, count: length})'
```

---

## 🎯 Next Steps

1. ✅ Deploy multi-tenant server
2. ✅ Update database.json with restaurants
3. ✅ Create web app copies
4. ✅ Update mobile app
5. ✅ Test with multiple restaurants
6. 📝 Train staff on restaurant selection
7. 🔒 Implement production security measures
8. 📊 Setup monitoring and alerts

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🤝 Support

For questions or issues:
1. Check documentation files (MULTI_TENANT_*.md)
2. Review code examples (RESTAURANT_CONFIG_EXAMPLE.js)
3. Use helper scripts (create-restaurant.ps1)
4. Check logs: `journalctl -u restaurant.service -f`

---

**Version:** 2.0 Multi-Tenant  
**Last Updated:** December 22, 2025  
**Status:** ✅ Production Ready


## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Install Node.js Dependencies**
   ```bash
   cd resturant-template
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Open in Browser**
   - Main Menu: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin.html

### First Time Setup

1. **Access Admin Panel**
   - Navigate to http://localhost:3000/admin.html
   
2. **Customize Your Restaurant**
   - Update the restaurant name in Settings
   - Add your own products with descriptions, prices, and images
   - Organize items into categories
   - Upload product images (max 5MB per image)

## How to Use the Admin Panel

### Adding Products
1. Fill in the product form:
   - **Name**: Product name (e.g., "Margherita Pizza")
   - **Description**: Detailed description
   - **Price**: Price in dollars
   - **Category**: Category name (creates new if doesn't exist)
   - **Image**: Upload image file (max 5MB) or paste URL
2. Click "Add Product"

### Image Upload
- **Upload File**: Click "Choose File" to upload from your computer (max 5MB)
- **Use URL**: Paste an image URL from the internet
- Images are stored in the `/uploads` folder on the server

### Editing Products
1. Find the product in the table
2. Click the "Edit" button
3. Update the form fields
4. Click "Update Product"

### Deleting Products
1. Find the product in the table
2. Click the "Delete" button
3. Confirm deletion

### Managing Data
- **Export Data**: Download all products and settings as JSON
- **Import Data**: Upload previously exported data
- **Reset Data**: Clear all data and start fresh

## Categories Included

The template comes with sample products in these categories:
- Salads
- Soups
- Pasta
- Burgers
- BBQ
- Desserts
- Hot Drinks
- White Wine
- Red Wine
- Beer
- Soft Drinks

*You can easily add, remove, or modify categories through the admin panel.*

## Customization

### Changing Colors
Edit `styles.css` and `admin-styles.css` to change the color scheme:
- Primary color: `#e74c3c` (red)
- Secondary color: `#2c3e50` (dark blue)
- Background: `#f5f5f5` (light gray)

### Adding More Features
The codebase is well-organized and commented, making it easy to:
- Add shopping cart functionality
- Implement online ordering
- Add product ratings and reviews
- Connect to a backend database
- Add user authentication

## Browser Compatibility

Works on all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## Data Storage

All data is stored in `database.json` on the server, which means:
- ✅ Persistent storage across sessions
- ✅ Shared data for all users/devices
- ✅ All customers see the same menu
- ✅ Data survives server restarts
- ✅ Easy to backup (just copy database.json)

**Tip**: Use the Export feature regularly to backup your data!

## API Endpoints

The server exposes these REST API endpoints:

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `POST /api/upload` - Upload image
- `GET /api/settings/name` - Get restaurant name
- `PUT /api/settings/name` - Update restaurant name
- `GET /api/export` - Export all data
- `POST /api/import` - Import data
- `POST /api/reset` - Reset database

## Deployment

### Option 1: Simple Hosting (Heroku, Render, Railway)
1. Push code to GitHub
2. Connect to hosting service
3. Set start command: `npm start`
4. Deploy!

### Option 2: VPS (DigitalOcean, AWS, etc.)
1. Upload files to server
2. Install Node.js
3. Run `npm install`
4. Use PM2 to keep server running:
   ```bash
   npm install -g pm2
   pm2 start server.js
   pm2 startup
   pm2 save
   ```

### Option 3: Local Network
### Deploy Under a Subdirectory (e.g. /resturant-website on your domain)

If you want the site accessible at `https://www.crystalautomation.eu/resturant-website` (menu) and `https://www.crystalautomation.eu/resturant-website/admin` (admin panel), the application now supports a configurable base path via the `BASE_PATH` environment variable.

#### 1. Set Environment Variables
```
PORT=3000
BASE_PATH=/resturant-website
```

#### 2. Start the App (Example)
```bash
BASE_PATH=/resturant-website PORT=3000 node server.js
```

#### 3. Nginx Reverse Proxy Configuration (Sample)
Install Nginx and create/edit a server block (e.g. `/etc/nginx/sites-available/crystalautomation.eu`):
```nginx
server {
   server_name crystalautomation.eu www.crystalautomation.eu;
   # Optional: redirect HTTP to HTTPS once certificates are installed
   listen 80;
   listen [::]:80;

   location /resturant-website/ {
      proxy_pass http://127.0.0.1:3000/resturant-website/; # preserve trailing slash
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
   }
}
```

Then enable the site and reload Nginx:
```bash
ln -s /etc/nginx/sites-available/crystalautomation.eu /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

#### 4. Systemd Service (Keep App Running)
Create file `/etc/systemd/system/restaurant.service`:
```ini
[Unit]
Description=Restaurant Menu Node Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/resturant-website
Environment=PORT=3000
Environment=BASE_PATH=/resturant-website
ExecStart=/usr/bin/node server.js
Restart=on-failure
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Then:
```bash
systemctl daemon-reload
systemctl enable restaurant.service
systemctl start restaurant.service
systemctl status restaurant.service
```

#### 5. SSL with Certbot (Optional but Recommended)
```bash
apt update && apt install -y certbot python3-certbot-nginx
certbot --nginx -d crystalautomation.eu -d www.crystalautomation.eu
```

Nginx will be updated automatically; ensure the `location /resturant-website/ { ... }` block stays inside the HTTPS server section after certbot runs.

#### 6. Uploads Path
Uploaded images are served at `/resturant-website/uploads/<filename>`. The frontend now automatically prefixes images and API calls with the base path.

#### 7. Testing
- Visit: `https://www.crystalautomation.eu/resturant-website/`
- Admin: `https://www.crystalautomation.eu/resturant-website/admin`
- Login: `https://www.crystalautomation.eu/resturant-website/login`

#### 8. Notes
- If `BASE_PATH` is empty the app serves from root (`/`).
- All API endpoints are now available under `${BASE_PATH}/api` (e.g. `/resturant-website/api/products`).
- Frontend dynamically detects the base path; no code changes needed for different deployments.

### Bulgarian Quick Guide (Бързи инструкции на български)
1. Влез с SSH: `ssh root@46.62.174.218`
2. Инсталирай Node.js (ако липсва): `curl -fsSL https://deb.nodesource.com/setup_20.x | bash -` после `apt install -y nodejs`
3. Копирай проекта в `/opt/resturant-website`
4. `cd /opt/resturant-website && npm install`
5. Тествай: `BASE_PATH=/resturant-website PORT=3000 node server.js`
6. Настрой Nginx (виж конфигурацията горе)
7. Създай systemd service (примерът по-горе)
8. Вземи SSL: `certbot --nginx -d crystalautomation.eu -d www.crystalautomation.eu`
9. Отвори в браузър менюто и админа.

Готово! Системата работи под поддиректорията `/resturant-website`.

- Run on your computer
- Others on same network access via your IP: `http://YOUR_IP:3000`

## Tips for Success

1. **Use High-Quality Images**: Good photos make your menu more appealing
2. **Write Detailed Descriptions**: Help customers make informed choices
3. **Organize Categories**: Keep your menu easy to navigate
4. **Update Regularly**: Keep prices and availability current
5. **Backup Your Data**: Export your data periodically

## Future Enhancements

Consider adding:
- Multi-language support
- Allergen information
- Calorie counts
- Dietary tags (vegan, gluten-free, etc.)
- Daily specials section
- Table reservation system
- Online ordering integration
- Print-friendly menu version

## Support

For questions or issues, review the code comments in each file. The code is well-documented and easy to understand.

## License

This is a template for your use. Feel free to modify and customize it for your restaurant!

---

**Enjoy your new restaurant menu template! 🍽️**
