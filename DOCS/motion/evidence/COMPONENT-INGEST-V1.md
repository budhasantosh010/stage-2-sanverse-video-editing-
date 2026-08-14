# COMPONENT INGEST V1 — CH1 Full Ingestion Evidence

Date: 2026-08-14
Scope: **10 owner-approved CH1 reusable creator components**
State: **COMPLETE LOCALLY — 10/10 productized, parity verified, registered and visible in the 99-component Creative Library; no GitHub push**

## Owner authority and coding ownership

The owner explicitly approved all ten CH1 source visuals and said they are components they would use in YouTube videos.

The owner also clarified on 2026-08-14 that the Sanverse coding agent in this worktree owns the complete conversion and Library insertion. The external CH1 workspace is a read-only approved visual source, not another implementation owner.

Approval handling is intentionally truthful:

- `sanverse.icon-rail`: owner directly watched the synchronized approved-original vs Sanverse-integrated parity page and explicitly approved the integrated result.
- Components 02–10: the owner approved the source set and explicitly authorized the coding agent to preserve those visuals, perform engineering parity/productization review, and insert the verified results without requiring a separate manual owner viewing round for every component.
- the second path is stored as `owner-batch-authorized-engineering-evidence`; it is distinct from the direct `owner` reviewer state.

Plain engineering evidence still cannot register a component. Registration accepts either direct owner parity approval or the explicit batch-authorized engineering-parity state after every engineering gate is green.

## Final public CH1 set

1. `sanverse.icon-rail` — Frosted Icon Rail
2. `sanverse.progressive-choice-stack` — Progressive Choice Stack
3. `sanverse.kinetic-phrase` — Kinetic Phrase
4. `sanverse.explainer-board` — Explainer Board
5. `sanverse.milestone-stage` — Milestone Brand Stage
6. `sanverse.feature-matrix` — Feature Matrix
7. `sanverse.media-cutaway` — Media Cutaway Stage
8. `sanverse.stat-burst` — Stat Burst
9. `sanverse.floating-value-cloud` — Floating Value Cloud
10. `sanverse.cta-pill` — CTA Pill

Public Motion catalog: **89 → 99**.

The generated ingest registry and `motion/component-intake/public-registration-ledger.json` contain all ten CH1 IDs. There is no placeholder-only registration.

## Intake classification

Every CH1 package was inspected read-only by the same `@sanverse/motion-ingest` classifier.

For all ten:

- source kind: `foreign`;
- foreign decision: `lossless-normalization`;
- source owner approval: PASS;
- visual lock: PASS;
- canonical 1,440,000 ticks/sec contract: PASS;
- deterministic source authority: PASS;
- direct-seek source contract: PASS;
- intake errors: 0.

Each intake stores an immutable hash-addressed snapshot of the approved reusable component implementation/manifest/approval metadata.

**No creator/reference MP4, MOV, WebM or other source-video bytes were copied into the Sanverse intake.** The source filenames can remain inside immutable provenance text, but the media itself is not imported.

## Canonical productization

Components 02–10 are implemented in:

`packages/motion-library/src/ingested/ch1-approved-components.tsx`

Component 01 remains in:

`packages/motion-library/src/ingested/frosted-icon-rail.tsx`

All ten are canonical `MotionGraphBackedComponentModuleV1` modules. The shared CH1 normalization preserves the approved visual primitives while materializing real editable Sanverse authority:

- typed content props;
- validated shared style contract;
- stable semantic node IDs;
- Creator / Designer / Advanced exposures;
- C2 exact-tick animation/keyframes;
- C3 layer hierarchy;
- C4 dope-sheet projection;
- C5 editable value-curve tracks;
- four canonical ratios: 16:9, 9:16, 1:1, 4:5;
- reduced-motion behavior;
- deterministic random/backward/direct seeks;
- AI edit-intent mappings generated from real exposures.

Productization results for 02–10:

