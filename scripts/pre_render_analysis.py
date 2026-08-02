#!/usr/bin/env python3
"""
PRE-RENDER ANALYSIS ENGINE
===========================
Analyse chaque capture AVANT le rendu pour:
1. Scorer la qualité visuelle (densité, couleurs, contrastes, zones vides)
2. Détecter les zones d'intérêt (où zoomer)
3. Planifier la narration (ordre optimal des scènes)
4. Planifier les mouvements de caméra motivés par le contenu

Sortie: storyboard.json optimisé + analyse.json (rapport détaillé)
"""
import json, sys, os, math
from PIL import Image
import struct, zlib

def analyze_image(path):
    """Analyse profonde d'une capture d'écran."""
    img = Image.open(path).convert('RGB')
    w, h = img.size
    
    # Downsample for speed (200px wide)
    scale = 200 / w
    small = img.resize((200, max(1, int(h * scale))))
    sw, sh = small.size
    pixels = list(small.getdata())
    
    # ── 1. Color analysis ──
    colors = {}
    total_brightness = 0
    for r, g, b in pixels:
        total_brightness += (r + g + b) / 3
        # Quantize to 16 levels per channel for color counting
        key = (r >> 4, g >> 4, b >> 4)
        colors[key] = colors.get(key, 0) + 1
    
    avg_brightness = total_brightness / len(pixels)
    
    # Color variety (how many distinct colors, normalized)
    color_variety = len(colors) / len(pixels)
    
    # Is it dark mode?
    is_dark = avg_brightness < 80
    
    # ── 2. Content density via grid analysis ──
    # Divide image into 8x6 grid, measure variance per cell
    grid_w, grid_h = 8, 6
    cell_w = sw // grid_w
    cell_h = sh // grid_h
    
    grid_density = []
    for gy in range(grid_h):
        for gx in range(grid_w):
            cell_pixels = []
            for py in range(gy * cell_h, min((gy + 1) * cell_h, sh)):
                for px in range(gx * cell_w, min((gx + 1) * cell_w, sw)):
                    cell_pixels.append(pixels[py * sw + px])
            
            if not cell_pixels:
                grid_density.append(0)
                continue
            
            # Variance = how much this cell differs from neighbors
            avg_r = sum(p[0] for p in cell_pixels) / len(cell_pixels)
            avg_g = sum(p[1] for p in cell_pixels) / len(cell_pixels)
            avg_b = sum(p[2] for p in cell_pixels) / len(cell_pixels)
            
            variance = sum(
                abs(p[0] - avg_r) + abs(p[1] - avg_g) + abs(p[2] - avg_b)
                for p in cell_pixels
            ) / (len(cell_pixels) * 3)
            
            grid_density.append(variance)
    
    max_density = max(grid_density) if grid_density else 1
    grid_normalized = [d / max_density for d in grid_density]
    
    # Empty zones (very low density)
    empty_threshold = 0.15
    empty_cells = sum(1 for d in grid_normalized if d < empty_threshold)
    empty_ratio = empty_cells / len(grid_normalized)
    
    # ── 3. Find best focal point (highest density area) ──
    best_cell = 0
    best_score = 0
    for i, d in enumerate(grid_normalized):
        gx = i % grid_w
        gy = i // grid_w
        # Prefer center cells slightly
        center_bonus = 1 - abs(gx - grid_w/2) / grid_w * 0.2
        score = d * center_bonus
        if score > best_score:
            best_score = score
            best_cell = i
    
    focal_gx = best_cell % grid_w
    focal_gy = best_cell // grid_w
    focal_x = (focal_gx + 0.5) / grid_w
    focal_y = (focal_gy + 0.5) / grid_h
    
    # ── 4. Find SECONDARY focal point (for pan moves) ──
    secondary_score = 0
    secondary_cell = best_cell
    for i, d in enumerate(grid_normalized):
        if abs(i - best_cell) < 3:
            continue  # Skip neighbors of primary
        if d > secondary_score:
            secondary_score = d
            secondary_cell = i
    sec_gx = secondary_cell % grid_w
    sec_gy = secondary_cell // grid_w
    focal2_x = (sec_gx + 0.5) / grid_w
    focal2_y = (sec_gy + 0.5) / grid_h
    
    # ── 5. Visual interest score (0-100) ──
    # Factors: color variety, content density, low empty ratio, good brightness
    interest_score = 0
    interest_score += min(color_variety * 5000, 30)  # Color variety: 0-30
    interest_score += (1 - empty_ratio) * 30  # Fullness: 0-30
    interest_score += min(avg_brightness / 128, 1) * 20 if not is_dark else 15  # Brightness: 0-20
    interest_score += min(best_score * 100, 20)  # Focal strength: 0-20
    
    interest_score = min(100, round(interest_score))
    
    # ── 6. Recommended camera move based on content ──
    dx = focal2_x - focal_x
    dy = focal2_y - focal_y
    distance = math.sqrt(dx*dx + dy*dy)
    
    if distance < 0.15:
        camera_move = 'zoom_in'  # Single focal point → zoom in
    elif abs(dx) > abs(dy) * 1.5:
        camera_move = 'pan_right' if dx > 0 else 'pan_left'
    elif abs(dy) > abs(dx) * 1.5:
        camera_move = 'pan_down' if dy > 0 else 'pan_up'
    elif distance > 0.3:
        camera_move = 'pull_out'  # Wide content → pull out to show all
    else:
        camera_move = 'center'
    
    # ── 7. Quality verdict ──
    issues = []
    if empty_ratio > 0.5:
        issues.append('too_empty')
    if avg_brightness < 30:
        issues.append('too_dark')
    if color_variety < 0.01:
        issues.append('monochrome')
    if interest_score < 30:
        issues.append('low_interest')
    
    return {
        'path': os.path.basename(path),
        'size': f'{w}x{h}',
        'interest_score': interest_score,
        'avg_brightness': round(avg_brightness, 1),
        'is_dark_mode': is_dark,
        'color_variety': round(color_variety * 1000, 2),
        'empty_ratio': round(empty_ratio, 2),
        'focal': {'x': round(focal_x, 3), 'y': round(focal_y, 3)},
        'focal2': {'x': round(focal2_x, 3), 'y': round(focal2_y, 3)},
        'camera_move': camera_move,
        'grid_density': [round(d, 2) for d in grid_normalized],
        'issues': issues,
        'verdict': 'good' if interest_score >= 50 and not issues else ('usable' if interest_score >= 30 else 'reject'),
    }


