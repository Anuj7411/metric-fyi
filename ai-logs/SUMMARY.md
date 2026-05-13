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

### What's left

- Day 4: Gemini 2.0 Flash analysis backend + the prompt
- Day 5: streaming reveal + report layout
- Day 6: visible reasoning (citations) + video player coupling
- Days 7–10: shareable report, auth + history, mobile + perf, Loom + submit
