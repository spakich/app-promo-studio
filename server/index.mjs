/**
 * API Server — connects the studio UI to the real pipeline scripts
 * 
 * Endpoints:
 *  POST /api/analyze    → app_analysis_agent.mjs (code analysis)
 *  POST /api/capture    → intelligent_capture.mjs (smart screenshots)
 *  POST /api/storyboard → pre_render_analysis.py (narrative plan)
 *  POST /api/voice      → voice_over.mjs (TTS generation)
 *  POST /api/render     → remotion render (video generation)
 *  POST /api/qa         → qa_v2.py (quality judge)
 *  POST /api/pipeline   → full end-to-end pipeline
 *  GET  /api/status/:id → check job status
 */

import express from 'express';
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Job tracking ───
const jobs = new Map();

function createJob(type) {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  jobs.set(id, { type, status: 'pending', progress: 0, result: null, error: null, startedAt: Date.now() });
  return id;
}

function updateJob(id, updates) {
  const job = jobs.get(id);
  if (job) Object.assign(job, updates);
}

// ─── Helper: run script and capture output ───
function runScript(cmd, cwd = ROOT, timeout = 120000) {
  try {
    const output = execSync(cmd, { cwd, timeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output };
  } catch (e) {
    return { success: false, output: e.stdout || e.stderr || e.message };
  }
}

// ═══════════════════════════════════════════════════
// POST /api/analyze — analyze GitHub repo or local project
// ═══════════════════════════════════════════════════
app.post('/api/analyze', (req, res) => {
  const { githubUrl, projectDir } = req.body;
  const dir = projectDir || (githubUrl ? githubUrl.replace('https://github.com/', '').split('/').slice(-2).join('/') : '');
  
  // Try to find the project locally first
  const localPaths = [
    join(process.env.HOME || '/Users/arnaud', dir),
    join(ROOT, dir),
    projectDir,
  ].filter(Boolean);

  let foundPath = localPaths.find(p => existsSync(join(p, 'web/src')) || existsSync(join(p, 'src')));
  
  if (!foundPath && githubUrl) {
    // Clone the repo
    const cloneResult = runScript(
      `git clone --depth 1 ${githubUrl} /tmp/analyze_${Date.now()}`,
      '/tmp'
    );
    if (cloneResult.success) {
      foundPath = `/tmp/analyze_${Date.now()}`;
    }
  }

  if (!foundPath) {
    return res.json({ success: false, error: 'Project not found. Provide a valid GitHub URL or local path.' });
  }

  const result = runScript(`node scripts/app_analysis_agent.mjs "${foundPath}" output/app_analysis.json`);
  const analysisPath = join(ROOT, 'output/app_analysis.json');
  
  if (existsSync(analysisPath)) {
    const analysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
    return res.json({ success: true, analysis });
  }
  
  return res.json({ success: false, error: result.output?.substring(0, 500) });
});

// ═══════════════════════════════════════════════════
// POST /api/capture — intelligent capture
// ═══════════════════════════════════════════════════
app.post('/api/capture', (req, res) => {
  const { appUrl = 'https://zefil-terrain.vercel.app', analysisPath = 'output/app_analysis.json' } = req.body;
  const outDir = `output/captures_${Date.now()}`;
  
  const result = runScript(
    `node scripts/intelligent_capture.mjs "${appUrl}" "${outDir}" "${analysisPath}"`,
    ROOT,
    120000
  );

  const manifestPath = join(ROOT, outDir, 'capture_manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    return res.json({ success: true, manifest, capturesDir: outDir });
  }
  
  return res.json({ success: false, error: result.output?.substring(0, 500) });
});

// ═══════════════════════════════════════════════════
// POST /api/storyboard — pre-render analysis + narrative plan
// ═══════════════════════════════════════════════════
app.post('/api/storyboard', (req, res) => {
  const { capturesDir, appName, pitch, ctaText } = req.body;
  
  const result = runScript(
    `python3 scripts/pre_render_analysis.py "${capturesDir}" "${appName || 'App'}" "${pitch || ''}" "${ctaText || ''}"`,
    ROOT
  );

  const sbPath = join(ROOT, 'output/storyboard_optimized.json');
  if (existsSync(sbPath)) {
    const storyboard = JSON.parse(readFileSync(sbPath, 'utf-8'));
    return res.json({ success: true, storyboard });
  }
  
  return res.json({ success: false, error: result.output?.substring(0, 500) });
});

// ═══════════════════════════════════════════════════
// POST /api/voice — generate voice-over
// ═══════════════════════════════════════════════════
app.post('/api/voice', (req, res) => {
  const { storyboardPath = 'output/storyboard_optimized.json', language = 'fr', voiceFile } = req.body;
  const outputPath = `output/voiceover_${Date.now()}.mp3`;

  if (voiceFile) {
    // User uploaded their own voice
    return res.json({ success: true, voicePath: voiceFile, mode: 'custom' });
  }
  
  const result = runScript(
    `node scripts/voice_over.mjs "${storyboardPath}" "${outputPath}" "${language}"`,
    ROOT,
    60000
  );

  const fullPath = join(ROOT, outputPath);
  if (existsSync(fullPath)) {
    return res.json({ success: true, voicePath: outputPath, mode: 'tts' });
  }
  
  return res.json({ success: false, error: result.output?.substring(0, 500) });
});

// ═══════════════════════════════════════════════════
// POST /api/render — render video with Remotion
// ═══════════════════════════════════════════════════
app.post('/api/render', (req, res) => {
  const {
    storyboardPath = 'output/storyboard_optimized.json',
    voicePath,
    musicPath,
    musicVolume = 0.25,
    format = 'horizontal',
  } = req.body;

  const videoPath = `output/render_${Date.now()}.mp4`;
  
  // Render with Remotion
  const composition = format === 'vertical' ? 'VerticalPromo' : format === 'square' ? 'SquarePromo' : 'HorizontalPromo';
  const renderResult = runScript(
    `npx remotion render ${composition} "${videoPath}" --props="${storyboardPath}"`,
    ROOT,
    600000
  );

  const fullVideoPath = join(ROOT, videoPath);
  if (!existsSync(fullVideoPath)) {
    return res.json({ success: false, error: renderResult.output?.substring(0, 500) });
  }

  // If voice or music provided, mix audio
  if (voicePath || musicPath) {
    const mixedPath = videoPath.replace('.mp4', '_mixed.mp4');
    let cmd = `ffmpeg -y -i "${videoPath}"`;
    
    if (voicePath) cmd += ` -i "${voicePath}"`;
    if (musicPath) cmd += ` -i "${musicPath}"`;

    if (voicePath && musicPath) {
      cmd += ` -filter_complex "[${musicPath ? 2 : 0}:a]volume=${musicVolume}[bg];[1:a][bg]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]"`;
    } else if (voicePath) {
      cmd += ` -map 0:v -map 1:a`;
    } else if (musicPath) {
      cmd += ` -map 0:v -map 1:a -filter:a volume=${musicVolume}`;
    }

    cmd += ` -c:v copy -c:a aac -shortest "${mixedPath}"`;
    runScript(cmd, ROOT);
    
    if (existsSync(join(ROOT, mixedPath))) {
      return res.json({ success: true, videoPath: mixedPath });
    }
  }

  return res.json({ success: true, videoPath });
});

// ═══════════════════════════════════════════════════
// POST /api/qa — quality check
// ═══════════════════════════════════════════════════
app.post('/api/qa', (req, res) => {
  const { videoPath, storyboardPath = 'output/storyboard_optimized.json', target = 75 } = req.body;
  
  const result = runScript(
    `python3 scripts/qa_v2.py "${videoPath}" "${storyboardPath}"`,
    ROOT,
    300000
  );

  const reportPath = join(ROOT, 'output/qa_v2_report.json');
  if (existsSync(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
    const passed = report.globalScore >= target;
    return res.json({ success: true, report, passed, target });
  }
  
  return res.json({ success: false, error: result.output?.substring(0, 500) });
});

// ═══════════════════════════════════════════════════
// POST /api/autofix — apply corrections
// ═══════════════════════════════════════════════════
app.post('/api/autofix', (req, res) => {
  const { storyboardPath = 'output/storyboard_optimized.json', qaReportPath = 'output/qa_v2_report.json' } = req.body;
  const outputPath = storyboardPath.replace('.json', '_fixed.json');
  
  const result = runScript(
    `python3 scripts/auto_fix.py "${storyboardPath}" "${qaReportPath}" "${outputPath}"`,
    ROOT
  );

  if (existsSync(join(ROOT, outputPath))) {
    return res.json({ success: true, fixedStoryboard: outputPath, output: result.output });
  }
  
  return res.json({ success: false, error: result.output?.substring(0, 500) });
});

// ═══════════════════════════════════════════════════
// POST /api/pipeline — FULL end-to-end pipeline
// ═══════════════════════════════════════════════════
app.post('/api/pipeline', async (req, res) => {
  const {
    githubUrl,
    deployUrl,
    voiceMode = 'tts',
    voiceLang = 'fr',
    voiceFile,
    musicMode = 'auto',
    musicFile,
    renderStyle = 'screencast',
    format = 'horizontal',
    qaTarget = 75,
    maxIterations = 3,
  } = req.body;

  const jobId = createJob('pipeline');
  res.json({ jobId, message: 'Pipeline started' });

  // Run pipeline steps sequentially
  const steps = [
    { name: 'analyze', label: 'Analyse du code' },
    { name: 'capture', label: 'Capture intelligente' },
    { name: 'storyboard', label: 'Plan narratif' },
    { name: 'voice', label: 'Voix-off' },
    { name: 'render', label: 'Rendu vidéo' },
    { name: 'qa', label: 'Contrôle qualité' },
  ];

  try {
    let projectDir = null;
    let capturesDir = null;
    let storyboardPath = null;
    let voicePath = null;
    let videoPath = null;

    // Step 1: Analyze
    updateJob(jobId, { status: 'running', currentStep: 'analyze', progress: 10 });

    // Find or clone project
    const repoName = githubUrl?.replace('https://github.com/', '').split('/').slice(-2).join('/');
    const localPath = join(process.env.HOME || '/Users/arnaud', repoName || '');
    
    if (existsSync(join(localPath, 'web/src')) || existsSync(join(localPath, 'src'))) {
      projectDir = localPath;
    } else if (existsSync(join(process.env.HOME || '/Users/arnaud', repoName || '', 'web/src'))) {
      projectDir = join(process.env.HOME || '/Users/arnaud', repoName || '');
    } else if (githubUrl) {
      const cloneDir = `/tmp/pipeline_${Date.now()}`;
      runScript(`git clone --depth 1 ${githubUrl} ${cloneDir}`, '/tmp');
      projectDir = cloneDir;
    }

    if (projectDir) {
      runScript(`node scripts/app_analysis_agent.mjs "${projectDir}" output/app_analysis.json`);
    }

    // Step 2: Capture
    updateJob(jobId, { currentStep: 'capture', progress: 25 });
    if (deployUrl) {
      capturesDir = `output/captures_${Date.now()}`;
      runScript(`node scripts/intelligent_capture.mjs "${deployUrl}" "${capturesDir}" output/app_analysis.json`);
    }

    // Step 3: Storyboard
    updateJob(jobId, { currentStep: 'storyboard', progress: 40 });
    const analysisPath = join(ROOT, 'output/app_analysis.json');
    let analysis = null;
    if (existsSync(analysisPath)) {
      analysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
    }

    if (capturesDir && existsSync(join(ROOT, capturesDir, 'capture_manifest.json'))) {
      const appName = analysis?.narrative?.appName || 'Application';
      const pitch = analysis?.narrative?.pitch || '';
      const cta = analysis?.narrative?.ctaText || '';
      runScript(`python3 scripts/pre_render_analysis.py "${capturesDir}" "${appName}" "${pitch}" "${cta}"`);
      storyboardPath = 'output/storyboard_optimized.json';
    } else if (analysis?.narrative) {
      // Generate storyboard from analysis directly
      const sb = generateStoryboardFromAnalysis(analysis);
      writeFileSync(join(ROOT, 'output/storyboard_optimized.json'), JSON.stringify(sb, null, 2));
      storyboardPath = 'output/storyboard_optimized.json';
    }

    // Step 4: Voice
    updateJob(jobId, { currentStep: 'voice', progress: 55 });
    if (voiceMode === 'tts' && storyboardPath) {
      voicePath = `output/voiceover_${Date.now()}.mp3`;
      runScript(`node scripts/voice_over.mjs "${storyboardPath}" "${voicePath}" "${voiceLang}"`, ROOT, 60000);
    } else if (voiceMode === 'custom' && voiceFile) {
      voicePath = voiceFile;
    }

    // Step 5: Render
    updateJob(jobId, { currentStep: 'render', progress: 70 });
    videoPath = `output/render_${Date.now()}.mp4`;
    const composition = format === 'vertical' ? 'VerticalPromo' : 'HorizontalPromo';
    
    if (storyboardPath) {
      runScript(`npx remotion render ${composition} "${videoPath}" --props="${storyboardPath}"`, ROOT, 600000);
    }

    // Mix audio
    if (voicePath && existsSync(join(ROOT, voicePath))) {
      const mixed = videoPath.replace('.mp4', '_final.mp4');
      runScript(`ffmpeg -y -i "${videoPath}" -i "${voicePath}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${mixed}"`);
      if (existsSync(join(ROOT, mixed))) videoPath = mixed;
    }

    // Step 6: QA
    updateJob(jobId, { currentStep: 'qa', progress: 85 });
    let qaScore = 0;
    let qaPassed = false;
    let iterations = 0;

    while (iterations < maxIterations && !qaPassed && storyboardPath && videoPath) {
      runScript(`python3 scripts/qa_v2.py "${videoPath}" "${storyboardPath}"`, ROOT, 300000);
      
      const reportPath = join(ROOT, 'output/qa_v2_report.json');
      if (existsSync(reportPath)) {
        const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
        qaScore = report.globalScore || 0;
        qaPassed = qaScore >= qaTarget;

        if (!qaPassed && iterations < maxIterations - 1) {
          // Auto-fix and re-render
          const fixedPath = storyboardPath.replace('.json', '_fixed.json');
          runScript(`python3 scripts/auto_fix.py "${storyboardPath}" "output/qa_v2_report.json" "${fixedPath}"`);
          
          if (existsSync(join(ROOT, fixedPath))) {
            storyboardPath = fixedPath;
            runScript(`npx remotion render ${composition} "${videoPath}" --props="${storyboardPath}"`, ROOT, 600000);
            
            // Re-mix voice
            if (voicePath && existsSync(join(ROOT, voicePath))) {
              const mixed = videoPath.replace('.mp4', '_final.mp4');
              runScript(`ffmpeg -y -i "${videoPath}" -i "${voicePath}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${mixed}"`);
              if (existsSync(join(ROOT, mixed))) videoPath = mixed;
            }
          }
        }
      }
      iterations++;
    }

    // Done
    updateJob(jobId, {
      status: 'completed',
      progress: 100,
      result: {
        videoPath,
        qaScore,
        qaPassed,
        iterations,
        voicePath,
        storyboardPath,
      },
    });

  } catch (e) {
    updateJob(jobId, { status: 'error', error: e.message });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/status/:id — check job status
// ═══════════════════════════════════════════════════
app.get('/api/status/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.json({ success: false, error: 'Job not found' });
  res.json({ success: true, job });
});

// ═══════════════════════════════════════════════════
// GET /api/download — download file
// ═══════════════════════════════════════════════════
app.get('/api/download', (req, res) => {
  const file = join(ROOT, String(req.query.path));
  if (existsSync(file)) {
    res.download(file);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ═══════════════════════════════════════════════════
// Helper: generate storyboard from analysis without captures
// ═══════════════════════════════════════════════════
function generateStoryboardFromAnalysis(analysis) {
  const narrative = analysis.narrative || {};
  const design = analysis.design || {};
  const accent = Object.values(design.colors || {}).find(c => typeof c === 'string' && c.startsWith('#e')) || '#6366F1';
  
  return {
    appName: narrative.appName || 'Application',
    pitch: narrative.pitch || '',
    ctaText: narrative.ctaText || `Essayez ${narrative.appName || 'notre app'}`,
    style: {
      bgColor: '#0a0a0b',
      accentColor: accent,
      fontFamily: 'system-ui, sans-serif',
      captionSize: 56,
      subtitleSize: 28,
    },
    scenes: (narrative.scenes || []).map((s, i) => ({
      src: s.src || '',
      caption: s.caption || '',
      subtitle: s.subtitle || '',
      durationSeconds: 4,
      zoomPreset: ['center', 'panRight', 'panLeft'][i % 3],
      transitionOut: 'slidePush',
      focal: { x: 0.5, y: 0.5 },
      analysis: { narrative_role: ['hook', 'feature_1', 'feature_2', 'proof'][i] || 'extra' },
    })),
  };
}

// ─── Start server ───
const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Promo Studio API running on http://localhost:${PORT}`);
  console.log(`   Endpoints: /api/analyze, /api/capture, /api/storyboard`);
  console.log(`              /api/voice, /api/render, /api/qa, /api/pipeline\n`);
});
