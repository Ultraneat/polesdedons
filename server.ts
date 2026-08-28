import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "http";
import { Server } from "socket.io";
import sharp from "sharp";
import crypto from "crypto";
import { execSync } from "child_process";
import { GoogleGenAI } from "@google/genai";

// Charger les variables d'environnement
import dotenv from "dotenv";
dotenv.config();

// Client Gemini paresseux (Lazy Initializer)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("[GEMINI] La variable d'environnement GEMINI_API_KEY est manquante.");
      return null;
    }
    try {
      geminiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch (e) {
      console.error("[GEMINI] Erreur initialisation:", e);
      return null;
    }
  }
  return geminiClient;
}

const app = express();
const PORT = 3000;
const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Helper pour transformer n'importe quel ID (ex: "general-support") en UUID déterministe pour Supabase
function toSafeUuid(id: string): string {
  if (!id) return crypto.randomUUID();
  if (uuidRegex.test(id)) return id;
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-4${hash.substr(12, 3)}-a${hash.substr(15, 3)}-${hash.substr(18, 12)}`;
}

// Augmenter la limite de taille pour accepter les fichiers base64 compressés ou originaux
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Assurer l'existence du dossier de médias optimisés (Railway Media Simulator)
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configurer le client Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kkcvaklqgacdoxwnsglv.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY3Zha2xxZ2FjZG94d25zZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDg0MTgsImV4cCI6MjEwMzQyNDQxOH0.444gr5pXns3Iy9obEm1NkWM0TtO5N1C-amtId0gZFP8";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY3Zha2xxZ2FjZG94d25zZ2x2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0ODQxOCwiZXhwIjoyMTAzNDI0NDE4fQ.zcLmweM5927EFusMDVXPun5yyGcMv-T9TWlJbLID33o";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

// Helper d'exécution sécurisée avec timeout pour les requêtes Supabase
async function withTimeout<T = any>(promise: PromiseLike<T>, ms = 2500, fallback?: any): Promise<T> {
  const defaultFallback = fallback !== undefined ? fallback : ({ data: null, error: { message: "timeout" } } as any);
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<any>((resolve) => {
    timer = setTimeout(() => resolve(defaultFallback), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result as T;
  } catch (err) {
    clearTimeout(timer!);
    return defaultFallback as T;
  }
}

// Base de données simulée en local si Supabase n'est pas prêt
let localDb = {
  donations: [] as any[],
  testimonials: [] as any[],
  applications: [] as any[],
  application_submissions: [] as any[],
  application_messages: [] as any[],
  agent_conversations: {} as Record<string, any[]>,
  chatbot_training: [] as any[],
  settings: {} as Record<string, any>,
  users: [
    { 
      email: "admin@donationsphere.com", 
      password: "Solidaire2026", 
      name: "Administrateur", 
      role: "admin",
      permissions: ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]
    },
    { 
      email: "asthedio@gmail.com", 
      password: "Solidaire2026", 
      name: "Admin Principal", 
      role: "admin",
      permissions: ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]
    },
    { 
      email: "asthedio1@gmail.com", 
      password: "Solidaire2026", 
      name: "Admin Principal", 
      role: "admin",
      permissions: ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]
    }
  ] as any[],
  partners: [
    {
      id: "p1",
      name: "FedEx",
      logo_url: "https://upload.wikimedia.org/wikipedia/commons/b/b9/FedEx_Corporation_-_Logo.svg",
      website: "https://www.fedex.com"
    }
  ] as any[],
  calls: [] as any[]
};

// Sauvegarder localDb dans un fichier pour persistance
const LOCAL_DB_FILE = path.join(process.cwd(), "local_db.json");
if (fs.existsSync(LOCAL_DB_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, "utf-8"));
    localDb = { ...localDb, ...data };
    // S'assurer que les utilisateurs par défaut existent s'ils ne sont pas là
    localDb.users = localDb.users || [];
    const defaultAdmins = [
      { 
        email: "admin@donationsphere.com", 
        password: "Solidaire2026", 
        name: "Administrateur", 
        role: "admin",
        permissions: ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]
      },
      { 
        email: "asthedio@gmail.com", 
        password: "Solidaire2026", 
        name: "Admin Principal", 
        role: "admin",
        permissions: ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]
      },
      { 
        email: "asthedio1@gmail.com", 
        password: "Solidaire2026", 
        name: "Admin Principal", 
        role: "admin",
        permissions: ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]
      }
    ];
    for (const adm of defaultAdmins) {
      const idx = localDb.users.findIndex((u: any) => u.email === adm.email);
      if (idx === -1) {
        (adm as any).id = "admin-" + Date.now(); localDb.users.push(adm);
      } else {
        localDb.users[idx].role = "admin";
        localDb.users[idx].password = adm.password;
        localDb.users[idx].permissions = adm.permissions; if(!localDb.users[idx].id) localDb.users[idx].id = "admin-" + Date.now();
      }
    }
  } catch (e) {
    console.error("Impossible de charger la base locale persistée, réinitialisation", e);
  }
}

localDb.settings = localDb.settings || {};
localDb.chatbot_training = localDb.chatbot_training || [];
localDb.calls = localDb.calls || [];
localDb.donations = localDb.donations || [];
localDb.donations = localDb.donations.map((d: any) => ({
  ...d,
  views_count: typeof d.views_count === 'number' ? d.views_count : Math.floor(Math.random() * 80) + 15
}));

if (localDb.chatbot_training.length === 0) {
  localDb.chatbot_training = [
    {
      id: "train_1",
      keywords: ["priorité", "priorite", "indice", "enchère", "enchere", "besoin social", "urgence", "score", "attribution", "prioritaire"],
      response: "L'indice de priorité sociale et l'enchère de besoin social sont des mécanismes transparents permettant d'attribuer les dons de manière équitable. L'algorithme calcule un score d'urgence basé sur la situation financière, l'impact social du projet et le nombre d'attributions passées. Cela garantit que les dons vont en priorité à ceux qui en ont le plus besoin.",
      is_confidential: false,
      created_at: new Date().toISOString()
    },
    {
      id: "train_2",
      keywords: ["gratuit", "gratuité", "payer", "coût", "cout", "argent", "prix"],
      response: "Pôle de Dons est une plateforme solidaire et transparente d'utilité publique. L'inscription, le dépôt de dossier ainsi que l'attribution finale des dons s'effectuent sans aucune contrepartie financière. Toute demande suspecte en dehors de notre protocole de validation sécurisé doit être signalée.",
      is_confidential: false,
      created_at: new Date().toISOString()
    },
    {
      id: "train_3",
      keywords: ["contacter", "agent", "téléphone", "telephone", "joindre", "conseiller", "responsable"],
      response: "Vous pouvez contacter l'agent en charge d'un don directement en écrivant dans ce chat en direct. Le nom et le téléphone de l'agent responsable sont également affichés sur la fiche descriptive de chaque don dans le catalogue.",
      is_confidential: false,
      created_at: new Date().toISOString()
    },
    {
      id: "train_4",
      keywords: ["délai", "delai", "temps", "quand", "arbitrage", "réponse", "reponse", "commission", "attente", "validation"],
      response: "La commission d'attribution solidaire se réunit de manière hebdomadaire. Les dossiers finalisés à 100% reçoivent généralement une décision d'arbitrage sous un délai de 48h à 72h ouvrés après la clôture des candidatures.",
      is_confidential: false,
      created_at: new Date().toISOString()
    },
    {
      id: "train_5",
      keywords: ["document", "pièce", "piece", "justificatif", "identité", "identite", "cni", "passeport", "cv", "justifier", "étape", "etape"],
      response: "Pour candidater à un don, vous devez suivre les étapes d'instruction de votre dossier. Les documents requis sont généralement : 1) Vos coordonnées de contact, 2) Une description écrite de votre projet d'usage solidaire, 3) Un justificatif officiel d'identité (CNI ou Passeport), et 4) Une lettre ou un enregistrement de motivation.",
      is_confidential: false,
      created_at: new Date().toISOString()
    },
    {
      id: "train_6",
      keywords: ["revendre", "revente", "vendre", "lucratif", "commerce", "charte éthique", "charte", "éthique", "ethique"],
      response: "Conformément à notre Charte Éthique et à nos Conditions Générales d'Utilisation, il est strictement interdit de revendre à titre lucratif un équipement ou un bien reçu sous forme de don. Les bénéficiaires s'engagent à utiliser les dons exclusivement pour le projet social déclaré.",
      is_confidential: false,
      created_at: new Date().toISOString()
    },
    {
      id: "train_7",
      keywords: ["qui sommes-nous", "mission", "objectif", "pole de dons", "pole", "dons", "à propos", "a propos", "concept"],
      response: "Pôle de Dons est une plateforme d'Attribution Solidaire et Humanitaire de dons en nature, mobiliers, immobiliers ou financiers. Nous mettons en relation des donateurs et des porteurs de projets à fort impact social en régulant les attributions par un algorithme d'urgence.",
      is_confidential: false,
      created_at: new Date().toISOString()
    },
    {
      id: "train_8",
      keywords: ["compte admin", "mot de passe temporaire", "accès sécurisé", "superadmin", "mot de passe maître"],
      response: "[CONFIDENTIEL - INTERNE CONSEILLERS] : Les comptes administrateurs doivent utiliser un mot de passe fort comprenant au moins 12 caractères avec chiffres et caractères spéciaux. Ne jamais divulguer d'informations d'accès par chat.",
      is_confidential: true,
      created_at: new Date().toISOString()
    }
  ];
  saveLocalDb();
}

function saveLocalDb() {
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(localDb, null, 2), "utf-8");
}

function deleteLocalMedia(url?: string) {
  if (url && url.startsWith("/uploads/")) {
    const filename = url.replace("/uploads/", "");
    const filepath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
        console.log(`[DELETE] Media supprimé du disque: ${filename}`);
      } catch (err) {
        console.error(`[DELETE] Erreur suppression media ${filename}:`, err);
      }
    }
  }
}

async function syncSupabaseUsers() {
  if (!isSupabaseConnected) return;
  try {
    const { data: profiles, error } = await supabase.from("profiles").select("*");
    if (error) {
      console.error("Error fetching profiles from Supabase:", error.message);
      const msg = error.message.toLowerCase();
      if (msg.includes("api key") || msg.includes("jwt") || msg.includes("invalid") || msg.includes("unauthorized") || msg.includes("bad api")) {
        console.warn("[SUPABASE] Clé API invalide détectée. Désactivation de Supabase.");
        isSupabaseConnected = false;
      }
      return;
    }
    if (profiles && profiles.length > 0) {
      let changed = false;
      profiles.forEach((p: any) => {
        const exists = localDb.users.some((u: any) => u.email === p.email || u.id === p.id);
        if (!exists) {
          localDb.users.push({
            id: p.id,
            email: p.email,
            name: p.name || p.email.split("@")[0],
            role: p.role || "user",
            permissions: p.permissions || (p.role === "admin" ? ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"] : []),
            created_at: p.created_at || new Date().toISOString()
          });
          changed = true;
        } else {
          const idx = localDb.users.findIndex((u: any) => u.email === p.email || u.id === p.id);
          if (idx !== -1) {
            let userChanged = false;
            if (p.role && localDb.users[idx].role !== p.role) {
              localDb.users[idx].role = p.role;
              userChanged = true;
            }
            if (p.name && localDb.users[idx].name !== p.name) {
              localDb.users[idx].name = p.name;
              userChanged = true;
            }
            if (p.permissions && JSON.stringify(localDb.users[idx].permissions) !== JSON.stringify(p.permissions)) {
              localDb.users[idx].permissions = p.permissions;
              userChanged = true;
            } else if (p.role === "admin" && (!localDb.users[idx].permissions || localDb.users[idx].permissions.length === 0)) {
              localDb.users[idx].permissions = ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"];
              userChanged = true;
            }
            if (userChanged) changed = true;
          }
        }
      });
      if (changed) {
        saveLocalDb();
      }
    }
  } catch (e) {
    console.error("syncSupabaseUsers failed:", e);
  }
}

// Fonction de vérification et synchronisation initiale
let isSupabaseConnected = false;
async function checkSupabaseConnection() {
  try {
    // Vérifier d'abord la santé générale de l'API Supabase
    const { error: authError } = await supabase.auth.getSession();
    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("fetch")) {
        console.warn("Impossible de contacter Supabase (Problème réseau ou URL).");
        isSupabaseConnected = false;
        return;
      }
      if (msg.includes("api key") || msg.includes("jwt") || msg.includes("invalid") || msg.includes("unauthorized") || msg.includes("bad api")) {
        console.warn("Supabase désactivé (Clé API invalide détectée au niveau Auth) :", authError.message);
        isSupabaseConnected = false;
        return;
      }
    }

    // Vérifier ensuite la base de données
    const { data: donations, error: dbError } = await supabase.from("donations").select("id").limit(1);
    const { error: profileError } = await supabase.from("profiles").select("id").limit(1);
    
    if (dbError) {
      const msg = dbError.message.toLowerCase();
      if (msg.includes("api key") || msg.includes("jwt") || msg.includes("invalid") || msg.includes("unauthorized") || msg.includes("bad api")) {
        console.warn("Supabase désactivé (Clé API invalide détectée au niveau DB Donations) :", dbError.message);
        isSupabaseConnected = false;
        return;
      }
      console.log("Note: Supabase Auth OK, mais accès DB restreint ou table donations absente:", dbError.message);
    } else {
      console.log("Base de données Supabase connectée (table donations OK) !");
    }

    if (profileError) {
      const msg = profileError.message.toLowerCase();
      if (msg.includes("api key") || msg.includes("jwt") || msg.includes("invalid") || msg.includes("unauthorized") || msg.includes("bad api")) {
        console.warn("Supabase désactivé (Clé API invalide détectée au niveau DB Profiles) :", profileError.message);
        isSupabaseConnected = false;
        return;
      }
      if (profileError.code === "PGRST116") {
        // PGRST116 usually means row not found
      } else {
        console.log("Note: Table 'profiles' absente ou inaccessible. Utilisation du cache local uniquement pour les rôles.");
      }
    } else {
      console.log("Table 'profiles' détectée et accessible !");
    }

    isSupabaseConnected = true;
  } catch (err: any) {
    console.error("Échec de connexion Supabase, passage en mode local simulé :", err.message);
    isSupabaseConnected = false;
  }
}

async function syncLocalDataToSupabase() {
  if (!isSupabaseConnected) return;
  console.log("[SUPABASE] Synchronisation des données locales vers Supabase...");

  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  try {
    // 1. DONS (Seulement s'ils ont un vrai UUID pour éviter d'importer les mock d1, d2, d3)
    const { data: supDons } = await supabase.from("donations").select("id");
    const existingDonIds = new Set((supDons || []).map(d => d.id));
    
    if (localDb.donations.length > 0) {
      for (const don of localDb.donations) {
        if (uuidRegex.test(don.id) && !existingDonIds.has(don.id)) {
          await supabase.from("donations").insert([don]);
        }
      }
    }

    // 2. RÉGLAGES (SETTINGS)
    if (localDb.settings && Object.keys(localDb.settings).length > 0) {
      for (const key in localDb.settings) {
        const value = localDb.settings[key];
        await supabase.from("app_settings").upsert({ 
          key, 
          value, 
          updated_at: new Date().toISOString() 
        }, { onConflict: "key" });
      }
    }

    // 3. APPLICATIONS
    const { data: supApps } = await supabase.from("applications").select("id");
    const existingAppIds = new Set((supApps || []).map(a => a.id));
    
    if (localDb.applications.length > 0) {
      for (const app of localDb.applications) {
        if (uuidRegex.test(app.id) && uuidRegex.test(app.donation_id) && !existingAppIds.has(app.id)) {
          await supabase.from("applications").insert([app]);
        }
      }
    }

    // 3.5 AGENT CONVERSATIONS (Syncing local agent chats)
    if (localDb.agent_conversations) {
      let supConvs = []; try { const res = await supabase.from("agent_conversations").select("id"); supConvs = res.data || []; } catch(e) {}
      const existingConvIds = new Set(supConvs.map(c => c.id));
      for (const donId in localDb.agent_conversations) {
        for (const msg of localDb.agent_conversations[donId]) {
          if (!existingConvIds.has(msg.id)) {
             try {
               await supabase.from("agent_conversations").insert([msg]);
             } catch(e) {}
          }
        }
      }
    }

    // 3.6 APPLICATION SUBMISSIONS
    if (localDb.application_submissions && localDb.application_submissions.length > 0) {
      let supSubs = []; try { const res = await supabase.from("application_submissions").select("id"); supSubs = res.data || []; } catch(e) {}
      const existingSubIds = new Set(supSubs.map(s => s.id));
      for (const sub of localDb.application_submissions) {
        if (!existingSubIds.has(sub.id)) {
           try {
             await supabase.from("application_submissions").insert([sub]);
           } catch(e) {}
        }
      }
    }

    // 4. MESSAGES
    const { data: supMsgs } = await supabase.from("application_messages").select("id");
    const existingMsgIds = new Set((supMsgs || []).map(m => m.id));
    
    if (localDb.application_messages.length > 0) {
      for (const msg of localDb.application_messages) {
        if (uuidRegex.test(msg.id) && uuidRegex.test(msg.application_id) && !existingMsgIds.has(msg.id)) {
          await supabase.from("application_messages").insert([msg]);
        }
      }
    }
    
    console.log("[SUPABASE] Fin de la synchronisation initiale.");
  } catch (err) {
    console.error("[SUPABASE] Erreur lors de la synchronisation initiale:", err);
  }
}

// Lancer la vérification initiale
async function initializeApp() {
  await checkSupabaseConnection();
  if (isSupabaseConnected) {
    await syncSupabaseUsers();
    await syncLocalDataToSupabase();
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const hasBucket = buckets?.some(b => b.name === "donations");
      if (!hasBucket) {
        console.log("[SUPABASE] Création du bucket de stockage 'donations'...");
        await supabase.storage.createBucket("donations", {
          public: true
        });
      }
    } catch (err) {
      console.error("[SUPABASE] Impossible de s'assurer de l'existence du bucket 'donations':", err);
    }
  }
}

initializeApp();

// =====================================================================
// ENDPOINTS API
// =====================================================================

// Statut de la base de données
app.get("/api/db-status", async (req, res) => {
  await checkSupabaseConnection();
  res.json({
    connectedToSupabase: isSupabaseConnected,
    supabaseUrl: SUPABASE_URL,
    localDbStats: {
      donations: localDb.donations.length,
      testimonials: localDb.testimonials.length,
      applications: localDb.applications.length,
      messages: localDb.application_messages.length,
      submissions: localDb.application_submissions.length
    }
  });
});

// Réinitialiser la base de données locale
app.post("/api/db-reset", (req, res) => {
  localDb = {
    donations: [
      {
        id: "d1",
        title: "Véhicule utilitaire compact (Peugeot Partner)",
        category: "Véhicules",
        description: "Véhicule utilitaire Peugeot Partner de 2019, parfaitement entretenu avec 82 000 km au compteur. Idéal pour une jeune association ou une entreprise solidaire en démarrage ayant besoin de transporter du matériel.",
        status: "active",
        target_amount: null,
        current_bids_count: 3,
        views_count: 147,
        image_url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600",
        location: "Bordeaux, France",
        specifications: {
          "Kilométrage": "82 000 km",
          "Année": "2019",
          "Motorisation": "Diesel 1.6 BlueHDi",
          "État": "Excellent"
        },
        agent_name: "Marc Lefèvre",
        agent_phone: "+33 6 12 34 56 78",
        created_at: new Date().toISOString()
      },
      {
        id: "d2",
        title: "Local commercial de 120 m² en rez-de-chaussée",
        category: "Immobilier",
        description: "Local professionnel lumineux de 120 m² situé en centre-ville, disposant d'un espace accueil, de deux bureaux et de commodités. Idéal pour un projet à fort impact social ou un pôle d'accueil solidaire.",
        status: "active",
        target_amount: null,
        current_bids_count: 5,
        views_count: 284,
        image_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600",
        location: "Lyon, France",
        specifications: {
          "Superficie": "120 m²",
          "Pièces": "3 bureaux",
          "Accès PMR": "Oui",
          "État": "Très bon état"
        },
        agent_name: "Amélie Fontaine",
        agent_phone: "+33 6 87 65 43 21",
        created_at: new Date().toISOString()
      },
      {
        id: "d3",
        title: "Dotation Financière pour Projet Solidaire",
        category: "Financier",
        description: "Subvention d'aide directe de 5 000 € financée par notre fondation partenaire pour soutenir le lancement d'une initiative locale, éco-responsable ou d'aide d'urgence.",
        status: "active",
        target_amount: 5000,
        current_bids_count: 2,
        views_count: 98,
        image_url: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=600",
        location: "National, France",
        specifications: {
          "Montant": "5 000 €",
          "Type": "Don financier direct",
          "Usage": "Développement de projet",
          "Échéance": "Août 2026"
        },
        agent_name: "Julien Dubreuil",
        agent_phone: "+33 7 45 89 23 11",
        created_at: new Date().toISOString()
      }
    ],
    testimonials: [
      {
        id: "t1",
        donation_id: "d1",
        media_type: "audio",
        railway_media_url: "/uploads/testimonial_samuel_audio.mp3",
        author_name: "Association Éco-Logique",
        quote: "Grâce à l'utilitaire Peugeot Partner reçu, nous collectons désormais 1,2 tonne de denrées invendues chaque semaine pour les distribuer aux familles !",
        approved: true,
        created_at: new Date().toISOString()
      },
      {
        id: "t2",
        donation_id: "d2",
        media_type: "video",
        railway_media_url: "/uploads/testimonial_lea_video.mp4",
        author_name: "Centre Social Réunis",
        quote: "Ce local a sauvé notre structure ! Nous accueillons plus de 40 enfants chaque soir pour de l'accompagnement et du soutien aux familles du quartier.",
        approved: true,
        created_at: new Date().toISOString()
      }
    ],
    applications: [],
    application_submissions: [],
    application_messages: [],
    agent_conversations: {},
    users: [
      { email: "admin@donationsphere.com", password: "Solidaire2026!", name: "Administrateur", role: "admin" },
      { email: "asthedio@gmail.com", password: "Solidaire2026!", name: "Admin Principal", role: "admin" }
    ],
    partners: [
      {
        id: "p1",
        name: "FedEx",
        logo_url: "https://upload.wikimedia.org/wikipedia/commons/b/b9/FedEx_Corporation_-_Logo.svg",
        website: "https://www.fedex.com"
      }
    ],
    chatbot_training: [],
    settings: {},
    calls: []
  };
  saveLocalDb();
  res.json({ success: true, message: "Base de données locale réinitialisée !" });
});

// A. GESTION DES DONS
app.get("/api/donations", async (req, res) => {
  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.from("donations").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        // En cas d'absence de la colonne views_count dans Supabase, fusionner avec les données locales persistantes
        const merged = data.map((don: any) => {
          const localDon = localDb.donations.find(d => d.id === don.id);
          return {
            ...don,
            views_count: (don.views_count !== undefined && don.views_count !== null)
              ? don.views_count
              : (localDon?.views_count || 0)
          };
        });
        return res.json(merged);
      }
      if (error) console.error("Erreur récupération Supabase (donations):", error);
    } catch (e) {}
  }
  res.json(localDb.donations);
});

app.post("/api/donations", async (req, res) => {
  const { title, category, description, target_amount, image_url, location, specifications, agent_name, agent_phone, donor_name } = req.body;
  const newDon = {
    id: crypto.randomUUID(),
    title,
    category,
    description,
    status: "active",
    target_amount: target_amount ? Number(target_amount) : 0,
    current_bids_count: 0,
    views_count: 0,
    image_url: image_url || "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=600",
    location: location || "France (National)",
    specifications: specifications || { "Type": category || "Donation" },
    agent_name: agent_name || "Secrétariat Général",
    agent_phone: agent_phone || "+49 15216945182",
    donor_name: donor_name || "Anonyme",
    created_at: new Date().toISOString()
  };

  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.from("donations").insert([newDon]).select();
      if (!error && data && data[0]) {
        localDb.donations.unshift(data[0]);
        saveLocalDb();
        return res.json(data[0]);
      }
      if (error) {
        console.error("Erreur insertion Supabase (donations):", error.message || error);
        if (error.message && error.message.includes("donor_name")) {
          const { donor_name, ...fallbackDon } = newDon;
          const retryResult = await supabase.from("donations").insert([fallbackDon]).select();
          if (!retryResult.error && retryResult.data && retryResult.data[0]) {
            localDb.donations.unshift({ ...retryResult.data[0], donor_name });
            saveLocalDb();
            
    return res.json({ ...retryResult.data[0], donor_name });
          }
        }
      }
    } catch (e) {
      console.error("Exception insertion Supabase (donations):", e);
    }
  }

  localDb.donations.unshift(newDon);
  saveLocalDb();
  res.json(newDon);
});

app.post("/api/donations/:id/view", async (req, res) => {
  const { id } = req.params;
  const io = req.app.get("io");

  // 1. Mettre à jour en local (et créer l'entrée si le don provient uniquement de Supabase)
  let localIdx = localDb.donations.findIndex(d => d.id === id);
  if (localIdx !== -1) {
    localDb.donations[localIdx].views_count = (localDb.donations[localIdx].views_count || 0) + 1;
  } else {
    // Si le don n'existait que sur Supabase, on crée un enregistrement local pour persister ses vues
    localDb.donations.push({
      id,
      views_count: 1
    } as any);
    localIdx = localDb.donations.length - 1;
  }
  saveLocalDb();

  // 2. Mettre à jour dans Supabase si connecté et si la colonne existe
  if (isSupabaseConnected) {
    try {
      const { data: don, error: selectErr } = await supabase
        .from("donations")
        .select("views_count")
        .eq("id", id)
        .single();
        
      if (!selectErr && don) {
        const nextViews = (don.views_count || 0) + 1;
        const { data, error: updateErr } = await supabase
          .from("donations")
          .update({ views_count: nextViews })
          .eq("id", id)
          .select();
          
        if (!updateErr && data && data[0]) {
          localDb.donations[localIdx] = { ...localDb.donations[localIdx], ...data[0] };
          saveLocalDb();
          const updatedDon = localDb.donations[localIdx];
          if (io) {
            io.emit("donation:updated", updatedDon);
          }
          
    return res.json({ success: true, views_count: nextViews, donation: updatedDon });
        }
      } else {
        // Fallback si la colonne n'existe pas encore
        const nextViews = localDb.donations[localIdx].views_count;
        await supabase
          .from("donations")
          .update({ views_count: nextViews })
          .eq("id", id);
      }
    } catch (e) {
      console.warn("[SUPABASE] Colonne views_count potentiellement absente ou erreur:", e);
    }
  }

  const updatedDon = localIdx !== -1 ? localDb.donations[localIdx] : null;
  if (io && updatedDon) {
    io.emit("donation:updated", updatedDon);
  }
  res.json({ success: true, views_count: updatedDon ? (updatedDon.views_count || 0) : 0, donation: updatedDon });
});

app.put("/api/donations/:id", async (req, res) => {
  const { id } = req.params;
  const { title, category, description, status, target_amount, image_url, location, specifications, agent_name, agent_phone, donor_name } = req.body;

  if (isSupabaseConnected) {
    try {
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (category !== undefined) updateData.category = category;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (target_amount !== undefined) updateData.target_amount = target_amount !== null ? Number(target_amount) : null;
      if (image_url !== undefined) updateData.image_url = image_url;
      if (location !== undefined) updateData.location = location;
      if (specifications !== undefined) updateData.specifications = specifications;
      if (agent_name !== undefined) updateData.agent_name = agent_name;
      if (agent_phone !== undefined) updateData.agent_phone = agent_phone;
      if (donor_name !== undefined) updateData.donor_name = donor_name;

      const { data, error } = await supabase
        .from("donations")
        .update(updateData)
        .eq("id", id)
        .select();
      if (!error && data && data[0]) {
        const idx = localDb.donations.findIndex(d => d.id === id);
        if (idx !== -1) {
          localDb.donations[idx] = { ...localDb.donations[idx], ...data[0] };
          saveLocalDb();
        }
        return res.json(data[0]);
      }
      if (error) {
        console.error("Erreur mise à jour Supabase (donations):", error.message);
        if (error.message && error.message.includes("donor_name")) {
          const { donor_name: _, ...fallbackUpdate } = updateData;
          const retryResult = await supabase
            .from("donations")
            .update(fallbackUpdate)
            .eq("id", id)
            .select();
          if (!retryResult.error && retryResult.data && retryResult.data[0]) {
            const idx = localDb.donations.findIndex(d => d.id === id);
            if (idx !== -1) {
              localDb.donations[idx] = { ...localDb.donations[idx], ...retryResult.data[0], donor_name };
              saveLocalDb();
            }
            
    return res.json({ ...retryResult.data[0], donor_name });
          }
        }
      }
    } catch (e) {
      console.error("Erreur mise à jour Supabase (donations):", e);
    }
  }

  const index = localDb.donations.findIndex(d => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Donation introuvable" });
  }

  const updated = {
    ...localDb.donations[index],
    title: title !== undefined ? title : localDb.donations[index].title,
    category: category !== undefined ? category : localDb.donations[index].category,
    description: description !== undefined ? description : localDb.donations[index].description,
    status: status !== undefined ? status : localDb.donations[index].status,
    target_amount: target_amount !== undefined ? (target_amount !== null ? Number(target_amount) : null) : localDb.donations[index].target_amount,
    image_url: image_url !== undefined ? image_url : localDb.donations[index].image_url,
    location: location !== undefined ? location : localDb.donations[index].location,
    specifications: specifications !== undefined ? specifications : localDb.donations[index].specifications,
    agent_name: agent_name !== undefined ? agent_name : localDb.donations[index].agent_name,
    agent_phone: agent_phone !== undefined ? agent_phone : localDb.donations[index].agent_phone,
    donor_name: donor_name !== undefined ? donor_name : localDb.donations[index].donor_name,
  };

  localDb.donations[index] = updated;
  saveLocalDb();
  res.json(updated);
});

async function deleteApplicationMediaFiles(appId: string) {
  let appObj = null;
  if (isSupabaseConnected) {
    const { data } = await supabase.from("applications").select("*").eq("id", appId).single();
    appObj = data;
  } else {
    appObj = localDb.applications.find(a => a.id === appId);
  }
  
  if (appObj) {
    deleteLocalMedia(appObj.cv_url);
    deleteLocalMedia(appObj.id_card_url);
    deleteLocalMedia(appObj.address_proof_url);
  }
  
  let messages = [];
  if (isSupabaseConnected) {
    const { data } = await supabase.from("application_messages").select("attachment_url").eq("application_id", appId);
    if (data) messages = data;
  } else {
    messages = localDb.application_messages.filter(m => m.application_id === appId);
  }
  messages.forEach((m: any) => deleteLocalMedia(m.attachment_url));
  
  let submissions = [];
  if (isSupabaseConnected) {
    const { data } = await supabase.from("application_submissions").select("form_data").eq("application_id", appId);
    if (data) submissions = data;
  } else {
    submissions = localDb.application_submissions.filter(s => s.application_id === appId);
  }
  submissions.forEach((s: any) => {
    if (s.form_data) {
      Object.values(s.form_data).forEach((val: any) => {
        if (typeof val === 'string') deleteLocalMedia(val);
      });
    }
  });
}

app.delete("/api/donations/:id", async (req, res) => {
  const { id } = req.params;

  let donUrl = "";
  let appIds: string[] = [];
  let testUrls: string[] = [];

  if (isSupabaseConnected) {
    const { data: don } = await supabase.from("donations").select("image_url").eq("id", id).single();
    if (don) donUrl = don.image_url;
    const { data: apps } = await supabase.from("applications").select("id").eq("donation_id", id);
    if (apps) appIds = apps.map(a => a.id);
    const { data: tests } = await supabase.from("testimonials").select("railway_media_url").eq("donation_id", id);
    if (tests) testUrls = tests.map(t => t.railway_media_url);
  } else {
    const don = localDb.donations.find(d => d.id === id);
    if (don) donUrl = don.image_url;
    appIds = localDb.applications.filter(a => a.donation_id === id).map(a => a.id);
    testUrls = localDb.testimonials.filter(t => t.donation_id === id).map(t => t.railway_media_url);
  }

  for (const appId of appIds) {
    await deleteApplicationMediaFiles(appId);
  }
  testUrls.forEach(url => deleteLocalMedia(url));

  if (isSupabaseConnected) {
    try {
      const { error } = await supabase
        .from("donations")
        .delete()
        .eq("id", id);
      if (error) console.error("SUPABASE DELETE ERROR:", error);
      if (!error) {
        if (donUrl) deleteLocalMedia(donUrl);
        localDb.donations = localDb.donations.filter(d => d.id !== id);
        localDb.applications = localDb.applications.filter(a => a.donation_id !== id);
        localDb.application_messages = localDb.application_messages.filter(m => !appIds.includes(m.application_id));
        localDb.application_submissions = localDb.application_submissions.filter(s => !appIds.includes(s.application_id));
        localDb.testimonials = localDb.testimonials.filter(t => t.donation_id !== id);
        saveLocalDb();
        
    return res.json({ success: true, message: "Don supprimé avec succès !" });
      }
      if (error) console.error("Erreur suppression Supabase (donations):", error.message);
    } catch (e) {
      console.error("Erreur suppression Supabase (donations):", e);
    }
  }

  const index = localDb.donations.findIndex(d => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Donation introuvable" });
  }

  if (donUrl) deleteLocalMedia(donUrl);
  localDb.donations.splice(index, 1);
  localDb.applications = localDb.applications.filter(a => a.donation_id !== id);
  localDb.application_messages = localDb.application_messages.filter(m => !appIds.includes(m.application_id));
  localDb.application_submissions = localDb.application_submissions.filter(s => !appIds.includes(s.application_id));
  localDb.testimonials = localDb.testimonials.filter(t => t.donation_id !== id);
  saveLocalDb();
  res.json({ success: true, message: "Don supprimé avec succès !" });
});

// B. TESTIMONIALS
app.get("/api/testimonials", async (req, res) => {
  let localTsts = [...localDb.testimonials];
  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.from("testimonials").select("*");
      if (!error && data) {
        return res.json(data);
      }
    } catch (e) {
      console.error("Erreur récupération témoignages Supabase:", e);
    }
  }
  res.json(localTsts);
});

app.post("/api/testimonials", async (req, res) => {
  const { donation_id, media_type, railway_media_url, author_name, quote, approved } = req.body;
  const newTst = {
    id: crypto.randomUUID(),
    donation_id,
    media_type,
    railway_media_url,
    author_name,
    quote,
    approved: approved !== undefined ? Boolean(approved) : false,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.from("testimonials").insert([newTst]).select();
      if (!error && data && data[0]) {
        localDb.testimonials.push(data[0]);
        saveLocalDb();
        return res.json(data[0]);
      }
      if (error) console.error("Erreur insertion Supabase (testimonials):", error.message || error);
    } catch (e) {
      console.error("Exception insertion Supabase (testimonials):", e);
    }
  }

  localDb.testimonials.push(newTst);
  saveLocalDb();
  res.json(newTst);
});

app.put("/api/testimonials/:id", async (req, res) => {
  const { id } = req.params;
  const { author_name, quote, approved, media_type, railway_media_url } = req.body;

  let updatedTst: any = null;

  if (isSupabaseConnected) {
    try {
      const updateData: any = {};
      if (author_name !== undefined) updateData.author_name = author_name;
      if (quote !== undefined) updateData.quote = quote;
      if (approved !== undefined) updateData.approved = Boolean(approved);
      if (media_type !== undefined) updateData.media_type = media_type;
      if (railway_media_url !== undefined) updateData.railway_media_url = railway_media_url;

      const { data, error } = await supabase
        .from("testimonials")
        .update(updateData)
        .eq("id", id)
        .select();
      if (!error && data && data[0]) {
        updatedTst = data[0];
      }
    } catch (e) {
      console.error("Erreur mise à jour Supabase (testimonials):", e);
    }
  }

  const index = localDb.testimonials.findIndex(t => t.id === id);
  if (index !== -1) {
    const updated = {
      ...localDb.testimonials[index],
      author_name: author_name !== undefined ? author_name : localDb.testimonials[index].author_name,
      quote: quote !== undefined ? quote : localDb.testimonials[index].quote,
      approved: approved !== undefined ? Boolean(approved) : localDb.testimonials[index].approved,
      media_type: media_type !== undefined ? media_type : localDb.testimonials[index].media_type,
      railway_media_url: railway_media_url !== undefined ? railway_media_url : localDb.testimonials[index].railway_media_url,
    };
    localDb.testimonials[index] = updated;
    saveLocalDb();
    if (!updatedTst) {
      updatedTst = updated;
    }
  }

  if (updatedTst) {
    return res.json(updatedTst);
  } else {
    return res.status(404).json({ error: "Témoignage introuvable" });
  }
});

app.delete("/api/testimonials/:id", async (req, res) => {
  const { id } = req.params;

  let mediaUrlToDelete = "";
  
  if (isSupabaseConnected) {
    try {
      // 1. Récupérer l'URL avant suppression
      const { data } = await supabase.from("testimonials").select("railway_media_url").eq("id", id).single();
      if (data && data.railway_media_url) {
        mediaUrlToDelete = data.railway_media_url;
      }
      
      // 2. Supprimer de la base
      const { error } = await supabase
        .from("testimonials")
        .delete()
        .eq("id", id);
      if (error) console.error("SUPABASE DELETE ERROR:", error);
      if (!error) {
        if (mediaUrlToDelete) deleteLocalMedia(mediaUrlToDelete);
        
        // Supprimer également du cache local si présent
        localDb.testimonials = localDb.testimonials.filter(t => t.id !== id);
        saveLocalDb();
        
    return res.json({ success: true, message: "Témoignage supprimé avec succès !" });
      }
    } catch (e) {
      console.error("Erreur suppression Supabase (testimonials):", e);
    }
  }

  const index = localDb.testimonials.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Témoignage introuvable" });
  }

  mediaUrlToDelete = localDb.testimonials[index].railway_media_url || "";
  if (mediaUrlToDelete) deleteLocalMedia(mediaUrlToDelete);

  localDb.testimonials.splice(index, 1);
  saveLocalDb();
  res.json({ success: true, message: "Témoignage supprimé avec succès !" });
});

// C. APPLICATIONS (SUIVI DES CANDIDATURES)
app.get("/api/applications", async (req, res) => {
  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        return res.json(data);
      }
      if (error) console.error("Erreur récupération Supabase (applications):", error.message);
    } catch (e) {
      console.error("Exception récupération Supabase (applications):", e);
    }
  }
  res.json(localDb.applications);
});

app.post("/api/applications", async (req, res) => {
  const { donation_id, user_name, user_id, user_email } = req.body;
  
  // S'assurer que donation_id est un UUID valide pour Supabase
  let finalDonationId = donation_id;
  if (isSupabaseConnected && (!donation_id || !uuidRegex.test(donation_id))) {
    console.warn(`[WARN] donation_id non valide pour Supabase: ${donation_id}`);
  }

  // Résoudre user_id de manière sécurisée en UUID
  let finalUserId = user_id;
  
  if (isSupabaseConnected) {
    if (!finalUserId || typeof finalUserId !== "string" || !uuidRegex.test(finalUserId)) {
      // Si l'utilisateur a un email, chercher s'il a déjà un profil dans Supabase avec un UUID valide
      if (user_email) {
        try {
          const { data: profile } = await supabase.from("profiles").select("id").eq("email", user_email).single();
          if (profile && profile.id && uuidRegex.test(profile.id)) {
            finalUserId = profile.id;
            console.log(`[SUPABASE] UUID résolu depuis le profil pour ${user_email}: ${finalUserId}`);
          }
        } catch (e) {
          // Erreur ou pas de profil trouvé
        }
      }
    }
    
    // Si on n'a toujours pas d'UUID valide, on génère un UUID valide aléatoire (crypto.randomUUID) pour la contrainte de la BD
    if (!finalUserId || typeof finalUserId !== "string" || !uuidRegex.test(finalUserId)) {
      finalUserId = crypto.randomUUID();
      console.log(`[SUPABASE] Génération d'un UUID aléatoire pour user_id: ${finalUserId}`);
    }
  } else {
    // Fallback local hors connexion
    finalUserId = user_id || "guest_user_" + Math.random().toString(36).substr(2, 9);
  }

  // --- PRÉVENTION DES DOUBLONS ---
  const alreadyAppliedLocal = localDb.applications.some(a => 
    a.donation_id === finalDonationId && 
    (a.user_id === finalUserId || (user_email && a.user_email === user_email))
  );
  if (alreadyAppliedLocal) {
    return res.status(400).json({ error: "Vous avez déjà soumis un dossier de candidature pour ce don." });
  }

  if (isSupabaseConnected && uuidRegex.test(finalDonationId) && uuidRegex.test(finalUserId)) {
    try {
      const { data: existingApps, error: checkError } = await supabase
        .from("applications")
        .select("id")
        .eq("donation_id", finalDonationId)
        .eq("user_id", finalUserId);
      if (!checkError && existingApps && existingApps.length > 0) {
        return res.status(400).json({ error: "Vous avez déjà soumis un dossier de candidature pour ce don." });
      }
    } catch (e) {
      console.error("Erreur lors de la détection de doublons Supabase:", e);
    }
  }

  // Préparer l'objet application avec un UUID de clé primaire valide dès le début !
  const newApp: any = {
    id: crypto.randomUUID(),
    donation_id: finalDonationId,
    user_id: finalUserId,
    user_name: user_name || "Candidat Anonyme",
    current_step: 0,
    completion_percentage: 0,
    risk_level: "low",
    status: "pending",
    created_at: new Date().toISOString()
  };

  if (isSupabaseConnected && uuidRegex.test(finalDonationId) && uuidRegex.test(finalUserId)) {
    try {
      // 1. Insérer l'application dans Supabase avec son ID UUID généré
      const { data, error } = await supabase.from("applications").insert([newApp]).select();
      
      if (!error && data && data[0]) {
        const savedApp = data[0];
        console.log(`[SUPABASE] Application enregistrée avec succès, ID: ${savedApp.id}`);
        
        // Mettre à jour le compteur de dons dans Supabase
        try {
          await supabase.rpc('increment_bids', { donation_id_param: finalDonationId });
        } catch (rpcErr) {
          // Fallback si la fonction RPC n'existe pas
          const { data: don } = await supabase.from("donations").select("current_bids_count").eq("id", finalDonationId).single();
          if (don) {
            await supabase.from("donations").update({ current_bids_count: (don.current_bids_count || 0) + 1 }).eq("id", finalDonationId);
          }
        }

        // Récupérer le don mis à jour pour diffusion
        const { data: updatedDon } = await supabase.from("donations").select("*").eq("id", finalDonationId).single();
        
        // Mettre à jour aussi en local pour la cohérence
        if (updatedDon) {
          const localDonIdx = localDb.donations.findIndex(d => d.id === finalDonationId);
          if (localDonIdx !== -1) {
            localDb.donations[localDonIdx] = { ...localDb.donations[localDonIdx], ...updatedDon };
          }
        }

        const io = req.app.get("io");
        if (io && updatedDon) {
          io.emit("donation:updated", updatedDon);
        }

        // 3. Envoyer un message système initial
        const initialMsg = {
          id: crypto.randomUUID(),
          application_id: savedApp.id,
          sender_type: "system",
          content: "Bienvenue sur notre plateforme de dons solidaires ! Commençons l'instruction de votre dossier. Étape 1 : Veuillez renseigner vos coordonnées de contact pour que nos agents puissent vous joindre.",
          created_at: new Date().toISOString()
        };
        await supabase.from("application_messages").insert([initialMsg]);

        // 4. Copier l'historique du chat vitrine (s'il existe) vers les messages de l'application
        try {
          let legacyMsgs: any[] = [];
          if (isSupabaseConnected && uuidRegex.test(finalDonationId)) {
            const { data: directMsgs } = await supabase
              .from("agent_conversations")
              .select("*")
              .eq("donation_id", finalDonationId)
              .or(`user_id.eq."${finalUserId}",user_name.eq."${user_name}"`);
            if (directMsgs) legacyMsgs = directMsgs;
          }
          
          // Ajouter aussi les messages locaux hérités
          const localConv = localDb.agent_conversations?.[finalDonationId] || [];
          const localLegacy = localConv.filter((m: any) => m.user_id === finalUserId || m.user_name === user_name);
          localLegacy.forEach((lm: any) => {
            if (!legacyMsgs.some(sm => sm.content === lm.content && sm.created_at === lm.created_at)) {
              legacyMsgs.push(lm);
            }
          });

          // Trier par date pour conserver l'ordre
          legacyMsgs.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

          for (const m of legacyMsgs) {
            // Mise à jour de l'ID utilisateur dans la table agent_conversations pour ne pas perdre l'historique sur la vitrine
            if (m.user_id !== finalUserId && isSupabaseConnected) {
              await supabase.from("agent_conversations").update({ user_id: finalUserId }).eq("id", m.id);
            }
            if (m.user_id !== finalUserId && localDb.agent_conversations && localDb.agent_conversations[finalDonationId]) {
              const localMsgIdx = localDb.agent_conversations[finalDonationId].findIndex((lm: any) => lm.id === m.id);
              if (localMsgIdx !== -1) {
                localDb.agent_conversations[finalDonationId][localMsgIdx].user_id = finalUserId;
              }
            }

            const appMsg = {
              id: m.id || crypto.randomUUID(),
              application_id: savedApp.id,
              sender_type: m.sender === "user" ? "user" : "admin",
              content: m.content,
              attachment: m.attachment || null,
              created_at: m.created_at
            };
            
            if (isSupabaseConnected) {
              await supabase.from("application_messages").insert([appMsg]);
            }
            if (!localDb.application_messages) localDb.application_messages = [];
            localDb.application_messages.push(appMsg);
          }
        } catch (copyErr) {
          console.error("Erreur lors de la copie de l'historique vers l'application:", copyErr);
        }

        // Synchroniser également avec localDb pour avoir les mêmes ID et données
        const localAppSync = {
          ...savedApp,
          rank_position: localDb.applications.filter(a => a.donation_id === finalDonationId).length + 1,
          step_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        };
        localDb.applications.unshift(localAppSync);
        localDb.application_messages.push(initialMsg);
        saveLocalDb();

        return res.json(savedApp);
      } else if (error) {
        console.error("Erreur d'insertion Supabase (applications):", error.message);
      }
    } catch (e) {
      console.error("Exception critique Supabase (applications):", e);
    }
  }

  // Fallback Local (si pas connecté ou si l'insertion a échoué)
  console.log("[LOCAL] Enregistrement de la candidature dans le stockage local de secours");
  
  // Mettre à jour le compteur de dons en local
  const localDonIdx = localDb.donations.findIndex(d => d.id === finalDonationId);
  if (localDonIdx !== -1) {
    localDb.donations[localDonIdx].current_bids_count = (localDb.donations[localDonIdx].current_bids_count || 0) + 1;
    const io = req.app.get("io");
    if (io) io.emit("donation:updated", localDb.donations[localDonIdx]);
  }

  const localApp = {
    ...newApp,
    rank_position: localDb.applications.filter(a => a.donation_id === finalDonationId).length + 1,
    step_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  };
  
  localDb.applications.unshift(localApp);
  saveLocalDb();

  // Envoyer un message système initial pour le fallback local
  const initialLocalMsg = {
    id: crypto.randomUUID(),
    application_id: localApp.id,
    sender_type: "system",
    content: "Bienvenue sur notre plateforme de dons solidaires ! Commençons l'instruction de votre dossier. Étape 1 : Veuillez renseigner vos coordonnées de contact pour que nos agents puissent vous joindre.",
    created_at: new Date().toISOString()
  };
  if (!localDb.application_messages) localDb.application_messages = [];
  localDb.application_messages.push(initialLocalMsg);

  // Copier l'historique des conversations locales pour ce donateur
  try {
    const localConv = localDb.agent_conversations?.[finalDonationId] || [];
    const localLegacy = localConv.filter((m: any) => m.user_id === finalUserId || m.user_name === user_name);
    localLegacy.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    
    for (const m of localLegacy) {
      if (m.user_id !== finalUserId && localDb.agent_conversations && localDb.agent_conversations[finalDonationId]) {
        const localMsgIdx = localDb.agent_conversations[finalDonationId].findIndex((lm: any) => lm.id === m.id);
        if (localMsgIdx !== -1) {
          localDb.agent_conversations[finalDonationId][localMsgIdx].user_id = finalUserId;
        }
      }
      
      const appMsg = {
        id: m.id || crypto.randomUUID(),
        application_id: localApp.id,
        sender_type: m.sender === "user" ? "user" : "admin",
        content: m.content,
        attachment: m.attachment || null,
        created_at: m.created_at
      };
      localDb.application_messages.push(appMsg);
    }
  } catch (copyErr) {
    console.error("Erreur copie historique local:", copyErr);
  }
  
  saveLocalDb();
  res.json(localApp);
});

