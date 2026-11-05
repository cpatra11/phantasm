import { describe, expect, it } from 'vitest';
import { resolveAssets } from './assets';
import { makeLayer, type SceneDoc } from '../scenedoc';
import type { BrandKit } from '../brand/types';

const brand: BrandKit = {
  sourceUrl: 'https://example.com',
  name: 'Daily',
  colors: { primary: '#560E50', secondary: '#885580', background: '#FDFAF1', text: '#171817' },
  fonts: { heading: 'Forrest', body: 'DM Sans' },
  source: 'fallback',
  images: [
    { url: 'https://cdn.example/p1.png', label: 'Starter set', kind: 'product', cutoutUrl: 'https://cdn.example/c1.png' },
    { url: 'https://cdn.example/p2.png', label: 'All flavours', kind: 'product' },
  ],
};

describe('resolveAssets product grounding', () => {
  it('fills product-hero layers with the real brand cutouts, in order', async () => {
    const doc: SceneDoc = {
      id: 'd1',
      title: 'Test',
      scenes: [
        {
          id: 's1',
          durationMs: 3000,
          background: '#FDFAF1',
          layers: [
            makeLayer({ id: 'h1', kind: 'image', name: 'Product hero: bottle front', transform: { x: 0, y: 0, w: 500, h: 600 }, segment: true }),
            makeLayer({ id: 'h2', kind: 'image', name: 'Product pack beside it', transform: { x: 500, y: 0, w: 400, h: 500 } }),
          ],
        },
      ],
    };
    const out = await resolveAssets(doc, 'd1', brand);
    const [h1, h2] = out.scenes[0].layers;
    expect(h1.src).toBe('https://cdn.example/c1.png');
    expect(h1.segment).toBe(false);
    expect(h2.src).toBe('https://cdn.example/p2.png');
  });
});
