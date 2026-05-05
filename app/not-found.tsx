import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"

export default function NotFound() {
  return (
    <main
      className="flex flex-col min-h-screen relative"
      style={{ background: "var(--color-ink)", color: "var(--color-text)" }}
    >
      <Navigation />

      <div className="flex-1 flex items-center justify-center px-12">
        <div className="max-w-3xl w-full">
          <div
            className="font-mono text-[11px] tracking-[0.2em] uppercase mb-4"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-hot)" }}
          >
            404 · Not found
          </div>
          <h1
            className="font-semibold m-0"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(56px, 9vw, 96px)",
              lineHeight: 0.96,
              letterSpacing: "-0.025em",
            }}
          >
            That route doesn&apos;t exist{" "}
            <em
              className="not-italic md:italic"
              style={{
                fontFamily: "var(--font-italic)",
                fontStyle: "italic",
                fontWeight: 400,
                color: "var(--color-text-mute)",
              }}
            >
              (yet).
            </em>
          </h1>
          <Link
            href="/"
            className="inline-block mt-10 font-mono text-[13px] font-semibold tracking-[0.1em] uppercase px-7 py-4 hover:opacity-90 transition-opacity"
            style={{
              fontFamily: "var(--font-mono)",
              background: "var(--color-signal)",
              color: "var(--color-ink)",
            }}
          >
            ← Back home
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  )
}
