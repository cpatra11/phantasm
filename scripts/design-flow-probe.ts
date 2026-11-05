import { getStore } from '../lib/db';
import { MemoryStore } from '../lib/db/store';
import { designArtifact } from '../lib/agent/workflow';
import { allLayers, makeLayer, type SceneDoc } from '../lib/scenedoc';

async function main() {
  const real = getStore();
  const userId = 'LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC';
  const brandRec = await real.latestBrand(userId);
  if (!brandRec) throw new Error('No brand.');
  const { id: _bid, userId: _uid, createdAt: _cat, ...brand } = brandRec;

  const poster = await real.getVersion('art_58a3061c', 1);
  const img = poster ? allLayers(poster.doc).find((l) => l.kind === 'image' && l.src)?.src : undefined;
  if (!img) throw new Error('No poster image.');

  const store = new MemoryStore();
  const now = new Date().toISOString();
  const srcDoc: SceneDoc = {
    id: 'src1',
    title: 'Daily ads for Instagram: one',
    scenes: [
      { id: 'src1-s1', durationMs: 4000, background: brand.colors.background, layers: [makeLayer({ id: 'p', kind: 'image', transform: { x: 0, y: 0, w: 1080, h: 1920 }, src: img })] },
      { id: 'src1-s2', durationMs: 2600, background: brand.colors.background, layers: [makeLayer({ id: 'p2', kind: 'image', transform: { x: 0, y: 0, w: 1080, h: 1920 }, src: img })] },
    ],
  };
  await store.createArtifact(
    { id: 'src1', userId: 'u1', brandId: null, title: srcDoc.title, prompt: 'probe', currentVersion: 1, createdAt: now },
    { artifactId: 'src1', version: 1, doc: srcDoc, message: 'seed', createdAt: now },
  );

  const t0 = Date.now();
  for await (const ev of designArtifact({ db: store, userId: 'u1', brand, brandId: null, sourceArtifactId: 'src1', prompt: 'Make this ad editable.' })) {
    console.log('event', JSON.stringify(ev));
  }
  console.log(`flow in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const created = (await store.listArtifacts('u1')).find((a) => a.id !== 'src1');
  if (!created) throw new Error('No design artifact created.');
  const out = await store.getVersion(created.id, 1);
  console.log('created', created.id, created.title);
  for (const s of out!.doc.scenes) {
    console.log(` scene dur=${s.durationMs} layers=${s.layers.length}:`, s.layers.map((l) => `${l.kind}:${l.name || l.text || ''}`).join(' | '));
  }
}

void main();
