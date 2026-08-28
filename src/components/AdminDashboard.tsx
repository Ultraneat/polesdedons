import React, { useState, useEffect, useMemo, useRef } from "react";
import { Donation, Application, ApplicationMessage, DbStatus, WorkflowStep, Testimonial } from "../types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { 
  Database, 
  Terminal, 
  ClipboardCheck, 
  Clipboard, 
  RotateCcw, 
  PlusCircle, 
  Send, 
  Shield, 
  Eye, 
  Check, 
  X, 
  AlertTriangle, 
  FolderPlus, 
  Sliders,
  Sparkles,
  Users,
  Settings,
  GitMerge,
  HelpCircle,
  FileCheck,
  FileText,
  ShieldCheck,
  Mic,
  Truck,
  Paperclip, Square, 
  CheckCircle,
  LayoutDashboard,
  Bot,
  Edit,
  MessageSquare,
  UploadCloud,
  Volume2,
  Play,
  Image,
  Video,
  MapPin,
  Activity,
  Info,
  Trash2,
  Star,
  RefreshCw,
  Building2,
  ExternalLink,
  Globe,
  Search,
  Save,
  Upload,
  CreditCard,
  Coins,
  PhoneCall,
  Gift
} from "lucide-react";
import { compressImageToWebP, blobToBase64 } from "../lib/fileCompressor";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "react-hot-toast";
import { getSocket, sendMessage, joinConversation } from "../lib/socket";
import SecuritySettings from "./SecuritySettings";

import DocumentModal from "./DocumentModal";
import ConfirmModal from "./ConfirmModal";

interface AdminDashboardProps {
  donations: Donation[];
  applications: Application[];
  messages: Record<string, ApplicationMessage[]>;
  dbStatus: DbStatus | null;
  currentUser: any;
  onResetDb: () => void;
  onCreateDonation: (don: any) => Promise<any>;
  onDeleteDonation?: (id: string) => Promise<boolean>;
  onUpdateApplication: (id: string, updates: any) => void;
  onDeleteApplication?: (id: string) => void;
  onSendAdminMessage: (appId: string, content: string, attachment?: any) => void;
  adminDefinedFields: Array<{key: string, label: string, type: string, placeholder: string}>;
  onChangeFields: (fields: Array<{key: string, label: string, type: string, placeholder: string}>) => void;
  workflowSteps: WorkflowStep[];
  onChangeWorkflowSteps: (steps: WorkflowStep[]) => void;
  testimonials?: Testimonial[];
  onRefreshData?: () => void;
  submissions?: Record<string, any[]>;
  onDeleteSubmission?: (id: string) => Promise<boolean>;
  platformLogo?: string;
  onChangeLogo?: (logoUrl: string) => void;
  platformHeroImage?: string;
  onChangeHeroImage?: (imageUrl: string) => void;
}

const SQL_SCHEMA_CODE = `-- =====================================================================
-- SCHEMA DE BASE DE DONNÉES COMPLET - PLATEFORME DE DONS ET CANDIDATURES
-- OPTIMISÉ POUR 0 EGRESS (COMPRESSIONS LOCALES OPUS/WEBP, FICHIERS < 50 KO)
-- COMPATIBLE SUPABASE POSTGRES AVEC POLITIQUES RLS ET TRIGGERS D'AUTOMATISATION
-- =====================================================================

-- Activer l'extension UUID si elle n'est pas encore présente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Table 'profiles' (Extension des données d'authentification)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Trigger pour créer automatiquement un profil lors de l'inscription via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 1. Table 'donations' (Les dons d'urgence publiés)
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    target_amount NUMERIC(15, 2) DEFAULT NULL,
    current_bids_count INT DEFAULT 0,
    image_url TEXT DEFAULT NULL,
    location VARCHAR(255) DEFAULT NULL,
    specifications JSONB DEFAULT '{}'::jsonb,
    agent_name VARCHAR(150) DEFAULT NULL,
    agent_phone VARCHAR(50) DEFAULT NULL,
    donor_name VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Table 'testimonials' (Avis & Témoignages approuvés)
-- Optimisé pour le stockage d'images WebP compressées et de mémos audio Opus ultra-légers (< 50 Ko)
CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID REFERENCES donations(id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL, -- 'text', 'audio', 'image', 'video'
    railway_media_url TEXT, -- URL locale de l'upload compressé ou lien externe YouTube
    author_name VARCHAR(100) NOT NULL,
    quote TEXT,
    approved BOOLEAN DEFAULT FALSE, -- Système de modération et d'approbation par l'administrateur
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Table 'applications' (Dossiers de candidature des bénéficiaires)
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID REFERENCES donations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- ID de l'utilisateur demandeur (auth.uid() de Supabase)
    user_name VARCHAR(100) NOT NULL DEFAULT 'Candidat Anonyme',
    current_step INT DEFAULT 0,
    completion_percentage INT DEFAULT 0,
    rank_position INT DEFAULT 1,
    risk_level VARCHAR(50) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    step_expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Table 'application_submissions' (Formulaires et pièces jointes soumis à chaque étape du workflow)
CREATE TABLE IF NOT EXISTS application_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    form_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Contenu des champs de formulaire de l'étape
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Table 'application_messages' (Canal de discussion d'instruction bilatéral et d'aide IA)
-- Les pièces jointes sont compressées localement sous les 50 Ko en Base64 ou URL d'optimisation
CREATE TABLE IF NOT EXISTS application_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) CHECK (sender_type IN ('system', 'user', 'admin')),
    content TEXT NOT NULL,
    attachment JSONB DEFAULT NULL, -- Métadonnées et contenu compressé de la pièce jointe { name, url, size_kb, type }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Table 'agent_conversations' (Chats directs catalogue entre visiteurs et agents)
-- Permet une interaction fluide avant même la création d'un dossier de candidature
CREATE TABLE IF NOT EXISTS agent_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID REFERENCES donations(id) ON DELETE CASCADE,
    sender VARCHAR(50) NOT NULL, -- 'user', 'agent'
    user_name VARCHAR(100) DEFAULT 'Visiteur',
    content TEXT NOT NULL,
    attachment JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 7. Table 'app_settings' (Configuration globale de la plateforme, ex: Formulaires dynamiques)
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);


-- =====================================================================
-- TRIGGERS D'AUTOMATISATION ET SÉCURITÉ INTÉGRÉE
-- =====================================================================

-- Trigger pour incrémenter/décrémenter dynamiquement le nombre de candidatures sur les dons
CREATE OR REPLACE FUNCTION update_donation_bids_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE donations 
        SET current_bids_count = current_bids_count + 1 
        WHERE id = NEW.donation_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE donations 
        SET current_bids_count = GREATEST(0, current_bids_count - 1) 
        WHERE id = OLD.donation_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_donation_bids_count
AFTER INSERT OR DELETE ON applications
FOR EACH ROW
EXECUTE FUNCTION update_donation_bids_count();


-- =====================================================================
-- POLITIQUES DE SÉCURITÉ DE NIVEAU LIGNE (ROW LEVEL SECURITY - RLS)
-- =====================================================================

-- Activer la protection RLS sur toutes les tables
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 1. Politiques pour la table 'donations' (Lecture publique, Modification admin)
DROP POLICY IF EXISTS "lecture_publique_donations" ON donations;
CREATE POLICY "lecture_publique_donations" ON donations 
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "admin_all_donations" ON donations;
CREATE POLICY "admin_all_donations" ON donations 
    FOR ALL USING (auth.jwt()->>'role' = 'service_role' OR auth.role() = 'authenticated');

-- 2. Politiques pour la table 'testimonials' (Lecture publique des avis approuvés, Écriture pour les bénéficiaires)
DROP POLICY IF EXISTS "lecture_publique_testimonials" ON testimonials;
CREATE POLICY "lecture_publique_testimonials" ON testimonials 
    FOR SELECT USING (approved = TRUE OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "insertion_beneficiaire_testimonials" ON testimonials;
CREATE POLICY "insertion_beneficiaire_testimonials" ON testimonials 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_testimonials" ON testimonials;
CREATE POLICY "admin_all_testimonials" ON testimonials 
    FOR ALL USING (auth.role() = 'authenticated');

-- 3. Politiques pour la table 'applications' (Chacun gère son propre dossier, l'admin voit tout)
DROP POLICY IF EXISTS "user_select_own_applications" ON applications;
CREATE POLICY "user_select_own_applications" ON applications 
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "user_insert_own_applications" ON applications;
CREATE POLICY "user_insert_own_applications" ON applications 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_update_own_applications" ON applications;
CREATE POLICY "user_update_own_applications" ON applications 
    FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'authenticated');

-- 4. Politiques pour la table 'application_submissions' (Sécurisé par jointure sur l'application propriétaire)
DROP POLICY IF EXISTS "access_submissions_on_own_applications" ON application_submissions;
CREATE POLICY "access_submissions_on_own_applications" ON application_submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM applications 
            WHERE applications.id = application_submissions.application_id 
            AND (applications.user_id = auth.uid() OR auth.role() = 'authenticated')
        )
    );

-- 5. Politiques pour la table 'application_messages' (Sécurisé par jointure sur l'application propriétaire)
DROP POLICY IF EXISTS "access_messages_on_own_applications" ON application_messages;
CREATE POLICY "access_messages_on_own_applications" ON application_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM applications 
            WHERE applications.id = application_messages.application_id 
            AND (applications.user_id = auth.uid() OR auth.role() = 'authenticated')
        )
    );

-- 6. Politiques pour la table 'agent_conversations' (Lecture publique, Insertion libre pour les visiteurs)
DROP POLICY IF EXISTS "lecture_publique_agent_conversations" ON agent_conversations;
CREATE POLICY "lecture_publique_agent_conversations" ON agent_conversations 
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "insertion_visiteur_agent_conversations" ON agent_conversations;
CREATE POLICY "insertion_visiteur_agent_conversations" ON agent_conversations 
    FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "admin_all_agent_conversations" ON agent_conversations;
CREATE POLICY "admin_all_agent_conversations" ON agent_conversations 
    FOR ALL USING (auth.role() = 'authenticated');

-- 7. Politiques pour la table 'app_settings' (Lecture publique, Modification admin)
DROP POLICY IF EXISTS "lecture_publique_app_settings" ON app_settings;
CREATE POLICY "lecture_publique_app_settings" ON app_settings 
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "admin_all_app_settings" ON app_settings;
CREATE POLICY "admin_all_app_settings" ON app_settings 
    FOR ALL USING (auth.role() = 'authenticated');
`;

