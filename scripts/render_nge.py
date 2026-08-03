#!/usr/bin/env python3
"""NGE Stock — Pipeline de composition vidéo via ffmpeg.
Compose des screenshots avec Ken Burns, overlays texte PIL, transitions xfade,
et mixe la voix off + musique de fond.
"""
import subprocess, json, os, sys, math
from PIL import Image, ImageDraw, ImageFont

BASE = "/Users/arnaud/app-promo-studio"
CAPTURE = f"{BASE}/capture/nge"
OUT = f"{BASE}/output"
os.makedirs(OUT, exist_ok=True)

W, H = 1920, 1080
FPS = 30
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

# ─── SCÈNES ──────────────────────────────────────────────────────────────────
# Chaque scène: image, durée (s), type de zoom Ken Burns, titre, sous-titre
GLOBAL_SCENES = [
    {"img": f"{CAPTURE}/01_dashboard.png",     "dur": 5.5, "zoom": "zoom_in_center",   "title": "Tableau de bord",      "sub": "2,1 M€ de stock · 707 articles"},
    {"img": f"{CAPTURE}/03_tourets.png",        "dur": 5.0, "zoom": "pan_right",        "title": "Tourets Fibre Optique", "sub": "503 tourets suivis au mètre"},
    {"img": f"{CAPTURE}/05_reception_ia.png",   "dur": 6.0, "zoom": "zoom_to_detail",   "title": "Réception IA",          "sub": "Claude Sonnet extrait tout"},
    {"img": f"{BASE}/mockups/nge_kanban.png",   "dur": 5.0, "zoom": "pan_left",         "title": "Préparation Kanban",    "sub": "Glissez, assignez, livrez"},
    {"img": f"{BASE}/mockups/nge_chantiers.png","dur": 5.0, "zoom": "zoom_out",         "title": "Suivi Chantiers",       "sub": "Coûts et marges en temps réel"},
    {"img": f"{CAPTURE}/03_tourets.png",        "dur": 5.0, "zoom": "fade_out_zoom",    "title": "NGE Stock Manager",     "sub": "Le contrôle total, du quai au chantier"},
]

PREPA_SCENES = [
    {"img": f"{BASE}/mockups/nge_kanban.png",       "dur": 5.0, "zoom": "zoom_in_center", "title": "Vue Kanban",       "sub": "Le flux clair de vos commandes"},
    {"img": f"{CAPTURE}/04_prepa_cmdes.png",         "dur": 5.0, "zoom": "pan_right",      "title": "Colonnes",         "sub": "À préparer, en cours, prêt, livré"},
    {"img": f"{BASE}/mockups/nge_kanban.png",       "dur": 5.0, "zoom": "zoom_to_detail", "title": "Détail commande",  "sub": "Sous-traitant, chantier, matériels"},
    {"img": f"{BASE}/mockups/nge_kanban.png",       "dur": 5.0, "zoom": "pan_left",       "title": "Glisser-déposer",  "sub": "Le stock est réservé instantanément"},
    {"img": f"{CAPTURE}/03_tourets.png",             "dur": 5.0, "zoom": "zoom_out",      "title": "Traçabilité",      "sub": "Chaque mètre de câble suivi"},
    {"img": f"{BASE}/mockups/nge_kanban.png",       "dur": 5.0, "zoom": "fade_out_zoom",  "title": "Prépa Commandes",  "sub": "Simple. Rapide. Fiable."},
]

