# Canvas geometry contract

## One geometry authority

Studio owns one `ResizeObserver` on the existing video element. Metadata load, video resize, workspace changes, and window resize advance the same layout revision. Canvas adds no second `ResizeObserver`.

```text
video element rectangle
+ intrinsic videoWidth/videoHeight
→ object-fit: contain calculation
→ displayedVideoContentRect
→ browser overlays
→ Point conversion
→ Canvas selection/hit targets
→ crop overlay
→ snap/safe-area guides
```

Before metadata, Studio layout alone uses a 16:9 fallback so the stage is nonzero. Point and annotation capture remain strict and refuse a user gesture until real intrinsic dimensions exist.

## Coordinate rules

- Canonical visual coordinates remain composition-normalized.
- Letterbox bars are excluded.
- Pointer deltas use displayed-content pixels and convert to normalized frame fractions.
- Keyboard arrows move one displayed pixel; Shift moves ten.
- Crop fractions remain bounded and cannot remove the entire visual.
- Resize is uniform; Alt/Option resizes around the centre.
- Rotation is around the measured visual centre; Shift snaps to 15-degree increments.
- Snap candidates are frame centre, frame edges, and safe margins; Alt disables snapping.

## Interaction transaction

```text
pointer down → immutable starting session
pointer move → detached shared draft only
pointer cancel/Escape → authoritative values restored, no operation
pointer up → at most one validated set-visual-properties operation
server response → authoritative project revision or rollback notice
```

Unsupported items, gaps, music, dialogue, clips, blocked states, and unknown visuals receive no fake handles.

## Layout targets proved in Edge

The responsive stage remained readable at 1440×900, 1280×800, 1024×768, and 390×844. Footage was never stretched, document width never overflowed, native controls remained reachable, and exactly one main video element remained when the test overlay was an image.
