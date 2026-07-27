# ADR-002 — Project v2 and the time model

- Status: Accepted
- Date: 2026-07-27
- Supersedes: the implicit v1 model in `packages/edit-domain`

## The problem

Project v1 stored edits as a flat list of nameplate actions with two unrelated
millisecond fields and no knowledge of the video. Five specific consequences,
all verified by reading the code and then reproduced on real files:

1. A nameplate could be placed at minute 83 of a 30-second video. It passed
   validation, previewed, and was written to disk. Export rejected it, long
   after the user believed the edit was done.
2. Removing the third of five edits required undoing the fifth and fourth
   first, destroying good work to reach one bad edit.
3. Adding any field to the project file made every saved project unopenable,
   because validation rejected unknown keys outright.
4. Overlays were addressed to raw source time, so the first cut would have
   required rewriting every saved project.
5. Text length was bounded only inside the renderer.

## Decisions

### One fixed clock per project

`PROJECT_TIMESCALE = 1_440_000` ticks per second, fixed at project creation.
Every time value is `{ ticks, timescale }` with that same timescale.

Chosen because it represents every timebase this product handles as whole
numbers: 30 fps (48,000 ticks/frame), 30000/1001 (48,048), 24/25/50/60,
48 kHz audio (30 ticks/sample), and one millisecond (1,440 ticks — which makes
the v1 migration lossless).

**Rejected:** a per-value timescale. It would make every comparison a
cross-multiplication, with an overflow path and a rounding policy in the
hottest code in the system, in exchange for flexibility this product does not
need. Media that does not divide evenly is converted **once, at import**, by
the asset adapter, which records the residual error on the asset. Measured on
real footage: −3.3×10⁻⁷ seconds for a 30.033-second file.

Ranges are half-open, `[start, start + duration)`, so adjacent items can touch
without overlapping by a frame or leaving a frame's gap.

### Clips, not raw source time

The composition is an ordered list of clip instances. An overlay names a clip
and a composition interval. When the timeline is cut in G5-B, overlays move
with their clip and nothing saved has to be rewritten.

A clip occupies exactly `sourceRange.duration` in the composition. There is no
separate composition-duration field, which makes "no retiming" impossible to
express rather than merely discouraged.

### Two times, named for their timeline

`sampledClipTime` is evidence — where the user pointed. `compositionInterval`
is the instruction — when the nameplate is on screen. v1 had both meanings in
fields that nothing linked and nothing separated; the hand-built UI kept them
equal by luck, and an AI would have no such luck.

### Strict core, preserved extensions

Executable operations are validated strictly and an unknown kind is **rejected
loudly** — never skipped, because skipping means exporting a video the user
never approved and then saving that loss over their project.

Non-executable extensions are namespaced, bounded, and **preserved through a
read and a write**, so a future version's notes are not silently destroyed.

### Change sets and revision fencing

One user request becomes one change set: one approval, one Undo. Acceptance
requires `baseRevision === project.revision` and fails closed otherwise, so an
answer computed against an older project can never land on a newer one.

A change set can be switched off individually. Later change sets are
revalidated and either stay valid or are marked **blocked and shown**. No later
edit is silently altered to make it fit.

### Owner decisions

- **A click means the centre.** v1 put the nameplate's top-left corner on the
  clicked point; nobody chose that. Pointing at a spot means "put it here".
- **Migrated nameplates keep `top-left`.** Moving to the new centre default
  would shift a nameplate in a video the owner already approved.
- **Near an edge, the box is clamped fully inside the safe area** rather than
  allowed to hang off. Half-outside is never what the user meant and some
  platforms crop it.
- **Coordinate space is always stated.** `composition-normalized` for graphics
  laid on the finished frame (the nameplate); `source-normalized` reserved for
  anything stuck to filmed content. Identical today, divergent the first time
  a portrait crop is made from landscape source.

### Server-authoritative editing

The browser asks the server to apply a change and adopts what it is told. It
never declares the new state. Export compiles the stored project on the server
and takes no edit list from the client, so what is exported is always what was
accepted.

## Migration

`migrateProjectV1ToV2` is lossless and idempotent. Milliseconds convert
exactly. The original action ID is preserved in extensions. A v1 edit that
cannot be expressed is carried across **blocked**, never dropped and never
adjusted. The migrated project is validated by the same function that guards
every ordinary read before anything is written, so a migration cannot leave a
file the app refuses to open.

Migration requires the media's real duration, so it probes with ffprobe. If the
probe fails the project stays v1 on disk and the failure is reported.

## Consequences

- Every operation must state its clip and its composition interval.
- The API owns revision; concurrent editors cannot both win.
- One more read of the media at first open, to learn its true length.
- The v1 reader stays until no v1 files remain in the wild.
