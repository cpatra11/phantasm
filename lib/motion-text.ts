/**
 * Pure text effects for motion presets, shared by the Remotion renderer so
 * they can be unit-tested without rendering. `p` is eased progress 0..1.
 */

/** Typewriter: reveal characters as progress advances (at least one char once started). */
export function typeText(text: string, p: number): string {
  if (p <= 0) return '';
  const n = Math.max(1, Math.floor(text.length * Math.min(1, p)));
  return text.slice(0, n);
}

/**
 * Count-up: the first number in the text counts from 0 to its value,
 * preserving any prefix/suffix and decimal places ("92%" → "47%", "$1.5k" → "$0.8k").
 * Text without a number is returned unchanged.
 */
export function countText(text: string, p: number): string {
  const m = text.match(/-?\d+(?:\.\d+)?/);
  if (!m) return text;
  const target = Number(m[0]);
  if (!Number.isFinite(target)) return text;
  const decimals = m[0].includes('.') ? m[0].split('.')[1].length : 0;
  const eased = 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
  const value = (target * eased).toFixed(decimals);
  return text.slice(0, m.index) + value + text.slice((m.index ?? 0) + m[0].length);
}
