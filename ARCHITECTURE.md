# Architecture — App Promo Studio

> **Source** : Kimi K3 (`k3-256k`) — 2 sessions de chunking, 30 juillet 2026

---

Rapport d'Architecture — app-promo-studio

Version : 1.0 — Date : 30 juillet 2026
Sujet : Studio de génération de vidéos promotionnelles pour applications mobiles à partir de captures d'écran, basé sur Remotion / React.


Section 1 : Vue d'ensemble du système

1.1 Mission du produit

app-promo-studio transforme des screenshots statiques d'applications mobiles en vidéos promotionnelles animées (formats 9:16 pour App Store / Google Play / réseaux sociaux, 16:9 pour le web). L'utilisateur uploade ses captures, choisit un template, personnalise textes/couleurs/musique, et obtient un MP4 (H.264) ou WebM rendu côté serveur.

1.2 Composants principaux

Composant: Frontend Studio
Technologie: React 18 + Vite + TypeScript
Responsabilité: UI d'upload, éditeur de template, preview live Remotion
  Player
────────────────────────────────────────
Composant: API Gateway
Technologie: Fastify (Node 20) ou Hono
Responsabilité: REST, auth, validation des requêtes, signature d'URLs
────────────────────────────────────────
Composant: Ingestion Service
Technologie: Node + Sharp + exiftool-vendored
Responsabilité: Validation, normalisation, pré-traitement des screenshots
────────────────────────────────────────
Composant: Asset Store
Technologie: S3-compatible (MinIO local / AWS S3 prod)
Responsabilité: Stockage screenshots bruts, normalisés, rendus finaux
────────────────────────────────────────
Composant: Metadata DB
Technologie: PostgreSQL 16 + Prisma
Responsabilité: Projets, templates, jobs de rendu, assets, users
────────────────────────────────────────
Composant: Render Queue
Technologie: BullMQ + Redis
Responsabilité: File de jobs de rendu, priorisation, retries
────────────────────────────────────────
Composant: Render Workers
Technologie: Node + Remotion (@remotion/renderer)
Responsabilité: Rendu frame-par-frame, bundle des compositions
────────────────────────────────────────
Composant: Media Encoder
Technologie: FFmpeg (via worker ou AWS Lambda)
Responsabilité: Concat audio/vidéo, transcodage final, thumbnails
────────────────────────────────────────
Composant: Notification Service
Technologie: Webhooks sortants + SSE
Responsabilité: Callbacks de fin de rendu, progress temps réel

1.3 Flux de données (happy path)

1. L'utilisateur uploade N screenshots via le frontend → upload multipart ou URL pré-signée S3.
2. L'Ingestion Service valide, normalise (PNG/JPEG/HEIC → PNG/WebP), détecte le device, stocke, persiste les métadonnées.
3. L'utilisateur sélectionne un template + paramètres → le frontend charge la composition Remotion correspondante dans le Player (preview temps réel à 30fps, sans rendu serveur).
4. Soumission du job → l'API crée un RenderJob en DB, pousse dans BullMQ.
5. Un worker disponible récupère le job, bundle la composition (ou réutilise un bundle caché), télécharge les assets normalisés, lance renderMedia().
6. FFmpeg mux audio/vidéo, génère thumbnail + variantes (720p/1080p/2160p).
7. Le rendu final est uploadé sur S3, le job passe à completed, un webhook est émis.

1.4 Diagramme ASCII


                        ┌──────────────────────────────────────────────┐
         FRONTEND (React/Vite)           │
Upload UI · Éditeur · Remotion Player       │
                        └───────────────┬──────────────────────────────┘
HTTPS / SSE
                                        ▼
┌──────────┐   PUT pré-signé   ┌─────────────────────────┐
S3     │◄──────────────────│      API GATEWAY        │
(bruts)  │                   │  auth · validation ·    │
└────┬─────┘                   │  routing · signatures   │
trigger                 └───────┬─────────┬────────┘
     ▼                                 │         │ enqueue
┌─────────────────┐   assets OK        │         ▼
INGESTION SVC   │───────────────────►│   ┌──────────────┐
sharp·exif·heic │   metadata         │   │  BULLMQ      │
device-detect   │                    │   │  (Redis)     │
└───────┬─────────┘                    │   └──────┬───────┘
                         │          │ pull
        ▼                              │          ▼
┌─────────────────┐                    │   ┌──────────────────────┐
S3 (normalisés)│                    │   │  RENDER WORKERS (xN) │
└───────┬─────────┘                    │   │  Remotion renderer   │
download                     │   │  + FFmpeg mux        │
        └──────────────────────────────┼──►└──────┬───────────────┘
     │ upload MP4
┌─────────────────┐                    │          ▼
POSTGRESQL    │◄───────────────────┘   ┌──────────────┐
projects·jobs·  │      status updates    │ S3 (rendus)  │
templates·users │                        └──────┬───────┘
└─────────────────┘                               │
                                                  ▼
                                        ┌──────────────────┐
WEBHOOK DISPATCH │
retry · sign HMAC│
                                        └──────────────────┘


1.5 Principes architecturaux

- Séparation preview / rendu : le preview navigateur (Player) et le rendu serveur (renderer headless Chromium) partagent le même code de compositions — garantie "what you see is what you get". Aucun code de scène dupliqué.
- Compositions pures et déterministes : une composition = fonction pure de (props, frame). Aucun appel réseau, aucun Date.now(), aucun random non seedé à l'intérieur. Le rendu serveur doit être reproductible bit-à-bit.
- Immutabilité des assets : un screenshot uploadé n'est jamais modifié ; la normalisation produit un nouvel objet versionné (sha256 comme clé).
- Queue-driven : aucun rendu synchrone dans l'API. Tout passe par la queue → backpressure naturelle, retries, scaling horizontal des workers.
- Idempotence des jobs : un RenderJob porte une idempotency_key (hash des params + assets) ; un doublon retourne le job existant.
- Isolation des workers : chaque rendu dans un sous-processus Node isolé (ou conteneur) — un crash Chromium ne tue pas le worker maître.
- Convention over configuration : les templates déclarent leur schéma de paramètres ; l'UI d'édition est générée automatiquement à partir du schéma JSON.


Section 2 : Pipeline d'ingestion des screenshots

2.1 Vue séquentielle


Upload → Validation L1 (MIME/taille) → Stockage brut → Validation L2 (pixels/EXIF)
      → Normalisation (HEIC→PNG, orientation) → Redimensionnement dérivés
      → Détection device → Persistance métadonnées → Événement "asset.ready"


2.2 Upload

- Deux modes :
  - Direct multipart (assets < 10 Mo) : POST /api/v1/assets — proxifié par l'API.
  - URL pré-signée (recommandé, > 10 Mo ou batches) : POST /api/v1/assets/upload-intent retourne { assetId, uploadUrl, expiresAt } ; le client PUT directement vers S3. L'API reçoit un événement s3:ObjectCreated (via MinIO webhook / SQS) qui déclenche le pipeline.
- Clé S3 : raw/{projectId}/{assetId}.{ext} — assetId = UUIDv7 (ordonnancé, indexable).
- Limite : 50 Mo/fichier, 30 fichiers/projet, formats acceptés à ce stade : image/png, image/jpeg, image/heic, image/heif, image/webp.

2.3 Validation L1 — enveloppe (avant stockage)

- Vérification du MIME déclaré contre la signature magique du fichier (magic bytes) — jamais confiance au Content-Type client :
  - PNG : 89 50 4E 47 0D 0A 1A 0A
  - JPEG : FF D8 FF
  - HEIC/HEIF : box ftyp avec brand heic, heix, mif1, msf1
  - WebP : RIFF....WEBP
- Rejet si : taille 0, taille > limite, MIME/signature incohérents, fichier polyglotte suspect (signature image + footer exécutable).
- Scan antivirus optionnel (ClamAV sidecar) pour les tenants exposés publiquement.

2.4 Validation L2 — pixels et EXIF (après stockage brut)

Exécutée par l'Ingestion Service :

1. Décodage probe via Sharp (sharp(buffer).metadata()) : largeur, hauteur, espace colorimétrique, canal alpha, densité DPI.
2. Contraintes de résolution :
   - Minimum : 750 × 1334 px (sous cette résolution, le upscale en 1080p dégrade trop).
   - Maximum : 4096 × 4096 px (au-delà → rejet, pas de downscale silencieux à l'ingestion).
   - Ratio portrait attendu entre 1.6 et 2.3 (9:16 ≈ 1.78, 9:19.5 ≈ 2.17). Les ratios hors borne sont acceptés mais flaggés warnings: ["unusual_aspect_ratio"].
3. Validation EXIF via exiftool-vendored :
   - Orientation : tag EXIF Orientation lu puis appliqué physiquement (sharp.rotate()) puis le tag est supprimé — les pixels normalisés sont toujours en orientation 1. Critique : Remotion/Chromium ignore souvent l'orientation EXIF.
   - Make/Model : extraits pour la détection device (Apple/iPhone 15 Pro, samsung/SM-S911B…).
   - Données sensibles purgées : GPS (GPSLatitude/Longitude), OwnerName, sérial numbers — tout l'EXIF est stripé de l'asset normalisé (confidentialité par défaut). L'EXIF brut est conservé uniquement sur l'objet raw, accès restreint.
   - Corruption : EXIF malformé → warning, pas de rejet (beaucoup de screenshots ont des métadonnées partielles, surtout Android).
   - Screenshots purs : un vrai screenshot n'a en général PAS d'EXIF caméra ; si EXIF caméra présent (ISO, focale, flash), c'est probablement une photo d'écran → warning likely_photo_not_screenshot.
4. Dédup : sha256 du buffer → si un asset normalisé existe déjà pour ce hash dans le projet, on référence l'existant (économie stockage + cohérence).

2.5 Normalisation des formats

Source: PNG
Traitement: Orientation appliquée, strip métadonnées
Sortie maître: PNG (lossless, alpha préservé)
────────────────────────────────────────
Source: JPEG
Traitement: Orientation, strip, ré-encodage q=95 si rotation appliquée
Sortie maître: PNG
────────────────────────────────────────
Source: HEIC/HEIF
Traitement: Décodage via libheif (Sharp ne le supporte pas nativement →
  binaire dédié ou heic-convert), orientation
Sortie maître: PNG
────────────────────────────────────────
Source: WebP
Traitement: Décodage direct Sharp
Sortie maître: PNG

Pourquoi PNG maître : Remotion <Img> doit charger un format sans perte pour éviter le double-artefact lors du compositing GPU ; le JPEG est réservé aux dérivés de preview.

Dérivés générés (Sharp, pipeline unique) :
- master.png : résolution native.
- preview.webp : largeur max 720 px, q=80 — pour la timeline et le Player.
- thumb.jpg : 256 px, q=70 — pour les listes.
- Clés : normalized/{sha256}/{variant}.

2.6 Détection du device

Algorithme à 3 signaux, dans l'ordre de confiance :

1. Lookup résolution exacte (confiance haute) — table embarquée device-table.json :
   
   1290×2796 → iPhone 15 Pro Max / 16 Pro  (9:19.5, Dynamic Island)
   1179×2556 → iPhone 14/15/16 Pro
   1170×2532 → iPhone 12/13/14
   1284×2778 → iPhone 12/13/14 Pro Max
   1125×2436 → iPhone X/XS/11 Pro
   1242×2688 → iPhone XS Max/11 Pro Max
   750×1334  → iPhone SE2/6/7/8 (home button)
   1080×2400 → Android générique 20:9 (Pixel 6/7, Galaxy S21+…)
   1440×3088 → Galaxy S22/S23 Ultra
   1440×3120 → Pixel 7/8 Pro
   2048×2732 → iPad Pro 12.9"
   1668×2388 → iPad Pro 11"
   1600×2560 → Tablette Android 10"
   
2. EXIF Make/Model (confiance moyenne) : corrobore ou tranche les collisions (ex. 1080×2400 est partagé par des dizaines de modèles Android).
3. Heuristiques de ratio + chrome UI (confiance basse) : ratio ≥ 2.1 → smartphone récent à encoche ; bandeau supérieur détecté par analyse de la ligne de pixels du haut (statut bar uniforme) → smartphone ; ratio ≈ 1.33-1.5 → tablette.

Sortie persistée :
json
{
  "deviceClass": "iphone" | "android" | "tablet",
  "deviceModel": "iphone-15-pro",
  "aspectRatio": 2.167,
  "hasNotch": true,
  "hasHomeIndicator": true,
  "suggestedFrame": "iphone-15-pro-titanium",
  "confidence": 0.95
}


Le suggestedFrame pré-sélectionne le mockup device dans Remotion (Section 3.6). L'utilisateur peut toujours le surcharger.

2.7 Gestion d'erreurs et états

- États asset : uploading → validating → ready | rejected | warning.
- Toute erreur produit un AssetError structuré : { code: "RESOLUTION_TOO_LOW", detail: "1170×780 < 750×1334 min", retryable: false }.
- Les assets warning sont utilisables (l'UI affiche un badge orange) ; les rejected sont purgés du brut après 24 h.
- TTL brut : 30 jours. TTL normalisés : durée de vie du projet.


Section 3 : Remotion — génération de scènes animées

3.1 Structure du code des compositions


src/remotion/
├── PromoClassic/
│   ├── index.tsx           # composition principale
│   ├── schema.ts           # zod schema des props
│   └── calculate.ts        # calculateMetadata (durée dynamique)
├── PromoDynamic/
└── PromoMinimal/
├── IntroTitle.tsx
├── DeviceShowcase.tsx
├── FeatureCallout.tsx
├── ScreenshotCarousel.tsx
└── OutroCTA.tsx
├── transitions.ts          # fade, slide, zoom, wipe
├── kenBurns.ts
├── parallax.ts
└── springs.ts              # presets spring()
├── DeviceFrame.tsx         # mockups iPhone/Android/iPad
├── AnimatedText.tsx
├── GradientBackground.tsx
└── AudioTrack.tsx
└── lib/
    └── easing.ts               # courbes Easing custom


3.2 Enregistrement des compositions

tsx
// Root.tsx
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="PromoClassic"
      component={PromoClassic}
      durationInFrames={300}        // fallback, recalculé
      fps={30}
      width={1080}
      height={1920}
      schema={promoClassicSchema}   // zod → UI auto + validation serveur
      defaultProps={defaultPromoProps}
      calculateMetadata={calculatePromoMetadata}
    />
    {/* ...autres templates */}
  </>
);


calculateMetadata est essentiel : la durée dépend du nombre de screenshots et des durées de scènes paramétrées — elle est recalculée à partir des props avant chaque rendu :

ts
export const calculatePromoMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
  const perShot = props.secondsPerScreenshot * FPS;
  const intro = props.intro.enabled ? 60 : 0;
  const outro = props.outro.enabled ? 75 : 0;
  const transitions = props.screenshots.length * TRANSITION_FRAMES;
  return {
    durationInFrames: intro + props.screenshots.length * perShot + transitions + outro,
    props,
  };
};


