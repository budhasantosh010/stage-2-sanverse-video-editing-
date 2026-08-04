# Gate D — the real browser run, on real media

2026-08-04 · web `localhost:2000`, API `127.0.0.1:2001` · window 1280×720 and
1440×900 · project `project_1ad7b832a52d6faf09da2390e97f729a`

Passing tests are not proof the product works. On 2026-07-25, 182 tests passed
while every new upload was broken. So this is what actually happened in a real
browser, on the owner's own files.

## The media used — all real, all the owner's own

| role | file | what it is |
|---|---|---|
| main footage | `test-30s.mp4` | 30.03 s, 1920×1080, with speech |
| second recording | `Leader mistakes that destroy morale.mp4` | 44.5 s, **714×1280 portrait** |
| third recording | `T2V_E21_O13_HollywoodPlus_NoLUT.mp4` | 14.6 s, 1920×1080 |
| picture | a real 1440×900 PNG | |
| music | a real 20 s MP3 | mono, 44.1 kHz |

Uploaded through the ordinary routes. Placed through the ordinary change-set
route — nothing bypassed validation, revision fencing or history.

## What was seen

**1. Real filmstrips on the main video.** 41 pictures across a 3,003-pixel clip.
Of the drawing surface's 117,117 pixels, **107,643 were painted**. Sampling
across it gave different colours at every point — `217,144,140`, `146,150,153`,
`179,125,117`, `198,198,198`, `138,135,130` — which is real footage, not one
frame repeated and not a flat colour.

**2. The second recording shows its OWN frames.** Scrolled past 30 s: 48
pictures, a different average colour (124 against 114), and correctly letterboxed
because it is portrait. See `screenshots/gate-d/timeline-v2-second-recording.png`.

**3. A real picture on the overlay row.** One thumbnail, 1,550 pixels painted of
15,500 — which is exactly a 1.6∶1 picture contained inside a wide, short strip
rather than stretched to fill it.

**4. Real dialogue waveform on A1.** 31 blocks; 30,729 pixels painted of 87,087
(35%) — a shape, not a solid block. See `screenshots/gate-d/timeline-a1-waveform.png`.

**5. Real music waveform on A2.** 14 blocks; 6,884 painted of 40,600 (17%) —
visibly quieter than the speech above it, which is the truth about those two
files.

**6. Trimming changes the first frame.** Three seconds trimmed off the head
through the real change-set route (revision 8 → 9). The timeline's first
requested moment moved from **0.00 s to 3.50 s**. The pictures it already had
were kept; only 36 requests were made, all for moments not already held.

**7. Splitting costs almost nothing.** The 30 s clip split at 12 s (revision
7 → 8) became two clips of 12 s and 18 s. Their filmstrips came to 12 and 25
pictures — the second half reusing the ladder the whole clip already had.

**8. Scrolling stays bounded.** End to end and back, 32 stops:

```
  clips mounted at once, worst case      2
  drawing surfaces at once, worst case   3
  DOM nodes inside the timeline, worst  199
  <video> elements                        1   at every single stop
  object URLs created                     0
```

**9. Nothing failed.** Every one of the ~230 preview requests returned 200. No
console errors. No repeated requests for the same name.

**10. Refusals are truthful.** Asked directly:

```
  a moment past the end   → "That moment is past the end of the file."
  the wrong bytes         → "That file has changed since this preview was asked for."
  a moment of a picture   → "That kind of preview does not apply to this file."
```

**11. Nothing was left running.** After every request, `/api/diagnostics`
reported `activeFrames: 0, activeWaveforms: 0, queued: 0, sharedJobs: 0`, and the
`work/` folder — where FFmpeg writes before a file is renamed into place — was
empty.

## Two real bugs found here that no test had caught

**The original recording reported itself missing.** The one file that is
certainly there — the footage the project was made from — returned
`ASSET_MISSING`. It lives beside the project as `source.mp4`, not in the added
files folder, and the check that told them apart compared against
`project/<id>/source` with a slash while every project on disk says
`project:<id>/source` with a colon. Both spellings are now accepted. The same
mistaken comparison existed in the export path, where it happened to be harmless;
it is fixed there too.

**Every row shrank on a large monitor.** Row heights were decided from the width
of the timeline, and on a 1440-pixel desktop the timeline gets about 700 pixels
because it shares the screen. The editor concluded the user was on a phone. It
now reads the width of the window.

## What was NOT done here, stated plainly

- **No screenshots of the whole application window.** The browser pane in this
  environment does not composite frames, so `screenshot` times out. The pictures
  in `screenshots/gate-d/` are instead built from the *same API answers the
  timeline drew* — real decoded frames tiled in the same order, and real loudness
  numbers drawn as bars. They show exactly what is on the timeline; they do not
  show the surrounding chrome.
- **No 60-minute real-media project.** The bounds for an hour-long project are
  held by the deterministic fixture (250 clips, 12 recordings, 100 overlays, 500
  captions, music with gaps, images, splits and overwrite fragments) and by the
  scroll measurements above on a 75-second real project. A real hour of footage
  was not recorded for this gate.
- **Screen sizes.** Checked at 1280 and 1440 wide, and the small-screen row table
  is held by test at 390. Not driven by hand at 1024×768 and 390×844.
