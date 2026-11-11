import fs from 'fs';
import path from 'path';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { execFileSync, spawn, spawnSync } from 'child_process';
import { chromium } from 'playwright';
import {
  TAKES_DIR,
  RENDERS_DIR,
  PROJECTS_DIR,
  COMPONENTS_DIR,
  JOBS_DIR,
  MUSIC_DIR,
  SFX_DIR,
  ShortProject,
  SourceVideo,
  WhisperWord,
  saveProject
} from './storageManager.ts';

export interface RenderJob {
  id: string;
  projectId: string;
  slug: string;
  version: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputMp4: string;
  thumbnailUrl: string;
  contactSheetUrl: string;
  duration: number;
  renderTimeSeconds?: number;
  renderFps?: number;
  log?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// Probe media with FFprobe. Invalid files are errors, never synthetic metadata.
export function probeVideo(filePath: string) {
  if (!fs.existsSync(filePath)) throw new Error(`Fichier média introuvable: ${path.basename(filePath)}`);
  const output = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size,bit_rate',
    '-show_entries', 'stream=codec_type,width,height,r_frame_rate,codec_name',
    '-of', 'json',
    filePath
  ], { encoding: 'utf-8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const data = JSON.parse(output);
  const videoStream = data.streams?.find((stream: any) => stream.codec_type === 'video');
  if (!videoStream) throw new Error('Le fichier ne contient aucun flux vidéo lisible.');
  const duration = Number(data.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Durée vidéo invalide dans FFprobe.');
  const size = Number(data.format?.size) || fs.statSync(filePath).size;
  const fpsParts = String(videoStream.r_frame_rate || '30/1').split('/');
  const fps = Number(fpsParts[1]) > 0 ? Number(fpsParts[0]) / Number(fpsParts[1]) : 30;
  return {
    duration: Number(duration.toFixed(3)),
    sizeMb: Number((size / (1024 * 1024)).toFixed(2)),
    width: Number(videoStream.width),
    height: Number(videoStream.height),
    fps: Number(fps.toFixed(3)),
    resolution: `${videoStream.width}x${videoStream.height}`,
    codec: String(videoStream.codec_name || 'unknown'),
    hasAudio: Boolean(data.streams?.some((stream: any) => stream.codec_type === 'audio'))
  };
}

// Extract a real thumbnail. Return false only when FFmpeg failed to create it.
export function extractThumbnail(videoPath: string, outputPath: string, timeSec = 1.0): boolean {
  try {
    execFileSync('ffmpeg', ['-y', '-ss', String(Math.max(0, timeSec)), '-i', videoPath, '-frames:v', '1', '-q:v', '2', outputPath], {
      stdio: 'ignore',
      timeout: 120_000
    });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch {
    return false;
  }
}

// Generate a 12-frame contact sheet from the supplied video.
export function generateContactSheet(videoPath: string, outputPath: string, durationSec = 30.0): boolean {
  try {
    const interval = Math.max(0.2, durationSec / 12).toFixed(3);
    execFileSync('ffmpeg', [
      '-y', '-i', videoPath,
      '-vf', `fps=1/${interval},scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,tile=4x3`,
      '-frames:v', '1', '-q:v', '2', outputPath
    ], { stdio: 'ignore', timeout: 180_000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch {
    return false;
  }
}

// Scan takes/ directory and get real videos
export function getAvailableTakes(): SourceVideo[] {
  if (!fs.existsSync(TAKES_DIR)) return [];
  const files = fs.readdirSync(TAKES_DIR);
  const videos: SourceVideo[] = [];

  for (const f of files) {
    if (f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm')) {
      const fullPath = path.join(TAKES_DIR, f);
      const thumbName = `${path.parse(f).name}.jpg`;
      const thumbPath = path.join(TAKES_DIR, thumbName);

      if (!fs.existsSync(thumbPath)) {
        extractThumbnail(fullPath, thumbPath, 1.0);
      }

      const info = probeVideo(fullPath);
      videos.push({
        id: `take-${path.parse(f).name}`,
        name: f,
        duration: info.duration,
        resolution: info.resolution,
        sizeMb: info.sizeMb,
        recordedAt: fs.statSync(fullPath).mtime.toISOString().split('T')[0],
        url: `/takes/${f}`,
        thumbnailUrl: fs.existsSync(thumbPath) ? `/takes/${thumbName}` : '',
        path: fullPath
      });
    }
  }

  return videos;
}

// Save uploaded video after strict size, extension and media-container validation.
export function saveUploadedVideo(filename: string, dataBase64OrBuffer: string | Buffer): SourceVideo {
  fs.mkdirSync(TAKES_DIR, { recursive: true });
  const cleanName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
  if (!cleanName || !/\.(mp4|mov|webm)$/i.test(cleanName)) {
    throw new Error('Extension invalide. Formats acceptés : MP4, MOV et WebM.');
  }
  const targetPath = path.join(TAKES_DIR, cleanName);
  const raw = Buffer.isBuffer(dataBase64OrBuffer)
    ? dataBase64OrBuffer
    : Buffer.from(dataBase64OrBuffer.replace(/^data:video\/[a-z0-9.+-]+;base64,/i, ''), 'base64');
  const maxBytes = Number(process.env.MAX_VIDEO_UPLOAD_BYTES) || 250 * 1024 * 1024;
  if (!raw.length || raw.length > maxBytes) throw new Error(`Fichier vide ou trop volumineux (limite ${Math.round(maxBytes / 1024 / 1024)} Mo).`);
  fs.writeFileSync(targetPath, raw, { flag: 'wx' });
  try {
    const info = probeVideo(targetPath);
    const thumbName = `${path.parse(cleanName).name}.jpg`;
    const thumbPath = path.join(TAKES_DIR, thumbName);
    const hasThumb = extractThumbnail(targetPath, thumbPath, Math.min(1, info.duration / 3));
    return {
      id: `take-${path.parse(cleanName).name}`,
      name: cleanName,
      duration: info.duration,
      resolution: info.resolution,
      sizeMb: info.sizeMb,
      recordedAt: new Date().toISOString().split('T')[0],
      url: `/takes/${encodeURIComponent(cleanName)}`,
      thumbnailUrl: hasThumb ? `/takes/${encodeURIComponent(thumbName)}` : '',
      path: targetPath
    };
  } catch (error) {
    fs.rmSync(targetPath, { force: true });
    throw error;
  }
}

function isUnsafeAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  const version = isIP(normalized);
  if (version === 4) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (version === 6) {
    return normalized === '::' || normalized === '::1' ||
      normalized.startsWith('fc') || normalized.startsWith('fd') ||
      normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb') ||
      normalized.startsWith('ff');
  }
  return true;
}

async function assertPublicHttpUrl(input: string): Promise<URL> {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('URL source invalide.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Seules les URL HTTP(S) publiques sans identifiants sont acceptées.');
  }
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Port distant non autorisé.');
  if (!url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
    throw new Error('Hôte local interdit.');
  }
  const literalVersion = isIP(url.hostname);
  const addresses = literalVersion
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => isUnsafeAddress(item.address))) {
    throw new Error('La source distante pointe vers une adresse privée, locale ou réservée.');
  }
  return url;
}

// Download an authorized public source with redirect, SSRF and size controls.
export async function downloadRemoteVideo(inputUrl: string, filename?: string): Promise<SourceVideo> {
  fs.mkdirSync(TAKES_DIR, { recursive: true });
  const finalName = filename || `download-${Date.now()}.mp4`;
  let cleanName = path.basename(finalName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
  if (!/\.(mp4|mov|webm)$/i.test(cleanName)) cleanName += '.mp4';
  const targetPath = path.join(TAKES_DIR, cleanName);
  const maxBytes = Number(process.env.MAX_VIDEO_UPLOAD_BYTES) || 250 * 1024 * 1024;

  let current = inputUrl;
  let response: Response | undefined;
  for (let redirect = 0; redirect <= 4; redirect++) {
    const safeUrl = await assertPublicHttpUrl(current);
    response = await fetch(safeUrl, { redirect: 'manual', signal: AbortSignal.timeout(120_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirection distante sans destination.');
      current = new URL(location, safeUrl).toString();
      continue;
    }
    break;
  }
  if (!response || !response.ok) throw new Error(`Échec du téléchargement distant: HTTP ${response?.status ?? 'inconnu'}.`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new Error('La vidéo distante dépasse la limite de taille autorisée.');
  if (!response.body) throw new Error('Le serveur distant n’a fourni aucun contenu vidéo.');

  const output = fs.createWriteStream(targetPath, { flags: 'wx' });
  let bytes = 0;
  try {
    for await (const chunk of response.body as any) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > maxBytes) throw new Error('Téléchargement interrompu : limite de taille dépassée.');
      if (!output.write(buffer)) await new Promise<void>(resolve => output.once('drain', resolve));
    }
    await new Promise<void>((resolve, reject) => output.end((error?: Error | null) => error ? reject(error) : resolve()));
    const info = probeVideo(targetPath);
    const thumbName = `${path.parse(cleanName).name}.jpg`;
    const thumbPath = path.join(TAKES_DIR, thumbName);
    const hasThumb = extractThumbnail(targetPath, thumbPath, Math.min(1, info.duration / 3));
    return {
      id: `take-${path.parse(cleanName).name}`,
      name: cleanName,
      duration: info.duration,
      resolution: info.resolution,
      sizeMb: info.sizeMb,
      recordedAt: new Date().toISOString().split('T')[0],
      url: `/takes/${encodeURIComponent(cleanName)}`,
      thumbnailUrl: hasThumb ? `/takes/${encodeURIComponent(thumbName)}` : '',
      path: targetPath
    };
  } catch (error) {
    output.destroy();
    fs.rmSync(targetPath, { force: true });
    throw error;
  }
}

// Job Storage
export function saveJob(job: RenderJob) {
  if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });
  fs.writeFileSync(path.join(JOBS_DIR, `${job.id}.json`), JSON.stringify(job, null, 2), 'utf-8');
}

export function getJob(jobId: string): RenderJob | null {
  const p = path.join(JOBS_DIR, `${jobId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Detect silences from the real audio stream with FFmpeg.
export interface SilenceInterval {
  start: number;
  end: number;
  duration: number;
}

export interface SilenceAnalysisResult {
  silences: SilenceInterval[];
  totalSilencesRemoved: number;
  speechSegments: Array<{ start: number; end: number }>;
  originalDuration: number;
  adjustedDuration: number;
}

export function detectAndRemoveSilences(videoPath: string): SilenceAnalysisResult {
  const media = probeVideo(videoPath);
  const duration = media.duration;
  if (!media.hasAudio) {
    return {
      silences: [],
      totalSilencesRemoved: 0,
      speechSegments: [{ start: 0, end: duration }],
      originalDuration: duration,
      adjustedDuration: duration
    };
  }

  const detection = spawnSync('ffmpeg', [
    '-hide_banner', '-nostats', '-i', videoPath,
    '-af', 'silencedetect=noise=-35dB:d=0.40',
    '-f', 'null', '-'
  ], { encoding: 'utf-8', timeout: 30 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });

  if (detection.error) throw new Error(`Impossible de lancer FFmpeg pour détecter les silences: ${detection.error.message}`);
  if (detection.status !== 0) throw new Error(`La détection des silences a échoué: ${String(detection.stderr || '').slice(-1200)}`);

  const log = String(detection.stderr || '');
  const silences: SilenceInterval[] = [];
  let openStart: number | null = null;
  for (const line of log.split(/\r?\n/)) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) openStart = Number(startMatch[1]);
    const endMatch = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
    if (endMatch) {
      const end = Math.min(duration, Number(endMatch[1]));
      const rawDuration = Number(endMatch[2]);
      const start = Math.max(0, openStart ?? end - rawDuration);
      if (end > start && end - start >= 0.40) silences.push({ start, end, duration: end - start });
      openStart = null;
    }
  }
  if (openStart !== null && duration > openStart) {
    silences.push({ start: openStart, end: duration, duration: duration - openStart });
  }

  // Keep a 90 ms guard band around detected silence to avoid clipping consonants.
  const speechSegments: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  let removed = 0;
  for (const silence of silences) {
    const cutStart = Math.min(duration, silence.start + 0.09);
    const cutEnd = Math.max(cutStart, silence.end - 0.09);
    if (cutStart > cursor + 0.05) speechSegments.push({ start: cursor, end: cutStart });
    removed += Math.max(0, cutEnd - Math.max(cursor, cutStart));
    cursor = Math.max(cursor, cutEnd);
  }
  if (duration > cursor + 0.05) speechSegments.push({ start: cursor, end: duration });
  if (speechSegments.length === 0) {
    speechSegments.push({ start: 0, end: duration });
    removed = 0;
  }

  const adjustedDuration = Number(speechSegments.reduce((sum, segment) => sum + segment.end - segment.start, 0).toFixed(3));
  return {
    silences,
    totalSilencesRemoved: Number(removed.toFixed(3)),
    speechSegments: speechSegments.map(segment => ({
      start: Number(segment.start.toFixed(3)),
      end: Number(segment.end.toFixed(3))
    })),
    originalDuration: duration,
    adjustedDuration
  };
}

// Render the silence-trimmed result to a real MP4. The source remains untouched.
export function prepareShortMedia(project: ShortProject, sourceVideoPath: string) {
  const analysis = detectAndRemoveSilences(sourceVideoPath);
  project.silenceAnalysis = {
    totalSilencesRemoved: analysis.totalSilencesRemoved,
    originalDuration: analysis.originalDuration,
    adjustedDuration: analysis.adjustedDuration,
    speechSegments: analysis.speechSegments
  };

  if (analysis.totalSilencesRemoved < 0.20 || analysis.speechSegments.length < 2) {
    project.preparedVideoName = undefined;
    return { ...analysis, outputPath: sourceVideoPath, outputName: path.basename(sourceVideoPath), changed: false };
  }

  const segments = analysis.speechSegments;
  const graph: string[] = [];
  const labels: string[] = [];
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    const start = segment.start.toFixed(3);
    const end = segment.end.toFixed(3);
    graph.push(`[0:v:0]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${index}]`);
    if (probeVideo(sourceVideoPath).hasAudio) {
      graph.push(`[0:a:0]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[a${index}]`);
      labels.push(`[v${index}][a${index}]`);
    } else {
      labels.push(`[v${index}]`);
    }
  }
  const hasAudio = probeVideo(sourceVideoPath).hasAudio;
  graph.push(`${labels.join('')}concat=n=${segments.length}:v=1:a=${hasAudio ? 1 : 0}[vout]${hasAudio ? '[aout]' : ''}`);

  const outputName = `prepared-${project.slug}-${Date.now()}.mp4`;
  const outputPath = path.join(TAKES_DIR, outputName);
  const args = ['-y', '-i', sourceVideoPath, '-filter_complex', graph.join(';'), '-map', '[vout]'];
  if (hasAudio) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '160k');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath);

  execFileSync('ffmpeg', args, { stdio: 'pipe', timeout: 60 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error('FFmpeg a terminé sans produire de fichier vidéo préparé.');
  }
  const result = probeVideo(outputPath);
  project.preparedVideoName = outputName;
  project.duration = result.duration;
  return { ...analysis, outputPath, outputName, outputDuration: result.duration, changed: true };
}

// Extract audio and run the configured whisper.cpp CLI. No transcript is fabricated.
export async function extractAudioAndTranscribe(
  project: ShortProject,
  sourceVideoPath: string,
  language = 'fr'
): Promise<WhisperWord[]> {
  const source = probeVideo(sourceVideoPath);
  if (!source.hasAudio) throw new Error('La vidéo ne contient pas de piste audio : transcription impossible.');

  if (overlays.length === 0) {
    throw new Error('Aucune animation capturée dans motionTrack. Ajoutez au moins un composant de motion design avant le rendu.');
  }

  const projectDir = path.join(PROJECTS_DIR, project.id);
  fs.mkdirSync(projectDir, { recursive: true });
  const wavPath = path.join(projectDir, 'audio-16khz-mono.wav');
  execFileSync('ffmpeg', [
    '-y', '-i', sourceVideoPath, '-map', '0:a:0', '-vn',
    '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath
  ], { stdio: 'pipe', timeout: 30 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });

  const whisperCli = process.env.WHISPER_CLI_PATH || 'whisper-cli';
  const modelPath = process.env.WHISPER_MODEL_PATH;
  if (!modelPath || !fs.existsSync(modelPath)) {
    throw new Error('Modèle Whisper absent. Configurez WHISPER_MODEL_PATH avec un modèle whisper.cpp valide.');
  }

  let rawOutput = '';
  try {
    rawOutput = execFileSync(whisperCli, [
      '-m', modelPath, '-f', wavPath, '-l', language, '-ml', '1', '-np'
    ], {
      encoding: 'utf-8',
      timeout: 60 * 60 * 1000,
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (error: any) {
    const detail = String(error?.stderr || error?.message || 'erreur inconnue').slice(-1600);
    throw new Error(`whisper.cpp a échoué: ${detail}`);
  }

  const toSeconds = (stamp: string) => {
    const match = stamp.match(/^(\d+):(\d{2}):(\d{2})\.(\d{3})$/);
    if (!match) return NaN;
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
  };

  const words: WhisperWord[] = [];
  const timestampPattern = /^\s*\[(\d+:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d+:\d{2}:\d{2}\.\d{3})\]\s*(.*?)\s*$/;
  for (const line of rawOutput.split(/\r?\n/)) {
    const match = line.match(timestampPattern);
    if (!match || !match[3]) continue;
    const start = toSeconds(match[1]);
    const end = toSeconds(match[2]);
    const token = match[3].trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    if (/^[,.;:!?…’'"\])}]+$/.test(token) && words.length > 0) {
      words[words.length - 1].word += token;
      words[words.length - 1].end = end;
    } else {
      words.push({
        id: `w-${words.length + 1}`,
        word: token,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        confidence: 0
      });
    }
  }

  if (words.length === 0) {
    throw new Error('whisper.cpp a terminé mais aucun segment horodaté n’a été reconnu. Aucune transcription fictive n’a été créée.');
  }

  fs.writeFileSync(path.join(projectDir, 'transcript.json'), JSON.stringify(words, null, 2), 'utf-8');
  const formatSrtTime = (sec: number) => {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(sec % 60).toString().padStart(2, '0');
    const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, '0');
    return `${h}:${m}:${ss},${ms}`;
  };
  let srt = '';
  const chunkSize = 4;
  for (let i = 0; i < words.length; i += chunkSize) {
    const cue = words.slice(i, i + chunkSize);
    srt += `${Math.floor(i / chunkSize) + 1}\n${formatSrtTime(cue[0].start)} --> ${formatSrtTime(cue[cue.length - 1].end)}\n${cue.map(item => item.word).join(' ')}\n\n`;
  }
  fs.writeFileSync(path.join(projectDir, 'subtitles.srt'), srt, 'utf-8');

  const formatAssTime = (sec: number) => {
    const h = Math.floor(sec / 3600).toString();
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(sec % 60).toString().padStart(2, '0');
    const cs = Math.floor((sec % 1) * 100).toString().padStart(2, '0');
    return `${h}:${m}:${ss}.${cs}`;
  };
  const assHeader = `[Script Info]\nTitle: VideoAgentStudio Subtitles\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,Noto Sans,52,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,2,40,40,260,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`;
  let assEvents = '';
  for (let i = 0; i < words.length; i += 4) {
    const cue = words.slice(i, i + 4);
    for (let j = 0; j < cue.length; j++) {
      const text = cue.map((item, index) => index === j
        ? `{\\c&H000088FF\\b1}${item.word}{\\c&H00FFFFFF\\b0}`
        : item.word).join(' ');
      assEvents += `Dialogue: 0,${formatAssTime(cue[j].start)},${formatAssTime(cue[j].end)},Default,,0,0,0,,${text}\n`;
    }
  }
  fs.writeFileSync(path.join(projectDir, 'subtitles.ass'), assHeader + assEvents, 'utf-8');
  project.transcript = words;
  return words;
}

// Render every frame of a time-driven HTML component in a real headless Chromium page.
export async function captureMotionComponentAsset(
  componentName: string,
  durationSec = 3.0,
  fps = 30,
  resolution: '540x960' | '1080x960' | '1080x1920' = '1080x1920',
  alpha = false
): Promise<{
  pngPath: string;
  pngUrl: string;
  mp4Path: string;
  mp4Url: string;
  framesCount: number;
  sizeBytes: number;
}> {
  const safeName = componentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeName || safeName !== componentName) throw new Error('Nom de composant invalide.');
  if (!Number.isFinite(durationSec) || durationSec < 0.5 || durationSec > 20) throw new Error('Durée de capture invalide.');
  if (!Number.isInteger(fps) || fps < 12 || fps > 30) throw new Error('FPS de capture invalide.');
  fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  fs.mkdirSync(JOBS_DIR, { recursive: true });

  const htmlPath = path.join(COMPONENTS_DIR, `${safeName}.html`);
  if (!fs.existsSync(htmlPath)) throw new Error(`Composant HTML introuvable: ${safeName}`);
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const [width, height] = resolution.split('x').map(Number);
  const framesCount = Math.round(durationSec * fps);
  if (framesCount < 1 || framesCount > 600) throw new Error('Nombre d’images de capture hors limites.');

  const frameDir = fs.mkdtempSync(path.join(JOBS_DIR, `motion-${safeName}-`));
  const pngPath = path.join(COMPONENTS_DIR, `${safeName}.png`);
  const ext = alpha ? 'mov' : 'mp4';
  const mp4Path = path.join(COMPONENTS_DIR, `${safeName}.${ext}`);
  let browser: any;
  try {
    browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1
    });
    await page.route('**/*', route => {
      const requestUrl = route.request().url();
      if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:') || requestUrl.startsWith('about:')) return route.continue();
      return route.abort();
    });
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    const hasTimelineFunction = await page.evaluate(() => typeof (window as any).setT === 'function');
    if (!hasTimelineFunction) throw new Error('Le composant doit définir window.setT(t) pour être animé.');
    for (let frame = 0; frame < framesCount; frame++) {
      const t = framesCount <= 1 ? 0 : frame / (framesCount - 1);
      await page.evaluate((time: number) => (window as any).setT(time), t);
      const framePath = path.join(frameDir, `${String(frame).padStart(6, '0')}.png`);
      await page.screenshot({ path: framePath, type: 'png', omitBackground: alpha, animations: 'disabled' });
    }
    fs.copyFileSync(path.join(frameDir, '000000.png'), pngPath);
    const args = [
      '-y', '-framerate', String(fps), '-i', path.join(frameDir, '%06d.png'),
      '-frames:v', String(framesCount), '-an'
    ];
    if (alpha) {
      args.push('-c:v', 'qtrle', '-pix_fmt', 'argb', '-movflags', '+faststart', mp4Path);
    } else {
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path);
    }
    execFileSync('ffmpeg', args, { stdio: 'pipe', timeout: 30 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    if (!fs.existsSync(mp4Path) || fs.statSync(mp4Path).size < 1024) {
      throw new Error('FFmpeg n’a pas produit de séquence animée exploitable.');
    }
    return {
      pngPath,
      pngUrl: `/storage/components/${safeName}.png`,
      mp4Path,
      mp4Url: `/storage/components/${safeName}.${ext}`,
      framesCount,
      sizeBytes: fs.statSync(mp4Path).size
    };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    fs.rmSync(frameDir, { recursive: true, force: true });
  }
}

// COMPLETE TIMELINE COMPOSITION PIPELINE WITH FFMPEG
// (Supports: clips, layout split, motion overlays, libass subtitles, SFX/audio mixing)
// -------------------------------------------------------------
export function startRenderShort(
  project: ShortProject,
  version: string,
  options: { quality?: string; fps?: number } = {}
): RenderJob {
  if (!/^[a-z0-9][a-z0-9-]{0,20}$/.test(version)) throw new Error('Identifiant de version invalide.');
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(project.slug)) throw new Error('Slug de projet invalide.');
  fs.mkdirSync(RENDERS_DIR, { recursive: true });

  const quality = options.quality === 'final' ? 'final' : 'draft';
  const renderFps = Math.max(20, Math.min(30, Math.round(options.fps || project.fps || 30)));
  const renderWidth = quality === 'final' ? 1080 : 540;
  const renderHeight = quality === 'final' ? 1920 : 960;
  const jobId = `job-render-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const renderTag = quality === 'draft' ? `${version}_draft` : version;
  const outFileName = `${project.slug}_${renderTag}.mp4`;
  const outputMp4 = path.join(RENDERS_DIR, outFileName);
  const outThumb = path.join(RENDERS_DIR, `${project.slug}_${renderTag}_thumb.jpg`);
  const outContact = path.join(RENDERS_DIR, `${project.slug}_${renderTag}_contact.jpg`);
  const duration = Math.max(1, Math.min(Number(project.duration) || 30, 180));

  const job: RenderJob = {
    id: jobId,
    projectId: project.id,
    slug: project.slug,
    version,
    status: 'processing',
    progress: 1,
    outputMp4: `/renders/${outFileName}`,
    thumbnailUrl: `/renders/${project.slug}_${renderTag}_thumb.jpg`,
    contactSheetUrl: `/renders/${project.slug}_${renderTag}_contact.jpg`,
    duration,
    startedAt: new Date().toISOString()
  };
  const takeName = project.preparedVideoName || project.sourceVideoName;
  let sourcePath: string | null = null;
  if (takeName) {
    const source = getAvailableTakes().find(video => video.name === takeName);
    if (!source?.path || !fs.existsSync(source.path)) throw new Error(`Rush source introuvable: ${takeName}`);
    sourcePath = source.path;
  }
  if (project.mode === 'split_screen_clips' && !sourcePath) {
    throw new Error('Le mode split-screen nécessite un fichier source vidéo réel.');
  }

  const overlays = (project.motionTrack || []).map(item => {
    const component = project.motionComponents?.[item.componentId];
    if (!component) throw new Error(`Composant non enregistré: ${item.componentId}`);
    const safeName = component.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const candidates = [
      path.join(COMPONENTS_DIR, `${safeName}.mov`),
      path.join(COMPONENTS_DIR, `${safeName}.mp4`)
    ];
    const assetPath = candidates.find(candidate => fs.existsSync(candidate));
    const start = Number(item.start);
    const end = Number(item.end);
    if (!assetPath) throw new Error(`Clip animé non capturé: ${component.name}`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || start >= duration) {
      throw new Error(`Plage temporelle invalide pour ${component.name}.`);
    }
    return { path: assetPath, start, end: Math.min(end, duration) };
  });

  const projectDir = path.join(PROJECTS_DIR, project.id);
  const assPath = path.join(projectDir, 'subtitles.ass');
  const hasSubtitles = fs.existsSync(assPath) && fs.statSync(assPath).size > 0;
  const escapeFilterPath = (value: string) => value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,');
  const subtitleFilter = hasSubtitles ? `ass='${escapeFilterPath(assPath)}'` : 'null';

  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'info'];
  let graph: string[] = [];
  let baseLabel = 'base0';
  let nextInputIndex = 0;
  let audioInputIndex: number | null = null;
  let backgroundInputIndex: number | null = null;
  let audioOutputLabel: string | null = null;

  const isSplit = project.mode === 'split_screen_clips' && Boolean(sourcePath) &&
    (project.layoutTrack || []).some(item => item.layout === 'split');

  if (isSplit && sourcePath) {
    args.push('-i', sourcePath);
    nextInputIndex = 1;
    args.push('-f', 'lavfi', '-i', `color=c=0xF4F2ED:s=${renderWidth}x${Math.round(renderHeight / 2)}:r=${renderFps}:d=${duration}`);
    backgroundInputIndex = 1;
    graph.push(`[0:v:0]trim=duration=${duration},setpts=PTS-STARTPTS,scale=${renderWidth}:${Math.round(renderHeight / 2)}:force_original_aspect_ratio=decrease,pad=${renderWidth}:${Math.round(renderHeight / 2)}:(ow-iw)/2:(oh-ih)/2:color=black[bottom]`);
    graph.push(`[${backgroundInputIndex}:v]null[top0]`);
    baseLabel = 'top0';
    audioInputIndex = probeVideo(sourcePath).hasAudio ? 0 : null;
    nextInputIndex = 2;
  } else if (sourcePath && project.mode !== 'faceless_explainer') {
    args.push('-i', sourcePath);
    graph.push(`[0:v:0]trim=duration=${duration},setpts=PTS-STARTPTS,scale=${renderWidth}:${renderHeight}:force_original_aspect_ratio=increase,crop=${renderWidth}:${renderHeight}[base0]`);
    baseLabel = 'base0';
    audioInputIndex = probeVideo(sourcePath).hasAudio ? 0 : null;
    nextInputIndex = 1;
  } else {
    // Faceless mode renders original visuals on a clean canvas. When a source
    // video is attached, only its audio is used as the voice-over track.
    if (sourcePath && probeVideo(sourcePath).hasAudio) {
      args.push('-i', sourcePath);
      audioInputIndex = 0;
      args.push('-f', 'lavfi', '-i', `color=c=0xF4F2ED:s=${renderWidth}x${renderHeight}:r=${renderFps}:d=${duration}`);
      backgroundInputIndex = 1;
      graph.push('[1:v]null[base0]');
      nextInputIndex = 2;
    } else {
      args.push('-f', 'lavfi', '-i', `color=c=0xF4F2ED:s=${renderWidth}x${renderHeight}:r=${renderFps}:d=${duration}`);
      args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
      graph.push('[0:v]null[base0]');
      audioInputIndex = 1;
      nextInputIndex = 2;
    }
    baseLabel = 'base0';
  }

  // Motion components are actual captured clips. Loop each one and composite it only in its timeline range.
  let currentLabel = baseLabel;
  overlays.forEach((overlay, index) => {
    const inputIndex = nextInputIndex++;
    args.push('-stream_loop', '-1', '-i', overlay.path);
    const overlayLabel = `motion${index}`;
    const mixedLabel = `mix${index}`;
    graph.push(`[${inputIndex}:v]scale=${renderWidth}:${isSplit ? Math.round(renderHeight / 2) : renderHeight}:force_original_aspect_ratio=decrease,pad=${renderWidth}:${isSplit ? Math.round(renderHeight / 2) : renderHeight}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba[${overlayLabel}]`);
    graph.push(`[${currentLabel}][${overlayLabel}]overlay=0:0:format=auto:enable='between(t,${overlay.start.toFixed(3)},${overlay.end.toFixed(3)})'[${mixedLabel}]`);
    currentLabel = mixedLabel;
  });

  if (isSplit) {
    graph.push(`[${currentLabel}][bottom]vstack=inputs=2[stacked]`);
    graph.push(`[stacked]${subtitleFilter}[vout]`);
  } else {
    graph.push(`[${currentLabel}]${subtitleFilter}[vout]`);
  }

  // Build the final audio bus from source voice, optional music and timed SFX.
  const audioLabels: string[] = [];
  if (audioInputIndex !== null) {
    graph.push(`[${audioInputIndex}:a:0]atrim=duration=${duration.toFixed(3)},asetpts=PTS-STARTPTS[voice]`);
    audioLabels.push('voice');
  }

  const musicName = String(project.musicTrack?.trackName || '').trim();
  if (musicName) {
    const safeMusicName = path.basename(musicName);
    if (safeMusicName !== musicName || !/^[a-zA-Z0-9._ -]{1,120}\.(mp3|wav|m4a|aac|ogg)$/i.test(safeMusicName)) {
      throw new Error('Nom de fichier de musique invalide. Utilisez un fichier local dans storage/music.');
    }
    const musicPath = path.join(MUSIC_DIR, safeMusicName);
    if (!fs.existsSync(musicPath)) throw new Error(`Musique sélectionnée introuvable dans storage/music/: ${safeMusicName}`);
    const musicIndex = nextInputIndex++;
    args.push('-stream_loop', '-1', '-i', musicPath);
    const volume = Math.max(0, Math.min(1, Number(project.musicTrack.volume) || 0));
    graph.push(`[${musicIndex}:a:0]atrim=duration=${duration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${volume.toFixed(3)}[music]`);
    if (audioLabels.includes('voice') && project.musicTrack.ducking) {
      graph.push('[music][voice]sidechaincompress=threshold=0.025:ratio=7:attack=20:release=420[duckedmusic]');
      graph.push('[voice][duckedmusic]amix=inputs=2:duration=first:dropout_transition=2,alimiter=limit=0.95[program]');
    } else if (audioLabels.includes('voice')) {
      graph.push('[voice][music]amix=inputs=2:duration=first:dropout_transition=2,alimiter=limit=0.95[program]');
    } else {
      graph.push('[music]alimiter=limit=0.95[program]');
    }
    audioLabels.length = 0;
    audioLabels.push('program');
  }

  const sfxLabels: string[] = [];
  for (let index = 0; index < (project.sfxTrack || []).length; index++) {
    const item = project.sfxTrack[index];
    const soundName = String(item.sound || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const candidates = ['wav', 'mp3', 'm4a', 'ogg'].map(ext => path.join(SFX_DIR, `${soundName}.${ext}`));
    const sfxPath = candidates.find(candidate => fs.existsSync(candidate));
    if (!sfxPath) throw new Error(`Effet sonore "${soundName}" absent de storage/sfx/. Aucun SFX ne sera ignoré silencieusement.`);
    const start = Number(item.start);
    const volume = Math.max(0, Math.min(1, Number(item.volume) || 0));
    if (!Number.isFinite(start) || start < 0 || start >= duration) throw new Error(`Timecode SFX invalide pour ${soundName}.`);
    const sfxIndex = nextInputIndex++;
    args.push('-i', sfxPath);
    const label = `sfx${index}`;
    const delay = Math.round(start * 1000);
    graph.push(`[${sfxIndex}:a:0]atrim=duration=${(duration - start).toFixed(3)},asetpts=PTS-STARTPTS,volume=${volume.toFixed(3)},adelay=${delay}|${delay}[${label}]`);
    sfxLabels.push(label);
  }

  const allAudioLabels = [...audioLabels, ...sfxLabels];
  if (allAudioLabels.length > 1) {
    graph.push(`${allAudioLabels.map(label => `[${label}]`).join('')}amix=inputs=${allAudioLabels.length}:duration=first:dropout_transition=2,alimiter=limit=0.95[aout]`);
    audioOutputLabel = 'aout';
  } else if (allAudioLabels.length === 1) {
    audioOutputLabel = allAudioLabels[0];
  }

  args.push('-filter_complex', graph.join(';'), '-map', '[vout]');
  if (audioOutputLabel) args.push('-map', `[${audioOutputLabel}]`);
  else args.push('-an');
  args.push(
    '-t', duration.toFixed(3),
    '-r', String(renderFps),
    '-c:v', 'libx264',
    '-preset', quality === 'final' ? 'slow' : 'veryfast',
    '-crf', quality === 'final' ? '19' : '25',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart'
  );
  if (audioOutputLabel) args.push('-c:a', 'aac', '-b:a', quality === 'final' ? '192k' : '128k');
  args.push(outputMp4);

  const started = Date.now();
  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderrLog = '';
  let settled = false;

  const failJob = (message: string) => {
    if (settled) return;
    settled = true;
    job.status = 'failed';
    job.error = message.slice(0, 2000);
    job.log = stderrLog.slice(-6000);
    job.completedAt = new Date().toISOString();
    const failedVersion = project.versions.find(item => item.version === version);
    if (failedVersion) failedVersion.status = 'failed';
    saveProject(project);
    saveJob(job);
  };

  proc.stderr.on('data', chunk => {
    const textChunk = chunk.toString();
    stderrLog = (stderrLog + textChunk).slice(-12000);
    const match = textChunk.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (match) {
      const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      const nextProgress = Math.min(95, Math.max(1, Math.round((seconds / duration) * 100)));
      if (nextProgress > job.progress) {
        job.progress = nextProgress;
        saveJob(job);
      }
    }
  });

  proc.on('error', error => failJob(`Impossible de lancer FFmpeg: ${error.message}`));
  proc.on('close', code => {
    if (settled) return;
    const elapsed = Number(((Date.now() - started) / 1000).toFixed(2));
    if (code !== 0 || !fs.existsSync(outputMp4) || fs.statSync(outputMp4).size < 1024) {
      failJob(`FFmpeg a échoué (code ${code}). ${stderrLog.slice(-1500)}`);
      return;
    }
    try {
      const rendered = probeVideo(outputMp4);
      if (rendered.width !== renderWidth || rendered.height !== renderHeight) {
        throw new Error(`Dimensions inattendues: ${rendered.resolution}`);
      }
      const thumbOk = extractThumbnail(outputMp4, outThumb, Math.min(1, rendered.duration / 3));
      const contactOk = generateContactSheet(outputMp4, outContact, rendered.duration);
      if (!thumbOk) stderrLog += '\nAvertissement: miniature non créée.';
      if (!contactOk) stderrLog += '\nAvertissement: planche de contact non créée; QC bloqué.';

      settled = true;
      job.status = 'completed';
      job.progress = 100;
      job.duration = rendered.duration;
      job.renderTimeSeconds = elapsed;
      job.renderFps = Number(((rendered.duration * renderFps) / Math.max(elapsed, 0.1)).toFixed(1));
      job.completedAt = new Date().toISOString();
      job.log = `FFmpeg a produit un MP4 réel (${rendered.resolution}, ${renderFps} fps, ${rendered.duration}s). Audio présent: ${rendered.hasAudio}. ${stderrLog.slice(-2500)}`;

      const existing = project.versions.find(item => item.version === version);
      if (existing) {
        existing.status = 'done';
        existing.outputMp4 = job.outputMp4;
        existing.duration = rendered.duration;
      } else {
        project.versions.unshift({
          version,
          createdAt: new Date().toISOString(),
          status: quality === 'draft' ? 'draft' : 'done',
          duration: rendered.duration,
          fps: renderFps,
          notes: `Rendu ${quality} FFmpeg. Vérifier la planche de contact avant validation QC.`,
          outputMp4: job.outputMp4
        });
      }
      project.currentVersion = version;
      project.status = quality === 'draft' ? 'draft' : 'ready';
      saveProject(project);
      saveJob(job);
    } catch (error: any) {
      failJob(`Contrôle du MP4 final échoué: ${error.message}`);
    }
  });

  return job;
}
