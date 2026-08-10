# Sanverse Creative Engine ABC-1 — Integrated A20 + B0 + C4 Proof

Date: 2026-08-10
Status: release candidate verified; final integrated Git checkpoint is this closeout commit/tag.

## Mission

ABC-1 is the first cycle proving the three Creative Engine lanes are one system rather than three unrelated roadmaps:

```text
Plan B — Creative Direction
        │ semantic intent
        ▼
Typed Creative Edit Proposal
        │ resolved component ID/content
        ▼
Plan A — Motion component
        │ one Motion Scene
        ▼
Plan C3 — Layers
        │ same stable node IDs
        ▼
Plan C4 — Animation Timeline
        │ typed C2 keyframe operations
        ▼
Manual professional retiming
```

The production editor and `apps/web` are outside this cycle.

## Starting verified checkpoint

ABC-1 began from the clean `motion-library-v1.3` A19 checkpoint at `c7c0c9622039cea65fe6398e919297f9b3926e63` with 77 public Motion components, 315/315 Motion tests and 7/7 Motion workspace builds.

## Lane checkpoints

### Plan B0 — Creative Direction Foundation

Preserved independently at:

- commit `e5658ec` — `[verified] feat(creative-direction): establish Plan-B creative direction foundation`
- tag `creative-direction-b0`

B0 provides exact-tick semantic tracks/directives, comments, versions, typed proposal contracts, a vendor-neutral model boundary, deterministic offline planner, validation and the development-only Creative Direction Lab.

### Plan C4 — Professional Animation Timeline / Dope Sheet

Preserved independently at:

- commit `44f41fe` — `[verified] feat(compositor): add professional animation dope sheet`
- tag `motion-compositor-c4`

C4 is a pure projection of C2 Animatable tracks synchronized to C3 stable Layer IDs and the single Motion Lab playhead. It does not own a second keyframe store or clock.

### Plan A20 — Product Storytelling + YouTube Motion Pack

Preserved independently at:

- commit `692d3fd34fc2607d0e2509ef85c99cebb7994475` — `[verified] feat(motion): add premium product storytelling pack`
- tag `motion-library-v1.4`

A20 takes the public library from 77 to 83 components. It adds six distinct product-story scenes, a semantic-highlight Kinetic Headline treatment, deterministic safe-placement/PIP primitives, product-story motion events and footage-compatible visual evidence. Full A20 details remain in `DOCS/motion/evidence/MOTION-A20.md`.

## Development integration seam

The final ABC bridge deliberately lives in `apps/motion-lab`, not in `@sanverse/creative-direction`.

That preserves the dependency direction:

```text
creative-direction package
        │
        │ has semantic IDs/contracts only
        ▼
Motion Lab integration adapter
        │
        ├── Plan-A catalog/modules
        ├── Motion Graph
        ├── C3 Layers
        └── C4 tracks
```

`creative-engine-bridge.ts` converts a resolved `CreativeComponentPlacementV1` into an isolated graph-native Motion preview. It keeps two time meanings explicit:

- `sourceStartTicks/sourceEndTicks` preserve the exact B0 edit region;
- the local Motion component retains its own bounded authored-animation duration.

If a B0 region is longer than a component's local motion window, the bridge uses that component's default local preview duration rather than weakening either contract. This boundary is recorded as `CREATIVE-FAIL-006`; a future production compiler owns hold/loop/exit scheduling across the full edit placement.

The Creative Direction Lab now exposes `Preview in Motion Lab` links for resolved proposal placements. Those links carry the selected component plus proposal text/items/placement into the internal Compositor view. Semantic-highlight placements also carry the highlight treatment and exact emphasis indices.

## Cross-plan architecture proof

The integration suite uses the real 83-component Plan-A catalog and all existing style-pack IDs rather than the small B0 fixture catalog.

For all nine resolved product-launch graphic placements it proves:

```text
Creative Directive
      ↓
FixtureCreativePlanner
      ↓
Creative Edit Proposal placement
      ↓
real Plan-A component module
      ↓
valid Motion Scene
      ↓
C3 projectMotionLayers(...)
      ↓
C4 projectMotionDopeSheet(...)
```

Every C4 track references a node that exists in the same Motion Scene. The original B0 source region remains attached to the preview even when the component's local animation duration is shorter.

## Integration proof 1 — Semantic Highlight

B0 directive:

- source directive: `graphic:semantic-highlight`
- semantic intent: `semantic-highlight-statement`
- region: 5.00s → 9.00s
- content: `One mention changed the workflow`
- emphasis: `changed the workflow`
- motion intent: premium/restrained product language

B0 resolves the placement to `sanverse.kinetic-headline`.

Plan A supplies the existing Kinetic Headline with the A20 `highlight-box` treatment rather than a duplicate public component. The emphasized words expose real C2 keyframed `opacity` and `transform.scaleX` tracks.

The integration test selects the real highlighted-word opacity keyframe in C4 and moves it by exactly one 30fps frame (`48,000` canonical ticks) through `buildAtomicMotionKeyframeMoveOperations(...)` → `applyMotionOperations(...)`.

Proof after retiming:

- operation succeeds;
- Motion Scene component ID is unchanged;
- graph node IDs are unchanged;
- keyframe ID is unchanged;
- keyframe tick moves by exactly 48,000 ticks;
- the same node still projects through C3 Layers.

Retained browser evidence: `motion/visual-baselines/abc1-semantic-highlight-c4.png`. It shows the semantic-highlight composition in Preview, `kinetic-headline.word:changed:1` selected in C3 Layers, and that same word's keyframed opacity/scale tracks focused in C4.

## Integration proof 2 — Scoped Access Comparison

B0 directive:

- source directive: `graphic:scoped-access`
- semantic intent: `scoped-access-comparison`
- region: 72.00s → 80.00s
- communication: two contexts with explicit boundaries

B0 resolves the placement to `sanverse.scoped-access-comparison`.

The integration test selects four real entrance/emphasis keyframes spanning the left card, right card, title and value/emphasis. It moves them together by exactly two 30fps frames (`96,000` canonical ticks) in one C2 operation transaction.

Proof after retiming:

- four operations are built as one atomic user action;
- the operation batch succeeds;
- component and graph node IDs are unchanged;
- all four keyframe IDs are unchanged;
- all four ticks move by exactly 96,000 ticks;
- relative timing is preserved.

Retained browser evidence: `motion/visual-baselines/abc1-scoped-access-c3-c4.png`. It shows `family.scoped-access-comparison.item:1` selected in C3 and the same card's opacity/position/scale tracks exposed in C4.

## Creative Direction → Motion Lab browser proof

Retained `motion/visual-baselines/abc1-creative-direction-proposal-links.png` shows the original 95-second Creative Direction fixture, all eight semantic tracks, the selected semantic-highlight region, typed Plan-A resolution and the nine-placement proposal with direct internal Motion Lab preview links.

No commercial source video, logo, screenshot or brand asset is committed by this proof.

## Fresh final test gate

Run from the integrated source after the bridge/UI/tests were complete:

```text
@sanverse/creative-direction       26 / 26
@sanverse/motion-contract           3 / 3
@sanverse/motion-primitives        29 / 29
@sanverse/motion-graph            120 / 120
@sanverse/motion-native-runtime     4 / 4
@sanverse/motion-testing            5 / 5
@sanverse/motion-library          160 / 160
@sanverse/motion-lab               34 / 34
────────────────────────────────────────
TOTAL                             381 / 381
```

All eight Creative/Motion workspaces build successfully: **8/8**.

Motion Lab's Vite production build continues to emit a non-failing >500kB chunk advisory (`~649.56 kB` minified main development bundle). ABC-1 does not hide that warning or change chunking architecture merely to suppress it.

## Acceptance matrix

- Creative Direction → component resolution: **PASS**
- component → Motion Scene: **PASS**
- Motion Scene → C3 Layers: **PASS**
- same scene → C4 tracks: **PASS**
- Semantic Highlight manual retiming through typed C2 operation: **PASS**
- Scoped Access atomic multi-retiming through typed C2 operations: **PASS**
- exact B0 source region preserved separately from local component motion duration: **PASS**
- Creative Direction → internal Motion Lab preview links with proposal content: **PASS**
- real-browser Creative Direction/C3/C4 evidence: **PASS**
- fresh full tests: **381/381 PASS**
- fresh builds: **8/8 PASS**
- production `apps/web` integration: **NONE**
- B1/C5/A21 implementation: **NOT STARTED**

## Stop boundary

ABC-1 ends here. The next planned lanes remain:

- Plan A21 — next reference-driven YouTube/WOW pack;
- Plan B1 — video-understanding foundation;
- Plan C5 — professional curve editor.

None is authorized by this closeout.
