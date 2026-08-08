# Gate T3 — Precision Trimming — Final Closure

Date: 2026-08-08
Branch: `timeline-t3-precision-trim`
Base: verified T2 commit `5a50e4bf84b928ac686bb903d1425b21c64ae890`

Gate T3 is **complete**. Gate T4 was not started.

## Product delivered

T3 adds one precision-editing layer over the existing accepted project/time authority:

- explicit Standard Trim, Ripple Trim, Roll, Slip, Slide and existing Rate Stretch tool ownership;
- one atomic `set-primary-clip-timings` accepted operation for compound precision timing changes;
- closed planner refusals for locks, source handles, collisions, unsupported items, groups, transitions, J/L, speed, reverse and Freeze semantics;
- trim-to-playhead, ripple-to-playhead and deterministic Extend commands through the same planners;
- J/K/L 1x/2x/4x/8x shuttle on the one composition playhead;
- detached Dynamic Trim with one commit or zero-operation cancel;
- Audio Scrubbing through the existing T2 composition-audio authority;
- focusable/additive edit-point selection and all-or-nothing multi-edit-point Roll;
- exact integer-tick numeric precision with rational project frame rate;
- bounded exact-frame Trim View using the existing Gate-D derived-media controller/cache.

No project-schema or render-plan bump was needed: T3 changes accepted primary timing that existing project v5 / render-plan v8 Preview and export already consume.

## Authority invariants

- one EditProject;
- one accepted history and Undo/Redo authority;
- one TimelineViewModel;
- one composition playhead;
- exactly one main HTMLVideoElement;
- one existing composition-audio authority;
- pointer movement remains detached presentation state;
- planner used by the ghost/Trim View is the planner used for commit;
- one completed compound gesture is at most one revision and one Undo;
- Escape/pointercancel creates no edit;
- integer ticks remain canonical.

## Automated verification

Final repository total: **2,345 / 2,345**.

- API: 403 / 403
- Web: 1,297 / 1,297
- edit-domain: 500 / 500
- intent-domain: 27 / 27
- render-contract: 118 / 118

Focused evidence:
- Trim View / media identity / Timeline handles: 46 / 46;
- sixty-minute bounds + precision/shuttle/audio/numeric: 65 / 65;
- broad Timeline/Studio T3 integration: 227 / 227.

The first parallel full-web sweep had only two five-second contention timeouts and no assertion failure. Those files passed 10/10 sequentially; the full web suite then passed 1,297/1,297 under the stable single-fork policy.

All-workspace production build: **PASS**. No production dependency was added.

## Long-form bounds

A schema-valid 60-minute project with 250 primary pieces proves:

- Ripple work is bounded by affected downstream primary clips, not frame count/project seconds/pixels;
- Roll/Slip/Slide modify at most the directly affected neighbours;
- two-point Multi-Roll changes at most four timing records;
- active Trim View requests at most four exact frames;
- existing Gate-D browser/server derived-media concurrency/cache bounds remain authoritative.

## Real Microsoft Edge evidence

Real local owner media `primary-30s.mp4` was edited in Studio with a dedicated extensions-disabled Edge profile.

Proved through real UI / accepted state:

- Standard Trim: -48,000-tick duration change; exact Undo/Redo restoration;
- Ripple Trim: downstream shift exactly -48,000 ticks; Undo;
- Roll: total sequence duration invariant; Undo;
- Slip: composition start/duration invariant while source moved -48,000 ticks; Undo;
- Slide: selected source invariant, composition +48,000 ticks, sequence duration invariant;
- J/J/K/L/L shuttle reached forward 2x with zero revision and one video;
- Dynamic Trim cancel produced zero revision; Enter commit produced exactly one;
- Audio Scrubbing toggled with zero revision;
- numeric invalid input produced a plain refusal and zero revision; valid `-1f` produced exactly one revision;
- temporary real Split exposed two Roll points; Ctrl-selection selected both; an incompatible compound request refused with revision delta zero, proving no partial edit; the temporary Split was undone;
- active Standard Trim View displayed two exact source frames and `pointercancel` produced zero revision;
- horizontal/vertical zoom during selection produced zero revision;
- reload preserved accepted project state;
- exactly one video remained.

Responsive proof at 1440x900, 1280x800, 1024x768 and 390x844 showed no horizontal page overflow and one video at every size.

Final export run reported zero browser/runtime errors and zero failed HTTP responses.

The playhead-command implementation is covered by the automated command/planner matrix. Browser menu activation was visible, but the disposable evidence project's API hot reload prevented the runner from keeping a stable playhead-inside-selection state for those zero-delta attempts; they are not misreported as real-browser accepted edits.

## Real MP4 export

Product Export produced:

- MP4 container;
- H.264 High;
- 1920 x 1080;
- SAR 1:1;
- 30 fps;
- 717 video frames;
- AAC-LC stereo at 48 kHz;
- duration 23.900000 seconds;
- 10,899,271 bytes;
- SHA-256 `79FDA906C32B6454ED83B6A8FF1F513C906B7770690A82086E49F9F695E08F38`.

Frames at 2.0 s, 12.0 s and 22.5 s decoded and were visually inspected. Landscape footage remains full-frame; portrait footage remains correctly contained with intentional side bars. No precision-edit black gap, stretch, decode failure or composition corruption was observed.

## Ownership boundary

The permanent Editor/Motion/AI ownership contract remained in force throughout T3. The Editor boundary checker passed before every T3 commit. No protected Motion file was modified, no unfinished Motion package was imported into production `apps/web`, no Plan-B implementation was modified, no Motion worktree was entered, and no Motion process/branch/tag was touched.

## Known non-blocking observations

- Two full-web tests can exceed their default five-second timeout under parallel Windows contention; both pass sequentially and the complete single-fork web suite is green. This remains verification infrastructure behavior, not a product assertion failure.
- The disposable browser evidence project can reset to its on-disk revision when the private API hot reloads. Final export bytes were downloaded and hashed before that happened; this is not an accepted-project operation rollback.
- Existing web build warnings for the runtime nameplate font and Vite's >500 kB advisory remain non-blocking and predate T3 scope.

No unresolved T3 P0/P1 blocker remains.

**STOP:** T4 keyframe lanes / graph editing was not started.
