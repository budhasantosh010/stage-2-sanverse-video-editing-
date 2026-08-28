# SANVERSE Creative Engine V1.5 → Production Editor V1.6 Continuous Program

Status: **V1.5 COMPLETE — FULL REPOSITORY MATRIX, ROOT BUILD, REAL EDGE STRESS/PARITY PROOF AND ISOLATION HYGIENE GREEN; SEALED LOCALLY BY `sanverse-creative-engine-v1.5`. V1.6 UNLOCKS ONLY FROM THAT EXACT TAG.**
Date: **2026-08-28**

## PROGRAM LAW

This is one continuous owner-approved assignment with two independently gated local releases.

1. V1.5 must complete performance maturity and advanced external-bridge foundations while `apps/web/**` remains intentionally unchanged.
2. V1.6 may begin only after V1.5 has no known failed gate, the full repository regression and root build are green, the isolation/hygiene audit is green, a coherent local release commit exists, and immutable local tag `sanverse-creative-engine-v1.5` resolves to that exact commit.
3. V1.6 must start from that exact V1.5 release commit in a dedicated local integration branch/worktree and reuse the existing Creative Engine authorities rather than reimplementing them.
4. No GitHub push/fetch/PR/Actions/release work is part of this program. `sites/creative-library-site` remains separately versioned and excluded.
5. Stop after the V1.6 release/tag and final regression. No later milestone begins automatically.

Canonical authorities remain unchanged: one 1,440,000-tick clock, one `MotionSceneV1`/Motion Graph, one semantic-ID identity system, existing C3/C4/C5/C6/C8 projections/compositing, Storyboard/Animatic/MotionPlan, locks, explicit revision-bound approvals, accepted-project transaction/Undo, Library/promotion/lineage, internal T0/T1/T2 registry, thin MCP adapter and existing QA. Performance evidence and foreign-source inspectors are not render/project authorities.

# V1.5 — PERFORMANCE MATURITY + ADVANCED BRIDGES

## C13 observability and measured optimization

Status: **GREEN**

- Added narrow `@sanverse/motion-performance` evidence utilities. Performance samples/summaries use wall-clock time only for measurement; wall-clock values never calculate visual state, ticks, seeds or export output.
- Added `prepareMotionSceneEvaluatorV15(scene)`: immutable canonical scenes are validated once when a hot evaluator is prepared, then exact-tick preview evaluations reuse that verified scene. One-shot `evaluateScene` keeps the previous validate+evaluate safety contract.
- The deterministic stress fixture contains **524 graph nodes**, including **520 native shape nodes + one root + three bounded Expert nodes**, **2,524 animated properties** and **24 animated masks** over an exact **14,400,000-tick / 10.000-second** duration.
- Stress coverage also exercises ten Sanverse-owned source-aware tracks, 24 camera/depth bindings, procedural/particle/shader Expert evaluation, repeated serialization/reference checks, long-project sandbox/cache cleanup and prepared-preview versus one-shot-export exact-tick parity.

## Expert Runtime budgets

Status: **GREEN**

- Added explicit `LIGHT / MEDIUM / HEAVY / EXTREME` evidence classes based on bounded declared work, primitive ceilings and pixel count.
- Hosts may set maximum class, maximum pixel count and an optional measured-evaluation budget.
- Over-budget expert requests fail closed as `EXPERT_BUDGET_EXCEEDED` before the frame is accepted by the host path.
- Existing canonical Expert spec validation, fixed program vocabulary, explicit seed and exact-tick evaluation remain unchanged.

## Transaction / AI / MCP batching

Status: **GREEN**

- Added `applyMotionPlanAtomicV15`: dependent semantic intents compile against an unpublished scratch scene, then the complete operation set is committed through **one** canonical `applyMotionOperations` batch.
- Any compilation or batch-apply refusal leaves the supplied canonical scene untouched.
- Successful batches require one canonical inverse batch, preserving one-action/one-Undo semantics.
- `ClosedLoopEngineV1.buildMotionDraft` uses this atomic compiler. MCP remains unchanged as a thin generic adapter over the same internal registry/engine, so MCP cannot create a separate batching, project, approval or Undo authority.

## Library scale

Status: **GREEN**

- Added an incremental search/index projection over the existing canonical Library catalog; it is not a second Library registry.
- The scale test indexes/searches **5,000** canonical catalog-shaped entries while current real public registration remains the existing 99-component catalog.
- Existing Library full-playback/review truth, metadata and registration authority remain unchanged.

## Long-project reliability and resource cleanup

Status: **GREEN**

- Added deterministic reference audits, repeated large-scene serialization round-trips and a bounded resource ledger for preview-cache/sandbox/worker-like ownership evidence.
- A 75-cycle long-project lifecycle releases all owned resources; final observed resource count is **0**.
- These ledgers are verification/host-lifecycle helpers only; they do not store canonical project or render state.

## Preview/export parity

Status: **GREEN**

