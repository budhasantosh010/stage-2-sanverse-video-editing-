# Sanverse Creative Engine V1.1 — Promotion, Parameterization & Reuse Flywheel

Status: **COMPLETE — LOCAL RELEASE READY**
Date: **2026-08-26**

## START / RELEASE BOUNDARY

- Branch: `motion-program-p0-c1`
- Start SHA: `bbc4553667a8c825d75a07f6dbc6bc823ac432a9`
- Start tag: `sanverse-creative-engine-closed-loop-v1-mcp-v1`
- Start rollback checkpoint: `cp-20260826-133811-993b`
- `apps/web/**` start diff: **0 files**
- pre-existing `sites/`: **separately versioned untracked repository; preserved and excluded**
- GitHub push/fetch/PR/Actions: **not performed**

## ARCHITECTURE RESULT

V1.1 adds a promotion/reuse flywheel without creating a second visual or project authority.

Reused authorities:

- `MotionSceneV1` / `MotionGraphOperationV1`
- canonical 1,440,000 ticks/second clock
- C3 Layers, C4 Dope Sheet, C5 Curves, C6 Node Graph
- Storyboard/Animatic/MotionPlan/Motion Forge
- revision-bound `OwnerApprovalV1`
- existing accepted-project merge + inverse Undo
- existing Creative Library/B2 capability model
- `SanverseToolRegistryV1`
- existing thin MCP adapter

New narrow domain:

- `@sanverse/motion-promotion`: promotion contracts/workspace, parameterization, classification/productization, Motion Recipe extraction, lineage/rights/QA/atomic registration.

No PromotionGraph, renderer, keyframe engine, timeline, Library registry, project store or Undo authority was added.

## BASELINE

Before V1.1 edits, the previous Closed-Loop V1 + MCP V1 release was reverified:

- affected matrix: **525/525 PASS**
- root all-workspace build: **PASS**
- `apps/web/**`: **0 diff**

## BATCH 1 — PROMOTION CONTRACTS + ISOLATION

Status: **COMPLETE**

Implemented and proved:

- promotion source requires the exact existing motion `OwnerApprovalV1`
- stale approval refuses before candidate creation
- source structural QA and visual-review evidence are mandatory
- candidate retains source project/scene/revision/approval lineage
- isolated revisioned promotion workspace
- atomic revision-fenced transactions
- idempotency key prevents duplicate application
- invalid/stale transactions leave workspace unchanged
- discard returns the accepted source scene unchanged

## BATCH 2 — CONSERVATIVE PARAMETERIZATION

Status: **COMPLETE**

Implemented:

- content/media/style/layout/motion/behavior vocabulary
- visible text/media and semantic accent extraction
- meaningful `motion.intensity` only when numeric transform tracks support it
- semantic node/property bindings; no DOM/CSS-selector bindings
- confidence + rationale + affected semantic node IDs
- Creator / Designer / Advanced exposure mapping
- accept/reject/edit review states
- non-parameterized design constants explicitly frozen

Project-A proof exposes reusable content/headline/metric/supporting text/media/accent/motion intensity while freezing 29 design properties.

## BATCH 3 — CLASSIFICATION + PRODUCTIZATION

Status: **COMPLETE**

Implemented:

- classification into component/scene/motion-recipe/effect/preset opportunities
- reusable graph template over the source canonical `MotionSceneV1`
- canonical default fixture
- typed parameter definitions + constraints + exposure map
- semantic Style Lock mapping
- Project-B instantiation through ordinary Motion Graph operations
- unknown parameter/type/constraint failures refuse closed

Default promoted instance preserves source semantic node IDs and pixels/evaluation under the canonical fixture.

## BATCH 4 — MOTION RECIPE EXTRACTION

Status: **COMPLETE**

Implemented role-based `PromotedMotionRecipeV1` over existing `MotionPlanV1`:

- `HEADLINE`
- `PRIMARY_HERO`
- `SUPPORTING_ITEMS`
- `PAYOFF_METRIC`

Recipe application binds semantic roles to Project-B node IDs and returns a normal `MotionPlanV1`; source node IDs are not baked into the recipe.

## BATCH 5 — LINEAGE / RIGHTS / QA / REGISTRATION

Status: **COMPLETE**

Implemented:

- immutable promoted lineage back to source project/scene/revisions, MotionPlan, approval, candidate, parameterization plan and dependencies
- origin and reuse status remain separate
- generated source stays `origin = generated`
- registered capability becomes `reuseStatus = promoted-reusable`
- rights aggregate to the most restrictive dependency (`global < project-only < blocked`)
- runtime-owned dependency requirement
- default parity, replacement validity, frozen-property, semantic-ID and direct-seek QA
- registration refuses before QA + exact registration confirmation + review artifacts + global rights
- registration is atomic and versions cannot silently overwrite

## BATCH 6 — LIBRARY + B2 + PROJECT A → PROJECT B

Status: **COMPLETE**

`@sanverse/motion-library` adds only a promoted-capability adapter/view; the static 99-component registry is not duplicated.

B2 metadata includes independent `origin` and `reuseStatus`. Ranking is deterministic and explains results; promoted/generated items receive no automatic “newest wins” privilege.

Mandatory registry-driven reuse proof passes:

