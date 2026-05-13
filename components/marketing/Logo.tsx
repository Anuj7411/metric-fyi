import Link from "next/link"

type Props = {
  size?: "sm" | "md"
  /** Render as a link to `/` (default), or as a static span when inside another link. */
  asLink?: boolean
}

/**
 * METRIC.fyi wordmark. Lime square + mono caps.
 * Matches the brand mark in designs/.../screen-landing.jsx.
 */
export function Logo({ size = "md", asLink = true }: Props) {
  const square = size === "sm" ? 12 : 14
  const text = size === "sm" ? 12 : 13

  const inner = (
    <span className="flex items-center gap-2.5 group">
      <span
        aria-hidden
        style={{
          width: square,
          height: square,
          background: "var(--color-signal)",
          display: "inline-block",
        }}
      />
      <span
        className="font-semibold tracking-[0.05em] group-hover:opacity-80 transition-opacity"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: text,
        }}
      >
        METRIC.fyi
      </span>
    </span>
  )

  if (asLink) {
    return (
      <Link href="/" aria-label="METRIC.fyi · home">
        {inner}
      </Link>
    )
  }

  return inner
}
