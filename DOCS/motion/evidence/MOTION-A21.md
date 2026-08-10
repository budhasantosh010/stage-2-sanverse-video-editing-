# MOTION-A21 — Creator Utility + Advanced Visual Pack Evidence

Date: 2026-08-10
Status: complete; preserved by dedicated checkpoint tag `motion-library-v1.5`

## Audit decision

The complete 83-component catalog was audited before implementation. A21 rejected generic bar charts, another roadmap/timeline, another screenshot/cursor focus, another KPI dashboard, another logo cloud and another before/after card because existing components already own those jobs.

Six structurally missing creator/explainer jobs were selected:

1. `sanverse.trend-line-chart` — ordered numeric change over time/categories;
2. `sanverse.donut-breakdown` — part-to-whole composition;
3. `sanverse.venn-intersection` — set/idea intersection;
4. `sanverse.feature-comparison-table` — aligned multi-criteria comparison;
5. `sanverse.code-diff-spotlight` — code change as the explanation;
6. `sanverse.terminal-command-story` — one terminal command + bounded output/result.

Public catalog: **83 → 89**.

Coverage audit: `DOCS/motion/COMPONENT_COVERAGE_MATRIX.md`.

## Architecture

All six are first-party Family modules using the existing Motion Graph authority. They add no chart runtime, SVG animation system, keyframe document or style-pack fork.

Every module provides:

- stable `family.<variant>.*` node IDs;
- Creator / Designer / Advanced exposures through the shared family shell;
- exact C2 keyframed opacity/position/scale authoring;
- C3 Layer projection;
- C4 dope-sheet projection;
- editable numeric C5 curve tracks;
- deterministic direct-seek behavior;
- reduced-motion final constants;
- four ratios;
- all eight shared style packs;
- original generic fixtures.

Shared authoring window: **1–10 seconds**.

## Focused automated proof

`packages/motion-library/src/components/a21-creator-wow-pack.test.tsx` covers:

- exactly six distinct A21 IDs;
- deliberate non-selection of Poll Result, Journey Map, Browser Demo and Cursor Callout aliases;
- Motion Scene validation and compositor readiness;
- C3 + C4 + editable C5 projection for every component;
- exact-seek determinism at 1 / 1.5 / 3 / 5 / 10 seconds;
- fail-closed durations outside 1–10 seconds;
- all **6 × 4 ratios × 8 style packs = 192** combinations;
- reduced-motion semantic preservation with entrance keyframes replaced by constants;
- maximum valid text density (96-char title, 140-char subtitle, 48-char value, six 72-char rows);
- fail-closed over-limit title/item input;
- originality fixture scan and semantic event publication.

Focused result: **12/12 PASS**.

The complete Motion Library after A21 is **172 tests before the dedicated performance case / 173 including performance** and the catalog is **89**.

## Performance

`packages/motion-library/src/components/a21-performance.test.tsx` measures the complete 192-combination matrix repeated three times (**576 iterations**), including real scene construction, exact evaluation, C3, C4, C5 and SSR markup.

Fresh focused measurement:

```text
A21_PERF combinations=192 iterations=576
scene + evaluate + C3 + C4 + C5: 1.361 ms average / 2.670 ms p95
SSR markup:                      1.656 ms average / 2.999 ms p95
average scene:                   12.67 nodes / 29.67 tracks / 120.67 keys
```

These are local engineering/JIT measurements, not FPS or browser-paint guarantees.

## Real browser / WOW review

Retained real Edge evidence deliberately varies ratio, style and hostile background:

- `motion/visual-baselines/a21-trend-line-chart.png` — 16:9 Editorial / busy;
- `motion/visual-baselines/a21-donut-breakdown.png` — 9:16 Dark Minimal / busy;
- `motion/visual-baselines/a21-venn-intersection.png` — 1:1 Glass / neutral;
- `motion/visual-baselines/a21-feature-comparison-table.png` — 4:5 Tech UI / busy;
- `motion/visual-baselines/a21-code-diff-spotlight.png` — 16:9 Retro / Neon / black;
- `motion/visual-baselines/a21-terminal-command-story.png` — 9:16 Creator Energetic / busy / reduced motion;
- `motion/visual-baselines/a21-trend-c3-c4-c5.png` — Trend Line Chart in the real Compositor with C3 selection and C5 Value Graph.

The manual WOW/readability gate uses five explicit checks: one-glance purpose, readable hierarchy, distinctness versus the existing library, hostile-background survival, and useful motion/compositor structure. All retained scenes pass all five after one rejection/fix.

`MOTION-FAIL-020`: the first 9:16 Terminal capture was mechanically valid but too small at realistic preview scale. Compact terminal command/output/result type and spacing were increased, then the portrait/busy/reduced-motion screenshot was recaptured and accepted.

## Provenance

No commercial template, proprietary logo, screenshot, source-video frame, chart library or external animation runtime was copied/imported. A21 uses generic information-design primitives expressed entirely through Sanverse-owned React/Motion Graph structures.

## Release boundary

A21 does not modify `apps/web` and does not integrate the production editor. It does not start A22, B2/B3 or C6. The next step after the dedicated A21 checkpoint is the separate ABC-2 source→B1→B0→Plan A→C3→C4→C5 integration proof.
