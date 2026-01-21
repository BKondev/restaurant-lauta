const fs = require('fs');
let content = fs.readFileSync('/opt/resturant-website/public/admin.js', 'utf8');
content = content.replace(/€/g, 'EUR ');
content = content.replace(/\u20AC/g, 'EUR ');
fs.writeFileSync('/opt/resturant-website/public/admin.js', content, 'utf8');
console.log('Replaced euro symbols');
