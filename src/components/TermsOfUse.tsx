import React from 'react';
import { FileSignature, AlertCircle, HandHeart, Scale, CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function TermsOfUse() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-10 py-4 animate-fadeIn"
      id="terms-of-use-root"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center h-16 w-16 bg-amber-500/15 text-amber-700 rounded-2xl mb-2 border border-amber-500/30 shadow-xs">
          <FileSignature className="h-8 w-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight">
          Conditions Générales d'Utilisation
        </h1>
        <p className="text-sm sm:text-base text-stone-600 max-w-2xl mx-auto leading-relaxed">
          Les présentes conditions encadrent le fonctionnement et les principes d'attribution du Pôle de Dons, dispositif d'intérêt solidaire et non-lucratif.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-md p-6 sm:p-10 space-y-10">
        
        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
              <HandHeart className="h-4 w-4" />
            </div>
            1. Objet de la plateforme
          </h2>
          <div className="text-xs sm:text-sm text-stone-600 leading-relaxed space-y-3 pl-11">
            <p>
              Le Pôle de Dons est un service numérique de redistribution solidaire permettant la mise en relation entre des offres de dotations d'envergure (équipements, véhicules, immobilier, subventions) et des structures ou personnes exprimant un besoin d'utilité publique.
            </p>
            <p className="font-semibold text-amber-900 bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
              Il est strictement rappelé que la plateforme opère selon un modèle d'attribution basé sur une commission d'instruction et des critères d'urgence et d'impact. En aucun cas, des frais de participation ou d'enchère financière ne sont demandés aux demandeurs.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            2. Accès et Inscription
          </h2>
          <div className="text-xs sm:text-sm text-stone-600 leading-relaxed space-y-3 pl-11">
            <p>L'accès à la plateforme est gratuit. Pour soumettre une demande de dotation, l'utilisateur doit :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Créer un compte de manière loyale, en fournissant des informations exactes et vérifiables.</li>
              <li>Fournir les justificatifs officiels demandés lors des étapes d'instruction.</li>
              <li>Ne pas multiplier les comptes sous peine d'exclusion de l'écosystème.</li>
            </ul>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
              <Scale className="h-4 w-4" />
            </div>
            3. Règle d'attribution et Arbitrage
          </h2>
          <div className="text-xs sm:text-sm text-stone-600 leading-relaxed space-y-3 pl-11">
            <p>
              Les candidatures sont instruites par la commission d'attribution. La décision de la commission s'appuie sur :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Le niveau de priorité sociale et d'urgence déclaré et justifié.</li>
              <li>L'historique des attributions (principe de rotation équitable).</li>
              <li>La pertinence et l'utilité du projet présenté par rapport au don concerné.</li>
            </ul>
            <p>
              La plateforme est un facilitateur solidaire et n'a aucune obligation contractuelle de résultat quant à l'attribution d'un don à un postulant spécifique.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center">
              <AlertCircle className="h-4 w-4" />
            </div>
            4. Responsabilités de l'utilisateur
          </h2>
          <div className="text-xs sm:text-sm text-stone-600 leading-relaxed space-y-3 pl-11">
            <p>
              L'utilisateur s'engage à utiliser le Pôle de Dons de bonne foi et s'interdit formellement :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>De revendre à titre lucratif un équipement ou un bien acquis via une dotation de la plateforme.</li>
              <li>De falsifier ses déclarations d'urgence ou ses justificatifs.</li>
              <li>D'adopter un comportement abusif, harcelant ou irrespectueux envers les instructeurs via le système d'échange en direct.</li>
            </ul>
            <p className="mt-4 text-xs italic text-stone-500">
              Le non-respect de ces obligations entraîne la clôture immédiate de la candidature et la suspension du compte.
            </p>
          </div>
        </section>

      </div>
    </motion.div>
  );
}
