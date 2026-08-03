# The media drag payload — built, tested, and deliberately switched off

Gate B of P1-F.1A.

---

## The decision first, because it is the surprising one

**Asset rows are not draggable in the shipped product yet.**

No `draggable` attribute. No drag handle. No drag cursor. A screen reader is not
told about a capability that does not exist.

The contract, the validator, the serializer and the drag-source adapter all
exist and are covered by 9 tests. One boolean turns the gesture on:

```ts
export const MEDIA_DRAG_ENABLED = false   // Gate C flips this
```

### Why off

A drag gesture is a **promise**: press, move, and something will accept it.
Until the Timeline can accept a drop, that promise cannot be kept.

```
  SHIPPING IT NOW                      SHIPPING IT IN GATE C

  user drags a clip                    user drags a clip
        │                                    │
        ▼                                    ▼
  nothing will take it                 the Timeline takes it
        │                                    │
        ▼                                    ▼
  "this product is broken"             "this product works"
```

A gesture that can start and can never finish is worse than no gesture at all:
the user learns the product is broken, and on the evidence in front of them,
they are right.

Building it now and switching it on later means Gate C flips one boolean instead
of writing a data contract under time pressure.

---

## The payload — exactly four keys

```ts
type MediaDragPayloadV1 = Readonly<{
  schemaVersion: 'sanverse.media-drag/v1'
  assetId: string
  mediaKind: 'video' | 'image' | 'audio'
  sourceDurationTicks: number | null
}>
```

Four. Not three, not five. Anything else is refused.

### What is deliberately absent, and why each one matters

| Not included | What including it would cost |
|---|---|
| filesystem path | leaks how the user's disk is laid out |
| source URL | a URL handed to another program if they release over one |
| object URL | a live handle into this tab's memory |
| the asset object | mutable — a drop target could act on a stale copy |
| any project data | a drop must re-read the project, never trust the drag |

The receiver gets an **identity** (`assetId`) plus the two facts it needs to draw
a preview before it has looked anything up: what kind of thing it is, and how
long it is. Everything else it fetches from the project, which is the only place
that is authoritative.

A browser drag can cross a window. Whatever is put in this payload is something
the user's machine will hand to another program if they let go over one. That is
the reason the list above is a list of refusals rather than conveniences.

---

## Refuse, never repair

An **extra** key is refused rather than dropped. A sender that added a key
believes it matters; silently discarding it would leave the two sides
disagreeing about what was just moved, and the disagreement would be invisible
to both.

Refused shapes, all covered by tests:

```
  a missing key                    a wrong schemaVersion
  mediaKind 'caption' or null      an assetId that is not an asset id
  duration 0, -1, 1.5, NaN, ∞      duration as a string
  an array, a string, a number     null or undefined
  + sourcePath / url / objectUrl / project / asset / anything
```

`parseMediaDragPayload` takes genuinely unknown input — it may have come from
another program, or from a much older or newer build of this one — so its only
possible answers are **a valid asset** or **nothing**, never "something half
understood".

---

## The drag source, when it is switched on

```ts
event.dataTransfer.effectAllowed = 'copy'
event.dataTransfer.setData('application/vnd.sanverse.media-drag+json', json)
```

`copy` and not `move`: the asset stays on the shelf. Dragging it to the timeline
places a *use* of it; it does not take it away.

Media whose local file is missing cannot be placed, so it cannot be dragged —
even with the flag on.

Tested: with the flag forced on, the props are correct and the only thing that
reaches the wire is the four-key payload; the serialized string is asserted to
contain no `blob:`, no `http`, no `file:`, no `C:\`, and no filename.

---

## Gate C's job

1. Flip `MEDIA_DRAG_ENABLED` to `true`.
2. Add a visible drag affordance to the row.
3. Make Timeline lanes accept `application/vnd.sanverse.media-drag+json`, parse
   it with `parseMediaDragPayload`, and refuse anything that does not parse.

The Media panel already ignores any drag that is not operating-system files, so
a timeline drag passing over the Media panel can never be mistaken for an import.
