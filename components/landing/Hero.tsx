"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { UploadCard } from "./UploadCard"
import { SampleVideoPicker } from "./SampleVideoPicker"
import { createClient } from "@/lib/supabase/client"
import { writeHistoryEntry } from "@/lib/history"
import { dur, ease, fadeUp, staggerParent } from "@/lib/motion"

type Picked =
  | { kind: "file"; file: File; label: string }
  | null

/**
 * The landing hero. Composes the headline, the upload card, the sample
 * picker, and the receipt-style stats block in the bottom-right corner.
 *
 * Visual contract: matches designs/.../screen-landing.jsx at 1440px.
 * The page intentionally ends at this input — no marketing scroll below.
 */
export function Hero() {
  const router = useRouter()
  const [picked, setPicked] = useState<Picked>(null)
  const [busy, setBusy] = useState(false)

  function handleFile(file: File) {
    setPicked({ kind: "file", file, label: file.name })
  }

  async function handleScore() {
    if (!picked || busy) return

    const file = picked.file
    setBusy(true)
    const toastId = toast.loading(`Uploading ${file.name}…`)

    try {
      // 1. Init the report row
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      })

      if (!initRes.ok) {
        const body = await initRes.json().catch(() => ({}))
        if (initRes.status === 429) {
          toast.error("Too many uploads — slow down a moment.", { id: toastId })
        } else if (initRes.status === 400) {
          toast.error("That file isn't supported.", {
            id: toastId,
            description: "Use mp4, mov, or webm under 100 MB.",
          })
        } else {
          toast.error("Couldn't start the upload.", {
            id: toastId,
            description: body?.error ?? "Try again in a moment.",
          })
        }
        return
      }

      const { id, storagePath } = (await initRes.json()) as {
        id: string
        storagePath: string
      }

      // 2. Upload bytes directly to Supabase Storage (bypasses Vercel body limit)
      const supabase = createClient()
      const { error: upErr } = await supabase.storage
        .from("videos")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (upErr) {
        toast.error("Upload failed mid-flight.", {
          id: toastId,
          description: upErr.message,
        })
        return
      }

      // 3. Save to local history so the user can find this report again
      // from the same browser without an account. localStorage-only —
      // doesn't sync across devices; see lib/history.ts for the contract.
      writeHistoryEntry({
        id,
        fileName: file.name,
        fileSize: file.size,
        status: "pending",
      })

      // 4. Navigate to the report page
      toast.success("Uploaded. Opening report.", { id: toastId })
      router.push(`/r/${id}`)
    } catch (err) {
      toast.error("Something broke.", {
        id: toastId,
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex-1 flex flex-col justify-center px-12 md:px-20 relative">
      {/* faint background grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
        }}
      />

      <motion.div
        initial="initial"
        animate="animate"
        variants={staggerParent}
        className="relative max-w-[1280px]"
      >
        <motion.div
          {...fadeUp}
          className="flex items-center gap-3.5 font-mono text-[11px] mb-6"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-mute)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5"
            style={{
              background: "var(--color-signal)",
              animation: "pulse 1.6s ease-in-out infinite",
            }}
          />
          Live · 14,302 videos scored this week
        </motion.div>

        <motion.h1
          {...fadeUp}
          transition={{ duration: dur.page, ease }}
          className="font-semibold m-0"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(56px, 9vw, 108px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
          }}
        >
          Paste a video.
          <br />
          Get the{" "}
          <em
            style={{
              fontFamily: "var(--font-italic)",
              fontStyle: "italic",
              fontWeight: 400,
              color: "var(--color-signal)",
            }}
          >
            brutally honest
          </em>
          <br />
          reason it isn&apos;t going off.
        </motion.h1>

        <motion.div {...fadeUp} className="mt-12 max-w-[1100px]">
          <UploadCard
            pickedLabel={picked?.label ?? ""}
            onFile={handleFile}
            onScore={handleScore}
            busy={busy}
          />

          <div
            className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mt-3.5"
            style={{ color: "var(--color-text-mute)" }}
          >
            <div
              className="flex flex-wrap gap-6 font-mono text-[11px]"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.05em",
              }}
            >
              <span>↳ drop anywhere on the page</span>
              <span>↳ no signup · no email · 22-second analysis</span>
            </div>
            <SampleVideoPicker />
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: dur.page, ease, delay: 0.4 }}
        className="absolute right-12 md:right-20 bottom-8 font-mono text-[10px] leading-[1.8] text-right hidden md:block"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-mute)",
          letterSpacing: "0.1em",
          borderRight: "2px solid var(--color-signal)",
          paddingRight: 14,
        }}
      >
        MEDIAN SCORE THIS WEEK · 41
        <br />
        STRONGEST HOOK CAT. · CONTRADICTION
        <br />
        DEAD WORD OF THE WEEK · &quot;literally&quot;
      </motion.div>

      <style>{`@keyframes pulse { 0%,100% {opacity:1} 50% {opacity:0.3} }`}</style>
    </section>
  )
}
