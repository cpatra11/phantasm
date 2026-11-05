import { getStore } from '../lib/db';
import { meta } from '../lib/meta';
import { allLayers } from '../lib/scenedoc';

async function main() {
  const db = getStore();
  const brandRec = await db.latestBrand('LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC');
  if (!brandRec) throw new Error('No brand.');
  const { id: _id, userId: _u, createdAt: _c, ...brand } = brandRec;

  const t0 = Date.now();
  const doc = await meta.storyboard({
    id: 'probe-board',
    prompt: 'Launch video for Daily, a drink-powder ritual: one stick, water, done. End with the logo.',
    angle: 'hook',
    brand,
  });
  console.log(`storyboard in ${((Date.now() - t0) / 1000).toFixed(1)}s · "${doc.title}" · ${doc.scenes.length} scenes · total ${doc.scenes.reduce((a, s) => a + s.durationMs, 0)}ms`);
  doc.scenes.forEach((s, i) => {
    console.log(`scene ${i + 1} dur=${s.durationMs} bg=${s.background} brandBg=${s.background === brand.colors.background}`);
    for (const l of s.layers) {
      console.log(`  ${l.kind.padEnd(7)} ${JSON.stringify(l.text ?? l.name ?? '').slice(0, 42).padEnd(42)} motion=${l.motion.preset} src=${l.src ? 'yes' : '-'}`);
    }
  });
  const last = doc.scenes[doc.scenes.length - 1];
  console.log('checks:', {
    allBrandBg: doc.scenes.every((s) => s.background === brand.colors.background),
    endCardLogo: last.layers.some((l) => l.kind === 'logo' && Boolean(l.src)),
    headlinesPerScene: doc.scenes.map((s) => s.layers.filter((l) => l.kind === 'text').length),
    layers: allLayers(doc).length,
  });
}

void main();
