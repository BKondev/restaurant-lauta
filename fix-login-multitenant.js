// Script to fix login endpoint to support multi-tenant authentication
const fs = require('fs');

const serverPath = process.argv[2] || 'server.js';
let content = fs.readFileSync(serverPath, 'utf8');

// Find and replace the login endpoint
const oldLoginEndpoint = `app.post(API_PREFIX + '/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const token = generateToken();
        activeTokens.add(token);

        res.json({
            success: true,
            token: token,
            message: 'Login successful'
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid username or password'
        });
    }
});`;

const newLoginEndpoint = `app.post(API_PREFIX + '/login', (req, res) => {
    const { username, password } = req.body;

    // Check if it's a restaurant login
    const restaurant = getRestaurantByCredentials(username, password);
    
    if (restaurant) {
        const token = generateToken();
        activeTokens.set(token, { restaurantId: restaurant.id });

        res.json({
            success: true,
            token: token,
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            message: 'Login successful'
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid username or password'
        });
    }
});`;

if (content.includes('app.post(API_PREFIX + \'/login\'')) {
    content = content.replace(oldLoginEndpoint, newLoginEndpoint);
    
    // Also need to update activeTokens from Set to Map if it's not already
    if (content.includes('const activeTokens = new Set();')) {
        content = content.replace('const activeTokens = new Set();', 'const activeTokens = new Map();');
    }
    
    // Update requireAuth middleware to use Map
    const oldRequireAuth = `const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authentication token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!activeTokens.has(token)) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    next();
};`;

    const newRequireAuth = `const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authentication token provided' });
    }

    const token = authHeader.split(' ')[1];
    const tokenData = activeTokens.get(token);

    if (!tokenData) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach restaurant ID to request
    req.restaurantId = tokenData.restaurantId;
    next();
};`;

    if (content.includes(oldRequireAuth)) {
        content = content.replace(oldRequireAuth, newRequireAuth);
    }
    
    // Update logout to use Map
    if (content.includes('activeTokens.delete(token);')) {
        // It's already using delete which works for both Set and Map
    }
    
    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('✅ Login endpoint updated successfully');
} else {
    console.log('❌ Could not find login endpoint to update');
}
