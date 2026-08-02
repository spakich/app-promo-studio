#!/usr/bin/env node
/**
 * App Capture Bot — opens the deployed app in a real (headless) Chromium,
 * navigates its routes, captures screenshots AND the rendered design truth
 * (computed styles), and detects visual focal points for the zoom engine.
 *
 * This is the DYNAMIC half of the magic pipeline:
 * static analysis reads the code, this reads what the app ACTUALLY renders.
 *
 * Usage:
 *   node scripts/capture_app.mjs <app-url> [--routes /,/editor] [--out output/captures] [--mobile]
 *
 * Output:
 *   <out>/capture_manifest.json — everything Remotion + the LLM need
 *   <out>/screen_*.png          — full-viewport screenshots per route
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const appUrl = args[0];
if (!appUrl) {
  console.error('Usage: node scripts/capture_app.mjs <app-url> [--routes a,b] [--out dir] [--mobile]');
  process.exit(1);
}
function argVal(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
}
const outDir = argVal('--out', 'output/captures');
const mobile = args.includes('--mobile');
const forcedRoutes = argVal('--routes', null);

const VIEWPORT = mobile ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2, // retina-quality captures
});
const page = await context.newPage();

console.log(`\n🤖 Capture bot — ${appUrl}`);
console.log(`   Viewport: ${VIEWPORT.width}x${VIEWPORT.height} @2x\n`);

// ── 1. Open home, let it render ──────────────────────────────
await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);

// ── 2. Discover internal routes from live links ──────────────
let routes = forcedRoutes
  ? forcedRoutes.split(',').map((r) => r.trim())
  : await page.evaluate(() => {
      const base = location.origin;
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter(Boolean)
        .filter((h) => h.startsWith('/') && !h.startsWith('//'))
        .filter((h) => !/\.(png|jpg|svg|css|js|ico|json)$/.test(h));
      return [...new Set(['/', ...links])].slice(0, 10);
    });

console.log(`📍 Routes découvertes: ${routes.join('  ')}\n`);

// ── 3. Capture each route + read rendered design truth ───────
const captures = [];
let globalDesign = null;

for (const route of routes) {
  const url = new URL(route, appUrl).href;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Skip error pages (404s, blank pages) — a promo video can't show those
    const pageState = await page.evaluate(() => ({
      statusText: document.body?.innerText?.slice(0, 300) || '',
      title: document.title,
      bodyLen: document.body?.innerText?.trim().length || 0,
    }));
    const isErrorPage =
      /404|NOT_FOUND|not found|This page could not be found/i.test(pageState.statusText) ||
      /404/i.test(pageState.title) ||
      pageState.bodyLen < 10;
    if (isErrorPage) {
      console.log(`   ⏭️  ${route.padEnd(20)} page d'erreur ou vide — ignorée`);
      continue;
    }

    const safeName = route === '/' ? 'home' : route.replace(/[^\w]+/g, '_');
    const file = path.join(outDir, `screen_${safeName}.png`);
    await page.screenshot({ path: file, fullPage: false });

    // Read the LIVE computed styles — the rendered truth
    const live = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const root = getComputedStyle(document.documentElement);

      // Collect CSS custom properties actually applied
      const cssVars = {};
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === ':root' && rule.style) {
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop.startsWith('--')) cssVars[prop] = rule.style.getPropertyValue(prop).trim();
              }
            }
          }
        } catch { /* cross-origin sheet */ }
      }

      // Text content for the LLM (visible, meaningful strings)
      const texts = Array.from(document.querySelectorAll('h1, h2, h3, button, a, [class*="title"], [class*="label"]'))
        .map((el) => el.textContent?.trim())
        .filter((t) => t && t.length >= 2 && t.length <= 80)
        .slice(0, 25);

      // Focal point: the most visually salient element (biggest colored/elevated block)
      let focal = { x: 0.5, y: 0.42 };
      let bestScore = 0;
      for (const el of document.querySelectorAll('main *, [class*="card"], [class*="panel"], img, canvas, video')) {
        const r = el.getBoundingClientRect();
        if (r.width < 100 || r.height < 80 || r.top < 0) continue;
        const style = getComputedStyle(el);
        let score = (r.width * r.height) / 100000;
        if (style.boxShadow !== 'none') score += 2;
        if (style.backgroundImage !== 'none') score += 1.5;
        if (['IMG', 'CANVAS', 'VIDEO'].includes(el.tagName)) score += 2;
        if (score > bestScore && r.left + r.width / 2 < innerWidth && r.top + r.height / 2 < innerHeight) {
          bestScore = score;
          focal = {
            x: Math.round(((r.left + r.width / 2) / innerWidth) * 100) / 100,
            y: Math.round(((r.top + r.height / 2) / innerHeight) * 100) / 100,
          };
        }
      }

      // Fonts actually rendered
      const fonts = new Set();
      document.querySelectorAll('body, h1, h2, h3, button').forEach((el) => {
        const f = getComputedStyle(el).fontFamily;
        if (f) fonts.add(f.split(',')[0].replace(/['"]/g, '').trim());
      });

      return {
        bgColor: body.backgroundColor,
        color: body.color,
        fontFamily: body.fontFamily,
        cssVars,
        texts: [...new Set(texts)],
        fonts: [...fonts].slice(0, 5),
        focal,
        title: document.title,
      };
    });

    captures.push({
      route,
      url,
      file: path.basename(file),
      width: VIEWPORT.width * 2,
      height: VIEWPORT.height * 2,
      focal: live.focal,
      texts: live.texts,
      title: live.title,
    });

    // Keep the richest CSS-var set as the global design truth
    if (!globalDesign || Object.keys(live.cssVars).length > Object.keys(globalDesign.cssVars).length) {
      globalDesign = live;
    }

    console.log(`   ✅ ${route.padEnd(20)} ${path.basename(file)}  (focal ${live.focal.x},${live.focal.y})`);
  } catch (e) {
    console.log(`   ⚠️  ${route}: ${e.message.slice(0, 60)}`);
  }
}

await browser.close();

// ── 4. Manifest = everything downstream needs ────────────────
const manifest = {
  appUrl,
  capturedAt: new Date().toISOString(),
  viewport: VIEWPORT,
  captures,
  liveDesign: globalDesign
    ? {
        bgColor: globalDesign.bgColor,
        color: globalDesign.color,
        fonts: globalDesign.fonts,
        cssVars: globalDesign.cssVars,
      }
    : null,
};

await writeFile(path.join(outDir, 'capture_manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\n📦 Manifest: ${path.join(outDir, 'capture_manifest.json')}`);
console.log(`   ${captures.length} captures · ${Object.keys(globalDesign?.cssVars || {}).length} CSS vars live · ${globalDesign?.fonts?.length || 0} polices live`);
console.log('\n✅ CAPTURE TERMINÉE\n');
