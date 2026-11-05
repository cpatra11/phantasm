import { z } from 'zod';
import sharp from 'sharp';
import { meta } from '../meta';
import { metaVisionJSON, SPARK_MODEL, WONDER_MODEL } from '../meta/config';
import { makeLayer, type Layer, type Scene, type SceneDoc } from '../scenedoc';
import { putAsset } from '../storage';
import type { BrandKit } from '../brand/types';

const Box = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const StyleSchema = z
  .object({
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
    fontWeight: z.number().optional(),
    color: z.string().optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    fill: z.string().optional(),
    borderRadius: z.number().optional(),
  })
  .partial()
  .default({});

export const DesignElementSchema = z.object({
  kind: z.enum(['text', 'logo', 'picture', 'shape', 'callout']),
  /** headline | subhead | cta | label | logo | product | badge */
  role: z.string().optional(),
  text: z.string().optional(),
  /** Percent of the source image (0–100), top-left origin. */
  box: Box,
  z: z.number().optional(),
  /** Short noun for segmentation, e.g. "product", "bottle", "logo". */
  concept: z.string().optional(),
  style: StyleSchema,
  /** How this element should move when the design is animated. */
  motion: z
    .object({
      preset: z.enum(['none', 'fade-in', 'slide-up', 'pop', 'reveal', 'float', 'ken-burns']),
      delayMs: z.number().min(0).max(2000).optional(),
      durationMs: z.number().min(100).max(1500).optional(),
    })
    .optional(),
  /** 0–1: how sure the read is about this element (copy, box, kind). */
  confidence: z.number().min(0).max(1).optional(),
});

export const DesignSpecSchema = z.object({
  /** Background color of the design, hex. */
  background: z.string().optional(),
  elements: z.array(DesignElementSchema).min(1).max(16),
});

export type DesignSpec = z.infer<typeof DesignSpecSchema>;
export type DesignElement = z.infer<typeof DesignElementSchema>;

const SYSTEM = `You are a senior advertising designer. You read a flat ad image and plan how to
rebuild it as an editable design file. Return one JSON object:
{
  "background": "#RRGGBB",
  "elements": [
    {
      "kind": "text" | "logo" | "picture" | "shape" | "callout",
      "role": "headline" | "subhead" | "cta" | "label" | "logo" | "product" | "badge",
      "text": "exact copy for text layers (keep line breaks as separate elements)",
      "box": { "x": 0-100, "y": 0-100, "w": 0-100, "h": 0-100 },
      "z": 0,
      "concept": "short noun for SAM, e.g. product, bottle, logo",
      "style": { "fontFamily": "...", "fontWeight": 400-900, "color": "#RRGGBB", "textAlign": "left|center|right", "fill": "#RRGGBB", "borderRadius": 0-80 },
      "motion": { "preset": "reveal|slide-up|fade-in|pop|float|ken-burns|none", "delayMs": 0-2000, "durationMs": 100-1500 },
      "confidence": 0.0-1.0
    }
  ]
}

Rules:
- Every headline line and every small label is its OWN text element with the exact words, no paraphrasing, no invented copy.
- The product photo / packshot is ONE "picture" element covering the product (not the whole image).
- The logo is ONE "logo" element with a short concept.
- Badges/pills are "callout" elements with text; plain color blocks are "shape".
- Boxes are percent of the image (x,y from top-left), tight around the element.
- Order elements bottom → top by increasing z (background first).
- Use the brand fonts and colors below when they match what you see.
- Motion: headline lines "reveal" in reading order, staggered 120-200ms apart; the product "float" or "ken-burns"; the logo "fade-in" early; badges "pop". Static decoration gets "none".
- Confidence: 1.0 when the copy and box are certain; lower it when text is partially hidden, stylised, or the box is a guess.`;

function brandLine(brand: BrandKit): string {
  return `Brand: ${brand.name}. Heading font: ${brand.fonts.heading}. Body font: ${brand.fonts.body}. Palette: primary ${brand.colors.primary}, secondary ${brand.colors.secondary}, background ${brand.colors.background}, text ${brand.colors.text}.`;
}

/** Downloads the image once; used for sizing, crops and cutouts. */
async function loadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not read the source image (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Reads the layout of a flat ad. Muse Wonder is the primary reader (probed
 * Nov 4: it accepts image input and returns valid layout JSON); Spark is the
 * fallback when Wonder's read fails.
 */
export async function readDesign(imageUrl: string, brand: BrandKit): Promise<DesignSpec> {
  const user = `Decompose this advertisement into editable layers.\n${brandLine(brand)}`;
  try {
    return await metaVisionJSON(WONDER_MODEL, SYSTEM, user, [imageUrl], DesignSpecSchema, 8000);
  } catch {
    return metaVisionJSON(SPARK_MODEL, SYSTEM, user, [imageUrl], DesignSpecSchema, 8000);
  }
}

function elementMotion(el: DesignElement): Layer['motion'] {
  if (!el.motion) return { preset: 'none', delayMs: 0, durationMs: 600 };
  return { preset: el.motion.preset, delayMs: el.motion.delayMs ?? 0, durationMs: el.motion.durationMs ?? 600 };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

/**
 * Picks the logo asset that reads on the design's background. The main logo is
 * the coloured one (Daily's red script); the mark is the light variant the site
 * declares for dark grounds — so light backgrounds take the main logo, dark
 * backgrounds the mark. Verified against the mirrored assets (Nov 4).
 */
export function brandLogoSrc(brand: BrandKit, background?: string): string | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(background ?? '');
  if (hex) {
    const n = parseInt(hex[1], 16);
    const luminance = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 0xff) + 0.0722 * (n & 0xff)) / 255;
    if (luminance <= 0.6 && brand.logoMarkUrl) return brand.logoMarkUrl;
  }
  return brand.logoUrl ?? brand.logoMarkUrl;
}

