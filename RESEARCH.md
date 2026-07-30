# Recherche : Génération Vidéo Programmatique & SaaS Promo Studio

> **Source** : Kimi K3 (`k3-256k` via `hermes chat`) — 3 requêtes, 30 juillet 2026
> **Objectif** : Comparer les approches de génération vidéo et définir la stack d'un SaaS de création de vidéos promo pour apps mobiles.

---

## Question 1 — Comparatif des 3 approches de génération vidéo

> *« Compare en détail les 3 principales approches pour générer des vidéos programmatiquement depuis du code: Remotion (React), FFmpeg pur, et APIs cloud (Shotstack/Creatomate). Avantages, inconvénients, coûts, qualité, vitesse de rendu. »*

### 1. Remotion (React-based)

**Principe :** Tu écris des composants React. Chaque frame est rendue via headless Chromium. Remotion orchestre le screenshot frame-par-frame puis assemble en MP4/WebM via FFmpeg sous le capot.

**Avantages :**
- Tout en code React/TS — versionnable, testable, réutilisable
- Contrôle total : animations via `interpolate()`, `spring()`, CSS, SVG
- Preview en temps réel dans le navigateur (Remotion Studio)
- Aucune limite créative si tu maîtrises React
- Écosystème riche : `@remotion/player`, `@remotion/lambda` (render cloud AWS)
- Data-driven : fetch API → props → vidéo dynamique trivial
- Open source (licence MIT pour le core)
- Hot reload, dev experience excellente

**Inconvénients :**
- Licence payante obligatoire au-delà de l'usage personnel/éducatif (company license requise si >3 employés ou usage commercial)
- Courbe d'apprentissage : penser en « frames » pas en « secondes » (calculs `fps × durationInFrames`)
- Rendu LENT : Chromium screenshot par screenshot (~30s pour 10s en 1080p)
- Consomme beaucoup de RAM/CPU (Chromium headless × parallélisme)
- Pas de templates tout prêts — tout à construire de zéro
- Dépendance Chrome/Chromium installé

**Coûts :**
- Licence : ~$15/mois (individuel) ; Company : $100/mois+ (Pro/Business)
- Lambda rendering : coût AWS (~$0.01–0.05 par vidéo selon durée) + stockage S3
- Self-hosted : gratuit si usage perso, sinon licence

**Qualité :** Excellente. 1080p/4K. Tout ce que le web peut faire (CSS, SVG, Lottie, canvas, WebGL).

**Vitesse de rendu :** Lente en local. Avec `@remotion/lambda` : parallélisation massive sur AWS Lambda, une vidéo 60s rendue en ~15–30s. Très scalable.

**Idéal pour :** Développeurs React qui veulent du data-driven complexe, automatisation à grande échelle, motion design programmatique.

---

### 2. FFmpeg pur (CLI + scripting)

**Principe :** FFmpeg est un toolkit de manipulation vidéo en CLI. Tu programmes en Python/Bash en générant des commandes FFmpeg : concat, overlay, fade, drawtext, filtergraph complexe.

**Avantages :**
- Gratuit, open source (GPL/LGPL), aucune licence
- Universel : présent sur tous les serveurs Linux, Docker images
- Extrêmement rapide pour transcodage/concat/overlay simple
- Léger en ressources (pas de navigateur headless)
- Pas de dépendance lourde (pas de Node, pas de Chromium)
- Peut streamer (RTMP, HLS), capturer, enregistrer
- Maîtrisé, c'est l'outil le plus puissant du marché

**Inconvénients :**
- Pas pensé pour « créer » de la vidéo de zéro — c'est un manipulateur
- Syntaxe des filtergraphs infernale :
  ```
  [0:v]drawtext=fontfile=...:text='Hello':x=10:y=10[v1];
  [v1][1:v]overlay=eof_action=repeat[v2]...
  ```
- Animations complexes = enfer (calculer x/y/t par frame via expressions)
- Texte : `drawtext` limité (pas de wrap auto, pas de rich text, pas de multi-font)
- Pas de preview — tu rends, tu regardes, tu ajustes
- Pas de notion de « scènes » ou « timeline » structurée
- Debug difficile : erreur cryptique ou vidéo corrompue

