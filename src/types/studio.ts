export interface WhisperWord {
  id: string;
  word: string;
  start: number;
  end: number;
  confidence: number;
  isCut?: boolean;
}

export interface FeedbackItem {
  id: string;
  version?: string;
  timestamp: number;
  timeFormatted: string;
  text: string;
  quoteText?: string;
  author: string;
  resolved: boolean;
  resolutionNote?: string;
  targetElement?: string;
  drawingSnapshot?: string;
  createdAt: string;
  type?: 'comment' | 'cut' | 'idea';
}

export interface MotionComponent {
  id: string;
  name: string;
  code: string;
  tRange: [number, number];
  width: number;
  height: number;
  fps: number;
  hasAlpha: boolean;
  description: string;
}

export interface RenderVersion {
  version: string;
  createdAt: string;
  status: 'draft' | 'done' | 'current' | 'failed' | 'rendering';
  duration: number;
  fps: number;
  notes: string;
  platform?: string;
}

export interface ContactSheetFrame {
  frameIndex: number;
  timestamp: number;
  timeFormatted: string;
  title: string;
  qcCheck: 'pass' | 'revise' | 'blocked';
  notes: string;
  previewUrl?: string;
}

export interface MotionTrackItem {
  id: string;
  componentId: string;
  name: string;
  start: number;
  end: number;
  type: 'chart' | 'network' | 'rocket' | 'counter' | 'typography' | 'card';
  color?: string;
}

export interface LayoutTrackItem {
  id: string;
  layout: 'split' | 'fullscreen' | 'facecam' | 'camera';
  start: number;
  end: number;
}

export interface SfxTrackItem {
  id: string;
  sound: 'Pop' | 'Thud' | 'Click' | 'Whoosh' | 'Thump' | 'zhhh-transition' | 'ding';
  start: number;
  volume: number;
}

export interface ScriptLine {
  id: string;
  num: string;
  text: string;
}

export interface ScriptItem {
  id: string;
  title: string;
  category: 'TO RECORD' | 'REMAKE' | 'TO EDIT' | 'YOLO';
  duration: string;
  takesCount: number;
  lines: ScriptLine[];
}

export interface ShortProject {
  id: string;
  slug: string;
  title: string;
  mode: 'faceless_explainer' | 'split_screen_clips';
  platform: 'instagram' | 'tiktok' | 'youtube_shorts';
  status: 'draft' | 'preparing' | 'rendering' | 'ready';
  duration: number; // in seconds
  fps: number;
  resolution: { width: number; height: number };
  sourceVideoName?: string;
  preparedVideoName?: string;
  editSpec?: Record<string, unknown>;
  silenceAnalysis?: {
    totalSilencesRemoved: number;
    originalDuration: number;
    adjustedDuration: number;
    speechSegments: Array<{ start: number; end: number }>;
  };
  speakerVideoUrl?: string;
  audioTrackUrl?: string;
  currentVersion: string;
  versions: RenderVersion[];
  transcript: WhisperWord[];
  motionTrack: MotionTrackItem[];
  layoutTrack: LayoutTrackItem[];
  sfxTrack: SfxTrackItem[];
  musicTrack: {
    trackName: string;
    volume: number;
    ducking: boolean;
  };
  feedbacks: FeedbackItem[];
  motionComponents: Record<string, MotionComponent>;
  contactSheet: ContactSheetFrame[];
  styleProfile: {
    name: string;
    fontFamily: string;
    accentColor: string;
    textColor: string;
    cardBg: string;
    captionsPosition: 'center_divider' | 'bottom' | 'top';
    visualBeatsTarget: number;
  };
}

export interface SourceVideo {
  id: string;
  name: string;
  duration: number;
  resolution: string;
  sizeMb: number;
  recordedAt: string;
  url?: string;
  category?: 'Pubs' | 'Shorts' | 'Dates';
  dateFolder?: string;
}
