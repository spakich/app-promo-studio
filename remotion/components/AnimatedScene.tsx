import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile } from 'remotion';
import { kenBurns, zoomPresets } from '../animations/zoom';
import { transitionOut, transitionDurations, type TransitionType } from '../animations/transitions';
import { fadeUp, wordStagger } from '../animations/textEffects';
import { getEasing } from '../animations/easings';
import { MeshGradient, ParticleField, LightSweep, SimulatedCursor, DeviceGlow } from './ProEffects';
import { ParallaxDepth, BloomGlow, LightRays, FloatingDust, BreathingVignette, GlassPanel } from './CinematicFX';

export interface SceneData {
  src: string;
  caption?: string;
  subtitle?: string;
  zoomPreset?: string;
  transitionOut?: TransitionType;
  durationSeconds: number;
  focal?: { x: number; y: number };
  camera3D?: { rotateX: number; rotateY: number; depth: number };
  kenBurnsIntensity?: 'low' | 'high';
  entrance?: string;
  parallax?: boolean;
  analysis?: { interest_score?: number; camera_move?: string; narrative_role?: string };
}

export interface SceneStyle {
  bgColor: string;
  accentColor: string;
  fontFamily: string;
  captionSize: number;
  subtitleSize: number;
  watermark?: string;
  captionColor?: string;
  captionShadow?: string;
  overlayOpacity?: number;
  bgGradient?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * CINEMATIC ANIMATED SCENE — Apple/Linear/Raycast level
 * ═══════════════════════════════════════════════════════════════
 *
 * 10 layers (back to front):
 *   1. Parallax depth (drifting gradient blobs + dot pattern)
 *   2. Mesh gradient (animated)
 *   3. Bloom glow (pulsing colored aura)
 *   4. Light rays (volumetric)
 *   5. Particle field (floating dots)
 *   6. Device glow (pulsing aura behind mockup)
 *   7. 3D Device mockup with screenshot (Ken Burns + camera moves)
 *   8. Floating dust (cinematic atmosphere)
 *   9. Caption (glassmorphism bottom third)
 *  10. Vignette (breathing)
 *
 * Auto-fix properties: camera3D, kenBurnsIntensity, entrance, parallax
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
  const localFrame = frame;

  // ── Camera3D (from auto-fix or default) ──
  const cam = scene.camera3D || { rotateX: -8, rotateY: -6, depth: 1400 };

  // ── Entrance animation variants ──
  const entranceType = scene.entrance || 'springZoom';
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

  // Z-depth varies by entrance type
  let zStart = 300, zEnd = -30;
  if (entranceType === 'flyIn') { zStart = 600; zEnd = -20; }
  if (entranceType === 'scaleUp') { zStart = 100; zEnd = -40; }
  if (entranceType === 'spinIn') { zStart = 400; zEnd = -30; }

  const z = interpolate(enterProgress, [0, 1], [zStart, zEnd]) + interpolate(exitProgress, [0, 1], [0, 80]);
  
  // Rotation varies per scene for variety
  const rotXBase = interpolate(enterProgress, [0, 1], [Math.abs(cam.rotateX) + 12, cam.rotateX]) + interpolate(exitProgress, [0, 1], [0, -3]);
  const rotYBase = interpolate(enterProgress, [0, 1], [cam.rotateY - 8, cam.rotateY]) + interpolate(exitProgress, [0, 1], [0, 6]);
  
  // Spin entrance adds Y rotation
  const spinBonus = entranceType === 'spinIn' ? interpolate(enterProgress, [0, 1], [180, 0]) : 0;

  const translateX = interpolate(enterProgress, [0, 1], [40, 0]);
  const translateY = interpolate(enterProgress, [0, 1], [20, 0]);

  // Parallax offset (if enabled by auto-fix)
  const parallaxX = scene.parallax ? Math.sin(localFrame / fps * 0.5) * 8 : 0;
  const parallaxY = scene.parallax ? Math.cos(localFrame / fps * 0.4) * 4 : 0;

