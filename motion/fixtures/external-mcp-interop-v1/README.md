# External MCP Interoperability V1 — Benchmark Starter Kit

This directory is a **starter kit only**. The owner explicitly deferred the raw-video/model benchmark, so this release does not run one and does not publish quality scores for Codex, Claude Code, OpenCode, or any model.

The cases describe deterministic interoperability checks over the existing Sanverse production-backed MCP surface. Candidate edits stay inside per-client sandboxes; accepted production state must remain unchanged unless a future benchmark explicitly includes an owner-approved production-apply case.

## Run law

1. Start/reuse the production API and MCP host with `npm run sanverse:mcp:dev`.
2. Configure clients reversibly with `npm run sanverse:mcp:setup -- --apply`.
3. Use a dedicated synthetic or owner-approved benchmark project. Never benchmark against private source media by accident.
4. Capture the exact client/version/model/provider separately from MCP transport results.
5. Treat connection, tool discovery, correct sandbox mutation, deterministic review, discard, stale-revision refusal, owner-approval refusal, and accepted-project preservation as separate scorecard fields.
6. Do not count an MCP health check as a model-driven tool-call pass.
7. Do not count a partial sequence as a pass.
8. Never put bearer tokens, prompts containing secrets, raw media, or model chain-of-thought in evidence.

## Files

- `benchmark-cases.v1.json` — deterministic case definitions and expected outcomes.
- `scorecard-template.v1.json` — blank per-client/model result schema for a future benchmark run.

The automated release verifier is `npm run sanverse:mcp:verify`; deterministic long-run transport/session evidence is `npm run sanverse:mcp:audit-longrun`.
