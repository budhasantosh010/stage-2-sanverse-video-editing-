# Project Log

## 2026-09-14 — Remaining-confidence source decoration correction

- Reproduced four wrong-source-timing/direction cases; fixed shared media decoration projection, reversed waveform drawing and retimed filmstrip placement (FAIL-099).
- Focused decorations62/62, existing timeline32/32, sustained60-frame edge-hold/cancel1/1 passed in separate selections. Default timeout caused a test harness cascade; isolated runs with bounded deadlines passed unchanged assertions. New test fixture nullable duration corrected. Frontend production build/review/boundary PASS.
- Browser getTab and one fresh inventory call each timed out/reset; live comparison remains BLOCKED (INFRA-023). No project edits or new export. Published handoff lists exact recovery workflow and owner-only acceptance; no Motion change/parity claim.

## 2026-09-14 — Independent audio and bounded workflow release

- Implemented typed extraction preserving source identity and one shared editor/history/compiler/mixer. Added independent audio movement, trimming, splitting/deletion and Inspector routing through existing controls.
- Review found wrong-target fallback, long J/L fade invalidation and Inspector gaps; RED/GREEN fixes and final independent re-review passed. Domain572, contract154, web732 selections passed before final corrections; final focused web48/domain5 and actual FFmpeg1 passed. Final all-workspace build PASS; tests overlap, not additive.
- Browser revisions71–84 proved own-audio edits/history/reopen, half/double-speed and reverse playback, with real exports81/84; both full decodes passed. Eight UI Undos85–92 restored original content. Details/hashes and limitations are in evidence/2026-09-14-independent-audio-release.md.
- Registry and all resume entry points updated. Remaining sustained interaction/comparison and owner acceptance are explicitly open; no Motion changes or parity claim. Focused commit/push is owner-authorized.

## 2026-09-12 — Documentation-only next-agent handoff

- Owner asked whether high-impact work is finished and requested documentation/push. Answer: not all finished; independent audio and real-user confidence gates remain open.
- Consolidated completed work, implementation SHAs, successful/failed attempts, warnings, local-only evidence/media, restoration70, startup, rollback boundaries and ordered next work in HANDOFF.md.
- Corrected START_HERE/HANDOVER entry points and obsolete FAIL-094 open listing; older T5 checkpoints labeled historical. No feature implementation, project mutation, full test rerun or Motion change.

## 2026-09-12 — Focused loading synchronization and save feedback

- Reproduced two decoder failures before implementing a group readiness barrier. Ready layers now pause while a required sibling loads or corrects drift; stale play promises respect the barrier and disposal.
- Reproduced stale Inspector saved-change status and notified the existing save-state reducer only after accepted server persistence.
- Affected tests: 100/100; production web build PASS (JS 1,018.55 kB/gzip 283.83, +0.29/+0.11 versus pushed baseline); independent review PASS with one nonblocking deferred-play coverage suggestion. No dependencies or Motion changes.
- Previous approval/reviewer usage interruption recovered on resume. The ownership checker initially could not spawn Git in the restricted environment; the same scoped check passed with approved execution.
- Independent audio remains explicitly unimplemented. Do not confuse this follow-up with full FAIL-069 closure.

## 2026-09-12 — Layered timeline release candidate and requested push

- Connected bounded layered canvases to the canonical Studio clock and the shared preview/export layer manifest. Transferred footage now automatically selects v10; existing single-primary projects retain v9.
- Released only cross-track overlap refusal after domain/render checks and an actual overlapping pointer move; same-track collision validation stays. Existing accepted operations and Undo/Redo remain authoritative.
- Fixed initial empty-gap readiness and transition color/alpha fidelity; independent pre-push review found same-track overlay DOM order could diverge from export. A separate fix context changed stacking to explicit manifest order and added failing-then-passing regression tests.
- Owner explicitly requested GitHub push. No Motion files changed. Full editor confidence is not declared: independent extracted dialogue, sustained edge-hold evidence and owner acceptance remain open.
- Exact verification, real export, restoration and startup are recorded in `DOCS/evidence/2026-09-12-layered-timeline-release.md`.

## 2026-09-10 — Reverse resource binding, exact pending seeks and linked-audio focus

- Final build PASS: 310 modules; JS 1,008.05 kB / gzip 279.64 (+1.80 / +0.74 versus prior 1,006.25 / 278.90); CSS unchanged 145.14 / gzip 24.42. Known font-runtime and >500kB chunk warnings remain. Ownership boundary PASS on 82 paths, zero protected Motion changes/imports. Scoped diff check PASS with line-ending warnings.

- Studio now consumes bounded reverse resources by stable clip/source identity, with cancellation, URL cleanup and multiple prepared playback/audio sources. This completes a prerequisite, not live overlapping picture release.
- Browser exposed a pending reverse seek loading proxy zero. RED expected 7s after successive 5s/7s requests and received 0; corrected metadata bridge passes. Real composition tick 13,671,142 minus clip start 2,416,093 maps to 7.816006s; observed decoded proxy time matches, readyState 4.
- Temporary reverse accepted at 53, Undo 54, Redo 55, Undo 56; fresh-mount Redo 57 and final Undo 58 restored original content. Reverse playback and prepared resource replacement observed. No fresh export claimed in this preview/interaction-only batch.
- Expanded regression first returned 99/107: seven stale control-label expectations and one genuine linked-audio focus defect. Updated stable accessible queries and repaired pointer-down click suppression while preserving grouped drag. Final targeted suites: 103/103, including full StudioScreen, Studio workspace continuity, creator interactions, selection, reverse pool and hook. Result: .sanverse-data/reverse-and-selection-tests.json.
- Real pointer test: video selected, local -9dB draft, linked-dialogue click opens discard confirmation; discard switches Inspector to dialogue and keeps saved gain 0dB at revision 58. No draft was committed.
- Infrastructure: interrupted test handle was not treated as a result; server restarted hidden on 2010/2011, launcher PID 11740. Prior screenshot/DPR limitation persists. One captured Vite websocket error corresponds to the server interruption.
- Remaining critical path: live layered monitor/clock and preview/export parity; safe overlap release; independent extracted dialogue; sustained drag/edge evidence and matched complete editing workflow/owner review. No numerical competitor-confidence claim, no Motion edits, no commit/push.

## 2026-09-10 — Audio identity, seek lifecycle and shared interval clock

September 10 audio/clock follow-up: nine reproduced audio failure cases now pass (FAIL-085/086/087). Final focused run: 50/50 across six files, including Studio 9/9. Gap/held-frame RAF loops share one cancellable composition interval scheduler (5 checks); normal footage still uses the existing transport. This is NOT full layered Studio integration. Project remains saved at change 52; no content edits in this follow-up. Live compilation remains v9, overlap guards remain, independent extracted dialogue remains unimplemented. Next: layered Studio/clock and multi-reverse-resource integration, then enable overlap only with matching preview/export evidence; independent audio and final matched-user workflow follow. No Motion edits or remote push.

- RED/GREEN: five audio projection defects, two resource lifecycle defects, accidental master mute and missing Play resume. The first clock run lacked its module; an interface stub established behavioral failures before implementation. Clock cases cover elapsed-time rather than frame-count progression, exact end clamp, stale callbacks, reentrant intervals and cancellation at a boundary.
- Final production web build PASS after correcting test-only unsupported exact query options. 308 modules; JS 1,006.25 kB / gzip 278.90 (+0.54 / +0.30 versus the previous 1,005.71 / 278.60 checkpoint); CSS unchanged 145.14 / gzip 24.42. Existing runtime-font and >500 kB chunk warnings remain. Ownership boundary PASS, 77 paths, zero Motion edits/imports; diff whitespace check PASS with existing CRLF warnings.
- UI reopened unchanged project at 52 and showed default Mute instead of unintended Unmute; Play entered Pause through the opening gap. No new export needed for this preview-only batch; the earlier verified revision-50 MP4 remains the latest export evidence.
- Percentage statement: this batch repairs 9/9 explicitly reproduced audio failures in automated checks (100% of this bounded list), NOT 100% of all audio behavior or timeline readiness. No credible OpenCut/CapCut/DaVinci equivalence percentage exists yet.
- Remaining release gates: live layered preview and synchronized reverse preparation; matching overlap preview/export and removal of only cross-track guards; independent extracted dialogue; fresh two-axis additional-audio drag and sustained edge-hold evidence; matching recorded user workflow and owner acceptance. Infrastructure screenshot/filechooser/review limitations remain separately recorded.

## 2026-09-10 — Retimed picture fidelity and real playback-loop repair

- September 10 resume: FAIL-083 source-anchored speed/reverse/hold transform timing repaired in live preview, Inspector and FFmpeg; FAIL-084 reused-source end-of-clip loop repaired. Focused render checks 32/32, preview/decoder 29/29, Inspector/Studio 11/11, transport/Studio 25/25 (overlapping selections, not an additive full-suite total). Four real synthetic FFmpeg exports pass pixel/frame checks. Real UI motion 47, half-speed 48, Undo 49, Redo/reopen/export 50; original test edits restored and saved at 52. Actual MP4 38.500s, 1080p30 H.264/AAC stereo, 17,152,518 bytes, complete decode and 36s frame inspection PASS. API/web builds PASS; JS 1,005.71 kB/gzip 278.60; CSS unchanged. Boundary check PASS, 72 paths, no Motion edits. Layered browser resource controller exists (6 tests) but is NOT Studio-wired; live v9 and overlap guards remain. FAIL-069 and overall competitor-confidence gate stay OPEN. Next: simultaneous audio projection, one-clock layered Studio integration, independent audio, final real workflow. No commit/push.
- Real UI export: .sanverse-data/projects/project_e58e4bb1e9f088fa38801efbeb52b83b/exports/export_cf1533ceddc7a4a87343ef2bc35a51f7.mp4; SHA-256 4cbe8e1ca648127fdd2a9e2829266345a1bf045348ac10b80dbb686d5ec244cb. Inspected .sanverse-data/layer-engine-checks/real-revision50-at36s.png. Container is about 67 ms longer than the tick duration, within the existing 100 ms adapter tolerance; no frame-exact container-duration claim.
- Synthetic exports and pixel evidence: .sanverse-data/layer-engine-checks/{render-atuqHA,reverse-boundary-oKBaGy,fast-animation-5xuByY,held-animation-imprMg}/. Generated artifacts remain ignored and local.
- INFRA-017: standalone root-checkout Vite occupied 2010 without API. Verified process identity, stopped only that process and restored the worktree pair on 2010/2011. New-session cleanup stopped the child server once more; restarted it. Browser data-URL error page could not be reattached; a fresh normal localhost tab recovered. No security setting changed.
- Browser screenshot still distorted/cropped (INFRA-007), so it is not evidence of full-page layout quality or subjective smoothness. Historical console has one pre-restart Vite WebSocket error; no fresh runtime failure observed in the completed edit/export path. Ownership check first omitted --base, then sandbox Git spawn failed; normal approved scoped run passed.

## 2026-09-09 — Approved layered engine, still behind the release gate

