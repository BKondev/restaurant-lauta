const fs = require('fs');
const {execSync} = require('child_process');

// Download the working database.json from server
console.log('Downloading database.json...');
execSync('scp root@46.62.174.218:/opt/resturant-website/data/db.json c:/temp-db.json');

// Read it
const db = JSON.parse(fs.readFileSync('c:/temp-db.json', 'utf8'));

console.log('Found products with Bulgarian names:', db.products.filter(p => p.translations).length);

// Now read the broken checkout.js
let checkout = fs.readFileSync('c:/Users/User/Desktop/resturant-template/public/checkout.js', 'utf8');

// Replace all mojibake with correct Bulgarian
const replacements = [
    ['РџРѕСЂСЉС‡РєР°', 'Поръчка'],
    ['РќР°Р·Р°Рґ РєСЉРј РњРµРЅСЋС‚Рѕ', 'Назад към Менюто'],
    ['РђСЂС‚РёРєСѓР»Рё РІ РљРѕР»РёС‡РєР°С‚Р°', 'Артикули в Количката'],
    ['РњРµС‚РѕРґ Р·Р° РґРѕСЃС‚Р°РІРєР°', 'Метод за доставка'],
    ['Р"РѕСЃС‚Р°РІРєР°', 'Доставка'],
    ['Р"РёСЂРµРєС‚РЅРѕ РґРѕ РІР°СЃ', 'Директно до вас'],
    ['Р'Р·РµРјРё', 'Вземи'],
    ['РћС‚ СЂРµСЃС‚РѕСЂР°РЅС‚Р°', 'От ресторанта'],
    ['РњРµР¶РґРёРЅРЅР° РЎСѓРјР°', 'Междинна Сума'],
    ['РћР±С‰Рѕ', 'Общо'],
    ['РџСЂРёР»РѕР¶Рё', 'Приложи'],
    ['РџСЂРѕРјРѕ РєРѕРґ', 'Промо код'],
    ['Р'СЉРІРµРґРё РїСЂРѕРјРѕ РєРѕРґ', 'Въведи промо код']
];

replacements.forEach(([bad, good]) => {
    checkout = checkout.split(bad).join(good);
    console.log(`Replaced: ${bad.substring(0,20)}... -> ${good}`);
});

// Write fixed file
fs.writeFileSync('c:/Users/User/Desktop/resturant-template/public/checkout-FIXED.js', checkout, 'utf8');
console.log('Created checkout-FIXED.js');

// Cleanup
fs.unlinkSync('c:/temp-db.json');
