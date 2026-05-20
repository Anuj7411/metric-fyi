/**
 * Canonical Zod schemas for the report pipeline.
 * Single source of truth — used by API routes (request/response validation)
 * and by client code (response parsing, types).
 */
import { z } from "zod"

export const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const

// User-facing analysis cap. The DB CHECK constraint on reports.file_size
// still permits up to 100 MiB for forward-compat with the Gemini Files
// API path (Day 9+1); this 20 MB cap is what the inline route + Zod
// validate at upload time, matching what Gemini can analyze in one shot.
export const MAX_BYTES = 20 * 1024 * 1024 // 20 MiB

export const ReportStatus = z.enum([
  "pending",
  "analyzing",
  "ready",
  "failed",
])
export type ReportStatus = z.infer<typeof ReportStatus>

/* ── /api/upload/init ─────────────────────────────────────────── */

export const UploadInitRequest = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_BYTES),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
})
export type UploadInitRequest = z.infer<typeof UploadInitRequest>

export const UploadInitResponse = z.object({
  id: z.string().uuid(),
  storagePath: z.string(),
})
export type UploadInitResponse = z.infer<typeof UploadInitResponse>

/* ── Stored row (matches DB columns) ──────────────────────────── */

export const ReportRow = z.object({
  id: z.string().uuid(),
  status: ReportStatus,
  storage_path: z.string(),
  file_name: z.string(),
  file_size: z.number().int(),
  mime_type: z.string(),
  duration_seconds: z.number().nullable(),
  analysis: z.unknown().nullable(),
  error_message: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type ReportRow = z.infer<typeof ReportRow>
