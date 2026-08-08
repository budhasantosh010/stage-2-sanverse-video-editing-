# MOTION-A3 Evidence — Cost / Value Card V1

Date: 2026-08-07

## Outcome

`sanverse.cost-value-card` is the third vertically complete proof component. It communicates a baseline/cost against an outcome/value with deterministic number emphasis and composition-aware horizontal/stacked layouts.

## Shared numeric primitive

`motion-primitives/numbers.ts` adds deterministic, history-free numeric tools:

- `interpolateNumber(start, end, progress, rounding)`
- `formatCompactNumber` with K/M/B suffixes and no locale dependency
- `formatSignedDelta`

The same progress always produces the same number regardless of seek order.

## Content/style contract

Each metric contains label, finite non-negative value, short prefix/suffix and optional note. Values are bounded to 0..1 trillion. Labels/prefix/suffix/notes/title/footer have explicit maximum lengths.

Style derives from shared packs. Cost uses semantic danger color; value uses semantic accent. The component implementation remains shared across Sanverse Clean and Creator Energetic.

## Responsive fit

`validateCostValueCardFit` derives geometry from composition dimensions only:

- 16:9 => horizontal cost → value comparison
- 9:16, 1:1, 4:5 => stacked cost ↓ value
- deterministic title/label/number text plans
- minimum readable font sizes
- bounded card height
- typed `CONTENT_IMPOSSIBLE` refusal when content cannot fit

All four ratio fixtures fit at declared minimums.

## Exact-tick motion

Pure state derives panel/title/cost/value/arrow reveals, directional entrance, deterministic spring arrow emphasis, two number-count phases, hold and exit.

Repeated exact ticks after arbitrary forward/backward calls return identical state and markup. Reduced motion removes directional movement and spring scale while preserving the semantic numbers at their final values.

## Mechanical verification

Final motion-only suites: **90/90 passed**.

- motion-contract: 3
- motion-primitives: 24
- motion-native-runtime: 2
- motion-testing: 5
- motion-library: 50 total (Headline 17 + Checklist 18 + Cost / Value 15)
- motion-lab: 6

All six motion workspaces build successfully.

Component source scan found no `Date.now`, `performance.now`, `Math.random`, timers, CSS keyframes or autonomous `.animate()` calls.

## Motion Lab integration

Cost / Value is the third selectable catalog component. Its inspector edits eyebrow/title, cost label/prefix/value/note, value label/prefix/value/note and footer while sharing ratios, exact transport, styles, backgrounds, reduced motion and debug controls.

## Inspected browser evidence

- `motion/visual-baselines/a3-cost-value-card-settled-16x9.png`
- `motion/visual-baselines/a3-cost-value-card-settled-9x16.png`
- `motion/visual-baselines/a3-cost-value-card-settled-1x1.png`
- `motion/visual-baselines/a3-cost-value-card-settled-4x5.png`
- `motion/visual-baselines/a3-cost-value-card-reduced-early.png`
- `motion/visual-baselines/a3-cost-value-card-energetic-busy.png`

Observed:

- landscape is a true side-by-side comparison with large cost/value numbers and horizontal arrow
- portrait/square/4:5 switch to stacked hierarchy rather than shrinking the wide layout
- semantic red cost and accent value remain visually distinct
- Creator Energetic stays readable on the deliberately busy background due to the card surface
- reduced motion keeps final semantic values while removing directional/spring movement

## Performance/originality

Performance class: `light`. Work is fixed-size text/card/SVG-style DOM with bounded labels and values. There is no network work, per-frame retained state or external asset. The composition is first-party Sanverse UI using text, surfaces and a Unicode direction arrow.

## Gate

MOTION-A3: **complete for technical + inspected visual evidence**.
