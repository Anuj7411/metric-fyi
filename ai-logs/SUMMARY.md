# AI Working Log — METRIC.fyi

> Submission artefact for the 8x Engineer "Go Viral Clone" contest.
> Built May 6 – May 15, 2026 (9 working days). Solo engineer + Claude (Sonnet 4.6 / Opus 4.7).
> Companion files: 3 × `*.jsonl` (raw Claude Code transcripts, secret-redacted) and this curated narrative.

---

## How to read this document

This is a **decision log**, not a transcript dump. The raw `.jsonl` files preserve every keystroke I exchanged with the model; this file extracts the parts that matter for judging — what we built, why we built it that way, what we cut, and where the AI was overruled.

Each day's entry follows the same shape:

| Section | What it answers |
|---|---|
| Goal | What this session was trying to land |
| Work | The concrete commits, files, and migrations that moved |
| Decisions | The non-obvious calls with their tradeoffs spelled out |
| Pushback | Where I overruled the AI's first instinct, or vice-versa |

Two appendices at the bottom go deeper on the parts the contest spec highlights: **prompt engineering** (Appendix A) and **the test rigs that kept the AI honest** (Appendix B).

---

## Working method (the loop I followed every day)

Nine days, ~50 commits, one Vercel deploy URL since Day 2. The loop:

1. **Plan in plain English first.** No code until the approach was articulated as prose I could read back to myself. When I caught the model jumping straight to code, I rolled it back.
2. **One small thing at a time.** Average commit touched 3–6 files. Anything bigger got staged across two or three commits with conventional-commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`).
3. **Test rigs as ground truth.** Two custom harnesses — `pnpm test:analyze` (prompt iteration against three real videos) and `pnpm test:rls` (ten-check Supabase regression). I ran one or both after every change that could break them.
4. **Zod at every boundary.** API request shapes, Gemini response shapes, database row shapes — all defined as Zod schemas in `lib/ai/schema.ts` and `lib/schemas/report.ts`. No `any`. No untyped JSON. The defensive-transform pass on Day 8 turned the AI schema into something that absorbs imperfect model output instead of rejecting it.
5. **Document scope cuts honestly.** Anything the brief implied but we deliberately didn't build (image upload, social-URL ingestion, server-side auth, real trending-audio API) is enumerated in the README under "Deliberate scope cuts" — same as it appears here.

Where the AI added the most value: scaffolding type-safe boundaries fast, exploring the design space for the prompt, and pattern-matching obscure runtime errors (the iOS Safari frame-extraction quirk was diagnosed in three turns). Where it added the least: anything involving brand voice or pacing — those calls stayed with me.

---

## Day 1 — May 6, 2026 · Scaffold and design-system baseline

**Goal:** Get a deployable Next.js shell live with the brand identity wired in.

**Work**
- Forked `8xsocial/template-webapp` → `Anuj7411/metric-fyi`. Cloned locally, ran `pnpm install`.
- Stripped the template's SaaS demo content: `CANDIDATE_ASSIGNMENT.md`, `app/upgrade`, `app/profile`, `app/privacy`, `app/terms`, `app/api/account`, `contexts/subscription-context.tsx`, the subscriptions migration, `lib/colors.ts`, `lib/confetti.ts`, and all eleven `8x`-branded favicons / web-app-manifest images.
- Wired the Lab Lime token system into `app/globals.css` via Tailwind v4's `@theme` directive. Every color, surface, and font variable from the design bundle's `palette.jsx` is now a CSS custom property — one source of truth.
- Self-hosted `ClashDisplay-Variable.ttf` from the design bundle into `public/fonts/`. Loaded via `next/font/local` with a `200 700` axis range so the variable-axis range matched the design intent. Geist Sans + Geist Mono added via the official `geist` npm package.
- Replaced `app/layout.tsx`, `app/page.tsx`, `components/navigation.tsx`, `components/footer.tsx`, and `app/not-found.tsx` with stripped METRIC.fyi shells. The homepage shipped with the locked headline, a disabled placeholder input, and a live-indicator chip — enough to deploy without faking functionality.
- Removed `AuthProvider` from `layout.tsx`. The bundled Supabase client init throws if env vars are missing; the homepage shouldn't depend on auth being wired before there's a need for it.

**Decisions**
- **Supabase cloud, not local Docker.** Identical for the contest's purposes, faster to set up, no Windows admin friction.
- **No social-URL ingestion.** Vercel serverless can't run `yt-dlp` cleanly, and TikTok / IG actively block server-side fetch. File upload plus three pre-analyzed sample chips gets a reviewer to the magic moment in under thirty seconds — better than a partially-working URL ingestion path.
- **Section-by-section staggered reveal**, not real token-level streaming. More reliable, easier to recover from a section-level failure, perceived as faster by users because each section animates in cleanly.
- **TBJ Moder swapped for Geist Italic.** The TBJ Moder distribution in the design bundle is marked demo-only and isn't licensed for production. Geist Italic carried the editorial weight just as well.

**Pushback**
- The first scaffolding pass produced a marketing scroll below the hero. I cut it. The page now ends at the input — same conviction as a Bloomberg terminal: if you're here, you're here to use it.

**Mid-session — AI-logs restructure.** The contest spec at [8xengineer.com/guidelines/ai-logs](https://8xengineer.com/guidelines/ai-logs) expects an `/ai-logs/` folder, not a root file. Moved `AI_LOG.md` → `ai-logs/SUMMARY.md`. Copied the raw Claude Code transcript as `ai-logs/*.jsonl`. Added `pnpm logs:sync` (wraps `scripts/sync-logs.sh`) with an `AIza/sk-/sk-ant-` redaction pass so future re-syncs are idempotent and secret-safe.

---

## Day 2 — May 14, 2026 · Visual system and working hero

**Goal:** Make the landing page feel like the product the brand promises — typography, motion, the upload affordance — before any backend exists.

**Work**
- Installed `framer-motion`.
- Wrote `lib/motion.ts` — single source of truth for easings, durations, and stagger values. Lifted directly from the design's `motion.jsx`: `cubic-bezier(0.2, 0.8, 0.2, 1)`, durations 120 / 220 / 480 ms, 40 ms stagger, 1400 ms score count-up. Forbidden: bounce, spring overshoot, parallax, glow pulses.
- Wrote `lib/sample-videos.ts` — typed metadata for the three demo clips. Day 3 plugs real `.mp4` URLs in.
- Built `components/marketing/Logo.tsx` (lime square + mono wordmark; reused by nav and the report shell).
- Rewrote `components/ui/button.tsx` from scratch. Replaced shadcn's six stock variants with two: `signal` (lime fill on ink) and `ghost` (line border, dim text). Square corners, no shadow, mono caps with `0.1em` tracking. The button is the brand atom; nothing else looked right with a default radius.
- Built `components/landing/UploadCard.tsx` — page-wide HTML5 drag-and-drop (no `react-dropzone` dependency), 100 MB UI cap, accepts `.mp4 / .mov / .webm`, lime border + "drop to upload →" while dragging.
- Built `components/landing/SampleVideoPicker.tsx` and `components/landing/Hero.tsx` (composes headline + upload + samples + receipt-style stats block, with staggered Framer reveals on mount).
- Slimmed `app/page.tsx` to `Navigation + Hero + Footer`.
- Updated `Navigation` to consume the new `Logo`.

**Cleanups**
- Deleted unused stock shadcn primitives (`alert-dialog`, `sidebar`, `sheet`, `input`, `separator`, `skeleton`, `tooltip`, `select`, `card`, `label`). They referenced variants our new `Button` doesn't ship. Only `button.tsx` remains in `components/ui/`. Primitives can be reintroduced with brand styling as actual needs arise.

**Decisions**
- **Page-wide drag-drop**, not drop-zone-only. Forgiving UX — drop anywhere on the page and it lands on the input.
- **Score button enables on file pick OR sample pick.** Clicking before backend wiring fires a toast that says "Day 3 wires this up." Honest about the seam; doesn't break the demo flow.
- **No "Pricing" nav link.** The brief doesn't include payments; nav reads `How it works · Examples · Sign in →` and ships without dead links.

**End-of-day deploy.** Supabase project created (`kjqwjilhxzeqkdydtsoj`). Vercel project created, env vars set, deployed to **[metric-fyi.vercel.app](https://metric-fyi.vercel.app)**. Smoke-tested headline, lime signal color, the three sample chips, the live counter, and the receipt footer — all three self-hosted fonts preloaded cleanly.

---

## Day 3 — May 14, 2026 · Upload pipeline and Row-Level Security

**Goal:** Take a file from disk to a `reports` row to Supabase Storage, end-to-end, with no service-role key anywhere.

**Work**
- Added Supabase CLI as devDep. Wired three scripts: `pnpm db:link`, `pnpm db:push`, `pnpm db:types`.
- Updated `supabase/config.toml` with project metadata and Storage `file_size_limit = "100MiB"`.
- `supabase/migrations/20260514010000_create_reports.sql` — the `reports` table with strict status/mime/size `CHECK` constraints, RLS enabled, an `auto-updated_at` trigger.
- `supabase/migrations/20260514010100_create_videos_bucket.sql` — `videos` bucket, 100 MiB cap, mime-restricted, public read, anon write.
- **Security model** locked: no service-role anywhere. All operations run as `anon` + RLS. Anon can `INSERT` pending reports (a `CHECK` enforces `user_id IS NULL`, `status = 'pending'`, `analysis IS NULL`). Anon **cannot** directly `SELECT` — reads go through a `fetch_report(p_id uuid)` `SECURITY DEFINER` function. Callers must already know the unguessable v4 UUID. Standard public-by-link pattern (Imgur, Pastebin, Cal.com).
- `lib/supabase/client.ts` (browser, anon) and `lib/supabase/server.ts` (server, anon, SSR cookie wiring kept ready for a future auth Day).
- `lib/schemas/report.ts` — Zod source of truth for the API contract: `UploadInitRequest`, `UploadInitResponse`, `ReportRow`.
- `lib/rate-limit.ts` — in-memory token bucket; 10 uploads per 10 minutes per IP. Per-lambda on Vercel (a documented limitation; the README notes a Vercel KV upgrade path).
- `app/api/upload/init/route.ts` — rate-limit → validate → insert pending row → return `{ id, storagePath }`. Never proxies file bytes (would hit Vercel's 4.5 MB body cap).
- `app/r/[id]/page.tsx` — server component, validates the UUID, fetches via the `SECURITY DEFINER` RPC, renders a placeholder with file metadata.
- Wired `Hero.tsx` — "Score it →" performs the real flow: `POST /api/upload/init`, then `supabase.storage.from('videos').upload()` client-direct (bypassing the body cap), then `router.push('/r/[id]')`. Toast progression: loading → success / error.

**Decisions**
- **No service-role key.** Anon + RLS only. One fewer secret to leak; a stronger engineering signal for reviewers; `pnpm test:rls` later codifies this as a regression.
- **Client-direct Storage upload.** Routes around Vercel's 4.5 MB request-body limit. The server only inserts the pending row.
- **Storage path = report ID** (`{uuid}.{ext}`). Trivial lookup; no separate filename mapping.
- **Public bucket.** The report page can use a plain `<video src>` — no signed-URL machinery. Same unguessable-UUID model as the rows.

---

## Day 4 — May 14, 2026 · Gemini analysis pipeline (the prompt day)

The "highest-risk" day per the original plan. The prompt landed on the first iteration.

**Work**
- `lib/ai/prompt.ts` — one `SYSTEM_INSTRUCTION` plus one `USER_INSTRUCTION` driving the brutally-honest voice, mandatory timestamps, the no-emoji rule, and a scoring rubric that uses the full 0–100 range. (See Appendix A for the iteration history.)
- `lib/ai/schema.ts` — Zod schema for the full `Analysis` shape (`score`, `verdict`, `breakdown`, `hook`, `pacing`, `thumbnail`, `caption`, `comparison`, `trending`) **and** an OpenAPI-subset JSON schema for Gemini's `responseSchema` parameter. Both kept in lock-step; the JSON schema is the first line of defence, Zod is the safety net.
- `lib/ai/gemini.ts` — thin REST wrapper, no SDK. Two entry points: `analyzeInline` (synchronous; used in production) and `analyzeStreamingInline` (parked — SSE chunking from Gemini wasn't reliable enough to ship).
- `scripts/test-analyze.ts` — prompt iteration harness against `tests/videos/`. First live run on the user's video: 34 s, 5,217 tokens, schema-valid JSON on the first try, verdict *"The hook is punchy but the middle section drags through a UI tutorial that feels like homework."* Score 48.
- `app/api/analyze/[id]/route.ts` — Node runtime (`maxDuration = 60`, the Hobby ceiling), idempotent, rate-limited 5 per 10 min per IP, downloads from Supabase Storage server-side, calls Gemini, persists via SECURITY DEFINER RPCs.
- `supabase/migrations/.._analyze_rpc.sql` — three RPCs: `mark_analyzing`, `mark_failed`, `save_analysis`. Each enforces the legal state transition inside the function body. Anon still has no `UPDATE` policy on `reports`; these RPCs are the only path.
- `components/report/ReportView.tsx` v1 plus `components/report/PendingClient.tsx` — the report page now triggers analysis on mount and shows a shimmer skeleton with a live elapsed counter during the ~30 s wait.
- Switched the model to `gemini-flash-latest` after discovering `gemini-2.0-flash` had been moved to paid-only since plan creation. Documented as preview-tracking in the README.
- Mid-day prompt tightening: banned hallucinated track names. Audio recommendations are now mood / genre descriptors ("minimalist tech-focused pulses with clean digital clicks"). The creator matches a real sound from TikTok's library themselves. No invented song titles.

**Decisions**
- **No service-role in the analyze route either.** Status transitions go through SECURITY DEFINER RPCs — one consistent security posture across all writes.
- **Idempotent analyze endpoint.** Calling `/api/analyze/[id]` twice doesn't double-spend Gemini; the second call returns the existing `ready` row.
- **`gemini-flash-latest` alias over a pinned version.** Tracks Google's current default and documents the preview-tracking explicitly.

**End of Day 4.** End-to-end live: drop an `.mp4` → 18.6 s on Vercel → the v1 report renders with a brutally-honest verdict, specific timestamps, three ranked rewrites, real cohort comparison, and mood-based audio recommendations.

---

## Day 5 — May 14, 2026 · Visible reasoning and the unified scrubber

**Goal:** Differentiator #2 — make every claim in the report point at the moment in the video that proves it. Two-way binding between the body copy and the timeline.

**Work**
- `contexts/report-context.tsx` — shared state: video ref, `seekTo(t, citation?)`, `activeCitationId`, the analysis JSON. The single source of truth for report-page interactivity.
- `components/report/VideoPlayer.tsx` v1 — native HTML5 controls plus a separate annotation strip below. **The first version was wrong:** two parallel rails read as two disconnected timelines.
- VideoPlayer v2 — a single custom scrubber. Native controls hidden. Playback fill, playhead, hook `landsAt` dot, pacing-cut ticks, dead-air red bars, and the best-frame blue dot all share one horizontal coordinate system. Click anywhere → seek. SPACE plays/pauses; ← / → step seconds. Aspect ratio auto-detected after `loadedmetadata`.
- `components/report/TimestampChip.tsx` — small clickable pill rendered inline anywhere in the body. Click any chip → video seeks → matching marker on the scrubber pulses for 1.6 s. Two-way binding everywhere.
- Updated `ReportView` so every timestamp display routes through the chip — hook timestamp, each pacing cut, each dead-air range, the thumbnail best-frame.

**Decisions**
- **One unified rail beats two.** The whole "visible reasoning" claim depends on the user reading body and timeline as the same artefact.
- **Two-way binding by default.** Chip click and marker click run the same code path.
- **Video stays mounted across `pending → ready`.** The provider wraps both states, so anyone who scrubs during analysis keeps their playback position when the report lands.

---

## Day 6 — May 14–15, 2026 · Report v2 and the What-If simulator

Pulled forward from Day 9 after a second design handoff arrived complete enough to build against. Building once is cheaper than building twice.

### Stage 1 — Report v2 layout (full redesign)

- `lib/ai/derive.ts` — pure display helpers: `deriveMarkers`, `deriveFrames`, `pickIndex`, `topLiftDisplay`, `deriveAudioMatches`, `deriveVsMedian`, later `derivePostTime`. Display logic decoupled from schema; mutable separately.
- `components/report/atoms.tsx` — `Watermark`, `MonoTag`, `Pill`, `AppliedBadge`, `btnStyle`, `fmtTime`. Reused across every section.
- Rewrote `VideoPlayer.tsx` as `VideoSection` — video + moments list side-by-side on desktop, stacked on mobile, with the unified scrubber and frame-thumb strip below.
- Rewrote `ReportView.tsx` as the v2 orchestrator — Hero (huge score + breakdown bars + cohort comparison), four FIX sections numbered 01–04 with giant transparent watermark numerals, `ApplyCTA`, `Trending`. Mobile-first responsive via `md:` breakpoints — one component, not two.

### Stage 2 — Real frame extraction (differentiator #2, the visible part)

- `hooks/useVideoFrames.ts` — hidden `<video crossOrigin="anonymous">`, seeks through each requested timestamp, paints to an offscreen canvas, emits JPEG data URLs. Verified the public bucket sends `Access-Control-Allow-Origin: *` so canvas reads stay untainted.
- `FixThumbnail`'s `CURRENT` / `PROPOSED` boxes now render real video stills with a hot/good color wash preserved as a screen-mode overlay so the issue/strength encoding still reads.

### Stage 3 — Shareable report (differentiator #5)

- `app/r/[id]/opengraph-image.tsx` — Node-runtime image route, fetches via `fetch_report`, renders a 1200×630 PNG with score + verdict + category + brand. Cached by Vercel edge.
- First deploy 500'd: `fs.readFile` of `public/fonts/ClashDisplay-Variable.ttf` failed because Vercel doesn't bundle `public/` into serverless function output. Switched to a system-font stack — image renders cleanly; the OG image is the only surface without Clash Display.
- `components/report/ShareControls.tsx` — `↗ COPY LINK` and `↗ TWEET` in the status sub-nav. Twitter intent prefills text + URL, truncates the verdict to fit the 280-char budget.
- `generateMetadata` exports per-report `title`, `description`, `openGraph`, and `twitter: summary_large_image`.

### Stage 4 — Pre-analyzed sample chips (differentiator #3, the no-signup demo path)

- `scripts/seed-samples.ts` — uploads bytes through the same anon path as the upload route, inserts a pending row, triggers `/api/analyze/[id]` on the live deployment. Two Creative-Commons clips sourced (a Cloudinary dog clip, a `test-videos.co.uk` BBB animation).
- `lib/sample-videos.ts` — three real UUIDs replacing the Day 2 stubs.
- `SampleVideoPicker.tsx` — chips are now `<Link prefetch>` to the real `/r/[id]` URLs. Removed the staged-state plumbing; only file uploads need that path.

### Stage 5 — What-If simulator (the wow moment)

- Added `applied` state to `ReportContext` — four booleans, `toggleApplied(key)`, `resetApplied()`, cached `appliedCount`.
- `WhatIfSimulator.tsx` replaces the static `ApplyCTA`. Animated score (Framer `animate()` with an `onUpdate` callback for fluid count-up), 2×2 toggle grid, morphing subtitle, a TIER-1 badge that scale-pops when all four toggles fire, a `RESET` link, and an `↗ COPY CHECKLIST` button that exports the full re-record plan as plain text.
- Coordinated section effects — when a toggle is on its FIX section gets a faint lime gradient wash, a 3 px lime accent strip, and an `✓ APPLIED` pill in the rail. `FixCaption` swaps the entire body (the original strikes through, the picked rewrite swoops in as ~28 px hero text). `FixThumbnail` fades `CURRENT` to 30 % grayscale and scales `PROPOSED` up slightly.

### Stage 6 — Cascading reveal + post-time badge

- Each top-level section in `ReportView` wrapped in a `motion.div` with `staggerChildren: 0.36`. Sections fade-up sequentially over ~3.2 s after analysis lands. This is the Day 4 "streaming reveal" differentiator made visible — client-orchestrated, honestly framed.
- `POST · TUE 6PM` lime-bordered badge in the Hero meta row. Maps `inferredCategory` to a peak-engagement window via a regex table. (Day 9 replaces this with a Gemini-driven recommendation; see below.)

**Decisions**
- **Pulled Day 9 polish into Day 6.** The second design handoff was complete enough; postponing it would have meant building the same UI twice.
- **Frame extraction client-side, not server.** No ffmpeg, no thumbnail bucket, runs after page load, real frames. Acceptable for files under 100 MB.
- **The toggle grid IS the checklist.** Adding a separate "re-record checklist" section would have duplicated state. One `↗ COPY CHECKLIST` button exports it when wanted.

---

## Day 7 — May 15, 2026 · The cut decision (auth + history)

The original plan had server-side auth and a `/history` page on Day 7. **Cut entirely.**

**Reasoning**
- The "no-signup demo path" was already differentiator #3 and works end-to-end.
- Auth would have added four-plus hours of real work: email confirmation flow, the `/history` page itself with proper RLS update policies, session management, the "save this report" CTA wiring, the inevitable edge cases.
- A reviewer doing a 30-second demo doesn't see history — they see the magic moment and move on.
- `lib/supabase/server.ts` already has the SSR cookie wiring; auth is a future addition, not a redesign.

Documented in the README under "Deliberate scope cuts." Day 8 later added per-device localStorage history — same surface area in the UI, no backend, no auth tax.

---

## Day 8 — May 15, 2026 · RLS regression, mobile pass, security audit, schema hardening

Day 8 ran in two waves and is the heaviest single day in the log.

### Wave 1 — RLS regression test and README polish

- `scripts/test-rls.ts` — 10-check regression test against the live Supabase project, run as anon (publishable key):
  1. `SELECT *` returns zero rows (no anon `SELECT` policy on `reports`)
  2. `INSERT` with `status='ready'` blocked (PG 42501)
  3. `INSERT` with `user_id` set blocked
  4. `INSERT` with `analysis` populated blocked
  5. `UPDATE` returns zero rows affected (no `UPDATE` policy)
  6. `DELETE` returns zero rows affected (no `DELETE` policy)
  7. `fetch_report(random uuid)` leaks nothing
  8. `fetch_report(known uuid)` returns the right row
  9. Storage rejects non-video mime
  10. Storage rejects anon delete
- All 10 pass on first run. Wired as `pnpm test:rls` for ongoing regression.
- Rewrote the README — full feature map to the brief, the five differentiators with file references, stack table, run-locally section, project tree, architecture decisions, security decisions, deliberate scope cuts, credits.

### Wave 2a — Nav + modals + per-device history

Three desktop UX gaps surfaced before the mobile pass:
- The `Sign in →` nav link pointed at an auth flow we'd cut. Removed.
- `How it works` and `Examples` were non-clickable `<span>`s. Promoted to modal-opening buttons with a three-step explainer and a three-sample card grid.
- Added a third `HISTORY` button + per-device `localStorage` history via a `HistorySync` client component.

Commits `d601431` (modals) and `c715405` (history).

### Wave 2b — The `HistorySync` bug (caught by systematic debugging)

Ran `/debug` → `/code-review` → `/systematic-debugging` as a pre-submission QA pass. One real bug found (10/10 RLS green; five minor stylistic findings noted, none acted on):

**Symptom:** for any report SSR'd in `pending` state, the localStorage entry stayed permanently `pending` even after `PendingClient` set the analysis on context.

**Root cause:** `HistorySync` was rendered outside `<ReportProvider>` and received `status` as an immutable SSR prop. Its props never changed, so its `useEffect` never re-fired.

**Fix** (`768a6ea`): moved `HistorySync` inside the provider and switched it to read `analysis` from context. Now reacts to both SSR-ready and PendingClient-landed cases identically.

### Wave 2c — Security audit against the Vibe-Coding checklist

Walked every item of [mdsaban's Vibe Coding Security Checklist](https://gist.github.com/mdsaban/29ffbb6974ce2fa9acc37415b9a4b684):

| # | Item | Status |
|---|---|---|
| 1 | Leaked secrets | ✅ `git grep` clean. `.env.local` gitignored. AI log sync redacts `AIza/sk-/sk-ant-` patterns. |
| 2 | Input sanitisation | ✅ Zod on every API boundary. No raw HTML injection paths, no `eval`, no raw SQL string interpolation. |
| 3 | Rate limiting | ✅ Token bucket on `/api/upload/init` (10/10m/IP) and `/api/analyze/[id]` (5/10m/IP). |
| 4 | Auth | ✅ Supabase-managed. No custom flow. RLS-only enforcement. |
| 5 | API versioning | ⚠️ Scope-cut — `/api/upload/init`, not `/api/v1/...`. Single consumer; documented. |
| 6 | File uploads | ✅ Four enforcement layers: client → Zod → DB `CHECK` → Storage bucket policy. |
| 7 | Dependencies | ❌→✅ `pnpm audit` flagged **23 CVEs in Next.js** (9 high — SSRF, DoS, middleware bypass, CSRF on Server Actions). Bumped 16.0.10 → 16.2.6 in `7140e57`. Post-bump: one transitive `postcss` XSS, build-time-only, non-exploitable. |

### Wave 2d — Mobile pass (six layout fixes, two commits)

The user's iPhone screenshots surfaced bugs invisible on desktop. Fixed across two commits:

**`f17452a` — first round**
- Hero `font-size` lower bound 56 → 40 px so the headline doesn't force one-word-per-line at 375 px.
- Hero padding `px-12` → `px-6 md:px-14 lg:px-20` (was eating 96 of 375 px in horizontal padding).
- `UploadCard` switched to `flex-col md:flex-row` — the `SCORE IT →` button was overflowing off-screen right. Stacks below the input on mobile as a full-width tap target.
- Added `min-w-0` on the `flex-1` truncate parent so the placeholder actually ellipses.
- `NavButton` got `whitespace-nowrap` — "HOW IT WORKS" was breaking onto two lines.
- `Toaster` moved from `top-center` to `bottom-center` — iOS Safari's URL bar was obscuring upload-progress toasts.
- Added an indeterminate lime progress bar across the top of `UploadCard` while `busy=true` so users get in-page feedback even if a toast is occluded.

**`524a4fa` — second round**
- Nav padding normalised to `px-6 md:px-14 lg:px-20` to match every other surface. The 8 px mismatch between Nav and the report sub-nav was causing the alignment glitch.
- `useVideoFrames` rewritten for iOS Safari: wait for `canplay` (readyState 3), not just `loadedmetadata`, before seeking; prime with a `play() / pause()` cycle; attach the hidden `<video>` to `document.body` (off-screen) instead of leaving it detached; 1.5 s seek-timeout fallback. iOS Safari's documented seek quirk was making `FixThumbnail`'s `CURRENT` / `PROPOSED` boxes stick on gradient placeholders forever.
- Play overlay + bottom-bar play/pause replaced with hand-tuned inline SVG triangles. The Unicode `▶` was rendering as a legacy emoji on iOS and was off-center via the brittle `paddingLeft: 6` optical correction.
- `FixCaption` had an `AnimatePresence mode="wait"` swap between two layouts ~120 px apart in height. Every caption toggle jolted the page below it. Removed the swap; toggling now changes only opacity and label text.

### Wave 2e — Schema hardening (the failure-cascade fix)

The user's phone upload returned `ANALYSIS FAILED` with `hook.alternatives.0.predictedLift → Number must be less than or equal to 60`. My Zod schema capped `predictedLift` at 60; Gemini returned 65. The entire analysis got marked `failed`.

Fixed in `c583ca7` (`max(60) → max(100)`). The user correctly pushed back: *"similar type of different error can also occur."*

`485d3a1` audited every constraint in the schema and hardened the lot:

- **Numbers** — every tight `.max()` replaced with `.transform()` clamping into range. `Timestamp` clamps to 7200 s. `Score100` clamps + rounds. Lifts clamp to 100. `vsCategoryMedian` clamps to ±100.
- **Strings** — dropped 15 separate `.min(N)` requirements. Empty strings still fail (`min(1)`), but no more "this fix description is only 18 chars, the prompt asked for 20+" rejections.
- **Arrays** — relaxed exact `.length(3)` on hook alternatives + caption rewrites to `.max(10).transform(slice(0, 3))`. Same pattern for cuts / deadAir / audio / hashtags.
- **Enums** — dropped the `tone: enum([4 values])` constraints on hook + caption rewrites. The UI just displays whatever label Gemini picks.
- **Regex** — `tag.regex(/^#/)` reject → `transform(s => s.startsWith('#') ? s : '#'+s)`. Auto-prefix instead of fail.
- **Gemini JSON schema side** — `minimum / maximum` on all numeric fields and `minItems / maxItems` on all arrays as a first line of defence. Gemini constrains during generation; Zod is now last-resort safety net.

**Net effect:** an analysis can fail validation only if Gemini returns *fundamentally malformed* JSON (missing required fields, wrong types). Any creative overshoot or undershoot is silently absorbed. Verified by re-running `pnpm test:analyze` against all three sample videos.

---

## Day 9 — May 15, 2026 · Submission hardening (retry flow + three credibility fixes)

The final working day. Two distinct workstreams: a recoverable-failure path so a single bad analysis doesn't ruin a user's session, and three prompt-quality fixes for behaviour that was undermining trust in the score itself.

### Workstream 1 — Retry-from-failed

Before today, a report that hit `failed` state was terminal — the user had to re-upload the entire video to try again. Built a recovery path:

- `supabase/migrations/20260515200000_reset_failed_rpc.sql` — new `reset_failed_report(p_id uuid)` SECURITY DEFINER RPC. Transitions `failed → pending`, clears `analysis` and `error_message`, raises if the row isn't in `failed`. Granted to `anon` and `authenticated`.
- `components/report/RetryButton.tsx` — client component on the `FailedState` view. Calls the RPC, then re-triggers `/api/analyze/[id]`, then `router.refresh()`. Gracefully degrades — if the migration hasn't been applied yet (development case), it toasts a clear message rather than 500-ing.
- `app/r/[id]/page.tsx` — `FailedState` now takes an `id` prop and renders `<RetryButton />` with brief explanatory copy.

Shipped in `53caeb8`. Migration applied to the live database the same day; the button is functional end-to-end.

### Workstream 2 — Three credibility bugs in the analysis output

The user identified three patterns that made different videos look templated even though the rest of the report varied correctly:

1. **Scores always landed at 28, 38, or 48.** No quantization in our code — this was Gemini snapping to band-ceiling integers from the scoring rubric.
2. **`POST · ...` badge always showed `TUE 6PM`.** `derivePostTime`'s regex table fell through to a hard-coded default for most categories.
3. **`vs MEDIAN` and `vs CATEGORY` always looked proportional.** `deriveVsMedian` was literally `Math.round(vsCategory * 0.45)` — the two numbers couldn't move independently.

All three converged on one root insight: too much downstream derivation, not enough first-class reasoning from the model. The fix moved each into the model's job.

**Prompt** (`lib/ai/prompt.ts`)
- Forbade scores ending in 0 or 5 and called out the band-ceiling anchor pattern (28 / 38 / 48) explicitly.
- Required the score equal a weighted blend of the breakdown: `hook × 0.35 + pacing × 0.25 + caption × 0.25 + thumbnail × 0.15`, with ±3 for editorial judgement.
- Added an `OPTIMAL POST TIME` section requiring `day`, `time`, and a one-sentence `why` reasoned against the actual video content.
- Required `vsPlatformMedian` and `vsCategoryMedian` to be reasoned independently — "don't just halve one to get the other."

**Schema** (`lib/ai/schema.ts`)
- New `vsPlatformMedian` on `Comparison`, marked `.optional()` for back-compat with pre-existing reports.
- New `optimalPostTime: { day, time, why }`, also `.optional()`.
- Both fields added to the Gemini-side JSON schema as `required` so new analyses always emit them.
- Defensive transforms preserved across the board — clamping, uppercasing, trimming.

**Server-side safety net** (`app/api/analyze/[id]/route.ts`)
- After the Zod parse, compute the weighted-blend score the prompt asks for. If `|model_score - weighted| > 8`, overwrite `score` with the weighted value before saving. Belt-and-suspenders: the prompt asks the model to derive it, the server enforces that derivation if the model still drifts.

**Report layout** (`components/report/ReportView.tsx`)
- Hero comparison row reads from `analysis.comparison.vsPlatformMedian` and `analysis.optimalPostTime` when present, falling back to the legacy derivers for the three pre-existing sample reports.
- Tooltips added to each label clarifying what cohort is being compared.

**Verification.** Re-ran `pnpm test:analyze` against the three test videos. Live Gemini responses on the new prompt:

| Video | Old behaviour | New result |
|---|---|---|
| `01-user.mp4` (app showcase) | score 28 / 38 / 48, TUE 6PM | **53**, **THU 6PM**, vs PLATFORM **+4** / vs CATEGORY **−8** |
| `02-dog.mp4` (pet) | score 28 / 38 / 48, TUE 6PM | **44**, **SUN 10AM**, vs PLATFORM **+4** / vs CATEGORY **−12** |
| `03-bbb.mp4` (nature) | score 28 / 38 / 48, TUE 6PM | **34**, **SUN 10AM**, vs PLATFORM **−31** / vs CATEGORY **−22** |

Three distinct, non-round scores. Drift from the weighted breakdown: −2, 0, 0 — the model is following the new derivation rule on its own; the server safety net hasn't needed to fire. Three different post-windows, each with reasoning attached. `vs PLATFORM` and `vs CATEGORY` no longer proportional.

Shipped in `78a4951`. `pnpm test:rls` re-run: still 10/10 green.

---

## Status at submission

Every brief feature shipped:

| Brief feature | Where it lives | Status |
|---|---|---|
| Video upload | `components/landing/UploadCard.tsx` | ✅ drag-drop, 100 MB UI cap, 20 MB analysis cap |
| Virality score (0–100) + breakdown | Hero in `components/report/ReportView.tsx` | ✅ Score + 4 breakdown bars |
| Hook analysis (first 3 s) | `FixHook` section | ✅ `landsAt`, issue, fix, 3 ranked alternatives |
| Caption optimisation | `FixCaption` section | ✅ Strikethrough dead-words + 3 ranked rewrites |
| Competitor / cohort comparison | Hero meta row | ✅ `vs PLATFORM / vs CATEGORY / CEILING` |
| Trending audio + hashtags | `Trending` section | ✅ Mood / genre descriptors + 5 hashtags |
| **Bonus** Thumbnail rating | `FixThumbnail` section | ✅ Real-frame `CURRENT` vs `PROPOSED` |
| **Bonus** What-If simulator | `WhatIfSimulator.tsx` | ✅ Toggle grid + animated score morph + copy checklist |
| **Bonus** Retry from failed | `RetryButton.tsx` + `reset_failed_report` RPC | ✅ Recoverable failures |

All five differentiators live. Security audit at one non-exploitable build-time vuln. Schema absorbs any reasonable Gemini output without failing. Mobile-responsive across iOS Safari + Android Chrome. RLS regression 10/10. Repository public. Live URL stable.

---

# Appendix A · Prompt engineering — the iterations behind `lib/ai/prompt.ts`

The single most-edited file in the project. Iteration history, in order:

**Iteration 1 (Day 4) — Baseline.** First draft of `SYSTEM_INSTRUCTION` + `USER_INSTRUCTION`. Established: senior-editor voice; mandatory timestamps on every claim; no emojis ever; the 0–100 rubric in five bands; "be willing to score low — a 42 with sharp fixes beats a 73 with hedged language." Schema-valid JSON on the first live run. Verdict tone landed correctly on the first try.

**Iteration 2 (Day 4, late) — Anti-hallucinated track names.** First runs surfaced specific song titles in the trending-audio section ("Espresso by Sabrina Carpenter"). Gemini had no real trend data; these were confabulations. Rewrote the `TRENDING` instructions to demand mood / genre descriptors only ("tension-building cinematic synth with low-end drum hits"). Added the explicit instruction *"DO NOT invent specific track names, artists, or song titles — that data isn't available to you."* Audio recs from this point onward never invent track titles.

**Iteration 3 (Day 4, late) — Verdict-length discipline.** Initial verdicts ran to two-to-three sentences and lost punch. Tightened the instruction to "one sentence, 12–20 words, editorial pull-quote tone" and seeded three concrete examples. Verdict length has been stable since.

**Iteration 4 (Day 5) — Citation discipline.** Found a few `fix` strings that named no timestamp. Added a hard requirement to the system instruction: *"Generic advice ('strengthen your hook') is forbidden and will fail validation."* No untimed fixes since.

**Iteration 5 (Day 8) — Resilience-aligned schema constraints.** Not a prompt edit per se but a coupling: the Gemini-side `responseSchema` (`ANALYSIS_RESPONSE_SCHEMA` in `schema.ts`) got `minimum / maximum` on all numeric fields and `minItems / maxItems` on all arrays. Gemini now constrains itself during generation; the Zod layer is a last-resort net.

**Iteration 6 (Day 8) — `predictedLift` re-anchoring.** The first failure cascade fixed a too-tight `max(60)` cap. The prompt rewrite was small — clarifying that lifts are a percentage "from 0 to 100" — but it eliminated the model's habit of producing values just above 60.

**Iteration 7 (Day 9) — Score derivation rule.** The most consequential prompt edit since Day 4. The model had been anchoring scores to band-ceiling integers (28 / 38 / 48). Added an explicit derivation formula — `score ≈ round(hook × 0.35 + pacing × 0.25 + caption × 0.25 + thumbnail × 0.15)` — plus a paragraph explaining *why* certain digit patterns (multiples of 10, repeated 28 / 38 / 48) signal anchoring rather than analysis. Backed up with a server-side enforcement check (`|score − weighted| > 8` snaps the score back). Verified on three videos: scores now 34 / 44 / 53.

**Iteration 8 (Day 9) — `optimalPostTime` with `why`.** Replaced a server-side regex table (`derivePostTime`) that defaulted everything to `TUE 6PM`. The model now reasons directly: `day`, `time`, and a one-sentence `why` against the specific video. Different categories → different windows, with reasoning attached. Eight pre-existing examples seeded in the prompt to keep variety.

**Iteration 9 (Day 9) — Independent comparison deltas.** Previously `vsCategoryMedian` came from the model and `vs MEDIAN` was a derived `× 0.45` split. Made `vsPlatformMedian` first-class in the schema and required the model to reason about it separately from `vsCategoryMedian`. Live runs produce independent signs and magnitudes (one example: `vs PLATFORM +4` / `vs CATEGORY −8`).

The current prompt at submission time:

- ~70 lines including system + user instructions.
- Backed by a 405-line schema file that enforces every contract.
- Tested by `pnpm test:analyze` against three real videos (`tests/videos/01-user.mp4`, `02-dog.mp4`, `03-bbb.mp4`) with outputs persisted to `tests/outputs/*.json` for diffing.
- Re-runs after every prompt edit are mandatory — no prompt change ships without three successful test-analyze runs on the live Gemini endpoint.

---

# Appendix B · Test rigs that kept the AI honest

Two harnesses, run as standard scripts, treated as part of the development loop rather than CI nice-to-haves.

### `pnpm test:analyze` — prompt iteration

`scripts/test-analyze.ts` reads `tests/videos/*.mp4`, calls `analyzeInline()` against the real Gemini endpoint, validates the response with the production Zod schema, and dumps the full JSON to `tests/outputs/<name>.json`. Console output highlights the headline number, the breakdown, the verdict, the post-time recommendation, and the drift between model score and weighted-blend score.

Used after every change to `lib/ai/prompt.ts`, `lib/ai/schema.ts`, and `lib/ai/gemini.ts`. Caught:
- The `predictedLift` cap mismatch (Day 8).
- The score anchoring pattern (Day 9).
- The post-time default fall-through (Day 9).
- One Zod parse failure during the Day 8 schema audit.

### `pnpm test:rls` — security regression

`scripts/test-rls.ts` runs against the live Supabase project, authenticated as `anon` (publishable key only — no service-role anywhere). Ten checks covering `SELECT / INSERT / UPDATE / DELETE` policies, the `fetch_report` SECURITY DEFINER function, and Storage policies. Pass criterion: all ten green.

Used as the gate on every commit touching `supabase/migrations/`, `lib/supabase/*`, or any API route. The fact that it has never failed since being written is the point — the security model has held across nine days of iteration.

Both rigs are documented in the README's "Run locally" section and runnable by reviewers.

---

*End of log. Companion `.jsonl` files preserve every Claude Code turn — including the ones that led nowhere.*
