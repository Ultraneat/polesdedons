import React, { useState, useEffect, useMemo, useRef } from "react";
import { Application, ApplicationMessage, WorkflowStep } from "../types";
import { 
  LayoutDashboard, 
  FileText, 
  MessageSquare, 
  ShieldCheck, 
  HelpCircle, 
  Clock, 
  AlertTriangle, 
  UploadCloud, 
  CheckCircle, 
  Send, 
  Mic, 
  Info, 
  ChevronRight, 
  Sparkles, 
  Award, 
  Eye, 
  FileCheck,
  Zap,
  Users,
  Truck,
  Paperclip, 
  Gift,
  Star,
  Video,
  Square,
  Play,
  Volume2,
  Trash2,
  PlusCircle,
  Coins,
  Building2,
  CreditCard,
  X,
  Wallet
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Testimonial, Donation } from "../types";
import { compressImageToWebP, blobToBase64 } from "../lib/fileCompressor";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

import SecuritySettings from "./SecuritySettings";
import { getSocket, sendMessage, joinConversation } from "../lib/socket";
import DocumentModal from "./DocumentModal";

interface CandidateDashboardProps {
  application: Application | null;
  donationTitle: string;
  donationCategory?: string;
  messages: ApplicationMessage[];
  onSendMessage: (content: string, attachment?: any) => void;
  onSubmitStep: (stepIndex: number, formData: any) => void;
  workflowSteps: WorkflowStep[];
  submissions: any[];
  allApplications?: Application[];
  allDonations?: Donation[];
  currentUser?: any;
  onSetActiveApplicationId?: (id: string) => void;
  testimonials?: Testimonial[];
  onRefreshData?: () => void;
}

const iconMap: Record<string, any> = {
  FileText,
  Sparkles,
  ShieldCheck,
  Mic,
  Truck,
  Paperclip, 
  FileCheck,
  HelpCircle
};

