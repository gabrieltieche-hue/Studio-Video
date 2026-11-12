import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'video-agent-studio-test-'));
process.env.STORAGE_DIR = path.join(tempRoot, 'storage');
process.env.WHISPER_MODEL_PATH = '';
process.env.WHISPER_CLI_PATH = 'whisper-cli';

const storage = await import('../src/server/storageManager.ts');
const engine = await import('../src/server/ffmpegEngine.ts');
storage.initStorage();

const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
// Playwright may be installed in the CI image, while local contributors can run
// the storage and FFmpeg tests without downloading Chromium.
const sourceWithAudio = path.join(storage.TAKES_DIR, 'integration-source.mp4');
const sourceAllSilent = path.join(storage.TAKES_DIR, 'integration-silent.mp4');

function generateFixture(target: string, audioInput: string) {
  execFileSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'color=c=0x334455:s=320x568:r=24:d=4',
    '-f', 'lavfi', '-i', audioInput,
    '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', target
  ], { stdio: 'ignore', timeout: 120_000 });
}

const { chromium } = await import('playwright');
const awaitImportPlaywrightPath = () => chromium.executablePath();

test('storage writes and reloads project metadata from the configured root', () => {
  const project = {
    id: 'proj-storage-test',
    slug: 'storage-test',
    title: 'Storage test',
    mode: 'faceless_explainer',
    platform: 'youtube_shorts',
    status: 'draft',
    duration: 12,
    fps: 30,
    resolution: { width: 1080, height: 1920 },
    currentVersion: 'v1',
    versions: [{ version: 'v1', createdAt: new Date().toISOString(), status: 'draft', duration: 12, fps: 30, notes: 'draft' }],
    transcript: [],
    motionTrack: [],
    layoutTrack: [],
    sfxTrack: [],
    musicTrack: { trackName: '', volume: 0.15, ducking: true },
    feedbacks: [],
    motionComponents: {},
    contactSheet: [],
    styleProfile: {
      name: 'Test', fontFamily: 'Inter', accentColor: '#FF6B00',
      textColor: '#111111', cardBg: '#FFFFFF',
      captionsPosition: 'bottom', visualBeatsTarget: 20
    },
    editSpec: { scenes: [{ start: 0, end: 12 }] },
    silenceAnalysis: {
      totalSilencesRemoved: 1,
      originalDuration: 12,
      adjustedDuration: 11,
      speechSegments: [{ start: 0, end: 5 }, { start: 6, end: 12 }]
    }
  };
  storage.saveProject(project as any);
  const loaded = storage.getProject('storage-test');
  assert.ok(loaded);
  assert.equal(loaded?.currentVersion, 'v1');
  assert.equal((loaded as any).editSpec.scenes.length, 1);
  assert.equal((loaded as any).silenceAnalysis.totalSilencesRemoved, 1);
});

test('FFprobe reports actual duration, dimensions and audio presence', { skip: !ffmpegAvailable }, () => {
  fs.mkdirSync(storage.TAKES_DIR, { recursive: true });
  generateFixture(sourceWithAudio, 'sine=frequency=440:sample_rate=44100:duration=4');
  const result = engine.probeVideo(sourceWithAudio);
  assert.equal(result.width, 320);
  assert.equal(result.height, 568);
  assert.ok(result.duration >= 3.8 && result.duration <= 4.1);
  assert.equal(result.hasAudio, true);
});

test('silence preparation never collapses an entirely silent recording to a near-zero clip', { skip: !ffmpegAvailable }, () => {
  generateFixture(sourceAllSilent, 'anullsrc=channel_layout=stereo:sample_rate=44100:duration=4');
  const analysis = engine.detectAndRemoveSilences(sourceAllSilent);
  assert.equal(analysis.totalSilencesRemoved, 0);
  assert.ok(Math.abs(analysis.adjustedDuration - analysis.originalDuration) < 0.1);
  assert.deepEqual(analysis.speechSegments, [{ start: 0, end: analysis.originalDuration }]);
});

test('Whisper transcription fails closed when the real model is not configured', { skip: !ffmpegAvailable }, async () => {
  const project = {
    id: 'proj-whisper-test', slug: 'whisper-test', duration: 4,
    transcript: []
  } as any;
  await assert.rejects(
    engine.extractAudioAndTranscribe(project, sourceWithAudio, 'fr'),
    /Modèle Whisper absent/
  );
  assert.deepEqual(project.transcript, []);
});

