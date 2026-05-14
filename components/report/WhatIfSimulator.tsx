"use client"

import { useEffect, useState } from "react"
import { animate, motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  APPLIED_KEYS,
  useReport,
  type AppliedKey,
} from "@/contexts/report-context"
import { pickIndex } from "@/lib/ai/derive"
import { MonoTag } from "./atoms"
import { ease } from "@/lib/motion"

/**
 * The "What If?" simulator — toggle each fix on/off and watch the
 * projected score morph live toward the ceiling.
 *
 * Replaces the static "RE-RECORD CHECKLIST" CTA from the v2 design with
 * an interactive playground. State lives in ReportContext so other
 * sections (FixThumbnail, FixCaption, etc) can read `applied` and
 * coordinate their own "fixed" rendering — that's stage 2.
 *
 * The 4 fixes contribute equally to the score delta. With 0 toggles the
 * projected score equals the current score; with 4 toggles it equals
 * the ceiling. Each in between is a proportional step.
 */
export function WhatIfSimulator() {
  const { analysis, applied, toggleApplied, resetApplied, appliedCount } =
    useReport()

  // We always compute hooks at the top — the early return below depends on
  // analysis but we need to call hooks unconditionally first.
  const baseScore = analysis?.score ?? 0
  const ceiling = analysis?.comparison.ceilingScore ?? 0
  const delta = Math.max(0, ceiling - baseScore)
  const perFix = delta / 4
  const projected = Math.min(ceiling, baseScore + appliedCount * perFix)

  // Animated display number — fluid count-up driven by framer-motion's
  // animate() with an onUpdate callback that pushes the rounded value
  // into React state.
  const [displayScore, setDisplayScore] = useState(baseScore)
  useEffect(() => {
    const controls = animate(displayScore, projected, {
      duration: 0.7,
      ease,
      onUpdate: (v) => setDisplayScore(v),
    })
    return () => controls.stop()
    // displayScore intentionally omitted — we only re-animate when the
    // *target* (projected) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projected])

  if (!analysis) return null

  const isFull = appliedCount === 4
  const shownScore = Math.round(displayScore)

  return (
    <section className="px-6 md:px-14 py-8 md:py-12">
      <div
        className="relative overflow-hidden p-6 md:p-10"
        style={{
          background: "var(--color-signal)",
          color: "var(--color-ink)",
        }}
      >
        {/* Giant ceiling watermark — same trick as the v2 design */}
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
            userSelect: "none",
          }}
        >
          {ceiling}
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 lg:gap-14 items-end">
          {/* Left: title + animated score */}
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "rgba(14,13,11,0.7)",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              WHAT IF? · TOGGLE EACH FIX
            </div>

            <div
              className="flex items-baseline gap-3 md:gap-5"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: 0.9,
              }}
            >
              {/* Animated projected score */}
              <span
                style={{
                  fontSize: "clamp(80px, 14vw, 156px)",
                  color: "var(--color-ink)",
                  fontVariantNumeric: "tabular-nums",
                  minWidth: "2.5ch",
                }}
              >
                {shownScore}
              </span>

              {/* Arrow + ceiling */}
              <span
                style={{
                  fontSize: "clamp(28px, 4vw, 48px)",
                  color: "rgba(14,13,11,0.5)",
                  paddingBottom: "0.1em",
                }}
              >
                →
              </span>
              <span
                style={{
                  fontSize: "clamp(40px, 6vw, 72px)",
                  fontStyle: "italic",
                  fontFamily: "var(--font-italic)",
                  fontWeight: 500,
                  color: isFull
                    ? "var(--color-ink)"
                    : "rgba(14,13,11,0.55)",
                  paddingBottom: "0.05em",
                  transition: "color 220ms cubic-bezier(.2,.8,.2,1)",
                }}
              >
                {ceiling}
              </span>

              {/* Tier-1 badge appears when all 4 applied */}
              <AnimatePresence>
                {isFull && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.7, x: -8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.3, ease }}
                    style={{
                      display: "inline-block",
                      marginLeft: 8,
                      padding: "6px 12px",
                      background: "var(--color-ink)",
                      color: "var(--color-signal)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      letterSpacing: "0.15em",
                      fontWeight: 700,
                    }}
                  >
                    TIER-1 ✓
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Subtitle — morphs with applied state */}
            <AnimatePresence mode="wait">
              <motion.div
                key={subtitleKey(appliedCount, isFull)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease }}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(14px, 1.6vw, 16px)",
                  marginTop: 14,
                  maxWidth: 580,
                  color: "rgba(14,13,11,0.85)",
                  lineHeight: 1.5,
                }}
              >
                {subtitleFor(appliedCount, ceiling, baseScore)}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {appliedCount > 0 && !isFull && (
                <button
                  onClick={resetApplied}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.15em",
                    color: "rgba(14,13,11,0.7)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 0",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  RESET
                </button>
              )}
              <button
                onClick={() => copyChecklist(analysis)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                  color: "var(--color-signal)",
                  background: "var(--color-ink)",
                  border: "1px solid var(--color-ink)",
                  cursor: "pointer",
                  padding: "10px 16px",
                }}
              >
                ↗ COPY CHECKLIST
              </button>
            </div>
          </div>

          {/* Right: 4 toggle cards (2x2 desktop, stack on mobile) */}
          <div className="grid grid-cols-2 gap-2.5 md:gap-3 lg:min-w-[420px]">
            {APPLIED_KEYS.map((k) => (
              <FixToggle
                key={k}
                fixKey={k}
                active={applied[k]}
                onToggle={toggleApplied}
                perFixDelta={perFix}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Toggle card ────────────────────────────────────────────── */

const TOGGLE_LABELS: Record<
  AppliedKey,
  { title: string; sub: string }
> = {
  hook: { title: "HOOK", sub: "Use the picked rewrite" },
  pacing: { title: "PACING", sub: "Apply timing edits" },
  thumbnail: { title: "THUMBNAIL", sub: "Swap to best frame" },
  caption: { title: "CAPTION", sub: "Use the picked rewrite" },
}

function FixToggle({
  fixKey,
  active,
  onToggle,
  perFixDelta,
}: {
  fixKey: AppliedKey
  active: boolean
  onToggle: (k: AppliedKey) => void
  perFixDelta: number
}) {
  const { title, sub } = TOGGLE_LABELS[fixKey]
  return (
    <button
      onClick={() => onToggle(fixKey)}
      aria-pressed={active}
      style={{
        all: "unset",
        cursor: "pointer",
        position: "relative",
        padding: "16px 16px 14px",
        background: active ? "var(--color-ink)" : "rgba(14,13,11,0.08)",
        color: active ? "var(--color-signal)" : "var(--color-ink)",
        border: `1.5px solid ${active ? "var(--color-ink)" : "rgba(14,13,11,0.18)"}`,
        transition: "all 220ms cubic-bezier(.2,.8,.2,1)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div className="flex justify-between items-center">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.15em",
          }}
        >
          {title}
        </span>
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: active ? "var(--color-signal)" : "transparent",
            border: `1.5px solid ${active ? "var(--color-signal)" : "rgba(14,13,11,0.3)"}`,
            color: "var(--color-ink)",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {active ? "✓" : ""}
        </span>
      </div>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          color: active ? "rgba(245,241,232,0.85)" : "rgba(14,13,11,0.7)",
          lineHeight: 1.35,
        }}
      >
        {sub}
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "-0.02em",
          color: active ? "var(--color-signal)" : "rgba(14,13,11,0.5)",
          marginTop: 4,
          lineHeight: 0.9,
        }}
      >
        +{Math.round(perFixDelta)}
      </span>
    </button>
  )
}

