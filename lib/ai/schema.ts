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
 */
import { z } from "zod"

/* ── Primitives ─────────────────────────────────────────────── */

export const Timestamp = z.number().min(0).max(600) // 0 → 10min cap
export const Score100 = z.number().min(0).max(100)

/* ── Sections ───────────────────────────────────────────────── */

export const HookAnalysis = z.object({
  /** When the actual "hook" payoff lands (versus where it ideally should). */
  landsAt: Timestamp,
  /** What's specifically broken about the opener. Cite a frame, sound, or word. */
  issue: z.string().min(20),
  /** Concrete cut instruction. "Cut 0.4s–1.4s" or "Open with the third clip." */
  fix: z.string().min(20),
  /** 3 alternative hook lines a creator could try, ranked by predicted lift. */
  alternatives: z
    .array(
      z.object({
        tone: z.enum(["Curiosity", "Contradiction", "Stat", "Pattern-break"]),
        text: z.string().min(8),
        // Clamp defensively rather than failing validation. Gemini's
        // "% lift" predictions are creative guesses — occasionally
        // overshoot. Better to accept a 75 and clamp than to fail the
        // whole analysis because of one field.
        predictedLift: z
          .number()
          .int()
          .min(0)
          .transform((n) => Math.min(100, n)),
      }),
    )
    .length(3),
})

export const PacingAnalysis = z.object({
  cuts: z
    .array(
      z.object({
        at: Timestamp,
        issue: z.string().min(15),
        fix: z.string().min(15),
      }),
    )
    .max(5),
  deadAir: z
    .array(
      z.object({
        start: Timestamp,
        end: Timestamp,
        why: z.string().min(10),
      }),
    )
    .max(5),
  note: z.string().min(30),
})

export const ThumbnailAnalysis = z.object({
  /** Timestamp of the strongest frame to use as a thumbnail. */
  bestFrameAt: Timestamp,
  issue: z.string().min(20),
  fix: z.string().min(20),
})

export const CaptionAnalysis = z.object({
  /** What we extracted from the on-screen text / overlay / spoken intro. */
  original: z.string(),
  /** Filler words to strike through. */
  deadWords: z.array(z.string()).max(8),
  rewrites: z
    .array(
      z.object({
        tone: z.enum([
          "Curiosity",
          "Contradiction",
          "Stat",
          "Conversational",
        ]),
        text: z.string().min(8),
        // Clamp defensively rather than failing validation. Gemini's
        // "% lift" predictions are creative guesses — occasionally
        // overshoot. Better to accept a 75 and clamp than to fail the
        // whole analysis because of one field.
        predictedLift: z
          .number()
          .int()
          .min(0)
          .transform((n) => Math.min(100, n)),
      }),
    )
    .length(3),
})

export const Comparison = z.object({
  /** Delta vs the category's median score. Positive = above, negative = below. */
  vsCategoryMedian: z.number().int().min(-100).max(100),
  /** What this video could score if every recommended fix were applied. */
  ceilingScore: Score100,
  /** What the model thinks the video's category is (so we can show it). */
  inferredCategory: z.string(),
})

/**
 * Trending audio + hashtag recommendations.
 * Note: this is intentionally model-generated suggestions, NOT live trend
 * data. README documents this honestly — a real production version would
 * cross-reference TikTok Sounds / Spotify charts. For V1, the model picks
 * from its training knowledge.
 */
export const TrendingSuggestions = z.object({
  audio: z
    .array(
      z.object({
        name: z.string().min(3),
        why: z.string().min(15),
      }),
    )
    .max(3),
  hashtags: z
    .array(
      z.object({
        tag: z.string().regex(/^#/, "must start with #"),
        why: z.string().min(10),
      }),
    )
    .max(5),
})

/* ── The top-level analysis ─────────────────────────────────── */

export const Analysis = z.object({
  /** 0-100, the headline number. */
  score: Score100,
  /** Editorial italic quote, ~15 words. Will be displayed as the verdict. */
  verdict: z.string().min(30).max(160),
  /** Per-section score breakdown (must agree with the overall score). */
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
})
export type Analysis = z.infer<typeof Analysis>

/**
 * JSON-schema-shaped object Gemini accepts as responseSchema.
 * Gemini's schema dialect is OpenAPI 3.0 subset — no $ref, no oneOf,
 * limited enum/type. We hand-write it to match Zod above so we don't
 * fight zod-to-json-schema's quirks.
 */
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
  ],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    verdict: { type: "string" },
    breakdown: {
      type: "object",
      required: ["hook", "pacing", "thumbnail", "caption"],
      properties: {
        hook: { type: "integer", minimum: 0, maximum: 100 },
        pacing: { type: "integer", minimum: 0, maximum: 100 },
        thumbnail: { type: "integer", minimum: 0, maximum: 100 },
        caption: { type: "integer", minimum: 0, maximum: 100 },
      },
    },
    hook: {
      type: "object",
      required: ["landsAt", "issue", "fix", "alternatives"],
      properties: {
        landsAt: { type: "number" },
        issue: { type: "string" },
        fix: { type: "string" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            required: ["tone", "text", "predictedLift"],
            properties: {
              tone: {
                type: "string",
                enum: ["Curiosity", "Contradiction", "Stat", "Pattern-break"],
              },
              text: { type: "string" },
              predictedLift: { type: "integer", minimum: 0, maximum: 100 },
            },
          },
        },
      },
    },
    pacing: {
      type: "object",
      required: ["cuts", "deadAir", "note"],
      properties: {
        cuts: {
          type: "array",
          items: {
            type: "object",
            required: ["at", "issue", "fix"],
            properties: {
              at: { type: "number" },
              issue: { type: "string" },
              fix: { type: "string" },
            },
          },
        },
        deadAir: {
          type: "array",
          items: {
            type: "object",
            required: ["start", "end", "why"],
            properties: {
              start: { type: "number" },
              end: { type: "number" },
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
        bestFrameAt: { type: "number" },
        issue: { type: "string" },
        fix: { type: "string" },
      },
    },
    caption: {
      type: "object",
      required: ["original", "deadWords", "rewrites"],
      properties: {
        original: { type: "string" },
        deadWords: { type: "array", items: { type: "string" } },
        rewrites: {
          type: "array",
          items: {
            type: "object",
            required: ["tone", "text", "predictedLift"],
            properties: {
              tone: {
                type: "string",
                enum: [
                  "Curiosity",
                  "Contradiction",
                  "Stat",
                  "Conversational",
                ],
              },
              text: { type: "string" },
              predictedLift: { type: "integer", minimum: 0, maximum: 100 },
            },
          },
        },
      },
    },
    comparison: {
      type: "object",
      required: ["vsCategoryMedian", "ceilingScore", "inferredCategory"],
      properties: {
        vsCategoryMedian: { type: "integer" },
        ceilingScore: { type: "integer", minimum: 0, maximum: 100 },
        inferredCategory: { type: "string" },
      },
    },
    trending: {
      type: "object",
      required: ["audio", "hashtags"],
      properties: {
        audio: {
          type: "array",
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
