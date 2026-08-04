# Current State

Last updated: 2026-08-04

## Active goal

**P1-F.1A Gate C1 — Creator Timeline Core V2 is COMPLETE.**

You can now drag a piece of B-roll onto the timeline, move it, pull either end
in, cut it in half, and delete it. You can drop a second piece of music, trim
it, and split it. You can padlock a track so nothing on it moves by accident,
and separately keep a track out of the finished video. Insert really pushes the
rest along, and Overwrite really cuts back what it lands on.

Three things had to be built first, because they did not exist anywhere:

```
   1  nothing could be deleted           →  added  remove-overlay
   2  no track could be kept out of      →  added  set-track-output
      the finished video
   3  music had no length at all         →  added  durationTicks to music
```

The music length is a **known key that may be omitted**. The contract stays
closed, but a project saved before this reads back as `null`, meaning "play
until the video ends or the song ends" — exactly how it already behaved. No
migration, no file rewritten, not one project sounds different.

**Lock and output are two switches and can never be one.** A padlock changes
nothing about the exported file, so it takes no revision and no Undo and lives
in the browser. Keeping a track out of the video DOES change the file, so it is
an ordinary accepted operation with one Undo. Proved on the owner's project:
locking and unlocking A2 left the revision at 19; muting A2 moved it to 20.
See `DOCS/decisions/ADR-TRACK-LOCK-AND-OUTPUT-V1.md`.

**The render plan moved v6 → v7** so each piece of footage says whether its
picture is drawn and its sound heard. The version had to move because the export
key is built from it — otherwise somebody who muted the dialogue and pressed
Export would get the cached file from before the mute.

**One gesture is one change set is one Undo.** Measured during a real twelve-move
drag: the revision did not move once while the hand was moving; the release
produced exactly one edit, or one truthful refusal.

**Plain `S` now toggles snapping and `Ctrl/Cmd+B` splits.** `S` had two possible
meanings and now has one.

**Real export proof.** With V1 hidden and V2 on, the picture reads 16.0
(pure black) at 5 s and 32.3 where the B-roll is drawn. With the dialogue muted
and the music on, the music window is −43.9 dB and the silent window is
−91.0 dB — 47 dB apart, so the dialogue is genuinely gone rather than turned
down. Length unchanged at 30.033 s in every case. Exactly one `<video>` element
throughout, at every viewport size.

**Gate C2 (Multi-asset Primary Sequence) and Gate D (filmstrips, waveforms,
long-form bounds) have NOT started.**

**Tests 1,389 → 1,510.** Build exit 0. No assertion weakened, nothing skipped.
`DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/gate-c1-creator-timeline-core.md`

---

## Previous goal

**P1-F.1A Gate C1.1 / C1.2 — the placement planner and media drag.**

`planTimelinePlacement` is the single home of placement policy: a pure function
with no React, no network and no mutation, so dragging a logo onto the intro and
typing "put the logo over the intro" produce the same operation rather than two
rulebooks that drift apart. It owns policy only and hands construction to
`features/media/media-actions`. The lane highlight and the outcome are one
decision, held by a test that walks every lane against every kind of file.
`DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/placement-planner.md`.

---

## Previous goal

**P1-F.1A Gate C0 — Atomic compound change sets is complete.**

One approved request is one change set is one Undo — and now that holds for the
**cuts** inside it too, not only the overlays.

The replay used to apply a change set's cuts first and judge its overlays
second, with no way for the second verdict to reach back. A set holding a cut
and an overlay could therefore leave the cut in the finished video while
reporting itself blocked. The user would see an error message and a shortened
video at the same time, and pressing Undo would not remove the cut, because the
project never recorded it as something that happened.

Refusing a change set now **retracts** its cuts and re-runs the whole replay.
This ends, because a refused set is never revived — the loop the original code
warned about needs un-refusing to start, and nothing here un-refuses. Today's
projects finish in one round, so nothing got slower.

The accept path was already safe; the broken path was replaying already-accepted
history after a later edit invalidated an earlier set. Disabling the fix fails
exactly 2 of the 24 new tests, which is the honest size of the defect.

