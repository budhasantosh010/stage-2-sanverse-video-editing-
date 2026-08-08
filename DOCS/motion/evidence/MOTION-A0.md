# MOTION-A0 Evidence — Foundation + Motion Lab + Initial Kinetic Headline

Date: 2026-08-07

## Physical location

All active Plan A source is inside the main project folder:

`C:\Users\Lenovo\Music\Startups\YT Automations\A1 Talking Head Youtube Video\Sanverse YT Channel\Stage 2 Sanverse Editing Workflow`

The temporary Harness worktree was removed after the owner required all work to live in the main project folder.

## Implemented

- `apps/motion-lab`
- `packages/motion-contract`
- `packages/motion-primitives`
- `packages/motion-native-runtime`
- `packages/motion-testing`
- `packages/motion-library`
- `DOCS/motion`
- `motion/*` asset/fixture/font/reference/baseline workshop folders
- canonical Sanverse clock reuse via `@sanverse/edit-domain/time`
- deterministic math/easing/spring/phases/stagger/transforms/reveal/text/frame primitives
- two initial style packs: Sanverse Clean and Creator Energetic
- initial `sanverse.kinetic-headline` component
- exact-tick Motion Lab transport with play/pause/restart/frame-step/seek/loop/speed
- 16:9, 9:16, 1:1 and 4:5 composition presets
- editable headline content, emphasis indices, alignment, lines, colors, style pack, intensity and duration
- reduced motion and debug/safe-area overlays

## Mechanical verification

Final focused suites: **35/35 passed**.

- motion-contract: 3
- motion-primitives: 13
- motion-native-runtime: 2
- motion-testing: 5
- motion-library: 7
- motion-lab: 5

All six new workspaces build with strict TypeScript. Motion Lab production Vite build passes.

Random-access tests revisit the same exact tick after forward/backward calls and assert identical component state and identical server-rendered markup.

## Animation authority scan

No matches in component/primitives/native-runtime source for:

- `Date.now`
- `performance.now`
- `Math.random`
- `setInterval`
- `setTimeout`
- CSS `@keyframes`
- autonomous `.animate()`

Motion Lab intentionally uses `performance.now()` + `requestAnimationFrame()` only to choose the next exact tick requested from the component.

`apps/web/src` contains no imports from the unfinished motion packages.

## Real browser evidence

Motion Lab ran at `http://127.0.0.1:2010/` with strict port behavior and was captured through installed Microsoft Edge headless mode.

Inspected baselines:

- `motion/visual-baselines/a0-kinetic-headline-settled-16x9.png`
- `motion/visual-baselines/a0-kinetic-headline-settled-9x16.png`
- `motion/visual-baselines/a0-kinetic-headline-settled-1x1.png`
- `motion/visual-baselines/a0-kinetic-headline-settled-4x5.png`
- `motion/visual-baselines/a0-kinetic-headline-energetic-busy.png`
- `motion/visual-baselines/a0-kinetic-headline-reduced-motion-early.png`

Observed:

- landscape uses a wide one-line headline
- portrait/square/4:5 reflow to a readable two-line arrangement instead of merely shrinking the landscape frame
- Creator Energetic changes accent/motion style through the same component implementation
- the soft panel preserves readability on a deliberately busy background
- reduced-motion early state is visible without translation/spring movement
- status bar exposes exact tick, frame, normalized progress, phase, composition size, preview scale and the canonical 1,440,000 tick/second clock

Edge emitted local headless-browser diagnostic stderr about its VBS encoder/task manager; screenshot writes succeeded and the rendered pages were inspected.

## Shared-repository safety

The root `package-lock.json` diff contains only new workspace/link metadata for Plan A. It does not upgrade unrelated editor dependencies.

Existing editor-agent dirty source files were not edited by Plan A.

## Gate

MOTION-A0: **complete for technical + inspected visual evidence.**

MOTION-A1 starts next: deterministic text fitting, explicit responsive line breaking, content-bound refusals and stronger long/Unicode stress coverage for Kinetic Headline.
