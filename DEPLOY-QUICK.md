# Quick Deployment Commands for crystalautomation.eu/resturant-website

## Option 1: Automated PowerShell Script (Easiest)

```powershell
# Run from your local machine (PowerShell)
cd C:\Users\User\Desktop\resturant-template
.\deploy-to-server.ps1
```

This will:
- Upload all files to the server
- Install dependencies
- Configure Nginx
- Create systemd service
- Start the application

---

## Option 2: Manual Commands

### From Local Machine (PowerShell):

```powershell
# Upload files
scp -r C:\Users\User\Desktop\resturant-template root@46.62.174.218:/tmp/restaurant-upload
```

### On Server (SSH):

```bash
# Connect
ssh root@46.62.174.218

# Move files
mkdir -p /opt/resturant-website
cp -r /tmp/restaurant-upload/* /opt/resturant-website/
cd /opt/resturant-website

# Run deployment script
chmod +x deploy.sh
./deploy.sh

# Install SSL (after deployment)
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d crystalautomation.eu -d www.crystalautomation.eu
```

---

## URLs After Deployment

- **Menu:** https://www.crystalautomation.eu/resturant-website/
- **Admin:** https://www.crystalautomation.eu/resturant-website/admin
- **Login:** https://www.crystalautomation.eu/resturant-website/login

**Default Login:**
- Username: `admin`
- Password: `admin123`

---

## Useful Server Commands

```bash
# Check service status
systemctl status restaurant.service

# View live logs
journalctl -u restaurant.service -f

# Restart service
systemctl restart restaurant.service

# Stop service
systemctl stop restaurant.service

# Start service
systemctl start restaurant.service

# Check if port 3000 is listening
netstat -tlnp | grep 3000

# Test locally on server
curl http://localhost:3000/resturant-website/

# Backup database
cp /opt/resturant-website/database.json /opt/resturant-website/database.json.backup

# View Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

---

## Update Application (After Initial Deployment)

```powershell
# From local machine
scp -r C:\Users\User\Desktop\resturant-template\public root@46.62.174.218:/opt/resturant-website/
scp C:\Users\User\Desktop\resturant-template\server.js root@46.62.174.218:/opt/resturant-website/
```

```bash
# On server
ssh root@46.62.174.218
systemctl restart restaurant.service
```

---

## Troubleshooting

### Service won't start
```bash
journalctl -u restaurant.service -n 50 --no-pager
```

### Port already in use
```bash
lsof -i :3000
kill -9 <PID>
```

### Permission denied
```bash
chown -R www-data:www-data /opt/resturant-website
chmod -R 755 /opt/resturant-website
```

### Nginx error
```bash
nginx -t
systemctl restart nginx
```

---

## Security Notes

1. **Change admin password immediately** after first login
2. **Firewall setup:**
   ```bash
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```
3. **Keep system updated:**
   ```bash
   apt-get update && apt-get upgrade -y
   ```

---

## На български (Bulgarian)

### Бърза инсталация:
```powershell
# От твоя компютър
cd C:\Users\User\Desktop\resturant-template
.\deploy-to-server.ps1
```

### Ръчна инсталация:
```bash
# Качи файловете
scp -r C:\Users\User\Desktop\resturant-template root@46.62.174.218:/opt/resturant-website

# Влез в сървъра
ssh root@46.62.174.218

# Стартирай deployment
cd /opt/resturant-website
chmod +x deploy.sh
./deploy.sh

# Инсталирай SSL
certbot --nginx -d crystalautomation.eu -d www.crystalautomation.eu
```

### Полезни команди:
```bash
systemctl status restaurant.service    # Статус
journalctl -u restaurant.service -f    # Логове
systemctl restart restaurant.service   # Рестарт
```

---

**Ready to deploy? Run: `.\deploy-to-server.ps1`**
