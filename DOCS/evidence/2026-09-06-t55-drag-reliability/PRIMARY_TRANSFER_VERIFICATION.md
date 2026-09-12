# Primary transfer and source timing — September 7

Latest resumed verification: FAIL-080 RESOLVED. Focused Vitest 10/10 PASS; web TypeScript/Vite build PASS, JS 1,003.35 kB/gzip 277.80, CSS 145.14/gzip 24.42. Real pointer drag on V2 landed at 14.378s instead of falsely colliding with V1 at 28.412s. Split 41, reorder 42, Undo 43, Redo 44; matching linked-audio timing, title follows its source to 17.700s, one video element. Final Undo 45/46 removed only this test's reorder/split, restoring original clip/title timings. Captured warnings/errors empty. Screenshot output remains distorted, so smoothness/frame-rate and competitor-parity are NOT established. INFRA-016 recovered without configuration changes. Earlier blocked statements below are historical; complete exact workflow is FAIL-080 in FAILURE_REGISTRY.md.

September 8 later continuation: FAIL-080 valid reorder falsely refused against another track. Existing pure planner now resolves gapless reorder before checking raw pointer collisions. Standalone real-domain RED/GREEN, literal collision refusal, one revision and exact Undo/Redo verified in reorder-smoke.ts. Normal Vitest worker collection timed out twice (INFRA-016); do not claim a passing Vitest suite or new browser gesture for this change. No overlap/audio extraction feature was enabled.

Latest September 8 checkpoint: see the follow-up section at the end of this report. Title UI/export proof and opening-gap playback are now verified. Production build PASS (JS 1,003.36 kB/gzip 277.80), focused suites 45/45 and extended integration 8/8. Earlier browser-blocked statements are historical.

## Later follow-up: authored visual ordering

The earlier blanket authored-visual restriction below is superseded by FAIL-077. Same/higher-track titles, nameplates and B-roll are now permitted; lower-track visuals underneath higher primary footage remain refused. Two domain RED failures plus one planner RED proved the defect. Final domain 568/568, planner 9/9, compiler/transfer 6/6 and all-workspace build PASS. Compiler tests compare exact segment and overlay nodes for title/nameplate/B-roll before and after same-track transfer. Final JS 1,002.74 kB/gzip 277.60. Real browser verification of this follow-up is BLOCKED by INFRA-014: webview attachment timed out in hidden and visible modes, despite app HTTP 200. The earlier real browser/export evidence below does not establish this newer visual-order path. Next resume there; do not restart old completed tests.

Scope: T5.5 timeline confidence, local worktree timeline-t55-editor-confidence at base be50d9d. No Motion integration, new editor authority, remote push or competitor-parity claim.

## Verified fixes

- Existing typed move-primary-clip accepts an optional stable destination video track. Clip identity, source range and linked audio remain unchanged. The old operation form remains valid.
- Accepted track/composition operations replay transactionally; missing/audio destination, deleting an occupied track, cross-layer primary overlap and unsupported authored-visual mixing fail closed.
- FAIL-074: preview now reads the owning track output rather than hard-coded V1.
- FAIL-075: dragging linked sound into a video row is refused rather than moving its picture to that layer.
- FAIL-076: preview source intervals and mapping use domain speed/reverse timing instead of assuming 1x.

## Focused automated evidence

These are separate runs, not an invented combined full-suite total:

| Check | Result |
|---|---|
| Domain suite during candidate continuation | 567/567 |
| Render-contract suite during continuation | 142/142 |
| Source/transfer/planner after audio routing fix | 22/22 |
| Four new retiming regressions before fix | 4 expected failures, 11 existing passes |
| Source/transfer/preview-invariant/segment-playback after timing fix | 57/57 |
| All-workspace production build after transfer | PASS |
| Final web production build after timing fix | PASS |

Final bundle: JS 1,002.34 kB (gzip 277.50), CSS 145.14 kB (gzip 24.42). Before this slice: JS 999.95 kB from the earlier verified repair. Existing >500 kB chunk and runtime font URL warnings remain nonblocking; no claim of bundle optimization.

## Actual browser workflow

Used saved test-30s.mp4 project project_e58e4bb1e9f088fa38801efbeb52b83b at localhost:2010. No raw-media upload to a third party.

