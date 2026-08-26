# Sanverse Creative Engine — Closed-Loop V1 + MCP V1 Status

Status: **COMPLETE — local release**
Date: **2026-08-26**
Owner requirement: `REQ-016`
Architecture decision: `DEC-014`

## 1. Start / CH1 reconciliation

- Requested worktree entry SHA: `e5f0290c5a47a40a91d4b467494b9fa2878e078c`
- Branch: `motion-program-p0-c1`
- Worktree: `C:\Users\Lenovo\.chatgpt-code-harness\worktrees\Stage 2 Sanverse Editing Workflow-a95ba61b\motion-program-p0-c1`
- `apps/web/**` intentional diff at start: **0 files**

The published CH1 task was complete in its isolated worktree but its verified commits were not ancestors of this requested worktree. The complete verified local chain was replayed before Closed-Loop work:

| Isolated verified commit | Replayed commit | Intent |
| --- | --- | --- |
| `ccac115` | `f446dcd` | Component Ingest V1 foundation |
| `c786b65` | `ccac3cd` | Component Ingest pilot-gate docs |
| `6331ae6` | `5deb0cd` | Integrate approved CH1 component set |
| `2e34240` | `25d2cca` | Record CH1 completion |

Reconciled CH1 baseline HEAD: `25d2cca`.

Pre-existing portable-Library/review-capture Motion Lab edits were preserved. The untracked `sites/creative-library-site` folder is a separately versioned nested repository and is **not** part of this release.

## 2. Baseline before Closed-Loop edits

After CH1 reconciliation and before the Closed-Loop architecture changes:

- `@sanverse/video-understanding`: 17 PASS
- `@sanverse/creative-direction`: 27 PASS
- `@sanverse/motion-contract`: 3 PASS
- `@sanverse/motion-primitives`: 29 PASS
- `@sanverse/motion-graph`: 132 PASS
- `@sanverse/motion-native-runtime`: 4 PASS
- `@sanverse/motion-testing`: 5 PASS
- `@sanverse/motion-library`: 196 PASS
- `@sanverse/motion-lab`: 57 PASS
- `@sanverse/motion-ingest`: 4 PASS
- Baseline affected total: **474/474 PASS**
- Root all-workspace build: **PASS / exit 0**
- `apps/web/**` intentional diff: **0 files**

## 3. One-authority architecture

Closed-Loop V1 reuses these existing authorities:

- exact time: Sanverse `1,440,000` ticks/second;
- canonical visual scene: `MotionSceneV1`;
- canonical deterministic mutations/inverses: `MotionGraphOperationV1` + `applyMotionOperation(s)`;
- C2 keyframes and evaluator;
- C3 Layers;
- C4 Dope Sheet/Timeline;
- C5 Curves;
- existing masks, effects, graph serialization and inverse operations;
- the one typed 99-component Creative Library registry;
- B0 Creative Direction and B1 Video Understanding foundations.

Closed-Loop V1 deliberately does **not** introduce another graph, renderer, keyframe engine, Layer tree, Timeline, Library registry, accepted-project authority or Undo journal.

New packages are narrow boundaries only:

- `@sanverse/motion-storyboard`: Storyboard KVS, Animatic, isolated sandbox, revisions/locks/approval helpers and structural diffs;
- `@sanverse/motion-external-bridge`: foreign-source inspection/materialization, provenance, rights and editability;
- `@sanverse/motion-agent-tools`: UI-independent Closed-Loop engine, T0/T1/T2 registry, semantic Motion compiler, QA/repair/merge lifecycle;
- `@sanverse/motion-mcp`: thin MCP V1 adapter over the accepted internal registry.

## 4. Batch 1 — contracts / C6 / B2 / Library scopes

Status: **COMPLETE**

Implemented:

- eight presentation modes;
- seven source treatments;
- eight background treatments;
- SANVERSE / EXTERNAL / GENERATED / PROJECT Library scopes;
- independent content/style/storyboard/animatic/motion locks;
- common typed validation/operation/refusal results;
- presentation/source capability fail-closed rules;
- canonical KVS / Storyboard V1 contracts backed by `MotionSceneV1`;
- explicit revision-bound `OwnerApprovalV1`;
- C6 node-graph projection preserving canonical node IDs;
- external provenance/rights classes and fail-closed rights gate;
- one typed B2 capability catalog/ranker with deterministic explanations;
- T0/T1/T2 registry contract with deterministic ordering;
- explicit `libraryScope` on the canonical 99-entry Library;
- Motion Lab Library scope filtering.

No renderer or graph duplicate was created.

## 5. Batch 2 — external adapters / isolated Storyboard sandbox

Status: **COMPLETE**

Implemented and proven:

- SVG inspection and bounded lossless materialization to canonical `MotionSceneV1`;
- exact SVG attribute parsing; unsupported/unsafe features refuse instead of approximating;
- bounded Lottie static-shape subset materializes only when it can remain deterministic/canonical; unsupported Lottie features refuse;
- alpha video remains an external exact-time runtime asset rather than pretending to be an editable Motion Graph node;
- explicit provenance / rights / editability metadata;
- Storyboard sandbox mutations are isolated from the accepted project;
- sandbox revision fencing;
- stale-revision refusal;
- Storyboard-lock refusal;
- atomic transaction rollback on invalid operations.

Final external bridge suite: **9/9 PASS**.
Storyboard package at Batch 2: **6/6 PASS + TypeScript build PASS**.

## 6. Batch 3 — Storyboard iteration V1

Status: **COMPLETE**

Implemented:

- typed `MotionOpportunityV1` with exact source ticks, communication goal, recommended presentation/source/background treatment, preservation flags, rationale/confidence and capabilities;
- exact semantic-node KVS graph edits;
- transition inspection and deterministic refinement;
- refinement inserts exactly one intermediate KVS where requested;
- structural Storyboard QA;
- explicit exact-revision Storyboard owner approval;
- Storyboard lock;
- reopen creates a new revision and invalidates the previous approval.

Batch 3 gates: Creative Direction **31/31**, Storyboard **10/10**, builds PASS.

## 7. Batch 4 — Animatic / Storyboard Diff / C8

Status: **COMPLETE**

Animatic owns **when** approved KVS states happen; it does not become a second final-motion engine.

Implemented:

- exact-tick KVS state timing;
- source word/phrase alignment references;
- hold/shift/compress timing operations;
- source-audio + KVS-hold review model;
- play/pause/scrub/loop review semantics;
- time-anchored owner comments;
- structural Animatic QA for gaps/overlaps/bounds/readability;
- exact-revision Animatic approval;
- structural Storyboard Diff between KVS states.

C8 is integrated into the existing Motion Graph:

- optional serialized compositing metadata;
- typed matte relationships;
- matte set/remove through canonical atomic `MotionGraphOperationV1`;
- canonical inverse operation for matte changes;
- existing animated mask inversion/opacity/feather stays exact-tick deterministic under direct/backward/repeated seeks.

Batch 4 gates: Storyboard **14/14 + build PASS**, Motion Graph **136/136 + build PASS**.

## 8. Batch 5 — Motion Forge V1

Status: **COMPLETE**

Implemented:

- inspectable `MotionPlanV1`, `MotionBeatV1`, beat-purpose vocabulary and semantic motion intents;
- complete locked semantic operation vocabulary: **27 operations**;
- Motion Forge requires exact approved Storyboard + Animatic revisions;
- semantic intents compile into the existing Motion Graph keyframe/mask/effect authorities;
- representative enter/fade/move/scale/rotate/draw/mask/stagger/controlled-overshoot paths;
- timing/easing operations refuse when a required keyframed target does not exist instead of inventing one;
- missing nodes/masks/parameters return typed refusals;
- compiled scenes preserve direct/backward/repeated-seek equality.

