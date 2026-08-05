# P1-F.1E — Complete Timeline Experience — LIVE PROGRAM STATE

**This file is the resume point. Read this first, before any other file, in every
new session. It is updated at the end of every working block, not only at the end
of a gate.**

Last updated: 2026-08-05
Branch: `agent/g6-g8-local-alpha`
Program start commit: `45c0c981fb869afd236f10cbea829b1859d5beb6`
Latest pushed commit: `b18d2344ccaa9de967c6d094e64b69742d5c5d70`
Test baseline at program start: **1,723**
Tests now: **1,736** — edit-domain 378 · render-contract 82 · intent-domain 27 ·
api 341 · web 908. `npm run build` exit 0.

---

## THE ONE-SCREEN ANSWER TO "WHERE ARE WE?"

```
  GATE   WHAT IT IS                                   STATE        COMMIT
  ────   ──────────────────────────────────────────   ──────────   ──────────
  P0     Verify + capability inventory                IN PROGRESS  —
  T0     Correctness: preview truth, mixed export     IN PROGRESS  —
         └─ false gap SOLVED (T0.1, T0.2)             done         b18d234
         └─ remaining: T0.1b diagnostics, T0.3..T0.9  open
  T1     Creator interaction: selection/clipboard     NOT STARTED  —
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
- [ ] `TIMELINE_CAPABILITY_INVENTORY.md` written
- [x] `OWNER_RECORDING_REPRODUCTION.md` written — **root cause found and fixed**

### T0 — CORRECTNESS, TRUST AND EXPORT COMPATIBILITY

Commit message when done:
`[verified] fix(timeline): restore preview truth and mixed-format export`

**THE FALSE GAP IS SOLVED.** Root cause, in one line: deleting a V2 overlay you
had moved or scaled left an adjustment naming nothing, which made the compiler
refuse the WHOLE project, which the preview read as "the timeline is empty
everywhere". Full story in `OWNER_RECORDING_REPRODUCTION.md`. Two fixes landed:
`primary-source.ts` (existence is read from the user's edit, never from a build
that can fail as a whole) and `compile-project.ts` (a dangling adjustment draws
nothing instead of failing the project).

- [x] T0.1 reproduce the false gap — reproduced by test, root cause named
- [x] T0.2 one pure `PrimarySourceDecisionV1` resolver — `primary-source.ts`
- [ ] T0.1b dev-only diagnostics panel (the 20 listed values)
- [ ] T0.3 source reconciliation after every accepted operation
- [ ] T0.4 primary-preview invariant test
- [ ] T0.5 stale-draft recovery without reopening the project
- [ ] T0.6 explicit `SaveState` with a real recovery path
- [ ] T0.7 mixed-aspect / mixed-format export — **this is FAIL-051**
- [ ] T0.8 remove engineering UI from the production Timeline
- [ ] T0.9 visual polish, no layout change
- [ ] full suites + build
- [ ] real browser workflow
- [ ] real mixed-aspect MP4 probed
- [ ] committed, pushed, SHA verified

### T1 — CREATOR INTERACTION PARITY

Commit: `[verified] feat(timeline): add creator selection clipboard grouping and markers`

- [ ] T1.1 icon toolbar   - [ ] T1.2 selection V2   - [ ] T1.3 marquee
- [ ] T1.4 multi-move     - [ ] T1.5 multi-trim     - [ ] T1.6 groups
- [ ] T1.7 link/unlink    - [ ] T1.8 clipboard      - [ ] T1.9 markers
- [ ] T1.10 track height  - [ ] T1.11 context menus - [ ] T1.12 magnetic feedback
- [ ] T1.13 gap objects   - [ ] T1.14 keyboard presets

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
  `preview_start` (config name `sanverse`).
- The Browser pane here does not composite, so `computer{action:"screenshot"}`
  times out. Build owner-reviewable pictures from real API answers instead.
- The web suite's global RTL cleanup and the recording canvas stub live in
  `apps/web/src/test/setup.ts`. State that must survive `vi.resetModules()`
  has to live on the DOM element, not a module-level map.
