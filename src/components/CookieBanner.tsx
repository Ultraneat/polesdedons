import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, X, Check, Lock, Shield, FileText } from 'lucide-react';

interface CookieBannerProps {
  onOpenPrivacy?: () => void;
}

export default function CookieBanner({ onOpenPrivacy }: CookieBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Vérifier si le consentement a déjà été donné
    const hasConsented = localStorage.getItem('rgpd_consent');
    if (!hasConsented) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('rgpd_consent', 'all');
    setIsVisible(false);
  };

  const handleDeclineAll = () => {
    localStorage.setItem('rgpd_consent', 'necessary_only');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 120, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 120, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-3 sm:p-5 pointer-events-none flex justify-center"
          id="rgpd-cookie-banner"
        >
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.25)] border border-stone-200/90 max-w-4xl w-full p-5 sm:p-6 flex flex-col md:flex-row gap-5 md:gap-6 items-start md:items-center pointer-events-auto relative overflow-hidden">
            {/* Ligne d'accent ambre supérieure */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

            <div className="flex-1 flex gap-3.5 sm:gap-4 items-start">
              <div className="h-11 w-11 sm:h-12 sm:w-12 bg-amber-500/15 text-amber-700 rounded-2xl flex items-center justify-center flex-shrink-0 border border-amber-500/25 shadow-xs">
                <ShieldCheck className="h-6 w-6 text-amber-600" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-stone-900 tracking-tight">
                    Conformité RGPD & Protection des Données
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    Chiffrement SSL 256-bit
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed font-normal">
                  Le <strong>Pôle de Dons</strong> utilise des témoins strictement nécessaires à l'authentification, à la sécurité des candidatures et au suivi confidentiel des dotations. Aucune donnée n'est cédée ni revendue à des tiers.
                </p>
                <div className="flex items-center gap-3 pt-1 flex-wrap text-[11px] font-bold text-stone-500">
                  <span className="flex items-center gap-1 text-stone-700">
                    <Shield className="h-3.5 w-3.5 text-amber-600" />
                    Hébergement européen certifié
                  </span>
                  {onOpenPrivacy && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenPrivacy();
                        setIsVisible(false);
                      }}
                      className="text-amber-700 hover:text-amber-800 underline underline-offset-2 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <FileText className="h-3 w-3" />
                      Consulter notre politique RGPD
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
              <button
                onClick={handleDeclineAll}
                className="px-4 py-2.5 rounded-xl text-xs font-black text-stone-700 bg-stone-100 hover:bg-stone-200 active:scale-95 transition-all w-full sm:w-auto border border-stone-200/80 cursor-pointer text-center"
              >
                Strictement nécessaires
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-95 shadow-md shadow-amber-700/20 transition-all w-full sm:w-auto flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                Tout accepter & continuer
              </button>
            </div>
            
            <button
              onClick={handleDeclineAll}
              className="absolute top-3 right-3 p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 rounded-xl transition-colors md:hidden cursor-pointer"
              aria-label="Fermer le bandeau cookies"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

