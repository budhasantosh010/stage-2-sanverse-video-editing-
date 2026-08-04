# Gate C1 — Creator Timeline Core V2

P1-F.1A Gate C1, complete. Written 2026-08-04.

C1.1 and C1.2 were delivered earlier and are described in
`placement-planner.md`. This document covers **C1.3 to C1.22**.

---

## What a person can now do that they could not before

```
   drag B-roll onto the timeline           ← was already possible (C1.2)
   drag it somewhere else                  ← NEW
   pull either end to make it shorter      ← NEW
   cut it in half at the playhead          ← NEW
   delete it                               ← NEW  (nothing could be deleted)
   drop a second piece of music            ← NEW  (used to replace the first)
   trim music                              ← NEW  (music had no length at all)
   padlock a track                         ← NEW
   keep a track out of the finished video  ← NEW
   Insert, pushing the rest along          ← NEW  (used to refuse)
   Overwrite, cutting back what it lands on← NEW  (used to refuse)
```

---

## The three things that had to be built first

The timeline could not do any of the above, and the reason was not the screen.
Three capabilities simply did not exist anywhere in the system.

```
   1  NOTHING COULD BE DELETED
      There was no operation for taking a title, a callout, a piece of B-roll
      or a music bed off the video. Only cuts to the main footage could be
      undone by removing them.
      → added  remove-overlay

   2  NO TRACK COULD BE KEPT OUT OF THE VIDEO
      → added  set-track-output

   3  MUSIC HAD NO LENGTH
      A music bed was "start here and play until something runs out". With no
      length there is no such thing as trimming it, no such thing as two beds
      side by side, and nothing for Insert or Overwrite to move or cut back.
      → added  durationTicks to music
```

### One operation for all four kinds of removal

`remove-overlay { overlayId }`. One operation, not four, because the four kinds
of identifier are already distinct — `title_`, `callout_`, `broll_`, `music_` —
so the target is never ambiguous, and a person pressing Delete on a rectangle
does not think about which family it belonged to. Four near-identical operations
would have been four places for the same rule to drift apart.

A removal is not a hiding. Hiding is the track-output switch, because *"I do not
want this here"* and *"do not show this lane while I work"* are different
intentions and each needs its own Undo.

**A later repair cannot bring a deleted thing back.** A `set-title` naming
something that is gone finds nothing to repair and is ignored. Only Undo
restores it — which is the only rule a person can predict.

### Music with a length, without breaking a single saved project

`durationTicks` is a **known key that may be omitted**. The contract stays
closed — an unknown key is still refused — but a project saved before music
could have a length simply has no `durationTicks`, and that reads back as
`null`, meaning *"play until the video ends or the song ends, whichever comes
first"*.

That is not a missing value dressed up as a default. An unbounded bed under the
whole piece is what most people mean by adding music, and it is exactly how
every existing project already behaved. **No migration. No file rewritten. Not
one project sounds different.**

A length that IS set is a third limit alongside the other two, never an override
of them: asking for thirty seconds of a song with two seconds left gets two
seconds, not thirty seconds padded with silence.

---

## Lock and output: two switches, and why they can never be one

Written up in full as `DOCS/decisions/ADR-TRACK-LOCK-AND-OUTPUT-V1.md`.

```
   PADLOCK  🔒                     EYE / SPEAKER  👁 🔊
   ─────────────────────────       ────────────────────────────
   "stop me changing this by       "keep this out of the
    accident"                       finished video"

   changes NOTHING exported        CHANGES the exported file
   no revision, no Undo            one revision, one Undo
   lives in the browser            lives in the project
```

If they were one control, a person could not protect a track without also
removing it from their video.

**Proved on the real project** (numbers from the browser session below):

```
   lock A2      revision  19 → 19     nothing happened to the video
   unlock A2    revision  19 → 19     nothing happened to the video
   mute A2      revision  19 → 20     an edit, with an Undo
   hide V1      revision  20 → 21     an edit, with an Undo
```

The padlock also has to be a padlock. With A2 locked, Delete on the music was
disabled and said so:

> Delete — A2 is locked. Unlock it to change anything on it.

### Why the render plan version moved v6 → v7

Each piece of footage now says whether its picture is drawn and its sound heard.
The version had to move because **the export key is built from it**:
`sha256(projectId : revision : renderPlanSchemaVersion)`. Without the bump,
somebody who muted the dialogue and pressed Export would be handed the cached
file from before the mute, with no way to tell.

---

## Insert and Overwrite, doing the real thing

