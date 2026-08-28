import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

code = code.replace(
  'platformLogo?: string;\n  onChangeLogo?: (logoUrl: string) => void;\n}',
  `platformLogo?: string;
  onChangeLogo?: (logoUrl: string) => void;
  platformHeroImage?: string;
  onChangeHeroImage?: (imageUrl: string) => void;
}`
);

code = code.replace(
  'platformLogo,\n  onChangeLogo\n}: AdminDashboardProps) {',
  `platformLogo,
  onChangeLogo,
  platformHeroImage,
  onChangeHeroImage
}: AdminDashboardProps) {`
);

code = code.replace(
  'const [inputLogoUrl, setInputLogoUrl] = useState(platformLogo || "");',
  `const [inputLogoUrl, setInputLogoUrl] = useState(platformLogo || "");
  const [inputHeroUrl, setInputHeroUrl] = useState(platformHeroImage || "");`
);

const effBlock = `  useEffect(() => {
    if (platformLogo) {
      setInputLogoUrl(platformLogo);
    }
  }, [platformLogo]);`;

code = code.replace(
  effBlock,
  effBlock + `\n\n  useEffect(() => {
    if (platformHeroImage) {
      setInputHeroUrl(platformHeroImage);
    }
  }, [platformHeroImage]);`
);

const uploadLogoBlock = `  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {`;
code = code.replace(
  uploadLogoBlock,
  `const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("L'image est trop volumineuse (max 5MB).", "error");
      toast.error("L'image est trop volumineuse (max 5MB).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setInputHeroUrl(base64String);
      showToast("Image chargée en prévisualisation.", "success");
    };
    reader.onerror = () => {
      showToast("Erreur lors de la lecture du fichier.", "error");
    };
    reader.readAsDataURL(file);
  };

` + uploadLogoBlock
);

const saveLogoBlock = `  const handleSaveLogo = () => {
    if (!inputLogoUrl.trim()) {
      showToast("Veuillez spécifier une URL ou téléverser un fichier.", "error");
      toast.error("Veuillez spécifier une URL ou téléverser un fichier.");
      return;
    }
    if (onChangeLogo) {
      onChangeLogo(inputLogoUrl);
    }
  };`;

code = code.replace(
  saveLogoBlock,
  saveLogoBlock + `\n\n  const handleSaveHeroImage = () => {
    if (!inputHeroUrl.trim()) {
      showToast("Veuillez spécifier une URL ou téléverser un fichier.", "error");
      toast.error("Veuillez spécifier une URL ou téléverser un fichier.");
      return;
    }
    if (onChangeHeroImage) {
      onChangeHeroImage(inputHeroUrl);
    }
  };`
);


// Replace the Logo component block in Overview tab:
const logoPanelStr = `              {/* CONFIGURATION DE L'IDENTITÉ VISUELLE (LOGO) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-fade-in" id="logo-settings-panel-overview">
                <div className="space-y-1 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-indigo-500" /> Logo de la Plateforme (Identité de l'Application)
                  </h4>
                  <p className="text-slate-500 text-xs">Personnalisez l'identité visuelle de votre application DonationSphere. Ce logo est synchronisé en temps réel avec Supabase et s'affiche dans l'en-tête public et l'interface administrative.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 pt-2">
                  <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-md border border-slate-100 bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <img 
                      src={inputLogoUrl || "/assets/images/logo_donationsphere_1785861089629.jpg"} 
                      alt="Logo Aperçu" 
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
                          placeholder="https://exemple.com/logo.png"
                          value={inputLogoUrl}
                          onChange={(e) => setInputLogoUrl(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById("platform-logo-upload-overview")?.click()}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1"
                        >
                          <Upload className="h-3.5 w-3.5" /> Fichier
                        </button>
                        <input 
                          type="file" 
                          id="platform-logo-upload-overview" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleLogoUpload}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={handleSaveLogo}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-colors"
                      >
                        <Save className="h-3.5 w-3.5" /> Enregistrer le logo
                      </button>
                    </div>
                  </div>
                </div>
              </div>`;

const newHeroPanelStr = `
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

code = code.replace(logoPanelStr, logoPanelStr + newHeroPanelStr);

// Also need to patch the Settings tab duplicate version!
const logoSettingsPanelStr = `              {/* CONFIGURATION DE L'IDENTITÉ VISUELLE (LOGO) */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4" id="logo-settings-panel">
                <div className="space-y-1 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Logo de la Plateforme</h4>
                  <p className="text-slate-500 text-xs">Personnalisez l'identité visuelle de votre application DonationSphere. Ce logo est synchronisé en temps réel avec Supabase et s'affiche dans l'en-tête public et l'interface administrative.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 pt-2">
                  <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-md border border-slate-100 bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <img 
                      src={inputLogoUrl || "/assets/images/logo_donationsphere_1785861089629.jpg"} 
                      alt="Logo Aperçu" 
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
                          placeholder="https://exemple.com/logo.png"
                          value={inputLogoUrl}
                          onChange={(e) => setInputLogoUrl(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById("platform-logo-upload")?.click()}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1"
                        >
                          <Upload className="h-3.5 w-3.5" /> Fichier
                        </button>
                        <input 
                          type="file" 
                          id="platform-logo-upload" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleLogoUpload}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={handleSaveLogo}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              </div>`;

const newHeroSettingsPanelStr = `
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

code = code.replace(logoSettingsPanelStr, logoSettingsPanelStr + newHeroSettingsPanelStr);

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
