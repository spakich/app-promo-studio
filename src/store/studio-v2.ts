/**
 * Studio Store V2 — Central state for the entire app
 * Connects: pipeline engine + storyboard editor + preview + voice + render queue
 */

import { create } from 'zustand';
import {
  pipelineEngine,
  type PipelineState,
  type PipelineConfig,
  type StoryboardData,
  type SceneData,
  type RenderMode,
  type VideoFormat,
  type VoiceOption,
} from '../lib/pipeline-v2';
import type { SceneStyle } from '../../remotion/components/ScreencastScene';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudioState {
  // Pipeline
  pipeline: PipelineState;
  config: PipelineConfig;

  // Storyboard
  storyboard: StoryboardData;

  // Preview
  currentSceneIndex: number;
  isPlaying: boolean;
  previewFrame: number;

  // Actions: Pipeline
  runPipeline: () => void;
  abortPipeline: () => void;
  resetPipeline: () => void;

  // Actions: Storyboard
  setStoryboard: (sb: StoryboardData) => void;
  updateScene: (index: number, updates: Partial<SceneData>) => void;
  addScene: (scene: SceneData) => void;
  removeScene: (index: number) => void;
  reorderScenes: (from: number, to: number) => void;
  updateStyle: (updates: Partial<SceneStyle>) => void;
  setAppName: (name: string) => void;
  setPitch: (pitch: string) => void;
  setCtaText: (cta: string) => void;

  // Actions: Config
  setCaptureUrl: (url: string) => void;
  setCredentials: (email: string, password: string) => void;
  setRenderMode: (mode: RenderMode) => void;
  setFormat: (format: VideoFormat) => void;
  setVoice: (option: VoiceOption, script?: string, rate?: number) => void;

  // Actions: Preview
  setCurrentScene: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  setPreviewFrame: (frame: number) => void;
}

// ─── Default storyboard ───────────────────────────────────────────────────────

const defaultStyle: SceneStyle = {
  bgColor: '#0a0a0f',
  accentColor: '#3b82f6',
  fontFamily: 'Inter, system-ui, sans-serif',
  captionSize: 64,
  subtitleSize: 32,
};

const defaultStoryboard: StoryboardData = {
  scenes: [],
  style: defaultStyle,
  appName: 'Mon Application',
  pitch: 'La solution tout-en-un',
  ctaText: 'Essayer gratuitement',
};

const defaultConfig: PipelineConfig = {
  capture: { url: '' },
  voice: { option: 'henri', script: '', rate: 0.12 },
  render: { mode: 'cinematic', format: '16:9', quality: 'high', fps: 30 },
  qa: { enabled: true, targetScore: 75, maxIterations: 3 },
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStudioStore = create<StudioState>((set, get) => {
  // Subscribe to pipeline engine updates
  pipelineEngine.subscribe((state) => {
    set({ pipeline: state });
  });

  return {
    pipeline: pipelineEngine.getState(),
    config: defaultConfig,
    storyboard: defaultStoryboard,
    currentSceneIndex: 0,
    isPlaying: false,
    previewFrame: 0,

    // ── Pipeline ──
    runPipeline: () => {
      const { config, storyboard } = get();
      pipelineEngine.run({ ...config, storyboard });
    },
    abortPipeline: () => pipelineEngine.abort(),
    resetPipeline: () => pipelineEngine.reset(),

    // ── Storyboard ──
    setStoryboard: (sb) => set({ storyboard: sb }),

    updateScene: (index, updates) => set((state) => {
      const scenes = [...state.storyboard.scenes];
      scenes[index] = { ...scenes[index], ...updates };
      return { storyboard: { ...state.storyboard, scenes } };
    }),

    addScene: (scene) => set((state) => ({
      storyboard: {
        ...state.storyboard,
        scenes: [...state.storyboard.scenes, scene],
      },
    })),

    removeScene: (index) => set((state) => {
      const scenes = state.storyboard.scenes.filter((_, i) => i !== index);
      return { storyboard: { ...state.storyboard, scenes } };
    }),

    reorderScenes: (from, to) => set((state) => {
      const scenes = [...state.storyboard.scenes];
      const [moved] = scenes.splice(from, 1);
      scenes.splice(to, 0, moved);
      return { storyboard: { ...state.storyboard, scenes } };
    }),

    updateStyle: (updates) => set((state) => ({
      storyboard: { ...state.storyboard, style: { ...state.storyboard.style, ...updates } },
    })),

    setAppName: (name) => set((state) => ({
      storyboard: { ...state.storyboard, appName: name },
    })),

    setPitch: (pitch) => set((state) => ({
      storyboard: { ...state.storyboard, pitch },
    })),

    setCtaText: (cta) => set((state) => ({
      storyboard: { ...state.storyboard, ctaText: cta },
    })),

    // ── Config ──
    setCaptureUrl: (url) => set((state) => ({
      config: { ...state.config, capture: { ...state.config.capture, url } },
    })),

    setCredentials: (email, password) => set((state) => ({
      config: { ...state.config, capture: { ...state.config.capture, credentials: { email, password } } },
    })),

    setRenderMode: (mode) => set((state) => ({
      config: { ...state.config, render: { ...state.config.render, mode } },
    })),

    setFormat: (format) => set((state) => ({
      config: { ...state.config, render: { ...state.config.render, format } },
    })),

    setVoice: (option, script, rate) => set((state) => ({
      config: {
        ...state.config,
        voice: {
          ...state.config.voice,
          option,
          ...(script !== undefined ? { script } : {}),
          ...(rate !== undefined ? { rate } : {}),
        },
      },
    })),

    // ── Preview ──
    setCurrentScene: (index) => set({ currentSceneIndex: index }),
    setPlaying: (playing) => set({ isPlaying: playing }),
    setPreviewFrame: (frame) => set({ previewFrame: frame }),
  };
});
