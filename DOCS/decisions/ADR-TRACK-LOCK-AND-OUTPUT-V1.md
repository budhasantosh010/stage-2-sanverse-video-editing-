# ADR — Track lock and track output are two different things

**Status:** accepted · 2026-08-04 · P1-F.1A Gate C1.6 / C1.7

---

## The question

A timeline track has two switches on it. What are they, and where does each one
live?

## The answer in one picture

```
   PADLOCK  🔒                        EYE / SPEAKER  👁 🔊
   ─────────────────────────          ────────────────────────────
   "stop me changing this by          "keep this out of the
    accident"                          finished video"

   changes NOTHING about the          CHANGES the exported file
   exported file

   no operation                       one operation
   no revision                        one revision
   no Undo entry                      one Undo entry
   same export key                    new export key

   lives in the BROWSER,              lives in the PROJECT,
   per project                        travels with it
```

They are never merged into one control. If they were, a user could not protect
a track without also removing it from their video, and could not remove a track
from their video without also protecting it.

---

## Why the padlock must stay out of the project

Three things go wrong the moment a padlock becomes an accepted operation.

**1. Locking would look like an edit.**
The revision number is what tells the whole system "the video changed". A
padlock changes nothing you can see or hear, so if it moved the revision, every
part of the app that watches for real changes would react to something that is
not one.

**2. Undo would stop meaning what the user expects.**
Undo takes back the last thing that changed the video. If a padlock took a slot
in that list, then:

```
   user cuts ten seconds out           ← wants this back
   user locks a track                  ← does not think of this as an edit
   user presses Undo                   → unlocks the track
   user presses Undo again             → NOW the cut comes back
```

The user pressed Undo and their cut did not come back. From their side, Undo is
broken.

**3. It would throw away a finished export.**
An export is identified by `sha256(projectId : revision : renderPlanVersion)`.
Anything that cannot change the video must not be able to move that number,
because moving it means a file the user has already waited for is thrown away
and an identical one is built from scratch. On a ten-minute video that is
minutes of the user's time spent producing a file that is the same to the byte.

## Why the output switch must be in the project

The exact mirror image. Muting the music CHANGES the exported file, so it must:

- travel with the project, or opening it on another machine would export
  something different;
- take a revision, or the export cache would hand back the old file;
- take one Undo, because the user will want it back;
- be visible to the AI, so "take the music out" and clicking the speaker are the
  same edit rather than two.

---

## Where the padlock is stored

`localStorage`, under `sanverse.timeline-locks.<projectId>`.

```json
{ "schemaVersion": "sanverse.timeline-locks/v1", "lockedTrackIds": ["V2"] }
```

Per project, so padlocks on one video do not appear on another. Per browser,
because that is what the padlock is about: this person's mouse, on this machine.

Anything unreadable, unrecognised, or from a different schema version reads back
as **nothing is locked**, and an unknown track name inside a valid file is
dropped while the known ones are kept. The safe direction is unlocked: the worst
case is that the user puts a padlock back, rather than being unable to edit at
all. Storage that throws — private browsing, blocked cookies — is caught, and
losing padlocks never stops the editor opening.

There is no separate Undo for padlocks. The repository has no undo policy for
presentation settings, and inventing a second history here would create exactly
the two-histories problem this project has avoided everywhere else. Clicking the
padlock again is the undo.

## What a padlock actually stops

Everything that would change something **on that track**:

```
   media dropped on it        refused, and says which track is locked
   an item moved              refused
   an item trimmed            refused
   an item split              refused
   an item deleted            refused
   a ripple delete            refused
   a future AI edit aimed     refused by the same planner, because the rule
   at that track              lives in the planner and not in a mouse handler
```

It stops nothing else. A locked track is **fully visible**, still plays, and
still exports. A hidden or muted track is still **fully editable** unless it is
also locked. The two switches do not interact.

## The five track names

`V2 · V1 · C1 · A1 · A2`. Closed. An operation or a stored setting naming
anything else is refused, not ignored — ignoring it would mean exporting a video
the user did not approve while telling them the change was accepted.

## What the output switch does to the exported file

```
   V2 off   no B-roll, no pictures, no titles, no callouts, no nameplates
   V1 off   black where the picture was, for exactly as long as the picture
            lasted, so nothing after it moves
   C1 off   no captions
   A1 off   real silence where the voice was — not the voice turned down,
            because a very low volume is still audible on headphones
   A2 off   no music
```

A switched-off piece keeps its place and its length. That is what makes
switching it back on restore the same video frame for frame, instead of a
differently-timed one.

**The render plan version moved from v6 to v7** to carry the two new switches on
each piece of footage. That is deliberate: the export key is built from it, so
without the bump a user who muted the dialogue and pressed Export would be
handed the cached file from before the mute and would have no way to tell.

## Migration

None needed. Every project ever saved has no `set-track-output` in its history,
which reads back as all five tracks on — which is exactly how those projects
already behaved. No file is rewritten.
