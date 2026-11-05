// Probe Firecrawl branding + markdown for a brand URL. Read-only.
const url = process.argv[2] ?? 'https://drink-daily.com';
const key = process.env.FIRECRAWL_API_KEY;
if (!key) throw new Error('FIRECRAWL_API_KEY missing');

const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ url, formats: ['branding', 'markdown'], onlyMainContent: false }),
});
console.log('status', res.status);
const json = await res.json();
const data = json.data ?? json;
const b = data.branding ?? {};
console.log('branding keys', Object.keys(b));
console.log(JSON.stringify({
  name: b.name,
  colors: b.colors,
  fonts: b.fonts,
  images: b.images,
  logo: b.logo,
  spacing: b.spacing,
}, null, 2).slice(0, 3000));
const md = data.markdown ?? '';
console.log('markdown bytes', md.length);
const imgs = [...md.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => ({ alt: m[1], url: m[2] }));
console.log('markdown images', imgs.length);
console.log(JSON.stringify(imgs.slice(0, 15), null, 2));
console.log('meta', JSON.stringify(data.metadata ?? {}, null, 2).slice(0, 1200));
