# Gate T4 — Keyframe Lanes and Graph Editing — Final Closure

Date: 2026-08-10
Branch: `timeline-t4-keyframe-graph`
Base: verified T3 commit `aed76ac0232e8a920812b800d234a96e32de7396`

Gate T4 is **complete**. Gate T5 was not started.

## Product delivered

T4 adds one Editor-owned keyframe editing layer over the animation data that already rendered before this gate:

- closed animation target/property capability resolution;
- primary-footage source-relative keyframe time and visual-overlay visual-relative keyframe time;
- full-state keyframe planners with two-keyframe minimum, exact collision rules and explicit Remove Animation;
- expandable Timeline property lanes, animation badges and one shared keyframe selection;
- pointer, keyboard, numeric, marquee and clipboard keyframe editing;
- Linear, Ease In, Ease Out, Ease In-Out, Custom Bezier, Spring and Bounce interpolation;
- Editor-local Timeline Property Graph with bounded sampling, X/Y zoom, pan, Fit All/Fit Selection, point drag, marquee and Bezier handles;
- selected-keyframe Inspector synchronization and explicit primary Canvas keyframe mode;
- detached Preview drafts and exactly one accepted operation on gesture release;
- T2/T3 speed/reverse/trim/split/repeated-placement interaction mapping;
- bounded 60-minute behavior and export-identity coverage;
- shared evaluated-state safety for easing overshoot without rewriting canonical authored keyframes.

Hold is deliberately not exposed because the current Editor easing/render contract does not provide a truthful Hold interpolation end-to-end. T4 does not fake unsupported capability.

No project-schema or render-plan bump was required. Existing `set-footage-motion` and `set-visual-properties` operation families remain authoritative.

## Automated verification

Final repository gate: **2,419 / 2,419**.

- API 404 / 404
- Web 1,334 / 1,334
- edit-domain 536 / 536
- intent-domain 27 / 27
- render-contract 118 / 118

All-workspace production build: **PASS**.

A schema-valid 60-minute stress fixture covers 250 placements and 50 animated targets. Timeline diamonds remain visible-window/overscan bounded, graph sampling is capped at 640 samples, and pure animation projection does not require server media analysis or frame-by-frame DOM construction.

## Real Microsoft Edge proof

On real `primary-30s.mp4` media in Microsoft Edge 151:

- first safe track creation: revision 0→1;
- midpoint creation: 1→2;
- Graph point movement stayed detached at revision 2 and committed once on release: 2→3;
- Custom Bezier preset: 3→4;
- Bezier handle movement stayed detached at revision 4 and committed once on release: 4→5;
- Graph zoom `1→2.5` produced zero revisions;
- `Edit→Effects→Edit` kept one video, revision 5, selected value, open Graph and zoom;
- Undo produced revision 6 and restored the prior Bezier state;
- Redo produced revision 7 and restored the dragged Bezier state;
- reload/reopen preserved revision 7 and one-video continuity;
- responsive 1440×900, 1024×768 and 390×844 checks produced no horizontal page overflow;
- final observation recorded zero runtime exceptions, zero console errors and zero HTTP 4xx/5xx responses.

## Real export

Revision 7 exported successfully in one attempt:

- 1920×1080 H.264 High / yuv420p;
- 30 fps, 901 frames;
- AAC-LC stereo at 48 kHz;
- 30.033333 s;
- 10,977,559 bytes;
- SHA-256 `6d4c704fad146f312c63b047a7b53f53f14207ecf7aece7662bfa430123b9f7d`.

Decoded 5s/15s/25s frames visibly prove the accepted Position X animation moves out and returns. Probe and frame evidence live beside this file.

## Ownership boundary

The permanent Editor/Motion/Plan-B ownership contract remained in force throughout T4. The checker was run against exact base `aed76ac0232e8a920812b800d234a96e32de7396`. No protected Motion file changed, no Motion package was imported into production web code, no Plan-B implementation changed, and the Motion worktree was never entered.

## Known non-blocking observations

- The first broad T4 regression sweep found two mistakes in the newly written long-form test harness, not product failures; corrected tests then passed in the complete 2,419/2,419 stable single-fork sweep.
- Forced browser reload canceled four in-flight requests with `net::ERR_ABORTED`; no HTTP 4xx/5xx response occurred and the reopened project was healthy.
- Existing runtime nameplate-font and Vite >500 kB build advisories remain non-blocking.
- The Graph SVG is real and was interacted with in Edge; nested Timeline scrolling made a clean all-in-one Graph screenshot impractical, so exact pointer/revision evidence is the primary browser proof.

No unresolved T4 P0/P1 blocker remains.

**STOP:** T5 Advanced Track Controls was not started.