- Prepared preview and one-shot export projections independently evaluate the same canonical graph at exact checkpoints and compare stable resolved output.
- Text parity uses real graph text nodes rather than an empty/vacuous text set.
- The real Edge audit separately captures the prepared-preview and one-shot-export text surfaces and compares their PNG bytes exactly. Current text pixel parity is **PASS**.

## Three/WebGL bridge

Status: **GREEN — BOUNDED/TRUTHFUL, NOT UNIVERSAL**

- Arbitrary Three/WebGL source is inspected as data/text and is never executed by the bridge.
- Inspection reports scene/object signals including geometry/material kinds, textures, cameras, lights, animation clips, custom shaders, runtime dependencies, network use, wall-clock use and uncontrolled randomness when detectable.
- Only the declared deterministic `sanverse.three-subset/v1` plane/circle/basic-material subset can materialize to ordinary canonical Motion Graph shapes/keyframes.
- Depth/textures/cameras/lights that exceed the native subset require flattening; arbitrary runtime code, network/time/random/custom-shader authority rejects. The bridge does not claim complete Three.js/WebGL conversion.

## AEP / MOGRT assisted bridge

Status: **GREEN — EXTRACTION-ASSISTED, NOT UNIVERSAL**

- Raw `.aep` / `.mogrt` payloads require a trusted extraction step; raw bytes are never guessed into canonical state.
- The declared `sanverse.adobe-extract/v1` manifest inspects layers, intended controls, supported transforms/effects/masks/mattes and expression classes.
- Safe supported layers/keyframes and intended controls can materialize into normal Motion Graph nodes/keyframes/exposures.
- Unknown expressions or unsupported features are classified truthfully as unsupported/flatten-required and refuse native materialization rather than silently approximating.

## Focused verification

Status: **GREEN**

Latest focused suites on the V1.5 candidate:

- Motion Graph: **139/139 PASS**
- Motion Agent Tools: **30/30 PASS**
- Motion MCP: **18/18 PASS**
- Motion Expert Runtime: **11/11 PASS**
- Motion External Bridge: **22/22 PASS**
- Motion Performance: **6/6 PASS**
- Motion Library: **201/201 PASS**
- Motion Lab: **66/66 PASS**
- Combined focused total: **493/493 PASS**

Motion Lab and all new/affected package TypeScript builds pass.

## Real Edge C13 stress proof

Status: **GREEN — FRESH ON CURRENT TREE**

Command: `npm run motion:audit-performance-v15`

Current retained evidence: `motion/visual-baselines/performance-v1.5/`.

Fresh run:

- route: `/performance-review`
- playback: **1×**
- start tick: **0**
- wall-clock elapsed: **10,179 ms** for a 10.000-second canonical run
- final tick: **14,400,000 / 14,400,000**
- captured screencast frames: **102**
- full prepared evaluations: **190**
- graph nodes: **524**
- animated properties: **2,524**
- animated masks: **24**
- prepared frame evaluation p95: **10.0 ms**
- prepared frame evaluation maximum: **24.8 ms**
- direct/backward/random seek: **PASS**
- ten-track source-aware seek: **PASS**
- camera/depth seek: **PASS**
- graph preview/export parity: **PASS**
- browser text pixel parity: **PASS**
- long-project resource leaks: **0**
- Expert host budget: **PASS**
- console errors: **0**
- network failures: **0**

Retained full-page and mid-playback frames were manually inspected and are clean/readable with visible temporal progression and matching preview/export text.

## V1.5 final seal gate

Status: **GREEN — LOCAL RELEASE SEALED**

Final release-candidate verification:

- authoritative full repository Windows single-fork regression: **2,930 / 2,930 PASS**;
- protected `apps/web`: **1,231 / 1,231 PASS** with intentional V1.5 source diff **0**;
- root all-workspace production build: **PASS / exit 0**;
- `git diff --check`: **PASS**;
- `apps/web/**` intentional diff: **0**;
- `sites/**` diff: **0**; separate repository preserved;
- raw user/source media additions: **0**;
- secret-like additions: **0**;
- forbidden parallel authority scan: **0 matches**;
- immutable local release pointer: `sanverse-creative-engine-v1.5` on this coherent release commit.

# V1.6 — PRODUCTION EDITOR INTEGRATION

Status: **UNLOCKED ONLY FROM THE EXACT `sanverse-creative-engine-v1.5` RELEASE COMMIT; IMPLEMENTATION MUST OCCUR IN ITS DEDICATED LOCAL INTEGRATION WORKTREE.**

When unlocked, V1.6 must integrate the already-built Creative Engine into `apps/web` through explicit production project/time/adaptation seams. Required surfaces include source-aware context, Library/opportunities, Storyboard/KVS/Animatic/Motion Forge/Motion Review, C3–C6 projections with one semantic-ID selection, contextual properties, existing internal tools through the AI rail/MCP, one atomic production apply compatible with existing Undo/Redo and persistence/reopen, responsive resizable panes, failure recovery and production export parity. The decisive proof is a real Edge end-to-end production workflow followed by the full V1.0→V1.6 matrix/root build and immutable local tag `sanverse-production-editor-creative-engine-v1.6`.
