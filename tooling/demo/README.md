# Auto-demo recorder

One-command pipeline that produces a finished narrated demo video for the 8x
Engineer contest submission. No microphone, camera, or manual clicking
required — Microsoft Edge's free neural voices handle the narration, and
Playwright drives the browser through the demo flow.

## What you get

```
tooling/demo/output/
├── final.mp4       ← upload this to Loom
├── captions.srt    ← paste into Loom's caption editor
└── narration.mp3   ← standalone audio if you ever need it
```

## One-time setup (≈3 minutes)

You need **Python 3.10+** on your PATH (`python --version`). Everything else
the script bundles itself — no system ffmpeg install required.

```powershell
# From the repo root
cd tooling/demo

# Install Python deps into your global env (or a venv if you prefer)
pip install -r requirements.txt

# Download Chromium for Playwright (~150 MB, one-time)
python -m playwright install chromium
```

## Run

```powershell
python make_demo.py
```

A Chromium window will open and drive itself through the demo. **Don't
touch it** — clicks and scrolls are scripted and need to land on a
predictable page state. The whole run takes ~90 seconds.

When it finishes, look in `tooling/demo/output/`. Upload `final.mp4` to
Loom via [loom.com/library](https://www.loom.com/library) → Upload (top
right). After upload completes, paste `captions.srt` into Loom's caption
editor under the video.

## Customising the demo

Open `make_demo.py` and edit the `SEGMENTS` list near the top. Each entry
is `(narration_text, action_function, padding_seconds)`. The action runs,
then the script waits for the narration audio (auto-measured) plus the
padding before moving to the next segment. Re-run `python make_demo.py`
to regenerate.

To change the voice: swap `VOICE = "en-US-AriaNeural"` for any of these:

| Voice | Sounds like |
|---|---|
| `en-US-AriaNeural` | Female, warm, professional (default) |
| `en-US-GuyNeural` | Male, clear, news-anchor |
| `en-GB-RyanNeural` | British male |
| `en-IN-PrabhatNeural` | Indian English male |
| `en-IN-NeerjaNeural` | Indian English female |

`RATE = "-5%"` slows the voice slightly. Use `"+10%"` for faster delivery
or `"+0%"` for default pace.

## If something fails

The script is resilient — any one browser action that can't find its
selector will print a warning and continue. The recording still completes.

If the whole script can't run (network issue, Playwright missing), you
still get `narration.mp3` and `captions.srt` as soon as the synthesis
stage finishes. You can then record manually:

1. Open Loom desktop app, start a Screen-only recording **with system
   audio enabled**.
2. Open the live site in a separate window.
3. Play `narration.mp3` from any media player.
4. Click through the demo following the audio cues.
5. Stop recording; Loom auto-captions on its own, or paste `captions.srt`.

## How it works under the hood

| Tool | Role |
|---|---|
| `edge-tts` | Free Microsoft Edge neural TTS, no API key |
| `playwright` | Chromium automation + viewport recording (.webm) |
| `imageio-ffmpeg` | Bundles a working ffmpeg binary so no system install is needed |

Pipeline:
1. Each script segment is synthesized separately so we can read the
   audio duration and use it as the timing target for browser actions.
2. Browser runs in headed mode at 1440 × 900, recording the viewport to
   WebM via Playwright's built-in recorder.
3. All segment MP3s are concatenated into `narration.mp3` (lossless).
4. ffmpeg muxes audio onto video, transcoding video to H.264 and audio
   to AAC for Loom compatibility.
5. SRT captions are generated from the per-segment durations.
