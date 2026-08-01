# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- **P1-E.1 — Studio Vertical Flow is technically complete.** Evidence: `DOCS/evidence/2026-08-01-p1e1-studio-vertical-flow/`.
- The browser document is the one outer vertical-scroll authority. Studio uses natural height and normal-flow rows, so the upper workspace and complete Production Timeline can extend below the fold instead of being compressed into one viewport.
- Media, Inspector, and AI retain bounded internal scrolling while ordinary browser scroll chaining remains available.
- Real Edge proved page scroll and complete Timeline reachability at 1440×900, 1280×800, 1024×768, and 390×844 with no horizontal page overflow.
- Page scrolling preserves playhead, Timeline selection, zoom, horizontal scroll, accepted revision, one main video, and five lanes.
- Canvas and Point use the existing displayed-video-content geometry after page scroll; one passive geometry-refresh listener is cleaned up on unmount.
- **P1-E — Media Bin V1 remains complete.** Import, search, filters, shared names, usage, source probing, B-roll/music placement, missing-media truth, and responsive Media behavior remain intact.
- Final suites pass: web 476/476, edit-domain 265/265, API 235/235, render-contract 51/51, intent-domain 27/27, plus the all-workspace build.
- No second project, history, page-scroll owner, video-layout observer, media library, editor selection, visual draft, schema, operation family, API route, renderer architecture, or runtime dependency was added.
- **P1-F has not started.** Begin P1-F.0 only from the clean pushed P1-E.1 commit.
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
