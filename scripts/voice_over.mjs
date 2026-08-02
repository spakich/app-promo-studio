#!/usr/bin/env node
/**
 * VOICE-OVER ENGINE
 * =================
 * Génère un voice-over pour la vidéo promo en utilisant:
 * - ElevenLabs API (premium, voix naturelles multilingues)
 * - Ou fallback: edge-tts (Microsoft Edge TTS, gratuit)
 *
 * Le script:
 * 1. Lit le storyboard (captions + subtitles)
 * 2. Génère un script de narration optimisé pour la voix
 * 3. Appelle l'API TTS pour produire un MP3
 * 4. Calcule les timestamps pour synchroniser avec les scènes
 *
 * Usage: node scripts/voice_over.mjs <storyboard.json> --out output/voiceover.mp3
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const storyboardPath = process.argv[2] || 'output/zefil_storyboard_v2.json';
const outputPath = process.argv[3] || 'output/voiceover.mp3';
const language = process.argv[4] || 'fr';

const sb = JSON.parse(readFileSync(storyboardPath, 'utf-8'));

console.log('\n🎙️  VOICE-OVER ENGINE');
console.log(`   App: ${sb.appName}`);
console.log(`   Lang: ${language}`);

// ── Step 1: Generate narration script ──
function buildScript(sb) {
  const lines = [];

  // Intro
  lines.push({
    text: sb.pitch || `Découvrez ${sb.appName}.`,
    scene: 'intro',
    duration: 3,
  });

  // Scenes
  for (const scene of sb.scenes) {
    let text = scene.caption || '';
    if (scene.subtitle) {
      text += `. ${scene.subtitle}`;
    }
    // Clean up for speech
    text = text
      .replace(/\x27/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    lines.push({
      text,
      scene: scene.analysis?.narrative_role || 'scene',
      duration: scene.durationSeconds || 4,
    });
  }

  // Outro
  lines.push({
    text: sb.ctaText || `Essayez ${sb.appName} dès aujourd'hui.`,
    scene: 'outro',
    duration: 3,
  });

  return lines;
}

const script = buildScript(sb);

console.log('\n   Script de narration:');
for (const line of script) {
  console.log(`   [${line.scene.padEnd(12)}] "${line.text}"`);
}

// ── Step 2: Generate audio via edge-tts (free, no API key needed) ──
// Voices: fr-FR-HenriNeural (male, warm), fr-FR-DeniseNeural (female, clear)
const VOICES = {
  'fr-male': 'fr-FR-HenriNeural',
  'fr-female': 'fr-FR-DeniseNeural',
  'en-male': 'en-US-GuyNeural',
  'en-female': 'en-US-JennyNeural',
};

const voiceKey = `${language}-male`;
const voice = VOICES[voiceKey] || VOICES['fr-male'];

console.log(`\n   Voix: ${voice} (${voiceKey})`);

// Generate full narration as one continuous speech
const fullText = script.map(l => l.text).join(' ');
const tempText = '/tmp/voiceover_script.txt';
writeFileSync(tempText, fullText, 'utf-8');

// Use edge-tts (pip install edge-tts) or fallback
try {
  // Try edge-tts first
  execSync(
    `edge-tts --voice "${voice}" --rate="-5%" --pitch="+2Hz" ` +
    `--text "${fullText.replace(/"/g, '\\"')}" ` +
    `--write-media "${outputPath}"`,
    { stdio: 'pipe', timeout: 60000 }
  );
  console.log(`\n✅ Voice-over généré: ${outputPath}`);
} catch (e) {
  console.log('\n   edge-tts non disponible, essai macOS say...');
  try {
    // macOS built-in TTS (Thomas = fr male, Amelie = fr female)
    const macVoice = language === 'fr' ? 'Thomas' : 'Alex';
    execSync(
      `say -v ${macVoice} -o /tmp/voiceover.aiff "${fullText.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe', timeout: 60000 }
    );
    // Convert to mp3
    execSync(`ffmpeg -y -i /tmp/voiceover.aiff -codec:a libmp3lame -qscale:a 2 "${outputPath}"`, {
      stdio: 'pipe',
      timeout: 30000,
    });
    console.log(`\n✅ Voice-over généré (macOS say): ${outputPath}`);
  } catch (e2) {
    console.log(`\n❌ TTS non disponible. Installez: pip3 install edge-tts`);
    console.log(`   Erreur: ${e2.message?.substring(0, 100)}`);
    process.exit(1);
  }
}

// ── Step 3: Generate timing markers for sync ──
// Estimate duration per line (French TTS ≈ 2.5 words/second)
const markers = [];
let currentTime = 0;
for (const line of script) {
  const wordCount = line.text.split(/\s+/).length;
  const estimatedDuration = (wordCount / 2.5) * 1000; // ms
  markers.push({
    scene: line.scene,
    text: line.text,
    startTime: currentTime,
    estimatedDuration: Math.round(estimatedDuration),
  });
  currentTime += estimatedDuration + 500; // +500ms gap between lines
}

// Save markers
const markersPath = outputPath.replace('.mp3', '_markers.json');
writeFileSync(markersPath, JSON.stringify({
  voice: voiceKey,
  totalLines: script.length,
  totalEstimatedDuration: currentTime,
  markers,
}, null, 2));

console.log(`   Markers: ${markersPath}`);
console.log(`   Durée estimée: ${(currentTime / 1000).toFixed(1)}s\n`);

// ── Step 4: Mix with background music (if available) ──
const musicPath = 'output/music/background.mp3';
if (existsSync(musicPath)) {
  const mixedPath = outputPath.replace('.mp3', '_mixed.mp3');
  console.log('   🎵 Mix voix + musique...');
  try {
    // Voice at 100%, music ducked to 25% volume
    execSync(
      `ffmpeg -y -i "${outputPath}" -i "${musicPath}" ` +
      `-filter_complex "[1:a]volume=0.25[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition_time=0[aout]" ` +
      `-map "[aout]" -codec:a libmp3lame -qscale:a 2 "${mixedPath}"`,
      { stdio: 'pipe', timeout: 30000 }
    );
    console.log(`   ✅ Mix généré: ${mixedPath}`);
  } catch (e) {
    console.log(`   ⚠ Mix échoué: ${e.message?.substring(0, 60)}`);
  }
}
