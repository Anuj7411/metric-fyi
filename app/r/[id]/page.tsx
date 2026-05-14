import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { ReportView } from "@/components/report/ReportView"
import { PendingClient } from "@/components/report/PendingClient"
import { Analysis } from "@/lib/ai/schema"

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
  analysis: unknown
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

  if (error || !data || !data.id) notFound()

  return (
    <main
      className="flex flex-col min-h-screen relative"
      style={{ background: "var(--color-ink)", color: "var(--color-text)" }}
    >
      <Navigation />

      <div className="flex-1 flex flex-col">
        {/* status chip + file meta — always visible at top */}
        <div className="max-w-[1280px] mx-auto px-12 md:px-20 pt-10 w-full">
          <div
            className="font-mono text-[11px]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-mute)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            REPORT · /r/{data.id.slice(0, 6)}{" "}
            <span style={{ color: "var(--color-text-mute)" }}>·</span>{" "}
            <span
              style={{
                color:
                  data.status === "ready"
                    ? "var(--color-signal)"
                    : data.status === "failed"
                      ? "var(--color-hot)"
                      : "var(--color-text-dim)",
              }}
            >
              {data.status}
            </span>
            <span style={{ color: "var(--color-text-mute)" }}>
              {" "}
              · {data.file_name}
            </span>
          </div>
        </div>

        {/* The body depends on status */}
        {data.status === "ready" && data.analysis ? (
          <ReportView analysis={Analysis.parse(data.analysis)} />
        ) : data.status === "failed" ? (
          <FailedState message={data.error_message ?? "Unknown error"} />
        ) : (
          // pending or analyzing — kick off the analyze call from the client
          <PendingClient id={data.id} />
        )}
      </div>

      <Footer />
    </main>
  )
}

function FailedState({ message }: { message: string }) {
  return (
    <div className="max-w-[1280px] mx-auto px-12 md:px-20 pt-12">
      <div
        className="font-mono text-[11px]"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-hot)",
          letterSpacing: "0.2em",
        }}
      >
        ANALYSIS FAILED
      </div>
      <h1
        className="mt-3 font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 6vw, 72px)",
          lineHeight: 0.98,
          letterSpacing: "-0.025em",
        }}
      >
        Something went wrong on this video.
      </h1>
      <p
        className="mt-4 max-w-[640px] font-mono text-[12px]"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-dim)",
        }}
      >
        {message}
      </p>
    </div>
  )
}
