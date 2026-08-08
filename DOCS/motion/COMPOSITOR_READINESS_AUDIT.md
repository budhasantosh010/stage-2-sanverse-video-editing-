# Sanverse Motion — Level-4 Compositor Readiness Audit

Date: 2026-08-08
Milestone: MOTION-C0
Branch: `motion-program-p0-c1`
Baseline tag: `motion-plan-a-v1`

## Scope

This audit checks the actual serialized Sanverse Motion Graph used by the five vertical proof components. It does not evaluate production Studio integration and it does not authorize Plan B, C2 keyframe UI, 3D, particles, tracking or shaders.

Representative components:

1. `sanverse.kinetic-headline`
2. `sanverse.checklist-card`
3. `sanverse.cost-value-card`
4. `sanverse.timer-status-pill`
5. `sanverse.team-network-diagram`

Executable proof: `packages/motion-library/src/compositor-readiness-audit.test.ts`.

## Result

The existing Motion Graph is structurally suitable for continuing into a Level-4 compositor. One blocking structural-reference bug was found and fixed: deleting a node from a published component left stale semantic references behind. The graph now reconciles semantic parts, exposures and layout metadata on structural removal and preserves semantic coverage on insertion.

The graph is **ready for C1 universal operations**. The missing capabilities below are operation-layer gaps, not a need for a second Layer/Node/Timeline model.

## Capability matrix

| Capability | Status | Current implementation / proof | Gap / next owner |
|---|---|---|---|
| Enumerate meaningful visual objects | READY | Normalized `scene.nodes` record; five proof scenes pass compositor-readiness coverage | None for C0 |
| Stable node IDs | READY | Published components use stable component-owned IDs; Team Network derives IDs from stable content IDs | C1 must preserve/remap IDs on duplicate |
| Hierarchy | READY | `parentId` + group `childIds`; `deriveLayerTree(scene)` passes for all five | C3 will expose it as UI |
| Semantic parts resolve to nodes | READY | `semanticParts[].nodeIds`; all five proof scenes validate | C1 structural ops must keep references valid |
| Independent transform | READY | Every node owns generic transform animatables; exact set-property proof passes | None for C0 |
| Independent opacity / visibility | READY | Generic node properties; exact mutation proof passes | None for C0 |
| Node property mutation | READY | Typed `MotionNodePropertyPathV1` + patch application + post-validation | C1 wraps this in universal operations/results |
| Node insertion | READY after C0 fix | `add-node` updates hierarchy and inherits semantic coverage or creates a bounded custom part | C1 adds typed operation/result/validation surface |
| Node removal | READY after C0 fix | Subtree removal now prunes semantic/exposure/layout references before validation | C1 adds explicit typed errors/result |
| Node reparent | READY | Existing patch API validates destination shape; final scene validation rejects cycles | C1 exposes typed operation and cycle error |
| Node reorder | READY | Existing patch API deterministically reorders siblings | C1 exposes typed operation |
| Node selection | READY | Motion Lab and native runtime address selection by the same node ID | C3 will add professional Layer selection UI |
| Effects target one node | READY | Node-local ordered `effects`; five-scene mutation proof | Semantic-part convenience targeting is indirect through part node IDs |
| Effects target semantic part directly | PARTIAL | Semantic parts resolve exact node IDs, but effect patches are node-addressed | C1 may keep node operations canonical and let UI expand part → nodes transactionally |
| Effect reorder | READY | Ordered effect arrays + `reorder-effect`; projections preserve order | C1 operation/result wrapper |
| Effect enable/disable/property edit | READY | Patch API + registry + evaluator | C1 validation must reject invalid parameters before commit |
| Masks target one node | READY | Node-local ordered mask list + exact evaluation | Advanced path masks remain C7 |
| Masks target semantic part directly | PARTIAL | Part can resolve to nodes, but mask patch is node-addressed | C1 can compose a bounded atomic batch over resolved nodes |
| Blend modes | READY | Closed blend set validated; exact mutation proof | C1 must fail closed on unknown input |
| Serialization / deserialization | READY | JSON round trip + `validateMotionScene` + equal evaluation for all five | Version migration later if schema changes |
| Scene validation | READY | Closed `sanverse.motion-scene/v1` validator checks hierarchy, cycles, effects, masks, animatables, exposures, bindings and layout refs | Continue fail-closed policy |
| Arbitrary exact-tick evaluation | READY | Pure evaluator receives exact local ticks | None for C0 |
| Repeated/backward/random seek equality | READY | Executable C0 test across all five scenes | None for C0 |
| Layer tree projection | READY | `deriveLayerTree` is a view over the same scene | C3 builds UI only |
| Node/effect processing projection | READY | `deriveNodeEffectRelationships` is derived from node records | C6 grows processing semantics only when graph supports them |
| Timeline track projection | READY | `deriveTimelineTracks` reads the same animatables/effect parameters | C2/C4 add operations/UI; no second keyframe store |
| Keyframe data structure | READY structurally | `Animatable<T>` already includes keyed values and evaluator support | Full professional keyframe operations are C2 |
| Binding structure | PARTIAL / future | Bound values exist and deterministic evaluation is tested | C8 expands deterministic binding operations/cycle UX |
| Duplicate node | MISSING | No universal graph operation yet | C1 |
| Rename node | MISSING | Node `name` is serializable but there is no operation contract | C1 |
| Group / ungroup | MISSING | Group nodes exist; no universal operation contract | C1 |
| Mask reorder | MISSING | Ordered mask storage exists; no reorder patch/operation yet | C1 |
| Typed operation errors/results | MISSING | Patch API throws `RangeError` | C1 |
| Atomic graph transactions | MISSING | Sequential patches operate immutably, but no typed all-or-nothing result contract | C1 |

