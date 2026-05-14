"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useReport } from "@/contexts/report-context"
import { deriveFrames, deriveMarkers, type Marker } from "@/lib/ai/derive"
import { MonoTag, Pill, Watermark, fmtTime } from "./atoms"

/**
 * v2 video section: video + moments list + frame-thumb timeline strip.
 *
 * Mobile-first single column; switches to a 2-column grid at md+. The
 * video element is the same one driven by ReportContext (so timestamp
 * chips and the moments list and frame thumbs all seek the same player).
 */
export function VideoSection({ videoUrl }: { videoUrl: string }) {
  const { videoRef, seekTo, analysis, activeCitationId } = useReport()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Wire up video element events
  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onMeta = () => {
      if (Number.isFinite(v.duration)) setDuration(v.duration)
    }
    const onTime = () => setCurrentTime(v.currentTime)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    v.addEventListener("loadedmetadata", onMeta)
    v.addEventListener("timeupdate", onTime)
    v.addEventListener("play", onPlay)
    v.addEventListener("pause", onPause)

    if (Number.isFinite(v.duration)) setDuration(v.duration)
    setIsPlaying(!v.paused)
    setCurrentTime(v.currentTime)

    return () => {
      v.removeEventListener("loadedmetadata", onMeta)
      v.removeEventListener("timeupdate", onTime)
      v.removeEventListener("play", onPlay)
      v.removeEventListener("pause", onPause)
    }
  }, [videoRef])

  // Keyboard: space to play/pause, ← → to seek 2s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null
      if (tgt?.tagName === "INPUT" || tgt?.tagName === "TEXTAREA") return
      const v = videoRef.current
      if (!v) return
      if (e.code === "Space") {
        e.preventDefault()
        v.paused ? v.play().catch(() => {}) : v.pause()
      } else if (e.code === "ArrowLeft") {
        e.preventDefault()
        v.currentTime = Math.max(0, v.currentTime - 2)
      } else if (e.code === "ArrowRight") {
        e.preventDefault()
        v.currentTime = Math.min(duration || 600, v.currentTime + 2)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [videoRef, duration])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play().catch(() => {}) : v.pause()
  }, [videoRef])

  if (!analysis) return null

  const markers = deriveMarkers(analysis)
  const frames = deriveFrames(analysis, duration || 30)
  const dur = duration || 30
  const pct = (t: number) => Math.min(100, Math.max(0, (t / dur) * 100))

  return (
    <section
      className="relative overflow-hidden border-b px-6 md:px-14 py-10 md:py-14"
      style={{ borderColor: "var(--color-line)" }}
    >
      <Watermark size={420} opacity={0.025} right={32} top={20}>
        VIDEO
      </Watermark>

      {/* Header */}
      <div className="relative flex flex-col md:flex-row md:justify-between md:items-end mb-6 gap-3">
        <div>
          <MonoTag>
            THE VIDEO · {Math.round(dur)}s RUNTIME
          </MonoTag>
          <h2
            className="m-0 mt-2"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "clamp(24px, 4vw, 42px)",
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "var(--color-text)",
            }}
          >
            {markers.length} moments.{" "}
            <em
              style={{
                fontStyle: "italic",
                color: "var(--color-hot)",
                fontFamily: "var(--font-italic)",
              }}
            >
              {markers.filter((m) => m.hot).length} cost retention.
            </em>
          </h2>
        </div>
        <div className="flex gap-1.5 items-center">
          <Pill color="var(--color-hot)">● HOT</Pill>
          <Pill color="var(--color-signal)">● STRONG</Pill>
        </div>
      </div>

      {/* Body: video + moments */}
      <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4 md:gap-6">
        {/* Video player */}
        <div
          className="relative overflow-hidden"
          style={{
            background: "var(--color-ink-2)",
            border: "1px solid var(--color-line)",
          }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            muted
            preload="metadata"
            onClick={togglePlay}
            style={{
              width: "100%",
              display: "block",
              aspectRatio: "9 / 16",
              maxHeight: 520,
              objectFit: "cover",
              background: "#000",
              cursor: "pointer",
            }}
          />
          {/* Play overlay */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              aria-label="Play"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(198,255,61,0.95)",
                color: "var(--color-ink)",
                border: "none",
                cursor: "pointer",
                fontSize: 24,
                fontWeight: 700,
                paddingLeft: 6,
              }}
            >
              ▶
            </button>
          )}
          {/* Bottom control bar */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-3"
            style={{
              background:
                "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))",
            }}
          >
            <button
              onClick={togglePlay}
              className="flex items-center justify-center"
              aria-label={isPlaying ? "Pause" : "Play"}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "white",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                width: 28,
                height: 28,
              }}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <div
              className="text-[11px] tabular-nums"
              style={{
                fontFamily: "var(--font-mono)",
                color: "white",
                letterSpacing: "0.05em",
              }}
            >
              {fmtTime(currentTime)} / {fmtTime(dur)}
            </div>
          </div>
        </div>

        {/* Moments list */}
        <div className="flex flex-col">
          <MonoTag>MOMENTS · TAP TO JUMP</MonoTag>
          <div
            className="mt-3 flex flex-col"
            style={{ background: "var(--color-line)", gap: 1 }}
          >
            {markers.map((m, i) => (
              <MomentRow
                key={`${m.t}-${i}`}
                marker={m}
                index={i}
                currentTime={currentTime}
                seek={(t) => {
                  // Citation id is derived in chips, but moments map to the
                  // same set. Use the marker's category + index to drive
                  // visual highlight on the chip side too.
                  if (m.cat === "HOOK") seekTo(t, "hook")
                  else if (m.cat === "THUMBNAIL") seekTo(t, "thumbnail")
                  else seekTo(t)
                }}
                activeCitationId={activeCitationId}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Timeline strip: frame thumbs + scrubber + time scale */}
      <div className="relative mt-6">
        <MonoTag>SCRUB · 0:00 → {fmtTime(dur)}</MonoTag>
        <div
          className="relative mt-3 p-4"
          style={{
            background: "var(--color-ink-2)",
            border: "1px solid var(--color-line)",
          }}
        >
          {/* Frame thumbnail row — desktop only (mobile saves space) */}
          <div className="hidden md:flex gap-1.5 h-[88px]">
            {frames.map((f, i) => (
              <button
                key={i}
                onClick={() => seekTo(f.t)}
                title={`${f.t.toFixed(1)}s · ${f.label}`}
                className="relative flex-1 overflow-hidden cursor-pointer"
                style={{
                  background: f.hot
                    ? "linear-gradient(180deg, rgba(255,74,28,0.25), rgba(0,0,0,0.7))"
                    : f.good
                      ? "linear-gradient(180deg, rgba(198,255,61,0.25), rgba(0,0,0,0.7))"
                      : "linear-gradient(180deg, #2a3142, #131726)",
                  outline: f.hot
                    ? "1px solid var(--color-hot)"
                    : f.good
                      ? "1px solid var(--color-signal)"
                      : "1px solid var(--color-line)",
                  border: "none",
                  padding: 0,
                }}
              >
                <div
                  className="absolute top-1.5 left-1.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: f.hot
                      ? "var(--color-hot)"
                      : f.good
                        ? "var(--color-signal)"
                        : "rgba(255,255,255,0.5)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {f.t.toFixed(1)}s
                </div>
                <div
                  className="absolute bottom-1.5 left-1.5 right-1.5 truncate"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    color: "rgba(255,255,255,0.85)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {f.label}
                </div>
              </button>
            ))}
          </div>

          {/* Scrubber with markers + playhead */}
          <div
            className="relative mt-3"
            style={{ height: 36 }}
            role="slider"
            aria-label="Video scrubber with annotations"
            aria-valuemin={0}
            aria-valuemax={dur}
            aria-valuenow={currentTime}
          >
            <div
              aria-hidden
              className="absolute left-0 right-0"
              style={{
                top: 14,
                height: 6,
                background: "rgba(255,255,255,0.06)",
              }}
            />
            <div
              aria-hidden
              className="absolute left-0"
              style={{
                top: 14,
                height: 6,
                background: "var(--color-signal)",
                width: `${pct(currentTime)}%`,
              }}
            />
            {markers.map((m, i) => {
              const color = m.hot
                ? "var(--color-hot)"
                : m.good
                  ? "var(--color-signal)"
                  : "var(--color-cool)"
              return (
                <button
                  key={`scrub-${i}`}
                  onClick={() => seekTo(m.t)}
                  title={`${m.t.toFixed(1)}s · ${m.label}`}
                  className="absolute cursor-pointer"
                  style={{
                    left: `${pct(m.t)}%`,
                    transform: "translateX(-50%)",
                    top: 0,
                    bottom: 0,
                    padding: "0 6px",
                    background: "transparent",
                    border: "none",
                  }}
                >
                  <span
                    className="block mx-auto"
                    style={{
                      width: 2,
                      height: 36,
                      background: color,
                    }}
                  />
                  <span
                    className="absolute"
                    style={{
                      top: -2,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.t.toFixed(1)}s
                  </span>
                </button>
              )
            })}
            {/* Playhead */}
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: 8,
                bottom: 8,
                left: `${pct(currentTime)}%`,
                width: 2,
                background: "white",
                transform: "translateX(-50%)",
                boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
              }}
            />
          </div>

          {/* Time scale */}
          <div
            className="flex justify-between mt-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--color-text-mute)",
              letterSpacing: "0.1em",
            }}
          >
            {scaleStops(dur).map((t) => (
              <span key={t}>{fmtTime(t)}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function MomentRow({
  marker,
  index,
  currentTime,
  seek,
  activeCitationId,
}: {
  marker: Marker
  index: number
  currentTime: number
  seek: (t: number) => void
  activeCitationId: string | null
}) {
  const isPlaying = Math.abs(currentTime - marker.t) < 1.5
  const matchesCitation =
    (marker.cat === "HOOK" && activeCitationId === "hook") ||
    (marker.cat === "THUMBNAIL" && activeCitationId === "thumbnail")
  const active = isPlaying || matchesCitation
  const color = marker.hot
    ? "var(--color-hot)"
    : marker.good
      ? "var(--color-signal)"
      : "var(--color-cool)"

  return (
    <button
      onClick={() => seek(marker.t)}
      className="grid items-center text-left cursor-pointer transition-all"
      style={{
        gridTemplateColumns: "60px 1fr 20px",
        gap: 14,
        padding: "16px 18px",
        background: active ? "var(--color-ink-2)" : "var(--color-ink)",
        borderLeft: `3px solid ${active ? color : "transparent"}`,
        border: "none",
        borderLeftStyle: "solid",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          fontWeight: 600,
          color: marker.hot
            ? "var(--color-hot)"
            : marker.good
              ? "var(--color-signal)"
              : "var(--color-text)",
          letterSpacing: "0.05em",
        }}
      >
        {marker.t.toFixed(1)}s
      </div>
      <div>
        <div
          style={{
            fontSize: 14,
            color: "var(--color-text)",
            fontWeight: active ? 500 : 400,
          }}
        >
          {marker.label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: marker.hot
              ? "var(--color-hot)"
              : marker.good
                ? "var(--color-signal)"
                : "var(--color-text-mute)",
            letterSpacing: "0.15em",
            marginTop: 3,
          }}
        >
          {marker.cat}
          {marker.hot ? " · ISSUE" : marker.good ? " · STRENGTH" : ""}
        </div>
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: active ? "var(--color-signal)" : "var(--color-text-mute)",
        }}
      >
        →
      </span>
    </button>
  )
}

function scaleStops(duration: number): number[] {
  const targetCount = 7
  const step = duration / (targetCount - 1)
  return Array.from({ length: targetCount }, (_, i) => Math.round(step * i))
}
