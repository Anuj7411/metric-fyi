"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useReport, type CitationId } from "@/contexts/report-context"

/**
 * Custom video player with a unified scrubber + annotation overlay.
 *
 * Native HTML5 <video> handles playback; we hide its default controls and
 * draw our own bar. Markers from the analysis sit on the same rail as the
 * playback progress, so the visual mapping is unambiguous:
 *
 *   |══════════════🟢═══|═════🔴═══|═|═════🔵═══════════════|
 *   0s                  hook       cuts + dead air         duration
 *
 * Markers (all clickable, all seek the video + light up matching chip):
 *   - Lime dot at hook.landsAt
 *   - Hot red bars spanning each pacing.deadAir range
 *   - Gold ticks at every pacing.cuts[].at
 *   - Cool blue dot at thumbnail.bestFrameAt
 *
 * Renders even when analysis is null (pending/analyzing state). Markers
 * populate when the analysis lands.
 */
export function VideoPlayer({ videoUrl }: { videoUrl: string }) {
  const { videoRef, seekTo, analysis, activeCitationId } = useReport()
  const railRef = useRef<HTMLDivElement | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<string>("16 / 9")

  // Wire up video element events
  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onMeta = () => {
      if (v.duration && Number.isFinite(v.duration)) setDuration(v.duration)
      if (v.videoWidth && v.videoHeight) {
        setAspectRatio(`${v.videoWidth} / ${v.videoHeight}`)
      }
    }
    const onTime = () => setCurrentTime(v.currentTime)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    v.addEventListener("loadedmetadata", onMeta)
    v.addEventListener("timeupdate", onTime)
    v.addEventListener("play", onPlay)
    v.addEventListener("pause", onPause)
    // Pick up state in case events already fired before this effect ran
    if (v.duration && Number.isFinite(v.duration)) setDuration(v.duration)
    if (v.videoWidth) setAspectRatio(`${v.videoWidth} / ${v.videoHeight}`)
    setIsPlaying(!v.paused)
    setCurrentTime(v.currentTime)

    return () => {
      v.removeEventListener("loadedmetadata", onMeta)
      v.removeEventListener("timeupdate", onTime)
      v.removeEventListener("play", onPlay)
      v.removeEventListener("pause", onPause)
    }
  }, [videoRef])

  // Keyboard shortcuts: space to play/pause, arrows to seek
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack keys while the user is typing in an input
      const target = e.target as HTMLElement | null
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return
      const v = videoRef.current
      if (!v) return
      if (e.code === "Space") {
        e.preventDefault()
        if (v.paused) v.play().catch(() => {})
        else v.pause()
      } else if (e.code === "ArrowLeft") {
        e.preventDefault()
        v.currentTime = Math.max(0, v.currentTime - 2)
      } else if (e.code === "ArrowRight") {
        e.preventDefault()
        v.currentTime = Math.min(duration, v.currentTime + 2)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [videoRef, duration])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [videoRef])

  // Click anywhere on the rail (that isn't a marker) -> seek to that point
  const seekFromRailClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rail = railRef.current
      if (!rail || duration === 0) return
      const rect = rail.getBoundingClientRect()
      const x = e.clientX - rect.left
      const t = (x / rect.width) * duration
      seekTo(t)
    },
    [duration, seekTo],
  )

  const pct = (t: number) =>
    duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0

  return (
    <div className="w-full max-w-[1280px] mx-auto px-12 md:px-20 pt-8">
      <div
        className="relative w-full"
        style={{
          background: "var(--color-ink-2)",
          border: "1px solid var(--color-line)",
        }}
      >
        {/* Video itself — auto-sized to its real aspect ratio (so 9:16
            verticals don't get black-barred). Capped width so we never
            blow up. */}
        <div
          className="relative w-full mx-auto"
          style={{
            maxWidth: 420,
            aspectRatio,
            background: "black",
          }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            preload="metadata"
            onClick={togglePlay}
            className="w-full h-full"
            style={{ display: "block", cursor: "pointer" }}
          />
          {!isPlaying && (
            <button
              onClick={togglePlay}
              aria-label="Play"
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.25)", border: "none" }}
            >
              <span
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--color-signal)",
                  color: "var(--color-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  paddingLeft: 4,
                }}
              >
                ▶
              </span>
            </button>
          )}
        </div>

        {/* Unified custom controls bar */}
        <div
          className="flex items-center gap-4 px-4 py-3"
          style={{ borderTop: "1px solid var(--color-line)" }}
        >
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              background: "transparent",
              border: "1px solid var(--color-line)",
              color: "var(--color-text)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              paddingLeft: isPlaying ? 0 : 2,
            }}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>

          {/* Time readout */}
          <div
            className="shrink-0 font-mono text-[11px] tabular-nums"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-mute)",
              letterSpacing: "0.05em",
              minWidth: 86,
            }}
          >
            <span style={{ color: "var(--color-text)" }}>
              {formatTime(currentTime)}
            </span>{" "}
            / {formatTime(duration)}
          </div>

          {/* The rail — single timeline with playback fill + markers */}
          <div
            ref={railRef}
            onClick={seekFromRailClick}
            className="relative flex-1 cursor-pointer"
            style={{
              height: 24,
              background: "rgba(255,245,210,0.06)",
            }}
            role="slider"
            aria-label="Video progress and annotations"
            aria-valuemin={0}
            aria-valuemax={duration || 100}
            aria-valuenow={currentTime}
          >
            {/* Playback progress fill */}
            <div
              aria-hidden
              className="absolute top-0 left-0 bottom-0 pointer-events-none"
              style={{
                width: `${pct(currentTime)}%`,
                background: "rgba(245,241,232,0.12)",
              }}
            />

            {/* Centerline so markers feel anchored to a track */}
            <div
              aria-hidden
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: "50%",
                height: 1,
                background: "rgba(255,245,210,0.10)",
                marginTop: -0.5,
              }}
            />

            {analysis && duration > 0 && (
              <>
                {/* Dead-air ranges — red bars on the centerline */}
                {analysis.pacing.deadAir.map((d, i) => {
                  const id: CitationId = `deadair-${i}`
                  const active = activeCitationId === id
                  return (
                    <button
                      key={`deadair-${i}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        seekTo(d.start, id)
                      }}
                      title={`${d.start.toFixed(1)}–${d.end.toFixed(1)}s · dead air · ${d.why}`}
                      className="absolute cursor-pointer transition-opacity"
                      style={{
                        left: `${pct(d.start)}%`,
                        width: `${pct(d.end - d.start)}%`,
                        top: "50%",
                        height: active ? 10 : 6,
                        marginTop: active ? -5 : -3,
                        background: "var(--color-hot)",
                        opacity: active ? 1 : 0.7,
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
                      onClick={(e) => {
                        e.stopPropagation()
                        seekTo(c.at, id)
                      }}
                      title={`${c.at.toFixed(1)}s · cut · ${c.issue}`}
                      className="absolute cursor-pointer transition-all"
                      style={{
                        left: `calc(${pct(c.at)}% - ${active ? 2 : 1}px)`,
                        top: 0,
                        bottom: 0,
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
                  onClick={(e) => {
                    e.stopPropagation()
                    seekTo(analysis.hook.landsAt, "hook")
                  }}
                  title={`${analysis.hook.landsAt.toFixed(1)}s · hook lands`}
                  className="absolute cursor-pointer transition-transform"
                  style={{
                    left: `calc(${pct(analysis.hook.landsAt)}% - 7px)`,
                    top: "50%",
                    width: 14,
                    height: 14,
                    marginTop: -7,
                    borderRadius: "50%",
                    background: "var(--color-signal)",
                    boxShadow:
                      activeCitationId === "hook"
                        ? "0 0 0 4px rgba(198,255,61,0.3)"
                        : "0 0 0 2px rgba(14,13,11,0.9)",
                    transform:
                      activeCitationId === "hook" ? "scale(1.2)" : "scale(1)",
                    border: "none",
                    padding: 0,
                  }}
                />

                {/* Thumbnail best frame — cool blue dot */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    seekTo(analysis.thumbnail.bestFrameAt, "thumbnail")
                  }}
                  title={`${analysis.thumbnail.bestFrameAt.toFixed(1)}s · best thumbnail frame`}
                  className="absolute cursor-pointer transition-transform"
                  style={{
                    left: `calc(${pct(analysis.thumbnail.bestFrameAt)}% - 6px)`,
                    top: "50%",
                    width: 12,
                    height: 12,
                    marginTop: -6,
                    borderRadius: "50%",
                    background: "var(--color-cool)",
                    boxShadow:
                      activeCitationId === "thumbnail"
                        ? "0 0 0 4px rgba(74,140,255,0.3)"
                        : "0 0 0 2px rgba(14,13,11,0.9)",
                    transform:
                      activeCitationId === "thumbnail"
                        ? "scale(1.2)"
                        : "scale(1)",
                    border: "none",
                    padding: 0,
                  }}
                />

                {/* Playhead — thin white line at currentTime, always on top */}
                <div
                  aria-hidden
                  className="absolute pointer-events-none"
                  style={{
                    left: `calc(${pct(currentTime)}% - 1px)`,
                    top: -2,
                    bottom: -2,
                    width: 2,
                    background: "var(--color-text)",
                    boxShadow: "0 0 0 1px rgba(14,13,11,0.5)",
                  }}
                />
              </>
            )}

            {/* If no analysis yet, still show playhead */}
            {!analysis && duration > 0 && (
              <div
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  left: `calc(${pct(currentTime)}% - 1px)`,
                  top: -2,
                  bottom: -2,
                  width: 2,
                  background: "var(--color-text)",
                }}
              />
            )}
          </div>
        </div>

        {/* Legend + tip */}
        {analysis && (
          <div
            className="flex flex-wrap items-center gap-5 px-4 py-2 font-mono text-[10px]"
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
            <LegendItem color="var(--color-gold)" label="CUT" shape="tick" />
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
            <span
              className="ml-auto"
              style={{ color: "var(--color-text-dim)" }}
            >
              SPACE · ◀▶ · click any marker
            </span>
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

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}
