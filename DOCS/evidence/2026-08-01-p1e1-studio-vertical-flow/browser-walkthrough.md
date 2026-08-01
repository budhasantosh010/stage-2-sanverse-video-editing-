# P1-E.1 Real Edge Walkthrough

## Environment

- Browser: Microsoft Edge / Chromium, headless automation against the real local app.
- Web: `http://127.0.0.1:2000`.
- API: `http://127.0.0.1:2001`.
- Isolated data root: `tmp/p1e1-browser-data`.
- Real media: `resources/test video/test-30s.mp4`.
- Viewports: 1440×900, 1280×800, 1024×768, and 390×844.

## Result

The complete Studio document scrolls vertically while the browser document remains the one outer scroll owner.

At 1440×900:

- `scrollHeight` was 1484 pixels and `clientHeight` was 900 pixels.
- The document therefore had 584 pixels of real vertical scroll range.
- Page Down moved the document.
- The complete Production Timeline reached the viewport bottom at the maximum scroll position.
- The page width remained exactly 1440 pixels with no horizontal overflow.

Responsive measurements:

| Viewport | Document height | Client height | Maximum observed scroll | Horizontal overflow |
|---|---:|---:|---:|---|
| 1440×900 | 1484 | 900 | 584 | none |
| 1280×800 | 2050 | 800 | 1250 | none |
| 1024×768 | 2275 | 768 | 1507 | none |
| 390×844 | 2522 | 844 | 1678 | none |

## Timeline continuity

While scrolled to the Timeline:

1. V1 was selected.
2. The playhead was moved to 10 seconds.
3. Split created revision 1.
4. Undo created revision 2.
5. Redo created revision 3.
6. Timeline zoom was changed to 125 px/s.
7. Horizontal scroll settled at 370 pixels.
8. The page scrolled to the top and back to the bottom.

After the page-scroll round trip, playhead, selected clip, zoom, horizontal scroll, and accepted project revision were unchanged.

## Canvas geometry

A real title named `Scroll Geometry Title` was added at revision 4 and selected. Before and after a full page-scroll round trip, the Canvas target and rendered title retained identical client rectangles. Moving the title after the scroll created exactly one new revision, revision 5. Pointer movement created no intermediate revision.

Evidence: `screenshots/canvas-aligned-after-scroll.png` and the exact rectangles in `browser-report.json`.

## Point geometry

Point mode was entered after the page-scroll round trip. A click inside the current visible video rectangle produced the normalized marker:

```text
left: 61.9647%
top: 40.9302%
```

Evidence: `screenshots/point-aligned-after-scroll.png`.

## Internal panel scrolling and scroll escape

- The Media asset list had 564 pixels of content inside a 177-pixel viewport and scrolled to 387 pixels.
- The selected Inspector content fit inside its 218-pixel viewport in this workflow; no false internal scrollbar was required.
- A wheel gesture after the Inspector check moved the outer document from 0 to 900 pixels.
- Normal scroll chaining remains enabled; panel CSS does not use `overscroll-behavior: contain`.

## Playback and cleanup

- Playback advanced from 20.000 seconds to 20.958212 seconds while the document scrolled to the Timeline.
- Exactly one main video and five Timeline lanes existed at every viewport.
- One passive document-scroll geometry listener existed during Studio use.
- After returning Home, the scroll-listener count was zero and no video element remained.

## Browser failures

```text
Page errors:                0
Console errors:             0
Failed HTTP responses:      0
```

## Screenshots

- `studio-top-1440x900.png`
- `studio-middle-1440x900.png`
- `studio-bottom-1440x900.png`
- `timeline-reachable-1280x800.png`
- `timeline-reachable-1024x768.png`
- `mobile-page-scroll-390x844.png`
- `canvas-aligned-after-scroll.png`
- `point-aligned-after-scroll.png`
