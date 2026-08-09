# HANDOFF — everything a new agent needs to continue Sanverse Stage 2

## Current checkpoint

**P1-F.1E — Complete Timeline Experience is complete through Gate T3.**

The live gate table, per-gate checklist, program rules and traps are in:

```
DOCS/evidence/2026-08-04-timeline-completion/PROGRAM_STATE.md
```

**Read that file before anything else.** Do not reconstruct state from chat.

**Gates T0, T1, T2 and T3 are DONE. T4 through T7 are NOT STARTED.** Final T3 gate:
**2,345/2,345 tests**, all-workspace production build PASS, a real Microsoft Edge
precision-edit workflow on owner media, one-video continuity, responsive proof,
and a real 1920×1080 H.264/AAC MP4 whose sampled frames were inspected.

Final T3 closure evidence:

```
DOCS/evidence/2026-08-04-timeline-completion/T3_FINAL_CLOSURE.md
DOCS/evidence/2026-08-04-timeline-completion/T3_BROWSER_WORKFLOW.md
DOCS/evidence/2026-08-04-timeline-completion/T3_PREVIEW_EXPORT_PARITY.md
DOCS/evidence/2026-08-04-timeline-completion/T3_LONG_FORM_BOUNDS.md
DOCS/evidence/2026-08-04-timeline-completion/t3-browser-screenshots/
DOCS/evidence/2026-08-04-timeline-completion/t3-export-frames/
```

T3 now includes explicit Standard/Ripple Trim, Roll, Slip, Slide, trim-to-playhead,
deterministic Extend, J/K/L shuttle, detached Dynamic Trim, Audio Scrubbing,
edit-point selection, all-or-nothing multi-edit-point trimming, exact numeric
precision and bounded exact-frame Trim View. It preserves the T2 speed, Reverse,
Freeze, J/L, transition, group, marker, zoom, Preview/export and one-video
authorities.

The final real export is 23.900000 seconds, H.264 High 1920×1080 at 30 fps with
AAC-LC stereo/48 kHz, 717 video frames and SHA-256
`79FDA906C32B6454ED83B6A8FF1F513C906B7770690A82086E49F9F695E08F38`.

**Do not start T4 without explicit owner instruction.** A separate coding agent owns the Motion Graphics Library workstream; do not integrate or modify its protected paths from this timeline program. T3 is complete; reopen it only for a proven T3 blocker or evidence correction.

## Completed: P1-F.1A

### Gate D — COMPLETE: real filmstrips, image thumbnails and waveforms

The timeline used to draw every piece of your video as a coloured rectangle with
a filename on it. It now draws the actual frames of the actual recording and the
actual shape of the actual sound.

**The decision, written before any code:**
`DOCS/decisions/ADR-DERIVED-MEDIA-EXECUTION-V1.md`. A **hybrid** — the browser
decides WHAT is needed (it is the only thing that knows what is on screen); the
local server MAKES it with the same FFmpeg that produces the finished video (it
is the only thing that can decode every format a user might bring).

Server, `apps/api/src/media-analysis/`:

```
   analysis-request.ts      closed parsing of the three query shapes;
                            11 refusal codes; unknown/missing/out of range
                            is REFUSED, never repaired
   derived-media-cache.ts   throwaway sidecar at
                            .sanverse-data/projects/<id>/derived-media/v1/
                            hashed filenames, atomic write, corrupt-entry
                            regeneration, 4,000-file ceiling per project
   analysis-coordinator.ts  2 frames / 1 sound at once, queue 64, 20 s
                            timeout, in-flight dedup, abort when the last
                            waiter leaves
   media-analysis-service.ts  FFmpeg frame + image + bounded PCM waveform
```

Browser, `apps/web/src/features/media-analysis/`:

```
   media-analysis-key.ts        + assetVersion (16 chars of the file's sha256)
                                + image-thumbnail as its own closed kind
   media-analysis-client.ts     one address per kind; closed refusals
   media-analysis-controller.ts ONE per screen: 6 in flight, priority order,
                                abort on scroll-away, bounded caches, explicit
                                ImageBitmap disposal, diagnostics counters
   timeline-derived-media.ts    the pure plan used by BOTH the shopping list
                                and the drawing, so they cannot disagree
   timeline-item-clip.ts        one timeline row → that plain question
```

Editor: `TimelineFilmstrip.tsx` and `TimelineWaveform.tsx` — one canvas each,
`pointer-events: none`. `timeline-lane-metrics.ts` owns row heights and pushes
them to CSS as `--timeline-lane-height`, so code and layout cannot disagree.

**Three rules that will be broken if they are not read:**

1. `assetVersion` is what makes a stale picture impossible. `assetId` names a
   SLOT; the version names the BYTES. Never remove it.
2. Filmstrip moments sit on a ladder measured from the START OF THE RECORDING,
   plus one at the clip's own start. That is why a move costs nothing, a trim
   costs one picture and a split costs at most one.
3. The `v1` in `derived-media/v1/` is the invalidation mechanism. If the WAY a
   picture or a number is produced ever changes, bump it — the name describes
   the request, not the method, so old answers survive a code change otherwise.

**Never:** no operation, no change set, no revision, no Undo entry. Derived
media is deleted at any moment with no consequence but re-decoding.

Evidence: `DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/gate-d-*.md`
and `screenshots/gate-d/`.

### Gate C2 — Multi-asset Primary Sequence

