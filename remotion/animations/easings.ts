import { Easing } from 'remotion';

/**
 * Professional Easing Library
 * 12 curves covering every motion design need.
 *
 * Categories:
 * - Standard: balanced ease-in-out for general movement
 * - Anticipation: objects that "wind up" before moving
 * - Impact: snap-in for entrances, snap-out for exits
 * - Organic: spring-based physics for natural feel
 */

export const easings = {
  // ── Standard ──────────────────────────────────────────────
  /** Smooth ease-in-out, the workhorse. Most UI animations. */
  easeInOut: Easing.bezier(0.45, 0, 0.55, 1),
  /** Gentle start, strong finish. Elements settling into place. */
  easeOut: Easing.bezier(0.16, 1, 0.3, 1),
  /** Strong start, gentle finish. Elements leaving the scene. */
  easeIn: Easing.bezier(0.7, 0, 0.84, 0),

  // ── Impact (expo — dramatic entrances) ────────────────────
  /** Exponential ease-out. Hero elements snapping in. */
  expoOut: Easing.out(Easing.exp),
  /** Exponential ease-in. Elements accelerating out. */
  expoIn: Easing.in(Easing.exp),

  // ── Back overshoot (elastic feel) ─────────────────────────
  /** Slight overshoot on enter — playful, energetic. */
  backOut: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Slight overshoot on exit. */
  backIn: Easing.bezier(0.36, 0, 0.66, -0.56),

  // ── Anticipation (wind-up before action) ──────────────────
  /** Pulls back slightly before moving forward. Cartoon-like, expressive. */
  anticipate: Easing.bezier(0.68, -0.6, 0.32, 1.6),

  // ── Cinematic ─────────────────────────────────────────────
  /** Very slow start, fast middle, slow end. Film transitions. */
  cinematic: Easing.bezier(0.7, 0, 0.3, 1),
  /** Quicker than easeOut, feels snappy and modern. */
  snappy: Easing.bezier(0.2, 0.8, 0.2, 1),

  // ── Mechanical ────────────────────────────────────────────
  /** Almost linear with slight curve. Technical UI elements. */
  mechanical: Easing.bezier(0.4, 0, 0.2, 1),

  // ── Special ───────────────────────────────────────────────
  /** Perfectly linear. Use sparingly — looks robotic. */
  linear: Easing.linear,
} as const;

export type EasingName = keyof typeof easings;

/** Get a Bezier/Function easing by name */
export function getEasing(name: EasingName) {
  return easings[name];
}

/** Easing presets optimized for specific use cases */
export const easingPresets = {
  entrance: 'expoOut',     // Element entering the scene
  exit: 'easeIn',          // Element leaving the scene
  settle: 'easeOut',       // Element finding its resting position
  hero: 'backOut',         // Title, logo — needs to pop
  ui: 'snappy',            // Buttons, badges, small UI
  cinematic: 'cinematic',  // Dramatic film-like movement
} as const;

/** Spring configs for organic, physics-based animation */
export const springConfigs = {
  /** Default — natural, balanced */
  default: { damping: 12, mass: 1, stiffness: 120 },
  /** Gentle — soft bounce */
  gentle: { damping: 18, mass: 1, stiffness: 80 },
  /** Wobbly — playful bounce */
  wobbly: { damping: 8, mass: 1, stiffness: 180 },
  /** Stiff — quick, precise */
  stiff: { damping: 20, mass: 0.8, stiffness: 200 },
  /** Slow — deliberate, cinematic */
  slow: { damping: 30, mass: 1.2, stiffness: 60 },
} as const;

export type SpringConfigName = keyof typeof springConfigs;
