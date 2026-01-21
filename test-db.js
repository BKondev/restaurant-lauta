const fs = require('fs');
const db = JSON.parse(fs.readFileSync('/opt/resturant-website/database.json', 'utf8'));
console.log('Has restaurants?', db.restaurants ? 'YES' : 'NO');
if (db.restaurants) {
    console.log('Number of restaurants:', db.restaurants.length);
    console.log('First restaurant:', JSON.stringify(db.restaurants[0], null, 2));
} else {
    console.log('Keys in database:', Object.keys(db));
}
