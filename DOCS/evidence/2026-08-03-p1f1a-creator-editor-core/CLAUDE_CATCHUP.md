# CLAUDE_CATCHUP — Phase 0 gate for P1-F.1A

Date: 2026-08-03
Author: Claude (Opus 5)
Purpose: prove the agent is caught up on the **current** repository before any
code is written for P1-F.1A.

---

## 0. Catch-up confirmation

```
  required starting commit   0d21bc8f2f049b87b0a5a26708be9da844d1079a
  actual HEAD                0d21bc8f2f049b87b0a5a26708be9da844d1079a   MATCH
  branch                     agent/g6-g8-local-alpha                    MATCH
  origin/agent/g6-g8-local-alpha
                             0d21bc8f2f049b87b0a5a26708be9da844d1079a   IDENTICAL
  working tree               clean
  fetch                      completed, nothing to fast-forward
```

No reset, no force-push, no rebase, nothing deleted. The branch was already at
the required commit, so `git pull --ff-only` had nothing to do.

**The old `586fb90` checkpoint and the 749-test state are obsolete and are not
used as truth anywhere in this document.** Everything below was read from the
files at `0d21bc8`, not from memory.

Documents read in full: `START_HERE.md`, `CLAUDE.md`, `AGENTS.md`,
`DOCS/HANDOFF.md`, `DOCS/CURRENT_STATE.md`, `DOCS/evidence/2026-08-03-p1f022-media-monitor/`
(architecture, walkthrough, export verification), plus ADR-001, ADR-005,
ADR-006, ADR-007, ADR-008, ADR-009 and the ADR index.

Code inspected directly (not inferred): `packages/edit-domain/src/`,
`packages/render-contract/src/render-plan.ts`,
`apps/web/src/screens/studio/StudioScreen.tsx`,
`apps/web/src/features/render-plan/footage-motion-preview.ts`,
`apps/web/src/features/render-plan/render-plan-preview.ts`,
`apps/web/src/features/timeline/timeline-view-model.ts`,
`apps/web/src/editor/monitor/`, `apps/web/src/editor/media/`,
`apps/web/src/editor/timeline/`, `apps/web/src/editor/layout-v2/`,
`apps/web/src/features/project-export/project-export.ts`,
`apps/api/src/server.ts`, `apps/api/src/jobs/local-export-job-store.ts`,
`apps/api/src/render/render-service.ts`,
`apps/api/src/render/ffmpeg-render-adapter.ts`,
`apps/api/src/process/command-runner.ts`.

Current schema versions confirmed by reading the constants:

```
  project        sanverse.project/v4          packages/edit-domain/src/project.ts:53
  render plan    sanverse.render-plan/v6      packages/render-contract/src/render-plan.ts:229
  test inventory 1,176                        DOCS/CURRENT_STATE.md
```

---

## A. Why edits are anchored to source/footage time

**The rule.** Every graphic a user authors stores *when it appears* measured
against the **original recording**, not against the finished video.

**The practical reason, stated concretely.**

Say the recording is 30 seconds. At 00:08 the speaker's face is on screen and
the user adds a nameplate reading "Santosh — Founder". Later the user cuts the
first 4 seconds off the front, because the opening was dead air.

```
  ORIGINAL RECORDING (what the camera captured)
  0s        4s        8s                          30s
  |---------|=========|============================|
            ^ cut here          ^ nameplate authored here, on the face

  FINISHED VIDEO after removing the first 4 seconds
  0s        4s                          26s
  |=========|============================|
            ^ the same face is now at 00:04

  ── IF WE STORED FINISHED-VIDEO TIME ────────────────────────────────
  the nameplate says "show me at 00:08".
  00:08 of the FINISHED video = 00:12 of the recording.
  That is four seconds later — a different sentence, possibly a
  different person on screen. The name lands on the wrong face and
  NOTHING warns anyone. The user approved one thing and exported
  another.

  ── BECAUSE WE STORE FOOTAGE TIME (this is what we do) ──────────────
  the nameplate says "show me at 00:08 OF THE RECORDING".
  The system recomputes where that moment now sits: 00:04.
  The name stays on the face it was placed on.
```