def plan_narrative(analyses):
    """
    Ordonne les captures pour raconter une histoire.
    
    Narrative arc (like Apple/Linear/Stripe):
    1. HOOK: Best visual (highest interest score) — grab attention
    2. FEATURE 1: Second best — show a key feature
    3. FEATURE 2: Third best — another angle/feature  
    4. PROOF/CONTEXT: Social proof or context shot
    5. (Outro CTA handled separately)
    """
    # Sort by interest score, but keep variety
    sorted_shots = sorted(analyses, key=lambda a: a['interest_score'], reverse=True)
    
    # Filter rejects
    usable = [a for a in sorted_shots if a['verdict'] != 'reject']
    if len(usable) < 2:
        usable = sorted_shots[:3]  # Fallback
    
    # Hook = highest interest
    # Then alternate between different camera moves for variety
    sequence = [usable[0]]
    remaining = usable[1:]
    
    while remaining and len(sequence) < 5:
        # Pick the one with the most different camera move
        last_move = sequence[-1]['camera_move']
        best = None
        best_diff = -1
        for a in remaining:
            # Prefer different moves + high score
            diff = 2 if a['camera_move'] != last_move else 0
            total = diff + a['interest_score'] / 100
            if total > best_diff:
                best_diff = total
                best = a
        if best:
            sequence.append(best)
            remaining.remove(best)
        else:
            break
    
    # Assign narrative roles
    roles = ['hook', 'feature_1', 'feature_2', 'proof', 'feature_3']
    for i, s in enumerate(sequence):
        s['narrative_role'] = roles[i] if i < len(roles) else f'extra_{i}'
    
    return sequence


