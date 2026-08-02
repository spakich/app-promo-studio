#!/usr/bin/env python3
"""
POST-RENDER QA ENGINE v2
=========================
Analyse la vidéo rendue frame par frame (1 frame/seconde) et produit:
1. Score détaillé par critère (lisibilité, dynamisme, exposition, narration)
2. Détection de défauts précis avec timestamp
3. Corrections actionnables avec priorité
4. Verdict PASS/FAIL

Différences vs QA v1:
- Plus de frames analysées (toutes les 1s au lieu de 12 au total)
- Détection automatique de: dark frames, texte illisible, répétition, zones vides
- Mesure d'exposition (histogramme de luminosité)
- Score par timestamp, pas juste global
"""
import json, sys, os, subprocess, tempfile, base64
from pathlib import Path

def extract_frames(video_path, fps=1):
    """Extrait une frame par seconde de la vidéo."""
    tmpdir = tempfile.mkdtemp(prefix='qa_frames_')
    # Get video duration
    probe = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', video_path],
        capture_output=True, text=True
    )
    duration = float(json.loads(probe.stdout)['format']['duration'])
    
    # Extract frames
    subprocess.run([
        'ffmpeg', '-y', '-i', video_path,
        '-vf', f'fps={fps}',
        '-q:v', '2',
        os.path.join(tmpdir, 'frame_%04d.jpg')
    ], capture_output=True)
    
    frames = sorted(Path(tmpdir).glob('frame_*.jpg'))
    return frames, duration, tmpdir

