import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, staticFile } from 'remotion';
import { getEasing } from '../animations/easings';
import { transitionOut, transitionDurations, type TransitionType } from '../animations/transitions';
import { wordStagger, fadeUp } from '../animations/textEffects';

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
 * SCREENCAST SCENE — professional screen recording style
 * ═══════════════════════════════════════════════════════════════
 * 
 * Like ScreenStudio / Arcade / Loom:
 * - Screenshot fills 90%+ of the frame
 * - Browser chrome bar (clean, minimal)
 * - Smooth pan/zoom INTO the content
 * - Cursor that moves to features and clicks
 * - Caption as gradient bottom bar
 * - Subtle click ripple on focal points
 * - Background accent glow that's barely visible
 * 
 * NO heavy particles, NO extreme 3D tilt, NO bloom
 * The CONTENT is the star, not the effects.
 * ═══════════════════════════════════════════════════════════════
 */
export const ScreencastScene: React.FC<{
  scene: SceneData;
  sceneIndex: number;
  totalScenes: number;
  startFrame: number;
  style: SceneStyle;
  isLast: boolean;
}> = ({ scene, sceneIndex, totalScenes, style, isLast }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const durationInFrames = Math.round(scene.durationSeconds * fps);
  const localFrame = frame;
  const easing = getEasing('expoOut');

  // ── Entrance: subtle scale from 1.05 to 1.0 ──
  const enterProgress = easing(
    interpolate(localFrame, [0, Math.round(fps * 0.6)], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })
  );

  // ── Exit: subtle scale up + fade ──
  const exitProgress = isLast ? 0 : easing(
    interpolate(localFrame, [durationInFrames - Math.round(fps * 0.35), durationInFrames], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })
  );

  // ── Camera moves: pan + zoom within the screenshot ──
  const focal = scene.focal || { x: 0.5, y: 0.5 };
  
  // Determine camera path based on preset or narrative role
  const role = scene.analysis?.narrative_role || '';
  const preset = scene.zoomPreset || 'center';

  // Zoom: start slightly zoomed in, pull back, then push into focal
  const zoomBase = interpolate(localFrame, [0, durationInFrames], [1.15, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Pan offset based on focal point (subtle, 20px max)
  const panEnter = interpolate(enterProgress, [0, 1], [30, 0]);
  const panX = (focal.x - 0.5) * -40 + panEnter;
  const panY = (focal.y - 0.5) * -25;

  // Exit pan/zoom
  const exitZoom = interpolate(exitProgress, [0, 1], [1.0, 1.1]);
  const exitPanX = interpolate(exitProgress, [0, 1], [0, (focal.x - 0.5) * -60]);
  const finalZoom = zoomBase * exitZoom;
  const finalPanX = panX + exitPanX;

  // Entrance scale
  const entranceScale = interpolate(enterProgress, [0, 1], [1.05, 1.0]);
  const totalScale = finalZoom * entranceScale;

  // ── Transition out ──
  const tType = scene.transitionOut || 'slidePush';
  const tDuration = isLast ? 0 : transitionDurations.normal;
  const outState = transitionOut(localFrame, durationInFrames, {
    type: tType, durationFrames: tDuration, easing: 'easeInOut',
  });

  // ── Caption timing ──
  const captionEnter = interpolate(localFrame, [Math.round(fps * 0.2), Math.round(fps * 0.6)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const captionExit = interpolate(localFrame, [durationInFrames - Math.round(fps * 0.4), durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const captionOpacity = captionEnter * captionExit;

  // ── Cursor animation ──
  // Cursor starts off-center, moves to focal point at 40% of scene
  const cursorStartX = width * 0.7;
  const cursorStartY = height * 0.3;
  const cursorEndX = width * focal.x;
  const cursorEndY = height * focal.y;

  const cursorMoveProgress = interpolate(
    localFrame,
    [Math.round(fps * 0.3), Math.round(fps * 1.2)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const cursorEased = getEasing('expoOut')(cursorMoveProgress);
  const cursorX = interpolate(cursorEased, [0, 1], [cursorStartX, cursorEndX]);
  const cursorY = interpolate(cursorEased, [0, 1], [cursorStartY, cursorEndY]);

  // Click ripple at cursor position (fires at 60% of scene)
  const clickFrame = Math.round(fps * 1.5);
  const clickProgress = interpolate(
    localFrame,
    [clickFrame, clickFrame + Math.round(fps * 0.4)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const rippleScale = interpolate(clickProgress, [0, 1], [0, 3]);
  const rippleOpacity = interpolate(clickProgress, [0, 0.3, 1], [0, 0.6, 0]);

  // ── Device frame dimensions ──
  // Fill 95% of screen width, maintain 16:9 aspect
  const deviceW = Math.round(width * 0.92);
  const deviceH = Math.round(deviceW * 9 / 16);
  const deviceY = (height - deviceH) / 2 - 20;
  const radius = 12;
  const titleBarH = 40;

  const captionColor = style.captionColor || '#FFFFFF';
  const accent = style.accentColor || '#e63312';

  // Role icons
  const roleLabels: Record<string, string> = {
    hook: '✦', feature_1: '◆', feature_2: '◆', proof: '✓', feature_3: '◆', feature_4: '◆',
  };

  return (
    <AbsoluteFill style={{
      background: style.bgGradient || `linear-gradient(160deg, ${style.bgColor} 0%, #0a0a0b 100%)`,
      opacity: (outState.opacity ?? 1),
    }}>
      {/* ── Subtle background accent glow ── */}
      <div style={{
        position: 'absolute',
        top: '20%', left: '60%',
        width: '50%', height: '50%',
        background: `radial-gradient(ellipse, ${accent}08 0%, transparent 70%)`,
        filter: 'blur(60px)',
        opacity: 0.6,
      }} />

      {/* ── DEVICE (browser window) ── */}
      <div style={{
        position: 'absolute',
        left: '50%', top: deviceY,
        width: deviceW, height: deviceH,
        marginLeft: -deviceW / 2,
        transform: outState.transform,
        borderRadius: radius,
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
      }}>
        {/* Browser title bar */}
        <div style={{
          height: titleBarH,
          background: '#1e293b',
          display: 'flex', alignItems: 'center',
          paddingLeft: 16, gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
          {/* URL bar */}
          <div style={{
            marginLeft: 20, flex: 1,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 12, color: 'rgba(255,255,255,0.3)',
            fontFamily: 'monospace',
            maxWidth: 400,
          }}>
            {scene.src.includes('chantier') ? '🔒 zefil-terrain.vercel.app/chantier/...' :
             scene.src.includes('preparer') ? '🔒 zefil-terrain.vercel.app/preparer' :
             '🔒 zefil-terrain.vercel.app'}
          </div>
        </div>

        {/* Screenshot with camera pan/zoom */}
        <div style={{
          width: '100%',
          height: deviceH - titleBarH,
          overflow: 'hidden',
          position: 'relative',
          background: '#f1f5f9',
        }}>
          <Img
            src={scene.src.startsWith('http') ? scene.src : staticFile(scene.src)}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              transform: `scale(${totalScale}) translate(${finalPanX}px, ${panY}px)`,
              transformOrigin: `${focal.x * 100}% ${focal.y * 100}%`,
            }}
          />

          {/* Click ripple at cursor position (inside device) */}
          {rippleOpacity > 0 && (
            <div style={{
              position: 'absolute',
              left: cursorEndX - deviceW / 2 - 30, // Approximate cursor pos in device coords
              top: cursorEndY - deviceY - titleBarH - 30,
              width: 60, height: 60,
              borderRadius: '50%',
              border: `3px solid ${accent}`,
              transform: `scale(${rippleScale})`,
              opacity: rippleOpacity,
              pointerEvents: 'none',
            }} />
          )}

          {/* Virtual cursor */}
          <div style={{
            position: 'absolute',
            left: cursorX - deviceW / 2,
            top: cursorY - deviceY - titleBarH,
            width: 20, height: 20,
            pointerEvents: 'none',
            zIndex: 10,
            transform: 'translate(-2px, -2px)',
            transition: 'left 0.3s, top 0.3s',
          }}>
            {/* Arrow cursor */}
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path
                d="M 2 2 L 2 14 L 5 11 L 8 17 L 10 16 L 7 10 L 12 10 Z"
                fill="white"
                stroke={accent}
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── CAPTION (bottom gradient bar) ── */}
      {scene.caption && (
        <AbsoluteFill style={{
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          paddingBottom: 40,
          paddingLeft: 80,
          paddingRight: 80,
          opacity: captionOpacity,
        }}>
          {/* Bottom gradient overlay for text legibility */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: 250,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85) 60%)',
            pointerEvents: 'none',
          }} />

          {/* Accent bar */}
          <div style={{
            width: 48, height: 4, borderRadius: 2,
            background: accent,
            marginBottom: 16,
            boxShadow: `0 0 16px ${accent}80`,
            transform: `scaleX(${captionEnter})`,
            transformOrigin: 'left',
          }} />

          <div style={{ position: 'relative' }}>
            {/* Caption */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em' }}>
              {scene.caption.split(/\s+/).map((word, i) => {
                const ws = wordStagger(localFrame, Math.round(fps * 0.06), fps, i, { stagger: 1, easing: 'backOut' });
                return (
                  <span key={i} style={{
                    color: captionColor,
                    fontSize: style.captionSize,
                    fontFamily: style.fontFamily,
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                    textShadow: '0 2px 20px rgba(0,0,0,0.9)',
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
                ...fadeUp(localFrame, Math.round(fps * 0.4), fps, { delay: 4 }),
                color: 'rgba(255,255,255,0.7)',
                fontSize: style.subtitleSize,
                fontFamily: style.fontFamily,
                fontWeight: 400,
                marginTop: 8,
                textShadow: '0 1px 8px rgba(0,0,0,0.8)',
              }}>{scene.subtitle}</div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* ── Scene indicator (top right, minimal) ── */}
      <div style={{
        position: 'absolute',
        top: 30, right: 40,
        color: 'rgba(255,255,255,0.3)',
        fontSize: 16, fontFamily: style.fontFamily, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6,
        opacity: captionEnter,
      }}>
        <span style={{ color: accent }}>{roleLabels[role] || '◆'}</span>
        {sceneIndex + 1} / {totalScenes || 6}
      </div>
     </AbsoluteFill>
  );
};
