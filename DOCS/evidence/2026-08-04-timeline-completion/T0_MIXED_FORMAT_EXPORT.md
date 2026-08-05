# T0.7 — Footage of different shapes and sizes in one video (FAIL-051)

2026-08-05 · Gate T0

## What was broken

A project holding a normal widescreen recording and an upright phone recording
would not export at all. The user got:

```
The local renderer could not produce a verified MP4.
```

That sentence explains nothing, names nothing, and offers nowhere to go.

## The cause, proved rather than guessed

The exporter's own instructions were run through real FFmpeg on real files:

```
Input link in0:v0 parameters (size 714x1280, SAR 1:1) do not match the
corresponding output link in0:v0 parameters (1920x1080, SAR 1:1)
```

FFmpeg joins the pieces of a finished video end to end with a step called
`concat`, and `concat` refuses outright unless every piece is **already** the
same width, the same height and the same pixel shape.

Nothing in the exporter made that true. Footage went in at whatever size it was
recorded at:

```
  [0:v]trim=...,setpts=PTS-STARTPTS,fps=30/1[source_video_0]
  [source_video_0]format=pix_fmts=yuv420p,setsar=1[motion_video_0]   <- no scaling
```

That was invisible while a project could only ever hold ONE recording — "the
size of the footage" and "the size of the finished video" were the same number
by accident. It broke the instant a second recording of a different size
arrived.

**FAIL-051 understated it.** It was recorded as "portrait phone footage cannot be
exported into a landscape project", but the fault was never about portrait: a
1080p clip next to a 720p clip failed identically, and so did a 4K clip, and so
did a square clip from social media.

## The fix

One file owns the rule: `packages/render-contract/src/visual-normalization.ts`.

It is in the shared package, not in the exporter, because the browser preview
reads it too. Two separate calculations of "where does this picture go" would
agree on the easy cases and drift apart on the hard ones, and the user would
only find out after waiting for an export. That is the same class of bug as
FAIL-052.

### The two honest answers

```
  FIT   Show the whole picture. Shrink it until it is fully inside the canvas
        and fill the leftover space with black. Nothing is lost; you get bars.

        upright phone clip 714x1280 into a 1920x1080 canvas
        +-------------------------------------------+
        |         |                       |         |
        |  black  |   the whole picture   |  black  |
        |         |       602 x 1080      |         |
        +-------------------------------------------+

  FILL  Fill the canvas edge to edge. Grow the picture until it covers the
        canvas and cut off whatever hangs over. No bars; you lose the edges.
```

There is deliberately **no third answer**. Stretching a picture to the canvas
shape — making a face wide and flat — is never what anybody wants, so it is not
offered. That is a decision, not an oversight.

**FIT is the default**, and it is the only one of the two that cannot destroy
part of the user's footage without being asked. For every project that already
exists — one recording, canvas the same size as it — FIT changes nothing at all:
a picture already exactly the size of the canvas is scaled by one and padded by
zero. There is a test that holds exactly that line.

### The order of the steps IS the design

```
  1  turn the picture the right way up      (the camera's own rotation note)
  2  make the pixels square                 (some cameras record oblong ones)
  3  work out FIT or FILL against the canvas
  4  scale, keeping the picture's own shape
  5  add black bars (FIT) or cut off the overhang (FILL)
  6  declare the pixels square in the result
  7  make the colour storage the same for every piece
```

Doing 3 before 2 would frame the picture using its stored size rather than the
size it actually looks like, and oblong-pixel footage would be framed wrongly.
Doing 5 before 4 would cut the wrong part off.

Normalization happens **before** the motion filters, not after. Motion moves and
scales the picture relative to the canvas; running it against a picture that is
not yet canvas-shaped would scale an upright phone clip relative to its own
714x1280 instead, so "no motion at all" and "motion that changes nothing" would
frame the same clip differently.

### Where the Fit/Fill choice lives

`project.extensions['sanverse.render/framing']`, not a new field on the
composition.

The composition's field list is closed, so adding to it would mean rewriting
every project already saved on disk. Rewriting a user's stored edits in order to
add a *preference* is a bad trade. The extensions bag exists precisely so a
preference can be added without touching anything already saved. A project that
has never been asked has no key, which reads as `fit`.

## Proof

### Synthetic, controlled

Built with FFmpeg: a 1920x1080 clip and a 714x1280 clip, three seconds each,
run through the graph the exporter actually produces.

| what | fit | fill |
|---|---|---|
| output size | 1920x1080 | 1920x1080 |
| pixel shape | 1:1 | 1:1 |
| frames | 180 | 180 |
| duration | 6.000000 s | 6.000000 s |
| left edge on the portrait clip | **16** (video black — a bar) | **81** (real picture) |
| centre on the portrait clip | 126.8 | 127.8 |
| left edge on the landscape clip | **79.97** (real picture — no bar added) | — |

16 is video black on the limited-range scale. So FIT letterboxes, FILL crops,
and the clip that already matched the canvas is untouched.

Screenshots: `fail051-portrait-in-landscape-FIT.png`,
`fail051-portrait-in-landscape-FILL.png`,
`fail051-landscape-clip-unchanged.png`.

### Real, end to end, through the product

Real project `project_1ad7b832a52d6faf09da2390e97f729a` with real phone footage
(asset `asset_d6358c66df59c03071f3203e9599cef1`, **714 x 1280**) placed on the
main video track of a **1920 x 1080** project, exported by pressing Export in
the browser.

```
Export ready
1920 × 1080 · 27s
```

ffprobe of the downloaded file:

```
width=1920
height=1080
sample_aspect_ratio=1:1
pix_fmt=yuv420p
r_frame_rate=30/1
nb_frames=818
duration=27.278000
codec_name=aac  sample_rate=48000  channels=2
```

Sampled brightness of the real exported file:

| moment | left edge | centre | reading |
|---|---|---|---|
| 10 s (landscape clip) | 139.1 | 92.7 | real picture edge to edge — untouched |
| 24 s (portrait clip)  | **16** | 120.8 | black bar at the side, picture in the middle |

Screenshots: `fail051-REAL-EXPORT-portrait-in-landscape.png` (the whole upright
picture, correct proportions, bars at the sides) and
`fail051-REAL-EXPORT-landscape-unchanged.png`.

## What was NOT proved by hand

The portrait clip was put on the main video track through the same
`place-primary-clip` operation a drag produces, sent to the local API directly,
rather than by dragging it with the mouse. Dragging in this browser harness does
not reach the app's drop handler. Everything after that point — the export
itself, the file, the frames — is the real product doing the real thing.

## Traps that cost time here, recorded so they do not cost it twice

1. **The API loads TypeScript when it starts.** A change to the exporter does
   nothing until the server is stopped and started again. The first real export
   attempt failed for exactly this reason and looked like the fix not working.
2. **A failed export is remembered.** It is cached against the project and its
   revision, so pressing Export again returns the OLD failure instantly. Move
   the revision with any harmless change first.
