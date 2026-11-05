import { describe, expect, it } from 'vitest';
import { brandLogoSrc, ensureBrandLogo } from './decompose';
import { makeLayer, type Layer } from '../scenedoc';
import type { BrandKit } from '../brand/types';

const brand: BrandKit = {
  sourceUrl: 'https://example.com',
  name: 'Daily',
  logoUrl: 'https://cdn.example/logo-light.png',
  logoMarkUrl: 'https://cdn.example/logo-dark.png',
  colors: { primary: '#560E50', secondary: '#885580', background: '#FDFAF1', text: '#171817' },
  fonts: { heading: 'Forrest', body: 'DM Sans' },
  source: 'firecrawl',
};

const fit = { brand, artifactId: 'art_x', offsetX: 0, offsetY: 0, drawW: 1080, drawH: 1920, background: '#FDFAF1' };

const picture: Layer = makeLayer({ id: 'p1', kind: 'image', transform: { x: 0, y: 0, w: 500, h: 500 } });

describe('brandLogoSrc', () => {
  it('uses the coloured main logo on a light background', () => {
    expect(brandLogoSrc(brand, '#FDFAF1')).toBe(brand.logoUrl);
  });

  it('uses the light mark on a dark background', () => {
    expect(brandLogoSrc(brand, '#171817')).toBe(brand.logoMarkUrl);
  });
});

describe('ensureBrandLogo', () => {
  it('appends a bottom-left logo layer when vision found none', () => {
    const out = ensureBrandLogo([picture], fit);
    expect(out).toHaveLength(2);
    const logo = out[1];
    expect(logo.kind).toBe('logo');
    expect(logo.src).toBe(brand.logoUrl);
    // Bottom-left, fully inside the fitted design.
    expect(logo.transform.x).toBeGreaterThanOrEqual(fit.offsetX);
    expect(logo.transform.y + logo.transform.h).toBeLessThanOrEqual(fit.offsetY + fit.drawH);
    expect(logo.transform.y).toBeGreaterThan(fit.drawH / 2);
  });

  it('leaves a document that already has a logo untouched', () => {
    const logo = makeLayer({ id: 'l1', kind: 'logo', transform: { x: 10, y: 10, w: 100, h: 40 } });
    expect(ensureBrandLogo([picture, logo], fit)).toEqual([picture, logo]);
  });

  it('falls back to the brand name as text without logo assets', () => {
    const bare: BrandKit = { ...brand, logoUrl: undefined, logoMarkUrl: undefined };
    const out = ensureBrandLogo([picture], { ...fit, brand: bare });
    expect(out[1].kind).toBe('logo');
    expect(out[1].src).toBeUndefined();
    expect(out[1].text).toBe('Daily');
  });
});
