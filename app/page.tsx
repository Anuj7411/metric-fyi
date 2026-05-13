import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Hero } from "@/components/landing/Hero"

export default function HomePage() {
  return (
    <main
      className="flex flex-col min-h-screen relative overflow-hidden"
      style={{ background: "var(--color-ink)", color: "var(--color-text)" }}
    >
      <Navigation />
      <Hero />
      <Footer />
    </main>
  )
}