3.3 useCurrentFrame() et modèle temporel

Toute animation est une fonction pure de frame :

tsx
const frame = useCurrentFrame();
const { fps, durationInFrames } = useVideoConfig();

// Opacité d'entrée sur 20 frames
const opacity = interpolate(frame, [0, 20], [0, 1], {
  extrapolateRight: 'clamp',
});

// Zoom physique (spring) avec damping
const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });


Règles de la codebase :
- Interpolation toujours bornée (clamp) pour éviter les dépassements hors plage de frames.
- Durées définies en secondes côté paramètres utilisateur, converties en frames au plus tôt (sec * fps) — jamais de frames en dur dans les schémas publics.
- <Sequence from={...} durationInFrames={...}> pour découper la timeline en scènes : chaque scène voit un frame local qui repart à 0 — animations locales simples, pas de calcul global.

3.4 Transitions

Bibliothèque animations/transitions.ts — chaque transition est un composant wrapper à deux enfants (sortant / entrant) piloté par frame relatif à la fenêtre de transition :

Transition: Fade
Implémentation: Cross-dissolve : opacity sortant 1→0, entrant 0→1 sur N
  frames
Paramètres: durée, easing
────────────────────────────────────────
Transition: Slide
Implémentation: translateX entrant ±width→0 avec spring() ; sortant
  parallèle à 30 % d'amplitude (effet carrousel)
Paramètres: direction, durée, bounce
────────────────────────────────────────
Transition: Zoom
Implémentation: Entrant scale 1.3→1 + fade ; sortant scale 1→0.85
Paramètres: durée, origine du zoom
────────────────────────────────────────
Transition: Wipe
Implémentation: clipPath: inset(0 X% 0 0) animé linéairement, bord
  lumineux optionnel
Paramètres: direction, durée
────────────────────────────────────────
Transition: Flip 3D
Implémentation: rotateY 90°→0 avec perspective(1200px) sur le conteneur
Paramètres: durée, axe

Pattern de composition :

tsx
<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={shot1Duration}>
    <DeviceShowcase shot={shots[0]} />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={slide({ direction: 'from-right' })}
    timing={springTiming({ durationInFrames: 25 })}
  />
  {/* ... */}
</TransitionSeries>


(@remotion/transitions fournit TransitionSeries et les présentations de base ; les transitions custom héritent de TransitionPresentation.)

3.5 Synchronisation audio

- Piste musicale via <Audio src={staticFile(musicUrl)} volume={...} /> au niveau racine de la composition.
- Ducking : baisse automatique du volume sous les voix/textes parlés — volume comme fonction de frame avec interpolate autour des fenêtres de voiceover.
- Beat-sync (template "dynamique") : le fichier musique est pré-analysé à l'ingestion (aubio/Essentia ou API externe) → liste des timestamps de beats persistée en JSON. Les transitions de scènes sont snappées sur le beat le plus proche dans calculateMetadata :

ts
const snapToBeat = (targetSec: number, beats: number[]) =>
  beats.reduce((a, b) => Math.abs(b - targetSec) < Math.abs(a - targetSec) ? b : a);


- Fade out systématique sur les 45 dernières frames : interpolate(frame, [durationInFrames - 45, durationInFrames], [volume, 0]).
- Normalisation loudness au mux final : FFmpeg -af loudnorm=I=-14:TP=-1.5 (standard réseaux sociaux).

3.6 Device frame mockup

<DeviceFrame> habille le screenshot d'un cadre d'appareil réaliste :

tsx
<DeviceFrame model="iphone-15-pro" color="titanium-natural">
  <Img src={screenshotUrl} />
</DeviceFrame>