Also landed: `AtomicChangeSetResult` (accepted, or blocked with the **original**
project and the index of the operation that refused) and
`createIdFactory(changeSetId)`, whose names are derived by hash so a refused
draft burns no ID and a retry is recognised as the same edit.

Browser-proved on real 30-second media: a mixed request returned 400 with the
timeline unmoved at `00:00:28:01`; a valid two-operation request gave one
revision, one history entry, one Undo for both, one Redo for both, and survived
a reload. `DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/gate-c0-atomicity.md`.

**Tests 1,319 → 1,350.** Build exit 0. **Next: Gate C1.**

---

## Previous goal

**P1-F.1A Gate B1 — Preview and responsive owner repair is complete.**

**The preview no longer depends on where the mouse is.** The owner recorded a
picture that went black the instant the pointer left the video. Two faults,
stacked: the motion canvas could not be switched off (the code set the HTML
`hidden` attribute; the stylesheet's `display: block` on the same element beat
the browser's own `[hidden] { display: none }`, so a never-drawn opaque black
canvas sat on top of healthy video), and a hover rule was then added to make
that black lid transparent *while the pointer was on the video* — which is
precisely why it came back when the pointer left.

One resolver now decides what the picture is — `native-video`,
`motion-canvas`, `gap`, `loading`, `error` — and its input type contains no
pointer, hover, or focus field at all. **When in doubt it shows the native
video:** untransformed real footage beats black. The base picture is black in
exactly one case, a stretch the user deliberately emptied, which is black in the
exported file too. Every canvas draw records a frame token (asset, source time,
composition time, motion, geometry version) and the canvas is shown only when
that token is the one being asked for, so a cleared canvas, a stale seek, a
swapped source, or a frame drawn at the old panel size can never be presented as
the current picture. `FAIL-049`, and
`DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/gate-b1-preview-base-layer.md`.

**FAIL-047 is fixed, and its original diagnosis was partly wrong — recorded, not
quietly corrected.** The "stale responsive mode after resize" could not be
reproduced in a normally displayed browser: the pane used for that testing never
runs the browser's rendering steps, so `resize`, `matchMedia` **and**
`ResizeObserver` notifications were all suppressed — measured as literally zero
events across a real 1440 → 1024 → 1440 change. The staleness was the
instrument. The real defect was one pixel wide: `@media (max-width: 1100px)`
matches **at** 1100 and hid the docks, while `width < 1100` was false and
withheld the replacement controls, so a window exactly 1100px wide had no Media
panel, no Tool panel, and no way back. `studio-responsive-authority.ts` is now
the single place the breakpoints exist, compares with `<=`, re-reads the live
width through `useSyncExternalStore` so no stale copy can exist, and is held by
a test that reads the real `.css` files.

Media density was refined: rows 58px → **52px** (by naming line heights, not by
shrinking text), panel padding a flat 6px, and the header's word labels switch
to icons at 280px rather than 220px — measured, because at a 228px panel the
words needed 271px and the overflow button was being clipped 2px past the edge.
The redundant "N results" line now appears only when something is actually
narrowing the list.

Suites: web 667, edit-domain 312, api 248, render-contract 65, intent-domain 27
— **1,319 total** (Gate B 1,283); all-workspace build passes; no assertion
weakened. Real-browser proof: 20.5 s of playback plus five seeks with the
pointer provably nowhere (`:hover` count 0 throughout) and **zero black
frames**, brightness never below 105 of 255; the project came out unchanged at
revision 4.

**Stop boundary: Gate C (Creator Timeline Core V2) and Gate D (filmstrips and
waveforms) have not started.** `FAIL-048` (imported names forgotten on reload)
remains open as a P2 and is deliberately deferred to its own ADR-backed slice,
"Asset Metadata Sidecar V1".

### Previous checkpoint

**P1-F.1A Gate B — Media Library V2 Essentials is complete.** The Media panel is
a compact, container-responsive shelf with import by media kind, drop from the
operating system, sorting, filtering, and durable one-level folders.

