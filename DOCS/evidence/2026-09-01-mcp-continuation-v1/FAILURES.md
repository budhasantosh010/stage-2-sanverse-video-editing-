# Continuation investigation failures

Date: 2026-09-01

## F-01 — Earlier guidance conflated client runtime restart with creating a new task

- What: after the Sanverse cold-start hotfix, an older coding task still reported that it had no Sanverse tools, and the initial recovery guidance said to start a brand-new task/session.
- Where: operator guidance around an already-running client host that had cached an earlier MCP startup failure.
- When: 2026-09-01 continuation investigation.
- Who: integration/recovery guidance, not persisted Sanverse Creative state.
- Why: task/session identity and MCP process identity were incorrectly treated as one lifetime.
- How: a failed live tool registry was interpreted as requiring a replacement conversation rather than reinitializing transport while preserving the same durable task/session ID.
- Tried: separated durable client session identity from disposable STDIO transport identity; added REQ-023 and DEC-021; proved exact same Codex thread across two separate client processes plus exact persisted Creative Run recovery across two separate MCP processes.
- Status: RESOLVED.
- One-line solution: resume the same task/session ID and replace/reinitialize only the MCP/client runtime transport.

## F-02 — OpenCode model-driven continuation smoke stalls at generic `init`

- What: `opencode run --session ses_fa9190e4cffeL7YPE8YCXcb0hB ...` produced startup/config logs and then remained at generic `init` without starting a model/tool turn during the bounded investigation.
- Where: installed OpenCode `1.18.8` model-run initialization.
- When: 2026-09-01 continuation verification.
- Who: OpenCode client/provider initialization path; no Sanverse MCP timeout/refusal was emitted.
- Why: not established in this task. A non-resumed throwaway `opencode run` control stalled at the same `init` point, so the stall is not specific to session continuation. A normal non-pure run also exposed an unrelated local plugin error: `hook-matchers.ts` attempted to call `HookRegistry` without `new`.
- How: repeated with the old session ID, with `--pure`, with an explicit free model, and with a custom test config that disabled the other MCP servers and left only Sanverse enabled. `opencode mcp list` under that isolated config still reported `sanverse connected`; the fresh throwaway model run nevertheless stalled at the same generic `init` point.
- Tried: isolated plugins, unrelated MCPs, session history and model choice. Did not modify protected unrelated user plugin/provider configuration because the same-session Sanverse contract was independently provable and the user requested focused work.
- Status: NONBLOCKING for Sanverse continuation; separate OpenCode runtime/provider issue remains if model-run startup is needed immediately.
- One-line solution: diagnose the current OpenCode model/provider initialization and malformed local plugin separately; do not treat it as an MCP/session-continuation failure.

## F-03 — Codex local cache/skill warnings remain unrelated noise

- What: real Codex continuation processes printed a models-cache schema warning and malformed local skill-frontmatter warnings.
- Where: installed Codex local cache/skills outside Sanverse.
- When: both process A and resumed process B.
- Who: Codex local environment.
- Why: pre-existing local cache/skill files do not match the installed Codex version's expected format.
- How: warnings appear during Codex startup, but the Sanverse MCP calls and exact same-thread continuation both completed successfully.
- Tried: no unrelated client-file repair in this task.
- Status: NONBLOCKING.
- One-line solution: repair Codex cache/skill files separately only if their warnings become disruptive.
