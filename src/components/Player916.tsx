import React, { useRef, useState, useEffect } from 'react';
import { 
  Pencil, MousePointer, Undo2, Trash2, Check, 
  Sparkles, CheckCircle2, TrendingUp, BarChart3,
  Rocket, ArrowUpRight, Award, Plus, Layers
} from 'lucide-react';
import { ShortProject, WhisperWord } from '../types/studio';

interface Player916Props {
  project: ShortProject;
  currentTime: number;
  isPlaying: boolean;
  onPause: () => void;
  onAddFeedbackWithSnapshot: (time: number, text: string, elementTag?: string, snapshot?: string) => void;
}

export const Player916: React.FC<Player916Props> = ({
  project,
  currentTime,
  isPlaying,
  onPause,
  onAddFeedbackWithSnapshot,
}) => {
  // Tool Modes: Normal, Draw, Inspect
  const [activeTool, setActiveTool] = useState<'normal' | 'draw' | 'inspect'>('normal');
  
  // Drawing states
  const [drawColor, setDrawColor] = useState('#FF6B00');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoElemRef = useRef<HTMLVideoElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSomething, setHasDrawnSomething] = useState(false);
  const [drawHistory, setDrawHistory] = useState<ImageData[]>([]);

  // Inspect mode states
  const [hoveredElement, setHoveredElement] = useState<{
    id: string;
    name: string;
    bounds: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [inspectModal, setInspectModal] = useState<{
    elementId: string;
    elementName: string;
    instruction: string;
  } | null>(null);

  // Sync real video tag if present
  const isVideoSource = project.speakerVideoUrl?.includes('.mp4') || 
                        project.speakerVideoUrl?.includes('.webm') || 
                        project.speakerVideoUrl?.startsWith('blob:');

  useEffect(() => {
    if (videoElemRef.current && isVideoSource) {
      if (Math.abs(videoElemRef.current.currentTime - currentTime) > 0.3) {
        videoElemRef.current.currentTime = currentTime;
      }
      if (isPlaying && videoElemRef.current.paused) {
        videoElemRef.current.play().catch(() => {});
      } else if (!isPlaying && !videoElemRef.current.paused) {
        videoElemRef.current.pause();
      }
    }
  }, [currentTime, isPlaying, isVideoSource]);

  // Active elements in motion track
  const activeMotion = project.motionTrack.find(
    m => currentTime >= m.start && currentTime <= m.end
  );

  // ROCK-SOLID SUBTITLE SYNCHRONIZATION ALGORITHM:
  // 1. Find the current or most recent spoken word without resetting to 0 during silence gaps
  const transcript = project.transcript || [];
  let currentWordIdx = transcript.findIndex(
    w => currentTime >= w.start && currentTime <= w.end
  );

  if (currentWordIdx === -1) {
    // If between words, find the last word that has started
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].start <= currentTime) {
        currentWordIdx = i;
        break;
      }
    }
  }

  // Safe fallback if before the first word
  if (currentWordIdx === -1 && transcript.length > 0) {
    currentWordIdx = 0;
  }

  const activeWord = transcript[currentWordIdx];

  // 2. Generate a 3 to 4 word window burst that stays stable and highlights the active word
  const burstStart = Math.floor(currentWordIdx / 3) * 3;
  const subtitleWords = transcript.slice(burstStart, burstStart + 3);

  // Drawing Canvas logic
  useEffect(() => {
    if (activeTool === 'draw' && canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
    }
  }, [activeTool]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'draw' || !canvasRef.current) return;
    onPause();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setDrawHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool !== 'draw' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawnSomething(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearDrawing = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHasDrawnSomething(false);
      setDrawHistory([]);
    }
  };

  const undoDrawing = () => {
    if (!canvasRef.current || drawHistory.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const last = drawHistory[drawHistory.length - 1];
    ctx.putImageData(last, 0, 0);
    setDrawHistory(prev => prev.slice(0, -1));
  };

  const saveDrawingFeedback = () => {
    if (!canvasRef.current) return;
    const snapshot = canvasRef.current.toDataURL('image/png');
    const timeFormatted = `00:${currentTime < 10 ? '0' : ''}${currentTime.toFixed(2)}`;
    onAddFeedbackWithSnapshot(
      currentTime,
      `Annotation dessinée sur la frame [${timeFormatted}]`,
      'PlayerCanvas > DrawingOverlay',
      snapshot
    );
    clearDrawing();
    setActiveTool('normal');
  };

  // Inspect mode element hover calculation
  const handleInspectMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'inspect') return;
    const container = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - container.top;

    if (relY > container.height * 0.44 && relY < container.height * 0.58) {
      setHoveredElement({
        id: 'Caption:CenteredSubtitles',
        name: `Sous-titre : "${activeWord ? activeWord.word : 'Transcription'}"`,
        bounds: { x: 16, y: Math.round(container.height * 0.46), width: container.width - 32, height: 48 }
      });
    } else if (relY <= container.height * 0.44) {
      setHoveredElement({
        id: `MotionGraphic:${activeMotion?.type || 'card'}`,
        name: `Motion Graphic : ${activeMotion?.name || 'Composant haut'}`,
        bounds: { x: 12, y: 12, width: container.width - 24, height: Math.round(container.height * 0.42) }
      });
    } else {
      setHoveredElement({
        id: 'Facecam:PresenterRush',
        name: 'Caméra Intervenant (42% de l\'écran)',
        bounds: { x: 12, y: Math.round(container.height * 0.56), width: container.width - 24, height: Math.round(container.height * 0.40) }
      });
    }
  };

  const handleInspectClick = () => {
    if (activeTool !== 'inspect' || !hoveredElement) return;
    onPause();
    setInspectModal({
      elementId: hoveredElement.id,
      elementName: hoveredElement.name,
      instruction: ''
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative select-none">
      
      {/* 9:16 VERTICAL VIDEO PLAYER CONTAINER (Scales smoothly to fit available height) */}
      <div 
        ref={containerRef}
        onMouseMove={handleInspectMouseMove}
        onClick={handleInspectClick}
        className="relative bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl transition-all duration-150 flex flex-col justify-between my-auto"
        style={{
          aspectRatio: '9/16',
          height: '100%',
          maxHeight: 'min(calc(100vh - 220px), 560px)',
          width: 'auto'
        }}
      >
        {/* ============================================================== */}
        {/* MODE B: SPLIT-SCREEN CLIPS (58% Top Motion + Centered Captions + 42% Bottom Video) */}
        {/* ============================================================== */}
        {project.mode === 'split_screen_clips' ? (
          <>
            {/* TOP HALF: 58% Animated Infographics, Cards, Badges */}
            <div className="h-[58%] w-full bg-[#131316] p-2.5 flex flex-col justify-between relative overflow-hidden border-b border-zinc-800/80">
              
              {/* Top Claude Badge */}
              <div className="flex items-center justify-center z-10 pt-0.5">
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-black shadow-md text-[10px] font-bold tracking-tight">
                  <span className="text-orange-500">✨</span>
                  <span>Monter avec <span className="text-orange-600">Claude</span></span>
                </div>
              </div>

              {/* Dynamic Animated Motion Content */}
              <div className="flex-1 flex flex-col items-center justify-center z-10 py-1">
                {currentTime < 18 ? (
                  /* Scene A: 3 Floating Phone Cards with follower stats */
                  <div className="relative w-full flex items-center justify-center gap-1.5 py-1">
                    <div className="w-18 bg-zinc-900 border border-zinc-700/80 rounded-xl p-1.5 shadow-xl rotate-[-8deg] flex flex-col justify-between h-24">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-[7px] text-zinc-400">@studio.leo</span>
                      </div>
                      <span className="text-[8px] font-black text-white leading-tight">
                        Claude monte mes vidéos
                      </span>
                      <span className="text-[7px] font-mono text-zinc-400">▶ 1,2 M</span>
                    </div>

                    <div className="w-20 bg-zinc-900 border-2 border-orange-500/80 rounded-xl p-1.5 shadow-2xl z-10 flex flex-col justify-between h-26 scale-105">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-[7px] text-zinc-400">@mila.cuts</span>
                      </div>
                      <span className="text-[8px] font-black text-white leading-tight">
                        J'ai viré mon monteur
                      </span>
                      <span className="text-[8px] font-mono text-orange-400 font-bold">▶ 860 k</span>
                    </div>

                    <div className="w-18 bg-zinc-900 border border-zinc-700/80 rounded-xl p-1.5 shadow-xl rotate-[8deg] flex flex-col justify-between h-24">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[7px] text-zinc-400">@tom.ai</span>
                      </div>
                      <span className="text-[8px] font-black text-white leading-tight">
                        Claude Code
                      </span>
                      <span className="text-[7px] font-mono text-zinc-400">▶ 2,8 M</span>
                    </div>
                  </div>
                ) : (
                  /* Scene B: Checklist Box (✓ prompts, ✓ étapes, ✓ outils) */
                  <div className="w-full max-w-[190px] bg-zinc-900/95 border border-zinc-700 rounded-xl p-2 shadow-xl space-y-1">
                    <div className="flex items-center gap-1.5 p-1 rounded-md bg-zinc-800 text-white text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>prompts</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1 rounded-md bg-zinc-800 text-white text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>étapes</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1 rounded-md bg-orange-500/20 border border-orange-500/40 text-orange-300 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-orange-400 shrink-0" />
                      <span>outils</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-Info */}
              <div className="text-[8px] font-mono text-zinc-500 text-center">
                Infographies • 58% de l'écran
              </div>
            </div>

            {/* CENTER DIVIDER: High-contrast centered subtitles SYNCHRONIZED mot-par-mot */}
            <div className="relative z-30 -my-3 px-2 flex items-center justify-center">
              <div className="bg-black/95 backdrop-blur-md border border-orange-500/40 rounded-xl px-3 py-1.5 shadow-2xl flex items-center gap-1.5 max-w-[260px] text-center min-h-[36px]">
                {subtitleWords.map((item) => {
                  const isWordActive = activeWord?.id === item.id;
                  return (
                    <span
                      key={item.id}
                      className={`font-black text-xs uppercase tracking-tight transition-all duration-75 ${
                        isWordActive
                          ? 'text-[#FF6B00] scale-110 drop-shadow-[0_0_10px_rgba(255,107,0,0.9)]'
                          : 'text-white'
                      }`}
                    >
                      {item.word}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* BOTTOM HALF: 42% Speaker Video (Real Video tag if video file, or Presenter Image) */}
            <div className="h-[42%] w-full relative bg-zinc-950 overflow-hidden flex items-center justify-center">
              {isVideoSource ? (
                <video
                  ref={videoElemRef}
                  src={project.speakerVideoUrl}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={project.speakerVideoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'}
                  alt="Rush Intervenant"
                  className="w-full h-full object-cover object-center filter contrast-105"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
              
              <div className="absolute bottom-1.5 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[8px] text-zinc-300 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Intervenant 42%</span>
              </div>
            </div>
          </>
        ) : (
          /* ============================================================== */
          /* MODE A: FACELESS EXPLAINER */
          /* ============================================================== */
          <div className="h-full w-full bg-[#090d16] p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between z-10">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[9px] font-bold border border-cyan-500/30">
                FACELESS EXPLAINER
              </span>
              <span className="text-[9px] font-mono text-zinc-400">100% Motion</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center z-10 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <span className="text-lg font-black text-white uppercase block">
                  106 SECONDES ?
                </span>
                <span className="text-xs text-cyan-400 font-mono">
                  Moteur WebCodecs H.264
                </span>
              </div>
            </div>

            {/* Subtitles on Bottom for Faceless */}
            <div className="z-20 bg-black/90 rounded-xl p-2 border border-zinc-800 text-center min-h-[38px] flex items-center justify-center">
              <div className="flex items-center justify-center gap-1.5">
                {subtitleWords.map((item) => (
                  <span
                    key={item.id}
                    className={`font-black text-xs uppercase ${
                      activeWord?.id === item.id ? 'text-cyan-400 scale-105' : 'text-white'
                    }`}
                  >
                    {item.word}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DevTools Inspect Box Overlay */}
        {activeTool === 'inspect' && hoveredElement && (
          <div
            className="absolute pointer-events-none border-2 border-orange-500 bg-orange-500/15 rounded-lg z-40 transition-all duration-75"
            style={{
              left: `${hoveredElement.bounds.x}px`,
              top: `${hoveredElement.bounds.y}px`,
              width: `${hoveredElement.bounds.width}px`,
              height: `${hoveredElement.bounds.height}px`,
            }}
          >
            <div className="absolute -top-5 left-0 bg-orange-500 text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
              {hoveredElement.name}
            </div>
          </div>
        )}

        {/* Freehand Draw Canvas */}
        {activeTool === 'draw' && (
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="absolute inset-0 w-full h-full cursor-crosshair z-30"
          />
        )}
      </div>

      {/* Inspect Popup Dialog when user clicks an inspected element */}
      {inspectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#18181b] border border-zinc-700 rounded-2xl w-full max-w-sm p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
              <span className="text-xs font-bold text-white">Ajouter un retour sur cet élément</span>
              <button onClick={() => setInspectModal(null)} className="text-zinc-400 hover:text-white text-xs">✕</button>
            </div>

            <div className="bg-zinc-900 rounded-lg p-2 text-xs font-mono text-orange-300 mb-2.5 truncate">
              {inspectModal.elementName}
            </div>

            <textarea
              autoFocus
              value={inspectModal.instruction}
              onChange={(e) => setInspectModal({ ...inspectModal, instruction: e.target.value })}
              placeholder="Ex: Agrandis la police de 15% et passe en orange..."
              className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-orange-500 mb-3 resize-none"
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setInspectModal(null)} className="px-3 py-1 text-xs text-zinc-400">Annuler</button>
              <button
                onClick={() => {
                  if (inspectModal.instruction.trim()) {
                    onAddFeedbackWithSnapshot(currentTime, inspectModal.instruction.trim(), inspectModal.elementId);
                    setInspectModal(null);
                    setActiveTool('normal');
                  }
                }}
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
