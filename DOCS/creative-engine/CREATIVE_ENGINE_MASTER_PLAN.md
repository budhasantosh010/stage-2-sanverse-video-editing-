# Sanverse Creative Engine — Master Plan

Date: 2026-08-11
Status: **L1 COMPLETE LOCALLY** — ABC-2 remains preserved; Creative Library + full 89-component 1× motion review verified; local release only; stop before A22/B2/B3/C6

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

## ABC-2 preservation

ABC-2 subsequently completed B1 Source Understanding, C5 Value Graph, A21 Creator Utility + Advanced Visual Pack and the source→B0→Plan-A→C3→C4→C5 proof without changing the permanent three-lane architecture. Evidence: `DOCS/creative-engine/evidence/ABC-2.md`.

## L1 — Creative Library / Motion Review layer

L1 is an intentionally horizontal usability/review layer over the preserved ABC-2 system rather than a new A/B/C capability milestone. It makes the existing Plan-A catalog inspectable before additional component/intelligence/control work is authorized.

L1 provides:

- one-registry discovery metadata over all 89 public Plan-A components;
- deterministic posters/search/filter/collections;
- a static-poster grid with at most one live Motion preview;
- component detail player + Component Lab/C3-C5 deep links;
- full-catalog/collection showreel;
- durable local motion-review schema and queue;
- real canonical 1× playback audit of every public component;
- differentiated S/A/B quality tiers independent of mechanical tests;
- measured browser/accessibility/performance evidence.

Architecture: `DOCS/motion/CREATIVE_LIBRARY_ARCHITECTURE.md`. Acceptance: `DOCS/creative-engine/evidence/L1-CREATIVE-LIBRARY.md`.

L1 keeps `apps/web` untouched and adds no second Motion authority. Final local review is 89/89 Passed after real 1× playback, with 13 S / 35 A / 41 B tiers.

## Plan-A engineering infrastructure — Approved Component Ingest V1

External visual authoring is now allowed to vary without allowing integration semantics to fragment. One fail-closed intake path classifies owner-approved external packages, preserves immutable hashes/source evidence, productizes them into the existing Motion Graph/customization authorities, proves visual parity and permits public registration only after owner-reviewed integrated parity.

This is Plan-A engineering infrastructure, not A22. It adds no new public component by itself. The first pilot is owner-approved CH1 Frosted Icon Rail; engineering productization/parity evidence is ready, but registration is intentionally blocked until the owner approves the integrated rendering. Remaining CH1 components stay source-approved/inspect-clean but are not bulk-registered before that pilot gate.

Architecture: `DOCS/motion/COMPONENT_INGEST_ARCHITECTURE.md`; evidence: `DOCS/motion/evidence/COMPONENT-INGEST-V1.md`.

## Current stop boundary

Do **not** register/bulk-ingest the remaining CH1 components until the first integrated pilot receives owner parity approval. Do **not** begin A22, B2/B3 or C6 without explicit authorization. Production Studio integration and provider-specific AI remain out of scope.

Per owner instruction on 2026-08-11, L1 release history is preserved locally and remote synchronization/parity is deferred until the owner re-authorizes it next month.
