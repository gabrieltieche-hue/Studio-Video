import React from 'react';
import { 
  Grid3X3, CheckCircle2, AlertTriangle, XCircle, 
  Clock, Play, ShieldAlert, Award
} from 'lucide-react';
import { ShortProject, ContactSheetFrame } from '../types/studio';

interface ContactSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ShortProject;
  onSeek: (seconds: number) => void;
}

export const ContactSheetModal: React.FC<ContactSheetModalProps> = ({
  isOpen,
  onClose,
  project,
  onSeek,
}) => {
  if (!isOpen) return null;

  const contactSheet = project.contactSheet || [];
  const hasBlocked = contactSheet.some(f => f.qcCheck === 'blocked');
  const hasRevise = contactSheet.some(f => f.qcCheck === 'revise');
  const overallStatus = hasBlocked ? 'BLOCKED' : hasRevise ? 'REVISE' : 'PASS';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#161619] border border-zinc-700/80 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-300">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Planche de Contrôle Qualité (12 Images Représentatives)
                </h2>
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                  overallStatus === 'PASS' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : overallStatus === 'REVISE'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  Statut QC : {overallStatus}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Commande <code>make_reference_contact_sheet</code> • Inspection visuelle obligatoire avant export final
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        {/* QC Rules Banner */}
        <div className="bg-zinc-950 px-4 py-2.5 border-b border-zinc-800 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Accroche &lt; 1.5s
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Changement visuel ~1.5s
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Sous-titres 2 à 5 mots
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Couverture visuelle &gt; 80%
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            {project.slug} ({project.currentVersion})
          </span>
        </div>

        {/* 12-Frame Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {contactSheet.map((frame) => (
              <div
                key={frame.frameIndex}
                className={`p-2 rounded-xl border flex flex-col justify-between transition hover:border-orange-500/80 group ${
                  frame.qcCheck === 'pass'
                    ? 'bg-zinc-900/60 border-zinc-800'
                    : 'bg-amber-950/20 border-amber-600/40'
                }`}
              >
                {/* 9:16 Mock Frame Preview */}
                <div 
                  onClick={() => {
                    onSeek(frame.timestamp);
                    onClose();
                  }}
                  className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden border border-zinc-800 cursor-pointer flex flex-col justify-between p-2 shadow-inner group-hover:scale-[1.02] transition"
                >
                  {/* Top graphic simulation */}
                  <div className="h-[55%] w-full bg-zinc-900/80 rounded border border-zinc-800/80 flex items-center justify-center p-1 text-center">
                    <span className="text-[9px] font-mono text-orange-400 font-semibold leading-tight">
                      {frame.title}
                    </span>
                  </div>

                  {/* Subtitle simulation */}
                  <div className="bg-black/90 px-1 py-0.5 rounded text-[8px] text-center font-bold text-white uppercase border border-orange-500/30">
                    200 FPS H.264
                  </div>

                  {/* Speaker bottom simulation */}
                  <div className="h-[35%] w-full bg-zinc-800/60 rounded flex items-center justify-center text-[8px] text-zinc-400">
                    Facecam
                  </div>

                  {/* Hover Jump Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition gap-1 text-[10px] font-bold">
                    <Play className="w-3 h-3 fill-current" />
                    <span>Aller à {frame.timeFormatted}</span>
                  </div>
                </div>

                {/* Frame Info */}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-white font-bold">#{frame.frameIndex}</span>
                    <span className="text-orange-400">{frame.timeFormatted}</span>
                  </div>

                  <p className="text-[10px] text-zinc-400 truncate">{frame.title}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[10px]">
                    <span className={frame.qcCheck === 'pass' ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                      {frame.qcCheck.toUpperCase()}
                    </span>
                    <span className="text-zinc-500 truncate max-w-[80px]" title={frame.notes}>
                      {frame.notes}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs">
          <span className="text-zinc-500">
            Une vidéo n'est validée que si l'ensemble des 12 images passent le test QC visuel.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
