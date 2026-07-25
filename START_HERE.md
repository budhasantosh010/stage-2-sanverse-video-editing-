# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- Completed macro stage: **G0 — Foundation and continuity**
- Active macro stage: **G1 — Runnable web UX validation and renderer feasibility**
- Product code: a runnable local web application exists at strict http://localhost:2000. It imports an MP4 through a loopback-only API into an immutable project-owned copy, supports point capture, a bounded nameplate proposal, typed preview, exactly-once acceptance, in-memory undo/redo, and now sends accepted history through the production FFmpeg adapter to a downloadable MP4.
- Immediate next gate: the owner retries the complete upload-to-download workflow from normal PowerShell. The first real Export failed generically; the app now preserves and explains blocked-renderer failures and offers Retry, but the managed Codex environment cannot perform the decisive child-process run. Motion acceptance, preview/export fidelity, render time, and the exact click-to-nameplate anchor meaning remain open owner gates.
- Verified boundary: the first owner real-video walkthrough reached Studio and exposed concrete UX failures; the corrective code has automated evidence, while owner acceptance of the refinement is pending.
- Present persistence boundary: local project media and its integrity manifest persist under ignored `.sanverse-data/`; accepted edit history is still in memory and is discarded on Back, reload, or project replacement.
- Absent capabilities: no persisted edit history, database, AI, accounts, or SaaS operations exist. Export is clickable, but owner usability and preview/export fidelity are not yet accepted.
- Goal-status boundary: G1 remains open until its owner workflow and renderer evidence gates close. The owner has nevertheless explicitly authorized continuing Tasks 2–8 of the first manual vertical slice, including early canonical-project work, so implementation may proceed without claiming that G1 closed or that the G2/G3 macro exit gates were achieved. AI, accounts, and broad primitive work remain out of scope.

## Read in this order

1. `AGENTS.md`
2. `DOCS/CURRENT_STATE.md`
3. `DOCS/HANDOVER_RUNBOOK.md`
4. `DOCS/GOALS.md`
5. `DOCS/REQUIREMENTS.md`
6. `DOCS/DECISIONS.md`
7. The active plan in `DOCS/plans/`
8. Relevant entries in `DOCS/PROJECT_LOG.md`, `DOCS/FAILURE_REGISTRY.md`, and `DOCS/changes/`

For exact local startup and the pending owner walkthrough, read `DOCS/LOCAL_DEVELOPMENT.md`.

## Invariants

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
