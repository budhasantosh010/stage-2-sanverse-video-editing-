# Sanverse Motion Layer Architecture

Date: 2026-08-09
Milestone: MOTION-C3
Status: C3 V1 architecture implemented in the dedicated Motion worktree

## One authoritative model

The Layer hierarchy is a **projection of Motion Graph nodes**. It is not a second document model.

```text
MotionSceneV1
    │
    ├── nodes / hierarchy / render properties
    ├── effects / masks / blend / animation
    └── semantic parts
           │
           ▼
projectMotionLayers(...)
           │
           ▼
MotionLayerProjectionResultV1
           │
           ▼
Motion Lab Layers UI
```

There is no independent `LayerDocument`, no synchronization loop, and no Layer-only canonical identity. A Layer row is addressed by the same stable Motion Node ID used by C1 operations, C2 animation tracks, Preview hit testing, Effects and Masks.

## Three state categories

### 1. Render state — affects pixels

Stored in Motion Graph:

- node hierarchy;
- constant `enabled` render switch;
- animated `visible` and `opacity`;
- transform;
- blend mode;
- effects;
- masks;
- animation/keyframes.

### 2. Persistent authoring metadata — affects editing, not pixels

Stored separately as `MotionAuthoringMetadataV1`:

```ts
{
  schemaVersion: 'sanverse.motion-authoring-metadata/v1'
  lockedNodeIds: readonly MotionNodeId[]
}
```

The metadata is serializable/validatable but is intentionally not part of rendered node properties. Locking therefore cannot change exact-tick output.

### 3. Ephemeral Motion Lab UI state — not persisted into the graph

- selected node IDs / primary / anchor;
- expanded rows;
- Layer search query;
- drag/drop state;
- context-menu state;
- inspector focus;
- panel scroll/hover state.

These are development-editor concerns and do not affect Motion Scene serialization.

## Render enabled vs animated visibility

C3 adds a backward-compatible constant node switch:

```ts
enabled?: boolean // missing means true
```

This is intentionally separate from the existing:

```ts
visible: Animatable<boolean>
opacity: Animatable<number>
```

The Layer eye controls only `enabled` through the typed `set-node-enabled` C1 operation. It never rewrites `visible`, `opacity`, keyframes, motion drivers, effects or masks.

### Effective enabled state

```text
effectiveEnabled(node)
=
node.enabled !== false
AND every ancestor enabled !== false
```

Parent disable does not mutate descendants. If a parent is disabled while child A is locally enabled and child B is locally disabled, re-enabling the parent restores A but B remains disabled.

The evaluator publishes both `enabled` and `effectiveEnabled` in the resolved scene. The native runtime renders effectively-disabled nodes hidden.

## Lock architecture

Lock is authoring metadata, never a rendered node property.

```text
effectiveLocked(node)
=
node ID is directly locked
OR any ancestor ID is locked
```

A locked node remains:

- selectable;
- inspectable;
- expandable/collapsible in Layers.

It refuses or disables graph-edit classes including:

- rename;
- delete;
- duplicate;
- reorder;
- reparent;
- transform/property changes;
- effect changes;
- mask changes;
- keyframe changes;
- group/ungroup structural changes.

The Layer eye remains independently usable even when locked. The lock rule is enforced at the universal operation boundary through `MotionOperationApplyOptionsV1.authoringMetadata`, not just by disabled buttons, so later compositor surfaces inherit the same policy.

Subtree removal and ungroup inspect descendant locks too, preventing an unlocked parent command from silently destroying a directly locked child.

## Root policy

The root node may be selected, expanded and inspected. C3 Layers UI disables ordinary root:

- delete;
- duplicate;
- group-as-selection;
- reparent;
- reorder;
- inline rename.

The lower-level C1 graph operation layer already protects illegal root hierarchy mutations.

## Layer projection

`projectMotionLayers(...)` is a pure TypeScript function with no React/browser dependency.

Each `MotionLayerProjectionV1` exposes:

- stable node ID;
- source `nodeName` and human `displayName`;
- parent and ordered children;
- real graph node type;
- semantic-part memberships;
- local/effective enabled state;
- visible/effectively-visible state at the requested tick when resolved state is supplied;
- direct/effective lock state and locking ancestor;
- keyframe / motion-driver / binding indicators from C2 Timeline projection;
- effect and mask counts;
- tree depth.

### Human names

Canonical identity remains the node ID. Display labels use a fallback chain based on authored name, semantic information and resolved text. Generic authored names can become useful rows such as:

```text
Value — $24K
Title — Ready before you publish
```

Renaming edits only the actual authored `node.name`; it never writes the derived display label back into the graph and never changes the stable node ID.

## Native node families

C3 projects the existing graph vocabulary directly:

- Group;
- Text;
- Shape;
- Path;
- Image.

It does not invent Layer-only node types.

## Canonical selection

`MotionSelectionStateV1` is the single development selection authority:

```ts
{
  selectedNodeIds: readonly MotionNodeId[]
  primaryNodeId: MotionNodeId | null
  anchorNodeId: MotionNodeId | null
}
```

The same state feeds:

```text
Layers
  │
  ├── Preview overlay/hit testing
  ├── Compositor Inspector
  ├── Advanced Effects/Masks
  └── C2 Keyframe Timeline
```

There is no separate `layerSelection`, `previewSelection` or animation selection.

C3 supports:

- single click selection;
- Ctrl/Cmd toggle selection;
- Shift visible-range selection;
- one primary node;
- deterministic selection fallback after delete.

