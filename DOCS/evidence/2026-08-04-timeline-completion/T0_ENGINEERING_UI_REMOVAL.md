# T0.8 / T0.9 — Taking our own words off the user's screen

2026-08-05 · Gate T0

The product standard is *complexity hidden under the hood, effortless on the
surface; the user never needs editing knowledge*. Several things on the Timeline
broke that by showing the user our vocabulary, our build-stage names, and our
internal reason codes.

## 1. The roadmap notice — removed entirely

Once per visual adjustment, the Timeline said:

```
Visual-property keyframes and effects do not have a P1-A timeline lane.
```

Every word of that is about **our** unfinished work.

- "P1-A" is the name of a build stage. It means nothing to anybody else.
- "Visual-property keyframes" is not what anybody calls moving a title.
- Nothing was actually wrong: the adjustment worked, the preview showed it, and
  the export included it. The only thing missing was a row on the timeline to
  draw it in.

Repeating it taught the user that their project was full of problems, so real
problems stopped standing out.

**Nothing became unreachable.** The adjustment is still visible in the preview,
still listed in history, and still in the exported file. The test that asserted
this notice appeared now asserts it does not.

## 2. Blocked edits — plain words instead of codes

Before:

```
set-visual-properties is blocked: VISUAL_TARGET_UNKNOWN.
add-media-overlay is blocked: SOURCE_SPAN_REMOVED.
```

Our internal name for the edit, and our internal name for the reason. Neither
means anything to the person reading it and neither says what to do.

After, live in the real browser on the owner's project:

```
Showed another clip for 5.0s — the part of the video it was on has been cut
out, so it is not shown.

Changed its position or appearance — the thing it was changing is no longer
here, so it is not shown.
```

The first half is `describeOperation`, which is the **same sentence the history
list already shows** for that edit, so the two cannot disagree. The second half
maps the reason:

| reason | what the user reads |
|---|---|
| `SOURCE_SPAN_REMOVED` | the part of the video it was on has been cut out, so it is not shown. |
| `VISUAL_TARGET_UNKNOWN` | the thing it was changing is no longer here, so it is not shown. |
| `FOOTAGE_MOTION_OVERLAP` | a later change to the same stretch replaced it, so it is not shown. |
| anything else | it no longer fits the video, so it is not shown. |

Even the unknown case gets a true sentence rather than a code. A code on screen
is never the right answer, even when we are surprised.

## 3. "COMMITTED" on every clip — removed

Every ordinary clip carried the word COMMITTED, in capitals, on the clip itself.
In a video made of eight clips that is COMMITTED eight times, saying nothing: of
course it is in the video, it is on the timeline.

It is also **our** word. "Committed" is what an engineer calls an edit that has
been recorded; a non-editor reading it has no idea whether it is good news.

The three states that ARE worth a word — Proposed, Needs attention, Hidden — keep
their label, and now stand out because they are the only ones wearing one.

A screen reader still hears a state for every clip, because it cannot see that
the clip is sitting on the timeline. It hears **"in your video"**, never
"committed".

## 4. Vocabulary drift, caught and reverted

While doing this the timeline chip was briefly renamed from "Proposed" to
"Suggested". That was reverted.

The rest of the app says "proposal" everywhere. Introducing a second word for
the same thing is precisely the drift `CLAUDE.md` warns about — *never swap
synonyms, that itself causes drift* — and it would have made the timeline and
the assistant panel appear to be talking about different objects. One
vocabulary, everywhere, including in the new draft-recovery messages.

## 5. T0.9 — bounded visual polish

**No panel moved. The Studio layout, the panel arrangement and the five semantic
tracks (V2, V1, C1, A1, A2) are untouched.** Everything below is inside the
Timeline.

Colour is never the only signal in any of these. Roughly one man in twelve
cannot reliably separate red from green, and a timeline that says "this clip is
switched off" only by tinting it says nothing to them. So each state also
carries a pattern, an outline style, or a word.

| state | how it reads |
|---|---|
| switched-off clip | dashed outline + 55% opacity — faded, but still **readable**, because the user has to read it to decide to turn it back on |
| file missing | solid **double** outline — the only state that gets one, so it cannot be mistaken for a clip the user switched off themselves |
| selected | 2px ring + a lifted shadow, so selection survives a laptop screen in daylight; a 1px colour change does not |
| keyboard focus | its own outline, visible **on top of** selection, because a keyboard user who cannot see where they are has no way to recover |
| trim handles | a real 8px target — a handle you have to hunt for gets missed, and the miss drags the clip instead |
| ruler | major ticks full strength, minor ticks at 55%, so the eye can count without reading |

Long content scrolls inside the Timeline. The page itself never scrolls
sideways.

## 6. The development diagnostics panel (T0.1b)

Added, not removed — but it belongs in this document because the rule it obeys
is the same one.

Working out the original false gap meant reading the code backwards from the
message to the compiler, because nothing on screen said which of the twenty-odd
values feeding that decision was the wrong one. The panel is that list of values
in one place.

Four rules bind it:

1. **It never reaches a real user.** Built only when the app is running in
   development, and shut even then until it is opened.
2. **It changes nothing.** It reads; it never seeks, loads, or makes a revision.
   A diagnostic that moves the thing it is measuring is worse than none.
3. **No file paths and no real addresses.** An address is reduced to the last
   part of its path, so `.../assets/asset_bbbb` becomes `asset_bbbb`. That is
   enough to answer the only question worth asking — *is the element pointed at
   the file we asked for?* — without printing where anybody's files live.
   Diagnostic panels get screenshotted and pasted into chats. A test drives a
   real Windows path and a real home directory through it and asserts neither
   appears.
4. **It never copies the project into itself.** Doing that every frame would
   make the editor slow in exactly the situation somebody is trying to measure.

It also distinguishes **"we did not check"** from **"we checked and it was
off"**. If the whole track is off, the clip's own switch was never looked at, so
`clipEnabled` is `null`, not `false`. Reporting `false` would send the next
person to the wrong switch — the same mistake the gap wording itself was
designed to avoid.

## Proof

Read from the running app, on the owner's real project:

```
Showed another clip for 5.0s — the part of the video it was on has been cut out, so it is not shown.
Changed its position or appearance — the thing it was changing is no longer here, so it is not shown.
```

No `P1-A`. No `set-visual-properties`. No `VISUAL_TARGET_UNKNOWN`. No COMMITTED.
