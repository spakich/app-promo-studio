import { Composition } from 'remotion';
import { HorizontalPromo } from './compositions/HorizontalPromo';
import { VerticalPromo } from './compositions/VerticalPromo';
import { getTemplate } from './templates';

/**
 * Remotion Root — registers all compositions for the Remotion Studio.
 *
 * The Studio (npm run remotion:dev) shows all compositions listed here.
 * Click a composition, hit play, and see the animation engine in action.
 *
 * Props are static here for preview. In production, the app passes
 * screenshots and template selection via inputProps.
 */

// Demo data — real screenshots from the NGE Stock promo
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

const cleanDark = getTemplate('clean-dark').style;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HorizontalPromo"
        component={HorizontalPromo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        calculateMetadata={({ props, defaultProps }) => {
          const scenes = (props as any).scenes || (defaultProps as any).scenes || [];
          const fpsVal = 30;
          const frames = scenes.reduce(
            (acc: number, s: any) => acc + Math.round((s.durationSeconds || 4) * fpsVal),
            0
          );
          return { durationInFrames: Math.max(frames, 30) };
        }}
        defaultProps={{
          scenes: demoScenes,
          style: { ...cleanDark, watermark: 'Promo Studio' },
        }}
      />
      <Composition
        id="VerticalPromo"
        component={VerticalPromo}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props, defaultProps }) => {
          const scenes = (props as any).scenes || (defaultProps as any).scenes || [];
          const fpsVal = 30;
          const frames = scenes.reduce(
            (acc: number, s: any) => acc + Math.round((s.durationSeconds || 4) * fpsVal),
            0
          );
          return { durationInFrames: Math.max(frames, 30) };
        }}
        defaultProps={{
          scenes: demoScenes,
          style: cleanDark,
        }}
      />
    </>
  );
};