test('Playwright capture executes the time-driven component and creates a real MP4', {
  skip: !ffmpegAvailable || !fs.existsSync(chromium.executablePath())
}, async () => {
  fs.mkdirSync(storage.COMPONENTS_DIR, { recursive: true });
  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
#tile{position:absolute;left:10%;top:40%;width:30%;height:20%;background:#ff6b00;border-radius:24px;}</style>
</head><body><div id="tile"></div><script>
window.setT = (t) => {
  const node = document.getElementById('tile');
  node.style.transform = 'translateX(' + (t * 500) + 'px) rotate(' + (t * 30) + 'deg)';
};
</script></body></html>`;
  fs.writeFileSync(path.join(storage.COMPONENTS_DIR, 'animated-test.html'), html);
  const output = await engine.captureMotionComponentAsset('animated-test', 1, 12, '540x960', false);
  assert.equal(output.framesCount, 12);
  assert.ok(fs.existsSync(output.mp4Path));
  assert.ok(output.sizeBytes > 1024);
  const metadata = engine.probeVideo(output.mp4Path);
  assert.equal(metadata.width, 540);
  assert.equal(metadata.height, 960);
  assert.ok(metadata.duration >= 0.9 && metadata.duration <= 1.2);
});

test('FFmpeg draft render composes the captured motion layer over the real source clip', {
  skip: !ffmpegAvailable || !fs.existsSync(chromium.executablePath())
}, async () => {
  if (!fs.existsSync(sourceWithAudio)) generateFixture(sourceWithAudio, 'sine=frequency=440:sample_rate=44100:duration=4');
  fs.writeFileSync(path.join(storage.COMPONENTS_DIR, 'render-test.html'), `<!doctype html><html><body style="margin:0;background:transparent"><div style="color:white;font-size:80px">TEST</div><script>window.setT=(t)=>document.body.style.opacity=String(0.5+0.5*t)</script></body></html>`);
  const component = await engine.captureMotionComponentAsset('render-test', 2, 24, '1080x960', true);
  const project: any = {
    id: 'proj-render-test',
    slug: 'render-test',
    title: 'Render integration test',
    mode: 'split_screen_clips',
    platform: 'youtube_shorts',
    status: 'draft',
    duration: 4,
    fps: 24,
    resolution: { width: 1080, height: 1920 },
    sourceVideoName: path.basename(sourceWithAudio),
    currentVersion: 'v1',
    versions: [{ version: 'v1', createdAt: new Date().toISOString(), status: 'draft', duration: 4, fps: 24, notes: 'test' }],
    transcript: [],
    motionTrack: [{ id: 'm1', componentId: 'comp-render-test', name: 'render-test', start: 0, end: 2 }],
    layoutTrack: [{ id: 'l1', layout: 'split', start: 0, end: 4 }],
    sfxTrack: [],
    musicTrack: { trackName: '', volume: 0, ducking: true },
    feedbacks: [],
    motionComponents: {
      'comp-render-test': {
        id: 'comp-render-test', name: 'render-test', code: '', description: 'test',
        tRange: [0, 1], width: 1080, height: 960, fps: 24, hasAlpha: true
      }
    },
    contactSheet: [],
    styleProfile: {
      name: 'Test', fontFamily: 'Inter', accentColor: '#FF6B00', textColor: '#111111',
      cardBg: '#FFFFFF', captionsPosition: 'center_divider', visualBeatsTarget: 8
    }
  };
  storage.saveProject(project);
  const job = engine.startRenderShort(project, 'v1', { quality: 'draft', fps: 24 });
  const deadline = Date.now() + 45_000;
  let latest: any = null;
  while (Date.now() < deadline) {
    latest = engine.getJob(job.id);
    if (latest?.status === 'completed' || latest?.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.equal(latest?.status, 'completed', latest?.error || latest?.log || 'FFmpeg job timed out');
  assert.ok(latest.outputMp4.endsWith('_v1_draft.mp4'));
  const outputPath = path.join(storage.RENDERS_DIR, path.basename(latest.outputMp4));
  const metadata = engine.probeVideo(outputPath);
  assert.equal(metadata.width, 540);
  assert.equal(metadata.height, 960);
  assert.ok(metadata.hasAudio);
});
