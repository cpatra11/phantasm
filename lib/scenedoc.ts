import { z } from 'zod';

export const FPS = 30;

export const ASPECTS = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
} as const;
export type Aspect = keyof typeof ASPECTS;
export const ASPECT_LIST = Object.keys(ASPECTS) as Aspect[];

const MASTER = ASPECTS['9:16'];

const StyleValue = z.union([z.string(), z.number(), z.boolean()]);

export const LayerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['text', 'image', 'shape', 'logo', 'callout']),
  name: z.string().default(''),
  transform: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive(),
    rotation: z.number().default(0),
  }),
  style: z.record(z.string(), StyleValue).default({}),
  text: z.string().optional(),
  src: z.string().optional(),
  samCutout: z.object({ subjectUrl: z.string(), backgroundUrl: z.string() }).optional(),
  /** Set by the agent: this image should get a SAM 3.1 subject/background cut. */
  segment: z.boolean().default(false),
  motion: z
    .object({
      preset: z.enum(['none', 'fade-in', 'slide-up', 'slide-left', 'pop', 'reveal', 'float', 'ken-burns', 'type', 'count-up']),
      delayMs: z.number().min(0).default(0),
      durationMs: z.number().min(100).default(600),
    })
    .default({ preset: 'none', delayMs: 0, durationMs: 600 }),
  locked: z.boolean().default(false),
});

export const SceneSchema = z.object({
  id: z.string().min(1),
  durationMs: z.number().int().min(500).max(15000),
  background: z.string().default('#000000'),
  layers: z.array(LayerSchema),
});

export const SceneDocSchema = z.object({
  id: z.string().min(1),
  title: z.string().default('Untitled'),
  scenes: z.array(SceneSchema).min(1).max(24),
});

export type Layer = z.infer<typeof LayerSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type SceneDoc = z.infer<typeof SceneDocSchema>;

/** Builds a fully-populated layer with defaults applied. */
export function makeLayer(p: {
  id: string;
  kind: Layer['kind'];
  transform: { x: number; y: number; w: number; h: number; rotation?: number };
  name?: string;
  style?: Layer['style'];
  text?: string;
  src?: string;
  segment?: boolean;
  motion?: Layer['motion'];
  locked?: boolean;
}): Layer {
  return {
    id: p.id,
    kind: p.kind,
    name: p.name ?? '',
    transform: { ...p.transform, rotation: p.transform.rotation ?? 0 },
    style: p.style ?? {},
    text: p.text,
    src: p.src,
    segment: p.segment ?? false,
    motion: p.motion ?? { preset: 'none', delayMs: 0, durationMs: 600 },
    locked: p.locked ?? false,
  };
}

export function parseSceneDoc(input: unknown): SceneDoc {
  return SceneDocSchema.parse(input);
}

export function durationFrames(doc: SceneDoc): number {
  const ms = doc.scenes.reduce((sum, s) => sum + s.durationMs, 0);
  return Math.max(1, Math.round((ms / 1000) * FPS));
}

/**
 * A representative frame of the first scene: every layer has finished entering.
 * Frame 0 would show the fade-ins before they start — a blank background.
 */
export function firstSceneReadyFrame(doc: SceneDoc): number {
  const first = doc.scenes[0];
  if (!first) return 0;
  const enterMs = Math.max(0, ...first.layers.map((l) => (l.motion?.delayMs ?? 0) + (l.motion?.durationMs ?? 0)));
  const sceneFrames = Math.round((first.durationMs / 1000) * FPS);
  return Math.min(sceneFrames - 1, Math.max(30, Math.ceil((enterMs / 1000) * FPS)));
}

export function allLayers(doc: SceneDoc): Layer[] {
  return doc.scenes.flatMap((s) => s.layers);
}

export type DocKind = 'Design' | 'Animation' | 'Image' | 'Storyboard';

/**
 * Hera-style card header for a document: what kind of card it is, its aspect,
 * scene count, and running time — e.g. "Storyboard · 9:16 · 4 scenes · 13.5s".
 * Kind is inferred from the title the producing mode set, falling back to the
 * document's shape (a single full-bleed picture is a poster).
 */
export function cardMeta(doc: SceneDoc, title: string): { kind: DocKind; label: string } {
  const scenes = doc.scenes.length;
  const seconds = doc.scenes.reduce((sum, s) => sum + s.durationMs, 0) / 1000;
  let kind: DocKind = 'Storyboard';
  if (/ design$/i.test(title)) kind = 'Design';
  else if (/ animation$/i.test(title)) kind = 'Animation';
  else if (scenes === 1 && doc.scenes[0].layers.some((l) => l.kind === 'image' && l.transform.w >= 1000 && l.transform.h >= 1800)) kind = 'Image';
  const secs = Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
  return { kind, label: `${kind} · 9:16 · ${scenes} scene${scenes === 1 ? '' : 's'} · ${secs}` };
}

type BrandShape = {
  name: string;
  logoUrl?: string;
  logoMarkUrl?: string;
  colors: { background: string; text: string };
  fonts: { heading: string };
};

/**
 * Deterministic storyboard guarantees, applied to every generated storyboard
 * (live or mock) so the Hera structure holds even when the model drifts:
 * flat brand background on every scene, real logo art on logo layers, and a
 * logo end card as the final scene.
 */
