# AOCS Blackboard

This is a compact separation of facts, owner requirements, inferences, proposals, and unknowns.

## Verified facts

- Stage 1 exists in a separate folder and is read-only for this project.
- This Stage 2 workspace began without product implementation.
- The owner can supply a cleaned talking-head MP4.
- The owner is the first real user and wants to finish edits in minutes.
- The supplied anti-drift template contains both lightweight documentation hooks and heavier optional automation.

## Owner-approved requirements

- Point/draw/chat editing for non-editors.
- Production-grade code architecture from the beginning.
- Minimal black-and-white branding.
- Medium-to-large goal tracking and durable session continuity.
- Neutral, truthful reporting with no unsupported certainty.

## High-confidence inferences

- A canonical typed edit model is necessary for undo, validation, history, multiple interfaces, and renderer replacement.
- A manual deterministic first slice is necessary before AI orchestration can be evaluated honestly.
- User-observed completion time and acceptance rate matter more than feature count.

## Approved proposals not yet implemented

- Immutable local project intake behind a replaceable repository port.
- Product FFmpeg adapter behind the renderer port.
- Completion of the first real exported nameplate vertical slice.

## Unknowns that must be measured

- Exact preview/export fidelity requirements.
- Real per-edit completion-time target.
- Stage 1 optional artifact quality.
- Free provider capability and limits.
- Which advanced primitives real workflows need first.
- Owner-approved click-to-nameplate anchor semantics and near-edge behavior.

## AOCS Omega routing — 2026-07-13 typed preview and history loop

- Classification: Type 2, medium risk, fractal depth 1.
- Verified fact: typed pending and accepted nameplate actions now render in the browser only during their half-open time window.
- Verified fact: acceptance, undo, and redo use the canonical immutable history domain; discard does not mutate accepted history.
- Verified boundary: state is in memory only and is discarded on Back, reload, or project replacement.
- Provisional compatibility assumption: point `x` and `y` currently place the overlay's top-left corner because the selected renderer spike uses that meaning.
- Red-team risk: silently treating top-left placement as owner-approved would freeze a possibly awkward interaction and allow clipping near the right/bottom edge.
- Accepted mitigation: document the assumption, preserve existing action meaning, and require owner validation or an explicit versioned anchor field before schema freeze or Task 7.
- Next highest-leverage slice: Task 6 immutable local project intake, because real rendering cannot safely consume an arbitrary browser-local path or mutable source file.

## AOCS Omega routing — 2026-07-12 runnable web shell

- Classification: Type 2, medium risk, fractal depth 1.
- Reality-tested fact, confidence 100: no runnable web application or server exists yet.
- Owner requirement, confidence 100: Stage 2 is a web application and its user-facing local development server uses strict port 2000.
- Owner priority, confidence 100: show and test the runnable interface before continuing HyperFrames.
- High-confidence inference, confidence 94: the current bottleneck is interaction validation, not renderer expressiveness.
- Red-team risk: a visual prototype could become throwaway code or falsely imply editing works.
- Accepted mitigation: build a thin production-structured shell with typed state and tests, real local video preview, and explicit unavailable states; add no backend or fake editing.
- Falsification condition: if the runnable shell cannot expose meaningful workflow corrections without a renderer, resume the renderer spike immediately and keep the shell limited to its validated pieces.
