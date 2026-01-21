#!/bin/bash
# Deployment script for Restaurant Menu Template
# Deploy to: www.crystalautomation.eu/resturant-website
# Run this script on your server after uploading the files

set -e  # Exit on any error

echo "=========================================="
echo "Restaurant Menu Deployment Script"
echo "=========================================="

# Configuration
DEPLOY_DIR="/opt/resturant-website"
SERVICE_NAME="restaurant"
DOMAIN="crystalautomation.eu"
BASE_PATH="/resturant-website"
PORT=3004

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "Step 1: Installing Node.js (if needed)..."
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

echo ""
echo "Step 2: Creating deployment directory..."
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

echo ""
echo "Step 3: Installing npm dependencies..."
npm install --production

echo ""
echo "Step 4: Creating systemd service..."
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Restaurant Menu Node Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${DEPLOY_DIR}
Environment=PORT=${PORT}
Environment=BASE_PATH=${BASE_PATH}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "Step 5: Setting up file permissions..."
chown -R www-data:www-data $DEPLOY_DIR
chmod -R 755 $DEPLOY_DIR

echo ""
echo "Step 6: Installing Nginx (if needed)..."
if ! command -v nginx &> /dev/null; then
    echo "Nginx not found. Installing..."
    apt-get update
    apt-get install -y nginx
else
    echo "Nginx already installed: $(nginx -v 2>&1)"
fi

echo ""
echo "Step 7: Configuring Nginx..."
# Check if SSL config exists, if not create HTTP-only config
if [ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]; then
    echo "SSL certificate found, configuring HTTPS..."
    cat > /etc/nginx/sites-available/${DOMAIN} << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name crystalautomation.eu www.crystalautomation.eu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name crystalautomation.eu www.crystalautomation.eu;

    ssl_certificate /etc/letsencrypt/live/crystalautomation.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crystalautomation.eu/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/html;
    index index.html;

    location /resturant-website/ {
        proxy_pass http://127.0.0.1:3004/resturant-website/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
else
    echo "No SSL certificate found, configuring HTTP only..."
    cat > /etc/nginx/sites-available/${DOMAIN} << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name crystalautomation.eu www.crystalautomation.eu;

    root /var/www/html;
    index index.html;

    location /resturant-website/ {
        proxy_pass http://127.0.0.1:3004/resturant-website/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
fi

# Enable site if not already enabled
if [ ! -L /etc/nginx/sites-enabled/${DOMAIN} ]; then
    ln -s /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
fi

# Test and reload Nginx
echo "Testing Nginx configuration..."
nginx -t

echo "Reloading Nginx..."
systemctl reload nginx

echo ""
echo "Step 8: Starting the application service..."
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}.service
systemctl restart ${SERVICE_NAME}.service

echo ""
echo "Step 9: Checking service status..."
systemctl status ${SERVICE_NAME}.service --no-pager

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "URLs:"
echo "  Menu: http://${DOMAIN}${BASE_PATH}/"
echo "  Admin: http://${DOMAIN}${BASE_PATH}/admin"
echo "  Login: http://${DOMAIN}${BASE_PATH}/login"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "IMPORTANT: Install SSL certificate:"
echo "  apt-get install -y certbot python3-certbot-nginx"
echo "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
echo "Check logs:"
echo "  journalctl -u ${SERVICE_NAME}.service -f"
echo ""
echo "Manage service:"
echo "  systemctl status ${SERVICE_NAME}"
echo "  systemctl restart ${SERVICE_NAME}"
echo "  systemctl stop ${SERVICE_NAME}"
echo "=========================================="
