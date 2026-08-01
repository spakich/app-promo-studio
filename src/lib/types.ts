// Core types for App Promo Studio

export type VideoFormat = 'horizontal' | 'vertical' | 'square';
export type TransitionType = 'fade' | 'slide' | 'zoom' | 'none';
export type ProjectStatus = 'draft' | 'rendering' | 'completed' | 'failed';

export interface Screenshot {
  id: string;
  /** Local object URL during upload, then Supabase public URL */
  url: string;
  storage_path: string;
  display_order: number;
  caption?: string;
  /** Short caption / tagline shown over the screenshot */
  subtitle?: string;
  transition: TransitionType;
  duration: number;
  metadata?: Record<string, any>;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  app_name?: string;
  app_icon_url?: string;
  template_id: string;
  format: VideoFormat;
  status: ProjectStatus;
  video_url?: string;
  thumbnail_url?: string;
  duration_seconds: number;
  fps: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  config: TemplateConfig;
  is_premium: boolean;
  category: string;
}

export interface TemplateConfig {
  bgColor: string;
  accentColor: string;
  fontFamily: string;
  watermark: boolean;
  introDuration: number;
  outroDuration: number;
}

export interface RenderJob {
  id: string;
  project_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  output_url?: string;
  error_message?: string;
  render_provider: 'local' | 'cloud-run' | 'lambda';
  started_at?: string;
  completed_at?: string;
  created_at: string;
}
