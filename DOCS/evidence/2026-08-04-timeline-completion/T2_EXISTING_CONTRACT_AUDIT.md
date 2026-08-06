# T2.0 — WHAT ALREADY EXISTED, TRACED IN THE CODE

Written 2026-08-06, before any T2 code was changed. Every line below was read
out of the files named, not remembered or guessed.

---

## WHY THIS DOCUMENT EXISTS

The instruction for Gate T2 says, in its own words: *"Do not add new operations
where existing ones can express the result safely."*

That is only possible if somebody first goes and reads what the existing ones
actually do. Building on a half-remembered contract is how a codebase ends up
with two ways to set a clip's volume that disagree with each other.

---

## THE ONE PICTURE THAT EXPLAINS THE WHOLE SYSTEM

```
   WHAT IS SAVED                       WHAT IS SHOWN AND EXPORTED
   ─────────────                       ──────────────────────────

   project.composition                 effectiveComposition(project)
   the footage AS IMPORTED       ──►   = the footage as imported
   NEVER CHANGES                         + every accepted edit replayed
                                              │
                                              ▼
                                       compileProjectToRenderPlan(project)
                                       ONE description of the finished video
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                               ▼
                      browser preview                  FFmpeg export
                    (segment-playback.ts)        (ffmpeg-render-adapter.ts)
```

Both readers get the SAME plan. That is the rule everything else hangs off.

---

## `set-clip-audio` — EVERY FIELD, AS FOUND

`packages/edit-domain/src/timeline-operations.ts` line 107 (before T2):

| field | type | what it means |
|---|---|---|
| `schemaVersion` | `'sanverse.operation/v3'` | one version for the whole family |
| `operationId` | `operation_[a-z0-9]{8,64}` | carried, never invented while applying |
| `capabilityId` | string | must be registered as producing this kind |
| `kind` | `'set-clip-audio'` | |
| `clipId` | `clip_[a-z0-9]{8,64}` | which piece |
| `gainDb` | number, −60 to +12 | loudness change |
| `fadeIn` | `MediaTime` | silence-to-full ramp at the head |
| `fadeOut` | `MediaTime` | full-to-silence ramp at the tail |
| `extensions` | closed bag | |

**Where the values land:** on the `Clip` itself (`composition.ts` line 35), NOT
in a separate list. The comment there explains why: cutting a clip in two then
carries the loudness to both halves automatically.

**Refusals found:** `FADE_LONGER_THAN_CLIP` when the two ramps together exceed
the piece. `clampFades` pulls a ramp in — the ONLY adjustment anywhere in that
file — when a cut makes the piece shorter.

