"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { useReport } from "@/contexts/report-context"
import { TimestampChip } from "./TimestampChip"
import { dur, ease, fadeUp, staggerParent } from "@/lib/motion"

/**
 * Renders a completed analysis from context.
 *
 * Reads `analysis` from <ReportProvider> rather than taking it as a prop —
 * means the same component renders both the server-side "status=ready"
 * path and the client-side "PendingClient just finished" path with zero
 * extra plumbing.
 *
 * Every timestamp displayed is wrapped in <TimestampChip>: clicking seeks
 * the video and lights up the matching marker on the timeline overlay.
 * This is Differentiator #2 (visible reasoning) made concrete.
 *
 * Day 9 redesigns the layout. The TimestampChip + ReportProvider logic
 * underneath is portable to whatever visual treatment we land on.
 */
export function ReportView() {
  const { analysis } = useReport()
  if (!analysis) return null

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerParent}
      className="max-w-[1280px] mx-auto px-12 md:px-20 pb-24"
    >
      {/* Score + verdict — the headline */}
      <motion.section {...fadeUp} className="pt-10 pb-12">
        <Label>VIRALITY SCORE</Label>
        <div className="flex items-baseline gap-5 mt-2">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(96px, 16vw, 200px)",
              lineHeight: 0.85,
              letterSpacing: "-0.04em",
              color: "var(--color-signal)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {analysis.score}
          </span>
          <span
            className="font-mono text-sm"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-mute)",
              letterSpacing: "0.1em",
            }}
          >
            / 100
          </span>
          <div
            className="ml-auto text-right font-mono text-[10px] leading-[1.8]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-dim)",
              letterSpacing: "0.1em",
            }}
          >
            CATEGORY ·{" "}
            <span style={{ color: "var(--color-text)" }}>
              {analysis.comparison.inferredCategory.toUpperCase()}
            </span>
            <br />
            vs MEDIAN ·{" "}
            <span
              style={{
                color:
                  analysis.comparison.vsCategoryMedian >= 0
                    ? "var(--color-signal)"
                    : "var(--color-hot)",
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
        <p
          className="mt-6 max-w-[800px]"
          style={{
            fontFamily: "var(--font-italic)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(20px, 2.2vw, 28px)",
            lineHeight: 1.25,
            color: "var(--color-text)",
          }}
        >
          &ldquo;{analysis.verdict}&rdquo;
        </p>
      </motion.section>

      {/* Breakdown bars */}
      <motion.section
        {...fadeUp}
        className="py-6 border-t border-b grid grid-cols-2 md:grid-cols-4 gap-6"
        style={{ borderColor: "var(--color-line)" }}
      >
        <Bar label="HOOK" value={analysis.breakdown.hook} />
        <Bar label="PACING" value={analysis.breakdown.pacing} />
        <Bar label="THUMBNAIL" value={analysis.breakdown.thumbnail} />
        <Bar label="CAPTION" value={analysis.breakdown.caption} />
      </motion.section>

      {/* HOOK */}
      <motion.section {...fadeUp} className="pt-10">
        <Label>
          HOOK · LANDS AT{" "}
          <TimestampChip
            seconds={analysis.hook.landsAt}
            citation="hook"
          />
        </Label>
        <Heading>{analysis.hook.issue}</Heading>
        <FixLine>{analysis.hook.fix}</FixLine>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {analysis.hook.alternatives.map((alt, i) => (
            <Alternative key={i} {...alt} />
          ))}
        </div>
      </motion.section>

      {/* PACING */}
      <motion.section {...fadeUp} className="pt-10">
        <Label>PACING</Label>
        <Heading>{analysis.pacing.note}</Heading>
        {analysis.pacing.cuts.map((c, i) => (
          <TimedItem
            key={`cut-${i}`}
            time={
              <TimestampChip
                seconds={c.at}
                citation={`cut-${i}`}
              />
            }
            kind="cut"
          >
            <strong style={{ color: "var(--color-text)" }}>{c.issue}</strong>{" "}
            <span style={{ color: "var(--color-text-dim)" }}>{c.fix}</span>
          </TimedItem>
        ))}
        {analysis.pacing.deadAir.map((d, i) => (
          <TimedItem
            key={`da-${i}`}
            time={
              <TimestampChip
                seconds={d.start}
                citation={`deadair-${i}`}
                label={`${d.start.toFixed(1)}–${d.end.toFixed(1)}s`}
              />
            }
            kind="deadair"
          >
            {d.why}
          </TimedItem>
        ))}
      </motion.section>

      {/* THUMBNAIL */}
      <motion.section {...fadeUp} className="pt-10">
        <Label>
          THUMBNAIL · BEST FRAME AT{" "}
          <TimestampChip
            seconds={analysis.thumbnail.bestFrameAt}
            citation="thumbnail"
          />
        </Label>
        <Heading>{analysis.thumbnail.issue}</Heading>
        <FixLine>{analysis.thumbnail.fix}</FixLine>
      </motion.section>

      {/* CAPTION */}
      <motion.section {...fadeUp} className="pt-10">
        <Label>CAPTION</Label>
        <p
          className="mt-3 text-base"
          style={{ color: "var(--color-text-dim)" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-mute)",
              letterSpacing: "0.1em",
            }}
          >
            ORIGINAL ·{" "}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-text)",
            }}
          >
            {analysis.caption.original}
          </span>
        </p>
        {analysis.caption.deadWords.length > 0 && (
          <p
            className="mt-2 font-mono text-[11px]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-mute)",
              letterSpacing: "0.05em",
            }}
          >
            DEAD WORDS ·{" "}
            {analysis.caption.deadWords.map((w, i) => (
              <span key={i} style={{ color: "var(--color-hot)" }}>
                {w}
                {i < analysis.caption.deadWords.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        )}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {analysis.caption.rewrites.map((r, i) => (
            <Alternative key={i} {...r} />
          ))}
        </div>
      </motion.section>

      {/* TRENDING */}
      <motion.section {...fadeUp} className="pt-10">
        <Label>TRENDING RECOMMENDATIONS</Label>
        <p
          className="mt-2 font-mono text-[10px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-mute)",
            letterSpacing: "0.1em",
          }}
        >
          NOTE · model-suggested mood/genre, not a live trend feed (see README)
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <SubLabel>AUDIO</SubLabel>
            {analysis.trending.audio.map((a, i) => (
              <TimedItem key={i} time={a.name} kind="cool">
                {a.why}
              </TimedItem>
            ))}
          </div>
          <div>
            <SubLabel>HASHTAGS</SubLabel>
            {analysis.trending.hashtags.map((h, i) => (
              <TimedItem key={i} time={h.tag} kind="cool">
                {h.why}
              </TimedItem>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: dur.element, ease, delay: 1.2 }}
        className="mt-16 pt-6 border-t font-mono text-[10px]"
        style={{
          borderColor: "var(--color-line)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-mute)",
          letterSpacing: "0.15em",
        }}
      >
        Analysis complete · scored by gemini-flash-latest · click any timestamp to jump the video to that moment
      </motion.div>
    </motion.div>
  )
}

