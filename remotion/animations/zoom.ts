import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { getEasing, type EasingName } from './easings';

/**
 * Ken Burns engine with focal-point zoom.
 *
 * A professional camera move isn't just "zoom toward center" —
 * it targets a specific point on the screenshot (a button, a chart,
 * a face) and glides there with an easing curve.
 *
 * The zoom never starts or ends abruptly: there's always a brief
 * "dead zone" at the start and end of the clip so the viewer's eye
 * can settle, then move, then settle again.
 *
 * Usage:
 *   const kb = kenBurns(frame, fps, durationFrames, {
 *     startX: 0.5, startY: 0.5, startScale: 1.0,
 *     endX: 0.3,   endY: 0.35,  endScale: 1.3,
 *     easing: 'cinematic',
 *   });
 *   <Img style={{ transform: kb.transform, transformOrigin: kb.origin }} />
 */

export interface FocalPoint {
  /** 0–1, normalized coordinates. 0.5 = center */
  x: number;
  y: number;
}

export interface ZoomConfig {
  startX: number;
  startY: number;
  startScale: number;
  endX: number;
  endY: number;
  endScale: number;
  easing: EasingName;
  /** Dead zone percentage (0–1). Default 0.15 (15% hold at start/end) */
  settle?: number;
}

export interface ZoomPreset {
  label: string;
  config: ZoomConfig;
}

/**
 * Ken Burns presets — every common camera move used in promo videos.
 * Focal points target typical UI elements on a screenshot.
 */
export const zoomPresets: Record<string, ZoomPreset> = {
  /** Slow zoom toward center. Default, safe, works on any screenshot. */
  center: {
    label: 'Zoom centré',
    config: { startX: 0.5, startY: 0.5, startScale: 1.0, endX: 0.5, endY: 0.5, endScale: 1.15, easing: 'cinematic', settle: 0.15 },
  },
  /** Push in toward the top-right — a button or CTA. */
  topRight: {
    label: 'Zoom bouton/CTA',
    config: { startX: 0.5, startY: 0.5, startScale: 1.0, endX: 0.75, endY: 0.2, endScale: 1.4, easing: 'cinematic', settle: 0.15 },
  },
  /** Glide toward bottom-left — a chart or data row. */
  bottomLeft: {
    label: 'Zoom data/bas',
    config: { startX: 0.5, startY: 0.5, startScale: 1.0, endX: 0.25, endY: 0.8, endScale: 1.35, easing: 'cinematic', settle: 0.15 },
  },
  /** Horizontal pan right, constant scale. Scrolling through a list. */
  panRight: {
    label: 'Panoramique →',
    config: { startX: 0.2, startY: 0.5, startScale: 1.25, endX: 0.8, endY: 0.5, endScale: 1.25, easing: 'easeInOut', settle: 0.1 },
  },
  /** Horizontal pan left. */
  panLeft: {
    label: 'Panoramique ←',
    config: { startX: 0.8, startY: 0.5, startScale: 1.25, endX: 0.2, endY: 0.5, endScale: 1.25, easing: 'easeInOut', settle: 0.1 },
  },
  /** Vertical pan down — revealing a list. */
  panDown: {
    label: 'Panoramique ↓',
    config: { startX: 0.5, startY: 0.2, startScale: 1.25, endX: 0.5, endY: 0.8, endScale: 1.25, easing: 'easeInOut', settle: 0.1 },
  },
  /** Vertical pan up — revealing content above the fold. */
  panUp: {
    label: 'Panoramique ↑',
    config: { startX: 0.5, startY: 0.8, startScale: 1.25, endX: 0.5, endY: 0.2, endScale: 1.25, easing: 'easeInOut', settle: 0.1 },
  },
  /** Slow pull-out from a detail to the full screenshot. */
  pullOut: {
    label: 'Recul',
    config: { startX: 0.5, startY: 0.5, startScale: 1.3, endX: 0.5, endY: 0.5, endScale: 1.0, easing: 'expoOut', settle: 0.15 },
  },
  /** No movement — static frame with subtle breathing. */
  static: {
    label: 'Fixe',
    config: { startX: 0.5, startY: 0.5, startScale: 1.05, endX: 0.5, endY: 0.5, endScale: 1.08, easing: 'easeInOut', settle: 0.5 },
  },
};

/**
 * Compute the transform for a Ken Burns move at the current frame.
 * Returns CSS transform string + transform-origin for the <Img>.
 */
export function kenBurns(
  frame: number,
  fps: number,
  durationInFrames: number,
  cfg: ZoomConfig
): { transform: string; origin: string } {
  const settle = cfg.settle ?? 0.15;
  // Progress 0→1 across the clip, with dead zones at start/end
  const rawProgress = interpolate(
    frame,
    [0, durationInFrames * settle, durationInFrames * (1 - settle), durationInFrames],
    [0, 0, 1, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const eased = getEasing(cfg.easing)(rawProgress);

  const x = interpolate(eased, [0, 1], [cfg.startX, cfg.endX]);
  const y = interpolate(eased, [0, 1], [cfg.startY, cfg.endY]);
  const scale = interpolate(eased, [0, 1], [cfg.startScale, cfg.endScale]);

  return {
    transform: `scale(${scale})`,
    origin: `${x * 100}% ${y * 100}%`,
  };
}
