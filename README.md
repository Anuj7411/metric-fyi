# METRIC.fyi

> Paste a video. Get the brutally honest reason it isn't going off.

A virality-score web app for short-form video. Upload a clip, get a 0–100 score with timestamped feedback on hook, pacing, caption, and thumbnail — every claim cited to the exact moment in the video that proves it.

Built for the **8x Engineer "Go Viral Clone" contest** (May 2026).

---

## Status

Day 1 of 10 — scaffold up, deployed, design tokens wired. The full build sequence lives in `docs/PLAN.md` (committed Day 1). See `AI_LOG.md` for what shipped each day.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind v4 + a hand-rolled token system (Lab Lime palette)
- **Type:** Clash Display (display) + Geist (body) + Geist Mono (instrument)
- **DB / Auth:** Supabase (cloud — no local Docker dependency)
- **AI:** Gemini 2.0 Flash for video frame + audio analysis
- **Hosting:** Vercel
- **Package manager:** pnpm

## Run locally

Prerequisites: Node 20+, pnpm.

```bash
pnpm install
cp .env.example .env.local
# fill in the Supabase + Gemini values, then:
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Environment

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only — never imported by client code
GEMINI_API_KEY=                   # server-only
```

## Project structure

```
app/                    # Next.js App Router
  page.tsx              # landing
  layout.tsx            # fonts + global shell
  globals.css           # Tailwind + Lab Lime tokens
components/             # nav, footer, ui primitives
contexts/               # auth (re-wired Day 8)
lib/
  supabase/             # SSR clients
public/fonts/           # self-hosted Clash Display
supabase/migrations/    # RLS-first schema (Day 3+)
```

## What's deliberately scoped down

- **Real TikTok/IG/YouTube URL ingestion** — platforms block server-side fetch and require business approval. V1 takes file upload only, with three pre-loaded sample videos so reviewers can hit the magic moment in <30 seconds.
- **Trending audio / hashtag discovery** — uses a small curated demo list, honestly labeled in-app and here. Real trend data needs official platform APIs.
- **Payments / pro tier / user dashboards** — not in the contest brief.

## Security decisions

To be filled in as we make them. Highlights so far:
- Supabase service-role key lives only in server-side code; never imported into anything under `app/` or `components/` that ships to the client bundle.
- Tables get RLS policies the moment they're created, never as an afterthought.

## Credits

- Design direction lives in `designs/` (handoff bundle from Claude Design)
- Forked from [`8xsocial/template-webapp`](https://github.com/8xsocial/template-webapp) and stripped of the SaaS demo content (subscription tiers, profile management, etc).
