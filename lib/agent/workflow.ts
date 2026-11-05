import { generateText, stepCountIs } from 'ai';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { meta, summarizeLayer } from '../meta';
import { agentLoopSystem, brandBlock, imagePrompt, posterPrompt } from '../meta/prompts';
import { buildLayeredPoster, posterHeadline } from '../design/poster';
import { allLayers, applyPatch, makeLayer, type Layer, type SceneDoc } from '../scenedoc';
import type { BrandKit } from '../brand/types';
import type { Store } from '../db/store';
import type { AgentEvent, StepStatus } from './types';
import { resolveAssets } from './assets';
import { createGenerateTools, createRefineTools, type Emit } from './tools';
import { sparkModel } from './provider';
import { decomposeDocument, sceneImage } from '../design/decompose';
import { briefWithParams, clampDurationMs, EFFORT_STEP_BUDGET, type AspectParam, type Effort, type Variety } from './params';
import { metaJSON, SPARK_MODEL } from '../meta/config';

export { resolveAssets } from './assets';

const ANGLES = ['hook', 'product', 'proof'] as const;

function step(id: string, label: string, status: StepStatus, detail?: string): AgentEvent {
  return { type: 'step', id, label, status, detail };
}

function msg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Runs `run(emit)` and streams everything it emits as an async generator, so tool events
 * reach the client live while the loop is still running. A thrown error becomes an error event.
 */
function bridge(run: (emit: Emit) => Promise<void>): AsyncGenerator<AgentEvent> {
  type Item = { ev: AgentEvent } | { end: true };
  const buffer: Item[] = [];
  const waiters: Array<(i: Item) => void> = [];
  const deliver = (i: Item) => {
    const w = waiters.shift();
    if (w) w(i);
    else buffer.push(i);
  };
  const emit: Emit = (ev) => deliver({ ev });
  run(emit).then(
    () => deliver({ end: true }),
    (e) => {
      deliver({ ev: { type: 'error', message: msg(e) } });
      deliver({ end: true });
    },
  );
  return (async function* () {
    while (true) {
      const item = buffer.length ? buffer.shift()! : await new Promise<Item>((r) => waiters.push(r));
      if ('end' in item) return;
      yield item.ev;
    }
  })();
}

export async function* generateStoryboards(args: {
  db: Store;
  userId: string;
  brand: BrandKit;
  brandId: string | null;
  prompt: string;
  count?: number;
  /** Composer parameters (Hera-style): scenes per storyboard, variety, effort, format. */
  scenes?: number;
  variety?: Variety;
  effort?: Effort;
  aspect?: AspectParam;
}): AsyncGenerator<AgentEvent> {
  const count = args.count ?? 3;
  try {
    yield step('plan', 'Planning storyboards', 'running');
    const plan = await meta.planWonder({ mode: 'generate', prompt: args.prompt });
    yield step('plan', 'Planning storyboards', 'done', plan.steps.join(' → '));

    if (!meta.live) {
      // No keys: deterministic mock run through the same facade.
      for (let i = 0; i < count; i++) {
        const angle = ANGLES[i % ANGLES.length];
        const artifactId = `art_${randomUUID().slice(0, 8)}`;
        const now = new Date().toISOString();
        yield step(`v${i}-draft`, `Drafting variant ${i + 1} (${angle})`, 'running');
        const draft = await meta.storyboard({ id: artifactId, prompt: args.prompt, angle, brand: args.brand });
        yield step(`v${i}-draft`, `Drafting variant ${i + 1} (${angle})`, 'done');
        yield step(`v${i}-assets`, `Generating visuals for variant ${i + 1}`, 'running');
        const doc = await resolveAssets(draft, artifactId, args.brand);
        yield step(`v${i}-assets`, `Generating visuals for variant ${i + 1}`, 'done');
        await args.db.createArtifact(
          { id: artifactId, userId: args.userId, brandId: args.brandId, title: doc.title, prompt: args.prompt, currentVersion: 1, createdAt: now },
          { artifactId, version: 1, doc, message: 'Initial draft', createdAt: now },
        );
        yield { type: 'version', artifactId, version: 1 };
      }
      yield { type: 'done' };
      return;
    }

    // Live: Spark drives a tool loop (create_storyboard → generate_image → segment_subject).
    yield* bridge(async (emit) => {
      const { tools, finish } = createGenerateTools({ ...args, count, emit });
      const angles = Array.from({ length: count }, (_, i) => ANGLES[i % ANGLES.length]).join('", "');
      const brief = briefWithParams(args.prompt, { aspect: args.aspect, variety: args.variety });
      const sceneNote = args.scenes ? ` Each storyboard has exactly ${args.scenes} scene${args.scenes === 1 ? '' : 's'}.` : '';
      await generateText({
        model: sparkModel(),
        system: agentLoopSystem('generate'),
        prompt: `Video brief: ${brief}\n${brandBlock(args.brand)}\nProduce ${count} storyboard variants with these angles, in order: "${angles}".${sceneNote}`,
        tools,
        stopWhen: stepCountIs(EFFORT_STEP_BUDGET[args.effort ?? 'medium']),
        maxOutputTokens: 8000,
      });
      await finish();
    });
    yield { type: 'done' };
  } catch (e) {
    yield { type: 'error', message: msg(e) };
  }
}

