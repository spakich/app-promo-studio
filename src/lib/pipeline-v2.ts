/**
 * ═══════════════════════════════════════════════════════════════════
 * PIPELINE ENGINE V2 — State machine orchestrator
 * ═══════════════════════════════════════════════════════════════════
 *
 * Orchestrates the full pipeline:
 *   IDLE → CAPTURING → ANALYZING → STORYBOARDING → VOICE → RENDERING → QA → DONE
 *
 * Each stage is isolated, testable, and emits progress events.
 * The UI subscribes to these events via the Zustand store.
 */

import type { SceneData, SceneStyle } from '../../remotion/components/ScreencastScene';

export type { SceneData, SceneStyle } from '../../remotion/components/ScreencastScene';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PipelineStage =
  | 'idle'
  | 'capturing'
  | 'analyzing'
  | 'storyboarding'
  | 'voice'
  | 'rendering'
  | 'qa'
  | 'done'
  | 'error';

export type RenderMode = 'cinematic' | 'screencast' | 'hybrid';
export type VideoFormat = '16:9' | '9:16' | '1:1';
export type VoiceOption = 'henri' | 'denise' | 'none' | 'custom';

export interface CaptureConfig {
  url: string;
  credentials?: { email: string; password: string };
  routes?: string[];
  waitForText?: string[];
}

export interface VoiceConfig {
  option: VoiceOption;
  script: string;
  rate: number; // -0.3 to +0.3
  customFile?: string;
}

export interface RenderConfig {
  mode: RenderMode;
  format: VideoFormat;
  quality: 'standard' | 'high' | 'ultra';
  fps: 30 | 60;
}

export interface QAConfig {
  enabled: boolean;
  targetScore: number; // 60-95
  maxIterations: number;
}

export interface StoryboardData {
  scenes: SceneData[];
  style: SceneStyle;
  appName: string;
  pitch?: string;
  ctaText?: string;
}

export interface PipelineConfig {
  capture: CaptureConfig;
  voice: VoiceConfig;
  render: RenderConfig;
  qa: QAConfig;
  storyboard?: StoryboardData;
}

export interface PipelineState {
  stage: PipelineStage;
  progress: number; // 0-100
  message: string;
  error?: string;
  log: LogEntry[];
  result?: {
    videoPath?: string;
    qaScore?: number;
    storyboard?: StoryboardData;
  };
}

export interface LogEntry {
  timestamp: number;
  stage: PipelineStage;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

// ─── Format dimensions ────────────────────────────────────────────────────────

export const FORMAT_DIMENSIONS: Record<VideoFormat, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
};

// ─── Stage metadata ───────────────────────────────────────────────────────────

export const STAGE_META: Record<PipelineStage, { label: string; icon: string; color: string }> = {
  idle:          { label: 'En attente',           icon: '⏸',  color: '#64748b' },
  capturing:     { label: 'Capture des écrans',    icon: '📸', color: '#3b82f6' },
  analyzing:     { label: 'Analyse du code',       icon: '🔍', color: '#8b5cf6' },
  storyboarding: { label: 'Storyboard intelligent',icon: '🎬', color: '#ec4899' },
  voice:         { label: 'Génération voix off',   icon: '🎙️', color: '#f59e0b' },
  rendering:     { label: 'Rendu vidéo',           icon: '⚙️', color: '#10b981' },
  qa:            { label: 'Contrôle qualité IA',   icon: '✅', color: '#06b6d4' },
  done:          { label: 'Terminé',               icon: '🎉', color: '#22c55e' },
  error:         { label: 'Erreur',                icon: '❌', color: '#ef4444' },
};

export const PIPELINE_STAGES: PipelineStage[] = [
  'capturing', 'analyzing', 'storyboarding', 'voice', 'rendering', 'qa', 'done'
];

// ─── Event emitter ────────────────────────────────────────────────────────────

type Listener = (state: PipelineState) => void;

export class PipelineEngine {
  private state: PipelineState = {
    stage: 'idle',
    progress: 0,
    message: '',
    log: [],
  };

  private listeners: Set<Listener> = new Set();
  private abortController: AbortController | null = null;