- Implémentation : cadres SVG vectoriels internes (pas de PNG tiers → net à toute résolution, pas de licence douteuse) : un SVG par famille (iPhone Dynamic Island, iPhone encoche, iPhone home button, Android punch-hole, iPad).
- Le screenshot est masqué par clipPath arrondi correspondant au rayon d'écran du device (border-radius ne suffit pas pour les coins Dynamic Island → masque SVG précis).
- Détails rendus : reflet spécifique subtil (gradient overlay 4 % d'opacité animé en parallax), ombre portée (filter: drop-shadow), boutons latéraux en vectoriel.
- Le suggestedFrame de l'ingestion (Section 2.6) pré-remplit model.

3.7 Parallax

Effet de profondeur sur le showcase device : le screenshot se déplace légèrement en sens inverse du cadre, plus le fond bouge encore moins — 3 plans :

tsx
const progress = interpolate(frame, [0, sceneDuration], [0, 1]);
const deviceY   = interpolate(progress, [0, 1], [40, -40]);   // avant-plan
const screenY   = interpolate(progress, [0, 1], [18, -18]);   // plan médian
const bgPos     = interpolate(progress, [0, 1], [0, -12]);    // arrière-plan


Option gyro-simulé : oscillation sinusoïdale de ±4 px sur translateX/rotate pour un effet "device flottant" (Math.sin(frame / 18) * 4).

3.8 Ken Burns effect

Pour les screenshots utilisés en fond (blur backdrop) ou en plein cadre sans device :

tsx
const kb = kenBurns(frame, durationInFrames, {
  from: { scale: 1.0, x: 0,    y: 0   },
  to:   { scale: 1.15, x: -30, y: 20 },
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
});
// style: transform: scale(kb.scale) translate(kb.x, kb.y)


Variantes de direction par index de scène (alternance zoom-in/zoom-out pour éviter la monotonie). Usage typique : le fond est le screenshot courant flouté (filter: blur(40px) brightness(0.6)) en Ken Burns lent pendant que le device net est au premier plan — comble les bandes latérales élégamment en 9:16.

3.9 Performance de rendu

- concurrency du renderer = os.cpus().length / 2 (Chromium headless par frame-range).
- Images servies en taille exacte de composition (le master PNG 2796 px est downsizé à 1080 px de large utile avant rendu si le device n'occupe que 80 % du cadre — économie GPU).
- OffthreadVideo banni pour les assets image (inutile) ; <Img> + staticFile() uniquement.
- Bundle webpack des compositions caché par hash de contenu (bundleCache/{hash}/) — un second rendu du même template sans changement de code démarre en ~2 s au lieu de ~40 s.


Section 4 : Système de templates vidéo

4.1 Modèle : un template = schéma + composition + assets

Chaque template est un paquet auto-décrit :

json
{
  "id": "promo-dynamic",
  "version": "2.1.0",
  "name": "Dynamique",
  "description": "Cuts rapides, zooms, beat-sync. Idéal réseaux sociaux.",
  "compositionId": "PromoDynamic",
  "thumbnail": "templates/promo-dynamic/thumb.jpg",
  "previewVideo": "templates/promo-dynamic/preview.mp4",
  "supportedAspects": ["9:16", "1:1", "16:9"],
  "minScreenshots": 2,
  "maxScreenshots": 8,
  "schema": { /* JSON Schema des paramètres — voir 4.3 */ },
  "defaults": { /* valeurs par défaut */ },
  "assets": {
    "music": ["tracks/upbeat-pop.mp3", "tracks/hip-hop-minimal.mp3"],
    "fonts": ["Inter-Variable", "SpaceGrotesk-Bold"]
  }
}


Le même schéma sert à trois endroits :
1. Génération automatique du formulaire d'édition dans le frontend (un champ par propriété : color picker, slider, select de musique avec preview, champ texte avec compteur).
2. Validation serveur des props avant enqueue (zod côté Node, JSON Schema côté client — générés l'un de l'autre).
3. Documentation : la page de détail du template est auto-générée.

4.2 Les trois variations de style livrées

Moderne (promo-modern)
- Fond : gradient mesh animé (2-3 couleurs de marque interpolées lentement).
- Device : cadre 3/4 tourné (rotateY -8°), ombre douce, entrée en spring depuis le bas.
- Textes : gros titres sans-serif (Space Grotesk), apparition mot-à-mot (stagger 4 frames/mot), soulignement animé au pinceau.
- Transitions : slide + fade doux, 25 frames.
- Cible : App Store, site produit, LinkedIn.

Minimaliste (promo-minimal)
- Fond : couleur unie ou blanc cassé, grain de film subtil (overlay noise 3 %).
- Device : de face, centré, sans rotation ; respiration verticale ±6 px.
- Textes : Inter Light, petits, espacés (letter-spacing 0.2em), fade pur sans mouvement.
- Transitions : fade long (35 frames), aucune autre.
- Ken Burns très lent sur les screenshots plein cadre.
- Cible : marques premium, produits B2B, démos sobres.

Dynamique (promo-dynamic)
- Fond : screenshots floutés en Ken Burns rapide + flashes de couleur sur les beats.
- Device : zoom punchy (scale 0.9→1.02 en 12 frames avec overshoot), tilt alterné ±5°.
- Textes : énormes, condensés, entrée en "slam" (scale 1.6→1 avec spring dur), shake de 2 frames à l'impact.
- Transitions : zoom/wipe rapides (12-15 frames), snappées sur les beats (Section 3.5).
- Cible : TikTok, Reels, Shorts, pubs UA (user acquisition).

4.3 Paramètres (schéma utilisateur)

json
{
  "type": "object",
  "properties": {
    "screenshots": {
      "type": "array",
      "items": { "type": "string", "format": "asset-id" },
      "minItems": 2, "maxItems": 8
    },
    "secondsPerScreenshot": { "type": "number", "min": 1.5, "max": 8, "default": 3 },
    "aspect": { "type": "string", "enum": ["9:16", "1:1", "16:9"], "default": "9:16" },
    "style": {
      "type": "object",
      "properties": {
        "primaryColor":   { "type": "string", "format": "color", "default": "#6C5CE7" },
        "secondaryColor": { "type": "string", "format": "color", "default": "#00CEC9" },
        "backgroundColor":{ "type": "string", "format": "color", "default": "#0F0F1A" },
        "textColor":      { "type": "string", "format": "color", "default": "#FFFFFF" },
        "fontFamily":     { "type": "string", "enum": ["inter", "space-grotesk", "poppins"] },
        "deviceModel":    { "type": "string", "default": "auto" },
        "deviceColor":    { "type": "string", "default": "auto" }
      }
    },
    "texts": {
      "type": "object",
      "properties": {
        "headline":    { "type": "string", "maxLength": 48 },
        "subheadline": { "type": "string", "maxLength": 90 },
        "perScreenshotCaptions": { "type": "array", "items": { "type": "string", "maxLength": 60 } },
        "cta":         { "type": "string", "maxLength": 30, "default": "Télécharger l'app" }
      }
    },
    "audio": {
      "type": "object",
      "properties": {
        "musicTrack":  { "type": "string", "format": "music-id" },
        "musicVolume": { "type": "number", "min": 0, "max": 1, "default": 0.7 },
        "beatSync":    { "type": "boolean", "default": true }
      }
    },
    "intro": { "type": "object", "properties": { "enabled": { "type": "boolean", "default": true }, "logoAssetId": { "type": ["string", "null"] } } },
    "outro": { "type": "object", "properties": { "enabled": { "type": "boolean", "default": true }, "showAppStoreBadges": { "type": "boolean", "default": true } } }
  },
  "required": ["screenshots"]
}


Contraintes transverses validées serveur : longueur totale ≤ 90 s (limites App Store preview / TikTok), cohérence perScreenshotCaptions.length ≤ screenshots.length, contraste texte/fond ≥ 4.5:1 (warning, pas rejet).

4.4 De la config à la vidéo


Config utilisateur (JSON)
validation zod + résolution "auto" (deviceModel ← ingestion)
   ▼
Props figées (defaultProps ⊕ overrides)  ──► Preview Player (navigateur)
                                       (rendu interactif gratuit)
submit
   ▼
RenderJob { templateId, templateVersion, props, idempotencyKey }
pin de version : le job référence template@2.1.0 exactement
   ▼
Worker : bundle(template@2.1.0) → renderMedia(props) → MP4


Points clés :
- Versioning : les props sont validées contre la version du template au moment du job. Un template mis à jour ne casse jamais un job en file ou un projet existant (re-rendu reproductible 6 mois plus tard).
- Résolution des "auto" au submit (pas dans le worker) : ce qui est rendu est exactement ce qui a été previewé.
- Multi-aspect : un même job peut demander aspects: ["9:16","1:1"] → un worker rend la composition une fois par aspect (les compositions sont responsive via useVideoConfig().width/height, les layouts s'adaptent — jamais de crop brutal).


Section 5 : API et orchestration

5.1 API REST — surface

Base : /api/v1. Auth : JWT court + refresh (sessions UI) ou clé API aps_live_… (accès programmatique, scopes : assets:write, renders:write, renders:read).

Assets
Méthode: POST
Endpoint: /assets/upload-intent
Description: Crée un intent → URL pré-signée S3
────────────────────────────────────────
Méthode: POST
Endpoint: /assets
Description: Upload multipart direct (< 10 Mo)
────────────────────────────────────────
Méthode: GET
Endpoint: /assets/:id
Description: Métadonnées, statut, device détecté, variantes
────────────────────────────────────────
Méthode: GET
Endpoint: /assets?projectId=
Description: Liste paginée (cursor)
────────────────────────────────────────
Méthode: DELETE
Endpoint: /assets/:id
Description: Suppression (brut + dérivés, async)
────────────────────────────────────────
Méthode: POST
Endpoint: /assets/:id/reprocess
Description: Relance le pipeline d'ingestion

Projets & Templates
| Méthode   | Endpoint       | Description                               |
|-----------|----------------|-------------------------------------------|
| GET/POST  | /projects      | Liste / création                          |
| GET/PATCH | /projects/:id  | Détail / mise à jour (config sauvegardée) |
| GET       | /templates     | Catalogue + schémas JSON                  |
| GET       | /templates/:id | Détail + preview video                    |

Rendus
Méthode: POST
Endpoint: /renders
Description: Crée un RenderJob { projectId, templateId, props, aspects[],
  webhookUrl? } → 202 { jobId, idempotencyKey, estimatedSeconds }
Column 4:
────────────────────────────────────────
Méthode: GET
Endpoint: /renders/:jobId
Description: Statut : queued → bundling → rendering (progress %) →
  encoding → uploading → completed
Column 4: failed + outputUrls
────────────────────────────────────────
Méthode: GET
Endpoint: /renders/:jobId/progress
Description: SSE stream : { phase, renderedFrames, totalFrames, fps,
  etaSeconds }
Column 4:
────────────────────────────────────────
Méthode: POST
Endpoint: /renders/:jobId/cancel
Description: Annulation (soft : le worker termine le chunk courant)
Column 4:
────────────────────────────────────────
Méthode: GET
Endpoint: /renders/:jobId/download
Description: 302 vers URL signée S3 (TTL 1 h)
Column 4:

Webhooks entrants sortants : POST /webhooks pour enregistrer des endpoints, GET /webhooks/:id/deliveries pour le journal.

5.2 File de rendu et workers

Queue (BullMQ/Redis) — trois files séparées :
- render:standard : jobs utilisateurs normaux.
- render:priority : tenants payants / retries manuels (workers la vident d'abord, priority BullMQ).
- render:preview : rendus basse qualité (480p, 15 fps, CRF 32) pour export rapide de validation — SLA 30 s.

Payload de job :
json
{
  "jobId": "rjob_01J…",
  "idempotencyKey": "sha256(template@2.1.0 + props + assetHashes)",
  "compositionId": "PromoDynamic",
  "templateRef": "promo-dynamic@2.1.0",
  "props": { /* figées */ },
  "aspects": [{ "w": 1080, "h": 1920 }],
  "output": { "codec": "h264", "crf": 18, "preset": "medium", "audioBitrate": "192k" },
  "webhookUrl": "https://client.example.com/hooks/promo",
  "attempt": 1
}


Cycle de vie worker :
1. Worker BullMQ (concurrency 1 par processus — un rendu sature déjà plusieurs cœurs).
2. Vérifie le cache de bundle (bundleCache/{templateHash}) → bundle webpack si miss.
3. Télécharge les assets normalisés dans un workspace temporaire /tmp/render-{jobId}/ (nettoyé en finally, même en cas de crash).
4. renderMedia({ composition, serveUrl, codec: 'h264', concurrency, onProgress }) — chaque progression met à jour Redis (job.progress) que l'API relaie en SSE.
5. Post-traitement FFmpeg : mux audio normalisé (loudnorm), génération thumbnail (frame à 40 %), variantes de résolution.
6. Upload multipart S3 des sorties, PUT de statut completed + URLs.
7. Émission webhook.

Robustesse :
- Timeout dur : 15 min/job → kill + retry.
- Retries : 3 tentatives, backoff exponentiel (30 s, 2 min, 8 min). Erreurs classées : OOM/chromium-crash → retryable ; invalid-props/asset-missing → échec définitif immédiat.
- Watchdog : un rendu sans progression pendant 90 s est considéré gelé → kill du sous-processus Chromium, retry.
- Scaling : workers conteneurisés (Docker, image Node + Chromium + FFmpeg), autoscaling sur la profondeur de queue (KEDA ou script maison : 1 worker par job en attente, max N selon le host — sur le M2 Ultra local : 2 workers concurrents max, ~8 Go RAM chacun).
- Anti double-facturation de compute : l'idempotencyKey est contrainte unique en DB ; un POST /renders dupliqué retourne le job existant (200 au lieu de 202).

5.3 Webhooks de notification

Événements émis :
- render.queued, render.started, render.progress (throttled : max 1/5 s), render.completed, render.failed, render.cancelled
- asset.ready, asset.rejected

Payload :
json
{
  "id": "evt_01J…",
  "type": "render.completed",
  "createdAt": "2026-07-30T14:22:10Z",
  "data": {
    "jobId": "rjob_01J…",
    "projectId": "proj_01J…",
    "outputs": [
      { "aspect": "9:16", "url": "https://…/final.mp4", "expiresAt": "…", "sizeBytes": 14823177, "durationSec": 24.5 }
    ],
    "renderDurationMs": 83000
  }
}


Fiabilité :
- Signature HMAC-SHA256 du corps brut dans l'en-tête X-APS-Signature (t=<ts>,v1=<hex>), secret par endpoint — le receveur doit vérifier timestamp ±5 min (anti-rejeu).
- Livraison avec retry : 6 tentatives sur 24 h (1 m, 5 m, 30 m, 2 h, 6 h, 12 h). Un endpoint qui échoue 50 fois consécutivement est auto-désactivé (email à l'owner).
- Journal des livraisons conservé 30 jours, rejouable manuellement (POST /webhooks/:id/deliveries/:deliveryId/resend).
- Ordre non garanti → chaque événement porte createdAt + un sequence par job ; les clients doivent être idempotents sur id.

5.4 Limites et quotas (par tenant)

| Ressource          | Free     | Pro      |
|--------------------|----------|----------|
| Rendus / mois      | 10       | 500      |
| Durée max vidéo    | 30 s     | 90 s     |
| Résolution max     | 1080p    | 2160p    |
| Concurrence rendus | 1        | 4        |
| File               | standard | priority |
| Watermark          | oui      | non      |

Appliqués à deux niveaux : rejet sec à l'API (402/429) et ré-injection dans la bonne file par le scheduler.


Fin du rapport.

---

Section 6: Système de rendu et export

6.1 Pipeline de rendu Remotion

Le cœur du studio repose sur @remotion/renderer, le moteur de rendu headless de Remotion qui orchestre la conversion d'une composition React en frames vidéo individuelles, puis leur assemblage via FFmpeg.

Pipeline en 4 étapes :


Composition React (TSX)

      ▼
┌─────────────────────┐
1. Bundling        │  webpack/esbuild → bundle JS autonome
(@remotion/bundler) │  résout imports, assets, fonts
└────────┬────────────┘

         ▼
┌─────────────────────┐
2. Frame rendering │  Chromium headless — 1 frame par page
(@remotion/renderer)│  capture pixel-perfect via CDP
parallélisée       │  (Chrome DevTools Protocol)
└────────┬────────────┘
PNG/JPEG séquentiel (frame_00000.png ...)
         ▼
┌─────────────────────┐
3. Stitching       │  FFmpeg assemble les frames
(encode)           │  + audio track muxing
└────────┬────────────┘

         ▼
┌─────────────────────┐
4. Post-processing │  thumbnails, HLS packaging, upload
└─────────────────────┘


Détail de l'étape 2 (frame rendering) :

Chaque frame est calculée en naviguant Chromium à l'instant t = frame / fps de la composition. Remotion utilise React.render() dans le contexte du navigateur, capture le canvas via Page.captureScreenshot() (CDP), puis passe à la frame suivante. La parallélisation se fait via un pool de workers, chacun gérant un segment contigu de frames pour minimiser les re-renders React.

6.2 Serveur de rendu headless

Architecture du render worker :

typescript
// render-worker.ts — structure conceptuelle
import { renderMedia, selectComposition, bundle } from '@remotion/renderer';

async function renderVideo(job: RenderJob): Promise<RenderResult> {
  // 1. Bundle la composition (mis en cache si pas de changements)
  const bundleLocation = await bundle({
    entryPoint: './src/remotion/index.ts',
    webpackOverride: (config) => config,
  });

  // 2. Résout la composition (récupère métadonnées, duration, dimensions)
  const inputProps = {
    templateId: job.templateId,
    assets: job.assets,
    overrides: job.customization,
    durationInFrames: job.durationFrames,
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: job.compositionId,
    inputProps,
  });

  // 3. Rendu + encode en une passe
  const result = await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: job.codec,
    outputLocation: job.outputPath,
    inputProps,
    
    // Configuration Chromium
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
      gl: 'angle',           // accélération GPU ANGLE (ou 'egl' / 'swiftshader')
      ignoreCertificateErrors: false,
      headless: true,
    },
    
    // Parallélisation
    concurrency: '100%',     // utilise tous les CPUs disponibles
    // ou: concurrency: ommittedForLambda (géré par @remotion/lambda)
    
    // Qualité d'encode
    crf: job.crf ?? 18,
    pixelFormat: 'yuv420p',
    everyNthFrame: 1,
    
    // Callbacks de progression
    onProgress: ({ progress }) => {
      updateJobProgress(job.id, progress);
    },
    
    // Configuration audio
    muted: job.muted ?? false,
    enforceAudioTrack: true,
    audioBitrate: '192k',
  });

  return result;
}


6.3 Configuration Chromium

Chromium est l'élément critique du pipeline. Plusieurs facteurs affectent les performances et la stabilité :

Mode GPU vs CPU (software rendering) :

Mode: ANGLE (recommandé)
Flag GL: gl: 'angle'
Cas d'usage: Serveurs avec GPU (EC2 G4dn)
Performance: Rapide, support WebGL
────────────────────────────────────────
Mode: EGL
Flag GL: gl: 'egl'
Cas d'usage: Conteneurs Linux avec GPU
Performance: Bon, via Mesa/EGL
────────────────────────────────────────
Mode: SwiftShader
Flag GL: gl: 'swiftshader'
Cas d'usage: CPU-only (Lambda, Fargate)
Performance: Lent mais compatible
────────────────────────────────────────
Mode: Auto
Flag GL: gl: 'auto'
Cas d'usage: Détection automatique
Performance: Variable

Flags Chromium critiques pour la production :

bash
--no-sandbox                    # conteneurs (Lambda, Docker)
--disable-gpu-sandbox
--disable-dev-shm-usage         # évite /dev/shm plein (Docker)
--disable-extensions
--disable-background-networking
--disable-sync
--force-color-profile=srgb      # cohérence colorimétrique
--disable-color-correct-rendering


Problème du /dev/shm en conteneur :

Chromium utilise la mémoire partagée pour le rendu. En Docker, /dev/shm fait 64 Mo par défaut, ce qui cause des crashes aléatoires. Solutions :
- --shm-size=2g au lancement du conteneur
- Ou monter un tmpfs dédié

6.4 Gestion mémoire GPU

Le rendu vidéo est intensif en mémoire. Pour une composition 1080p à 30fps de 30 secondes (900 frames), chaque frame non compressée en RGBA pèse ~8 Mo → le buffer total peut atteindre plusieurs Go si le pipeline n'est pas contrôlé.

Stratégies de gestion mémoire :

1. Streaming des frames — Remotion ne garde jamais toutes les frames en mémoire. Chaque frame capturée est écrite sur disque immédiatement, puis lue par FFmpeg en streaming.

2. Segmentation du rendu — Pour les vidéos longues (> 60s), découper en segments rendus indépendamment puis concaténés :
   
   Segment 1 (0-15s) → frames → encode → chunk1.mp4
   Segment 2 (15-30s) → frames → encode → chunk2.mp4
   Concaténation via FFmpeg concat demuxer → final.mp4
   

3. Limite de concurrency adaptative — Sur Lambda, @remotion/lambda ajuste automatiquement le nombre de Chrome instances en fonction de la mémoire allouée à la fonction (recommandé : 2048-4096 Mo par frame).

4. Libération explicite — Après chaque batch de frames, fermer les pages Chromium inactives via browser.close() pour libérer les V8 isolats.

6.5 Formats de sortie

Matrice des codecs et conteneurs supportés :

Format: MP4 H.264
Codec: H.264/AVC
Conteneur: .mp4
Cas d'usage: Universal (web, social, mobile)
Taille relative: Référence (1x)
────────────────────────────────────────
Format: MP4 H.265
Codec: H.265/HEVC
Conteneur: .mp4
Cas d'usage: App Stores, 4K, qualité haute
Taille relative: 0.5x (50% plus petit)
────────────────────────────────────────
Format: WebM VP9
Codec: VP9
Conteneur: .webm
Cas d'usage: Web moderne, transparence
Taille relative: 0.6x
────────────────────────────────────────
Format: WebM VP8
Codec: VP8
Conteneur: .webm
Cas d'usage: Transparence alpha
Taille relative: 0.8x
────────────────────────────────────────
Format: GIF
Codec: —
Conteneur: .gif
Cas d'usage: Aperçus, previews légers
Taille relative: 3-5x (très lourd)
────────────────────────────────────────
Format: ProRes
Codec: ProRes 422
Conteneur: .mov
Cas d'usage: Post-production, master
Taille relative: 10-20x
────────────────────────────────────────
Format: PNG sequence
Codec: PNG
Conteneur: .zip
Cas d'usage: Frames brutes, debug
Taille relative: 50x+

Configuration recommandée par cas de sortie :

typescript
const OUTPUT_PRESETS = {
  // Réseaux sociaux universel (Instagram, TikTok, YouTube)
  social_media: {
    codec: 'h264' as const,
    container: 'mp4',
    crf: 18,                    // bon équilibre qualité/taille
    pixelFormat: 'yuv420p',     // compatibilité maximale
    audioBitrate: '192k',
    videoBitrate: undefined,     // CRF mode (qualité constante)
  },

  // App Store preview (Apple requirements)
  app_store: {
    codec: 'h264' as const,
    container: 'mp4',
    crf: 16,                    // haute qualité
    pixelFormat: 'yuv420p',
    audioBitrate: '256k',
    // Apple impose: H.264, 1080p ou 4K, stereo AAC
  },

  // Web optimisé (landing pages)
  web_optimized: {
    codec: 'h265' as const,
    container: 'mp4',
    crf: 22,
    pixelFormat: 'yuv420p',
    audioBitrate: '128k',
  },

  // Transparence (overlays)
  transparent: {
    codec: 'vp8' as const,
    container: 'webm',
    crf: 20,
    pixelFormat: 'yuva420p',   // canal alpha
    muted: true,
  },

  // GIF animé (aperçu)
  gif_preview: {
    codec: 'gif' as const,
    container: 'gif',
    everyNthFrame: 2,           // sous-échantillonnage (15fps effectif)
    muted: true,
  },
};


6.6 Résolutions supportées

Format: Full HD horizontal
Résolution: 1920×1080
Ratio: 16:9
fps: 30/60
Cas d'usage: YouTube, LinkedIn, web
────────────────────────────────────────
Format: Full HD vertical
Résolution: 1080×1920
Ratio: 9:16
fps: 30
Cas d'usage: TikTok, Reels, Stories
────────────────────────────────────────
Format: Carré
Résolution: 1080×1080
Ratio: 1:1
fps: 30
Cas d'usage: Feed Instagram, posts
────────────────────────────────────────
Format: 4K horizontal
Résolution: 3840×2160
Ratio: 16:9
fps: 30/60
Cas d'usage: App Store, showcase
────────────────────────────────────────
Format: 4K vertical
Résolution: 2160×3840
Ratio: 9:16
fps: 30
Cas d'usage: App Store vertical
────────────────────────────────────────
Format: Carré HD
Résolution: 1080×1080
Ratio: 1:1
fps: 30
Cas d'usage: Social feed universel
────────────────────────────────────────
Format: Landscape social
Résolution: 1280×720
Ratio: 16:9
fps: 30
Cas d'usage: Twitter/X, Facebook
────────────────────────────────────────
Format: Portrait social
Résolution: 720×1280
Ratio: 9:16
fps: 30
Cas d'usage: Previews légers

Gestion multi-résolution :

Une même composition Remotion peut être rendue à plusieurs résolutions via le système de layout responsive de Remotion. Au lieu de hardcoder les dimensions, on utilise des valeurs relatives :

typescript
// Composition responsive Remotion
export const PromoVideo = ({ templateId, assets }: SceneProps) => {
  const { width, height, durationInFrames, fps } = useVideoConfig();
  
  // Tout est relatif aux dimensions de la composition
  const isVertical = height > width;
  const titleFontSize = isVertical ? height * 0.06 : height * 0.08;
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <PhoneMockup
        width={isVertical ? width * 0.85 : width * 0.45}
        screenHeight={height * 0.7}
      />
      <AnimatedTitle fontSize={titleFontSize} />
    </AbsoluteFill>
  );
};


