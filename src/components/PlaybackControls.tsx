import React from 'react';
import { 
  Play, Pause, RotateCcw, RotateCw, Volume2, 
  Pencil, MousePointer, FastForward
} from 'lucide-react';
import { ShortProject } from '../types/studio';

interface PlaybackControlsProps {
  project: ShortProject;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  project,
  currentTime,
  isPlaying,
  onTogglePlay,
  onSeek,
  playbackSpeed,
  onChangeSpeed,
}) => {
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins < 10 ? '0' : ''}${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  const jumpSeconds = (delta: number) => {
    onSeek(Math.max(0, Math.min(project.duration, currentTime + delta)));
  };

  return (
    <div className="h-10 bg-[#101012] border-t border-zinc-800/80 px-4 flex items-center justify-between select-none text-zinc-300">
      
      {/* Left: Play/Pause circular button, Rewind/Forward, Timecode (Matches Melvyn Screenshots 3, 4, 8) */}
      <div className="flex items-center gap-3">
        {/* Play / Pause circular button */}
        <button
          onClick={onTogglePlay}
          className="w-7 h-7 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition active:scale-95 shadow-md"
          title="Lecture / Pause (Espace)"
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
          )}
        </button>

        {/* Rewind 5s */}
        <button
          onClick={() => jumpSeconds(-5)}
          className="p-1 rounded text-zinc-400 hover:text-white transition"
          title="Reculer de 5s"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Forward 5s */}
        <button
          onClick={() => jumpSeconds(5)}
          className="p-1 rounded text-zinc-400 hover:text-white transition"
          title="Avancer de 5s"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Timecode (e.g. 00:07.43 / 01:46.71) */}
        <div className="font-mono text-xs flex items-center gap-1.5 text-zinc-300 ml-1">
          <span className="text-white font-medium">{formatTimecode(currentTime)}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-500">{formatTimecode(project.duration)}</span>
        </div>
      </div>

      {/* Right: Quick Draw P, Speed 1x/2x, Volume */}
      <div className="flex items-center gap-2">
        {/* Speed button (1x / 1.5x / 2x) */}
        <button
          onClick={() => onChangeSpeed(playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1)}
          className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-mono text-[11px] font-semibold text-zinc-300 transition"
          title="Vitesse de lecture"
        >
          {playbackSpeed}x
        </button>

        {/* Volume */}
        <button className="p-1 rounded text-zinc-400 hover:text-white transition">
          <Volume2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
