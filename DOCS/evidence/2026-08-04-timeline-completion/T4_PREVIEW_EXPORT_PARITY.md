# T4 Preview / Export Parity

T4 does not add a project or render-plan version. It changes only existing `VisualPropertyTrack` data carried by `set-footage-motion` or `set-visual-properties`.

## Shared evaluator

Domain authority: `evaluatePropertyTrack` + `evaluateVisualProperties`.

Browser Preview: `visualCssStyleFromPropertiesAt` calls the same evaluator at exact node-local integer ticks.

FFmpeg export: `ffmpeg-render-adapter.ts` imports the same evaluator for static visual values, sampled animated overlay translate expressions, and source-relative footage-motion frame sampling. T4 does not recreate interpolation math in React or FFmpeg.

Focused Preview parity now covers every exposed visual property (Position X/Y, Scale, Rotation, Opacity, Crop Top/Right/Bottom/Left) and every shipped interpolation surface (Linear, Ease In/Out/In-Out cubic presets, Custom Bezier, Spring, Bounce) at before-first, exact-first, 25%, 50%, 75%, exact-last and after-last ticks.

## Overshoot safety

Existing Bezier/Spring easing can mathematically overshoot even when canonical endpoint values validate. T4 graph editing makes those curves easier to author, so the shared editor evaluator now applies one render-safe runtime clamp after track evaluation while preserving canonical keyframe data:

- translate X/Y: -2..2;
- scale: 0.01..20;
- rotation: -3600..3600 degrees;
- opacity: 0..1;
- crop edges: 0..0.99;
- opposing crop edges are proportionally normalized below a combined value of 1.

Because Preview and FFmpeg consume the same evaluated state, this clamp cannot diverge by renderer. Motion Program easing/primitives are untouched.

## Export identity

API tests prove accepted keyframe value, time and easing changes each change export identity. Presentation-only lane expansion, Graph open/pan/zoom and keyframe selection live only in local presentation state and therefore cannot affect project/export identity.
