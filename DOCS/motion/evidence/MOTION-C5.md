# MOTION-C5 — Professional Curve Editor Evidence

Date: 2026-08-10
Status: complete; preserved by dedicated checkpoint tag `motion-compositor-c5`

## Scope

C5 adds a professional development-only Value Graph over the existing C2/C3/C4 authority. It does not add another keyframe store, graph, Layer tree or animation clock.

## Implemented

- pure `projectMotionCurves(...)` projection from real Motion Scene numeric animation tracks;
- numeric keyframe tracks editable, numeric authored-driver tracks visible/read-only;
- Hold, Linear and Bezier curve visualization;
- SVG path generation from exact C2 keyframe values/ticks;
- Bezier incoming/outgoing handles using the same evaluator semantics;
- pointer handle preview, one-operation pointer-up commit and Escape cancellation;
- deterministic presets: Linear, Bezier, Flat, Auto, Soft, Smooth, Snappy, Heavy, Ease In, Ease Out, Ease In Out and Overshoot;
- bounded-property overshoot refusal;
- exact tick/value/interpolation/Bezier numeric Inspector;
- Fit Track / Fit Selection;
- time zoom 1–16x and horizontal pan;
- value zoom and value pan;
- one shared C4↔C5 stable keyframe selection;
- one shared selected animation track;
- one shared Motion Lab playhead;
- existing compositor history/Undo/Redo journal reused for C5 edits.

Architecture: `DOCS/motion/CURVE_EDITOR_ARCHITECTURE.md`.

## Correctness proof

`packages/motion-graph/src/curves.test.ts` proves:

- only numeric animation tracks become curve tracks;
- keyframe target / node / keyframe IDs survive projection;
- read-only authored drivers stay distinguishable from explicit keyframes;
- Hold is rendered as a step;
- Linear is rendered as straight numeric interpolation;
- Bezier samples correspond to `evaluateKeyframedValue(...)` for the same segment;
- handle operations write the real owning keyframe handles;
- presets compile to typed C2 operations;
- bounded tracks reject Overshoot;
- fit-range math remains finite.

Focused result: **10/10 curve-model tests PASS**.

## C4 ↔ C5 control proof

`apps/motion-lab/src/MotionCurveEditor.test.tsx` proves:

- selecting a C4 key selects the same stable keyframe in C5;
- selecting a C5 key changes the shared C4 selection;
- both surfaces seek the same exact playhead tick;
- Bezier drag is preview-only until pointer-up;
- Escape cancels without an operation;
- presets use one operation transaction;
- read-only driver tracks refuse fake handle editing;
- Fit Track / Fit Selection / time zoom / value zoom-pan are view-only.

`apps/motion-lab/src/compositor-history.test.ts` additionally proves a C5 Bezier change is one Undo transaction.

Current Motion Lab result: **46/46 PASS**.

## Real browser proof

Retained screenshot:

- `motion/visual-baselines/c5-value-graph.png`

URL state used:

`component=cost-value-card&level=compositor&proof=c2-cost&node=cost-card.value&c4key=kf-value-x-1&panel=curves`

Real Edge shows:

- Cost / Value Card preview;
- C3 `cost-card.value` selected;
- Curves view active;
- `transform.scaleX` selected;
- real selected C2 key at tick `3,024,000`, value `1.08`;
- Bezier graph and visible outgoing handle;
- numeric Curve Inspector with `inX=.72`, `inY=1.15`, `outX=.28`, `outY=1.1`;
- shared red playhead crossing the selected key;
- preset controls and fit/zoom controls.

The first post-wiring browser attempt exposed an infinite React update loop caused by C4 re-publishing an unchanged controlled selection whenever the regenerated scene projection changed. The selection-pruning effect now compares stable IDs/primary/anchor and only publishes when the selection actually changes. A repeat Edge console run contained no `Uncaught`, `Maximum update`, or React error, and the retained browser screenshot rendered normally.

## Stress / performance

No hard budget was invented.

Fresh pure projection/path/operation measurement from the full C5 release run:

```text
keys=10     projection 1.265 ms   path 0.255 ms   handle build 0.468 ms
keys=100    projection 0.611 ms   path 0.571 ms   handle build 0.530 ms
keys=1,000  projection 2.962 ms   path 4.326 ms   handle build 6.379 ms
keys=5,000  projection 15.978 ms  path 24.318 ms  handle build 12.713 ms
keys=10,000 projection 28.508 ms  path 41.750 ms  handle build 29.348 ms
```

Fresh development React/SVG construction from the same release run:

```text
keys=10     27.776 ms
keys=100    21.791 ms
keys=1,000  106.023 ms
keys=5,000  638.707 ms
keys=10,000 912.584 ms
```

These are local development/JSDOM/SSR-style engineering measurements, not FPS or browser-paint guarantees.

The initial 10,000-key development render failed with `Maximum call stack size exceeded` because value fitting used spread arguments with `Math.min(...values)` / `Math.max(...values)`. The implementation was fixed to a bounded loop and the identical 10,000-key stress now passes.

## Fresh release gate

Nine-workspace Creative/Motion test gate:

```text
video-understanding   17/17
creative-direction    27/27
motion-contract        3/3
motion-primitives     29/29
motion-graph         131/131
motion-native-runtime  4/4
motion-testing         5/5
motion-library       160/160
motion-lab            46/46
---------------------------
TOTAL                422/422 PASS
```

Nine-workspace builds: **9/9 PASS**.

Known non-failing build advisory: Motion Lab's Vite main development bundle is about **681.70 kB minified**, above Vite's 500 kB advisory threshold. No architecture change is made solely to hide an advisory.

## Isolation

- production `apps/web`: unchanged;
- no second Motion Graph/keyframe/Layer authority;
- no A21 implementation in this checkpoint;
- no B2/B3/C6/A22 implementation;
- no vendor-specific AI/provider integration.

## Acceptance

- graphical curves represent the real C2 numeric motion: **PASS**
- Hold/Linear/Bezier and actual Bezier handles: **PASS**
- shared C4/C5 selection + playhead: **PASS**
- typed operations + one Undo transaction: **PASS**
- presets + bounded Overshoot refusal: **PASS**
- fit/zoom/pan + numeric Inspector: **PASS**
- 10k stress measured and executable: **PASS**
- real-browser Value Graph proof: **PASS**
- fresh tests/builds: **422/422 + 9/9 PASS**
