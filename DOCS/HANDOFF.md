# HANDOFF — everything a new agent needs to continue Sanverse Stage 2

Written 2026-07-29, at commit `9a895e4`, working tree clean, 749 tests passing,
all five workspace builds clean.

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
| **G5C-07 (half)** | **Repair panels.** A title, callout, B-roll clip, or piece of music can be created and undone, but **not adjusted in place**. There is no way to change a title's wording, retime a callout, or change the music level without undoing and redoing. `NameplateRepair.tsx` is the pattern to follow. |
| **Callout dragging** | A callout always appears at a fixed `{x:0.55, y:0.25, w:0.3, h:0.3}`. It cannot be moved or resized on screen. |
| **Caption editing controls** | `set-caption-cue`, `remove-caption-cue`, and `set-caption-style` are built, tested, and reach the export. **Nothing on screen offers them.** |
| **Timeline controls** | `trim-clip`, `reorder-clip`, and `set-clip-audio` are built and tested. Only split / remove / hide have buttons. |
| **Click-through by hand** | The Add panel, the upload route, and the preview layers were type-checked and their API path was exercised directly with real files. **They were never clicked in a browser.** Do this and record it. |
| **G5B-13** | Only 30/1 constant frame rate has been exercised on real media. Variable frame rate and 30000/1001 fixtures are unrun. |
| **G4B-12C / 12D / 13B / 14** | The first REAL AI call. Only keys are missing. Order is fixed: verify LiteLLM request-body logging is off → run the 18-case corpus **unchanged** against NVIDIA → then opencode Zen. No blind retries. |

### 5.2 G6 — composition, motion, effects (12 tasks, none started)
`G6-01` motion reference fixtures and quality rubric · `G6-02`
position/scale/rotation/opacity · `G6-03` crop, layer order, masks · `G6-04`
property tracks and keyframes · `G6-05` easing curves · `G6-06` spring/bounce ·
`G6-07` transitions · `G6-08` bounded basic effects · `G6-09` renderer
architecture spike on motion fixtures · `G6-10` winning preview/export adapter
path · `G6-11` seek, timing, reduced-motion, fidelity · `G6-12` owner gate.

**Architectural note for whoever does G6:** motion means a property changes over
time, which the current render plan cannot express — every node has one fixed
value. `G6-04` (property tracks and keyframes) is therefore the load-bearing
task, and it will require a render plan v4. Do the ADR before the code.

### 5.3 G7 — components and compound AI (11 tasks, none started)
`G7-01` component and recipe contract · `G7-02` component versions and
compatibility · `G7-03` nameplate/caption/callout/title/motion recipes · `G7-04`
component migration tests · `G7-05` outcome-workflow registry · `G7-06`
multi-action planning · `G7-07` dependency-aware clarification · `G7-08`
compound preview and repair · `G7-09` prove one request / one approval / one
undo · `G7-10` prove old projects retain component appearance · `G7-11` owner
gate.

**G7 MUST fix a known defect:** a change set holding both a cut and an overlay
can have the cut applied while being reported blocked for its overlay. No such
change set exists today because nothing creates one — but `G7-06` multi-action
planning will, so it must be resolved before compound requests ship. See
ADR-005.

### 5.4 G8 — trustworthy local alpha (13 tasks, none started)
`G8-01` evidence matrix and budgets · `G8-02` autosave and crash recovery ·
`G8-03` resumable local jobs and progress · `G8-04` project portability and
integrity · `G8-05` proxies and caches where measured · `G8-06` local
diagnostics and observable errors · `G8-07` safe media cleanup and retention ·
`G8-08` accessibility and keyboard audit · `G8-09` malicious/corrupt media and
recovery tests · `G8-10` profile and remove the largest bottleneck · `G8-11`
repeated owner full-video workflows · `G8-12` non-editor smoke tests · `G8-13`
reach agreed E5 budgets.

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
- A 30-second 1080p CPU export takes 60–90 s and shows no percentage or estimate.
  Deprioritised by the owner.
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
