# MOTION-C3 — Professional Layer Hierarchy Evidence

Date: 2026-08-09
Worktree: `C:\Users\Lenovo\.chatgpt-code-harness\worktrees\Stage 2 Sanverse Editing Workflow-a95ba61b\motion-program-p0-c1`
Starting SHA: `d4f9fa96f249b7b418a24c664a2505eef9c7d820` (`motion-library-v1.2`)
Milestone: MOTION-C3
Status: implementation + release-candidate verification complete; preserve in a separate C3 Git checkpoint before A19.

## Baseline reproduced before implementation

```text
First-party components     69
Motion tests              271 / 271
Motion workspace builds     7 / 7
Working tree                clean
apps/web changes            none
motion-compositor-c2        present
motion-library-v1.2         present
```

## Architecture delivered

C3 does not introduce a Layer document. `projectMotionLayers(...)` derives every Layer row from the existing `MotionSceneV1` graph.

```text
Motion Graph
   │
   ▼
projectMotionLayers()
   │
   ▼
LayerProjection
   │
   ▼
Motion Lab Compositor Layers
```

Durable architecture detail is recorded in `DOCS/motion/LAYER_ARCHITECTURE.md`.

### State boundaries

- Render graph: hierarchy, constant node `enabled`, animated visible/opacity, transform, blend, effects, masks, keyframes/motion drivers.
- Persistent authoring metadata: `MotionAuthoringMetadataV1.lockedNodeIds` only.
- Ephemeral Motion Lab state: selection, expanded rows, search, drag/context state, inspector focus.

No selected/expanded/hover state is serialized into the graph or authoring metadata.

## Render enabled state

C3 adds a backward-compatible constant node switch:

```ts
enabled?: boolean // omitted means true
```

The Layer eye uses typed `set-node-enabled` operations. It does not replace or mutate `visible: Animatable<boolean>`, opacity/keyframes, effects or masks.

Tests prove:

- disable/re-enable keeps animated `visible` track intact;
- disable keeps effects/masks intact;
- disabled parent makes child effectively hidden without changing child's local enabled value;
- re-enabling parent restores locally-enabled child while locally-disabled descendants remain disabled.

## Lock metadata

Locks are authoring-only metadata and round-trip independently of the rendered scene.

`effectiveLocked` is direct lock OR ancestor lock.

The universal operation boundary returns typed `LOCKED` failure for edit operations against directly/effectively locked targets. Subtree delete/ungroup inspect descendant locks too. The Layer eye remains independent and works while locked.

Tests prove lock does not enter rendered node JSON or alter exact-tick output authority.

## Layer projection

`MotionLayerProjectionV1` exposes:

- stable node ID;
- source node name and human display name;
- parent / ordered children / depth;
- native node type;
- semantic-part membership;
- local/effective enabled state;
- tick-resolved visibility;
- direct/effective lock and ancestor owner;
- C2 keyframe / authored-motion / binding indicators;
- effect/mask counts.

All native graph node families are tested:

```text
Group
Text
Shape
Path
Image
```

### All-component gate

Every public component projects at all four reference ratios:

```text
69 components × 4 ratios
= 276 representative graph scenes
```

For each scene the test checks one projected Layer per graph node, unique IDs, root, parent existence, child order, depth and non-empty human display names.

## Selection authority

One `MotionSelectionStateV1` drives:

```text
Layers
Preview overlay / Preview hit selection
Compositor node inspector
Advanced Effects / Masks
C2 Keyframe Timeline
```

C3 supports:

- single selection;
- Ctrl/Cmd toggle selection;
- Shift visible-range selection;
- one primary node and anchor;
- deterministic selection fallback after delete.

Real Edge proves selection survives exact seek, ratio switch and style-pack switch.

## Motion Lab Compositor mode

The existing Creator / Designer / Advanced switch now includes `Compositor`.

Compositor mode uses the existing Stage and right inspector. It replaces the left component browser with a graph-derived Layers panel; it does not build docking infrastructure and does not change production Studio.

Layer rows expose:

```text
eye
lock
type
human name
◆ keyframes
~ authored motion
fx effects
M masks
```

Groups expand/collapse ephemerally. Search matches human name, type, semantic role and stable ID while preserving required ancestor chain.

