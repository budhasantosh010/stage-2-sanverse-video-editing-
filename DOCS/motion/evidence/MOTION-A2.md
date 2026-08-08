# MOTION-A2 Evidence — Checklist Card V1

Date: 2026-08-07

## Outcome

`sanverse.checklist-card` is the second vertically complete proof component. It is a typed, first-party card for short requirements/progress lists with exact-tick row reveal and check-state motion.

## Content/style contract

Content:

- eyebrow: optional, max 32 characters
- title: required, max 80 characters
- items: 1–6
- stable lowercase item ids, unique
- row label: 1–72 characters
- row state: `complete | pending`
- footer: optional, max 72 characters

Style comes from shared style-pack tokens with bounded text/accent/surface/motion overrides. The same Checklist implementation renders Sanverse Clean and Creator Energetic.

## Responsive fit

`validateChecklistCardFit` derives geometry from composition dimensions only. It owns:

- landscape / portrait / square layout kind
- card width/height and padding
- icon size and row gaps
- deterministic title and row text fitting
- title/row minimum readable font sizes
- explicit title/row line plans
- maximum allowed composition height

If one word cannot fit or the fully fitted card would exceed the composition height, the component returns `CONTENT_IMPOSSIBLE`; it does not crop, hide, rewrite, or shrink below declared minimums.

The declared maximum six normal rows passes fit in 16:9, 9:16, 1:1 and 4:5.

## Exact-tick motion

Pure state evaluation derives:

- panel reveal/exit
- title reveal
- row stagger
- check-path draw progress for complete items only
- deterministic spring check scale
- progress-bar reveal
- reduced-motion replacement

Pending rows keep `checkProgress = 0`. Reduced motion removes row translation and spring scale while preserving a short useful reveal.

Repeated exact ticks after forward/backward calls produce identical state and identical server-rendered markup.

## Mechanical verification

Final focused suites: **70/70 passed**.

- motion-contract: 3
- motion-primitives: 19
- motion-native-runtime: 2
- motion-testing: 5
- motion-library: 35 total (Headline 17 + Checklist 18)
- motion-lab: 6

All six motion workspaces build successfully.

Checklist tests cover:

- closed metadata/fixtures
- 0/>6 item refusal
- duplicate-id refusal
- row text maximum
- fit in all four ratios
- maximum six normal rows in all four ratios
- impossible unbreakable row refusal
- repeated exact-tick state/markup determinism
- completed vs pending check behavior
- reduced motion
- explicit row/text/SVG output
- shared style-pack reuse

Component source scan found no `Date.now`, `performance.now`, `Math.random`, timers, CSS keyframes or autonomous `.animate()` calls.

## Motion Lab integration

Checklist Card is the second selectable catalog item in the same internal Lab. It has component-specific editing for eyebrow, title, newline-separated rows, completed-row count and footer while sharing the exact-tick transport, ratios, style pack, colors, intensity, reduced motion, background and debug controls.

A pure `resolveInitialTick` helper now distinguishes a missing `tick` URL query from explicit tick `0`, with regression coverage.

## Inspected browser evidence

- `motion/visual-baselines/a2-checklist-card-settled-16x9.png`
- `motion/visual-baselines/a2-checklist-card-six-items-9x16.png`
- `motion/visual-baselines/a2-checklist-card-settled-1x1.png`
- `motion/visual-baselines/a2-checklist-card-settled-4x5.png`
- `motion/visual-baselines/a2-checklist-card-energetic-busy.png`
- `motion/visual-baselines/a2-checklist-card-reduced-motion-early.png`
- `motion/visual-baselines/a2-checklist-card-content-refusal.png`

Observed:

- 16:9 has clear title/progress/list/footer hierarchy
- six-row portrait remains contained and readable
- square and 4:5 reflow naturally
- busy-background Creator Energetic remains readable through the card surface
- reduced-motion early state reveals useful content without row translation/spring
- invalid unbreakable portrait row shows the explicit Lab refusal surface

## Browser-found defect

The first Checklist screenshot opened at tick 0 because `Number(null)` converted a missing query parameter to zero. The component was correct; the Lab URL preset parser was wrong. This is recorded as `MOTION-FAIL-001`, fixed with `resolveInitialTick` and a regression test.

## Performance/originality

Performance class: `light`. Work is bounded by six rows and 72 characters per row. No network/render-history dependency exists. The SVG check icon is first-party shape geometry; no third-party graphical asset is used.

## Gate

MOTION-A2: **complete for technical + inspected visual evidence**.