The main video track holds more than one recording. It was small because **the
data model already allowed it**: a clip already carried its own `assetId`, and
`validateComposition` never required a track's clips to share a file.

```
   ADDED    place-primary-clip { clipId, trackId, assetId, sourceRange,
                                 compositionStart }
            move-primary-clip  { clipId, compositionStart }

   ALREADY  split · trim · remove · reorder · hide · loudness
   WORKED   — all written against a clip, all work on any file
```

- **A parallel `PrimarySequenceV1` was rejected.** Two things both describing
  "what is this video made of" is the parallel copy the rules forbid; every cut
  would have to be applied to both. See
  `DOCS/decisions/ADR-MULTI-ASSET-PRIMARY-SEQUENCE-V1.md`.
- **No migration, no render-plan bump.** A one-recording project is already a
  valid multi-asset sequence. The plan already carried `assetId` per segment.
- **The exporter now maps each segment to its own FFmpeg input.** It used to
  read `[0:v]` always. `plan.sources[0]` is now always the project's original
  recording, because the exporter opens it as input zero — building that list in
  segment order would let position zero name one file while input zero opened
  another.
- **The preview switches the ONE `<video>` element's file at asset boundaries,
  and only there.** Swapping inside a recording throws away the buffer.
- **Overlays needed no new code.** A title is anchored to a moment of a NAMED
  recording, so `placeSourceSpan` matches on the name, not on time.

**Bug the real browser found:** every segment was bounds-checked against the
FIRST recording's length, so a valid 60 s second recording was refused for being
longer than the 30 s first one. Each is now measured against itself.

**Also learned:** a failed export is cached by its idempotency key
`sha256(projectId : revision : renderPlanSchemaVersion)`. Pressing Export again
returns the cached failure instantly — a fix is not exercised until something
moves the revision.

**Real proof:** exported 90.066 s = 30.033 + 60.033, real picture at 80 s.
`DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/gate-c2-multi-asset-primary-sequence.md`

**Tests 1,510 → 1,535.** Build exit 0.

### What is next

**Gate D is now complete** — see the checkpoint at the top of this file. What
follows P1-F.1A is Inspector expansion, Effects, Color, Audio depth and real AI
execution, none of which has started.

---

## Gate C1 — Creator Timeline Core V2, complete

Three capabilities did not exist anywhere and had to be built:

```
   1  nothing could be deleted        →  remove-overlay      { overlayId }
   2  no track could be kept out of   →  set-track-output    { trackId,
      the finished video                                       outputEnabled }
   3  music had no length at all      →  durationTicks on music
```

- **Lock ≠ output.** Padlock is presentation (`localStorage`, per project, no
  revision, no Undo). Output is an accepted operation (one revision, one Undo,
  new export key). `DOCS/decisions/ADR-TRACK-LOCK-AND-OUTPUT-V1.md`.
- **Render plan v6 → v7**: segments carry `videoEnabled` / `audioEnabled`. The
  bump was required because the export key is built from the version.
- **Music's `durationTicks` is a known key that may be omitted** — absent reads
  as `null`, exactly how every saved project already behaved. No migration.
- **Insert and Overwrite are real**, and their rearrangement goes in the SAME
  change set. Ripple delete on V2 refuses on purpose (B-roll is anchored to the
  original recording, so closing a gap would re-pin later clips).
- **Plain `S` toggles snapping; `Ctrl/Cmd+B` splits.**
- **One gesture = one change set = one Undo.** Pointer movement creates nothing.
- Code: `packages/edit-domain/src/track-output.ts`,
  `apps/web/src/features/timeline/{timeline-item-operations,timeline-item-drag-session,timeline-lock-state}.ts`,
  `apps/web/src/editor/timeline/{TimelineToolbar,TimelineTrackHeader}.tsx`.
- `onApplyOperations(operations, changeSetId)` on `StudioScreen` is the ONE path
  for a multi-operation change set.
  `DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/gate-c1-creator-timeline-core.md`

---

## Gate C1.1 / C1.2 — the planner and media drag

- **`planTimelinePlacement` is the only place placement policy lives.** Pure —
  no React, no fetch, no mutation — so a drag and a typed AI request produce the
  same operation instead of two rulebooks that drift.
- It owns policy and **delegates construction to `features/media/media-actions`**
  (ADR-005 anchoring for B-roll, ADR-007 for music).
- **V2 takes video and pictures. A2 takes sound. V1, A1 and C1 refuse** with a
  sentence saying what to do instead. V1's refusal is the ADR's, verbatim.
- **The lane highlight and the outcome are one decision** — a test walks every
  lane × every kind of file. Not colour alone, and present ONLY while a drag is
  in the air.
- `dataTransfer.getData` is forbidden during `dragover`, which is exactly when a
  lane needs to know what is coming — hence a document-level `dragstart`
  listener. The drag MIME is `application/vnd.sanverse.media-drag+json`.
  `DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/placement-planner.md`.

---

## Gate C0 — complete

**P1-F.1A Gate C0 — Atomic compound change sets is complete.**

A change set is now all of it or none of it, including its cuts.

The hole: the replay applied a change set's cuts in pass one, then judged its
overlays in pass two, and pass two's refusal could not reach back. A set holding
a cut **and** an overlay could have the cut baked into the footage while the set
itself reported "blocked" — an error message and a changed video at the same
time, with no Undo that removes it, because the project never recorded the cut
as something that happened.