**The load-bearing decision: your filing of your media lives on the server,
beside the project, and is not part of the project.**
`.sanverse-data/projects/<id>/media-organization.json` holds a closed
`sanverse.media-organization/v1` document. It is not in the browser (per-browser
storage is silently cleared and the server can never see it) and it is not in
`EditProject` (Undo would step through folder renames, and moving the revision
would move the export key `sha256(projectId : revision : renderPlanSchemaVersion)`,
so renaming a folder would re-encode an identical MP4 for 60–90 seconds).
See `DOCS/decisions/ADR-MEDIA-ORGANIZATION-V1.md`.

A folder is a **label, not a container**: deleting one returns its media to the
top level and can never delete media. Five typed validated commands
(create / rename / move-to-folder / move-to-root / delete) are the only way to
change it, so a future AI calls exactly what the buttons call.

Sorting, filtering, folder choice, search and selection are **presentation
only** and are owned by the Studio screen rather than the panel, because the
panel is unmounted whenever the user switches workspace — state held inside it
would silently vanish and the user would never know why.

Media-to-Timeline drag is **built, tested, and deliberately switched off**
(`MEDIA_DRAG_ENABLED = false`). The closed `sanverse.media-drag/v1` payload
carries `assetId`, `mediaKind` and `sourceDurationTicks` and nothing else — no
filesystem path, no URL, no object URL, no project or asset object. A gesture
that can start and can never finish teaches the user the product is broken, so
it stays off until a Timeline can accept a drop in Gate C.

Only the results region scrolls. The filter never renders five squeezed buttons:
five > 380px, four + More at 301–380, one Filter button at 221–300, icons at
≤ 220 — every shape writing one filter value through one callback.

Suites: web 631, edit-domain 312, api 248, render-contract 65, intent-domain 27
— **1,283 total** (Gate A baseline 1,203, program floor 1,176); all-workspace
build passes; no assertion weakened. Real-browser proof on real video, image and
audio: the project came out **byte-identical** after create → duplicate refusal →
rename → move in → move out → delete, and the filing survived a full page
reload. Evidence: `DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/`.

Two pre-existing defects were found and recorded but NOT fixed here, because
this gate fixes only Gate B blockers: **FAIL-047** (resizing a window past
1100px strands the user with no Media or Inspector panel until reload) and
**FAIL-048** (imported file names are forgotten on reload).

**Stop boundary: P1-F.1A Gates C and D have not started. P1-F.2 has not
started.** Owner visual acceptance of Gate B is open — and note that no
screenshots exist for it, because the browser pane was not displayed during the
session, so its layout is proved by measured DOM geometry and its appearance is
not proved at all.

### Previous checkpoint

**P1-F.0.2.2 — Media Panel Completion and Editor Monitor V1 is technically
complete; owner visual acceptance is open.** Media now adapts to its own pane
and only results scroll. One custom editor monitor surrounds the existing video
and exposes Point, custom transport, Fit/Fill/100%, guides, and fullscreen while
preserving one editor/project/revision/video/playhead/proposal/history/export
authority. The full suite passed 1,174/1,174 before blocker review; the final
affected gate passed 31/31 after two new assertions (current inventory 1,176).
The all-workspace and final web production builds pass. The real browser edit,
Undo, and Redo passed; the real export runtime
remained rendering beyond 90 seconds and is recorded without claiming success.
Evidence: `DOCS/evidence/2026-08-03-p1f022-media-monitor/`.

**Stop boundary:** Media V2 and P1-F.1 have not started.

### Previous checkpoint

**P1-F.0.2.1 — Nested Layout Stabilization and Panel-Responsive Components is
technically complete; owner visual acceptance is open.** Desktop now has one
viewport-height authority, AI collapses to a real full-height 52 px rail,
Preview and Timeline retain protected minimum geometry, panel content responds
to named containers, and screens below 981 px use one reachable natural-flow
document. The same editor authority, ChatComposer, native video, playhead,
proposal, history, preview path, and export path remain mounted. Real-browser
editing, Undo, Redo, responsive geometry, ten stable 1440×900 AI expand/collapse cycles, keyboard resize,
and a 1080p export passed. Final suites pass 1,164/1,164 and the production
build passes. Evidence:
`DOCS/evidence/2026-08-03-p1f021-layout-stabilization/`.

