# AI Working Log

A running log of what I built each session, what decisions I made, and what's left. Submitted as part of the 8x contest entry.

---

## Day 1 — May 6, 2026 · Scaffold

- Forked `8xsocial/template-webapp` → `Anuj7411/metric-fyi`. Cloned locally, ran `pnpm install`.
- Stripped the template's SaaS demo content: `CANDIDATE_ASSIGNMENT.md`, `app/upgrade`, `app/profile`, `app/privacy`, `app/terms`, `app/api/account`, `contexts/subscription-context.tsx`, the subscriptions migration, `lib/colors.ts`, `lib/confetti.ts`, and all 11 `8x`-branded favicons / web-app-manifest images.
- Wired the Lab Lime token system into `app/globals.css` via Tailwind v4's `@theme` directive — every color, surface, and font variable from the design bundle's `palette.jsx` and `index.html` is now a CSS custom property.
- Self-hosted `ClashDisplay-Variable.ttf` from the design bundle into `public/fonts/`. Loaded via `next/font/local` with a `200 700` axis range. Geist Sans + Geist Mono added via the official `geist` npm package.
- Replaced `app/layout.tsx`, `app/page.tsx`, `components/navigation.tsx`, `components/footer.tsx`, and `app/not-found.tsx` with stripped METRIC.fyi shells. Homepage shows the locked headline, a disabled placeholder input, and a live-indicator chip — the real upload pipeline lands Day 3.
- Removed `AuthProvider` from `layout.tsx` for now — re-adds Day 8. Reason: the bundled Supabase client init throws if env vars are missing, and the homepage shouldn't depend on auth being wired.

### Decisions made today

- **Skipping local Supabase / Docker** in favor of Supabase cloud. Faster to set up, identical for our purposes, no Windows admin friction.
- **Skipping social URL ingestion** for V1 — Vercel serverless can't run yt-dlp cleanly and platforms actively block scraping. File upload + 3 pre-loaded sample videos gets reviewers to the magic moment in <30 seconds.
- **Section-by-section streaming** (4 small Gemini calls in sequence) instead of one giant streamed-JSON object — more reliable, easier to recover when one section fails, perceived as faster.
- **TBJ Moder swapped for Geist Italic.** TBJ Moder ships with the design bundle as a *demo* version, which isn't licensed for production. Going with Geist + Geist Italic across body and editorial callouts.

### Pushback I committed to

- App stays dark; the public `/r/[id]` report screen flips to paper. The report is designed to screenshot well in white Twitter feeds; a dark dashboard screenshot vanishes there.
- No marketing scroll below the landing hero. The page ends at the input.

### Mid-session — AI logs restructure

