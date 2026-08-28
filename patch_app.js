import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'const [platformLogo, setPlatformLogo] = useState<string>("/assets/images/logo_donationsphere_1785861089629.jpg");',
  `const [platformLogo, setPlatformLogo] = useState<string>("/assets/images/logo_donationsphere_1785861089629.jpg");
  const [platformHeroImage, setPlatformHeroImage] = useState<string>("/assets/images/hero_background_delivery_1785860075653.jpg");`
);

code = code.replace(
  'const [resFields, resWorkflow, resLogo] = await Promise.all([',
  `const [resFields, resWorkflow, resLogo, resHero] = await Promise.all([`
);

code = code.replace(
  'fetch("/api/settings/platform_logo").catch(() => null)',
  `fetch("/api/settings/platform_logo").catch(() => null),
        fetch("/api/settings/platform_hero_image").catch(() => null)`
);

const logoBlock = `      if (resLogo && resLogo.ok) {
        const data = await resLogo.json();
        if (data) {
          setPlatformLogo(data);
        }
      }`;
code = code.replace(
  logoBlock,
  logoBlock + `\n\n      if (resHero && resHero.ok) {
        const data = await resHero.json();
        if (data) {
          setPlatformHeroImage(data);
        }
      }`
);

const saveLogoBlock = `  const savePlatformLogo = async (logoUrl: string) => {
    const loadingToast = toast.loading("Enregistrement du logo sur le serveur...");
    try {
      const res = await fetch("/api/settings/platform_logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: logoUrl })
      });
      if (!res.ok) {
        throw new Error(\`Erreur HTTP: \${res.status}\`);
      }
      setPlatformLogo(logoUrl);
      toast.dismiss(loadingToast);
      toast.success("Logo sauvegardé avec succès sur le serveur !");
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du logo", e);
      toast.dismiss(loadingToast);
      toast.error("Erreur de connexion au serveur (logo).");
      setPlatformLogo(logoUrl);
    }
  };`;
code = code.replace(
  saveLogoBlock,
  saveLogoBlock + `\n\n  const savePlatformHeroImage = async (imageUrl: string) => {
    const loadingToast = toast.loading("Enregistrement de l'image de couverture...");
    try {
      const res = await fetch("/api/settings/platform_hero_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: imageUrl })
      });
      if (!res.ok) throw new Error(\`Erreur HTTP: \${res.status}\`);
      setPlatformHeroImage(imageUrl);
      toast.dismiss(loadingToast);
      toast.success("Image de couverture sauvegardée !");
    } catch (e) {
      console.error("Erreur", e);
      toast.dismiss(loadingToast);
      toast.error("Erreur de connexion.");
      setPlatformHeroImage(imageUrl);
    }
  };`
);

code = code.replace(
  '<DonationCatalog donations={donations} />',
  '<DonationCatalog donations={donations} platformHeroImage={platformHeroImage} />'
);

code = code.replace(
  'platformLogo={platformLogo}\n              onChangeLogo={savePlatformLogo}',
  `platformLogo={platformLogo}
              onChangeLogo={savePlatformLogo}
              platformHeroImage={platformHeroImage}
              onChangeHeroImage={savePlatformHeroImage}`
);

fs.writeFileSync('src/App.tsx', code);