**Stop boundary:** P1-F.1 has not started.

### Prior completed milestone

**P1-F.0.1 - Studio Workspaces and Docking V1 is technically complete on 2026-08-01.** Studio now exposes Edit, Effects, Color, and Audio as accessible Studio-only workspace views over one existing editor authority. The same `EditProject`, revision, accepted history, Undo/Redo stacks, playhead, Timeline selection and viewport, Canvas/Inspector draft, native video, AI conversation, pending proposal, preview, and export path survive every workspace and Tool/AI dock switch.

Layout state is a separate closed `sanverse.workspace-layout/v1` presentation contract. It validates and clamps left/right dock widths, Timeline height, collapse state, active Tool/AI tab, active workspace, and bounded Edit/Motion/Timeline/Review/AI/Audio presets before local persistence. Pointer and keyboard splitters support bounded movement, Home/End, Shift steps, and Escape cancellation. Compact layouts use explicit Media and Tool/AI switches without creating a second editor or page-scroll authority.

Workspace content is truthful. Edit reuses Media and Inspector; Effects exposes only current footage-motion and visual-effect capability; Color explicitly says primary-video grading is not implemented; Audio reuses existing V1/A1/A2 gain/fade/enabled controls and does not fake waveforms, EQ, compression, mixing, or cleanup. Layout changes use the existing throttled geometry refresh and create no edit operation, project rebuild, or revision.

Real Microsoft Edge completed Assist → Studio, all four workspaces, Tool/AI continuity, every preset, all three keyboard splitters, dock collapse/reset, Point precedence, 1440×900 / 1024×768 / 390×844 responsive checks, export, and Home cleanup. The same video and AI draft survived; project revision stayed `15 → 15`; tablet/mobile had no horizontal overflow; page errors, console errors, and failed local HTTP responses were all zero. The browser-triggered export probed as 1920×1080 H.264 High at 30 fps with AAC-LC stereo, 18.033333 seconds, 10,789,990 bytes, SHA-256 `176c85e64e8c44dc99cb8f65e4ccb5a5a221ac96da045d5f178ec8971eb59451`. Final suites pass API 239/239, web 514/514, edit-domain 299/299, intent-domain 27/27, and render-contract 65/65: **1,144/1,144 total**, plus the all-workspace build. Evidence: `DOCS/evidence/2026-08-01-p1f01-studio-workspaces-docking-v1/`.

**P1-F.0 - Primary-Footage Motion V1 remains complete.** Its source-anchored motion identity, shared evaluator, Inspector/Canvas controls, preview/export parity, and prior evidence remain authoritative at `DOCS/evidence/2026-08-01-p1f0-primary-footage-motion-v1/`.

**P1-E.1 - Studio Vertical Flow remains complete.** The browser document is the one outer vertical-scroll authority. Studio uses natural height and normal-flow rows, while Media, Inspector, and AI retain intentional internal scrolling. Evidence: `DOCS/evidence/2026-08-01-p1e1-studio-vertical-flow/`.

**P1-E - Media Bin V1 remains complete.** Import, search, filters, shared labels, usage, source probing, B-roll/music placement, missing-media truth, and responsive behavior remain intact. Evidence: `DOCS/evidence/2026-07-31-p1e-media-bin-v1/`.

**P1-B remains the Production Timeline authority, P1-C the contextual Inspector, P1-D the overlay Canvas interaction layer, P1-E the Media Bin, P1-F.0 the primary-footage motion authority, and P1-F.0.1 the Studio workspace/docking presentation authority. P1-F.1 and P1-F.2 have not started.**

**P1-B.1 repository-wide test truth is complete and owner-approved on 2026-07-30.** The three
previously recorded verification failures are resolved without product changes:
real contract tests now register with Vitest; export server tests assert the
current `202 Accepted → poll job → terminal result/error` lifecycle; and the
signed music-gain test atomically verifies `-24`. Full results are web 332/332,
edit-domain 265/265, API 233/233, render-contract 51/51, intent-domain 27/27,
and focused Timeline/Studio 79/79. The all-workspace build passes with the same
P1-B production bundle. Evidence:
`DOCS/evidence/2026-07-30-p1b1-test-truth/`.

