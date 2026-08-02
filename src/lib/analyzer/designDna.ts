/**
 * Design DNA Extractor — reads the repo's styling files and extracts
 * the app's visual identity: colors, fonts, radius, theme.
 *
 * Output is directly compatible with our Remotion SceneStyle.
 */

import type { SceneStyle } from '../../../remotion/components/AnimatedScene';

export interface DesignDNA {
  /** Main background color (hex) */
  bgColor: string;
  /** Accent / primary brand color (hex) */
  accentColor: string;
  /** Font stack */
  fontFamily: string;
  /** dark | light */
  theme: 'dark' | 'light';
  /** All extracted CSS custom properties (--var: value) */
  cssVariables: Record<string, string>;
  /** Tailwind custom colors if found */
  tailwindColors: Record<string, string>;
  /** Gradients found in the code (linear-gradient, radial-gradient) */
  gradients: string[];
  /** Border radius values (from --radius vars, border-radius rules, rounded-*) */
  borderRadius: string[];
  /** Box shadows (box-shadow rules + --shadow* vars) */
  shadows: string[];
  /** CSS animations (@keyframes names) */
  keyframes: string[];
  /** Transition durations/easings used */
  transitions: string[];
  /** Lucide icons imported across the codebase */
  lucideIcons: string[];
  /** Asset files (logo, images) found in public/ or src/assets/ */
  assets: string[];
  /** Font weights used */
  fontWeights: string[];
  /** Source files that contributed */
  sources: string[];
  /** Confidence 0-1 */
  confidence: number;
}

const COLOR_RE = /#(?:[0-9a-fA-F]{3}){1,2}\b|(?:rgba?|hsla?)\([^)]+\)/g;
const VAR_RE = /--([\w-]+)\s*:\s*([^;]+);/g;

/** Parse CSS custom properties from raw CSS text. */
export function extractCssVariables(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_RE);
  while ((m = re.exec(css)) !== null) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

/** Extract hex colors from any text (CSS, tailwind config). */
export function extractColors(text: string): string[] {
  const matches = text.match(COLOR_RE) || [];
  // Normalize 3-char hex to 6-char, dedupe
  const norm = matches.map((c) => {
    if (/^#[0-9a-fA-F]{3}$/.test(c)) {
      return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    }
    return c.toLowerCase();
  });
  return Array.from(new Set(norm));
}

/** Guess the most likely accent color from a list of colors. */
export function pickAccentColor(colors: string[]): string {
  // Prefer saturated, mid-brightness hex colors (not grays/blacks/whites)
  const scored = colors
    .filter((c) => c.startsWith('#') && c.length === 7)
    .map((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Score: high saturation + mid luminance wins
      return { hex, score: sat * (1 - Math.abs(lum - 0.5) * 2) };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.hex || '#6366f1';
}

/** Guess the background: darkest/lightest color depending on theme. */
export function pickBackgroundColor(colors: string[], theme: 'dark' | 'light'): string {
  const hexes = colors.filter((c) => c.startsWith('#') && c.length === 7);
  if (hexes.length === 0) return theme === 'dark' ? '#0a0a0b' : '#ffffff';
  const byLum = hexes
    .map((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { hex, lum: (0.299 * r + 0.587 * g + 0.114 * b) / 255 };
    })
    .sort((a, b) => a.lum - b.lum);
  return theme === 'dark' ? byLum[0].hex : byLum[byLum.length - 1].hex;
}

/** Detect dark vs light theme from CSS content. */
export function detectTheme(cssTexts: string[], vars?: Record<string, string>): 'dark' | 'light' {
  // Best signal: background-ish CSS variables
  if (vars) {
    const bgVars = Object.entries(vars).filter(([k]) =>
      /bg|background|base|surface/i.test(k)
    );
    for (const [, v] of bgVars) {
      const colors = extractColors(v);
      for (const hex of colors) {
        if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          return lum < 0.5 ? 'dark' : 'light';
        }
      }
    }
  }
  // Fallback: darkest color present wins if it's very dark
  const joined = cssTexts.join('\n');
  const hexes = extractColors(joined).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  const lums = hexes.map((hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  });
  const minLum = Math.min(...lums, 1);
  const maxLum = Math.max(...lums, 0);
  // If darkest color is very dark AND light colors exist (for text) → dark theme
  if (minLum < 0.15 && maxLum > 0.8) return 'dark';
  return minLum < 0.3 ? 'dark' : 'light';
}

/** Extract font families from CSS. */
export function extractFonts(css: string): string[] {
  const fonts = new Set<string>();
  const re = /font-family\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const families = m[1].split(',').map((f) => f.trim().replace(/['"]/g, ''));
    if (families[0] && !families[0].startsWith('var(')) fonts.add(families[0]);
  }
  // Google Fonts @import
  const importRe = /fonts\.googleapis\.com\/css2?\?family=([\w+:&=,;]+)/g;
  while ((m = importRe.exec(css)) !== null) {
    const fam = m[1].split(':')[0].replace(/\+/g, ' ');
    fonts.add(fam);
  }
  return Array.from(fonts);
}

/** Extract gradients from CSS. */
export function extractGradients(css: string): string[] {
  const re = /(?:linear|radial|conic)-gradient\([^)]+\)/g;
  return Array.from(new Set(css.match(re) || [])).slice(0, 12);
}

/** Extract border-radius values. */
export function extractBorderRadius(css: string): string[] {
  const values = new Set<string>();
  // border-radius: X
  const re1 = /border-radius\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(css)) !== null) values.add(m[1].trim());
  // rounded-[Npx] / rounded-[Nrem] (Tailwind arbitrary)
  const re2 = /rounded-\[(\d+(?:px|rem|em))\]/g;
  while ((m = re2.exec(css)) !== null) values.add(m[1]);
  // --radius vars handled via cssVariables
  return Array.from(values).slice(0, 10);
}

