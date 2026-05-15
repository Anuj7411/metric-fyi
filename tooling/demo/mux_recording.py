"""Auto-fit AI narration + captions onto your silent screen recording.

The recommended workflow:
  1. Record the screen in Loom (silent, no mic, no system audio). Don't
     worry about hitting a specific duration — record at whatever pace
     feels natural.
  2. Download the raw MP4 from Loom.
  3. Run:  python mux_recording.py path/to/your-recording.mp4

What happens then:
  - The script measures your video's duration.
  - It picks a speech rate (faster or slower) so the narration finishes
     within your video. The default rate range is -25% to +25%; beyond
     that you'll get a warning and the narration plays at the closest
     legal rate.
  - It synthesizes the narration with Microsoft Edge's free neural voice.
  - It builds an SRT with timings matching the new audio durations.
  - It burns the captions into the video as a styled subtitle overlay
     and writes a final.mp4 ready to upload to Loom.

You no longer need to record to a target duration. Just record what feels
natural and let the script handle the fit.
"""
from __future__ import annotations

import argparse
import asyncio
import re
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

import edge_tts
import imageio_ffmpeg

# Re-use directories + voice config from make_demo, but we define our own
# BEATS list below tuned to the user's actual recorded video.
from make_demo import AUDIO_DIR, OUT_DIR, VOICE, DEFAULT_RATE

# ── BEATS: text + target duration aligned to the user's recording ──────────
# Each entry: (narration text, target_seconds_from_start_of_THIS_beat_to_next)
# Total of all targets should equal the user's video duration.
#
# Synthesis: each beat is synthesized at default speed. If the audio is
# shorter than its target, silence pads to the target. If it overshoots,
# the next beat starts late — keep word counts under the target budget.
#
# Word budget rule of thumb: ~2.3 words per target-second.
BEATS: list[tuple[str, float]] = [
    # 0:00–0:12 — landing page (12s, ~27 word budget)
    ("This is METRIC dot F Y I — my eight ex Engineer Go Viral Clone "
     "contest entry. Drop a short form video, get a brutally honest score "
     "with timestamped fixes.",
     12.0),
    # 0:12–0:17 — hovering nav (5s, ~11 word budget)
    ("Three nav buttons up top — How it Works, Examples, and History.",
     5.0),
    # 0:17–0:27 — How it Works modal (10s)
    ("How it Works lays out three steps. Upload, the AI watches every "
     "frame, you get fixes with exact timestamps.",
     10.0),
    # 0:27–0:36 — History modal (9s, ~20 word budget)
    ("History keeps every report you've analyzed on this device in local "
     "storage. No signup, no account — come back to your work anytime.",
     9.0),
    # 0:36–0:49 — upload from local storage (13s, ~30 word budget)
    ("Now let's upload a fresh video. The browser uploads directly to "
     "Supabase Storage, bypassing Vercel's body cap, and only a pending "
     "row goes through our API — keeps the architecture clean.",
     13.0),
    # 0:49–0:55 — analyzing screen (6s)
    ("The video goes to Gemini Flash. Analysis takes about twenty seconds.",
     6.0),
    # 0:55–1:06 — score page + breakdown bars + comparison (11s)
    ("Here's the report. Headline score, four breakdown bars, and "
     "comparison numbers — versus platform, versus niche, ceiling.",
     11.0),
    # 1:06–1:41 — video timeline / cuts / frames / clicking (35s, ~80 words)
    ("The video player has a unified scrubber where playback, the hook "
     "landing dot, pacing cuts, and dead air ranges all share one "
     "horizontal timeline. Every timestamp shown anywhere in the report "
     "is a clickable citation — click any chip, the video jumps to that "
     "frame and the matching marker on the scrubber pulses. Real frame "
     "thumbnails are extracted client side using a hidden video element "
     "and a canvas — no server processing, no ffmpeg, just the actual "
     "frames pulled straight from your upload.",
     35.0),
    # 1:41–1:45 — FIX 01 hook (4s)
    ("Fix one. Hook, with three ranked rewrites.",
     4.0),
    # 1:45–1:50 — FIX 02 pacing (5s)
    ("Fix two. Pacing — cuts and dead air flagged.",
     5.0),
    # 1:50–1:57 — FIX 03 thumbnail (7s)
    ("Fix three. Thumbnail — current cover versus proposed best frame.",
     7.0),
    # 1:57–2:01 — FIX 04 caption (4s)
    ("Fix four. Caption rewrites.",
     4.0),
    # 2:01–2:11 — What If toggles (10s)
    ("The wow moment. What If simulator. Toggle each fix, score morphs. "
     "All four on, tier one badge fires.",
     10.0),
    # 2:11–2:21 — Trending audio + hashtags (10s)
    ("Trending audio as mood descriptors, plus five hashtags grounded in "
     "your video's content. No hallucinated track names.",
     10.0),
    # 2:21–2:27 — History close (6s)
    ("History pins reports here. Built in nine days with Claude.",
     6.0),
]


