# METRIC.fyi — Session Handoff

> Last updated: end of Day 8 (May 15, 2026 evening, ~2:30am IST).
> Submission deadline: May 16, 2026 (tomorrow).
> Read this top-to-bottom and you have full context to continue.

---

## 0 · TL;DR

A virality-score web app built for the **8x Engineer "Go Viral Clone" contest**. Drop a short-form video, get a 0–100 score in ~20s with timestamped feedback. Every feature in the brief is shipped, all 5 contest differentiators are live, security audit clean, mobile pass complete except for one schema-validation regression the user just caught.

**Status: feature-complete. Pending one git push (retry feature, uncommitted in working tree), then tomorrow = phone verify + Loom + submit.**

---

## 1 · Identity & ground truth

| Thing | Value |
|---|---|
| Brand | **METRIC.fyi** |
| Contest | 8x Engineer "Go Viral Clone" |
| Deadline | 2026-05-16 (tomorrow) |
| User | Anuj7411 on GitHub |
| Repo | https://github.com/Anuj7411/metric-fyi |
| Live | https://metric-fyi.vercel.app |
| Supabase project | `kjqwjilhxzeqkdydtsoj` (cloud, Mumbai region) |
| Working directory | `C:\Projects\go viral 8x\metric-fyi` (Windows, Git Bash) |
| User location | India (GMT+5:30) |
| User dev env | Windows, Node 24, pnpm at `~/AppData/Local/pnpm/pnpm.CMD` (PATH issues sometimes — see note below) |

### Sample report URLs (real, analyzed, used for landing chips)

- `/r/8acd04b5-c59e-408b-8da6-b6d4416f9238` — `@anon` Secret Santa app, score 48
- `/r/d0072db2-2595-4818-a397-173e86aeafe9` — `@cloudinary` dog clip, score ~45
- `/r/667cc6b8-b9a7-4420-a389-ff826dbd5700` — `@blender` animation, score 22-28

---

## 2 · Locked stack (DO NOT propose alternatives)

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6 (App Router) + React 19 + TypeScript |
| Styling | Tailwind v4 + hand-rolled token system in `app/globals.css` via `@theme` |
| Type | **Clash Display** (display, self-hosted at `public/fonts/ClashDisplay-Variable.ttf`) + **Geist** (body, via `geist` npm package) + **Geist Mono** (instrument) |
| DB / Storage | Supabase cloud (no local Docker) |
| AI | Gemini Flash via `gemini-flash-latest` alias (currently → Gemini 3 Flash Preview, free tier) — REST API, NO SDK |
| Schema validation | Zod (everywhere — DB rows, API contracts, LLM responses) |
| Motion | Framer Motion 12 |
| Hosting | Vercel Hobby (analyze route on Node runtime with `maxDuration = 60`) |
| Package manager | pnpm 10 |

**Original design direction** (Day 1 chat with Claude Design): Bloomberg analytical precision × creator FYP cultural language. Locked palette "Lab Lime" — radioactive lime (`#C6FF3D`) on warm dark (`#0E0D0B`). Italic-serif moments via Geist Italic. Mono-caps "instrument" labels via Geist Mono. The whole feel: "lives next to CapCut/Premiere, not next to Mailchimp."

---

## 3 · Design tokens (from `app/globals.css`)

```css
--color-ink: #0E0D0B          /* warm near-black, app bg */
--color-ink-2: #161512         /* card */
--color-ink-3: #232118         /* hover/border */
--color-line: rgba(255,245,210,0.08)
--color-line-strong: rgba(255,245,210,0.15)
--color-paper: #F5F1E8         /* public report variant */
--color-text: #F5F1E8
--color-text-dim: #A8A092
--color-text-mute: #6B6557
--color-signal: #C6FF3D        /* radioactive lime — the score */
--color-signal-dim: #93C42B
--color-hot: #FF4A1C           /* alarm — weak hooks */
--color-hot-tint: rgba(255,74,28,0.12)
--color-signal-tint: rgba(198,255,61,0.06)
--color-cool: #4A8CFF          /* citation blue */
--color-gold: #E8B14A
```

**Motion contract** (`lib/motion.ts`): cubic-bezier `[0.2, 0.8, 0.2, 1]`, durations 120ms (hover) / 220ms (element) / 480ms (page) / 1400ms (score count-up), 40ms stagger. **Forbidden: bounce, spring overshoot, parallax, glow pulses.**

---

## 4 · The 5 differentiators (all shipped)

