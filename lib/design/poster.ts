import { makeLayer, parseSceneDoc, type SceneDoc } from '../scenedoc';
import type { BrandKit } from '../brand/types';

/** Headline copy for a composed poster: the brief's first clause, 2–4 words, stacked. */
export function posterHeadline(brief: string): string {
  const first = brief.split(/[.!\n:,]/)[0].trim();
  const words = first.split(/\s+/).filter(Boolean).slice(0, 4);
  if (words.length <= 2) return words.join(' ').toUpperCase();
  return `${words.slice(0, 2).join(' ')}\n${words.slice(2).join(' ')}`.toUpperCase();
}

/**
 * A Hera-style composed poster: a generated scene background (no product),
 * the brand's REAL product photos/cutouts arranged as a small group, the
 * brand's headline type and logo on top — every element its own layer, so
 * the poster is editable and animatable instead of one baked image.
 */
export function buildLayeredPoster(input: {
  id: string;
  brand: BrandKit;
  headline: string;
  label?: string;
  sceneUrl?: string;
}): SceneDoc {
  const { brand } = input;
  const products = (brand.images ?? []).filter((i) => i.kind === 'product');
  const cutouts = products.filter((i) => i.cutoutUrl);
  // Hero first (cutout preferred), then more units — Hera ads show a group,
  // never one lone product. A single cutout is repeated at a second size.
  const units: string[] = [];
  if (cutouts[0]) units.push(cutouts[0].cutoutUrl!);
  if (cutouts[1]) units.push(cutouts[1].cutoutUrl!);
  else if (products[1]) units.push(products[1].url);
  else if (cutouts[0]) units.push(cutouts[0].cutoutUrl!);
  if (products[2]) units.push(products[2].url);

  const lifestyle = (brand.images ?? []).find((i) => i.kind === 'lifestyle')?.url;
  const bg = input.sceneUrl ?? lifestyle;

  const layers = [
    ...(bg
      ? [makeLayer({ id: 'p-bg', kind: 'image' as const, name: 'Scene background', transform: { x: 0, y: 0, w: 1080, h: 1920 }, src: bg, motion: { preset: 'ken-burns' as const, delayMs: 0, durationMs: 700 } })]
      : []),
    makeLayer({
      id: 'p-shadow',
      kind: 'shape',
      name: 'Product shadow',
      transform: { x: 240, y: 1420, w: 600, h: 90 },
      style: { fill: 'rgba(23,24,23,0.20)', borderRadius: 999 },
      motion: { preset: 'fade-in', delayMs: 200, durationMs: 500 },
    }),
    ...units.map((src, i) => {
      const slots = [
        { x: 300, y: 760, w: 480, h: 640, rotation: 0 },
        { x: 60, y: 920, w: 330, h: 440, rotation: -5 },
        { x: 700, y: 950, w: 310, h: 410, rotation: 5 },
      ];
      const s = slots[i % slots.length];
      return makeLayer({
        id: `p-product-${i + 1}`,
        kind: 'image' as const,
        name: i === 0 ? 'Product hero (your photo)' : `Product ${i + 1} (your photo)`,
        transform: s,
        src,
        motion: { preset: 'float' as const, delayMs: 150 + i * 120, durationMs: 600 },
      });
    }),
    makeLayer({
      id: 'p-headline',
      kind: 'text',
      name: 'Headline',
      transform: { x: 70, y: 150, w: 940, h: 430 },
      text: input.headline,
      style: { fontFamily: brand.fonts.heading, fontSize: 148, fontWeight: 800, color: brand.colors.text, textAlign: 'left' },
      motion: { preset: 'reveal', delayMs: 250, durationMs: 700 },
    }),
    ...(input.label
      ? [
          makeLayer({
            id: 'p-label',
            kind: 'callout' as const,
            name: 'Label',
            transform: { x: 70, y: 610, w: 430, h: 104 },
            text: input.label.toUpperCase(),
            style: { fill: brand.colors.primary, color: '#FFFFFF', fontFamily: brand.fonts.body, fontSize: 40, fontWeight: 700, borderRadius: 22, padding: 22 },
            motion: { preset: 'pop' as const, delayMs: 450, durationMs: 500 },
          }),
        ]
      : []),
    ...(brand.logoUrl
      ? [
          makeLayer({
            id: 'p-logo',
            kind: 'logo' as const,
            name: 'Logo',
            transform: { x: 64, y: 1920 - 84 - 64, w: 240, h: 84 },
            src: brand.logoUrl,
            motion: { preset: 'fade-in' as const, delayMs: 500, durationMs: 500 },
          }),
        ]
      : []),
  ];

  return parseSceneDoc({
    id: input.id,
    title: input.headline.replace(/\n/g, ' '),
    scenes: [{ id: `${input.id}-s1`, durationMs: 4000, background: brand.colors.background, layers }],
  });
}
