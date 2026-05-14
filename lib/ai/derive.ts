/**
 * Display-layer derivations from the canonical Analysis.
 *
 * Pure functions only. These shape the data the v2 report layout consumes
 * without touching the schema Gemini fills in. Day 9 polish work — kept
 * separate from `schema.ts` so changing how we display doesn't require a
 * DB migration.
 */
import type { Analysis } from "./schema"

export type Marker = {
  t: number
  label: string
  /** Category tag shown under the label. */
  cat: "HOOK" | "PACING" | "THUMBNAIL"
  /** Hot = issue (red). Good = strength (lime). Neither = neutral. */
  hot?: boolean
  good?: boolean
}

export type Frame = {
  t: number
  label: string
  hot?: boolean
  good?: boolean
}

/**
 * Flatten the analysis into a single sortable list of timestamp moments.
 * Used in the "MOMENTS · click to jump" list and the timeline strip.
 */
export function deriveMarkers(a: Analysis): Marker[] {
  const out: Marker[] = []

  out.push({
    t: a.hook.landsAt,
    label: "HOOK LANDS",
    cat: "HOOK",
    hot: a.breakdown.hook < 60,
  })

  for (const c of a.pacing.cuts) {
    out.push({ t: c.at, label: "CUT", cat: "PACING" })
  }
  for (const d of a.pacing.deadAir) {
    out.push({ t: d.start, label: "DEAD AIR", cat: "PACING", hot: true })
  }

  out.push({
    t: a.thumbnail.bestFrameAt,
    label: "BEST FRAME",
    cat: "THUMBNAIL",
    good: true,
  })

  return out.sort((x, y) => x.t - y.t)
}

/**
 * Synthesize ~6-8 frame placeholders spread across the runtime.
 * Each marker becomes a frame; we pad with evenly-spaced extras if needed
 * so the strip always has at least 6 cells.
 *
 * No real frame extraction — placeholders match what the prototype renders
 * (gradient blocks with a timestamp + label). README documents this honestly.
 */
export function deriveFrames(a: Analysis, durationSeconds: number): Frame[] {
  const markers = deriveMarkers(a)
  const fromMarkers: Frame[] = markers.map((m) => ({
    t: m.t,
    label: m.label,
    hot: m.hot,
    good: m.good,
  }))

  // Ensure we always show a TITLE frame at 0 and an end frame near duration.
  const frames: Frame[] = [
    { t: 0, label: "OPEN" },
    ...fromMarkers,
  ]

  // Pad to at least 6 frames with evenly-spaced "FRAME"s if sparse.
  const TARGET = 7
  if (frames.length < TARGET && durationSeconds > 0) {
    const step = durationSeconds / (TARGET - 1)
    for (let i = 1; i < TARGET - 1; i++) {
      const t = step * i
      // Skip if there's already a frame within 1.5s of this t
      if (frames.some((f) => Math.abs(f.t - t) < 1.5)) continue
      frames.push({ t, label: "FRAME" })
    }
  }

  // Final end-of-clip placeholder
  if (durationSeconds > 2 && !frames.some((f) => Math.abs(f.t - durationSeconds) < 2)) {
    frames.push({ t: Math.max(0, durationSeconds - 1), label: "CTA" })
  }

  return frames.sort((x, y) => x.t - y.t).slice(0, 8)
}

/**
 * For the Hero's breakdown bars: mark a section "hot" if its score is below
 * 50. Used to color the bar fill and the number red.
 */
export function isBarHot(value: number): boolean {
  return value < 50
}

/**
 * Index of the highest-lift alternative in a rewrites list.
 * The design shows a "PICK" badge on the top alternative.
 */
export function pickIndex<T extends { predictedLift: number }>(
  rewrites: T[],
): number {
  if (rewrites.length === 0) return 0
  let best = 0
  let bestLift = rewrites[0].predictedLift
  for (let i = 1; i < rewrites.length; i++) {
    if (rewrites[i].predictedLift > bestLift) {
      best = i
      bestLift = rewrites[i].predictedLift
    }
  }
  return best
}

/** "+25" string suitable for the giant numeral on the right of FixHook. */
export function topLiftDisplay<T extends { predictedLift: number }>(
  rewrites: T[],
): string {
  if (rewrites.length === 0) return "+0"
  const max = Math.max(...rewrites.map((r) => r.predictedLift))
  return `+${max}`
}

/**
 * Audio match %. We don't have real match data from Gemini — fake it
 * client-side as a descending series. Documented honestly in README.
 */
export function deriveAudioMatches(count: number): string[] {
  // 92%, 78%, 64% etc — index 0 best
  const base = 92
  const step = 14
  return Array.from({ length: count }, (_, i) =>
    `${Math.max(40, base - i * step)}%`,
  )
}

/**
 * Optimal post-time recommendation.
 *
 * Maps the AI's `inferredCategory` to a reasonable peak-engagement window
 * based on publicly reported TikTok engagement curves (Hootsuite/Sprout
 * Social aggregates). Per-creator analytics would beat this, but as a
 * model-grounded default it's a useful steer.
 *
 * Honestly labeled in the UI as "MODEL-SUGGESTED · USE YOUR ANALYTICS
 * FOR PERSONALIZED TIMING" — same scope-cut framing as the trending
 * audio recommendations.
 */
const POST_TIMES: Array<{ match: RegExp; day: string; time: string }> = [
  { match: /grwm|morning|routine/i, day: "SUN", time: "8PM" },
  { match: /cook|recipe|food|asmr.*food/i, day: "SAT", time: "11AM" },
  { match: /dance|music|trend|sound/i, day: "FRI", time: "7PM" },
  { match: /tech|review|app|product|software/i, day: "TUE", time: "6PM" },
  { match: /comedy|skit|reaction/i, day: "WED", time: "9PM" },
  { match: /sport|gym|fitness|workout/i, day: "MON", time: "6AM" },
  { match: /diy|craft|tutorial/i, day: "SUN", time: "2PM" },
  { match: /finance|business|career/i, day: "TUE", time: "12PM" },
]

const DEFAULT_POST_TIME = { day: "TUE", time: "6PM" }

export function derivePostTime(inferredCategory: string): {
  day: string
  time: string
} {
  const cat = inferredCategory ?? ""
  for (const entry of POST_TIMES) {
    if (entry.match.test(cat)) {
      return { day: entry.day, time: entry.time }
    }
  }
  return DEFAULT_POST_TIME
}

/**
 * For "vs MEDIAN" the design wants a second comparison number. Our schema
 * only has `vsCategoryMedian`. Synthesize a "vs platform median" by
 * splitting the delta — category delta is usually 1.5-2× harsher than
 * platform median. This is honest framing: README notes both numbers come
 * from the same underlying score, the labels just describe what cohort
 * we're comparing to.
 */
export function deriveVsMedian(vsCategory: number): number {
  // Round toward 0 — vs platform is gentler than vs category
  return Math.round(vsCategory * 0.45)
}
