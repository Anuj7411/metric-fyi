import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { createClient } from "@/lib/supabase/server"
import { Analysis } from "@/lib/ai/schema"

/**
 * Dynamic Open Graph image for /r/[id].
 *
 * When a report URL is pasted into Twitter/LinkedIn/Slack/Discord, the
 * social-card unfurl renders this 1200×630 PNG. Designed to function as
 * a standalone screenshot — score is the hero, verdict is the proof,
 * brand mark establishes credibility.
 *
 * Runtime: Node (we read the Clash Display font file from disk). Cached
 * by Vercel's edge based on the URL, regenerates only when the deploy
 * changes or revalidation fires.
 */
export const runtime = "nodejs"
export const contentType = "image/png"
export const size = { width: 1200, height: 630 }
export const alt = "METRIC.fyi — virality score report"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Report = {
  id: string
  status: string
  analysis: unknown
}

type RenderData = {
  score: number
  verdict: string
  category: string
  shortId: string
  ceiling: number
  ready: boolean
}

async function loadData(id: string): Promise<RenderData> {
  const fallback: RenderData = {
    score: 0,
    verdict: "Paste a video. Get the brutally honest reason it isn't going off.",
    category: "VIDEO",
    shortId: id.slice(0, 6).toUpperCase(),
    ceiling: 0,
    ready: false,
  }

  if (!UUID_RE.test(id)) return fallback

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .rpc("fetch_report", { p_id: id })
      .single<Report>()

    if (error || !data || !data.id || data.status !== "ready" || !data.analysis) {
      return fallback
    }

    const parsed = Analysis.safeParse(data.analysis)
    if (!parsed.success) return fallback

    const a = parsed.data
    return {
      score: a.score,
      verdict: a.verdict,
      category: a.comparison.inferredCategory,
      shortId: id.slice(0, 6).toUpperCase(),
      ceiling: a.comparison.ceilingScore,
      ready: true,
    }
  } catch {
    return fallback
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await loadData(id)

  // Truncate the verdict so it fits in 2-3 lines at 32px
  const verdict =
    data.verdict.length > 140
      ? data.verdict.slice(0, 137).trimEnd() + "…"
      : data.verdict

  // Clash Display — loaded from public/fonts. System serif italic fallback
  // for the editorial verdict (avoids loading a second font in the OG path).
  const clashData = await readFile(
    join(process.cwd(), "public/fonts/ClashDisplay-Variable.ttf"),
  )

  // Colors (same tokens as the app)
  const INK = "#0E0D0B"
  const SIGNAL = "#C6FF3D"
  const TEXT = "#F5F1E8"
  const DIM = "#A8A092"
  const MUTE = "#6B6557"
  const LINE = "rgba(255,245,210,0.10)"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: INK,
          color: TEXT,
          display: "flex",
          flexDirection: "column",
          padding: 64,
          position: "relative",
          fontFamily: '"Clash Display"',
        }}
      >
        {/* Faint background grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
            backgroundSize: "120px 120px",
            opacity: 0.5,
            display: "flex",
          }}
        />

        {/* Giant transparent score watermark */}
        <div
          style={{
            position: "absolute",
            right: -60,
            top: -100,
            fontSize: 720,
            lineHeight: 1,
            color: "rgba(198,255,61,0.04)",
            letterSpacing: "-0.06em",
            fontWeight: 700,
            display: "flex",
          }}
        >
          {data.score}
        </div>

        {/* Top — brand mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            zIndex: 2,
          }}
        >
          <div style={{ width: 22, height: 22, background: SIGNAL, display: "flex" }} />
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.05em",
              color: TEXT,
            }}
          >
            METRIC.fyi
          </span>
          <span
            style={{
              marginLeft: 16,
              fontSize: 16,
              color: DIM,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            REPORT · /r/{data.shortId.toLowerCase()}
          </span>
        </div>

        {/* Score + meta */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 28,
            marginTop: 56,
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: 320,
              fontWeight: 600,
              lineHeight: 0.78,
              color: SIGNAL,
              letterSpacing: "-0.05em",
              display: "flex",
            }}
          >
            {data.score}
          </span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              paddingBottom: 28,
              gap: 18,
            }}
          >
            <span
              style={{
                fontSize: 22,
                color: MUTE,
                letterSpacing: "0.18em",
                display: "flex",
              }}
            >
              / 100
            </span>
            <span
              style={{
                fontSize: 20,
                color: DIM,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              {data.category}
            </span>
            {data.ready && (
              <span
                style={{
                  fontSize: 18,
                  color: SIGNAL,
                  letterSpacing: "0.15em",
                  display: "flex",
                }}
              >
                CEILING · {data.ceiling} ↑
              </span>
            )}
          </div>
        </div>

        {/* Verdict */}
        <div
          style={{
            fontSize: 34,
            lineHeight: 1.28,
            color: TEXT,
            marginTop: 36,
            maxWidth: 980,
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
            zIndex: 2,
            display: "flex",
          }}
        >
          &ldquo;{verdict}&rdquo;
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
            fontSize: 16,
            color: MUTE,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            paddingTop: 36,
            borderTop: `1px solid ${LINE}`,
            zIndex: 2,
          }}
        >
          <span style={{ display: "flex" }}>
            Scored by Gemini · See the full breakdown
          </span>
          <span style={{ display: "flex" }}>metric-fyi.vercel.app</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Clash Display",
          data: clashData,
          style: "normal",
          weight: 600,
        },
      ],
    },
  )
}