**Coûts :** 0€. Truly free. GPL/LGPL.

**Qualité :** Excellente pour transcodage/overlay. Limitée pour la création (pas de motion design fluide sauf via expressions math brutes).

**Vitesse de rendu :** La plus rapide des 3 pour des tâches simples. GPU accélération possible (NVENC, VideoToolbox sur Mac). Une vidéo 10s avec overlays : 1–3 secondes.

**Idéal pour :** Post-production automatisée (watermark, concat, versions multiples, extraction de frames), pipelines backend à grande échelle, budget zéro.

---

### 3. APIs Cloud (Shotstack / Creatomate)

**Principe :** Tu envoies un JSON décrivant ta vidéo (timeline, clips, texte, overlays, transitions) via API REST. Le cloud rend et te retourne une URL.

**Avantages :**
- Zéro infrastructure — pas de serveur, pas de Chromium, pas de FFmpeg
- Templates visuels : éditeurs drag-and-drop (Creatomate surtout)
- REST API simple : POST un JSON, GET le résultat
- Rendu rapide et scalable (cluster GPU cloud)
- SDKs disponibles (Node, Python, PHP, Ruby)
- Webhooks pour async rendering
- Bon pour équipes non-dev (le marketing peut créer les templates)
- Transitions, effets, animations pré-construits

**Inconvénients :**
- Coût récurrent par vidéo (pricing au volume)
- Vendor lock-in total : tes templates sont dans leur système
- Moins de contrôle créatif que Remotion (limité à leurs effets)
- Latence réseau + queue de rendu (5–30s par vidéo selon charge)
- Dépendance externe : si l'API tombe, tu ne produis rien
- Pas de rendering local/offline
- Debug : si le rendu est mauvais, difficile d'inspecter

**Coûts (approximatifs, à vérifier) :**

| Service | Free tier | Plans | Facturation |
|---------|-----------|-------|-------------|
| **Shotstack** | Crédits au démarrage | Starter ~$40/mois → Business ~$200/mois → Enterprise | ~$0.05–0.10/min de vidéo rendue |
| **Creatomate** | Essai limité | Starter ~$50/mois → Pro ~$200/mois → Enterprise | Par vidéo ou minute rendue |

**Qualité :** Bonne. 1080p standard, 4K sur plans supérieurs. Limitée par les effets/transitions de la plateforme.

**Vitesse de rendu :** Rapide côté cloud (GPU clusters), mais latence réseau + queue. Une vidéo 30s rendue en 10–20s.

**Idéal pour :** Volume sans gérer d'infra, cas marketing/social media, SaaS sans expertise vidéo interne, templates éditables par non-devs.

---

### Tableau récapitulatif

| Critère | Remotion | FFmpeg pur | API Cloud |
|---------|----------|------------|-----------|
| Langage | React/TS | CLI + Python/Bash | REST/JSON |
| Coût licence | $15–100+/mois | 0€ | $40–200+/mois |
| Coût par vidéo | AWS Lambda ~$0.01 | 0€ | $0.05–0.10/min |
| Qualité max | 4K, full web | 4K, natif | 1080p/4K plans+ |
| Vitesse rendu local | Lent (Chromium) | Très rapide | N/A (cloud) |
| Vitesse cloud | Rapide (Lambda) | N/A | Rapide + queue |
| Learning curve | Moyenne (React) | Difficile | Facile |
| Flexibilité | Très haute | Haute mais brut | Moyenne |
| Data-driven | Natif (props) | DIY (scripts) | Natif (JSON) |
| Templates visuels | Non (code) | Non | Oui |
| Offline | Oui | Oui | Non |
| Vendor lock-in | Faible | Aucun | Fort |
| **Best for** | Devs React, data-driven | Pipelines batch, post-prod auto | Marketing, SaaS, volume |

### Recommandation selon le cas

