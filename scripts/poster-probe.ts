import { writeFileSync } from 'node:fs';
import { meta } from '../lib/meta';

async function main() {
  const prompt = [
    'Premium advertising poster for a drink powder brand called Daily.',
    'Warm cream background (#FDFAF1) with a huge plum (#560E50) headline in a bold editorial serif that reads exactly: "NO ADDED SUGAR".',
    'Below the headline, a single pink strawberry drink-stick pack, studio product photograph, soft shadow.',
    'Minimal Swiss layout, generous negative space, crisp typography, no other words, no logos, no watermark.',
  ].join(' ');
  const url = await meta.image(prompt);
  console.log(url.slice(0, 200));
  if (url.startsWith('data:')) {
    writeFileSync('research/probe/poster.png', Buffer.from(url.split(',')[1], 'base64'));
  } else {
    const res = await fetch(url);
    writeFileSync('research/probe/poster.png', Buffer.from(await res.arrayBuffer()));
  }
  console.log('saved');
}

void main();
