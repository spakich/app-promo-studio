#!/usr/bin/env node
/**
 * Smoke test for the analyzer pipeline (pure JS, no TS import needed).
 * Replicates src/lib/analyzer logic against the live GitHub API.
 * Usage: node scripts/test_analyzer.mjs [github-url]
 */

const url = process.argv[2] || 'https://github.com/spakich/app-promo-studio';

const STYLE_FILES = [
  'src/index.css', 'src/globals.css', 'src/App.css', 'src/styles.css',
  'styles/globals.css', 'app/globals.css',
  'tailwind.config.js', 'tailwind.config.ts',
];

function parseGitHubUrl(input) {
  const cleaned = input.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const m = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
  return res.json();
}

async function ghRaw(owner, repo, branch, path) {
  const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
  return res.ok ? res.text() : null;
}

const parsed = parseGitHubUrl(url);
if (!parsed) { console.error('URL invalide'); process.exit(1); }

console.log(`\nAnalyse de: ${url}\n`);

// 1. Meta
const meta = await gh(`/repos/${parsed.owner}/${parsed.repo}`);
const branch = meta.default_branch || 'main';
console.log('=== IDENTITÉ ===');
console.log('Nom:', meta.name);
console.log('Description:', meta.description || '(aucune)');
console.log('Langage:', meta.language);
console.log('Homepage:', meta.homepage || '(aucune)');

// 2. package.json
const pkgRaw = await ghRaw(parsed.owner, parsed.repo, branch, 'package.json');
let stack = [];
if (pkgRaw) {
  const pkg = JSON.parse(pkgRaw);
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const known = {
    react: 'React', next: 'Next.js', vue: 'Vue', tailwindcss: 'Tailwind',
    '@supabase/supabase-js': 'Supabase', remotion: 'Remotion',
    'react-router-dom': 'React Router', zustand: 'Zustand', vite: 'Vite',
    'lucide-react': 'Lucide',
  };
  stack = Object.entries(known).filter(([d]) => deps[d]).map(([, l]) => l);
}
console.log('Stack:', stack.join(', ') || '(non détectée)');

// 3. Routes
const tree = await gh(`/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`);
const routes = new Set(['/']);
for (const f of tree.tree || []) {
  if (f.type !== 'blob') continue;
  let m = f.path.match(/^src\/pages\/([\w-]+)\.[jt]sx?$/);
  if (m) routes.add('/' + m[1].toLowerCase());
}
console.log('Routes:', Array.from(routes).join(', '));

// 4. Design DNA
console.log('\n=== DESIGN DNA ===');
const cssTexts = [];
const sources = [];
for (const path of STYLE_FILES) {
  const content = await ghRaw(parsed.owner, parsed.repo, branch, path);
  if (content) { cssTexts.push(content); sources.push(path); }
}
const joined = cssTexts.join('\n');
const colors = [...new Set(joined.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [])];
const dark = (joined.match(/#0[0-9a-f]{5}/gi) || []).length >= (joined.match(/#f[0-9a-f]{5}/gi) || []).length;
const fonts = [...new Set([...joined.matchAll(/font-family\s*:\s*([^;]+);/g)].map((m) => m[1].split(',')[0].trim().replace(/['"]/g, '')))];

console.log('Thème:', dark ? 'dark' : 'light');
console.log('Couleurs trouvées:', colors.length, '→', colors.slice(0, 8).join(' '));
console.log('Polices:', fonts.join(', ') || '(aucune)');
console.log('Fichiers style:', sources.join(', ') || '(aucun)');

console.log('\n✅ TEST ANALYZER OK');