  // Scene opacity
  const sceneOpacity = interpolate(localFrame, [0, Math.round(fps * 0.4)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Ken Burns (intensity from auto-fix) ──
  const presetName = scene.zoomPreset || 'center';
  const preset = zoomPresets[presetName] || zoomPresets.center;
  const config = scene.focal
    ? { ...preset.config, endX: scene.focal.x, endY: scene.focal.y }
    : preset.config;
  
  // Boost Ken Burns if high intensity
  const kbConfig = scene.kenBurnsIntensity === 'high'
    ? { ...config, endScale: (config.endScale || 1.15) * 1.15 }
    : config;
  const kb = kenBurns(localFrame, fps, durationInFrames, kbConfig);

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

  // ── Accent bar ──
  const accentBarScale = interpolate(localFrame, [Math.round(fps * 0.4), Math.round(fps * 0.8)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Colors (from auto-fix) ──
  const captionColor = style.captionColor || '#FFFFFF';
  const captionShadow = style.captionShadow || '0 4px 30px rgba(0,0,0,0.9)';

  // Narrative role badge
  const role = scene.analysis?.narrative_role || '';
  const roleLabels: Record<string, string> = {
    hook: '✦', feature_1: '◆', feature_2: '◆', proof: '✓', feature_3: '◆',
  };

  return (
    <AbsoluteFill style={{
      opacity: sceneOpacity * (outState.opacity ?? 1),
      background: style.bgGradient || style.bgColor,
    }}>
      {/* ── 1. PARALLAX DEPTH ──────────────────────────── */}
      <ParallaxDepth accentColor={style.accentColor} />

      {/* ── 2. MESH GRADIENT ───────────────────────────── */}
      <MeshGradient accentColor={style.accentColor} bgColor="transparent" />

      {/* ── 3. BLOOM GLOW ──────────────────────────────── */}
      <BloomGlow accentColor={style.accentColor} intensity={1} />

      {/* ── 4. LIGHT RAYS ──────────────────────────────── */}
      <LightRays accentColor={style.accentColor} />

      {/* ── 5. PARTICLE FIELD ──────────────────────────── */}
      <ParticleField accentColor={style.accentColor} />

      {/* ── 6. DEVICE GLOW ─────────────────────────────── */}
      <DeviceGlow accentColor={style.accentColor} intensity={0.8} />

      {/* ── 7. 3D DEVICE MOCKUP ────────────────────────── */}
      <AbsoluteFill style={{ perspective: cam.depth }}>
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
            transform: `translate3d(${translateX + parallaxX}px, ${translateY + parallaxY}px, ${z}px) rotateX(${rotXBase}deg) rotateY(${rotYBase + spinBonus}deg)`,
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

            {/* Light sweep inside the device */}
            <LightSweep accentColor={style.accentColor} cycleSeconds={4} />

            {/* Simulated cursor */}
            <SimulatedCursor
              focal={scene.focal}
              accentColor={style.accentColor}
              sceneStartFrame={0}
            />
          </div>
        </div>
      </AbsoluteFill>

      {/* ── 8. FLOATING DUST ───────────────────────────── */}
      <FloatingDust count={12} />

      {/* ── 9. CAPTION (glassmorphism bottom third) ───── */}
      {scene.caption && (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end', alignItems: 'center',
            paddingBottom: 50, opacity: captionOpacity,
          }}
        >
          <GlassPanel
            style={{
              padding: '24px 48px',
              maxWidth: '80%',
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

            <div style={{ textAlign: 'center' }}>
              {/* Caption — word stagger */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.25em' }}>
                {scene.caption.split(/\s+/).map((word, i) => {
                  const ws = wordStagger(localFrame, Math.round(fps * 0.08), fps, i, { stagger: 1, easing: 'backOut' });
                  return (
                    <span key={i} style={{
                      color: captionColor,
                      fontSize: style.captionSize,
                      fontFamily: style.fontFamily,
                      fontWeight: 800,
                      letterSpacing: '0',
                      textShadow: captionShadow,
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
          </GlassPanel>
        </AbsoluteFill>
      )}

      {/* ── 10. VIGNETTE ───────────────────────────────── */}
      <BreathingVignette />

      {/* ── Scene indicator (top right, glassmorphism) ─── */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end', padding: 40 }}>
        <GlassPanel style={{ padding: '8px 16px' }}>
          <div style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 18, fontFamily: style.fontFamily, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: style.accentColor }}>{roleLabels[role] || '◆'}</span>
            {sceneIndex + 1} / {5}
          </div>
        </GlassPanel>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
