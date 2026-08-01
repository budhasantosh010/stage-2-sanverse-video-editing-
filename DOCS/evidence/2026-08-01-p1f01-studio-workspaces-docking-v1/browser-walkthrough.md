# P1-F.0.1 Studio Workspaces and Docking V1 — Edge walkthrough

Date: 2026-08-01

Browser: Microsoft Edge `150.0.4078.105`, controlled through Edge's native Chrome DevTools Protocol.

Runtime:

- Web: `http://127.0.0.1:2000`
- API: `http://127.0.0.1:2001`
- Source: the latest persisted real `test-30s.mp4` project
- Starting accepted project revision: `15`
- Viewports: `1440×900`, `1024×768`, `390×844`

## Walkthrough

1. Opened Home and reopened the latest persisted `test-30s.mp4` project.
2. Entered an unsent AI draft: `workspace draft survives every surface`.
3. Set the existing video playhead and captured the original DOM video identity.
4. Switched Assist → Studio and verified exactly one video remained mounted.
5. Verified the four Studio-only tabs: Edit, Effects, Color, Audio.
6. Selected the V1 item and verified the shared Timeline/Canvas/Inspector selection.
7. Opened the AI dock and verified the unsent draft survived.
8. Switched Edit → Effects → Color → Audio → Edit. In every workspace:
   - the same video element remained mounted;
   - the same playhead and project revision remained;
   - the hidden AI textarea retained the same unsent draft;
   - Tool showed only current capabilities;
   - Color showed an explicit unsupported state for primary footage instead of invented controls.
9. Applied Edit, Motion, Timeline, Review, AI, Audio, then Edit presets.
10. Resized Media, right dock, and Timeline with keyboard controls and verified the validated local layout changed.
11. Collapsed and restored both side docks, then reset the workspace.
12. Entered Point mode and verified Point precedence over Canvas controls; Escape cancelled it without creating an edit.
13. Checked compact behavior at 1024×768 and 390×844 with no horizontal page overflow.
14. Returned to desktop, reopened the right dock and AI tab, exported the accepted project, downloaded the MP4, and returned Home.
15. Verified Home cleanup removed the video from the DOM.

## Results

- Project revision during all presentation-only workspace/layout activity: `15 → 15`.
- One video element and one video identity across Assist/Studio and all four workspaces.
- AI draft preserved across every workspace.
- Keyboard splitter changes persisted through `sanverse.workspace-layout/v1`.
- No horizontal document overflow at 1024×768 or 390×844.
- Page errors: `0`.
- Console errors: `0`.
- Failed local HTTP responses: `0`.
- Export SHA-256: `176c85e64e8c44dc99cb8f65e4ccb5a5a221ac96da045d5f178ec8971eb59451`.
- Export size: `10,789,990` bytes.
- Export probe: H.264 High, 1920×1080, 30 fps; AAC-LC stereo, 48 kHz; 18.033333 seconds.

The first browser-triggered render job completed in about 57 seconds. The final repeat used the server's idempotent completed job and surfaced ready state in 358 ms. This is evidence of deterministic export reuse, not a claim that a fresh 1080p render takes 358 ms.

## Evidence files

- `browser-report.json` — complete machine-readable state and geometry record.
- `export-hash.json` — downloaded byte count and SHA-256.
- `export-metadata.json` — FFprobe stream and container metadata.
- `screenshots/` — Assist, Edit, AI, Effects, Color, Audio, presets, splitters, collapsed docks, Point, tablet, mobile, export, cleanup.
- `export-frames/` — inspected start, middle, and end frames.
