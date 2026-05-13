/**
 * Sample videos shown on the landing page.
 *
 * Three pre-loaded demo clips. Reviewers can hit the magic moment in
 * under 30 seconds without needing their own video file.
 *
 * Day 2: metadata is stubbed. Day 3 wires real mp4s into Supabase Storage
 * and points `videoUrl` at the public URL.
 */

export type SampleVideo = {
  id: string
  handle: string
  category: string
  /** Will be filled Day 3 with the real Storage URL. */
  videoUrl: string | null
  /** Pre-computed virality score for the demo. */
  demoScore: number
}

export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: "khaby-life-hack",
    handle: "@khaby.lame",
    category: "life hack",
    videoUrl: null,
    demoScore: 88,
  },
  {
    id: "itsmaya-grwm",
    handle: "@itsmaya",
    category: "grwm",
    videoUrl: null,
    demoScore: 62,
  },
  {
    id: "bento-goal",
    handle: "@bento.mufc",
    category: "goal",
    videoUrl: null,
    demoScore: 73,
  },
]
