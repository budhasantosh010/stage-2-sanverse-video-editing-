# P1-B IMPLEMENTATION REPORT — Production Timeline V1

Date: 2026-07-30  
Branch: `agent/g6-g8-local-alpha`  
Start commit: `bb5c864a170a143db001ae21a003e0cc0bdc03af`  
End commit: this focused P1-B commit

## Objective

Replace the old proportional one-row Studio strip with a real production
Timeline V1 while preserving Sanverse's existing authority:

```text
EditProject
  -> P1-A buildTimelineViewModel
  -> Timeline V1 presentation
  -> semantic TimelineGesture
  -> P1-A adaptTimelineGesture
  -> existing server-authoritative change-set request
  -> returned EditProject revision
```

No browser-only project mutation, second history, second playhead, second video
element, second proposal store, schema change, operation kind, persistence
format, preview compiler, or export compiler was introduced.

## Implemented

### Production timeline surface

- five semantic rows: V2 overlay, V1 video, C1 captions, A1 dialogue, A2 music;
- deterministic ruler and time labels;
- one shared composition-time playhead;
- ruler/lane click-to-seek;
- pointer-drag and keyboard playhead control;
- horizontal scrolling, wheel handling, bounded zoom, and Fit;
- visible-range rendering plus one viewport of overscan;
- proportional committed clips, captions, overlays, music, gaps, hidden items,
  blocked items, and detached proposal ghosts;
- stable selection reconciled after every authoritative project revision;
- visible selected-item range and plain-language action summary;
- split, trim start/end, ripple removal, removal leaving a gap, reorder,
  enable/disable, and clip audio settings through existing typed operations;
- trim preview with exact start/duration tooltip before commit;
- deterministic eight-pixel snapping to project/item boundaries with a visible
  dashed `SNAP` guide;
- real right-click and Shift+F10 context menu;
- Delete/Backspace moves focus to the removal decision and never deletes
  immediately;
- Escape clears selection or closes the open context menu;
- proposal ghosts open the existing proposal panel and never enter history;
- existing direct controls remain available under progressive disclosure.

### Studio integration

`StudioScreen` derives one `TimelineViewModel` from the current authoritative
`EditProject` and detached nameplate proposal. Timeline seeking drives the same
composition playhead and the same one `<video>` element used by preview. Gaps
show black and resume at the next surviving source segment. Every timeline
operation travels through `adaptTimelineGesture`, then the existing
`onTimelineEdit` callback and server revision fence.

### Responsive and accessibility work

- desktop keeps video, Media, Inspector/AI, and the full five-lane timeline in
  one 1440×900 or 1280×800 frame;
- tablet and mobile stack without document-width overflow;
- lane, item, state, time, playhead, zoom, menu, proposal, and diagnostics have
  accessible names or roles;
- playhead exposes a slider contract and 0.1-second keyboard steps;
- right-click actions have a keyboard equivalent;
- proposed/blocked/hidden states do not rely on color alone;
- reduced-motion rules remain intact.

## Visual defects found by the real browser and fixed

1. Desktop allocated about 90 px to a 256 px lane stack, clipping V1/C1/A1/A2.
   The Studio height budget and compact lane heights were corrected.
2. The desktop nameplate proposal sheet spilled below the canvas and its
   visible Create button was intercepted by the Timeline. It is now a contained
   in-canvas overlay on desktop and remains normal flow on tablet/mobile.
3. Trim math worked but the exact trim tooltip was clipped by the lane. The
   active trim lane now exposes the tooltip without exposing ordinary overflow.
4. Export completed but the right panel stopped at the Export heading. The
   ready/error result now scrolls fully into view and receives focus.
5. Dialogue labels and state text were too tight. Lane and item layout were
   adjusted.
6. Selected-item actions wrapped beneath the fixed Studio frame. Labels and the
   action allocation were compacted; a duplicate control was removed.
7. The browser console contained a `/favicon.ico` 404. A local inline favicon
   removed that noise so the final browser run can require zero console errors.
8. The first context menu was taller than the remaining Studio space. It was
   narrowed to high-frequency actions and now fits completely.
9. Snapping initially had no visible distinction from the playhead. A dashed
   guide and functional `SNAP` label now make the state explicit.

## Verification

### Focused production gates

- timeline/Studio web tests: **79/79 passed**;
- affected edit-domain timeline/caption/overlay tests: **77/77 passed**;
- render-contract: **51/51 passed**;
- intent-domain: **27/27 passed**;
- all-workspace production build: **passed**.

Final web bundle:

```text
123 modules
CSS 59.20 kB / 10.54 kB gzip
JS  419.56 kB / 118.43 kB gzip
```

P1-A baseline was 104 modules, CSS 48.47/8.78, JS 374.08/106.78. P1-B therefore
adds 19 production modules, 10.73 kB raw CSS, and 45.48 kB raw JavaScript. The
cost is accepted for the complete Timeline V1 interaction layer; no third-party
runtime dependency was added.

### Real browser and media

Python Playwright drove installed Microsoft Edge against the real local app and
freshly uploaded `resources/test video/test-30s.mp4`:

```text
upload -> Studio -> seek/select -> split -> Undo -> Redo
       -> right-click menu -> Fit -> snap -> zoom -> scroll
       -> trim preview -> trim commit -> Undo -> drag playhead
       -> detached proposal ghost -> reject -> export -> download
       -> tablet/mobile geometry
```

Final assertions:

- one video element;
- five lanes fully inside the timeline grid;
- body/document scroll width equals viewport at 1440, 1024, and 390 px;
- proposal ghost count is one while pending and zero after rejection;
- proposal does not change revision;
- split/Undo/Redo/trim/Undo revisions advance only through the server;
- page errors: none;
- console errors: none;
- failed HTTP responses: none;
- exported MP4 downloaded successfully: 14,789,191 bytes.

`ffprobe` verified H.264 1920×1080 at 30 fps, AAC 48 kHz stereo, and 30.033008
seconds. Frames extracted at 0.5, 7.5, 15, 22.5, and 29.5 seconds were visually
inspected and were intact.

See `browser-walkthrough.md`, `test-results.md`, `browser-report.json`,
`screenshots/`, `export-metadata.json`, and `export-frames/`.

## Broad-suite truth

P1-B's focused and affected gates pass. The repository-wide test commands still
contain unrelated pre-existing contract drift:

- full web: 324 passed, one `OverlayRepairPanel` signed-number simulation failed
  (`-24` became `+24`); P1-B does not modify that component;
- full edit-domain: 263 assertions passed, but Vitest treats
  `motion-fidelity.contract.test.ts` as an empty suite;
- full API: 228 passed; two empty contract files fail collection and two old
  server assertions expect synchronous export statuses 201/503 while the API
  now returns asynchronous 202. Stopping the live dev server did not change it.

These failures were recorded rather than hidden or expanded into unrelated
repair work. The complete production build passes.

## Third-party provenance

No OpenCut code or new third-party package was copied. Decision C remains in
force: Sanverse owns the focused timeline; only behavior was studied.

## Non-goals retained

No roll, slip, slide, three-point editing, multicam, nested sequences,
professional routing, waveform-generation service, or full shortcut editor was
started.

## Exact next task

P1-C — Inspector V1. It was not started.
