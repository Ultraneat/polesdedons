import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const heroPanel1 = `
              {/* CONFIGURATION DE L'IMAGE DE COUVERTURE (HERO) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-fade-in" id="hero-settings-panel-overview">
                <div className="space-y-1 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-indigo-500" /> Image de couverture (Vitrine)
                  </h4>
                  <p className="text-slate-500 text-xs">Personnalisez l'image d'arrière-plan de la section héro de la vitrine.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 pt-2">
                  <div className="h-20 w-32 rounded-2xl overflow-hidden shadow-md border border-slate-100 bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <img 
                      src={inputHeroUrl || "/assets/images/hero_background_delivery_1785860075653.jpg"} 
                      alt="Hero Aperçu" 
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=200";
                      }}
                    />
                  </div>

                  <div className="flex-1 w-full space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Téléverser une image ou saisir une URL :</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="https://exemple.com/hero.jpg"
                          value={inputHeroUrl}
                          onChange={(e) => setInputHeroUrl(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById("platform-hero-upload-overview")?.click()}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1"
                        >
                          <Upload className="h-3.5 w-3.5" /> Fichier
                        </button>
                        <input 
                          type="file" 
                          id="platform-hero-upload-overview" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleHeroUpload}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={handleSaveHeroImage}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-colors"
                      >
                        <Save className="h-3.5 w-3.5" /> Enregistrer l'image
                      </button>
                    </div>
                  </div>
                </div>
              </div>
`;

const heroPanel2 = `
              {/* CONFIGURATION DE L'IMAGE DE COUVERTURE (HERO) */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4" id="hero-settings-panel">
                <div className="space-y-1 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Image de couverture (Vitrine)</h4>
                  <p className="text-slate-500 text-xs">Personnalisez l'image d'arrière-plan de la section héro de la vitrine.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 pt-2">
                  <div className="h-20 w-32 rounded-2xl overflow-hidden shadow-md border border-slate-100 bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <img 
                      src={inputHeroUrl || "/assets/images/hero_background_delivery_1785860075653.jpg"} 
                      alt="Hero Aperçu" 
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=200";
                      }}
                    />
                  </div>

                  <div className="flex-1 w-full space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Téléverser une image ou saisir une URL :</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="https://exemple.com/hero.jpg"
                          value={inputHeroUrl}
                          onChange={(e) => setInputHeroUrl(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById("platform-hero-upload")?.click()}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1"
                        >
                          <Upload className="h-3.5 w-3.5" /> Fichier
                        </button>
                        <input 
                          type="file" 
                          id="platform-hero-upload" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleHeroUpload}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={handleSaveHeroImage}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
`;

// Find where to insert heroPanel1
let insertIndex1 = code.indexOf('id="logo-settings-panel-overview"');
if (insertIndex1 !== -1) {
    let endOfDiv1 = code.indexOf('              </div>', insertIndex1);
    // Find the end of this div block (which ends with '              </div>' for the outer container)
    // Actually, it's easier to find the exact text of the button
    let saveBtn1 = code.indexOf('<Save className="h-3.5 w-3.5" /> Enregistrer le logo', insertIndex1);
    let exactEndOfPanel1 = code.indexOf('              </div>', saveBtn1) + 20; // past '</div>'
    code = code.substring(0, exactEndOfPanel1) + '\n' + heroPanel1 + code.substring(exactEndOfPanel1);
}

// Find where to insert heroPanel2
let insertIndex2 = code.indexOf('id="logo-settings-panel"');
if (insertIndex2 !== -1) {
    let saveBtn2 = code.indexOf('Enregistrer\n                      </button>', insertIndex2);
    let exactEndOfPanel2 = code.indexOf('              </div>', saveBtn2) + 20; // past '</div>'
    code = code.substring(0, exactEndOfPanel2) + '\n' + heroPanel2 + code.substring(exactEndOfPanel2);
}

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
