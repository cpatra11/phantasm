export type BrandImageKind = 'product' | 'lifestyle' | 'screenshot' | 'logo' | 'other';

/** One asset found on the brand's site, optionally cut out of its background. */
export type BrandImage = {
  url: string;
  /** Human label from the site (alt text), used as a prompt/concept. */
  label: string;
  kind: BrandImageKind;
  /** Transparent PNG of the subject (SAM), when the cut succeeded. */
  cutoutUrl?: string;
};

/**
 * LLM product understanding, built right after the site scrape: what the
 * product is, who it is for, and exactly what its pictures and films must
 * show. Every generator (poster, storyboard, animation) consumes this.
 */
export type CreativeBrief = {
  /** One paragraph: what the product is, what it does, why it matters. */
  whatItIs: string;
  audience: string;
  benefits: string[];
  /** Product-in-use moments to dramatise (e.g. "commuter dictating on a train"). */
  moments: string[];
  /** Concrete things that must appear in pictures (objects, actions, metaphors). */
  visualElements: string[];
  settings: string[];
  /** App/product UI pieces to rebuild in ui-demo scenes. */
  uiElements: string[];
  tone: string;
  avoid: string[];
};

export type BrandKit = {
  sourceUrl: string;
  name: string;
  logoUrl?: string;
  /** The light variant the site declares (for dark backgrounds), when it has one. */
  logoMarkUrl?: string;
  colors: { primary: string; secondary: string; background: string; text: string };
  fonts: { heading: string; body: string };
  /** Product shots, lifestyle photos and screenshots found on the site. */
  images?: BrandImage[];
  /** Real headline/copy samples from the site, used as copy candidates. */
  voice?: string[];
  /** The site's one-line description. */
  tagline?: string;
  /** LLM paragraph about the product (see CreativeBrief.whatItIs). */
  about?: string;
  /** Structured creative brief the generators create visuals from. */
  creative?: CreativeBrief;
  source: 'firecrawl' | 'fallback';
};
