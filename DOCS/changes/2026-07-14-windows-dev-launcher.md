# Windows Development Launcher Correction

Date: 2026-07-14

## Observable result

The documented root `npm run dev` command now remains running on this Windows laptop and coordinates the API and web workspaces instead of failing immediately with `spawn EINVAL`.

## Root cause

The launcher passed `npm.cmd` directly to Node's no-shell `spawn` API. Node 24 on Windows rejects that batch-file invocation. The launcher now executes npm's JavaScript CLI through the current Node executable, while keeping fixed argument arrays and no shell.

## Evidence

- The original root command reproduced `Error: spawn EINVAL` at `scripts/dev.mjs`.
- A focused regression specifies the Windows Node-plus-npm-CLI invocation.
- Direct cross-platform assertions pass for Windows and non-Windows selection.
- The API TypeScript build passes.
- After the correction, the root process remained active until the smoke-check process was intentionally terminated; neither port remained occupied afterward.
- The managed sandbox still blocks Vitest worker creation with `spawn EPERM`, so no fresh Vitest pass is claimed.

## Rollback

Revert the launcher helper and its focused regression together. Doing so restores the confirmed Windows startup failure on this machine.
