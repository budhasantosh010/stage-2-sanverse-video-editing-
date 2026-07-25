# Task 8 Export Observability and Recovery

Date: 2026-07-14

## Why this change exists

The first owner export failed with a generic message. That proved the vertical slice was implementation-complete but not outcome-complete, and the generic UI discarded the information needed to diagnose the renderer.

## Verified failure

- Original owner run: failure visible; exact server detail was not retained.
- Controlled managed-environment replay: HTTP 500 in 72 ms.
- Captured root cause for that replay: `ffprobe` child-process launch rejected with `spawn EPERM`.
- Direct native FFmpeg: succeeds on the same source; a measured full render took about 151 seconds.

The managed replay does not prove the lost original run had the same cause.

## Change

- Classify synchronous and emitted launch errors.
- Map `EPERM` and `EACCES` to `RENDER_PROCESS_BLOCKED`.
- Return a sanitized HTTP 503 with the allowlisted code.
- Preserve the code in the browser client and show actionable PowerShell restart guidance.
- Keep accepted edits safe and expose a visible Retry action.

## Evidence

- Direct adapter/client/API contract: PASS.
- `@sanverse/api` TypeScript build: PASS.
- Web application TypeScript check: PASS.
- Fresh Vitest/Vite run: unavailable because this managed environment blocks its child process with `spawn EPERM` before collection.
- Owner normal-PowerShell export and downloaded-video acceptance: OPEN.

## Rollback

Revert the renderer error-code addition, server mapping, browser error class/message mapping, Studio Retry control, and their focused tests together. Do not retain a UI that promises actionable renderer errors if the API code is removed.
