# P1-F.1E — Complete Timeline Experience — LIVE PROGRAM STATE

**This file is the resume point. Read this first, before any other file, in every
new session. It is updated at the end of every working block, not only at the end
of a gate.**

Last updated: 2026-08-06
Branch: `agent/g6-g8-local-alpha`
Program start commit: `45c0c981fb869afd236f10cbea829b1859d5beb6`
Latest pushed commit: see `git rev-parse HEAD` — this file is committed WITH the
work it describes, so HEAD is always the commit that made these numbers true.
Test baseline at program start: **1,723**
Tests now: **2,050** — edit-domain 419 · render-contract 108 · intent-domain 27 ·
api 361 · web 1,135. `npm run build` exit 0.

---

## THE ONE-SCREEN ANSWER TO "WHERE ARE WE?"

```
  GATE   WHAT IT IS                                   STATE        COMMIT
  ────   ──────────────────────────────────────────   ──────────   ──────────
  P0     Verify + capability inventory                DONE         ad11b07..
  T0     Correctness: preview truth, mixed export     DONE         ad11b07
  T1     Creator interaction: selection/clipboard     DONE         (this commit)
  T2     Speed, audio, transitions                    NOT STARTED  —
  T3     Precision trim: ripple/roll/slip/slide       NOT STARTED  —
  T4     Keyframe lanes + graph editor                NOT STARTED  —
  T5     Advanced tracks, expandable tracks           NOT STARTED  —
  T6     Sequences + source-editing workflows         NOT STARTED  —
  T7     Transcript + AI-ready contracts              NOT STARTED  —
```

**Next action when a session starts:** find the first row that is not DONE, open
its section below, and continue at the first unticked box.

---

## HONEST SCOPE NOTE — READ THIS BEFORE PROMISING ANYTHING

This program is eight gates. Each gate is the size of the whole of Gate D, and
Gate D alone took a full session plus a compaction. T4 (a Bezier graph editor),
T6 (nested sequences, compound clips, three-point editing, proxies, render
cache, multicam) and T7 (a transcript model with word-level mapping) are each
larger than Gate D.

This will take **many sessions**. That is not a failure and it is not a reason
to rush a gate. The rule that protects the owner is:

> A gate is either DONE (tested, real-browser-proven, committed, pushed, local
> SHA == remote SHA) or it is NOT STARTED. There is no "mostly done" gate.

A half-finished gate that is committed is worse than no gate, because the next
session cannot tell what is trustworthy.

---

## GATE ORDER IS NOT NEGOTIABLE, AND HERE IS WHY

T0 first, always. The owner's own screen recording showed Preview saying
**"No media at this time"** while footage was plainly sitting under the
playhead. Until that is fixed, every feature added on top is built on a Preview
the user cannot believe. Adding a Bezier graph editor to an editor that lies
about whether your footage exists is the wrong order.

---

## PER-GATE PROGRESS

### P0 — VERIFY AND INVENTORY

- [x] git verified: HEAD == origin == `45c0c98`, tree clean
- [x] baseline suite re-run (web 897 before change, 908 after)
- [x] `TIMELINE_CAPABILITY_INVENTORY.md` written — 27 built, 8 partial, 31 absent,
      and **0 features in T1 rewrite a saved project**
- [x] `OPEN_EDIT_ADOPTION_REPORT.md` written — six ideas adopted, no code copied,
      **veed-engine-cli refused on licence grounds**, four hard rules recorded
- [x] `OWNER_RECORDING_REPRODUCTION.md` written — **root cause found and fixed**

### T0 — CORRECTNESS, TRUST AND EXPORT COMPATIBILITY — **DONE**

Committed as `[verified] fix(timeline): restore preview truth and mixed-format export`

Two things the user could see were broken, and both are fixed and proven in the
running app on the owner's real project:

1. **The preview called real footage empty.** Deleting an overlay you had moved
   left an adjustment naming nothing, the compiler refused the WHOLE project,
   and the preview read that refusal as "the timeline is empty everywhere".
2. **A phone clip made Export fail outright.** Footage went into the exporter at
   whatever size it was recorded at, and the step that joins the pieces refuses
   unless they are already all the same size. Any two clips of different sizes
   failed, not only portrait ones.

- [x] T0.1 reproduce the false gap — reproduced by test, root cause named
- [x] T0.2 one pure `PrimarySourceDecisionV1` resolver — `primary-source.ts`
- [x] T0.1b dev-only diagnostics — `timeline-monitor-diagnostics.ts`, 12 tests
- [x] T0.3 source reconciliation — `preview-reconciliation.ts`; found the SAME
      "read it from the compiled plan" bug in a second place and fixed it
- [x] T0.4 primary-preview invariant — `preview-invariant.test.ts`, 24 tests,
      the A–T matrix driven through real domain operations
- [x] T0.5 stale-draft recovery — `draft-reconciliation.ts`, 14 tests.
      "Reopen it and try again" is gone.
