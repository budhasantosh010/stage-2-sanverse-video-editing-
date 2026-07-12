# Change Record: HyperFrames candidate safe preparation

- Date: 2026-07-12
- Goal: G1
- Requirements: REQ-003, REQ-005, REQ-008, REQ-009
- Decisions: DEC-002, DEC-006
- Acceptance criterion: The renderer-neutral static-nameplate fixture can be translated into a deterministic, offline HyperFrames composition without executing third-party package code.
- Status: Complete for safe preparation; HyperFrames runtime measurement remains open.

## Verified facts

- hyperframes@0.7.54 package contents and documented composition attributes were inspected statically.
- The generated composition maps canvas dimensions, source duration, overlay timing, track order, normalized bounds, and visible text from the renderer-neutral request.
- User-visible text is HTML-escaped.
- Media input is restricted to one local filename.
- The composition contains no remote URL, wall-clock timer, or autoplay behavior.
- Repeated composition writes are byte-identical.
- A system-Chrome screenshot confirms the intended static layout.

## Evidence

- Initial RED: 9 tests failed because the adapter module did not exist.
- GREEN: 9 focused tests passed.
- Broader suite: 34 tests passed.
- Ruff, Python compilation, governance, and diff checks passed.

## Explicit limitation

HyperFrames itself has not been installed or executed. The Chrome screenshot is not evidence for HyperFrames timing, audio, encoding, render speed, or determinism. Executing the pinned npm package requires an explicit owner risk decision because third-party dependencies can run local code.

## Rollback

Revert this coherent change. Generated media and screenshots remain under ignored spikes/renderer/work/.