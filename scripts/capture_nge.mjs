import { chromium } from 'playwright';

const APP_URL = 'http://localhost:4020';
const EMAIL = 'achauvet@nge.fr';
const PASSWORD = 'Jaimepaco.307';
const OUT = '/Users/arnaud/app-promo-studio/capture/nge';

// Routes définies dans App.tsx — capture par URL directe
const routes = [
  { name: '01_dashboard',     path: '/',                    wait: 4000 },
  { name: '02_stock',         path: '/stock',               wait: 3000 },
  { name: '03_tourets',       path: '/tourets',             wait: 3000 },
  { name: '04_prepa_cmdes',   path: '/preparation-commande', wait: 4000 },
  { name: '05_reception_ia',  path: '/reception-ia',        wait: 3000 },
  { name: '06_chantiers',     path: '/suivi-chantiers',     wait: 3000 },
  { name: '07_devis',         path: '/devis',               wait: 3000 },
  { name: '08_rapports',      path: '/rapports',            wait: 3000 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1. LOGIN
  console.log('🔐 Connexion...');
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('✅ Connecté sur:', await page.title());

  // 2. CAPTURE PAR ROUTE
  for (const r of routes) {
    console.log(`📸 ${r.name} → ${r.path}`);
    try {
      await page.goto(`${APP_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(r.wait);

      // Vérifier qu'on n'est pas sur la page de login
      const isLogin = await page.locator('input[type="email"]').count();
      if (isLogin > 0) {
        console.log(`   ⚠️ Redirigé vers login, skip`);
        continue;
      }

      await page.screenshot({ path: `${OUT}/${r.name}.png`, fullPage: false });
      console.log(`   ✅ Capturé`);
    } catch (e) {
      console.log(`   ⚠️ ${e.message.substring(0, 100)}`);
    }
  }

  // 3. CAPTURES SPÉCIALES — scroll dans le dashboard pour les sections du bas
  console.log('📸 Dashboard scroll (engagement + alertes)...');
  try {
    await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/01b_dashboard_engagement.png`, fullPage: false });
    console.log('   ✅ Capturé');
  } catch(e) {
    console.log(`   ⚠️ ${e.message.substring(0, 80)}`);
  }

  await browser.close();
  console.log('\n🎬 Terminé !');
  const files = await import('fs').then(fs => fs.readdirSync(OUT));
  console.log(`${files.length} fichiers dans ${OUT}`);
  files.forEach(f => console.log(`  ${f}`));
}

main().catch(e => { console.error(e); process.exit(1); });
