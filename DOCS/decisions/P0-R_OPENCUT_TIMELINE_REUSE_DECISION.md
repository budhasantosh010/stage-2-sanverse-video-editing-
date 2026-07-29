# P0-R — Open-source timeline reuse decision

Date: 2026-07-29
Status: complete; production Timeline V1 remains unstarted
Decision: **C — study the behavior and build a focused Sanverse timeline**

## Scope and outcome

Active branch: `agent/g6-g8-local-alpha`
Start commit: `993a73d06a07cf79e57fd132b21fed0291b38c2b`
End commit: the commit containing this report; exact SHA is reported in the
final handoff because a Git commit cannot contain its own future SHA

P0-R determined which OpenCut interaction code can be reused without replacing
Sanverse's project, operations, revisions, change sets, proposals, Undo/Redo,
preview compiler, or export compiler.

Completed:

- read the full master contract and inspected the required Sanverse boundaries;
- pinned current upstream commits and licenses;
- inspected OpenCut rewrite and Classic timeline modules;
- built one non-routed sandbox with one video, title, caption range, and music;
- exercised local playhead, selection, zoom, and scroll;
- emitted Sanverse's existing `split-clip` operation from one split gesture;
- recorded exact third-party provenance and license.

Not done: production Timeline V1, a second model/store, OpenCut renderer/export,
database/auth/history, a production route, AI, multitrack, or any P0-D+ work.

## Upstream pins