/**
 * Image mode: a flat, art-directed 9:16 poster with the headline baked in —
 * the kind of ad Hera's Image mode produces, and the input Design mode expects.
 * The real brand logo rides on top as its own layer.
 */
export async function* generateSingleShot(args: {
  db: Store;
  userId: string;
  brand: BrandKit;
  brandId: string | null;
  prompt: string;
  count?: number;
  variety?: Variety;
  aspect?: AspectParam;
}): AsyncGenerator<AgentEvent> {
  const count = args.count ?? 1;
  try {
    const docs: Array<{ artifactId: string; doc: SceneDoc; title: string }> = [];
    for (let i = 0; i < count; i++) {
      const artifactId = `art_${randomUUID().slice(0, 8)}`;
      const title = args.prompt.split(/[.!\n]/)[0].trim().split(' ').slice(0, 5).join(' ') || 'Product ad';
      yield step(`shot${i}`, count > 1 ? `Generating ad ${i + 1} of ${count}` : 'Generating the ad', 'running');
      const { persistAsset } = await import('../storage');
      const products = (args.brand.images ?? []).filter((im) => im.kind === 'product');
      if (products.length > 0) {
        // Hera-style composed poster: a generated empty set, then the brand's
        // REAL product photos arranged on it with headline and logo layers.
        const setUrl = await meta.image(
          imagePrompt({
            subject: `an empty advertising set for ${products[0].label}: coloured backdrop and surface, ingredients and props arranged at the edges, the centre kept clear`,
            brand: args.brand,
            shot: 'poster',
          }),
        );
        const sceneUrl = await persistAsset(setUrl, `${artifactId}/scene.png`);
        const doc = buildLayeredPoster({
          id: artifactId,
          brand: args.brand,
          headline: posterHeadline(args.prompt),
          label: products[0].label.split(/[–—-]/)[0].trim().slice(0, 22),
          sceneUrl,
        });
        docs.push({ artifactId, doc, title });
        yield step(`shot${i}`, count > 1 ? `Generating ad ${i + 1} of ${count}` : 'Generating the ad', 'done');
        continue;
      }
      const url = await meta.image(posterPrompt({ brief: briefWithParams(args.prompt, { aspect: args.aspect, variety: args.variety }), brand: args.brand, variant: i }));
      const src = await persistAsset(url, `${artifactId}/poster.png`);
      const doc: SceneDoc = {
        id: artifactId,
        title,
        scenes: [
          {
            id: `${artifactId}-s1`,
            durationMs: 4000,
            background: args.brand.colors.background,
            layers: [
              makeLayer({
                id: 's1-poster',
                kind: 'image',
                name: 'Poster',
                transform: { x: 0, y: 0, w: 1080, h: 1920 },
                src,
              }),
              ...(args.brand.logoUrl
                ? [
                    makeLayer({
                      id: 's1-logo',
                      kind: 'logo' as const,
                      name: 'Logo',
                      transform: { x: 64, y: 1920 - 84 - 72, w: 240, h: 84 },
                      src: args.brand.logoUrl,
                    }),
                  ]
                : []),
            ],
          },
        ],
      };
      docs.push({ artifactId, doc, title });
      yield step(`shot${i}`, count > 1 ? `Generating ad ${i + 1} of ${count}` : 'Generating the ad', 'done');
    }

    for (const { artifactId, doc, title } of docs) {
      const now = new Date().toISOString();
      await args.db.createArtifact(
        { id: artifactId, userId: args.userId, brandId: args.brandId, title, prompt: args.prompt, currentVersion: 1, createdAt: now },
        { artifactId, version: 1, doc, message: 'Initial draft', createdAt: now },
      );
      yield { type: 'version', artifactId, version: 1 };
    }
    yield { type: 'done' };
  } catch (e) {
    yield { type: 'error', message: msg(e) };
  }
}

