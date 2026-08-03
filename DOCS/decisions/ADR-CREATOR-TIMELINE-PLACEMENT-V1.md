# ADR-CREATOR-TIMELINE-PLACEMENT-V1 — putting media on the Timeline

- **Status:** ACCEPTED, 2026-08-03
- **Gate:** P1-F.1A Gate C — Creator Timeline Core V2
- **Supersedes nothing. Depends on ADR-005, ADR-007, ADR-008.**

---

## The one sentence

**A drop is a request. It becomes exactly one atomic change set, or it becomes
nothing and says why — and the five lanes are five different promises, not five
copies of the same one.**

---

## 1. What is actually on the Timeline today

Before deciding anything, here is what the product really has. Everything below
was read out of the code, not remembered.

```
  LANE   what it is                    what an item there is made of
  ────   ──────────────────────────    ──────────────────────────────────────
  V2     B-roll, images, overlays      add-media-overlay / add-title /
                                       add-callout operations
  V1     the primary video sequence    the ONE primary asset, cut into clips
  C1     captions                      one add-captions operation, many cues
  A1     dialogue                      the primary asset's own sound
  A2     music and extra audio         add-music operations
```

The operations that exist:

```
  timeline   split-clip · trim-clip · remove-clip · reorder-clip ·
             set-clip-enabled · set-clip-audio · set-clip-transition
  overlays   add-title/set-title · add-callout/set-callout ·
             add-media-overlay/set-media-overlay · add-music/set-music
  captions   add-captions and its repairs
  visual     set-visual-properties · set-footage-motion
```

### The fact that decides this whole ADR

**There is no `append-clip` operation, and V1 holds exactly one asset.**

Every clip in V1 is a piece of the *same* video file — the one the project was
created from. `split-clip`, `trim-clip` and `reorder-clip` all rearrange pieces
of that single source. Nothing in the domain can put a *second* video file into
the primary sequence.

So "drag your second video onto V1" is not a UI problem. There is no operation
for it to become.

---

## 2. Decision — what a drop may do in Gate C

```
  DROP TARGET   ACCEPTED?   becomes
  ───────────   ─────────   ────────────────────────────────────────────────
  V2  video     YES         add-media-overlay, anchored to the footage
  V2  image     YES         add-media-overlay, bounded default duration
  A2  audio     YES         add-music, anchored to the FINISHED video
  V1  anything  NO          refused: OPERATION_UNSUPPORTED
  A1  anything  NO          refused: OPERATION_UNSUPPORTED
  C1  anything  NO          refused: TRACK_INCOMPATIBLE
```

### Why V1 is refused rather than faked

Three ways to fake it were considered and rejected:

1. **Add an `append-clip` operation now.** This is the honest long-term answer,
   and it is a *large* change: the composition model, the render plan's
   `segments` list, FFmpeg's concat behaviour, every source-anchored overlay's
   `placeSourceSpan` translation, and the v4→v5 project migration all move.
   Doing it inside a UI gate would mean shipping the deepest change in the
   product with the least attention on it.

2. **Put the second video on V2 and call it V1.** The user drops on the primary
   lane, the clip appears on the overlay lane. The product lied about where the
   thing went. Every later question — "why is my second video on top of my first
   one?" — is now unanswerable.

3. **Accept the drop and show a spinner that never resolves.** No.

**A refusal that says why is a smaller failure than a lie that works.** The
refusal is:

> *"Sanverse cannot add a second video to the main sequence yet. Drop it on the
> B-roll lane above to lay it over your video."*

That sentence tells the user what the product cannot do **and** what it can do
instead, in one line, with no jargon. It is a true statement about a real limit,
which is repairable later by adding `append-clip`; a lie is not repairable at
all.

### Recorded as the next slice

**`append-clip` and multi-asset primary sequences are named as their own future
slice**, out of scope for Gate C and Gate D. Anyone reading this ADR who wants
to drop a second video on V1 should implement that slice, not widen this one.

---

## 3. Placement identity and anchoring

Follows ADR-005 without exception.

```
  V2 B-roll / image   anchored to the ORIGINAL primary footage.
                      Cut four seconds off the front of your video and the
                      B-roll stays on the shot it was placed over, rather
                      than sitting at a wall-clock moment that now shows
                      something else.

  A2 music            anchored to the FINISHED video, per ADR-007.
                      Cutting the middle out of your video must not cut the
                      middle out of the song.
```

`placeSourceSpan` remains the only translator between composition time and
source time. A placement planner may not do that arithmetic itself.

**Footage the placement was anchored to and which is later deleted outright
blocks the placement and says so. It is never relocated to a guess.**

---

## 4. The planner is pure, and it is the only place policy lives

```
  planTimelinePlacement({ project, asset|placement, sourceLaneId, targetLaneId,
                          atTicks, placementMode, includeLinkedAudio,
                          snapping, idFactory })
       -> Result<AtomicTimelinePlan, TimelinePlacementRefusal>
```

No React. No fetch. No mutation. Given the same project and the same gesture it
returns the same answer, every time, which is what makes it testable without a
browser and reusable by an AI proposal later.

**Refusal codes are a closed set:**

