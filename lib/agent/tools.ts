import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { meta } from '../meta';
import { imagePrompt } from '../meta/prompts';
import { allLayers, applyPatch, PatchOpSchema, type SceneDoc } from '../scenedoc';
import { persistAsset } from '../storage';
import type { BrandKit } from '../brand/types';
import type { Store } from '../db/store';
import type { AgentEvent, StepStatus } from './types';
import { resolveAssets } from './assets';

export type Emit = (ev: AgentEvent) => void;

function step(id: string, label: string, status: StepStatus, detail?: string): AgentEvent {
  return { type: 'step', id, label, status, detail };
}

function msg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

type Draft = { artifactId: string; doc: SceneDoc; stepId: string; variantNo: number };

/**
 * Tools for a generation run. The loop driver (Spark) creates one storyboard per angle,
 * then fills empty image layers and segments flagged ones. `finish()` validates everything,
 * runs the deterministic asset sweep, and saves v1 — the version event fires there.
 */
export function createGenerateTools(ctx: {
  db: Store;
  userId: string;
  brand: BrandKit;
  brandId: string | null;
  prompt: string;
  count: number;
  emit: Emit;
}): { tools: ToolSet; finish: () => Promise<void> } {
  const drafts = new Map<string, Draft>();
  let variantNo = 0;

  const tools = {
    create_storyboard: tool({
      description:
        'Create one storyboard variant (a SceneDoc). Call it exactly once per angle listed in the task, before any asset work on that variant.',
      inputSchema: z.object({
        angle: z.enum(['hook', 'product', 'proof']).describe('The narrative angle of this variant.'),
      }),
      execute: async ({ angle }) => {
        const variant = ++variantNo;
        const stepId = `v${variant - 1}-draft`;
        ctx.emit(step(stepId, `Drafting variant ${variant} (${angle})`, 'running'));
        const artifactId = `art_${randomUUID().slice(0, 8)}`;
        const doc = await meta.storyboard({ id: artifactId, prompt: ctx.prompt, angle, brand: ctx.brand });
        drafts.set(artifactId, { artifactId, doc, stepId: stepId.replace('-draft', '-assets'), variantNo: variant });
        ctx.emit(step(stepId, `Drafting variant ${variant} (${angle})`, 'done', `${doc.scenes.length} scenes`));
        return {
          artifactId,
          scenes: doc.scenes.length,
          layers: allLayers(doc).map((l) => ({
            id: l.id,
            kind: l.kind,
            name: l.name,
            needsImage: l.kind === 'image' && !l.src,
            segment: l.segment && l.kind === 'image',
          })),
        };
      },
    }),

    generate_image: tool({
      description:
        'Generate an image for one empty image layer of a variant you created with create_storyboard. One call per layer.',
      inputSchema: z.object({
        artifactId: z.string().describe('The artifactId returned by create_storyboard.'),
        layerId: z.string().describe('The id of the image layer that has no image yet.'),
        prompt: z.string().optional().describe('What the image should show. Defaults to the layer name.'),
      }),
      execute: async ({ artifactId, layerId, prompt }) => {
        const draft = drafts.get(artifactId);
        if (!draft) throw new Error(`Unknown artifactId ${artifactId} — create the storyboard first.`);
        const layer = allLayers(draft.doc).find((l) => l.id === layerId);
        if (!layer) throw new Error(`Layer ${layerId} not found in ${artifactId}.`);
        if (layer.kind !== 'image') throw new Error(`Layer ${layerId} is a ${layer.kind}, not an image.`);
        if (layer.src) return { ok: true as const, layerId, note: 'already has an image' };
        const stepId = `${draft.stepId}:${layerId}`;
        ctx.emit(step(stepId, `Generating visual for "${layer.name}"`, 'running'));
        try {
          const url = await meta.image(imagePrompt({ subject: prompt || layer.name || `${draft.doc.title} visual`, brand: ctx.brand }));
          layer.src = await persistAsset(url, `${artifactId}/${layer.id}.png`);
          ctx.emit(step(stepId, `Generating visual for "${layer.name}"`, 'done'));
          return { ok: true as const, layerId };
        } catch (e) {
          ctx.emit(step(stepId, `Generating visual for "${layer.name}"`, 'error', msg(e)));
          return { ok: false as const, layerId, error: msg(e) };
        }
      },
    }),

    segment_subject: tool({
      description:
        'Cut the subject out of one image layer (SAM). Use it for image layers the storyboard flagged for segmentation and that already have an image.',
      inputSchema: z.object({
        artifactId: z.string().describe('The artifactId returned by create_storyboard.'),
        layerId: z.string().describe('The id of the image layer to segment.'),
        concept: z.string().optional().describe('Short noun phrase for the subject, e.g. "red running shoe". Defaults to the layer name.'),
      }),
      execute: async ({ artifactId, layerId, concept }) => {
        const draft = drafts.get(artifactId);
        if (!draft) throw new Error(`Unknown artifactId ${artifactId} — create the storyboard first.`);
        const layer = allLayers(draft.doc).find((l) => l.id === layerId);
        if (!layer) throw new Error(`Layer ${layerId} not found in ${artifactId}.`);
        if (!layer.src) throw new Error(`Layer ${layerId} has no image yet — generate it first.`);
        if (layer.samCutout) return { ok: true as const, layerId, note: 'already segmented' };
        const stepId = `${draft.stepId}:sam-${layerId}`;
        ctx.emit(step(stepId, `Cutting out subject of "${layer.name}"`, 'running'));
        try {
          const cut = await meta.segment(layer.src, concept || layer.name || 'main subject');
          layer.samCutout = {
            subjectUrl: await persistAsset(cut.subjectUrl, `${artifactId}/${layer.id}-subject.png`),
            backgroundUrl: await persistAsset(cut.backgroundUrl, `${artifactId}/${layer.id}-background.png`),
          };
          ctx.emit(step(stepId, `Cutting out subject of "${layer.name}"`, 'done'));
          return { ok: true as const, layerId };
        } catch (e) {
          // No match is not a failure of the run: the layer keeps its plain image.
          ctx.emit(step(stepId, `Cutting out subject of "${layer.name}"`, 'done', 'nothing to cut out'));
          return { ok: false as const, layerId, error: msg(e) };
        }
      },
    }),
  };

  const finish = async () => {
    for (const { artifactId, doc } of drafts.values()) {
      ctx.emit(step(`v${drafts.get(artifactId)!.variantNo - 1}-assets`, 'Resolving remaining visuals', 'running'));
      const finalDoc = await resolveAssets(doc, artifactId, ctx.brand);
      ctx.emit(step(`v${drafts.get(artifactId)!.variantNo - 1}-assets`, 'Resolving remaining visuals', 'done'));
      const now = new Date().toISOString();
      await ctx.db.createArtifact(
        { id: artifactId, userId: ctx.userId, brandId: ctx.brandId, title: finalDoc.title, prompt: ctx.prompt, currentVersion: 1, createdAt: now },
        { artifactId, version: 1, doc: finalDoc, message: 'Initial draft', createdAt: now },
      );
      ctx.emit({ type: 'version', artifactId, version: 1 });
    }
  };

  return { tools, finish };
}

