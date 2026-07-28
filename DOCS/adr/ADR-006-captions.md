# ADR-006 — Captions: where the words live, and what happens when the footage is cut

- Status: Accepted
- Date: 2026-07-28
- Goal: G5-A (captions and speech metadata)
- Builds on: ADR-005 (edits are anchored to the footage)

## The four questions

Captions look simple and are not. Four decisions had to be made before a line of
useful code could be written, and each one has a wrong answer that fails
silently rather than loudly.

## 1. Where does the transcript live? — NOT in the project

A transcript is EVIDENCE ABOUT footage. A caption is a DECISION the user made.
They are different things and they are stored differently.

```
  transcript (a sidecar file, per asset)      captions (inside the project)
  ─────────────────────────────────────       ────────────────────────────
  what the microphone picked up               what the user chose to show
  never edited                                edited, undoable
  never in the undo history                   one Undo per change
  read once, at caption-building time         read on every render
```

Putting the transcript in the project was rejected for two reasons that both
bite:

- **Size.** A ten-minute talk is roughly 1,500 words. The project file is
  rewritten on every change, so the transcript would add ~60 kB of rewriting to
  every single click, for data that never changes.
- **Meaning.** Undoing an edit must not undo the knowledge of what was said.

## 2. One operation or many? — ONE, with N cues, edited by a fold

"Put captions on my video" is one thought, so it is one entry in history and one
Undo. 150 separate change sets would make the history unusable.

Correcting one line later is a small separate operation naming the set:

```
  add-captions        captionSetId, assetId, styleId, [150 cues]   ← one Undo
      │
      ├─ set-caption-cue      replace one cue outright (text AND timing)
      ├─ remove-caption-cue   delete one cue
      └─ set-caption-style    change the look of the whole set

  foldCaptionOperations() replays these in history order.
```

Replaying rather than rewriting the original operation is what keeps one user
action equal to exactly one Undo, and lets a change in the middle of the history
be switched off on its own.

`set-caption-cue` carries the whole cue, never a patch. A partial update would
mean two callers could disagree about what "unchanged" means.

## 3. What happens when a cut deletes a caption's footage?

**This is where captions deliberately differ from a nameplate**, and the
difference matters enough to state as a rule:

```
  NAMEPLATE                              CAPTION SET
  one statement about one moment         hundreds of statements
  ─────────────────────────────          ─────────────────────────────
  its moment is deleted                  three of 150 cues lose their footage
        ↓                                      ↓
  the whole thing is BLOCKED             those three simply do not draw
  "needs attention" in history           the other 147 are untouched
                                         nothing is reported

                                         ALL 150 lose their footage
                                               ↓
                                         NOW the set is blocked
                                         (`ALL_CUES_REMOVED`)
```

Why: blocking 150 captions because 3 lost their footage would leave the user
with a silent, caption-free video and a warning they cannot act on. "Your
captions are not showing" is only honest — and only actionable — when nothing
survives at all.

Every surviving cue is placed by `placeSourceSpan`, the same single translator
every other anchored thing uses. A cut through the middle of a cue produces two
on-screen appearances that touch exactly, so it reads as unbroken.

## 4. How is text drawn at export? — drawtext, from a filter-graph FILE

Captions are drawn with the same `drawtext` mechanism nameplates use, so the
preview-versus-export parity story is unchanged: one shared style contract, CSS
on one side, FFmpeg on the other, and the numbers come from the contract.

The alternative — writing a subtitle file and using FFmpeg's `subtitles` filter
— was rejected because libass renders differently from CSS, which would break
the parity the whole product's safety story rests on.

But drawtext forced a second change:

```
  200 cues × 2 lines = ~400 drawtext filters × ~250 characters
                     = ~100,000 characters of filter graph

  Windows caps an entire command line at 32,767 characters.
```

So the graph is written to a file and passed with `-filter_complex_script`.
Used for EVERY export, not only large ones, so there is one code path and no
size at which behaviour silently changes.

`MAX_RENDER_NODES` rose from 512 to 4,096 for the same reason.

## Where the line breaks are decided — once, deterministically, in the domain

`segmentTranscript` is pure arithmetic. No AI, no randomness, no network. The
same transcript always produces byte-identical cues, because a re-render that
differed from what the user approved would break the approval.

```
  at most 2 lines          three lines cover too much of the picture
  at most 42 characters    per line
  at least 1.0 seconds     shorter and the eye cannot land on it
  at most 6.0 seconds      longer and the reader is waiting
  at most 17 chars/second  sustainable adult reading speed
  break on . ! ?           a finished sentence is the best break
  break on a 0.7s pause    a real pause is a real place to break
  one line beats two       whenever the words fit on one
```

`repairCueTimings` then fixes what segmentation could not see, because it does
not know about neighbours: overlap, flicker (no visible gap), and cues squeezed
below a readable floor. **Every change it makes is reported**, never silent.

## The cost, stated

- **Transcript format is an assumption.** `sidecar-import.ts` implements the
  published Whisper/WhisperX word-timing shape. It has NOT been verified against
  a real Stage 1 file, because none exists in this repository. If Stage 1 emits
  something else, that one file changes and nothing downstream knows.
- **Automatic transcription is a boundary, not a feature.** The port and its
  rules exist; the only adapter that ships refuses. Captions today require a
  transcript file the user already has.
- **One caption style layer.** Two caption sets with different looks would need
  one CSS variable layer each. That arrives with multi-asset projects (G5-C).
- **The transcript upload is capped at 1 MB** by the shared JSON body limit,
  which is roughly a 20-minute transcript with word timings.

## Revisit trigger

- A real Stage 1 transcript file disagrees with the assumed shape.
- Karaoke-style word-by-word highlighting is wanted; that needs word timings at
  render time, which the current cue does not carry.
- Two caption sets must be on screen at once.
