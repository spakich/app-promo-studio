import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { AnimatedScene, type SceneData, type SceneStyle } from '../components/AnimatedScene';

/**
 * VerticalPromo — 9:16 (1080×1920)
 * Same engine as HorizontalPromo, just different dimensions.
 * Caption sizes are automatically larger for vertical viewing.
 */

export interface PromoProps {
  scenes: SceneData[];
  style: SceneStyle;
}

export const VerticalPromo: React.FC<PromoProps> = ({ scenes, style }) => {
  const { fps } = useVideoConfig();
  let currentFrame = 0;

  // Scale up fonts for vertical viewing (closer to screen)
  const verticalStyle: SceneStyle = {
    ...style,
    captionSize: Math.round(style.captionSize * 1.4),
    subtitleSize: Math.round(style.subtitleSize * 1.4),
  };

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
              style={verticalStyle}
              isLast={i === scenes.length - 1}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
