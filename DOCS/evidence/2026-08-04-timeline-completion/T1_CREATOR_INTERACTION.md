# Gate T1 — picking, moving, copying, grouping and noting

2026-08-06 · built on `ad11b07`

## What a person could not do before this

The Timeline could hold exactly **one** thing at a time. That is enough to click
a clip and delete it. It is not enough for anything a creator actually does.

```
  BEFORE                              AFTER
  ──────                              ─────
  one clip picked, ever               as many as you like
  no way to box several               drag a box round them
  move one, then the next, then       move them together, keeping
    the next — three Undos              their spacing, one Undo
  no copy, no paste, no duplicate     copy, cut, paste, duplicate
  no way to say "these go together"   group them
  nowhere to write "fix this bit"     leave a note, with a colour
  rows a fixed height                 short / normal / tall, or folded
  one fixed set of keys               Sanverse, CapCut, Premiere, Resolve
  a hole you could look at            a hole you can select and close
```

---

## 1. Picking things

### The list, and the anchor

Selection is now a **list of names** plus one extra thing: the **anchor**, which
is the last thing the user deliberately pointed at.

The anchor has to be remembered rather than worked out, because the list is a
set with no order:

```
  click clip 3         picked {3}          anchor 3
  ctrl-click clip 1    picked {1,3}        anchor 1
  ctrl-click clip 2    picked {1,2,3}      anchor 2
  shift-click clip 5   picked {1,2,3,4,5}      measured from 2
```

Sorted by name and free of repeats, so two equal selections really are equal —
otherwise React would think the selection changed on every frame.

### What the panels show

The Inspector can only deal with one thing at a time. The first version of this
answered **null** whenever several were picked, and that was wrong in an
ordinary case: clicking a piece of footage also picks the sound recorded with
it, so a single click produces two selected items and the Inspector went blank
on every click.

It now shows **the anchor** — the thing the user actually pointed at. Not the
first of the list, which means nothing.

### Two kinds of binding, deliberately different

```
  GROUPS   the user said "these move together"    stored in the project
  LINKS    a picture and the sound recorded       nobody chose this;
           WITH it                                it is a fact about the file
```

Both are expanded in one place, so a click, a Ctrl-click, a Shift-range and a
marquee all treat them identically. If the expansion lived in the click handler,
dragging a box round a clip would take the picture and leave its own sound
behind — and the user would silence themselves without ever being told.

**A real defect was found here while writing the tests.** The first version
matched anything sharing a `clipId`, and a piece of B-roll is *pinned* to a clip
and so carries that clip's id. Clicking a piece of B-roll silently picked up the
whole piece of main footage underneath it, and the next Delete would have taken
both. The link is now matched only through `linkedClipId`, and only between the
two rows it can exist between.

### Shift is one row, on purpose

A rectangle across all rows sounds more powerful and is the wrong default:
shift-clicking a clip four rows down would silently pick up music and captions
nobody looked at. Boxing a rectangle is what the **marquee** is for, and it
shows exactly what it will take before you let go.

### The one thing this must never do

Drop something because it scrolled out of view. The projection holds every item
in the project; only the drawing is limited to what is on screen. A test drives a
171-item project, selects everything, and asserts nothing is lost.

---

## 2. Dragging a box

Only starts on **empty space**. Pressing on a clip means move that clip; one
gesture cannot mean both, and deciding from how far the pointer travelled would
mean a small accidental wobble either moved a clip or selected half the timeline,
depending on luck.

- It catches what it **touches**, not only what it fully contains. A sixty-second
  clip cannot fit inside a box a person can comfortably drag, so containment
  would make long clips impossible to catch. The cost — a box that clips a
  neighbour's tail catches the neighbour — is visible before letting go.
- Dragging right-to-left catches exactly the same things as left-to-right.
- Ctrl adds, Shift flips, plain replaces.
- Dragging against an edge scrolls the timeline, over a 48-pixel band, faster the
  deeper in you go. A one-pixel target at the very edge only ever works by
  accident.
