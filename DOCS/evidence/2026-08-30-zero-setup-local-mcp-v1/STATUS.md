# Sanverse Zero-Setup Local MCP V1 — Evidence

Date: 2026-08-30
Branch: `external-mcp-raw-video-v1`
Status: **implementation + local client verification complete**

## Owner-visible result

After the one-time coding-agent setup, the owner can open Codex, Claude Code or OpenCode normally and use the configured `sanverse` MCP without manually starting `sanverse:mcp:dev`, copying a bearer token, setting a Sanverse environment variable or editing MCP config.

The default local path is STDIO:

`client → scripts/sanverse-mcp-stdio.mjs → auto-start/reuse API + web/render → same 52-tool Sanverse registry`

HTTP remains implemented for explicit debugging/future remote-style use; it is not the default local-agent path.

## Runtime proof

- Direct STDIO verifier: **52 tools**.
- Zero-project startup: **PASS** (`projectCount = 0`).
- Production API after launcher: **ready**.
- Web/render service after launcher: **ready**.
- STDIO stderr protocol check: **clean**.
- Local STDIO bearer token required: **no**.
- Persistent legacy `SANVERSE_MCP_TOKEN` user environment variable: **absent**.
- API/web child output is redirected to ignored `.sanverse-data/mcp/runtime` logs; STDIO stdout remains MCP framing only.

A cold Windows run exposed one real defect before acceptance: starting npm indirectly through `cmd.exe` split the installed `C:\Program Files\...` path. The fixed launcher resolves npm's actual `npm-cli.js` and invokes it with `node.exe`; the subsequent cold startup passed.

## Client proof

### Codex

- Installed: `codex-cli 0.144.1`.
- `sanverse` config: local STDIO.
- API/web were explicitly stopped before the real test.
- A fresh `codex exec --ephemeral` process was instructed to use only Sanverse and call `production.list_projects`.
- Client response: `SANVERSE_MCP_OK project_count=0`.
- Sanverse event log recorded:
  - client: `codex-mcp-client`
  - version: `0.144.1`
  - tool: `production.list_projects`
  - `ok: true`

### OpenCode

- Installed: `1.18.8`.
- `sanverse` config: local STDIO; `opencode mcp list` reports **connected**.
- A cold standalone OpenCode process was observed launching its own `sanverse-mcp-stdio.mjs` child and automatically starting the Sanverse API + web service; its model-driven noninteractive session did not exit cleanly and was not counted as a tool-call proof.
- A separate real OpenCode model-driven run through the owner's already-running OpenCode 4097 service then called `production.list_projects` through the configured Sanverse MCP.
- Sanverse event log recorded:
  - client: `opencode`
  - version: `1.18.8`
  - tool: `production.list_projects`
  - `ok: true`
- The bounded OpenCode proof process was cleaned up afterward.

### Claude Code

- Installed: `2.1.168`.
- `sanverse` config: user-scope local STDIO.
- `claude mcp get sanverse` reports **Connected**.
- The model-driven noninteractive Claude test timed out before a Sanverse tool call was recorded.
- On 2026-08-30 the owner explicitly instructed: leave Claude Code model testing for now; configuration connectivity is sufficient. No stronger Claude tool-call claim is made here.

## Safety / authority invariants

This transport change does not create a new project, Motion Graph, approval, renderer, export, revision, Undo or Redo authority. The same 52 tools delegate to the existing production API/internal registry. Sandbox-first mutation, live revision fencing, host-only owner approval and existing production apply/export controls remain unchanged.

## Regression/build

- Motion MCP: **27/27 PASS**.
- Creative Production Adapter: **30/30 PASS**.
- Full documented Windows single-fork all-workspace regression: **PASS / exit 0**; test inventory unchanged at **2,990 tests across 25 workspaces**.
- Root all-workspace production build: **PASS / exit 0**.
- Existing non-blocking Vite warnings remain: large output chunks and runtime-resolved `/api/render-assets/nameplate-font`.

Machine-readable evidence: `zero-setup-report.json`.
