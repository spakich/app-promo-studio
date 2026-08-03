/**
 * API Client — connects the studio UI to the pipeline server
 */

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://app-promo-studio-api.onrender.com' : 'http://localhost:3001');

export interface AnalysisResult {
  category: string;
  domain: string;
  routes: { path: string; component: string; file: string }[];
  uiStrings: string[];
  design: {
    colors: Record<string, string>;
    fonts: string[];
    isDarkMode: boolean;
  };
  features: { component: string; features: string[] }[];
  narrative: {
    appName: string;
    pitch: string;
    ctaText: string;
    scenes: { caption: string; subtitle: string; route: string; tab?: string }[];
  };
  fileCount: number;
}

export interface CaptureManifest {
  appUrl: string;
  totalCaptures: number;
  captures: { file: string; caption: string; subtitle: string; has_content: boolean }[];
}

export interface Storyboard {
  appName: string;
  pitch: string;
  ctaText: string;
  style: { bgColor: string; accentColor: string; fontFamily: string };
  scenes: { src: string; caption: string; subtitle: string; durationSeconds: number }[];
}

export interface QAResult {
  globalScore: number;
  verdict: string;
  darkFrameCount: number;
  issues: { type: string; severity: string; count: number; fix: string }[];
  corrections: { priority: string; issue: string; fix: string }[];
}

export interface PipelineOptions {
  githubUrl?: string;
  deployUrl?: string;
  voiceMode: 'tts' | 'custom' | 'none';
  voiceLang?: 'fr' | 'en';
  voiceFile?: string;
  musicMode: 'auto' | 'custom' | 'none';
  musicFile?: string;
  renderStyle: 'screencast' | 'cinematic';
  format: 'horizontal' | 'vertical' | 'square';
  qaTarget: number;
  maxIterations?: number;
}

// ── Analyze ──
export async function analyzeApp(githubUrl: string, deployUrl?: string): Promise<{ success: boolean; analysis?: AnalysisResult; error?: string }> {
  const resp = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ githubUrl, deployUrl }),
  });
  return resp.json();
}

// ── Capture ──
export async function captureApp(appUrl: string): Promise<{ success: boolean; manifest?: CaptureManifest; error?: string }> {
  const resp = await fetch(`${API_BASE}/api/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appUrl }),
  });
  return resp.json();
}

// ── Storyboard ──
export async function generateStoryboard(capturesDir: string, appName: string, pitch: string, ctaText: string): Promise<{ success: boolean; storyboard?: Storyboard; error?: string }> {
  const resp = await fetch(`${API_BASE}/api/storyboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capturesDir, appName, pitch, ctaText }),
  });
  return resp.json();
}

// ── Voice ──
export async function generateVoice(storyboardPath: string, language: string): Promise<{ success: boolean; voicePath?: string; error?: string }> {
  const resp = await fetch(`${API_BASE}/api/voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyboardPath, language }),
  });
  return resp.json();
}

// ── Render ──
export async function renderVideo(storyboardPath: string, format: string): Promise<{ success: boolean; videoPath?: string; error?: string }> {
  const resp = await fetch(`${API_BASE}/api/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyboardPath, format }),
  });
  return resp.json();
}

// ── QA ──
export async function runQA(videoPath: string, storyboardPath: string, target: number): Promise<{ success: boolean; report?: QAResult; passed?: boolean; error?: string }> {
  const resp = await fetch(`${API_BASE}/api/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoPath, storyboardPath, target }),
  });
  return resp.json();
}

// ── Full Pipeline ──
export async function runPipeline(opts: PipelineOptions): Promise<{ jobId: string; message: string }> {
  const resp = await fetch(`${API_BASE}/api/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return resp.json();
}

// ── Job Status ──
export async function getJobStatus(jobId: string): Promise<{
  success: boolean;
  job?: {
    type: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    currentStep?: string;
    progress: number;
    result?: { videoPath: string; qaScore: number; qaPassed: boolean; iterations: number };
    error?: string;
  };
}> {
  const resp = await fetch(`${API_BASE}/api/status/${jobId}`);
  return resp.json();
}

// ── Download URL ──
export function downloadUrl(path: string): string {
  return `${API_BASE}/api/download?path=${encodeURIComponent(path)}`;
}
