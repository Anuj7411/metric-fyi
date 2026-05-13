import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Report = {
  id: string
  status: "pending" | "analyzing" | "ready" | "failed"
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  duration_seconds: number | null
  error_message: string | null
  created_at: string
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc("fetch_report", { p_id: id })
    .single<Report>()

  // fetch_report returns a composite type; when no row matches, the
  // composite comes back with every field null. Treat missing id as 404.
  if (error || !data || !data.id) notFound()

  const sizeMB = (data.file_size / 1024 / 1024).toFixed(1)

  return (
    <main
      className="flex flex-col min-h-screen relative"
      style={{ background: "var(--color-ink)", color: "var(--color-text)" }}
    >
      <Navigation />

      <section className="flex-1 flex flex-col justify-center px-12 md:px-20 max-w-[1280px] w-full mx-auto">
        <div
          className="font-mono text-[11px] mb-4"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-mute)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          REPORT · /r/{data.id.slice(0, 6)}{" "}
          <span style={{ color: "var(--color-signal)" }}>·</span>{" "}
          {data.status.toUpperCase()}
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
          {data.status === "pending" || data.status === "analyzing"
            ? "Analyzing…"
            : data.status === "ready"
              ? "Ready."
              : "Failed."}
        </h1>

        <div
          className="mt-8 font-mono text-[12px] flex flex-col gap-1"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-dim)",
            letterSpacing: "0.05em",
          }}
        >
          <span>
            file ·{" "}
            <span style={{ color: "var(--color-text)" }}>{data.file_name}</span>
          </span>
          <span>
            size ·{" "}
            <span style={{ color: "var(--color-text)" }}>{sizeMB} MB</span>
          </span>
          <span>
            type ·{" "}
            <span style={{ color: "var(--color-text)" }}>{data.mime_type}</span>
          </span>
          <span>
            stored at ·{" "}
            <span style={{ color: "var(--color-text)" }}>
              videos/{data.storage_path}
            </span>
          </span>
        </div>

        <p
          className="mt-10 max-w-[640px] text-[14px] leading-relaxed"
          style={{ color: "var(--color-text-mute)" }}
        >
          Day 3 confirms the upload landed — the file is in Supabase Storage
          and a pending row exists in <code style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-dim)" }}>reports</code>.{" "}
          Day 4 wires Gemini 2.0 Flash to read the video and fill in the
          analysis. Day 5 turns this placeholder into the streamed score
          reveal — the magic moment.
        </p>
      </section>

      <Footer />
    </main>
  )
}
