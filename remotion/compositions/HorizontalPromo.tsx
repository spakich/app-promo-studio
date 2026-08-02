import { AbsoluteFill, Sequence } from 'remotion';
import { AnimatedScene, type SceneData, type SceneStyle } from '../components/AnimatedScene';
import { IntroScene, OutroScene } from '../components/IntroScene';

export type { SceneData, SceneStyle };

export interface PromoProps {
  scenes: SceneData[];
  style: SceneStyle;
  appName?: string;
  pitch?: string;
  ctaText?: string;
}

const INTRO_SECONDS = 3;
const OUTRO_SECONDS = 4;

/**
 * HorizontalPromo — 16:9 (1920×1080)
 * Full structure: Intro → Animated scenes → Outro CTA
 */
export const HorizontalPromo: React.FC<PromoProps> = ({
  scenes,
  style,
  appName,
  pitch,
  ctaText,
}) => {
  const fps = 30;
  const introFrames = Math.round(INTRO_SECONDS * fps);
  const outroFrames = Math.round(OUTRO_SECONDS * fps);
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: style.bgColor }}>
      {/* Intro */}
      <Sequence from={0} durationInFrames={introFrames}>
        <IntroScene
          appName={appName || 'Promo Studio'}
          pitch={pitch}
          style={{ bgColor: style.bgColor, accentColor: style.accentColor, fontFamily: style.fontFamily }}
        />
      </Sequence>

      {/* Scenes */}
      {scenes.map((scene, i) => {
        const durationInFrames = Math.round(scene.durationSeconds * fps);
        const startFrame = introFrames + currentFrame;
        currentFrame += durationInFrames;

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames}>
            <AnimatedScene
              scene={scene}
              sceneIndex={i}
              totalScenes={scenes.length}
              startFrame={0}
              style={style}
              isLast={i === scenes.length - 1}
            />
          </Sequence>
        );
      })}

      {/* Outro */}
      <Sequence from={introFrames + currentFrame} durationInFrames={outroFrames}>
        <OutroScene
          appName={appName || 'Promo Studio'}
          pitch={pitch}
          ctaText={ctaText}
          style={{ bgColor: style.bgColor, accentColor: style.accentColor, fontFamily: style.fontFamily }}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
