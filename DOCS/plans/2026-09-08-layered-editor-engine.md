# Layered editor engine implementation plan

**Goal:** Close FAIL-069 with real overlapping footage and independent audio, preserving the canonical editor project, operations, revision history and preview/export agreement.

**Owner approval:** September 8, after the explicit request to replace the literal one-video-element restriction with synchronized decoding sources under one playback clock, the owner said: "yes approved".

**Architecture:** One EditorShell, project, revision, playhead, proposal, history and render-plan authority remain. Multiple muted video decoders are disposable rendering resources, not editor sessions or clocks. Audio remains owned by the existing composition audio mixer. Motion Program files remain read-only.

**Tech stack:** Existing TypeScript, browser HTMLVideoElement/canvas, Vitest and FFmpeg. No new dependency, package manager or provider. Work in timeline-t55-editor-confidence. September 12 owner explicitly authorized remote push, superseding the original local-only instruction.

Execution is local and sequential on the critical path, following the owner's instruction not to use unnecessary subagents. Rollback is the inverse of this scoped change, never resetting the dirty worktree.

## Acceptance and implementation sequence

- [x] Decoder lifecycle: create apps/web/src/features/render-plan/layer-video-decoder.ts and .test.ts. A bounded pool accepts composition-derived source times; loading retains only the newest seek; pause/dispose cancels playback; source replacement releases stale resources; rejected play is reported. Muted decoders never produce duplicate audio. September 9: 13/13 focused checks, including stale Play rejection, held frames and readiness callbacks.
  - RED: npx vitest run --root apps/web src/features/render-plan/layer-video-decoder.test.ts --pool=forks --poolOptions.forks.singleFork=true
  - GREEN: implement only the lifecycle specified by the failing tests; rerun the same file.
- [x] Shared layer contract/schedule: explicit stable track/node ordering and compatibility validation in the render contract/compiler; half-open boundaries, disabled-layer fall-through and retiming covered. September 12 final report records evidence.
- [x] Layered export: scoped FFmpeg compositor, synthetic pixel/frame checks and real revision-64 1080p export/full decode. Existing non-overlap path preserved.
- [x] Layered preview: dedicated bounded decoder/controller integrated into Studio under the existing editor playhead; focused lifecycle/Studio tests and real simultaneous pictures/playback verified. Performance/owner confidence stays a separate gate.
- [x] Cross-layer overlap refusal removed only after shared renderer implementation; same-track collisions, locks and revision guards remain. Actual pointer transfer and history observed; temporary test edits restored.
- [ ] Independent audio: introduce explicit typed extraction/link state and source identity; existing linked clips retain old behavior. Route independent moves/trims/gain through the same accepted operations/history and shared audio projection/export. No conversion of video assets into fake music assets.
- [ ] Real workflow: overlap footage, resize/crop top layer, hide/reveal top track, independently move extracted audio, split/trim, Undo/Redo, save/reopen, export, inspect resulting frames and sound. Restore only temporary test edits.
- [ ] Confidence closure: sustained edge scrolling, audio-body hit targets, waveform truth, same-task OpenCut comparison, and owner review. Automated tests do not establish subjective parity with OpenCut/CapCut/DaVinci.

## Release gate

Do not remove current overlap guards while only the decoder foundation exists. Do not advertise independent audio before it is represented and rendered correctly. A partial implementation is recorded as partial, not as a finished editor.

## Current checkpoint

**September 12 latest:** shared v10 manifest, FFmpeg compositor, live layered canvases and composition clock are integrated; transferred primary footage automatically selects v10, while the single-primary legacy path remains v9. Only cross-track overlap guards are released. Actual pointer move, lower/top simultaneous pictures, track hide/Undo, saved reopen and motion Undo/Redo observed. Same-track mixed-family stack order fixed after independent review. Final evidence: `DOCS/evidence/2026-09-12-layered-timeline-release.md`. Independent extracted dialogue and complete owner confidence remain OPEN. Older checkpoints below are historical.