/**
 * Design mode: reads every scene's flat picture (Muse Wonder, Spark fallback),
 * cuts the product and logo out with SAM, and rebuilds each scene as editable
 * layers — every headline line and label its own text layer, the logo its own
 * layer, and a motion intent per layer. Scene durations are preserved.
 */
/** Source ids for design/animate: multi-source list wins, single id still works. */
function sourceIds(args: { sourceArtifactId?: string; sourceArtifactIds?: string[] }): string[] {
  const list = args.sourceArtifactIds?.length ? args.sourceArtifactIds : args.sourceArtifactId ? [args.sourceArtifactId] : [];
  return [...new Set(list)];
}

export async function* designArtifact(args: {
  db: Store;
  userId: string;
  brand: BrandKit;
  brandId: string | null;
  sourceArtifactId?: string;
  sourceArtifactIds?: string[];
  prompt: string;
}): AsyncGenerator<AgentEvent> {
  try {
    const ids = sourceIds(args);
    if (!ids.length) throw new Error('Pick a card to make editable first.');

    // Like Hera's "Make every scene editable" (Using S1–S4): each source card
    // becomes its own layered design card, all in one run.
    for (const sourceId of ids) {
      const src = await args.db.getArtifact(sourceId);
      if (!src || src.userId !== args.userId) throw new Error('Pick a card to make editable first.');
      const cur = await args.db.getVersion(src.id, src.currentVersion);
      if (!cur) throw new Error('That card has no saved version.');
      if (!cur.doc.scenes.some((s) => sceneImage(s))) {
        throw new Error(`"${src.title}" has no flat image to separate. Generate a poster first.`);
      }

      const stepId = `read-${src.id}`;
      yield step(stepId, `Reading the layout · ${src.title}`, 'running');
      const artifactId = `art_${randomUUID().slice(0, 8)}`;
      const title = `${src.title} design`.slice(0, 60);
      const result = await decomposeDocument({ doc: cur.doc, brand: args.brand, artifactId });
      const doc: SceneDoc = { ...result.doc, title };
      const sceneNote = `${result.layerCount} layers · ${doc.scenes.length} scene${doc.scenes.length === 1 ? '' : 's'}`;
      yield step(stepId, `Reading the layout · ${src.title}`, 'done', result.lowConfidence ? `${sceneNote} · ${result.lowConfidence} to check` : sceneNote);

      const now = new Date().toISOString();
      await args.db.createArtifact(
        { id: artifactId, userId: args.userId, brandId: args.brandId, title, prompt: args.prompt, currentVersion: 1, createdAt: now },
        {
          artifactId,
          version: 1,
          doc,
          message: doc.scenes.length > 1 ? `Separated in layers · ${doc.scenes.length} scenes` : 'Separated in layers',
          createdAt: now,
        },
      );
      yield { type: 'version', artifactId, version: 1 };
    }
    yield { type: 'done' };
  } catch (e) {
    yield { type: 'error', message: msg(e) };
  }
}

const MotionPlanSchema = z.object({
  layers: z.array(
    z.object({
      layerId: z.string(),
      preset: z.enum(['none', 'fade-in', 'slide-up', 'slide-left', 'pop', 'reveal', 'float', 'ken-burns', 'type', 'count-up']),
      delayMs: z.number().min(0).max(2000).default(0),
      durationMs: z.number().min(200).max(1500).default(600),
    }),
  ),
});