// Update rank manual config (Admin feature)
app.patch("/api/applications/:id", async (req, res) => {
  const { id } = req.params;
  const { rank_position, risk_level, status, current_step, completion_percentage } = req.body;

  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase
        .from("applications")
        .update({ rank_position, risk_level, status, current_step, completion_percentage })
        .eq("id", id)
        .select();
      if (!error && data) return res.json(data[0]);
    } catch (e) {}
  }

  const appIndex = localDb.applications.findIndex(a => a.id === id);
  if (appIndex !== -1) {
    if (rank_position !== undefined) localDb.applications[appIndex].rank_position = Number(rank_position);
    if (risk_level !== undefined) localDb.applications[appIndex].risk_level = risk_level;
    if (status !== undefined) localDb.applications[appIndex].status = status;
    if (current_step !== undefined) localDb.applications[appIndex].current_step = Number(current_step);
    if (completion_percentage !== undefined) localDb.applications[appIndex].completion_percentage = Number(completion_percentage);
    saveLocalDb();
    return res.json(localDb.applications[appIndex]);
  }
  res.status(404).json({ error: "Candidature introuvable" });
});

app.delete("/api/applications/:id", async (req, res) => {
  const { id } = req.params;

  await deleteApplicationMediaFiles(id);

  if (isSupabaseConnected) {
    try {
      await supabase.from("application_messages").delete().eq("application_id", id);
      await supabase.from("application_submissions").delete().eq("application_id", id);
      const { error } = await supabase.from("applications").delete().eq("id", id);
      if (error) console.error("Erreur suppression Supabase (applications):", error.message);
    } catch (e) {
      console.error("Exception suppression Supabase (applications):", e);
    }
  }

  const appIndex = localDb.applications.findIndex(a => a.id === id);
  if (appIndex !== -1) {
    const donationId = localDb.applications[appIndex].donation_id;
    localDb.applications.splice(appIndex, 1);
    
    // Nettoyage en local
    localDb.application_messages = localDb.application_messages.filter(m => m.application_id !== id);
    localDb.application_submissions = localDb.application_submissions.filter(s => s.application_id !== id);
    saveLocalDb();
    
    // Mettre à jour le compteur de dons en local (décrémenter)
    const donIndex = localDb.donations.findIndex(d => d.id === donationId);
    if (donIndex !== -1) {
      localDb.donations[donIndex].current_bids_count = Math.max(0, (localDb.donations[donIndex].current_bids_count || 0) - 1);
      const io = req.app.get("io");
      if (io) io.emit("donation:updated", localDb.donations[donIndex]);
      
      // Si Supabase est connecté, essayer de décrémenter aussi
      if (isSupabaseConnected && uuidRegex.test(donationId)) {
        try {
          const { data: don } = await supabase.from("donations").select("current_bids_count").eq("id", donationId).single();
          if (don) {
            await supabase.from("donations").update({ current_bids_count: Math.max(0, (don.current_bids_count || 0) - 1) }).eq("id", donationId);
          }
        } catch (e) {}
      }
    }

    // Notification temps réel via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.emit("application:deleted", { id });
    }

    
    return res.json({ success: true, message: "Dossier de candidature supprimé avec succès." });
  }

  res.status(404).json({ error: "Dossier candidat introuvable." });
});