**Preview:** the plan carries `gainDb`, `fadeInTicks`, `fadeOutTicks` per
segment; the browser does not apply them itself (the `<video>` element plays the
recording's own sound).

**Export:** `ffmpeg-render-adapter.ts` line ~879 — `volume=<n>dB`, then
`afade=t=in`, then `afade=t=out`.

**MISSING, and therefore T2 work:** left/right position. No pan anywhere.

**DECISION: extend `set-clip-audio`, do NOT add `set-clip-pan`.** Two operations
that both decide how one clip sounds would eventually be applied in an order
nobody chose, and the loser would be silently discarded. `pan` is added as an
OPTIONAL field, so every request already written and every change set already
saved stays valid and means "centred".

---

## `set-clip-transition` — EVERY FIELD, AS FOUND

| field | value found | note |
|---|---|---|
| `clipId` | the OUTGOING piece | |
| `nextClipId` | the piece immediately after | |
| `style` | `'none'` or `'dip-to-black'` | only two |
| `duration` | `MediaTime`, max 2,880,000 ticks (2 s) | each side's ramp |
| `audio` | `'cut'` or `'fade-through-silence'` | |

**Refusals found:** `TRANSITION_TARGET_INVALID` when the two pieces are not
exactly adjacent; `TRANSITION_LONGER_THAN_CLIP`.

**Crucially:** applying it returns the composition UNCHANGED (line 699). The
transition lives in the accepted operation and is compiled onto the two segment
nodes. **A transition does not consume time.** That is why adding one does not
move anything.

**Preview:** `render-plan-preview.ts` `segmentOpacityAt` reads `videoFadeInTicks`
and `videoFadeOutTicks` and dims the picture. **Black is hard-coded** — the
preview dims towards the panel's own background.

**Export:** `fade=t=in:...:color=black` and `fade=t=out:...:color=black`.

**MISSING:** any colour but black; any kind that needs two pictures at once.

**DECISION: extend the same operation.** `dip-to-white` is one more value in a
closed list and one more word in two filter strings. Cross Dissolve, Wipe,
Slide, Push and Zoom all need two shots on screen at the same instant, and the
preview has ONE video player by a rule that is not up for negotiation — see
`T2_TRANSITIONS.md`.

---

## THE MAPPING BETWEEN THE FINISHED VIDEO AND THE RECORDING

| question | function found | file |
|---|---|---|
| how long is this piece on screen? | *implied* — `sourceRange.duration` | `composition.ts` |
| where does a pinned span land? | `placeSourceSpan` | `composition.ts` 165 |
| what is showing at this moment? | `clipAtCompositionTime` | `composition.ts` 196 |
| how long is the whole video? | `compositionDuration` | `composition.ts` 215 |

**The finding that shaped the whole gate:** there is no "how long is this piece
on screen" function, because until T2 the answer was always
`clip.sourceRange.duration`. The `Clip` type says so in its own words:

> a clip occupies exactly `sourceRange.duration` in the composition. There is no
> separate composition duration field, which is what makes "no retiming"
> impossible to express rather than merely discouraged. Speed changes arrive
> with an explicit rate field in a later schema version.

**T2 is that later schema version.** The invariant is amended, not deleted:
there is STILL no stored composition-duration field. The on-screen length is
DERIVED from the source length and the speed by one function,
`clipCompositionDurationTicks`. Two stored fields that must agree eventually
disagree; one field and a rule cannot.

**54 places** read `sourceRange.duration` across 17 files. Each was inspected and
classified: the ones that mean "how much recording" were left alone; the ones
that mean "how long on screen" were changed to call the new authority.

---

## THE FIVE TRACKS, AND WHAT EACH IS ANCHORED TO

| track | holds | anchored to | ADR |
|---|---|---|---|
| V2 | B-roll, pictures, titles, callouts, nameplates | a moment of the FOOTAGE | ADR-005 |
| V1 | the main video's own pieces | itself | — |
| C1 | captions | a moment of the FOOTAGE | — |
| A1 | the sound that came with V1 | the same piece | — |
| A2 | music | the FINISHED VIDEO's clock | ADR-007 |

**Consequence for speed, and it is load-bearing:** speeding up a piece of V1
moves everything pinned to that footage, because those things are pinned to
moments of the recording and those moments now arrive at different times.
Music does NOT move, because it was never pinned to the footage.

---

## EXPORT IDENTITY, AS CHANGED IN T1

`apps/api/src/render/export-identity.ts`: an export is identified by

```
sha256( projectId : renderPlanVersion : <the compiled plan minus projectRevision> )
```

**Consequence for T2:** any new field written into the plan changes the
fingerprint of every project that carries it. Writing `playbackRateNumerator: 1`
into every plan would change the fingerprint of every project ever made and
make every user wait for a byte-identical re-export.

**DECISION: every retiming field is OPTIONAL and is written ONLY when the piece
was actually retimed.** An untouched project therefore compiles to the
byte-identical plan it always did, and the render-plan version does NOT move.
Proved by test in `compile-speed.test.ts`.

---

## PER-CAPABILITY VERDICT

| T2 capability | reusable authority | missing domain | missing render | missing UI | shape change | plan version |
|---|---|---|---|---|---|---|
| Constant speed | none — new | rate + fold | setpts/atempo | flyout | optional clip field | none |
| Rate stretch | the same speed authority | none | none | pointer drag | none | none |
| Reverse | none | direction field (added) | derived media | switch | none | none |
| Freeze frame | none | new segment kind | new input | none | **yes** | likely |
| Clip gain/fades | `set-clip-audio` | none | none | direct handles | none | none |
| Pan | `set-clip-audio` | optional field | `pan` filter | none | optional clip field | none |
| Normalisation | none | evidence type | analysis pass | none | none | none |
| J/L cuts | none | audio window | separate atrim | edge trim | **yes** | likely |
| Transitions | `set-clip-transition` | one more style | one word | chooser | none | none |
| Placement extensions | `applyLaneEdits` | none | none | menu entries | none | none |

**What that table decided:** the four capabilities in the left column that need
NO project-shape change and NO plan-version change were done first, because they
are the ones that cannot strand a saved project. Freeze frame and J/L cuts both
change the shape of what is stored, and are therefore separated out rather than
half-built.