- **Accepting** a new change set was already safe: the replay saw the refusal
  and the caller kept the old project. **Replaying accepted history was not.**
  Proved by disabling the fix: 2 of 24 new tests fail, the other 22 pass either
  way. That is the true size of it.
- **The fix is retraction.** Refusing a set that contributed cuts removes those
  cuts and the whole replay runs again. It terminates because refusal only ever
  grows — nothing is ever un-refused, so the oscillation the old code warned
  about cannot start. Ends in one round for every project that exists today.
- **Nothing creates a mixed set yet. Gate C1 creates them by design** — an
  insert is a placement plus a ripple, a linked placement is a picture plus its
  sound. This had to land first.
- `AtomicChangeSetResult` is a closed two-case answer: accepted with a project
  and revision, or blocked with the **original** project and
  `failedOperationIndex` naming the operation that refused.
- `createIdFactory(changeSetId)` gives deterministic names by hash, so a refused
  draft burns no ID and a retry is the same edit rather than a second one.
- **Browser-proved on real media:** a mixed request returned 400 and left the
  timeline at `00:00:28:01`, revision 7→7, 1 change set, 2 operations — the
  5-second cut in it did not land. A valid two-operation request gave one
  revision, one history entry, one Undo removing both, one Redo restoring both,
  and survived a full reload. Full detail in
  `DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/gate-c0-atomicity.md`.

**Tests 1,319 → 1,350.** Build exit 0.

**Next: Gate C1 — Creator Timeline Core on the current model.** The planner
(`planTimelinePlacement`) first, per ADR-CREATOR-TIMELINE-PLACEMENT-V1; then the
V2/A2 drop targets; then `MEDIA_DRAG_ENABLED = true`. No clip-body dragging
before the planner exists.

---

## Previous checkpoint

**P1-F.1A Gate B — Media Library V2 Essentials is complete.**

The Media panel is now a compact, responsive shelf with import by kind, drop
from the operating system, sorting, filtering, and **durable one-level folders
that live on the server and never touch the video**.

- **Where folders live:** `.sanverse-data/projects/<id>/media-organization.json`
  — a server file BESIDE the project, not inside `EditProject` and not in the
  browser. Full reasoning in `DOCS/decisions/ADR-MEDIA-ORGANIZATION-V1.md`.
  Rejected localStorage (per-browser, silently cleared) and rejected
  `EditProject` (Undo would step through folder renames, and the export key
  `sha256(projectId : revision : renderPlanSchemaVersion)` would move, so
  renaming a folder would re-encode an identical MP4 for 60–90 s).
- **A folder is a LABEL, not a container.** Deleting one returns its media to
  the top level. It can never delete media.
- **Five typed validated commands** (create / rename / move-to-folder /
  move-to-root / delete), so a future AI calls exactly what the buttons call.
- **Proved byte-identical in the real browser**: create → duplicate refusal →
  rename → move in → move out → delete left the project at
  `revision 4, changeSets 0, assets 5, sha256 39e6e054…27389d84` — the same hash
  before and after. Filing survived a full page reload.
- **Media-to-Timeline drag is built, tested, and deliberately switched OFF**
  (`MEDIA_DRAG_ENABLED = false`). The closed `sanverse.media-drag/v1` payload
  carries only `assetId`, `mediaKind`, `sourceDurationTicks` — no path, no URL,
  no object URL, no project or asset object. Gate C flips one boolean.
- **Only the results region scrolls.** Header, search, filter and sort stay
  pinned, so the moment a user has enough media to scroll is not the moment the
  tools for coping with a lot of media leave the screen.
- **Never five squeezed filter buttons.** Four shapes by panel width: five
  buttons > 380px, four + More at 301–380, one Filter button at 221–300, icons
  at ≤ 220 — all writing ONE filter value through ONE callback.

Suites: web 631, edit-domain 312, api 248, render-contract 65, intent-domain 27
— **1,283 total** (Gate A baseline 1,203, program floor 1,176). All-workspace
build passes. No assertion weakened.

Evidence: `DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/` —
`media-library-contract.md`, `media-folders.md`, `media-drag-contract.md`,
`media-responsive-matrix.md`, `media-browser-walkthrough.md`,
`test-results-gate-b.md`.

*(Historic note from the Gate B write-up.)* Gates C0, C1, C2 and D have all
since been completed — see the checkpoint at the top of this file. P1-F.2 has
not started.

Two pre-existing defects were found while testing Gate B and are recorded but
NOT fixed here, because this gate fixes only Gate B blockers:
**FAIL-047** (resizing the window past 1100px strands the user with no Media or
Inspector panel until reload) and **FAIL-048** (imported file names are
forgotten on reload).

### Previous checkpoint — Gate A

**P1-F.1A Gate A — Preview Reliability and Export Runtime.**


**P1-F.0.2.2 — Media Panel Completion and Editor Monitor V1 is technically
complete; owner visual acceptance is open.** Media has one container-responsive
presentation and one results-scroll owner. One custom monitor owns Point,
custom transport, Fit/Fill/100%, guides, and fullscreen presentation around the
existing single video/content layer. The full suite passed 1,174/1,174 before
blocker review and the final affected gate passed 31/31 after two new assertions
(current inventory 1,176); all-workspace and final web builds pass. Real-browser
Media resizing, monitor modes, Point,
edit, Undo, and Redo passed; the real export runtime remained rendering beyond
90 seconds and is recorded as open. Evidence:
`DOCS/evidence/2026-08-03-p1f022-media-monitor/`. Media V2 and P1-F.1 have not
started.

