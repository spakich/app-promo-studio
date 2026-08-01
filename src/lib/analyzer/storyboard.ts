/**
 * Storyboard Generator — the AI step.
 *
 * Takes the analysis (identity + design DNA + captured screenshots metadata)
 * and produces a SceneData[] ready for the Remotion engine:
 * which screens, in which order, with which captions, zooms and transitions.
 *
 * The LLM call is pluggable: pass any async function that takes a prompt
 * and returns text. The app wires it to Claude/Gemini via the user's key,
 * or to a Supabase Edge Function later.
 */

import type { SceneData } from '../../../remotion/components/AnimatedScene';
import type { AnalysisResult } from './index';

export interface CapturedScreen {
  url: string;        // public URL of the screenshot
  route: string;      // e.g. "/", "/dashboard"
  description?: string; // what the screen shows (from vision model or heuristic)
  width: number;
  height: number;
}

export interface StoryboardResult {
  scenes: SceneData[];
  /** One-line pitch the LLM wrote for the app */
  pitch: string;
  /** Raw LLM output for debugging */
  raw: string;
}

/** Build the prompt for the LLM. */
export function buildStoryboardPrompt(
  analysis: AnalysisResult,
  screens: CapturedScreen[]
): string {
  const { identity, design } = analysis;
  const screenList = screens
    .map((s, i) => `  ${i + 1}. Route "${s.route}" (${s.width}x${s.height})${s.description ? ` — ${s.description}` : ''}`)
    .join('\n');

  return `Tu es un directeur vidéo spécialisé en motion design d'apps SaaS.

Voici une application à promouvoir :

NOM: ${identity.name}
DESCRIPTION: ${identity.description || '(non fournie)'}
STACK: ${identity.detectedStack.join(', ') || identity.language}
THEME: ${design.theme} (fond ${design.bgColor}, accent ${design.accentColor})

EXTRAITS DU README:
${identity.readmeRaw.slice(0, 1500)}

ÉCRANS CAPTURÉS (dans l'ordre fourni):
${screenList}

Ta mission : écris le storyboard d'une vidéo promo de 20-30 secondes.
Règles:
- Une scène par écran, dans l'ordre qui raconte le mieux la valeur de l'app.
- Chaque scène: un "caption" (accroche courte, max 6 mots, style punchy) et une "subtitle" (bénéfice concret, max 10 mots).
- Choisis pour chaque scène un preset de zoom parmi: center, topRight, bottomLeft, panRight, panLeft, panDown, panUp, pullOut, static.
- Choisis une transition de sortie parmi: crossDissolve, slidePush, zoomThrough, blurDissolve, fadeToBlack.
- Durée par scène: 3 à 5 secondes.
- Écris aussi un "pitch": une phrase de présentation de l'app (max 15 mots).

Réponds UNIQUEMENT en JSON valide, sans markdown, avec cette structure exacte:
{
  "pitch": "...",
  "scenes": [
    {
      "screenIndex": 1,
      "caption": "...",
      "subtitle": "...",
      "zoomPreset": "center",
      "transitionOut": "blurDissolve",
      "durationSeconds": 4
    }
  ]
}`;
}

/** Parse the LLM JSON response into SceneData[]. */
export function parseStoryboardResponse(
  raw: string,
  screens: CapturedScreen[]
): StoryboardResult {
  // Extract JSON from the response (LLM sometimes wraps in ```json)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pas de JSON dans la réponse LLM');

  const parsed = JSON.parse(jsonMatch[0]);
  const scenes: SceneData[] = (parsed.scenes || [])
    .map((s: any) => {
      const screen = screens[(s.screenIndex ?? 1) - 1];
      if (!screen) return null;
      return {
        src: screen.url,
        caption: s.caption || '',
        subtitle: s.subtitle || '',
        zoomPreset: s.zoomPreset || 'center',
        transitionOut: s.transitionOut || 'crossDissolve',
        durationSeconds: Math.min(6, Math.max(2.5, s.durationSeconds || 4)),
      } as SceneData;
    })
    .filter(Boolean);

  return { scenes, pitch: parsed.pitch || '', raw };
}

/**
 * Heuristic fallback storyboard (no LLM): when the LLM is unavailable,
 * build a reasonable default from the screens + identity.
 */
export function fallbackStoryboard(
  analysis: AnalysisResult,
  screens: CapturedScreen[]
): StoryboardResult {
  const name = analysis.identity.name;
  const zoomCycle = ['center', 'panRight', 'topRight', 'pullOut', 'panLeft'];
  const transCycle = ['blurDissolve', 'zoomThrough', 'crossDissolve', 'slidePush'];

  const scenes: SceneData[] = screens.slice(0, 6).map((screen, i) => ({
    src: screen.url,
    caption: i === 0 ? `${name}.` : `Écran ${i + 1}`,
    subtitle: i === 0 ? analysis.identity.description : '',
    zoomPreset: zoomCycle[i % zoomCycle.length],
    transitionOut: transCycle[i % transCycle.length] as any,
    durationSeconds: 4,
  }));

  return { scenes, pitch: analysis.identity.description || name, raw: 'fallback' };
}
