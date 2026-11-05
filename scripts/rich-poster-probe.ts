import { getStore } from '../lib/db';
import { generateSingleShot } from '../lib/agent/workflow';

/**
 * Credit-free live check of the new rich-scene poster prompt: runs Image mode
 * for the demo user through the real workflow (pooled Meta key, no app credit).
 * Run: npx tsx --env-file=.env.local scripts/rich-poster-probe.ts
 */
async function main() {
  const db = getStore();
  const userId = 'LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC';
  const brandRec = await db.latestBrand(userId);
  if (!brandRec) throw new Error('No brand for demo user.');
  const { id: brandId, userId: _u, createdAt: _c, ...brand } = brandRec;

  for await (const ev of generateSingleShot({
    db,
    userId,
    brand,
    brandId,
    prompt: 'Berry flavour launch: powder sticks and bottle with fresh strawberries, a splash of pink water',
    count: 1,
  })) {
    console.log(ev.type, ev.type === 'step' ? `${ev.label} ${ev.status}` : ev.type === 'version' ? ev.artifactId : '');
  }
}

void main();
