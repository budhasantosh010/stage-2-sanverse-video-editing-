# ADR — HOW SPEED, SOUND AND TRANSITIONS ARE REPRESENTED (V1)

Status: **ACCEPTED**, 2026-08-06
Supersedes nothing. Amends the G4-A "no retiming" invariant in `composition.ts`.

---

## THE ONE-PARAGRAPH VERSION

A piece of footage now has TWO lengths instead of one: how much recording it
uses, and how long it takes to play. Only the first is stored. The second is
worked out from the first plus a speed, and that speed is a FRACTION of two
whole numbers, never a decimal. Everything else in this document follows from
those two sentences.

---

## 1. HOW A SPEED IS WRITTEN DOWN

**Decision:** a fraction of two whole numbers, always in lowest terms.

```
              source ticks consumed
   speed  =  ──────────────────────
             timeline ticks elapsed

   1x    { numerator: 1, denominator: 1 }
   2x    { numerator: 2, denominator: 1 }     bigger numerator = faster
   0.5x  { numerator: 1, denominator: 2 }
```

**The alternative that was rejected:** an ordinary decimal, `0.3333333333333333`.

**Why it was rejected, with the concrete harm:** a computer cannot hold one
third exactly. Multiply a one-hour recording by the slightly-wrong number and
the answer is out by a fraction of a tick. Then:

- the preview and the exporter each round that fraction, possibly the opposite
  way, so the video you watched is not the video you got;
- the export fingerprint is built from these numbers, so an untouched project
  can hash differently on two machines and re-export for nothing;
- a clip that should end exactly where the next begins ends one tick early, and
  the user sees a one-frame black flash they cannot remove.

**What is given up:** a decimal a user types must be turned into a fraction, and
for a decimal with no small fraction the answer is very close rather than exact.
The terms are capped at 10,000 and the worst error that leaves is under one part
in a million — under four milliseconds on a one-hour clip. The error is reported
so it can be shown, never hidden.

**Range:** 0.1x to 16x. Both ends are honestly reachable: a browser's video
element accepts 0.0625 to 16, and FFmpeg's sound-speed filter reaches any of it
through a chain. Going wider would ship a control that silently fails at its
extremes.

---

## 2. WHERE THE SPEED IS STORED

**Decision:** an OPTIONAL field `timeTransform` on the `Clip`, holding the
speed, the direction, and whether a sped-up voice keeps its pitch. Absent means
normal speed, forwards, pitch kept.

**The alternative that was rejected:** a required field plus a migration that
rewrites every saved project.

**Why:** a migration that touches the user's stored edits in order to add a
setting they have not used is a bad trade. The same reasoning already governs
`framing` on the render plan. A project saved before speed existed opens and
produces the identical video, with no rewrite. Proved by test.

**Present but wrong is still a refusal.** A speed somebody hand-edited into a
file badly is refused, never quietly repaired — a repaired value would mean the
saved file and the screen disagree.

---

## 3. HOW LONG A PIECE IS ON SCREEN

**Decision:** derived, never stored. One function,
`clipCompositionDurationTicks(clip)`.

**Why not store it:** two fields that must agree eventually disagree. One field
and a rule cannot.

---

## 4. ROUNDING — THE MOST IMPORTANT DECISION IN THIS DOCUMENT

Ticks are whole numbers. Ten ticks at 3x is 3.333…, which is not one.

**Decision:** round each piece's two EDGES, measured from the beginning of the
recording, and subtract:

```
   length on screen = round(where the piece ENDS)  −  round(where it STARTS)
```

**The alternative that was rejected:** round the LENGTH.

**Why, with real numbers.** A 10-tick clip at 3x, cut after 5 ticks:

```
   rounding the LENGTH                    rounding the EDGES
   whole  round(10/3) = 3                 whole            = 3
   left   round( 5/3) = 2                 left   2 − 0     = 2
   right  round( 5/3) = 2                 right  3 − 2     = 1
                        ─                                    ─
                        4  ← GREW         3  ← correct
```

Rounding the length makes a clip grow by a tick just from being cut. That tick
runs into whatever is next, the composition validator refuses the whole edit as
an overlap, and split enough times a project stops opening.

