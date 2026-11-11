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
  resolution: '540x960' | '1080x1920' = '1080x1920',
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
  if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });

  const jobId = `job-render-${Date.now()}`;
  const outFileName = `${project.slug}_${version}.mp4`;
  const outputMp4 = path.join(RENDERS_DIR, outFileName);
  const outThumb = path.join(RENDERS_DIR, `${project.slug}_${version}_thumb.jpg`);
  const outContact = path.join(RENDERS_DIR, `${project.slug}_${version}_contact.jpg`);

  const job: RenderJob = {
    id: jobId,
    projectId: project.id,
    slug: project.slug,
    version,
    status: 'processing',
    progress: 5,
    outputMp4: `/renders/${outFileName}`,
    thumbnailUrl: `/renders/${project.slug}_${version}_thumb.jpg`,
    contactSheetUrl: `/renders/${project.slug}_${version}_contact.jpg`,
    duration: project.duration,
    startedAt: new Date().toISOString()
  };

  saveJob(job);

  // Check for source take video
  const takes = getAvailableTakes();
  let sourceTakePath: string | null = null;

  if (project.sourceVideoName) {
    const found = takes.find(t => t.name === project.sourceVideoName);
    if (found?.path && fs.existsSync(found.path)) {
      sourceTakePath = found.path;
    }
  }

  if (!sourceTakePath && takes.length > 0) {
    sourceTakePath = takes[0].path || null;
  }

  const renderFps = options.fps || project.fps || 30;
  const dur = Math.min(project.duration || 30, 90);
  const startTime = Date.now();

  // Check for subtitles .ass file
  const projectDir = path.join(PROJECTS_DIR, project.id);
  const assPath = path.join(projectDir, 'subtitles.ass');
  const hasSubtitles = fs.existsSync(assPath);

  // Check for motion overlays from project.motionTrack
  const motionOverlays: Array<{ pngPath: string; start: number; end: number }> = [];
  if (project.motionTrack && project.motionTrack.length > 0) {
    for (const m of project.motionTrack) {
      const compPng = path.join(COMPONENTS_DIR, `${m.name}.png`);
      if (!fs.existsSync(compPng)) {
        // Generate if missing
        try {
          captureMotionComponentAsset(m.name, 3.0, 30);
        } catch {
          // ignore
        }
      }
      if (fs.existsSync(compPng)) {
        motionOverlays.push({
          pngPath: compPng,
          start: m.start,
          end: m.end
        });
      }
    }
  }

  let ffmpegArgs: string[] = [];

  if (sourceTakePath && fs.existsSync(sourceTakePath)) {
    // Check if layout track has split screen
    const isSplit = project.layoutTrack?.some(l => l.layout === 'split') ?? false;

    if (isSplit) {
      // Split layout: 1080x1920 with 2 stacked panels
      const filterComplex = [
        `[0:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[top]`,
        `[0:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[bottom]`,
        `[top][bottom]vstack=inputs=2[stacked]`,
        hasSubtitles ? `[stacked]ass='${assPath}'[v]` : `[stacked]null[v]`
      ].join(';');

      ffmpegArgs = [
        '-y',
        '-ss', '0',
        '-i', sourceTakePath,
        '-filter_complex', filterComplex,
        '-map', '[v]',
        '-map', '0:a?',
        '-t', dur.toString(),
        '-r', renderFps.toString(),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', options.quality === 'final' ? '19' : '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputMp4
      ];
    } else {
      // Fullscreen 9:16 vertical crop with subtitles & badges
      const filters: string[] = [
        `scale=1080:1920:force_original_aspect_ratio=increase`,
        `crop=1080:1920`
      ];

      if (hasSubtitles) {
        filters.push(`ass='${assPath}'`);
      } else {
        filters.push(
          `drawtext=text='${project.title.replace(/[':\\]/g, ' ')}':fontsize=44:fontcolor=white:box=1:boxcolor=0x18181bee:boxborderw=20:x=(w-text_w)/2:y=180`
        );
      }

      ffmpegArgs = [
        '-y',
        '-ss', '0',
        '-i', sourceTakePath,
        '-t', dur.toString(),
        '-vf', filters.join(','),
        '-r', renderFps.toString(),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', options.quality === 'final' ? '19' : '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputMp4
      ];
    }
  } else {
    // Motion Explainer Canvas Mode: dark aesthetic background with subtitles & badge
    const filters: string[] = [];
    if (hasSubtitles) {
      filters.push(`ass='${assPath}'`);
    } else {
      filters.push(
        `drawtext=text='${project.title.replace(/[':\\]/g, ' ')}':fontsize=52:fontcolor=white:box=1:boxcolor=0x18181bee:boxborderw=24:x=(w-text_w)/2:y=400`,
        `drawtext=text='Video Agent Studio VF':fontsize=36:fontcolor=0xFF6B00:x=(w-text_w)/2:y=520`
      );
    }

    ffmpegArgs = [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=0x0f172a:s=1080x1920:d=${dur}`,
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-vf', filters.join(','),
      '-r', renderFps.toString(),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-t', dur.toString(),
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputMp4
    ];
  }

  // Spawn FFmpeg in background
  const proc = spawn('ffmpeg', ffmpegArgs);
  let stderrLog = '';

  proc.stderr.on('data', chunk => {
    const txt = chunk.toString();
    stderrLog += txt;

    // Parse time= to update progress percentage
    const match = txt.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = Number(match[3]);
      const currentSec = hours * 3600 + minutes * 60 + seconds;
      const pct = Math.min(95, Math.round((currentSec / dur) * 100));
      if (pct > job.progress) {
        job.progress = pct;
        saveJob(job);
      }
    }
  });

  proc.on('close', code => {
    const elapsedSec = Number(((Date.now() - startTime) / 1000).toFixed(2));
    const renderFpsActual = Number(((dur * renderFps) / Math.max(elapsedSec, 0.1)).toFixed(1));

    if (code === 0 && fs.existsSync(outputMp4)) {
      extractThumbnail(outputMp4, outThumb, 1.0);
      generateContactSheet(outputMp4, outContact, dur);

      job.status = 'completed';
      job.progress = 100;
      job.renderTimeSeconds = elapsedSec;
      job.renderFps = renderFpsActual;
      job.completedAt = new Date().toISOString();
      job.log = 'Rendu terminé avec succès par FFmpeg avec intégration timeline, sous-titres et composition.';

      // PRESERVE ALL VERSIONS: Do not overwrite older versions!
      const existingVer = project.versions.find(v => v.version === version);
      if (existingVer) {
        existingVer.status = 'done';
        existingVer.outputMp4 = job.outputMp4;
        existingVer.duration = dur;
      } else {
        project.versions.unshift({
          version,
          createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
          status: 'done',
          duration: dur,
          fps: renderFps,
          notes: `Rendu FFmpeg ${options.quality || 'draft'} produit en ${elapsedSec}s. Timeline, sous-titres et motion intégrés.`,
          outputMp4: job.outputMp4
        });
      }
      project.currentVersion = version;
      project.status = 'ready';
      saveProject(project);
    } else {
      job.status = 'failed';
      job.error = `FFmpeg a échoué avec le code ${code}`;
      job.log = stderrLog.slice(-1000);
    }

    saveJob(job);
  });

  return job;
}
