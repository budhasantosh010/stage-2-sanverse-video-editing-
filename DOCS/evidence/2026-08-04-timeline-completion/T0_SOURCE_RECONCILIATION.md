# T0.3 / T0.4 — Pointing the one video element at the right file, at the right moment

2026-08-05 · Gate T0

## The situation

There is exactly **one** `<video>` element in the whole editor, and the main
sequence can be made of several recordings. So when the playhead crosses from
one recording into another, that single element has to be re-pointed at a
different file and then moved to the exact moment inside it.

Every accepted edit can change which file that is: a move, a trim, a split, a
delete, a ripple, Insert, Overwrite, Append, switching a clip off, switching a
track off, Undo, Redo, reopening the project, opening a different project.

Getting this wrong does not look like a crash. It looks like the wrong footage
on screen, or the right footage a few seconds out — which the user reads as
"the preview is unreliable" rather than as a bug.

## The defect that was found

Which recording is under the playhead was read from the **compiled plan**:

```
playheadAssetId = assetAt(previewSegments, playheadTicks)
```

`previewSegments` is empty whenever the plan could not be built.

That is exactly the trap that produced FAIL-052. One unrelated broken thing
anywhere in the project made the plan fail as a whole, `assetAt` answered "no
recording", and the video element was left pointed at whatever it happened to be
showing before. The picture on screen then had nothing to do with where the
playhead was.

**The same mistake, in a second place.** Fixing the message last session did not
fix this, because this is a different reader of the same bad source.

### The fix

The answer now comes from the same authority the rest of the preview uses:

```
playheadDecision = resolvePrimarySource(editProject, playheadTicks)
```

which reads the user's own edit and cannot fail as a whole. One broken thing
costs only its own stretch.

## The stale-completion problem

Loading a video file is not instant. This can easily happen:

```
  t=0ms    playhead moves into recording B  ->  start loading B
  t=40ms   user presses Undo, playhead is back in recording A
  t=90ms   B finishes loading  ->  "I am ready, seek to 4.2s"
```

If that last message is obeyed, the user sees recording B at 4.2 seconds while
the playhead is sitting in recording A. The picture is wrong and **nothing looks
broken**, so nobody investigates.

Every decision therefore carries a `generation` number that goes up by one each
time a new decision is made. A completion carrying an old number is ignored.
That check is the only thing standing between the user and a preview that shows
the wrong clip after a fast Undo.

## What the reconciler decides

`apps/web/src/features/render-plan/preview-reconciliation.ts`

| answer | when | what happens |
|---|---|---|
| `seek-loaded-source` | the playhead is still inside the file already open | move it; keep everything the browser buffered |
| `load-and-seek` | the playhead is genuinely in a different recording | point the SAME element at it, then seek |
| `show-gap` | there is truthfully nothing here | the reason decides which sentence is shown |

Swapping the source inside the same recording would throw away everything the
browser had buffered and make the picture stutter at every cut, for nothing at
all — the file is already open and already decoded. So it does not.

"Loading" is shown **only** for `load-and-seek`. Showing it for a seek inside a
file that is already open makes ordinary scrubbing flicker with a message about
nothing.

The user's play-or-pause intention is carried through a file swap unchanged. A
user who was watching should still be watching; a user who paused to look at a
frame should not have the video start playing at them.

### What it cannot be told

`reconcilePrimaryPreview` takes **one** argument object with five fields. There
is no slot for the selection, the hover, the focused panel, the Inspector, a
pending proposal, the toolbar, or the monitor's Fit/Fill setting.

None of those has any business deciding which file is on screen, and here they
are not merely unused — they cannot be passed in at all. A test asserts the
argument count.

## T0.4 — the promise, written down

When all four of these are true:

- the video track is switched on
- a switched-on clip covers the moment the playhead is at
- that clip's file is in the project
- the project on screen is the one that was accepted

then the monitor **cannot** say "No media at this time", cannot resolve to a
gap, and cannot sit at unexplained black.

`preview-invariant.test.ts` drives a project through each kind of edit and
re-checks the promise every time, at every quarter of a second across the whole
video:

| case | what is driven |
|---|---|
| A | one recording, first frame to last |
| E | a switched-off clip — reported as switched off, and the clip before it still plays |
| F | the whole track off — the TRACK is named, not the clip |
| G | a missing file — reported as a fault, not as an empty stretch |
| I | after a trim, and after a trim that closes the gap |
| J | after a split — at the cut and either side of it |
| K | after a delete that leaves the space, and one that closes it |
| O | after Undo |
| P | after Redo |
| O/P | a run of three edits, all the way back, then forward again |
| Q | a project rebuilt from what was saved |
| S | selection changed twenty times with the playhead fixed |
| T | Fit/Fill changed with the playhead fixed |

The check is written **once**, as a helper applied to a project, rather than
hand-written per case. Hand-written assertions drift: somebody softens one while
fixing an unrelated failure, and the softened one is the one that mattered.

It also insists on the **converse** — that a genuinely empty stretch is reported
as empty. A resolver that answered "footage" everywhere would pass a one-sided
check while being just as wrong.

### A real domain rule found while writing this

The domain refuses to switch off the **only** clip in a project:
`COMPOSITION_WOULD_BE_EMPTY`. A video with nothing in it is not a video. So the
switched-off cases had to be written as they can actually occur — two clips with
one of them off — which is a better test anyway, because it also proves that one
switched-off clip costs only its own stretch.

## Proof in the real browser

Owner's real project, revision 21, with three dangling adjustments present:

```json
{
  "primaryDecision": { "kind": "active", "clipId": "clip_95c4ccc54dafc275",
                       "assetId": "asset_1ad7b832a52d", "sourceTicks": 13039876 },
  "gapReason": null,
  "v1OutputEnabled": true, "clipEnabled": true, "assetAvailable": true,
  "currentVideoSrcIdentity": "media", "requestedVideoSrcIdentity": "media",
  "sourceSwitchGeneration": 1
}
```

The element is pointed at exactly what was asked for, and composition time
1.27 s maps to 9.06 s inside the recording — correct for a trimmed clip.

Seeking the whole composition at 25 points reported three gaps, at 0.00 s,
0.93 s and 22.25 s. Checked independently against the composition:

```
clips   1.27-4.21   4.21-22.25
0.00 covered? false    0.93 covered? false    22.25 covered? false
```

All three are **truthful**. 22.25 s is exactly the end, which belongs to nothing
because the interval is half-open.

## What is not covered

`outputStateAt` in `segment-playback.ts` is still defined but never used in
production. It was noted in the previous session and is noted again here: it
means per-moment track-output state is not read on that path. The V1 output
switch IS honoured, through `resolvePrimarySource`, which is why this is a
tidiness issue rather than a correctness one — but it is unfinished and should
not be forgotten.