/**
 * Build a plain-text checklist of all 4 fixes the user can paste into
 * Notion / their editor / a sticky note. Each item names the category,
 * the timestamp (where relevant), and the concrete fix instruction.
 */
function copyChecklist(analysis: {
  score: number
  comparison: { ceilingScore: number; inferredCategory: string }
  hook: {
    landsAt: number
    fix: string
    alternatives: Array<{ tone: string; text: string; predictedLift: number }>
  }
  pacing: {
    cuts: Array<{ at: number; fix: string }>
    deadAir: Array<{ start: number; end: number; why: string }>
  }
  thumbnail: { bestFrameAt: number; fix: string }
  caption: {
    rewrites: Array<{ tone: string; text: string; predictedLift: number }>
  }
}): void {
  const pickedHook = analysis.hook.alternatives[pickIndex(analysis.hook.alternatives)]
  const pickedCaption =
    analysis.caption.rewrites[pickIndex(analysis.caption.rewrites)]

  const lines: string[] = []
  lines.push(`METRIC.fyi RE-RECORD CHECKLIST`)
  lines.push(
    `Current ${analysis.score} → Ceiling ${analysis.comparison.ceilingScore} · ${analysis.comparison.inferredCategory}`,
  )
  lines.push(``)
  lines.push(`☐ HOOK · lands at ${analysis.hook.landsAt.toFixed(1)}s`)
  lines.push(`   ${analysis.hook.fix}`)
  if (pickedHook) {
    lines.push(
      `   New line (${pickedHook.tone}, +${pickedHook.predictedLift}%): "${pickedHook.text}"`,
    )
  }
  lines.push(``)
  lines.push(`☐ PACING · ${analysis.pacing.cuts.length + analysis.pacing.deadAir.length} edits`)
  for (const c of analysis.pacing.cuts) {
    lines.push(`   • ${c.at.toFixed(1)}s — ${c.fix}`)
  }
  for (const d of analysis.pacing.deadAir) {
    lines.push(
      `   • ${d.start.toFixed(1)}–${d.end.toFixed(1)}s dead air — ${d.why}`,
    )
  }
  lines.push(``)
  lines.push(`☐ THUMBNAIL · best frame at ${analysis.thumbnail.bestFrameAt.toFixed(1)}s`)
  lines.push(`   ${analysis.thumbnail.fix}`)
  lines.push(``)
  lines.push(`☐ CAPTION`)
  if (pickedCaption) {
    lines.push(
      `   New caption (${pickedCaption.tone}, +${pickedCaption.predictedLift}%): "${pickedCaption.text}"`,
    )
  }
  lines.push(``)
  lines.push(`— METRIC.fyi · re-record with this list, then re-score.`)

  const text = lines.join("\n")
  navigator.clipboard
    ?.writeText(text)
    .then(() =>
      toast.success("Checklist copied", {
        description: "Paste into Notion / your editor.",
        duration: 3000,
      }),
    )
    .catch(() => toast.error("Copy failed"))
}

function subtitleFor(
  count: number,
  ceiling: number,
  baseScore: number,
): string {
  if (count === 4) {
    return `Top 12% in this category. Re-record with this checklist and re-score — you've got ${ceiling - baseScore} points of room.`
  }
  if (count === 0) {
    return `Toggle each fix to watch your score climb. All four checked = ceiling.`
  }
  if (count === 3) {
    return `One fix away from tier-1.`
  }
  return `${4 - count} fixes left to reach ${ceiling}.`
}

function subtitleKey(count: number, full: boolean): string {
  if (full) return "full"
  if (count === 0) return "empty"
  if (count === 3) return "almost"
  return "middle"
}
