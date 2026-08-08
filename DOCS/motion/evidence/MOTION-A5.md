# MOTION-A5 — Team / Network Diagram V1

Status: COMPLETE — fifth vertical proof passes deterministic layout, graph readiness, responsive, reduced-motion, refusal and browser gates.
Date: 2026-08-08

## Component

- ID: `sanverse.team-network-diagram`
- 3–8 stable typed nodes
- 2–16 directed connections
- explicit stable center node ID
- analytic landscape / portrait / square geometry
- exact-tick staggered node reveal
- exact-tick path trim for connections
- reduced motion reveals complete semantics without movement/history
- Motion Graph native from first implementation

## No simulation history

Layout depends only on typed props and composition dimensions:

- landscape/square: deterministic ellipse around the center node
- portrait: deterministic alternating columns with analytic row positions

There is no force solver, random seed, persistent physics state or previous-frame dependency. Changing the requested tick cannot alter node coordinates.

## Mechanical evidence

- Team / Network Diagram focused tests: 15/15 passed.
- Full Motion Library after adding A5: 90/90 passed.
- Motion Library build passed.
- Motion Lab build passed.
- Motion Lab tests: 8/8 passed.
- Scene validates as compositor-ready and serializes through `sanverse.motion-scene/v1`.
- Repeated/backward/random seek tests revisit identical state.
- Reduced-motion tests preserve identical analytic geometry.

Two A5 issues were found by the gate and fixed without weakening it:

1. the CSS font-stack validator was accidentally using the short color-token length limit;
2. semantic readiness correctly rejected the first scene because node-group semantic coverage omitted surface/label/role leaf nodes.

Both contracts were corrected before acceptance.

## Real Microsoft Edge evidence

Inspected under `motion/visual-baselines/`:

- `a5-team-network-16x9.png` — landscape radial network around Global knowledge.
- `a5-team-network-9x16.png` — portrait analytic alternating layout.
- `a5-team-network-1x1.png` — square reference ratio.
- `a5-team-network-4x5.png` — social portrait ratio.
- `a5-team-network-reduced.png` — complete semantic network shown at an early exact tick under reduced motion.
- `a5-team-network-energetic-busy.png` — Creator Energetic style remains readable over the hostile busy background.
- `a5-team-network-refusal.png` — 29-character node label refuses visibly against the 28-character contract.

The component is selectable in Motion Lab and uses the same exposure-driven Creator / Designer / Advanced inspector. Creator edits node/connection text rows; Advanced sees the actual graph node/path hierarchy.

## Five-proof gate

The first five vertically proven components are now:

1. Kinetic Headline
2. Checklist Card
3. Cost / Value Card
4. Timer / Status Pill
5. Team / Network Diagram

All five are responsive, exact-seek deterministic, reduced-motion aware, typed-refusal capable, graph-backed, fixture/test covered and real-browser inspected.

## Result

MOTION-A5 passes and the Plan A vertical-proof stage is complete. The library can now expand horizontally through shared deterministic family engines without changing the core architecture.
