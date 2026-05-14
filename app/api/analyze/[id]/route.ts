/**
 * POST /api/analyze/[id]
 *
 * Triggers Gemini analysis on a pending report. Idempotent — if the row
 * is already analyzing or ready, returns the current state without
 * re-running. Runs on Node runtime (Hobby allows up to 60s) since the
 * sync Gemini call takes ~30-40s for a 10MB clip.
 *
 * Flow:
 *   1. Look up the report row, must be status=pending
 *   2. Mark status=analyzing (so concurrent clicks don't double-spend)
 *   3. Download the video from Supabase Storage (server-side, no body cap)
 *   4. Call Gemini inline (synchronous, ~30s)
 *   5. Mark status=ready, persist analysis JSON
 *   6. Return analysis
 *
 * If any step fails, mark status=failed with error_message and return 500.
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { analyzeInline } from "@/lib/ai/gemini"
import { rateLimit, actorKey } from "@/lib/rate-limit"

// Node runtime (default) lets us go up to 60s on Vercel Hobby
export const maxDuration = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Report = {
  id: string
  status: "pending" | "analyzing" | "ready" | "failed"
  storage_path: string
  mime_type: string
  file_size: number
  analysis: unknown
  error_message: string | null
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  // 1. Rate limit: 5 analyses / 10 min per IP (analyses are expensive)
  const who = actorKey(req)
  const limit = rateLimit(`analyze:${who}`, {
    window: 10 * 60 * 1000,
    max: 5,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: limit.resetAt },
      { status: 429 },
    )
  }

  // 2. Pre-flight env check
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error("[analyze] GEMINI_API_KEY missing in env")
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 })
  }

  const supabase = await createClient()

  // 3. Look up the row via the SECURITY DEFINER function (RLS-safe)
  const { data: row, error: fetchErr } = await supabase
    .rpc("fetch_report", { p_id: id })
    .single<Report>()

  if (fetchErr || !row || !row.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  // 4. Idempotency: if already analyzed, return immediately
  if (row.status === "ready") {
    return NextResponse.json({ status: "ready", analysis: row.analysis })
  }
  if (row.status === "analyzing") {
    return NextResponse.json(
      { status: "analyzing", message: "Already in progress" },
      { status: 202 },
    )
  }
  if (row.status === "failed") {
    return NextResponse.json(
      { error: "previous_run_failed", message: row.error_message },
      { status: 422 },
    )
  }

  // 5. Claim the work — flip pending → analyzing
  // Note: anon RLS doesn't have an UPDATE policy on reports. We need to
  // add one OR add a SECURITY DEFINER RPC for status transitions. For
  // Day 4 minimum-viable, we add a transitions RPC.
  const { error: claimErr } = await supabase.rpc("mark_analyzing", { p_id: id })
  if (claimErr) {
    console.error("[analyze] failed to claim row:", claimErr)
    return NextResponse.json(
      { error: "claim_failed", message: claimErr.message },
      { status: 500 },
    )
  }

  // 6. Download video from Supabase Storage (public bucket; no auth needed)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const videoUrl = `${supabaseUrl}/storage/v1/object/public/videos/${row.storage_path}`

  let videoBytes: Uint8Array
  try {
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) {
      throw new Error(`storage fetch ${videoRes.status}`)
    }
    const buf = await videoRes.arrayBuffer()
    videoBytes = new Uint8Array(buf)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    await supabase.rpc("mark_failed", { p_id: id, p_msg: `download: ${msg}` })
    return NextResponse.json(
      { error: "video_download_failed", message: msg },
      { status: 500 },
    )
  }

  // 7. Run Gemini
  const result = await analyzeInline(videoBytes, row.mime_type, apiKey)

  if (!result.ok) {
    await supabase.rpc("mark_failed", { p_id: id, p_msg: result.error })
    return NextResponse.json(
      { error: "analysis_failed", message: result.error },
      { status: 500 },
    )
  }

  // 8. Persist the analysis JSON
  const { error: saveErr } = await supabase.rpc("save_analysis", {
    p_id: id,
    p_analysis: result.analysis,
  })

  if (saveErr) {
    console.error("[analyze] save_analysis failed:", saveErr)
    return NextResponse.json(
      { error: "save_failed", message: saveErr.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    status: "ready",
    analysis: result.analysis,
    tokensUsed: result.tokensUsed,
  })
}