- A drag under a quarter of a second counts as a click on empty space, so a shaky
  hand cannot silently select something.
- Escape puts back **exactly** what was picked before the drag started.
- **No operation, no revision, no Undo entry.**

---

## 3. Moving and trimming several things at once

One gesture is one change set is one Undo. The lazy version — a loop sending one
change set per item — is wrong in three separate ways:

1. Four Undos to undo one drag, and the first Undo leaves the video in a state
   nobody asked for and nobody saw.
2. Each item would be planned against the project as it was BEFORE the others
   moved, so two clips swapping places would each be told the other is in the way.
3. If the third of four is refused, the first two have already happened, and
   there is no honest thing to say to the user at that point.

**All-or-nothing.** If any item cannot make the move, nothing moves. Moving the
ones that fit would change the very spacing the user picked several of them to
preserve.

Collisions are judged against what is **not** moving — otherwise a whole row
shuffled along by one second would refuse on its own tail.

### The ghost and the edit are the same answer

The ghost shown while dragging comes from the **same planner** that makes the
edit, called with the same inputs. There is no second "roughly what will happen"
calculation. Gate T0 existed because two pieces of code answered the same
question separately; this is that lesson applied before the bug.

A refusal comes back as a refusal, so the timeline can say why **before** the
user lets go.

---

## 4. Copy, cut, paste, duplicate

### What is copied, and what is deliberately not

```
  COPIED                          NEVER COPIED
  ──────                          ────────────
  which file (its id)             the file's path on disk
  how far in it starts            any URL, local or otherwise
  how long it runs                any object from the project
  where it sat, RELATIVE to       the project itself
    the earliest copied item      anything typed elsewhere
  loudness, fades, opacity
  the box it is drawn in
```

The right-hand column is a **security rule**, not tidiness. A clipboard can be
read by other parts of the app and, on some systems, by other programs. A file
path tells an outsider a person's name and where they keep their work. An id that
only means something inside this project tells them nothing.

The test does not merely search for forbidden words — the entry fields are a
**closed list**, so anything new has to be added to the test too, which is the
moment somebody would notice they were about to copy a path.

### Relative time

```
  copied at 10s, 11s, 12s    ──►   offsets 0, 1s, 2s
  paste with playhead at 30s ──►   30s, 31s, 32s
```

### Everything else

- Copy **reads only**. There is no route by which it could change the project,
  which is the structural reason a mis-click on Copy can never cost anything.
- Cut is the copy **and** the removal, in one change set. If the removal is
  refused, an earlier copy is left untouched.
- Duplicate is built out of Copy and Paste, so there is one set of rules about
  what can be duplicated. It does **not** touch the clipboard.
- One paste is one Undo, however many things land.
- A clipboard from a different project is refused: its ids mean nothing here.

---

## 5. Groups and notes — the user's work that changes no frame

### Why they were hard

Both are **the user's own work**. Somebody typed that note; losing it when they
open the project on another computer would be losing work. So they must travel
with the project and be undoable.

Both change **nothing** about the finished video. So they must not make it be
built again.

Those two requirements only conflict because of how an export used to be
identified:

```
  BEFORE:  export key = projectId : revision : schemaVersion
                                    ^^^^^^^^
           any edit at all — even one that changes nothing you can see —
           made a new key and threw away a finished export

  AFTER:   export key = projectId : schemaVersion : the render plan itself
           the key describes WHAT WILL BE PRODUCED
```

`projectRevision` is the only field dropped before comparing, and it is dropped
because FFmpeg never reads it: it is a label on the instruction, not part of it.
Everything else stays in.

**Proved in the running app** — see the evidence at the bottom.

This also fixed waste that was already there: renaming, muting-and-unmuting, or
any no-op toggle used to discard a finished export.

### What a group is NOT

Not a container. Nothing is put inside anything.

