# App Promo Studio V2 — Refonte complète

## Diagnostic V1 (problèmes identifiés)

### Architecture
- **Pipeline fragmenté** : 22 scripts qui marchent en isolation, pas d'orchestrateur
- **UI déconnectée** : Magic.tsx (27KB) ne pilote pas le vrai pipeline
- **Backend Express** existe mais n'est pas utilisé en pratique
- **Pas de preview temps réel** : on rend à l'aveugle puis on vérifie après

### Moteur de rendu
- AnimatedScene (3D 10-couches) existe mais n'est pas la composition par défaut
- ScreencastScene existe mais n'est jamais utilisé dans le pipeline
- Les transitions causent des "trous noirs" (documenté dans le skill mais pas fixé partout)
- Pas de sync voix off ↔ scènes

### Qualité
- Pas de boucle QA automatique en pratique (le script existe mais n'est jamais appelé)
- Le pre-render analysis existe mais n'alimente pas le storyboard
- Auto-fix existe mais pas câblé

## Architecture V2

```
┌─────────────────────────────────────────────────┐
│                    STUDIO UI                     │
│  React + Zustand · Real-time Remotion preview    │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  SOURCE  │→│ STORYBOARD│→│    PREVIEW       │ │
│  │ URL/Repo │ │ Editable  │ │ Remotion Player  │ │
│  │ Upload   │ │ Drag-drop │ │ Live @30fps      │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│       │              │               │           │
│       ▼              ▼               ▼           │
│  ┌──────────────────────────────────────────────┐│
│  │            PIPELINE ENGINE                    ││
│  │  Node.js orchestrator (state machine)         ││
│  │                                               ││
│  │  capture → analyze → storyboard →             ││
│  │  voice → render → QA → auto-fix → re-render   ││
│  └──────────────────────────────────────────────┘│
│                      │                           │
│                      ▼                           │
│  ┌──────────────────────────────────────────────┐│
│  │              OUTPUT                           ││
│  │  MP4 · WebM · GIF · Vertical · Square         ││
│  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## Modules à construire

### 1. Pipeline Engine (`src/lib/pipeline-v2.ts`)
State machine qui orchestre tout :
- `IDLE → CAPTURING → ANALYZING → STORYBOARDING → VOICE → RENDERING → QA → DONE`
- WebSocket pour progress streaming vers l'UI
- Retry automatique sur échec
- Chaque étape est un module isolé et testable

### 2. Real-time Preview (`src/components/PreviewCanvas.tsx`)
- Intégration `@remotion/player` dans l'UI
- Preview live pendant l'édition du storyboard
- Change un texte → voir le résultat immédiatement
- Pas besoin de render pour preview

### 3. Storyboard Editor V2 (`src/pages/StoryboardEditor.tsx`)
- Timeline visuelle (type Premiere/CapCut)
- Drag-drop pour réordonner les scènes
- Édition inline du texte (caption, subtitle)
- Choix du mode par scène (Cinematic / Screencast)
- Focal point picker (cliquer sur l'image → point de zoom)
- Choix de l'animation Ken Burns par scène

### 4. Voice Studio (`src/components/VoiceStudio.tsx`)
- Éditeur de script texte → voix
- Choix voix (Henri/Denise/ custom)
- Speed control
- Preview audio immédiat
- Waveform visualisation
- Sync markers (timestamp par scène)

### 5. Render Queue (`src/lib/renderQueue.ts`)
- Queue de jobs (multiple formats : 16:9, 9:16, 1:1)
- Progress tracking
- Auto-QA après chaque render
- Auto-fix loop (max 3 iterations)
