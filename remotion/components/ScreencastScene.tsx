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
  url?: string;
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

// ═══════════════════════════════════════════════════════════════
// SCREENCAST SCENE — professional screen recording style
// Like ScreenStudio: content fills screen, minimal chrome,
// smooth camera, real URL, readable captions.
// ═══════════════════════════════════════════════════════════════

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
  const accent = style.accentColor || '#338AFF';
  const captionColor = style.captionColor || '#FFFFFF';

  // ── Entrance ──
  const enterProgress = interpolate(localFrame, [0, Math.round(fps * 0.6)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: getEasing('expoOut'),
  });

  // ── Exit ──
  const exitProgress = isLast ? 0 : interpolate(
    localFrame, [durationInFrames - Math.round(fps * 0.35), durationInFrames], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      easing: getEasing('easeOut'),
    }
  );

  // ── Camera Ken Burns ──
  const focal = scene.focal || { x: 0.5, y: 0.5 };
  const role = scene.analysis?.narrative_role || '';
  const startScale = role === 'hook' ? 1.0 : 1.08;
  const endScale = role === 'hook' ? 1.25 : 1.20;
  const zoomBase = interpolate(localFrame, [0, durationInFrames], [startScale, endScale], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const panEnter = interpolate(enterProgress, [0, 1], [20, 0]);
  const panX = (focal.x - 0.5) * -30 + panEnter;
  const exitPanX = interpolate(exitProgress, [0, 1], [0, (focal.x - 0.5) * -40]);
  const finalPanX = panX + exitPanX;
  const panY = (focal.y - 0.5) * -20;
  const exitZoom = interpolate(exitProgress, [0, 1], [1.0, 1.08]);
  const entranceScale = interpolate(enterProgress, [0, 1], [1.03, 1.0]);
  const totalScale = zoomBase * exitZoom * entranceScale;

  // ── Transition out ──
  const tType = scene.transitionOut || 'slidePush';
  const tDuration = isLast ? 0 : transitionDurations.normal;
  const outState = transitionOut(localFrame, durationInFrames, {
    type: tType, durationFrames: tDuration, easing: 'easeInOut',
  });

  // ── Caption timing ──
  const captionEnter = interpolate(localFrame, [Math.round(fps * 0.3), Math.round(fps * 0.7)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const captionExit = interpolate(localFrame, [durationInFrames - Math.round(fps * 0.4), durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const captionOpacity = captionEnter * captionExit;

  // ── Cursor ──
  const cursorStartX = width * 0.65;
  const cursorStartY = height * 0.35;
  const cursorEndX = width * focal.x;
  const cursorEndY = height * focal.y;
  const cursorMoveProgress = interpolate(
    localFrame, [Math.round(fps * 0.3), Math.round(fps * 1.2)], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const cursorEased = getEasing('expoOut')(cursorMoveProgress);
  const cursorX = interpolate(cursorEased, [0, 1], [cursorStartX, cursorEndX]);
  const cursorY = interpolate(cursorEased, [0, 1], [cursorStartY, cursorEndY]);

  // ── Click ripple ──
  const clickFrame = Math.round(fps * 1.5);
  const clickProgress = interpolate(
    localFrame, [clickFrame, clickFrame + Math.round(fps * 0.4)], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const rippleScale = interpolate(clickProgress, [0, 1], [0, 3]);
  const rippleOpacity = interpolate(clickProgress, [0, 0.3, 1], [0, 0.5, 0]);

  // ── Device frame ──
  const deviceW = Math.round(width * 0.92);
  const deviceH = Math.round(deviceW * 9 / 16);
  const deviceY = (height - deviceH) / 2 - 20;
  const radius = 12;
  const titleBarH = 40;

  // ── URL: use scene.url if provided, else extract from src filename ──
  const displayUrl = scene.url || (() => {
    const filename = scene.src.split('/').pop() || '';
    // Clean URL: no extension, replace underscores with slashes
    if (filename.includes('landing') || filename.includes('home')) return 'ragflow.io';
    if (filename.includes('chunk')) return 'ragflow.io/datasets/chunk';
    if (filename.includes('agent')) return 'ragflow.io/agent';
    if (filename.includes('arch')) return 'ragflow.io/docs/architecture';
    if (filename.includes('cloud') || filename.includes('login')) return 'cloud.ragflow.io';
    if (filename.includes('feature')) return 'ragflow.io/features';
    return 'ragflow.io';
  })();

  return (
    <AbsoluteFill style={{
      background: style.bgGradient || `linear-gradient(160deg, ${style.bgColor} 0%, #050508 100%)`,
      opacity: (outState.opacity ?? 1),
    }}>
      {/* ── Subtle background accent glow ── */}
      <div style={{
        position: 'absolute',
        top: '15%', left: '50%',
        width: '60%', height: '60%',
        background: `radial-gradient(ellipse, ${accent}06 0%, transparent 70%)`,
        filter: 'blur(80px)',
        opacity: 0.5,
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
        boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
      }}>
        {/* Browser title bar */}
        <div style={{
          height: titleBarH,
          background: '#1a1a2e',
          display: 'flex', alignItems: 'center',
          paddingLeft: 16, gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
          {/* URL bar — dynamic */}
          <div style={{
            marginLeft: 20, flex: 1,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '5px 14px',
            fontSize: 12, color: 'rgba(255,255,255,0.5)',
            fontFamily: 'monospace',
            maxWidth: 450,
          }}>
            🔒 {displayUrl}
          </div>
        </div>

        {/* Screenshot with camera pan/zoom */}
        <div style={{
          width: '100%',
          height: deviceH - titleBarH,
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
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

          {/* Click ripple */}
          {rippleOpacity > 0 && (
            <div style={{
              position: 'absolute',
              left: cursorEndX - deviceW / 2 - 30,
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
          }}>
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
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: 250,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.88) 60%)',
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em' }}>
              {scene.caption.split(/\s+/).map((word, i) => {
                const ws = wordStagger(localFrame, 8, fps, i, { stagger: 4, easing: 'backOut' });
                return (
                  <span key={i} style={{
                    color: captionColor,
                    fontSize: style.captionSize,
                    fontFamily: style.fontFamily,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.8)',
                    opacity: ws.opacity,
                    transform: ws.transform,
                    display: 'inline-block',
                  }}>{word}</span>
                );
              })}
            </div>

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

      {/* ── Scene indicator ── */}
      <div style={{
        position: 'absolute',
        top: 30, right: 40,
        color: 'rgba(255,255,255,0.25)',
        fontSize: 14, fontFamily: style.fontFamily, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6,
        opacity: captionEnter,
      }}>
        {sceneIndex + 1} / {totalScenes || 6}
      </div>
    </AbsoluteFill>
  );
};
