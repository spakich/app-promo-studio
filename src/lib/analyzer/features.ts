/**
 * Functional Understanding — reads the app's source code to understand
 * WHAT the app does, so the LLM can write promo copy that's actually true.
 *
 * Sources of truth:
 * - Page/route names (Dashboard → "tableau de bord")
 * - UI text literals in JSX (labels, placeholders, button text)
 * - Domain types (Project, RenderJob → vocabulary métier)
 * - Database tables (Supabase migrations → domain entities)
 */

export interface AppUnderstanding {
  /** Detected features in plain language */
  features: string[];
  /** Domain entities (what the app manages) */
  entities: string[];
  /** UI strings found in the code (French/English) */
  uiStrings: string[];
  /** User actions (buttons, CTAs) */
  actions: string[];
  /** The app's domain guess: "video generation", "inventory management"... */
  domainGuess: string;
}

/** French/English UI string literals worth capturing. */
const UI_STRING_RE = /(?:>|placeholder=|label=|title=)["'{`]([A-ZÀ-Ü][^<>"'`{}]{3,60})["'`]/g;

/** Button/action text: short imperative strings. */
const ACTION_RE = />\s*((?:Nouveau|Créer|Générer|Analyser|Importer|Exporter|Sauvegarder|Supprimer|Ajouter|Lancer|New|Create|Generate|Analyze|Import|Export|Save|Delete|Add|Start|Render|Upload)[^<>{}]{0,40})\s*</g;

/** Type/interface names = domain entities. */
const ENTITY_RE = /(?:interface|type)\s+([A-Z][\w]+)\s*(?:=|\{)/g;

/** Table names from SQL migrations. */
const TABLE_RE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([\w]+)/gi;

/** Route/page component names → feature hints. */
const PAGE_FEATURE_MAP: Record<string, string> = {
  dashboard: 'tableau de bord avec indicateurs',
  editor: 'éditeur visuel',
  projects: 'gestion de projets',
  templates: 'bibliothèque de templates',
  settings: 'paramètres',
  analytics: 'statistiques et analyses',
  stock: 'gestion de stock',
  inventory: 'inventaire',
  map: 'carte interactive',
  calendar: 'calendrier et planning',
  kanban: 'vue kanban',
  reports: 'rapports',
  export: 'exports de données',
  scan: 'scan / reconnaissance',
  magic: 'analyse automatique par IA',
};

/** Extract understanding from source files. */
export function understandApp(
  sourceFiles: Record<string, string>,
  sqlFiles: Record<string, string> = {}
): AppUnderstanding {
  const uiStrings = new Set<string>();
  const actions = new Set<string>();
  const entities = new Set<string>();
  const features = new Set<string>();

  for (const [path, content] of Object.entries(sourceFiles)) {
    // Page-level features
    const pageMatch = path.match(/pages\/([\w-]+)\.[jt]sx?$/i);
    if (pageMatch) {
      const key = pageMatch[1].toLowerCase();
      if (PAGE_FEATURE_MAP[key]) features.add(PAGE_FEATURE_MAP[key]);
    }

    // UI strings
    let m: RegExpExecArray | null;
    const uiRe = new RegExp(UI_STRING_RE);
    while ((m = uiRe.exec(content)) !== null) {
      const s = m[1].trim();
      if (!/[{}]/.test(s) && s.length >= 3) uiStrings.add(s);
    }

    // Actions
    const actRe = new RegExp(ACTION_RE);
    while ((m = actRe.exec(content)) !== null) {
      actions.add(m[1].trim());
    }

    // Entities (from types.ts files primarily)
    if (/types?\.[jt]s$/.test(path) || /types\//.test(path)) {
      const entRe = new RegExp(ENTITY_RE);
      while ((m = entRe.exec(content)) !== null) {
        entities.add(m[1]);
      }
    }
  }

  // Tables from SQL = domain entities
  for (const sql of Object.values(sqlFiles)) {
    const tblRe = new RegExp(TABLE_RE);
    let m: RegExpExecArray | null;
    while ((m = tblRe.exec(sql)) !== null) {
      entities.add(m[1]);
    }
  }

  // Domain guess from entity names
  const entityList = Array.from(entities).map((e) => e.toLowerCase());
  let domainGuess = 'application web';
  const domainSignals: [string[], string][] = [
    [['video', 'render', 'scene', 'template', 'screenshot', 'promo'], 'génération de vidéos'],
    [['stock', 'inventory', 'article', 'touret', 'mouvement'], 'gestion de stock'],
    [['chantier', 'bpe', 'armoire', 'releve', 'audit'], 'suivi de chantiers terrain'],
    [['booking', 'reservation', 'ressource'], 'réservation de ressources'],
    [['invoice', 'devis', 'facture', 'client'], 'facturation et devis'],
    [['task', 'kanban', 'todo', 'project'], 'gestion de tâches'],
  ];
  for (const [signals, domain] of domainSignals) {
    if (signals.some((s) => entityList.some((e) => e.includes(s)))) {
      domainGuess = domain;
      break;
    }
  }

  return {
    features: Array.from(features),
    entities: Array.from(entities).slice(0, 20),
    uiStrings: Array.from(uiStrings).slice(0, 40),
    actions: Array.from(actions).slice(0, 20),
    domainGuess,
  };
}
