import React from "react";
import { X, Download, FileText, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileType?: string;
}

export default function DocumentModal({ isOpen, onClose, fileUrl, fileName, fileType }: DocumentModalProps) {
  if (!isOpen) return null;

  const validUrl = fileUrl || "";
  const isImage = validUrl.startsWith('data:image/') || 
                  validUrl.startsWith('blob:') || 
                  Boolean(validUrl.match(/\.(webp|jpg|jpeg|png|gif|svg)$|image/i)) ||
                  (validUrl.length > 100 && !validUrl.includes('audio'));

  const [imgError, setImgError] = React.useState(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = validUrl;
    const name = fileName || "document";
    link.download = name.toLowerCase().endsWith('.webp') ? name : `${name.split('.')[0]}.webp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  {isImage ? <Eye className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm md:text-base truncate max-w-[200px] md:max-w-md">
                    {fileName}
                  </h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Aperçu du document sécurisé</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Télécharger</span>
                </button>
                
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-slate-50 p-4 md:p-8 flex items-center justify-center min-h-[400px]">
              {isImage && !imgError ? (
                <img
                  src={fileUrl}
                  alt={fileName}
                  onError={() => setImgError(true)}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-xl border border-slate-200 bg-white"
                />
              ) : (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4 max-w-sm">
                  <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <FileText className="h-10 w-10" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900">{imgError ? "Erreur d'affichage" : "Document non-visuel"}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {imgError 
                        ? "Le flux de données de cette image est corrompu ou illisible en aperçu direct."
                        : "Ce document (PDF ou binaire) ne peut pas être prévisualisé. Veuillez le télécharger."}
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
                  >
                    Télécharger et ouvrir localement
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-white text-center text-[10px] text-slate-400 font-medium">
              Système de redistribution sécurisé &bull; Certifié conforme
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
