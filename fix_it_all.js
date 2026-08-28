import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const misplacedSidebarStart = `              {/* CONFIGURATION DE L'IMAGE DE COUVERTURE (HERO) */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4" id="hero-settings-panel">`;
              
const misplacedOverviewStart = `              {/* CONFIGURATION DE L'IMAGE DE COUVERTURE (HERO) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-fade-in" id="hero-settings-panel-overview">`;

function removeBlock(startString) {
    let index = code.indexOf(startString);
    if (index !== -1) {
        let btnIndex = code.indexOf('Enregistrer', index);
        let exactEnd = code.indexOf('              </div>', btnIndex) + 20;
        code = code.substring(0, index) + code.substring(exactEnd);
    }
}

for(let i=0; i<3; i++) removeBlock(misplacedSidebarStart);
for(let i=0; i<3; i++) removeBlock(misplacedOverviewStart);

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
