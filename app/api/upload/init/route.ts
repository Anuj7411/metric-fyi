/**
 * POST /api/upload/init
 *
 * Validates the requested file, creates a pending `reports` row, and returns
 * `{ id, storagePath }`. The client then uploads the actual file bytes
 * directly to Supabase Storage at `storagePath` using the anon key —
 * never through our server (we'd hit Vercel's 4.5 MB body limit otherwise).
 *
 * Anonymous-only. No auth. RLS on `reports` enforces `status='pending'`,
 * `user_id IS NULL`, and `analysis IS NULL` at insert time.
 */
import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { UploadInitRequest } from "@/lib/schemas/report"
import { rateLimit, actorKey } from "@/lib/rate-limit"

const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

export async function POST(req: Request) {
  // 1. Rate limit: 10 uploads / 10 min per IP
  const who = actorKey(req)
  const limit = rateLimit(`upload-init:${who}`, {
    window: 10 * 60 * 1000,
    max: 10,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: limit.resetAt },
      {
        status: 429,
        headers: {
          "retry-after": String(
            Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000)),
          ),
        },
      },
    )
  }

  // 2. Parse + validate
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = UploadInitRequest.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { fileName, fileSize, mimeType, context } = parsed.data

  // 3. Generate id + storage path (storage key === row id, keeps lookups trivial)
  const id = randomUUID()
  const ext = EXT[mimeType]
  const storagePath = `${id}.${ext}`

  // 4. Insert pending row (RLS enforces status='pending', user_id IS NULL)
  const supabase = await createClient()
  const { error } = await supabase.from("reports").insert({
    id,
    storage_path: storagePath,
    file_name: fileName,
    file_size: fileSize,
    mime_type: mimeType,
    // Only set if the user actually typed something — keep null
    // rows null for cleanliness instead of empty strings.
    user_context: context && context.length > 0 ? context : null,
  })

  if (error) {
    console.error("[upload/init] insert failed:", error)
    return NextResponse.json({ error: "insert_failed" }, { status: 500 })
  }

  return NextResponse.json({ id, storagePath })
}
