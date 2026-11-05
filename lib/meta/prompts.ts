import type { BrandKit } from '../brand/types';

/**
 * The renderer consumes exactly these style keys
 * (remotion/SceneDocVideo.tsx textStyle / shape / callout):
 * fontFamily, fontSize, fontWeight, color, textAlign and
 * fill, borderRadius, padding for shape and callout layers.
 * Motion presets: none, fade-in, slide-up, slide-left, pop, reveal, float, ken-burns, type, count-up.
 */
const SPEC = `
You author storyboards for a motion graphics renderer on a 1080x1920 canvas (9:16).

Return ONLY this JSON shape:
{
  "id": "unique-id",
  "title": "short title, max 5 words",
  "scenes": [
    {
      "id": "unique-scene-id",
      "durationMs": 1200-4500,
      "background": "#RRGGBB",
      "layers": [
        {
          "id": "unique-layer-id",
          "kind": "text" | "image" | "shape" | "logo" | "callout",
          "name": "short description",
          "transform": { "x": number 0..1080, "y": number 0..1920, "w": number, "h": number, "rotation": 0 },
          "style": {
            "fontFamily": "font name",
            "fontSize": number 36..240,
            "fontWeight": number 300..900,
            "color": "#RRGGBB",
            "textAlign": "left" | "center" | "right",
            "fill": "#RRGGBB",
            "borderRadius": number 0..30,
            "padding": number 12..48
          },
          "text": "layer copy",
          "segment": false,
          "motion": { "preset": "none" | "fade-in" | "slide-up" | "slide-left" | "pop" | "reveal" | "float" | "ken-burns" | "type" | "count-up", "delayMs": 0..700, "durationMs": 400..900 },
          "locked": false
        }
      ]
    }
  ]
}

Rules:
- 3 to 5 scenes. Total duration 10000..20000ms. You decide scene count and per-scene durations from the brief.
- GROUNDING: every scene must show the product DOING its job from the Product understanding below — its moments, visual elements, settings and UI pieces. If the visuals could advertise any other product, they are wrong. Copy (headlines, labels) uses the site's own benefits and voice, shortened — never invented claims.
- SCENE ARCHETYPES — every scene is a DIFFERENT archetype, never two of the same in a row, and never the same layout twice. This is a professional software ad (ElevenLabs / Claude style), not a slideshow of one poster:
  1. "hook": one bold claim, BIG type (fontSize 130..220), one small label. Motion: headline "reveal".
  2. "ui-demo": the product's own interface rebuilt from shape + text layers, using the UI elements from the Product understanding — a rounded window card (shape, borderRadius 24..30), a sidebar strip, the product's real controls (mic/record button, waveform bars, document lines — whatever the understanding lists), one typed line with motion "type" whose copy is a realistic user moment from the brief, a small cursor dot (round shape). Layers slide in with "slide-left" / "slide-up", staggered. NO image layer.
  3. "feature": 2-3 feature rows, each a small shape chip + short text line, entering one by one ("slide-left", staggered delays).
  4. "data": one huge number with motion "count-up" (text like "92%" or "10x"), one supporting line, optional callout. Number fontSize 180..240.
  5. "proof": a quote in a callout card + attribution text, or 2-3 stacked testimonial chips ("pop" in).
  6. "product-hero": the ONLY photographic scene besides the end card — one image layer whose name describes a RICH SCENE (2-3 product units arranged, props from the product's world, a coloured environment, one caught action moment; never "product on plain background"), headline beside or below it, image "ken-burns" or "float", PLUS a small "logo" layer top-left (x 64, y 64, w 220, h 80, text = brand name).
  7. "end-card": LAST scene only: centered "logo" layer (text = brand name, roughly x 240..840, y 820..1060) + one short tagline. No image layer.
  Pick 3-5 archetypes that fit the brief, always ending with "end-card". A software/product brief MUST include a "ui-demo" scene; a brief with a measurable claim MUST include a "data" scene.
- Backgrounds VARY per scene: rotate the brand background, primary, secondary, and text colors as scene backgrounds (all from the brand palette below). Text on each scene must contrast with that scene's background. Photos live in image layers, never as scene backgrounds.
- Every layer stays inside the canvas with margins of at least 40px (x+w <= 1040, y+h <= 1880).
- Use only the brand colors and brand fonts below.
- kind "text": headline copy at most 8 words BIG (fontSize 110..220), except UI labels and proof attribution (36..64). Give style.color, fontFamily, fontWeight, textAlign.
- kind "image": no text, no src. The product-hero layer's name MUST start with "Product hero:" — it is filled with the brand's real product photo, so describe only its pose/scale there. Any other image layer names a scene/setting photograph in 5-15 words (subject, surface, light), every one a DIFFERENT setting. Set w/h to match roughly a 1024x1024 source shown at "cover".
- kind "callout": one short fact, quote or keyword in a small block; set style.fill, borderRadius, padding, color, fontSize (36..72).
- kind "shape": UI chrome and blocks (windows, chips, buttons, cursor dots); set style.fill and borderRadius. Core building block of ui-demo scenes.
- kind "logo": set text to the brand name.
- At most ONE layer in the whole document has "segment": true; choose an image layer whose subject is a single clear object.
- Motion is choreography, not decoration: use at least 4 different presets across the doc; "type" only for a typed prompt/line, "count-up" only for a number, headlines "reveal", UI rows "slide-left"/"slide-up", images "ken-burns"/"float", logos "fade-in", badges "pop". Stagger delayMs so layers enter in reading order.
- Layer ids look like "s1-headline". Scene ids like "s1".
`;

