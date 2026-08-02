#!/usr/bin/env node
/**
 * INTELLIGENT CAPTURE BOT
 * =======================
 * Utilise l'analyse de l'app pour capturer les BONNES pages
 * avec les BONNES interactions.
 *
 * Au lieu de juste taper l'URL d'accueil, il:
 * 1. Lit le plan narratif (routes + tabs + interactions)
 * 2. Navigue vers chaque route
 * 3. Clique sur les onglets spécifiés
 * 4. Attend le chargement
 * 5. Capture avec le bon timing
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const APP_URL = process.argv[2] || 'https://zefil-terrain.vercel.app';
const OUTPUT_DIR = process.argv[3] || 'output/zefil_captures_v2';
const ANALYSIS_PATH = process.argv[4] || 'output/app_analysis.json';

// Read analysis
import { readFileSync } from 'fs';
const analysis = JSON.parse(readFileSync(ANALYSIS_PATH, 'utf-8'));
const narrative = analysis.narrative;

console.log('\n🤖 INTELLIGENT CAPTURE BOT');
console.log(`   App: ${narrative.appName}`);
console.log(`   URL: ${APP_URL}`);
console.log(`   Scenes planifiées: ${narrative.scenes.length}\n`);

mkdirSync(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const captures = [];

for (let i = 0; i < narrative.scenes.length; i++) {
  const scene = narrative.scenes[i];
  const route = scene.route;
  const url = `${APP_URL}${route === '/' ? '' : route}`;
  const filename = `scene_${i}_${scene.tab || 'page'}.png`;

  console.log(`   [${i + 1}/${narrative.scenes.length}] ${url}`);
  console.log(`     Caption: "${scene.caption}"`);

  try {
    // Navigate
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000); // Let React render + data load

    // Click on tab if specified
    if (scene.tab) {
      console.log(`     → Clic onglet: "${scene.tab}"`);
      // Try to find and click the tab
      const tabSelector = `text="${scene.tab}"`;
      try {
        await page.click(tabSelector, { timeout: 3000 });
        await page.waitForTimeout(1500); // Wait for tab content to load
      } catch (e) {
        // Try partial match
        try {
          await page.evaluate((tabText) => {
            const btns = document.querySelectorAll('button, [role="tab"], .tab, nav a');
            for (const b of btns) {
              if (b.textContent.includes(tabText)) {
                b.click();
                break;
              }
            }
          }, scene.tab);
          await page.waitForTimeout(1500);
        } catch (e2) {
          console.log(`     ⚠ Onglet "${scene.tab}" non trouvé`);
        }
      }
    }

    // Interaction if specified
    if (scene.interaction === 'hover') {
      await page.mouse.move(960, 540);
      await page.waitForTimeout(500);
    }

    // Capture
    await page.screenshot({
      path: join(OUTPUT_DIR, filename),
      fullPage: false,
    });

    // Verify capture is not blank/error
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    const has404 = bodyText.includes('404') || bodyText.includes('not found');
    const isEmpty = bodyText.trim().length < 50;

    captures.push({
      file: filename,
      scene_index: i,
      caption: scene.caption,
      subtitle: scene.subtitle || '',
      route,
      tab: scene.tab || '',
      narrative_role: ['hook', 'feature_1', 'feature_2', 'feature_3', 'proof', 'feature_4'][i] || 'extra',
      body_text_preview: bodyText.substring(0, 200).replace(/\n/g, ' '),
      has_content: !isEmpty && !has404,
    });

    console.log(`     ✅ Captured (${has404 ? '⚠ 404' : isEmpty ? '⚠ empty' : 'OK'})\n`);

  } catch (e) {
    console.log(`     ❌ Error: ${e.message.substring(0, 80)}\n`);
    captures.push({
      file: filename,
      scene_index: i,
      caption: scene.caption,
      subtitle: scene.subtitle || '',
      route,
      tab: scene.tab || '',
      narrative_role: 'error',
      error: e.message.substring(0, 100),
      has_content: false,
    });
  }
}

await browser.close();

// Save manifest
import { writeFileSync } from 'fs';
const manifest = {
  appUrl: APP_URL,
  appName: narrative.appName,
  captureDate: new Date().toISOString(),
  totalCaptures: captures.length,
  captures,
};
writeFileSync(join(OUTPUT_DIR, 'capture_manifest.json'), JSON.stringify(manifest, null, 2));

const goodCount = captures.filter(c => c.has_content).length;
console.log(`\n✅ CAPTURE TERMINÉ`);
console.log(`   ${goodCount}/${captures.length} captures avec contenu\n`);

if (goodCount < captures.length) {
  console.log('⚠ Captures sans contenu:');
  for (const c of captures.filter(c => !c.has_content)) {
    console.log(`   ${c.file}: ${c.error || 'empty or 404'}`);
  }
}