- Decoder pool: 13/13 focused checks. Resources stay muted; seeks coalesce; holds stay paused; stale Play promises cannot poison a later intent; release removes listeners and sources.
- Opt-in v10 pictureLayers contract/compiler/scheduler and ordered FFmpeg surface composition implemented. Default live compilation remains v9. No primary-overlap guard removed.
- 269/269 render/contract regressions pass. Real FFmpeg test renders 4 seconds / 120 frames at 160x90: blue upper footage scaled over red lower footage, transparent surrounding space, correct layer start/end. All frames decoded; representative PNG visually inspected. Evidence: .sanverse-data/layer-engine-checks/render-F69BrK/{layered.mp4,evidence.json,overlap.png}.
- Layered preview resource controller: 6/6 focused tests, 19/19 with decoder tests. It owns no clock or project state. Readiness preflight prevents partial-moment painting and black seek flashes. Missing media and unprepared reverse have explicit states.
- Corrected verification-only faults: fixture fractional ticks, widened fixture discriminants and widened mocked status. No production assertion weakened. Existing Vite font-runtime and large-chunk warnings remain.
- API/contract builds pass; final preview-controller web build passed at JS 1,005.25 kB/gzip 278.43, CSS 145.14/gzip 24.42. Superseded by the verified next checkpoint above.
- OPEN: Studio transport/overlay-stack integration, retimed/keyframed motion parity, independent dialogue extraction, real drag/Undo/Redo/reopen/export, sustained edge hold and owner competitor-confidence gate. Motion untouched; original project not mutated; no commit/push.

## 2026-09-08 — Safe reorder collision correction

- September 8 drag follow-up COMPLETE: FAIL-080 RESOLVED. Focused Vitest 10/10 and web production build PASS; JS 1,003.35 kB/gzip 277.80, CSS 145.14/gzip 24.42. Real pointer drag reordered V2 safely at revision 42; Undo 43 and Redo 44 verified linked audio and source-anchored title continuity, with V1 unchanged and one video element. Temporary reorder/split undone at 45/46, restoring the owner's original clip/title timings. Captured warnings/errors empty; screenshot distortion remains INFRA-007, so no smoothness/parity claim. INFRA-016 recovered. Next: shared overlapping-primary preview/export semantics and independent extracted dialogue (FAIL-069); sustained edge-hold proof and owner confidence remain open. No Motion changes, commit or push.
- Source diff is limited to collision-check ordering in timeline-body-drag-plan.ts, with matching Vitest regression and standalone evidence script. No saved user project mutated during this follow-up. Preserve earlier dirty work; no commit or push.

## 2026-09-08 — Title transfer proof and opening-gap repair

- September 8 current checkpoint: FAIL-077 title-over-transferred-footage UI proof is complete (accept 38, Undo 39, Redo 40, fresh MP4/full decode and inspected frame). FAIL-078/079 opening-gap labeling and Play transport repaired with RED/GREEN proof; affected suites 45/45, extended integration 8/8, all-workspace production build PASS. JS 1,003.36 kB/gzip 277.80; CSS unchanged 145.14/gzip 24.42. Browser now plays through the opening gap into footage at unchanged revision 40 with one video. INFRA-014 recovered; uncertain prior multi-tab revision/HMR is INFRA-015 MONITORING. Next critical path: true overlapping primary layers and independently extracted dialogue (FAIL-069), then remaining live drag/edge-scroll and owner-confidence gates. Do not claim OpenCut/CapCut/DaVinci parity. Dedicated server 2010/2011; no Motion changes, commit or push.
- Scoped files: monitor-base-layer.ts/test, StudioScreen.tsx and StudioWorkspaceIntegration.test.tsx. Existing timeline/domain/renderer authority preserved. Rollback is only this focused diff, never a worktree reset.
- Actual title export: 33.5s, 14,957,626 bytes; full decode exit 0 and 6s frame inspected. Detailed hash, artifact and reproduction in PRIMARY_TRANSFER_VERIFICATION.md and FAILURE_REGISTRY.md.

## 2026-09-07 — Retiming closure and shared visual-order guard

- FAIL-076: four expected RED failures fixed by reusing domain duration and source-time conversion. Affected preview/invariant/playback 57/57 pass; real 0.5x UI extended the last clip to 10.021s and showed source at 36.318s correctly. Test speed change undone afterwards.
- Revision-30 transferred-and-moved footage exported to export_f5921db65bd973985248d3b14d3ad67f.mp4: 14,813,036 bytes, 34.5s, 1080p H.264/AAC, full decode PASS; representative 0/2/30s frames inspected. Evidence in PRIMARY_TRANSFER_VERIFICATION.md.
- Layer audit found FAIL-077: blanket title/B-roll refusal but missing lower-nameplate guard. Two domain and one planner RED cases reproduced it; one shared accepted-track-order rule now permits same/higher visuals and rejects unsupported lower layering. Domain 568/568, planner 9/9, render-node parity 6/6, all-workspace build PASS.
- Browser follow-up blocked: hidden and visible webview attachment both timed out, inventory stayed empty, while app GET returned 200. Logged INFRA-014; do not claim final visual-order UI proof. No remote changes or commit.

## 2026-09-07 — Primary transfer resumed and real-browser proof

- Fresh approval permitted the parked candidate to resume. Two preview/output regression failures fixed by looking up the accepted owning track; three compiler/preview cases pass. Audio-to-video routing RED caught a mistaken item-kind guard; linkedClipId guard fixes it. Related 22/22 focused tests pass.
- All-workspace production build passed: JS 1,002.37 kB (gzip 277.49), CSS 145.14 kB (gzip 24.42). Existing large-chunk and runtime-font warnings remain, not new blockers.
- Real V1→V2 drag preserved picture identity/timing and A1 sound at revision 23. Undo 24 restored V1; Redo 25 restored V2. At 4.39s hide V1 retained picture; hide V2 correctly showed track-off. Restored both at revisions 28/29 and started export through the UI.
- Browser transport timeout after successful actions is INFRA-013; inspect state before retrying. Session interruption required server restart; no project reset. Current export proof and retiming-source regressions remain in progress.
- No Motion lane changes, no remote push, no full-parity claim.

## 2026-09-07 — Primary transfer candidate, verification blocked

- Traced vertical refusal through typed move, composition replay, track state and sequential FFmpeg layout. Built a bounded non-overlapping transfer candidate preserving clip identity and linked dialogue.
- Corrected an initially stale test-fixture revision, reverted candidate to verify true RED (unknown transfer operation field), then passed transfer/Undo/Redo and safety regressions. Caught required-versus-optional operation-key regression before the final 567/567 domain and 7/7 planner passes.
- Read-only trace found primary-source.ts still checks V1 output for clips on other tracks. Added destination-output preview/compiler regressions; their execution was blocked by automatic approval-service usage exhaustion, not by Vitest.
- Parked source and tests in PENDING_PRIMARY_TRANSFER.txt and restored only this attempt's live-source changes. Existing earlier repairs are untouched. No real transferred-video export or production build claimed, no commit/push.
- Candidate restrictions (no overlapping primary layers; no authored overlay mixing after transfer) are not full parity and must not be represented as such. Next work must close preview/output and shared layer composition instead of stacking UI-only workarounds.

## 2026-09-07 — Restart and close export-feedback defect

- Restarted timeline 2010/2011 and OpenCut 2012; reopened saved projects without installs or media imports.
- Confirmed final export-visibility repair in the actual Studio UI: collapsed AI opened on Export, progress became visible, followed by ready/Download MP4. Existing revision 22 and one video preserved; no timeline edits performed.
- Prior focused integration/App rerun 20/20 and final production build passed; recorded FAIL-073 RESOLVED and final bundle in Sep6 drag report. No redundant full-suite test.
- OpenCut initial navigation timed out during compilation, then the same tab loaded the saved three-track comparison; no restart/reimport loop.
- T5.5 remains OPEN for primary-track transfer and explicitly outstanding confidence evidence. No Motion work, commit or push.

## 2026-09-06 — Resume, live OpenCut comparison, audio grab fix

- Resumed the existing worktree after usage interruptions; restarted only 2010/2011 and competitor 2012. Imported OpenCut media persisted and was reused.
- Added bounded two-axis edge scrolling and correct outside-pointerup cancellation. Fixed audio name/gain overlap found by real dragging; relative gain keeps clicks/horizontal gestures unchanged.
- Five affected files pass 77 tests; web build and protected-lane check pass. Real paired audio drag, Undo/Redo and revision-20 34.47s H.264/AAC export/full decode pass.
- Live local OpenCut classic: split, horizontal gap move, vertical transfer creating a track, Undo/Redo, Extract audio, independent audio movement. Its development instrumentation/viewport differences prevent comparative latency claims.
- Recorded Windows/compiler/WASM startup failures and reusable competitor-local startup; filechooser call took 564 seconds, not a measured editor benchmark.
- Found export feedback hidden behind collapsed AI; focused fix/continuity test in progress. Main-footage arbitrary track transfer and confidence acceptance remain open. Full details in Sep6 drag report; no push.

## 2026-09-06 — T5.5 linked drag and waveform reliability

- Fixed grab-offset/playhead jumps, linked dialogue drag, compatible-track validation and collision scoping, and saved-revision status; retained existing operations and one editor authority.
- Moved workspace tabs beside the mode toggle, workspace controls into Inspector, and selected animation controls into closed Controls; real waveform uses dark pixel-bucket peaks.
- Focused final evidence: 122 related tests plus 13 App tests after its relocated-selector correction; all-workspace build and ownership check PASS.
- Real browser: paired drag both directions, split/reorder/Undo/Redo/reopen, invalid vertical refusal without revision, one-frame trim, playback/draft continuity, and successful revision-7 H.264/AAC export/full decode.
- Extra audio filechooser timed out; exact viewport override mismatched DOM dimensions; independent review unavailable. No invented passes. Primary track transfer and edge-autoscroll remain open.
- Correcting the earlier causal interpretation: unequal recording luma-difference statistics do not measure input latency or prove excess relayout.
- Full evidence and remaining checklist: `DOCS/evidence/2026-09-06-t55-drag-reliability/T55_DRAG_RELIABILITY.md`. Local-only; no push or confidence-gate closure.

## 2026-09-04 — T5.5 frame-by-frame OpenCut confidence convergence

- Decoded the owner's complete 59.7-second OpenCut and 47.4-second Sanverse recordings and analysed 1,421/1,183 bottom-Timeline frames, plus full-session and dense transition contact sheets.
- The comparable Timeline crop showed directionally higher Sanverse visual volatility: 2.4× mean frame difference and 56% more frames above 1.0 per second. The recordings locate the problem in permanent control density and interface re-layout, not missing Timeline operations.
- Froze feature growth at a bounded OpenCut-level contract. Sanverse's richer operations remain available, but no new Timeline capability is justified before owner confidence acceptance.
- Moved precision playback, track creation and legacy specialist controls behind the one existing advanced disclosure before tracks. Replaced four permanent placement-policy buttons with one compact accessible selector while preserving all four policies.
- Focused Timeline hierarchy/control suites pass **37/37** and the all-workspace production build passes. Live Studio proves the disclosure is closed by default and the selector changes modes without creating project history.
- T5.5 remains open only for the owner's 15–20 minute same-task comparison. Motion Graphics remains untouched and must not be integrated until that acceptance.

## 2026-09-03 — T5.5 live confidence repair after owner rejection