## Structural mutation proof

Starting published Cost / Value scene:

```text
Cost / Value Card
├── Surface
├── Title
├── Comparison
│   ├── Cost
│   ├── Direction Indicator
│   └── Value
└── Footer
```

C0 applies graph APIs only:

```text
add-node
  cost-card.value.secondary-number
  parent = cost-card.value

remove-node
  cost-card.direction-indicator

add-effect
  cost-card.value -> glow

add-mask
  cost-card.value -> rounded-rectangle
```

Result:

```text
Cost / Value Card — derived C0 proof
├── Surface
├── Title
├── Comparison
│   ├── Cost
│   └── Value
│       ├── Value Surface
│       ├── Value Label
│       ├── Value Number
│       ├── Value Note
│       └── Secondary Value        NEW
│
│       Effect: Glow              NEW
│       Mask: Rounded Rectangle   NEW
└── Footer

Direction Indicator              REMOVED
```

The derived scene:

- contains the new secondary value node,
- contains no direction-indicator node,
- adds the new node to the existing `value` semantic part,
- removes stale direction-indicator semantic references,
- validates as `sanverse.motion-scene/v1`,
- passes `validateCompositorReadiness`,
- derives a valid Layer tree,
- derives Glow in the node/effect view,
- survives JSON serialization,
- evaluates identically at the same exact tick twice.

No Cost / Value React JSX was rewritten for this proof.

## Blocking gap fixed

`MOTION-FAIL-003` documents the C0 blocker.

Before the fix, `remove-node` only changed `nodes` and group child IDs. Published components also reference nodes from semantic parts, exposures and responsive layout metadata, so removing a semantically addressed node produced an invalid graph.

C0 correction:

- inserted nodes inherit semantic coverage from their parent part(s),
- inserted root-level/custom nodes receive a bounded custom semantic part when there is no parent coverage,
- removed subtrees are pruned from semantic parts,
- empty semantic parts are removed,
- exposures targeting removed nodes/effects/parts are pruned,
- layout ownership/format overrides targeting removed nodes are pruned,
- the resulting graph is still validated before it is returned.

Validation was not weakened.

## C0 conclusion

Layer, Node/Effect and Timeline views can remain projections of **one Motion Graph**. No separate authoritative LayerModel, NodeModel or TimelineModel is justified.

The correct next milestone is C1: replace ad-hoc patch calls at UI boundaries with a closed, typed, immutable universal operation vocabulary, typed failures/results, deterministic ID remapping and atomic transactions.
