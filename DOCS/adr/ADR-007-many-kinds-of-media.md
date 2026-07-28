# ADR-007 — Many kinds of media, four new overlays, and marks that are not edits

- Status: Accepted
- Date: 2026-07-28
- Goal: G5-C (useful talking-head workflow)
- Builds on: ADR-005 (edits anchored to the footage), ADR-006 (captions)

## The five decisions

## 1. One asset type with a stated kind — not three separate types

A project used to hold exactly one video. It now holds several videos, pictures
dropped in as B-roll, and music. Those three things genuinely differ:

```
  kind    has a length   has a size   what it is for
  ─────   ────────────   ──────────   ────────────────────────────────────
  video   yes            yes          the footage the video is made of,
                                      and B-roll laid over it
  image   NO             yes          a picture laid over the footage
  audio   yes            NO           music laid under everything
```

A still picture has no length of its own — it is one frame that could be held
for a second or an hour. The alternatives were:

- **Invent a duration for images.** Rejected: some later reader would trust it.
- **Make duration optional.** Rejected: a missing field cannot be told apart
  from "not written yet".
- **`duration: null`, with the kind saying when that is legal.** Chosen. Every
  field is present on every kind, and the validator enforces which ones must be
  null, from a table rather than from branches.

A composition is what the finished video is MADE OF, so a clip on the timeline
must name a video. A picture or a piece of music there is refused with
`ASSET_NOT_VIDEO` rather than accepted and later ignored.

## 2. Bringing media in is NOT an edit

```
  UPLOADING A CLIP                    USING IT
  ────────────────────────────        ─────────────────────────────
  nothing on screen changes           the picture changes
  no change set                       one change set
  no entry in the undo history        one entry, one Undo
  putting it on the shelf             taking it off the shelf
```

`addAsset` therefore creates no change set. It still moves the revision forward,
because the revision means "the project state" and one rule with no exceptions
is safer to reason about than a rule with one. The cost is that an AI answer
computed a moment before an upload has to be recomputed.

## 3. Marks the user draws are intent, never edits

Circling a microphone and typing "remove that noise" must not put a circle in
the finished video. This is enforced structurally, not by discipline:

```
  an EDIT                              an ANNOTATION
  ─────────────────────────────        ─────────────────────────────
  names a capabilityId                 has no capabilityId at all
  is an EditOperation                  is not, and its kind is absent
                                       from EXECUTABLE_OPERATION_KINDS
  goes into a change set               travels with a request
  appears in the undo history          never appears there
  is compiled into a render node       is never seen by the compiler
  changes the exported file            cannot change the exported file
```

There is no code path that skips annotations during rendering, because there is
nothing to skip: the renderer has never heard of them. Submitting one as an edit
is refused with `OPERATION_KIND_UNKNOWN`.

Marks are stored as fractions of the PICTURE, with the black bars subtracted
first — never as fractions of the video element on the page. The bars belong to
the element, not to the picture, so an element-relative number walks sideways the
moment the window is resized and lands somewhere else again in fullscreen. The
proof runs the same three spots through nine different display shapes.

## 4. Music is anchored to the finished video. Everything else is anchored to the footage.

This is the one place this family disagrees with ADR-005, and the reason matters:

```
  ANCHORED TO FOOTAGE                  ANCHORED TO THE FINISHED VIDEO
  (nameplate, caption, title,          (music only)
   callout, B-roll)
  ───────────────────────────          ───────────────────────────────
  "the bit where I hold up             "a bed under the whole thing"
   the product"
  cut that bit out → it goes           cut a bit out → the music plays
  with it, or is reported blocked      straight through the join
```

If music were anchored to footage, cutting ten seconds out of the middle would
cut ten seconds out of the song, and the listener would hear an obvious jump.
Music is not attached to a filmed moment; it is attached to the finished piece.

Consequences that fall out of this, all tested:

- A cut can never block music. There is no moment of footage for it to lose.
- Music plays for as long as there is both video left to cover and song left to
  play. It is **not looped** — a loop point nobody chose is audible.
- Fades are shortened to fit rather than allowed to overrun a short bed.

## 5. B-roll fits inside its box, and resumes after a cut

The overlay is scaled to FIT inside its region and centred, never stretched to
fill it. FFmpeg says `force_original_aspect_ratio=decrease`; CSS says
`object-fit: contain`; both mean the same thing, and a test states it in one
place so neither can drift.

When a cut passes through a piece of B-roll it produces two on-screen
appearances, and the second **resumes where the first left off** rather than
restarting. A still picture always starts at zero, because a picture has nowhere
to seek to.

A B-roll clip shorter than the stretch asked for is refused
(`OVERLAY_SPAN_OUTSIDE_ASSET`) rather than padded with a frozen frame nobody
approved. That rule does not apply to a picture, which can be held for any time.

## What the exporter had to grow

- **Several input files.** The plan now carries a `sources` list naming every
  file to open, and `planInputs` decides the numbering in one place — a graph
  that disagreed with the command line by one would silently composite the
  wrong clip.
- **Two video layers.** B-roll is composited first, then everything written on
  the picture, so a clip dropped over a caption can never hide it.
- **A looping still is bounded** with `-loop 1 -t <last instant it is needed>`,
  because an unbounded looping input never finishes on its own.
- **Audio is mixed with `normalize=0`**, which stops FFmpeg quietly halving the
  speech to make room for the music, and `duration=first`, which stops a long
  song stretching the file.
- **Silent footage still gets a real sound track** when music is added, because
  a file with no audio stream at all behaves differently in every player.

## The cost, stated

- **No upload route for the new kinds yet.** `addAsset` exists and is tested;
  nothing in the browser can call it, because staging, hashing, and probing a
  picture or an audio file is its own piece of work.
- **No control on screen** for creating a title, a callout, B-roll, or music.
  All four are built, tested, and reach the export; none has a button.
- **A second video cannot be appended to the timeline.** Multi-asset intake is
  the shelf; there is no `append-clip` operation yet, so the composition still
  only ever holds clips from the original footage.
- **Not proved on real media.** Everything here is proved at the plan and the
  filter-graph level. No real B-roll clip, picture, or music file has been
  through a real export. By Rule #3 that means it is not yet known to work.
- **One caption style layer** still applies, and one title style layer with it.

## Revisit trigger

- A user wants a second video joined onto the end of the first: that needs an
  `append-clip` timeline operation, not an overlay.
- Music should duck under speech automatically: that needs sidechain compression
  and a decision about how much, which is a product question, not a technical one.
- Two B-roll clips must overlap each other on screen.
