/**
 * Composer parameters, mirroring Hera's left-chat controls (verified live —
 * see research/hera-composer-clickmap.md). One shared vocabulary for the
 * sidebar UI, the /api/agent body, and the workflow.
 */

export const ASPECTS = ['auto', '16:9', '9:16', '1:1', '4:5'] as const;
export type AspectParam = (typeof ASPECTS)[number];

export const VARIETIES = ['close', 'balanced', 'wide'] as const;
export type Variety = (typeof VARIETIES)[number];

export const EFFORTS = ['low', 'medium', 'high'] as const;
export type Effort = (typeof EFFORTS)[number];

/** Count is 'auto' (the agent reads it from the message) or an explicit 1–6. */
export type CountParam = 'auto' | number;

/** Duration is 'auto' (agent picks, up to 120 s) or explicit milliseconds. */
export type DurationParam = 'auto' | number;

export const VARIETY_DIRECTIVES: Record<Variety, string> = {
  close: 'Variety: close — small differences between results, one idea.',
  balanced: 'Variety: balanced — clearly different results, same idea.',
  wide: 'Variety: wide — different takes on the brief.',
};

/** Agent tool-loop budget per effort level (Hera: effort trades time/credits for quality). */
export const EFFORT_STEP_BUDGET: Record<Effort, number> = { low: 24, medium: 40, high: 56 };

/** Hera durations: presets 5–30 s, custom up to 120 s. */
export function clampDurationMs(ms: number): number {
  return Math.min(120_000, Math.max(3_000, Math.round(ms)));
}

/** Appends the composer's format/variety instructions to a brief for the model. */
export function briefWithParams(brief: string, p: { aspect?: AspectParam; variety?: Variety }): string {
  const notes: string[] = [];
  if (p.aspect && p.aspect !== 'auto') notes.push(`Format: ${p.aspect}.`);
  if (p.variety) notes.push(VARIETY_DIRECTIVES[p.variety]);
  return notes.length ? `${brief}\n${notes.join(' ')}` : brief;
}
