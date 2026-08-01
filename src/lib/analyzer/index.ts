/**
 * Magic pipeline orchestrator.
 *
 * Chains: repo analysis → design DNA → storyboard draft.
 * The storyboard is then refined by the LLM step (see storyboard.ts).
 */

import { analyzeRepo, type RepoIdentity, parseGitHubUrl } from './github';
import { buildDesignDNA, STYLE_FILE_CANDIDATES, type DesignDNA } from './designDna';

export interface AnalysisResult {
  identity: RepoIdentity;
  design: DesignDNA;
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

/**
 * Run the full static analysis: identity + design DNA.
 * This is step 1 of the magic flow — no LLM needed, pure parsing.
 */
export async function analyzeApp(url: string, token?: string): Promise<AnalysisResult> {
  // 1. Identity
  const identity = await analyzeRepo(url, token);

  // 2. Design files
  const parsed = parseGitHubUrl(url)!;
  const files: Record<string, string> = {};
  await Promise.all(
    STYLE_FILE_CANDIDATES.map(async (path) => {
      const content = await fetchRawFile(
        parsed.owner,
        parsed.repo,
        identity.defaultBranch,
        path,
        token
      );
      if (content) files[path] = content;
    })
  );

  const design = buildDesignDNA(files);

  // 3. Capture URL: prefer the repo homepage, fallback to Vercel guess
  let captureUrl: string | null = null;
  if (identity.homepageUrl) {
    captureUrl = identity.homepageUrl.startsWith('http')
      ? identity.homepageUrl
      : `https://${identity.homepageUrl}`;
  } else {
    // Common Vercel pattern: <repo>.vercel.app
    captureUrl = null; // we'll ask the user or try to detect later
  }

  return { identity, design, captureUrl };
}
