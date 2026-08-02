# Handover Runbook

Use this runbook when a new session, agent, or context window resumes the project.

## Current handoff

P1-F.0.2 Nested Studio Layout Engine V2 is complete with evidence at `DOCS/evidence/2026-08-03-p1f02-nested-studio-layout-v2/`. The typed/versioned nested panel adapter preserves one editor authority, one mounted video, continuous playhead/draft/proposal/history, and the existing preview/export path. Full suites pass 1,158/1,158 and the all-workspace build passes. P1-F.1 and P1-F.2 have not started. Screenshot capture recurrence INFRA-004 and local HMR host mismatch INFRA-005 are documented nonblocking infrastructure work.

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

## Stop conditions

Stop and ask the owner when:

- A new interpretation materially changes product scope.
- A destructive or public external action was not explicitly authorized.
- A renderer/provider choice lacks the evidence required by its decision gate.
- A semantic operation cannot distinguish safe execution from a plausible wrong edit.
- Existing user changes conflict with the planned edit.