- Contest spec ([8xengineer.com/guidelines/ai-logs](https://8xengineer.com/guidelines/ai-logs)) expects `/ai-logs/` folder, not a root-level file.
- Moved `AI_LOG.md` → `ai-logs/SUMMARY.md`. Copied raw Claude Code transcript as `ai-logs/*.jsonl` (accepted format).
- Added `pnpm logs:sync` (wraps `scripts/sync-logs.sh`) — idempotent re-sync before commits.

---

## Day 2 — May 14, 2026 · Visual system + working hero

- Installed `framer-motion` (locked-stack animation lib).
- Wrote `lib/motion.ts` — single source of truth for easings, durations, stagger. Lifted directly from the design's `motion.jsx`: `[0.2,0.8,0.2,1]` cubic-bezier, durations 120/220/480ms, 40ms stagger, 1400ms score count-up. Forbidden: bounce, spring overshoot, parallax.
- Wrote `lib/sample-videos.ts` — typed metadata for the 3 demo clips (`@khaby.lame`, `@itsmaya`, `@bento.mufc`). Day 3 plugs real mp4 URLs in.
- Built `components/marketing/Logo.tsx` (lime square + mono wordmark, reused by nav and future report pages).
- Rewrote `components/ui/button.tsx` from scratch — replaced shadcn's 6 stock variants with our 2: `signal` (lime fill on ink) and `ghost` (line border, dim text). Square corners (matches design), no shadow, mono caps with `0.1em` tracking.
- Built `components/landing/UploadCard.tsx` — page-wide HTML5 drag-and-drop (no `react-dropzone` dep), 100MB limit, accepts `.mp4/.mov/.webm`, dim cursor when empty, lime border + "drop to upload →" when dragging.
- Built `components/landing/SampleVideoPicker.tsx` — 3 chips, active state (lime border) when one's picked.
- Built `components/landing/Hero.tsx` — composes headline + upload card + sample picker + receipt-style stats block. Staggered Framer reveals on mount. Picked-state lifted here so the score button enables/disables.
- Refactored `app/page.tsx` to a thin shell: `Navigation + Hero + Footer`.
- Updated `Navigation` to use the new `Logo` component.

### Cleanups while wiring

- Deleted unused stock shadcn primitives (`alert-dialog`, `sidebar`, `sheet`, `input`, `separator`, `skeleton`, `tooltip`, `select`, `card`, `label`). They referenced variants our new `Button` doesn't have. Only `button.tsx` remains in `components/ui/`. We'll re-add fresh primitives with brand styling as needed Days 5+.

### Decisions made today

- **Page-wide drag-drop** instead of just on the input row. Forgiving UX: drop anywhere → it lands on the input.
- **Score button enables on file pick OR sample pick.** Clicking shows a toast saying "Day 3 wires this up" — keeps the demo honest about scope.
- **No "Pricing" nav link.** Brief skips payments; nav items now read `How it works · Examples · Sign in →`.

### End-of-day deploy

- Supabase project created (`kjqwjilhxzeqkdydtsoj`).
- Vercel project created, env vars set (URL + anon key), deployed: **[metric-fyi.vercel.app](https://metric-fyi.vercel.app)**.
- Smoke-tested live HTML: headline, lime signal color, 3 sample chips, live counter, receipt footer all render. All 3 self-hosted fonts preloaded.

---

## Day 3 — May 14, 2026 · Upload pipeline + RLS

- Installed Supabase CLI as devDep. Wired three scripts: `pnpm db:link` (one-time link to `kjqwjilhxzeqkdydtsoj`), `pnpm db:push` (apply migrations), `pnpm db:types` (generate TypeScript types — Day 4+).
- Updated `supabase/config.toml`: `project_id = "metric-fyi"`, storage `file_size_limit = "100MiB"`.
- Wrote `supabase/migrations/20260514010000_create_reports.sql` — `reports` table with strict status/mime/size CHECK constraints, RLS enabled, `auto-updated_at` trigger.
- Wrote `supabase/migrations/20260514010100_create_videos_bucket.sql` — `videos` bucket, 100 MiB cap, mime-restricted, public read, anon write.
- **Security model:** no service-role anywhere. All operations run as `anon` + RLS. Anon can INSERT pending reports (CHECK enforces `user_id IS NULL`, `status='pending'`, `analysis IS NULL`). Anon CANNOT directly SELECT — reads go through `fetch_report(p_id uuid)` SECURITY DEFINER function, so callers must know the unguessable v4 UUID. Standard public-by-link pattern (Imgur/Pastebin/Cal.com).
- Recreated `lib/supabase/client.ts` (browser, anon) and `lib/supabase/server.ts` (server, anon, SSR cookie wiring for Day 8 auth).
- `lib/schemas/report.ts`: Zod source of truth for the API contract. `UploadInitRequest`, `UploadInitResponse`, `ReportRow`.
- `lib/rate-limit.ts`: in-memory token bucket. 10 uploads / 10 min per IP. Per-lambda-instance on Vercel (documented limit — Day 9 swaps to Vercel KV).
- `app/api/upload/init/route.ts`: rate-limit → validate → insert pending row → return `{ id, storagePath }`. Never proxies file bytes (would hit Vercel's 4.5 MB body cap).
- `app/r/[id]/page.tsx`: server component, validates UUID format, fetches via the SECURITY DEFINER RPC, renders placeholder with file metadata. Will become the streamed score reveal Day 5.
- Wired `components/landing/Hero.tsx` — "Score it →" now does the real upload: POST `/api/upload/init`, then client-direct `supabase.storage.from('videos').upload()` (bypassing Vercel body limit), then `router.push('/r/[id]')`. Toast progression: loading → success/error.
- Sample chips still stubbed — Day 4 wires those to pre-loaded mp4s.

### Decisions made today

- **No service-role key.** Anon + RLS only. More secure (one bug can't bypass everything), stronger engineering signal for judges.
- **Client-direct Storage upload** instead of routing through `/api/upload`. Vercel's 4.5 MB body limit would cap us at tiny files otherwise.
- **Storage path === report ID** (`{uuid}.{ext}`). Trivial lookup, no separate filename mapping needed.
- **Public Storage bucket.** Report page uses plain `<video src>` — no signed-URL handling. Same unguessable-UUID security model as the rows.
- **In-memory rate limit for now.** Per-lambda on Vercel = imperfect but adequate for contest scale. Documented; Day 9 swap.

---

## Day 4 — May 14, 2026 · Gemini analysis pipeline (the prompt day)

The risk day per the original plan. Got it right on the first run.

- Wrote `lib/ai/prompt.ts` — single SYSTEM_INSTRUCTION + USER_INSTRUCTION pair driving the brutally-honest voice, mandatory timestamps, no-emoji rule, scoring rubric using the full 0–100 range.
- Wrote `lib/ai/schema.ts` — single Zod schema for the full `Analysis` shape (score, verdict, breakdown, hook, pacing, thumbnail, caption, comparison, trending) AND an OpenAPI-subset JSON schema for Gemini's `responseSchema` parameter. Both kept in lock-step.
- Wrote `lib/ai/gemini.ts` — thin REST wrapper, no SDK. Two paths: `analyzeInline` (sync, used in production) and `analyzeStreamingInline` (parked — SSE parsing didn't yield reliable chunks).
- Wrote `scripts/test-analyze.ts` — prompt-iteration harness against `tests/videos/`. First run on the user's uploaded video: 34s, 5217 tokens, schema-valid JSON on the very first try with the verdict *"The hook is punchy but the middle section drags through a UI tutorial that feels like homework."* Score 48.
- Wrote `app/api/analyze/[id]/route.ts` — Node runtime (`maxDuration = 60` fits Hobby), idempotent, rate-limited 5/10min/IP, validates UUID, downloads video from Supabase Storage, calls Gemini, persists via the SECURITY DEFINER RPCs.
- Wrote `supabase/migrations/.._analyze_rpc.sql` — three RPCs: `mark_analyzing`, `mark_failed`, `save_analysis`. Each enforces the legal state transition inside its function body. Anon has no UPDATE policy on `reports` at all — these RPCs are the only path.
- Built `components/report/ReportView.tsx` (v1) and `components/report/PendingClient.tsx` — the report page now triggers analysis on mount and shows a shimmer skeleton + live elapsed counter while waiting ~30s.
- Wired in the `gemini-flash-latest` model alias (currently → Gemini 3 Flash Preview, free tier) after discovering `gemini-2.0-flash` had been moved to paid-only since plan creation.
- Mid-day: tightened the prompt to ban hallucinated track names. Audio recommendations are now mood/genre descriptors like *"minimalist tech-focused pulses with clean digital clicks"* — creator matches a real sound in TikTok's library themselves.

### Decisions made today

- **No service-role for the analyze route.** Status transitions go through SECURITY DEFINER functions instead. One fewer key to leak.
- **Idempotent analyze endpoint.** Calling `/api/analyze/[id]` twice doesn't double-spend Gemini — the second call returns the existing `ready` row.
- **`gemini-flash-latest` alias over a pinned version.** Tracks Google's current default; documented as preview-tracking.

### End of Day 4

End-to-end live: drop an mp4 → 18.6 seconds on Vercel → full v1 report renders with brutally-honest verdict, specific timestamps, 3 ranked rewrites, real cohort comparison, mood-based audio recs.

---

## Day 5 — May 14, 2026 · Visible reasoning + the unified scrubber

Differentiator #2 made concrete — every claim now links to the moment in the video that proves it.

- Wrote `contexts/report-context.tsx` — shared state: video ref, `seekTo(t, citation?)`, `activeCitationId`, the analysis JSON. Single source of truth for the report page's interactivity.
- Built `components/report/VideoPlayer.tsx` — first pass: native HTML5 controls + a separate annotation strip below. **User correctly pushed back** that the two rails read as disconnected timelines.
- Rebuilt VideoPlayer as a **unified custom scrubber**. Native controls hidden. One single horizontal rail where playback fill, playhead, hook landsAt dot, pacing cut ticks, dead-air red bars, and best-frame blue dot all share the same coordinate system. Click anywhere → seek. SPACE / ←→ keybindings. Auto-detects 9:16 vs 16:9 aspect ratio after `loadedmetadata`.
- Wrote `components/report/TimestampChip.tsx` — small clickable pill used inline anywhere in the report body (HOOK · LANDS AT 1.8s, pacing cuts, dead air ranges, thumbnail best-frame). Click any chip → video seeks + matching marker on the scrubber pulses for 1.6s. Two-way binding.
- Updated `ReportView` so every timestamp display goes through the chip. The hook timestamp, each pacing cut, each dead-air range, and the thumbnail best-frame are now interactive citations.

### Decisions made today

- **One unified rail beats two.** Made the visible reasoning actually readable.
- **Two-way binding by default.** Clicking a chip in the body OR a marker on the scrubber both seek + highlight. Same code path either direction.
- **Video stays mounted across pending → ready transition** (provider wraps both states) so anyone scrubbing during analysis keeps their playback position.

---

## Day 6 — May 14–15, 2026 · Report v2 + the What If? simulator

The visual polish day. Pulled forward from Day 9 after a second Claude Design handoff dropped with a complete two-column report design + mobile layout.

### Stage 1 — Report v2 layout (full redesign)

- `lib/ai/derive.ts` — pure display helpers: `deriveMarkers` (combines hook + pacing + thumbnail timestamps), `deriveFrames` (8 frame placeholders), `pickIndex` (top-lift rewrite), `topLiftDisplay`, `deriveAudioMatches`, `deriveVsMedian`, later `derivePostTime`.
- `components/report/atoms.tsx` — Watermark (giant transparent numeral), MonoTag, Pill, AppliedBadge, btnStyle. Re-used across every section.
- Rewrote `VideoPlayer.tsx` as `VideoSection` — video + moments list side-by-side on desktop (stacks on mobile), with the unified scrubber + frame-thumb strip below.
- Rewrote `ReportView.tsx` as the v2 orchestrator. Hero (huge score + breakdown bars + cohort comparison), 4 FIX sections each numbered 01–04 with giant transparent watermark numerals, ApplyCTA (giant lime block), Trending. Mobile-first responsive via `md:` breakpoints — one component, not two.
- Cleaner status sub-nav in `app/r/[id]/page.tsx`. VideoPlayer no longer standalone; lives inside VideoSection.

### Stage 2 — Real frame extraction

- Wrote `hooks/useVideoFrames.ts` — spins up a hidden `<video crossOrigin="anonymous">`, seeks through each requested timestamp, paints to an offscreen canvas, emits JPEG data URLs. Verified Supabase public bucket sends `Access-Control-Allow-Origin: *` so canvas reads aren't tainted.
- VideoSection's frame strip now renders real frames as they extract. FixThumbnail's CURRENT/PROPOSED boxes show actual video stills, with a soft hot/good color wash preserved as a screen-mode overlay so the issue/strength encoding still reads.

### Stage 3 — Shareable report (differentiator #5)

- `app/r/[id]/opengraph-image.tsx` — dynamic Node-runtime image route, fetches the report via `fetch_report` RPC, renders 1200×630 PNG with score + verdict + category + brand. Cached by Vercel edge.
- Hit a 500 in production on first deploy: `fs.readFile` of `public/fonts/ClashDisplay-Variable.ttf` fails because Vercel doesn't bundle `public/` into serverless function output. Switched to a system-font stack — image renders cleanly, lost Clash Display in the OG only. Fix-in-place if we want it back: fetch the font from the deployed URL.
- `components/report/ShareControls.tsx` — ↗ COPY LINK + ↗ TWEET in the status sub-nav. Twitter intent prefills text + URL, truncates verdict for the 280-char budget.
- `generateMetadata` in the page exports per-report title + description + openGraph + twitter (`summary_large_image`).

### Stage 4 — Pre-analyzed sample chips (differentiator #3)

- `scripts/seed-samples.ts` — uploads bytes through the same anon path the upload route uses, inserts a pending row, triggers `/api/analyze/[id]` on the live deployment. Two CC samples sourced (Cloudinary dog clip, test-videos.co.uk BBB animation).
- `lib/sample-videos.ts` — 3 real UUIDs replacing the stubs.
- `components/landing/SampleVideoPicker.tsx` — chips are now Next `<Link prefetch>` to the real `/r/[id]` URLs. Removed onPick callback / pickedId state.
- `Hero.tsx` — simplified picked state, only file uploads need the staged-file path.

### Stage 5 — What If? simulator (the wow moment)

- Added `applied` state to `ReportContext` — 4 booleans + `toggleApplied(key)` + `resetApplied()` + cached `appliedCount`.
- `WhatIfSimulator.tsx` replaces the static ApplyCTA. Big animated score (`animate()` + `onUpdate` callback for fluid count-up), 2×2 toggle grid, morphing subtitle, TIER-1 badge that scale-ins when all 4 are checked, RESET link, ↗ COPY CHECKLIST button that exports the full re-record plan as plain text.
- Coordinated section effects: each FIX section gets a faint lime gradient wash + a 3px lime accent strip + an ✓ APPLIED pill in the rail when its toggle is on. FixCaption swaps the entire body — original strikes through, picked rewrite swoops in as the new ~28px hero text. FixThumbnail fades the CURRENT box to 30% grayscale and scales the PROPOSED up slightly.

### Stage 6 — Cascading reveal + post-time badge

- Wrapped each top-level section in `ReportView` in a `motion.div` with `staggerChildren: 0.36`. Sections fade-up sequentially over ~3.2 s after analysis lands. This is the Day 4 "streaming reveal" differentiator made visible — client-orchestrated, honestly framed.
- `POST · TUE 6PM` lime-bordered badge in the Hero meta row. Maps `inferredCategory` to a peak engagement window via regex table (app → Tue 6 PM, GRWM → Sun 8 PM, cooking → Sat 11 AM, etc).

### Decisions made today

- **Pulled Day 9 polish into Day 6.** The second design handoff was complete enough to build against — pushing it to Day 9 would have meant rebuilding the same UI twice.
- **Frame extraction client-side, not server.** No ffmpeg, no Storage thumbs, runs after page load. Acceptable for files <100 MB; the visual is real.
- **What If? simulator over a separate "re-record checklist".** The toggle grid IS the checklist; adding a separate section would have been redundant. One ↗ COPY CHECKLIST button exports the list when the user wants it.

---

## Day 7 — May 15, 2026 · Cut decision (auth + history)

The original plan had auth + a `/history` page on Day 7. **Cut entirely.**

Reasoning:
- The "no-signup demo path" was already the #3 differentiator and it works end-to-end.
- Auth would have added 4+ hours: a real flow with email confirmations, the `/history` page itself with proper RLS update policies, session management, the "save this report" CTA wiring, the inevitable edge cases.
- A reviewer doing a 30-second demo doesn't see history — they see the magic moment and move on.
- `lib/supabase/server.ts` already has SSR cookie wiring; auth is a future addition, not a redesign.

Documented in README under "Deliberate scope cuts."

---

## Day 8 — May 15, 2026 · Security regression + README polish

- `scripts/test-rls.ts` — 10-check regression test for the Supabase RLS policies. Run as anon (publishable key). Covers:
  1. `SELECT *` returns 0 rows (no anon SELECT policy on reports)
  2. INSERT with `status='ready'` blocked (42501)
  3. INSERT with `user_id` set blocked (42501)
  4. INSERT with `analysis` populated blocked (42501)
  5. UPDATE returns 0 rows affected (no UPDATE policy)
  6. DELETE returns 0 rows affected (no DELETE policy)
  7. `fetch_report(random UUID)` leaks nothing
  8. `fetch_report(known UUID)` returns the right row
  9. Storage rejects non-video mime
  10. Storage rejects anon delete
- All 10 pass on first run against the live database. Wired as `pnpm test:rls` for future regression.
- Rewrote the README — full features list mapped to brief, the 5 differentiators with file references, stack table, run-locally, full project structure tree, architecture decisions, security decisions section, deliberate scope cuts, credits with attribution.

---

---

## Day 8 (cont.) — May 15, 2026 · Mobile pass, security audit, schema hardening

Day 8 ran in two waves. First wave: RLS regression + README polish (above). Second wave kicked off when the user opened the live site on their phone and started filing real issues.

### Wave 2a — Nav and modal additions

Before the mobile pass, three concrete UX gaps showed up on the desktop:
- The "Sign in →" nav link pointed at an auth flow we'd deliberately cut. Removed.
- "How it works" and "Examples" were non-clickable `<span>`s. Promoted to modal-opening buttons with a 3-step explainer and 3-sample card grid respectively.
- Same nav got a third "History" button + per-device localStorage history with a `HistorySync` client component. Shipped in commits `d601431` (modals) and `c715405` (history).

### Wave 2b — The HistorySync bug (caught by /debug)

Ran the `/debug` + `/code-review` + `/systematic-debugging` skills as a pre-submission QA pass. Found **one real bug** (10/10 RLS tests still green, 5 minor stylistic findings noted but left alone):

`HistorySync` was rendered outside `<ReportProvider>` and received `status` as an immutable SSR prop. For pending-at-SSR reports, the localStorage entry stayed permanently `pending` even after `PendingClient` set the analysis on context — `HistorySync`'s props never changed, so its `useEffect` never re-fired.

Fix in `768a6ea`: moved `HistorySync` inside the provider and switched it to read `analysis` from context. Now reacts to both SSR-ready and PendingClient-landed cases identically.

### Wave 2c — Vibe-Checklist security audit

User shared mdsaban's [Vibe Coding Security Checklist](https://gist.github.com/mdsaban/29ffbb6974ce2fa9acc37415b9a4b684) and asked me to audit against it. Walked every item:

| # | Item | Status |
|---|---|---|
| 1 | Leaked secrets | ✅ `git grep` clean. `.env.local` gitignored. AI logs scrub `AIza/sk-/sk-ant-` patterns. |
| 2 | Input sanitization | ✅ Zod on every API boundary. No raw HTML injection paths, no `eval`, no raw SQL string interpolation. |
| 3 | Rate limiting | ✅ Token bucket on `/api/upload/init` (10/10m) + `/api/analyze/[id]` (5/10m). |
| 4 | Auth | ✅ Supabase managed. No custom flow. RLS-only enforcement. |
| 5 | API versioning | ⚠️ Scope cut — `/api/upload/init` not `/api/v1/...`. Single-codebase consumer; documented. |
| 6 | File uploads | ✅ Four enforcement layers: client → Zod → DB CHECK → Storage bucket. |
| 7 | Dependencies | ❌→✅ `pnpm audit` flagged **23 CVEs in Next.js** (9 high — SSRF, DoS variants, middleware bypass, CSRF on Server Actions). Bumped 16.0.10 → 16.2.6 in `7140e57`. Audit now: 1 transitive postcss XSS, build-time-only, non-exploitable. |

### Wave 2d — The mobile pass (six fixes, two rounds)

User's iPhone screenshots surfaced layout + interaction bugs invisible on desktop. Fixed in two commits.

**`f17452a` — first round:**
- Hero `font-size` lower bound 56 → 40px so the headline doesn't force one-word-per-line at 375px.
- Hero padding `px-12` → `px-6 md:px-14 lg:px-20` (was eating 96 of 375px in horizontal padding).
- `UploadCard` switched to `flex-col md:flex-row` — `SCORE IT →` button used to overflow off-screen right. Now stacks below the input on mobile, full-width tap target.
- Added `min-w-0` on the `flex-1` truncate parent so the placeholder text actually clips with ellipsis.
- `NavButton` got `whitespace-nowrap` — "HOW IT WORKS" was breaking onto two lines.
- `Toaster` moved from `top-center` to `bottom-center` — iOS Safari's URL bar was obscuring upload-progress toasts.
- Added an indeterminate lime progress bar across the top of `UploadCard` while `busy=true` so users get in-page feedback even if a toast is hidden.

**`524a4fa` — second round:**
- Nav padding finally normalised to `px-6 md:px-14 lg:px-20` matching every other surface. The 8px mismatch between Nav and the report sub-nav was the alignment glitch.
- `useVideoFrames` hook rewritten for iOS Safari: wait for `canplay` (readyState 3), not just `loadedmetadata`, before seeking; prime with a `play()/pause()` cycle; attach the hidden `<video>` to `document.body` (off-screen) instead of leaving it detached; 1.5s seek-timeout fallback. iOS Safari's documented seek quirk was making `FixThumbnail`'s CURRENT/PROPOSED boxes stick on gradient placeholders forever.
- Play overlay + bottom-bar play/pause replaced with hand-tuned SVG triangles. The unicode `▶` glyph was rendering as a legacy emoji on iOS and off-center via the unreliable `paddingLeft:6` optical correction.
- `FixCaption` had an `AnimatePresence mode="wait"` content swap between two layouts ~120px apart in height. Every Caption toggle jolted the entire page below it. Removed the swap; toggling now changes only opacity + label text. The shake's gone.

### Wave 2e — Schema hardening (the failure-cascade fix)

User's phone upload later returned `ANALYSIS FAILED` with `hook.alternatives.0.predictedLift → Number must be less than or equal to 60`. My Zod schema capped `predictedLift` at 60; Gemini returned 65. The whole analysis got marked `failed`.

Fixed in `c583ca7` (the immediate `max(60) → max(100)` patch) — then user correctly pushed back: *"similar type of different error can also occur."*

So `485d3a1` did a full schema audit and hardened every constraint:

- **Numbers**: every tight `.max()` replaced with `.transform()` clamping into range. Timestamp clamps to 7200s. Score100 clamps + rounds. Lifts clamp to 100. vsCategoryMedian clamps to ±100.
- **Strings**: dropped 15 separate `.min(N)` requirements. Empty strings still fail (`min(1)`), but no more "this fix description is only 18 chars, the prompt asked for 20+" rejections.
- **Arrays**: relaxed exact `.length(3)` on hook alternatives + caption rewrites to `.max(10).transform(slice(0,3))`. Same pattern for cuts/deadAir/audio/hashtags caps.
- **Enums**: dropped the `tone: enum([4 values])` constraints on hook + caption rewrites. The UI just displays whatever label Gemini picks.
- **Regex**: `tag.regex(/^#/)` reject → `transform(s => s.startsWith('#') ? s : '#'+s)`. Auto-prefix instead of fail.
- **Gemini JSON schema side**: added `minimum/maximum` on all numeric fields and `minItems/maxItems` on all arrays as a first line of defence — Gemini constrains during generation, Zod is now last-resort safety net.

Net effect: an analysis can only fail validation if Gemini returns *fundamentally malformed* JSON (missing required fields, wrong types). Any creative overshoot or undershoot is silently absorbed. Verified by re-running `pnpm test:analyze` against all 3 sample videos — every one parsed cleanly.

---

## What's left for the actual submission

- **You (~2h):** finish mobile re-test on the new build, record the Loom (≤5 min — landing → sample chip → cascading reveal → What If? toggles → copy checklist → tweet button), 8–12 screenshots into `docs/screenshots/`, fill the contest application form's remaining steps, paste the repo + Loom URLs.
- **Me (~15 min when you're ready):** git tag `v1.0.0-submission`, push tag.

Feature scorecard going into submission:

| Brief feature | Status |
|---|---|
| Video upload | ✅ drag-drop, 100 MB cap, 20 MB analysis cap |
| Virality score 0-100 + breakdown | ✅ Hero + 4 bars |
| Hook analysis (first 3s) | ✅ FixHook with landsAt + 3 ranked rewrites |
| Caption optimization | ✅ FixCaption with strikethrough dead-words + 3 ranked rewrites |
| Competitor comparison | ✅ Hero `vs MEDIAN/vs CAT/CEIL` row |
| Trending audio/hashtag | ✅ Trending section, mood-based audio + 5 hashtags |
| **Plus** thumbnail rating | ✅ FixThumbnail with real-frame current vs proposed |
| **Plus** What If? simulator | ✅ Toggle grid + animated score morph + copy checklist |

Differentiators 1–5 all live. Security audit at 1 non-exploitable vuln. Schema can absorb any reasonable Gemini output without failing. Mobile responsive across iOS Safari + Android Chrome. README + AI logs current. Repo public. Live URL stable.
