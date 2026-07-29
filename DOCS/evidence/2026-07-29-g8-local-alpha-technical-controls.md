# G6/G8 technical-control batch - 2026-07-29

## Completed technical tasks

### G6-11 - motion timing and fidelity

- One canonical evaluator has focused contracts at start, middle,
  frame-before-end, and exact end for translation, scale, rotation, opacity,
  crop, layer, mask, linear, cubic-Bezier, spring, bounce, and reduced motion.
- Repeated evaluation is deterministic and reduced motion resolves to the final
  authored state without spatial travel.
- Browser preview and native export both call that evaluator. Existing real
  native fixtures cover media motion/effects and isolated written layers.
- Direct contract result: 2/2 passed.

This is adapter/evaluator fidelity evidence, not an owner verdict on motion
feel. That verdict remains G6-12.

### G8-03 - durable local export jobs

- Export creation persists a versioned job before work starts.
- Each job carries stable job/export IDs, exact project-revision snapshot,
  SHA-256 idempotency key, bounded progress, attempts, result/error, and status.
- Concurrent creates for one key produce one job. Restart converts interrupted
  `running` work back to `queued` and reruns the immutable snapshot.
- The API exposes create/status/cancel. Browser export polls status and sends
  cancellation when its request is aborted.
- Diagnostics reports real queued/running/failed counts.
- Direct persistence/deduplication/restart contract: 1/1 passed.

Progress is milestone progress (0, 5%, 15%, 100%), not invented frame
percentage. FFmpeg does not yet expose trustworthy per-frame progress here.

### G8-04 - portable project archive and integrity

- The versioned JSON archive contains canonical project state,
  content-addressed media references, byte lengths, media kinds, current
  project schema, component/recipe versions, and a SHA-256 integrity record.
- Import validates a closed schema, supported operations, media manifest, and
  archive hash before touching saved state.
- Restore maps references only to matching media already imported into the
  target project, revalidates the complete project, and persists atomically.
- No filesystem path, traversal string, or symlink enters the archive contract.
  Missing media fails visibly.
- Direct export/restore/corruption/traversal/missing-media contracts: 2/2 passed.

The archive uses portable SHA-256 references instead of embedding
multi-gigabyte video bytes in JSON. Matching media must be imported first.

### G8-07 - safe cleanup and retention

- `GET /api/projects/:id/retention` lists only controlled exports as deletable.
- Source media, project state, and imported assets are explicitly protected.
- `DELETE /api/projects/:id/exports/:exportId` accepts only opaque IDs,
  validates the controlled regular file, deletes exactly that export, and
  flushes the directory.
- Automatic deletion is off. External/original source media is never deleted.

### G8-08 - accessibility and keyboard audit

- Both screens expose visible-on-focus skip links to their primary work.
- Import/export progress uses live status semantics; failures use alerts.
- Point mode has keyboard focus, Escape cancellation, names, and focus return;
  proposal/result/export states manage focus.
- Global focus-visible rings and reduced-motion overrides remain mandatory.
- Repair inputs/actions now meet a 44-pixel minimum target.
- The black/white token system keeps ordinary text on light surfaces.

Manual assistive-technology and representative-user evidence belongs to
G8-12; this closes the code/keyboard audit, not that human gate.

### G8-09 - corrupt/malicious media and recovery

The bounded suite covers invalid MP4 signatures/brands, filename/path
traversal, declared-size mismatch, aborted/partial upload cleanup, range abuse,
invalid project/history/actions, stale revisions, renderer path and
hard-link/symlink races, cancellation races, corrupt portable hashes, unknown
archive fields, missing referenced media, atomic state recovery, and
interrupted-job recovery. The new direct contracts passed 5/5 checks.

### G8-10 - largest measured bottleneck

The adapter forced one encoder thread. On the representative `test-30s.mp4`,
the same first 10 seconds at libx264 `medium`, CRF 18 measured:

| Setting | Time | Output bytes |
|---|---:|---:|
| 1 thread | 33,090 ms | 4,580,951 |
| 4 threads | 13,917 ms | 4,581,325 |

Four fixed threads are 2.38x faster. The adapter now pins four threads while
retaining codec, preset, CRF, pixel format, and bounded execution.

## Focused verification

- API TypeScript build: passed.
- Web application TypeScript check: passed.
- Node direct contracts: 5/5 passed.
- Full Vitest/Vite: not rerun because the managed environment still returns
  the recorded `spawn EPERM` (FAIL-011).

## Remaining gates

Owner approvals, real-provider credentials, repeated owner workflows,
representative non-editor smoke tests, agreed E5 budgets, and G9's external
client need cannot be supplied by implementation code and remain open.
