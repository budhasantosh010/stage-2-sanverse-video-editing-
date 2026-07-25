# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- Completed macro stage: **G0 — Foundation and continuity**
- Active macro stage: **G1 — Runnable web UX validation and renderer feasibility**
- Product code: a runnable local web application exists at strict http://localhost:2000. It imports an MP4 through a loopback-only API into an immutable project-owned copy, supports point capture, a bounded nameplate proposal, typed preview, exactly-once acceptance, in-memory undo/redo, and now sends accepted history through the production FFmpeg adapter to a downloadable MP4.
- **2026-07-25 — the manual loop is now verified end to end in a real browser.** A full walkthrough on a 30-second 1080p clip completed: upload, reopen from Recent projects, point, nameplate, preview, accept, undo, redo, export, download, and correct exported output (probe plus frames). Read `DOCS/changes/2026-07-25-claude-e2e-test-and-identity-fix.md` before doing anything else.
- That walkthrough found and fixed a defect that was blocking **every new upload**: the media identity guard rejected Windows 64-bit NTFS file IDs, so each newly created project returned 404 for its own video. See FAIL-006. Both guards now read bigint stats.
- Present persistence boundary: local project media, its integrity manifest, **and accepted edit history** persist under ignored `.sanverse-data/`. History survives reload and reopen; Home lists recent projects.
- Immediate next gate: **the first AI-operated edit (Task 10)**. The deterministic foundation beneath it is proven, so chat interpretation is now the correct next capability. Render speed is explicitly deprioritized by the owner. Open cosmetic/UX gaps are listed in section 9 of the 2026-07-25 change record.
- Absent capabilities: no AI/chat interpretation, no cut/trim/split, no timeline, no motion or effects, no captions, no additional component types, no accounts, and no SaaS operations. Chat in Studio is a visible disabled placeholder.
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