| # | Differentiator | Lives in |
|---|---|---|
| 1 | Specificity of feedback (every claim cites a timestamp) | `lib/ai/prompt.ts` system instruction + `lib/ai/schema.ts` forced JSON shape |
| 2 | Visible reasoning (chip-to-marker two-way binding) | `components/report/VideoPlayer.tsx` (unified scrubber + frame-thumb strip) + `TimestampChip.tsx` + `contexts/report-context.tsx` |
| 3 | No-signup demo path (5-second magic moment) | Sample chips in `components/landing/SampleVideoPicker.tsx` link to 3 pre-analyzed `/r/[id]` URLs |
| 4 | Streaming analysis reveal | Cascading section reveal in `components/report/ReportView.tsx` (Framer stagger 0.36s × 8 sections ≈ 3.2s total). Honest framing — client-orchestrated, not LLM-token streaming |
| 5 | Shareable public report | `app/r/[id]/opengraph-image.tsx` + `components/report/ShareControls.tsx` + per-report `generateMetadata` |

**Plus the wow moment**: `components/report/WhatIfSimulator.tsx` — toggle each of 4 fixes, animated score morphs from current → ceiling, tier-1 badge scale-pops when all 4 are on. Copy-checklist button exports a plain-text re-record plan.

---

## 5 · The 6 brief features (all mapped)

| Brief | Where it lives |
|---|---|
| Video upload | `components/landing/UploadCard.tsx` — page-wide HTML5 drop, 100 MB UI cap, 20 MB analysis cap |
| Virality score 0–100 + breakdown | Hero section + breakdown bars in `ReportView.tsx` |
| Hook analysis (first 3s) | FixHook section + `Analysis.hook.{landsAt, issue, fix, alternatives}` |
| Caption optimization | FixCaption — strikethrough dead-words + 3 ranked rewrites |
| Competitor / cohort comparison | Hero `vs MEDIAN / vs CATEGORY / CEILING` row (derived in `lib/ai/derive.ts`) |
| Trending audio + hashtags | Trending section — model-suggested **mood/genre** descriptors (NOT real track names — documented honest scope cut) |
| Thumbnail rating (bonus) | FixThumbnail with REAL frame extraction via `hooks/useVideoFrames.ts` |

---

## 6 · Architecture decisions (non-obvious calls that need to be preserved)

1. **Anon role + RLS, no service-role anywhere.** All Supabase ops run as anon. State transitions on `reports` (`pending → analyzing → ready / failed`) go through 4 SECURITY DEFINER RPCs: `fetch_report`, `mark_analyzing`, `mark_failed`, `save_analysis`. Plus `reset_failed_report` (uncommitted — see §10).

2. **Inline video to Gemini, capped at 20 MB.** Files API path = too slow for Vercel Hobby 60s ceiling. Inline = one round-trip. Sample videos all <20 MB.

3. **Client-direct Storage upload.** The browser uploads directly to Supabase Storage with the anon key. `POST /api/upload/init` only inserts the pending row and returns a UUID. Otherwise Vercel's 4.5 MB request body cap.

4. **Client-side frame extraction.** Hidden `<video crossOrigin="anonymous">` + canvas. Hardened for iOS Safari (canplay wait + play/pause prime + seek timeout fallback). See `hooks/useVideoFrames.ts`.

5. **Storage path === report id.** Every upload writes to `videos/{uuid}.{ext}`. Same UUID as PK. Trivial lookup.

6. **Public-by-unguessable-UUID.** No share tokens, no signed URLs. `reports` table has no anon SELECT policy — reads go through `fetch_report` RPC. Standard Imgur/Pastebin pattern.

7. **Section-by-section "streaming" via stagger, not SSE.** Real Gemini streaming was attempted (Day 4) but the parser was unreliable. Pivoted to sync analyze + client-side staggered fade-in.

8. **Defensive Zod schema** (Day 8). Every Zod constraint uses `.transform()` to clamp/slice/auto-fix instead of rejecting. A single Gemini overshoot can no longer fail an entire analysis. See `lib/ai/schema.ts`.

9. **localStorage history**, not server-side history. Per-device, no auth needed. `lib/history.ts` writes on upload, `HistorySync.tsx` updates on report-ready via `useReport()` context.

10. **Navigation as client component with three modal states** (`how`, `examples`, `history`). Body scroll locked while open. Escape + backdrop click both close.

---

## 7 · File structure (key paths only)

