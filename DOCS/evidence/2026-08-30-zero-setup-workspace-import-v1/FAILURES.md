# Workspace Import Fix — Failure Record

Date: 2026-08-30

Only failures encountered while closing this patch are recorded here. Non-blocking external-client problems were not chased after the owner asked to prioritize the high-impact Sanverse path.

## WI-FAIL-001 — `IMPORT_ROOT_NOT_ALLOWED` in real Codex workflow

- **What:** `production.import_source_video` refused the video because no MCP import root existed.
- **Where:** Local STDIO Sanverse session launched by Codex from the owner's video workspace.
- **When:** First real zero-setup video benchmark after the prior zero-setup MCP release.
- **Who:** Any local Codex/OpenCode/Claude STDIO session with no manually configured `SANVERSE_MCP_IMPORT_ROOT(S)`.
- **Why:** `sanverse-mcp-stdio.mjs` changed CWD to the Sanverse repo before `scripts/sanverse-mcp.ts` could know the caller folder; `parseImportRootsV1()` therefore returned an empty list.
- **How reproduced:** Open coding agent in folder containing MP4 + SRT, call `production.import_source_video`, observe `IMPORT_ROOT_NOT_ALLOWED`.
- **What was tried:** Added caller-CWD capture in the launcher, transport/session workspace context, validated workspace-root resolution, workspace-relative import/transcript resolution, and read-only workspace discovery.
- **Status:** **FIXED.** Real Codex now completes discovery -> import -> transcript attach -> analysis with all four MCP events `ok=true`.
- **Single-line solution:** Capture `process.cwd()` in the STDIO launcher and pass it as the validated session-only Sanverse import root before switching Sanverse CWD to the repo.

## WI-FAIL-002 — Initial focused tests were red during implementation

- **What:** New tests failed because the workspace resolver and HTTP/STDIO transport context did not exist yet.
- **Where:** `@sanverse/motion-mcp` focused suite.
- **When:** First red test run for this patch.
- **Who:** Development verification only.
- **Why:** Tests were added before implementation to pin the missing behavior.
- **How reproduced:** Run the Motion MCP tests before implementing the workspace resolver/context.
- **What was tried:** Implemented the resolver and explicit transport context.
- **Status:** **FIXED — 30/30 PASS.**
- **Single-line solution:** Implement the workspace resolver and transport-scoped registry context required by the tests.

## WI-FAIL-003 — TypeScript narrowing errors in transcript `localPath` branch

- **What:** Two compile errors: an `unknown` localPath and widened transcript format type.
- **Where:** `packages/creative-production-adapter/src/external-orchestration.ts`.
- **When:** First affected-package build after adding workspace transcript support.
- **Who:** Build-time only.
- **Why:** Runtime validation did not preserve TypeScript narrowing across the async branch.
- **How reproduced:** Build `@sanverse/creative-production-adapter` after the first implementation pass.
- **What was tried:** Bound validated values in typed locals and explicitly typed transcript format.
- **Status:** **FIXED — affected package builds PASS.**
- **Single-line solution:** Preserve validated values in typed locals before the asynchronous transcript-file branch.

## WI-FAIL-004 — OpenCode acceptance initially stalled, then passed

- **What:** The first OpenCode run did not immediately produce a Sanverse tool turn.
- **Where:** OpenCode 1.18.8 in the same video workspace.
- **When:** Post-fix client acceptance.
- **Who:** OpenCode model/provider execution only.
- **Why:** The separate 4097 OpenCode server was initially not listening.
- **How reproduced:** Start the bounded OpenCode MCP-only prompt with that server absent.
- **What was tried:** Started the OpenCode server on 4097 and allowed one bounded retry.
- **Status:** **RESOLVED.** Sanverse event evidence later recorded all four calls `ok=true`: workspace discovery -> video import -> transcript attach -> source analysis.
- **Single-line solution:** Ensure the normal OpenCode 4097 model service is available; the Sanverse workspace import path itself needs no further change.

## WI-FAIL-005 — Claude model acceptance blocked by CLI login

- **What:** Claude CLI reported `Not logged in · Please run /login` before a model/tool turn.
- **Where:** Claude Code CLI in the same video workspace.
- **When:** Post-fix client acceptance attempt.
- **Who:** Claude account/session only.
- **Why:** Claude Code is not authenticated on this machine/session.
- **How reproduced:** Run the bounded Claude MCP-only prompt.
- **What was tried:** One noninteractive invocation only; no account changes were made.
- **Status:** **NON-BLOCKING / NOT PURSUED.**
- **Single-line solution:** Log Claude Code in, then rerun the same workspace MCP prompt.

## WI-FAIL-006 — Full root build exceeded bounded Harness time

- **What:** `npm run build` exceeded the 180-second Harness timeout without reporting a build error.
- **Where:** Repository-wide root build.
- **When:** Final closure verification.
- **Who:** Verification harness only.
- **Why:** The all-workspace build takes longer than the bounded command window on this machine.
- **How reproduced:** Run root `npm run build` with a 180-second Harness timeout.
- **What was tried:** Confirmed no build process remained; both directly affected workspace builds pass.
- **Status:** **NON-BLOCKING / NOT RETRIED** to avoid low-value time/token spend.
- **Single-line solution:** Run the root build later with a longer allowance only if a repository-wide release gate specifically requires it.

