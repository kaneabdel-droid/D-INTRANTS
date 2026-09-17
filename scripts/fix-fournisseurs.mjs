import fs from 'fs';

let c = fs.readFileSync('scripts/seed-dintrants.mjs', 'utf8');

c = c.replace(/'plomberie', 'Sénégal Plomberie Distribution'/g, "'semences', 'Sénégal Semences Distribution'");
c = c.replace(/'construction', 'Matériaux BTP Sahel'/g, "'engrais', 'Engrais Sahel'");
c = c.replace(/'metallurgie', "Boutique d'intrants Générale de Dakar"/g, "'phytosanitaires', 'Phyto Dakar'");
c = c.replace(/'electricite', 'Diallo Matériel Électrique'/g, "'materiels', 'Diallo Matériels'");

fs.writeFileSync('scripts/seed-dintrants.mjs', c);
console.log('Done fixing fournisseurs');
