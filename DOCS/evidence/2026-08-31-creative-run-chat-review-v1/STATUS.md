# Chat-first review + resumable Creative Run V1 — status

Date: 2026-08-31
Branch: `external-mcp-raw-video-v1`

## Result

Engineering implementation is complete for the chat-first/resumable Creative Run slice. The final raw-video human release tag remains intentionally out of scope: this slice does not fabricate the broader release's human 1× final-video approval gate.

## Verified behavior

- Creative Runs and review records persist under project-scoped local Sanverse data and rehydrate into a fresh orchestration/MCP session.
- Storyboard, Animatic and Motion review state is revision/evidence bound; stale or mismatched state fails closed.
- Review evidence is rendered from the canonical Creative scene runtime, persisted with SHA-256 metadata, rehashed before chat/browser presentation, and never exposes absolute artifact paths to the model.
- Standard STDIO review presentation returns native MCP image content. The real audit returned exactly three Storyboard frames, then exactly three new Animatic frames after Storyboard approval.
- Ordinary tool JSON cannot populate trusted review-decision context. The trusted decision bridge validates exact run/review/scope/scene/subject/revision/evidence identity before the host-only approval authority can mint/resolve approval.
- The STDIO implementation uses the MCP v2 multi-round-trip `input_required` API plus the SDK compatibility shim. The installed SDK/client combination exercised the compatibility path; this evidence does not claim a 2026-07-28 wire-version negotiation that the installed package does not advertise.
- Clients without elicitation can use a trusted local-browser fallback. It binds only `127.0.0.1`, uses one-time random URL and form nonce material, verifies artifact SHA-256 before serving evidence, and returns only the human confirmation result to the host bridge.
- Request-state is integrity protected with a 32-byte `createRequestStateCodec` key, ten-minute TTL and MCP-method binding. Returned state, elicitation content and current persisted review are all revalidated before approval context is injected.
- Request revision resets only the targeted scene's downstream approval lineage. Reject excludes only the targeted scene; sibling scene workflow/review state remains intact.
- Opportunity planning now means “up to N useful moments”: candidates validate independently, small overlaps may be conservatively trimmed, materially bad candidates are rejected individually, and one bad custom candidate no longer destroys valid siblings or forces generic filler to reach an exact count.

## Verification

- Real STDIO Creative Run audit: PASS, 62 discoverable tools.
- Audit first session: three Storyboard chat images, one trusted owner-confirmation round, then one Animatic review with three chat images.
- Audit reconnect session: resumed the same run at `animatic-review`, same pending review identity, three chat images.
- Real Codex client: PASS — selected the persisted project, resumed the run and read the same pending Animatic review without mutation.
- Real OpenCode client: PASS — independently resumed the same run/review without mutation.
- Render Contract: 120/120 PASS.
- Creative Production Adapter: 34/34 PASS.
- Motion MCP: 30/30 PASS.
- Motion Agent Tools: 30/30 PASS.
- Creative Run filesystem store: 2/2 PASS.
- Trusted browser review fallback: 2/2 PASS.
- All touched TypeScript package builds: PASS.
- All-workspace repository test command: exit 0.
- Root all-workspace production build: exit 0.
- Fresh production dependency audit: 0 critical / 0 high / 0 moderate / 0 low.

## Release boundary

This feature branch may be committed and pushed under the owner's standing publication authorization. Do not merge `main` here and do not create the final raw-video release tag. The broader raw-video release still owns its separate meaningful-source, legitimate owner multi-stage approvals and final 1× exported-video review gates.
