import { meta } from '../meta';
import { imagePrompt } from '../meta/prompts';
import { SceneDocSchema, type SceneDoc } from '../scenedoc';
import type { BrandKit } from '../brand/types';
import { persistAsset } from '../storage';

const PRODUCT_NAME = /product|hero|bottle|stick|pack|can|jar|box/i;

/**
 * Generates images for empty image layers and runs SAM where the agent flagged
 * a layer. Product-hero layers are grounded in the brand's REAL product
 * photos/cutouts from its site (Hera reuses the same cutouts everywhere);
 * only scene/setting layers are generated.
 */
export async function resolveAssets(doc: SceneDoc, key: string, brand?: BrandKit | null): Promise<SceneDoc> {
  const next: SceneDoc = structuredClone(doc);
  const brandProducts = (brand?.images ?? []).filter((i) => i.kind === 'product');
  let grounded = 0;
  for (const scene of next.scenes) {
    for (const layer of scene.layers) {
      if (layer.kind === 'image' && !layer.src) {
        const real = PRODUCT_NAME.test(layer.name) ? brandProducts[grounded] : undefined;
        if (real) {
          layer.src = real.cutoutUrl ?? real.url;
          layer.segment = false;
          grounded++;
          continue;
        }
        const brief = layer.name || `${doc.title} visual`;
        const url = await meta.image(imagePrompt({ subject: brief, brand }));
        layer.src = await persistAsset(url, `${key}/${layer.id}.png`);
      }
      if (layer.segment && layer.src && !layer.samCutout) {
        try {
          const cut = await meta.segment(layer.src, layer.name || 'main subject');
          layer.samCutout = {
            subjectUrl: await persistAsset(cut.subjectUrl, `${key}/${layer.id}-subject.png`),
            backgroundUrl: await persistAsset(cut.backgroundUrl, `${key}/${layer.id}-background.png`),
          };
        } catch {
          // No match (or the cut failed): the layer keeps its plain image.
        }
      }
    }
  }
  return SceneDocSchema.parse(next);
}
