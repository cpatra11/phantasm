# basix — Build Plan

A Hera-like AI product: prompts become editable, brand-consistent motion graphics (titles, callouts, short animated 9:16 and 16:9 videos) on an infinite canvas, with multi-turn refinement and export-ready MP4 + PNG output.

Status: built and verified — see `STATUS.md` for what works and what remains; `PRODUCT.md` for the product schema. This file records the decisions. Decisions are also mirrored in `/Users/cpun/.opencode/plan/plan.md`.

## 1. Scope

**Context:** Hackathon MVP, solo builder, 2–4 days. Ruthless scope.

**In MVP**
- Canvas-first infinite board (tldraw) holding brand-kit cards, prompt cards, and storyboard artifacts.
- Brand kit from a URL (Firecrawl branding API) → editable brand kit card.
- One prompt → 3 storyboard variants, each a canvas card, each 3–6 scenes.
- Storyboard scenes are editable layers (text, image, shape, logo, callout).
- Multi-turn refinement: select a card, say what's off, the agent changes only that. Every agent edit snapshots a version (version chips + undo/redo).
- Manual editing: select, drag, resize, inspector (text, typography, colors), per-layer motion presets.
- Video: 9:16 (1080×1920) and 16:9 (1920×1080) both first-class, derived from the same SceneDoc. 30 fps, 15–30 s.
- Export: MP4 (both sizes) + PNG stills, rendered in the cloud.
- SAM 3.1 segmentation: the agent decides which images get cut into subject/background layers.

**Out of MVP**
- Keyframe timeline editing.
- Muse Voice Transcribe / voiceover.
- Animated chart layers (charts deferred; storyboard canvas first).
- Interactive SAM re-segmentation on canvas.
- Wizard/stepper UI (hera.mp4 flow).
- Multi-size *generation* (sizes are derived, not generated separately).
- Own Remotion/render server beyond Lambda.

**Explicitly removed:** filmidi-framework. It was deleted at the user's request (`/Users/cpun/Desktop/dev/hackac/filmidi-framework`). The `filmidi/` product repo is untouched and not part of this stack.

## 2. Architecture

```
Browser (Next.js on Vercel)
  ├─ tldraw canvas: board, brand card, prompt cards, artifact cards
  ├─ Layer inspector + manual editing (drag/resize/typography/color/presets)
  ├─ Remotion <Player/>: scrubbed preview of SceneDoc
  └─ Agent step-progress UI (NDJSON stream)
        │
Next.js API routes (Vercel)
  ├─ /api/brand      → Firecrawl scrape(url, formats=['branding']) → BrandKit
  ├─ /api/agent      → Vercel AI SDK agent (generate | refine), NDJSON event stream.
  │                     Muse Wonder does the planning inside the app's agent;
  │                     Spark 1.3, Muse Image 1.0, SAM 3.1 are called via lib/meta/.
  ├─ /api/artifacts  → SceneDoc CRUD, version snapshots (before every agent edit)
  └─ /api/render     → submits render job to Remotion Lambda, returns job status/URLs
        │
Storage: Neon Postgres + Drizzle ORM (in-memory store fallback when DATABASE_URL is unset)
         + Vercel Blob (generated images, SAM cutouts, render outputs)
Remotion Lambda (user's AWS account): renders MP4 (9:16 + 16:9) and PNG stills
```

## 3. Core data model: SceneDoc

SceneDoc is the single source of truth for an artifact. The agent and the UI both mutate it.

```ts
type SceneDoc = {
  id: string;
  brandKitId: string;
  version: number;              // snapshot per agent edit
  master: { width: 1080; height: 1920; fps: 30 }; // authored layout
  scenes: Scene[];              // 3–6 scenes, 15–30 s total
};
type Scene = {
  id: string;
  durationMs: number;
  layers: Layer[];              // ordered, bottom → top
};
type Layer = {
  id: string;
  kind: 'text' | 'image' | 'shape' | 'logo' | 'callout';
  transform: { x: number; y: number; w: number; h: number; rotation: number };
  style: Record<string, unknown>;      // typography, color, radius, etc.
  motion?: { preset: string; params?: Record<string, number> }; // per-layer preset
  // image layers also carry: source, samCutout?: { subjectUrl; backgroundUrl }
};
```

- **Derived sizes:** 16:9 is computed from the master via re-layout rules (fit / reflow / scale, safe zones). The SceneDoc is not duplicated.
- **Versions:** every agent edit writes a new `version`, and the previous one is kept. Undo/redo and version chips read from that history.

## 4. Meta stack

All Meta access is live. The user will provide base URLs, auth, and endpoint docs or keys at build time.

| Component | Role |
|---|---|
| Meta Model API | Platform/access layer for all calls (OpenAI-compatible; reached via `@ai-sdk/openai-compatible` or the facade in `lib/meta/`) |
| Muse Wonder | Planning only. It produces the plan inside the app's own agent (one plan per user message); it does not orchestrate tools itself. |
| Muse Spark 1.3 | Scene layout, layer tree, animation logic. Generates and patches SceneDoc. |
| Muse Image 1.0 | Visual assets (backgrounds, product/person imagery, gradients). |
| SAM 3.1 | Agent-decided segmentation into subject/background cutout layers. |
| Muse Voice Transcribe | Not in MVP. |

**Orchestration rule:** the app's agent (Vercel AI SDK) orchestrates; Wonder only plans. Neither Wonder nor the agent edits the canvas directly — they emit SceneDoc patches, which the API validates and applies.

**Agentic framework:** Vercel AI SDK (`ai` v5). The current pipeline is a fixed-order NDJSON stream (plan → storyboards → assets → segment); swapping to a tool loop (`create_storyboard`, `generate_image`, `segment_subject`, `apply_patch`) is optional later polish — see `STATUS.md`.

