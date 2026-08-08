# Handover Runbook

Use this runbook when a new session, agent, or context window resumes the project.

## Current handoff

**P1-F.1E Gate T2 is complete. T3 through T7 have not started.**

Read in this order when resuming:

1. `START_HERE.md`
2. `DOCS/HANDOFF.md`
3. `DOCS/CURRENT_STATE.md`
4. `DOCS/evidence/2026-08-04-timeline-completion/PROGRAM_STATE.md`
5. `DOCS/evidence/2026-08-04-timeline-completion/T2_FINAL_CLOSURE.md`

Final T2 verification: **2,292/2,292 tests**, all-workspace production build
exit 0, real Microsoft Edge workflow revision 34→44 with zero browser errors and
zero failed HTTP responses, and a real revision-44 1920×1080 H.264/AAC export
whose renderer SHA matches the MP4 on disk.

T2 owns constant rational speed, Rate Stretch, Reverse, Freeze Frame, direct
gain/fades/pan, real loudness normalization, linked J/L audio windows, truthful
transition controls and bounded advanced-placement planners. Preserve the core
rules: one gesture = one change set = one Undo, integer ticks only, and Preview /
export share one accepted project authority.

Two closure bugs are already fixed and must not regress: Hold Frame must route to
its panel when enabled; Rate Stretch must preserve the clip's current Reverse /
Forward direction.

**Do not start T4 without explicit owner authorization.** Do not integrate or modify the separately owned Motion Graphics Library or Plan-B workstreams from this branch.

### Previous handoff
## Fast resume

1. Read `START_HERE.md`.
2. Run `git status --short --branch`.
3. Read `DOCS/CURRENT_STATE.md` and `DOCS/BUILD_TRACKER.md`.
4. Read the active plan named in current state.
5. Read relevant requirements, decisions, failures, and recent change records.
6. Run the smallest verification command relevant to the active acceptance criterion.
7. Tell the owner what is verified, assumed, and next before materially changing direction.

## After compaction

Do not reconstruct the project from the compacted chat summary alone. Reload committed project truth and reconcile it with the owner's newest message. If they conflict, the newest explicit owner correction wins and the durable files must be updated before proceeding.

## Handover packet checklist

- Current goal and exact status
- Last completed acceptance criterion
- Current acceptance criterion
- Files intentionally changed
- Verification commands and their results
- Known failures, limitations, and unverified claims
- Next action and permission gate
- Git branch, commit, and remote state

## P1-F.0.2.2 resume note

The latest technical milestone is the completed Media responsive presentation
and Editor Monitor V1. Preserve `SanverseEditorMonitor` around the existing
single video/content layer and keep `.media-bin__results` as Media's only scroll
owner. The next proposed milestone is Media V2, but it is not authorized by this
checkpoint.

## Stop conditions

Stop and ask the owner when:

- A new interpretation materially changes product scope.
- A destructive or public external action was not explicitly authorized.
- A renderer/provider choice lacks the evidence required by its decision gate.
- A semantic operation cannot distinguish safe execution from a plausible wrong edit.
- Existing user changes conflict with the planned edit.

## Preview pictures and sound shapes (Gate D, 2026-08-04)

If the timeline shows rectangles with no pictures in them:

1. **Is FFmpeg on the path?** The refusal will say
   `DECODER_UNAVAILABLE — "The tool that makes preview pictures is not installed."`
2. **Did the file change?** `ANALYSIS_KEY_INVALID — "That file has changed since
   this preview was asked for."` means the bytes behind that slot are not the
   ones the picture was asked for. Reload the project.
3. **Is the machine busy?** `/api/diagnostics` reports
   `mediaAnalysis: { activeFrames, activeWaveforms, queued, sharedJobs }`.
   Ceilings are 2, 1 and 64. If `queued` sits at 64, raise the limits with
   `SANVERSE_ANALYSIS_MAX_FRAMES` / `_MAX_WAVEFORMS` / `_MAX_QUEUED` /
   `_TIMEOUT_MS`. A bad value refuses at startup rather than being ignored.
4. **Is something stale?** Delete
   `.sanverse-data/projects/<projectId>/derived-media/` — it is a throwaway
   folder and removing it costs only a few seconds of re-decoding. **Do this
   after any change to HOW a picture or a number is produced**, or bump the `v1`
   in that path, because the stored name describes the request, not the method.
5. **Nothing here can damage a project.** Preview pictures create no operation,
   no change set, no revision and no Undo entry.

## Resuming the Timeline programme — 2026-08-06

1. `git log --oneline -1` and `git status --short`. The tree should be clean and
   HEAD should equal `origin/agent/g6-g8-local-alpha`.
2. Open `DOCS/evidence/2026-08-04-timeline-completion/PROGRAM_STATE.md`. Find the
   first gate that is not DONE and continue at its first unticked box. **Do not
   reconstruct state from chat history.**
3. Expect 2,050 tests and `npm run build` exit 0 before changing anything. If the
   numbers differ, find out why before starting.
4. Heavy suites on Windows:
   `npx vitest run --root apps/web --pool=forks --poolOptions.forks.singleFork=true`
5. The API loads TypeScript at boot. After changing anything under `apps/api`,
   stop and restart the preview server or you will test the old code.
6. Since Gate T1, bumping the revision no longer busts a cached export. See the
   handoff note above.
