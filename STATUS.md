# Basix — Build Status

> Last updated: Nov 4, 2026 (late evening). Source of truth for what works, what is verified, and what remains.
> Product decisions: `PLAN.md`. Product schema: `PRODUCT.md`.
> Hera teardown (daily.mp4, 91 s): `research/hera-daily-teardown.md` — composer chips, the 8-step
> template workflow, exact prompt copy, the Design editor's 7 layers. Canvas inventory + capability
> map: `research/hera-canvas-analysis.md`. **These two files are the record of the frame-by-frame
> analysis; the extracted frames in `.zwork/hera_daily/` are runtime scratch and may be rotated
> out of the conversation. Every fact (mode chips, options, step copy, layer names, workflows)
> lives in the notes, not in the images.**

## What this app is

Sign in → the agent chat floats over an infinite tldraw board → paste a brand URL → pick one of
four modes (**Storyboard · Image · Design · Animation**) → cards land on the canvas → "Open editor"
→ select layers, drag/resize, edit typography/motion in the inspector, or chat a change → export
MP4 (9:16 / 16:9) and PNG stills.

## Stack (unchanged)

Next.js 15 (App Router, React 19, plain CSS) · Vercel AI SDK v5 tool loop + `useChat` UI Message
Stream · Meta Model API (`muse-wonder-1.0`, `muse-spark-1.3`, `muse-image-1.0`, `sam-3.1`) · Neon
Postgres + Drizzle · Vercel Blob · Remotion Lambda · Better Auth · tldraw v5 · Hera design language
(cream `#F8F4F2`, ink `#171817`, orange `#FF513F`, panels `#F3F1EF`, radii 12/18/28 + pills).

---

## Submission video

- `Phantasma-demo.mp4` — 1:51, 1920×1080, 30 fps, 1.6 MB. Built from the full-frame
  captures (mode chips → typed brief → agent-generated poster on board → animate →
  editor → instant edits → Lambda export → download) plus the real 15 s generated
  9:16 launch film at t=91 s and a title/outro. Opened locally for review. The
  earlier 17 s cut (`recordings/phantasma-agent-demo/video.mp4`) was the short preview.

## Product understanding layer + Whispr Flow visuals (Nov 5)

- **LLM creative brief after every scrape** (`lib/brand/brief.ts`): Spark reads
  the scraped kit + site copy and writes `creative` + `about` — what the
  product is (one paragraph), audience, benefits, moments, **visual elements
  to show**, settings, UI elements, tone, avoid. Stored on the brand record;
  deterministic fallback offline. `brandBlock()` injects it into storyboard,
  poster and scene-image prompts; the SPEC now has a GROUNDING rule (visuals
  must show the product doing its job) and ui-demo scenes must use the real
  UI elements.
- **Whispr Flow, before:** generic "SPEAK YOUR IDEAS" 1-scene poster.
  **After** (fresh scrape): brief nailed it (Flow pill + waveform, messy →
  clean text, "Cheyene → Cheyenne", untouched keyboard, Gmail/Notion/docs).
  Generated: 3 storyboard variants (4–5 scenes each: hook, Gmail ui-demo with
  cleanup chip, 4x count-up, product hero MacBook+iPhone dictating, end card),
  3 posters, films `art_ecdbcd12` and `art_c90bfc4d` (15 s, Lambda-verified;
  frames show the Gmail draft scene and waveform hero). 77 cards on board.
- Checks: `tsc` clean · `vitest` **40/40**. Known flaws: hero photo has an
  odd water-pour stock element at the edge; "->" renders as ASCII in one chip.

## Instant editing + merge blocks (Nov 5, morning)

- **Instant editing.** Editor mutations (inspector, drag/resize commit,
  add/delete layer, revert) are now optimistic: the patch is validated with
  the same zod/`applyPatch` pipeline the server uses and applied to local
  state FIRST (preview, layer list, version list all update instantly); the
  server round-trip only confirms the version. Failures roll back.
  Measured live: Motion preset change → header v17 + value "pop" **before
  the PATCH resolved**, exactly one `/api/artifacts` call, **zero
  GET refetches**. PATCH/revert responses now return the doc for reconciliation.
- **Merge / duplicate blocks on the canvas.** Select 2+ variant cards
  (click + Shift-click) → floating bar above the selection: **Merge N cards
  → one film** / **Duplicate** (`lib/merge.ts`, tested; `POST /api/artifacts`
  `{merge|duplicate}`; `SceneDoc` scenes cap raised 6 → 24 for merged films).
  Verified live: Merged film (2) with 9 concatenated scenes rendered on the
  board (31 cards). Failure surface is inline (page-frozen `window.alert`
  removed from the board; session-reported failures now read in plain text).