export default function AdminDashboard({
  donations,
  applications,
  messages,
  dbStatus,
  currentUser,
  onResetDb,
  onCreateDonation,
  onDeleteDonation,
  onUpdateApplication,
  onDeleteApplication,
  onSendAdminMessage,
  adminDefinedFields,
  onChangeFields,
  workflowSteps,
  onChangeWorkflowSteps,
  testimonials = [],
  onRefreshData,
  submissions = {},
  onDeleteSubmission,
  platformLogo,
  onChangeLogo,
  platformHeroImage,
  onChangeHeroImage
}: AdminDashboardProps) {
  // Confirm Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const confirmAction = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        }
      });
    });
  };

  // Navigation interne de l'admin
  const isAdmin = currentUser?.role === "admin";
  const isResponsable = currentUser?.role === "responsable";
  const userPermissions = currentUser?.permissions || [];

  const hasPermission = (tab: string) => {
    if (isAdmin) return true;
    return userPermissions.includes(tab);
  };

  // Navigation interne de l'admin
  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    // Si l'onglet actif n'est pas autorisé, rediriger vers le premier autorisé
    const availableTabs = [
      "overview", "workflow", "applications", "publish", "fields", "visitor_chats", "whatsapp_calls",
      ...(isAdmin ? ["chatbot_training"] : []),
      "testimonials", "partners", "security", "users", "docs", "payments"
    ];
    if (!hasPermission(activeTab) || (activeTab === "chatbot_training" && !isAdmin)) {
      const firstAllowed = availableTabs.find(t => hasPermission(t));
      if (firstAllowed) setActiveTab(firstAllowed);
    }
  }, [currentUser]);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserRole, setEditUserRole] = useState("");
  const [editUserPermissions, setEditUserPermissions] = useState<string[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [newPartner, setNewPartner] = useState({ name: "", logo_url: "", website: "" });
  const [copied, setCopied] = useState(false);
  const [localToast, setLocalToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // WhatsApp Calls Tracking States
  const [whatsappCalls, setWhatsappCalls] = useState<any[]>([]);
  const loadWhatsappCalls = () => {
    fetch("/api/calls")
      .then(res => res.json())
      .then(data => setWhatsappCalls(data))
      .catch(err => console.warn("Erreur chargement des appels :", err));
  };

  // Chatbot Training States
  const [chatbotTraining, setChatbotTraining] = useState<any[]>([]);
  const [searchTrainingQuery, setSearchTrainingQuery] = useState("");
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [selectedTrainingEntry, setSelectedTrainingEntry] = useState<any | null>(null);
  const [trainingKeywords, setTrainingKeywords] = useState("");
  const [trainingResponse, setTrainingResponse] = useState("");
  const [trainingIsConfidential, setTrainingIsConfidential] = useState(false);
  const [isSavingTraining, setIsSavingTraining] = useState(false);

  const loadChatbotTraining = () => {
    fetch("/api/chatbot-training")
      .then(res => res.json())
      .then(data => setChatbotTraining(data))
      .catch(err => console.warn("Erreur chargement chatbot training (attendu si hors ligne) :", err));
  };

  useEffect(() => {
    if (activeTab === "chatbot_training") {
      loadChatbotTraining();
    }
    if (activeTab === "whatsapp_calls") {
      loadWhatsappCalls();
    }
  }, [activeTab]);

  // Document Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);

  const [inputLogoUrl, setInputLogoUrl] = useState(platformLogo || "");
  const [inputHeroUrl, setInputHeroUrl] = useState(platformHeroImage || "");

  useEffect(() => {
    if (platformLogo) {
      setInputLogoUrl(platformLogo);
    }
  }, [platformLogo]);

  useEffect(() => {
    if (platformHeroImage) {
      setInputHeroUrl(platformHeroImage);
    }
  }, [platformHeroImage]);

const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast("Compression du logo en cours...", "success");
      const compressed = await compressImageToWebP(file);
      setInputLogoUrl(compressed);
      showToast("Logo chargé et compressé en WebP.", "success");
      toast.success("Logo chargé et compressé en WebP !");
    } catch (err) {
      console.error("Erreur de compression du logo:", err);
      // Fallback: charge le fichier directement en base64 original
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Result = event.target?.result as string;
        if (base64Result) {
          setInputLogoUrl(base64Result);
          showToast("Logo chargé (sans compression).", "success");
          toast.success("Logo chargé (sans compression).");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLogo = () => {
    if (!inputLogoUrl.trim()) {
      showToast("Veuillez spécifier une URL ou téléverser un fichier.", "error");
      toast.error("Veuillez spécifier une URL ou téléverser un fichier.");
      return;
    }
    if (onChangeLogo) {
      onChangeLogo(inputLogoUrl);
    }
  };

  const handleSaveHeroImage = () => {
    if (!inputHeroUrl.trim()) {
      showToast("Veuillez spécifier une URL ou téléverser un fichier.", "error");
      toast.error("Veuillez spécifier une URL ou téléverser un fichier.");
      return;
    }
    if (onChangeHeroImage) {
      onChangeHeroImage(inputHeroUrl);
    }
  };

  const openDocument = (url: string, name: string) => {
    setSelectedDoc({ url, name });
    setIsDocModalOpen(true);
  };
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);
  const [isCompressingEditLogo, setIsCompressingEditLogo] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setLocalToast({ message, type });
    if (type === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
    setTimeout(() => {
      setLocalToast(null);
    }, 3500);
  };

  const compressImageToWebP = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 400;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Impossible de récupérer le contexte Canvas 2D"));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/webp", 0.8);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Erreur de chargement de l'image"));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    if (isAdmin || isResponsable) {
      // Charger les stats
      fetch("/api/admin/stats")
        .then(res => res.json())
        .then(data => setStats(data))
        .catch(err => console.warn("Erreur stats (attendu si hors ligne) :", err));
      
      // Charger les partenaires
      fetch("/api/partners")
        .then(res => res.json())
        .then(data => setPartners(data))
        .catch(err => console.warn("Erreur partenaires (attendu si hors ligne) :", err));
    }
    
    if (isAdmin) {
      fetch("/api/admin/users")
        .then(res => res.json())
        .then(data => setAllUsers(data))
        .catch(err => console.warn("Erreur chargement utilisateurs (attendu si hors ligne) :", err));
    }
  }, [isAdmin, isResponsable, donations, applications]);

  const handleAddPartner = async () => {
    if (!newPartner.name) {
      setLocalToast({ message: "Le nom du partenaire est requis.", type: "error" });
      setTimeout(() => setLocalToast(null), 4000);
      return;
    }
    if (!newPartner.logo_url) {
      setLocalToast({ message: "Le logo du partenaire est requis (téléversez un fichier ou renseignez une URL).", type: "error" });
      setTimeout(() => setLocalToast(null), 4000);
      return;
    }
    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPartner)
      });
      if (res.ok) {
        const added = await res.json();
        setPartners(prev => [...prev, added]);
        setNewPartner({ name: "", logo_url: "", website: "" });
        setLocalToast({ message: "Partenaire ajouté avec succès !", type: "success" });
        setTimeout(() => setLocalToast(null), 4000);
        if (onRefreshData) onRefreshData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setLocalToast({ message: errData.error || "Erreur lors de la création du partenaire.", type: "error" });
        setTimeout(() => setLocalToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setLocalToast({ message: "Erreur réseau lors de l'ajout du partenaire.", type: "error" });
      setTimeout(() => setLocalToast(null), 4000);
    }
  };

  const handleDeletePartner = async (id: string) => {
    const isConfirmed = await confirmAction("Supprimer le partenaire", "Voulez-vous vraiment supprimer ce partenaire ?");
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/admin/partners/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPartners(prev => prev.filter(p => p.id !== id));
        if (onRefreshData) onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateUserRole = async (email: string, newRole: string) => {
    try {
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newRole })
      });
      if (res.ok) {
        setAllUsers(prev => prev.map(u => u.email === email ? { ...u, role: newRole } : u));
        showToast(`Rôle mis à jour avec succès : ${newRole}`, "success");
      } else {
        showToast("Erreur lors de la mise à jour du rôle", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur réseau lors de la mise à jour", "error");
    }
  };

  const handleUpdateUserPermissions = async (email: string, permissions: string[]) => {
    try {
      const res = await fetch("/api/admin/update-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permissions })
      });
      if (res.ok) {
        setAllUsers(prev => prev.map(u => u.email === email ? { ...u, permissions } : u));
        showToast("Permissions enregistrées avec succès !", "success");
      } else {
        showToast("Erreur lors de l'enregistrement des permissions", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur réseau lors de la mise à jour", "error");
    }
  };

  const togglePermission = (user: any, permission: string) => {
    const currentPermissions = user.permissions || [];
    let newPermissions;
    if (currentPermissions.includes(permission)) {
      newPermissions = currentPermissions.filter((p: string) => p !== permission);
    } else {
      newPermissions = [...currentPermissions, permission];
    }
    handleUpdateUserPermissions(user.email, newPermissions);
  };

  const handleOpenEditUser = (user: any) => {
    setEditingUser(user);
    setEditUserName(user.name || "");
    setEditUserRole(user.role || "user");
    setEditUserPermissions(user.permissions || []);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const loadingToast = toast.loading("Enregistrement en cours...");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(editingUser.email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editUserName,
          role: editUserRole,
          permissions: editUserPermissions
        })
      });
      if (res.ok) {
        toast.success("Utilisateur mis à jour avec succès !", { id: loadingToast });
        setEditingUser(null);
        // Refresh users list
        fetch("/api/admin/users")
          .then(res => res.json())
          .then(data => setAllUsers(data))
          .catch(err => console.error(err));
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Erreur de mise à jour", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau", { id: loadingToast });
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (email === currentUser?.email) {
      toast.error("Vous ne pouvez pas supprimer votre propre compte !");
      return;
    }
    const isConfirmed = await confirmAction(
      "Supprimer l'utilisateur",
      `Êtes-vous sûr de vouloir supprimer définitivement ${email} ? Cette action est irréversible.`
    );
    if (!isConfirmed) return;

    const loadingToast = toast.loading("Suppression en cours...");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success("Utilisateur supprimé avec succès !", { id: loadingToast });
        // Refresh users list
        fetch("/api/admin/users")
          .then(res => res.json())
          .then(data => setAllUsers(data))
          .catch(err => console.error(err));
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Erreur de suppression", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau", { id: loadingToast });
    }
  };

  const permissionsList = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "workflow", label: "Workflow" },
    { id: "applications", label: "Dossiers" },
    { id: "publish", label: "Publication" },
    { id: "fields", label: "Champs" },
    { id: "visitor_chats", label: "Chats Live" },
    { id: "testimonials", label: "Avis" },
    { id: "security", label: "Sécurité" }
  ];

  // États pour la gestion, modification et suppression des dons
  const [publishSubTab, setPublishSubTab] = useState<"list" | "create">("list");
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("Matériel");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive" | "completed">("active");
  const [editAmount, setEditAmount] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editAgentName, setEditAgentName] = useState("");
  const [editAgentPhone, setEditAgentPhone] = useState("");
  const [editSpecifications, setEditSpecifications] = useState<Array<{ key: string; value: string }>>([]);
  const [isUploadingEditDonationImage, setIsUploadingEditDonationImage] = useState(false);
  const [editDonationImageStats, setEditDonationImageStats] = useState<any>(null);
  const [editDonor, setEditDonor] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Matériel");
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newLocation, setNewLocation] = useState("Paris, Île-de-France");
  const [newDonor, setNewDonor] = useState("");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [replyFile, setReplyFile] = useState<any>(null);
  const audioRecorderApp = useAudioRecorder();

  // Auto-upload audio for application chat
  useEffect(() => {
    if (audioRecorderApp.audioBlob) {
      const uploadAudio = async () => {
        try {
          const base64Audio = await blobToBase64(audioRecorderApp.audioBlob!);
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: base64Audio,
              fileName: "Note_vocale.webm",
              fileType: "audio/webm"
            })
          });
          const data = await res.json();
          if (data.success) {
            setReplyFile({
              name: "Note vocale",
              url: data.url,
              size_kb: data.originalSizeKb || Math.round((audioRecorderApp.audioBlob!.size / 1024) * 10) / 10,
              type: "audio/webm"
            });
            audioRecorderApp.clearAudio();
          } else {
            console.error("Échec de l'envoi de l'audio.");
          }
        } catch (err) {
          console.error("Erreur lors de l'envoi de la note vocale.", err);
        }
      };
      uploadAudio();
    }
  }, [audioRecorderApp.audioBlob]);

  // Etats pour les demandes de frais et les modes de paiement
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showPaymentRequestModal, setShowPaymentRequestModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReason, setPaymentReason] = useState("Frais de douane");
  const [customPaymentReason, setCustomPaymentReason] = useState("");
  const [showAddPaymentMethodModal, setShowAddPaymentMethodModal] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<any | null>(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: "",
    type: "crypto",
    details: "",
    cryptoAddress: "",
    cryptoCurrency: "USDT",
    bankName: "",
    iban: "",
    bic: "",
    accountHolder: ""
  });

  const [addFieldLabel, setAddFieldLabel] = useState("");
  const [addFieldType, setAddFieldType] = useState("text");

  // Nouvelle image de don avec upload et conversion WebP
  const [donationImageUrl, setDonationImageUrl] = useState("");
  const [isUploadingDonationImage, setIsUploadingDonationImage] = useState(false);
  const [donationImageStats, setDonationImageStats] = useState<any>(null);

  // Spécifications de don dynamiques
  const [specKey, setSpecKey] = useState("");
  const [specVal, setSpecVal] = useState("");
  const [customSpecs, setCustomSpecs] = useState<Record<string, string>>({});

  // Liste de témoignages attachés au don en cours de publication
  const [addedTestimonials, setAddedTestimonials] = useState<any[]>([]);

  // Formulaire d'ajout de témoignage individuel
  const [testAuthor, setTestAuthor] = useState("");
  const [testQuote, setTestQuote] = useState("");
  const [testMediaType, setTestMediaType] = useState<"text" | "audio" | "image" | "video">("text");
  const [testMediaUrl, setTestMediaUrl] = useState("");
  const [isUploadingTestFile, setIsUploadingTestFile] = useState(false);
  const [testFileStats, setTestFileStats] = useState<any>(null);

  // États de modération des témoignages
  const [editingTestimonial, setEditingTestimonial] = useState<any | null>(null);
  const [editAuthor, setEditAuthor] = useState("");
  const [editQuote, setEditQuote] = useState("");
  const [editMediaType, setEditMediaType] = useState<"text" | "audio" | "image" | "video">("text");
  const [editMediaUrl, setEditMediaUrl] = useState("");
  const [testimonialFilter, setTestimonialFilter] = useState<"all" | "pending" | "approved">("pending");
  const [isUploadingEditTestFile, setIsUploadingEditTestFile] = useState(false);
  const [editTestFileStats, setEditTestFileStats] = useState<any>(null);

  // États pour l'ajout manuel d'un témoignage par l'admin
  const [showAddTestimonialForm, setShowAddTestimonialForm] = useState(false);
  const [newTestAuthor, setNewTestAuthor] = useState("");
  const [newTestQuote, setNewTestQuote] = useState("");
  const [newTestMediaType, setNewTestMediaType] = useState<"text" | "audio" | "image" | "video">("text");
  const [newTestMediaUrl, setNewTestMediaUrl] = useState("");
  const [newTestDonationId, setNewTestDonationId] = useState("");
  const [isUploadingNewTestFile, setIsUploadingNewTestFile] = useState(false);
  const [newTestFileStats, setNewTestFileStats] = useState<any>(null);

  // États de gestion des partenaires
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [editPartnerName, setEditPartnerName] = useState("");
  const [editPartnerLogo, setEditPartnerLogo] = useState("");
  const [editPartnerWebsite, setEditPartnerWebsite] = useState("");

  // Temps Réel & Présence
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [visitorChats, setVisitorChats] = useState<Record<string, any[]>>({});
  const [localAppMessages, setLocalAppMessages] = useState<Record<string, any[]>>({});
  const [activeVisitorDonationId, setActiveVisitorDonationId] = useState<string | null>(null);
  const [adminChatInput, setAdminChatInput] = useState("");
  const [visitorReplyInput, setVisitorReplyInput] = useState("");
  const [visitorReplyFile, setVisitorReplyFile] = useState<any>(null);
  const audioRecorderSupport = useAudioRecorder();

  // Auto-upload audio for support chat
  useEffect(() => {
    if (audioRecorderSupport.audioBlob) {
      const uploadAudio = async () => {
        try {
          const base64Audio = await blobToBase64(audioRecorderSupport.audioBlob!);
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: base64Audio,
              fileName: "Note_vocale.webm",
              fileType: "audio/webm"
            })
          });
          const data = await res.json();
          if (data.success) {
            setVisitorReplyFile({
              name: "Note vocale",
              url: data.url,
              size_kb: data.originalSizeKb || Math.round((audioRecorderSupport.audioBlob!.size / 1024) * 10) / 10,
              type: "audio/webm"
            });
            audioRecorderSupport.clearAudio();
          } else {
            console.error("Échec de l'envoi de l'audio.");
          }
        } catch (err) {
          console.error("Erreur lors de l'envoi de la note vocale.", err);
        }
      };
      uploadAudio();
    }
  }, [audioRecorderSupport.audioBlob]);
  const [isSendingVisitorReply, setIsSendingVisitorReply] = useState(false);
  const [isSendingAdminReply, setIsSendingAdminReply] = useState(false);

  // Nouveaux états de notifications et de compteurs pour l'administrateur et le responsable
  const [visitorUnreadCounts, setVisitorUnreadCounts] = useState<Record<string, number>>({});
  const [appUnreadCounts, setAppUnreadCounts] = useState<Record<string, number>>({});
  const [activeToast, setActiveToast] = useState<{ id: string; title: string; senderName: string; content: string } | null>(null);

  const totalVisitorUnread = Object.values(visitorUnreadCounts || {}).reduce((acc: number, val: any) => acc + (val || 0), 0) as number;
  const totalAppUnread = Object.values(appUnreadCounts || {}).reduce((acc: number, val: any) => acc + (val || 0), 0) as number;

  const [activeVisitorUserId, setActiveVisitorUserId] = useState<string | null>(null);
  const [activeVisitorUnifiedMessages, setActiveVisitorUnifiedMessages] = useState<any[]>([]);
  const [activeAppUnifiedMessages, setActiveAppUnifiedMessages] = useState<any[]>([]);

  // Regrouper les messages par utilisateur au lieu de par donation_id
  const visitorChatsByUser = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    Object.values(visitorChats).flat().forEach((msg: any) => {
      // On utilise le user_name comme clé, ou "Visiteur" si absent
      const userKey = msg.user_name || "Visiteur";
      if (!grouped[userKey]) grouped[userKey] = [];
      
      // Éviter les doublons lors du regroupement à plat
      if (!grouped[userKey].some((m: any) => m.id === msg.id)) {
        grouped[userKey].push(msg);
      }
    });

    // Trier les messages de chaque utilisateur par date et les utilisateurs par dernier message reçu
    const sortedUsers: Record<string, any[]> = {};
    const userEntries = Object.entries(grouped).sort((a, b) => {
      const lastA = new Date(a[1][a[1].length - 1].created_at || 0).getTime();
      const lastB = new Date(b[1][b[1].length - 1].created_at || 0).getTime();
      return lastB - lastA; // Plus récent en premier
    });

    userEntries.forEach(([user, msgs]) => {
      sortedUsers[user] = msgs.sort((a, b) => 
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );
    });

    return sortedUsers;
  }, [visitorChats]);

  // Réinitialiser les messages non lus pour l'utilisateur actif
  useEffect(() => {
    if (activeVisitorUserId) {
      // On remet à zéro tous les dons liés à cet utilisateur
      const userMsgs = visitorChatsByUser[activeVisitorUserId] || [];
      const donationIds = Array.from(new Set(userMsgs.map((m: any) => m.donation_id)));
      setVisitorUnreadCounts(prev => {
        const next = { ...prev };
        donationIds.forEach((id: any) => { if (id) next[id] = 0; });
        return next;
      });
    }
  }, [activeVisitorUserId, visitorChatsByUser]);

  // Réinitialiser les messages non lus pour le dossier d'instruction actif
  useEffect(() => {
    if (selectedAppId) {
      setAppUnreadCounts(prev => ({ ...prev, [selectedAppId]: 0 }));
    }
  }, [selectedAppId]);

  // Gérer le délai d'affichage du toast de notification
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  // Synchroniser le chat visiteur actif avec l'historique complet unifié (Live + Dossier)
  useEffect(() => {
    if (!activeVisitorUserId) {
      setActiveVisitorUnifiedMessages([]);
      return;
    }
    
    const userMsgs = visitorChatsByUser[activeVisitorUserId] || [];
    const firstWithUserId = userMsgs.find(m => m.user_id && m.user_id !== "null" && m.user_id !== "undefined");
    const visitorUserId = firstWithUserId?.user_id || "";
    const encodedName = encodeURIComponent(activeVisitorUserId);
    
    const abortController = new AbortController();
    const fetchUnified = async () => {
      try {
        const res = await fetch(`/api/all-user-messages?user_id=${visitorUserId}&user_name=${encodedName}`, { signal: abortController.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setActiveVisitorUnifiedMessages(data);
        }
      } catch (err: any) {
        // Ignorer les erreurs d'abandon ou de déconnexion momentanée
      }
    };

    fetchUnified();
    const interval = setInterval(fetchUnified, 4000);
    return () => {
      clearInterval(interval);
      abortController.abort();
    };
  }, [activeVisitorUserId, visitorChatsByUser]);

  // Synchroniser le chat du dossier actif avec l'historique complet unifié (Live + Dossier)
  useEffect(() => {
    if (!selectedAppId) {
      setActiveAppUnifiedMessages([]);
      return;
    }
    const selectedApp = applications.find(a => a.id === selectedAppId);
    if (!selectedApp) {
      setActiveAppUnifiedMessages([]);
      return;
    }
    
    const encodedName = encodeURIComponent(selectedApp.user_name || "");
    const userId = selectedApp.user_id || "";
    const abortController = new AbortController();

    const fetchUnified = async () => {
      try {
        const res = await fetch(`/api/all-user-messages?user_id=${userId}&user_name=${encodedName}`, { signal: abortController.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setActiveAppUnifiedMessages(data);
        }
      } catch (err: any) {
        // Ignorer les erreurs d'abandon ou de déconnexion momentanée
      }
    };

    fetchUnified();
    const interval = setInterval(fetchUnified, 4000);
    return () => {
      clearInterval(interval);
      abortController.abort();
    };
  }, [selectedAppId, applications]);

  const appsRef = useRef(applications);
  const donsRef = useRef(donations);

  useEffect(() => {
    appsRef.current = applications;
  }, [applications]);

  useEffect(() => {
    donsRef.current = donations;
  }, [donations]);

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch("/api/settings/payment_methods");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPaymentMethods(data);
        } else if (data && typeof data === "object" && Array.isArray(data.value) && data.value.length > 0) {
          setPaymentMethods(data.value);
        } else {
          const defaultMethods = [
            {
              id: "metamask",
              name: "Crypto-monnaie (MetaMask)",
              type: "crypto",
              details: "Paiement ultra-sécurisé et instantané via le portefeuille MetaMask.",
              cryptoAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
              cryptoCurrency: "ETH",
              active: true
            },
            {
              id: "virement",
              name: "Virement Bancaire",
              type: "virement",
              details: "Virement bancaire direct. Merci de mentionner votre numéro de dossier en libellé.",
              bankName: "Société Générale",
              iban: "FR76 3000 3000 0000 1234 5678 901",
              bic: "SOGEFRPPXXX",
              accountHolder: "Pôle de Dons France",
              active: true
            }
          ];
          setPaymentMethods(defaultMethods);
          await savePaymentMethods(defaultMethods);
        }
      }
    } catch (e) {
      console.error("Erreur de chargement des modes de paiement:", e);
    }
  };

  const savePaymentMethods = async (methodsList: any[]) => {
    try {
      await fetch("/api/settings/payment_methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: methodsList })
      });
      setPaymentMethods(methodsList);
    } catch (e) {
      console.error("Erreur d'enregistrement des modes de paiement:", e);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    // Charger l'historique initial des chats
    const fetchConversations = () => {
      fetch("/api/agent-conversations?is_admin=true")
        .then(res => res.json())
        .then(data => {
          setVisitorChats(prev => {
            let hasChanges = false;
            const updated = { ...prev };
            
            Object.keys(data).forEach(donationId => {
              const prevMsgs = prev[donationId] || [];
              const newMsgs = data[donationId] || [];
              
              if (newMsgs.length > prevMsgs.length) {
                hasChanges = true;
                updated[donationId] = newMsgs.map((m: any) => ({
                  ...m,
                  time: m.time || new Date(m.created_at || Date.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                }));
                
                // Si l'utilisateur / visiteur a envoyé un nouveau message dans une conversation inactive
                if (donationId !== activeVisitorDonationId) {
                  const newIncomingMsgs = newMsgs.slice(prevMsgs.length).filter((m: any) => m.sender === "user" || m.sender_type === "user");
                  if (newIncomingMsgs.length > 0) {
                    setVisitorUnreadCounts(prevUnread => ({
                      ...prevUnread,
                      [donationId]: (prevUnread[donationId] || 0) + newIncomingMsgs.length
                    }));
                    
                    const latestMsg = newIncomingMsgs[newIncomingMsgs.length - 1];
                    setActiveToast({
                      id: latestMsg.id || Math.random().toString(),
                      title: "Messagerie Visiteur",
                      senderName: latestMsg.user_name || "Visiteur",
                      content: latestMsg.content
                    });
                  }
                }
              }
            });
            
            return hasChanges ? updated : prev;
          });
        })
        .catch(err => console.warn("Erreur historique chats (attendu si hors ligne ou restart) :", err));
    };

    fetchConversations();

    // Poller également les messages du dossier d'instruction actif
    const fetchActiveAppMessages = () => {
      if (!selectedAppId) return;
      fetch(`/api/messages/${selectedAppId}`)
        .then(res => res.json())
        .then(data => {
          setLocalAppMessages(prev => {
            const prevMsgs = prev[selectedAppId] || [];
            if (JSON.stringify(prevMsgs) !== JSON.stringify(data)) {
              return { ...prev, [selectedAppId]: data };
            }
            return prev;
          });
        })
        .catch(err => console.error("Erreur polling messages dossier:", err));
    };

    fetchActiveAppMessages();

    // Démarrer l'intervalle de polling à haute fiabilité
    const pollInterval = setInterval(() => {
      fetchConversations();
      fetchActiveAppMessages();
    }, 4000);

    socket.on("presence:update", (data) => {
      // Filtrer pour ne compter que les non-admins (visiteurs)
      const visitors = data.users.filter((u: any) => !u.is_admin);
      setOnlineCount(visitors.length);
      setOnlineUsers(visitors);
    });

    const handleMessageReceived = (payload: any) => {
      setVisitorChats(prev => {
        const list = prev[payload.donation_id] || [];
        // Éviter les doublons basés sur l'ID ou le contenu + date
        if (list.some(m => m.id === payload.id || (m.content === payload.content && m.created_at === payload.created_at && m.sender === payload.sender))) {
          return prev;
        }
        return {
          ...prev,
          [payload.donation_id]: [...list, {
            ...payload,
            time: new Date(payload.created_at || Date.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
          }]
        };
      });

      // Si c'est un message envoyé par l'utilisateur / visiteur
      if (payload.sender === "user") {
        if (payload.donation_id !== activeVisitorDonationId) {
          setVisitorUnreadCounts(prev => ({
            ...prev,
            [payload.donation_id]: (prev[payload.donation_id] || 0) + 1
          }));

          setActiveToast({
            id: payload.id || Math.random().toString(),
            title: "Messagerie Visiteur",
            senderName: payload.user_name || "Visiteur",
            content: payload.content
          });
        }
      }
    };

    const handleApplicationMessageReceived = (payload: any) => {
      setLocalAppMessages(prev => {
        const list = prev[payload.application_id] || [];
        if (list.some(m => m.id === payload.id)) return prev;
        return {
          ...prev,
          [payload.application_id]: [...list, payload]
        };
      });

      // Si c'est un message d'instruction envoyé par l'utilisateur / candidat
      if (payload.sender_type === "user") {
        if (payload.application_id !== selectedAppId) {
          setAppUnreadCounts(prev => ({
            ...prev,
            [payload.application_id]: (prev[payload.application_id] || 0) + 1
          }));

          const matchedApp = appsRef.current.find(a => a.id === payload.application_id);
          const candidateName = matchedApp ? matchedApp.user_name : "Candidat";
          const matchedDonation = donsRef.current.find(d => d.id === matchedApp?.donation_id);
          const donationTitleStr = matchedDonation ? matchedDonation.title : "Dossier";

          setActiveToast({
            id: payload.id || Math.random().toString(),
            title: `Instruction - ${donationTitleStr}`,
            senderName: candidateName,
            content: payload.content
          });
        } else {
          // Actualiser directement localement si on est sur ce dossier
          fetchActiveAppMessages();
        }
      }
    };

    const handleApplicationMessageUpdated = (payload: any) => {
      setLocalAppMessages(prev => {
        const list = prev[payload.application_id] || [];
        const index = list.findIndex(m => m.id === payload.id);
        if (index === -1) return prev;
        const newList = [...list];
        newList[index] = payload;
        return {
          ...prev,
          [payload.application_id]: newList
        };
      });
      // S'il s'agit du dossier actif, actualiser le flux de message unifié
      if (payload.application_id === selectedAppId) {
        fetchActiveAppMessages();
      }
    };

    socket.on("message:received", handleMessageReceived);
    socket.on("application_message:received", handleApplicationMessageReceived);
    socket.on("application_message:updated", handleApplicationMessageUpdated);

    return () => {
      clearInterval(pollInterval);
      socket.off("presence:update");
      socket.off("message:received", handleMessageReceived);
      socket.off("application_message:received", handleApplicationMessageReceived);
      socket.off("application_message:updated", handleApplicationMessageUpdated);
    };
  }, [activeVisitorDonationId, selectedAppId]);

  const handleSendAdminChat = async (donationId: string) => {
    const content = adminChatInput.trim() || visitorReplyInput.trim();
    if (!content && !visitorReplyFile) return;
    
    setIsSendingVisitorReply(true);

    const payload = {
      donation_id: donationId,
      sender: 'agent' as const,
      content: content,
      user_name: "Administrateur",
      is_auth: true,
      attachment: visitorReplyFile,
      created_at: new Date().toISOString()
    };

    try {
      await fetch(`/api/agent-conversations/${donationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Erreur d'envoi du message:", e);
    } finally {
      setIsSendingVisitorReply(false);
      setAdminChatInput("");
      setVisitorReplyInput("");
      setVisitorReplyFile(null);
    }
  };

  const handleVisitorReplyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 900 * 1024) {
        alert("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setVisitorReplyFile({
          name: file.name,
          type: file.type,
          data: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendVisitorReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVisitorUserId || (!visitorReplyInput.trim() && !visitorReplyFile)) return;
    
    // Trouver le dernier donation_id de cet utilisateur pour lui répondre au bon endroit
    const userMsgs = visitorChatsByUser[activeVisitorUserId] || [];
    // On cherche le dernier message qui a un donation_id valide (pas null)
    const lastValidMsg = [...userMsgs].reverse().find(m => m.donation_id);
    const donationId = lastValidMsg?.donation_id || "general";
    
    handleSendAdminChat(donationId);
  };

  const handleSaveTrainingEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainingKeywords.trim() || !trainingResponse.trim()) {
      toast.error("Veuillez renseigner les mots-clés et la réponse automatique.");
      return;
    }

    setIsSavingTraining(true);
    const loadingToast = toast.loading("Enregistrement en cours...");

    const payload = {
      keywords: trainingKeywords,
      response: trainingResponse,
      is_confidential: trainingIsConfidential
    };

    try {
      const url = selectedTrainingEntry 
        ? `/api/chatbot-training/${selectedTrainingEntry.id}`
        : "/api/chatbot-training";
      const method = selectedTrainingEntry ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(
          selectedTrainingEntry 
            ? "Entrée d'entraînement mise à jour avec succès" 
            : "Nouvelle entrée d'entraînement créée avec succès",
          { id: loadingToast }
        );
        setIsTrainingModalOpen(false);
        setTrainingKeywords("");
        setTrainingResponse("");
        setTrainingIsConfidential(false);
        setSelectedTrainingEntry(null);
        loadChatbotTraining();
      } else {
        toast.error("Une erreur est survenue lors de l'enregistrement.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur de connexion avec le serveur.", { id: loadingToast });
    } finally {
      setIsSavingTraining(false);
    }
  };

  const handleDeleteTrainingEntry = async (id: string) => {
    const isConfirmed = await confirmAction(
      "Supprimer l'entrée d'entraînement", 
      "Voulez-vous vraiment supprimer définitivement cette réponse automatique de la base de connaissances ?"
    );
    if (!isConfirmed) return;

    const loadingToast = toast.loading("Suppression en cours...");
    try {
      const res = await fetch(`/api/chatbot-training/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        toast.success("Entrée d'entraînement supprimée avec succès.", { id: loadingToast });
        loadChatbotTraining();
      } else {
        toast.error("Erreur lors de la suppression de l'entrée.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur de connexion.", { id: loadingToast });
    }
  };

  const handleOpenEditTrainingModal = (entry: any) => {
    setSelectedTrainingEntry(entry);
    setTrainingKeywords(entry.keywords.join(", "));
    setTrainingResponse(entry.response);
    setTrainingIsConfidential(!!entry.is_confidential);
    setIsTrainingModalOpen(true);
  };

  const handleOpenCreateTrainingModal = () => {
    setSelectedTrainingEntry(null);
    setTrainingKeywords("");
    setTrainingResponse("");
    setTrainingIsConfidential(false);
    setIsTrainingModalOpen(true);
  };

  const handleApproveTestimonial = async (id: string, approve: boolean) => {
    const loadingToast = toast.loading(approve ? "Approbation de l'avis en cours..." : "Rejet de l'avis en cours...");
    try {
      const res = await fetch(`/api/testimonials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: approve })
      });
      if (res.ok) {
        toast.success(approve ? "Témoignage approuvé avec succès !" : "Témoignage rejeté avec succès !", { id: loadingToast });
        if (onRefreshData) onRefreshData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Erreur lors de la mise à jour du témoignage.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau lors de la communication avec le serveur.", { id: loadingToast });
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    const isConfirmed = await confirmAction("Supprimer le témoignage", "Voulez-vous vraiment supprimer définitivement ce témoignage ?");
    if (!isConfirmed) return;
    const loadingToast = toast.loading("Suppression en cours...");
    try {
      const res = await fetch(`/api/testimonials/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success("Témoignage supprimé avec succès", { id: loadingToast });
        if (onRefreshData) onRefreshData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la suppression", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau lors de la suppression", { id: loadingToast });
    }
  };

  const handleOpenEditTestimonial = (test: any) => {
    setEditingTestimonial(test);
    setEditAuthor(test.author_name || "");
    setEditQuote(test.quote || "");
    setEditMediaType(test.media_type || "text");
    setEditMediaUrl(test.railway_media_url || "");
    setEditTestFileStats(null);
  };

  const handleSaveTestimonialEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTestimonial) return;

    try {
      const res = await fetch(`/api/testimonials/${editingTestimonial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: editAuthor.trim(),
          quote: editQuote.trim(),
          media_type: editMediaType,
          railway_media_url: editMediaUrl.trim()
        })
      });
      if (res.ok) {
        setEditingTestimonial(null);
        if (onRefreshData) onRefreshData();
        alert("Témoignage mis à jour avec succès !");
      } else {
        alert("Erreur lors de la modification du témoignage.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditTestFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 900 * 1024) {
      alert("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
      e.target.value = "";
      return;
    }

    setIsUploadingEditTestFile(true);
    setEditTestFileStats(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            fileName: file.name,
            fileType: file.type
          })
        });
        const uploadRes = await res.json();
        if (uploadRes.success) {
          setEditMediaUrl(uploadRes.url);
          setEditTestFileStats({
            sizeFormatted: uploadRes.optimizedSizeKb + " Ko",
            format: uploadRes.format
          });
        } else {
          alert("Erreur d'upload : " + uploadRes.error);
        }
      } catch (err) {
        console.error(err);
        alert("Une erreur est survenue lors du chargement du fichier.");
      } finally {
        setIsUploadingEditTestFile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEditPartner = (partner: any) => {
    setEditingPartner(partner);
    setEditPartnerName(partner.name);
    setEditPartnerLogo(partner.logo_url);
    setEditPartnerWebsite(partner.website || "");
  };

  const handleSavePartnerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;
    try {
      const res = await fetch(`/api/admin/partners/${editingPartner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editPartnerName,
          logo_url: editPartnerLogo,
          website: editPartnerWebsite
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setPartners(prev => prev.map(p => p.id === updated.id ? updated : p));
        setEditingPartner(null);
        if (onRefreshData) onRefreshData();
        alert("Partenaire mis à jour !");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Workflow Editor States
  const [newStepLabel, setNewStepLabel] = useState("");
  const [newStepDesc, setNewStepDesc] = useState("");
  const [newStepIcon, setNewStepIcon] = useState("Paperclip");
  const [newStepHasText, setNewStepHasText] = useState(false);
  const [newStepTextLabel, setNewStepTextLabel] = useState("");
  const [newStepTextPlaceholder, setNewStepTextPlaceholder] = useState("");
  const [newStepFileType, setNewStepFileType] = useState<"none" | "image" | "pdf" | "any">("none");

  // Workflow step editing states
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [editStepLabel, setEditStepLabel] = useState("");
  const [editStepDesc, setEditStepDesc] = useState("");
  const [editStepIcon, setEditStepIcon] = useState("Paperclip");
  const [editStepHasText, setEditStepHasText] = useState(false);
  const [editStepTextLabel, setEditStepTextLabel] = useState("");
  const [editStepTextPlaceholder, setEditStepTextPlaceholder] = useState("");
  const [editStepFileType, setEditStepFileType] = useState<"none" | "image" | "pdf" | "any">("none");
  const [editStepTransferModes, setEditStepTransferModes] = useState<Record<string, Array<{label: string, desc: string}>>>({});
  
  // États d'ajout de mode de transfert temporaires dans l'édition
  const [selectedTransferCategory, setSelectedTransferCategory] = useState("Financier");
  const [newTransferLabel, setNewTransferLabel] = useState("");
  const [newTransferDesc, setNewTransferDesc] = useState("");

  // Icons disponibles
  const availableIcons = [
    { name: "FileText", label: "Note / Texte" },
    { name: "Sparkles", label: "Étoiles / Projet" },
    { name: "ShieldCheck", label: "Bouclier / Identité" },
    { name: "Mic", label: "Micro / Oral" },
    { name: "Truck", label: "Camion / Livraison" },
    { name: "Paperclip", label: "Trombone / Document" },
    { name: "FileCheck", label: "Validation" },
    { name: "HelpCircle", label: "Point d'interrogation" }
  ];

  const handleAddField = () => {
    if (!addFieldLabel.trim()) {
      alert("Veuillez saisir un libellé pour le champ");
      return;
    }
    const key = addFieldLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (adminDefinedFields.some(f => f.key === key)) {
      alert("Un champ avec un libellé similaire existe déjà !");
      return;
    }

    const newField = {
      key,
      label: addFieldLabel.trim(),
      type: addFieldType,
      placeholder: addFieldType === "file" ? "Sélectionner un fichier..." : `Saisir votre ${addFieldLabel.toLowerCase()}...`
    };

    onChangeFields([...adminDefinedFields, newField]);
    setAddFieldLabel("");
  };

  const handleDeleteField = async (key: string) => {
    const isConfirmed = await confirmAction("Supprimer le champ", "Voulez-vous vraiment supprimer ce champ ?");
    if (isConfirmed) {
      onChangeFields(adminDefinedFields.filter(f => f.key !== key));
    }
  };

  const copySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDonationImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 900 * 1024) {
      alert("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
      e.target.value = "";
      return;
    }

    setIsUploadingDonationImage(true);
    setDonationImageStats(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            fileName: file.name,
            fileType: file.type
          })
        });
        const data = await res.json();
        if (data.url) {
          setDonationImageUrl(data.url);
          setDonationImageStats(data);
        } else {
          alert("Erreur lors de la compression de l'image");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsUploadingDonationImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditDonationImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 900 * 1024) {
      alert("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
      e.target.value = "";
      return;
    }

    setIsUploadingEditDonationImage(true);
    setEditDonationImageStats(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            fileName: file.name,
            fileType: file.type
          })
        });
        const data = await res.json();
        if (data.url) {
          setEditImageUrl(data.url);
          setEditDonationImageStats(data);
        } else {
          alert("Erreur lors de la compression de l'image");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsUploadingEditDonationImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTestimonialFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 900 * 1024) {
      alert("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
      e.target.value = "";
      return;
    }

    setIsUploadingTestFile(true);
    setTestFileStats(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            fileName: file.name,
            fileType: file.type
          })
        });
        const data = await res.json();
        if (data.url) {
          // If the media is audio, we mark format as opus to simulate the request
          if (testMediaType === "audio") {
            data.format = "Opus";
          }
          setTestMediaUrl(data.url);
          setTestFileStats(data);
        } else {
          alert("Erreur lors de l'envoi du média");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsUploadingTestFile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddSpec = () => {
    if (!specKey.trim() || !specVal.trim()) return;
    setCustomSpecs(prev => ({ ...prev, [specKey.trim()]: specVal.trim() }));
    setSpecKey("");
    setSpecVal("");
  };

  const handleRemoveSpec = (key: string) => {
    setCustomSpecs(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAddTestimonial = () => {
    if (!testAuthor.trim()) {
      alert("Veuillez indiquer le nom de l'auteur");
      return;
    }
    const newT = {
      id: `temp_${Date.now()}`,
      author_name: testAuthor.trim(),
      quote: testQuote.trim() || undefined,
      media_type: testMediaType,
      railway_media_url: testMediaUrl || undefined,
      fileStats: testFileStats
    };
    setAddedTestimonials(prev => [...prev, newT]);
    setTestAuthor("");
    setTestQuote("");
    setTestMediaUrl("");
    setTestFileStats(null);
  };

  const handleManualAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestAuthor || !newTestQuote || !newTestDonationId) {
      toast.error("Veuillez remplir les champs obligatoires (Auteur, Message, Don concerné)");
      return;
    }

    const loadingToast = toast.loading("Création du témoignage...");
    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donation_id: newTestDonationId,
          media_type: newTestMediaType,
          railway_media_url: newTestMediaUrl,
          author_name: newTestAuthor,
          quote: newTestQuote,
          approved: true // L'admin l'ajoute directement, donc approuvé par défaut
        })
      });

      if (res.ok) {
        toast.success("Témoignage ajouté avec succès !", { id: loadingToast });
        setShowAddTestimonialForm(false);
        setNewTestAuthor("");
        setNewTestQuote("");
        setNewTestMediaUrl("");
        setNewTestDonationId("");
        setNewTestFileStats(null);
        setNewTestMediaType("text");
        if (onRefreshData) onRefreshData();
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Échec de l'ajout du témoignage", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'ajout", { id: loadingToast });
    }
  };

  const handleManualTestFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 900 * 1024) {
      toast.error("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
      e.target.value = "";
      return;
    }

    setIsUploadingNewTestFile(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            fileName: file.name,
            fileType: file.type
          })
        });
        const data = await res.json();
        if (data.success) {
          setNewTestMediaUrl(data.url);
          setNewTestFileStats({
            size: data.optimizedSizeKb + " Ko",
            format: data.format
          });
        } else {
          toast.error("Erreur lors de l'upload");
        }
      } catch (err) {
        console.error(err);
        toast.error("Erreur lors du traitement");
      } finally {
        setIsUploadingNewTestFile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveTestimonial = (tempId: string) => {
    setAddedTestimonials(prev => prev.filter(t => t.id !== tempId));
  };

  const handleEditDonation = (donation: Donation) => {
    setEditingDonation(donation);
    setEditTitle(donation.title);
    setEditCategory(donation.category || "Matériel");
    setEditDesc(donation.description || "");
    setEditStatus((donation.status as any) || "active");
    setEditAmount(donation.target_amount ? String(donation.target_amount) : "");
    setEditLocation(donation.location || "");
    setEditImageUrl(donation.image_url || "");
    setEditAgentName(donation.agent_name || "");
    setEditAgentPhone(donation.agent_phone || "");
    setEditDonor(donation.donor_name || "");
    
    const specsArray = donation.specifications 
      ? Object.entries(donation.specifications).map(([key, value]) => ({ key, value }))
      : [];
    setEditSpecifications(specsArray);
    setEditDonationImageStats(null);
  };

  const handleUpdateDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDonation) return;

    if (!editTitle.trim() || !editDesc.trim()) {
      showToast("Veuillez remplir les champs obligatoires (titre, description)", "error");
      return;
    }

    const specsObj: Record<string, string> = {};
    editSpecifications.forEach(spec => {
      if (spec.key.trim()) {
        specsObj[spec.key.trim()] = spec.value.trim();
      }
    });

    try {
      const response = await fetch(`/api/donations/${editingDonation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          category: editCategory,
          description: editDesc.trim(),
          status: editStatus,
          target_amount: editAmount ? Number(editAmount) : null,
          image_url: editImageUrl.trim(),
          location: editLocation.trim(),
          specifications: specsObj,
          agent_name: editAgentName.trim(),
          agent_phone: editAgentPhone.trim(),
          donor_name: editDonor.trim()
        })
      });

      if (response.ok) {
        showToast("Don solidaire mis à jour avec succès !", "success");
        setEditingDonation(null);
        onRefreshData?.();
      } else {
        showToast("Une erreur est survenue lors de la mise à jour du don.", "error");
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du don:", error);
      showToast("Erreur de connexion lors de la mise à jour.", "error");
    }
  };

  const handleDeleteDonation = async (id: string) => {
    const isConfirmed = await confirmAction("Supprimer le don", "Êtes-vous sûr de vouloir supprimer définitivement ce don ainsi que toutes les données associées ?");
    if (!isConfirmed) return;

    if (onDeleteDonation) {
      await onDeleteDonation(id);
      return;
    }

    try {
      const response = await fetch(`/api/donations/${id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        showToast("Don supprimé avec succès !", "success");
        onRefreshData?.();
      } else {
        showToast("Une erreur est survenue lors de la suppression.", "error");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du don:", error);
      showToast("Erreur de connexion lors de la suppression.", "error");
    }
  };

  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethodForm.name.trim()) return;

    let updatedList;
    if (editingPaymentMethod) {
      updatedList = paymentMethods.map(m => m.id === editingPaymentMethod.id ? { ...m, ...paymentMethodForm } : m);
    } else {
      const newMethod = {
        id: Math.random().toString(36).substring(2, 9),
        ...paymentMethodForm,
        active: true
      };
      updatedList = [...paymentMethods, newMethod];
    }

    await savePaymentMethods(updatedList);
    setShowAddPaymentMethodModal(false);
    setEditingPaymentMethod(null);
    showToast("Mode de paiement enregistré !", "success");
  };

  const handleTogglePaymentMethod = async (methodId: string) => {
    const updatedList = paymentMethods.map(m => m.id === methodId ? { ...m, active: !m.active } : m);
    await savePaymentMethods(updatedList);
    showToast("Statut mis à jour !", "success");
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    const isConfirmed = await confirmAction("Supprimer le mode", "Êtes-vous sûr de vouloir supprimer ce mode de paiement ?");
    if (!isConfirmed) return;
    const updatedList = paymentMethods.filter(m => m.id !== methodId);
    await savePaymentMethods(updatedList);
    showToast("Mode de paiement supprimé !", "success");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) {
      showToast("Veuillez remplir les champs obligatoires", "error");
      return;
    }

    const finalImageUrl = donationImageUrl.trim() || "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=800";

    const createdDonation = await onCreateDonation({
      title: newTitle.trim(),
      category: newCategory,
      description: newDesc.trim(),
      target_amount: newAmount ? Number(newAmount) : null,
      image_url: finalImageUrl,
      location: newLocation.trim(),
      specifications: customSpecs,
      agent_name: "Marc Dubreuil",
      donor_name: newDonor.trim() || "Anonyme"
    });

    if (createdDonation && createdDonation.id) {
      // Publier tous les témoignages associés
      for (const t of addedTestimonials) {
        await fetch("/api/testimonials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            donation_id: createdDonation.id,
            media_type: t.media_type,
            railway_media_url: t.railway_media_url,
            author_name: t.author_name,
            quote: t.quote
          })
        });
      }

      setNewTitle("");
      setNewDesc("");
      setNewAmount("");
      setNewLocation("Paris, Île-de-France");
      setNewDonor("");
      setDonationImageUrl("");
      setDonationImageStats(null);
      setCustomSpecs({});
      setAddedTestimonials([]);
      showToast("Don solidaire et témoignages publiés avec succès !", "success");
      setActiveTab("overview");
    } else {
      showToast("Une erreur est survenue lors de la création du don.", "error");
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId || (!replyInput.trim() && !replyFile)) return;
    
    setIsSendingAdminReply(true);
    try {
      await onSendAdminMessage(selectedAppId, replyInput.trim(), replyFile);
      setReplyInput("");
      setReplyFile(null);
    } finally {
      setIsSendingAdminReply(false);
    }
  };

  const handleReplyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 900 * 1024) {
        alert("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setReplyFile({
          name: file.name,
          type: file.type,
          data: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Ajouter une étape au workflow
  const handleAddWorkflowStep = () => {
    if (!newStepLabel.trim()) {
      alert("Le libellé de l'étape est obligatoire");
      return;
    }
    const newStep: WorkflowStep = {
      id: `custom_${Date.now()}`,
      label: newStepLabel.trim(),
      description: newStepDesc.trim() || "Veuillez compléter cette étape requise par l'administration.",
      iconName: newStepIcon,
      hasTextField: newStepHasText,
      textFieldLabel: newStepHasText ? (newStepTextLabel.trim() || "Information complémentaire") : undefined,
      textFieldPlaceholder: newStepHasText ? (newStepTextPlaceholder.trim() || "Saisissez votre réponse...") : undefined,
      requiredFileType: newStepFileType,
      transferModesByCategory: {}
    };

    onChangeWorkflowSteps([...workflowSteps, newStep]);
    // Reset inputs
    setNewStepLabel("");
    setNewStepDesc("");
    setNewStepIcon("Paperclip");
    setNewStepHasText(false);
    setNewStepTextLabel("");
    setNewStepTextPlaceholder("");
    setNewStepFileType("none");
    showToast("Nouvelle étape de traitement ajoutée avec succès ! Les futurs taux d'avancement des dossiers s'adapteront à cette nouvelle étape.", "success");
  };

  // Supprimer une étape personnalisée du workflow
  const handleDeleteWorkflowStep = async (id: string, index: number) => {
    if (index < 5) {
      showToast("Les 5 premières étapes réglementaires et logistiques ne peuvent pas être supprimées car elles sont requises pour l'instruction initiale.", "error");
      return;
    }
    const isConfirmed = await confirmAction("Retirer l'étape", "Voulez-vous vraiment retirer cette étape ? Les dossiers en cours d'avancement recalibreront leur pourcentage.");
    if (isConfirmed) {
      const updated = workflowSteps.filter(st => st.id !== id);
      onChangeWorkflowSteps(updated);
    }
  };

  // Commencer l'édition d'une étape
  const startEditingStep = (step: WorkflowStep) => {
    setEditingStep(step);
    setEditStepLabel(step.label);
    setEditStepDesc(step.description);
    setEditStepIcon(step.iconName || "Paperclip");
    setEditStepFileType(step.requiredFileType || "none");
    setEditStepHasText(!!step.hasTextField);
    setEditStepTextLabel(step.textFieldLabel || "");
    setEditStepTextPlaceholder(step.textFieldPlaceholder || "");
    setEditStepTransferModes(step.transferModesByCategory || {});
  };

  // Sauvegarder l'étape en cours de modification
  const handleSaveEditedStep = () => {
    if (!editingStep) return;
    if (!editStepLabel.trim()) {
      alert("Le libellé de l'étape est obligatoire");
      return;
    }
    
    const updatedSteps = workflowSteps.map(st => {
      if (st.id === editingStep.id) {
        return {
          ...st,
          label: editStepLabel.trim(),
          description: editStepDesc.trim(),
          iconName: editStepIcon,
          requiredFileType: editStepFileType,
          hasTextField: editStepHasText,
          textFieldLabel: editStepHasText ? (editStepTextLabel.trim() || "Information complémentaire") : undefined,
          textFieldPlaceholder: editStepHasText ? (editStepTextPlaceholder.trim() || "Saisissez votre réponse...") : undefined,
          transferModesByCategory: editStepTransferModes
        };
      }
      return st;
    });
    
    onChangeWorkflowSteps(updatedSteps);
    setEditingStep(null);
    showToast("Étape du workflow modifiée et synchronisée avec succès !", "success");
  };

  // Ajouter un mode de transfert pour une catégorie de don spécifique dans l'édition
  const handleAddTransferMode = () => {
    if (!newTransferLabel.trim()) {
      alert("Le titre du mode de transfert est obligatoire.");
      return;
    }
    
    const categoryKey = selectedTransferCategory;
    const currentCategoryModes = editStepTransferModes[categoryKey] || [];
    
    const updatedModesForCategory = [
      ...currentCategoryModes,
      { label: newTransferLabel.trim(), desc: newTransferDesc.trim() || "Aucune description supplémentaire" }
    ];
    
    setEditStepTransferModes({
      ...editStepTransferModes,
      [categoryKey]: updatedModesForCategory
    });
    
    setNewTransferLabel("");
    setNewTransferDesc("");
    showToast(`Mode de transfert ajouté pour la catégorie ${categoryKey}`, "success");
  };

  // Supprimer un mode de transfert de l'édition
  const handleRemoveTransferMode = (category: string, modeIdx: number) => {
    const currentCategoryModes = editStepTransferModes[category] || [];
    const updated = currentCategoryModes.filter((_, idx) => idx !== modeIdx);
    
    const updatedTransferModes = { ...editStepTransferModes };
    if (updated.length === 0) {
      delete updatedTransferModes[category];
    } else {
      updatedTransferModes[category] = updated;
    }
    
    setEditStepTransferModes(updatedTransferModes);
    showToast("Mode de transfert supprimé", "success");
  };

  const selectedApp = applications.find(a => a.id === selectedAppId);
  const donationOfSelectedApp = donations.find(d => d.id === selectedApp?.donation_id);

  return (
    <div className="relative bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden min-h-[640px] flex flex-col md:flex-row" id="admin-saas-layout">
      
      {/* Toast notification administrative */}
      {localToast && (
        <div className={`absolute top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl bg-white transition-all transform translate-y-0 scale-100 ${
          localToast.type === "success" ? "border-emerald-100 text-emerald-800" : "border-rose-100 text-rose-800"
        }`}>
          <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${
            localToast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
          }`} />
          <span className="text-xs font-bold text-slate-700">{localToast.message}</span>
        </div>
      )}
      
      {/* SIDEBAR DE NAVIGATION ADMINISTRATIVE GAUCHE */}
      <aside className="w-full md:w-72 bg-stone-950 text-stone-300 p-4 md:p-6 flex flex-col md:justify-between border-b md:border-b-0 md:border-r border-stone-800/80 flex-shrink-0" id="admin-sidebar">
        <div className="flex flex-col">
          <div className="hidden md:block space-y-6">
            <div className="flex items-center gap-3.5 pb-6 border-b border-stone-800/60">
              <div className="h-11 w-11 rounded-2xl overflow-hidden shadow-lg border border-stone-700/60 ring-2 ring-amber-500/20 bg-stone-900 flex-shrink-0">
                <img 
                  src={platformLogo || "/assets/images/logo_donationsphere_1785861089629.jpg"} 
                  alt="Logo Pôle de Dons" 
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=200";
                  }}
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <h2 className="text-sm font-black text-white tracking-wide uppercase leading-none font-display">Pôle de Dons</h2>
                <span className="text-[9px] text-amber-400 font-bold uppercase tracking-widest mt-1.5 block">
                  {currentUser?.role === "responsable" ? "Centre de Contrôle" : "Console Superviseur"}
                </span>
              </div>
            </div>
            
            <div className="space-y-2 pb-5 border-b border-stone-800/60">
              <div className="flex items-center justify-between">
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-extrabold px-2.5 py-1 rounded-lg border border-amber-500/30 uppercase tracking-widest inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {isAdmin ? "Espace Administrateur" : "Espace Responsable"}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                {isAdmin ? "Supervision globale des attributions, validation des pièces et gestion sécurisée." : "Traitement des candidatures et accompagnement des demandeurs."}
              </p>
            </div>
          </div>

          <nav className="flex md:flex-col gap-2 md:gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide snap-x w-full mt-0 md:mt-4" id="admin-sidebar-nav">
            {hasPermission("overview") && (
              <button
                onClick={() => setActiveTab("overview")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                Tableau de bord
              </button>
            )}

            {hasPermission("workflow") && (
              <button
                onClick={() => setActiveTab("workflow")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "workflow"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <GitMerge className="h-4 w-4 shrink-0" />
                  Protocole & Workflow
                </div>
                <span className="text-[10px] bg-stone-800 text-stone-300 font-bold px-2 py-0.5 rounded-md border border-stone-700">
                  {workflowSteps.length}
                </span>
              </button>
            )}

            {hasPermission("applications") && (
              <button
                onClick={() => setActiveTab("applications")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "applications"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 shrink-0" />
                  Dossiers en instruction
                </div>
                <div className="flex items-center gap-1.5">
                  {totalAppUnread > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-rose-400/20 animate-pulse shadow-md">
                      {totalAppUnread} NOUVEAU
                    </span>
                  )}
                  {applications.length > 0 && (
                    <span className="bg-amber-500/30 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-400/20">
                      {applications.length}
                    </span>
                  )}
                </div>
              </button>
            )}

            {hasPermission("docs") && (
              <button
                onClick={() => setActiveTab("docs")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "docs"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <FileCheck className="h-4 w-4 shrink-0" />
                Pièces justificatives
              </button>
            )}

            {hasPermission("publish") && (
              <button
                onClick={() => {
                  setActiveTab("publish");
                  setPublishSubTab("list");
                }}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "publish"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <FolderPlus className="h-4 w-4 shrink-0" />
                Catalogue des Dons
              </button>
            )}

            {hasPermission("fields") && (
              <button
                onClick={() => setActiveTab("fields")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "fields"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <Sliders className="h-4 w-4 shrink-0" />
                Formulaires & Champs
              </button>
            )}

            {hasPermission("visitor_chats") && (
              <button
                onClick={() => setActiveTab("visitor_chats")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "visitor_chats"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    {onlineCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 bg-emerald-500 rounded-full border border-stone-900 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    )}
                  </div>
                  Messagerie Directe
                </div>
                <div className="flex items-center gap-1.5">
                  {totalVisitorUnread > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-rose-400/20 animate-pulse shadow-md">
                      {totalVisitorUnread} MSG
                    </span>
                  )}
                  {onlineCount > 0 && (
                    <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
                      {onlineCount} actif
                    </span>
                  )}
                </div>
              </button>
            )}

            {hasPermission("whatsapp_calls") && (
              <button
                onClick={() => setActiveTab("whatsapp_calls")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "whatsapp_calls"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <PhoneCall className="h-4 w-4 shrink-0" />
                  Appels WhatsApp
                </div>
                {whatsappCalls && whatsappCalls.length > 0 && (
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-500/30">
                    {whatsappCalls.length}
                  </span>
                )}
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setActiveTab("chatbot_training")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "chatbot_training"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <Bot className="h-4 w-4 shrink-0" />
                Assistant & Intelligence IA
              </button>
            )}

            {hasPermission("testimonials") && (
              <button
                onClick={() => setActiveTab("testimonials")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "testimonials"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Star className="h-4 w-4 shrink-0" />
                  Avis & Retours d'expérience
                </div>
                {testimonials && testimonials.filter(t => !t.approved).length > 0 && (
                  <span className="bg-amber-500 text-stone-950 text-[9px] font-black px-2 py-0.5 rounded-full">
                    {testimonials.filter(t => !t.approved).length}
                  </span>
                )}
              </button>
            )}

            {hasPermission("partners") && (
              <button
                onClick={() => setActiveTab("partners")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "partners"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                Organisations & Partenaires
              </button>
            )}

            {hasPermission("users") && (
              <button
                onClick={() => setActiveTab("users")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "users"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <Users className="h-4 w-4 shrink-0" />
                Comptes & Permissions
              </button>
            )}

            {hasPermission("security") && (
              <button
                onClick={() => setActiveTab("security")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "security"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Sécurité & Authentification
              </button>
            )}

            {hasPermission("payments") && (
              <button
                onClick={() => setActiveTab("payments")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "payments"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                }`}
              >
                <CreditCard className="h-4 w-4 shrink-0" />
                Modes de Règlement
              </button>
            )}
          </nav>
        </div>

        {/* Profil administrateur de bas de sidebar */}
        <div className="hidden md:flex pt-5 border-t border-stone-800/80 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 rounded-xl flex items-center justify-center font-black text-xs shadow-md border border-amber-400/30">
              {currentUser?.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-extrabold text-white block truncate max-w-[130px]">{currentUser?.name || "Administrateur"}</span>
              <span className="text-[10px] text-amber-400 font-semibold block capitalize">{currentUser?.role === "admin" ? "Superviseur Général" : "Gestionnaire Dossiers"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ZONE ADMINISTRATIVE DROITE DROITE */}
      <main className="flex-1 bg-slate-50/50 p-6 sm:p-8 overflow-y-auto" id="admin-content-panel">
        
        <AnimatePresence mode="wait">
          
          {/* TAB 1 : OVERVIEW / DATABASE / DEMO MONITOR */}
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">Tableau de Bord & Statistiques</h3>
                  <p className="text-slate-500 text-xs">Vue d'ensemble de l'activité globale et des performances de redistribution solidaire.</p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${dbStatus?.connectedToSupabase ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
                    <span className={`text-[10px] font-black uppercase tracking-wider ${dbStatus?.connectedToSupabase ? "text-emerald-700" : "text-amber-700"}`}>
                      {dbStatus?.connectedToSupabase ? "Serveur Distant Sécurisé" : "Sandbox de Démonstration"}
                    </span>
                  </div>
                )}
              </div>

              {/* STATS SUMMARY CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm space-y-3 hover:border-amber-200 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
                      <Truck className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Catalogue</span>
                  </div>
                  <div>
                    <strong className="text-2xl font-black text-slate-900 tracking-tight">{stats?.summary?.totalDonations || donations.length}</strong>
                    <span className="block text-xs text-slate-500 font-medium mt-0.5">Offres & Dons actifs</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm space-y-3 hover:border-amber-200 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Demandes</span>
                  </div>
                  <div>
                    <strong className="text-2xl font-black text-slate-900 tracking-tight">{stats?.summary?.totalApplications || applications.length}</strong>
                    <span className="block text-xs text-slate-500 font-medium mt-0.5">Dossiers déposés</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm space-y-3 hover:border-emerald-200 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Accordés</span>
                  </div>
                  <div>
                    <strong className="text-2xl font-black text-slate-900 tracking-tight">{stats?.summary?.approvedApplications || 0}</strong>
                    <span className="block text-xs text-slate-500 font-medium mt-0.5">Attributions finalisées</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm space-y-3 hover:border-blue-200 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-blue-100">
                      <Users className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Communauté</span>
                  </div>
                  <div>
                    <strong className="text-2xl font-black text-slate-900 tracking-tight">{stats?.summary?.totalUsers || 0}</strong>
                    <span className="block text-xs text-slate-500 font-medium mt-0.5">Membres certifiés</span>
                  </div>
                </div>
              </div>

              {/* CHARTS SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Evolution des candidatures */}
                <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                  <h4 className="font-bold text-slate-900 text-sm">Évolution des Candidatures & Dons</h4>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats?.monthlyData || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700, paddingTop: '20px' }} />
                        <Line type="monotone" dataKey="applications" name="Candidatures" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="donations" name="Dons Publiés" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Répartition par catégorie */}
                <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                  <h4 className="font-bold text-slate-900 text-sm">Répartition par Catégorie</h4>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats?.statsByCategory || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="count"
                        >
                          {(stats?.statsByCategory || []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        />
                        <Legend verticalAlign="bottom" align="center" layout="horizontal" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* SUPABASE & TECH INFO (ADMIN ONLY) */}
              {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-12 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg ${dbStatus?.connectedToSupabase ? "bg-emerald-50" : "bg-amber-50"}`}>
                          <Database className={`h-6 w-6 ${dbStatus?.connectedToSupabase ? "text-emerald-600" : "text-amber-600"}`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            État du Système d'Information
                          </h4>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            {dbStatus?.connectedToSupabase 
                              ? "Connexion au serveur de production active (Sécurisée)" 
                              : "Mode local de secours activé (Sandbox)"
                            }
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={async () => {
                          const isConfirmed = await confirmAction("Réinitialiser", "Réinitialiser toutes les données de démo locale ?");
                          if (isConfirmed) {
                            onResetDb();
                          }
                        }}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 border border-slate-200 transition-all cursor-pointer text-[10px] uppercase tracking-wider"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset Local Cache
                      </button>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-widest text-slate-400">
                          <Terminal className="h-3.5 w-3.5 text-amber-600" />
                          Schéma SQL Initialisation
                        </h4>
                        <button
                          onClick={copySql}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition-all"
                        >
                          {copied ? (
                            <>
                              <ClipboardCheck className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-700">Copié !</span>
                            </>
                          ) : (
                            <>
                              <Clipboard className="h-3 w-3 text-slate-500" />
                              <span>Copier SQL</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-[10px] overflow-x-auto max-h-48 leading-relaxed scrollbar-thin border border-slate-800">
                        <pre>{SQL_SCHEMA_CODE}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONFIGURATION DE L'IDENTITÉ VISUELLE (LOGO) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-fade-in" id="logo-settings-panel-overview">
                <div className="space-y-1 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-amber-500" /> Logo de la Plateforme (Identité de l'Application)
                  </h4>
                  <p className="text-slate-500 text-xs">Personnalisez l'identité visuelle de votre application Pôle de Dons. Ce logo est synchronisé en temps réel avec Supabase et s'affiche dans l'en-tête public et l'interface administrative.</p>
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
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById("platform-logo-upload-overview")?.click()}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Fichier
                        </button>
                        <input
                          type="file"
                          id="platform-logo-upload-overview"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleSaveLogo}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      >
                                                <Save className="h-3.5 w-3.5" />
                        Enregistrer le Logo
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CONFIGURATION DE L'IMAGE DE COUVERTURE (HERO) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-fade-in" id="hero-settings-panel-overview">
                <div className="space-y-1 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-amber-500" /> Image de couverture (Vitrine)
                  </h4>
                  <p className="text-slate-500 text-xs">Personnalisez l'image d'arrière-plan de la section héro de la vitrine.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 pt-2">
                  <div className="h-20 w-32 rounded-2xl overflow-hidden shadow-md border border-slate-100 bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <img 
                      src={inputHeroUrl || "/assets/images/fedex_delivery_car_keys.jpg"} 
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
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                    <div className="flex justify-end pt-1">
                      <button 
                        type="button"
                        onClick={handleSaveHeroImage}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Save className="h-3.5 w-3.5" /> Enregistrer l'image
                      </button>
                    </div>
                  </div>
                </div>
              </div>


            </motion.div>
          )}

          {/* TAB 2 : WORKFLOW STEP CONFIGURATION & EDITOR */}
          {activeTab === "workflow" && (
            <motion.div
              key="workflow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Éditeur Dynamique du Workflow d'Instruction</h3>
                <p className="text-slate-500 text-xs">Définissez, ajustez et complétez les étapes de traitement de dossier. Plus vous ajoutez d'étapes, plus le taux d'avancement automatique est recalculé proportionnellement pour le candidat.</p>
              </div>

              {/* Formulaire de création / édition d'étapes */}
              {editingStep ? (
                <div className="bg-amber-50/40 p-6 rounded-xl border border-amber-100 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-indigo-950 flex items-center gap-1.5">
                      <Edit className="h-4.5 w-4.5 text-amber-600" />
                      Modifier l'étape : <span className="text-amber-600 font-extrabold">"{editingStep.label}"</span>
                    </h4>
                    <button
                      onClick={() => setEditingStep(null)}
                      className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Annuler la modification
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">Nom / Libellé de l'étape :</label>
                        <input
                          type="text"
                          value={editStepLabel}
                          onChange={(e) => setEditStepLabel(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">Description / Consignes pour le candidat :</label>
                        <textarea
                          rows={3}
                          value={editStepDesc}
                          onChange={(e) => setEditStepDesc(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">Icône indicative :</label>
                          <select
                            value={editStepIcon}
                            onChange={(e) => setEditStepIcon(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                          >
                            {availableIcons.map((ic, iIdx) => (
                              <option key={`edit-icon-${ic.name}-${iIdx}`} value={ic.name}>{ic.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">Pièce jointe requise :</label>
                          <select
                            value={editStepFileType}
                            onChange={(e) => setEditStepFileType(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                          >
                            <option value="none">Aucune pièce jointe requis</option>
                            <option value="image">Image (JPG, PNG)</option>
                            <option value="pdf">Fichier PDF certifié</option>
                            <option value="any">Tout type de justificatif</option>
                          </select>
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-xl border border-slate-200/60 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="editStepHasText"
                            checked={editStepHasText}
                            onChange={(e) => setEditStepHasText(e.target.checked)}
                            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-slate-300 rounded"
                          />
                          <label htmlFor="editStepHasText" className="text-xs font-black text-slate-800 cursor-pointer">
                            Exiger une saisie de texte additionnelle ?
                          </label>
                        </div>

                        {editStepHasText && (
                          <div className="space-y-3 pt-2 animate-fadeIn">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Libellé de la question :</label>
                              <input
                                type="text"
                                placeholder="Ex : Indiquez votre numéro de matricule CAF"
                                value={editStepTextLabel}
                                onChange={(e) => setEditStepTextLabel(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:bg-white"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Placeholder du champ :</label>
                              <input
                                type="text"
                                placeholder="Ex : Numéro à 7 chiffres..."
                                value={editStepTextPlaceholder}
                                onChange={(e) => setEditStepTextPlaceholder(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section Configuration des modes de transfert selon la nature du don */}
                    <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="space-y-1 border-b border-slate-100 pb-2">
                          <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider">Modes de transfert par nature de don</h5>
                          <p className="text-[10px] text-slate-500">Configurez des options personnalisées de réception, livraison ou retrait selon la catégorie du don.</p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-700">Catégorie du don :</label>
                              <select
                                value={selectedTransferCategory}
                                onChange={(e) => setSelectedTransferCategory(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                              >
                                <option value="Financier">Financier (Numéraire)</option>
                                <option value="Matériel">Matériel (Biens, outils...)</option>
                                <option value="Véhicules">Véhicules (Voitures, camions...)</option>
                                <option value="Immobilier">Immobilier (Bâtiments, terrains...)</option>
                                <option value="Mixte">Mixte (Financier & Nature)</option>
                                <option value="Autre">Autre (Services, parrainage...)</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-700">Option de transfert :</label>
                              <input
                                type="text"
                                placeholder="Ex : Virement instantané"
                                value={newTransferLabel}
                                onChange={(e) => setNewTransferLabel(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-700">Description du mode :</label>
                            <input
                              type="text"
                              placeholder="Ex : Remise directe des fonds sous 48h ouvrées après signature"
                              value={newTransferDesc}
                              onChange={(e) => setNewTransferDesc(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleAddTransferMode}
                            className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <PlusCircle className="h-3 w-3" />
                            Ajouter ce mode pour la catégorie {selectedTransferCategory}
                          </button>
                        </div>

                        {/* Visualisation des modes définis */}
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {Object.keys(editStepTransferModes).length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic text-center py-4">Aucun mode de transfert personnalisé configuré. Les options par défaut de l'application seront utilisées.</p>
                          ) : (
                            Object.keys(editStepTransferModes).map((cat, cIdx) => (
                              <div key={`transfer-cat-${cat}-${cIdx}`} className="space-y-1 bg-slate-50/50 p-2 rounded border border-slate-100">
                                <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100/30">
                                  {cat}
                                </span>
                                <div className="space-y-1 mt-1">
                                  {(editStepTransferModes[cat] || []).map((m, mIdx) => (
                                    <div key={`transfer-mode-${cat}-${mIdx}`} className="flex items-center justify-between gap-2 text-[10px] bg-white p-1.5 rounded border border-slate-100">
                                      <div className="truncate">
                                        <p className="font-bold text-slate-800 truncate">{m.label}</p>
                                        <p className="text-[9px] text-slate-500 truncate">{m.desc}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTransferMode(cat, mIdx)}
                                        className="text-red-500 hover:text-red-700 font-bold p-1 hover:bg-red-50 rounded"
                                        title="Retirer ce mode"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-2">
                        <button
                          onClick={() => setEditingStep(null)}
                          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleSaveEditedStep}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Check className="h-4 w-4" />
                          Enregistrer l'étape
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <PlusCircle className="h-4.5 w-4.5 text-amber-600" />
                    Créer et insérer une nouvelle étape personnalisée
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">Nom / Libellé de l'étape :</label>
                        <input
                          type="text"
                          placeholder="Ex : Entretien téléphonique réglementaire"
                          value={newStepLabel}
                          onChange={(e) => setNewStepLabel(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">Description / Consignes pour le candidat :</label>
                        <textarea
                          rows={3}
                          placeholder="Expliquez ce que le candidat doit saisir ou fournir à cette étape..."
                          value={newStepDesc}
                          onChange={(e) => setNewStepDesc(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">Icône indicative :</label>
                          <select
                            value={newStepIcon}
                            onChange={(e) => setNewStepIcon(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                          >
                            {availableIcons.map((ic, iIdx) => (
                              <option key={`new-icon-${ic.name}-${iIdx}`} value={ic.name}>{ic.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">Pièce jointe requise :</label>
                          <select
                            value={newStepFileType}
                            onChange={(e) => setNewStepFileType(e.target.value as any)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none"
                          >
                            <option value="none">Aucune pièce jointe requis</option>
                            <option value="image">Image (JPG, PNG)</option>
                            <option value="pdf">Fichier PDF certifié</option>
                            <option value="any">Tout type de justificatif</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="newStepHasText"
                            checked={newStepHasText}
                            onChange={(e) => setNewStepHasText(e.target.checked)}
                            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-slate-300 rounded"
                          />
                          <label htmlFor="newStepHasText" className="text-xs font-black text-slate-800 cursor-pointer">
                            Exiger une saisie de texte additionnelle ?
                          </label>
                        </div>

                        {newStepHasText && (
                          <div className="space-y-3 pt-2 animate-fadeIn">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Libellé de la question :</label>
                              <input
                                type="text"
                                placeholder="Ex : Indiquez votre numéro de matricule CAF"
                                value={newStepTextLabel}
                                onChange={(e) => setNewStepTextLabel(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Placeholder du champ :</label>
                              <input
                                type="text"
                                placeholder="Ex : Numéro à 7 chiffres..."
                                value={newStepTextPlaceholder}
                                onChange={(e) => setNewStepTextPlaceholder(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleAddWorkflowStep}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Insérer cette étape au Workflow
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Liste visuelle des étapes configurées */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Séquencement des étapes actuelles du dossier ({workflowSteps.length} étapes)
                </h4>

                <div className="space-y-2.5">
                  {workflowSteps.map((st, idx) => {
                    const isBaseStep = idx < 5;
                    return (
                      <div 
                        key={`step-${st.id || idx}-${idx}`} 
                        className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          isBaseStep 
                            ? "bg-slate-50/50 border-slate-200/50 text-slate-800" 
                            : "bg-amber-50/20 border-amber-100 text-indigo-950"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900">{st.label}</span>
                              {isBaseStep ? (
                                <span className="text-[8px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded uppercase font-black tracking-wider">
                                  Réglementaire
                                </span>
                              ) : (
                                <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded uppercase font-black tracking-wider">
                                  Optionnel / Admin
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">{st.description}</p>
                            
                            {/* Tags de fonctionnalités de l'étape */}
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {st.hasTextField && (
                                <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                  Saisie texte : {st.textFieldLabel}
                                </span>
                              )}
                              {st.requiredFileType !== "none" && (
                                <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">
                                  Justificatif requis : {st.requiredFileType}
                                </span>
                              )}
                              {st.transferModesByCategory && Object.keys(st.transferModesByCategory).length > 0 && (
                                <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
                                  {Object.keys(st.transferModesByCategory).length} Nature(s) de don paramétrée(s)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => startEditingStep(st)}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded transition-all cursor-pointer"
                            title="Modifier cette étape"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {!isBaseStep && (
                            <button
                              onClick={() => handleDeleteWorkflowStep(st.id, idx)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-all cursor-pointer"
                              title="Supprimer cette étape"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3 : APPLICATIONS / DOSSIERS CANDIDATS */}
          {activeTab === "applications" && (
            <motion.div
              key="applications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Dossiers Candidats & Suivi d'Instruction</h3>
                <p className="text-slate-500 text-xs">Examinez les pièces jointes, ajustez les priorités sociales, et répondez aux candidats en temps réel.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LISTE DES CANDIDATS */}
                <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider text-slate-400">
                    Candidatures reçues
                  </h4>

                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1" id="admin-applications-list">
                    {applications.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        Aucun candidat n'a encore postulé.
                      </div>
                    ) : (
                      applications.map((app, appIdx) => {
                        const don = donations.find(d => d.id === app.donation_id);
                        const isSelected = selectedAppId === app.id;

                        return (
                          <div 
                            key={`admin-app-${app.id || appIdx}-${appIdx}`} 
                            id={`admin-app-card-${app.id}`}
                            onClick={() => setSelectedAppId(app.id)}
                            className={`py-4 px-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 rounded-xl cursor-pointer transition-all border my-1 ${
                              isSelected ? "bg-amber-50/45 border-amber-200/60 shadow-sm" : "hover:bg-slate-50 border-transparent"
                            }`}
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <strong className="text-sm text-slate-950 font-black">{app.user_name}</strong>
                                {appUnreadCounts[app.id] > 0 && (
                                  <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">
                                    {appUnreadCounts[app.id]} non lu
                                  </span>
                                )}
                                <span className={`text-[9px] px-2 py-0.5 rounded-full border font-black uppercase tracking-wider ${
                                  app.status === "accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  app.status === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
                                  "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                  {app.status === "accepted" ? "Accepté" :
                                   app.status === "rejected" ? "Refusé" : "En examen"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 font-semibold">
                                Don visé : <span className="text-slate-900">{don?.title || "Don inconnu"}</span>
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 pt-1">
                                <span>Avancement : <strong>{app.completion_percentage}%</strong> (Étape {app.current_step}/{workflowSteps.length})</span>
                                <span>•</span>
                                <span>Rang : <strong>#{app.rank_position}</strong></span>
                                <span>•</span>
                                <span>Risque : <strong className="uppercase text-slate-600">{app.risk_level}</strong></span>
                              </div>
                            </div>

                            {/* Actions rapides */}
                            <div className="flex items-center gap-1.5 self-end sm:self-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateApplication(app.id, { status: "accepted" });
                                }}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200/50 cursor-pointer"
                                title="Accepter la candidature"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateApplication(app.id, { status: "rejected" });
                                }}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200/50 cursor-pointer"
                                title="Refuser la candidature"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                              {onDeleteApplication && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const isConfirmed = await confirmAction("Supprimer le dossier", "Êtes-vous sûr de vouloir supprimer définitivement ce dossier candidat ? Cette action supprimera également tous les messages et soumissions associés.");
                                    if (isConfirmed) {
                                      onDeleteApplication(app.id);
                                    }
                                  }}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200/50 cursor-pointer animate-fade-in"
                                  title="Supprimer définitivement la candidature"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* DROITE : SURCHARGE DE PROFIL & DISCUSSION AGENT */}
                <div className="lg:col-span-5 space-y-6">
                  {selectedAppId && selectedApp ? (
                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-5" id="app-manager-form">
                      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-extrabold text-amber-600 tracking-widest uppercase block">
                            Arbitrage & Décision
                          </span>
                          <h4 className="font-extrabold text-slate-950 text-sm mt-0.5">
                            Candidature : {selectedApp.user_name}
                          </h4>
                          <p className="text-slate-500 text-[10px]">Cible : {donationOfSelectedApp?.title}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedAppId(null)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Surcharges des métriques (Rank position, Risk, Status) */}
                      <div className="space-y-4" id="metric-overrides">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ajustements Manuels</h5>
                        
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 block">Rang de priorité</label>
                            <input
                              type="number"
                              min={1}
                              value={selectedApp.rank_position}
                              onChange={(e) => onUpdateApplication(selectedApp.id, { rank_position: Number(e.target.value) })}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 block">Risque / Urgence</label>
                            <select
                              value={selectedApp.risk_level}
                              onChange={(e) => onUpdateApplication(selectedApp.id, { risk_level: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                            >
                              <option value="low">Faible</option>
                              <option value="medium">Moyen</option>
                              <option value="high">Élevé</option>
                              <option value="critical">Critique</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Chat direct de l'admin pour reprendre la main */}
                      <div className="space-y-3 pt-2" id="admin-chat-thread">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Send className="h-3 w-3 text-amber-500" /> Fil d'Instruction & Discussion
                        </h5>

                        <div className="bg-slate-50 p-3 rounded-lg max-h-40 overflow-y-auto text-xs space-y-2 border border-slate-150">
                          {(() => {
                            const rawList = (localAppMessages[selectedAppId] || messages[selectedAppId]) || [];
                            const appMessagesList = activeAppUnifiedMessages.length > 0 
                              ? activeAppUnifiedMessages 
                              : rawList;

                            return appMessagesList.map((m, mIdx) => {
                              const isDossierAdmin = m.sender_type === "admin" || m.sender === "agent";
                              const isDossierSystem = m.sender_type === "system" || m.sender === "bot" || m.sender === "system";

                              return (
                                <div key={`app-msg-${m.id || 'id'}-${mIdx}`} className="space-y-0.5">
                                  <strong className={`block text-[9px] font-extrabold ${isDossierAdmin ? "text-amber-600" : isDossierSystem ? "text-slate-400" : "text-emerald-700"}`}>
                                    {isDossierAdmin ? "Vous (Admin)" : isDossierSystem ? "🤖 Système" : "Candidat"}
                                  </strong>
                                  {(() => {
                                    if (m.content && m.content.startsWith('{"isPaymentRequest":true')) {
                                      try {
                                        const paymentData = JSON.parse(m.content);
                                        return (
                                          <div className="my-2 p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2 text-slate-800 text-[11px] max-w-sm">
                                            <div className="flex items-center justify-between">
                                              <span className="font-extrabold text-amber-800 flex items-center gap-1">
                                                <Coins className="h-3.5 w-3.5" />
                                                DEMANDE DE FRAIS
                                              </span>
                                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                paymentData.status === "paid" 
                                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                                  : paymentData.status === "virement_declared"
                                                    ? "bg-blue-100 text-blue-800 border border-blue-300 animate-pulse"
                                                    : "bg-amber-100 text-amber-800 border border-amber-300"
                                              }`}>
                                                {paymentData.status === "paid" 
                                                  ? "Payé" 
                                                  : paymentData.status === "virement_declared"
                                                    ? "Virement Déclaré"
                                                    : "En attente"}
                                              </span>
                                            </div>

                                            <div className="space-y-1 bg-white p-2 rounded border border-amber-100">
                                              <div>
                                                <span className="text-slate-400 font-medium">Motif :</span>{" "}
                                                <span className="font-bold text-slate-800">{paymentData.reason}</span>
                                              </div>
                                              <div>
                                                <span className="text-slate-400 font-medium">Montant :</span>{" "}
                                                <span className="font-bold text-slate-800 text-xs">{paymentData.amount} € EUR</span>
                                              </div>
                                              {paymentData.paymentMethod && (
                                                <div>
                                                  <span className="text-slate-400 font-medium">Méthode de paiement :</span>{" "}
                                                  <span className="font-medium text-slate-800 uppercase">{paymentData.paymentMethod}</span>
                                                </div>
                                              )}
                                              {paymentData.txHash && (
                                                <div className="flex flex-col gap-0.5 pt-1">
                                                  <span className="text-slate-400 font-medium">Hash de Transaction :</span>
                                                  <span className="font-mono bg-slate-50 text-slate-600 p-1 rounded text-[9px] break-all border border-slate-100">{paymentData.txHash}</span>
                                                </div>
                                              )}
                                            </div>

                                            {paymentData.status === "virement_declared" && (
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  if (confirm("Confirmez-vous la réception de ce virement bancaire sur votre compte ?")) {
                                                    const updatedPayload = {
                                                      ...paymentData,
                                                      status: "paid",
                                                      updatedAt: new Date().toISOString()
                                                    };
                                                    
                                                    try {
                                                      const res = await fetch(`/api/messages/${m.id}`, {
                                                        method: "PUT",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ content: JSON.stringify(updatedPayload) })
                                                      });
                                                      if (res.ok) {
                                                        showToast("Virement validé avec succès !", "success");
                                                        if (selectedAppId) {
                                                          fetch(`/api/messages/${selectedAppId}`)
                                                            .then(r => r.json())
                                                            .then(data => {
                                                              setLocalAppMessages(prev => ({ ...prev, [selectedAppId]: data }));
                                                            })
                                                            .catch(e => console.error(e));
                                                        }
                                                      } else {
                                                        showToast("Erreur lors de la validation.", "error");
                                                      }
                                                    } catch (e) {
                                                      console.error(e);
                                                    }
                                                  }
                                                }}
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded text-[10px] font-black shadow cursor-pointer transition-all"
                                              >
                                                Valider la réception du Virement
                                              </button>
                                            )}
                                          </div>
                                        );
                                      } catch (e) {
                                        return <p className="text-slate-700 leading-normal">{m.content}</p>;
                                      }
                                    }
                                    return <p className="text-slate-700 leading-normal">{m.content}</p>;
                                  })()}
                                  {m.attachment && (
                                    m.attachment.type?.startsWith("audio/") ? (
                                      <div className="mt-1 p-1 bg-white border border-slate-200 rounded flex items-center gap-1.5 max-w-fit">
                                        <audio controls src={typeof m.attachment === 'string' ? m.attachment : (m.attachment.url || m.attachment.data)} className="h-6 w-32 outline-none" />
                                      </div>
                                    ) : (
                                      <div className="mt-1 p-1 bg-white border border-slate-200 rounded flex items-center gap-1.5 max-w-fit">
                                        <Paperclip className="h-2.5 w-2.5 text-amber-500" />
                                        <a 
                                          href={typeof m.attachment === 'string' ? m.attachment : (m.attachment.url || m.attachment.data)} 
                                          download={m.attachment.name || "piece_jointe"} 
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[8px] text-amber-600 hover:underline truncate max-w-[150px]"
                                        >
                                          {m.attachment.name || "Voir la pièce jointe"}
                                        </a>
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>

                        <div className="space-y-2">
                          {replyFile && replyFile.type !== "audio/webm" && (
                            <div className="flex items-center justify-between p-1.5 bg-amber-50 border border-amber-100 rounded text-[9px]">
                              <div className="flex items-center gap-1.5 truncate">
                                <Paperclip className="h-3 w-3 text-amber-500" />
                                <span className="text-amber-700 truncate">{replyFile.name}</span>
                              </div>
                              <button onClick={() => setReplyFile(null)} className="text-amber-400 hover:text-amber-600">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          {replyFile && replyFile.type === "audio/webm" && (
                            <div className="flex items-center justify-between p-1.5 bg-amber-50 border border-amber-100 rounded text-[9px]">
                              <audio controls src={replyFile.url} className="h-8 w-48" />
                              <button onClick={() => { setReplyFile(null); audioRecorderApp.clearAudio(); }} className="text-amber-500 hover:text-red-600 ml-2">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          <form onSubmit={handleSendAdminReply} className="flex gap-2">
                            {audioRecorderApp.isRecording ? (
                              <div className="flex-1 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse" />
                                  <span className="text-red-600 font-bold text-xs font-mono">
                                    {Math.floor(audioRecorderApp.recordingTime / 60)}:{(audioRecorderApp.recordingTime % 60).toString().padStart(2, '0')}
                                  </span>
                                </div>
                                <div className="flex-1" />
                                <button
                                  type="button"
                                  onClick={audioRecorderApp.cancelRecording}
                                  className="p-1.5 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                  title="Annuler"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={audioRecorderApp.stopRecording}
                                  className="p-1.5 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                                  title="Arrêter"
                                >
                                  <Square className="h-4 w-4 fill-current" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <label className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer text-slate-500 transition-all flex items-center justify-center">
                                  <Paperclip className="h-3.5 w-3.5" />
                                  <input type="file" className="hidden" onChange={handleReplyFileChange} />
                                </label>
                                <button
                                  type="button"
                                  onMouseDown={audioRecorderApp.startRecording}
                                  onTouchStart={audioRecorderApp.startRecording}
                                  disabled={!!replyFile}
                                  className="p-2 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-500 rounded-lg cursor-pointer transition-all flex items-center justify-center"
                                  title="Maintenir pour enregistrer une note vocale"
                                >
                                  <Mic className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowPaymentRequestModal(true)}
                                  className="p-2 bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-500 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 font-bold shadow-sm"
                                  title="Demander des frais (douanes, transferts...)"
                                >
                                  <Coins className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline text-[10px]">Frais</span>
                                </button>
                                <input
                                  type="text"
                                  placeholder="Saisir un message au candidat..."
                                  value={replyInput}
                                  onChange={(e) => setReplyInput(e.target.value)}
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white min-w-0"
                                />
                              </>
                            )}
                            <button
                              type="submit"
                              disabled={(!replyInput.trim() && !replyFile) || isSendingAdminReply || audioRecorderApp.isRecording}
                              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-bold shadow cursor-pointer disabled:opacity-50"
                            >
                              {isSendingAdminReply ? "..." : "Envoyer"}
                            </button>
                          </form>

                          {showPaymentRequestModal && (
                            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden p-5 space-y-4 text-slate-800"
                              >
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                                    <Coins className="h-4 w-4 text-amber-500" />
                                    Nouvelle Demande de Frais
                                  </h4>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowPaymentRequestModal(false);
                                      setPaymentAmount("");
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  {/* Motif */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Motif des frais</label>
                                    <select
                                      value={paymentReason}
                                      onChange={(e) => setPaymentReason(e.target.value)}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                                    >
                                      <option value="Frais de douane">Frais de douane</option>
                                      <option value="Frais de transfert / envoi">Frais de transfert / envoi</option>
                                      <option value="Assurance de transport international">Assurance de transport international</option>
                                      <option value="Frais de dossier administratifs">Frais de dossier administratifs</option>
                                      <option value="Autre motif spécifique">Autre motif spécifique</option>
                                    </select>
                                  </div>

                                  {paymentReason === "Autre motif spécifique" && (
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Saisir le motif</label>
                                      <input
                                        type="text"
                                        required
                                        value={customPaymentReason}
                                        onChange={(e) => setCustomPaymentReason(e.target.value)}
                                        placeholder="Ex: Frais d'homologation de diplômes..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                                      />
                                    </div>
                                  )}

                                  {/* Montant */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Montant demandé (€ EUR)</label>
                                    <input
                                      type="number"
                                      required
                                      min="1"
                                      value={paymentAmount}
                                      onChange={(e) => setPaymentAmount(e.target.value)}
                                      placeholder="Montant en Euros (ex: 150)"
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowPaymentRequestModal(false);
                                      setPaymentAmount("");
                                    }}
                                    className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!paymentAmount || Number(paymentAmount) <= 0) {
                                        alert("Veuillez saisir un montant valide.");
                                        return;
                                      }
                                      const finalReason = paymentReason === "Autre motif spécifique" ? customPaymentReason : paymentReason;
                                      if (!finalReason.trim()) {
                                        alert("Veuillez spécifier le motif.");
                                        return;
                                      }

                                      const requestPayload = {
                                        isPaymentRequest: true,
                                        paymentId: "pay_" + Math.random().toString(36).substring(2, 9),
                                        amount: Number(paymentAmount),
                                        reason: finalReason,
                                        status: "pending",
                                        paymentMethod: null,
                                        txHash: null,
                                        declaredAt: null,
                                        updatedAt: null
                                      };

                                      await onSendAdminMessage(selectedAppId, JSON.stringify(requestPayload));
                                      
                                      setShowPaymentRequestModal(false);
                                      setPaymentAmount("");
                                      showToast("Demande de paiement envoyée au candidat !", "success");
                                    }}
                                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 text-xs font-bold rounded-lg shadow cursor-pointer"
                                  >
                                    Envoyer
                                  </button>
                                </div>
                              </motion.div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 py-16 text-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                      <Shield className="h-8 w-8 mx-auto text-slate-300 mb-2 animate-pulse" />
                      Sélectionnez un candidat dans la liste pour surcharger son dossier, consulter ses pièces d'instruction, ou lui adresser un message.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4 : GESTION ET PUBLICATION DES DONS */}
          {activeTab === "publish" && (
            <motion.div
              key="publish"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">Gestion & Publication des Dons</h3>
                  <p className="text-slate-500 text-xs">Administrez les dons publiés sur le catalogue, modifiez leurs statuts, leurs fiches techniques, ou publiez de nouveaux dons.</p>
                </div>
                
                {/* Sélecteur de sous-onglet */}
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit self-start">
                  <button
                    type="button"
                    onClick={() => setPublishSubTab("list")}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      publishSubTab === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Database className="h-4 w-4 text-amber-500" />
                    Dons Publiés ({donations.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishSubTab("create")}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      publishSubTab === "create" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <PlusCircle className="h-4 w-4 text-amber-500" />
                    Publier un Don
                  </button>
                </div>
              </div>

              {publishSubTab === "list" ? (
                <div className="space-y-4">
                  {/* Filtre de recherche */}
                  <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="relative w-full max-w-sm">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Rechercher un don par titre, catégorie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      {donations.filter(d => {
                        const term = (searchTerm || "").toLowerCase().trim();
                        return (d.title || "").toLowerCase().includes(term) || (d.category || "").toLowerCase().includes(term);
                      }).length} don(s) trouvé(s)
                    </span>
                  </div>

                  {/* Tableau des dons */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="py-3 px-4">Don</th>
                            <th className="py-3 px-4">Détails</th>
                            <th className="py-3 px-4">Statut</th>
                            <th className="py-3 px-4">Impact / Valeur</th>
                            <th className="py-3 px-4">Agent Responsable</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {donations
                            .filter(d => {
                              const term = (searchTerm || "").toLowerCase().trim();
                              return (d.title || "").toLowerCase().includes(term) || (d.category || "").toLowerCase().includes(term);
                            })
                            .map((d, idx) => (
                              <tr key={`don-row-${d.id || idx}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={d.image_url || "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=600"}
                                      alt={d.title}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=200";
                                      }}
                                      className="h-10 w-10 object-cover rounded-lg shadow-sm border border-slate-100 flex-shrink-0"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="max-w-[180px]">
                                      <p className="font-extrabold text-slate-800 line-clamp-2 leading-tight" title={d.title}>{d.title}</p>
                                      <span className="text-[9px] text-slate-400 block">{d.id}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="space-y-1">
                                    <span className="inline-block text-[9px] font-black uppercase bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
                                      {d.category}
                                    </span>
                                    <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">{d.location}</span>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  {d.status === "active" ? (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Actif
                                    </span>
                                  ) : d.status === "completed" ? (
                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                      Complété
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                      Inactif
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="space-y-0.5 text-[11px]">
                                    <div className="font-bold text-slate-700">Candidatures : <span className="text-amber-600">{d.current_bids_count || 0}</span></div>
                                    {d.target_amount ? (
                                      <div className="text-slate-400 text-[10px]">Valeur : {d.target_amount} €</div>
                                    ) : (
                                      <div className="text-slate-400 text-[10px]">Don non-financier</div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="text-[11px]">
                                    <span className="font-bold text-slate-700 block">{d.agent_name || "Non assigné"}</span>
                                    <span className="text-slate-400 text-[10px] block">{d.agent_phone || ""}</span>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleEditDonation(d)}
                                      title="Modifier"
                                      className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDonation(d.id);
                                      }}
                                      title="Supprimer"
                                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          {donations.filter(d => {
                            const term = (searchTerm || "").toLowerCase().trim();
                            return (d.title || "").toLowerCase().includes(term) || (d.category || "").toLowerCase().includes(term);
                          }).length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                                Aucun don ne correspond à votre recherche.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* COLONNE GAUCHE : INFOS DE BASE */}
                  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                      <Sliders className="h-4 w-4 text-amber-500" /> Informations générales
                    </h4>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Titre explicite du don :</label>
                      <input
                        type="text"
                        placeholder="Ex: Lot de 5 ordinateurs portables reconditionnés"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Donateur (Nom complet ou Structure de l'annonceur) :</label>
                      <input
                        type="text"
                        placeholder="Ex: Clara, Fondation Humanitaire, Anonyme..."
                        value={newDonor}
                        onChange={(e) => setNewDonor(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Catégorie :</label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                        >
                          <option value="Matériel">Don de Matériel (Nature)</option>
                          <option value="Financier">Don Numéraire (Financier)</option>
                          <option value="Immobilier">Don Immobilier</option>
                          <option value="Véhicules">Don de Véhicule</option>
                          <option value="Mixte">Don Mixte (Financier & Nature)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Montant / Valeur (€) :</label>
                        <input
                          type="number"
                          placeholder="Ex: 1200"
                          value={newAmount}
                          onChange={(e) => setNewAmount(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Localisation géographique :</label>
                        <input
                          type="text"
                          placeholder="Ex: Lyon, Auvergne-Rhône-Alpes"
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Image URL alternative (Optionnel) :</label>
                        <input
                          type="text"
                          placeholder="https://images.unsplash.com/..."
                          value={donationImageUrl}
                          onChange={(e) => setDonationImageUrl(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* UPLOAD DRAG-AND-DROP DE L'IMAGE DU DON */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">Télécharger l'illustration du Don (webp compressé automatique) :</label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 p-3 transition-all">
                          <div className="flex flex-col items-center justify-center text-center">
                            <UploadCloud className="w-5 h-5 text-slate-400 mb-1" />
                            <span className="text-[11px] font-bold text-slate-700">Sélectionner une photo</span>
                            <span className="text-[9px] text-slate-400">Compression WebP optimale</span>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleDonationImageUpload}
                            disabled={isUploadingDonationImage}
                          />
                        </label>
                      </div>

                      {isUploadingDonationImage && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin inline-block" />
                          Traitement et compression de l'image en WebP...
                        </div>
                      )}

                      {donationImageUrl && (
                        <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-50 group shadow-inner">
                          <img 
                            src={donationImageUrl} 
                            alt="Aperçu de l'illustration" 
                            className="w-full h-full object-cover animate-fade-in"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setDonationImageUrl("");
                              setDonationImageStats(null);
                            }}
                            className="absolute top-2 right-2 bg-rose-500 hover:bg-rose-600 text-white p-1.5 rounded-full shadow-md transition-all cursor-pointer"
                            title="Supprimer l'image"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {donationImageStats && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          <div>
                            <span className="text-[11px] font-bold text-emerald-950 block">Photo compressée avec succès en WebP</span>
                            <div className="flex gap-2 text-[9px] text-emerald-800/80">
                              <span>Original : {donationImageStats.originalSizeKb} KB</span>
                              <span>•</span>
                              <span>Compressé : {donationImageStats.optimizedSizeKb} KB</span>
                              <span>•</span>
                              <span className="font-extrabold text-emerald-700">Économisé : {donationImageStats.compressionRatio}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Conditions de redistribution & Description :</label>
                      <textarea
                        rows={3}
                        placeholder="Précisez scrupuleusement les conditions d'obtention de ce don solidaire..."
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* COLONNE DROITE : SPÉCIFICATIONS ET TÉMOIGNAGES */}
                  <div className="space-y-6">
                    
                    {/* EN-TÊTE SPÉCIFICATIONS TECHNIQUES DYNAMIQUES */}
                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                        <Settings className="h-4 w-4 text-amber-500" /> Spécifications techniques du don
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Clé (ex : Processeur)"
                          value={specKey}
                          onChange={(e) => setSpecKey(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800 min-w-0"
                        />
                        <input
                          type="text"
                          placeholder="Valeur (ex : Intel Core i5)"
                          value={specVal}
                          onChange={(e) => setSpecVal(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800 min-w-0"
                        />
                        <button
                          type="button"
                          onClick={handleAddSpec}
                          className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg text-xs font-extrabold shadow-sm hover:shadow transition-all cursor-pointer flex-shrink-0"
                        >
                          Ajouter
                        </button>
                      </div>

                      {Object.keys(customSpecs).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {Object.entries(customSpecs).map(([k, v], idx) => (
                            <span key={`custom-spec-${k}-${idx}`} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-200">
                              <strong>{k}</strong>: {v}
                              <button type="button" onClick={() => handleRemoveSpec(k)} className="text-slate-400 hover:text-red-500 cursor-pointer">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* BLOC DES TÉMOIGNAGES ÉTAPE PAR ÉTAPE */}
                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                        <Users className="h-4 w-4 text-amber-500" /> Ajouter des Témoignages réels d'impact
                      </h4>

                      <div className="space-y-3 p-3 bg-slate-50/50 rounded-xl border border-slate-200/50">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Nom de l'auteur :</label>
                            <input
                              type="text"
                              placeholder="Ex: Clara, Resp. Solidaire"
                              value={testAuthor}
                              onChange={(e) => setTestAuthor(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Type de média :</label>
                            <select
                              value={testMediaType}
                              onChange={(e) => setTestMediaType(e.target.value as any)}
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                            >
                              <option value="text">Citation Texte simple</option>
                              <option value="audio">Audio (.opus compressé)</option>
                              <option value="image">Image (.webp compressé)</option>
                              <option value="video">Lien Vidéo (YouTube ou autre)</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Citation ou contenu textuel :</label>
                          <textarea
                            rows={2}
                            placeholder="Ex: 'Ce matériel a permis d'équiper notre salle d'étude solidaire, un immense merci !'"
                            value={testQuote}
                            onChange={(e) => setTestQuote(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                          />
                        </div>

                        {testMediaType !== "text" && (
                          <div className="space-y-1.5 pt-1 animate-fadeIn">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">
                              {testMediaType === "audio" ? "Fichier audio (.opus requis) :" : testMediaType === "image" ? "Photo (.webp requis) :" : "Lien ou URL du média Youtube :"}
                            </label>

                            {testMediaType === "video" ? (
                              <input
                                type="text"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={testMediaUrl}
                                onChange={(e) => setTestMediaUrl(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                              />
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-center w-full">
                                  <label className="flex flex-col items-center justify-center w-full h-16 border border-dashed border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer p-2">
                                    <div className="flex items-center gap-2">
                                      <Paperclip className="w-4 h-4 text-slate-400" />
                                      <span className="text-[11px] font-bold text-slate-600">Sélectionner le fichier média</span>
                                    </div>
                                    <input 
                                      type="file" 
                                      accept={testMediaType === "audio" ? "audio/*" : "image/*"} 
                                      className="hidden" 
                                      onChange={handleTestimonialFileUpload}
                                      disabled={isUploadingTestFile}
                                    />
                                  </label>
                                </div>

                                {isUploadingTestFile && (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <span className="h-3 w-3 rounded-full border-2 border-amber-600 border-t-transparent animate-spin inline-block" />
                                    Optimisation du média...
                                  </div>
                                )}

                                {testFileStats && (
                                  <div className="p-2 bg-emerald-50 border border-emerald-100 rounded text-[11px] text-emerald-900 flex items-center gap-1.5">
                                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
                                    <div>
                                      <p className="font-bold">Média compressé en {testFileStats.format || "WebP"}</p>
                                      <p className="text-[9px] text-emerald-700">Taille optimisée : {testFileStats.compressedSize} KB (-{testFileStats.ratio})</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleAddTestimonial}
                          className="w-full py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs font-bold transition-all hover:bg-amber-100 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          Ajouter ce témoignage au don
                        </button>
                      </div>

                      {/* Liste des témoignages provisoirement rattachés */}
                      {addedTestimonials.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Témoignages à publier ({addedTestimonials.length}) :</span>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {addedTestimonials.map((t, idx) => (
                              <div key={`added-testi-${t.id || idx}-${idx}`} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                                <div>
                                  <p className="font-extrabold text-slate-900">{t.author_name}</p>
                                  <p className="text-[10px] text-slate-500 line-clamp-1 italic">"{t.quote}"</p>
                                  <span className="inline-block mt-1 text-[8px] bg-amber-50 text-amber-600 px-1.5 py-0.2 rounded font-black uppercase">
                                    {t.media_type === "audio" ? "🔊 Opus Audio" : t.media_type === "image" ? "🖼️ WebP Image" : t.media_type === "video" ? "📺 Vidéo" : "📝 Citation texte"}
                                  </span>
                                </div>
                                <button type="button" onClick={() => handleRemoveTestimonial(t.id)} className="text-slate-400 hover:text-red-500 p-1 cursor-pointer">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* ZONE DE BOUTON FINAL DE PUBLICATION */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    id="submit-donation-publish-btn"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3 px-8 rounded-xl text-xs shadow-md shadow-amber-600/10 hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderPlus className="h-4.5 w-4.5" />
                    Publier le Don & Rallier les Témoignages
                  </button>
                </div>
              </form>
            )}

            {/* MODAL D'ÉDITION DE DON */}
            <AnimatePresence>
              {editingDonation && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ margin: 0 }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-2">
                          <Edit className="h-5 w-5 text-amber-500" />
                          Modifier le Don Solidaire
                        </h3>
                        <p className="text-[10px] text-slate-400">ID: {editingDonation.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingDonation(null)}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all cursor-pointer"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <form onSubmit={handleUpdateDonation} className="space-y-5 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Titre explicite :</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Catégorie :</label>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                          >
                            <option value="Matériel">Don de Matériel (Nature)</option>
                            <option value="Financier">Don Numéraire (Financier)</option>
                            <option value="Immobilier">Don Immobilier</option>
                            <option value="Véhicules">Don de Véhicule</option>
                            <option value="Mixte">Don Mixte (Financier & Nature)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Donateur :</label>
                          <input
                            type="text"
                            value={editDonor}
                            onChange={(e) => setEditDonor(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                            placeholder="Anonyme"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Statut de publication :</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as any)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                          >
                            <option value="active">Actif (Visible sur le catalogue)</option>
                            <option value="inactive">Inactif (Masqué du catalogue)</option>
                            <option value="completed">Complété (Don déjà attribué)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Valeur estimée / Montant (€) :</label>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                            placeholder="Optionnel"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Localisation géographique :</label>
                          <input
                            type="text"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Image illustrative (URL ou Téléversement) :</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editImageUrl}
                              onChange={(e) => setEditImageUrl(e.target.value)}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById("edit-donation-image-upload-modal")?.click()}
                              disabled={isUploadingEditDonationImage}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 disabled:opacity-50"
                            >
                              <UploadCloud className="h-4 w-4" />
                              {isUploadingEditDonationImage ? "Traitement..." : "Uploader"}
                            </button>
                            <input
                              type="file"
                              id="edit-donation-image-upload-modal"
                              accept="image/*"
                              onChange={handleEditDonationImageUpload}
                              className="hidden"
                            />
                          </div>
                          {editImageUrl && (
                            <div className="relative mt-2 rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-50 group shadow-inner">
                              <img 
                                src={editImageUrl} 
                                alt="Aperçu de l'illustration" 
                                className="w-full h-full object-cover animate-fade-in"
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditImageUrl("");
                                  setEditDonationImageStats(null);
                                }}
                                className="absolute top-2 right-2 bg-rose-500 hover:bg-rose-600 text-white p-1.5 rounded-full shadow-md transition-all cursor-pointer"
                                title="Supprimer l'image"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          {editDonationImageStats && (
                            <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                              Optimisé WebP ! {editDonationImageStats.originalSizeKb} KB {"→"} {editDonationImageStats.optimizedSizeKb} KB ({editDonationImageStats.compressionRatio} d'économie)
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Agent Responsable :</label>
                          <input
                            type="text"
                            value={editAgentName}
                            onChange={(e) => setEditAgentName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                            placeholder="Ex: Marc Lefèvre"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Téléphone de l'Agent :</label>
                           <input
                            type="text"
                            value={editAgentPhone}
                            onChange={(e) => setEditAgentPhone(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                            placeholder="Ex: +49 1521 6945182"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Description du don solidaire :</label>
                        <textarea
                          rows={4}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
                          required
                        />
                      </div>

                      {/* Gestion des spécifications du don */}
                      <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                            Fiche technique & Spécifications
                          </h4>
                          <button
                            type="button"
                            onClick={() => setEditSpecifications(prev => [...prev, { key: "", value: "" }])}
                            className="text-amber-600 hover:text-amber-800 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <PlusCircle className="h-4 w-4" />
                            Ajouter une ligne
                          </button>
                        </div>

                        {editSpecifications.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic text-center py-2">
                            Aucune spécification technique définie.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                            {editSpecifications.map((spec, index) => (
                              <div key={`edit-spec-${index}`} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Propriété (ex: État)"
                                  value={spec.key}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditSpecifications(prev => prev.map((s, idx) => idx === index ? { ...s, key: val } : s));
                                  }}
                                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                                />
                                <input
                                  type="text"
                                  placeholder="Valeur (ex: Excellent)"
                                  value={spec.value}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditSpecifications(prev => prev.map((s, idx) => idx === index ? { ...s, value: val } : s));
                                  }}
                                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditSpecifications(prev => prev.filter((_, idx) => idx !== index))}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setEditingDonation(null)}
                          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-amber-600/10 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="h-4 w-4" />
                          Enregistrer les modifications
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            </motion.div>
          )}

          {/* TAB 5 : SUBMISSION FIELDS CONFIGURATION */}
          {activeTab === "fields" && (
            <motion.div
              key="fields"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Champs Obligatoires lors de la Postulation</h3>
                <p className="text-slate-500 text-xs">Configurez les informations indispensables exigées des candidats pour ouvrir leur dossier d'instruction lors de l'inscription.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-5" id="configure-fields-sector">
                {/* Formulaire d'ajout de champ */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ajouter une information requise</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Libellé du champ :</label>
                      <input
                        type="text"
                        placeholder="Ex: Situation d'urgence"
                        value={addFieldLabel}
                        onChange={(e) => setAddFieldLabel(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Type de saisie :</label>
                      <select
                        value={addFieldType}
                        onChange={(e) => setAddFieldType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="text">Texte Court</option>
                        <option value="number">Nombre / Revenus mensuel</option>
                        <option value="textarea">Zone de paragraphe long</option>
                        <option value="file">Justificatif Fichier (Image ou PDF)</option>
                      </select>
                    </div>

                    <div className="space-y-1 flex items-end">
                      <button
                        type="button"
                        onClick={handleAddField}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Ajouter ce champ requis
                      </button>
                    </div>
                  </div>
                </div>

                {/* Liste des champs configurés */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Champs obligatoires actifs</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {adminDefinedFields.map((field, fIdx) => (
                      <div key={`admin-field-${field.key}-${fIdx}`} className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                        <div className="space-y-0.5">
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-extrabold uppercase tracking-wider mr-2">
                            {field.type === "file" ? "📁 Fichier" : field.type === "number" ? "🔢 Nombre" : field.type === "textarea" ? "📝 Zone" : "🔤 Texte"}
                          </span>
                          <strong className="text-xs text-slate-950 font-black">{field.label}</strong>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteField(field.key)}
                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                            title="Supprimer ce champ"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* CONFIGURATION DE L'IDENTITÉ VISUELLE (LOGO) */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4" id="logo-settings-panel">
                <div className="space-y-1 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Logo de la Plateforme</h4>
                  <p className="text-slate-500 text-xs">Personnalisez l'identité visuelle de votre application Pôle de Dons. Ce logo est synchronisé en temps réel avec Supabase et s'affiche dans l'en-tête public et l'interface administrative.</p>
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
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById("platform-logo-upload")?.click()}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Fichier
                        </button>
                        <input
                          type="file"
                          id="platform-logo-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleSaveLogo}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      >
                                                <Save className="h-3.5 w-3.5" />
                        Enregistrer le Logo
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CONFIGURATION DE L'IMAGE DE COUVERTURE (HERO) */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4" id="hero-settings-panel">
                <div className="space-y-1 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Image de couverture (Vitrine)</h4>
                  <p className="text-slate-500 text-xs">Personnalisez l'image d'arrière-plan de la section héro de la vitrine.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 pt-2">
                  <div className="h-20 w-32 rounded-2xl overflow-hidden shadow-md border border-slate-100 bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <img 
                      src={inputHeroUrl || "/assets/images/fedex_delivery_car_keys.jpg"} 
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
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                    <div className="flex justify-end pt-1">
                      <button 
                        type="button"
                        onClick={handleSaveHeroImage}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      >
                         <Save className="h-3.5 w-3.5" /> Enregistrer l'image
                      </button>
                    </div>
                  </div>
                </div>
              </div>


            </motion.div>
          )}

          {/* TAB 6 : VISITOR CHATS (LIVE PRE-APPLICATION MESSAGES) */}
          {activeTab === "visitor_chats" && (
            <motion.div
              key="visitor_chats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Messagerie Directe - Visiteurs en Ligne</h3>
                <p className="text-slate-500 text-xs">Répondez instantanément aux questions des visiteurs intéressés par vos dons avant leur soumission de dossier officielle.</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
                {/* Liste des conversations (Groupées par utilisateur) */}
                <div className="md:col-span-4 border-r border-slate-100 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Conversations par Utilisateur ({Object.keys(visitorChatsByUser).length})
                    </h4>
                    {onlineCount > 0 && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-bold border border-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {onlineCount} en ligne
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {Object.keys(visitorChatsByUser).length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs italic">
                        Aucun message de visiteur pour le moment.
                      </div>
                    ) : (
                      Object.keys(visitorChatsByUser).map((userName, vIdx) => {
                        const chatHistory = visitorChatsByUser[userName] || [];
                        const lastMsg = chatHistory[chatHistory.length - 1];
                        const isActive = activeVisitorUserId === userName;
                        
                        // Calculer le total des non lus pour cet utilisateur
                        const unreadCount = chatHistory.reduce((acc, m) => {
                          const donId = m.donation_id;
                          // C'est un peu complexe car visitorUnreadCounts est par donation_id
                          // On va simplifier : si le dernier message est de l'utilisateur et qu'il n'est pas le chat actif
                          return acc;
                        }, 0);

                        // Trouver si l'utilisateur est en ligne
                        const isOnline = onlineUsers.some(u => u.name === userName || u.user_metadata?.name === userName);

                        return (
                          <div
                            key={`visitor-chat-${userName}-${vIdx}`}
                            onClick={() => setActiveVisitorUserId(userName)}
                            className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                              isActive 
                                ? "bg-amber-50 border-amber-200 font-bold shadow-sm" 
                                : "bg-white border-slate-150 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <div className="flex items-center gap-2 truncate">
                                {isOnline && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
                                <span className="font-extrabold text-slate-950 truncate max-w-[190px]">
                                  {userName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {chatHistory.length > 0 && (
                                  <span className="text-[8px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-black">
                                    {chatHistory.length}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 truncate">
                              {lastMsg ? `${lastMsg.sender === "agent" ? (lastMsg.user_id === "bot" ? "🤖 Bot" : "Vous") : (lastMsg.user_name || "Lui")} : ${lastMsg.content}` : "Pas de message"}
                            </p>
                            {lastMsg?.created_at && (
                              <p className="text-[8px] text-slate-400 mt-0.5">
                                {new Date(lastMsg.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Fenêtre de chat active */}
                <div className="md:col-span-8 flex flex-col justify-between min-h-[420px]">
                  {activeVisitorUserId ? (
                    (() => {
                      const rawChatHistory = visitorChatsByUser[activeVisitorUserId] || [];
                      const chatHistory = activeVisitorUnifiedMessages.length > 0 
                        ? activeVisitorUnifiedMessages 
                        : rawChatHistory;
                      const lastMsg = chatHistory[chatHistory.length - 1];

                      return (
                        <div className="flex flex-col justify-between h-full flex-1">
                          {/* En-tête du fil */}
                          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-black text-amber-600 uppercase block">
                                Historique Complet & Unifié (Live + Dossier)
                              </span>
                              <h4 className="font-extrabold text-slate-900 text-xs">
                                Discussion avec {activeVisitorUserId}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2">
                              {onlineUsers.some(u => u.name === activeVisitorUserId || u.user_metadata?.name === activeVisitorUserId) ? (
                                <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  EN LIGNE
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-slate-400">Hors ligne</span>
                              )}
                            </div>
                          </div>

                          {/* Liste des messages */}
                          <div className="p-4 space-y-3 overflow-y-auto max-h-[300px] flex-1 bg-slate-50/10">
                            {chatHistory.length === 0 ? (
                              <div className="text-center py-12 text-slate-400 text-xs">
                                Début de la discussion.
                              </div>
                            ) : (
                              chatHistory.map((msg, index) => {
                                const isAgent = msg.sender === "agent" || msg.sender === "bot" || msg.sender_type === "admin" || msg.sender_type === "system" || msg.sender === "system";
                                const msgDate = new Date(msg.created_at || Date.now());
                                const showDateHeader = index === 0 || 
                                  new Date(chatHistory[index-1].created_at).toDateString() !== msgDate.toDateString();

                                return (
                                  <div key={`chat-msg-${msg.id || 'id'}-${index}`} className="space-y-3">
                                    {showDateHeader && (
                                      <div className="flex items-center gap-4 my-4">
                                        <div className="h-px bg-slate-100 flex-1" />
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 border border-slate-100 rounded-full">
                                          {msgDate.toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </span>
                                        <div className="h-px bg-slate-100 flex-1" />
                                      </div>
                                    )}
                                    <div
                                      className={`flex flex-col max-w-[80%] ${
                                        isAgent ? "ml-auto items-end" : "mr-auto items-start"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-[9px] font-black text-slate-400">
                                          {isAgent ? (msg.user_id === "bot" || msg.sender === "bot" || msg.sender_type === "system" ? "🤖 Assistant Automatique" : "Vous (Agent)") : msg.user_name || "Visiteur"}
                                        </span>
                                        {!isAgent && (msg.is_auth || msg.sender_type === "user") && (
                                          <span className="px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-tight bg-emerald-50 text-emerald-600 border border-emerald-100">
                                            Connecté
                                          </span>
                                        )}
                                        {msg.donation_id && !msg.donation_id.startsWith("general_") && (
                                          <span className="px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-tight bg-amber-50 text-amber-600 border border-amber-100">
                                            Don: {donations.find(d => d.id === msg.donation_id)?.title?.substring(0, 20) || msg.donation_id.substring(0, 8)}...
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className={`p-3 rounded-xl text-xs leading-normal shadow-sm ${
                                          isAgent
                                            ? "bg-amber-600 text-white rounded-tr-none"
                                            : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"
                                        }`}
                                      >
                                        {msg.content}
                                        {msg.attachment && (
                                          msg.attachment.type?.startsWith("audio/") ? (
                                            <div className={`mt-2 p-1.5 rounded border flex items-center gap-2 max-w-fit ${isAgent ? "bg-amber-500/50 border-amber-400" : "bg-slate-50 border-slate-200"}`}>
                                              <audio controls src={typeof msg.attachment === 'string' ? msg.attachment : (msg.attachment.url || msg.attachment.data)} className="h-6 w-32 outline-none" />
                                            </div>
                                          ) : (
                                            <div className={`mt-2 p-1.5 rounded border flex items-center gap-2 max-w-fit ${isAgent ? "bg-amber-500/50 border-amber-400" : "bg-slate-50 border-slate-200"}`}>
                                              <Paperclip size={12} className={isAgent ? "text-amber-200" : "text-slate-400"} />
                                              <a 
                                                href={typeof msg.attachment === 'string' ? msg.attachment : (msg.attachment.url || msg.attachment.data)} 
                                                download={msg.attachment.name || "piece_jointe"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`text-[10px] font-bold hover:underline truncate max-w-[200px] ${isAgent ? "text-white" : "text-amber-600"}`}
                                              >
                                                {msg.attachment.name || "Pièce jointe"}
                                              </a>
                                            </div>
                                          )
                                        )}
                                      </div>
                                      <span className="text-[8px] text-slate-400 mt-1">
                                        {msgDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Zone d'envoi du message */}
                          <div className="p-4 border-t border-slate-100 bg-white space-y-2">
                            {visitorReplyFile && visitorReplyFile.type !== "audio/webm" && (
                              <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-100 rounded-lg">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <Paperclip className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                  <span className="text-[10px] text-amber-700 truncate">{visitorReplyFile.name}</span>
                                </div>
                                <button onClick={() => setVisitorReplyFile(null)} className="text-amber-400 hover:text-amber-600">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            {visitorReplyFile && visitorReplyFile.type === "audio/webm" && (
                              <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-100 rounded-lg">
                                <audio controls src={visitorReplyFile.url} className="h-8 w-48" />
                                <button onClick={() => { setVisitorReplyFile(null); audioRecorderSupport.clearAudio(); }} className="text-amber-500 hover:text-red-600 ml-2">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                            <form onSubmit={handleSendVisitorReply} className="flex gap-2">
                              {audioRecorderSupport.isRecording ? (
                                <div className="flex-1 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-red-600 font-bold text-xs font-mono">
                                      {Math.floor(audioRecorderSupport.recordingTime / 60)}:{(audioRecorderSupport.recordingTime % 60).toString().padStart(2, '0')}
                                    </span>
                                  </div>
                                  <div className="flex-1" />
                                  <button
                                    type="button"
                                    onClick={audioRecorderSupport.cancelRecording}
                                    className="p-1.5 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                    title="Annuler"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={audioRecorderSupport.stopRecording}
                                    className="p-1.5 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                                    title="Arrêter"
                                  >
                                    <Square className="h-4 w-4 fill-current" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <label className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer text-slate-400 transition-all flex items-center justify-center">
                                    <Paperclip className="h-4 w-4" />
                                    <input type="file" className="hidden" onChange={handleVisitorReplyFileChange} />
                                  </label>
                                  <button
                                    type="button"
                                    onMouseDown={audioRecorderSupport.startRecording}
                                    onTouchStart={audioRecorderSupport.startRecording}
                                    disabled={!!visitorReplyFile}
                                    className="p-2.5 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer transition-all flex items-center justify-center"
                                    title="Maintenir pour enregistrer une note vocale"
                                  >
                                    <Mic className="h-4 w-4" />
                                  </button>
                                  <input
                                    type="text"
                                    value={visitorReplyInput}
                                    onChange={(e) => setVisitorReplyInput(e.target.value)}
                                    placeholder="Saisissez votre réponse instantanée..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500 min-w-0"
                                  />
                                </>
                              )}
                              <button
                                type="submit"
                                disabled={(!visitorReplyInput.trim() && !visitorReplyFile) || isSendingVisitorReply || audioRecorderSupport.isRecording}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isSendingVisitorReply ? "Envoi..." : "Répondre"}
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 text-xs">
                      <MessageSquare className="h-10 w-10 text-slate-300 mb-2 animate-pulse" />
                      Sélectionnez une conversation active à gauche pour commencer à clavarder en direct avec le visiteur.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB : CHATBOT TRAINING */}
          {activeTab === "chatbot_training" && isAdmin && (
            <motion.div
              key="chatbot_training"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">Base d'Entraînement du Chatbot</h3>
                  <p className="text-slate-500 text-xs">Nourrissez la base de connaissances locale pour permettre au chatbot d'auto-répondre en direct aux utilisateurs.</p>
                </div>
                <button
                  onClick={handleOpenCreateTrainingModal}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/10 transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  Ajouter une Réponse Automatique
                </button>
              </div>

              {/* Filtre de recherche */}
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par mot-clé ou contenu de réponse..."
                  value={searchTrainingQuery}
                  onChange={(e) => setSearchTrainingQuery(e.target.value)}
                  className="flex-1 bg-transparent text-slate-700 text-xs focus:outline-none placeholder:text-slate-400"
                />
                {searchTrainingQuery && (
                  <button
                    onClick={() => setSearchTrainingQuery("")}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {/* Liste des entrées d'entraînement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const filtered = chatbotTraining.filter(entry => {
                    const query = (searchTrainingQuery || "").toLowerCase().trim();
                    const matchKeywords = (entry.keywords || []).some((kw: string) => (kw || "").toLowerCase().includes(query));
                    const matchResponse = (entry.response || "").toLowerCase().includes(query);
                    return matchKeywords || matchResponse;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="col-span-full bg-white border border-slate-100 rounded-xl p-12 text-center text-slate-400 text-xs">
                        <Bot className="h-10 w-10 text-slate-300 mx-auto mb-2 animate-pulse" />
                        Aucune entrée d'entraînement trouvée dans la base de connaissances.
                      </div>
                    );
                  }

                  return filtered.map((entry, idx) => (
                    <motion.div
                      key={`train-${entry.id || idx}-${idx}`}
                      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4 flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-indigo-500"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5 max-w-[70%]">
                            {(entry.keywords || []).map((kw: string, i: number) => (
                              <span
                                key={`kw-${entry.id || 'new'}-${kw}-${i}`}
                                className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold border border-amber-100"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                          {entry.is_confidential ? (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[9px] font-black uppercase tracking-wider border border-rose-100">
                              Confidentiel
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-wider border border-emerald-100">
                              Public
                            </span>
                          )}
                        </div>

                        <p className="text-slate-600 text-xs leading-relaxed italic">
                          "{entry.response}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-50 text-[11px] text-slate-400">
                        <span>Créé le {new Date(entry.created_at).toLocaleDateString("fr-FR")}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditTrainingModal(entry)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-all cursor-pointer"
                            title="Modifier"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTrainingEntry(entry.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ));
                })()}
              </div>

              {/* MODAL AJOUT / ÉDITION D'ENTRAÎNEMENT */}
              <AnimatePresence>
                {isTrainingModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden"
                    >
                      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Bot className="h-5 w-5 text-amber-600" />
                          <h4 className="font-black text-sm text-slate-900">
                            {selectedTrainingEntry ? "Modifier la Réponse Automatique" : "Nouvelle Réponse Automatique"}
                          </h4>
                        </div>
                        <button
                          onClick={() => setIsTrainingModalOpen(false)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveTrainingEntry} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Mots-clés déclencheurs</label>
                          <input
                            type="text"
                            placeholder="Ex: gratuit, payer, frais, coût"
                            value={trainingKeywords}
                            onChange={(e) => setTrainingKeywords(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500"
                            required
                          />
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Séparez les mots-clés par des virgules. Le chatbot analysera la présence de ces mots-clés dans les messages visiteurs pour déclencher cette réponse.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Réponse automatique</label>
                          <textarea
                            rows={4}
                            placeholder="Rédigez ici la réponse que le chatbot doit envoyer automatiquement..."
                            value={trainingResponse}
                            onChange={(e) => setTrainingResponse(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500"
                            required
                          />
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-800 block">Information Confidentielle</span>
                            <span className="text-[10px] text-slate-400 block max-w-xs leading-normal">
                              Si activé, cette information sert de note interne et ne sera JAMAIS envoyée automatiquement aux utilisateurs.
                            </span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={trainingIsConfidential}
                              onChange={(e) => setTrainingIsConfidential(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsTrainingModalOpen(false)}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingTraining}
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/10 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isSavingTraining ? "Enregistrement..." : "Enregistrer"}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB 7 : TESTIMONIALS MODERATION */}
          {activeTab === ("testimonials" as any) && (
            <motion.div
              key="testimonials_moderation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">Modération des Avis & Témoignages</h3>
                  <p className="text-slate-500 text-xs">Validez, éditez ou supprimez les retours d'expérience postés par les bénéficiaires de vos dons avant leur publication publique.</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAddTestimonialForm(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm shadow-indigo-200"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Ajouter un avis manuel
                  </button>

                  {/* Filtres par onglets internes */}
                  <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                  <button
                    onClick={() => setTestimonialFilter("pending")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      testimonialFilter === "pending"
                        ? "bg-white text-amber-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    En attente ({testimonials.filter(t => !t.approved).length})
                  </button>
                  <button
                    onClick={() => setTestimonialFilter("approved")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      testimonialFilter === "approved"
                        ? "bg-white text-amber-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Approuvés ({testimonials.filter(t => t.approved).length})
                  </button>
                  <button
                    onClick={() => setTestimonialFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      testimonialFilter === "all"
                        ? "bg-white text-amber-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Tous ({testimonials.length})
                  </button>
                </div>
              </div>
            </div>

              {/* LISTE DES TEMOIGNAGES */}
              <div className="grid grid-cols-1 gap-4">
                {(() => {
                  const filtered = testimonials.filter(t => {
                    if (testimonialFilter === "pending") return !t.approved;
                    if (testimonialFilter === "approved") return !!t.approved;
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-xs">
                        <Star className="h-10 w-10 text-slate-300 mx-auto mb-3 animate-pulse" />
                        Aucun témoignage correspondant à cette catégorie.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filtered.map((t, idx) => {
                        const don = donations.find(d => d.id === t.donation_id);

                        return (
                          <div
                            key={`testimonial-${t.id || idx}-${idx}`}
                            className={`bg-white rounded-xl border p-4 shadow-sm flex flex-col justify-between transition-all ${
                              !t.approved 
                                ? "border-amber-200 bg-amber-50/5" 
                                : "border-slate-100"
                            }`}
                          >
                            <div className="space-y-3">
                              {/* Statut et donation */}
                              <div className="flex justify-between items-start gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  t.approved 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                    : "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  {t.approved ? "Approuvé" : "En attente"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {new Date(t.created_at || "").toLocaleDateString("fr-FR")}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase block mb-0.5">Don concerné</span>
                                <p className="text-xs font-black text-slate-900 truncate">
                                  {don?.title || `Don #${t.donation_id}`}
                                </p>
                              </div>

                              {/* Auteur */}
                              <div>
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase block mb-0.5">Bénéficiaire / Auteur</span>
                                <p className="text-xs font-bold text-amber-700">{t.author_name}</p>
                              </div>

                              {/* Témoignage texte */}
                              {t.quote && (
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 italic text-slate-700 text-xs leading-relaxed">
                                  "{t.quote}"
                                </div>
                              )}

                              {/* Média attaché */}
                              {t.railway_media_url && (
                                <div className="space-y-1 pt-1">
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-extrabold uppercase tracking-wider inline-block">
                                    {t.media_type === "audio" ? "🔊 Audio Opus" : t.media_type === "video" ? "🎥 Vidéo" : t.media_type === "image" ? "🖼️ Image WebP" : "📝 Texte pur"}
                                  </span>

                                  {t.media_type === "audio" && (
                                    <div className="bg-amber-50/30 p-2 rounded-lg border border-indigo-150">
                                      <audio src={t.railway_media_url} controls className="w-full h-8" />
                                    </div>
                                  )}

                                  {t.media_type === "image" && (
                                    <div className="relative rounded-lg overflow-hidden border border-slate-200 mt-1 max-h-40 bg-slate-100">
                                      <img
                                        src={t.railway_media_url}
                                        alt={`Média de ${t.author_name}`}
                                        className="w-full h-32 object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          e.currentTarget.src = "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=600";
                                        }}
                                      />
                                    </div>
                                  )}

                                  {t.media_type === "video" && (
                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                                      <Video className="h-4 w-4 text-amber-600 flex-shrink-0" />
                                      {t.railway_media_url.includes("youtube.com") || t.railway_media_url.includes("youtu.be") ? (
                                        <div className="w-full space-y-1">
                                          <span className="font-semibold block truncate">{t.railway_media_url}</span>
                                          <iframe
                                            className="w-full h-24 rounded-md border border-slate-200"
                                            src={`https://www.youtube.com/embed/${
                                              t.railway_media_url.includes("v=") 
                                                ? t.railway_media_url.split("v=")[1]?.split("&")[0] 
                                                : t.railway_media_url.split("/").pop()
                                            }`}
                                            title="YouTube video player"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                          />
                                        </div>
                                      ) : (
                                        <a href={t.railway_media_url} target="_blank" rel="noopener noreferrer" className="text-amber-600 font-bold hover:underline truncate block">
                                          Voir la vidéo attachée ↗
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions de modération */}
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                              <button
                                onClick={() => handleOpenEditTestimonial(t)}
                                className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                Modifier
                              </button>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteTestimonial(t.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-red-100"
                                  title="Supprimer définitivement"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-tight">Supprimer</span>
                                </button>

                                {t.approved ? (
                                  <button
                                    onClick={() => handleApproveTestimonial(t.id, false)}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                  >
                                    Rejeter
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleApproveTestimonial(t.id, true)}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-sm shadow-amber-600/10 transition-all cursor-pointer"
                                  >
                                    Approuver
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* MODAL / FORMULAIRE DE MODIFICATION DU TEMOIGNAGE */}
              <AnimatePresence>
                {editingTestimonial && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setEditingTestimonial(null)}
                      className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                    />

                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden z-10 p-6 space-y-4 border border-slate-100"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-extrabold rounded-full uppercase tracking-wider inline-block">
                            Modération d'avis
                          </span>
                          <h3 className="text-base font-bold text-slate-900">Modifier le témoignage</h3>
                        </div>
                        <button
                          onClick={() => setEditingTestimonial(null)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveTestimonialEdit} className="space-y-3.5 text-xs">
                        {/* Auteur */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Nom de l'auteur / structure</label>
                          <input
                            type="text"
                            required
                            value={editAuthor}
                            onChange={(e) => setEditAuthor(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all"
                          />
                        </div>

                        {/* Citation / Texte */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Contenu du témoignage (texte)</label>
                          <textarea
                            rows={3}
                            value={editQuote}
                            onChange={(e) => setEditQuote(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all"
                          />
                        </div>

                        {/* Type de média */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Type de média</label>
                          <div className="grid grid-cols-4 gap-2">
                            {(["text", "audio", "image", "video"] as const).map((type, idx) => (
                              <button
                                key={`edit-type-${type}-${idx}`}
                                type="button"
                                onClick={() => setEditMediaType(type)}
                                className={`py-1.5 border rounded-lg font-bold text-center capitalize transition-all cursor-pointer ${
                                  editMediaType === type
                                    ? "bg-amber-600 border-amber-600 text-white"
                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {type === "text" ? "Texte" : type === "audio" ? "Audio" : type === "image" ? "Image" : "Vidéo"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* URL du média ou upload */}
                        {editMediaType !== "text" && (
                          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <label className="font-bold text-slate-700 block">
                              {editMediaType === "audio" ? "Fichier Audio ou lien" : editMediaType === "image" ? "Fichier Image ou lien" : "Lien Vidéo (ex: Youtube)"}
                            </label>

                            {/* Option upload pour Audio et Image */}
                            {(editMediaType === "audio" || editMediaType === "image") && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-amber-500 rounded-lg text-[11px] font-bold text-slate-700 hover:text-amber-600 transition-all cursor-pointer shadow-sm">
                                    <UploadCloud className="h-3.5 w-3.5" />
                                    {isUploadingEditTestFile ? "Téléchargement..." : "Uploader un fichier (max 50ko)"}
                                    <input
                                      type="file"
                                      accept={editMediaType === "audio" ? "audio/*" : "image/*"}
                                      onChange={handleEditTestFileUpload}
                                      disabled={isUploadingEditTestFile}
                                      className="hidden"
                                    />
                                  </label>
                                  {editTestFileStats && (
                                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                      {editTestFileStats.sizeFormatted} ({editTestFileStats.format})
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            <input
                              type="text"
                              value={editMediaUrl}
                              onChange={(e) => setEditMediaUrl(e.target.value)}
                              placeholder={editMediaType === "video" ? "Lien Youtube ou URL mp4..." : "URL absolue du fichier..."}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setEditingTestimonial(null)}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-md shadow-amber-600/10 transition-all cursor-pointer"
                          >
                            Enregistrer les modifications
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* MODAL D'AJOUT MANUEL D'UN TEMOIGNAGE */}
              <AnimatePresence>
                {showAddTestimonialForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowAddTestimonialForm(false)}
                      className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                    />

                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden z-10 p-6 space-y-4 border border-slate-100"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-extrabold rounded-full uppercase tracking-wider inline-block">
                            Nouvel avis manuel
                          </span>
                          <h3 className="text-base font-bold text-slate-900">Créer un témoignage motivant</h3>
                        </div>
                        <button
                          onClick={() => setShowAddTestimonialForm(false)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <form onSubmit={handleManualAddTestimonial} className="space-y-3.5 text-xs">
                        {/* Don concerné */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Don concerné (pour contexte)</label>
                          <select
                            required
                            value={newTestDonationId}
                            onChange={(e) => setNewTestDonationId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all"
                          >
                            <option value="">Sélectionner un don...</option>
                            {donations.map((d, idx) => (
                              <option key={`don-opt-${d.id || idx}-${idx}`} value={d.id}>{d.title}</option>
                            ))}
                          </select>
                        </div>

                        {/* Auteur */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Nom de l'auteur / structure</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Jean D., Bénéficiaire à Lyon"
                            value={newTestAuthor}
                            onChange={(e) => setNewTestAuthor(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all"
                          />
                        </div>

                        {/* Message */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Contenu du message</label>
                          <textarea
                            rows={3}
                            required
                            placeholder="Partagez l'impact positif de ce don..."
                            value={newTestQuote}
                            onChange={(e) => setNewTestQuote(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all"
                          />
                        </div>

                        {/* Type de média */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Format du média</label>
                          <div className="grid grid-cols-4 gap-2">
                            {(["text", "audio", "image", "video"] as const).map((type, idx) => (
                              <button
                                key={`new-test-type-${type}-${idx}`}
                                type="button"
                                onClick={() => {
                                  setNewTestMediaType(type);
                                  setNewTestMediaUrl("");
                                  setNewTestFileStats(null);
                                }}
                                className={`py-1.5 border rounded-lg font-bold text-center capitalize transition-all cursor-pointer ${
                                  newTestMediaType === type
                                    ? "bg-amber-600 border-amber-600 text-white"
                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {type === "text" ? "Texte" : type === "audio" ? "Audio" : type === "image" ? "Image" : "Vidéo"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Média */}
                        {newTestMediaType !== "text" && (
                          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <label className="font-bold text-slate-700 block">
                              {newTestMediaType === "audio" ? "Fichier Audio" : newTestMediaType === "image" ? "Fichier Image" : "Lien Vidéo YouTube"}
                            </label>

                            {(newTestMediaType === "audio" || newTestMediaType === "image") && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-amber-500 rounded-lg text-[11px] font-bold text-slate-700 hover:text-amber-600 transition-all cursor-pointer shadow-sm">
                                    <UploadCloud className="h-3.5 w-3.5" />
                                    {isUploadingNewTestFile ? "Téléchargement..." : "Uploader le fichier (max 900ko)"}
                                    <input
                                      type="file"
                                      accept={newTestMediaType === "audio" ? "audio/*" : "image/*"}
                                      onChange={handleManualTestFileUpload}
                                      disabled={isUploadingNewTestFile}
                                      className="hidden"
                                    />
                                  </label>
                                  {newTestFileStats && (
                                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                      {newTestFileStats.size} ({newTestFileStats.format})
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            <input
                              type="text"
                              value={newTestMediaUrl}
                              onChange={(e) => setNewTestMediaUrl(e.target.value)}
                              placeholder={newTestMediaType === "video" ? "Lien Youtube..." : "URL directe si déjà hébergé..."}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAddTestimonialForm(false)}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            disabled={isUploadingNewTestFile}
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-md shadow-amber-600/10 transition-all cursor-pointer disabled:opacity-50"
                          >
                            Ajouter l'avis
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB : UTILISATEURS - ADMIN ONLY */}
          {activeTab === "users" && isAdmin && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">Gestion des Utilisateurs & Rôles</h3>
                  <p className="text-slate-500 text-xs">Configurez les droits d'accès et attribuez les rôles (Utilisateur, Admin, Responsable).</p>
                </div>
                <button 
                  onClick={() => {
                    fetch("/api/admin/users")
                      .then(res => res.json())
                      .then(data => setAllUsers(data))
                      .catch(err => console.error("Erreur refresh:", err));
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl text-xs font-bold transition-all cursor-pointer border border-amber-100 shadow-sm shadow-indigo-100/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualiser la liste
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Utilisateur</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rôle & Permissions</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions Rôle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {allUsers.map((user, uIdx) => (
                      <React.Fragment key={`user-row-${user.email || uIdx}`}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-bold text-xs">
                                {user.name?.[0] || user.email[0].toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-700">{user.name}</span>
                                <span className="text-[10px] text-slate-500">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                                user.role === 'admin' ? 'bg-amber-100 text-amber-700' : 
                                user.role === 'responsable' ? 'bg-amber-100 text-amber-700' : 
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {user.role}
                              </span>
                            </div>

                            {user.role === 'responsable' && (
                              <div className="flex flex-wrap gap-1">
                                {permissionsList.map((p, pIdx) => (
                                  <button
                                    key={`perm-${p.id}-${pIdx}`}
                                    onClick={() => togglePermission(user, p.id)}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                      (user.permissions || []).includes(p.id)
                                        ? "bg-amber-50 border-amber-200 text-amber-600"
                                        : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                    }`}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {user.role === 'admin' && (
                              <span className="text-[10px] text-slate-400 italic">Toutes permissions accordées</span>
                            )}
                            
                            {user.role === 'user' && (
                              <span className="text-[10px] text-slate-400 italic">Accès catalogue uniquement</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              <select
                                value={user.role}
                                onChange={(e) => handleUpdateUserRole(user.email, e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none"
                                disabled={user.email === currentUser.email}
                              >
                                <option value="user">Utilisateur</option>
                                <option value="responsable">Responsable</option>
                                <option value="admin">Administrateur</option>
                              </select>

                              <button
                                onClick={() => handleOpenEditUser(user)}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                                title="Modifier l'utilisateur"
                              >
                                <Edit className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteUser(user.email)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Supprimer l'utilisateur"
                                disabled={user.email === currentUser.email}
                              >
                                <Trash2 className={`h-4 w-4 ${user.email === currentUser.email ? "opacity-30 cursor-not-allowed" : ""}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MODAL D'EDITION D'UTILISATEUR */}
              <AnimatePresence>
                {editingUser && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setEditingUser(null)}
                      className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                    />

                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden z-10 p-6 space-y-4 border border-slate-100"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-extrabold rounded-full uppercase tracking-wider inline-block">
                            Gestion des comptes
                          </span>
                          <h3 className="text-base font-bold text-slate-900">Modifier l'utilisateur</h3>
                        </div>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveUserEdit} className="space-y-3.5 text-xs">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Nom complet</label>
                          <input
                            type="text"
                            required
                            value={editUserName}
                            onChange={(e) => setEditUserName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Email (Non modifiable)</label>
                          <input
                            type="email"
                            disabled
                            value={editingUser.email}
                            className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none cursor-not-allowed"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block">Rôle de l'utilisateur</label>
                          <select
                            value={editUserRole}
                            onChange={(e) => {
                              const r = e.target.value;
                              setEditUserRole(r);
                              if (r === "admin") {
                                setEditUserPermissions(["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "testimonials", "security"]);
                              } else if (r === "user") {
                                setEditUserPermissions([]);
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all font-bold text-slate-700"
                          >
                            <option value="user">Utilisateur</option>
                            <option value="responsable">Responsable</option>
                            <option value="admin">Administrateur</option>
                          </select>
                        </div>

                        {editUserRole === "responsable" && (
                          <div className="space-y-2 border-t border-slate-100 pt-3">
                            <label className="font-bold text-slate-700 block mb-1">Permissions du Responsable</label>
                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/50">
                              {permissionsList.map((p) => {
                                const checked = editUserPermissions.includes(p.id);
                                return (
                                  <label key={`edit-perm-check-${p.id}`} className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-600 hover:text-slate-900 font-medium">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        if (checked) {
                                          setEditUserPermissions(prev => prev.filter(x => x !== p.id));
                                        } else {
                                          setEditUserPermissions(prev => [...prev, p.id]);
                                        }
                                      }}
                                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    {p.label}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setEditingUser(null)}
                            className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg font-bold text-slate-600 transition-all cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm transition-all cursor-pointer"
                          >
                            Enregistrer les modifications
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB : PARTENAIRES */}
          {activeTab === "partners" && (
            <motion.div
              key="partners"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Gestion des Partenaires</h3>
                <p className="text-slate-500 text-xs">Ajoutez ou supprimez les logos des partenaires officiels de la plateforme.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Formulaire d'ajout */}
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4 h-fit">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <PlusCircle className="h-4 w-4 text-amber-600" />
                    Nouveau Partenaire
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nom du partenaire</label>
                      <input 
                        type="text" 
                        value={newPartner.name}
                        onChange={e => setNewPartner({...newPartner, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 outline-none"
                        placeholder="Ex: DHL, La Poste..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Logo du partenaire (WebP Compressé)</label>
                      <div className="space-y-2">
                        {/* Zone de glisser-déposer ou clic pour uploader */}
                        <div 
                          className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
                            newPartner.logo_url ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200 hover:border-amber-400 bg-slate-50/50'
                          }`}
                          onClick={() => document.getElementById("partner-logo-upload")?.click()}
                        >
                          <input 
                            type="file"
                            id="partner-logo-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 900 * 1024) {
                                  alert("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
                                  e.target.value = "";
                                  return;
                                }
                                setIsCompressingLogo(true);
                                try {
                                  const compressed = await compressImageToWebP(file);
                                  setNewPartner(prev => ({ ...prev, logo_url: compressed }));
                                } catch (err) {
                                  console.error("Erreur de compression:", err);
                                  alert("Erreur lors de la compression de l'image.");
                                } finally {
                                  setIsCompressingLogo(false);
                                }
                              }
                            }}
                          />
                          {isCompressingLogo ? (
                            <div className="flex flex-col items-center justify-center space-y-1 py-1">
                              <RefreshCw className="h-5 w-5 text-amber-500 animate-spin" />
                              <span className="text-[10px] text-amber-600 font-bold">Compression WebP...</span>
                            </div>
                          ) : newPartner.logo_url ? (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 bg-white rounded border border-slate-100 p-1 flex items-center justify-center overflow-hidden">
                                  <img 
                                    src={newPartner.logo_url} 
                                    alt="Logo" 
                                    onError={(e) => {
                                      e.currentTarget.src = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=150";
                                    }}
                                    className="max-h-full max-w-full object-contain" 
                                  />
                                </div>
                                <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                                  <Check className="h-3 w-3" /> WebP Prêt
                                </span>
                              </div>
                              <button 
                                type="button" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNewPartner(prev => ({ ...prev, logo_url: "" }));
                                }} 
                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-1">
                              <UploadCloud className="h-5 w-5 text-slate-400 mb-1" />
                              <span className="text-[10px] text-slate-600 font-semibold">Téléverser ou Glisser une image</span>
                              <span className="text-[9px] text-slate-400">PNG, JPG, SVG, WebP (auto-compresse)</span>
                            </div>
                          )}
                        </div>

                        {/* Optionnel: URL directe */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                            <span className="text-[9px] font-black text-slate-400 uppercase">Ou URL</span>
                          </div>
                          <input 
                            type="text" 
                            value={newPartner.logo_url.startsWith("data:") ? "" : newPartner.logo_url}
                            onChange={e => setNewPartner({...newPartner, logo_url: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 rounded-lg pl-14 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/20 outline-none placeholder:text-slate-400"
                            placeholder="https://exemple.com/logo.png"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Site Web (Optionnel)</label>
                      <input 
                        type="text" 
                        value={newPartner.website}
                        onChange={e => setNewPartner({...newPartner, website: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 outline-none"
                        placeholder="https://..."
                      />
                    </div>
                    <button 
                      onClick={handleAddPartner}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
                    >
                      Ajouter le partenaire
                    </button>
                  </div>
                </div>

                {/* Liste des partenaires */}
                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {partners.map((partner, pIdx) => (
                      <div key={`partner-${partner.id || pIdx}-${pIdx}`} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-slate-50 rounded-lg border border-slate-100 p-2 flex items-center justify-center overflow-hidden">
                            <img 
                              src={partner.logo_url} 
                              alt={partner.name} 
                              onError={(e) => {
                                e.currentTarget.src = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=150";
                              }}
                              className="max-h-full max-w-full object-contain" 
                            />
                          </div>
                          <div>
                            <h5 className="text-sm font-bold text-slate-900">{partner.name}</h5>
                            {partner.website && (
                              <a href={partner.website} target="_blank" rel="noreferrer" className="text-[10px] text-amber-500 flex items-center gap-1 hover:underline">
                                <Globe className="h-2.5 w-2.5" />
                                Visiter le site
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => handleOpenEditPartner(partner)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                            title="Modifier"
                          >
                            <Sliders className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDeletePartner(partner.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* MODAL DE MODIFICATION DE PARTENAIRE */}
              <AnimatePresence>
                {editingPartner && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setEditingPartner(null)}
                      className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                    />

                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden z-10 p-6 space-y-4 border border-slate-100"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold text-slate-900">Modifier le Partenaire</h3>
                        </div>
                        <button 
                          onClick={() => setEditingPartner(null)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <form onSubmit={handleSavePartnerEdit} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nom du partenaire</label>
                          <input 
                            type="text" 
                            required
                            value={editPartnerName}
                            onChange={e => setEditPartnerName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Logo du partenaire (WebP Compressé)</label>
                          <div className="space-y-2">
                            {/* Zone de glisser-déposer ou clic pour uploader */}
                            <div 
                              className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
                                editPartnerLogo ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200 hover:border-amber-400 bg-slate-50/50'
                              }`}
                              onClick={() => document.getElementById("edit-partner-logo-upload")?.click()}
                            >
                              <input 
                                type="file"
                                id="edit-partner-logo-upload"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 900 * 1024) {
                                      alert("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
                                      e.target.value = "";
                                      return;
                                    }
                                    setIsCompressingEditLogo(true);
                                    try {
                                      const compressed = await compressImageToWebP(file);
                                      setEditPartnerLogo(compressed);
                                    } catch (err) {
                                      console.error("Erreur de compression:", err);
                                      alert("Erreur lors de la compression de l'image.");
                                    } finally {
                                      setIsCompressingEditLogo(false);
                                    }
                                  }
                                }}
                              />
                              {isCompressingEditLogo ? (
                                <div className="flex flex-col items-center justify-center space-y-1 py-1">
                                  <RefreshCw className="h-5 w-5 text-amber-500 animate-spin" />
                                  <span className="text-[10px] text-amber-600 font-bold">Compression WebP...</span>
                                </div>
                              ) : editPartnerLogo ? (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 bg-white rounded border border-slate-100 p-1 flex items-center justify-center overflow-hidden">
                                      <img 
                                        src={editPartnerLogo} 
                                        alt="Logo" 
                                        onError={(e) => {
                                          e.currentTarget.src = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=150";
                                        }}
                                        className="max-h-full max-w-full object-contain" 
                                      />
                                    </div>
                                    <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                                      <Check className="h-3 w-3" /> WebP Prêt
                                    </span>
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditPartnerLogo("");
                                    }} 
                                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center py-1">
                                  <UploadCloud className="h-5 w-5 text-slate-400 mb-1" />
                                  <span className="text-[10px] text-slate-600 font-semibold">Téléverser ou Glisser une image</span>
                                  <span className="text-[9px] text-slate-400">PNG, JPG, SVG, WebP (auto-compresse)</span>
                                </div>
                              )}
                            </div>

                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <span className="text-[9px] font-black text-slate-400 uppercase">Ou URL</span>
                              </div>
                              <input 
                                type="text" 
                                value={editPartnerLogo.startsWith("data:") ? "" : editPartnerLogo}
                                onChange={e => setEditPartnerLogo(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-14 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/20 outline-none placeholder:text-slate-400"
                                placeholder="https://exemple.com/logo.png"
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Site Web (Optionnel)</label>
                          <input 
                            type="text" 
                            value={editPartnerWebsite}
                            onChange={e => setEditPartnerWebsite(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button 
                            type="button"
                            onClick={() => setEditingPartner(null)}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button 
                            type="submit"
                            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-md shadow-amber-600/10 transition-all cursor-pointer"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB : PREUVES & DOCUMENTS */}
          {activeTab === "docs" && (
            <motion.div
              key="docs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
               <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Preuves & Documents d'Instruction</h3>
                <p className="text-slate-500 text-xs">Vue centralisée de tous les documents soumis par les candidats, classés par dossier.</p>
              </div>

              <div className="space-y-6">
                {applications.length > 0 && Object.keys(submissions).some(id => (submissions[id] || []).length > 0) ? (
                  applications.map((app, appIdx) => {
                    const appSubs = submissions[app.id] || [];
                    
                    // Filtrer pour trouver les documents réels
                    const docSubs = appSubs.filter(s => {
                      let data = s.form_data;
                      if (typeof data === 'string') {
                        try { data = JSON.parse(data); } catch (e) { return false; }
                      }
                      if (!data) return false;

                      // Déjà identifiés comme fichiers
                      if (data.fileUrl || data.audioData || data.attachment) return true;
                      
                      // Détecter dynamiquement les fichiers dans les formulaires personnalisés
                      return Object.values(data).some(val => 
                        typeof val === 'string' && (
                          val.toLowerCase().endsWith('.pdf') || 
                          val.toLowerCase().endsWith('.doc') || 
                          val.toLowerCase().endsWith('.docx') || 
                          val.toLowerCase().endsWith('.xls') || 
                          val.toLowerCase().endsWith('.xlsx') || 
                          val.toLowerCase().endsWith('.jpg') || 
                          val.toLowerCase().endsWith('.jpeg') || 
                          val.toLowerCase().endsWith('.png') ||
                          val.startsWith('data:') ||
                          val.startsWith('http')
                        )
                      );
                    });
                    
                    if (docSubs.length === 0) return null;

                    return (
                      <div key={`app-doc-${app.id || appIdx}-${appIdx}`} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center font-black text-xs">
                              {app.user_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-xs">{app.user_name}</h4>
                              <p className="text-[10px] text-slate-500">Dossier #{app.id.substring(0, 8).toUpperCase()}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                               setActiveTab("applications");
                            }}
                            className="text-[10px] font-bold text-amber-600 hover:text-amber-800 transition-colors"
                          >
                            Voir le dossier complet
                          </button>
                        </div>
                        
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {docSubs.map((sub, sIdx) => {
                            let data = sub.form_data;
                            if (typeof data === 'string') {
                              try { data = JSON.parse(data); } catch (e) { data = {}; }
                            }

                            const isAudio = sub.step_index === 3 || data.audioData;
                            
                            // Trouver dynamiquement l'URL et le nom du fichier
                            let fileUrl = data.fileUrl || data.audioData || data.attachment?.url || data.attachment;
                            let fileName = data.stats?.fileName || (isAudio ? "Pitch vocal" : `Document`);

                            if (typeof fileUrl === 'object' && fileUrl !== null) {
                              fileUrl = (fileUrl as any).url || (fileUrl as any).path || "";
                            }

                            if (!fileUrl) {
                              // Chercher dans les valeurs de form_data
                              const potentialFile = Object.entries(data).find(([k, v]) => 
                                typeof v === 'string' && (
                                  v.startsWith('http') || 
                                  v.startsWith('data:') || 
                                  /\.(pdf|doc|docx|jpg|jpeg|png|xlsx|xls)$/i.test(v)
                                )
                              );
                              if (potentialFile) {
                                fileName = potentialFile[0].replace(/_/g, ' ');
                                fileUrl = potentialFile[1] as string;
                              }
                            }

                            const stepLabel = workflowSteps[sub.step_index]?.label || `Étape ${sub.step_index + 1}`;

                            return (
                              <div key={`sub-${app.id}-${sub.id || sIdx}-${sIdx}`} className="border border-slate-100 rounded-lg p-3 space-y-2 hover:border-amber-200 transition-colors bg-slate-50/30">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-md ${isAudio ? "bg-amber-50 text-amber-600" : "bg-amber-50 text-amber-600"}`}>
                                    {isAudio ? <Mic className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-bold text-slate-800 text-[10px] truncate">{fileName}</h5>
                                    <p className="text-[9px] text-slate-500 truncate">{stepLabel}</p>
                                  </div>
                                </div>
                                
                                {isAudio && fileUrl && (
                                  <audio src={fileUrl} controls className="h-6 w-full scale-90 origin-left" />
                                )}

                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[8px] text-slate-400">
                                    {new Date(sub.submitted_at).toLocaleDateString("fr-FR")}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => openDocument(fileUrl, fileName)}
                                      className="px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-600 hover:text-amber-600 hover:border-amber-200 transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye className="h-3 w-3" />
                                      Ouvrir
                                    </button>
                                    <button 
                                      onClick={async () => {
                                        if (onDeleteSubmission && await confirmAction("Supprimer le document", "Voulez-vous vraiment supprimer définitivement ce document de preuve ? Cette action est irréversible.")) {
                                          await onDeleteSubmission(sub.id);
                                        }
                                      }}
                                      className="px-2 py-1 bg-white border border-red-100 rounded text-[9px] font-bold text-red-500 hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Supprimer
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                   <div className="p-12 text-center bg-white border border-slate-100 rounded-xl shadow-sm space-y-3">
                    <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <FileCheck className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-700">Aucun document soumis</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">Dès que des candidats soumettront des fichiers, ils apparaîtront ici de manière centralisée.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 8 : SÉCURITÉ & COMPTE */}
          {activeTab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Sécurité & Paramètres du compte</h3>
                <p className="text-slate-500 text-xs">Gérez votre mot de passe et les paramètres de sécurité de votre profil.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm max-w-2xl">
                <SecuritySettings userEmail={currentUser?.email || ""} />
              </div>
            </motion.div>
          )}

          {/* TAB WHATSAPP CALLS */}
          {activeTab === "whatsapp_calls" && (
            <motion.div
              key="whatsapp_calls"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">Suivi des Appels WhatsApp</h3>
                  <p className="text-slate-500 text-xs">
                    Consultez l'historique des appels téléphoniques initiés vers la commission depuis la plateforme, avec le profil des clients et les dons qu'ils consultaient.
                  </p>
                </div>
                <button
                  onClick={loadWhatsappCalls}
                  className="px-4 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 text-amber-800 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualiser la liste
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {whatsappCalls && whatsappCalls.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-4 px-6">Client / Profil</th>
                          <th className="py-4 px-6">Coordonnées</th>
                          <th className="py-4 px-6">Date & Heure</th>
                          <th className="py-4 px-6">Dons Consultés avant l'appel</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                        {whatsappCalls.slice().reverse().map((call: any, cIdx: number) => (
                          <tr key={`call-${call.id || cIdx}-${cIdx}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shrink-0">
                                  {call.client_name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-900 flex items-center gap-2">
                                    {call.client_name}
                                    {call.is_guest ? (
                                      <span className="bg-stone-100 text-stone-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-stone-200/50">
                                        Invité
                                      </span>
                                    ) : (
                                      <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-100">
                                        Connecté
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 space-y-1">
                              {call.client_email ? (
                                <div className="text-slate-500 text-[11px]">
                                  Email : <span className="font-semibold text-slate-700">{call.client_email}</span>
                                </div>
                              ) : null}
                              {call.client_phone ? (
                                <div className="text-slate-500 text-[11px]">
                                  Tél : <span className="font-semibold text-slate-700">{call.client_phone}</span>
                                </div>
                              ) : (
                                <div className="text-slate-400 italic text-[11px]">Aucun numéro renseigné</div>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-800">{call.date_str}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">{call.time_str}</div>
                            </td>
                            <td className="py-4 px-6">
                              {call.viewed_donations && call.viewed_donations.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 max-w-md">
                                  {call.viewed_donations.map((title: string, idx: number) => (
                                    <span
                                      key={`call-don-${cIdx}-${idx}-${title}`}
                                      className="inline-flex items-center gap-1 bg-amber-50/50 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-amber-100/50"
                                    >
                                      <Gift className="h-3 w-3 text-amber-500 shrink-0" />
                                      {title}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Aucun don consulté (Page d'accueil)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-16 text-center space-y-4">
                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <PhoneCall className="h-8 w-8 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-700">Aucun appel WhatsApp enregistré</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Dès que des visiteurs ou des candidats cliqueront sur le bouton d'appel de l'en-tête, ils apparaîtront dans cette liste.
                      </p>
                    </div>
                    <button
                      onClick={loadWhatsappCalls}
                      className="px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Vérifier à nouveau
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 9 : GESTION DES MODES DE PAIEMENT */}
          {activeTab === "payments" && (
            <motion.div
              key="payments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">Modes de Paiement Dynamiques</h3>
                  <p className="text-slate-500 text-xs">Gérez les moyens de paiement disponibles pour les frais de douane, d'envoi et de dossiers dans le chat candidat.</p>
                </div>
                <button
                  onClick={() => {
                    setEditingPaymentMethod(null);
                    setPaymentMethodForm({
                      name: "",
                      type: "crypto",
                      details: "",
                      cryptoAddress: "",
                      cryptoCurrency: "ETH",
                      bankName: "",
                      iban: "",
                      bic: "",
                      accountHolder: ""
                    });
                    setShowAddPaymentMethodModal(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow flex items-center gap-2 transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  Ajouter un Mode
                </button>
              </div>

              {/* Liste des modes existants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paymentMethods.map((method, idx) => (
                  <div key={`method-${method.id || idx}-${idx}`} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4 relative overflow-hidden transition-all hover:shadow-md">
                    {/* Badge type */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        method.type === "crypto" 
                          ? "bg-amber-50 text-amber-700 border border-amber-200/50" 
                          : "bg-amber-50 text-amber-700 border border-amber-200/50"
                      }`}>
                        {method.type === "crypto" ? "Crypto MetaMask" : "Virement Bancaire"}
                      </span>
                    </div>

                    <div className="flex gap-4 items-start">
                      <div className={`p-3 rounded-xl ${method.type === "crypto" ? "bg-amber-50 text-amber-500" : "bg-amber-50 text-amber-500"}`}>
                        {method.type === "crypto" ? <Coins className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
                      </div>
                      <div className="space-y-1 pr-20">
                        <h4 className="text-sm font-bold text-slate-900">{method.name}</h4>
                        <p className="text-slate-400 text-[11px] leading-relaxed">{method.details}</p>
                      </div>
                    </div>

                    {/* Données spécifiques */}
                    <div className="bg-slate-50 rounded-lg p-3 text-[11px] space-y-1.5 text-slate-600">
                      {method.type === "crypto" ? (
                        <>
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-400">Crypto-Devise :</span>
                            <span className="font-bold text-slate-800">{method.cryptoCurrency || "ETH"}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-slate-400">Adresse de Réception :</span>
                            <span className="font-mono bg-slate-100 text-slate-700 p-1.5 rounded text-[10px] break-all border border-slate-200/50 select-all">{method.cryptoAddress}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-400">Titulaire :</span>
                            <span className="font-medium text-slate-800">{method.accountHolder}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-400">Banque :</span>
                            <span className="font-medium text-slate-800">{method.bankName}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-400">IBAN :</span>
                            <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800 text-[10px]">{method.iban}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-400">BIC / SWIFT :</span>
                            <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800 text-[10px]">{method.bic}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Actions de bas de carte */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      {/* Toggle Active */}
                      <button
                        onClick={() => handleTogglePaymentMethod(method.id)}
                        className={`flex items-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                          method.active ? "text-emerald-600" : "text-slate-400"
                        }`}
                      >
                        <div className={`h-4 w-7 rounded-full p-0.5 transition-colors ${method.active ? "bg-emerald-500" : "bg-slate-200"}`}>
                          <div className={`h-3 w-3 bg-white rounded-full shadow-sm transform transition-transform ${method.active ? "translate-x-3" : "translate-x-0"}`} />
                        </div>
                        {method.active ? "Actif" : "Désactivé"}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingPaymentMethod(method);
                            setPaymentMethodForm({ ...method });
                            setShowAddPaymentMethodModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded transition-all cursor-pointer"
                          title="Modifier"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePaymentMethod(method.id)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-all cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal d'ajout / édition */}
              {showAddPaymentMethodModal && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden"
                  >
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="font-black text-slate-900 text-sm">
                        {editingPaymentMethod ? "Modifier le Mode de Paiement" : "Ajouter un Mode de Paiement"}
                      </h4>
                      <button
                        onClick={() => {
                          setShowAddPaymentMethodModal(false);
                          setEditingPaymentMethod(null);
                        }}
                        className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSavePaymentMethod} className="p-5 space-y-4">
                      {/* Nom */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nom du mode</label>
                        <input
                          type="text"
                          required
                          value={paymentMethodForm.name}
                          onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, name: e.target.value })}
                          placeholder="Ex: MetaMask USDT, Virement Banque Populaire..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                        />
                      </div>

                      {/* Type */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Type de Paiement</label>
                        <select
                          value={paymentMethodForm.type}
                          onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, type: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                        >
                          <option value="crypto">Crypto-monnaie (MetaMask)</option>
                          <option value="virement">Virement Bancaire (Dépôt direct)</option>
                        </select>
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Description / Instructions</label>
                        <textarea
                          rows={2}
                          required
                          value={paymentMethodForm.details}
                          onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, details: e.target.value })}
                          placeholder="Instructions claires pour guider le candidat..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white resize-none"
                        />
                      </div>

                      {/* Champs dynamiques selon le Type */}
                      {paymentMethodForm.type === "crypto" ? (
                        <div className="space-y-3 bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                          {/* Devise */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-amber-800">Crypto-Devise</label>
                            <select
                              value={paymentMethodForm.cryptoCurrency}
                              onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, cryptoCurrency: e.target.value })}
                              className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="ETH">ETH (Ethereum Native)</option>
                              <option value="USDT">USDT (Stablecoin Dollar)</option>
                              <option value="USDC">USDC (Stablecoin Dollar)</option>
                            </select>
                          </div>
                          {/* Adresse */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-amber-800">Adresse de votre portefeuille de réception (Crypto Address)</label>
                            <input
                              type="text"
                              required
                              value={paymentMethodForm.cryptoAddress}
                              onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, cryptoAddress: e.target.value })}
                              placeholder="0x..."
                              className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                          {/* Titulaire */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-indigo-800">Nom du titulaire du compte</label>
                            <input
                              type="text"
                              required
                              value={paymentMethodForm.accountHolder}
                              onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, accountHolder: e.target.value })}
                              placeholder="Ex: Pôle de Dons Org"
                              className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                          {/* Banque */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-indigo-800">Nom de la banque</label>
                            <input
                              type="text"
                              required
                              value={paymentMethodForm.bankName}
                              onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, bankName: e.target.value })}
                              placeholder="Ex: Société Générale"
                              className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                          {/* IBAN */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-indigo-800">IBAN</label>
                            <input
                              type="text"
                              required
                              value={paymentMethodForm.iban}
                              onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, iban: e.target.value })}
                              placeholder="FR76..."
                              className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                          {/* BIC */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-indigo-800">BIC / SWIFT</label>
                            <input
                              type="text"
                              required
                              value={paymentMethodForm.bic}
                              onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, bic: e.target.value })}
                              placeholder="Ex: SOGEFRPPXXX"
                              className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddPaymentMethodModal(false);
                            setEditingPaymentMethod(null);
                          }}
                          className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-lg transition-all cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold rounded-lg transition-all shadow cursor-pointer"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Toast Notification en temps réel pour l'admin / responsable */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            key="realtime-admin-toast-animation"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            onClick={() => {
              if (activeToast.title.includes("Live") || activeToast.title.includes("Visiteur")) {
                setActiveTab("visitor_chats");
              } else {
                setActiveTab("applications");
              }
              setActiveToast(null);
            }}
            className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl p-4 flex gap-3 items-start cursor-pointer hover:bg-slate-850 transition-all"
            id="realtime-admin-toast"
          >
            <div className="bg-amber-600 p-2 rounded-lg text-white">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-amber-400">{activeToast.title}</p>
              <p className="text-xs font-bold text-slate-200 mt-0.5">{activeToast.senderName}</p>
              <p className="text-xs text-slate-400 mt-1 truncate">{activeToast.content}</p>
              <p className="text-[9px] text-slate-500 mt-2 font-medium">Cliquer pour ouvrir la discussion</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveToast(null);
              }}
              className="text-slate-500 hover:text-slate-300 text-lg leading-none"
            >
              &times;
            </button>
          </motion.div>
        )}
        <DocumentModal
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          fileUrl={selectedDoc?.url || ""}
          fileName={selectedDoc?.name || "Document"}
        />
        <ConfirmModal
          isOpen={confirmDialog?.isOpen || false}
          title={confirmDialog?.title || ""}
          message={confirmDialog?.message || ""}
          onConfirm={() => confirmDialog?.onConfirm()}
          onCancel={() => confirmDialog?.onCancel()}
        />
      </AnimatePresence>

    </div>
  );
}
