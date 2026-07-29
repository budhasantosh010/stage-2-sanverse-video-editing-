# P0-D.1 real-browser walkthrough

Date: 2026-07-29
Runtime: existing local Sanverse web/API on `localhost:2000` / `127.0.0.1:2001`
Project: `check .mp4`
Starting commit baseline: `7e507a53ebeea5873003d703ef37aee0395b70e7`

## Responsive evidence

The in-app browser completed the functional walkthrough and DOM measurements,
but its viewport screenshot backend tiled the page texture. Those invalid files
were rejected during visual inspection. Exact-size PNGs were recaptured through
a disposable local headless Edge/CDP session, the already-proven P0-D fallback.
No PNG was resized or composited. The fallback browser/profile and the
start-commit baseline server were deleted after capture.

| Surface | Requested | Browser inner size | Client / scroll width | Horizontal overflow |
|---|---:|---:|---:|---|
| Home | 1440×900 | 1440×900 | 1425 / 1425 | No |
| Home | 1280×800 | 1280×800 | 1265 / 1265 | No |
| Home | 1024×768 | 1024×768 | 1009 / 1009 | No |
| Assist | 1440×900 | 1440×900 | 1425 / 1425 | No |
| Assist | 1280×800 | 1280×800 | 1265 / 1265 | No |
| Assist | 1024×768 | 1024×768 | 1009 / 1009 | No |

The Home-before image was captured from a disposable archive of the exact start
commit. It reported `rows="5"`. The final Home reported `rows="3"`.
The disposable server and extracted archive were deleted after capture.

## Continuity

1. Opened `check .mp4` in Assist.
2. Confirmed exactly one `<video>`.
3. Entered unsent text: `keep this unsent`.
4. Switched Assist → Studio → Assist.
5. Confirmed the text remained exact, the playhead remained at `0`, and exactly
   one video remained in every state.
6. Confirmed no dead empty Accept action and no Add text action before Point.

Automated `App.test.tsx` additionally proves the same video DOM identity and a
non-zero playback position survive both switches.

## Contextual Point and proposal flow

1. Entered Point mode.
2. Used the keyboard (`Enter`) to capture the active point cursor.
3. Confirmed **Add text here** appeared only after the valid target existed.
4. Created a `Santosh` nameplate proposal.
5. Confirmed one pending change with the non-color `○` marker.
6. Accepted it and confirmed `✓`, enabled Undo, enabled Export, and one video.
7. Undid after the save settled: the change disappeared and Redo enabled.
8. Redid after the undo settled: `✓` returned and Redo disabled.

## Disabled-action reasons

The empty accepted-history state exposed focusable disabled-action groups with:

- `Nothing to undo yet.`
- `Nothing to redo yet.`
- `Accept at least one edit before exporting.`

The focused tests also prove pending-proposal and rendering reasons, and prove
that the underlying disabled callbacks cannot fire.

## Accessibility

- one video at every required viewport;
- zero unlabeled buttons in the measured Assist state;
- zero unlabeled inputs in the measured Assist state;
- Point capture completed by keyboard;
- disabled reasons are associated through `aria-describedby`;
- native buttons remain genuinely disabled;
- pending and accepted statuses use explicit text plus non-color markers.

## Motion

- control duration: `160ms`;
- panel duration token: `200ms`;
- pressed scale: `0.98`;
- Home focus movement: 1px with negligible scale;
- reduced-motion rules remove transforms and transition motion;
- the test machine did not currently request reduced motion, so that browser
  preference was not falsely reported as active.

## Console and network

- browser console warnings/errors: **0**;
- failed image elements: **0**;
- video: `readyState=4`, no media error;
- the in-app browser exposed no resource-timing entries for this localhost tab,
  so no unsupported claim is made about per-request status from that surface;
- the visible project, media playback readiness, Accept, Undo, and Redo HTTP
  paths all completed.

## Result

The P0-D.1 browser acceptance path passed. Owner visual approval remains
required for `UX-005`.