- Any-kind video: Storyboard mode makes no product assumptions (prompt copy
  broadened); composer parameters (aspect/scene-count/count/variety/effort)
  ride every run.
- Verified: `tsc` clean · `vitest` **38/38** · `next build` clean · merge
  live. Test state: `art_22175689` at v18 (content intact); cleanup
  recommended on the demo user.

## Scenes on the canvas + motion-graphics archetypes (Nov 4, night)

- **Every scene is a picture on the board.** New `scene-card` tldraw shape
  (`components/board/shapes.tsx`): one row per variant — variant card, then
  Scene 1…N thumbnails (duration · layer count · headline), double-click
  plays the film, **Edit scene** opens the editor at that scene
  (`/app/[id]?scene=N`). Verified live: 19 cards, rows for all 6 artifacts.
- **Generation is no longer one template.** The storyboard SPEC
  (`lib/meta/prompts.ts`) now requires a sequence of different scene
  archetypes — hook, **ui-demo** (fake product UI from shape/text layers,
  typed prompt), feature rows, **data** (count-up number), proof,
  product-hero, end-card — with per-scene background variation and ≥4 motion
  presets per doc. New renderer presets `type`, `count-up`, `slide-left`
  (`lib/motion-text.ts`, tested; Inspector + Animation planner expose them).
- **Found and fixed a broken Lambda bundle:** `remotion/Root.tsx` dragged
  server code (@vercel/blob/undici) into the browser bundle via the sample
  brand, so `deploy:remotion` failed. Root is now pure; bundle + site
  redeployed (same serve URL).
- Proof render: seeded `art_aad0c3dd` "Daily Ritual — Motion Demo"
  (`scripts/motion-demo-probe.ts`, credit-free) → Lambda MP4 16.5 s; frames
  show the UI-demo scene mid-typewriter and the 92% count-up scene; all
  sampled frames differ. `tsc` clean · `vitest` **28/28** · build clean.
  Remaining on this theme: archetype quality now depends on Spark following
  the new SPEC (first live generation run will confirm); board still zooms
  to fit on new cards.

## Shell + scenes visibility (Nov 4, night)

- **Sidebar removed.** `components/Shell.tsx` is now a single top nav:
  Phantasm mark · Board (moved here, active state on `/app`) · Credits ·
  Sign out. App renamed: page title, `package.json` (`phantasm`), visible
  copy. Verified live: no `<aside>`, tab title "Phantasm".
- **"Missing" scenes were never missing.** The editor previewed one scene at
  a time with only small tabs, so multi-scene docs looked single-scene. Data
  check: `art_014ddb10` still has 4 scenes (3.5/3.5/3.5/3.0 s); the 1-scene
  cards are Image/Design/Animation outputs, single-scene by design. Editor
  now opens multi-scene docs on **▶ Full film** (all scenes, total runtime),
  with a thumbnail filmstrip (Scene N · duration · layer count); clicking a
  scene/layer switches to per-scene editing. Verified live on
  `art_014ddb10` (0:13 film, Scene 3 edit switch).

## Export fix (Nov 4, night) — was a UI failure, not a Lambda failure

Reproduced: Lambda + `/api/render` were healthy (still/video, both aspects,
valid h264/PNG out), but the editor gave **zero feedback for ~14 s** after
clicking Export (buttons stayed enabled, no status) and the eventual
"Download" was a raw cross-origin S3 link whose `download` attribute browsers
ignore — it opened in a tab instead of downloading. Fixes in
`components/Editor.tsx` + new `app/api/render/download/route.ts`:

- Exporting state: buttons disable, label counts elapsed seconds, status line
  shows starting/rendering on Remotion Lambda; polling rides out transient
  status failures; failures/timeouts surface readable errors.
- Downloads go through same-origin `/api/render/download?id=…` (auth +
  ownership checked) with `Content-Disposition: attachment` and a real
  filename (`lib/render/filename.ts`, tested).
- Verified live on :3001: PNG + MP4 exports from the editor, downloads return
  `attachment; filename="daily-ads-…-9x16.mp4"`, files probed (1080×1920 h264
  / 1920×1080 PNG). `tsc` clean · `vitest` **25/25** · `next build` clean.

## Hera composer click-through → Phantasm chat (Nov 4, night)

Clicked through Hera live (fresh board, every chip/pill/menu; record:
`research/hera-composer-clickmap.md`) and rebuilt the left chat to match:

- Mode chips **Image ⌥1 · Storyboard ⌥2 · Design ⌥3 · Animation ⌥4** (selected
  expands, rest icon-only), per-mode pills: Aspect (Auto/16:9/9:16/1:1/4:5),
  Count+Variety (Auto or 1–6; Close/Balanced/Wide), Scenes 1–7 (Storyboard),
  Duration (Auto/5–30 s/custom ≤120 s, Animation), Effort (Low/Medium/High).
- Chat switcher (`New chat ▾`, search, `+` new thread); board threads persist
  in `phantasm-chats:v1`, composer params in `phantasm-composer:v1`.
- Params wired end to end: `/api/agent` accepts count ≤6, scenes, variety,
  effort, aspect, duration ≤120 s; variety/format become brief directives,
  effort sets the tool-loop budget, animation duration clamp is now 3–120 s.
- Verified: `tsc` clean · `vitest` **23/23** · `next build` clean · browser
  click-test on :3001 (mode switch, Duration→30 s, Count/Variety menu,
  switcher). Known gaps vs Hera: 9:16 master only (aspect is a format
  instruction, no 1:1/4:5 masters yet); effort changes step budget, not credits.
- Side effect: an empty "Untitled canvas" board was created in the Hera
  account during the click-through; safe to delete there.

## Done and verified (late-evening pass — all items executed live unless noted)

### 1. Design mode logo layer — DONE, verified live + visually
- `decomposeAd` now calls `ensureBrandLogo`: when vision finds no logo element, the brand logo is
  appended bottom-left inside the fitted design (text fallback = brand name when no asset exists).
- `brandLogoSrc` picks the asset by background luminance. **Asset check caught an inversion**: the
  mirrored `logoMarkUrl` is the *light* variant (mean RGB 253,250,241 — invisible on cream), and
  `logoUrl` is the coloured Daily script (252,65,39). Light background → `logoUrl`, dark → mark.
  The old comment in `lib/brand/types.ts` claimed the opposite; corrected.
- Live re-run on the Daily poster: new card `art_22175689` (28 s), **6 layers** — Product cutout,
  START / STRONG / DAILY, Berry label, **Logo** (bottom-left, correct asset). A still rendered
  from it shows the red Daily logo bottom-left next to the Berry label.
- Unit coverage: `lib/design/decompose.test.ts` (5 tests: asset choice, append, no-op, fallback).

### 2. Animation mode — verified end to end (was already run once; STATUS previously said "not run")
- Correction to the earlier record: an animation card `art_54d5b7e5` existed already (created
  14:01 UTC, 6.5 s, Spark motion: product float, staggered headline reveals, label fade-in).
- Export proof (see item 5): rendered MP4 is 1080×1920, h264, 30 fps, **6.549 s**, and frames at
  0.3 s vs 3.5 s differ substantially (mean abs pixel diff 29.8) — the motion presets render.

### 3. Editor UI contract — verified via the exact API calls the UI makes
On `art_22175689`: drag/resize (4 ops, one PATCH), font family, weight, alignment, motion preset,
lock, + Text (upsert), delete — **each was exactly one version** (v1 → v9), all values applied,
locked state and motion persisted. (Same payloads `components/Editor.tsx` sends; no browser
automation was available this session, so click-level testing in a real browser is still open.)

### 4. Refine flow in the editor — verified live
"Make this headline bigger and bolder." on layer `art_22175689-l2` (START): steps streamed
(plan → patch), **exactly one new version** (v10 → v11), and a doc diff shows **only that layer
changed** (fontSize 157 → 220, fontWeight 400 → 800); every other layer byte-identical.

### 5. Exports — verified live (Remotion Lambda, free)
From the animation card: MP4 **9:16 done** (see item 2), PNG still **9:16 done** (1080×1920),
PNG still **16:9 done** (1920×1080, derived layout, not a crop). Still of the new design also
rendered (it is how the logo placement was visually confirmed).

### 6. Chat persistence — implemented (browser check still open)
`AgentSidebar` persists `useChat` messages to localStorage: one thread per board
(`basix-chat:board`), one per artifact in the editor (`basix-chat:refine:<id>`), last 50 messages,
saved when the thread settles, restored after mount (no SSR hydration mismatch). Typechecked and
built; needs a manual reload check in a browser to confirm visually.

### 7. Board polish — done
- Image-mode poster logo moved **top-left → bottom-left** (`workflow.ts`, avoids headline
  collisions). Applies to new posters; existing cards keep their saved layout.
- Board now **hydrates the latest brand on load** (`Board.tsx` fetches `/api/brand`), so the
  sidebar title is "Daily board" and runs use the real kit after a reload. Previously the brand
  only existed right after pasting the URL.
