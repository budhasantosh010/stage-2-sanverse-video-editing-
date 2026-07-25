# 2026-07-25 — Real-user end-to-end test, 64-bit identity fix, test-contract repair

Author: Claude (Fable 5) session, working in the owner's Stage 2 folder.
Purpose: hand off to Codex. This records what was tested, what broke, what was
fixed, and what remains open. Nothing here is aspirational.

## 1. What was performed

A real browser walkthrough of the whole product on a 30-second 1080p clip
derived from the owner's supplied footage, using the app's own UI at
`http://localhost:2000` — not unit tests.

Steps exercised: Home → typed request → MP4 intake → Studio → play/pause →
Point mode → click target → nameplate composer → create proposal → preview →
accept → undo → redo → Export → download → play the exported MP4.

Observation channels used throughout: browser screenshots, accessibility tree,
browser console, network requests, dev-server logs, on-disk project state, and
`ffprobe`/frame extraction on the exported file.

## 2. The blocking defect found (was breaking every new upload)

**Symptom.** Upload returned HTTP 201 and the project was written correctly to
disk, but Studio immediately showed *"This browser could not preview this
MP4."* `GET /api/projects/<id>/media` returned **404** for the project that had
just been created. A user is fully blocked at this point.

**Root cause.** `openControlledFile` in
`apps/api/src/projects/filesystem-project-repository.ts` proves file identity
before streaming. Its `identityAvailable` guard required
`Number.isSafeInteger(value.ino)`. Windows now issues 64-bit NTFS file IDs that
exceed `Number.MAX_SAFE_INTEGER`, so `stat()` returned an inexact `ino`, the
guard treated identity as unprovable, and the request failed closed to 404.

**Why it looked like it worked before.** The July 14 test projects happened to
receive small inode values. Only files created later got large IDs. So the
July 14 export succeeded while every subsequent upload would fail. Export
downloads would have failed for the same reason.

**Fix.** Both identity guards in that file now read `{ bigint: true }` stats, so
`dev`/`ino`/`nlink`/`size` compare exactly as BigInt. `size` is converted with
`Number(...)` at the single point where a numeric byte offset is needed. The
`identityAvailable`/`sameIdentity` helpers already supported bigint; they were
never receiving it.

`readControlledProjectState` was changed in the same way. It was not broken
(it lacks the safe-integer guard), but it compared potentially-rounded inode
numbers, which is a weaker check and a second, inconsistent idiom in one file.

**Not changed:** `resolvePublishedExport` and the render adapter's output check
only compare `size`/`nlink`, which are small and exact as numbers.

## 3. Second defect: misleading failure copy

Studio blamed the browser and the video for a failure whose cause it cannot
know — the actual cause was server-side. Copy now states that the video could
not be played, that it may be unavailable or unsupported, and offers reload or
return to Home. Its test asserts the neutral wording.

## 4. Third defect: five stale App tests

`apps/web/src/app/App.test.tsx` had 5 failures caused by the new recent-projects
feature, not by product bugs. Home lists recent projects on every render, adding
a `GET /api/projects` call that older tests did not expect: raw `fetch` call
counts were off by one, and `mockResolvedValueOnce`/`mockReturnValueOnce` queues
were being consumed by the listing instead of the request under test.

Repair approach (no product code changed): a shared `exceptRecentProjects(...)`
helper answers the listing with an empty list and delegates everything else, and
assertions now count intake requests (`POST /api/projects`) explicitly rather
than total `fetch` calls. One test also used `/^undo$/i` where the accessible
name is `Undo edit`.

## 5. Verified evidence after the fixes

- **220/220 tests pass**: 57 api + 129 web + 34 edit-domain.
- All three workspace builds pass (`npm run build`).
- Live re-test after restart: `GET /media` 200 for all four projects (two of
  which previously 404'd), project reopen restores saved history and shows
  "Saved locally", export download returns 200.
- Exported MP4 verified by probe and frames: H.264 1920×1080, 30.03s, AAC audio
  present; nameplate renders at the clicked position from 5s and is absent at
  15s; style matches the Studio preview (the earlier white-box mismatch is gone).
- Stored `source.mp4` SHA-256 equals the original file's — source is immutable.
- No browser console errors and no server errors during the walkthrough.
- Accepted/undone/redone history was confirmed written to
  `.sanverse-data/projects/<id>/edit-project.json` after each action.

## 6. Render timing

The 30-second 1080p export took roughly 60–85 seconds of FFmpeg wall time,
single-threaded and CPU-only. The owner has explicitly deprioritized render
speed for now (to be addressed later with GPU/preset work). It is recorded here
as a known cost, not as an accepted product experience.

## 7. Git state

- Local `main` had drifted one commit behind `origin/main` because an earlier
  session pushed via a bridge copy. `git reset --mixed origin/main` realigned
  the pointer without touching any file.
- All work is committed as `fcc41eb` and pushed. `main` and `origin/main` are
  identical (`git rev-list --left-right --count main...origin/main` → `0 0`).
- `.claude/launch.json` was added: a small launch config so the app can be
  started from an IDE preview. It does not affect `npm run dev`.

## 8. Honest product status

Working end to end, by real use: upload, immutable project copy, recent
projects, reopen with saved history, playback, point targeting, nameplate
proposal, preview, accept, undo, redo, persistence to disk, export, download,
correct exported output.

Not built: chat/AI interpretation (the Chat box is a disabled placeholder), cut,
trim, split, timeline, motion, effects, captions, multiple component types,
accounts, or cloud deployment.

So the deterministic foundation the plan called for is now real and verified.
The AI-operated edit — the defining capability of the product — has not been
started.

## 9. Known UX gaps observed during the walkthrough (none blocking)

- The Home draft request does not carry into a reopened recent project.
- Recent projects show repeated truncated titles with redundant button text and
  no thumbnail or duration.
- Export shows only "Exporting…" with no progress or estimate for over a minute.
- One click on a recent-project button did nothing and required a retry.
- Studio still reads like an engineering preview: numbered section labels,
  "Preview mode" and "Chat unavailable" notices, and several disabled controls.

## 10. Caveat on test method

The file was delivered to the page's own file input by script because no
automation can drive a native Windows file picker. This exercises the same
application code path, but a human drag-and-drop gesture has still not been
verified.
