# T4 Keyframe Planners

Date: 2026-08-09

T4 introduces an Editor Program planning layer in `packages/edit-domain/src/editor-animation.ts`. It does not introduce a new accepted animation operation.

## Accepted authority preserved

Planner output is complete next editor-owned animation state. The Studio adapter later rebuilds the existing full-state operation:

- primary footage → existing `set-footage-motion`;
- visual target → existing `set-visual-properties`.

No planner mutates `EditProject`, calls an API, reads DOM state, generates an ID, or imports Motion packages.

## Closed property and target capability

The module provides a closed resolver for supported editor targets/properties. Primary footage exposes eight motion/crop properties and refuses opacity. Existing caption/nameplate/title/callout/media-overlay visuals expose the current visual track union. Freeze, dialogue and music return no animation property capability.

## Time projection

Pure projection/inverse projection maps:

- source-relative footage keyframes through the selected primary placement's existing speed/reverse source mapper;
- visual-relative keyframes through the existing visual placement interval.

Canonical keyframe ticks are never rewritten merely because a placement moves.

## Planner set

- `planAddEditorKeyframe`
- `planDeleteEditorKeyframes`
- `planMoveEditorKeyframes`
- `planSetEditorKeyframeValues`
- `planSetEditorKeyframeEasing`
- `planPasteEditorKeyframes`
- `planRemoveAnimationTrack`
- `planSetStaticAnimatedProperty`

All return a complete immutable next track state or a closed refusal.

## First-track creation

The existing minimum-two-keyframe invariant remains. Creating the first animation track seeds equal-value anchors at canonical animation start/end. If the requested playhead time lies between them, the selected equal-value playhead keyframe is added. Adding at start/end selects the corresponding existing anchor. Therefore enabling animation causes no visible jump.

## Deletion

Delete never silently flattens or removes a track. If deletion would leave fewer than two anchors, it returns `MINIMUM_KEYFRAMES_REQUIRED`. `Remove Animation` is an explicit separate planner that removes the whole track and reveals the unchanged static property authority.

## Multi-edit atomicity

Move/value/easing validation completes for every proposed selected keyframe before a next state is returned. Duplicate timestamps, invalid bounds, changed targets, incompatible properties and locked targets close the entire plan; no partial result exists.

## Clipboard

`sanverse.editor-keyframe-clipboard/v1` carries only:

- source property ID;
- relative integer tick offsets;
- values;
- canonical existing easing values.

It carries no project object, operation object, target identity, URL, file path, DOM value or Motion data.

Initial paste policy is same property only. Earliest copied keyframe aligns to the requested canonical anchor. Exact-time collision replaces the existing same-property keyframe; timestamps are never silently nudged.

## Full-state preservation

Rebuild helpers spread the existing accepted operation and replace only the new operation ID plus requested transform/crop/tracks. Tests explicitly prove visual layer, mask, transitions, effects, extensions and untouched property tracks survive, while footage motion identity/source interval/extensions and untouched static transform/crop survive.

## Current proof

Focused `editor-animation.test.ts`: 25 / 25.
Edit-domain TypeScript build: PASS.
