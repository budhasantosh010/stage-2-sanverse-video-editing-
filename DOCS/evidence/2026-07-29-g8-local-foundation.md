# G8 local-alpha foundation — 2026-07-29

## G8-02 — autosave and crash recovery

Accepted edits, Undo, Redo, activation changes, asset additions, and migrations
all pass through `ProjectStateService.persist`. The filesystem adapter writes
bounded JSON to a unique same-directory temporary file, flushes the file,
closes it, atomically renames it to `edit-project.json`, then flushes the
directory. A failed write removes only its temporary file. The previously
published state remains the recovery point and pending proposals are never
persisted or auto-accepted.

Existing focused repository/service contracts prove atomic persistence,
canonical reload, migration-before-write, no write on rejected edits, and no
write on failed migration.

This does not claim resumable render jobs; that is G8-03.

## G8-05 — measured proxy/cache decision

The measured bottleneck remains first-time CPU video encoding: the current state
records roughly 60–90 seconds for one 30-second 1080p export. The native motion
spike itself is fast on tiny fixtures, but it does not change the long-video
measurement.

No proxy was added: every relevant media operation is local.

No render cache was added: it would accelerate only an identical repeated
project revision, not the first export or the next export after an edit. It
would also add invalidation and media-retention obligations before G8-03/G8-07.
The correct G8-05 result is therefore a measured no-cache decision, not
speculative infrastructure.

## G8-06 — safe local diagnostics

`GET /api/diagnostics` now returns a versioned, no-store JSON document containing:

- local app version;
- project and render-plan schema versions;
- FFmpeg renderer configured/not-configured state;
- safe intent-provider name;
- bounded job counts;
- optional stable error code and plain recovery instruction.

The builder allowlists safe characters and never reads or returns environment
variables, tokens, private paths, media names, project IDs, or user content.
The current job counts are zero until G8-03 connects the durable local job
store.
