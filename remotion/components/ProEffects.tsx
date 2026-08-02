import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random } from 'remotion';
import { getEasing } from '../animations/easings';

/**
 * PRO-GRADE visual effects layer that sits ON TOP of the screenshot.
 * These make the difference between "slideshow" and "motion design video".
 *
 * Layers (back to front):
 *   1. Animated mesh gradient background (moves slowly)
 *   2. Floating particles (depth + atmosphere)
 *   3. Light sweep that crosses the device periodically
 *   4. Simulated cursor that moves and clicks
 *   5. Edge glow / inner shadow on device frame
 */

// ═══════════════════════════════════════════════════════════
// 1. MESH GRADIENT BACKGROUND
// ═══════════════════════════════════════════════════════════
export const MeshGradient: React.FC<{
  accentColor: string;
  bgColor: string;
}> = ({ accentColor, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Two blobs that orbit slowly
  const blob1X = interpolate(Math.sin(frame / (fps * 4)), [-1, 1], [20, 70]);
  const blob1Y = interpolate(Math.cos(frame / (fps * 5)), [-1, 1], [20, 60]);
  const blob2X = interpolate(Math.cos(frame / (fps * 6)), [-1, 1], [60, 30]);
  const blob2Y = interpolate(Math.sin(frame / (fps * 3.5)), [-1, 1], [50, 30]);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <div
        style={{
          position: 'absolute',
          width: '60%',
          height: '60%',
          left: `${blob1X}%`,
          top: `${blob1Y}%`,
          background: `radial-gradient(circle, ${accentColor}25 0%, transparent 60%)`,
          filter: 'blur(80px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '50%',
          height: '50%',
          left: `${blob2X}%`,
          top: `${blob2Y}%`,
          background: `radial-gradient(circle, ${accentColor}15 0%, transparent 60%)`,
          filter: 'blur(60px)',
        }}
      />
      {/* Subtle grid overlay for tech feel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${accentColor}08 1px, transparent 1px), linear-gradient(90deg, ${accentColor}08 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          opacity: 0.3,
        }}
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════
// 2. PARTICLE FIELD — floating dots for depth
// ═══════════════════════════════════════════════════════════
const PARTICLE_COUNT = 25;

export const ParticleField: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const seed = i * 137;
    const baseX = random(`x-${i}`) * 100;
    const baseY = random(`y-${i}`) * 100;
    const size = 2 + random(`s-${i}`) * 5;
    const speed = 0.3 + random(`v-${i}`) * 0.8;
    const phase = random(`p-${i}`) * Math.PI * 2;

    // Gentle floating motion
    const driftY = interpolate(frame, [0, durationInFrames], [0, -30 * speed], {
      extrapolateRight: 'extend',
    });
    const driftX = Math.sin(frame / (fps * 2) + phase) * 8;

    const opacity = interpolate(
      Math.sin(frame / (fps * 3) + phase),
      [-1, 1],
      [0.1, 0.5]
    );

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${baseX + driftX}%`,
          top: `${baseY + driftY}%`,
          width: size,
          height: size,
          borderRadius: '50%',
          background: accentColor,
          opacity,
          filter: `blur(${size > 4 ? 2 : 0}px)`,
          boxShadow: `0 0 ${size * 2}px ${accentColor}88`,
        }}
      />
    );
  });

  return <AbsoluteFill style={{ pointerEvents: 'none' }}>{particles}</AbsoluteFill>;
};

// ═══════════════════════════════════════════════════════════
// 3. LIGHT SWEEP — a diagonal light bar that sweeps across
// ═══════════════════════════════════════════════════════════
export const LightSweep: React.FC<{
  accentColor: string;
  cycleSeconds?: number;
}> = ({ accentColor, cycleSeconds = 5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cycleFrames = cycleSeconds * fps;
  const cyclePos = (frame % cycleFrames) / cycleFrames;

  // Only visible during first 20% of sweep, subtle
  if (cyclePos > 0.2) return null;

  const x = interpolate(cyclePos, [0, 0.2], [-30, 130]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: '-20%',
          width: '15%',
          height: '140%',
          background: `linear-gradient(105deg, transparent 35%, ${accentColor}10 50%, transparent 65%)`,
          filter: 'blur(20px)',
          transform: 'skewX(-15deg)',
        }}
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════
// 4. SIMULATED CURSOR — moves to focal points and clicks
// ═══════════════════════════════════════════════════════════
export const SimulatedCursor: React.FC<{
  focal?: { x: number; y: number };
  accentColor: string;
  sceneStartFrame?: number;
}> = ({ focal, accentColor, sceneStartFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!focal) return null;

  const targetX = focal.x * 100; // 0-100%
  const targetY = focal.y * 100;

  // Cursor enters from corner, moves to focal point
  const moveProgress = getEasing('expoOut')(
    interpolate(frame - sceneStartFrame, [fps * 0.5, fps * 1.8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  const cursorX = interpolate(moveProgress, [0, 1], [15, targetX]);
  const cursorY = interpolate(moveProgress, [0, 1], [85, targetY]);

  // Click pulse at focal point
  const clickFrame = Math.round(fps * 2);
  const clickProgress = interpolate(
    frame - sceneStartFrame,
    [clickFrame, clickFrame + fps * 0.5],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const clickRadius = interpolate(clickProgress, [0, 1], [0, 60]);
  const clickOpacity = interpolate(clickProgress, [0, 0.3, 1], [0.8, 0.5, 0]);

  return (
    <>
      {/* Click ripple */}
      {clickProgress > 0 && clickProgress < 1 && (
        <div
          style={{
            position: 'absolute',
            left: `${targetX}%`,
            top: `${targetY}%`,
            width: clickRadius,
            height: clickRadius,
            marginLeft: -clickRadius / 2,
            marginTop: -clickRadius / 2,
            borderRadius: '50%',
            border: `2px solid ${accentColor}`,
            opacity: clickOpacity,
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Cursor */}
      <div
        style={{
          position: 'absolute',
          left: `${cursorX}%`,
          top: `${cursorY}%`,
          opacity: moveProgress > 0 ? 1 : 0,
          transform: 'translate(-30%, -10%)',
          transition: 'opacity 0.3s',
          pointerEvents: 'none',
          zIndex: 100,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path
            d="M5 3 L5 22 L10 17 L13 25 L17 23 L14 15 L21 15 Z"
            fill="white"
            stroke={accentColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {/* Cursor glow */}
        <div
          style={{
            position: 'absolute',
            left: -8,
            top: -8,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: `${accentColor}33`,
            filter: 'blur(8px)',
          }}
        />
      </div>
    </>
  );
};

// ═════════════ attorneys═══════════════════════════════════════
// 5. DEVICE GLOW — pulsing aura behind the device
// ═══════════════════════════════════════════════════════════
export const DeviceGlow: React.FC<{
  accentColor: string;
  intensity?: number;
}> = ({ accentColor, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = interpolate(
    Math.sin(frame / (fps * 2)) * 0.5 + 0.5,
    [0, 1],
    [0.3 * intensity, 0.6 * intensity]
  );

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          width: '70%',
          height: '60%',
          borderRadius: 30,
          background: `radial-gradient(ellipse at center, ${accentColor}${Math.round(pulse * 255).toString(16).padStart(2, '0')} 0%, transparent 65%)`,
          filter: 'blur(50px)',
        }}
      />
    </AbsoluteFill>
  );
};
