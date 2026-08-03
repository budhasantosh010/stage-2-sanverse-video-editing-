# Export runtime — root cause and fix (Gate A / A10, A11)

## The reported symptom

`DOCS/evidence/2026-08-03-p1f022-media-monitor/export-verification.md`:
the export stayed in *"Rendering and verifying your MP4…"* beyond 90 seconds
without completing or surfacing a useful failure.

## The traced path

```
  Export click
    └─ POST /api/projects/:id/exports
         └─ idempotency key = sha256(projectId : revision : renderPlanVersion)
         └─ job created, status 'queued'          -> 202 Accepted, job returned
         └─ startExportJob(jobId)                                    [server]
              └─ status 'running', progress 0.05
              └─ allocateExport + resolve extra asset paths, progress 0.15
              └─ renderService.exportProject
                   └─ compileProjectToRenderPlan
                   └─ ffmpeg adapter
                        ├─ onMilestone('rendering')   progress 0.20
                        ├─ FFmpeg runs
                        ├─ onMilestone('verifying')   progress 0.85
                        ├─ ffprobe the output, compare to the PLAN's length
                        ├─ sha256, chmod 0444, link into place
              └─ status 'succeeded', progress 1
    └─ browser polls GET /api/projects/:id/export-jobs/:jobId every 350 ms
```

## Root cause: the render was slow, and the UI could not say so

Measured in a real browser on 2026-08-03, scratch project
`project_1ff7bc4628bdfe2adaf52a07412ecf29` (`test-30s.mp4`, 30.033 s,
1920×1080, 30 fps) with one accepted nameplate and full-length footage motion:

```
  job created                    202 Accepted
  phase reported by the server   rendering (progress 0.20)
  observed encode time           ~51 s in the sampled window, on top of
                                 ~30 s already elapsed from an earlier
                                 attempt on the same job  ->  ~80 s total
  final status                   succeeded
  export                         1920×1080 H.264, 30/1, AAC-LC 48 kHz stereo,
                                 30.033008 s, 18,044,871 bytes
  sha256                         fc54e6bc73c128a7aac633fd49ae51991c0d3c7a422b4bcebcabe7c0fc4fef16
```

**The export was never hung.** It was a live encode that genuinely takes
60–90 seconds on this machine for a 30-second 1080p file with a burned-in
overlay and a full-length canvas transform.

The defect was that nothing on screen could tell the difference:

```
  what the user saw            "Rendering and verifying your MP4…"
  for how long                 unknown — no elapsed time was shown
  which half of the work       unknown — queued, encoding, and verifying were
                               all the single word "rendering"
  when would it give up        NEVER — the client polled
                               `while (status === 'queued' || 'running')`
                               with no bound at all
```

So a slow-but-healthy render and a genuinely dead one were **visually
identical, indefinitely**. Ruling out a hang required reading server state by
hand, which a user cannot do.

## Two additional real defects found by reading the code

Both were fixed even though neither caused this particular observation.

**1. An orphaned `running` job was never restarted.** `create` is idempotent on
project + revision + render-plan version. The route then started work only
`if (created.job.status === 'queued')`. A job recorded as `running` with no live
process behind it — previous server stopped mid-render — was handed back to the
browser and never executed. The browser then polled a status that could not
change: an export spinner that truly could never end.
Fixed by `startExportJob`, which resets an orphan to `queued` and runs it, while
`runningExportJobs` prevents restarting a job this process is already running.

**2. There is no wall-clock limit on the FFmpeg child process.**
`createCommandRunner` reads both pipes, so there is no pipe-fill deadlock, but a
genuinely hung FFmpeg would never settle the promise. The client timeout now
bounds the user's experience of that. Bounding the process itself is recorded as
an open item rather than guessed at.

## What changed

**Server — truthful phases, not an invented percentage.**
`RenderRequest.onMilestone` reports two boundaries the renderer genuinely knows
it crossed: `rendering` (FFmpeg started) and `verifying` (FFmpeg exited 0). The
job store maps them to `EXPORT_RENDERING_PROGRESS = 0.2` and
`EXPORT_VERIFYING_PROGRESS = 0.85`, and `exportJobPhase` derives
`queued | rendering | verifying | done` **on the server**, so the browser never
holds a second copy of the thresholds that could drift.

**Client — bounded, explicit, recoverable.**

| Requirement | How |
|---|---|
| elapsed duration visible | `ExportProgressStatus` ticks once a second, `m:ss` |
| one active job per request | `exportInFlightRef` single-flight + server idempotency |
| duplicate clicks | **measured**: a second POST returned the *same* `jobId` |
| bounded timeout | `EXPORT_CLIENT_TIMEOUT_MS = 10 min` → `ProjectExportTimeout` |
| recoverable | timed-out state offers Retry; job is **not** cancelled |
| late completion not corrupted | retry re-posts the same revision → idempotent re-attach to the same job |
| job ID available | carried on the timeout error and in progress callbacks |
| spinner cannot be infinite | the poll loop has a hard bound |

**Raising a timeout was explicitly not the fix.** Ten minutes is far longer than
any observed successful export; crossing it means something is wrong and the
user must be told, not reassured.

## What this does NOT prove

- **The `verifying` phase was never sampled on real media.** Polling at 500 ms
  saw `rendering` on every poll and then `succeeded`. Verification of this file
  completed inside one poll interval. The phase is proved by unit tests, not by
  a real-media observation.
- The 10-minute bound has not been hit on real media; the timeout path is proved
  by test with an injected clock.
- The orphaned-`running`-job fix is proved by reading and by construction, not
  by killing a server mid-render and re-posting.
- One machine, one file, one encoder configuration. No claim is made about how
  long exports take in general.
