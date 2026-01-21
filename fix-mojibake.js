const fs = require('fs');

// Read the broken file
let content = fs.readFileSync('/opt/resturant-website/public/checkout.js', 'latin1');

// Convert from latin1 (which is how UTF-8 bytes were misread) back to UTF-8
const buffer = Buffer.from(content, 'latin1');
content = buffer.toString('utf8');

// Write back as proper UTF-8
fs.writeFileSync('/opt/resturant-website/public/checkout.js', content, 'utf8');

console.log('Fixed mojibake! File size:', content.length);