# ─── 1. GÉNÉRER LES OVERLAYS TEXTE ────────────────────────────────────────────
def gen_overlay(scene, idx, out_dir):
    """Génère un PNG transparent avec titre + sous-titre, style pro NGE."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    title_font = ImageFont.truetype(FONT_BOLD, 64)
    sub_font = ImageFont.truetype(FONT_REG, 34)

    title = scene["title"]
    sub = scene["sub"]

    # Mesurer
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    bbox2 = draw.textbbox((0, 0), sub, font=sub_font)
    sw = bbox2[2] - bbox2[0]

    # Position: bas de l'écran, centré
    y_start = H - 220

    # Fond gradient semi-transparent (bas de l'écran)
    for y in range(y_start - 40, H):
        alpha = int(220 * (y - (y_start - 40)) / (H - (y_start - 40)))
        draw.line([(0, y), (W, y)], fill=(0, 32, 96, min(alpha, 200)))

    # Barre accent doré
    bar_x = (W - max(tw, sw)) // 2
    bar_y = y_start - 10
    draw.rectangle([bar_x - 30, bar_y, bar_x - 18, bar_y + 80], fill=(246, 190, 0, 255))

    # Titre
    tx = (W - tw) // 2
    draw.text((tx, y_start), title, font=title_font, fill=(255, 255, 255, 255),
              stroke_width=3, stroke_fill=(0, 0, 0, 200))

    # Sous-titre
    sx = (W - sw) // 2
    draw.text((sx, y_start + 80), sub, font=sub_font, fill=(246, 190, 0, 255),
              stroke_width=2, stroke_fill=(0, 0, 0, 180))

    path = f"{out_dir}/overlay_{idx:02d}.png"
    img.save(path)
    return path

# ─── 2. PRÉPARER IMAGE (scale + crop 1920x1080 + flou background) ─────────────
def prep_image(img_path, idx, out_dir):
    """Scale l'image en 1920x1080 avec fond flou si ratio différent."""
    out_path = f"{out_dir}/prep_{idx:02d}.png"
    subprocess.run([
        "ffmpeg", "-y", "-i", img_path,
        "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}",
        "-frames:v", "1", out_path
    ], capture_output=True)
    return out_path

# ─── 3. RENDRE UNE SCÈNE AVEC KEN BURNS + OVERLAY ───────────────────────────
def render_scene(scene, idx, prep_path, overlay_path, out_dir):
    """Rendre une scène avec effet Ken Burns + overlay texte."""
    dur = scene["dur"]
    frames = int(dur * FPS)
    out_path = f"{out_dir}/scene_{idx:02d}.mp4"

    # Ken Burns zoom/pan via zoompan
    z = scene["zoom"]
    if z == "zoom_in_center":
        zoom_expr = "min(1+on/150,1.25)"
        x_expr = f"(iw-iw*{zoom_expr})/2"
        y_expr = f"(ih-ih*{zoom_expr})/2"
    elif z == "pan_right":
        zoom_expr = "1.15"
        x_expr = f"(iw-iw*{zoom_expr})*on/{frames}"
        y_expr = f"(ih-ih*{zoom_expr})/2"
    elif z == "zoom_to_detail":
        zoom_expr = "min(1+on/120,1.35)"
        x_expr = f"(iw-iw*{zoom_expr})*0.7"
        y_expr = f"(ih-ih*{zoom_expr})*0.3"
    elif z == "pan_left":
        zoom_expr = "1.15"
        x_expr = f"(iw-iw*{zoom_expr})*(1-on/{frames})"
        y_expr = f"(ih-ih*{zoom_expr})/2"
    elif z == "zoom_out":
        zoom_expr = "max(1.3-on/200,1.0)"
        x_expr = f"(iw-iw*{zoom_expr})/2"
        y_expr = f"(ih-ih*{zoom_expr})/2"
    elif z == "fade_out_zoom":
        zoom_expr = "1.1+0.15*sin(on/30)"
        x_expr = f"(iw-iw*{zoom_expr})/2"
        y_expr = f"(ih-ih*{zoom_expr})/2"
    else:
        zoom_expr = "1.1"
        x_expr = f"(iw-iw*{zoom_expr})/2"
        y_expr = f"(ih-ih*{zoom_expr})/2"

    # Pipeline: zoompan → overlay texte
    vf = (
        f"[0:v]scale={W*4}:{H*4}:force_original_aspect_ratio=increase,"  # upscale pour zoompan
        f"crop={W*4}:{H*4},"
        f"zoompan=z='{zoom_expr}':x='{x_expr}':y='{y_expr}':d={frames}:s={W}x{H}:fps={FPS},"
        f"setsar=1[bg];"
        f"[1:v]format=rgba,fade=in:st=0:d=0.5:alpha=1,fade=out:st={dur-0.5}:d=0.5:alpha=1[ov];"
        f"[bg][ov]overlay=0:0[outv]"
    )

    subprocess.run([
        "ffmpeg", "-y",
        "-i", prep_path,
        "-i", overlay_path,
        "-filter_complex", vf,
        "-map", "[outv]",
        "-t", str(dur),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-r", str(FPS),
        "-preset", "fast",
        "-crf", "18",
        out_path
    ], capture_output=True)

    if os.path.exists(out_path):
        sz = os.path.getsize(out_path)
        print(f"  Scène {idx}: {sz//1024}KB ({dur}s)")
        return out_path
    else:
        print(f"  Scène {idx}: ERREUR")
        return None

