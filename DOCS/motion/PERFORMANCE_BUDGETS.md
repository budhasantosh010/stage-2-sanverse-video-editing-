# Motion Performance Budgets

Performance classes:

- light — text, cards, icons, small SVG
- medium — lists, diagrams, several elements, masks and shadows
- heavy — procedural Canvas, particles, dense diagrams, distortion/depth

Plan A components must not allocate unbounded work from elapsed time, start autonomous animation loops, perform network work during render, or retain growing state across repeated exact-tick renders. Numerical frame-time budgets are recorded only after measurement; none are invented in A0.

## Plan A measured review — 2026-08-08

Local warm-cache engineering measurement across the completed public catalog of 48 modules and all four reference ratios:

- Motion Graph scene creation + exact-tick evaluation: 3,840 operations in 397.751 ms; 0.1036 ms average per operation.
- Server-side markup generation: 960 operations in 929.843 ms; 0.9686 ms average per render.
- Mean generated markup size: 2,116 bytes.

Method: one warm-up pass, then 20 graph loops and 5 markup loops over 48 modules × 4 ratios using each module's default duration and 56% exact-tick sample. These are measurements from the current local development machine, not universal browser-frame guarantees.

Review conclusions:

- title/value/status/quote/CTA families remain `light`;
- list and diagram family modules are marked `medium` because they may render multiple repeated elements;
- no Plan A component performs network work during render;
- no Plan A component owns an autonomous animation loop;
- no Plan A component retains growing render history;
- exact-tick graph evaluation remains bounded by component node count rather than elapsed playback time.
