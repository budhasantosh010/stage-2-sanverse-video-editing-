# External MCP Interoperability V1 evidence

Release scope: standards-compatible Sanverse MCP layer over the existing production-backed registry/authority. Actual model/provider-driven use inside Codex, Claude Code and OpenCode is owner validation and is not part of this release gate.

Retained deterministic evidence:

- `interop-report.json` — installed/configured client detection plus live MCP endpoint readiness; `modelOrProviderCallsRun` is `false`.
- `longrun-report.json` — 50 fresh Streamable HTTP sessions, 300 tool calls, 50 sandbox reviews, accepted production state unchanged, final active session count 0.
- `stdio-report.json` — official SDK STDIO handshake, 34 tools discovered, one sandbox edit/review/discard cycle, accepted production state unchanged.

No raw user/source media or generated export is committed here. The raw-video/model-quality benchmark was not run.