def generate_storyboard(sequence, manifest, app_name, pitch, cta_text):
    """Génère le storyboard optimisé à partir de l'analyse."""
    
    # Detect theme from first usable capture
    first = sequence[0] if sequence else None
    bg = '#0a0f1a' if (first and first['is_dark_mode']) else '#0a0a0b'
    
    scenes = []
    for s in sequence:
        # Map camera_move to zoom preset
        preset_map = {
            'zoom_in': 'center',
            'pan_right': 'panRight',
            'pan_left': 'panLeft',
            'pan_down': 'panDown',
            'pan_up': 'panUp',
            'pull_out': 'pullOut',
            'center': 'center',
        }
        
        # Duration based on narrative role
        duration_map = {'hook': 4, 'feature_1': 4, 'feature_2': 4, 'proof': 3, 'feature_3': 4}
        duration = duration_map.get(s['narrative_role'], 4)
        
        # Find caption from manifest
        manifest_entry = None
        for c in manifest.get('captures', []):
            if c['file'] == s['path']:
                manifest_entry = c
                break
        
        # Generate caption based on role + detected texts
        texts = manifest_entry.get('texts', []) if manifest_entry else []
        role = s['narrative_role']
        
        captions = {
            'hook': f'Découvrez {app_name}',
            'feature_1': 'Conçu pour la performance',
            'feature_2': 'Une interface pensée pour vous',
            'proof': 'Approuvé par les professionnels',
            'feature_3': 'Tout ce dont vous avez besoin',
        }
        
        subtitles = {
            'hook': pitch or '',
            'feature_1': '',
            'feature_2': '',
            'proof': '',
            'feature_3': '',
        }
        
        # Try to use actual UI text as caption if relevant
        if texts:
            # Find the most "title-like" text (short, capitalized)
            for t in texts[:5]:
                if 10 < len(t) < 50 and not t.islower():
                    captions[role] = t
                    break
        
        scenes.append({
            'src': f'captures/{s["path"]}',
            'caption': captions.get(role, ''),
            'subtitle': subtitles.get(role, ''),
            'zoomPreset': preset_map.get(s['camera_move'], 'center'),
            'transitionOut': 'crossDissolve' if role != 'proof' else 'blurDissolve',
            'durationSeconds': duration,
            'focal': s['focal'],
            'analysis': {
                'interest_score': s['interest_score'],
                'camera_move': s['camera_move'],
                'narrative_role': role,
            },
        })
    
    return {
        'appName': app_name,
        'pitch': pitch,
        'ctaText': cta_text,
        'generatedAt': '2026-08-02T17:00:00Z',
        'style': {
            'bgColor': bg,
            'accentColor': '#f59e0b',
            'fontFamily': 'Inter, system-ui, sans-serif',
            'captionSize': 56,
            'subtitleSize': 28,
        },
        'scenes': scenes,
    }


def main():
    captures_dir = sys.argv[1] if len(sys.argv) > 1 else 'output/zefil_captures'
    app_name = sys.argv[2] if len(sys.argv) > 2 else 'ZEFIL Terrain'
    pitch = sys.argv[3] if len(sys.argv) > 3 else 'Gérez vos chantiers fibre sur le terrain'
    cta = sys.argv[4] if len(sys.argv) > 4 else 'Déployer plus vite'
    
    # Load manifest
    manifest_path = os.path.join(captures_dir, 'capture_manifest.json')
    with open(manifest_path) as f:
        manifest = json.load(f)
    
    print(f'\n🔬 PRE-RENDER ANALYSIS ENGINE')
    print(f'   App: {app_name}')
    print(f'   Captures: {len(manifest["captures"])}\n')
    
    # Analyze each screenshot
    analyses = []
    for c in manifest['captures']:
        img_path = os.path.join(captures_dir, c['file'])
        if not os.path.exists(img_path):
            continue
        result = analyze_image(img_path)
        result['path'] = c['file']
        result['texts'] = c.get('texts', [])
        result['description'] = c.get('description', '')
        analyses.append(result)
        
        bar = '█' * (result['interest_score'] // 10) + '░' * (10 - result['interest_score'] // 10)
        print(f'   {c["file"][:30]:30s} {bar} {result["interest_score"]:3d}/100  '
              f'{result["verdict"]:8s} cam={result["camera_move"]:10s} '
              f'focal=({result["focal"]["x"]:.2f},{result["focal"]["y"]:.2f})')
    
    if not analyses:
        print('\n❌ Aucune capture trouvée')
        return
    
    # Plan narrative
    sequence = plan_narrative(analyses)
    
    print(f'\n📋 PLAN NARRATIF:')
    for i, s in enumerate(sequence):
        print(f'   {i+1}. [{s["narrative_role"]:12s}] {s["path"][:30]:30s} '
              f'score={s["interest_score"]:3d} cam={s["camera_move"]}')
    
    # Generate storyboard
    storyboard = generate_storyboard(sequence, manifest, app_name, pitch, cta)
    
    # Copy captures to public/
    public_dir = 'public/captures'
    os.makedirs(public_dir, exist_ok=True)
    import shutil
    for c in manifest['captures']:
        src = os.path.join(captures_dir, c['file'])
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(public_dir, c['file']))
    
    # Save outputs
    with open('output/storyboard_optimized.json', 'w') as f:
        json.dump(storyboard, f, ensure_ascii=False, indent=2)
    
    analysis_report = {
        'appName': app_name,
        'totalCaptures': len(analyses),
        'selectedCount': len(sequence),
        'rejectedCount': len(analyses) - len(sequence),
        'analyses': analyses,
        'narrative': [{'role': s['narrative_role'], 'file': s['path'], 'score': s['interest_score']} for s in sequence],
    }
    with open('output/analysis.json', 'w') as f:
        json.dump(analysis_report, f, ensure_ascii=False, indent=2)
    
    print(f'\n✅ PRE-RENDER ANALYSIS TERMINÉ')
    print(f'   {len(sequence)} scènes sélectionnées sur {len(analyses)} captures')
    print(f'   Storyboard: output/storyboard_optimized.json')
    print(f'   Analyse: output/analysis.json\n')


if __name__ == '__main__':
    main()
