// =====================================================================
// SCRIPT DE VÉRIFICATION DES POLITIQUES DE SÉCURITÉ (RLS) - SUPABASE
// Exécution : node verify-policies.js
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Charger les variables d'environnement
const SUPABASE_URL = process.env.SUPABASE_URL || "https://cypmljaqkvtbmircekvm.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!SUPABASE_KEY) {
  console.error("❌ Erreur : Clé API Supabase introuvable dans le fichier .env (SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tables = [
  "profiles",
  "donations",
  "applications",
  "application_submissions",
  "application_messages",
  "app_settings",
  "testimonials"
];

console.log("=====================================================================");
console.log("🛡️   AUDIT DES TABLES ET POLITIQUES DE SÉCURITÉ SUPABASE");
console.log(`🔗  URL Supabase : ${SUPABASE_URL}`);
console.log(`🔑  Type de clé utilisée : ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "Service Role Key (Bypass RLS)" : "Anon Key (Soumise au RLS)"}`);
console.log("=====================================================================\n");

async function runAudit() {
  console.log("🔍 Étape 1 : Vérification de l'accessibilité programmatique des tables...");
  
  for (const table of tables) {
    try {
      const { data, error, status } = await supabase.from(table).select("*").limit(1);
      
      if (error) {
        console.log(`❌ Table [${table}] - Non accessible ou erreur : ${error.message} (Status: ${status})`);
      } else {
        console.log(`✅ Table [${table}] - Accessible avec succès (Nombre d'enregistrements testés : ${data ? data.length : 0})`);
      }
    } catch (err) {
      console.log(`❌ Table [${table}] - Exception :`, err.message || err);
    }
  }

  console.log("\n💡 Étape 2 : Rappel des politiques de sécurité optimales (RLS)");
  console.log("Dans l'architecture hybride actuelle de l'application, l'API serveur sert de passerelle.");
  console.log("Pour garantir la synchronisation bidirectionnelle, le serveur accède aux tables.");
  console.log("Si vous souhaitez activer un RLS strict et que tout passe directement par l'API cliente de Supabase :");
  console.log("Exécutez les requêtes SQL de vérification et d'activation ci-dessous dans votre SQL Editor Supabase.\n");

  console.log("📋 SCRIPT SQL DE DIAGNOSTIC DES POLITIQUES ACTIVES À COPIER DANS SUPABASE :");
  console.log(`---------------------------------------------------------------------
-- AFFICHER TOUTES LES POLITIQUES ACTIVES SUR VOTRE BASE SUPABASE
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE schemaname = 'public';
---------------------------------------------------------------------`);

  console.log("\n🛡️ SCRIPT SQL DE RE-SÉCURISATION COMPLÈTE (SI VOUS DÉPLOYEZ EN PRODUCTION STRICTE) :");
  console.log(`---------------------------------------------------------------------
-- 1. Réactivation de RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- 2. Politiques pour la table 'profiles'
CREATE POLICY "Lecture publique des profils" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Les utilisateurs modifient leur propre profil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Politiques pour la table 'donations'
CREATE POLICY "Lecture publique des dons" ON public.donations FOR SELECT USING (true);
CREATE POLICY "Seuls les admins gèrent les dons" ON public.donations FOR ALL USING (
    auth.jwt() ->> 'email' IN ('admin@donationsphere.com', 'asthedio@gmail.com')
);

-- 4. Politiques pour la table 'applications'
CREATE POLICY "Les candidats voient leurs propres dossiers" ON public.applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Les candidats créent leurs dossiers" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Les admins gèrent toutes les candidatures" ON public.applications FOR ALL USING (
    auth.jwt() ->> 'email' IN ('admin@donationsphere.com', 'asthedio@gmail.com')
);
---------------------------------------------------------------------`);

  console.log("\n🎉 Audit de configuration terminé.");
}

runAudit();
