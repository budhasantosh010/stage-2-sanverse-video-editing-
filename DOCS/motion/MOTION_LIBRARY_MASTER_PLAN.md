# Sanverse Plan A — Motion Library Master Plan

Status: IMPLEMENTATION COMPLETE inside the main Sanverse project folder. Final evidence: `DOCS/motion/evidence/MOTION-A16.md`. Commit/push is deferred only until the concurrent unrelated production working tree reaches a safe boundary.
Date: 2026-08-08

## Macro goal

Build a factory for first-party Sanverse motion graphics that are editable, responsive, deterministic, reusable, and fast to extend. Plan A builds the graphics and their internal development workshop independently from production Studio integration.

## Visual equation

```text
PURE CONTENT
+ PURE STYLE
+ COMPOSITION DIMENSIONS
+ EXACT LOCAL INTEGER TICKS
= VISUAL STATE

same inputs + same tick = same output
```

The production project clock already exists in `@sanverse/edit-domain/time`; Motion reuses `PROJECT_TIMESCALE` and does not create a second clock.

## Physical layout

```text
Stage 2 Sanverse Editing Workflow/
├── apps/motion-lab
├── packages/motion-contract
├── packages/motion-primitives
├── packages/motion-native-runtime
├── packages/motion-testing
├── packages/motion-library
├── DOCS/motion
└── motion
    ├── assets
    ├── fixtures
    ├── fonts
    ├── references
    ├── rejected-experiments
    └── visual-baselines
```

`apps/motion-lab` is an internal development workshop only. It does not redesign or integrate with `apps/web` during Plan A.

## Determinism rule

A component's visual state may use only typed content, typed style, composition dimensions, exact local ticks and explicit reduced-motion state. Component animation may not be owned by `Date.now`, `performance.now`, timers, `Math.random`, CSS keyframes, autonomous Web Animations, or frame-to-frame physics state.

Motion Lab may use `requestAnimationFrame` and a wall-clock reading only to decide which exact tick to request next. The component still receives exact ticks and remains random-access deterministic.

## Supported ratios

- 16:9 — 1920×1080
- 9:16 — 1080×1920
- 1:1 — 1080×1080
- 4:5 — 1080×1350

## Foundation packages

- `motion-contract` — stable typed contracts and metadata
- `motion-primitives` — pure deterministic time/math/easing/phase/transform/reveal primitives
- `motion-native-runtime` — React + HTML/SVG composition host helpers
- `motion-testing` — determinism, random-seek, ratio, fixture and overflow test helpers
- `motion-library` — first-party components, style packs, fixtures and catalog
- `motion-lab` — independent browser workshop for browsing, editing and visual QA

## Proof components

Build vertically in this order before mass expansion:

1. Kinetic Headline
2. Checklist Card
3. Cost / Value Card
4. Timer / Status Pill
5. Team / Network Diagram

## V1 target

- 40+ polished full components
- 20+ reusable deterministic primitives/subcomponents
- 8 style packs
- 4 aspect-ratio families
- exact direct/backward/random seek
- reduced-motion behavior
- text fitting/content refusals
- fixtures and selected visual baselines
- mechanical, stress, originality and performance review

## Plan A non-goals

No AI semantic selection/placement, face detection, negative-space placement, tracking, production Timeline/Inspector/Canvas integration, production renderer selection/integration, marketplace, billing, public SDK/publishing, creator payouts, or third-party animation/3D runtimes such as Remotion, Rive, Lottie, GSAP, Framer Motion or Three.js.