**Who does the translating.** Exactly one function:
`placeSourceSpan(composition, assetId, sourceRange)` in
`packages/edit-domain/src/composition.ts`. It is the only translator between
footage time and finished-video time.

- A span that a cut sliced in two returns **two** placements.
- A span whose footage was **deleted entirely** returns an **empty list**, and
  the caller reports that plainly as blocked. It is never relocated to a
  nearby moment, because a guessed position is a silent wrong answer.

**The trade-off, stated.** Anchoring to footage means the system must
recompute positions on every evaluation instead of reading a stored number.
That costs a little work on every edit. It buys the guarantee that a cut can
never silently move a graphic onto the wrong moment. We pay the cost.

This is ADR-005.

---

## B. Why music uses composition time instead

Music is the **single documented exception** to rule A, and it is deliberate.

```
  Song is 20 seconds. Video is 30 seconds. User cuts 10 seconds
  out of the MIDDLE.

  ── IF MUSIC WERE ANCHORED TO FOOTAGE (wrong) ───────────────────
  the 10 seconds of footage removed would take 10 seconds of SONG
  with it. The listener hears the music jump — a lurch nobody chose.

  ── ANCHORED TO THE FINISHED VIDEO (what we do) ─────────────────
  the song plays straight through the join. The cut is invisible
  to the ear.
```

Three consequences follow from that one decision, and all three are already
proved on real media:

1. **A cut can never block music.** Every other overlay family can be blocked
   when its footage disappears; music cannot, because it was never attached to
   footage.
2. **Music plays for as long as there is both video left and song left** — no
   longer. A 20-second song under a 30-second video stops at 20 seconds.
3. **Music is never looped.** A loop point nobody chose is audible, and this
   product's promise is "what you approved is what you exported."

Fades shorten to fit rather than overrunning the end.

This is ADR-007.

---

## C. Why one user action must produce one Undo boundary

The user's mental model is "the thing I just did." If pressing Undo once undoes
a fraction of the thing they just did, the product has lied about what an
action is.

The mechanism is the **atomic change set**:

```
  one user action  ──►  one change set  ──►  one history entry  ──►  one Undo
                          │
                          ├── operation 1
                          ├── operation 2      all-or-nothing
                          └── operation 3
```

If any operation inside a change set fails, **the whole change set is marked
blocked and none of it touches the footage**. There is no half-applied state.
A blocked change set is shown to the user and never quietly adjusted.

This is why, later in this program, a drag gesture must emit **nothing** while
the pointer is moving and exactly **one** validated change set on release. A
pointer-move that emitted operations would turn one human action into dozens of
Undo steps.

**Known defect carried forward, not rediscovered:** a change set holding *both*
a cut and an overlay can currently have the cut applied while being reported
blocked for its overlay. No code path creates such a change set today — the G7
workflow registry exposes no timeline recipes — but this must be fixed before
any feature is allowed to mix cuts with overlays in one change set. Recorded in
ADR-005 and `CURRENT_STATE.md`.

---

## D. Why captions imported from one file form one atomic accepted action

A 30-second video can easily produce 150 caption cues.

```
  ── IF EACH CUE WERE ITS OWN ACTION ──────────────────────────
  "put captions on my video" = 150 history entries.
  Undo once → 149 captions still on screen. Meaningless.
  The user would have to press Undo 150 times.

  ── ONE add-captions OPERATION CARRYING MANY CUES (what we do) ─
  "put captions on my video" = ONE history entry = ONE Undo.
```

Two supporting rules make that safe:

