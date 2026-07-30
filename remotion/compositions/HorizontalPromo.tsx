import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { AnimatedScene, type SceneData, type SceneStyle } from '../components/AnimatedScene';

/**
 * HorizontalPromo — 16:9 (1920×1080)
 * Stitches animated scenes together with Remotion <Sequence>.
 *
 * This composition is data-driven: pass a `scenes` array and `style`
 * and the entire video is generated programmatically.
 */

export type { SceneData, SceneStyle };

export interface PromoProps {
  scenes: SceneData[];
  style: SceneStyle;
}

export const HorizontalPromo: React.FC<PromoProps> = ({ scenes, style }) => {
  const { fps } = useVideoConfig();
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: style.bgColor }}>
      {scenes.map((scene, i) => {
        const durationInFrames = Math.round(scene.durationSeconds * fps);
        const startFrame = currentFrame;
        currentFrame += durationInFrames;

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames}>
            <AnimatedScene
              scene={scene}
              sceneIndex={i}
              totalScenes={scenes.length}
              startFrame={startFrame}
              style={style}
              isLast={i === scenes.length - 1}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
