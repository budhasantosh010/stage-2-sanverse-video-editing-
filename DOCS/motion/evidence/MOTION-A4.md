# MOTION-A4 — Timer / Status Pill V1

Status: COMPLETE — mechanical, exact-seek, graph-backed and real-browser evidence inspected.
Date: 2026-08-08

## Acceptance contract

Timer / Status Pill must derive its displayed time from exact local Sanverse ticks, remain random-access deterministic under direct/backward seeks, adapt to 16:9 / 9:16 / 1:1 / 4:5, preserve semantic information under reduced motion, and refuse impossible/invalid content instead of clipping it.

## Implemented component

- ID: `sanverse.timer-status-pill`
- Modes: countdown / countup
- Semantic range: 1–359,999 seconds
- Optional forced hours display
- Deterministic progress ring
- Exact-tick live status pulse
- Responsive wide/compact pill layouts
- Graph-backed semantic nodes for surface, progress track/ring/center, label, status, dot, clock and caption
- Motion Graph owns panel reveal/exit, progress trim, live-dot pulse and the visible clock string.

The legacy exact-state evaluator remains only as an independent regression oracle; the rendered animation reads the resolved Motion Graph.

## Mechanical evidence

Focused Timer suite: 17/17 passed.

Cross-component Motion Library suite after graph migration: 75/75 passed. The readiness tests compare resolved graph values against the legacy exact-state evaluator and exercise repeated/backward/random seeks.

Motion Graph suite: 30/30 passed.

Motion Lab suite after schema-driven inspector integration: 8/8 passed.

Motion Lab and motion packages build cleanly.

## Browser evidence — inspected in real Microsoft Edge

Files under `motion/visual-baselines/`:

- `a4-timer-16x9.png` — wide 1920×1080 composition; final countdown and full ring fit cleanly.
- `a4-timer-9x16.png` — portrait compact layout; ring and text stack remain centered and readable.
- `a4-timer-1x1.png` — square reference ratio.
- `a4-timer-4x5.png` — portrait-social reference ratio.
- `a4-timer-max-9x16.png` — 359,999-second semantic maximum with forced hours; `0:00:00` final display fits portrait without overflow.
- `a4-timer-reduced-early.png` — exact tick 1,080,000 at 15%; semantic countdown reads `1:26` while reduced motion removes directional/spring motion.
- `a4-timer-energetic-busy.png` — Creator Energetic style remains readable over the deliberately hostile busy test background.
- `a4-timer-refusal.png` — over-limit label refuses visibly and reports the typed validation issue instead of silently clipping.

The existing pre-migration phase baselines were also compared after graph migration. Entrance, settled, hold and exit produced zero-pixel matches, proving the new graph authority did not redesign the approved Timer defaults.

## Determinism

Component animation authority remains:

`typed content + typed style + composition dimensions + exact integer local ticks + explicit reducedMotion`

No Timer animation authority uses wall-clock time, timers, random values, CSS keyframes, autonomous Web Animations or frame-to-frame simulation state.

## Result

MOTION-A4 passes its vertical proof gate. Timer / Status Pill is responsive, editable, exact-seek deterministic, reduced-motion aware, graph-backed, validated, fixture-covered and browser-inspected.
