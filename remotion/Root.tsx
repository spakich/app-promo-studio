import { Composition } from 'remotion';
import { HorizontalPromo } from './compositions/HorizontalPromo';
import { VerticalPromo } from './compositions/VerticalPromo';
import { getTemplate } from './templates';

/**
 * Remotion Root — registers all compositions.
 *
 * Props are passed via --props=file.json when rendering.
 * calculateMetadata computes the total duration dynamically:
 * intro (3s) + sum(scenes) + outro (4s)
 */

const cleanDark = getTemplate('clean-dark').style;

const demoScenes = [
  {
    src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&h=1080&fit=crop',
    caption: 'Votre stock ment.',
    subtitle: 'Mais pas pour longtemps.',
    zoomPreset: 'center',
    transitionOut: 'blurDissolve' as const,
    durationSeconds: 4,
  },
  {
    src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&h=1080&fit=crop',
    caption: 'Chaque carte réserve votre matière.',
    subtitle: 'Le stock que vous voyez est réel.',
    zoomPreset: 'topRight',
    transitionOut: 'zoomThrough' as const,
    durationSeconds: 4,
  },
  {
    src: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&h=1080&fit=crop',
    caption: 'Importez votre Excel.',
    subtitle: "C'est tout.",
    zoomPreset: 'panRight',
    transitionOut: 'fadeToBlack' as const,
    durationSeconds: 4,
  },
];

const FPS = 30;
const INTRO_SEC = 3;
const OUTRO_SEC = 4;

function calcDuration(props: any, defaultProps: any): number {
  const scenes = (props?.scenes) || (defaultProps?.scenes) || [];
  const scenesFrames = scenes.reduce(
    (acc: number, s: any) => acc + Math.round((s.durationSeconds || 4) * FPS),
    0
  );
  return Math.max(scenesFrames + (INTRO_SEC + OUTRO_SEC) * FPS, 60);
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HorizontalPromo"
        component={HorizontalPromo}
        durationInFrames={150}
        fps={FPS}
        width={1920}
        height={1080}
        calculateMetadata={({ props }) => ({
          durationInFrames: calcDuration(props, {}),
        })}
        defaultProps={{
          scenes: demoScenes,
          style: { ...cleanDark, watermark: 'Promo Studio' },
          appName: 'Promo Studio',
          pitch: 'Transformez vos apps en vidéos',
        }}
      />
      <Composition
        id="VerticalPromo"
        component={VerticalPromo}
        durationInFrames={150}
        fps={FPS}
        width={1080}
        height={1920}
        calculateMetadata={({ props }) => ({
          durationInFrames: calcDuration(props, {}),
        })}
        defaultProps={{
          scenes: demoScenes,
          style: cleanDark,
          appName: 'Promo Studio',
          pitch: 'Transformez vos apps en vidéos',
        }}
      />
    </>
  );
};