**P1-A remains the authoritative pure timeline foundation.** It owns the
`EditProject → TimelineViewModel` projection, semantic lanes, derived gaps,
detached proposal items, diagnostics, viewport math, and the gesture adapter.
P1-B consumes that one-way presentation boundary; it does not persist a second
timeline document.

**P0-E is complete and owner-approved.** The owner explicitly approved the
layout and started P1-A from commit
`d48aabf34fdadbd6899807fa0c6de0c854a5dc5f`; `UX-007` records the resolved
visual gate. Studio remains the same five-region frame and production UI.

**P0-D.1 is technically complete on 2026-07-29.** Home is compact; Assist
uses a more readable video-first hierarchy; empty proposal and pre-Point dead
actions are gone; pending/accepted/blocked changes have redundant non-color
markers; and Undo, Redo, and Export expose exact accessible disabled reasons.
The focused result is 78/78 passing tests plus a clean production build.
Responsive before/after evidence and the browser continuity walkthrough are in
`DOCS/evidence/2026-07-29-p0d1-visual-corrections/`. The owner approved P0-D.1
by starting P0-E from its completion commit on 2026-07-30, so `UX-005` is
resolved.

**P0-D is technically complete on 2026-07-29.** Assist is now the video-first
default workspace, while the same mounted editor session, project, revision,
video/playhead, proposal, repair state, history, Undo/Redo, preview, and export
survive Assist ↔ Studio switches. Focused evidence is 67/67 passing web tests,
a clean production build, and a real `test-30s.mp4` browser loop through
proposal, repair, Accept, Undo, Redo, export, and download. Exact-size
1440×900, 1280×800, and 1024×768 screenshots plus the complete report are in
`DOCS/evidence/2026-07-29-p0d-assist/`. Owner visual/interaction approval
remains open.

**P0-R is complete on 2026-07-29.** The decision is **C: study OpenCut
behavior and build a focused Sanverse timeline**. P1-A and P1-B now implement
that decision with Sanverse-owned contracts, components, operations, history,
preview, and export authority. Decision:
`DOCS/decisions/P0-R_OPENCUT_TIMELINE_REUSE_DECISION.md`.

**P0-B and P0-C are technically complete on 2026-07-29.** The web app now has
a small reusable UI kernel and one persistent `EditorShell` with switchable
**Assist** and **Studio** workspaces. The same mounted editor, project, revision,
playhead/video element, pending proposal, history, Undo/Redo, save state, and
export state survive the switch. Assist exposes the current canvas,
conversation, pointing, proposal/history, and a compact change strip; Studio
retains the current engineering controls.

**The executable G6/G8 technical batch is complete: G6-11 and
G8-02 through G8-10 are complete. Remaining G8 work is owner approval,
repeated owner workflows, representative non-editor smoke tests, and agreed E5
budgets. These human evidence gates are not implementation tasks.**

G5-B's technical controls and media-fixture gate are complete. Trim,
remove-with-gap, reorder, loudness, and fades are reachable from Studio, and
VFR/rational-rate/audio/boundary fixtures have been conformed and probed. The
owner workflow gates remain owner decisions.

G4-B is finished except the first real API call, which is blocked on the owner's
keys. The chat box works: a sentence typed into it produces a pending proposal,
one short question, a plain "cannot do that", or a refusal — and nothing else.
The provider behind it is a deterministic fake that ships with the build, so no
network call is made and no data leaves the machine.

G1 remains partly open for the owner's final motion, native drag-and-drop, and
overall Studio UX acceptance. That owner-only evidence gate must not be silently
marked complete, but it does not erase the completed G2/G3/G4-A foundation.

## Completed foundation

- G0 foundation, governance, architecture decisions, anti-drift documents, Git
  baseline, and private remote are complete.
- The local web application runs at strict `http://localhost:2000`; its internal
  API binds only to `127.0.0.1:2001`.
