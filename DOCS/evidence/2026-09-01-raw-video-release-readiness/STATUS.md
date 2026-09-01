# Raw-video release readiness audit — 2026-09-01

Branch: `external-mcp-raw-video-v1`
Baseline reviewed: `acff478efd024926b2cc455cd60efdd721030966`
Verdict: **all currently available autonomous engineering is complete; final REQ-020 release evidence is blocked on truthful meaningful-source input plus real owner visual/watch decisions**

## What is already green

- REQ-020 raw-video orchestration implementation + automated RC is complete.
- REQ-021 zero-setup local MCP is complete.
- REQ-022 chat-first durable Creative Runs are complete.
- REQ-023 same-task MCP continuation is complete.
- REQ-024 General Storyboard Authoring Surface V1 is implementation + real-client complete.
- Standard local Sanverse MCP discovery is 69 tools.
- Real Codex `0.144.1` General Storyboard acceptance is green.
- The authoring RC root single-fork regression and all-workspace production build exit 0; dependency/secret/media hygiene is green.

## Meaningful-source audit

A local persisted project exists for `check .mp4`:

- source asset is a real MP4;
- duration is 42,464,163 / 1,440,000 ticks = about 29.49 seconds;
- dimensions are 1920×1080 at 30 fps;
- `hasAudio` is true.

That is **not enough** to call it the meaningful spoken-video release benchmark. The persisted Creative Run transcript currently attached to this source is analysis-only synthetic audit text stored as one cue spanning the entire source duration. Its exact wording matches the hard-coded `source.attach_transcript` contents in `scripts/audit-creative-run-stdio.ts`, so it is known test/audit input rather than speech-derived evidence:

`Revenue grew 82 percent. Compare the old workflow versus the new workflow. First connect the source, then review it. Security and permission boundaries matter. The biggest feature is shared context. This saves time automatically. Download the final report now.`

The project contains no evidence that those exact words were actually spoken at those times. Splitting that one synthetic cue into ten supposed "real" source moments would fabricate evidence.

The shipped `NullTranscriptionAdapter` also fails closed with:

- code: `TRANSCRIPTION_DISABLED`
- message: `Automatic transcription is switched off. Add a transcript file to caption this video.`

No wired local/offline recognizer exists in the current production path. Using a remote recognizer would also be a separate data-leaving-machine/provider decision, not something this release-readiness audit silently authorizes.

## Exact remaining release path

Once a meaningful spoken source plus truthful timed transcript/sidecar is available, the existing implementation can run the remaining REQ-020 release proof:

```text
meaningful spoken source + truthful timed transcript
        ↓
Source Understanding
        ↓
~10 useful non-filler opportunities
        ↓
~10 isolated Storyboards
        ↓
REAL owner Storyboard approvals
        ↓
Animatics
        ↓
REAL owner timing approvals
        ↓
Motion Forge + QA/repair
        ↓
REAL owner Motion approvals
        ↓
ONE atomic production apply
        ↓
Undo / Redo / reapply
        ↓
representative preview/export parity captures
        ↓
final MP4
        ↓
REAL owner 1× watch
        ↓
cross-client MCP smoke
        ↓
only then: tag sanverse-external-mcp-raw-video-v1
```

## Boundary

Broad authorization to keep coding/testing allows all machine-verifiable work to proceed, but it is not evidence that an unseen Storyboard, Animatic, Motion draft, or complete export was visually reviewed. The release tag therefore remains withheld until the exact manual evidence above exists.

Detailed WH-style blocker records are in `FAILURES.md` in this same evidence directory.
