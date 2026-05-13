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

### What's left

- Day 2: visual system polish, custom shadcn primitives, dual-entry hero (file drop + sample picker)
- Day 3: upload pipeline, Supabase Storage, `reports` table with RLS
- Day 4: Gemini 2.0 Flash analysis backend + the prompt
- Day 5: streaming reveal + report layout
- Day 6: visible reasoning (citations) + video player coupling
- Days 7–10: shareable report, auth + history, mobile + perf, Loom + submit