**The transcript is a sidecar, never inside the project.** A transcript is
*evidence about the footage* — what was said — not a *decision the user made*.
Undoing an edit must not erase the knowledge of what was said, so the two are
stored separately.

**Blocking is judged on the whole set, not on each cue.** Cues whose footage
was deleted simply do not draw. The set is blocked only when **nothing**
survives (`ALL_CUES_REMOVED`). Blocking 150 captions because 3 died would leave
a silent video plus a warning the user cannot act on.

Line breaking is **pure arithmetic in the domain — no AI**, so the same
transcript always produces byte-identical cues, and a re-render can never
differ from what was approved.

This is ADR-006.

---

## E. Why unknown closed-contract keys must be rejected, not silently fixed

Every validator lists the keys it allows and **refuses an unknown one**.

```
  A file arrives containing:   { kind: 'add-title', glow: true }

  ── SILENTLY STRIP THE UNKNOWN KEY (wrong) ────────────────────
  the title renders with no glow. The user believes they approved
  a glowing title. The export has no glow. Nobody is told.

  ── REFUSE (what we do) ───────────────────────────────────────
  "this file contains something this version does not understand."
  The user sees it. Nothing is exported that they did not approve.
```

Stripping, defaulting, or clamping an unrecognised value **exports a video the
user did not approve** — the exact failure this product exists to prevent. So
an unrecognised operation kind, style id, capability, or media kind is refused
loudly.

There is one deliberate, documented exception: a **drawn mark** that runs off
the edge of the picture is pulled back to the boundary. That is a pointing
gesture, not an exported pixel, and clamping it is what the user visibly meant.

**The trade-off, stated.** Refusal means old files can stop opening after a
schema change. We accept that, and pay for it with explicit migration ladders
that fail closed rather than guessing.

---

## F. Why browser Preview and export consume one shared render contract

```
        EditProject  (the decisions the user approved)
             │
             │  compileProjectToRenderPlan()   ← ONE compiler
             ▼
        RenderPlan  sanverse.render-plan/v6
             │
      ┌──────┴──────┐
      ▼             ▼
  BROWSER        FFMPEG
  turns the      turns the
  numbers        SAME numbers
  into CSS       into filter args
```

If the preview and the exporter each decided independently where a nameplate
goes, they would drift, and the user would approve one picture and receive
another. One plan makes that structurally impossible: there is only one set of
numbers, produced once.

The plan deliberately names **no font file, no FFmpeg filter, and no CSS rule**.
It holds numbers only. Shared style contracts (`nameplate-style.ts`,
`caption-style.ts`, `overlay-style.ts`) produce those numbers; each renderer
converts them into its own language.

```
  RenderPlan v6
    sources[]     every file the renderer must open, FOOTAGE FIRST
    segments[]    the footage the finished video is made of,
                  including source-anchored footageMotions[]
    overlays[]    what is DRAWN on it
                  text-overlay | caption-overlay | title-overlay
                  | callout-overlay | media-overlay
    music[]       kept OUT of overlays, because music is not drawn
    visuals[]     visual property state bound to concrete nodes
```

Honest limitation carried forward: parity is not perfect. The drawn background
plate is about **10 px shorter vertically in the export than in the preview** at
1080p; position is identical. Closing it requires reading the font's real
ascent and descent from the TTF. Recorded in ADR-003.

---

## G. Why AI and manual UI must emit the same typed operations

```
  user types "put my name on screen"  ──┐
                                        ├──► the SAME validated
  user clicks Add ▸ Title in the UI   ──┘     EditOperation
                                                    │
                                        validate, simulate,
                                        authorize, execute, record
```

If the AI had its own private path into the project, then every rule proved for
the manual path — closed key sets, atomic change sets, source anchoring,
blocking — would have to be proved a second time for the AI path, and the two
would drift. Worse, the AI's output would be trusted.

The rule is **AI proposes, deterministic code executes**. The AI may translate
intent into a *typed proposal*. It never mutates anything. Code validates it
against the same contracts a button press goes through.

