# phantasma

phantasma turns a prompt and a brand URL into editable, brand-consistent motion graphics: titles, callouts, and short animated videos. Generate storyboard variants on a board, select layers, refine them in plain language, and export MP4 (9:16 and 16:9) and PNG.

## Stack

- Next.js on Vercel (App Router, TypeScript)
- Neon Postgres with Drizzle ORM
- Vercel Blob for storage
- Better Auth
- Remotion + Remotion Lambda for video rendering
- Vercel AI SDK with Meta Model API (OpenAI-compatible)

## Getting started

```bash
npm install
cp .env.example .env.local # fill in your keys
npm run dev
```

## Setup

1. Sign in with your account.
2. Add your brand URL and a prompt on the board.
3. Pick a storyboard variant, refine layers, and export your video.
