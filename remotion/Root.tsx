// Remotion Root — Entry point for all compositions
import { Composition } from '@remotion/cli/config';
import { HorizontalPromo } from './compositions/HorizontalPromo';
import { VerticalPromo } from './compositions/VerticalPromo';

export const remotionBundler = () => {
  return {
    serveUrl: './remotion',
    publicDir: '../public',
  };
};

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="HorizontalPromo"
        component={HorizontalPromo}
        durationInFrames={900} // 30s @ 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="VerticalPromo"
        component={VerticalPromo}
        durationInFrames={900} // 30s @ 30fps
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
