import { writeFileSync } from 'node:fs';
import { getStore } from '../lib/db';
import { decomposeDocument } from '../lib/design/decompose';
import { allLayers, makeLayer, type SceneDoc } from '../lib/scenedoc';

async function main() {
  const db = getStore();
  const userId = 'LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC';
  const brand = await db.latestBrand(userId);
  if (!brand) throw new Error('No brand in store.');

  const poster = await db.getVersion('art_58a3061c', 1);
  const posterImg = poster ? allLayers(poster.doc).find((l) => l.kind === 'image' && l.src)?.src : undefined;
  if (!posterImg) throw new Error('Poster image not found.');
  const brandImg = brand.images?.[0]?.url;
  if (!brandImg) throw new Error('Brand image not found.');

  const doc: SceneDoc = {
    id: 'probe-doc',
    title: 'Probe storyboard',
    scenes: [
      {
        id: 'p-s1',
        durationMs: 2800,
        background: brand.colors.background,
        layers: [makeLayer({ id: 'p1', kind: 'image', transform: { x: 0, y: 0, w: 1080, h: 1920 }, src: posterImg })],
      },
      {
        id: 'p-s2',
        durationMs: 3400,
        background: brand.colors.background,
        layers: [makeLayer({ id: 'p2', kind: 'image', transform: { x: 0, y: 0, w: 1080, h: 1920 }, src: brandImg })],
      },
    ],
  };

  const t0 = Date.now();
  const out = await decomposeDocument({ doc, brand, artifactId: 'art_probe01' });
  console.log(`decomposed in ${((Date.now() - t0) / 1000).toFixed(1)}s · ${out.layerCount} layers · ${out.lowConfidence} low-confidence`);
  for (const s of out.doc.scenes) {
    console.log(`scene ${s.id} dur=${s.durationMs} bg=${s.background}`);
    for (const l of s.layers) {
      console.log(
        `  ${l.kind.padEnd(7)} ${(l.name || '').padEnd(10)} text=${JSON.stringify(l.text ?? '').slice(0, 44).padEnd(44)} motion=${l.motion.preset}/${l.motion.delayMs}ms conf=${l.style.confidence ?? '-'}`,
      );
    }
  }
  writeFileSync('.zwork/probe-design.json', JSON.stringify(out.doc, null, 2));
  console.log('wrote .zwork/probe-design.json');
}

void main();