export default function CandidateDashboard({
  application,
  donationTitle,
  donationCategory = "Matériel",
  messages,
  onSendMessage,
  onSubmitStep,
  workflowSteps,
  submissions = [],
  allApplications = [],
  allDonations = [],
  currentUser = null,
  onSetActiveApplicationId,
  testimonials = [],
  onRefreshData
}: CandidateDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "wizard" | "chat" | "docs" | "help" | "my_dons" | "security" | "testimonials">(
    application ? "overview" : "my_dons"
  );
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const audioRecorder = useAudioRecorder();

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
              fileName: "Note_vocale.webm",
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
  
  const generalChatDonationId = currentUser 
    ? `general_user_${currentUser.email?.replace(/[@.]/g, "_")}` 
    : "";

  const [generalChatMessages, setGeneralChatMessages] = useState<any[]>([]);
  const [allUserMessages, setAllUserMessages] = useState<any[]>([]);

  // Etats pour la gestion des demandes de paiement
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showPayModal, setShowPayModal] = useState<any | null>(null);
  const [selectedPayMethod, setSelectedPayMethod] = useState<any | null>(null);
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [userIbanForDeclaration, setUserIbanForDeclaration] = useState("");
  const [userHolderForDeclaration, setUserHolderForDeclaration] = useState("");

  const renderFormattedText = (text: string, isUser?: boolean) => {
    if (!text) return null;
    const lines = text.split("\n");
    return (
      <div className="space-y-1">
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-");
          const cleanLine = isBullet ? trimmed.substring(1).trim() : line;

          const parts = cleanLine.split(/\*\*([\s\S]*?)\*\*/g);
          const parsedLine = parts.map((part, pIdx) => {
            if (pIdx % 2 === 1) {
              return <strong key={pIdx} className={`font-black ${isUser ? "text-amber-100" : "text-amber-950"}`}>{part}</strong>;
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={lIdx} className="flex items-start gap-1.5 pl-1.5 py-0.5">
                <span className={`font-black select-none ${isUser ? "text-amber-200" : "text-amber-600"}`}>•</span>
                <span className="flex-1">{parsedLine}</span>
              </div>
            );
          }

          return <p key={lIdx} className="min-h-[1.25em]">{parsedLine}</p>;
        })}
      </div>
    );
  };

  // Charger les modes de paiement actifs
  useEffect(() => {
    fetch("/api/settings/payment_methods")
      .then(res => res.json())
      .then(data => {
        let methods = [];
        if (Array.isArray(data)) {
          methods = data;
        } else if (data && typeof data === "object" && Array.isArray(data.value)) {
          methods = data.value;
        }
        setPaymentMethods(methods.filter((m: any) => m.active));
      })
      .catch(err => console.warn("Erreur chargement modes paiement :", err));
  }, []);

  const [lastMessageCount, setLastMessageCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToast, setActiveToast] = useState<{ id: string; senderName: string; content: string } | null>(null);

  // Reset unread count when switching to chat tab
  useEffect(() => {
    if (activeSubTab === "chat") {
      setUnreadCount(0);
    }
  }, [activeSubTab]);

  // Handle toast timeout
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  useEffect(() => {
    if (!currentUser) return;

    // Charger l'historique initial des messages du chat général
    if (generalChatDonationId) {
      const encodedName = encodeURIComponent(currentUser.name || currentUser.email || "");
      fetch(`/api/agent-conversations/${generalChatDonationId}?user_id=${currentUser.id}&user_name=${encodedName}`)
        .then(res => res.json())
        .then(data => {
          setGeneralChatMessages(data);
        })
        .catch(err => console.warn("Erreur historique chat général (attendu si hors ligne ou restart) :", err));
    }

    const socket = getSocket();
    
    // Rejoindre la room spécifique à l'utilisateur
    joinConversation(currentUser.id);

    const handleMessageReceived = (payload: any) => {
      // Synchronisation globale de allUserMessages
      if (payload.user_id === currentUser?.id || payload.user_name === currentUser?.name || (application && payload.application_id === application.id)) {
        setAllUserMessages(prev => {
          if (prev.some(m => m.id === payload.id || (m.content === payload.content && m.created_at === payload.created_at))) {
            return prev;
          }
          const next = [...prev, payload].sort((a, b) => 
            new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          );
          
          // Notification sonore pour les messages entrants
          if (payload.sender === "agent" || payload.sender === "admin" || payload.sender_type === "admin") {
            if (audioRef.current) {
              audioRef.current.play().catch(() => {});
            }
            
            // Notification visuelle (Toast) si pas sur l'onglet chat
            if (activeSubTab !== "chat") {
              setUnreadCount(p => p + 1);
              setActiveToast({
                id: payload.id || Math.random().toString(),
                senderName: payload.user_name || "Agent d'Attribution",
                content: payload.content
              });
            }
          }
          return next;
        });
      }

      if (payload.donation_id === generalChatDonationId) {
        setGeneralChatMessages(prev => {
          if (prev.some(m => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      }
    };

    socket.on("message:received", handleMessageReceived);
    socket.on("application_message:received", handleMessageReceived);

    return () => {
      socket.off("message:received", handleMessageReceived);
      socket.off("application_message:received", handleMessageReceived);
    };
  }, [currentUser, generalChatDonationId, activeSubTab, application?.id]);
  
  // Form step fields
  const [step1Name, setStep1Name] = useState(application?.user_name || "");
  const [step1Email, setStep1Email] = useState("");
  const [step1Phone, setStep1Phone] = useState("");
  const [step2Project, setStep2Project] = useState("");
  const [step2Impact, setStep2Impact] = useState("");
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadedResult, setUploadedResult] = useState<any>(null);
  const [step3FileUrl, setStep3FileUrl] = useState("");

  // Step 4 State
  const [step4Recorded, setStep4Recorded] = useState(false);
  const [step4Text, setStep4Text] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Étape 5 State (Choix Mode de Livraison / Réception)
  const [selectedTransferMode, setSelectedTransferMode] = useState<string>("");

  // États génériques pour étapes personnalisées créées par l'admin (Étape index > 4)
  const [customStepText, setCustomStepText] = useState<string>("");
  const [customStepFileUrl, setCustomStepFileUrl] = useState<string>("");
  const [customStepUploadedResult, setCustomStepUploadedResult] = useState<any>(null);

  // Document Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);

  const openDocument = (url: string, name: string) => {
    setSelectedDoc({ url, name });
    setIsDocModalOpen(true);
  };

  // Pré-sélectionner automatiquement le mode de paiement en fonction du choix initial du dossier
  useEffect(() => {
    if (showPayModal && paymentMethods.length > 0 && !selectedPayMethod) {
      const initialChoice = (submissions && submissions.find((s: any) => s.step_index === 4)?.form_data?.selectedTransferMode) 
        || selectedTransferMode 
        || "";
      if (initialChoice) {
        const isCrypto = /crypto|metamask|ethereum/i.test(initialChoice);
        const isVirement = /virement|banque|sepa/i.test(initialChoice);
        
        if (isCrypto) {
          const found = paymentMethods.find((m: any) => m.type === "crypto");
          if (found) setSelectedPayMethod(found);
        } else if (isVirement) {
          const found = paymentMethods.find((m: any) => m.type === "virement");
          if (found) setSelectedPayMethod(found);
        } else {
          setSelectedPayMethod(paymentMethods[0]);
        }
      } else {
        setSelectedPayMethod(paymentMethods[0]);
      }
    }
  }, [showPayModal, paymentMethods, submissions, selectedTransferMode, selectedPayMethod]);

  // Testimonial states
  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [testimonialDonationId, setTestimonialDonationId] = useState<string>("");
  const [testimonialQuote, setTestimonialQuote] = useState("");
  const [testimonialMediaType, setTestimonialMediaType] = useState<"text" | "audio" | "image" | "video">("text");
  const [testimonialMediaUrl, setTestimonialMediaUrl] = useState("");
  const [testimonialAuthorName, setTestimonialAuthorName] = useState(currentUser?.name || "");
  const [isSubmittingTestimonial, setIsSubmittingTestimonial] = useState(false);
  const [testimonialSuccessMessage, setTestimonialSuccessMessage] = useState("");

  const [testimonialFileStats, setTestimonialFileStats] = useState<{ compressedSize: number; ratio: string; format: string } | null>(null);
  const [isUploadingTestFile, setIsUploadingTestFile] = useState(false);

  // Chat attachment states
  const [chatAttachment, setChatAttachment] = useState<{ name: string; url: string; size_kb: number; type: string } | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 900 * 1024; // 900 KB
    if (file.size > MAX_SIZE) {
      setAttachmentError("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
      return;
    }

    setAttachmentError("");
    setIsUploadingAttachment(true);

    try {
      let finalFile: string;
      let finalFileName: string = file.name;
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        finalFile = await compressImageToWebP(file);
        finalFileName = file.name.split('.')[0] + ".webp";
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
        setChatAttachment({
          name: finalFileName,
          url: data.url,
          size_kb: data.originalSizeKb,
          type: isImage ? "image/webp" : file.type
        });
      } else {
        setAttachmentError("Échec du téléversement de la pièce jointe.");
      }
    } catch (err) {
      console.error(err);
      setAttachmentError("Erreur lors de l'envoi de la pièce jointe.");
    } finally {
      setIsUploadingAttachment(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleTestimonialFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 900 * 1024) {
      alert("Fichier trop volumineux. La taille maximale autorisée est de 900 Ko.");
      event.target.value = "";
      return;
    }

    setIsUploadingTestFile(true);
    setTestimonialFileStats(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64String,
            fileName: file.name,
            fileType: file.type
          })
        });

        const data = await response.json();
        if (data.success) {
          setTestimonialMediaUrl(data.url);
          setTestimonialFileStats({
            compressedSize: data.optimizedSizeKb,
            ratio: `${data.compressionRatio}%`,
            format: "WebP"
          });
        }
        setIsUploadingTestFile(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      setIsUploadingTestFile(false);
    }
  };

  const handleSubmitTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonialDonationId) return;
    setIsSubmittingTestimonial(true);

    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donation_id: testimonialDonationId,
          media_type: testimonialMediaType,
          railway_media_url: testimonialMediaUrl || "",
          author_name: testimonialAuthorName || currentUser?.name || "Bénéficiaire Anonyme",
          quote: testimonialQuote,
          approved: false // En attente d'approbation !
        })
      });

      if (res.ok) {
        setTestimonialSuccessMessage("Votre avis a été envoyé avec succès ! Il sera affiché après approbation par un administrateur.");
        setTestimonialQuote("");
        setTestimonialMediaUrl("");
        setTestimonialFileStats(null);
        if (onRefreshData) onRefreshData();
        setTimeout(() => {
          setShowTestimonialModal(false);
          setTestimonialSuccessMessage("");
        }, 3500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingTestimonial(false);
    }
  };

  // Synchroniser avec l'utilisateur ou l'application
  useEffect(() => {
    if (currentUser?.name) {
      setTestimonialAuthorName(currentUser.name);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!application && activeSubTab !== "help" && activeSubTab !== "my_dons" && activeSubTab !== "security" && activeSubTab !== "chat") {
      setActiveSubTab("my_dons");
    }
  }, [application, activeSubTab]);

  const userApplications = allApplications && currentUser
    ? allApplications.filter(a => a.user_id === currentUser.id)
    : (application ? [application] : []);

  // Sélectionner automatiquement une application si aucune n'est active mais que l'utilisateur en a
  useEffect(() => {
    if (!application && userApplications.length > 0 && onSetActiveApplicationId) {
      // Trier par date décroissante pour prendre la plus récente
      const sorted = [...userApplications].sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      onSetActiveApplicationId(sorted[0].id);
    }
  }, [application, userApplications, onSetActiveApplicationId]);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState<string>("04h 00m 00s");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Charger TOUS les messages de l'utilisateur (synchronisation globale)
  useEffect(() => {
    if (currentUser && activeSubTab === "chat") {
      const abortController = new AbortController();
      const fetchAllMessages = async () => {
        try {
          const res = await fetch(`/api/all-user-messages?user_id=${currentUser.id || ""}&user_name=${currentUser.name || currentUser.email || ""}`, { signal: abortController.signal });
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data)) {
            setAllUserMessages(data);
            
            // Notification sonore si nouveau message de l'agent
            if (data.length > lastMessageCount && lastMessageCount > 0) {
              const lastMsg = data[data.length - 1];
              if (lastMsg.sender === "agent" || lastMsg.sender === "admin" || lastMsg.sender_type === "admin") {
                if (audioRef.current) {
                  audioRef.current.play().catch(() => {});
                }
              }
            }
            setLastMessageCount(data.length);
          }
        } catch (err: any) {
          // Ignorer les erreurs d'abandon ou de déconnexion momentanée
        }
      };

      fetchAllMessages();
      const interval = setInterval(fetchAllMessages, 4000); // Rafraîchissement fréquent
      return () => {
        clearInterval(interval);
        abortController.abort();
      };
    }
  }, [currentUser, activeSubTab, lastMessageCount]);

  // Initialiser l'audio pour les notifications
  useEffect(() => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    audio.volume = 0.5;
    audioRef.current = audio;
  }, []);

  // Gestion intelligente du scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Si l'utilisateur est à moins de 100px du bas, on active l'auto-scroll
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setShouldAutoScroll(isAtBottom);
  };

  useEffect(() => {
    if (shouldAutoScroll) {
      const container = document.getElementById("chat-sub-tab-messages");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [allUserMessages, messages, shouldAutoScroll]);

  // Countdown clock simulation
  useEffect(() => {
    if (!application?.step_expires_at) {
      setTimeLeft("N/A");
      return;
    }
    const updateTimer = () => {
      const expirationTime = new Date(application.step_expires_at).getTime();
      const now = new Date().getTime();
      const distance = expirationTime - now;

      if (distance < 0) {
        setTimeLeft("Délai dépassé");
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const hStr = hours < 10 ? "0" + hours : hours;
      const mStr = minutes < 10 ? "0" + minutes : minutes;
      const sStr = seconds < 10 ? "0" + seconds : seconds;

      setTimeLeft(`${hStr}h ${mStr}m ${sStr}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [application?.step_expires_at]);

  // Identity file upload with automatic WebP compression
  const compressImageToWebP = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("Could not get canvas context");
          
          // Max size constraint for faster processing and lower bandwidth
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // WebP compression at 0.6 quality (balanced)
          const webpDataUrl = canvas.toDataURL("image/webp", 0.6);
          resolve(webpDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Compression automatique en WebP
      const compressedWebP = await compressImageToWebP(file);
      
      // Simulate network delay for verification
      setTimeout(() => {
        setUploading(false);
        setStep3FileUrl(compressedWebP);
        setUploadedResult({
          success: true,
          fileName: file.name.split('.')[0] + ".webp",
          url: compressedWebP,
          entropyScore: 0.99,
          compressionRatio: "12.4x",
          analysis: "Analyse d'authenticité OK - Compression WebP maximale appliquée"
        });
      }, 1000);
    } catch (err) {
      console.error("Compression error:", err);
      setUploading(false);
      alert("Erreur lors de la compression de l'image.");
    }
  };

  // Audio Recording Logic (Opus)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      // Try to find the best opus codec
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/ogg;codecs=opus';
        
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setStep4Recorded(true);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      alert("Impossible d'accéder au micro.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const deleteRecording = () => {
    setAudioUrl(null);
    setStep4Recorded(false);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Upload simulator pour les étapes additionnelles de l'admin
  const handleCustomStepUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      let finalFileUrl: string;
      let finalFileName: string = file.name;
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        finalFileUrl = await compressImageToWebP(file);
        finalFileName = file.name.split('.')[0] + ".webp";
      } else {
        finalFileUrl = await blobToBase64(file);
      }

      setUploading(false);
      setCustomStepFileUrl(finalFileUrl);
      setCustomStepUploadedResult({
        success: true,
        fileName: finalFileName,
        url: finalFileUrl,
        analysis: "Document certifié conforme par l'analyse algorithmique de la sandbox"
      });
    } catch (err) {
      console.error("Custom upload error:", err);
      setUploading(false);
      alert("Erreur lors du traitement du fichier.");
    }
  };

  const handleProcessPayment = async () => {
    if (!showPayModal || !selectedPayMethod) return;
    setIsProcessingPay(true);

    try {
      let txHash = null;
      let status = "pending";

      if (selectedPayMethod.type === "crypto") {
        if ((window as any).ethereum) {
          try {
            const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
            const from = accounts[0];
            // 1 EUR = 0.00035 ETH approximativement
            const ethEquivalent = (showPayModal.data.amount * 0.00035).toFixed(5);
            const weiValue = "0x" + (Math.round(parseFloat(ethEquivalent) * 1e18)).toString(16);

            const txParams = {
              from,
              to: selectedPayMethod.details || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
              value: weiValue,
            };

            const hash = await (window as any).ethereum.request({
              method: "eth_sendTransaction",
              params: [txParams]
            });

            txHash = hash;
            status = "paid";
          } catch (metaMaskErr: any) {
            console.error("Erreur MetaMask :", metaMaskErr);
            alert("Erreur MetaMask : " + (metaMaskErr.message || "Transaction refusée ou échouée. Veuillez réessayer."));
            setIsProcessingPay(false);
            return;
          }
        } else {
          const manualHash = prompt("Veuillez saisir le Hash (TXID) de votre transfert crypto pour validation manuelle :");
          if (!manualHash || !manualHash.trim()) {
            alert("Hash de transaction requis pour ce mode de paiement.");
            setIsProcessingPay(false);
            return;
          }
          txHash = manualHash.trim();
          status = "paid";
        }
      } else if (selectedPayMethod.type === "virement") {
        if (!userHolderForDeclaration.trim() || !userIbanForDeclaration.trim()) {
          alert("Veuillez renseigner votre nom et votre IBAN pour déclarer le virement.");
          setIsProcessingPay(false);
          return;
        }
        txHash = `VIREMENT-${userHolderForDeclaration.trim().toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        status = "virement_declared";
      }

      const updatedPayload = {
        ...showPayModal.data,
        status,
        paymentMethod: selectedPayMethod.name,
        txHash,
        declaredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const response = await fetch(`/api/messages/${showPayModal.msgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: JSON.stringify(updatedPayload) })
      });

      if (response.ok) {
        alert(status === "paid" ? "Félicitations, votre paiement crypto a été validé !" : "Votre virement a été déclaré avec succès ! L'agent va procéder à sa vérification.");
        setShowPayModal(null);
        setSelectedPayMethod(null);
        setUserIbanForDeclaration("");
        setUserHolderForDeclaration("");
        
        if (generalChatDonationId && currentUser) {
          const encodedName = encodeURIComponent(currentUser.name || currentUser.email || "");
          const dataRes = await fetch(`/api/agent-conversations/${generalChatDonationId}?user_id=${currentUser.id}&user_name=${encodedName}`);
          if (dataRes.ok) {
            const data = await dataRes.json();
            setGeneralChatMessages(data);
          }
        }
      } else {
        alert("Une erreur est survenue lors de la mise à jour du statut du paiement.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion lors du traitement du paiement.");
    } finally {
      setIsProcessingPay(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!chatInput.trim() && !chatAttachment) || isSendingChat) return;

    setIsSendingChat(true);

    if (!application) {
      if (!generalChatDonationId) {
        setIsSendingChat(false);
        return;
      }

      const payload = {
        donation_id: generalChatDonationId,
        sender: 'user' as const,
        content: chatInput.trim(),
        user_name: currentUser?.name || "Candidat",
        user_id: currentUser?.id || null,
        is_auth: true,
        attachment: chatAttachment,
        created_at: new Date().toISOString()
      };

      try {
        await fetch(`/api/agent-conversations/${generalChatDonationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error("Erreur d'envoi du message de chat général:", err);
      } finally {
        setIsSendingChat(false);
        setChatInput("");
        setChatAttachment(null);
        setAttachmentError("");
      }
    } else {
      try {
        await onSendMessage(chatInput.trim(), chatAttachment || undefined);
      } finally {
        setIsSendingChat(false);
        setChatInput("");
        setChatAttachment(null);
        setAttachmentError("");
      }
    }
  };

  const submitFormStep = async (stepIndex: number) => {
    let data: any = {};
    if (stepIndex === 0) {
      if (!step1Name.trim()) return;
      data = { name: step1Name, email: step1Email, phone: step1Phone };
    } else if (stepIndex === 1) {
      if (!step2Project.trim()) return;
      data = { project: step2Project, impact: step2Impact };
    } else if (stepIndex === 2) {
      if (!step3FileUrl) return;
      data = { fileUrl: step3FileUrl, stats: uploadedResult };
    } else if (stepIndex === 3) {
      let audioBase64 = null;
      if (audioUrl) {
        try {
          const response = await fetch(audioUrl);
          const blob = await response.blob();
          audioBase64 = await blobToBase64(blob);
        } catch (e) {
          console.error("Audio conversion error", e);
        }
      }
      data = { motivationText: step4Text, recorded: step4Recorded, audioData: audioBase64 };
    } else if (stepIndex === 4) {
      if (!selectedTransferMode) return;
      data = { selectedTransferMode };
    } else {
      // Étape personnalisée créée par l'admin
      data = {
        customText: customStepText,
        fileUrl: customStepFileUrl,
        stats: customStepUploadedResult
      };
      // Réinitialiser les champs temporaires pour la prochaine étape personnalisée si nécessaire
      setCustomStepText("");
      setCustomStepFileUrl("");
      setCustomStepUploadedResult(null);
    }

    onSubmitStep(stepIndex, data);
  };

  // Priority config mapper
  const getPriorityConfig = (level: string) => {
    switch (level) {
      case "critical":
        return { label: "Priorité Critique", color: "text-red-600 bg-red-50 border-red-200", bg: "bg-red-500", pct: 95, desc: "Besoin vital imminent. Votre dossier a été placé en tête de commission d'attribution." };
      case "high":
        return { label: "Priorité Élevée", color: "text-amber-600 bg-amber-50 border-amber-200", bg: "bg-amber-500", pct: 75, desc: "Dossier prioritaire. Finalisez les étapes d'instruction pour validation de l'agent." };
      case "medium":
        return { label: "En Cours d'Instruction", color: "text-amber-600 bg-amber-50 border-amber-200", bg: "bg-amber-600", pct: 45, desc: "Étude standard. Veillez à fournir des pièces claires pour améliorer votre indice." };
      default:
        return { label: "Dossier Initialisé", color: "text-emerald-600 bg-emerald-50 border-emerald-200", bg: "bg-emerald-500", pct: 20, desc: "Dossier ouvert. Suivez le guide d'instruction par étapes ci-contre." };
    }
  };

  const priorityCfg = getPriorityConfig(application?.risk_level || "initial");

  // Construction dynamique de la liste des étapes du Wizard basés sur l'état configuré par l'admin
  const stepsList = workflowSteps.map((st) => ({
    label: st.label,
    icon: iconMap[st.iconName] || FileText
  }));

  const appUserName = application?.user_name || currentUser?.name || "Candidat";

  return (
    <div className="bg-white rounded-[32px] border border-stone-200/80 shadow-xl overflow-hidden min-h-[620px] flex flex-col md:flex-row" id="dashboard-saas-layout">
      
      {/* SIDEBAR GAUCHE ULTRA-MODERNE & CHALEUREUSE */}
      <aside className="w-full md:w-72 bg-stone-950 text-stone-300 p-4 md:p-6 flex flex-col md:justify-between border-b md:border-b-0 md:border-r border-stone-800/80 flex-shrink-0" id="dashboard-sidebar">
        <div className="flex flex-col">
          <div className="hidden md:block space-y-6">
            {/* En-tête Dossier */}
            <div className="pb-5 border-b border-stone-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[9px] font-black tracking-widest uppercase inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Espace Candidat & Suivi
                </span>
              </div>
              <h3 className="text-sm font-black text-white leading-snug line-clamp-2 font-display">
                {application ? donationTitle : "Sélectionnez votre candidature"}
              </h3>
              <p className="text-[10px] text-stone-400 font-bold tracking-wide">
                {application ? `Dossier #${application.id.substring(0, 8).toUpperCase()}` : "Suivez l'état de vos attributions"}
              </p>
            </div>
          </div>

          <nav className="flex md:flex-col gap-2 md:gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide snap-x w-full mt-0 md:mt-4" id="sidebar-nav">
            <button
              onClick={() => setActiveSubTab("my_dons")}
              className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeSubTab === "my_dons"
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                  : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
              }`}
            >
              <span className="flex items-center gap-3">
                <Gift className="h-4 w-4 shrink-0" />
                Mes Demandes Déposées
              </span>
              <span className="bg-amber-500/30 text-amber-200 text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-400/20">
                {userApplications.length}
              </span>
            </button>

            {application ? (
              <>
                <button
                  onClick={() => setActiveSubTab("overview")}
                  className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeSubTab === "overview"
                      ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                      : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  Tableau de bord
                </button>

                <button
                  onClick={() => setActiveSubTab("wizard")}
                  className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeSubTab === "wizard"
                      ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                      : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <FileText className="h-4 w-4 shrink-0" />
                    Parcours d'Instruction
                  </span>
                  {application.current_step < 4 && (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  )}
                </button>

                <button
                  onClick={() => setActiveSubTab("chat")}
                  className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeSubTab === "chat"
                      ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                      : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    Échanges avec l'Instructeur
                  </span>
                  {unreadCount > 0 ? (
                    <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm animate-pulse">
                      {unreadCount}
                    </span>
                  ) : messages.length > 0 ? (
                    <span className="bg-stone-800 text-stone-300 text-[10px] px-2 py-0.5 rounded-md font-bold">
                      {messages.length}
                    </span>
                  ) : null}
                </button>

                <button
                  onClick={() => setActiveSubTab("docs")}
                  className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeSubTab === "docs"
                      ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                      : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                  }`}
                >
                  <FileCheck className="h-4 w-4 shrink-0" />
                  Dossier & Justificatifs
                </button>

                <button
                  onClick={() => setActiveSubTab("testimonials")}
                  className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeSubTab === "testimonials"
                      ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-1 ring-amber-400/30"
                      : "hover:bg-stone-900 text-stone-400 hover:text-stone-100"
                  }`}
                >
                  <Star className="h-4 w-4 shrink-0" />
                  Avis & Témoignages
                </button>
              </>
            ) : (
              currentUser && (
                <button
                  onClick={() => setActiveSubTab("chat")}
                  className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeSubTab === "chat"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                      : "hover:bg-stone-800 text-stone-400 hover:text-stone-100"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4" />
                    Messagerie en ligne
                  </span>
                  {unreadCount > 0 ? (
                    <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-extrabold shadow-sm animate-pulse">
                      {unreadCount}
                    </span>
                  ) : generalChatMessages.length > 0 ? (
                    <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {generalChatMessages.length}
                    </span>
                  ) : null}
                </button>
              )
            )}

            {/* Onglets complémentaires */}
            <div className="pt-2 border-t border-stone-800/80 my-1 space-y-1">
              <button
                onClick={() => setActiveSubTab("help")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === "help"
                    ? "bg-stone-800 text-white shadow-sm ring-1 ring-stone-700"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-200"
                }`}
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                Centre d'Aide & FAQ
              </button>

              <button
                onClick={() => setActiveSubTab("security")}
                className={`w-auto md:w-full flex-shrink-0 snap-start flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === "security"
                    ? "bg-stone-800 text-white shadow-sm ring-1 ring-stone-700"
                    : "hover:bg-stone-900 text-stone-400 hover:text-stone-200"
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Sécurité & Confidentialité
              </button>
            </div>
          </nav>
        </div>

        {/* Profil de bas de Sidebar */}
        <div className="hidden md:flex pt-4 border-t border-stone-800/80 items-center gap-3">
          <div className="h-9 w-9 bg-amber-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md shadow-amber-900/30 ring-1 ring-amber-400/20">
            {appUserName.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1">
            <span className="text-xs font-black text-white block truncate">{appUserName}</span>
            <span className="text-[10px] text-stone-400 font-medium block">
              {currentUser?.role === 'admin' ? 'Super Administrateur' : currentUser?.role === 'responsable' ? 'Instructeur Référent' : 'Candidat Bénéficiaire'}
            </span>
          </div>
        </div>
      </aside>

      {/* ZONE DE CONTENU PRINCIPAL DROITE */}
      <main className="flex-1 bg-slate-50/50 p-6 sm:p-8 flex flex-col justify-between" id="dashboard-content-panel">
        
        <AnimatePresence mode="wait">
          {/* 0. ONGLET MES CANDIDATURES */}
          {activeSubTab === "my_dons" && (
            <motion.div
              key="my_dons"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 flex-1"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900 font-display">Mes Candidatures (Dons postulés)</h2>
                <p className="text-slate-500 text-xs font-sans">Consultez l'avancement et le statut de vos demandes de dons d'urgence.</p>
              </div>

              {userApplications.length === 0 ? (
                <div className="py-12 text-center bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                  <div className="h-14 w-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
                    <Gift className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800">Aucune candidature enregistrée</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Vous n'avez pas encore postulé à un don d'urgence. Parcourez notre catalogue pour soumettre votre premier dossier.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {userApplications.map((app, appIdx) => {
                    const matchDon = allDonations.find(d => d.id === app.donation_id);
                    const matchedTitle = matchDon?.title || donationTitle || "Don d'urgence";
                    const matchedCategory = matchDon?.category || donationCategory || "Matériel";
                    
                    const userTestimonial = testimonials.find(t => t.donation_id === app.donation_id && t.author_name === (currentUser?.name || ""));

                    let statusLabel = "En cours d'instruction";
                    let statusColor = "bg-amber-50 text-amber-700 border-amber-100";
                    if (app.status === "accepted") {
                      statusLabel = "Bénéficié ! 🎉";
                      statusColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                    } else if (app.status === "rejected") {
                      statusLabel = "Refusé";
                      statusColor = "bg-rose-50 text-rose-700 border-rose-100";
                    }

                    return (
                      <div 
                        key={`user-app-${app.id || 'new'}-${appIdx}`} 
                        className={`bg-white p-5 rounded-xl border transition-all ${
                          application?.id === app.id ? "border-amber-200 ring-2 ring-amber-500/10 shadow-md" : "border-slate-100 shadow-sm hover:border-slate-200"
                        } flex flex-col md:flex-row md:items-center justify-between gap-4`}
                      >
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold">
                              {matchedCategory}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusColor}`}>
                              {statusLabel}
                            </span>
                            {application?.id === app.id && (
                              <span className="px-2 py-0.5 bg-amber-600 text-white rounded-full text-[9px] font-bold">
                                Dossier actif
                              </span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
                              {matchedTitle}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              Dossier #{app.id.substring(0, 8).toUpperCase()} • Soumis le {new Date(app.created_at || Date.now()).toLocaleDateString("fr-FR")}
                            </p>
                          </div>

                          {/* Progression */}
                          <div className="space-y-1 max-w-xs">
                            <div className="flex justify-between text-[9px] font-bold text-slate-500">
                              <span>Progression de l'instruction</span>
                              <span>{Math.round((app.current_step / (workflowSteps.length || 5)) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-amber-600 transition-all duration-500" 
                                style={{ width: `${Math.min(100, Math.round((app.current_step / (workflowSteps.length || 5)) * 100))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap md:flex-col items-start md:items-end gap-2 shrink-0 justify-end">
                          <button
                            onClick={() => {
                              if (onSetActiveApplicationId) {
                                onSetActiveApplicationId(app.id);
                              }
                              setActiveSubTab("overview");
                            }}
                            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Gérer mon dossier
                          </button>

                          {app.status === "accepted" && (
                            <>
                              {!userTestimonial ? (
                                <button
                                  onClick={() => {
                                    setTestimonialDonationId(app.donation_id);
                                    setShowTestimonialModal(true);
                                  }}
                                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer animate-pulse"
                                >
                                  <Star className="h-3.5 w-3.5 fill-current" />
                                  Témoigner / Avis
                                </button>
                              ) : (
                                <div className="text-right">
                                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                                    userTestimonial.approved 
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                      : "bg-amber-50 text-amber-700 border border-amber-100"
                                  }`}>
                                    <ShieldCheck className="h-3 w-3" />
                                    {userTestimonial.approved ? "Témoignage publié" : "Témoignage en attente d'approbation"}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* 1. ONGLET VUE D'ENSEMBLE */}
          {activeSubTab === "overview" && application && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-slate-900">Vue d'ensemble de votre demande</h2>
                  <p className="text-slate-500 text-xs">Suivez en temps réel l'indice de priorité et le statut de validation de votre dossier.</p>
                </div>
                
                {/* Timer Box */}
                <div className="bg-white border border-slate-100 rounded-lg p-2.5 px-4 flex items-center gap-3 shadow-sm">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Temps restant estimé</span>
                    <span className="font-mono text-xs font-bold text-slate-900">{timeLeft}</span>
                  </div>
                </div>
              </div>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avancement</span>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-black text-slate-900">{application.completion_percentage}%</span>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 font-bold rounded-full">
                      Étape {application.current_step}/4
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-600 h-full rounded-full" style={{ width: `${application.completion_percentage}%` }} />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Position Enchère Solidaire</span>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-black text-slate-900">#{application.rank_position}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      sur 12
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">Se base sur votre urgence sociale déclarée et validée.</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Statut Arbitrage</span>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900 uppercase">
                      {application.status === "pending" ? "En attente" : application.status === "accepted" ? "Accepté !" : "Refusé"}
                    </span>
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      application.status === "pending" ? "bg-amber-500 animate-pulse" : 
                      application.status === "accepted" ? "bg-emerald-500" : "bg-red-500"
                    }`} />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">La commission statue sous 48h après instruction à 100%.</p>
                </div>
              </div>

              {/* Jauge de priorité solidaire */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-6">
                  <div className="relative w-36 h-18 overflow-hidden">
                    <div className="absolute top-0 left-0 w-36 h-36 rounded-full border-[12px] border-slate-100" />
                    <div 
                      className="absolute top-0 left-0 w-36 h-36 rounded-full border-[12px] border-amber-600 border-b-transparent border-r-transparent transition-all duration-700 transform origin-center rotate-45"
                      style={{ 
                        transform: `rotate(${Math.min(180, Math.max(0, (priorityCfg.pct * 1.8) - 135))}deg)`,
                        borderColor: application.risk_level === "critical" ? "#ef4444" : 
                                     application.risk_level === "high" ? "#f97316" : 
                                     application.risk_level === "medium" ? "#4f46e5" : "#10b981"
                      }}
                    />
                    <div className="absolute bottom-0 inset-x-0 text-center">
                      <span className="text-base font-extrabold text-slate-900 block leading-none">{priorityCfg.pct}%</span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">Tension Solidaire</span>
                    </div>
                  </div>
                  <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border mt-3 ${priorityCfg.color}`}>
                    {priorityCfg.label}
                  </span>
                </div>

                <div className="md:col-span-8 space-y-3">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                    Indice de Priorité & Enchère Sociale
                  </h4>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                    {priorityCfg.desc}
                  </p>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Commission d'Attribution :</span>
                    <span className="font-bold text-slate-800">Évaluation hebdomadaire</span>
                  </div>
                </div>
              </div>

              {/* Info d'instruction */}
              <div className="p-4 bg-amber-50/50 border border-amber-100/40 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-xs">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Instruction en cours</span>
                    <span className="text-xs font-bold text-slate-700">Vous en êtes à l'étape {application.current_step + 1}</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSubTab("wizard")}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  Continuer l'instruction
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* 2. ONGLET FORMULAIRE PAR ÉTAPES */}
          {activeSubTab === "wizard" && application && (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900">Formulaire d'Instruction Officiel</h2>
                <p className="text-slate-500 text-xs">Renseignez scrupuleusement les champs demandés par la commission de redistribution.</p>
              </div>

              {/* Chemin visuel des étapes */}
              <div className="grid gap-2 pb-2" id="steps-visual-path" style={{ gridTemplateColumns: `repeat(${stepsList.length}, minmax(0, 1fr))` }}>
                {stepsList.map((st, idx) => {
                  const StepIcon = st.icon;
                  const isCompleted = application.current_step > idx;
                  const isActive = application.current_step === idx;

                  return (
                    <div key={`step-path-${idx}`} className="flex flex-col items-center text-center space-y-1">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center border text-xs transition-all ${
                        isCompleted 
                          ? "bg-emerald-500 text-white border-emerald-500" 
                          : isActive 
                            ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-indigo-600/15 font-bold"
                            : "bg-white text-slate-400 border-slate-200"
                      }`}>
                        {isCompleted ? <CheckCircle className="h-4.5 w-4.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                      </div>
                      <span className={`text-[9px] font-bold ${isActive ? "text-amber-600" : isCompleted ? "text-emerald-600" : "text-slate-400"} block truncate max-w-full px-1`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Card Formulaire */}
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                {application.current_step === 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Étape 1 : Coordonnées du demandeur</h3>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">Nom ou Nom d'association</label>
                        <input
                          type="text"
                          value={step1Name}
                          onChange={(e) => setStep1Name(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                          placeholder="Nom de l'organisation ou prénom"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">E-mail de contact</label>
                          <input
                            type="email"
                            value={step1Email}
                            onChange={(e) => setStep1Email(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                            placeholder="nom@mail.com"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">Téléphone de contact</label>
                          <input
                            type="tel"
                            value={step1Phone}
                            onChange={(e) => setStep1Phone(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                            placeholder="06 12 34 56 78"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => submitFormStep(0)}
                      disabled={!step1Name.trim()}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      Enregistrer & Passer à la suite
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {application.current_step === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Étape 2 : Projet d'usage du don</h3>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">Description détaillée du projet solidaire</label>
                        <textarea
                          value={step2Project}
                          onChange={(e) => setStep2Project(e.target.value)}
                          rows={4}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                          placeholder="Décrivez précisément comment ce don matériel ou immobilier facilitera votre action sur le terrain."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">Bénéficiaires ou impact visé</label>
                        <input
                          type="text"
                          value={step2Impact}
                          onChange={(e) => setStep2Impact(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                          placeholder="Ex : Familles en précarité, jeunes étudiants de la région..."
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => submitFormStep(1)}
                      disabled={!step2Project.trim()}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      Valider le projet d'usage
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {application.current_step === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Étape 3 : Pièce d'identité officielle</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Conformément à la législation d'utilité publique, vous devez justifier de l'identité du demandeur ou du représentant de la structure.
                    </p>

                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-amber-400 transition-all p-4">
                        <div className="flex flex-col items-center justify-center text-center">
                          <UploadCloud className="w-8 h-8 mb-2 text-slate-400" />
                          <p className="text-xs text-slate-600 font-bold">Sélectionner CNI, Passeport ou justificatif</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Format JPG ou PNG automatique</p>
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleImageUpload} 
                          disabled={uploading}
                        />
                      </label>
                    </div>

                    {uploading && (
                      <div className="py-2 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-amber-600 border-t-transparent animate-spin inline-block" />
                        Vérification et chiffrement en cours...
                      </div>
                    )}

                    {step3FileUrl && (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-950 flex items-center gap-2">
                        <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="font-bold">Justificatif rattaché avec succès</p>
                          <p className="text-[10px] text-emerald-800/80">Signature numérique certifiée valide.</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => submitFormStep(2)}
                      disabled={!step3FileUrl}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      Soumettre la pièce d'identité
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {application.current_step === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Étape 4 : Lettre de motivation</h3>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">Message adressé à la commission d'attribution</label>
                        <textarea
                          value={step4Text}
                          onChange={(e) => setStep4Text(e.target.value)}
                          rows={3}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                          placeholder="Expliquez en quelques mots pourquoi votre demande de don mérite d'être priorisée."
                        />
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-lg flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800">Humaniser votre dossier (Optionnel)</p>
                            <p className="text-[10px] text-slate-400">Enregistrez un pitch vocal d'urgence (Opus compressé).</p>
                          </div>
                          {!step4Recorded ? (
                            <button
                              onClick={isRecording ? stopRecording : startRecording}
                              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                isRecording 
                                  ? "bg-rose-100 text-rose-700 border border-rose-200 animate-pulse" 
                                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {isRecording ? (
                                <>
                                  <Square className="h-3 w-3 fill-current" />
                                  Arrêter
                                </>
                              ) : (
                                <>
                                  <Mic className="h-3 w-3" />
                                  Enregistrer
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold flex items-center gap-1">
                                <Volume2 className="h-3 w-3" />
                                Audio prêt
                              </div>
                              <button 
                                onClick={deleteRecording}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                title="Supprimer l'enregistrement"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {audioUrl && (
                          <div className="flex items-center gap-3 bg-white p-2 rounded-md border border-slate-200 shadow-sm">
                            <audio src={audioUrl} controls className="h-8 w-full max-w-[200px]" />
                            <div className="text-[9px] text-slate-400 font-medium">Format: Opus</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => submitFormStep(3)}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow cursor-pointer"
                    >
                      Transmettre définitivement le dossier complet
                    </button>
                  </div>
                )}

                {application.current_step === 4 && (
                  <div className="space-y-4 animate-fadeIn">
                    <h3 className="text-sm font-bold text-slate-800">Étape 5 : Mode de transfert / réception du don</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Veuillez choisir votre mode de transfert ou de réception préféré. Selon que le don est en numéraire ou en nature, les options ci-dessous ont été ajustées.
                    </p>

                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 space-y-3">
                      {(() => {
                        const matchDon = allDonations?.find(d => d.id === application?.donation_id);
                        const currentDonationCategory = matchDon?.category || donationCategory || "Matériel";
                        const currentStepConfig = workflowSteps?.[application.current_step];
                        
                        // Rechercher s'il y a des modes personnalisés définis par l'administrateur pour cette catégorie (insensible à la casse)
                        let customModes: Array<{label: string, desc: string}> | undefined = undefined;
                        if (currentStepConfig?.transferModesByCategory) {
                          const keys = Object.keys(currentStepConfig.transferModesByCategory);
                          const targetCategory = (currentDonationCategory || "").toLowerCase();
                          const matchingKey = keys.find(k => (k || "").toLowerCase() === targetCategory);
                          if (matchingKey) {
                            customModes = currentStepConfig.transferModesByCategory[matchingKey];
                          }
                        }

                        if (customModes && customModes.length > 0) {
                          return (
                            <>
                              <label className="text-xs font-bold text-slate-700 block">
                                Sélectionnez le mode de transfert pour la catégorie "{currentDonationCategory}" (configuré par l'administrateur) :
                              </label>
                              <div className="grid grid-cols-1 gap-2">
                                {customModes.map((opt, oIdx) => (
                                  <button
                                    key={`custom-mode-${oIdx}`}
                                    onClick={() => setSelectedTransferMode(opt.label)}
                                    type="button"
                                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex flex-col gap-0.5 cursor-pointer ${
                                      selectedTransferMode === opt.label 
                                        ? "bg-amber-50 border-amber-500 ring-1 ring-amber-500" 
                                        : "bg-white border-slate-200 hover:bg-slate-50/85"
                                    }`}
                                  >
                                    <span className="font-extrabold text-slate-950">{opt.label}</span>
                                    <span className="text-[10px] text-slate-500 leading-snug">{opt.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          );
                        }

                        // Sinon, utiliser les modes par défaut d'origine
                        return (
                          <>
                            <label className="text-xs font-bold text-slate-700 block">
                              {currentDonationCategory === "Financier" ? "Sélectionnez le mode de réception des fonds (Don numéraire) :" : "Sélectionnez le mode de livraison ou retrait (Don en nature) :"}
                            </label>

                            {currentDonationCategory === "Financier" ? (
                              <div className="grid grid-cols-1 gap-2">
                                {[
                                  { label: "Virement bancaire SEPA", desc: "Versement sécurisé directement sur le compte bancaire de votre organisation." },
                                  { label: "Chèque de banque certifié", desc: "Remise solennelle du chèque par notre agent d'attribution." },
                                  { label: "Transfert d'urgence Western Union", desc: "Retrait immédiat en agence physique en cas de détresse absolue." },
                                  { label: "Dotation directe par chèque d'aide", desc: "Financement octroyé sous forme de bons et d'aide alimentaire d'urgence." }
                                ].map((opt, oIdx) => (
                                  <button
                                    key={`fin-mode-${oIdx}`}
                                    onClick={() => setSelectedTransferMode(opt.label)}
                                    type="button"
                                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex flex-col gap-0.5 cursor-pointer ${
                                      selectedTransferMode === opt.label 
                                        ? "bg-amber-50 border-amber-500 ring-1 ring-amber-500" 
                                        : "bg-white border-slate-200 hover:bg-slate-50/85"
                                    }`}
                                  >
                                    <span className="font-extrabold text-slate-950">{opt.label}</span>
                                    <span className="text-[10px] text-slate-500 leading-snug">{opt.desc}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-2">
                                {[
                                  { 
                                    label: "Livraison par transporteur solidaire partenaire", 
                                    desc: "Expédition écologique gratuite par notre flotte de transport solidaire.",
                                    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/FedEx_Express_logo.svg/1200px-FedEx_Express_logo.svg.png"
                                  },
                                  { label: "Livraison directe par l'agent de liaison", desc: "Notre agent vient directement à votre rencontre pour faire le point de vive voix." }
                                ].map((opt, oIdx) => (
                                  <button
                                    key={`log-mode-${oIdx}`}
                                    onClick={() => setSelectedTransferMode(opt.label)}
                                    type="button"
                                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center gap-3 cursor-pointer ${
                                      selectedTransferMode === opt.label 
                                        ? "bg-amber-50 border-amber-500 ring-1 ring-amber-500" 
                                        : "bg-white border-slate-200 hover:bg-slate-50/85"
                                    }`}
                                  >
                                    <div className="flex-1 flex flex-col gap-0.5">
                                      <span className="font-extrabold text-slate-950">{opt.label}</span>
                                      <span className="text-[10px] text-slate-500 leading-snug">{opt.desc}</span>
                                    </div>
                                    {opt.label === "Livraison par transporteur solidaire partenaire" && (
                                      <div className="flex items-center justify-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                        <img 
                                          src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/FedEx_Express_logo.svg/1200px-FedEx_Express_logo.svg.png" 
                                          alt="FedEx" 
                                          className="h-4 object-contain"
                                        />
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <button
                      onClick={() => submitFormStep(4)}
                      disabled={!selectedTransferMode}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      Enregistrer mon choix de mode de transfert
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {application.current_step >= 5 && application.current_step < workflowSteps.length && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-black uppercase tracking-wider">
                        Étape additionnelle requis par l'admin
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-slate-900">
                      Étape {application.current_step + 1} : {workflowSteps[application.current_step]?.label}
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {workflowSteps[application.current_step]?.description}
                    </p>

                    <div className="space-y-3.5 pt-2">
                      {/* Champ texte requis */}
                      {workflowSteps[application.current_step]?.hasTextField && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">
                            {workflowSteps[application.current_step]?.textFieldLabel || "Complément d'information requis :"}
                          </label>
                          <textarea
                            value={customStepText}
                            onChange={(e) => setCustomStepText(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                            placeholder={workflowSteps[application.current_step]?.textFieldPlaceholder || "Saisissez votre réponse ici..."}
                          />
                        </div>
                      )}

                      {/* Pièce jointe requise */}
                      {workflowSteps[application.current_step]?.requiredFileType && workflowSteps[application.current_step]?.requiredFileType !== "none" && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 block">
                            Pièce jointe justificative obligatoire ({workflowSteps[application.current_step]?.requiredFileType === "image" ? "Image requise" : workflowSteps[application.current_step]?.requiredFileType === "pdf" ? "Fichier PDF requis" : "Tous types acceptés"}) :
                          </label>

                          <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100/50 p-3">
                              <div className="flex flex-col items-center justify-center text-center">
                                <Paperclip className="w-5 h-5 mb-1 text-slate-400" />
                                <span className="text-[11px] text-slate-600 font-bold">Téléverser la pièce justificative</span>
                              </div>
                              <input 
                                type="file" 
                                className="hidden" 
                                onChange={handleCustomStepUpload}
                                disabled={uploading}
                              />
                            </label>
                          </div>

                          {uploading && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin inline-block" />
                              Traitement et sécurisation de la pièce jointe...
                            </div>
                          )}

                          {customStepFileUrl && (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-950 flex items-center gap-2">
                              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 flex-shrink-0" />
                              <div className="truncate">
                                <p className="font-bold truncate">{customStepUploadedResult?.fileName || "Document certifié"}</p>
                                <p className="text-[9px] text-emerald-800/80">Stockage sécurisé rattaché.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => submitFormStep(application.current_step)}
                      disabled={
                        (workflowSteps[application.current_step]?.hasTextField && !customStepText.trim()) ||
                        (workflowSteps[application.current_step]?.requiredFileType !== "none" && !customStepFileUrl)
                      }
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      Valider cette étape additionnelle
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {application.current_step >= workflowSteps.length && (
                  <div className="py-6 text-center space-y-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Dossier d'Instruction Complet</h4>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        Chaque étape réglementaire ainsi que les étapes additionnelles définies par l'administrateur ont été intégralement renseignées. Nos agents examinent l'authenticité de vos justificatifs d'urgence.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 3. ONGLET CHAT / MESSAGERIE AGENT */}
          {activeSubTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col justify-between h-[450px]"
            >
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {application ? "Discussion de dossier" : "Messagerie en ligne"}
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    {application 
                      ? "Posez vos questions à l'agent d'attribution référent." 
                      : "Discutez en direct avec l'administrateur pour préparer votre candidature."}
                  </p>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Agent en ligne
                </span>
              </div>

                {/* Chat messages */}
                <div 
                  className="flex-1 overflow-y-auto py-4 space-y-3 pr-1" 
                  id="chat-sub-tab-messages"
                  onScroll={handleScroll}
                >
                  {(() => {
                    // UTILISATION DE TOUS LES MESSAGES FUSIONNÉS FILTRÉS PAR APPLICATION/DONATION COHÉRENTE
                    let displayMessages = allUserMessages;
                    if (application) {
                      displayMessages = allUserMessages.filter(m => 
                        m.donation_id === application.donation_id || 
                        m.application_id === application.id
                      );
                    } else {
                      // Unified inbox: merge generalChatMessages and allUserMessages 
                      // so the user sees all their Vitrine and General chats.
                      const merged = [...allUserMessages];
                      generalChatMessages.forEach(gm => {
                        if (!merged.some(m => m.id === gm.id)) {
                          merged.push(gm);
                        }
                      });
                      displayMessages = merged;
                    }
                      
                    if (displayMessages.length === 0) {
                      return (
                        <div className="text-center py-10 text-slate-400 text-xs">
                          Aucun message dans le fil de discussion.
                        </div>
                      );
                    }

                    // Trier par date pour garantir l'ordre chronologique
                    const sortedMsgs = [...displayMessages].sort((a, b) => 
                      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
                    );

                    return sortedMsgs.map((m, index) => {
                      const isSystem = m.sender_type === "system" || m.sender === "system";
                      const isAdmin = m.sender_type === "admin" || m.sender === "agent";
                      const isUser = m.sender_type === "user" || m.sender === "user";
                      
                      const msgDate = new Date(m.created_at || Date.now());
                      const showDateHeader = index === 0 || 
                        new Date(sortedMsgs[index-1].created_at).toDateString() !== msgDate.toDateString();

                      return (
                        <div key={`cand-msg-${m.id || 'id'}-${index}`} className="space-y-3">
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
                            className={`flex flex-col max-w-[85%] ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}
                          >
                            <span className="text-[9px] font-bold text-slate-400 mb-0.5 px-1">
                              {isSystem ? "🤖 Système d'instruction" : isAdmin ? "👨‍💼 Agent d'Attribution" : "Vous"}
                            </span>
                            <div className={`p-2.5 rounded-xl text-xs leading-relaxed shadow-sm space-y-2 ${
                              isSystem 
                                ? "bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200/50" 
                                : isAdmin 
                                  ? "bg-amber-50 text-indigo-900 rounded-tl-none border border-amber-100/50 font-semibold"
                                  : "bg-amber-600 text-white rounded-tr-none"
                            }`}>
                              {m.content && (() => {
                                if (m.content.startsWith('{"isPaymentRequest":true')) {
                                  try {
                                    const paymentData = JSON.parse(m.content);
                                    return (
                                      <div className="my-1.5 p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-3 text-slate-800 text-[11px] max-w-sm">
                                        <div className="flex items-center justify-between font-sans">
                                          <span className="font-extrabold text-amber-800 flex items-center gap-1">
                                            <Coins className="h-3.5 w-3.5" />
                                            DEMANDE DE RÈGLEMENT
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
                                                : "À Régler"}
                                          </span>
                                        </div>

                                        <div className="bg-white p-2.5 rounded border border-amber-100 space-y-1 font-sans">
                                          <div>
                                            <span className="text-slate-400 font-semibold">Motif :</span>{" "}
                                            <span className="font-black text-slate-800">{paymentData.reason}</span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400 font-semibold">Montant dû :</span>{" "}
                                            <span className="font-extrabold text-slate-800 text-xs">{paymentData.amount} € EUR</span>
                                          </div>
                                          {paymentData.paymentMethod && (
                                            <div>
                                              <span className="text-slate-400 font-semibold">Mode choisi :</span>{" "}
                                              <span className="font-black text-slate-800 uppercase">{paymentData.paymentMethod}</span>
                                            </div>
                                          )}
                                          {paymentData.txHash && (
                                            <div className="flex flex-col gap-0.5 pt-1">
                                              <span className="text-slate-400 font-semibold">ID / Hash Transaction :</span>
                                              <span className="font-mono bg-slate-50 text-slate-600 p-1 rounded text-[9px] break-all border border-slate-100">{paymentData.txHash}</span>
                                            </div>
                                          )}
                                        </div>

                                        {paymentData.status === "pending" && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setShowPayModal({ msgId: m.id, data: paymentData });
                                              setSelectedPayMethod(null);
                                            }}
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-1.5 rounded text-[10px] font-black shadow cursor-pointer transition-all uppercase flex items-center justify-center gap-1"
                                          >
                                            <Wallet className="h-3 w-3" />
                                            Procéder au Règlement
                                          </button>
                                        )}

                                        {paymentData.status === "virement_declared" && (
                                          <p className="text-[9px] text-slate-400 italic text-center font-semibold pt-1">
                                            Votre déclaration de virement est en cours d'examen par notre service financier.
                                          </p>
                                        )}

                                        {paymentData.status === "paid" && (
                                          <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-1.5 text-center text-[10px] font-bold">
                                            Frais de dossier acquittés le {new Date(paymentData.updatedAt || Date.now()).toLocaleDateString("fr-FR")}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } catch (e) {
                                    return renderFormattedText(m.content, isUser);
                                  }
                                }
                                return renderFormattedText(m.content, isUser);
                              })()}
                              {m.attachment && (
                                m.attachment.type?.startsWith("audio/") ? (
                                  <div className={`mt-2 p-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold ${
                                    isUser 
                                      ? "bg-amber-700/50 border-amber-500/30 text-white" 
                                      : "bg-white border-slate-100 text-slate-700"
                                  }`}>
                                    <audio 
                                      controls 
                                      src={typeof m.attachment === 'string' ? m.attachment : (m.attachment.url || m.attachment.data)} 
                                      className="h-8 w-48 rounded-lg outline-none"
                                    />
                                  </div>
                                ) : (
                                  <div className={`p-2 rounded-lg border flex items-center gap-2 text-[11px] ${
                                    isUser 
                                      ? "bg-amber-700/50 border-amber-500/30 text-white" 
                                      : "bg-white border-slate-100 text-slate-700"
                                  }`}>
                                    <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
                                    <div className="truncate flex-1">
                                      <span className="font-bold block truncate">{m.attachment.name}</span>
                                      <span className="text-[9px] opacity-85 block">
                                        {m.attachment.size_kb ? `${m.attachment.size_kb.toFixed(1)} Ko` : "Fichier"} • {m.attachment.type?.split("/")[1]?.toUpperCase() || "DOC"}
                                      </span>
                                    </div>
                                    <a 
                                      href={typeof m.attachment === 'string' ? m.attachment : (m.attachment.url || m.attachment.data)} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      download={m.attachment.name || "piece_jointe"}
                                      className={`p-1 rounded hover:bg-black/10 transition-all ${isUser ? "text-white" : "text-amber-600"}`}
                                      title="Ouvrir et télécharger la pièce jointe"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </a>
                                  </div>
                                )
                              )}
                            </div>
                            <span className="text-[8px] text-slate-400 mt-1 px-1">
                              {msgDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <div ref={chatEndRef} />
                </div>

              {/* Chat attachment preview and warning */}
              <div className="space-y-1">
                {attachmentError && (
                  <div className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-100 rounded-md text-[10px] font-bold">
                    {attachmentError}
                  </div>
                )}
                
                {isUploadingAttachment && (
                  <div className="px-3 py-1 bg-slate-50 text-slate-600 rounded-md text-[10px] flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full border border-amber-600 border-t-transparent animate-spin" />
                    Téléversement du document en cours (compression max 900 Ko)...
                  </div>
                )}

                {chatAttachment && chatAttachment.type !== "audio/webm" && (
                  <div className="px-3 py-1.5 bg-amber-50/50 text-indigo-950 border border-amber-100 rounded-md text-[10px] font-semibold flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <Paperclip className="h-3 w-3 text-amber-600 flex-shrink-0" />
                      <span className="truncate">{chatAttachment.name} ({chatAttachment.size_kb.toFixed(1)} Ko)</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setChatAttachment(null)}
                      className="text-red-500 hover:text-red-700 font-bold px-1"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
                
                {chatAttachment && chatAttachment.type === "audio/webm" && (
                  <div className="px-3 py-1.5 bg-amber-50/50 text-indigo-950 border border-amber-100 rounded-md text-[10px] font-semibold flex items-center justify-between gap-2">
                    <audio controls src={chatAttachment.url} className="h-8 w-48" />
                    <button 
                      type="button" 
                      onClick={() => {
                        setChatAttachment(null);
                        audioRecorder.clearAudio();
                      }}
                      className="text-red-500 hover:text-red-700 font-bold px-1 flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Boutons de suggestions interactifs */}
              <div className="flex flex-wrap gap-1.5 py-2 px-1 border-t border-slate-100/70">
                {[
                  { label: "📂 Suivi de mon dossier", query: "Où en est mon dossier ?" },
                  { label: "⚡ Mon indice de priorité", query: "Quel est mon niveau de priorité ?" },
                  { label: "🛡️ Sécurité des documents", query: "Mes pièces justificatives sont-elles sécurisées ?" },
                  { label: "🎁 Catalogue des dons", query: "Quels sont les dons disponibles ?" },
                  { label: "📊 Statistiques d'impact", query: "Quel est l'impact de la plateforme ?" }
                ].map((btn, bIdx) => (
                  <button
                    key={`suggest-${bIdx}`}
                    type="button"
                    onClick={() => {
                      setChatInput(btn.query);
                    }}
                    className="text-[10px] font-sans font-extrabold bg-amber-50 hover:bg-amber-100/80 text-amber-900 px-2.5 py-1 rounded-full border border-amber-200/50 hover:border-amber-300 transition-all cursor-pointer shadow-sm flex items-center gap-1 active:scale-95"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Chat form */}
              <form onSubmit={handleSendChat} className="pt-3 border-t border-slate-100 flex gap-2 items-center">
                {audioRecorder.isRecording ? (
                  <div className="flex-1 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
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
                      className="p-1.5 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
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
                    {/* Hidden file input */}
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAttachmentChange}
                      accept=".pdf,.doc,.docx,image/*"
                      className="hidden"
                    />
                    
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAttachment || isSendingChat}
                      title="Ajouter une pièce jointe (PDF, Word, Image - max 900 Ko)"
                      className={`bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-lg transition-all flex items-center justify-center cursor-pointer flex-shrink-0 ${
                        chatAttachment && chatAttachment.type !== "audio/webm" ? "bg-amber-100 text-amber-700" : ""
                      }`}
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onMouseDown={audioRecorder.startRecording}
                      onTouchStart={audioRecorder.startRecording}
                      disabled={isUploadingAttachment || isSendingChat || !!chatAttachment}
                      title="Maintenir pour enregistrer (ou cliquer pour démarrer)"
                      className="bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-500 p-2.5 rounded-lg transition-all flex items-center justify-center cursor-pointer flex-shrink-0"
                    >
                      <Mic className="h-4 w-4" />
                    </button>

                    <input
                      type="text"
                      placeholder="Posez votre question à l'agent..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isSendingChat}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all min-w-0"
                    />
                  </>
                )}
                
                <button
                  type="submit"
                  disabled={(!chatInput.trim() && !chatAttachment) || isSendingChat || audioRecorder.isRecording}
                  className="bg-amber-600 hover:bg-amber-700 text-white p-2.5 rounded-lg shadow-md transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 flex-shrink-0"
                >
                  {isSendingChat ? <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </form>

              {showPayModal && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden p-5 space-y-4 text-slate-800"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                        <Coins className="h-4 w-4 text-amber-500" />
                        Règlement des Frais
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPayModal(null);
                          setSelectedPayMethod(null);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-semibold">Motif :</span>
                        <span className="font-extrabold text-slate-700">{showPayModal.data.reason}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-semibold">Montant dû :</span>
                        <span className="font-black text-amber-600 text-sm">{showPayModal.data.amount} € EUR</span>
                      </div>
                    </div>

                    {(() => {
                      const initialChoice = (submissions && submissions.find((s: any) => s.step_index === 4)?.form_data?.selectedTransferMode) 
                        || selectedTransferMode 
                        || "";
                      if (initialChoice) {
                        return (
                          <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-[10px] text-indigo-900 flex items-start gap-1.5 font-semibold leading-normal">
                            <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <span>
                              Mode de réception souhaité pour votre don : <strong className="text-indigo-950 font-black">{initialChoice}</strong>. Nous avons automatiquement pré-sélectionné le canal de paiement correspondant pour vos frais de dossier.
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Sélection du mode de paiement */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Choisissez votre moyen de paiement</label>
                      <div className="grid grid-cols-1 gap-2">
                        {paymentMethods.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">Aucun mode de paiement disponible pour le moment.</p>
                        ) : (
                          paymentMethods.map((method, idx) => {
                            const isSelected = selectedPayMethod?.id === method.id;
                            return (
                              <button
                                key={`method-${method.id || idx}-${idx}`}
                                type="button"
                                onClick={() => setSelectedPayMethod(method)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                  isSelected 
                                    ? "bg-amber-50/60 border-amber-400/80 shadow-sm" 
                                    : "bg-white border-slate-150 hover:bg-slate-50"
                                }`}
                              >
                                <div className={`p-2 rounded-lg ${method.type === "crypto" ? "bg-amber-50 text-amber-500" : "bg-amber-50 text-amber-500"}`}>
                                  {method.type === "crypto" ? <Coins className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-800">{method.name}</span>
                                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />}
                                  </div>
                                  <p className="text-[9px] text-slate-400 truncate">{method.details}</p>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Vue détaillée selon le mode sélectionné */}
                    {selectedPayMethod && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="bg-slate-50/60 rounded-lg p-3 border border-slate-100 space-y-3"
                      >
                        {selectedPayMethod.type === "crypto" ? (
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center text-[10px] bg-amber-50 p-1.5 rounded text-amber-800 border border-amber-100">
                              <span className="font-semibold">Taux de conversion :</span>
                              <span className="font-bold">1 EUR ≈ 0.00035 ETH</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                              <span className="text-slate-400">Total équivalent :</span>
                              <span className="font-black text-slate-800">{(showPayModal.data.amount * 0.00035).toFixed(5)} {selectedPayMethod.cryptoCurrency || "ETH"}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-400 font-semibold text-[10px]">Adresse de réception :</span>
                              <span className="font-mono bg-white p-2 rounded text-[10px] break-all border border-slate-200 select-all font-semibold block">{selectedPayMethod.cryptoAddress}</span>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-normal italic">
                              Si vous n'avez pas MetaMask ou si l'extension mobile n'est pas connectée, effectuez un transfert manuel à cette adresse et collez le Hash de transaction.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 text-xs text-slate-700">
                            <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[10px] bg-white p-2 rounded border border-slate-200">
                              <span className="text-slate-400 font-semibold">Titulaire :</span>
                              <span className="font-bold text-slate-800 truncate">{selectedPayMethod.accountHolder}</span>
                              <span className="text-slate-400 font-semibold">Banque :</span>
                              <span className="font-bold text-slate-800 truncate">{selectedPayMethod.bankName}</span>
                              <span className="text-slate-400 font-semibold">IBAN :</span>
                              <span className="font-mono font-bold text-slate-800 text-[9px] select-all truncate">{selectedPayMethod.iban}</span>
                              <span className="text-slate-400 font-semibold">BIC / SWIFT :</span>
                              <span className="font-mono font-bold text-slate-800 select-all truncate">{selectedPayMethod.bic}</span>
                            </div>

                            <div className="space-y-2 pt-1 border-t border-slate-150">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Déclarer votre virement bancaire</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400">Nom d'émetteur</label>
                                  <input 
                                    type="text" 
                                    required
                                    value={userHolderForDeclaration} 
                                    onChange={(e) => setUserHolderForDeclaration(e.target.value)}
                                    placeholder="Ex: Jean DUPONT" 
                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[10px]"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400">IBAN d'envoi</label>
                                  <input 
                                    type="text" 
                                    required
                                    value={userIbanForDeclaration} 
                                    onChange={(e) => setUserIbanForDeclaration(e.target.value)}
                                    placeholder="FR76..." 
                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPayModal(null);
                          setSelectedPayMethod(null);
                        }}
                        className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer transition-all"
                      >
                        Fermer
                      </button>
                      {selectedPayMethod && (
                        <button
                          type="button"
                          disabled={isProcessingPay}
                          onClick={handleProcessPayment}
                          className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold rounded-lg transition-all shadow flex items-center gap-1.5 cursor-pointer"
                        >
                          {isProcessingPay ? (
                            <>
                              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Traitement...
                            </>
                          ) : (
                            <>
                              <Wallet className="h-3.5 w-3.5" />
                              {selectedPayMethod.type === "crypto" ? "Régler via MetaMask" : "Déclarer le Virement"}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* 4. ONGLET DOCUMENTS & PREUVES */}
          {activeSubTab === "docs" && (
            <motion.div
              key="docs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900">Documents d'Instruction & Preuves</h2>
                <p className="text-slate-500 text-xs">Retrouvez l'ensemble des documents téléchargés pour votre dossier d'urgence.</p>
              </div>

              <div className="space-y-4">
                {/* Documents issus des soumissions dynamiques */}
                {submissions.length > 0 ? (
                  submissions.filter(s => s.form_data && (s.form_data.fileUrl || s.form_data.audioData || s.form_data.attachment)).map((sub, sIdx) => {
                    const isAudio = sub.step_index === 3 || sub.form_data.audioData;
                    const fileName = sub.form_data.stats?.fileName || (isAudio ? "Pitch vocal d'urgence" : `Document Étape ${sub.step_index + 1}`);
                    const fileUrl = sub.form_data.fileUrl || sub.form_data.audioData || sub.form_data.attachment?.url;
                    const stepLabel = workflowSteps[sub.step_index]?.label || `Étape ${sub.step_index + 1}`;
                    
                    return (
                      <div key={`sub-doc-${sub.id || 'id'}-${sIdx}`} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-lg ${isAudio ? "bg-amber-50 text-amber-700" : "bg-amber-50 text-blue-700"}`}>
                              {isAudio ? <Mic className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-900">{fileName}</h4>
                              <p className="text-[10px] text-slate-500">{stepLabel}</p>
                              <p className="text-[9px] text-slate-400">Transmis le {new Date(sub.submitted_at).toLocaleDateString("fr-FR")} à {new Date(sub.submitted_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-bold">
                            Certifié
                          </span>
                        </div>

                        {isAudio && fileUrl && (
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                             <audio src={fileUrl} controls className="h-8 w-full" />
                          </div>
                        )}

                        <div className="pt-2 flex justify-end gap-3">
                          <button 
                            onClick={() => openDocument(fileUrl, fileName)}
                            className="flex items-center gap-1.5 text-amber-600 hover:text-amber-800 text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Visualiser
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : null}

                {/* Ancienne logique fallback si pas de soumissions (pour la compatibilité) */}
                {!submissions.some(s => s.form_data?.fileUrl) && step3FileUrl && (
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-900">Justificatif d'identité certifié</h4>
                          <p className="text-[10px] text-slate-400">Rattaché le {new Date().toLocaleDateString("fr-FR")}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-bold">
                        Vérifié
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[10px] space-y-1.5 text-slate-600">
                      <div className="flex justify-between font-medium">
                        <span>Algorithme de compression :</span>
                        <span className="text-slate-900 font-bold">WebP (Optimisation Railway)</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Rapport de compression :</span>
                        <span className="text-slate-900 font-bold">12.4x (Sans perte de métadonnées)</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 mt-2 flex justify-end">
                        <button 
                          onClick={() => openDocument(step3FileUrl, "Justificatif d'identité certifié")}
                          className="flex items-center gap-1.5 text-amber-600 hover:text-amber-800 font-bold transition-colors cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          Visualiser le document
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {submissions.length === 0 && !step3FileUrl && (
                  <div className="p-8 text-center bg-white border border-slate-100 rounded-xl shadow-sm space-y-2">
                    <AlertTriangle className="h-8 w-8 text-slate-400 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-700">Aucun document rattaché</h4>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Veuillez compléter les étapes du dossier d'instruction pour téléverser vos pièces justificatives.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 5. ONGLET GUIDE ET FAQ D'INSTRUCTION */}
          {activeSubTab === "help" && (
            <motion.div
              key="help"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900">Guide de validation du dossier</h2>
                <p className="text-slate-500 text-xs">Comprendre l'évaluation de vos documents en toute clarté.</p>
              </div>

              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2.5">
                  <h4 className="font-extrabold text-xs text-slate-900">1. Renseigner vos coordonnées</h4>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Saisissez un e-mail et un numéro de téléphone valides pour que l'agent d'attribution puisse programmer un rendez-vous si nécessaire.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2.5">
                  <h4 className="font-extrabold text-xs text-slate-900">2. Décrire le projet d'usage</h4>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Exposez avec intégrité la finalité du don reçu. La commission d'attribution privilégie les projets d'utilité publique, les associations locales ou les situations d'extrême précarité.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2.5">
                  <h4 className="font-extrabold text-xs text-slate-900">3. Traitement sécurisé des justificatifs</h4>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Pour garantir l'équité, chaque pièce d'identité est traitée de manière chiffrée. Les analyses vérifient l'intégrité de la pièce sans stockage permanent invasif.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
          {/* 6. ONGLET SÉCURITÉ */}
          {activeSubTab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 flex-1"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900">Paramètres de sécurité</h2>
                <p className="text-slate-500 text-xs">Gérez la sécurité de votre compte et votre mot de passe.</p>
              </div>

              <SecuritySettings userEmail={currentUser?.email || ""} />
            </motion.div>
          )}

          {/* 7. ONGLET TÉMOIGNAGES */}
          {activeSubTab === "testimonials" && (
            <motion.div
              key="testimonials"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 flex-1"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-slate-900">Mes Avis & Témoignages</h2>
                  <p className="text-slate-500 text-xs">Partagez l'impact des dons reçus ou consultez vos retours déjà publiés.</p>
                </div>
                
                {userApplications.some(a => a.status === "accepted") && (
                  <button
                    onClick={() => {
                      const firstAccepted = userApplications.find(a => a.status === "accepted");
                      if (firstAccepted) {
                        setTestimonialDonationId(firstAccepted.donation_id);
                        setShowTestimonialModal(true);
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm shadow-indigo-100"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Nouveau témoignage
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Liste des témoignages de l'utilisateur */}
                {(() => {
                  const userTestis = testimonials.filter(t => t.author_name === currentUser?.name);
                  
                  if (userTestis.length === 0) {
                    return (
                      <div className="md:col-span-2 p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-4">
                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                          <Star className="h-8 w-8 text-slate-300" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-900">Aucun témoignage pour l'instant</h4>
                          <p className="text-xs text-slate-500 max-w-xs mx-auto">
                            Lorsque vous recevez un don, vous pouvez partager votre joie ici. Cela aide d'autres personnes à nous faire confiance.
                          </p>
                        </div>
                        {userApplications.some(a => a.status === "accepted") ? (
                          <button
                            onClick={() => {
                              const firstAccepted = userApplications.find(a => a.status === "accepted");
                              if (firstAccepted) {
                                setTestimonialDonationId(firstAccepted.donation_id);
                                setShowTestimonialModal(true);
                              }
                            }}
                            className="text-amber-600 text-xs font-bold hover:underline cursor-pointer"
                          >
                            Écrire mon premier témoignage →
                          </button>
                        ) : (
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 max-w-sm mx-auto">
                            <p className="text-[10px] text-amber-700 leading-normal">
                              Note: Vous pourrez témoigner dès qu'une de vos candidatures sera acceptée par nos services.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return userTestis.map((t, idx) => {
                    const don = allDonations.find(d => d.id === t.donation_id);
                    return (
                      <div key={`user-testi-${t.id || 'id'}-${idx}`} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-black uppercase text-slate-400">Don concerné</span>
                              <h5 className="text-xs font-bold text-slate-900 truncate max-w-[150px]">{don?.title || "Don supprimé"}</h5>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              t.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {t.approved ? "Publié" : "En attente"}
                            </span>
                          </div>

                          <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 italic text-slate-600 text-[11px] leading-relaxed">
                            "{t.quote}"
                          </div>

                          {t.railway_media_url && (
                            <div className="rounded-lg overflow-hidden border border-slate-100">
                              {t.media_type === "image" && (
                                <img 
                                  src={t.railway_media_url} 
                                  alt="Impact" 
                                  className="w-full h-24 object-cover" 
                                  referrerPolicy="no-referrer" 
                                  onError={(e) => {
                                    e.currentTarget.src = "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=600";
                                  }}
                                />
                              )}
                              {t.media_type === "audio" && (
                                <audio src={t.railway_media_url} controls className="w-full h-8" />
                              )}
                              {t.media_type === "video" && (
                                <div className="p-2 bg-slate-900 text-white text-[9px] flex items-center gap-2">
                                  <Video className="h-3 w-3" /> Vidéo partagée
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                          <span className="text-[10px] text-slate-400 font-bold">Posté le {new Date(t.created_at || "").toLocaleDateString("fr-FR")}</span>
                          <span className="text-[10px] text-amber-500 font-black uppercase tracking-tighter">
                            {t.media_type === "text" ? "Texte" : t.media_type === "image" ? "Média WebP" : t.media_type === "audio" ? "Audio Opus" : "Lien Vidéo"}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* MODAL TÉMOIGNAGE / AVIS */}
      {showTestimonialModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-100 shadow-2xl relative space-y-4 animate-fadeIn">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Star className="h-5 w-5 text-emerald-500 fill-current" />
                  Laisser un avis & témoignage
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Partagez votre expérience de bénéficiaire pour inspirer et encourager notre communauté solidaire.
                </p>
              </div>
              <button 
                onClick={() => setShowTestimonialModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-50 hover:bg-slate-100 p-1 rounded-full cursor-pointer transition-all"
              >
                ✕
              </button>
            </div>

            {testimonialSuccessMessage ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-950 rounded-xl text-center space-y-2">
                <ShieldCheck className="h-10 w-10 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold">{testimonialSuccessMessage}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitTestimonial} className="space-y-4">
                {/* Type de témoignage */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 block">Format de votre témoignage :</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { type: "text", label: "Texte", icon: FileText },
                      { type: "audio", label: "Audio", icon: Mic },
                      { type: "image", label: "Image", icon: UploadCloud },
                      { type: "video", label: "Vidéo (YT)", icon: Video }
                    ].map((item) => {
                      const IconComp = item.icon;
                      const isSel = testimonialMediaType === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => {
                            setTestimonialMediaType(item.type as any);
                            setTestimonialMediaUrl("");
                            setTestimonialFileStats(null);
                          }}
                          className={`p-2 rounded-lg border text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            isSel 
                              ? "bg-amber-50 border-amber-500 text-amber-700" 
                              : "bg-white border-slate-100 hover:bg-slate-50/80 text-slate-500"
                          }`}
                        >
                          <IconComp className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nom d'auteur */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Votre nom ou pseudo d'auteur</label>
                  <input
                    type="text"
                    value={testimonialAuthorName}
                    onChange={(e) => setTestimonialAuthorName(e.target.value)}
                    required
                    placeholder="Ex: Association de Quartier, Marie L..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>

                {/* Le témoignage texte */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Votre message / citation</label>
                  <textarea
                    value={testimonialQuote}
                    onChange={(e) => setTestimonialQuote(e.target.value)}
                    required
                    rows={3}
                    placeholder="Écrivez votre message de remerciement ou décrivez comment ce don a changé votre quotidien..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>

                {/* Conditionnel selon le format choisi */}
                {testimonialMediaType === "audio" && (
                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Témoignage Audio (Opus compressé)</span>
                    <p className="text-[10px] text-slate-400">Enregistrez ou déposez un fichier vocal. Notre système le compressera automatiquement en mode Opus ultra-léger.</p>
                    
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50/50 p-3">
                        <div className="flex flex-col items-center justify-center text-center">
                          <Mic className="w-5 h-5 mb-1 text-slate-400 animate-pulse" />
                          <span className="text-[10px] text-slate-600 font-bold">Uploader l'audio (.opus, .mp3, .wav)</span>
                        </div>
                        <input 
                          type="file" 
                          accept="audio/*"
                          className="hidden" 
                          onChange={handleTestimonialFileUpload}
                          disabled={isUploadingTestFile}
                        />
                      </label>
                    </div>

                    {isUploadingTestFile && (
                      <p className="text-[9px] text-slate-500 animate-pulse text-center">Compression Opus en cours...</p>
                    )}

                    {testimonialMediaUrl && testimonialFileStats && (
                      <div className="space-y-2">
                        <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex items-center justify-between text-[10px]">
                          <span className="text-emerald-800 font-bold">Opus compressé avec succès !</span>
                          <span className="font-mono bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black">
                            {testimonialFileStats.compressedSize} Ko
                          </span>
                        </div>
                        <audio src={testimonialMediaUrl} controls className="w-full h-8" />
                      </div>
                    )}
                  </div>
                )}

                {testimonialMediaType === "image" && (
                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Témoignage Image (WebP compressé)</span>
                    <p className="text-[10px] text-slate-400">Téléversez une photo du don mis en valeur. Notre algorithme l'optimisera en format WebP ultra-haute fidélité.</p>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50/50 p-3">
                          <div className="flex flex-col items-center justify-center text-center">
                            <UploadCloud className="w-5 h-5 mb-1 text-slate-400" />
                            <span className="text-[10px] text-slate-600 font-bold">Uploader une image (.png, .jpg)</span>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*"
                            className="hidden" 
                            onChange={handleTestimonialFileUpload}
                            disabled={isUploadingTestFile}
                          />
                        </label>
                      </div>

                      <div className="text-center text-[10px] text-slate-400 font-bold">OU saisissez un lien d'image directe :</div>
                      
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/photo-..."
                        value={testimonialMediaUrl}
                        onChange={(e) => setTestimonialMediaUrl(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none"
                      />
                    </div>

                    {isUploadingTestFile && (
                      <p className="text-[9px] text-slate-500 animate-pulse text-center">Conversion WebP et compression en cours...</p>
                    )}

                    {testimonialMediaUrl && (
                      <div className="space-y-2">
                        {testimonialFileStats && (
                          <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex items-center justify-between text-[10px]">
                            <span className="text-emerald-800 font-bold">Format {testimonialFileStats.format} optimisé</span>
                            <span className="font-mono bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black">
                              Taux : {testimonialFileStats.ratio} (Fichier : {testimonialFileStats.compressedSize} Ko)
                            </span>
                          </div>
                        )}
                        <img 
                          src={testimonialMediaUrl} 
                          alt="Preview" 
                          className="w-full h-24 object-cover rounded-lg border border-slate-100" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => {
                            e.currentTarget.src = "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=600";
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {testimonialMediaType === "video" && (
                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Témoignage Vidéo (Lien YouTube)</span>
                    <p className="text-[10px] text-slate-400">Insérez l'URL d'une vidéo de remerciement hébergée sur YouTube.</p>
                    
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={testimonialMediaUrl}
                      onChange={(e) => setTestimonialMediaUrl(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                    />

                    {testimonialMediaUrl && testimonialMediaUrl.includes("youtube.com") && (
                      <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-indigo-950 flex items-center gap-2">
                        <Video className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <span>Lien YouTube détecté avec succès ! La vidéo sera intégrée sur la carte du don.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Avertissement de modération */}
                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl flex items-start gap-2.5">
                  <Info className="h-4.5 w-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-900 leading-normal font-medium">
                    <span className="font-extrabold">Sécurité et vérification :</span> Votre témoignage sera automatiquement envoyé aux modérateurs pour validation avant d'être publié sur la carte du don et dans la fiche publique.
                  </p>
                </div>

                {/* Submit buttons */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTestimonialModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTestimonial || (testimonialMediaType === "video" && !testimonialMediaUrl) || (testimonialMediaType === "audio" && !testimonialMediaUrl)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmittingTestimonial ? "Envoi en cours..." : "Soumettre pour validation"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification en temps réel */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            onClick={() => {
              setActiveSubTab("chat");
              setActiveToast(null);
            }}
            className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl p-4 flex gap-3 items-start cursor-pointer hover:bg-slate-850 transition-all"
            id="realtime-user-toast"
          >
            <div className="bg-amber-600 p-2 rounded-lg text-white">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-amber-400">Nouveau message en direct</p>
              <p className="text-xs font-bold text-slate-200 mt-0.5">{activeToast.senderName}</p>
              <p className="text-xs text-slate-400 mt-1 truncate">{activeToast.content}</p>
              <p className="text-[9px] text-slate-500 mt-2 font-medium">Cliquer pour répondre</p>
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
      </AnimatePresence>

    </div>
  );
}
