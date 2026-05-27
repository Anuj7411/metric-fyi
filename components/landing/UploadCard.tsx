"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

const ACCEPT = ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
// Aligned with the Gemini inline-analysis ceiling (~20 MB). The DB
// CHECK constraint still allows up to 100 MiB for forward-compat with
// the Files API path; the user-facing UI just won't let you submit
// something we'd then fail to analyze.
const MAX_BYTES = 20 * 1024 * 1024

type Props = {
  /** Filename currently picked (from drop, click, or sample). Empty = nothing picked yet. */
  pickedLabel: string
  onFile: (file: File) => void
  onScore: () => void
  /** Disables the score button while an upload is in flight. */
  busy?: boolean
  /** 0–100 during upload, null when idle or pre-progress. Drives the
   *  real-percentage progress bar; falls back to indeterminate shimmer
   *  while busy && progress === null (e.g. before the first chunk lands). */
  progress?: number | null
  /** Optional user-supplied framing for what the video IS. Threaded to
   *  the Gemini prompt — solves screen-recording misclassification
   *  (Loom of an app gets analyzed as the app, not the embedded
   *  content). Bound externally so Hero can include it in /init body. */
  context: string
  onContextChange: (value: string) => void
}

/**
 * The hero's input row. Doubles as a drag-and-drop zone — the entire
 * page is also a drop target (see useEffect below) so users can drop
 * anywhere and it lands here.
 *
 * Native HTML5 drag-and-drop. No external library.
 *
 * Mobile layout: input row + button stack vertically (flex-col), button
 * goes full-width. Desktop: horizontal flex row.
 */
