# Evidence — captions, built and burned into a real export (G5-A)

Date: 2026-07-28
Evidence level: **E4** — real media, real transcript, real cut, real export,
exported frames inspected. Not E5: one recording, one language, one frame rate,
a synthetic transcript, no owner run.

Decisions: `DOCS/adr/ADR-006-captions.md`.

## What was verified by running it

Project `project_c6121ed23762e2fc188c0d18e706b11d`, the owner's own
14.605-second 1920x1080 30 fps recording, opened at `localhost:2000`.

The transcript was a hand-written Whisper-shaped file with 28 words across three
segments. It is synthetic — no real Stage 1 file exists yet — and that is the
main limit on this evidence.

### 1. The file became captions, with nothing to repair

```
POST /api/projects/.../captions          HTTP 201
report  { cueCount: 3, adjustments: [], skipped: [], language: "en" }

0.10s +3.10s  | Hello and welcome to        // Sanverse video editing.
3.60s +4.80s  | We make editing effortless for // people who are not editors.
9.00s +5.40s  | Upload your video, say what you // want, and approve the result.
```

- Every break is at a sentence end or a balanced two-line split.
- No cue exceeded 6 s, no line exceeded 42 characters.
- `adjustments: []` — the repair pass had nothing to fix, which is the expected
  result for a clean transcript and proves it is not adjusting blindly.
- History shows one entry: **"Added captions — 3 lines"**. One Undo.

### 2. The preview draws them, and leaves the gap

| Playhead | What the preview showed |
|---|---|
| 1.5 s | Two stacked lines, `rgba(0,0,0,0.75)` plate, font 18.4 px at that display scale |
| 3.4 s | **No caption** — the real gap between cue 1 and cue 2 |

The gap is deliberate: `minGapTicks` (0.08 s) stops one caption flickering
straight into the next.

### 3. Captions moved with the footage when it was cut

Cut at 5.0 s, then removed the opening section.

```
  sections after the cut     34.2348% / 65.7652%     (5 / 14.605 exactly)
  history                    "Cut at 5.0s"
                             "Removed a section and closed the gap"

  cue 1  source 0.1→3.2   footage deleted   → drew nothing, set NOT blocked
  cue 2  source 3.6→8.4   survived 5.0→8.4  → moved to screen 0→3.4
  cue 3  source 9.0→14.4  survived whole    → moved to screen 4.0→9.4
```

Checked in the browser: with the video element at **source 6.0 s**, the playhead
sat at **10.4112%** of a 9.605-second finished video — that is exactly **1.000
seconds** of screen time — and the caption showing was cue 2.

Nothing recomputed a caption's timing. The stored timings never changed; the
footage moved and the captions went with it (ADR-005).

**Losing one cue did not block the other two.** This is the caption-specific
rule and it held.

### 4. The exported MP4 has them burned in

```
duration     9.605000 s     (14.605 - the 5 s removed, exactly)
video        h264 1920x1080 30/1
audio        aac 48000 Hz 2 channels
```

Frames pulled straight out of the exported file:

- **1.0 s** — "We make editing effortless for / people who are not editors."
  Two lines, centred, dark plate, in the bottom strip.
- **3.7 s** — no caption. The gap is real in the file, not only in the preview.
- **5.0 s** — "Upload your video, say what you / want, and approve the result."

The preview and the export agree on all three.

### 5. The command-line ceiling, closed before it could bite

The filter graph now goes to a file (`-filter_complex_script`). Covered by test:
400 two-line cues produce a graph **over 32,767 characters** while the command
line stays **under 1,000**. Inline, that export would have failed on Windows
with an operating-system error that said nothing about captions.

## Test and build state

```
  edit-domain      198   (was 134)
  render-contract   35   (was  28)
  intent-domain     27
  api              198   (was 162)
  web              200   (was 191)
  ------------------------
  total            658 passing; all five workspace builds clean
```

## A real defect the tests found before the browser did

The first balanced two-line wrapper split "hello there" into two lines of five
characters, because two even lines score better than one long line. Correct
arithmetic, wrong product: one line beats two whenever the words fit, since two
lines cover twice as much of the picture for the same words. Fixed, with the
rule stated in `wrapIntoLines`.

## Limitations — what this does NOT prove

- **The transcript was synthetic.** No real Stage 1 file has been read. The
  import format is implemented from the published Whisper shape and is recorded
  in ADR-006 as an assumption, not a verified fact.
- **One language, one recording, one frame rate.** English, 30/1 constant.
  Right-to-left scripts, CJK line breaking, and variable frame rate are untested.
- **Automatic transcription does not exist.** The boundary and its rules are
  built; the only adapter that ships refuses and says so. A user must already
  have a transcript file.
- **No control for editing one caption from the screen.** `set-caption-cue`,
  `remove-caption-cue`, and `set-caption-style` are built, tested, and reach the
  export, but nothing on screen offers them.
- **The owner has not run this.** G5A-01, G5A-12, and G5A-13 are owner gates and
  remain open.
- **Caption text is not spell-checked or reviewed.** Whatever the transcript
  says is what appears on screen.

## Side effect on the owner's project, stated

Verification ran on the owner's real project. It was found with **zero accepted
edits**, and was returned to zero accepted edits by three undos.

However: accepting the caption change set **cleared the redo branch**, exactly as
accepting any new edit does in any editor. If that branch still held the three
nameplates from the 2026-07-28 cutting evidence, they can no longer be redone.
No visible edit was lost — the project was already showing none — but the
redo history was.
