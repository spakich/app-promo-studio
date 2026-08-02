/**
 * Magic pipeline orchestrator.
 *
 * Chains: repo analysis → design DNA (exhaustive) → functional understanding.
 * The storyboard is then refined by the LLM step (see storyboard.ts).
 */

import { analyzeRepo, type RepoIdentity, parseGitHubUrl } from './github';
import { buildDesignDNA, STYLE_FILE_CANDIDATES, type DesignDNA } from './designDna';
import { understandApp, type AppUnderstanding } from './features';

export interface AnalysisResult {
  identity: RepoIdentity;
  design: DesignDNA;
  understanding: AppUnderstanding;
  /** Deployed app URL candidates (for the screenshot bot) */
  captureUrl: string | null;
}

/** Fetch raw file from GitHub. */
async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token?: string
): Promise<string | null> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
    { headers }
  );
  if (!res.ok) return null;
  return res.text();
}

/** Pick the source files worth fetching for analysis (pages, components, types, migrations). */
function pickSourcePaths(tree: { path: string; type: string }[], routes: string[]): string[] {
  const picked: string[] = [];
  for (const f of tree) {
    if (f.type !== 'blob') continue;
    const p = f.path;
    if (/^src\/pages\/[\w-]+\.[jt]sx?$/.test(p)) picked.push(p);
    else if (/^src\/components\/[\w/-]+\.[jt]sx?$/.test(p) && picked.length < 40) picked.push(p);
    else if (/^src\/lib\/types?\.[jt]s$/.test(p)) picked.push(p);
    else if (/^supabase\/migrations\/.*\.sql$/.test(p)) picked.push(p);
    else if (/^src\/App\.[jt]sx?$/.test(p)) picked.push(p);
    if (picked.length >= 50) break;
  }
  return picked;
}

/**
 * Run the full static analysis: identity + exhaustive design DNA + understanding.
 * This is step 1 of the magic flow — no LLM needed, pure parsing.
 */
export async function analyzeApp(url: string, token?: string): Promise<AnalysisResult> {
  // 1. Identity
  const identity = await analyzeRepo(url, token);
  const parsed = parseGitHubUrl(url)!;
  const branch = identity.defaultBranch;

  // 2. Style files + source files + tree paths (parallel)
  const styleFiles: Record<string, string> = {};
  const sourceFiles: Record<string, string> = {};
  const sqlFiles: Record<string, string> = {};

  // Get tree for path picking
  let treePaths: string[] = [];
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const treeRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`,
      { headers }
    );
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      const tree = treeData.tree || [];
      treePaths = tree.map((f: any) => f.path);

      // Fetch style + source files in parallel batches
      const stylePaths = STYLE_FILE_CANDIDATES.filter((p) => treePaths.includes(p));
      const srcPaths = pickSourcePaths(tree, identity.detectedRoutes);

      await Promise.all([
        ...stylePaths.map(async (path) => {
          const c = await fetchRawFile(parsed.owner, parsed.repo, branch, path, token);
          if (c) styleFiles[path] = c;
        }),
        ...srcPaths.map(async (path) => {
          const c = await fetchRawFile(parsed.owner, parsed.repo, branch, path, token);
          if (!c) return;
          if (path.endsWith('.sql')) sqlFiles[path] = c;
          else sourceFiles[path] = c;
        }),
      ]);
    }
  } catch { /* tree fetch failed — continue with style candidates only */
    await Promise.all(
      STYLE_FILE_CANDIDATES.map(async (path) => {
        const c = await fetchRawFile(parsed.owner, parsed.repo, branch, path, token);
        if (c) styleFiles[path] = c;
      })
    );
  }

  const design = buildDesignDNA(styleFiles, sourceFiles, treePaths);
  const understanding = understandApp(sourceFiles, sqlFiles);

  // 3. Capture URL: prefer the repo homepage
  let captureUrl: string | null = null;
  if (identity.homepageUrl) {
    captureUrl = identity.homepageUrl.startsWith('http')
      ? identity.homepageUrl
      : `https://${identity.homepageUrl}`;
  }

  return { identity, design, understanding, captureUrl };
}
