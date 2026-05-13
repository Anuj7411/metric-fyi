/**
 * Supabase browser client (anonymous role).
 *
 * Used in client components and from the browser. Carries the user's auth
 * session via cookies when one exists (Day 8). For Day 3 we run fully
 * anonymous — no auth, no service-role.
 */
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
