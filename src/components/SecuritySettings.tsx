import React, { useState } from "react";
import { Lock, ShieldCheck, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SecuritySettingsProps {
  userEmail: string;
}

export default function SecuritySettings({ userEmail }: SecuritySettingsProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Les nouveaux mots de passe ne correspondent pas." });
      return;
    }

    if (newPassword.length < 4) {
      setMessage({ type: "error", text: "Le nouveau mot de passe doit faire au moins 4 caractères." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Votre mot de passe a été modifié avec succès." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: data.error || "Une erreur est survenue." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Erreur de connexion au serveur." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6 max-w-md mx-auto" id="security-settings">
      <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
        <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Sécurité du compte</h3>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Modifier votre mot de passe</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">Mot de passe actuel</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              placeholder="Saisissez votre mot de passe actuel"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">Nouveau mot de passe</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              placeholder="Nouveau mot de passe (min. 4 car.)"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">Confirmer le nouveau mot de passe</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              placeholder="Confirmez votre nouveau mot de passe"
            />
          </div>
        </div>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3 rounded-lg flex items-center gap-2 text-xs font-medium ${
                message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
              }`}
            >
              {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Mise à jour en cours...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Mettre à jour le mot de passe
            </>
          )}
        </button>
      </form>

      <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
        <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
          <AlertCircle className="h-3 w-3 inline mr-1 -mt-0.5" />
          <strong>Note de sécurité :</strong> Pour garantir la protection de votre compte, nous vous recommandons d'utiliser un mot de passe unique que vous n'utilisez sur aucun autre site.
        </p>
      </div>
    </div>
  );
}
