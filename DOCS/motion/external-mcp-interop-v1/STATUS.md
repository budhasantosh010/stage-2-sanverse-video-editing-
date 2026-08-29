# SANVERSE External MCP Interoperability V1

Status: **COMPLETE — LOCAL RELEASE**
Date: **2026-08-29**
Baseline: `c978416f047081a4da500a3a3d6614677122ecb6` / `sanverse-production-editor-creative-engine-v1.6`
Local tag: `sanverse-external-mcp-interop-v1`

## Scope law

This milestone makes the existing production-backed Sanverse MCP usable by standard external coding clients. It does not add a client-specific MCP engine, AI provider, project store, Motion Graph, approval store, renderer or Undo authority. Codex, Claude Code and OpenCode are configured only as MCP clients; their model/provider accounts are not part of the release gate and are left for owner use/validation. No GitHub fetch/pull/push/PR/Actions and no `sites/**` work are part of the release. The raw-video/model benchmark was not run.

## One authority

- Production `EditProject` remains canonical in the existing API.
- Each MCP connection owns only one session-local existing Closed-Loop workflow/sandbox instance.
- State-sensitive tool execution refreshes the canonical project through the production API before invoking the existing registry.
- Production apply/Undo stays outside the external surface; isolated `apply_approved_sandbox` / `undo_last_creative_merge` are not exposed as production history.
- External owner-approval JSON is refused before the owner-gated internal tool can execute.

## Standard protocol and transports

The existing custom MCP adapter is preserved for internal compatibility. The external surface now uses the official `@modelcontextprotocol/sdk` and supports the standard `initialize → initialized → tools/list → tools/call` flow.

Supported transports:

- **Streamable HTTP** at loopback `/mcp`.
- **STDIO** through `scripts/sanverse-mcp-stdio.mjs` / `npm run sanverse:mcp:stdio`.

HTTP safety:

- loopback binding;
- local Host validation;
- non-local Origin refusal;
- local bearer-token requirement;
- standard MCP session IDs;
- per-session registry/workflow isolation;
- health reports `activeSessions`;
- explicit termination removes sessions immediately;
- abandoned sessions expire after a bounded idle period;
- request body ceiling;
- no credential values in committed evidence/event logs.

## Production-facing external surface

Current external production registry: **34 tools**.

Three small semantic interop helpers delegate into existing V1.6 workflow/graph authority:

- `production.create_creative_sandbox`
- `production.set_sandbox_selected_opacity`
- `production.get_sandbox_review`

The harmless deterministic proof flow is:

`production.get_creative_context` → create isolated sandbox → set selected semantic-node opacity through canonical storyboard/Motion Graph revision logic → deterministic sandbox review → discard sandbox → reread production context.

No accepted-project mutation is required to prove the MCP layer itself.

## Client setup

`npm run sanverse:mcp:setup` is dry-run by default.

`npm run sanverse:mcp:setup -- --apply`:

- backs up Codex, Claude Code and OpenCode config first;
- replaces only the MCP entry named `sanverse`;
- configures standard Streamable HTTP;
- leaves unrelated MCP entries, model/provider settings and permissions untouched;
- keeps the local bearer credential under ignored `.sanverse-data/mcp/` and does not print it.

`--remove` removes only Sanverse connectivity and its matching user token environment variable.

Detected/configurable clients on the release machine:

- Codex `0.144.1`
- Claude Code `2.1.168`
- OpenCode `1.18.8`

Actual model/provider-driven editing inside those clients is intentionally **not** a release test. The owner will validate normal usage directly.

## Deterministic safety and reliability evidence

Focused suites pass:

- `@sanverse/motion-mcp`: **22/22**
- `@sanverse/creative-production-adapter`: **14/14**
- both package TypeScript builds: **PASS**

Covered behavior includes:

- official initialize/list/call handshake;
- authenticated HTTP;
- non-local Origin refusal;
- owner-approval forgery refusal;
- production revision fencing;
- concurrent client sandbox separation;
- cross-sandbox refusal;
- stale accepted revision refusal before sandbox mutation;
- canonical opacity edit + deterministic review;
- discard leaves accepted project unchanged;
- session termination/reconnect;
- abandoned-session expiry.

## Long-run audit

Command: `npm run sanverse:mcp:audit-longrun`

Evidence: `DOCS/evidence/2026-08-29-external-mcp-interop-v1/longrun-report.json`

- **50** fresh standard HTTP sessions;
- **300** MCP tool calls;
- **50** deterministic sandbox reviews;
- accepted production project unchanged;
- final `activeSessions = 0`;
- raw-video benchmark run: **false**.

## STDIO audit

Command: `npm run sanverse:mcp:audit-stdio`

Evidence: `DOCS/evidence/2026-08-29-external-mcp-interop-v1/stdio-report.json`

- official SDK STDIO client/server handshake;
- **34** tools discovered;
- one production-backed sandbox opacity edit/review/discard cycle;
- accepted project unchanged;
- server stderr clean.

## Full repository verification

Authoritative pre-release repository matrix: **2,956 / 2,956 PASS across 25 workspaces**.

Key counts:

- production Web: **1,238 / 1,238**
- API: **403 / 403**
- Creative production adapter: **14 / 14**
- Motion MCP: **22 / 22**
- Edit Domain: **488 / 488**
- Motion Graph: **139 / 139**
- Motion Library: **202 / 202**
- Render Contract: **119 / 119**

Root all-workspace `npm run build`: **PASS**.

Final hygiene before sealing:

- `git diff --check`: PASS
- `sites/**` diff: **0**
- raw media additions: **0**
- committed bearer/API-key-like literals: **0**
- no GitHub remote operation performed

## Benchmark starter kit

Prepared but **not executed**:

`motion/fixtures/external-mcp-interop-v1/`

- `README.md`
- `benchmark-cases.v1.json`
- `scorecard-template.v1.json`

It separates transport correctness, tool discovery, sandbox correctness, safety refusals, cleanup and future model quality rather than collapsing them into one score.

## Operational commands

- `npm run sanverse:mcp:dev` — reuse/start API and loopback MCP host.
- `npm run sanverse:mcp:status` — compact production/API status.
- `npm run sanverse:mcp:setup` — dry-run client config plan.
- `npm run sanverse:mcp:setup -- --apply` — reversible client setup.
- `npm run sanverse:mcp:verify` — installed/configured/endpoint-ready report only; it does **not** invoke any AI model/provider.
- `npm run sanverse:mcp:audit-longrun` — deterministic HTTP lifecycle stress.
- `npm run sanverse:mcp:audit-stdio` — deterministic STDIO transport audit.

## Release rule

The coherent local release is tagged `sanverse-external-mcp-interop-v1`. Post-tag verification must keep the full repository matrix and root build green, confirm HEAD/tag parity and a clean tree, then stop. No later milestone begins automatically.