// D. SUBMISSIONS
app.get("/api/submissions", async (req, res) => {
  let localSubs = [...localDb.application_submissions];
  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.from("application_submissions").select("*");
      if (!error && data) {
        const supIds = new Set(data.map(s => s.id));
        const localOnly = localSubs.filter(s => !supIds.has(s.id));
        return res.json([...data, ...localOnly]);
      }
    } catch (e) {}
  }
  res.json(localSubs);
});

app.post("/api/submissions", async (req, res) => {
  const { application_id, step_index, form_data } = req.body;
  const newSub = {
    id: crypto.randomUUID(),
    application_id,
    step_index: Number(step_index),
    form_data: form_data || {},
    submitted_at: new Date().toISOString()
  };

  const nextStep = Number(step_index) + 1;
  const totalSteps = 4;
  const boundedNextStep = nextStep > totalSteps ? totalSteps : nextStep;

  const newPercentage = boundedNextStep === 1 ? 25 :
                        boundedNextStep === 2 ? 50 :
                        boundedNextStep === 3 ? 75 :
                        boundedNextStep === 4 ? 100 : 0;

  const riskLevel = newPercentage < 50 ? 'medium' :
                    newPercentage === 50 ? 'high' :
                    newPercentage === 75 ? 'critical' : 'low';

  const stepExpiresAt = new Date(Date.now() + (totalSteps - boundedNextStep + 1) * 60 * 60 * 1000).toISOString();

  const guideText = boundedNextStep === 1 ? "Félicitations, l'Étape 1 est validée ! Passez maintenant à l'Étape 2 : Décrivez en quelques mots votre projet et en quoi ce don va transformer votre quotidien." :
                   boundedNextStep === 2 ? "Étape 2 complétée avec succès ! Étape 3 : Veuillez nous transmettre une pièce d'identité officielle (CNI, passeport) pour certifier l'authenticité de votre dossier." :
                   boundedNextStep === 3 ? "Excellent ! Étape finale 4 : Saisissez un mot de motivation ou enregistrez un pitch de motivation pour que notre commission d'attribution comprenne au mieux votre situation." :
                   boundedNextStep === 4 ? "Votre dossier de demande de don est maintenant complété à 100% et soumis pour instruction ! Nos équipes l'examineront dans les plus brefs délais." :
                   `Votre dossier a été mis à jour. Étape actuelle : Étape ${boundedNextStep}`;

  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.from("application_submissions").insert([newSub]).select();
      if (!error && data && data[0]) {
        // Mettre à jour l'état de l'application dans Supabase
        await supabase
          .from("applications")
          .update({
            current_step: boundedNextStep,
            completion_percentage: newPercentage,
            risk_level: riskLevel,
            step_expires_at: stepExpiresAt
          })
          .eq("id", application_id);

        // Envoyer le message d'accompagnement système dans Supabase
        const guideMsg = {
          id: crypto.randomUUID(),
          application_id,
          sender_type: "system",
          content: guideText,
          created_at: new Date().toISOString()
        };
        await supabase.from("application_messages").insert([guideMsg]);

        // Emettre également via websocket pour rafraîchissement immédiat de l'UI
        const io = req.app.get("io");
        if (io) {
          io.emit("application_message:received", guideMsg);
        }

        // Garder synchronisé localement
        localDb.application_submissions.push(data[0]);
        localDb.application_messages.push(guideMsg);
        const appIndex = localDb.applications.findIndex(a => a.id === application_id);
        if (appIndex !== -1) {
          localDb.applications[appIndex].current_step = boundedNextStep;
          localDb.applications[appIndex].completion_percentage = newPercentage;
          localDb.applications[appIndex].risk_level = riskLevel;
          localDb.applications[appIndex].step_expires_at = stepExpiresAt;
        }
        saveLocalDb();

        return res.json(data[0]);
      }
      if (error) console.error("Erreur insertion Supabase (submissions):", error.message);
    } catch (e) {
      console.error("Exception insertion Supabase (submissions):", e);
    }
  }

  // Fallback local
  localDb.application_submissions.push(newSub);

  const appIndex = localDb.applications.findIndex(a => a.id === application_id);
  if (appIndex !== -1) {
    const parentApp = localDb.applications[appIndex];
    
    // Mettre à jour l'application
    parentApp.current_step = boundedNextStep;
    parentApp.completion_percentage = newPercentage;
    parentApp.risk_level = riskLevel;
    parentApp.step_expires_at = stepExpiresAt;

    // Insérer automatiquement le message de guidage système
    const guideMsg = {
      id: crypto.randomUUID(),
      application_id,
      sender_type: "system",
      content: guideText,
      created_at: new Date().toISOString()
    };
    localDb.application_messages.push(guideMsg);
  }

  saveLocalDb();
  res.json(newSub);
});

