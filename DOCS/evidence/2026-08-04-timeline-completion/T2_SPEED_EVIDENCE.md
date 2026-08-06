# T2 — WHAT WAS BUILT, WHAT WAS PROVED, AND WHAT WAS NOT

Written 2026-08-06. Covers the whole of the first T2 pass in one place, so the
next session reads one file instead of fourteen.

> **GATE T2 IS NOT COMPLETE.** Three of its nine parts are done and proved; six
> are not started. The exact split is at the bottom, and the same split is in
> `PROGRAM_STATE.md`. Nothing here is described as finished that is not.

---

## PART 1 — WHAT THE TIMELINE COULD NOT DO, AND CAN NOW

```
   BEFORE                                AFTER
   ──────                                ─────
   every piece played at one speed       0.1x to 16x, in a fraction
   the Speed button said "not built"     the Speed button opens a panel
   no way to say "not so squeaky"        a switch, on by default
   a transition could only fade to       it can fade through white too
     black
   nothing said how fast a clip was      a badge on the clip says "2x"
```

---

## PART 2 — THE TIME MODEL (`packages/edit-domain/src/clip-time.ts`)

A piece of footage now has TWO lengths:

```
   SOURCE LENGTH     how much of the recording is used
   TIMELINE LENGTH   how long it occupies in the finished video

   normal (1x)   recording |==========|   finished |==========|
   double (2x)   recording |==========|   finished |=====|
   half  (0.5x)  recording |==========|   finished |====================|
```

Only the source length is stored. The timeline length is worked out by ONE
function. Two stored numbers that must agree eventually disagree.

The speed is a fraction — `{numerator, denominator}` — never a decimal. The full
reasoning, the rejected alternative and what it costs are in
`DOCS/decisions/ADR-CLIP-TIME-AUDIO-TRANSITIONS-V1.md`.

**44 tests** cover the fraction itself. **25 more** cover what happens when a
retimed piece is cut, trimmed, rippled or has something pinned to it.

### The bug the tests found before a user could

Rounding each piece's LENGTH makes a clip GROW when it is cut:

```
   a 10-tick clip at 3x, cut after 5 ticks
   whole  round(10/3) = 3 ticks
   left   round( 5/3) = 2 ticks
   right  round( 5/3) = 2 ticks
                        ─
                        4 ticks   ← one tick longer than the clip it came from
```

That tick runs into whatever is next and the whole edit is refused as an
overlap. Split enough times and a project stops opening. The fix — round the
EDGES and subtract — is in the ADR with the arithmetic worked through.

---

## PART 3 — THE EXPORT (`apps/api/src/render/ffmpeg-retiming.ts`)

| what | instruction | why |
|---|---|---|
| picture, 2x | `setpts=0.5*PTS` | halve every frame's moment |
| picture, backwards | `reverse` **first**, then speed | reversing already-stretched timestamps puts the last frame in the wrong place |
| sound, pitch kept | `atempo` chain | one step only accepts 0.5–2.0, so 4x is 2×2 and 0.1x is 0.5×0.5×0.5×0.8 |
| sound, squeaky | `asetrate` + `aresample` | exactly what speeding up a record does |
| left/right | `pan=stereo\|c0=…\|c1=…` | constant power, so nothing ducks in the middle |

**24 tests**, including one that multiplies every chain out and checks it equals
the fraction exactly, and one that checks every step stays inside the range
FFmpeg accepts. That second test caught a real bug: stopping the 0.1x chain one
step early leaves a final factor of 0.4, which FFmpeg rejects at export time —
too late for the user to do anything about.

---

## PART 4 — THE PREVIEW (`apps/web/src/features/render-plan/segment-playback.ts`)

Still **one** `<video>` element. Verified in the running app.

The shared playhead stays on the FINISHED VIDEO's clock. The element's own
position is on the RECORDING's clock, and the two are converted by the same
arithmetic the domain uses. **17 tests**, including one that walks every moment
of every stretch and checks the recording moment it asks for is inside what the
exporter will actually take — the screen asking for a frame the export does not
contain is exactly the class of failure that made a day's work worthless before.

**The finding that changed a function:** a sped-up stretch is NOT a straight
play-through any more, so `isUncutPassthrough` had to learn about speed. Without
that, a project with one retimed clip would have taken the fast path and shown
the wrong playhead position for the entire video.

