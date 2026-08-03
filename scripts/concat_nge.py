#!/usr/bin/env python3.11
"""Concatène les scènes NGE Stock avec xfade en cascade simple."""
import subprocess, os, sys

BASE = "/Users/arnaud/app-promo-studio"
OUT = f"{BASE}/output"
FPS = 30
XFADE = 0.5

def concat_xfade(scenes, durations, out_path, voice_path):
    """Concatène toutes les scènes avec xfade, puis mixe voix off."""
    n = len(scenes)
    print(f"  Concaténation de {n} scènes...")

    # Étape 1: concat deux par deux avec xfade
    current = scenes[0]
    accum = durations[0]

    for i in range(1, n):
        offset = accum - XFADE
        transition = "fadeblack" if i == n - 1 else "dissolve"
        next_out = out_path.replace(".mp4", f"_step{i}.mp4")

        r = subprocess.run([
            "ffmpeg", "-y",
            "-i", current,
            "-i", scenes[i],
            "-filter_complex",
            f"[0:v][1:v]xfade=transition={transition}:duration={XFADE}:offset={offset}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-preset", "fast", "-crf", "18",
            "-r", str(FPS),
            next_out
        ], capture_output=True, text=True)

        if not os.path.exists(next_out):
            print(f"  ERREUR à l'étape {i}: {r.stderr[-200:]}")
            return None

        # Supprimer l'intermédiaire précédent (sauf le premier = scène originale)
        if current != scenes[0] and os.path.exists(current):
            os.remove(current)

        current = next_out
        accum += durations[i] - XFADE

    # Étape 2: mix avec voix off
    print(f"  Mix voix off...")
    if voice_path and os.path.exists(voice_path):
        temp_v = out_path.replace(".mp4", "_novoice.mp4")
        os.rename(current, temp_v)
        r = subprocess.run([
            "ffmpeg", "-y",
            "-i", temp_v,
            "-i", voice_path,
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            out_path
        ], capture_output=True, text=True)
        os.remove(temp_v)
    else:
        os.rename(current, out_path)

    if os.path.exists(out_path):
        sz = os.path.getsize(out_path)
        dur = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", out_path],
            capture_output=True, text=True
        ).stdout.strip()
        print(f"  ✅ {os.path.basename(out_path)}: {sz/(1024*1024):.1f}MB ({float(dur):.1f}s)")
    return out_path

# ─── GLOBALE ──────────────────────────────────────────────────────────────────
print("🎬 NGE Stock Global")
g_work = f"{OUT}/.work_NGE_Stock_Global"
g_scenes = sorted([f"{g_work}/{f}" for f in os.listdir(g_work) if f.startswith("scene_") and f.endswith(".mp4")])
g_durs = [5.5, 5.0, 6.0, 5.0, 5.0, 5.0]
concat_xfade(g_scenes, g_durs, f"{OUT}/NGE_Stock_Global.mp4", f"{BASE}/voiceover/global_voice.mp3")

# ─── PRÉPA ────────────────────────────────────────────────────────────────────
print("\n🎬 NGE Stock Prépa")
p_work = f"{OUT}/.work_NGE_Stock_Prepa"
p_scenes = sorted([f"{p_work}/{f}" for f in os.listdir(p_work) if f.startswith("scene_") and f.endswith(".mp4")])
p_durs = [5.0] * len(p_scenes)
concat_xfade(p_scenes, p_durs, f"{OUT}/NGE_Stock_Prepa.mp4", f"{BASE}/voiceover/prepa_voice.mp3")

# Cleanup steps
for f in os.listdir(OUT):
    if "_step" in f:
        os.remove(f"{OUT}/{f}")

print("\n✅ Terminé !")
