# 🍽️ Restaurant Template - Setup Complete!

## ✅ Your Server is Running!

The Node.js backend server is now running and ready to use.

### 🌐 Access Your Website:
- **Main Menu**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin.html

### 🎯 What Changed?

**BEFORE** (localStorage version):
- ❌ Data only saved in your browser
- ❌ Customers couldn't see your menu
- ❌ Each device had different data

**NOW** (Node.js version):
- ✅ Data stored on server in `database.json`
- ✅ Everyone sees the same menu
- ✅ Real image upload to server
- ✅ Works across all devices on network
- ✅ Professional backend API

### 📝 How to Use:

1. **Keep Server Running**
   - The terminal window must stay open
   - Server runs on: http://localhost:3000
   - Press `Ctrl+C` to stop the server

2. **Manage Products**
   - Go to: http://localhost:3000/admin.html
   - Add/edit/delete products
   - Upload images (max 5MB)
   - Changes appear instantly for all users

3. **View Menu**
   - Go to: http://localhost:3000
   - Browse categories
   - Search products
   - Click items for details

### 🚀 Commands:

```bash
# Start server
npm start

# Install dependencies (if needed)
npm install

# Stop server
Ctrl + C (in terminal)
```

### 📦 Data Files:

- `database.json` - Your restaurant data (products, name)
- `uploads/` - Uploaded images folder

### 🌍 Share with Others:

**On Same Network:**
1. Find your computer's IP address:
   ```bash
   ipconfig
   ```
2. Look for "IPv4 Address" (e.g., 192.168.1.100)
3. Share: `http://YOUR_IP:3000`

**On Internet:**
- Deploy to: Heroku, Render, Railway, DigitalOcean, AWS, etc.
- See README.md for deployment instructions

### ⚠️ Important Notes:

1. **Server Must Be Running**
   - Website won't work if server is stopped
   - Keep terminal window open

2. **Backup Your Data**
   - Use "Export Data" button in admin panel
   - Or copy `database.json` file

3. **Images**
   - Stored in `uploads/` folder
   - Max 5MB per image
   - Formats: JPG, PNG, GIF, WEBP

### 🎉 You're All Set!

Your restaurant template now has a professional backend that allows customers to see your menu in real-time!

### 📞 Need Help?

Check the README.md file for more information about:
- API endpoints
- Deployment options
- Customization
- Troubleshooting

---

**Server Status:** ✅ Running on http://localhost:3000
