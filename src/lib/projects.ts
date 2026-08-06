/**
 * Projects registry — known projects + GitHub fetch helpers
 */

export interface Project {
  id: string;
  name: string;
  description: string;
  appUrl: string;        // deployed app URL to capture
  repoUrl?: string;      // GitHub repo
  accentColor: string;
  pitch?: string;
  private?: boolean;
}

/** Arnaud's known projects (pre-configured — private repos not listable with read:user token) */
export const KNOWN_PROJECTS: Project[] = [
  {
    id: 'zefil-terrain',
    name: 'ZEFIL Terrain',
    description: 'Suivi terrain FTTH — cartes chantiers, relevés photos, DOE, graphe tranchées',
    appUrl: 'https://zefil-terrain.vercel.app',
    repoUrl: 'https://github.com/spakich/zefil',
    accentColor: '#f59e0b',
    pitch: 'Le terrain fibre, piloté en temps réel',
    private: true,
  },
  {
    id: 'nge-stock',
    name: 'NGE Stock',
    description: 'Gestion de stock fibre — tourets, Kanban commandes, réception IA',
    appUrl: 'https://nge-stock-app.vercel.app',
    repoUrl: 'https://github.com/spakich/nge-infranet-stock',
    accentColor: '#3b82f6',
    pitch: 'Votre stock fibre, sous contrôle total',
    private: true,
  },
  {
    id: 'dresseur-ia',
    name: "Dresseur d'IA",
    description: 'RAG local auto-hébergé — base documentaire, réponses ancrées',
    appUrl: 'http://localhost:9380',
    repoUrl: 'https://github.com/spakich/rag',
    accentColor: '#8b5cf6',
    pitch: 'Vos documents, une IA qui répond',
    private: true,
  },
  {
    id: 'app-promo-studio',
    name: 'App Promo Studio',
    description: 'Studio de création de vidéos promo — repo-to-video',
    appUrl: 'https://app-promo-studio.vercel.app',
    repoUrl: 'https://github.com/spakich/app-promo-studio',
    accentColor: '#ec4899',
    pitch: 'Votre app mérite une bande-annonce',
  },
  {
    id: 'morphic',
    name: 'Morphic',
    description: 'Moteur de recherche IA avec réponses génératives',
    appUrl: 'https://morphic.sh',
    repoUrl: 'https://github.com/spakich/morphic',
    accentColor: '#10b981',
  },
];

/** Fetch public repos from GitHub (no token needed) */
export async function fetchPublicRepos(username: string): Promise<Project[]> {
  try {
    const res = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return [];
    const repos: any[] = await res.json();
    return repos
      .filter(r => !r.fork)
      .map(r => ({
        id: r.name,
        name: r.name,
        description: r.description || '',
        appUrl: r.homepage || '',
        repoUrl: r.html_url,
        accentColor: '#3b82f6',
      }));
  } catch {
    return [];
  }
}

/** Parse a manual URL input (app URL or GitHub repo URL) into a Project */
export function projectFromUrl(input: string): Project | null {
  const cleaned = input.trim().replace(/\/$/, '');
  if (!cleaned) return null;

  const ghMatch = cleaned.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
  if (ghMatch) {
    return {
      id: ghMatch[2],
      name: ghMatch[2],
      description: '',
      appUrl: '',
      repoUrl: `https://github.com/${ghMatch[1]}/${ghMatch[2]}`,
      accentColor: '#3b82f6',
    };
  }

  try {
    const url = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    return {
      id: url.hostname.split('.')[0],
      name: url.hostname.split('.')[0],
      description: '',
      appUrl: url.origin,
      accentColor: '#3b82f6',
    };
  } catch {
    return null;
  }
}
