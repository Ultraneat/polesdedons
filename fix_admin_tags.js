import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// I will just use regex or find and replace carefully.
// The panel ends with:
/*
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleSaveLogo}
                        className="..."
                      >
                        <Save className="h-3.5 w-3.5" />
                        Enregistrer le Logo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
*/

// Let's replace the inner structure
function removeAndReinsert() {
    let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

    // Remove the two hero panels we just added (they might be malformed in location)
    let idx = code.indexOf("{/* CONFIGURATION DE L'IMAGE DE COUVERTURE (HERO) */}");
    while (idx !== -1) {
        let endIdx = code.indexOf('Enregistrer l\'image', idx);
        let realEndIdx = code.indexOf('              </div>\n', endIdx) + 21;
        code = code.substring(0, idx) + code.substring(realEndIdx);
        idx = code.indexOf("{/* CONFIGURATION DE L'IMAGE DE COUVERTURE (HERO) */}");
    }

    fs.writeFileSync('src/components/AdminDashboard.tsx', code);
}
removeAndReinsert();

