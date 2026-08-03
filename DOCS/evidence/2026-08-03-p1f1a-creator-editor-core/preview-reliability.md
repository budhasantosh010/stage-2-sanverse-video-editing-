# Preview reliability (Gate A)

## The root cause

`drawFootageMotionFrame` in
`apps/web/src/features/render-plan/footage-motion-preview.ts` did this:

```
  1. is there a footage motion at this moment?      no  -> hide canvas, done
  2. is videoWidth > 0 ?                            no  -> hide canvas, done
  3. fill the canvas BLACK
  4. drawImage(video, ...)
  5. canvas.hidden = false        <-- unconditional
```

Step 2 is the defect. `videoWidth` is populated at `HAVE_METADATA`
(`readyState` 1) — **before a single frame can be decoded**. `drawImage` from a
video below `HAVE_CURRENT_DATA` (`readyState` 2) contributes nothing, so steps
3–5 painted a black rectangle and revealed it on top of a perfectly healthy
video.

That reproduces the owner's recording exactly:

```
  monitor controls   still React, still rendering   -> visible
  accepted overlay   separate content layer          -> visible
  base footage       covered by a black canvas       -> BLACK
  explanation        none existed                    -> silence
```

## The fix

Three parts, all in the same file:

```ts
type FootageMotionDrawDecision = 'draw' | 'retain' | 'hide'

draw    a real frame can be read right now (readyState >= HAVE_CURRENT_DATA
        AND videoWidth/Height > 0)
retain  no frame is readable, but this canvas already holds a real one —
        keep showing it rather than blanking mid-seek
hide    nothing real was ever drawn, or motion no longer applies — step out
        of the way and let the native video be the base layer
```

- The canvas is revealed **only after** a real frame has landed on it.
- Frames already drawn are tracked per canvas **and per source**, in a
  `WeakMap` keyed by the element, so loading a different project cannot leave
  the previous project's last frame on screen as if it were current.
- `drawImage` is wrapped: a decoder that refuses a frame it claimed to have
  causes the canvas to hide and the native video to take over, rather than
  leaving a half-cleared canvas on screen and calling it the footage.

## Native video policy (A4)

With identity/default motion, `footageMotionAtCompositionTime` returns null, the
decision is `hide`, and the native `<video>` is the visible base layer. Pause
retains the frame, seek reveals the destination frame on `seeked`, and neither
a resize nor an overlay selection touches it — proved below.

## The guards are real, not decorative

Reverting the readiness check in `hasDecodableFrame` to the old
`videoWidth > 0` test makes **4 tests fail**:

```
  × never reveals a canvas it has not drawn a real frame onto
  × retains the last valid frame instead of blanking when readiness dips mid-seek
  × does not retain another source last frame after the video source changes
  × decides draw, retain, or hide from readiness alone
```

Measured on 2026-08-03; the check was restored immediately after.

## Real browser measurement

Scratch project `project_1ff7bc4628bdfe2adaf52a07412ecf29`
(`test-30s.mp4`, 30.033 s, 1920×1080, 30 fps), never the owner's project.
Microsoft Edge via the in-app browser, dev server restarted first so the new
code was actually served.

### Run 1 — base video only, ten full cycles

Sequence per cycle: seek to 0 · play · pause · seek · step forward one frame ·
step backward one frame · resize. **71 samples.**

```
  unexplained black frames            0
  gap layer ever shown                never
  computed video opacity              1 at every sample
  computed display / visibility       block / visible at every sample
  video elements in the document      1
  video DOM node identity             unchanged throughout
```

### Run 2 — with non-default footage motion active (the canvas path)

`set-footage-motion` accepted over the whole 30 s (scale 1.15, translateX 0.05),
so the motion canvas is the base layer. Ten seeks sampled **immediately after
the seek** (60 ms) and again once settled (300 ms), then play, pause, resize.
**25 samples.** Canvas pixels were read back and measured for non-black content.

```
  canvas visible at any point                     yes
  canvas lit (non-black) percentage, range        97% – 100%
  samples where canvas was VISIBLE and BLACK      0
  gap layer ever shown                            never
  base-frame status messages shown                none (all 'ready')
  video elements                                  1
```

The decisive sample, at 4.0 s — the exact condition the owner recorded:

```
  overlays drawn on the content layer   1   (the accepted nameplate)
  motion canvas lit                     99%  (real footage, not black)
  video opacity                         1
  gap layer                             absent
  status message                        none
```

Overlay present **and** base footage present, at the same instant.

## What this does NOT prove

- **The owner's original recording was not reproduced against the old code.**
  The defect was found by reading the code, and the fix is proved by the
  revert-the-guard test above plus healthy measurements after. A before/after
  capture of the identical failing moment was not made.
- One recording, one frame rate (30/1), one resolution (1920×1080), one
  browser surface.
- Panel resizing was exercised as a `resize` event, not by dragging every
  splitter by hand.
- The four base-frame states are proved by tests; `gap` and `error` were not
  triggered on real media in the browser during this run.
