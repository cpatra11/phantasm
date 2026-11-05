import { z } from 'zod';
import { metaVisionJSON, WONDER_MODEL, SPARK_MODEL } from '../lib/meta/config';
import { getStore } from '../lib/db';
import { allLayers } from '../lib/scenedoc';

const Probe = z.object({
  headline: z.string().optional(),
  background: z.string().optional(),
  elements: z.array(z.string()).default([]),
});

async function main() {
  const db = getStore();
  const arts = await db.listArtifacts('LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC');
  let imageUrl: string | null = null;
  for (const a of arts) {
    const v = await db.getVersion(a.id, a.currentVersion);
    const img = v ? allLayers(v.doc).find((l) => l.kind === 'image' && l.src) : undefined;
    if (img?.src) { imageUrl = img.src; console.log('image from', a.id); break; }
  }
  if (!imageUrl) throw new Error('No image found in store.');
  console.log('image:', imageUrl.slice(0, 110));

  for (const model of [WONDER_MODEL, SPARK_MODEL]) {
    const t0 = Date.now();
    try {
      const out = await metaVisionJSON(
        model,
        'You read a flat advertisement image. Return JSON: {"headline": "the exact main headline text", "background": "#RRGGBB dominant background", "elements": ["short names of visible elements"]}.',
        'Read this advertisement.',
        [imageUrl],
        Probe,
        2000,
      );
      console.log(model, 'OK', `${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(out).slice(0, 300));
    } catch (e) {
      console.log(model, 'FAILED', `${((Date.now() - t0) / 1000).toFixed(1)}s`, e instanceof Error ? e.message.slice(0, 300) : String(e));
    }
  }
}

void main();
