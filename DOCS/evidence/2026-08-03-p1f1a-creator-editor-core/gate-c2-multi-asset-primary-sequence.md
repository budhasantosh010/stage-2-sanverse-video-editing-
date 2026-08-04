# Gate C2 — Multi-asset Primary Sequence

P1-F.1A Gate C2, complete. Written 2026-08-04.

---

## What a person can now do

Drop a second recording onto the main video track. It plays after the first, in
one finished video, and exports as one file.

The refusal that used to appear is gone:

> ~~Sanverse cannot add a second video to the main sequence yet. Drop it on the
> B-roll lane above, or wait for Multi-asset Primary Sequence.~~

---

## The finding that made this small instead of enormous

**The data model already allowed it.**

A composition is tracks, a track is clips, and a clip already carried its own
`assetId`. `validateComposition` was read line by line: the only rule it enforces
about a track's clips is *"they may touch but never overlap"*. There has never
been a rule that they come from the same file.

```
   Clip
   ├── clipId
   ├── assetId          ← already per-clip, not per-track
   ├── sourceRange
   ├── compositionStart
```

So the primary sequence was never missing a data structure. It was missing an
operation that could ADD to it, and two renderers that could open more than one
file.

### What was rejected, and why

```
   REJECTED                              CHOSEN
   ────────────────────────────          ─────────────────────────────
   a new PrimarySequenceV1 object        the video track that already
   beside the composition                exists

   a migration rewriting every           no migration at all
   saved project

   five new operations doing the         split, trim, remove, hide and
   same arithmetic as the five           loudness already work on any
   that exist                            clip from any file
```

Two things that both describe *"what is this video made of"* is exactly the
parallel copy the program's rules forbid. Every cut would have to be applied to
both, and the first time somebody forgot one, the screen and the export would
disagree. Full reasoning in
`DOCS/decisions/ADR-MULTI-ASSET-PRIMARY-SEQUENCE-V1.md`.

---

## What was actually built

### One new operation, plus one that says a different thing

```
   place-primary-clip { clipId, trackId, assetId, sourceRange, compositionStart }
      The main track could only ever be made SMALLER, because nothing could
      add to it. This adds.

   move-primary-clip  { clipId, compositionStart }
      `reorder-clip` puts a piece at position N in the running order and
      refuses outright on a track with holes. Dragging does not mean "make
      this the third one"; it means "put this here".
```

Neither invents rules. Whether the stretch exists inside that recording, and
whether it would overlap what is already there, are both answered by the
composition validator that has always answered them. There is no second copy to
disagree with it.

### The exporter had to stop assuming one file

FFmpeg read the footage as `[0:v]` and `[0:a]` — input zero, always. The plan
had always named the recording on every piece and always listed every file it
needed; the exporter simply never asked.

```
   before   [0:v]trim=start=30:end=90     ← reading 90 s out of a 30 s file
   after    [0:v]trim=start=0:end=30      ← the first recording
            [1:v]trim=start=0:end=60      ← the second, from ITS own file
```

**One thing had to be added to the plan to make this safe.** The exporter opens
`sources[0]` as its first input. That list used to be built purely in segment
order — so once the first segment need not be the original recording, position
zero could name one file while the exporter opened another, and the finished
video would show the wrong footage with no error at all. The project's own
recording now always takes position zero.

### The preview had to stop assuming one file

One `<video>` element, pointed at a different file when the playhead crosses
into a different recording — and **only** then. Swapping inside a recording
would throw away everything the browser had buffered and make the picture
stutter every few seconds for no reason.

Still one element. Never one per clip: twenty clips would be twenty decoders and
a tab that runs out of memory on a long video.

---

## The bug the real browser found, which no test had

The export failed with `RENDER_INPUT_INVALID`. Rule #3, exactly:

```ts
for (const segment of plan.segments) {
  if (segment.sourceStartTicks + segment.interval.duration.ticks > sourceProbe.duration.ticks) {
    throw renderError('RENDER_INPUT_INVALID', 'An accepted edit extends beyond the source duration.')
  }
}
```

Every piece of footage was measured against the **first** recording's length.
That was right while the main sequence could only be made of one. The moment it
could hold two, a perfectly valid 60-second second recording was refused for
being longer than the 30-second first one — and the user was told their edit
*"extends beyond the source duration"* about an edit that fitted perfectly.

