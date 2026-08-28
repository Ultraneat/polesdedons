import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const savePlatformLogo = async (logoUrl: string) => {`;
const insert = `  const savePlatformHeroImage = async (imageUrl: string) => {
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
  };

`;

code = code.replace(target, insert + target);
fs.writeFileSync('src/App.tsx', code);
