# T4 Inspector and Canvas Synchronization

T4 does not redesign Inspector or Canvas.

## Inspector

A minimal `Selected keyframe` section is rendered inside the existing Tool/Inspector surface when exactly one shared T4 keyframe is selected. It displays the same property, canonical tick, value and outgoing interpolation. Numeric edits use the same planner and the same existing accepted operation adapter as Timeline/Graph.

Multi-property/multi-keyframe selections intentionally do not invent an ambiguous Inspector value.

## Primary Canvas

The existing primary-footage Canvas already uses the shared footage-motion draft and source-time helper. T4 adds an explicit `keyframeEditProperties` presentation context:

- when a T4 source keyframe for a property is selected exactly at the playhead, Canvas movement for that property edits that selected keyframe;
- when no T4 keyframe selection is active, Canvas does not implicitly create an Auto-Key through the T4 path;
- static base editing remains the authority for non-selected properties;
- release still creates one `set-footage-motion` operation and Escape/pointercancel remains zero edit.

## Visual Canvas

The existing visual Canvas already refuses direct manipulation when the requested visual property has an animation track (`This property is animated...`). T4 preserves that truthful conflict instead of silently creating Auto-Key. Timeline/Graph/Inspector remain the explicit editor keyframe surfaces for visual targets.

No Auto-Key feature is introduced by T4.
