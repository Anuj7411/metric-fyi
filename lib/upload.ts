"use client"

/**
 * Upload a file to Supabase Storage via XMLHttpRequest.
 *
 * Why not @supabase/supabase-js's storage.upload()? Because as of v2.89
 * the public API doesn't expose progress events. On a flaky mobile
 * connection that means a user sees a frozen "Uploading…" toast with
 * zero feedback — they can't tell if they're at 5% or 95%, the fetch
 * eventually times out internally, and they get a generic
 * "failed to fetch" red error that helps nobody.
 *
 * XHR gives us:
 *   - real-time upload.onprogress events → render a progress bar
 *   - a controllable timeout (default 2 min) → clear failure mode
 *     instead of waiting indefinitely
 *   - specific error classification (HTTP status vs network vs timeout)
 *
 * The auth path is unchanged: we POST with the same anon Authorization
 * + apikey headers supabase-js would send. The Storage RLS policy on
 * the `videos` bucket allows anon INSERT.
 */
import type { UploadResult, UploadOptions } from "./upload-types"

const STORAGE_BUCKET = "videos"

export function uploadVideoWithProgress(
  options: UploadOptions,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const { file, storagePath, onProgress, signal, timeoutMs = 120_000 } =
      options

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !anonKey) {
      resolve({ ok: false, error: "Supabase env not configured." })
      return
    }

    const url = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${encodeURIComponent(
      storagePath,
    )}`

    const xhr = new XMLHttpRequest()
    let userAborted = false

    const timeoutId = setTimeout(() => {
      xhr.abort()
      resolve({
        ok: false,
        error: `Upload timed out after ${Math.round(timeoutMs / 1000)}s. Your connection looks slow — try again, or switch to Wi-Fi.`,
      })
    }, timeoutMs)

    if (signal) {
      signal.addEventListener("abort", () => {
        userAborted = true
        clearTimeout(timeoutId)
        xhr.abort()
      })
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded, e.total)
      }
    }

    xhr.onload = () => {
      clearTimeout(timeoutId)
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true })
        return
      }
      let msg = `Upload failed (HTTP ${xhr.status}).`
      try {
        const body = JSON.parse(xhr.responseText)
        if (typeof body?.message === "string") {
          msg = body.message
        } else if (typeof body?.error === "string") {
          msg = body.error
        }
      } catch {
        // non-JSON response — keep the generic message
      }
      resolve({ ok: false, error: msg, status: xhr.status })
    }

    xhr.onerror = () => {
      clearTimeout(timeoutId)
      if (userAborted) {
        resolve({ ok: false, error: "Upload cancelled." })
      } else {
        resolve({
          ok: false,
          error:
            "Network error — your connection dropped mid-upload. Try again.",
        })
      }
    }

    xhr.ontimeout = () => {
      clearTimeout(timeoutId)
      resolve({ ok: false, error: "Upload timed out." })
    }

    xhr.open("POST", url)
    xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`)
    xhr.setRequestHeader("apikey", anonKey)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.setRequestHeader("Cache-Control", "max-age=3600")
    xhr.send(file)
  })
}
