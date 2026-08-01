# P1-F.0 Real Edge Walkthrough

## Environment

- Browser: installed Microsoft Edge, Chromium engine.
- App: `http://127.0.0.1:2000`.
- API: loopback-only `http://127.0.0.1:2001`.
- Source: `resources/test video/test-30s.mp4`.
- Desktop viewport: 1440×900.
- Responsive viewports: 1024×768 and 390×844.

## Completed workflow

```text
Import real MP4
  → Studio
  → select V1
  → Punch in 120% draft
  → Apply
  → Canvas pan draft
  → release once
  → Undo
  → Redo
  → Point mode
  → Escape
  → Smooth zoom-in preset
  → Apply repair
  → inspect start / middle / end
  → split at 10 seconds
  → Undo split
  → Redo split
  → Export
  → download MP4
  → tablet layout
  → mobile layout
  → Back Home
```

## Revision chain

```text
0  imported project
1  static 120% motion
2  Canvas pan repair
3  Undo Canvas repair
4  Redo Canvas repair
5  animated scale repair
6  split at 10 seconds
7  Undo split
8  Redo split
```

Pointer movement changed only the detached Inspector draft. The server revision stayed unchanged until pointer release, then increased once. Escape during Point mode created no revision.

## Preview samples

- Start: `100% · X 9% · Y 7% · 0.0°`.
- Middle: `118% · X 9% · Y 7% · 0.0°`.
- End: `120% · X 9% · Y 7% · 0.0°`.

The V1 Timeline reported two keyframes after the animated repair. Both split clips retained the same source-anchored motion indicator through split, Undo, and Redo.

## Browser invariants

- Exactly one native video remained mounted in Studio.
- Native video controls remained present.
- Point mode removed footage handles and owned the picture until cancelled.
- No page-level horizontal overflow at 1440, 1024, or 390 pixels.
- Tablet compact-panel Inspector was usable.
- Mobile showed the truthful wider-screen handle message and kept Motion Inspector values readable.
- Returning Home removed the video, motion canvas, and footage controls.
- Page errors: 0.
- Console errors: 0.
- Failed HTTP responses: 0.

Machine-readable measurements and timings are in `browser-report.json`. Screenshots are in `screenshots/`.
