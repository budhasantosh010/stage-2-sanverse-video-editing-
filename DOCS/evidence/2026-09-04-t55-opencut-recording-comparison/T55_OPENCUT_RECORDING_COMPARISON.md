# T5.5 OpenCut / Sanverse Recording Comparison — 2026-09-04

## Decision

Do not add more Timeline capabilities before Motion integration. Sanverse already exceeds the Timeline behavior demonstrated in the supplied OpenCut recording. The remaining gate is confidence: direct manipulation, visual stability, progressive disclosure and the owner's same-task acceptance.

Keep the richer Sanverse operations, but do not give them equal visual weight. The default Timeline should expose only the compact editing loop demonstrated by OpenCut: select/scrub, playhead, trim/split, delete/ripple delete, direct clip movement, snapping, zoom, Undo/Redo and export. Placement policies, precision trim, extra tracks and specialist controls remain available on demand.

## Sources

- `C:\Users\Lenovo\Music\Startups\YT Automations\A1 Talking Head Youtube Video\Sanverse YT Channel\2nd Sanverse Editing Workflow\rough test\Opencut Testing Video.mp4`
- `C:\Users\Lenovo\Music\Startups\YT Automations\A1 Talking Head Youtube Video\Sanverse YT Channel\2nd Sanverse Editing Workflow\rough test\Sanverse Testing Videos.mp4`

No source recording was changed.

## Frame-by-frame method

- OpenCut: 59.705 seconds, 1366×728 H.264 screen capture. FFmpeg processed 1,421 video frames.
- Sanverse: 47.358 seconds, 1362×730 H.264 screen capture. FFmpeg's frame filter processed 1,183 frames; 1,180 unique-timestamp frame hashes were emitted because the capture contains three repeated/non-monotonic timestamps.
- Both complete streams were decoded rather than judging one screenshot.
- Full-session contact sheets were generated every two seconds.
- Four dense 5-fps transition sheets cover OpenCut 16–23 s and 36–43 s, plus Sanverse 24–31 s and 32–39 s.
- Every decoded frame's bottom 280 pixels were isolated to reduce preview-video motion contamination. FFmpeg `signalstats` then measured luma difference from the preceding frame.
- Artifacts: `C:\Users\Lenovo\.codex\visualizations\2026\07\11\019f52c3-4f46-7f32-b75d-3b3670ef7e3c\timeline-comparison-2026-09-04`.

The frame-difference values are directional evidence, not a universal performance benchmark: the two recordings differ in duration, exact gestures and preview playback. They are useful because the visible bottom Timeline crop and capture dimensions are comparable.

## Quantitative Timeline-crop evidence

| Frame-to-frame luma difference | OpenCut | Sanverse recording |
|---|---:|---:|
| Frames analysed | 1,421 | 1,183 |
| Mean | 0.5565 | 1.3347 |
| Median | 0.0196 | 0.0512 |
| 90th percentile | 0.6067 | 2.8355 |
| 95th percentile | 4.4296 | 9.5591 |
| 99th percentile | 8.9522 | 25.0160 |
| Frames above 1.0 | 116 | 143 |
| Frames above 1.0 per second | 1.94 | 3.02 |

Sanverse's mean Timeline-region change is about 2.4× OpenCut's, and it produces about 56% more high-change Timeline frames per second despite the shorter recording. Visual inspection locates the clusters around Timeline re-layout, multiple permanent control bands, zoom/scroll changes and track/control expansion—not just pointer movement.

## What the recordings show

### OpenCut

- Preview, compact toolbar and the active clip lane remain in stable locations through the session.
- The user acts directly on the clip: scrub, select, move, split and create/remove empty space without leaving the Timeline context.
- Secondary choices do not permanently compete with the primary edit loop.
- Large blank Timeline space is visually quiet rather than filled with always-visible configuration.
- The interface is not feature-complete or visually perfect, but the next action is usually obvious and the surface does not recompose itself around each action.

### Recorded Sanverse build

- The core video result and edit operations work, but several control bands have equal visual emphasis: tool icons, four placement-policy buttons, precision playback controls, track creation and track-level controls.
- The Timeline and its controls visibly shift more during zoom, scrolling and expanded specialist workflows.
- The automatic dialogue row and professional controls make a simple one-video task read like a complex session before the user asks for complexity.
- The inspector is capable but visually competes with the clip lane during simple editing.
- The issue is no longer missing operations; it is the default hierarchy and the distance between intent and direct action.

## Repairs made after the supplied Sanverse recording

1. Primary gapless footage now reorders by direct pointer drag and commits one existing `reorder-clip` operation on release.
2. Detailed Timeline Zoom controls are closed behind one named disclosure by default.
3. Selected-item actions sit immediately under the main toolbar rather than below every track.
4. Precision playback, track creation and legacy specialist controls share one closed `Advanced timeline controls` disclosure before the track viewport.
5. Normal / Insert / Overwrite / Append remain fully available through one compact `Place` selector instead of four permanent buttons.

These are presentation and interaction-routing changes only. They do not replace Sanverse's project model, typed operations, revisions, history, preview/export paths or Motion boundary.

## Bounded OpenCut-level Timeline contract

No new capability enters the default Timeline before owner acceptance. The required contract is:

- one Select interaction and one playhead;
- direct click selection and direct gapless clip reorder;
- edge trim and Razor/split;
- Delete that leaves space and Ripple Delete that closes it;
- stable preview while scrubbing and playing;
- snapping/magnet behavior with a bypass modifier;
- compact zoom/fit access;
- visible Undo/Redo and one export path;
- truthful disabled states and keyboard access;
- no dead enabled controls;
- no Motion Graphics integration until this gate is accepted.

Sanverse's additional placement modes, precision tools, tracks, audio, captions and specialist operations are retained behind progressive disclosure. They are not a reason to delay confidence acceptance and are not permission to add more Timeline features.

## Verification for this repair

- RED: focused tests proved precision/track controls were outside and after the advanced disclosure, and that the four placement modes were separate permanent buttons.
- GREEN: `Timeline.test.tsx` and `TimelineTrackControls.test.tsx` pass **37/37**.
- All-workspace production build passes.
- Editor/Motion ownership check passes from base `c777c32fc0088dd488eb0295f1d42a675f2f055a`: ten changed paths inspected, no protected Motion path modified and no forbidden production Motion import found.
- Live Studio proves one closed advanced disclosure before tracks and one `How a drop lands` combobox that changes Normal → Overwrite → Normal without touching project history.
- Existing non-blocking build warnings remain: runtime nameplate-font URL resolution and a JavaScript chunk above 500 kB.
- One Vite WebSocket error in the browser log occurred while the dev servers were stopped between sessions; the correct branch was then started on 2000/2001 and loaded successfully. It is not a current product failure.
- Motion Graphics, T6/T7, renderer, project authority, preview and export code were not changed.

## Honest closure state

The recordings support stopping feature growth and continuing confidence convergence. The largest observed default-density problems are repaired in the current branch. This does not honestly prove complete OpenCut-level confidence: the owner still must perform the same short edit in both products for 15–20 minutes and accept Sanverse's feel. Any defect found there should be repaired inside T5.5; otherwise T5.5 should close and Motion integration may begin.