- [x] T0.6 explicit `SaveState` — `save-state.ts`, 25 tests.
      "Local save needs attention" is gone.
- [x] T0.7 mixed-aspect / mixed-format export — **FAIL-051 CLOSED**.
      `visual-normalization.ts` is the one geometry authority both the preview
      and FFmpeg read. 26 + 11 tests.
- [x] T0.8 engineering UI removed — no "P1-A", no operation names, no reason
      codes, no COMMITTED on every clip
- [x] T0.9 bounded polish, no layout change
- [x] full suites + build — 1,848 passing, build exit 0
- [x] real browser workflow — `T0_BROWSER_WORKFLOW.md`, including what was NOT
      driven by hand
- [x] real mixed-aspect MP4 probed — 1920×1080, SAR 1:1, 27.278 s, portrait
      footage letterboxed, frames sampled and measured
- [x] committed, pushed, SHA verified

Evidence: `T0_MIXED_FORMAT_EXPORT.md`, `T0_SOURCE_RECONCILIATION.md`,
`T0_STALE_DRAFT_RECOVERY.md`, `T0_SAVE_RECOVERY.md`,
`T0_ENGINEERING_UI_REMOVAL.md`, `T0_BROWSER_WORKFLOW.md`,
`OWNER_RECORDING_REPRODUCTION.md`, `screenshots/`.

**Known and deliberately left open** (each stated in its own evidence file):
- a save `conflict` is reported truthfully but there is no chooser yet
- only the nameplate family can be a pending proposal, so draft recovery is
  complete for what exists and will need extending
- `outputStateAt` in `segment-playback.ts` is still defined but unused
- the four screen sizes were not measured this session
- two pre-existing View-Transition console warnings, unrelated, not fixed

### T1 — CREATOR INTERACTION PARITY — **DONE**

Committed as `[verified] feat(timeline): add creator selection clipboard grouping and markers`

- [x] T1.1 icon toolbar — 9 symbols, every one named in words and to a screen
      reader; Speed shown disabled and says why; **Transition wired up for real**
- [x] T1.2 selection V2 — `timeline-selection-v2.ts`, 26 tests. Found and fixed a
      real defect: B-roll pinned to a clip was dragging the main clip in with it
- [x] T1.3 marquee — `timeline-marquee.ts`, 18 tests, edge auto-scroll, Escape
- [x] T1.4 multi-move   - [x] T1.5 multi-trim — `timeline-multi-plan.ts`, 17
      tests. ONE planner for the ghost and the edit
- [x] T1.6 groups — new domain operation `set-timeline-groups`, 19 tests
- [x] T1.7 link/unlink — links restricted to the picture and its own sound
- [x] T1.8 clipboard — `timeline-clipboard.ts`, 16 tests, closed field list
- [x] T1.9 markers — new domain operation `set-timeline-markers`, 22 + 17 tests
- [x] T1.10 track height and folding — browser setting, no revision
- [x] T1.11 context menus — only real actions, no inert entries, focus restored
- [x] T1.12 magnetic feedback — the preview IS the plan
- [x] T1.13 gap objects — `timeline-gaps.ts`, 12 tests
- [x] T1.14 keyboard presets — 4 presets, clash detection, 25 tests
- [x] **the export key now describes the RENDER PLAN, not the revision** —
      `apps/api/src/render/export-identity.ts`, 9 tests
- [x] full suites + build — 2,050 passing, build exit 0
- [x] real browser workflow — `T1_CREATOR_INTERACTION.md`, 20 steps, including
      the same-export proof and the four screen sizes T0 owed
- [x] committed, pushed, SHA verified

Evidence: `T1_CREATOR_INTERACTION.md`, `TIMELINE_CAPABILITY_INVENTORY.md`,
`OPEN_EDIT_ADOPTION_REPORT.md`.

**Known and deliberately left open** (each stated in the evidence file):
- clicks and drags were dispatched as events, not by a physical mouse
- the keyboard presets were not switched in the running app (25 tests cover them)
- multi-item MOVE was not committed on the owner's project — their V1 clips are
  correctly refused, and they have no two B-roll clips to drag together
- a group was not proved to survive a reload; markers were, the same way
- marker drag-to-move was not driven by hand

### T2 — SPEED, AUDIO, TRANSITIONS

Commit: `[verified] feat(timeline): add speed audio transitions and creator time tools`

- [ ] T2.1 constant speed (rational rate) - [ ] T2.2 rate stretch - [ ] T2.3 reverse
- [ ] T2.4 freeze frame - [ ] T2.5 audio clip controls - [ ] T2.6 J/L cuts
- [ ] T2.7 transition contract - [ ] T2.8 transition UI - [ ] T2.9 placement extensions

### T3 — PRECISION TRIM

Commit: `[verified] feat(timeline): add precision trim slip slide roll and rate stretch`

- [ ] T3.1 context trim cursor - [ ] T3.2 ripple - [ ] T3.3 roll - [ ] T3.4 slip
- [ ] T3.5 slide - [ ] T3.6 trim to playhead - [ ] T3.7 dynamic trim J/K/L
- [ ] T3.8 multi-edit-point trim - [ ] T3.9 numeric precision

