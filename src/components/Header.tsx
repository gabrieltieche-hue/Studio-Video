import React from 'react';
import { 
  ChevronLeft, Copy, Check, MessageSquare, 
  Folder, Sun, Moon, MoreHorizontal, Bot, 
  Sidebar, PanelLeftClose, PanelLeftOpen, 
  PanelRightClose, PanelRightOpen, Video, 
  Radio, Sparkles, Layers, SlidersHorizontal, Plus
} from 'lucide-react';
import { ShortProject } from '../types/studio';

interface HeaderProps {
  project: ShortProject;
  activeView: 'studio' | 'recorder';
  onChangeView: (view: 'studio' | 'recorder') => void;
  onOpenChatGPTModal: () => void;
  onOpenNewProject: () => void;
  onOpenCopyPromptModal: () => void;
  onCopyPrompt: () => void;
  copiedPrompt: boolean;
  openFeedbacksCount: number;
  
  // Panel Toggles
  showLeftPanel: boolean;
  onToggleLeftPanel: () => void;
  showTranscript: boolean;
  onToggleTranscript: () => void;
  showTimeline: boolean;
  onToggleTimeline: () => void;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  activeView,
  onChangeView,
  onOpenChatGPTModal,
  onOpenNewProject,
  onOpenCopyPromptModal,
  onCopyPrompt,
  copiedPrompt,
  openFeedbacksCount,
  showLeftPanel,
  onToggleLeftPanel,
  showTranscript,
  onToggleTranscript,
  showTimeline,
  onToggleTimeline,
  showRightPanel,
  onToggleRightPanel,
}) => {
  return (
    <header className="h-14 bg-[#101012] border-b border-zinc-800/80 px-2 sm:px-3.5 flex items-center justify-between select-none z-30 shrink-0">
      
      {/* LEFT: Back Arrow + Project Slug + Metadata Subtitle (Matches Melvyn Screenshots) */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={() => onChangeView(activeView === 'studio' ? 'recorder' : 'studio')}
          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition shrink-0"
          title="Basculer de vue"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-xs text-white tracking-tight truncate font-mono">
              {project.slug}
            </span>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">Studio</span>

            {/* Nouveau Short Action Button */}
            <button
              onClick={onOpenNewProject}
              className="ml-1 px-2 py-0.5 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 text-[10px] font-bold flex items-center gap-1 transition"
              title="Créer un nouveau projet / Importer vidéo"
            >
              <Plus className="w-3 h-3" />
              <span>Nouveau</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[10px] text-zinc-500 truncate max-w-xl">
            <span>Format 9:16</span>
            <span>•</span>
            <span>{project.duration}s</span>
            <span>•</span>
            <span className="text-orange-400">Feedback {project.currentVersion}</span>
            <span>•</span>
            <span className="truncate">Script {project.title}</span>
            <span>•</span>
            <span className="truncate">Take {project.sourceVideoName || 'Rush'}</span>
          </div>
        </div>
      </div>

      {/* CENTER: Main Switcher Pills (Studio vs Recorder vs MCP Hub) */}
      <div className="hidden lg:flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800/80">
        <button
          onClick={() => onChangeView('studio')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
            activeView === 'studio'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Video className="w-3.5 h-3.5 text-orange-400" />
          <span>Studio</span>
        </button>

        <button
          onClick={() => onChangeView('recorder')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
            activeView === 'recorder'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-red-400" />
          <span>Prompteur / Recorder</span>
        </button>

        <button
          onClick={onOpenChatGPTModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-950/30 transition"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <Bot className="w-3.5 h-3.5" />
          <span>ChatGPT MCP</span>
        </button>
      </div>

      {/* RIGHT: Panel Toggles + Melvyn's Copy Retours Pill + Chat Button */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Workspace Panes Collapsing Controls (Desktop only) */}
        <div className="hidden lg:flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
          <button
            onClick={onToggleLeftPanel}
            className={`p-1 rounded text-xs transition ${
              showLeftPanel ? 'text-orange-400 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={showLeftPanel ? 'Masquer volet gauche (Takes / Rushs)' : 'Afficher volet gauche'}
          >
            {showLeftPanel ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onToggleTranscript}
            className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition ${
              showTranscript ? 'text-orange-400 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Afficher/Masquer colonne Transcription"
          >
            TXT
          </button>

          <button
            onClick={onToggleTimeline}
            className={`p-1 rounded text-xs transition ${
              showTimeline ? 'text-orange-400 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Afficher/Masquer la Timeline Multi-pistes"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleRightPanel}
            className={`p-1 rounded text-xs transition ${
              showRightPanel ? 'text-orange-400 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={showRightPanel ? 'Masquer panneau retours' : 'Afficher panneau retours'}
          >
            {showRightPanel ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* The Famous "Copier les retours 0" Button from Screenshots 3, 4, 8 */}
        <div className="flex items-center bg-zinc-900 border border-zinc-700/80 rounded-lg overflow-hidden shadow-sm">
          <button
            onClick={onCopyPrompt}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition active:scale-95"
            title="Copier immédiatement le prompt dans le presse-papier"
          >
            {copiedPrompt ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Copié !</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">Copier les retours</span>
                <span className="font-mono text-[11px] text-zinc-400 ml-0.5">
                  {openFeedbacksCount}
                </span>
              </>
            )}
          </button>

          <button
            onClick={onOpenCopyPromptModal}
            className="px-1.5 py-1.5 border-l border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 text-[10px]"
            title="Voir le prompt complet formaté (Markdown / JSON)"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
          </button>
        </div>

        {/* "Chat" Pill Button from Top-Right of Melvyn's UI */}
        <button
          onClick={onOpenChatGPTModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-white text-xs font-semibold transition"
          title="Ouvrir la connexion ChatGPT / MCP"
        >
          <MessageSquare className="w-3.5 h-3.5 text-white" />
          <span className="hidden sm:inline">Chat</span>
        </button>
      </div>
    </header>
  );
};