6.7 CRF et arbitrage qualité vs taille

Le Constant Rate Factor (CRF) est le paramètre le plus important pour l'encode. Il contrôle le compromis qualité visuelle / taille de fichier.

Échelle CRF (H.264) :


CRF  ──────────────────────────────────────────────────────
 0    12    18    23    28    35    51
│     │     │     │     │     │
Lossless  Visuellement   Bon   Moyen  Faible  Pire
         lossless              qualité qualité qualité
              ↑
        Valeur recommandée: 18 (social media)
        Valeur haute qualité: 16 (App Store)
        Valeur web optimisé: 22-24


CRF: 0
Qualité perçue: Lossless
Taille relative: 100x
Débit de rendu: Très lent
Recommandation: Jamais (master brut)
────────────────────────────────────────
CRF: 12
Qualité perçue: Exceptionnel
Taille relative: 8x
Débit de rendu: Lent
Recommandation: Post-production
────────────────────────────────────────
CRF: 16
Qualité perçue: Excellent
Taille relative: 2.5x
Débit de rendu: Modéré
Recommandation: App Store, showcase
────────────────────────────────────────
CRF: 18
Qualité perçue: Très bon
Taille relative: 1.5x
Débit de rendu: Modéré
Recommandation: Réseaux sociaux (défaut)
────────────────────────────────────────
CRF: 22
Qualité perçue: Bon
Taille relative: 1x (référence)
Débit de rendu: Rapide
Recommandation: Web, previews
────────────────────────────────────────
CRF: 28
Qualité perçue: Acceptable
Taille relative: 0.6x
Débit de rendu: Rapide
Recommandation: Mobile bas débit
────────────────────────────────────────
CRF: 35
Qualité perçue: Médiocre
Taille relative: 0.3x
Débit de rendu: Très rapide
Recommandation: Thumbnails animés

Pipeline d'encode multi-passes (optionnel) :

Pour les rendus haute qualité (App Store), l'encode two-pass améliore la distribution des bits :

typescript
// Two-pass encoding (via configuration FFmpeg avancée)
const renderMediaConfig = {
  // Remotion gère le two-pass automatiquement quand:
  // - videoBitrate est défini (au lieu de CRF seul)
  // - le codec supporte le two-pass
  crf: undefined,
  videoBitrate: '8M',        // cible 8 Mbps pour 1080p
  enforceAudioBitrate: true,
  // @remotion/lambda gère le two-pass nativement
};


Section 7: Stockage et delivery des vidéos

7.1 Architecture de storage


┌──────────────┐     upload direct      ┌─────────────────┐
Render       │ ───────────────────── │  Stockage Objet  │
Worker/Lambda│   multipart, signed   │  S3 / R2         │
└──────────────┘     PUT                 │                  │
Bucket:         │
┌──────────────┐                         │  - /renders/raw  │
API Backend │ ◄── metadata ───────── │  - /renders/hls  │
(Postgres)  │                         │  - /thumbnails   │
└──────────────┘                         │  - /assets/user  │
                                          └────────┬─────────┘

                                                   ▼
                                          ┌─────────────────┐
CDN Edge        │
CloudFront /    │
BunnyCDN        │
                                          └────────┬─────────┘

                                    ┌──────────────┼──────────────┐
                                    ▼              ▼              ▼
                              ┌──────────┐  ┌──────────┐  ┌──────────┐
Client    │  │ Client    │  │ Client    │
Web       │  │ Mobile    │  │ API       │
                              └──────────┘  └──────────┘  └──────────┘


7.2 Stockage objet — S3 vs Cloudflare R2

Critère: Coût stockage
AWS S3: $0.023/Go/mo (Standard)
Cloudflare R2: $0.015/Go/mo
────────────────────────────────────────
Critère: Coût egress
AWS S3: $0.09/Go (vers internet)
Cloudflare R2: $0 (gratuit)
────────────────────────────────────────
Critère: Coût opérations
AWS S3: $0.0005/1000 PUT, $0.0004/1000 GET
Cloudflare R2: $0.0075/M class A, $0.001/M class B
────────────────────────────────────────
Critère: Latence read
AWS S3: Dépend de la région
Cloudflare R2: Global par défaut (anycast)
────────────────────────────────────────
Critère: Intégration CDN
AWS S3: CloudFront natif
Cloudflare R2: Intégré au réseau Cloudflare
────────────────────────────────────────
Critère: S3 API compatible
AWS S3: Natif
Cloudflare R2: Oui (drop-in)
────────────────────────────────────────
Critère: Lifecycle rules
AWS S3: Oui (transition Glacier)
Cloudflare R2: Oui (rules simples)
────────────────────────────────────────
Critère: Multipart upload
AWS S3: Oui
Cloudflare R2: Oui

Recommandation : Cloudflare R2 pour le stockage primaire des vidéos rendues, car l'egress gratuit est un avantage massif pour un service de distribution vidéo. Chaque visionnage d'une vidéo promo est un download — avec S3 + CloudFront, le coût egress peut dépasser le coût de stockage de 5 à 10x.

Structure de buckets :


app-promo-studio-storage/
├── {projectId}/
│   ├── {renderId}/
│   │   ├── raw/
│   │   │   └── output.mp4              # fichier maître
│   │   ├── hls/
│   │   │   ├── master.m3u8             # manifest HLS
│   │   │   ├── 1080p/
│   │   │   │   ├── playlist.m3u8
│   │   │   │   └── segment_0.ts ... segment_N.ts
│   │   │   ├── 720p/
│   │   │   └── 480p/
│   │   ├── thumbnails/
│   │   │   ├── thumb_0001.jpg          # frame 1
│   │   │   ├── thumb_0050.jpg          # frame 50
│   │   │   └── poster.jpg              # poster par défaut
│   │   └── metadata.json               # durée, résolution, taille
│   └── _archive/                        # anciens rendus compressés
├── {userId}/
│   ├── screenshots/                    # uploads utilisateur
│   ├── logos/
│   └── audio/
└── templates/                           # assets de templates système
└── exports/
    └── {exportId}/
        └── export.mp4                       # téléchargements directs


7.3 Stratégies de cache

Multi-niveau de cache :


Niveau 1 — Browser Cache (client)
└── Hit rate: ~90% pour les revisites

Niveau 2 — CDN Edge Cache
└── TTL: 7 jours (vidéos), 1 an (thumbnails)

Niveau 3 — Origin Shield (optionnel)
└── Évite le "thundering herd" sur cache miss

Niveau 4 — Stockage objet (origin)
└── Source de vérité


Headers HTTP recommandés :

http
Vidéo rendue (immutable après création)
Cache-Control: public, max-age=31536000, immutable
Content-Type: video/mp4
Accept-Ranges: bytes                    # support des range requests (seek)

Manifest HLS
Cache-Control: public, max-age=60       # court TTL (playlist peut changer)
Content-Type: application/vnd.apple.mpegurl

Segments HLS (.ts)
Cache-Control: public, max-age=31536000, immutable
Content-Type: video/mp2t

Thumbnails
Cache-Control: public, max-age=31536000, immutable
Content-Type: image/jpeg


7.4 URLs signées

Pour les vidéos privées (non publiques, preview client, rendus en attente de validation), les URLs signées limitent l'accès temporaire :

typescript
// Génération d'URL signée S3 (AWS SDK v3)
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

async function generateSignedUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600  // 1 heure par défaut
): Promise<string> {
  const client = new S3Client({ region: 'auto' }); // R2 endpoint
  
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  
  return getSignedUrl(client, command, { expiresIn });
}

// Cloudflare R2 — URL signée via Workers
// R2 supporte les URLs signées via l'API S3 compatible
// ou via Cloudflare Workers avec jwt/r2 token


Politique de signature :

Type de contenu: Preview rendu (privé)
Durée du token: 1 heure
Mécanisme: URL signée S3/R2
────────────────────────────────────────
Type de contenu: Téléchargement export
Durée du token: 15 minutes
Mécanisme: URL signée + compteur de download
────────────────────────────────────────
Type de contenu: Vidéo publique (publiée)
Durée du token: Pas de token
Mécanisme: URL publique via CDN
────────────────────────────────────────
Type de contenu: Thumbnails
Durée du token: Permanent
Mécanisme: Cache CDN, URL publique

7.5 Livraison adaptative — HLS/DASH

Pour les vidéos longues (> 10 secondes) ou servies sur des connexions variables (mobile), la livraison adaptative (streaming) offre une expérience supérieure au download progressif.

HLS (HTTP Live Streaming) — choix recommandé :


master.m3u8 (manifest principal)

1080p/playlist.m3u8
  ├── segment_0.ts (10s de vidéo)
  ├── segment_1.ts
  └── ...

720p/playlist.m3u8
  └── segments...

└── #EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
    480p/playlist.m3u8
        └── segments...


Génération HLS post-rendu (FFmpeg) :

bash
Transcodage multi-bitrate + packaging HLS en une passe
ffmpeg -i output.mp4 \
  -filter_complex "[0:v]split=3[v1][v2][v3]; \
    [v1]scale=w=1920:h=1080[v1out]; \
    [v2]scale=w=1280:h=720[v2out]; \
    [v3]scale=w=640:h=360[v3out]" \
  \
  -map "[v1out]" -c:v:0 libx264 -b:v:0 5000k -maxrate:v:0 5350k -bufsize:v:0 7500k \
  -map "[v2out]" -c:v:1 libx264 -b:v:1 2800k -maxrate:v:1 2996k -bufsize:v:1 4200k \
  -map "[v3out]" -c:v:2 libx264 -b:v:2 800k  -maxrate:v:2 856k  -bufsize:v:2 1200k \
  \
  -map a:0 -map a:0 -map a:0 -c:a aac -b:a 128k -ac 2 \
  \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_segment_filename "v%v/segment_%03d.ts" \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
  "v%v/playlist.m3u8"


Lecteur HLS côté client (hls.js) :

typescript
// Player HLS adaptatif dans le navigateur
import Hls from 'hls.js';

function initAdaptivePlayer(videoEl: HTMLVideoElement, hlsUrl: string) {
  if (Hls.isSupported()) {
    const hls = new Hls({
      // Auto-quality switching basé sur la bande passante
      abrController: {
        enabled: true,
      },
      // Buffer optimal pour démarrage rapide
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      // Start at reasonable quality
      startLevel: -1, // auto-select based on bandwidth
    });
    
    hls.loadSource(hlsUrl);
    hls.attachMedia(videoEl);
    
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoEl.play();
    });
    
    return hls;
  }
  // Safari natif (utilise le player HLS intégré)
  else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.src = hlsUrl;
  }
}


Quand utiliser HLS vs download progressif :

Critère: Durée vidéo
Download progressif: < 15s
HLS adaptatif: > 15s
────────────────────────────────────────
Critère: Usage
Download progressif: Promo court, social media
HLS adaptatif: Showcase, démo longue
────────────────────────────────────────
Critère: Latence de démarrage
Download progressif: Immédiat
HLS adaptatif: ~1-2s (buffer)
────────────────────────────────────────
Critère: Complexité infra
Download progressif: Faible
HLS adaptatif: Élevée (packaging, segments)
────────────────────────────────────────
Critère: Coût de storage
Download progressif: 1x
HLS adaptatif: 3x (multiple bitrates)
────────────────────────────────────────
Critère: Adaptation bande passante
Download progressif: Non
HLS adaptatif: Oui
────────────────────────────────────────
Critère: Seek
Download progressif: Rapide (range requests)
HLS adaptatif: Rapide (segment-level)

Recommandation : Par défaut, le download progressif pour les vidéos promo courtes (typiquement 15-40s). Réserver HLS aux cas où la bande passante est incertaine (embedded dans des pages web tierces, preview client sur mobile).

7.6 Thumbnails générés

Génération automatique de thumbnails à plusieurs moments-clés de la vidéo :

typescript
// Génération de thumbnails post-rendu
import { extractFrames } from '@remotion/renderer';

async function generateThumbnails(
  videoPath: string,
  outputPath: string
): Promise<Thumbnail[]> {
  const timestamps = [0, 0.25, 0.5, 0.75]; // relatif à la durée
  
  // Méthode 1: FFmpeg (post-rendu)
  const thumbnails = await Promise.all(
    timestamps.map(async (t, i) => {
      const thumbPath = ${outputPath}/thumb_${String(i).padStart(4, '0')}.jpg;
      await execAsync(
        ffmpeg -ss ${t} -i ${videoPath} -vframes 1  +
        -vf "scale=640:-1" -q:v 2 ${thumbPath}
      );
      return { timestamp: t, path: thumbPath };
    })
  );
  
  // Poster par défaut = frame au milieu (représentatif)
  await execAsync(
    ffmpeg -ss 0.5 -i ${videoPath} -vframes 1  +
    -vf "scale=1280:-1" -q:v 2 ${outputPath}/poster.jpg
  );
  
  return thumbnails;
}


Optimisation : Utiliser le rendu Remotion directement pour générer les thumbnails (capture de frames spécifiques sans encode vidéo complet), ce qui est plus rapide que le post-traitement FFmpeg.

7.7 Lifecycle management (TTL, archival)

Politique de lifecycle R2/S3 :