- **Vidéos marketing/promo personnalisées** → **Remotion** est le meilleur fit si tu maîtrises React. Data-driven trivial, Lambda rendering pour la scalabilité. Licence company ~$100/mois mais 0 coût infra si Lambda.
- **Traitement batch lourd** (concat, watermark, convertir) → **FFmpeg pur**, gratuit, rapide, fiable.
- **Déléguer à une équipe non-dev** → **Creatomate** avec templates visuels éditables.

---

## Question 2 — Studio de vidéos promo automatisées : Best Practices 2025

> *« Quelles sont les meilleures pratiques en 2025 pour créer un studio de vidéos promo automatisées (style Product Hunt launch, App Store preview)? Pipeline complet: ingestion screenshots → animations → transitions → export MP4. »*

### 1. Architecture du pipeline (3 composants)

```
  Screenshots (4-8)
       │
       ▼
  storyboard.json  ◄── déclaration: image, durée, animation, texte
       │
       ├── gen_overlays.py  ──►  PNG transparents (texte via PIL)
       │
       └── render.mjs  ──►  ffmpeg par scène  ──►  xfade concat  ──►  promo.mp4
```

Pas de GPU nécessaire. ffmpeg + Python/PIL + Node suffisent.

### 2. Règles de composition

- **Format de sortie :** 1920×1080 (16:9) — standard Product Hunt / web
- **Durée :** 20–30s idéale (6 scènes × 3–5s)
- **Transitions :** xfade crossfade (0.5s overlap)

**Effet Ken Burns** (zoom/pan progressif) sur chaque screenshot :
- `zoom_in_center` : accentue une feature au centre
- `pan_right_zoom` : lecture naturelle gauche → droite
- `zoom_to_detail` : focus sur un élément précis
- `zoom_out` : révélation d'ensemble
- `fade_out_zoom` : clôture

**Background blur :** le screenshot est letterboxé au centre (net), avec une version floutée (`gblur sigma=30`) qui remplit le 16:9. Effet « pro » style Linear/Vercel.

### 3. Best practices par étape

**Ingestion :**
- Capturer 4–8 screenshots couvrant les key features
- Préférer 16:9 natif (sinon letterbox automatique)
- 4K si possible (zoom net), sinon upscale ComfyUI ESRGAN avant composite

**Animations :**
- `zoom_from`/`zoom_to` : 1.0 = pas de zoom, 1.5 = +50% d'agrandissement
- Garder le zoom subtil (1.1–1.3) pour ne pas pixeliser
- Durée `zoompan` = `floor(duration * fps)` frames — sinon frames gelées

