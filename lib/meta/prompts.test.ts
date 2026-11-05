import { describe, expect, it } from 'vitest';
import { imagePrompt, posterPrompt } from './prompts';
import type { BrandKit } from '../brand/types';

const brand: BrandKit = {
  sourceUrl: 'https://example.com',
  name: 'Daily',
  colors: { primary: '#560E50', secondary: '#885580', background: '#FDFAF1', text: '#171817' },
  fonts: { heading: 'Forrest', body: 'DM Sans' },
  source: 'fallback',
};

describe('rich-scene image prompts (Hera ad anatomy)', () => {
  it('poster asks for an environment, multiple units and props — never a lone cutout', () => {
    const p = posterPrompt({ brief: 'Berry launch', brand });
    expect(p).toContain('2–3 product units');
    expect(p).toContain('rich coloured environment');
    expect(p).toContain('props');
    expect(p).not.toContain('generous negative space');
  });

  it('poster layouts vary per variant', () => {
    const layouts = [0, 1, 2, 3].map((variant) => posterPrompt({ brief: 'x', brand, variant }));
    expect(new Set(layouts).size).toBe(4);
  });

  it('scene image prompt builds foreground/subject/background depth', () => {
    const p = imagePrompt({ subject: 'berry drink sticks', brand });
    expect(p).toContain('hero unit in front');
    expect(p).toContain('foreground, subject and background depth');
    expect(p).toContain('never a lone product');
  });
});
