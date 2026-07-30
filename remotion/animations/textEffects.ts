import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { getEasing, springConfigs, type EasingName, type SpringConfigName } from './easings';

/**
 * Professional text animation effects.
 *
 * Everything that makes text feel alive:
 * - Word-by-word and letter-by-letter stagger
 * - Blur-to-focus
 * - Slide-up with easing
 * - Kinetic typography (mask reveals)
 *
 * The principle: text should NEVER appear all at once. It should arrive
 * deliberately, word by word, so the viewer reads in the direction the
 * video intends.
 */

export type TextEffect =
  | 'fadeUp'
  | 'blurIn'
  | 'typewriter'
  | 'maskReveal'
  | 'kineticPop'
  | 'slideUp'
  | 'letterWave';

export interface TextEffectConfig {
  delay?: number;
  stagger?: number;
  easing?: EasingName;
  spring?: SpringConfigName;
}

/** Fade-up: text rises into position while fading in. The workhorse. */
export function fadeUp(frame: number, startFrame: number, fps: number, cfg?: TextEffectConfig) {
  const delay = cfg?.delay ?? 0;
  const eased = getEasing(cfg?.easing ?? 'expoOut');
  const progress = eased(
    interpolate(frame, [startFrame + delay, startFrame + delay + fps * 0.5], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
  };
}

/** Blur-to-focus: text arrives sharp from blurred. Elegant. */
export function blurIn(frame: number, startFrame: number, fps: number, cfg?: TextEffectConfig) {
  const delay = cfg?.delay ?? 0;
  const eased = getEasing(cfg?.easing ?? 'expoOut');
  const progress = eased(
    interpolate(frame, [startFrame + delay, startFrame + delay + fps * 0.6], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  return {
    opacity: progress,
    filter: `blur(${interpolate(progress, [0, 1], [12, 0])}px)`,
    transform: `scale(${interpolate(progress, [0, 1], [1.06, 1])})`,
  };
}

/** Kinetic pop — text overshoots its position then settles. Uses spring physics. */
export function kineticPop(frame: number, startFrame: number, fps: number, cfg?: TextEffectConfig) {
  const delay = cfg?.delay ?? 0;
  const sConfig = springConfigs[cfg?.spring ?? 'default'];
  const s = spring({ frame: frame - startFrame - delay, fps, config: sConfig });
  return {
    opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
    transform: `scale(${s})`,
  };
}

/**
 * Word-by-word staggered reveal.
 * Each word slides up + fades in, one after another.
 * Pass the word index to stagger each word.
 */
export function wordStagger(
  frame: number,
  startFrame: number,
  fps: number,
  wordIndex: number,
  cfg?: TextEffectConfig
) {
  const stagger = cfg?.stagger ?? 4;
  const delay = (cfg?.delay ?? 0) + wordIndex * stagger;
  const eased = getEasing(cfg?.easing ?? 'backOut');
  const progress = eased(
    interpolate(frame, [startFrame + delay, startFrame + delay + fps * 0.4], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [25, 0])}px)`,
  };
}

/** Mask reveal — text hidden behind a clip-path, revealed left-to-right. */
export function maskReveal(frame: number, startFrame: number, fps: number, cfg?: TextEffectConfig) {
  const delay = cfg?.delay ?? 0;
  const eased = getEasing(cfg?.easing ?? 'expoOut');
  const progress = eased(
    interpolate(frame, [startFrame + delay, startFrame + delay + fps * 0.5], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  return {
    clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
    opacity: progress,
  };
}

/** Slide from the left, settling with ease-out. */
export function slideInLeft(frame: number, startFrame: number, fps: number) {
  const progress = getEasing('easeOut')(
    interpolate(frame, [startFrame, startFrame + fps * 0.4], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  return {
    opacity: progress,
    transform: `translateX(${interpolate(progress, [0, 1], [-60, 0])}px)`,
  };
}

/** Letter wave — each letter bounces in sequence using springs. */
export function letterWave(
  frame: number,
  startFrame: number,
  fps: number,
  letterIndex: number,
  cfg?: TextEffectConfig
) {
  const stagger = cfg?.stagger ?? 3;
  const delay = (cfg?.delay ?? 0) + letterIndex * stagger;
  const s = spring({
    frame: frame - startFrame - delay,
    fps,
    config: springConfigs.wobbly,
  });
  return {
    opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
    transform: `translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
  };
}

/** Helper: split text into words */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Helper: split text into letters */
export function splitLetters(text: string): string[] {
  return text.split('');
}

/** Animated gradient text — gradient rotates over time. */
export function animatedGradient(
  frame: number,
  fps: number,
  colors: string[] = ['#6366f1', '#a855f7', '#ec4899'],
  cycleDurationSeconds = 3
) {
  const cycle = frame / (fps * cycleDurationSeconds);
  const angle = (cycle * 360) % 360;
  return {
    background: `linear-gradient(${angle}deg, ${colors.join(', ')})`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  } as React.CSSProperties;
}
