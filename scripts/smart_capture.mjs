#!/usr/bin/env node
/**
 * Smart Capture Bot — doesn't just screenshot, it INTERACTS with the app:
 * fills forms, clicks buttons, hovers cards, scrolls sections.
 *
 * This produces captures that show the app IN ACTION, not empty states.
 *
 * Strategy:
 *   1. Open home, wait for render
 *   2. Discover interactive elements (buttons, inputs, links, cards)
 *   3. For each meaningful interaction:
 *      a. Hover the element (triggers hover states, tooltips, animations)
 *      b. Capture before/after
 *   4. Click primary CTAs and capture the result
 *   5. Fill any visible inputs with placeholder/demo text
 *
 * Output: richer captures with real UI states + a manifest with descriptions.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const appUrl = args[0];
if (!appUrl) {
  console.error('Usage: node scripts/smart_capture.mjs <app-url> [--out dir]');
  process.exit(1);
}
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'output/captures';
const VIEWPORT = { width: 1920, height: 1080 };

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
});
const page = await context.newPage();

console.log(`\n🤖 Smart Capture Bot — ${appUrl}\n`);

// Enable console logging from the page
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`   [page error] ${msg.text().slice(0, 80)}`);
});

await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);

const captures = [];
let captureIdx = 0;
let globalDesign = null;

async function capture(route, description) {
  const safeName = `${route.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'home'}_${captureIdx}`;
  const file = path.join(outDir, `screen_${safeName}.png`);
  await page.screenshot({ path: file, fullPage: false });

  const live = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const texts = Array.from(document.querySelectorAll('h1, h2, h3, button, a, [class*="title"], [class*="label"], [class*="card"]'))
      .map((el) => el.textContent?.trim())
      .filter((t) => t && t.length >= 2 && t.length <= 80)
      .slice(0, 20);

    let focal = { x: 0.5, y: 0.42 };
    let bestScore = 0;
    for (const el of document.querySelectorAll('main *, [class*="card"], [class*="panel"], img, canvas, video, [class*="preview"]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 80 || r.top < 0) continue;
      const style = getComputedStyle(el);
      let score = (r.width * r.height) / 100000;
      if (style.boxShadow !== 'none') score += 2;
      if (style.backgroundImage !== 'none') score += 1.5;
      if (['IMG', 'CANVAS', 'VIDEO'].includes(el.tagName)) score += 3;
      if (score > bestScore) {
        bestScore = score;
        focal = {
          x: Math.round(((r.left + r.width / 2) / innerWidth) * 100) / 100,
          y: Math.round(((r.top + r.height / 2) / innerHeight) * 100) / 100,
        };
      }
    }

    return { bgColor: body.backgroundColor, color: body.color, fontFamily: body.fontFamily, texts: [...new Set(texts)], focal };
  });

  captures.push({
    route,
    url: page.url(),
    file: path.basename(file),
    width: VIEWPORT.width * 2,
    height: VIEWPORT.height * 2,
    focal: live.focal,
    texts: live.texts,
    description,
    title: await page.title(),
  });

  if (!globalDesign || Object.keys(live).length > 5) globalDesign = live;
  captureIdx++;
  console.log(`   📸 ${safeName.padEnd(25)} ${description}`);
  return live;
}

// ── 1. Capture the home/dashboard ──────────────────────────
await capture('/', 'Dashboard principal');

// ── 2. Hover interactive cards to trigger hover states ─────
const cards = await page.$$('[class*="card"], [class*="project"], [class*="item"]');
console.log(`\n   ${cards.length} éléments interactifs détectés`);
for (let i = 0; i < Math.min(3, cards.length); i++) {
  try {
    await cards[i].hover({ timeout: 2000 });
    await page.waitForTimeout(400);
    await capture('/', `Hover carte ${i + 1}`);
  } catch {}
}

// ── 3. Click primary CTA buttons ───────────────────────────
const buttons = await page.$$('button, [role="button"], a[href]');
const ctaTexts = ['nouvelle', 'créer', 'générer', 'analyser', 'ajouter', 'new', 'create', 'start'];
let clickCount = 0;
for (const btn of buttons) {
  if (clickCount >= 3) break;
  try {
    const text = (await btn.textContent())?.trim().toLowerCase() || '';
    if (!ctaTexts.some((t) => text.includes(t))) continue;
    console.log(`   🖱️  Clic: "${text}"`);
    await btn.click({ timeout: 3000 });
    await page.waitForTimeout(2000);
    await capture('/', `Après clic: ${text.slice(0, 30)}`);
    clickCount++;
  } catch {}
}

// ── 4. Fill visible inputs with demo content ────────────────
const inputs = await page.$$('input[type="text"], input:not([type]), textarea');
let inputCount = 0;
for (const input of inputs) {
  if (inputCount >= 3) break;
  try {
    const placeholder = await input.getAttribute('placeholder');
    const demoValue = placeholder || 'Demo Content';
    await input.fill(demoValue, { timeout: 2000 });
    await page.waitForTimeout(300);
    inputCount++;
  } catch {}
}
if (inputCount > 0) {
  await page.waitForTimeout(800);
  await capture('/', `Champs remplis (${inputCount} inputs)`);
}

// ── 5. Scroll to reveal more content ───────────────────────
for (const direction of ['down', 'up']) {
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.5));
  await page.waitForTimeout(500);
}
await capture('/', 'Après scroll');

// ── 6. Navigate to other routes if they work ───────────────
const navLinks = await page.$$eval('a[href^="/"]', (els) =>
  els.map((e) => ({ href: e.getAttribute('href'), text: e.textContent?.trim() }))
);
const tried = new Set(['/']);
for (const link of navLinks) {
  if (tried.has(link.href) || tried.size > 4) continue;
  tried.add(link.href);
  try {
    await page.goto(new URL(link.href, appUrl).href, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const bodyLen = await page.evaluate(() => document.body?.innerText?.trim().length || 0);
    if (/404|NOT_FOUND/i.test(await page.title()) || bodyLen < 20) {
      console.log(`   ⏭️  ${link.href} — page d'erreur/vide`);
      continue;
    }
    await capture(link.href, `Navigation: ${link.text || link.href}`);

    // Also try interacting on this page
    const pageButtons = await page.$$('button, [role="button"]');
    for (let i = 0; i < Math.min(2, pageButtons.length); i++) {
      try {
        await pageButtons[i].hover({ timeout: 1500 });
        await page.waitForTimeout(300);
      } catch {}
    }
    await capture(link.href, `${link.text || link.href} — après interaction`);
  } catch {}
}

await browser.close();

// ── Manifest ───────────────────────────────────────────────
const manifest = {
  appUrl,
  capturedAt: new Date().toISOString(),
  viewport: VIEWPORT,
  captures,
  liveDesign: globalDesign,
};

await writeFile(path.join(outDir, 'capture_manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\n📦 ${captures.length} captures intelligentes`);
console.log(`   ${Object.keys(globalDesign || {}).length > 0 ? 'Design live OK' : 'Pas de design détecté'}`);
console.log('\n✅ SMART CAPTURE TERMINÉ\n');
