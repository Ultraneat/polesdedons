import fs from 'fs';
let code = fs.readFileSync('src/components/DonationCatalog.tsx', 'utf8');

code = code.replace(
  '  partners = [],\n  applications = []\n}: DonationCatalogProps) {',
  `  partners = [],\n  applications = [],\n  platformHeroImage\n}: DonationCatalogProps) {`
);

fs.writeFileSync('src/components/DonationCatalog.tsx', code);
