# Sanverse Creative Engine — Master Plan

Date: 2026-08-10
Status: **ABC-2 ACTIVE** — B1 source-understanding + C5 curve editor + A21 creator/WOW capability verified; source-to-curve proof remains

## Mission

The Sanverse Creative Engine is one program with three cooperating lanes:

```text
SANVERSE CREATIVE ENGINE
│
├── PLAN A — Creative Capability
│   What visual/motion building blocks exist?
│
├── PLAN B — Creative Intelligence
│   What should this region communicate and how should it feel?
│
└── PLAN C — Creative Control
    How can a human inspect and change the resulting composition precisely?
```

`DOCS/motion/**` remains authoritative for Motion Graph, components, keyframes, Layers, style packs, runtime and Motion Lab implementation details. This document does not rename or reorganize those files.

## Permanent execution rule

A normal future implementation cycle contains:

```text
A milestone
+
B milestone
+
C milestone
+
cross-plan proof
```

An isolated lane-only cycle is allowed only when a specific stabilization problem makes cross-lane work unsafe or misleading. The reason must be recorded.

## Architecture boundary

Plan B sits above the edit implementation. AI or human creative intent becomes typed Creative Direction, then a typed Creative Edit Proposal. It does **not** write CSS, DOM, arbitrary implementation JSON, or Motion Graph internals directly.

```text
Human / future AI intent
        │
        ▼
Creative Direction Document
        │
        ▼
Creative Planner boundary
        │
        ▼
Creative Edit Proposal
        │
        ├── component placement intents
        ├── style assignments
        ├── motion assignments
        ├── footage treatments
        └── constraints
                 │
                 ▼
          future compiler seam
             ┌───┴───┐
             ▼       ▼
          Plan A   Plan C
```

Plan A supplies components and reusable motion primitives. Plan C operates on the same Motion Graph, C3 Layer projection and C2 keyframe tracks. No second graph, Layer document or keyframe store is introduced.

## ABC-1 scope

### B0 — Creative Direction Foundation

- one `@sanverse/creative-direction` package;
- canonical project ticks (`1,440,000` ticks/second);
- STYLE, GRAPHICS, MOTION, FOOTAGE, TRANSITION, EMPHASIS, NOTES and CONSTRAINTS tracks;
- typed directives with source/priority/status;
- comments and creative-plan versions;
- typed serializable Creative Edit Proposal;
- vendor-neutral model adapter boundary;
- deterministic offline fixture planner;
- strict validation and detectable required-directive conflicts;
- development-only Creative Direction mode in Motion Lab;
- no video understanding, segmentation, tracking, provider API or production editor integration.

### C4 — Professional Animation Timeline / Dope Sheet

C4 answers **when does this Motion Graph property change?** It projects C2 tracks and synchronizes with C3 Layers and the one Motion Lab playhead. C4 is not the production video timeline and may not create a second keyframe store.

### A20 — Product Storytelling + YouTube Motion Pack

Audit the current 77 components first. Add only missing reusable abstractions from the product-story reference: new component, variant, primitive, effect, scene pattern or style only when the smaller existing abstraction cannot solve the job cleanly. Do not commit source-brand assets or copied layouts.

### ABC cross-plan proof

The cycle closes only when typed Creative Direction can resolve to a Plan-A component, produce a Motion Scene, project to C3 Layers/C2 tracks, appear in C4, and be manually retimed through typed C2 operations.

## Stop boundary

ABC-1 does **not** authorize:

- B1 video-understanding inputs;
- C5 graphical curve editor;
- A21 next reference/WOW pack;
- production `apps/web` integration;
- vendor-specific AI APIs;
- copied commercial reference assets.

Those remain future milestones after ABC-1 is independently verified and preserved.
