"use client"

import type { CSSProperties, ReactNode } from "react"

/**
 * Small reusable bits used across every section of the v2 report layout.
 * Live in one file so we don't sprinkle ten tiny components throughout.
 */

/* ── Watermark — giant transparent numeral background ─────────── */

export function Watermark({
  children,
  opacity = 0.04,
  size = 460,
  right = -60,
  top = -40,
}: {
  children: ReactNode
  opacity?: number
  size?: number
  right?: number
  top?: number
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        right,
        top,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        color: `rgba(198,255,61,${opacity})`,
        letterSpacing: "-0.06em",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  )
}

/* ── MonoTag — small mono caps label ─────────────────────────── */

export function MonoTag({
  children,
  color = "var(--color-text-mute)",
}: {
  children: ReactNode
  color?: string
}) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.2em",
        color,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  )
}

/* ── Pill — small bordered chip ──────────────────────────────── */

export function Pill({
  children,
  color = "var(--color-text-mute)",
  bg = "transparent",
}: {
  children: ReactNode
  color?: string
  bg?: string
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.12em",
        color,
        background: bg,
        border: `1px solid ${color}`,
        padding: "4px 8px",
        textTransform: "uppercase",
        display: "inline-block",
      }}
    >
      {children}
    </span>
  )
}

/* ── Button styles (ghost + primary) ─────────────────────────── */

export function btnStyle(
  variant: "ghost" | "primary" = "ghost",
  size: "default" | "small" = "default",
): CSSProperties {
  const sizes = {
    default: { padding: "11px 18px", fontSize: 11 },
    small: { padding: "8px 12px", fontSize: 10 },
  }
  return {
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    letterSpacing: "0.12em",
    background: variant === "primary" ? "var(--color-signal)" : "transparent",
    color: variant === "primary" ? "var(--color-ink)" : "var(--color-text)",
    border: `1px solid ${variant === "primary" ? "var(--color-signal)" : "var(--color-line-strong)"}`,
    cursor: "pointer",
    textTransform: "uppercase" as const,
    ...sizes[size],
  }
}

/* ── Format seconds as M:SS ──────────────────────────────────── */

export function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}