A second consequence matters for this program: any new capability built for the
Timeline (place a clip, trim, split) must be expressed as a **validated
capability**, so that a future AI can call exactly the same thing. That is why
Gate C requires a pure placement planner rather than logic buried in React
pointer handlers.

This is ADR-004.

---

## H. Why layout resizing is presentation state and never creates a revision

Dragging a panel splitter changes **how the editor looks to this person on this
machine**. It does not change the video.

```
  PROJECT STATE                    PRESENTATION STATE
  (server-authoritative)           (local, this browser)
  ───────────────────────          ────────────────────────────
  cuts, titles, captions,          dock widths, Timeline height,
  music, motion                    collapse state, active tab,
                                   active workspace, Fit/Fill,
                                   Media search/filter/sort
  ───────────────────────          ────────────────────────────
  changes → new revision           changes → NO revision,
  → history entry → Undo           no history entry, no Undo
```

Two reasons this boundary is load-bearing:

1. **Undo would become useless.** If resizing a panel created a history entry,
   Undo would walk back through window furniture instead of through the user's
   editing decisions.
2. **Export must be unaffected.** A revision means "the video changed." If
   layout bumped the revision, the export idempotency key
   (`projectId:revision:renderPlanSchemaVersion`) would change and a
   re-export would re-render an identical video for no reason.

Layout lives in a closed `sanverse.workspace-layout/v1` contract that validates
and clamps every value before local persistence. Real-browser evidence recorded
revision staying `15 → 15` across every workspace, preset, and splitter action.

This rule extends directly into this program: **Media sorting, filtering, and
folders must create no operation, no revision, and no render change.**

---

## I. Why exactly one native video element must survive layout changes

```
  ONE <video> element, mounted once, never unmounted
        │
        ├── playback authority (play, pause, currentTime)
        ├── the picture the preview shows
        ├── the surface Point coordinates are measured against
        └── the thing the motion canvas draws FROM
```

If a workspace switch, a panel resize, or a fullscreen toggle remounted the
video:

- playback position would reset to zero;
- the browser would re-fetch or re-decode the media, producing a visible black
  flash;
- Point coordinates measured against the old element would be stale;
- decode work would double for a moment, on a machine already running FFmpeg.

So the video element is mounted once in `StudioScreen` and every surface —
`SanverseEditorMonitor`, the layout engine, the workspaces — **wraps** it as
`children` rather than owning it. `MonitorStage` is literally a `<div>` around
`{children}`; it does not create a video.

The test that guards this asserts the **same DOM node identity** survives, not
merely that "a video exists."

---

## J. Why an external renderer may compile a component but may never mutate EditProject

```
  ALLOWED                              FORBIDDEN
  ───────────────────────────────      ──────────────────────────────
  renderer reads a validated           renderer writes into
  RenderPlan and produces pixels       EditProject
                                       ──────────────────────────────
  renderer compiles a versioned        renderer decides what an edit
  component into pixels                means, or invents a value
```

The canonical edit model must stay independent of the render engine so the
engine can be replaced without rewriting the domain (ADR-001's hybrid decision
explicitly keeps preview and export adapters replaceable behind contracts).

The deeper reason is trust. `EditProject` is the record of **what the user
approved**. If a renderer could write into it, then a rendering bug, an
adapter's default, or an external tool's opinion could silently become part of
the approved history — and Undo would walk back through decisions the user
never made.

Related hard rule from ADR-001, still in force: production code must **not
accept HTML or FFmpeg command text from AI output**. Text handed to FFmpeg goes
in **files**, never on the command line, so nothing a user typed can be read as
filter syntax.

---

## K. What is implemented versus merely planned

**Implemented and proved on real media (E4):**

