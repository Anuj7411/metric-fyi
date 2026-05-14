"use client"

import { toast } from "sonner"
import { useReport } from "@/contexts/report-context"
import {
  deriveAudioMatches,
  deriveVsMedian,
  isBarHot,
  pickIndex,
  topLiftDisplay,
} from "@/lib/ai/derive"
import type { Analysis } from "@/lib/ai/schema"
import { useVideoFrames } from "@/hooks/useVideoFrames"
import { MonoTag, Pill, Watermark, btnStyle } from "./atoms"
import { VideoSection } from "./VideoPlayer"
import { WhatIfSimulator } from "./WhatIfSimulator"

/**
 * v2 report layout — Hero + VideoSection + 4 FixSections + ApplyCTA + Trending.
 * Mobile-first; switches to denser desktop layout at md+.
 *
 * Reads analysis from <ReportProvider>. Day 9's polish landed here.
 */
export function ReportView({ videoUrl }: { videoUrl: string }) {
  const { analysis } = useReport()
  if (!analysis) return null

  return (
    <div
      style={{
        background: "var(--color-ink)",
        color: "var(--color-text)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Hero analysis={analysis} />
      <VideoSection videoUrl={videoUrl} />
      <FixHook analysis={analysis} />
      <FixPacing analysis={analysis} />
      <FixThumbnail analysis={analysis} videoUrl={videoUrl} />
      <FixCaption analysis={analysis} />
      <WhatIfSimulator />
      <Trending analysis={analysis} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   HERO — score + verdict + breakdown bars
   ───────────────────────────────────────────────────────────── */

function Hero({ analysis }: { analysis: Analysis }) {
  const vsMedian = deriveVsMedian(analysis.comparison.vsCategoryMedian)
  const bars = [
    { l: "HOOK", v: analysis.breakdown.hook },
    { l: "PACING", v: analysis.breakdown.pacing },
    { l: "THUMBNAIL", v: analysis.breakdown.thumbnail },
    { l: "CAPTION", v: analysis.breakdown.caption },
  ]

  return (
    <section
      className="relative overflow-hidden border-b px-6 md:px-14 py-10 md:py-14"
      style={{ borderColor: "var(--color-line)" }}
    >
      <Watermark size={560} opacity={0.05} right={-30} top={-50}>
        {analysis.score}
      </Watermark>

      <div className="relative grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-8 md:gap-16 items-end">
        {/* Left: score + verdict */}
        <div>
          <div className="flex items-center gap-2.5 mb-4 flex-wrap">
            <MonoTag>VIRALITY · @anonymous</MonoTag>
            <Pill>{analysis.comparison.inferredCategory}</Pill>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--color-text-mute)",
                letterSpacing: "0.15em",
              }}
            >
              JUST NOW
            </span>
          </div>

          <div className="flex items-baseline gap-5">
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "clamp(140px, 22vw, 280px)",
                lineHeight: 0.78,
                color: "var(--color-signal)",
                letterSpacing: "-0.05em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {analysis.score}
            </span>
            <div className="pb-4">
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-text-mute)",
                  letterSpacing: "0.18em",
                }}
              >
                / 100
              </div>
              <div
                className="mt-4 hidden sm:block"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-text-dim)",
                  letterSpacing: "0.1em",
                  lineHeight: 1.85,
                }}
              >
                vs MEDIAN ·{" "}
                <span
                  style={{
                    color: vsMedian < 0 ? "var(--color-hot)" : "var(--color-signal)",
                  }}
                >
                  {vsMedian >= 0 ? "+" : ""}
                  {vsMedian}
                </span>
                <br />
                vs CATEGORY ·{" "}
                <span
                  style={{
                    color:
                      analysis.comparison.vsCategoryMedian < 0
                        ? "var(--color-hot)"
                        : "var(--color-signal)",
                  }}
                >
                  {analysis.comparison.vsCategoryMedian >= 0 ? "+" : ""}
                  {analysis.comparison.vsCategoryMedian}
                </span>
                <br />
                CEILING ·{" "}
                <span style={{ color: "var(--color-signal)" }}>
                  {analysis.comparison.ceilingScore} ↑
                </span>
              </div>
            </div>
          </div>

          {/* Mobile-only mini meta row */}
          <div
            className="sm:hidden grid grid-cols-3 gap-3 mt-3"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text-dim)",
              letterSpacing: "0.08em",
            }}
          >
            <span>
              vs MEDIAN ·{" "}
              <span style={{ color: vsMedian < 0 ? "var(--color-hot)" : "var(--color-signal)" }}>
                {vsMedian >= 0 ? "+" : ""}
                {vsMedian}
              </span>
            </span>
            <span>
              vs CAT ·{" "}
              <span style={{ color: "var(--color-hot)" }}>
                {analysis.comparison.vsCategoryMedian >= 0 ? "+" : ""}
                {analysis.comparison.vsCategoryMedian}
              </span>
            </span>
            <span>
              CEIL ·{" "}
              <span style={{ color: "var(--color-signal)" }}>
                {analysis.comparison.ceilingScore}↑
              </span>
            </span>
          </div>

          <p
            className="mt-6 max-w-[600px]"
            style={{
              fontFamily: "var(--font-italic)",
              fontStyle: "italic",
              fontSize: "clamp(18px, 2.2vw, 26px)",
              lineHeight: 1.3,
              color: "var(--color-text)",
              letterSpacing: "-0.005em",
            }}
          >
            &ldquo;{analysis.verdict}&rdquo;
          </p>
        </div>

        {/* Right: breakdown bars */}
        <div className="flex flex-col gap-3 md:gap-4">
          {bars.map((b) => {
            const hot = isBarHot(b.v)
            return (
              <div key={b.l}>
                <div className="flex justify-between items-baseline mb-2">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--color-text-dim)",
                      letterSpacing: "0.15em",
                    }}
                  >
                    {b.l}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "clamp(24px, 3.4vw, 36px)",
                      color: hot ? "var(--color-hot)" : "var(--color-signal)",
                      letterSpacing: "-0.02em",
                      lineHeight: 0.9,
                    }}
                  >
                    {b.v}
                  </span>
                </div>
                <div
                  className="relative"
                  style={{
                    height: 4,
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="absolute top-0 bottom-0 left-0"
                    style={{
                      width: `${b.v}%`,
                      background: hot ? "var(--color-hot)" : "var(--color-signal)",
                      transition: "width 600ms cubic-bezier(.2,.8,.2,1)",
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   FIX HOOK — fix 01 with top-lift numeral
   ───────────────────────────────────────────────────────────── */

function FixHook({ analysis }: { analysis: Analysis }) {
  const pick = pickIndex(analysis.hook.alternatives)
  const topLift = topLiftDisplay(analysis.hook.alternatives)
  const hot = analysis.breakdown.hook < 60

  return (
    <FixSectionShell
      number="01"
      cat="HOOK"
      timeLabel={`LANDS AT ${analysis.hook.landsAt.toFixed(1)}s`}
      timeColor={hot ? "var(--color-hot)" : "var(--color-signal)"}
      diagnosis={analysis.hook.issue}
      rightCol={
        <TopLiftBlock value={topLift} label="% LIFT" />
      }
    >
      <FixBlock>{analysis.hook.fix}</FixBlock>
      <RewritesGrid
        rewrites={analysis.hook.alternatives.map((a) => ({
          tone: a.tone,
          text: a.text,
          predictedLift: a.predictedLift,
        }))}
        pickIdx={pick}
      />
    </FixSectionShell>
  )
}

/* ─────────────────────────────────────────────────────────────
   FIX PACING — fix 02 with issue list
   ───────────────────────────────────────────────────────────── */

function FixPacing({ analysis }: { analysis: Analysis }) {
  const { seekTo } = useReport()
  const issues = [
    ...analysis.pacing.cuts.map((c) => ({
      t: `${c.at.toFixed(1)}s`,
      seekAt: c.at,
      head: c.issue,
      body: c.fix,
    })),
    ...analysis.pacing.deadAir.map((d) => ({
      t: `${d.start.toFixed(1)}–${d.end.toFixed(1)}s`,
      seekAt: d.start,
      head: "Dead air range.",
      body: d.why,
    })),
  ]

  return (
    <FixSectionShell number="02" cat="PACING" diagnosis={analysis.pacing.note}>
      <div
        className="mt-6 flex flex-col"
        style={{ background: "var(--color-line)", gap: 1 }}
      >
        {issues.map((isu, i) => (
          <div
            key={i}
            className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-4 md:gap-8 p-5 md:p-7 items-start"
            style={{ background: "var(--color-ink)" }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: 28,
                  color: "var(--color-signal)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {isu.t}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--color-text-mute)",
                  letterSpacing: "0.18em",
                  marginTop: 6,
                }}
              >
                ISSUE 0{i + 1}
              </div>
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: "clamp(16px, 2vw, 22px)",
                  lineHeight: 1.25,
                  letterSpacing: "-0.01em",
                  margin: 0,
                  color: "var(--color-text)",
                }}
              >
                {isu.head}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--color-text-dim)",
                  margin: "8px 0 0",
                  maxWidth: 620,
                }}
              >
                {isu.body}
              </p>
            </div>
            <button
              onClick={() => seekTo(isu.seekAt)}
              style={{
                ...btnStyle("ghost", "small"),
                whiteSpace: "nowrap",
                fontSize: 10,
              }}
            >
              ↗ JUMP TO {isu.t}
            </button>
          </div>
        ))}
      </div>
    </FixSectionShell>
  )
}

