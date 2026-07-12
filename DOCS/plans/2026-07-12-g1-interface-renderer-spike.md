# G1 Plan — Interface Design and Renderer Feasibility Spike

Status: Track A Home/Studio design is under owner review; Track B renderer implementation has not started.

## Goal

Prove the simplest understandable Studio workflow and select a renderer architecture using measured evidence before building the canonical project engine.

## Why G1 comes now

The interface determines what “point here,” “at this time,” “preview,” and “approve” mean. The renderer determines which project and action data must be preserved. Designing both before G2 reduces the risk of freezing the wrong abstractions.

## Scope

### Track A — User workflow and interface

1. Write the primary job story for the first nameplate edit.
2. Map states: Home, prompt/video supplied, importing, Studio ready, moment selected, region selected, request entered, clarification, proposal, previewing, accepted, undo, export, recoverable failure.
3. Produce two low-fidelity black-and-white desktop wireframes: calm Home first, focused Studio second.
4. Define progressive disclosure: what the default user sees versus advanced details.
5. Walk the flow with the owner using plain language and revise it before coding a polished UI.

### Track B — Renderer feasibility

Create the smallest disposable harness that renders the same controlled fixtures through:

1. **FFmpeg-native:** filters/drawtext/overlay where applicable.
2. **HTML/Chromium:** web composition captured or rendered to video.
3. **Hybrid:** HTML or GPU-like composition for designed layers, FFmpeg for decode/encode/assembly.

Representative fixtures:

- Static nameplate at exact time range and rectangle.
- Text with production-like font/layout.
- Position/scale/opacity animation with easing.
- Spring/bounce motion.
- Layer compositing over a talking-head clip.
- Preview frame compared with final export frame.

## Measurements

Record, do not guess:

- visual fidelity and preview/export agreement;
- render time and startup latency on the owner's machine;
- frame/time determinism;
- text and motion expressiveness;
- implementation complexity and debugging visibility;
- Windows development friction;
- deployment and licensing constraints;
- ability to support future primitives without leaking renderer-specific data into the canonical model.

## Provisional technology candidates—not decisions

- Frontend shell: React + TypeScript.
- Backend/domain host: Python with FastAPI at the boundary.
- Contracts: JSON Schema/OpenAPI plus typed runtime validation.
- Local persistence later: SQLite through a repository port.

These remain candidates until the spike and G2 design review. No framework may own the domain model.

## Explicit non-goals

- No auth, billing, multi-tenancy, or cloud deployment.
- No full editor interface.
- No AI provider integration.
- No production project schema implementation beyond disposable spike data.
- No polished branding or decorative animation.
- No attempt to implement all primitives.

## Acceptance criteria

G1 closes only when:

1. The owner can explain how to start from Home and complete the first-edit flow in Studio without learning professional editing terminology.
2. Each renderer candidate has been exercised on the same fixtures or has a documented, reproducible reason it cannot be.
3. Results are recorded with commands, machine context, artifacts/checksums, timings, and visible limitations.
4. A renderer decision record explains the winner, rejected alternatives, and revisit trigger.
5. G2's necessary canonical concepts are listed without encoding renderer-specific implementation details.

## Planned implementation sequence after approval

1. Create fixture/media policy and a tiny sanitized test clip.
2. Write the job story and state model.
3. Produce the low-fidelity Home and Studio wireframes.
4. Owner walkthrough and correction gate.
5. Define common renderer-spike input/output contract.
6. Implement one fixture at a time across candidates.
7. Capture performance and fidelity evidence.
8. Decide renderer architecture.
9. Update requirements, decisions, risks, and G2 plan.

## Rollback

All spike implementations are isolated and disposable. No spike-specific project format becomes canonical. If no candidate meets the bar, record the failure and run a narrower second spike rather than forcing a decision.
