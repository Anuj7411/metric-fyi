"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Logo } from "@/components/marketing/Logo"
import { MonoTag } from "@/components/report/atoms"
import { ease } from "@/lib/motion"

/**
 * Top navigation rendered on every page.
 *
 * Two interactive buttons in the nav open modals:
 *   - "How it works" → 3-step explainer
 *   - "Examples"     → 3 pre-analyzed sample reports
 *
 * No "Sign in" — auth was deliberately cut (see README scope cuts) and a
 * dead link is worse than no link.
 *
 * Modals use the same Lab Lime token system as the rest of the app:
 * MonoTag captions, Clash Display for headings, signal lime for accents,
 * 220ms `ease` (the [.2,.8,.2,1] curve) for transitions.
 */
type ModalKind = "how" | "examples" | null

export function Navigation() {
  const [modal, setModal] = useState<ModalKind>(null)

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null)
    }
    window.addEventListener("keydown", onKey)
    // Lock body scroll while a modal is open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [modal])

  return (
    <>
      <nav
        className="relative flex justify-between items-center px-6 md:px-12 py-5 border-b"
        style={{ borderColor: "var(--color-line)" }}
      >
        <Logo />
        <div
          className="flex gap-4 md:gap-8 font-mono text-[10px] md:text-[11px] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-dim)",
            letterSpacing: "0.15em",
          }}
        >
          <NavButton onClick={() => setModal("how")}>How it works</NavButton>
          <NavButton onClick={() => setModal("examples")}>Examples</NavButton>
        </div>
      </nav>

      <AnimatePresence>
        {modal === "how" && (
          <Modal key="how" title="HOW IT WORKS" onClose={() => setModal(null)}>
            <HowItWorksContent />
          </Modal>
        )}
        {modal === "examples" && (
          <Modal
            key="examples"
            title="EXAMPLES"
            onClose={() => setModal(null)}
          >
            <ExamplesContent onPick={() => setModal(null)} />
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}

/* ── Small nav button with hover state ──────────────────────── */

function NavButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer"
      style={{
        background: "transparent",
        border: "none",
        color: "var(--color-text-dim)",
        fontFamily: "inherit",
        fontSize: "inherit",
        letterSpacing: "inherit",
        textTransform: "inherit",
        padding: 0,
        transition: "color 120ms cubic-bezier(.2,.8,.2,1)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.color = "var(--color-text)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.color = "var(--color-text-dim)")
      }
    >
      {children}
    </button>
  )
}

/* ── Modal shell — backdrop + animated panel ─────────────────── */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      style={{
        background: "rgba(14, 13, 11, 0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.26, ease }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[720px] max-h-[88vh] overflow-y-auto"
        style={{
          background: "var(--color-ink-2)",
          border: "1px solid var(--color-line-strong)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 md:px-8 py-4 border-b sticky top-0 z-10"
          style={{
            borderColor: "var(--color-line)",
            background: "var(--color-ink-2)",
          }}
        >
          <MonoTag>{title}</MonoTag>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "1px solid var(--color-line)",
              color: "var(--color-text-mute)",
              fontFamily: "var(--font-mono)",
              fontSize: 16,
              cursor: "pointer",
              width: 28,
              height: 28,
              lineHeight: 1,
              padding: 0,
              transition: "color 120ms, border-color 120ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-text)"
              e.currentTarget.style.borderColor = "var(--color-line-strong)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-mute)"
              e.currentTarget.style.borderColor = "var(--color-line)"
            }}
          >
            ×
          </button>
        </div>
        <div className="p-6 md:p-8">{children}</div>
      </motion.div>
    </motion.div>
  )
}

/* ── HOW IT WORKS content ────────────────────────────────────── */

