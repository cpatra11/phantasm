import { requireUser, unauthorized } from '../../../lib/auth/server';
import { getStore } from '../../../lib/db';
import { applyPatch, parseSceneDoc, type SceneDoc } from '../../../lib/scenedoc';
import { mergeSceneDocs } from '../../../lib/merge';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const runtime = 'nodejs';

const PatchBody = z.object({ id: z.string(), ops: z.array(z.unknown()) });
const RevertBody = z.object({ id: z.string(), revertTo: z.number().int().positive() });
const MergeBody = z.object({ merge: z.object({ sourceIds: z.array(z.string()).min(2).max(12) }) });
const DuplicateBody = z.object({ duplicate: z.object({ id: z.string() }) });

function notFound() {
  return Response.json({ error: 'Storyboard not found.' }, { status: 404 });
}

/** GET /api/artifacts: the signed-in user's storyboards with their current document.
 *  GET /api/artifacts?id=…: one storyboard with its version history and current document. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const db = getStore();
  const id = new URL(request.url).searchParams.get('id');

  if (!id) {
    const list = await db.listArtifacts(user.id);
    const items = await Promise.all(
      list.map(async (a) => ({
        id: a.id,
        title: a.title,
        currentVersion: a.currentVersion,
        createdAt: a.createdAt,
        doc: (await db.getVersion(a.id, a.currentVersion))?.doc ?? null,
      })),
    );
    return Response.json(items);
  }

  const art = await db.getArtifact(id);
  if (!art || art.userId !== user.id) return notFound();
  const cur = await db.getVersion(art.id, art.currentVersion);
  const versions = await db.listVersions(art.id);
  return Response.json({
    artifact: { id: art.id, title: art.title, currentVersion: art.currentVersion },
    versions: versions.map((v) => ({ version: v.version, message: v.message, createdAt: v.createdAt })),
    doc: cur?.doc,
  });
}

/** PATCH /api/artifacts: manual edits from the inspector. Each call saves one version. */
export async function PATCH(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const parsed = PatchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid edit.' }, { status: 400 });

  const db = getStore();
  const art = await db.getArtifact(parsed.data.id);
  if (!art || art.userId !== user.id) return notFound();
  const cur = await db.getVersion(art.id, art.currentVersion);
  if (!cur) return notFound();

  try {
    const doc: SceneDoc = applyPatch(cur.doc, parsed.data.ops as Parameters<typeof applyPatch>[1]);
    const version = art.currentVersion + 1;
    await db.addVersion({ artifactId: art.id, version, doc, message: 'Manual edit', createdAt: new Date().toISOString() });
    return Response.json({ version, doc });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'That edit is not allowed.' }, { status: 400 });
  }
}

/** POST /api/artifacts: revert to an earlier version, or merge/duplicate cards. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const raw = await request.json().catch(() => null);
  const db = getStore();

  const mergeParsed = MergeBody.safeParse(raw);
  if (mergeParsed.success) {
    const ids = mergeParsed.data.merge.sourceIds;
    const docs: SceneDoc[] = [];
    for (const id of ids) {
      const art = await db.getArtifact(id);
      if (!art || art.userId !== user.id) return notFound();
      const cur = await db.getVersion(art.id, art.currentVersion);
      if (!cur) return Response.json({ error: 'A card has no saved version.' }, { status: 404 });
      docs.push(parseSceneDoc(cur.doc));
    }
    try {
      const doc = mergeSceneDocs(docs, `Merged film (${docs.length})`);
      const now = new Date().toISOString();
      await db.createArtifact(
        { id: doc.id, userId: user.id, brandId: null, title: doc.title, prompt: 'merged cards', currentVersion: 1, createdAt: now },
        { artifactId: doc.id, version: 1, doc, message: `Merged ${docs.length} cards`, createdAt: now },
      );
      return Response.json({ artifactId: doc.id });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : 'Those cards could not be merged.' }, { status: 400 });
    }
  }

  const duplicateParsed = DuplicateBody.safeParse(raw);
  if (duplicateParsed.success) {
    const art = await db.getArtifact(duplicateParsed.data.duplicate.id);
    if (!art || art.userId !== user.id) return notFound();
    const cur = await db.getVersion(art.id, art.currentVersion);
    if (!cur) return notFound();
    const now = new Date().toISOString();
    const doc: SceneDoc = { ...parseSceneDoc(cur.doc), id: `art_${randomUUID().slice(0, 8)}`, title: `${art.title} copy`.slice(0, 80) };
    await db.createArtifact(
      { id: doc.id, userId: user.id, brandId: art.brandId, title: doc.title, prompt: art.prompt, currentVersion: 1, createdAt: now },
      { artifactId: doc.id, version: 1, doc, message: `Duplicated ${art.id}`, createdAt: now },
    );
    return Response.json({ artifactId: doc.id });
  }

  const parsed = RevertBody.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'Invalid revert.' }, { status: 400 });
  const art = await db.getArtifact(parsed.data.id);
  if (!art || art.userId !== user.id) return notFound();
  const target = await db.getVersion(art.id, parsed.data.revertTo);
  if (!target) return Response.json({ error: 'That version does not exist.' }, { status: 404 });

  const version = art.currentVersion + 1;
  await db.addVersion({
    artifactId: art.id,
    version,
    doc: parseSceneDoc(target.doc),
    message: `Reverted to v${parsed.data.revertTo}`,
    createdAt: new Date().toISOString(),
  });
  // The reverted document rides back so the client can apply it instantly.
  return Response.json({ version, doc: parseSceneDoc(target.doc) });
}
