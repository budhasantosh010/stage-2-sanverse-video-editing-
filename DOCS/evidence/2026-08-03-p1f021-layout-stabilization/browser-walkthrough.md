# Real-browser walkthrough

Test media: `resources/test video/test-30s.mp4`.

Passed:

1. Opened the saved project and entered Studio.
2. Verified one native video and zero desktop page overflow.
3. Expanded AI, typed `keep this exact draft`, collapsed and reopened it, then switched Effects → Color → Audio → Edit. Draft, project, and one video survived.
4. Measured all required responsive widths. The pass found and drove fixes for zero-height 1024/mobile panels.
5. Verified AI expansion is an overlay at 1280 and 1238 without changing Media/Preview/Tool widths.
6. Verified external Show Media/Show Tool controls open reachable drawers at 1024 and 390.
7. Repeated AI expand/collapse ten times at 1440×900 with identical collapsed geometry, one video, and no horizontal overflow; confirmed the overlay fallback at 1280×800 and 1238×728.
8. Selected the V1 clip by keyboard and operated the AI separator by keyboard; width changed 349→419 px.
9. Applied a 110% primary-footage motion preset. Revision advanced 0→1.
10. Undo advanced to revision 2 and enabled Redo; Redo advanced to revision 3 and restored export readiness.
11. Exported and probed the resulting MP4.

Findings:

- No horizontal overflow, duplicate video, lost AI draft, or inaccessible Timeline remained.
- The in-app screenshot compositor tiled captures at DPR 0.67 despite correct DOM geometry. Chrome control was unavailable. No invalid screenshot is presented as product evidence.
- The app is usable as an advanced-editor alpha, but Studio remains too dense to claim consumer readiness or representative-user validation.
