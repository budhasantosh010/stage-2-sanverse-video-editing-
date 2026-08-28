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

Status: **COMPLETE — PRODUCTION INTEGRATION, REAL EDGE WORKFLOW, FULL MATRIX, ROOT BUILD AND HYGIENE GREEN; SEALED LOCALLY BY `sanverse-production-editor-creative-engine-v1.6`.**

V1.6 starts exactly from V1.5 commit/tag `7325be5a6bac0cfd755dcf15db7852639a67f11e` / `sanverse-creative-engine-v1.5` and integrates existing Creative Engine authorities into production `apps/web`. It does not create another accepted-project model, history/Undo stack, animation clock, Motion Graph, preview renderer, export renderer, approval store or MCP project authority.

## Production adaptation seam

- New package `@sanverse/creative-production-adapter` depends on existing `@sanverse/edit-domain`, `@sanverse/motion-agent-tools`, `@sanverse/motion-contract`, `@sanverse/motion-graph` and `@sanverse/motion-library` authorities.
- Production source resolution is revision-bound and uses the canonical 1,440,000-tick timebase. V1.6 currently accepts the bounded forward-1× primary-source timing shape and refuses unsupported source transforms rather than guessing.
- The Library surface reports all **99** canonical entries. **Kinetic Headline** is the one lossless native production adapter in V1.6; the remaining **98** are explicitly `creative-preview-only` because the current production edit/render schema cannot losslessly serialize an arbitrary Motion Graph scene.
- A supported approved candidate becomes exactly one ordinary production change set containing `add-title` + `set-visual-properties`, with AI provenance plus `sanverse.creative/lineage` metadata. The existing server-authoritative change-set endpoint remains the only production apply authority.

## Closed-loop production workflow

- Storyboard/KVS, exact-tick Animatic, Motion Forge and Motion Review reuse the existing closed-loop engine and revision-bound approval truth.
- C3 Layers, C4 dope sheet, C5 curves and C6 node graph are projected from the same canonical candidate scene; one semantic node ID is shared across all four views.
- A manual C5 preset edit uses canonical Motion Graph operations. Any graph change creates a new candidate/workflow state and invalidates old Storyboard/Animatic/Motion approvals before production apply can become available again.
- The production UI keeps Program Canvas as the one read-only source preview, reuses the existing production Timeline, and keeps the Creative controller mounted across Studio workspace switches.
- One accepted Creative result is one history action. Focused App/server integration proves one Undo removes both generated production operations and one Redo restores both; the accepted result survives reopen.

## AI rail and MCP safety

- The production Creative AI surface exposes the existing internal tool registry; it does not implement a second tool authority.
- The production-fenced MCP registry wraps the same Creative workflow engine used by UI, supplies production project/revision context, and requires the live production revision for mutating tools.
- A stale production revision returns `STALE_PRODUCTION_REVISION` before sandbox mutation.
- The production MCP surface deliberately omits isolated `apply_approved_sandbox` and `undo_last_creative_merge`; accepted-project apply/Undo remains the production editor/server authority.

## Preview/export, ratios and recovery

- Production preview/export parity is proved through the existing canonical render-plan compiler at exact checkpoints; Creative production output does not bypass that authority.
- 16:9, 9:16, 1:1 and 4:5 projects all build the same exact-tick Creative scene, preserve C3–C6 semantic selection and compile to the correct production export dimensions.
- Explicit recovery gates cover no active source, unsupported source timing, stale production revision, stale MCP revision and failed production apply. All fail closed without corrupting the Creative sandbox or production project.
- Real browser verification found and fixed a low-resolution Kinetic Headline font-bound defect at 640×360. The canonical component now scales its minimum safely without changing higher-resolution behavior.
- Real browser inspection also found and fixed two production UX issues: Creative text was using a nonexistent light-theme token, and export completion/download could be hidden inside a collapsed AI panel. Creative now uses the production ink token, and global EditorShell export status/download remains reachable independently of AI-panel collapse.

## Real Microsoft Edge production proof

Retained evidence: `DOCS/evidence/2026-08-28-creative-engine-v16-production/`.

The decisive native Edge/CDP workflow uses a temporary synthetic-real MP4 (**640×360**, **6.000 s**) and proves:

- source loaded into the real production app;
- Creative workspace active over the same production editor;
- manual C5 `snappy` edit;
- stale approvals discarded;
- Storyboard, Animatic and Motion explicitly reapproved;
- one atomic production change set with `add-title` + `set-visual-properties` and Creative lineage;
- revision after apply **1**, after Undo **2**, after Redo **3**;
- accepted Creative result persisted after reload/reopen;
- desktop **1440×900**, tablet **1024×768** and mobile **390×844** all have no horizontal overflow, exactly one video and reachable Creative controls;
- real production export succeeds and the completion/download is visible globally;
- exported MP4: H.264 High + AAC LC stereo, **640×360**, **30 fps**, **6.000 s**, **858,823 bytes**, SHA-256 `653afd857d0fc4d3441c9486dfac564af9d18e4503c80f45c6f1b96287ce12ef`;
- console errors **0**;
- network failures **0**;
- bad HTTP responses **0**.

Retained screenshots:

1. `01-creative-c5-edited.png`
2. `02-creative-applied.png`
3. `03-desktop-1440x900.png`
4. `03-tablet-1024x768.png`
5. `03-mobile-390x844.png`
6. `04-export-ready.png`

## V1.6 final seal gate

Status: **GREEN — LOCAL RELEASE SEALED**

Final release-candidate verification:

- authoritative full repository Windows single-fork regression: **2,950 / 2,950 PASS across 25 workspaces**;
- production `apps/web`: **1,238 / 1,238 PASS**;
- `@sanverse/creative-production-adapter`: **12 / 12 PASS**;
- API: **403 / 403 PASS**;
- edit-domain: **488 / 488 PASS**;
- Motion Graph: **139 / 139 PASS**;
- Motion Library: **202 / 202 PASS**;
- Motion MCP: **18 / 18 PASS**;
- render-contract: **119 / 119 PASS**;
- root all-workspace production build: **PASS / exit 0**;
- `git diff --check`: **PASS**;
- `sites/**` diff: **0**; separate repository preserved;
- raw user/source media or generated export additions: **0**;
- secret-like additions: **0**;
- forbidden parallel-authority scan: **0 real matches**; one lexical scan hit is the canonical `1_440_000`-timescale test fixture itself;
- no GitHub remote/PR/Actions operation;
- immutable local release pointer: `sanverse-production-editor-creative-engine-v1.6` on the coherent V1.6 release commit.

V1.6 is the stop point for this task. Do not start any later Creative Engine milestone from this release task.
