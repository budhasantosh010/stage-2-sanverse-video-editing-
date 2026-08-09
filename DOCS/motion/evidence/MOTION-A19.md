# MOTION-A19 — Hierarchy-Heavy Explainer Pack Evidence

Date: 2026-08-10
Status: IMPLEMENTATION + VERIFICATION COMPLETE; Git closeout follows this evidence
Parent checkpoint: `motion-compositor-c3` / `0f7c65955ddde28a84119076dbe9a9b3b9ccc4e3`

## Goal

Expand the 69-component Motion catalog only where a genuinely different structural communication problem exists, and use the batch to exercise MOTION-C3 Professional Layer Hierarchy with materially nested, editable Motion Graph scenes.

A19 does **not** add generic card aliases, production Studio integration, Plan-B AI decisions or C4 work.

## Inventory gate

The 69-component coverage matrix was re-read before implementation.

Explicitly rejected as duplicates:

- Org / Hierarchy Map → existing `sanverse.hierarchy-diagram` already solves generic hierarchy.
- Feedback Loop → existing `sanverse.flywheel-diagram` already solves repeating feedback/compounding loops.
- Roadmap Milestones → existing Milestone Status / Step List / Sequence Diagram cover the ordinary milestone/roadmap job.

Selected eight missing scenarios:

1. `sanverse.decision-tree`
2. `sanverse.swimlane-process`
3. `sanverse.journey-map`
4. `sanverse.priority-matrix`
5. `sanverse.value-chain`
6. `sanverse.layer-stack-explainer`
7. `sanverse.ecosystem-regions-map`
8. `sanverse.dependency-map`

Public Motion catalog: **69 → 77 components**.

## Architecture

A19 reuses the mature Family Creator/Designer/Advanced editing shell for title, subtitle, structured data, active item and shared style tokens, but the eight modules switch at the common family factory boundary into `a19-hierarchy-explainers.tsx`.

There is still one Motion Graph. No second hierarchy document exists.

Each A19 scene contains:

- root + surface;
- header group with eyebrow/title/subtitle;
- variant-specific body hierarchy;
- nested groups for structural regions;
- per-card Surface / Label / Detail child nodes;
- connector-path nodes where relationships are explicit;
- semantic parts;
- standard Family exposures;
- exact-tick C2 keyframe tracks.

Visible A19 cards map their real `*.surface`, `*.label` and `*.detail` graph nodes to DOM targets, so C3 child-layer selection/effects address the visual object rather than only its parent group.

## Stable data identity

Structured rows use stable source IDs such as:

```text
root|question|Does it repeat?|none|
research|Research|gather:Gather,verify:Verify,score:Score
discover|Discover|Find the problem|12K reach
must|high-low|Fix the hook
signal|Signals|Raw sources|Interesting evidence
experience|Experience|Creator interface
partners|Partners|Agency,Consultant,Creator
brief|Brief|research
```

Stable IDs must match `[a-z][a-z0-9-]{0,31}`. Node identity is data-derived rather than array-position-derived. Tests reverse Decision Tree rows and prove IDs such as `a19.decision-tree.node:automate` remain unchanged.

## Typed/bounded refusal behavior

A19 fails closed for:

- malformed structured rows;
- duplicate stable IDs;
- unknown active IDs;
- unknown decision parents;
- unknown dependency references;
- decision/dependency cycles;
- invalid priority quadrants;
- invalid Swimlane step IDs;
- too few or too many rows;
- excessive bounded density;
- scene durations below 1.5 seconds or above 12 seconds;
- non-canonical Sanverse tick authority.

Variant density contracts are bounded. The stress proof uses a maximum 5-lane × 5-step Swimlane rather than unbounded user-generated hierarchy.

## C2 exact-tick motion

Normal A19 authored motion is driven by first-class C2 keyframes:

- opacity reveals;
- Y-offset settlement;
- scale settlement;
- connector path trim/reveal.

Direct/backward/random exact-seek tests evaluate the same tick more than once after visiting different ticks and get identical resolved scenes.

Reduced motion does not freeze the first frame. A19 graph construction replaces authored entrance tracks with useful final constants while preserving semantic text and hierarchy.

## C3 hierarchy/operation proof

Automated tests cover:

- all eight scenes project through C3 at all four ratios;
- projection contains one Layer per graph node;
- hierarchy depth reaches at least 3;
- human-readable Layer labels are present;
- rename through `MotionGraphOperationV1`;
- render enable/eye through `MotionGraphOperationV1`;
- real grouping through the C3 operation API;
- persistent ancestor authoring lock refusal;
- eye remains usable while locked.

Dense Swimlane proof:

```text
5 lanes
× 5 nested steps per lane
= 127 graph nodes total
```

The scene validates, is compositor-ready and preserves stable nested IDs such as:

`a19.swimlane-process.lane:lane-3.step:lane-3-step-5`

Real Edge Compositor proof:

`motion/visual-baselines/a19-compositor-decision-tree-16x9.png`

The live Lab reports **32 graph nodes** for Decision Tree. Canonical selection is the nested node:

`a19.decision-tree.node:automate.surface`

and the Preview outline lands on that exact Surface child.

## Distinct visual structures

The first browser review rejected a technically valid but visually flat renderer (`MOTION-FAIL-012`). The accepted renderer makes the structural relationship explicit per scenario:

- Decision Tree — parent-depth rows, branch connectors and YES/NO labels;
- Swimlane Process — ownership lanes, nested steps and explicit handoffs;
- Journey Map — numbered ordered stages and journey connectors;
- Priority Matrix — explicit 2×2 impact/effort quadrants and axis language;
- Value Chain — ordered transformation stages and `ADD VALUE` connectors;
- Layer Stack Explainer — progressively wider dependent layers with vertical dependency connectors;
- Ecosystem Regions Map — central Core connected to nested relationship regions/members;
- Dependency Map — topological levels plus explicit `Needs:` relationships; landscape also shows edge summary paths.

The first 9:16 scale was also rejected as underpowered (`MOTION-FAIL-013`). Compact composition-space typography/padding was enlarged without changing 16:9 sizing.

## Mechanical coverage

A19-specific suite: **11/11 passed**.

It covers:

- eight distinct registered scenarios;
- four-ratio compositor-ready graph validation;
- stable IDs;
- C2 exact-seek determinism;
- reduced motion;
- **8 style packs × 4 ratios** for every A19 module;
- duration bounds;
- malformed/cycle/reference/density refusals;
- dense 127-node Swimlane;
- C3 operations and locks;
- declared default contracts.

The complete Motion Library suite is **146/146**.

The cross-catalog C3 projection test now projects **all 77 public components at all four reference ratios**.

## Final seven-workspace release candidate

Fresh sequential run from the final source:

| Workspace | Tests |
|---|---:|
| `@sanverse/motion-contract` | 3/3 |
| `@sanverse/motion-primitives` | 25/25 |
| `@sanverse/motion-graph` | 113/113 |
| `@sanverse/motion-native-runtime` | 4/4 |
| `@sanverse/motion-testing` | 5/5 |
| `@sanverse/motion-library` | 146/146 |
| `@sanverse/motion-lab` | 19/19 |
| **Total** | **315/315** |

All seven Motion workspace builds passed.

Motion Lab production build transformed 89 modules. Its non-failing development bundle warning is retained truthfully: main JS chunk 567.99 kB minified / 153.45 kB gzip.

## Browser evidence

All captures are real Microsoft Edge against the live HTTP-200 Motion Lab on strict port 2010 and were manually inspected.

### Settled 16:9 — Sanverse Clean

- `a19-review-decision-tree-16x9.png`
- `a19-review-swimlane-process-16x9.png`
- `a19-review-journey-map-16x9.png`
- `a19-review-priority-matrix-16x9.png`
- `a19-review-value-chain-16x9.png`
- `a19-review-layer-stack-explainer-16x9.png`
- `a19-review-ecosystem-regions-map-16x9.png`
- `a19-review-dependency-map-16x9.png`

### Settled 9:16 — distributed style/hostility matrix

- Decision Tree — Dark Minimal / black;
- Swimlane Process — Tech UI / black;
- Journey Map — Editorial / white;
- Priority Matrix — Sketch / neutral;
- Value Chain — Glass / black;
- Layer Stack Explainer — Retro / Neon / black;
- Ecosystem Regions Map — Creator Energetic / **busy background**;
- Dependency Map — Sanverse Clean / black / **reduced motion**.

Retained files use `a19-review-<component>-9x16.png`.

The final reduced-motion Dependency portrait intentionally omits its redundant compact edge-summary strip; every visible dependency card already carries `Needs: …`, avoiding unreadable micro-text while keeping connector graph nodes in the scene.

## Performance review

Local development-machine measurement across **256 combinations** (8 modules × 8 styles × 4 ratios):

- graph create + exact-tick evaluate: **1.506 ms average**, **3.369 ms p95**, **33.072 ms worst local sample**;
- SSR markup: **4.813 ms average**, **7.683 ms p95**, **43.470 ms worst local sample**;
- mean markup: **7,892 bytes**.

Dense 127-node Swimlane:

- create + exact-tick evaluate + C3 projection, 50 runs: **10.308 ms average**, **15.160 ms p95**, **18.970 ms worst**;
- SSR markup, 20 runs: **12.167 ms average**, **15.299 ms p95**, **18.144 ms worst**.

These are local engineering timings, not FPS, paint-time or universal memory guarantees.

## Provenance / originality

No external commercial motion template, proprietary screenshot, logo asset, animation runtime or third-party component implementation was used. The eight communication structures are generic explanatory patterns implemented first-party using Sanverse Motion Graph nodes, shared style tokens, C2 keyframes and C3 Layers.

## Final source-boundary scan

Passed before Git closeout:

- `git diff --check` clean;
- no `apps/web` changes;
- no production `apps/web` Motion package imports;
- no `Date.now`, `performance.now`, `Math.random`, timers, `requestAnimationFrame` or CSS keyframe animation authority in Motion Library / Motion Graph / native runtime source;
- no prohibited Remotion/Rive/Lottie/GSAP/Framer Motion/Three.js runtime dependency;
- no Plan-B AI decision logic;
- no C4 implementation.

## Failures found and corrected

- `MOTION-FAIL-012` — first hierarchy renderer visually flattened relationships into cards; rejected and redesigned.
- `MOTION-FAIL-013` — first portrait composition scale was too small; rejected and enlarged.
- `MOTION-FAIL-014` — first headless Edge command split unquoted spaced paths into multiple targets; evidence harness fixed, no product failure.

## Stop boundary

A19 implementation and verification are complete. The immutable milestone checkpoint is the dedicated `motion-library-v1.3` tag; C4 remains outside this release.

**MOTION-C4 is not started.**
