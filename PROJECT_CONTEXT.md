# Project Context - Restaurant Menu System

## Project Overview

**Project Name:** BOJOLE Restaurant Menu System  
**Type:** Full-Stack Web Application  
**Purpose:** Complete restaurant menu management system with customer-facing menu and admin panel  
**Target Audience:** Restaurant owners and their customers  
**Primary Language:** Bulgarian (with English translation support)  
**Technology Stack:** Node.js, Express, Vanilla JavaScript, CSS3  

## Business Context

### Problem Solved
Restaurants need a modern, responsive online menu system that allows:
- Customers to browse products, search, filter by categories, and view details
- Restaurant staff to manage products, promotions, slideshow banners, and settings without technical knowledge
- Real-time updates that reflect immediately on the customer-facing menu
- Multi-language support for Bulgarian and English audiences
- Mobile-first responsive design for optimal mobile ordering experience

### Key Features
1. **Customer Menu**: Browse products, search, filter, view details, see promotions and slideshow banners
2. **Admin Panel**: Complete CRUD operations for products, promotions, slideshow management, delivery settings
3. **Multi-language**: Seamless EN/BG translation for all content
4. **Image Management**: Upload and serve product/slideshow images from server
5. **Promotion System**: Time-based promotions with badges and discount percentages
6. **Slideshow Banner**: Configurable promotional slideshow on homepage (All Items category)
7. **Delivery Settings**: Configure cities, delivery fees, free delivery thresholds
8. **Responsive Design**: Mobile-first approach with optimized layouts for all devices

## Technical Architecture

### Application Structure
```
Frontend (Public Facing)
├── Customer Menu (index.html, app.js, styles.css)
├── Admin Panel (admin.html, admin.js, admin-styles.css)
└── Checkout Page (checkout.html, checkout.js)

Backend (Node.js + Express)
├── Server (server.js)
├── Database (database.json - JSON file storage)
├── File Upload System (multer middleware)
└── API Endpoints (RESTful API)

Deployment
├── Server: Ubuntu 46.62.174.218
├── Web Server: Nginx (reverse proxy)
├── Domain: crystalautomation.eu/resturant-website
└── Service: systemd (restaurant.service)
```

### Technology Decisions

**Why Vanilla JavaScript?**
- No framework overhead, faster load times
- Simpler deployment and maintenance
- Direct DOM manipulation for optimal performance
- Easier for restaurant staff to understand and modify

**Why JSON File Storage?**
- No database server required (simpler hosting)
- Easy backup and restore (single file)
- Human-readable format for debugging
- Sufficient for restaurant menu data volume
- Atomic writes prevent data corruption

**Why sessionStorage for Language/Cart?**
- Fast client-side storage
- No server load for frequent operations
- Automatic cleanup on browser close
- Privacy-friendly (no persistent tracking)

**Why Nginx + systemd?**
- Production-grade reverse proxy
- SSL termination support
- Auto-restart on failure
- Resource management and monitoring

## Deployment Configuration

### Server Details
- **IP:** 46.62.174.218
- **OS:** Ubuntu (latest)
- **Node.js:** v20.19.6
- **Service:** restaurant.service (systemd)
- **Port:** 3003 (internal), 80/443 (external via Nginx)
- **Base Path:** /resturant-website

### Deployment Process
1. PowerShell script (`deploy-to-server.ps1`) via SCP
2. Excludes `database.json` to preserve production data
3. Installs npm dependencies on server
4. Restarts systemd service
5. Reloads Nginx configuration

### URLs
- **Customer Menu:** https://www.crystalautomation.eu/resturant-website/
- **Admin Panel:** https://www.crystalautomation.eu/resturant-website/admin
- **Login:** https://www.crystalautomation.eu/resturant-website/login

### Admin Credentials
- **Username:** admin
- **Password:** admin123

⚠️ **Security Note:** In production, credentials should be environment variables with bcrypt hashing.

## Data Model