**What is given up:** the same amount of recording can occupy one tick more or
less depending on WHERE in the file it was taken from. One tick is one
1,440,000th of a second — about 700 nanoseconds, one twenty-thousandth of a
single frame at 60 fps. Nobody can perceive it and it never accumulates.

**Half-up, not round-to-even**, because half-up is the rule a twelve-year-old
already knows, so a number printed on screen is never surprising.

**Zero-length pieces are REFUSED, not inflated.** One tick of recording at 16x
rounds to nothing. Rounding it up to stay visible was tried and it breaks the
additivity above. So the truthful zero is returned and the refusal lives where
the user can read it: the split is refused, and the composition validator will
not accept such a clip (`CLIP_TOO_SHORT_TO_SEE`).

---

## 5. WHAT HAPPENS TO EVERYTHING AFTER A RETIMED PIECE

**Decision:** the request must say. `durationPolicy` is `'ripple'` or
`'preserve-start'`; there is no default.

| policy | what happens | when it refuses |
|---|---|---|
| `ripple` | the piece's start stays; later pieces on the same track slide by exactly the change | never for collision |
| `preserve-start` | nothing else moves; a hole opens or closes | REFUSES if growing would run into the next piece |

**Why no default:** both are real intentions and neither is safe as the other.
The toolbar sends `ripple`, because that is what a creator means by "make this
bit faster". A `preserve-start` collision is refused outright — never a silent
overwrite, which would destroy footage the user did not ask to lose.

---

## 6. THE SOUND THAT CAME WITH THE PICTURE

**Decision:** A1 is the same piece of footage as V1. It is not a separate thing
that could be given a different speed. Proved in the browser: after a 2x change,
the picture row and the sound row are both exactly 147 pixels wide.

---

## 7. WHETHER A SPED-UP VOICE GOES SQUEAKY

**Decision:** `maintainAudioPitch`, default **true**.

Two honestly different things a person can mean by "play this faster", and the
product does whichever they picked:

- **true** — a voice at 2x sounds like fast talking, not a chipmunk. FFmpeg's
  `atempo`; the browser's `preservesPitch`.
- **false** — the tape-recorder effect: faster is also higher. FFmpeg's
  `asetrate` + `aresample`. Offered because creators genuinely want it.

`atempo` only accepts 0.5 to 2.0 in one step, so anything outside is a CHAIN
whose factors multiply to exactly the speed asked for, built the same way every
time. **What is given up:** `atempo` is a real effect and at extreme speeds can
add a faint fluttering. That is the price of not sounding like a chipmunk, and
every other editor pays it.

---

## 8. BACKWARDS

**Decision:** the intent is recordable in the domain today. The **user-facing
control refuses**, in plain words, and says why.

**Why:** a browser will not play a video file backwards — a negative playback
rate is ignored or treated as a pause by every engine. The only truthful way is
to prepare a backwards copy of the footage in advance, through the bounded
derived-media system. Until that exists, showing forwards footage while claiming
backwards would be a lie, and the preview agreeing with the export is worth more
than a switch that half-works.

The domain still accepts the intent, so that building the derived media later
does not require touching saved history.

---

## 9. FREEZE FRAME

**Decision: NOT built in this pass, and NOT faked.**

**Why it is not just "speed zero":** speed zero is division by zero — a piece
that consumes no recording per tick has no length that means anything, and every
sum in the time model would have to special-case it.

A freeze needs its own closed kind of segment: one source instant, held for a
chosen length, with silence under it. That changes the SHAPE of what is stored,
which is a different risk class from adding an optional field. It is separated
out rather than half-built. See `T2_FREEZE_FRAME.md`.

---

## 10–12. WHAT MOVES WHEN A PIECE CHANGES SPEED

```
   PINNED TO THE FOOTAGE          MOVES.
   B-roll, pictures, titles,      Those moments of the recording now arrive
   callouts, nameplates,          at different times, so the things pinned
   captions, footage motion       to them arrive at different times too.

   PINNED TO THE FINISHED VIDEO   DOES NOT MOVE.
   music (ADR-007)                It was never pinned to the footage.
                                  Moving it would be a change nobody asked for.

   NOT PART OF THE VIDEO          DOES NOT MOVE.
   markers, groups                They are the user's own notes.
```

