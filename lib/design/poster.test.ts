import { describe, expect, it } from 'vitest';
import { buildLayeredPoster, posterHeadline } from './poster';
import type { BrandKit } from '../brand/types';

const brand: BrandKit = {
  sourceUrl: 'https://example.com',
  name: 'Daily',
  logoUrl: 'https://cdn.example/logo.png',
  colors: { primary: '#560E50', secondary: '#885580', background: '#FDFAF1', text: '#171817' },
  fonts: { heading: 'Forrest', body: 'DM Sans' },
  source: 'fallback',
  images: [
    { url: 'https://cdn.example/p1.png', label: 'Starter set', kind: 'product', cutoutUrl: 'https://cdn.example/c1.png' },
    { url: 'https://cdn.example/p2.png', label: 'All flavours', kind: 'product', cutoutUrl: 'https://cdn.example/c2.png' },
    { url: 'https://cdn.example/life.png', label: 'In hand', kind: 'lifestyle' },
  ],
};

describe('buildLayeredPoster', () => {
  it('composes scene, real product cutouts, headline, label and logo as layers', () => {
    const doc = buildLayeredPoster({ id: 'x', brand, headline: 'BERRY\nREFRESH', label: 'Berry flavour', sceneUrl: 'https://cdn.example/scene.png' });
    const layers = doc.scenes[0].layers;
    expect(layers[0]).toMatchObject({ id: 'p-bg', src: 'https://cdn.example/scene.png' });
    const products = layers.filter((l) => l.id.startsWith('p-product'));
    expect(products.length).toBeGreaterThanOrEqual(2);
    expect(products[0].src).toBe('https://cdn.example/c1.png');
    expect(layers.some((l) => l.kind === 'logo' && l.src === 'https://cdn.example/logo.png')).toBe(true);
    expect(layers.some((l) => l.id === 'p-headline' && l.text === 'BERRY\nREFRESH')).toBe(true);
  });

  it('falls back to a lifestyle photo as the scene when no scene was generated', () => {
    const doc = buildLayeredPoster({ id: 'x', brand, headline: 'HI' });
    expect(doc.scenes[0].layers[0].src).toBe('https://cdn.example/life.png');
  });
});

describe('posterHeadline', () => {
  it('stacks the first clause in two lines', () => {
    expect(posterHeadline('Berry flavour launch: sticks and bottle')).toBe('BERRY FLAVOUR\nLAUNCH');
    expect(posterHeadline('Glow up')).toBe('GLOW UP');
  });
});
