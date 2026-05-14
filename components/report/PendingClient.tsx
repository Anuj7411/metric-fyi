"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { ReportView } from "./ReportView"
import { useReport } from "@/contexts/report-context"
import type { Analysis } from "@/lib/ai/schema"
import { dur, ease } from "@/lib/motion"

type Phase =
  | { kind: "loading"; elapsedMs: number }
  | { kind: "error"; message: string }

/**
 * Client component for the in-progress state.
 *
 *   - Fires POST /api/analyze/[id] exactly once on mount
 *   - Shows a shimmer skeleton + live-elapsed counter while waiting
 *   - On success, calls setAnalysis() on the context — the context-aware
 *     ReportView (rendered from this same component) picks up the data
 *     and renders the full report in place. The VideoPlayer above stays
 *     mounted across the transition, so anyone watching their video
 *     during the wait keeps their playback position.
 *   - On failure, shows the error + a Retry button.
 */
export function PendingClient({ id, videoUrl }: { id: string; videoUrl: string }) {
  const { setAnalysis, analysis } = useReport()
  const [phase, setPhase] = useState<Phase>({ kind: "loading", elapsedMs: 0 })
  const startedAt = useRef<number>(0)
  const fired = useRef(false)

  // Tick the elapsed counter while loading
  useEffect(() => {
    if (phase.kind !== "loading") return
    const t = setInterval(
      () =>
        setPhase((p) =>
          p.kind === "loading"
            ? { kind: "loading", elapsedMs: Date.now() - startedAt.current }
            : p,
        ),
      120,
    )
    return () => clearInterval(t)
  }, [phase.kind])

  // Fire the analyze call exactly once
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    startedAt.current = Date.now()

    fetch(`/api/analyze/${id}`, { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setPhase({
            kind: "error",
            message:
              body?.message ?? body?.error ?? `analyze failed (${res.status})`,
          })
          return
        }
        if (body.status === "ready" && body.analysis) {
          setAnalysis(body.analysis as Analysis)
        } else {
          setPhase({
            kind: "error",
            message: `unexpected status: ${body.status}`,
          })
        }
      })
      .catch((err) => {
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : "network error",
        })
      })
  }, [id, setAnalysis])

  // If the analysis arrived (via setAnalysis above), defer to ReportView.
  if (analysis) {
    return <ReportView videoUrl={videoUrl} />
  }

  if (phase.kind === "error") {
    return (
      <div className="max-w-[1280px] mx-auto px-12 md:px-20 pt-12">
        <div
          className="font-mono text-[11px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-hot)",
            letterSpacing: "0.2em",
          }}
        >
          ANALYSIS FAILED
        </div>
        <h1
          className="mt-3 font-semibold"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(40px, 6vw, 72px)",
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
          }}
        >
          Something went wrong.
        </h1>
        <p
          className="mt-4 max-w-[640px] font-mono text-[12px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-dim)",
          }}
        >
          {phase.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-8 font-mono text-[12px] tracking-[0.1em] uppercase px-6 py-3"
          style={{
            fontFamily: "var(--font-mono)",
            background: "var(--color-signal)",
            color: "var(--color-ink)",
            border: "none",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  // Loading — shimmer skeleton with live elapsed counter
  const elapsed = phase.elapsedMs

  return (
    <div className="max-w-[1280px] mx-auto px-12 md:px-20 pt-12">
      <div
        className="flex items-center gap-3 font-mono text-[11px]"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-mute)",
          letterSpacing: "0.2em",
        }}
      >
        <span
          className="inline-block w-1.5 h-1.5"
          style={{
            background: "var(--color-signal)",
            animation: "pulse 1.6s ease-in-out infinite",
          }}
        />
        ANALYZING · {(elapsed / 1000).toFixed(1)}s ELAPSED
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur.element, ease }}
        className="mt-4 font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(56px, 9vw, 108px)",
          lineHeight: 0.96,
          letterSpacing: "-0.025em",
        }}
      >
        Analyzing
        <span style={{ color: "var(--color-signal)" }}>…</span>
      </motion.h1>

      <div className="mt-12 max-w-[820px] space-y-4">
        <Skeleton width="78%" />
        <Skeleton width="92%" />
        <Skeleton width="64%" />
      </div>

      <p
        className="mt-12 max-w-[640px] font-mono text-[12px] leading-relaxed"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-mute)",
        }}
      >
        Reading the video frame by frame. Listening to the audio. Cross-
        referencing against category baselines. While you wait, the player
        above is yours to scrub.
      </p>

      <style>{`@keyframes pulse { 0%,100% {opacity:1} 50% {opacity:0.3} }
        @keyframes shimmer { 0% { background-position: -1000px 0 } 100% { background-position: 1000px 0 } }
      `}</style>
    </div>
  )
}

function Skeleton({ width = "100%" }: { width?: string }) {
  return (
    <div
      className="h-4"
      style={{
        width,
        background:
          "linear-gradient(90deg, rgba(255,245,210,0.04) 25%, rgba(255,245,210,0.12) 50%, rgba(255,245,210,0.04) 75%)",
        backgroundSize: "1000px 100%",
        animation: "shimmer 2.4s linear infinite",
      }}
    />
  )
}
