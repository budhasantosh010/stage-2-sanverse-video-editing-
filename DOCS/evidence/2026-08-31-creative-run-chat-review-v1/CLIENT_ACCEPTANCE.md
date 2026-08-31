# Real client acceptance

Date: 2026-08-31

Both client smokes were deliberately read-only after the persisted STDIO audit had advanced the fixture to an Animatic review. Each client was instructed to use only Sanverse MCP, select the persisted project, resume the persisted Creative Run, inspect the pending review, and make no approve/revise/reject/create/modify/delete action.

## Codex

Result: PASS

Observed final response:

`SANVERSE_CREATIVE_RUN_OK client=codex stage=animatic-review review_id=review_000cuypa artifact_count=3 status=pending`

Sanverse MCP calls completed for project selection, run resume and review retrieval. The Codex process also printed unrelated local models-cache/skill-frontmatter warnings; those did not prevent Sanverse calls and are recorded in `FAILURES.md` without modifying unrelated client configuration.

## OpenCode

Result: PASS

Observed final response:

`SANVERSE_CREATIVE_RUN_OK client=opencode stage=animatic-review review_id=review_000cuypa artifact_count=3 status=pending`

OpenCode independently selected the same project, resumed the same Creative Run and retrieved the same pending review. The smoke used a free OpenCode model and did not invoke the Modal GPU path.

## Meaning

These are interoperability/reconnect proofs, not owner approvals. Neither client changed the run during these smokes. The shared persisted review state, not chat/session memory, was the source of truth.
