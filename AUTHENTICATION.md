# 🔐 Authentication Setup Complete!

## ✅ What Changed?

Your restaurant website now has **secure admin authentication**!

### 🔒 Security Features Added:

1. **Hidden Admin Access**
   - Admin button removed from customer view
   - Access only via direct URL

2. **Login System**
   - Username and password required
   - Session-based authentication
   - Auto-logout when session ends

3. **Protected Routes**
   - All admin API endpoints are protected
   - Customers can view menu (no login needed)
   - Only admins can add/edit/delete products

## 🚪 How to Access Admin Panel

### Step 1: Go to Login Page
**URL:** http://localhost:3000/login.html

### Step 2: Enter Credentials
```
Username: admin
Password: admin123
```

### Step 3: Manage Your Menu
After login, you'll be redirected to the admin panel automatically.

## 🔑 Default Login Credentials

**Username:** `admin`  
**Password:** `admin123`

⚠️ **IMPORTANT:** Change these in production!

## 📝 How It Works

### For Customers:
1. Visit: http://localhost:3000
2. Browse menu freely
3. No login required
4. Can't see admin button

### For Admins:
1. Visit: http://localhost:3000/login.html
2. Enter username and password
3. Get redirected to admin panel
4. Manage products, upload images, etc.
5. Click "Logout" when done

## 🛡️ Security Features

✅ **Session-based auth** - Token stored in browser session  
✅ **Auto-redirect** - Unauthorized users sent to login  
✅ **Protected API** - All admin endpoints require authentication  
✅ **Logout function** - Clear session and redirect to login  
✅ **Hidden access** - No visible admin link for customers  

## 🔧 How to Change Password

Edit `server.js` and change these lines:

```javascript
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'YOUR_NEW_PASSWORD' // Change this!
};
```

Then restart the server:
```bash
# Stop server (Ctrl+C in terminal)
# Start again:
npm start
```

## 🌐 Important URLs

- **Customer Menu**: http://localhost:3000
- **Admin Login**: http://localhost:3000/login.html
- **Admin Panel**: http://localhost:3000/admin.html (requires login)

## 📱 Access Methods

### Customer Access (No Login):
```
http://localhost:3000
http://localhost:3000/index.html
```

### Admin Access (Requires Login):
```
1. Go to: http://localhost:3000/login.html
2. Login with credentials
3. Auto-redirect to admin panel
```

## ⚠️ Important Security Notes

### For Development (Current Setup):
- ✅ Good for testing
- ✅ Simple username/password
- ⚠️ Passwords in plain text
- ⚠️ Tokens stored in memory

### For Production (Recommended):
- 🔐 Use environment variables for credentials
- 🔐 Hash passwords with bcrypt
- 🔐 Use JWT tokens
- 🔐 Use HTTPS
- 🔐 Add rate limiting
- 🔐 Add CSRF protection
- 🔐 Use secure session storage (Redis)

## 🎯 Testing the Authentication

### Test 1: Customer Access
1. Open http://localhost:3000
2. ✅ Should see menu without login
3. ✅ Should NOT see admin button
4. ✅ Can browse and search products

### Test 2: Admin Access (Without Login)
1. Try to open http://localhost:3000/admin.html directly
2. ✅ Should redirect to login page

### Test 3: Admin Access (With Login)
1. Go to http://localhost:3000/login.html
2. Enter: admin / admin123
3. ✅ Should redirect to admin panel
4. ✅ Can add/edit/delete products

### Test 4: Logout
1. In admin panel, click "Logout"
2. ✅ Should redirect to login page
3. ✅ Can't access admin without logging in again

## 🚀 Quick Commands

```bash
# Start server
npm start

# Access login page
http://localhost:3000/login.html

# Default credentials
Username: admin
Password: admin123
```

## 🆘 Troubleshooting

**Can't access admin panel?**
→ Make sure you're logged in via login.html first

**Forgot password?**
→ Check server.js for current credentials (default: admin/admin123)

**Getting "Unauthorized" errors?**
→ Your session expired, login again

**Login page not loading?**
→ Make sure server is running (npm start)

## 📚 Files Modified

- ✅ `public/index.html` - Removed admin button
- ✅ `public/login.html` - NEW: Login page
- ✅ `public/admin.html` - Added logout button
- ✅ `public/admin.js` - Added auth checks and token handling
- ✅ `server.js` - Added login/logout endpoints and auth middleware

---

## 🎉 Summary

Your admin panel is now **secure and hidden**!

**Customers:** See menu without any login
**Admins:** Must login at `/login.html` to manage products

**Default Login:**
- URL: http://localhost:3000/login.html
- Username: `admin`
- Password: `admin123`

**Remember to change the password in production!** 🔒
