# P1-E media presentation contract

## Inputs

`MediaBinViewModel` receives only the accepted `EditProject`, shared display labels, App-owned source presentation, and derived usage. It never becomes a persisted media document.

## Invariants

- Import is asset intake, not an edit and not an Undo entry.
- Media selection is local presentation state only.
- Timeline/Canvas/Inspector selection remains the existing Studio selection.
- Search and filters never alter playhead, Timeline viewport, accepted history, or editor selection.
- Placement uses existing typed operations and existing App/server revision fencing.
- A missing or checking source cannot be previewed or placed.
- Used media cannot be removed.
- Unused removal is disabled until a server-authoritative asset service exists.
- No raw filesystem path is shown.
- Same-origin project asset URLs are used; P1-E creates no object URLs.

## Status model

- `checking`: source availability is not yet known; fail closed without falsely claiming it is missing.
- `available`: preview and compatible placement actions may be offered.
- `missing`: project identity and usage remain visible; preview/placement are refused.

## Supported actions

- Image/video → existing `add-media-overlay` operation.
- Audio → existing `add-music` operation.
- Music Inspector repair → existing `set-music` operation.

No new operation family, schema, API route, renderer architecture, or frontend-only deletion was added.
