# MOTION-C2 — Deterministic Keyframe Engine

Date: 2026-08-08

Status: **COMPLETE for implementation, mechanical verification, measured local performance, and inspected browser evidence.** Git preservation is performed as the final step of this milestone before A18 begins.

## Mission

C2 answers one question:

> Can one Motion Graph property own an explicit professional animation through exact Sanverse time without introducing frame history or a second animation authority?

Answer: **yes**.

The key rule remains:

```text
resolved visual state = Motion Graph + exact local tick
```

No component/runtime keyframe evaluation depends on the previous frame, wall-clock time, timer state or playback direction.

## Starting baseline

Dedicated Motion worktree:

`C:\Users\Lenovo\.chatgpt-code-harness\worktrees\Stage 2 Sanverse Editing Workflow-a95ba61b\motion-program-p0-c1`

Branch: `motion-program-p0-c1`

Verified start/local/remote SHA: `a82a1ba8da8db89d1f38c108842b8361f090c5fb`

Baseline reproduced before C2 writes:

- 207 / 207 focused Motion tests passed.
- 7 / 7 Motion workspace builds passed.
- working tree clean.
- rollback tag `motion-library-v1.1` present.

## Single Animatable authority

C2 did not add a parallel animation stack. One property still owns one `Animatable<T>`:

```text
Animatable<T>
├── constant
├── motion driver
├── keyframes      ← completed in C2
└── binding        ← evaluation already exists; authoring remains later work
```

Authority policy:

- constant → keyframes: supported;
- keyframes → edited keyframes: supported;
- motion driver → keyframes: **not implicit**;
- binding → keyframes: **not implicit**.

An attempt to add a keyframe directly over a driver/binding returns `KEYFRAME_CONVERSION_REQUIRED`. A later explicit bake/reset workflow may replace those authorities deliberately. This prevents a component driver, a user keyframe track and CSS from competing for the same property.

## Canonical keyframe contract

C2 formalized:

```ts
interface MotionKeyframeV1<T> {
  readonly id: string
  readonly tick: number
  readonly value: T
  readonly interpolation: 'hold' | 'linear' | 'bezier'
  readonly bezier?: MotionBezierHandlesV1
}

interface MotionBezierHandlesV1 {
  readonly inX: number
  readonly inY: number
  readonly outX: number
  readonly outY: number
}
```

Compatibility aliases remain for the prior skeleton type names so existing serialized graph code does not require a breaking rename.

Stable keyframe ID is public identity. Array index is not.

`keyframed(...)` canonicalizes a track into ascending tick order and freezes the serialized data.

Same-property same-tick keyframes are rejected rather than given ambiguous ordering semantics.

## Exact-tick evaluator semantics

`evaluateAnimatable(...)` is now the single generic router for constants, motion drivers, keyframes and bindings. React/SVG runtime code consumes only resolved values.

Keyframe evaluation:

- before first keyframe → first value;
- exact keyframe tick → exact stored value;
- between keyframes → outgoing interpolation of the left segment;
- after final keyframe → final value.

A binary search finds the segment, so a 1,000-keyframe track does not require a linear scan on every evaluation.

### Hold

Between A and B, A remains authoritative. At B, B becomes exact immediately.

### Linear

Numeric values use deterministic scalar interpolation from exact integer ticks.

### Cubic Bezier

One segment uses:

- left keyframe `outX/outY`;
- right keyframe `inX/inY`.

Handle semantics:

- X is normalized segment time and must remain inside `[0,1]`;
- Y is normalized value progress and may intentionally overshoot;
- Y is bounded to `[-4,4]` to reject pathological/non-finite data.

Legacy keyframes with no explicit handles resolve through a mathematically linear cubic fallback.

## Typed interpolation policy

C2 does not pretend every property can be continuously interpolated.

Supported continuously in V1:

- numeric transform values;
- opacity;
- numeric shape/path/image properties;
- numeric effect parameters;
- numeric mask parameters.

