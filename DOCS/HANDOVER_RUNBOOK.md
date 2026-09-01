# Handover Runbook

Use this runbook when a new session, agent, or context window resumes the project.

## Current handoff

**Active branch:** `external-mcp-raw-video-v1`. General Storyboard implementation/evidence baseline:
`acff478efd024926b2cc455cd60efdd721030966`. Verify current HEAD with Git because later documentation-only release-readiness syncs may sit above that implementation commit.

**Current completed engineering slice:** REQ-024 / General Storyboard Authoring
Surface V1. The standard local Sanverse MCP exposes 69 tools; external coding
agents can inspect and author the canonical Motion Graph inside revision-fenced
Storyboard state, preserve exact owner design locks, carry the approved
Storyboard structure into Motion Forge, reconnect from durable Creative Runs,
and review exact source-composited KVS pixels in chat. Deterministic STDIO and
real Codex `0.144.1` acceptance are green. Evidence:
`DOCS/evidence/2026-09-01-general-storyboard-authoring-v1/`.

**Machine-verifiable gate:** green. The authoritative Windows single-fork root
test command exits 0, the all-workspace production build exits 0, the named
Storyboard authoring audit passes, and dependency/secret/media hygiene is clean.
The working branch was pushed with local/remote SHA parity at the commit above.

**Only active raw-video release blocker:** REQ-020's manual release proof. Do
not create `sanverse-external-mcp-raw-video-v1` from broad implementation
approval. The tag requires meaningful spoken source media with truthful timed
source/transcript evidence, a representative target of ~10 opportunities/~10
scenes, legitimate owner Storyboard/timing/Motion approvals, representative
preview/export parity captures, and an actual 1× owner watch of the complete
export.

The persisted local `check .mp4` is a real 29.49-second MP4 with audio, but its
current attached analysis transcript is synthetic one-cue text spanning the
whole clip. It is not evidence of the spoken words or their timing. The shipped
`NullTranscriptionAdapter` fails closed with `TRANSCRIPTION_DISABLED`; no
local/offline recognizer is wired. Therefore a truthful sidecar/transcription
or another meaningful spoken source is required before the ten-scene manual
benchmark can legitimately start. Do not split the synthetic cue into invented
"real" source moments.

When resuming this branch, read `START_HERE.md`, `DOCS/CURRENT_STATE.md`, this
runbook, `DOCS/REQUIREMENTS.md` REQ-020/023/024, `DOCS/DECISIONS.md` DEC-021/022,
and `DOCS/plans/SANVERSE_EXTERNAL_MCP_RAW_VIDEO_V1.md`. Older P1 handoffs below
are historical context, not the current branch gate.

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