- Credits badge already refreshes on the `basix:credits-changed` event + window focus (`Shell.tsx`).

### 8. Brand build latency — headroom fixed
`/api/brand` `maxDuration` raised 60 → 300 (matches `/api/agent`). Mirroring and the 2 SAM cuts
already run in parallel; the measured 47 s build now has room. If deploys ever need it,
`scrapeBrand(url, { cutouts: false })` skips SAM entirely.

### 10. Second account check — done
Fresh account `second.check@example.com`: 5/5 credits, no brand, no artifacts, and cross-user
access to the demo account's cards returns 404 on both `/api/artifacts` and `/api/render`.

### Checks
- `npx tsc --noEmit` clean · `npx vitest run` **13/13 pass** · `npx next build` **clean**
  (all routes listed, /app 296 kB first load).
- Dev server restarted on http://localhost:3001 after the build.

### File map (new / changed this pass)
- `lib/design/decompose.ts` — `brandLogoSrc`, `ensureBrandLogo`, effective-background reuse.
- `lib/design/decompose.test.ts` — new: logo asset choice + append behaviour.
- `lib/brand/types.ts` — `logoMarkUrl` comment corrected (light variant for dark grounds).
- `lib/agent/workflow.ts` — poster logo at bottom-left.
- `components/AgentSidebar.tsx` — localStorage chat persistence per board / artifact.
- `components/Board.tsx` — brand hydration on load.
- `app/api/brand/route.ts` — `maxDuration` 60 → 300.

---

## Hera film-flow rework (Nov 4, night) — Phase 0 + 1 done

Analysis of both Hera videos (1 fps + keyframes): `research/hera-film-flow-analysis.md`.
Hera's model: the storyboard plan groups scenes **before** generation; scenes are born layered;
Design makes **every scene** editable (multi-source S1–S4); Animation turns **each storyboard
into one continuous film**. User decisions: layers first, agent decides durations/counts.

### Phase 0 — done
- `shapes.tsx:99` duplicate React key (Daily `primary === text`) fixed with index keys.
- `animateArtifact` no longer keeps only `scenes[0]`: it animates **every scene**, keeps
  authored per-scene durations for multi-scene docs (single-scene still takes the composer
  duration). Regression tests: `lib/agent/workflow.test.ts` (2 tests).

### Phase 1 — Layers first, done and verified
- **Wonder is the layer reader.** Probe (`scripts/wonder-vision-probe.ts`): `muse-wonder-1.0`
  accepts image input and returns valid layout JSON (Spark fallback kept in `readDesign`).
- DesignSpec now carries per-element **motion intent + confidence**; layers are built with them.
- `decomposeDocument` makes **every scene** editable (durations preserved; `decomposeAd` is the
  one-scene wrapper). Verified live credit-free: 2-scene probe → **19 layers** with exact copy,
  staggered reveals, product float, logo, confidences (`scripts/decompose-probe.ts`); full
  `designArtifact` flow → 12 layers · 2 scenes, version event (`scripts/design-flow-probe.ts`).
- **Editor**: scene tabs + per-scene editing preview, layers **grouped by scene**, low-confidence
  layers flagged "check", **double-click any text layer → inline edit on the canvas**
  (Enter/blur commits one version, Esc cancels), inspector gains motion **delay/duration**.
- Checks: `tsc` clean · `vitest` **15/15** · `next build` clean · dev restarted on :3001.

### Phase 2 — Storyboards born layered + multi-source, done and verified (Nov 4, night)
- **Born layered:** storyboard SPEC now mandates flat layers on the brand background, one
  message per scene, logo end card last, reveal/float/ken-burns motion. `normalizeStoryboard`
  (deterministic, `lib/scenedoc.ts`) guarantees brand background, real logo art, and the end
  card even when the model drifts. Live probe (`scripts/storyboard-probe.ts`): 4 scenes,
  14.5 s agent-decided, 1 headline/scene, end-card logo with `src`.
- **Multi-source Design/Animate:** `sourceArtifactIds` (max 8) through route → workflow →
  sidebar checkbox picker with Hera-style summary (`Design · 9:16 · N cards`, `→ N films`).
  One credit per run regardless of source count. Multi-source animate test added (18/18 total).
- **Film verified end to end:** born-layered storyboard seeded credit-free
  (`scripts/film-flow-probe.ts`, `art_014ddb10`, 4 scenes, images resolved) → Lambda MP4
  1080×1920, **13.547 s**, frames sampled inside each scene are all visually distinct, and the
  final frame is the Daily logo end card on cream.