```
  group_a1b2c3d4  ──►  [ overlay:broll_77:0 , music:music_31:0 ]
                        two things already on the timeline; the group
                        only records that they belong together
```

A reader that has never heard of groups produces the identical video. One thing
may be in at most one group — two groups sharing an item would make "select the
group" ambiguous and would plan a move twice for one clip, moving it double the
distance.

Membership is stored by **on-screen name**, so a user who grouped only the second
half of a split clip gets the second half. The cost, stated: a deleted item
leaves a stale name, which is **ignored** rather than treated as corruption.

### Notes

A point and a range are **one kind of thing** — a point is a range of zero
length. Two types would mean two code paths for "move a note", and they would
drift.

- Six named colours, not free colour values: a user must not be able to make
  their own note invisible, and a name survives a theme change where `#ff0000`
  does not.
- Control characters are **refused** by the domain rather than stripped, so
  nothing different from what was typed is ever stored — and **tidied once** at
  the edge, where typing becomes an edit, so a pasted line break does not become
  a refusal nobody can explain. A newline is kept in a note and becomes a space
  in a label, because a label is one line on a timeline.
- A note past the end of the video is not drawn and **not deleted**: the user
  trimmed the end off, and putting the footage back must bring their note back.
- Every change sends the **whole list**, so the last one wins outright and Undo
  restores the previous complete list.

---

## 6. Holes you can act on

A hole is nothing — the absence of footage between two clips. The rule that must
not be broken: **it must never be drawn or described as if it were media.** No
filmstrip, no waveform, no file name. It says "Empty space, 4.0 seconds long.
Nothing plays here." and that is all it claims to be.

Closing one pulls **every** later clip back, not just the next:

```
  before   |A|    |B||C||D|
              ^hole
  wrong    |A||B|    |C||D|      the hole just moved
  right    |A||B||C||D|          the hole is gone
```

Forty clips moving is still one change set and one Undo. B-roll travels with the
footage automatically, because it is pinned to a moment of the footage. Music
stays where it was laid, because it is measured on the finished video.

---

## 7. The icon toolbar

Nine tools written out is a wall of text that pushes the zoom controls off a
1024-pixel screen. Symbols fit. The words are **not** thrown away: every button
carries a name a screen reader reads and a tooltip a mouse user sees, and when it
cannot be used, both become the reason why.

**Split is still called Split.** It was briefly renamed to "Cut where the
playhead is" while this was written, and that would have been wrong twice over:
the rest of the app says Split, and "Cut" already means taking something to the
clipboard. Two meanings for one word on one toolbar is exactly the drift
`CLAUDE.md` warns about.

**Magnet and Snap are two switches**, because they are two things: Magnet is
about what happens to the OTHER clips when something lands; Snap is about where
the pointer lands. A user can want either without the other.

**Speed is shown, disabled, and says it is not built yet.** Hiding it would make
the toolbar change shape between versions. What would be *wrong* is a Speed
button that does nothing when pressed — this cannot be pressed, and it says why.

**Transition became real.** Its domain operation, preview support and export
support all already existed with no way for a user to reach it; the inventory
recorded that as the most misleading kind of "partial". It now adds a
half-second dip-to-black between the picked clip and the next one, and says
plainly when there is no clip after this one to fade into.

---

## 8. Rows, and keys

Row heights and folds are a **browser setting**, exactly like the padlocks: no
revision, no Undo entry, no change to the exported file. There is a fourth reason
beyond the three that apply to padlocks — a row height is about the SCREEN, and
two people opening the same project do not have the same screen.

A folded row keeps a thin strip. A row that vanished could not be found again to
unfold it.

Shortcuts belong to the **person**, not to the video, so they are stored per
browser and not per project. Four presets ship: Sanverse, and one each close to
CapCut, Premiere Pro and DaVinci Resolve.

