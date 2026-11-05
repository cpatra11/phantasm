import { getStore } from '../lib/db';
import { scrapeBrand } from '../lib/brand/firecrawl';
import { generateStoryboards, animateArtifact } from '../lib/agent/workflow';

/**
 * Whispr Flow launch film v2: fresh scrape -> LLM product brief -> born-layered
 * storyboard (grounded in the brief) -> animated film. Credit-free via workflows.
 * Run: npx tsx --env-file=.env.local scripts/whispr-video2.ts
 */
async function main() {
  const db = getStore();
  const userId = 'LRtoCv6SZ3quADzGzZ7eG7M3ea9zV0jC';

  console.log('1/3 brand + product understanding');
  const brand = await scrapeBrand('https://whisprflow.com');
  const brandId = `brand_${Math.random().toString(36).slice(2, 10)}`;
  await db.saveBrand({ ...brand, id: brandId, userId, createdAt: new Date().toISOString() });
  console.log(`   ${brand.name} · images=${brand.images?.length ?? 0}`);
  console.log(`   ABOUT: ${brand.about ?? '(none)'}`);
  console.log(`   SHOW: ${(brand.creative?.visualElements ?? []).join(' · ')}`);
  console.log(`   UI: ${(brand.creative?.uiElements ?? []).join(' · ')}`);

  console.log('2/3 storyboard (1 variant, 4 scenes)');
  let storyId = '';
  for await (const ev of generateStoryboards({
    db,
    userId,
    brand,
    brandId,
    prompt: 'Launch video for Wispr Flow, voice dictation that turns speech into polished writing in any app',
    count: 1,
    scenes: 4,
  })) {
    if (ev.type === 'version') storyId = ev.artifactId;
    if (ev.type === 'error') throw new Error(ev.message);
  }
  console.log(`   storyboard ${storyId}`);
  const storyArt = await db.getArtifact(storyId);
  const storyDoc = (await db.getVersion(storyId, storyArt!.currentVersion))!.doc;
  storyDoc.scenes.forEach((s, i) => {
    console.log(`   scene ${i + 1} (${(s.durationMs / 1000).toFixed(1)}s): ${s.layers.map((l) => l.text ?? l.name).filter(Boolean).join(' | ').slice(0, 130)}`);
  });

  console.log('3/3 film (whole storyboard animated)');
  let filmId = '';
  for await (const ev of animateArtifact({ db, userId, brand, brandId, sourceArtifactIds: [storyId], prompt: 'Animate every scene as one film' })) {
    if (ev.type === 'version') filmId = ev.artifactId;
    if (ev.type === 'error') throw new Error(ev.message);
  }
  console.log(`   film ${filmId}`);
}

void main();
