import type { BrandImage, BrandKit } from './types';
import { putAsset } from '../storage';

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'brand';
  }
}

/** Short display name: "Daily – Water with Benefits" → "Daily". */
function shortName(name: string): string {
  return name.split(/\s+[–—|·-]\s+/)[0].trim() || name;
}

/** Used when no Firecrawl key is configured or the site cannot be read. */
export function fallbackBrand(url = 'https://example.com'): BrandKit {
  return {
    sourceUrl: url,
    name: hostOf(url).replace(/^www\./, ''),
    colors: { primary: '#f04e98', secondary: '#ff8a3d', background: '#ffffff', text: '#111111' },
    fonts: { heading: 'Inter', body: 'Inter' },
    source: 'fallback',
  };
}

type Branding = Record<string, unknown>;

/**
 * Site CDNs are frequently geo-blocked (Shopify resolves to dead IPs in some
 * regions), so every kept asset is mirrored into our own storage through an
 * image proxy before it reaches the board. Falls back to the original URL.
 */
async function mirrorImage(url: string, key: string): Promise<string> {
  const withoutScheme = url.replace(/^https?:\/\//, '');
  const proxied = `https://wsrv.nl/?url=${encodeURIComponent(withoutScheme)}&w=1400&output=png`;
  for (const candidate of [proxied, url]) {
    try {
      const res = await fetch(candidate, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 1000) continue;
      return await putAsset(buf, key);
    } catch {
      // try the next candidate
    }
  }
  return url;
}

/** Pulls a usable logo: a colour wordmark when the site has one, else the branding logo. */
function pickLogo(branding: Branding, images: Array<{ alt: string; url: string }>): { logoUrl?: string; markUrl?: string } {
  const bImages = (branding.images ?? {}) as Record<string, unknown>;
  const declared = typeof bImages.logo === 'string' ? bImages.logo : typeof branding.logo === 'string' ? branding.logo : undefined;
  const wordmarks = images.filter((i) => /logo|wordmark|wortmarke/i.test(`${i.alt} ${i.url}`));
  const colour = wordmarks.find((i) => !/invert|hell|white|dark|schwarz|weiss/i.test(`${i.alt} ${i.url}`));
  return { logoUrl: colour?.url ?? declared, markUrl: declared };
}

/** Keeps only images that are large enough and look like real brand assets. */
function pickGallery(markdown: string, sourceHost: string): Array<{ alt: string; url: string }> {
  const seen = new Set<string>();
  const out: Array<{ alt: string; url: string }> = [];
  for (const m of markdown.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    const url = m[2];
    const alt = m[1].trim();
    const width = Number(new URL(url).searchParams.get('width') ?? 0);
    if (width > 0 && width < 500) continue;
    if (/favicon|icon-|sprite|pixel|\.gif(\?|$)/i.test(url)) continue;
    // Same site (www or apex) or Shopify's CDN; expired third-party CDNs are not brand assets.
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    const norm = (h: string) => h.replace(/^www\./, '');
    const sameHost = norm(host) === norm(sourceHost) || norm(host).endsWith(`.${norm(sourceHost)}`) || norm(sourceHost).endsWith(`.${norm(host)}`);
    const shopify = /(^|\.)shopify\.com$/.test(host);
    if (!sameHost && !shopify) continue;
    const key = new URL(url).pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ alt, url });
  }
  return out;
}

function classify(alt: string, url: string): 'product' | 'lifestyle' | 'screenshot' | 'other' {
  const hay = `${alt} ${url}`;
  if (/screen|dashboard|interface|mockup|app-|produktseite/i.test(hay)) return 'screenshot';
  if (/hero_packshot|packshot|bottle|dose|box|bundle|stick|product|category_|flasche|pack/i.test(hay)) return 'product';
  if (/hero|lifestyle|ritual|morning|summer|pool|gym|desk|campaign|banner/i.test(hay)) return 'lifestyle';
  return 'other';
}

/** Product shots first: hero packshots rank above category tiles. */
function productScore(url: string): number {
  if (/hero_packshot/i.test(url)) return 5;
  if (/packshot|packung/i.test(url)) return 4;
  if (/bundle|box|dose|bottle|flasche|stick/i.test(url)) return 3;
  if (/category_/i.test(url)) return 2;
  return 1;
}