/* ─────────────────────────────────────────────────────────────
   FIX THUMBNAIL — fix 03 with current vs proposed
   ───────────────────────────────────────────────────────────── */

function FixThumbnail({
  analysis,
  videoUrl,
}: {
  analysis: Analysis
  videoUrl: string
}) {
  // Extract two real frames from the source video:
  //   [0] = current cover frame (just past 0s to dodge black opening)
  //   [1] = the AI's proposed best-frame timestamp
  // Same hook the timeline strip uses; the second hidden <video> reuses
  // the browser's HTTP cache so there's no double download.
  const bestT = analysis.thumbnail.bestFrameAt
  const extracted = useVideoFrames(videoUrl, [0.05, bestT], {
    maxWidth: 260,
    quality: 0.75,
  })

  return (
    <FixSectionShell
      number="03"
      cat="THUMBNAIL"
      timeLabel={`BEST FRAME AT ${bestT.toFixed(1)}s`}
      timeColor="var(--color-signal)"
      diagnosis={analysis.thumbnail.issue}
      rightCol={
        <div className="grid grid-cols-2 gap-3 mt-4 md:mt-0">
          <ThumbBox
            label="CURRENT"
            sub="FRAME 0 · GENERIC"
            hot
            imageUrl={extracted[0]}
            fallback="Frame 0"
          />
          <ThumbBox
            label="PROPOSED"
            sub={`FRAME ${bestT.toFixed(1)}s`}
            good
            imageUrl={extracted[1]}
            fallback="Best frame"
          />
        </div>
      }
    >
      <FixBlock>{analysis.thumbnail.fix}</FixBlock>
    </FixSectionShell>
  )
}