---

## PART 5 — THE PANEL (`apps/web/src/editor/timeline/TimelineSpeedPanel.tsx`)

Eight one-click speeds, a box to type any other, a pitch switch, and a way back
to normal. **17 tests.**

**Every tooltip is the planner's own sentence, not the panel's.** The panel asks
`previewSpeedChange`, which literally calls `planSpeedChange` and drops the
operation. Two tests assert the ghost and the committed edit report the
identical feedback and the identical refusal. Gate T0 was caused by two pieces
of code answering the same question separately; this is that lesson applied
before the bug rather than after it.

---

## PART 6 — WHAT WAS PROVED IN THE RUNNING APP

On the owner's real project `project_1ad7b832a52d6faf09da2390e97f729a`,
which has three video files, a portrait clip, a picture and music.

| # | what was done | what happened |
|---|---|---|
| 1 | opened the project saved at revision 30 | **opened unchanged** — the model change stranded nothing |
| 2 | Studio layout | five rows in order, 17 toolbar buttons, one video element |
| 3 | clicked a piece of the main video | "2 things picked" — the picture and its own sound |
| 4 | opened More | **Speed enabled**, no longer "not built yet" |
| 5 | opened the Speed panel | *"primary-30s.mp4 — 2.94s on screen, made from 2.94s of recording."* |
| 6 | read every preset's tooltip | 0.25x → 11.78s · 0.5x → 5.89s · 2x → 1.47s · 4x → 0.74s — all correct |
| 7 | the current speed | 1x marked, and its tooltip says *"That piece is already set that way."* |
| 8 | pressed 2x | clip width **294px → 147px**, exactly halved |
| 9 | the piece after it | left **589px → 442px** — moved by exactly 147px, the amount removed |
| 10 | the badge | **"2x"** drawn on the clip |
| 11 | the server | revision **30 → 31**, operation `set-clip-time-transform`, rate `2/1`, policy `ripple` |
| 12 | Undo | revision 32, clip back to **294px**, badge gone |
| 13 | Redo | revision 33, clip **147px**, badge back — **one gesture, one Undo** |
| 14 | **Export** | `job_ffd0cb60b44e1e508ba4d6c666173585` → **succeeded** |
| 15 | **probed the real MP4** | see below |
| 16 | Export again | **same job, 206 ms, already succeeded** — the fingerprint is stable |
| 17 | full page reload | revision 33, badge back, clip 147px |
| 18 | the sound row after reload | **also 147px** — the recorded sound follows its own picture exactly |
| 19 | four screen sizes | see below |
| 20 | console | one pre-existing View-Transition warning; **no errors from the new code** |

### Step 15 — the real exported file, measured

```
   video   h264   1920x1080   25.800 s   774 frames at 30 fps
   audio   aac    48000 Hz    stereo     25.804 s
   file    11,408,911 bytes
```

**Predicted:** the video was 27.278 s; the retimed piece lost 1.470 s;
27.278 − 1.470 = **25.808 s**. **Measured: 25.804 s.** Four milliseconds apart,
which is frame quantisation in the container. 774 frames ÷ 30 fps = 25.8 s
exactly, so the picture is frame-accurate.

### Step 19 — the four screen sizes

| size | sideways scroll | toolbar buttons | smallest target | five rows in order |
|---|---|---|---|---|
| 1440 × 900 | none | 17 | 28 px | yes |
| 1280 × 800 | none | 17 | 28 px | yes |
| 1024 × 768 | none | 17 | 28 px | yes |
| 390 × 844 | none | 17 | 28 px | yes |

The Speed panel was opened at the narrowest size: **316 px wide, fits on screen,
no sideways scroll, 8 presets, 32 px targets, "2x" correctly marked.**

---

## PART 7 — WHAT WAS **NOT** DONE, STATED PLAINLY

### Not started at all