- An uploaded MP4 is streamed into an immutable, project-owned local copy with
  an integrity manifest.
- **G4-A chassis (complete).** `sanverse.project/v2`: one fixed clock of
  1,440,000 ticks per second, half-open ranges, opaque storage references,
  clip-instance composition, a capability registry, atomic change sets with
  revision fencing, selective deactivation, and a lossless idempotent v1→v2
  migration that blocks rather than drops what it cannot express. ADR-002.
- **G4-A render contract (complete).** `@sanverse/render-contract` holds one
  description of a nameplate. Browser preview and FFmpeg export compile the same
  plan, and a parity test evaluates the exact FFmpeg placement expression
  numerically. The exporter's font is served to the browser. ADR-003.
- **G5-A captions (built end to end, on a transcript file).** A transcript is
  a per-asset sidecar, never inside the project, because it is evidence about
  footage rather than a decision the user made. Captions are one `add-captions`
  operation holding many cues, so "put captions on my video" is one Undo, and
  later corrections are small operations folded over it in history order. Line
  breaking is pure deterministic arithmetic in the domain, so a re-render cannot
  differ from what was approved. Every cue is anchored to the original footage,
  so cutting moves them with the words; cues whose footage is deleted simply do
  not draw, and only a set with nothing left surviving is blocked. ADR-006.
- **G5-A rendering.** A new `caption-overlay` node kind, one shared caption style
  contract read by both CSS and FFmpeg, and the filter graph moved out of the
  command line into a file so a fully captioned video cannot exceed the
  operating system's command-line limit.
- **G5-B cutting (complete in the domain, the renderer, and the screen).**
  Cuts are ordinary operations in ordinary change sets, so one cut is one Undo
  and a single cut in the middle of the history can be switched off on its own.
  Every edit drawn on the picture stores its timing against the ORIGINAL
  footage, so trimming the front moves a nameplate with the face it was placed
  on instead of leaving it at a wall-clock moment that now shows something else.
  Footage deleted outright blocks the edit and says so; it is never relocated.
  Project and operation schemas moved to v3 with a one-entry upgrade ladder.
  ADR-005.
- **G5-B render and playback.** The render plan now separates `segments` (what
  the video is made of) from `overlays` (what is drawn on it). FFmpeg trims and
  concatenates, filling deliberate holes with real black and real silence. The
  browser preview jumps between stretches so it shows the same video the export
  produces.
- **G4-B tasks 01–11 (complete, on a fake provider).** `@sanverse/intent-domain` holds a closed
  request shape, a closed untrusted candidate shape, six bounded clarification
  fields, and the evaluation contract. The API holds the provider port, the
  deterministic fake, the outbound allowlist, and the fixed 13-step intent
  service. The browser holds the chat composer, the by-hand repair panel, and
  provenance display. ADR-004.
- Editing is server-authoritative: the browser asks and adopts what it is told.
  Export compiles the stored project on the server and takes no edit list from
  the client.
- Accepted history persists under ignored `.sanverse-data/`; Home lists recent
  projects and reopening restores saved history.

## Test and build state

```
  edit-domain      299
  render-contract   65
  intent-domain     27
  api              239
  web              515
  ------------------------
  total           1145 passing; all workspace builds clean
```

These are the final P1-F.0.1 closure totals from sequential commands on 2026-08-01.

Focused P0-B/P0-C evidence on 2026-07-29: 12/12 web continuity tests passed
(`EditorShell.test.tsx` plus `App.test.tsx`) and the web production build passed.
A real browser reopened `test-30s.mp4`, switched Assist → Studio without a
reload, retained 9 history entries, and kept exactly one video element. This is
technical browser evidence, not the owner's visual/interaction approval.

## Owner evidence still open

- Perform a native human drag-and-drop upload and decide whether the current
  interaction motion feels acceptable.
- Complete one final personal end-to-end acceptance run. Automated or scripted
  browser interaction cannot substitute for that judgment.

## Not built

