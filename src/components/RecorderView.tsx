import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Mic, Settings, Play, Pause, RotateCcw, 
  Trash2, ChevronLeft, ChevronRight, Volume2, Sparkles,
  Maximize2, Minimize2, CheckCircle2, AlertCircle, 
  HelpCircle, Sliders, Radio, Camera, Film, Plus
} from 'lucide-react';
import { ScriptItem } from '../types/studio';

interface RecorderViewProps {
  onBackToStudio: () => void;
  onOpenChatGPT: () => void;
}

const sampleScripts: ScriptItem[] = [
  {
    id: 'script-1',
    title: 'Ton monteur vidéo IA avec Claude Code',
    category: 'TO RECORD',
    duration: '1:46',
    takesCount: 4,
    lines: [
      { id: 'l1', num: '01', text: 'Tout le monde monte ses vidéos avec Claude Code, mais personne ne te dit comment, ou alors ils te le font payer.' },
      { id: 'l2', num: '02', text: 'Donc je vais tout te montrer, chaque prompt, chaque étape et chaque outil dont tu as besoin pour créer ton propre monteur vidéo IA.' },
      { id: 'l3', num: '03', text: 'D\'abord, il te faut Claude Code, mais ne l\'utilise pas dans le navigateur. Télécharge l\'application Claude sur ton ordi.' },
      { id: 'l4', num: '04', text: 'Ensuite, crée un dossier sur ton ordinateur et appelle-le Monteur IA. Dans ce dossier, tu vas créer trois sous-dossiers.' },
      { id: 'l5', num: '05', text: 'Le premier, tu vas l\'appeler A-roll pour les rushs principaux que tu as envie de monter.' },
      { id: 'l6', num: '06', text: 'Le deuxième, tu vas pouvoir mettre tes références, tes B-rolls et tes musiques.' },
      { id: 'l7', num: '07', text: 'Et le troisième, ce sera ton dossier d\'export final où le moteur WebCodecs va générer le MP4 en 8 secondes.' },
      { id: 'l8', num: '08', text: 'Regarde bien cette démo : je tape une seule commande et le short se monte sous mes yeux.' }
    ]
  },
  {
    id: 'script-2',
    title: 'Ton second cerveau IA avec Claude',
    category: 'TO RECORD',
    duration: '1:50',
    takesCount: 2,
    lines: [
      { id: 'l21', num: '01', text: 'Arrête de stocker tes idées dans 10 applications de notes différentes.' },
      { id: 'l22', num: '02', text: 'Aujourd\'hui on branche un second cerveau directement relié à Claude Code.' }
    ]
  },
  {
    id: 'script-3',
    title: '5 codes secrets à taper dans Claude',
    category: 'REMAKE',
    duration: '1:05',
    takesCount: 3,
    lines: [
      { id: 'l31', num: '01', text: 'Voici 5 commandes secrètes que 99% des monteurs ignorent encore.' }
    ]
  },
  {
    id: 'script-4',
    title: 'Sprint IA pubs V6 — formateurs et coachs',
    category: 'TO RECORD',
    duration: '0:53',
    takesCount: 6,
    lines: [
      { id: 'l41', num: '01', text: 'Si tu vends de la formation en ligne, ton coût par acquisition explose.' }
    ]
  }
];

