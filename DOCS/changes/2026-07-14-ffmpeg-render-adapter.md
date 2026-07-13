# Deterministic FFmpeg Renderer Adapter

Date: 2026-07-14

## Observable result

Validated accepted nameplate history can now be translated through a replaceable renderer port into a real MP4 without passing user text to a shell or FFmpeg filter syntax. The output preserves source dimensions, duration, and audio, is hashed, and is published only after validation.

## Safety boundary

- The service revalidates history and delegates accepted actions only.
- The adapter revalidates runtime actions and bounds action count and UTF-8 text bytes.
- User text and the trusted font are copied to fixed private filenames; filter arguments contain no raw user text or external font path.
- FFmpeg and FFprobe run through argument arrays with `shell: false`.
- The output parent is canonicalized, private partial media stays in a unique render directory, FFmpeg overwrite is disabled, and partial output must be one regular unaliased file.
- Publication uses create-if-absent same-filesystem linking and cannot overwrite an existing export.
- Cancellation waits for process close, interrupts hashing, rechecks before publication, cleans private files, and never publishes a cancelled render.
- Output probes enforce source width, height, duration tolerance, and audio presence.

## Evidence

- API and edit-domain TypeScript builds pass.
- Web TypeScript check passes.
- Both governance checks, static security scan, and `git diff --check` pass.
- Two real FFmpeg renders from a two-second 640 by 360 owner-video derivative plus audio have identical SHA-256 `7c99b6e08c822fb828e38a22f2aec96d69bea0229dbb58b6d70868000b4c1356`; duration, dimensions, and audio are preserved.
- Direct runtime checks pass accepted-history delegation, configured Node loading, canonical junction handling, private partial output, hard-link rejection, atomic publication, cleanup, post-spawn cancellation, close-before-settlement, and cancellation immediately before publication.
- Independent security/logic review blocked the initial implementation, verified two correction cycles, and ended PASS with no remaining blocker.

## Honest limitations

- The current managed sandbox blocks Vite/Vitest child processes with `spawn EPERM`, so the focused tests are committed and type-checked but no fresh Vitest pass count is claimed here.
- The web app does not call this renderer yet. Task 8 owns API wiring, progress, recoverable failures, result download, and the owner workflow.
- The nameplate uses provisional top-left anchor semantics and a fixed v1 size; the owner has not approved that placement meaning.
- The real evidence is two seconds at 640 by 360 on this machine, not a long-video performance or cross-machine determinism proof.

## Rollback

Remove the Task 7 renderer files and the API workspace dependency on `@sanverse/edit-domain`, then restore the edit-domain/web compiler import settings together. No user media or export is tracked by Git.