### T4 — KEYFRAME LANES AND GRAPH EDITING

Commit: `[verified] feat(timeline): add keyframe lanes and graph editing`

- [ ] T4.1 closed property ids - [ ] T4.2 expandable lanes - [ ] T4.3 interactions
- [ ] T4.4 interpolation - [ ] T4.5 graph editor - [ ] T4.6 keyframe clipboard
- [ ] T4.7 badges

### T5 — ADVANCED TRACK CONTROLS

Commit: `[verified] feat(timeline): add advanced track controls and expandable tracks`

- [ ] T5.1 track model V2 - [ ] T5.2 track operations - [ ] T5.3 output controls
- [ ] T5.4 sync lock - [ ] T5.5 targeting - [ ] T5.6 track select
- [ ] T5.7 track effects/keyframes - [ ] T5.8 audio channel display

### T6 — SEQUENCES AND SOURCE EDITING

Commit: `[verified] feat(timeline): add sequence and source-editing workflows`

- [ ] T6.1 multiple sequences - [ ] T6.2 nested - [ ] T6.3 compound clips
- [ ] T6.4 source monitor mode - [ ] T6.5 three-point editing - [ ] T6.6 zones
- [ ] T6.7 proxies - [ ] T6.8 preview render cache - [ ] T6.9 multicam (or deferred with proof)

### T7 — TRANSCRIPT AND AI-READY CONTRACTS

Commit: `[verified] feat(timeline): complete AI-ready transcript timeline contracts`

- [ ] T7.1 transcript model - [ ] T7.2 word/timeline mapping - [ ] T7.3 text operations
- [ ] T7.4 selection sync - [ ] T7.5 proposal visualization - [ ] T7.6 acceptance granularity

---

## PROGRAM-WIDE RULES THAT WILL BE BROKEN IF NOT RE-READ

1. **The Studio layout does not move.** Not the panel topology, not the
   AI/Media/Preview/Inspector arrangement, not the semantic track order. Only
   the inside of the Timeline changes.
2. **One gesture = one change set = one Undo.** Pointer movement is presentation
   only: no operation, no API call, no history entry. Pointer release is one
   atomic operation or one truthful refusal.
3. **Manual and AI call the same operations.** No editing policy may live only
   inside a React event handler.
4. **Integer ticks only.** `PROJECT_TIMESCALE = 1_440_000`. No canonical floats.
   Speed is a rational `{numerator, denominator}`, never a float.
5. **Preview/export parity.** Every render-affecting feature must work in
   browser Preview, the render plan, FFmpeg export, Undo/Redo, proposal
   evaluation and accepted history — or it is not done.
6. **Do not start another panel.** No Inspector, Effects, Color, Audio
   workspace expansion, no AI execution, no P1-F.2, until T7 is done.

---

## CARRIED-OVER TRAPS (from Gate D, still true)

- `project.composition` is the footage AS IMPORTED and never changes. The
  visible result is `effectiveComposition(project)`.
- The primary recording's storage ref is `project:<id>/source` with a **COLON**.
- A **failed export is cached by its idempotency key** — press Export again and
  the old failure returns instantly, so a real fix looks broken. Move the
  revision with any harmless toggle first.
- `add-music` uses `fadeIn`/`fadeOut`; `split-clip` uses `atClipTime`/`newClipId`.
- Undo is itself a revision.
- The Timeline only renders in the **Studio** workspace.
- `npm run build` type-checks test files; `vitest` alone does not.
- PowerShell here-strings break on inner double quotes — use `git commit -F`.
- Heavy vitest suites on Windows need
  `--pool=forks --poolOptions.forks.singleFork=true`.
- The API loads TypeScript at boot: server changes need `preview_stop` then
  `preview_start` (config name `sanverse`). **This cost real time in T0**: the
  first export after fixing the exporter failed, because the running server was
  still using the old code. It is the most misleading signal there is — a
  correct fix that appears not to work.
- Simulated HTML5 drag events do NOT reach the app's drop handler in this
  browser harness. Drive placement through the operation the drop produces and
  say plainly that you did. **Synthetic POINTER events DO work** — the marquee
  was driven that way in T1 — but `setPointerCapture` throws for them, so any
  new pointer capture needs a `try`.
- **The export key changed in T1.** It is now the compiled render plan, not the
  revision. So the old trick of bumping the revision with a harmless toggle NO
  LONGER busts a cached failure: the plan is unchanged, so the key is unchanged.
  To force a genuinely fresh export, change something that reaches the video.
- The Browser pane here does not composite, so `computer{action:"screenshot"}`
  times out. Build owner-reviewable pictures from real API answers instead.
- The web suite's global RTL cleanup and the recording canvas stub live in
  `apps/web/src/test/setup.ts`. State that must survive `vi.resetModules()`
  has to live on the DOM element, not a module-level map.
