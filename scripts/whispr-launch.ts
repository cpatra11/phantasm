import { getStore } from '../lib/db';
import { scrapeBrand } from '../lib/brand/firecrawl';
import { generateSingleShot, designArtifact, animateArtifact } from '../lib/agent/workflow';

/**
 * Produces the whisprflow launch video for the demo user, credit-free
 * (through the app's own workflows, bypassing the credit gate):
 * brand from whisprflow.com -> layered poster -> editable design -> film.
 * Run: npx tsx --env-file=.env.local scripts/whispr-launch.ts
 */
async function main() {
  const db = getStore();
  const userId = 'LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC';

  console.log('1/4 brand from whisprflow.com');
  const brand = await scrapeBrand('https://whisprflow.com');
  const brandId = `brand_${Math.random().toString(36).slice(2, 10)}`;
  await db.saveBrand({ ...brand, id: brandId, userId, createdAt: new Date().toISOString() });
  console.log(`   ${brand.name} · logo=${brand.logoUrl ? 'yes' : 'no'} · images=${brand.images?.length ?? 0} · voice=${brand.voice?.length ?? 0}`);

  console.log('2/4 layered poster (Image mode)');
  let posterId = '';
  for await (const ev of generateSingleShot({
    db,
    userId,
    brand,
    brandId,
    prompt: 'Whisprflow: speak your ideas, watch them become beautiful documents — one word at a time',
    count: 1,
  })) {
    if (ev.type === 'version') posterId = ev.artifactId;
    if (ev.type === 'error') throw new Error(ev.message);
  }
  console.log(`   poster ${posterId}`);

  console.log('3/4 editable design (Design mode)');
  let designId = '';
  for await (const ev of designArtifact({ db, userId, brand, brandId, sourceArtifactIds: [posterId], prompt: 'Make this ad editable' })) {
    if (ev.type === 'version') designId = ev.artifactId;
    if (ev.type === 'error') throw new Error(ev.message);
  }
  console.log(`   design ${designId}`);

  console.log('4/4 film (Animation mode, 10s)');
  let filmId = '';
  for await (const ev of animateArtifact({ db, userId, brand, brandId, sourceArtifactIds: [designId], prompt: 'Animate this ad', durationMs: 10000 })) {
    if (ev.type === 'version') filmId = ev.artifactId;
    if (ev.type === 'error') throw new Error(ev.message);
  }
  console.log(`   film ${filmId}`);
  console.log('DONE');
}

void main();
