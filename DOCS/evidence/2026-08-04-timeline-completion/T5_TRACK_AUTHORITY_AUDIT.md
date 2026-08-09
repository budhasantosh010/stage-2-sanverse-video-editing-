# T5 Track Authority Audit

Date: 2026-08-10
Branch: `timeline-t5-advanced-tracks`
Base: `99dcb6a71085b314414f2a4e0d526b9c5348855d`

This audit is from the executable T4 code at the exact verified base. It was completed before any T5 schema/model implementation. T5 is an Editor Program milestone only. Motion Plan A/C and Plan B remain read-only and out of scope.

## Executive finding

The five visible T4 rows are **not five instances of one canonical track model**.

- V1 is backed by the canonical `Composition.tracks[].clips` primary-footage sequence.
- A1 is not a separate clip sequence; it is a dialogue presentation mirror of V1 clips and their `linkedAudio` windows.
- V2, C1 and A2 are semantic presentation rows assembled from accepted operation families: overlays/nameplates, caption sets and music.
- output is accepted project history through `set-track-output` and therefore affects Preview/export;
- lock is browser workspace state in `timeline-lock-state.ts` and therefore has no revision/Undo/export effect;
- display ids `V2/V1/C1/A1/A2` are currently used as if they were track identities in several editor planners even though only V1 has a real composition track id.

T5 therefore cannot safely "make the lane list dynamic" in React. It needs one typed Editor track model which **projects the existing content authorities** without replacing them.

## Current row-by-row authority

### V1 — Primary

1. **Canonical content:** `Composition.tracks[].clips` in `EditProject.composition`, replayed by Timeline operations into `effectiveComposition(project)`.
2. **Represented in EditProject:** yes.
3. **Real track id:** yes, `Composition.Track.trackId` (`track_...`).
4. **Inferred from item type:** no for the clip itself; the editor presents composition video clips as the primary row.
5. **Lock:** workspace/localStorage `TimelineLockStateV1`, currently addressed through display id `V1` in most UI paths; precision code can also receive real composition track ids.
6. **Output:** accepted `set-track-output('V1')` operation.
7. **Render plan:** primary clips compile to `segments`; `V1` controls `videoEnabled`.
8. **Preview:** `resolvePrimarySource()` reads `effectiveComposition` and `V1` output directly, preserving T0 Preview truth.
9. **Export identity:** yes when picture/output/timing changes, because the compiled render plan changes.
10. **Ripple:** canonical Timeline operations directly mutate the primary composition; this is the initiating storyline.
11. **Selection:** stable item ids use the primary clip id (`clip:...`) in Timeline presentation.
12. **Groups:** groups store logical Timeline item ids and may include primary clips.
13. **Markers:** composition-time notes are independent of track identity.
14. **Snapping:** primary clip boundaries are snap candidates through the existing Timeline snap authority.
15. **Linked audio:** each moving primary `Clip` owns one optional `linkedAudio` source/composition window; no second clip identity is created.
16. **T4 keyframes:** primary-footage motion is source-oriented `set-footage-motion`, keyed by stable `motionId + assetId`, not by display track id.
17. **Literal assumptions:** `track-output.ts`, `compile-project.ts`, `primary-source.ts`, placement/clipboard/gap/item planners, Studio/Timeline header code and tests contain `V1` assumptions.

### A1 — Dialogue

1. **Canonical content:** V1 clip audio fields plus each clip's `linkedAudio`; A1 has no independent placement list.
2. **Represented in EditProject:** indirectly, inside V1 clips.
3. **Real track id:** no independent domain track id today.
4. **Inferred:** yes, from V1 clips with audio.
5. **Lock:** workspace state addressed as `A1`.
6. **Output:** accepted `set-track-output('A1')`.
7. **Render plan:** `source-segment.audioEnabled`, `linkedAudio`, gain/fades/pan.
8. **Preview:** one managed composition-audio authority produces the primary and J/L auxiliary voices.
9. **Export identity:** yes for A1 output and clip-audio changes.
10. **Ripple:** follows the V1 clip identity; J/L changes audio windows but not a second placement.
11. **Selection:** linked-selection logic expands from V1 to its dialogue mirror according to existing logical-link rules.
12. **Groups:** logical row mirror; groups must not invent a second source identity.
13. **Markers:** independent.
14. **Snapping:** dialogue geometry is derived from linked audio windows; it is not an independent source-placement authority.
15. **Linked audio:** this **is** the linked audio authority.
16. **T4:** no T4 visual keyframe lanes.
17. **Literal assumptions:** compiler, Preview audio projection, Timeline view-model/header/planners and output tests contain `A1`.

