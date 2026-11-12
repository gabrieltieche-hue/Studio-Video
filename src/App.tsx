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

// In production, the API key is entered once per browser tab. The server exchanges
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

export default function App() {
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
    videoFile?: File;
  }) => {
    try {
      let sourceVideoName: string | undefined;

      if (data.videoFile) {
        const upload = await studioFetch('/api/studio/videos/upload', {
          method: 'POST',
          headers: {
            'Content-Type': data.videoFile.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(data.videoFile.name)
          },
          body: data.videoFile
        });
        const uploadResult = await upload.json();
        if (!upload.ok || !uploadResult.video?.name) {
          throw new Error(uploadResult.error || 'Import du rush impossible.');
        }
        sourceVideoName = uploadResult.video.name;
      } else if (data.videoUrl && /^https?:\/\//i.test(data.videoUrl)) {
        const download = await studioFetch('/api/studio/videos/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: data.videoUrl, filename: data.videoFileName || undefined })
        });
        const downloadResult = await download.json();
        if (!download.ok || !downloadResult.video?.name) {
          throw new Error(downloadResult.error || 'Téléchargement du rush impossible.');
        }
        sourceVideoName = downloadResult.video.name;
      }

      if (data.mode === 'split_screen_clips' && !sourceVideoName) {
        throw new Error('Le mode Split-Screen nécessite un vrai rush vidéo. Importez un fichier ou indiquez une URL publique.');
      }

      const res = await studioFetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          slug: data.slug,
          mode: data.mode,
          platform: data.platform,
          duration: data.duration,
          script: data.script,
          source_video: sourceVideoName
        })
      });
      const result = await res.json();
      if (!res.ok || !result.project) {
        throw new Error(result.error || 'Erreur lors de la création du projet.');
      }
      const created: ShortProject = {
        ...result.project,
        feedbacks: result.project.feedbacks || []
      };
      setProjects(prev => [created, ...prev]);
      setSelectedProject(created);
      setCurrentTime(0);
      setIsPlaying(false);
      showToast(sourceVideoName
        ? `Projet "${created.title}" créé avec le rush ${sourceVideoName}.`
        : `Projet "${created.title}" créé.`);
    } catch (e: any) {
      showToast(e.message || 'Erreur création');
      throw e;
    }
  };

  // Delete Project Handler
  const handleDeleteProject = async (id: string) => {
    try {
      const response = await studioFetch(`/api/studio/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Suppression du projet impossible.');
      }
      const updated = projects.filter(project => project.id !== id);
      setProjects(updated);
      if (selectedProject?.id === id) {
        setSelectedProject(updated[0] || null);
        setCurrentTime(0);
        setIsPlaying(false);
      }
      showToast('Projet supprimé');
    } catch (e: any) {
      showToast(e.message || 'Erreur suppression projet');
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
    try {
      const response = await studioFetch(`/api/studio/projects/${encodeURIComponent(selectedProject.id)}/words/${encodeURIComponent(wordId)}/cut`, {
        method: 'PATCH'
      });
      const payload = await response.json();
      if (!response.ok || !payload.word) throw new Error(payload.error || 'Impossible de modifier ce mot.');
      setSelectedProject(prev => prev ? ({
        ...prev,
        transcript: prev.transcript.map(word => word.id === wordId ? payload.word : word)
      }) : prev);
      showToast(payload.word.isCut ? 'Mot retiré du montage' : 'Mot rétabli dans le montage');
    } catch (error: any) {
      showToast(error.message || 'Échec de la modification du mot');
    }
  };

  const handleAddFeedbackWithSnapshot = async (
    time: number,
    text: string,
    targetElement?: string,
    snapshot?: string,
    type: 'comment' | 'cut' | 'idea' = 'comment'
  ) => {
    if (!selectedProject || !text.trim()) return;
    try {
      const timeFormatted = `00:${time < 10 ? '0' : ''}${time.toFixed(2)}`;
      const quoteText = selectedProject.transcript.find(word => time >= word.start && time <= word.end)?.word;
      const response = await studioFetch(`/api/studio/projects/${encodeURIComponent(selectedProject.id)}/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: time,
          timeFormatted,
          quoteText,
          text: text.trim(),
          targetElement,
          drawingSnapshot: snapshot,
          type
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.feedback) throw new Error(payload.error || 'Enregistrement du retour impossible.');
      setSelectedProject(prev => prev ? ({
        ...prev,
        feedbacks: [payload.feedback, ...prev.feedbacks]
      }) : prev);
      setProjects(prev => prev.map(project => project.id === selectedProject.id
        ? { ...project, feedbacks: [payload.feedback, ...project.feedbacks] }
        : project));
      showToast(`Retour enregistré à [${timeFormatted}]`);
    } catch (error: any) {
      showToast(error.message || 'Erreur lors de l’enregistrement du retour');
    }
  };

  const handleToggleResolveFeedback = async (id: string, currentStatus: boolean) => {
    if (!selectedProject) return;
    try {
      const response = await studioFetch(`/api/studio/projects/${encodeURIComponent(selectedProject.id)}/feedbacks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: !currentStatus })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Modification du retour impossible.');
      setSelectedProject(prev => prev ? ({
        ...prev,
        feedbacks: prev.feedbacks.map(feedback => feedback.id === id ? payload.feedback : feedback)
      }) : prev);
      setProjects(prev => prev.map(project => project.id === selectedProject.id
        ? { ...project, feedbacks: project.feedbacks.map(feedback => feedback.id === id ? payload.feedback : feedback) }
        : project));
    } catch (error: any) {
      showToast(error.message || 'Erreur de mise à jour du retour');
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!selectedProject) return;
    try {
      const response = await studioFetch(`/api/studio/projects/${encodeURIComponent(selectedProject.id)}/feedbacks/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Suppression du retour impossible.');
      setSelectedProject(prev => prev ? ({
        ...prev,
        feedbacks: prev.feedbacks.filter(feedback => feedback.id !== id)
      }) : prev);
      setProjects(prev => prev.map(project => project.id === selectedProject.id
        ? { ...project, feedbacks: project.feedbacks.filter(feedback => feedback.id !== id) }
        : project));
      showToast('Retour supprimé');
    } catch (error: any) {
      showToast(error.message || 'Erreur de suppression du retour');
    }
  };

  const handleSelectPlatform = async (platform: 'instagram' | 'tiktok' | 'youtube_shorts') => {
    if (!selectedProject) return;
    try {
      const response = await studioFetch(`/api/studio/projects/${encodeURIComponent(selectedProject.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      });
      if (!response.ok) throw new Error('Enregistrement de la plateforme impossible.');
      setSelectedProject(prev => prev ? ({ ...prev, platform }) : prev);
      setProjects(prev => prev.map(project => project.id === selectedProject.id ? { ...project, platform } : project));
      showToast(`Plateforme sélectionnée : ${platform}`);
    } catch (error: any) {
      showToast(error.message || 'Erreur de mise à jour de la plateforme');
    }
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

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-400 gap-3 font-mono">
        <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        <span className="text-xs">Chargement de Video Agent Studio...</span>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="w-screen min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-200 p-6">
        <div className="w-full max-w-xl text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl border border-orange-500/30 bg-orange-500/10 flex items-center justify-center">
            <Video className="w-7 h-7 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Video Agent Studio</h1>
          <p className="text-sm text-zinc-400">Aucun projet pour le moment. Crée ton premier Short pour commencer le montage et recevoir des retours horodatés.</p>
          <button
            onClick={() => setNewProjectModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold text-sm"
          >
            Créer mon premier projet
          </button>
          <button
            onClick={() => { setIsLoading(true); void loadProjects(); }}
            className="block mx-auto text-xs text-zinc-500 hover:text-zinc-300"
          >
            Actualiser les projets
          </button>
        </div>
        <NewProjectModal
          isOpen={newProjectModalOpen}
          onClose={() => setNewProjectModalOpen(false)}
          onCreateProject={handleCreateProject}
        />
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