- Kept work on the dedicated `timeline-t55-editor-confidence` branch and inside the existing Timeline selection/gesture authorities; no T6/T7, Motion Graphics, renderer, domain-operation or project-model work was started.
- Found that ports 2000/2001 were initially serving an unrelated `external-mcp-raw-video-v1` worktree, stopped only those stale listeners, and relaunched this branch before accepting any browser evidence.
- Reproduced and repaired three real confidence failures: the first pointer press on main footage could be swallowed by late filmstrip/waveform rendering; linked footage/dialogue made ordinary Delete take the multi-item overlay route and do nothing; boundary reorders remained visibly enabled despite having no legal result.
- Preserved one Timeline selection, one proposal/history authority and the existing typed operation path. The fix interprets the automatic footage/dialogue pair as one user choice and derives reorder availability from the canonical primary sequence.
- Focused Timeline verification passes **22/22** and the web production build passes. A correct-branch browser walkthrough on isolated real 30-second media proved first-press selection, split, valid move earlier/later, delete-with-gap, Undo and Redo. Console inspection found no runtime error.
- Continued the same bounded gate with direct primary-footage reordering for gapless sequences. Pointer movement remains detached presentation state until release, then compiles through the existing gesture adapter and `reorder-clip` operation as one project/history change.
- Reduced default Timeline friction by collapsing detailed zoom controls behind a named disclosure and moving selected-item actions directly below the main toolbar, ahead of precision controls and track rows.
- Focused adapter/edit/Timeline/decorations/creator suites pass **100/100** and the all-workspace production build passes. Live pointer drag reversed the two real-media sections at change 12; visible Undo and Redo restored and reapplied the exact order at changes 13/14.
- This focused pass does not claim OpenCut parity or replace the earlier full 2,510-test regression. T5.5 still requires the owner's unscripted same-task comparison. The branch remains local-only and unpushed by contract.

## 2026-08-11 — T5.5 Editor Confidence machine/browser implementation

- Inserted T5.5 before T6 on dedicated Editor branch `timeline-t55-editor-confidence`, based exactly on verified T5 `a89483deea214927bf44b6d82229ca6ffa72650c`; T6/T7 remain not started.
- Found a real confidence defect during the interaction audit: Razor was visibly enabled but clips never read the active tool, so the promised click-to-cut route was dead. Razor now selects the acted item and routes the exact pointer time through the existing split authority.
- Added a safe two-stage Escape policy, visible active-tool language/cursors, stronger primary vs secondary selection, selected-track lane/header context, outside trim hit geometry, drag stacking, named snap feedback, synchronized internal Timeline vertical scrolling, sticky ruler/header behavior, and actionable empty-row copy.
- Standardized owned Inspector editorial/visual numeric editing through one shared primitive and made dirty form state visibly say `Changes not applied yet.` while retaining the existing safe multi-field Apply/Reset transaction and dirty-selection reconciliation.
- Audited the existing Editor-owned Canvas and retained its selection bounds, handles, guides, one-video authority, keyboard nudging, Escape cancellation and detached draft/commit behavior instead of creating duplicate Preview/Motion systems.
- Focused Timeline/Inspector/Canvas matrix passes 59/59; Timeline confidence suite passes 19/19; exact full inventory passes API 405, web 1,374, edit-domain 562, intent-domain 27, render-contract 142 — **2,510/2,510 total**. All-workspace production build passes.
- The first complete regression attempt saw one existing T4 animation pointer-release test fail once; the exact six-test T4 suite passed immediately and the second complete regression passed. No T4 production code was changed; the flake is recorded in T5.5 evidence.
- Real Edge 151 on the real 30-second T5 Editor source proved real Razor/select/Escape, explicit Inspector draft/reset semantics, sustained one-video playback, 1440/1280/1024/390 no-overflow continuity, zero runtime/console/HTTP/loading failures, and real Export ready.
- Revision-2 export probes as 1280×720 H.264 30 fps + AAC stereo 48 kHz, 30.000000 s, 16,174,169 bytes. Downloaded/server SHA-256 match at `27689ec436ed1a28d04a64fd22592851a4aca683dbe616d47becd62ff221da0a`.
- T5.5 is deliberately not marked `[verified]`: the owner’s unscripted edit and same-task OpenCut confidence score are still required. Automated tests cannot satisfy that criterion.
- Per owner instruction, keep the T5.5 branch/commits local only for now because GitHub CI/CD minutes are exhausted; do not push until the owner explicitly re-authorizes it after the reset.
- Motion and Plan-B ownership remain protected.

## 2026-08-03 — P1-F.1A Gate B: Media Library V2 Essentials complete

- Media organization is a **server-owned sidecar**, `media-organization.json` beside the project, never in `EditProject` and never in the browser. Rejected localStorage (per-browser, silently cleared, invisible to the server) and rejected `EditProject` (Undo would step through folder renames, and moving the revision would move the export key so a rename would re-encode an identical MP4 for 60–90 s). Decision: `DOCS/decisions/ADR-MEDIA-ORGANIZATION-V1.md`.
- A folder is a label, not a container: deleting one returns its media to the top level and can never delete media. One level only, max 32 folders, names unique after trimming and case-folding.
- Five typed validated commands (create / rename / move-to-folder / move-to-root / delete) are the only way to change it, so a future AI calls exactly what the buttons call. Unknown shapes are refused, never repaired; a corrupt file is refused with its bytes left on disk so folders can be recovered.
- Refactored the hardened project-file reader into `readControlledProjectFile` / `writeControlledProjectFile` so project state and organization share ONE symlink, hard-link and file-identity check.
- Media panel rebuilt as MediaHeader / MediaSearchAndFilter / MediaResults with **only the results region scrolling**, compact density (28–32 px controls, 48–60 px rows, 40–48 px thumbnails, 12 px filenames), Import by kind with truthful accept filters behind one hidden input, operating-system file drop with per-file refusals, four sort fields in both directions with stable ties, and a filter that never renders five squeezed buttons.
- Presentation state (search, filter, sort, folder, selection) moved OUT of the panel to the Studio screen, because the panel is unmounted on every workspace switch and state held inside it vanishes silently.
- `sanverse.media-drag/v1` closed payload built and tested but **deliberately switched off** (`MEDIA_DRAG_ENABLED = false`): assetId, mediaKind, sourceDurationTicks only — no path, no URL, no object URL, no project or asset object. Gate C flips one boolean.
- Real browser on real video, image and audio: the project came out **byte-identical** (revision 4→4, changeSets 0→0, assets 5→5, same sha256) after create → duplicate refusal → rename → move in → move out → delete, and the filing survived a full page reload. Zero console errors, zero failed HTTP calls, zero object URLs in the panel.
- Suites: web 631, edit-domain 312, api 248, render-contract 65, intent-domain 27 — 1,283 total (Gate A baseline 1,203, floor 1,176). All-workspace build passes. No assertion weakened.
- Found and recorded but NOT fixed, because this gate fixes only Gate B blockers: FAIL-047 (resizing past 1100 px strands the user with no Media or Inspector until reload) and FAIL-048 (imported file names are forgotten on reload).
- Gate C, Gate D and P1-F.2 were not started.
- No screenshots exist for Gate B: the browser pane was not displayed, so layout is proved by measured DOM geometry and appearance is not proved.

## 2026-08-01 — P1-F.0.1 Studio Workspaces and Docking V1 complete

- Added accessible Studio-only Edit, Effects, Color, and Audio workspace views over the existing single editor, project, history, playhead, Timeline, selection, Canvas/Inspector draft, video, AI conversation, proposal, preview, and export authorities.
- Added a closed `sanverse.workspace-layout/v1` local presentation contract with strict validation, viewport clamps, fail-closed recovery, Edit/Motion/Timeline/Review/AI/Audio presets, reset, collapsible docks, and bounded pointer/keyboard splitters with Escape cancellation.
- Kept Tool and AI permanently mounted so hidden AI drafts and proposal state survive Assist/Studio, workspace, and dock switching; proposed Timeline items now reveal their authoritative Tool/Inspector actions.
- Reused only existing capabilities: Edit uses Media/Inspector, Effects uses current motion/visual effects, Color states unsupported primary-video grading truthfully, and Audio uses existing V1/A1/A2 controls without pretending waveforms, EQ, compression, mixing, or cleanup exist.
- Real Edge completed all workspaces, Tool/AI continuity, every preset, all splitters, dock collapse/reset, Point precedence, 1440×900 / 1024×768 / 390×844 responsive checks, export, and Home cleanup. One video and the AI draft survived; revision stayed 15→15; horizontal overflow and page/console/HTTP errors were zero.
- Export probe: H.264 High 1920×1080 at 30 fps, AAC-LC stereo 48 kHz, 18.033333 seconds, 10,789,990 bytes, SHA-256 `176c85e64e8c44dc99cb8f65e4ccb5a5a221ac96da045d5f178ec8971eb59451`.
- Final suites pass API 239/239, web 515/515, edit-domain 299/299, render-contract 65/65, intent-domain 27/27 — 1,145/1,145 total; all-workspace build passes.
- P1-F.1 and P1-F.2 were not started.

## 2026-08-01 — P1-F.0 Primary-Footage Motion V1 complete

- Added one stable, source-anchored `set-footage-motion` identity with full-state position, uniform scale, rotation, crop, and bounded keyframe/easing repairs.
- Preserved deterministic motion across split, trim, remove, gap, reorder, repeated placements, Undo, Redo, and selective deactivation without attaching state to temporary clip IDs.
- Raised the render plan to v6, compiled motion onto surviving source segments, and made browser Canvas plus FFmpeg expressions consume one shared source-time evaluator.
- Added Motion Inspector presets/numeric controls/keyframes/Apply/Reset/Remove, a V1 Timeline Motion indicator, and direct primary-footage Canvas move/scale/rotate/crop with detached movement, one release commit, Escape cancellation, and Point precedence.
- Kept exactly one native video and native controls; removed the false legacy overlay-Canvas unsupported message for video selection.
- Real Edge found and resolved `FAIL-034` invalid empty-filter syntax, `FAIL-035` unnecessary GEQ/rotation export cost, and `UX-014` misleading Canvas copy.
- Final Edge loop completed static motion, Canvas repair, Undo/Redo, Point, animated zoom, split/Undo/Redo, real export, tablet/mobile, and cleanup with zero page/console/HTTP errors.
- Probed export: 1920×1080 H.264 High, 30 fps, 901 frames, AAC-LC stereo 48 kHz, 30.033008 seconds, 17,261,471 bytes; render completed in 53.3 seconds and start/middle/end frames were inspected.
- Final suites pass API 239/239, web 484/484, edit-domain 299/299, render-contract 65/65, intent-domain 27/27; all-workspace build passes.
- P1-F.1 and P1-F.2 were not started.

## 2026-08-01 — P1-E.1 Studio Vertical Flow complete

- Replaced the desktop Studio's fixed `calc(100vh - 64px)` height and hidden overflow with natural document flow and two normal-height grid rows.
- Made the browser document the single outer vertical-scroll authority; Media, Inspector, and AI retain bounded internal scrolling without blocking scroll chaining.
- Kept the P1-D contained preview size, native controls, Timeline horizontal scroll/zoom, one shared selection/draft, one main video, and the existing single video `ResizeObserver`.
- Added one passive document-scroll refresh to the existing Studio geometry controller and removed it on unmount; page scrolling creates no operation, revision, project rebuild, or second geometry authority.
- Real Edge proved full Timeline reachability and no horizontal overflow at 1440×900, 1280×800, 1024×768, and 390×844. Playhead, selection, zoom, horizontal scroll, accepted revision, Canvas alignment, Point placement, and playback remained correct.
- Browser result: zero page errors, zero console errors, zero failed HTTP responses, one video, five lanes, and zero listener/video leak after returning Home.
- Final suites pass: web 476/476, edit-domain 265/265, API 235/235, render-contract 51/51, intent-domain 27/27; all-workspace build passes.
- `UX-013` is resolved. P1-F was not started in this change.

## 2026-07-31 — P1-E Media Bin V1 complete

