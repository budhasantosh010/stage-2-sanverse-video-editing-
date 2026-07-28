# ADR-005 — Edits are anchored to the footage, not to the finished video

- Status: Accepted
- Date: 2026-07-28
- Goal: G5-B (cutting, trimming, reordering)
- Supersedes in part: ADR-002's clip-relative operation timing

## The question

A nameplate says "show this text from second 8 for five seconds". Second 8 of
*what*?

Before cutting existed the question had no teeth, because the finished video and
the original recording were the same thing. The first cut separates them
forever, and the answer decides whether every edit the user has already approved
survives that cut or quietly becomes wrong.

## The decision

**Every edit that is drawn on top of the picture stores its timing against the
original recording's own timeline, never against the finished video's.**

One function, `placeSourceSpan`, translates recording time into finished-video
time. It is the only translator, and everything that draws, exports, or displays
a time goes through it.

## Why

Take a nameplate placed on a face eight seconds into the recording, then trim
four seconds off the front:

```
  THE RECORDING (never changes)
  0s        4s        8s                     30s
  |---------|---------|----------------------|
                      ^ the face

  ── stored against the FINISHED VIDEO ───────────────────────
     the nameplate keeps saying "second 8"
     the finished video now starts at recording-second 4
     so second 8 of the finished video is recording-second 12
                                  ^ a different moment, no warning

  ── stored against the RECORDING (this decision) ────────────
     the nameplate keeps saying "recording-second 8"
     the system works out that this is now second 4 on screen
                                  ^ still the same face
```

The first version does not fail loudly. It exports a video where the name is
under the wrong person, and nothing anywhere reports a problem. That is the
worst class of defect this product can have.

## What follows from it, whether we like it or not

1. **A cut through the middle of a nameplate produces two appearances.** The
   nameplate stays with the footage on both sides, so it is drawn twice and
   looks continuous. The render plan therefore carries more overlay nodes than
   there are operations, and each needs its own identifier.

2. **Deleting the footage blocks the edit.** If nothing of the anchored span
   survives, the edit is reported as blocked and contributes nothing. It is
   never relocated to somewhere it would fit, because an edit the user did not
   ask for is worse than one that visibly needs attention.

3. **An edit that partly overruns is trimmed to what survives, not refused.**
   Five seconds asked for at second 29 of a 30-second video becomes one second.
   The proposal panel shows one second, so the user approves what they can see.

4. **The stored composition became the *imported* footage and stops changing.**
   What the viewer sees is `effectiveComposition(project)`: the import plus
   every accepted cut replayed in order. This is what makes one cut exactly one
   Undo, and lets a single cut in the middle of the history be switched off
   without disturbing the ones after it.

5. **Two passes, deliberately one-way.** Cuts are replayed in order to decide
   what the video is made of; overlays are then judged against the *finished*
   footage. Overlays can never influence the cuts. If they could, removing a cut
   could make an overlay valid, which could re-apply the cut, which could
   invalidate the overlay — a loop with no settled answer.

## The cost, stated

- **A schema change.** Project and operation both moved to v3, with an upgrade
  ladder that handles v1 and v2 and rewrites each file once. That work is done
  and was verified on the owner's own project.
- **Mixed change sets are a known rough edge.** A single change set holding both
  a cut and an overlay can have the cut applied while the change set is reported
  blocked for its overlay. No such change set exists today; G7 must resolve it
  before compound requests ship.
- **The preview got harder.** The browser holds one untouched recording, so it
  now has to jump between stretches and sit on black where a stretch was left
  empty. That machinery is `segment-playback.ts`.

## Revisit trigger

- An edit type appears whose natural anchor is genuinely the finished video and
  not the footage — a closing card that should always be last, for example.
  That is a second anchor kind, not a reason to abandon this one.
- Multi-asset projects (G5-C) reveal that anchoring to `assetId` alone is not
  enough to identify which appearance of a repeated clip was meant.