```
app/
  page.tsx                                Landing — headline + drop zone + sample chips
  layout.tsx                              Fonts + global shell
  globals.css                             Tailwind v4 + Lab Lime tokens
  api/
    upload/init/route.ts                  POST: validate Zod + insert pending row
    analyze/[id]/route.ts                 POST: Node runtime, maxDuration=60, idempotent
  r/[id]/
    page.tsx                              Server: fetches via RPC, routes by status
    opengraph-image.tsx                   1200×630 dynamic OG

components/
  navigation.tsx                          Logo + 3 nav modals (How / Examples / History)
  landing/
    Hero.tsx                              Headline + UploadCard + SampleVideoPicker
    UploadCard.tsx                        Drag-drop + click-to-pick
    SampleVideoPicker.tsx                 3 chips that Link to /r/[id]
  marketing/Logo.tsx
  report/
    ReportView.tsx                        v2 layout orchestrator + 4 FIX sections
    VideoPlayer.tsx                       VideoSection — unified scrubber + frame strip + moments list
    TimestampChip.tsx                     Inline clickable timestamps
    PendingClient.tsx                     Skeleton + analyze trigger
    WhatIfSimulator.tsx                   Toggle grid + score morph + copy checklist
    ShareControls.tsx                     Copy link / Tweet intent
    HistorySync.tsx                       Updates localStorage entry on context.analysis change
    RetryButton.tsx                       UNCOMMITTED — retry-from-failed
    atoms.tsx                             Watermark, MonoTag, Pill, AppliedBadge, btnStyle, fmtTime
  ui/button.tsx                           2 variants: signal + ghost
  footer.tsx

contexts/
  report-context.tsx                      videoRef + seekTo + activeCitationId + analysis state + applied state

lib/
  ai/
    prompt.ts                             SYSTEM_INSTRUCTION + USER_INSTRUCTION — the MOST iterated file
    schema.ts                             Defensive Zod + JSON schema for Gemini
    gemini.ts                             Thin REST wrapper, runtime-agnostic
    derive.ts                             deriveMarkers, deriveFrames, pickIndex, topLiftDisplay,
                                          deriveAudioMatches, deriveVsMedian, derivePostTime
  schemas/report.ts                       API request/response shapes
  supabase/
    client.ts                             Browser anon
    server.ts                             Server anon w/ SSR cookie wiring
  history.ts                              localStorage wrapper for per-device history
  rate-limit.ts                           In-memory token bucket
  motion.ts                               Framer presets
  sample-videos.ts                        3 sample UUIDs + handles
  utils.ts                                shadcn cn() helper

hooks/
  useVideoFrames.ts                       Client-side frame extraction (iOS-hardened)

supabase/
  migrations/
    20260514010000_create_reports.sql     reports table + RLS + fetch_report RPC
    20260514010100_create_videos_bucket.sql
    20260514120000_analyze_rpc.sql        mark_analyzing / mark_failed / save_analysis
    20260515200000_reset_failed_rpc.sql   UNCOMMITTED — reset_failed_report (NEEDS USER TO APPLY)

scripts/
  test-analyze.ts                         pnpm test:analyze — prompt iteration harness
  test-stream.ts                          Parked (Gemini SSE didn't yield reliable chunks)
  test-rls.ts                             pnpm test:rls — 10 RLS regression checks
  seed-samples.ts                         Used once to seed the 3 sample reports
  sync-logs.sh                            pnpm logs:sync — copies Claude Code JSONL into ai-logs/ + redacts secrets

ai-logs/
  SUMMARY.md                              Day-by-day curated narrative (REQUIRED by contest spec)
  *.jsonl                                 Raw Claude Code conversation transcripts
  README.md                               Folder explainer

docs/
  (empty — screenshots go here Day 10)
```

---

## 8 · The 4 Supabase RPCs (security model)

All `SECURITY DEFINER`, all anon-callable, all enforce legal state transitions inside their function bodies. Anon has **no UPDATE/DELETE policy** on `reports`.

```sql
fetch_report(p_id uuid) → reports
  -- The only way anon reads reports. Filters by id internally so unguessable-UUID
  -- security pattern holds.

mark_analyzing(p_id uuid) → void
  -- pending → analyzing. Raises if not in pending.

mark_failed(p_id uuid, p_msg text) → void
  -- pending|analyzing → failed. Sets error_message.

save_analysis(p_id uuid, p_analysis jsonb) → void
  -- analyzing → ready. Persists the JSON.

reset_failed_report(p_id uuid) → void  [UNCOMMITTED — see §10]
  -- failed → pending. Clears analysis + error_message. Enables retry.
```