/**
 * Guarantees a logo layer. Vision only reports a logo it can see, and a flat
 * poster usually has none baked in — so when the spec has no logo element,
 * the brand kit's logo is appended bottom-left, inside the fitted design.
 * Without any logo asset it falls back to the brand name as text.
 */
export function ensureBrandLogo(
  layers: Layer[],
  opts: {
    brand: BrandKit;
    artifactId: string;
    offsetX: number;
    offsetY: number;
    drawW: number;
    drawH: number;
    background: string;
  },
): Layer[] {
  if (layers.some((l) => l.kind === 'logo')) return layers;
  const { brand, artifactId, offsetX, offsetY, drawW, drawH, background } = opts;
  const w = Math.round(clamp(drawW * 0.22, 120, 260));
  const h = Math.round(w * 0.35);
  const src = brandLogoSrc(brand, background);
  return [
    ...layers,
    makeLayer({
      id: `${artifactId}-logo`,
      kind: 'logo',
      name: 'Logo',
      transform: {
        x: Math.round(offsetX + drawW * 0.05),
        y: Math.round(offsetY + drawH - h - drawH * 0.035),
        w,
        h,
      },
      ...(src ? { src } : {}),
      text: brand.name,
      style: {
        fontFamily: brand.fonts.heading,
        fontSize: clamp(h * 0.7, 18, 160),
        fontWeight: 700,
        color: brand.colors.text,
      },
    }),
  ];
}

/** Trim a transparent subject PNG to its content, so it can sit in the element box. */
async function trimPng(buffer: Buffer): Promise<Buffer> {
  const out = await sharp(buffer).trim({ threshold: 8 }).png().toBuffer();
  return out;
}

