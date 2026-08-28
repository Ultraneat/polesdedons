import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'applications={applications}\n            />',
  'applications={applications}\n              platformHeroImage={platformHeroImage}\n            />'
);

fs.writeFileSync('src/App.tsx', code);
