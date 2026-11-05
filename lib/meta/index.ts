import { z } from 'zod';
import { IMAGE_MODEL, SPARK_MODEL, WONDER_MODEL, metaJSON, metaLive, metaPost } from './config';
import { PATCH_SPEC, brandBlock, storyboardSystem, storyboardUser, wonderSystem } from './prompts';
import { mockImage, mockPatch, mockPlan, mockSegment, mockStoryboard, type PlanInput } from './mocks';
import { segmentImage, type Cutout } from './segment';
import { PatchOpSchema, SceneDocSchema, normalizeStoryboard, type Layer, type PatchOp, type SceneDoc } from '../scenedoc';
import type { BrandKit } from '../brand/types';

const WonderPlanSchema = z.object({
  steps: z.array(z.string()).default([]),
  targetLayerIds: z.array(z.string()).optional(),
});
const PatchesSchema = z.object({ ops: z.array(PatchOpSchema) });

export type WonderPlan = z.infer<typeof WonderPlanSchema>;

const ImageResponseSchema = z.object({
  data: z
    .array(z.object({ url: z.string().url().optional(), b64_json: z.string().optional() }).passthrough())
    .min(1),
});

/** Single facade for all Meta model calls. Live when keys are set, mock otherwise. */
export const meta = {
  live: metaLive,

  async planWonder(input: PlanInput): Promise<WonderPlan> {
    if (!metaLive) return mockPlan(input);
    const user =
      input.mode === 'generate'
        ? `A marketer wants this video: "${input.prompt}"\nReturn {"steps": ["...", ...]}. 3-6 short steps (max 8 words each) describing how you will build the storyboards.`
        : `A marketer selected layers of their storyboard to change.\nSelection: ${input.selectedLayerIds?.join(', ') ?? '(none)'}\nChange request: "${input.message}"\nSelected layers (current state):\n${selectedSummary(input)}\nReturn {"steps": ["...", ...], "targetLayerIds": [...]}. targetLayerIds lists the layers this request actually touches — a subset of the selection, empty if the request is not actionable on the selection.`;
    return WonderPlanSchema.parse(await metaJSON(WONDER_MODEL, wonderSystem(), user, WonderPlanSchema, 6000));
  },

  async storyboard(input: { id: string; prompt: string; angle: string; brand: BrandKit }): Promise<SceneDoc> {
    if (!metaLive) return normalizeStoryboard(mockStoryboard(input), input.brand);
    const doc = await metaJSON(
      SPARK_MODEL,
      storyboardSystem(input.angle, input.brand),
      storyboardUser(input.prompt),
      SceneDocSchema,
      16000,
    );
    return normalizeStoryboard(SceneDocSchema.parse({ ...doc, id: input.id }), input.brand);
  },

  async patch(input: { doc: SceneDoc; message: string; allowedLayerIds: string[] }): Promise<PatchOp[]> {
    if (!metaLive) return mockPatch(input);
    const byId = new Map(allLayers(input.doc).map((l) => [l.id, l]));
    const detail = input.allowedLayerIds
      .map((id) => (byId.has(id) ? summarizeLayer(byId.get(id)!) : ''))
      .filter((s) => s !== '')
      .join('\n');
    const user = `Change request: "${input.message}"
Allowed layers (current state):
${detail}
Return the patch ops.`;
    return (await metaJSON(SPARK_MODEL, `You apply small edits to motion graphics scenes.\n${PATCH_SPEC}`, user, PatchesSchema, 12000)).ops;
  },

  async image(prompt: string): Promise<string> {
    if (!metaLive) return mockImage(prompt);
    const res = ImageResponseSchema.parse(await metaPost('/images/generations', { model: IMAGE_MODEL, prompt, n: 1 }));
    const first = res.data[0];
    if (first.url) return first.url;
    if (first.b64_json) return `data:image/webp;base64,${first.b64_json}`;
    throw new Error('The image model returned no image.');
  },

  async segment(imageUrl: string, concept: string): Promise<Cutout> {
    if (!metaLive) return mockSegment(imageUrl, concept);
    return segmentImage(imageUrl, concept, async (png) => `data:image/png;base64,${png.toString('base64')}`);
  },
};

function allLayers(doc: SceneDoc): Layer[] {
  return doc.scenes.flatMap((s) => s.layers);
}

function selectedSummary(input: PlanInput): string {
  const doc = input.doc;
  if (!doc) return '(no document)';
  const ids = new Set(input.selectedLayerIds ?? []);
  return allLayers(doc)
    .filter((l) => ids.has(l.id))
    .map(summarizeLayer)
    .join('\n');
}

/** Minimal JSON of one layer for the models: only what a patch op can change. */
export function summarizeLayer(layer: Layer): string {
  return JSON.stringify({
    id: layer.id,
    kind: layer.kind,
    text: layer.text,
    style: layer.style,
    transform: layer.transform,
    motion: layer.motion,
  });
}
