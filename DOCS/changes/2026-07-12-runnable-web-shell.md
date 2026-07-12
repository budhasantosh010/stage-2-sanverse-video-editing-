# Change Record — Runnable Web Shell

Date: 2026-07-12

## Classification

- **Owner requirements:** REQ-010 (cleaned MP4 boundary), REQ-012 (calm Home before Studio), and REQ-013 (web delivery on strict local port 2000).
- **Approved decisions:** DEC-004 (two-stage interface) and DEC-009 (runnable shell before remaining renderer work).
- **Observable acceptance criterion:** From the repository root, the owner can start the application at `http://localhost:2000`, enter a prompt, choose or drop a cleaned MP4, preview it in Studio, see that the prompt is a draft and not executed, understand that editing/export are unavailable, and return Home. A second server must fail visibly when port 2000 is occupied.

## Implemented scope

- Added a React/TypeScript/Vite npm workspace with a strict port-2000 development server.
- Added typed Home-to-Studio state and local MP4 validation/object-URL lifecycle handling.
- Added the calm Home screen, honest Studio preview shell, recoverable media-error state, and responsive grayscale visual system.
- Added component and integration coverage for the implemented browser-only flow.
- Added exact startup, port-conflict, local-file, and owner-walkthrough documentation.

This is a frontend shell, not a working video editor. No backend, upload, persistence, AI, real editing, renderer integration, or export exists.

## Verification evidence

- `npm test -- --run`: 46 of 46 tests passed.
- `npm run build`: production build passed.
- Live server at `127.0.0.1:2000`: returned HTTP 200.
- Live in-app browser at 1280 by 720: Home DOM was accessible, the viewport rendered correctly, the prompt had a unique label, and its controlled value updated.
- A second `npm run dev`: exited with status 1 and displayed `Error: Port 2000 is already in use`.
- Automated Studio component/integration tests cover the local video source, draft-not-executed label, disabled unavailable actions, Back cleanup, and media-error recovery.
- `hooks/tests/verify_governance_scope.ps1`: passed, proving ignored dependency files are excluded while untracked non-ignored project files remain subject to secret scanning.
- Governance verification and `git diff --check` are rerun as part of this documentation change.

Under `DOCS/CHANGE_POLICY.md`, the controlled automated Home-to-Studio workflow has **E3** evidence. The live browser check verifies only Home and the strict local-server behavior. **E4 is not reached** because the owner has not yet completed a representative real-video walkthrough.

## Limitations and open gate

- The browser-control surface could not attach a local file to the native file input, so the agent did not perform a full manual Studio walkthrough in the browser.
- Owner hands-on file selection, playback, workflow, and visual feedback remain pending.
- G1-01B remains **In progress** until that owner feedback is recorded.
- Automated fixtures and code behavior do not prove real-video usability, visual quality, or editing capability.

## Migration and rollback

There is no data migration. The selected video remains local, the source file is unchanged, and its temporary object URL is revoked on Back or app unmount. The shell can be rolled back by reverting its coherent implementation commits and this documentation commit; no user media or persisted project data requires conversion.
