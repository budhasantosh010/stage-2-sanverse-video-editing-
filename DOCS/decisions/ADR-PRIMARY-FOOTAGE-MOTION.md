# ADR — Primary-footage motion is source-anchored with a stable motion identity

- Status: Accepted and implemented in P1-F.0
- Date: 2026-08-01
- Builds on: ADR-005 and ADR-008
- Starting commit: `796f79970f29f316e8fb2dd19b757b0e241de4cd`

## Question

How should a punch-in or reframe be identified and timed so it remains attached to the spoken moment after the user splits, trims, removes, or reorders primary footage?

## Options considered

### A. Extend `set-visual-properties` to accept clip IDs

This reuses the existing visual operation but changes its identity meaning from “an authored overlay visual” to “sometimes a composition clip.” A split gives the right half a new clip ID, so the motion either stays only on the left half or needs hidden duplication rules. A later trim or reorder would also make the motion depend on a temporary composition object rather than the original spoken moment.

**Rejected.** It mixes two identity systems and makes split semantics implicit.

### B. Add a clip-ID-based `set-clip-motion`

This gives primary motion its own operation but still anchors it to a temporary clip instance. Split would require copying or dividing the operation. Trim through the motion would require silently retiming its keyframes or introducing clip-history translation. Repeated appearances of the same source would carry independent motion even when they show the same source moment.

**Rejected.** The operation would follow editing containers instead of source content.

### C. Add source-anchored `set-footage-motion` with stable `motionId`

The operation names one video asset and one half-open interval on that asset's immutable source timeline. It carries a complete bounded transform, crop, and keyframe state. Later operations with the same `motionId` repair that state. `placeSourceSpan` maps the source interval to every surviving composition placement.

**Chosen.** It matches ADR-005: motion made for a spoken moment follows that moment.

## Canonical contract

```text
set-footage-motion
├── operationId
├── capabilityId = sanverse.footage.motion.primitive/v1
├── motionId
├── assetId
├── sourceInterval
├── transform
├── crop
├── tracks
└── extensions
```

The operation is full-state, not a partial patch.

P1-F.0 permits:

- normalized X/Y translation;
- uniform scale;
- rotation;
- four-sided crop;
- bounded tracks for those properties;
- existing linear, cubic-Bezier, spring, and bounce easing.

P1-F.0 fixes primary opacity at 1 and exposes no layer, mask, effect, or entrance/exit transition controls.

## Timing anchor

- `sourceInterval` is measured on the immutable source asset.
- Keyframe `at` values are relative to the start of that source interval.
- Every value uses the project's 1,440,000-tick `MediaTime` clock.
- Evaluation input is an explicit source time.
- Outside the interval, the evaluator returns the default wide state.

## Overlap policy

For one video asset and one source moment, at most one effective motion may exist.

- Repairs with the same `motionId` replace the previous full state and may change its interval.
- Different effective motion IDs may not overlap on the same asset.
- Touching half-open boundaries are allowed.
- Overlap is refused explicitly; operation order is not an undocumented composition rule.

User-facing refusal:

> This footage already has motion over part of that interval. Edit the existing motion or choose a different range.

## Split, trim, remove, gap, and reorder semantics

### Split

A split does not rewrite the operation. Each surviving placement receives only the source portion it carries. The exact half-open split boundary belongs to the right source span and is evaluated once.

### Trim before the interval

The motion moves earlier in composition because the source moment moves earlier. Stored source and keyframe times do not change.

### Trim through the interval

Removed source time produces no frames. Surviving source time keeps its original source-relative evaluation. Keyframes are not silently retimed.

### Remove all motion footage

If no part of the source interval survives, the change set is blocked with the existing source-span-removed policy. The motion is never relocated.

### Gap-preserving removal

The gap is black and silent. No source exists there, so no motion is evaluated over it.

### Ripple removal

Later source placements shift in composition; the source-anchored motion shifts with them.

### Reorder

