# MOTION-C5 Professional Curve Editor Architecture

Date: 2026-08-10
Status: verified development control surface

## Purpose

C5 answers a different question from C4:

```text
C4 Animation Timeline  -> WHEN does a property change?
C5 Value Graph         -> HOW does the numeric value travel between those keys?
```

Both surfaces read and edit the same C2 `Animatable` / keyframe authority. C5 does not create a curve store, another keyframe document, another Layer tree, or another animation clock.

## Authority chain

```text
Motion Scene
   |
   +-- C2 numeric keyframed property
   |      |
   |      +-- stable target
   |      +-- stable keyframe IDs
   |      +-- Hold / Linear / Bezier
   |      +-- optional inX/inY/outX/outY
   |
   +-- C4 dope-sheet projection
   |
   +-- C5 curve projection
          |
          +-- graph path / handles / presets / inspector
          +-- typed C2 operations only
```

`projectMotionCurves(scene)` is a pure projection. Editable curve tracks are numeric C2 keyframe tracks. Numeric authored motion-driver tracks are exposed as read-only so the UI does not pretend that a formula/spring/stagger driver is already editable as explicit keys.

## Curve semantics

C5 intentionally uses the same Bezier semantics as the evaluator:

- the left key owns its outgoing handle (`outX`, `outY`);
- the right key owns its incoming handle (`inX`, `inY`);
- missing handles use `DEFAULT_MOTION_BEZIER_HANDLES`;
- Hold remains a step;
- Linear remains a straight segment;
- Bezier graph samples are checked against `evaluateKeyframedValue(...)`.

The graph therefore visualizes the actual authored motion rather than a second approximation.

## Shared C4 / C5 state

Motion Lab owns one shared keyframe selection and one selected animation-track ID. Timeline and Curves receive the same state.

```text
click key in C4
   -> stable C2 selection ID
   -> C5 highlights same key

click key in C5
   -> same stable C2 selection ID
   -> C4 highlights same key
```

Both use the existing Motion Lab playhead (`localTicks`). Selecting a key seeks that shared playhead to the same exact tick.

## Editing operations

All persisted curve edits are ordinary typed Motion Graph operations:

- `set-keyframe-value`
- `move-keyframe`
- `set-keyframe-interpolation`
- `set-keyframe-bezier`

Bezier handle drag is preview-only while the pointer moves. Pointer-up emits one committed operation. Escape cancels the preview and emits nothing. This preserves one bounded compositor-history transaction per user action.

## Presets

C5 exposes deterministic presets rather than hidden renderer-specific easing strings:

- Linear
- Bezier
- Flat
- Auto
- Soft
- Smooth
- Snappy
- Heavy
- Ease In
- Ease Out
- Ease In Out
- Overshoot

Preset helpers compile to the same C2 interpolation/Bezier operations. Overshoot is refused for tracks with an explicit bounded numeric capability (for example opacity 0..1), rather than silently producing values outside the property contract.

## View controls

View-only state is local UI state and never enters the Motion Scene:

- Fit Track
- Fit Selection
- horizontal time zoom 1x..16x
- horizontal pan
- value zoom
- value pan

The graph uses a fixed SVG view box and derives the visible time/value transforms from those controls.

## Performance policy

No unapproved FPS budget is invented. Stress is measured and recorded.

Synthetic numeric keyframe tracks are measured at 10, 100, 1,000, 5,000 and 10,000 keys for:

- pure curve projection;
- SVG path construction;
- Bezier operation construction;
- development React/SVG construction.

The 10,000-key test exposed a real stack overflow in the original value-range fit implementation because it spread the full value list into `Math.min/Math.max`. C5 now computes min/max with a bounded loop, so 10,000-key projection/render succeeds. Development-view construction is intentionally reported as an engineering measurement, not a frame-rate guarantee.

## Production boundary

C5 remains a development-only Motion Lab control surface in this cycle. `apps/web` and the production editor are not integrated. A future production compositor can reuse the same projection and operations without copying C5's React UI state.
