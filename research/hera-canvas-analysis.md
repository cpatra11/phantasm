# Hera canvas analysis — what every card is, and what it implies for basix

Board: *Template · Product Ad · Daily* (live, 10% zoom). Brand: drink-daily.com.
Full-res frame teardown: `research/hera-daily-teardown.md`.

## Inventory of the canvas (left → right, top → bottom)

**Left rail / brand folder column**
- Brand kit card: Daily logo (red script), 5 colour dots (cream, purple, red, coral, pink), type "Forrest" (headlines) + "DM Sans for copy, labels, buttons", strip "From the website" with product photos.
- Stylesheet pages (cream pages with type specimens), positioning pages, logo sheets, flavour gradient swatches, product cutout sheets, earlier ads — dropped onto the board as assets, not generated.
- Takeaway: brand context is a *folder of references*, not just hex codes. Every step reuses the subset that fits ("Using … +17" chips on the prompt card).

**Top row — ads (Image mode, mixed formats)**
- ~22 kept ads from 60 drafts (10 prompts × 6), 4:5, 1:1, 9:16 and banners. Examples: "Peach meets blood orange", "Bite-worthy. Sip-worthy.", "One stick. Your moment.", "No added sugar. All Daily.", "12 Sticks. 6 Flavors.", "Water. But wow.", "Hello, zesty side."
- All use: product photo/cutout, brand palette background, Forrest display headline, small DM Sans labels, Daily logo, one proof/callout chip.
- Prompt cards carry: mode · format · count ("Image · mixed formats · 60"), reference chips ("Using daily-hero-v11-en.jpg, daily-bottle-rose-frosted.png +17"), one-line brief.

**Middle row — feedback, layers, formats**
- Feedback: same ad before/after; request "Use our brand font Forrest for the headlines, like in this ad. Remove the stars." Everything else preserved. → reference-conditioned regeneration, not layer editing.
- Separate in layers: original flat ad (NO ADDED SUGAR seal with product pack + logo + CTA) → "Statement Seal design" + an **Editor card showing 7 layers: Background, Picture, Logo, NO, ADDED, SUGAR, Discover Daily**, Font: "Format Extrabold 80". → flat image decomposed into text/logo/picture/background layers, font swappable without regeneration.
- Formats: one banner + 1:1 feed, 9:16 stories, 4:5 — layout rebuilt per size, never cropped.
- Takeaway: Hera's design graph = background image + product/picture cutout + logo image + one text layer per line + CTA. That maps 1:1 onto basix's SceneDoc.

**UGC section**
- 13 picks across rounds: phone photos in everyday places (gym bag, desk, car, bathroom shelf), handwritten caption overlays, funny lines, no talking heads. → the same product cutouts dropped into lifestyle scenes, captions as text layers.

**Bottom row — animation**
- 5 animation cards, each "1 scene", 5 s, silent. Same prompt "Animate this ad." for five ads; Hera keeps copy/product in place and picks motion: text reveals, floating product, light on water.
- Takeaway: animation here is *per-layer motion on one scene*, not a storyboard. Duration 6–8 s, no sound.

**Craft details worth copying**
- Cards are named "Subject · Brand · Direction" (e.g. "Daily · Glow · Berry Burst") and numbered img-N; step notes are yellow stickies; red numbers 01–08 order the flow.
- Prompt cards show reference chips with thumbnails and a count badge; results sit directly under their prompt card.
- Every step is *additive*: brand → ads → feedback → layers → formats → animate, all on one board, nothing thrown away.

## Capability map → what basix should build

| Hera capability | How it works (evidence) | basix implementation |
|---|---|---|
| Brand kit from URL | logo + palette + fonts + website imagery | Firecrawl branding + markdown/images; persist logo, palette, font families, product/screenshot gallery |
| Product cutouts | products pre-cut (no background) and reused everywhere | SAM 3.1 on site product images → transparent PNGs in the brand kit |
| Image ads | image model + brand refs + product cutouts, batches with counts/formats | Image mode: poster generation with brand refs; count + aspect options |
| Reference ads | competitor ad + product cutouts, "keep the idea, Daily's look" | attach reference image card(s) as context to Image mode |
| Feedback | before ad + example ad + one-line delta | image-level refine: regenerate with before image + instruction (keep rest) |
| Design / separate layers | vision decomposition + segmentation; text lines, logo, picture, background as layers; edit font in editor | **Design mode**: vision model returns element boxes/text/fonts; SAM cuts picture/logo; build SceneDoc with one text layer per line; open editor |
| Formats | rebuild layout per aspect | derive re-layout per aspect (already partly in `deriveLayout`; needs content-aware reflow) |
| Animate | one ad → one scene, motion picks, 6–8 s, silent | **Animation mode**: Spark picks per-layer presets; new presets float/reveal/ken-burns; one scene 6–8 s |
| Editable layers | layers panel + font/typography controls, no regeneration | Editor inspector: text, font family/weight/size, color, align, motion, lock/hide; add/delete/reorder layers |
| Board as memory | brand folder, refs, versions, notes | board brand card + asset gallery + chat persistence per board |

## Ideas beyond Hera (endless possibilities)

1. **Layer-level "before/after" diff** — Hera regenerates the whole image for feedback; basix can show a true layer diff and let the user accept per layer.
2. **Cutout library** — every SAM cutout is reusable: product pack, logo, seal, mascot. Build an "assets" drawer so any ad can pull any cutout.
3. **Brand voice** — extract real headlines from the site (Firecrawl markdown) and use them as copy candidates; show "copy from your site" chips.
4. **Auto art directions** — for one product, generate 3 layout systems (monolith, seal, editorial) rather than 60 random drafts.
5. **True re-layout** — content-aware aspect conversion: move/resize/retitle per size, with safe zones; verify no crop of product.
6. **Motion presets that read as "design motion"** — text reveal by line, product float + shadow, light sweep, gradient drift; all editable per layer.
7. **Export a design system** — PNG/MP4 plus a JSON SceneDoc that other tools can consume (already the data model).
8. **Reference-to-brand translation** — upload any ad, decompose it, then re-skin with brand kit (fonts/colors/logo) in one step.
9. **Batch variants with locked layers** — lock logo/product, vary headline/background only.
10. **Agent select-to-edit** — select layers on canvas, ask in chat; already the app's scoped-refine differentiator.
