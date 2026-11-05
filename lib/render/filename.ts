/** Download filename for an export, e.g. "daily-ads-9x16.mp4". */
export function renderFilename(title: string, aspect: string, kind: 'video' | 'still'): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'phantasma';
  return `${base}-${aspect.replace(':', 'x')}.${kind === 'video' ? 'mp4' : 'png'}`;
}