### V2 — Overlay

1. **Canonical content:** active nameplate/title/callout/media-overlay operations plus their repairs/removals; visual properties are separate full-state `set-visual-properties` operations.
2. **Represented in EditProject:** yes, through change-set operations, not `Composition.Track`.
3. **Real track id:** no.
4. **Inferred:** yes, operation family is projected into `lane:overlay`.
5. **Lock:** workspace state addressed as `V2`.
6. **Output:** accepted `set-track-output('V2')`.
7. **Render plan:** overlay nodes + visual-property nodes; `V2` off filters them before render.
8. **Preview:** current overlay layer consumes the same compiled/active visual state while the main native video remains one.
9. **Export identity:** yes when visible placement/order/output/visual state changes.
10. **Ripple:** old V2 visuals are source-anchored through `assetId + sourceInterval`; they follow the filmed source moment as V1 is cut.
11. **Selection:** each projected visual has a stable logical id derived from its operation/visual identity and surviving placement.
12. **Groups:** groups may include overlay logical item ids.
13. **Markers:** independent.
14. **Snapping:** current move planners use bounded current Timeline candidates/markers/playhead.
15. **Linked audio:** B-roll may opt into its own audio, but it is not A1 dialogue.
16. **T4:** `set-visual-properties` keyframes are visual-relative; moving/reordering a row must preserve `visualId`, tracks and easing.
17. **Literal assumptions:** view model, placement planner, clipboard/item operations, Place On Top, track output/compiler and Timeline header code contain `V2`.

Important migration constraint: legacy V2 allowed heterogeneous visual overlays to coexist. The migrated **legacy overlay role** must preserve that behavior. New generic-video tracks may use a stricter same-track collision policy without retroactively invalidating old projects.

### C1 — Captions

1. **Canonical content:** accepted caption sets/cues (`add-captions` plus repairs), source-anchored to primary footage.
2. **Represented in EditProject:** yes through operations.
3. **Real track id:** no.
4. **Inferred:** all active caption sets project into `lane:caption`.
5. **Lock:** workspace state addressed as `C1`.
6. **Output:** accepted `set-track-output('C1')`.
7. **Render plan:** caption overlay nodes.
8. **Preview:** the current caption overlay path renders active cues.
9. **Export identity:** yes for output/content/style.
10. **Ripple:** captions follow source anchoring; old behavior does not rewrite every cue on a primary ripple.
11. **Selection/groups:** caption cue item ids are logical Timeline identities and can participate in current selection/groups.
12. **Markers:** independent.
13. **Snapping:** current item boundaries can participate through Timeline presentation.
14. **Linked audio:** none.
15. **T4:** caption visual properties may animate through the existing visual target contract.
16. **Literal assumptions:** view model, placement/output/compiler and Timeline UI use `C1`.

The current compiler can already render multiple caption sets, but it has one semantic caption-output switch and no caption-track identity. T5 may support multiple caption tracks only after assignment/output/order are made first-class end-to-end; otherwise it must retain one C1.

### A2 — Music

1. **Canonical content:** accepted `add-music` / `set-music` / `remove-overlay` operations.
2. **Represented in EditProject:** yes through operations.
3. **Real track id:** no.
4. **Inferred:** music operations project into `lane:music`.
5. **Lock:** workspace state addressed as `A2`.
6. **Output:** accepted `set-track-output('A2')`.
7. **Render plan:** `MusicNode[]`, with source start, composition interval, gain and fades.
8. **Preview:** the one composition-audio controller creates music voices alongside A1.
9. **Export identity:** yes for audible content/output/gain/timing.
10. **Ripple:** music is deliberately **composition anchored** and does not follow source cuts in T4.
11. **Selection/groups:** music has stable logical Timeline item ids and may be grouped with other rows.
12. **Markers:** independent.
13. **Snapping:** music boundaries participate through existing Timeline item geometry.
14. **Linked audio:** none.
15. **T4:** no audio keyframe authority existed in T4.
16. **Literal assumptions:** view model, placement/clipboard/item planners, track output/compiler and Timeline UI use `A2`.

