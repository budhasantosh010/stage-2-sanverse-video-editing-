# G6 motion adapter spike — 2026-07-29

## Decision

Keep the selected hybrid renderer:

- browser CSS for interactive preview;
- native FFmpeg layer/filter composition for final export;
- one renderer-neutral render plan and one deterministic visual evaluator.

A headless-browser export was not selected. The native path rendered the
representative fixture directly, remains compatible with the existing audio and
timeline renderer, and adds no browser-runtime deployment dependency.

## Focused evidence

- Native FFmpeg architecture fixture: 320x180, 30 fps, 60 frames, 2.000 s,
  animated overlay/rotation/blur, 233 ms measured render.
- Integrated adapter fixture: 1280x720, 30 fps, 240 frames, 8.000 s. It consumed
  render-plan v5 transform, crop, opacity, fade, saturation, and rotation and
  produced
  `C:\Users\Lenovo\AppData\Local\Temp\sanverse-g6-preview-export-fixture.mp4`.
- Browser exact-clock check: half-open visibility at the visual boundary,
  128-pixel translation at one second, and reduced-motion resolution to the
  final authored state.
- Browser/export translation contract check: both adapters resolved normalized
  `translateX=0.1` on a 1280-pixel composition to 128 pixels.
- Relevant TypeScript boundaries passed for edit-domain, web, and API.

## Truthful boundary

G6-07 and G6-10 were completed after the initial spike:

- G6-07 now has a bounded adjacent-clip `dip-to-black`, explicit `cut` or
  `fade-through-silence` audio policy, exact browser opacity, render-plan v5
  ramps, and native FFmpeg video/audio filters. It does not shorten or overlap
  the canonical timeline.
- G6-10 now draws each written title/callout/caption/nameplate on its own
  transparent layer before applying the shared transform/effect path. A real
  1280x720, 30 fps, 90-frame written-callout layer rendered successfully to
  `C:\Users\Lenovo\AppData\Local\Temp\sanverse-g6-written-layer-fixture.mp4`.

G6-11 remains open:

- Timing, reduced motion, and one translation fixture are proved. Full
  per-primitive extracted-frame fidelity remains F1/F2 and G6-11 work.

No owner motion-quality verdict is inferred.
