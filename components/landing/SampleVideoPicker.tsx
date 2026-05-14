import Link from "next/link"
import { SAMPLE_VIDEOS } from "@/lib/sample-videos"

/**
 * 3 sample chips on the right side of the affordances row.
 *
 * Each chip is a real link to a pre-analyzed report — reviewers can hit
 * the full magic moment without uploading. The Day 1 design rationale:
 * "reviewer lands on the page → clicks a chip → sees the analysis flow
 * in under 5 seconds." This is what makes that real.
 */
export function SampleVideoPicker() {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span
        className="font-mono text-[11px]"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-mute)",
          letterSpacing: "0.05em",
        }}
      >
        try one →
      </span>
      {SAMPLE_VIDEOS.map((s) => (
        <Link
          key={s.id}
          href={`/r/${s.id}`}
          prefetch
          className="border px-2 py-1 transition-[border-color,background,color] duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "var(--color-line)",
            color: "var(--color-text-dim)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.02em",
            outlineColor: "var(--color-signal)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-signal)"
            e.currentTarget.style.color = "var(--color-signal)"
            e.currentTarget.style.background = "rgba(198, 255, 61, 0.06)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--color-line)"
            e.currentTarget.style.color = "var(--color-text-dim)"
            e.currentTarget.style.background = "rgba(255,255,255,0.02)"
          }}
        >
          {s.handle} · {s.category}
        </Link>
      ))}
    </div>
  )
}
