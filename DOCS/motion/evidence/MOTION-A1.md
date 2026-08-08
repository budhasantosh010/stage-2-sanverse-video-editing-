# MOTION-A1 Evidence — Kinetic Headline V1

Date: 2026-08-07

## Outcome

`sanverse.kinetic-headline` now owns a deterministic text-fit and explicit line-break plan instead of delegating line wrapping to browser CSS.

## Text fitting contract

Shared `motion-primitives/text-fit` provides:

- deterministic glyph-width estimation across Latin, digits, punctuation, CJK/wide Unicode and emoji ranges
- greedy word-line planning from explicit token indices
- preferred font size with bounded whole-pixel reduction
- declared minimum readable font size
- max-line enforcement
- typed failure when one token is too wide
- typed failure when copy still needs too many lines at minimum size

Kinetic Headline converts those failures to `CONTENT_IMPOSSIBLE` rather than cropping, hiding, rewriting or shrinking essential text below minimum.

## Rendering contract

The component state contains exact line ranges and estimated widths. React renders explicit `data-motion-line` nodes with `white-space: nowrap`; browser text wrapping is no longer layout authority.

## Verification

Final motion-only suite: **51/51 passed**.

- motion-contract: 3
- motion-primitives: 19
- motion-native-runtime: 2
- motion-testing: 5
- motion-library: 17
- motion-lab: 5

All six workspaces build successfully.

New headline tests prove:

- line width <= composition content width across 16:9, 9:16, 1:1 and 4:5
- font size >= declared minimum
- portrait and square use explicit two-line plans for the default copy
- mixed Unicode measurements are finite
- unbreakable long token refuses
- excessive one-line copy refuses
- repeated fit calls return identical plans
- repeated exact ticks still return identical state/markup after text-fit integration

## Browser evidence inspected

- `motion/visual-baselines/a1-kinetic-headline-fit-16x9.png`
- `motion/visual-baselines/a1-kinetic-headline-fit-9x16.png`
- `motion/visual-baselines/a1-kinetic-headline-content-refusal.png`
- `motion/visual-baselines/a1-kinetic-headline-unicode-9x16.png`

Observed:

- 16:9 uses one explicit line at a whole-pixel fitted size
- 9:16 uses two explicit lines at a whole-pixel fitted size
- impossible 120-character unbreakable token displays the Lab refusal surface and the specific inspector reason
- CJK, Arabic, multiplication sign and emoji render without missing-glyph boxes in the tested system-font environment

The mixed-direction Unicode sample relies on the browser's Unicode bidirectional text rendering inside each explicit line; Plan A does not implement a custom bidi engine.

## Performance review

Class remains `light`. Work is bounded by the headline's 180-character limit. Fitting tries a finite whole-pixel font-size sequence and scans bounded tokens; no network work, timers, autonomous animation loops, persistent physics or unbounded elapsed-time allocation occurs. No numerical frame-time guarantee is claimed yet.

## Originality/provenance

The component is a first-party Sanverse composition using text, CSS surfaces and no third-party graphical assets. Initial fonts are system stacks documented in `motion/fonts/README.md`.

## Gate

MOTION-A1: **complete for technical + inspected visual evidence**.
