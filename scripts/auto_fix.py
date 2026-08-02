#!/usr/bin/env python3
"""
AUTO-FIX ENGINE
===============
Lit le rapport QA v2 et applique automatiquement les corrections
au storyboard et aux composants Remotion.

Boucle: QA report → corrections → re-render → QA → ... jusqu'à PASS (≥75)

Types de corrections gérées:
1. dark_frames → remplace crossDissolve/fadeToBlack par slidePush, raccourcit transitions
2. low_readability → force couleur texte #FFFFFF, textShadow renforcé
3. repetitive → varie les zoom presets et angles 3D entre scènes
4. low_dynamism → augmente Ken Burns, ajoute parallax
5. exposure issues → ajuste bgColor plus clair
"""
import json, sys, os, re, copy

def load_json(path):
    with open(path) as f:
        return json.load(f)

def save_json(data, path):
    with open(path, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def fix_dark_frames(storyboard, qa_report):
    """Remplace les transitions sombres par des mouvements éclatants."""
    changes = []
    scenes = storyboard.get('scenes', [])
    
    # Rotation of energetic transitions to avoid repetition
    energetic_transitions = ['slidePush', 'zoomThrough', 'wipe']
    
    for i, scene in enumerate(scenes):
        old_trans = scene.get('transitionOut', 'crossDissolve')
        if old_trans in ['crossDissolve', 'fadeToBlack', 'blurDissolve']:
            new_trans = energetic_transitions[i % len(energetic_transitions)]
            scene['transitionOut'] = new_trans
            changes.append(f'Scène {i+1}: {old_trans} → {new_trans}')
    
    # Also update intro/outro to be brighter
    style = storyboard.get('style', {})
    bg = style.get('bgColor', '#0a0a0b')
    if bg in ['#0a0a0b', '#0a0f1a', '#000000']:
        style['bgColor'] = '#0d1117'  # GitHub dark, not pitch black
        changes.append(f'bgColor: {bg} → #0d1117 (plus lumineux)')
    
    storyboard['style'] = style
    return changes

def fix_low_readability(storyboard, qa_report):
    """Force des captions ultra-lisibles."""
    changes = []
    style = storyboard.get('style', {})
    
    # Ensure high contrast
    old_caption = style.get('captionColor', '')
    style['captionColor'] = '#FFFFFF'
    style['captionShadow'] = '0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)'
    changes.append(f'Caption color forcé à #FFFFFF avec shadow renforcé')
    
    storyboard['style'] = style
    return changes

def fix_repetitive(storyboard, qa_report):
    """Varie les angles et mouements de caméra entre scènes."""
    changes = []
    scenes = storyboard.get('scenes', [])
    
    # Alternate zoom presets and 3D angles
    zoom_variants = ['center', 'panRight', 'panLeft', 'panDown', 'pullOut', 'zoomIn']
    angle_variants = [
        {'rotateX': -8, 'rotateY': -6, 'depth': 1200},
        {'rotateX': -5, 'rotateY': 4, 'depth': 1400},
        {'rotateX': -12, 'rotateY': 8, 'depth': 1000},
        {'rotateX': -6, 'rotateY': -10, 'depth': 1300},
        {'rotateX': -10, 'rotateY': 2, 'depth': 1500},
    ]
    
    for i, scene in enumerate(scenes):
        old_zoom = scene.get('zoomPreset', 'center')
        new_zoom = zoom_variants[i % len(zoom_variants)]
        if old_zoom != new_zoom:
            scene['zoomPreset'] = new_zoom
            changes.append(f'Scène {i+1}: zoom {old_zoom} → {new_zoom}')
        
        scene['camera3D'] = angle_variants[i % len(angle_variants)]
    
    return changes

def fix_low_dynamism(storyboard, qa_report):
    """Augmente le dynamisme de la caméra."""
    changes = []
    scenes = storyboard.get('scenes', [])
    
    for i, scene in enumerate(scenes):
        # Boost Ken Burns intensity
        scene['kenBurnsIntensity'] = 'high'
        # Add parallax flag
        scene['parallax'] = True
        # Vary entrance animations
        entrances = ['springZoom', 'flyIn', 'scaleUp', 'spinIn']
        scene['entrance'] = entrances[i % len(entrances)]
        changes.append(f'Scène {i+1}: Ken Burns high + entrance {entrances[i % len(entrances)]}')
    
    return changes

def fix_exposure(storyboard, qa_report):
    """Ajuste l'exposition globale."""
    changes = []
    style = storyboard.get('style', {})
    
    # Check if video is too dark overall
    frames = qa_report.get('frames', [])
    dark_count = sum(1 for f in frames if f.get('exposure', {}).get('is_dark_frame', False))
    
    if dark_count > len(frames) * 0.2:
        style['overlayOpacity'] = 0.7  # Reduce overlay darkness
        style['bgGradient'] = 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)'
        changes.append(f'Overlay opacity réduite + gradient plus clair')
    
    storyboard['style'] = style
    return changes

def apply_corrections(storyboard_path, qa_report_path, output_path=None):
    """Point d'entrée principal."""
    if output_path is None:
        base, ext = os.path.splitext(storyboard_path)
        output_path = f'{base}_fixed{ext}'
    
    storyboard = load_json(storyboard_path)
    qa_report = load_json(qa_report_path)
    
    all_changes = []
    
    # Process each issue by priority
    for issue in qa_report.get('issues', []):
        issue_type = issue.get('type', '')
        severity = issue.get('severity', '')
        
        if severity == 'critical' or issue_type == 'dark_frames':
            changes = fix_dark_frames(storyboard, qa_report)
            all_changes.extend(changes)
        
        if issue_type == 'low_readability':
            changes = fix_low_readability(storyboard, qa_report)
            all_changes.extend(changes)
        
        if issue_type == 'repetitive':
            changes = fix_repetitive(storyboard, qa_report)
            all_changes.extend(changes)
        
        if issue_type == 'low_dynamism':
            changes = fix_low_dynamism(storyboard, qa_report)
            all_changes.extend(changes)
    
    # Always check exposure
    exp_changes = fix_exposure(storyboard, qa_report)
    all_changes.extend(exp_changes)
    
    # Bump version
    storyboard['fixVersion'] = storyboard.get('fixVersion', 0) + 1
    
    save_json(storyboard, output_path)
    
    return all_changes, output_path

def main():
    storyboard_path = sys.argv[1] if len(sys.argv) > 1 else 'output/storyboard_optimized.json'
    qa_report_path = sys.argv[2] if len(sys.argv) > 2 else 'output/qa_v2_report.json'
    output_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    changes, out = apply_corrections(storyboard_path, qa_report_path, output_path)
    
    print(f'\n🔧 AUTO-FIX ENGINE')
    print(f'   Storyboard: {os.path.basename(storyboard_path)}')
    print(f'   QA Report: {os.path.basename(qa_report_path)}')
    print(f'   Fix version: → {out and "v" + str(load_json(out).get("fixVersion", 1))}\n')
    
    if changes:
        print(f'   {len(changes)} corrections appliquées:')
        for c in changes:
            print(f'   • {c}')
    else:
        print(f'   Aucune correction nécessaire')
    
    print(f'\n💾 {out}\n')

if __name__ == '__main__':
    main()