They used to refuse. They now rearrange what is already there, and the
rearrangement goes in **the same change set** as the new item — so an Insert
that pushes four clips along is still one Undo, and can never leave three moved
and one behind.

```
   INSERT      everything at or after the drop point moves later by the
               new item's length

   OVERWRITE   covered end to end  →  removed
               covered on one side →  trimmed back
               covered in the middle → becomes two, and the far half resumes
                                       where the covered part left off
```

Two refusals remain, and both are deliberate:

- **Insert into the middle of a clip** refuses. Pushing that clip along whole
  would move its first half too, which is not what "insert here" means.
- **Ripple delete on V2** refuses, and says what to do instead:

  > B-roll is pinned to a moment of your footage, so closing the gap would move
  > the later clips onto different footage. Use Delete instead.

  This is not a missing feature. B-roll is anchored to a moment of the ORIGINAL
  RECORDING (ADR-005) — that is what keeps it on the thing it was about when you
  cut elsewhere. Closing a gap after it would have to re-pin everything later to
  *earlier footage*, moving those clips onto different moments. Ripple delete on
  music, which is measured on the finished video, is exact and does work.

---

## The one thing that makes moving B-roll harder than it looks

A piece of B-roll is not stored as *"starts at 12 seconds of the finished
video"*. It is stored as *"sits on the moment of the recording where I held up
the product"*.

So moving it one second later is not "add one second":

```
   finished-video time  ──►  which piece of footage is showing there
                        ──►  which moment of the ORIGINAL RECORDING that is
                        ──►  store THAT
```

Music is the exception and really is "add one second", because it belongs to the
finished piece rather than to a filmed moment (ADR-007). The two never share
arithmetic in the code, because a shared `move` that branched on kind is exactly
where the two would drift apart.

**Trimming the head also moves the source start**, for both families, so the
frame or the beat that was under a moment stays under it instead of restarting.

---

## One gesture, one change set, one Undo

A drag fires a few hundred pointer events. If each were an edit, the project
would take a few hundred revisions and Undo would step back one pixel at a time.

```
   pointer down    a session begins; nothing is edited
   pointer moves   the ghost moves; nothing is edited
   Escape          the session ends; nothing was ever done, so nothing to undo
   pointer up      exactly one change set, or exactly one refusal
```

**Measured in the browser during a real drag of twelve pointer moves:**

```
   revision before drag    16
   revision during drag    16      ← not one edit while the hand was moving
   ghost drawn             yes
   revision after release  16      ← the release REFUSED, truthfully
   message                 "There is already something on this track at
                            that moment."
```

Then the same drag into free space:

```
   before   starts at 750px  (7.5 s)   width 1126px
   after    starts at 1000px (10.0 s)  width 1126px     revision 17 → 18
```

Exactly the 250 pixels the pointer travelled, and the length unchanged.

---

## The keyboard, and the one key that changed meaning

```
   Ctrl/Cmd+B      Split          ← was plain S
   Delete          Delete
   Shift+Delete    Ripple delete
   S               Snapping on/off ← S used to mean Split
   V               Select tool
   Home / End      start / end of the video
   ← / →           playhead, one frame
   Alt + ← / →     nudge the selected item, one frame
   + / −           zoom
   Escape          cancel the gesture · close the menu · deselect
```

**S had two possible meanings and now has one.** Split moved to `Ctrl/Cmd+B`,
which is what every other editor uses for a cut, so the surprise is smaller that
way round. Two meanings for one key makes a person distrust their own hands.

Nothing fires while typing. The check names every kind of field the app has —
including ones marked by the components that own them — not only the three
obvious HTML tags, because typing "s" into a caption must write a letter and not
cut the video.

### Delete no longer opens a confirmation

It used to move focus to a confirmation button. That existed because *"remove"*
and *"remove and close the gap"* were one control with two outcomes. They are now
two keys and two buttons, so there is nothing left to disambiguate — and every
delete is one Undo away from being back.

---

## Nothing on screen is inert

Every toolbar control does something. Every disabled control says why, in words,
in its tooltip AND in its screen-reader label — so the reason is there for
somebody using a keyboard or a screen reader, not only for somebody hovering a
mouse.

```
   Split          "Choose something on the timeline first."
                  "Move the playhead inside the selected item first."
                  "V1 is locked. Unlock it to change anything on it."

   Ripple delete  "B-roll is pinned to a moment of your footage, so closing
                   the gap would move later clips. Use Delete."
```

The chosen placement mode is shown by weight and a filled background as well as
colour, so somebody who cannot tell two shades apart can still see which mode a
drop will use.

## The Timeline no longer looks like a progress report