`pnpm test:rls` regression test runs **10 checks** against this model. All passing as of last run.

---

## 9 · Honest scope cuts (documented in README)

- **No social URL ingestion** (TikTok/IG/YouTube). Platforms block server-side fetch. File upload only.
- **No auth / history pages** on the server side. localStorage history is per-device. `lib/supabase/server.ts` SSR cookie wiring is ready for the day this gets added.
- **Trending audio = mood/genre descriptors**, not real track names. Honest in-UI footer.
- **Frame thumbnails = client-side canvas**, not server pre-processing.
- **20 MB inline cap** on analysis. Files API path = future.
- **Optimal post time = category → window mapping** in `derive.ts`. Generic; per-creator analytics would beat it.
- **Rate limit is in-memory** per Vercel lambda. KV upgrade is Day 9+1.
- **No real-time LLM streaming**. Sync Gemini + client cascade.

---

## 10 · PENDING WORK (do this first when you resume)

### A. Retry-from-failed feature — built but NOT committed

Files in working tree but unpushed:
- `supabase/migrations/20260515200000_reset_failed_rpc.sql` (NEW)
- `components/report/RetryButton.tsx` (NEW)
- `app/r/[id]/page.tsx` (modified — FailedState now takes `id`, renders `<RetryButton id={id}/>`)

Build is clean (verified). Ready to commit + push.

**Action**:
```bash
cd "C:\Projects\go viral 8x\metric-fyi"
git add -A
git commit -m "feat(retry): re-analyze failed reports without re-uploading

Adds reset_failed_report SECURITY DEFINER RPC + RetryButton client
component on the FailedState view. Gracefully handles the case where
the migration hasn't been applied yet (toast prompts user)."
git push origin main
```

