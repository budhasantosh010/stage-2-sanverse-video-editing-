# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- **P1-B — Production Timeline V1 is technically complete.** Evidence: `DOCS/evidence/2026-07-30-p1b-production-timeline-v1/`.
- Studio has one authoritative five-lane timeline over the existing `EditProject`: V2 overlays, V1 video, C1 captions, A1 dialogue, and A2 music.
- It includes one shared playhead, ruler, click/drag seek, zoom/Fit/scroll, visible-range overscan, selection, trim preview, snapping, gaps, hidden/blocked states, proposal ghosts, keyboard-safe removal, and right-click/Shift+F10 actions.
- Split, trim, ripple/non-ripple removal, reorder, enable/disable, and audio edits still travel through existing typed operations, revision-fenced change sets, persisted history, shared preview, and FFmpeg export. There is no second timeline document or browser-owned edit state.
- A fresh real Edge walkthrough on `test-30s.mp4` completed split → Undo → Redo → context menu → snap → trim → Undo → proposal ghost/reject → export/download. Desktop, tablet, and mobile geometry is clean; page/console/HTTP errors were zero; the 1080p export was probed and inspected.
- Focused timeline/Studio tests pass 79/79, affected edit-domain tests pass 77/77, and the all-workspace production build passes. Known unrelated broad-suite contract drift is recorded in `DOCS/FAILURE_REGISTRY.md` and the P1-B test report.
- P1-A remains the pure `EditProject → TimelineViewModel` and gesture-adapter foundation. P0-E remains the owner-approved five-region Studio frame.
- Exact next implementation stage: **P1-C — Inspector V1**. It has not started.
- Open human evidence remains human-only: native drag-and-drop feel, final motion/overall UX judgment, repeated owner workflows, and agreed performance budgets.
- Real-provider connection still requires the owner's data-leaving-machine decision and keys. Accounts and SaaS operations remain conditional, not implied by P1-B.

## Read in this order

1. `AGENTS.md`
2. `DOCS/MASTER_PLAN.md`
3. `DOCS/plans/PLAN_CHECKLIST.md`
4. `DOCS/CURRENT_STATE.md`
5. `DOCS/HANDOVER_RUNBOOK.md`
6. `DOCS/GOALS.md`
7. `DOCS/REQUIREMENTS.md`
8. `DOCS/DECISIONS.md`
9. The active plan in `DOCS/plans/` when one has been approved
10. Relevant entries in `DOCS/PROJECT_LOG.md`, `DOCS/FAILURE_REGISTRY.md`, and `DOCS/changes/`

For exact local startup and the pending owner walkthrough, read `DOCS/LOCAL_DEVELOPMENT.md`.

## Invariants

- **DO ONLY THE HIGHEST-IMPACT WORK THAT DIRECTLY ADVANCES THE ACTIVE GOAL. DO NOT EXPAND SCOPE, CHASE OPTIONAL IMPROVEMENTS, OR SPEND TOKENS FIXING NON-BLOCKING FAILURES. RECORD NON-BLOCKING FAILURES WITH WHAT/WHERE/WHEN/WHO/WHY/HOW, ATTEMPTS, STATUS, AND A ONE-LINE SOLUTION; THEN RETURN TO THE ACTIVE GOAL.**
- Owner's exact standing command: "wtf is wrong with you dude you can't do a fucking simple github push  why the fuck do you keep going off track I told you to be on track don't fucking drift into unnecesary work don't fucking go into the void keep thi thing in fucking midn write this command everywhere don't fucking waste tokens i explicitly told you to fucking do nly the high impact tasks as fast as possible without unneeded works"
- No Chinese whispers: preserve the owner's exact intent and call out uncertainty.
- Explain decisions in plain language for a non-technical founder.
- Do not silently expand scope.
- Do not make AI output directly mutate or render a project.
- Do not promise 100% semantic accuracy without broad, reproducible evidence.
- Do not confuse production-grade architecture with premature auth, billing, Kubernetes, or enterprise operations.
- Use short verified slices with explicit acceptance gates.
- Preserve the black-and-white, low-learning-curve interface direction until the owner changes it.

## Before changing anything

State the active requirement, decision, acceptance criterion, files expected to change, and rollback path. After a meaningful change, update current state, the build tracker, and the project log in the same change set.
