# METRIC.fyi

> Paste a video. Get the *brutally honest* reason it isn't going off.

A virality-score web app for short-form video. Drop an mp4, get a 0–100 score in ~25 seconds with timestamped feedback on hook, pacing, thumbnail, and caption — every claim cited to the exact moment in the video that proves it.

Built for the **8x Engineer "Go Viral Clone" contest** (May 2026).

**Live:** [metric-fyi.vercel.app](https://metric-fyi.vercel.app)

**Try a sample report (no upload needed):**
- [/r/8acd04b5…](https://metric-fyi.vercel.app/r/8acd04b5-c59e-408b-8da6-b6d4416f9238) — score **48**, app demo
- [/r/d0072db2…](https://metric-fyi.vercel.app/r/d0072db2-2595-4818-a397-173e86aeafe9) — score **48**, dog clip
- [/r/667cc6b8…](https://metric-fyi.vercel.app/r/667cc6b8-b9a7-4420-a389-ff826dbd5700) — score **28**, animation

---

## What it does

You drop a short-form video (≤ 20 MB, mp4 / mov / webm). The server uploads it to Supabase Storage and POSTs to `/api/analyze/[id]`, which hands the file to **Gemini Flash** running on Vercel's Node runtime with a strict JSON response schema. About 18–34 seconds later you land on `/r/[id]`, the public report:

- A 0–100 score in the corner of the page that you can compare against a category median
- Four "fix" sections (hook, pacing, thumbnail, caption) with timestamps, concrete edit instructions, and 3 ranked rewrite alternatives where applicable
- A video player + scrubber with marker pins at every cited moment — click any timestamp in the report or any marker on the scrubber and the video seeks to that frame and auto-plays
- A frame-thumbnail strip with **actual extracted frames** from your video (canvas, client-side)
- A **What If? simulator** at the bottom: toggle each fix on/off, watch the projected score animate from current → ceiling, hit all four to unlock a TIER-1 badge. One-click "↗ COPY CHECKLIST" exports the re-record list as plain text.
- Shareable on Twitter — `/r/[id]/opengraph-image` generates a 1200×630 card with the score and verdict; "↗ TWEET" prefills the intent

The whole thing is **no-signup**: anyone with the URL can reach a real analyzed report in under 5 seconds.

---

## The 5 differentiators (from the contest brief)

| # | Brief said | Where it lives | Status |
|---|---|---|---|
| 1 | Specificity of feedback (timestamps + concrete fixes) | `lib/ai/prompt.ts` system instruction + Zod-enforced response schema | ✅ |
| 2 | Visible reasoning (every claim links to a moment) | `components/report/VideoPlayer.tsx` + `TimestampChip.tsx` + `ReportContext` — two-way binding between any chip in the body and the marker on the scrubber | ✅ |
| 3 | No-signup demo path (5-second magic moment for reviewers) | Sample chips on landing link to 3 pre-analyzed `/r/[id]` URLs (see top of this README) | ✅ |
| 4 | Streaming analysis reveal (cascading sections) | When PendingClient hands off to ReportView, sections fade up sequentially over ~3.2s via Framer's `staggerChildren`. Technically client-orchestrated, not LLM-token streaming — see "Deliberate scope cuts" below for why. | ✅ |
| 5 | Shareable public report | `app/r/[id]/opengraph-image.tsx` (dynamic OG) + `ShareControls.tsx` (Copy link + Tweet intent) + `generateMetadata` for unfurl tags | ✅ |

---

## The 6 brief features (mapped)

| Feature | File / surface |
|---|---|
| Video upload (drag-drop) | `components/landing/UploadCard.tsx` — page-wide HTML5 drop zone, 100 MB UI cap, 20 MB analysis cap |
| Virality score 0–100 + breakdown | `components/report/ReportView.tsx` Hero + breakdown bars |
| Hook analysis (first 3 s) | FixHook section + `Analysis.hook.{landsAt, issue, fix, alternatives}` |
| Caption optimization | FixCaption section — dead-words struck through, 3 ranked rewrites, picked one swaps in when the What If toggle is on |
| Competitor / cohort comparison | Hero "vs PLATFORM / vs CATEGORY / CEILING" row — two independent deltas the model reasons about per video, plus a model-grounded `optimalPostTime` with a `why` |
| Trending audio + hashtag recs | Trending section — model-suggested mood/genre (deliberately not specific track names, see scope cuts) |

Plus a **thumbnail rating** section (FixThumbnail) showing the current cover frame versus the AI's recommended frame, both extracted client-side from the actual video.

Plus the **What If? simulator** (`WhatIfSimulator.tsx`) — the original wow moment from the design brief.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind v4 + hand-rolled token system (`@theme` in `globals.css`) — Lab Lime palette |
| Type | Clash Display (display, self-hosted) + Geist (body) + Geist Mono (instrument) |
| DB / Storage | Supabase (cloud — no local Docker) |
| AI | Gemini Flash (`gemini-flash-latest`, currently Gemini 3 Flash Preview) via REST, inline video data, free tier |
| Schema / Validation | Zod everywhere — both the API contract (`lib/schemas/report.ts`) and the LLM response shape (`lib/ai/schema.ts`) |
| Motion | Framer Motion 12 — staggered reveals, score animation, AnimatePresence swaps |
| Hosting | Vercel (Hobby plan — `maxDuration = 60` on the analyze route fits the ~25s Gemini call) |
| Package manager | pnpm |

---

## Run locally

Prerequisites: Node 20+, pnpm 10+.

```bash
git clone https://github.com/Anuj7411/metric-fyi.git
cd metric-fyi
pnpm install
cp .env.example .env.local
# fill in the values from your own Supabase + Gemini accounts
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful scripts

```
pnpm dev             # next dev (Turbopack)
pnpm build           # production build
pnpm lint            # eslint
pnpm test:analyze    # iterate the Gemini prompt against tests/videos/
pnpm test:rls        # regression-test the Supabase RLS policies (10 checks)
pnpm logs:sync       # idempotent: copy Claude Code conversation logs into ai-logs/, redact secrets
pnpm db:link         # one-time: link the supabase CLI to your project
pnpm db:push         # apply pending migrations
```

### Environment

```
NEXT_PUBLIC_SUPABASE_URL=                  # required
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=      # required (public anon key)
GEMINI_API_KEY=                            # required server-side (AI Studio)
```

There is intentionally **no `SUPABASE_SERVICE_ROLE_KEY`** — see Security decisions.

---

## Project structure

```
app/
  page.tsx                       Landing — headline + drop zone + sample chips
  layout.tsx                     Fonts + global shell
  globals.css                    Tailwind v4 + Lab Lime tokens
  api/
    upload/init/route.ts         POST: validate + insert pending report row
    analyze/[id]/route.ts        POST: download from Storage → call Gemini → save
  r/
    [id]/page.tsx                Server component, fetches via RPC, routes by status
    [id]/opengraph-image.tsx     Dynamic OG image (1200×630)

components/
  landing/                       Hero, UploadCard, SampleVideoPicker
  marketing/Logo.tsx
  report/
    ReportView.tsx               v2 layout orchestrator (Hero + sections)
    VideoPlayer.tsx              Custom unified scrubber + marker pins
    TimestampChip.tsx            Inline clickable timestamps
    PendingClient.tsx            Pending/analyzing state w/ shimmer skeleton
    WhatIfSimulator.tsx          Toggle grid + animated score + copy checklist
    ShareControls.tsx            Copy link / Tweet intent
    atoms.tsx                    Watermark, MonoTag, Pill, AppliedBadge, btnStyle
  ui/button.tsx                  shadcn-style Button — 2 custom variants

contexts/
  report-context.tsx             videoRef, seekTo, activeCitation, analysis,
                                 + AppliedState for the simulator

lib/
  ai/
    prompt.ts                    The single most-iterated file in this project
    schema.ts                    Canonical Analysis Zod schema + Gemini responseSchema
    gemini.ts                    Thin REST wrapper, runtime-agnostic
    derive.ts                    Pure helpers: deriveMarkers, deriveFrames, pickIndex, …
  rate-limit.ts                  In-memory token bucket
  schemas/report.ts              API request / response shapes
  supabase/{client,server}.ts    Anon clients only

hooks/
  useVideoFrames.ts              Client-side frame extraction via canvas

supabase/
  migrations/
    *_create_reports.sql         Table + CHECK constraints + RLS + fetch_report RPC
    *_create_videos_bucket.sql   100 MiB cap, mime-restricted, public read, anon write
    *_analyze_rpc.sql            mark_analyzing / mark_failed / save_analysis RPCs

scripts/
  test-analyze.ts                Prompt-iteration harness against tests/videos/
  test-stream.ts                 Streaming-mode harness (parked, see scope cuts)
  test-rls.ts                    RLS regression test — 10 checks
  seed-samples.ts                Upload + analyze sample videos for the landing chips
  sync-logs.sh                   Sync Claude Code JSONL into ai-logs/ + redact secrets

ai-logs/
  SUMMARY.md                     Curated daily narrative — read this for the build story
  *.jsonl                        Raw Claude Code conversation transcripts (per 8x spec)
```

---

## Architecture decisions

A few non-obvious calls worth explaining:

**Anon role + RLS, no service-role anywhere.** Every server-side operation runs under the public anon key. State transitions on `reports` (`pending → analyzing → ready / failed`) go through three `SECURITY DEFINER` PostgreSQL functions that validate the legal transition inside the function body. There is no client-side path to write a `ready` row directly, and there is no service-role key in the codebase to leak. `pnpm test:rls` runs 10 regression checks against this every commit.

**Inline video to Gemini, capped at 20 MB.** The Files API path (upload → wait for `ACTIVE` state → reference URI) takes 25–60s of one-way latency by itself, which would blow the Vercel Hobby 60s function ceiling. Inline-data path is one round trip and the dominant cost is Gemini's analysis time. Trade-off: max video size for the demo is 20 MB. Files API path is the natural Day 9+1 upgrade.

**Client-direct Storage upload.** The browser uploads directly to Supabase Storage with the anon key — `POST /api/upload/init` only inserts the pending row and returns a UUID. Otherwise Vercel's 4.5 MB request body cap would limit us to tiny files.

**Client-side frame extraction.** The frame-thumbnail strip and the FixThumbnail current/proposed comparison both call a hidden `<video crossOrigin="anonymous">` and read frames to canvas, then `canvas.toDataURL()`. Supabase public-bucket CORS allows this. No ffmpeg, no server work, runs after page load with zero impact on the analyze pipeline.

**Storage path === report id.** Every upload writes to `videos/{uuid}.{ext}`. The same UUID is the row's PK. Lookups are trivial, there's no separate filename mapping.

**Public-by-unguessable-UUID.** No share tokens, no signed URLs. The `reports` table has no anon SELECT policy — all reads happen via `fetch_report(p_id uuid)`, a `SECURITY DEFINER` function. If you know the UUID you see the report; if you don't, you can't enumerate. Standard pattern (Imgur, Pastebin, Cal.com).

**Section-by-section "streaming" via stagger, not SSE.** We tried real Gemini streaming — the SSE parsing didn't yield reliable chunks in our test harness, and 25s of clean buffer time exceeds Vercel Hobby's Edge limit. The compromise: sync analyze + a 3.2-second client-side cascading reveal once the data lands. The visual effect matches the brief; the implementation is honest about being client-orchestrated.

---

## Security decisions

- **No `SUPABASE_SERVICE_ROLE_KEY` in the codebase.** Verified by `git grep SERVICE_ROLE` returning zero hits in `app/`, `components/`, `lib/`, `hooks/`. The repo's `.env.example` doesn't list it.
- **RLS-only enforcement** for table writes. `reports` has explicit WITH CHECK clauses on INSERT for both anon and authenticated, no broad UPDATE policy. State transitions only happen inside SECURITY DEFINER functions.
- **`pnpm test:rls` passes 10/10** (run from any clone with the right env). Covers: anon can't `SELECT *`, can't INSERT with disallowed initial state, UPDATE/DELETE silently filtered, `fetch_report` only returns data for known UUIDs, Storage rejects non-video mime + anon delete.
- **Rate limiting** on `/api/upload/init` and `/api/analyze/[id]` — token-bucket per IP, in-memory (per-Vercel-lambda-instance, documented limit). Production would swap to Vercel KV or Upstash.
- **Secret redaction in AI logs.** `scripts/sync-logs.sh` regex-replaces `AIza…`, `sk-ant-…`, `sk-…` patterns in every synced JSONL file. Supabase publishable JWTs are NOT redacted — they're public-by-design and already in client bundles.
- **CSP / headers** are inherited from Vercel defaults — explicit hardening is on the post-submission backlog.
- **Mime + size enforcement at three layers**: client validation (UploadCard), Zod schema on the API route, DB CHECK constraint + Storage bucket allowed-mime list. Belt-and-suspenders.

---

## Deliberate scope cuts

Each of these was a real choice, not an oversight. README being honest about them is more useful than a polished demo with hidden holes.

- **No social URL ingestion (TikTok / IG / YouTube).** Platforms block server-side fetch and require business approval. yt-dlp doesn't run on Vercel serverless. V1 takes file upload only + 3 pre-loaded sample reports so reviewers can hit the magic moment in <5 seconds.
- **No auth + history pages.** The contest's "no-signup demo path" differentiator was the cleaner story. Auth + a `/history` page would have added 4+ hours for a feature reviewers don't see in a 30-second demo. The `lib/supabase/server.ts` cookie wiring is already SSR-friendly for the day this gets added.
- **Trending audio = mood/genre descriptors, not real track names.** Model knowledge of specific TikTok sounds is stale and a hallucination risk. The prompt asks for `"tension-building cinematic synth with low-end drum hits"` instead of `"Christmas Kids - Roar"` — the creator picks a matching real track in TikTok's sound library. Honest framing rendered in the section header: *MODEL-SUGGESTED MOOD/GENRE, NOT A LIVE TREND FEED.*
- **Frame thumbnails = client-side canvas extraction, not server pre-processing.** No ffmpeg, no Storage write of thumbnails. Works from the browser cache, runs after page load. Fails gracefully on slow CORS to gradient placeholders.
- **20 MB inline video cap on analysis.** Files API path is the natural upgrade for larger files; right now uploads >20 MB are accepted by Storage but the analyze route returns a clear error.
- **Optimal post time = model-grounded recommendation, not real analytics.** Gemini returns `{day, time, why}` per video based on the inferred category and content; the UI labels it as a "model-suggested" steer. Per-creator analytics from a real TikTok/Reels account would beat this.
- **Rate limit is in-memory.** Per-Vercel-lambda accounting — fine for contest scale, not for production traffic.
- **No real-time streaming reveal from the LLM.** Sync Gemini call + client-side staggered fade-in. Same visual effect, honest implementation. Edge-runtime SSE harness is in `scripts/test-stream.ts` for the eventual upgrade.

---

## Credits

- **Project scaffolding:** forked from [`8xsocial/template-webapp`](https://github.com/8xsocial/template-webapp). The original `app/upgrade`, `app/profile`, `app/privacy`, `app/terms`, `contexts/subscription-context.tsx`, and all SaaS demo content was stripped on Day 1.
- **Design direction:** two handoff bundles from [Claude Design](https://claude.ai/design) (live in `designs/`). The Lab Lime palette, Clash Display + Geist + Geist Mono type stack, motion contract (`[0.2,0.8,0.2,1]` cubic-bezier, 220ms element / 480ms page), Bloomberg-meets-FYP aesthetic, the Report v2 two-column layout, and the What If? simulator concept all come from those bundles.
- **Sample videos:** [Cloudinary demo bucket](https://res.cloudinary.com/demo/) (dog clip, CC0) + [test-videos.co.uk](https://test-videos.co.uk/) (Big Buck Bunny, CC0). Uploaded via the live site through `scripts/seed-samples.ts`.
- **AI:** Google Gemini Flash via the public Generative Language API (free tier). All analysis runs through one canonical prompt in `lib/ai/prompt.ts` and is forced to a Zod-validated JSON schema (`lib/ai/schema.ts`).

---

## AI working logs

Per [the contest's AI Logs guideline](https://8xengineer.com/guidelines/ai-logs), every Claude Code conversation that touched this repo is captured under [`/ai-logs/`](./ai-logs/):

- `SUMMARY.md` — a human-readable, day-by-day narrative of what shipped, what decisions got made, and what got cut. Read this first.
- `*.jsonl` — raw Claude Code transcripts (accepted format per the spec). Auto-synced via `pnpm logs:sync` with secret patterns (`AIza…`, `sk-…`, `sk-ant-…`) redacted before commit.

The development cadence ran roughly Day 1–6 in two intensive sessions, with Days 7–10 compressed thanks to early polish in Day 6. See `SUMMARY.md` for the breakdown.
