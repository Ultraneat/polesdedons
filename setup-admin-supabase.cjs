const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Charger les configurations de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || "https://cypmljaqkvtbmircekvm.supabase.co";
// Utiliser la clé de service de préférence si disponible pour contourner le RLS, sinon la clé anon
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5cG1samFxa3Z0Ym1pcmNla3ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjQ0NTAsImV4cCI6MjEwMTQwMDQ1MH0.razgBfROoDjj1a25QZn3oycDFh8P-FxyDmk4GFoa9d0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("=== SCRIPT DE CONFIGURATION DE L'ADMINISTRATEUR ===");
  console.log(`Connexion à Supabase: ${SUPABASE_URL}`);
  
  const targetEmail = "asthedio@gmail.com";
  
  try {
    console.log(`\nRecherche de l'utilisateur ${targetEmail} dans Supabase Auth...`);
    
    // Note: Pour requêter auth.users via l'API, nous pouvons passer par une requête SQL ou via la table de profiles si synchronisée.
    // Si nous n'avons que la clé ANON, l'accès direct à auth.users est impossible.
    // Nous allons tenter d'insérer directement dans la table profiles publique.
    // Si l'utilisateur est déjà inscrit, son identifiant est stocké en session.
    
    console.log("Tentative de récupération du profil de l'utilisateur...");
    const { data: profiles, error: selectError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", targetEmail);
      
    if (selectError) {
      console.error("Erreur lors de la lecture des profils:", selectError.message);
    }
    
    if (profiles && profiles.length > 0) {
      const profile = profiles[0];
      console.log(`Profil trouvé ! ID: ${profile.id}, Rôle actuel: ${profile.role}`);
      if (profile.role !== "admin") {
        console.log("Mise à jour du rôle en 'admin'...");
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", profile.id);
          
        if (updateError) {
          console.error("Erreur lors de la mise à jour du rôle:", updateError.message);
          console.log("\n💡 SOLUTION RECOMMANDÉE : Copiez-collez le script SQL ci-dessous dans l'éditeur SQL de votre console Supabase :");
          showSqlScript();
        } else {
          console.log("🎉 Rôle mis à jour avec succès en 'admin' !");
        }
      } else {
        console.log("🎉 L'utilisateur a déjà le rôle 'admin' dans la table profiles !");
      }
    } else {
      console.log(`Aucun profil trouvé dans public.profiles pour ${targetEmail}.`);
      console.log("Tentative de synchronisation depuis auth.users...");
      
      console.log("\n💡 INSTRUCTION : Comme la table profiles requiert une clé étrangère vers auth.users(id),");
      console.log("la méthode la plus directe et 100% fiable est d'exécuter cette requête SQL dans votre tableau de bord Supabase.");
      console.log("Cela va lier votre compte d'authentification existant au profil d'administrateur public.");
      showSqlScript();
    }
  } catch (err) {
    console.error("Une erreur inattendue est survenue:", err);
    showSqlScript();
  }
}

function showSqlScript() {
  console.log("\n" + "=".repeat(60));
  console.log("👉 EXÉCUTEZ CE CODE DANS LE 'SQL EDITOR' DE SUPABASE :");
  console.log("=".repeat(60));
  console.log(`
-- 1. Résoudre le bug de récursion infinie sur la table 'profiles'
DROP POLICY IF EXISTS "Les admins peuvent tout voir sur profiles" ON public.profiles;
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leur propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Les utilisateurs peuvent gerer leur propre profil" ON public.profiles;

-- 2. Créer des politiques RLS saines et performantes
CREATE POLICY "Les utilisateurs peuvent gerer leur propre profil" 
ON public.profiles FOR ALL
USING (auth.uid() = id);

CREATE POLICY "Les admins peuvent tout voir sur profiles" 
ON public.profiles FOR ALL 
USING (
    auth.jwt() ->> 'email' IN ('admin@donationsphere.com', 'asthedio@gmail.com')
);

-- 3. Insérer ou mettre à jour le profil admin de asthedio@gmail.com
INSERT INTO public.profiles (id, email, name, role)
SELECT id, email, 'Admin Principal', 'admin'
FROM auth.users
WHERE email = 'asthedio@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', name = 'Admin Principal';

-- 4. Vérifier la réussite
SELECT * FROM public.profiles WHERE email = 'asthedio@gmail.com';
  `);
  console.log("=".repeat(60) + "\n");
}

run();