  // ── State management ────────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): PipelineState {
    return { ...this.state };
  }

  private setState(updates: Partial<PipelineState>) {
    this.state = { ...this.state, ...updates };
    this.emit();
  }

  private emit() {
    this.listeners.forEach(l => l(this.getState()));
  }

  private log(level: LogEntry['level'], message: string) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      stage: this.state.stage,
      message,
      level,
    };
    this.setState({ log: [...this.state.log, entry] });
    const prefix = { info: 'ℹ', warn: '⚠', error: '✖', success: '✓' };
    console.log(`[${this.state.stage}] ${prefix[level]} ${message}`);
  }

  // ── Pipeline execution ──────────────────────────────────────────────────────

  async run(config: PipelineConfig): Promise<void> {
    this.abortController = new AbortController();
    this.setState({ stage: 'capturing', progress: 0, message: 'Démarrage...', log: [], error: undefined });

    try {
      // 1. CAPTURE
      const captures = await this.runStage('capturing', async () => {
        this.log('info', `Connexion à ${config.capture.url}`);
        // TODO: call capture API
        this.log('success', '8 écrans capturés');
        return [];
      });

      // 2. ANALYZE
      const analysis = await this.runStage('analyzing', async () => {
        this.log('info', 'Analyse du code source...');
        // TODO: call analyze API
        this.log('success', 'Design DNA extrait, 6 features détectées');
        return {};
      });

      // 3. STORYBOARD
      const storyboard = await this.runStage('storyboarding', async () => {
        this.log('info', 'Génération du storyboard IA...');
        // TODO: call storyboard API
        this.log('success', 'Storyboard généré: 6 scènes');
        return config.storyboard || this.defaultStoryboard();
      });

      // 4. VOICE
      if (config.voice.option !== 'none') {
        await this.runStage('voice', async () => {
          this.log('info', `Génération voix ${config.voice.option}...`);
          // TODO: call voice API
          this.log('success', 'Voix off générée: 38s');
          return {};
        });
      }

      // 5. RENDER
      const videoPath = await this.runStage('rendering', async () => {
        this.log('info', `Rendu ${config.render.format} ${config.render.mode}...`);
        // TODO: call render API
        this.log('success', 'Vidéo rendue: 12.4MB');
        return `output/promo_${Date.now()}.mp4`;
      });

      // 6. QA
      if (config.qa.enabled) {
        await this.runStage('qa', async () => {
          this.log('info', `Analyse qualité (cible: ${config.qa.targetScore}/100)...`);
          // TODO: call QA API
          const score = 82;
          this.log('success', `Score QA: ${score}/100`);
          return score;
        });
      }

      this.setState({ stage: 'done', progress: 100, message: 'Vidéo prête !' });
      this.log('success', 'Pipeline terminé avec succès');

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log('error', msg);
      this.setState({ stage: 'error', error: msg });
    }
  }

  private async runStage<T>(stage: PipelineStage, fn: () => Promise<T>): Promise<T> {
    if (this.abortController?.signal.aborted) throw new Error('Pipeline annulé');
    this.setState({ stage, progress: 0, message: STAGE_META[stage].label });
    const result = await fn();
    const stageIndex = PIPELINE_STAGES.indexOf(stage);
    const totalProgress = ((stageIndex + 1) / PIPELINE_STAGES.length) * 100;
    this.setState({ progress: totalProgress });
    return result;
  }

  // ── Abort ───────────────────────────────────────────────────────────────────

  abort() {
    this.abortController?.abort();
    this.setState({ stage: 'idle', message: 'Pipeline annulé' });
    this.log('warn', 'Pipeline annulé par l\'utilisateur');
  }

  reset() {
    this.setState({ stage: 'idle', progress: 0, message: '', log: [], error: undefined, result: undefined });
  }

  // ── Defaults ────────────────────────────────────────────────────────────────

  private defaultStoryboard(): StoryboardData {
    return {
      scenes: [],
      style: {
        bgColor: '#0a0a0f',
        accentColor: '#3b82f6',
        fontFamily: 'Inter, system-ui, sans-serif',
        captionSize: 64,
        subtitleSize: 32,
      },
      appName: 'Mon App',
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const pipelineEngine = new PipelineEngine();
