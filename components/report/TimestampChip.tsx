"use client"

import { useReport, type CitationId } from "@/contexts/report-context"

/**
 * Small clickable timestamp marker. Clicking seeks the video to `seconds`
 * and lights up the matching citation chip + its timeline marker for 1.6s.
 *
 * Used inline anywhere a section displays a timestamp:
 *   - "HOOK · LANDS AT 1.8s"  (citation = "hook")
 *   - "5.2s · The transition is too slow"  (citation = "cut-0")
 *   - "10.2–11.8s · The screen is static"  (citation = "deadair-0")
 *   - "THUMBNAIL · BEST FRAME AT 17.5s"  (citation = "thumbnail")
 */
type Props = {
  seconds: number
  citation: CitationId
  /** Display label — overridable, defaults to "1.8s" formatting. */
  label?: string
  /** Optional accent color override (defaults to the citation's natural color). */
  color?: string
}

const NATURAL_COLOR: Record<string, string> = {
  hook: "var(--color-signal)",
  thumbnail: "var(--color-cool)",
}

export function TimestampChip({ seconds, citation, label, color }: Props) {
  const { seekTo, activeCitationId } = useReport()
  const active = activeCitationId === citation
  const accent =
    color ??
    NATURAL_COLOR[citation] ??
    (citation.startsWith("cut")
      ? "var(--color-gold)"
      : citation.startsWith("deadair")
        ? "var(--color-hot)"
        : "var(--color-signal)")

  const display = label ?? `${seconds.toFixed(1)}s`

  return (
    <button
      onClick={() => seekTo(seconds, citation)}
      className="inline-flex items-center gap-1 cursor-pointer transition-all"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "inherit",
        letterSpacing: "inherit",
        color: accent,
        background: active ? `${accent}20` : "transparent",
        border: `1px solid ${active ? accent : "transparent"}`,
        padding: "1px 5px",
        borderRadius: 2,
      }}
      title="Click to seek video to this moment"
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: accent,
          opacity: active ? 1 : 0.7,
        }}
      />
      {display}
    </button>
  )
}
