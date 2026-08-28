import React from 'react';
import { Shield, Lock, Server, Eye, Database, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function PrivacyPolicy() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-10 py-4 animate-fadeIn"
      id="privacy-policy-root"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center h-16 w-16 bg-amber-500/15 text-amber-700 rounded-2xl mb-2 border border-amber-500/30 shadow-xs">
          <Shield className="h-8 w-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight">
          Protection des Données & Confidentialité
        </h1>
        <p className="text-sm sm:text-base text-stone-600 max-w-2xl mx-auto leading-relaxed">
          Le Pôle de Dons s'engage à protéger l'intégrité et la confidentialité des informations de ses utilisateurs et demandeurs, dans le strict respect du Règlement Général sur la Protection des Données (RGPD).
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-md p-6 sm:p-10 space-y-10">
        
        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
              <Database className="h-4 w-4" />
            </div>
            1. Données collectées
          </h2>
          <div className="text-xs sm:text-sm text-stone-600 leading-relaxed space-y-3 pl-11">
            <p>
              Dans le cadre de l'utilisation du Pôle de Dons, nous pouvons être amenés à collecter les catégories de données suivantes :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Données d'identification :</strong> Nom, prénom, adresse e-mail, numéro de téléphone, qualité (Citoyen, Association, Mécène).</li>
              <li><strong>Données relatives aux candidatures :</strong> Motivations, fiches d'information et pièces justificatives nécessaires à l'instruction.</li>
              <li><strong>Données techniques de sécurité :</strong> Horodatage de connexion, logs d'échanges avec les instructeurs, pièces transmises.</li>
            </ul>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
              <Server className="h-4 w-4" />
            </div>
            2. Finalités du traitement
          </h2>
          <div className="text-xs sm:text-sm text-stone-600 leading-relaxed space-y-3 pl-11">
            <p>Vos données sont exclusivement traitées pour les finalités suivantes :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Permettre le bon fonctionnement et la sécurité du service d'attribution solidaire.</li>
              <li>Instruire et évaluer les candidatures de dons de façon équitable et traçable.</li>
              <li>Assurer les échanges en direct entre candidats et instructeurs référents.</li>
              <li>Garantir la sécurité de la plateforme et prévenir les candidatures frauduleuses.</li>
            </ul>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
              <Lock className="h-4 w-4" />
            </div>
            3. Sécurité et conservation
          </h2>
          <div className="text-xs sm:text-sm text-stone-600 leading-relaxed space-y-3 pl-11">
            <p>
              Le Pôle de Dons applique des mesures techniques et organisationnelles strictes pour garantir la sécurité et la confidentialité de vos informations.
            </p>
            <p>
              Les données liées à un dossier de candidature sont conservées durant l'instruction et archivées selon les obligations légales, sans commercialisation ni revente à des tiers.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
              <Eye className="h-4 w-4" />
            </div>
            4. Vos droits (RGPD & CNIL)
          </h2>
          <div className="text-xs sm:text-sm text-stone-600 leading-relaxed space-y-3 pl-11">
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD 2016/679) et à la loi Informatique et Libertés, vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Droit d'accès et de rectification :</strong> Consulter et corriger l'ensemble de vos informations personnelles.</li>
              <li><strong>Droit à l'effacement (« droit à l'oubli ») :</strong> Demander la suppression définitive de votre dossier après clôture de l'instruction.</li>
              <li><strong>Droit d'opposition et de portabilité :</strong> Récupérer vos pièces transmises dans un format structuré.</li>
            </ul>
            <p className="pt-2">
              Pour exercer ces droits, adressez-vous directement au délégué à la protection des données (DPO) via la page <strong>Contact</strong> ou par messagerie directe depuis votre espace candidat.
            </p>
          </div>
        </section>

      </div>
    </motion.div>
  );
}
