# CREATIVE-B0 — Creative Direction Foundation

Date: 2026-08-10
Milestone: Plan B0
Status: implementation + verification complete; preserve in separate Git checkpoint before C4.

## Goal

Establish the semantic Creative Direction layer above implementation details:

```text
human / future AI intent
        ↓
Creative Direction Document
        ↓
vendor-neutral planner
        ↓
typed Creative Edit Proposal
        ↓
future Plan-A / Plan-C compiler seam
```

B0 does not perform video understanding, segmentation, tracking, provider API calls, production editor mutation, CSS generation or DOM manipulation.

## Package

New workspace: `@sanverse/creative-direction`

Public source boundary:

- `document.ts` — `sanverse.creative-direction/v1`, canonical duration, immutable exact-tick operations;
- `tracks.ts` — STYLE / GRAPHICS / MOTION / FOOTAGE / TRANSITION / EMPHASIS / NOTES / CONSTRAINTS;
- `directives.ts` — discriminated directive kinds, source/priority/status and typed semantic intent;
- `comments.ts` — structural human/AI/system feedback targeting region/directive/proposal/version;
- `versions.ts` — creative-plan snapshots, lineage, compare and restore;
- `proposal.ts` — typed serializable Creative Edit Proposal;
- `compiler.ts` — semantic resolver seam from directives to proposal assignments;
- `model-adapter.ts` — vendor-neutral async planner interface;
- `fixtures.ts` — original product-launch fixture and deterministic offline planner;
- `validation*.ts` — fail-closed document/directive/proposal validation.

Canonical time authority is `@sanverse/edit-domain/time` `PROJECT_TIMESCALE = 1,440,000`. B0 stores `startTicks`/`endTicks`; no millisecond clock is introduced.

## Validation

B0 rejects:

- non-object or unsupported schemas;
- non-safe/fractional/negative/reversed/out-of-duration tick regions;
- duplicate track/directive/comment/version/proposal-item IDs;
- unknown tracks and unknown directive kinds;
- directive-kind ↔ track mismatches;
- invalid typed motion/footage/transition/emphasis/constraint values;
- missing directive/version comment targets;
- invalid version parent references and lineage cycles;
- invalid resolved component/style references when a Plan-A catalog is supplied;
- motion assignments targeting missing proposal placements;
- detectable conflicting overlapping **required** style, motion and maximum-graphics directives.

Unimplemented semantic families are never silently dropped: their directive IDs remain in `unresolvedDirectiveIds` in the proposal.

## Exact-tick document editing

`applyCreativeDirectionOperation(...)` provides immutable typed operations for:

- add directive;
- remove directive;
- move directive by exact tick delta;
- resize start/end to an exact tick;
- duplicate with stable new ID and exact offset;
- change directive kind while preserving identity/region/source/priority/status;
- replace semantic properties while preserving stable ID.

Every candidate document is revalidated before acceptance. Invalid moves/resizes fail atomically.

## Comments + creative-plan versions

Comments structurally reference a region, directive, proposal or version. The product fixture includes the human feedback patterns “keep the graphic but simplify the motion” and “make the final section feel more premium” as original structural examples.

Creative versions snapshot tracks + directives and store lineage/reason/summary. Tests prove added/removed/changed comparison and restore to detached snapshot content. This is creative-plan versioning, not Git duplication.

## Vendor-neutral planner boundary

`CreativePlanningModelV1` exposes only:

```text
propose(CreativePlanningInputV1) -> CreativeEditProposalV1
```

No OpenAI/Anthropic/vendor SDK appears in the domain package. No internet or API key is required for B0 tests.

`FixtureCreativePlanner` is deterministic and offline. Repeated identical input serializes to byte-identical proposal JSON.

## Original product-launch fixture

No source commercial video, logo, screenshot, extracted frame or brand-specific asset is committed.

The original textual fixture covers:

- 0–5s conversation-notification story;
- 5–9s semantic-highlight statement;
- 12–18s presenter lower third;
- 21–27s floating prompt;
- 33–58s product UI story + screen-focus footage treatment;
- 62–68s agent progress;
- 72–80s scoped-access comparison;
- 85–91s callback notification;
- 91–95s generic Sanverse lockup;
- presenter/subtitle constraints and restrained premium style/motion intent.

At B0 the fixture planner can intentionally keep future A20 component IDs as semantic candidates while selecting `null` if a supplied Plan-A catalog lacks them. Resolved references are strictly validated when present.

## Creative Direction Lab

Development-only URL:

`http://127.0.0.1:2010/?mode=creative-direction`

The Lab is a separate screen inside the existing internal Motion Lab application; `apps/web` is untouched.

It provides:

- eight semantic track lanes;
- exact tick ruler/readout;
- region selection;
- add exact-tick region;
- exact start/end resize;
- ±1-second exact-tick move (±1,440,000 ticks);
- duplicate +1s;
- delete;
- change directive kind;
- typed style/graphic/motion/footage/transition/emphasis/note/constraint property controls;
- semantic preview;
- deterministic typed proposal list;
- live document validation state.

## Real Edge visual evidence

Retained and manually inspected:

- `motion/visual-baselines/b0-creative-direction-lab.png` — 1600×1000 main view;
- `motion/visual-baselines/b0-creative-direction-lab-full.png` — 1600×1200 main + proposal view.

Observed in real headless Microsoft Edge from strict Motion Lab port 2010:

- all eight lanes are readable;
- selected `semantic-highlight-statement` is visibly bounded 5.00s → 9.00s;
- canonical tick authority is visible;
- fixture planner resolves it to `sanverse.kinetic-headline` rather than implementation instructions;
- exact start/end inputs and move/duplicate/delete controls are visible;
- typed proposal reports 9 placements;
- no source-brand assets appear.

## Tests/builds

Fresh B0 release-candidate matrix:

```text
creative-direction       26 / 26
motion-contract           3 / 3
motion-primitives        25 / 25
motion-graph             113 / 113
motion-native-runtime     4 / 4
motion-testing            5 / 5
motion-library          146 / 146
motion-lab               24 / 24
---------------------------------
TOTAL                   346 / 346

Builds                     8 / 8
```

The Motion Lab build retains the existing non-failing Vite large-chunk warning; it is not a B0 correctness failure.

## Failures found and fixed

Detailed entries live in `DOCS/creative-engine/FAILURE_REGISTRY.md`.

- large first validator write was rejected by the Harness; validator was split into smaller reviewable modules without weakening rules;
- one TypeScript helper widened a track literal to `string`; fixed with a typed `satisfies` map;
- negative tests initially attempted mutation through readonly fixture types; fixed only in test construction;
- first proposal test expected 8 placements while the fixture intentionally contains 9 graphic regions including callback; corrected the test, not product behavior;
- strict port 2010 was occupied by an old Vite process from the same Motion worktree; process identity was verified before restarting it.

## Acceptance

- [x] `packages/creative-direction` exists
- [x] exact-tick regions
- [x] style directives
- [x] graphic directives
- [x] motion directives
- [x] footage directives
- [x] constraints
- [x] comments
- [x] versions
- [x] proposal contract
- [x] vendor-neutral model adapter boundary
- [x] deterministic offline fixture planner
- [x] validation/refusal rules
- [x] development Creative Direction Lab
- [x] add/select/move/resize/delete/duplicate/type/property region editing
- [x] no external AI required for tests
- [x] real Edge visual inspection
- [x] no `apps/web` changes

B0 is preserved as the separate `creative-direction-b0` checkpoint. C4 begins only from that remote-verified boundary.
