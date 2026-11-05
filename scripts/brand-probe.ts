import { scrapeBrand } from '../lib/brand/firecrawl';

async function main() {
  const t = Date.now();
  const kit = await scrapeBrand('https://drink-daily.com');
  console.log(JSON.stringify({ ms: Date.now() - t, ...kit }, null, 2).slice(0, 5000));
}

void main();