yaml
Lifecycle rules — JSON (configurable via API ou console)
Rules:
Rendus récents — accès fréquent
  - ID: RendersRecent
    Status: Enabled
    Filter:
      Prefix: renders/
    Transitions:
      - Days: 30
        StorageClass: STANDARD_IA    # accès infrequent
      - Days: 90
        StorageClass: GLACIER        # archival froid
    Expiration:
      Days: 365                       # suppression après 1 an

Assets utilisateur — rétention longue
  - ID: UserAssetsLongTerm
    Status: Enabled
    Filter:
      Prefix: assets/
    Transitions:
      - Days: 180
        StorageClass: STANDARD_IA
    Expiration:
      Days: 730                       # 2 ans

Exports temporaires — courte rétention
  - ID: TemporaryExports
    Status: Enabled
    Filter:
      Prefix: exports/
    Expiration:
      Days: 7                         # 7 jours puis suppression


Hiérarchie de stockage :


┌─────────────────────────────────────────────────────────────┐
Hot tier (STANDARD)                                           │
Rendus des 30 derniers jours — accès immédiat                │
Coût: $0.015/Go/mo (R2)                                     │
Warm tier (STANDARD_IA / R2 Infrequent Access)               │
Rendus de 30 à 90 jours — accès occasionnel                  │
Coût: $0.01/Go/mo                                            │
Cold tier (GLACIER / Archive)                                 │
Rendus de 90 à 365 jours — restoration sur demande (1-5 min) │
Coût: $0.004/Go/mo                                           │
Deleted                                                       │
Après 365 jours (ou sur action utilisateur)                   │
└─────────────────────────────────────────────────────────────┘


7.8 Intégration CDN

CloudFront (AWS) — configuration :

yaml
CloudFront Distribution (Terraform / CloudFormation conceptuel)
DistributionConfig:
  Origins:
    - Id: R2Origin
      DomainName: app-promo-studio.r2.cloudflarestorage.com
      S3OriginConfig:
        OriginAccessIdentity: origin-access-identity/cloudfront/XXXX
  DefaultCacheBehavior:
    TargetOriginId: R2Origin
    ViewerProtocolPolicy: redirect-to-https
    AllowedMethods: [GET, HEAD, OPTIONS]
    CachedMethods: [GET, HEAD]
    ForwardedValues:
      QueryString: false          # pas de query string caching
      Cookies:
        Forward: none
    DefaultTTL: 86400             # 1 jour
    MaxTTL: 31536000              # 1 an
    MinTTL: 0
    Compress: true                # gzip/brotli pour JSON manifests
    LambdaFunctionAssociations:
      # Token validation via Lambda@Edge (pour URLs privées)
      - EventType: viewer-request
        LambdaFunctionARN: arn:aws:lambda:us-east-1:...:function:auth-check
  PriceClass: PriceClass_100       # US + Europe (le moins cher)
  Enabled: true


BunnyCDN — alternative économique :

BunnyCDN est particulièrement intéressant pour la distribution vidéo car :
- Pricing : $0.01/Go (le moins cher du marché)
- Pull zones configurables en 1 clic
- Support natif du token authentication
- Edge SHIELD (origin shield intégré)
- Statistiques temps réel

typescript
// BunnyCDN — URL signée
function bunnySignedUrl(
  baseUrl: string,
  path: string,
  expiration: number,
  tokenKey: string
): string {
  const expires = Math.floor(Date.now() / 1000) + expiration;
  const hashBase = /${path}${tokenKey}${expires};
  const token = crypto
    .createHash('sha256')
    .update(hashBase)
    .digest('base64url');
  
  return ${baseUrl}/${path}?token=${token}&expires=${expires};
}


Comparaison des coûts CDN (pour 1 To/mo egress) :

CDN: CloudFront
Coût 1 To: $85
Coût 10 To: $850
Coût 100 To: $8,500
Features: Lambda@Edge, intégration AWS
────────────────────────────────────────
CDN: BunnyCDN
Coût 1 To: $10
Coût 10 To: $100
Coût 100 To: $1,000
Features: Le moins cher, token auth
────────────────────────────────────────
CDN: Cloudflare (R2)
Coût 1 To: $0
Coût 10 To: $0
Coût 100 To: $0
Features: Egress gratuit si R2
────────────────────────────────────────
CDN: Fastly
Coût 1 To: $50
Coût 10 To: $500
Coût 100 To: $5,000
Features: Edge compute, VCL

Recommandation : Cloudflare R2 + réseau Cloudflare intégré pour l'egress gratuit. BunnyCDN comme fallback ou pour des cas spécifiques (live streaming, token auth simplifié).


Section 8: Interface utilisateur

8.1 Vue d'ensemble de l'interface

L'interface est construite avec Next.js 15 (App Router), React 19 et Tailwind CSS 4. Elle suit un paradigme d'éditeur créatif (type Canva/CapCut) avec un focus sur la simplicité pour des utilisateurs non-techniques.

Layout général — 3 zones :


┌─────────────────────────────────────────────────────────────┐
TOPBAR: Logo │ Project Name │ Save │ Export │ User Avatar   │
     │                                 │                  │
LEFT    │         CENTER                  │     RIGHT        │
PANEL   │       PREVIEW AREA              │    CUSTOMIZE     │
     │                                 │    PANEL         │
Templates│     ┌─────────────────┐         │                  │
Assets   │     │                 │         │  Text content    │
Layers   │     │   Remotion      │         │  Colors          │
Scenes   │     │   Player        │         │  Timing          │
     │     │   (real-time)   │         │  Audio           │
     │     │                 │         │  Export settings │
     │     └─────────────────┘         │                  │
     │                                 │                  │
     │  ◄ ─── timeline ─── ►           │                  │
     │  ▶ Play   00:15 / 00:30         │                  │
BOTTOM: Upload zone (drag-and-drop) │ Status bar             │
└─────────────────────────────────────────────────────────────┘


8.2 Dashboard de projets

Le dashboard est la page d'accueil après login. Il présente tous les projets vidéo de l'utilisateur avec leur statut.

typescript
// app/(dashboard)/page.tsx — Next.js App Router
'use client';

export default function DashboardPage() {
  const { projects, loading } = useProjects();
  
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <DashboardHeader />
      
      {/* Quick actions */}
      <div className="flex gap-4 px-8 py-6">
        <NewProjectButton />
        <TemplateGalleryTrigger />
      </div>
      
      {/* Projects grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-8">
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            thumbnail={project.thumbnailUrl}
            status={project.lastRenderStatus}
            duration={project.duration}
            resolution={project.resolution}
            lastModified={project.updatedAt}
          />
        ))}
      </div>
    </div>
  );
}


ProjetCard — composant clé :


┌───────────────────────────────┐
┌─────────────────────────┐  │
│                          │  │
│     Thumbnail vidéo      │  │
│     (hover → preview)    │  │
│                          │  │
└─────────────────────────┘  │
                           │
Mon App Promo                 │  ← Titre
1920×1080 · 30s · MP4         │  ← Métadonnées
● Rendering 45%              │  ← Statut (ou ✓ Ready)
Modifié il y a 2h             │
[Open] [Duplicate] [Delete]   │
└───────────────────────────────┘


États de projet gérés :

Statut: Draft (brouillon)
Visuel: Badge gris "Brouillon"
Action utilisateur: Edit possible, pas de rendu
────────────────────────────────────────
Statut: Ready (prêt)
Visuel: Badge vert "Prêt"
Action utilisateur: Download, share, re-render
────────────────────────────────────────
Statut: Rendering (en cours)
Visuel: Barre de progression + %
Action utilisateur: Wait, preview des frames
────────────────────────────────────────
Statut: Error (erreur)
Visuel: Badge rouge "Erreur"
Action utilisateur: Retry, voir logs
────────────────────────────────────────
Statut: Archived (archivé)
Visuel: Badge gris foncé
Action utilisateur: Restore ou delete permanent

8.3 Galerie de templates

La galerie présente les templates disponibles, filtrables par catégorie, format et style.

typescript
// Template gallery — structure des données
interface Template {
  id: string;
  name: string;
  category: 'app-launch' | 'feature-showcase' | 'tutorial' 
          | 'testimonial' | 'social-ad' | 'logo-intro';
  formats: ('16:9' | '9:16' | '1:1')[];
  durationSeconds: number;
  thumbnailUrl: string;
  previewVideoUrl: string;      // loop gif ou mp4 court
  customizationSlots: {
    texts: TextSlot[];
    images: ImageSlot[];
    colors: ColorSlot[];
    audio: AudioSlot?;
  };
  scenes: SceneDefinition[];
  tags: string[];
  isPremium: boolean;
}


UI de la galerie :


┌─────────────────────────────────────────────────────────────┐
Templates                                  🔍 Search...      │
                                                           │
[Tous] [App Launch] [Showcase] [Social] [Tutorial] [Intro]  │
Format: [16:9 ▼]  Duration: [≤30s ▼]  Style: [Modern ▼]    │
                                                           │
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ ▶ preview│ │ ▶ preview│ │ ▶ preview│ │ ▶ preview│         │
│           │ │           │ │           │ │           │        │
│ App       │ │ Feature   │ │ Logo      │ │ Social    │        │
│ Launch    │ │ Showcase  │ │ Intro     │ │ Ad        │        │
│ 16:9 30s  │ │ 9:16 15s  │ │ 1:1 5s    │ │ 9:16 20s  │        │
│           │ │           │ │           │ │ ★ Premium │        │
└──────────┘ └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────────────────┘


Le hover sur un template déclenche un autoplay de la preview (format court loopé), ce qui aide l'utilisateur à visualiser l'animation sans cliquer.

8.4 Preview en temps réel — Remotion Player

Le composant central de l'éditeur est le Remotion Player, qui permet de prévisualiser la composition en temps réel directement dans le navigateur.

typescript
// components/editor/PreviewArea.tsx
import { Player } from '@remotion/player';
import { PromoComposition } from '@/remotion/compositions/PromoComposition';

export function PreviewArea({ project }: { project: Project }) {
  const { compositionId, inputProps, durationInFrames, fps } = project;
  
  // Dimensions adaptées au ratio sélectionné
  const dimensions = getDimensionsForRatio(project.aspectRatio);
  
  return (
    <div className="flex-1 flex items-center justify-center bg-neutral-900 rounded-xl">
      <Player
        component={PromoComposition}
        inputProps={{
          templateId: project.templateId,
          assets: project.assets,
          overrides: project.customization,
        }}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={dimensions.width}
        compositionHeight={dimensions.height}
        style={{
          width: '100%',
          maxHeight: '70vh',
        }}
        controls
        loop
        autoPlay
        clickToPlay
        doubleClickToFullscreen
        // Qualité de preview (réduit la résolution de rendu pour la fluide)
        renderLoading={() => <PreviewSkeleton />}
        errorHandling={() => <PreviewError />}
      />
    </div>
  );
}


Performance du Player :

Le Player rend la composition React dans le navigateur via un iframe isolé. Pour maintenir la fluidité :
- Preview à 50% de résolution par défaut (configurable)
- Skip frames si le navigateur ne tient pas les 30fps en temps réel
- Cache des composants statiques (images décodées, fonts chargées)

Timeline éditoriale :

La timeline permet de visualiser et ajuster le timing de chaque scène et élément animé.


┌─────────────────────────────────────────────────────────────┐
TIMELINE                                          00:15/00:30 │
┌───┬──────────────────┬──────────────────┬──────────┐      │
│   │ Scene 1           │ Scene 2           │ Scene 3  │      │
│ V │ Phone mockup      │ Feature highlight │ CTA      │      │
│   ├──────────────────┼──────────────────┼──────────┤      │
│   │ Title "My App"    │                   │ "Download│      │
│ T │ Subtitle          │                   │  Now"    │      │
│   ├──────────────────┼──────────────────┼──────────┤      │
│   │ ████████████████  │                   │          │      │
│ A │ Background music  │                   │          │      │
│   └──────────────────┴──────────────────┴──────────┘      │
│                                                             │
│  0s        5s        10s        15s        20s       30s   │
└───┬──────────┬──────────┬──────────┬──────────┬────────┘   │
▲ playhead (draggable)                                     │
└─────────────────────────────────────────────────────────────┘


typescript
// Timeline — structure
interface TimelineTrack {
  id: string;
  type: 'video' | 'text' | 'audio' | 'image';
  clips: TimelineClip[];
}

interface TimelineClip {
  id: string;
  trackId: string;
  startFrame: number;
  durationInFrames: number;
  content: ClipContent;   // référence vers l'élément de la scène
  transitions?: {
    in?: TransitionType;   // fade, slide, zoom
    out?: TransitionType;
  };
}


8.5 Panneau de personnalisation

Le panneau de droite expose tous les paramètres personnalisables du template sélectionné.

typescript
// components/editor/CustomizePanel.tsx
export function CustomizePanel({ project, onUpdate }: CustomizePanelProps) {
  const template = useTemplate(project.templateId);
  
  return (
    <div className="w-80 bg-neutral-950 border-l border-neutral-800 overflow-y-auto">
      {/* Tabs: Text | Colors | Audio | Export */}
      <Tabs defaultValue="text">
        
        {/* Tab: Textes */}
        <TabsContent value="text">
          {template.customizationSlots.texts.map(slot => (
            <TextInput
              key={slot.id}
              label={slot.label}
              value={project.customization.texts[slot.id] ?? slot.defaultValue}
              maxLength={slot.maxLength}
              onChange={(value) => onUpdate({
                ...project,
                customization: {
                  ...project.customization,
                  texts: { ...project.customization.texts, [slot.id]: value }
                }
              })}
            />
          ))}
        </TabsContent>
        
        {/* Tab: Couleurs */}
        <TabsContent value="colors">
          {template.customizationSlots.colors.map(slot => (
            <ColorPicker
              key={slot.id}
              label={slot.label}
              value={project.customization.colors[slot.id] ?? slot.defaultColor}
              presets={slot.presets}
              onChange={(color) => onUpdate({
                ...project,
                customization: {
                  ...project.customization,
                  colors: { ...project.customization.colors, [slot.id]: color }
                }
              })}
            />
          ))}
        </TabsContent>
        
        {/* Tab: Audio */}
        <TabsContent value="audio">
          <AudioTrackSelector
            value={project.customization.audio}
            onChange={(audio) => onUpdate({ ... })}
          />
          <VolumeSlider
            value={project.customization.audioVolume}
            onChange={(vol) => onUpdate({ ... })}
          />
          <UploadAudioButton />
        </TabsContent>
        
        {/* Tab: Export */}
        <TabsContent value="export">
          <ExportSettings
            resolution={project.resolution}
            format={project.format}
            quality={project.quality}
            onExport={handleExport}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}


Binding temps réel :

