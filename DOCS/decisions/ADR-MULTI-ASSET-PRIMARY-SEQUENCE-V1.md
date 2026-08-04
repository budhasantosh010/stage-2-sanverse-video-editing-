# ADR — Multi-asset Primary Sequence V1

**Status:** accepted · 2026-08-04 · P1-F.1A Gate C2

---

## The question

Today the main video track (V1) holds pieces of exactly **one** recording. Drop
a second video on it and Sanverse refuses, truthfully:

> Sanverse cannot add a second video to the main sequence yet. Drop it on the
> B-roll lane above, or wait for Multi-asset Primary Sequence.

How do we let V1 hold several recordings, one after another?

---

## The finding that decides everything below

**The data model already allows it.**

A composition is tracks, a track is clips, and a clip already carries its own
`assetId`:

```
   Clip
   ├── clipId
   ├── assetId          ← already per-clip, not per-track
   ├── sourceRange      ← which stretch of THAT file
   ├── compositionStart ← where it sits in the finished video
   ├── enabled
   ├── gainDb · fadeIn · fadeOut
```

`validateComposition` was read line by line. The only rule it enforces about a
track's clips is **"they may touch but never overlap"**. There is no rule
anywhere that they must come from the same file. That was never a restriction in
the data — it was a restriction in what could be *asked for*.

## The decision

**The primary sequence IS the composition's video track. We do not build a
second one.**

```
   REJECTED                              CHOSEN
   ────────────────────────────          ─────────────────────────────
   a new PrimarySequenceV1 object        the video track that already
   holding PrimarySequenceClipV1         exists, holding the clips that
   items, living beside the              already exist
   composition

   a migration that rewrites every       no migration at all
   saved project into the new shape

   two things that both describe         one thing
   "what the video is made of"
```

### Why the rejected option is worse, in three steps

**1. It would be a parallel copy of the truth.**
The program's own rules say: one EditProject, one accepted history, one shared
render contract, *do not create parallel copies*. A `PrimarySequenceV1` sitting
next to a `Composition` — both answering "what is this video made of?" — is
exactly that. Every cut, every trim, every split would have to be applied to
both, and the first time somebody forgot one, the screen and the export would
disagree.

**2. It would put every existing project at risk for no gain.**
Rewriting saved files is the single most dangerous thing this system can do.
Doing it to reach a shape the data already supports means taking that risk to
buy nothing.

**3. Every operation that already works would have to be rewritten.**
`split-clip`, `trim-clip`, `remove-clip`, `set-clip-enabled` and `set-clip-audio`
are already written against clips, are already tested, and already work on a
clip whatever file it came from. A parallel structure would need five new
operations that do the same arithmetic, and the two sets would drift.

---

## What is actually missing

Only three things. Everything else already works.

```
   ALREADY WORKS                          MISSING
   ────────────────────────────           ─────────────────────────
   split a clip      split-clip           adding a clip at all
   trim a clip       trim-clip            ← no operation places a NEW
   remove a clip     remove-clip            piece of footage on V1
   reorder clips     reorder-clip
   hide a clip       set-clip-enabled     moving a clip to a
   clip loudness     set-clip-audio       chosen moment
   dip between two   set-clip-transition  ← reorder only swaps
                                            positions on a gapless
   the render plan already carries          track
   one segment per clip WITH its own
   assetId, and already lists every       the two renderers only ever
   file it must open                      open ONE file
```

### 1. `place-primary-clip` — the one genuinely new operation

```
   place-primary-clip
   ├── clipId          the new piece's name, carried in the operation so
   │                   replaying the same history gives the same file
   ├── assetId         which recording
   ├── sourceRange     which stretch of it
   ├── compositionStart where it goes in the finished video
   └── mode            'normal' | 'insert' | 'overwrite' | 'append'
```

`insert` and `overwrite` are expressed as **what the operation does to the other
clips**, in the same change set, exactly as Gate C1 did for B-roll. One gesture
stays one Undo.

### 2. `move-primary-clip`

`reorder-clip` moves a piece to position N in the running order and refuses on a
track with holes. That is not the same as "put this piece at 12 seconds", which
is what dragging means. `move-primary-clip { clipId, compositionStart }` says the
second thing.

### 3. The two renderers must open more than one file

This is the real work, and it is the same gap in both.

**FFmpeg** currently reads the footage as `[0:v]` and `[0:a]` — input zero,
always. It must instead map each segment to the input that holds its asset. The
plan already names the asset on every segment and already lists every file in
`sources`; the exporter simply never looked.

**The browser** currently points one `<video>` at one file for the whole
project. It must change `src` when playback crosses from one recording to the
next — and only then, because reloading mid-recording would stutter every few
seconds. Still **one** video element: never one per clip.

---

## Anchoring: what happens to everything drawn on top

Unchanged, and this is the part that could quietly break.

Everything drawn on the picture is anchored to a moment of a **named** recording
(ADR-005): `{ assetId, sourceInterval }`. `placeSourceSpan(composition, assetId,
span)` already searches every clip for that asset and returns each place it
survived. With two recordings on V1, it searches both and matches only the one
the overlay names.

```
   a title pinned to recording A, second 8
   ├── recording A is on screen 0-20 s        → title draws at 8 s
   ├── recording B is placed after it         → title does NOT move
   └── recording A is trimmed by 4 s          → title draws at 4 s
```

So a title on the first recording is untouched by anything that happens to the
second. That falls out of the existing design rather than needing new code, and
it is the strongest evidence that this is the right shape.

**Repeated assets** work for the same reason: the same file placed twice is two
clips with the same `assetId` and different `sourceRange`s, and an overlay
anchored to a moment that appears in both draws in both — which is correct,
because it IS that moment, twice.

## Linked embedded audio

A1 shows the sound that came with the picture. It is a **view of the same clip**,
not a second object: the Timeline builds an A1 item from each V1 clip and gives
it the same `clipId`. Moving the picture moves the sound because they are one
thing. There is deliberately no operation that moves A1 on its own — a copy that
can drift apart is worse than none, and unlinking is a later gate.

## Missing sources

A clip whose file is gone already fails composition validation, and the change
set that placed it is reported blocked rather than silently dropped. Unchanged.

## Migration

**None.** A project with one recording is already a valid multi-asset sequence
that happens to contain one asset. No file is read, rewritten, or versioned.

## Render-plan version

**No bump.** The plan already carries `assetId` on every segment and already
lists every source. Its shape does not change, so moving the version would throw
away every cached export to produce byte-identical files. The version moves when
the shape moves, and not otherwise.

The FFmpeg adapter and the browser preview change *how they read* a plan they
were already being given correctly.

## What this does NOT include

- Unlinking A1 from V1.
- More than one V1 track.
- Speed changes, reverse, or transitions between different recordings beyond the
  dip that already exists.
- Anything about filmstrips or waveforms — that is Gate D.

## Acceptance

- A second video can be dropped on V1 and the refusal sentence is gone.
- V1 clips can be moved, trimmed, split, hidden, deleted and rippled whatever
  file they came from.
- Preview and export show the same video, with one `<video>` element.
- An existing single-recording project exports byte-identically to before.