One function does all of the first row: `placeSourceSpan`. Because it is one
function, a nameplate and a caption and a piece of B-roll cannot disagree about
where a speed change left them.

---

## 13. CAPTIONS

Captions are pinned to the footage, so they follow, through the same
`placeSourceSpan`. No caption-specific rule exists, deliberately: a
caption-specific rule is a second opinion waiting to disagree.

---

## 14. WHO OWNS A TRANSITION

**Decision:** the existing `set-clip-transition`, extended by exactly one value
in a closed list. No second transition engine.

A transition is bound to the join between two pieces that are EXACTLY adjacent.
It does not consume time: applying it returns the composition unchanged, and the
ramps are compiled onto the two segments. That is why adding one moves nothing.

**Removal is the same operation with `style: 'none'`.** No separate delete,
which is what keeps one join from ever having two disagreeing answers.

**Shipped:** `none`, `dip-to-black`, `dip-to-white`.
**Deliberately absent:** Cross Dissolve, Wipe, Slide, Push, Zoom — all five need
two shots on screen at the same instant, and the preview has ONE video player.
See `T2_TRANSITIONS.md` for the full reasoning.

---

## 15. J-CUTS AND L-CUTS

**Decision: NOT built in this pass.**

They need the sound to keep its own window, separate from the picture's, while
the two still share one identity. That is a shape change to what is stored, in
the same risk class as freeze frame. Half-building it — letting the sound be
dragged with nothing to keep it linked — would produce exactly the "partial
unlink" the instruction forbids. See `T2_J_L_CUTS.md`.

---

## 16. LEFT AND RIGHT

**Decision:** a whole number in hundredths of a percent, on `set-clip-audio`.

```
   -10000  all the way left
        0  centred
   +10000  all the way right
```

**Rejected:** a decimal from −1 to 1, for the same reason speed is a fraction —
0.1 cannot be held exactly, so two "identical" projects could hash differently.

**Constant power, not a straight line.** As the sound moves left, the left
speaker rises along a curve and the right falls along the mirror image, so the
TOTAL loudness is the same all the way across. A straight line would make
anything centred about 3 decibels quieter than the same thing hard left, which
listeners hear as the sound ducking as it passes the middle.

**The one line that matters:** `set-clip-audio` carries the WHOLE answer for a
piece's sound and the last one wins. Every builder of that operation must carry
the piece's CURRENT pan through, or nudging the volume slider would silently
snap a hard-left clip back to the middle. This was found by a failing test
during T2 and fixed in `timeline-edits.ts`.

---

## 17. LOUDNESS NORMALISATION

**Decision: NOT built in this pass, and explicitly NOT guessed.**

It requires measuring the real sound — integrated loudness and true peak — which
means an analysis pass over the media, not a look at the waveform picture. A
waveform drawing is already lossy; deriving a loudness target from its pixels
would produce a number that sounds authoritative and is wrong.
See `T2_NORMALIZATION.md`.

---

## 18. WHAT AN OLD PROJECT DOES

Nothing. Reads identically, compiles to the byte-identical plan, keeps its
finished export. Proved by test and by opening the owner's real project at
revision 30.

---

## 19. THE RENDER-PLAN VERSION

**Decision: NOT moved. It stays `sanverse.render-plan/v7`.**

The version exists so that a change to what a renderer must understand forces a
re-export. Every field added in this pass is OPTIONAL and is written ONLY when a
piece was actually retimed. A plan that does not mention them means exactly what
it always meant. An untouched project therefore fingerprints identically and
keeps its finished video.

Moving the version would have thrown away every finished export in existence to
describe a feature those projects do not use.

---

## 20. THE AI AND THE PERSON USE THE SAME OPERATIONS

`set-clip-time-transform` is registered as a capability at both the primitive
and component level. There is no editing policy inside a React event handler:
the toolbar calls the same planner an AI proposal would, and both pass through
the same approval gate.
