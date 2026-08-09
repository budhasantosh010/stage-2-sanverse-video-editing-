# MOTION-C4 — Professional Animation Timeline / Dope Sheet

Date: 2026-08-10
Status: complete; preserve in separate `motion-compositor-c4` checkpoint before A20.

## Goal

C4 adds a professional internal animation timeline for Motion Graph nodes/properties:

```text
C3 selected Layers
+
C2 Animatable/keyframe tracks
+
one existing compositor playhead
        ↓
C4 dope sheet
```

C4 is not the production video timeline. It does not introduce a second keyframe store or animation clock.

## Motion Graph additions

New pure derived model: `packages/motion-graph/src/dope-sheet.ts`.

It provides:

- `projectMotionDopeSheet(scene)` from existing C2 `deriveTimelineTrackGroups(scene)`;
- stable typed track IDs;
- stable keyframe selection IDs that reference real C2 keyframe IDs;
- UI-only canonical single/toggle/range keyframe selection helpers;
- frame/start/end/key/event snapping;
- collision-safe atomic multi-key move operation builder;
- multi-key delete operation builder.

The projection is read-only control metadata. Every edit still emits ordinary `MotionGraphOperationV1` operations against the original Motion Scene.

## Motion Lab C4 UI

Compositor mode now uses `AnimationDopeSheet` in the stage column while Creator/Designer/Advanced keep the original compact motion-event strip.

Features implemented:

- exact-time ruler in seconds / frames / debug ticks;
- one shared Motion Lab playhead;
- C3 Layer ↔ C4 track synchronization by stable node ID;
- nested layer track groups with UI-only collapse;
- keyframe visualization with Hold `■`, Linear `◇`, Bezier `◆` distinction;
- authored Motion driver tracks visibly separated from keyframe tracks;
- single key selection;
- Ctrl/Cmd multi-selection;
- Shift range selection;
- pointer drag in time;
- atomic multi-key drag preserving stable IDs and relative spacing;
- nearest-frame/start/end/other-key/event snapping with toggle;
- exact ±1 frame and ±10 frame buttons/keyboard nudge;
- add key at shared playhead through C2 operation;
- multi-delete through one C2 operation batch;
- 1×–16× zoom around playhead;
- horizontal pan + fit composition;
- vertical track scrolling;
- existing component motion-event markers;
- keyframe inspector for exact tick, seconds, frame, value, interpolation and numeric Bezier values;
- existing C3 compositor Undo/Redo journal as one-transaction proof.

Copy/paste keyframes is deferred to C4.1/C5 under the contract’s explicit deferral allowance; no incomplete clipboard model was introduced.

## All-component compatibility

`packages/motion-library/src/c4-dope-sheet-projection.test.ts` creates every public Motion component at all four reference ratios.

Result:

```text
77 components × 4 ratios
→ valid Motion Scene
→ C2 Animatable track projection
→ C4 dope-sheet projection
PASS
```

The test verifies:

- every C4 layer points to a real scene node;
- every track remains tied to the owning node;
- track IDs are stable and unique in the projection map;
- only `keyframes | motion | binding` are represented as animation kinds;
- non-keyframed tracks do not fabricate keyframes;
- every projected C2 keyframe stays inside the component duration;
- selection IDs are unique and resolve back to the same projected keyframe.

## Undo / Redo proof

A dedicated history regression proves a five-key drag is stored as one compositor history transaction:

```text
5 move-keyframe operations
        ↓
one appendGraphOperations([...]) call
        ↓
one history snapshot
        ↓
one Undo restores pre-drag operation list
one Redo restores all five operations
```

No production Studio history is imported.

## Real Edge browser evidence

Browser: installed Microsoft Edge, headless, real Motion Lab HTTP server on strict port 2010.

Primary proof composition: existing C2 Cost / Value Card keyframe proof, not a C4-specific fake scene.

Retained baselines:

- `motion/visual-baselines/c4-basic-cost-proof.png`
  - C3 Layers + Preview + 18 live animation tracks;
  - selected real Bezier C2 keyframe;
  - driver/keyframe distinction;
  - exact tick inspector;
  - motion-event markers.
- `motion/visual-baselines/c4-multi-key-selected.png`
  - two real `cost-card.value.transform.scaleX` C2 keys selected simultaneously.
- `motion/visual-baselines/c4-multi-key-drag-snap.png`
  - post-drag two-key selection, one shared playhead, exact snapped tick and inspector.
- `motion/visual-baselines/c4-zoom-layer-events.png`
  - 1.50× timeline zoom;
  - C3 `cost-card.value` still focused;
  - component event markers remain synchronized.

### Live CDP multi-drag proof

The browser started with:

```text
kf-value-x-1 = 3,024,000 ticks
kf-value-x-2 = 4,320,000 ticks
spacing = 1,296,000 ticks
```

Ctrl-selection produced `2 selected` in the real C4 UI. A real pointer drag then moved the primary key right while snapping was enabled. After the nearest-frame fix:

```text
kf-value-x-1 = 3,600,000 ticks
kf-value-x-2 = 4,896,000 ticks
spacing = 1,296,000 ticks  (preserved)
```

At 30fps the first moved tick is exactly frame 75 (`75 × 48,000 = 3,600,000`). The inspector primary tick moved with the selected keys. The same browser session then zoomed to 1.50× and reported the focused C3 layer as `cost-card.value` with visible event markers `count-start`, `value-reveal`, `count-end`, `settled`, `exit-start`.

## C4 stress/performance review

Synthetic scenes deliberately exceed current real component complexity. Measurements are local development-machine engineering timings; server-side markup is a React tree-construction proxy, **not** browser paint/FPS.

| Tracks | Keys | Projection avg | SSR construction avg | Select up to 100 avg | Atomic drag up to 50 avg | Five exact seeks avg |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 50 | 0.325 ms | 13.921 ms | 0.218 ms | 3.978 ms | 0.827 ms |
| 50 | 500 | 0.871 ms | 60.735 ms | 0.773 ms | 62.018 ms | 2.584 ms |
| 100 | 1,000 | 1.555 ms | 119.307 ms | 0.713 ms | 136.735 ms | 5.632 ms |
| 500 | 5,000 | 9.840 ms | 284.846 ms | 0.774 ms | 792.568 ms | 35.084 ms |
| 500 | 10,000 | 15.214 ms | 353.590 ms | 0.615 ms | 1,170.088 ms | 47.269 ms |

Worst local samples are retained in `PERFORMANCE_BUDGETS.md`.

Interpretation:

- pure C4 projection remains comparatively small even at 10k keys;
- UI construction becomes materially heavier in the synthetic hundreds-track regime;
- the dominant multi-drag cost at 500 tracks is immutable full-scene operation validation, not C4 selection/projection;
- current public component track counts remain far below the 500-track synthetic regimes;
- C4 therefore does not add premature virtualization or weaken validation. If realistic future components approach hundreds of tracks, add rendering-only virtualization and profile graph-operation validation separately.

## Failures found and fixed

### C4 benchmark harness JSX mismatch

The first standalone performance run failed before measurements because `tsx` compiled the existing Lab TSX using the classic JSX runtime and `AnimationDopeSheet.tsx` expected a global `React`. The temporary benchmark harness supplied that global and reran the exact matrix unchanged. No product source/runtime behavior was changed for this issue.

### Real browser found nearest-frame snapping defect

Initial frame snapping used:

```text
frameForTicks(raw)
```

which floors to the previous frame. A real drag landed at `3,586,963`, where the **next** frame at `3,600,000` was closer than the previous frame but the implementation only tested the lower frame. The retained first drag is discarded as failed visual/interaction evidence.

Fix:

- compute lower frame tick;
- compute upper frame tick;
- choose the nearest before applying snap threshold;
- add regression case where the upper frame is closer;
- rerun the same real Edge multi-drag.

The corrected retained browser proof snaps to exactly `3,600,000` and preserves the selected pair’s `1,296,000`-tick spacing.

## Fresh release-candidate verification

```text
creative-direction       26 / 26
motion-contract           3 / 3
motion-primitives        25 / 25
motion-graph            120 / 120
motion-native-runtime     4 / 4
motion-testing            5 / 5
motion-library          147 / 147
motion-lab               31 / 31
---------------------------------
TOTAL                   361 / 361

Builds                     8 / 8
```

Motion Lab’s existing Vite warning about the development bundle exceeding 500 kB remains non-failing; C4 correctness/build succeeds.

## Acceptance

- [x] C4 uses C2 tracks
- [x] no second keyframe store
- [x] C3 Layers synchronized
- [x] exact-time ruler
- [x] shared playhead
- [x] track hierarchy
- [x] keyframe display
- [x] add key
- [x] remove key
- [x] move key
- [x] multi-select
- [x] atomic multi-drag
- [x] frame snapping
- [x] nudge by frame
- [x] horizontal zoom
- [x] horizontal pan
- [x] keyframe inspector
- [x] driver-vs-keyframe distinction
- [x] event markers
- [x] Undo/Redo transaction proof
- [x] performance measured through 10,000 synthetic keys
- [x] all 77 existing components project at all four ratios
- [x] `apps/web` untouched

C4 is preserved as the separate `motion-compositor-c4` checkpoint. A20 begins only from that remote-verified boundary.
