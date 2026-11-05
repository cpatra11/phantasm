/**
 * Brand fonts are names from the customer's site; most are not installed.
 * Map known families to loaded webfonts, and unknown display faces to a close
 * fallback so a "Forrest" headline still reads as a display serif, never Arial.
 */
const SERIF_HINTS = /forrest|serif|display|editorial|playfair|fraunces|times|georgia|garamond|baskerville/i;

export function fontStack(family: string | undefined, role: 'heading' | 'body' = 'body'): string {
  const f = (family ?? '').trim();
  if (!f) {
    return role === 'heading'
      ? '"DM Serif Display", Georgia, "Times New Roman", serif'
      : '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';
  }
  const lower = f.toLowerCase();
  if (lower === 'dm sans') return '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';
  if (lower === 'archivo') return '"Archivo", "DM Sans", Helvetica, Arial, sans-serif';
  if (lower === 'inter') return 'Inter, "DM Sans", Helvetica, Arial, sans-serif';
  if (lower === 'dm serif display') return '"DM Serif Display", Georgia, serif';
  if (SERIF_HINTS.test(f)) return `"${f}", "DM Serif Display", Georgia, "Times New Roman", serif`;
  return `"${f}", "DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif`;
}