| Component | Semantic nodes | Exposures | Editable C5 tracks | Status |
|---|---:|---:|---:|---|
| Progressive Choice Stack | 12 | 10 | 8 | ready |
| Kinetic Phrase | 6 | 10 | 6 | ready |
| Explainer Board | 8 | 11 | 6 | ready |
| Milestone Brand Stage | 8 | 11 | 10 | ready |
| Feature Matrix | 9 | 10 | 5 | ready |
| Media Cutaway Stage | 7 | 11 | 8 | ready |
| Stat Burst | 6 | 10 | 5 | ready |
| Floating Value Cloud | 8 | 8 | 17 | ready |
| CTA Pill | 6 | 10 | 5 | ready |

Component 01 retains its previously verified 14 semantic nodes, 15 exposures and 10 editable C5 tracks.

All productization reports pass determinism, direct seek, semantic mapping, C3, C4, C5, AI editability and all four ratios. C6 remains not-yet-available and was not started.

## Approved-source duration preservation

The public modules use the exact approved CH1 source reference windows rather than rounded convenience durations:

| # | Component | Canonical duration |
|---|---|---:|
| 01 | Frosted Icon Rail | 1.00 s |
| 02 | Progressive Choice Stack | 2.70 s |
| 03 | Kinetic Phrase | 1.50 s |
| 04 | Explainer Board | 4.43 s |
| 05 | Milestone Brand Stage | 3.30 s |
| 06 | Feature Matrix | 3.70 s |
| 07 | Media Cutaway Stage | 2.47 s |
| 08 | Stat Burst | 3.23 s |
| 09 | Floating Value Cloud | 1.50 s |
| 10 | CTA Pill | 1.77 s |

## Visual parity system

The development parity route is generalized for all ten:

`/ingest/parity/<sanverse-component-id>`

Examples:

- `/ingest/parity/sanverse.icon-rail`
- `/ingest/parity/sanverse.progressive-choice-stack`
- `/ingest/parity/sanverse.feature-matrix`
- `/ingest/parity/sanverse.cta-pill`

The left side renders the immutable approved CH1 runtime inside a sandboxed iframe. The right side renders the canonical Sanverse module through the real Motion host. They share one exact-tick playhead, ratio selector, 1× playback control and reduced-motion state.

The approved-source iframe also receives the original CH1 responsive `data-shape` classification (`portrait` / `balanced` / `landscape`), so the evidence harness cannot accidentally compare different responsive branches.

## Seven-checkpoint temporal parity

Components 02–10 were captured at exact progress:

`0.00, 0.05, 0.18, 0.33, 0.58, 0.90, 1.00`

For every checkpoint the source and integration use the same exact tick and 9:16 canonical viewport. Blank/noisy headless captures were rejected and retried rather than accepted as failures or parity evidence.

Final supporting SSIM results:

| # | Component | Minimum valid SSIM | Average SSIM |
|---|---|---:|---:|
| 02 | Progressive Choice Stack | 0.987923 | 0.995793 |
| 03 | Kinetic Phrase | 0.967335 | 0.988389 |
| 04 | Explainer Board | 0.988172 | 0.994643 |
| 05 | Milestone Brand Stage | 0.983422 | 0.996025 |
| 06 | Feature Matrix | 0.950300 | 0.979155 |
| 07 | Media Cutaway Stage | 0.989602 | 0.995937 |
| 08 | Stat Burst | 0.960855 | 0.983844 |
| 09 | Floating Value Cloud | 0.987512 | 0.995232 |
| 10 | CTA Pill | 0.988042 | 0.992474 |

SSIM is supporting evidence only. Every temporal contact sheet was manually inspected. Material motion/layout differences found during the review were fixed before registration.

Retained evidence lives under:

`motion/visual-baselines/ch1-ingest/`

including one temporal contact sheet per component and the final real Library collection screenshot.

## Visual/graph failures found and fixed

The parity loop found issues that mechanical graph tests alone would not have caught:

1. **Full-screen transform authority** — first 02–10 normalization applied Motion Graph transforms to a full-screen root. CH1 applies transforms to an intrinsic `.sv-wrap` centered by a full-screen `.sv-layer`. The shared renderer was corrected to the same two-level model.
2. **Invalid graph hierarchy under visual shapes** — Explainer Board, Media Cutaway, Stat Burst and CTA initially represented DOM visual nesting as illegal graph shape/text parenting. Canonical C3 groups/sibling semantic nodes now carry edit authority while DOM nesting remains purely visual.
3. **Milestone stagger slot** — related badges initially used a generic .42→.76 fade instead of CH1 item-motion index 2/count 3. Exact source stagger and hidden-row layout height are preserved now.
4. **Missing source responsive shape in parity harness** — Feature Matrix initially compared the source desktop two-column branch against the integrated portrait branch. The approved-source iframe now gets the same `data-shape` classification as CH1.
5. **Feature Matrix entrance bypass** — the first graph-active renderer forced criterion/metric rows visible instead of consuming their graph opacity/Y tracks. The renderer now uses the actual graph-resolved nodes, restoring exact entrance timing.
6. **Headless evidence noise** — Windows Edge emitted non-fatal `LoadEnclaveImageW error 577`, and a few early screenshots were blank. Evidence success is judged by actual rendered output; invalid captures were discarded and rerun.

## Real 1× Library playback

After public registration, the existing real-Edge Creative Library audit ran over catalog indexes 89–98.

Result: **10/10 full canonical 1× playbacks verified**.

```text
CTA Pill                  1.77 s  PASS
Explainer Board           4.43 s  PASS
Feature Matrix            3.70 s  PASS
Floating Value Cloud      1.50 s  PASS
Frosted Icon Rail         1.00 s  PASS
Kinetic Phrase            1.50 s  PASS
Media Cutaway Stage       2.47 s  PASS
Milestone Brand Stage     3.30 s  PASS
Progressive Choice Stack  2.70 s  PASS
Stat Burst                3.23 s  PASS
```

Each run reached `data-library-full-playback=true` without manual seeking. The audit captured 46–142 real browser screencast frames per component.

Runtime evidence:

`tmp/l1-motion-audit/runtime-evidence-89-98.json`

The generated runtime frames remain local temporary evidence rather than committed media exports.

## Creative Library insertion

The Creative Library now reports **99 COMPONENTS**.

CH1 has a first-class collection/milestone:

- milestone: `CH1`;
- collection: `owner-approved-ch1` / **Owner Approved CH1**;
- Recently Added points to the ten CH1 components;
- all ten have deterministic posters;
- all ten have durable `passed` / quality tier `A` review records;
- all ten have `fullPlaybackVerified=true` at 1×.

Retained browser screenshot:

`motion/visual-baselines/ch1-ingest/library-owner-approved-ch1.png`

It shows 99 total components, 10 CH1 results and all ten `A · PASSED` cards in the real Creative Library.

## Regression

Fresh serial Creative/Motion/B1/Ingest tests:

```text
video-understanding     17
creative-direction      27
motion-contract          3
motion-primitives       29
motion-graph            132
motion-native-runtime    4
motion-testing           5
motion-library          196
motion-lab               56
motion-ingest             4
---------------------------
TOTAL                    473 / 473
```

Root all-workspace production build: **PASS**.

Known non-failing build advisories remain the existing Vite chunk-size warning and production web runtime nameplate-font URL resolution warning.

## Isolation and release rules

Required final invariants:

- `apps/web` product source: unchanged by this component-ingest implementation;
- source/reference video copied into intake: 0 files;
- new GSAP / Three / anime / Framer Motion dependency: 0;
- one canonical Motion Graph / C2 / C3 / C4 / C5 authority preserved;
- A22 / B2 / B3 / C6: not started;
- GitHub push: not performed; local Git only.

## Final acceptance state

**Component Ingest V1 CH1 is complete locally.**

All ten source-approved CH1 components are implemented by the Sanverse coding agent, productized into canonical Motion, parity-verified, registered, posterized, reviewed, full-playback verified, searchable and playable in the 99-component Creative Library.
