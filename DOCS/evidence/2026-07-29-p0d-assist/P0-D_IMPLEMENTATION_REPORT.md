# P0-D — Assist Workspace Implementation Report

Date: 2026-07-29

Branch: `agent/g6-g8-local-alpha`

Starting commit: `836adb788ad59e9d99bbe5970afba5badfa1ebae`

Scope: P0-D only

## Decision

P0-D is technically complete. Product taste approval remains open for the owner.

The implementation keeps the existing Sanverse authority boundaries intact:

- one mounted `EditorShell`;
- one project and revision;
- one `<video>` element and playhead;
- one pending proposal;
- one accepted history with Undo/Redo;
- the existing preview and export paths.

No P0-E, P1-A, Timeline V1, Inspector, media bin, renderer, schema, real-AI, or multitrack work was started.

## What changed

- Assist now opens as the video-first default workspace.
- The video is visually dominant and the instruction composer is adjacent.
- The existing Point workflow remains available without exposing fake annotation tools.
- A focused proposal panel exposes pending state, origin, timing, repair, Accept, Reject, Refine, and Open in Studio.
- A compact derived change strip shows accepted, pending, and blocked operations without inventing timing.
- Timed change items seek the existing playhead; untimed items are deliberately not clickable.
- Engineering-heavy timeline controls remain in Studio.
- Workspace switching changes presentation without remounting the editor session.
- Reduced-motion styling and laptop breakpoints were added without an animation dependency.

## Focused automated evidence

Command:

```text
npm test --workspace @sanverse/web -- --run \
  src/editor/assist/assist-change-model.test.ts \
  src/editor/assist/AssistChangeStrip.test.tsx \
  src/editor/assist/AssistProposalPanel.test.tsx \
  src/editor/EditorShell.test.tsx \
  src/app/App.test.tsx \
  src/screens/studio/StudioScreen.test.tsx
```

Result: **6 files passed, 67 tests passed, 0 failed.**

The focused suite covers:

- Assist default and Assist → Studio → Assist;
- exactly one video and the same video DOM identity;
- playback-position continuity;
- unsent composer-text continuity;
- pending-proposal and repair continuity;
- server-authoritative Accept;
- Undo/Redo and export-state continuity;
- Studio engineering-control regression;
- derived accepted/pending/blocked change items;
- timed seek and untimed fail-closed behavior;
- keyboard activation and long-list compaction;
- proposal empty, busy, error, pending, action, and origin states.

## Production build and bundle

`npm run build` passed for every workspace.

| Asset | Baseline | P0-D final | Change |
|---|---:|---:|---:|
| Modules | 96 | 103 | +7 |
| JavaScript | 362.64 kB | 368.35 kB | +5.71 kB |
| JavaScript gzip | 104.14 kB | 105.58 kB | +1.44 kB |
| CSS | 37.17 kB | 41.50 kB | +4.33 kB |
| CSS gzip | 7.16 kB | 7.72 kB | +0.56 kB |

The growth is the bounded Assist change-model, proposal, change-strip, layout, and responsive CSS. No package or runtime dependency was added. The existing runtime font URL warning remained nonblocking.

## Real-browser walkthrough

Media: `resources/test video/test-30s.mp4`

Runtime: web `127.0.0.1:2000`, API `127.0.0.1:2001`, deterministic fake AI

Passed:

1. Uploaded the real MP4 and confirmed Assist opened by default.
2. Confirmed exactly one `<video>` element.
3. Set playback to 5 seconds, entered unsent text, switched Assist → Studio → Assist, and confirmed:
   - the same video DOM object remained mounted in both workspaces;
   - playback remained exactly 5 seconds;
   - unsent text remained unchanged.
4. Pointed at the visible video at 00:05.000.
5. Created an assistant nameplate proposal.
6. Repaired `Santosh` to `Santosh Budha`.
7. Switched workspaces and confirmed the repaired value and proposal remained.
8. Accepted the proposal and confirmed a compact accepted change appeared.
9. Undid the edit and confirmed the accepted change disappeared.
10. Redid the edit and confirmed the accepted change returned.
11. Exported a 1920 × 1080, 30-second result.
12. Confirmed the browser emitted a downloadable `.mp4` with the project export media URL.
13. Observed zero page console warnings/errors and zero failed page requests during the final interaction pass.

The export crossed the harness's 60-second wait by a small amount but completed successfully; this nonblocking performance observation is `FAIL-021`.

## Responsive evidence

- [1440 × 900 Assist](assist-1440x900.png)
- [1280 × 800 Assist](assist-1280x800.png)
- [1024 × 768 Assist](assist-1024x768.png)

All PNG dimensions were checked from the files and exactly match their names.

Horizontal-overflow checks:

| Viewport | Document client width | Document scroll width | Unexpected horizontal overflow |
|---|---:|---:|---|
| 1440 × 900 | 1425 | 1425 | No |
| 1280 × 800 | 1265 | 1265 | No |
| 1024 × 768 | 1009 | 1009 | No |

At 1024 pixels, the workspace becomes one column and keeps the video first.

## Accessibility and motion evidence

- one `main`;
- zero unlabelled buttons;
- zero unlabelled form inputs;
- core actions reached by keyboard;
- native video controls remained keyboard reachable;
- focus survived workspace switching in automated continuity tests;
- `prefers-reduced-motion: reduce` matched in the browser emulation;
- workspace transition duration reduced to `0.00001s`;
- exactly one accessible video remained at every tested viewport.

## Failures

- `FAIL-020`: two baseline test-harness assumptions corrected; resolved.
- `FAIL-021`: 30-second export crossed the 60-second walkthrough wait; result and download still succeeded; open nonblocking performance observation.
- `FAIL-022`: managed screenshot browser launch limitation; resolved through approved local CDP evidence capture.
- `FAIL-023`: duplicate conversation alert found by independent review; resolved with one announcement owner and an integration regression test.

Full What/Where/When/Who/Why/How/Tried/Solution records are in `DOCS/FAILURE_REGISTRY.md`.

## Acceptance gate

- [x] Assist opens by default.
- [x] One shared editor session remains.
- [x] Exactly one video element remains.
- [x] Video is dominant.
- [x] Composer is obvious.
- [x] Point is understandable.
- [x] Proposal is clearly pending.
- [x] Accept/Reject work.
- [x] Existing repair works.
- [x] Open in Studio works.
- [x] Accepted changes are compactly visible.
- [x] Timed changes seek without guessing.
- [x] Engineering controls are hidden from Assist.
- [x] Studio regression remains functional.
- [x] Workspace continuity tests pass.
- [x] Unsent composer text survives.
- [x] Laptop layouts work.
- [x] Keyboard walkthrough works.
- [x] Reduced motion works.
- [x] Focus behavior works.
- [x] Production build passes.
- [x] Bundle change is reported.
- [x] Browser screenshots exist.
- [x] Failures are recorded.
- [ ] Owner visual and interaction approval.

## Owner-review questions

1. Is the video clearly the main focus?
2. Is the instruction composer obvious?
3. Is “nothing changes until Accept” understandable?
4. Is Point discoverable?
5. Is the proposal panel understandable?
6. Are pending and accepted changes clearly different?
7. Does Assist feel simpler than Studio?
8. Does switching feel continuous?
9. Is any text too small?
10. Is anything visually noisy?
11. Does the layout feel premium rather than like an admin dashboard?
12. Can a normal user tell what to do next?

Stop condition: P0-D evidence is complete. Do not begin P0-E until owner review or an explicit next instruction.
