import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, FileText, MessageSquare, Folder, Plus, Sparkles 
} from 'lucide-react';
import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { Player916 } from './components/Player916';
import { PlaybackControls } from './components/PlaybackControls';
import { MultiTrackTimeline } from './components/MultiTrackTimeline';
import { RightSidebar } from './components/RightSidebar';
import { RecorderView } from './components/RecorderView';
import { ChatGPTModal } from './components/ChatGPTModal';
import { ContactSheetModal } from './components/ContactSheetModal';
import { MotionEditorModal } from './components/MotionEditorModal';
import { NewProjectModal } from './components/NewProjectModal';
import { CopyPromptModal } from './components/CopyPromptModal';
import { ShortProject, SourceVideo, FeedbackItem } from './types/studio';

const defaultFeedbacks: FeedbackItem[] = [
  {
    id: 'fb-101',
    timestamp: 2.15,
    timeFormatted: '0:02',
    quoteText: 'mais personne ne veut te dire comment ou',
    text: 'ici faut montrer des vraies vidéos de créateurs qui disent qu\'ils montent avec claude',
    resolutionNote: 'Le hook montre maintenant 3 vrais reels de créateurs (iamajene, dryxio, adilet) qui disent monter avec Claude.',
    author: 'Melvyn',
    resolved: true,
    createdAt: 'Oct 27, 02:00 PM',
    type: 'comment',
    drawingSnapshot: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="100%" height="100%" fill="%231a1a1a"/><text x="100" y="60" fill="%23ff6600" font-size="12" text-anchor="middle">3 REELS CLAUDE</text></svg>'
  },
  {
    id: 'fb-102',
    timestamp: 70.0,
    timeFormatted: '1:10',
    quoteText: 'Claude. Il va étudier le skill et te',
    text: 'étape 3 ici en bleu je sais pas c\'est moche ce bleu dégage le bleu avec juste du orange partout s\'il te plaît pour match la da de claude',
    resolutionNote: 'Plus de bleu nulle part : compteurs, dossiers, boutons et surlignages sont en orange Claude.',
    author: 'Melvyn',
    resolved: true,
    createdAt: 'Oct 27, 02:02 PM',
    type: 'comment'
  },
  {
    id: 'fb-103',
    timestamp: 7.43,
    timeFormatted: '0:07',
    quoteText: 'pour créer ton propre monteur IA',
    text: 'ajoute une animation de checklist avec prompts, étapes et outils cochés',
    resolutionNote: 'Boîte de checklist ajoutée avec les trois badges validés.',
    author: 'Melvyn',
    resolved: false,
    createdAt: 'Oct 27, 02:30 PM',
    type: 'comment'
  }
];

export default // In production, the API key is entered once per browser tab. The server exchanges
// the bearer header for an HttpOnly same-origin cookie used by the native video player.
async function studioFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers, credentials: 'same-origin' });
  };
  let token = sessionStorage.getItem('studio_api_key');
  let response = await send(token);
  if (response.status === 401) {
    const entered = window.prompt('Clé d’accès Video Agent Studio (elle reste dans cet onglet uniquement) :');
    if (entered && entered.trim().length >= 32) {
      token = entered.trim();
      sessionStorage.setItem('studio_api_key', token);
      response = await send(token);
    } else {
      sessionStorage.removeItem('studio_api_key');
    }
  }
  return response;
}

