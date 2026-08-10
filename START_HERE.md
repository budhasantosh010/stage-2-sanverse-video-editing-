# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- **P1-F.1E Complete Timeline Experience is complete through Gate T5.** T0 through T5 are DONE; T6 and T7 are NOT STARTED.
- The authoritative gate table and invariants live in `DOCS/evidence/2026-08-04-timeline-completion/PROGRAM_STATE.md`.
- Final T5 evidence is `DOCS/evidence/2026-08-04-timeline-completion/T5_FINAL_CLOSURE.md`, with `T5_BROWSER_WORKFLOW.md`, `T5_TEST_RESULTS.md`, `T5_EXPORT_EVIDENCE.md`, `t5-browser-screenshots/`, machine-readable export metadata and decoded export frames beside it.
- T5 adds stable typed video/audio/caption track identities, dynamic rows, add/rename/reorder/delete and Place On Top, independent Lock/Sync Lock/Targeting/Output, static audio mix state, truthful Combined/Separate L/R waveforms, render-order authority, caption-track independence and T4 animation preservation without adding a second project, Preview or export authority.
- Final suites: API 405/405, Web 1,365/1,365, edit-domain 562/562, intent-domain 27/27, render-contract 142/142 — **2,501/2,501 total** — plus an all-workspace production build PASS.
- Final real Edge 151 workflow proved stable track add/rename/reorder/delete, Lock/Sync Lock/Targeting, audio mix/output, Separate L/R presentation, reload/reopen continuity, one video element, responsive 1440/1024/390 behavior, zero runtime/console errors and zero HTTP responses >=400.
- Final revision-13 export succeeded: 30.000000 s, 1280×720 H.264 High at 30 fps with AAC-LC stereo/48 kHz, 16,338,429 bytes, SHA-256 `d7ef76f49d80021e2a8798519fb1f723e1cebbd15b2e892c927abc31edf6ea10`; the downloaded and server-side hashes match.
- Hold interpolation remains deliberately unavailable because the current Editor contract cannot represent it truthfully end-to-end; T4 does not fake Auto-Key or Hold.
- **Do not start T6 without explicit owner authorization.** A separate agent owns the Motion Graphics Library workstream; do not integrate or modify its protected paths from the Timeline program.
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
