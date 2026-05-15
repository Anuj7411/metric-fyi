"""Mux an existing silent screen recording with the AI narration + captions.

Workflow:
  1. You record the screen in Loom (silent — no mic, no system audio).
  2. Download the raw MP4 from Loom.
  3. Run:  python mux_recording.py path/to/screen.mp4
  4. Upload the produced final.mp4 to Loom as a fresh upload.

The script:
  - Reuses (or regenerates) narration.mp3 + captions.srt via edge-tts.
  - Burns captions into the video as a styled subtitle overlay.
  - Mixes the AI narration as the audio track.
  - If the recording is shorter than the narration: trims narration to fit.
  - If the recording is longer than the narration: lets the narration end
    naturally; the rest of the video plays silent.

Run examples:
  python mux_recording.py screen.mp4
  python mux_recording.py "C:/Users/me/Downloads/loom-export.mp4" --no-burn
  python mux_recording.py screen.mp4 --regenerate
"""
from __future__ import annotations

import argparse
import asyncio
import re
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).parent
OUT_DIR = HERE / "output"
NARRATION = OUT_DIR / "narration.mp3"
CAPTIONS = OUT_DIR / "captions.srt"


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


async def regenerate_narration():
    """Force-regenerate narration.mp3 + captions.srt by invoking make_demo
    in audio-only mode."""
    print("== Regenerating narration via make_demo --audio-only ==")
    from make_demo import main as make_main
    await make_main(audio_only=True)


def escape_for_subtitles_filter(path: Path) -> str:
    """ffmpeg's subtitles= filter on Windows wants forward slashes and the
    colon after the drive letter escaped."""
    p = str(path.resolve()).replace("\\", "/")
    # Escape the drive-letter colon: C: -> C\:
    p = re.sub(r"^([A-Za-z]):", r"\1\\:", p)
    return p


def run_ffmpeg(args: list[str]):
    print("  $", " ".join(str(a) for a in args[:6]), "...")
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print("ffmpeg failed:", file=sys.stderr)
        print(result.stderr[-2000:], file=sys.stderr)
        sys.exit(result.returncode)


async def main():
    parser = argparse.ArgumentParser(
        description="Mux narration + captions onto a silent screen recording."
    )
    parser.add_argument(
        "video",
        help="Path to the silent screen recording you downloaded from Loom.",
    )
    parser.add_argument(
        "--no-burn",
        action="store_true",
        help="Don't burn captions into the video. Embed them as a soft "
             "subtitle track instead (Loom can still display them).",
    )
    parser.add_argument(
        "--regenerate",
        action="store_true",
        help="Force-regenerate narration.mp3 + captions.srt before muxing.",
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

    if args.regenerate or not NARRATION.exists() or not CAPTIONS.exists():
        await regenerate_narration()

    if not NARRATION.exists() or not CAPTIONS.exists():
        print("ERROR: narration/captions missing. Run "
              "`python make_demo.py --audio-only` first.", file=sys.stderr)
        sys.exit(1)

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    video_dur = media_duration_seconds(video_path, ffmpeg)
    audio_dur = media_duration_seconds(NARRATION, ffmpeg)
    print(f"\nInput video    : {video_path}  ({video_dur:.1f}s)")
    print(f"Narration      : {NARRATION}  ({audio_dur:.1f}s)")
    print(f"Captions       : {CAPTIONS}")

    if abs(video_dur - audio_dur) > 5:
        print(
            f"\n[warn] Duration mismatch is {abs(video_dur - audio_dur):.1f}s. "
            "Recording shorter than narration -> narration will be trimmed.\n"
            "Recording longer than narration -> trailing silence at the end."
        )

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Build the ffmpeg command.
    # -map 0:v drops the original (silent) video's audio if any.
    # -map 1:a uses the narration as the only audio track.
    # -shortest stops at whichever input ends first → trims trailing
    # narration if recording is shorter, or trims trailing silence if longer.

    cmd = [
        ffmpeg, "-y",
        "-i", str(video_path),
        "-i", str(NARRATION),
    ]

    if not args.no_burn:
        sub_path = escape_for_subtitles_filter(CAPTIONS)
        # Style: white text, semi-transparent black box, bottom-centred,
        # readable on the report's warm-dark background.
        style = (
            "FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,"
            "OutlineColour=&H80000000,BorderStyle=3,Outline=1,"
            "Shadow=0,Alignment=2,MarginV=40"
        )
        cmd += ["-vf", f"subtitles='{sub_path}':force_style='{style}'"]
    else:
        # Soft subs — keep the video stream untouched.
        cmd += ["-c:v", "copy"]

    cmd += [
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(output_path),
    ]

    print("\n== Muxing ==")
    run_ffmpeg(cmd)

    print("\n========================================")
    print("DONE")
    print(f"  Final video : {output_path}")
    if args.no_burn:
        print(f"  Soft subs   : {CAPTIONS} (upload to Loom separately)")
    else:
        print("  Captions are burned into the video.")
    print()
    print("Upload steps:")
    print("  1. https://www.loom.com/library")
    print("  2. Click Upload (top right)")
    print(f"  3. Select {output_path.name}")
    if args.no_burn:
        print(f"  4. After upload, Captions tab -> Upload captions.srt")
    print("========================================")


if __name__ == "__main__":
    # Force stdout to UTF-8 on Windows so non-ASCII chars in segment text
    # don't crash the print pipeline.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    asyncio.run(main())