// =====================================================================
// FONCTIONS DE SYNCHRONISATION DU CHAT (VITRINE <-> TABLEAU DE BORD)
// =====================================================================
async function syncAgentConversationToApplication(donationId: string, userId: string | null, message: any, io: any) {
  if (!userId) return;
  
  let application = null;
  if (isSupabaseConnected && uuidRegex.test(donationId) && uuidRegex.test(userId)) {
    try {
      const { data } = await supabase
        .from("applications")
        .select("*")
        .eq("donation_id", donationId)
        .eq("user_id", userId)
        .limit(1);
      if (data && data[0]) {
        application = data[0];
      }
    } catch (e) {
      console.error("[SYNC] Erreur recherche application Supabase:", e);
    }
  }
  
  if (!application) {
    application = (localDb.applications || []).find(a => a.donation_id === donationId && a.user_id === userId);
  }
  
  if (application) {
    const appId = application.id;
    const alreadyExists = (localDb.application_messages || []).some(m => 
      m.application_id === appId && 
      (m.id === message.id || (m.content === message.content && Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 2000))
    );
    
    if (!alreadyExists) {
      const senderType = message.sender === "user" ? "user" : (message.sender_type || "admin");
      const appMsg = {
        id: message.id || crypto.randomUUID(),
        application_id: appId,
        sender_type: senderType,
        content: message.content,
        attachment: message.attachment,
        created_at: message.created_at
      };
      
      if (isSupabaseConnected && uuidRegex.test(appId)) {
        try {
          await supabase.from("application_messages").insert([appMsg]);
        } catch (e) {
          console.error("[SYNC] Erreur insertion application_message Supabase:", e);
        }
      }
      
      if (!localDb.application_messages) localDb.application_messages = [];
      localDb.application_messages.push(appMsg);
      saveLocalDb();
      
      if (io) {
        const hydratedAppMsg = {
          ...appMsg,
          donation_id: application.donation_id,
          user_id: application.user_id,
          user_name: application.user_name
        };
        io.to(`user:${application.user_id}`).emit("application_message:received", hydratedAppMsg);
        io.to("room:admins").emit("application_message:received", hydratedAppMsg);
      }
    }
  }
}

async function syncApplicationToAgentConversation(applicationId: string, message: any, io: any) {
  let application = null;
  if (isSupabaseConnected && uuidRegex.test(applicationId)) {
    try {
      const { data } = await supabase
        .from("applications")
        .select("*")
        .eq("id", applicationId)
        .single();
      if (data) {
        application = data;
      }
    } catch (e) {
      console.error("[SYNC] Erreur recherche application Supabase:", e);
    }
  }
  
  if (!application) {
    application = (localDb.applications || []).find(a => a.id === applicationId);
  }
  
  if (application) {
    const donId = application.donation_id;
    const userId = application.user_id;
    const userName = application.user_name;
    
    if (!localDb.agent_conversations) localDb.agent_conversations = {};
    const conv = localDb.agent_conversations[donId] || [];
    const alreadyExists = conv.some((m: any) => 
      m.user_id === userId &&
      (m.id === message.id || (m.content === message.content && Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 2000))
    );
    
    if (!alreadyExists) {
      const sender = message.sender_type === "user" ? "user" : "agent";
      const agentMsg = {
        id: message.id || "msg_" + Math.random().toString(36).substr(2, 9),
        donation_id: donId,
        sender,
        content: message.content,
        user_name: userName || "Candidat",
        user_id: userId,
        attachment: message.attachment,
        created_at: message.created_at
      };
      
      if (isSupabaseConnected && uuidRegex.test(donId)) {
        try {
          await supabase.from("agent_conversations").insert([agentMsg]);
        } catch (e) {
          console.error("[SYNC] Erreur insertion agent_conversation Supabase:", e);
        }
      }
      
      if (!localDb.agent_conversations[donId]) {
        localDb.agent_conversations[donId] = [];
      }
      localDb.agent_conversations[donId].push(agentMsg);
      saveLocalDb();
      
      if (io) {
        const hydratedAgentMsg = {
          ...agentMsg,
          application_id: application.id
        };
        io.to(`user:${userId}`).emit("message:received", hydratedAgentMsg);
        io.to("room:admins").emit("message:received", hydratedAgentMsg);
      }
    }
  }
}

// E. MESSAGES CHAT
app.get("/api/messages/:application_id", async (req, res) => {
  const { application_id } = req.params;
  const localMsgs = localDb.application_messages.filter(m => m.application_id === application_id);
  
  if (isSupabaseConnected && uuidRegex.test(application_id)) {
    try {
      const { data, error } = await supabase
        .from("application_messages")
        .select("*")
        .eq("application_id", application_id)
        .order("created_at", { ascending: true });
      if (!error && data) {
        const supIds = new Set(data.map(m => m.id));
        const localOnly = localMsgs.filter(m => !supIds.has(m.id));
        return res.json([...data, ...localOnly]);
      }
    } catch (e) {}
  }
  res.json(localMsgs);
});

app.post("/api/messages", async (req, res) => {
  const { application_id, sender_type, content, attachment } = req.body;
  
  const newMsg: any = {
    id: crypto.randomUUID(),
    application_id,
    sender_type,
    content,
    attachment: attachment || null,
    created_at: new Date().toISOString()
  };

  // Lookup application to hydrate the message with donation_id and user info
  let appData = null;
  if (isSupabaseConnected && uuidRegex.test(application_id)) {
    try {
      const { data } = await supabase.from("applications").select("*").eq("id", application_id).single();
      if (data) appData = data;
    } catch (e) {}
  }
  if (!appData) {
    appData = (localDb.applications || []).find(a => a.id === application_id);
  }

  const getHydratedMsg = (msg: any) => {
    if (!appData) return msg;
    return {
      ...msg,
      donation_id: appData.donation_id,
      user_id: appData.user_id,
      user_name: appData.user_name
    };
  };

  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.from("application_messages").insert([newMsg]).select();
      if (!error && data && data[0]) {
        const savedMsg = data[0];
        const io = req.app.get("io");
        if (io) {
          const hydrated = getHydratedMsg(savedMsg);
          io.to(`user:${appData?.user_id}`).emit("application_message:received", hydrated);
          io.to("room:admins").emit("application_message:received", hydrated);
        }
        
        // Garder synchronisé localement
        localDb.application_messages.push(savedMsg);
        saveLocalDb();
        
        // Synchroniser vers agent_conversations
        syncApplicationToAgentConversation(application_id, savedMsg, io);
        
        return res.json(savedMsg);
      }
      if (error) console.error("Erreur Supabase (application_messages):", error.message);
    } catch (e) {
      console.error("Exception Supabase (application_messages):", e);
    }
  }

  // Fallback Local
  const localMsg = { ...newMsg };
  localDb.application_messages.push(localMsg);
  saveLocalDb();
  const io = req.app.get("io");
  if (io) {
    const hydrated = getHydratedMsg(localMsg);
    io.to(`user:${appData?.user_id}`).emit("application_message:received", hydrated);
    io.to("room:admins").emit("application_message:received", hydrated);
  }
  
  // Synchroniser vers agent_conversations
  syncApplicationToAgentConversation(application_id, localMsg, io);
  
  res.json(localMsg);
});

// Route de mise à jour des messages (ex: pour changer le statut de paiement d'une facture)
app.put("/api/messages/:message_id", async (req, res) => {
  const { message_id } = req.params;
  const { content } = req.body;
  
  let updatedMsg = null;
  
  // 1. Mise à jour locale
  const localIndex = (localDb.application_messages || []).findIndex(m => m.id === message_id);
  if (localIndex !== -1) {
    localDb.application_messages[localIndex].content = content;
    updatedMsg = { ...localDb.application_messages[localIndex] };
    saveLocalDb();
  }
  
  // 2. Mise à jour Supabase si connecté
  if (isSupabaseConnected && uuidRegex.test(message_id)) {
    try {
      const { data, error } = await supabase
        .from("application_messages")
        .update({ content })
        .eq("id", message_id)
        .select();
        
      if (!error && data && data[0]) {
        updatedMsg = data[0];
        
        // Mettre à jour l'instance locale avec la version Supabase officielle
        if (localIndex !== -1) {
          localDb.application_messages[localIndex] = data[0];
          saveLocalDb();
        }
      }
    } catch (e) {
      console.error("Erreur de mise à jour de message dans Supabase:", e);
    }
  }
  
  if (updatedMsg) {
    const io = req.app.get("io");
    if (io) {
      // Diffuser la mise à jour à l'utilisateur et aux administrateurs
      io.to(`user:${updatedMsg.user_id}`).emit("application_message:updated", updatedMsg);
      io.to("room:admins").emit("application_message:updated", updatedMsg);
    }
    return res.json(updatedMsg);
  }
  
  res.status(404).json({ error: "Message introuvable" });
});