```
  G1–G3   chassis, storage, intake, manual nameplate
  G4-A    project model, capabilities, change sets, undo, migrations
  G4-B    AI proposes / code executes — on a FAKE provider only
  G5-A    captions from a transcript file
  G5-B    cutting: split, trim, remove, reorder, hide, loudness, fades
  G5-C    multi-asset intake, annotations, titles, callouts, B-roll,
          pictures, music
  G6      visual properties, motion, keyframes, easing, transitions
  G7      versioned recipes, outcome workflows, compound plans
  G8      durable resumable export jobs, diagnostics, archives
  P1-A    pure timeline foundation (EditProject → TimelineViewModel)
  P1-B    Production Timeline V1
  P1-C    Inspector V1
  P1-D    Canvas manipulation V1
  P1-E    Media Bin V1        P1-E.1  Studio vertical flow
  P1-F.0  primary-footage motion V1
  P1-F.0.1 Studio workspaces and docking V1
  P1-F.0.2 / .2.1 / .2.2  nested layout, stabilization,
          Media panel + Editor Monitor V1
```

Current Timeline lanes exist and are semantic, not arbitrary. Read from
`timeline-view-model.ts:313–322`:

```
  lane:overlay    V2   overlays, B-roll, images, graphics    order 0
  lane:video      V1   primary video sequence                order 1
  lane:caption    C1   captions                              order 2
  lane:dialogue   A1   dialogue / linked primary audio       order 3
  lane:music      A2   music and additional audio            order 4
```

**Planned, contracted, or partially reachable — NOT done:**

- Real creator drag-and-drop, clip-body movement, insert/overwrite/append,
  track lock and output state, filmstrips, waveforms. **This program.**
- A real AI provider. The adapter exists and is proved over real HTTP against a
  stub; **no packet has ever reached NVIDIA, opencode, OpenRouter, or LM
  Studio.** Blocked on the owner's keys. Explicitly out of scope here.
- Media V2 (sorting, folders, drag payload). **Gate B of this program.**
- Owner visual acceptance of P1-F.0.2.2. Still open.
- Colour/HDR handling. `-pix_fmt yuv420p` is forced; iPhone HDR is untested.
- Right-to-left and CJK caption line breaking.
- A verified Stage 1 transcript format — the shape is an assumption.

**Test and build state at `0d21bc8`:** 1,176 tests. That number is the floor
for this program; the final inventory must be at least 1,176 with no weakened
assertions.

---

## L. What the owner-recorded Preview black-frame failure proves, and what it does not

### What the recording proves

```
  ✓ monitor controls stayed visible          → React did not crash
  ✓ an accepted overlay stayed visible       → the overlay layer kept
                                               rendering and kept correct
                                               geometry
  ✓ base footage went black                  → the BASE PICTURE LAYER
                                               specifically failed
  ✓ black persisted across part of playback  → not a single dropped frame;
                                               a state that stuck
  ✓ no loading / error / gap explanation     → the monitor had no way to
                                               say what was happening
```

**Therefore it is proved that the base-picture layer has a reachable state in
which it shows black while the rest of the editor is healthy, and that the UI
cannot currently distinguish that state from an intentional black gap.**

That second half is itself a real product defect regardless of the first. Right
now, four completely different situations look identical on screen:

```
  intentional gap  ·  still loading  ·  seeking  ·  genuinely broken
        └───────────────── all four render as black ─────────────────┘
```

### What the recording does NOT prove

It does **not** identify the cause. From reading the code at `0d21bc8`, there
are at least four independent mechanisms that can each paint the base layer
black, and the recording cannot tell them apart:

**Candidate 1 — the motion canvas reveals a black frame it has not drawn yet.**
`drawFootageMotionFrame` (`footage-motion-preview.ts:54`) fills the canvas
black, calls `drawImage(video, …)`, then unconditionally sets
`canvas.hidden = false` and returns true. Its only readiness guard is
`videoWidth > 0 && videoHeight > 0`. `videoWidth` becomes non-zero at
`loadedmetadata` (`readyState` 1) — **before any frame is decodable**
(`readyState` 2+). During load or seek, `drawImage` contributes nothing and the
canvas is revealed showing the black fill, on top of a perfectly good video.
This only applies where a footage motion is active.

