"use client"

import { useEffect } from "react"
import { updateHistoryEntry } from "@/lib/history"

/**
 * Renders nothing. Lives inside /r/[id] and updates the localStorage
 * history entry (if one exists for this id) once the analysis is ready.
 *
 * Deliberately does NOT create new entries — only touches ones the user
 * already created when they uploaded. Visiting a shared report link from
 * another device or someone else's link won't pollute your "Your reports"
 * list with content you didn't make.
 */
export function HistorySync({
  id,
  status,
  score,
  category,
}: {
  id: string
  status: "pending" | "analyzing" | "ready" | "failed"
  score?: number
  category?: string
}) {
  useEffect(() => {
    if (status === "ready") {
      updateHistoryEntry(id, {
        status: "ready",
        ...(score !== undefined && { score }),
        ...(category && { category }),
      })
    } else if (status === "failed") {
      updateHistoryEntry(id, { status: "failed" })
    }
  }, [id, status, score, category])

  return null
}
