import { Composition } from 'remotion';
import { HorizontalPromo } from './compositions/HorizontalPromo';
import { VerticalPromo } from './compositions/VerticalPromo';
import { getTemplate } from './templates';

// ─── NGE STOCK — Vidéo avec VRAIES captures d'écran ───────────────────────────
const ngeScenes = [
  {
    src: 'output/nge/real_dashboard.png',
    caption: 'Pilotez votre stock en temps réel',
    subtitle: '2,1 M€ de stock · 707 articles · 67 alertes',
    zoomPreset: 'center',
    transitionOut: 'blurDissolve' as const,
    durationSeconds: 4.5,
  },
  {
    src: 'output/nge/real_tourets.png',
    caption: '503 tourets suivis au mètre près',
    subtitle: 'QR codes, pose, affectation sous-traitants',
    zoomPreset: 'panRight',
    transitionOut: 'zoomThrough' as const,
    durationSeconds: 4,
  },
  {
    src: 'output/nge/real_reception_ia.png',
    caption: 'Réception par Intelligence Artificielle',
    subtitle: "Photographiez — Claude Sonnet extrait tout",
    zoomPreset: 'topRight',
    transitionOut: 'blurDissolve' as const,
    durationSeconds: 4,
  },
  {
    src: 'output/nge/nge_kanban.png',
    caption: 'Préparez vos commandes en Kanban',
    subtitle: 'Glissez-déposez, du devis à la livraison',
    zoomPreset: 'panLeft',
    transitionOut: 'zoomThrough' as const,
    durationSeconds: 4,
  },
  {
    src: 'output/nge/nge_chantiers.png',
    caption: 'Coûts chantiers en temps réel',
    subtitle: 'Marges, budgets, sous-chantiers hiérarchisés',
    zoomPreset: 'center',
    transitionOut: 'fadeToBlack' as const,
    durationSeconds: 4,
  },
];

const ngeStyle = {
  bgColor: '#002060',
  accentColor: '#F6BE00',
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  captionSize: 64,
  subtitleSize: 32,
};

// ─── App Promo Studio démo ───────────────────────────────────────────────────
const appScenes = [
  {
    src: 'output/sc_dashboard.png',
    caption: 'Votre studio de création vidéo',
    subtitle: 'De screenshots à vidéo pro en 2 minutes',
    zoomPreset: 'center',
    transitionOut: 'blurDissolve' as const,
    durationSeconds: 4,
  },
  {
    src: 'output/sc_editor.png',
    caption: 'Éditeur 3 panneaux',
    subtitle: 'Format, screenshots, templates',
    zoomPreset: 'topRight',
    transitionOut: 'zoomThrough' as const,
    durationSeconds: 4,
  },
];

const cleanDark = getTemplate('clean-dark').style;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NGEStockPromo"
        component={HorizontalPromo}
        durationInFrames={390}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: ngeScenes,
          style: { ...ngeStyle, watermark: 'NGE Energies Solutions' },
        }}
      />
      <Composition
        id="AppPromoStudio"
        component={HorizontalPromo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: appScenes,
          style: { ...cleanDark, watermark: 'App Promo Studio' },
        }}
      />
      <Composition
        id="VerticalPromo"
        component={VerticalPromo}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: appScenes,
          style: cleanDark,
        }}
      />
    </>
  );
};
