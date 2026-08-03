# Handover Runbook

Use this runbook when a new session, agent, or context window resumes the project.

## Current handoff

**P1-F.1A Gate B — Media Library V2 Essentials is complete**, with evidence in
`DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/`.

The one thing to carry forward: **a user's filing of their media lives on the
server beside the project, and is not part of the project.** Folders, sorting,
filtering and search change nothing about the video — proved byte-identical in
the real browser. `DOCS/decisions/ADR-MEDIA-ORGANIZATION-V1.md` holds the
reasoning, including what was rejected and why.

Media-to-Timeline drag is built and tested but switched off
(`MEDIA_DRAG_ENABLED = false` in
`apps/web/src/features/media/media-drag-contract.ts`). Gate C flips that one
boolean, adds a visible affordance, and makes Timeline lanes accept
`application/vnd.sanverse.media-drag+json`.

Suites: 1,283 total (web 631, edit-domain 312, api 248, render-contract 65,
intent-domain 27). All-workspace build passes.

**Gate C (Creator Timeline Core) has not started. Gate D has not started.
P1-F.2 has not started.** Two pre-existing defects are open and recorded:
FAIL-047 and FAIL-048.

Read in this order when resuming: `DOCS/HANDOFF.md`, `DOCS/CURRENT_STATE.md`,
then the Gate B evidence above.

### Previous handoff
## Fast resume

1. Read `START_HERE.md`.
2. Run `git status --short --branch`.
3. Read `DOCS/CURRENT_STATE.md` and `DOCS/BUILD_TRACKER.md`.
4. Read the active plan named in current state.
5. Read relevant requirements, decisions, failures, and recent change records.
6. Run the smallest verification command relevant to the active acceptance criterion.
7. Tell the owner what is verified, assumed, and next before materially changing direction.

## After compaction

Do not reconstruct the project from the compacted chat summary alone. Reload committed project truth and reconcile it with the owner's newest message. If they conflict, the newest explicit owner correction wins and the durable files must be updated before proceeding.

## Handover packet checklist

- Current goal and exact status
- Last completed acceptance criterion
- Current acceptance criterion
- Files intentionally changed
- Verification commands and their results
- Known failures, limitations, and unverified claims
- Next action and permission gate
- Git branch, commit, and remote state

## P1-F.0.2.2 resume note

The latest technical milestone is the completed Media responsive presentation
and Editor Monitor V1. Preserve `SanverseEditorMonitor` around the existing
single video/content layer and keep `.media-bin__results` as Media's only scroll
owner. The next proposed milestone is Media V2, but it is not authorized by this
checkpoint.

## Stop conditions

Stop and ask the owner when:

- A new interpretation materially changes product scope.
- A destructive or public external action was not explicitly authorized.
- A renderer/provider choice lacks the evidence required by its decision gate.
- A semantic operation cannot distinguish safe execution from a plausible wrong edit.
- Existing user changes conflict with the planned edit.
