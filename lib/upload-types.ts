/**
 * Types shared between lib/upload.ts and its callers.
 * Lives in its own file so server components can import the types
 * without pulling in the "use client" upload helper (which uses XHR
 * + window-only APIs).
 */

export type UploadResult =
  | { ok: true }
  | { ok: false; error: string; status?: number }

export type UploadOptions = {
  file: File
  storagePath: string
  /** Called periodically during upload with the byte progress. */
  onProgress?: (loaded: number, total: number) => void
  /** Lets the caller cancel an in-flight upload. */
  signal?: AbortSignal
  /** Hard timeout in ms. Default: 2 minutes. */
  timeoutMs?: number
}