```
  TRACK_LOCKED · TRACK_INCOMPATIBLE · ASSET_MISSING · SOURCE_UNAVAILABLE ·
  COLLISION · UNSUPPORTED_AUDIO_LINK · OUT_OF_RANGE · PROPOSAL_PENDING ·
  EXPORT_IN_PROGRESS · PROJECT_STALE · OPERATION_UNSUPPORTED
```

Every one carries a plain sentence for the user. An unknown code is a refusal,
never a shrug.

**Why the policy cannot live in the React drop handler:** because then the AI
would have a second, different set of rules. "Put the logo over the intro" typed
into the chat box and dragging the logo over the intro must produce the *same*
operation, or the product has two personalities.

---

## 5. Placement modes

```
  NORMAL      place it where it was dropped, if the lane is compatible and
              nothing is already there
  INSERT      make room at the drop point and push what follows later
  OVERWRITE   replace whatever occupies that stretch of the target lane,
              keeping the parts of neighbours that were not covered
  APPEND      put it after the last compatible item on that lane
```

All four are decided inside the planner. A React handler that implements
"insert" by calling "normal" twice is forbidden: two operations that can each
succeed or fail independently is exactly how a user ends up with half an edit.

---

## 6. One gesture is one Undo

**A pointer press, a move, and a release is ONE change set and ONE history
entry.**

- Pointer movement creates **no** operation, **no** API call, and **no** project
  evaluation. It moves a ghost and a snap guide, and nothing else.
- Pointer release creates exactly one validated atomic change set.
- Escape during the gesture creates nothing at all.

Dragging a clip from 4 seconds to 9 seconds and pressing Undo once puts it back
at 4 seconds. Not five times for five intermediate positions.

### Linked video and audio

A primary V1 clip and its A1 dialogue share a stable `linkGroupId`. They move,
split, trim and delete **together, in one change set, under one Undo**. There is
no state in which the picture is at 9 seconds and its voice is at 4.

Unlinking is **not** implemented in Gate C. A control that half-works is worse
than no control, and an "unlink" that leaves two items that can silently drift
apart is the single easiest way to ruin someone's edit without telling them.

---

## 7. Track lock and track output are different things

This is the distinction editors get wrong most often, so it is stated flatly:

```
  LOCK     protects the track from YOU. It blocks editing gestures.
           It changes NOTHING about the exported file.

  OUTPUT   changes the exported file. Hiding V2 removes the B-roll from the
           preview AND from the export. Muting A2 removes the music from both.
           It does NOT stop you editing the track.
```

A locked track renders exactly as before. A hidden track renders as if its
contents were not there — and the preview shows the same thing the export
produces, because that parity is the promise the whole render-plan design
exists to keep.

**V1 hidden** means intentional black wherever no lower visual layer exists —
the same black an emptied stretch produces, and the same black in the file.

**The AI respects lock.** A proposal that would edit a locked track is refused
with `TRACK_LOCKED`, in the same words the drag gesture uses.

### Where track state lives

`TrackStateV1 = { trackId: 'V2'|'V1'|'C1'|'A1'|'A2', locked, outputEnabled }`
— a closed set of five known ids, no arbitrary strings.

**`outputEnabled` changes the exported file, so it belongs to the project and
moves the revision.** **`locked` does not change the file, so it is presentation
state and must not.** They are stored separately for that reason, exactly as
Gate B kept folders out of `EditProject`: anything that cannot change the output
must not be able to move the export key
`sha256(projectId : revision : renderPlanSchemaVersion)`, or a user toggling a
padlock would re-encode an identical video for 60–90 seconds.

---

## 8. The blocker that must be fixed before any of this

**A change set holding both a cut and an overlay can have the cut applied while
being reported blocked for its overlay** (recorded under ADR-005).

Nothing creates such a set today, which is why it has survived. **Gate C creates
them by design** — an insert is a placement plus a ripple; a linked placement is
a picture plus its sound.

**This must be fixed before the planner is allowed to emit any multi-operation
plan.** A half-applied change set is worse than a refused one: the user sees an
error message and a changed video at the same time, and no Undo they press is
the one they want.

---

## 9. Deliberately not in Gate C

Named so nobody has to guess whether they were forgotten:

```
  append-clip / a second video in the primary sequence   its own slice
  unlinking video from audio                             not until complete
  marquee multi-select and batch operations              deferred
  roll, slip, slide, multicam, nested sequences          not this product
  unlimited general multitrack                           five lanes, on purpose
  asset deletion                                         still does not exist
```

The five lanes are a product decision, not a limitation to be lifted. A person
who has never edited before can hold "picture, cutaway, words, voice, music" in
their head. Twelve numbered tracks they cannot.

---

## 10. What this costs if it is wrong

- If refusing V1 drops turns out to be the wrong call, the cost is one refusal
  message and the `append-clip` slice — nothing built on top of it has to be
  unbuilt.
- If `locked` had gone into `EditProject`, every padlock click would be an Undo
  entry and an export-key change. Reversing that later means a project
  migration.
- If the pure planner had been skipped and the rules lived in drop handlers, the
  AI would be given a second rulebook, and the two would drift the first time
  either was touched.
