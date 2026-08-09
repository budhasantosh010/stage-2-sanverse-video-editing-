# T4 Keyframe Time Projection

Date: 2026-08-09
Base: `aed76ac0232e8a920812b800d234a96e32de7396`

T4 never rewrites canonical keyframe time merely to draw a Timeline diamond or graph point.

## Canonical bases

### Primary footage

`VisualKeyframe.at` is relative to the accepted footage motion's `sourceInterval.start`.

Canonical source tick:

`motion.sourceInterval.start.ticks + keyframe.at.ticks`

The selected primary placement supplies presentation context only. Existing composition helpers remain the time authority:

- `clipTimeToSource`
- `sourceTimeToClip`
- `clipTimeToComposition`
- `compositionTimeToClip`
- rational `sourceTicksForCompositionOffset` / `compositionTicksForSourceOffset`
- `placeSourceSpan` for source-oriented placement projection.

Projection:

canonical source tick
→ selected placement source range
→ current speed/direction mapping
→ composition tick
→ Timeline X.

Inverse drag:

pointer composition tick
→ selected placement clip time
→ current speed/direction mapping
→ source tick
→ motion-relative canonical tick.

Reverse is therefore naturally direction-aware: dragging right can move canonical source time earlier. Speed changes composition spacing without multiplying stored keyframe ticks.

### Visual properties

Existing Preview uses:

`relativeTicks = compositionTicks - node.interval.start.ticks`.

Therefore overlay/caption/title/callout/nameplate/media-overlay keyframes remain visual-relative. Timeline projection is:

`visual composition start + keyframe.at.ticks`.

Inverse drag subtracts the visual placement start.

## T2/T3 consequences

- Standard Trim: source keyframes stay canonical; visible subset changes.
- Ripple Trim: source keyframes stay canonical; placement projection shifts.
- Roll: source bounds change; visible source-keyframe subset changes, no hidden rewrite.
- Slip: placement stays; source window changes; source-keyframe projection changes. Old source keyframes do not get dragged to preserve screen X.
- Slide: selected source interval stays; composition projection shifts.
- Rate Stretch / Speed: canonical source keyframes stay; composition spacing changes through rational mapping.
- Reverse: canonical source order stays; composition display order reverses.
- Freeze: no source-animation lane.
- J/L: visual keyframe edit preserves linked-audio state because the complete existing operation is rebuilt without touching clip timing/audio authority.
- Transition: visual keyframe edit preserves transition fields in `set-visual-properties`; footage motion never owns clip transitions.
- Split: source motion is not duplicated; each surviving placement projects the same source-oriented motion according to its visible source range.

## Repeated source placements

A `set-footage-motion` record is source anchored. If one source interval appears in multiple placements, editing that motion can affect every placement that exposes the same source interval. `selectedPlacementClipId` is presentation context used to project/invert Timeline interaction; it is not accepted animation identity.

Creator-facing copy must describe this as source animation rather than exposing internal operation IDs.

## Integer-tick rule

All canonical animation times remain safe integer project ticks at `PROJECT_TIMESCALE = 1,440,000`. Timecode/frames/percent/seconds may be display/input conveniences only; planner results are integer `MediaTime` and no floating seconds are stored.
