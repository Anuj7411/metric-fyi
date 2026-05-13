/**
 * In-memory token-bucket rate limiter.
 *
 * Day 3 implementation: lives in a Map inside the route handler's process
 * memory. On Vercel this resets per lambda instance, so the limit is *per
 * instance per IP* — fine for accidental abuse, not for serious DDoS.
 *
 * Day 9 swap: move to Vercel KV or Upstash Redis for global accounting.
 * See README's "Security decisions" section.
 */

type Bucket = number[] // timestamps (ms) of recent hits

const buckets = new Map<string, Bucket>()

export type RateLimitOptions = {
  /** Sliding window length in milliseconds. */
  window: number
  /** Max requests allowed inside the window. */
  max: number
}

export type RateLimitResult = {
  allowed: boolean
  /** How many more requests are allowed before the window slides. */
  remaining: number
  /** When the oldest in-window hit expires (ms epoch). */
  resetAt: number
}

/**
 * Record a hit and check if the bucket is still within budget.
 *
 * @param key  Unique per-actor (typically IP, or `route:IP` to scope per route).
 * @param opts window + max.
 */
export function rateLimit(
  key: string,
  { window, max }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now()
  const cutoff = now - window
  const prev = buckets.get(key) ?? []
  // Filter out hits outside the window.
  const recent = prev.filter((t) => t > cutoff)

  if (recent.length >= max) {
    buckets.set(key, recent)
    return {
      allowed: false,
      remaining: 0,
      resetAt: recent[0] + window,
    }
  }

  recent.push(now)
  buckets.set(key, recent)
  return {
    allowed: true,
    remaining: max - recent.length,
    resetAt: recent[0] + window,
  }
}

/** Best-effort actor key from an incoming Request. */
export function actorKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real
  return "anon"
}