export function brandBlock(brand: BrandKit): string {
  const c = brand.creative;
  const lines = [
    `Brand:`,
    `- name: ${brand.name}`,
    `- colors: primary ${brand.colors.primary}, secondary ${brand.colors.secondary}, background ${brand.colors.background}, text ${brand.colors.text}`,
    `- heading font: ${brand.fonts.heading}`,
    `- body font: ${brand.fonts.body}`,
    ...(brand.logoUrl ? [`- logo image URL: ${brand.logoUrl}`] : []),
  ];
  if (brand.about || c) {
    lines.push(
      `Product understanding (from the product's own website — ground every visual in this, invent nothing beyond it):`,
      ...(brand.about ? [`- About: ${brand.about}`] : []),
      ...(c
        ? [
            `- Audience: ${c.audience}`,
            `- Benefits: ${c.benefits.join(' · ')}`,
            `- Moments to dramatise: ${c.moments.join(' · ')}`,
            `- Visual elements to SHOW: ${c.visualElements.join(' · ')}`,
            `- Settings: ${c.settings.join(' · ')}`,
            ...(c.uiElements.length ? [`- UI elements: ${c.uiElements.join(' · ')}`] : []),
            `- Tone: ${c.tone}`,
            `- Avoid: ${c.avoid.join(' · ')}`,
          ]
        : []),
    );
  }
  return lines.join('\n');
}

export function storyboardSystem(angle: string, brand: BrandKit): string {
  return `${SPEC}
${brandBlock(brand)}
This variant must lead with the "${angle}" angle:
- hook: one bold claim that stops the scroll in the first scene.
- product: put the product/service visual center stage in the first scene.
- proof: lead with a number, testimonial or concrete result.
`;
}

export function wonderSystem(): string {
  return `You are the planning brain of a motion graphics assistant. Given a marketing prompt, you produce a short ordered plan used only for progress display, or decide which storyboard layers a refinement touches.`;
}

/** System prompt for the Spark tool loop that drives generation or refinement. */
export function agentLoopSystem(mode: 'generate' | 'refine'): string {
  if (mode === 'generate') {
    return `You orchestrate motion-graphics production by calling tools. Nothing you write in text becomes a scene — only tool calls build the storyboards.

Task: produce one storyboard variant per angle listed in the brief, in this order: hook, product, proof.
1. Call create_storyboard once per angle.
2. For every layer the tool reports as needsImage, call generate_image for that artifactId and layerId.
3. For every layer reported as segment (and that has an image), call segment_subject.
4. When all storyboards are complete and all their assets are filled, stop calling tools and reply with a one-line summary.

Rules:
- Exactly one create_storyboard per angle. Never invent artifacts or layers that a tool did not report.
- Work through one variant fully before starting the next.
- Image prompts are short concrete descriptions of one photograph (5-15 words): hero subject, surface, light.`;
  }
  return `You orchestrate small edits to a motion-graphics storyboard by calling tools. Only the layers in scope may change — never touch anything else.

Task: apply the user's change request to the selected layers.
1. Call apply_patch with all the ops the request needs (create_storyboard is not available).
2. If an op left an image layer without an image, call generate_image for it. If a layer should have its subject cut out, call segment_subject.
3. When the change is fully applied, stop calling tools and reply with a one-line summary.

Rules:
- Keep the change minimal: what the user asked for, nothing else.
- transform coordinates are pixels on a 1080x1920 canvas.`;
}

export function storyboardUser(prompt: string): string {
  return `Video brief: ${prompt}\nWrite one storyboard.`;
}

/** Compact per-layer summary so the patch model sees the current state of only the selected layers. */
export function patchSummary(layers: Array<Record<string, unknown>>): string {
  return JSON.stringify(layers, null, 1);
}