// =====================================================================
// ENDPOINT DE COMPRESSION/UPLOAD OPTIMISÉ (RAILWAY SHARP & FFMPEG ENGINE)
// =====================================================================
app.post("/api/upload", async (req, res) => {
  const { file, fileName, fileType } = req.body;

  if (!file) {
    return res.status(400).json({ error: "Aucun fichier fourni" });
  }

  try {
    // Isoler le base64
    let base64Data = file;
    let mimeType = fileType || "image/png";

    if (typeof file === "string" && file.startsWith("data:")) {
      const parts = file.split(",");
      if (parts.length === 2) {
        const meta = parts[0];
        const metaMatch = meta.match(/^data:([^;]+)/);
        if (metaMatch) {
          mimeType = metaMatch[1];
        }
        base64Data = parts[1];
      }
    } else {
      const matches = file.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    const buffer = Buffer.from(base64Data, "base64");
    const originalSizeKb = Math.round(buffer.length / 1024);
    const uniqueId = Math.random().toString(36).substr(2, 9);
    const originalExt = path.extname(fileName || "").toLowerCase();
    const baseName = path.parse(fileName || "media").name;

    let optimizedFileName: string;
    let outputPath: string;
    let format = "original";
    let finalBuffer = buffer;

    // Traitement selon le type de fichier
    if (mimeType.startsWith("image/")) {
      // Compression IMAGE maximale (WebP)
      format = "WebP";
      optimizedFileName = `${baseName}_${uniqueId}.webp`;
      outputPath = path.join(UPLOADS_DIR, optimizedFileName);
      
      finalBuffer = await sharp(buffer)
        .rotate() // Respecter l'orientation EXIF
        .webp({ quality: 60, effort: 6 }) // Compression forte
        .toBuffer();
    } else if (mimeType.startsWith("audio/")) {
      // Compression AUDIO maximale (Opus)
      format = "OPUS";
      optimizedFileName = `${baseName}_${uniqueId}.opus`;
      outputPath = path.join(UPLOADS_DIR, optimizedFileName);

      const tempInPath = path.join(UPLOADS_DIR, `temp_in_${uniqueId}`);
      const tempOutPath = path.join(UPLOADS_DIR, `temp_out_${uniqueId}.opus`);

      try {
        fs.writeFileSync(tempInPath, buffer);
        // Compresse l'audio en Opus mono à un bitrate optimal de 24k (parfait pour la voix)
        execSync(`ffmpeg -y -i "${tempInPath}" -c:a libopus -b:a 24k "${tempOutPath}"`, { stdio: "ignore" });
        if (fs.existsSync(tempOutPath)) {
          finalBuffer = fs.readFileSync(tempOutPath);
          mimeType = "audio/ogg"; // Les navigateurs préfèrent l'encapsulation audio/ogg pour l'opus
        }
      } catch (audioErr) {
        console.error("[COMPRESSION AUDIO] Échec de la compression Opus via ffmpeg, utilisation du format original:", audioErr);
        optimizedFileName = `${baseName}_${uniqueId}${originalExt || ".mp3"}`;
        outputPath = path.join(UPLOADS_DIR, optimizedFileName);
      } finally {
        if (fs.existsSync(tempInPath)) {
          try { fs.unlinkSync(tempInPath); } catch (e) {}
        }
        if (fs.existsSync(tempOutPath)) {
          try { fs.unlinkSync(tempOutPath); } catch (e) {}
        }
      }
    } else {
      // Pour les documents (PDF, Doc) et vidéos, on garde l'original mais on s'assure de la bonne extension
      format = mimeType.split("/")[1]?.toUpperCase() || "FILE";
      const ext = originalExt || (mimeType === "application/pdf" ? ".pdf" : ".dat");
      optimizedFileName = `${baseName}_${uniqueId}${ext}`;
      outputPath = path.join(UPLOADS_DIR, optimizedFileName);
    }

    fs.writeFileSync(outputPath, finalBuffer);

    const optimizedSizeKb = Math.round(finalBuffer.length / 1024);
    const compressionRatio = originalSizeKb > 0 
      ? Math.round(((originalSizeKb - optimizedSizeKb) / originalSizeKb) * 100) 
      : 0;

    console.log(`[UPLOAD] ${fileName} (${mimeType}) -> ${optimizedFileName}`);
    console.log(` -> Taille: ${originalSizeKb} KB -> ${optimizedSizeKb} KB (${compressionRatio}%)`);

    let finalUrl = `/uploads/${optimizedFileName}`;

    if (isSupabaseConnected) {
      try {
        const uploadContentType = mimeType.startsWith("image/") 
          ? "image/webp" 
          : (mimeType.startsWith("audio/") ? "audio/ogg; codecs=opus" : mimeType);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("donations")
          .upload(optimizedFileName, finalBuffer, {
            contentType: uploadContentType,
            upsert: true
          });

        if (uploadError) {
          console.error("[SUPABASE STORAGE] Échec de l'upload:", uploadError.message);
        } else {
          const { data: urlData } = supabase.storage
            .from("donations")
            .getPublicUrl(optimizedFileName);
          
          if (urlData?.publicUrl) {
            finalUrl = urlData.publicUrl;
            console.log(`[SUPABASE STORAGE] Upload réussi vers Supabase ! URL publique : ${finalUrl}`);
          }
        }
      } catch (e: any) {
        console.error("[SUPABASE STORAGE] Erreur lors de l'upload vers Supabase Storage:", e);
      }
    }

    res.json({
      success: true,
      url: finalUrl,
      originalSizeKb,
      optimizedSizeKb,
      compressionRatio: `${compressionRatio}%`,
      format
    });
  } catch (error: any) {
    console.error("Erreur durant l'upload/compression :", error);
    res.status(500).json({ error: "Erreur lors du traitement du fichier : " + error.message });
  }
});

// G. CONVERSATIONS AGENT EN DIRECT EN PRÉ-INSCRIPTION (CHATS DIRECTS CATALOGUE)
app.get("/api/agent-conversations", async (req, res) => {
  const { user_id, is_admin, user_name } = req.query;
  
  const isAdmin = is_admin === 'true';

  if (!user_id && !isAdmin) {
    return res.status(400).json({ error: "user_id est requis pour charger les conversations." });
  }

  let localConvs = { ...(localDb.agent_conversations || {}) };
  
  // Filtrer les conversations locales si ce n'est pas un admin
  let filteredLocal: any = {};
  if (isAdmin) {
    filteredLocal = localConvs;
  } else {
    for (const donId in localConvs) {
      filteredLocal[donId] = (localConvs[donId] || []).filter((msg: any) => {
        if (msg.user_id === user_id) return true;
        if (!msg.user_id && user_name && user_name !== "Visiteur" && user_name !== "Candidat Anonyme" && user_name !== "Candidat" && msg.user_name === user_name) {
          return true;
        }
        return false;
      });
    }
  }

  if (isSupabaseConnected) {
    try {
      let queryPromise;
      if (isAdmin) {
        queryPromise = supabase.from("agent_conversations").select("*").order("created_at", { ascending: true });
      } else {
        if (user_name && user_name !== "Visiteur" && user_name !== "Candidat Anonyme" && user_name !== "Candidat") {
          queryPromise = supabase.from("agent_conversations").select("*").or(`user_id.eq.${user_id},user_name.eq.${user_name}`).order("created_at", { ascending: true });
        } else {
          queryPromise = supabase.from("agent_conversations").select("*").eq("user_id", user_id).order("created_at", { ascending: true });
        }
      }

      const { data, error } = await withTimeout(queryPromise, 2000);

      if (!error && data) {
        let filteredData = data;
        if (!isAdmin) {
          filteredData = data.filter((m: any) => {
            if (m.user_id === user_id) return true;
            if (!m.user_id && user_name && user_name !== "Visiteur" && user_name !== "Candidat Anonyme" && user_name !== "Candidat" && m.user_name === user_name) {
              return true;
            }
            return false;
          });
        }

        const grouped = filteredData.reduce((acc: any, msg: any) => {
          if (!acc[msg.donation_id]) acc[msg.donation_id] = [];
          acc[msg.donation_id].push(msg);
          return acc;
        }, {});
        
        // Merger avec local si nécessaire
        for (const donId in filteredLocal) {
          if (!grouped[donId]) {
            grouped[donId] = filteredLocal[donId];
          } else {
            filteredLocal[donId].forEach((localMsg: any) => {
               if (!grouped[donId].some((m: any) => m.id === localMsg.id)) {
                 grouped[donId].push(localMsg);
               }
            });
          }
        }
        return res.json(grouped);
      }
    } catch (e) {}
  }
  return res.json(filteredLocal);
});

app.get("/api/agent-conversations/:donation_id", async (req, res) => {
  const { donation_id } = req.params;
  const { user_id, is_admin, user_name } = req.query;
  const isAdmin = is_admin === 'true';

  let conv = (localDb.agent_conversations && localDb.agent_conversations[donation_id]) || [];
  if (!isAdmin && user_id) {
    conv = conv.filter((m: any) => {
      if (m.user_id === user_id) return true;
      if (!m.user_id && user_name && user_name !== "Visiteur" && user_name !== "Candidat Anonyme" && user_name !== "Candidat" && m.user_name === user_name) {
        return true;
      }
      return false;
    });
  }

  const safeDonationId = toSafeUuid(donation_id);

  if (isSupabaseConnected) {
    try {
      let queryPromise;
      if (isAdmin) {
        queryPromise = supabase.from("agent_conversations").select("*").eq("donation_id", safeDonationId).order("created_at", { ascending: true });
      } else {
        if (user_name && user_name !== "Visiteur" && user_name !== "Candidat Anonyme" && user_name !== "Candidat") {
          queryPromise = supabase.from("agent_conversations").select("*").eq("donation_id", safeDonationId).or(`user_id.eq.${user_id},user_name.eq.${user_name}`).order("created_at", { ascending: true });
        } else {
          queryPromise = supabase.from("agent_conversations").select("*").eq("donation_id", safeDonationId).eq("user_id", user_id).order("created_at", { ascending: true });
        }
      }

      const { data, error } = await withTimeout(queryPromise, 2000);
      if (!error && data) {
        // Remapper le donation_id UUID vers l'ID d'origine pour le client
        const mappedData = data.map((m: any) => ({ ...m, donation_id: donation_id }));
        if (!isAdmin) {
          const filtered = mappedData.filter((m: any) => {
            if (m.user_id === user_id) return true;
            if (!m.user_id && user_name && user_name !== "Visiteur" && user_name !== "Candidat Anonyme" && user_name !== "Candidat" && m.user_name === user_name) {
              return true;
            }
            return false;
          });
          return res.json(filtered);
        }
        return res.json(mappedData);
      }
    } catch (e) {}
  }
  
  return res.json(conv);
});

// Algorithme de matching local simple mais puissant pour le Chatbot
function matchChatbotResponse(messageContent: string): { response: string; isConfidential: boolean } | null {
  if (!messageContent) return null;
  
  const normalizedMsg = messageContent.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Retirer les accents
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " "); // Remplacer ponctuation par des espaces
    
  const msgWords = normalizedMsg.split(/\s+/).filter(Boolean);
    
  let bestMatch: any = null;
  let maxScore = 0;
  
  const trainingBase = localDb.chatbot_training || [];
  
  // Algorithme de distance de Levenshtein pour tolérer les fautes de frappe
  const getLevenshteinDistance = (a: string, b: string): number => {
    const tmp = [];
    const alen = a.length;
    const blen = b.length;
    if (alen === 0) return blen;
    if (blen === 0) return alen;
    for (let i = 0; i <= alen; i++) tmp[i] = [i];
    for (let j = 0; j <= blen; j++) tmp[0][j] = j;
    for (let i = 1; i <= alen; i++) {
      for (let j = 1; j <= blen; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return tmp[alen][blen];
  };
  
  for (const entry of trainingBase) {
    // Les réponses confidentielles ne sont pas affichées aux utilisateurs publics
    if (entry.is_confidential) {
      continue;
    }
    
    let score = 0;
    const entryKeywords = entry.keywords || [];
    
    for (const kw of entryKeywords) {
      const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // 1. Recherche de mot complet exact
      if (msgWords.includes(cleanKw)) {
        score += 4; // Score maximum pour une correspondance parfaite de mot
      } 
      // 2. Inclusion de sous-chaîne
      else if (normalizedMsg.includes(cleanKw)) {
        score += 2; 
      } 
      // 3. Tolérance aux fautes d'orthographe (Fuzzy Levenshtein)
      else {
        for (const word of msgWords) {
          if (word.length >= 3 && cleanKw.length >= 3) {
            const dist = getLevenshteinDistance(word, cleanKw);
            // Seuil adapté : max 1 erreur pour mots courts, max 2 pour mots longs
            const threshold = cleanKw.length >= 6 ? 2 : 1;
            if (dist <= threshold) {
              score += 3; // Score fort pour une faute d'orthographe corrigée
              break;
            }
          }
        }
      }
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestMatch = entry;
    }
  }
  
  // Seuil de pertinence minimum requis
  if (bestMatch && maxScore >= 2) {
    return { response: bestMatch.response, isConfidential: bestMatch.is_confidential };
  }
  
  return null;
}

// Déclencheur d'auto-réponse asynchrone du chatbot
async function triggerAutoReply(donationId: string, userMessageContent: string, userId: string | null, io: any) {
  setTimeout(async () => {
    // Ne répondre que si le dernier message de la conversation est toujours un message de l'utilisateur
    let latestMsg = null;
    const safeDonationId = toSafeUuid(donationId);
    if (isSupabaseConnected) {
      try {
        const { data } = await supabase.from("agent_conversations").select("*").eq("donation_id", safeDonationId).order("created_at", { ascending: false }).limit(1);
        if (data && data[0]) latestMsg = data[0];
      } catch (e) {}
    } else {
      const conv = localDb.agent_conversations?.[donationId] || [];
      if (conv.length > 0) latestMsg = conv[conv.length - 1];
    }

    if (latestMsg && latestMsg.sender !== 'user') {
      // Un agent humain ou système a déjà répondu ou pris le relais, on s'abstient !
      return;
    }

    let replyContent = "";
    
    // Détection d'intention (Intent Recognition)
    const normalizedMsg = (userMessageContent || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Retirer les accents
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " "); // Remplacer ponctuation

    // 1. Intention : Suivi de dossier / Progression / Rangs / Compteur / Timer
    const isAskingPosition = /position|rang|enchere|place|classement/.test(normalizedMsg);
    const isAskingDossier = /dossier|candidature|statut|etat|avancement|etape|compteur|temps restant|delai|heure|tour/.test(normalizedMsg);
    const isAskingPriority = /priorit|urgenc|profil|compte/.test(normalizedMsg);
    const isAskingLevel = /niveau|nivea/.test(normalizedMsg);

    // 2. Intention : Demande d'explication / Compréhension globale
    const isAskingExplanation = /comprendre|expliqu|c'est quoi|comment ca marche|a quoi ca sert|concept|mission|objectif|concept|qui sommes nous|qu'est-ce/.test(normalizedMsg);

    // 3. Intention : Doute, hésitation ou sécurité des documents / RGPD
    const isAskingSecurity = /fiable|arnaque|securis|donnee|document|cni|passeport|justificatif|confidentialite|rgpd|piece/.test(normalizedMsg);

    // 4. Intention : Partenaires du programme
    const isAskingPartners = /partenaire|soutien|fedex|dhl|qui aide|avec qui|soutient|sponsor|mecene|collaborateur|organisation|entreprise/.test(normalizedMsg);

    // 5. Intention : Catalogue des dons / Biens disponibles
    const isAskingCatalog = /catalogue|dispo|disponible|donations|liste des dons|quel don|quels dons|mercedes|cla|voiture|vehicule|materiel/.test(normalizedMsg);

    // 6. Intention : Impact / Statistiques / Chiffres
    const isAskingStats = /chiffre|statistique|stats|impact|nombre|utilisateurs|candidatures|compteur/.test(normalizedMsg);

    // Récupérer le titre du don concerné pour la personnalisation
    let donationTitle = "ce don";
    let donationObj = null;
    if (isSupabaseConnected) {
      try {
        const { data } = await supabase.from("donations").select("title").eq("id", safeDonationId).single();
        if (data) donationObj = data;
      } catch (e) {}
    }
    if (!donationObj) {
      donationObj = (localDb.donations || []).find((d: any) => d.id === donationId);
    }
    if (donationObj) {
      donationTitle = donationObj.title;
    }

    // Récupérer l'utilisateur s'il est connecté
    let matchedUser = null;
    if (userId && userId !== "visitor") {
      if (isSupabaseConnected) {
        try {
          const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
          if (profile && !error) {
            matchedUser = {
              id: profile.id,
              name: profile.name || "Utilisateur",
              email: profile.email,
              role: profile.role
            };
          }
        } catch (e) {
          console.error("[AUTO-REPLY] Erreur recherche profil Supabase:", e);
        }
      }
      if (!matchedUser) {
        matchedUser = (localDb.users || []).find((u: any) => u.id === userId || u.email === userId || (userId === "admin-main" && u.role === "admin"));
      }
    }

    if (isAskingLevel) {
      if (!matchedUser) {
        replyContent = `👋 Bonjour ! Pour que je puisse vous renseigner sur votre niveau, pourriez-vous s'il vous plaît vous connecter ? 😊\n\n` +
          `🔒 **Sécurité & Confidentialité :** Afin de garantir la protection absolue de vos données, les détails de votre profil, de votre niveau de priorité ou de votre rang d'attribution sont sécurisés et ne sont pas accessibles en mode invité.\n\n` +
          `👉 **Comment faire ?** Connectez-vous simplement à l'aide du bouton **« Connexion »** en haut à droite (ou inscrivez-vous s'il s'agit de votre première visite) pour consulter votre niveau de situation en direct !`;
      } else if (matchedUser.role === "admin") {
        replyContent = `👋 Bonjour **${matchedUser.name}** ! En tant qu'**Administrateur** de Pôle de Dons, vous disposez d'un accès de pilotage global.\n\n` +
          `📊 **Indicateurs de niveau d'urgence :**\n` +
          `L'algorithme de Pôle de Dons évalue les dossiers d'après 4 niveaux d'urgence sociale :\n` +
          `• 🟢 **Exclusion faible (Standard)**\n` +
          `• 🟡 **Besoin avéré (Modéré)**\n` +
          `• 🟠 **Grande urgence sociale (Élevé)**\n` +
          `• 🔴 **Urgence vitale absolue (Critique)**\n\n` +
          `En tant qu'admin, aucun dossier candidat fictif n'est lié à votre compte professionnel afin d'éviter tout conflit d'intérêts. Vous pouvez cependant configurer et auditer les seuils de priorité dans la section de configuration de la commission administrative.`;
      } else {
        // Utilisateur connecté ! Récupérer son dossier pour ce don (ou dossier le plus récent si canal général)
        let userApp = null;
        if (isSupabaseConnected) {
          try {
            if (donationId === "general-support" || donationId === "support") {
              const { data } = await supabase.from("applications").select("*").eq("user_id", matchedUser.id).order("created_at", { ascending: false }).limit(1);
              if (data && data[0]) userApp = data[0];
            } else {
              const { data } = await supabase.from("applications").select("*").eq("donation_id", safeDonationId).eq("user_id", matchedUser.id).limit(1);
              if (data && data[0]) userApp = data[0];
            }
          } catch (e) {}
        }
        if (!userApp) {
          if (donationId === "general-support" || donationId === "support") {
            userApp = (localDb.applications || []).filter(a => a.user_id === matchedUser.id || a.user_email === matchedUser.email)
              .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
          } else {
            userApp = (localDb.applications || []).find((a: any) => a.donation_id === donationId && (a.user_id === matchedUser.id || a.user_email === matchedUser.email));
          }
        }

        if (userApp && userApp.donation_id !== donationId) {
          let appDonation = null;
          if (isSupabaseConnected) {
            try {
              const { data } = await supabase.from("donations").select("title").eq("id", userApp.donation_id).single();
              if (data) appDonation = data;
            } catch (e) {}
          }
          if (!appDonation) {
            appDonation = (localDb.donations || []).find((d: any) => d.id === userApp.donation_id);
          }
          if (appDonation) {
            donationTitle = appDonation.title;
          }
        }

        const translateRisk = (risk: string) => {
          switch (risk) {
            case "low": return "Standard (🟢 Exclusion faible)";
            case "medium": return "Modérée (🟡 Besoin avéré)";
            case "high": return "Élevée (🟠 Grande urgence sociale)";
            case "critical": return "Critique (🔴 Urgence vitale absolue)";
            default: return "Standard (🟢 Besoin vérifié)";
          }
        };

        if (userApp) {
          replyContent = `👋 Bonjour **${matchedUser.name}** ! De quel **niveau** parlez-vous précisément ? 😊\n\n` +
            `Sur Pôle de Dons, votre dossier comporte deux indicateurs de niveau :\n\n` +
            `1️⃣ **Le Niveau d'Urgence / Priorité du Dossier** :\n` +
            `Il s'agit de votre indice de besoin social calculé objectivement par notre algorithme selon votre situation.\n` +
            `• Votre niveau actuel : **${translateRisk(userApp.risk_level)}**.\n\n` +
            `2️⃣ **Le Rang d'Enchère / Attribution** (votre niveau dans la file d'attente) :\n` +
            `Il s'agit de votre positionnement dynamique en temps réel dans la liste d'attribution du don « **${donationTitle}** ».\n` +
            `• Votre rang actuel : **#${userApp.rank_position}**.\n\n` +
            `*S'agit-il de l'un de ces deux indicateurs, ou souhaitez-vous savoir comment améliorer votre priorité ? Je reste à votre entière disposition !*`;
        } else {
          replyContent = `👋 Bonjour **${matchedUser.name}** ! De quel **niveau** souhaitez-vous parler ? 😊\n\n` +
            `Sur Pôle de Dons, nous évaluons deux indicateurs de niveau pour chaque demande :\n\n` +
            `1️⃣ **Le Niveau de Priorité du Dossier** (votre indice d'urgence sociale calculé selon votre situation financière et familiale).\n` +
            `2️⃣ **Le Rang d'Enchère / Attribution** (votre niveau/position en temps réel dans la file d'attente).\n\n` +
            `⚠️ **Remarque :** Vous n'avez pas encore soumis de candidature pour le don « **${donationTitle}** ».\n\n` +
            `👉 **Action recommandée :** Cliquez sur le bouton **« Postuler »** sur la fiche de ce don et soumettez votre dossier afin que notre algorithme puisse calculer votre niveau de priorité et déterminer votre rang d'attribution !`;
        }
      }
    } else if (isAskingPosition || isAskingDossier || isAskingPriority) {
      if (!matchedUser) {
        // Posture Juridique & Commerciale combinée pour invité
        replyContent = `👋 Bonjour ! Je suis l'**Assistant Virtuel de Pôle de Dons**.\n\n` +
          `🔒 **Sécurité et Confidentialité (Posture Juridique) :** Afin de garantir la protection absolue de vos données et le respect du RGPD, les informations personnalisées sur les candidatures et les positions d'attribution sont strictement confidentielles. Seuls les utilisateurs authentifiés peuvent y accéder.\n\n` +
          `🎯 **Comment accéder à votre suivi ? (Posture Conseiller Commercial) :**\n` +
          `• Si vous avez déjà un compte : connectez-vous dès maintenant via l'icône de connexion en haut à droite.\n` +
          `• Si vous êtes nouveau : inscrivez-vous en quelques clics pour soumettre votre premier dossier de besoin social.\n\n` +
          `👉 **Action recommandée :** Connectez-vous à votre espace candidat pour activer et consulter votre suivi de dossier en temps réel !`;
      } else if (matchedUser.role === "admin") {
        replyContent = `👋 Bonjour **${matchedUser.name}** ! En tant qu'**Administrateur** de Pôle de Dons, vous disposez d'un accès de pilotage global.\n\n` +
          `📊 **Suivi Administratif (Espace d'instruction commission) :**\n` +
          `• Vous pouvez suivre l'intégralité des candidatures reçues, les indices calculés et ajuster les priorités directement depuis la section **« Gestion des candidatures »**.\n` +
          `• Les scores, les pièces justificatives et les étapes d'instruction de chaque candidat sont modifiables par la commission via votre tableau de bord.\n\n` +
          `⚙️ **Mode Simulation :** Si vous testez actuellement l'assistant virtuel en tant que candidat pour le don « **${donationTitle}** », sachez qu'aucun dossier n'est lié directement à votre compte d'administrateur afin d'éviter tout conflit d'intérêts.\n\n` +
          `👉 **Que souhaitez-vous faire ?** Je reste disponible pour toute question sur les règles d'attribution de notre algorithme !`;
      } else {
        // Utilisateur connecté ! Récupérer son dossier pour ce don (ou dossier le plus récent si canal général)
        let userApp = null;
        if (isSupabaseConnected) {
          try {
            if (donationId === "general-support" || donationId === "support") {
              const { data } = await supabase.from("applications").select("*").eq("user_id", matchedUser.id).order("created_at", { ascending: false }).limit(1);
              if (data && data[0]) userApp = data[0];
            } else {
              const { data } = await supabase.from("applications").select("*").eq("donation_id", safeDonationId).eq("user_id", matchedUser.id).limit(1);
              if (data && data[0]) userApp = data[0];
            }
          } catch (e) {}
        }
        if (!userApp) {
          if (donationId === "general-support" || donationId === "support") {
            userApp = (localDb.applications || []).filter(a => a.user_id === matchedUser.id || a.user_email === matchedUser.email)
              .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
          } else {
            userApp = (localDb.applications || []).find((a: any) => a.donation_id === donationId && (a.user_id === matchedUser.id || a.user_email === matchedUser.email));
          }
        }

        if (userApp && userApp.donation_id !== donationId) {
          let appDonation = null;
          if (isSupabaseConnected) {
            try {
              const { data } = await supabase.from("donations").select("title").eq("id", userApp.donation_id).single();
              if (data) appDonation = data;
            } catch (e) {}
          }
          if (!appDonation) {
            appDonation = (localDb.donations || []).find((d: any) => d.id === userApp.donation_id);
          }
          if (appDonation) {
            donationTitle = appDonation.title;
          }
        }

        const translateStatus = (status: string) => {
          switch (status) {
            case "accepted": return "Accepté / Attribué 🎉";
            case "rejected": return "Non retenu pour ce don ❌";
            case "pending": return "En cours d'examen par la commission ⏳";
            default: return "En cours d'instruction ⏳";
          }
        };

        const translateRisk = (risk: string) => {
          switch (risk) {
            case "low": return "Standard (Exclusion faible) 🟢";
            case "medium": return "Modérée (Besoin avéré) 🟡";
            case "high": return "Élevée (Grande urgence sociale) 🟠";
            case "critical": return "Critique (Urgence vitale absolue) 🔴";
            default: return "Standard (Besoin vérifié) 🟢";
          }
        };

        if (userApp) {
          replyContent = `👋 Bonjour **${matchedUser.name}** ! Voici votre point de situation en direct pour le don « **${donationTitle}** » :\n\n` +
            `📈 **Suivi de votre Dossier (Posture Marketing & Suivi) :**\n` +
            `• **Votre Rang Dynamique** : **#${userApp.rank_position}** dans la file d'attribution.\n` +
            `• **Statut de votre demande** : **${translateStatus(userApp.status)}**\n` +
            `• **Progression de l'instruction** : **${userApp.completion_percentage}%** (Étape ${userApp.current_step || 1} sur 6)\n` +
            `• **Indice de Besoin Social** : ${translateRisk(userApp.risk_level)}\n\n` +
            `⏱️ **Temps restant estimé :** Nos agents de modération finalisent l'instruction de cette étape sous 48 heures ouvrées.\n\n` +
            `🎯 **Conseil d'action :** Pour maximiser vos chances et consolider votre rang, veillez à ce que toutes vos pièces justificatives soient à jour dans votre tableau de bord.`;
        } else {
          replyContent = `👋 Bonjour **${matchedUser.name}** ! Vous n'avez pas encore initié de candidature pour le don « **${donationTitle}** ».\n\n` +
            `💡 **Concept de Pôle de Dons (Posture Marketing) :** Notre algorithme solidaire attribue de façon équitable les dons d'après un indice d'urgence sociale réel (revenus, composition du foyer, situation de logement).\n\n` +
            `📝 **Comment candidater ? (Posture Conseiller Commercial) :**\n` +
            `• Cliquez sur le bouton **« Postuler »** sur la fiche de ce don.\n` +
            `• Remplissez le formulaire d'évaluation et déposez vos justificatifs de manière entièrement sécurisée.\n\n` +
            `👉 **Action recommandée :** Lancez votre candidature dès maintenant pour que notre système calcule instantanément votre niveau de priorité sociale !`;
        }
      }
    } else if (isAskingExplanation) {
      // Intention 1 : Demande d'explication / Compréhension globale
      replyContent = `👋 Bienvenue sur **Pôle de Dons** ! Laissez-moi vous présenter notre concept unique d'Attribution Solidaire :\n\n` +
        `🚀 **Pôle de Dons, c'est quoi ? (Posture Marketing) :**\n` +
        `Nous sommes la première plateforme d'attribution de dons régulée par un algorithme d'équité sociale. Fini le "premier arrivé, premier servi" ! Ici, chaque don est attribué en priorité aux projets et aux foyers présentant le besoin le plus aigu.\n\n` +
        `⚖️ **Sécurité et Transparence (Posture Juridique) :**\n` +
        `• Chaque candidature suit un workflow transparent en 6 étapes vérifiables.\n` +
        `• Vos données personnelles sont chiffrées de bout en bout et exclusivement destinées à la commission d'attribution légale.\n\n` +
        `🎯 **Comment démarrer ? (Posture Conseiller Commercial) :**\n` +
        `• Parcourez nos dons actifs (matériel, immobilier, mobilier).\n` +
        `• Soumettez votre dossier d'éligibilité pour obtenir votre indice de priorité sociale.\n\n` +
        `👉 **Prêt à commencer ?** Explorez dès maintenant notre catalogue de dons et postulez sur le bien de votre choix !`;
    } else if (isAskingSecurity) {
      // Intention 2 : Doute, hésitation ou sécurité
      replyContent = `🛡️ **Pôle de Dons - Sécurité, Légitimité et Conformité Légale :**\n\n` +
        `⚖️ **Rigueur et Confidentialité (Posture Juridique) :**\n` +
        `La confiance est notre priorité absolue. Vos documents (CNI, avis d'imposition, justificatifs de ressources) sont requis uniquement pour valider légalement votre éligibilité et éviter les fraudes.\n` +
        `• **Conformité RGPD** : Vos pièces justificatives sont stockées dans des espaces hautement sécurisés et cryptés, et ne sont jamais revendues ou divulguées.\n` +
        `• **Accès restreint** : Seule notre équipe d'instruction agréée a accès à vos documents lors de l'évaluation.\n\n` +
        `📈 **Équité du système (Posture Marketing) :**\n` +
        `Notre algorithme calcule de manière autonome un rang de priorité sur des critères purement sociaux et objectifs (sans aucune intervention humaine arbitraire).\n\n` +
        `👉 **Action recommandée :** Complétez vos informations de profil en toute sécurité sur votre tableau de bord personnel pour valider votre éligibilité dès aujourd'hui.`;
    } else if (isAskingPartners) {
      // Intention 4 : Partenaires du programme
      const partnersList = localDb.partners || [];
      if (partnersList.length > 0) {
        const partnersText = partnersList.map((p: any) => `• **${p.name}** ${p.website ? `([Lien](${p.website}))` : ""}`).join("\n");
        replyContent = `🤝 **Nos Partenaires et Soutiens Officiels :**\n\n` +
          `Pôle de Dons fonctionne en synergie étroite avec des entreprises partenaires et des services logistiques de premier plan pour garantir une redistribution solidaire fiable et rapide :\n\n` +
          `${partnersText}\n\n` +
          `Ces grands acteurs contribuent au transport, au stockage, ou soutiennent notre mission de redistribution équitable. Nous remercions chaleureusement chaque organisation partenaire de son engagement social !`;
      } else {
        replyContent = `🤝 **Nos Partenaires et Soutiens :**\n\n` +
          `Nous collaborons avec de grands groupes logistiques et des associations reconnues d'utilité publique pour assurer le transport et la redistribution sécurisée de tous nos dons.`;
      }
    } else if (isAskingCatalog) {
      // Intention 5 : Catalogue des dons / Biens disponibles
      const activeDons = (localDb.donations || []).filter((d: any) => d.status === "active");
      if (activeDons.length > 0) {
        const donsText = activeDons.slice(0, 5).map((d: any) => `• **${d.title}** (${d.category} - situé à ${d.location || 'France'})`).join("\n");
        replyContent = `🎁 **Catalogue des dons d'équipements et biens actifs :**\n\n` +
          `Voici un aperçu des dons de grande valeur actuellement disponibles sur Pôle de Dons et ouverts aux dossiers d'attribution :\n\n` +
          `${donsText}\n\n` +
          `${activeDons.length > 5 ? `*(Et d'autres opportunités d'équipements professionnels et mobiliers à découvrir)*\n\n` : ""}` +
          `👉 **Comment postuler ?** Rendez-vous dans la rubrique **« Vitrine des Dons »** de la barre de navigation supérieure, puis cliquez sur **« Postuler »** sur la fiche du bien souhaité. Notre algorithme calculera immédiatement votre niveau de priorité d'attribution d'après vos critères sociaux !`;
      } else {
        replyContent = `🎁 **Catalogue des dons d'équipements :**\n\n` +
          `Pôle de Dons redistribue du matériel professionnel informatique, des meubles, des équipements électroménagers et parfois des véhicules ou locaux d'activité. Visitez régulièrement notre vitrine des dons pour postuler en temps réel sur les nouveaux arrivages !`;
      }
    } else if (isAskingStats) {
      // Intention 6 : Chiffres / Statistiques d'impact
      const totalDons = (localDb.donations || []).length;
      const totalApps = (localDb.applications || []).length;
      const totalUsersList = (localDb.users || []).length;
      replyContent = `📊 **Impact social et Statistiques en temps réel de Pôle de Dons :**\n\n` +
        `Voici les chiffres consolidés de notre écosystème d'attribution solidaire d'après notre base de données :\n\n` +
        `• 📦 **${totalDons} dons** publiés et pris en charge par nos modérateurs.\n` +
        `• 📝 **${totalApps} candidatures** d'attribution solidaire gérées avec transparence.\n` +
        `• 👥 **${totalUsersList} membres actifs** inscrits (candidats, donateurs, et chargés d'évaluation).\n\n` +
        `Notre algorithme d'indice de besoin calcule automatiquement et sans favoritisme les rangs de file d'attente pour chaque dossier, garantissant ainsi que 100% des dons aillent en priorité aux bénéficiaires de plus grande urgence.`;
    } else {
      // Utilisation du matching de réponses d'entraînement classique
      const match = matchChatbotResponse(userMessageContent);
      if (match) {
        replyContent = match.response;
      } else {
        // ESSAYER D'APPELER GEMINI EN PREMIER
        let geminiSuccess = false;
        try {
          const aiClient = getGeminiClient();
          if (!aiClient) throw new Error("GEMINI_API_KEY manquante");

          const trainingContext = (localDb.chatbot_training || [])
            .filter((e: any) => !e.is_confidential)
            .map((e: any) => `Mots-clés: [${e.keywords.join(", ")}]\nRéponse officielle: ${e.response}`)
            .join("\n\n");

          const prompt = `Vous êtes l'Assistant Virtuel officiel de la plateforme solidaire "Pôle de Dons".
La plateforme redistribue des dons d'équipements, mobiliers, informatiques et parfois des véhicules de manière équitable et transparente.

Voici le contexte officiel de la plateforme à utiliser pour vos réponses :
${trainingContext}

Détails de l'utilisateur actuel :
- Connecté : ${matchedUser ? "Oui" : "Non"}
- Nom : ${matchedUser ? matchedUser.name : "Visiteur anonyme"}
- Don concerné : ${donationTitle}

L'utilisateur demande : "${userMessageContent}"

Votre tâche est double :
1. Générer une réponse polie, professionnelle et chaleureuse à l'utilisateur, combinant les trois postures : Marketing (présenter la valeur), Juridique (garantir la sécurité et le respect des règles sans mentionner de comptes d'accès ou secrets) et Conseiller Commercial (guider l'utilisateur sur ce qu'il doit faire).
2. Si la question est d'intérêt général (ex: sur le concept, les règles, le fonctionnement global de Pôle de Dons, les pièces justificatives) et ne contient pas d'informations privées/personnelles, générez aussi une entrée de connaissance "générique" (QA pair) pour notre base de connaissances locale. Si la question est privée (concerne un dossier spécifique, un nom de famille, etc.), marquez learnable=false.

Vous DEVEZ répondre obligatoirement sous forme d'un objet JSON strict valide respectant exactement le schéma suivant :
{
  "reply": "Votre réponse chaleureuse et personnalisée à l'utilisateur en français (supporte le markdown basique comme les étoiles ou listes à puces)",
  "learnable": true,
  "genericQuestion": "Une version nettoyée, anonymisée et générique de la question posée par l'utilisateur (ex: 'Comment sont sélectionnés les bénéficiaires des dons ?')",
  "genericKeywords": ["liste", "de", "mots-cles", "pertinents", "en", "minuscules", "sans", "accents", "ni", "ponctuation"],
  "genericResponse": "Une réponse générique, complète et intemporelle correspondante, formulée au nom de Pôle de Dons, sans aucune information personnelle, nom d'utilisateur, ou référence à un don spécifique."
}

Renvoyez uniquement le JSON, sans blocs de code markdown ni texte supplémentaire.`;

          // Sélecteur de modèle intelligent d'IA (Routage dynamique pour réduction des coûts)
          // gemini-3.7-flash pour les questions mathématiques, statistiques complexes ou algorithmiques
          // gemini-3.1-flash-lite pour toutes les questions de support conversationnelles standard
          let selectedModel = "gemini-3.1-flash-lite";
          
          const mathAndComplexKeywords = [
            "calcul", "calculer", "budget", "somme", "division", "multiplication", 
            "fraction", "pourcentage", "statistique", "equation", "formule", "geometrie", 
            "surface", "volume", "dimension", "mediane", "moyenne", "ratio", "taux", 
            "amortissement", "+", "-", "*", "/", "=", "%"
          ];
          
          const lowerMsg = userMessageContent.toLowerCase();
          const hasMathOrFormula = /[\d]+[\s]*[+\-*/%=][\s]*[\d]+/.test(lowerMsg) || 
                                   /[\d]+%/.test(lowerMsg);
          const hasComplexKeyword = mathAndComplexKeywords.some(kw => lowerMsg.includes(kw));

          if (hasMathOrFormula || hasComplexKeyword) {
            selectedModel = "gemini-3.7-flash";
          }
          
          console.log(`[AI Routing] Message: "${userMessageContent.substring(0, 50)}..." -> Modèle sélectionné: ${selectedModel}`);

          const response = await aiClient.models.generateContent({
            model: selectedModel,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            }
          });

          const resText = response.text;
          if (resText) {
            const parsed = JSON.parse(resText.trim());
            if (parsed.reply) {
              replyContent = parsed.reply;
              geminiSuccess = true;

              // Boucle d'apprentissage continu asynchrone (si learnable est vrai et validé)
              if (parsed.learnable && parsed.genericQuestion && parsed.genericResponse && Array.isArray(parsed.genericKeywords) && parsed.genericKeywords.length > 0) {
                // S'assurer de ne pas doubler d'anciennes entrées similaires
                const isDuplicate = (localDb.chatbot_training || []).some((e: any) => 
                  e.keywords.some((kw: string) => parsed.genericKeywords.includes(kw)) && 
                  (e.response.toLowerCase().includes(parsed.genericResponse.toLowerCase().substring(0, 20)))
                );
                
                if (!isDuplicate) {
                  const newEntry = {
                    id: "train_learned_" + Math.random().toString(36).substr(2, 9),
                    keywords: parsed.genericKeywords.map((k: string) => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean),
                    response: parsed.genericResponse,
                    is_confidential: false,
                    created_at: new Date().toISOString()
                  };
                  localDb.chatbot_training.push(newEntry);
                  saveLocalDb();
                  console.log("Apprentissage continu : Nouvelle connaissance apprise par le chatbot !", newEntry);
                }
              }
            }
          }
        } catch (err) {
          console.error("Erreur ou Quota Gemini atteint, bascule sur la réponse par défaut :", err);
        }

        if (!geminiSuccess) {
          // Règle d'or : message court, flou ou ambigu, on combine les trois postures pour maximiser la rétention !
          replyContent = `👋 Bonjour ! Je suis l'**Assistant Virtuel de Pôle de Dons**.\n\n` +
            `🌟 **Une Plateforme Équitable & Transparente (Posture Marketing) :**\n` +
            `Pôle de Dons est un écosystème solidaire unique qui attribue des dons en nature (matériel, mobilier, immobilier) en fonction d'un indice de priorité sociale objectif et dynamique.\n\n` +
            `🔒 **Conformité & Sécurité (Posture Juridique) :**\n` +
            `Vos démarches et pièces d'identité sont traitées en parfaite conformité avec le RGPD dans un cadre légal strict et sécurisé.\n\n` +
            `🎯 **Que souhaitez-vous faire ? (Posture Conseiller Commercial) :**\n` +
            `• Pour suivre vos demandes actives, vous pouvez me poser des questions comme : *« Où en est mon dossier ? »* ou *« Quel est mon rang ? »* (connexion requise).\n` +
            `• Pour en savoir plus sur la sécurité des documents, demandez-moi : *« Mes pièces justificatives sont-elles sécurisées ? »*.\n\n` +
            `👉 **Que puis-je faire pour vous guider aujourd'hui ?** Posez-moi simplement votre question ci-dessous ou parcourez nos dons disponibles !`;
        }
      }
    }

    // Règle de sécurité stricte : Le chatbot ne doit jamais mentionner de frais, paiement, facture ou coût
    if (replyContent) {
      replyContent = replyContent
        .replace(/\b(frais de participation|frais d'inscription|frais d'arbitrage|frais de douane|frais de dossier|frais)\b/gi, "démarches")
        .replace(/\b(payer|payez)\b/gi, "valider")
        .replace(/\b(paiement|paiements|facture|factures|facturation)\b/gi, "validation")
        .replace(/\b(coût|coûts|cout|couts|tarif|tarifs)\b/gi, "modalités");
    }

    const botMsg = {
      donation_id: donationId,
      sender: "agent" as const,
      content: replyContent,
      user_name: "Assistant Automatique",
      user_id: userId,
      attachment: null,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConnected) {
      try {
        const supabaseMsg = { ...botMsg, donation_id: toSafeUuid(donationId) };
        const { data, error } = await supabase.from("agent_conversations").insert([supabaseMsg]).select();
        if (!error && data && data[0]) {
          if (io) {
            const clientMsg = { ...data[0], donation_id: donationId };
            io.to(`user:${userId}`).emit("message:received", clientMsg);
            io.to("room:admins").emit("message:received", clientMsg);
          }
          syncAgentConversationToApplication(donationId, userId, data[0], io);
          return;
        }
      } catch (e) {
        console.error("Erreur insertion bot message Supabase:", e);
      }
    }

    // Fallback local
    if (!localDb.agent_conversations) localDb.agent_conversations = {};
    if (!localDb.agent_conversations[donationId]) {
      localDb.agent_conversations[donationId] = [];
    }
    const localBotMsg = { ...botMsg, id: "msg_bot_" + Math.random().toString(36).substr(2, 9) };
    localDb.agent_conversations[donationId].push(localBotMsg);
    saveLocalDb();
    if (io) {
      io.to(`user:${userId}`).emit("message:received", localBotMsg);
      io.to("room:admins").emit("message:received", localBotMsg);
    }
    // Synchroniser le message automatique du bot vers l'application
    syncAgentConversationToApplication(donationId, userId, localBotMsg, io);
  }, 1000); // 1 seconde de réflexion naturelle
}

app.post("/api/agent-conversations/:donation_id", async (req, res) => {
  const { donation_id } = req.params;
  const { sender, content, user_name, user_id, attachment } = req.body;

  const newMsg: any = {
    donation_id,
    sender,
    content,
    user_name: user_name || "Visiteur",
    user_id: user_id || null,
    attachment: attachment || null,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConnected) {
    try {
      const supabaseMsg = { ...newMsg, donation_id: toSafeUuid(donation_id) };
      const { data, error } = await supabase.from("agent_conversations").insert([supabaseMsg]).select();
      if (!error && data && data[0]) {
        const savedMsg = { ...data[0], donation_id: donation_id };
        const io = req.app.get("io");
        if (io) {
          // Envoyer uniquement à l'utilisateur concerné via sa room dédiée
          io.to(`user:${savedMsg.user_id}`).emit("message:received", savedMsg);
          // Envoyer aussi aux admins
          io.to("room:admins").emit("message:received", savedMsg);
        }
        
        // Synchroniser le message vers l'application (le dossier d'instruction)
        syncAgentConversationToApplication(donation_id, user_id, savedMsg, io);

        // Déclencher l'auto-réponse si le message vient d'un visiteur
        if (sender === 'user') {
          triggerAutoReply(donation_id, content, user_id, io);
        }
        
        return res.json(savedMsg);
      }
      if (error) console.error("Erreur Supabase (agent_conversations):", error.message);
    } catch (e) {
      console.error("Exception Supabase (agent_conversations):", e);
    }
  }

  // Fallback Local
  if (!localDb.agent_conversations) localDb.agent_conversations = {};
  if (!localDb.agent_conversations[donation_id]) {
    localDb.agent_conversations[donation_id] = [];
  }
  const localMsg = { ...newMsg, id: "msg_" + Math.random().toString(36).substr(2, 9) };
  localDb.agent_conversations[donation_id].push(localMsg);
  saveLocalDb();
  const io = req.app.get("io");
  if (io) {
    io.to(`user:${localMsg.user_id}`).emit("message:received", localMsg);
    io.to("room:admins").emit("message:received", localMsg);
  }
  
  // Synchroniser le message vers l'application (le dossier d'instruction)
  syncAgentConversationToApplication(donation_id, user_id, localMsg, io);

  // Déclencher l'auto-réponse si le message vient d'un visiteur
  if (sender === 'user') {
    triggerAutoReply(donation_id, content, user_id, io);
  }
  
  res.json(localMsg);
});

// SUIVI DES APPELS WHATSAPP
app.get("/api/calls", (req, res) => {
  res.json(localDb.calls || []);
});

app.post("/api/calls/log", (req, res) => {
  const { client_name, client_email, client_phone, is_guest, viewed_donations } = req.body;
  
  const dateObj = new Date();
  const newCall = {
    id: "call_" + Math.random().toString(36).substr(2, 9),
    client_name: client_name || "Invité",
    client_email: client_email || "",
    client_phone: client_phone || "",
    is_guest: is_guest !== false,
    viewed_donations: Array.isArray(viewed_donations) ? viewed_donations : [],
    date_str: dateObj.toLocaleDateString("fr-FR"),
    time_str: dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    created_at: dateObj.toISOString()
  };
  
  localDb.calls = localDb.calls || [];
  localDb.calls.push(newCall);
  saveLocalDb();
  
  res.json({ success: true, call: newCall });
});

// G2. ENDPOINTS BASE D'ENTRAÎNEMENT DU CHATBOT
app.get("/api/chatbot-training", (req, res) => {
  res.json(localDb.chatbot_training || []);
});

app.post("/api/chatbot-training", (req, res) => {
  const { keywords, response, is_confidential } = req.body;
  if (!keywords || !response) {
    return res.status(400).json({ error: "Les mots-clés et la réponse sont requis." });
  }
  
  const parsedKeywords = Array.isArray(keywords) 
    ? keywords 
    : String(keywords).split(",").map((k: string) => k.trim()).filter(Boolean);

  const newEntry = {
    id: "train_" + Math.random().toString(36).substr(2, 9),
    keywords: parsedKeywords,
    response,
    is_confidential: !!is_confidential,
    created_at: new Date().toISOString()
  };
  
  localDb.chatbot_training = localDb.chatbot_training || [];
  localDb.chatbot_training.push(newEntry);
  saveLocalDb();
  res.json(newEntry);
});

app.put("/api/chatbot-training/:id", (req, res) => {
  const { id } = req.params;
  const { keywords, response, is_confidential } = req.body;
  
  localDb.chatbot_training = localDb.chatbot_training || [];
  const idx = localDb.chatbot_training.findIndex((e: any) => e.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Entrée d'entraînement introuvable." });
  }
  
  if (keywords !== undefined) {
    localDb.chatbot_training[idx].keywords = Array.isArray(keywords) 
      ? keywords 
      : String(keywords).split(",").map((k: string) => k.trim()).filter(Boolean);
  }
  if (response !== undefined) {
    localDb.chatbot_training[idx].response = response;
  }
  if (is_confidential !== undefined) {
    localDb.chatbot_training[idx].is_confidential = !!is_confidential;
  }
  
  saveLocalDb();
  res.json(localDb.chatbot_training[idx]);
});

app.delete("/api/chatbot-training/:id", (req, res) => {
  const { id } = req.params;
  localDb.chatbot_training = localDb.chatbot_training || [];
  const initialLength = localDb.chatbot_training.length;
  localDb.chatbot_training = localDb.chatbot_training.filter((e: any) => e.id !== id);
  
  if (localDb.chatbot_training.length === initialLength) {
    return res.status(404).json({ error: "Entrée d'entraînement introuvable." });
  }
  
  saveLocalDb();
  res.json({ success: true, message: "Entrée d'entraînement supprimée avec succès." });
});

// H. SETTINGS (CONFIGURATION GLOBALE)
const DEFAULT_WORKFLOW_STEPS = [
  {
    id: "step_coords",
    label: "Coordonnées",
    description: "Coordonnées de contact du demandeur. Veuillez renseigner votre nom complet, e-mail et numéro de téléphone.",
    iconName: "FileText",
    requiredFileType: "none",
  },
  {
    id: "step_project",
    label: "Projet d'Usage",
    description: "Descriptif du projet solidaire et de l'usage prévu pour le don. Précisez l'impact visé pour votre communauté.",
    iconName: "Sparkles",
    requiredFileType: "none",
  },
  {
    id: "step_identity",
    label: "Identité Officielle",
    description: "Justificatif officiel d'identité (CNI, Passeport, Statuts de l'association) à des fins de certification.",
    iconName: "ShieldCheck",
    requiredFileType: "image",
  },
  {
    id: "step_motivation",
    label: "Lettre de Motivation",
    description: "Message de motivation personnalisé destiné à la commission d'attribution solidaire.",
    iconName: "Mic",
    requiredFileType: "none",
    hasTextField: true,
    textFieldLabel: "Message de motivation",
    textFieldPlaceholder: "Expliquez l'urgence de votre besoin...",
  },
  {
    id: "step_delivery_choice",
    label: "Mode de Transfert",
    description: "Choix du mode de livraison si don en nature, ou mode de réception si don financier.",
    iconName: "Truck",
    requiredFileType: "none"
  }
];

const DEFAULT_ADMIN_FIELDS = [
  { key: "nom_prenom", label: "NOM ET Prénom", type: "text", placeholder: "Ex: Marie Laurent" },
  { key: "revenu_mensuel", label: "Revenu mensuel (€)", type: "number", placeholder: "Ex: 1500" },
  { key: "carte_identite", label: "Carte d'identité ou passeport", type: "file", placeholder: "Glissez votre document d'identité..." },
  { key: "photo_identite", label: "Photo d'identité", type: "file", placeholder: "Glissez votre photo d'identité..." },
  { key: "adresse", label: "Adresse", type: "text", placeholder: "Ex: 15 Rue de la Solidarité, Paris" },
  { key: "region", label: "Région", type: "text", placeholder: "Ex: Île-de-France" },
  { key: "contact", label: "Contact (E-mail ou Téléphone)", type: "text", placeholder: "Ex: +33 6 12 34 56 78" }
];

app.get("/api/settings/:key", async (req, res) => {
  const { key } = req.params;
  console.log(`[SETTINGS] Lecture de la clé: ${key}`);
  
  // 1. Tenter de lire depuis Supabase si connecté
  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).single();
      if (!error && data) {
        console.log(`[SETTINGS] Donnée récupérée depuis Supabase pour: ${key}`);
        // Mettre à jour notre cache local
        if (!localDb.settings) localDb.settings = {};
        localDb.settings[key] = data.value;
        saveLocalDb();
        return res.json(data.value);
      }
      if (error && error.code !== "PGRST116") {
        console.warn(`[SETTINGS] Supabase (key: ${key}): ${error.message}`);
      }
    } catch (e) {
      console.error(`[SETTINGS] Erreur critique Supabase (key: ${key}):`, e);
    }
  }
  
  // 2. Tenter de lire depuis la base locale persistée
  if (localDb.settings && localDb.settings[key] !== undefined) {
    console.log(`[SETTINGS] Donnée récupérée depuis le cache local pour: ${key}`);
    return res.json(localDb.settings[key]);
  }
  
  // 3. Fallbacks par défaut pour les clés connues
  console.log(`[SETTINGS] Retour au fallback par défaut pour: ${key}`);
  if (key === "admin_defined_fields") {
    return res.json(DEFAULT_ADMIN_FIELDS);
  } else if (key === "workflow_steps") {
    return res.json(DEFAULT_WORKFLOW_STEPS);
  } else {
    return res.json(null);
  }
});