Batch 5 gates: Creative Direction **33/33 + build PASS**, semantic agent-tool tests PASS.

## 9. Batch 6 — QA / repair / owner loop / atomic merge

Status: **COMPLETE**

Structural Motion QA checks:

- graph validity;
- semantic-ID integrity;
- asset availability;
- required/available capabilities;
- provenance violations;
- lock violations;
- unsupported operations;
- exact-tick evaluation;
- direct/backward/repeated-seek parity.

Visual evidence contract covers:

- canonical 1× review;
- poster;
- critical frames;
- KVS anchors;
- entrance/payoff/exit frames;
- source-composite frames.

Repair lifecycle:

- localized node/beat/exact-tick declaration;
- canonical graph operations only;
- canonical inverse operations retained;
- unrelated nodes proven unchanged;
- approved Motion cannot be repaired in place.

Owner/merge lifecycle:

- exact-time comments resolve to overlapping beats/nodes;
- only explicit `scope: motion` approval can approve Motion;
- approval targets the exact Motion revision;
- stale accepted-project revision refuses merge;
- successful merge creates exactly **one** accepted-project revision and **one** merge-history entry;
- one stored inverse undoes that merge;
- discard leaves accepted project unchanged.

## 10. Closed-Loop V1 acceptance matrix

Status: **PASS**

The decisive test enters through the internal **tool registry**, not direct orchestration helpers, and executes:

```text
accepted project
    ↓
create isolated Storyboard sandbox
    ↓
revise KVS graph through canonical Motion operations
    ↓
Storyboard structural QA
    ↓
request owner review (no approval implied)
    ↓
forged/stale approval → REFUSED
    ↓
exact owner Storyboard approval
    ↓
Animatic build + revision
    ↓
Animatic QA
    ↓
exact owner Animatic approval
    ↓
MotionPlan / Motion Forge
    ↓
Motion Draft
    ↓
Motion structural/direct-seek QA
    ↓
canonical review evidence
    ↓
request owner review (no approval implied)
    ↓
forged Motion approval → REFUSED
    ↓
exact owner Motion approval
    ↓
ONE atomic accepted-project merge
    ↓
C3 / C4 / C5 / C6 observe the same semantic node identity
    ↓
ONE inverse Undo restores the prior accepted scene
```

The acceptance proof explicitly preserves semantic node `hero` through C3 Layers, C4 Dope Sheet, C5 Curves and C6 Node Graph.

`@sanverse/motion-agent-tools` final: **9/9 PASS + build PASS**.

## 11. Internal Closed-Loop tool surface

Status: **COMPLETE**

The stable internal V1 registry exposes exactly 17 tools:

1. `get_project_context`
2. `create_storyboard_sandbox`
3. `revise_storyboard`
4. `validate_storyboard`
5. `build_animatic`
6. `revise_animatic`
7. `validate_animatic`
8. `build_motion_plan`
9. `revise_motion`
10. `validate_motion`
11. `render_review`
12. `set_visual_findings`
13. `request_owner_review`
14. `record_owner_approval`
15. `apply_approved_sandbox`
16. `undo_last_creative_merge`
17. `discard_sandbox`

Every registry call validates tool identity/input and required sandbox context before execution.

## 12. Real browser review evidence

Status: **PASS / manually inspected**

Development route: `/closed-loop-review` in Motion Lab only.

Real local Microsoft Edge/CDP audit:

- speed: **exactly 1×**;
- final tick: **7,200,000**;
- duration: **7,200,000 ticks = 5.00 seconds**;
- full playback marker: **true**;
- browser screencast frames captured: **194**;
- graph-backed component marker: **true**;
- stable semantic node `cost-card.value` visible in DOM: **true**;
- retained samples: seven temporal JPEGs + `runtime-evidence.json` under `motion/visual-baselines/closed-loop-v1/`.

