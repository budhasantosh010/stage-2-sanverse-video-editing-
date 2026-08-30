# Zero-Setup Workspace Import Fix V1

Date: 2026-08-30
Branch: `external-mcp-raw-video-v1`
Base commit: `c3d036faecbd3516bb081803205a19ed89dfdc32`

## Result

The local STDIO launcher now preserves the coding agent's caller working directory before switching Sanverse itself to the repository root. That caller directory becomes the validated, session-scoped import boundary for local STDIO only.

Final local flow:

`coding-agent current folder -> sanverse-mcp-stdio.mjs -> SANVERSE_MCP_CALLER_WORKSPACE (child-process only) -> validated STDIO session workspaceRoot -> Sanverse import/discovery confinement`

No user environment variable, import-root setting, token, config edit, or second terminal is required. HTTP keeps the previous explicit-root-only behavior and receives no automatic workspace grant.

## Product behavior

- `source.list_workspace_inputs` is a new read-only MCP tool. It exposes only supported workspace-relative video/transcript/image metadata and never returns the absolute workspace path.
- `production.import_source_video` accepts a relative path such as `check .mp4` and resolves it against the captured STDIO workspace.
- `source.attach_transcript` accepts a workspace-relative `localPath` such as `check.srt`; Sanverse reads it through the same confinement boundary.
- Absolute paths remain valid only when they resolve inside the permitted workspace.
- Parent/sibling traversal, outside absolute paths, symlink/junction files, invalid/symlink workspace roots, and UNC workspace roots fail closed.
- Every STDIO process carries its own workspace context; there is no global last-used import folder.

## Verification

- Motion MCP: **30/30 PASS**.
- Creative Production Adapter: **32/32 PASS**.
- Affected package TypeScript builds: **PASS**.
- Zero-setup verifier: **53 tools**, caller-workspace discovery PASS, absolute-path leakage false, API/web ready, no legacy token environment variable.
- Real Codex acceptance from the original `check 1` workspace containing one MP4 + one SRT recorded `source.list_workspace_inputs` -> `production.import_source_video` -> `source.attach_transcript` -> `source.analyze_video`, all `ok=true`.
- The previous `IMPORT_ROOT_NOT_ALLOWED` failure did not recur.

