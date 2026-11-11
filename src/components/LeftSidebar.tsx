import React, { useState, useRef } from 'react';
import { 
  Instagram, Youtube, Sparkles, Folder, Search, 
  ChevronRight, ChevronDown, Check, Info, Scissors, 
  Clock, Play, Film, MessageSquarePlus, ChevronLeft,
  Plus, Trash2, Upload, Video
} from 'lucide-react';
import { ShortProject, SourceVideo } from '../types/studio';

interface LeftSidebarProps {
  project: ShortProject;
  projects?: ShortProject[];
  onSelectProject?: (project: ShortProject) => void;
  onOpenNewProject?: () => void;
  onDeleteProject?: (id: string) => void;
  onImportVideoFile?: (file: File) => void;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onToggleCutWord: (wordId: string) => void;
  onAddCommentAtTime: (timestamp: number, textPrefix: string) => void;
  onSelectPlatform: (platform: 'instagram' | 'tiktok' | 'youtube_shorts') => void;
  sourceVideos: SourceVideo[];
  showLeftPanel: boolean;
  showTranscript: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  project,
  projects = [],
  onSelectProject,
  onOpenNewProject,
  onDeleteProject,
  onImportVideoFile,
  currentTime,
  onSeek,
  onToggleCutWord,
  onAddCommentAtTime,
  onSelectPlatform,
  sourceVideos,
  showLeftPanel,
  showTranscript,
}) => {
  const [videoSearch, setVideoSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'Projets': true,
    'Pubs': false,
    'Shorts': false,
    '2026-10-29': false,
    '2026-10-28': false,
    '2026-10-27': true
  });

  const toggleFolder = (folderName: string) => {
    setOpenFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportVideoFile) {
      onImportVideoFile(file);
    }
  };

  // Find active word in transcript
  const activeWordIndex = project.transcript.findIndex(
    w => currentTime >= w.start && currentTime <= w.end
  );

  return (
    <div className="flex h-full select-none text-zinc-300">
      
      {/* ============================================================== */}
      {/* COLUMN 1: PROJECTS, PLATFORMS, RENDERS & VIDEOS BROWSER */}
      {/* ============================================================== */}
      {showLeftPanel && (
        <aside className="w-56 bg-[#121214] border-r border-zinc-800/80 flex flex-col h-full text-xs overflow-hidden shrink-0">
          
          <div className="flex-1 overflow-y-auto p-2.5 space-y-4 custom-scrollbar">
            
            {/* 1. Real Projects Section (User can create, switch, and delete projects) */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 mb-1.5 px-1">
                <span>Projets Studio</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-zinc-500">{projects.length || 1}</span>
                  {onOpenNewProject && (
                    <button
                      onClick={onOpenNewProject}
                      className="p-0.5 rounded hover:bg-zinc-800 text-orange-400"
                      title="Nouveau Short"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                {(projects.length > 0 ? projects : [project]).map((p) => {
                  const isCurrent = p.id === project.id;
                  return (
                    <div
                      key={p.id}
                      className={`group w-full p-2 rounded-xl transition flex items-center justify-between cursor-pointer ${
                        isCurrent
                          ? 'bg-zinc-800/90 border border-orange-500/50 text-white shadow-sm'
                          : 'hover:bg-zinc-800/40 text-zinc-400'
                      }`}
                      onClick={() => onSelectProject && onSelectProject(p)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          p.mode === 'faceless_explainer'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        }`}>
                          {p.mode === 'faceless_explainer' ? 'A' : 'B'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-xs text-zinc-200 truncate font-mono">
                            {p.slug}
                          </span>
                          <span className="text-[10px] text-zinc-500 truncate">
                            {p.title}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {isCurrent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        )}
                        {onDeleteProject && projects.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteProject(p.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition"
                            title="Supprimer ce projet"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Platforms (Matches Screenshot 3, 4, 8) */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 mb-1.5 px-1">
                <span>Platforms</span>
                <span className="font-mono text-zinc-500">3</span>
              </div>

              <div className="space-y-1">
                {/* Insta */}
                <button
                  onClick={() => onSelectPlatform('instagram')}
                  className={`w-full text-left p-2 rounded-xl transition flex items-center justify-between ${
                    project.platform === 'instagram'
                      ? 'bg-zinc-800/90 border border-zinc-700/80 text-white'
                      : 'hover:bg-zinc-800/50 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                      IG
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-xs text-zinc-200">{project.currentVersion} • Insta</span>
                      <span className="text-[10px] text-zinc-500">9:16 • DM CTA</span>
                    </div>
                  </div>
                  {project.platform === 'instagram' && (
                    <span className="px-1.5 py-0.5 rounded bg-zinc-700 text-[10px] font-mono text-zinc-200">
                      Here
                    </span>
                  )}
                </button>

                {/* TikTok */}
                <button
                  onClick={() => onSelectPlatform('tiktok')}
                  className={`w-full text-left p-2 rounded-xl transition flex items-center justify-between ${
                    project.platform === 'tiktok'
                      ? 'bg-zinc-800/90 border border-zinc-700/80 text-white'
                      : 'hover:bg-zinc-800/50 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-cyan-600 flex items-center justify-center text-[10px] font-black text-white">
                      TT
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-xs text-zinc-200">{project.currentVersion} • TikTok</span>
                      <span className="text-[10px] text-zinc-500">9:16 • Outro</span>
                    </div>
                  </div>
                </button>

                {/* Shorts */}
                <button
                  onClick={() => onSelectPlatform('youtube_shorts')}
                  className={`w-full text-left p-2 rounded-xl transition flex items-center justify-between ${
                    project.platform === 'youtube_shorts'
                      ? 'bg-zinc-800/90 border border-zinc-700/80 text-white'
                      : 'hover:bg-zinc-800/50 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center text-[10px] font-black text-white">
                      YT
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-xs text-zinc-200">{project.currentVersion} • Short</span>
                      <span className="text-[10px] text-zinc-500">9:16 • YouTube</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Renders • Versions */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 mb-1.5 px-1">
                <span>Renders</span>
                <span className="font-mono text-zinc-500">{project.versions.length || 1}</span>
              </div>

              <div className="space-y-1">
                {project.versions.map((ver) => (
                  <div
                    key={ver.version}
                    className={`p-2 rounded-xl border flex items-center justify-between ${
                      ver.status === 'current'
                        ? 'bg-zinc-800/70 border-zinc-700'
                        : 'hover:bg-zinc-800/40 border-transparent text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-8 rounded bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center text-[9px] font-mono text-orange-400">
                        9:16
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-white">{ver.version}</span>
                        <span className="text-[10px] text-zinc-500">{ver.createdAt}</span>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      ver.status === 'current' ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-500'
                    }`}>
                      {ver.status === 'current' ? 'Current' : 'Done'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Videos & Rushs Library */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 mb-1.5 px-1">
                <span>Vidéos & Rushs</span>
                <span className="font-mono text-zinc-500">{sourceVideos.length || 42}</span>
              </div>

              {/* Import Button */}
              <div className="mb-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-orange-400" />
                  <span>Importer un Rush / Vidéo</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={videoSearch}
                  onChange={(e) => setVideoSearch(e.target.value)}
                  placeholder="Rechercher vidéos..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-7 pr-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>

              {/* Folders */}
              <div className="space-y-1">
                {[
                  { name: 'Rushs importés', count: sourceVideos.length },
                  { name: 'Pubs', count: 68 },
                  { name: 'Shorts', count: 182 },
                  { name: '2026-10-27', count: 4 },
                ].map((f) => (
                  <div key={f.name}>
                    <button
                      onClick={() => toggleFolder(f.name)}
                      className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-zinc-800/50 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Folder className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{f.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">{f.count}</span>
                    </button>

                    {/* Sub-items for open folders */}
                    {openFolders[f.name] && f.name === 'Rushs importés' && (
                      <div className="pl-4 pr-1 py-1 space-y-1">
                        {sourceVideos.map((vid) => (
                          <div key={vid.id} className="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center gap-2">
                            <div className="w-5 h-7 rounded bg-zinc-950 overflow-hidden flex items-center justify-center text-[8px] text-orange-400">
                              ▶
                            </div>
                            <div className="flex flex-col truncate">
                              <span className="text-[11px] font-medium text-white truncate">
                                {vid.name}
                              </span>
                              <span className="text-[9px] text-zinc-500">{vid.duration}s • {vid.resolution}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ============================================================== */}
      {/* COLUMN 2: TRANSCRIPT (With Crisp Active Word Pill like Melvyn) */}
      {/* ============================================================== */}
      {showTranscript && (
        <aside className="w-64 bg-[#111113] border-r border-zinc-800/80 flex flex-col h-full text-xs overflow-hidden">
          {/* Header with info icon */}
          <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between text-zinc-300">
            <span className="font-bold text-xs">Transcript</span>
            <button className="text-zinc-500 hover:text-zinc-300" title="Informations de transcription Whisper">
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Transcript Paragraph with Spoken Word Highlight Pill */}
          <div className="flex-1 overflow-y-auto p-4 leading-relaxed custom-scrollbar">
            {project.transcript && project.transcript.length > 0 ? (
              <div className="text-sm font-normal text-zinc-300 tracking-normal space-x-1">
                {project.transcript.map((item, idx) => {
                  const isActive = activeWordIndex === idx;
                  const isCut = item.isCut;

                  return (
                    <span
                      key={item.id}
                      onClick={() => onSeek(item.start)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onToggleCutWord(item.id);
                      }}
                      onDoubleClick={() => onAddCommentAtTime(item.start, `Retouche mot "${item.word}"`)}
                      className={`inline-block cursor-pointer transition select-none my-0.5 ${
                        isCut
                          ? 'line-through text-zinc-600 bg-red-950/20'
                          : isActive
                          ? 'bg-white text-black font-bold px-1.5 py-0.2 rounded-md shadow-md scale-105 mx-0.5'
                          : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded px-0.5'
                      }`}
                      title={`[${item.start.toFixed(2)}s] Clic: Sauter | Double-clic: Commenter`}
                    >
                      {item.word}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-center p-4 text-zinc-500">
                <span className="font-bold text-zinc-400 text-xs mb-1">No transcript</span>
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  No transcript for this short (older version: the transcript follows the current edit). Feedback keeps its times.
                </p>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