```
   BEFORE                            AFTER
   ─────────────────────────         ─────────────────────
   05                                TIMELINE   (one quiet line)
   Production timeline               ┌─────────────────────┐
   One project · one playhead ·      │ compact toolbar     │
   server-authoritative edits        ├─────────────────────┤
   ┌─────────────────────┐           │ ruler               │
   │ Timeline  0:30 total│           ├──────┬──────────────┤
   ...                               │ V2 🔒👁│ clips       │
                                     │ V1 🔒👁│             │
                                     │ C1 🔒👁│             │
                                     │ A1 🔒🔊│             │
                                     │ A2 🔒🔊│             │
                                     └──────┴──────────────┘
```

The numbered heading and the slogan took roughly 60 pixels of height away from
the thing the person came here to use. The label is still announced to a screen
reader; it just no longer competes with the toolbar under it.

---

## Real-browser proof

Real project, real media, running server, 2026-08-04. The owner's own project:
30.03 s of footage, a 60 s B-roll video, a 6 s piece of music, two pictures.

### Every lane's answer while dragging a video

```
   lane:overlay   accepts
   lane:video     refuses          ← the V1 refusal is still truthful
   lane:caption   refuses
   lane:dialogue  refuses
   lane:music     refuses
```

### Drop, split, delete, undo

```
   drop B-roll on V2      revision 12 → 13   one item, 7.5 s to 30.0 s
   Split at the playhead  revision 13 → 14   two items:
                                             750px + 1126px wide
                                             1876px + 1127px wide
                                             1126 + 1127 = 2253 = the original
   Delete the right half  revision 14 → 15   one item left
   Undo                   revision 15 → 16   both items back, byte for byte
```

Undo itself takes a revision — that is by design, since undoing IS a change to
the project.

### The two switches

```
   lock A2       19 → 19    padlock is not an edit
   unlock A2     19 → 19    padlock is not an edit
   mute A2       19 → 20    an edit
   hide V1       20 → 21    an edit
   music still on the timeline while muted: yes  (hiding is not deleting)
```

### The exported file actually changed

Three real exports through FFmpeg, each probed.

**Picture, with V1 hidden and V2 still on** (brightness of the picture, where
16 is pure black in video range):

```
   t = 5 s     16.0     black — the footage is hidden
   t = 12 s    32.3     brighter — the B-roll is still drawn on top
   t = 25 s    16.0     black again — the B-roll has ended
```

**Sound, with the dialogue muted and the music on** — one file, two windows:

```
   3 s to 9 s    (music playing)   −43.9 dB
   20 s to 26 s  (no music)        −91.0 dB     digital silence
```

47 dB apart. The dialogue is genuinely **gone**, not turned down — a very low
volume is still audible on headphones, and a person who muted a track and then
heard it faintly would be right to say the product lied.

**Length unchanged in every case: 30.033 s.** A switched-off piece keeps its
place and its length, which is what makes switching it back on restore the same
video rather than a differently-timed one.

### Responsive

```
   1024 × 768   no horizontal overflow · 5 lanes · 8 toolbar buttons · playhead
   390 × 844    no horizontal overflow · 5 lanes · 8 toolbar buttons · headers
```

No lane disappears silently at any size.

### Console, and the one-video rule

No console errors at any point. **Exactly one `<video>` element** on the page
throughout, at every viewport size and after every edit.

### The owner's project was left as it was found

0 items on the timeline, all five tracks on. The revision counter is higher,
because Undo is itself a revision.

---

## Numbers

```
   tests    1,389 → 1,510      (+121)

            edit-domain           361
            api                   261
            render-contract        80
            intent-domain          27
            web                   781

   all-workspace npm run build    exit 0
```

No assertion weakened. Nothing skipped. Four existing tests were **rewritten to
assert the new truth** rather than deleted:

```
   before   plain S splits the clip
   after    plain S toggles snapping, Ctrl+B splits
            + a new test proving S never splits

   before   Delete moves focus to a confirmation button
   after    Delete deletes, Shift+Delete closes the gap

   before   a second piece of music REPLACES the first
   after    a second piece of music is refused when it would overlap
            (the old behaviour silently destroyed the first bed)
```

## Two honest limits on the proof above

- Drops were driven by dispatched `DragEvent`s and drags by dispatched
  `PointerEvent`s, not by a physical mouse. The payloads, the planner, the API
  round trip, the resulting project and the exported files are all real; the
  hand was not.
- No screenshots. This browser pane does not composite frames, so everything
  above is read from the live DOM, the API, and `ffprobe` on the real exported
  files — rather than seen.
