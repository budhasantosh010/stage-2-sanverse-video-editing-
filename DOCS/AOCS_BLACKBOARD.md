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

- None inside the bounded first pointed-nameplate implementation. Owner validation remains a gate, not missing implementation.

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
- Accepted mitigation: document the assumption, preserve existing action meaning, clamp export placement inside the frame, and require owner validation or an explicit versioned anchor field before schema freeze or Task 8.
- Completed leverage slice: Task 6 now provides immutable local project intake and a controlled media source; this does not persist edit history or render an output.
- Runtime correction: a bounded real-video-derived HTTP check caught a Node strip-only syntax incompatibility missed by the earlier test/build boundary; the exact configured entry graph and MP4/hash/range path now pass.
- Completed leverage slice: Task 7 translates validated accepted history through the replaceable FFmpeg renderer adapter and proves bounded real-video-derived reproducibility with audio.
- Red-team corrections: user text/font paths are externalized into a private render directory; subprocess cancellation waits for close; hashing and the atomic commit point remain cancellable; lexical output aliases are canonicalized; private partial files reject symlink/hard-link substitution; publication cannot overwrite an existing export.
- Completed leverage slice: Task 8 connects browser history and controlled project media to render progress, recoverable failure, and a downloadable result without pretending chat or AI exists.
- Remaining human gate: the owner must run the representative upload, point, accept, export, download, and playback loop; automated composition does not establish usability or pixel fidelity.

## Owner-authorized early vertical-slice sequencing

- Owner requirement: continue building the real edit workflow while motion polish and owner re-test remain open.
- Verified plan boundary: Tasks 2–8 form one approved manual vertical slice and include capabilities mapped to G2/G3.
- Status rule: implementing those capabilities early does not close G1 and does not mark G2/G3 complete.
- Prohibited inference: this authorization does not permit AI integration, broad editing primitives, accounts, billing, cloud operations, or any unsupported accuracy claim.

## AOCS Omega routing — 2026-07-12 runnable web shell

- Classification: Type 2, medium risk, fractal depth 1.
- Reality-tested fact, confidence 100: no runnable web application or server exists yet.
- Owner requirement, confidence 100: Stage 2 is a web application and its user-facing local development server uses strict port 2000.
- Owner priority, confidence 100: show and test the runnable interface before continuing HyperFrames.
- High-confidence inference, confidence 94: the current bottleneck is interaction validation, not renderer expressiveness.
- Red-team risk: a visual prototype could become throwaway code or falsely imply editing works.
- Accepted mitigation: build a thin production-structured shell with typed state and tests, real local video preview, and explicit unavailable states; add no backend or fake editing.
- Falsification condition: if the runnable shell cannot expose meaningful workflow corrections without a renderer, resume the renderer spike immediately and keep the shell limited to its validated pieces.
