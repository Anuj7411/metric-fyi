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

# Re-use the script + helpers from make_demo.
from make_demo import (
    AUDIO_DIR,
    OUT_DIR,
    SEGMENTS,
    VOICE,
    DEFAULT_RATE,
)


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

async def synth_all(rate: str, ffmpeg: str) -> tuple[list[float], Path]:
    """Synth every segment at the given rate. Concat into narration.mp3.
    Returns (segment_durations, narration_path)."""
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    durations: list[float] = []
    paths: list[Path] = []
    for i, (text, _action, _pad) in enumerate(SEGMENTS):
        p = AUDIO_DIR / f"seg_{i:02d}.mp3"
        await synth(text, p, rate)
        d = media_duration_seconds(p, ffmpeg)
        durations.append(d)
        paths.append(p)
        preview = text[:60].replace("\n", " ")
        print(f"  [{i:02d}] {d:5.2f}s  {preview}...")

    concat_list = OUT_DIR / "concat.txt"
    concat_list.write_text(
        "\n".join(f"file '{p.resolve().as_posix()}'" for p in paths),
        encoding="utf-8",
    )
    narration = OUT_DIR / "narration.mp3"
    run_ffmpeg(
        [ffmpeg, "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat_list), "-c", "copy", str(narration)],
        label="concat narration",
    )
    return durations, narration


def write_captions(durations: list[float], pads: list[float], path: Path) -> None:
    chunks: list[str] = []
    t = 0.0
    for i, ((text, _action, _pad), dur, pad) in enumerate(
        zip(SEGMENTS, durations, pads)
    ):
        start = t
        end = t + dur
        chunks.append(
            f"{i+1}\n{srt_timestamp(start)} --> {srt_timestamp(end)}\n{text}\n"
        )
        t = end + pad
    path.write_text("\n".join(chunks) + "\n", encoding="utf-8")


def pick_fit_rate(video_seconds: float, base_seconds: float) -> tuple[str, str]:
    """Given the user's video length and a base-rate narration length,
    pick a speech rate that fits. Returns (rate_string, status_message).

    Edge TTS's rate parameter is roughly: ratio = 1 + rate%/100
    If base narration takes 100s and video is 120s, we want narration to
    take 120s -> ratio = 100/120 = 0.83 -> rate = -17%.
    """
    if base_seconds <= 0:
        return DEFAULT_RATE, "could not measure base narration; using default"

    desired_ratio = base_seconds / video_seconds
    # Convert to a percentage adjustment relative to "no change".
    rate_pct = (desired_ratio - 1.0) * 100.0

    # Clamp to a range where the voice still sounds human.
    HARD_MIN, HARD_MAX = -25.0, 25.0
    clamped = max(HARD_MIN, min(HARD_MAX, rate_pct))

    if clamped == rate_pct:
        msg = f"perfect fit (rate {format_rate(clamped)})"
    elif rate_pct < HARD_MIN:
        diff = base_seconds / (1 + clamped / 100) - video_seconds
        msg = (f"video {video_seconds:.0f}s is much longer than the "
               f"narration script. Rate clamped to {format_rate(clamped)}; "
               f"final video will have ~{diff:.0f}s of silence at the end")
    else:
        diff = base_seconds / (1 + clamped / 100) - video_seconds
        msg = (f"video {video_seconds:.0f}s is much shorter than the "
               f"narration script. Rate clamped to {format_rate(clamped)}; "
               f"narration will be cut off ~{abs(diff):.0f}s early")
    return format_rate(clamped), msg


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
        "--no-burn",
        action="store_true",
        help="Don't burn captions into the video. Embed soft subtitles "
             "instead and write captions.srt separately.",
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

    # ── Decide on rate ───────────────────────────────────────────────────
    if args.rate == "auto":
        # Synth once at the default rate to measure base length.
        print(f"\n== Probing base narration length at {DEFAULT_RATE} ==")
        base_durations, _ = await synth_all(DEFAULT_RATE, ffmpeg)
        base_total = sum(base_durations)
        print(f"  Base narration: {base_total:.1f}s")

        rate, msg = pick_fit_rate(video_dur, base_total)
        print(f"\n== Fitting narration to video ==")
        print(f"  {msg}")
        print(f"\n== Re-synthesizing at {rate} ==")
        durations, narration_path = await synth_all(rate, ffmpeg)
    else:
        rate = args.rate
        print(f"\n== Synthesizing at {rate} ==")
        durations, narration_path = await synth_all(rate, ffmpeg)

    total_audio = sum(durations)
    print(f"\n  Final narration: {total_audio:.1f}s  (video: {video_dur:.1f}s)")

    # ── Build SRT with pads to spread captions across the video ──────────
    # If audio is shorter than video, distribute extra time as pads between
    # segments so captions stay paced rather than crammed at the start.
    extra = max(0.0, video_dur - total_audio)
    pads = [extra / len(durations)] * len(durations) if extra > 0.5 else [0.0] * len(durations)
    captions_path = OUT_DIR / "captions.srt"
    write_captions(durations, pads, captions_path)
    print(f"  Captions       : {captions_path}")

    # ── Mux ──────────────────────────────────────────────────────────────
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [ffmpeg, "-y", "-i", str(video_path), "-i", str(narration_path)]

    if not args.no_burn:
        sub_path = escape_for_subtitles_filter(captions_path)
        style = (
            "FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,"
            "OutlineColour=&H80000000,BorderStyle=3,Outline=1,"
            "Shadow=0,Alignment=2,MarginV=40"
        )
        cmd += ["-vf", f"subtitles='{sub_path}':force_style='{style}'"]
    else:
        cmd += ["-c:v", "copy"]

    cmd += [
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest", str(output_path),
    ]

    print(f"\n== Muxing video + narration{' + burned captions' if not args.no_burn else ''} ==")
    run_ffmpeg(cmd, label="mux")

    print("\n========================================")
    print("DONE")
    print(f"  Final video : {output_path}")
    print(f"  Captions    : {captions_path}")
    print(f"  Narration   : {narration_path}")
    print()
    print("Upload to Loom:")
    print("  1. https://www.loom.com/library")
    print("  2. Click Upload (top right)")
    print(f"  3. Select {output_path.name}")
    if args.no_burn:
        print(f"  4. Captions tab -> Upload captions.srt")
    print("========================================")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    asyncio.run(main())
