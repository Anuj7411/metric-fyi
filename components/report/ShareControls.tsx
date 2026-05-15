"use client"

import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { btnStyle } from "./atoms"

/**
 * Two small share affordances rendered in the report status sub-nav.
 *
 *   ↗ COPY LINK   — copies the full report URL to clipboard
 *   ↗ TWEET       — opens Twitter intent with prefilled text + url
 *
 * Both run entirely client-side. The OG image at /r/[id]/opengraph-image
 * is what actually gives the share its visual hook — these buttons just
 * surface the URL.
 */
export function ShareControls({
  shareUrl,
  score,
  verdict,
}: {
  shareUrl: string
  score: number
  verdict: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Link copied", {
        description: shareUrl,
        duration: 2500,
      })
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Couldn't copy. Select the URL bar manually.")
    }
  }, [shareUrl])

  // Build the X / Twitter intent URL once. Using a real <a> element below
  // (instead of window.open inside an onClick) means popup blockers and
  // missing-user-gesture issues can't suppress the click — the browser
  // treats it as a normal link navigation.
  const tweetHref = useMemo(() => {
    const trimmed =
      verdict.length > 110 ? verdict.slice(0, 107).trimEnd() + "…" : verdict
    const tweetText = `Got a ${score}/100 on METRIC.fyi — "${trimmed}"`
    return (
      `https://x.com/intent/tweet` +
      `?text=${encodeURIComponent(tweetText)}` +
      `&url=${encodeURIComponent(shareUrl)}`
    )
  }, [shareUrl, score, verdict])

  return (
    <div className="flex gap-1.5 ml-auto">
      <button
        onClick={handleCopy}
        style={btnStyle("ghost", "small")}
        aria-label="Copy link to report"
      >
        ↗ {copied ? "COPIED" : "COPY LINK"}
      </button>
      <a
        href={tweetHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...btnStyle("primary", "small"), textDecoration: "none" }}
        aria-label="Share report on X"
      >
        ↗ TWEET
      </a>
    </div>
  )
}
