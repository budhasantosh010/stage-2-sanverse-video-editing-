# MOTION-A18 — Keyframe-Native Creator Pack

Date: 2026-08-09
Status: COMPLETE — implementation, mechanical verification, browser review, measured performance and Git closeout evidence
Parent checkpoint: `motion-compositor-c2` / `735bc9730233c00b6f23cdbe42b50f3eb8f91d5a`

## Goal

Stress the completed C2 deterministic keyframe engine with a small set of genuinely missing creator-facing communication scenarios rather than increasing the library with near-duplicate cards.

The 60-component coverage matrix was re-read before selection. Candidates that substantially overlapped existing Question Title, Before / After, Myth vs Fact, Chapter Title, Single Metric, Comment Highlight, Cursor Callout, Milestone Status, Step List / Progress Status or existing comparison surfaces were rejected.

## Components added

A18 adds nine first-party graph-native modules, taking the public catalog from 60 to **69**:

1. `sanverse.keyword-slam` — setup resolves into one decisive keyword.
2. `sanverse.three-beat-headline` — three sequential hook beats plus payoff.
3. `sanverse.stacked-hook` — three escalating stacked lines rather than one flat headline.
4. `sanverse.sentence-deconstruction` — one claim split into semantic fragments for explanation.
5. `sanverse.punch-word-reveal` — readable setup followed by one isolated punch word.
6. `sanverse.poll-vote-result` — ranked vote bars with an explicit winner.
7. `sanverse.ranking-podium` — first/second/third hierarchy rather than a generic numbered list.
8. `sanverse.app-feature-spotlight` — one software feature with supporting detail rather than a full dashboard.
9. `sanverse.keyboard-shortcut-callout` — keycaps plus a software action label.

The nine share the mature family content/style/exposure contract, but each owns a distinct rendering branch and all nine use C2 keyframes for their authored default motion. Existing 60 component implementations remain on their existing authored-motion paths.

## Exact-tick animation contract

For A18 components, default scene creation uses C2 `keyframed(...)` Animatable tracks for opacity, Y position and scale. Beat/item timing is expressed as exact Sanverse ticks derived from the owning component duration. No history replay, wall-clock time, random value or CSS animation is animation authority.

Reduced motion is explicit: authored A18 keyframe tracks are replaced by stable final constants when `reducedMotion=true`. Semantic text and useful layout remain present.

## Duration contract

All nine declare a minimum duration of **0.75 s** and maximum of **8 s**.

Defaults:

| Component | Default |
|---|---:|
| Keyword Slam | 2.0 s |
| Three-Beat Headline | 2.0 s |
| Stacked Hook | 2.0 s |
| Sentence Deconstruction | 2.4 s |
| Punch Word Reveal | 1.8 s |
| Poll / Vote Result | 2.2 s |
| Ranking Podium | 2.2 s |
| App Feature Spotlight | 2.4 s |
| Keyboard Shortcut Callout | 1.8 s |

Mechanical tests cover 0.75, 1.0, 1.5, 2.0, 3.0 and 5.0 seconds. Durations below 0.75 seconds and above 8 seconds fail closed during graph construction.

## Mechanical verification

The A18 focused suite adds 18 tests covering:

- all nine selected IDs;
- C2 keyframe tracks in every default graph;
- graph validation and compositor readiness;
- all four reference ratios (`16:9`, `9:16`, `1:1`, `4:5`);
- all eight shared style packs;
- the short-duration matrix;
- exact-tick direct/backward/random seek equality;
- reduced motion semantic preservation;
- Creator / Designer / Advanced / Level-4 exposure/readiness behavior;
- Unicode text;
- punctuation;
- duplicate words;
- large numerals;
- multiline content;
- very long single words;
- typed refusal for over-limit content.

Latest complete Motion workspace matrix after A18:

```text
@sanverse/motion-contract         3 / 3
@sanverse/motion-primitives      25 / 25
@sanverse/motion-graph           87 / 87
@sanverse/motion-native-runtime   3 / 3
@sanverse/motion-testing          5 / 5
@sanverse/motion-library        134 / 134
@sanverse/motion-lab             14 / 14
----------------------------------------
TOTAL                           271 / 271
```