- Added one immutable Media Bin view model over the accepted project with import, search, All/Video/Images/Audio/Missing filters, usage, source status, keyboard navigation, right-click/Shift+F10 actions, and responsive layouts.
- Centralized asset display names in one pure helper shared by Media, Timeline, Canvas, and Inspector, resolving `UX-011` without component-specific patches.
- Kept project/revision in App/server, accepted history in project change sets, editor selection in Studio, media selection presentation-only, and source probing App-owned with four-request concurrency.
- Reused existing `add-media-overlay`, `add-music`, and `set-music` operations; import remains outside Undo history and placement Undo/Redo retains imported assets.
- Real Edge used a talking-head MP4, image, secondary MP4, and WAV; completed Canvas image manipulation, B-roll, music repair, Undo/Redo, filters, keyboard/context menus, missing-source failure/restoration, export/download, frame/audio inspection, and cleanup with zero unexpected browser/HTTP errors.
- Final suites pass: web 473/473, edit-domain 265/265, API 235/235, render-contract 51/51, intent-domain 27/27; all-workspace build passes.
- Unused asset deletion remains deferred as `FEATURE-003`; `FAIL-021` and `INFRA-005` remain monitoring.
- P1-F was not started.

## 2026-07-31 — P1-D Canvas Direct Manipulation V1 complete

- Added one Canvas interaction layer driven by the existing Timeline selection and the Inspector's shared detached visual draft.
- Delivered move, Shift constraint, keyboard nudge, uniform/centre resize, rotation, crop, frame/safe snapping, proposal repair, Point precedence, and truthful unsupported states.
- Repaired `UX-010` collapsed preview, `FAIL-030` stale post-upload revision, and `FAIL-031` FFmpeg crop/export parity.
- Real Edge completed title/callout/image manipulation, Undo/Redo, proposal reject/accept, Point mode, export/download, responsive checks, and frame inspection with zero browser/HTTP errors and one video.
- Final suites pass: web 442/442, edit-domain 265/265, API 235/235, render-contract 51/51, intent-domain 27/27; all-workspace build passes.
- Recorded `UX-011` as open and assigned it to P1-E; no P1-E implementation was started.
- P1-E was not started.

## 2026-07-30 — P1-B.1 repository-wide test truth restored

- Resolved `FAIL-024` by registering three genuine contract suites with Vitest
  while preserving every existing assertion.
- Resolved `FAIL-025` by testing the current durable export lifecycle: 202 queued
  acceptance, bounded job polling, terminal success/result or safe failure/error,
  and successful ranged media access.
- Resolved `FAIL-026` by atomically changing the signed number input, verifying
  the displayed `-24`, and proving the repair callback receives `gainDb: -24`.
- Changed only tests and authority/evidence documents; no product source,
  dependency, schema, route, renderer, timeline, proposal, or history behavior.
- Full suites pass: web 332/332, edit-domain 265/265, API 233/233,
  render-contract 51/51, intent-domain 27/27, Timeline/Studio 79/79; the complete
  build produces the identical P1-B bundle.
- `FAIL-021` remains monitoring, `FEATURE-001` remains planned, and P1-C was not
  started.

## 2026-07-30 — P1-B Production Timeline V1 complete

- Replaced the old one-row proportional strip with a five-lane Studio timeline
  driven only by P1-A's immutable `TimelineViewModel`.
- Added one shared playhead, ruler, click/drag seek, zoom, Fit, horizontal scroll,
  visible-range overscan, stable selection, gaps, hidden/blocked states, and
  detached proposal ghosts.
- Connected split, trim, ripple/non-ripple removal, reorder, enable/disable, and
  audio gestures through the existing P1-A adapter and server-authoritative
  change-set path.
- Added deterministic boundary snapping with a visible guide, exact trim preview,
  a right-click/Shift+F10 menu, Delete focus safety, and keyboard playhead steps.
- Real Edge visual QA found and fixed desktop lane clipping, proposal-sheet
  interception, clipped trim feedback, hidden export readiness, compact-label
  problems, action/context-menu overflow, and favicon console noise.
- Fresh real-media walkthrough completed split, Undo, Redo, context menu, snap,
  trim, Undo, proposal ghost/reject, export, and MP4 download with zero page,
  console, or HTTP errors and clean 1440/1024/390 geometry.
- Focused timeline/Studio tests pass 79/79; affected domain tests pass 77/77;
  the all-workspace production build passes. Broad unrelated test-contract drift
  is recorded in the evidence and failure registry rather than hidden.
- P1-C was not started.

## 2026-07-30 — P1-A timeline presentation foundation complete

- Owner approved P0-E from commit `d48aabf34fdadbd6899807fa0c6de0c854a5dc5f`; resolved `UX-007`.
- Added a pure immutable timeline contract and deterministic projection from one authoritative `EditProject`.
- Added semantic overlay, per-domain-video, caption, dialogue, and music lanes; derived gaps; detached proposed items; and blocked/unsupported diagnostics.
- Reused one domain evaluation, folded caption/overlay helpers, and authoritative source-span placement; no second editor or replay engine was created.
- Added bounded pure viewport zoom/scroll math and a gesture adapter that returns existing validated operations without applying them.
- Proved 71/71 focused web tests, 77/77 affected domain tests, a representative 50-video/100-caption/20-overlay/1-music fixture, unchanged P0-E bundle sizes, and a passing all-workspace build.
- No production React/CSS/UI, schema, persistence, renderer, or P1-B work was started.

## 2026-07-29 — G6/G8 executable technical batch complete

- Completed G6-11 deterministic seek-boundary, easing, reduced-motion, and
  shared preview/export evaluator contracts.
- Completed G8-03 durable export jobs with revision snapshots, idempotency,
  progress, cancellation, results/errors, restart recovery, and diagnostics.
- Completed G8-04 content-addressed portable archives with closed-schema,
  compatibility, integrity, and matching-media restore gates.
- Completed G8-07 protected retention: only controlled exports are deletable.
- Completed G8-08 code/keyboard accessibility audit with skip links, live/focus
  semantics, reduced motion, and 44-pixel repair targets.
- Completed G8-09 corrupt/malicious media and recovery matrix; new direct
  contracts passed 5/5.
- Completed G8-10: four fixed encoder threads reduced the representative
  10-second encode from 33.090s to 13.917s, a 2.38x speedup.
- API build and web application TypeScript check passed. The managed environment
  still blocks Vitest/Vite worker creation with the recorded FAIL-011.
- Only owner/external-evidence G8 gates remain; G9 entry is not bypassed.

## 2026-07-29 — Second batch in progress: transitions, adapters, compatibility, local trust

- Completed G6-07 with a bounded adjacent-clip dip-to-black, explicit audio
  policy, exact preview opacity, render-plan v5 ramps, and FFmpeg filters.
- Completed G6-10 by isolating every written overlay on a transparent layer
  before applying shared transforms/effects; a real 90-frame callout fixture
  rendered successfully.
- Completed G7-10 with a v1 saved-project migration/reopen fixture that retains
  the exact component/style, words, point, and anchor.
- Confirmed G8-02 atomic autosave/recovery at the existing repository/service
  boundary and recorded its exact limits.
- Completed G8-06 safe local diagnostics at `GET /api/diagnostics`.
- Completed G8-05 as a measured no-proxy/no-cache decision; first-time CPU
  encoding, not repeated identical reads, is the observed bottleneck.
- Historical note: G6-11, G8-03, and G8-04 were open at this point; the later
  batch above completed them.

## 2026-07-29 — Ten-task batch: renderer evidence and compound components

- Completed G6-08 bounded basic effects and G6-09 measured renderer
  re-evaluation. The existing browser CSS/native FFmpeg hybrid remains selected.
- Added browser visual-property consumption for every overlay family and native
  FFmpeg visual-property consumption for media overlays.
- Produced a real 1280x720, 30 fps, 240-frame native export and focused
  exact-clock, reduced-motion, and normalized-translation evidence.
- Did not falsely close G6-07: visual enter/exit transitions are not the
  required adjacent/overlapping clip video/audio transition primitive.
- Did not falsely close G6-10/G6-11: written-overlay FFmpeg layering and full
  extracted-frame fidelity remain.
- Completed G7-02 through G7-09: exact component compatibility, five immutable
  recipes, idempotent/fail-closed migration, four workflow registry entries,
  atomic multi-action planning, dependency checks, detached compound preview,
  targeted action repair, and one-approval/one-Undo proof.
- Relevant edit-domain, web, and API TypeScript boundaries pass. Focused direct
  contracts and the real FFmpeg fixture pass.

## 2026-07-29 — Ten-task batch: G5B completion and G6 motion foundation

- Completed Studio controls for G5B-04 trim, G5B-05 remove-with-gap, G5B-07
  reorder, and G5B-09 clip loudness/fades behind one disclosure.
- Completed G5B-13 using real 30000/1001 audio, VFR audio, and three-frame
  silent fixtures; conformed outputs retained the expected duration, rate,
  frame count, and audio policy.
- Accepted ADR-008 and created the owner-pending G6 motion-quality rubric.
- Completed G6-02 through G6-06 at the domain/compiler boundary: transforms,
  crop/layer/masks, project-clock keyframes, cubic-Bezier easing, spring, and
  bounce.
- Raised the renderer-neutral plan to v4 and bound visual state to exact
  concrete overlay nodes after cuts.
- Focused direct RED/GREEN contracts passed. Edit-domain, render-contract, web,
  and API TypeScript boundaries pass.
- Browser/FFmpeg motion is not claimed; it remains G6-09/G6-10.

## 2026-07-29 — G5C-07 direct repair completed in code

- Added full-state `set-title`, `set-callout`, `set-media-overlay`, and
  `set-music` operations with closed validation.
- Added deterministic folding so repairs update one existing overlay family
  without creating duplicate render nodes.
- Preserved one repair as one history entry and one Undo.
- Changed the canonical render compiler to consume folded overlay state.
- Added one progressively disclosed adjustment panel for all four families.
- Focused direct domain/render contract passed; edit-domain, render-contract,
  and web TypeScript checks passed.
- Vitest and Vite packaging remain blocked inside the managed environment by
  existing FAIL-011 (`spawn EPERM`); not debugged again.
- Real browser click-through was not run and is not claimed.

## 2026-07-27 — G4-B tasks 01–09: the first AI-proposed edit, on a fake provider

- Added `@sanverse/intent-domain`: a closed request shape, an untrusted candidate
  shape with exactly four states, six bounded clarification fields, and the
  evaluation contract. 27 tests.
- Added the API intent boundary: the provider port (which returns `unknown` on
  purpose), a deterministic fake provider that misbehaves deliberately, the
  outbound data allowlist, and the fixed 13-step intent service.
- Added `POST /api/projects/:id/intents`. It never changes the project. It
  returns a pending proposal that must be accepted through the ordinary
  change-set route, so "AI proposes, code executes" is structural.
- Replaced the disabled chat placeholder with a working conversation panel, and
  added by-hand repair of a pending proposal that never re-asks the provider.
- Accepted AI edits are recorded with `source: "ai"` and their request ID, and
  labelled "Suggested by the assistant" on screen — including after repair.
- Added an 18-case prompt corpus asserting product behaviour, run on every test
  run. 0 of 8 adversarial cases produced a change set.
- Fixed an owner-reported problem: pressing Export looked like it did nothing,
  because the result was below the fold. It now scrolls into view and takes
  focus.
- Verified in a real browser on the owner's own video: clarification, proposal,
  repair, accept, on-disk provenance, and a real exported MP4 with the nameplate
  present at 2 s and gone at 6 s.
- 413 tests pass; all workspace builds clean.
- Decisions: `DOCS/adr/ADR-004-ai-proposes-code-executes.md`.
- Evidence: `DOCS/evidence/2026-07-27-g4b-first-ai-edit.md`.
- **Not done:** G4B-10, connecting a real provider. No data has ever left the
  machine.

