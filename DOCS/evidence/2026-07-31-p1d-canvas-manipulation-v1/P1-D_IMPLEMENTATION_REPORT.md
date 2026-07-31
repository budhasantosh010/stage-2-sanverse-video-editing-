# P1-D — Canvas Direct Manipulation V1

Date: 2026-07-31  
Branch: `agent/g6-g8-local-alpha`  
Start commit: `7994b4a230ab271727b118a0ddf08a0286f8cc31`  
End commit: this verified P1-D completion commit

## Result

P1-D is technically complete. Timeline, Canvas, and Inspector use one selected item and one detached visual draft. Pointer movement changes only local preview state. A completed gesture builds one existing `set-visual-properties` operation, crosses the existing App/server revision fence, and creates one Undo step. Cancellation creates no operation. Pending proposal movement updates existing repair state and does not advance the accepted project revision.

No project schema, operation family, API route, persistence format, project model, history, proposal store, playhead, or runtime dependency was added. P1-E was not started.

## Direct manipulation delivered

- exact Canvas hit targets and selection box;
- move with Shift axis constraint;
- one-pixel and Shift ten-pixel keyboard nudge;
- uniform corner resize and Alt/Option centre resize;
- rotation with cardinal and Shift fifteen-degree snapping;
- crop mode for media overlays;
- frame-centre, frame-edge, and safe-area snapping with visible guides;
- shared Inspector values during detached movement;
- dirty-Inspector refusal instead of overwriting a draft;
- animated-property refusal instead of flattening keyframes;
- server-refusal rollback;
- Point-mode precedence;
- reduced-motion and narrow-screen safety;
- truthful unsupported-target messages and no fake handles.

## Blocking defects found and repaired

1. **UX-010 — collapsed Studio preview.** The Timeline reserved 390–405px while the preview row could shrink to zero. A bounded stage now keeps footage readable and uses `object-fit: contain`.
2. **FAIL-030 — stale post-upload revision.** Immediate B-roll placement used the revision from before asset intake. The operation now uses the authoritative project returned by the upload.
3. **FAIL-031 — crop export failure.** FFmpeg crop arithmetic used the planned box after contain scaling had rounded the real image. Crop now derives from actual `iw`/`ih`.
4. **INFRA-005 — API test filesystem contention.** Server lifecycle tests now use an in-memory job store while the dedicated filesystem contract continues to test durability. Production storage is unchanged.

The non-blocking `UX-011` label mismatch is recorded and deferred.

## Real browser evidence

A fresh Microsoft Edge workflow used `resources/test video/test-30s.mp4` plus a real still frame extracted from that media. It completed title move/snap/Undo/Redo/nudge/resize/rotate, callout move/resize, image move/resize/crop/Undo/Redo, proposal repair/reject/accept, Point precedence, reduced motion, export, and MP4 download.

- page errors: 0;
- console errors: 0;
- failed HTTP responses: 0;
- video elements: 1;
- Timeline lanes: 5;
- no document-width overflow at 1440×900, 1280×800, 1024×768, or 390×844;
- native control-strip hit testing reached the `<video>` element.

## Final gates

- Web: 48 files, 442/442 tests passed.
- Edit domain: 23 files, 265/265 passed.
- API: 20 files, 235/235 passed.
- Render contract: 5 files, 51/51 passed.
- Intent domain: 3 files, 27/27 passed.
- All-workspace production build: passed.

Final web bundle: 155 modules; CSS 69.04 kB raw / 12.39 kB gzip; JS 489.05 kB raw / 135.73 kB gzip. P1-C was 140 modules; CSS 63.89/11.40; JS 463.68/128.38. P1-D adds 15 modules, 5.15 kB raw CSS, 0.99 kB gzip CSS, 25.37 kB raw JS, and 7.35 kB gzip JS. No runtime dependency was added.

## Remaining truth

- `FAIL-021` remains monitoring.
- `INFRA-005` remains monitoring for real Windows filesystem contention, although broad test isolation is repaired.
- `FEATURE-001`, `FEATURE-002`, and `UX-009` remain planned.
- `UX-011` remains planned for P1-E.
- Owner visual/interaction review remains a human gate.
- P1-E Media Bin was not started.