/* ─────────────────────────────────────────────────────────────
   FIX CAPTION — fix 04 with strikethrough deadwords
   ───────────────────────────────────────────────────────────── */

function FixCaption({ analysis }: { analysis: Analysis }) {
  const pick = pickIndex(analysis.caption.rewrites)
  const deadWordsLower = analysis.caption.deadWords.map((w) => w.toLowerCase())

  return (
    <FixSectionShell number="04" cat="CAPTION" diagnosis={null}>
      <MonoTag>ORIGINAL CAPTION</MonoTag>
      <div
        className="mt-3 max-w-[920px]"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(16px, 2vw, 24px)",
          lineHeight: 1.45,
          color: "var(--color-text)",
        }}
      >
        {analysis.caption.original.split(" ").map((w, i) => {
          const clean = w.replace(/[.,!?]/g, "").toLowerCase()
          const dead = deadWordsLower.includes(clean)
          return (
            <span key={i}>
              {dead ? (
                <span
                  style={{
                    background: "var(--color-hot-tint)",
                    color: "var(--color-hot)",
                    padding: "1px 4px",
                    textDecoration: "line-through",
                    textDecorationColor: "rgba(255,74,28,0.6)",
                  }}
                >
                  {w}
                </span>
              ) : (
                w
              )}{" "}
            </span>
          )
        })}
      </div>
      {analysis.caption.deadWords.length > 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-hot)",
            letterSpacing: "0.18em",
            marginTop: 12,
          }}
        >
          {analysis.caption.deadWords.length} DEAD WORD ·{" "}
          {analysis.caption.deadWords.join(" · ").toUpperCase()}
        </div>
      )}
      <div className="mt-8">
        <MonoTag>3 REWRITES</MonoTag>
        <RewritesGrid
          rewrites={analysis.caption.rewrites.map((r) => ({
            tone: r.tone,
            text: r.text,
            predictedLift: r.predictedLift,
          }))}
          pickIdx={pick}
        />
      </div>
    </FixSectionShell>
  )
}

