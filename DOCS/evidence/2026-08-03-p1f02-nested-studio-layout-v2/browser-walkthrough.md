# Browser Walkthrough

Date: 2026-08-03. Runtime: local app on port 2000. Media: `resources/test video/test-30s.mp4`.

Passed: upload/open project; one mounted video; draft `keep this unsent draft across workspaces`; Assist→Studio continuity; preset/workspace switching; keyboard separator resize; AI collapse/expand; trim end by 1.0 second; revision 0→1; Undo; Redo; export; MP4 download. The video and draft remained continuous.

Console/network: only the nonblocking Vite HMR host mismatch described in INFRA-005. Export API completed normally.

Screenshot files exist under `screenshots/`, but their pixels are tiled by the desktop capture surface and are not claimed as truthful visual evidence; see INFRA-004.
