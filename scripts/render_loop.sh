#!/usr/bin/env bash
#
# RENDER LOOP — boucle autonome de qualité
#
# Tant que le score QA < 75: pre-render → render → QA → auto-fix → re-render
#
set -e

cd "$(dirname "$0")/.."

CAPTURES_DIR=${1:-output/zefil_captures}
APP_NAME=${2:-"ZEFIL Terrain"}
PITCH=${3:-"Gérez vos chantiers fibre sur le terrain"}
CTA=${4:-"Déployer plus vite"}
MAX_ITERATIONS=${MAX_ITERATIONS:-5}
TARGET_SCORE=${TARGET_SCORE:-75}

echo "══════════════════════════════════════════════════"
echo "  🎬 RENDER LOOP — Auto-Quality Pipeline"
echo "  Target: ${TARGET_SCORE}/100 | Max iterations: ${MAX_ITERATIONS}"
echo "══════════════════════════════════════════════════"

SB="output/storyboard_optimized.json"
SB_FIXED="output/storyboard_fixed.json"
QA_REPORT="output/qa_v2_report.json"
VIDEO="output/promo_loop.mp4"
BEST_SCORE=0
BEST_VIDEO=""

for ITER in $(seq 1 $MAX_ITERATIONS); do
    echo ""
    echo "── Itération $ITER/$MAX_ITERATIONS ──"

    # ── Step 1: PRE-RENDER analysis (only on first iteration) ──
    if [ $ITER -eq 1 ]; then
        echo "🔬 PRE-RENDER analysis..."
        python3 scripts/pre_render_analysis.py "$CAPTURES_DIR" "$APP_NAME" "$PITCH" "$CTA"
        CURRENT_SB="$SB"
    else
        echo "🔧 AUTO-FIX (applying QA corrections)..."
        python3 scripts/auto_fix.py "$CURRENT_SB" "$QA_REPORT" "$SB_FIXED"
        CURRENT_SB="$SB_FIXED"
    fi

    # ── Step 2: RENDER ──
    echo "🎬 Rendering..."
    npx remotion render HorizontalPromo "$VIDEO" --props="$CURRENT_SB" 2>&1 | tail -1

    # ── Step 3: QA ──
    echo "🔍 QA analysis..."
    QA_OUTPUT=$(python3 scripts/qa_v2.py "$VIDEO" "$CURRENT_SB" 2>&1) || true
    SCORE=$(echo "$QA_OUTPUT" | grep "SCORE GLOBAL" | grep -oE '[0-9]+' | head -1)
    
    if [ -z "$SCORE" ]; then SCORE=0; fi
    
    echo "   → Score: ${SCORE}/100"
    
    # Track best
    if [ "$SCORE" -gt "$BEST_SCORE" ]; then
        BEST_SCORE=$SCORE
        cp "$VIDEO" "output/promo_best.mp4"
        BEST_VIDEO="output/promo_best.mp4"
        echo "   ⭐ Nouveau meilleur score!"
    fi

    # ── Check target ──
    if [ "$SCORE" -ge "$TARGET_SCORE" ]; then
        echo ""
        echo "✅ TARGET ATTEINT! Score: ${SCORE}/100"
        break
    fi
done

echo ""
echo "══════════════════════════════════════════════════"
echo "  🏁 RÉSULTAT FINAL"
echo "  Meilleur score: ${BEST_SCORE}/100"
echo "  Vidéo: output/promo_best.mp4"
echo "══════════════════════════════════════════════════"
