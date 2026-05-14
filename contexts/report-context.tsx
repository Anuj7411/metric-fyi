"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import type { Analysis } from "@/lib/ai/schema"

/**
 * The interactive-state spine of a /r/[id] page.
 *
 * Owns:
 *   - The single <video> ref so VideoPlayer and citation chips can drive it
 *     from anywhere in the report.
 *   - `analysis` state — seeded from the server when status='ready', or
 *     set by PendingClient when the analyze fetch returns.
 *   - `activeCitationId` — the chip the user just clicked, drives the
 *     "you clicked this" glow on chips and timeline markers.
 *
 * Day 9 visual polish will reuse this verbatim; the seek/citation logic
 * is portable across any layout treatment.
 */
type Citation =
  | { kind: "hook" }
  | { kind: "cut"; index: number }
  | { kind: "deadair"; index: number }
  | { kind: "thumbnail" }

export type CitationId =
  | "hook"
  | `cut-${number}`
  | `deadair-${number}`
  | "thumbnail"

export function citationId(c: Citation): CitationId {
  switch (c.kind) {
    case "hook":
      return "hook"
    case "cut":
      return `cut-${c.index}`
    case "deadair":
      return `deadair-${c.index}`
    case "thumbnail":
      return "thumbnail"
  }
}

/**
 * The 4 fix keys driving the What If? simulator. Each toggle in
 * WhatIfSimulator flips one of these; other sections (FixThumbnail,
 * caption, etc) can read `applied[key]` to coordinate their own
 * "fixed" rendering state.
 */
export const APPLIED_KEYS = ["hook", "pacing", "thumbnail", "caption"] as const
export type AppliedKey = (typeof APPLIED_KEYS)[number]
export type AppliedState = Record<AppliedKey, boolean>

const INITIAL_APPLIED: AppliedState = {
  hook: false,
  pacing: false,
  thumbnail: false,
  caption: false,
}

type ReportContextValue = {
  /** Attach to the <video> element in VideoPlayer. */
  videoRef: RefObject<HTMLVideoElement | null>
  /** Imperatively seek the video to a timestamp (in seconds). Auto-plays. */
  seekTo: (seconds: number, citation?: CitationId) => void
  /** The citation chip that was just clicked. Auto-clears after 1.6s. */
  activeCitationId: CitationId | null
  /** The analysis JSON. Null while pending/analyzing. */
  analysis: Analysis | null
  setAnalysis: (a: Analysis | null) => void
  /** Which fixes the user has toggled on in the What If? simulator. */
  applied: AppliedState
  /** Flip one fix's state. */
  toggleApplied: (key: AppliedKey) => void
  /** Clear all applied fixes back to default. */
  resetApplied: () => void
  /** Cached count of true entries in `applied` (0–4). */
  appliedCount: number
}

const ReportContext = createContext<ReportContextValue | null>(null)

export function ReportProvider({
  initialAnalysis,
  children,
}: {
  initialAnalysis: Analysis | null
  children: ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(initialAnalysis)
  const [activeCitationId, setActiveCitationId] =
    useState<CitationId | null>(null)
  const [applied, setApplied] = useState<AppliedState>(INITIAL_APPLIED)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleApplied = useCallback((key: AppliedKey) => {
    setApplied((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const resetApplied = useCallback(() => {
    setApplied(INITIAL_APPLIED)
  }, [])

  const appliedCount = useMemo(
    () => APPLIED_KEYS.reduce((n, k) => n + (applied[k] ? 1 : 0), 0),
    [applied],
  )

  const seekTo = useCallback(
    (seconds: number, citation?: CitationId) => {
      const v = videoRef.current
      if (v) {
        v.currentTime = Math.max(0, seconds)
        // Auto-play after seek so the user immediately sees the cited moment.
        // Some browsers reject programmatic play() if the user hasn't
        // interacted yet — that's fine, the seek itself still landed.
        v.play().catch(() => {})
      }
      if (citation) {
        setActiveCitationId(citation)
        if (clearTimer.current) clearTimeout(clearTimer.current)
        clearTimer.current = setTimeout(() => {
          setActiveCitationId(null)
        }, 1600)
      }
    },
    [],
  )

  return (
    <ReportContext.Provider
      value={{
        videoRef,
        seekTo,
        activeCitationId,
        analysis,
        setAnalysis,
        applied,
        toggleApplied,
        resetApplied,
        appliedCount,
      }}
    >
      {children}
    </ReportContext.Provider>
  )
}

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext)
  if (!ctx) {
    throw new Error("useReport must be used inside <ReportProvider>")
  }
  return ctx
}
