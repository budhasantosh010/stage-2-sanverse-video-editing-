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

## Focused machine evidence

- `npm test --workspace @sanverse/web -- --run src/editor/timeline/Timeline.test.tsx`
  - Result: 22/22 tests passed.
- `npm run build --workspace @sanverse/web`
  - Result: production build passed.
  - Existing non-blocking warnings: runtime font URL resolution and a JavaScript chunk above 500 kB.
- `node tools/program-ownership/check-editor-boundary.mjs --base 4d4268577e7c0b15f05ad0e67f5168522b0c62e7`
  - Result: PASS; nine paths inspected, no protected Motion path changed, and no forbidden production Motion import found.
- This pass intentionally does not claim a fresh all-repository regression; the code scope is covered by the focused Timeline suite and web compiler/build gate.

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

## Honest closure state

The three reproduced defects are fixed. This does not establish OpenCut parity. T5.5 remains open until the owner completes the same-task 15–20 minute unscripted Sanverse/OpenCut comparison and accepts Sanverse's editing confidence. The next repair slice must stay inside T5.5 and target only further dead enabled controls or high-friction default Timeline paths found by that comparison.
