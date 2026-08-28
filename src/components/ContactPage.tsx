import React, { useState, useEffect, useRef } from "react";
import { Mail, Phone, MapPin, Send, Paperclip, X, MessageSquare, Mic, Square, Trash2, Loader2 } from "lucide-react";
import { getSocket, joinConversation } from "../lib/socket";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { blobToBase64 } from "../lib/fileCompressor";

interface ContactPageProps {
  currentUser?: any;
}

export default function ContactPage({ currentUser }: ContactPageProps) {
  const [guestId] = useState(() => {
    const saved = localStorage.getItem("chat_guest_id");
    if (saved) return saved;
    const newId = "guest_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("chat_guest_id", newId);
    return newId;
  });

  const effectiveUserId = currentUser?.id || guestId;

  const [formData, setFormData] = useState({
    name: currentUser?.name || currentUser?.email?.split("@")[0] || "",
    email: currentUser?.email || "",
    phone: "",
    subject: "Demande de renseignements généraux",
  });

  const contactDonationId = formData.email 
    ? `contact_${formData.email.replace(/[@.]/g, "_")}` 
    : `contact_${effectiveUserId}`;

  const [unifiedMessages, setUnifiedMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatAttachment, setChatAttachment] = useState<any>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const audioRecorder = useAudioRecorder();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
              fileName: "Note_vocale_contact.webm",
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

  // Auto-scroll chat to bottom (confined to chat container, never scrolls window)
  useEffect(() => {
    const container = document.getElementById("contact-chat-panel");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [unifiedMessages]);

  // Real-time chat sync
  useEffect(() => {
    const socket = getSocket();
    
    // Rejoindre la room spécifique de l'utilisateur
    joinConversation(effectiveUserId);
    
    const encodedName = encodeURIComponent(formData.name || "Visiteur");

    const fetchMessages = () => {
      fetch(`/api/agent-conversations/${contactDonationId}?user_id=${effectiveUserId}&user_name=${encodedName}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setUnifiedMessages(data);
          }
        })
        .catch(err => console.warn("Erreur chargement messages contact:", err));
    };

    fetchMessages();

    // Polling toutes les 4 secondes pour garantir la synchronisation
    const interval = setInterval(fetchMessages, 4000);

    const handleMessageReceived = (payload: any) => {
      if (payload.donation_id === contactDonationId) {
        setUnifiedMessages(prev => {
          if (prev.some((m: any) => m.id === payload.id || (m.content === payload.content && m.created_at === payload.created_at))) {
            return prev;
          }
          return [...prev, payload].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        });
      }
    };

    socket.on("message:received", handleMessageReceived);
    socket.on("application_message:received", handleMessageReceived);

    return () => {
      clearInterval(interval);
      socket.off("message:received", handleMessageReceived);
      socket.off("application_message:received", handleMessageReceived);
    };
  }, [effectiveUserId, contactDonationId, formData.name]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!chatInput.trim() && !chatAttachment) || isSendingChat) return;

    setIsSendingChat(true);

    const payload = {
      donation_id: contactDonationId,
      sender: 'user' as const,
      content: chatInput.trim(),
      user_name: formData.name || "Visiteur",
      user_id: effectiveUserId,
      is_auth: !!currentUser,
      attachment: chatAttachment,
      created_at: new Date().toISOString()
    };

    try {
      await fetch(`/api/agent-conversations/${contactDonationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      // Ajout optimiste
      setUnifiedMessages(prev => [
        ...prev,
        { ...payload, id: `temp-${Date.now()}` }
      ]);
      
      setChatInput("");
      setChatAttachment(null);
    } catch (err) {
      console.error("Erreur d'envoi du message de chat:", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleChatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setAttachmentError("Fichier trop volumineux. La taille maximale autorisée est de 2 Mo.");
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

  return (
    <div className="space-y-12 py-4 animate-fadeIn" id="contact-page-root">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <span className="px-4 py-1.5 bg-amber-500/15 text-amber-800 border border-amber-500/30 rounded-full text-xs font-black tracking-widest uppercase inline-block shadow-xs">
          Secrétariat & Commission d'Instruction
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight leading-tight">
          Une question sur une dotation ou un projet ? <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-700 via-amber-600 to-amber-900">
            Échangez en direct avec nos instructeurs.
          </span>
        </h1>
        <p className="text-stone-600 text-sm leading-relaxed">
          Que vous soyez mécène donateur ou porteur de projet en quête d'attribution, le secrétariat du Pôle de Dons répond à vos interrogations en temps réel.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto items-start" id="contact-content-grid">
        {/* Colonne Gauche: Coordonnées de contact */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-stone-900 text-white p-6 sm:p-8 rounded-[32px] space-y-6 shadow-xl relative overflow-hidden border border-stone-800">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(217,119,6,0.12),transparent_50%)] pointer-events-none" />
            
            <div className="space-y-2 relative z-10">
              <h3 className="text-lg font-black text-white">Secrétariat Général</h3>
              <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
                Le Pôle de Dons coordonne l'attribution solidaire de dotations matérielles, immobilières et financières à l'échelle nationale et internationale.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-stone-800 relative z-10">
              <div className="flex items-center gap-3 text-xs sm:text-sm">
                <div className="h-10 w-10 bg-stone-800 text-emerald-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-stone-700">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-stone-400 text-[10px] uppercase font-bold tracking-wider">Ligne d'Assistance</span>
                  <span className="font-extrabold text-stone-100">+49 15216945182</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs sm:text-sm">
                <div className="h-10 w-10 bg-stone-800 text-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-stone-700">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-stone-400 text-[10px] uppercase font-bold tracking-wider">E-mail Référent</span>
                  <a 
                    href="mailto:contact@polededons.fr?subject=Contact%20Pole%20de%20Dons" 
                    className="font-extrabold text-amber-400 hover:text-amber-300 transition-colors underline decoration-amber-400/30"
                    title="Cliquer pour ouvrir votre boîte mail"
                  >
                    contact@polededons.fr
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs sm:text-sm">
                <div className="h-10 w-10 bg-stone-800 text-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-stone-700">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-stone-400 text-[10px] uppercase font-bold tracking-wider">Siège Administratif</span>
                  <span className="font-extrabold text-stone-200">12 Avenue des Champs-Élysées, 75008 Paris</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne Droite: Formulaire d'identification + Chat interactif */}
        <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-[32px] border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-6">
          
          {/* Section d'identification */}
          <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200/70 space-y-4">
            <h3 className="text-xs font-black text-stone-600 uppercase tracking-wider flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Vos coordonnées d'échange
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-stone-700 uppercase tracking-wide">Nom Complet ou Organisation</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sophie Martin, Asso Solidarité..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-stone-700 uppercase tracking-wide">Adresse E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="sophie.martin@domaine.fr"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-stone-700 uppercase tracking-wide">Téléphone (Facultatif)</label>
                <input
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-stone-700 uppercase tracking-wide">Objet de votre demande</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all cursor-pointer font-medium"
                >
                  <option value="Demande de renseignements généraux">Demande de renseignements généraux</option>
                  <option value="Proposer un don (Immobilier, Véhicules, Finance)">Proposer un don (Immobilier, Véhicules, Finance)</option>
                  <option value="Aide sur l'instruction d'un dossier actif">Aide sur l'instruction d'un dossier actif</option>
                  <option value="Proposition de partenariat institutionnel">Proposition de partenariat institutionnel</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section Chat en direct */}
          <div className="border border-stone-200/90 rounded-2xl overflow-hidden flex flex-col bg-stone-50 shadow-sm">
            
            {/* Header du chat */}
            <div className="bg-stone-900 px-5 py-3.5 text-white flex items-center justify-between shadow-xs border-b border-stone-800">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-amber-500 rounded-xl flex items-center justify-center font-black text-stone-950 text-xs shadow-xs">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black leading-tight text-white">Chat en direct avec l'administration</h4>
                  <p className="text-[10px] text-stone-400 font-medium">Vous échangez sous le profil : <span className="font-bold text-amber-300">{formData.name || "Visiteur"}</span></p>
                </div>
              </div>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Instructeurs en ligne
              </span>
            </div>

            {/* Zone des messages */}
            <div className="h-[300px] overflow-y-auto p-4 space-y-3 scrollbar-thin bg-stone-50/70" id="contact-chat-panel">
              {(() => {
                const msgs = unifiedMessages.length > 0
                  ? unifiedMessages
                  : [
                      {
                        sender: 'agent' as const,
                        sender_type: 'admin' as const,
                        content: `Bonjour ${formData.name || "Visiteur"} ! Je suis le référent d'instruction du Pôle de Dons en charge de votre demande : "${formData.subject}". Posez-nous vos questions ici en direct, notre équipe vous répond en temps réel.`,
                        created_at: new Date().toISOString()
                      }
                    ];

                return msgs.map((msg, idx) => {
                  const isSystem = msg.sender_type === "system" || msg.sender === "system";
                  const isUser = msg.sender_type === "user" || msg.sender === "user";

                  return (
                    <div 
                      key={`msg-${msg.id || 'new'}-${idx}`} 
                      className={`flex flex-col max-w-[85%] ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}
                    >
                      <span className="text-[8px] font-black text-stone-400 mb-0.5 uppercase tracking-wider px-1">
                        {isSystem ? "Notification automatisée" : isUser ? "Vous" : (msg.user_name || "Instructeur Pôle de Dons")}
                      </span>
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                        isSystem 
                          ? "bg-stone-100 text-stone-700 rounded-tl-none border border-stone-200/70"
                          : isUser 
                            ? "bg-amber-600 text-white rounded-tr-none font-medium" 
                            : "bg-white text-stone-800 rounded-tl-none border border-stone-200/80 font-medium"
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
                                  {msg.attachment.name || "Pièce jointe"}
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
              <div ref={chatEndRef} />
            </div>

            {/* Entrée de texte */}
            <div className="p-3 bg-white border-t border-stone-200/80 space-y-2">
              {attachmentError && (
                <div className="py-1 px-2.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-[10px] font-bold">
                  {attachmentError}
                </div>
              )}
              
              {isUploadingAttachment && (
                <div className="py-1 px-2.5 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg text-[10px] flex items-center gap-1.5 font-semibold">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                  Analyse et préparation du document...
                </div>
              )}

              {chatAttachment && (
                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200/70 rounded-xl">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {chatAttachment.type === "audio/webm" ? (
                      <audio controls src={chatAttachment.url} className="h-8 w-40" />
                    ) : (
                      <>
                        <Paperclip className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-900 truncate">{chatAttachment.name} ({chatAttachment.size_kb.toFixed(1)} Ko)</span>
                      </>
                    )}
                  </div>
                  <button onClick={() => setChatAttachment(null)} className="text-red-500 hover:text-red-700 p-1 cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              
              <form onSubmit={handleSendChatMessage} className="flex gap-2">
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
                        accept="image/*,.pdf,.doc,.docx,.txt"
                      />
                    </button>

                    <button
                      type="button"
                      onMouseDown={audioRecorder.startRecording}
                      onTouchStart={audioRecorder.startRecording}
                      disabled={isUploadingAttachment || isSendingChat || !!chatAttachment}
                      className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 bg-stone-50 hover:bg-red-50 border-stone-200 text-stone-600 hover:text-red-500 hover:border-red-200`}
                      title="Maintenir pour enregistrer (ou cliquer pour démarrer)"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                    
                    <input
                      type="text"
                      placeholder="Écrivez votre message aux instructeurs..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isSendingChat}
                      className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all"
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
            
          </div>
          
        </div>
      </div>
    </div>
  );
}
