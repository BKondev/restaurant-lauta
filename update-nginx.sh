#!/bin/bash
# Update Nginx configuration to add restaurant website location

CONFIG_FILE="/etc/nginx/sites-available/финанси"
BACKUP_FILE="${CONFIG_FILE}.backup"

# Backup
cp "$CONFIG_FILE" "$BACKUP_FILE"

# Create temporary file with the restaurant location block
cat > /tmp/restaurant_location.conf << 'ENDBLOCK'
    # Restaurant menu application
    location /resturant-website/ {
        proxy_pass http://127.0.0.1:3000/resturant-website/;
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

ENDBLOCK

# Insert before the first API proxy section
awk '
/# API proxy за финансовото приложение/ {
    while ((getline line < "/tmp/restaurant_location.conf") > 0) {
        print line
    }
    close("/tmp/restaurant_location.conf")
}
{print}
' "$CONFIG_FILE" > /tmp/nginx_new.conf

# Replace the config file
mv /tmp/nginx_new.conf "$CONFIG_FILE"

# Test configuration
nginx -t

if [ $? -eq 0 ]; then
    echo "Nginx configuration is valid. Reloading..."
    systemctl reload nginx
    echo "Done! Restaurant website should now be accessible."
else
    echo "Error in Nginx configuration. Restoring backup..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi
