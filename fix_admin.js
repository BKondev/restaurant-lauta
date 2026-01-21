const fs = require('fs');
let content = fs.readFileSync('admin_from_server.js', 'utf8');
let lines = content.split('\n');
lines[3237] = '                        <td style="padding: 12px; text-align: center;">${parseFloat(city.price).toFixed(2)} EUR</td>';
fs.writeFileSync('admin_fixed_final.js', lines.join('\n'), 'utf8');
console.log('Fixed line 3238 - replaced broken euro symbol with EUR text');