Hold-only in V1:

- text/string values;
- booleans;
- colors/CSS strings.

Continuous color interpolation is deliberately deferred until Motion has one typed normalized color representation. Interpolating arbitrary CSS strings would be false capability.

## Validation

Scene validation now fails closed on:

- empty keyframe tracks;
- duplicate keyframe IDs;
- duplicate/same ticks;
- negative or non-safe-integer ticks;
- non-finite numeric values;
- mixed value types on one track;
- wrong value type for the target property;
- property-range violations such as opacity outside `[0,1]`;
- invalid interpolation;
- continuous interpolation on hold-only types;
- invalid/non-finite Bezier handles;
- effect parameters outside their registry ranges;
- unknown effect parameters;
- numeric mask values outside their V1 bounds;
- stale node/effect/mask targets.

Scene documents do not own composition duration, so the upper tick bound is enforced by operation application when the owning `durationTicks` is supplied. Motion Lab and `MotionComponentHost` both supply it.

## Universal C2 operations

The closed C1 operation vocabulary grew from 21 to **28** operation types with:

```text
add-keyframe
remove-keyframe
move-keyframe
set-keyframe-value
set-keyframe-interpolation
set-keyframe-bezier
clear-keyframes
```

New typed failure families:

```text
KEYFRAME_INVALID
KEYFRAME_UNSUPPORTED
KEYFRAME_COLLISION
KEYFRAME_CONVERSION_REQUIRED
```

### Important semantics

`add-keyframe`
- validates target, stable ID, tick, interpolation, value and optional Bezier data;
- constant → keyframes preserves the current constant if value is omitted;
- existing keyframe tracks may add an exact evaluated value at the requested tick if value is omitted;
- driver/binding conversion refuses explicitly;
- duplicate ID and duplicate tick are separate failures.

`remove-keyframe`
- preserves the removed identity in the inverse operation;
- if the last keyframe is removed, the property becomes a constant of that keyframe's value.

`move-keyframe`
- preserves keyframe ID;
- re-canonicalizes ordering;
- refuses collisions and out-of-duration ticks.

`set-keyframe-value`
- validates target type and property/effect/mask bounds.

`set-keyframe-interpolation`
- respects target interpolation capability.

`set-keyframe-bezier`
- validates handle bounds and supports removing explicit handles with `null`.

`clear-keyframes`
- requires an explicit finite fallback value;
- returns inverse operations sufficient to reconstruct the complete old track including IDs, ticks, values, interpolation and Bezier handles.

All seven operations participate in existing C1 atomic batches. A failed later operation exposes no partially committed scene.

## Timeline-track projection

C2 upgraded `MotionTimelineTrackV1` from a structural animation hint into useful compositor data:

```text
target
nodeId
nodeName
label
property
propertyType
allowed interpolation
animationKind
full keyframe objects
compatibility keyframeTicks
```

Projection includes:

- node properties;
- effect parameters;
- mask numeric parameters.

`deriveTimelineTrackGroups(scene)` groups those tracks by their real layer node, preparing C3/C4 without creating another animation store.

## Motion Lab development timeline

Advanced Motion Lab now contains a developer-only C2 timeline. It is not the final Dope Sheet or Curve Editor.

The UI supports:

- graph-derived numeric property selection;
- `◇` when current tick has no keyframe;
- `◆` when current tick has a keyframe;
- manual `+ Keyframe`;
- stable-ID keyframe strip;
- remove selected keyframe;
- edit numeric value;
- move exact keyframe tick;
- change Hold / Linear / Bezier where the target permits it;
- edit `outX/outY/inX/inY` numerically;
- seek through the existing exact-tick transport.

There is deliberately no production auto-key behavior in C2.

The timeline emits only `MotionGraphOperationV1`; it has no private animation store.

## Explicit Cost / Value Card proof