### Previous checkpoint

Updated 2026-08-03. **P1-F.0.2.1 — Nested Layout Stabilization and Panel-Responsive Components is technically complete; owner visual acceptance is open.** Desktop has one bounded height/scroll authority; AI collapses to a full-height 52 px rail; Preview and Timeline retain useful geometry; named containers adapt Media, Preview, Inspector, Timeline, and AI; laptop AI uses an overlay before panel minimums conflict; tablet/mobile Media and Tool use reachable drawers; and below 981 px the document owns natural flow. One existing `EditProject`, revision, history, Undo/Redo stack, playhead, Timeline selection/viewport, Canvas/Inspector draft, native video, AI conversation, proposal, preview, and export path remain authoritative. Final suites pass 1,164/1,164 and the production build passes. Real browser evidence includes draft/workspace continuity, ten collapse cycles, keyboard resize, edit, Undo, Redo, and a probed 1080p export. Evidence is in `DOCS/evidence/2026-08-03-p1f021-layout-stabilization/`. P1-F.1 has not started.

A closed `sanverse.workspace-layout/v1` contract owns only local presentation: validated/clamped dock widths, Timeline height, collapse state, Tool/AI tab, active workspace, and bounded Edit/Motion/Timeline/Review/AI/Audio presets. Pointer and keyboard splitters support bounds, Shift steps, Home/End, and Escape cancellation. Compact layouts use explicit Media and Tool/AI switches. Layout changes use the existing geometry refresh and create no operation, project rebuild, or revision.

Effects, Color, and Audio remain truthful. Effects exposes only current motion/visual effects; Color says primary-video grading is not implemented; Audio reuses existing V1/A1/A2 gain/fade/enabled controls and does not fake waveforms, EQ, compression, mixing, or cleanup. The same permanently mounted AI subtree preserves unsent drafts across Assist/Studio and all four workspaces.

Real Edge completed all workspaces, Tool/AI continuity, every preset, all splitters, dock collapse/reset, Point precedence, 1440×900 / 1024×768 / 390×844 responsive checks, export, and Home cleanup. One video and AI draft survived; revision stayed 15→15; no tablet/mobile overflow; zero page/console/HTTP failures. The 18.033333-second export is 1920×1080 H.264 High at 30 fps with AAC-LC stereo, 10,789,990 bytes. Final suites pass API 239/239, web 515/515, edit-domain 299/299, intent-domain 27/27, and render-contract 65/65 — 1,145/1,145 total; all workspace builds pass. Start with `DOCS/evidence/2026-08-01-p1f01-studio-workspaces-docking-v1/P1-F01_IMPLEMENTATION_REPORT.md` and `browser-walkthrough.md`.

**P1-F.0, P1-E.1, and P1-E remain complete.** P1-B remains the Production Timeline authority, P1-C the Inspector, P1-D the overlay Canvas interaction layer, P1-E the Media Bin, P1-F.0 the primary-footage motion authority, and P1-F.0.1 the Studio workspace/docking presentation authority. **P1-F.1 and P1-F.2 have not started.**

**Read this file, then `DOCS/CURRENT_STATE.md`, then the ADRs it names.**
Nothing else is required to start work.

---

## 0. What this product is, in one paragraph

Sanverse Stage 2 is a video editor for people who cannot edit. You upload a
talking-head recording, then either type what you want ("cut the boring bit",
"put my name on screen") or point at the picture. The system proposes a change,
shows you exactly what it will look like, and only changes your video when you
approve. The promise the whole architecture defends is: **what you approved is
what you exported.** Complexity is hidden under the hood; there is no learning
curve and no editing vocabulary on screen.

---

## 1. Non-negotiable rules for whoever works on this

These come from `CLAUDE.md` and from failures that already happened. They are
not style preferences.

### RULE 1 — Explain with zero information loss
The owner is a non-technical founder. Every explanation must be in plain
language a twelve-year-old could follow, with ASCII diagrams, real numbers, the
WHY as well as the WHAT, and every trade-off stated. No unexplained jargon,
ever. If the owner cannot re-explain it correctly to a stranger, the explanation
failed.

### RULE 2 — Highest-impact work only
Owner's words, verbatim: *"don't fucking waste tokens i explicitly told you to
fucking do only the high impact tasks as fast as possible without unneeded
works"*. Attack the biggest bottleneck. Do not wander. If blocked, record it and
move on.

### RULE 3 — Passing tests are not proof the product works
On 2026-07-25, 182 tests passed while every upload was broken. On 2026-07-29,
741 tests passed while B-roll was silently absent from every export. **Before
calling any slice done, run the real browser loop on real media and inspect the
browser console, the network, the server logs, the on-disk state, and the
exported file itself.** State plainly what was verified and what was not.

### The architecture gate
At every boundary, module, and pull request ask: *"Would a billion-dollar
company's CTO build it this way?"* If not, refactor. Think through 1st, 2nd,
3rd, and 4th order consequences before changing anything.

### Working agreement
Build in **batches of 10 checklist tasks**, then stop and report what remains in
plain language. Commit every 10–20 tasks. Do not one-shot G5 through G8.

---

## 2. Repository shape

