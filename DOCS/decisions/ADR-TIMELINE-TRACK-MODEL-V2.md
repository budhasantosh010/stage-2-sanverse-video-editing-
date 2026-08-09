# ADR — Timeline Track Model V2

Status: Accepted for Gate T5 implementation
Date: 2026-08-10
Branch: `timeline-t5-advanced-tracks`
Base: `99dcb6a71085b314414f2a4e0d526b9c5348855d`

## Context

At T4 the Timeline looks like five tracks, but they are five different projections:

- V1 is the real primary `Composition.Track`;
- A1 mirrors audio owned by V1 clips;
- V2 is operation-backed visual content;
- C1 is operation-backed captions;
- A2 is operation-backed music.

Display ids are currently used by output/lock/planner code as though they were stable identities. That cannot scale to V3/V4/A3/A4 because display numbering changes when tracks reorder.

T5 needs stable professional tracks without replacing EditProject, content operation families, the one Timeline, one playhead, one native video, or the existing Preview/export compiler. Motion Plan A/C and Plan B remain protected.

## Decision 1 — Track Model V2 is an Editor accepted projection, not a second content model

Introduce a closed Editor domain model:

```ts
type TimelineTrackKindV2 = 'video' | 'caption' | 'audio'

type TimelineTrackRoleV2 =
  | 'primary-video'
  | 'overlay-video'
  | 'generic-video'
  | 'captions'
  | 'dialogue'
  | 'music'
  | 'sfx'
  | 'generic-audio'

type TimelineTrackV2 = Readonly<{
  trackId: string
  kind: TimelineTrackKindV2
  role: TimelineTrackRoleV2
  name: string | null
  syncLockEnabled: boolean
  outputEnabled: boolean
  audioState: AudioTrackStateV1 | null
}>
```

The exact implementation may add closed fields needed for deterministic section ordering/automation, but it must not widen `kind` or `role` to arbitrary strings.

**Track Model V2 does not own media content.** Existing canonical content stays where it already lives:

- primary clips: `Composition`;
- linked dialogue: primary clip `linkedAudio`;
- titles/callouts/B-roll/images/music: overlay-family operations;
- captions: caption operations;
- T4 visual/footage animation: existing operation families.

Track Model V2 owns stable row identity, role, order, metadata, Sync Lock, output/mix state and operation-backed item assignment.

## Decision 2 — Keep project schema v5 unless implementation proves a top-level shape is unavoidable

Track state is replayed from a deterministic legacy seed plus closed T5 track operations in accepted history. Old v5 projects therefore open without rewriting serialized bytes solely to gain row identities.

Benefits:

- no destructive project migration pass;
- old change-set ids/history remain intact;
- Undo continues to be change-set based;
- deterministic legacy migration is testable as a pure projection;
- migration alone produces the same render plan/export identity.

A project-schema bump is allowed only if this replay model proves insufficient during implementation. It must then be one deliberate T5 bump, not piecemeal version churn.

## Decision 3 — Stable default identities

Display labels are never ids.

The default migrated model uses deterministic project-local stable ids:

```text
primary-video  -> the existing canonical primary Composition.Track.trackId
legacy overlay -> track_overlay0001
dialogue       -> track_dialogue01
captions       -> track_caption0001
music          -> track_music000001
```

These examples are the intended constants if they satisfy the existing id validator. If implementation conventions require another deterministic token, tests must hold the exact chosen values.

Why the primary track reuses its current composition `trackId`: it already is a real stable id carried by every old project. Inventing a second id for the same primary track would create two authorities.

New tracks use the existing deterministic `IdFactory.entity('track', slot)` convention. A refused draft never burns an id.

## Decision 4 — Kind and role are distinct and validated

Closed compatibility:

| Kind | Valid roles |
|---|---|
| video | primary-video, overlay-video, generic-video |
| caption | captions |
| audio | dialogue, music, sfx, generic-audio |

Required role invariants:

- exactly one `primary-video`;
- exactly one `dialogue` associated with that primary storyline;
- primary and dialogue cannot be removed through ordinary track deletion;
- one migrated legacy overlay track exists by default;
- one migrated captions track exists by default;
- one migrated music track exists by default.

`primary-video` is the magnetic base storyline. Generic video tracks are layers above it, not extra primary storylines.

`dialogue` cannot accept unrelated audio; it remains a projection of the primary clips' linked audio.

