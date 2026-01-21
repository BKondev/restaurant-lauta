const fs = require('fs');
const b64 = fs.readFileSync('/tmp/checkout-base64.txt', 'utf8');
const content = Buffer.from(b64, 'base64').toString('utf8');
fs.writeFileSync('/opt/resturant-website/public/checkout.js', content, 'utf8');
console.log('Decoded successfully, size:', content.length);