Each recording is now measured against itself.

**A second thing the browser taught us, which is not a bug.** After the failure,
pressing Export again returned the cached failure instantly, because the export
key had not changed. That is correct — but it means a fix is not exercised until
something moves the revision. Worth knowing before concluding a fix did not work.

---

## Everything drawn on top does not move

This is the strongest evidence the shape is right, and it needed **no new code**.

A title is anchored to a moment of a NAMED recording (ADR-005).
`placeSourceSpan` searches every clip for that recording and matches only the one
the title names. Time is not what decides — the name is.

```
   a title pinned to recording A, second 8
   ├── recording B is placed after it     → the title does not move
   ├── recording B is trimmed             → the title does not move
   └── recording A is trimmed by 4 s      → the title moves with its moment
```

Two tests hold this: one that a title's placement is byte-identical before and
after a second recording is added, and one that a title never draws on the
second recording just because their times overlap.

## Linked embedded audio

A1 is a **view of the same clip**, not a second object. The Timeline builds an A1
item from each V1 clip with the same `clipId`. Moving the picture moves the sound
because they are one thing.

Proved in the browser: after the drop, V1 showed two items and A1 showed the same
two `clipId`s.

## Migration and versions

**No migration.** A project with one recording is already a valid multi-asset
sequence that happens to contain one. Nothing is read, rewritten, or versioned.

**No render-plan bump.** The plan already carried `assetId` on every segment and
already listed every source. Its shape did not change, so moving the version
would have thrown away every cached export to produce byte-identical files. The
version moves when the shape moves — it moved for Gate C1, and it correctly does
not move here.

---

## Real-browser and real-export proof

Owner's project, real media: a 30.03 s recording and a 60.03 s recording.

### The drop

```
   lane:overlay   accepts
   lane:video     accepts      ← was "refuses" before this gate
   lane:caption   refuses
   lane:dialogue  refuses
   lane:music     refuses

   dropped inside existing footage   revision 32 → 32, and on screen:
                                     "Something is already on the main video
                                      track at that moment. Move it first, or
                                      drop this after it."

   dropped after it                  revision 32 → 33
```

### The timeline afterwards

```
   V1   clip_a5c6b54b60f2   0 → 338px    (30.03 s)
        clip_buz67yn63m3u   338 → 1014px (60.03 s)
   A1   the SAME two clip ids, mirroring them
   video elements on the page: 1
```

### The exported file

```
   duration      90.066 s      = 30.033 + 60.033, both recordings really there
   streams       video 1920x1080 + audio
   size          43.7 MB

   picture brightness (16 = pure black)
      t = 10 s    113.2
      t = 25 s    126.5     still the first recording
      t = 35 s    109.2     the second recording
      t = 50 s    113.2
      t = 80 s    117.7     50 seconds past the end of the first file
```

Real picture at 80 seconds is the decisive number. The first recording is 30
seconds long, so that frame can only have come from the second file. Before this
gate the exporter refused outright; an exporter that still read input zero would
have produced a frozen or black picture there.

---

## Numbers

```
   tests    1,510 → 1,535      (+25)

            edit-domain           378
            api                   268
            render-contract        80
            intent-domain          27
            web                   782

   all-workspace npm run build    exit 0
```

Four existing tests were **rewritten to assert the new truth**, not deleted:

```
   before   V1 refuses a second video with OPERATION_UNSUPPORTED
   after    V1 accepts a second video; refuses only on a collision, and
            still refuses a picture and music with "where it goes" sentences

   before   the lane highlight matched planner acceptance exactly
   after    the highlight answers about the KIND only; a drop may still be
            refused on release for a reason no highlight could know (a
            padlock, an export, something already there). The test now
            forbids the two directions that matter: lighting up and then
            refusing the KIND, and not lighting up but accepting.
```

## Two honest limits

- Drops were driven by dispatched `DragEvent`s, not a physical mouse. The
  payload, the planner, the API round trip, the resulting project and the
  exported file are all real; the hand was not.
- No screenshots. Everything above is read from the live DOM, the API, and
  `ffprobe`/`ffmpeg` on the real exported file.
