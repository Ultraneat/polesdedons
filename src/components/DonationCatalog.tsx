import React, { useState, useEffect, useRef } from "react";
import { Donation, Testimonial } from "../types";
import { 
  Gift, 
  Tag, 
  Users, 
  Play, 
  Pause, 
  Volume2, 
  Video, 
  Flame, 
  TrendingUp, 
  ChevronRight, 
  ChevronLeft, 
  Award,
  Sparkles,
  Search,
  MapPin,
  User,
  X,
  FileText,
  Check,
  Send,
  AlertCircle,
  MessageSquare,
  Lock,
  UserPlus,
  Eye,
  EyeOff,
  LogIn,
  Info,
  Layers,
  Home,
  Car,
  DollarSign,
  Package,
  SlidersHorizontal,
  ArrowUpDown,
  CheckCircle,
  RotateCcw,
  Paperclip,
  ShieldCheck,
  Mic,
  Square,
  Trash2,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSocket, sendMessage, joinConversation } from "../lib/socket";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { blobToBase64 } from "../lib/fileCompressor";

interface DonationCatalogProps {
  donations: Donation[];
  testimonials: Testimonial[];
  onApply: (donation: Donation, candidateName: string) => void;
  activeApplicationId: string | null;
  currentUser: any;
  onRegisterUser: (name: string, email: string) => void;
  adminDefinedFields: Array<{key: string, label: string, type: string, placeholder: string}>;
  partners?: any[];
  applications?: any[];
  platformHeroImage?: string;
  onViewDonation?: (id: string) => void;
}

