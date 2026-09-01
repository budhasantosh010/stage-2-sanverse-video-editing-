# Raw-video release readiness — blocking evidence gaps

Date: 2026-09-01

## F-01 — Mandatory resume documents pointed at historical P1 work

- **What:** `START_HERE.md` and `DOCS/HANDOVER_RUNBOOK.md` still named old P1-F milestones as the current handoff, while `DOCS/GOALS.md` still described G9 External MCP as hypothetical.
- **Where:** the mandatory reload path used by every new/compacted coding session.
- **When:** found during the post-`acff478e` release-readiness audit.
- **Who:** documentation state only; production code and accepted project state were unaffected.
- **Why:** later G9/MCP programs advanced faster than the oldest resume summaries were refreshed.
- **How:** compared the mandatory resume files against `CURRENT_STATE`, REQ-020/023/024, the active raw-video plan, current Git history, and the 69-tool evidence package.
- **Status:** RESOLVED in the documentation-only truth-sync following `acff478e`.
- **One-line solution:** keep the mandatory resume files updated in the same release-candidate change whenever the active branch/gate changes.

## F-02 — Current local transcript cannot prove real spoken timing

- **What:** the available `check .mp4` project has a real MP4/audio source, but its current attached transcript is a single analysis-only cue spanning the whole clip.
- **Where:** persisted Creative Run source context for the current local project.
- **When:** checked while trying to continue REQ-020's meaningful spoken-video/~10-scene final benchmark without waiting for anything machine-solvable.
- **Who:** release evidence only; no production mutation occurred.
- **Why:** the exact cue text is hard-coded audit input from `scripts/audit-creative-run-stdio.ts`, not speech-derived timestamp evidence.
- **How:** matched the persisted cue text against the audit script, inspected the project media metadata, and inspected the shipped transcription provider boundary.
- **Attempts:** searched available fixture/local sidecars and the production transcription path. No truthful timed sidecar for this real source was found. `NullTranscriptionAdapter` explicitly returns `TRANSCRIPTION_DISABLED` and no local/offline recognizer is wired.
- **Status:** BLOCKED on truthful source evidence, not on missing orchestration code.
- **One-line solution:** provide/import a real timed sidecar/transcription for meaningful spoken source media (or separately implement/authorize a truthful transcription provider), then run the existing ~10-scene release workflow and real owner review gates.

## F-03 — Broad engineering authorization is not visual/watch evidence

- **What:** the owner has authorized autonomous implementation/testing, but REQ-020 separately requires exact Storyboard/timing/Motion approvals plus an actual 1× watch of the completed export.
- **Where:** final raw-video immutable release tag gate.
- **When:** every attempt to decide whether the tag can be created from current evidence.
- **Who:** human review authority, not the coding agent or MCP model.
- **Why:** saying "continue without asking" proves permission to work; it does not prove that unseen pixels/timing were reviewed and accepted.
- **How:** REQ-020 and the active raw-video plan explicitly distinguish test-host/general authorization from legitimate owner visual review.
- **Status:** HUMAN-ONLY / OPEN.
- **One-line solution:** after the truthful meaningful-source benchmark exists, present the exact review evidence and record the owner's actual decisions and 1× watch before tagging.
