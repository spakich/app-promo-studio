import { interpolate } from 'remotion';
import { getEasing, type EasingName } from './easings';

/**
 * Scene transitions — how one screenshot hands off to the next.
 *
 * Professional transitions are NEVER abrupt. They create visual continuity:
 * - Cross-dissolve (soft blend)
 * - Slide push (new scene pushes old one out)
 * - Zoom through (old scene zooms in, new scene zooms out from blur)
 * - Wipe (geometric reveal)
 *
 * Each transition occupies a "transition zone" — typically 0.5–1 second
 * at the boundary between two scenes. The key insight: the transition
 * must START on the outgoing scene and FINISH on the incoming scene.
 */

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
  /** Duration in frames */
  durationFrames: number;
  easing: EasingName;
}

/**
 * Compute the transition state for the INCOMING scene.
 * Returns opacity and transform to apply to the new scene's wrapper.
 *
 * @param localFrame  Frame relative to the incoming scene's start
 * @param cfg         Transition config
 */
export function transitionIn(
  localFrame: number,
  cfg: TransitionConfig
): { opacity: number; transform: string; filter?: string } {
  const t = getEasing(cfg.easing)(
    interpolate(localFrame, [0, cfg.durationFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  switch (cfg.type) {
    case 'crossDissolve':
      return { opacity: t, transform: 'scale(1)' };

    case 'slidePush':
      return {
        opacity: t,
        transform: `translateX(${interpolate(t, [0, 1], [100, 0])}%)`,
      };

    case 'zoomThrough':
      return {
        opacity: t,
        transform: `scale(${interpolate(t, [0, 1], [1.3, 1])})`,
        filter: `blur(${interpolate(t, [0, 1], [8, 0])}px)`,
      };

    case 'wipe':
      return {
        opacity: 1,
        transform: 'scale(1)',
        filter: 'none',
      };

    case 'glitchCut': {
      // Hard cut with a 2-frame glitch shake
      if (localFrame < 2) {
        return {
          opacity: interpolate(localFrame, [0, 2], [0, 0.5]),
          transform: `translateX(${(Math.random() - 0.5) * 20}px)`,
          filter: 'hue-rotate(90deg) saturate(2)',
        };
      }
      return { opacity: 1, transform: 'scale(1)' };
    }

    case 'fadeToBlack': {
      // Gentle dissolve, NOT a hard black drop
      return {
        opacity: interpolate(t, [0, 0.7], [1, 0.85]),
        transform: 'scale(1.02)',
      };
    }

    case 'blurDissolve':
      return {
        opacity: t,
        transform: 'scale(1)',
        filter: `blur(${interpolate(t, [0, 1], [10, 0])}px)`,
      };

    default:
      return { opacity: t, transform: 'scale(1)' };
  }
}

/**
 * Compute the transition state for the OUTGOING scene.
 * Called on the scene that is leaving.
 */
export function transitionOut(
  localFrame: number,
  durationInFrames: number,
  cfg: TransitionConfig
): { opacity: number; transform: string; filter?: string } {
  // No transition (e.g. last scene): identity state, guard against
  // degenerate interpolate ranges ([d,d] crashes Remotion).
  if (!cfg.durationFrames || cfg.durationFrames <= 0) {
    return { opacity: 1, transform: 'scale(1)' };
  }
  // Time before the scene ends when transition starts
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
      return { opacity: 1 - t, transform: 'scale(1)' };

    case 'slidePush':
      return {
        opacity: interpolate(t, [0, 0.5], [1, 0]),
        transform: `translateX(${interpolate(t, [0, 1], [0, -100])}%)`,
      };

    case 'zoomThrough':
      return {
        opacity: interpolate(t, [0, 0.5], [1, 0]),
        transform: `scale(${interpolate(t, [0, 1], [1, 1.3])})`,
        filter: `blur(${interpolate(t, [0, 1], [0, 8])}px) |
                  hue-rotate(${interpolate(t, [0, 1], [0, 90])}deg)`,
      };

    case 'fadeToBlack':
      return {
        opacity: interpolate(t, [0, 0.7], [1, 0.85]),
        transform: 'scale(1.05)',
      };

    case 'blurDissolve':
      return {
        opacity: 1 - t,
        transform: 'scale(1)',
        filter: `blur(${interpolate(t, [0, 1], [0, 10])}px)`,
      };

    default:
      return { opacity: 1 - t, transform: 'scale(1)' };
  }
}

/** Recommended transition duration in frames (at 30fps) */
export const transitionDurations = {
  fast: 8,       // ~0.27s — snappy, energetic
  normal: 15,    // 0.5s — standard
  slow: 30,      // 1s — cinematic
  verySlow: 45,  // 1.5s — very dramatic
} as const;
