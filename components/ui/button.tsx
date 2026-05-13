import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * METRIC.fyi Button.
 *
 * Replaces shadcn's stock variants with our two real ones:
 *  - `signal` — radioactive lime fill on warm ink text. The primary CTA.
 *  - `ghost`  — transparent bg, line border, dim text. Secondary actions.
 *
 * No rounded corners (the design is square-edged), no shadow.
 * Disabled state dims to 60% and disables pointer events.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-mono uppercase tracking-[0.1em] text-[13px] font-semibold",
    "transition-all duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)]",
    "disabled:pointer-events-none disabled:opacity-60",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        signal:
          "bg-[var(--color-signal)] text-[var(--color-ink)] hover:opacity-90 focus-visible:outline-[var(--color-signal)]",
        ghost:
          "bg-transparent text-[var(--color-text-dim)] border border-[var(--color-line)] hover:text-[var(--color-text)] hover:border-[var(--color-text-mute)] focus-visible:outline-[var(--color-signal)]",
      },
      size: {
        default: "h-12 px-7",
        sm: "h-9 px-4",
        lg: "h-14 px-8 text-[14px]",
      },
    },
    defaultVariants: {
      variant: "signal",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      style={{ fontFamily: "var(--font-mono)" }}
      {...props}
    />
  )
}

export { Button, buttonVariants }
