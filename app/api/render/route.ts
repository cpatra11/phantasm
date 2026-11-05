import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireUser, unauthorized } from '../../../lib/auth/server';
import { getStore } from '../../../lib/db';
import type { RenderRecord } from '../../../lib/db/store';
import { startStillRender, startVideoRender, videoStatus } from '../../../lib/render/lambda';
import { ASPECT_LIST } from '../../../lib/scenedoc';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  artifactId: z.string(),
  aspect: z.enum(['9:16', '16:9']),
  kind: z.enum(['video', 'still']),
});

function configError(e: unknown) {
  const message = e instanceof Error ? e.message : 'Export failed.';
  return Response.json({ error: message }, { status: 503 });
}

/** POST /api/render: starts an export of the current version. Stills finish at once; videos
 *  start a Remotion Lambda job that the client polls with GET. Exports are free. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !ASPECT_LIST.includes(parsed.data.aspect)) {
    return Response.json({ error: 'Choose an aspect ratio and an export type.' }, { status: 400 });
  }
  const { artifactId, aspect, kind } = parsed.data;

  const db = getStore();
  const art = await db.getArtifact(artifactId);
  if (!art || art.userId !== user.id) return Response.json({ error: 'Storyboard not found.' }, { status: 404 });
  const cur = await db.getVersion(art.id, art.currentVersion);
  if (!cur) return Response.json({ error: 'Storyboard has no version.' }, { status: 404 });

  const base: RenderRecord = {
    id: `rnd_${randomUUID().slice(0, 8)}`,
    userId: user.id,
    artifactId: art.id,
    version: art.currentVersion,
    aspect,
    kind,
    status: 'rendering',
    remoteId: null,
    bucketName: null,
    functionName: null,
    region: null,
    url: null,
    error: null,
    createdAt: new Date().toISOString(),
  };

  try {
    if (kind === 'still') {
      const { url } = await startStillRender(cur.doc, aspect);
      const record = { ...base, status: 'done' as const, url };
      await db.saveRender(record);
      return Response.json(record);
    }
    const job = await startVideoRender(cur.doc, aspect);
    const record = { ...base, ...job };
    await db.saveRender(record);
    return Response.json(record);
  } catch (e) {
    return configError(e);
  }
}

/** GET /api/render?id=…: current status of an export. Video jobs are checked against Lambda. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing export id.' }, { status: 400 });

  const db = getStore();
  let rec = await db.getRender(id);
  if (!rec || rec.userId !== user.id) return Response.json({ error: 'Export not found.' }, { status: 404 });

  if (rec.kind === 'video' && rec.status === 'rendering' && rec.remoteId && rec.bucketName && rec.functionName && rec.region) {
    try {
      const s = await videoStatus({
        remoteId: rec.remoteId,
        bucketName: rec.bucketName,
        functionName: rec.functionName,
        region: rec.region,
      });
      await db.updateRender(rec.id, { status: s.status, url: s.url ?? null, error: s.error ?? null });
      rec = (await db.getRender(rec.id)) ?? rec;
    } catch (e) {
      return configError(e);
    }
  }
  return Response.json(rec);
}
