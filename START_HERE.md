# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- **Active engineering branch:** `external-mcp-raw-video-v1`. General Storyboard implementation/evidence baseline: `acff478efd024926b2cc455cd60efdd721030966` (`feat: add general storyboard authoring surface`). Verify current HEAD with Git because later documentation-only release-readiness syncs may sit above that implementation commit.
- **REQ-024 — General Storyboard Authoring Surface V1 is implementation + real-client complete.** External coding agents now have bounded typed canonical Motion Graph authoring inside the revision-fenced Storyboard sandbox: static properties, node/subtree replacement, semantic parts, atomic multi-KVS design transactions, Storyboard lock/reopen, source-composited review, durable reconnect, and approved-Storyboard → Motion structural continuity. Evidence: `DOCS/evidence/2026-09-01-general-storyboard-authoring-v1/`.
- Standard local Sanverse MCP discovery is **69 tools**. Real Codex `0.144.1` completed `$29 → £29`, shape → `ellipse`, KVS persistence checks, source-composite review images, and verified no accepted-production mutation. Deterministic STDIO authoring and process-restart continuation are also green.
- The current authoritative single-fork repository regression and all-workspace production build both exit `0`. Key exact counts from the authoring release candidate include Web **1,239/1,239**, API **411/411**, Edit Domain **491/491**, Motion Library **202/202**, Motion Graph **148/148**, Render Contract **120/120**, Creative Production Adapter **35/35**, Motion MCP **30/30**, Motion Agent Tools **30/30**, and Motion Storyboard **16/16**. Security/media hygiene is green: 0 production dependency vulnerabilities, 0 `sites/**` changes, 0 raw-media additions, 0 private-path additions, and 0 secret-like additions.
- **REQ-020 — External MCP raw-video orchestration remains an automated RC, not a human-certified release.** The automated 3-scene import → understanding → Storyboard/Animatic/Motion → atomic apply → preview/export → Undo/Redo chain is complete, but the immutable tag `sanverse-external-mcp-raw-video-v1` is intentionally withheld.
- What remains for that tag is genuinely different evidence: meaningful real spoken source media with truthful timed transcript/source evidence, a representative target of about 10 opportunities/10 scenes, legitimate owner Storyboard/timing/Motion approvals, representative preview/export parity captures, and an actual 1× watch of the complete final export.
- The currently persisted `check .mp4` project is a real 29.49-second video with audio, but its attached analysis transcript is synthetic one-cue text spanning the whole clip. That text is **not** proof of what was spoken or when. The shipped transcription adapter explicitly returns `TRANSCRIPTION_DISABLED` and there is no wired local/offline recognizer, so do not manufacture ten source moments from that synthetic cue. A truthful sidecar/transcription or another meaningful spoken source is required before the manual ten-scene release proof can begin.
- General authorization to continue implementation/testing does not substitute for unseen visual approval or a 1× watch. Finish all machine-verifiable work, but never mint owner approvals or the final tag from broad authorization alone.
- Product-wide older P1/G1/G5-C/G6/G7/G8 human evidence gaps still exist, but they are not the active engineering gate for this branch. G10+ SaaS/advanced branches remain conditional unless separately entered.

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
