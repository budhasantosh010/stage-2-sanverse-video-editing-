# Change Record: Rendered-video Point mode

- Date: 2026-07-13
- Goal: G2 — Canonical project foundation
- Requirements: REQ-001, REQ-002, REQ-003
- Decisions: DEC-003, DEC-004, DEC-005
- Acceptance criterion: In Studio, the user can explicitly enter Point mode, capture exactly one valid location and source time from the visible video content, see a marker and readable summary, or cancel without leaving an invisible layer over normal video controls.
- Status: Implemented with E2 automated evidence

## Why

An ordinary click on a video normally means playback control. Spatial editing therefore needs an explicit, temporary mode so a non-editor can point without learning timeline coordinates or losing access to normal player behavior.

## Scope

This slice adds only ephemeral point capture in the browser Studio. It does not yet translate the point into a nameplate proposal or canonical project history.

## Architecture impact

Contain-fit geometry, coordinate normalization, timestamp capture, validation, and time formatting live in a pure point-target feature module. Studio owns only interaction state and presentation. The temporary pointer layer exists only while Point mode is active, so domain math is testable independently and native video controls are not permanently intercepted.

## Files/modules changed

- `apps/web/src/features/point-target/point-target.ts`: contain-fit content geometry, fail-closed point/time capture, and display-time formatting.
- `apps/web/src/features/point-target/point-target.test.ts`: pure geometry, boundary, invalid-state, timestamp, and formatting coverage.
- `apps/web/src/screens/studio/StudioScreen.tsx`: Point/Cancel state, pause-on-entry, one-click capture, marker, summary, and Escape cancellation.
- `apps/web/src/screens/studio/StudioScreen.css`: temporary pointer surface, point action, marker, status, and error presentation.
- `apps/web/src/screens/studio/StudioScreen.test.tsx`: interaction and accessibility coverage while preserving normal video controls.
- Current state, build tracker, and project log evidence.

## Tests and evidence

- RED: focused tests first failed because the pure point-target module and Studio Point-mode behavior did not exist.
- GREEN: 11 pure point-target tests and 16 Studio tests pass (27 focused tests).
- Full workspace: 75 web tests plus 34 edit-domain tests pass (109 total).
- Both workspace builds, governance verification, and `git diff --check` pass.
- Evidence level: E2. The tests establish bounded interaction and geometry behavior; they do not establish owner usability, rendered output, or an end-to-end edit.

## Failure and recovery behavior

- Non-finite or negative source time and unavailable video geometry fail visibly without recording a target.
- Clicks in contain-fit padding or letterboxing are rejected and leave Point mode active for correction.
- Cancel or Escape exits Point mode without capturing, and a successful capture removes the temporary overlay so ordinary playback controls are available again.

## Migration and rollback

No persisted schema or media is changed. Rollback removes the point-target feature module and the isolated Point-mode Studio state and styles; the prior read-only browser preview remains intact.

## Limitations and follow-up

- The captured target is ephemeral UI state and is not yet connected to the canonical edit-domain package or persisted project history.
- No nameplate proposal/composer, edit preview, accept/undo flow, renderer integration, or export exists in this slice.
- The owner has not yet completed a live-browser Point-mode walkthrough on representative footage; discoverability, speed, and perceived feel remain open.
- Independent review forced two repairs before commit: normalized targets now reproject after resize, and the keyboard flow supports focused arrows/Enter without hijacking the visible Cancel button.
