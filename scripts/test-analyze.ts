/**
 * Prompt-iteration harness.
 *
 *   pnpm test:analyze              run all videos in tests/videos/
 *   pnpm test:analyze 01-user      run only files matching "01-user"
 *
 * Reads GEMINI_API_KEY from .env.local (loaded manually below). For each
 * video, calls analyzeInline(), validates the result against Zod, and
 * writes the full JSON to tests/outputs/<name>.json.
 *
 * Re-run after every prompt edit. Diff tests/outputs/ to see what changed.
 *
 * No shell calls, no child processes — only fs + the gemini wrapper.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs"
import { join, basename, extname } from "node:path"
import { analyzeInline } from "../lib/ai/gemini"

const TESTS_DIR = join(process.cwd(), "tests/videos")
const OUT_DIR = join(process.cwd(), "tests/outputs")

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
}

function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  }
}

async function runOne(file: string, apiKey: string): Promise<void> {
  const ext = extname(file).toLowerCase()
  const mime = MIME_BY_EXT[ext]
  if (!mime) {
    console.log(`  skip ${file} (unsupported extension)`)
    return
  }

  const bytes = readFileSync(file)
  const sizeMB = (bytes.byteLength / 1024 / 1024).toFixed(1)
  const label = basename(file)

  console.log("")
  console.log("------------------------------------------------------------")
  console.log(`> ${label}  (${sizeMB} MB, ${mime})`)
  console.log("------------------------------------------------------------")

  const t0 = Date.now()
  const result = await analyzeInline(bytes, mime, apiKey)
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  if (!result.ok) {
    console.log(`  FAIL in ${elapsed}s: ${result.error}`)
    if (result.rawText) console.log(`    raw: ${result.rawText.slice(0, 300)}`)
    return
  }

  const a = result.analysis
  console.log(`  OK in ${elapsed}s (${result.tokensUsed} tokens)`)
  console.log(`    SCORE       ${a.score} | ceiling ${a.comparison.ceilingScore}`)
  console.log(`    category    ${a.comparison.inferredCategory}`)
  console.log(`    verdict     "${a.verdict}"`)
  console.log(`    hook        lands at ${a.hook.landsAt}s -- ${a.hook.issue.slice(0, 60)}...`)
  console.log(`    breakdown   hook ${a.breakdown.hook}, pacing ${a.breakdown.pacing}, thumb ${a.breakdown.thumbnail}, caption ${a.breakdown.caption}`)
  console.log(`    fix         ${a.hook.fix.slice(0, 80)}...`)

  const outFile = join(OUT_DIR, `${basename(file, ext)}.json`)
  writeFileSync(outFile, JSON.stringify(a, null, 2))
  console.log(`    -> ${outFile}`)
}

async function main(): Promise<void> {
  loadEnvLocal()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set in .env.local")
    process.exit(1)
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const filter = process.argv[2]
  const all = readdirSync(TESTS_DIR)
    .filter((f) => /\.(mp4|mov|webm)$/i.test(f))
    .filter((f) => !filter || f.includes(filter))
    .sort()

  if (all.length === 0) {
    console.log(`No videos found in ${TESTS_DIR}${filter ? ` matching "${filter}"` : ""}`)
    return
  }

  console.log(`Running ${all.length} video(s) through Gemini...`)

  for (const f of all) {
    await runOne(join(TESTS_DIR, f), apiKey)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
