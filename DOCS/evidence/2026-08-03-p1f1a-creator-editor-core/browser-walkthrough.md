# Real-browser walkthrough — Gate A

Date: 2026-08-03
Surface: in-app browser (Chromium) at `http://localhost:2000`
Dev server **stopped and restarted** before measuring, because Node does not
hot-reload and `preview_start` reuses a running server.

Scratch project `project_1ff7bc4628bdfe2adaf52a07412ecf29`, created for this run
from `test-30s.mp4` (30.033 s, 1920×1080, 30 fps, with audio). The owner's own
projects were not touched — accepting any edit clears the redo stack.

Project state built through the real API:

```
  revision 0  ->  1   add-nameplate  "Gate A / preview proof"
                      source 2.0 s – 7.0 s, blockedReason null
  revision 1  ->  2   set-footage-motion  scale 1.15, translateX 0.05,
                      whole 30 s, blockedReason null
```

## 1. Open

```
  video elements in the document      1
  currentSrc                          .../projects/project_1ff7…/media
  readyState                          4  (HAVE_ENOUGH_DATA)
  base-frame status message           none (state is 'ready')
  gap layer present                   no
```

## 2. Ten full cycles, base video only — 71 samples

Per cycle: seek to 0 · play · pause · seek · step +1 frame · step −1 frame ·
resize.

```
  unexplained black frames        0
  gap layer ever shown            never
  computed opacity                1 at every sample
  computed display / visibility   block / visible at every sample
  video elements                  1
  video DOM node identity         unchanged throughout
```

## 3. Ten cycles with the motion canvas active — 25 samples

Canvas pixels were read back and measured for non-black content, sampled both
**60 ms after each seek** (the moment the old code revealed an empty canvas) and
once settled.

```
  canvas lit (non-black), range                97% – 100%
  samples where canvas was VISIBLE and BLACK   0
  gap layer ever shown                         never
  status messages shown                        none
  video elements                               1
```

The decisive sample at 4.0 s — the exact condition the owner recorded:

```
  overlays on the content layer   1   (the accepted nameplate)
  motion canvas lit               99% (real footage, not black)
  video opacity                   1
  gap layer                       absent
```

Overlay **and** base footage present at the same instant.

## 4. Export

```
  POST /exports                     202 Accepted
  duplicate click immediately after returned the SAME jobId
                                    job_3d99cdeb4c5f8573b2d4b9143e04e207
  server phase                      rendering (progress 0.20)
  final status                      succeeded
  observed encode                   ~51 s in the sampled window, on top of
                                    ~30 s already elapsed on the same job
```

Probed with ffprobe from disk:

```
  video      h264   1920x1080   30/1
  audio      aac    48000 Hz    2 channels
  duration   30.033008 s
  size       18,044,871 bytes
  sha256     fc54e6bc73c128a7aac633fd49ae51991c0d3c7a422b4bcebcabe7c0fc4fef16
```

Frames pulled out of the exported MP4 and looked at:

| Moment | What the frame contains |
|---|---|
| 1.0 s | Real footage, footage motion applied, no nameplate (before its window) |
| 4.0 s | Real footage **plus** "Gate A / preview proof" burned in at lower left |
| 9.0 s | Real footage, nameplate gone (after its 2–7 s window) |
| 20.0 s | Real footage, motion still applied, nothing drawn |

Saved in `screenshots/`.

## 5. Console and network

```
  console errors           0
  failed local responses   none observed
```

## What this walkthrough does NOT prove

- **The original failure was not reproduced against the old code.** The defect
  was found by reading, and the fix is proved by the revert-the-guard test plus
  healthy measurements after. No before/after capture of the same failing moment
  exists.
- Panels were resized by dispatching `resize`, not by dragging every splitter by
  hand. Splitter-by-hand resizing at 1440×900 / 1280×800 / 1024×768 / 390×844
  is **not** done in this gate.
- The `gap` and `error` base-frame states were not triggered on real media; they
  are proved by test only.
- The `verifying` phase was never sampled: polling at 500 ms saw `rendering`
  then `succeeded`, so verification of this file finished inside one interval.
- The 10-minute client timeout was never reached on real media.
- One machine, one recording, one frame rate, one resolution, one browser.
- Owner visual acceptance remains open.