/** Deterministic motion when the model is unavailable. */
function fallbackMotion(layers: Layer[]): z.infer<typeof MotionPlanSchema> {
  let textDelay = 120;
  return {
    layers: layers.map((l) => {
      if (l.kind === 'text' || l.kind === 'callout') {
        const delay = textDelay;
        textDelay += 140;
        // A lone number is a data moment: count it up instead of revealing it.
        if (l.text && /^\s*\$?\d[\d.,]*\s*(%|x|k|m)?\s*$/i.test(l.text)) {
          return { layerId: l.id, preset: 'count-up' as const, delayMs: delay, durationMs: 900 };
        }
        return { layerId: l.id, preset: 'reveal' as const, delayMs: delay, durationMs: 520 };
      }
      if (l.kind === 'image') return { layerId: l.id, preset: 'ken-burns' as const, delayMs: 0, durationMs: 700 };
      if (l.kind === 'logo') return { layerId: l.id, preset: 'fade-in' as const, delayMs: 80, durationMs: 500 };
      return { layerId: l.id, preset: 'fade-in' as const, delayMs: 100, durationMs: 500 };
    }),
  };
}

/** Picks per-layer motion for one scene; deterministic fallback when the model is unavailable. */
async function planSceneMotion(layers: Layer[], sceneDurationMs: number, sceneLabel: string): Promise<Layer[]> {
  let plan: z.infer<typeof MotionPlanSchema>;
  try {
    plan = await metaJSON(
      SPARK_MODEL,
      `You are a senior motion designer. You animate ${sceneLabel}, ${(sceneDurationMs / 1000).toFixed(1)} seconds, no sound. Copy and product stay in place; only entrance motion and slow ambient motion are allowed.
Presets: reveal (masked line reveal), slide-up, slide-left, fade-in, pop, float (gentle vertical drift), ken-burns (slow push), type (typewriter, for a typed prompt line), count-up (for a lone big number), none.
Text lines enter 120-200ms apart. Images get float or ken-burns. Logo fades in. Badges pop. UI rows slide-left. Never give every layer the same preset.
Return JSON: { "layers": [{ "layerId": string, "preset": string, "delayMs": number, "durationMs": number }] }. One entry per layer.`,
      `Layers (bottom → top):\n${layers.map((l) => summarizeLayer(l)).join('\n')}`,
      MotionPlanSchema,
      6000,
    );
  } catch {
    plan = fallbackMotion(layers);
  }
  const byId = new Map(plan.layers.map((p) => [p.layerId, p]));
  return layers.map((l) => {
    const m = byId.get(l.id);
    return m
      ? { ...l, motion: { preset: m.preset, delayMs: m.delayMs, durationMs: m.durationMs } }
      : { ...l, motion: { preset: 'fade-in' as const, delayMs: 100, durationMs: 500 } };
  });
}

/**
 * Animation mode: a whole storyboard becomes one film. Every scene is kept and
 * animated — copy and product stay in place, each layer gets a motion (text
 * reveals, a floating product, a slow push). A single-scene source takes the
 * composer's duration; a multi-scene storyboard keeps the per-scene durations
 * the agent authored, so the film runs scene after scene.
 */
