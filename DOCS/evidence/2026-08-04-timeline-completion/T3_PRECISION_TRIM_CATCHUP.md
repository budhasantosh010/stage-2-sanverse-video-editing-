# Gate T3 — Precision Trimming catch-up

Date: 2026-08-08
Base: `5a50e4bf84b928ac686bb903d1425b21c64ae890`
Branch: `timeline-t3-precision-trim`

T3 feature code starts only after T3-PRE0 ownership enforcement. The live editor boundary checker passes from the T2 base. Motion Plan A+C and AI Plan B are outside this gate.

## Existing authorities T3 must reuse

- Project clock: integer ticks at `PROJECT_TIMESCALE = 1_440_000`.
- Accepted picture state: `effectiveComposition(project)`.
- One clip timeline length: `clipCompositionDurationTicks(clip)`; source length is never substituted for it.
- Source/composition mapping: `clipTimeToSource`, `sourceTimeToClip`, edge-based rational-speed rounding.
- Source-pinned material: `placeSourceSpan`; V2/captions/footage-attached overlays follow the source automatically.
- Composition-pinned material: A2 music and Timeline markers keep their current composition anchoring unless explicitly edited.
- Standard trim operation: `trim-clip`.
- Speed/Rate Stretch: one rational `set-clip-time-transform` planner/operation; T3 must reuse Rate Stretch rather than duplicate it.
- Reverse: the same time transform plus the bounded T2 reverse-preview artifact.
- Freeze: explicit `freeze` segment with one source tick and authored composition duration.
- Linked A1/J-L: one clip identity with a separate full `linkedAudio` source/composition window.
- Transitions: one accepted join operation keyed by the adjacent clip identities.
- Groups: accepted lists of Timeline presentation ids; no render effect.
- Markers: accepted composition-time notes; no render effect.
- Selection V2: presentation-only click/Ctrl/Shift/marquee plus linked V1/A1 expansion.
- Snapping: one presentation snap authority; ties choose the earlier tick and Shift bypasses snapping during existing drags.
- Derived trim pictures: Gate D media-analysis controller and source-keyed frame requests; never a second video node.
- Preview audio: one bounded `CompositionAudioPreviewController`, driven from `compositionAudioStateAt`; the visible video is picture-only while this authority is active.
- Preview/export: project v5 → render-plan v8 → browser Preview and FFmpeg. T3 timing changes require no render-plan version change because the resulting composition already compiles through v8.
- Server history: a change set is atomic and Undo/Redo operates on the whole accepted change set.

## Why one new full-state timing operation is needed

`trim-clip` can only remove source. That is enough for an ordinary inward trim and the existing ripple trim. It cannot express the other three professional precision edits:

- Roll must extend one side of a cut while shortening the other.
- Slip must move the source window without moving the Timeline interval.
- Slide must move the selected clip while one neighbor grows and the other shrinks.

Building these as `trim` followed by `move` would create an intermediate overlap/gap that is not the state the user previewed. It would also require business logic to exist in several React paths.

T3 therefore adds one closed primitive, conceptually `set-primary-clip-timings`, whose payload is the complete timing answer for every affected V1 clip:

- clip id;
- full source range;
- composition start;
- full linked-audio window or null.

The operation changes all named clips simultaneously and validates the rebuilt composition once. It does not store speed, gain, transition, group or marker state, so those authorities cannot be reset accidentally. A Freeze clip may be shifted downstream by a ripple but cannot have its held source instant rewritten by a precision tool.

This is an operation-family extension only. Project schema remains `sanverse.project/v5`; render plan remains `sanverse.render-plan/v8`; an untouched saved project is unchanged.

## Capability matrix

