import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root storage paths
export const ROOT_DIR = path.resolve(__dirname, '../../');
export const STORAGE_DIR = path.resolve(ROOT_DIR, 'storage');
export const TAKES_DIR = path.join(STORAGE_DIR, 'takes');
export const RENDERS_DIR = path.join(STORAGE_DIR, 'renders');
export const PROJECTS_DIR = path.join(STORAGE_DIR, 'projects');
export const COMPONENTS_DIR = path.join(STORAGE_DIR, 'components');
export const JOBS_DIR = path.join(STORAGE_DIR, 'jobs');
export const STYLES_DIR = path.join(STORAGE_DIR, 'styles');

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
  timestamp: number;
  timeFormatted: string;
  text: string;
  author: string;
  resolved: boolean;
  targetElement?: string;
  drawingSnapshot?: string;
  createdAt: string;
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

export interface ShortProject {
  id: string;
  slug: string;
  title: string;
  mode: 'faceless_explainer' | 'split_screen_clips';
  platform: 'instagram' | 'tiktok' | 'youtube_shorts';
  status: 'draft' | 'preparing' | 'rendering' | 'ready';
  duration: number;
  fps: number;
  resolution: { width: number; height: number };
  sourceVideoName?: string;
  speakerVideoUrl?: string;
  audioTrackUrl?: string;
  currentVersion: string;
  versions: Array<{
    version: string;
    createdAt: string;
    status: 'done' | 'current' | 'failed' | 'rendering';
    duration: number;
    fps: number;
    notes: string;
    outputMp4?: string;
  }>;
  transcript: WhisperWord[];
  motionTrack: Array<{
    id: string;
    componentId: string;
    name: string;
    start: number;
    end: number;
    type: 'chart' | 'network' | 'rocket' | 'counter' | 'typography' | 'card';
  }>;
  layoutTrack: Array<{
    id: string;
    layout: 'split' | 'fullscreen' | 'facecam';
    start: number;
    end: number;
  }>;
  sfxTrack: Array<{
    id: string;
    sound: 'pop' | 'click' | 'whoosh' | 'thump' | 'ding';
    start: number;
    volume: number;
  }>;
  musicTrack: {
    trackName: string;
    volume: number;
    ducking: boolean;
  };
  feedbacks: FeedbackItem[];
  motionComponents: Record<string, MotionComponent>;
  contactSheet: Array<{
    frameIndex: number;
    timestamp: number;
    timeFormatted: string;
    title: string;
    qcCheck: 'pass' | 'revise' | 'blocked';
    notes: string;
  }>;
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
  url: string;
  thumbnailUrl?: string;
  path?: string;
}

// Initialize all storage directories
export function initStorage() {
  const dirs = [STORAGE_DIR, TAKES_DIR, RENDERS_DIR, PROJECTS_DIR, COMPONENTS_DIR, JOBS_DIR, STYLES_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Save project to disk
export function saveProject(project: ShortProject) {
  const projectDir = path.join(PROJECTS_DIR, project.id);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(project, null, 2), 'utf-8');

  if (project.transcript) {
    fs.writeFileSync(path.join(projectDir, 'transcript.json'), JSON.stringify(project.transcript, null, 2), 'utf-8');
  }
  if (project.feedbacks) {
    fs.writeFileSync(path.join(projectDir, 'feedbacks.json'), JSON.stringify(project.feedbacks, null, 2), 'utf-8');
  }
  if (project.versions) {
    fs.writeFileSync(path.join(projectDir, 'versions.json'), JSON.stringify(project.versions, null, 2), 'utf-8');
  }
  if (project.motionComponents) {
    fs.writeFileSync(path.join(projectDir, 'components.json'), JSON.stringify(project.motionComponents, null, 2), 'utf-8');
  }
}

// Read project from disk
export function getProject(idOrSlug: string): ShortProject | null {
  const all = getAllProjects();
  return all.find(p => p.id === idOrSlug || p.slug === idOrSlug) || null;
}

// Get all projects from disk
export function getAllProjects(): ShortProject[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const projects: ShortProject[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const pFile = path.join(PROJECTS_DIR, entry.name, 'project.json');
      if (fs.existsSync(pFile)) {
        try {
          const raw = fs.readFileSync(pFile, 'utf-8');
          const p = JSON.parse(raw);

          // Merge separate files if present
          const fbFile = path.join(PROJECTS_DIR, entry.name, 'feedbacks.json');
          if (fs.existsSync(fbFile)) {
            p.feedbacks = JSON.parse(fs.readFileSync(fbFile, 'utf-8'));
          }

          const vFile = path.join(PROJECTS_DIR, entry.name, 'versions.json');
          if (fs.existsSync(vFile)) {
            p.versions = JSON.parse(fs.readFileSync(vFile, 'utf-8'));
          }

          const tFile = path.join(PROJECTS_DIR, entry.name, 'transcript.json');
          if (fs.existsSync(tFile)) {
            p.transcript = JSON.parse(fs.readFileSync(tFile, 'utf-8'));
          }

          projects.push(p);
        } catch (e) {
          console.error(`Error loading project ${entry.name}:`, e);
        }
      }
    }
  }

  return projects;
}

// Delete project from disk
export function deleteProject(idOrSlug: string): boolean {
  const p = getProject(idOrSlug);
  if (!p) return false;
  const projectDir = path.join(PROJECTS_DIR, p.id);
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
    return true;
  }
  return false;
}
