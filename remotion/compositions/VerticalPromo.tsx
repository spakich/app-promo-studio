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

export const VerticalPromo: React.FC<PromoProps> = ({ scenes, appName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {scenes.map((scene, i) => {
        const durationInFrames = Math.round(scene.durationSeconds * fps);
        const startFrame = currentFrame;
        currentFrame += durationInFrames;

        const localFrame = frame - startFrame;
        const isLastHalf = localFrame > durationInFrames / 2;

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames}>
            <AbsoluteFill
              style={{
                opacity: interpolate(
                  localFrame,
                  [0, fps * 0.5, durationInFrames - fps * 0.5, durationInFrames],
                  [0, 1, 1, 0],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                ),
              }}
            >
              <Img
                src={scene.src}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: scene.transition === 'zoom'
                    ? `scale(${interpolate(localFrame, [0, durationInFrames], [1, 1.1])})`
                    : 'scale(1)',
                }}
              />
              {scene.caption && (
                <AbsoluteFill
                  style={{
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    paddingBottom: 120,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%)',
                  }}
                >
                  <div
                    style={{
                      color: 'white',
                      fontSize: 56,
                      fontFamily: 'sans-serif',
                      fontWeight: 700,
                      textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                      textAlign: 'center',
                      maxWidth: '85%',
                    }}
                  >
                    {scene.caption}
                    {i === 0 && (
                      <div style={{ fontSize: 32, marginTop: 16, opacity: 0.8 }}>{appName}</div>
                    )}
                  </div>
                </AbsoluteFill>
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
