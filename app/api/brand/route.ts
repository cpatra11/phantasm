import { randomUUID } from 'node:crypto';
import { requireUser, unauthorized } from '../../../lib/auth/server';
import { scrapeBrand } from '../../../lib/brand/firecrawl';
import { getStore } from '../../../lib/db';

export const runtime = 'nodejs';
// A measured build (Firecrawl + mirroring + 2 SAM cuts) took 47 s; the old 60 s
// cap left almost no headroom on Vercel. Matches /api/agent's budget.
export const maxDuration = 300;

/** GET /api/brand: the signed-in user's most recent brand kit (null if none). */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const brand = await getStore().getBrand(id);
    if (!brand || brand.userId !== user.id) return Response.json(null);
    return Response.json(brand);
  }
  const latest = await getStore().latestBrand(user.id);
  return Response.json(latest ?? null);
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  if (typeof body.url !== 'string' || !/^https?:\/\//.test(body.url)) {
    return Response.json({ error: 'Enter a full http or https address.' }, { status: 400 });
  }

  try {
    const brand = await scrapeBrand(body.url);
    const record = {
      ...brand,
      id: `brand_${randomUUID().slice(0, 8)}`,
      userId: user.id,
      createdAt: new Date().toISOString(),
    };
    await getStore().saveBrand(record);
    return Response.json(record);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Could not read that site.' }, { status: 502 });
  }
}
