// Video templates — predefined visual styles.
// Each template defines colors, fonts, and mood.
// Templates are data, not code. Adding a template = adding an entry here.

export interface TemplateStyle {
  bgColor: string;
  accentColor: string;
  fontFamily: string;
  captionSize: number;
  subtitleSize: number;
  watermark?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  premium: boolean;
  style: TemplateStyle;
  gradient: string;
}

export const templates: Template[] = [
  {
    id: 'clean-dark',
    name: 'Clean Dark',
    description: 'Sobre, sombre, élégant — style Linear / Vercel',
    premium: false,
    gradient: 'from-zinc-700 to-zinc-900',
    style: {
      bgColor: '#0a0a0b',
      accentColor: '#6366f1',
      fontFamily: 'Inter, system-ui, sans-serif',
      captionSize: 64,
      subtitleSize: 32,
    },
  },
  {
    id: 'bold-pop',
    name: 'Bold Pop',
    description: 'Coloré, dynamique, énergique — style startup',
    premium: false,
    gradient: 'from-pink-500 to-orange-400',
    style: {
      bgColor: '#1a0a1a',
      accentColor: '#ec4899',
      fontFamily: 'Inter, system-ui, sans-serif',
      captionSize: 72,
      subtitleSize: 36,
    },
  },
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    description: 'Clair, minimal, Apple-like',
    premium: true,
    gradient: 'from-gray-100 to-gray-300',
    style: {
      bgColor: '#f5f5f7',
      accentColor: '#0071e3',
      fontFamily: 'Inter, system-ui, sans-serif',
      captionSize: 60,
      subtitleSize: 30,
    },
  },
  {
    id: 'gradient-flow',
    name: 'Gradient Flow',
    description: 'Dégradés fluides, moderne — style Stripe',
    premium: true,
    gradient: 'from-indigo-500 to-purple-500',
    style: {
      bgColor: '#0f0a1a',
      accentColor: '#a855f7',
      fontFamily: 'Inter, system-ui, sans-serif',
      captionSize: 68,
      subtitleSize: 34,
    },
  },
];

export function getTemplate(id: string): Template {
  return templates.find((t) => t.id === id) || templates[0];
}
