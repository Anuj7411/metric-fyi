import type React from "react"
import type { Metadata } from "next"
import localFont from "next/font/local"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Toaster } from "sonner"
import "./globals.css"

const clashDisplay = localFont({
  src: "../public/fonts/ClashDisplay-Variable.ttf",
  variable: "--font-clash",
  weight: "200 700",
  display: "swap",
})

export const metadata: Metadata = {
  title: "METRIC.fyi — the brutally honest reason your video isn't going off",
  description:
    "Paste a video. Get a 0–100 virality score with timestamped feedback on hook, pacing, caption, and thumbnail.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${clashDisplay.variable} ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased flex flex-col min-h-screen">
        <div className="flex-1 flex flex-col">{children}</div>
        {/* bottom-center stays visible on iOS Safari which obscures
            top-positioned toasts with its URL bar */}
        <Toaster position="bottom-center" richColors closeButton />
      </body>
    </html>
  )
}
