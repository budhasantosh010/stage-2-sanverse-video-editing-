# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- **P1-F.0.1 — Studio Workspaces and Docking V1 is technically complete.** Evidence: `DOCS/evidence/2026-08-01-p1f01-studio-workspaces-docking-v1/`.
- Studio exposes accessible Edit, Effects, Color, and Audio tabs only inside Studio while keeping one project, revision, history, playhead, Timeline, selection, Canvas/Inspector draft, native video, AI conversation, proposal, preview, and export authority.
- A closed `sanverse.workspace-layout/v1` contract validates and clamps dock widths, Timeline height, collapse state, Tool/AI tab, active workspace, and Edit/Motion/Timeline/Review/AI/Audio presets before local persistence.
- Left, right, and Timeline splitters support bounded pointer and keyboard resizing, Shift steps, Home/End, and Escape cancellation. Compact layouts use explicit Media and Tool/AI switches.
- Effects, Color, and Audio expose only current capabilities. Primary-video Color explicitly says grading is not implemented; future mixer and grading controls are not faked.
- Real Edge preserved one video and the same AI draft through all workspaces, presets, splitters, Point mode, tablet/mobile layouts, export, and cleanup. Presentation changes kept revision `15 → 15`, caused no horizontal overflow, and produced zero page, console, or failed-HTTP errors.
- The exported 18.033333-second MP4 is 1920×1080 H.264 High at 30 fps with AAC-LC stereo, 10,789,990 bytes.
- Final suites pass: web 515/515, edit-domain 299/299, API 239/239, render-contract 65/65, intent-domain 27/27 — **1,145/1,145 total** — plus the all-workspace build.
- **P1-F.0 remains complete. P1-F.1 and P1-F.2 have not started.** Continue only after the owner chooses the next milestone.
- Open human evidence remains human-only: repeated owner workflows, representative non-editor workflows, and agreed performance budgets.
- Real-provider connection still requires the owner's data-leaving-machine decision and keys. Accounts and SaaS operations remain conditional.

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
