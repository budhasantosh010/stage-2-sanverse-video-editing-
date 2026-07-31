# P1-D real Edge walkthrough

## Inputs

- Browser: Microsoft Edge / Chromium.
- Main media: `resources/test video/test-30s.mp4`.
- Media overlay: a real PNG frame extracted from the same MP4.
- Project: `project_491de4b70a4764d8fd042722d1747115`.

## Workflow completed

1. Upload real MP4 and enter Studio.
2. Verify fitted preview, one video element, five Timeline lanes, and native controls.
3. Create and select `Canvas Title`.
4. Drag to frame centre and inspect the visible snap guides.
5. Release once; project revision advances once.
6. Undo and Redo.
7. Keyboard-nudge one displayed pixel.
8. Uniformly resize the title.
9. Rotate it to 45 degrees using Shift snapping.
10. Confirm Inspector X/Y/scale/rotation match the Canvas draft.
11. Create, move, and resize `Focus area` callout.
12. Import a real still image, then move and resize it.
13. Enter crop mode, crop the left edge, commit, Undo, and Redo.
14. Confirm Timeline scroll and zoom state did not change.
15. Create a pending visual proposal, move it through existing repair state, and confirm the accepted revision does not change.
16. Reject that proposal without a revision.
17. Create and accept a second proposal.
18. Enter Point mode and confirm the Canvas interaction layer is absent.
19. Verify reduced-motion mode.
20. Export, download, probe, and inspect frames.

## Revision evidence

Accepted project revision began at 0 and ended at 18. Title move, Undo, Redo, nudge, resize, rotation, callout edits, image edits, crop, crop Undo/Redo, and accepted proposal each crossed the existing server revision fence. Pending proposal repair and rejection remained detached at revision 17.

Asset intake is not edit history and may advance the stored project revision separately before the `add-media-overlay` operation. `FAIL-030` protects the immediate post-upload operation from using the stale pre-upload revision.

## Responsive geometry

| Viewport | Stage | Visible footage | Timeline | Overflow |
|---|---:|---:|---:|---|
| 1440×900 | 814×342 | 572×322 | 1408×306 | none |
| 1280×800 | 654×280 | 462×260 | 1248×272 | none |
| 1024×768 | 966×292 | 483×272 | internally below | none |
| 390×844 | 332×280 | 316×178 | internally below | none |

All sizes preserved `object-fit: contain`. The Canvas layer was a child of the exact displayed-content layer, not the letterbox bars. The native control-strip point resolved to the `<video>` element.

## Browser health

- Page errors: 0.
- Console errors: 0.
- Failed HTTP responses: 0.
- Video elements: 1.
- Timeline lanes: 5.
- Document scroll width equalled viewport width at all required sizes.

Machine-readable evidence is in `browser-report.json`. Screenshots are in `screenshots/`.
