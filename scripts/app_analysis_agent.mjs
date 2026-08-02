#!/usr/bin/env node
/**
 * APP ANALYSIS AGENT
 * =================
 * Lit le code source d'une application et comprend:
 * 1. Les routes/pages disponibles
 * 2. Les fonctionnalités de chaque page (composants, actions)
 * 3. Le design DNA (couleurs, fonts, thème)
 * 4. Les textes/UI strings utilisés
 * 5. Le métier/domaine de l'app
 *
 * Sortie: analysis.json avec compréhension profonde de l'app
 * → utilisé par le storyboader pour des captions INTELLIGENTES
 * → utilisé par le capture bot pour visiter les BONNES pages
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

// ── Walk directory recursively ──
function walk(dir, exts = ['.tsx', '.ts', '.jsx', '.js', '.css']) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build') continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...walk(full, exts));
      } else if (exts.includes(extname(full))) {
        results.push(full);
      }
    }
  } catch (e) { /* skip */ }
  return results;
}

// ── Extract routes from React Router ──
function extractRoutes(files) {
  const routes = [];
  for (const f of files) {
    const content = readFileSync(f, 'utf-8');
    // Match path: '/something' or path="/something"
    const matches = content.matchAll(/path:\s*['"`]([^'"`]+)['"`]/g);
    for (const m of matches) {
      const path = m[1];
      // Find the component used for this route
      const elementMatch = content.match(new RegExp(`path:\\s*['"\`]${path.replace('/', '\\/')}['"\`].*?element:\\s*<(\\w+)`));
      routes.push({
        path,
        component: elementMatch ? elementMatch[1] : 'Unknown',
        file: f.split('/').slice(-2).join('/'),
      });
    }
  }
  return routes;
}

// ── Extract UI strings (labels, buttons, titles) ──
function extractUIStrings(files) {
  const strings = new Set();
  for (const f of files) {
    if (!f.endsWith('.tsx') && !f.endsWith('.jsx')) continue;
    const content = readFileSync(f, 'utf-8');

    // French text in JSX: >Texte ici< or placeholder="Texte" or label="Texte"
    const jsxText = content.matchAll(/>\s*([A-ZÀ-Ý][a-zA-ZÀ-ÿ\s°'"-]{4,60})\s*</g);
    for (const m of jsxText) strings.add(m[1].trim());

    // Placeholder text
    const placeholders = content.matchAll(/placeholder\s*=\s*["'`]([^"'`]{5,80})["'`]/g);
    for (const m of placeholders) strings.add(m[1].trim());

    // Button text
    const buttons = content.matchAll(/<button[^>]*>\s*([A-ZÀ-Ý][a-zA-ZÀ-ÿ\s-]{3,50})\s*</g);
    for (const m of buttons) strings.add(m[1].trim());

    // Title/h1/h2 text
    const headings = content.matchAll(/<h[12][^>]*>\s*([A-ZÀ-Ý][a-zA-ZÀ-ÿ\s-]{3,60})\s*</g);
    for (const m of headings) strings.add(m[1].trim());

    // Constants labels
    const labels = content.matchAll(/label:\s*['"`]([^'"`]{3,50})['"`]/g);
    for (const m of labels) strings.add(m[1].trim());
  }
  // Filter out code-like strings
  return [...strings].filter(s =>
    !s.includes('{') && !s.includes('}') &&
    !s.includes('console') && !s.includes('import') &&
    !s.includes('return') && !s.includes('function') &&
    !s.includes('const') && !s.includes('=>') &&
    !s.match(/^[a-z]/) // Must start with uppercase
  ).slice(0, 80);
}

// ── Extract design DNA ──
function extractDesignDNA(files) {
  let colors = {};
  let fonts = [];
  let isDarkMode = false;
  let theme = {};

  for (const f of files) {
    const content = readFileSync(f, 'utf-8');

    if (f.endsWith('.css')) {
      // CSS custom properties
      const props = content.matchAll(/--([\w-]+):\s*([^;]+);/g);
      for (const m of props) {
        theme[m[1]] = m[2].trim();
        if (m[1].includes('color') || m[1].includes('bg') || m[1].includes('accent')) {
          colors[m[1]] = m[2].trim();
        }
        if (m[1].includes('font')) {
          fonts.push(m[2].trim());
        }
      }

      // Dark mode detection
      if (content.includes('#0') || content.includes('#1') || content.includes('dark')) {
        isDarkMode = true;
      }

      // Hex colors
      const hex = content.matchAll(/#([0-9a-fA-F]{6})\b/g);
      for (const m of hex) {
        colors[`hex_${m[1]}`] = `#${m[1]}`;
      }
    }

    if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      // Tailwind classes
      const tw = content.matchAll(/(?:bg|text|border)-([a-z]+)-(\d+)/g);
      const twColors = {};
      for (const m of tw) {
        const key = `${m[1]}-${m[2]}`;
        twColors[key] = (twColors[key] || 0) + 1;
      }
      colors = { ...colors, ...twColors };
    }
  }

  return { colors, fonts: [...new Set(fonts)], isDarkMode, theme };
}

// ── Extract features from component names and code ──
function extractFeatures(files) {
  const features = [];

  for (const f of files) {
    if (!f.endsWith('.tsx') && !f.endsWith('.jsx')) continue;
    const content = readFileSync(f, 'utf-8');
    const name = f.split('/').pop().replace(extname(f), '');

    const featureTexts = [];

    // Maps
    if (content.includes('MapLibre') || content.includes('maplibre') || content.includes('useMap') || content.includes('<map')) {
      featureTexts.push('carte interactive');
    }
    if (content.includes('Map(') || content.includes('MapView')) {
      featureTexts.push('carte géolocalisée');
    }

    // Photos/Camera
    if (content.includes('photo') || content.includes('Photo') || content.includes('camera') || content.includes('Camera')) {
      featureTexts.push('relevés photo terrain');
    }

    // Search/Filter
    if (content.includes('search') || content.includes('filter') || content.includes('placeholder')) {
      featureTexts.push('recherche et filtrage');
    }

    // Export/Download
    if (content.includes('download') || content.includes('export') || content.includes('exporter')) {
      featureTexts.push('export de données');
    }

    // Upload/Import
    if (content.includes('upload') || content.includes('import') || content.includes('FileList') || content.includes('FileReader')) {
      featureTexts.push('import de fichiers');
    }

    // Charts/Stats
    if (content.includes('chart') || content.includes('Chart') || content.includes('stats') || content.includes('Stats')) {
      featureTexts.push('statistiques et graphiques');
    }

    // Forms
    if (content.includes('<form') || content.includes('<input') || content.includes('<select')) {
      featureTexts.push('saisie de données structurée');
    }

    // Real-time/Supabase
    if (content.includes('supabase') || content.includes('realtime') || content.includes('subscribe')) {
      featureTexts.push('synchronisation temps réel');
    }

    if (featureTexts.length > 0) {
      features.push({ component: name, file: f.split('/').slice(-2).join('/'), features: featureTexts });
    }
  }

  return features;
}

// ── Build app profile ──
function analyzeApp(projectDir) {
  const srcDir = join(projectDir, 'web/src');
  const srcAlt = join(projectDir, 'src');

  const actualSrc = statSync(srcDir)?.isDirectory() ? srcDir : srcAlt;
  const files = walk(actualSrc);

  const routes = extractRoutes(files);
  const uiStrings = extractUIStrings(files);
  const design = extractDesignDNA(files);
  const features = extractFeatures(files);

  // Determine app category
  const allText = uiStrings.join(' ').toLowerCase();
  let category = 'web-app';
  let domain = '';

  if (allText.match(/chantier|fibre|terrain|technicien|chantiers/)) {
    category = 'field-ops';
    domain = 'déploiement de fibre optique';
  } else if (allText.match(/dashboard|analytics|revenue|metric/)) {
    category = 'saas-dashboard';
    domain = 'business analytics';
  } else if (allText.match(/code|deploy|api|git|build/)) {
    category = 'dev-tool';
    domain = 'developer tools';
  }

  // Build narrative based on understanding
  const narrative = buildNarrative(category, domain, routes, features, uiStrings);

  return {
    projectDir,
    category,
    domain,
    routes,
    uiStrings,
    design,
    features,
    narrative,
    fileCount: files.length,
    analyzedAt: new Date().toISOString(),
  };
}

function buildNarrative(category, domain, routes, features, uiStrings) {
  // App-specific narrative based on deep analysis
  const appName = uiStrings.find(s => s.length < 30 && s.match(/^[A-Z]/)) || 'Application';

  if (category === 'field-ops') {
    return {
      appName: 'ZEFIL Terrain',
      pitch: "L'application terrain qui accompagne les techniciens dans le déploiement de la fibre",
      scenes: [
        {
          caption: 'Tous vos chantiers en un coup d\x27œil',
          subtitle: 'Liste filtrable par statut : à faire, en cours, terminés',
          route: '/',
          interaction: 'Voir la liste des chantiers avec recherche',
        },
        {
          caption: 'Une carte interactive par chantier',
          subtitle: 'Visualisez le parcours des câbles sur le terrain',
          route: '/chantier/FRSO3374',
          interaction: 'Naviguer sur la carte, voir les points et câbles',
          tab: 'Carte',
        },
        {
          caption: 'Suivez chaque étape du déploiement',
          subtitle: 'Route optique point par point, de la boîte de raccordement au client',
          route: '/chantier/FRSO3374',
          interaction: 'Cliquer sur l\x27onglet Étapes',
          tab: 'Étapes',
        },
        {
          caption: 'Plans de boîtes de soudure détaillés',
          subtitle: 'Chaque épissure identifiée et tracée',
          route: '/chantier/FRSO3374',
          interaction: 'Cliquer sur l\x27onglet Boîtiers',
          tab: 'Boîtiers',
        },
        {
          caption: 'Relevés terrain avec photos',
          subtitle: 'Les techniciens documentent chaque intervention',
          route: '/chantier/FRSO3374',
          interaction: 'Cliquer sur l\x27onglet Relevés',
          tab: 'Relevés',
        },
        {
          caption: 'Préparation de chantier automatisée',
          subtitle: 'Importez routes optiques et fiches travaux, le SHP est généré automatiquement',
          route: '/preparer',
          interaction: 'Voir le formulaire d\x27import',
        },
      ],
      ctaText: 'Déployez la fibre plus vite avec ZEFIL Terrain',
    };
  }

  // Generic fallback
  return {
    appName,
    pitch: `Une application pour ${domain}`,
    scenes: routes.slice(0, 5).map((r, i) => ({
      caption: uiStrings[i] || `Page ${i + 1}`,
      subtitle: '',
      route: r.path,
      interaction: 'default',
    })),
    ctaText: `Essayez ${appName}`,
  };
}

// ── CLI ──
const projectDir = process.argv[2] || '/Users/arnaud/zefil';
const output = process.argv[3] || 'output/app_analysis.json';

console.log('\n🧠 APP ANALYSIS AGENT');
console.log(`   Project: ${projectDir}`);

const analysis = analyzeApp(projectDir);

console.log(`   Category: ${analysis.category}`);
console.log(`   Domain: ${analysis.domain}`);
console.log(`   Routes: ${analysis.routes.length}`);
console.log(`   UI strings: ${analysis.uiStrings.length}`);
console.log(`   Features: ${analysis.features.length}`);
console.log(`   Design colors: ${Object.keys(analysis.design.colors).length}`);
console.log(`   Dark mode: ${analysis.design.isDarkMode}`);

console.log('\n📋 Routes détectées:');
for (const r of analysis.routes) {
  console.log(`   ${r.path.padEnd(30)} → ${r.component} (${r.file})`);
}

console.log('\n🎯 Fonctionnalités détectées:');
for (const f of analysis.features) {
  console.log(`   ${f.component.padEnd(20)} ${f.features.join(', ')}`);
}

console.log('\n📝 Textes UI (top 20):');
for (const s of analysis.uiStrings.slice(0, 20)) {
  console.log(`   "${s}"`);
}

console.log(`\n🎨 Design DNA:`);
console.log(`   Fonts: ${analysis.design.fonts.join(', ') || 'system-ui'}`);
console.log(`   Colors (top 10): ${Object.entries(analysis.design.colors).slice(0, 10).map(([k,v]) => `${k}=${v}`).join(', ')}`);

console.log(`\n📋 Plan narratif:`);
for (const s of analysis.narrative.scenes) {
  console.log(`   [${s.route.padEnd(25)}] "${s.caption}"`);
  if (s.subtitle) console.log(`     ${s.subtitle}`);
}

// Save
import { writeFileSync, mkdirSync } from 'fs';
mkdirSync('output', { recursive: true });
writeFileSync(output, JSON.stringify(analysis, null, 2));
console.log(`\n💾 ${output}\n`);
