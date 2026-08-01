# P1-E.1 Geometry After Document Scroll

P1-D Canvas and Point interactions use client-space geometry from the displayed video-content rectangle. Document scrolling changes every relevant `getBoundingClientRect()` result even when the video dimensions themselves do not change.

## Ownership

`StudioScreen` keeps the existing single video geometry controller:

- one existing `ResizeObserver` on the main video;
- `loadedmetadata` and video `resize` events;
- one passive `window` scroll listener;
- one lightweight `videoLayoutRevision` increment;
- cleanup of the observer, video events, and scroll listener on unmount.

No second observer, geometry store, project evaluation, Timeline rebuild, operation, change set, or revision is introduced.

## Required calculation path

```text
current main-video getBoundingClientRect()
  + intrinsic video dimensions
  → existing getRenderedVideoContentBox()
  → current displayed-video-content rectangle
  → Canvas target geometry / guides / crop handles
  → Point capture and marker projection
```

The scroll event never uses cached page coordinates. Canvas and Point read the current client rectangle after Studio's lightweight geometry refresh.

## Automated proof

The focused Studio test selects V1, dispatches a document scroll, and proves:

- selection remains authoritative;
- exactly one video remains;
- no edit operation is emitted.

Existing Canvas and Point suites continue to prove detached movement, one completion operation, cancellation, hit testing, crop, resize, rotation, and normalized point capture.

## Real-browser proof

The Edge walkthrough records the Canvas target and rendered preview-node rectangles before and after a bottom-and-back document-scroll cycle. Their relative geometry must remain within two client pixels. It then moves the title after scrolling and verifies exactly one accepted revision. Point mode captures against the current visible video rectangle and records the resulting normalized marker.
