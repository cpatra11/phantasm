# Hera film-flow analysis — daily.mp4 (91 s) + Hera Canvas film (81 s)

Frames: `.zwork/hera_daily2/` and `.zwork/hera_canvas/` (1 fps, runtime scratch; this file is the record).
daily teardown detail also in `research/hera-daily-teardown.md`; board inventory in `research/hera-canvas-analysis.md`.
This file adds the second video and, most importantly, how multi-image work becomes **one film**.

## Video 1 — `Hera _ AI-Native Creative Canvas & AI Motion Graphics.mp4` (81 s, Lovable)

| t (s) | What happens |
|---|---|
| 0–4 | **01 Brand.** Type-ahead "Set up our brand from lovable…" → kit card appears: Lovable logo, colour dots. |
| 5–8 | Kit completes: gradients ("Cormorant Plain"? gradient strip), type, and the **website screenshot** as a card. Caption: "Hera reads the brand site and builds the kit: logo, colours, gradients, type." |
| 8–14 | **02 Ads.** Prompt: "Make ads for Lovable, each a different angle: product, numbers, people, hands. Swiss, less is more, in our brand." Placeholder tiles fill the canvas, then resolve: **36 first drafts**, each a different angle. |
| 15–17 | The 12 kept ads zoom/scatter; a **feedback** prompt card opens ("Not on brand yet…"). Caption: "We keep the 12 we would ship." |
| 18–25 | **Feedback.** "Not on brand yet. Take the look from our website: the full gradient behind the person." Select an ad, say what's off — Hera fixes only that and keeps the rest. Before/after cards side by side ("Hold that thought" vs "My idea. My app."). |
| 26–33 | **Ads from references.** "Make a Lovable ad from this reference." A foreign ad is dropped in; Hera keeps the idea and moves it into the brand (same layout idea, Lovable copy/logo/gradient). Phone-UI reference → Lovable version. |
| 34–41 | **05 Editable design.** Prompt "Make V4 editable." Using chip: V4. The flat picture **rebuilds as a layer stack** that fans out in 3D: labels read (top→bottom) Prompt text, **Headline, Logo, Glow, Background**. Caption: "Hera rebuilds the picture as layers. Text, logo, shapes and glow stay editable." |
| 42–48 | **Formats.** "Create formats for V4." Same design re-laid-out at other sizes (one layout approved once, adapted to every size — never cropped). |
| 49–55 | **07 Storyboards.** Prompt card `Storyboard · 9:16 · 3 scenes`: **"Make 4 storyboards with 3 scenes each: flat layers on the brand background, one message per scene, end card with the logo."** Using chip: Lovable brand kit. Four storyboards (S1–S4) appear, each **3 scenes** (12 scene cards total). Note the scenes are *born layered* ("flat layers on the brand background"), not decomposed posters. |
| 56–63 | **08 Editable storyboards.** Prompt card `Design · 9:16 · 12 scenes`: "Make every scene editable, so we can animate it in the edit." **Using chips: S1 S2 S3 S4** (all four storyboards as sources at once). Caption: "Every scene is rebuilt as layers, ready to animate." |
| 64–73 | **09 Film.** Prompt card `Animate · 9:16 · 4 films`: **"Animate every storyboard as one film."** Using S1 S2 S3 S4 → four film cards `S1 · film · 9:16` … `S4 · film`. Cards play: scenes run **in sequence inside one continuous film** (headline typing/reveal, card builds). Caption: "Each storyboard becomes one continuous film." |
| 74–80 | Zoom out: the whole pipeline lives on one board (brand → drafts → feedback → references → editable → formats → storyboards → films). End card: "Made on one board in Hera Canvas." |

## Video 2 — `daily.mp4` (91 s, Daily) — second-by-second changes vs earlier teardown

Confirms `research/hera-daily-teardown.md`; sharpened timings:

