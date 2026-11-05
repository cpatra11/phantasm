import { requireUser, unauthorized } from '../../../../lib/auth/server';
import { getStore } from '../../../../lib/db';
import { renderFilename } from '../../../../lib/render/filename';

export const runtime = 'nodejs';

/**
 * GET /api/render/download?id=… — streams a finished export back through the
 * app so the browser actually downloads it (a cross-origin S3 link ignores
 * the `download` attribute and just opens in a tab).
 */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing export id.' }, { status: 400 });

  const db = getStore();
  const rec = await db.getRender(id);
  if (!rec || rec.userId !== user.id) return Response.json({ error: 'Export not found.' }, { status: 404 });
  if (rec.status !== 'done' || !rec.url) return Response.json({ error: 'That export is not ready yet.' }, { status: 409 });

  const art = await db.getArtifact(rec.artifactId);
  const filename = renderFilename(art?.title ?? 'phantasma', rec.aspect, rec.kind);

  const upstream = await fetch(rec.url);
  if (!upstream.ok || !upstream.body) return Response.json({ error: 'The rendered file could not be fetched.' }, { status: 502 });

  return new Response(upstream.body, {
    headers: {
      'content-type': rec.kind === 'video' ? 'video/mp4' : 'image/png',
      'content-disposition': `attachment; filename="${filename}"`,
      ...(upstream.headers.get('content-length') ? { 'content-length': upstream.headers.get('content-length')! } : {}),
    },
  });
}