```text
Project A approved generated Motion scene
  → promotion candidate
  → parameterization
  → productized scene + role-based Motion Recipe
  → promotion QA
  → atomic registration
  → B2 ranks the promoted capability with reasons
  → Project B reuse sandbox
  → replace headline/value/supporting text/style
  → apply extracted Motion Recipe
  → C3/C4/C5/C6 preserve semantic identity
  → direct/backward/repeated seek parity
  → exact reuse approval
  → ONE accepted-project merge
  → ONE inverse Undo restores original Project B
```

The same proof rejects stale Project-B sandbox mutations and forged/stale reuse approval.

## BATCH 7 — INTERNAL TOOLS + MCP V1.1

Status: **COMPLETE**

The existing internal registry is extended rather than replaced:

- prior Closed-Loop tools: **17**
- promotion/reuse tools: **20**
- combined registry: **37 tools**

Promotion/reuse tools cover context/candidate/parameterization/productization/recipe/QA/registration/retrieval/reuse sandbox/parameter/style/recipe/validation/review/approval/apply/undo/discard.

MCP continues to expose the registry generically. It owns no promotion, Library, project, approval or Undo state.

MCP safety proof:

- real combined registry is exposed through `tools/list`
- fake client source-approval JSON cannot manufacture a promotable source
- reuse-approval tools still require host-resolved opaque owner-approval proof
- existing sandbox and registry validation remain authoritative

## BATCH 8 — DEVELOPMENT REVIEW + REAL EDGE 1× PROOF

Status: **COMPLETE**

Development-only route: `/promotion-review`

Visible truth includes:

- Project A approved source
- promoted-default parity fixture
- Project B reused/adapted scene
- parameterization + frozen-property status
- classification + Motion Recipe
- immutable lineage
- Library status (`REUSABLE`, `origin: GENERATED`, `QA: PASSED`, `editability: FULL`)
- C3/C4/C5/C6 deep-editability markers

Real Microsoft Edge/CDP evidence: `motion/visual-baselines/promotion-v1.1/`

Observed runtime evidence:

- speed: **1×**
- final tick: **7,200,000 / 7,200,000**
- captured screencast frames: **80**
- source preview present: **true**
- promoted-default preview present: **true**
- Project-B preview present: **true**
- source preserved: **true**
- default preserved/parity: **true**
- adapted Project-B content: **true**
- graph backed: **true**
- semantic node `cost-card.value` visible: **true**
- origin: **generated**
- reuse status: **promoted-reusable**
- deep editability: **true**

Manual frame inspection:

- entrance begins from the intended dark/hidden state
- middle/payoff visibly shows Project B as `Retention compounds faster`, `82%`, with the adapted orange semantic accent
- Project-A source and promoted-default remain unchanged above it
- exit resolves cleanly to black at 5.00 seconds
- no clipping/broken layout was observed

### Browser-found defect fixed

`MOTION-FAIL-027` was found by the first Edge run: the canonical Project-B graph contained the new title, but `CostValueCard` still rendered title/metric-label strings from original props. The browser audit was rejected.

Fix: resolved Motion Graph text is now the display authority for title/metric-label/note/eyebrow/footer paths, and graph-edited title/labels are re-fit through the existing responsive text-fit algorithm. A dedicated regression test fails on the old behavior and passes on the fix.

## FINAL ACCEPTANCE MATRIX

Fresh final affected matrix on the release tree:

| Package | Tests |
|---|---:|
| video-understanding | 17 |
| creative-direction | 34 |
| motion-contract | 5 |
| motion-primitives | 29 |
| motion-graph | 136 |
| motion-native-runtime | 4 |
| motion-testing | 5 |
| motion-external-bridge | 9 |
| motion-storyboard | 14 |
| motion-promotion | 17 |
| motion-agent-tools | 10 |
| motion-mcp | 8 |
| motion-library | 199 |
| motion-lab | 60 |
| motion-ingest | 4 |
| **TOTAL** | **551 / 551 PASS** |

Root all-workspace production build: **PASS / exit 0** on the documented release tree.

Known non-blocking baseline warnings remain unchanged: Motion Lab/web Vite large-chunk warnings and the production web runtime-resolved nameplate-font warning.

## RELEASE HYGIENE

Verified before staging:

- root all-workspace build: **PASS**
- `git diff -- apps/web`: **0 files**
- `sites/`: separate/untracked and excluded from V1.1
- no GitHub push/fetch/PR/Actions performed
- local release tag target: `sanverse-creative-engine-promotion-reuse-v1.1`

Final staged review: **PASS**. The release staging set contains 55 files; `apps/web/**` contributes 0 files, `sites/` contributes 0 files, raw audio/video extensions contribute 0 files, the added-line secret scan found 0 matches, and `git diff --cached --check` passed. The only staged binaries are retained browser evidence PNG/JPG files under `motion/visual-baselines/promotion-v1.1/`.

The exact final commit SHA is intentionally not embedded in this file because changing the file would change that SHA. Git/tag verification after the commit is the authority for the release identifier.

## OUT OF SCOPE / DEFERRED

Not started by this release:

- B6/B7/B8
- C9+
- tracking / 3D / particles / advanced physics
- advanced external adapters (Rive/Remotion/AEP/MOGRT/Three)
- production `apps/web/**` integration
- independent Library redesign
