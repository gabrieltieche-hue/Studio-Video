import React, { useState } from 'react';
import { 
  Check, CheckSquare, MessageSquare, Scissors, 
  Sparkles, Clock, Trash2, Edit3, Paperclip, 
  ChevronDown, ChevronUp, Image as ImageIcon,
  Info, ExternalLink, Plus
} from 'lucide-react';
import { ShortProject, FeedbackItem } from '../types/studio';

interface RightSidebarProps {
  project: ShortProject;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onAddFeedback: (text: string, type?: 'comment' | 'cut' | 'idea') => void;
  onToggleResolveFeedback: (id: string, currentStatus: boolean) => void;
  onDeleteFeedback: (id: string) => void;
  onCopyPrompt: () => void;
  copiedPrompt: boolean;
  showRightPanel: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  project,
  currentTime,
  onSeek,
  onAddFeedback,
  onToggleResolveFeedback,
  onDeleteFeedback,
  onCopyPrompt,
  copiedPrompt,
  showRightPanel,
}) => {
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('all');
  const [activeInputTab, setActiveInputTab] = useState<'comment' | 'cut' | 'idea'>('comment');
  const [feedbackText, setFeedbackText] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!showRightPanel) return null;

  const feedbacks = project.feedbacks || [];
  const openCount = feedbacks.filter(f => !f.resolved).length;
  const resolvedCount = feedbacks.filter(f => f.resolved).length;

  const filteredFeedbacks = feedbacks.filter(f => {
    if (filter === 'open') return !f.resolved;
    if (filter === 'resolved') return f.resolved;
    return true;
  });

  const formatCurrentTime = () => {
    const mins = Math.floor(currentTime / 60);
    const secs = (currentTime % 60).toFixed(2);
    return `${mins < 10 ? '0' : ''}${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    onAddFeedback(feedbackText.trim(), activeInputTab);
    setFeedbackText('');
  };

  return (
    <aside className="w-80 bg-[#121214] border-l border-zinc-800/80 flex flex-col h-full select-none text-zinc-300 text-xs overflow-hidden shrink-0">
      
      {/* 1. Header with Filters (Feedback | Open N | Resolved N | All N) */}
      <div className="h-12 border-b border-zinc-800/80 px-3.5 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs text-white">Feedback</span>
          {openCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            All {feedbacks.length}
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              filter === 'open' ? 'bg-zinc-800 text-orange-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Open {openCount}
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              filter === 'resolved' ? 'bg-zinc-800 text-emerald-400 font-medium' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Done {resolvedCount}
          </button>
        </div>
      </div>

      {/* 2. Main Feedback Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        
        {/* Helper Banner */}
        <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span>Retours pour l'agent IA ({openCount} à corriger)</span>
          </div>
          <button
            onClick={onCopyPrompt}
            className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 text-[10px] font-bold border border-orange-500/30"
          >
            Copier Prompt
          </button>
        </div>

        {/* Empty state */}
        {filteredFeedbacks.length === 0 && (
          <div className="py-8 px-4 text-center space-y-2">
            <div className="w-8 h-8 rounded-full bg-zinc-900 mx-auto flex items-center justify-center text-zinc-600">
              💬
            </div>
            <span className="font-bold text-xs text-white block">
              Aucun retour dans cette vue
            </span>
            <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs mx-auto">
              Mettez la vidéo en pause, appuyez sur <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">C</kbd> ou utilisez l'inspecteur pour pointer un élément à corriger.
            </p>
          </div>
        )}

        {/* Feedback Cards */}
        {filteredFeedbacks.map((fb) => (
          <div
            key={fb.id}
            className={`p-3 rounded-xl border transition space-y-2 ${
              fb.resolved
                ? 'bg-zinc-900/40 border-zinc-800/60 opacity-70'
                : 'bg-zinc-900/90 border-zinc-700/90 hover:border-zinc-600 shadow-sm'
            }`}
          >
            {/* Top line: Checkbox + Tag + Timecode + Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleResolveFeedback(fb.id, fb.resolved)}
                  className={`w-4 h-4 rounded flex items-center justify-center text-[10px] transition cursor-pointer ${
                    fb.resolved ? 'bg-emerald-500 text-black font-bold' : 'border border-zinc-600 bg-zinc-800 hover:border-orange-500'
                  }`}
                  title={fb.resolved ? 'Marquer comme non-résolu' : 'Marquer comme résolu'}
                >
                  {fb.resolved && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                <div 
                  onClick={() => onSeek(fb.timestamp)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold cursor-pointer transition"
                  title="Sauter à ce timecode"
                >
                  <MessageSquare className="w-2.5 h-2.5 text-orange-400" />
                  <span>Comment</span>
                  <span className="font-mono text-orange-400 font-bold">
                    {fb.timeFormatted}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-zinc-500">
                <button 
                  type="button"
                  onClick={() => onDeleteFeedback(fb.id)} 
                  className="p-1 hover:text-red-400 transition"
                  title="Supprimer ce retour"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Target element or Quoted line from transcript */}
            {fb.targetElement && (
              <div className="text-[10px] font-mono text-orange-300 bg-zinc-950 px-2 py-1 rounded border border-zinc-800 truncate">
                <span className="text-zinc-500">Cible : </span>
                {fb.targetElement}
              </div>
            )}
            {fb.quoteText && (
              <div className="text-[11px] font-serif italic text-zinc-500 pl-2 border-l border-zinc-700">
                "{fb.quoteText}"
              </div>
            )}

            {/* Feedback text (clean, crisp white when active; strikethrough only when resolved) */}
            <p className={`text-xs leading-relaxed ${
              fb.resolved ? 'text-zinc-500 line-through' : 'text-zinc-100 font-medium'
            }`}>
              {fb.text}
            </p>

            {/* AI Resolution Note (if present) */}
            {fb.resolutionNote && (
              <div className="flex items-start gap-1.5 text-[11px] text-zinc-300 leading-snug pt-1 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800">
                <span className="text-emerald-400 shrink-0 font-bold">✨</span>
                <span>{fb.resolutionNote}</span>
              </div>
            )}

            {/* Image attachment thumbnail */}
            {fb.drawingSnapshot && (
              <div className="pt-1">
                <img
                  src={fb.drawingSnapshot}
                  alt="Capture annotée"
                  onClick={() => setPreviewImage(fb.drawingSnapshot!)}
                  className="w-20 h-14 object-cover rounded-md border border-zinc-700 cursor-pointer hover:opacity-80 bg-black"
                />
              </div>
            )}

            {/* Date footer */}
            <div className="flex items-center justify-between text-[10px] text-zinc-600 font-mono pt-1 border-t border-zinc-800/60">
              <span>{fb.author || 'Melvyn'}</span>
              <span>{fb.createdAt}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Bottom Feedback Input Bar */}
      <form onSubmit={handleAddSubmit} className="border-t border-zinc-800/80 bg-[#141417] p-2.5 space-y-2">
        {/* Sub-tabs: Comment / Cut / Ideas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveInputTab('comment')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition ${
                activeInputTab === 'comment' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <MessageSquare className="w-2.5 h-2.5 text-orange-400" />
              <span>Comment</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputTab('cut')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition ${
                activeInputTab === 'cut' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Scissors className="w-2.5 h-2.5 text-red-400" />
              <span>Cut</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputTab('idea')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition ${
                activeInputTab === 'idea' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
              <span>Ideas</span>
            </button>
          </div>

          <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
            <span>At</span>
            <Clock className="w-2.5 h-2.5 text-orange-400" />
            <span className="text-zinc-300 font-bold">{formatCurrentTime()}</span>
          </div>
        </div>

        {/* Input box */}
        <textarea
          rows={2}
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Describe what you want to change..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 resize-none font-sans"
        />

        {/* Footer shortcuts & Add button */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
          <div className="flex items-center gap-2">
            <span><kbd className="px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">C</kbd> write</span>
            <span><kbd className="px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">Enter</kbd> add</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-3.5 py-1 bg-white hover:bg-zinc-200 text-black font-bold rounded-lg transition active:scale-95 shadow-sm text-xs"
            >
              Add
            </button>
          </div>
        </div>
      </form>

      {/* Snapshot Preview modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl p-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Capture" className="w-full rounded-lg bg-black" />
          </div>
        </div>
      )}
    </aside>
  );
};