```
  npm workspaces monorepo, TypeScript, no build step for the API
  (node --experimental-strip-types runs .ts directly)

  packages/edit-domain        the rules. No I/O, no framework, no rendering.
  packages/render-contract    the one description both renderers consume.
  packages/intent-domain      AI request/response shapes and evaluation.
  apps/api                    local HTTP server, storage, FFmpeg, AI adapters.
  apps/web                    React 19 + Vite 7 browser app.

  strict ports: 2000 (web)  2001 (API, loopback only)
  dev server launch name in .claude/launch.json:  sanverse
  data on disk:  ./.sanverse-data/projects/<projectId>/
```

Commands:

```bash
npm test --workspaces --if-present
```

```bash
npm run build
```

**`npm run build` type-checks TEST files too.** Vitest alone is not enough — two
type errors sat undetected for a whole batch because only vitest was being run.

---

## 3. The load-bearing decisions. Do not violate these.

Full reasoning lives in `DOCS/adr/`. This is the summary a new agent must hold
in their head.

### 3.1 Time is exact integers, never floats
```
  PROJECT_TIMESCALE      = 1_440_000 ticks per second
  TICKS_PER_MILLISECOND  = 1_440
```
1,440,000 is divisible by 24, 25, 30, 48, 50, 60, 1000, and by 30000/1001's
numerator arithmetic. Every range is **half-open**: `[start, start+duration)`.
Conversion from messy reality (decimal seconds from ffprobe) happens once, at
the media-probe boundary, and the leftover is recorded in
`durationResidualSeconds`. Nothing downstream ever rounds again.

### 3.2 ADR-005 — everything drawn on the picture is anchored to the FOOTAGE
An overlay stores WHEN it appears against the **original recording's** clock,
never the finished video's.

```
  stored against the finished video   cut 4s off the front and a nameplate
                                      stays at 00:08 of the CUT, which is now
                                      00:12 of the recording — a different
                                      moment, and nothing warns anyone

  stored against the footage (this)   the nameplate stays on the face; the
                                      system recomputes it is now 00:04
```

`placeSourceSpan(composition, assetId, sourceRange)` in
`packages/edit-domain/src/composition.ts` is **the only translator** between
footage time and screen time. A span cut in two returns two placements. A span
whose footage was deleted returns an empty list, and the caller reports that
plainly rather than guessing a new position.

**Music is the single documented exception — see 3.6.**

### 3.3 Event-sourced project; one user action = one Undo
```
  project.composition          the footage AS IMPORTED. Never changes.
  effectiveComposition(project) = that, plus every accepted cut replayed
```
`evaluateProject` is a **two-pass** function and the only place that decides
both what the video is made of and which change sets no longer fit:

- **Pass A** folds timeline operations in the order they were approved.
- **Pass B** judges every overlay against the FINAL composition.

The two passes are deliberately one-way: an overlay can never change what the
video is made of. Letting it would create a loop with no settled answer.

A change set is **all-or-nothing**. If any operation inside it fails, the whole
change set is marked blocked and none of it touches the footage.

A blocked change set is **shown to the user and never quietly adjusted**.

### 3.4 Closed key sets, and refusal over repair
Every validator lists its allowed keys and **refuses an unknown one**. An
unrecognised operation kind, style id, capability, or media kind is refused
loudly. Nothing is ever silently stripped, defaulted, or clamped, because
exporting a video the user did not approve is the failure this product exists
to prevent. (Exception, deliberate and documented: a drawn mark that runs off
the edge of the picture is pulled back to the boundary — see 3.7.)

### 3.5 The render plan is the single description both renderers consume
`packages/render-contract/src/render-plan.ts`, currently
`sanverse.render-plan/v6`. It names no font file, no FFmpeg filter, and no CSS
rule. The browser preview and the FFmpeg export read the **same plan**. Every
visual number comes from a shared style contract
(`nameplate-style.ts`, `caption-style.ts`, `overlay-style.ts`) that produces
NUMBERS; the browser turns them into CSS and the exporter turns them into
FFmpeg arguments.

```
  RenderPlan v6
    sources[]     every file the renderer must open, FOOTAGE FIRST
    segments[]    the footage the finished video is made of,
                  including source-anchored footageMotions[]
    overlays[]    what is DRAWN on it
                    text-overlay | caption-overlay | title-overlay
                    | callout-overlay | media-overlay
    music[]       kept OUT of overlays, because music is not drawn
```

### 3.6 ADR-007 — music is anchored to the FINISHED video
```
  ANCHORED TO FOOTAGE                  ANCHORED TO THE FINISHED VIDEO
  nameplate, caption, title,           music, and only music
  callout, B-roll
  ───────────────────────────          ───────────────────────────────
  cut its moment out → it goes         cut a bit out → the music plays
  with it, or is reported blocked      straight through the join
```
If music were anchored to footage, cutting ten seconds out of the middle would
cut ten seconds out of the song and the listener would hear a lurch. Therefore:
**a cut can never block music**, music plays for as long as there is both video
left and song left, and it is **never looped** (a loop point nobody chose is
audible). Fades shorten to fit rather than overrun.

### 3.7 Annotations are intent, never edits
A circle you draw to say "remove that noise" must never appear in the export.
This is structural, not disciplinary:

```
  an EDIT                              an ANNOTATION
  names a capabilityId                 has no capabilityId at all
  is an EditOperation                  its kind is absent from
                                       EXECUTABLE_OPERATION_KINDS
  goes in a change set                 travels with a request
  the compiler sees it                 the compiler has never heard of it
```
There is no "skip the circles" step in the renderer because there is nothing to
skip. Marks are stored as fractions of the **picture**, with letterbox bars
subtracted first (`getRenderedVideoContentBox`), never as fractions of the video
element — an element-relative number walks sideways the instant the window is
resized. Proved across nine display shapes.

