"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { ReportView } from "./ReportView"
import type { Analysis } from "@/lib/ai/schema"
import { dur, ease } from "@/lib/motion"

type Phase =
  | { kind: "idle" }
  | { kind: "analyzing"; elapsedMs: number }
  | { kind: "ready"; analysis: Analysis }
  | { kind: "error"; message: string }

/**
 * Client component for the in-progress analysis state.
 *
 * On mount:
 *   1. Fires POST /api/analyze/[id] (the route is idempotent — safe to retry)
 *   2. Renders a skeleton + a live-elapsed counter while waiting
 *   3. On success: renders the full ReportView in place
 *   4. On failure: shows the error + a retry button
 *
 * Day 5 will replace the skeleton with the streamed score-counter +
 * progressive section reveal. For Day 4 the skeleton stays simple.
 */
export function PendingClient({ id }: { id: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const startedAt = useRef<number>(0)
  const fired = useRef(false)

  // tick the live elapsed counter so the page feels alive during the wait
  useEffect(() => {
    if (phase.kind !== "analyzing") return
    const t = setInterval(
      () =>
        setPhase((p) =>
          p.kind === "analyzing"
            ? { kind: "analyzing", elapsedMs: Date.now() - startedAt.current }
            : p,
        ),
      120,
    )
    return () => clearInterval(t)
  }, [phase.kind])

  // fire the analyze call exactly once on mount
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    startedAt.current = Date.now()
    setPhase({ kind: "analyzing", elapsedMs: 0 })

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
          setPhase({ kind: "ready", analysis: body.analysis as Analysis })
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
  }, [id])

  if (phase.kind === "ready") {
    return <ReportView analysis={phase.analysis} />
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
          onClick={() => {
            fired.current = false
            setPhase({ kind: "idle" })
            // re-trigger by reloading the page (server fetches fresh state)
            window.location.reload()
          }}
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

  // analyzing / idle — show the skeleton
  const elapsed = phase.kind === "analyzing" ? phase.elapsedMs : 0

  return (
    <div className="max-w-[1280px] mx-auto px-12 md:px-20 pt-12">
      <div className="flex items-center gap-3 font-mono text-[11px]"
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

      {/* Skeleton placeholders so the page doesn't look empty */}
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
        referencing against category baselines. This takes 25–40 seconds for
        most short clips on the free tier.
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
