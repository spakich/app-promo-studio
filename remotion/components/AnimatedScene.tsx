import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile } from 'remotion';
import { kenBurns, zoomPresets } from '../animations/zoom';
import { transitionOut, transitionDurations, type TransitionType } from '../animations/transitions';
import { fadeUp, wordStagger } from '../animations/textEffects';
import { getEasing } from '../animations/easings';
import { MeshGradient, ParticleField, LightSweep, SimulatedCursor, DeviceGlow } from './ProEffects';

export interface SceneData {
  src: string;
  caption?: string;
  subtitle?: string;
  zoomPreset?: string;
  transitionOut?: TransitionType;
  durationSeconds: number;
  focal?: { x: number; y: number };
}

export interface SceneStyle {
  bgColor: string;
  accentColor: string;
  fontFamily: string;
  captionSize: number;
  subtitleSize: number;
  watermark?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * PRO-GRADE ANIMATED SCENE — Apple/Linear/Stripe level motion
 * ═══════════════════════════════════════════════════════════════
 *
 * Layers (back to front):
 *   1. Mesh gradient background (animated blobs + grid)
 *   2. Particle field (floating dots for depth)
 *   3. Device glow (pulsing aura)
 *   4. 3D Device mockup with screenshot (Ken Burns inside)
 *   5. Light sweep (periodic diagonal shine)
 *   6. Simulated cursor (moves to focal + click ripple)
 *   7. Caption overlay (bottom third with accent bar)
 *
 * Camera moves: 3D push-in (Z depth), tilt settle, parallax exit
 * ═══════════════════════════════════════════════════════════════
 */
export const AnimatedScene: React.FC<{
  scene: SceneData;
  sceneIndex: number;
  totalScenes: number;
  startFrame: number;
  style: SceneStyle;
  isLast: boolean;
}> = ({ scene, sceneIndex, startFrame, style, isLast }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const durationInFrames = Math.round(scene.durationSeconds * fps);
  const localFrame = frame; // Inside <Sequence>, frame is already relative

  // ── 3D camera: dramatic push-in, settle, slight push on exit ──
  const easing = getEasing('expoOut');
  const enterProgress = easing(
    interpolate(localFrame, [0, Math.round(fps * 0.7)], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })
  );
  const exitProgress = isLast ? 0 : easing(
    interpolate(localFrame, [durationInFrames - Math.round(fps * 0.4), durationInFrames], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })
  );

  // Z-depth: start far, push in close, slight forward drift on exit
  const z = interpolate(enterProgress, [0, 1], [300, -30]) + interpolate(exitProgress, [0, 1], [0, 80]);
  const rotX = interpolate(enterProgress, [0, 1], [20, 4]) + interpolate(exitProgress, [0, 1], [0, -3]);
  const rotY = interpolate(enterProgress, [0, 1], [-12, 0]) + interpolate(exitProgress, [0, 1], [0, 6]);
  const translateX = interpolate(enterProgress, [0, 1], [40, 0]);
  const translateY = interpolate(enterProgress, [0, 1], [20, 0]);

  // Scene opacity (fade in on entry)
  const sceneOpacity = interpolate(localFrame, [0, Math.round(fps * 0.4)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Ken Burns inside the screenshot ──
  const presetName = scene.zoomPreset || 'center';
  const preset = zoomPresets[presetName] || zoomPresets.center;
  const config = scene.focal
    ? { ...preset.config, endX: scene.focal.x, endY: scene.focal.y }
    : preset.config;
  const kb = kenBurns(localFrame, fps, durationInFrames, config);

  // ── Transition out ──
  const tType = scene.transitionOut || 'crossDissolve';
  const tDuration = isLast ? 0 : transitionDurations.normal;
  const outState = transitionOut(localFrame, durationInFrames, {
    type: tType, durationFrames: tDuration, easing: 'easeInOut',
  });

  // ── Caption timing ──
  const captionEnter = interpolate(localFrame, [Math.round(fps * 0.15), Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const captionExit = interpolate(localFrame, [durationInFrames - Math.round(fps * 0.5), durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const captionOpacity = captionEnter * captionExit;

  // ── Device frame ──
  const deviceWidth = 1440;
  const deviceHeight = 810;
  const radius = 14;
  const titleBarHeight = 36;

  // ── Accent bar (above caption) ──
  const accentBarScale = interpolate(localFrame, [Math.round(fps * 0.4), Math.round(fps * 0.8)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity * (outState.opacity ?? 1) }}>
      {/* ── 1. MESH GRADIENT BACKGROUND ──────────────────── */}
      <MeshGradient accentColor={style.accentColor} bgColor={style.bgColor} />

      {/* ── 2. PARTICLE FIELD ────────────────────────────── */}
      <ParticleField accentColor={style.accentColor} />

      {/* ── 3. DEVICE GLOW ───────────────────────────────── */}
      <DeviceGlow accentColor={style.accentColor} intensity={0.8} />

      {/* ── 4. 3D DEVICE MOCKUP ──────────────────────────── */}
      <AbsoluteFill style={{ perspective: 1400 }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '44%',
            width: deviceWidth,
            height: deviceHeight,
            marginLeft: -deviceWidth / 2,
            marginTop: -deviceHeight / 2,
            transformStyle: 'preserve-3d',
            transform: `translate3d(${translateX}px, ${translateY}px, ${z}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
            boxShadow: '0 60px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
            borderRadius: radius,
            overflow: 'hidden',
          }}
        >
          {/* Browser title bar */}
          <div style={{
            height: titleBarHeight,
            background: 'rgba(20,20,25,0.95)',
            display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8,
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            <div style={{
              marginLeft: 24, padding: '4px 60px',
              background: 'rgba(255,255,255,0.04)', borderRadius: 6,
              fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace',
            }}>●●●</div>
          </div>

          {/* Screenshot with Ken Burns */}
          <div style={{
            width: deviceWidth, height: deviceHeight - titleBarHeight,
            overflow: 'hidden', position: 'relative',
          }}>
            <Img
              src={scene.src.startsWith('http') ? scene.src : staticFile(scene.src)}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: kb.transform, transformOrigin: kb.origin,
              }}
            />

            {/* 5. LIGHT SWEEP inside the device ── */}
            <LightSweep accentColor={style.accentColor} cycleSeconds={4} />

            {/* 6. SIMULATED CURSOR ── */}
            <SimulatedCursor
              focal={scene.focal}
              accentColor={style.accentColor}
              sceneStartFrame={0}
            />
          </div>
        </div>
      </AbsoluteFill>

      {/* ── 7. CAPTION (bottom third) ────────────────────── */}
      {scene.caption && (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end', alignItems: 'center',
            paddingBottom: 50, opacity: captionOpacity,
          }}
        >
          {/* Accent bar */}
          <div style={{
            width: 60, height: 4, borderRadius: 2,
            background: style.accentColor,
            marginBottom: 20,
            boxShadow: `0 0 20px ${style.accentColor}`,
            transform: `scaleX(${accentBarScale})`,
          }} />

          <div style={{ textAlign: 'center', maxWidth: '75%' }}>
            {/* Caption — word stagger */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.25em' }}>
              {scene.caption.split(/\s+/).map((word, i) => {
                const ws = wordStagger(localFrame, Math.round(fps * 0.08), fps, i, { stagger: 1, easing: 'backOut' });
                return (
                  <span key={i} style={{
                    color: 'white',
                    fontSize: style.captionSize,
                    fontFamily: style.fontFamily,
                    fontWeight: 800,
                    letterSpacing: '0',
                    textShadow: '0 4px 30px rgba(0,0,0,0.9)',
                    opacity: ws.opacity,
                    transform: ws.transform,
                    display: 'inline-block',
                  }}>{word}</span>
                );
              })}
            </div>

            {/* Subtitle */}
            {scene.subtitle && (
              <div style={{
                ...fadeUp(localFrame, Math.round(fps * 0.4), fps, { delay: 6 }),
                color: '#E2E8F0',
                fontSize: style.subtitleSize,
                fontFamily: style.fontFamily,
                fontWeight: 400,
                marginTop: 12,
                textShadow: '0 2px 10px rgba(0,0,0,0.7)',
              }}>{scene.subtitle}</div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* ── Scene number indicator (top right) ───────────── */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end', padding: 40 }}>
        <div style={{
          ...fadeUp(localFrame, 0, fps, { delay: 4 }),
          color: 'rgba(255,255,255,0.2)',
          fontSize: 20, fontFamily: style.fontFamily, fontWeight: 600,
        }}>
          {sceneIndex + 1}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
