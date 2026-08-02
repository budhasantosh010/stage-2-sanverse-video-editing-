# P1-F.0.2 — Nested Studio Layout Engine V2

Status: implementation and functional verification complete; screenshot-capture infrastructure exception recorded in `DOCS/FAILURE_REGISTRY.md`.

## Delivered

- Replaced the hand-built Studio splitter implementation with `react-resizable-panels@4.12.2`.
- Added nested, typed layout groups for AI/main, upper/timeline, and media/preview/tool.
- Added versioned V2 layout state, V1 migration, corrupt-state fallback, presets, reset, and persistence after completed user resizes.
- Preserved the existing EditorShell authority: one project/revision, video/playhead, selection, proposal, history, preview path, and export path.
- Kept ChatComposer mounted and its draft continuous across Assist/Studio, preset changes, AI collapse, and responsive overlay transitions.
- Added keyboard-operable separators, reduced-motion support, responsive desktop/tablet/compact modes, AI overlay Escape handling, and focus restoration.

## Acceptance evidence

- Focused editor regression: 71/71 passed.
- Layout contract, migration, persistence, responsive, and integration coverage included in the 526-test web suite.
- Final suites: API 239, web 528, edit-domain 299, intent-domain 27, render-contract 65; 1,158 passed.
- Production build passed for every workspace.
- Real browser: one-video assertion, keyboard resize, draft continuity, workspace/preset continuity, trim edit, Undo, Redo, export and MP4 download passed.
- Export: 1920×1080, 29 seconds, export id `export_f6783760b77b3d26c6ad8b8f3448ba2e`.

## Architecture gate

This slice passes the architecture gate because layout is a presentation adapter with a typed/versioned contract; it neither duplicates nor replaces edit-domain authority. No new operation, renderer, project model, history, proposal, preview, or export authority was created.

## Known nonblocking evidence issues

- Desktop in-app PNG capture tiled the page despite correct DOM geometry; the recurrence is recorded as INFRA-004.
- Vite HMR attempted a `localhost:2000` websocket while the page used `127.0.0.1:2000`; production behavior was unaffected and is recorded as INFRA-005.
- The production bundle retains the existing runtime font-resolution and >500 kB chunk warnings.

P1-F.0.2 stops here. No P1-F.1 work was started.
