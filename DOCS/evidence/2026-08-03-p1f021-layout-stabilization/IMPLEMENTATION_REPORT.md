# P1-F.0.2.1 — Nested Layout Stabilization and Panel Responsiveness

Status: technically complete; owner visual acceptance remains external evidence.

Start: `agent/g6-g8-local-alpha` at `f0b7ffeaa67d0fb2391784a13f6e4b2726355fcc`.

## Delivered

- Established one viewport-height authority for desktop Studio and one natural-flow authority below 981 px.
- Made collapsed AI a real 52 px, full-height status rail instead of shrinking the editor.
- Protected Preview and Timeline geometry through Reset, AI collapse, preset changes, repeated toggles, tablet mode, and mobile flow.
- Added named panel containers and panel-responsive Media, Inspector, Timeline, Preview, and AI rules.
- Kept one EditorShell, project, revision, native video, playhead, proposal, history, preview path, and export path.
- Removed the duplicate inner AI toggle without remounting ChatComposer.

## Defects found by the real browser

1. Reset could show `Expand AI` while the panel remained roughly 320 px. Stable initial layouts plus final presentation authority now keep the rail physically at 52 px.
2. At 1024 px and 390 px, old natural-flow CSS gave percentage-sized nested panels a zero-height ancestor. Tablet now remains bounded; mobile explicitly exits the panel flex authority and restores natural height.

## Evidence summary

- Focused affected suite: 91/91 passed.
- Full repository: 1,164/1,164 passed.
- Production build: passed for all workspaces.
- Browser: one video; zero horizontal overflow; unsent AI draft survived collapse and every Studio workspace; ten 1440×900 expand/collapse cycles were geometrically identical; laptop widths used the protected overlay fallback.
- Laptop AI expansion uses an overlay at 1280/1238; tablet/mobile Show Media and Show Tool controls sit outside their drawers and open reachable panels.
- Real edit: motion preset, Apply, Undo, Redo, export.
- Export: H.264/AAC, 1920×1080, 30 fps, 30.033008 s, 14,789,191 bytes.

## Architecture gate

Pass. The changes remain presentation-only adapters around the existing editor authority. No project schema, domain operation, revision store, renderer, proposal system, preview compiler, or export compiler was added or replaced.

## Honest user verdict

An advanced editor could use this as an alpha workspace: the main regions are stable, controls are reachable, the editing transaction completes, and the layout no longer collapses. It is not yet a consumer-ready product for ordinary non-editors. Studio is dense, typography and control grouping still feel engineering-led, the screenshot evidence surface is unreliable, and no representative external user has completed an acceptable video in measured minutes. Assist remains the correct default for that audience.

P1-F.1 was not started.