## Decision 5 — Creator default remains the familiar five-row surface

A migrated/default project initially displays approximately:

```text
V2  Overlay
V1  Primary
C1  Captions
A1  Dialogue
A2  Music
```

No unused V3..V32 or A3..A32 rows are created or mounted.

Professional depth appears through explicit `+ Track` actions.

## Decision 6 — Canonical section order and display numbering

Sections remain fixed:

1. VIDEO
2. CAPTION
3. AUDIO

Cross-kind reorder is forbidden.

Within video:

- primary-video is pinned as the base/bottom video layer;
- overlay/generic video tracks are ordered above it;
- a higher video track renders visually above a lower video track.

Display numbering derives from current video stack from bottom upward:

- primary = V1;
- next layer = V2;
- next = V3, etc.

The UI may list the highest layer first, but numbering still derives from stack semantics. Reordering generic video tracks changes display numbers, never `trackId`.

Within audio:

- dialogue remains A1 and pinned in creator numbering;
- remaining audio tracks are A2... in stored audio display order;
- audio row reorder alone has no effect on summing/mix order.

Caption rows derive C1... from caption order.

Custom name is metadata shown beside/below the derived display label; it never contains the V/A/C number canonically.

## Decision 7 — Track limits are one domain authority

Initial implementation targets the plan's preferred ceilings, subject to T5 stress measurement:

```text
MAX_VIDEO_TRACKS = 32
MAX_AUDIO_TRACKS = 32
MAX_CAPTION_TRACKS = 8
```

These are maximum track-model instances per kind, including required/default tracks of that kind. They are not duplicated in UI code.

The final evidence must measure the requested 20-video / 24-audio / caption stress fixture. If measurement shows a lower safe ceiling, change the named constants once and document why. At least 16 video and 24 audio usable dynamic tracks are required for acceptance.

## Decision 8 — Caption policy: support multiple caption tracks only through real assignment/output/order

The current renderer can render multiple caption sets, so T5 may expose 0..N caption tracks **only after**:

- each caption set resolves to one stable caption track;
- each track has independent output state;
- Preview/export use that assignment;
- deterministic caption z/order is tested.

Until those conditions are complete, `Add Caption Track` remains absent rather than inert. The implementation can retain the one migrated C1 without failing T5.

## Decision 9 — One item→track assignment authority

Primary clips do not gain redundant track ids: they remain owned by the one primary composition track.

A1 dialogue remains derived from its primary clip relationship and likewise has no independent item assignment.

Operation-backed logical items resolve through one T5 assignment authority:

```text
visual/title/callout/nameplate/media overlay -> video track
caption set/cues                           -> caption track
music/audio placement                      -> audio track
```

An old item with no explicit T5 assignment resolves deterministically to its migrated default track. Once a current T5 assignment exists, it is the canonical track decision.

No long-lived `old lane + new trackId` dual authority is allowed. Legacy lane names may be read only for compatibility/projection during migration.

## Decision 10 — Compatibility is one pure resolver

Create a domain/editor pure resolver equivalent to:

```ts
canTrackAcceptTimelineItem(track, item)
```

Rules:

- primary-video: primary footage only;
- dialogue: linked primary dialogue only;
- overlay-video: migrated legacy visual family; preserves T4 legacy overlay coexistence;
- generic-video: compatible visual/video/image items and same-track collision rules;
- captions: caption items only;
- music/sfx/generic-audio: independent audio placements.

React, context menus, drag/drop, paste and future AI do not duplicate compatibility policy.

## Decision 11 — Track operation family is closed and typed

Use explicit operation kinds rather than `set-track: Record<string, unknown>`.

The intended closed family is equivalent to:

- `add-timeline-track`;
- `remove-timeline-track`;
- `rename-timeline-track`;
- `reorder-timeline-track`;
- `set-track-sync-lock`;
- `set-track-audio-state`;
- `assign-timeline-item-track`.

Existing `set-track-output` remains the output operation and is generalized to stable ids while old `V2/V1/C1/A1/A2` history stays valid.

Planners provide creator actions such as Add Above/Below, Delete Empty, Delete Track and Contents and Move Item to Track. One planner may return multiple typed operations in one change set when an atomic compound edit requires it.

## Decision 12 — Rename is accepted non-rendering metadata

Track names:

- trim surrounding whitespace;
- maximum 64 Unicode code points;
- ordinary Unicode allowed;
- control characters refused;
- empty-after-trim means `null`/no custom name.