### 3.8 Captions (ADR-006)
The transcript is a **sidecar**, never in the project — it is evidence about
footage, not a decision, and undoing an edit must not undo the knowledge of what
was said. Captions ARE a decision, so one `add-captions` operation carries many
cues and "put captions on my video" is exactly **one Undo**. Cues whose footage
is deleted simply do not draw; the set is blocked only when **nothing** survives
(`ALL_CUES_REMOVED`) — blocking 150 captions because 3 died would leave a silent
video and a useless warning. Line breaking is **pure arithmetic, no AI**, so the
same transcript always produces byte-identical cues.

### 3.9 Assets: one type, three kinds
```
  kind    has a LENGTH   has a SIZE   what it's for
  video   yes            yes          footage, and B-roll over it
  image   NO (null)      yes          a picture over the footage
  audio   yes            NO (null)    music under everything
```
Fields that do not apply to a kind are **null, never invented**. A composition
is made of footage: a clip naming a picture or a song is refused with
`ASSET_NOT_VIDEO`. **Which kind a file is comes from looking at its bytes**
(ffprobe), never from its name: "has a picture but the file cannot say how long
it lasts" IS the definition of a still picture.

**Adding media is NOT an edit** — `addAsset` creates no change set and no undo
entry. The revision still moves, because one rule with no exceptions is safer
than a rule with one.

### 3.10 Security constraints STILL IN FORCE
- `apps/api/src/intent/outbound-data-policy.ts` builds **the only** object that
  leaves the API process, and is re-checked immediately before the wire.
- A provider's response text must **never** appear in an error message or a log.
- The user's typed message must never be logged.
- LiteLLM's own request-body logging **must be verified off before any real
  call** (task G4B-12C).
- Plain `http` to a non-loopback host is **refused at startup**.
- **Never paste API keys into a chat.** Keys go in a file or environment.
- Text handed to FFmpeg goes in **files**, never on the command line, so nothing
  a user typed can be read as filter syntax.
- The filter graph goes in a file (`-filter_complex_script`). 200 captions is
  ~100,000 characters against Windows' 32,767-character command-line limit.

---

## 4. What is BUILT and PROVED

Evidence with measured numbers is in `DOCS/evidence/`. "E4" means real media,
real browser or real API, real export, output inspected.

```
  G1..G3      chassis, storage, intake, manual nameplate         E4
  G4-A        project model, capabilities, change sets, undo,
              selective deactivation, migrations                 E4
  G4-B        AI proposes / code executes, fake provider,
              18-case corpus, real OpenAI-compatible adapter      E4 except
                                                                 the first
                                                                 REAL call
  G5-A        captions from a transcript file                     E4
  G5-B        cutting: split, trim, remove, reorder, hide,
              clip loudness and fades                             E4
  G5-C        multi-asset intake, annotations, titles, callouts,
              B-roll, pictures, music, progressive disclosure     E4
```

### G5-C specifics (finished 2026-07-29, commit `9a895e4`)
- `POST /api/projects/:id/assets` — upload B-roll, a picture, or music.
- `GET /api/projects/:id/assets/:assetId/media` — served back for the preview,
  content type derived from the file's own codec.
- `AddOverlayPanel` — one button → four plain choices → one short form.
- Preview layers for titles, callouts, and B-roll, composited **under** the
  words exactly as the exporter does.
- Real export proof: title at 2.5 s, callout at 7.0 s, B-roll at 13.0 s, picture
  at 18.5 s, nothing at 27.0 s; music present (−42.5 dB of extra signal at 5 s)
  and absent once the 20 s song ended (−68.2 dB at 23 s); a cut at 5 s blocked
  the title, moved the callout and both media overlays, and left the music
  untouched; second export exactly 25.033 s = 30.033 − 5.000.

---

## 5. What is NOT built — the actual work queue

### 5.1 Immediate leftovers (finish these first)

| Task | What is missing, precisely |
|---|---|
| **Callout dragging** | A callout always appears at a fixed `{x:0.55, y:0.25, w:0.3, h:0.3}`. It cannot be moved or resized on screen. |
| **Caption editing controls** | `set-caption-cue`, `remove-caption-cue`, and `set-caption-style` are built, tested, and reach the export. **Nothing on screen offers them.** |
| **Click-through by hand** | The Add panel, the upload route, and the preview layers were type-checked and their API path was exercised directly with real files. **They were never clicked in a browser.** Do this and record it. |
| **G4B-12C / 12D / 13B / 14** | The first REAL AI call. Only keys are missing. Order is fixed: verify LiteLLM request-body logging is off → run the 18-case corpus **unchanged** against NVIDIA → then opencode Zen. No blind retries. |

Completed after this handoff was first written:

- **G5C-07 direct repair.** Titles, callouts, B-roll/pictures, and music have a
  shared adjustment panel. Repairs are full `set-title`, `set-callout`,
  `set-media-overlay`, or `set-music` operations folded over the original item.
  One repair is one history entry and one Undo. The canonical render compiler
  consumes only the folded state. Focused direct domain/render evidence and all
  relevant TypeScript checks pass; a real browser click-through was not run in
  the managed environment.
- **G5B-04/05/07/09 controls.** Trim, remove-with-gap, reorder, loudness, and
  fades are available under the progressively disclosed “Adjust this section”
  panel.
