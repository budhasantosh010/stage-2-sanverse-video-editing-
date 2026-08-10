# MOTION-A20 — Product Storytelling + YouTube Motion Pack

Date: 2026-08-10
Status: implementation + release-candidate verification complete; preserve as `motion-library-v1.4` before ABC integration
Parent checkpoint: `motion-compositor-c4` / `44f41fe377d627798624dec280dd0da1d882ec00`

## Goal

Add the missing reusable visual vocabulary for polished product/tech storytelling without copying the supplied commercial reference and without creating duplicates already covered by the 77-component library.

A20 remains Plan A capability. It does not decide when a graphic should be used; B0 owns semantic intent/proposal. It does not create a second animation editor; C2/C3/C4 remain the control authorities.

## Coverage audit before implementation

Rejected as new public components:

- Semantic Highlight Headline → existing Kinetic Headline gained a typed `highlight-box` emphasis treatment and C2-keyframed semantic highlight.
- Picture-in-Picture Product Transition → reusable analytic `pictureInPictureTransition(...)` primitive.
- Soft Product Backdrop → decorative treatment only.
- Application Window Reveal → existing Browser Demo/window vocabulary + motion events.
- Lower Third → existing `sanverse.lower-third-title`.

Added six genuinely distinct components:

1. `sanverse.conversation-toast-stack`
2. `sanverse.floating-prompt-composer`
3. `sanverse.product-ui-story-scene`
4. `sanverse.agent-work-log`
5. `sanverse.scoped-access-comparison`
6. `sanverse.keyword-brand-lockup`

Public catalog: **77 → 83**.

## Shared product-story primitives

`packages/motion-primitives/src/product-story.ts` adds:

- seven semantic safe-placement anchors;
- deterministic composition-space `resolveProductStorySafePlacement(...)`;
- analytic `pictureInPictureTransition(...)` for scale/translation/opacity/radius scene treatment.

The primitives are pure inputs → outputs. They use no wall clock, random state or animation history.

A20 Family props expose semantic `placement` and bounded `safeOffset` to Creator/Designer controls. Invalid placement and offsets outside `[0,240]` refuse rather than silently moving content.

## Motion / editability

All six new components use the canonical Sanverse tick authority and declare **1.5–12 second** windows. Normal entrances use exact C2 keyframe tracks for opacity/position/scale/item sequencing. Reduced motion replaces authored entrance keys with final constants while preserving all semantic text.

Every A20 scene projects through:

```text
Motion Scene
  → C3 Layers
  → C4 dope-sheet tracks/keyframes
```

The retained Compositor screenshot opens Product UI Story Scene with nested `family.product-ui-story-scene.title` selected. The same Title shows opacity, Y-position, scale-X and scale-Y C2 tracks in C4.

Motion events include:

- `message-1/2/3`
- `composer-open`, `type-reveal`, `send-ready`
- `window-open`, `ui-content-append`, `scroll-to-focus`, `workflow-ready`
- `agent-working`, `agent-complete`
- `left-context`, `right-context`, `comparison-ready`
- `keyword`, `brand-lockup`

These names are future Plan-B alignment handles; A20 itself makes no transcript decision.

## Automated verification

Focused A20 suite proves:

- six distinct modules and 83-item public catalog;
- exact deterministic forward/backward/random seek at 1.5, 2.5, 5, 10 and 12 seconds;
- refusal below 1.5 seconds and above 12 seconds;
- all seven semantic placements + invalid placement/offset refusal;
- four ratios × all eight existing style packs;
- C2 keyframes, C3 Layers and C4 projection;
- reduced-motion semantic equality;
- required product-story motion events.

Kinetic Headline additionally proves the new semantic `highlight-box` treatment creates real C2 opacity/scale tracks without replacing the default headline behavior.

## Real Edge visual QA

All retained evidence is generated from first-party/generic fixtures. No source video frame or commercial logo is committed.

Accepted baseline set:

- `a20-toast-16x9-editorial-busy.png`
- `a20-toast-9x16-creator-energetic-busy.png`
- `a20-prompt-9x16-glass-white.png`
- `a20-product-ui-16x9-tech-ui-busy.png`
- `a20-product-ui-4x5-sanverse-clean-black.png`
- `a20-agent-log-4x5-dark-minimal-neutral.png`
- `a20-scoped-access-1x1-sketch-white.png`
- `a20-brand-lockup-9x16-retro-neon-black.png`
- `a20-semantic-highlight-16x9-tech-ui-busy.png`
- `a20-agent-log-reduced-16x9-clean-busy.png`
- `a20-product-ui-c4-compositor-16x9.png`

Across the set: all eight style packs are represented; 16:9, 9:16, 1:1 and 4:5 are represented; busy, white, neutral and black footage-like backgrounds are represented; reduced motion and real C3/C4 editability are represented.

### Visual failure found and fixed

`MOTION-FAIL-017`: the first Toast Stack used a three-column grid with one text child, collapsing text into a 42px column. That screenshot was rejected. The row structure was corrected, tests/builds reran and both landscape/portrait Toast evidence was recaptured successfully.

## Performance truth

Local development measurement across **6 components × 8 styles × 4 ratios = 192 combinations**, repeated five times (**960 iterations**):

- scene create + exact-tick evaluation + C3 projection + C4 projection: **0.739 ms average**, **1.333 ms p95**;
- SSR component markup: **1.110 ms average**, **2.189 ms p95**;
- average scene: **11.83 nodes**, **26.33 tracks**, **107.33 keyframes**.

These are engineering/JIT measurements, not FPS or browser paint-time claims.

## Fresh release-candidate verification

```text
creative-direction       26 / 26
motion-contract           3 / 3
motion-primitives        29 / 29
motion-graph            120 / 120
motion-native-runtime     4 / 4
motion-testing            5 / 5
motion-library          160 / 160
motion-lab               31 / 31
---------------------------------
TOTAL                   378 / 378

Builds                     8 / 8
```

Motion Lab retains its pre-existing non-failing Vite large-chunk warning. It is a development workshop bundle note, not a functional A20 failure.

## Acceptance

- [x] current 77-component inventory audited first
- [x] duplicate candidates rejected/generalized
- [x] six missing product-story components added
- [x] Semantic Highlight implemented as existing Kinetic Headline variant
- [x] PIP/safe placement implemented as reusable primitives
- [x] no source-brand assets/logos/screenshots committed
- [x] exact canonical ticks / C2 keyframes
- [x] four ratios
- [x] eight style packs
- [x] semantic safe placement + offset
- [x] reduced motion
- [x] hostile footage-style backgrounds
- [x] motion events
- [x] C3 Layers + C4 timeline proof
- [x] performance measured
- [x] real Edge visual review
- [x] 378/378 tests
- [x] 8/8 builds
- [x] `apps/web` untouched