export const PATCH_SPEC = `
Return ONLY this JSON shape: {"ops": [ { "op": "set", "layerId": "...", "path": "...", "value": ... } ]}

- Allowed paths: "text", "transform.x", "transform.y", "transform.w", "transform.h", "transform.rotation",
  "style.fontSize", "style.color", "style.textAlign", "style.fontWeight", "style.fontFamily", "style.fill",
  "style.borderRadius", "style.padding", "motion.preset", "motion.delayMs", "motion.durationMs".
- motion.preset is one of "none", "fade-in", "slide-up", "slide-left", "pop", "reveal", "float", "ken-burns", "type", "count-up".
- Only touch the layers in the allowed list. Never add or remove layers.
- transform coordinates are pixels on a 1080x1920 canvas; keep layers inside it with 40px margins.
- Keep the change minimal and coherent with the brand.
`;

/**
 * Prompt for a finished flat ad poster: headline baked in, brand palette and
 * display face, one product hero. This is what Image mode generates and what
 * Design mode then separates into layers.
 */
export function posterPrompt(input: { brief: string; brand: BrandKit; variant?: number }): string {
  const { brand } = input;
  const v = input.variant ?? 0;
  const layout = [
    'big-type hero: huge headline over a rich full-scene photograph',
    'flat-lay arrangement: products and ingredients laid out from above on a coloured surface',
    'in-hand lifestyle moment: the product caught mid-use in a real setting',
    'splash action: liquid and product frozen mid-motion against a coloured studio backdrop',
  ][v % 4];
  const product = brand.images?.find((i) => i.kind === 'product')?.label;
  return [
    `A finished vertical 9:16 advertising poster for ${brand.name}.`,
    ...(brand.about ? [`Product: ${brand.about}`] : []),
    ...(brand.creative ? [`Show these product elements: ${brand.creative.visualElements.slice(0, 5).join('; ')}. Moments: ${brand.creative.moments.slice(0, 2).join('; ')}.`] : []),
    `Brief: ${input.brief}.`,
    `Art direction: ${layout}.`,
    `Scene, not a cutout: build a rich coloured environment in the brand palette (background ${brand.colors.background}, primary ${brand.colors.primary}, secondary ${brand.colors.secondary}) — a gradient studio backdrop or real setting with a surface, props from the product's world (ingredients, glassware, tools), and depth between foreground and background. Never a lone product floating on an empty backdrop.`,
    `Products: show an arrangement of 2–3 product units (hero unit in front, the rest behind or beside it, packaging included). ${product ? `Product: ${product}.` : `Product: the ${brand.name} product.`}`,
    `Typography: ONE short headline (2–5 words) that fits the brief, set huge in ${brand.fonts.heading}, in a colour from the palette, spelled correctly, plus at most one small label. Leave the top-left corner calm — a logo is placed there later.`,
    'Premium commercial photography: large soft key light, rim light, soft shadows, crisp focus on the hero product, subtle colour grading.',
    'No logo, no watermark, no mockup frames, no gibberish text, no extra words.',
  ].join(' ');
}

export function imagePrompt(input: { subject: string; brand?: BrandKit | null; shot?: 'product' | 'lifestyle' | 'poster' }): string {
  const subject = input.subject.trim().replace(/\s+/g, ' ').slice(0, 300);
  const brandLine = input.brand
    ? ` Environment in the brand palette (primary ${input.brand.colors.primary}, secondary ${input.brand.colors.secondary}, background ${input.brand.colors.background}): a gradient studio backdrop wall and a glossy surface, props tinted to the same palette.`
    : ' A coloured studio environment: gradient backdrop wall, glossy surface, props in a matching palette.';
  const composition =
    input.shot === 'lifestyle'
      ? 'candid in-use lifestyle photograph with natural body language, the product mid-use among everyday objects, more than one product unit visible'
      : input.shot === 'poster'
        ? 'bold advertising scene photograph with room at the top for typography'
        : 'advertising scene photograph: the subject as a small arrangement — hero unit in front, 2–3 more units or packaging behind — with props from its world and one caught moment (a pour, a splash, a hand placing it)';
  const creativeLine = input.brand?.creative
    ? ` Ground it in the product: ${input.brand.about ?? ''} Show: ${input.brand.creative.visualElements.slice(0, 5).join('; ')}.`
    : '';
  return [
    `Premium ${composition}: ${subject}.${creativeLine}`,
    `Build a rich scene with foreground, subject and background depth — never a lone product centred on an empty seamless backdrop.${brandLine}`,
    'Studio lighting: large soft key light, gentle rim light, soft shadows, crisp focus on the hero unit, shallow depth of field on foreground props, immaculate commercial finish, high resolution.',
    'No text, no words, no typography, no logos, no watermarks, no people unless the subject requires them.',
  ].join(' ');
}