Entrance, payoff/middle and exit retained frames were manually inspected. The component enters from its intended dim/hidden state, reaches the complete cost-vs-value composition, then exits cleanly without clipping. The Storyboard/Animatic/Motion review chain remains visible outside the renderer.

The first browser-audit launcher attempt reproduced the already-known Windows `spawn EINVAL` infrastructure pattern documented in `MOTION-FAIL-026`. No product code failed. The audit used the proven Harness/Edge launch path and then completed successfully; invalid launcher attempts are not evidence.

## 13. MCP V1

Status: **COMPLETE**

MCP was started **only after** the pre-MCP Closed-Loop acceptance/regression/build gate passed.

`@sanverse/motion-mcp` is a thin protocol adapter over `SanverseToolRegistryV1`:

- deterministic discovery/tool listing;
- `tools/call` delegates to `registry.invoke()`;
- explicit sandbox/revision context propagation;
- unknown tools fail closed;
- real localhost Node HTTP `/mcp` request proven;
- transport method/name/protocol mismatches refuse;
- the actual 17-tool Closed-Loop registry is exposed through MCP in an integration test;
- `get_project_context` is called through MCP against the actual Closed-Loop engine.

### Owner approval trust boundary

MCP cannot create approval authority from:

- client-supplied `approval` JSON;
- an elicitation/input response saying `true`;
- guessed/replayed request-state text;
- a fake approval-proof string.

For `record_owner_approval`, the host must resolve an opaque proof to a real `OwnerApprovalV1`. Only that host-resolved approval object reaches the internal registry. The internal engine still enforces exact subject/revision/QA/evidence requirements.

MCP final: **5/5 PASS + TypeScript build PASS**.

## 14. Final release gate

Status: **PASS**

Affected test matrix:

| Workspace | Tests |
| --- | ---: |
| `@sanverse/video-understanding` | 17 |
| `@sanverse/creative-direction` | 33 |
| `@sanverse/motion-contract` | 5 |
| `@sanverse/motion-primitives` | 29 |
| `@sanverse/motion-graph` | 136 |
| `@sanverse/motion-native-runtime` | 4 |
| `@sanverse/motion-testing` | 5 |
| `@sanverse/motion-external-bridge` | 9 |
| `@sanverse/motion-storyboard` | 14 |
| `@sanverse/motion-agent-tools` | 9 |
| `@sanverse/motion-mcp` | 5 |
| `@sanverse/motion-library` | 196 |
| `@sanverse/motion-lab` | 59 |
| `@sanverse/motion-ingest` | 4 |
| **TOTAL** | **525** |

- Final affected tests: **525/525 PASS**.
- Root `npm run build --workspaces --if-present`: **PASS / exit 0**.
- Protected production `@sanverse/web` build inside that root build: **PASS**.
- `git diff -- apps/web`: **0 files / 0 intentional changes**.

Existing build warnings remain non-blocking and are not Closed-Loop regressions:

- Motion Lab/web bundles exceed Vite's advisory 500 kB chunk warning;
- `/api/render-assets/nameplate-font` remains intentionally resolved at runtime by the existing web build.

## 15. Release boundaries

- Local Git only; no GitHub push/fetch/PR/Actions for this release.
- Nested `sites/creative-library-site` repository remains separate and excluded.
- No raw source media, private transcripts, secrets or generated exports were added.
- `apps/web/**` is unchanged.

## 16. Deferred V1+ work

Outside Closed-Loop V1 + MCP V1 and still deferred:

- C9 full tracking;
- C10 complete camera/2.5D;
- C11 particles;
- C12 full Expert Runtime;
- C13 advanced optimization;
- universal AEP/MOGRT/Three/GSAP/Rive compatibility;
- production-editor integration;
- broad future recipe/component expansion.

These are not required to call Closed-Loop V1 + MCP V1 complete.