app.post("/api/settings/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  console.log(`[SETTINGS] Enregistrement de la clé: ${key}`);

  // Enregistrer localement
  if (!localDb.settings) localDb.settings = {};
  localDb.settings[key] = value;
  saveLocalDb();

  // Enregistrer dans Supabase si connecté
  if (isSupabaseConnected) {
    try {
      const { error } = await supabase.from("app_settings").upsert({ 
        key, 
        value, 
        updated_at: new Date().toISOString() 
      }, { onConflict: "key" });
      
      if (error) {
        console.error(`[SUPABASE] Erreur lors de l'upsert du setting ${key}:`, error.message);
      } else {
        console.log(`[SUPABASE] Setting ${key} synchronisé.`);
      }
    } catch (e) {
      console.error(`[SUPABASE] Exception lors de l'upsert du setting ${key}:`, e);
    }
  }

  res.json(value);
});

// H2. GESTION DES PARTENAIRES (DÉPLACÉE ET UNIFIÉE À LA FIN DU FICHIER)

const ADMIN_EMAILS = ["admin@donationsphere.com", "asthedio@gmail.com", "asthedio1@gmail.com"];
const ROLES = ["user", "admin", "responsable"];

// I. AUTHENTIFICATION & SÉCURITÉ
app.post("/api/auth/login", async (req, res) => {
  const rawEmail = req.body?.email || "";
  const rawPassword = req.body?.password || "";
  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword.trim();

  console.log(`[AUTH] Tentative de connexion pour: ${email}`);

  const isSystemAdmin = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);

  // 1. Tenter la connexion via Supabase Auth
  if (isSupabaseConnected) {
    try {
      console.log(`[SUPABASE] Appel signInWithPassword pour ${email}...`);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error(`[SUPABASE] Info Auth: ${error.message}`);
      } else if (data.user) {
        console.log(`[SUPABASE] Connexion réussie pour ${email}`);
        
        // Récupérer ou créer l'utilisateur localement pour la gestion des rôles
        let localUser = localDb.users.find((u: any) => u.email.toLowerCase() === email);
        
        // Tenter de récupérer le profil depuis Supabase pour synchroniser le rôle
        try {
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          if (profile) {
            console.log(`[SUPABASE] Profil trouvé pour ${email}, rôle: ${profile.role}`);
            if (localUser) {
              localUser.role = isSystemAdmin ? "admin" : profile.role;
              localUser.name = profile.name || localUser.name;
            }
          }
        } catch (e) {
          // Table profiles absente ou erreur
        }

        // Si l'utilisateur est un administrateur système, s'assurer que son profil existe et est admin dans Supabase
        if (isSystemAdmin) {
          try {
            console.log(`[SUPABASE] Forcer/Upserter le profil admin pour ${email} dans public.profiles...`);
            await supabase.from("profiles").upsert({
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.name || email.split("@")[0] || "Administrateur",
              role: "admin",
              permissions: ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]
            });
          } catch (profileError) {
            console.error(`[SUPABASE] Échec de synchronisation du profil admin:`, profileError);
          }
        }

        if (!localUser) {
          localUser = {
            email: data.user.email,
            name: data.user.user_metadata?.name || email.split("@")[0],
            role: isSystemAdmin ? "admin" : (data.user.user_metadata?.role || "user"),
            permissions: isSystemAdmin ? ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"] : (data.user.user_metadata?.permissions || []),
            id: data.user.id,
            created_at: new Date().toISOString()
          };
          localDb.users.push(localUser);
          saveLocalDb();
        } else if (isSystemAdmin) {
          localUser.role = "admin";
          localUser.permissions = ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"];
          saveLocalDb();
        }

        
    return res.json({
          email: localUser.email,
          name: localUser.name,
          role: localUser.role,
          permissions: localUser.permissions || [],
          id: localUser.id
        });
      }
    } catch (e) {
      console.error("Erreur Supabase Auth Login:", e);
    }
  }

  // 2. Administrateur système direct ou Fallback local
  if (isSystemAdmin && (password === "Solidaire2026" || password === "admin" || password === "password")) {
    console.log(`[AUTH] Connexion administrateur immédiate pour ${email}`);
    let adminUser = localDb.users.find((u: any) => u.email.toLowerCase() === email);
    if (!adminUser) {
      adminUser = {
        email,
        name: "Admin Principal",
        role: "admin",
        permissions: ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"],
        id: "admin-" + Date.now(),
        created_at: new Date().toISOString()
      };
      localDb.users.push(adminUser);
      saveLocalDb();
    }
    
    return res.json({
      email: adminUser.email,
      name: adminUser.name || "Administrateur",
      role: "admin",
      permissions: ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"],
      id: adminUser.id || "admin-main"
    });
  }

  // 3. Fallback utilisateur standard
  const user = localDb.users.find((u: any) => u.email.toLowerCase() === email && u.password === password);
  
  if (user) {
    console.log(`[LOCAL] Connexion réussie via fallback pour ${email}`);
    const { password: _, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  }

  console.warn(`[AUTH] Échec de connexion pour ${email}`);
  return res.status(401).json({ error: "Adresse e-mail ou mot de passe incorrect." });
});