Rename creates one accepted history revision/Undo because it is user work, but the render compiler ignores the name, so export identity remains unchanged.

## Decision 13 — Track lock remains workspace state

The T1 lock rationale remains correct: lock protects editing; it does not alter the movie.

T5 generalizes the workspace lock schema to stable track ids. Lock:

- blocks direct mutations on contained items and receiving drops;
- blocks keyframe changes on items in that track;
- does not hide/mute the track;
- creates no project revision/history/export change.

Required track model state therefore does **not** duplicate lock as accepted project content.

If a targeted track becomes locked, targeting is reconciled locally with zero project edit.

## Decision 14 — Output, mute, solo and mix are track state

`outputEnabled` is accepted render-affecting track state.

For video/caption:

- disabled => contents stay but contribute no visual/caption render output.

For audio:

- `outputEnabled` is the outer enable gate;
- `muted` and `solo` are track mix state;
- mute wins over solo.

One shared resolver defines audibility:

```text
audible(track) =
  outputEnabled
  AND !muted
  AND (no audio track is soloed OR track.solo)
```

One click modifies track state once, never every item on that track.

Static audio track mix fields:

- gain dB: reuse current clip/music validated dB range where compatible;
- pan: reuse current -10000..+10000 integer convention.

Mix evaluation order:

```text
source
-> clip enabled
-> clip gain/fades/pan
-> track gain/pan/automation
-> track output/mute/solo
-> master
```

Browser Preview and FFmpeg/export must consume the same resolved values.

## Decision 15 — Audio track automation is Editor-owned and composition-time

T5 may add a closed audio automation target for:

- gain;
- pan.

It is not `VisualPropertyTrack` and not Motion Graph.

Automation timestamps are integer **composition ticks** because the automation belongs to the track mix bus, not a source clip.

The implementation may reuse T4 editor selection/graph interaction infrastructure by extending its **Editor target union** with a closed track-audio target. It must not add another selection system or import Motion packages.

If Preview/export cannot consume dynamic track automation through one shared evaluator in T5, static gain/pan still ships and automation is truthfully deferred; the UI must not expose inert lanes.

## Decision 16 — No generic video track effects in T5

Generic video track effects, masks, node graphs and compositor architecture are deferred to an explicit Editor/Motion integration milestone.

Track opacity is not shipped unless the existing Editor render stack can implement it completely in Preview/render-plan/export/Undo/T4 graph without Motion changes. T5 does not need it to satisfy the core dynamic track model.

## Decision 17 — Sync Lock is accepted non-rendering track policy

Sync Lock must be persisted in accepted track state because manual and future AI planners must read the same policy. Toggling it creates one non-rendering project revision/Undo. The render compiler ignores it, so export identity remains unchanged.

Seed defaults preserve old T4 behavior:

- primary: on;
- dialogue: on;
- legacy overlay: on;
- captions: on;
- music: off.

Additional generic video/audio tracks default **on**, unless a role-specific creation policy explicitly states otherwise.

One pure `resolveRippleAffectedTracks(...)` authority is used by every T5-adapted duration-changing planner.

### Lock + Sync Lock policy

Lock blocks direct user mutation on a track. Sync Lock describes whether its placements should maintain sequence synchronization when another track initiates a ripple.

Professional policy chosen for T5: **a locked but Sync-Locked track may participate in a ripple caused elsewhere** because the user locked it against direct manipulation, not against sequence synchronization. The ripple planner is still required to preserve all group/link invariants atomically. If keeping a linked/grouped result would require an illegal direct rewrite, the whole edit refuses.

V1/A1 linked integrity outranks contradictory per-track settings; the pair cannot drift.

## Decision 18 — Source anchoring and Sync Lock are separate concepts

Sync Lock does not redefine source ownership.

- source-anchored legacy visuals/captions keep their source anchor;
- composition-anchored audio keeps composition anchoring.

When source-anchored content is Sync-Locked, normal source-follow behavior participates naturally.

If a source-anchored track is Sync Lock **off** and a primary ripple would otherwise move its composition appearance, the planner may compensate its source interval only when it can preserve the same composition placement without violating source bounds/groups. Otherwise it refuses. It never silently converts the item to composition anchoring.

When composition-anchored audio is Sync-Locked, the planner shifts its composition start by the exact ripple delta. When off, it stays put.