**Text overlays :**
- ⚠️ NE PAS utiliser `ffmpeg drawtext` (Homebrew l'omet souvent — pas de libfreetype)
- Utiliser PIL (`gen_overlays.py`) : PNG transparent avec ombre + bordure
- Police : `/System/Library/Fonts/Supplemental/Arial Bold.ttf` (macOS)
- Position configurable : center/top/bottom × left/center/right

**Transitions :**
- `xfade` entre chaque scène, `offset = durée cumulée - durée transition`
- ⚠️ L'offset xfade est relatif au TIMELINE du 1er input, pas de la scène
- Après chaque xfade : durée output `-= transition_duration`

**Export :**
- H.264, 30fps, `yuv420p` pour compatibilité maximale
- Bitrate adaptatif selon plateforme

### 4. Spécifique App Store Preview (Apple)

- Format : 886×1920 (6.7″ iPhone) ou 1200×1600 (9:12)
- Durée : 15–30s max
- Pas de texte superflu (Apple rejette si trop de texte)
- Préférer 3–5 features clés
- Le pipeline s'adapte : changer la résolution de sortie dans `render.mjs`

### 5. Spécifique Product Hunt / Web

- Format : 1920×1080 ou vertical 1080×1920 (selon plateforme)
- Texte overlay lisible : titre + sous-titre par scène
- **Hook :** la première scène doit accrocher en 2s
- **CTA final :** logo + tagline

### 6. Pièges à éviter (validés en pratique)

- `drawtext` ffmpeg absent sur Homebrew → PIL obligatoire
- `zoompan d=` mal calculé → frames gelées ou troncature
- `xfade offset` mal calculé → vidéo 7s au lieu de 21s
- Fonts PIL : utiliser des chemins absolus (`/System/Library/Fonts/...`)

### 7. Améliorations avancées

| Fonctionnalité | Technologie |
|----------------|-------------|
| Auto-capture URL | Puppeteer (navigate, scroll, screenshot) |
| Storyboard IA | Vision model analyse screenshots → texte auto |
| Typographie kinetic | Remotion (word-reveal, typewriter) |
| Musique de fond | MusicGen / Suno (royalty-free) |
| Voiceover | TTS (walkthrough narré) |
| Upscale 4K | ComfyUI ESRGAN (zoom net) |
| Interface web | Upload + render (pour non-techs) |

### 8. Pourquoi pas ComfyUI / Remotion directement ?

- **ComfyUI** → génère des images par diffusion, mauvais pour compositing structuré
- **Remotion** → excellent mais lourd (projet Node complet + Chromium render)
- La stack **ffmpeg + PIL + Node** = 10s pour 20s de vidéo, n'importe quelle machine, no GPU

---

## Question 3 — Stack technique recommandée pour un SaaS

> *« Pour un SaaS de génération de vidéos promo, quelle stack technique recommandes-tu? Frontend, backend, rendu (local vs cloud), stockage, pricing model. Sois spécifique avec les technologies. »*

### 1. Frontend

- **Next.js 14+** (App Router) sur Vercel
- **TypeScript** obligatoire
- **TailwindCSS + shadcn/ui** pour les composants
- **Upload :** `react-dropzone` + `uploadthing` ou Uppy (chunked upload, progress)
- **Preview temps réel :** le storyboard se visualise dans le browser avant render (canvas ou Remotion Player)
- **Auth :** Clerk ou Auth.js (NextAuth) — Clerk plus rapide à setup pour SaaS

### 2. Backend

- **API :** Next.js Route Handlers (si simple) OU API dédiée en Node/Fastify séparée (si charge)
- **Queue de jobs :** Redis + BullMQ (Node) — **critique** car le rendu est long
  - Job = 1 vidéo : upload → storyboard → render → notif
  - Retry, backoff, priorité par plan (payants d'abord)
- **Webhooks :** Stripe → activer/désactiver selon abonnement
- **DB :** PostgreSQL (Supabase ou Neon) — users, projects, renders, billing

### 3. Rendu — la décision clé

Trois options, du moins au plus cher :

#### a) FFmpeg headless (recommandé pour démarrer)
- Le pipeline existant (`render.mjs` + `gen_overlays.py`) tourne tel quel
- Container Docker léger : ffmpeg + Python/PIL + Node (~300MB)
- Render time : ~10–15s pour 20s de vidéo, CPU-only
- Coût : quasi gratuit
- Scaling : 1 worker = 1 container, BullMQ distribue

#### b) Remotion (rendu programmatique React)
- Pour des animations complexes (kinetic typography, transitions avancées)
- Render via `@remotion/renderer` en headless (Chromium + ffmpeg)
- Plus lourd : ~1–2GB RAM par render, 30–60s par vidéo
- Lambda rendering possible sur AWS (pay per render)

#### c) Cloud GPU (seulement si IA générative)
- Si tu ajoutes du MusicGen, TTS, ou upscale ESRGAN
- RunPod / Modal / Replicate — spin up GPU on-demand
- Coût : $0.30–1.00 par vidéo selon durée GPU

**Recommandation :** démarrer avec **(a) ffmpeg Docker**. C'est le pipeline existant, coût marginal nul, couvre 90% des cas promo. Ajouter Remotion seulement si les clients veulent des animations texte élaborées.

**Architecture render concrète :**
- Worker container (Docker) avec ffmpeg + PIL + Node
- BullMQ job → pull depuis Redis → render → upload output → webhook
- Auto-scale : **Fly.io Machines** ou Railway (scale to zero entre les jobs)
- Fly.io idéal : $0 quand inactif, spin-up en ~1s

### 4. Stockage

- **Vidéos rendues :** S3 (AWS) ou **R2 (Cloudflare — pas de frais d'egress)**
- R2 recommandé : $0.015/GB stockage, egress gratuit (vs S3 $0.09/GB egress)
- **Upload directs :** presigned URLs S3/R2 (le fichier ne passe pas par ton serveur)
- **CDN pour delivery :** Cloudflare devant R2 = gratuit
- **Screenshots temporaires :** 24h TTL puis auto-delete (lifecycle policy)
- **DB :** Supabase (Postgres + Auth + Storage intégré si tout-en-un)

### 5. Pricing Model

Freemium + credits :

| Plan | Prix | Credits/mois | Features |
|------|------|-------------|----------|
| **Free** | 0€ | 3 vidéos | Watermark, 720p max, 15s max |
| **Starter** | 19€/mois | 20 vidéos | No watermark, 1080p, 30s |
| **Pro** | 49€/mois | 75 vidéos | 1080p, 60s, custom branding, API |
| **Agency** | 149€/mois | 300 vidéos | 4K, 120s, team seats, white-label |
| **Top-up** | 5€ | 10 vidéos | N'expirent pas |

**Pourquoi des credits plutôt que « illimité » :**
- Le rendu a un coût réel (CPU, stockage)
- Évite l'abus
- Upsell naturel (user arrive à limite → upgrade)
- Les credits non utilisés se reportent (rétention)

**Payment :** Stripe Checkout + Customer Portal (gestion self-service). Metered billing via Stripe pour les top-ups.

### 6. Stack résumé — version « launch in 2 weeks »

| Layer | Tech | Coût/mois (début) |
|-------|------|-------------------|
| Frontend | Next.js 14 + Vercel | $0 (hobby) |
| Auth | Clerk | $0 (10k MAU free) |
| DB | Supabase | $0 (500MB free) |
| Queue | Upstash Redis (serverless) | $0 (10k cmds/day) |
| Render | Fly.io (scale to zero) | ~$2–5 (pay per use) |
| Storage | Cloudflare R2 | $0 (10GB free) |
| Payments | Stripe | 1.4% + 0.25€/transaction |
| Domain | Cloudflare | $10/an |

> **Total coût fixe au lancement : ~$0/mois** tant que pas de trafic.
> **Coût marginal par vidéo : < $0.01** (CPU render + stockage)

### 7. Roadmap d'incrément

1. **Phase 1 (MVP) :** ffmpeg pipeline en Docker + upload + render + download
2. **Phase 2 :** Templates/styling (presets visuels, thèmes)
3. **Phase 3 :** API publique (plan Pro/Agency)
4. **Phase 4 :** Render cloud GPU (MusicGen, TTS, upscale)
5. **Phase 5 :** Editor visuel (glisser-déposer scènes dans le browser)

> **Avantage majeur :** réutiliser directement le pipeline `render.mjs` + `gen_overlays.py` existant dans un container Docker. Le SaaS n'est que l'enveloppe (UI + queue + billing) autour d'un moteur qui marche déjà.

---

## Synthèse exécutive

| Aspect | Recommandation |
|--------|----------------|
| **Moteur de rendu (MVP)** | FFmpeg + PIL + Node en Docker (gratuit, rapide, CPU-only) |
| **Moteur de rendu (v2, animations avancées)** | Remotion si besoin kinetic typography |
| **Frontend** | Next.js 14 + TailwindCSS + shadcn/ui |
| **Backend** | Next.js API + Redis/BullMQ + PostgreSQL (Supabase) |
| **Stockage** | Cloudflare R2 (egress gratuit) |
| **Hébergement render** | Fly.io (scale to zero) |
| **Coût fixe lancement** | ~$0/mois |
| **Coût marginal/vidéo** | <$0.01 |
| **Pricing** | Freemium + credits ($0 → $149/mois) |
| **Stack existante réutilisable** | `render.mjs` + `gen_overlays.py` du repo `app-promo-studio` |
