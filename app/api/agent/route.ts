import { createUIMessageStream, createUIMessageStreamResponse, isTextUIPart, type UIMessage } from 'ai';
import { z } from 'zod';
import { requireUser, unauthorized } from '../../../lib/auth/server';
import { animateArtifact, designArtifact, generateSingleShot, generateStoryboards, refineArtifact } from '../../../lib/agent/workflow';
import type { AgentStepData, AgentUIMessage, AgentVersionData } from '../../../lib/agent/types';
import { fallbackBrand } from '../../../lib/brand/firecrawl';
import type { BrandKit } from '../../../lib/brand/types';
import { CREDITS_PER_USER } from '../../../lib/credits';
import { getStore } from '../../../lib/db';

export const runtime = 'nodejs';
// Generation runs storyboard variants with image and SAM calls. Give it room on Vercel.
export const maxDuration = 300;

const BrandSchema = z
  .object({
    id: z.string().optional(),
    sourceUrl: z.string(),
    name: z.string(),
    logoUrl: z.string().optional(),
    colors: z.object({ primary: z.string(), secondary: z.string(), background: z.string(), text: z.string() }),
    fonts: z.object({ heading: z.string(), body: z.string() }),
    source: z.enum(['firecrawl', 'fallback']),
  })
  .passthrough();

/**
 * The body useChat's DefaultChatTransport sends: the UI message list plus the
 * custom fields the sidebar passes per request (`{ body: { mode, ... } }`).
 */
const Body = z.object({
  messages: z.array(z.custom<UIMessage>((v) => typeof v === 'object' && v !== null)).min(1),
  mode: z.enum(['generate', 'image', 'refine', 'design', 'animate']),
  artifactId: z.string().optional(),
  sourceArtifactId: z.string().optional(),
  sourceArtifactIds: z.array(z.string()).max(8).optional(),
  selectedLayerIds: z.array(z.string()).max(200).optional(),
  count: z.number().int().min(1).max(6).optional(),
  durationMs: z.number().int().min(3000).max(120000).optional(),
  scenes: z.number().int().min(1).max(7).optional(),
  variety: z.enum(['close', 'balanced', 'wide']).optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  aspect: z.enum(['auto', '16:9', '9:16', '1:1', '4:5']).optional(),
  brand: BrandSchema.nullish(),
});

/** The brief is the text of the latest user message. */
function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    const text = m.parts
      .filter(isTextUIPart)
      .map((p) => p.text)
      .join(' ')
      .trim();
    if (text) return text;
  }
  return '';
}

/**
 * POST /api/agent — the agent chat endpoint for the AI SDK UI protocol.
 * One credit per run; refunded if the run fails. Streams steps and saved
 * versions as typed data parts (`data-step`, `data-version`).
 */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Check the prompt or the selection and try again.' }, { status: 400 });
  }
  const body = parsed.data;
  const brief = lastUserText(body.messages);
  if (brief.length < 3) {
    return Response.json({ error: 'Write what the video should show first.' }, { status: 400 });
  }

  const db = getStore();

  if (body.mode === 'refine') {
    if (!body.artifactId) {
      return Response.json({ error: 'Missing storyboard for the change.' }, { status: 400 });
    }
    const art = await db.getArtifact(body.artifactId);
    if (!art || art.userId !== user.id) {
      return Response.json({ error: 'Storyboard not found.' }, { status: 404 });
    }
  }

  if ((body.mode === 'design' || body.mode === 'animate') && !body.sourceArtifactId && !body.sourceArtifactIds?.length) {
    return Response.json({ error: 'Select a card to use first.' }, { status: 400 });
  }

  const spent = await db.spendCredit(user.id, CREDITS_PER_USER);
  if (!spent) {
    return Response.json({ error: 'You have no credits left. Ask the team for more.' }, { status: 402 });
  }

  const brand = (body.brand as BrandKit | null | undefined) ?? fallbackBrand();
  const events =
    body.mode === 'generate'
      ? generateStoryboards({
          db,
          userId: user.id,
          brand,
          brandId: body.brand?.id ?? null,
          prompt: brief,
          count: body.count ?? 3,
          scenes: body.scenes,
          variety: body.variety,
          effort: body.effort,
          aspect: body.aspect,
        })
      : body.mode === 'image'
        ? generateSingleShot({
            db,
            userId: user.id,
            brand,
            brandId: body.brand?.id ?? null,
            prompt: brief,
            count: body.count ?? 1,
            variety: body.variety,
            aspect: body.aspect,
          })
        : body.mode === 'design'
          ? designArtifact({
              db,
              userId: user.id,
              brand,
              brandId: body.brand?.id ?? null,
              sourceArtifactId: body.sourceArtifactId,
              sourceArtifactIds: body.sourceArtifactIds,
              prompt: brief,
            })
          : body.mode === 'animate'
            ? animateArtifact({
                db,
                userId: user.id,
                brand,
                brandId: body.brand?.id ?? null,
                sourceArtifactId: body.sourceArtifactId,
                sourceArtifactIds: body.sourceArtifactIds,
                prompt: brief,
                durationMs: body.durationMs,
              })
            : refineArtifact({
                db,
                artifactId: body.artifactId!,
                message: brief,
                selectedLayerIds: body.selectedLayerIds ?? [],
                brand: body.brand ?? null,
              });

  let failed = false;

  const stream = createUIMessageStream<AgentUIMessage>({
    execute: async ({ writer }) => {
      try {
        for await (const ev of events) {
          if (ev.type === 'step') {
            const data: AgentStepData = { id: ev.id, label: ev.label, status: ev.status, detail: ev.detail };
            // Same part id replaces the previous state, so a step flips from running to done in place.
            writer.write({ type: 'data-step', id: ev.id, data });
          } else if (ev.type === 'version') {
            const data: AgentVersionData = { artifactId: ev.artifactId, version: ev.version };
            writer.write({ type: 'data-version', id: `${ev.artifactId}:${ev.version}`, data });
          } else if (ev.type === 'error') {
            failed = true;
            writer.write({ type: 'error', errorText: ev.message });
            break;
          }
        }
      } catch (e) {
        failed = true;
        writer.write({ type: 'error', errorText: e instanceof Error ? e.message : 'The run stopped unexpectedly.' });
      }
    },
    onFinish: async () => {
      if (failed) await db.refundCredit(user.id);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