| Project | Commit | License | Finding |
|---|---|---|---|
| [OpenCut rewrite](https://github.com/OpenCut-app/OpenCut/tree/4d8c49ed0706c4dc145361e01c6b1f1a87cbb863) | `4d8c49ed0706c4dc145361e01c6b1f1a87cbb863` | MIT | Active rewrite; audited web route is still `hello world` and has no timeline implementation. |
| [OpenCut Classic](https://github.com/OpenCut-app/opencut-classic/tree/cf5e79e919144200294fb9fed22a222592a0aeea) | `cf5e79e919144200294fb9fed22a222592a0aeea` | MIT | Complete timeline reference, archived 2026-05-17 and no longer maintained. |
| [OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/tree/0eebd211b2055f111e2c53d04b5581adc594c1fc) | `0eebd211b2055f111e2c53d04b5581adc594c1fc` | Apache-2.0 | Mature interchange, not a web timeline UI. |
| [MLT](https://github.com/mltframework/mlt/tree/43ec4933816316176de2795b6239263297356cc3) | `43ec4933816316176de2795b6239263297356cc3` | LGPL-2.1 | Rendering framework, not a React timeline. |
| [Kdenlive](https://github.com/KDE/kdenlive/tree/c766d8319b2c0021f921d46db849aaa7610df350) | `c766d8319b2c0021f921d46db849aaa7610df350` | GPL-3.0 | Editing-semantics reference only. |
| [Natron](https://github.com/NatronGitHub/Natron/tree/3763d805d7d277d10af10025ae41af677682b3e6) | `3763d805d7d277d10af10025ae41af677682b3e6` | GPL-2.0 | Compositing reference only. |

## 22-point compatibility matrix

| # | Area | Evidence and decision |
|---:|---|---|
| 1 | License | Both OpenCut repositories are MIT. Selective reuse is allowed with the notice and manifest now added. |
| 2 | Upstream commit | Rewrite `4d8c49e`; Classic `cf5e79e`. Pin commits, never moving `main`. |
| 3 | Exact modules | Isolated candidates: `scale.ts`, `pixel-utils.ts`, `zoom-utils.ts`, parts of `ruler-utils.ts`. Inspected full components/store/types: `timeline-ruler.tsx`, `timeline-playhead.tsx`, `selection-hit-testing.ts`, `audio-waveform.tsx`, `timeline-store.ts`, `types.ts`. Reuse math/behavior, not components/store. |
| 4 | Framework | Sanverse is React 19.1/Vite 7/TS 5.8; Classic is React 19/Next 16/TS 5.8; rewrite is React 19.2/TanStack/Vite 8/TS 6. React aligns, app frameworks do not. |
| 5 | State coupling | Math has no store. Classic store is persisted Zustand; components depend on editor/scroll hooks. Keep Sanverse state. |
| 6 | Project coupling | Classic defines its own tracks/elements and imports effects, masks, params, and WASM `MediaTime`. Importing it creates the forbidden second model. |
| 7 | Renderer coupling | Math has none. Waveform/visual components depend on OpenCut media/cache/editor services. Only math separates cleanly. |
| 8 | Export coupling | Selected math has none. Keep Sanverse export authoritative. |
| 9 | History coupling | Selected math has none; OpenCut editor actions do not provide Sanverse revision-fenced atomic change sets. Every gesture must emit a Sanverse operation. |
| 10 | Selection | Hit testing is useful but depends on OpenCut track/layout types. Study algorithm; implement against Sanverse view models. |
| 11 | Playhead | Component depends on editor/playhead/scroll hooks and WASM time. Preserve behavior, reject direct component adoption. |
| 12 | Zoom | Exponential slider and fit math separated after replacing one WASM constant. Safe as tiny attributed pure functions. |
| 13 | Scroll | Classic behavior is hook/editor coupled. Spike proved native scroll can remain local presentation state. |
| 14 | Trim/split | Classic drag/controllers depend on OpenCut elements. Spike emitted Sanverse `split-clip` without them. |
| 15 | Snapping | Dedicated Classic modules exist but consume OpenCut elements/snap sources. Study in P1-B; port only pure math. |
| 16 | Waveforms | `audio-waveform.tsx` is 352 lines and depends on cache/service, media summaries, retime, browser utilities, and hooks. Define a Sanverse port later. |
| 17 | Virtualization | Classic depends on `react-window`, but no self-contained timeline virtualization module was found in the audited surface. Select after a P1-B benchmark. |
| 18 | Accessibility | Existing pointer behavior does not satisfy Sanverse keyboard, focus, naming, and reduced-motion contracts automatically. Sanverse owns accessibility. |
| 19 | Bundle impact | Sandbox is unreachable from production. Baseline: 96 modules; JS `362.64 kB` (`104.14 kB` gzip); CSS `37.17 kB` (`7.16 kB` gzip). Post-build must remain identical. |
| 20 | Memory impact | Production impact is zero. Spike holds four derived items plus four scalar UI values, O(items). Profile real P1-B separately. |
| 21 | Maintenance | Pure math is low-cost. Archived components/store are high-cost because Sanverse would own every reconciliation. |
| 22 | Upstream stability | Rewrite is active but has no timeline; Classic is complete but archived. Neither is a stable module supplier. |

## Proven boundary

```text
authoritative Sanverse EditProject
  -> one-way read-only adapter
  -> disposable OpenCut-derived presentation
  -> local playhead / selection / zoom / scroll
  -> split gesture
  -> existing Sanverse split-clip typed operation
  -> normal server-authoritative change-set path (not executed by spike)
```

The projection carries the source project ID and revision, cannot be persisted
as a project, and never mutates its input. The spike is not imported by
`App.tsx` or any route.

## Decision

Choose **C: study OpenCut behavior and build a focused Sanverse timeline**.

The rewrite has nothing adoptable yet. Classic's complete components are tied
to an archived store, editor context, WASM clock, element schema, and media
services. Substantially adapting those modules costs more and creates more
maintenance risk than owning the focused layer. The spike proves the useful
reuse boundary is smaller: selected MIT pure algorithms and interaction
patterns behind Sanverse-owned adapters and operations.

## Exact production file plan

Create only when the ordered milestones reach them.

P1-A:

- `apps/web/src/features/timeline/timeline-view-model.ts` — pure
  `EditProject -> TimelineViewModel`; never persisted.
- `apps/web/src/features/timeline/timeline-gesture-adapter.ts` — gestures to
  existing typed operations/change sets.
- `apps/web/src/features/timeline/timeline-viewport-state.ts` — local
  playhead/selection/zoom/scroll.
- focused tests beside each file.

P1-B:

- `apps/web/src/editor/timeline/Timeline.tsx`
- `apps/web/src/editor/timeline/TimelineRuler.tsx`
- `apps/web/src/editor/timeline/TimelineViewport.tsx`
- `apps/web/src/editor/timeline/TrackRow.tsx`
- `apps/web/src/editor/timeline/ClipBlock.tsx`
- `apps/web/src/editor/timeline/Playhead.tsx`
- `apps/web/src/editor/timeline/timeline-math.ts`
- `apps/web/src/editor/timeline/timeline.css`

Any OpenCut-derived production code needs its own manifest entry, MIT notice,
and a public interface containing only Sanverse view models/commands.

## Verification

Focused RED: missing `OpenCutTimelineSpike` import observed first.

Focused GREEN:

```text
npm test --workspace @sanverse/web -- --run \
  src/spikes/opencut-timeline-reuse/OpenCutTimelineSpike.test.tsx

1 file passed; 2 tests passed
4.46 s total; 481 ms test execution
```

Build command: `npm run build --workspace @sanverse/web`.

Post-spike build passed: 96 modules, with the exact same JS/CSS filenames,
raw sizes, and gzip sizes as the baseline. The non-routed spike added **zero
bytes** to the production bundle.

Browser walkthrough was intentionally not run: the spike has no route because
production route replacement is forbidden. Its interaction path was rendered
and driven in jsdom.

Known limits: this proves the authority boundary and one split path, not
production usability, 50-clip virtualization, waveform, drag-trim, snapping,
or memory performance.

Blocking failures: none. Existing `FAIL-011` was reproduced for sandboxed
Vite/esbuild spawn and bypassed using the approved external run. `FAIL-019`
records blocked shell Git network access and the connector fallback.

## Acceptance and stop

- [x] Branch/SHA/tree verified and complete contract read.
- [x] Sanverse boundaries and required upstream projects inspected.
- [x] 22-point matrix and four-item fixture completed.
- [x] Playhead, selection, zoom, scroll, and one typed split exercised.
- [x] No forbidden subsystem imported or replaced.
- [x] Notice, modifications, decision, and production file plan recorded.

Exact next task: **P0-D — finish Assist**, then P0-E, then P1-A.

Stop condition: met. Do not begin P0-D or production Timeline V1 here.
