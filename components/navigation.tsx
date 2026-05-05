import Link from "next/link"

export function Navigation() {
  return (
    <nav
      className="relative flex justify-between items-center px-12 py-5 border-b"
      style={{ borderColor: "var(--color-line)" }}
    >
      <Link href="/" className="flex items-center gap-2.5 group">
        <div
          className="w-3.5 h-3.5"
          style={{ background: "var(--color-signal)" }}
        />
        <span
          className="font-mono text-[13px] font-semibold tracking-[0.05em] group-hover:opacity-80 transition-opacity"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          METRIC.fyi
        </span>
      </Link>

      <div
        className="hidden md:flex gap-8 font-mono text-[11px] tracking-[0.15em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-dim)" }}
      >
        <span className="cursor-default">How it works</span>
        <span className="cursor-default">Examples</span>
        <Link
          href="/auth/login"
          className="hover:opacity-80 transition-opacity"
          style={{ color: "var(--color-text)" }}
        >
          Sign in →
        </Link>
      </div>
    </nav>
  )
}
