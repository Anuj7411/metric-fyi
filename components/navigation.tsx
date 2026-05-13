import Link from "next/link"
import { Logo } from "@/components/marketing/Logo"

export function Navigation() {
  return (
    <nav
      className="relative flex justify-between items-center px-12 py-5 border-b"
      style={{ borderColor: "var(--color-line)" }}
    >
      <Logo />

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
