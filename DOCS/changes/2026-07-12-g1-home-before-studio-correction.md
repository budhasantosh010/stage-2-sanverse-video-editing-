# Change Record: Home before Studio correction

- Date: 2026-07-12
- Goal: G1
- Requirements: REQ-001, REQ-002, REQ-006, REQ-011, REQ-012
- Decisions: DEC-004
- Acceptance criterion: A first-time user understands how to begin from a calm Home screen without seeing editing controls; the Studio appears only after a video/project is opened.
- Status: Corrected design artifacts complete; owner review pending.

## Why

The first G1 wireframe correctly represented the editing workspace but incorrectly implied that users land directly inside it. The owner identified that this would overwhelm non-editors.

## Scope

- Add Home as Screen 1.
- Reclassify the existing Studio as Screen 2.
- Add drag/drop, composer attachment, conversational start, recent-project entry, and the Home-to-Studio transition.
- Update all durable requirements, decisions, plans, state models, and progress records affected by the correction.

## Architecture impact

Future application routing must distinguish Home/project selection from an opened Studio session. Editing state and heavy editor capabilities should not be initialized or exposed merely to render Home.

## Tests and evidence

- Documentation consistency and governance checks.
- SVG XML validation and local rendered-image inspection.
- Evidence level: E1 design evidence only.

## Limitations

- Neither screen is functional.
- Responsive/mobile behavior remains untested.
- Owner review is still required before implementation.

## Rollback

This is a design-only change and can be reverted as one commit without media or schema migration.
