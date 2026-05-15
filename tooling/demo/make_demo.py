"""METRIC.fyi auto-demo recorder.

End-to-end pipeline that produces a finished demo video for the 8x Engineer
contest submission without requiring a microphone, camera, or any manual
clicking. One Python command takes you from a script in this file to an MP4
ready to upload to Loom.

Stages:
  1. Synthesize narration using Microsoft Edge's free neural voices (no key).
  2. Drive Chromium through the demo flow via Playwright, recording the
     viewport at 1440x900.
  3. Concatenate the per-segment audio and emit synchronized SRT captions.
  4. Mux narration onto the screen capture into final.mp4 using a bundled
     ffmpeg binary.

Run:
  cd tooling/demo
  pip install -r requirements.txt
  python -m playwright install chromium
  python make_demo.py

Output (all under tooling/demo/output/):
  final.mp4      <- upload this to Loom
  captions.srt   <- upload alongside (or paste into Loom's caption editor)
  narration.mp3  <- the standalone audio, if needed
"""
from __future__ import annotations

import asyncio
import re
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

import edge_tts
import imageio_ffmpeg
from playwright.async_api import Page, async_playwright

# ── Configuration ──────────────────────────────────────────────────────────

TARGET_URL = "https://metric-fyi.vercel.app"

# Picks the on-page sample chip to open. Falls back to the first /r/ link if
# the named handle isn't present. Defaults to the Secret Santa sample which
# is the most visually rich.
SAMPLE_REPORT_URL = (
    "https://metric-fyi.vercel.app/r/8acd04b5-c59e-408b-8da6-b6d4416f9238"
)

VOICE = "en-US-AriaNeural"  # alternatives: en-US-GuyNeural, en-GB-RyanNeural
RATE = "-5%"                # negative = slower; "+10%" would speed up

OUT_DIR = Path(__file__).parent / "output"
AUDIO_DIR = OUT_DIR / "audio"
VIDEO_DIR = OUT_DIR / "video"

VIEWPORT = {"width": 1440, "height": 900}


# ── Browser actions ────────────────────────────────────────────────────────
# Each is an async function taking the page. Failures are caught at the call
# site so a missing selector never aborts the whole recording.

async def goto_landing(page: Page):
    await page.goto(TARGET_URL, wait_until="networkidle")
    await page.wait_for_timeout(500)

async def stay(page: Page):
    """No-op action — narration plays while page sits still."""
    await page.wait_for_timeout(200)

async def open_sample(page: Page):
    """Open the demo report directly so we don't depend on click selectors."""
    await page.goto(SAMPLE_REPORT_URL, wait_until="networkidle")
    # Let the cascading reveal animations settle.
    await page.wait_for_timeout(3500)

async def scroll_down(page: Page, pixels: int = 700):
    await page.evaluate(
        f"window.scrollBy({{top: {pixels}, behavior: 'smooth'}})"
    )
    await page.wait_for_timeout(700)

async def scroll_to_hook(page: Page):
    await scroll_down(page, 800)

async def scroll_to_thumbnail(page: Page):
    await scroll_down(page, 1100)

async def scroll_to_whatif(page: Page):
    await scroll_down(page, 1400)

async def toggle_whatif(page: Page):
    """Click each What-If toggle. The simulator buttons carry the labels
    HOOK / PACING / CAPTION / THUMBNAIL inside the toggle grid; we click
    each by visible-text query."""
    labels = ["HOOK", "PACING", "CAPTION", "THUMBNAIL"]
    for label in labels:
        # Restrict to buttons inside the What-If grid: they appear in a 2x2
        # grid below the score. The first matching button on the page after
        # scrolling will be the What-If toggle (the breakdown labels above
        # are plain text, not buttons).
        button = page.get_by_role("button", name=re.compile(label, re.I)).first
        try:
            await button.scroll_into_view_if_needed(timeout=2000)
            await button.click(timeout=2000)
            await page.wait_for_timeout(600)
        except Exception as err:
            print(f"  [warn] could not toggle {label}: {err}")

async def scroll_top(page: Page):
    await page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
    await page.wait_for_timeout(800)


# ── The script ─────────────────────────────────────────────────────────────
# Each segment: (narration text, browser action, padding seconds after audio
# finishes). Keep narration concise; Edge TTS sounds best in 1–3 sentence
# chunks.

SEGMENTS = [
    (
        "Hi. This is METRIC dot F Y I — a virality score tool I built for "
        "the eight ex Engineer Go Viral Clone contest. Drop a short-form "
        "video, get a zero to one hundred score with timestamped feedback "
        "you can act on in your next edit.",
        goto_landing, 1.0,
    ),
    (
        "Three pre-analyzed clips are right here on the landing page so "
        "reviewers can see the magic moment without uploading anything.",
        stay, 0.5,
    ),
    (
        "Let's open one.",
        open_sample, 0.8,
    ),
    (
        "Watch the report build itself. Sections fade in one at a time over "
        "about three seconds — that's the visible reasoning differentiator.",
        stay, 0.5,
    ),
    (
        "Headline score, breakdown bars, comparison numbers — versus "
        "platform, versus category, ceiling. And a post-time recommendation "
        "reasoned per video, not templated.",
        stay, 0.5,
    ),
    (
        "Every timestamp in the report is a clickable citation. The video "
        "jumps to that frame and the marker on the scrubber pulses.",
        scroll_to_hook, 0.4,
    ),
    (
        "Real frame extraction — that's the actual current thumbnail and "
        "the proposed best frame, pulled from the video client-side using "
        "a hidden video element and a canvas.",
        scroll_to_thumbnail, 0.4,
    ),
    (
        "The wow moment. The What-If simulator. Each toggle represents "
        "applying one of the four recommended fixes. Watch the score morph.",
        scroll_to_whatif, 0.5,
    ),
    (
        "All four on, and the tier-one badge fires. The copy checklist "
        "button exports the entire re-record plan as plain text.",
        toggle_whatif, 1.5,
    ),
    (
        "Built solo in nine days with Claude. Repo is public, AI logs are "
        "in slash ai-logs. Thanks for watching.",
        scroll_top, 0.8,
    ),
]