export async function* animateArtifact(args: {
  db: Store;
  userId: string;
  brand: BrandKit;
  brandId: string | null;
  sourceArtifactId?: string;
  sourceArtifactIds?: string[];
  prompt: string;
  durationMs?: number;
}): AsyncGenerator<AgentEvent> {
  try {
    const ids = sourceIds(args);
    if (!ids.length) throw new Error('Pick a card to animate first.');

    // "Animate every storyboard as one film": one film per source card.
    for (const sourceId of ids) {
      const src = await args.db.getArtifact(sourceId);
      if (!src || src.userId !== args.userId) throw new Error('Pick a card to animate first.');
      const cur = await args.db.getVersion(src.id, src.currentVersion);
      if (!cur) throw new Error('That card has no saved version.');
      if (!cur.doc.scenes.length) throw new Error('That card has no scene to animate.');

      const single = cur.doc.scenes.length === 1;
      const durationMs = clampDurationMs(args.durationMs ?? 6500);
      const artifactId = `art_${randomUUID().slice(0, 8)}`;
      const stepId = `motion-${src.id}`;

      yield step(stepId, `Choosing the motion · ${src.title}`, 'running');
      const scenes: SceneDoc['scenes'] = [];
      let layerCount = 0;
      for (let i = 0; i < cur.doc.scenes.length; i++) {
        const source = cur.doc.scenes[i];
        const sceneDurationMs = single ? durationMs : source.durationMs;
        const layers = source.layers.map((l) => structuredClone(l));
        const animated = await planSceneMotion(
          layers,
          sceneDurationMs,
          single ? 'one flat ad as one scene' : `scene ${i + 1} of ${cur.doc.scenes.length} in one continuous film`,
        );
        layerCount += animated.length;
        scenes.push({ ...source, id: `${artifactId}-s${i + 1}`, durationMs: sceneDurationMs, layers: animated });
      }
      yield step(stepId, `Choosing the motion · ${src.title}`, 'done', `${layerCount} layers · ${scenes.length} scene${scenes.length === 1 ? '' : 's'}`);

      const title = `${src.title} animation`.slice(0, 60);
      const doc: SceneDoc = { id: artifactId, title, scenes };

      const now = new Date().toISOString();
      await args.db.createArtifact(
        { id: artifactId, userId: args.userId, brandId: args.brandId, title, prompt: args.prompt, currentVersion: 1, createdAt: now },
        { artifactId, version: 1, doc, message: `Animated · ${scenes.length} scene${scenes.length === 1 ? '' : 's'}`, createdAt: now },
      );
      yield { type: 'version', artifactId, version: 1 };
    }
    yield { type: 'done' };
  } catch (e) {
    yield { type: 'error', message: msg(e) };
  }
}

/** Refines only the selected layers. Everything else in the document is untouched. */
export async function* refineArtifact(args: {
  db: Store;
  artifactId: string;
  message: string;
  selectedLayerIds: string[];
  brand?: BrandKit | null;
}): AsyncGenerator<AgentEvent> {
  try {
    const art = await args.db.getArtifact(args.artifactId);
    if (!art) throw new Error('Artifact not found');
    const cur = await args.db.getVersion(art.id, art.currentVersion);
    if (!cur) throw new Error('Current version missing');

    yield step('plan', 'Planning the change', 'running');
    const plan = await meta.planWonder({
      mode: 'refine',
      message: args.message,
      doc: cur.doc,
      selectedLayerIds: args.selectedLayerIds,
    });
    const targets = plan.targetLayerIds?.length ? plan.targetLayerIds : args.selectedLayerIds;
    if (targets.length === 0) throw new Error('Select the layers you want changed first.');
    yield step('plan', 'Planning the change', 'done', `${targets.length} layer(s) in scope`);

    if (!meta.live) {
      // No keys: deterministic mock patch through the same facade.
      yield step('patch', 'Applying the change to selected layers', 'running');
      const ops = await meta.patch({ doc: cur.doc, message: args.message, allowedLayerIds: targets });
      let doc = applyPatch(cur.doc, ops, new Set(targets));
      doc = await resolveAssets(doc, art.id, args.brand);
      yield step('patch', 'Applying the change to selected layers', 'done');
      const version = art.currentVersion + 1;
      await args.db.addVersion({ artifactId: art.id, version, doc, message: args.message, createdAt: new Date().toISOString() });
      yield { type: 'version', artifactId: art.id, version };
      yield { type: 'done' };
      return;
    }

    // Live: Spark drives a scoped tool loop (apply_patch → generate_image → segment_subject).
    yield* bridge(async (emit) => {
      const { tools, finish } = createRefineTools({
        db: args.db,
        artifactId: art.id,
        doc: cur.doc,
        allowedLayerIds: targets,
        message: args.message,
        brand: args.brand,
        emit,
      });
      const inScope = targets
        .map((id) => {
          const layer = cur.doc.scenes.flatMap((s) => s.layers).find((l) => l.id === id);
          return layer ? summarizeLayer(layer) : '';
        })
        .filter(Boolean)
        .join('\n');
      await generateText({
        model: sparkModel(),
        system: agentLoopSystem('refine'),
        prompt: `Change request: "${args.message}"\nLayers in scope (current state):\n${inScope}`,
        tools,
        stopWhen: stepCountIs(16),
        maxOutputTokens: 8000,
      });
      await finish();
    });
    yield { type: 'done' };
  } catch (e) {
    yield { type: 'error', message: msg(e) };
  }
}
