import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'const [platformHeroImage, setPlatformHeroImage] = useState<string>("/assets/images/hero_background_delivery_1785860075653.jpg");',
  'const [platformHeroImage, setPlatformHeroImage] = useState<string>("/assets/images/fedex_delivery_car_keys.jpg");'
);

code = code.replace(
  'const [platformHeroImage, setPlatformHeroImage] = useState<string>("/assets/images/hero_background_delivery_1785861692178.jpg");',
  'const [platformHeroImage, setPlatformHeroImage] = useState<string>("/assets/images/fedex_delivery_car_keys.jpg");'
);

fs.writeFileSync('src/App.tsx', code);

// Also change DonationCatalog default if any
let codeCat = fs.readFileSync('src/components/DonationCatalog.tsx', 'utf8');
codeCat = codeCat.replace(
  '/assets/images/hero_background_delivery_1785861692178.jpg',
  '/assets/images/fedex_delivery_car_keys.jpg'
);
fs.writeFileSync('src/components/DonationCatalog.tsx', codeCat);

