# Gate C1.1 and C1.2 — the placement planner, and media drag switched on

P1-F.1A Gate C1, partial. Written 2026-08-04.

**This document covers C1.1 (the planner) and C1.2 (media drag enabled) only.
The rest of Gate C1 is NOT done** — see "What is still missing" at the bottom.

---

## The one rule this exists to keep

```
   drag a logo onto the intro          type "put the logo over the intro"
              │                                        │
              └────────────────┬───────────────────────┘
                               ▼
                    planTimelinePlacement()
                               ▼
                    the SAME operation
```

If the rules lived in the drop handler, the AI would need a second copy of
them, and the two would disagree the first time either was touched. Then the
product has two personalities: the buttons do one thing and the chat box does
another, and no one can say which is correct.

So `features/timeline/timeline-placement-planner.ts` is a plain function. No
React, no network, no project mutation. Same project plus same gesture gives the
same answer, every time — which is also what lets it be tested without a
browser.

---

## What it owns, and what it deliberately does not

```
  OWNS      which lane takes what · lock · placement mode · collision ·
            stale revision · pending suggestion · running export ·
            the exact sentence said when the answer is no

  DELEGATES building the operation → features/media/media-actions.ts
```

That second line matters. `media-actions` already knew how to anchor B-roll to
the original footage (ADR-005) and music to the finished video (ADR-007). A
second builder here would have been a second set of rules about where things
land, and the two would drift. The planner calls the existing one.

---

## What each lane does with a drop

```
  V2  video, picture   ACCEPTS  → add-media-overlay, anchored to the footage
  A2  sound            ACCEPTS  → add-music, anchored to the finished video
  V1  anything         REFUSES  → OPERATION_UNSUPPORTED
  A1  anything         REFUSES  → OPERATION_UNSUPPORTED
  C1  anything         REFUSES  → TRACK_INCOMPATIBLE
```

### Why V1 refuses instead of working

There is no `append-clip` operation, and V1 holds exactly one asset. Every clip
on V1 is a piece of the same file. A second video dropped there **has no
operation to become.**