C2 includes a compositor-only proof operation batch exported from `packages/motion-library/src/c2-keyframe-proof.ts`.

It does not change Cost / Value Card JSX/default graph construction.

```text
Cost / Value Card
├── Surface opacity       0 → 1
├── Value scale X/Y       0.8 → 1.08 → 1
├── Arrow rotation       -20° → 0°
├── Value Glow intensity  0 → .6 → .2
└── Whole card Position Y 60 → 0
```

Because Surface opacity is authored by a component motion driver, the proof explicitly resets that single property authority to a constant before adding its keyframes. Other selected proof properties are constants and convert directly.

The same exported operation batch drives automated tests and the browser preset:

`?component=cost-value-card&proof=c2-cost`

## Determinism evidence

Automated keyframe tests prove:

- repeated same-tick equality;
- direct seek equality;
- backward seek equality;
- random seek equality;
- 1 / 2 / 10 / 100 / 1000-keyframe tracks;
- exact segment boundaries;
- serialization round trip.

The Cost Card proof test additionally evaluates a random/backward sequence and verifies the repeated target scene is deeply equal to direct evaluation.

### Real Edge direct-seek proof

Advanced Motion Lab opened the Cost Card C2 proof at exact tick `3,312,000` and selected real target:

`node:cost-card.value:transform.scaleX`

Browser actions:

1. `+ Keyframe` → `lab-kf-1` at `3,312,000`, `◇ → ◆`.
2. Set value to `1.04`.
3. Move stable keyframe ID to `3,500,000`.
4. Set interpolation to `bezier`.
5. Set handles `outX=.18`, `outY=1.2`, `inX=.78`, `inY=1`.
6. Seek `3,500,000 → 120,000 → 6,800,000 → 3,500,000`.

At the repeated target tick, the browser DOM snapshot of Value transform/filter/opacity, Arrow transform and Surface opacity was exactly equal to the first direct target snapshot.

Result: **directSeekEquality = true**.

No operation error appeared.

## Retained browser evidence

Keyframe proof sequence:

- `motion/visual-baselines/c2-cost-proof-start.png`
- `motion/visual-baselines/c2-cost-proof-linear-mid.png`
- `motion/visual-baselines/c2-cost-proof-bezier-mid.png`
- `motion/visual-baselines/c2-cost-proof-effect-peak.png`
- `motion/visual-baselines/c2-cost-proof-end.png`

Motion Lab authoring:

- `motion/visual-baselines/c2-keyframe-timeline-edited.png`
- `motion/visual-baselines/c2-keyframe-timeline-panel.png`

`c2-keyframe-timeline-panel.png` visibly shows the selected property, full diamond, stable keyframe ID, exact tick `3,500,000`, value `1.04`, Bezier interpolation and numerical handles.

## Default visual regression gate

Representative unchanged default components were recaptured after C2:

- Kinetic Headline
- Checklist Card
- Cost / Value Card
- Timer / Status Pill
- Team / Network Diagram
- Browser Demo
- Comment Highlight
- Dashboard Snapshot

Retained files are `c2-regression-*.png` in `motion/visual-baselines`.

Manual stage inspection found no unintended component composition/content/style regression. Browser Demo's post-C2 PNG is SHA-256 identical to its A17 baseline. Some complete Motion Lab screenshots differ in shell display scale because ResizeObserver/headless viewport-fit timing changed the workshop's displayed scale (for example 53% vs 44%); that is not a component-graph change. No existing 60 component implementation file was modified by C2.

## Performance evidence

All numbers below are local engineering measurements on Node `v24.14.1`, Windows x64 unless noted. They are not universal renderer budgets.

### Direct keyframe evaluator

100 keyframed properties × 10,000 arbitrary exact ticks = 1,000,000 property evaluations per case:

| Keyframes/property | Avg/property | Avg 100-property batch | Worst observed batch |
|---:|---:|---:|---:|
| 2 | 6.7664 µs | 0.6766 ms | 24.0034 ms |
| 10 | 2.7968 µs | 0.2797 ms | 9.2893 ms |
| 100 | 3.0152 µs | 0.3015 ms | 4.2691 ms |
| 1000 | 4.1808 µs | 0.4181 ms | 15.3759 ms |

The 1,000-keyframe case remains bounded by binary segment lookup rather than elapsed playback history.

### Full scene evaluation

Synthetic stress scene: 100 keyframed shape opacity properties × 100 keyframes/property, 100 full scene evaluations.

- total: 1649.977 ms;
- average: 16.4998 ms/scene;
- worst observed local sample: 92.4144 ms.

This path includes full scene validation on every evaluation and deliberately represents a much heavier graph than normal library components.

### Keyframe graph operations

Synthetic 100-node scene, 200 `move-keyframe` operations:

- total: 947.439 ms;
- average: 4.7372 ms/operation;
- worst observed local sample: 19.223 ms.

### Process observation

End-of-benchmark Node process:

- RSS: 166,100,992 bytes;
- heap used: 38,786,328 bytes.

This is process/JIT/GC context, not a product memory guarantee.

### Motion Lab Advanced DOM-commit latency

Real headless Edge, full Advanced C2 Cost Card proof, 100 exact-tick input changes:

- average dispatch→next-macrotask DOM commit: 75.771 ms;
- p95: 125.6 ms;
- worst: 143.1 ms.

This includes the entire development Lab/inspector React tree and headless scheduling. It is **not** paint time, production preview FPS, or Motion Graph evaluator cost. It provides a truthful workshop-UI optimization target for later compositor work.

## Performance-measurement failures retained

`MOTION-FAIL-006`: the first benchmark mixed the required direct evaluator stress with oversized repeated full-scene validation/operations and timed out. No number from that run was accepted.

`MOTION-FAIL-007`: a first real-browser next-paint script waited on `requestAnimationFrame` in headless/background Edge and timed out due scheduling throttling. No FPS/paint inference was made; the retained browser metric is DOM-commit latency instead.

## Final C2 mechanical gate

After all C2 implementation and browser work:

```text
motion-contract          3 / 3
motion-primitives       25 / 25
motion-graph            87 / 87
motion-native-runtime    3 / 3
motion-testing           5 / 5
motion-library         116 / 116
motion-lab              14 / 14
────────────────────────────────
TOTAL                  253 / 253
```

All **7 / 7 Motion workspace builds pass**.

## Authority / isolation gate

- no `Date.now`, `performance.now`, `Math.random`, timers, CSS keyframes or autonomous CSS animation authority in Motion Graph / component / runtime source;
- Motion Lab wall clock remains allowlisted only for translating Play into the next requested exact tick;
- no `apps/web` file changed;
- production `apps/web` imports no Motion Program package;
- no Remotion / Framer Motion / GSAP / Lottie / Rive / Three runtime dependency added;
- no Plan-B AI placement, component selection, graph planning, proposal generation or LLM decision logic added.

## C2 acceptance result

- [x] real keyframe schema
- [x] stable keyframe IDs
- [x] Hold
- [x] Linear
- [x] Bezier
- [x] exact tick evaluation
- [x] backward/direct/random seek
- [x] numeric/transform/opacity keyframes
- [x] numeric effect parameter keyframes
- [x] numeric mask parameter keyframes
- [x] typed keyframe operations
- [x] atomic transaction support
- [x] invalid-keyframe refusal
- [x] serialization round trip
- [x] useful timeline-track projection
- [x] Motion Lab development timeline
- [x] add/remove/move/value/interpolation/Bezier UI proof
- [x] default visual regression gate
- [x] measured performance
- [x] focused tests/builds
- [x] production isolation
- [x] Plan-B isolation

C3 Layers, Dope Sheet, Curve Editor, Node Graph, tracking, 3D, particles, shaders/plugins, production Studio integration and AI remain deliberately **not started**.
