#!/usr/bin/env node
/**
 * Auto-Music Selector — analyzes the app and picks the perfect soundtrack.
 *
 * Algorithm:
 *   1. Read the storyboard + app analysis (appName, features, design DNA)
 *   2. Classify app type: dev tool, SaaS dashboard, consumer, enterprise, creative
 *   3. Map app type → music mood + BPM + instrumentation
 *   4. Search Pixabay Music API (royalty-free) for matching tracks
 *   5. Download the best match
 *   6. Optionally: add SFX (whooshes for transitions, impacts for scene changes)
 *
 * Music selection matrix (from studying Apple/Linear/Stripe/Figma product videos):
 *
 *   Dev Tool / SaaS    → Electronic, ambient, 100-120 BPM, clean synths, minimal drums
 *   Consumer App       → Upbeat pop-electronic, 120-140 BPM, bright, energetic
 *   Enterprise         → Corporate ambient, 90-110 BPM, subtle strings, piano
 *   Creative Tool      → Lo-fi hip hop or dreamy electronic, 85-100 BPM
 *   Field/Ops Tool     → Driving electronic, 110-130 BPM, rhythmic, purposeful
 *
 * Pixabay Music API: https://pixabay.com/api/  (free, key required)
 * Alternative: Pixabay CSS scrape fallback (the API may require pro key for music)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const args = process.argv.slice(2);
const storyboardPath = args[0] || 'output/storyboard.json';
const outDir = args[1] || 'output/music';

// ── App classification → music profile ─────────────────────
const MUSIC_PROFILES = {
  'dev-tool': {
    mood: 'electronic ambient minimal',
    bpm: [100, 120],
    tags: ['electronic', 'ambient', 'minimal', 'clean', 'synth', 'tech'],
    energy: 'medium',
    description: 'Clean electronic — like Linear, Vercel, Raycast product videos',
  },
  'saas-dashboard': {
    mood: 'corporate inspiring uplifting',
    bpm: [110, 130],
    tags: ['corporate', 'uplifting', 'inspiring', 'electronic', 'business'],
    energy: 'medium-high',
    description: 'Inspiring corporate — like Stripe, Notion product videos',
  },
  'consumer': {
    mood: 'upbeat pop energetic bright',
    bpm: [120, 140],
    tags: ['pop', 'upbeat', 'energetic', 'bright', 'fun'],
    energy: 'high',
    description: 'Upbeat pop — like Apple consumer app reveals',
  },
  'field-ops': {
    mood: 'driving rhythmic purposeful electronic',
    bpm: [110, 130],
    tags: ['electronic', 'driving', 'rhythmic', 'industrial', 'energetic'],
    energy: 'medium-high',
    description: 'Driving electronic — for operational/field tools',
  },
  'creative': {
    mood: 'lofi dreamy chill electronic',
    bpm: [85, 105],
    tags: ['lofi', 'dreamy', 'chill', 'relaxed', 'creative'],
    energy: 'low-medium',
    description: 'Dreamy lo-fi — like Figma, Framer product videos',
  },
  'enterprise': {
    mood: 'corporate professional ambient orchestral',
    bpm: [90, 110],
    tags: ['corporate', 'professional', 'orchestral', 'ambient', 'strings'],
    energy: 'medium',
    description: 'Corporate orchestral — for enterprise/B2B',
  },
};

// ── Classify app from storyboard metadata ──────────────────
function classifyApp(storyboard) {
  const appName = (storyboard.appName || '').toLowerCase();
  const pitch = (storyboard.pitch || '').toLowerCase();
  const captions = (storyboard.scenes || []).map(s => `${s.caption || ''} ${s.subtitle || ''}`.toLowerCase()).join(' ');
  const allText = `${appName} ${pitch} ${captions}`;

  // Keyword-based classification
  if (/terrain|chantier|fibre|stock|inventaire|réservation|opérationnel|field|ops|inventory/.test(allText)) return 'field-ops';
  if (/code|dev|api|git|deploy|build|framework|cli|terminal/.test(allText)) return 'dev-tool';
  if (/design|créatif|art|music|video|photo|edit/.test(allText)) return 'creative';
  if (/enterprise|b2b|corporate|gouvern|sécurité/.test(allText)) return 'enterprise';
  if (/social|game|fun|lifestyle|fitness|food/.test(allText)) return 'consumer';
  if (/dashboard|analytic|data|report|saas|crm|erp/.test(allText)) return 'saas-dashboard';

  // Default: SaaS dashboard
  return 'saas-dashboard';
}

// ── Download helper ────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = require('node:fs').createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  await mkdir(outDir, { recursive: true });

  const sb = JSON.parse(await readFile(storyboardPath, 'utf-8'));
  const appType = classifyApp(sb);
  const profile = MUSIC_PROFILES[appType];

  console.log(`\n🎵 Auto-Music Selector\n`);
  console.log(`   App: ${sb.appName || 'Unknown'}`);
  console.log(`   Type: ${appType}`);
  console.log(`   Profile: ${profile.description}`);
  console.log(`   Target BPM: ${profile.bpm[0]}-${profile.bpm[1]}`);
  console.log(`   Mood: ${profile.mood}`);

  // Calculate video duration
  const totalSec = (sb.scenes || []).reduce((acc, s) => acc + (s.durationSeconds || 4), 0) + 7; // +7 for intro/outro
  console.log(`   Video duration: ${totalSec}s`);

  // ── Try Pixabay API ──────────────────────────────────────
  const pixabayKey = process.env.PIXABAY_API_KEY || '';
  let track = null;

  if (pixabayKey) {
    console.log(`\n   🔍 Recherche Pixabay Music API...`);
    const query = profile.tags.slice(0, 3).join(',');
    const apiUrl = `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(query)}&type=music&per_page=5`;

    try {
      const resp = await fetch(apiUrl);
      const data = await resp.json();
      if (data.hits && data.hits.length > 0) {
        // Pick the first track (sorted by relevance)
        const hit = data.hits[0];
        console.log(`   ✅ Trouvé: "${hit.title || hit.tags}" (${hit.duration}s)`);
        track = {
          title: hit.title || hit.tags || 'Unknown',
          url: hit.audio || hit.audioFile,
          duration: hit.duration,
          source: 'pixabay',
          tags: hit.tags,
        };
      }
    } catch (e) {
      console.log(`   ⚠️ Pixabay API error: ${e.message}`);
    }
  } else {
    console.log(`\n   ⚠️ Pas de PIXABAY_API_KEY — génération du profil musical seulement`);
  }

  // ── Download track if found ──────────────────────────────
  if (track && track.url) {
    const dest = path.join(outDir, 'soundtrack.mp3');
    console.log(`   ⬇️ Téléchargement...`);
    try {
      await download(track.url, dest);
      track.localPath = dest;
      console.log(`   ✅ Téléchargé: ${dest}`);
    } catch (e) {
      console.log(`   ⚠️ Download failed: ${e.message}`);
    }
  }

  // ── Generate SFX markers (sync points) ───────────────────
  const fps = 30;
  const sfxMarkers = [];
  // Scene change whooshes
  let currentFrame = 90; // after intro
  for (const scene of sb.scenes || []) {
    sfxMarkers.push({
      type: 'whoosh',
      frame: currentFrame,
      description: `Transition vers: ${scene.caption || ''}`.slice(0, 50),
    });
    currentFrame += Math.round(scene.durationSeconds * fps);
  }
  // Impact at intro end
  sfxMarkers.unshift({ type: 'impact', frame: 85, description: 'Fin intro' });
  // Final impact at outro CTA
  sfxMarkers.push({ type: 'impact', frame: currentFrame + 10, description: 'CTA final' });

  // ── Write music profile ──────────────────────────────────
  const output = {
    appType,
    profile: {
      mood: profile.mood,
      bpm: profile.bpm,
      energy: profile.energy,
      tags: profile.tags,
      description: profile.description,
    },
    videoDurationSec: totalSec,
    track,
    sfxMarkers,
    // For Remotion: how to use
    remotionUsage: {
      audioFile: track?.localPath || null,
      // Scene changes should sync with music beats
      targetSyncFPS: fps,
    },
    // Alternative: generate with Suno AI or MusicGen
    sunoPrompt: `${profile.mood}, ${profile.bpm[0]}-${profile.bpm[1]} BPM, instrumental, no vocals, modern app promotional video soundtrack, ${profile.energy} energy, clean production, professional`,
    musicGenPrompt: `${profile.tags.join(', ')}, instrumental, ${profile.bpm[0]}-${profile.bpm[1]} BPM, 30 seconds, professional app promo background music`,
  };

  await writeFile(path.join(outDir, 'music_profile.json'), JSON.stringify(output, null, 2));

  console.log(`\n   📝 Profil musical: ${outDir}/music_profile.json`);
  console.log(`   🎸 Prompt Suno: ${output.sunoPrompt.slice(0, 80)}...`);
  console.log(`   📀 ${sfxMarkers.length} marqueurs SFX générés`);
  console.log(`\n✅ SÉLECTION MUSICALE TERMINÉE\n`);

  return output;
}

main().catch(console.error);
