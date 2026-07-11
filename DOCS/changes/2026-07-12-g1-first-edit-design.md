# Change Record: G1 first-edit workflow and wireframe

- Date: 2026-07-12
- Goal: G1
- Requirements: REQ-001, REQ-002, REQ-003, REQ-004, REQ-006, REQ-011
- Decisions: DEC-003, DEC-004, DEC-005
- Acceptance criterion: The owner can identify upload, point/draw, proposal meaning, preview versus acceptance, undo, and export without learning professional editing terminology.
- Status: Draft complete; owner review pending.

## Why

The product succeeds only if the first edit is understandable to a non-editor. Defining the workflow before implementation prevents a capable engine from being hidden behind a conventional complex editing interface.

## Scope

- Primary job story
- First successful edit sequence
- Complete interface state model including clarification and recoverable failure
- State-by-state visible information
- Black-and-white proposal-review wireframe

## Architecture impact

The design implies future domain concepts—selection, bounded proposal, preview, acceptance, history, undo, and export—but does not implement or freeze their schemas. G2 will define those contracts after the renderer decision.

## Files/modules changed

- `DOCS/design/2026-07-12-g1-first-edit-flow.md`
- `DOCS/design/2026-07-12-g1-studio-wireframe.svg`
- `DOCS/design/2026-07-12-g1-studio-wireframe.png`

## Tests and evidence

- SVG parsed as valid XML with an SVG root.
- SVG rendered locally through headless Chrome at 1600 × 1000.
- Rendered PNG was visually inspected for hierarchy, clipping, legibility, and adherence to the black/white/grayscale rule.
- Evidence level: E1 design evidence only; product behavior remains E0.

## Limitations and risks

- This is one desktop proposal-review state, not a complete responsive prototype.
- The owner usability walkthrough has not yet occurred.
- Preview and export controls are conceptual and do not function.

## Migration and rollback

No product state or schema exists. Revise or replace the wireframe after owner feedback without migration cost.

## Follow-up

Run the owner walkthrough. After approval or correction, define and test the renderer-spike contract and fixtures.
