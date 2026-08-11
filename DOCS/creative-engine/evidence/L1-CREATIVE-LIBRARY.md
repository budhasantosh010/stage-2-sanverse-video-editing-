# SANVERSE CREATIVE ENGINE L1 — Creative Library Evidence

Date: 2026-08-11
Status: **IMPLEMENTATION + LOCAL ACCEPTANCE COMPLETE**
Release policy: **local Git only** at owner request; no GitHub push/remote parity until re-authorized next month.

## Delivered

L1 adds the development-only Creative Library over the existing 89-component Plan-A catalog:

- one-registry typed catalog/discovery metadata;
- deterministic search/filter/sort/tabs/collections;
- static poster grid with at most one inline real Motion preview;
- exact component detail player with presentation controls and Lab/Compositor deep links;
- collection/current-filter showreel;
- durable local review schema/store/queue;
- full canonical 1× gating for Passed reviews;
- deterministic poster generation/freshness hashes;
- real Edge 1× audit surface/tooling;
- complete catalog motion-taste audit;
- browser/accessibility/performance proof.

No A22, B2/B3, C6 or production Studio integration was added.

## Catalog / review truth

Public component count remains **89** and is derived from the existing Motion registry.

| Result | Count |
|---|---:|
| Passed | 89 |
| Needs Polish | 0 |
| Rejected | 0 |
| Unreviewed | 0 |
| S tier | 13 |
| A tier | 35 |
| B tier | 41 |
| C / Experimental | 0 |

Quality tier is deliberately separate from pass/fail. Simple clean utility motion can be Passed + B while the strongest reusable scenes are S/A.

Durable artifact: `motion/library-reviews/reviews.v1.json`.

## Posters

All **89** public components have deterministic 480×270 posters under `motion/library-previews/posters/` with hashes in `poster-manifest.v1.json`.

Final freshness rerun:

```text
POSTER_SUMMARY selected=89 generated=0 skippedFresh=89 catalog=89
```

The full poster contact sheet was manually inspected. No commercial template/source-video frame/third-party brand asset was introduced.

## Real motion proof — 89/89 at 1×

This gate did not infer quality from static screenshots or tests. For every public component, local Edge opened `/library/audit/:componentId`, ran the real `LibraryPlayer` from tick 0 to canonical end at **1×**, and waited for the player's own full-playback marker. Temporal frames were captured and visually reviewed across entrance → progression/build → hold/payoff → exit.

Final runtime evidence:

```text
entries: 89
unique component IDs: 89
fullPlaybackVerified=true: 89
duplicates: 0
```

One long-lived headless Edge session accumulated navigation latency after several completed animations. This was not mislabeled as a component failure. The audit runner was made resumable/chunkable; all 89 then completed their actual 1× runs. Full-size checks for small-looking filmstrip cases confirmed the real 960×540 render remained readable.

No blocking motion/readability problem remained in the canonical presentations, so all 89 are honestly recorded Passed with differentiated S/A/B tiers.

## Retained real-Edge evidence

- `motion/visual-baselines/l1-library-all.png`
- `motion/visual-baselines/l1-library-youtube.png`
- `motion/visual-baselines/l1-library-wow.png`
- `motion/visual-baselines/l1-library-product-storytelling.png`
- `motion/visual-baselines/l1-library-recent.png`
- `motion/visual-baselines/l1-library-search-agent.png`
- `motion/visual-baselines/l1-library-detail.png`
- `motion/visual-baselines/l1-library-showreel.png`
- `motion/visual-baselines/l1-library-review.png`
- `motion/visual-baselines/l1-library-passed.png`

The final detail capture proves URL-restored 9:16 + Retro/Neon + busy background plus persisted `S · PASSED`, stored canonical 1× verification and populated review scores/notes.

## Browser performance / accessibility

Final local Edge engineering measurements:

```text
/library (89 cards): ready 1419.9 ms; DCL 896.1 ms; DOM 1465; live players 0
search agent (3 cards): ready 582.2 ms; DCL 452.4 ms; live players 0
detail: ready 437.0 ms; DCL 251.1 ms; live players 1
showreel 89: ready 296.1 ms; DCL 212.0 ms; live players 1
review queue: ready 414.3 ms; DCL 277.7 ms; live players 0
first inline preview activation: 208.4 ms; live players 1
```

Across Library/search/detail/showreel/review:

```text
unnamed interactive controls: 0
images without alt: 0
review endpoint records loaded: 89
```

Synthetic metadata measurements cover filter/sort at 89/150/300/500 entries and search at 100/500/1000 entries; final 1000-entry `percentage` search measured 27.098 ms. These are engineering measurements, not production SLA/FPS claims.

## Fresh affected tests

| Workspace | Result |
|---|---:|
| creative-direction | 27/27 |
| motion-contract | 3/3 |
| motion-primitives | 29/29 |
| motion-graph | 131/131 |
| motion-native-runtime | 4/4 |
| motion-testing | 5/5 |
| video-understanding | 17/17 |
| motion-library | 187/187 |
| motion-lab | 55/55 |
| **Total** | **459/459** |

C5's 10,000-key development render stress is unchanged but now uses an explicit 15-second bounded test timeout so valid heavy stress is not confused with Vitest's default timeout.

## Builds / isolation

Fresh root all-workspace production build: **PASS** for all 14 build-script workspaces (including production `web`, which L1 did not modify).

Known non-failing advisories remain Vite large-chunk warnings and the pre-existing production runtime asset URL notice.

Isolation/dependency gates:

- `git diff -- apps/web`: **empty**;
- `git diff --check`: **pass** (line-ending advisory only);
- `framer-motion`, `gsap`, `animejs`, `@motionone` dependency scan: **no matches**;
- no second Motion Graph, Layer tree, keyframe store or animation clock;
- no A22, B2/B3, C6 or production Library integration.

## L1 failures corrected

1. The first Vite persistence config imported the full React/TSX Motion Library into the Node-only config compiler. The dev persistence boundary was separated from TSX while the browser/domain validator remains authoritative.
2. The first long audit browser accumulated navigation latency. The runner now supports bounded `--from/--limit` chunks; 89/89 actual runs completed.
3. Persisted review data arrived asynchronously after detail/showreel form initialization, creating a Passed badge with stale Unreviewed fields. The editor now synchronizes when persisted review data arrives; the final detail screenshot proves the fix.

## Git closeout policy

The final release is committed/tagged **locally** as `sanverse-creative-library-l1`.

Per owner instruction on 2026-08-11, GitHub push and remote SHA/tag parity are intentionally deferred because the current monthly GitHub CI/CD minutes are exhausted. Local history is preserved. When the owner re-authorizes next month, this branch/tag can be pushed and remote parity verified without rebuilding L1.

## Stop boundary

L1 ends here. Do not start A22, B2/B3 or C6 without explicit authorization.
