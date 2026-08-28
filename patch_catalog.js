import fs from 'fs';
let code = fs.readFileSync('src/components/DonationCatalog.tsx', 'utf8');

code = code.replace(
  'partners?: any[];\n  applications?: any[];\n}',
  `partners?: any[];
  applications?: any[];
  platformHeroImage?: string;
}`
);

code = code.replace(
  'currentUser,\n  adminDefinedFields = [],\n  partners = [],\n  applications = []\n}: DonationCatalogProps) {',
  `currentUser,
  adminDefinedFields = [],
  partners = [],
  applications = [],
  platformHeroImage
}: DonationCatalogProps) {`
);

code = code.replace(
  'src="/assets/images/hero_background_delivery_1785860075653.jpg"',
  `src={platformHeroImage || "/assets/images/hero_background_delivery_1785860075653.jpg"}`
);

fs.writeFileSync('src/components/DonationCatalog.tsx', code);
