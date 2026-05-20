/**
 * Canonical analysis schema.
 *
 * Single source of truth for what Gemini returns. Drives:
 *   - The prompt's responseSchema (forced JSON mode)
 *   - The Zod parser the server uses to validate
 *   - The TypeScript type the client renders against
 *
 * Covers all 6 brief features:
 *   1. Virality score (0-100) ......... score
 *   2. Hook analysis (first 3s) ....... hook
 *   3. Caption optimization ........... caption.rewrites
 *   4. Thumbnail rating ............... thumbnail (cover frame)
 *   5. Competitor comparison .......... comparison (cohort delta)
 *   6. Trending audio/hashtag ......... trending (curated, labeled honest)
 *
 * --- Schema philosophy (post-bug-fix) ---
 *
 * Resilience > strictness. A single Gemini overshoot on a creative field
 * (e.g. predictedLift: 65 vs. our cap of 60) was failing the entire
 * analysis. This schema now defends against that by:
 *
 *   1. Numbers — never reject. Use .transform() to clamp into the valid
 *      range. If Gemini hallucinates a 10000% lift, we silently clip it
 *      to 100 and accept.
 *   2. Strings — drop tight minimum-length checks. Gemini sometimes
 *      writes terse output; that's a prompt issue, not a data validity
 *      issue. Empty strings still fail (min 1).
 *   3. Arrays — accept generous upper bounds, slice to the UI's expected
 *      shape via .transform(). No more "exactly 3 rewrites" rejection.
 *   4. Enums — drop the constrained tone lists. Display whatever label
 *      Gemini picks; the UI doesn't depend on specific tone values.
 *   5. Regex — auto-fix instead of reject (e.g. hashtag missing '#' →
 *      prepend it).
 *
 * Net effect: an analysis can only fail validation if Gemini returns
 * fundamentally malformed JSON (missing required fields, wrong types).
 * Any quality issue lands in the UI for the user to judge, not as a
 * 500 error.
 *
 * The Gemini-side JSON schema (ANALYSIS_RESPONSE_SCHEMA below) carries
 * tighter bounds to encourage Gemini to constrain itself during
 * generation. Both layers cooperate; Zod is the last-resort safety net.
 */
import { z } from "zod"

export const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const

// Matches the Gemini inline-analysis ceiling. Kept in sync with
// lib/schemas/report.ts. The DB CHECK on reports.file_size still
// allows up to 100 MiB for forward-compat with the Files API path.
export const MAX_BYTES = 20 * 1024 * 1024 // 20 MiB

export const ReportStatus = z.enum([
  "pending",
  "analyzing",
  "ready",
  "failed",
])
export type ReportStatus = z.infer<typeof ReportStatus>

/* ── Primitives (all defensively clamped) ──────────────────── */

/** Seconds, clamped to a 2-hour ceiling. */
export const Timestamp = z
  .number()
  .min(0)
  .transform((n) => Math.min(7200, n))

/** 0-100 score, clamped if Gemini overshoots either bound. */
export const Score100 = z
  .number()
  .transform((n) => Math.max(0, Math.min(100, Math.round(n))))

/** "% predicted lift" on rewrite cards. Clamp 0-100. */
const PredictedLift = z
  .number()
  .int()
  .min(0)
  .transform((n) => Math.min(100, n))

/** A short user-facing string. Just non-empty, no length floor. */
const ShortString = z.string().min(1)

/* ── /api/upload/init ─────────────────────────────────────────── */

export const UploadInitRequest = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_BYTES),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
})
export type UploadInitRequest = z.infer<typeof UploadInitRequest>

export const UploadInitResponse = z.object({
  id: z.string().uuid(),
  storagePath: z.string(),
})
export type UploadInitResponse = z.infer<typeof UploadInitResponse>

/* ── Sections of the Analysis ─────────────────────────────────── */

const RewriteCard = z.object({
  /** Free-form tone label. Was an enum; relaxed so Gemini can pick
   *  any descriptor it thinks fits — the UI just displays the string. */
  tone: z.string().min(1),
  text: ShortString,
  predictedLift: PredictedLift,
})

export const HookAnalysis = z.object({
  /** When the actual "hook" payoff lands (vs. where it ideally should). */
  landsAt: Timestamp,
  /** What's broken about the opener. */
  issue: ShortString,
  /** Concrete cut/edit instruction. */
  fix: ShortString,
  /** Up to 3 alternative hook lines — slice if Gemini returned more. */
  alternatives: z
    .array(RewriteCard)
    .max(10)
    .transform((arr) => arr.slice(0, 3)),
})

