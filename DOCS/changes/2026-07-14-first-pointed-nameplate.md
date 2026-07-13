# First Pointed Nameplate Workflow Connected

Date: 2026-07-14

## Observable result

After importing an MP4, pointing, creating a nameplate proposal, and accepting it, the Studio Export control now renders accepted history through the local API and exposes a downloadable verified MP4. Rendering, failure, and ready states are visible; failures preserve accepted edits and permit retry.

## Controlled boundaries

- The browser submits only the opaque project ID and canonical history.
- The API accepts bounded JSON, revalidates history, and obtains every filesystem path from the project repository.
- Opaque generated export IDs select fixed project-local `.mp4` paths; client text never becomes a path.
- Export media uses same-origin full/range serving and an attachment filename.
- Browser navigation or edit mutation cancels or invalidates an in-flight or stale result.
- Chat, AI, persistence, timeline, effects, accounts, and cloud operations remain outside this slice.

## Evidence

- Test-first API, repository, browser-client, Studio-state, and full-App integration specifications were added.
- API and web production TypeScript checks pass.
- The browser export client direct contract passes.
- Direct HTTP composition passes real MP4 intake, empty-history rejection, controlled path allocation, validated accepted history, publication, full/range download, traversal rejection, and matching SHA-256.
- The downloaded composition fixture probes at 640 by 360, exactly two seconds, with audio.
- A focused no-child-process check passes opened-file path replacement, empty/multiply-linked export rejection, accepted-history export creation, and full/range download.
- Independent security and logic review initially blocked pathname re-open and two test-contract defects. Handle-bound streaming, fail-closed file identity checks, and corrected contracts closed them; final re-review passed.
- The managed sandbox blocks Vite/Vitest collection and Node-spawned FFmpeg with `spawn EPERM`; Task 7's prior real FFmpeg evidence is retained as the renderer proof. No fresh Vitest or combined FFmpeg claim is made.

## Remaining gate

The owner must complete and accept the representative browser workflow. That E4 gate measures clarity, render time, audio/video playback, placement meaning, and preview/export fidelity.

## Rollback

Remove the project-export client, Studio export state/UI, export API routes, repository export allocation/serving methods, and this record together. Existing intake media and accepted in-memory history remain unaffected.