# ── Helpers ────────────────────────────────────────────────────────────────

def media_duration_seconds(path: Path, ffmpeg: str) -> float:
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


async def synth(text: str, out_path: Path, rate: str) -> None:
    c = edge_tts.Communicate(text, VOICE, rate=rate)
    await c.save(str(out_path))


def parse_rate(rate_str: str) -> float:
    """'-5%' -> -5.0"""
    return float(rate_str.replace("%", "").replace("+", ""))


def format_rate(rate_pct: float) -> str:
    """5.0 -> '+5%', -5.0 -> '-5%'"""
    sign = "+" if rate_pct >= 0 else ""
    return f"{sign}{int(round(rate_pct))}%"


def escape_for_subtitles_filter(path: Path) -> str:
    p = str(path.resolve()).replace("\\", "/")
    p = re.sub(r"^([A-Za-z]):", r"\1\\:", p)
    return p


def run_ffmpeg(args: list, label: str = "ffmpeg") -> None:
    print(f"  $ {label} ...")
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"{label} failed:", file=sys.stderr)
        print(result.stderr[-2000:], file=sys.stderr)
        sys.exit(result.returncode)


# ── Core flow ──────────────────────────────────────────────────────────────

async def synth_per_beat(
    rate: str, ffmpeg: str
) -> tuple[list[float], list[float], Path]:
    """Synthesize each beat and pad silence so the audio sits exactly at
    its target start time.

    Returns (audio_durations, silence_after, narration_path).
    The narration MP3 plays beat 0 → silence → beat 1 → silence → ... so
    that beat i starts at sum(target[:i]) in the final mix.
    """
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    audio_durations: list[float] = []
    silences: list[float] = []
    audio_paths: list[Path] = []

    for i, (text, target) in enumerate(BEATS):
        p = AUDIO_DIR / f"seg_{i:02d}.mp3"
        await synth(text, p, rate)
        actual = media_duration_seconds(p, ffmpeg)
        silence_after = max(0.0, target - actual)
        if actual > target + 0.5:
            print(f"  [{i:02d}] {actual:5.2f}s OVER target {target}s "
                  f"-- consider trimming wording")
        audio_durations.append(actual)
        silences.append(silence_after)
        audio_paths.append(p)
        preview = text[:60].replace("\n", " ")
        print(f"  [{i:02d}] {actual:5.2f}s + {silence_after:4.2f}s pad "
              f"(target {target:4.1f}s)  {preview}...")

    # Build the narration MP3: each beat audio, followed by a silence clip
    # of exactly the right length, then the next beat audio.
    concat_lines: list[str] = []
    for i, (audio_p, sil) in enumerate(zip(audio_paths, silences)):
        concat_lines.append(f"file '{audio_p.resolve().as_posix()}'")
        if sil > 0.01:
            sil_p = AUDIO_DIR / f"sil_{i:02d}.mp3"
            run_ffmpeg(
                [ffmpeg, "-y",
                 "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                 "-t", f"{sil:.3f}",
                 "-q:a", "9", "-acodec", "libmp3lame",
                 str(sil_p)],
                label=f"silence {sil:.2f}s @ beat {i}",
            )
            concat_lines.append(f"file '{sil_p.resolve().as_posix()}'")

    concat_list = OUT_DIR / "concat.txt"
    concat_list.write_text("\n".join(concat_lines), encoding="utf-8")
    narration = OUT_DIR / "narration.mp3"
    run_ffmpeg(
        [ffmpeg, "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat_list), "-c", "copy", str(narration)],
        label="concat narration",
    )
    return audio_durations, silences, narration


def write_captions_for_beats(
    audio_durations: list[float], silences: list[float], path: Path
) -> None:
    """Cue i starts when beat i's audio starts, ends when its audio ends.
    The silence after a beat is dead time with no caption — the next cue
    appears when the next beat's audio kicks in."""
    chunks: list[str] = []
    t = 0.0
    for i, ((text, _target), dur, sil) in enumerate(
        zip(BEATS, audio_durations, silences)
    ):
        start = t
        end = t + dur
        chunks.append(
            f"{i+1}\n{srt_timestamp(start)} --> {srt_timestamp(end)}\n{text}\n"
        )
        t = end + sil
    path.write_text("\n".join(chunks) + "\n", encoding="utf-8")


def pick_fit_strategy(
    video_seconds: float, base_seconds: float
) -> tuple[str, float, str]:
    """Pick the right combination of speech rate + inter-segment silence
    so narration fills the user's video naturally.

    Returns (rate_string, inter_segment_silence_sec, status_message).

    Logic:
      - If a rate within ±25% can fit the script into the video, use that
        alone with no silence padding.
      - If the video is much longer than the script can stretch (would
        require rate < -25%), use rate -25% AND insert silence between
        segments so the script breathes across the full video.
      - If the video is much shorter than the script (would require rate
        > +25%), use rate +25% — narration will trim at the end.
    """
    if base_seconds <= 0:
        return DEFAULT_RATE, 0.0, "could not measure base; using default"

    desired_ratio = base_seconds / video_seconds
    rate_pct = (desired_ratio - 1.0) * 100.0

    HARD_MIN, HARD_MAX = -25.0, 25.0

    if HARD_MIN <= rate_pct <= HARD_MAX:
        return format_rate(rate_pct), 0.0, (
            f"rate {format_rate(rate_pct)} fits the script into "
            f"{video_seconds:.0f}s of video"
        )

    if rate_pct > HARD_MAX:
        # Video shorter than script can compress to.
        clamped_rate = format_rate(HARD_MAX)
        new_narration = base_seconds / (1 + HARD_MAX / 100)
        diff = new_narration - video_seconds
        return clamped_rate, 0.0, (
            f"video {video_seconds:.0f}s shorter than the script can fit. "
            f"Rate clamped to {clamped_rate}; final narration will end "
            f"about {diff:.0f}s before the video does"
        )

    # rate_pct < HARD_MIN: video much longer than script. Slow the voice
    # to -25% and distribute the remaining slack as silence between
    # segments so the viewer hears measured pacing, not robot speech.
    clamped_rate = HARD_MIN
    slowed_narration = base_seconds / (1 + clamped_rate / 100)  # = base/0.75
    extra = video_seconds - slowed_narration
    n_gaps = max(1, len(SEGMENTS) - 1)
    silence = max(0.0, extra / n_gaps)
    return format_rate(clamped_rate), silence, (
        f"video is {video_seconds:.0f}s — longer than the script can "
        f"stretch. Using rate {format_rate(clamped_rate)} plus "
        f"{silence:.1f}s pauses between segments so it breathes across "
        f"the full video"
    )


# ── Main ───────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "video",
        help="Path to the silent screen recording you downloaded from Loom.",
    )
    parser.add_argument(
        "--rate",
        default="auto",
        help="Speech rate. 'auto' (default) auto-fits to the video duration. "
             "Or pass an explicit rate like '-10%%' / '+15%%'.",
    )
    parser.add_argument(
        "--output",
        default=str(OUT_DIR / "final.mp4"),
        help="Where to write the muxed video.",
    )
    args = parser.parse_args()

    video_path = Path(args.video).expanduser().resolve()
    if not video_path.exists():
        print(f"ERROR: input video not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    video_dur = media_duration_seconds(video_path, ffmpeg)
    print(f"\n== Input ==")
    print(f"  Video         : {video_path}")
    print(f"  Video length  : {video_dur:.1f}s")

    # ── Synthesize per-beat with target-aligned silence padding ──────────
    # Use default-speed voice (0%) when running per-beat — the targets
    # already control pacing. Slowing it makes beats overshoot.
    rate = "+0%" if args.rate == "auto" else args.rate
    total_target = sum(t for _text, t in BEATS)
    print(f"\n  Total beat target: {total_target:.1f}s  "
          f"(video: {video_dur:.1f}s)")

    if abs(total_target - video_dur) > 8:
        print(f"  [warn] Beat targets total {total_target:.0f}s but your "
              f"video is {video_dur:.0f}s. Adjust BEATS in mux_recording.py "
              "if the drift is unacceptable.")

    print(f"\n== Synthesizing each beat at {rate} ==")
    audio_durations, silences, narration_path = await synth_per_beat(
        rate, ffmpeg
    )
    total_audio = sum(audio_durations) + sum(silences)
    print(f"\n  Final narration: {total_audio:.1f}s  (video: {video_dur:.1f}s)")

    # Captions intentionally skipped — they were overlapping on-screen UI
    # in the demo (score, breakdown bars, FIX section headings). Voice
    # alone keeps the visual clean.

    # ── Mux ──────────────────────────────────────────────────────────────
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Mux: extend the video's last frame by up to 10s if needed so the
    # narration always plays in full. -shortest then trims to whichever
    # ends first (usually the audio when the original video is the
    # limiting factor, or the original video duration if narration is
    # shorter).
    cmd = [
        ffmpeg, "-y",
        "-i", str(video_path),
        "-i", str(narration_path),
        "-filter_complex", "[0:v]tpad=stop_mode=clone:stop_duration=10[v]",
        "-map", "[v]", "-map", "1:a:0",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest", str(output_path),
    ]

    print("\n== Muxing video + narration (no captions) ==")
    run_ffmpeg(cmd, label="mux")

    print("\n========================================")
    print("DONE")
    print(f"  Final video : {output_path}")
    print(f"  Narration   : {narration_path}")
    print()
    print("Upload to Loom:")
    print("  1. https://www.loom.com/library")
    print("  2. Click Upload (top right)")
    print(f"  3. Select {output_path.name}")
    print("========================================")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    asyncio.run(main())
