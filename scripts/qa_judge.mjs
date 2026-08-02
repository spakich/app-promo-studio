#!/usr/bin/env node
/**
 * QA Auto-Judge — quality control system that evaluates rendered video
 * and returns a structured score with actionable fixes.
 *
 * This is the INNOVATION: the pipeline judges its own output against
 * professional promo video standards, identifies what's wrong, and
 * feeds corrections back into the next render cycle.
 *
 * Pipeline:
 *   1. Extract keyframes from the MP4 (every ~2s)
 *   2. Send each to Gemini Vision with a brutal QA rubric
 *   3. Aggregate scores → pass/fail + list of specific fixes
 *   4. If fail → generate corrected storyboard and re-render
 *
 * Usage:
 *   node scripts/qa_judge.mjs <video.mp4> [--storyboard storyboard.json] [--strict]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const videoPath = args[0];
if (!videoPath || !existsSync(videoPath)) {
  console.error('Usage: node scripts/qa_judge.mjs <video.mp4> [--storyboard file.json] [--strict]');
  process.exit(1);
}

const storyboardPath = argVal('--storyboard', null);
const strict = args.includes('--strict');
const framesDir = 'output/qa_frames';

function argVal(flag, fb) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fb;
}

// ── Load Gemini key from env file ──
const envText = await readFile('/Users/arnaud/.hermes/.env', 'utf-8').catch(() => '');
const GEMINI_KEY = envText.match(/GEMINI_API_KEY=["']?([^"'\n]+)/)?.[1];
if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY introuvable');
  process.exit(1);
}

// ── Load storyboard context ──
let storyboard = null;
if (storyboardPath && existsSync(storyboardPath)) {
  storyboard = JSON.parse(await readFile(storyboardPath, 'utf-8'));
}

// ── 1. Extract keyframes (one every 2 seconds) ──
await mkdir(framesDir, { recursive: true });
execSync(`rm -f ${framesDir}/frame_*.jpg`);
const videoDuration = parseFloat(
  execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`).toString().trim()
);
const frameCount = Math.min(12, Math.floor(videoDuration / 2));
const interval = videoDuration / frameCount;

console.log(`\n🔍 QA Auto-Judge`);
console.log(`   Vidéo: ${path.basename(videoPath)} (${videoDuration.toFixed(1)}s)`);
console.log(`   Extraction de ${frameCount} keyframes…\n`);

for (let i = 0; i < frameCount; i++) {
  const t = (i * interval + interval / 2).toFixed(1);
  execSync(
    `ffmpeg -y -ss ${t} -i "${videoPath}" -frames:v 1 -q:v 3 ${framesDir}/frame_${String(i).padStart(2, '0')}.jpg 2>/dev/null`
  );
}

// ── 2. QA Rubric — the brutal judge ──
const rubric = `Tu es un DIRECTEUR CRÉATIF expert en vidéos promo SaaS. Tu juges sans pitié.

Voici ${frameCount} frames extraites d'une vidéo promo de ${videoDuration.toFixed(0)} secondes.
${storyboard ? `L'app promue: "${storyboard.appName}" — pitch: "${storyboard.pitch}"` : ''}

Pour CHAQUE frame, évalue sur une échelle de 0 à 10:
1. **Professionnalisme visuel** (0-10): est-ce qu'on dirait une vraie vidéo pro (type Apple/Linear/Vercel) ou un diaporama amateur ?
2. **Lisibilité texte** (0-10): le texte overlay est-il lisible, bien positionné, pas écrasé par l'image ?
3. **Dynamisme perçu** (0-10): la frame donne-t-elle une impression de mouvement/énergie ou de statique/plat ?
4. **Cohérence design** (0-10): les couleurs, la typo, le style sont-ils cohérents et soignés ?

Puis donne un VERDICT GLOBAL:
- **Score global** (0-100, moyenne pondérée: professionnalisme x3, lisibilité x1, dynamisme x2, cohérence x2)
- **Top 3 problèmes** concrets qui empêchent de vendre cette vidéo
- **Top 3 corrections** prioritaires et actionnables
- **PASS** ou **FAIL** (seuil de réussite: ${strict ? '75' : '65'}/100)

Réponds UNIQUEMENT en JSON:
{
  "frames": [{"index": 0, "professionalism": 7, "readability": 8, "dynamism": 4, "coherence": 7, "comment": "..."}],
  "globalScore": 62,
  "verdict": "FAIL",
  "topProblems": ["...", "...", "..."],
  "topFixes": ["...", "...", "..."]
}`;

// ── 3. Convert frames to base64 inline data for Gemini ──
const parts = [{ text: rubric }];
for (let i = 0; i < frameCount; i++) {
  const framePath = path.join(framesDir, `frame_${String(i).padStart(2, '0')}.jpg`);
  if (!existsSync(framePath)) continue;
  const frameData = await readFile(framePath);
  const b64 = frameData.toString('base64');
  parts.push({ text: `\n--- Frame ${i + 1}/${frameCount} ---` });
  parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
}

// ── 4. Call Gemini Vision ──
console.log('   Analyse Gemini Vision…');
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    }),
  }
);

if (!res.ok) {
  console.error(`❌ Gemini ${res.status}:`, (await res.text()).slice(0, 500));
  process.exit(1);
}

const data = await res.json();
const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
const jsonMatch = raw.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  console.error('❌ Pas de JSON:', raw.slice(0, 500));
  process.exit(1);
}
const qa = JSON.parse(jsonMatch[0]);

// ── 5. Report ──
console.log('\n═══════════════════════════════════════');
console.log(`  SCORE GLOBAL: ${qa.globalScore}/100`);
console.log(`  VERDICT:     ${qa.verdict}`);
console.log('═══════════════════════════════════════\n');

if (qa.frames) {
  console.log('Détail par frame:');
  qa.frames.forEach((f) => {
    const bar = '█'.repeat(Math.round(f.professionalism)) + '░'.repeat(10 - Math.round(f.professionalism));
    console.log(`  Frame ${String(f.index + 1).padStart(2, '0')}  ${bar}  ${f.comment?.slice(0, 60) || ''}`);
  });
}

console.log('\n🔴 Top problèmes:');
(qa.topProblems || []).forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

console.log('\n🔧 Top corrections:');
(qa.topFixes || []).forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

// Save report
const report = {
  video: videoPath,
  duration: videoDuration,
  qa,
  evaluatedAt: new Date().toISOString(),
};
await writeFile('output/qa_report.json', JSON.stringify(report, null, 2));
console.log(`\n💾 output/qa_report.json`);

if (qa.verdict === 'PASS') {
  console.log('\n✅ VIDÉO VALIDÉE — qualité pro atteinte\n');
  process.exit(0);
} else {
  console.log('\n❌ VIDÉO REJETÉE — corrections nécessaires\n');
  process.exit(1);
}
