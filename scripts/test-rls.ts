/**
 * Row Level Security regression test.
 *
 *   pnpm test:rls
 *
 * Runs as the public anon role (via the publishable key) and verifies that
 * the security policies defined in supabase/migrations/* hold:
 *
 *   - anon cannot directly SELECT from `reports` (must use fetch_report RPC)
 *   - anon cannot INSERT a row with disallowed initial state
 *   - anon cannot UPDATE or DELETE existing rows
 *   - fetch_report leaks nothing for unknown UUIDs (only returns null composite)
 *   - fetch_report returns the row for a known UUID
 *   - Storage rejects uploads with disallowed mime types
 *   - Storage rejects anon delete attempts
 *
 * Exit code 0 if every check passes, 1 otherwise. Run after every RLS
 * migration to catch regressions before they ship.
 *
 * No shell calls, no child processes — only fs + supabase-js.
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/* ── env loader ────────────────────────────────────────────── */

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

/* ── tiny test harness ─────────────────────────────────────── */

type Result = { name: string; passed: boolean; detail?: string }
const results: Result[] = []

async function check(
  name: string,
  fn: () => Promise<string | undefined>,
): Promise<void> {
  try {
    const detail = await fn()
    results.push({ name, passed: true, detail })
    console.log(`  PASS  ${name}`)
    if (detail) console.log(`        ↳ ${detail}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    results.push({ name, passed: false, detail: msg })
    console.log(`  FAIL  ${name}`)
    console.log(`        ↳ ${msg}`)
  }
}

/* ── checks ─────────────────────────────────────────────────── */

/** A known-good sample report id (from scripts/seed-samples.ts output). */
const KNOWN_REPORT_ID = "8acd04b5-c59e-408b-8da6-b6d4416f9238"

async function runChecks(supabase: SupabaseClient): Promise<void> {
  // 1. anon SELECT * → empty (no SELECT policy for anon)
  await check("anon cannot SELECT * from reports", async () => {
    const { data, error } = await supabase
      .from("reports")
      .select("id")
      .limit(100)
    if (error) {
      // Some Supabase versions surface this as 401; that's also acceptable
      return `errored as expected (${error.code ?? error.message})`
    }
    if (!data) throw new Error("data is null but no error")
    if (data.length > 0) {
      throw new Error(`leaked ${data.length} row(s); expected 0`)
    }
    return "0 rows returned (RLS filtered correctly)"
  })

  // 2. INSERT with status='ready' → RLS WITH CHECK rejects
  await check("anon cannot INSERT with status='ready'", async () => {
    const { error } = await supabase.from("reports").insert({
      id: randomUUID(),
      storage_path: "rls-test.mp4",
      file_name: "rls-test.mp4",
      file_size: 100,
      mime_type: "video/mp4",
      status: "ready", // forbidden by the RLS check
    })
    if (!error) throw new Error("INSERT succeeded; should have been blocked")
    if (error.code !== "42501") {
      throw new Error(`wrong error code ${error.code}: ${error.message}`)
    }
    return `blocked (PG 42501 RLS violation)`
  })

  // 3. INSERT with user_id set → RLS rejects
  await check("anon cannot INSERT with user_id set", async () => {
    const { error } = await supabase.from("reports").insert({
      id: randomUUID(),
      storage_path: "rls-test.mp4",
      file_name: "rls-test.mp4",
      file_size: 100,
      mime_type: "video/mp4",
      user_id: randomUUID(), // forbidden
    })
    if (!error) throw new Error("INSERT succeeded; should have been blocked")
    if (error.code !== "42501") {
      throw new Error(`wrong error code ${error.code}: ${error.message}`)
    }
    return `blocked (anon can't claim a user_id)`
  })

  // 4. INSERT with analysis populated → RLS rejects
  await check("anon cannot INSERT with analysis populated", async () => {
    const { error } = await supabase.from("reports").insert({
      id: randomUUID(),
      storage_path: "rls-test.mp4",
      file_name: "rls-test.mp4",
      file_size: 100,
      mime_type: "video/mp4",
      analysis: { score: 100, fake: true }, // forbidden
    })
    if (!error) throw new Error("INSERT succeeded; should have been blocked")
    if (error.code !== "42501") {
      throw new Error(`wrong error code ${error.code}: ${error.message}`)
    }
    return `blocked (anon can't seed analysis data)`
  })

  // 5. UPDATE attempt — no policy for anon UPDATE
  await check("anon UPDATE returns zero rows affected", async () => {
    const { data, error } = await supabase
      .from("reports")
      .update({ status: "failed", error_message: "rls-test-injection" })
      .eq("id", KNOWN_REPORT_ID)
      .select()
    if (error && error.code === "42501") return `blocked (42501)`
    if (data && data.length > 0) {
      throw new Error(`updated ${data.length} row(s); should be 0`)
    }
    return `0 rows updated (no UPDATE policy = silent RLS filter)`
  })

  // 6. DELETE attempt
  await check("anon DELETE returns zero rows affected", async () => {
    const { data, error } = await supabase
      .from("reports")
      .delete()
      .eq("id", KNOWN_REPORT_ID)
      .select()
    if (error && error.code === "42501") return `blocked (42501)`
    if (data && data.length > 0) {
      throw new Error(`deleted ${data.length} row(s); should be 0`)
    }
    return `0 rows deleted`
  })

  // 7. fetch_report with random UUID → null composite
  await check("fetch_report(random UUID) leaks nothing", async () => {
    const { data, error } = await supabase
      .rpc("fetch_report", { p_id: randomUUID() })
      .single()
    if (error) throw new Error(`RPC errored: ${error.message}`)
    const row = data as { id: string | null } | null
    if (row && row.id) {
      throw new Error(`got a row with id ${row.id}; should be null`)
    }
    return `returned null composite (unknown UUID = no leak)`
  })

  // 8. fetch_report with known UUID → returns the row
  await check("fetch_report(known UUID) returns the row", async () => {
    const { data, error } = await supabase
      .rpc("fetch_report", { p_id: KNOWN_REPORT_ID })
      .single<{ id: string }>()
    if (error) throw new Error(`RPC errored: ${error.message}`)
    if (!data?.id) throw new Error("got null composite for a known UUID")
    if (data.id !== KNOWN_REPORT_ID) {
      throw new Error(`returned wrong row: ${data.id}`)
    }
    return `returned ${data.id.slice(0, 8)}…`
  })

  // 9. Storage rejects disallowed mime type
  await check("Storage rejects non-video upload", async () => {
    const text = new Blob(["rls test"], { type: "text/plain" })
    const { error } = await supabase.storage
      .from("videos")
      .upload(`rls-test-${randomUUID()}.txt`, text, {
        contentType: "text/plain",
      })
    if (!error) throw new Error("text upload succeeded; should be rejected")
    return `blocked (${error.message.slice(0, 60)})`
  })

  // 10. Storage rejects anon delete
  await check("Storage rejects anon delete", async () => {
    const { data, error } = await supabase.storage
      .from("videos")
      .remove([`${KNOWN_REPORT_ID}.mp4`])
    // Either an explicit error OR an empty data array = no rows removed
    if (error) return `errored (${error.message.slice(0, 60)})`
    if (data && data.length > 0) {
      throw new Error(`removed ${data.length} object(s); should be 0`)
    }
    return `0 objects removed`
  })
}

/* ── entry ──────────────────────────────────────────────────── */

async function main(): Promise<void> {
  loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anon) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_* env vars in .env.local")
    process.exit(1)
  }

  console.log("METRIC.fyi · RLS regression test")
  console.log("------------------------------------------------------------")
  console.log(`target:    ${url}`)
  console.log(`role:      anon (publishable key)`)
  console.log("")

  const supabase = createClient(url, anon, {
    auth: { persistSession: false },
  })

  await runChecks(supabase)

  const passed = results.filter((r) => r.passed).length
  const total = results.length
  console.log("")
  console.log("------------------------------------------------------------")
  console.log(
    `${passed}/${total} checks passed · ${total - passed} failed`,
  )

  if (passed !== total) {
    console.log("")
    console.log("Failed checks:")
    for (const r of results.filter((x) => !x.passed)) {
      console.log(`  - ${r.name}`)
      console.log(`    ${r.detail}`)
    }
  }

  process.exit(passed === total ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