## 2026-07-27 — G4-A built and verified: scale-ready chassis and one render contract

- Implemented `sanverse.project/v2` end to end, plus `@sanverse/render-contract`
  consumed by both the browser preview and the FFmpeg exporter.
- Migrated the owner's real 2026-07-25 v1 projects losslessly; migrated
  nameplates keep `top-left` so nothing moved in an already-approved video.
- Two defects were found by running the real browser, not by tests:
  `requestVideoFrameCallback` fired zero times so the preview silently showed
  nothing, and preview and export were offset by exactly the padding.
- Known open gap: the drawn plate is ~10 px shorter vertically in the export.
  Position is identical.
- Decisions: ADR-002, ADR-003. Evidence:
  `DOCS/evidence/2026-07-27-g4a-real-media.md`.

## 2026-07-27 — Complete macro and micro planning set drafted

- Added the proposed canonical macro roadmap, dependency graph, goal entry/exit gates, and first- through fourth-order consequence analysis.
- Added one tickable checklist spanning completed foundations, G4-A through G12, continuous quality tracks, and macro completion.
- Added the atomic G4-A implementation plan and detailed later-goal micro plans.
- Added cross-cutting creative-quality, real-user, real-media, fidelity, security, accessibility, migration, performance, observability, recovery, and evidence plans.
- Reconciled goal, current-state, plan-index, and start documents so planning is not misreported as implementation or approval.
- Preserved older plans as historical evidence.
- Product implementation changed: **none**.
- Approval state: **proposed; owner review required before implementation**.

## 2026-07-12 — G0 initiated

- Owner approved starting Stage 2 as a separate production-grade project.
- Clarified that “production SaaS infrastructure now” means sound code architecture and evolution boundaries, not implementing all operational SaaS features immediately.
- Confirmed the owner is the first real tester and the product must reduce editing from hours to minutes.
- Confirmed black-and-white minimal branding inspired by the cleanliness of OpenDesign.
- Audited the prior anti-drift template and selected only lightweight, deterministic safeguards for the initial baseline.
- Wrote the macro goal, requirements, decisions, goal map, interface principles, risks, and G1 plan.
- Product implementation remains intentionally unstarted until the G0 verification and owner gate close.

## 2026-07-12 — G0 closed and G1 authorized

- Owner created `budhasantosh010/stage-2-sanverse-video-editing-` and authorized direct Git/PowerShell access.
- Verified SSH access and inspected the GitHub initial commit before changing remote history.
- Preserved GitHub's placeholder initial commit using a non-destructive merge and pushed the verified G0 baseline.
- Remote baseline after merge: `751911f` on `main`.
- Owner explicitly instructed work to continue, satisfying the G1 entry gate.
- Active work is now limited to the interface workflow/wireframe and renderer feasibility spike defined in the approved G1 plan.

## 2026-07-12 — G1 first-edit design drafted

- Defined the first nameplate-edit job story around completing one edit in under a minute without editor terminology.
- Mapped empty, importing, ready, selecting, clarification, proposal, preview, accepted, undo/export, and recoverable-failure states.
- Produced and visually verified a black-and-white Studio wireframe.
- Preserved canvas-first interaction, plain-language proposal details, preview-before-acceptance, and a simple moment strip.
- G1-01 remains in progress until the owner reviews the workflow; no product behavior has been implemented.

## 2026-07-12 — Owner corrected the entry experience

- Owner clarified that the existing Studio wireframe is Screen 2, not the first-arrival experience.
- Screen 1 must use OpenDesign-like progressive disclosure: a calm Home centered on chat/upload, drag-and-drop entry, and recent projects.
- Editing tools, canvas, proposal/history panel, and time strip appear only after the user supplies or opens a video project.
- Updated the durable requirement, interface decision, active G1 plan, flow, and state model before continuing visual work.
- Created and visually checked a separate Home wireframe; preserved the original editing workspace as Screen 2.

## 2026-07-12 — Renderer Track B began with FFmpeg-native candidate

- Owner approved the Home and Studio designs and instructed work to continue.
- Verified local Python, pytest, Node, Chrome, FFmpeg, ffprobe, drawtext, and overlay capabilities.
- Primary-source research identified HyperFrames as OpenDesign's current HTML/Chromium video path; it remains a candidate, not a decision.
- Implemented a renderer-neutral static-nameplate spike contract with fail-closed bounds and timing.
- Completed eight RED/GREEN cycles including a real FFmpeg render, ffprobe validation, CLI report, and repeat-mode hash comparison.
- After independent-review fixes, three fresh FFmpeg-native runs produced the same output SHA-256; average edit render was 0.7155 seconds for the five-second synthetic fixture.
- Product capability remains E0; this is isolated renderer evidence only.
## 2026-07-12 — HyperFrames candidate prepared without package execution

- Pinned and statically inspected hyperframes@0.7.54; no package code was executed.
- Verified explicit telemetry, update-check, auto-install, and browser-path controls in the distributed CLI.
- Added a local-only composition adapter through RED/GREEN TDD; 9 focused tests and all 34 renderer tests pass.
- Generated the static-nameplate HTML and visually sanity-checked it using the existing system Chrome.
- This proves only project-owned HTML generation and layout. HyperFrames runtime behavior and MP4 rendering remain unverified pending explicit owner approval for third-party npm execution.

## 2026-07-12 — Owner prioritized runnable web validation

- Owner clarified that Stage 2 will be a web application.
- Owner reserved localhost port 2000 because ports 3000, 5000, and 8000 are already used on the laptop.
- Startup must fail visibly if port 2000 is occupied rather than silently choosing another port.
- Owner asked to test how the application looks, works, and feels before HyperFrames work continues.
- AOCS Omega Type 2/depth 1 analysis identified the missing runnable user loop as the current highest-impact bottleneck.
- Renderer evidence remains preserved; HyperFrames runtime and hybrid evaluation are paused, not discarded.

## 2026-07-12 — Runnable Home-to-Studio shell reached the owner review gate

- Implemented the browser-only React/TypeScript/Vite shell on strict local port 2000 with typed screen state and local MP4 object-URL handling.
- Added a calm Home, real browser video preview in Studio, a visible draft-not-executed state, disabled unavailable actions, recoverable media errors, Back cleanup, and a responsive grayscale visual system.
- Verified 46 of 46 automated tests, the production build, HTTP 200 at `127.0.0.1:2000`, and an accessible live Home at 1280 by 720 with a uniquely labeled controlled prompt.
- Verified a second server exits with status 1 and displays `Error: Port 2000 is already in use`.
- The browser-control surface could not attach a local file to the native file input. No full manual browser Studio walkthrough was performed by the agent.
- Fixed the governance verifier to scan Git-tracked and untracked non-ignored project files instead of recursively entering ignored dependencies and build output; a regression test proves both sides of that boundary.
- G1-01B remains in progress. The owner must still choose a real MP4, check playback and workflow, and record feedback before the E4 owner gate can close.
- No backend, upload, persistence, AI, real editing, render, or export exists.

## 2026-07-13 — First owner real-video review rejected the initial polish

- The owner successfully opened Home, selected a real MP4, reached Studio, and previewed the video.
- Owner-measured defects: the Home question was too large; button, upload, and screen changes felt like abrupt cuts; and Studio could not be used to point at the video or request an actual edit.
- AOCS Omega classified the next product bottleneck as closing one trustworthy edit loop, not attaching an AI provider to a disabled shell.
- Frontend comparison found only conceptual similarity to OpenDesign. The previous shell lacked its proportionate hierarchy, soft product surfaces, and continuous interaction feel.
- Added a shared restrained motion system, browser-native Home/Studio transitions with fail-safe and reduced-motion fallbacks, softer surfaces, and a smaller Home heading through RED/GREEN tests.
- Independent review found an asynchronous view-transition race that could reopen a revoked first video after a rapid second selection. Deferred-callback regression tests now prove stale transitions cannot commit, and transition-start failures fall back to a direct update.
- AI keys remain intentionally unnecessary until a deterministic edit proposal can be validated, previewed, accepted, and undone.

## 2026-07-13 - G1 renderer decision completed for the first loop

- Added the static-nameplate hybrid adapter through RED/GREEN TDD: one validated request now produces an offline browser preview document and a safe FFmpeg export argument list.
- Verified 11 focused hybrid tests and all 45 renderer tests, including the existing real FFmpeg and ffprobe integration coverage.
- Three measured preview documents and three measured exports had identical hashes on this Windows machine; the five-second output preserved 1280 x 720 at 30 fps and the source hash did not change.
- ADR-001 selects browser-native preview plus FFmpeg-native export for the first closed static-nameplate loop, behind renderer-neutral contracts.
- HyperFrames runtime remains uninstalled and unverified. Preview-to-export pixel fidelity, real owner footage, audio preservation, advanced motion, and cross-machine determinism remain open evidence gates.
- A spec review found that shared input alone did not prove translation fidelity and that deployment cost lacked local measurements. Follow-up RED/GREEN tests now parse both generated translations: text and timing match exactly, and the maximum normalized placement delta is 0.0005556 from pixel rounding.
- Local measurement now records project adapter bytes, preview-document bytes, and already-installed Chrome, FFmpeg, and Node executable facts without installing or executing HyperFrames.
- This completes the narrow G1-03 first-loop decision only. G1-02 remains in progress because pixel fidelity, representative real-video/audio behavior, approved motion coverage, and HyperFrames runtime evidence remain open. No product renderer, editing primitive, backend, or export workflow exists yet.

## 2026-07-13 — Second owner motion review exposed the unsupported-browser fallback

- The owner reported no meaningful improvement and specifically requested noticeable smooth navigation plus brief bouncy feedback on buttons and the text-entry surface.
- Live browser inspection verified that the current browser does not expose `document.startViewTransition`; the previous fallback updated state immediately, which explains the abrupt cut.
- A first CSS fallback attempt failed independent review because it could double-animate native browsers, conflicted in the Back-button cascade, and did not explicitly remove the new transforms for reduced motion.
- The corrected implementation marks native versus fallback support once, gates the CSS screen entry to fallback browsers, gives direct controls a separate brief spring token, and explicitly removes the new motion for reduced-motion users.
- Automated frontend and production-build evidence does not prove owner-perceived feel. The owner re-test remains the acceptance gate.

## 2026-07-13 — Canonical nameplate edit domain added

- Added a renderer- and interface-independent TypeScript workspace for the exact `sanverse.action/v1` point/nameplate contract.
- Used two RED/GREEN cycles: absent production modules first failed three suites, then a runtime-mutation test exposed that TypeScript `readonly` alone did not protect history.
- Validation now fails closed for unknown or missing fields, wrong schema/kind, non-finite or out-of-range coordinates/times, blank IDs/text, and non-positive duration.
- Proposal, acceptance, undo, redo, and project serialization are pure; duplicate IDs fail without mutation, and copied canonical history/actions are frozen at runtime.
- Quality review found that an ID could be reused after its redo entry was cleared and that structurally forged histories could reach project serialization. Follow-up RED/GREEN tests added a never-cleared issued-ID ledger, deep history/project validation, and a frozen project envelope.
- All 34 edit-domain tests, all 56 frontend tests, and both workspace builds pass. This is E2 domain evidence only; no Point UI, preview, renderer integration, persistence, or export was added.

## 2026-07-13 — Explicit rendered-video Point mode added

