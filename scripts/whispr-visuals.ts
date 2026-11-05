import { getStore } from '../lib/db';
import { generateStoryboards, generateSingleShot } from '../lib/agent/workflow';

/**
 * Multiple Wispr Flow visuals from the saved product brief (no rescrape):
 * 3 storyboard variants (multi-scene films-to-be) + 3 posters.
 * Run: npx tsx --env-file=.env.local scripts/whispr-visuals.ts
 */
async function main() {
  const db = getStore();
  const userId = 'LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC';
  const brandRec = await db.latestBrand(userId);
  if (!brandRec) throw new Error('No brand saved.');
  const { id: brandId, userId: _u, createdAt: _c, ...brand } = brandRec;
  console.log(`brand ${brand.name} · brief: ${brand.about ? 'yes' : 'NO'}`);

  console.log('storyboards x3');
  for await (const ev of generateStoryboards({
    db,
    userId,
    brand,
    brandId,
    prompt: 'Launch video for Wispr Flow, voice dictation that turns speech into polished writing in any app',
    count: 3,
    scenes: 4,
    variety: 'wide',
  })) {
    if (ev.type === 'version') console.log(`  variant -> ${ev.artifactId}`);
    if (ev.type === 'error') throw new Error(ev.message);
  }

  console.log('posters x3');
  for await (const ev of generateSingleShot({
    db,
    userId,
    brand,
    brandId,
    prompt: 'Wispr Flow: speak naturally and polished writing appears — voice dictation for every app',
    count: 3,
    variety: 'wide',
  })) {
    if (ev.type === 'version') console.log(`  poster -> ${ev.artifactId}`);
    if (ev.type === 'error') throw new Error(ev.message);
  }
  console.log('DONE');
}

void main();
