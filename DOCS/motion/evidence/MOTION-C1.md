# MOTION-C1 — Universal Motion Graph Operations

Date: 2026-08-08
Branch: `motion-program-p0-c1`
Parent C0 commit: `1f655c8f6ca67a0c14ae75b19c98bfc5e66fd9ea`

## Goal

Create one typed immutable edit vocabulary that future manual compositor UI, undo/redo, derived components and Plan-B AI proposals can share without creating separate authoritative Layer, Node or Timeline state.

C1 does **not** add AI behavior, production `apps/web` integration, a polished compositor, keyframe UI, 3D, particles, tracking or shaders.

## Universal operation contract

`packages/motion-graph/src/operations.ts` exports a closed `MotionGraphOperationV1` union with 21 operation types:

### Property

- `set-property`
- `reset-property`

### Nodes / hierarchy

- `add-node`
- `remove-node` with explicit V1 `mode: 'subtree'`
- `duplicate-node`
- `rename-node`
- `reparent-node`
- `reorder-node`
- `group-nodes`
- `ungroup-nodes`

### Effects

- `add-effect`
- `remove-effect`
- `duplicate-effect`
- `reorder-effect`
- `set-effect-property`
- `set-effect-enabled`

### Masks

- `add-mask`
- `remove-mask`
- `reorder-mask`
- `set-mask-property`

### Compositing

- `set-blend-mode`

Every operation carries a stable caller-provided `operationId`. Operation IDs are audit/history/debug identity only; they do not participate in visual-time evaluation.

## Result / error contract

C1 adds:

- `MotionOperationResultV1`
- `MotionOperationSuccessV1`
- `MotionOperationFailureV1`
- `MotionOperationErrorV1`
- closed `MotionOperationErrorCodeV1`
- `validateMotionGraphOperation`
- `applyMotionOperation`
- `applyMotionOperations`

Successful results return:

- a new immutable scene,
- affected node IDs,
- inverse-operation readiness where the operation is currently losslessly invertible.

Failures are typed and fail closed. Unknown nodes, properties, blend modes, effect parameters, invalid mask geometry, duplicate IDs, root-protected edits, bad indices and hierarchy cycles are refused rather than coerced.

## Transaction semantics

`applyMotionOperations(scene, operations)` is an all-or-nothing transaction from the caller's perspective:

- each step evaluates against a private immutable intermediate scene,
- if all operations succeed, the final scene is returned,
- if any operation fails, the result is `BATCH_FAILED` with the failed index and underlying typed cause,
- the caller's input scene is unchanged and no partial scene is returned.

This is the contract future manual multi-edits and AI proposal bundles can share.

## Deterministic duplication

`duplicate-node` duplicates a complete subtree and deterministically remaps:

- node IDs,
- descendant IDs,
- effect IDs,
- mask IDs,
- nested component-instance IDs,
- semantic-part membership.

The operation payload remains JSON-serializable. Tests may inject a deterministic application-time ID factory through `MotionOperationApplyOptionsV1`; no function or wall-clock state is embedded into the operation object or render graph.

## Inverse readiness

C1 does not implement a production history stack, but successful operations return inverse operations where they are losslessly available, including:

- set/reset property,
- add node,
- duplicate node,
- rename,
- reparent,
- reorder,
- grouping,
- add/remove/duplicate/reorder effect,
- effect enabled/property changes,
- add/remove/reorder mask,
- mask property changes,
- blend mode changes.

Destructive subtree removal and ungrouping currently return `inverseOperations: null` where a complete lossless inverse snapshot is not represented by the V1 operation contract. This is explicit rather than pretending undo is complete.

## Low-level patch layer

The existing `MotionGraphPatchV1` layer remains an internal/backward-compatible mutation primitive. C1 added the missing low-level mechanics required by universal operations:

- `rename-node`,
- indexed mask insertion,
- `reorder-mask`.

Motion Lab no longer stores or emits patch state. It uses universal operations.

## Native runtime

`MotionComponentHost` now accepts `graphOperations` in addition to legacy `graphPatches`.

For graph-backed modules it:

1. creates the component scene,
2. applies legacy patches if supplied,
3. applies universal graph operations,
4. fails if an operation is invalid,
5. evaluates the resulting scene at the requested exact tick,
6. exposes that resolved graph to the component presentation context.

A native-runtime test proves a `set-property` operation changes the graph value observed by a component through `useResolvedMotionNode`.

## Motion Lab migration

Motion Lab now stores `readonly MotionGraphOperationV1[]` instead of `MotionGraphPatchV1[]`.

The same operation path is used by:

- schema-driven node property exposures,
- semantic-part property edits,
- Advanced effect controls,
- Advanced masks,
- blend modes,
- the C1 developer operation playground,
- the component preview host.

Semantic-part edits that target several nodes are prevalidated as one bounded atomic operation batch.

### Developer operation playground

Advanced mode includes a deliberately small developer-only panel with:

- Add child text
- Duplicate
- Delete
- Add Glow
- Add Blur
- Add Mask
- Move Up
- Move Down

Every button emits `MotionGraphOperationV1`. The playground does not mutate scene objects directly and is not presented as production compositor UX.

## Browser evidence

Strict development URL:

`http://127.0.0.1:2010/?component=kinetic-headline&ratio=16%3A9&level=advanced&tick=1296000`

Evidence files:

- `motion/visual-baselines/c1-operation-playground-initial.png`
- `motion/visual-baselines/c1-operation-playground-edited.png`

Real headless Microsoft Edge interaction proof executed the rendered controls:

1. selected the root Layer entry,
2. clicked **Add child text**,
3. selected the rendered Background layer,
4. clicked **Duplicate**,
5. clicked **Add Glow**,
6. clicked **Add Mask**,
7. clicked **Move Down**.

Observed after those real UI operations:

- exact tick remained `1,296,000`,
- selected node remained `kinetic-headline.background`,
- Layer view contained `Lab Text 1`,
- Layer view contained `Background Copy`,
- selected rendered Background had a real computed Glow `drop-shadow(...)` filter,
- selected rendered Background had a real SVG mask image,
- Node / effect debug showed `glow` and `mask ← rectangle`,
- no typed operation error was displayed,
- stage and transport remained visible while Advanced/operation controls were in use.

The browser's usual Edge VBS/task-manager diagnostics are environment noise already known from Plan A and did not prevent rendering or interaction.

## Mechanical tests

Final seven-workspace C1 gate immediately before commit:

- `@sanverse/motion-contract` — 3/3
- `@sanverse/motion-primitives` — 25/25
- `@sanverse/motion-graph` — 49/49
  - existing graph tests: 30
  - universal operation tests: 19
- `@sanverse/motion-native-runtime` — 3/3
- `@sanverse/motion-testing` — 5/5
- `@sanverse/motion-library` — 109/109
- `@sanverse/motion-lab` — 11/11

**Total: 205/205 tests passed.**

All seven Motion workspace production builds passed in the same gate.

## Local performance measurement

Measured after warm-up on this development machine. These are local engineering measurements, **not universal frame-time or product-memory guarantees**.

Test batch on a Cost / Value Card:

- duplicate Value subtree,
- add Glow,
- add rounded-rectangle mask,
- set duplicate opacity.

Operation measurement:

- 4 operations per batch,
- 2,000 batches,
- total: 2,690.671 ms,
- average batch: 1.3453 ms,
- average operation: 0.3363 ms.

Post-edit exact scene evaluation:

- 10,000 evaluations,
- total: 2,306.619 ms,
- average: 0.2307 ms.

Measured edited graph:

- 23 nodes,
- 1 effect,
- 1 mask,
- 0 keyframes.

Process RSS during the local measurement:

- before: 117,010,432 bytes,
- after operation loop: 117,153,792 bytes,
- after evaluation loop: 117,379,072 bytes,
- operation-loop delta: 143,360 bytes,
- total observed delta: 368,640 bytes.

Process RSS includes Node/V8 runtime, JIT and garbage-collection noise. It is not treated as a product memory budget.

A synthetic headless-browser FPS number is intentionally not reported because background/headless `requestAnimationFrame` scheduling is not representative of interactive preview performance. C1 instead records exact operation/evaluation cost and real-browser interaction/visual evidence.

## Failure discovered during C1

`MOTION-FAIL-004`:

The first C1 operation test run passed 48/49. `reorder-mask` had been added to the typed contracts but its low-level patch dispatcher branch was missing, so the operation left mask order unchanged. The failing assertion was preserved, indexed mask insertion/reordering was implemented, and the complete graph suite then passed 49/49.

## Production / Plan B isolation

C1 changes only Motion-owned code/docs/evidence plus no unrelated production editor source.

- `apps/web` source changed: **NONE**
- production Motion imports added: **NONE**
- Plan B AI selection/planning/placement/editing logic: **NONE**

## C1 conclusion

C1 establishes the shared edit vocabulary required for future C2 keyframes, C3 Layers, C4 Timeline, C6 Node view, C10 derived components and later Plan-B AI proposals without fragmenting Motion state.

Future interfaces should create typed Motion Graph operations rather than mutate scene objects directly.