/* ─────────────────────────────────────────────────────────────
   APPLY CTA — huge lime block
   ───────────────────────────────────────────────────────────── */

function ApplyCTA({ analysis }: { analysis: Analysis }) {
  return (
    <section className="px-6 md:px-14 py-8 md:py-12">
      <div
        className="relative overflow-hidden px-6 py-7 md:px-12 md:py-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 md:gap-12 items-center"
        style={{
          background: "var(--color-signal)",
          color: "var(--color-ink)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: -40,
            top: -60,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 480,
            lineHeight: 1,
            color: "rgba(14,13,11,0.08)",
            letterSpacing: "-0.06em",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {analysis.comparison.ceilingScore}
        </div>
        <div className="relative">
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              marginBottom: 8,
              color: "rgba(14,13,11,0.7)",
            }}
          >
            APPLY ALL 4 FIXES →
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "clamp(40px, 7vw, 72px)",
              lineHeight: 0.9,
              letterSpacing: "-0.03em",
            }}
          >
            {analysis.score} →{" "}
            <em
              style={{
                fontFamily: "var(--font-italic)",
                fontStyle: "italic",
                fontWeight: 500,
              }}
            >
              {analysis.comparison.ceilingScore}
            </em>
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(13px, 1.5vw, 16px)",
              marginTop: 10,
              opacity: 0.75,
              maxWidth: 560,
            }}
          >
            That&apos;s a tier-1 video. Re-record with this checklist and re-score.
          </div>
        </div>
        <button
          onClick={() =>
            toast("Re-record checklist coming soon.", {
              description: "Day 9+1 ships the editable checklist + re-upload flow.",
            })
          }
          className="relative w-full md:w-auto"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.12em",
            background: "var(--color-ink)",
            color: "var(--color-signal)",
            border: "none",
            padding: "18px 28px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          RE-RECORD CHECKLIST ↗
        </button>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   TRENDING — audio + hashtags
   ───────────────────────────────────────────────────────────── */

