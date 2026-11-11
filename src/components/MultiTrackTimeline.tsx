import React, { useRef } from 'react';
import { 
  ChevronDown, ZoomIn, ZoomOut, Maximize2, 
  Sparkles, Layers, Volume2, Music
} from 'lucide-react';
import { ShortProject } from '../types/studio';

interface MultiTrackTimelineProps {
  project: ShortProject;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  project,
  currentTime,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const duration = project.duration;
  const progressRatio = Math.max(0, Math.min(1, currentTime / duration));

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="w-full bg-[#0d0d10] border-t border-zinc-800/80 p-2.5 select-none flex flex-col gap-1.5 shrink-0">
      
      {/* Top Timeline Bar from Melvyn's Screenshots: "v Edit 46 clips • wheel zooms  - 2.7x + [grid]" */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
        <div className="flex items-center gap-1.5">
          <button className="flex items-center gap-1 font-semibold text-zinc-300 hover:text-white">
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <span className="text-zinc-500 font-mono">46 clips • wheel zooms</span>
        </div>

        <div className="flex items-center gap-2">
          <button className="text-zinc-500 hover:text-white text-xs font-mono">-</button>
          <span className="font-mono text-[10px] text-zinc-300">2.7x</span>
          <button className="text-zinc-500 hover:text-white text-xs font-mono">+</button>
          <button className="p-0.5 rounded text-zinc-500 hover:text-white ml-1">
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Track Labels (Left column) */}
        <div className="w-16 shrink-0 flex flex-col gap-1 text-[9px] font-mono font-semibold text-zinc-500 pt-0.5">
          <div className="h-5 flex items-center">MOTION</div>
          <div className="h-5 flex items-center">LAYOUT</div>
          <div className="h-5 flex items-center">SFX</div>
          <div className="h-5 flex items-center">MUSIC</div>
        </div>

        {/* Tracks Content & Playhead Area */}
        <div 
          ref={containerRef}
          onClick={handleTimelineClick}
          className="flex-1 relative ml-1 bg-zinc-950 rounded-lg border border-zinc-800/80 p-1 flex flex-col gap-1 cursor-pointer overflow-hidden"
        >
          {/* TRACK 1: MOTION (Blue blocks: overlay, card like screenshots 3, 4, 8) */}
          <div className="h-5 relative w-full bg-zinc-900/40 rounded overflow-hidden">
            <div 
              style={{ left: '0%', width: '35%' }}
              className="absolute top-0 bottom-0 rounded bg-[#2563EB] hover:bg-blue-600 flex items-center px-2 text-[9px] text-white font-mono truncate"
            >
              overlay
            </div>
            <div 
              style={{ left: '36%', width: '40%' }}
              className="absolute top-0 bottom-0 rounded bg-[#2563EB] hover:bg-blue-600 flex items-center px-2 text-[9px] text-white font-mono truncate"
            >
              overlay
            </div>
            <div 
              style={{ left: '77%', width: '22%' }}
              className="absolute top-0 bottom-0 rounded bg-[#2563EB] hover:bg-blue-600 flex items-center px-2 text-[9px] text-white font-mono truncate"
            >
              overlay
            </div>
          </div>

          {/* TRACK 2: LAYOUT (Green Camera, Blue Split) */}
          <div className="h-5 relative w-full bg-zinc-900/40 rounded overflow-hidden flex gap-0.5">
            <div 
              style={{ left: '0%', width: '28%' }}
              className="absolute top-0 bottom-0 rounded bg-[#15803D] hover:bg-green-700 flex items-center px-2 text-[9px] text-white font-mono truncate"
            >
              Camera
            </div>
            <div 
              style={{ left: '29%', width: '70%' }}
              className="absolute top-0 bottom-0 rounded bg-[#1D4ED8] hover:bg-blue-700 flex items-center px-2 text-[9px] text-white font-mono truncate"
            >
              Split
            </div>
          </div>

          {/* TRACK 3: SFX (Orange tags: Pop, Thud, zhhh-transition, Click) */}
          <div className="h-5 relative w-full bg-zinc-900/40 rounded overflow-hidden flex items-center">
            {[
              { left: '2%', label: 'Pop' },
              { left: '12%', label: 'Thud' },
              { left: '20%', label: 'Pop' },
              { left: '28%', label: 'zhhh-transition' },
              { left: '50%', label: 'Click' },
              { left: '68%', label: 'Pop' },
              { left: '88%', label: 'Click' },
            ].map((s, idx) => (
              <div
                key={idx}
                style={{ left: s.left }}
                className="absolute top-0.5 bottom-0.5 px-1.5 rounded bg-[#C2410C] hover:bg-orange-600 flex items-center text-[8px] text-white font-mono shadow-sm"
              >
                {s.label}
              </div>
            ))}
          </div>

          {/* TRACK 4: MUSIC (Green track: arpege) */}
          <div className="h-5 relative w-full bg-zinc-900/40 rounded overflow-hidden">
            <div className="absolute inset-0 bg-[#15803D]/60 rounded flex items-center px-2 text-[9px] text-emerald-200 font-mono">
              arpege
            </div>
          </div>

          {/* BOTTOM WAVEFORM TRACK (With subtle audio lines and blue comment dot markers!) */}
          <div className="h-7 relative w-full bg-zinc-950 rounded flex items-center px-1 overflow-hidden">
            {/* Audio Waveform Bars */}
            <div className="absolute inset-0 flex items-center justify-between gap-[2px] opacity-60">
              {Array.from({ length: 90 }).map((_, idx) => {
                const height = Math.max(3, Math.min(22, 18 * Math.sin(idx * 0.4) * Math.cos(idx * 0.2) + 10));
                return (
                  <div
                    key={idx}
                    className="w-[2px] bg-zinc-600 rounded-full"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>

            {/* Blue dot markers for comments (as shown in Melvyn's screenshots) */}
            <div className="absolute top-1 left-[15%] w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" title="Comment at 0:02" />
            <div className="absolute top-1 left-[45%] w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" title="Comment at 0:07" />
            <div className="absolute top-1 left-[75%] w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" title="Comment at 1:10" />

            {/* White Synchronized Playhead Line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_8px_#ffffff] z-30 pointer-events-none"
              style={{ left: `${progressRatio * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