function HowItWorksContent() {
  const steps = [
    {
      n: "01",
      title: "Drop a video",
      body: "Drag-and-drop anywhere on the landing page or click to pick. Accepts mp4, mov, or webm under 20 MB. No signup, no email — the URL you land on after analysis is yours forever.",
    },
    {
      n: "02",
      title: "Gemini watches frame by frame",
      body: "The file uploads straight to Supabase Storage, then Gemini Flash analyzes the actual frames, audio, and on-screen text. About 18–34 seconds for a typical short.",
    },
    {
      n: "03",
      title: "Read the brutally honest report",
      body: "Score 0–100 with a per-section breakdown. Hook timestamp, pacing edits, thumbnail recommendation, caption rewrites — every fix cites the exact moment in the video. Toggle the What If? simulator at the bottom to watch your score climb toward the ceiling as you apply each fix.",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "clamp(28px, 4vw, 40px)",
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          color: "var(--color-text)",
          margin: 0,
        }}
      >
        Three steps.{" "}
        <em
          style={{
            fontFamily: "var(--font-italic)",
            fontStyle: "italic",
            color: "var(--color-signal)",
            fontWeight: 500,
          }}
        >
          22 seconds.
        </em>
      </h2>

      <div className="flex flex-col gap-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="grid grid-cols-[auto_1fr] gap-5 p-5 border"
            style={{
              borderColor: "var(--color-line)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 48,
                lineHeight: 0.9,
                color: "var(--color-signal)",
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.n}
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: 20,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                  color: "var(--color-text)",
                  margin: 0,
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--color-text-dim)",
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                {s.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p
        className="border-t pt-4"
        style={{
          borderColor: "var(--color-line)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-text-mute)",
          letterSpacing: "0.05em",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        ↳ Built with Gemini Flash · Supabase · Next.js 16. No service-role
        keys, no auth required, RLS-enforced at the database. Open-source
        on GitHub — link at the bottom of the report page.
      </p>
    </div>
  )
}

/* ── EXAMPLES content ────────────────────────────────────────── */

const EXAMPLES = [
  {
    id: "8acd04b5-c59e-408b-8da6-b6d4416f9238",
    handle: "@anon",
    category: "Secret Santa app",
    score: 48,
    verdict:
      "The core product utility is clear, but the aggressive negative hook feels disconnected from the actual app demo.",
  },
  {
    id: "d0072db2-2595-4818-a397-173e86aeafe9",
    handle: "@cloudinary",
    category: "Dog clip",
    score: 48,
    verdict:
      "The visual is cute but the pacing is stagnant, leaving the viewer waiting for a payoff that never comes.",
  },
  {
    id: "667cc6b8-b9a7-4420-a389-ff826dbd5700",
    handle: "@blender",
    category: "Animation",
    score: 28,
    verdict:
      "A static landscape with zero movement or subject presence is a guaranteed scroll past in the first half second.",
  },
]

function ExamplesContent({ onPick }: { onPick: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "clamp(28px, 4vw, 40px)",
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          color: "var(--color-text)",
          margin: 0,
        }}
      >
        Three real reports.{" "}
        <em
          style={{
            fontFamily: "var(--font-italic)",
            fontStyle: "italic",
            color: "var(--color-signal)",
            fontWeight: 500,
          }}
        >
          Click any.
        </em>
      </h2>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          color: "var(--color-text-dim)",
          lineHeight: 1.55,
          margin: 0,
          maxWidth: 560,
        }}
      >
        Each card links to a pre-analyzed report — score, video player with
        marker pins, fix sections, and the What If? simulator. Same flow
        you&apos;d get if you uploaded your own video.
      </p>

      <div className="flex flex-col gap-3">
        {EXAMPLES.map((ex) => (
          <ExampleCard key={ex.id} ex={ex} onPick={onPick} />
        ))}
      </div>

      <p
        className="border-t pt-4"
        style={{
          borderColor: "var(--color-line)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-text-mute)",
          letterSpacing: "0.05em",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        ↳ Sample videos sourced from Cloudinary&apos;s public demo bucket
        and test-videos.co.uk (CC0). Real Gemini analyses run on each.
      </p>
    </div>
  )
}

function ExampleCard({
  ex,
  onPick,
}: {
  ex: (typeof EXAMPLES)[number]
  onPick: () => void
}) {
  const scoreColor =
    ex.score < 50 ? "var(--color-hot)" : "var(--color-signal)"
  const truncated =
    ex.verdict.length > 130 ? ex.verdict.slice(0, 127) + "…" : ex.verdict

  return (
    <Link
      href={`/r/${ex.id}`}
      onClick={onPick}
      className="grid grid-cols-[auto_1fr_auto] gap-4 md:gap-5 p-4 md:p-5 border items-center"
      style={{
        borderColor: "var(--color-line)",
        background: "rgba(255,255,255,0.02)",
        textDecoration: "none",
        transition: "border-color 120ms, background 120ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--color-signal)"
        e.currentTarget.style.background = "rgba(198,255,61,0.04)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-line)"
        e.currentTarget.style.background = "rgba(255,255,255,0.02)"
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 56,
          lineHeight: 0.85,
          color: scoreColor,
          letterSpacing: "-0.04em",
          fontVariantNumeric: "tabular-nums",
          minWidth: 70,
        }}
      >
        {ex.score}
      </div>
      <div className="min-w-0">
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-mute)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {ex.handle} · {ex.category}
        </div>
        <div
          style={{
            fontFamily: "var(--font-italic)",
            fontStyle: "italic",
            fontSize: 15,
            lineHeight: 1.4,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          &ldquo;{truncated}&rdquo;
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--color-text-mute)",
          letterSpacing: "0.1em",
        }}
      >
        →
      </div>
    </Link>
  )
}