# ─── 4. CONCATÉNER AVEC XFADE ─────────────────────────────────────────────────
def concat_scenes(scene_paths, durations, out_path, voice_path=None):
    """Concatène les scènes avec transitions xfade et mixe la voix off."""
    n = len(scene_paths)
    xfade_dur = 0.5  # transition de 0.5s

    # Étape 1: concaténer avec xfade
    if n == 1:
        final_video = scene_paths[0]
    else:
        # Construire le filter_complex pour xfade en cascade
        inputs = []
        for p in scene_paths:
            inputs.extend(["-i", p])

        # Premier input sans modification
        fc_parts = ["[0:v]"]
        accum_dur = durations[0]

        for i in range(1, n):
            offset = accum_dur - xfade_dur
            fc_parts.append(f"[{i}:v]")
            prev_label = "v0" if i == 1 else f"v{i-1}"
            curr_label = f"v{i}"

            transition = "fadeblack" if i == n - 1 else "dissolve"

            if i == 1:
                fc_parts[0] = f"[0:v][1:v]xfade=transition={transition}:duration={xfade_dur}:offset={offset}[v1]"
            else:
                fc_parts.append(f"[v{i-1}][{i}:v]xfade=transition={transition}:duration={xfade_dur}:offset={offset}[v{i}]")

            accum_dur += durations[i] - xfade_dur

        last_label = f"v{n-1}"
        fc = "".join(fc_parts)

        temp_video = out_path.replace(".mp4", "_video_only.mp4")
        subprocess.run([
            "ffmpeg", "-y", *inputs,
            "-filter_complex", fc,
            "-map", f"[{last_label}]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-preset", "fast", "-crf", "18",
            temp_video
        ], capture_output=True)

        final_video = temp_video

    # Étape 2: mix avec voix off
    if voice_path and os.path.exists(voice_path):
        subprocess.run([
            "ffmpeg", "-y",
            "-i", final_video,
            "-i", voice_path,
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            out_path
        ], capture_output=True)
    else:
        subprocess.run(["ffmpeg", "-y", "-i", final_video, "-c", "copy", out_path], capture_output=True)

    # Cleanup
    temp = out_path.replace(".mp4", "_video_only.mp4")
    if os.path.exists(temp):
        os.remove(temp)

    return out_path

# ─── MAIN ─────────────────────────────────────────────────────────────────────
def make_video(scenes, voice_path, out_name):
    print(f"\n🎬 Rendu: {out_name}")
    work_dir = f"{OUT}/.work_{out_name.replace('.mp4','')}"
    os.makedirs(work_dir, exist_ok=True)

    scene_paths = []
    durations = []

    for idx, scene in enumerate(scenes):
        print(f"  Préparation image {idx}...")
        prep = prep_image(scene["img"], idx, work_dir)
        overlay = gen_overlay(scene, idx, work_dir)
        sp = render_scene(scene, idx, prep, overlay, work_dir)
        if sp:
            scene_paths.append(sp)
            durations.append(scene["dur"])

    print(f"  Concaténation de {len(scene_paths)} scènes...")
    final = concat_scenes(scene_paths, durations, f"{OUT}/{out_name}", voice_path)

    if os.path.exists(final):
        sz = os.path.getsize(final)
        print(f"  ✅ {out_name}: {sz/(1024*1024):.1f}MB")
    return final

# ─── VIDÉO 1: GLOBALE ─────────────────────────────────────────────────────────
make_video(
    GLOBAL_SCENES,
    f"{BASE}/voiceover/global_voice.mp3",
    "NGE_Stock_Global.mp4"
)

# ─── VIDÉO 2: PRÉPA COMMANDES ─────────────────────────────────────────────────
make_video(
    PREPA_SCENES,
    f"{BASE}/voiceover/prepa_voice.mp3",
    "NGE_Stock_Prepa.mp4"
)

print("\n🎬 Les deux vidéos sont prêtes !")
