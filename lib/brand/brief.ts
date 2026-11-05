import { z } from 'zod';
import { metaJSON, metaLive, SPARK_MODEL } from '../meta/config';
import type { BrandKit, CreativeBrief } from './types';

export const CreativeBriefSchema = z.object({
  whatItIs: z.string().min(40),
  audience: z.string().min(3),
  benefits: z.array(z.string()).min(2).max(6),
  moments: z.array(z.string()).min(2).max(6),
  visualElements: z.array(z.string()).min(3).max(10),
  settings: z.array(z.string()).min(1).max(5),
  uiElements: z.array(z.string()).max(8),
  tone: z.string().min(3),
  avoid: z.array(z.string()).max(6),
});

/** Deterministic brief from whatever the scrape found — used offline or when the model fails. */
export function fallbackBrief(brand: BrandKit): CreativeBrief {
  const name = brand.name;
  const tagline = brand.tagline?.trim();
  const voice = (brand.voice ?? []).filter(Boolean);
  const productLabels = (brand.images ?? []).filter((i) => i.kind === 'product').map((i) => i.label);
  const whatItIs = tagline
    ? `${name}: ${tagline}`
    : `${name} — ${voice[0] ?? 'a product people use every day'}. It deserves advertising that shows it in use, in its own colours (${brand.colors.primary} on ${brand.colors.background}), set in ${brand.fonts.heading}.`;
  return {
    whatItIs,
    audience: 'people who would recognise this product in their daily life',
    benefits: (voice.length ? voice : [tagline ?? name]).slice(0, 4),
    moments: [`someone using ${name} for the first time`, `${name} in the middle of a real day, not on a pedestal`],
    visualElements: [...productLabels.slice(0, 3), 'the product in a hand or in use', 'real settings with depth, not empty backdrops', 'the logo and brand colours carried through every frame'],
    settings: ['a believable everyday setting lit like a studio'],
    uiElements: (brand.images ?? []).filter((i) => i.kind === 'screenshot').map((i) => i.label).slice(0, 4),
    tone: 'confident, specific, warm',
    avoid: ['generic stock-photo scenes', 'a lone product floating on an empty backdrop', 'invented features the site never mentions'],
  };
}

const SYSTEM = `You are a senior creative strategist. Given raw material scraped from a product's website, you write the creative brief that image and film generators will work from. Be concrete and visual: name the actual objects, actions, places and interface pieces of THIS product — never generic marketing language. The visualElements list is the most important output: it is what will literally be drawn in the pictures. Return JSON only.`;

/**
 * LLM product understanding: reads the scraped kit (name, tagline, real site
 * copy, image labels, palette) and writes the paragraph + creative brief.
 * Falls back to a deterministic brief when the model is unavailable.
 */
export async function buildProductBrief(brand: BrandKit, siteExcerpt?: string): Promise<CreativeBrief> {
  if (!metaLive) return fallbackBrief(brand);
  try {
    const user = [
      `Product: ${brand.name} (${brand.sourceUrl})`,
      brand.tagline ? `Site description: ${brand.tagline}` : '',
      brand.voice?.length ? `Real headlines from the site:\n- ${brand.voice.join('\n- ')}` : '',
      brand.images?.length ? `Photos found on the site:\n- ${brand.images.map((i) => `${i.kind}: ${i.label}`).join('\n- ')}` : '',
      `Palette: primary ${brand.colors.primary}, secondary ${brand.colors.secondary}, background ${brand.colors.background}, text ${brand.colors.text}. Fonts: ${brand.fonts.heading} / ${brand.fonts.body}.`,
      siteExcerpt ? `Site copy excerpt:\n${siteExcerpt.slice(0, 3500)}` : '',
      '',
      'Write the creative brief JSON: { whatItIs (one paragraph, 60-110 words: what it is, what it does, the transformation it gives the user), audience, benefits (3-5 short phrases from the site, not invented), moments (3-5 product-in-use moments worth dramatising), visualElements (6-10 concrete things to SHOW: objects, actions, before/after states, metaphors grounded in the product), settings (2-4), uiElements (interface pieces if it is software, else []), tone, avoid (3-5 things that would betray the product) }.',
    ]
      .filter(Boolean)
      .join('\n');
    return await metaJSON(SPARK_MODEL, SYSTEM, user, CreativeBriefSchema, 6000);
  } catch {
    return fallbackBrief(brand);
  }
}

/** Attaches the brief to a kit (about mirrors whatItIs for prompt convenience). */
export async function withProductBrief(kit: BrandKit, siteExcerpt?: string): Promise<BrandKit> {
  const creative = kit.creative ?? (await buildProductBrief(kit, siteExcerpt));
  return { ...kit, creative, about: kit.about ?? creative.whatItIs };
}
