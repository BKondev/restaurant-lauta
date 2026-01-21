const fs = require('fs');
const path = require('path');

// Read database
const dbPath = path.join(__dirname, 'database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Add currency settings if not exists
if (!db.currencySettings) {
    db.currencySettings = {
        eurToBgnRate: 1.9558,  // Official fixed rate
        showBgnPrices: true     // Show both currencies by default
    };
    
    console.log('✅ Added currencySettings to database');
} else {
    console.log('⚠️ currencySettings already exists');
}

// Write back to database
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('💾 Database updated!');
