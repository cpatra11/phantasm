import { makeLayer, type PatchOp, type SceneDoc, allLayers } from '../scenedoc';
import type { BrandKit } from '../brand/types';

export type PlanInput = {
  mode: 'generate' | 'refine';
  prompt?: string;
  message?: string;
  doc?: SceneDoc;
  selectedLayerIds?: string[];
};

export function mockPlan(input: PlanInput): { steps: string[]; targetLayerIds?: string[] } {
  if (input.mode === 'generate') {
    return { steps: ['Read brief', 'Draft 3 angles', 'Generate visuals', 'Segment hero images (SAM)', 'Validate scenes'] };
  }
  return {
    steps: ['Read feedback', 'Pick layers to change', 'Apply scoped patch'],
    targetLayerIds: input.selectedLayerIds,
  };
}

const HEADLINES: Record<string, string> = {
  hook: 'Got an idea?',
  product: 'Describe it. We build it.',
  proof: 'Live this afternoon.',
};

export function mockStoryboard(input: { id: string; prompt: string; angle: string; brand: BrandKit }): SceneDoc {
  const { brand } = input;
  const headline = HEADLINES[input.angle] ?? HEADLINES.hook;
  return {
    id: input.id,
    title: `${brand.name}: ${input.angle}`,
    scenes: [
      {
        id: 's1',
        durationMs: 2000,
        background: brand.colors.background,
        layers: [
          makeLayer({
            id: 's1-headline',
            kind: 'text',
            name: 'Headline',
            transform: { x: 90, y: 700, w: 900, h: 400 },
            text: headline,
            style: { fontFamily: brand.fonts.heading, fontSize: 132, fontWeight: 800, color: brand.colors.text, textAlign: 'left' },
            motion: { preset: 'slide-up', delayMs: 0, durationMs: 700 },
          }),
        ],
      },
      {
        id: 's2',
        durationMs: 2500,
        background: brand.colors.primary,
        layers: [
          makeLayer({
            id: 's2-hero',
            kind: 'image',
            name: `${input.prompt.slice(0, 60)} hero`,
            transform: { x: 140, y: 420, w: 800, h: 900 },
            segment: true,
            motion: { preset: 'pop', delayMs: 0, durationMs: 500 },
          }),
          makeLayer({
            id: 's2-callout',
            kind: 'callout',
            name: 'Callout',
            transform: { x: 120, y: 1400, w: 840, h: 200 },
            text: input.prompt.slice(0, 60),
            style: { fill: brand.colors.background, color: brand.colors.text, fontSize: 52, borderRadius: 32, padding: 32, textAlign: 'center', fontFamily: brand.fonts.body },
            motion: { preset: 'fade-in', delayMs: 400, durationMs: 500 },
          }),
        ],
      },
      {
        id: 's3',
        durationMs: 1500,
        background: brand.colors.background,
        layers: [
          makeLayer({
            id: 's3-logo',
            kind: 'logo',
            name: 'Logo',
            transform: { x: 340, y: 700, w: 400, h: 160 },
            src: brand.logoUrl,
            style: { fontFamily: brand.fonts.heading, fontSize: 72, color: brand.colors.text },
            text: brand.name,
            motion: { preset: 'fade-in', delayMs: 0, durationMs: 400 },
          }),
          makeLayer({
            id: 's3-cta',
            kind: 'shape',
            name: 'CTA',
            transform: { x: 240, y: 1000, w: 600, h: 150 },
            style: { fill: brand.colors.primary, color: '#ffffff', fontSize: 56, borderRadius: 75, textAlign: 'center' },
            text: 'Start building',
            motion: { preset: 'pop', delayMs: 200, durationMs: 400 },
          }),
        ],
      },
    ],
  };
}

export function mockPatch(input: { doc: SceneDoc; message: string; allowedLayerIds: string[] }): PatchOp[] {
  const allowed = new Set(input.allowedLayerIds);
  const layers = allLayers(input.doc).filter((l) => allowed.has(l.id));
  const text = layers.find((l) => l.kind === 'text' || l.kind === 'callout');
  if (text) {
    if (/bigger|larger|pop|bold/i.test(input.message)) {
      return [{ op: 'set', layerId: text.id, path: 'style.fontSize', value: Number(text.style.fontSize ?? 100) + 20 }];
    }
    return [{ op: 'set', layerId: text.id, path: 'style.color', value: '#111111' }];
  }
  const first = layers[0];
  return first ? [{ op: 'set', layerId: first.id, path: 'motion.preset', value: 'pop' }] : [];
}

export function mockImage(prompt: string): string {
  return `https://placehold.co/1080x1200/png?text=${encodeURIComponent(prompt.slice(0, 40))}`;
}

export function mockSegment(url: string, concept: string): { subjectUrl: string; backgroundUrl: string } {  return { subjectUrl: url, backgroundUrl: url };
}
