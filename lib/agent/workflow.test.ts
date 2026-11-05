import { describe, expect, it } from 'vitest';
import { animateArtifact } from './workflow';
import { MemoryStore } from '../db/store';
import { makeLayer, type SceneDoc } from '../scenedoc';
import type { BrandKit } from '../brand/types';

const brand: BrandKit = {
  sourceUrl: 'https://example.com',
  name: 'Daily',
  colors: { primary: '#560E50', secondary: '#885580', background: '#FDFAF1', text: '#171817' },
  fonts: { heading: 'Forrest', body: 'DM Sans' },
  source: 'fallback',
};

function scene(id: string, durationMs: number, text: string): SceneDoc['scenes'][number] {
  return {
    id,
    durationMs,
    background: '#FDFAF1',
    layers: [
      makeLayer({ id: `${id}-img`, kind: 'image', transform: { x: 0, y: 400, w: 1080, h: 900 }, src: 'https://example.com/p.png' }),
      makeLayer({ id: `${id}-txt`, kind: 'text', transform: { x: 90, y: 120, w: 900, h: 220 }, text }),
    ],
  };
}

async function seed(store: MemoryStore, doc: SceneDoc) {
  const now = new Date().toISOString();
  await store.createArtifact(
    { id: doc.id, userId: 'u1', brandId: null, title: doc.title, prompt: 'p', currentVersion: 1, createdAt: now },
    { artifactId: doc.id, version: 1, doc, message: 'seed', createdAt: now },
  );
}

describe('animateArtifact', () => {
  it('animates every scene of a storyboard and keeps authored durations', async () => {
    const store = new MemoryStore();
    const doc: SceneDoc = {
      id: 'story1',
      title: 'Launch story',
      scenes: [scene('a', 2000, 'One'), scene('b', 3200, 'Two'), scene('c', 2600, 'End')],
    };
    await seed(store, doc);

    const events = [];
    for await (const ev of animateArtifact({ db: store, userId: 'u1', brand, brandId: null, sourceArtifactId: 'story1', prompt: 'Animate every storyboard as one film.' })) {
      events.push(ev);
    }

    const version = events.find((e) => e.type === 'version');
    expect(version?.type).toBe('version');
    const created = (await store.listArtifacts('u1')).find((a) => a.id !== 'story1');
    expect(created).toBeTruthy();
    const out = await store.getVersion(created!.id, 1);
    expect(out?.doc.scenes).toHaveLength(3);
    expect(out?.doc.scenes.map((s) => s.durationMs)).toEqual([2000, 3200, 2600]);
    expect(out?.doc.scenes.map((s) => s.layers[1].text)).toEqual(['One', 'Two', 'End']);
    for (const s of out!.doc.scenes) {
      for (const l of s.layers) expect(l.motion.preset).toBeDefined();
    }
  });

  it('animates every source card into its own film (multi-source)', async () => {
    const store = new MemoryStore();
    await seed(store, { id: 'story1', title: 'Launch story', scenes: [scene('a', 2000, 'One'), scene('b', 3200, 'Two')] });
    await seed(store, { id: 'story2', title: 'Teaser story', scenes: [scene('c', 2400, 'Three')] });

    const versions: string[] = [];
    for await (const ev of animateArtifact({
      db: store,
      userId: 'u1',
      brand,
      brandId: null,
      sourceArtifactIds: ['story1', 'story2'],
      prompt: 'Animate every storyboard as one film.',
    })) {
      if (ev.type === 'version') versions.push(ev.artifactId);
    }

    expect(versions).toHaveLength(2);
    const films = (await store.listArtifacts('u1')).filter((a) => a.title.endsWith('animation'));
    expect(films.map((f) => f.title).sort()).toEqual(['Launch story animation', 'Teaser story animation']);
    const multi = films.find((f) => f.title.startsWith('Launch'));
    const out = await store.getVersion(multi!.id, 1);
    expect(out?.doc.scenes).toHaveLength(2);
  });

  it('single-scene sources take long composer durations (Hera 30s preset)', async () => {
    const store = new MemoryStore();
    const doc: SceneDoc = { id: 'single2', title: 'One ad', scenes: [scene('a', 4000, 'Solo')] };
    await seed(store, doc);

    for await (const _ev of animateArtifact({ db: store, userId: 'u1', brand, brandId: null, sourceArtifactId: 'single2', prompt: 'Animate this ad.', durationMs: 30000 })) {
      // drain
    }
    const created = (await store.listArtifacts('u1')).find((a) => a.id !== 'single2');
    const out = await store.getVersion(created!.id, 1);
    expect(out?.doc.scenes[0].durationMs).toBe(30000);
  });

  it('single-scene sources take the composer duration', async () => {
    const store = new MemoryStore();
    const doc: SceneDoc = { id: 'single1', title: 'One ad', scenes: [scene('a', 4000, 'Solo')] };
    await seed(store, doc);

    for await (const _ev of animateArtifact({ db: store, userId: 'u1', brand, brandId: null, sourceArtifactId: 'single1', prompt: 'Animate this ad.', durationMs: 5000 })) {
      // drain
    }
    const created = (await store.listArtifacts('u1')).find((a) => a.id !== 'single1');
    const out = await store.getVersion(created!.id, 1);
    expect(out?.doc.scenes).toHaveLength(1);
    expect(out?.doc.scenes[0].durationMs).toBe(5000);
  });
});