The source placement moves, and its motion moves with it.

### Repeated source placements

The same source moment deliberately receives the same motion in every surviving placement. This is deterministic and follows source content. Independent motion for repeated placements requires a future explicit placement-anchor model; P1-F.0 does not invent one.

### Undo, Redo, and selective deactivation

All motion changes are ordinary change sets. Undo reveals the previous folded motion state, Redo restores it, and deactivating one change set recomputes folding and overlap from active accepted history.

## Remove/reset decision

P1-F.0 removes motion by submitting a full-state repair to the default wide transform/crop with no tracks. The operation remains an explicit historical repair under the same `motionId`.

This is truthful because the effective state is exactly “no visible motion.” It avoids adding a second removal operation family. The consequence is that a no-op motion identity remains in history; the UI and Timeline treat the default state as no active Motion indicator. Undo restores the previous visible motion in one step.

## Schema and compatibility decision

### Project schema

No project-schema change is required. The project still stores assets, imported composition, and versioned change-set records. It gains no field.

### Operation schema

No operation-schema bump is required. This repository has previously expanded the closed operation-kind registry without rewriting every existing operation. The existing `sanverse.operation/v3` envelope already carries kind-specific closed validation. Existing P1-E.1 projects contain no new kind and deserialize byte-for-byte into the same domain values.

### Render-plan schema

The render plan must move from v5 to v6 because each source segment gains renderer-neutral footage-motion state. Render plans are derived artifacts, not persisted project authority, so no saved-project migration is required.

### Compatibility guard

Existing projects compile with an empty `footageMotions` list on every segment and otherwise identical segment, overlay, visual, music, and audio values. Tests must prove this.

## Authority

```text
EditProject + accepted change sets
  → project evaluation
  → effective footage motions
  → source-to-composition placement
  → render-plan source segments
      ├── browser preview
      ├── Timeline indicator
      ├── Inspector/Canvas draft source
      └── FFmpeg export
```

Timeline, Inspector, and Canvas do not own accepted motion. Pointer movement edits one detached draft. Apply or pointer completion sends one typed operation through the existing App/server revision fence.

## First-order consequence

- Domain gains one operation, validator, folder, evaluator, overlap policy, and capability.
- Render segments carry footage-motion state.
- Browser and FFmpeg consume the same conceptual state.
- Timeline, Inspector, and Canvas expose one new primary-footage editing slice.

## Second-order consequence

- Cuts, trims, gaps, and reorder do not rewrite motion operations.
- Selection stays the existing V1 Timeline item.
- One repair is one change set and one Undo.
- A split may make one motion appear in more than one concrete render segment without duplicating canonical operations.

## Third-order consequence

- Future speed changes must explicitly map source time through rate rather than replacing the source anchor.
- General multitrack must decide whether repeated placements need optional placement-specific overrides.
- Templates can store inspectable source-relative motion recipes.
- Project migration remains isolated because canonical project shape is unchanged.

## Fourth-order consequence

- AI planners can propose a stable motion ID and source interval without mutating a clip graph.
- Cloud render workers receive a deterministic render plan with no React or local-path dependency.
- Collaboration can merge or conflict on stable motion IDs and explicit overlap instead of hidden clip copies.
- Large projects can index effective motions by asset and interval rather than rescanning UI state per frame.

## Regression and acceptance tests

Required proof includes:

- structural and contextual operation validation;
- overlap refusal and same-ID repair;
- deterministic folding and immutability;
- split/trim/remove/gap/ripple/reorder consequences;
- Undo/Redo and selective deactivation;
- existing-project compatibility;
- render-plan, browser, and FFmpeg parity;
- one main video, one completed gesture/one revision, and no request during movement.

## Rollback boundary

Before P1-F.0 changes, the clean pushed baseline is:

`796f79970f29f316e8fb2dd19b757b0e241de4cd`

The Harness checkpoint is `cp-20260801-100229-34a4`.
