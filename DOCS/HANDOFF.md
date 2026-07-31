# HANDOFF — everything a new agent needs to continue Sanverse Stage 2

Updated 2026-07-31. **P1-E — Media Bin V1 is technically complete.** One immutable Media view model is derived from the accepted project. It provides import, search, All/Video/Images/Audio/Missing filters, usage, source status, keyboard navigation, right-click/Shift+F10 actions, compatible placement, and responsive Media layouts.

Import is not an edit. Image/video placement reuses `add-media-overlay`; audio placement reuses `add-music`; music repair reuses `set-music`. Media selection is presentation-only. Timeline, Canvas, and Inspector keep the existing shared Studio selection and visual draft. One pure label authority now feeds all four surfaces, resolving `UX-011`.

A fresh isolated Edge run used a real talking-head MP4, image, secondary MP4, and WAV. It completed image move/resize/crop, B-roll, music gain/fade, Undo/Redo, search/filters, keyboard/context menus, missing image/audio checks, expected missing-source export failure, restoration, successful export/download, probe, frame/audio inspection, and resource cleanup at 1440×900, 1280×800, 1024×768, and 390×844. Unexpected page, console, and HTTP errors were zero. Final suites pass web 473/473, edit-domain 265/265, API 235/235, render-contract 51/51, intent-domain 27/27, plus the all-workspace build. Start with `DOCS/evidence/2026-07-31-p1e-media-bin-v1/P1-E_IMPLEMENTATION_REPORT.md`.

P1-B remains the Production Timeline authority, P1-C the Inspector, and P1-D the Canvas interaction layer. No second project, history, media library, editor selection, visual draft, schema, operation family, API route, renderer architecture, or persistence format was added. Unused asset deletion remains deferred. **P1-F has not started.**

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
`sanverse.render-plan/v3`. It names no font file, no FFmpeg filter, and no CSS
rule. The browser preview and the FFmpeg export read the **same plan**. Every
visual number comes from a shared style contract
(`nameplate-style.ts`, `caption-style.ts`, `overlay-style.ts`) that produces
NUMBERS; the browser turns them into CSS and the exporter turns them into
FFmpeg arguments.

```
  RenderPlan v3
    sources[]     every file the renderer must open, FOOTAGE FIRST
    segments[]    the footage the finished video is made of
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