/* ── Small atoms ──────────────────────────────────────────── */

function Label({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-mono text-[11px] flex items-center gap-1.5"
      style={{
        fontFamily: "var(--font-mono)",
        color: "var(--color-text-mute)",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  )
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-mono text-[10px] mb-3"
      style={{
        fontFamily: "var(--font-mono)",
        color: "var(--color-text-mute)",
        letterSpacing: "0.15em",
      }}
    >
      {children}
    </div>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mt-3 max-w-[820px]"
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(22px, 2.6vw, 32px)",
        lineHeight: 1.18,
        letterSpacing: "-0.015em",
        color: "var(--color-text)",
        fontWeight: 500,
      }}
    >
      {children}
    </h2>
  )
}

function FixLine({ children }: { children: ReactNode }) {
  return (
    <p
      className="mt-3 max-w-[820px] text-[15px] leading-relaxed"
      style={{ color: "var(--color-text-dim)" }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-signal)",
          letterSpacing: "0.15em",
          marginRight: 8,
        }}
      >
        FIX
      </span>
      {children}
    </p>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  const color =
    value < 40
      ? "var(--color-hot)"
      : value < 60
        ? "var(--color-gold)"
        : "var(--color-signal)"
  return (
    <div>
      <div
        className="flex justify-between font-mono text-[10px] mb-2"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-mute)",
          letterSpacing: "0.1em",
        }}
      >
        <span>{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div
        className="h-1 relative"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  )
}

function Alternative({
  tone,
  text,
  predictedLift,
}: {
  tone: string
  text: string
  predictedLift: number
}) {
  const isHero = predictedLift >= 25
  return (
    <div
      className="border p-4 transition-[border-color,background] duration-[220ms]"
      style={{
        background: isHero ? "rgba(198,255,61,0.05)" : "transparent",
        borderColor: isHero
          ? "var(--color-signal)"
          : "var(--color-line)",
      }}
    >
      <div
        className="flex justify-between font-mono text-[10px]"
        style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}
      >
        <span
          style={{
            color: isHero ? "var(--color-signal)" : "var(--color-gold)",
          }}
        >
          +{predictedLift}% LIFT
        </span>
        <span style={{ color: "var(--color-text-mute)" }}>{tone}</span>
      </div>
      <p
        className="mt-3 text-[14px] leading-snug"
        style={{ color: "var(--color-text)" }}
      >
        {text}
      </p>
    </div>
  )
}

function TimedItem({
  time,
  kind,
  children,
}: {
  time: ReactNode
  kind: "cut" | "deadair" | "cool"
  children: ReactNode
}) {
  const color =
    kind === "cut"
      ? "var(--color-gold)"
      : kind === "deadair"
        ? "var(--color-hot)"
        : "var(--color-cool)"
  return (
    <div
      className="mt-4 pl-4 max-w-[820px]"
      style={{ borderLeft: `2px solid ${color}` }}
    >
      <div
        className="mb-1.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color,
          letterSpacing: "0.1em",
        }}
      >
        {time}
      </div>
      <div
        className="text-[14px] leading-relaxed"
        style={{ color: "var(--color-text-dim)" }}
      >
        {children}
      </div>
    </div>
  )
}