- **G5B-13 fixtures.** Real 30000/1001-with-audio, VFR-with-audio, and
  three-frame-silent fixtures were conformed and probed successfully.
- **G6 contracts and measured adapter path.** ADR-008,
  `set-visual-properties`, bounded
  transforms/crop/layers/masks, deterministic keyframes, cubic-Bezier easing,
  spring/bounce, bounded effects, and render plan v5 are complete. The browser
  consumes all visual nodes; FFmpeg consumes media and isolated written visual
  layers. The hybrid renderer was retained after real native motion exports.

### 5.2 G6 — composition, motion, effects
G6-02 through G6-11 are complete except the owner-only G6-01 rubric approval.
`G6-12` remains the owner motion-feel/export verdict.

**Architecture:** ADR-008 and render plan v5 carry complete visual state and
property tracks. See `DOCS/evidence/2026-07-29-g6-motion-adapter-spike.md` for
the measured adapter decision and exact remaining boundary.

### 5.3 G7 — components and compound AI
G7-02 through G7-10 are complete. Remaining: `G7-01` owner contract approval
and `G7-11` owner compound natural-language workflow. ADR-009 is the code-owned
contract; the G7-10 migration/reopen fixture pins the old nameplate appearance.

**Mixed cut/overlay boundary:** the current workflow registry intentionally
contains no timeline recipes, so G7 planning cannot create the known mixed
cut/overlay replay case. That replay defect must be fixed before any future
workflow is allowed to combine timeline cuts with overlays. See ADR-005.

### 5.4 G8 — trustworthy local alpha
G8-02 through G8-10 are complete: atomic state, durable resumable export jobs,
portable integrity-checked archives, measured no-cache decision, diagnostics,
protected cleanup, keyboard/accessibility controls, corrupt-media/recovery
contracts, and a measured 2.38x encoder speedup. Remaining human gates:
`G8-01`, `G8-11`, `G8-12`, and `G8-13`.

### 5.5 Deferred by the owner's own instruction
- A **real timeline** users can drive. The current four time-strip buttons
  confuse the owner; accepted as a rough first draft, to be revisited **after**
  the backend logic is complete.
- A **"show the magic" view** of what the agent is doing behind the scenes.

### 5.6 Explicitly out of scope for now
Appending a second video onto the timeline (needs an `append-clip` operation —
multi-asset intake is only the shelf) · automatic transcription (the boundary
exists; the shipped adapter refuses) · automatic music ducking under speech ·
two caption sets on screen at once · karaoke word-by-word highlighting.

---

## 6. Landmines. Every one of these has already cost time.

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ 1. The browser finds what tests cannot. FIVE times now.              │
  │    Never mark a slice done on green tests alone.                     │
  ├──────────────────────────────────────────────────────────────────────┤
  │ 2. Asserting on SUBSTRINGS of a generated language is not asserting  │
  │    it parses. `overlay:x=` vs `overlay=x=` broke every export while  │
  │    741 tests passed. FFmpeg joins a filter's FIRST option with '=',  │
  │    later options with ':'. There is now a structural guard test.     │
  ├──────────────────────────────────────────────────────────────────────┤
  │ 3. `setpts=PTS-STARTPTS` puts a trimmed clip at time ZERO. If the    │
  │    overlay appears at 11s, the clip has already ended and NOTHING    │
  │    is drawn — export succeeds, right length, right audio, B-roll     │
  │    absent. Always `setpts=PTS-STARTPTS+<start>/TB`.                  │
  ├──────────────────────────────────────────────────────────────────────┤
  │ 4. Measuring audio needs the right instrument. A narrow band around  │
  │    the music tone moved only 0.7 dB and looked like failure.         │
  │    Subtract the ORIGINAL audio from the EXPORTED audio instead.      │
  ├──────────────────────────────────────────────────────────────────────┤
  │ 5. Accepting ANY new edit CLEARS the redo stack. Test on a scratch   │
  │    project, never on the owner's real one.                           │
  ├──────────────────────────────────────────────────────────────────────┤
  │ 6. Node does NOT hot-reload. Restart the API before measuring        │
  │    anything. `preview_start` REUSES a running server — stop it first.│
  ├──────────────────────────────────────────────────────────────────────┤
  │ 7. Coordinate clicks do not land in this browser tool. Drive the UI  │
  │    with javascript_tool, ONE user action per call, because React     │
  │    batches state updates.                                            │
  ├──────────────────────────────────────────────────────────────────────┤
  │ 8. `npm run build` type-checks TEST files. Vitest alone is not       │
  │    enough to claim builds are clean.                                 │
  ├──────────────────────────────────────────────────────────────────────┤
  │ 9. Bulk text edits with backslashes in the pattern silently no-op    │
  │    in some tooling. Verify every bulk edit actually applied.         │
  ├──────────────────────────────────────────────────────────────────────┤
  │10. An unbounded looping image input (`-loop 1` with no `-t`) never   │
  │    finishes. Always bound it to the last instant it is needed.       │
  ├──────────────────────────────────────────────────────────────────────┤
  │11. FFmpeg's `amix` default HALVES both inputs. Always `normalize=0`, │
  │    or adding music silently makes the speech quieter.                │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Known limitations to carry forward, not rediscover

- The drawn nameplate plate is ~10 px shorter vertically in export than in
  preview at 1080p. Position is identical. Closing it needs the font's real
  ascent and descent read from the TTF. ADR-003.
