# App Promo Studio

Studio de génération automatique de vidéos promotionnelles à partir de screenshots d'apps.

## Stack

- **Frontend** : React + Vite + TailwindCSS → Vercel
- **Backend** : Supabase (Auth, DB, Storage)
- **Rendu vidéo** : Remotion (React-based)
- **Formats** : Horizontal (16:9) + Vertical (9:16)

## Structure

```
app-promo-studio/
├── src/                    # Frontend React
│   ├── components/         # UI components
│   ├── pages/              # Pages (editor, dashboard, templates)
│   ├── store/              # Zustand state
│   ├── lib/                # Supabase client, utils
│   └── hooks/              # Custom hooks
├── remotion/               # Compositions vidéo Remotion
│   ├── compositions/       # Scènes animées
│   ├── components/         # Composants vidéo réutilisables
│   ├── templates/          # Templates de vidéos promo
│   └── Root.tsx            # Entry point Remotion
├── supabase/               # Backend
│   ├── migrations/         # SQL migrations
│   ├── functions/          # Edge functions
│   └── config.toml         # Config Supabase
├── render.mjs              # Script de rendu local
├── ARCHITECTURE.md         # Architecture détaillée (Kimi K3)
└── RESEARCH.md             # Recherche comparative (Kimi K3)
```

## Quick Start

```bash
# Install deps
npm install

# Frontend dev server
npm run dev

# Remotion studio (édition vidéo)
npm run remotion:dev

# Render video
npm run remotion:render
```

## Déploiement

- **Frontend** : `vercel deploy --prod`
- **Backend** : Supabase dashboard
- **Rendu** : Remotion Cloud Run (payant) ou local