## Existing output, lock and audio authorities

### Output

`packages/edit-domain/src/track-output.ts` is accepted/rendering state. `set-track-output` currently accepts only `V2|V1|C1|A1|A2`. `activeTrackOutputs(project)` folds the latest values. Compiler/Preview read it; Undo/Redo and export identity therefore work.

T5 should **reuse the operation family**, broaden its address to stable T5 track ids while preserving legacy aliases for old history, and resolve those aliases through the deterministic migrated default tracks.

### Lock

`apps/web/src/features/timeline/timeline-lock-state.ts` deliberately keeps locks in local workspace state: no revision, no Undo, no export change. T5 must preserve that ownership and generalize its accepted id parser from five display ids to stable track ids. A display label must never become canonical identity.

### Audio mix feasibility

The browser Preview already owns exactly one managed `AudioContext` for composition audio. Each voice already has a `GainNode` and optional `StereoPannerNode`, and every update is derived from the one composition tick. FFmpeg already has clip gain, constant-power pan, stereo normalization and `amix` primitives.

Therefore **Editor-owned track gain/pan, mute and solo are viable** without Motion code if they are resolved before voices/render nodes are produced and both renderers consume the same track-audio state/evaluator.

Evaluation order adopted for T5:

`source -> clip enabled -> clip gain/fades/pan -> track gain/pan/automation -> track output/mute/solo -> master`.

## Waveform/channel audit

Gate D waveform decode intentionally keeps the file's native channel count; it does **not** force `-ac 2`. However `sanverse.waveform-block/v1` returns only one `peaks[]` array produced from the loudest absolute sample across interleaved channels. `MediaAsset` stores only `hasAudio`; current import probing does not persist channel count/layout/sample rate.

Consequences:

- existing waveform v1 remains the bounded combined-waveform authority;
- it cannot truthfully draw separate L/R because channel identity has already been collapsed;
- T5 must deliberately introduce a versioned channel-aware analysis response, derived by the same FFmpeg analysis service/cache/coordinator, if mono/stereo separate display ships;
- changing Combined/Separate remains workspace presentation state: zero revision/export change;
- no second browser decoder or AudioContext may be introduced for waveform display.

## Ripple audit and migration defaults

Legacy behavior comes from **anchor type**, not a five-track Sync Lock model:

- primary V1: duration-changing Timeline operations ripple the primary composition as authored;
- A1: cannot drift because it is linked state inside the same primary clip identity;
- V2/C1: source-anchored visuals/captions follow surviving source moments through `placeSourceSpan` rather than being independently shifted;
- A2: composition-anchored music stays at its composition start unless a music operation changes it.

T5 Sync Lock must preserve that before the user changes settings. Seed defaults:

- primary-video: on;
- dialogue: on and constrained by link integrity;
- legacy overlay-video: on;
- captions: on;
- legacy music: off.

The central ripple resolver must distinguish **source-follow participation** from **composition-placement shifting**. Turning Sync Lock off for a source-anchored visual/caption means a T5 ripple planner must compensate its source interval if keeping composition time is legal; it may not simply pretend the anchor changed. Impossible linked/group combinations refuse atomically.

## Selection, groups, markers and snapping

- T1 selection is logical-item-id based, not row-label based. T5 should add `trackId` to presentation items/rows but preserve item ids.
- groups persist arrays of logical item ids and can span semantic rows; moving/deleting tracks must preserve or atomically repair groups with the existing full-state group operation.
- markers are composition-time annotations and are deliberately independent of track identity; track deletion does not delete a marker merely because it shares a time.
- current snapping authority uses playhead/markers/item/composition boundaries from Timeline presentation. T5 must feed it bounded visible/eligible candidates from dynamic tracks instead of scanning every offscreen item on pointer move.

