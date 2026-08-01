# P1-F.0.1 Studio Workspaces and Docking V1 — implementation report

Date: 2026-08-01

## Outcome

P1-F.0.1 is technically complete. Studio now has four professional workspace views—Edit, Effects, Color, and Audio—without creating a second editor, project, history, playhead, selection, preview, AI conversation, or rendering authority.

## Architecture

The feature is presentation-only:

```text
App / server project authority
        │
        ├── one EditProject + revision
        ├── one accepted history / Undo / Redo
        ├── one playhead and Timeline selection
        ├── one mounted video and preview pipeline
        ├── one shared Inspector/Canvas draft
        └── one AI conversation/proposal state
                 │
                 ▼
       Studio workspace presentation
       Edit | Effects | Color | Audio
```

Workspace switching and dock resizing never construct an edit operation and never change the accepted project revision.

## Delivered

- Studio-only accessible Edit, Effects, Color, and Audio tabs.
- One permanently mounted right dock with Tool and AI tabs, preserving hidden drafts and proposal state.
- A closed `sanverse.workspace-layout/v1` contract with strict validation, viewport clamping, fail-closed recovery, and local persistence.
- Bounded Edit, Motion, Timeline, Review, AI, and Audio presets plus reset.
- Accessible left, right, and Timeline splitters with pointer drag, Arrow keys, Shift steps, Home/End bounds, and Escape cancellation.
- Collapsible side docks and compact responsive side-panel switching below 1100px.
- Truthful capability surfaces:
  - Edit reuses Media and Inspector.
  - Effects exposes only existing footage motion and current visual effects.
  - Color exposes current visual color adjustment where supported and explicitly says primary-video grading is not implemented.
  - Audio reuses existing V1/A1/A2 gain, fade, enabled-state, and music controls while explicitly excluding waveforms, EQ, compression, mixing, and cleanup.
- One throttled geometry refresh path after layout changes; no second observer or project rebuild authority.
- Proposed Timeline items open their authoritative Tool/Inspector actions.
- Point mode keeps precedence over Canvas interaction.

## Key modules

- `apps/web/src/editor/workspace/workspace-contract.ts`
- `apps/web/src/editor/workspace/workspace-layout.ts`
- `apps/web/src/editor/workspace/workspace-presets.ts`
- `apps/web/src/editor/workspace/workspace-persistence.ts`
- `apps/web/src/editor/workspace/StudioWorkspaceTabs.tsx`
- `apps/web/src/editor/workspace/WorkspaceSplitter.tsx`
- `apps/web/src/editor/workspace/WorkspaceRightDock.tsx`
- `apps/web/src/editor/workspace/StudioWorkspacePanel.tsx`
- `apps/web/src/editor/workspace/StudioWorkspaceShell.css`
- `apps/web/src/editor/EditorShell.tsx`
- `apps/web/src/screens/studio/StudioScreen.tsx`

## Automated verification

Final repository-wide result:

```text
API                239
Web                515
Edit domain         299
Intent domain        27
Render contract      65
-----------------------
Total             1,145 passing
```

All 119 test files pass. The all-workspace production build passes.

New coverage includes schema corruption and unknown keys, viewport clamps, every preset, persistence failure behavior, keyboard and pointer splitters, Escape cancellation, accessible tabs, right-dock non-remounting, truthful workspace content, shared AI draft continuity, one-video identity, one selection/playhead/Timeline viewport, layout-only revision invariance, Point precedence, and responsive geometry.

## Real-browser and export evidence

Microsoft Edge completed the full workflow at 1440×900, 1024×768, and 390×844. The project revision remained `15 → 15` through every workspace, preset, dock, splitter, and Point presentation action. The same AI draft and video identity survived all switches. There were zero page errors, console errors, or failed local HTTP responses.

The browser-triggered export downloaded and probed as:

- H.264 High, 1920×1080, 30 fps;
- AAC-LC stereo, 48 kHz;
- 18.033333 seconds;
- 10,789,990 bytes;
- SHA-256 `176c85e64e8c44dc99cb8f65e4ccb5a5a221ac96da045d5f178ec8971eb59451`.

See `browser-walkthrough.md`, `browser-report.json`, the responsive screenshots, and inspected export frames in this directory.

## Explicitly not built

- P1-F.1 or P1-F.2.
- A second editor or project document.
- New edit operations, schemas, API routes, render behavior, or history behavior.
- Real AI-provider behavior.
- General multitrack editing.
- LUTs, scopes, curves, color wheels, HSL controls, waveforms, EQ, compression, mixing, or noise cleanup.

These omissions are deliberate scope boundaries, not hidden placeholders.