export function UploadCard({
  pickedLabel,
  onFile,
  onScore,
  busy = false,
  progress = null,
  context,
  onContextChange,
}: Props) {
  const [dragOver, setDragOver] = useState(false)
  /** Context input is hidden by default — collapsed under a one-line
   *  affordance — so the default flow stays "drop and score." Auto-opens
   *  once a file is picked because that's when intent-tagging matters
   *  most (and once the user has typed something we keep it open). */
  const [contextOpen, setContextOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Page-wide drag listeners — dropping anywhere on the page routes here.
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault()
        setDragOver(true)
      }
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault()
    }
    const onDragLeave = (e: DragEvent) => {
      // Only clear when leaving the document entirely
      if (e.relatedTarget === null) setDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) handleFile(file)
    }
    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFile(file: File) {
    if (!file.type.startsWith("video/")) {
      toast.error("That's not a video file.", {
        description: "Drop an .mp4, .mov, or .webm.",
      })
      return
    }
    if (file.size > MAX_BYTES) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1)
      toast.error(`Video is ${sizeMB} MB — over the 20 MB limit.`, {
        description:
          "Inline analysis caps at 20 MB. Trim the clip in CapCut, lower the export bitrate, or pick a shorter video.",
        duration: 6000,
      })
      return
    }
    onFile(file)
  }

  const canScore = pickedLabel.length > 0
  const showContext = contextOpen || context.length > 0 || canScore
  const ctxLen = context.length
  const CTX_MAX = 500

  return (
    <>
    <div
      className="relative flex flex-col md:flex-row md:items-stretch border transition-[border-color] duration-[220ms] ease-[cubic-bezier(.2,.8,.2,1)] overflow-hidden"
      style={{
        background: "var(--color-ink-2)",
        borderColor: dragOver
          ? "var(--color-signal)"
          : busy
            ? "var(--color-signal)"
            : "var(--color-line)",
      }}
      onClick={() => !canScore && fileInputRef.current?.click()}
    >
      {/* Progress bar shown during upload — visible feedback on the
          input itself, not just a top-of-screen toast that iOS can
          obscure behind the URL chrome.
          - Real percentage when `progress` is known (driven by XHR
            upload.onprogress events in Hero).
          - Indeterminate shimmer when busy && progress === null (the
            tiny window before the first byte hits the wire). */}
      {busy && (
        <div
          aria-hidden
          className="absolute left-0 right-0 top-0 h-[3px] overflow-hidden"
          style={{ background: "rgba(198,255,61,0.15)" }}
        >
          {typeof progress === "number" ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: `${Math.max(2, Math.min(100, progress))}%`,
                background: "var(--color-signal)",
                transition: "width 220ms cubic-bezier(.2,.8,.2,1)",
              }}
            />
          ) : (
            <>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "40%",
                  background: "var(--color-signal)",
                  animation: "uploadProgress 1.4s ease-in-out infinite",
                }}
              />
              <style>{`@keyframes uploadProgress {
                0%   { left: -40%; }
                100% { left: 100%; }
              }`}</style>
            </>
          )}
        </div>
      )}

      <div className="flex items-stretch flex-1 min-w-0">
        <span
          aria-hidden
          className="self-center pl-4 md:pl-6 pr-3 md:pr-4 font-mono text-base"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-signal)",
          }}
        >
          $
        </span>

        <div className="flex-1 min-w-0 flex items-center py-5 md:py-6 pr-4 cursor-pointer">
          <span
            className="font-mono text-[13px] md:text-[18px] truncate w-full"
            style={{
              fontFamily: "var(--font-mono)",
              color: canScore ? "var(--color-text)" : "var(--color-text-mute)",
              letterSpacing: "-0.005em",
            }}
          >
            {dragOver
              ? "drop to upload →"
              : busy
                ? typeof progress === "number"
                  ? `uploading ${pickedLabel} · ${progress}%`
                  : `uploading ${pickedLabel}…`
                : canScore
                  ? pickedLabel
                  : "drop a video — or click to pick"}
          </span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />

      <Button
        variant="signal"
        size="lg"
        disabled={!canScore || busy}
        onClick={(e) => {
          e.stopPropagation()
          onScore()
        }}
        className="!rounded-none !h-auto w-full md:w-auto py-4 md:py-0 border-t md:border-t-0 md:border-l"
        style={{ borderColor: "var(--color-signal)" }}
      >
        {busy ? "Uploading…" : "Score it →"}
      </Button>
    </div>

    {/* Optional context — what is this video MEANT to be about?
        Lives outside the main input row so the default flow stays
        a single line. Auto-opens once a file is picked because that's
        when the framing question becomes useful. The whole thing is
        skippable; empty context just means "no extra framing." */}
    {showContext ? (
      <div
        className="mt-2 border"
        style={{
          background: "var(--color-ink-2)",
          borderColor: "var(--color-line)",
        }}
      >
        <label
          htmlFor="video-context"
          className="flex items-baseline justify-between gap-3 px-4 md:px-6 pt-3 pb-1.5 font-mono text-[10px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-mute)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          <span>
            What is this video?{" "}
            <span style={{ opacity: 0.7 }}>(optional, but helps a lot)</span>
          </span>
          <span style={{ opacity: ctxLen > CTX_MAX * 0.85 ? 1 : 0.6 }}>
            {ctxLen}/{CTX_MAX}
          </span>
        </label>
        <textarea
          id="video-context"
          value={context}
          onChange={(e) => onContextChange(e.target.value.slice(0, CTX_MAX))}
          disabled={busy}
          rows={2}
          placeholder='e.g. "screen recording of my SaaS dashboard — analyze the product demo, not the data inside it"'
          className="w-full resize-none bg-transparent px-4 md:px-6 pb-3 font-mono text-[13px] md:text-[14px] outline-none placeholder:opacity-40"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text)",
            letterSpacing: "-0.005em",
            lineHeight: 1.45,
          }}
        />
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setContextOpen(true)}
        className="mt-2 font-mono text-[11px] underline-offset-4 hover:underline transition-opacity"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-mute)",
          letterSpacing: "0.05em",
        }}
      >
        + add context (e.g. &quot;this is a screen recording of my app&quot;)
      </button>
    )}
    </>
  )
}
