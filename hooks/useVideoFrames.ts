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
 * iOS Safari quirk: setting currentTime before readyState >= HAVE_FUTURE_DATA
 * silently no-ops — the `seeked` event never fires. Two robustness tricks:
 *   - Wait for the `canplay` event (readyState 3) before the first seek
 *   - Call .play() then immediately .pause() once to prime the buffer
 *     (some iOS versions need the video element to have been "user
 *      acknowledged" before seeking works reliably)
 *
 * No ffmpeg, no server work, runs entirely in the user's browser after
 * the report page loads.
 */
export function useVideoFrames(
  videoUrl: string,
  timestamps: number[],
  options: { maxWidth?: number; quality?: number } = {},
): Record<number, string> {
  const [frames, setFrames] = useState<Record<number, string>>({})
  const tsKey = timestamps.join("|")

  useEffect(() => {
    if (!videoUrl || timestamps.length === 0) return

    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.preload = "auto"
    video.muted = true
    video.playsInline = true
    // iOS hint: keep the video off-screen but in-document so the player
    // pipeline initialises. Adding to body briefly is safer than detached.
    video.style.position = "fixed"
    video.style.top = "-9999px"
    video.style.left = "-9999px"
    video.style.width = "1px"
    video.style.height = "1px"
    video.style.opacity = "0"
    video.style.pointerEvents = "none"
    document.body.appendChild(video)
    video.src = videoUrl

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      document.body.removeChild(video)
      return
    }

    let cancelled = false
    let i = 0
    let primed = false
    let seekFallback: ReturnType<typeof setTimeout> | null = null

    const maxW = options.maxWidth ?? 160
    const quality = options.quality ?? 0.55

    const cleanup = () => {
      cancelled = true
      if (seekFallback) clearTimeout(seekFallback)
      video.removeEventListener("loadedmetadata", onReady)
      video.removeEventListener("canplay", onReady)
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
      video.src = ""
      if (video.parentNode) video.parentNode.removeChild(video)
    }

    const captureNext = () => {
      if (cancelled || i >= timestamps.length) {
        cleanup()
        return
      }
      // Snap a hair past t=0 to dodge black opening frames in some encodings
      const target = Math.max(0.05, timestamps[i])
      const duration = video.duration
      const safe =
        Number.isFinite(duration) && duration > 0
          ? Math.min(target, duration - 0.05)
          : target

      // Fallback: if `seeked` doesn't fire within 1.5s, retry once.
      if (seekFallback) clearTimeout(seekFallback)
      seekFallback = setTimeout(() => {
        if (cancelled) return
        if (Math.abs(video.currentTime - safe) < 0.5) {
          // We're approximately at the target; force a capture anyway.
          onSeeked()
        }
      }, 1500)

      try {
        video.currentTime = safe
      } catch {
        // Some browsers throw if seek is too early; defer.
      }
    }

    const onSeeked = () => {
      if (cancelled) return
      if (seekFallback) {
        clearTimeout(seekFallback)
        seekFallback = null
      }
      if (!video.videoWidth || !video.videoHeight) return

      const ratio = video.videoHeight / video.videoWidth
      canvas.width = maxW
      canvas.height = Math.max(1, Math.round(maxW * ratio))
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL("image/jpeg", quality)
        const idx = i
        setFrames((prev) => ({ ...prev, [idx]: dataUrl }))
      } catch {
        // SecurityError = CORS taint. Stop trying — UI falls back to gradient.
        cleanup()
        return
      }
      i++
      captureNext()
    }

    const onReady = () => {
      if (cancelled || primed) return
      primed = true
      // iOS prime: trigger a brief play() to register the video as
      // user-controllable, then immediately pause and start seeking.
      // Wrapped in a promise chain so we handle the autoplay-blocked
      // rejection gracefully — we just skip the prime and seek directly.
      const playPromise = video.play()
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            video.pause()
            captureNext()
          })
          .catch(() => {
            // Autoplay blocked — seek anyway, modern Safari (16+) usually
            // still seeks correctly even without the prime.
            captureNext()
          })
      } else {
        captureNext()
      }
    }

    const onError = () => cleanup()

    // Wait for canplay (readyState 3), not just loadedmetadata (1), before
    // any seek — that's what iOS Safari needs.
    video.addEventListener("canplay", onReady, { once: true })
    // loadedmetadata is a fallback in case canplay never fires (rare)
    video.addEventListener("loadedmetadata", onReady, { once: true })
    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onError)

    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, tsKey, options.maxWidth, options.quality])

  return frames
}
