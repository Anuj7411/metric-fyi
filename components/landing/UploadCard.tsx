"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

const ACCEPT = ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
const MAX_BYTES = 100 * 1024 * 1024 // 100MB — enforced server-side too on Day 3

type Props = {
  /** Filename currently picked (from drop, click, or sample). Empty = nothing picked yet. */
  pickedLabel: string
  onFile: (file: File) => void
  onScore: () => void
  /** Disables the score button while an upload is in flight. */
  busy?: boolean
}

/**
 * The hero's input row. Doubles as a drag-and-drop zone — the entire
 * page is also a drop target (see useEffect below) so users can drop
 * anywhere and it lands here.
 *
 * Native HTML5 drag-and-drop. No external library.
 */
export function UploadCard({ pickedLabel, onFile, onScore, busy = false }: Props) {
  const [dragOver, setDragOver] = useState(false)
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
      toast.error("File is over 100MB.", {
        description: "We trim the limit so analysis stays fast.",
      })
      return
    }
    onFile(file)
  }

  const canScore = pickedLabel.length > 0

  return (
    <div
      className="flex items-stretch border transition-[border-color] duration-[220ms] ease-[cubic-bezier(.2,.8,.2,1)]"
      style={{
        background: "var(--color-ink-2)",
        borderColor: dragOver ? "var(--color-signal)" : "var(--color-line)",
      }}
      onClick={() => !canScore && fileInputRef.current?.click()}
    >
      <span
        aria-hidden
        className="self-center pl-6 pr-4 font-mono text-base"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-signal)",
        }}
      >
        $
      </span>

      <div className="flex-1 flex items-center py-6 pr-4 cursor-pointer">
        <span
          className="font-mono text-[15px] md:text-[18px] truncate"
          style={{
            fontFamily: "var(--font-mono)",
            color: canScore ? "var(--color-text)" : "var(--color-text-mute)",
            letterSpacing: "-0.005em",
          }}
        >
          {dragOver
            ? "drop to upload →"
            : canScore
              ? pickedLabel
              : "drop a video — or click to pick a file"}
        </span>
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
        className="!rounded-none !h-auto"
      >
        {busy ? "Uploading…" : "Score it →"}
      </Button>
    </div>
  )
}