- A call to any real AI provider. The adapter for one exists and is proved over
  real HTTP against a stub (G4B-12A/12B/13A, DEC-011), but **no packet has
  reached NVIDIA, opencode, OpenRouter, or LM Studio.** The fake remains the
  default and the only provider that runs. Blocked on the owner's API keys, and
  on verifying LiteLLM's request-body logging is off (G4B-12C).
- A control on screen for trim, reorder, or clip loudness and fades. All three
  are built, tested, and reach the export, but nothing offers them yet.
- Creating a deliberate hole from the screen. The remove button always closes
  the gap; holes exist in the domain, the preview, and the export only.
- A control on screen for rewording, retiming, or deleting one caption, or for
  changing the caption look. All four are built, tested, and reach the export.
- Automatic transcription against a real service. The boundary, its consent
  rule, and a refusing default adapter exist; nothing is wired.
- A verified Stage 1 transcript format. The importer follows the published
  Whisper word-timing shape and has never seen a real Stage 1 file.
- Primary-footage layer, mask, opacity, effect, or entrance/exit transition controls; P1-F.0 intentionally includes only position, uniform scale, rotation, crop, and bounded keyframes/easing
- Reusable versioned titles, callouts, subtitle components, B-roll, or templates
- Compound requests that produce more than one operation
- Per-frame export percentage; durable milestone progress is implemented
- Accounts, authentication, tenancy, billing, cloud
  storage/rendering, quotas, or production SaaS operations
- Advanced object tracking, segmentation, or a data/model flywheel

## G5-C so far — many kinds of media, and four new overlays

Built, wired to the screen, and **proved in real exports** on 2026-07-29; see
`ADR-007` and `DOCS/evidence/2026-07-29-g5c-real-media.md`. That run found two
defects 741 passing tests had missed, both now fixed and guarded.

- A project can now hold several videos, pictures, and music. One asset type
  with a stated kind; a picture has no length and music has no picture, and
  those fields are null rather than faked. Project schema is **v4**, with a
  v3 -> v4 migration that stamps `video` on every existing asset.
- **Bringing media in is not an edit.** `addAsset` creates no change set and no
  undo entry.
- **Annotations** — point, circle, box, arrow, freehand — as marks that carry
  what "this" meant. Structurally incapable of reaching the export: no
  capability, no operation kind, never seen by the compiler. Coordinates proved
  identical across nine display shapes including portrait, letterboxing,
  resizing, and fullscreen.
- **Four new operations**: `add-title`, `add-callout`, `add-media-overlay`
  (B-roll and pictures), `add-music`. Titles, callouts, and B-roll are anchored
  to the footage. **Music is anchored to the finished video on purpose**, so
  cutting the middle out does not cut the middle out of the song.
- Render plan **v3**: a `sources` list naming every file to open, three new
  overlay node kinds, and music kept out of the overlay list because it is not
  drawn.
- FFmpeg: several inputs, B-roll composited under the words, still pictures
  bounded with `-loop 1 -t`, audio mixed with `normalize=0` so music cannot
  quietly duck the speech, and a real sound track built for silent footage when
  music is added.
- **Direct repair is implemented for all four families.** A title, callout,
  B-roll/picture, or music bed can be adjusted without undoing and recreating
  it. Each adjustment is a complete `set-*` operation, one history entry, and
  one Undo. The compiler folds repairs before creating the shared render plan.
  Focused direct domain/render evidence and relevant TypeScript checks pass;
  browser click-through is not yet E4-verified.
- **G6 visual properties have one shared motion model.** The closed
  `set-visual-properties` operation covers transform, crop, layer, mask,
  keyframes, cubic-Bezier easing, spring, and bounce. Render plan v5 binds that
  state to concrete nodes after cuts. Bounded basic effects are registered,
  browser CSS consumes visual state for every overlay family, and native FFmpeg
  consumes it for media overlays. The hybrid architecture was retained after a
  measured real motion render. ADR-008 and the G6 adapter evidence.
- **G7-02 through G7-09 are implemented.** Five immutable recipes, four outcome
  workflows, exact version compatibility, fail-closed migrations, dependency
  ordering, atomic multi-action plans, detached compound preview, targeted
  repair, and one-approval/one-Undo proof are recorded in ADR-009.