**Candidate 2 — the video's own opacity.** The `<video>` and the motion canvas
both carry `style={{ opacity: transitionOpacity }}`
(`StudioScreen.tsx:1955, 1965`), but the overlay content layer does **not**.
Any path that drives `transitionOpacity` to 0 produces exactly the recorded
signature: black base, overlays still visible. `segmentVideoOpacityAt` returns 1
unless fades are set, so this needs a fade or a stale/incorrect playhead to
trigger — it must be measured, not assumed.

**Candidate 3 — the intentional gap layer sticking.** `isShowingHole` renders
an opaque black div over the video (`StudioScreen.tsx:1977`). It is entered by
`enterHole` and left by `leaveHole`. If the composition mapping reports a gap
where there is none, or the leave path is missed, black persists and looks
identical to a failure.

**Candidate 4 — stale geometry.** The content layer and canvas are positioned
from `videoContentLayerStyle`. A zero or stale preview scale after a resize
could mis-size layers. This is also the mechanism behind the separate A7
concern about overlay backgrounds expanding to the whole stage.

**Conclusion: the cause is undetermined and will be determined by
instrumentation, not by argument.** Gate A adds development-only diagnostics for
`readyState`, `networkState`, opacity, canvas hidden state, last successful
draw, segment index, composition and mapped source ticks, and all four
rectangles, then reproduces the failure and reads which mechanism fired.

### The separate export finding

`DOCS/evidence/2026-08-03-p1f022-media-monitor/export-verification.md` records
the export staying in "Rendering and verifying your MP4…" beyond 90 seconds.

Read from the code, **one thing is certain before any diagnosis**: the client
cannot ever stop waiting. `exportProject` (`project-export.ts:163`) polls
`while (job.status === 'queued' || job.status === 'running')` every 350 ms with
**no bounded timeout**, and the UI collapses queued, running, and verifying into
a single `'rendering'` state with no elapsed time. So *whatever* the server
does, an unfinished job produces an infinite, unexplained spinner.

That is a real defect on its own and Gate A fixes it. It is **not** a diagnosis
of why the render did not finish. Two further candidates are visible in the code
and must be measured, not assumed:

- `createCommandRunner` (`command-runner.ts`) reads both pipes, so there is no
  classic pipe-fill deadlock — but it applies **no wall-clock limit** to the
  child process. A hung FFmpeg never settles the promise, and the job stays
  `running` forever.
- `create` in the job store is idempotent on
  `projectId:revision:renderPlanSchemaVersion`. `server.ts:477` only starts work
  `if (created.job.status === 'queued')`. A pre-existing job stuck at `running`
  on disk is therefore returned to the client and **never executed**, and the
  client polls it forever.

**Increasing a timeout is explicitly not the fix.** The root cause gets
documented in `export-runtime.md`.

---

## Authorities that must not be duplicated

Confirmed present at `0d21bc8`; this program preserves each and creates no
second version:

```
  project / revision      App + server (server-authoritative editing)
  accepted history        validated change sets
  playback                one HTMLVideoElement in StudioScreen
  playhead                one shared editor session
  Timeline                TimelineViewModel + viewport authority
  selection               one Timeline/Canvas/Inspector selection authority
  visual draft            one Canvas/Inspector draft controller
  media                   one Media Bin source/probing authority
  point                   one Point target + proposal-repair authority
  AI                      one conversation / draft / proposal authority
  preview + export        one shared render-contract path
  workspace layout        local validated presentation state only
```

---

## Gate A entry decision

This document is accurate as of `0d21bc8`. Implementation of Gate A —
Preview reliability and export runtime — may begin.