export const PacingAnalysis = z.object({
  cuts: z
    .array(
      z.object({
        at: Timestamp,
        issue: ShortString,
        fix: ShortString,
      }),
    )
    .max(20)
    .transform((arr) => arr.slice(0, 5)),
  deadAir: z
    .array(
      z.object({
        start: Timestamp,
        end: Timestamp,
        why: ShortString,
      }),
    )
    .max(20)
    .transform((arr) => arr.slice(0, 5)),
  note: ShortString,
})

export const ThumbnailAnalysis = z.object({
  /** Timestamp of the strongest frame to use as a thumbnail. */
  bestFrameAt: Timestamp,
  issue: ShortString,
  fix: ShortString,
})

export const CaptionAnalysis = z.object({
  /** What we extracted from the on-screen text / overlay / spoken intro. */
  original: z.string(),
  /** Up to 8 filler words to strike through. */
  deadWords: z
    .array(z.string())
    .max(50)
    .transform((arr) => arr.slice(0, 8)),
  /** Up to 3 rewrites — slice if Gemini returned more. */
  rewrites: z
    .array(RewriteCard)
    .max(10)
    .transform((arr) => arr.slice(0, 3)),
})

/** Signed integer delta in [-100,+100]. Independent of category. */
const SignedDelta = z
  .number()
  .int()
  .transform((n) => Math.max(-100, Math.min(100, n)))

export const Comparison = z.object({
  /** Delta vs. category median (specific vertical, e.g. "GRWM creators"). */
  vsCategoryMedian: SignedDelta,
  /** Delta vs. platform median (all short-form). Optional for back-compat
   *  with older reports written before this field existed. */
  vsPlatformMedian: SignedDelta.optional(),
  /** What this video could score if every fix were applied. Always
   *  >= the headline score (we don't enforce that — UI tolerates it). */
  ceilingScore: Score100,
  /** Inferred content vertical. */
  inferredCategory: ShortString,
})

/** Day-of-week token Gemini may emit. Free-form 3-letter uppercase. */
const DayToken = z
  .string()
  .min(1)
  .transform((s) => s.trim().slice(0, 3).toUpperCase())

/** Time-of-day token. Free-form (e.g. "6PM", "11AM", "8:30PM"). */
const TimeToken = z
  .string()
  .min(1)
  .transform((s) => s.trim().toUpperCase().replace(/\s+/g, ""))

/** Model-grounded posting-window recommendation. Optional for back-compat. */
export const OptimalPostTime = z.object({
  day: DayToken,
  time: TimeToken,
  why: ShortString,
})

/**
 * Trending audio + hashtag recommendations.
 * Honest framing: this is model-generated content, NOT live trend data.
 * The audio.name field holds a mood/genre descriptor (e.g. "tension-
 * building cinematic synth"), not a real track title — see prompt.ts.
 */
export const TrendingSuggestions = z.object({
  audio: z
    .array(
      z.object({
        name: ShortString,
        why: ShortString,
      }),
    )
    .max(10)
    .transform((arr) => arr.slice(0, 3)),
  hashtags: z
    .array(
      z.object({
        // Auto-prefix '#' if Gemini forgot it. Used to be a regex reject;
        // that was brittle.
        tag: z
          .string()
          .min(1)
          .transform((s) =>
            s.startsWith("#") ? s : `#${s.replace(/^\s+/, "")}`,
          ),
        why: ShortString,
      }),
    )
    .max(15)
    .transform((arr) => arr.slice(0, 5)),
})

/* ── The top-level Analysis ───────────────────────────────────── */

export const Analysis = z.object({
  /** 0-100, the headline number. */
  score: Score100,
  /** Editorial italic quote shown as the verdict. Truncate to 240 chars
   *  if Gemini wrote a paragraph (rare but possible). */
  verdict: z
    .string()
    .min(1)
    .transform((s) => (s.length > 240 ? s.slice(0, 237) + "…" : s)),
  /** Per-section score breakdown. */
  breakdown: z.object({
    hook: Score100,
    pacing: Score100,
    thumbnail: Score100,
    caption: Score100,
  }),
  hook: HookAnalysis,
  pacing: PacingAnalysis,
  thumbnail: ThumbnailAnalysis,
  caption: CaptionAnalysis,
  comparison: Comparison,
  trending: TrendingSuggestions,
  /** Optional — older reports won't have this; UI falls back to deriver. */
  optimalPostTime: OptimalPostTime.optional(),
})
export type Analysis = z.infer<typeof Analysis>

