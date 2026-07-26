# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- Completed technical stages: **G0 — Foundation**, **G2 — Canonical project foundation**, and **G3 — First closed manual vertical slice**.
- Open owner-evidence stage: **G1 — final motion, native drag-and-drop, and overall Studio UX acceptance**.
- Proposed next implementation stage: **G4-A — Scale-ready Project v2 chassis**. It is planned but not approved or started.
- Product code: a runnable local web application exists at strict http://localhost:2000. It imports an MP4 through a loopback-only API into an immutable project-owned copy, supports point capture, a bounded nameplate proposal, typed preview, exactly-once acceptance, persisted undo/redo history, recent-project reopening, and production FFmpeg export to a downloadable MP4.
- **2026-07-25 — the manual loop is now verified end to end in a real browser.** A full walkthrough on a 30-second 1080p clip completed: upload, reopen from Recent projects, point, nameplate, preview, accept, undo, redo, export, download, and correct exported output (probe plus frames). Read `DOCS/changes/2026-07-25-claude-e2e-test-and-identity-fix.md` before doing anything else.
- That walkthrough found and fixed a defect that was blocking **every new upload**: the media identity guard rejected Windows 64-bit NTFS file IDs, so each newly created project returned 404 for its own video. See FAIL-006. Both guards now read bigint stats.
- Present persistence boundary: local project media, its integrity manifest, **and accepted edit history** persist under ignored `.sanverse-data/`. History survives reload and reopen; Home lists recent projects.
- Immediate planning gate: owner review of `DOCS/MASTER_PLAN.md`, `DOCS/plans/PLAN_CHECKLIST.md`, and `DOCS/plans/G4A_ATOMIC_IMPLEMENTATION_PLAN.md`.
- If approved, immediate implementation gate: **G4-A**, which establishes explicit media time, assets, composition/clip identity, target/anchor semantics, atomic change sets, capability discovery, migration, and one canonical render plan. **G4-B**, the first AI-operated proposal, follows this chassis.
- Absent capabilities: no AI/chat interpretation, no cut/trim/split, no timeline, no motion or effects, no captions, no additional component types, no accounts, and no SaaS operations. Chat in Studio is a visible disabled placeholder.
- Goal-status boundary: G1 remains open only for owner judgment that automation cannot supply. G2/G3 are technically complete. G4-A and every later goal remain unimplemented. Accounts and SaaS operations stay conditional until their own evidence gates are entered.

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