### Phase 3 — Board card headers + browser check, done (Nov 4, night)
- `cardMeta` (`lib/scenedoc.ts`, tested): every board card now carries the Hera header line
  (`Storyboard · 9:16 · 4 scenes · 13.5s`, `Design · 9:16 · 1 scene · 4s`, …), also used in the
  board lightbox instead of the hardcoded "Storyboard".
- **Browser-level check done** with headless Chrome (CDP, signed-in session): board renders the
  brand card ("01 Brand · from your site"), credits badge, and cards with the new headers;
  the editor for `art_22175689` renders all 6 layers (incl. Logo), versions, scene UI, and the
  double-click hint. Chat persistence restore is still only code-verified (sending a message
  needs a credit).

### Browser gesture check — done (Nov 4, night)
Headless Chrome (CDP, real mouse/keyboard events) on `art_22175689`:
**double-click** the START headline → inline textarea opened with "START" → typed
"START TODAY" → Enter committed **exactly one version** (v11→v12, text verified via API);
**dragged** the DAILY layer → one version (v12→v13), doc position moved (216,538)→(349,633),
matching the pointer delta at preview scale. Test edits reverted (content back at v11, as v14).
Script: temp `basix-verify/browser-gestures.mjs`; screenshot `editor-after-gestures.png`.

### Remaining
- Vercel deploy (user: `vercel login`), live UI generation runs + chat-persistence reload
  (demo account 0/5 credits).

## Not yet done (ordered)

1. **Vercel deployment** — blocked on the user: `vercel whoami` reports an invalid token.
   Run `vercel login`, then `vercel link`, set the env vars from `.env.local`
   (plus `NEXT_PUBLIC_APP_URL` for Better Auth), and deploy.
2. **Chat-persistence reload check** — board/editor rendering and click-level gestures are
   Chrome-verified (see Phase 3 + gesture check); the persistence reload needs a credit to
   create a message first.
3. **Credits for the demo account** — `daily.demo2@example.com` is at **0 / 5** (all five runs
   spent and verified: Image, Design ×2, Animation, Refine). Top up `CREDITS_PER_USER` or use a
   fresh account for the next live run.

### Known nuances
- Hera's live app requires Google sign-in; its composer was inspected from `daily.mp4` and the
  shared board, not by clicking through the product (the board itself loaded read-only).
- The brand CDN (`www.drink-daily.com`) is unreachable from this network (DNS → dead IP), so all
  brand imagery is proxied/mirrored; SAM runs on the mirrored Blob URLs.
- Brand fonts beyond DM Sans / DM Serif Display are not bundled for Lambda; exports may use the
  fallback face (preview is correct).
- tldraw input reality (unchanged, still relevant): the canvas captures the pointer on pointerdown,
  so buttons inside shapes act on pointerup with press-lift guards, double-click is two rapid
  pointerdowns, and automation must aim at live coordinates right before pressing.

## Test environment

- Dev server: `http://localhost:3001` (port 3000 was occupied).
- Test account: `daily.demo2@example.com` / `basix-demo-2026` — **0 credits left**, 5 spent.
  Cards: poster `art_58a3061c`, design `art_28996a4b` (5 layers, no logo), design
  `art_22175689` (**6 layers incl. Logo, v11** after editor + refine verification), animation
  `art_54d5b7e5` (6.5 s, from the earlier design).
- Second account: `second.check@example.com` / `basix-demo-2026` — 5 credits, empty board.
- Brand record: latest for the demo user (`brand_b305da3d`); name Daily, 6 images, 2 cutouts.
- Verification scratch (curl cookies, streams, frames, stills):
  `/private/var/folders/sd/ptggfvfn7pz2gkqqdkmyf8yh0000gn/T/opencode/basix-verify/`.

## Environment knobs (`.env.local`)

| Variable | Status |
| --- | --- |
| `META_API_BASE_URL`, `META_API_KEY` | set, verified live (vision, posters, SAM all exercised) |
| `BLOB_READ_WRITE_TOKEN` | set, verified live (brand mirroring + design assets) |
| `DATABASE_URL` (Neon) | set, schema applied |
| `REMOTION_FUNCTION_NAME`, `REMOTION_SERVE_URL`, `REMOTION_AWS_REGION` | set, render-verified (MP4 + PNG, both aspects) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | set |
| `FIRECRAWL_API_KEY` | set, verified live |
| `BETTER_AUTH_SECRET` | set |
| `CREDITS_PER_USER` | set (5) |
| `NEXT_PUBLIC_APP_URL` | unset (same-origin works; set on Vercel) |