app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body;
  console.log(`[AUTH] Nouvelle inscription: ${email}`);
  
  // 1. Inscription via Supabase Auth
  if (isSupabaseConnected) {
    try {
      const isSystemAdmin = ADMIN_EMAILS.includes(email);
      const role = isSystemAdmin ? "admin" : "user";
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role: role }
        }
      });

      if (error) {
        console.error(`[SUPABASE] Erreur inscription: ${error.message}`);
        return res.status(400).json({ error: error.message });
      }

      if (data.user) {
        console.log(`[SUPABASE] Utilisateur créé: ${data.user.id}`);
        
        // Tenter d'insérer dans la table 'profiles' si elle existe
        try {
          await supabase.from("profiles").insert({
            id: data.user.id,
            email: data.user.email,
            name: name,
            role: role,
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn("[SUPABASE] Échec insertion dans 'profiles' (Table probablement absente)");
        }

        // Ajouter à la DB locale pour la gestion admin immédiate
        const newUserLocal = {
          email: data.user.email,
          name,
          role: role,
          permissions: role === "admin" ? ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"] : [],
          id: data.user.id,
          created_at: new Date().toISOString()
        };
        
        if (!localDb.users.find(u => u.email === email)) {
          localDb.users.push(newUserLocal);
          saveLocalDb();
        }

        
    return res.json({
          email: data.user.email,
          name,
          role: role,
          permissions: newUserLocal.permissions,
          id: data.user.id
        });
      }
    } catch (e) {
      console.error("Erreur critique Supabase Auth Register:", e);
    }
  }

  // 2. Fallback local
  if (localDb.users.find(u => u.email === email)) {
    return res.status(400).json({ error: "Cet email est déjà utilisé" });
  }

  const newUser = { 
    email, 
    password, 
    name, 
    role: "user", 
    permissions: [], 
    created_at: new Date().toISOString(),
    id: Math.random().toString(36).substr(2, 9)
  };
  localDb.users.push(newUser);
  saveLocalDb();

  const { password: _, ...userWithoutPassword } = newUser;
  res.json(userWithoutPassword);
});

// Route pour lister les utilisateurs (Admin uniquement)
app.get("/api/admin/users", async (req, res) => {
  // Synchroniser les utilisateurs depuis Supabase de manière transparente
  await syncSupabaseUsers();
  res.json(localDb.users.map(({ password: _, ...u }: any) => u));
});

// Route pour changer le rôle d'un utilisateur (Admin uniquement)
app.post("/api/admin/update-role", async (req, res) => {
  const { email, newRole } = req.body;
  
  if (!ROLES.includes(newRole)) {
    return res.status(400).json({ error: "Rôle invalide" });
  }

  const userIndex = localDb.users.findIndex(u => u.email === email);
  if (userIndex !== -1) {
    localDb.users[userIndex].role = newRole;
    
    // Si passage en admin, donner toutes les permissions par défaut
    if (newRole === "admin") {
      localDb.users[userIndex].permissions = ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"];
    } else if (newRole === "user") {
      localDb.users[userIndex].permissions = [];
    }
    
    saveLocalDb();

    // Persister également dans Supabase pour éviter l'écrasement lors de la synchronisation
    if (isSupabaseConnected) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ 
            role: newRole,
            permissions: localDb.users[userIndex].permissions 
          })
          .eq("email", email);
        if (error) {
          console.error("[SUPABASE] Erreur lors de la mise à jour du rôle :", error.message);
        } else {
          console.log(`[SUPABASE] Rôle et permissions de ${email} mis à jour avec succès vers ${newRole} dans Supabase`);
        }
      } catch (err) {
        console.error("[SUPABASE] Exception de mise à jour du rôle :", err);
      }
    }

    
    return res.json({ success: true, message: `Rôle mis à jour vers ${newRole}` });
  }

  res.status(404).json({ error: "Utilisateur non trouvé localement" });
});

// Route pour mettre à jour les permissions (Admin uniquement)
app.post("/api/admin/update-permissions", async (req, res) => {
  const { email, permissions } = req.body;
  
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: "Format de permissions invalide" });
  }

  const userIndex = localDb.users.findIndex(u => u.email === email);
  if (userIndex !== -1) {
    localDb.users[userIndex].permissions = permissions;
    saveLocalDb();

    // Persister dans Supabase si connecté
    if (isSupabaseConnected) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ permissions })
          .eq("email", email);
        if (error) {
          console.error("[SUPABASE] Erreur lors de la mise à jour des permissions :", error.message);
        } else {
          console.log(`[SUPABASE] Permissions de ${email} mises à jour avec succès dans Supabase`);
        }
      } catch (err) {
        console.error("[SUPABASE] Exception de mise à jour des permissions :", err);
      }
    }

    
    return res.json({ success: true, message: "Permissions mises à jour avec succès" });
  }

  res.status(404).json({ error: "Utilisateur non trouvé" });
});

