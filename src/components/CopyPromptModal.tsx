import React, { useState } from 'react';
import { Copy, Check, Sparkles, Bot, Terminal, Code2 } from 'lucide-react';
import { ShortProject } from '../types/studio';

interface CopyPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ShortProject;
}

export const CopyPromptModal: React.FC<CopyPromptModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');

  if (!isOpen) return null;

  const openFeedbacks = project.feedbacks.filter(f => !f.resolved);

  const generateMarkdownPrompt = () => {
    const lines = [
      `# 🎬 RETOURS MONTAGE STUDIO — PROJET : ${project.slug} (Version ${project.currentVersion})`,
      `> **Titre** : ${project.title}`,
      `> **Format** : ${project.mode === 'split_screen_clips' ? 'Mode B — Split-Screen Clips (58% animations / 42% rush)' : 'Mode A — Faceless Explainer (100% Motion)'}`,
      `> **Durée** : ${project.duration}s | **Plateforme** : ${project.platform.toUpperCase()} | **Résolution** : 1080×1920 (9:16)`,
      '',
      '---',
      '## 📝 LISTE DES RETOURS ET CORRECTIONS HORODATÉES :',
      ''
    ];

    if (openFeedbacks.length === 0) {
      lines.push('✅ Aucun retour en attente. Toutes les corrections précédentes ont été validées (PASS QC). Le projet est prêt pour l\'export final.');
    } else {
      openFeedbacks.forEach((fb, idx) => {
        lines.push(`### [${fb.timeFormatted}] — Modification #${idx + 1}`);
        if (fb.targetElement) {
          lines.push(`- **Calque ciblé** : \`${fb.targetElement}\``);
        }
        if (fb.quoteText) {
          lines.push(`- **Transcription au moment du mot** : *"${fb.quoteText}"*`);
        }
        lines.push(`- **Instruction précise** : ${fb.text}`);
        if (fb.drawingSnapshot) {
          lines.push(`- **Annotation graphique** : [Capture d'écran annotée attachée dans le studio]`);
        }
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('## ⚙️ INSTRUCTIONS TECHNIQUES POUR L\'IA (ChatGPT / Claude Code) :');
    lines.push('1. Applique les modifications dans `spec.json` ou dans les composants d\'animation `window.setT(t)`.');
    lines.push('2. Respecte les règles de qualité : changement visuel toutes les 1.5s, sous-titres de 2 à 5 mots max.');
    lines.push(`3. Après mise à jour, lance la commande \`render_short\` pour générer la version v${project.versions.length + 1}.`);

    return lines.join('\n');
  };

  const generateJsonPrompt = () => {
    return JSON.stringify({
      project: {
        id: project.id,
        slug: project.slug,
        currentVersion: project.currentVersion,
        duration: project.duration,
        mode: project.mode,
        platform: project.platform
      },
      openFeedbacksCount: openFeedbacks.length,
      feedbacks: openFeedbacks.map(f => ({
        timecode: f.timeFormatted,
        timestamp: f.timestamp,
        targetElement: f.targetElement,
        instruction: f.text,
        quote: f.quoteText,
        hasDrawing: !!f.drawingSnapshot
      }))
    }, null, 2);
  };

  const currentContent = format === 'markdown' ? generateMarkdownPrompt() : generateJsonPrompt();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#141417] border border-zinc-700/80 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-zinc-300">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Prompt de Retours pour ChatGPT & Claude
              </h2>
              <p className="text-[11px] text-zinc-400">
                {openFeedbacks.length} modification{openFeedbacks.length > 1 ? 's' : ''} horodatée{openFeedbacks.length > 1 ? 's' : ''} compilée{openFeedbacks.length > 1 ? 's' : ''} prête{openFeedbacks.length > 1 ? 's' : ''} à coller.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-950 p-0.5 rounded border border-zinc-800 text-[10px]">
              <button
                onClick={() => setFormat('markdown')}
                className={`px-2 py-0.5 rounded font-medium ${format === 'markdown' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
              >
                Markdown
              </button>
              <button
                onClick={() => setFormat('json')}
                className={`px-2 py-0.5 rounded font-medium ${format === 'json' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
              >
                JSON
              </button>
            </div>
            <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-white">✕</button>
          </div>
        </div>

        {/* Preview Code Area */}
        <div className="flex-1 p-4 overflow-y-auto bg-zinc-950/80 custom-scrollbar font-mono text-xs leading-relaxed text-zinc-200">
          <pre className="whitespace-pre-wrap">{currentContent}</pre>
        </div>

        {/* Footer with Master Copy Button */}
        <div className="p-3 border-t border-zinc-800 bg-[#111113] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-sans">
            Collez ce texte directement dans le chat avec ChatGPT ou Claude Code.
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
            >
              Fermer
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-orange-500/25 active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>Prompt Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copier le Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