/**
 * JSON-schema-shaped object Gemini accepts as `responseSchema`.
 *
 * This is the FIRST line of defence — bounds declared here ask Gemini to
 * constrain itself during generation. Zod above is the safety net for
 * when Gemini ignores its own contract.
 *
 * Gemini's schema dialect is an OpenAPI 3.0 subset — no $ref, no oneOf,
 * limited enum/type. Hand-written to keep Gemini's tokenizer happy.
 */
const TIMESTAMP_SCHEMA = { type: "number", minimum: 0, maximum: 7200 } as const
const SCORE_SCHEMA = { type: "integer", minimum: 0, maximum: 100 } as const
const LIFT_SCHEMA = { type: "integer", minimum: 0, maximum: 100 } as const

const REWRITE_CARD_SCHEMA = {
  type: "object",
  required: ["tone", "text", "predictedLift"],
  properties: {
    tone: { type: "string" },
    text: { type: "string" },
    predictedLift: LIFT_SCHEMA,
  },
} as const

export const ANALYSIS_RESPONSE_SCHEMA = {
  type: "object",
  required: [
    "score",
    "verdict",
    "breakdown",
    "hook",
    "pacing",
    "thumbnail",
    "caption",
    "comparison",
    "trending",
    "optimalPostTime",
  ],
  properties: {
    score: SCORE_SCHEMA,
    verdict: { type: "string", maxLength: 240 },
    breakdown: {
      type: "object",
      required: ["hook", "pacing", "thumbnail", "caption"],
      properties: {
        hook: SCORE_SCHEMA,
        pacing: SCORE_SCHEMA,
        thumbnail: SCORE_SCHEMA,
        caption: SCORE_SCHEMA,
      },
    },
    hook: {
      type: "object",
      required: ["landsAt", "issue", "fix", "alternatives"],
      properties: {
        landsAt: TIMESTAMP_SCHEMA,
        issue: { type: "string" },
        fix: { type: "string" },
        alternatives: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: REWRITE_CARD_SCHEMA,
        },
      },
    },
    pacing: {
      type: "object",
      required: ["cuts", "deadAir", "note"],
      properties: {
        cuts: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            required: ["at", "issue", "fix"],
            properties: {
              at: TIMESTAMP_SCHEMA,
              issue: { type: "string" },
              fix: { type: "string" },
            },
          },
        },
        deadAir: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            required: ["start", "end", "why"],
            properties: {
              start: TIMESTAMP_SCHEMA,
              end: TIMESTAMP_SCHEMA,
              why: { type: "string" },
            },
          },
        },
        note: { type: "string" },
      },
    },
    thumbnail: {
      type: "object",
      required: ["bestFrameAt", "issue", "fix"],
      properties: {
        bestFrameAt: TIMESTAMP_SCHEMA,
        issue: { type: "string" },
        fix: { type: "string" },
      },
    },
    caption: {
      type: "object",
      required: ["original", "deadWords", "rewrites"],
      properties: {
        original: { type: "string" },
        deadWords: { type: "array", maxItems: 8, items: { type: "string" } },
        rewrites: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: REWRITE_CARD_SCHEMA,
        },
      },
    },
    comparison: {
      type: "object",
      required: [
        "vsCategoryMedian",
        "vsPlatformMedian",
        "ceilingScore",
        "inferredCategory",
      ],
      properties: {
        vsCategoryMedian: { type: "integer", minimum: -100, maximum: 100 },
        vsPlatformMedian: { type: "integer", minimum: -100, maximum: 100 },
        ceilingScore: SCORE_SCHEMA,
        inferredCategory: { type: "string" },
      },
    },
    optimalPostTime: {
      type: "object",
      required: ["day", "time", "why"],
      properties: {
        day: { type: "string" },
        time: { type: "string" },
        why: { type: "string" },
      },
    },
    trending: {
      type: "object",
      required: ["audio", "hashtags"],
      properties: {
        audio: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            required: ["name", "why"],
            properties: {
              name: { type: "string" },
              why: { type: "string" },
            },
          },
        },
        hashtags: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            required: ["tag", "why"],
            properties: {
              tag: { type: "string" },
              why: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const