- Added a visible `Point` action to Studio instead of making ordinary video clicks ambiguous. Entering Point mode pauses playback and temporarily places an accessible capture layer over the video; `Cancel` or Escape exits without capturing.
- Point capture uses the actual contain-fitted video content rectangle, not the outer player box. Clicks in letterboxing or invalid geometry/time fail visibly while Point mode stays available for correction.
- A successful click records finite normalized `x`/`y` coordinates plus a non-negative source timestamp in milliseconds, removes the temporary capture layer, restores normal video controls, and displays a marker with a plain-language `Here · timestamp` summary.
- Independent review found marker drift after responsive resize and a misleading nonfunctional keyboard button. Follow-up RED/GREEN work now reprojects the normalized target through `ResizeObserver`, provides focused arrow-key positioning plus Enter capture, preserves native Enter on Cancel, and keeps Escape cancellation.
- Final evidence passes 11 pure point-target tests and 16 Studio tests (27 focused). The complete workspace passes 75 web tests plus 34 edit-domain tests (109 total); both builds, governance verification, and diff checks pass.
- This remains an isolated E2 interaction slice. It does not create a nameplate proposal, connect canonical history, preview an edit, render, or export. Owner live-browser usability and perceived interaction quality remain pending.

## 2026-07-13 — Bounded manual nameplate proposal added

- Linked to REQ-003, REQ-004, REQ-012, DEC-003, and DEC-005.
- Connected a captured point to canonical `proposeAddNameplate` validation without enabling free-form AI interpretation.
- Added a plain-language composer with required main text, optional smaller text, exact point/time mapping, and a fixed five-second default.
- Canonical validation fails closed; successful proposals are immutable and appear in Studio without entering accepted history.
- Adversarial review exposed two unsafe edges: a new target could leave a stale proposal visible, and action-ID generation could throw through the UI. New RED/GREEN tests now prove that retargeting clears the unaccepted proposal and open draft, while ID failures remain visible and recoverable.
- Ten composer tests and 18 Studio tests pass in the focused run. Preview, acceptance, undo/redo, renderer integration, export, and owner live-browser verification remain pending.

## 2026-07-13 — Typed preview and canonical in-memory history loop closed

- Linked to REQ-003, REQ-004, REQ-007, DEC-003, and DEC-005.
- Moved the pending proposal and canonical history to App-owned state, while keeping point-mode layout and focus details local to Studio.
- Added typed nameplate overlays over the contain-fitted video content. Pending proposals preview without entering accepted history; accepted history and the current proposal are never duplicated into CSS or ad hoc UI truth.
- Connected canonical exactly-once Accept, history-neutral Discard, Undo, and Redo. Redo-only actions never render, retargeting clears only a stale pending proposal, and Back/new project resets the in-memory edit state.
- Independent quality review rejected coarse `timeupdate`-only preview timing and hardcoded five-second approval copy. RED/GREEN corrections now use presented-video-frame callbacks when supported, a mutually exclusive media-event fallback otherwise, and duration copy derived from the typed action.
- Re-review then exposed a competing playback clock, invalid focus token, and status text that could become false after Undo. Further RED/GREEN corrections prove exclusive clock selection and cleanup, use the shared visible focus ring, and announce only the completed proposal resolution.
- Final evidence passes 54 focused Task 5 tests, 113 web tests plus 34 edit-domain tests (147 total), both production builds, both governance checks, `git diff --check`, independent spec review, and independent quality re-review.
- This is E2 automated evidence only. State is not persisted, no project-owned media copy exists, no product renderer or exported MP4 exists, and no owner real-media usability acceptance is claimed.
- The current top-left placement meaning is only a provisional renderer-compatibility assumption. It can clip near the right/bottom edge and must be owner-validated or made explicit in a versioned action schema before Task 7 or schema freeze.

## 2026-07-13 — Immutable local project intake completed

- Linked to REQ-003, REQ-005, REQ-009, REQ-013, and DEC-002.
- Resolved a governance ambiguity before implementation: the owner authorized continuing the approved Tasks 2–8 vertical slice while G1 owner/motion gates remain open; this does not claim G1 closure or G2/G3 completion.
- Added a loopback-only streaming API and HTTP-neutral project repository boundary. Root `npm run dev` now starts the web app on strict port 2000 plus its internal API on `127.0.0.1:2001`.
- Added bounded MP4 structure/brand validation, configured declared/actual size enforcement, SHA-256, generated opaque IDs, fixed internal paths, same-filesystem staging, complete-write handling, atomic publication, cleanup, and immutable-copy evidence.
- Added safe full/ranged media serving and connected Home intake to Studio only after a validated 201 response. Importing, cancellation, same-batch single-flight, and recoverable failure are explicit.
- Independent quality review rejected the first GREEN implementation for a ranged-stream leak, disconnect/post-header failure handling, range compliance, ignored partial writes, Windows child-process risk, untyped binary decode failure, and a same-batch upload race. Focused RED/GREEN corrections closed each issue and the re-review passed.
- Final automated evidence passes 30 API, 118 web, and 34 edit-domain tests (182 total), all three production builds, `git diff --check`, independent spec review, and independent quality/security re-review.
- The final real-runtime check caught a Node strip-only incompatibility in two TypeScript parameter properties that compile-time and in-process tests did not exercise. A narrow source-compatibility regression plus standard class fields closed it; the configured API entry graph then loaded successfully.
- A 142,738-byte MP4 derived from the supplied 189,751,984-byte MOV passed HTTP creation, immutable publication, full retrieval, and a 32-byte `206` range. Persisted/source/downloaded hashes matched. This proves the bounded real-video-derived path, not full-file performance or MOV intake.
- This remains below owner E4. Automated fixtures do not prove real large-file import speed, perceived usability, preview/export fidelity, or a completed edited export.

## 2026-07-14 — Deterministic FFmpeg renderer adapter completed

- Linked to REQ-003, REQ-004, REQ-005, REQ-007, REQ-009, DEC-003, DEC-005, and ADR-001.
- Added a replaceable renderer port and service that revalidates immutable accepted history and sends accepted actions only; redo-only and invalid history never reach the renderer.
- Added the production FFmpeg adapter with no-shell argument arrays, fixed private UTF-8 text/font files, bounded action/text counts, exact timing bounds, provisional top-left placement clamped inside the frame, audio copy, output probing, hashing, cancellation, cleanup, and create-if-absent atomic publication.
- Real evidence used a two-second 640 by 360 derivative of the supplied owner video plus audio. Two exports had identical SHA-256 `7c99b6e08c822fb828e38a22f2aec96d69bea0229dbb58b6d70868000b4c1356`, differed from the source, and preserved exact duration, dimensions, and audio.
- Direct adapter checks passed canonical junction rebuilding, private `-n` partial output, malicious hard-link rejection, post-spawn abort capture, close-before-settlement, cancellation before publication, accepted-history delegation, atomic publication, and private cleanup.
- API and edit-domain builds, web type-check, governance, static security scan, and `git diff --check` pass. Managed-sandbox `spawn EPERM` blocks Vite/Vitest before collection, so no fresh full-suite count is claimed for this slice.
- Independent review found and blocked three real issues across two correction cycles: early cancellation settlement, lexical output/reparse and partial-file races, and publication after cancellation during hashing. Final independent re-review reports no remaining blocker.
- Task 7 is backend capability, not a clickable export. Task 8 must connect project paths/history to the API, expose progress/failure/download in Studio, and complete owner E4 testing.

## 2026-07-14 — Windows root launcher corrected

- A final user-startup smoke check reproduced a real `spawn EINVAL` failure before the app could start.
- Root cause was direct no-shell execution of `npm.cmd` under Node 24 on Windows, not a missing dependency or occupied port.
- Added a focused regression and changed the runner to execute npm's JavaScript CLI through the current Node executable with fixed arguments.
- Direct launcher-selection assertions and the API build pass. The corrected root command remained active until intentionally stopped; the managed sandbox still prevents a fresh Vitest worker run with `spawn EPERM`.
- Created a separate 60-second H.264/AAC MP4 test derivative from the owner's MOV so the MP4-only intake can be exercised immediately without modifying the original source.

## 2026-07-14 — Task 8 owner-facing export connected

- Connected the opaque project ID and canonical accepted history from Studio to a bounded same-origin export request.
- Added controlled project-local export allocation, strict opaque export IDs, production renderer invocation, result-path verification, and full/range attachment serving.
- Export is disabled until at least one edit is accepted and no proposal is pending. Studio now shows rendering, recoverable error, verified result metadata, and **Download MP4** states; editing or leaving invalidates stale work.
- Test-first repository, API, browser-client, Studio, and App specifications were added. API/web TypeScript checks and the direct browser client contract pass.
- Direct HTTP composition passed real MP4 intake, empty-history rejection, validated history, controlled allocation/publication, full/range download, traversal rejection, matching hash, 640 by 360 dimensions, exact two-second duration, and audio.
- The managed sandbox blocked a fresh Node-spawned FFmpeg run and Vite/Vitest collection with `spawn EPERM`. Task 7's prior real FFmpeg evidence remains valid; no fresh combined-render or Vitest pass is claimed.
- Independent review blocked a pathname re-open race plus two test-contract defects. Export serving now streams only from the validated open handle, fails closed on unprovable file identity, rejects empty/multiply-linked outputs, and final re-review passed.
- Implementation is complete. Task 8 remains at an open owner E4 gate until the representative browser download is played and accepted.

## 2026-07-14 — Task 8 export failure made observable and recoverable

- The owner's first representative Export attempt reached a generic failure state. Because the original server terminal output was not retained, its exact cause remains unknown rather than being guessed.
- Replaying the accepted history against the existing project in the managed Codex environment failed in 72 ms before encoding. Captured server evidence identified `spawn EPERM` while starting `ffprobe`.
- A separate direct native FFmpeg render of the same 44.5-second H.264/AAC source succeeds and preserves media properties, but took about 151 seconds. That is performance evidence, not proof that the original browser failure was a timeout.
- Test-first contracts now cover emitted and synchronous `EPERM`/`EACCES`, sanitized API mapping, actionable browser copy, and a visible Retry action.
- Production code now maps blocked process launch to `RENDER_PROCESS_BLOCKED`, returns safe HTTP 503, keeps raw operating-system details local, and tells the owner that accepted edits are safe.
- The direct adapter/client/API observability contract passes. The API build and web TypeScript check pass. Vite/Vitest and a fresh combined browser render remain blocked before collection/startup by the managed environment's process policy.
- Task 8 remains **In progress** until the owner retries from normal PowerShell, downloads the MP4, plays it, and accepts output placement, audio, duration, and completion time.

## 2026-07-25 — Real-user end-to-end test closes the manual loop; 64-bit identity defect fixed

- Ran a full real-browser walkthrough on a 30-second 1080p clip instead of relying on unit tests: Home, intake, Studio, point, nameplate, preview, accept, undo, redo, export, download, and inspection of the exported MP4.
- Found a blocking defect that made every new upload unusable: the media/export identity guard required a safe-integer inode, and Windows 64-bit NTFS file IDs exceed `Number.MAX_SAFE_INTEGER`, so each newly created project returned 404 for its own source video while Studio blamed the file. Recorded as FAIL-006.
- Fixed both identity guards to read `{ bigint: true }` stats so identity compares exactly. The July 14 project worked only because it happened to receive a small inode; export downloads would have failed the same way.
- Replaced failure copy that blamed the browser and the video for a server-side cause (FAIL-008).
- Repaired 5 stale `App.test.tsx` contracts that the recent-projects listing had invalidated; no product code changed for that repair.
- Evidence: 220/220 tests (57 api + 129 web + 34 edit-domain), all three builds, live re-test showing 200 for all project media, project reopen with saved history, and a verified exported MP4 (1920x1080, 30.03s, audio, nameplate correct in and out of its window). Source SHA-256 unchanged.
- Realigned local `main` with `origin/main` after an earlier bridge-copy push, then committed and pushed `fcc41eb`. Local and remote are identical.
- Next capability is the first AI-operated edit. The deterministic foundation under it is now verified rather than assumed.

