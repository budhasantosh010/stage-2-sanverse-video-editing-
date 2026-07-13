# Immutable Local Project Intake

Date: 2026-07-13

## Linked requirements and decisions

- REQ-003 — Safe, non-destructive editing
- REQ-005 — Production-grade architecture from day one
- REQ-009 — Evidence-based accuracy
- REQ-013 — Web delivery and fixed local port
- DEC-002 — Modular monolith with production-grade boundaries

## Observable acceptance criterion

Selecting a valid MP4 through `http://localhost:2000` creates a complete immutable project-owned copy and integrity manifest behind the same-origin `/api` boundary before Studio opens. Invalid, conflicting, oversized, truncated, aborted, unsafe, or partially written input fails visibly and publishes no project.

## Architecture

- The HTTP route owns request/response translation only.
- A service validates filename, MIME, configured size, actual byte count, MP4 file-type box, project identity, time, and manifest data.
- An HTTP-neutral repository port accepts `AsyncIterable<Uint8Array>` rather than request objects or filesystem paths.
- The filesystem adapter owns fixed paths, exclusive writes, partial-write completion, staging cleanup, file synchronization, read-only defense-in-depth, atomic project publication, safe lookup, and media ranges.
- The local API binds to `127.0.0.1:2001`; Vite exposes it through `/api` on the strict user-facing port 2000.
- Root `npm run dev` coordinates both processes and terminates the known process tree on Windows.

## Safety and recovery

- Client filenames and IDs are never used as filesystem paths.
- The service requires a safe `.mp4` filename plus a bounded ISO-BMFF `ftyp` box with an allowed MP4 brand; empty/octet-stream MIME is advisory, while an explicit conflicting MIME fails.
- Declared and actual byte limits are enforced while streaming; SHA-256 and size describe the bytes written to the project copy.
- Staging is invisible to readers and is removed on stream, validation, write, sync, collision, manifest, or publication failure.
- Media lookup validates opaque IDs, rejects path/symlink substitution, opens one stream per request, clamps valid single ranges, returns exact-size 416 responses, and cancels iterators on disconnect/error.
- The web blocks duplicate same-batch intake, shows importing and recoverable failure states, cancels on unmount, and opens Studio only after a validated HTTP 201 response.

## Evidence

- TDD RED began with absent API/repository/server modules, then absent web intake/proxy/lifecycle behavior.
- Independent quality review exposed stream leaks, post-header failures, incorrect range behavior, partial writes, Windows process-tree risk, untyped binary decode failure, and same-batch duplicate intake. Each was reproduced by a focused failing regression before correction.
- Final automated evidence: 30 API tests, 118 web tests, and 34 edit-domain tests pass (182 total).
- API, web, and edit-domain production builds pass.
- `git diff --check`, independent spec review, and independent quality/security re-review pass.
- A post-review runtime smoke exposed that Node's configured strip-only TypeScript loader rejected two parameter properties. A focused strip-compatibility regression was added, both classes now use standard fields, and the actual API entry graph loads under the configured command.
- A 142,738-byte MP4 derived from one second of the owner's real 189,751,984-byte MOV passed actual HTTP intake, immutable publication, full-media retrieval, and 32-byte range retrieval. Source, manifest, and downloaded SHA-256 values matched; the range returned `206` with `bytes 0-31/142738`.

## Honest limitations

- The real-video-derived integration sample is intentionally short; it does not prove full 189.8 MB intake performance. The supplied owner fixture is MOV while the current intake contract accepts validated MP4 only.
- Windows process-tree shutdown is contract-tested with an injected launcher; tests do not execute real `taskkill`.
- Windows directory synchronization is best-effort where the operating system rejects directory handles; file sync plus same-filesystem atomic rename remain enforced.
- Project media and its manifest persist locally, but edit history is still in memory. Product rendering, export, AI, database, auth, and cloud storage remain absent.

## Rollback

Revert the single Task 6 commit. Remove ignored `.sanverse-data/` manually only if the owner wants to discard locally imported copies; Git rollback intentionally does not delete user media.