# ── Audio + caption helpers ────────────────────────────────────────────────

def mp3_duration_seconds(path: Path, ffmpeg: str) -> float:
    """Read duration from ffmpeg -i stderr. Imageio's ffmpeg has no ffprobe
    so we parse the stderr the standard ffmpeg emits when given -i with no
    output."""
    result = subprocess.run(
        [ffmpeg, "-i", str(path), "-f", "null", "-"],
        capture_output=True, text=True,
    )
    match = re.search(r"Duration: (\d+):(\d+):([\d.]+)", result.stderr)
    if not match:
        return 0.0
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def srt_timestamp(seconds: float) -> str:
    td = timedelta(seconds=max(0.0, seconds))
    total_ms = int(round(td.total_seconds() * 1000))
    h, rem = divmod(total_ms, 3600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


async def synthesize_segment(text: str, out_path: Path):
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(str(out_path))


# ── Pipeline ───────────────────────────────────────────────────────────────

async def main():
    OUT_DIR.mkdir(exist_ok=True)
    AUDIO_DIR.mkdir(exist_ok=True)
    # Wipe prior video dir so we don't pick up an old webm.
    if VIDEO_DIR.exists():
        for f in VIDEO_DIR.glob("*"):
            f.unlink()
    VIDEO_DIR.mkdir(exist_ok=True)

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    # ── 1. Synthesize per-segment audio ──────────────────────────────────
    print("== Synthesizing narration ==")
    durations: list[float] = []
    audio_paths: list[Path] = []
    for i, (text, _, _) in enumerate(SEGMENTS):
        path = AUDIO_DIR / f"seg_{i:02d}.mp3"
        await synthesize_segment(text, path)
        dur = mp3_duration_seconds(path, ffmpeg)
        durations.append(dur)
        audio_paths.append(path)
        preview = text[:70].replace("\n", " ")
        print(f"  [{i:02d}] {dur:5.2f}s  {preview}...")

    # ── 2. Concatenate into a single narration.mp3 ───────────────────────
    print("\n== Concatenating narration ==")
    concat_list = OUT_DIR / "concat.txt"
    concat_list.write_text(
        "\n".join(f"file '{p.resolve().as_posix()}'" for p in audio_paths),
        encoding="utf-8",
    )
    narration_path = OUT_DIR / "narration.mp3"
    subprocess.run(
        [ffmpeg, "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat_list), "-c", "copy", str(narration_path)],
        check=True, capture_output=True,
    )
    print(f"  -> {narration_path}")

    # ── 3. Emit SRT captions with segment-level timings ──────────────────
    print("\n== Writing captions.srt ==")
    srt_chunks = []
    t = 0.0
    for i, ((text, _, pad), dur) in enumerate(zip(SEGMENTS, durations)):
        start = t
        end = t + dur
        srt_chunks.append(
            f"{i+1}\n"
            f"{srt_timestamp(start)} --> {srt_timestamp(end)}\n"
            f"{text}\n"
        )
        t = end + pad  # captions follow the same pacing as the recording
    (OUT_DIR / "captions.srt").write_text(
        "\n".join(srt_chunks) + "\n", encoding="utf-8"
    )
    print(f"  -> {OUT_DIR/'captions.srt'}")

    # ── 4. Drive Chromium and record viewport ────────────────────────────
    print("\n== Recording browser ==")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        ctx = await browser.new_context(
            viewport=VIEWPORT,
            record_video_dir=str(VIDEO_DIR),
            record_video_size=VIEWPORT,
        )
        page = await ctx.new_page()

        # One-second lead-in so the first frame isn't a flash.
        await page.wait_for_timeout(1000)

        for i, ((text, action, pad), dur) in enumerate(
            zip(SEGMENTS, durations)
        ):
            print(f"  [{i:02d}] action then wait {dur:.2f}s + pad {pad}s")
            try:
                await action(page)
            except Exception as err:
                print(f"  [warn] action raised: {err}")
            await page.wait_for_timeout(int(dur * 1000 + pad * 1000))

        # Tail pad so the last frame doesn't get clipped.
        await page.wait_for_timeout(800)

        await ctx.close()
        await browser.close()

    webm_files = sorted(VIDEO_DIR.glob("*.webm"))
    if not webm_files:
        print("ERROR: no .webm recording produced.", file=sys.stderr)
        sys.exit(1)
    webm_path = webm_files[-1]
    print(f"  -> {webm_path}")

    # ── 5. Mux narration onto the screen capture as final.mp4 ────────────
    print("\n== Muxing final video ==")
    final_path = OUT_DIR / "final.mp4"
    subprocess.run(
        [ffmpeg, "-y",
         "-i", str(webm_path),
         "-i", str(narration_path),
         "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k",
         "-shortest",
         str(final_path)],
        check=True,
    )

    print("\n========================================")
    print("DONE")
    print(f"  Final video : {final_path}")
    print(f"  Captions    : {OUT_DIR/'captions.srt'}")
    print(f"  Narration   : {narration_path}")
    print()
    print("Next steps:")
    print("  1. Open https://www.loom.com/library")
    print("  2. Click 'Upload' (top right), select final.mp4")
    print("  3. After upload, paste captions.srt into the captions editor")
    print("  4. Copy the share URL and paste it into the contest form")
    print("========================================")


if __name__ == "__main__":
    asyncio.run(main())
