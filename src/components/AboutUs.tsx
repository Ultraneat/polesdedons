import React, { useState } from "react";
import { Award, ShieldCheck, Heart, Users, Target, CheckCircle2, ChevronDown, HelpCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AboutUs() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const commitments = [
    {
      title: "Transparence & Équité",
      desc: "Chaque dotation fait l'objet d'un examen méthodique et impartial. Les critères d'arbitrage sont publics et tracés.",
      icon: ShieldCheck,
      color: "text-amber-700 bg-amber-50 border-amber-200/60"
    },
    {
      title: "Impact et Utilité Sociale",
      desc: "Nous analysons la pertinence et le rayonnement humain de chaque dossier pour maximiser l'utilité des dotations.",
      icon: Target,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200/60"
    },
    {
      title: "Interlocuteurs Référents",
      desc: "Chaque candidature dispose d'un accompagnement personnalisé assuré par des agents instructeurs disponibles en direct.",
      icon: Users,
      color: "text-amber-700 bg-amber-50 border-amber-200/60"
    }
  ];

  const faqs = [
    {
      question: "Comment s'organise l'attribution solidaire sur le Pôle de Dons ?",
      answer: "Les biens et dotations publiés sont accessibles à tous les candidats éligibles. Après avoir choisi une offre, vous complétez un parcours d'instruction sécurisé en plusieurs étapes (coordonnées, description du projet, pièce d'identification et motivation). Notre commission étudie chaque dossier selon son utilité et son degré de priorité."
    },
    {
      question: "Qu'est-ce que l'indice de priorité et de convoitise ?",
      answer: "L'indice reflète en temps réel la demande et le niveau d'instruction autour d'une dotation. Il permet aux candidats d'apprécier la tension sur une opportunité et d'ajuster la complétude de leurs justificatifs pour une évaluation juste."
    },
    {
      question: "La plateforme est-elle libre et sans frais ?",
      answer: "Absolument. Le Pôle de Dons est un dispositif d'intérêt général à vocation solidaire. Aucun frais de participation, d'inscription ou d'enchère n'est réclamé aux demandeurs."
    },
    {
      question: "Puis-je dialoguer avec l'agent instructeur avant de postuler ?",
      answer: "Oui. Chaque dotation intègre un canal de messagerie en direct. Vous pouvez solliciter l'agent référent directement depuis la fiche pour poser vos questions préliminaires."
    },
    {
      question: "Quels sont les délais d'évaluation des candidatures ?",
      answer: "Une fois l'ensemble des éléments transmis dans votre espace de suivi, le secrétariat traite le dossier sous 48 à 72 heures et vous notifie de la décision d'attribution."
    }
  ];

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-12 py-4 animate-fadeIn" id="about-us-root">
      {/* Hero Section d'À Propos */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="px-4 py-1.5 bg-amber-500/15 text-amber-800 border border-amber-500/30 rounded-full text-xs font-black tracking-widest uppercase inline-flex items-center gap-2 shadow-xs">
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          À Propos du Pôle de Dons
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 tracking-tight leading-tight">
          Fédérer les dons d'envergure, <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-700 via-amber-600 to-amber-900">
            au service du bien commun.
          </span>
        </h1>
        <p className="text-stone-600 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
          Le Pôle de Dons est une structure numérique d'intérêt solidaire facilitant l'attribution équitable d'actifs majeurs (véhicules, espaces immobiliers, équipements professionnels et subventions) aux structures et citoyens engagés.
        </p>
      </div>

      {/* Grid d'engagements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto" id="commitments-grid">
        {commitments.map((com, idx) => {
          const Icon = com.icon;
          return (
            <div key={`commitment-${idx}`} className="bg-white p-8 rounded-[28px] border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-amber-500/30 transition-all space-y-4">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${com.color} border shadow-xs`}>
                <Icon className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-stone-900 text-base sm:text-lg">{com.title}</h3>
                <p className="text-stone-500 text-xs sm:text-sm leading-relaxed">{com.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mission & Objectifs */}
      <div className="bg-white rounded-[32px] border border-stone-200/80 shadow-md p-6 sm:p-12 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center" id="mission-panel">
        <div className="space-y-5">
          <h2 className="text-xl sm:text-3xl font-black text-stone-900 tracking-tight">Notre Mission d'Attribution</h2>
          <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
            Plutôt que de laisser des biens matériels ou immobiliers sans usage, le Pôle de Dons structure une passerelle directe entre mécènes donateurs et bénéficiaires vérifiés.
          </p>
          <div className="space-y-3">
            {[
              "Remise en circulation d'utilitaires et moyens de transport",
              "Mise à disposition de locaux pour initiatives citoyennes",
              "Allocation de dotations pour projets d'urgence",
              "Traçabilité rigoureuse et suivi d'instruction en temps réel"
            ].map((text, i) => (
              <div key={`mission-obj-${i}`} className="flex items-center gap-3 text-stone-700 text-xs sm:text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="font-extrabold">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative h-72 bg-stone-100 rounded-3xl overflow-hidden border border-stone-200/80 shadow-inner">
          <img 
            src="https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=600" 
            alt="Pôle de Dons Solidarité" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* SECTION FAQ ACCORDÉON INTERACTIF */}
      <div className="max-w-3xl mx-auto space-y-6 pt-6" id="faq-section">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center justify-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-600" />
            Questions Fréquentes
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900">Tout savoir sur le fonctionnement</h2>
          <p className="text-stone-500 text-xs sm:text-sm">Consultez les réponses aux interrogations régulières concernant les dotations et leur attribution.</p>
        </div>

        <div className="space-y-3" id="faq-accordion-container">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div 
                key={`faq-${idx}`} 
                className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden transition-all duration-200"
                id={`faq-item-${idx}`}
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-stone-50 transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="font-extrabold text-stone-900 text-xs sm:text-sm pr-4">{faq.question}</span>
                  <ChevronDown className={`h-4 w-4 text-stone-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? "rotate-180 text-amber-600" : ""}`} />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-4 pt-1 border-t border-stone-100 text-stone-600 text-xs sm:text-sm leading-relaxed bg-stone-50/50">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