## Known limitations

- **The new repair panel has not been clicked through in a real browser.** Its
  domain/render contract and TypeScript boundaries pass, but this is not E4
  usability evidence.
- **A callout cannot be moved or resized on screen.** It appears in a fixed
  sensible place over the middle-right of the picture.
- **The on-screen controls were not driven by hand.** The Add panel, the upload
  route, and the preview layers are built and type-checked, and the API path
  behind them was exercised directly with real files. Clicking through them in
  a browser is not done.
- **The B-roll and music used in the real run were synthetic** — an FFmpeg test
  pattern and a 220 Hz sine. A real phone clip and a real song have not been
  through it.
- A second video cannot be appended to the timeline. Multi-asset intake is the
  shelf; there is no `append-clip` operation.
- **The drawn background plate is about 10 px shorter vertically in the export
  than in the preview** at 1080p. Position is identical. Closing it needs the
  font's real ascent and descent read from the TTF. Recorded in ADR-003.
- The previous one-thread 30-second observation was 60–90 seconds. G8-10 now
  pins four threads after a 2.38x representative benchmark. Progress is durable
  milestone progress, not an invented per-frame estimate.
- **G6-07 and G6-10 are implemented.** Adjacent-clip dip transitions carry
  explicit video/audio ramps through preview and native export. Media and
  written overlay families consume the shared visual adapter path; written
  families are isolated on transparent layers before effects are applied.
- G6-11 evaluator/adapter fidelity contracts cover every authored property and
  easing family at seek boundaries. G6-12 owner motion-feel approval remains.
- Captions have been proved with one English, synthetic transcript on one
  recording. Right-to-left scripts and CJK line breaking are untested; the
  segmentation rules (42 characters, 17 characters per second) are Latin-script
  assumptions.
- A transcript upload is capped at 1 MB by the shared JSON body limit, which is
  roughly a 20-minute transcript with word timings.
- A change set holding both a cut and an overlay can have the cut applied while
  being reported blocked for its overlay. The G7 workflow registry cannot
  create this case because it exposes no timeline recipes. The replay defect
  must be fixed before a future workflow is allowed to mix cuts and overlays.
  ADR-005.
- Durable resumable render jobs, real diagnostics counts, content-addressed
  portable archives, and fail-closed restore are built. Portable restore
  requires matching media to be imported first; video bytes are not embedded.
- No colour or HDR handling; `-pix_fmt yuv420p` is forced. iPhones record HDR by
  default, so washed-out output is plausible and unproven.
- Parity was measured with Arial only, and by real export only for the
  `top-left` and `center` anchors.
- The fake provider's language understanding is deliberately crude. It is a test
  harness, not a feature.
- Recent-project presentation remains minimal, and the Home draft request is not
  restored when reopening a project.
- Free AI-provider schemas, quotas, latency, reliability, and commercial terms
  remain unverified. opencode's gateway shape and model list in particular are
  recorded from the owner's instruction, not from a test.

## Evidence boundary

The manual nameplate slice, the G4-A chassis, and the G4-B fake-provider loop
all have real-media and real-browser evidence, recorded with measured numbers in
`DOCS/evidence/`. Everything else is unimplemented. Historical detail belongs in
`PROJECT_LOG.md`, `FAILURE_REGISTRY.md`, and `changes/`; it must not be copied
back here as contradictory current state.

## P1-F.0.2.2 current checkpoint — 2026-08-03

Media responsive presentation and Editor Monitor V1 are technically complete.
Media now has one adaptive header/control surface and one results-scroll owner.
The existing video is wrapped by one custom editor monitor with Point, custom
transport, Fit/Fill/100%, guides, frame stepping, seek, sound, and bounded
fullscreen. One project, revision, video, playhead, selection, proposal,
history, preview, and export path remain authoritative. Media V2 capabilities,
Timeline V2, Inspector expansion, AI expansion, and renderer work have not
started. Owner visual approval remains open. Evidence:
`DOCS/evidence/2026-08-03-p1f022-media-monitor/`.
