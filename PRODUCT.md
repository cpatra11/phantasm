# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js on Vercel (App Router, TypeScript). Chosen by the user in planning; not delegated.
Database: Neon Postgres with Drizzle ORM. Storage: Vercel Blob. Auth: Better Auth. Rendering: Remotion with Remotion Lambda in the user's AWS account. Agent: Vercel AI SDK. Models: Meta Model API (OpenAI-compatible).

## Users

Small marketers and founders with no design background. They need launch titles, callouts, and short 9:16 promo videos quickly, starting from their brand URL. Hackathon judges are a secondary audience: they must understand the product and reach a first result within a few minutes.

## Product Purpose

basix turns a prompt and a brand URL into editable, brand-consistent motion graphics: titles, callouts, and short animated videos. Users generate storyboard variants on a board, select layers, ask for changes in plain language, and export MP4 (9:16 and 16:9) and PNG. Success means a user goes from a brand URL to an exported video in one session, and can fix one thing without losing the rest.

## Positioning

Refinement is scoped: the user selects the layers they want changed, and the agent changes only those while every other layer stays as it was. Each change is saved as a version the user can revert.

## Operating Context

The app is used in the browser on a laptop, usually during a short session. Work happens on a board (brand card, prompt, storyboard cards) and in an editor for one artifact (preview, layer list, inspector, versions, export). Generation takes tens of seconds and shows live step progress. Users sign in before generating.

## Capabilities and Constraints

- Sign-in is required before generation and export (Better Auth).
- Free credits per account (pooled Meta key, held server-side; users never enter keys).
- Video: 9:16 master at 1080x1920, derived 16:9 at 1920x1080, 30 fps, 15 to 30 seconds, 3 to 6 scenes.
- Storyboards: 3 variants per prompt.
- Manual editing: select, drag and resize, inspector for text, color, and font size, per-layer motion presets. No keyframe timeline.
- Voice transcription is out of scope for the MVP.
- Undecided: the canvas technology (tldraw or a DOM board).

## Brand Commitments

None yet. The product name is basix. Brands are extracted from the user's URL, so the app's own look is not yet committed.

## Evidence on Hand

Reference material: Hera's canvas and storyboard flows, saved as frames in the planning session. No real customers, testimonials, benchmarks, or pricing exist yet. Do not invent any of them.

## Product Principles

1. Scoped change: selecting a layer and asking for a change should never disturb anything else.
2. Every change is reversible: versions are kept, and revert is always available.
3. The first result arrives fast: a brand URL and a prompt should produce a visible storyboard within a minute.
4. Credits are visible: the user always knows how much generation they have left.

## Accessibility & Inclusion

Standard keyboard operation and visible focus for all app controls. Text contrast meets WCAG AA. Video preview has visible play and pause controls.