September 10 reverse/selection continuation: reverse resource pool and React binding are now wired into Studio, with stable clip/source keys, bounded concurrency, cancellation and URL cleanup (FAIL-088). A real pending-seek-to-zero defect is repaired (FAIL-089), and selected linked audio now correctly focuses its Inspector without breaking drag groups (FAIL-090). Final focused regression 103/103; real reverse playback, Undo/Redo, exact mid-proxy seek, and dirty-Inspector confirmation verified. Original test content restored at saved change 58. Full layered picture presentation is STILL NOT wired/released, live compilation stays v9, and overlap guards remain. No Motion edits or push.

### Remaining critical path before Motion integration

- [x] Bounded video-decoder foundation and cancellation-safe reverse resources.
- [x] Reverse resource binding into existing Studio playback/audio and latest pending-seek restoration.
- [x] Linked audio click focus with dirty-Inspector protection.
- [x] Live layered canvas presentation with a shared composition clock and regression-tested stacking, gaps, speed/reverse/hold and transitions.
- [x] Real simultaneous-picture preview and layered export evidence; only cross-track overlap guards removed. This is not comprehensive visual fidelity certification.
- [ ] Typed independently extracted dialogue: move/trim/gain with correct history and preview/export audio.
- [ ] One continuous real-user workflow: trim, picture/timeline zoom, play/pause, slow/fast/reverse, drag both axes, split/delete, Undo/Redo, save/reopen and export; close sustained edge-hold and fresh audio-drag evidence.
- [ ] Matched OpenCut/CapCut-style editing session and owner acceptance. This certifies the agreed workflow, not full competitor feature parity.

No competitor-confidence percentage is currently measured. Test-pass percentage is not a completion or subjective-UX percentage. The requested basic controls largely exist; these unchecked integration and workflow gates are what prevent calling the editor dependable.

September 10 audio/clock follow-up: nine reproduced audio failure cases now pass (FAIL-085/086/087). Final focused run: 50/50 across six files, including Studio 9/9. Gap/held-frame RAF loops share one cancellable composition interval scheduler (5 checks); normal footage still uses the existing transport. This is NOT full layered Studio integration. Project remains saved at change 52; no content edits in this follow-up. Live compilation remains v9, overlap guards remain, independent extracted dialogue remains unimplemented. Next: layered Studio/clock and multi-reverse-resource integration, then enable overlap only with matching preview/export evidence; independent audio and final matched-user workflow follow. No Motion edits or remote push.

September 10 resume: FAIL-083 source-anchored speed/reverse/hold transform timing repaired in live preview, Inspector and FFmpeg; FAIL-084 reused-source end-of-clip loop repaired. Focused render checks 32/32, preview/decoder 29/29, Inspector/Studio 11/11, transport/Studio 25/25 (overlapping selections, not an additive full-suite total). Four real synthetic FFmpeg exports pass pixel/frame checks. Real UI motion 47, half-speed 48, Undo 49, Redo/reopen/export 50; original test edits restored and saved at 52. Actual MP4 38.500s, 1080p30 H.264/AAC stereo, 17,152,518 bytes, complete decode and 36s frame inspection PASS. API/web builds PASS; JS 1,005.71 kB/gzip 278.60; CSS unchanged. Boundary check PASS, 72 paths, no Motion edits. Layered browser resource controller exists (6 tests) but is NOT Studio-wired; live v9 and overlap guards remain. FAIL-069 and overall competitor-confidence gate stay OPEN. Next: simultaneous audio projection, one-clock layered Studio integration, independent audio, final real workflow. No commit/push.

September 9: decoder complete; opt-in v10 picture-layer manifest/compiler/scheduler implemented and contract-tested. Live compilation stays v9. Layered FFmpeg assembly proved with a real four-second synthetic export, all 120 frames decoded: lower footage shows around the scaled upper clip and outside its interval. Rendering regression 269/269; decoder 13/13; real render 1/1; API/contract/web builds pass. JS 1,005.25 kB/gzip 278.43; CSS 145.14/gzip 24.42. No overlap guards removed. Next: live preview integration, retimed/dynamic motion parity, independent audio, full real-user workflow and confidence closure. No Motion changes or push.