They are called **"Close to"** deliberately. Sanverse does not have a keyframe
graph or a colour page, so each preset maps the commands Sanverse actually has to
the keys that editor uses for the same job. Where an editor uses a key for
something Sanverse cannot do, the key does nothing rather than being given to
something else — a key that does the wrong thing is worse than a key that does
nothing. Claiming "the Premiere keymap" would be a promise this cannot keep.

A clash is **reported, not prevented**: halfway through swapping two keys there
genuinely is a clash, and being refused mid-swap would make the swap impossible.
Changing any key turns the preset into "My own", so the screen never says "Close
to Premiere Pro" while no longer being close to it.

---

## What was proved in the running app

On the owner's own project, `project_1ad7b832a52d6faf09da2390e97f729a`.

| # | what was driven | what came back |
|---|---|---|
| 1 | Open Studio | timeline at revision 24, 10 icon buttons, Select tool active |
| 2 | Panel layout | five rows unchanged: V2, V1, C1, A1, A2 |
| 3 | Press the Marker button | revision **24 → 25**, flag drawn at 00:22 |
| 4 | Press Export | job `job_181f0e16…`, `succeeded` |
| 5 | Press Marker again while exporting | **refused** — correct: edits pause during an export |
| 6 | Wait, press Marker again | revision **25 → 26**, two flags |
| 7 | **Press Export again** | **the SAME job, `succeeded`, instantly** |
| 8 | Click one clip | "2 things picked" — the clip and its own sound |
| 9 | Ctrl-click a second clip | "4 things picked" |
| 10 | More → Group | revision **26 → 27** |
| 11 | Escape, then click ONE group member | "4 things picked" — the group is live |
| 12 | More menu states | Paste off (nothing copied), Ungroup **on**, Close gap off, Speed off |
| 13 | Copy a piece of the main video | refused in plain words, **no revision** |
| 14 | Copy the music | "Copied. Move the playhead and press Paste.", **no revision** |
| 15 | Paste onto the music | "There is already something there. Move the playhead, or use Paste and push along." **no revision** |
| 16 | Fold a row away | `data-track-collapsed="yes"`, **no revision**, stored in the browser |
| 17 | Undo, Undo, Redo | group removed → second note removed → second note back |
| 18 | Reload the page | revision 30, both notes back, V2 still folded, toolbar still icons |
| 19 | Drag a box on the video row | box drawn, "3 things inside the box", then "3 things picked", **no revision** |
| 20 | 1440×900 / 1280×800 / 1024×768 / 390×844 | no sideways page scroll; 10 icon buttons; 32px targets; five rows in order at every size |

**Step 7 is the one that matters most.** A real, undoable edit moved the revision
and the finished export was kept. Under the old rule the user would have waited
for a byte-identical file to be built again.

### Console

No errors from any of this work. Three appeared and all three are accounted for:

- one CORS error from a probe **this session typed**, not from the app;
- one `setPointerCapture` error from a **synthetic** click in the same probe —
  a real pointer never produces it, and it is now guarded anyway, because a
  throw where the user sees nothing is worth one `try`;
- two pre-existing View-Transition warnings, unchanged since Gate T0 and still
  unrelated.

## Steps NOT driven by hand

Said plainly rather than glossed over, to the standard of `CLAUDE.md` rule 3.

1. **Clicks and drags were dispatched as events, not by a physical mouse.** They
   went through the app's real handlers and produced real change sets — the
   revisions above are real — but nobody moved a mouse.
2. **The keyboard presets were not switched in the running app.** They are
   covered by 25 tests, including that no shipped preset contains a clash.
3. **Multi-item MOVE was not committed on the owner's project.** Their V1 clips
   are correctly refused by the multi-planner (pieces of the main video are moved
   one at a time), and their project has no two B-roll clips to drag together.
   The behaviour is covered by 17 tests against real domain operations.
4. **A group was not proved to survive a reload**, only markers were. Both are
   stored the same way, through the same kind of operation.
5. **Marker drag-to-move was not driven**, only marker creation, listing,
   searching and deletion. The drag is one gesture on release, like every other.
