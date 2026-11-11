import React, { useState } from 'react';
import { 
  Plus, Upload, Link, Sparkles, Video, Film, 
  Check, AlertCircle, Smartphone, Layers
} from 'lucide-react';
import { ShortProject } from '../types/studio';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: {
    title: string;
    slug: string;
    mode: 'faceless_explainer' | 'split_screen_clips';
    platform: 'instagram' | 'tiktok' | 'youtube_shorts';
    duration: number;
    script: string;
    videoUrl?: string;
    videoFileName?: string;
  }) => Promise<void>;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState<'split_screen_clips' | 'faceless_explainer'>('split_screen_clips');
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'youtube_shorts'>('instagram');
  const [duration, setDuration] = useState(45);
  const [videoSourceType, setVideoSourceType] = useState<'upload' | 'url' | 'sample'>('upload');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [script, setScript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const autoSlug = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug || slug.startsWith('short-')) {
      setSlug(autoSlug ? `short-${autoSlug}` : '');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setVideoUrl(objectUrl);
      setUploadedFileName(file.name);
      if (!title) {
        handleTitleChange(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Veuillez renseigner un titre pour le projet.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const finalSlug = slug.trim() || `short-${Date.now()}`;
      await onCreateProject({
        title: title.trim(),
        slug: finalSlug,
        mode,
        platform,
        duration,
        script: script.trim() || `Découvrez comment créer un Short automatisé avec l'agent IA, synchronisé mot à mot avec Whisper.`,
        videoUrl: videoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        videoFileName: uploadedFileName || 'rush-personnalise.mp4'
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du projet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#141417] border border-zinc-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-300">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Créer un Nouveau Projet de Short
              </h2>
              <p className="text-[11px] text-zinc-400">
                Importez votre vidéo, générez les sous-titres et connectez votre ChatGPT.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-white">✕</button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs custom-scrollbar">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Titre du Short :</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ex: Mon premier montage IA"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Identifiant Slug (unique) :</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex: short-premier-montage"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 font-mono text-orange-400 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Production Mode */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">Format de Production :</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('split_screen_clips')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  mode === 'split_screen_clips'
                    ? 'bg-orange-500/15 border-orange-500/50 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span className="font-bold text-xs text-orange-300 mb-1">Mode B — Split-Screen Clips</span>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  58% infographies / motion en haut + sous-titres centrés + 42% vidéo rush en bas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('faceless_explainer')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  mode === 'faceless_explainer'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span className="font-bold text-xs text-cyan-300 mb-1">Mode A — Faceless Explainer</span>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  100% scènes animées (sans visage) : graphiques, fusée, données dynamiques.
                </p>
              </button>
            </div>
          </div>

          {/* Video Source (File upload or URL) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-zinc-300 font-semibold">Vidéo Source (Rush) :</label>
              <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setVideoSourceType('upload')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    videoSourceType === 'upload' ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                  }`}
                >
                  Téléverser fichier
                </button>
                <button
                  type="button"
                  onClick={() => setVideoSourceType('url')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    videoSourceType === 'url' ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                  }`}
                >
                  Coller URL
                </button>
              </div>
            </div>

            {videoSourceType === 'upload' ? (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-700 hover:border-orange-500/80 rounded-xl cursor-pointer bg-zinc-950/60 transition group">
                <Upload className="w-6 h-6 text-zinc-500 group-hover:text-orange-400 mb-1" />
                <span className="font-semibold text-zinc-300 text-xs">
                  {uploadedFileName ? uploadedFileName : 'Glissez votre vidéo ici ou cliquez pour choisir'}
                </span>
                <span className="text-[10px] text-zinc-500 mt-0.5">MP4, WebM, MOV supportés</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://.../video.mp4"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-orange-500"
              />
            )}
          </div>

          {/* Script & Voice */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              Script / Texte pour transcription Whisper (optionnel) :
            </label>
            <textarea
              rows={3}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Collez ici le texte prononcé pour caler instantanément les sous-titres mot par mot..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 resize-none font-sans"
            />
          </div>

          {/* Platform & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Plateforme :</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="instagram">Instagram Reels (DM CTA)</option>
                <option value="tiktok">TikTok (Outro voix modifiée)</option>
                <option value="youtube_shorts">YouTube Shorts</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Durée cible :</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-orange-500"
              >
                <option value={30}>30 secondes</option>
                <option value={45}>45 secondes (standard)</option>
                <option value={60}>60 secondes (1 minute)</option>
              </select>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-lg transition shadow-lg shadow-orange-500/20 text-xs flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Initialisation...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Créer le Short</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
