import fs from 'fs';

let c = fs.readFileSync('scripts/seed-dintrants.mjs', 'utf8');

c = c.replace(/quantite: \d+/g, 'quantite: 2');

fs.writeFileSync('scripts/seed-dintrants.mjs', c);
console.log('Done capping quantite');
