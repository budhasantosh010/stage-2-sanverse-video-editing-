# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- Completed macro stage: **G0 — Foundation and continuity**
- Active macro stage: **G1 — Interface design and renderer feasibility spike**
- Product code: **not started**
- Owner authorization: approved on 2026-07-12 after creating the GitHub repository and instructing work to continue.
- G1 boundary: validate the workflow and renderer architecture; do not silently expand into G2's production project engine.

## Read in this order

1. `AGENTS.md`
2. `DOCS/CURRENT_STATE.md`
3. `DOCS/HANDOVER_RUNBOOK.md`
4. `DOCS/GOALS.md`
5. `DOCS/REQUIREMENTS.md`
6. `DOCS/DECISIONS.md`
7. The active plan in `DOCS/plans/`
8. Relevant entries in `DOCS/PROJECT_LOG.md`, `DOCS/FAILURE_REGISTRY.md`, and `DOCS/changes/`

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
