# Handover Runbook

Use this runbook when a new session, agent, or context window resumes the project.

## Current handoff

P1-F.0.1 Studio Workspaces and Docking V1 is technically complete with evidence at `DOCS/evidence/2026-08-01-p1f01-studio-workspaces-docking-v1/`. Studio has Edit, Effects, Color, and Audio presentation views over one editor authority; validated local presets and bounded docks/splitters create no operation or project revision. Real Edge preserved one video, AI draft, playhead, selection, and revision `15 → 15` across all workspaces and required responsive sizes, then exported a verified 1080p H.264/AAC MP4 with zero page/console/HTTP errors. Full suites pass 1,145/1,145 and the all-workspace build passes. P1-F.0, P1-E.1, and P1-E remain complete. P1-F.1 and P1-F.2 have not started. Unused asset deletion remains deferred until a server-authoritative service exists; `FAIL-021` and `INFRA-005` remain monitoring.

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
