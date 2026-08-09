# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- **P1-F.1E Complete Timeline Experience is complete through Gate T3.** T0, T1, T2 and T3 are DONE; T4 through T7 are NOT STARTED.
- The authoritative gate table and invariants live in `DOCS/evidence/2026-08-04-timeline-completion/PROGRAM_STATE.md`.
- Final T3 evidence is `DOCS/evidence/2026-08-04-timeline-completion/T3_FINAL_CLOSURE.md` plus the T3 browser screenshots, exact-frame Trim View evidence, long-form bounds evidence, and export frames in the same folder.
- T3 adds explicit Standard/Ripple Trim, Roll, Slip, Slide, trim-to-playhead, deterministic Extend, J/K/L shuttle, detached Dynamic Trim, Audio Scrubbing, edit-point selection, all-or-nothing multi-edit-point trim, exact numeric precision, and bounded exact-frame Trim View on top of the existing T2 project/time authority.
- Final suites: API 403/403, Web 1,297/1,297, edit-domain 500/500, intent-domain 27/27, render-contract 118/118 — **2,345/2,345 total** — plus an all-workspace production build PASS.
- Final real Edge workflow on owner media proved Standard Trim, Ripple Trim, Roll, Slip, Slide, shuttle, Dynamic Trim cancel/commit, Audio Scrubbing, numeric precision, multi-edit-point refusal atomicity, Trim View, zoom persistence, reload and exactly one video, with responsive proof at 1440×900, 1280×800, 1024×768 and 390×844.
- Final T3 export: 23.900000 s, 1920×1080 H.264 High at 30 fps, AAC-LC stereo/48 kHz, 717 video frames, 10,899,271 bytes, SHA-256 `79FDA906C32B6454ED83B6A8FF1F513C906B7770690A82086E49F9F695E08F38`; sampled frames decoded and were visually inspected.
- The two late T2 defects remain regression-protected: Hold Frame command routing (FAIL-053) and Rate Stretch preserving Reverse (FAIL-054).
- **Do not start T4 unless the owner explicitly authorizes it.** A separate agent owns the Motion Graphics Library workstream; do not integrate or modify its protected paths from the Timeline program.
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
