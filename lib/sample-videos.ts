/**
 * Real pre-analyzed sample reports linked from the landing page chips.
 *
 * Clicking a chip navigates directly to /r/{id} — reviewers hit the magic
 * moment in under 5 seconds without uploading anything. Each id below
 * corresponds to a real `reports` row that already has analysis data
 * persisted, so the page renders the full v2 layout immediately.
 *
 * To add or rotate samples: see scripts/seed-samples.ts.
 */

export type SampleVideo = {
  /** The reports.id UUID — also the slug in /r/{id}. */
  id: string
  /** Display handle shown in the chip. */
  handle: string
  /** Short content tag — appears after the · in the chip. */
  category: string
  /** Pre-computed score shown in tooltips, never recomputed at click time. */
  demoScore: number
}

export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: "8acd04b5-c59e-408b-8da6-b6d4416f9238",
    handle: "@anon",
    category: "secret santa app",
    demoScore: 48,
  },
  {
    id: "d0072db2-2595-4818-a397-173e86aeafe9",
    handle: "@cloudinary",
    category: "dog clip",
    demoScore: 48,
  },
  {
    id: "667cc6b8-b9a7-4420-a389-ff826dbd5700",
    handle: "@blender",
    category: "animation",
    demoScore: 28,
  },
]
