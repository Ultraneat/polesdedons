/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Donation, Testimonial, Application, ApplicationMessage, DbStatus, WorkflowStep } from "./types";
import DonationCatalog from "./components/DonationCatalog";
import CandidateDashboard from "./components/CandidateDashboard";
import AdminDashboard from "./components/AdminDashboard";
import AboutUs from "./components/AboutUs";
import ContactPage from "./components/ContactPage";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfUse from "./components/TermsOfUse";
import CookieBanner from "./components/CookieBanner";
import { registerUser, getSocket, joinConversation } from "./lib/socket";
import { compressImageToWebP, blobToBase64 } from "./lib/fileCompressor";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { 
  Gift, 
  Layers, 
  ShieldAlert, 
  Loader2, 
  Activity, 
  HelpCircle,
  Database,
  ArrowRight,
  User,
  LogOut,
  X,
  Lock,
  Mail,
  UserCheck,
  Eye,
  EyeOff,
  Send,
  ShieldCheck,
  Globe,
  Menu,
  Compass,
  Sparkles,
  ChevronRight,
  Phone,
  ArrowUpRight,
  LayoutDashboard,
  FileCheck,
  UserPlus,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Headphones,
  Paperclip, Mic, Square, Trash2, Play, Pause
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "react-hot-toast";

// Son de notification (Bip court)
const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // La 5
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    // Silencieux si bloqué par le navigateur
  }
};

const DEFAULT_WORKFLOW_STEPS: WorkflowStep[] = [
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

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hr', label: 'Hrvatski', flag: '🇭🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' }
];

const clearGoogtransCookie = () => {
  try {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const domains = [hostname, `.${hostname}`, ''];
    
    // Dynamically add parent domains (e.g., .run.app, .europe-west3.run.app)
    for (let i = 0; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join('.');
      domains.push(parent);
      domains.push(`.${parent}`);
    }
    
    domains.forEach(dom => {
      const domStr = dom ? `; domain=${dom}` : '';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domStr}`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=;${domStr}`;
    });
  } catch (e) {
    console.error("Cookie clean error", e);
  }
};

