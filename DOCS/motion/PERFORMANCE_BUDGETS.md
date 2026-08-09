# Motion Performance Budgets

Performance classes:

- light — text, cards, icons, small SVG
- medium — lists, diagrams, several elements, masks and shadows
- heavy — procedural Canvas, particles, dense diagrams, distortion/depth

Plan A components must not allocate unbounded work from elapsed time, start autonomous animation loops, perform network work during render, or retain growing state across repeated exact-tick renders. Numerical frame-time budgets are recorded only after measurement; none are invented in A0.

## Plan A measured review — 2026-08-08

Local warm-cache engineering measurement across the completed public catalog of 48 modules and all four reference ratios:

- Motion Graph scene creation + exact-tick evaluation: 3,840 operations in 397.751 ms; 0.1036 ms average per operation.
- Server-side markup generation: 960 operations in 929.843 ms; 0.9686 ms average per render.
- Mean generated markup size: 2,116 bytes.

Method: one warm-up pass, then 20 graph loops and 5 markup loops over 48 modules × 4 ratios using each module's default duration and 56% exact-tick sample. These are measurements from the current local development machine, not universal browser-frame guarantees.

Review conclusions:

- title/value/status/quote/CTA families remain `light`;
- list and diagram family modules are marked `medium` because they may render multiple repeated elements;
- no Plan A component performs network work during render;
- no Plan A component owns an autonomous animation loop;
- no Plan A component retains growing render history;
- exact-tick graph evaluation remains bounded by component node count rather than elapsed playback time.

## Plan A continuation measured review — 60-component catalog

After the 12-scenario A17 expansion, a fresh warm-cache local sweep covered all 60 public modules across all four reference ratios:

- Motion Graph scene creation + exact-tick evaluation: 2,400 operations in 354.693 ms; 0.1478 ms average per operation.
- Server-side markup generation: 720 operations in 771.317 ms; 1.0713 ms average per render.
- Mean generated markup size: 2,154 bytes.

Method: one warm-up pass, then 10 graph loops and 3 markup loops over 60 modules × 4 ratios using varied exact-tick samples. This is a local engineering measurement from the current development machine, not a universal browser-frame or production-memory guarantee.

The expanded catalog remains bounded by per-component node/item count; no new component introduces elapsed-time allocation, autonomous render loops, network work, or unseeded randomness.

## MOTION-C2 deterministic keyframe review — 2026-08-08

C2 performance was measured separately by subsystem rather than collapsing evaluator, scene-validation, graph-operation and Motion Lab UI costs into one number.

Direct exact-tick keyframe evaluator stress used 100 properties × 10,000 arbitrary ticks for each representative track size (1,000,000 property evaluations per case):

| Keyframes / property | Avg / property | Avg 100-property batch | Worst observed batch |
|---:|---:|---:|---:|
| 2 | 6.7664 µs | 0.6766 ms | 24.0034 ms |
| 10 | 2.7968 µs | 0.2797 ms | 9.2893 ms |
| 100 | 3.0152 µs | 0.3015 ms | 4.2691 ms |
| 1000 | 4.1808 µs | 0.4181 ms | 15.3759 ms |

The evaluator uses binary keyframe-segment lookup, so 1,000-keyframe tracks remain exact-seek deterministic without replay history.

Separate full-scene synthetic stress (100 keyframed properties × 100 keyframes/property, including full scene validation on each pass): 100 evaluations in 1649.977 ms, 16.4998 ms average, 92.4144 ms worst local sample.

Separate graph-operation stress on a synthetic 100-node scene: 200 `move-keyframe` operations in 947.439 ms, 4.7372 ms average, 19.223 ms worst local sample.

End-of-benchmark process observation: RSS 166,100,992 bytes, heap used 38,786,328 bytes. This includes runtime/JIT/GC context and is not a product-memory guarantee.

Real headless Edge, full Advanced Motion Lab C2 Cost Card proof, 100 exact-tick input changes: 75.771 ms average dispatch→next-macrotask DOM commit, p95 125.6 ms, worst 143.1 ms. This is a development-workshop React/DOM metric, not paint time, renderer FPS or pure Motion Graph cost.

Two invalid benchmark attempts are retained in the failure registry: `MOTION-FAIL-006` (mixed oversized benchmark timed out) and `MOTION-FAIL-007` (`requestAnimationFrame` was throttled in headless/background Edge). No numbers from those failed runs are treated as evidence.

