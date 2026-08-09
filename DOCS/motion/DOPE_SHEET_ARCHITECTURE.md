# MOTION-C4 — Professional Animation Timeline / Dope Sheet Architecture

Date: 2026-08-10
Status: complete

## Purpose

C3 answers **what object am I editing?**

C4 answers **when does this Motion Graph property change?**

C4 is a development compositor control surface. It is **not** the production video timeline and it does not introduce another animation clock, keyframe document, Layer document or scene authority.

## One source of truth

```text
Motion Graph scene
      │
      ├── C3 projectMotionLayers(...)
      │        └── stable node IDs / hierarchy / selection
      │
      └── C2 deriveTimelineTrackGroups(...)
               └── existing Animatable properties / keyframes
                         │
                         ▼
              C4 projectMotionDopeSheet(...)
                         │
                         ▼
                AnimationDopeSheet UI
```

`projectMotionDopeSheet(scene)` is a pure derived projection. Its track/keyframe objects contain stable references back to the actual C2 targets and keyframe IDs. Editing never mutates the projection; the UI emits ordinary typed C2 `MotionGraphOperationV1` operations.

## Time authority

C4 reuses the Motion Lab compositor playhead:

- canonical time is integer project ticks;
- Preview evaluation receives the same `localTicks`;
- C4 ruler and playhead render the same tick;
- keyframe inspector edits exact ticks;
- frame display/nudge derives from the composition frame rate;
- seconds are display only.

No wall-clock animation or second playhead exists.

## Track projection

Each projected C4 layer group uses the same stable C3 `nodeId`. Tracks derive from the current Motion Graph node’s Animatable properties and expose:

- stable `trackId` from typed target identity;
- node ID/name;
- property label/type;
- animation kind: `keyframes`, `motion` driver, or `binding`;
- legal interpolation modes;
- existing C2 keyframes.

Keyframe selection IDs combine the typed target identity and the real keyframe ID. They are UI selection identity only; the underlying keyframe ID stays unchanged.

## Driver versus keyframe truth

A deterministic authored Motion driver is not presented as editable Bezier keys. C4 renders a different driver treatment and disables `+ Key` for that track. Existing C2 conversion policy remains authoritative (`KEYFRAME_CONVERSION_REQUIRED` when a caller attempts an implicit driver/binding replacement).

## Selection synchronization

- selecting a C3 Layer focuses that node’s C4 track group;
- selecting a C4 track or keyframe calls the existing C3 `setSelectedGraphNodeId(nodeId)` authority;
- single/Ctrl(Cmd)/Shift-range keyframe selection is C4 UI state only;
- no selected-keyframe state is stored in the Motion Graph.

## Keyframe operations

C4 edits only through C2 operations:

- add keyframe;
- remove keyframe;
- move keyframe;
- set keyframe value;
- set interpolation;
- set Bezier numerics.

`buildAtomicMotionKeyframeMoveOperations(...)` orders positive same-track moves from later→earlier ticks and negative moves earlier→later. This avoids transient collisions while preserving IDs and relative spacing under sequential validation.

The entire selected-key operation array is passed to one `applyMotionOperations(...)` call. If any operation fails, the batch fails without a partial scene.

## Undo / Redo

Motion Lab continues using the bounded C3 compositor snapshot journal as a development proof. `appendGraphOperations(operations)` pushes **one** history snapshot before applying the whole operation array. Therefore a five-key drag is one user transaction and one Undo, not five.

This does not import or replace production Studio history.

## Snapping

C4 initial snapping candidates are intentionally bounded:

1. nearest composition frame boundary;
2. composition start;
3. composition end;
4. other keyframes;
5. component motion-event markers.

Snapping can be disabled. The real Edge proof found and fixed an initial lower-frame-only bug; current code compares both lower and upper frame boundaries and chooses the nearest candidate within threshold.

## Ruler / navigation

C4 supports:

- seconds / frames / exact ticks ruler display;
- shared playhead click seek;
- 1×–16× horizontal zoom around the playhead;
- horizontal pan slider and scaled horizontal/Shift-wheel pan;
- fit composition;
- vertical scrolling;
- UI-only layer-group collapse;
- exact ±1 frame / ±10 frame nudging.

Copy/paste keyframes is deliberately deferred to C4.1/C5 because the ABC-1 acceptance contract permits deferral if it would complicate C4. No fake partial clipboard system was added.

## Keyframe Inspector

The selected primary key displays/edits:

- exact tick;
- display seconds;
- frame number;
- typed value;
- Hold / Linear / Bezier interpolation;
- numeric Bezier `inX/inY/outX/outY` when applicable.

C5 is reserved for graphical curve handles/curve visualization.

## Event markers

C4 receives the existing component definition motion events and projects their normalized times onto the same duration tick range. Event markers are ruler navigation/snap hints; they do not create new animation data.

## Performance policy

C4 deliberately measured before adding virtualization.

Synthetic 500-track/5,000–10,000-key cases show that projection remains relatively small while React construction and especially full immutable multi-key mutation validation become materially expensive. Current real public components are far below those synthetic sizes. C4 therefore does **not** add a second virtualized state model yet. If realistic future A20+ scenes approach hundreds of simultaneous tracks and browser interaction actually degrades, virtualization should be added as a rendering-only view window over the same projection.

The detailed numbers are in `DOCS/motion/evidence/MOTION-C4.md` and `PERFORMANCE_BUDGETS.md`.

## Production boundary

C4 changes only Motion Graph/Motion Lab development code and Motion docs/evidence. `apps/web` remains untouched. Production video-timeline behavior, media clips, transcript timing and Studio history are outside C4.
