# T4 Animation Authority Audit

Date: 2026-08-09
Branch: `timeline-t4-keyframe-graph`
Base: `aed76ac0232e8a920812b800d234a96e32de7396`

This audit was completed from the current executable editor code before T4 UI implementation. T4 is an Editor Program milestone only. Motion Plan A/C and Plan B remain read-only/out of scope.

## A. Visual-property authority

Canonical editor animation remains `VisualPropertyTrack` / `VisualKeyframe` in `packages/edit-domain/src/visual-properties.ts`.

Closed property IDs:

- `translate-x`
- `translate-y`
- `scale`
- `rotation`
- `opacity`
- `crop-top`
- `crop-right`
- `crop-bottom`
- `crop-left`

Each track owns one property and an ordered array of keyframes. Each keyframe owns a `MediaTime at`, numeric value, and the outgoing `VisualEasing` for the segment from that keyframe to the next.

Current limits:

- `MAX_VISUAL_TRACKS = 12`
- `MAX_KEYFRAMES_PER_TRACK = 64`
- at least two keyframes are required for an animated track;
- timestamps must be strictly increasing;
- canonical time is integer `MediaTime` using the project timescale.

Current easing authority:

- linear;
- cubic-bezier (`x1/x2 0..1`, `y1/y2 -2..2`);
- spring (`mass`, `stiffness`, `damping`, `velocity` within existing validator bounds);
- bounce (`intensity 0..1`).

`applyVisualEasing` and `evaluatePropertyTrack` are the shared math. `evaluateVisualProperties` applies animated tracks over the existing static transform/crop state. Preview and FFmpeg both consume this evaluator. T4 must call it; T4 must not create another evaluator.

## B. Primary-footage animation

Accepted operation: `set-footage-motion`.

Identity/state:

- stable `motionId`;
- `assetId`;
- immutable source-oriented `sourceInterval`;
- complete static transform;
- complete static crop;
- complete property-track list;
- extensions.

Allowed animated properties are `FOOTAGE_MOTION_PROPERTIES`: translate X/Y, scale, rotation and four crop edges. Opacity is intentionally excluded and the validator requires primary footage to remain opaque.

`evaluateFootageMotionAt` evaluates at exact source time. It converts to motion-relative ticks by subtracting `sourceInterval.start`. This is source-oriented authority, not composition-time authority.

Current authoring behavior:

- `FootageMotionInspector` seeds an unanimated property with two equal-value anchors at motion start and motion end, then upserts the requested playhead keyframe;
- Canvas edits an animated property at the playhead through the shared footage-motion draft, otherwise edits its static base property;
- accepted change is still one complete `set-footage-motion` operation.

T4 will preserve those operation semantics and move keyframe mutation rules into pure planners.

## C. Overlay/visual animation

Accepted operation: `set-visual-properties`.

Current supported visual targets resolved by the Inspector/render projection:

- caption cue visual IDs (`captions_*`);
- nameplates;
- titles;
- callouts;
- media overlays / B-roll / images.

All of those targets currently use the same complete `VisualProperties` contract and the current Inspector exposes the current property union. Render compilation serializes the complete `tracks` array onto `VisualPropertiesNode`; browser Preview computes relative time as `compositionTicks - node.interval.start`; FFmpeg consumes the same evaluated visual properties.

Therefore these visual tracks are **visual-relative** to the rendered visual placement interval.

Music and primary dialogue are not visual-property targets.

## D. Audio

T2 owns static clip audio through existing clip fields/`set-clip-audio`: enabled state, gain, fades and pan. A2 music has its existing static music operation.

There is no editor-owned `VisualPropertyTrack`-style animated gain/pan/fade contract. T4 will expose **no audio keyframe lanes**.

## E. Speed

T2 owns constant rational playback speed through the existing clip time-transform authority. There is no variable-speed property track or speed curve. T4 will expose **no Speed keyframe lane**. Rate Stretch remains a T2/T3 timing tool.

## F. Transitions

T2 transitions are explicit edit-point transition state, not `VisualPropertyTrack` animation lanes. T4 will preserve them as complete unrelated state when visual keyframes are edited and will expose **no transition keyframe lane**.

## G. Freeze

Freeze is an explicit primary segment kind with one held source instant and authored composition duration. It has no source-motion time span that can truthfully own footage-motion keyframes. T4 will not expose a source-motion lane for Freeze.

## H. Existing Inspector keyframe behavior

Visual overlay Inspector currently:

- toggles animation by creating two equal-value anchors at 0 and visual end;
- `Add at playhead` upserts at local visual time;
- keyframe numeric editing mutates the local full-state draft;
- current Remove silently removes the whole track when deletion leaves fewer than two keyframes.

Primary footage Inspector similarly seeds two equal-value anchors and upserts using source-relative time.

T4 changes the unsafe deletion behavior: Delete will refuse when it would violate the two-keyframe minimum; `Remove Animation` becomes explicit. The minimum-two validator remains unchanged.

## I. Export path and versioning

Current path:

accepted `set-footage-motion` / `set-visual-properties`
→ project evaluation/folding
→ render-plan v8 serializes unchanged visual tracks
→ browser and FFmpeg call existing evaluator math
→ rendered output.

T4 edits only already-supported track data inside existing accepted operation families. No project-schema bump or render-plan bump is required.

Render-affecting track changes necessarily change project accepted state/export identity. Lane expansion, graph viewport, keyframe selection and other presentation state remain outside `EditProject` and must not affect export identity.

## Audit decisions

1. Preserve `VisualPropertyTrack`, `VisualKeyframe`, `VisualEasing`, `set-footage-motion` and `set-visual-properties` as the only accepted animation authorities.
2. Add an editor-only capability/time/projection/planner layer; do not add a generic compositor/keyframe operation.
3. Keep primary footage source-relative and visual overlays visual-relative.
4. Do not ship audio, speed, transition or Freeze keyframe lanes.
5. Keep the two-keyframe minimum; first-track creation seeds equal-value anchors; Delete refuses when it would leave one; Remove Animation is explicit.
6. Do not add persistent keyframe IDs. Presentation selection addresses keyframes by target + property + canonical timestamp.
7. Do not add Hold in the first implementation slice. Hold would change the shared editor easing union, validation and render evaluation; it may be added only if the complete Preview/export path is changed and proven inside Editor ownership. Linear/Bezier/Spring/Bounce already satisfy the required truthful T4 graph surface.
8. T4 requires no Motion Program import and no production Studio topology change.