function Trending({ analysis }: { analysis: Analysis }) {
  const matches = deriveAudioMatches(analysis.trending.audio.length)

  return (
    <section
      className="relative overflow-hidden border-t px-6 md:px-14 py-10 md:py-14"
      style={{ borderColor: "var(--color-line)" }}
    >
      <Watermark size={400} opacity={0.025} right={20} top={20}>
        05
      </Watermark>

      <div className="relative mb-8">
        <MonoTag>TRENDING RECOMMENDATIONS</MonoTag>
        <h2
          className="m-0 mt-2"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "clamp(28px, 4vw, 42px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          What to{" "}
          <em
            style={{
              fontStyle: "italic",
              color: "var(--color-signal)",
              fontFamily: "var(--font-italic)",
            }}
          >
            pair this with
          </em>
          .
        </h2>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-mute)",
            letterSpacing: "0.15em",
            marginTop: 4,
          }}
        >
          NOTE · MODEL-SUGGESTED MOOD/GENRE, NOT A LIVE TREND FEED
        </div>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6">
        {/* Audio */}
        <div>
          <MonoTag>AUDIO</MonoTag>
          <div className="flex flex-col gap-2.5 mt-3">
            {analysis.trending.audio.map((a, i) => (
              <div
                key={i}
                className="p-5"
                style={{
                  background: "var(--color-ink-2)",
                  border: `1px solid ${i === 0 ? "var(--color-signal)" : "var(--color-line)"}`,
                }}
              >
                <div className="flex justify-between items-start gap-6">
                  <div className="flex-1">
                    <div
                      style={{
                        fontFamily: "var(--font-italic)",
                        fontStyle: "italic",
                        fontSize: 18,
                        lineHeight: 1.35,
                        color: "var(--color-text)",
                      }}
                    >
                      &ldquo;{a.name}&rdquo;
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--color-text-dim)",
                        marginTop: 8,
                        maxWidth: 520,
                      }}
                    >
                      {a.why}
                    </div>
                  </div>
                  <div className="text-right shrink-0" style={{ minWidth: 70 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: 22,
                        color:
                          i === 0
                            ? "var(--color-signal)"
                            : "var(--color-text)",
                        letterSpacing: "-0.02em",
                        lineHeight: 0.9,
                      }}
                    >
                      {matches[i]}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        color: "var(--color-text-mute)",
                        letterSpacing: "0.15em",
                        marginTop: 4,
                      }}
                    >
                      MATCH
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div>
          <MonoTag>HASHTAGS · USE TOP 4</MonoTag>
          <div className="flex flex-col gap-2 mt-3">
            {analysis.trending.hashtags.map((h, i) => (
              <div
                key={i}
                className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3 px-4 py-3 items-baseline"
                style={{
                  background:
                    i < 4 ? "var(--color-signal-tint)" : "transparent",
                  border: `1px solid ${i < 4 ? "var(--color-signal)" : "var(--color-line)"}`,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 14,
                    color:
                      i < 4 ? "var(--color-signal)" : "var(--color-text-dim)",
                    fontWeight: 500,
                  }}
                >
                  {h.tag}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-dim)",
                    lineHeight: 1.4,
                  }}
                >
                  {h.why}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const tagStack = analysis.trending.hashtags
                .slice(0, 4)
                .map((h) => h.tag)
                .join(" ")
              navigator.clipboard
                ?.writeText(tagStack)
                .then(() =>
                  toast.success("Tag stack copied", { description: tagStack }),
                )
                .catch(() =>
                  toast.error("Copy failed — select the tags manually"),
                )
            }}
            style={{
              ...btnStyle("ghost", "default"),
              marginTop: 12,
              width: "100%",
              textAlign: "center" as const,
              padding: "14px 0",
              fontSize: 11,
            }}
          >
            ↗ COPY TAG STACK
          </button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   Shared atoms used across the fix sections
   ───────────────────────────────────────────────────────────── */

function FixSectionShell({
  number,
  cat,
  timeLabel,
  timeColor,
  diagnosis,
  rightCol,
  children,
}: {
  number: string
  cat: string
  timeLabel?: string
  timeColor?: string
  diagnosis: string | null
  rightCol?: React.ReactNode
  children: React.ReactNode
}) {
  const isHot = cat === "HOOK"
  const hasRight = !!rightCol

  return (
    <section
      className="relative overflow-hidden border-b px-6 md:px-14 py-12 md:py-18"
      style={{ borderColor: "var(--color-line)" }}
    >
      <Watermark size={620} opacity={0.045} right={-80} top={-100}>
        {number}
      </Watermark>

      <div
        className={`relative grid grid-cols-1 ${hasRight ? "md:grid-cols-[140px_1fr_minmax(200px,_320px)]" : "md:grid-cols-[140px_1fr]"} gap-6 md:gap-12 items-start`}
      >
        {/* Left rail — number + category pill */}
        <div className="md:border-r md:pr-8" style={{ borderColor: "var(--color-line)" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text-mute)",
              letterSpacing: "0.18em",
              marginBottom: 8,
            }}
          >
            FIX · {number}
          </div>
          <Pill color={isHot ? "var(--color-hot)" : "var(--color-signal)"}>
            {cat}
          </Pill>
          {timeLabel && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: timeColor ?? "var(--color-signal)",
                letterSpacing: "0.12em",
                marginTop: 14,
              }}
            >
              {timeLabel}
            </div>
          )}
        </div>

        {/* Middle — diagnosis + provided children */}
        <div className="max-w-[760px]">
          {diagnosis && (
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "clamp(24px, 3.4vw, 44px)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                margin: 0,
                color: "var(--color-text)",
              }}
            >
              {diagnosis}
            </h2>
          )}
          {children}
        </div>

        {/* Right column — top lift block or thumbnail comparison */}
        {rightCol && <div>{rightCol}</div>}
      </div>
    </section>
  )
}