**Then give the user the SQL to paste** in Supabase SQL editor (https://supabase.com/dashboard/project/kjqwjilhxzeqkdydtsoj/sql/new):

```sql
create or replace function public.reset_failed_report(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
     set status = 'pending', error_message = null, analysis = null
   where id = p_id and status = 'failed';
  if not found then
    raise exception 'cannot reset_failed_report: row % not in failed state', p_id;
  end if;
end;
$$;

revoke all on function public.reset_failed_report(uuid) from public;
grant execute on function public.reset_failed_report(uuid) to anon, authenticated;
```

### B. User's mobile phone test results (in progress when this handoff was written)

User was phone-testing when they asked for this handoff. Likely outcomes:
- New upload works cleanly (schema is hardened) → ✅ proceed to tomorrow's work
- Visual regression on some specific phone behaviour → fix and re-deploy
- Frame extraction still fails on their specific Android (different from iOS path I hardened) → may need Android-specific debugging

---

## 11 · Tomorrow's submission path (~3 hours total)

| Step | Owner | Notes |
|---|---|---|
| 1. Phone test confirmation | User | Verify schema fix + mobile nav + frame extraction all work |
| 2. Commit + push retry feature (§10A) | You | ~5 min |
| 3. User applies retry migration | User | One SQL paste, ~30s |
| 4. Loom recording | User | 4 min max. Suggested arc: Landing → HOW IT WORKS modal → Examples chip click → cascading reveal → click timestamp chips → scroll to What If → toggle all 4 → tier-1 badge → COPY CHECKLIST → TWEET button. End on the OG card preview. |
| 5. Screenshots | User | 8–12 stills into `/docs/screenshots/`. Mix of 1440px desktop + 375px mobile. Cover Hero, FixHook, FixThumbnail (real frames), What If states, History modal. |
| 6. Sync final AI logs | You | `pnpm logs:sync` + commit |
| 7. Git tag | You | `git tag v1.0.0-submission && git push --tags` |
| 8. Contest form | User | Paste `https://github.com/Anuj7411/metric-fyi`, the Loom link, the 3 sample report URLs as proof-of-concept. The form has multiple steps (Profile / Repository / Demo Video / Screenshots / Reflection / Resume / Review). |

---

## 12 · Working principles (carry into next session)

From the user's first message:
- **"Push back on me when I'm wrong."** Don't agree by default. Cite reasons.
- **"Plain English, no jargon I have to Google."** Translate technical decisions to "what this means in practice."
- **"BEFORE writing code for any feature, propose the approach in plain English first. Wait for my 'go.'"** This was loosened over time as trust grew — for small fixes, just do them. For new features, propose first.
- **"When you face a decision with real tradeoffs, present 2 options with one-line tradeoffs and your recommendation."**
- **Type-safe everything. No `any`. Zod schemas at every API boundary.** Maintained throughout.
- **Conventional commits.** Maintained. Past commits use `feat:`, `fix:`, `chore:`, `docs:` prefixes.
- **AI_LOG.md** → moved to `ai-logs/SUMMARY.md` (matches contest spec). User explicitly verified contest expects `/ai-logs/` folder.

---

## 13 · Critical commits (last ~20, newest first)

```
[uncommitted]  retry feature (see §10A)
485d3a1  fix(schema): defensive transforms across every Zod constraint
c583ca7  fix(schema): predictedLift cap 60 → 100 + defensive clamp transform
524a4fa  fix(mobile): nav alignment + iOS frame extract + SVG play + WhatIf shake
7140e57  fix(security): bump Next.js 16.0.10 → 16.2.6 — closes 22 CVEs
768a6ea  fix(history): HistorySync now subscribes to context analysis, not server props
c715405  feat(history): per-device localStorage history + HISTORY nav modal
d601431  feat(nav): remove broken Sign in + make How it works / Examples clickable
1749726  docs(ai-logs): Day 8 wave-2 summary entry
d52b1f2  chore: README polish + scripts/test-rls.ts + SUMMARY.md through Day 8
01f67f9  feat(report): post-time badge + copy checklist + cascading reveal
95077ec  feat: WhatIfSimulator stage 2 — coordinated section effects
66fec01  feat: WhatIfSimulator stage 1 — score morph + toggle grid
c9dc241  fix(thumbnail): render real video frames in current vs proposed boxes
159c638  feat(samples): wire landing chips to real pre-analyzed reports
35fa2d5  fix(og): drop Clash Display font load — Vercel doesn't bundle public/
f5265f6  feat(share): OG image + Tweet/copy buttons + per-report metadata
203a82b  feat(report v2): full Report v2 design — desktop + mobile responsive
3833297  fix(report): unified scrubber — playback + markers share one rail
9bb0f83  feat(report): Day 5 — visible reasoning + video player + click-to-seek
```

---

## 14 · Known Windows / pnpm gotchas

User is on Windows with Git Bash + PowerShell. pnpm was installed via the standalone installer, not corepack (Windows admin issues).

- pnpm binary location: `C:\Users\ojhaa\AppData\Local\pnpm\pnpm.CMD`
- If `pnpm` isn't found in a shell, the user may need to reopen the terminal (PATH only applies to new shells) OR run `Set-Alias pnpm "$env:LOCALAPPDATA\pnpm\pnpm.CMD"` in PowerShell.
- For Bash/Claude-side calls, use `/c/Users/ojhaa/AppData/Local/pnpm/pnpm` directly.

---

## 15 · Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://kjqwjilhxzeqkdydtsoj.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon JWT, public-by-design>
GEMINI_API_KEY=<starts with AIza, server-only>
```

There is INTENTIONALLY no `SUPABASE_SERVICE_ROLE_KEY`. Every server op runs as anon + RLS.

`.env.local` is gitignored. `.env.example` is committed.

Vercel env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY` (all Production + Preview).

---

## 16 · Security posture (audited Day 8)

- **22 CVEs closed** by Next.js 16.0.10 → 16.2.6 bump. `pnpm audit --prod` now shows 1 transient PostCSS XSS (build-time only, not exploitable in our shape).
- **RLS regression test** (`pnpm test:rls`) passing 10/10. Covers: anon can't SELECT/UPDATE/DELETE reports, anon can't INSERT with disallowed initial state, `fetch_report` doesn't leak for unknown UUIDs, Storage rejects non-video mime + anon delete.
- **Secret redaction** in `scripts/sync-logs.sh` — regex-replaces `AIza…`, `sk-…`, `sk-ant-…` before any JSONL gets committed.
- **No `SUPABASE_SERVICE_ROLE_KEY`** in code (`git grep SERVICE_ROLE` returns 3 hits, all in comments saying "we don't use this").
- Rate limits on `/api/upload/init` (10/10min/IP) and `/api/analyze/[id]` (5/10min/IP).
- Audited against the **"Vibe Coding Security Checklist"** (https://gist.github.com/mdsaban/29ffbb6974ce2fa9acc37415b9a4b684) — all 7 items addressed in README "Security decisions" section.

---

## 17 · The single most important file: `lib/ai/prompt.ts`

The prompt is what makes the analysis feel "brutally honest" vs. generic SEO blandness. Key principles baked in:

- Voice: senior editor who likes the creator but won't lie. No emojis anywhere. No platitudes.
- Every fix must cite a timestamp + the actual visual/audio at that timestamp.
- Scoring rubric uses the full 0–100 range. Willing to score low.
- Verdict line is one editorial punch sentence, 12–20 words.
- Trending audio = mood/genre descriptors (NOT specific track names — anti-hallucination).
- Forbidden: "engage your audience," "✨," "🚀."

If you ever need to iterate the prompt: `pnpm test:analyze` runs it against `tests/videos/*.mp4` and dumps the JSON for diffing.

---

## 18 · How to verify the live deploy is healthy

```bash
# Run from anywhere
URL="https://metric-fyi.vercel.app"

# 1. Landing renders
curl -sI "$URL" | head -3   # → HTTP 200

# 2. Sample report renders
curl -sI "$URL/r/8acd04b5-c59e-408b-8da6-b6d4416f9238" | head -3  # → HTTP 200

# 3. OG image renders
curl -sI "$URL/r/8acd04b5-c59e-408b-8da6-b6d4416f9238/opengraph-image" | head -3
# → HTTP 200, content-type: image/png

# 4. Invalid UUID 404s
curl -sI "$URL/r/not-a-uuid" | head -1   # → HTTP 404

# 5. Bad upload init body returns 400 with Zod issues
curl -sX POST "$URL/api/upload/init" -H "content-type: application/json" -d '{}'
# → {"error":"invalid_input","issues":{...}}

# 6. RLS regression locally
cd "C:\Projects\go viral 8x\metric-fyi"
pnpm test:rls   # → 10/10 PASS
```

---

## 19 · If you (next Claude) get stuck on something specific

| Symptom | Likely cause | Where to look |
|---|---|---|
| Build fails on `next build` | Probably an import error after a recent edit | Check the error file path — last edits were `app/r/[id]/page.tsx`, `components/report/RetryButton.tsx` |
| Analyze route returns 500 | Gemini quota OR new schema mismatch | Check Vercel logs; `pnpm test:analyze` to reproduce locally |
| Frame thumbnails stay gradient on mobile | iOS / Android codec quirk | `hooks/useVideoFrames.ts` — already has canplay wait + play/pause prime + 1.5s seek timeout. If still broken, accept gradient fallback. |
| Modal stuck open | `document.body.style.overflow` not restored | Cleanup function in `components/navigation.tsx` — check the prevOverflow capture |
| `pnpm` not found | PowerShell PATH not refreshed | See §14 |
| Sample chip doesn't navigate | Wrong UUID in `lib/sample-videos.ts` | Verify against §1 |

---

## 20 · Don't break these (high-value, fragile)

1. **The cascading reveal in `ReportView.tsx`** — each section wrapped in `motion.div variants={sectionVariants}`. Don't merge these unless you re-think the timing.

2. **HistorySync inside ReportProvider** — it MUST be inside the provider, NOT outside (was a Day 8 bug fix — `768a6ea`).

3. **The defensive schema transforms in `lib/ai/schema.ts`** — every `.transform()` was added deliberately. Don't tighten back to strict bounds without re-running `pnpm test:analyze` against all 3 test videos.

4. **The 4 SECURITY DEFINER RPCs** — they're how anon writes to `reports` without a broad UPDATE policy. Don't add an anon UPDATE policy.

5. **`AppliedBadge`** in `components/report/atoms.tsx` — small lime pill shown when a What If toggle is on. The linter recently confirmed its placement; leave as-is.

6. **Storage upload from client direct** — don't proxy through the server, Vercel's 4.5 MB body cap will limit you.

---

## 21 · How to resume cleanly in a new session

```
1. cd "C:\Projects\go viral 8x\metric-fyi"
2. Read this file
3. git log --oneline -20    (see if anything new since `485d3a1`)
4. git status               (confirm the retry feature is still uncommitted)
5. Address §10A first — commit + push the retry feature, give user the SQL
6. Wait for user's phone-test feedback
7. Proceed to tomorrow's path (§11)
```

The codebase is in a known-good state. Build is green, RLS passes 10/10, security audit clean, all five differentiators live. The user is in mobile-testing mode and may surface 1-2 last polish items. After that: Loom, screenshots, submit.

**Don't over-engineer. Ship.**
