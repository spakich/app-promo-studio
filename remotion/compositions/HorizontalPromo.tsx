import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, Sequence } from 'remotion';

type Scene = {
  src: string;
  caption?: string;
  transition: 'fade' | 'slide' | 'zoom' | 'none';
  durationSeconds: number;
};

type PromoProps = {
  scenes: Scene[];
  appName: string;
  appIconUrl?: string;
};

const transitionIn = (frame: number, fps: number, type: string) => {
  switch (type) {
    case 'fade':
      return { opacity: interpolate(frame, [0, fps], [0, 1], { extrapolateRight: 'clamp' }) };
    case 'slide':
      return {
        opacity: interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' }),
        transform: `translateX(${interpolate(frame, [0, fps], [-100, 0], { extrapolateRight: 'clamp' })}px)`,
      };
    case 'zoom':
      return {
        opacity: interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' }),
        transform: `scale(${interpolate(frame, [0, fps * 2], [1.15, 1], { extrapolateRight: 'clamp' })})`,
      };
    default:
      return {};
  }
};

const transitionOut = (frame: number, durationInFrames: number, fps: number) => {
  return {
    opacity: interpolate(frame, [durationInFrames - fps, durationInFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  };
};

export const HorizontalPromo: React.FC<PromoProps> = ({ scenes, appName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {scenes.map((scene, i) => {
        const durationInFrames = Math.round(scene.durationSeconds * fps);
        const startFrame = currentFrame;
        currentFrame += durationInFrames;

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames}>
            <AbsoluteFill style={{ ...transitionIn(frame - startFrame, fps, scene.transition) }}>
              <Img
                src={scene.src}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </AbsoluteFill>
            {scene.caption && (
              <AbsoluteFill
                style={{
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  paddingBottom: 80,
                }}
              >
                <div
                  style={{
                    color: 'white',
                    fontSize: 48,
                    fontFamily: 'sans-serif',
                    fontWeight: 700,
                    textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                    textAlign: 'center',
                  }}
                >
                  {scene.caption}
                </div>
              </AbsoluteFill>
            )}
          </Sequence>
        );
      })}

      {/* App name watermark */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-start',
          alignItems: 'flex-end',
          flexDirection: 'row',
          padding: 40,
        }}
      >
        <div
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 28,
            fontFamily: 'sans-serif',
            fontWeight: 600,
          }}
        >
          {appName}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
