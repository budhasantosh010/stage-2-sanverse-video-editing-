# Failure ledger — Chat-first review + resumable Creative Run V1

Date: 2026-08-31

## F-01 — STDIO host initialization failed before MCP handshake

- What: real STDIO audit returned an internal server error / failed to initialize.
- Where: local Sanverse STDIO host integration.
- When: first real Creative Run STDIO acceptance pass.
- Who: server integration fault; not a client/user action.
- Why: `materializeCreativeReviewEvidenceV1` was wired into the host registry without importing the symbol.
- How: real client/audit crossed package-only tests and exercised host startup.
- Tried: traced child stderr and host initialization boundary.
- Status: FIXED. Added the missing import; same audit proceeded past handshake.
- One-line solution: keep host-only review materializer imports covered by real STDIO startup acceptance.

## F-02 — Review-only Creative artifact rejected by production validation

- What: Storyboard review rendering failed with HTTP 400.
- Where: Creative scene artifact validation/intake.
- When: first canonical review-evidence materialization.
- Who: shared artifact contract, not user media.
- Why: the production artifact contract required a Motion owner-approval ID for every artifact, including non-applyable review-only artifacts.
- How: review renderer intentionally used the canonical production render surface before Motion approval.
- Tried: first separated review-purpose artifact semantics; then restarted stale API/web processes so the new validator was actually loaded.
- Status: FIXED. Artifacts now declare `artifactPurpose: 'review' | 'production'`; review artifacts may render without production approval, while production artifacts still fail closed without it. Dedicated render-contract test covers the distinction.
- One-line solution: keep purpose explicit and never allow a `review` artifact into production apply authority.

## F-03 — Decision response duplicated prior review images

- What: Storyboard approval response returned six images instead of only the three new Animatic images.
- Where: MCP v2 tool-result image attachment layer.
- When: first successful owner-confirmation round.
- Who: presentation-layer behavior.
- Why: generic result extraction collected both the just-decided review and `nextReview` evidence.
- How: the real audit asserted the intended chat UX after approval.
- Tried: narrowed decision-response attachment to next review evidence while leaving explicit review retrieval unchanged.
- Status: FIXED. Real audit now returns exactly three new Animatic images after Storyboard approval.
- One-line solution: decision responses should attach next actionable evidence, not replay already-decided evidence.

## F-04 — Root build exposed an API fixture compatibility miss

- What: root production build failed TypeScript compilation in `portable-project.contract.test.ts`.
- Where: API portable-project Creative artifact fixture.
- When: definitive all-workspace build after implementation.
- Who: test fixture only.
- Why: `artifactPurpose` became required in `CreativeSceneArtifactV1.governance`, but the old production fixture did not set it.
- How: package-focused builds did not compile that API fixture; the root build did.
- Tried: added `artifactPurpose: 'production'` to the existing fixture and reran the root build from scratch.
- Status: FIXED. Fresh root all-workspace build exited 0.
- One-line solution: update all explicit Creative artifact fixtures when the closed governance schema gains a required field.

## F-05 — Harness/ngrok transport instability during closure

- What: repeated network timeouts and one terminated Harness task session interrupted command/doc closure.
- Where: ChatGPT Harness local-ngrok transport, outside the repository runtime.
- When: several closure attempts after functional acceptance had already passed.
- Who: coding-tool connectivity.
- Why: external transport/session instability; repository commands that completed returned normal results.
- How: `session_status`, command and write calls intermittently failed at the connection layer.
- Tried: retried ngrok, checked direct Harness path, preserved worktree, and rebound the exact same existing worktree to a new task after the old session terminated.
- Status: NON-PRODUCT / RECOVERED enough to complete closure. No repository reset or duplicated worktree was performed.
- One-line solution: keep using resumable task/worktree identity and treat transport timeouts as infrastructure, never as build/test evidence.

## F-06 — Codex local cache/skill warnings during real client smoke

- What: Codex printed a stale models-cache parse warning plus malformed local skill-frontmatter warnings.
- Where: the installed Codex client's unrelated local configuration/skills.
- When: real read-only Sanverse resume smoke.
- Who: Codex local environment, not Sanverse MCP.
- Why: existing local cache/skill files were not in the expected Codex format.
- How: warnings were printed before/around the successful MCP calls.
- Tried: no repair in this task because all Sanverse MCP calls completed and unrelated client settings are protected scope.
- Status: NONBLOCKING. Codex successfully selected project, resumed run and read review.
- One-line solution: repair those Codex local cache/skill files separately if their warnings become disruptive.

## F-07 — Initial dependency audit warning after MCP SDK install

- What: package installation initially reported two high-severity audit findings.
- Where: transient dependency graph during SDK migration.
- When: early implementation.
- Who: npm dependency graph.
- Why: intermediate package resolution state during migration.
- How: surfaced directly from npm install/audit output.
- Tried: did not chase blindly during core implementation; reran a fresh production audit after the final lockfile settled.
- Status: RESOLVED in final tree. Fresh production audit reports 0 critical / 0 high / 0 moderate / 0 low.
- One-line solution: use the final lockfile audit as release truth, while preserving intermediate warnings in the failure ledger for traceability.

## Compatibility note — MCP wire revision

The implementation uses the MCP v2 server's multi-round-trip `input_required` API, signed request state and legacy compatibility shim. The installed SDK/client combination used for acceptance did not advertise a 2026-07-28 wire-version negotiation, so this evidence deliberately does not claim that exact negotiated protocol revision. The security and resumable decision semantics were exercised through the compatibility path that the installed clients actually use.