## Decision 19 — Destination targeting is workspace state

Persist presentation-only sets keyed by stable id:

- targetedVideoTrackIds;
- targetedAudioTrackIds;
- targetedCaptionTrackIds if caption targeting ships.

Targeting:

- zero revision/history/export change;
- explicit pointer/drop destination always wins;
- locked/deleted/incompatible target is reconciled locally;
- commands with no explicit pointer destination call one pure `resolveDestinationTrack(...)` resolver.

Priority for ordinary Insert/Paste with multiple targeted tracks: lowest compatible targeted track by section stack/order. `Place on Top` deliberately uses its higher-compatible-layer resolver instead.

## Decision 20 — Track Select is selection only

Track Select Forward/Backward produces T1 logical selection and zero project revision. It expands existing links/groups by ids, never vertical adjacency. The resulting selection uses the existing Move/Delete/Group/Clipboard operations.

All-tracks variants ship only if their modifier/menu behavior can be explicit and tested; otherwise the two single-track tools are sufficient for T5.

## Decision 21 — Dynamic Place On Top

`Place On Top` searches upward through compatible video tracks for the nearest collision-free destination.

If none exists, the UI offers **Create Video Track and Place**. Acceptance is one compound change set containing track creation + placement/assignment. One Undo removes both. No hidden track is created without the user choosing it.

## Decision 22 — Deletion semantics

- required primary/dialogue tracks refuse ordinary deletion;
- `Delete Empty Track` only removes an empty deletable track;
- populated deletion is explicitly named `Delete Track and Contents`;
- its planner produces one complete all-or-nothing change set: content removals, group repair/selection reconciliation where accepted-state metadata requires it, then track removal;
- markers remain according to existing independent anchor semantics;
- any undeletable contained item makes the whole operation refuse.

Selection itself remains presentation state and is reconciled after success.

## Decision 23 — Video stacking is explicit track order, never DOM accident

Primary is the base picture.

Video layers render in stable Track Model order, lower to higher; higher tracks are composited later/on top.

Within the migrated legacy overlay track, the pre-T5 node ordering semantics are preserved so migration alone remains visually identical.

Caption ordering is a separate explicit section order above the video-layer content according to the existing caption/text visual contract. Audio row order never changes summing.

Reordering video tracks changes compiled node order and therefore export identity. Reordering audio tracks does not alter rendered audio unless some separately accepted mix state changes.

## Decision 24 — Render-plan versioning

First implementation attempt compiles Track Model V2 **down into current render-plan v8**:

- filter nodes by track output/audibility;
- apply resolved track gain/pan to emitted audio node values/fields where existing contract suffices;
- sort visual overlay nodes by stable video stack order;
- preserve current primary segment shape and one-video Preview.

If track pan/automation cannot be represented without renderer-specific hidden policy, perform one deliberate T5 render-plan bump carrying only the explicit track mix/automation fields the renderers need. Do not bump for track names/locks/targets/Sync Lock.

Final evidence records the exact resulting version.

## Decision 25 — One-video Preview remains mandatory

Exactly one main native `HTMLVideoElement` remains. T5 extends the existing overlay/derived preview authority for operation-backed visual layers.

No `video` element per track.

If truthful simultaneous moving layers require a generic compositor not present in the Editor path, T5 stops that feature and reports a `MOTION CROSS-PROGRAM REQUIREMENT`; it does not import or modify Motion Graph/compositor code.

`Preparing layered preview` is acceptable. Showing only one layer when export would show several is not.

## Decision 26 — Waveform/channel contract must be versioned truthfully

Existing waveform-block v1 is a combined loudest-channel peak array. It remains valid for Combined display.

For truthful Separate display, T5 may introduce a new analysis version that returns:

- actual channel count;
- bounded channel layout label where ffprobe supplies one;
- channel-separated bounded peak arrays.

The same Gate D coordinator/cache/immutable source keys remain the authority; no second audio decode path is added. Mono shows one waveform. Stereo may show L/R. Unsupported surround layouts are metadata-only unless the Preview/export path supports explicit routing.

## Decision 27 — Vertical layout/virtualization has one authority

Create one derived vertical layout from:

- ordered Track Model V2;
- global vertical zoom;
- stable-id collapsed/height presentation;
- T4 item animation lane expansion;
- T5 track automation lane expansion.

The output row rectangles power headers, bodies, drag destinations, marquee and hit testing. Independent Y calculations in separate components are not allowed.