| part | why it was not started, and what it needs |
|---|---|
| **T2.3 Reverse** | A browser will not play a video file backwards. It needs a backwards copy of the footage prepared in advance, through the bounded derived-media system built in Gate D — caching, cancellation, storage limits, preparing/ready/error states. The domain records the intent today; the user-facing control **refuses in plain words and says why**, rather than showing forwards footage. |
| **T2.4 Freeze frame** | Cannot be "speed zero" — that is division by zero. Needs its own closed kind of segment: one source instant, held, with silence under it. That changes the SHAPE of what is stored, which is a different risk class from adding an optional field. |
| **T2.5 direct audio handles** | The gain line over the waveform and draggable fade handles. The values they would set already work end to end; what is missing is the dragging. |
| **T2.5 Normalisation** | Needs real measurement of the sound — integrated loudness and true peak — which means an analysis pass over the media. Deriving it from waveform pixels would produce a number that sounds authoritative and is wrong. |
| **T2.6 J-cuts and L-cuts** | The sound needs its own window, separate from the picture's, while the two still share one identity. Same shape-change risk class as freeze frame. Half-building it produces exactly the "partial unlink" the instruction forbids. |
| **T2.8 transition chooser** | The one-click transition from T1 still works and now fades through white as well as black, but there is no chooser, no duration handle and no numeric entry. |
| **T2.9 Replace, Fit to Fill, Place on Top, Ripple Overwrite, Swap, Shuffle** | Six separate planners. None started. |

### Partly done

- **T2.2 Rate stretch.** The arithmetic is built and tested —
  `rateForTargetDuration` turns a dragged length into a fraction, refuses
  out-of-range in the right direction, and reports how close the approximation
  is. **There is no pointer drag wired to it.** So the capability exists and is
  proved; the gesture does not.
- **T2.7 Transitions.** `dip-to-white` is shipped end to end. Cross Dissolve,
  Wipe, Slide, Push and Zoom are deliberately absent — see the next section.

### Deliberately refused, with the reason

**Cross Dissolve, Wipe, Slide, Push, Zoom.** All five need TWO shots on screen at
the same instant. The preview has exactly one video player, by a rule that is not
up for negotiation, because a second player is a second clock and two clocks
drift. One player shows one frame at a time.

The exporter COULD produce them. The preview could not. The user would watch a
plain cut, wait for an export, and be handed a different video. The preview and
the file agreeing is worth more than five extra names in a menu.

### Limits of the proof itself

- **The preview's speed was proved by test, not driven by hand.** The three
  lines that set the player's rate live inside the frame loop, which needs real
  sustained playback; this browser harness does not composite frames or keep a
  video playing. The decision function those lines call has 17 tests. **Nobody
  watched a clip play at 2x on screen.**
- Clicks were dispatched as events, not made with a physical mouse. They went
  through the real handlers and made real edits — the revisions above are real.
- The pitch switch was not measured with a tone. The instruction asked for a
  440 Hz proof at 2x; that needs a generated fixture and a spectrum measurement,
  and it was not done. What IS proved is that the correct filters are emitted,
  by reading the filter text.
- Speed was applied to a piece of the MAIN video only. B-roll and music are
  refused with a plain sentence, which is the shipped behaviour, not an
  oversight — retiming them needs a different mechanism.

---

## PART 8 — THE NUMBERS

```
   tests   2,050  ->  2,215   (+165)
             edit-domain      419 -> 488
             render-contract  108 -> 119
             intent-domain     27 ->  27
             api              361 -> 388
             web            1,135 -> 1,193

   build   exit 0
   render-plan version   sanverse.render-plan/v7   (deliberately NOT moved)
   project schema        sanverse.project/v4       (deliberately NOT moved)
```

---

## PART 9 — THE TWO REAL DEFECTS FOUND ON THE WAY

1. **Nudging the volume would have silently re-centred the sound.**
   `set-clip-audio` carries the whole answer for a piece's sound and the last one
   wins. The builder that turns a volume slider into that operation did not carry
   the piece's pan through, so adjusting the loudness on a clip placed hard left
   would have snapped it back to the middle, with nothing on screen to say so.
   Found by a failing test, fixed in `timeline-edits.ts`.

2. **An operation was being applied before its defaults were filled in.**
   `validateBuiltOperation` validated the operation and then applied the
   *unvalidated* one. Validation is where an optional field becomes its
   documented default, so applying the raw form handed the composition an
   `undefined` where a number belongs and refused the whole edit for no visible
   reason. Fixed in `timeline-gesture-adapter.ts`.
