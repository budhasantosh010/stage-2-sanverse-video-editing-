# Layered timeline release checkpoint — 2026-09-12

## Scope and truth boundary

Branch: `timeline-t55-editor-confidence`. Base: `be50d9dbf316d3207954402452d7156d471549bf`.
The owner explicitly requested completion of the current repair batch, GitHub push, and startup instructions. This supersedes historical no-push notes, but does not authorize merging into Motion or claiming competitor parity.

## Delivered in this accumulated batch

- More reliable timeline pointer targeting, grouped drag, release cancellation and edge-scroll implementation; reduced redundant controls and clearer filmstrip/waveform presentation.
- Primary footage moves between video tracks through the existing typed operation/history authority. Cross-track overlap is now supported; collisions within the destination track still refuse safely.
- Shared v10 picture-layer manifest drives transferred-footage Preview and FFmpeg export. Single-primary legacy projects retain v9.
- One composition clock drives bounded muted decoding resources and the existing audio mixer; no second editor/project/history is introduced.
- Reverse resource lifecycle, latest pending seeks, source-retimed motion, gap transport and linked-audio Inspector focus repaired.
- Initial layered-gap readiness, dip-transition alpha fidelity and same-track mixed-family stacking repaired with regression tests.

## Verification

- Final focused web integration: **107/107 PASS**, including Studio, workspace continuity, canvas binding, layered preview, decoder lifecycle, transfer compilation and interval clock. `.sanverse-data/layered-final-web-tests.json`.
- Relevant domain/contract/drag run: **732/732 PASS**. `.sanverse-data/layer-release-tests.json`.
- API render run: **140/140 PASS**, including four real synthetic FFmpeg exports covering overlap, reverse boundaries, retimed animation and held animation. `.sanverse-data/layered-render-tests.json`.
- Independent fix-context adjacent canvas/controller checks: **25/25 PASS**. These selections overlap; do not add them into a fabricated whole-suite count.
- All-workspace production build PASS. Final web build after stacking correction PASS: 313 modules; JS 1,018.26 kB / gzip 283.72; CSS 145.14 kB / gzip 24.42. Versus the September 10 reverse checkpoint, JS grew 10.21 kB / gzip 4.08. Known runtime-font and >500kB chunk warnings remain.
- Staged added-line static scan: zero dangerous eval/exec, shell=true or credential-assignment candidates. Media/exports/secrets are excluded. Diff whitespace warnings are confined to the historical PENDING_PRIMARY_TRANSFER.txt patch transcript; preserved as evidence, not executable code.
- Ownership boundary PASS: 84 changed paths at check time; zero protected Motion modifications or imports.
- Independent pre-push review first rejected same-track stacking; a separate fix context repaired only that defect; re-review returned passed=true, no security concerns or confirmed logic errors. Reviewer did not independently rerun tests.
- Wrong-root Vitest attempt is recorded as INFRA-020; it is not counted as product verification.

## Real browser and export

Reused saved `test-30s.mp4`, not raw media added to Git. Actual pointer transfer placed a primary segment on V3 at about 5s over V2. Applied 50% upper-picture scale, observed both distinct pictures, hid upper track and observed lower footage/title, then Undo restored the upper picture. Saved project reopened at revision 63; Redo restored motion and saved revision 64. Playhead advanced through the overlapping interval; this is functionality evidence, not a frame-rate or smoothness benchmark.

UI Export showed `Export ready`, 1920 x 1080, Download MP4. Actual artifact:

- `export_d2f609cb8b082b5050594791f8092f8e.mp4`, revision-64 render.
- 26.700000 seconds, 13,906,623 bytes, H.264 1920x1080 at 30fps; AAC stereo 48kHz.
- SHA-256: `7e3741f6bab4928b679c2cb3532dda06abb0c5b332db9dda0ec306c7d593532a`.
- Full FFmpeg decode to null completed without reported decode errors. Frame at 6.5s visually inspected: 50% upper picture centered above full lower footage, as intended. No claim of full audio audition or pixel-identical browser/export comparison.
- Temporary motion and transfer undone at saved revisions 65/66, restoring pre-test content. Canonical history checked; test media and rendered output stay in ignored local storage.
- Browser capture has the known INFRA-007 crop/DPR limitation; exact responsive screenshot certification and subjective smoothness are NOT claimed. Captured Vite websocket error belongs to the interrupted server (2026-09-11T20:17:42.998Z), not a clean-console claim.

## Still open — do not mark finished

1. Typed independent extracted dialogue, with independent move/trim/gain and preview/export proof (remaining FAIL-069 scope).
2. Sustained edge-hold and fresh independent-audio UI proof; measured playback/interaction budgets.
3. FAIL-094: motion-save header can lag actual persisted revision; data survived reopen/Undo/Redo.
4. Same-task owner editing session and confidence judgment. No defensible OpenCut/CapCut/DaVinci completion percentage exists.

## Start the exact tested checkout

```powershell
cd "C:\Users\Lenovo\.chatgpt-code-harness\worktrees\task-T-9525c3a99bec0971c5a7c902-2c59592c\timeline-t55-editor-confidence"
npm run dev:timeline
```

Open http://localhost:2010/. API is 2011. Keep PowerShell open; Ctrl+C stops the launcher. Dependencies already exist, so do not run npm install on each start. If port 2010/2011 is occupied, use the existing timeline server or stop its known launcher first; never kill an unidentified process. Motion/MCP on 2000 is separate.

## Owner test

### September 12 focused follow-up

Two fixes after baseline cb857393: decoder group readiness barrier (FAIL-095) and accepted Inspector/motion save-label update (FAIL-094). Tests were RED before each implementation. Final affected web selection: 100/100 PASS in .sanverse-data/high-impact-followup-tests.json. Web build PASS: JS 1,018.55 kB/gzip 283.83 (+0.29/+0.11); CSS unchanged. Independent four-file review PASS; optional deferred-play-promise regression suggested, not a blocking finding. Ownership boundary and diff check PASS.

On resume the server was absent; restarted hidden from this checkout on 2010/2011 (launcher PID 19884, historical; verify before stopping). Real browser reopened the saved test project at change 68 and Undo restored the two temporary test actions through 69 and 70. The second click reported a transport timeout but the next authoritative save status confirmed change 70; no blind repeat. A continuous playback/performance comparison was not completed in this follow-up. Independent extracted audio and owner confidence remain OPEN.

The earlier review/approval usage interruption is recorded as INFRA-021 and recovered. No raw media, export-frame JPGs or .sanverse-data files are included in the commit. Motion/2000 remains untouched.

Commit includes source/tests, startup script and text evidence only. Two local historical export-frame JPGs are deliberately not staged; no user-media image is published with this push.

Open/upload a short video, choose Studio, split once, drag sideways and between video tracks, trim an edge, use picture/timeline zoom, change speed/reverse, Undo/Redo, then Export. Compare the downloaded picture and sound with Preview. Record the exact action and timestamp for any mismatch. Independent extracted-audio behavior is not yet available.