## 2026-07-26 — Immediate cleanup gate

- Root cause of the Node file-descriptor warnings was an incomplete repository ownership contract: `openMedia` and `openExport` returned an already-open handle behind an `AsyncIterable` without an explicit close operation for callers that did not consume it.
- Added an idempotent `OpenMediaResult.close()` contract. Complete iteration closes automatically, HTTP media/export routes close in `finally`, and repository tests explicitly release unopened bodies.
- Direct RED/GREEN API integration proved that successful HTTP media serving now invokes the explicit close boundary; the API TypeScript build passes.
- Reconciled `GOALS.md`, `CURRENT_STATE.md`, `START_HERE.md`, `BUILD_TRACKER.md`, and the plan registry. G2/G3 are recorded as complete, G1 retains its owner-only UX gate, and G4 is next but has no approved detailed plan yet.
- Removed the accidental empty `.sanverse-data/projects/projects` directory. Native human drag-and-drop and final owner UX acceptance remain open because automation cannot honestly supply that evidence.
- Independent pre-commit review found and blocked two remaining handle-release defects: pre-stream header errors were outside `finally`, and close rejection was swallowed. Focused RED/GREEN correction closed both; final independent re-review passed with no security or logic errors.
- Verification boundary: API/domain/web TypeScript builds and direct HTTP/filesystem checks pass. A fresh full Vitest/Vite run remains blocked by the managed session's `spawn EPERM` policy (FAIL-011); the last unrestricted baseline remains 220/220.

## 2026-07-29 — Dual-workspace UI kernel and persistent EditorShell

- Saved GPT's complete 1,606-line implementation context verbatim at `DOCS/plans/SANVERSE_DUAL_WORKSPACE_PRODUCT_AND_UI_IMPLEMENTATION_CONTEXT.md`.
- Verified the active repository truth before implementation: branch `agent/g6-g8-local-alpha`, starting commit `9f53005`; no assumption was made that `main` contains this branch.
- Added only P0-B/P0-C: shared Button, IconButton, SegmentedControl, Panel, Tabs and tokens; one persistent EditorShell; Assist/Studio selector; shared project/save/Undo/Redo/export top bar; restrained workspace-specific layout.
- Preserved one mounted `StudioScreen`. Switching changes presentation, not the project or editor instance, so playhead/video state, pending proposal, revision, history and export state are not converted or reset.
- RED evidence: the new shell module and workspace controls were absent. GREEN evidence: 12/12 focused continuity tests pass and the required web production build passes.
- Real-browser check: reopened `test-30s.mp4`; Assist was the default; switching to Studio kept the same project, 9 history entries and exactly one video element; Studio exposed the existing simple time strip.
- No domain schema, operation, render behavior, effect, professional timeline or provider was added. Timeline V1 remains the exact next task only after owner approval.
- Nonblocking Vite HMR hostname warning and stale authority documents are recorded as FAIL-017 and FAIL-018 rather than repaired in this focused batch.

## 2026-07-30 — P0-E Studio workspace structure

- Reframed the existing mounted StudioScreen into Project media, Program canvas,
  read-only Inspector, collapsible AI edits, and a meaningful Timeline workspace.
- Preserved the single editor authority and every existing state/export path.
- Browser continuity, Point/proposal repair, Cut/Undo/Redo/export, three exact
  responsive screenshots, 64/64 focused tests, and all builds passed.
- Found and fixed the video-over-Point overlap defect. P1-A was not started.

## 2026-07-31 — P1-C Inspector V1

- Added one immutable Timeline-selection resolver and one contextual Inspector over the current evaluated `EditProject`; no second project, history, proposal store, playhead, video, schema, or persistence format was introduced.
- Added local section drafts, Apply/Reset, validation notices, and dirty-selection protection. Every successful Apply builds one existing typed operation and uses the existing App/server revision-fenced change-set route, so it remains one Undo.
- Connected clip visibility/sound/transition, caption repair/style, title/callout/media-overlay/music repair, transform, crop, layer, mask, effects, entrance/exit, easing, and Keyframes V1. Missing capabilities remain explicit: accepted nameplate text is read-only, source clips have no visual target, caption placement controls do not exist, and music end is derived.
- Real Edge found and drove three repairs that component tests had not proved: a sticky visual Apply footer intercepted another section's Apply; pending proposal resolution actions inherited the wrong busy flag; and FFmpeg wrote permanent alpha zero before an entrance fade, making the accepted title absent from export.
- The fresh post-repair walkthrough used `test-30s.mp4` and completed clip Apply, Undo, Redo, title repair, transform/crop/fade/keyframes, Undo, Redo, proposal reject, export/download, and tablet/mobile layout checks. Revision advanced exactly from 0 to 8; rejecting the detached proposal did not consume a revision; page, console, and HTTP errors were zero.
- The final export is H.264 1920×1080 at 30 fps with AAC 48 kHz stereo and 30.033-second duration. Five extracted frames prove the repaired title is absent before/after its interval, visible during fade-in, and fully visible inside the interval.
- Final gates: web 380/380, edit-domain 265/265, API 234/234, render-contract 51/51, intent-domain 27/27, and all-workspace build. One API mocked-export assertion failed once under the first parallel full run, then passed alone and on the complete rerun without a code change; this transient observation is preserved in the evidence.
- Evidence: `DOCS/evidence/2026-07-31-p1c-inspector-v1/`. P1-D was not started.
# 2026-08-03 — P1-F.0.2 Nested Studio Layout Engine V2 complete

Replaced the V1 custom splitter presentation with an exact-version nested panel
adapter while preserving the existing editor/domain authority. Added V2
migration, persistence, presets, responsive behavior, keyboard accessibility,
AI overlay continuity, and focused regression coverage. A real 30-second media
walkthrough passed edit, Undo, Redo, export, and download. Final suites pass
1,158/1,158; the production build passes. INFRA-004, INFRA-005, and SEC-001 are
recorded as bounded follow-up work. P1-F.1 was not started.

# 2026-08-03 — P1-F.0.2.1 layout stabilization technically complete

Real-browser measurement found and fixed two milestone blockers: Reset could
leave a physically expanded AI panel behind an `Expand AI` label, and the old
natural-flow breakpoint collapsed nested Preview/Timeline panel ancestors to
zero height at 1024 and mobile widths. Stable initial geometry, final
presentation authority, a bounded 1024 tablet regime, and an explicit mobile
natural-flow escape resolved both without changing editor/domain authority.
One video, AI draft continuity, ten stable 1440×900 expand/collapse cycles, keyboard resize, responsive
reachability, edit, Undo, Redo, and export passed. Final suites pass 1,164/1,164;
all builds pass; the export probes as 1920×1080 H.264/AAC. Invalid tiled PNGs
were not presented as evidence. P1-F.1 was not started.

# 2026-08-03 — P1-F.0.2.2 Media panel and Editor Monitor V1

Completed the container-responsive Media presentation and replaced native video
controls plus the permanent Point row with one custom editor monitor over the
existing video/content layer. Media search/filter/selection survived 420, 304,
239, and 220 px panel widths; monitor, Point, transport, viewer modes, guides,
fullscreen fallback, and shared geometry survived responsive browser checks
with exactly one video. A real nameplate edit, Undo, and Redo passed. Real export
remained rendering beyond 90 seconds and is recorded without renderer drift.
Media V2 was not started.

## 2026-08-04 — Gate D: the timeline shows real pictures and real sound

Replaced coloured rectangles with the actual frames of the actual recording and
the actual shape of the actual sound. The browser decides what is needed because
it is the only thing that knows what is on screen; the local server makes it with
the same FFmpeg that produces the finished video, so a preview frame can never
differ from the exported one.

Each piece is named by which file, which BYTES of it, which moment and how big —
never by where it sits on the timeline. Moving a clip therefore costs nothing,
trimming costs one picture and splitting costs at most one. Bounds are measured,
not hoped for: two frame decodes and one sound decode at once on the server, six
requests in flight in the browser, and on a real project scrolled end to end and
back, never more than two clips mounted, three drawing surfaces, one video
element and zero object URLs.

Running it in a real browser found two faults no test had: the original recording
reported itself missing because one storage reference is spelled two ways, and
every row shrank on a large monitor because row heights were read from the width
of the timeline instead of the width of the window. Both fixed and now held by
test. A third fault was found and recorded rather than fixed: portrait footage
cannot be exported into a landscape project (FAIL-051).

Tests 1,559 → 1,723. Build exit 0. Inspector expansion and AI execution were not
started.

## 2026-08-05 — P1-F.1E begins; the preview stops calling real footage a gap

The new program is **P1-F.1E, Complete Timeline Experience**: eight gates, T0
through T7, taking the timeline from working to something that feels like CapCut
for everyday work and carries Resolve-level depth where it is asked for. The
live state lives in `DOCS/evidence/2026-08-04-timeline-completion/
PROGRAM_STATE.md`, which is the file a new session reads first.

Gate T0 is correctness, and it comes first for a reason: the owner's own
recording showed the monitor saying "No media at this time" while footage sat
plainly under the playhead. Adding a Bezier graph editor to an editor that lies
about whether your footage exists is the wrong order of work.

The cause turned out to be two steps upstream of where it looked. Selecting a
clip appeared to trigger it; selection was innocent, and so were both monitor
state machines. The trigger was: add a title or a piece of B-roll, move or scale
it, then delete it. The adjustment naming it stays behind, the compiler refuses
the WHOLE project, and the preview — which asks that same compiler whether
footage exists — read the refusal as "there are no stretches anywhere". Every
moment of a healthy thirty-second project then answered "no footage here".

`null` was carrying two opposite meanings: "I could not build this" and "there is
nothing here". Recorded as FAIL-052.

Two fixes. Footage existence is now read from the composition — the user's actual
edit — so one broken thing costs only its own interval, and the resolver takes a
project and a number with no third argument, which makes selection structurally
incapable of changing whether footage exists. And a visual adjustment naming
something no longer on screen now draws nothing instead of failing the project,
which is the rule the compiler already applied three lines above for a
switched-off track.

Black also says which black it is now: no clip at all keeps the plain wording
because that black IS the finished video, while a switched-off track, a
switched-off clip and a missing file each say so — and the missing file is
reported as a fault rather than a gap.

## 2026-08-05 — Gate T0 finished: the preview stopped lying, and mixed-shape footage exports

Two things a user could see were broken. Both are fixed and proven in the running
app on the owner's own project.

**The preview called real footage empty.** Deleting an overlay you had moved left
behind an instruction naming something that no longer existed. The part that
builds the video refused the WHOLE project because of it, and the preview read
that refusal as "the timeline is empty everywhere". The same mistake was then
found in a second place — which recording the video element points at was read
from the same failable build — and fixed the same way.

**A phone clip made Export fail completely.** Footage went into the exporter at
whatever size it was recorded at, and the step that joins the pieces refuses
unless they are all already the same size. Recorded as FAIL-051 "portrait footage
cannot export", but it was never about portrait: any two clips of different sizes
failed. One file now owns the rule for fitting a picture of one shape into a
canvas of another, and both the browser preview and the exporter read it, so they
cannot drift apart. Whole picture with black bars by default; fill-and-crop
offered; stretching deliberately not offered.

