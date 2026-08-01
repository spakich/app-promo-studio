/**
 * GitHub Repo Analyzer — first step of the magic pipeline.
 *
 * Input:  a GitHub repo URL (e.g. "https://github.com/owner/app")
 * Output: the app's identity card — what it is, what it does, how it's built.
 *
 * This module ONLY reads public data via the GitHub REST API.
 */

export interface RepoIdentity {
  owner: string;
  repo: string;
  fullName: string;
  name: string;
  description: string;
  homepageUrl: string | null; // deployed app URL (Vercel, etc.)
  language: string;
  topics: string[];
  stars: number;
  readmeRaw: string;
  packageJson: PackageJsonInfo | null;
  detectedStack: string[];
  detectedRoutes: string[];
  defaultBranch: string;
}

export interface PackageJsonInfo {
  name: string;
  description?: string;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
}

/** Parse any GitHub URL form into owner/repo. */
export function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const m = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

async function ghFetch(path: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
  return res.json();
}

async function ghFetchRaw(owner: string, repo: string, branch: string, path: string, token?: string): Promise<string | null> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`, { headers });
  if (!res.ok) return null;
  return res.text();
}

/** Detect the tech stack from package.json dependencies. */
function detectStack(pkg: PackageJsonInfo | null): string[] {
  if (!pkg) return [];
  const deps = { ...pkg.dependencies };
  const stack: string[] = [];
  const known: Record<string, string> = {
    react: 'React', next: 'Next.js', vue: 'Vue', svelte: 'Svelte',
    'react-dom': '', // skip
    'react-router-dom': 'React Router', '@tanstack/react-query': 'React Query',
    tailwindcss: 'Tailwind', 'styled-components': 'styled-components',
    '@supabase/supabase-js': 'Supabase', firebase: 'Firebase',
    'maplibre-gl': 'MapLibre', 'mapbox-gl': 'Mapbox', leaflet: 'Leaflet',
    remotion: 'Remotion', 'framer-motion': 'Framer Motion',
    express: 'Express', fastify: 'Fastify', hono: 'Hono',
    prisma: 'Prisma', drizzle: 'Drizzle',
    vite: 'Vite', zustand: 'Zustand', redux: 'Redux',
    exceljs: 'ExcelJS', 'chart.js': 'Chart.js', recharts: 'Recharts',
  };
  for (const [dep, label] of Object.entries(known)) {
    if (deps[dep] && label) stack.push(label);
  }
  return stack;
}

/** Detect app routes from the file tree (React Router pages, Next.js pages/app dir). */
export function detectRoutesFromTree(tree: { path: string; type: string }[]): string[] {
  const routes = new Set<string>();
  for (const f of tree) {
    if (f.type !== 'blob') continue;
    const p = f.path;
    // src/pages/X.tsx → /x
    let m = p.match(/^src\/pages\/([\w-]+)\.[jt]sx?$/);
    if (m) { routes.add('/' + m[1].toLowerCase()); continue; }
    // app/x/page.tsx (Next app router)
    m = p.match(/^app\/([\w/-]+)\/page\.[jt]sx?$/);
    if (m) { routes.add('/' + m[1].toLowerCase()); continue; }
    // pages/x.tsx (Next pages router)
    m = p.match(/^pages\/([\w-]+)\.[jt]sx?$/);
    if (m && m[1] !== '_app' && m[1] !== '_document') { routes.add('/' + m[1].toLowerCase()); continue; }
  }
  // home always first if nothing found
  const arr = Array.from(routes).filter((r) => r !== '/index' && r !== '/home');
  arr.unshift('/');
  return arr.slice(0, 12);
}

/**
 * Main entry: analyze a GitHub repo and return its identity card.
 */
export async function analyzeRepo(url: string, token?: string): Promise<RepoIdentity> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error('URL GitHub invalide');
  const { owner, repo } = parsed;

  // 1. Repo meta
  const meta = await ghFetch(`/repos/${owner}/${repo}`, token);
  const branch = meta.default_branch || 'main';

  // 2. README
  let readmeRaw = '';
  try {
    const readme = await ghFetch(`/repos/${owner}/${repo}/readme`, token);
    readmeRaw = atob(readme.content.replace(/\n/g, ''));
  } catch { /* no readme */ }

  // 3. package.json (try root)
  let packageJson: PackageJsonInfo | null = null;
  const pkgRaw = await ghFetchRaw(owner, repo, branch, 'package.json', token);
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      packageJson = {
        name: pkg.name || repo,
        description: pkg.description,
        dependencies: { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) },
        scripts: pkg.scripts || {},
      };
    } catch { /* bad json */ }
  }

  // 4. File tree (for route detection)
  let tree: { path: string; type: string }[] = [];
  try {
    const treeRes = await ghFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token);
    tree = treeRes.tree || [];
  } catch { /* tree too big or missing */ }

  const detectedRoutes = detectRoutesFromTree(tree);
  const detectedStack = detectStack(packageJson);

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    name: packageJson?.name || meta.name || repo,
    description: meta.description || packageJson?.description || '',
    homepageUrl: meta.homepage || null,
    language: meta.language || '',
    topics: meta.topics || [],
    stars: meta.stargazers_count || 0,
    readmeRaw,
    packageJson,
    detectedStack,
    detectedRoutes,
    defaultBranch: branch,
  };
}