For multiple selected layers, C3 intentionally exposes only conservative bulk commands rather than pretending unrelated node schemas share every property.

## Preview hit testing and overlay

Rendered development elements already expose `data-motion-node-id`. C3 uses that attribute only as a hit-test bridge back to canonical Motion Node ID.

DOM identity is not canonical state.

Selection overlays are editor/debug geometry. `MotionSelectionOverlay` may use `getBoundingClientRect()` and `ResizeObserver` to map displayed browser rectangles back to composition coordinates. That measurement never becomes animation/render authority.

Group bounds use the union of measurable rendered descendants when the group itself has no visual element.

Selection outlines were removed from the component render-style merger so selecting a node cannot alter the authored composition pixels.

## C1 operation routing

Every C3 graph mutation routes through the universal operation layer:

- `set-node-enabled`;
- `rename-node`;
- `reorder-node`;
- `reparent-node`;
- `duplicate-node`;
- `remove-node`;
- `group-nodes`;
- `ungroup-nodes`;
- effect/mask operations;
- existing property/keyframe operations.

Multi-delete/duplicate/visibility operations are validated/applied as one batch for one user action.

## Sibling order and render stacking

Motion Group `childIds` remain authoritative sibling order. C3 exposes the evaluator's sibling `stackingIndex`, and the native style adapter maps that order to CSS z-index when a visual element already participates in positioned stacking.

A native-runtime test uses overlapping red/blue shapes and proves that a `reorder-node` operation reverses which positioned sibling has the higher stacking index. Layers ordering is therefore not merely cosmetic where graph stacking semantics apply.

## Reparent semantics — explicit C3 V1 boundary

C1 `reparent-node` preserves the node's existing **local Motion Graph transform object**. C3 does not rewrite transforms on reparent.

C3 does **not** claim animated world-space preservation. It does not evaluate both animated parent chains and synthesize inverse transform tracks. Doing so approximately would create incorrect animation.

Also, many current first-party components use component-authored responsive layout slots (React/CSS/SVG structure) in addition to graph hierarchy. Reparenting a graph node changes the canonical structural parent/order but does not rewrite a component's authored responsive layout template or DOM topology. C3 therefore does not claim that arbitrary reparenting relocates every current component into a different authored layout slot.

This is deliberate and fail-honest:

```text
C3 V1 reparent
= structural graph parent change
+ local transform preserved
+ no fake animated world preservation
+ no automatic component-layout-template rewrite
```

A later generalized layout/composition system may add an explicitly typed world-preserving reparent where exact semantics exist. C3 does not silently pretend that capability exists today.

## Group / ungroup

C3 requires selected nodes to share one parent. The existing C1 `group-nodes` operation:

- inserts an identity-transform group;
- preserves relative sibling order;
- reparents selected siblings under it.

Real Edge composition-region evidence proves Cost Card pixels are byte-identical before and after grouping when the selection overlay is cleared.

`ungroup-nodes` restores children to the parent in preserved order and removes the temporary group.

## Search

Layer search matches:

- display name;
- node type;
- semantic-part IDs;
- stable node ID as a debug fallback.

Matches retain their ancestor chain so context is not flattened. Filter-forced expansion does not need to mutate the user's ordinary expanded-row preference.

## C2 / Effects / Masks synchronization

Layer badges derive from actual graph/timeline state:

- `◆` — explicit C2 keyframe track;
- `~` — deterministic authored motion driver;
- `fx` — graph effect stack;
- `M` — graph mask list.

Clicking those badges preserves the same selection and focuses the existing Advanced/C2 section. There is no second effects, mask or animation store in Layers.

## Motion Lab-only Undo/Redo proof

C3 uses a bounded immutable snapshot journal **only inside Motion Lab**. It is not production Studio history architecture.

A snapshot contains:

- the current universal graph-operation list;
- persistent authoring lock metadata;
- canonical selection.

The journal is capped at 50 transactions. One user command records one pre-action snapshot. Undo/Redo operate at that transaction boundary, and a new edit after Undo clears the redo branch.

Real Edge proves Group → Undo → Redo as one action/step.

## Development shortcuts

C3 intentionally adds only high-value shortcuts while Compositor mode is active:

- Delete / Backspace — delete selection;
- Ctrl/Cmd+D — duplicate;
- Ctrl/Cmd+G — group;
- Ctrl/Cmd+Z — Undo;
- Ctrl/Cmd+Shift+Z — Redo;
- Escape — clear selection.

Text inputs are excluded from destructive shortcuts.

## Performance policy

C3 does not virtualize Layers pre-emptively. Synthetic 1,000-row React construction is measurably slower than realistic current components, but real first-party trees are currently on the order of tens of nodes (for example Cost Card 18, Team Network 32).

The pure projection remains small even at 1,000 synthetic siblings. Virtualization should be added only when a realistic component/workflow demonstrates an actual interaction problem, not to optimize a synthetic ceiling with architectural complexity.

Measured numbers are recorded in `PERFORMANCE_BUDGETS.md` and C3 evidence.

## Future attachment points

C3 answers:

> What objects exist and how are they organized?

C4 will attach professional time editing to the **same selected Motion Node IDs** and C2 tracks. C6 can later attach processing-node views to the same graph objects.

```text
                   Motion Graph
                        │
       ┌────────────────┼────────────────┐
       │                │                │
       ▼                ▼                ▼
     Layers          Timeline          Nodes
   structure           time          processing
       │                │                │
       └────────────────┴────────────────┘
                  same graph IDs
```

C3 introduces no production `apps/web` integration and no Plan-B AI decision logic.