Also: "Local save needs attention" replaced with states that say what happened,
how much work is already safe, and what to press. "Reopen it and try again"
replaced with carrying the proposal forward wherever it still makes sense. Our
own vocabulary — "P1-A timeline lane", operation names, reason codes, COMMITTED
on every clip — taken off the user's screen.

Tests 1,736 → 1,848. Build exit 0. FAIL-051 and FAIL-052 closed.

## 2026-08-06 — Gate P0 and Gate T1: picking, copying, grouping and noting

**What a person could not do before.** The Timeline could hold exactly one thing
at a time. Enough to click a clip and delete it; not enough for anything a
creator actually does. There was no way to box several things, no copy, no
paste, no duplicate, no way to say "these go together", and nowhere to write
"fix this bit".

**All of that now exists**, and every one of them is one gesture, one change set
and one Undo. Four clips dragged and one Undo puts all four back — not the fourth
back and three still moved. If any one of them cannot make the move, none of them
move, because moving the ones that fit would change the very spacing the user
picked several of them to preserve.

**The ghost shown while dragging comes from the same planner that makes the
edit.** There is no second "roughly what will happen" calculation. Gate T0 existed
because two pieces of code answered the same question separately; this is that
lesson applied before the bug.

**An export is now identified by what it will produce, not by how many times the
project was touched.** It used to be the revision number, which goes up on every
accepted edit — so writing a note to yourself, or grouping three clips, or
switching a track off and straight back on, threw away a finished video and made
the user wait again for a byte-identical file. The key is now the compiled render
plan. Proved in the running app: a real note moved the revision from 25 to 26,
and pressing Export returned the same finished job instantly.

**A real defect was found while writing the tests.** Clicking a piece of B-roll
silently picked up the whole piece of main footage underneath it, because B-roll
is pinned to a clip and so carries that clip's identity. The next Delete would
have taken both. The link between a picture and its own sound is now matched only
where that link can actually exist.

**Transition became reachable.** Its operation, its preview support and its export
support all already existed with no way for a user to press it — which the new
capability inventory records as the most misleading kind of "partial".

Also written: an inventory of every requested Timeline feature judged on seven
separate questions, and a written refusal of veed-engine-cli on licence grounds
with four hard rules so nobody has to work it out again.

Tests 1,848 → 2,050. Build exit 0.

## 2026-08-08 — Gate T2 closed: speed, reverse, freeze and audio now share one clock

T2 is complete. The same integer-tick project authority now carries constant
rational speed, Rate Stretch, Reverse, Freeze Frame, direct clip audio,
normalization, linked J/L audio windows, bounded transitions and the advanced
placement planners through Preview, history, Undo/Redo, reopen and export.

The final real-browser closure found two product bugs that broad tests had not
caught. First, Hold Frame was enabled in the More menu but the action dispatcher
forgot to put `freeze` through the panel-opening branch, so pressing it did
nothing. Second, Rate Stretch hard-coded `forward` in the Studio adapter, so
stretching backwards footage silently made it forwards again. The first now has
a Timeline routing regression; the second carries the selected clip's current
direction through both preview and commit. In the final Edge run the stretched
clip visibly remains `1.63x Backwards`.

The final private real-media workflow ran revision 34→44: Dip to White, Reverse
with a real bounded backwards-preview MP4, direct gain, pan, real LUFS
normalization, Rate Stretch, a 200 ms J-cut, Freeze, Undo, Redo and reopen. It
kept one video element, had zero browser errors and zero failed HTTP responses,
and had no horizontal overflow at 1440×900, 1024×768 or 390×844.

Export from revision 44 succeeded in one attempt: 24.841 s, 1920×1080 H.264
High/30fps plus AAC-LC stereo/48 kHz. The renderer's SHA-256 exactly matched the
12,548,402-byte MP4 on disk. Start/middle/end frames decoded and were visually
inspected. Tests 2,291 → **2,292/2,292** after adding the Hold Frame regression;
all-workspace production build exit 0.

Evidence: `DOCS/evidence/2026-08-04-timeline-completion/T2_FINAL_CLOSURE.md`.
Gate T3 was not started, and the separately owned Motion Graphics Library
workstream was not integrated or modified.

## 2026-08-08 — Gate T3 PRE0: ownership is now enforceable, not just remembered

The owner authorized Precision Trimming and required permanent multi-agent
ownership before any feature code. T3 therefore moved to a fresh editor-only
worktree/branch, `timeline-t3-precision-trim`, based exactly on the verified T2
SHA `5a50e4bf84b928ac686bb903d1425b21c64ae890`.

`DOCS/PROGRAM_OWNERSHIP.md` now defines the durable read-other/write-own rule for
Editor, Motion Plan A+C and AI Plan B. The Editor's protected Motion boundary is
`apps/motion-lab/**`, every `packages/motion-*/**`, `motion/**` and
`DOCS/motion/**`; production `apps/web` may not import unfinished
`@sanverse/motion-*` packages or Motion Lab until an explicit integration
milestone.

A zero-dependency Node checker at
`tools/program-ownership/check-editor-boundary.mjs` inspects committed changes
since the editor milestone base, staged changes, unstaged tracked changes and
untracked files. It also scans production `apps/web` imports. Synthetic tests
cover allowed editor changes and every requested protected/forbidden case: 9/9
pass. The live checker passes from the T2 base with no Motion path changes and no
forbidden imports. No root dependency or workspace file changed.

Precision feature code starts only after this guardrail. T4 remains not started.

## 2026-08-08 — Gate T3 Precision Trimming complete

Gate T3 closed on the dedicated Editor branch `timeline-t3-precision-trim` without crossing Motion or Plan-B ownership. The accepted-edit path now has one atomic `set-primary-clip-timings` primitive feeding closed Standard/Ripple/Roll/Slip/Slide planners; no temporary invalid composition is accepted and one completed compound trim is one Undo.

The Timeline exposes explicit Trim modes, focusable Roll edit points, Q/W and Ripple-to-playhead commands, deterministic Extend, J/K/L shuttle, detached Dynamic Trim, bounded Audio Scrubbing, Ctrl/Cmd multi-edit-point selection, exact numeric time/frame input and an exact-frame Trim View. Trim View reuses Gate-D's existing derived-media endpoint/controller and is capped at four active frame requests; it adds no second video, clock or media-analysis authority.

Final automated gate: **2,345/2,345** — API 403, Web 1,297, edit-domain 500, intent-domain 27, render-contract 118. All-workspace production build passed. A schema-valid 60-minute / 250-primary-clip fixture proved Ripple work is bounded by affected downstream clips while Roll/Slip/Slide/Multi-Roll remain proportional to their affected items and Trim View remains capped at four exact source frames.

Real Edge owner-media evidence proved Standard, Ripple, Roll, Slip, Slide, J/K/L, Dynamic Trim cancel/commit, Audio Scrubbing, numeric refusal/acceptance, additive edit-point selection/all-or-nothing refusal, active Trim View cancellation, one-video continuity, reload, and no horizontal overflow at 1440×900, 1280×800, 1024×768 and 390×844. The final product export is 23.900 s, 1920×1080 H.264 High at 30 fps with AAC-LC stereo/48 kHz, 10,899,271 bytes, SHA-256 `79FDA906C32B6454ED83B6A8FF1F513C906B7770690A82086E49F9F695E08F38`; sampled frames decoded cleanly.

T4 was not started. Motion and Plan-B files were not changed.

## 2026-08-10 — Gate T4 Keyframe Lanes and Graph Editing complete

Gate T4 closed on dedicated Editor branch `timeline-t4-keyframe-graph`, based exactly on verified T3 SHA `aed76ac0232e8a920812b800d234a96e32de7396`. The required authority audit was written before UI work. T4 reused existing `set-footage-motion` / `set-visual-properties` and the shared animation evaluator rather than adding a second project/render schema or Motion dependency.

The Editor now has closed property capability/time projection, full-state keyframe planners, expandable animated/all-property lanes, one shared keyframe selection, pointer/keyboard/numeric/marquee editing, Copy/Cut/Paste/Duplicate, truthful Linear/Ease/Custom Bezier/Spring/Bounce controls, a bounded Timeline-local Property Graph, and Inspector/primary-Canvas explicit-keyframe synchronization. Primary-footage animation follows source time; visual overlays follow visual-relative time. Hold remains unavailable rather than faked, and no implicit Auto-Key was introduced.

Final automated gate: **2,419/2,419** — API 404, Web 1,334, edit-domain 536, intent-domain 27, render-contract 118. All-workspace production build passed. The 60-minute stress fixture covers 250 placements / 50 animated targets; Timeline diamond projection is visible-range bounded and Graph sampling is capped at 640.

Real Edge 151 on owner media proved first-track creation, midpoint creation, a Graph point drag whose movement stayed at revision 2 and committed once to revision 3, Custom Bezier creation, a Bezier-handle drag whose movement stayed at revision 4 and committed once to revision 5, zero-revision Graph zoom and `Edit→Effects→Edit`, Undo→revision 6, Redo→revision 7, reopen continuity, one video and no HTTP 4xx/5xx responses. Responsive 1440×900, 1024×768 and 390×844 checks had no horizontal page overflow.

The real revision-7 export succeeded in one attempt: 30.033333 s, 1920×1080 H.264 High at 30 fps with AAC-LC stereo/48 kHz, 10,977,559 bytes, SHA-256 `6d4c704fad146f312c63b047a7b53f53f14207ecf7aece7662bfa430123b9f7d`; decoded 5s/15s/25s frames visibly show the authored horizontal animation moving out and returning.

Motion and Plan-B protected files were not changed. T5 was not started.

## 2026-08-10 — Gate T5 Advanced Track Controls and Expandable Tracks complete

Gate T5 closed on the dedicated Editor branch `timeline-t5-advanced-tracks`, continuing from the exact verified T4 SHA `99dcb6a71085b314414f2a4e0d526b9c5348855d`. T5 replaced hidden display-label identity with stable typed video/audio/caption track IDs and deterministic legacy migration while preserving one accepted EditProject, one history, one Timeline selection/playhead, one Preview authority, one native video and one export compiler.

The Editor now supports dynamic track rows; add, rename, reorder and bounded delete; stable item assignment and Place On Top; independent Lock, Sync Lock, Targeting and Output semantics; Track Select Forward/Backward; per-audio-track mute, solo, gain and pan; truthful Combined/Separate L/R waveform presentation backed by FFprobe channel truth; stable video/caption render ordering; and T4 animation/keyframe identity preservation across track movement. Source-anchored Sync-Lock-OFF content is compensated only when exact old placement can be reproduced; otherwise ripple refuses atomically.

Final automated gate: **2,501/2,501** — API 405, Web 1,365, edit-domain 562, intent-domain 27, render-contract 142. All-workspace production build passed. The bounded stress fixture covers 20 video, 24 audio and 8 caption tracks.

Real Edge 151 drove a real 30-second H.264/AAC project through add/rename/reorder/delete, Lock/Sync Lock/Targeting, audio mix/output, Separate L/R presentation, reload/reopen and Export. Revision 13, stable track state and exactly one native video survived reopen; 1440×900, 1024×768 and 390×844 had no horizontal page overflow; final observation recorded zero runtime exceptions, zero console errors and zero HTTP responses >=400.

The real revision-13 export is 30.000000 s, 1280×720 H.264 High at 30 fps with AAC-LC stereo/48 kHz, 16,338,429 bytes, SHA-256 `d7ef76f49d80021e2a8798519fb1f723e1cebbd15b2e892c927abc31edf6ea10`. The downloaded file and server artifact match byte-for-byte; three decoded frames were inspected.

Motion and Plan-B protected files were not changed. T6 and T7 were not started.