function App() {
  const [activeView, setActiveView] = useState<'studio' | 'recorder'>('studio');
  const [projects, setProjects] = useState<ShortProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<ShortProject | null>(null);
  const [sourceVideos, setSourceVideos] = useState<SourceVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Panel Visibility Toggles (To satisfy user's request: "on doit pouvoir cacher ou diminuer les fenetres")
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Playback state
  const [currentTime, setCurrentTime] = useState(7.43);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  // Responsive Mobile Tab navigation
  const [mobileTab, setMobileTab] = useState<'player' | 'transcript' | 'feedback' | 'projects'>('player');

  // UI Modals
  const [chatGptModalOpen, setChatGptModalOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [copyPromptModalOpen, setCopyPromptModalOpen] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [motionEditorOpen, setMotionEditorOpen] = useState(false);

  // Status & Notifications
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Real Project Creation Handler
  const handleCreateProject = async (data: {
    title: string;
    slug: string;
    mode: 'faceless_explainer' | 'split_screen_clips';
    platform: 'instagram' | 'tiktok' | 'youtube_shorts';
    duration: number;
    script: string;
    videoUrl?: string;
    videoFileName?: string;
  }) => {
    try {
      const res = await studioFetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la création du projet');
      }
      const result = await res.json();
      const created: ShortProject = {
        ...result.project,
        feedbacks: []
      };
      setProjects(prev => [created, ...prev]);
      setSelectedProject(created);
      setCurrentTime(0);
      setIsPlaying(false);
      showToast(`Projet "${created.title}" créé avec succès !`);
    } catch (e: any) {
      showToast(e.message || 'Erreur création');
      throw e;
    }
  };

  // Delete Project Handler
  const handleDeleteProject = async (id: string) => {
    try {
      await studioFetch(`/api/studio/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => {
        const updated = prev.filter(p => p.id !== id);
        if (selectedProject?.id === id && updated.length > 0) {
          setSelectedProject(updated[0]);
          setCurrentTime(0);
        }
        return updated;
      });
      showToast('Projet supprimé');
    } catch (e) {
      showToast('Erreur suppression projet');
    }
  };

  // Video File Import Handler
  const handleImportVideoFile = async (file: File) => {
    try {
      const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'application/octet-stream'];
      if (file.size === 0 || file.size > 250 * 1024 * 1024) {
        throw new Error('Fichier vide ou supérieur à 250 Mo.');
      }
      if (file.type && !allowed.includes(file.type)) {
        throw new Error('Format non pris en charge. Utilisez MP4, MOV ou WebM.');
      }

      const response = await studioFetch('/api/studio/videos/upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name)
        },
        body: file
      });
      const payload = await response.json();
      if (!response.ok || !payload.video) {
        throw new Error(payload.error || 'Import serveur échoué.');
      }

      const uploaded = payload.video as SourceVideo;
      const previewUrl = URL.createObjectURL(file);
      const newVid: SourceVideo = {
        ...uploaded,
        url: previewUrl,
        category: 'Shorts'
      };
      setSourceVideos(prev => [newVid, ...prev.filter(v => v.name !== uploaded.name)]);

      if (selectedProject) {
        const update = await studioFetch(`/api/studio/projects/${selectedProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceVideoName: uploaded.name,
            speakerVideoUrl: uploaded.url,
            duration: uploaded.duration
          })
        });
        if (!update.ok) throw new Error('La vidéo a été importée, mais son association au projet a échoué.');
        setSelectedProject({
          ...selectedProject,
          sourceVideoName: uploaded.name,
          speakerVideoUrl: previewUrl,
          duration: uploaded.duration
        });
      }
      showToast(`Vidéo "${uploaded.name}" importée et vérifiée par FFprobe.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l’import de la vidéo.';
      showToast(message);
    }
  };

  // Fetch initial project data from server
  const loadProjects = async () => {
    try {
      const res = await studioFetch('/api/studio/projects');
      if (res.ok) {
        const data = await res.json();
        if (data.projects && data.projects.length > 0) {
          const firstProj = data.projects[0];
          setProjects(data.projects);
          setSelectedProject(firstProj);
        }
      }

      const vidRes = await studioFetch('/api/studio/videos');
      if (vidRes.ok) {
        const vidData = await vidRes.json();
        if (vidData.videos) {
          setSourceVideos(vidData.videos);
        }
      }
    } catch (err) {
      console.warn('Backend warning', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Keyboard Shortcuts: Spacebar for play/pause, Arrow keys, C for comment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (selectedProject) {
          setCurrentTime(t => Math.max(0, t - (1 / selectedProject.fps)));
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (selectedProject) {
          setCurrentTime(t => Math.min(selectedProject.duration, t + (1 / selectedProject.fps)));
        }
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const input = document.querySelector('textarea[placeholder*="Describe"]') as HTMLTextAreaElement;
        if (input) input.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProject]);

  // Main High-Precision Playback Loop
  useEffect(() => {
    if (!isPlaying || !selectedProject) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTimeRef.current = Date.now();

    const updateFrame = () => {
      const now = Date.now();
      const deltaSeconds = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setCurrentTime(prevTime => {
        const nextTime = prevTime + (deltaSeconds * playbackSpeed);
        if (nextTime >= selectedProject.duration) {
          setIsPlaying(false);
          return 0;
        }
        return nextTime;
      });

      animFrameRef.current = requestAnimationFrame(updateFrame);
    };

    animFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, selectedProject]);

  // Actions
  const handleSeek = (time: number) => {
    if (selectedProject) {
      setCurrentTime(Math.max(0, Math.min(selectedProject.duration, time)));
    }
  };

  const handleToggleCutWord = async (wordId: string) => {
    if (!selectedProject) return;

    setSelectedProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        transcript: prev.transcript.map(w => 
          w.id === wordId ? { ...w, isCut: !w.isCut } : w
        )
      };
    });
    showToast('Mot coupé du montage');
  };

  const handleAddFeedbackWithSnapshot = async (
    time: number,
    text: string,
    targetElement?: string,
    snapshot?: string,
    type: 'comment' | 'cut' | 'idea' = 'comment'
  ) => {
    if (!selectedProject) return;

    const timeFormatted = `00:${time < 10 ? '0' : ''}${time.toFixed(2)}`;
    const newFb: FeedbackItem = {
      id: `fb-${Date.now()}`,
      timestamp: time,
      timeFormatted,
      text,
      quoteText: selectedProject.transcript.find(w => time >= w.start && time <= w.end)?.word,
      author: 'Melvyn',
      resolved: false,
      targetElement,
      drawingSnapshot: snapshot,
      createdAt: 'A l\'instant',
      type
    };

    setSelectedProject(prev => prev ? ({
      ...prev,
      feedbacks: [newFb, ...prev.feedbacks]
    }) : prev);

    showToast(`Retour ajouté à [${timeFormatted}]`);
  };

  const handleToggleResolveFeedback = (id: string, currentStatus: boolean) => {
    if (!selectedProject) return;

    setSelectedProject(prev => prev ? ({
      ...prev,
      feedbacks: prev.feedbacks.map(f => f.id === id ? { ...f, resolved: !currentStatus } : f)
    }) : prev);
  };

  const handleDeleteFeedback = (id: string) => {
    if (!selectedProject) return;

    setSelectedProject(prev => prev ? ({
      ...prev,
      feedbacks: prev.feedbacks.filter(f => f.id !== id)
    }) : prev);
    showToast('Retour supprimé');
  };

  const handleSelectPlatform = (platform: 'instagram' | 'tiktok' | 'youtube_shorts') => {
    if (!selectedProject) return;
    setSelectedProject({ ...selectedProject, platform });
    showToast(`Plateforme sélectionnée : ${platform}`);
  };

  const handleCopyPrompt = async () => {
    if (!selectedProject) return;

    const openItems = selectedProject.feedbacks.filter(f => !f.resolved);
    const lines = [
      `# RETOURS STUDIO VIDEO AGENT — Projet: ${selectedProject.slug} (${selectedProject.currentVersion})`,
      `Format 9:16 • Durée: ${selectedProject.duration}s`,
      '',
      openItems.length === 0 ? 'Tous les retours sont résolus. Prêt pour rendu final.' : 'Retours à traiter :',
      ...openItems.map((fb, idx) => `### #${idx + 1} à [${fb.timeFormatted}]\n- Instruction: ${fb.text}\n`)
    ];

    await navigator.clipboard.writeText(lines.join('\n'));
    setCopiedPrompt(true);
    showToast('Prompt formaté copié pour ChatGPT / Claude !');
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  if (isLoading || !selectedProject) {
    return (
      <div className="w-screen h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-400 gap-3 font-mono">
        <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        <span className="text-xs">Chargement du Studio Melvynx...</span>
      </div>
    );
  }

  const currentServerUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const openCount = selectedProject.feedbacks.filter(f => !f.resolved).length;

  return (
    <div className="w-screen h-screen bg-[#0c0c0e] text-zinc-200 flex flex-col overflow-hidden font-sans">
      
      {/* 1. TOP HEADER (Studio vs Recorder + Toggles + New Project + Copy Prompt) */}
      <Header
        project={selectedProject}
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenChatGPTModal={() => setChatGptModalOpen(true)}
        onOpenNewProject={() => setNewProjectModalOpen(true)}
        onOpenCopyPromptModal={() => setCopyPromptModalOpen(true)}
        onCopyPrompt={handleCopyPrompt}
        copiedPrompt={copiedPrompt}
        openFeedbacksCount={openCount}
        showLeftPanel={showLeftPanel}
        onToggleLeftPanel={() => setShowLeftPanel(!showLeftPanel)}
        showTranscript={showTranscript}
        onToggleTranscript={() => setShowTranscript(!showTranscript)}
        showTimeline={showTimeline}
        onToggleTimeline={() => setShowTimeline(!showTimeline)}
        showRightPanel={showRightPanel}
        onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
      />

      {/* 2. MAIN VIEW: STUDIO vs RECORDER */}
      {activeView === 'recorder' ? (
        <RecorderView
          onBackToStudio={() => setActiveView('studio')}
          onOpenChatGPT={() => setChatGptModalOpen(true)}
        />
      ) : (
        /* STUDIO VIEW */
        <>
          {/* DESKTOP LAYOUT (>= 1024px): Full Multi-Column Studio identical to Melvyn Screenshots */}
          <div className="hidden lg:flex flex-1 overflow-hidden">
            {/* Left Column 1 (Projects, Platforms, Renders, Videos) & Column 2 (Transcript) */}
            <LeftSidebar
              project={selectedProject}
              projects={projects}
              onSelectProject={(p) => {
                setSelectedProject(p);
                setCurrentTime(0);
              }}
              onOpenNewProject={() => setNewProjectModalOpen(true)}
              onDeleteProject={handleDeleteProject}
              onImportVideoFile={handleImportVideoFile}
              currentTime={currentTime}
              onSeek={handleSeek}
              onToggleCutWord={handleToggleCutWord}
              onAddCommentAtTime={(t, p) => handleAddFeedbackWithSnapshot(t, p)}
              onSelectPlatform={handleSelectPlatform}
              sourceVideos={sourceVideos}
              showLeftPanel={showLeftPanel}
              showTranscript={showTranscript}
            />

            {/* Center: 9:16 Video Player, Playback Controls & Multi-Track Timeline */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0c] relative">
              <div className="flex-1 overflow-hidden relative flex items-center justify-center p-2">
                <Player916
                  project={selectedProject}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onPause={() => setIsPlaying(false)}
                  onAddFeedbackWithSnapshot={handleAddFeedbackWithSnapshot}
                />
              </div>

              <PlaybackControls
                project={selectedProject}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onSeek={handleSeek}
                playbackSpeed={playbackSpeed}
                onChangeSpeed={setPlaybackSpeed}
              />

              {showTimeline && (
                <MultiTrackTimeline
                  project={selectedProject}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              )}
            </main>

            {/* Right: Feedback Manager Sidebar */}
            <RightSidebar
              project={selectedProject}
              currentTime={currentTime}
              onSeek={handleSeek}
              onAddFeedback={(text, type) => handleAddFeedbackWithSnapshot(currentTime, text, undefined, undefined, type)}
              onToggleResolveFeedback={handleToggleResolveFeedback}
              onDeleteFeedback={handleDeleteFeedback}
              onCopyPrompt={handleCopyPrompt}
              copiedPrompt={copiedPrompt}
              showRightPanel={showRightPanel}
            />
          </div>

          {/* MOBILE / TABLET LAYOUT (< 1024px): Dedicated Single-Column Views with Bottom Navigation */}
          <div className="lg:hidden flex-1 flex flex-col overflow-hidden relative">
            {mobileTab === 'player' && (
              <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0c] relative">
                <div className="flex-1 overflow-hidden relative flex items-center justify-center p-2">
                  <Player916
                    project={selectedProject}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    onPause={() => setIsPlaying(false)}
                    onAddFeedbackWithSnapshot={handleAddFeedbackWithSnapshot}
                  />
                </div>

                <PlaybackControls
                  project={selectedProject}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying(!isPlaying)}
                  onSeek={handleSeek}
                  playbackSpeed={playbackSpeed}
                  onChangeSpeed={setPlaybackSpeed}
                />

                <MultiTrackTimeline
                  project={selectedProject}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              </main>
            )}

            {mobileTab === 'transcript' && (
              <div className="flex-1 overflow-hidden bg-[#111113]">
                <LeftSidebar
                  project={selectedProject}
                  projects={projects}
                  currentTime={currentTime}
                  onSeek={(t) => {
                    handleSeek(t);
                    setMobileTab('player');
                  }}
                  onToggleCutWord={handleToggleCutWord}
                  onAddCommentAtTime={(t, p) => {
                    handleAddFeedbackWithSnapshot(t, p);
                    setMobileTab('feedback');
                  }}
                  onSelectPlatform={handleSelectPlatform}
                  sourceVideos={sourceVideos}
                  showLeftPanel={false}
                  showTranscript={true}
                />
              </div>
            )}

            {mobileTab === 'feedback' && (
              <div className="flex-1 overflow-hidden bg-[#121214]">
                <RightSidebar
                  project={selectedProject}
                  currentTime={currentTime}
                  onSeek={(t) => {
                    handleSeek(t);
                    setMobileTab('player');
                  }}
                  onAddFeedback={(text, type) => handleAddFeedbackWithSnapshot(currentTime, text, undefined, undefined, type)}
                  onToggleResolveFeedback={handleToggleResolveFeedback}
                  onDeleteFeedback={handleDeleteFeedback}
                  onCopyPrompt={handleCopyPrompt}
                  copiedPrompt={copiedPrompt}
                  showRightPanel={true}
                />
              </div>
            )}

            {mobileTab === 'projects' && (
              <div className="flex-1 overflow-hidden bg-[#121214]">
                <LeftSidebar
                  project={selectedProject}
                  projects={projects}
                  onSelectProject={(p) => {
                    setSelectedProject(p);
                    setCurrentTime(0);
                    setMobileTab('player');
                  }}
                  onOpenNewProject={() => setNewProjectModalOpen(true)}
                  onDeleteProject={handleDeleteProject}
                  onImportVideoFile={handleImportVideoFile}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  onToggleCutWord={handleToggleCutWord}
                  onAddCommentAtTime={(t, p) => handleAddFeedbackWithSnapshot(t, p)}
                  onSelectPlatform={handleSelectPlatform}
                  sourceVideos={sourceVideos}
                  showLeftPanel={true}
                  showTranscript={false}
                />
              </div>
            )}

            {/* Mobile Bottom Navigation Bar */}
            <nav className="h-14 bg-[#101012] border-t border-zinc-800/90 flex items-center justify-around shrink-0 z-40 select-none">
              <button
                onClick={() => setMobileTab('player')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition ${
                  mobileTab === 'player' ? 'text-orange-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Video className="w-4 h-4" />
                <span className="text-[10px]">Lecteur</span>
              </button>

              <button
                onClick={() => setMobileTab('transcript')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition ${
                  mobileTab === 'transcript' ? 'text-orange-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="text-[10px]">Transcript</span>
              </button>

              <button
                onClick={() => setMobileTab('feedback')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg relative transition ${
                  mobileTab === 'feedback' ? 'text-orange-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <div className="relative">
                  <MessageSquare className="w-4 h-4" />
                  {openCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-orange-500 text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {openCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px]">Retours</span>
              </button>

              <button
                onClick={() => setMobileTab('projects')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition ${
                  mobileTab === 'projects' ? 'text-orange-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Folder className="w-4 h-4" />
                <span className="text-[10px]">Projets</span>
              </button>
            </nav>
          </div>
        </>
      )}

      {/* 3. MODALS */}
      {/* ChatGPT / MCP Connector Hub */}
      <ChatGPTModal
        isOpen={chatGptModalOpen}
        onClose={() => setChatGptModalOpen(false)}
        serverUrl={currentServerUrl}
      />

      {/* New Project & Video Import Modal */}
      <NewProjectModal
        isOpen={newProjectModalOpen}
        onClose={() => setNewProjectModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Copy Prompt for ChatGPT & Claude Modal */}
      <CopyPromptModal
        isOpen={copyPromptModalOpen}
        onClose={() => setCopyPromptModalOpen(false)}
        project={selectedProject}
      />

      {/* QC Contact Sheet (12 frames) */}
      <ContactSheetModal
        isOpen={contactSheetOpen}
        onClose={() => setContactSheetOpen(false)}
        project={selectedProject}
        onSeek={handleSeek}
      />

      {/* Motion Component Editor */}
      <MotionEditorModal
        isOpen={motionEditorOpen}
        onClose={() => setMotionEditorOpen(false)}
        motionComponents={selectedProject.motionComponents}
        onSaveComponent={() => showToast('Composant sauvegardé')}
        onCaptureComponent={() => showToast('Capture vidéo effectuée')}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 lg:bottom-4 right-4 z-50 bg-zinc-900 border border-zinc-700 text-white text-xs font-medium px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