## T3 precision dependency

T3 precision planners operate on the canonical primary `Composition` and, for lock conflict, can already compare against the real composition `trackId`. T5 must keep Standard/Roll/Slip/Slide/Rate Stretch on their explicit clip track regardless of targeting. Ripple is the one precision family that gains cross-track participation through the central Sync Lock resolver.

## T4 dependency

T4 keyframe identity is target + property + canonical timestamp; it does not include lane display text. Moving an animated visual among stable T5 video tracks therefore must change only item→track assignment. It must not rewrite `visualId`, `motionId`, property tracks, keyframe times, easing or static transform. Track output/reorder/rename likewise cannot rewrite item animation.

## Dependency map

```text
EditProject v5
├─ composition.tracks[].clips --------------------------- V1 primary
│  └─ linkedAudio/gain/fades/pan ------------------------ A1 dialogue mirror
├─ accepted overlay/nameplate/visual operations --------- V2
├─ accepted caption operations -------------------------- C1
├─ accepted music operations ---------------------------- A2
├─ accepted set-track-output(V2/V1/C1/A1/A2) ------------ render/output state
├─ accepted groups + markers ----------------------------- T1 metadata
└─ accepted T4 visual/footage animation ------------------ item animation

Browser workspace
├─ timeline lock state ----------------------------------- five display ids today
├─ track height/collapse --------------------------------- five display ids today
├─ T4 animation presentation ----------------------------- target identity
└─ viewport/zoom/selection ------------------------------- presentation only

TimelineViewModel
└─ assembles five semantic lane families from the authorities above

Render compiler v8
├─ V1/A1 fixed output gates -> primary segment picture/dialogue
├─ V2 fixed output gate -> overlays + visual properties
├─ C1 fixed output gate -> captions
└─ A2 fixed output gate -> music

Preview
├─ one main native video element
├─ overlay/caption visual layers
└─ one managed composition-audio context for A1 + A2
```

## T5 migration requirement derived from the audit

T5 must introduce one **Editor Track Model V2** as a deterministic accepted projection over the existing content authorities. It must not migrate primary clips into overlay operations or overlays into `Composition.Track` merely to make the UI uniform.

The model therefore needs:

1. stable track identities unrelated to V/A/C display numbering;
2. closed kind + role;
3. deterministic legacy seed tracks;
4. one canonical item→track assignment resolver for operation-backed items;
5. required primary/dialogue relationship;
6. accepted Sync Lock/output/audio-mix state where future planners/renderers need it;
7. workspace-only lock/target/collapse/height state keyed by stable track id;
8. render compilation that maps this model into the existing renderer without Motion imports.

## Literal five-row assumptions to remove/generalize during T5

Highest-impact files/families found by source search:

- `packages/edit-domain/src/track-output.ts`
- `packages/render-contract/src/compile-project.ts`
- `apps/web/src/features/render-plan/primary-source.ts`
- `apps/web/src/features/timeline/timeline-view-model.ts`
- `apps/web/src/features/timeline/timeline-placement-planner.ts`
- `apps/web/src/features/timeline/timeline-clipboard.ts`
- `apps/web/src/features/timeline/timeline-item-operations.ts`
- `apps/web/src/features/timeline/timeline-gaps.ts`
- `apps/web/src/features/timeline/timeline-advanced-placement-plan.ts`
- `apps/web/src/features/timeline/timeline-lock-state.ts`
- `apps/web/src/editor/timeline/Timeline.tsx`
- `apps/web/src/screens/studio/StudioScreen.tsx`
- related tests/history descriptions.

These are Editor/shared render paths only. Protected Motion paths remain untouched.

## PRE0 conclusion

A dynamic professional Timeline is feasible without replacing EditProject, TimelineViewModel, Preview, the main video node or the renderer architecture. The safe migration is **projection + stable assignment**, not a content rewrite. T5 can remain an Editor milestone. Any later need for a generic node compositor/multiple native video authorities is a Motion cross-program requirement and must stop at that boundary.