/**
 * Thin wrapper around Gemini's REST API for video analysis.
 *
 * Uses fetch directly (no SDK) so this is runtime-agnostic — works in
 * Node, Edge, and the scripts/test-analyze.ts harness identically.
 *
 * Two paths:
 *   - analyzeInline:    video <= 20MB, sent as base64 inline data, one call.
 *                       This is the FAST path used by the live app.
 *   - analyzeViaFiles:  video > 20MB. Upload to Files API, wait for ACTIVE,
 *                       then generateContent. Day 9+ implementation.
 */
import { SYSTEM_INSTRUCTION, USER_INSTRUCTION } from "./prompt"
import { ANALYSIS_RESPONSE_SCHEMA, Analysis } from "./schema"

const MODEL = "gemini-flash-latest" // currently → gemini-3-flash-preview (free tier)
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`

const INLINE_LIMIT = 20 * 1024 * 1024 // 20 MiB — Gemini inline data cap

export type AnalyzeResult =
  | { ok: true; analysis: Analysis; rawText: string; tokensUsed: number }
  | { ok: false; error: string; rawText?: string }

/**
 * Synchronous (non-streaming) analyze. Use for the test harness; the live
 * Edge route uses analyzeStreaming below.
 */
export async function analyzeInline(
  videoBytes: ArrayBuffer | Uint8Array,
  mimeType: string,
  apiKey: string,
): Promise<AnalyzeResult> {
  if (videoBytes.byteLength > INLINE_LIMIT) {
    return {
      ok: false,
      error: `Video is ${(videoBytes.byteLength / 1024 / 1024).toFixed(1)} MB; inline path supports up to 20 MB. Files API path lands Day 9.`,
    }
  }

  const base64 = bytesToBase64(videoBytes)
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: USER_INSTRUCTION },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
      temperature: 0.4, // slightly creative but mostly grounded
      thinkingConfig: { thinkingBudget: 0 }, // disable thinking for speed
    },
  }

  const res = await fetch(`${ENDPOINT}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    return { ok: false, error: `gemini ${res.status}: ${errText.slice(0, 500)}` }
  }

  const json: unknown = await res.json()
  const rawText = extractText(json)
  if (!rawText) {
    return {
      ok: false,
      error: "no text in response",
      rawText: JSON.stringify(json).slice(0, 500),
    }
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawText)
  } catch {
    return { ok: false, error: "model returned non-JSON", rawText }
  }

  const parsed = Analysis.safeParse(parsedJson)
  if (!parsed.success) {
    return {
      ok: false,
      error: `schema violation: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")} → ${i.message}`)
        .join("; ")}`,
      rawText,
    }
  }

  return {
    ok: true,
    analysis: parsed.data,
    rawText,
    tokensUsed: extractTokens(json),
  }
}

/**
 * Streaming analyze — yields raw text chunks as Gemini generates them.
 * Used by the live Edge route to pipe to SSE.
 */
export async function* analyzeStreamingInline(
  videoBytes: Uint8Array,
  mimeType: string,
  apiKey: string,
): AsyncGenerator<{ kind: "chunk"; text: string } | { kind: "error"; error: string }, void, unknown> {
  if (videoBytes.byteLength > INLINE_LIMIT) {
    yield { kind: "error", error: "video too large for inline path (>20MB)" }
    return
  }

  const base64 = bytesToBase64(videoBytes)
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: USER_INSTRUCTION },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
      temperature: 0.4,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  const res = await fetch(`${ENDPOINT}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    yield { kind: "error", error: `gemini ${res.status}: ${errText.slice(0, 500)}` }
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    yield { kind: "error", error: "no response body to stream" }
    return
  }

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE format: lines beginning with "data: ", separated by \n\n
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? "" // keep the trailing partial event

    for (const evt of events) {
      const line = evt.trim()
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6)
      if (data === "[DONE]") return
      try {
        const obj = JSON.parse(data)
        const text = extractText(obj)
        if (text) yield { kind: "chunk", text }
      } catch {
        // Skip malformed events
      }
    }
  }
}

/* ── helpers ────────────────────────────────────────────────── */

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  // Chunked conversion to avoid stack overflow on large arrays
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(u8.subarray(i, i + chunk)),
    )
  }
  // btoa exists in both Node 22+ and Edge; for older Node use Buffer.
  if (typeof btoa !== "undefined") return btoa(binary)
  return Buffer.from(binary, "binary").toString("base64")
}

function extractText(geminiResponse: unknown): string {
  if (
    typeof geminiResponse !== "object" ||
    geminiResponse === null ||
    !("candidates" in geminiResponse)
  )
    return ""
  const c = (geminiResponse as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    .candidates?.[0]
  const text = c?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
  return text
}

function extractTokens(geminiResponse: unknown): number {
  if (
    typeof geminiResponse !== "object" ||
    geminiResponse === null ||
    !("usageMetadata" in geminiResponse)
  )
    return 0
  return (
    (geminiResponse as { usageMetadata?: { totalTokenCount?: number } })
      .usageMetadata?.totalTokenCount ?? 0
  )
}
