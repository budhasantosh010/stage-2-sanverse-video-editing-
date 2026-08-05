# The false gap — found, reproduced, and fixed

2026-08-05 · Gate T0.1 / T0.2

## What the owner saw

The monitor said **"No media at this time"** while the timeline plainly showed
footage under the playhead. Selecting a V1 clip seemed to trigger it, so the
first suspicion was that selection was somehow deciding whether footage exists.

**Selection was innocent.** So were both monitor state machines. The lie was
manufactured two steps earlier, and once it started it covered the *whole*
project — selecting a clip only drew attention to a preview that was already
lying everywhere.

## The chain, exactly

```
  1  The user adds a title (or B-roll, or a callout) to the video.
  2  The user MOVES or SCALES it.
        -> this records a "visual adjustment" naming that overlay
  3  The user DELETES the overlay.
        -> the overlay is gone; the adjustment naming it is still there

  4  The compiler is asked to build the video:
        "A visual adjustment names something that is not on screen."
        -> it refuses THE WHOLE PROJECT

  5  The preview asks that same compiler whether footage exists:
        compilePreviewPlan(project)  ->  null
        previewSegments = plan ? playbackSegments(plan) : []   ->  []

  6  "Is there footage at this moment?" is answered by searching that
     empty list. It is empty, so the answer is NO — at every moment.

  7  Monitor: "No media at this time."
        over thirty seconds of real, present, enabled footage.
```

Step 5 is the actual defect. **"The plan could not be built" and "the timeline is
empty" were being expressed by the same value: `null`.** Those are completely
different statements, and the preview could not tell them apart.

## Why this is the worst class of bug this product can have

A gap is not a shrug. It is a **claim about the user's own edit**: *you left this
stretch empty, and the exported file will be black here too.* Saying that over
footage that exists teaches the user that their timeline lies. After that,
nothing else they see can be trusted — every real gap becomes "probably another
bug", and every real bug becomes "probably fine".

It also blocked Export, with a message that explained nothing.

## The two fixes

### 1. Whether footage exists is read from the user's edit, never from a build

`apps/web/src/features/render-plan/primary-source.ts`

```
  resolvePrimarySource(project, tick)  ->  active { clipId, assetId, sourceTicks }
                                       |
                                       -> gap { reason }
```

Four reasons, and the order they are checked in is the design:

| reason | what the user sees | is the black intended? |
|---|---|---|
| `NO_CLIP_AT_TICK` | "No media at this time" | **yes** — this IS the video |
| `V1_OUTPUT_DISABLED` | "The video track is switched off" | yes, but they can undo it |
| `CLIP_DISABLED` | "This clip is switched off" | yes, but they can undo it |
| `ASSET_MISSING` | "This clip's file is missing" | **no** — a fault, shown as an error |

The whole-track switch is reported ahead of the clip switch, because turning
*this clip* back on would still show nothing — naming the clip would send the
user to the wrong switch. **Always report the blocker that must be removed first.**

The function takes a project and a number. There is no third argument, so
selection, hover, focus, drafts, toolbar state and Fit/Fill are not merely
"not used" — they are unexpressible. **Selecting a clip structurally cannot
change whether footage exists.**

It reads the same fields from the same place in the same order as the compiler
builds its segments, so the two cannot disagree about where the clips are. What
it adds is that one broken thing costs only its own interval.

### 2. An adjustment pointing at nothing draws nothing

`packages/render-contract/src/compile-project.ts`

The compiler already had exactly this rule three lines above, for the case where
V2 is switched off:

> "Failing here would mean that hiding a track made Export stop working
> altogether."

Deleting the overlay is the same situation and now gets the same answer: the
adjustment contributes nothing, which is what it already meant. A stale
adjustment must not cost the user a single second of their video.

## Proof

| what is proved | where |
|---|---|
| the OLD route reported all 30 s of healthy footage as a gap | `primary-source.test.ts` — "proves the old route reported EVERY moment as a gap" |
| the new resolver returns the right clip and tick at every second | same file |
| resolver and exporter agree at every half-second across the composition | same file, "agrees with the compiler about where every clip is" |
| the owner's add → adjust → delete sequence now compiles | `compile-overlays.test.ts` — "draws nothing, rather than erasing the whole video" |
| a LIVE adjustment is still bound (dropping both would be a new bug) | same file |
| the interval is half-open, so a cut frame belongs to one side | `primary-source.test.ts` |
| selection cannot be passed in | same file, argument-count assertion |

## What is NOT yet proved

The add → adjust → delete sequence was **not** driven by hand in the browser.
It is held by the two tests above and by reading the code path end to end. The
real project was opened after the change and confirmed to render footage with
one `<video>` element and no false gap, but that project does not contain a
deleted-and-adjusted overlay, so it does not exercise the trigger.

Driving that sequence in the browser is the first item of the remaining T0 work.