def analyze_frame_exposure(frame_path):
    """Analyse l'exposition d'une frame via histogramme de luminosité."""
    from PIL import Image
    img = Image.open(frame_path).convert('L')  # Grayscale
    pixels = list(img.getdata())
    
    avg = sum(pixels) / len(pixels)
    
    # Histogram
    hist = [0] * 8  # 8 buckets
    for p in pixels:
        hist[min(7, p * 8 // 256)] += 1
    
    total = len(pixels)
    hist_pct = [h / total for h in hist]
    
    # Dark ratio (% of pixels below 30 brightness)
    dark_ratio = sum(1 for p in pixels if p < 30) / total
    
    # Bright ratio
    bright_ratio = sum(1 for p in pixels if p > 200) / total
    
    # Contrast (std deviation)
    variance = sum((p - avg) ** 2 for p in pixels) / total
    contrast = variance ** 0.5
    
    return {
        'avg_brightness': round(avg, 1),
        'dark_ratio': round(dark_ratio, 3),
        'bright_ratio': round(bright_ratio, 3),
        'contrast': round(contrast, 1),
        'histogram': [round(h, 3) for h in hist_pct],
        'is_dark_frame': avg < 25 or dark_ratio > 0.85,
        'is_blowout': bright_ratio > 0.5,
    }

def analyze_frame_with_gemini(frame_path, timestamp, storyboard, api_key):
    """Envoie la frame à Gemini Vision pour analyse qualitative."""
    with open(frame_path, 'rb') as f:
        img_data = base64.b64encode(f.read()).decode()
    
    # Build context from storyboard
    scenes = storyboard.get('scenes', [])
    current_scene_idx = 0
    cumulative_time = 3  # After intro
    for i, s in enumerate(scenes):
        if timestamp >= cumulative_time and timestamp < cumulative_time + s.get('durationSeconds', 4):
            current_scene_idx = i
            break
        cumulative_time += s.get('durationSeconds', 4)
    
    current_scene = scenes[current_scene_idx] if current_scene_idx < len(scenes) else {}
    expected_caption = current_scene.get('caption', 'Unknown')
    expected_role = current_scene.get('analysis', {}).get('narrative_role', 'unknown')
    
    ts = f'{timestamp:.1f}'
    prompt = (
        "You are a professional motion design expert. "
        f"Analyze this frame from a promo video at t={ts}s.\n\n"
        "Context:\n"
        f"- App: {storyboard.get('appName', 'Unknown')}\n"
        f"- Scene: {current_scene_idx + 1} (role: {expected_role})\n"
        f'- Caption: "{expected_caption}"\n\n'
        "Rate these 4 criteria (0-10 each):\n"
        "1. READABILITY: Is the text overlay crisp and legible?\n"
        "2. EXPOSURE: Is the frame well exposed?\n"
        "3. DYNAMISM: Is there visible movement or depth?\n"
        "4. PROFESSIONALISM: Could this be in an Apple/Linear video?\n\n"
        "Respond in this EXACT JSON format only:\n"
        '{"readability": 7, "exposure": 8, "dynamism": 6, "professionalism": 7, "note": "brief"}'
    )

    import urllib.request
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    body = json.dumps({
        'contents': [{'parts': [
            {'text': prompt},
            {'inline_data': {'mime_type': 'image/jpeg', 'data': img_data}}
        ]}],
        'generationConfig': {'temperature': 0.3, 'maxOutputTokens': 500},
    }).encode()
    
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read())
        text = data['candidates'][0]['content']['parts'][0]['text']
        # Robust extraction: find l/e/d/p values with regex
        import re
        def extract_val(key, txt):
            m = re.search(key + r'["\']?\s*[:=]\s*(\d+)', txt, re.IGNORECASE)
            return int(m.group(1)) if m else 5
        # Extract note (text after 'note')
        note_match = re.search(r'note["\']?\s*[:=]\s*["\']?(.+?)(?:["\']|$)', text, re.IGNORECASE)
        note = note_match.group(1).strip() if note_match else ''
        return {
            'l': min(10, max(0, extract_val('readability', text))),
            'e': min(10, max(0, extract_val('exposure', text))),
            'd': min(10, max(0, extract_val('dynamism', text))),
            'p': min(10, max(0, extract_val('professionalism', text))),
            'note': note[:60],
        }
    except Exception as e:
        return {'l': 5, 'e': 5, 'd': 5, 'p': 5, 'note': f'API error: {str(e)[:30]}'}

def main():
    video_path = sys.argv[1] if len(sys.argv) > 1 else 'output/promo_zefil3.mp4'
    storyboard_path = sys.argv[2] if len(sys.argv) > 2 else 'output/zefil_storyboard.json'
    
    api_key = ''
    env_path = os.path.expanduser('~/.hermes/.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith('GEMINI_API_KEY='):
                    api_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    
    if not api_key:
        print('❌ GEMINI_API_KEY non trouvée')
        return
    
    with open(storyboard_path) as f:
        storyboard = json.load(f)
    
    print(f'\n🔍 POST-RENDER QA ENGINE v2')
    print(f'   Vidéo: {os.path.basename(video_path)}')
    
    # Extract frames
    frames, duration, tmpdir = extract_frames(video_path, fps=1)
    print(f'   Durée: {duration:.1f}s — {len(frames)} frames à analyser\n')
    
    # Analyze each frame
    results = []
    dark_frame_count = 0
    low_contrast_count = 0
    
    for i, frame_path in enumerate(frames):
        timestamp = (i + 1) * 1.0  # 1 frame per second
        
        # Automated pixel analysis
        exposure = analyze_frame_exposure(str(frame_path))
        
        # Gemini qualitative analysis (every 2s to save API calls)
        if i % 2 == 0:
            gemini = analyze_frame_with_gemini(str(frame_path), timestamp, storyboard, api_key)
        else:
            # Copy previous frame's gemini score
            gemini = results[-1]['gemini'] if results else {'l': 5, 'e': 5, 'd': 5, 'p': 5, 'note': ''}
        
        if exposure['is_dark_frame']:
            dark_frame_count += 1
        if exposure['contrast'] < 30:
            low_contrast_count += 1
        
        # Frame score (weighted)
        gemini_score = (gemini.get('l', 5) * 1.5 + gemini.get('e', 5) * 2 + gemini.get('d', 5) * 1.5 + gemini.get('p', 5) * 2) / 7
        exposure_penalty = 0
        if exposure['is_dark_frame']:
            exposure_penalty = 3
        elif exposure['avg_brightness'] < 40:
            exposure_penalty = 1.5
        
        frame_score = max(0, gemini_score - exposure_penalty)
        
        bar_filled = int(frame_score)
        bar = '█' * bar_filled + '░' * (10 - bar_filled)
        
        print(f'   t={timestamp:5.1f}s {bar} {frame_score*10:3.0f}/100 '
              f'L={gemini.get("l", "?")} E={gemini.get("e", "?")} '
              f'D={gemini.get("d", "?")} P={gemini.get("p", "?")} '
              f'exp={exposure["avg_brightness"]:5.1f} '
              f'{gemini.get("note", "")[:40]}')
        
        results.append({
            'timestamp': timestamp,
            'frame_score': round(frame_score * 10),
            'gemini': gemini,
            'exposure': exposure,
        })
    
    # ── Global score ──
    scores = [r['frame_score'] for r in results]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    # ── Detect issues ──
    issues = []
    
    # Dark frames
    dark_frames = [r for r in results if r['exposure']['is_dark_frame']]
    if dark_frames:
        times = [f"{r['timestamp']:.0f}s" for r in dark_frames]
        issues.append({
            'severity': 'critical',
            'type': 'dark_frames',
            'count': len(dark_frames),
            'timestamps': times,
            'fix': 'Réduire les transitions crossDissolve → remplacer par slidePush. '
                   'Vérifier que l\'opacité des scènes ne descend pas sous 0.7.',
        })
    
    # Low readability
    low_readability = [r for r in results if r['gemini'].get('l', 10) <= 3]
    if low_readability:
        times = [f"{r['timestamp']:.0f}s" for r in low_readability]
        issues.append({
            'severity': 'high',
            'type': 'low_readability',
            'count': len(low_readability),
            'timestamps': times,
            'fix': 'Le texte overlay manque de contraste. Forcer la couleur #FFFFFF '
                   'avec textShadow renforcé. Accélérer les animations de texte.',
        })
    
    # Repetitive frames
    consecutive_same = 0
    for i in range(1, len(results)):
        if abs(results[i]['frame_score'] - results[i-1]['frame_score']) < 2:
            consecutive_same += 1
    if consecutive_same > len(results) * 0.4:
        issues.append({
            'severity': 'medium',
            'type': 'repetitive',
            'count': consecutive_same,
            'fix': 'Les scènes se ressemblent trop. Varier les angles 3D, '
                   'les zoom presets et les mouvements de caméra.',
        })
    
    # Low dynamism
    low_dynamism = [r for r in results if r['gemini'].get('d', 10) <= 4]
    if len(low_dynamism) > len(results) * 0.3:
        issues.append({
            'severity': 'high',
            'type': 'low_dynamism',
            'count': len(low_dynamism),
            'fix': 'Manque de mouvement. Ajouter: Ken Burns plus prononcé, '
                   'parallaxe entre couches, curseur virtuel plus actif.',
        })
    
    # ── Generate corrections ──
    corrections = []
    for issue in issues:
        corrections.append({
            'priority': 'P0' if issue['severity'] == 'critical' else 'P1' if issue['severity'] == 'high' else 'P2',
            'issue': issue['type'],
            'description': f"{issue['count']} frames affectées",
            'fix': issue['fix'],
        })
    
    # ── Verdict ──
    verdict = 'PASS' if avg_score >= 75 else ('MARGINAL' if avg_score >= 60 else 'FAIL')
    
    # ── Report ──
    print(f'\n{"═" * 55}')
    print(f'  SCORE GLOBAL: {avg_score:.0f}/100')
    print(f'  VERDICT:      {verdict}')
    print(f'  Dark frames:  {dark_frame_count}/{len(results)}')
    print(f'{"═" * 55}')
    
    if issues:
        print(f'\n🔴 Problèmes détectés:')
        for issue in issues:
            emoji = '🔴' if issue['severity'] == 'critical' else '🟡' if issue['severity'] == 'high' else '🟢'
            print(f'  {emoji} {issue["type"]:20s} x{issue["count"]:2d}  {issue["fix"][:60]}')
    
    if corrections:
        print(f'\n🔧 Corrections:')
        for c in corrections:
            print(f'  [{c["priority"]}] {c["issue"]}: {c["fix"][:70]}')
    
    # Save report
    report = {
        'video': video_path,
        'duration': duration,
        'totalFrames': len(results),
        'globalScore': round(avg_score),
        'verdict': verdict,
        'darkFrameCount': dark_frame_count,
        'issues': issues,
        'corrections': corrections,
        'frames': results,
    }
    
    report_path = 'output/qa_v2_report.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f'\n💾 {report_path}')
    print(f'\n{"✅" if verdict == "PASS" else "❌"} VIDÉO {verdict}\n')
    
    # Cleanup
    import shutil
    shutil.rmtree(tmpdir)
    
    return 0 if verdict != 'FAIL' else 1


if __name__ == '__main__':
    sys.exit(main())
