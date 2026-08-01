# Handover Runbook

Use this runbook when a new session, agent, or context window resumes the project.

## Current handoff

P1-E.1 Studio Vertical Flow is technically complete with evidence at `DOCS/evidence/2026-08-01-p1e1-studio-vertical-flow/`. The browser document is the one outer vertical-scroll authority; Studio uses natural height, the complete Timeline is reachable, and the existing geometry controller refreshes Canvas/Point alignment after page scroll. P1-E Media Bin remains complete at `DOCS/evidence/2026-07-31-p1e-media-bin-v1/`. P1-F has not started. Unused asset deletion remains deferred until a server-authoritative service exists; `FAIL-021` and `INFRA-005` remain monitoring.

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
