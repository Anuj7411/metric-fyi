/**
 * Supabase server client (anonymous role + SSR cookie wiring).
 *
 * Used in Route Handlers, Server Components, and Server Actions. Reads/writes
 * Supabase auth cookies so when we add sign-in (Day 8) the same code paths
 * automatically pick up the user's session.
 *
 * Never use service-role anywhere — RLS does the security work.
 */
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // setAll throws when called from a Server Component.
            // Safe to ignore if middleware refreshes the session.
          }
        },
      },
    },
  )
}
