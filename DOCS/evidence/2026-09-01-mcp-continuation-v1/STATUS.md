# Sanverse MCP same-task continuation — status

Date: 2026-09-01

## Verdict

PASS for the Sanverse continuation contract.

A coding task/session is durable client state; the local Sanverse STDIO process is disposable transport state. Restarting the client/process/laptop must relaunch/reinitialize MCP and continue the same task/session rather than creating a new chat.

## Provider-independent transport proof

`npm run sanverse:mcp:audit-continuation` used the existing persisted fixture:

- project `project_21c01709e413d034d4cec25dcb4b1ca4`
- run `run_00n2km2k`
- review `review_000cuypa`
- expected stage `animatic-review`

Process A connected, exposed 62 tools, selected the project, resumed the run and retrieved the pending review plus three chat images. Process A was closed completely before Process B was created. Process B then connected independently and recovered the exact same run stage, review ID/status, subject ID/revision, evidence hash and artifact SHA-256 identities.

Repeated final runs connected both fresh transports within the expected local startup window. The exact sample varies naturally by launch and is therefore recorded only in machine-readable evidence.

- handshake-timeout evidence: false / false
- production mutation requested: false

Machine-readable evidence, including the latest exact per-process timings: `stdio-reconnect.json`.

## Real Codex same-session proof

Codex `0.144.1` process A started a durable thread:

`01a05984-09c9-77a0-a660-f22c44d334d1`

It called Sanverse read-only and returned:

`CODEX_CONTINUATION_A stage=animatic-review review_id=review_000cuypa artifact_count=3`

That Codex process then exited completely. A separate Codex process used `codex exec resume` with the exact same thread ID. The resumed thread relaunched/reconnected Sanverse, re-read the persisted review, and returned:

`CODEX_CONTINUATION_B stage=animatic-review review_id=review_000cuypa artifact_count=3`

The second process reported the same `thread_id` in its `thread.started` event. No Sanverse mutation was requested in either turn.

## Client-host boundary

A server cannot inject tools into an already-running client host that has cached an MCP startup failure and never sends another MCP initialize/tools request. If such a live host has no in-process reconnect control, its runtime must be restarted/reinitialized while preserving the same task/session ID. That is not a new task/chat.

The cold-start handshake fix remains active: MCP handshake/tool discovery begins before API/web warm-up completes, while production tool execution waits for shared runtime readiness.
