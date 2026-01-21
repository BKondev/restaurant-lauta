const fs = require('fs');
const path = require('path');

// Read database
const dbPath = path.join(__dirname, 'database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Weight mapping by category
const weightMappings = {
    'Salads': '350g',
    'Салати': '350g',
    'Soups': '400ml',
    'Супи': '400ml',
    'Pasta': '400g',
    'Паста': '400g',
    'Burgers': '350g',
    'БургерИ': '350g',
    'BBQ': '450g',
    'Барбекю': '450g',
    'Desserts': '200g',
    'Десерти': '200g',
    'Hot Drinks': '250ml',
    'Топли Напитки': '250ml',
    'White Wine': '150ml',
    'Бяло Вино': '150ml',
    'Red Wine': '150ml',
    'Червено Вино': '150ml',
    'Beer': '500ml',
    'Бира': '500ml',
    'Soft Drinks': '330ml',
    'Безалкохолни Напитки': '330ml',
    'Combos & Bundles': 'Combo'
};

// Add weight to all products
db.products.forEach(product => {
    // Skip if already has weight
    if (!product.weight || product.weight === '') {
        const weight = weightMappings[product.category] || '1 pc';
        product.weight = weight;
        console.log(`Added weight "${weight}" to "${product.name}"`);
    } else {
        console.log(`Skipped "${product.name}" - already has weight: ${product.weight}`);
    }
});

// Write back to database
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('\n✅ All products updated with weights!');
console.log(`📊 Total products: ${db.products.length}`);
