"use client"

import { SAMPLE_VIDEOS, type SampleVideo } from "@/lib/sample-videos"

type Props = {
  onPick: (sample: SampleVideo) => void
  pickedId: string | null
}

/**
 * The 3 sample chips on the right side of the affordances row.
 * Lets reviewers hit the magic moment in <30 seconds without their own video.
 */
export function SampleVideoPicker({ onPick, pickedId }: Props) {
  return (
    <div className="flex gap-1.5 items-center">
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
      {SAMPLE_VIDEOS.map((s) => {
        const active = pickedId === s.id
        return (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            className="border px-2 py-1 transition-[border-color,background] duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)] whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              background: active
                ? "rgba(198, 255, 61, 0.08)"
                : "rgba(255,255,255,0.02)",
              borderColor: active
                ? "var(--color-signal)"
                : "var(--color-line)",
              color: active ? "var(--color-signal)" : "var(--color-text-dim)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.02em",
              outlineColor: "var(--color-signal)",
            }}
          >
            {s.handle} · {s.category}
          </button>
        )
      })}
    </div>
  )
}
