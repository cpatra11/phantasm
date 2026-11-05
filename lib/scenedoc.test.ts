import { describe, expect, it } from 'vitest';
import { applyPatch, cardMeta, deriveLayout, durationFrames, makeLayer, normalizeStoryboard, type SceneDoc } from './scenedoc';

const doc: SceneDoc = {
  id: 'd1',
  title: 'Test',
  scenes: [
    {
      id: 's1',
      durationMs: 2000,
      background: '#fff',
      layers: [
        makeLayer({ id: 'headline', kind: 'text', transform: { x: 100, y: 200, w: 800, h: 300 }, text: 'Hi', style: { fontSize: 100, color: '#000' } }),
        makeLayer({ id: 'hero', kind: 'image', transform: { x: 0, y: 500, w: 1080, h: 900 } }),
      ],
    },
    {
      id: 's2',
      durationMs: 1000,
      background: '#000',
      layers: [makeLayer({ id: 'logo', kind: 'logo', transform: { x: 340, y: 700, w: 400, h: 160 } })],
    },
  ],
};

describe('durationFrames', () => {
  it('sums scene durations at 30 fps', () => {
    expect(durationFrames(doc)).toBe(90);
  });
});

describe('deriveLayout', () => {
  it('returns the master unchanged for 9:16', () => {
    expect(deriveLayout(doc, '9:16')).toBe(doc);
  });

  it('fits to height and centers for 16:9', () => {
    const out = deriveLayout(doc, '16:9');
    const s = 1080 / 1920;
    const hero = out.scenes[0].layers[1];
    expect(hero.transform.h).toBeCloseTo(900 * s);
    expect(hero.transform.x).toBeCloseTo((1920 - 1080 * s) / 2);
    expect(out.scenes[0].layers[0].style.fontSize).toBeCloseTo(100 * s);
  });
});

describe('normalizeStoryboard', () => {
  const brand = {
    name: 'Daily',
    logoUrl: 'https://cdn.example/logo.png',
    colors: { primary: '#111', secondary: '#222', background: '#FDFAF1', text: '#560E50' },
    fonts: { heading: 'Forrest', body: 'DM Sans' },
    source: 'firecrawl' as const,
  };

  it('flattens every scene to the brand background and appends a logo end card', () => {
    const out = normalizeStoryboard(doc, brand);
    expect(out.scenes.every((s) => s.background === '#FDFAF1')).toBe(true);
    const last = out.scenes[out.scenes.length - 1];
    const logo = last.layers.find((l) => l.kind === 'logo');
    expect(logo?.src).toBe('https://cdn.example/logo.png');
    expect(doc.scenes[1].background).toBe('#000'); // original untouched
  });

  it('does not duplicate an existing end-card logo and fills missing logo art', () => {
    const withLogo: SceneDoc = {
      ...doc,
      scenes: [
        doc.scenes[0],
        { id: 's9', durationMs: 2000, background: '#123456', layers: [makeLayer({ id: 'lg', kind: 'logo', transform: { x: 340, y: 860, w: 400, h: 150 }, text: 'Daily' })] },
      ],
    };
    const out = normalizeStoryboard(withLogo, brand);
    const logos = out.scenes[1].layers.filter((l) => l.kind === 'logo');
    expect(logos).toHaveLength(1);
    expect(logos[0].src).toBe('https://cdn.example/logo.png');
  });
});

describe('cardMeta', () => {
  it('labels storyboards, designs, animations and posters like Hera card headers', () => {
    expect(cardMeta(doc, 'Launch story').label).toBe('Storyboard · 9:16 · 2 scenes · 3s');
    expect(cardMeta(doc, 'Launch story design').kind).toBe('Design');
    expect(cardMeta(doc, 'Launch story animation').kind).toBe('Animation');
    const poster: SceneDoc = {
      id: 'p1',
      title: 'Ad',
      scenes: [
        {
          id: 's1',
          durationMs: 4000,
          background: '#fff',
          layers: [makeLayer({ id: 'img', kind: 'image', transform: { x: 0, y: 0, w: 1080, h: 1920 } })],
        },
      ],
    };
    expect(cardMeta(poster, 'Daily ads for Instagram: one').label).toBe('Image · 9:16 · 1 scene · 4s');
  });
});

describe('applyPatch', () => {
  it('sets an allowed style path', () => {
    const out = applyPatch(doc, [{ op: 'set', layerId: 'headline', path: 'style.color', value: '#f00' }]);
    expect(out.scenes[0].layers[0].style.color).toBe('#f00');
    expect(doc.scenes[0].layers[0].style.color).toBe('#000'); // original untouched
  });

  it('rejects paths outside the whitelist', () => {
    expect(() => applyPatch(doc, [{ op: 'set', layerId: 'headline', path: 'id', value: 'x' }])).toThrow(/not editable/);
  });

  it('enforces scope: other layers cannot change', () => {
    const allowed = new Set(['headline']);
    expect(() =>
      applyPatch(doc, [{ op: 'set', layerId: 'hero', path: 'motion.preset', value: 'pop' }], allowed),
    ).toThrow(/outside the requested scope/);
  });

  it('refuses to add layers in a scoped change', () => {
    const allowed = new Set(['headline']);
    const layer = makeLayer({ id: 'new', kind: 'shape', transform: { x: 0, y: 0, w: 10, h: 10 } });
    expect(() => applyPatch(doc, [{ op: 'upsert_layer', sceneId: 's1', layer }], allowed)).toThrow(/cannot be added/);
  });

  it('validates the resulting document', () => {
    expect(() => applyPatch(doc, [{ op: 'set', layerId: 'hero', path: 'motion.preset', value: 'explode' }])).toThrow();
  });
});
