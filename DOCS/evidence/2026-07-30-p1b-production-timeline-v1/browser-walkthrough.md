# P1-B real-browser walkthrough

Date: 2026-07-30  
Browser: installed Microsoft Edge / Chromium  
Viewport evidence: 1440×900, 1024×768, 390×844  
Media: `resources/test video/test-30s.mp4`

## Execution chain

```text
ChatGPT Harness run_command
  -> Python Playwright
  -> installed Microsoft Edge
  -> real Vite web app on 127.0.0.1:2000
  -> loopback API on 127.0.0.1:2001
  -> screenshots + live DOM geometry + downloaded export
  -> Harness read_image inspection
```

## Walkthrough

1. Opened Home in a fresh browser context.
2. Uploaded the real 30.033-second 1080p fixture.
3. Waited for the real project and media metadata, then switched to Studio.
4. Verified one video element, five timeline lanes, no page/console errors, and
   no document-width overflow.
5. Clicked the V1 clip around 10 seconds. Selection and the single playhead moved
   together.
6. Split at the playhead. Revision changed 0→1 and V1/A1 showed two items.
7. Undid and redid. Revisions changed 1→2→3 and item counts returned 2→1→2.
8. Right-clicked the first clip. The real context menu opened without changing
   revision; it fit completely inside Studio. Escape closed it.
9. Fit the project. Dragged from six seconds to five pixels beside the ten-second
   boundary. The playhead landed exactly at 14,400,000 ticks and a dashed `SNAP`
   guide appeared. Releasing removed the guide.
10. Zoomed in and horizontally scrolled; local viewport state changed without a
    project edit.
11. Selected the second clip and dragged its trim-start handle. The UI showed
    exact temporary start/duration values before commit. Release created one
    server-authoritative trim; revision changed 3→4. Undo changed 4→5.
12. Dragged the shared playhead and verified the video followed composition time.
13. Sought near four seconds, entered Point, captured a point, and created
    `P1-B Ghost` as a pending nameplate proposal.
14. Verified exactly one proposed V2 ghost, unchanged revision 5, disabled Undo,
    and disabled Export. Rejected it and verified the ghost disappeared.
15. Exported, waited for verified readiness, fetched the Download MP4 URL, and
    saved a 14,789,191-byte file.
16. Resized the same live page to tablet and mobile. Verified all five lanes,
    one video, and zero horizontal page overflow.

## Revision evidence

```text
initial             0
split               1
Undo                2
Redo                3
trim                4
Undo trim           5
pending proposal    5  (unchanged)
final               5
```

## Geometry evidence

At 1440×900:

```text
Timeline grid      1378 × 200 px
Lane headers       78 × 198 px
Scrollable body    1298 × 198 px
All lanes inside grid: true
body.scrollWidth   1440
window.innerWidth  1440
```

At 1024×768:

```text
body.scrollWidth   1024
window.innerWidth  1024
all five lanes inside grid: true
```

At 390×844:

```text
body.scrollWidth   390
document width     390
window.innerWidth  390
all five lanes inside grid: true
```

## Screenshots inspected

- `desktop-default.png`
- `desktop-after-split.png`
- `desktop-context-menu.png`
- `desktop-snap-guide.png`
- `desktop-trim-preview.png`
- `desktop-proposal-ghost.png`
- `desktop-export-ready.png`
- `tablet-1024x768-timeline.png`
- `tablet-1024x768-full.png`
- `mobile-390x844-timeline.png`
- `mobile-390x844-full.png`

Each was opened with the Harness image reader. Screenshot appearance was checked
against live DOM bounds instead of being trusted alone.

## Export inspection

`ffprobe`:

```text
container  mov/mp4
video      H.264, 1920×1080, 30 fps
audio      AAC, 48 kHz, stereo
duration   30.033008 s
size       14,789,191 bytes
```

Frames were extracted and inspected at 0.5, 7.5, 15, 22.5, and 29.5 seconds.
No corrupt, black, clipped, or stale frame was found.

## Final browser result

```text
page errors       0
console errors    0
HTTP >= 400       0
one video         yes
five lanes        yes
responsive width  clean
export download   verified
```
