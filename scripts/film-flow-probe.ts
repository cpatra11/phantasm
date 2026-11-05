import { randomUUID } from 'node:crypto';
import { getStore } from '../lib/db';
import { meta } from '../lib/meta';
import { resolveAssets } from '../lib/agent/workflow';

async function main() {
  const db = getStore();
  const userId = 'LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC';
  const brandRec = await db.latestBrand(userId);
  if (!brandRec) throw new Error('No brand.');
  const { id: brandId, userId: _u, createdAt: _c, ...brand } = brandRec;

  const artifactId = `art_${randomUUID().slice(0, 8)}`;
  const t0 = Date.now();
  const draft = await meta.storyboard({
    id: artifactId,
    prompt: 'Launch video for Daily, a drink-powder ritual: one stick, water, done. End with the logo.',
    angle: 'hook',
    brand,
  });
  const doc = await resolveAssets(draft, artifactId, brand);
  const now = new Date().toISOString();
  await db.createArtifact(
    { id: artifactId, userId, brandId, title: doc.title, prompt: 'film-flow probe (born-layered storyboard)', currentVersion: 1, createdAt: now },
    { artifactId, version: 1, doc, message: 'Initial draft', createdAt: now },
  );
  console.log(`created ${artifactId} "${doc.title}" in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  doc.scenes.forEach((s, i) => {
    console.log(` scene ${i + 1} dur=${s.durationMs} layers=${s.layers.length} images=${s.layers.filter((l) => l.kind === 'image').map((l) => (l.src ? 'ok' : 'MISSING')).join(',')}`);
  });
}

void main();
