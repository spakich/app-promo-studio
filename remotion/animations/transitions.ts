import { interpolate } from 'remotion';
import { getEasing, type EasingName } from './easings';

export type TransitionType =
  | 'crossDissolve'
  | 'slidePush'
  | 'zoomThrough'
  | 'wipe'
  | 'glitchCut'
  | 'fadeToBlack'
  | 'blurDissolve';

export interface TransitionConfig {
  type: TransitionType;
  durationFrames: number;
  easing: EasingName;
}

/**
 * INCOMING scene transition. New scene enters.
 * KEY: opacity stays HIGH. No dark frames. Movement carries the transition.
 */
export function transitionIn(
  localFrame: number,
  cfg: TransitionConfig
): { opacity: number; transform: string; filter?: string } {
  if (!cfg.durationFrames || cfg.durationFrames <= 0) {
    return { opacity: 1, transform: 'scale(1)' };
  }

  const t = getEasing(cfg.easing)(
    interpolate(localFrame, [0, cfg.durationFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  switch (cfg.type) {
    case 'crossDissolve':
      // Quick fade-in but NEVER below 0.7
      return { opacity: interpolate(t, [0, 1], [0.6, 1]), transform: 'scale(1)' };

    case 'slidePush':
      return {
        opacity: 1,
        transform: `translateX(${interpolate(t, [0, 1], [60, 0])}%)`,
      };

    case 'zoomThrough':
      return {
        opacity: interpolate(t, [0, 0.3, 1], [0.5, 0.9, 1]),
        transform: `scale(${interpolate(t, [0, 1], [1.15, 1])})`,
      };

    case 'wipe':
      return {
        opacity: 1,
        transform: `translateX(${interpolate(t, [0, 1], [100, 0])}%)`,
      };

    case 'glitchCut': {
      if (localFrame < 2) {
        return {
          opacity: 0.8,
          transform: `translateX(${(Math.random() - 0.5) * 10}px)`,
        };
      }
      return { opacity: 1, transform: 'scale(1)' };
    }

    case 'fadeToBlack': {
      // NOT black. Gentle bright crossfade.
      return {
        opacity: interpolate(t, [0, 1], [0.5, 1]),
        transform: 'scale(1)',
      };
    }

    case 'blurDissolve':
      return {
        opacity: interpolate(t, [0, 0.3, 1], [0.6, 0.9, 1]),
        transform: 'scale(1)',
        filter: `blur(${interpolate(t, [0, 1], [6, 0])}px)`,
      };

    default:
      return { opacity: t, transform: 'scale(1)' };
  }
}

/**
 * OUTGOING scene transition. Scene leaves.
 * KEY: opacity stays at 0.9 minimum. No dark drops.
 * The MOVEMENT (slide/zoom) carries the eye to the next scene.
 */
export function transitionOut(
  localFrame: number,
  durationInFrames: number,
  cfg: TransitionConfig
): { opacity: number; transform: string; filter?: string } {
  if (!cfg.durationFrames || cfg.durationFrames <= 0) {
    return { opacity: 1, transform: 'scale(1)' };
  }

  const transitionStart = durationInFrames - cfg.durationFrames;
  const t = getEasing(cfg.easing)(
    interpolate(
      localFrame,
      [transitionStart, durationInFrames],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    )
  );

  switch (cfg.type) {
    case 'crossDissolve':
      // Stay bright — just a gentle fade
      return { opacity: interpolate(t, [0, 1], [1, 0.7]), transform: 'scale(1)' };

    case 'slidePush':
      return {
        opacity: 1,
        transform: `translateX(${interpolate(t, [0, 1], [0, -60])}%)`,
      };

    case 'zoomThrough':
      return {
        opacity: interpolate(t, [0, 0.5], [1, 0.7]),
        transform: `scale(${interpolate(t, [0, 1], [1, 1.15])})`,
      };

    case 'fadeToBlack':
      // NO BLACK. Just gentle scale + slight fade.
      return {
        opacity: interpolate(t, [0, 1], [1, 0.6]),
        transform: 'scale(1.03)',
      };

    case 'blurDissolve':
      return {
        opacity: interpolate(t, [0, 1], [1, 0.7]),
        transform: 'scale(1)',
      };

    default:
      return { opacity: interpolate(t, [0, 1], [1, 0.7]), transform: 'scale(1)' };
  }
}

/** Transition durations (at 30fps) — SHORTER = snappier, fewer dark frames */
export const transitionDurations = {
  fast: 6,       // 0.2s — snappy cut
  normal: 10,    // 0.33s — standard, fast enough to avoid dark frames
  slow: 18,      // 0.6s — cinematic
  verySlow: 30,  // 1s — very dramatic
} as const;
