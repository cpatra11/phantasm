import { getStore } from '../lib/db';
import { animateArtifact } from '../lib/agent/workflow';

/** Animates one Whispr storyboard variant into a film. Run: npx tsx --env-file=.env.local scripts/whispr-animate.ts <storyboardId> */
async function main() {
  const db = getStore();
  const userId = 'LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC';
  const sourceId = process.argv[2];
  if (!sourceId) throw new Error('Usage: whispr-animate <storyboardId>');
  const brandRec = await db.latestBrand(userId);
  if (!brandRec) throw new Error('No brand saved.');
  const { id: brandId, userId: _u, createdAt: _c, ...brand } = brandRec;
  for await (const ev of animateArtifact({ db, userId, brand, brandId, sourceArtifactIds: [sourceId], prompt: 'Animate every scene as one film' })) {
    if (ev.type === 'version') console.log(`film -> ${ev.artifactId}`);
    if (ev.type === 'error') throw new Error(ev.message);
  }
}

void main();
