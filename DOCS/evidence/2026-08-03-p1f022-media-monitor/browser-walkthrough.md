# Real-browser walkthrough

Source: `resources/test video/test-30s.mp4` on `http://127.0.0.1:2000`.

Verified: one video; custom controls only; Play/Pause and seek; Point capture and selected marker; Add text; pending/accepted presentation; Undo/Redo; Fit/Fill/100%; guides; native-unavailable fullscreen fallback; Media 420/304/239/220 px resizing; preserved `test` search and selection; 1440, 1280, 1238, 1024, and 390 responsive regimes; no console warning/error entries.

The accepted nameplate export stayed in `Rendering and verifying your MP4…` beyond 90 seconds. It is recorded as a pre-existing export-runtime issue; renderer repair was forbidden in this milestone.

The in-app screenshot compositor produced malformed tiled full-viewport captures. Only bounded non-tiled JPEG captures were retained; the malformed PNG was deleted. No evidence video was captured because this browser surface exposed screenshot but no recording capability.