export const RecorderView: React.FC<RecorderViewProps> = ({
  onBackToStudio,
  onOpenChatGPT,
}) => {
  const [selectedScript, setSelectedScript] = useState<ScriptItem>(sampleScripts[0]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(7);
  const [showSettings, setShowSettings] = useState(true);
  const [cameraPiPSize, setCameraPiPSize] = useState<'normal' | 'expanded'>('normal');

  // Device selections
  const [selectedCamera, setSelectedCamera] = useState('OsmoPocket4 (2ca3:0023)');
  const [selectedMic, setSelectedMic] = useState('Default - Shure MV7+ (14ed:1019)');
  const [flashCountdown, setFlashCountdown] = useState(false);
  const [voiceFollow, setVoiceFollow] = useState(true);

  // Recording timer loop
  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Keyboard shortcut: R to start/stop record, Esc to discard, Arrow up/down to navigate lines
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setIsRecording(prev => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsRecording(false);
        setRecordSeconds(0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveLineIdx(i => Math.min(selectedScript.lines.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveLineIdx(i => Math.max(0, i - 1));
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedScript]);

  const formatRecTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full h-full bg-[#0c0c0e] text-zinc-200 flex flex-col overflow-hidden font-sans select-none">
      
      {/* 1. TOP HEADER (Matching Melvyn's Recorder Header) */}
      <header className="h-14 bg-[#121214] border-b border-zinc-800/80 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToStudio}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 font-medium transition"
          >
            <ChevronLeft className="w-4 h-4 text-orange-400" />
            <span>Studio</span>
          </button>

          <div className="h-4 w-[1px] bg-zinc-800" />

          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-white">Recorder</span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400 font-medium truncate max-w-md">
              {selectedScript.title}
            </span>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-3">
          {/* Active Rec Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/40 border border-red-500/40 text-red-400 font-mono text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>REC {formatRecTime(recordSeconds)}</span>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
              showSettings 
                ? 'bg-zinc-800 border-zinc-600 text-white' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          <button
            onClick={onOpenChatGPT}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 font-medium transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>Chat IA</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-ZONE RECORDER WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: SCRIPTS BROWSER */}
        <aside className="w-72 bg-[#141416] border-r border-zinc-800/80 flex flex-col h-full text-xs">
          {/* Header */}
          <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between text-zinc-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-zinc-300">
              Scripts
            </span>
            <button className="flex items-center gap-1 text-[11px] text-orange-400 hover:underline">
              <Plus className="w-3 h-3" />
              <span>New script</span>
            </button>
          </div>

          <div className="p-2 border-b border-zinc-800/60 bg-zinc-900/40">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                ⚡ YOLO take
              </span>
              <span className="text-zinc-500 font-mono">10 takes</span>
            </div>
          </div>

          {/* Scripts Categories */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
            {/* Category: TO RECORD */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                <span>TO RECORD</span>
                <span className="font-mono text-zinc-500">11</span>
              </div>
              <div className="space-y-1 mt-1">
                {sampleScripts.filter(s => s.category === 'TO RECORD').map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedScript(s);
                      setActiveLineIdx(0);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition flex items-center justify-between ${
                      s.id === selectedScript.id
                        ? 'bg-orange-500/15 border border-orange-500/40 text-orange-200'
                        : 'hover:bg-zinc-800/60 text-zinc-300'
                    }`}
                  >
                    <span className="truncate max-w-[170px] font-medium">{s.title}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{s.duration}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category: REMAKE */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                <span>REMAKE</span>
                <span className="font-mono text-zinc-500">4</span>
              </div>
              <div className="space-y-1 mt-1">
                {sampleScripts.filter(s => s.category === 'REMAKE').map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedScript(s);
                      setActiveLineIdx(0);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition flex items-center justify-between ${
                      s.id === selectedScript.id
                        ? 'bg-orange-500/15 border border-orange-500/40 text-orange-200'
                        : 'hover:bg-zinc-800/60 text-zinc-300'
                    }`}
                  >
                    <span className="truncate max-w-[170px] font-medium">{s.title}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{s.duration}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category: TO EDIT */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                <span>TO EDIT</span>
                <span className="font-mono text-zinc-500">19</span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Sprint ia manuel</span>
                <span className="font-mono text-zinc-500">11 takes</span>
              </div>
            </div>
          </div>

          {/* Footer takes summary */}
          <div className="p-3 border-t border-zinc-800 bg-zinc-950 text-[11px] text-zinc-400 flex items-center justify-between">
            <span className="font-mono text-emerald-400">112/123 recorded</span>
            <span className="text-zinc-500">204 takes</span>
          </div>
        </aside>

        {/* CENTER: TELEPROMPTER SCREEN & CAMERA PiP */}
        <main className="flex-1 flex flex-col bg-[#09090b] relative overflow-hidden">
          
          {/* Teleprompter Scrolling Text Area */}
          <div className="flex-1 overflow-y-auto px-10 py-12 flex flex-col items-center justify-center custom-scrollbar">
            <div className="max-w-2xl w-full space-y-6">
              {selectedScript.lines.map((line, idx) => {
                const isActive = idx === activeLineIdx;
                const isPast = idx < activeLineIdx;

                return (
                  <div
                    key={line.id}
                    onClick={() => setActiveLineIdx(idx)}
                    className={`cursor-pointer transition-all duration-300 flex items-start gap-4 p-4 rounded-2xl ${
                      isActive
                        ? 'bg-zinc-900/80 border border-red-500/30 scale-105 shadow-2xl'
                        : isPast
                        ? 'opacity-30 hover:opacity-60'
                        : 'opacity-40 hover:opacity-80'
                    }`}
                  >
                    <span className={`font-mono text-sm font-bold pt-1 ${
                      isActive ? 'text-red-400' : 'text-zinc-600'
                    }`}>
                      {line.num}
                    </span>

                    <p className={`text-2xl font-black leading-snug tracking-tight ${
                      isActive ? 'text-white' : 'text-zinc-400'
                    }`}>
                      {line.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating Camera PiP (Preview like in Melvyn's Screenshots 6 & 7) */}
          <div 
            className={`absolute bottom-20 right-8 bg-zinc-950 border-2 border-red-500/50 rounded-2xl overflow-hidden shadow-2xl z-30 transition-all duration-200 ${
              cameraPiPSize === 'expanded' ? 'w-80 h-52' : 'w-64 h-40'
            }`}
          >
            {/* Presenter Video / Avatar Simulation */}
            <div className="w-full h-full relative">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80"
                alt="Présentateur Caméra"
                className="w-full h-full object-cover filter contrast-105"
              />

              {/* PiP Header Tags */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] font-mono text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>1080p • 30 fps • MP4</span>
              </div>

              <button
                onClick={() => setCameraPiPSize(cameraPiPSize === 'normal' ? 'expanded' : 'normal')}
                className="absolute top-2 right-2 p-1 rounded bg-black/60 hover:bg-black/80 text-white transition"
              >
                {cameraPiPSize === 'normal' ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* BOTTOM TELEPROMPTER CONTROL BAR */}
          <div className="h-16 bg-[#121214] border-t border-zinc-800 px-6 flex items-center justify-between z-20">
            {/* Audio VU meter & Listening */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-end gap-1 h-5 w-16 bg-zinc-900 p-1 rounded border border-zinc-800">
                {[40, 70, 95, 60, 85, 30].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-emerald-400 rounded-t transition-all duration-75"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Listening
              </span>
            </div>

            {/* Central Big Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRecordSeconds(0)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>

              {/* Master Record / Stop Button */}
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition shadow-lg ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30 animate-pulse'
                    : 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                <span>{isRecording ? `Stop ${formatRecTime(recordSeconds)} (R)` : 'Record (R)'}</span>
              </button>

              <button
                onClick={() => {
                  setIsRecording(false);
                  setRecordSeconds(0);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs transition"
              >
                <span>Discard (Esc)</span>
              </button>
            </div>

            {/* Line Stepper */}
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span>Line {activeLineIdx + 1} / {selectedScript.lines.length}</span>
              <button
                onClick={() => setActiveLineIdx(i => Math.max(0, i - 1))}
                className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                ▲
              </button>
              <button
                onClick={() => setActiveLineIdx(i => Math.min(selectedScript.lines.length - 1, i + 1))}
                className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                ▼
              </button>
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: CAMERA & MIC SETTINGS (Matches Screenshot 6 & 7) */}
        {showSettings && (
          <aside className="w-80 bg-[#141416] border-l border-zinc-800/80 p-4 flex flex-col justify-between text-xs space-y-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-bold text-white text-xs uppercase tracking-wider">
                  Settings
                </span>
                <span className="text-[10px] text-zinc-500">Osmo / Shure</span>
              </div>

              {/* Camera & Mic */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  CAMERA & MICROPHONE
                </span>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Camera</label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="OsmoPocket4 (2ca3:0023)">OsmoPocket4 (2ca3:0023)</option>
                    <option value="FaceTime HD Camera">FaceTime HD Camera</option>
                    <option value="Sony A7IV / CamLink 4K">Sony A7IV / CamLink 4K</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Microphone</label>
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="Default - Shure MV7+ (14ed:1019)">Default - Shure MV7+ (14ed:1019)</option>
                    <option value="MacBook Pro Microphone">MacBook Pro Microphone</option>
                    <option value="Rode Wireless Pro">Rode Wireless Pro</option>
                  </select>
                </div>
              </div>

              {/* Camera delay measure */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-300">Camera delay</span>
                  <button className="text-[10px] text-orange-400 hover:underline">
                    ⚡ Measure
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 leading-tight">
                  Mesure le décalage entre l'image et le son en flashant l'écran pour caler le son à 30fps.
                </p>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11px] text-zinc-300">Flash on every countdown</span>
                  <input
                    type="checkbox"
                    checked={flashCountdown}
                    onChange={(e) => setFlashCountdown(e.target.checked)}
                    className="rounded bg-zinc-800 border-zinc-700 text-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11px] text-zinc-300">Follow my voice (scroll auto)</span>
                  <input
                    type="checkbox"
                    checked={voiceFollow}
                    onChange={(e) => setVoiceFollow(e.target.checked)}
                    className="rounded bg-zinc-800 border-zinc-700 text-orange-500"
                  />
                </label>
              </div>
            </div>

            {/* Path indicator */}
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-500">
              📂 ~/Brain/video-editing/A-roll
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
