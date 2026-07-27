# G4-A evidence — real media, real browser, real export

Date: 2026-07-27. Windows 10, Chrome-based preview pane, local API on 2001.

Passing tests are not proof the product works. On 2026-07-25, 182 tests passed
while every new upload was broken. Everything below was run against real files.

## What was exercised

`test-30s.mp4` — a real 1920×1080, 30 fps, 30.033-second file with audio,
already carrying a **v1** project saved on 2026-07-25.

## 1. Migration of real saved work

Opening the project ran the v1 → v2 migration on the owner's actual data.
Read back from `edit-project.json`:

```
schema        sanverse.project/v2
revision      1
timescale     1440000
asset dur     43248000 ticks = 30.033333 s
residual      -3.3e-07 s          <- the file does not land exactly on a tick,
                                     and exactly how much is now recorded
asset size    1920x1080, 30/1 fps
storageRef    project:project_6f52…/source   <- opaque, no filesystem path
composition   1920x1080, 1 clip
change set    active=true, blocked=null, source=migration
operation     "Santosh" / "Founder"
interval      5000 ms for 5000 ms  <- exact, no rounding
anchor        top-left, composition-normalized
point         x 0.21081081081081082, y 0.7442942942942943
extensions    sanverse.migration/legacy-action-id: cafd730a-…
```

The migrated nameplate kept `top-left`, so it did not move in a video the
owner had already approved. The original action ID survived. No console errors,
no server errors.

## 2. Preview and export placement, measured

A frame was extracted from the exported MP4 and differenced against the same
frame of the source, isolating exactly what FFmpeg drew.

**Legacy top-left nameplate at 6 s:**

```
                       x range          y top
  preview  (browser)   405 .. 567       804
  export   (FFmpeg)    405 .. 567       804
```

Exact match horizontally and on the anchored edge.

**New centre-anchored nameplate at 21 s** — the case the vertical fix exists
for, created through the real UI (point → type → accept → export):

```
                       x range          anchor box top
  preview  (browser)   825 .. 1091      509
  export   (FFmpeg)    824 .. 1091      509
```

Within one pixel horizontally (measurement threshold), identical vertically.

**Known difference:** the drawn background plate is ~10 px shorter vertically
in the export, because FFmpeg's plate hugs the glyphs and the browser's hugs
the em box. Position is unaffected. Recorded in ADR-003.

## 3. Two real defects found by doing this, not by testing

**The preview could silently show nothing.** `requestVideoFrameCallback` fired
**zero times** in this browser while the video played, so the playhead never
moved and no overlay ever appeared — while the page looked perfectly healthy.
The old code used frame callbacks as the *only* clock when they were available.
Media events are now always listened to as well. A test existed that asserted
the old behaviour; it had enshrined the single point of failure.

**Preview and export were offset by the padding.** The first real export landed
13 px up and left of the preview. FFmpeg's `x`/`y` position the text; the
browser positions the box. Measured, then fixed by anchoring the box in both.

## 4. Full loop, clean load

Fresh tab, no hot-reload state:

```
  open v1 project        -> migrated to v2, edit visible in History
  seek to 4 s            -> no overlay        (before the interval)
  seek to 6 s            -> Santosh / Founder (inside)
  seek to 21 s           -> Centre Anchor / Parity check
  seek to 28 s           -> no overlay        (after)
  point -> type -> accept -> revision 2, saved
  undo                   -> History: Santosh
  redo                   -> History: Santosh, Centre Anchor
  export                 -> verified MP4, downloadable
  reopen                 -> revision 4, 2 change sets, 0 redo
```

Console errors: none. Server errors: none.

## 5. What was NOT verified

- **HDR / colour.** No HDR footage was tested. Still no colour handling.
- **Audio after cutting.** Nothing cuts the timeline yet, so `-c:a copy` has
  not been stressed. It will break at the first cut.
- **Export speed.** ~90 s for 30 s of 1080p, unchanged and unmeasured as to
  cause. Deprioritized by the owner.
- **Fonts other than the configured one.** Parity was measured with Arial.
- **Anchors other than `top-left` and `center`.** Covered by the parity test,
  not by a real export.