Both axes are virtualized with bounded overscan. Selection identity survives unmounting.

## Decision 28 — Migration is projection-only and render-identical

Opening a pre-T5 project:

1. validate the existing v5 project exactly as before;
2. derive deterministic default tracks from its current content authorities;
3. fold any T5 operations if present;
4. resolve unassigned legacy items to their role's default stable track;
5. compile the same content.

Migration alone must not append history or change revision.

Golden projects cover primary, multi-asset primary, B-roll/image, captions, J/L, music, speed/reverse/freeze/transitions, T4 footage/overlay animation, groups, markers and mixed aspect ratios. For each, compile/effectiveComposition/Preview mapping/export identity before vs migrated projection must agree unless the test explicitly performs a T5 edit.

## Decision 29 — Export identity matrix follows compiled output

Must change compiled plan/key:

- video track reorder where visuals overlap/order matters;
- video/caption output;
- audio output/mute/solo;
- track gain/pan/automation;
- moving an active visual into a different stack layer;
- add/delete active content.

Must not change compiled plan/key by itself:

- rename;
- selection;
- targeting;
- collapse/height/zoom;
- Track Select;
- Sync Lock;
- lock.

The existing plan-hash export key remains the final authority.

## Decision 30 — Closed refusals

T5 exposes closed refusal codes including:

```text
TRACK_NOT_FOUND
TRACK_KIND_UNSUPPORTED
TRACK_ROLE_INVALID
TRACK_LIMIT_REACHED
TRACK_REQUIRED
TRACK_NOT_EMPTY
TRACK_LOCKED
TRACK_DESTINATION_INVALID
TRACK_COLLISION
TRACK_ITEM_INCOMPATIBLE
TRACK_REORDER_INVALID
PRIMARY_TRACK_PINNED
DIALOGUE_TRACK_PINNED
SYNC_LOCK_CONFLICT
LINKED_AUDIO_CONFLICT
GROUP_CONFLICT
TARGET_TRACK_UNAVAILABLE
TARGET_TRACK_LOCKED
NO_COMPATIBLE_TARGET
MULTI_MOVE_TRACK_MAPPING_INVALID
TRACK_AUTOMATION_UNSUPPORTED
CHANNEL_LAYOUT_UNSUPPORTED
PROJECT_STALE
```

Normal editing constraints are planner refusals, not thrown exceptions.

## Consequences

### Positive

- old projects gain stable rows without destructive rewriting;
- creator default remains simple;
- dynamic professional tracks become deterministic domain state;
- current primary/link/source-anchor semantics survive;
- T4 animation survives vertical movement because track assignment is orthogonal to keyframes;
- non-rendering track metadata can consume revisions without throwing away finished exports;
- no Motion or Plan-B dependency is introduced.

### Costs

- the current five-label assumptions must be systematically removed from compiler/Preview/editor planners;
- context validation for track operations must understand current logical items and required roles;
- Sync Lock compensation for source-anchored items is more explicit than merely shifting timestamps;
- channel-separated waveforms require a versioned Gate D analysis response;
- dynamic audio automation may require one render-plan bump if current v8 cannot represent a shared evaluator truthfully.

## Rejected alternatives

### Put every Timeline thing into `Composition.Track`
Rejected. It would rewrite the existing content model, conflate source-anchored overlays with primary clips, duplicate A1 dialogue and create a migration larger than T5.

### Keep V1/V2/C1/A1/A2 as canonical ids and append V3/A3 strings
Rejected. Display numbering changes on reorder and cannot be stable identity.

### Store lock in EditProject
Rejected. Existing T1 rationale is correct: lock is editing protection, not rendered work.

### Implement Sync Lock only in React
Rejected. Future Plan B/manual commands would disagree and server/domain planners could not reproduce the edit.

### Use Motion Graph for track automation
Rejected. T5 is not an Editor/Motion integration milestone; gain/pan are already Editor audio semantics.

### Fake separate stereo waveforms from the combined peak array
Rejected. Channel identity is gone in waveform v1; duplicated/fabricated L/R would lie.

### Multiple native video elements for multiple video tracks
Rejected. Violates the one-video program invariant and introduces competing clocks.

## Implementation gate

Track Model V2 coding may begin only after this ADR and `T5_TRACK_AUTHORITY_AUDIT.md` are committed with the start boundary still green.