export default function DonationCatalog({ 
  donations, 
  testimonials, 
  onApply, 
  activeApplicationId,
  currentUser,
  onRegisterUser,
  adminDefinedFields,
  partners = [],
  applications = [],
  platformHeroImage,
  onViewDonation
}: DonationCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("Toutes");
  const [selectedTension, setSelectedTension] = useState<string>("Tous");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [testimonialFilter, setTestimonialFilter] = useState<string>("all");
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [activeVideoTestimonial, setActiveVideoTestimonial] = useState<Testimonial | null>(null);
  
  // Mobile horizontal scroll tracking states & references
  const [activeDonationIndex, setActiveDonationIndex] = useState(0);
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);
  const donationsContainerRef = useRef<HTMLDivElement | null>(null);
  const testimonialsContainerRef = useRef<HTMLDivElement | null>(null);

  const handleDonationScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const firstChild = target.firstElementChild as HTMLElement | null;
    const itemWidth = firstChild ? firstChild.getBoundingClientRect().width : 340;
    const gap = 24;
    if (itemWidth > 0) {
      const newIndex = Math.round(scrollLeft / (itemWidth + gap));
      setActiveDonationIndex(Math.max(0, newIndex));
    }
  };

  const scrollDonationsBy = (direction: "left" | "right") => {
    if (donationsContainerRef.current) {
      const container = donationsContainerRef.current;
      const scrollAmount = container.clientWidth * 0.75;
      container.scrollBy({
        left: direction === "right" ? scrollAmount : -scrollAmount,
        behavior: "smooth"
      });
    }
  };

  const scrollToDonation = (index: number) => {
    if (donationsContainerRef.current) {
      const container = donationsContainerRef.current;
      const cards = container.children;
      if (cards[index]) {
        (cards[index] as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start"
        });
        setActiveDonationIndex(index);
      }
    }
  };

  const handleTestimonialScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const firstChild = target.firstElementChild as HTMLElement | null;
    const itemWidth = firstChild ? firstChild.getBoundingClientRect().width : 340;
    const gap = 24;
    if (itemWidth > 0) {
      const newIndex = Math.round(scrollLeft / (itemWidth + gap));
      setActiveTestimonialIndex(Math.max(0, newIndex));
    }
  };

  const scrollTestimonialsBy = (direction: "left" | "right") => {
    if (testimonialsContainerRef.current) {
      const container = testimonialsContainerRef.current;
      const scrollAmount = container.clientWidth * 0.85;
      container.scrollBy({
        left: direction === "right" ? scrollAmount : -scrollAmount,
        behavior: "smooth"
      });
    }
  };

  const scrollToTestimonial = (index: number) => {
    if (testimonialsContainerRef.current) {
      const container = testimonialsContainerRef.current;
      const cards = container.children;
      if (cards[index]) {
        (cards[index] as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start"
        });
        setActiveTestimonialIndex(index);
      }
    }
  };
  
  // Modals States
  const [selectedDonationForDetails, setSelectedDonationForDetails] = useState<Donation | null>(null);
  const [selectedDonationForAgent, setSelectedDonationForAgent] = useState<Donation | null>(null);
  const [selectedDonationForBids, setSelectedDonationForBids] = useState<Donation | null>(null);
  const [selectedDonationForApplyDirect, setSelectedDonationForApplyDirect] = useState<Donation | null>(null);

  // Sync selected donation with prop updates for real-time bid/participant changes
  useEffect(() => {
    if (selectedDonationForApplyDirect) {
      const updated = donations.find(d => d.id === selectedDonationForApplyDirect.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedDonationForApplyDirect)) {
        setSelectedDonationForApplyDirect(updated);
      }
    }
    if (selectedDonationForBids) {
      const updated = donations.find(d => d.id === selectedDonationForBids.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedDonationForBids)) {
        setSelectedDonationForBids(updated);
      }
    }
    if (selectedDonationForDetails) {
      const updated = donations.find(d => d.id === selectedDonationForDetails.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedDonationForDetails)) {
        setSelectedDonationForDetails(updated);
      }
    }
  }, [donations, selectedDonationForApplyDirect, selectedDonationForBids, selectedDonationForDetails]);

  // Agent interactive chat simulator (for anonymous visitors too)
  const [agentChats, setAgentChats] = useState<Record<string, Array<{sender: 'user' | 'agent', content: string, time: string}>>>({});
  const [chatInput, setChatInput] = useState<string>("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatFile, setChatFile] = useState<any>(null);
  const [chatAttachment, setChatAttachment] = useState<any>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [agentIsTyping, setAgentIsTyping] = useState<boolean>(false);
  
  const audioRecorder = useAudioRecorder();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-upload audio when recording stops
  useEffect(() => {
    if (audioRecorder.audioBlob) {
      const uploadAudio = async () => {
        setIsUploadingAttachment(true);
        setAttachmentError(null);
        try {
          const base64Audio = await blobToBase64(audioRecorder.audioBlob!);
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: base64Audio,
              fileName: `Note_vocale_${Date.now()}.webm`,
              fileType: "audio/webm"
            })
          });
          const data = await res.json();
          if (data.success) {
            setChatAttachment({
              name: "Note vocale",
              url: data.url,
              size_kb: data.originalSizeKb || Math.round((audioRecorder.audioBlob!.size / 1024) * 10) / 10,
              type: "audio/webm"
            });
            audioRecorder.clearAudio();
          } else {
            setAttachmentError("Échec de l'envoi de l'audio.");
          }
        } catch (err) {
          console.error(err);
          setAttachmentError("Erreur lors de l'envoi de la note vocale.");
        } finally {
          setIsUploadingAttachment(false);
        }
      };
      uploadAudio();
    }
  }, [audioRecorder.audioBlob]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Registration step inside postulation flow
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [isModalLogin, setIsModalLogin] = useState(false);

  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  
  // Persistance d'un ID unique pour les visiteurs non connectés
  const [guestId] = useState(() => {
    const saved = localStorage.getItem("chat_guest_id");
    if (saved) return saved;
    const newId = "guest_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("chat_guest_id", newId);
    return newId;
  });

  const effectiveUserId = currentUser?.id || guestId;

  const [unifiedMessages, setUnifiedMessages] = useState<any[]>([]);

  // Real-time chat sync
  useEffect(() => {
    const socket = getSocket();
    const abortController = new AbortController();
    const signal = abortController.signal;
    
    // Rejoindre la room spécifique à l'utilisateur pour la confidentialité
    joinConversation(effectiveUserId);
    
    const encodedName = encodeURIComponent(currentUser?.name || currentUser?.email || "");

    const fetchUnifiedMessages = async () => {
      try {
        const res = await fetch(`/api/all-user-messages?user_id=${effectiveUserId}&user_name=${encodedName}`, { signal });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setUnifiedMessages(data);
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.warn("Synchronisation messages unifiés en cours de reconnexion...");
        }
      }
    };

    // Charger l'historique filtré par user_id et user_name (pour support hérité)
    const fetchLegacyChats = async () => {
      try {
        const res = await fetch(`/api/agent-conversations?user_id=${effectiveUserId}&user_name=${encodedName}`, { signal });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === "object") {
            setAgentChats(data);
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.warn("Synchronisation chats en direct en cours de reconnexion...");
        }
      }
    };

    fetchUnifiedMessages();
    fetchLegacyChats();

    // Polling de synchronisation (toutes les 4 secondes)
    const interval = setInterval(() => {
      fetchUnifiedMessages();
      fetchLegacyChats();
    }, 4000);

    const handleMessageReceived = (payload: any) => {
      // Sécurité supplémentaire côté client : ignorer les messages qui ne nous sont pas destinés
      if (payload.user_id && payload.user_id !== effectiveUserId && !currentUser?.role?.includes('admin')) {
        return;
      }

      // 1. Mettre à jour les messages unifiés
      setUnifiedMessages(prev => {
        if (prev.some((m: any) => m.id === payload.id || (m.content === payload.content && m.created_at === payload.created_at))) {
          return prev;
        }
        return [...prev, payload].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      });

      // 2. Mettre à jour les chats hérités (par donation_id)
      setAgentChats(prev => {
        const list = prev[payload.donation_id] || [];
        if (list.some((m: any) => m.id === payload.id || (m.content === payload.content && m.created_at === payload.created_at && m.sender === payload.sender))) {
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
    };

    socket.on("message:received", handleMessageReceived);
    socket.on("application_message:received", handleMessageReceived);

    return () => {
      clearInterval(interval);
      abortController.abort();
      socket.off("message:received", handleMessageReceived);
      socket.off("application_message:received", handleMessageReceived);
    };
  }, [effectiveUserId, currentUser?.role, currentUser?.name, currentUser?.email]);

  // Bid simulation
  const [priorityScore, setPriorityScore] = useState<number>(65);
  const [urgencyReason, setUrgencyReason] = useState<string>("");
  const [bidSubmitted, setBidSubmitted] = useState<boolean>(false);

  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setShouldAutoScroll(isAtBottom);
  };

  // Auto-scroll chat modal
  useEffect(() => {
    if (shouldAutoScroll) {
      const container = document.getElementById("live-chat-panel");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [agentChats, unifiedMessages, agentIsTyping, shouldAutoScroll]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Immobilier": return Home;
      case "Véhicules": return Car;
      case "Financier": return DollarSign;
      case "Matériel": return Package;
      default: return Layers;
    }
  };

  const getCategoryCount = (category: string) => {
    if (category === "Tous") return donations.length;
    return donations.filter(d => d.category === category).length;
  };

  // Filter and sort donations dynamically
  const uniqueLocations = [
    "Toutes",
    ...Array.from(
      new Set(
        donations
          .map(d => d.location)
          .filter(Boolean)
          .map(l => l!.trim())
          .filter(l => l.toLowerCase() !== "toutes")
      )
    ).sort()
  ];

  const filteredDonations = donations.filter(don => {
    const matchesCategory = selectedCategory === "Tous" || don.category === selectedCategory;
    const matchesLocation = selectedLocation === "Toutes" || (don.location && don.location.trim() === selectedLocation);
    
    let matchesTension = true;
    if (selectedTension !== "Tous") {
      if (selectedTension === "Critique") {
        matchesTension = don.current_bids_count >= 5;
      } else if (selectedTension === "Soutenue") {
        matchesTension = don.current_bids_count >= 3 && don.current_bids_count < 5;
      } else if (selectedTension === "Disponible") {
        matchesTension = don.current_bids_count < 3;
      }
    }

    const term = (searchTerm || "").toLowerCase().trim();
    const titleStr = (don.title || "").toLowerCase();
    const descStr = (don.description || "").toLowerCase();
    const locStr = (don.location || "").toLowerCase();

    const matchesSearch = !term || 
                          titleStr.includes(term) || 
                          descStr.includes(term) ||
                          locStr.includes(term);
    return matchesCategory && matchesLocation && matchesTension && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === "bids_high") return b.current_bids_count - a.current_bids_count;
    if (sortBy === "bids_low") return a.current_bids_count - b.current_bids_count;
    if (sortBy === "value_high") return (b.target_amount || 0) - (a.target_amount || 0);
    if (sortBy === "value_low") return (a.target_amount || 0) - (b.target_amount || 0);
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });

  const getTensionIndex = (bidsCount: number) => {
    if (bidsCount >= 5) return { label: "Demande Critique", color: "text-red-700 bg-red-50 border-red-100", icon: Flame };
    if (bidsCount >= 3) return { label: "Demande Soutenue", color: "text-amber-700 bg-amber-50 border-amber-100", icon: TrendingUp };
    return { label: "Opportunité Disponible", color: "text-emerald-700 bg-emerald-50 border-emerald-100", icon: Sparkles };
  };

  const handleApplyClick = (donation: Donation) => {
    const candidateName = currentUser ? currentUser.name : (regName || "Visiteur");
    onApply(donation, candidateName);
    setSelectedDonationForApplyDirect(null);
    setFormResponses({});
  };

  // Registration / Login handler inside modal
  const handleModalRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (isModalLogin) {
      if (!regEmail) return;
      // Login simulation: derive a name from email
      const nameFromEmail = regEmail.split("@")[0];
      const capitalizedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
      onRegisterUser(capitalizedName, regEmail);
    } else {
      if (!regName || !regEmail) return;
      onRegisterUser(regName, regEmail);
    }
    // Reset states
    setRegName("");
    setRegEmail("");
    setRegPassword("");
    setShowModalPassword(false);
  };

  // Submit agent chat message (Real-time with Socket.io)
  const handleAgentChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!chatInput.trim() && !chatAttachment) || !selectedDonationForAgent || isSendingChat) return;

    setIsSendingChat(true);
    const donationId = selectedDonationForAgent.id;
    const payload = {
      donation_id: donationId,
      sender: 'user' as const,
      content: chatInput.trim(),
      attachment: chatAttachment,
      user_name: currentUser?.name || "Visiteur",
      user_id: effectiveUserId,
      is_auth: !!currentUser,
      created_at: new Date().toISOString()
    };

    try {
      const res = await fetch(`/api/agent-conversations/${donationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const savedMsg = await res.json();
        // Mettre à jour immédiatement localement pour une réactivité instantanée de l'IHM
        setUnifiedMessages(prev => {
          if (prev.some((m: any) => m.id === savedMsg.id || (m.content === savedMsg.content && m.created_at === savedMsg.created_at))) {
            return prev;
          }
          return [...prev, savedMsg].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        });
        setAgentChats(prev => {
          const list = prev[donationId] || [];
          if (list.some((m: any) => m.id === savedMsg.id || (m.content === savedMsg.content && m.created_at === savedMsg.created_at))) {
            return prev;
          }
          return {
            ...prev,
            [donationId]: [...list, savedMsg]
          };
        });
      }
      setChatAttachment(null);
    } catch (err) {
      console.error("Erreur persistance message:", err);
    } finally {
      setIsSendingChat(false);
      setChatInput("");
    }
  };

  const handleChatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setAttachmentError("Fichier trop volumineux. La taille maximale autorisée est de 5 Mo.");
        e.target.value = "";
        return;
      }
      
      setIsUploadingAttachment(true);
      setAttachmentError(null);
      
      try {
        const base64 = await blobToBase64(file);
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
          setChatAttachment({
            name: file.name,
            url: data.url,
            size_kb: data.originalSizeKb || Math.round((file.size / 1024) * 10) / 10,
            type: file.type
          });
        } else {
          setAttachmentError("Échec de l'envoi du fichier.");
        }
      } catch (err) {
        console.error(err);
        setAttachmentError("Erreur lors de l'envoi du fichier.");
      } finally {
        setIsUploadingAttachment(false);
        e.target.value = "";
      }
    }
  };

  const handlePriorityBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBidSubmitted(true);
    setTimeout(() => {
      setBidSubmitted(false);
      setUrgencyReason("");
      setSelectedDonationForBids(null);
    }, 2500);
  };

  const handleResetFilters = () => {
    setSelectedCategory("Tous");
    setSelectedLocation("Toutes");
    setSelectedTension("Tous");
    setSearchTerm("");
    setSortBy("recent");
  };

  return (
    <div className="space-y-12" id="donation-catalog-root">
      {/* Hero Section Haute de Gamme - Pôle de Dons */}
      <div className="bg-stone-950 text-white rounded-[32px] p-8 sm:p-14 shadow-2xl relative overflow-hidden group/hero border border-stone-800" id="catalog-hero">
        {/* Image de fond avec opacité et filtre moderne */}
        <div className="absolute inset-0 z-0">
          <img 
            src={platformHeroImage || "/assets/images/fedex_delivery_car_keys.jpg"} 
            alt="Pôle de Dons - Attribution Solidaire" 
            className="w-full h-full object-cover opacity-25 group-hover/hero:scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/90 to-stone-950/50" />
        </div>

        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-6 animate-fadeIn">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full text-xs font-bold tracking-wide">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Pôle de Dons — Réseau National d'Attribution
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12]">
            Accédez à des dotations majeures, <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-200 to-amber-400">
              propulsez vos projets.
            </span>
          </h1>
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
            Le Pôle de Dons orchestre l'affectation équitable et transparente de biens essentiels (véhicules utilitaires, espaces immobiliers, équipements d'activités et dotations financières) au service de porteurs de projets vérifiés.
          </p>

          <div className="pt-2 flex flex-wrap gap-4 items-center text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Instruction certifiée</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Attribution équitable</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-300" />
              <span>Conseillers référents</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de Filtres & Recherche Améliorée et Ultra-Harmonieuse */}
      <div className="space-y-4" id="catalog-filters-container">
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center bg-white p-4 sm:p-5 rounded-3xl border border-stone-200/80 shadow-sm animate-fadeIn" id="catalog-filters">
          
          {/* Catégories Dynamiques */}
          <div className="flex flex-nowrap md:flex-wrap gap-2 items-center overflow-x-auto pb-2 xl:pb-0 scrollbar-hide snap-x w-full">
            {["Tous", "Immobilier", "Véhicules", "Financier", "Matériel", "Mixte"].map((cat, catIdx) => {
              const IconComponent = getCategoryIcon(cat);
              const count = getCategoryCount(cat);
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={`cat-${cat}-${catIdx}`}
                  id={`filter-btn-${cat}`}
                  onClick={() => setSelectedCategory(cat)}
                  className={`snap-start px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2.5 border whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? "bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-600/20"
                      : "bg-stone-50 border-stone-200/70 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }`}
                >
                  <IconComponent className={`h-4 w-4 ${isActive ? "text-white" : "text-stone-400"}`} />
                  <span>{cat}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    isActive 
                      ? "bg-amber-700 text-white" 
                      : "bg-stone-200/80 text-stone-600"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Recherche & Filtres Avancés */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Zone de recherche */}
            <div className="relative flex-1 sm:w-80" id="search-container">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher une dotation, lieu, matériel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-stone-50 border border-stone-200/80 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all placeholder:text-stone-400 font-medium"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Actions de filtrage */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  showAdvancedFilters || selectedLocation !== "Toutes" || selectedTension !== "Tous" || sortBy !== "recent"
                    ? "bg-stone-900 border-stone-900 text-white shadow-sm"
                    : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4 text-amber-500" />
                <span>Affiner</span>
                {(selectedLocation !== "Toutes" || selectedTension !== "Tous" || sortBy !== "recent") && (
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>

              {(selectedCategory !== "Tous" || selectedLocation !== "Toutes" || selectedTension !== "Tous" || searchTerm !== "" || sortBy !== "recent") && (
                <button
                  onClick={handleResetFilters}
                  title="Réinitialiser tous les filtres"
                  className="px-3.5 py-2.5 bg-stone-50 border border-stone-200 hover:bg-stone-100 text-stone-600 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Réinitialiser</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Panneau des Filtres Avancés Dépliable */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden bg-slate-50 border border-slate-200/70 rounded-2xl p-5 shadow-inner"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Localisation dynamique */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    Zone Géographique
                  </label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none cursor-pointer font-medium"
                  >
                    {uniqueLocations.map((loc, lIdx) => (
                      <option key={`loc-opt-${loc}-${lIdx}`} value={loc}>
                        {loc === "Toutes" ? "Toutes les localisations" : loc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Niveau d'attribution / Tension */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-rose-500" />
                    Indice d'Attribution & Convoitise
                  </label>
                  <select
                    value={selectedTension}
                    onChange={(e) => setSelectedTension(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none cursor-pointer font-medium"
                  >
                    <option value="Tous">Tous les statuts de demande</option>
                    <option value="Critique">Attribution en cours (≥ 5 dossiers)</option>
                    <option value="Soutenue">Demandes actives (3 - 4 dossiers)</option>
                    <option value="Disponible">Nouvelle dotation libre (&lt; 3 dossiers)</option>
                  </select>
                </div>

                {/* Tri des résultats */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5 text-indigo-600" />
                    Classement des Dotations
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none cursor-pointer font-medium"
                  >
                    <option value="recent">Mises en ligne récentes</option>
                    <option value="bids_high">Dossiers : Forte demande</option>
                    <option value="bids_low">Dossiers : Moins sollicités</option>
                    <option value="value_high">Estimation : Décroissante</option>
                    <option value="value_low">Estimation : Croissante</option>
                  </select>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Catalogue des dons : 2 rangées sur PC avec défilement horizontal fluide et carrousel sur mobile */}
      <div 
        ref={donationsContainerRef}
        className="grid grid-flow-col grid-rows-1 md:grid-rows-2 auto-cols-[calc(100vw-3.2rem)] xs:auto-cols-[calc(100vw-4rem)] sm:auto-cols-[80vw] md:auto-cols-[360px] lg:auto-cols-[380px] xl:auto-cols-[390px] overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-stone-100 gap-5 sm:gap-6 md:gap-6 lg:gap-7 -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-1 py-1 pb-4" 
        id="donations-grid"
        onScroll={handleDonationScroll}
      >
        {filteredDonations.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-white rounded-3xl border border-dashed border-stone-200 shadow-sm w-full shrink-0">
            <div className="h-16 w-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Gift className="h-8 w-8" />
            </div>
            <h3 className="text-stone-900 font-black text-lg">Aucune dotation trouvée</h3>
            <p className="text-stone-500 text-sm mt-1 max-w-sm mx-auto">Ajustez vos filtres de recherche ou réinitialisez la sélection pour explorer les autres opportunités.</p>
          </div>
        ) : (
          filteredDonations.map((don, idx) => {
            const tension = getTensionIndex(don.current_bids_count);
            const TensionIcon = tension.icon;

            return (
              <div 
                key={`don-${don.id}-${idx}`} 
                id={`donation-card-${don.id}`}
                className="w-full h-full snap-start shrink-0 bg-white rounded-[28px] border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_32px_-8px_rgba(180,83,9,0.12)] hover:border-amber-200/90 transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1"
              >
                {/* Image de présentation immersive avec badge élégant */}
                <div className="relative h-56 bg-stone-100 overflow-hidden">
                  <img 
                    src={don.image_url || "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=600"} 
                    alt={don.title} 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=600";
                    }}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />

                  {/* Badges Flottants Modernes */}
                  <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                    <span className="px-3.5 py-1.5 bg-white/95 backdrop-blur-md text-stone-900 text-xs font-black rounded-xl shadow-md border border-white/40 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-amber-600" />
                      {don.category}
                    </span>
                  </div>

                  {/* Statut d'attribution flottant */}
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1.5 text-xs font-black rounded-xl backdrop-blur-md shadow-md border flex items-center gap-1.5 ${tension.color}`}>
                      <TensionIcon className="h-3.5 w-3.5" />
                      {tension.label}
                    </span>
                  </div>

                  {/* Localisation et Vues en bas de l'image */}
                  <div className="absolute bottom-4 inset-x-4 flex justify-between items-center text-xs">
                    {don.location ? (
                      <span className="px-3 py-1 bg-stone-900/80 backdrop-blur-md text-stone-100 text-xs font-semibold rounded-xl border border-white/10 flex items-center gap-1.5 shadow-sm">
                        <MapPin className="h-3.5 w-3.5 text-amber-400" />
                        {don.location}
                      </span>
                    ) : <span />}

                    <span className="px-2.5 py-1 bg-black/50 backdrop-blur-md text-stone-300 text-[11px] font-medium rounded-xl flex items-center gap-1 border border-white/10">
                      <Eye className="h-3 w-3 text-stone-400" />
                      <span>{don.views_count || 0} vues</span>
                    </span>
                  </div>
                </div>

                {/* Corps de la fiche restructuré */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[11px] font-bold text-amber-700 tracking-wide uppercase">
                        {don.current_bids_count} {don.current_bids_count > 1 ? "candidatures en cours" : "candidature reçue"}
                      </span>
                      {don.donor_name && (
                        <span className="text-[11px] text-stone-400 font-medium truncate max-w-[140px]">
                          Par {don.donor_name}
                        </span>
                      )}
                    </div>

                    <h3 
                      onClick={() => {
                        setSelectedDonationForDetails(don);
                        onViewDonation?.(don.id);
                      }}
                      className="text-lg font-black text-stone-900 line-clamp-1 cursor-pointer hover:text-amber-600 transition-colors tracking-tight"
                      title={don.title}
                    >
                      {don.title}
                    </h3>

                    <p className="text-stone-600 text-xs sm:text-sm line-clamp-2 leading-relaxed font-normal">
                      {don.description}
                    </p>
                  </div>

                  {/* Bloc Valeur & Caractéristiques Clés */}
                  <div className="bg-stone-50/90 rounded-2xl p-3.5 border border-stone-100 space-y-2.5">
                    {don.target_amount && (
                      <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
                        <span className="text-xs text-stone-500 font-bold">Dotation estimée</span>
                        <span className="text-base font-black text-amber-700">{don.target_amount.toLocaleString("fr-FR")} €</span>
                      </div>
                    )}

                    {don.specifications && Object.keys(don.specifications).length > 0 && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(don.specifications).slice(0, 2).map(([key, value], idx) => (
                          <div key={`${key}-${idx}`} className="truncate">
                            <span className="text-stone-400 block text-[10px] uppercase font-bold">{key}</span>
                            <span className="font-bold text-stone-800 truncate block">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions & Candidature */}
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <div className="grid grid-cols-2 gap-2.5">
                      {(() => {
                        const hasAlreadyApplied = currentUser && applications?.some(app => 
                          app.donation_id === don.id && 
                          (app.user_id === currentUser.id || app.user_email === currentUser.email)
                        );

                        if (hasAlreadyApplied) {
                          return (
                            <div
                              className="col-span-2 py-3 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-2xl text-xs font-black flex items-center justify-center gap-2 animate-fadeIn"
                            >
                              <ShieldCheck className="h-4 w-4 text-emerald-600" />
                              Dossier sous instruction
                            </div>
                          );
                        }

                        return (
                          <>
                            <button
                              onClick={() => {
                                setSelectedDonationForDetails(don);
                                onViewDonation?.(don.id);
                              }}
                              className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200/80 text-stone-800 rounded-2xl text-xs font-extrabold transition-all border border-stone-200/60 cursor-pointer text-center"
                            >
                              Fiche détaillée
                            </button>
                            <button
                              onClick={() => setSelectedDonationForApplyDirect(don)}
                              className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-amber-600/20 hover:shadow-lg cursor-pointer text-center flex items-center justify-center gap-1"
                            >
                              <span>Postuler</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        onClick={() => {
                          setSelectedDonationForAgent(don);
                          if (!agentChats[don.id]) {
                            setAgentChats(prev => ({
                              ...prev,
                              [don.id]: [
                                { sender: 'agent', content: `Bonjour ! Je suis le référent d'instruction pour la dotation : "${don.title}". Posez-moi vos questions ici en direct.`, time: "Maintenant" }
                              ]
                            }));
                          }
                        }}
                        className="py-2 bg-stone-50 hover:bg-stone-100 text-stone-600 hover:text-stone-900 rounded-xl text-[11px] font-bold transition-all border border-stone-200/60 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                        <span>Référent</span>
                      </button>
                      <button
                        onClick={() => setSelectedDonationForBids(don)}
                        className="py-2 bg-stone-50 hover:bg-stone-100 text-stone-600 hover:text-stone-900 rounded-xl text-[11px] font-bold transition-all border border-stone-200/60 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Flame className="h-3.5 w-3.5 text-rose-500" />
                        <span>Convoitise</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Indicateur et Contrôles de défilement horizontal pour les dons (PC et Mobile) */}
      {filteredDonations.length > 1 && (
        <div className="flex items-center justify-between pt-2 pb-6 px-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="bg-amber-100 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-xl text-xs font-black">
              {Math.min(activeDonationIndex + 1, filteredDonations.length)} / {filteredDonations.length}
            </span>
            <span className="text-[11px] text-stone-500 font-bold hidden md:inline">
              Catalogue présenté sur 2 rangées • Faites défiler horizontalement de droite à gauche
            </span>
            <span className="text-[11px] text-stone-500 font-bold md:hidden">
              Glissez de droite à gauche
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => scrollDonationsBy("left")}
              className="h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              aria-label="Faire défiler vers la gauche"
              title="Précédent"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Barre de dots dynamique */}
            <div className="flex items-center gap-1 max-w-[120px] overflow-hidden px-1">
              {filteredDonations.slice(0, 8).map((_, i) => (
                <button
                  key={`dot-don-${i}`}
                  onClick={() => scrollToDonation(i)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    activeDonationIndex === i ? "w-6 bg-amber-600" : "w-2 bg-stone-300 hover:bg-stone-400"
                  }`}
                  aria-label={`Aller au don ${i + 1}`}
                />
              ))}
              {filteredDonations.length > 8 && (
                <span className="text-[9px] text-stone-400 font-black">+</span>
              )}
            </div>

            <button
              onClick={() => scrollDonationsBy("right")}
              className="h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              aria-label="Faire défiler vers la droite"
              title="Suivant"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      )}

      {/* --- SECTION TEMOIGNAGES MULTIMEDIAS INTERACTIFS (PREUVE SOCIALE) --- */}
      <section className="bg-stone-900 text-white rounded-[32px] p-6 sm:p-12 space-y-8 relative overflow-hidden border border-stone-800 shadow-2xl" id="multimedia-testimonials">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(217,119,6,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="text-center space-y-3 relative z-10 max-w-2xl mx-auto">
          <span className="px-4 py-1.5 bg-amber-500/10 text-amber-300 border border-amber-400/20 rounded-full text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Impact & Retours d'Expérience
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Témoignages de nos lauréats
          </h2>
          <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
            Découvrez comment les dotations directes du Pôle de Dons concrétisent des projets d'utilité publique, de solidarité humaine et d'émancipation professionnelle.
          </p>

          {/* Filtres de catégories de témoignages */}
          <div className="flex flex-wrap justify-center items-center gap-2 pt-2">
            {[
              { key: "all", label: "Tous les récits", icon: Sparkles },
              { key: "audio", label: "Audio", icon: Volume2 },
              { key: "video", label: "Vidéo", icon: Video },
              { key: "image", label: "Photos terrain", icon: FileText },
              { key: "text", label: "Avis écrits", icon: MessageSquare }
            ].map((f) => {
              const Icon = f.icon;
              const isActive = testimonialFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setTestimonialFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20 font-black"
                      : "bg-stone-800/80 text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-stone-700/60"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div 
          ref={testimonialsContainerRef}
          className="grid grid-flow-col auto-cols-[calc(100vw-3.2rem)] xs:auto-cols-[calc(100vw-4rem)] sm:auto-cols-[80vw] md:auto-cols-[calc(50%-12px)] lg:auto-cols-[calc(33.333%-16px)] overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide gap-5 sm:gap-6 relative z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-1 pb-4"
          id="testimonials-grid"
          onScroll={handleTestimonialScroll}
        >
          {(() => {
            const approvedTestimonials = testimonials.filter(t => {
              if (!t.approved) return false;
              if (testimonialFilter === "all") return true;
              return t.media_type === testimonialFilter;
            });
            
            if (approvedTestimonials.length === 0) {
              return (
                <div className="col-span-full py-14 text-center bg-stone-800/30 border border-dashed border-stone-700/60 rounded-3xl space-y-3 w-full shrink-0">
                  <Sparkles className="h-10 w-10 text-stone-500 mx-auto" />
                  <p className="text-stone-400 text-sm font-semibold">Aucun témoignage dans cette catégorie pour le moment.</p>
                  <button
                    onClick={() => setTestimonialFilter("all")}
                    className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded-xl text-xs font-bold transition-colors border border-stone-700 cursor-pointer"
                  >
                    Voir tous les témoignages
                  </button>
                </div>
              );
            }

            return approvedTestimonials.map((t, idx) => (
              <div 
                key={`approved-testi-${t.id || idx}-${idx}`} 
                className="w-full h-full snap-start shrink-0 bg-stone-800/90 border border-stone-700/70 rounded-3xl p-6 space-y-5 flex flex-col justify-between shadow-lg hover:border-amber-500/40 hover:bg-stone-800 transition-all duration-300 group"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/25 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      {t.media_type === "audio" ? <Volume2 className="h-3 w-3 text-amber-400" /> : t.media_type === "video" ? <Video className="h-3 w-3 text-amber-400" /> : t.media_type === "image" ? <FileText className="h-3 w-3 text-amber-400" /> : <MessageSquare className="h-3 w-3 text-amber-400" />}
                      {t.media_type === "audio" ? "Enregistrement Audio" : t.media_type === "video" ? "Témoignage Vidéo" : t.media_type === "image" ? "Visuel de Terrain" : "Citation Lauréat"}
                    </span>
                    <span className="text-[10px] text-stone-400 font-semibold">
                      {new Date(t.created_at || Date.now()).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {t.quote && (
                    <div className="relative pl-3 border-l-2 border-amber-500/40">
                      <p className="text-stone-200 text-xs sm:text-sm italic leading-relaxed font-medium">
                        "{t.quote}"
                      </p>
                    </div>
                  )}
                </div>

                {t.media_type === "audio" && t.railway_media_url && (
                  <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-700/50 flex items-center gap-4 shadow-inner">
                    <button
                      onClick={() => setPlayingAudioId(playingAudioId === t.id ? null : t.id)}
                      className="h-11 w-11 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-full flex items-center justify-center font-black shadow-md transition-all cursor-pointer flex-shrink-0 group-hover:scale-105"
                      aria-label="Écouter le témoignage"
                    >
                      {playingAudioId === t.id ? <Pause className="h-4.5 w-4.5 fill-current" /> : <Play className="h-4.5 w-4.5 fill-current ml-0.5" />}
                    </button>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-extrabold text-white truncate max-w-[130px]">{t.author_name}</span>
                        <span className={`font-mono font-bold ${playingAudioId === t.id ? "text-amber-400" : "text-stone-400"}`}>
                          {playingAudioId === t.id ? "En lecture" : "Écouter l'extrait"}
                        </span>
                      </div>
                      <div className="flex items-end gap-0.5 h-6">
                        {[4, 8, 2, 6, 9, 3, 5, 8, 4, 7, 2, 5, 8, 4, 9, 3, 6, 8, 2, 5, 7, 3, 9, 4, 6].map((h, i) => (
                          <div
                            key={`freq-bar-catalog-${t.id || idx}-${i}`}
                            className={`flex-1 rounded-xs transition-all duration-300 ${
                              playingAudioId === t.id ? "bg-amber-400 animate-pulse" : "bg-stone-700"
                            }`}
                            style={{ height: playingAudioId === t.id ? `${h * 10}%` : "16%" }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {t.media_type === "video" && t.railway_media_url && (
                  <div 
                    onClick={() => setActiveVideoTestimonial(t)}
                    className="relative h-36 bg-stone-950 rounded-2xl overflow-hidden border border-stone-700/60 flex items-center justify-center group/vid cursor-pointer shadow-md"
                  >
                    <img 
                      src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=400" 
                      alt="Miniature vidéo bénéficiaire" 
                      className="w-full h-full object-cover opacity-60 group-hover/vid:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-stone-950/30 group-hover/vid:bg-stone-950/20 transition-colors" />
                    <div className="h-12 w-12 bg-amber-500 text-stone-950 rounded-full flex items-center justify-center font-bold shadow-xl transition-transform duration-300 group-hover/vid:scale-110 z-10">
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </div>
                    <div className="absolute bottom-2.5 left-3 right-3 z-10 flex justify-between items-center text-[10px] font-extrabold text-white">
                      <span className="truncate bg-stone-950/70 backdrop-blur-xs px-2.5 py-1 rounded-lg">{t.author_name}</span>
                      <span className="bg-amber-500/90 text-stone-950 px-2 py-0.5 rounded font-black text-[9px]">HD</span>
                    </div>
                  </div>
                )}

                {t.media_type === "image" && t.railway_media_url && (
                  <div className="relative h-36 bg-stone-950 rounded-2xl overflow-hidden border border-stone-700/60 flex items-center justify-center">
                    <img 
                      src={t.railway_media_url} 
                      alt={t.author_name} 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=600";
                      }}
                      className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-2.5 left-3 z-10 text-[10px] font-extrabold text-white bg-stone-950/70 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-stone-700/50">
                      {t.author_name}
                    </div>
                  </div>
                )}

                {/* Footer de la carte auteur */}
                <div className="pt-3 border-t border-stone-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs font-black">
                      {t.author_name?.charAt(0) || "B"}
                    </div>
                    <div>
                      <span className="text-xs font-black text-white block leading-tight">{t.author_name}</span>
                      <span className="text-[10px] text-stone-400 font-medium">Bénéficiaire certifié</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3" />
                    Vérifié
                  </span>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Indicateurs et Contrôles de balayage pour les témoignages (1 rangée de 3 témoignages sur PC, défilement horizontal) */}
        {(() => {
          const approvedTestimonials = testimonials.filter(t => {
            if (!t.approved) return false;
            if (testimonialFilter === "all") return true;
            return t.media_type === testimonialFilter;
          });
          if (approvedTestimonials.length > 1) {
            return (
              <div className="flex items-center justify-between pt-3 px-1 relative z-20">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-xl text-xs font-black">
                    {Math.min(activeTestimonialIndex + 1, approvedTestimonials.length)} / {approvedTestimonials.length}
                  </span>
                  <span className="text-[11px] text-stone-400 font-bold hidden md:inline">
                    1 rangée de 3 témoignages • Faites défiler horizontalement de gauche à droite
                  </span>
                  <span className="text-[11px] text-stone-400 font-bold md:hidden">
                    Glissez horizontalement
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => scrollTestimonialsBy("left")}
                    className="h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 hover:bg-stone-700 hover:text-amber-300 hover:border-amber-500/40 shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                    aria-label="Faire défiler les témoignages vers la gauche"
                    title="Précédent"
                  >
                    <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>

                  {/* Barre de dots dynamique */}
                  <div className="flex items-center gap-1 max-w-[120px] overflow-hidden px-1">
                    {approvedTestimonials.slice(0, 8).map((_, i) => (
                      <button
                        key={`dot-testi-${i}`}
                        onClick={() => scrollToTestimonial(i)}
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                          activeTestimonialIndex === i ? "w-6 bg-amber-400" : "w-2 bg-stone-700 hover:bg-stone-600"
                        }`}
                        aria-label={`Aller au témoignage ${i + 1}`}
                      />
                    ))}
                    {approvedTestimonials.length > 8 && (
                      <span className="text-[9px] text-stone-500 font-black">+</span>
                    )}
                  </div>

                  <button
                    onClick={() => scrollTestimonialsBy("right")}
                    className="h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 hover:bg-stone-700 hover:text-amber-300 hover:border-amber-500/40 shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                    aria-label="Faire défiler les témoignages vers la droite"
                    title="Suivant"
                  >
                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </section>


      {/* --- MODALES --- */}

      {/* 1. Modale de Fiche de Don Détaillée (SANS numéro de téléphone agent) */}
      <AnimatePresence>
        {selectedDonationForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDonationForDetails(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />

            {/* --- 1. MODALE FICHE DE DON DÉTAILLÉE --- */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col border border-stone-200/90"
            >
              {/* Header Image & Badges */}
              <div className="relative h-64 sm:h-72 bg-stone-900">
                <img 
                  src={selectedDonationForDetails.image_url || "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=600"} 
                  alt={selectedDonationForDetails.title} 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=600";
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-stone-950/30 pointer-events-none" />

                <button 
                  onClick={() => setSelectedDonationForDetails(null)}
                  className="absolute top-4 right-4 bg-stone-950/70 hover:bg-stone-950 text-white p-2.5 rounded-full backdrop-blur-md transition-all shadow-lg cursor-pointer z-10"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-stone-900/90 backdrop-blur-md text-amber-400 text-xs font-black rounded-xl shadow-sm border border-amber-500/30 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-amber-400" />
                    {selectedDonationForDetails.category}
                  </span>
                </div>

                {selectedDonationForDetails.location && (
                  <div className="absolute bottom-4 left-4 z-10">
                    <span className="px-3.5 py-1.5 bg-stone-950/85 backdrop-blur-md text-stone-100 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-stone-700/60 shadow-md">
                      <MapPin className="h-3.5 w-3.5 text-amber-400" />
                      {selectedDonationForDetails.location}
                    </span>
                  </div>
                )}
              </div>

              {/* Info Body */}
              <div className="p-6 sm:p-7 space-y-6 overflow-y-auto max-h-[calc(100vh-22rem)] scrollbar-thin">
                <div className="space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <span className={`px-3 py-1 text-xs font-black rounded-xl border ${getTensionIndex(selectedDonationForDetails.current_bids_count).color}`}>
                      {getTensionIndex(selectedDonationForDetails.current_bids_count).label}
                    </span>
                    <div className="text-xs text-stone-500 font-semibold flex items-center gap-3">
                      <span className="flex items-center gap-1.5 bg-stone-50 border border-stone-200/80 px-2.5 py-1 rounded-lg text-[11px]" title="Consultations de cette fiche">
                        <Eye className="h-3.5 w-3.5 text-stone-400" />
                        <span>{selectedDonationForDetails.views_count || 0} consultations</span>
                      </span>
                      <span className="flex items-center gap-1.5 bg-amber-50/80 border border-amber-200/60 text-amber-900 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                        <Users className="h-3.5 w-3.5 text-amber-700" />
                        <span>{selectedDonationForDetails.current_bids_count} candidatures</span>
                      </span>
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">{selectedDonationForDetails.title}</h2>
                </div>

                {/* ENCART PÉDAGOGIQUE ENCHÈRE SOLIDAIRE & POSITION */}
                <div className="bg-gradient-to-br from-amber-50/90 via-stone-50 to-amber-50/40 border border-amber-200/80 rounded-2xl p-5 space-y-3.5 shadow-sm">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 bg-amber-600 text-white rounded-xl flex-shrink-0 shadow-sm">
                      <Award className="h-5 w-5" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                        Attribution Solidaire & Position d'Urgence
                      </h4>
                      {currentUser ? (
                        <p className="text-xs text-stone-700 font-medium">
                          Votre rang estimé dans la file d'analyse :{" "}
                          <span className="font-black text-stone-950 text-xs bg-amber-300/80 px-2 py-0.5 rounded-md border border-amber-400">
                            #{Math.max(1, Math.round((1 - (priorityScore - 10) / 90) * selectedDonationForDetails.current_bids_count))}
                          </span>{" "}
                          sur <strong className="text-stone-900">{selectedDonationForDetails.current_bids_count} structure(s) postulantes</strong>.
                        </p>
                      ) : (
                        <p className="text-xs text-stone-600 font-medium leading-relaxed">
                          Connectez-vous pour évaluer votre indice d'urgence sociale et déclarer vos besoins prioritaires.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-stone-600 space-y-1.5 pt-3 border-t border-amber-200/60">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      Processus 100% gratuit, neutre et contrôlé
                    </span>
                    <p className="leading-relaxed text-[11px] text-stone-600 font-medium">
                      L'affectation des biens repose exclusivement sur l'utilité publique, l'impact social et l'urgence humanitaire. 
                      Aucune contrepartie financière n'est possible ni demandée.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-black text-stone-400 uppercase tracking-wider">Description de la dotation</h4>
                  <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line font-medium">{selectedDonationForDetails.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/70">
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <span className="font-bold text-stone-700">Origine du donateur :</span>
                    <span className="text-stone-900 bg-white px-2.5 py-1 rounded-lg font-bold border border-stone-200 shadow-xs">
                      {selectedDonationForDetails.donor_name || "Institution / Partenaire Certifié"}
                    </span>
                  </div>
                </div>

                {/* Spécifications Détaillées */}
                {selectedDonationForDetails.specifications && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-stone-400 uppercase tracking-wider">Fiche Technique & Caractéristiques</h4>
                    <div className="border border-stone-200/80 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-stone-100/70 border-b border-stone-200/80 text-stone-600 font-bold">
                            <th className="px-4 py-2.5">Caractéristique</th>
                            <th className="px-4 py-2.5">Spécification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 text-stone-700 font-medium">
                          {Object.entries(selectedDonationForDetails.specifications).map(([key, value], idx) => (
                            <tr key={`${key}-${idx}`} className="hover:bg-stone-50/60 transition-colors">
                              <td className="px-4 py-2.5 text-stone-500 font-semibold">{key}</td>
                              <td className="px-4 py-2.5 font-bold text-stone-900">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TÉMOIGNAGES RATTACHÉS À CE DON */}
                {(() => {
                  const donationTestimonials = testimonials.filter(
                    (t) => t.donation_id === selectedDonationForDetails.id || t.donation_id === String(selectedDonationForDetails.id)
                  );
                  if (donationTestimonials.length === 0) return null;

                  return (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-amber-600" /> Témoignages & Preuves d'Attribution ({donationTestimonials.length})
                      </h4>
                      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory -mx-2 px-2 scrollbar-hide">
                        {donationTestimonials.map((t, idx) => (
                          <div key={`don-testi-${t.id || idx}-${idx}`} className="min-w-[260px] max-w-[260px] snap-center p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2.5 flex-shrink-0">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black text-stone-900 truncate pr-2">{t.author_name}</span>
                              <span className="text-[9px] bg-amber-500/15 text-amber-900 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0">
                                {t.media_type === "audio" ? "🔊 Audio" : t.media_type === "image" ? "🖼️ Image" : t.media_type === "video" ? "📺 Vidéo" : "📝 Note"}
                              </span>
                            </div>

                            {t.quote && (
                              <p className="text-xs text-stone-600 italic leading-relaxed line-clamp-3 font-medium">
                                "{t.quote}"
                              </p>
                            )}

                            {/* Lecteur Audio Intégré */}
                            {t.media_type === "audio" && (
                              <div className="bg-white p-2.5 rounded-xl border border-stone-200 flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => setPlayingAudioId(playingAudioId === t.id ? null : t.id)}
                                  className="h-7 w-7 bg-amber-600 hover:bg-amber-500 text-white rounded-full flex items-center justify-center font-bold shadow transition-all cursor-pointer flex-shrink-0"
                                >
                                  {playingAudioId === t.id ? (
                                    <Pause className="h-3.5 w-3.5 fill-current" />
                                  ) : (
                                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                                  )}
                                </button>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-end gap-[2px] h-3.5">
                                    {[3, 7, 2, 6, 8, 3, 5, 8, 4, 7, 2, 5, 8, 4].map((h, i) => (
                                      <div
                                        key={`freq-bar-details-${t.id || idx}-${i}`}
                                        className={`flex-1 rounded-sm transition-all duration-300 ${
                                          playingAudioId === t.id ? "bg-amber-600 animate-pulse" : "bg-stone-200"
                                        }`}
                                        style={{
                                          height: playingAudioId === t.id ? `${h * 12}%` : "18%",
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Image WebP Intégrée */}
                            {t.media_type === "image" && t.railway_media_url && (
                              <div className="relative rounded-xl overflow-hidden border border-stone-200 h-20 bg-stone-100">
                                <img
                                  src={t.railway_media_url}
                                  alt="Témoignage visuel"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            {/* Vidéo YouTube intégrée */}
                            {t.media_type === "video" && t.railway_media_url && (
                              <div className="relative rounded-xl overflow-hidden border border-stone-200 h-20 bg-stone-950 flex items-center justify-center group">
                                <img
                                  src="https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=300"
                                  alt="Vidéo d'impact miniature"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover opacity-60"
                                />
                                <button
                                  type="button"
                                  onClick={() => setActiveVideoTestimonial(t)}
                                  className="absolute h-8 w-8 bg-amber-600 hover:bg-amber-500 text-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-all cursor-pointer"
                                >
                                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Agent en charge */}
                {selectedDonationForDetails.agent_name && (
                  <div className="p-4.5 bg-gradient-to-r from-stone-900 to-stone-800 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-stone-700 shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 bg-amber-500 text-stone-950 rounded-2xl flex items-center justify-center font-black text-sm shadow">
                        {selectedDonationForDetails.agent_name.charAt(0)}
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider block">Référent d'Attribution Direct</span>
                        <span className="text-sm font-black text-white">{selectedDonationForDetails.agent_name}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const don = selectedDonationForDetails;
                        setSelectedDonationForDetails(null);
                        setSelectedDonationForAgent(don);
                        if (!agentChats[don.id]) {
                          setAgentChats(prev => ({
                            ...prev,
                            [don.id]: [
                              { sender: 'agent', content: `Bonjour ! Je suis le référent d'attribution en charge du don : "${don.title}". Vous pouvez me poser toutes vos questions ici en direct.`, time: "Maintenant" }
                            ]
                          }));
                        }
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Échanger en direct
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 bg-stone-50 border-t border-stone-200/80 flex justify-end items-center gap-3">
                <button
                  onClick={() => setSelectedDonationForDetails(null)}
                  className="px-4 py-2.5 text-stone-600 hover:bg-stone-200/60 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Fermer
                </button>
                {(() => {
                  const don = selectedDonationForDetails;
                  const hasAlreadyApplied = currentUser && don && applications?.some(app => 
                    app.donation_id === don.id && 
                    (app.user_id === currentUser.id || app.user_email === currentUser.email)
                  );

                  if (hasAlreadyApplied) {
                    return (
                      <div className="px-5 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Dossier déjà transmis
                      </div>
                    );
                  }

                  return (
                    <button
                      onClick={() => {
                        const don = selectedDonationForDetails;
                        setSelectedDonationForDetails(null);
                        setSelectedDonationForApplyDirect(don);
                      }}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-600/20 cursor-pointer"
                    >
                      Postuler à cette dotation
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- 2. MODALE DE CHAT INSTANTANÉ EN DIRECT AVEC L'AGENT --- */}
      <AnimatePresence>
        {selectedDonationForAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDonationForAgent(null)}
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col border border-stone-200/90 max-h-[90vh] h-[580px] my-auto"
            >
              {/* Header Chat */}
              <div className="p-4 sm:p-5 bg-stone-900 text-white flex justify-between items-center border-b border-stone-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-amber-500 rounded-2xl flex items-center justify-center font-black text-xs text-stone-950 shadow-md">
                    {selectedDonationForAgent.agent_name?.charAt(0) || "A"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-white">{selectedDonationForAgent.agent_name || "Référent d'attribution"}</span>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">Pôle Dons</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      Conseiller en ligne pour ce don
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDonationForAgent(null)}
                  className="text-stone-400 hover:text-white p-2 hover:bg-stone-800 rounded-full transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Rappel du don concerné */}
              <div className="px-4 py-2 bg-stone-100/90 border-b border-stone-200/80 flex items-center justify-between text-xs flex-shrink-0">
                <span className="text-stone-500 font-medium truncate max-w-[280px]">
                  Objet : <strong className="text-stone-800 font-bold">{selectedDonationForAgent.title}</strong>
                </span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                  {selectedDonationForAgent.category}
                </span>
              </div>

              {/* Chat Messages Panel */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/80 scrollbar-thin" id="live-chat-panel" onScroll={handleChatScroll}>
                {(() => {
                  const filteredMessages = unifiedMessages.filter((m: any) => m.donation_id === selectedDonationForAgent.id);
                  const msgs = filteredMessages.length > 0 
                    ? filteredMessages 
                    : [
                        {
                          sender: 'agent',
                          sender_type: 'admin',
                          content: `Bonjour ! Je suis le référent d'attribution pour le don : "${selectedDonationForAgent.title}". N'hésitez pas à poser vos questions concernant les démarches et l'acheminement.`,
                          created_at: new Date().toISOString()
                        }
                      ];

                  return msgs.map((msg, idx) => {
                    const isSystem = msg.sender_type === "system" || msg.sender === "system";
                    const isUser = msg.sender_type === "user" || msg.sender === "user";

                    return (
                      <div 
                        key={idx} 
                        className={`flex flex-col max-w-[85%] ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}
                      >
                        <span className="text-[9px] font-bold text-stone-400 mb-0.5 flex items-center gap-1">
                          {isSystem ? "Instruction automatisée" : isUser ? "Vous" : (msg.user_name || selectedDonationForAgent.agent_name || "Référent")}
                          {isUser && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[7px] uppercase tracking-tighter font-black ${
                              currentUser ? "bg-amber-100 text-amber-900" : "bg-stone-200 text-stone-700"
                            }`}>
                              {currentUser ? "Candidat vérifié" : "Visiteur"}
                            </span>
                          )}
                        </span>
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs font-medium ${
                          isSystem 
                            ? "bg-stone-100 text-stone-700 rounded-tl-none border border-stone-200/70"
                            : isUser 
                              ? "bg-amber-600 text-white rounded-tr-none" 
                              : "bg-white text-stone-800 rounded-tl-none border border-stone-200/80"
                        }`}>
                          {msg.content}
                          {msg.attachment && (
                            <div className={`mt-2 p-1.5 rounded-xl border flex items-center gap-2 max-w-fit ${isUser ? "bg-amber-700/60 border-amber-500/50" : "bg-stone-50 border-stone-200"}`}>
                              {msg.attachment.type?.startsWith("audio/") ? (
                                <div className="flex items-center gap-2">
                                  <audio 
                                    controls 
                                    src={typeof msg.attachment === 'string' ? msg.attachment : (msg.attachment.url || msg.attachment.data)} 
                                    className="h-8 w-40 rounded-lg outline-none"
                                  />
                                </div>
                              ) : (
                                <>
                                  <Paperclip size={12} className={isUser ? "text-amber-200" : "text-stone-400"} />
                                  <a 
                                    href={typeof msg.attachment === 'string' ? msg.attachment : (msg.attachment.url || msg.attachment.data)} 
                                    download={msg.attachment.name || "piece_jointe"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-[10px] font-bold hover:underline truncate max-w-[180px] ${isUser ? "text-white" : "text-amber-700"}`}
                                  >
                                    {msg.attachment.name || "Document joint"}
                                  </a>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
                {agentIsTyping && (
                  <div className="mr-auto text-stone-400 text-xs italic flex items-center gap-1.5 p-2 bg-stone-100/70 rounded-xl border border-stone-200/50 max-w-fit">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-bounce delay-100" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-bounce delay-200" />
                    <span className="text-[11px] font-medium text-stone-500">Le référent prépare sa réponse...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Chat */}
              <div className="p-3.5 bg-white border-t border-stone-200/80 space-y-2 flex-shrink-0">
                {attachmentError && (
                  <div className="py-1 px-2.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-[10px] font-bold">
                    {attachmentError}
                  </div>
                )}
                
                {isUploadingAttachment && (
                  <div className="py-1 px-2.5 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg text-[10px] flex items-center gap-1.5 font-semibold">
                    <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                    Traitement de la pièce jointe...
                  </div>
                )}

                {chatAttachment && (
                  <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200/70 rounded-xl">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {chatAttachment.type?.startsWith("audio/") ? (
                        <audio controls src={chatAttachment.url} className="h-8 w-40" />
                      ) : (
                        <>
                          <Paperclip className="h-3.5 w-3.5 text-amber-600" />
                          <span className="text-[10px] font-bold text-amber-900 truncate">
                            {chatAttachment.name} ({chatAttachment.size_kb?.toFixed(1) || "?"} Ko)
                          </span>
                        </>
                      )}
                    </div>
                    <button onClick={() => setChatAttachment(null)} className="text-red-500 hover:text-red-700 p-1 cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <form onSubmit={handleAgentChatSubmit} className="flex gap-2">
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
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAttachment || isSendingChat}
                        className="p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl cursor-pointer text-stone-400 hover:text-stone-600 transition-all flex items-center justify-center flex-shrink-0"
                        title="Ajouter une pièce jointe"
                      >
                        <Paperclip className="h-4 w-4" />
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          className="hidden" 
                          onChange={handleChatFileChange} 
                        />
                      </button>

                      <button
                        type="button"
                        onMouseDown={audioRecorder.startRecording}
                        onTouchStart={audioRecorder.startRecording}
                        disabled={isUploadingAttachment || isSendingChat || !!chatAttachment}
                        className={`h-11 w-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 bg-stone-50 hover:bg-red-50 border-stone-200 text-stone-600 hover:text-red-500 hover:border-red-200`}
                        title="Maintenir pour enregistrer"
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                      
                      <input
                        type="text"
                        placeholder="Posez votre question au référent..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={isSendingChat}
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all"
                      />
                    </>
                  )}
                  
                  <button
                    type="submit"
                    disabled={(!chatInput.trim() && !chatAttachment) || isSendingChat || audioRecorder.isRecording}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center cursor-pointer disabled:bg-stone-100 disabled:text-stone-400 flex-shrink-0 font-bold text-xs gap-1.5"
                  >
                    {isSendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- 3. MODALE D'ENCHÈRES SOLIDAIRES & PRIORISATION --- */}
      <AnimatePresence>
        {selectedDonationForBids && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDonationForBids(null)}
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl z-10 border border-stone-200/90 max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              {/* En-tête fixe */}
              <div className="flex justify-between items-start p-6 pb-4 border-b border-stone-100 flex-shrink-0">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-900 border border-amber-500/25 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <Award className="h-3.5 w-3.5 text-amber-600" />
                    <span>Priorisation d'Urgence Sociale</span>
                  </div>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Déclaration de priorité</h3>
                </div>
                <button 
                  onClick={() => setSelectedDonationForBids(null)}
                  className="text-stone-400 hover:text-stone-700 p-2 hover:bg-stone-100 rounded-full cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Corps défilant */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 text-xs space-y-2 text-stone-600 font-medium">
                  <span className="font-black text-stone-900 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Principe d'attribution neutre et gratuit
                  </span>
                  <p className="leading-relaxed text-[11px]">
                    Nos dotations sont attribuées selon les critères de vulnérabilité sociale et d'impact direct. 
                    <strong> Aucun versement financier n'est accepté</strong>. Précisez votre contexte pour que le comité d'instruction prenne en compte l'urgence de vos besoins.
                  </p>
                </div>

                {bidSubmitted ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2.5 text-emerald-950"
                  >
                    <div className="h-10 w-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                      <Check className="h-5 w-5" />
                    </div>
                    <h4 className="text-xs font-black">Critères d'urgence enregistrés !</h4>
                    <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                      Votre score de priorité a été recalculé et transmis au référent de la dotation.
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handlePriorityBidSubmit} className="space-y-4">
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-xs font-black text-stone-800">
                        <span>Degré d'urgence déclaré</span>
                        <span className="text-amber-700 font-black px-2 py-0.5 bg-amber-50 rounded-md border border-amber-200">{priorityScore}%</span>
                      </div>

                      {/* Boutons de présélection rapide */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { score: 25, label: "Modéré" },
                          { score: 50, label: "Important" },
                          { score: 75, label: "Urgent" },
                          { score: 95, label: "Critique" }
                        ].map((preset) => (
                          <button
                            key={preset.score}
                            type="button"
                            onClick={() => setPriorityScore(preset.score)}
                            className={`py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                              priorityScore === preset.score
                                ? "bg-amber-600 text-white shadow-xs"
                                : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={priorityScore}
                        onChange={(e) => setPriorityScore(Number(e.target.value))}
                        className="w-full accent-amber-600 cursor-pointer h-2 bg-stone-200 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] text-stone-500 font-bold">
                        <span>Planifié (10%)</span>
                        <span className="text-rose-700">Urgence vitale (100%)</span>
                      </div>

                      {/* POSITION DYNAMIQUE RELATIVE AU SLIDER */}
                      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 flex items-center justify-between text-xs mt-2">
                        <span className="text-stone-900 font-bold flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-amber-600" />
                          Rang estimé d'instruction :
                        </span>
                        <span className="font-black text-stone-950 bg-white px-3 py-1 rounded-xl border border-amber-200 shadow-xs">
                          #{Math.max(1, Math.round((1 - (priorityScore - 10) / 90) * selectedDonationForBids.current_bids_count))} sur {selectedDonationForBids.current_bids_count}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-stone-700 block">Exposé sommaire des motifs d'urgence</label>
                      <textarea
                        required
                        rows={3}
                        value={urgencyReason}
                        onChange={(e) => setUrgencyReason(e.target.value)}
                        placeholder="Expliquez brièvement pourquoi l'attribution de ce bien présente un caractère d'urgence pour votre structure..."
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="flex gap-2.5 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDonationForBids(null)}
                        className="px-4 py-2.5 text-stone-600 hover:bg-stone-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-600/20 cursor-pointer"
                      >
                        Enregistrer mes critères
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- 4. MODALE DE POSTULATION DIRECTE "JE POSTULE" --- */}
      <AnimatePresence>
        {selectedDonationForApplyDirect && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDonationForApplyDirect(null)}
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl z-10 border border-stone-200/90 max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              {/* En-tête fixe */}
              <div className="flex justify-between items-start p-6 pb-4 border-b border-stone-100 flex-shrink-0">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-900 border border-amber-500/25 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <Gift className="h-3.5 w-3.5 text-amber-600" />
                    <span>Dossier d'Instruction Solidaire</span>
                  </div>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Déposer votre candidature</h3>
                </div>
                <button 
                  onClick={() => setSelectedDonationForApplyDirect(null)}
                  className="text-stone-400 hover:text-stone-700 p-2 hover:bg-stone-100 rounded-full cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Corps du formulaire défilant */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                <div className="p-3.5 bg-stone-50 border border-stone-200/80 rounded-2xl text-xs space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">Dotation ciblée</span>
                  <p className="font-black text-stone-900 text-sm">
                    {selectedDonationForApplyDirect.title}
                  </p>
                </div>

                {/* FLUX CONDITIONNEL : S'inscrire d'abord (sans quitter la fenêtre de postulation !) */}
                {!currentUser ? (
                  <div className="space-y-4">
                    {/* Toggle Onglets Connexion / Inscription */}
                    <div className="flex p-1 bg-stone-100 rounded-2xl gap-1">
                      <button
                        type="button"
                        onClick={() => setIsModalLogin(false)}
                        className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          !isModalLogin 
                            ? "bg-white text-stone-900 shadow-xs" 
                            : "text-stone-500 hover:text-stone-800"
                        }`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Créer un compte
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsModalLogin(true)}
                        className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isModalLogin 
                            ? "bg-white text-stone-900 shadow-xs" 
                            : "text-stone-500 hover:text-stone-800"
                        }`}
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        Se connecter
                      </button>
                    </div>

                    <div className="bg-amber-50/80 border border-amber-200/70 p-3.5 rounded-2xl space-y-1 text-stone-700">
                      <p className="text-[11px] text-stone-600 font-medium leading-relaxed">
                        {isModalLogin 
                          ? "Connectez-vous pour associer directement cette candidature à votre espace demandeur."
                          : "Inscription rapide : créez votre compte en 10 secondes pour finaliser votre dossier."}
                      </p>
                    </div>

                    <form onSubmit={handleModalRegister} className="space-y-3.5">
                      {!isModalLogin && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-stone-700 block">Votre Nom ou Nom de la structure</label>
                          <input
                            type="text"
                            required
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="Ex: Samuel Martin ou Association Espoir"
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-stone-700 block">Adresse E-mail</label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="nom@exemple.com"
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-stone-700 block">Mot de passe</label>
                        <div className="relative">
                          <input
                            type={showModalPassword ? "text" : "password"}
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-3.5 pr-11 py-2.5 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                          />
                          <button
                            type="button"
                            onClick={() => setShowModalPassword(!showModalPassword)}
                            className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 focus:outline-none p-0.5 rounded cursor-pointer"
                            title={showModalPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                          >
                            {showModalPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-amber-600/20 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isModalLogin ? (
                          <>
                            <LogIn className="h-4 w-4" />
                            Se connecter & Poursuivre le dossier
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" />
                            Créer mon compte & Poursuivre
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                ) : (
                  /* FLUX : Remplissage des champs d'information définis par l'admin */
                  <div className="space-y-4">
                    <div className="space-y-3.5">
                      <h4 className="text-xs font-black text-stone-400 uppercase tracking-wider">Renseignements de la candidature</h4>
                      
                      {adminDefinedFields.map((field, idx) => (
                        <div key={`admin-field-${field.key || 'key'}-${idx}`} className="space-y-1.5">
                          <label className="text-xs font-black text-stone-700 block">{field.label}</label>
                          {field.type === "textarea" ? (
                            <textarea
                              required
                              rows={3}
                              value={formResponses[field.key] || ""}
                              onChange={(e) => setFormResponses({...formResponses, [field.key]: e.target.value})}
                              placeholder={field.placeholder}
                              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                            />
                          ) : field.type === "file" ? (
                            <div className="relative border-2 border-dashed border-stone-300 hover:border-amber-600 rounded-2xl p-4 transition-all bg-stone-50 hover:bg-amber-50/20 flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                              <input
                                type="file"
                                required
                                onChange={(e) => {
                                  const fileName = e.target.files?.[0]?.name || "";
                                  setFormResponses({...formResponses, [field.key]: fileName});
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                              <div className="h-8 w-8 rounded-full bg-amber-500/10 text-amber-700 flex items-center justify-center">
                                <FileText className="h-4 w-4" />
                              </div>
                              <span className="text-xs font-bold text-stone-800 text-center truncate max-w-full px-2">
                                {formResponses[field.key] || field.placeholder || "Sélectionner un justificatif"}
                              </span>
                              <span className="text-[10px] text-stone-400 font-medium">
                                Formats acceptés : PDF, PNG, JPG (Max. 5 Mo)
                              </span>
                            </div>
                          ) : (
                            <input
                              required
                              type={field.type}
                              value={formResponses[field.key] || ""}
                              onChange={(e) => setFormResponses({...formResponses, [field.key]: e.target.value})}
                              placeholder={field.placeholder}
                              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all shadow-inner"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* VISUALISATION DE LA POSITION DE L'ENCHÈRE SOLIDAIRE EN DIRECT */}
                    <div className="bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/25 text-xs flex justify-between items-center">
                      <div className="space-y-0.5">
                        <p className="font-black text-stone-900">Évaluation de la tension solidaire</p>
                        <p className="text-[10px] text-stone-600 font-medium">Calcul instantané de votre rang dans l'ordre d'analyse</p>
                      </div>
                      <span className="bg-amber-600 text-white font-black px-3.5 py-1.5 rounded-xl text-xs shadow-xs">
                        Rang : #{Math.max(1, Math.round((1 - (priorityScore - 10) / 90) * (selectedDonationForApplyDirect?.current_bids_count || 0)))}
                      </span>
                    </div>

                    <div className="flex gap-2.5 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDonationForApplyDirect(null)}
                        className="px-4 py-2.5 text-stone-600 hover:bg-stone-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleApplyClick(selectedDonationForApplyDirect)}
                        disabled={Object.keys(formResponses).length < adminDefinedFields.length}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        Transmettre mon dossier
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SECTION PARTENAIRES LOGISTIQUES & INSTITUTIONNELS --- */}
      {partners && partners.length > 0 && (
        <section className="py-12 border-t border-slate-100 space-y-8" id="platform-partners">
          <div className="text-center space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Nos Partenaires de Confiance</h3>
            <p className="text-slate-500 text-[11px]">Ils nous accompagnent dans la logistique, le transport et le financement solidaire.</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            {partners.map((partner, idx) => (
              <a 
                key={`partner-${partner.id || idx}-${idx}`} 
                href={partner.website || "#"} 
                target="_blank" 
                rel="noreferrer"
                className="h-8 md:h-10 hover:scale-110 transition-transform flex items-center justify-center"
                title={partner.name}
              >
                <img 
                  src={partner.logo_url} 
                  alt={partner.name} 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=150";
                  }}
                  className="max-h-full max-w-[120px] object-contain" 
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Pop-up Lecteur Vidéo simulé pour les témoignages */}
      <AnimatePresence>
        {activeVideoTestimonial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveVideoTestimonial(null)}
              className="absolute inset-0 bg-stone-950/70 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-stone-950 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden z-10 p-1 border border-stone-800 my-auto"
            >
              {/* HTML5 Video Player View */}
              <div className="relative aspect-video bg-stone-900 rounded-2xl flex items-center justify-center overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=600" 
                  alt="Vidéo en cours de lecture" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-80"
                />
                
                {/* Overlay controls */}
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.8),transparent)]" />
                
                <button 
                  onClick={() => setActiveVideoTestimonial(null)}
                  className="absolute top-4 right-4 bg-stone-900/80 hover:bg-stone-900 text-white p-2 rounded-full backdrop-blur-sm transition-all cursor-pointer border border-stone-700/60"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-14 w-14 bg-amber-500 text-stone-950 rounded-full flex items-center justify-center font-bold animate-pulse shadow-xl cursor-pointer">
                    <Pause className="h-6 w-6 fill-current" />
                  </div>
                </div>

                <div className="absolute bottom-4 inset-x-4 space-y-2">
                  <div className="flex justify-between items-center text-xs text-stone-300">
                    <span className="font-extrabold text-white">{activeVideoTestimonial.author_name}</span>
                    <span className="font-mono text-amber-400">00:34 / 01:24</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-[40%]" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