| T3 capability | reusable current operation/authority | new planner/session | accepted-project impact | Preview/export impact | linked audio | speed/reverse | freeze | transition | group/marker | Undo boundary |
|---|---|---|---|---|---|---|---|---|---|---|
| Standard Trim | current trim semantics + timing mapper | precision planner, `standard-trim` session | one timing answer; leaves a gap | existing composition compiler | preserve/recompute full window; never reset | shared rational/reverse mapper | target refuses | preserve/revalidate join | group checked; markers fixed | one change set |
| Ripple Trim | current ripple policy | `planRippleTrim` | target edge + exact downstream V1 shift | existing compiler | preserve full J/L window | exact on-screen delta from rational mapper | target refuses; downstream freeze may shift | preserve/revalidate | groups checked; markers keep composition time | one change set |
| Roll | adjacency + source mapper | `planRollTrim` | two adjacent full timing changes, duration invariant | existing compiler | preserve both full windows where valid | each side mapped independently | boundary refuses unless semantic hold is untouched and valid | preserve or refuse with available duration | compatible groups only; markers fixed | one change set |
| Slip | source mapper + Gate D frames | `planSlipEdit` | source range changes; composition interval fixed | existing compiler; derived source frames change | shift linked audio source by same source delta | explicit forward/reverse source math | target refuses | clip ids/join unchanged; revalidate | compatible group only; markers fixed | one change set |
| Slide | adjacency + source mapper | `planSlideEdit` | selected interval moves; left/right source windows compensate; sequence duration fixed | existing compiler | preserve/shift windows with owners | each affected clip uses its own rational/reverse mapping | affected boundary freeze refuses when it would need source extension | preserve/revalidate both joins | compatible groups only; markers fixed | one change set |
| Trim to Playhead | standard/ripple planner | thin command wrapper | same as selected planner | same | same | same | same | same | same | one change set |
| Extend nearest edit | edit-point resolver + implemented trim modes | deterministic nearest-point command | same as chosen supported planner | same | same | same | same | same | same | one change set |
| J/K/L shuttle | one composition playhead/video | presentation shuttle controller | none | Preview only; export unchanged | Preview audio authority follows playhead | reverse uses bounded frame/source strategy; no negative video rate | held-frame clock remains composition clock | no project impact | none | none |
| Dynamic Trim | precision planner + shuttle | one detached `DynamicTrimSession` | no edit until Commit | detached feedback only until Commit | same planner result | same mapper | same refusals | same revalidation | same | Commit one; Cancel zero |
| Audio Scrubbing | T2 composition-audio projection/controller | presentation setting + bounded snippet scheduler | none | Preview-only audio snippets | exact A1/J-L | same rate/direction handling; reverse uses prepared/bounded source | freeze silent | transition fades projected | none | none |
| Edit-point selection | Selection V2 pattern | `TimelineEditPointRefV1` presentation state | none | none | linked V1/A1 represented together | none | identifiable/refusable | join identity available | none | none |
| Multi-edit-point trim | single-point planner | `planMultiEditPointTrim` | one full timing answer or none | existing compiler | all affected windows validated | each point mapped independently | blocking point refuses all | all joins revalidated | all group constraints checked; markers fixed | one change set |
| Numeric precision | project timescale + frame rate | exact parser + Timeline-local popover | calls same planners | same | same | same | same | same | same | one change set |
| Trim View | Gate D derived frames + planner feedback | presentation overlay | none while dragging | frame requests only for active edit | n/a | source ticks from shared mapper | held frame shown/refused according to mode | n/a | n/a | none |

## Closed-refusal policy

T3 uses a closed precision-refusal union. Normal constraints return refusals, not exceptions. User-facing messages are plain language and never expose enum names. Required codes are:

`TRACK_LOCKED`, `SOURCE_HANDLE_INSUFFICIENT`, `SOURCE_OUT_OF_RANGE`, `TIMELINE_OUT_OF_RANGE`, `COLLISION`, `ITEM_MISSING`, `ITEM_DISABLED`, `ITEM_TYPE_UNSUPPORTED`, `EDIT_POINT_NOT_ADJACENT`, `TRANSITION_CONFLICT`, `GROUP_CONFLICT`, `LINKED_AUDIO_CONFLICT`, `SPEED_MAPPING_INVALID`, `REVERSE_MAPPING_INVALID`, `FREEZE_OPERATION_UNSUPPORTED`, `STALE_PROJECT`, `INVALID_EDIT_POINT`, `INVALID_MULTI_SELECTION`.

## Ripple scope locked to current policy

- V1/A1: primary picture timing changes; linked sound remains one identity.
- V2 and captions: source anchored; their existing `placeSourceSpan` projection follows footage.
- A2 music: composition anchored; T3 does not invent Sync Lock and does not shift it.
- Markers: composition anchored by the existing marker contract; T3 does not move them implicitly.
- Groups: no silent break or membership rewrite. Compatible affected primary members proceed; a group containing unrelated material refuses.
- No T5 track targeting or Sync Lock is introduced early.

## Session/ghost/commit rule

One `PrecisionTrimSessionV1` is presentation state only. It records active mode, selected item/edit-point identities, original/raw/snapped delta, the planner result and refusal. Pointer movement calls the exact planner used by release and creates no operation/API request/revision/history entry. Release submits exactly that validated plan in one change set. Escape and pointercancel create nothing.

## T3 scope exclusions

- no Motion file or Motion dependency change;
- no Motion component or Motion Lab use;
- no Plan-B AI implementation;
- no T4 keyframe-lane/graph work;
- no second Timeline, playhead, video or project clock;
- no root dependency/workspace change.
