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
