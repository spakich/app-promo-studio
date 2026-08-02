import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, staticFile } from 'remotion';
import { kenBurns, zoomPresets } from '../animations/zoom';
import { transitionIn, transitionOut, transitionDurations, type TransitionType } from '../animations/transitions';
import { fadeUp, wordStagger, blurIn } from '../animations/textEffects';
import { getEasing } from '../animations/easings';

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
 * Professional scene with 3D perspective, device mockup, glow and
 * cinematic camera moves. This is NOT a flat screenshot overlay.
 *
 * The screenshot sits in a tilted browser frame with perspective depth,
 * a glow halo behind it, and the camera glides through 3D space.
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
  const localFrame = frame - startFrame;
  const progress = localFrame / durationInFrames; // 0 → 1

  // ── 3D perspective camera — aggressive, dynamic ────────
  // The scene enters from depth, pushes FORWARD past the viewer
  const easing = getEasing('expoOut');
  const enterProgress = easing(interpolate(localFrame, [0, Math.round(fps * 0.6)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const exitProgress = isLast ? 0 : easing(interpolate(localFrame, [durationInFrames - Math.round(fps * 0.4), durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));

  // Stronger Z push: start far, push in CLOSE
  const z = interpolate(enterProgress, [0, 1], [400, -50]) + interpolate(exitProgress, [0, 1], [0, 100]);
  // More dramatic tilt that settles
  const rotX = interpolate(enterProgress, [0, 1], [25, 5]) + interpolate(exitProgress, [0, 1], [0, -5]);
  const rotY = interpolate(enterProgress, [0, 1], [-15, 0]) + interpolate(exitProgress, [0, 1], [0, 8]);
  const translateX = interpolate(enterProgress, [0, 1], [60, 0]);
  const translateY = interpolate(enterProgress, [0, 1], [30, 0]);

  // ── Ken Burns on the screenshot itself ─────────────────
  const presetName = scene.zoomPreset || 'center';
  const preset = zoomPresets[presetName] || zoomPresets.center;
  const config = scene.focal
    ? { ...preset.config, endX: scene.focal.x, endY: scene.focal.y }
    : preset.config;
  const kb = kenBurns(localFrame, fps, durationInFrames, config);

  // ── Opacity transitions ────────────────────────────────
  const tType = scene.transitionOut || 'crossDissolve';
  const tDuration = isLast ? 0 : transitionDurations.normal;
  const outState = transitionOut(localFrame, durationInFrames, {
    type: tType,
    durationFrames: tDuration,
    easing: 'easeInOut',
  });

  // ── Accent glow that breathes behind the device ────────
  const glowScale = interpolate(
    Math.sin(localFrame / (fps * 2)) * 0.5 + 0.5,
    [0, 1],
    [0.9, 1.15]
  );
  const glowOpacity = interpolate(enterProgress, [0, 1], [0, 0.5]) * (1 - exitProgress * 0.5);

  // ── Device frame dimensions ────────────────────────────
  const deviceWidth = 1440;
  const deviceHeight = 810;
  const radius = 14;
  const titleBarHeight = 36;

  return (
    <AbsoluteFill style={{ backgroundColor: style.bgColor }}>
      {/* ── Ambient glow background ─────────────────────── */}
      <AbsoluteFill style={{ opacity: glowOpacity * (outState.opacity ?? 1) }}>
        <div
          style={{
            position: 'absolute',
            width: '60%',
            height: '60%',
            left: '20%',
            top: '20%',
            background: `radial-gradient(ellipse at center, ${style.accentColor}55 0%, transparent 70%)`,
            transform: `scale(${glowScale})`,
            filter: 'blur(60px)',
          }}
        />
      </AbsoluteFill>

      {/* ── 3D Scene container ──────────────────────────── */}
      <AbsoluteFill
        style={{
          perspective: 1400,
          opacity: (enterProgress * (1 - exitProgress * 0.3)) * (outState.opacity ?? 1),
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '42%',
            width: deviceWidth,
            height: deviceHeight,
            marginLeft: -deviceWidth / 2,
            marginTop: -deviceHeight / 2,
            transformStyle: 'preserve-3d',
            transform: `translate3d(${translateX}px, ${translateY}px, ${z}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
            // Shadow under the device
            boxShadow: `0 60px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)`,
            borderRadius: radius,
            overflow: 'hidden',
          }}
        >
          {/* Browser title bar */}
          <div
            style={{
              height: titleBarHeight,
              background: 'rgba(20,20,25,0.95)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 16,
              gap: 8,
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            <div
              style={{
                marginLeft: 24,
                padding: '4px 60px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 6,
                fontSize: 11,
                color: 'rgba(255,255,255,0.3)',
                fontFamily: 'monospace',
              }}
            >
              ●●●
            </div>
          </div>

          {/* Screenshot with Ken Burns */}
          <div
            style={{
              width: deviceWidth,
              height: deviceHeight - titleBarHeight,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Img
              src={scene.src.startsWith('http') ? scene.src : staticFile(scene.src)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: kb.transform,
                transformOrigin: kb.origin,
              }}
            />
          </div>
        </div>
      </AbsoluteFill>

      {/* ── Caption — professional bottom-third ─────────── */}
      {scene.caption && (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: 60,
            opacity: interpolate(localFrame, [Math.round(fps * 0.5), Math.round(fps * 1.2)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) *
              interpolate(localFrame, [durationInFrames - Math.round(fps * 0.5), durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            ...outState,
          }}
        >
          {/* Accent line */}
          <div
            style={{
              width: 60,
              height: 4,
              borderRadius: 2,
              background: style.accentColor,
              marginBottom: 24,
              boxShadow: `0 0 20px ${style.accentColor}88`,
              transform: `scaleX(${interpolate(localFrame, [Math.round(fps * 0.5), Math.round(fps * 0.9)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
            }}
          />
          <div style={{ textAlign: 'center', maxWidth: '75%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.3em' }}>
              {scene.caption.split(/\s+/).map((word, i) => {
                const ws = wordStagger(localFrame, Math.round(fps * 0.15), fps, i, { stagger: 3, easing: 'backOut' });
                return (
                  <span
                    key={i}
                    style={{
                      color: 'white',
                      fontSize: style.captionSize,
                      fontFamily: style.fontFamily,
                      fontWeight: 800,
                      letterSpacing: '0',
                      textShadow: '0 4px 30px rgba(0,0,0,0.9)',
                      opacity: ws.opacity,
                      transform: ws.transform,
                      display: 'inline-block',
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
            {scene.subtitle && (
              <div
                style={{
                  ...fadeUp(localFrame, Math.round(fps * 0.4), fps, { delay: 8 }),
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: style.subtitleSize,
                  fontFamily: style.fontFamily,
                  fontWeight: 400,
                  marginTop: 14,
                  textShadow: '0 2px 10px rgba(0,0,0,0.6)',
                }}
              >
                {scene.subtitle}
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* ── Floating accent orb (depth layer) ───────────── */}
      <AbsoluteFill style={{ opacity: glowOpacity * (outState.opacity ?? 1), pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            right: '8%',
            top: '15%',
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${style.accentColor}33 0%, transparent 70%)`,
            filter: 'blur(30px)',
            transform: `translateY(${interpolate(progress, [0, 1], [20, -20])}px)`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
