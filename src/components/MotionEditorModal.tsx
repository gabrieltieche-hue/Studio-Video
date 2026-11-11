import React, { useState, useEffect, useRef } from 'react';
import { 
  Code2, Play, Pause, RotateCcw, Video, Save, 
  Sparkles, Check, Rocket, TrendingUp, Cpu, Copy
} from 'lucide-react';
import { MotionComponent } from '../types/studio';

interface MotionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  motionComponents: Record<string, MotionComponent>;
  onSaveComponent: (name: string, code: string, description: string) => void;
  onCaptureComponent: (name: string, resolution: string, fps: number) => void;
}

export const MotionEditorModal: React.FC<MotionEditorModalProps> = ({
  isOpen,
  onClose,
  motionComponents,
  onSaveComponent,
  onCaptureComponent,
}) => {
  const [selectedCompId, setSelectedCompId] = useState<string>('comp-rocket');
  const [compName, setCompName] = useState('Fusée en Décollage');
  const [compCode, setCompCode] = useState('');
  const [compDesc, setCompDesc] = useState('');
  
  // T-slider state
  const [tValue, setTValue] = useState(0.5);
  const [isPlayingT, setIsPlayingT] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync when selected component changes
  useEffect(() => {
    const comp = motionComponents[selectedCompId];
    if (comp) {
      setCompName(comp.name);
      setCompCode(comp.code);
      setCompDesc(comp.description);
    }
  }, [selectedCompId, motionComponents]);

  // Animation RAF loop for setT
  useEffect(() => {
    let animId: number;
    let startT = Date.now();

    if (isPlayingT) {
      const loop = () => {
        const elapsed = (Date.now() - startT) / 2000; // 2 seconds cycle
        const currentT = elapsed % 1;
        setTValue(currentT);
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }

    return () => cancelAnimationFrame(animId);
  }, [isPlayingT]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveComponent(compName, compCode, compDesc);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCapture = () => {
    setIsCapturing(true);
    onCaptureComponent(compName, '1080x1920', 30);
    setTimeout(() => setIsCapturing(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#161619] border border-zinc-700/80 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-300">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-lg">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Système d'Animations Custom — window.setT(t)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-500/30">
                  write_motion_component
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Créez des animations personnalisées pilotées temporellement de t=0 à t=1, avec export alpha vidéo.
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

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Left: Components List & Code Editor */}
          <div className="flex-1 flex flex-col border-r border-zinc-800 p-4 space-y-4 overflow-y-auto custom-scrollbar">
            {/* Component Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-400">Composant :</label>
              <select
                value={selectedCompId}
                onChange={(e) => setSelectedCompId(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-cyan-500"
              >
                {Object.values(motionComponents).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Description de l'effet :
              </label>
              <input
                type="text"
                value={compDesc}
                onChange={(e) => setCompDesc(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Code Editor */}
            <div className="flex-1 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between pb-1.5 text-xs font-mono text-zinc-400">
                <span>Code JavaScript (window.setT)</span>
                <span className="text-[10px] text-cyan-400">t : 0.0 &rarr; 1.0</span>
              </div>
              <textarea
                value={compCode}
                onChange={(e) => setCompCode(e.target.value)}
                className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-cyan-300 leading-relaxed focus:outline-none focus:border-cyan-500 custom-scrollbar"
                spellCheck={false}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition"
              >
                {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saveSuccess ? 'Enregistré !' : 'Enregistrer le code'}</span>
              </button>

              <button
                onClick={handleCapture}
                disabled={isCapturing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-cyan-500/20"
              >
                <Video className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
                <span>{isCapturing ? 'Capture alpha...' : 'Capturer la vidéo (capture_motion_component)'}</span>
              </button>
            </div>
          </div>

          {/* Right: Live Preview & Temporal Scrubber */}
          <div className="w-full md:w-96 p-4 flex flex-col justify-between bg-zinc-950/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Prévisualisation en Direct
                </span>
                <span className="text-xs font-mono text-cyan-400">
                  t = {tValue.toFixed(3)}
                </span>
              </div>

              {/* Preview Canvas Area */}
              <div className="w-full aspect-[9/16] max-h-[380px] bg-black rounded-2xl border-2 border-zinc-800 overflow-hidden relative flex flex-col items-center justify-center p-4">
                {/* Background Alpha Checkerboard */}
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage: 'linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                  }}
                />

                {/* Render Rocket */}
                {selectedCompId === 'comp-rocket' && (
                  <div 
                    className="relative transition-transform duration-75"
                    style={{
                      transform: `translate3d(${Math.sin(tValue * 40) * 4}px, ${(1 - tValue) * 80 - 40}px, 0)`
                    }}
                  >
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-2xl shadow-orange-500/40">
                      <Rocket className="w-10 h-10 text-white -rotate-45" />
                    </div>
                    {/* Flame */}
                    <div 
                      className="w-8 h-12 bg-gradient-to-t from-red-600 via-orange-400 to-yellow-300 rounded-full mx-auto -mt-2 blur-[2px] transition-transform"
                      style={{
                        transform: `scaleY(${0.8 + Math.sin(tValue * 30) * 0.4})`
                      }}
                    />
                  </div>
                )}

                {/* Render Chart */}
                {selectedCompId === 'comp-chart' && (
                  <div className="w-full flex flex-col items-center space-y-4">
                    <span className="text-3xl font-black text-white font-mono">
                      +{Math.round(tValue * 342)}%
                    </span>
                    <div className="flex items-end gap-2 h-28 w-44 bg-zinc-900/80 p-2 rounded-xl border border-zinc-800">
                      {[35, 52, 70, 95, 140, 210].map((h, i) => {
                        const progress = Math.min(1, Math.max(0, (tValue * 1.5) - (i * 0.15)));
                        return (
                          <div 
                            key={i} 
                            className="flex-1 bg-gradient-to-t from-cyan-600 to-blue-400 rounded-t transition-all duration-75"
                            style={{ height: `${progress * h * 0.45}px` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Render Neural */}
                {selectedCompId === 'comp-neural' && (
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <Cpu className="w-14 h-14 text-cyan-400 z-10 animate-pulse" />
                    <div 
                      className="absolute inset-0 border-2 border-cyan-500/40 rounded-full animate-spin"
                      style={{ animationDuration: '6s' }}
                    />
                    <div 
                      className="absolute inset-4 border border-dashed border-orange-500/50 rounded-full animate-spin"
                      style={{ animationDirection: 'reverse', animationDuration: '4s' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Scrubber Controls */}
            <div className="mt-4 space-y-2 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">Curseur Temporel t [0 &rarr; 1]</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsPlayingT(!isPlayingT)}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white"
                    title={isPlayingT ? 'Pause' : 'Lire la boucle'}
                  >
                    {isPlayingT ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setTValue(0)}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                    title="Revenir à t=0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={tValue}
                onChange={(e) => {
                  setIsPlayingT(false);
                  setTValue(parseFloat(e.target.value));
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-mono text-[11px]">
            Capture vidéo : 540x960 ou 1080x1920 • 12 à 30 FPS • Canal alpha supporté
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
