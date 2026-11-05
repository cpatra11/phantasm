import { writeFileSync } from 'node:fs';
import { segmentImage } from '../lib/meta/segment';

async function main() {
  const url = process.argv[2];
  const concept = process.argv[3] ?? 'the product pack';
  const t = Date.now();
  const cut = await segmentImage(url, concept, async (png, suffix) => {
    const p = `/tmp/basix-seg-${Date.now()}-${suffix}`;
    writeFileSync(p, png);
    return p;
  });
  console.log(JSON.stringify({ ms: Date.now() - t, ...cut }, null, 2));
}

void main();
