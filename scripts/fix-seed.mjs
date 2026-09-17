import fs from 'fs';

let c = fs.readFileSync('scripts/seed-dintrants.mjs', 'utf8');

// Fix treasury balance
c = c.replace(/solde_initial: 150000/g, 'solde_initial: 5000000');

// Fix categories in loop
c = c.replace(/for \(const cat of \['plomberie', 'construction', 'metallurgie', 'electricite'\]\)/g, "for (const cat of ['semences', 'engrais', 'phytosanitaires', 'materiels'])");

// Fix modes in achatsMagasin
c = c.replace(/plomberie: 'comptant', construction: 'credit', metallurgie: 'mixte', electricite: 'comptant'/g, "semences: 'comptant', engrais: 'credit', phytosanitaires: 'mixte', materiels: 'comptant'");
c = c.replace(/plomberie: 'mixte', construction: 'credit', metallurgie: 'comptant', electricite: 'comptant'/g, "semences: 'mixte', engrais: 'credit', phytosanitaires: 'comptant', materiels: 'comptant'");

// Map old product IDs to new ones that actually exist in ARTICLES
c = c.replace(/PLB-001/g, 'SEM-001');
c = c.replace(/PLB-002/g, 'SEM-002');
c = c.replace(/PLB-003/g, 'SEM-002');
c = c.replace(/PLB-005/g, 'SEM-001');
c = c.replace(/PLB-006/g, 'SEM-002');
c = c.replace(/PLB-007/g, 'SEM-001');

c = c.replace(/CST-001/g, 'ENG-001');
c = c.replace(/CST-002/g, 'ENG-002');
c = c.replace(/CST-003/g, 'ENG-003');
c = c.replace(/CST-004/g, 'ENG-001');
c = c.replace(/CST-006/g, 'ENG-002');
c = c.replace(/CST-007/g, 'ENG-003');

c = c.replace(/ELE-001/g, 'MAT-001');
c = c.replace(/ELE-002/g, 'MAT-002');
c = c.replace(/ELE-003/g, 'MAT-003');
c = c.replace(/ELE-004/g, 'MAT-004');
c = c.replace(/ELE-005/g, 'MAT-005');

c = c.replace(/MET-001/g, 'PHY-001');
c = c.replace(/MET-002/g, 'PHY-002');
c = c.replace(/MET-003/g, 'PHY-003');
c = c.replace(/MET-004/g, 'PHY-001');

fs.writeFileSync('scripts/seed-dintrants.mjs', c);
console.log('Done fixing seed script');
