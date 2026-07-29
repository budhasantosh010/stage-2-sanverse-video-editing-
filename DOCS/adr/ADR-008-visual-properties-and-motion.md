# ADR-008 — Visual properties and motion use one bounded contract

- Status: Accepted
- Date: 2026-07-29
- Goals: G6-02 through G6-06
- Builds on: ADR-005 and ADR-007

## Decision

Position, scale, rotation, opacity, crop, layer order, masks, keyframes, easing,
spring, and bounce are one visual-properties family. They are not separate
renderer features.

An accepted `set-visual-properties` operation names an existing visual by its
stable ID and carries its complete state:

- normalized translation, scale, rotation, and opacity;
- normalized four-sided crop;
- bounded layer number;
- `none`, `rectangle`, or `ellipse` mask with bounded feathering;
- zero or more property tracks with ordered keyframes on the 1,440,000-tick
  project clock.

Each keyframe carries the curve leading to the next keyframe. Supported curves
are linear, cubic Bezier, bounded physical spring, and bounded bounce. Unknown
properties, keys, masks, curves, invalid crop, duplicate tracks, duplicate
times, and unbounded parameters are refused.

## Render-plan consequence

The visual contract entered the render plan in v4. G6-07 then raised the plan
to v5 to add explicit adjacent-clip video/audio transition ramps. Its `visuals`
list still binds one authored visual state to the
exact concrete overlay node IDs produced after cuts. This matters because one
source-anchored title can become two nodes when a cut passes through it.

The compiler refuses a visual adjustment whose target produces no visible node.
It never silently moves the adjustment to another visual.

## Why this shape

Five independent models would inevitably disagree about timing, bounds, and
Undo. One complete operation gives:

- one user adjustment = one history entry = one Undo;
- one validator for preview, export, AI proposals, and saved projects;
- one deterministic evaluator for seek and render;
- a stable boundary where future render adapters can be replaced.

## Deliberate boundary

G6-02 through G6-06 establish authoring, validation, evaluation, history, and
render-plan semantics. They do not claim visible browser/FFmpeg motion. G6-09
chooses the renderer path, G6-10 implements both adapters, and G6-11 proves seek,
reduced-motion behavior, and preview/export fidelity.

## Owner gate

The technical rubric exists in
`DOCS/references/2026-07-29-g6-motion-quality-rubric.md`. G6-01 remains open
until the owner explicitly approves it. Architecture completion is not an owner
visual verdict.