## MOTION-A18 measured review — 69-component catalog — 2026-08-09

After the nine keyframe-native A18 creator scenarios, a fresh local warm development-process sweep covered all **69 public modules** across all four reference ratios:

- Motion Graph scene creation + exact-tick evaluation: 1,380 operations in 559.804 ms; **0.4057 ms average**, **1.2879 ms p95**, **14.646 ms worst local sample**.
- Server-side markup generation: 552 operations in 863.193 ms; **1.5638 ms average**, **2.9823 ms p95**, **21.0042 ms worst local sample**.
- Mean generated markup size: **2,181 bytes**.

The nine A18 keyframe-native modules were also measured separately across all eight style packs and all four ratios (288 graph create+evaluate operations): **94.486 ms total**, **0.3281 ms average**, **0.6476 ms p95**, **1.1173 ms worst local sample**.

These are local engineering measurements from the current development machine and include runtime/JIT/GC noise. They are not universal browser-frame, FPS or production-memory guarantees.

The first standalone A18 benchmark attempt produced no usable measurements because its temporary `tsx` runner did not provide the classic JSX `React` global expected by an existing component module. That invalid attempt is recorded in the Motion failure registry; only the corrected rerun above is retained as evidence.

## MOTION-C3 Layer hierarchy measured review — 2026-08-09

C3 measurements are separated by subsystem. They are local development-machine engineering evidence, not renderer FPS or universal production budgets.

### Pure Layer projection

Synthetic sibling scenes were already validated and resolved before projection timing:

| Graph nodes | Average projection | p95 | Worst local sample |
|---:|---:|---:|---:|
| 10 | 0.1733 ms | 0.5635 ms | 0.9688 ms |
| 50 | 0.5669 ms | 0.9839 ms | 1.2966 ms |
| 100 | 0.7407 ms | 1.0200 ms | 1.5645 ms |
| 500 | 7.9139 ms | 8.5520 ms | 8.8628 ms |
| 1000 | 11.1493 ms | 13.5930 ms | 15.3678 ms |

Depth stress at 1, 3, 5, 10 and 20 nested groups also passes mechanically.

### React Layer tree construction proxy

Server-side `renderToStaticMarkup(<LayerPanel ...>)` was used only as a React tree-construction proxy; it is **not** browser paint/FPS:

| Rows | Average | Worst local sample |
|---:|---:|---:|
| 10 | 5.3417 ms | 13.9316 ms |
| 50 | 27.6991 ms | 38.0894 ms |
| 100 | 11.2896 ms | 47.8597 ms |
| 500 | 116.2011 ms | 200.5468 ms |
| 1000 | 176.4393 ms | 523.6778 ms |

The non-monotonic 50/100 averages are development-process/JIT noise. The useful conclusion is qualitative: hundreds to one thousand simultaneously rendered rows become materially more expensive, while current real components are far smaller (Cost Card 18 nodes; Team Network 32 nodes). C3 therefore **does not add premature virtualization**. Virtualization becomes justified only if realistic future A19+ components/workflows approach the synthetic hundreds-row regime and browser interaction actually degrades.

### Universal operation timing on a synthetic 1000-node scene

These include immutable graph update plus full validation:

- 20 selection toggles: **0.0384 ms average** per 20-toggle sequence, p95 0.0683 ms.
- rename: **6.5419 ms average**, p95 8.3243 ms.
- sibling reorder: **6.6997 ms average**, p95 8.3011 ms.
- reparent: **6.3341 ms average**, p95 7.7487 ms.
- duplicate subtree (single synthetic leaf in the 1000-node scene): **11.4988 ms average**, p95 18.2352 ms.
- group five siblings: **23.8023 ms average**, p95 30.9247 ms.
- recording 50 bounded Motion Lab history entries: **0.0451 ms average**, p95 0.0716 ms.

### Real headless Edge selection commit

The retained browser metric uses a `MutationObserver` on the actual selection overlay rather than background timers or `requestAnimationFrame`:

- 50 alternating Cost/Value number Layer selections;
- **23.804 ms average** click→selection-overlay DOM commit;
- **38.9 ms p95**;
- **49.9 ms worst local sample**.

This includes the full development Motion Lab React/Layer/overlay path. It is not paint time or Motion Graph evaluator cost.

The first timer-based browser benchmark is discarded and recorded as `MOTION-FAIL-011` because background Edge throttled its `setTimeout(0)` waits.
