# Gate B1 — why the preview went black, and what fixed it

The owner recorded a preview that showed real footage while the mouse was over
it and went black the instant the mouse moved away. This is the whole story,
with the measurements that prove each step.

---

## The two picture layers

The preview stacks two things that can both show the picture:

```
  ┌──────────────────────────────────────────────┐
  │  z-index 1   motion canvas                   │  ← used when the shot is
  │              (opaque black behind it)        │    zoomed, panned, cropped
  ├──────────────────────────────────────────────┤
  │  z-index 0   <video>                         │  ← the real decoded video
  └──────────────────────────────────────────────┘
```

The canvas is needed because a zoom or a pan has to be *drawn*; the video
element alone cannot show a 120% punch-in. When there is no such motion, the
canvas has nothing to do and must get out of the way.

## Step 1 — the canvas could not be switched off

The code switched it off with the standard HTML `hidden` attribute:

```js
  canvas.hidden = true      // "go away"
```

The stylesheet said:

```css
  .studio-screen__footage-motion-canvas { display: block; background: #000; }
```

Those two lines fight, and **the stylesheet wins**. `hidden` works because the
browser has a built-in rule `[hidden] { display: none }`, and any rule written
by the app beats the browser's own. So `hidden` did nothing whatsoever.

Measured live in the running product on 2026-08-03:

```
  canvas.hidden = true   ->  computed display: "block"     ← the attribute did nothing
                             background-color: rgb(0,0,0)
                             z-index: 1                    ← above the video
```

An opaque black rectangle, permanently covering healthy video.

## Step 2 — a hover rule was added to cover it up

```css
  .studio-screen__video:hover + .studio-screen__footage-motion-canvas,
  .studio-screen__video:focus + .studio-screen__footage-motion-canvas {
    opacity: 0 !important;
  }
```

Read it plainly: *while the pointer is on the video, make the black rectangle
transparent.* Which means: **the moment the pointer leaves, put the black
rectangle back.**

```
  pointer ON the video     canvas transparent   -> you see your footage
  pointer OFF the video    canvas opaque black  -> you see black
```

That is exactly what the owner recorded. The recording was not a rendering
glitch, a codec problem, or a slow machine. It was two lines of CSS doing
precisely what they said.

---

## The fix

**One value decides what the picture is, and the pointer is not one of its
inputs.**

`apps/web/src/editor/monitor/monitor-base-layer.ts`:

```
  resolveMonitorBaseLayer(...)  ->  'native-video'    the real video element
                                    'motion-canvas'   the drawn canvas
                                    'gap'             deliberate black
                                    'loading'         no picture yet
                                    'error'           a real failure
```

The input type has no `hover`, no `focus`, no pointer field of any kind, and a
test walks its keys and fails if one ever appears. The canvas is shown by one
attribute, `data-visible`, which only this resolver writes:

```css
  .studio-screen__footage-motion-canvas[data-visible="false"] { display: none; }
```

Measured live, same session, same element:

```
  data-visible="false"   ->  computed display: "none"      ← it actually goes away
```

### The rule that stops black frames

**When in doubt, show the native video.** Untransformed real footage is real
footage in slightly the wrong framing for a fraction of a second. Black is not
footage at all. The base picture is now black in exactly one case: a stretch of
timeline the user deliberately emptied, which is black in the exported file too.

### Frame identity — knowing *what* the canvas is holding

A canvas is only pixels; it cannot say which moment of which file it holds.
Without an identity, five different wrong pictures all look like a working
preview:

```
  1. a canvas that was cleared and never drawn on
  2. the frame from a seek the user has already moved past
  3. a frame of the PREVIOUS video, after switching source
  4. a frame drawn at the old panel size, after a resize
  5. a frame left over from a previously opened project
```

So every draw records a token — asset, source time, composition time, motion,
geometry version — and every render states which token it wants. The canvas is
shown only when those two strings are equal:

```
  drawn:      asset_aaaaaaaa|10080000|10080000|motion_web00001|0
  requested:  asset_aaaaaaaa|10080000|10080000|motion_web00001|0   ->  show it
  requested:  asset_aaaaaaaa|10080000|10080000|motion_web00001|1   ->  stale, redraw
                                                              ↑
                                                    the panel was resized
```

Two exceptions, both deliberate:

- **during a seek** — a real frame one moment behind is kept, because dropping a
  120% punch-in out to untransformed video for the length of every seek would
  visibly jump out and back;
- **during playback** — the decoder redraws the canvas dozens of times a second;
  demanding an exact match would demand that React keep pace with the decoder,
  and every frame it fell behind would flicker.

---

## What was measured in the real browser

Project `project_a5c6b54b60f236e1b6e789e1cc773826`, the real 30-second 1080p
`interview.mp4`, real local server.

The measurement is **mean brightness of the actual pixels**, read back out of
the live element. A black rectangle averages ~0. Real footage does not.

### Paused, pointer outside the preview

```
  mean brightness 110.6   range 0–252   canvas display: none
  elements in :hover      0
```

### Playing 20.5 seconds, pointer outside, sampled every second

```
  22 samples   brightness 105.8 … 118.1   black frames: 0
  canvas ever shown: no      elements in :hover, ever: 0
```

Repeated after a full page reload: 13 samples over 10.3 s, brightness
108.8 … 112.5, **0 black frames**, `:hover` count 0 throughout.

**This is the owner's exact recorded failure, reproduced as a test condition —
pointer nowhere near the video — and it did not happen.**

### Five seeks, pointer outside, sampled during and after each

```
  3s  17s  8s  25s  1s      10 samples      black frames: 0
  lowest brightness 110.2    canvas display: none throughout
```

Mid-seek samples carry the previous frame's brightness, which is the retain
behaviour working.

### With a real 120% punch-in applied

```
  canvas data-visible: true   display: block   opacity: 1   size 1920×1080
  canvas pixel brightness: mean 108.7, max 251      ← real footage, not black
```

The project was **not** modified by this: revision 4, changeSets 0, assets 5
before and after — the motion draft never became an edit.

### The live cascade, not the source file

873 style rules were read out of the running document and searched for any rule
combining a pointer state (`:hover`, `:focus`, `:active`) with a base picture
layer:

```
  rules inspected                              873
  pointer rules touching the base picture         0
```

The only rules on the canvas are:

```css
  .studio-screen__footage-motion-canvas, .studio-screen__video-content-layer
      { position: absolute; overflow: hidden; pointer-events: none; }
  .studio-screen__footage-motion-canvas
      { z-index: 1; display: block; background: #000; }
  .studio-screen__footage-motion-canvas[data-visible="false"]
      { display: none; }
```

---

## What this did NOT prove — stated plainly

1. **A real hover was never produced.** The browser pane in this session does
   not composite frames (the same limitation that makes screenshots time out),
   and a browser will not enter `:hover` from synthesized events — only from
   real pointer input. So "hovering changes nothing" is proved by *there being
   no such rule in the live document* and by *the resolver taking no pointer
   input*, not by hovering and watching.

   The complementary half is stronger and was measured: with the pointer
   provably nowhere (`:hover` count 0 for 30+ seconds of playback and seeking),
   the picture never went black. That is the failure condition, and it passed.

2. **No screenshots.** Same non-compositing pane. Everything above is measured
   numbers — pixel brightness, computed styles, live cascade rules — not
   pictures.

3. **The 60-minute and multi-asset cases were not exercised.** One 30-second
   1080p video, one punch-in.
