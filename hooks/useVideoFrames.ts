"use client"

import { useEffect, useState } from "react"

/**
 * Client-side video frame extraction.
 *
 * Spins up a hidden <video> element, loads the source with
 * crossOrigin="anonymous" (Supabase Storage public buckets send
 * access-control-allow-origin:*, so this works), seeks to each requested
 * timestamp in sequence, paints the frame to an offscreen canvas, and
 * returns the JPEG data URLs.
 *
 * Frames come back one at a time as they finish, so the UI can render
 * each thumbnail the moment it's available instead of waiting for all.
 *
 * No ffmpeg, no server work, no Supabase Storage writes — runs entirely
 * in the user's browser after the report page loads.
 */
export function useVideoFrames(
  videoUrl: string,
  timestamps: number[],
  options: { maxWidth?: number; quality?: number } = {},
): Record<number, string> {
  const [frames, setFrames] = useState<Record<number, string>>({})
  // Stable key for deps so [1,2,3] === [1,2,3] doesn't re-run forever
  const tsKey = timestamps.join("|")

  useEffect(() => {
    if (!videoUrl || timestamps.length === 0) return

    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.preload = "auto"
    video.muted = true
    video.playsInline = true
    // Some browsers require src be set AFTER crossOrigin
    video.src = videoUrl

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let cancelled = false
    let i = 0

    const maxW = options.maxWidth ?? 160
    const quality = options.quality ?? 0.55

    const captureNext = () => {
      if (cancelled || i >= timestamps.length) {
        cleanup()
        return
      }
      // Snap a hair past t=0 to dodge black opening frames in some encodings
      const target = Math.max(0.05, timestamps[i])
      // Clamp to duration if known
      const safe =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(target, video.duration - 0.05)
          : target
      try {
        video.currentTime = safe
      } catch {
        // Some browsers throw if currentTime is set before metadata loads.
        // Defer to the next loadedmetadata pass.
      }
    }

    const onSeeked = () => {
      if (cancelled) return
      if (!video.videoWidth || !video.videoHeight) {
        // Metadata still loading — try again on the next loadedmetadata
        return
      }

      const ratio = video.videoHeight / video.videoWidth
      canvas.width = maxW
      canvas.height = Math.max(1, Math.round(maxW * ratio))
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL("image/jpeg", quality)
        const idx = i
        setFrames((prev) => ({ ...prev, [idx]: dataUrl }))
      } catch {
        // SecurityError = canvas was tainted = CORS failed somehow.
        // Bail rather than spin forever; the UI keeps showing placeholders.
        cleanup()
        return
      }
      i++
      captureNext()
    }

    const onMeta = () => {
      // Kick off the first capture once we know the duration
      if (i === 0) captureNext()
    }

    const onError = () => {
      cleanup()
    }

    video.addEventListener("loadedmetadata", onMeta)
    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onError)

    const cleanup = () => {
      cancelled = true
      video.removeEventListener("loadedmetadata", onMeta)
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
      // Letting GC handle the elements; they're never attached to the DOM.
      video.src = ""
    }

    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, tsKey, options.maxWidth, options.quality])

  return frames
}