- The old one-thread 30-second observation was 60–90 s. Four fixed threads are
  now 2.38x faster on the representative 10-second benchmark. Job progress is
  durable milestone progress rather than a fabricated frame estimate.
- The transcript format is an **assumption**: `sidecar-import.ts` implements the
  published Whisper word-timing shape and has never seen a real Stage 1 file.
- Captions proved on one English **synthetic** transcript. Right-to-left scripts
  and CJK line breaking untested; 42 characters and 17 characters-per-second are
  Latin-script assumptions.
- The B-roll and music in the real run were **synthetic** — an FFmpeg test
  pattern and a 220 Hz sine.
- No colour or HDR handling; `-pix_fmt yuv420p` is forced. iPhones record HDR by
  default, so washed-out output is plausible and unproven.
- Transcript upload capped at 1 MB by the shared JSON body limit (~20 minutes).
- `StudioScreenProps` now has 23 props and `apps/api/src/server.ts` matches
  routes with an if-chain of regexes. Both are flagged by the architecture gate.
  **Extracting a route table is the next refactor.**
- The fake AI provider's language understanding is deliberately crude. It is a
  test harness, not a feature.
- Free AI-provider schemas, quotas, latency, reliability, and commercial terms
  are unverified. opencode's gateway shape and model list are recorded from the
  owner's instruction, not from a test.

---

## 8. How to verify anything, end to end

```
  1. preview_stop any running server, then preview_start name "sanverse"
     (Node does not hot-reload; a reused server serves OLD code)
  2. use a SCRATCH project, never the owner's
  3. drive the API or the UI; adopt whatever the server returns
  4. export
  5. ffprobe the exported file: duration, codec, dimensions, sample rate
  6. pull FRAMES out of the exported file at the moments things should and
     should not appear, and LOOK at them
  7. for audio, subtract the original from the export and measure what is left
  8. write the measured numbers into DOCS/evidence/<date>-<slice>.md,
     including a "what this does NOT prove" section
```

---

## 9. Where the truth lives

```
  DOCS/HANDOFF.md          ← this file
  DOCS/CURRENT_STATE.md    ← what is built right now, and its limits
  DOCS/plans/PLAN_CHECKLIST.md ← every task, marked [x] / [~] / [ ]
  DOCS/evidence/           ← measured numbers from real runs
  DOCS/adr/
    ADR-002  time and project model
    ADR-003  render contract and preview/export parity
    ADR-004  AI proposes, code executes
    ADR-005  edits anchored to the footage          ← load-bearing
    ADR-006  captions                                ← load-bearing
    ADR-007  many kinds of media, four overlays,
             marks that are not edits                ← load-bearing
  DOCS/PROJECT_LOG.md, DOCS/FAILURE_REGISTRY.md, DOCS/changes/
                           ← history. Never copy back into CURRENT_STATE.
```

**A commit message prefix of `[verified]` means real-media evidence exists.
`[wip]` means it does not.** Do not use `[verified]` without an evidence file.

## Latest handoff — P1-F.0.2.2

Media panel responsive completion and Editor Monitor V1 are implemented on the
same mounted editor session. Read
`DOCS/evidence/2026-08-03-p1f022-media-monitor/IMPLEMENTATION_REPORT.md` before
continuing. Owner visual review is next. Do not begin Media V2 until a new
approved contract defines sorting, bins, multiselect, batch behavior, drag
initiation, drop targets, and insert/overwrite/append policy.

## Latest handoff — P1-F.1E Gate T1, 2026-08-06

**Read `DOCS/evidence/2026-08-04-timeline-completion/PROGRAM_STATE.md` first.**
It is the resume point for this programme and it is committed with the work it
describes, so it is never out of date.

Gates P0, T0 and T1 are DONE. Gates T2 to T7 have NOT started.

### The one thing in T1 that changes how the rest of the system behaves

An export is no longer identified by the project's revision number. It is
identified by the **compiled render plan** — by what will actually be produced.

```
  BEFORE:  key = projectId : revision : schemaVersion
  AFTER:   key = projectId : schemaVersion : the render plan
                             (projectRevision dropped: FFmpeg never reads it)
```

Two consequences to carry forward:

1. **Good:** an edit that cannot change one frame — a note, a group, a track
   muted and unmuted — keeps the finished export. This is what made markers and
   groups possible as real, undoable, saved edits.
2. **A trap:** the old trick of bumping the revision with a harmless toggle to
   bust a cached export failure **no longer works**, because the plan is
   unchanged and so the key is unchanged. To force a genuinely fresh export,
   change something that reaches the video.

### What T1 added that a later gate must not duplicate

- One planner for moving or trimming several things — `timeline-multi-plan.ts`.
  The drag ghost and the committed edit come from it, called with the same
  inputs. Do not write a second "preview" calculation.
- One place that expands what is bound to what — `boundPartners` in
  `timeline-selection-v2.ts`. Groups and picture-plus-its-own-sound links are
  both expanded there so every command treats them identically.
- Two new domain operations, `set-timeline-markers` and `set-timeline-groups`,
  each carrying the WHOLE list rather than a change to it. Same shape as
  `set-track-output`, same reason: the last one wins outright.

### Still open, and stated rather than implied

Every item is listed at the bottom of `T1_CREATOR_INTERACTION.md`. In short:
clicks were dispatched as events rather than made with a physical mouse; the
keyboard presets were not switched in the running app; multi-item move was not
committed on the owner's project because their footage correctly refuses it.