**Credits:** every account gets free generation credits (default 5, `CREDITS_PER_USER`). One agent run costs one credit; failed runs refund; export is free. The Meta key is pooled and held server-side — users never enter keys. Credits are visible in the UI (`/api/credits`), and a run is refused with 402 when the account is out.

## 5. Brand kit

- Firecrawl `scrape(url, formats=['branding'])` returns logo, palette, typography, spacing, and UI styles in one call.
- Result is saved as an editable BrandKit card. It is referenced by every artifact and by every refinement, so brand stays consistent.
- Fallback if Firecrawl fails: manual brand kit (color/font/logo upload). Not built unless time allows.

## 6. Rendering

- **Engine:** Remotion. Scenes are React components that read SceneDoc. `<Player/>` gives the in-canvas preview.
- **Production render:** Remotion Lambda in the user's own AWS account. This is the only Remotion cloud path. Remotion has no hosted render API; "Remotion Cloud" was third-party shorthand, verified against remotion.dev/lambda.
- **Setup cost:** about 30 min once (Lambda function, S3 bucket, IAM role). Render cost is about $0.001–0.005 per 30 s video.
- **Licensing:** free for individuals and small companies (solo builder is fine).
- **Stills:** PNG frames from the same components.
- **Fallback:** `@remotion/renderer` locally, behind the same `renderJob()` interface, if Lambda is blocked during the demo.
- **Rejected:** render.com (Docker render service, about $25/mo, cold starts). Could replace Lambda after the hackathon with no code change behind `renderJob()`.

## 7. Canvas

- **tldraw SDK** for the infinite board, selection, transform handles, camera, and undo.
- Cards on the board are tldraw shapes (custom React shapes) that reference a SceneDoc id.
- The layer editor opens on card select and edits SceneDoc. The tldraw card preview is a Remotion `<Player/>` or a static frame.
- tldraw production license is needed after dev. Check terms before any public launch.

## 8. Build phases (solo, 2–4 days)

**Day 1 — foundations**
1. Scaffold Next.js (App Router) + TypeScript + Tailwind in `basix/`. Deploy empty app to Vercel.
2. SceneDoc types + validator (zod) + sample doc.
3. Remotion composition: renders one SceneDoc at 9:16 and 16:9 (local preview first).
4. Brand kit: Firecrawl call → BrandKit card on canvas.

**Day 2 — agent and canvas**
5. Meta client wrapper (`lib/meta/`): Wonder, Spark, Image, SAM. Mocks if keys are not ready.
6. Wonder workflow per message: plan → Spark scenes → Image assets → SAM on chosen images → SceneDoc patch.
7. tldraw board: prompt card → 3 storyboard cards with step progress.
8. Versioning: snapshot before each agent edit, version chips, undo/redo.

**Day 3 — editing and render**
9. Layer inspector: text, typography, colors; drag/resize on preview; per-layer motion presets.
10. Refinement flow: select card → message → patch only target layers → new version.
11. Render: Remotion Lambda deploy, `/api/render`, job status polling, MP4 (both sizes) + PNG export.

**Day 4 — polish and demo**
12. Demo path rehearsal (see section 9). Fix blockers only.
13. Fallback: local render if Lambda fails.

## 9. Demo path

1. Paste brand URL → brand kit card appears (Firecrawl).
2. Type product prompt → 3 storyboard cards appear with Wonder step progress.
3. Select card 1 → "not on brand, take the gradient behind the person" → only the image layer changes; version 2 saved.
4. Edit a headline in the inspector and apply a motion preset.
5. Export MP4 at 9:16 and 16:9 plus a PNG.

## 10. Risks and open items

| Risk | Mitigation |
|---|---|
| Lambda setup (AWS) eats demo time | Do it on Day 1 in parallel. Keep local `@remotion/renderer` fallback behind `renderJob()`. |
| Meta API shape unknown until docs/keys arrive | Wrap in `lib/meta/` with a mock implementation. Swap when docs arrive. |
| Wonder planning latency during demo | Stream steps to the UI. Pre-warm one demo brand. |
| Brand scrape misses logo or fonts | Manual override in the BrandKit card. |
| SAM cutouts poor on generated imagery | Agent decides when to segment; skip if the result is poor. |
| 16:9 derivation looks bad | Keep layouts simple. Use safe-zone rules. Accept some manual fix. |
| tldraw license for production | Dev is free. Check license before any public launch. |
| Vercel storage choice | Implementation detail. User can veto. |

## 11. Needed from the user before Day 1

1. Meta Model API base URL, auth scheme, and endpoint docs or keys for Wonder, Spark 1.3, Muse Image 1.0, and SAM 3.1.
2. Firecrawl API key.
3. AWS account access for Remotion Lambda setup (or confirm the user will do the setup walkthrough).
4. Confirm the Vercel account/team to deploy to.

## 12. Reference

- Hera reference frames: `/private/var/folders/sd/ptggfvfn7pz2gkqqdkmyf8yh0000gn/T/opencode/hera_frames/` (hera1 = 48 s guided flow; hera2 = 80 s Hera Canvas flow).
- Videos: `/Users/cpun/Downloads/hera.mp4`, `/Users/cpun/Downloads/Hera _ AI-Native Creative Canvas & AI Motion Graphics.mp4`.
- Remotion Lambda: https://www.remotion.dev/lambda · docs: https://www.remotion.dev/docs/lambda · setup: https://www.remotion.dev/docs/lambda/setup · server-side render comparison: https://www.remotion.dev/docs/compare-ssr
- Firecrawl branding: https://www.firecrawl.dev/glossary/web-extraction-apis/extract-website-branding
- tldraw SDK: https://github.com/tldraw/tldraw
