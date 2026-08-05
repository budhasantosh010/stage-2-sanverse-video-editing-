# T0 — What was actually done in a real browser, on real media

2026-08-05 · Gate T0

Written to the standard of `CLAUDE.md` rule 3: *passing tests are not proof the
product works.* Everything below either happened in the running app or is marked
plainly as not having happened.

Project: `project_1ad7b832a52d6faf09da2390e97f729a` — the owner's own, five real
assets, 21 accepted changes at the start.

| asset | size | what it is |
|---|---|---|
| `asset_1ad7b832a52d` | 1920 × 1080 | the main recording, 30 s |
| `asset_d6358c66df59c03071f3203e9599cef1` | **714 × 1280** | real upright phone footage, 45 s |
| `asset_0942a944e52ddf404ebdc46cb3ade7a8` | 1920 × 1080 | second landscape clip, 15 s |
| `asset_50e98dde5fbf2e810928a87a779298fd` | 1440 × 900 | a still picture |
| `asset_1e83d8f9f60dc711cab76647c80644d6` | — | music |

## The project already WAS the reproduction

This is worth stating on its own, because it is the browser proof that was owed
from last session.

The owner's project already contained the exact add → adjust → delete sequence:

```
operationKinds  { "add-media-overlay": 1,
                  "set-visual-properties": 3,
                  "remove-overlay": 1, ... }

blockedReasons  [ "SOURCE_SPAN_REMOVED",
                  "VISUAL_TARGET_UNKNOWN",
                  "VISUAL_TARGET_UNKNOWN",
                  "VISUAL_TARGET_UNKNOWN" ]
```

An overlay was added, moved or scaled three times, and then deleted — leaving
three adjustments naming something that is no longer on screen. That is the
condition that used to make the compiler refuse the whole project, which the
preview read as "the timeline is empty everywhere".

Nothing had to be constructed. The reproduction was sitting in the owner's own
saved work.

## What was checked, and what came back

| # | step | result |
|---|---|---|
| 1 | Open Studio on the real project | one `<video>` element, 1920 × 1080 decoding |
| 2 | Panel layout unchanged | V2 / V1 / C1 / A1 / A2 in order; Media, Preview, Inspector, AI, Timeline all in their existing places |
| 3 | Preview with three dangling adjustments present | `primaryDecision: active`, `gapReason: null` — **no false gap** |
| 4 | Diagnostics agree with the composition | composition time 1.27 s maps to 9.06 s inside the recording; correct for a trimmed clip |
| 5 | Element points where asked | `currentVideoSrcIdentity` == `requestedVideoSrcIdentity` == `media` |
| 6 | Seek the whole composition, 25 points | 3 gaps reported, at 0.00 s, 0.93 s, 22.25 s |
| 7 | Are those gaps truthful? | clips are 1.27–4.21 and 4.21–22.25 → all three are genuinely empty. **Verified independently against the composition, not taken on trust.** |
| 8 | Does the project compile? | yes — `segments=2, framing=fit`, despite three dangling adjustments |
| 9 | Save state | `Saved on this computer · up to change 21` |
| 10 | Timeline notices | plain sentences, no codes (see `T0_ENGINEERING_UI_REMOVAL.md`) |
| 11 | Place the 714 × 1280 portrait clip on the main video track | accepted, revision 22 |
| 12 | Press Export | **failed** — see below |
| 13 | Restart the API, bump revision, press Export | `Export ready · 1920 × 1080 · 27s` |
| 14 | Probe the downloaded file | 1920×1080, SAR 1:1, yuv420p, 30 fps, 818 frames, 27.278 s, AAC 48 kHz stereo |
| 15 | Sample the frames | landscape clip edge to edge; portrait clip letterboxed, whole picture, correct proportions |
| 16 | Reload the page | revision 22 persisted, project reopened correctly |

## The export failure at step 12, and why it is worth writing down

The first Export attempt returned `RENDER_FAILED`. The fix was not wrong; the
**running server was still using the old code**.

> The API loads TypeScript when it starts. A change to the exporter does nothing
> until the server is stopped and started again.

That trap was already recorded in `PROGRAM_STATE.md` and still cost time. It is
recorded again here because it produces the most misleading possible signal: a
correct fix that appears not to work.

The second trap, hit immediately after: **a failed export is remembered**,
cached against the project and its revision, so pressing Export again returns the
old failure instantly. The revision had to be moved with a harmless change first.

Both are now in the traps list.

## Steps NOT driven by hand

1. **Placing the portrait clip on the main track.** Done through the same
   `place-primary-clip` operation a drag produces, sent to the local API
   directly. Simulated HTML5 drag events do not reach the app's drop handler in
   this browser harness. Everything after that point — the export, the file, the
   frames — is the real product doing the real thing.
2. **The 95-step master workflow in the original program brief.** Not run. The
   steps above are what was actually verified; the rest of that list belongs to
   later gates and is not claimed here.
3. **Screen sizes 1440×900, 1280×800, 1024×768, 390×844.** Not tested this
   session. The Timeline CSS added is bounded (opacity, outline style, ring
   width, an 8px handle, tick opacity) and adds no fixed widths, but that is an
   argument, not a measurement, and is not offered as proof.
4. **Undo / Redo / Insert / Overwrite / Append driven by hand.** Covered by the
   invariant tests over the real domain operations, not by clicking.
5. **A recoverable save failure triggered for real.** The state machine is
   proven by 25 tests; the network was not actually cut.

## Console and network

No errors from the changed code. Two pre-existing
`InvalidStateError: Transition was aborted because of invalid state` warnings
from the View Transitions API still appear when moving between the project list
and Studio. They are unrelated to this gate and are recorded, not fixed.

## Evidence files

- `screenshots/fail051-REAL-EXPORT-portrait-in-landscape.png` — the real exported
  frame: upright phone footage, whole picture, bars at the sides
- `screenshots/fail051-REAL-EXPORT-landscape-unchanged.png`
- `screenshots/fail051-portrait-in-landscape-FIT.png`
- `screenshots/fail051-portrait-in-landscape-FILL.png`
- `screenshots/fail051-landscape-clip-unchanged.png`

## A note on the project's state afterwards

The owner's project now carries the portrait clip on its main track (revision 24)
because that is what was exported. It can be removed with Undo. It is left in
place deliberately: it is the live proof that mixed-shape footage works, and
removing it would remove the evidence.
