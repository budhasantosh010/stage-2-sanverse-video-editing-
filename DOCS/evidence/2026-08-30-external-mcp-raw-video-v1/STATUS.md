# External MCP Raw-Video Creative Orchestration V1 — Automated RC Evidence

Date: 2026-08-30
Branch: `external-mcp-raw-video-v1`
Release status: **implementation + automated RC complete; final immutable release tag withheld for the separate human real-source review gate**

## Authority result

The implementation remains additive over the existing Sanverse authorities:

- one canonical `EditProject`, production revision and ChangeSet/history/Undo/Redo authority;
- one canonical Motion Scene/Graph and 1,440,000-tick timing authority;
- one immutable project-local Creative artifact representation for accepted generated scenes;
- one normal production preview path and one existing FFmpeg export-job authority;
- MCP owns protocol/session/orchestration adaptation only and cannot mint owner approval.

No alternate MCP project store, accepted-history store, Motion graph, approval store, animation clock or final-pixel authority was introduced.

## Batch completion

| Batch | Result |
|---|---|
| 1 — zero-project bootstrap / intake / transcript / source understanding | PASS |
| 2 — deterministic opportunity planning / generalized multi-scene sessions | PASS |
| 3 — exact host owner-gated Storyboard → Animatic → Motion workflow | PASS |
| 4 — immutable Creative artifacts / generic production operation / atomic apply / Undo-Redo | PASS |
| 5 — normal production preview / exact-tick export / deterministic seek / pixel parity | PASS |
| 6 — additive MCP surface / HTTP + STDIO / export-status-cancel / bounded raw-video E2E | PASS |

## MCP compatibility

- Previous external surface preserved: **34 tools**.
- Raw-video orchestration added: **18 tools**.
- Final discovery surface: **52 tools**.
- Zero-project MCP health: READY.
- Before project selection, project-specific legacy calls fail closed with `PROJECT_REQUIRED` instead of disappearing from discovery.
- After project selection, the legacy surface is backed by the existing V1.6 production workflow.
- Official Streamable HTTP and STDIO MCP SDK clients both completed initialize/list/call flows.
- Codex `0.144.1`, Claude Code `2.1.168`, and OpenCode `1.18.8` were detected/configured by the existing verifier; that verification made no model/provider calls.

## Bounded raw-video E2E

Final clean-runtime HTTP acceptance started with zero projects and proved:

- initial project count: **0**;
- discovered tools: **52**;
- imported production revision: **0**;
- deterministic opportunities: **3**;
- isolated Creative scenes: **3**;
- exact test-host approvals: Storyboard **3**, Animatic **3**, Motion **3**;
- production acceptance: **one ChangeSet**, three `add-creative-scene` operations, project revision **0 → 1**;
- stale export revision: refused before export;
- one production Undo: removed the full three-scene batch;
- one production Redo: restored the full three-scene batch.

The bounded fixture intentionally proves orchestration/integration, not the later human creative-quality benchmark. Its three generated scenes used one component family; the manual release proof remains responsible for representative multi-family creative-quality evidence.

## Real exported media

Independent FFprobe/media verification of the produced file:

- video codec: **H.264**;
- audio codec: **AAC**;
- dimensions: **1280×720**;
- frame rate: **30 fps**;
- duration: **12.000000 s**;
- audio: **48 kHz stereo**;
- byte length: **7,174,167**;
- production SHA-256: `a6657b0bd18e624d43631ecfc23a2c505b838a955a18082cb444f275b48fe3ee`;
- downloaded SHA-256: identical.

## Preview / export / seek pixel proof

Real Edge/CDP sampled **3 accepted scenes × 5 critical exact ticks = 15 comparisons**.

- preview-surface pixels vs export-surface pixels at the same exact tick: **byte-identical PNG SHA-256**;
- direct / backward / random seek to the same tick: **byte-identical PNG SHA-256**;
- required final encoded MP4 SSIM floor: **0.960000**;
- minimum observed final MP4 SSIM: **0.969474**;
- result: **PASS**.

This proves the accepted Creative artifacts are rendered through the same canonical Motion component/graph/runtime authority in preview and exact-tick materialization. H.264 loss is measured only after that canonical frame stage.

## Windows production fixes found by real evidence

The E2E exposed two path-length problems that unit-only verification had not found:

1. Edge could fail to open the CDP debugging profile when `--user-data-dir` inherited the deeply nested worktree/project/export path. The disposable browser profile now uses a short OS-temp directory. It remains process cache only, never project/render authority.
2. Windows/Node could report `ENOENT` while launching an existing FFmpeg binary when the private render working directory became too deep. The disposable render workspace now lives as a short random sibling under Sanverse's canonical data-root `projects` area, preserving same-volume atomic publication without including the long project-ID segment.

Targeted renderer regression after these fixes: **22 / 22 PASS** plus API TypeScript build PASS, followed by the successful fresh zero-project E2E above.

## STDIO regression

Official STDIO audit on the additive surface:

- tools discovered: **52**;
- legacy production sandbox create/edit/review/discard: PASS after project selection;
- accepted production state after the sandbox cycle: **byte-identical / unchanged**;
- stderr safety check: PASS.

## Repository validation

The first heavily parallel root run produced four unchanged web 5-second timeouts with no assertion mismatch. The exact four tests then passed individually in roughly 1.0–1.25 seconds each. The documented Windows single-fork web suite passed **1,238 / 1,238** without production-code changes.

Final authoritative Windows single-fork all-workspace matrix:

- **2,990 / 2,990 tests PASS**;
- **25 workspaces**;
- production web: **1,238 / 1,238**;
- API: **411 / 411**;
- Creative production adapter: **30 / 30**;
- Edit Domain: **491 / 491**;
- Motion MCP: **27 / 27**;
- Motion Library: **202 / 202**;
- Render Contract: **119 / 119**;
- all remaining workspace suites: PASS.

Root `npm run build`: **PASS / exit 0 across all workspaces**. Existing Vite large-chunk warnings and the runtime-resolved nameplate-font warning remain non-blocking.

## Final hygiene

- `git diff --check`: **PASS**;
- `sites/**` diff: **0**;
- tracked raw media/image/audio additions: **0**;
- secret/credential literal candidates across all changed and new files: **0**;
- private `C:\Users\...` / `C:/Users/...` path additions across all changed and new files: **0**;
- historical External MCP Interop V1 evidence was restored unchanged after the new verifier run; this RC writes to its own `2026-08-30-external-mcp-raw-video-v1` evidence directory.

## Human-only release gate

The automated fixture and test-host approvals are not claimed as human creative acceptance. The final immutable `sanverse-external-mcp-raw-video-v1` tag remains withheld until the contract's manual release proof is actually performed with meaningful spoken source media, target ten opportunities/ten scenes, legitimate owner Storyboard/timing/Motion review, representative multi-family preview/export captures, and an actual 1× watch of the complete final export.

General authorization to continue implementation/testing permits all engineering work above; it does not substitute for evidence that unseen video output was personally watched.
