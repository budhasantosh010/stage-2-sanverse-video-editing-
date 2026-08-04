# Gate D — a sixty-minute project stays bounded

2026-08-04

Everything in an editor works on a thirty-second test video. The failures that
matter — the tab running out of memory, the timeline stuttering, the scroll that
decodes ten thousand thumbnails — only appear on the long projects a user has
already put hours into. Those are the worst possible moment to find out.

## The fixture

Deterministic, built rather than recorded, because the NUMBERS are what is being
tested and nothing here decodes anything:

```
   60 minutes of finished video
  250 pieces of main footage        averaging ~14 s each
   12 recordings, used repeatedly   because a real edit revisits shots
  250 pieces of dialogue            the SAME clips: dialogue is the sound of
                                    the very same file, at the very same moment
  100 things laid on top
   20 pieces of music WITH GAPS     silence between beds, as a real episode has
   12 pictures
  500 captions
      varied trims, splits, overwrite fragments, one missing recording
```

Every recording has its own content fingerprint, so two recordings sharing a name
would be caught. Every clip is trimmed by a different amount, so anything
confusing timeline time with recording time is wrong by a different amount on
every clip rather than uniformly.

## What is proved on it

| claim | how |
|---|---|
| a whole plan never exceeds its ceiling, and SAYS when it bites | 400-request cap, `truncated: true` asserted |
| the most important work is done first when the ceiling bites | every picture the selected clip needs is in the plan, ahead of 249 others |
| a split costs at most one extra decode | key sets compared before and after |
| an overwrite fragment costs at most two | key sets compared |
| a move costs nothing | identical key sets |
| a trim costs one picture | only the clip's own start changes |
| the same shot used twice costs once | plan length equals a single clip's |
| one recording is never more work than twelve | plan lengths compared |
| a missing recording costs only its own pictures | every remaining key still valid |
| scrolling the whole hour leaks nothing | everything ever produced is still held or was explicitly released |
| one window asks for tens, not tens of thousands | 40–70 requests for a 30-second window |
| the memory cache never exceeds its ceiling | asserted after 5,000 insertions |

## Measured in a real browser

On the real 75-second, two-recording project, scrolled end to end and back,
thirty-two stops:

```
  clips mounted at once, worst case      2
  drawing surfaces at once, worst case   3
  DOM nodes inside the timeline, worst  199
  <video> elements                        1   at every single stop
  object URLs created                     0
  failed requests                         0
  server processes after settling         0
```

## The honest limit of this evidence

The hour-long case is held by arithmetic on a fixture, not by an hour of real
footage on a real disk. Decoding an hour of real media was not done for this
gate. What IS proved with real media is that the per-request cost is one short
FFmpeg run, that the number of those in flight is capped at three, and that the
number of items on screen does not grow with the length of the project — which
together are what make an hour bounded.
