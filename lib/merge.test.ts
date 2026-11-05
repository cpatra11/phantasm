import { describe, expect, it } from 'vitest';
import { mergeSceneDocs, MAX_MERGED_SCENES } from './merge';
import { makeLayer, type SceneDoc } from './scenedoc';

function doc(id: string, title: string, sceneCount: number): SceneDoc {
  return {
    id,
    title,
    scenes: Array.from({ length: sceneCount }, (_, i) => ({
      id: `${id}-s${i + 1}`,
      durationMs: 1000 + i * 100,
      background: '#FFFFFF',
      layers: [makeLayer({ id: `${id}-l${i + 1}`, kind: 'text', name: 'Headline', transform: { x: 10, y: 10, w: 100, h: 80 }, text: `${id} scene ${i + 1}` })],
    })),
  };
}

describe('mergeSceneDocs', () => {
  it('concatenates scenes in order with unique ids and preserved content', () => {
    const merged = mergeSceneDocs([doc('a', 'Film A', 2), doc('b', 'Film B', 2), doc('c', 'Film C', 1)]);
    expect(merged.scenes.map((s) => s.durationMs)).toEqual([1000, 1100, 1000, 1100, 1000]);
    const ids = merged.scenes.flatMap((s) => s.layers.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(merged.scenes[0].layers[0].text).toBe('a scene 1');
    expect(merged.scenes[4].layers[0].text).toBe('c scene 1');
  });

  it('refuses fewer than two sources', () => {
    expect(() => mergeSceneDocs([doc('a', 'Film A', 1)])).toThrow(/at least two/i);
  });

  it('refuses merges above the scene cap', () => {
    const docs = Array.from({ length: Math.floor(MAX_MERGED_SCENES / 2) + 1 }, (_, i) => doc(`d${i}`, `F${i}`, 2));
    expect(() => mergeSceneDocs(docs)).toThrow(/too many/i);
  });
});
