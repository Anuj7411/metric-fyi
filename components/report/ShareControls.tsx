"use client"

import { useCallback, useState } from "react"
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

  const handleTweet = useCallback(() => {
    // Short verdict so the tweet text + URL fits comfortably under 280 chars
    const trimmed =
      verdict.length > 110 ? verdict.slice(0, 107).trimEnd() + "…" : verdict
    const tweetText = `Got a ${score}/100 on METRIC.fyi — "${trimmed}"`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`
    window.open(url, "_blank", "noopener,noreferrer")
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
      <button
        onClick={handleTweet}
        style={btnStyle("primary", "small")}
        aria-label="Share report on Twitter"
      >
        ↗ TWEET
      </button>
    </div>
  )
}
