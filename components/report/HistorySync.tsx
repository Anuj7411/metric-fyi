"use client"

import { useEffect } from "react"
import { updateHistoryEntry } from "@/lib/history"
import { useReport } from "@/contexts/report-context"

/**
 * Renders nothing. Lives inside <ReportProvider> and keeps the
 * localStorage history entry for this id in sync with the page state.
 *
 * Reads `analysis` from context (not from props) so it reacts to BOTH:
 *   - server-rendered `ready` reports — analysis comes via the provider's
 *     `initialAnalysis` prop and is present on first render
 *   - server-rendered `pending` reports — PendingClient fetches the
 *     analysis and calls setAnalysis(); HistorySync re-runs its effect
 *     once analysis lands and writes the score + category into
 *     localStorage. Without this, an upload-then-watch flow would leave
 *     the history entry stuck on "PENDING" until the user manually
 *     reloads the report URL.
 *
 * Deliberately does NOT create new entries — `updateHistoryEntry` only
 * touches ones that already exist. Visiting a shared report link from
 * another device or someone else's link doesn't pollute your "History"
 * list with content you didn't make.
 */
export function HistorySync({
  id,
  initialStatus,
}: {
  id: string
  /** The DB-side status at SSR time. Used only to detect 'failed'. */
  initialStatus: "pending" | "analyzing" | "ready" | "failed"
}) {
  const { analysis } = useReport()

  useEffect(() => {
    if (analysis) {
      // Either an SSR-ready report OR PendingClient just landed the data.
      updateHistoryEntry(id, {
        status: "ready",
        score: analysis.score,
        category: analysis.comparison.inferredCategory,
      })
    } else if (initialStatus === "failed") {
      updateHistoryEntry(id, { status: "failed" })
    }
    // pending / analyzing → leave the entry untouched (still 'pending')
  }, [id, analysis, initialStatus])

  return null
}
