import { randomUUID } from 'node:crypto';
import { SceneDocSchema, type SceneDoc } from './scenedoc';

export const MAX_MERGED_SCENES = 24;

/**
 * Merges animation blocks (cards) into one film: the scenes concatenate in
 * the order given, keeping every scene's authored layers, background and
 * duration. Ids are rewritten so the merged document is internally unique —
 * nothing about the source semantics of the layers is invented or changed.
 */
export function mergeSceneDocs(docs: SceneDoc[], title = 'Merged film'): SceneDoc {
  if (docs.length < 2) throw new Error('Select at least two cards to merge.');
  const total = docs.reduce((sum, d) => sum + d.scenes.length, 0);
  if (total > MAX_MERGED_SCENES) {
    throw new Error(`That merge makes ${total} scenes — too many for one film (max ${MAX_MERGED_SCENES}). Merge fewer cards.`);
  }

  const artifactId = `art_${randomUUID().slice(0, 8)}`;
  const scenes = docs.flatMap((doc, docIndex) =>
    doc.scenes.map((scene, sceneIndex) => {
      const sceneId = `${artifactId}-s${docIndex + 1}-${sceneIndex + 1}`;
      return {
        ...scene,
        id: sceneId,
        layers: scene.layers.map((layer, layerIndex) => ({
          ...layer,
          id: `${sceneId}-l${layerIndex + 1}`,
        })),
      };
    }),
  );

  return SceneDocSchema.parse({ id: artifactId, title, scenes });
}
