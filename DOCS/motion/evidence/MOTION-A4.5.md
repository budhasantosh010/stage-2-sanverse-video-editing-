# MOTION-A4.5 — Motion Graph + Schema-Driven Motion Lab

Status: COMPLETE — architecture, migration preservation, schema inspector and real-browser interaction evidence verified.
Date: 2026-08-08

## Why this slice existed

Plan A needed one editable first-party composition model before expanding the component count. Without that model, Creator controls, advanced node/effect editing and a future Layers / Nodes / Timeline compositor could drift into separate representations of the same graphic.

The rule is now:

```text
FIRST-PARTY COMPONENT
        |
        v
   MOTION GRAPH
        |
  +-----+------+----------------+
  |            |                |
Layers view  Node/effect view  Timeline tracks

ONE MODEL — read-only projections, not duplicated documents.
```

## Motion Graph implemented

`packages/motion-graph` contains a closed, serializable scene model with:

- normalized group / text / shape / path / image nodes
- stable node IDs and parent/child hierarchy
- semantic parts
- Creator / Designer / Advanced exposure metadata
- exact-tick constants, deterministic motion drivers, composable scalar formulas and keyframes
- bounded property bindings with cycle refusal
- animated compact-number and clock strings
- path trim progress
- ordered effects
- rectangle / rounded-rectangle / ellipse masks
- bounded blend modes
- typed graph patches, including mask-property mutation
- scene validation and parse/serialize round trips
- layer-tree projection
- node/effect relationship projection
- timeline-track projection
- compositor-readiness validation

## Migrated proof components

These existing components now create and render from Motion Graph scenes:

1. Kinetic Headline
2. Checklist Card
3. Cost / Value Card
4. Timer / Status Pill

Their old exact-state evaluators remain independent regression oracles. The rendered animation reads resolved graph values.

## Preservation gate

Before migration, 128 reference screenshots were frozen: 4 components × 4 ratios × 2 style packs × 4 animation phases.

After graph migration, exact browser comparisons proved no approved default redesign:

- Kinetic Headline: entrance / settled / hold / exit — 0 changed pixels.
- Checklist Card: every phase produced an exact 0-pixel match after Motion Lab ResizeObserver settling.
- Cost / Value Card: every phase produced an exact 0-pixel match at the same settled preview scale.
- Timer / Status Pill: entrance / settled / hold / exit — 0 changed pixels.

The ResizeObserver capture race was treated as evidence noise and never accepted as a component regression.

## Schema-driven Motion Lab

`apps/motion-lab/src/GraphInspector.tsx` renders property controls from exposure metadata rather than component-name branches.

- Creator reveals creator-safe content/style/timing controls.
- Designer inherits Creator and reveals layout/surface/transform/motion controls.
- Advanced inherits both and reveals semantic Parts, layer tree, node selection, blend mode, Effects, Masks and node/effect debug.

The same typed graph patches are passed into `MotionComponentHost`, so changing an advanced control edits the graph actually rendered by the preview.

The old rendered component-specific inspector was removed rather than hidden.

## Mechanical evidence

- Motion Graph: 30/30 tests passed and build passed.
- Motion Library: 75/75 tests passed and build passed.
- Motion Lab: 8/8 tests passed and build passed.
- New Lab tests prove Creator/Advanced progressive disclosure and typed effect/mask/blend patch emission.
- Cross-component readiness tests prove validation, serialization, exact seeking, graph projection and graph/oracle agreement.

## Real Microsoft Edge evidence

Inspected screenshots:

- `a45-motion-lab-creator.png`
- `a45-motion-lab-advanced-fixed.png`
- `a45-motion-lab-advanced-edited.png`

The first Advanced screenshot exposed a real internal-workshop layout bug; see `MOTION-FAIL-002`. After the fix, Advanced keeps Preview and transport visible while the Inspector scrolls internally.

A real Edge DevTools-protocol interaction then:

1. opened the graph-backed Kinetic Headline in Advanced mode,
2. selected the Background semantic part,
3. added a Glow effect,
4. added a Rectangle mask,
5. changed the selected node blend mode to `multiply`,
6. preserved exact tick `1,296,000`,
7. verified the preview remained rendered.

DOM evidence confirmed:

- `data-motion-graph-backed="true"`
- selected node `kinetic-headline.background`
- one effect card
- one mask card
- blend `multiply`
- an actual CSS `drop-shadow(...)` filter on the rendered background
- an actual generated SVG mask image on the rendered background
- selected-node debug outline

The visible Advanced screenshot shows the Glow card, rectangle-mask controls and node/effect debug alongside the still-visible preview and exact-tick transport.

## Failures found

- `MOTION-FAIL-001` — missing Lab tick query incorrectly became exact tick zero. Fixed earlier.
- `MOTION-FAIL-002` — Advanced inspector expanded the outer Lab beyond the viewport. Fixed with one viewport-height authority and internal inspector scrolling.

## Production isolation

This architecture remains inside Plan A packages and the internal Motion Lab. It does not integrate into or redesign production `apps/web`.

## Result

A4.5 passes: Sanverse now has one serializable deterministic Motion Graph that drives rendering and can truthfully power simple Creator controls, advanced node/effect/mask editing and future compositor projections without separate models.