/** Extracts headline-like copy from the markdown's own headings. */
function pickVoice(markdown: string): string[] {
  const headings = markdown
    .split('\n')
    .filter((l) => /^#{1,4}\s/.test(l))
    .map((l) =>
      l
        .replace(/^#{1,4}\s*/, '')
        .replace(/[*_>`]/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .trim(),
    )
    .filter((l) => l.length >= 6 && l.length <= 80 && !/^https?:/i.test(l) && !/blocked|captcha|access denied|403/i.test(l) && !/^(menu|shop|cart|search|login|newsletter|folge uns)/i.test(l));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of headings) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Firecrawl: scrape(url, formats=['branding','markdown']) returns logo, palette,
 * typography, site copy and imagery in one call. Every asset is mirrored into our
 * storage, then the top product packshots are cut out with SAM, so the kit carries
 * transparent cutouts the way a designer's brand folder does.
 */
export async function scrapeBrand(url: string, opts?: { cutouts?: boolean }): Promise<BrandKit> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return fallbackBrand(url);

  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ url, formats: ['branding', 'markdown'], onlyMainContent: false }),
  });
  if (!res.ok) throw new Error(`Firecrawl failed: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as {
    data?: { branding?: Branding; markdown?: string; metadata?: Record<string, unknown> };
    branding?: Branding;
    markdown?: string;
    metadata?: Record<string, unknown>;
  };
  const data = json.data ?? json;
  const b = (data.branding ?? {}) as Branding;
  const markdown = typeof data.markdown === 'string' ? data.markdown : '';
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const colors = (b.colors ?? {}) as Record<string, unknown>;
  const fonts = Array.isArray(b.fonts) ? (b.fonts as Array<{ family?: unknown; role?: unknown }>) : [];
  const fontFamily = (i: number) => (typeof fonts[i]?.family === 'string' ? (fonts[i].family as string) : undefined);
  const heading = fonts.find((f) => f.role === 'heading')?.family;
  const body = fonts.find((f) => f.role === 'body')?.family;

  const gallery = pickGallery(markdown, hostOf(url));
  const { logoUrl, markUrl } = pickLogo(b, gallery);

  const productCandidates = gallery
    .filter((i) => classify(i.alt, i.url) === 'product')
    .sort((a, c) => productScore(c.url) - productScore(a.url))
    .slice(0, 4);
  const lifestyle = gallery.filter((i) => classify(i.alt, i.url) === 'lifestyle').slice(0, 2);
  const screenshots = gallery.filter((i) => classify(i.alt, i.url) === 'screenshot').slice(0, 2);

  const nameFromMeta =
    typeof metadata['og:site_name'] === 'string' ? shortName(metadata['og:site_name'] as string) : '';
  const rawName = str(b.brandName, nameFromMeta || hostOf(url).replace(/^www\./, ''));
  const tagline = typeof metadata['og:description'] === 'string' ? (metadata['og:description'] as string).trim() : undefined;

  // Mirror everything we keep, in parallel, so the board never depends on the site.
  const [logoMirrored, markMirrored, ...mirroredGallery] = await Promise.all([
    logoUrl ? mirrorImage(logoUrl, `brand/${Date.now()}/logo.png`) : Promise.resolve(undefined),
    markUrl && markUrl !== logoUrl ? mirrorImage(markUrl, `brand/${Date.now()}/logo-mark.png`) : Promise.resolve(undefined),
    ...[...productCandidates, ...screenshots, ...lifestyle].map((i, idx) =>
      mirrorImage(i.url, `brand/${Date.now()}/img-${idx}.png`),
    ),
  ]);

  const ordered = [...productCandidates, ...screenshots, ...lifestyle];
  const images: BrandImage[] = ordered.map((i, idx) => ({
    url: mirroredGallery[idx],
    label: i.alt || (classify(i.alt, i.url) === 'product' ? 'Product' : 'Asset'),
    kind: classify(i.alt, i.url) === 'other' ? 'lifestyle' : classify(i.alt, i.url),
  }));

  const kit: BrandKit = {
    sourceUrl: url,
    name: shortName(rawName),
    ...(logoMirrored ? { logoUrl: logoMirrored } : {}),
    ...(markMirrored && markMirrored !== logoMirrored ? { logoMarkUrl: markMirrored } : {}),
    colors: {
      primary: str(colors.primary, '#111111'),
      secondary: str(colors.secondary ?? colors.accent, '#f04e98'),
      background: str(colors.background, '#ffffff'),
      text: str(colors.textPrimary ?? colors.text, '#111111'),
    },
    fonts: {
      heading: (typeof heading === 'string' ? heading : undefined) ?? fontFamily(0) ?? 'Inter',
      body: (typeof body === 'string' ? body : undefined) ?? fontFamily(1) ?? fontFamily(0) ?? 'Inter',
    },
    ...(images.length ? { images } : {}),
    ...(tagline ? { tagline } : {}),
    voice: pickVoice(markdown),
    source: 'firecrawl',
  };

  // LLM product understanding: what this product is and what its visuals
  // must show. Generators consume kit.about / kit.creative from here on.
  const { withProductBrief } = await import('./brief');
  const understood = await withProductBrief(kit, markdown).catch(() => kit);
  kit.about = understood.about;
  kit.creative = understood.creative;

  // Cut the top products out so the kit has transparent PNGs to reuse.
  if (opts?.cutouts !== false) {
    const { meta } = await import('../meta');
    const products = images.filter((i) => i.kind === 'product').slice(0, 2);
    await Promise.all(
      products.map(async (image) => {
        try {
          const concept = /bottle|flasche/i.test(image.label) ? 'bottle' : 'product';
          const cut = await meta.segment(image.url, concept);
          const sub = await fetch(cut.subjectUrl);
          const png = Buffer.from(await sub.arrayBuffer());
          image.cutoutUrl = await putAsset(png, `brand/${Date.now()}/cutout-${Math.random().toString(36).slice(2, 8)}.png`);
        } catch {
          // A missed cut is fine: the plain photo stays in the kit.
        }
      }),
    );
  }

  return kit;
}
