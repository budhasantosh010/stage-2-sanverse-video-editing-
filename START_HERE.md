# Start Here

This is the smallest authoritative resume point for a new or compacted session.

## Macro goal

Take a cleaned talking-head video plus natural multimodal user intent—chat, pointing, drawing, and simple direct manipulation—and produce an editable, verified, polished export in minutes, without requiring the user to learn a professional video editor.

## Current gate

- **Active engineering line:** `external-mcp-raw-video-v1`; verify the newest HEAD with Git. The latest engineering slice is **REQ-025 — Pre-Storyboard Creative Direction + Approved Style Lock V1**.
- Raw-video flow is now Source Understanding → **Creative Direction owner gate** → opportunity planning → Storyboard → Animatic → Motion. Brand Context is evidence only. A persisted/revisable Creative Direction proposal is not authority; only exact trusted-host approval of one review revision/evidence hash creates the content-derived Approved Style Lock. Reopening direction invalidates downstream active authority without mutating accepted production state.
- Standard local Sanverse MCP discovery is now **73 tools**, adding `creative.propose_direction`, `creative.get_direction`, `creative.revise_direction`, and `creative.reopen_direction`. Opportunity planning/scene creation require the exact approved Style Lock and propagate its ID, content hash and direction revision through Storyboard/Motion/immutable artifacts.
- Deterministic STDIO acceptance proves planning refusal before approval, revision/stale-review fencing, trusted test-host direction approval, exact Style Lock provenance and the full source-composited General Storyboard authoring battery with zero production mutation. Three fresh STDIO processes prove pending review continuity before approval and exact Style Lock continuity after approval. Real Codex `0.144.1` independently proves the model-facing gate to pending revision 2 while deliberately not fabricating visual owner approval.
- The authoritative clean single-fork repository regression exits `0`: Web **1,239/1,239**, API **411/411**, Creative Direction **46/46**, Creative Production Adapter **37/37**, Edit Domain **491/491**, Motion Library **202/202**, Motion Graph **148/148**, Render Contract **121/121**, Motion MCP **30/30**, Motion Agent Tools **30/30**, and Motion Storyboard **16/16**, with all other workspaces green. Production dependency audit is 0 vulnerabilities at every severity. Evidence: `DOCS/evidence/2026-09-01-creative-direction-style-lock-v1/`.
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