/** Extract box-shadows. */
export function extractShadows(css: string): string[] {
  const re = /box-shadow\s*:\s*([^;]+);/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    // Skip var-only refs, keep actual definitions
    if (!/^var\(/.test(m[1].trim())) out.add(m[1].trim());
  }
  return Array.from(out).slice(0, 10);
}

/** Extract @keyframes names. */
export function extractKeyframes(css: string): string[] {
  const re = /@keyframes\s+([\w-]+)/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) out.add(m[1]);
  return Array.from(out);
}

/** Extract transition declarations. */
export function extractTransitions(css: string): string[] {
  const re = /transition(?:-[\w]+)?\s*:\s*([^;]+);/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const v = m[1].trim();
    if (v !== 'none' && v.length < 80) out.add(v);
  }
  return Array.from(out).slice(0, 10);
}

/** Extract lucide-react icon imports from TS/TSX source. */
export function extractLucideIcons(source: string): string[] {
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    m[1].split(',').forEach((name) => {
      const n = name.trim().split(' as ')[0].trim();
      if (n && /^[A-Z]/.test(n)) out.add(n);
    });
  }
  return Array.from(out);
}

/** Extract font-weight values. */
export function extractFontWeights(css: string): string[] {
  const re = /font-weight\s*:\s*(\d+|bold|normal|light|medium|semibold)/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) out.add(m[1]);
  return Array.from(out).sort();
}

/** Candidate styling files to look for in a repo. */
export const STYLE_FILE_CANDIDATES = [
  'src/index.css',
  'src/globals.css',
  'src/App.css',
  'src/styles.css',
  'styles/globals.css',
  'app/globals.css',
  'tailwind.config.js',
  'tailwind.config.ts',
  'src/theme.ts',
  'src/lib/theme.ts',
];

/**
 * Build the DesignDNA from raw file contents fetched from the repo.
 * `files` is a map of path → raw content (only files that existed).
 * `sourceFiles` (optional): TS/TSX sources for icon/component analysis.
 * `assetPaths` (optional): repo tree paths for asset detection.
 */
export function buildDesignDNA(
  files: Record<string, string>,
  sourceFiles: Record<string, string> = {},
  assetPaths: string[] = []
): DesignDNA {
  const sources = Object.keys(files);
  const cssTexts: string[] = [];
  const allVars: Record<string, string> = {};
  const tailwindColors: Record<string, string> = {};

  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.css')) {
      cssTexts.push(content);
      Object.assign(allVars, extractCssVariables(content));
    } else if (path.includes('tailwind.config')) {
      cssTexts.push(content);
      const colorMatches = content.match(/colors\s*:\s*\{([\s\S]*?)\}/);
      if (colorMatches) {
        const hexes = extractColors(colorMatches[1]);
        hexes.forEach((h, i) => (tailwindColors[`tw-${i}`] = h));
      }
    } else if (path.includes('theme')) {
      cssTexts.push(content);
    }
  }

  const joinedCss = cssTexts.join('\n');
  const allColors = [
    ...extractColors(joinedCss),
    ...Object.values(allVars).flatMap((v) => extractColors(v)),
  ];
  const uniqueColors = Array.from(new Set(allColors));

  const theme = detectTheme(cssTexts, allVars);
  const fonts = extractFonts(joinedCss);

  // Exhaustive extraction
  const gradients = extractGradients(joinedCss);
  const borderRadius = extractBorderRadius(joinedCss);
  const shadows = extractShadows(joinedCss);
  const keyframes = extractKeyframes(joinedCss);
  const transitions = extractTransitions(joinedCss);
  const fontWeights = extractFontWeights(joinedCss);

  // Icons from all TS/TSX sources (CSS vars can also appear in tsx)
  const lucideIcons = new Set<string>();
  for (const src of Object.values(sourceFiles)) {
    extractLucideIcons(src).forEach((i) => lucideIcons.add(i));
    // tsx files also carry tailwind arbitrary values
    extractBorderRadius(src).forEach((r) => { if (!borderRadius.includes(r)) borderRadius.push(r); });
    extractColors(src).forEach((c) => { if (!uniqueColors.includes(c)) uniqueColors.push(c); });
  }

  // Assets (images, logos, fonts files)
  const assets = assetPaths
    .filter((p) => /\.(svg|png|jpg|jpeg|webp|woff2?|ttf|otf)$/i.test(p))
    .filter((p) => /^(public|src\/assets|assets)\//.test(p))
    .slice(0, 30);

  const bgColor = pickBackgroundColor(uniqueColors, theme);
  const accentColor = pickAccentColor(uniqueColors);
  const fontFamily = fonts.length > 0 ? `${fonts[0]}, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';

  // Confidence: more sources + more vars = higher confidence
  const confidence = Math.min(1, sources.length * 0.2 + Object.keys(allVars).length * 0.05 + gradients.length * 0.05);

  return {
    bgColor,
    accentColor,
    fontFamily,
    theme,
    cssVariables: allVars,
    tailwindColors,
    gradients,
    borderRadius,
    shadows,
    keyframes,
    transitions,
    lucideIcons: Array.from(lucideIcons).sort(),
    assets,
    fontWeights,
    sources,
    confidence,
  };
}

/** Convert DesignDNA to Remotion SceneStyle (drop-in for AnimatedScene). */
export function dnaToSceneStyle(dna: DesignDNA): SceneStyle {
  return {
    bgColor: dna.bgColor,
    accentColor: dna.accentColor,
    fontFamily: dna.fontFamily,
    captionSize: 64,
    subtitleSize: 32,
  };
}