async function subjectPng(imageUrl: string, concept: string): Promise<Buffer | null> {
  try {
    const cut = await meta.segment(imageUrl, concept || 'product');
    const res = await fetch(cut.subjectUrl);
    if (!res.ok) return null;
    return await trimPng(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Rebuilds one flat image as editable layers: brand background, one text layer
 * per line, the logo as its own layer, and the product photo cut out of its
 * background. A product cut that fails falls back to a rectangular crop of the
 * source. Layer ids and asset keys are namespaced by `idPrefix`.
 */
export async function decomposeImageLayers(input: {
  imageUrl: string;
  brand: BrandKit;
  idPrefix: string;
}): Promise<{ layers: Layer[]; background: string; spec: DesignSpec }> {
  const { imageUrl, brand, idPrefix: artifactId } = input;
  const spec = await readDesign(imageUrl, brand);
  const source = await loadImage(imageUrl);
  const info = await sharp(source).metadata();
  if (!info.width || !info.height) throw new Error('The source ad has no size.');
  const { width, height } = info;

  // Fit the source design into the 9:16 canvas, centered, with a brand-color bleed.
  const scale = Math.min(1080 / width, 1920 / height);
  const drawW = width * scale;
  const drawH = height * scale;
  const offsetX = (1080 - drawW) / 2;
  const offsetY = (1920 - drawH) / 2;

  const toLayerBox = (b: z.infer<typeof Box>) => ({
    x: offsetX + (b.x / 100) * drawW,
    y: offsetY + (b.y / 100) * drawH,
    w: Math.max(8, (b.w / 100) * drawW),
    h: Math.max(8, (b.h / 100) * drawH),
  });

  const background = /^#[0-9a-f]{6}$/i.test(spec.background ?? '') ? spec.background! : brand.colors.background;

  let layers: Layer[] = [];
  const elements = [...spec.elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const box = toLayerBox(el.box);
    const id = `${artifactId}-l${i + 1}`;
    const style = el.style ?? {};

    if (el.kind === 'text' || el.kind === 'callout' || el.kind === 'shape') {
      const lines = Math.max(1, (el.text ?? '').split('\n').length);
      const fontSize = clamp(style.fontSize ?? (box.h / lines) * 0.68, 18, 260);
      layers.push(
        makeLayer({
          id,
          kind: el.kind === 'shape' ? 'shape' : el.kind === 'callout' ? 'callout' : 'text',
          name: (el.role || 'Text').replace(/^./, (c) => c.toUpperCase()),
          transform: box,
          text: el.text ?? '',
          style: {
            fontFamily: style.fontFamily || (el.role === 'headline' ? brand.fonts.heading : brand.fonts.body),
            fontSize,
            fontWeight: style.fontWeight ?? (el.role === 'headline' ? 800 : 600),
            color: style.color ?? brand.colors.text,
            textAlign: style.textAlign ?? 'left',
            ...(el.kind === 'shape' || el.kind === 'callout'
              ? { fill: style.fill ?? brand.colors.primary, borderRadius: style.borderRadius ?? 12 }
              : {}),
            ...(el.confidence !== undefined ? { confidence: el.confidence } : {}),
          },
          motion: elementMotion(el),
        }),
      );
      continue;
    }

    if (el.kind === 'logo') {
      let src = brandLogoSrc(brand, background);
      if (!src) {
        const png = await subjectPng(imageUrl, el.concept || 'logo');
        if (png) src = await putAsset(png, `${artifactId}/logo.png`);
      }
      layers.push(
        makeLayer({
          id,
          kind: 'logo',
          name: 'Logo',
          transform: box,
          ...(src ? { src } : {}),
          text: brand.name,
          style: {
            fontFamily: brand.fonts.heading,
            fontSize: clamp(box.h * 0.7, 18, 160),
            fontWeight: 700,
            color: brand.colors.text,
            ...(el.confidence !== undefined ? { confidence: el.confidence } : {}),
          },
          motion: elementMotion(el),
        }),
      );
      continue;
    }

    // picture: SAM cutout first, then a crop of the exact region.
    const concept = el.concept || (el.role === 'product' ? 'product' : 'product');
    let src: string | undefined;
    const cut = await subjectPng(imageUrl, concept);
    if (cut) {
      src = await putAsset(cut, `${artifactId}/picture-${i + 1}.png`);
    } else {
      const left = Math.round(clamp((el.box.x / 100) * width, 0, width - 1));
      const top = Math.round(clamp((el.box.y / 100) * height, 0, height - 1));
      const w = Math.round(clamp((el.box.w / 100) * width, 1, width - left));
      const h = Math.round(clamp((el.box.h / 100) * height, 1, height - top));
      const crop = await sharp(source).extract({ left, top, width: w, height: h }).png().toBuffer();
      src = await putAsset(crop, `${artifactId}/picture-${i + 1}-crop.png`);
    }
    layers.push(
      makeLayer({
        id,
        kind: 'image',
        name: el.role === 'product' ? 'Product' : 'Picture',
        transform: box,
        ...(src ? { src } : {}),
        style: { ...(el.confidence !== undefined ? { confidence: el.confidence } : {}) },
        motion: elementMotion(el),
      }),
    );
  }

  layers = ensureBrandLogo(layers, { brand, artifactId, offsetX, offsetY, drawW, drawH, background });

  return { layers, background, spec };
}

/** Rebuilds a flat ad as an editable one-scene SceneDoc. */
export async function decomposeAd(input: {
  imageUrl: string;
  brand: BrandKit;
  artifactId: string;
  title: string;
}): Promise<{ doc: SceneDoc; spec: DesignSpec }> {
  const { layers, background, spec } = await decomposeImageLayers({
    imageUrl: input.imageUrl,
    brand: input.brand,
    idPrefix: input.artifactId,
  });
  const doc: SceneDoc = {
    id: input.artifactId,
    title: input.title,
    scenes: [{ id: `${input.artifactId}-s1`, durationMs: 4000, background, layers }],
  };
  return { doc, spec };
}

/** The biggest image layer of a scene — the flat picture Design mode reads. */
export function sceneImage(scene: Scene): string | null {
  const images = scene.layers
    .filter((l) => l.kind === 'image' && typeof l.src === 'string')
    .sort((a, b) => b.transform.w * b.transform.h - a.transform.w * a.transform.h);
  return images[0]?.src ?? null;
}

/**
 * Makes every scene of a document editable: each scene's flat picture is read
 * and rebuilt as layers (scene durations are preserved, so an animated film
 * keeps its pacing). Scenes without a picture pass through unchanged.
 */
export async function decomposeDocument(input: {
  doc: SceneDoc;
  brand: BrandKit;
  artifactId: string;
}): Promise<{ doc: SceneDoc; layerCount: number; lowConfidence: number }> {
  const { doc: source, brand, artifactId } = input;
  const scenes: Scene[] = [];
  let layerCount = 0;
  let lowConfidence = 0;

  for (let i = 0; i < source.scenes.length; i++) {
    const scene = source.scenes[i];
    const imageUrl = sceneImage(scene);
    if (!imageUrl) {
      scenes.push({ ...structuredClone(scene), id: `${artifactId}-s${i + 1}` });
      layerCount += scene.layers.length;
      continue;
    }
    const { layers, background } = await decomposeImageLayers({
      imageUrl,
      brand,
      idPrefix: `${artifactId}-s${i + 1}`,
    });
    lowConfidence += layers.filter((l) => typeof l.style.confidence === 'number' && l.style.confidence < 0.75).length;
    layerCount += layers.length;
    scenes.push({ id: `${artifactId}-s${i + 1}`, durationMs: scene.durationMs, background, layers });
  }

  return { doc: { id: artifactId, title: source.title, scenes }, layerCount, lowConfidence };
}
