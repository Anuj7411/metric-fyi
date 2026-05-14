/**
 * Seed sample report URLs for the landing-page sample picker chips.
 *
 *   pnpm tsx scripts/seed-samples.ts
 *
 * For each video in tests/videos/ matching the SAMPLES list:
 *   1. Insert a pending `reports` row (id = generated UUID, status = pending).
 *      RLS allows this for anon — same path the upload route uses.
 *   2. Upload the bytes to Supabase Storage at videos/{uuid}.mp4.
 *   3. Trigger /api/analyze/[id] on the live deployment to score it.
 *   4. Print the resulting /r/{id} URL — paste it into lib/sample-videos.ts.
 *
 * No shell calls, no child processes — only fetch + supabase-js.
 *
 * Safe to re-run: each run generates fresh UUIDs and skips the analyze
 * step if the env var SKIP_ANALYZE is set (lets you upload first, score later).
 */
import { readFileSync, existsSync } from "node:fs"
import { join, basename } from "node:path"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const SAMPLES = [
  {
    file: "tests/videos/02-dog.mp4",
    label: "@cloudinary · dog clip",
  },
  {
    file: "tests/videos/03-bbb.mp4",
    label: "@blender · animation",
  },
]

const SITE_URL =
  process.env.SITE_URL ?? "https://metric-fyi.vercel.app"

function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local")
  if (!existsSync(path)) return
  const pattern = /^([A-Z_][A-Z0-9_]*)=(.*)$/
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(pattern)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  }
}

async function seedOne(file: string, label: string) {
  const path = join(process.cwd(), file)
  const bytes = readFileSync(path)
  const id = randomUUID()
  const storagePath = `${id}.mp4`
  const fileName = basename(file)

  console.log("")
  console.log(`▶ ${label}`)
  console.log(`  file: ${file} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB)`)
  console.log(`  id:   ${id}`)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  const supabase = createClient(supabaseUrl, anonKey)

  // 1. Insert pending row
  const { error: insertErr } = await supabase.from("reports").insert({
    id,
    storage_path: storagePath,
    file_name: fileName,
    file_size: bytes.byteLength,
    mime_type: "video/mp4",
  })
  if (insertErr) {
    console.error(`  ✘ insert failed:`, insertErr.message)
    return null
  }
  console.log(`  ✓ row inserted`)

  // 2. Upload bytes to Storage
  const blob = new Blob([new Uint8Array(bytes)], { type: "video/mp4" })
  const { error: upErr } = await supabase.storage
    .from("videos")
    .upload(storagePath, blob, {
      contentType: "video/mp4",
      upsert: false,
    })
  if (upErr) {
    console.error(`  ✘ storage upload failed:`, upErr.message)
    return null
  }
  console.log(`  ✓ uploaded to Storage`)

  // 3. Trigger analyze on the live deployment
  if (process.env.SKIP_ANALYZE === "1") {
    console.log(`  ⏭ SKIP_ANALYZE=1 → not running Gemini`)
    return { id, label }
  }

  console.log(`  ⏳ analyzing via ${SITE_URL}/api/analyze/${id} (~30s)...`)
  const t0 = Date.now()
  const analyzeRes = await fetch(`${SITE_URL}/api/analyze/${id}`, {
    method: "POST",
  })
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  const body = await analyzeRes.json().catch(() => ({}))

  if (!analyzeRes.ok) {
    console.error(
      `  ✘ analyze failed in ${elapsed}s:`,
      body?.error ?? analyzeRes.statusText,
    )
    return null
  }

  console.log(`  ✓ analyzed in ${elapsed}s`)
  if (body?.analysis) {
    console.log(`    score:   ${body.analysis.score}`)
    console.log(`    verdict: "${body.analysis.verdict?.slice(0, 80)}..."`)
  }
  console.log(`  → ${SITE_URL}/r/${id}`)

  return { id, label }
}

async function main() {
  loadEnvLocal()
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    console.error("Missing Supabase env vars in .env.local")
    process.exit(1)
  }

  const results: Array<{ id: string; label: string }> = []
  for (const sample of SAMPLES) {
    const result = await seedOne(sample.file, sample.label)
    if (result) results.push(result)
  }

  console.log("")
  console.log("------------------------------------------------------------")
  console.log("Seeded sample IDs (paste into lib/sample-videos.ts):")
  console.log("------------------------------------------------------------")
  for (const r of results) {
    console.log(`  ${r.label.padEnd(28)} ${r.id}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
