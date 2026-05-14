"use client"

import { useEffect, useState } from "react"
import { useReport, type CitationId } from "@/contexts/report-context"

/**
 * Native HTML5 <video> + a custom annotation strip rendered below it.
 *
 * The annotation strip displays markers from the analysis:
 *   - Lime dot at hook.landsAt
 *   - Hot red bars spanning each pacing.deadAir range
 *   - Gold tick at every pacing.cuts[].at
 *   - Cool blue dot at thumbnail.bestFrameAt
 *
 * Markers are clickable — clicking seeks the video and lights up the
 * matching citation chip in the report below. The same lights are driven
 * from the other direction when the user clicks a chip in ReportView.
 *
 * Renders even when analysis is null (pending/analyzing state) — gives the
 * user something to do during the ~30s wait. Markers populate when the
 * analysis lands.
 */
export function VideoPlayer({ videoUrl }: { videoUrl: string }) {
  const { videoRef, seekTo, analysis, activeCitationId } = useReport()
  const [duration, setDuration] = useState(0)

  // Pick up the video's duration once metadata loads so we can position
  // markers proportionally on the annotation strip.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onMeta = () => {
      if (v.duration && Number.isFinite(v.duration)) setDuration(v.duration)
    }
    v.addEventListener("loadedmetadata", onMeta)
    // Some browsers fire loadedmetadata before this effect runs
    if (v.duration && Number.isFinite(v.duration)) setDuration(v.duration)

    return () => v.removeEventListener("loadedmetadata", onMeta)
  }, [videoRef])

  const pct = (t: number) =>
    duration > 0 ? `${Math.min(100, Math.max(0, (t / duration) * 100))}%` : "0%"

  return (
    <div className="w-full max-w-[1280px] mx-auto px-12 md:px-20 pt-8">
      <div
        className="relative w-full"
        style={{
          background: "var(--color-ink-2)",
          border: "1px solid var(--color-line)",
        }}
      >
        {/* Aspect-ratio container caps the player height so a 9:16 vertical
            video doesn't try to fill the entire screen. 16:9 max with the
            video object-fit:contain keeps vertical clips letterboxed but
            visible. */}
        <div
          className="relative w-full mx-auto"
          style={{ maxWidth: 720, aspectRatio: "16 / 9" }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain"
            style={{ background: "black" }}
          />
        </div>

        {/* Annotation strip below the controls. */}
        <div
          className="relative w-full"
          style={{
            height: 28,
            borderTop: "1px solid var(--color-line)",
            background: "rgba(0,0,0,0.4)",
          }}
        >
          {analysis && duration > 0 && (
            <>
              {/* Dead-air ranges — red horizontal bars */}
              {analysis.pacing.deadAir.map((d, i) => {
                const id: CitationId = `deadair-${i}`
                const active = activeCitationId === id
                return (
                  <button
                    key={`deadair-${i}`}
                    onClick={() => seekTo(d.start, id)}
                    title={`Dead air ${d.start.toFixed(1)}–${d.end.toFixed(1)}s · ${d.why}`}
                    className="absolute top-0 bottom-0 cursor-pointer transition-opacity"
                    style={{
                      left: pct(d.start),
                      width: pct(d.end - d.start),
                      background: "var(--color-hot)",
                      opacity: active ? 1 : 0.55,
                      border: "none",
                      padding: 0,
                    }}
                  />
                )
              })}

              {/* Pacing cuts — gold ticks */}
              {analysis.pacing.cuts.map((c, i) => {
                const id: CitationId = `cut-${i}`
                const active = activeCitationId === id
                return (
                  <button
                    key={`cut-${i}`}
                    onClick={() => seekTo(c.at, id)}
                    title={`Cut at ${c.at.toFixed(1)}s · ${c.issue}`}
                    className="absolute top-0 bottom-0 cursor-pointer transition-all"
                    style={{
                      left: `calc(${pct(c.at)} - 1px)`,
                      width: active ? 4 : 2,
                      background: "var(--color-gold)",
                      border: "none",
                      padding: 0,
                    }}
                  />
                )
              })}

              {/* Hook landsAt — lime dot */}
              <button
                onClick={() => seekTo(analysis.hook.landsAt, "hook")}
                title={`Hook lands at ${analysis.hook.landsAt.toFixed(1)}s`}
                className="absolute cursor-pointer transition-transform"
                style={{
                  left: `calc(${pct(analysis.hook.landsAt)} - 6px)`,
                  top: "50%",
                  width: 12,
                  height: 12,
                  marginTop: -6,
                  borderRadius: "50%",
                  background: "var(--color-signal)",
                  boxShadow:
                    activeCitationId === "hook"
                      ? "0 0 0 4px rgba(198,255,61,0.3)"
                      : "none",
                  transform:
                    activeCitationId === "hook" ? "scale(1.2)" : "scale(1)",
                  border: "none",
                  padding: 0,
                }}
              />

              {/* Thumbnail best frame — cool blue dot */}
              <button
                onClick={() =>
                  seekTo(analysis.thumbnail.bestFrameAt, "thumbnail")
                }
                title={`Best thumbnail frame at ${analysis.thumbnail.bestFrameAt.toFixed(1)}s`}
                className="absolute cursor-pointer transition-transform"
                style={{
                  left: `calc(${pct(analysis.thumbnail.bestFrameAt)} - 5px)`,
                  top: "50%",
                  width: 10,
                  height: 10,
                  marginTop: -5,
                  borderRadius: "50%",
                  background: "var(--color-cool)",
                  boxShadow:
                    activeCitationId === "thumbnail"
                      ? "0 0 0 4px rgba(74,140,255,0.3)"
                      : "none",
                  transform:
                    activeCitationId === "thumbnail" ? "scale(1.2)" : "scale(1)",
                  border: "none",
                  padding: 0,
                }}
              />
            </>
          )}
        </div>

        {/* Legend — only meaningful once analysis is available */}
        {analysis && (
          <div
            className="flex flex-wrap gap-5 px-3 py-2 font-mono text-[10px]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-mute)",
              letterSpacing: "0.1em",
              borderTop: "1px solid var(--color-line)",
            }}
          >
            <LegendItem
              color="var(--color-signal)"
              label="HOOK LANDS"
              shape="dot"
            />
            <LegendItem
              color="var(--color-gold)"
              label="CUT"
              shape="tick"
            />
            <LegendItem
              color="var(--color-hot)"
              label="DEAD AIR"
              shape="bar"
            />
            <LegendItem
              color="var(--color-cool)"
              label="BEST FRAME"
              shape="dot"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function LegendItem({
  color,
  label,
  shape,
}: {
  color: string
  label: string
  shape: "dot" | "tick" | "bar"
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        style={{
          display: "inline-block",
          background: color,
          width: shape === "bar" ? 12 : shape === "tick" ? 2 : 8,
          height: shape === "bar" ? 4 : 8,
          borderRadius: shape === "dot" ? "50%" : 0,
        }}
      />
      <span>{label}</span>
    </span>
  )
}
