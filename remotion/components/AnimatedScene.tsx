import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { kenBurns, zoomPresets } from '../animations/zoom';
import { transitionIn, transitionOut, transitionDurations, type TransitionType } from '../animations/transitions';
import { fadeUp, wordStagger, blurIn } from '../animations/textEffects';

export interface SceneData {
  src: string;
  caption?: string;
  subtitle?: string;
  /** Key into zoomPresets: center, topRight, bottomLeft, panRight, panLeft, panDown, panUp, pullOut, static */
  zoomPreset?: string;
  /** Transition to the NEXT scene */
  transitionOut?: TransitionType;
  durationSeconds: number;
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
 * A single animated scene: screenshot with Ken Burns + caption with text effects.
 * This is the building block — compositions stitch these together.
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
  const { fps, durationInFrames: compDuration } = useVideoConfig();

  const durationInFrames = Math.round(scene.durationSeconds * fps);
  const localFrame = frame - startFrame;

  // Ken Burns
  const presetName = scene.zoomPreset || 'center';
  const preset = zoomPresets[presetName] || zoomPresets.center;
  const kb = kenBurns(localFrame, fps, durationInFrames, preset.config);

  // Transition (fade to next scene unless last)
  const tType = scene.transitionOut || 'crossDissolve';
  const tDuration = isLast ? 0 : transitionDurations.normal;
  const outState = transitionOut(localFrame, durationInFrames, {
    type: tType,
    durationFrames: tDuration,
    easing: 'easeInOut',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: style.bgColor }}>
      {/* Image with Ken Burns */}
      <AbsoluteFill style={{ overflow: 'hidden', ...outState }}>
        <Img
          src={scene.src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: kb.transform,
            transformOrigin: kb.origin,
          }}
        />
        {/* Bottom gradient for caption legibility */}
        {scene.caption && (
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 30%, transparent 50%)',
            }}
          />
        )}
      </AbsoluteFill>

      {/* Caption with word stagger */}
      {scene.caption && (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: 80,
            ...outState,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '80%' }}>
            {/* Caption — word by word stagger */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.3em' }}>
              {scene.caption.split(/\s+/).map((word, i) => {
                const ws = wordStagger(localFrame, Math.round(fps * 0.2), fps, i, { stagger: 3, easing: 'backOut' });
                return (
                  <span
                    key={i}
                    style={{
                      color: 'white',
                      fontSize: style.captionSize,
                      fontFamily: style.fontFamily,
                      fontWeight: 700,
                      textShadow: '0 2px 20px rgba(0,0,0,0.8)',
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

            {/* Subtitle — fade up with delay */}
            {scene.subtitle && (
              <div
                style={{
                  ...blurIn(localFrame, Math.round(fps * 0.5), fps, { delay: 6 }),
                  color: style.accentColor,
                  fontSize: style.subtitleSize,
                  fontFamily: style.fontFamily,
                  fontWeight: 500,
                  marginTop: 16,
                  textShadow: '0 2px 10px rgba(0,0,0,0.6)',
                }}
              >
                {scene.subtitle}
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* Watermark / app name */}
      {style.watermark && sceneIndex === 0 && (
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end', flexDirection: 'row', padding: 40 }}>
          <div
            style={{
              ...fadeUp(localFrame, 0, fps, { delay: 4 }),
              color: 'rgba(255,255,255,0.5)',
              fontSize: 24,
              fontFamily: style.fontFamily,
              fontWeight: 600,
            }}
          >
            {style.watermark}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
