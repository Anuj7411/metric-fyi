export function Footer() {
  return (
    <footer
      className="border-t mt-auto"
      style={{ borderColor: "var(--color-line)" }}
    >
      <div className="container mx-auto px-12 py-6 flex items-center justify-between">
        <div
          className="font-mono text-[10px] tracking-[0.15em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-mute)" }}
        >
          METRIC.fyi · v0.1 · {new Date().getFullYear()}
        </div>
        <div
          className="font-mono text-[10px] tracking-[0.1em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-mute)" }}
        >
          Built for the 8x &quot;Go Viral&quot; contest
        </div>
      </div>
    </footer>
  )
}
