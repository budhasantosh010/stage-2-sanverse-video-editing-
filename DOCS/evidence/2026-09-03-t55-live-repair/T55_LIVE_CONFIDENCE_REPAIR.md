# T5.5 Live Confidence Repair — 2026-09-03

## Scope and authority

- Branch: `timeline-t55-editor-confidence`
- Starting SHA: `4d4268577e7c0b15f05ad0e67f5168522b0c62e7`
- Scope: focused owner-confidence repair inside Timeline interaction and contextual affordances
- Protected: Motion Graphics, Plan B, T6/T7, project model, typed operations, revisions, proposal/history, preview/export compilers
- Publication: local Git only; no GitHub push without fresh owner authorization

## Reproduced defects and decisions

1. Main footage first pointer selection could be lost when late filmstrip content changed the target before `click`. Selection now commits on primary pointer down for non-draggable, non-Razor items, with click de-duplication.
2. Footage and its automatically linked dialogue produced two selected IDs but represented one deliberate user choice. Normal Delete now enters the multi-item planner only when another item outside the automatic partner set is selected.
3. Reorder actions ignored first/last sequence position. They now derive availability from the canonical primary-video clip order and expose truthful disabled reasons. Track locking also disables contextual edits consistently.
4. Primary footage exposed reorder operations but not the expected direct drag. Gapless committed sections now drag to a canonical sequence index and commit one existing `reorder-clip` operation on release.
5. Detailed zoom controls were forced open on desktop. One compact Timeline Zoom disclosure is now the default; its sliders remain available on demand.
6. Selected-item actions were below the track viewport. The existing action strip now appears immediately after the primary toolbar without creating a second selection or action authority.

## Focused machine evidence

- `npm test --workspace @sanverse/web -- --run src/editor/timeline/Timeline.test.tsx`
  - Result: 22/22 tests passed.
- `npm run build --workspace @sanverse/web`
  - Result: production build passed.
  - Existing non-blocking warnings: runtime font URL resolution and a JavaScript chunk above 500 kB.
- `node tools/program-ownership/check-editor-boundary.mjs --base 4d4268577e7c0b15f05ad0e67f5168522b0c62e7`
  - Result: PASS; nine paths inspected, no protected Motion path changed, and no forbidden production Motion import found.
- This pass intentionally does not claim a fresh all-repository regression; the code scope is covered by the focused Timeline suite and web compiler/build gate.

Second repair slice, based on local commit `46102d865dd8ee4dcc5e37f9a73fa3266b1b9700`:

- `npm run test --workspace @sanverse/web -- --run src/features/timeline/timeline-gesture-adapter.test.ts src/features/timeline/timeline-edits.test.ts src/editor/timeline/Timeline.test.tsx src/editor/timeline/TimelineDecorations.test.tsx src/editor/timeline/TimelineCreatorInteraction.test.tsx`
  - Result: **100/100 tests passed** across five focused related suites.
- `npm run build`
  - Result: all-workspace production build passed.
  - Existing non-blocking warnings remain: runtime nameplate-font URL resolution and a JavaScript chunk above 500 kB.
- `node tools/program-ownership/check-editor-boundary.mjs --base 46102d865dd8ee4dcc5e37f9a73fa3266b1b9700`
  - Result: PASS; 14 changed paths inspected, no protected Motion path modified, and no forbidden production Motion import found.
- The first restricted verification attempt returned Windows `spawn EPERM` and TypeScript cache-write `EPERM`; rerunning the identical commands with normal child-process/cache permission passed. This is the existing environment limitation tracked by FAIL-011, not a product failure.

## Real-browser evidence

The first browser attempt was rejected because ports 2000/2001 belonged to an unrelated `external-mcp-raw-video-v1` worktree. Only those stale listeners were stopped. This branch was then launched at `http://localhost:2000` with its API at `http://localhost:2001`.

An isolated project was created from `resources/test video/test-30s.mp4`:

- Project: `project_e7907593d5ec6f73a1e7e0ad0e4fe8d5`
- Display name: `timeline-confidence-30s.mp4`
- First pointer press changed main footage from unselected to selected.
- One-section state disabled both impossible boundary reorder directions with explanations.
- Split at midpoint produced two sections.
- First section enabled only Move Later; last enabled only Move Earlier.
- Moving the last section earlier saved a revision and reversed the valid boundary direction.
- Normal Delete changed two sections to one section plus one real gap.
- Undo restored two sections and removed the gap; Redo restored one section and the gap; final Undo restored the two-section comparison state.
- Console inspection found Vite connection and React development information only; no runtime error was observed.
- With the same isolated project in its restored two-section, gapless state, a real pointer drag moved the first primary clip past the second and saved change 12.
- The clip IDs and starts reversed canonically: `clip_943b8582912bd7a4` became the section at 00:00.000 and `clip_e7907593d5ec` followed at 00:10.933.
- Clicking the visible Undo control restored the original order and saved change 13; clicking Redo reapplied the dragged order and saved change 14.
- The direct drag therefore produced one reversible project/history operation while preserving one video, one playhead and the existing preview/export paths.

## Honest closure state

The six reproduced defects are fixed. This materially closes the largest direct-manipulation gap found in the current comparison, but it does not establish OpenCut parity. T5.5 remains open until the owner completes the same-task 15–20 minute unscripted Sanverse/OpenCut comparison and accepts Sanverse's editing confidence. Any next repair slice must stay inside T5.5 and target only further dead enabled controls or high-friction default Timeline paths found by that comparison.
