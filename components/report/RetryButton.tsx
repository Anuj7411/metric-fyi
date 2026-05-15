"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

/**
 * Retry a failed analysis without re-uploading the video.
 *
 *   1. Calls the `reset_failed_report` RPC (sets status pending,
 *      clears analysis + error_message). Anon-callable; gates
 *      transition inside its body.
 *   2. Reloads the page. The server re-fetches the row, sees
 *      status='pending', renders <PendingClient/> which fires the
 *      analyze endpoint again.
 *
 * Graceful failure modes:
 *   - RPC not deployed yet (migration unapplied): toast prompts user
 *     to apply the migration. No app-breaking behaviour.
 *   - RPC failed validation (row not in 'failed' state): toast.
 */
export function RetryButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleRetry() {
    if (busy) return
    setBusy(true)
    const toastId = toast.loading("Resetting analysis…")

    try {
      const supabase = createClient()
      const { error } = await supabase.rpc("reset_failed_report", {
        p_id: id,
      })

      if (error) {
        // Common failure: RPC doesn't exist (migration not applied yet)
        const isMissingRpc =
          error.code === "PGRST202" ||
          /function .* does not exist/i.test(error.message)
        if (isMissingRpc) {
          toast.error("Retry isn't available yet.", {
            id: toastId,
            description:
              "Server-side function missing — apply the latest migration in the Supabase SQL editor.",
            duration: 6000,
          })
        } else {
          toast.error("Retry failed.", {
            id: toastId,
            description: error.message,
            duration: 5000,
          })
        }
        return
      }

      toast.success("Re-running analysis…", {
        id: toastId,
        description: "This takes ~25 seconds.",
      })
      // router.refresh would only re-fetch RSC; we want PendingClient
      // to mount fresh so its useEffect fires the analyze call. Hard
      // reload is the simplest reliable trigger here.
      router.refresh()
      // small delay so the toast is readable before the reload yanks it
      setTimeout(() => window.location.reload(), 400)
    } catch (err) {
      toast.error("Network error.", {
        id: toastId,
        description: err instanceof Error ? err.message : "Unknown",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={busy}
      className="mt-8 inline-flex items-center gap-2 px-6 py-3 transition-opacity"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: "var(--color-signal)",
        color: "var(--color-ink)",
        border: "none",
        cursor: busy ? "wait" : "pointer",
        fontWeight: 700,
        opacity: busy ? 0.65 : 1,
      }}
    >
      {busy ? "Retrying…" : "↻ Re-analyze this video"}
    </button>
  )
}
