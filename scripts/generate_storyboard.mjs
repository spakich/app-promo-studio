#!/usr/bin/env node
/**
 * Storyboard Generator — the AI brain of the pipeline.
 *
 * Merges:
 *   - static analysis  (code → design DNA + functional understanding)
 *   - dynamic capture  (live app → screenshots + rendered CSS + visible texts)
 *
 * Calls Gemini → produces storyboard.json compatible with the Remotion
 * compositions (SceneData[] + SceneStyle).
 *
 * Usage:
 *   node scripts/generate_storyboard.mjs <github-url> <captures-dir> [--out output/storyboard.json]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const githubUrl = args[0];
const capturesDir = args[1] || 'output/captures';
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'output/storyboard.json';

if (!githubUrl) {
  console.error('Usage: node scripts/generate_storyboard.mjs <github-url> [captures-dir] [--out file]');
  process.exit(1);
}

// ── Load secrets from ~/.hermes/.env (script file, no inline tokens) ──
const envText = await readFile('/Users/arnaud/.hermes/.env', 'utf-8').catch(() => '');
const GEMINI_KEY = envText.match(/GEMINI_API_KEY=["']?([^"'\n]+)/)?.[1];
if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY introuvable dans ~/.hermes/.env');
  process.exit(1);
}

// ── 1. Static analysis (reuse the tested smoke-test logic) ──
console.log(`\n🧠 Génération du storyboard`);
console.log(`   Repo: ${githubUrl}\n`);

const parsed = githubUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
const [owner, repo] = [parsed[1], parsed[2]];

async function gh(p) {
  const res = await fetch(`https://api.github.com${p}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${p}`);
  return res.json();
}
async function ghRaw(p) {
  const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${p}`);
  if (!res.ok) {
    const res2 = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/${p}`);
    return res2.ok ? res2.text() : null;
  }
  return res.text();
}

const meta = await gh(`/repos/${owner}/${repo}`);
const readme = await gh(`/repos/${owner}/${repo}/readme`).then((r) =>
  Buffer.from(r.content, 'base64').toString('utf-8')
).catch(() => '');

// ── 2. Dynamic capture manifest — filter out empty/inert screens ──
const manifest = JSON.parse(await readFile(path.join(capturesDir, 'capture_manifest.json'), 'utf-8'));

// Reject captures that show empty states — a promo video must show the app IN ACTION
const EMPTY_SIGNALS = ['ajoutez', 'vide', 'commencer', 'aucune donnée', 'no data', 'empty', 'placeholder', 'rien à afficher', 'aucun projet', 'aucun résultat'];
const goodCaptures = manifest.captures.filter((c) => {
  const texts = (c.texts || []).join(' ').toLowerCase();
  return !EMPTY_SIGNALS.some((sig) => texts.includes(sig));
});
// If we filtered too aggressively, keep at least the 3 richest captures
const usableCaptures = goodCaptures.length >= 2
  ? goodCaptures
  : manifest.captures
      .map((c) => ({ c, richness: (c.texts?.length || 0) + (c.focal ? 2 : 0) }))
      .sort((a, b) => b.richness - a.richness)
      .slice(0, 4)
      .map((x) => x.c);
manifest.captures = usableCaptures;

// ── 3. Build the LLM prompt ──
const screensDesc = manifest.captures
  .map((c, i) => `  Écran ${i + 1}: route "${c.route}" — textes visibles: ${c.texts.slice(0, 8).join(' | ')}`)
  .join('\n');

const prompt = `Tu es un directeur vidéo spécialisé en motion design d'apps SaaS.

APPLICATION À PROMOUVOIR:
Nom: ${meta.name}
Description: ${meta.description || '(voir README)'}
README (extrait):
${readme.slice(0, 2000)}

DESIGN RÉEL DE L'APP (lu en direct sur l'app qui tourne):
- Fond: ${manifest.liveDesign?.bgColor}
- Texte: ${manifest.liveDesign?.color}
- Police: ${manifest.liveDesign?.fonts?.join(', ')}
- Accent: ${manifest.liveDesign?.cssVars?.['--accent'] || '#6366f1'}

ÉCRANS CAPTURÉS (screenshots réels disponibles, dans cet ordre):
${screensDesc}

MISSION: écris le storyboard d'une vidéo promo de 20-30 secondes.
- Une scène par écran, ordre qui raconte la valeur de l'app.
- caption: accroche punchy, MAX 6 MOTS, en français.
- subtitle: bénéfice concret, MAX 10 MOTS, en français.
- Appuie-toi sur les TEXTES VISIBLES réels des écrans pour que les accroches soient VRAIES (pas génériques).
- zoomPreset parmi: center, topRight, bottomLeft, panRight, panLeft, pullOut.
- transitionOut parmi: blurDissolve, zoomThrough, crossDissolve, slidePush, fadeToBlack.
- durationSeconds: 3 à 5.
- pitch: une phrase de présentation (max 15 mots, français).

Réponds UNIQUEMENT en JSON valide, sans markdown:
{"pitch":"...","scenes":[{"screenIndex":1,"caption":"...","subtitle":"...","zoomPreset":"center","transitionOut":"blurDissolve","durationSeconds":4}]}`;

// ── 4. Call Gemini ──
console.log('   Appel Gemini 2.5 Flash…');
const geminiRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  }
);

if (!geminiRes.ok) {
  console.error(`❌ Gemini ${geminiRes.status}:`, (await geminiRes.text()).slice(0, 300));
  process.exit(1);
}

const geminiData = await geminiRes.json();
const raw = geminiData.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

const jsonMatch = raw.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  console.error('❌ Pas de JSON dans la réponse:', raw.slice(0, 500));
  process.exit(1);
}
const storyboard = JSON.parse(jsonMatch[0]);

// ── 5. Merge into Remotion-compatible storyboard.json ──
// Copy captures to public/captures/ so Remotion's staticFile() can serve them
import { copyFile } from 'node:fs/promises';
const publicCapturesDir = path.resolve('public/captures');
await mkdir(publicCapturesDir, { recursive: true });

const cssVars = manifest.liveDesign?.cssVars || {};
const scenes = [];
for (const s of storyboard.scenes) {
  const cap = manifest.captures[(s.screenIndex ?? 1) - 1];
  if (!cap) continue;
  // Copy into public/ and reference relatively
  const srcAbs = path.resolve(capturesDir, cap.file);
  const destRel = `captures/${cap.file}`;
  await copyFile(srcAbs, path.join(publicCapturesDir, cap.file)).catch(() => {});
  scenes.push({
    src: destRel,
    caption: s.caption || '',
    subtitle: s.subtitle || '',
    zoomPreset: s.zoomPreset || 'center',
    transitionOut: s.transitionOut || 'crossDissolve',
    durationSeconds: Math.min(6, Math.max(2.5, s.durationSeconds || 4)),
    focal: cap.focal,
  });
}

const output = {
  appName: meta.name,
  pitch: storyboard.pitch,
  ctaText: 'Essayer gratuitement',
  generatedAt: new Date().toISOString(),
  style: {
    bgColor: cssVars['--bg-base'] || '#0a0a0b',
    accentColor: cssVars['--accent'] || '#6366f1',
    fontFamily: manifest.liveDesign?.fonts?.[0]
      ? `${manifest.liveDesign.fonts[0]}, system-ui, sans-serif`
      : 'Inter, system-ui, sans-serif',
    captionSize: 56,
    subtitleSize: 28,
  },
  scenes,
  llmRaw: raw,
};

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(output, null, 2));

console.log('\n📋 STORYBOARD GÉNÉRÉ\n');
console.log(`   Pitch: ${output.pitch}`);
console.log(`   Style: fond ${output.style.bgColor} · accent ${output.style.accentColor} · ${output.style.fontFamily.split(',')[0]}`);
console.log('');
output.scenes.forEach((s, i) => {
  console.log(`   ${i + 1}. [${s.durationSeconds}s · ${s.zoomPreset} → ${s.transitionOut}]`);
  console.log(`      "${s.caption}"`);
  if (s.subtitle) console.log(`      ${s.subtitle}`);
});
console.log(`\n💾 ${outFile}`);
console.log('\n✅ STORYBOARD PRÊT — prochaine étape: rendu Remotion\n');