1. V1 picture dragged vertically to V2 at unchanged start/duration: revision 23. Dialogue stayed on A1.
2. Undo at 24 restored V1; Redo at 25 restored V2.
3. At approximately 4.39s, hiding V1 retained the V2 picture; hiding V2 correctly displayed track-off (26/27). Restored outputs at 28/29.
4. Export at 29 reused the previous matching artifact because only track allocation changed; this was NOT counted as a fresh render.
5. Dragged V2 footage sideways from 0 to 1.678s: revision 30. Its A1 dialogue moved to the same start; the V1 clip remained at 29.405s.
6. Export via the real header button showed Rendering, then ready/Download MP4 at unchanged revision 30. A new artifact was created and fully decoded.
7. Applied 0.5x to the final V1 clip: revision 31, duration 5.011s → 10.021s. Scrubbing to 36.318s showed footage at source 3.456s instead of a false gap. Undid this speed test afterwards.

One video element remained in checked states. Captured warning/error log was empty. This is not an exhaustive network trace. Browser screenshots failed with Unable to capture screenshot; current visual screenshot/recording evidence is therefore incomplete, and tool round-trip time must not be called UI frame latency. See INFRA-013 and INFRA-007.

## New rendered artifact

- File: .sanverse-data/projects/project_e58e4bb1e9f088fa38801efbeb52b83b/exports/export_f5921db65bd973985248d3b14d3ad67f.mp4
- Size: 14,813,036 bytes.
- SHA-256: 3ff53fce559dbd11197d9f9facefefd5b75ab9bb3052f4d783f087ede1adc2a0.
- ffprobe: 34.500000s, H.264 1920×1080, AAC 48kHz.
- Complete video/audio decode to null: exit 0, no errors.
- transfer-export-frames.jpg shows frame 0 (expected initial black gap), frame 60 (V2 footage), frame 900 (later V1 footage). Visually inspected. This is representative frame evidence, not exact cut-boundary or subjective sound validation.

## Remaining — do not tick the entire confidence gate

- Arbitrary overlapping primary video layers and consistent ordering relative to authored visuals require a shared layered-composition implementation across preview and export. Current transfer deliberately refuses those combinations.
- Independent extracted dialogue track movement is not implemented by this transfer; linked sound remains linked.
- Sustained edge-hold and fresh music/B-roll two-axis browser proof remain open from the prior report.
- Matching interaction recordings, reliable responsive screenshots and owner same-task confidence comparison remain open. No CapCut/OpenCut/DaVinci parity claim.
- Existing independent-review gate remains uncompleted; no commit/push made in this slice.
# September 8 follow-up — real title export and opening-gap transport

- Reopened the existing owner test without resetting revision 37 or its additional video track. Added actual title `Timeline reliability check` at composition 5s for 3s above transferred V2 footage. Accepted 38, Undo 39, Redo 40.
- UI Export completed to `export_c91d80f74a0b92aa239a447306d9c5d8.mp4`: 33.500000s, 14,957,626 bytes, SHA256 `147266068E5968554F93D0E9485B01642AD4F58222D785E998412C1A196F3F94`. FFmpeg complete decode exited 0. Viewed actual frame at 6s: `title-transfer-export.jpg`; title is visible over the intended footage. This closes FAIL-077's pending title UI proof, not full arbitrary layer compositing.
- Found and fixed FAIL-078/079: empty opening mislabeled loading; Play attempted unloaded media. RED tests reproduced both. Monitor now reports canonical gap first; existing hole clock advances, pauses/restarts and hands playback to the source after metadata loads. Four affected files passed 45/45; extended integration clock/load test passed in final 8/8 integration run.
- Real browser after intentional reload: correct gap text at zero; Play traversed 1.678s gap into video readyState 4, paused=false, source loaded; one video remained and project revision stayed 40. Paused playback afterwards.
- INFRA-014 recovered. INFRA-015 tracks uncertain prior multi-tab interaction and stale HMR connection; did not undo unexplained owner state. BUILD-008 records corrected RTL option typing, with production build rerun required.
- Still OPEN: arbitrary primary overlaps/lower-layer interleaving, independently extracted dialogue, sustained edge-scroll gesture proof, remaining competitor-confidence/owner checks. No Motion integration, commit or push.