function FixBlock({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative mt-6 md:mt-8 p-5 md:p-6"
      style={{
        background: "var(--color-ink-2)",
        border: "1px solid var(--color-signal)",
      }}
    >
      <div
        className="absolute"
        style={{
          top: -1,
          left: -1,
          background: "var(--color-signal)",
          color: "var(--color-ink)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.15em",
          padding: "4px 10px",
          fontWeight: 600,
        }}
      >
        FIX
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(14px, 1.7vw, 18px)",
          lineHeight: 1.5,
          color: "var(--color-text)",
          paddingTop: 8,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function RewritesGrid({
  rewrites,
  pickIdx,
}: {
  rewrites: Array<{ tone: string; text: string; predictedLift: number }>
  pickIdx: number
}) {
  return (
    <div className="mt-6">
      <MonoTag>3 REWRITES · ORDERED BY PREDICTED LIFT</MonoTag>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {rewrites.map((r, i) => {
          const picked = i === pickIdx
          return (
            <div
              key={i}
              className="relative p-4 md:p-5"
              style={{
                background: picked ? "var(--color-signal-tint)" : "transparent",
                border: `1px solid ${picked ? "var(--color-signal)" : "var(--color-line)"}`,
              }}
            >
              {picked && (
                <div
                  className="absolute"
                  style={{
                    top: -1,
                    right: -1,
                    background: "var(--color-signal)",
                    color: "var(--color-ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.15em",
                    padding: "3px 7px",
                    fontWeight: 600,
                  }}
                >
                  PICK
                </div>
              )}
              <div className="flex justify-between items-baseline">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: picked ? "var(--color-signal)" : "var(--color-text-dim)",
                    letterSpacing: "0.12em",
                  }}
                >
                  {r.tone.toUpperCase()}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: 20,
                    color: "var(--color-signal)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  +{r.predictedLift}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-italic)",
                  fontStyle: "italic",
                  fontSize: 15,
                  lineHeight: 1.4,
                  color: picked ? "var(--color-text)" : "var(--color-text-dim)",
                  marginTop: 10,
                }}
              >
                &ldquo;{r.text}&rdquo;
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopLiftBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center md:text-right">
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-mute)",
          letterSpacing: "0.2em",
          marginBottom: 4,
        }}
      >
        TOP LIFT
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "clamp(72px, 10vw, 120px)",
          lineHeight: 0.85,
          color: "var(--color-signal)",
          letterSpacing: "-0.04em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-mute)",
          letterSpacing: "0.2em",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function ThumbBox({
  label,
  sub,
  hot,
  good,
  imageUrl,
  fallback,
}: {
  label: string
  sub: string
  hot?: boolean
  good?: boolean
  /** Data URL of an extracted video frame. Renders when available. */
  imageUrl?: string
  /** Text shown in the placeholder while extraction is in flight. */
  fallback: string
}) {
  const color = hot ? "var(--color-hot)" : "var(--color-signal)"
  return (
    <div>
      <MonoTag color={color}>{label}</MonoTag>
      <div
        className="relative mt-2 overflow-hidden"
        style={{
          aspectRatio: "9 / 16",
          background: imageUrl
            ? "#000"
            : hot
              ? "#000"
              : "linear-gradient(180deg,#4a3a1a,#291f0f)",
          border: `1px solid ${color}`,
        }}
      >
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {/* Soft color wash matching the section's accent — preserves
                the hot/good encoding even when the frame itself is neutral */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: hot
                  ? "linear-gradient(180deg, rgba(255,74,28,0.18), transparent 50%)"
                  : "linear-gradient(180deg, rgba(198,255,61,0.16), transparent 50%)",
                mixBlendMode: "screen",
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center p-3">
            {good && (
              <div
                aria-hidden
                className="absolute"
                style={{
                  inset: "30% 18%",
                  background: "rgba(232,177,74,0.4)",
                  border: "1px solid rgba(232,177,74,0.7)",
                }}
              />
            )}
            <div
              style={{
                position: "relative",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                color: "white",
                fontWeight: 600,
                lineHeight: 1.4,
                zIndex: 1,
              }}
            >
              {fallback}
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color,
          letterSpacing: "0.15em",
          marginTop: 6,
        }}
      >
        {sub}
      </div>
    </div>
  )
}
