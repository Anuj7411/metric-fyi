/**
 * Motion language for METRIC.fyi.
 *
 * Single source of truth for easings, durations, and stagger.
 * Lifted directly from the design bundle (designs/.../motion.jsx).
 *
 * Rule: things move when something is being *measured* or *changing state.*
 * No bouncy springs, no parallax, no scroll-jacked reveals.
 */

/** "iOS" ease — calm deceleration. Never bouncy. */
export const ease = [0.2, 0.8, 0.2, 1] as const

/** Durations (seconds — Framer convention). */
export const dur = {
  hover: 0.12, // 120ms · hover state changes
  element: 0.22, // 220ms · individual element reveals
  page: 0.48, // 480ms · whole-page transitions
  countUp: 1.4, // 1400ms · the hero score count-up
} as const

/** Stagger between sibling reveals. */
export const stagger = 0.04 // 40ms

/** Reusable variants. */
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: dur.element, ease },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: dur.element, ease },
}

/** Parent that staggers its motion children. */
export const staggerParent = {
  animate: {
    transition: {
      staggerChildren: stagger,
      delayChildren: 0.08,
    },
  },
}