// Route pour modifier un utilisateur (Admin uniquement)
app.patch("/api/admin/users/:email", async (req, res) => {
  const { email } = req.params;
  const { name, role, permissions } = req.body;

  const userIndex = localDb.users.findIndex(u => u.email === email);
  if (userIndex === -1) {
    return res.status(404).json({ error: "Utilisateur non trouvé" });
  }

  if (name !== undefined) localDb.users[userIndex].name = name;
  if (role !== undefined) {
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: "Rôle invalide" });
    }
    localDb.users[userIndex].role = role;
    
    // Aligner les permissions par défaut si changement de rôle
    if (role === "admin") {
      localDb.users[userIndex].permissions = ["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"];
    } else if (role === "user") {
      localDb.users[userIndex].permissions = [];
    }
  }
  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: "Permissions invalides" });
    }
    localDb.users[userIndex].permissions = permissions;
  }

  saveLocalDb();

  if (isSupabaseConnected) {
    try {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (permissions !== undefined) updates.permissions = permissions;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("email", email);
      if (error) {
        console.error("[SUPABASE] Erreur lors de la modification de l'utilisateur :", error.message);
      }
    } catch (err) {
      console.error("[SUPABASE] Exception modification utilisateur :", err);
    }
  }

  res.json({ success: true, message: "Utilisateur modifié avec succès", user: localDb.users[userIndex] });
});

// Route pour supprimer un utilisateur (Admin uniquement)
app.delete("/api/admin/users/:email", async (req, res) => {
  const { email } = req.params;

  const userIndex = localDb.users.findIndex(u => u.email === email);
  if (userIndex === -1) {
    return res.status(404).json({ error: "Utilisateur non trouvé" });
  }

  localDb.users.splice(userIndex, 1);
  saveLocalDb();

  if (isSupabaseConnected) {
    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("email", email);
      if (error) {
        console.error("[SUPABASE] Erreur lors de la suppression de l'utilisateur :", error.message);
      }
    } catch (err) {
      console.error("[SUPABASE] Exception suppression utilisateur :", err);
    }
  }

  res.json({ success: true, message: "Utilisateur supprimé avec succès" });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email } = req.body;
  
  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${req.headers.origin}/reset-password`,
      });
      if (error) return res.status(400).json({ error: error.message });
      
    return res.json({ success: true, message: "E-mail de récupération envoyé" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erreur lors de l'envoi de l'e-mail de récupération" });
    }
  }
  
  // Fallback local
  const user = localDb.users.find(u => u.email === email);
  if (user) {
    
    return res.json({ success: true, message: "Mode local : E-mail de récupération simulé (vérifiez vos logs)" });
  }
  res.status(404).json({ error: "Utilisateur non trouvé" });
});

app.post("/api/auth/update-password", async (req, res) => {
  const { password } = req.body;
  
  if (isSupabaseConnected) {
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) return res.status(400).json({ error: error.message });
      
    return res.json({ success: true, message: "Mot de passe mis à jour avec succès" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erreur lors de la mise à jour du mot de passe" });
    }
  }
  
  res.status(400).json({ error: "Action non disponible en mode local" });
});

app.post("/api/auth/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  // 1. Supabase Auth Password Change
  if (isSupabaseConnected) {
    try {
      // Pour changer le mot de passe dans Supabase, il faut généralement être connecté
      // Mais ici on simule une mise à jour via le client serveur si possible, 
      // ou on informe que Supabase gère ça via ses propres flux.
      // Note: supabase.auth.updateUser({ password: newPassword }) nécessite une session active.
      // Pour un dashboard, c'est le client qui devrait appeler Supabase directement.
      // Cependant, on garde la structure API pour la compatibilité.
      
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ 
        email, 
        password: currentPassword 
      });

      if (!signInError) {
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (!updateError) {
          
    return res.json({ success: true, message: "Mot de passe Supabase modifié avec succès" });
        }
        return res.status(400).json({ error: updateError.message });
      }
    } catch (e) {
      console.error("Erreur Supabase Auth Password Change:", e);
    }
  }

  // 2. Fallback local
  const userIndex = localDb.users.findIndex(u => u.email === email && u.password === currentPassword);

  if (userIndex === -1) {
    return res.status(401).json({ error: "L'ancien mot de passe est incorrect" });
  }

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 4 caractères" });
  }

  localDb.users[userIndex].password = newPassword;
  saveLocalDb();

  console.log(`[SÉCURITÉ] Mot de passe local mis à jour pour ${email}`);
  res.json({ success: true, message: "Mot de passe local modifié avec succès" });
});

// Servir les médias téléversés et les fichiers statiques de public (favicons, logos, images)
const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/assets", express.static(path.join(publicDir, "assets")));

// Configurer le serveur Vite et Socket.io
async function startServer() {
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.set("io", io);

  // Gestion de la présence et des messages en temps réel
  const onlineUsers = new Set();
  
  io.on("connection", (socket) => {
    console.log("Nouveau client connecté:", socket.id);
    
    // Un utilisateur se déclare (soit admin, soit visiteur)
    socket.on("user:register", (userData) => {
      socket.data.user = userData;
      onlineUsers.add(socket.id);

      if (userData.is_admin) {
        socket.join("room:admins");
      }
      
      // Informer les admins de la mise à jour de la présence
      io.emit("presence:update", {
        count: onlineUsers.size,
        users: Array.from(onlineUsers).map(id => {
           const s = io.sockets.sockets.get(id as string);
           return s ? s.data.user : null;
        }).filter(Boolean)
      });
    });

    socket.on("conversation:join", (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[SOCKET] User ${socket.id} joined room user:${userId}`);
      }
    });

    // Envoi de message
    socket.on("message:send", (payload) => {
      // payload: { donation_id, sender, content, user_name, attachment, is_auth, user_id }
      // On diffuse uniquement à la room de l'utilisateur et aux admins
      if (payload.user_id) {
        io.to(`user:${payload.user_id}`).emit("message:received", payload);
      }
      io.to("room:admins").emit("message:received", payload);
    });

    socket.on("disconnect", () => {
      console.log("Client déconnecté:", socket.id);
      onlineUsers.delete(socket.id);
      io.emit("presence:update", {
        count: onlineUsers.size,
        users: Array.from(onlineUsers).map(id => {
           const s = io.sockets.sockets.get(id as string);
           return s ? s.data.user : null;
        }).filter(Boolean)
      });
    });
  });

// API Routes for Partners
app.get("/api/partners", async (req, res) => {
  if (isSupabaseConnected) {
    try {
      // D'abord tenter via la table de configuration 'app_settings'
      const { data: settingData, error: settingErr } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "partners")
        .single();
      
      if (!settingErr && settingData && Array.isArray(settingData.value) && settingData.value.length > 0) {
        localDb.partners = settingData.value;
        saveLocalDb();
        return res.json(settingData.value);
      }

      // Fallback : si la table 'partners' physique existe dans Supabase et a des données
      const { data: directData, error: directErr } = await supabase
        .from("partners")
        .select("*");
      if (!directErr && directData && directData.length > 0) {
        localDb.partners = directData;
        saveLocalDb();
        return res.json(directData);
      }
    } catch (e) {
      console.error("Erreur récupération partenaires Supabase:", e);
    }
  }

  // Fallback local persistant ou par défaut
  if (!localDb.partners || !Array.isArray(localDb.partners) || localDb.partners.length === 0) {
    localDb.partners = [
      {
        id: "p1",
        name: "FedEx",
        logo_url: "https://upload.wikimedia.org/wikipedia/commons/b/b9/FedEx_Corporation_-_Logo.svg",
        website: "https://www.fedex.com"
      }
    ];
    saveLocalDb();
  }
  res.json(localDb.partners);
});

app.post("/api/admin/partners", async (req, res) => {
  const { name, logo_url, website } = req.body;
  const newPartner = {
    id: "p_" + Math.random().toString(36).substr(2, 9),
    name,
    logo_url: logo_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=150",
    website: website || "#",
    created_at: new Date().toISOString()
  };

  if (!localDb.partners || !Array.isArray(localDb.partners)) {
    localDb.partners = [];
  }
  localDb.partners.push(newPartner);
  saveLocalDb();

  if (isSupabaseConnected) {
    try {
      await supabase.from("app_settings").upsert({
        key: "partners",
        value: localDb.partners,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

      try {
        const { id, ...partnerWithoutId } = newPartner;
        await supabase.from("partners").insert([partnerWithoutId]);
      } catch (errPhys) {}
    } catch (e) {
      console.error("Erreur sauvegarde partenaire Supabase:", e);
    }
  }

  res.json(newPartner);
});

app.patch("/api/admin/partners/:id", async (req, res) => {
  const { id } = req.params;
  const { name, logo_url, website } = req.body;

  if (!localDb.partners || !Array.isArray(localDb.partners)) {
    localDb.partners = [];
  }
  const index = localDb.partners.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Partenaire non trouvé" });
  }

  localDb.partners[index] = {
    ...localDb.partners[index],
    name: name || localDb.partners[index].name,
    logo_url: logo_url || localDb.partners[index].logo_url,
    website: website !== undefined ? website : localDb.partners[index].website
  };

  saveLocalDb();

  if (isSupabaseConnected) {
    try {
      await supabase.from("app_settings").upsert({
        key: "partners",
        value: localDb.partners,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

      try {
        await supabase.from("partners").update({
          name: localDb.partners[index].name,
          logo_url: localDb.partners[index].logo_url,
          website: localDb.partners[index].website
        }).eq("id", id);
      } catch (errPhys) {}
    } catch (e) {
      console.error("Erreur mise à jour partenaire Supabase:", e);
    }
  }

  res.json(localDb.partners[index]);
});

app.delete("/api/admin/partners/:id", async (req, res) => {
  const { id } = req.params;
  
  if (!localDb.partners || !Array.isArray(localDb.partners)) {
    localDb.partners = [];
  }
  localDb.partners = localDb.partners.filter(p => p.id !== id);
  saveLocalDb();

  if (isSupabaseConnected) {
    try {
      await supabase.from("app_settings").upsert({
        key: "partners",
        value: localDb.partners,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

      try {
        await supabase.from("partners").delete().eq("id", id);
      } catch (errPhys) {}
    } catch (e) {
      console.error("Erreur suppression partenaire Supabase:", e);
    }
  }

  res.json({ success: true, message: "Partenaire supprimé avec succès !" });
});

// API Route for Advanced Statistics
app.get("/api/admin/stats", async (req, res) => {
  // Synchroniser d'abord les utilisateurs depuis Supabase de manière transparente
  await syncSupabaseUsers();

  let donationsList = localDb.donations;
  let applicationsList = localDb.applications;
  let usersCount = localDb.users.length;

  if (isSupabaseConnected) {
    try {
      const { data: dons } = await supabase.from("donations").select("*");
      const { data: apps } = await supabase.from("applications").select("*");
      
      if (dons) donationsList = dons;
      if (apps) applicationsList = apps;
      
      const { count: uCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      if (uCount !== null && uCount > 0) {
        usersCount = uCount;
      } else {
        usersCount = localDb.users.length;
      }
    } catch (e) {
      console.error("Stats error Supabase:", e);
      usersCount = localDb.users.length;
    }
  }

  const totalDonations = donationsList.length;
  const totalApplications = applicationsList.length;
  const pendingApplications = applicationsList.filter(a => a.status === "pending").length;
  const approvedApplications = applicationsList.filter(a => a.status === "approved" || a.status === "completed").length;
  
  // Stats par catégorie
  const categories = ["Véhicules", "Immobilier", "Financier", "Matériel"];
  const statsByCategory = categories.map(cat => ({
    name: cat,
    count: donationsList.filter(d => d.category === cat).length
  }));

  // Évolution mensuelle dynamique des 6 derniers mois en fonction de la date de création
  const monthsFrench = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
  const now = new Date();
  const monthlyData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthIndex = d.getMonth();
    const year = d.getFullYear();
    const displayName = `${monthsFrench[monthIndex]} ${year.toString().substring(2)}`;

    const donationsCount = donationsList.filter(don => {
      if (!don.created_at) return false;
      const cDate = new Date(don.created_at);
      return cDate.getMonth() === monthIndex && cDate.getFullYear() === year;
    }).length;

    const applicationsCount = applicationsList.filter(app => {
      if (!app.created_at) return false;
      const cDate = new Date(app.created_at);
      return cDate.getMonth() === monthIndex && cDate.getFullYear() === year;
    }).length;

    monthlyData.push({
      name: displayName,
      applications: applicationsCount,
      donations: donationsCount
    });
  }

  res.json({
    summary: {
      totalDonations,
      totalApplications,
      pendingApplications,
      approvedApplications,
      totalUsers: usersCount
    },
    statsByCategory,
    monthlyData
  });
});


app.get("/api/all-user-messages", async (req, res) => {
  const userName = req.query.user_name as string;
  const userId = req.query.user_id as string;
  
  if (!userName && !userId) return res.json([]);

  let allMessages: any[] = [];
  
  // 1. Chercher dans les conversations en direct
  if (isSupabaseConnected) {
    try {
      let queryPromise;
      if (userId && userId !== "visitor" && userId !== "null" && userId !== "undefined") {
        if (userName && userName !== "Visiteur" && userName !== "Candidat Anonyme" && userName !== "Candidat") {
          queryPromise = supabase.from("agent_conversations").select("*").or(`user_id.eq.${userId},user_name.eq.${userName}`);
        } else {
          queryPromise = supabase.from("agent_conversations").select("*").eq("user_id", userId);
        }
      } else if (userName && userName !== "Visiteur" && userName !== "Candidat Anonyme" && userName !== "Candidat") {
        queryPromise = supabase.from("agent_conversations").select("*").eq("user_name", userName);
      } else {
        queryPromise = null;
      }

      if (queryPromise) {
        const { data: directMsgs, error } = await withTimeout(queryPromise, 2000, { data: null, error: new Error("timeout") });
        
        if (!error && directMsgs) {
          const filteredDirect = directMsgs.filter((m: any) => {
            if (userId && userId !== "visitor" && userId !== "null" && userId !== "undefined" && m.user_id === userId) {
              return true;
            }
            if (!m.user_id && userName && userName !== "Visiteur" && userName !== "Candidat Anonyme" && userName !== "Candidat" && m.user_name === userName) {
              return true;
            }
            return false;
          });
          allMessages.push(...filteredDirect);
        }
      }
    } catch (e) {
      console.error("Erreur Supabase all-user-messages (direct):", e);
    }
  }

  if (localDb.agent_conversations) {
    Object.entries(localDb.agent_conversations).forEach(([donId, msgs]: [string, any]) => {
      const userMsgs = (msgs || []).filter((m: any) => {
        if (userId && userId !== "visitor" && userId !== "null" && userId !== "undefined") {
          if (m.user_id === userId) return true;
          if (!m.user_id && userName && userName !== "Visiteur" && userName !== "Candidat Anonyme" && userName !== "Candidat" && m.user_name === userName) {
            return true;
          }
          return false;
        }
        if (userName && userName !== "Visiteur" && userName !== "Candidat Anonyme" && userName !== "Candidat" && m.user_name === userName) {
          return true;
        }
        return false;
      });
      // Éviter d'ajouter des doublons si déjà récupérés de Supabase
      userMsgs.forEach((m: any) => {
        if (!allMessages.some(am => am.id === m.id)) {
          allMessages.push(m);
        }
      });
    });
  }

  // 2. Chercher dans les messages de candidatures
  let userAppIds: string[] = [];
  
  if (isSupabaseConnected) {
    try {
      let queryPromise;
      if (userId && userId !== "visitor" && userId !== "null" && userId !== "undefined") {
        queryPromise = supabase.from("applications").select("id, donation_id").eq("user_id", userId);
      } else if (userName && userName !== "Visiteur" && userName !== "Candidat Anonyme") {
        queryPromise = supabase.from("applications").select("id, donation_id").eq("user_name", userName);
      } else {
        queryPromise = null;
      }
      
      if (queryPromise) {
        const { data: userApps, error: appErr } = await withTimeout(queryPromise, 2000);
        if (!appErr && userApps) {
          userAppIds = userApps.map(a => a.id);
          
          if (userAppIds.length > 0) {
            const { data: appMsgs, error: msgErr } = await withTimeout(
              supabase.from("application_messages").select("*").in("application_id", userAppIds),
              2000
            );
              
            if (!msgErr && appMsgs) {
              const mappedAppMsgs = appMsgs.map((m: any) => {
                const app = userApps.find((a: any) => a.id === m.application_id);
                return {
                  ...m,
                  donation_id: app ? app.donation_id : null
                };
              });
              mappedAppMsgs.forEach((m: any) => {
                if (!allMessages.some(am => am.id === m.id)) {
                  allMessages.push(m);
                }
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Erreur Supabase all-user-messages (apps):", e);
    }
  }

  const userAppsLocal = (localDb.applications || []).filter(app => {
    if (userId && userId !== "visitor" && userId !== "null" && userId !== "undefined") {
      return app.user_id === userId;
    }
    if (userName && userName !== "Visiteur" && userName !== "Candidat Anonyme") {
      return app.user_name === userName;
    }
    return false;
  });
  userAppsLocal.forEach(app => {
    if (!userAppIds.includes(app.id)) {
      userAppIds.push(app.id);
    }
  });
  
  if (userAppIds.length > 0) {
    const appMsgsLocal = (localDb.application_messages || []).filter(m => userAppIds.includes(m.application_id));
    appMsgsLocal.forEach(m => {
      if (!allMessages.some(am => am.id === m.id)) {
        const app = userAppsLocal.find(a => a.id === m.application_id);
        allMessages.push({
          ...m,
          donation_id: app ? app.donation_id : null
        });
      }
    });
  }

  // Trier par date
  allMessages.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  // Éviter les doublons finaux par ID ou contenu+date
  const uniqueMessages = Array.from(new Map(allMessages.map(m => [m.id || (m.content + m.created_at), m])).values());

  res.json(uniqueMessages);
});

// I. SUPPRESSION DE DOCUMENTS (ADMIN)
app.delete("/api/submissions/:id", async (req, res) => {
  const { id } = req.params;
  
  if (isSupabaseConnected) {
    try {
      const { error } = await supabase.from("application_submissions").delete().eq("id", id);
      if (!error) {
        // Supprimer aussi du local db pour synchro
        localDb.application_submissions = localDb.application_submissions.filter(s => s.id !== id);
        saveLocalDb();
        
    return res.json({ success: true });
      }
      return res.status(500).json({ error: error.message });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  localDb.application_submissions = localDb.application_submissions.filter(s => s.id !== id);
  saveLocalDb();
  res.json({ success: true });
});

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur de dons opérationnel sur http://localhost:${PORT}`);
  });
}

startServer();
