import { randomUUID } from 'node:crypto';
import { getStore } from '../lib/db';
import { makeLayer, parseSceneDoc, type SceneDoc } from '../lib/scenedoc';

/**
 * Seeds a credit-free "motion demo" artifact for the demo user: one scene per
 * new archetype (hook, ui-demo, data, product-hero, end-card) using the new
 * presets (type, count-up, slide-left). Run: npx tsx scripts/motion-demo-probe.ts
 */
async function main() {
  const db = getStore();
  const userId = 'LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC';
  const brandRec = await db.latestBrand(userId);
  if (!brandRec) throw new Error('No brand for demo user.');
  const { id: brandId, userId: _u, createdAt: _c, ...brand } = brandRec;
  const hero = brand.images?.find((i) => i.kind === 'product')?.url ?? brand.images?.[0]?.url;

  const artifactId = `art_${randomUUID().slice(0, 8)}`;
  const ink = brand.colors.text;
  const cream = brand.colors.background;
  const primary = brand.colors.primary;
  const secondary = brand.colors.secondary;
  const heading = brand.fonts.heading;
  const body = brand.fonts.body;

  const doc: SceneDoc = parseSceneDoc({
    id: artifactId,
    title: 'Daily Ritual — Motion Demo',
    scenes: [
      {
        id: `${artifactId}-s1`,
        durationMs: 3000,
        background: cream,
        layers: [
          makeLayer({ id: 's1-label', kind: 'callout', name: 'Label', transform: { x: 90, y: 420, w: 420, h: 110 }, text: 'DAILY RITUAL', style: { fill: primary, color: '#FFFFFF', fontFamily: body, fontSize: 44, borderRadius: 24, padding: 24 }, motion: { preset: 'pop', delayMs: 100, durationMs: 500 } }),
          makeLayer({ id: 's1-head', kind: 'text', name: 'Headline', transform: { x: 90, y: 620, w: 900, h: 700 }, text: 'ONE STICK.\nWATER.\nDONE.', style: { fontFamily: heading, fontSize: 170, fontWeight: 800, color: ink }, motion: { preset: 'reveal', delayMs: 250, durationMs: 700 } }),
        ],
      },
      {
        id: `${artifactId}-s2`,
        durationMs: 4500,
        background: primary,
        layers: [
          makeLayer({ id: 's2-window', kind: 'shape', name: 'UI window', transform: { x: 90, y: 380, w: 900, h: 980 }, style: { fill: '#FFFFFF', borderRadius: 28 }, motion: { preset: 'slide-up', delayMs: 0, durationMs: 600 } }),
          makeLayer({ id: 's2-side', kind: 'shape', name: 'UI sidebar', transform: { x: 90, y: 380, w: 240, h: 980 }, style: { fill: secondary, borderRadius: 28 }, motion: { preset: 'slide-left', delayMs: 150, durationMs: 500 } }),
          makeLayer({ id: 's2-title', kind: 'text', name: 'UI title', transform: { x: 390, y: 450, w: 540, h: 90 }, text: 'My ritual', style: { fontFamily: body, fontSize: 54, fontWeight: 700, color: ink }, motion: { preset: 'slide-left', delayMs: 300, durationMs: 500 } }),
          makeLayer({ id: 's2-row1', kind: 'shape', name: 'UI row 1', transform: { x: 390, y: 600, w: 520, h: 110 }, style: { fill: cream, borderRadius: 20 }, motion: { preset: 'slide-left', delayMs: 450, durationMs: 500 } }),
          makeLayer({ id: 's2-row2', kind: 'shape', name: 'UI row 2', transform: { x: 390, y: 740, w: 520, h: 110 }, style: { fill: cream, borderRadius: 20 }, motion: { preset: 'slide-left', delayMs: 600, durationMs: 500 } }),
          makeLayer({ id: 's2-type', kind: 'text', name: 'Typed prompt', transform: { x: 390, y: 920, w: 540, h: 160 }, text: 'Remind me at 7am…', style: { fontFamily: body, fontSize: 48, color: ink }, motion: { preset: 'type', delayMs: 800, durationMs: 1600 } }),
          makeLayer({ id: 's2-cursor', kind: 'shape', name: 'Cursor', transform: { x: 880, y: 1240, w: 34, h: 34 }, style: { fill: ink, borderRadius: 17 }, motion: { preset: 'pop', delayMs: 1400, durationMs: 400 } }),
          makeLayer({ id: 's2-cap', kind: 'text', name: 'Caption', transform: { x: 90, y: 1480, w: 900, h: 200 }, text: 'Set it once. Sip daily.', style: { fontFamily: heading, fontSize: 84, fontWeight: 700, color: '#FFFFFF' }, motion: { preset: 'reveal', delayMs: 1100, durationMs: 600 } }),
        ],
      },
      {
        id: `${artifactId}-s3`,
        durationMs: 3000,
        background: secondary,
        layers: [
          makeLayer({ id: 's3-num', kind: 'text', name: 'Stat', transform: { x: 90, y: 560, w: 900, h: 340 }, text: '92%', style: { fontFamily: heading, fontSize: 230, fontWeight: 800, color: '#FFFFFF', textAlign: 'center' }, motion: { preset: 'count-up', delayMs: 150, durationMs: 1200 } }),
          makeLayer({ id: 's3-line', kind: 'text', name: 'Support', transform: { x: 140, y: 960, w: 800, h: 220 }, text: 'drink more water every day', style: { fontFamily: body, fontSize: 62, color: '#FFFFFF', textAlign: 'center' }, motion: { preset: 'slide-up', delayMs: 500, durationMs: 600 } }),
        ],
      },
      {
        id: `${artifactId}-s4`,
        durationMs: 3500,
        background: cream,
        layers: [
          ...(hero
            ? [makeLayer({ id: 's4-img', kind: 'image', name: 'Product hero', transform: { x: 140, y: 300, w: 800, h: 800 }, src: hero, motion: { preset: 'ken-burns', delayMs: 0, durationMs: 700 } })]
            : []),
          makeLayer({ id: 's4-head', kind: 'text', name: 'Headline', transform: { x: 90, y: 1240, w: 900, h: 300 }, text: 'TASTE THE\nDIFFERENCE', style: { fontFamily: heading, fontSize: 120, fontWeight: 800, color: ink, textAlign: 'center' }, motion: { preset: 'reveal', delayMs: 300, durationMs: 650 } }),
        ],
      },
      {
        id: `${artifactId}-s5`,
        durationMs: 2500,
        background: cream,
        layers: [
          makeLayer({ id: 's5-logo', kind: 'logo', name: 'Logo', transform: { x: 240, y: 820, w: 600, h: 220 }, text: brand.name, ...(brand.logoUrl ? { src: brand.logoUrl } : {}), style: { fontFamily: heading, fontSize: 110, fontWeight: 700, color: ink, textAlign: 'center' }, motion: { preset: 'fade-in', delayMs: 150, durationMs: 600 } }),
          makeLayer({ id: 's5-tag', kind: 'text', name: 'Tagline', transform: { x: 190, y: 1080, w: 700, h: 120 }, text: 'One stick. Water. Done.', style: { fontFamily: body, fontSize: 52, color: ink, textAlign: 'center' }, motion: { preset: 'fade-in', delayMs: 450, durationMs: 600 } }),
        ],
      },
    ],
  });

  const now = new Date().toISOString();
  await db.createArtifact(
    { id: artifactId, userId, brandId, title: doc.title, prompt: 'motion-demo probe (archetypes + new presets)', currentVersion: 1, createdAt: now },
    { artifactId, version: 1, doc, message: 'Motion demo', createdAt: now },
  );
  console.log(`created ${artifactId} "${doc.title}" scenes=${doc.scenes.length} hero=${hero ? 'yes' : 'no'}`);
}

void main();