export function normalizeStoryboard(doc: SceneDoc, brand: BrandShape): SceneDoc {
  const next: SceneDoc = structuredClone(doc);
  const bg = /^#[0-9a-f]{6}$/i.test(brand.colors.background) ? brand.colors.background : next.scenes[0]?.background;
  const logoSrc = brand.logoUrl ?? brand.logoMarkUrl;

  for (const scene of next.scenes) {
    if (bg) scene.background = bg;
    for (const layer of scene.layers) {
      if (layer.kind === 'logo') {
        if (logoSrc && !layer.src) layer.src = logoSrc;
        if (!layer.text) layer.text = brand.name;
      }
    }
  }

  const last = next.scenes[next.scenes.length - 1];
  if (last && !last.layers.some((l) => l.kind === 'logo')) {
    last.layers.push(
      makeLayer({
        id: `${last.id}-endlogo`,
        kind: 'logo',
        name: 'Logo',
        transform: { x: 340, y: 860, w: 400, h: 150 },
        ...(logoSrc ? { src: logoSrc } : {}),
        text: brand.name,
        style: { fontFamily: brand.fonts.heading, fontSize: 96, fontWeight: 700, color: brand.colors.text },
        motion: { preset: 'fade-in', delayMs: 150, durationMs: 600 },
      }),
    );
  }
  return SceneDocSchema.parse(next);
}

function findLayerIn(doc: SceneDoc, layerId: string): { scene: Scene; layer: Layer } | null {
  for (const scene of doc.scenes) {
    const layer = scene.layers.find((l) => l.id === layerId);
    if (layer) return { scene, layer };
  }
  return null;
}

const NUMERIC_STYLE_KEYS = new Set(['fontSize', 'borderRadius', 'padding', 'strokeWidth', 'letterSpacing']);

/**
 * Derives a layout for another aspect ratio from the authored 9:16 master.
 * Rule: fit to height, center horizontally, scale sizes and sized styles by the same factor.
 * Backgrounds stay full-frame.
 */
export function deriveLayout(doc: SceneDoc, aspect: Aspect): SceneDoc {
  if (aspect === '9:16') return doc;
  const target = ASPECTS[aspect];
  const s = target.height / MASTER.height;
  const offsetX = (target.width - MASTER.width * s) / 2;

  return {
    ...doc,
    scenes: doc.scenes.map((scene) => ({
      ...scene,
      layers: scene.layers.map((layer) => {
        const style: Layer['style'] = { ...layer.style };
        for (const key of Object.keys(style)) {
          const v = style[key];
          if (NUMERIC_STYLE_KEYS.has(key) && typeof v === 'number') style[key] = v * s;
        }
        return {
          ...layer,
          style,
          transform: {
            x: offsetX + layer.transform.x * s,
            y: layer.transform.y * s,
            w: layer.transform.w * s,
            h: layer.transform.h * s,
            rotation: layer.transform.rotation,
          },
        };
      }),
    })),
  };
}

// ---- Patch operations: the only way the agent or the UI changes a document ----

const SETTABLE_PATHS: RegExp[] = [
  /^text$/,
  /^src$/,
  /^name$/,
  /^segment$/,
  /^locked$/,
  /^transform\.(x|y|w|h|rotation)$/,
  /^style\.[A-Za-z][A-Za-z0-9]*$/,
  /^motion\.(preset|delayMs|durationMs)$/,
];

export const PatchOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('set'), layerId: z.string(), path: z.string(), value: StyleValue }),
  z.object({ op: z.literal('upsert_layer'), sceneId: z.string(), layer: LayerSchema }),
  z.object({ op: z.literal('remove_layer'), layerId: z.string() }),
]);
export type PatchOp = z.infer<typeof PatchOpSchema>;

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let cur: Record<string, unknown> = target;
  for (const k of keys.slice(0, -1)) {
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}

function assertAllowed(layerId: string, allowed?: ReadonlySet<string>) {
  if (allowed && !allowed.has(layerId)) {
    throw new Error(`Layer ${layerId} is outside the requested scope`);
  }
}

/**
 * Applies patch ops to a copy of the document and validates the result.
 * If `allowed` is given, only those existing layers may change and no layers may be added.
 */
export function applyPatch(doc: SceneDoc, ops: PatchOp[], allowed?: ReadonlySet<string>): SceneDoc {
  const next: SceneDoc = structuredClone(doc);

  for (const raw of ops) {
    const op = PatchOpSchema.parse(raw);

    if (op.op === 'set') {
      if (!SETTABLE_PATHS.some((re) => re.test(op.path))) {
        throw new Error(`Path is not editable: ${op.path}`);
      }
      const hit = findLayerIn(next, op.layerId);
      if (!hit) throw new Error(`Unknown layer ${op.layerId}`);
      assertAllowed(op.layerId, allowed);
      setPath(hit.layer as unknown as Record<string, unknown>, op.path, op.value);
    } else if (op.op === 'upsert_layer') {
      const scene = next.scenes.find((s) => s.id === op.sceneId);
      if (!scene) throw new Error(`Unknown scene ${op.sceneId}`);
      const idx = scene.layers.findIndex((l) => l.id === op.layer.id);
      if (idx >= 0) {
        assertAllowed(op.layer.id, allowed);
        scene.layers[idx] = op.layer;
      } else {
        if (allowed) throw new Error('New layers cannot be added in a scoped change');
        scene.layers.push(op.layer);
      }
    } else {
      const hit = findLayerIn(next, op.layerId);
      if (!hit) throw new Error(`Unknown layer ${op.layerId}`);
      assertAllowed(op.layerId, allowed);
      hit.scene.layers = hit.scene.layers.filter((l) => l.id !== op.layerId);
    }
  }

  return SceneDocSchema.parse(next);
}
