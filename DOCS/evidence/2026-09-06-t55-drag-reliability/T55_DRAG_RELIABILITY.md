# T5.5 — Timeline drag reliability repair
Date: 2026-09-06
Branch: `timeline-t55-editor-confidence`
Base: `be50d9dbf316d3207954402452d7156d471549bf`
Status: IMPLEMENTED AND FOCUSED-TESTED; confidence gate remains OPEN.
Scope: existing timeline interactions and density only. No Motion Graphics, MCP, new domain operation, project model, renderer, or second editor authority.

## Implemented checklist
- [x] Add bounded two-axis edge autoscroll with frame-time-based speed; cancel scrolling on release, Escape, capture loss and unmount.
- [x] Reject release outside the visible scroll port; use the actual pointerup position, not the last valid pointermove.
- [x] Separate the audio name/grab strip from waveform and gain hit areas.
- [x] Make gain dragging relative to the initial gain; clicks and horizontal movement do not change gain.
- [x] Keep Edit/Effects/Color/Audio beside Assist/Studio; show Studio tabs only in Studio.
- [x] Move workspace/reset/dock controls into the Inspector's Workspace disclosure.
- [x] Keep timeline controls compact and use native top-layer popovers to avoid clipped menus.
- [x] Hide the selection-triggered animation target row inside Controls; retain explicit animation access.
- [x] Preserve the pointer's grab offset; dragging no longer seeks the playhead.
- [x] Move primary video and its linked dialogue together from either row, including a lone clip and empty-space placement.
- [x] Preserve existing gapless-sequence reorder through the existing typed operation.
- [x] Preview supported/refused destinations and commit once on release through existing change sets.
- [x] Keep the moving presentation until asynchronous acceptance finishes.
- [x] Preserve same-track multi-selection routing, revision checks, locks and pending/export guards.
- [x] Permit music/B-roll time plus compatible-track assignment in one change set; scope collision checks to destination track.
- [x] Correct the Result-object compatibility check that accidentally accepted an incompatible track.
- [x] Draw dark real audio peaks on pale lanes; aggregate peaks by visible pixel to preserve transients.
- [x] Memoize per-lane decoration inputs rather than recreating them on every drag move.
- [x] Update the saved-change label after generic accepted change sets.
- [x] Keep one video/playhead/history/preview/export authority.

## Latest continuation evidence (supersedes earlier candidate totals)

### September 7 restart and export-feedback closure

Restarted the existing timeline app/API on 2010/2011 and OpenCut on 2012 without reinstalling dependencies or importing media again. OpenCut's initial navigation timed out while compiling; the same tab subsequently loaded its saved three-track project, so no duplicate tab/import was needed.

Fixed export feedback hidden behind collapsed AI: a non-idle export reveals the existing AI panel, scrolls to export feedback and focuses ready/error feedback, without persisting a new workspace preset or creating another editor session. The new regression failed before the fix; affected StudioWorkspaceIntegration 7/7 and App 13/13 passed after it (20 tests, overlapping the App tests below; not a new full-suite run). Final web build PASS: CSS 145.14 kB / gzip 24.42; JS 999.95 kB / gzip 276.69.

Actual resumed browser project was already at revision 22, not the earlier revision 20; it was preserved without Undo/Redo or timeline edits. In Studio with AI collapsed, Export opened the existing AI region and showed waiting progress, then **Export ready / 1920 × 1080 / 34s / Download MP4** visibly in the final screenshot. One video element remained; save status stayed at change 22. Final captured warning/error log was empty. DOM/screenshot evidence is in task tool history; no claim of a newly recorded interaction video or downloaded-file hash comparison.

Earlier revision-20 artifact: `.sanverse-data/projects/project_e58e4bb1e9f088fa38801efbeb52b83b/exports/export_c86185ff0699474315bf3be269d306f6.mp4`, 14,791,904 bytes, H.264 1920×1080 plus AAC, 34.466667 seconds; full FFmpeg decode exited 0. This earlier decode is distinct from the September 7 revision-22 browser completion.

- [x] Export progress/result reachable when AI starts collapsed (FAIL-073).
- [x] Servers restored and saved comparison projects reopened without reimport.