export default function App() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [currentLang, setCurrentLang] = useState<string>(() => {
    try {
      return localStorage.getItem("user_lang") || "fr";
    } catch {
      return "fr";
    }
  });

  const changeGoogleTranslate = (langCode: string) => {
    try {
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (select) {
        select.value = langCode;
        select.dispatchEvent(new Event('change'));
      } else {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          const retrySelect = document.querySelector('.goog-te-combo') as HTMLSelectElement;
          if (retrySelect) {
            retrySelect.value = langCode;
            retrySelect.dispatchEvent(new Event('change'));
            clearInterval(interval);
          } else if (attempts > 30) {
            clearInterval(interval);
          }
        }, 200);
      }
    } catch (e) {
      console.error("Google translate trigger error", e);
    }
  };

  const handleLanguageChange = (langCode: string) => {
    try {
      setCurrentLang(langCode);
      localStorage.setItem("user_lang", langCode);
      localStorage.setItem("user_language_initialized", "true");
      
      // Clear existing cookies first to avoid conflicts
      clearGoogtransCookie();
      
      if (langCode !== "fr") {
        document.cookie = `googtrans=/fr/${langCode}; path=/;`;
        document.cookie = `googtrans=/fr/${langCode}; path=/; domain=${window.location.hostname};`;
        document.cookie = `googtrans=/fr/${langCode}; path=/; domain=.${window.location.hostname};`;
      }

      // Reload page to force Google Translate to initialize in the correct language from the cookie
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const savedLangOnBoot = localStorage.getItem("user_lang") || "fr";
    if (savedLangOnBoot === "fr") {
      clearGoogtransCookie();
    }

    const initTranslation = () => {
      if (document.getElementById("google-translate-script")) {
        // If already loaded, trigger translation to match saved preference
        const savedLang = localStorage.getItem("user_lang") || "fr";
        if (savedLang !== "fr") {
          changeGoogleTranslate(savedLang);
        }
        return;
      }

      (window as any).googleTranslateElementInit = () => {
        new (window as any).google.translate.TranslateElement({
          pageLanguage: 'fr',
          includedLanguages: 'fr,en,hr,de,es,it,nl,pt',
          autoDisplay: false
        }, 'google_translate_element');

        // Once initialized, trigger saved language if not French
        const savedLang = localStorage.getItem("user_lang") || "fr";
        if (savedLang !== "fr") {
          setTimeout(() => changeGoogleTranslate(savedLang), 500);
        }
      };

      if (!document.getElementById("google_translate_element")) {
        const div = document.createElement("div");
        div.id = "google_translate_element";
        // Keep it rendered offscreen so the Google widget script actually initializes its children DOM elements
        div.style.position = "absolute";
        div.style.top = "-9999px";
        div.style.left = "-9999px";
        div.style.width = "1px";
        div.style.height = "1px";
        div.style.overflow = "hidden";
        document.body.appendChild(div);
      }

      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.type = "text/javascript";
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      document.body.appendChild(script);
    };

    initTranslation();

    // Détection automatique lors de la première visite du pays/navigateur
    try {
      const isInitialized = localStorage.getItem("user_language_initialized");
      if (!isInitialized) {
        const langNav = navigator?.language || (navigator as any)?.userLanguage || "fr";
        const detected = (typeof langNav === "string" ? langNav.split("-")[0] : "fr").toLowerCase();
        const supported = ["en", "hr", "de", "es", "it", "nl", "pt"];
        if (supported.includes(detected) && detected !== "fr") {
          document.cookie = `googtrans=/fr/${detected}; path=/;`;
          document.cookie = `googtrans=/fr/${detected}; path=/; domain=${window.location.hostname};`;
          document.cookie = `googtrans=/fr/${detected}; path=/; domain=.${window.location.hostname};`;
          localStorage.setItem("user_language_initialized", "true");
          localStorage.setItem("user_lang", detected);
          window.location.reload();
        } else {
          localStorage.setItem("user_language_initialized", "true");
          localStorage.setItem("user_lang", "fr");
        }
      }
    } catch (e) {
      console.error("Erreur de détection de langue", e);
    }
  }, []);

  // Navigation active tab: 'catalog', 'dashboard', 'about', 'contact', 'admin'
  const [activeTab, setActiveTab] = useState<"catalog" | "dashboard" | "about" | "contact" | "admin" | "privacy" | "terms">(() => {
    try {
      const saved = localStorage.getItem("activeTab");
      if (saved && ["catalog", "dashboard", "about", "contact", "admin"].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return "catalog";
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  
  // Base de données state
  const [donations, setDonations] = useState<Donation[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [messages, setMessages] = useState<Record<string, ApplicationMessage[]>>({});
  const [submissions, setSubmissions] = useState<Record<string, any[]>>({});
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [partners, setPartners] = useState<any[]>([]);

  // Workflow steps configurables par l'admin
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(() => {
    const saved = localStorage.getItem("workflow_steps");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse workflow steps", e);
      }
    }
    return DEFAULT_WORKFLOW_STEPS;
  });

  useEffect(() => {
    localStorage.setItem("workflow_steps", JSON.stringify(workflowSteps));
  }, [workflowSteps]);

  // Dynamic application form fields (now synced with API)
  const [adminDefinedFields, setAdminDefinedFields] = useState<Array<{key: string, label: string, type: string, placeholder: string}>>([]);
  const [platformLogo, setPlatformLogo] = useState<string>("/assets/images/logo_donationsphere_1785861089629.jpg");
  const [platformHeroImage, setPlatformHeroImage] = useState<string>("/assets/images/fedex_delivery_car_keys.jpg");

  // Synchroniser le favicon du navigateur avec le logo officiel de la plateforme
  useEffect(() => {
    if (platformLogo) {
      const iconLinks = document.querySelectorAll("link[rel*='icon']");
      iconLinks.forEach((link) => {
        (link as HTMLLinkElement).href = platformLogo;
      });
      if (iconLinks.length === 0) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = platformLogo;
        document.head.appendChild(link);
      }
    }
  }, [platformLogo]);

  // Charger les paramètres depuis l'API
  const fetchSettings = async () => {
    try {
      const [resFields, resWorkflow, resLogo, resHero] = await Promise.all([
        fetch("/api/settings/admin_defined_fields"),
        fetch("/api/settings/workflow_steps"),
        fetch("/api/settings/platform_logo").catch(() => null),
        fetch("/api/settings/platform_hero_image").catch(() => null)
      ]);

      if (resFields.ok) {
        const data = await resFields.json();
        setAdminDefinedFields(data);
      }

      if (resWorkflow.ok) {
        const data = await resWorkflow.json();
        if (data && Array.isArray(data)) {
          setWorkflowSteps(data);
          localStorage.setItem("workflow_steps", JSON.stringify(data));
        }
      }

      if (resLogo && resLogo.ok) {
        const logoUrl = await resLogo.json().catch(() => null);
        if (logoUrl && typeof logoUrl === "string") {
          setPlatformLogo(logoUrl);
        }
      }

      if (resHero && resHero.ok) {
        const heroUrl = await resHero.json().catch(() => null);
        if (heroUrl && typeof heroUrl === "string") {
          setPlatformHeroImage(heroUrl);
        }
      }
    } catch (e) {
      console.error("Erreur lors du chargement des paramètres", e);
    }
  };

  const savePlatformHeroImage = async (imageUrl: string) => {
    const loadingToast = toast.loading("Enregistrement de l'image de couverture...");
    try {
      const res = await fetch("/api/settings/platform_hero_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: imageUrl })
      });
      if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
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

  const savePlatformLogo = async (logoUrl: string) => {
    const loadingToast = toast.loading("Enregistrement du logo sur le serveur...");
    try {
      const res = await fetch("/api/settings/platform_logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: logoUrl })
      });
      if (!res.ok) {
        throw new Error(`Erreur HTTP: ${res.status}`);
      }
      setPlatformLogo(logoUrl);
      toast.dismiss(loadingToast);
      toast.success("Logo sauvegardé avec succès sur le serveur !");
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du logo", e);
      toast.dismiss(loadingToast);
      toast.error("Impossible de sauvegarder le logo sur le serveur.");
    }
  };

  const saveAdminFields = async (fields: any[]) => {
    try {
      await fetch("/api/settings/admin_defined_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: fields })
      });
      setAdminDefinedFields(fields);
    } catch (e) {
      console.error("Erreur lors de la sauvegarde des paramètres", e);
    }
  };

  const saveWorkflowSteps = async (steps: WorkflowStep[]) => {
    console.log("[WORKFLOW] Tentative de sauvegarde des étapes:", steps.length);
    try {
      const res = await fetch("/api/settings/workflow_steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: steps })
      });
      if (res.ok) {
        const data = await res.json();
        console.log("[WORKFLOW] Sauvegarde réussie sur le serveur.");
        if (data && Array.isArray(data)) {
          setWorkflowSteps(data);
          localStorage.setItem("workflow_steps", JSON.stringify(data));
        }
      } else {
        console.error("[WORKFLOW] Erreur serveur lors de la sauvegarde:", res.status);
      }
    } catch (e) {
      console.error("[WORKFLOW] Exception lors de la sauvegarde du workflow", e);
    }
  };
  
  // Candidature active dans le dashboard
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("activeApplicationId");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Authentification fictive pour simulation publique
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; id?: string; role?: string } | null>(() => {
    try {
      const saved = localStorage.getItem("currentUser");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isAdmin = currentUser?.role === "admin" || currentUser?.email === "admin@donationsphere.com" || currentUser?.email === "asthedio@gmail.com";
  const isResponsable = currentUser?.role === "responsable";
  const hasManagementAccess = isAdmin || isResponsable;
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState<boolean>(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState<boolean>(false);
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false);
  const [isUpdatePasswordMode, setIsUpdatePasswordMode] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>("");
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState<boolean>(false);

  // ÉTATS COMPLÉMENTAIRES APPEL WHATSAPP & SUPPORT CHATBOT
  const [guestId] = useState(() => {
    try {
      const saved = localStorage.getItem("chat_guest_id");
      if (saved) return saved;
      const newId = "guest_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("chat_guest_id", newId);
      return newId;
    } catch {
      return "guest_" + Math.random().toString(36).substr(2, 9);
    }
  });

  const [viewedDonations, setViewedDonations] = useState<string[]>([]);
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);
  const [supportChatStage, setSupportChatStage] = useState<"ask_satisfaction" | "chatting">("ask_satisfaction");
  const [supportChatMessages, setSupportChatMessages] = useState<any[]>([]);
  const [supportChatInput, setSupportChatInput] = useState("");
  const [isSendingSupportChat, setIsSendingSupportChat] = useState(false);
  const [supportChatAttachment, setSupportChatAttachment] = useState<{ name: string; url: string; size_kb: number; type: string } | null>(null);
  const [isUploadingSupportAttachment, setIsUploadingSupportAttachment] = useState(false);
  const [supportAttachmentError, setSupportAttachmentError] = useState<string | null>(null);
  const supportFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const audioRecorder = useAudioRecorder();

  // Auto-upload audio when recording stops
  useEffect(() => {
    if (audioRecorder.audioBlob) {
      const uploadAudio = async () => {
        setIsUploadingSupportAttachment(true);
        setSupportAttachmentError(null);
        try {
          const base64Audio = await blobToBase64(audioRecorder.audioBlob!);
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
            setSupportChatAttachment({
              name: "Note vocale",
              url: data.url,
              size_kb: data.originalSizeKb || Math.round((audioRecorder.audioBlob!.size / 1024) * 10) / 10,
              type: "audio/webm"
            });
            audioRecorder.clearAudio();
          } else {
            setSupportAttachmentError("Échec de l'envoi de l'audio.");
          }
        } catch (err) {
          console.error(err);
          setSupportAttachmentError("Erreur lors de l'envoi de la note vocale.");
        } finally {
          setIsUploadingSupportAttachment(false);
        }
      };
      uploadAudio();
    }
  }, [audioRecorder.audioBlob]);

  // Déterminer l'identifiant de conversation unifié
  const getEffectiveSupportConversationId = () => {
    if (currentUser) {
      const userApp = applications.find(a => a.user_id === currentUser.id);
      return userApp ? userApp.donation_id : "general-support";
    }
    return "support";
  };

  // Charger l'historique unifié du chat de support
  const loadSupportChatHistory = async () => {
    const convId = getEffectiveSupportConversationId();
    const uId = currentUser?.id || guestId;
    const uName = currentUser?.name || "Visiteur";
    try {
      const res = await fetch(`/api/agent-conversations/${convId}?user_id=${uId}&user_name=${encodeURIComponent(uName)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSupportChatMessages(data);
          return;
        }
      }
    } catch (e) {
      console.error("Erreur chargement historique support:", e);
    }
    // Message d'accueil par défaut si aucune conversation préalable
    setSupportChatMessages([
      {
        id: "system-init",
        sender: "agent",
        content: "Bonjour ! Avez-vous été pleinement satisfait de votre échange ou souhaitez-vous un renseignement direct sur nos dons et attributions ? 😊",
        created_at: new Date().toISOString()
      }
    ]);
  };

  useEffect(() => {
    // Vérifier si on est sur la page de réinitialisation de mot de passe (via Supabase redirect)
    if (window.location.hash.includes("type=recovery") || window.location.pathname.includes("/reset-password")) {
      setIsUpdatePasswordMode(true);
    }
  }, []);

  // Synchronisation avec localStorage
  useEffect(() => {
    try {
      localStorage.setItem("activeTab", activeTab);
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    try {
      if (activeApplicationId) {
        localStorage.setItem("activeApplicationId", activeApplicationId);
      } else {
        localStorage.removeItem("activeApplicationId");
      }
    } catch {}
  }, [activeApplicationId]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
      } else {
        localStorage.removeItem("currentUser");
      }
    } catch {}
  }, [currentUser]);

  // Auto-scroll pour le chatbot de support post-appel
  useEffect(() => {
    const container = document.getElementById("support-chat-panel");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [supportChatMessages, isSendingSupportChat, isSupportChatOpen]);

  useEffect(() => {
    const effectiveId = currentUser?.id || guestId;
    if (currentUser) {
      registerUser({
        name: currentUser.name,
        is_admin: currentUser.email === "admin@donationsphere.com" || currentUser.email === "asthedio@gmail.com" || currentUser.email?.toLowerCase().includes("admin") || currentUser.role === "admin" || currentUser.role === "responsable",
        is_auth: true,
        email: currentUser.email
      });
    } else {
      registerUser({
        name: "Visiteur",
        is_admin: false,
        is_auth: false
      });
    }
    if (effectiveId) {
      joinConversation(effectiveId);
    }
  }, [currentUser, guestId]);

  useEffect(() => {
    const socket = getSocket();
    const handleAppMessage = (payload: any) => {
      setMessages(prev => {
        const list = prev[payload.application_id] || [];
        if (list.some(m => m.id === payload.id)) return prev;
        return {
          ...prev,
          [payload.application_id]: [...list, payload]
        };
      });

      // Notification visuelle et sonore si le message vient de l'agent ou du système
      if (payload.sender_type !== "user") {
        playNotificationSound();
        toast(`Nouveau message: ${payload.content.substring(0, 50)}${payload.content.length > 50 ? '...' : ''}`, {
          icon: '💬',
          position: 'top-right',
          duration: 4000
        });
      }
    };

    const handleDirectMessage = (payload: any) => {
      // Déclencher une notification si c'est l'agent qui répond
      if (payload.sender === "agent") {
        playNotificationSound();
        toast("L'agent vous a répondu dans le chat en direct", {
          icon: '🤖',
          position: 'top-right'
        });
      }

      // Synchroniser en temps réel les messages du chat de support post-appel
      setSupportChatMessages(prev => {
        if (prev.some(m => m.id === payload.id)) return prev;
        const targetConvId = getEffectiveSupportConversationId();
        const effectiveUserId = currentUser?.id || guestId;
        if (
          payload.donation_id === targetConvId ||
          payload.donation_id === "support" ||
          payload.donation_id === "general-support" ||
          (payload.user_id && payload.user_id === effectiveUserId)
        ) {
          return [...prev, payload];
        }
        return prev;
      });
    };

    const handleDonationUpdated = (updatedDon: Donation) => {
      setDonations(prev => prev.map(d => d.id === updatedDon.id ? updatedDon : d));
    };

    socket.on("application_message:received", handleAppMessage);
    socket.on("message:received", handleDirectMessage);
    socket.on("donation:updated", handleDonationUpdated);
    return () => {
      socket.off("application_message:received", handleAppMessage);
      socket.off("message:received", handleDirectMessage);
      socket.off("donation:updated", handleDonationUpdated);
    };
  }, [currentUser, guestId, applications]);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authName, setAuthName] = useState<string>("");

  // Charger les données initiales depuis le serveur Express
  const fetchAllData = async () => {
    try {
      const [resDons, resTestimonials, resApps, resStatus, resPartners, resSubmissions] = await Promise.all([
        fetch("/api/donations"),
        fetch("/api/testimonials"),
        fetch("/api/applications"),
        fetch("/api/db-status"),
        fetch("/api/partners"),
        fetch("/api/submissions")
      ]);

      await fetchSettings();

      const donsData = await resDons.json();
      const testimonialsData = await resTestimonials.json();
      const appsData = await resApps.json();
      const statusData = await resStatus.json();
      const partnersData = await resPartners.json();
      const subsData = await resSubmissions.json();

      const uniqueApps = appsData.filter((app: any, index: number, self: any[]) => 
        index === self.findIndex((a) => a.id === app.id)
      );
      const uniqueDons = donsData.filter((don: any, index: number, self: any[]) => 
        index === self.findIndex((d) => d.id === don.id)
      );
      const uniqueTestimonials = testimonialsData.filter((t: any, index: number, self: any[]) => 
        index === self.findIndex((te) => te.id === t.id)
      );

      const uniquePartners = partnersData.filter((p: any, index: number, self: any[]) => 
        index === self.findIndex((partner) => partner.id === p.id)
      );

      setDonations(uniqueDons);
      setTestimonials(uniqueTestimonials);
      setApplications(uniqueApps);
      setDbStatus(statusData);
      setPartners(uniquePartners);

      // Organiser les soumissions par application_id
      const subsMap: Record<string, any[]> = {};
      subsData.forEach((sub: any) => {
        if (!subsMap[sub.application_id]) subsMap[sub.application_id] = [];
        if (!subsMap[sub.application_id].some((s: any) => s.id === sub.id)) {
          subsMap[sub.application_id].push(sub);
        }
      });
      setSubmissions(subsMap);

      // Filtrer les candidatures éligibles à l'auto-sélection pour l'utilisateur courant (les admins voient tout)
      const eligibleApps = uniqueApps.filter((app: any) => {
        if (isAdmin || isResponsable) return true;
        if (currentUser) {
          return app.user_id === currentUser.id;
        }
        return false;
      });

      const isCurrentActiveValid = activeApplicationId && eligibleApps.some(app => app.id === activeApplicationId);

      if (eligibleApps.length > 0 && (!activeApplicationId || !isCurrentActiveValid)) {
        const latestApp = eligibleApps[0];
        setActiveApplicationId(latestApp.id);
        fetchMessages(latestApp.id);
      } else if (eligibleApps.length === 0) {
        setActiveApplicationId(null);
      }

      // Récupérer les messages uniquement pour les applications éligibles (uniques)
      for (const app of eligibleApps) {
        fetchMessages(app.id);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données :", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (appId: string) => {
    if (!appId || typeof appId !== 'string' || appId === "undefined" || appId === "null") return;
    try {
      const res = await fetch(`/api/messages/${appId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(prev => ({ ...prev, [appId]: data }));
    } catch (e) {
      // Ignorer les erreurs de fetch silencieusement pour éviter de polluer la console
      // si l'application est en cours de fermeture ou si le réseau est instable
    }
  };

  useEffect(() => {
    fetchAllData();
    
    // Polling d'actualisation légère toutes les 4 secondes (Simule Supabase Realtime)
    const interval = setInterval(() => {
      fetch("/api/applications")
        .then(res => res.json())
        .then(appsData => {
          setApplications(appsData);
          
          const uniqueApps = appsData.filter((app: any, index: number, self: any[]) => 
            index === self.findIndex((a) => a.id === app.id)
          );
          
          const eligibleApps = uniqueApps.filter((app: any) => {
            if (isAdmin || isResponsable) return true;
            if (currentUser) {
              return app.user_id === currentUser.id;
            }
            return false;
          });

          const isCurrentActiveValid = activeApplicationId && eligibleApps.some(app => app.id === activeApplicationId);

          if (eligibleApps.length > 0 && (!activeApplicationId || !isCurrentActiveValid)) {
            const latestApp = eligibleApps[0];
            setActiveApplicationId(latestApp.id);
            fetchMessages(latestApp.id);
          } else if (eligibleApps.length === 0 && activeApplicationId) {
            setActiveApplicationId(null);
          } else if (activeApplicationId) {
            fetchMessages(activeApplicationId);
          }
        });
    }, 4000);

    return () => clearInterval(interval);
  }, [activeApplicationId, currentUser, isAdmin, isResponsable]);

  // ACTION : Enregistrer une vue/consultation pour un don
  const handleViewDonation = async (id: string) => {
    try {
      const don = donations.find(d => d.id === id);
      if (don && !viewedDonations.includes(don.title)) {
        setViewedDonations(prev => [...prev, don.title]);
      }
      const response = await fetch(`/api/donations/${id}/view`, { method: "POST" });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDonations(prev => prev.map(d => d.id === id ? { ...d, views_count: result.views_count } : d));
        }
      }
    } catch (e) {
      console.error("Erreur incrementation des vues:", e);
    }
  };

  // ACTION : Déclencher un appel WhatsApp officiel et enregistrer le log de suivi
  const handleWhatsAppCall = () => {
    // 1. Ouvrir WhatsApp dans un nouvel onglet
    window.open("https://wa.me/4915216945182", "_blank");

    // 2. Enregistrer l'appel en BDD locale
    fetch("/api/calls/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: currentUser ? currentUser.name : "Invité",
        client_email: currentUser ? currentUser.email : "",
        client_phone: "",
        is_guest: !currentUser,
        viewed_donations: viewedDonations
      })
    }).catch(e => console.error("Erreur enregistrement de l'appel :", e));

    // 3. Ouvrir le chat d'accompagnement après 1.5 seconde
    setTimeout(() => {
      loadSupportChatHistory();
      setSupportChatStage("ask_satisfaction");
      setIsSupportChatOpen(true);
    }, 1500);
  };

  // ACTION : Gestion des pièces jointes du chat de support
  const handleSupportAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 900 * 1024; // 900 Ko max
    if (file.size > MAX_SIZE) {
      setSupportAttachmentError("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
      return;
    }

    setSupportAttachmentError(null);
    setIsUploadingSupportAttachment(true);

    try {
      let finalFile: string;
      let finalFileName: string = file.name;
      const isImage = file.type.startsWith("image/");

      if (isImage) {
        finalFile = await compressImageToWebP(file);
        finalFileName = file.name.split(".")[0] + ".webp";
      } else {
        finalFile = await blobToBase64(file);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: finalFile,
          fileName: finalFileName,
          fileType: isImage ? "image/webp" : file.type
        })
      });
      const data = await res.json();
      if (data.success) {
        setSupportChatAttachment({
          name: finalFileName,
          url: data.url,
          size_kb: data.originalSizeKb || Math.round((file.size / 1024) * 10) / 10,
          type: isImage ? "image/webp" : file.type
        });
      } else {
        setSupportAttachmentError("Échec du téléversement de la pièce jointe.");
      }
    } catch (err) {
      console.error(err);
      setSupportAttachmentError("Erreur lors de l'envoi de la pièce jointe.");
    } finally {
      setIsUploadingSupportAttachment(false);
      if (supportFileInputRef.current) {
        supportFileInputRef.current.value = "";
      }
    }
  };

  // ACTION : Envoyer un message dans le chat de support après appel
  const handleSendSupportChat = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText !== undefined ? customText : supportChatInput;
    if ((!textToSend.trim() && !supportChatAttachment) || isSendingSupportChat) return;

    const userMsgContent = textToSend.trim();
    const currentAttachment = supportChatAttachment;
    setSupportChatInput("");
    setSupportChatAttachment(null);
    setSupportAttachmentError(null);
    setIsSendingSupportChat(true);

    const convId = getEffectiveSupportConversationId();
    const effectiveUserId = currentUser?.id || guestId;
    const effectiveUserName = currentUser ? currentUser.name : "Visiteur";

    const userMsg = {
      id: "support-msg-" + Date.now(),
      donation_id: convId,
      sender: "user",
      content: userMsgContent,
      user_name: effectiveUserName,
      user_id: effectiveUserId,
      attachment: currentAttachment || null,
      created_at: new Date().toISOString()
    };

    setSupportChatMessages(prev => [...prev, userMsg]);

    try {
      const response = await fetch(`/api/agent-conversations/${convId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donation_id: convId,
          sender: "user",
          content: userMsgContent,
          user_name: effectiveUserName,
          user_id: effectiveUserId,
          is_auth: !!currentUser,
          attachment: currentAttachment || null,
          created_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        // Attendre que la réponse de l'IA/moteur s'enregistre et récupérer l'historique mis à jour
        setTimeout(async () => {
          try {
            const histRes = await fetch(`/api/agent-conversations/${convId}?user_id=${effectiveUserId}&user_name=${encodeURIComponent(effectiveUserName)}`);
            if (histRes.ok) {
              const histData = await histRes.json();
              if (Array.isArray(histData) && histData.length > 0) {
                setSupportChatMessages(histData);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }, 1200);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingSupportChat(false);
    }
  };

  // ACTION : Créer une candidature (Fast-Track)
  const handleApply = async (donation: Donation, candidateName: string) => {
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donation_id: donation.id,
          user_name: currentUser ? currentUser.name : candidateName,
          user_id: currentUser ? currentUser.id : undefined,
          user_email: currentUser ? currentUser.email : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || "Une erreur est survenue lors de l'envoi de votre candidature.");
        return;
      }

      const newApp = await response.json();
      
      // Mettre à jour l'arborescence des états
      setApplications(prev => [newApp, ...prev]);
      setActiveApplicationId(newApp.id);
      
      // Charger le message système d'initialisation
      await fetchMessages(newApp.id);

      toast.success("Votre dossier de candidature a été créé avec succès !");

      // Rediriger immédiatement vers le tracker de candidature
      setActiveTab("dashboard");
      
      // Mettre à jour le compteur sur le don localement
      setDonations(prev => prev.map(d => d.id === donation.id ? { ...d, current_bids_count: d.current_bids_count + 1 } : d));
    } catch (err) {
      console.error("Erreur d'ouverture de dossier :", err);
      toast.error("Impossible d'ouvrir le dossier. Veuillez réessayer.");
    }
  };

  // ACTION : Envoyer un message dans le chat candidat
  const handleSendMessage = async (content: string, attachment?: any) => {
    if (!activeApplicationId) return;

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: activeApplicationId,
          sender_type: "user",
          content,
          attachment: attachment || null
        })
      });

      const newMsg = await res.json();
      
      // Mettre à jour les messages localement
      setMessages(prev => ({
        ...prev,
        [activeApplicationId]: [...(prev[activeApplicationId] || []), newMsg]
      }));

      // Simulation de réponse de guidance automatique (si sandbox/local)
      if (!dbStatus?.connectedToSupabase) {
        setTimeout(async () => {
          const systemRes = await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              application_id: activeApplicationId,
              sender_type: "system",
              content: "Votre message a été enregistré dans votre dossier d'instruction. Un de nos agents d'attribution en prendra connaissance très rapidement !"
            })
          });
          const systemMsg = await systemRes.json();
          setMessages(prev => ({
            ...prev,
            [activeApplicationId]: [...(prev[activeApplicationId] || []), systemMsg]
          }));
        }, 1500);
      }
    } catch (e) {
      console.error("Échec d'envoi du message", e);
    }
  };

  // ACTION : Envoyer un message admin
  const handleSendAdminMessage = async (appId: string, content: string, attachment?: any) => {
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: appId,
          sender_type: "admin",
          content,
          attachment: attachment || null
        })
      });

      const newMsg = await res.json();
      setMessages(prev => ({
        ...prev,
        [appId]: [...(prev[appId] || []), newMsg]
      }));
    } catch (e) {
      console.error("Échec envoi réponse admin", e);
    }
  };

  // ACTION : Soumettre une étape
  const handleSubmitStep = async (stepIndex: number, formData: any) => {
    if (!activeApplicationId) return;

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: activeApplicationId,
          step_index: stepIndex,
          form_data: formData
        })
      });

      await response.json();

      // Calcul dynamique basé sur la configuration réelle du workflow d'instruction
      const nextStep = stepIndex + 1;
      const totalSteps = workflowSteps.length;
      const boundedNextStep = nextStep > totalSteps ? totalSteps : nextStep;
      const newPercentage = Math.round((boundedNextStep / totalSteps) * 100);

      const riskLevel = newPercentage < 40 ? 'low' :
                        newPercentage < 70 ? 'medium' :
                        newPercentage < 90 ? 'high' : 'critical';

      // Mettre à jour la candidature sur le serveur
      await fetch(`/api/applications/${activeApplicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_step: boundedNextStep,
          completion_percentage: newPercentage,
          risk_level: riskLevel
        })
      });

      // Émettre un message système personnalisé selon la prochaine étape réelle
      const nextWorkflowStep = workflowSteps[boundedNextStep];
      let guideText = "";
      if (boundedNextStep >= totalSteps) {
        guideText = `Félicitations ! Votre dossier d'instruction est maintenant complété à 100% (${boundedNextStep}/${totalSteps} étapes passées). Il est en cours de révision de conformité finale par la commission solidaire.`;
      } else if (nextWorkflowStep) {
        guideText = `Étape ${stepIndex + 1} complétée avec succès ! Passage à l'Étape ${boundedNextStep + 1} : "${nextWorkflowStep.label}". Consignes de l'agent : ${nextWorkflowStep.description}`;
      }

      if (guideText) {
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application_id: activeApplicationId,
            sender_type: "system",
            content: guideText
          })
        });
      }

      // Recharger toutes les données pour rafraîchir le pourcentage d'avancement, l'étape active, etc.
      await fetchAllData();
      await fetchMessages(activeApplicationId);
    } catch (err) {
      console.error("Erreur de soumission d'étape :", err);
    }
  };

  // ACTION : Réinitialiser la DB démo locale
  const handleResetDb = async () => {
    setLoading(true);
    try {
      await fetch("/api/db-reset", { method: "POST" });
      setActiveApplicationId(null);
      await fetchAllData();
      setActiveTab("catalog");
    } catch (e) {
      console.error("Impossible de réinitialiser", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    try {
      const res = await fetch(`/api/submissions/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Document supprimé avec succès");
        await fetchAllData();
        return true;
      }
      return false;
    } catch (err) {
      toast.error("Erreur lors de la suppression du document");
      return false;
    }
  };

  // ACTION : Publier un nouveau don
  const handleCreateDonation = async (donationData: any) => {
    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donationData)
      });
      const newDon = await res.json();
      setDonations(prev => [newDon, ...prev]);
      return newDon;
    } catch (e) {
      console.error("Échec publication don", e);
      return null;
    }
  };

  // ACTION : Supprimer définitivement un don (Admin)
  const handleDeleteDonation = async (id: string) => {
    try {
      const res = await fetch(`/api/donations/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDonations(prev => prev.filter(d => d.id !== id));
        toast.success("Don supprimé avec succès !");
        return true;
      } else {
        const err = await res.json();
        toast.error(err.error || "Échec de la suppression");
        return false;
      }
    } catch (e) {
      console.error("Échec suppression don", e);
      toast.error("Erreur réseau lors de la suppression");
      return false;
    }
  };

  // ACTION : Mettre à jour une application (Admin)
  const handleUpdateApplication = async (id: string, updates: any) => {
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const updatedApp = await res.json();
      
      setApplications(prev => prev.map(a => a.id === id ? updatedApp : a));
      
      // Si c'est l'application active en cours d'examen, on rafraîchit l'affichage
      if (activeApplicationId === id) {
        fetchAllData();
      }
    } catch (e) {
      console.error("Échec mise à jour application", e);
    }
  };

  // ACTION : Supprimer définitivement une application (Admin)
  const handleDeleteApplication = async (id: string) => {
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "DELETE"
      });
      
      if (res.ok) {
        setApplications(prev => prev.filter(a => a.id !== id));
        if (activeApplicationId === id) {
          setActiveApplicationId(null);
        }
        toast.success("Dossier de candidature supprimé avec succès !");
      } else {
        const err = await res.json();
        toast.error(err.error || "Impossible de supprimer le dossier.");
      }
    } catch (e) {
      console.error("Échec de la suppression de la candidature", e);
      toast.error("Une erreur réseau est survenue.");
    }
  };

  // Simulation Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || isAuthLoading) return;
    
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setIsLoginOpen(false);
        setAuthEmail("");
        setAuthPassword("");
      } else {
        const err = await res.json();
        setAuthError(err.error || "Adresse e-mail ou mot de passe incorrect.");
      }
    } catch (e) {
      console.error("Erreur de connexion", e);
      setAuthError("Erreur réseau ou serveur. Veuillez réessayer.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Simulation Inscription
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authName || !authEmail || !authPassword) return;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword })
      });

      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setIsRegisterOpen(false);
        setAuthName("");
        setAuthEmail("");
        setAuthPassword("");
      } else {
        const err = await res.json();
        alert(err.error || "Échec de l'inscription");
      }
    } catch (e) {
      console.error("Erreur d'inscription", e);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab("catalog");
    setIsLogoutConfirmOpen(false);
  };

  const handleResetPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || isAuthLoading) return;
    
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail })
      });
      if (res.ok) {
        setResetEmailSent(true);
      } else {
        const err = await res.json();
        setAuthError(err.error || "Erreur lors de la demande");
      }
    } catch (e) {
      setAuthError("Erreur réseau");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || isAuthLoading) return;

    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword })
      });
      if (res.ok) {
        alert("Mot de passe mis à jour ! Veuillez vous connecter.");
        setIsUpdatePasswordMode(false);
        window.location.href = "/";
      } else {
        const err = await res.json();
        setAuthError(err.error || "Échec de la mise à jour");
      }
    } catch (e) {
      setAuthError("Erreur réseau");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRegisterUser = (name: string, email: string) => {
    setCurrentUser({
      name,
      email
    });
  };

  const userSpecificApplications = applications.filter((app: any) => {
    if (isAdmin || isResponsable) return true;
    if (currentUser) {
      return app.user_id === currentUser.id;
    }
    return false;
  });

  const activeApp = userSpecificApplications.find(a => a.id === activeApplicationId);
  const activeDonation = activeApp ? donations.find(d => d.id === activeApp.donation_id) : null;

  useEffect(() => {
    if (activeTab === "admin" && !hasManagementAccess) {
      setActiveTab("catalog");
    }
  }, [activeTab, currentUser, hasManagementAccess]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3" id="loading-spinner-root">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        <p className="text-slate-500 text-xs font-semibold tracking-wider uppercase">Chargement de la Plateforme d'Attribution...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col justify-between overflow-x-hidden w-full max-w-[100vw]" id="app-root">
      <Toaster />
      <CookieBanner onOpenPrivacy={() => setActiveTab("privacy")} />
      <div className="w-full overflow-x-hidden">
        {/* MAIN NAVBAR HAUTE DE GAMME */}
        <header className="sticky top-0 z-50 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.06)]" id="main-header">
          {/* Bandeau d'accréditation officiel supérieur */}
          <div className="bg-stone-900 text-stone-300 py-1.5 px-3 sm:px-6 lg:px-8 text-[10.5px] sm:text-[11px] font-medium border-b border-stone-800 flex items-center justify-between gap-2 overflow-hidden" id="header-top-bar">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-semibold text-stone-200 truncate">Dispositif National d'Attribution & Dotations</span>
              <span className="hidden md:inline text-stone-400 shrink-0">| Instruction ouverte et traçable</span>
            </div>
            <div className="flex items-center gap-3 text-stone-300 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-stone-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Commission Indépendante
              </span>
              <button 
                onClick={handleWhatsAppCall}
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-amber-400 border border-stone-700 hover:border-amber-400 transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-90"
                title="Lancer l'appel WhatsApp secrétariat"
                aria-label="Lancer l'appel WhatsApp secrétariat"
              >
                <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              </button>
            </div>
          </div>

          {/* Corps de navigation principal avec effet verre */}
          <div className="bg-white/95 backdrop-blur-md border-b border-stone-200/90 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
              
              {/* Logo & Identité Visuelle */}
              <div 
                className="flex items-center gap-2 sm:gap-3.5 cursor-pointer min-w-0 group" 
                id="brand-logo" 
                onClick={() => {
                  setActiveTab("catalog");
                  setIsMobileMenuOpen(false);
                }}
              >
                <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl flex items-center justify-center overflow-hidden shadow-sm sm:shadow-md shadow-amber-600/15 border border-amber-500/30 group-hover:scale-105 transition-transform duration-300 bg-white shrink-0">
                  <img 
                    src={platformLogo} 
                    alt="Logo Pôle de Dons" 
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=200";
                    }}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-black text-stone-900 text-sm sm:text-xl block leading-none tracking-tight truncate">
                      Pôle de Dons
                    </span>
                    <span className="hidden xl:inline-block px-2 py-0.5 bg-amber-500/10 text-amber-800 border border-amber-500/25 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0">
                      Certifié
                    </span>
                  </div>
                  <span className="text-[7.5px] sm:text-[10px] text-amber-700 font-extrabold uppercase tracking-wider block mt-0.5 truncate">
                    Allocation & Entraide
                  </span>
                </div>
              </div>

              {/* Dock Central de Navigation (Desktop uniquement) */}
              <nav className="hidden lg:flex items-center bg-stone-100/90 border border-stone-200/80 p-1.5 rounded-full shadow-inner gap-1" id="nav-tabs">
                <button
                  id="tab-catalog-btn"
                  onClick={() => setActiveTab("catalog")}
                  className={`px-4 py-2 rounded-full text-xs font-black transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                    activeTab === "catalog"
                      ? "bg-white text-stone-900 shadow-sm border border-stone-200/80 scale-[1.02]"
                      : "text-stone-600 hover:text-stone-950 hover:bg-stone-200/50"
                  }`}
                >
                  <Gift className={`h-4 w-4 ${activeTab === "catalog" ? "text-amber-600" : "text-stone-400"}`} />
                  <span>Vitrine des Dons</span>
                </button>

                {currentUser && (
                  <button
                    id="tab-dashboard-btn"
                    onClick={() => setActiveTab(hasManagementAccess ? "admin" : "dashboard")}
                    className={`px-4 py-2 rounded-full text-xs font-black transition-all duration-200 relative cursor-pointer flex items-center gap-2 ${
                      activeTab === "dashboard" || activeTab === "admin"
                        ? "bg-white text-stone-900 shadow-sm border border-stone-200/80 scale-[1.02]"
                        : "text-stone-600 hover:text-stone-950 hover:bg-stone-200/50"
                    }`}
                  >
                    <LayoutDashboard className={`h-4 w-4 ${activeTab === "dashboard" || activeTab === "admin" ? "text-amber-600" : "text-stone-400"}`} />
                    <span>{isAdmin ? "Espace Admin" : isResponsable ? "Gestion Dossiers" : "Suivi des Demandes"}</span>
                    {activeApplicationId && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                      </span>
                    )}
                  </button>
                )}

                <button
                  id="tab-about-btn"
                  onClick={() => setActiveTab("about")}
                  className={`px-4 py-2 rounded-full text-xs font-black transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                    activeTab === "about"
                      ? "bg-white text-stone-900 shadow-sm border border-stone-200/80 scale-[1.02]"
                      : "text-stone-600 hover:text-stone-950 hover:bg-stone-200/50"
                  }`}
                >
                  <Compass className={`h-4 w-4 ${activeTab === "about" ? "text-amber-600" : "text-stone-400"}`} />
                  <span>Mission & Éthique</span>
                </button>

                <button
                  id="tab-contact-btn"
                  onClick={() => setActiveTab("contact")}
                  className={`px-4 py-2 rounded-full text-xs font-black transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                    activeTab === "contact"
                      ? "bg-white text-stone-900 shadow-sm border border-stone-200/80 scale-[1.02]"
                      : "text-stone-600 hover:text-stone-950 hover:bg-stone-200/50"
                  }`}
                >
                  <Mail className={`h-4 w-4 ${activeTab === "contact" ? "text-amber-600" : "text-stone-400"}`} />
                  <span>Secrétariat & Contact</span>
                </button>
              </nav>

              {/* Actions Desktop & Mobile */}
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0" id="header-actions">
                
                {/* Sélecteur de Langue Desktop (affiché sur md et +) */}
                <div className="hidden md:flex relative items-center" id="language-switcher-container">
                  <div className="flex items-center gap-1 bg-stone-100/90 hover:bg-stone-200/80 border border-stone-200/80 rounded-xl sm:rounded-2xl px-2.5 py-1.5 sm:px-3 sm:py-2 transition-all shadow-xs">
                    <Globe className="h-3.5 w-3.5 text-stone-600 shrink-0" />
                    <select
                      value={currentLang}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="bg-transparent text-[11px] sm:text-xs font-black text-stone-800 focus:outline-none cursor-pointer pr-0.5"
                      title="Choisir la langue / Choose language"
                    >
                      {LANGUAGES.map((lang, lIdx) => (
                        <option key={`desktop-lang-opt-${lang.code}-${lIdx}`} value={lang.code} className="text-stone-800 bg-white font-bold">
                          {lang.flag} {lang.code.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sélecteur de Langue Mobile Compact (Bouton FR / EN / ES / DE avec Popover) */}
                <div className="md:hidden relative" id="mobile-language-switcher">
                  <button
                    type="button"
                    onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                    className="h-9 px-2.5 bg-stone-100/95 hover:bg-stone-200/90 active:scale-95 border border-stone-200/90 rounded-xl flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                    title="Changer la langue"
                  >
                    <span className="text-[11px] font-black text-stone-900 tracking-wider">
                      {currentLang.toUpperCase()}
                    </span>
                    <span className="text-[8px] text-stone-500 font-bold">▾</span>
                  </button>

                  {/* Menu déroulant compact mobile */}
                  <AnimatePresence>
                    {isLangDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-2xl shadow-xl border border-stone-200/90 p-1.5 z-50 overflow-hidden"
                      >
                        <div className="text-[10px] font-black text-stone-400 uppercase tracking-wider px-2.5 py-1">
                          Langues
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {LANGUAGES.map((lang, lIdx) => (
                            <button
                              key={`mobile-lang-btn-${lang.code}-${lIdx}`}
                              onClick={() => {
                                handleLanguageChange(lang.code);
                                setIsLangDropdownOpen(false);
                              }}
                              className={`w-full px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors text-left ${
                                currentLang === lang.code
                                  ? "bg-amber-50 text-amber-900 font-black border border-amber-200/60"
                                  : "text-stone-700 hover:bg-stone-100"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span>{lang.flag}</span>
                                <span>{lang.label}</span>
                              </span>
                              <span className="text-[10px] font-black uppercase opacity-75">
                                {lang.code}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Espace Compte Desktop & Mobile Indicator */}
                {currentUser ? (
                  <>
                    {/* Desktop User Capsule */}
                    <div className="hidden sm:flex items-center gap-2 bg-stone-100/90 border border-stone-200/80 p-1 pr-3 rounded-2xl shadow-xs">
                      <button
                        onClick={() => setActiveTab(hasManagementAccess ? "admin" : "dashboard")}
                        className="flex items-center gap-2 text-left hover:opacity-90 transition-opacity cursor-pointer focus:outline-none"
                        title="Accéder au suivi de vos dossiers"
                      >
                        <div className="h-9 w-9 bg-amber-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-xs border border-amber-700 shrink-0">
                          {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-xs font-black text-stone-900 block leading-tight">
                            {currentUser.name}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Connecté
                          </span>
                        </div>
                      </button>
                      <button 
                        onClick={() => setIsLogoutConfirmOpen(true)}
                        title="Se déconnecter"
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-white rounded-xl transition-all cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Mobile Compact User Avatar (rapide raccourci) */}
                    <button
                      onClick={() => {
                        setActiveTab(hasManagementAccess ? "admin" : "dashboard");
                        setIsMobileMenuOpen(false);
                      }}
                      className="sm:hidden h-9 w-9 bg-amber-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-xs border border-amber-700 shrink-0 active:scale-95 transition-transform"
                      title="Mon Espace"
                    >
                      {currentUser.name.charAt(0).toUpperCase()}
                    </button>
                  </>
                ) : (
                  <div className="hidden sm:flex items-center gap-2">
                    <button
                      onClick={() => setIsLoginOpen(true)}
                      className="px-3.5 py-2 hover:bg-stone-100 text-stone-700 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap"
                    >
                      Connexion
                    </button>
                    <button
                      onClick={() => setIsRegisterOpen(true)}
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-2xl text-xs font-black shadow-md shadow-amber-600/20 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                    >
                      <span>Candidater</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Bouton Menu Burger Mobile Moderne */}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(!isMobileMenuOpen);
                    setIsLangDropdownOpen(false);
                  }}
                  className="lg:hidden h-9 w-9 sm:h-10 sm:w-10 bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 border border-amber-500/35 text-stone-900 rounded-xl sm:rounded-2xl transition-all cursor-pointer flex items-center justify-center shadow-xs shrink-0"
                  aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu principal"}
                >
                  {isMobileMenuOpen ? <X className="h-5 w-5 text-amber-900" /> : <Menu className="h-5 w-5 text-stone-900" />}
                </button>
              </div>

            </div>
          </div>

          {/* MENU TIROIR MOBILE & TABLETTE DÉDIÉ AVEC ANIMATION */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="lg:hidden bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-2xl overflow-hidden"
                id="mobile-drawer"
              >
                <div className="max-w-7xl mx-auto px-4 py-5 space-y-4">
                  {/* Statut Utilisateur / Actions Rapides Mobile */}
                  {currentUser ? (
                    <div className="bg-gradient-to-br from-stone-900 to-stone-850 text-white p-4 rounded-2xl border border-stone-800 shadow-md flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 font-black rounded-2xl flex items-center justify-center text-sm shadow-xs border border-amber-400/30 shrink-0">
                          {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white leading-tight truncate">{currentUser.name}</p>
                          <p className="text-[11px] text-stone-400 font-medium truncate">{currentUser.email}</p>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-wider mt-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {isAdmin ? "Super Administrateur" : isResponsable ? "Référent d'Attribution" : "Candidat Actif"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setIsLogoutConfirmOpen(true);
                        }}
                        className="px-3 py-2 text-xs font-black text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 rounded-xl transition-colors cursor-pointer shrink-0 ml-2"
                      >
                        Quitter
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setIsLoginOpen(true);
                        }}
                        className="w-full py-3 text-center bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-2xl font-black text-xs border border-stone-200/80 transition-all cursor-pointer"
                      >
                        Connexion
                      </button>
                      <button
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setIsRegisterOpen(true);
                        }}
                        className="w-full py-3 text-center bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-2xl font-black text-xs shadow-md shadow-amber-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Créer un compte</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Liens de Navigation Mobile Améliorés */}
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setActiveTab("catalog");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all text-left cursor-pointer ${
                        activeTab === "catalog"
                          ? "bg-amber-500/10 border border-amber-500/30 text-amber-900 shadow-xs"
                          : "bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-xs border ${
                          activeTab === "catalog" ? "bg-amber-600 text-white border-amber-700" : "bg-white text-amber-700 border-stone-200"
                        }`}>
                          <Gift className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black">Vitrine des Dotations</p>
                          <p className="text-xs text-stone-500">Biens matériels, véhicules, locaux & fonds</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-400" />
                    </button>

                    {currentUser && (
                      <button
                        onClick={() => {
                          setActiveTab(hasManagementAccess ? "admin" : "dashboard");
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all text-left cursor-pointer ${
                          activeTab === "dashboard" || activeTab === "admin"
                            ? "bg-amber-500/10 border border-amber-500/30 text-amber-900 shadow-xs"
                            : "bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-xs border ${
                            activeTab === "dashboard" || activeTab === "admin" ? "bg-amber-600 text-white border-amber-700" : "bg-white text-amber-700 border-stone-200"
                          }`}>
                            <LayoutDashboard className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black">
                              {isAdmin ? "Espace Administration" : isResponsable ? "Gestion des Attributions" : "Suivi de mes Candidatures"}
                            </p>
                            <p className="text-xs text-stone-500">Instruction, pièces & messagerie en direct</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-stone-400" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setActiveTab("about");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all text-left cursor-pointer ${
                        activeTab === "about"
                          ? "bg-amber-500/10 border border-amber-500/30 text-amber-900 shadow-xs"
                          : "bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-xs border ${
                          activeTab === "about" ? "bg-amber-600 text-white border-amber-700" : "bg-white text-amber-700 border-stone-200"
                        }`}>
                          <Compass className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black">Mission & Charte Éthique</p>
                          <p className="text-xs text-stone-500">Transparence, neutralité & règles d'attribution</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-400" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab("contact");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all text-left cursor-pointer ${
                        activeTab === "contact"
                          ? "bg-amber-500/10 border border-amber-500/30 text-amber-900 shadow-xs"
                          : "bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-xs border ${
                          activeTab === "contact" ? "bg-amber-600 text-white border-amber-700" : "bg-white text-amber-700 border-stone-200"
                        }`}>
                          <Mail className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black">Secrétariat & Contact Direct</p>
                          <p className="text-xs text-stone-500">Permanence téléphonique & chat instructeur</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-400" />
                    </button>
                  </div>

                  {/* Liens secondaires et mentions dans le tiroir */}
                  <div className="pt-3 border-t border-stone-200/80 grid grid-cols-2 gap-2 text-center text-xs font-bold text-stone-500">
                    <button
                      onClick={() => {
                        setActiveTab("terms");
                        setIsMobileMenuOpen(false);
                      }}
                      className="p-2 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors text-stone-700 cursor-pointer"
                    >
                      Règlement & Conditions
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("privacy");
                        setIsMobileMenuOpen(false);
                      }}
                      className="p-2 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors text-stone-700 cursor-pointer"
                    >
                      Protection Données
                    </button>
                  </div>

                  {/* Coordonnées Rapides en bas de tiroir */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-600">
                    <span className="font-semibold text-center sm:text-left">Ligne d'assistance : +49 15216945182</span>
                    <span className="text-emerald-700 font-extrabold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Guichet National Ouvert
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* MAIN CONTENTS CONTAINER */}
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" id="main-content-layout">
          
          {activeTab === "catalog" && (
            <DonationCatalog
              donations={donations}
              testimonials={testimonials}
              onApply={handleApply}
              activeApplicationId={activeApplicationId}
              currentUser={currentUser}
              onRegisterUser={handleRegisterUser}
              adminDefinedFields={adminDefinedFields}
              partners={partners}
              applications={applications}
              platformHeroImage={platformHeroImage}
              onViewDonation={handleViewDonation}
            />
          )}

          {activeTab === "dashboard" && (
            <CandidateDashboard
              application={activeApp || null}
              donationTitle={activeDonation?.title || (activeApp ? (donations.find(d => d.id === activeApp.donation_id)?.title) : "") || "Don en cours"}
              donationCategory={activeDonation?.category || (activeApp ? (donations.find(d => d.id === activeApp.donation_id)?.category) : "") || "Matériel"}
              messages={activeApplicationId ? (messages[activeApplicationId] || []) : []}
              onSendMessage={handleSendMessage}
              onSubmitStep={handleSubmitStep}
              workflowSteps={workflowSteps}
              submissions={submissions[activeApplicationId] || []}
              allApplications={applications}
              allDonations={donations}
              currentUser={currentUser}
              onSetActiveApplicationId={(id) => {
                setActiveApplicationId(id);
                fetchMessages(id);
              }}
              testimonials={testimonials}
              onRefreshData={fetchAllData}
            />
          )}

          {activeTab === "about" && <AboutUs />}

          {activeTab === "contact" && <ContactPage currentUser={currentUser} />}
          {activeTab === "privacy" && <PrivacyPolicy />}
          {activeTab === "terms" && <TermsOfUse />}

          {activeTab === "admin" && (
            <AdminDashboard
              donations={donations}
              applications={applications}
              messages={messages}
              dbStatus={dbStatus}
              currentUser={currentUser}
              onResetDb={handleResetDb}
              onCreateDonation={handleCreateDonation}
              onDeleteDonation={handleDeleteDonation}
              onUpdateApplication={handleUpdateApplication}
              onDeleteApplication={handleDeleteApplication}
              onSendAdminMessage={handleSendAdminMessage}
              adminDefinedFields={adminDefinedFields}
              onChangeFields={saveAdminFields}
              workflowSteps={workflowSteps}
              onChangeWorkflowSteps={saveWorkflowSteps}
              testimonials={testimonials}
              onRefreshData={fetchAllData}
              submissions={submissions}
              onDeleteSubmission={handleDeleteSubmission}
              platformLogo={platformLogo}
              onChangeLogo={savePlatformLogo}
              platformHeroImage={platformHeroImage}
              onChangeHeroImage={savePlatformHeroImage}
            />
          )}

        </main>
      </div>

      {/* FOOTER PUBLIC HAUTE DE GAMME */}
      <footer className="bg-stone-900 text-stone-300 border-t border-stone-800 py-10 sm:py-12 mt-16 w-full" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7">
          <div className="flex flex-col items-center text-center md:flex-row md:justify-between md:items-center md:text-left gap-6 pb-7 border-b border-stone-800/80">
            {/* Identité de la plateforme */}
            <div className="flex items-center justify-center md:justify-start gap-3 cursor-pointer group" onClick={() => setActiveTab("catalog")}>
              <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center overflow-hidden shadow-xs flex-shrink-0">
                <img 
                  src={platformLogo} 
                  alt="Logo Pôle de Dons" 
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="text-left">
                <span className="font-black text-white text-lg block leading-none">Pôle de Dons</span>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block mt-1">Allocation & Entraide</span>
              </div>
            </div>

            {/* Liens du Footer Centrés & Compacts */}
            <nav className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-xs font-bold text-stone-400 leading-normal max-w-2xl text-center" aria-label="Navigation secondaire de pied de page">
              <button 
                type="button"
                className="hover:text-amber-400 transition-colors cursor-pointer py-1 px-1" 
                onClick={() => {
                  setActiveTab("catalog");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Vitrine des Dons
              </button>
              <span className="hidden sm:inline text-stone-700 select-none">•</span>
              <button 
                type="button"
                className="hover:text-amber-400 transition-colors cursor-pointer py-1 px-1" 
                onClick={() => {
                  setActiveTab("about");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Mission & Éthique
              </button>
              <span className="hidden sm:inline text-stone-700 select-none">•</span>
              <button 
                type="button"
                className="hover:text-amber-400 transition-colors cursor-pointer py-1 px-1" 
                onClick={() => {
                  setActiveTab("contact");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Contact & Assistance
              </button>
              <span className="hidden sm:inline text-stone-700 select-none">•</span>
              <button 
                type="button"
                className="hover:text-amber-400 transition-colors cursor-pointer py-1 px-1" 
                onClick={() => {
                  setActiveTab("terms");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Règlement & Conditions
              </button>
              <span className="hidden sm:inline text-stone-700 select-none">•</span>
              <button 
                type="button"
                className="hover:text-amber-400 transition-colors cursor-pointer py-1 px-1" 
                onClick={() => {
                  setActiveTab("privacy");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Protection des Données
              </button>
            </nav>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-3 text-xs text-stone-400">
            <p>© 2026 Pôle de Dons. Tous droits réservés. Attribution supervisée et traçable.</p>
            <p className="flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block flex-shrink-0"></span>
              <span>Plateforme certifiée conforme aux protocoles de solidarité active.</span>
            </p>
          </div>
        </div>
      </footer>

      {/* --- MODAL DE CONNEXION --- */}
      <AnimatePresence>
        {isLoginOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginOpen(false)}
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl z-10 border border-stone-200/90 max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              {/* Header du modal fixe */}
              <div className="flex justify-between items-start p-6 sm:p-7 pb-4 border-b border-stone-100 flex-shrink-0">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-900 border border-amber-500/25 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                    <span>Espace Bénéficiaire & Porteur</span>
                  </div>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Accéder à votre compte</h3>
                  <p className="text-xs text-stone-500 font-medium">Consultez l'instruction de vos dossiers et échangez avec les référents.</p>
                </div>
                <button 
                  onClick={() => setIsLoginOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-2 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Formulaire défilant */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-4 scrollbar-thin">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-stone-700 block">Adresse E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
                      <input
                        type="email"
                        required
                        placeholder="nom.prenom@exemple.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-stone-700 block">Mot de passe</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsLoginOpen(false);
                          setIsResetPasswordOpen(true);
                        }}
                        className="text-[11px] font-black text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-11 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 focus:outline-none p-1 rounded cursor-pointer"
                        title={showLoginPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-bold">
                      <span className="h-2 w-2 bg-rose-500 rounded-full animate-pulse flex-shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className={`w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black py-3 rounded-xl text-xs sm:text-sm shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2 ${isAuthLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {isAuthLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Authentification en cours...
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        Se connecter de manière sécurisée
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-3 border-t border-stone-100 text-center space-y-1.5">
                  <p className="text-xs text-stone-500 font-medium">Vous n'avez pas encore de compte sur la plateforme ?</p>
                  <button 
                    onClick={() => {
                      setIsLoginOpen(false);
                      setIsRegisterOpen(true);
                    }}
                    className="text-xs text-amber-700 hover:text-amber-800 hover:underline font-black cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Créer un compte demandeur (100% gratuit)</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL D'INSCRIPTION SÉCURISÉE (NON COUPÉ, AVEC SCROLL INTERNE) --- */}
      <AnimatePresence>
        {isRegisterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRegisterOpen(false)}
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl z-10 border border-stone-200/90 max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              {/* En-tête fixe */}
              <div className="flex justify-between items-start p-6 sm:p-7 pb-4 border-b border-stone-100 flex-shrink-0">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-900 border border-amber-500/25 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <Gift className="h-3.5 w-3.5 text-amber-600" />
                    <span>Ouverture de Droits & Candidature</span>
                  </div>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Créer un compte demandeur</h3>
                  <p className="text-xs text-stone-500 font-medium">Rejoignez le réseau pour postuler aux dotations et suivre vos attributions.</p>
                </div>
                <button 
                  onClick={() => setIsRegisterOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-2 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Corps défilant du formulaire pour éviter toute coupure sur petit écran */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-4 scrollbar-thin">
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-stone-700 block">Nom complet ou Raison sociale</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Samuel Martin ou Association Espoir"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-stone-700 block">Adresse E-mail officielle</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
                      <input
                        type="email"
                        required
                        placeholder="contact@domaine.org ou nom@exemple.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-stone-700 block">Définir un mot de passe</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
                      <input
                        type={showRegisterPassword ? "text" : "password"}
                        required
                        placeholder="6 caractères minimum"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-11 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 focus:outline-none p-1 rounded cursor-pointer"
                        title={showRegisterPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      >
                        {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-bold">
                      <span className="h-2 w-2 bg-rose-500 rounded-full animate-pulse flex-shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-stone-600 leading-relaxed space-y-1">
                    <p className="font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                      Engagement de neutralité et gratuité
                    </p>
                    <p>Aucun frais d'inscription ou d'instruction n'est exigé. Vos données restent strictement confidentielles.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black py-3 rounded-xl text-xs sm:text-sm shadow-md shadow-amber-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isAuthLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Création du compte...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Créer mon compte et candidater
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-3 border-t border-stone-100 text-center space-y-1.5">
                  <p className="text-xs text-stone-500 font-medium">Vous possédez déjà un compte ?</p>
                  <button 
                    onClick={() => {
                      setIsRegisterOpen(false);
                      setIsLoginOpen(true);
                    }}
                    className="text-xs text-amber-700 hover:text-amber-800 hover:underline font-black cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Se connecter directement</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL MOT DE PASSE OUBLIÉ --- */}
      <AnimatePresence>
        {isResetPasswordOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsResetPasswordOpen(false)}
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl z-10 border border-stone-200/90 max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              <div className="flex justify-between items-start p-6 sm:p-7 pb-4 border-b border-stone-100 flex-shrink-0">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-900 border border-amber-500/25 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                    <span>Récupération d'Accès</span>
                  </div>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Mot de passe oublié</h3>
                  <p className="text-xs text-stone-500 font-medium">Recevez des instructions de réinitialisation sécurisées par courrier électronique.</p>
                </div>
                <button 
                  onClick={() => setIsResetPasswordOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-2 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-4 scrollbar-thin">
                {!resetEmailSent ? (
                  <form onSubmit={handleResetPasswordRequest} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-stone-700 block">Votre adresse E-mail</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
                        <input
                          type="email"
                          required
                          placeholder="votre.adresse@domaine.com"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                        />
                      </div>
                    </div>

                    {authError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-bold">
                        <span className="h-2 w-2 bg-rose-500 rounded-full animate-pulse flex-shrink-0" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black py-3 rounded-xl text-xs sm:text-sm shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isAuthLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Transmettre le lien de réinitialisation
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="py-4 text-center space-y-4">
                    <div className="h-14 w-14 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Mail className="h-7 w-7" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-base font-black text-stone-900">Lien de réinitialisation envoyé !</h4>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Un courrier contenant les instructions a été envoyé à <strong className="text-stone-900">{authEmail}</strong>. Veuillez vérifier votre boîte de réception ainsi que vos courriers indésirables.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsResetPasswordOpen(false)}
                      className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Fermer la fenêtre
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-stone-100 text-center">
                  <button 
                    onClick={() => {
                      setIsResetPasswordOpen(false);
                      setIsLoginOpen(true);
                    }}
                    className="text-xs text-stone-600 hover:text-amber-700 font-black cursor-pointer"
                  >
                    ← Retour à la connexion
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL MISE À JOUR MOT DE PASSE (POST-RECOVERY) --- */}
      <AnimatePresence>
        {isUpdatePasswordMode && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
            <div className="absolute inset-0 bg-stone-950/70 backdrop-blur-md" />

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl z-10 border border-stone-200/90 max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              <div className="flex justify-between items-start p-6 sm:p-7 pb-4 border-b border-stone-100 flex-shrink-0">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-800 border border-emerald-500/25 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Sécurité du Compte</span>
                  </div>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Définir un nouveau mot de passe</h3>
                  <p className="text-xs text-stone-500 font-medium">Votre accès a été validé. Veuillez configurer votre nouveau mot de passe.</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-4 scrollbar-thin">
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-stone-700 block">Nouveau Mot de passe</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-11 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 p-1 rounded cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-bold">
                      <span className="h-2 w-2 bg-rose-500 rounded-full animate-pulse flex-shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black py-3 rounded-xl text-xs sm:text-sm shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isAuthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Mettre à jour et accéder à mon espace
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
  
      {/* --- MODAL CONFIRMATION DÉCONNEXION --- */}
      <AnimatePresence>
        {isLogoutConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutConfirmOpen(false)}
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
            />
  
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden z-10 p-6 sm:p-7 space-y-5 border border-stone-200/90 text-center"
            >
              <div className="h-14 w-14 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <LogOut className="h-6 w-6" />
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-stone-900">Mettre fin à votre session ?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  Vous pourrez vous reconnecter à tout moment pour reprendre le suivi de vos candidatures et de vos échanges.
                </p>
              </div>
  
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Rester connecté
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/15 transition-all cursor-pointer"
                >
                  Se déconnecter
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CHATBOT DE SUPPORT POST-APPEL WHATSAPP --- */}
      <AnimatePresence>
        {isSupportChatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 50 }}
            className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-[80] mx-auto sm:mx-0 w-auto max-w-[340px] xs:max-w-[360px] sm:max-w-none sm:w-[380px] md:w-[410px] h-[450px] max-h-[78vh] sm:h-[510px] sm:max-h-[85vh] bg-white/95 backdrop-blur-md border border-stone-200/90 shadow-[0_16px_50px_rgba(0,0,0,0.25)] rounded-3xl flex flex-col overflow-hidden"
            id="whatsapp-support-chat-widget"
          >
            {/* Header du Chatbot avec fond sombre uni et sous-titre ambre à fort contraste */}
            <div className="p-3.5 sm:p-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8.5 w-8.5 sm:h-9 sm:w-9 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-xs shrink-0">
                  <Headphones className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-white tracking-tight truncate">Support d'Accompagnement</h4>
                  <p className="text-[10px] sm:text-[11px] text-amber-300 font-semibold tracking-tight truncate">Secrétariat et suivi d'attribution</p>
                </div>
              </div>
              <button
                onClick={() => setIsSupportChatOpen(false)}
                className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-2"
                title="Fermer le support"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Contenu principal du Chatbot */}
            <div className="flex-1 flex flex-col overflow-hidden bg-stone-50/50">
              {supportChatStage === "ask_satisfaction" ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
                  <div className="h-16 w-16 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl flex items-center justify-center shadow-sm">
                    <MessageSquare className="h-8 w-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-stone-900">Suivi d'appel WhatsApp</h3>
                    <p className="text-xs text-stone-600 leading-relaxed font-semibold max-w-xs">
                      Bonjour ! Avez-vous été pleinement satisfait de votre appel avec le secrétariat ou souhaitez-vous plus d'informations en direct ?
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full max-w-sm pt-2">
                    <button
                      onClick={() => setIsSupportChatOpen(false)}
                      className="px-4 py-3 bg-stone-100 hover:bg-stone-250 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ThumbsDown className="h-3.5 w-3.5 text-stone-500" />
                      Non, fermer
                    </button>
                    <button
                      onClick={() => setSupportChatStage("chatting")}
                      className="px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:from-amber-600 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/15 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Oui, continuer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Zone d'affichage des messages */}
                  <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 scrollbar-thin" id="support-chat-panel">
                    {supportChatMessages.map((msg: any, index: number) => {
                      const isUser = msg.sender === "user";
                      return (
                        <div
                          key={`supp-msg-${msg.id || 'gen'}-${index}`}
                          className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-2 max-w-[88%] ${
                            isUser ? "ml-auto" : "mr-auto"
                          }`}
                        >
                          {!isUser && (
                            <div className="h-7 w-7 bg-amber-500/15 text-amber-600 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 border border-amber-500/25 shadow-xs mt-0.5">
                              <Headphones className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed ${
                              isUser
                                ? "bg-amber-600 text-white font-semibold rounded-tr-xs shadow-sm"
                                : "bg-white border border-stone-200 text-stone-800 rounded-tl-xs shadow-xs"
                            }`}
                          >
                            {msg.content && <p className="whitespace-pre-line">{msg.content}</p>}
                            
                            {/* Affichage de la pièce jointe */}
                            {msg.attachment && (
                              msg.attachment.type?.startsWith("audio/") ? (
                                <div className={`mt-2 p-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold ${
                                  isUser 
                                    ? "bg-amber-700/50 border-amber-500/50 text-white" 
                                    : "bg-stone-50 border-stone-200 text-stone-900"
                                }`}>
                                  <audio 
                                    controls 
                                    src={typeof msg.attachment === 'string' ? msg.attachment : (msg.attachment.url || msg.attachment.data)} 
                                    className="h-8 w-48 rounded-lg outline-none"
                                  />
                                </div>
                              ) : (
                                <div className={`mt-2 p-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold ${
                                  isUser 
                                    ? "bg-amber-700/50 border-amber-500/50 text-white" 
                                    : "bg-stone-50 border-stone-200 text-stone-900"
                                }`}>
                                  <div className="flex items-center gap-1.5 truncate min-w-0">
                                    <Paperclip className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                    <span className="truncate text-[11px]">{typeof msg.attachment === 'string' ? 'Pièce jointe' : (msg.attachment.name || 'Document')}</span>
                                    {typeof msg.attachment === 'object' && msg.attachment.size_kb && (
                                      <span className="text-[9px] opacity-75 shrink-0">({msg.attachment.size_kb.toFixed(1)} Ko)</span>
                                    )}
                                  </div>
                                  <a 
                                    href={typeof msg.attachment === 'string' ? msg.attachment : (msg.attachment.url || msg.attachment.data)}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={typeof msg.attachment === 'object' ? (msg.attachment.name || "piece_jointe") : "piece_jointe"}
                                    className={`p-1 rounded-lg hover:bg-black/10 transition-colors shrink-0 ${isUser ? "text-amber-100 hover:text-white" : "text-amber-600 hover:text-amber-700"}`}
                                    title="Consulter ou télécharger la pièce jointe"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </a>
                                </div>
                              )
                            )}

                            <span
                              className={`block text-[9px] mt-1.5 text-right font-medium ${
                                isUser ? "text-amber-100/80" : "text-stone-400"
                              }`}
                            >
                              {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {isSendingSupportChat && (
                      <div className="flex justify-start items-center gap-2">
                        <div className="h-7 w-7 bg-amber-500/15 text-amber-600 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 border border-amber-500/25 shadow-xs">
                          <Headphones className="h-3.5 w-3.5" />
                        </div>
                        <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-2xl rounded-tl-xs text-xs text-stone-500 font-bold flex items-center gap-1.5 shadow-xs">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                          Le support prépare sa réponse...
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Suggestions rapides cliquables */}
                  <div className="px-3 pt-2 pb-1 bg-stone-50 border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    <button
                      type="button"
                      onClick={() => handleSendSupportChat(undefined, "Où en est mon dossier et quel est mon rang d'attribution ?")}
                      className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-300 text-[10px] font-bold text-stone-700 hover:text-amber-800 rounded-full transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      📂 Suivi dossier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendSupportChat(undefined, "Quels sont les dons et matériels disponibles actuellement ?")}
                      className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-300 text-[10px] font-bold text-stone-700 hover:text-amber-800 rounded-full transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      🎁 Dons disponibles
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendSupportChat(undefined, "Mes pièces justificatives sont-elles sécurisées et conformes ?")}
                      className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-300 text-[10px] font-bold text-stone-700 hover:text-amber-800 rounded-full transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      🛡️ Sécurité pièces
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendSupportChat(undefined, "Quels sont vos partenaires logistiques officiels ?")}
                      className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-300 text-[10px] font-bold text-stone-700 hover:text-amber-800 rounded-full transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      🤝 Partenaires
                    </button>
                  </div>

                  {/* Aperçu et messages d'erreur de la pièce jointe */}
                  <div className="px-3 space-y-1 bg-white">
                    {supportAttachmentError && (
                      <div className="py-1 px-2.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-[10px] font-bold">
                        {supportAttachmentError}
                      </div>
                    )}
                    
                    {isUploadingSupportAttachment && (
                      <div className="py-1 px-2.5 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg text-[10px] flex items-center gap-1.5 font-semibold">
                        <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                        Traitement de la pièce jointe...
                      </div>
                    )}

                    {supportChatAttachment && supportChatAttachment.type !== "audio/webm" && (
                      <div className="py-1.5 px-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-[10px] font-semibold flex items-center justify-between gap-2 text-stone-800 shadow-2xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <Paperclip className="h-3 w-3 text-amber-600 shrink-0" />
                          <span className="truncate">{supportChatAttachment.name} ({supportChatAttachment.size_kb.toFixed(1)} Ko)</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setSupportChatAttachment(null)}
                          className="text-red-500 hover:text-red-700 font-bold px-1 text-[10px] cursor-pointer"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}

                    {supportChatAttachment && supportChatAttachment.type === "audio/webm" && (
                      <div className="py-1.5 px-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-[10px] font-semibold flex items-center justify-between gap-2 text-stone-800 shadow-2xs">
                        <audio controls src={supportChatAttachment.url} className="h-8 w-48" />
                        <button 
                          type="button" 
                          onClick={() => {
                            setSupportChatAttachment(null);
                            audioRecorder.clearAudio();
                          }}
                          className="text-red-500 hover:text-red-700 font-bold px-1 text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Formulaire de saisie du message avec bouton trombone, micro et envoi */}
                  <form onSubmit={handleSendSupportChat} className="p-3 bg-white border-t border-stone-200/90 flex items-center gap-2">
                    {audioRecorder.isRecording ? (
                      <div className="flex-1 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-3.5 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-red-600 font-bold text-xs font-mono">
                            {Math.floor(audioRecorder.recordingTime / 60)}:{(audioRecorder.recordingTime % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={audioRecorder.cancelRecording}
                          className="p-1.5 text-stone-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Annuler"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={audioRecorder.stopRecording}
                          className="p-1.5 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                          title="Arrêter"
                        >
                          <Square className="h-4 w-4 fill-current" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          ref={supportFileInputRef}
                          onChange={handleSupportAttachmentChange}
                          accept="image/*,.pdf,.doc,.docx,.txt"
                          className="hidden"
                        />
                        
                        <button
                          type="button"
                          onClick={() => supportFileInputRef.current?.click()}
                          disabled={isUploadingSupportAttachment || isSendingSupportChat}
                          className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            supportChatAttachment && supportChatAttachment.type !== "audio/webm"
                              ? "bg-amber-100 border-amber-300 text-amber-800"
                              : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600 hover:text-stone-900"
                          }`}
                          title="Ajouter une pièce jointe"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onMouseDown={audioRecorder.startRecording}
                          onTouchStart={audioRecorder.startRecording}
                          disabled={isUploadingSupportAttachment || isSendingSupportChat || !!supportChatAttachment}
                          className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 bg-stone-50 hover:bg-red-50 border-stone-200 text-stone-600 hover:text-red-500 hover:border-red-200`}
                          title="Maintenir pour enregistrer (ou cliquer pour démarrer)"
                        >
                          <Mic className="h-4 w-4" />
                        </button>

                        <input
                          type="text"
                          placeholder="Saisissez votre question ou message..."
                          value={supportChatInput}
                          onChange={(e) => setSupportChatInput(e.target.value)}
                          disabled={isSendingSupportChat}
                          className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all shadow-inner min-w-0"
                        />
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={(!supportChatInput.trim() && !supportChatAttachment) || isSendingSupportChat || audioRecorder.isRecording}
                      className="h-9 w-9 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-100 text-white disabled:text-stone-400 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md shadow-amber-600/10 shrink-0"
                      title="Envoyer"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
  
    </div>
  );
}