Chaque modification dans le panneau de personnalisation met à jour les inputProps du Player Remotion en temps réel. La composition React se re-render immédiatement, ce qui donne un feedback visuel instantané :


User type "Mon App" in text field

       ▼
onUpdate → project.customization.texts.title = "Mon App"

       ▼
PreviewArea reçoit nouvelles inputProps

       ▼
Remotion Player re-render la composition

       ▼
Le texte "Mon App" apparaît dans la preview (< 16ms)


8.6 Upload drag-and-drop

L'upload des assets (screenshots d'app, logos, audio) se fait via drag-and-drop avec un retour visuel immédiat.

typescript
// components/editor/UploadZone.tsx
import { useDropzone } from 'react-dropzone';

export function UploadZone({ onUpload }: { onUpload: (files: File[]) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
    },
    maxSize: 10 * 1024 * 1024,  // 10 Mo
    onDrop: onUpload,
  });
  
  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center transition-colors
        ${isDragActive 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-neutral-700 hover:border-neutral-500'}
      `}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <p className="text-blue-400">Drop files here...</p>
      ) : (
        <div className="space-y-2">
          <UploadIcon className="mx-auto text-neutral-500" />
          <p className="text-neutral-400">
            Glissez vos screenshots, logos ou audio
          </p>
          <p className="text-xs text-neutral-600">
            PNG, JPG, WebP (max 10Mo) · MP3, WAV
          </p>
        </div>
      )}
    </div>
  );
}


Upload flow :


1. User drops file → validation (type, taille)
2. Upload vers S3/R2 via presigned URL (upload direct client → storage)
3. Optimisation image (redimensionnement, compression WebP) — via Cloudflare Workers ou Lambda
4. Asset disponible dans le panneau gauche → drag dans la composition
5. Le Player Remotion charge l'asset et l'affiche


typescript
// Upload direct client → S3/R2 via presigned URL
async function uploadAsset(file: File, projectId: string): Promise<Asset> {
  // 1. Demander une presigned URL au backend
  const { uploadUrl, assetId, publicUrl } = await api.post('/assets/presign', {
    filename: file.name,
    contentType: file.type,
    projectId,
  });
  
  // 2. Upload direct (S3 PUT)
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  
  // 3. Confirmer l'upload
  await api.post(/assets/${assetId}/confirm);
  
  return { id: assetId, url: publicUrl, filename: file.name };
}


8.7 Export et download

Le flow d'export déclenche un rendu sur le backend (ou Lambda) et notifie l'utilisateur.

typescript
// components/editor/ExportDialog.tsx
export function ExportDialog({ project, onClose }: ExportDialogProps) {
  const [config, setConfig] = useState<ExportConfig>({
    resolution: '1920x1080',
    format: 'mp4-h264',
    quality: 'high',     // CRF 18
    audioIncluded: true,
  });
  
  const { triggerExport, status, progress, downloadUrl } = useExport();
  
  const handleExport = async () => {
    await triggerExport(project.id, config);
  };
  
  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Export vidéo</DialogTitle>
      
      {/* Configuration */}
      <div className="space-y-4">
        <SelectField
          label="Résolution"
          value={config.resolution}
          options={[
            { value: '1920x1080', label: '1080p (Full HD)' },
            { value: '3840x2160', label: '4K Ultra HD' },
            { value: '1080x1920', label: '1080p Vertical (9:16)' },
          ]}
          onChange={(v) => setConfig({ ...config, resolution: v })}
        />
        
        <SelectField
          label="Format"
          value={config.format}
          options={[
            { value: 'mp4-h264', label: 'MP4 H.264 (universel)' },
            { value: 'mp4-h265', label: 'MP4 H.265 (compressé)' },
            { value: 'webm', label: 'WebM VP9 (web)' },
          ]}
          onChange={(v) => setConfig({ ...config, format: v })}
        />
        
        <RadioGroup
          label="Qualité"
          value={config.quality}
          options={[
            { value: 'high', label: 'Haute (CRF 16) — App Store' },
            { value: 'standard', label: 'Standard (CRF 18) — Social' },
            { value: 'web', label: 'Web (CRF 22) — Streaming' },
          ]}
          onChange={(v) => setConfig({ ...config, quality: v })}
        />
      </div>
      
      {/* Progress / Result */}
      {status === 'rendering' && (
        <ProgressBar value={progress * 100} label="Rendu en cours..." />
      )}
      
      {status === 'completed' && (
        <div className="space-y-3">
          <Alert type="success">Vidéo prête !</Alert>
          <video src={downloadUrl} controls className="w-full rounded-lg" />
          <div className="flex gap-2">
            <Button as="a" href={downloadUrl} download>
              Download
            </Button>
            <CopyButton text={downloadUrl} label="Copy link" />
          </div>
        </div>
      )}
      
      {status === 'idle' && (
        <Button onClick={handleExport} className="w-full">
          Lancer le rendu
        </Button>
      )}
    </Dialog>
  );
}


8.8 Stack frontend

Technologie: Next.js 15 (App Router)
Rôle: Framework React full-stack
Justification: SSR/SSG, API routes, server components, image optimization
────────────────────────────────────────
Technologie: React 19
Rôle: UI library
Justification: Concurrent features, use() hook, transitions
────────────────────────────────────────
Technologie: Tailwind CSS 4
Rôle: Styling
Justification: Utility-first, rapid prototyping, dark mode natif
────────────────────────────────────────
Technologie: @remotion/player
Rôle: Video preview
Justification: Rendu composition React en temps réel dans le navigateur
────────────────────────────────────────
Technologie: Zustand
Rôle: State management
Justification: Léger, pas de boilerplate, idéal pour l'état de l'éditeur
────────────────────────────────────────
Technologie: TanStack Query
Rôle: Data fetching
Justification: Cache, optimistic updates, background refetch
────────────────────────────────────────
Technologie: Radix UI
Rôle: Composants accessibles
Justification: Headless, accessible, customisable avec Tailwind
────────────────────────────────────────
Technologie: Framer Motion
Rôle: Micro-interactions
Justification: Animations UI fluides (transitions, modals)
────────────────────────────────────────
Technologie: react-dropzone
Rôle: Upload drag-and-drop
Justification: API simple, validation intégrée
────────────────────────────────────────
Technologie: Lucide Icons
Rôle: Iconographie
Justification: Cohérence visuelle, tree-shaking

Architecture des routes Next.js :


app/
├── login/page.tsx
└── signup/page.tsx
├── layout.tsx              # shell avec sidebar
├── page.tsx                # dashboard projects
├── templates/page.tsx      # galerie de templates
└── settings/page.tsx
├── project/[id]/
│   ├── layout.tsx          # shell éditeur (3 panneaux)
│   ├── page.tsx            # éditeur principal
│   └── export/page.tsx     # page export dédiée
├── projects/route.ts       # CRUD projects
├── renders/route.ts        # trigger render
├── renders/[id]/route.ts   # status render
├── assets/presign/route.ts # presigned URLs
└── templates/route.ts      # list templates
└── layout.tsx                  # root layout


Section 9: Performance et scaling

9.1 Vue d'ensemble des défis

Le rendu vidéo est l'une des workloads les plus intensives : une vidéo de 30s en 1080p à 30fps représente 900 frames, chacune nécessitant un rendu React complet + capture Chromium. Sans optimisation, un seul rendu peut prendre 2-5 minutes. À l'échelle (centaines d'utilisateurs simultanés), le défi est de maintenir des temps de rendu acceptables (< 60s) tout en contrôlant les coûts.

9.2 Cache de frames

Cache des frames individuelles :

Quand un utilisateur modifie une personnalisation (texte, couleur), seule une fraction des frames change réellement. Au lieu de tout re-rendre, on peut identifier et re-rendre uniquement les frames affectées.

typescript
// Frame cache — concept d'invalidation partielle
interface FrameCache {
  // Clé: hash(templateId + inputProps + frameNumber)
  get(key: string): Buffer | null;
  set(key: string, frame: Buffer, ttl: number): void;
  invalidate(pattern: string): void;
}

// Hash des inputProps pour détecter les changements
function computePropsHash(inputProps: object): string {
  const stable = JSON.stringify(inputProps, Object.keys(inputProps).sort());
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

// Avant de rendre une frame, vérifier le cache
async function renderFrameWithCache(
  composition: AnyComposition,
  frame: number,
  inputProps: object,
  cache: FrameCache
): Promise<Buffer> {
  const hash = computePropsHash(inputProps);
  const key = ${composition.id}:${hash}:${frame};
  
  const cached = cache.get(key);
  if (cached) return cached;
  
  const frameBuffer = await renderFrame({
    composition,
    frame,
    inputProps,
  });
  
  cache.set(key, frameBuffer, 3600); // TTL 1h
  return frameBuffer;
}


Cache du bundle Remotion :

Le bundling webpack/esbuild de la composition prend 3-10 secondes. Ce bundle est identique pour tous les rendus utilisant la même version du code. Il doit être mis en cache :

typescript
// Cache du bundle par version du code
const bundleCache = new Map<string, string>(); // gitHash → bundlePath

async function getOrCreateBundle(entryPoint: string): Promise<string> {
  const gitHash = await getGitHash(); // ou version du package
  
  if (bundleCache.has(gitHash)) {
    return bundleCache.get(gitHash)!;
  }
  
  const bundlePath = await bundle({ entryPoint });
  bundleCache.set(gitHash, bundlePath);
  
  return bundlePath;
}


9.3 Rendering parallèle

Parallélisation multi-niveau :


Niveau 1 — Parallélisation intra-vidéo (frames)
└── Worker 4: frames 675-899
   Temps: ~4x plus rapide qu'un worker unique

Niveau 2 — Parallélisation inter-vidéos (jobs)
└── Isolation complète (process Chromium séparé)

Niveau 3 — Parallélisation Lambda (serverless)
└── Temps de rendu: ~10-30s même pour vidéos longues


Configuration de la concurrence (serveur dédié) :

typescript
import os from 'os';

// Détection automatique du nombre optimal de workers
function getOptimalConcurrency(): number {
  const cpuCount = os.cpus().length;
  const memGB = os.totalmem() / (1024 ** 3);
  
  // Chromium a besoin de ~1-2 Go par instance
  const maxByMemory = Math.floor(memGB / 2);
  
  // Laisser 2 CPUs pour le système + stitching FFmpeg
  const maxByCpu = Math.max(1, cpuCount - 2);
  
  return Math.min(maxByCpu, maxByMemory, 8); // cap à 8
}

// Configuration du render
const renderConfig = {
  concurrency: getOptimalConcurrency(),
  // ou: concurrency: '100%' (tous les CPUs - 1)
  maxConcurrency: 8,
};


9.4 Auto-scaling des workers

Architecture avec file de queue + workers élastiques :


                          ┌─────────────┐
API Server  │
(Fastify)   │
                          └──────┬───────┘

                          ┌──────▼───────┐
Job Queue    │
(BullMQ +    │
Redis)      │
                          └──────┬───────┘

              ┌──────────────────┼──────────────────┐
             │                   │
       ┌──────▼─────┐    ┌──────▼─────┐    ┌───────▼────┐
Worker 1   │    │ Worker 2   │    │ Worker N   │
(auto-scaled)│   │            │    │            │
Chromium    │    │ Chromium   │    │ Chromium   │
+ Remotion  │    │ + Remotion │    │ + Remotion │
       └─────────────┘    └─────────────┘    └────────────┘


Règles d'auto-scaling :

yaml
Auto-scaling — règles conceptuelles (ECS/Fargate, K8s HPA, ou Fly.io autoscaling)
scaling_rules:
  min_workers: 2              # minimum (garanti en permanence)
  max_workers: 20             # maximum (cap budgétaire)
  
  scale_up:
    # Trigger: queue depth > 5 jobs en attente
    metric: queue_depth
    threshold: 5
    action: add 2 workers
    cooldown: 30s
  
  scale_up_urgent:
    # Trigger: job en attente > 60s (SLA)
    metric: oldest_job_age
    threshold: 60s
    action: add 5 workers
    cooldown: 10s
  
  scale_down:
    # Trigger: workers inactifs pendant 5 min
    metric: idle_time
    threshold: 300s
    action: remove 1 worker
    cooldown: 60s


9.5 Cold start mitigation

Le cold start est le délai entre le démarrage d'un worker et sa disponibilité pour traiter des jobs. Pour un worker de rendu, le cold start inclut :


Cold start breakdown (worker dédié) :
└── TOTAL cold start:                    ~5-15s


Stratégies de mitigation :

1. Workers chauds (warm pool) : Maintenir 2 workers actifs en permanence, même sans trafic. Ces workers ont déjà Chromium démarré et le bundle en cache.

typescript
// Warm pool — workers idle mais prêts
class WorkerPool {
  private warmWorkers: Worker[] = [];
  private readonly minWarm = 2;
  
  async ensureWarmPool() {
    while (this.warmWorkers.length < this.minWarm) {
      const worker = await this.spawnWorker();
      await worker.preload(); // démarre Chromium + bundle
      this.warmWorkers.push(worker);
    }
  }
  
  async acquire(): Promise<Worker> {
    if (this.warmWorkers.length > 0) {
      return this.warmWorkers.pop()!;
    }
    // Pas de worker chaud → spawn à la demande (cold start)
    const worker = await this.spawnWorker();
    return worker;
  }
  
  release(worker: Worker) {
    if (this.warmWorkers.length < this.minWarm) {
      this.warmWorkers.push(worker); // remettre dans le pool
    } else {
      worker.kill(); // trop de workers, tuer
    }
  }
}


2. Pre-warming sur Lambda : Pour @remotion/lambda, le cold start est atténué par l'inflation du concurrency. On peut déclencher un warm-up périodique :

typescript
// Cron job toutes les 5 min (pic de trafic attendu)
async function warmLambdaConcurrency() {
  // Invoquer la fonction Lambda avec un payload nul
  // pour pré-chauffer l'environnement
  await lambda.invoke({
    FunctionName: 'remotion-render',
    InvocationType: 'Event',     // async
    Payload: JSON.stringify({ warmup: true }),
  }).promise();
}


3. Bundle pré-compilé et distribué : Au lieu de bundler à chaque cold start, pré-compiler le bundle et le stocker sur S3/R2. Le worker télécharge le bundle pré-compilé (~500ms) au lieu de le générer (~5s).

9.6 Queue prioritization

Tous les jobs de rendu ne sont pas égaux. Un utilisateur payant doit avoir priorité sur un utilisateur gratuit. Un rendu interactif (preview render) doit être plus rapide qu'un export final.

typescript
// BullMQ — configuration des priorités
import { Queue, Worker } from 'bullmq';

const renderQueue = new Queue('renders', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,                    // retry 3x en cas d'échec
    backoff: {
      type: 'exponential',
      delay: 5000,                  // 5s, 10s, 20s
    },
    removeOnComplete: 100,          // garder les 100 derniers complétés
    removeOnFail: 200,              // garder les 200 derniers échecs
  },
});

// Priorités (plus bas = plus prioritaire)
const PRIORITY = {
  INTERACTIVE_PREVIEW: 1,    // preview render dans l'éditeur (instant)
  PAID_EXPORT: 5,            // utilisateur payant — export final
  FREE_EXPORT: 10,           // utilisateur gratuit — export final
  BATCH_RENDER: 20,          // rendu en lot (multiple variantes)
  BACKGROUND: 50,            // tâches de fond (thumbnails, HLS)
} as const;

// Ajouter un job avec priorité
async function enqueueRender(
  projectId: string,
  config: RenderConfig,
  priority: number
) {
  await renderQueue.add(
    'render',
    { projectId, config },
    {
      priority,
      jobId: ${projectId}-${Date.now()},
    }
  );
}

// Worker — traite les jobs par priorité
const worker = new Worker('renders', async (job) => {
  const { projectId, config } = job.data;
  return await renderVideo(projectId, config, (progress) => {
    job.updateProgress(progress);
  });
}, {
  connection: redisConnection,
  concurrency: getOptimalConcurrency(),
});


Lanes de queue séparées (alternative) :

Pour une isolation plus forte, utiliser des queues séparées par priorité avec des workers dédiés :


Queue: interactive (1 worker dédié, toujours chaud)
└── Preview renders — SLA < 5s

Queue: priority (3 workers)
└── Exports payants — SLA < 60s

Queue: standard (workers partagés, auto-scalés)
└── Exports gratuits — SLA < 5 min

Queue: background (1 worker, low priority)
└── Thumbnails, HLS packaging, cleanup


9.7 Monitoring

Métriques clés à surveiller :

Métrique: Render duration (p50, p95, p99)
Outil: Prometheus histogram
Seuil d'alerte: p95 > 120s
────────────────────────────────────────
Métrique: Queue depth
Outil: BullMQ metrics
Seuil d'alerte: > 20 jobs en attente
────────────────────────────────────────
Métrique: Worker CPU usage
Outil: Node exporter
Seuil d'alerte: > 90% sustained
────────────────────────────────────────
Métrique: Worker memory usage
Outil: Node exporter
Seuil d'alerte: > 80%
────────────────────────────────────────
Métrique: Chromium crashes
Outil: Compteur custom
Seuil d'alerte: > 5/heure
────────────────────────────────────────
Métrique: Cold start frequency
Outil: Compteur custom
Seuil d'alerte: > 30% des invocations
────────────────────────────────────────
Métrique: Lambda errors
Outil: CloudWatch
Seuil d'alerte: > 1% error rate
────────────────────────────────────────
Métrique: Storage usage
Outil: R2/S3 metrics
Seuil d'alerte: > 80% du quota
────────────────────────────────────────
Métrique: CDN cache hit ratio
Outil: Cloudflare/Bunny
Seuil d'alerte: < 85%
────────────────────────────────────────
Métrique: API latency p95
Outil: APM (Sentry)
Seuil d'alerte: > 500ms

Instrumentation Prometheus :

typescript
// metrics.ts — instrumentation des workers
import { Counter, Histogram, Gauge, register } from 'prom-client';

const renderDuration = new Histogram({
  name: 'render_duration_seconds',
  help: 'Duration of video renders',
  labelNames: ['resolution', 'format', 'template'],
  buckets: [10, 20, 30, 60, 120, 180, 300, 600], // secondes
});

const queueDepth = new Gauge({
  name: 'render_queue_depth',
  help: 'Number of jobs in render queue',
  labelNames: ['priority'],
});

const chromiumCrashes = new Counter({
  name: 'chromium_crashes_total',
  help: 'Total Chromium process crashes',
  labelNames: ['worker_id'],
});

const activeWorkers = new Gauge({
  name: 'render_workers_active',
  help: 'Number of active render workers',
});

// Dans le worker
async function renderVideo(job: RenderJob) {
  const timer = renderDuration.startTimer({
    resolution: job.resolution,
    format: job.format,
    template: job.templateId,
  });
  
  try {
    activeWorkers.inc();
    const result = await doRender(job);
    return result;
  } catch (error) {
    if (isChromiumError(error)) {
      chromiumCrashes.inc({ worker_id: process.env.WORKER_ID });
    }
    throw error;
  } finally {
    timer();
    activeWorkers.dec();
  }
}

// Endpoint /metrics pour Prometheus scraping
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});


Dashboard Grafana — panels recommandés :


┌─────────────────────────────────────────────────────────────┐
RENDER SYSTEM DASHBOARD                                      │
Render Duration     │  Queue Depth                           │
p50:  p95:    │  Interactive:  Priority:         │
p99:             │  Standard:   Background: ___        │
[Histogram]         │  [Time series]                         │
Active Workers      │  Error Rate                            │
Active: /Max: │  Chromium crashes: ___/h               │
CPU: ___%  MEM: __% │  Render failures: ___%                 │
[Gauge panels]      │  [Counter + rate]                      │
Render Throughput (renders/min)                              │
[Time series — par template, par format]                    │
Cost Tracking (estimation)                                   │
Lambda invocations today:   Est. cost: $               │
└──────────────────────────────────────────────────────────────┘


9.8 Rate limiting

Limites par plan utilisateur :

typescript
// rate-limiter.ts — limites par tier
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const RATE_LIMITS = {
  free: {
    renders: { limit: 3, window: '1 d' },       // 3 rendus/jour
    previews: { limit: 30, window: '1 h' },      // 30 previews/heure
    uploads: { limit: 10, window: '1 h' },       // 10 uploads/heure
    storageMB: 500,                               // 500 Mo de stockage
  },
  pro: {
    renders: { limit: 50, window: '1 d' },       // 50 rendus/jour
    previews: { limit: 200, window: '1 h' },
    uploads: { limit: 100, window: '1 h' },
    storageMB: 5000,                              // 5 Go
  },
  enterprise: {
    renders: { limit: 500, window: '1 d' },
    previews: { limit: 1000, window: '1 h' },
    uploads: { limit: 500, window: '1 h' },
    storageMB: 50000,                             // 50 Go
  },
};

// Application via middleware Fastify
const ratelimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow,
  prefix: 'promo-studio',
});

async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.user.id;
  const tier = request.user.tier;
  const limits = RATE_LIMITS[tier];
  
  const resource = getResourceFromPath(request.url); // renders, previews...
  const config = limits[resource];
  
  const { success, reset, remaining } = await ratelimiter.limit(
    ${userId}:${resource},
    { limit: config.limit, duration: parseDuration(config.window) }
  );
  
  reply.header('X-RateLimit-Limit', config.limit);
  reply.header('X-RateLimit-Remaining', remaining);
  reply.header('X-RateLimit-Reset', reset);
  
  if (!success) {
    return reply.code(429).send({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((reset - Date.now()) / 1000),
    });
  }
}


9.9 Optimisation des assets images

Les images uploadées (screenshots, logos) peuvent être très lourdes (5-10 Mo en PNG). Avant de les passer au moteur de rendu, elles doivent être optimisées.

Pipeline d'optimisation des images :


Upload utilisateur (PNG 5Mo, 3000x4000)

       ▼
┌──────────────────┐
Validation        │  type, taille max, dimensions
└────────┬─────────┘

         ▼
┌──────────────────┐
Redimensionnement │  Multiple variantes générées
(sharp)           │  - original (pour 4K)
              │  - 1920px (pour 1080p)
              │  - 640px (pour thumbnails)
└────────┬─────────┘

         ▼
┌──────────────────┐
Compression       │  WebP pour preview (qualité 85)
(sharp/avif)      │  PNG optimisé pour rendu (lossless)
              │  JPEG pour thumbnails (qualité 80)
└────────┬─────────┘

         ▼
┌──────────────────┐
Stockage          │  Toutes les variantes sur R2/S3
└──────────────────┘


typescript
// asset-optimizer.ts — optimisation avec sharp
import sharp from 'sharp';

interface OptimizedAsset {
  original: Buffer;
  variants: {
    thumbnail: Buffer;   // 640px, JPEG q80
    standard: Buffer;    // 1920px, WebP q85
    full: Buffer;        // original size, PNG lossless
  };
}

async function optimizeImage(
  input: Buffer,
  contentType: string
): Promise<OptimizedAsset> {
  const image = sharp(input, { failOn: 'none' });
  const metadata = await image.metadata();
  
  // Limiter la taille maximale (pas besoin de >4K pour un rendu 4K)
  const maxDimension = 4096;
  let processed = image;
  if (metadata.width > maxDimension || metadata.height > maxDimension) {
    processed = image.resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  
  // Générer les variantes en parallèle
  const [thumbnail, standard, full] = await Promise.all([
    // Thumbnail — 640px JPEG (pour previews UI)
    processed.clone()
      .resize(640, 640, { fit: 'inside' })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer(),
    
    // Standard — 1920px WebP (pour rendu 1080p)
    processed.clone()
      .resize(1920, 1920, { fit: 'inside' })
      .webp({ quality: 85 })
      .toBuffer(),
    
    // Full — PNG lossless (pour rendu 4K, préserve la qualité)
    processed.clone()
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer(),
  ]);
  
  return {
    original: input,
    variants: { thumbnail, standard, full },
  };
}


Lazy loading des assets dans Remotion :

typescript
// Remotion — chargement d'assets optimisé
import { Img, staticFile, useCurrentFrame } from 'remotion';

const AppScreenshot = ({ src, style }: { src: string; style?: React.CSSProperties }) => {
  return (
    <Img
      src={src}
      style={{
        ...style,
        // Empêcher le layout shift pendant le chargement
        objectFit: 'contain',
      }}
      // loading="eager" pour les assets visibles dès la frame 0
      // (Remotion force eager loading de toute façon)
    />
  );
};

// Préchargement des assets avant le rendu
import { prefetch } from '@remotion/preload';

// Avant le rendu, précharger tous les assets
function preloadAssets(assets: Asset[]) {
  assets.forEach(asset => {
    prefetch(asset.url);
  });
}


9.10 Résumé des performances cibles

Métrique: Preview render (éditeur)
Cible: < 3s
Moyen: Cache de frames + preview basse résolution
────────────────────────────────────────
Métrique: Export 1080p 30s
Cible: < 45s
Moyen: @remotion/lambda (100+ Lambdas parallèles)
────────────────────────────────────────
Métrique: Export 4K 30s
Cible: < 90s
Moyen: Lambda + high concurrency
────────────────────────────────────────
Métrique: Export 1080p 60s
Cible: < 75s
Moyen: Lambda
────────────────────────────────────────
Métrique: Cold start worker
Cible: < 5s
Moyen: Warm pool + bundle pré-compilé
────────────────────────────────────────
Métrique: Upload image + optimisation
Cible: < 3s
Moyen: sharp streaming + upload direct S3
────────────────────────────────────────
Métrique: Cache hit ratio CDN
Cible: > 90%
Moyen: Cache headers appropriés + invalidation
────────────────────────────────────────
Métrique: Throughput max
Cible: 100+ renders simultanés
Moyen: Auto-scaling jusqu'à 20 workers


Section 10: Stack technique recommandée

10.1 Tableau récapitulatif

Couche: FRONTEND
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: Framework
Technologie: Next.js
Version: 15.x (App Router)
Justification: SSR/SSG, API routes intégrées, image optimization,
  middleware edge, écosystème React le plus mature
────────────────────────────────────────
Couche: UI Library
Technologie: React
Version: 19.x
Justification: Server Components, use() hook, concurrent rendering, le
  standard de facto
────────────────────────────────────────
Couche: Styling
Technologie: Tailwind CSS
Version: 4.x
Justification: Utility-first, JIT compiler, dark mode natif, vitesse de
  développement maximale
────────────────────────────────────────
Couche: Video Preview
Technologie: @remotion/player
Version: 4.x
Justification: Rendu composition React en temps réel dans le navigateur,
  API déclarative
────────────────────────────────────────
Couche: State management
Technologie: Zustand
Version: 5.x
Justification: Minimal (pas de provider, pas de boilerplate), parfait pour
  l'état de l'éditeur (panneau actif, config, timeline)
────────────────────────────────────────
Couche: Data fetching
Technologie: TanStack Query
Version: 5.x
Justification: Cache intelligent, optimistic updates, refetch background,
  invalidation par clé
────────────────────────────────────────
Couche: Composants UI
Technologie: Radix UI + shadcn/ui
Version: latest
Justification: Headless + accessible, customisable, pas de lock-in vendor,
  copy-paste components
────────────────────────────────────────
Couche: Animations UI
Technologie: Framer Motion
Version: 11.x
Justification: Micro-interactions fluides, layout animations, drag
  gestures
────────────────────────────────────────
Couche: Icons
Technologie: Lucide React
Version: latest
Justification: Tree-shaking, 1000+ icônes cohérentes, léger
────────────────────────────────────────
Couche: Drag & drop
Technologie: react-dropzone
Version: 14.x
Justification: API simple, validation type/taille, support touch
────────────────────────────────────────
Couche: Forms
Technologie: React Hook Form + Zod
Version: latest
Justification: Performance (uncontrolled), validation type-safe,
  intégration TypeScript
────────────────────────────────────────
Couche: BACKEND
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: Runtime
Technologie: Node.js (ou Bun)
Version: 22.x LTS (Node) / 1.2.x (Bun)
Justification: Node = écosystème mature, compatibilité Remotion native.
  Bun = plus rapide, startup time réduit, mais compatibilité à valider
────────────────────────────────────────
Couche: Framework API
Technologie: Fastify
Version: 5.x
Justification: 2-3x plus rapide qu'Express, plugin system, validation JSON
  Schema intégrée, TypeScript first-class
────────────────────────────────────────
Couche: ORM
Technologie: Prisma
Version: 6.x
Justification: Type-safe, migrations versionnées, query builder intuitif,
  support PostgreSQL natif
────────────────────────────────────────
Couche: Validation
Technologie: Zod
Version: 3.x
Justification: Schema validation partagée frontend/backend, inférence
  TypeScript, intégration tRPC/Fastify
────────────────────────────────────────
Couche: Auth
Technologie: Better Auth (ou Lucia)
Version: latest
Justification: Auth moderne, sessions, OAuth (Google, Apple), RBAC,
  intégration DB, moins de boilerplate que NextAuth
────────────────────────────────────────
Couche: MOTEUR DE RENDU
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: Core
Technologie: Remotion
Version: 4.x
Justification: Le seul framework de rendu vidéo programmatique React. Pas
  d'alternative équivalente dans l'écosystème
────────────────────────────────────────
Couche: Renderer
Technologie: @remotion/renderer
Version: 4.x
Justification: API programmatique pour le rendu headless, contrôle total
  (CRF, codec, concurrency)
────────────────────────────────────────
Couche: Lambda
Technologie: @remotion/lambda
Version: 4.x
Justification: Rendu serverless à l'échelle (100-200 Lambdas parallèles),
  pay-per-use, pas de gestion d'infra
────────────────────────────────────────
Couche: Bundler
Technologie: @remotion/bundler
Version: 4.x
Justification: Bundle webpack de la composition, mis en cache par version
────────────────────────────────────────
Couche: Preload
Technologie: @remotion/preload
Version: 4.x
Justification: Préchargement des assets avant le rendu, réduit les frames
  manquantes
────────────────────────────────────────
Couche: Headless browser
Technologie: Chromium (via @remotion/renderer)
Version: bundled
Justification: Chromium est inclus/managé par Remotion, pas d'installation
  séparée
────────────────────────────────────────
Couche: Image processing
Technologie: sharp
Version: 0.33.x
Justification: Le plus rapide pour le redimensionnement/compression
  (libvips natif), 10-50x plus rapide que JIMP
────────────────────────────────────────
Couche: Video post-proc
Technologie: FFmpeg (via fluent-ffmpeg)
Version: 7.x
Justification: Packaging HLS, transcodage multi-bitrate, extraction
  thumbnails, concaténation
────────────────────────────────────────
Couche: QUEUE / WORKERS
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: Queue
Technologie: BullMQ
Version: 5.x
Justification: Queue Redis persistante, priorités, retries, backoff,
  delayed jobs, dashboard (Bull Board)
────────────────────────────────────────
Couche: Redis
Technologie: Redis (ou Upstash)
Version: 7.x / serverless
Justification: Store pour BullMQ + rate limiting + cache temporaire.
  Upstash = serverless, pay-per-request, idéal pour démarrer
────────────────────────────────────────
Couche: Worker runtime
Technologie: Node.js child_process / worker_threads
Version: 22.x
Justification: Isolation des renders (un process Chromium par worker),
  crash isolation
────────────────────────────────────────
Couche: STOCKAGE
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: Stockage objet
Technologie: Cloudflare R2
Version: —
Justification: Egress gratuit (avantage massif pour distribution vidéo),
  S3-compatible, $0.015/Go/mo
────────────────────────────────────────
Couche: Alternative
Technologie: AWS S3
Version: —
Justification: Si déjà sur AWS, intégration CloudFront native. Egress
  coûteux ($0.09/Go)
────────────────────────────────────────
Couche: CDN
Technologie: Cloudflare (intégré R2)
Version: —
Justification: Egress gratuit, réseau global anycast, cache rules, Workers
  pour transformation à l'edge
────────────────────────────────────────
Couche: Alternative CDN
Technologie: BunnyCDN
Version: —
Justification: $0.01/Go (le moins cher), token auth simple, bon pour
  fallback ou volumes massifs
────────────────────────────────────────
Couche: BASE DE DONNÉES
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: DB principale
Technologie: PostgreSQL
Version: 16.x
Justification: ACID, JSONB (config de projets), full-text search,
  extension pgvector (embeddings), maturité
────────────────────────────────────────
Couche: DB hosting
Technologie: Neon (ou Supabase)
Version: serverless
Justification: Branching (DB preview par git branch), auto-scaling, cold
  start < 1s, free tier généreux
────────────────────────────────────────
Couche: Cache
Technologie: Redis (Upstash)
Version: serverless
Justification: Cache de sessions, rate limiting, BullMQ, cache de frames
  metadata
────────────────────────────────────────
Couche: MONITORING
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: Métriques
Technologie: Prometheus + Grafana
Version: latest
Justification: Standard de l'industrie, query language PueroML, alerting,
  dashboards custom
────────────────────────────────────────
Couche: Alternative managée
Technologie: Grafana Cloud (ou Axiom)
Version: —
Justification: Pas de gestion d'infra Prometheus, free tier, intégration
  Lambda/Cloudflare
────────────────────────────────────────
Couche: Error tracking
Technologie: Sentry
Version: latest
Justification: Capture erreurs frontend + backend + Chromium crashes,
  source maps, performance monitoring
────────────────────────────────────────
Couche: Logs
Technologie: Axiom (ou Logtail)
Version: —
Justification: Logs structurés, query rapide, intégration Vercel/Lambda,
  meilleur rapport qualité/prix que Datadog pour débuter
────────────────────────────────────────
Couche: Uptime
Technologie: BetterStack (ou UptimeRobot)
Version: —
Justification: Monitoring endpoint, alerting Slack/Discord, status page
  publique
────────────────────────────────────────
Couche: INFRASTRUCTURE
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: Frontend hosting
Technologie: Vercel
Version: —
Justification: Déploiement Next.js natif, edge functions, preview
  deployments par PR, image optimization intégrée
────────────────────────────────────────
Couche: Render workers
Technologie: AWS Lambda (@remotion/lambda)
Version: —
Justification: Scale automatique à des centaines d'instances parallèles,
  pay-per-use, pas de gestion de serveurs
────────────────────────────────────────
Couche: Alternative workers
Technologie: Fly.io (ou Render)
Version: —
Justification: Si Lambda trop cher à grande échelle : machines dédiées
  avec auto-scaling, GPU optionnel
────────────────────────────────────────
Couche: Container registry
Technologie: GitHub Container Registry
Version: —
Justification: Gratuit, intégré au workflow GitHub Actions
────────────────────────────────────────
Couche: CI/CD
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: CI/CD
Technologie: GitHub Actions
Version: —
Justification: Gratuit pour public, matrix builds, cache, secrets,
  intégration native GitHub
────────────────────────────────────────
Couche: Déploiement frontend
Technologie: Vercel CLI (via GitHub Actions)
Version: —
Justification: Auto-deploy sur push main, preview sur PR, production
  deploy manuel ou auto
────────────────────────────────────────
Couche: Déploiement Lambda
Technologie: @remotion/lambda deploy (via CI)
Version: —
Justification: Mise à jour du bundle Remotion sur Lambda, versioning des
  fonctions
────────────────────────────────────────
Couche: SÉCURITÉ
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: Secrets management
Technologie: Doppler (ou AWS Secrets Manager)
Version: —
Justification: Centralisation des secrets, rotation, sync vers
  Vercel/Lambda/CI
────────────────────────────────────────
Couche: API security
Technologie: helmet + cors + rate limiting
Version: —
Justification: Headers de sécurité, CORS strict, rate limiting par IP/user
────────────────────────────────────────
Couche: Content security
Technologie: CSP strict + SRI
Version: —
Justification: Content Security Policy, Subresource Integrity, protection
  XSS
────────────────────────────────────────
Couche: DEV EXPERIENCE
Technologie:
Version:
Justification:
────────────────────────────────────────
Couche: Package manager
Technologie: pnpm
Version: 9.x
Justification: Installation rapide, workspace monorepo, disk space
  efficient
────────────────────────────────────────
Couche: TypeScript
Technologie: TypeScript
Version: 5.7+
Justification: Type safety de bout en bout, stricte mode, inférence
  Prisma/Zod
────────────────────────────────────────
Couche: Linting
Technologie: ESLint + Biome (ou Prettier)
Version: latest
Justification: Linting + formatage. Biome = rapide (Rust), remplace
  ESLint+Prettier
────────────────────────────────────────
Couche: Testing
Technologie: Vitest + Playwright
Version: latest
Justification: Vitest pour unit/integration, Playwright pour E2E (test du
  Player Remotion, export flow)

10.2 Architecture de déploiement cible


┌──────────────────────────────────────────────────────────────────────┐
                   UTILISATEUR (Browser)                           │
└──────────────────────────────┬───────────────────────────────────────┘

HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
CLOUDFLARE (DNS + CDN + WAF)                                         │
├── Static assets (cache 1 an, immutable)                           │
├── HLS segments (cache 1 an)                                       │
└── Dynamic API (pas de cache)                                      │
└──────────────┬───────────────────────────────────┬───────────────────┘
                               │
               ▼                                    ▼
┌──────────────────────────┐         ┌──────────────────────────────┐
VERCEL (Next.js 15)      │         │  CLOUDFLARE R2                │
                      │         │  (Storage Objet)              │
├── App Router (SSR/SSG) │         │                               │
├── API Routes           │         │  ├── /renders (vidéos)        │
├── @remotion/player     │         │  ├── /assets (uploads)        │
└── Dashboard + Editor   │         │  ├── /thumbnails              │
└────────────┬──────────────┘         │  └── /hls (segments)          │
                    └──────────────────────────────┘
POST /renders
             ▼
┌──────────────────────────────────────────────────────────────────────┐
REDIS (Upstash)                                                      │
├── BullMQ (render queue + priorities)                              │
├── Rate limiting (Upstash Ratelimit)                               │
└── Session cache                                                   │
└──────────────┬───────────────────────────────────────────────────────┘

Job: { projectId, config, priority }
               ▼
┌──────────────────────────────────────────────────────────────────────┐
AWS LAMBDA (@remotion/lambda)                                        │
                                                                  │
├── Lambda render (auto-scalé 1→200 instances)                     │
│   ├── Chromium headless                                           │
│   ├── @remotion/renderer (frame capture)                         │
│   └── FFmpeg (stitching + encode)                                 │
│                                                                   │
└── Lambda post-proc (thumbnails, HLS packaging)                   │
  └── FFmpeg + sharp                                             │
└──────────────┬───────────────────────────────────────────────────────┘
Upload MP4/WebM
               ▼
┌──────────────────────────────────────────────────────────────────────┐
CLOUDFLARE R2 (cf. ci-dessus) — stockage final des rendus           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
SERVICES TRANSVERSES                                                 │
                                                                  │
POSTGRESQL (Neon)              SENTRY (error tracking)              │
├── Users & auth               ├── Frontend errors                  │
├── Projects                   ├── Backend errors                   │
├── Renders (metadata)         └── Chromium crashes                 │
├── Assets (metadata)                                               │
└── Billing                                                        │
                                                                 │
GRAFANA CLOUD (métriques)      DOPPLER (secrets)                    │
├── Render duration            ├── API keys                         │
├── Queue depth                ├── DB credentials                   │
└── Worker health              └── Sync vers Vercel/Lambda          │
└──────────────────────────────────────────────────────────────────────┘


10.3 Coûts estimés (mensuels, estimation grossière)

Phase 1 — MVP (jusqu'à 100 utilisateurs actifs) :

| Service              | Usage estimé                       | Coût/mo    |
|----------------------|------------------------------------|------------|
| Vercel (Hobby/Pro)   | 1 app, previews                    | $0-20      |
| Cloudflare R2        | 50 Go stockage                     | $0.75      |
| Upstash Redis        | 10K commands/day                   | $0         |
| Neon Postgres        | 0.5 Go, branchless                 | $0         |
| AWS Lambda (renders) | 500 renders/mo (~5000 invocations) | ~$15-30    |
| Sentry               | Developer plan                     | $0         |
| Grafana Cloud        | Free tier                          | $0         |
| Domaine              | 1 domaine                          | $1         |
| Total Phase 1        |                                    | ~$20-55/mo |

Phase 2 — Growth (1,000 utilisateurs actifs) :

| Service             | Usage estimé           | Coût/mo      |
|---------------------|------------------------|--------------|
| Vercel Pro          | Bandwidth + serverless | $20          |
| Cloudflare R2       | 500 Go stockage        | $7.50        |
| Upstash Redis       | Pay-as-you-go          | $5           |
| Neon Postgres       | Pro plan               | $19          |
| AWS Lambda          | 5000 renders/mo        | $150-300     |
| BunnyCDN (fallback) | 500 Go egress          | $5           |
| Sentry              | Team plan              | $26          |
| Grafana Cloud       | Pro plan               | $0-50        |
| BetterStack         | Uptime monitoring      | $0-20        |
| Total Phase 2       |                        | ~$250-475/mo |

Phase 3 — Scale (10,000+ utilisateurs) :

| Service              | Coût/mo (estimé)                |
|----------------------|---------------------------------|
| Vercel Enterprise    | Sur devis                       |
| Cloudflare R2 (5 To) | $75                             |
| Upstash Redis        | $30-50                          |
| Neon/Supabase        | $69-150                         |
| AWS Lambda           | $1,500-3,000 (volume rendering) |
| CDN (Bunny + CF)     | $50-100                         |
| Sentry Business      | $80                             |
| Monitoring           | $100                            |
| Total Phase 3        | ~$2,000-3,500/mo                |

Le coût dominant en scale est le rendu Lambda. À ce stade, migrer vers des workers dédiés (Fly.io machines avec GPU, ou EC2 spot instances) peut réduire les coûts de 40-60%.

10.4 Roadmap d'implémentation recommandée


Phase 1 — MVP (4-6 semaines)
└── Monitoring minimal (Sentry)

Phase 2 — Production (4-6 semaines supplémentaires)
└── Grafana + alerting

Phase 3 — Scale (ongoing)
└── Templates marketplace


10.5 Risques techniques et mitigations

Risque: Lambda timeout (max 15 min) sur vidéos longues
Probabilité: Moyenne
Impact: Élevé
Mitigation: Split en chunks, ou migrer vers workers dédiés pour vidéos > 3
  min
────────────────────────────────────────
Risque: Coût Lambda explosif à grande échelle
Probabilité: Élevée
Impact: Élevé
Mitigation: Monitoring coûts + alerting budget + fallback workers dédiés
────────────────────────────────────────
Risque: Chromium instable sous charge
Probabilité: Moyenne
Impact: Moyen
Mitigation: Retry automatique, health check workers, kill & restart
────────────────────────────────────────
Risque: Cold start dégrade l'UX
Probabilité: Moyenne
Impact: Moyen
Mitigation: Warm pool + bundle pré-compilé + preview client-side
────────────────────────────────────────
Risque: Breaking change Remotion (majeure)
Probabilité: Faible
Impact: Élevé
Mitigation: Pin version, tests E2E, migration plan avant upgrade
────────────────────────────────────────
Risque: Limite de stockage R2/S3
Probabilité: Faible
Impact: Faible
Mitigation: Lifecycle rules, archival Glacier, cleanup automatique