| t (s) | What happens |
|---|---|
| 0–5 | Left chat "New chat", composer with mode chips; top-left "Add brand" menu → New brand. |
| 2–5 | "Bring your brand" dialog: website URL field (`www.daily.com` typed), name/guideline fields, "Create with AI" → "Building your brand" progress. |
| 6–11 | Brand kit card materialises: Daily red script logo, 4 colour dots, "Forrest", product photo strip. |
| 12–19 | **02 Ads (Image).** Prompt "Daily ads for Instagram: one flavour per ad, big headline, product in…" → grid of ~60 placeholder tiles resolves into draft ads; kept ones scatter into the ads row. Caption: ten prompts like this one, six drafts each; kept the best 22. |
| 20–24 | Zoom across kept ads (mixed 4:5 / 1:1 / 9:16 / banners). |
| 25–33 | **03 UGC (Image).** "Funny UGC style ads for Daily, shot on a phone. No talking heads…" → phone-photo cards with handwritten-style captions. |
| 34–43 | **04 Ads from references.** Reference ads (purple/yellow competitor cards) selected with "Using" chips → "Make a Daily ad from this reference" → same idea rebuilt in Daily's look. |
| 44–50 | **05 Feedback (Image).** On the GLOW ad: "Use our brand font Forrest for the headlines, like in this ad. Remove the stars." Before left, after right — everything else unchanged. |
| 51–63 | **06 Separate in layers (Design · 4:5).** Prompt **"Make this ad editable. Every element on its own layer."** Using: Daily · No Added Sugar · Statement Seal. Result card + **Editor card: 7 layers — Background, Picture, Logo, NO, ADDED (selected), SUGAR, Discover Daily — Font: Forrest Extrabold**. Exploded stack visual at t≈56–60. |
| 64–74 | **07 Formats (Image).** One banner → 1:1 feed, 9:16 stories, 4:5. Layout rebuilt per size instead of cropping. |
| 75–84 | **08 Animate (Animation · 1 scene).** Prompt **"Animate this ad."** Using: Daily · Busy Mornings · Simple Equation. Five different ads each **"Generating"** as a 5 s film. Caption: "One ad, one scene, one film. Hera picks the motion." |
| 85–91 | Zoom out to the full board: brand folder column left, steps 01–08 in rows, yellow stickies annotating. |

## The two Hera patterns for "many images → film" (this resolves the confusion)

1. **Single-ad animation (daily step 08):** one flat ad → Design (layers) → Animation = **one scene, one film**, 5–8 s, silent, motion picked per layer. Each ad animated separately.
2. **Storyboard animation (canvas film steps 07–09):** agent **plans a storyboard** (e.g. 4 storyboards × 3 scenes) from the brief + brand kit → scenes are generated **already layered** on the brand background → Design step makes **every scene** editable (all storyboards as multi-source input) → Animation turns **each storyboard into one continuous film** with its scenes in sequence.

What Hera never does: generate N unrelated posters and then hope a video assembles itself. The grouping exists **before** generation (the storyboard plan), layers exist **from birth or by explicit Design step**, and animation always consumes a whole layered document — never `scenes[0]` alone.

Other transferable details:
- Prompt cards carry the contract: `Mode · Aspect · Count` headers (`Design · 9:16 · 12 scenes`, `Animate · 9:16 · 4 films`) and **Using chips** naming every source (brand kit, S1–S4, reference ads).
- Durations/counts are **agent-decided** inside the plan (3 scenes, 12 scenes, 4 films, 5 s) — the user states intent, not numbers.
- Editing is structural, not conversational only: Editor card lists layers; the selected layer + font control are edited directly. Feedback chat is a separate path (regenerate-preserving) from layer editing (no regeneration).
- Every step is additive on one board; nothing is thrown away or overwritten.

## Implication for basix (feeds the revised plan)

- basix's `animateArtifact` keeping only `scenes[0]` contradicts pattern 2 — animate the **whole doc**.
- basix Design mode = pattern for flat ads (correct), but Storyboard mode should generate **layered scenes directly** ("flat layers on brand background, one message per scene, end card with the logo") so no decomposition is needed for agent-made scenes.
- Multi-source steps exist in Hera (Using S1–S4): Design/Animate must accept **multiple source artifacts**, not one `sourceArtifactId`.
- Mode headers/counts and Using chips are part of the product surface, not decoration.
