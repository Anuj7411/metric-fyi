/**
 * Per-device report history, persisted in localStorage.
 *
 * The contest's no-signup demo path means we can't tie reports to a user
 * account — but we can save the URLs locally so the same person on the
 * same browser can find their past uploads. Standard pattern (think
 * Pastebin "your pastes" or Replit Lite).
 *
 * Trade-offs (all expected for localStorage):
 *   - Per-browser: Chrome on laptop ≠ Safari on phone
 *   - Cleared if the user clears site data
 *   - Shared devices: anyone on the same browser sees the same history
 *   - Caps at 50 entries; oldest entries fall off when full
 *
 * Writes happen in two places:
 *   1. Hero.handleScore() — `writeHistoryEntry` immediately after the
 *      Storage upload succeeds (so the entry exists with status=pending).
 *   2. HistorySync (rendered inside /r/[id]) — `updateHistoryEntry`
 *      when the report is `ready`, filling in score + category. Never
 *      creates new entries — so visiting someone else's shared report
 *      link does NOT pollute your history with reports you didn't make.
 *
 * All functions are SSR-safe (guard on `typeof window`). Errors from
 * Safari private mode / quota exceeded are swallowed silently — history
 * is a UX nicety, never load-bearing.
 */

export type HistoryEntryStatus = "pending" | "ready" | "failed"

export type HistoryEntry = {
  /** UUID matching reports.id and the slug in /r/{id}. */
  id: string
  fileName: string
  fileSize: number
  /** Unix ms — when the user uploaded the file. */
  createdAt: number
  status: HistoryEntryStatus
  /** Filled in by HistorySync once analysis is ready. */
  score?: number
  category?: string
}

const STORAGE_KEY = "metric-fyi:history:v1"
const MAX_ENTRIES = 50

function canUseStorage(): boolean {
  if (typeof window === "undefined") return false
  try {
    const probe = "__metric_probe__"
    window.localStorage.setItem(probe, "1")
    window.localStorage.removeItem(probe)
    return true
  } catch {
    // Safari private mode, quota exceeded, blocked by extension, etc
    return false
  }
}

/** Read all entries, newest first. Returns [] if storage is unavailable. */
export function readHistory(): HistoryEntry[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isValidEntry)
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

function isValidEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string" &&
    typeof v.fileName === "string" &&
    typeof v.fileSize === "number" &&
    typeof v.createdAt === "number" &&
    typeof v.status === "string"
  )
}

function persist(entries: HistoryEntry[]): void {
  if (!canUseStorage()) return
  try {
    const trimmed = entries
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // quota exceeded or similar — silent
  }
}

/**
 * Add a new entry or refresh an existing one. Called by Hero right
 * after the upload completes successfully.
 */
export function writeHistoryEntry(input: {
  id: string
  fileName: string
  fileSize: number
  status?: HistoryEntryStatus
  createdAt?: number
}): void {
  const all = readHistory()
  const existing = all.find((e) => e.id === input.id)
  const merged: HistoryEntry = {
    id: input.id,
    fileName: input.fileName,
    fileSize: input.fileSize,
    createdAt: input.createdAt ?? existing?.createdAt ?? Date.now(),
    status: input.status ?? existing?.status ?? "pending",
    ...(existing?.score !== undefined && { score: existing.score }),
    ...(existing?.category && { category: existing.category }),
  }
  const next = [merged, ...all.filter((e) => e.id !== input.id)]
  persist(next)
}

/**
 * Update fields on an existing entry. Only mutates entries the user
 * already created — does NOT create a new entry for unknown ids, so
 * visiting a shared report link doesn't pollute someone else's history.
 */
export function updateHistoryEntry(
  id: string,
  patch: Partial<Omit<HistoryEntry, "id" | "createdAt">>,
): void {
  const all = readHistory()
  const existing = all.find((e) => e.id === id)
  if (!existing) return
  const updated: HistoryEntry = { ...existing, ...patch }
  persist(all.map((e) => (e.id === id ? updated : e)))
}

/** Remove all entries. Surfaced in the History modal as "Clear all". */
export function clearHistory(): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // silent
  }
}

/** Remove a single entry. */
export function removeHistoryEntry(id: string): void {
  const all = readHistory()
  persist(all.filter((e) => e.id !== id))
}

/** Format a unix-ms timestamp as "just now", "5m ago", "3d ago", or a date. */
export function fmtRelativeTime(timestampMs: number): string {
  const seconds = Math.floor((Date.now() - timestampMs) / 1000)
  if (seconds < 30) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestampMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}