Final five directly affected files: **77/77 PASS** (Timeline 30, geometry 4, decorations 23, audio controls 7, App 13). Red-first regressions reproduced outside-release commits and horizontal gain edits before fixes. Production web build PASS: CSS 145.14 kB / gzip 24.42; JS 999.87 kB / gzip 276.67. Relative to the earlier candidate below: +0.35 kB CSS and +2.09 kB JS, not an original-HEAD baseline. Existing font-URL and large-chunk warnings remain. Editor boundary PASS: 35 changed paths, no protected Motion paths/imports. Full repository suite and independent review were not repeated.

Live Sanverse: reopen test project at revision 17; drag the second dialogue clip by its name from x1000 to x1100. Both primary footage and dialogue move from 25.023s to 29.405s in revision 18, gain remains 0 dB, one video remains. Undo at revision 19 restores 25.023s; Redo at revision 20 restores 29.405s. Earlier live outside drop from the video row to above the timeline left revision 15 unchanged. This is actual UI evidence, not just mocked API tests. Edge-scroll math/lifecycle implementation is tested, but sustained edge-hold visual proof remains open.

The audio hit-area defect was found in the live UI: a drag through the old name strip changed gain to 3.4 dB instead of moving the clip (revision 16). Undo restored it before the final corrected walkthrough. The root cause was the gain line crossing the name strip plus absolute-Y gain mapping, not an audio rendering defect.

## Live OpenCut comparison

Local **OpenCut classic**, commit `cf5e79e919144200294fb9fed22a222592a0aeea`, port 2012. This is the installed archived web codebase, not a claim about the latest OpenCut rewrite. Project `c5d3f71b-a496-49a0-8c75-518f1c53e931`; same `test-30s.mp4` imported through UI. The upload tool took 564 seconds despite a 30-second requested timeout; that is tooling wait time, not a measured editor import benchmark.

- Asset drag did not insert in the browser automation attempt; the asset's plus button did. Do not report that first drag as successful.
- Scrub to 00:00:05:03, use the scissors button: two clip sections appear.
- Drag the second section sideways: it moves with a gap while the playhead stays at 5:03.
- Drag it vertically beyond its row: OpenCut creates a Video track and transfers the same section. Undo removes that new track/move; Redo restores it.
- Right-click > Extract audio creates a separate audio clip with a visible waveform. Dragging the audio by its name moves it independently of the video.
- Screenshots were visually inspected in tool history. OpenCut exposes a smaller track-header area and a clean name strip above waveform bars. Sanverse retains the requested richer track controls and monochrome styling.

**Decisive remaining difference:** OpenCut allows the main footage to become a clip on another video layer and allows extracted audio to move independently. Sanverse's primary/dialogue model explicitly refuses primary cross-track transfer. Making a ghost appear on V2 would not make preview/export support it. No such cosmetic workaround was implemented.

These dev-server sessions are NOT a controlled performance benchmark: OpenCut has React Scan development instrumentation, compilation warm-up and a local webpack compatibility change; viewports/zoom differed. No latency ratio, frame-perfect full recording, or subjective parity claim is justified. CapCut/DaVinci recordings were inspected as full-duration 5-second contact sheets plus dense 8-fps gesture samples, not every frame.

OpenCut startup needed: app-local Next 16.1.3, bundled example environment, Windows long-path esbuild executable and async WebAssembly enabled in webpack. A reusable `start-comparison.ps1` lives inside its competitor checkout; no OpenCut source was copied outside that folder. See INFRA-010 for failures and attempts.

## Earlier focused machine evidence (historical candidate)
Initial final run: 134 passed, 1 failed across 9 files. The failure was an App test looking for the relocated 'Advanced direct controls' text. Updated it to the accessible 'Advanced timeline controls' label.
Final affected App rerun: 13/13 passed. Other eight files: 122/122 passed in the preceding run. Thus all 135 focused tests have passed after their final relevant changes; this is NOT a claim that the full repository suite was rerun.
Files: App, EditorShell, StudioWorkspaceIntegration, Timeline, TimelineDecorations, TimelineAudioDirectControls, timeline-body-drag-plan, timeline-track-controls, timeline-item-operations.
Earlier jsdom pointer-capture errors were fixed by the supported optional capture check and rerun without uncaught errors.
All-workspace production build: PASS.
Final web assets: CSS 144.79 kB (gzip 24.34); JS 997.78 kB (gzip 275.93).
Previous intermediate candidate JS 989.73 kB; final +8.05 kB. This is an intermediate-candidate comparison, not an exact original-HEAD baseline.
Existing build warnings: runtime font URL resolution and JS chunk >500 kB; not expanded into renderer/bundle work.
Editor ownership boundary against the base: PASS, 26 changed implementation paths inspected, zero protected Motion paths/imports.
git diff --check: PASS; Windows LF/CRLF warnings only.
Independent review: NOT COMPLETED (review agent usage failure earlier in this continuation). No claim of independent approval.