/**
 * Tools for a refinement run, scoped to the layers the user selected.
 * `apply_patch` enforces the scope eagerly; `finish()` sweeps assets and saves the new version.
 */
export function createRefineTools(ctx: {
  db: Store;
  artifactId: string;
  doc: SceneDoc;
  allowedLayerIds: string[];
  message: string;
  brand?: BrandKit | null;
  emit: Emit;
}): { tools: ToolSet; finish: () => Promise<SceneDoc> } {
  let working: SceneDoc = structuredClone(ctx.doc);
  const allowed = new Set(ctx.allowedLayerIds);
  const stepId = 'patch';

  const tools = {
    apply_patch: tool({
      description:
        'Apply small edits to the selected layers of the storyboard. Only the layers in scope can change. One call with all the ops you need.',
      inputSchema: z.object({
        ops: z.array(PatchOpSchema).min(1).describe('The patch ops to apply (op: set | upsert_layer | remove_layer).'),
      }),
      execute: async ({ ops }) => {
        ctx.emit(step(stepId, 'Applying the change to selected layers', 'running'));
        working = applyPatch(working, ops, allowed);
        return { applied: ops.length };
      },
    }),

    generate_image: tool({
      description: 'Generate an image for one image layer in scope that has no image yet (e.g. after an upsert).',
      inputSchema: z.object({
        layerId: z.string(),
        prompt: z.string().optional().describe('What the image should show. Defaults to the layer name.'),
      }),
      execute: async ({ layerId, prompt }) => {
        if (!allowed.has(layerId)) throw new Error(`Layer ${layerId} is not in scope for this change.`);
        const layer = allLayers(working).find((l) => l.id === layerId);
        if (!layer) throw new Error(`Layer ${layerId} not found.`);
        if (layer.kind !== 'image') throw new Error(`Layer ${layerId} is a ${layer.kind}, not an image.`);
        if (layer.src) return { ok: true as const, layerId, note: 'already has an image' };
        ctx.emit(step(stepId, `Generating visual for "${layer.name}"`, 'running'));
        const url = await meta.image(imagePrompt({ subject: prompt || layer.name || `${working.title} visual`, brand: ctx.brand }));
        layer.src = await persistAsset(url, `${ctx.artifactId}/${layer.id}-${Date.now()}.png`);
        ctx.emit(step(stepId, `Generating visual for "${layer.name}"`, 'done'));
        return { ok: true as const, layerId };
      },
    }),

    segment_subject: tool({
      description: 'Cut the subject out of one image layer in scope that already has an image.',
      inputSchema: z.object({
        layerId: z.string(),
        concept: z.string().optional().describe('Short noun phrase for the subject. Defaults to the layer name.'),
      }),
      execute: async ({ layerId, concept }) => {
        if (!allowed.has(layerId)) throw new Error(`Layer ${layerId} is not in scope for this change.`);
        const layer = allLayers(working).find((l) => l.id === layerId);
        if (!layer) throw new Error(`Layer ${layerId} not found.`);
        if (!layer.src) throw new Error(`Layer ${layerId} has no image yet — generate it first.`);
        if (layer.samCutout) return { ok: true as const, layerId, note: 'already segmented' };
        ctx.emit(step(stepId, `Cutting out subject of "${layer.name}"`, 'running'));
        const cut = await meta.segment(layer.src, concept || layer.name || 'main subject');
        layer.samCutout = {
          subjectUrl: await persistAsset(cut.subjectUrl, `${ctx.artifactId}/${layer.id}-subject-${Date.now()}.png`),
          backgroundUrl: await persistAsset(cut.backgroundUrl, `${ctx.artifactId}/${layer.id}-background-${Date.now()}.png`),
        };
        ctx.emit(step(stepId, `Cutting out subject of "${layer.name}"`, 'done'));
        return { ok: true as const, layerId };
      },
    }),
  };

  const finish = async (): Promise<SceneDoc> => {
    ctx.emit(step(stepId, 'Applying the change to selected layers', 'done'));
    const finalDoc = await resolveAssets(working, ctx.artifactId, ctx.brand);
    const version = (await ctx.db.getArtifact(ctx.artifactId))!.currentVersion + 1;
    await ctx.db.addVersion({
      artifactId: ctx.artifactId,
      version,
      doc: finalDoc,
      message: ctx.message,
      createdAt: new Date().toISOString(),
    });
    ctx.emit({ type: 'version', artifactId: ctx.artifactId, version });
    return finalDoc;
  };

  return { tools, finish };
}