### Database Structure (database.json)
```json
{
  "restaurantName": "Restaurant Name",
  "logo": "URL or path to logo",
  "products": [ /* Product objects */ ],
  "promoCodes": [ /* Promo code objects */ ],
  "deliverySettings": { /* Delivery configuration */ },
  "deliveryCities": [ /* City pricing */ ],
  "workingHours": { /* Opening/closing times */ },
  "currencySettings": { /* EUR/BGN rates */ },
  "customization": { /* Color themes */ },
  "slideshowEnabled": boolean,
  "slideshowInterval": number,
  "slides": [ /* Slideshow images */ ],
  "orders": [ /* Customer orders */ ]
}
```

### Product Schema
```javascript
{
  id: "unique-id",
  name: "Product Name (English)",
  description: "Product description (English)",
  price: 12.99,
  category: "Category Name (English)",
  image: "/uploads/image.jpg",
  weight: "250g",
  promo: {
    enabled: true,
    promoPrice: 9.99,
    discountPercentage: 23
  },
  translations: {
    bg: {
      name: "Bulgarian Name",
      description: "Bulgarian Description",
      category: "Bulgarian Category"
    }
  }
}
```

## Development History

### Major Milestones
1. **Initial Setup**: Basic menu with product display
2. **Admin Panel**: Full CRUD operations for products
3. **Translation System**: EN/BG language switching
4. **Promotion System**: Badges, promo prices, promo categories
5. **Slideshow Feature**: Configurable banner slideshow
6. **Delivery System**: City-based pricing, free delivery thresholds
7. **Mobile Optimization**: Fixed truncation, centering, responsive layouts
8. **Admin Translation**: Bilingual admin panel with language switcher

### Recent Fixes (December 2025)
- ✅ Removed product name truncation on mobile (wraps to 2 lines)
- ✅ Centered back arrow in checkout using Font Awesome icon
- ✅ Added banner size recommendations (Desktop: 1200x400px, Mobile: 800x600px)
- ✅ Implemented full Bulgarian translation for admin panel
- ✅ Fixed language switcher CSS visibility in admin header
- ✅ Fixed BGN price font size to 12px on mobile
- ✅ Fixed checkout top bar height to 32px
- ✅ Fixed weight unit translation (г→g, мл→ml)

## Key Constraints & Limitations

### Current Limitations
1. **Slideshow**: Only displays in "All Items" category (by design)
2. **Session Storage**: Language/cart preferences cleared on browser close
3. **Admin Session**: Expires on browser close (security feature)
4. **Authentication**: Simple token-based (suitable for single admin)
5. **File Storage**: Images stored on local filesystem (no CDN)
6. **Concurrency**: JSON file locking via atomic writes (suitable for low concurrency)

### Scale Considerations
- **Current**: Suitable for single restaurant, 100-500 products
- **Future Growth**: Consider PostgreSQL if multi-location or 1000+ products
- **Image Storage**: Consider S3/CDN if traffic exceeds 10k visits/month

## Future Enhancements (Not Implemented)

### Potential Features
- Real-time order notifications (WebSockets)
- Customer accounts and order history
- Payment gateway integration
- Multi-restaurant support
- Advanced analytics dashboard
- Kitchen display system (KDS)
- QR code menu generation
- Third-party delivery integration (Glovo, Foodpanda)

## Related Projects

### Upcoming Integration
User mentioned: **"ще правим и още едно приложение свързано с това сега"**

Potential connections:
- Kitchen display system for order management
- Delivery driver tracking app
- Customer loyalty/rewards app
- Inventory management system
- Analytics dashboard for sales data

When building related apps, leverage:
- Same database schema for consistency
- Shared authentication system
- Common API endpoints (`/api/products`, `/api/orders`)
- Matching design system (colors, fonts, components)
- Base path configuration for unified deployment

## Contact & Maintenance

**Development Team:** GitHub Copilot + User  
**Repository:** C:\Users\User\Desktop\resturant-template  
**Server Access:** SSH to root@46.62.174.218  
**Service Management:** `systemctl status restaurant.service`  
**Logs:** `journalctl -u restaurant.service -f`  

**Deployment Script:** `.\deploy-to-server.ps1` (PowerShell)  
**Database Backup:** `ssh root@46.62.174.218 "cat /opt/resturant-website/database.json" > backup.json`
