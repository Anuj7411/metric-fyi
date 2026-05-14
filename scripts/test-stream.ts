/**
 * Verifies analyzeStreamingInline yields chunks correctly.
 *
 *   pnpm tsx scripts/test-stream.ts 01-user
 *
 * Prints each chunk as it arrives, then the assembled JSON, then parses
 * via Zod. Mirrors what the Edge route will do, in a Node harness so we
 * can test cheaply before deploying.
 *
 * No shell calls, no child processes — only fs + the gemini wrapper.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join, basename, extname } from "node:path"
import { analyzeStreamingInline } from "../lib/ai/gemini"
import { Analysis } from "../lib/ai/schema"

const TESTS_DIR = join(process.cwd(), "tests/videos")

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
}

function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local")
  if (!existsSync(path)) return
  const envPattern = /^([A-Z_][A-Z0-9_]*)=(.*)$/
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(envPattern)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set")
    process.exit(1)
  }

  const filter = process.argv[2] ?? "01-user"
  const files = readdirSync(TESTS_DIR).filter(
    (f) => /\.(mp4|mov|webm)$/i.test(f) && f.includes(filter),
  )
  if (files.length === 0) {
    console.error(`No videos in ${TESTS_DIR} matching "${filter}"`)
    process.exit(1)
  }
  const file = join(TESTS_DIR, files[0])
  const bytes = readFileSync(file)
  const mime = MIME[extname(file).toLowerCase()]

  console.log(`Streaming ${basename(file)} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB)...`)
  console.log("------------------------------------------------------------")

  const t0 = Date.now()
  let chunkCount = 0
  let firstChunkAt = 0
  let assembled = ""

  for await (const event of analyzeStreamingInline(bytes, mime, apiKey)) {
    if (event.kind === "error") {
      console.log(`FAIL: ${event.error}`)
      process.exit(1)
    }
    chunkCount++
    if (firstChunkAt === 0) firstChunkAt = Date.now() - t0
    assembled += event.text
    process.stdout.write(`[chunk ${chunkCount}, +${event.text.length} chars] `)
  }

  console.log("")
  console.log("------------------------------------------------------------")
  const total = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`done in ${total}s | ${chunkCount} chunks | first chunk at ${(firstChunkAt / 1000).toFixed(1)}s | total chars ${assembled.length}`)

  try {
    const parsed = Analysis.parse(JSON.parse(assembled))
    console.log(`SCHEMA OK | score=${parsed.score} verdict="${parsed.verdict}"`)
  } catch (err) {
    console.log("SCHEMA FAIL:", err)
    console.log("raw (last 500):", assembled.slice(-500))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