All **7/7 Motion workspace builds passed**.

Motion Lab production build emitted a non-failing Vite chunk-size warning because the development workshop bundle is about 502.61 kB minified. No chunking architecture was changed merely to hide that warning.

## Real-browser visual evidence

Every retained A18 screenshot was captured from a live Motion Lab HTTP-200 URL in real Microsoft Edge and then manually inspected. The nine shots deliberately distribute the batch across all eight shared styles, all four reference ratios, busy backgrounds and reduced motion instead of generating redundant 8 × 9 screenshots.

Retained baselines:

- `motion/visual-baselines/a18-keyword-slam-energetic-busy-9x16.png`
- `motion/visual-baselines/a18-three-beat-headline-clean-16x9.png`
- `motion/visual-baselines/a18-stacked-hook-dark-9x16.png`
- `motion/visual-baselines/a18-sentence-deconstruction-editorial-4x5.png`
- `motion/visual-baselines/a18-punch-word-retro-busy-1x1.png`
- `motion/visual-baselines/a18-poll-result-glass-9x16.png`
- `motion/visual-baselines/a18-ranking-podium-tech-ui-16x9.png`
- `motion/visual-baselines/a18-app-feature-sketch-4x5.png`
- `motion/visual-baselines/a18-keyboard-shortcut-clean-reduced-1x1.png`

### Visual defect found and fixed

The first Stacked Hook 9:16 review showed the three lines too small relative to the real 1080×1920 composition. The component-space line sizes were increased, the focused 18-test A18 suite and motion-library build were rerun successfully, and the portrait baseline was recaptured and manually accepted. The weaker first screenshot is not the retained evidence.

## Measured performance

A fresh local warm development-process measurement covered the final **69-component** catalog across all four ratios:

### Full public catalog

- Graph create + exact-tick evaluate: 1,380 operations in 559.804 ms.
- Average graph create + evaluate: **0.4057 ms**.
- p95: **1.2879 ms**.
- Worst local sample: **14.646 ms**.
- SSR markup: 552 renders in 863.193 ms.
- Average SSR render: **1.5638 ms**.
- SSR p95: **2.9823 ms**.
- Worst local SSR sample: **21.0042 ms**.
- Mean markup size: **2,181 bytes**.

### Nine A18 keyframe-native components

Measured over 9 components × 8 style packs × 4 ratios = 288 graph create+evaluate operations:

- total: 94.486 ms;
- average: **0.3281 ms**;
- p95: **0.6476 ms**;
- worst local sample: **1.1173 ms**.

These are local engineering measurements with runtime/JIT/GC noise. They are not universal browser-frame or production-memory guarantees.

The first standalone A18 performance harness was invalid because the temporary `tsx` runner did not provide the classic JSX `React` global expected by an existing component module. No numbers from that failed attempt were retained. The temporary harness was corrected and rerun to produce the measurements above.

## Originality / provenance

The nine designs are first-party Sanverse compositions built from existing text, shape, graph, style-pack and C2 keyframe primitives. No commercial template, logo, proprietary screenshot, external animation runtime or copied visual asset was used. Default product/client names are invented or Sanverse-local.

The generic communication principles used—sequential emphasis, ranked choices, podium ordering, semantic sentence fragments, feature spotlighting and keyboard-shortcut teaching—are not proprietary assets.

## Production isolation

A18 does not modify or integrate `apps/web`. It adds no Plan-B AI decision logic and starts no C3 layer-hierarchy work.

## Gate result

MOTION-A18 is technically and visually complete when this evidence is committed with:

- 69 public components;
- 271/271 Motion tests;
- 7/7 Motion workspace builds;
- all nine retained browser baselines manually inspected;
- 4-ratio and 8-style mechanical coverage;
- reduced-motion and exact-seek coverage;
- measured performance documented;
- final source-boundary scans clean;
- separate A18 commit pushed and verified;
- `motion-library-v1.2` pushed and verified.

MOTION-C3 remains **not started**.
