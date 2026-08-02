#!/usr/bin/env node
/**
 * AUDIO MIXER — combine voice-over + music + video
 * ================================================
 * 
 * Modes:
 * 1. TTS auto: génère voix via edge-tts (Français)
 * 2. Custom voice: utilise un fichier audio fourni par l'utilisateur
 * 3. Music: ajoute musique de fond ducked sous la voix
 *
 * Usage:
 *   node scripts/audio_mixer.mjs <video.mp4> [options]
 *   
 *   --voice-tts           Génère voix TTS automatique
 *   --voice-file <path>   Utilise ta propre voix (MP3/WAV/M4A)
 *   --music-file <path>   Ajoute musique de fond
 *   --music-volume 0.25   Volume musique (default 25%)
 *   --voice-volume 1.0    Volume voix (default 100%)
 *   --out <path>          Output final
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

const args = process.argv.slice(2);
const videoPath = args[0] || 'output/promo_zefil_pro.mp3';
const outPath = args.find((_, i, a) => a[i-1] === '--out') || 'output/promo_final.mp4';

// Parse options
const opts = {
  voiceTTS: args.includes('--voice-tts'),
  voiceFile: args[args.indexOf('--voice-file') + 1],
  musicFile: args[args.indexOf('--music-file') + 1],
  musicVolume: parseFloat(args[args.indexOf('--music-volume') + 1] || '0.25'),
  voiceVolume: parseFloat(args[args.indexOf('--voice-volume') + 1] || '1.0'),
  storyboardPath: args[args.indexOf('--storyboard') + 1] || 'output/zefil_storyboard_v2.json',
};

console.log('\n🎵 AUDIO MIXER');
console.log(`   Vidéo: ${videoPath}`);

const audioTracks = [];

// ── Voice-over ──
let voicePath = null;

if (opts.voiceFile && existsSync(opts.voiceFile)) {
  console.log(`   🎙️  Voix custom: ${opts.voiceFile}`);
  voicePath = opts.voiceFile;
} else if (opts.voiceTTS) {
  console.log(`   🎙️  Génération voix TTS...`);
  execSync(`node scripts/voice_over.mjs "${opts.storyboardPath}" output/voiceover.mp3 fr`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  voicePath = 'output/voiceover.mp3';
} else {
  console.log(`   ⏭️  Pas de voix`);
}

if (voicePath && existsSync(voicePath)) {
  audioTracks.push({ path: voicePath, volume: opts.voiceVolume, type: 'voice' });
}

// ── Music ──
if (opts.musicFile && existsSync(opts.musicFile)) {
  console.log(`   🎵 Musique: ${opts.musicFile} (vol: ${opts.musicVolume})`);
  audioTracks.push({ path: opts.musicFile, volume: opts.musicVolume, type: 'music' });
} else {
  console.log(`   ⏭️  Pas de musique (ajouter --music-file <path>)`);
}

if (audioTracks.length === 0) {
  console.log('\n   ⚠ Aucun audio. Vidéo sans son.\n');
  process.exit(0);
}

// ── Mix audio with video ──
console.log('\n   🔀 Mix audio + vidéo...');

let filter = '';
let inputs = `-i "${videoPath}"`;

audioTracks.forEach((track, i) => {
  inputs += ` -i "${track.path}"`;
  // Track i+1 because video is track 0
  filter += `[${i+1}:a]volume=${track.volume}[a${i+1}];`;
});

if (audioTracks.length === 1) {
  filter = `[1:a]volume=${audioTracks[0].volume}[aout]`;
} else {
  // Mix all audio tracks
  const labels = audioTracks.map((_, i) => `[a${i+1}]`).join('');
  filter += `${labels}amix=inputs=${audioTracks.length}:duration=first:dropout_transition_time=0[aout]`;
}

const cmd = `ffmpeg -y ${inputs} -filter_complex "${filter}" -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${outPath}"`;

try {
  execSync(cmd, { stdio: 'pipe', timeout: 60000 });
  
  // Get output file size
  const sizeResult = execSync(`du -h "${outPath}" | cut -f1`, { encoding: 'utf-8' }).trim();
  console.log(`\n✅ Vidéo finale: ${outPath} (${sizeResult})`);
  console.log(`   ${audioTracks.length} piste(s) audio mixée(s)\n`);
} catch (e) {
  console.log(`\n❌ Mix échoué: ${e.message?.substring(0, 100)}`);
  
  // Fallback: just replace audio with voice
  console.log('   Tentative: voix seule...');
  try {
    execSync(
      `ffmpeg -y -i "${videoPath}" -i "${voicePath}" ` +
      `-map 0:v -map 1:a -c:v copy -c:a aac -shortest "${outPath}"`,
      { stdio: 'pipe', timeout: 60000 }
    );
    console.log(`\n✅ Vidéo avec voix: ${outPath}\n`);
  } catch (e2) {
    console.log(`❌ Échec total: ${e2.message?.substring(0, 100)}`);
  }
}
