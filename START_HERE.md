# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- **P1-C — Inspector V1 is technically complete.** Owner visual and interaction approval remains open. Evidence: `DOCS/evidence/2026-07-31-p1c-inspector-v1/`.
- Selecting a Production Timeline item now opens one contextual Inspector derived from the current authoritative `EditProject`.
- Supported section Apply actions build one existing validated operation and travel through the existing revision-fenced App/server change-set path. One Apply remains one Undo.
- The Inspector covers clip sound/visibility/transition, caption repair/style, title/callout/media-overlay/music repair, transform, crop, layer, mask, effects, entrance/exit, easing, and Keyframes V1.
- Local drafts never mutate the project. Reset is local, and changing selection while dirty requires `Stay` or `Discard and continue`.
- Nothing-selected, gap, blocked, pending proposal, and unsupported capability states are explicit. Nameplate text remains truthfully read-only because no `set-nameplate` operation exists.
- A fresh real Edge walkthrough completed clip Apply → Undo → Redo → title repair → transform/crop/fade/keyframes → Undo → Redo → proposal reject → export/download. Page, console, and HTTP errors were zero; tablet/mobile layouts had no page-level horizontal overflow; the corrected 1080p export was probed and inspected.
- Final suites pass: web 380/380, edit-domain 265/265, API 234/234, render-contract 51/51, intent-domain 27/27, plus the all-workspace build.
- P1-B remains the authoritative five-lane Production Timeline and P1-A remains its pure projection/gesture foundation. No second project, history, proposal store, playhead, video, schema, or persistence format was added.
- Exact next implementation stage, only after explicit owner instruction: **P1-D — Canvas direct manipulation**. It has not started.
- Open human evidence remains human-only: final P1-C visual/interaction approval, native drag-and-drop feel, repeated owner workflows, representative non-editor workflows, and agreed performance budgets.
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