## Layer operations

All graph mutations route through C1 universal operations:

- enable/disable;
- rename;
- reorder;
- reparent;
- duplicate;
- delete;
- group;
- ungroup;
- effects;
- masks;
- properties / C2 keyframes through existing inspectors.

### Rename

Tests and browser proof show stable node ID remains unchanged while authored name changes. Existing animation/effect/mask/semantic memberships survive.

### Reorder / z-order

A native-runtime test uses overlapping positioned red/blue graph shapes. Reordering the blue node from sibling index 1 to 0 reverses the resolved stacking indices used by positioned runtime styles. This proves Layer ordering is not merely cosmetic where graph stacking semantics apply.

### Reparent

C3 V1 reparent semantics are explicitly **local-transform preserving**. It keeps the node's local Motion Graph transform object unchanged.

C3 does not claim animated world-space transform preservation and does not rewrite component-authored responsive layout templates/DOM topology. This avoids silently manufacturing wrong animated transforms. The exact boundary is documented in `LAYER_ARCHITECTURE.md`.

Real Edge uses the explicit `DROP INSIDE` target to reparent `cost-card.cost.number` under the Value group; the projected tree updates immediately.

### Duplicate

C1 duplication remains authoritative. Tests verify fresh graph/effect/mask IDs, semantic remapping and unchanged source.

### Delete

Multi-delete is one atomic operation batch. Existing stale-reference cleanup remains validated. Selection fallback uses next sibling → previous surviving sibling → parent → root logic where applicable.

### Group / Ungroup

Selected nodes must share a parent. Group uses an identity transform and preserves sibling order. Ungroup restores children in order.

Real-browser composition crop proof:

```text
Cost Card before group   22,094 PNG bytes
Cost Card after group    22,094 PNG bytes
Screenshot bytes         identical = true
Composition rect         identical
Selection overlay        cleared
```

Retained evidence:

- `motion/visual-baselines/c3-group-pixels-before.png`
- `motion/visual-baselines/c3-group-pixels-after.png`

## Local development history proof

C3 adds a bounded Motion Lab-only snapshot journal capped at 50 transactions. It is explicitly **not production Studio Undo/history architecture**.

One user action records one snapshot for graph operations/authoring metadata/selection. New edits after Undo clear Redo.

Real Edge proves:

```text
Group
→ Undo
→ Redo
```

as one transaction per user action.

## Context / keyboard

Context actions:

```text
Rename
Duplicate
Delete
Group
Ungroup
Move Up
Move Down
Add Effect
Add Mask
```

High-value Compositor shortcuts only:

```text
Delete / Backspace       delete
Ctrl/Cmd + D             duplicate
Ctrl/Cmd + G             group
Ctrl/Cmd + Z             undo
Ctrl/Cmd + Shift + Z     redo
Escape                   clear selection
```

Text inputs are excluded from destructive shortcuts.

## Preview selection / overlay proof

Preview hit testing reads `data-motion-node-id` only as a DOM bridge to canonical Motion Node ID. DOM selectors do not become identity.

The selection overlay uses browser bounds only as editor geometry and maps display-space bounds back to composition coordinates. It is `pointer-events:none` and is outside authored component pixels.

Real Edge interaction proof on Cost / Value Card:

```text
Layer cost-card.value.number click
→ primary Layer selected
→ matching Preview outline visible

Preview cost-card.cost.number click
→ matching Layer row becomes primary

seek 3,? exact tick / ratio 16:9→9:16 / style switch
→ same selection remains

Ctrl-select cost + direction
→ two Layer rows selected
→ two Preview outlines
```

## Real-browser C3 operation proof

A real headless Edge DevTools loop performed:

- Layer → Preview selection;
- Preview → Layer selection;
- exact seek / ratio / style persistence;
- Ctrl multi-selection;
- Group;
- Undo / Redo;
- ancestor lock and locked-child UI refusal;
- parent eye / child local-enabled preservation;
- inline rename with stable ID;
- explicit DROP INSIDE reparent;
- add Glow;
- add rounded mask;
- live Layer badge refresh.

The interaction script observed no graph-operation error.

Retained representative evidence:

- `c3-cost-card-layer-tree.png`
- `c3-preview-selection-sync.png`
- `c3-multi-selection.png`
- `c3-group-operation.png`
- `c3-reparent-operation.png`
- `c3-locked-group.png`
- `c3-hidden-parent.png`
- `c3-keyframe-effect-mask-badges.png`
- `c3-team-network-nested-tree.png`

The keyframe/effect/mask screenshot uses A18 Keyword Slam and visibly proves the same row can report `◆ fx M` from real C2/graph state.

## Representative browser QA

Manually inspected in Compositor mode:

```text
Kinetic Headline          16:9
Checklist Card             9:16
Cost / Value Card         16:9 + interactive switch to 9:16
Timer / Status Pill        9:16
Team / Network Diagram    16:9 (32-node nested tree)
Browser Demo              16:9
Chat Thread                9:16
Dashboard Snapshot        16:9
Keyword Slam              16:9 (keyframe/effect/mask proof)
```

The component compositions remained readable and structurally consistent with pre-C3 behavior. A retained Browser Demo Tech UI regression screenshot shows the same composition content/hierarchy/spacing/colors as the A17 baseline; Motion Lab viewport-fit percentage changed because the development shell changed, so this is composition-level visual evidence rather than a full-window pixel hash.

The exact grouping pixel proof above is the stronger no-pixel-change evidence for C3 infrastructure.

## Hierarchy stress

Mechanical tests pass:

```text
Depth:     1, 3, 5, 10, 20
Siblings: 10, 50, 100, 500, 1000
```

No hierarchy projection cycle/order/depth break occurred after valid synthetic fixtures were used.

## Performance

Detailed measurement is in `DOCS/motion/PERFORMANCE_BUDGETS.md`.

Pure projection average:

```text
10 nodes       0.1733 ms
50 nodes       0.5669 ms
100 nodes      0.7407 ms
500 nodes      7.9139 ms
1000 nodes    11.1493 ms
```

Synthetic 1000-row React LayerPanel construction is materially slower (176.4393 ms average in the local SSR proxy), while current real components are far smaller. C3 intentionally does **not** introduce virtualization until realistic workflows justify it.

Real headless Edge Layer→Preview selection overlay commit:

```text
50 selections
average 23.804 ms
p95     38.9 ms
worst   49.9 ms
```

This is development-workshop DOM commit evidence, not paint/FPS.

## Failures found and fixed

- `MOTION-FAIL-010` — initial synthetic hierarchy stress fixture used helper arguments incorrectly; strict graph validation caught it; same stress matrix passes after fixing test data.
- `MOTION-FAIL-011` — timer-based headless selection benchmark was throttled; invalid run discarded; MutationObserver-based DOM commit measurement retained.

No test/assertion was weakened to make either failure disappear.

## Final mechanical release-candidate gate

Actual Motion-only result after all C3 source changes:

```text
motion-contract           3 / 3
motion-primitives        25 / 25
motion-graph            113 / 113
motion-native-runtime     4 / 4
motion-testing            5 / 5
motion-library          135 / 135
motion-lab               19 / 19
--------------------------------
TOTAL                   304 / 304
```

All **7 / 7 Motion workspace builds pass**.

Motion Lab production build is green. Vite reports a non-failing development bundle-size warning at approximately **532.50 kB minified / 144.70 kB gzip** for the main JS chunk. This milestone does not add speculative code splitting solely to silence that warning.

## Source-boundary scans

PASS:

- `git diff --check`;
- zero `apps/web` changes;
- zero production `apps/web` imports from Motion packages;
- zero forbidden runtime animation authorities (`Date.now`, `performance.now` render authority, `Math.random`, timers, CSS keyframes, autonomous `.animate()`);
- Motion Lab wall clock remains confined to preview tick scheduling/editor focus behavior;
- no Remotion/Rive/Lottie/GSAP/Framer Motion/Three.js dependency;
- no Plan-B AI decision logic;
- no C4/Dope Sheet implementation.

## C3 completion boundary

C3 is complete at the implementation/evidence level and must now be committed/pushed/tagged separately as `motion-compositor-c3` before any A19 source edit.

C4 remains **not started**.