## Actual browser editing walkthrough
Dedicated local app: http://localhost:2010 ; API 2011; isolated .sanverse-data.
Ports 2000/2001 and the Motion/MCP worktree were not displaced.
Disposable project: project_e58e4bb1e9f088fa38801efbeb52b83b, source test-30s.mp4.

1. Import/open the real 30-second source using Home.
2. Drag dialogue +2 seconds: both footage and dialogue move, playhead unchanged, one revision.
3. Drag footage back to zero: paired movement preserved.
4. Click at 5.010727 seconds and Ctrl+B: real split into approximately 5.011 and 25.023 seconds.
5. Drag the first section across the second: order becomes 25.023 then 5.011 seconds.
6. Undo restores original order; Redo restores reordered result (revision 6).
7. Reopen after server/session restart: saved revision 6 and both sections persist.
8. Drag primary footage up to V2: visible refusal explains the linked-track restriction; revision stays 6.
9. Use the selected Trim end handle's Left key: remove one frame, paired duration changes to 24.989 seconds; revision 7. Normal trim leaves the intentional 0.033-second gap.
10. Export revision 7 through the actual Export button: 'Rendering your MP4' then 'Export ready / 1920 x 1080 / 30s / Download MP4'.
11. Invoke Download MP4. Browser emitted no error, but its downloaded filesystem destination is not exposed/verified; do not claim downloaded/server hash equivalence.
12. Start playback, switch Studio to Assist, type an unsent draft, switch back: one video remains, playback advances from 0.525 to 3.129 seconds without pausing, draft survives.
13. Pause and leave the app in Studio.

Console: zero captured warning/error entries in the final tab. This is not an exhaustive network trace.
Visual inspection: compact header/Inspector workspace controls, unchanged timeline position after selection, and clearly visible dark waveform. Screenshot outputs are in this task's tool history. getScreenshot produced a cropped/DPR artifact; fullPage screenshot gave a usable normal-layout view.
Exact responsive-size proof is NOT complete: requested 1280x800 browser override reported actual DOM viewport 1910x1194. Override was reset. Do not label that screenshot '1280x800 verified'.
Fresh extra-audio UI upload was attempted twice via filechooser before clicking its labelled input; both chooser waits timed out. No new audio asset was imported through that test. The compatible-track compound operation is covered by the pure accepted-domain test, NOT by a completed fresh browser music drag.

## Real exported media
File: .sanverse-data/projects/project_e58e4bb1e9f088fa38801efbeb52b83b/exports/export_da803f209c79dd5b8827d4ce085995ca.mp4
Size: 14,776,550 bytes.
SHA-256: 74dc3432763993c33deed2a3d1c20cfd603d4b74f72350411fc30ae7e63ac5f3
ffprobe: H.264 1920x1080 30 fps; AAC stereo 48 kHz; container duration 30.066667 seconds.
FFmpeg decoded the complete video/audio to null with exit 0 and no errors.
This proves a real final media artifact, not exact frame/sample alignment at every edit or subjective audio quality.

## Remaining acceptance checklist
- [ ] Owner same-task 15–20-minute OpenCut/Sanverse confidence comparison.
- [ ] Primary footage/dialogue transfer to arbitrary tracks: currently explicit refusal, not implemented.
- [ ] Fresh real-browser music/B-roll two-axis drag after successful upload.
- [ ] Sustained edge-hold browser proof for the implemented bounded edge autoscroll.
- [x] Release outside all lanes cancels without an edit, including stale last-move coordinates.
- [ ] Full matching pointer-motion recording and exact responsive screenshots, using a browser backend with reliable viewport/filechooser support.
- [ ] Independent review when available.
- [ ] Exact exported-frame comparison at edit boundaries; decode/metadata alone does not establish it.

Do not tick T5.5 closed, begin Motion integration, or claim CapCut/OpenCut parity from these focused checks.
Local Git only: no push, merge, or remote update in this repair. No local commit was created before the incomplete independent review.
