import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"

export default function HomePage() {
  return (
    <main
      className="flex flex-col min-h-screen relative overflow-hidden"
      style={{ background: "var(--color-ink)", color: "var(--color-text)" }}
    >
      {/* faint grid background */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
        }}
      />

      <Navigation />

      <section className="flex-1 flex flex-col justify-center px-12 md:px-20 relative">
        {/* live chip */}
        <div
          className="font-mono text-[11px] tracking-[0.2em] uppercase mb-6 flex items-center gap-3"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-mute)" }}
        >
          <span
            className="inline-block w-1.5 h-1.5"
            style={{
              background: "var(--color-signal)",
              animation: "pulse 1.6s ease-in-out infinite",
            }}
          />
          Day 1 · Scaffolded · build sequence in progress
        </div>

        {/* headline */}
        <h1
          className="font-semibold m-0 max-w-[1280px]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(56px, 9vw, 108px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
          }}
        >
          Paste a video.
          <br />
          Get the{" "}
          <em
            className="not-italic md:italic"
            style={{
              fontFamily: "var(--font-italic)",
              fontStyle: "italic",
              fontWeight: 400,
              color: "var(--color-signal)",
            }}
          >
            brutally honest
          </em>
          <br />
          reason it isn&apos;t going off.
        </h1>

        {/* placeholder input — will become the real upload on Day 3 */}
        <div className="mt-12 max-w-[1100px]">
          <div
            className="flex items-center gap-4 px-6 border"
            style={{
              background: "var(--color-ink-2)",
              borderColor: "var(--color-line)",
            }}
          >
            <span
              className="font-mono text-base"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-signal)" }}
            >
              $
            </span>
            <span
              className="flex-1 font-mono text-lg py-6"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-mute)" }}
            >
              upload coming day 3 — paste a video, get a score
            </span>
            <button
              disabled
              className="font-mono text-[13px] font-semibold tracking-[0.1em] uppercase px-7 py-5 cursor-not-allowed opacity-60"
              style={{
                background: "var(--color-signal)",
                color: "var(--color-ink)",
                alignSelf: "stretch",
              }}
            >
              Score it →
            </button>
          </div>

          <div
            className="flex justify-between mt-3.5 font-mono text-[11px] tracking-[0.05em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-mute)" }}
          >
            <span>↳ no signup · no email · 22-second analysis</span>
            <span>↳ scaffolded {new Date().toISOString().slice(0, 10)}</span>
          </div>
        </div>
      </section>

      <Footer />

      <style>{`@keyframes pulse { 0%,100% {opacity:1} 50% {opacity:0.3} }`}</style>
    </main>
  )
}