It is refused rather than quietly placed on V2, because a product that puts your
video somewhere other than where you dropped it has told you a lie you cannot
recover from — and every later question ("why is my second video on top of my
first?") is unanswerable. The sentence, shown on screen and proved below:

> Sanverse cannot add a second video to the main sequence yet. Drop it on the
> B-roll lane above, or wait for Multi-asset Primary Sequence.

It says what cannot happen **and** what to do instead, in one line, with no
jargon. A true limit is repairable later; a lie is not.

---

## The highlight and the outcome are ONE decision

A lane that lights up green under the pointer and then refuses when the user
lets go is the product changing its mind after they have committed to the
gesture. So `acceptsMediaKind` is derived from the same table `compatibility`
uses, and a test walks **every lane × every kind of file** and fails on any
disagreement.

One direction of disagreement is allowed and is deliberate: a **locked** lane
still highlights on kind, because a padlock is not about what sort of file it
is, and then refuses on release with a reason. That is allowed because the
release always explains itself.

The highlight is not colour alone — the accepting lane gets an inset outline,
the refusing lane gets reduced contrast and a "no entry" cursor. And it appears
**only while a drag is in the air**: `data-drop-target` is absent at every other
moment, so nothing here can be triggered by hovering, which is the exact fault
Gate B1 existed to remove.

---

## Why the drag switch could be flipped now

`MEDIA_DRAG_ENABLED` was `false` because a gesture that can start and can never
finish teaches the user the product is broken, and they are right.

It is `true` now because every lane finishes the gesture. **A refusal is a
finish.** What would not be a finish is a lane that swallows the drop and shows
nothing.

Reading the drag payload needed one non-obvious thing, recorded so nobody has to
rediscover it: `dataTransfer.getData` is only permitted during `dragstart` and
`drop` — **never during `dragover`**, which is precisely when a lane needs to
know what is coming. So the payload is captured once by a document-level
`dragstart` listener in the bubble phase (the row has already written it by
then) and held as presentation state until the drag ends.

---

## Real-browser proof

Real project, real media, running server, 2026-08-04. Drops driven through real
`DragEvent`s carrying a real `DataTransfer`.

### What travels on the wire

```json
{"schemaVersion":"sanverse.media-drag/v1",
 "assetId":"asset_8adbb56a84d4adae1742edff3eb04b12",
 "mediaKind":"video","sourceDurationTicks":86448000}
```

Four keys. No filesystem path, no URL, no object URL, no project object — which
matters because a browser drag can cross a window and be handed to another
program.

### Every lane's answer, while dragging a video

```
  lane:overlay   accepts
  lane:video     refuses
  lane:caption   refuses
  lane:dialogue  refuses
  lane:music     refuses
```

### Dropping a video on V2

```
  revision            8 → 9
  change sets         0 → 1
  operation           add-media-overlay
  blocked             0
  V2 lane in the DOM  gained items
  highlight after     cleared
  error message       none
```

### Dropping the same video on V1

```
  revision       9 → 9        nothing happened
  change sets    1 → 1        nothing happened
  operations     1            V2 did NOT quietly receive it
  on screen      "Sanverse cannot add a second video to the main sequence yet.
                  Drop it on the B-roll lane above, or wait for Multi-asset
                  Primary Sequence."
```

### An abandoned drag

```
  lane lit while dragging   accepts
  drag abandoned (dragend)
  revision                  9 → 9
  change sets               1 → 1
  highlight afterwards      cleared
```

Pointer movement created nothing: no operation, no request, no history entry.

### Dropping music on A2

```
  revision      9 → 10
  change sets   1 → 2
  operations    add-media-overlay, add-music
  blocked       0
```

The owner's project was returned to 0 change sets afterwards.

---

## Tests

```
  apps/web   667 → 706   +39
             timeline-placement-planner.test.ts   33
             timeline-drop-target.test.ts          5
             media-drag-contract.test.ts          +1 (a new "still refuses
                                                  unplaceable media" case)
```

Two existing tests asserted the OLD truth — that drag was switched off — and
were **rewritten to assert the new one**, not deleted:

```
  before   expect(MEDIA_DRAG_ENABLED).toBe(false)
           expect(row).not.toHaveAttribute('draggable')

  after    expect(MEDIA_DRAG_ENABLED).toBe(true)
           expect(draggableRows.length).toBeGreaterThan(0)
           + a NEW case proving unplaceable media is still not draggable
```

All-workspace `npm run build`: exit 0.

---

## What is still missing — Gate C1 is NOT complete

Delivered: **C1.1** (planner) and **C1.2** (drag enabled, drop targets).

Not started:

```
  C1.3   pointer drag session for items already on the timeline
  C1.4   Timeline presentation restructure (the visible "05", the heading)
  C1.5   Timeline toolbar
  C1.6   track lock and output UI          (lock state exists, no control yet)
  C1.7   TimelineLockStateV1 sidecar, set-track-output operation
  C1.9   Insert and Overwrite that actually move things  ← see below
  C1.10  moving items already on the timeline
  C1.11  trim        C1.12  split        C1.13  lift and ripple delete
  C1.14  snapping on drop   C1.15/16  playhead and selection work
  C1.17  keyboard    C1.18  track output parity
```

### Insert and Overwrite are honest stubs, not silent ones

`Normal` and `Append` work. `Insert` and `Overwrite` are planned and then
**refused** when they would actually have to move or replace something:

> Insert cannot push these along yet. Use Normal and place it where there is
> room.

There is no operation that can move or shorten an existing overlay as part of
another placement. An "Insert" that quietly behaved like "Normal" would lose the
thing it was supposed to push along, and the user would not find out until
export. Refusing is the smaller failure.

### Two honest limits on the proof above

- Drops were driven by dispatched `DragEvent`s, not by a physical mouse. The
  payload, the planner, the API round trip and the resulting project are all
  real; the pointer was not.
- No screenshots. This browser pane does not composite frames, so everything
  above is read from the live DOM and the API rather than seen.
