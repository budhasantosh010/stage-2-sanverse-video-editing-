# T2 — Dual-Axis Timeline Zoom

Status: implementation slice complete at the first focused T2 commit.

## Authority

Horizontal zoom continues to be the one existing `TimelineViewportState`:

```text
pixelsPerSecond
scrollLeftPx
viewportWidthPx
```

No second ruler scale, content width, visible-range calculation, or Timeline
state was introduced.

Vertical zoom is a presentation-only multiplier:

```ts
type TimelineVerticalZoomV1 = Readonly<{
  scaleBasisPoints: number
}>
```

Bounds are 6,000–20,000 basis points (60–200%), default 10,000 (100%), step
1,000 (10%). It multiplies the already stored T1 base height after preset/custom
resolution. Collapsed tracks remain the fixed 14-pixel strip.

## Horizontal behavior

The range uses 21 perceptual levels from 10 through 1,000 px/s. The existing
Zoom Out and Zoom In actions move through the same sequence. Wheel zoom keeps
its pointer anchor but writes the same viewport state.

`calculateHorizontalZoomScroll` takes one integer composition-tick anchor and
preserves it under one viewport X. Timeline chooses:

1. pointer X for wheel zoom;
2. visible playhead X for toolbar/slider zoom;
3. otherwise the exact composition tick at viewport center.

The resulting scroll is clamped only after the anchor calculation. Start, end,
short-project, offscreen-playhead, and one-hour cases are covered.

Fit Timeline is explicitly horizontal. It shows the complete composition,
updates the same horizontal value, and leaves vertical zoom unchanged.

## Vertical behavior

Expanded height is:

```text
clamp(round(baseHeight × scaleBasisPoints / 10000), 24, 240)
```

`baseHeight` remains the exact compact/standard/tall/custom T1 value. Therefore
returning to 100% restores it exactly. Folding is applied before multiplication,
so collapsed rows remain 14 px at every zoom.

The live Timeline preserves the selected track center through a vertical change
where the document can scroll. Without a selected track it preserves the
Timeline grid center. The pure `calculateVerticalZoomScroll` contract also
covers selected V2/V1/C1/A1/A2 tracks, center fallback, top/bottom clamps, and
all-tracks-fit behavior.

Fit Tracks is explicitly vertical. It invokes the existing T1 fit policy after
accounting for the current multiplier and never changes horizontal zoom.

## Persistence and isolation

A closed local contract is stored per project:

```text
sanverse.timeline-zoom-presentation/v1
├── horizontalPixelsPerSecond
└── vertical.scaleBasisPoints
```

Unknown, missing, non-finite, extra-key, or future-version data falls back to
100 px/s and 100%. Storage failure cannot block editing.

Zoom creates:

- no operation;
- no revision;
- no Undo/Redo entry;
- no project serialization;
- no render-plan change;
- no export-identity change;
- no Preview-output change.

It survives workspace switching, dock collapse, project refresh, and reload.

## UI and accessibility

Desktop and standard widths retain both axis rows at the existing zoom location.
At mobile width one Timeline Zoom summary opens the same controls in a bounded
popover with no duplicate authority.

Required accessible names are present:

- Timeline horizontal zoom;
- Zoom Timeline out;
- Zoom Timeline in;
- Timeline vertical zoom;
- Reduce track height;
- Increase track height;
- Fit Timeline horizontally;
- Fit tracks vertically;
- Reset vertical zoom.

Both ranges are native range inputs, preserving pointer, touch, Arrow,
Page Up/Down, Home, and End behavior. Step buttons disable at their bounds.

## Performance

Slider input is coalesced through one requestAnimationFrame per axis. Horizontal
movement only updates Timeline geometry and the existing bounded visible-media
planner. Vertical movement redraws presentation and reuses existing filmstrip
frames and waveform peaks. No FFmpeg process, project evaluation, project
serialization, new object URL, ImageBitmap, AudioContext, video element, or
listener authority was added.

## Verification

```text
Focused dual-axis matrix       43 / 43
Complete web suite          1,205 / 1,205
Web production build          passed
```

The complete suite includes existing long-form DOM/request bounds, filmstrip and
waveform planning, one-video continuity, workspace persistence, Timeline
selection/groups/markers, media, Preview, Canvas, and responsive tests.

The real-browser desktop/compact/mobile screenshots and live playback zoom proof
are intentionally collected again in the final T2 master workflow so they cover
the completed feature set rather than an intermediate program state.