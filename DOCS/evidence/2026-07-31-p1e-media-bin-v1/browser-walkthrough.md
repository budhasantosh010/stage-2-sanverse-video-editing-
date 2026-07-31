# P1-E real Edge walkthrough

## Fixture and isolation

- Browser: Microsoft Edge / Chromium.
- Main footage: `resources/test video/test-30s.mp4`.
- Imported image: real 1920×1080 PNG.
- Imported B-roll: real 1920×1080 MP4 with audio.
- Imported music: real WAV file.
- Runtime data root: isolated `tmp/p1e-browser-data`; normal owner data was not used.

## Workflow proved

1. Opened the talking-head project and confirmed one main video and five Timeline lanes.
2. Imported an image without automatic placement.
3. Searched media and exercised All, Video, Images, Audio, and Missing filters without changing playhead, Timeline viewport, or editor selection.
4. Selected media by pointer and keyboard; opened actions by right-click and Shift+F10.
5. Added the image at the playhead as one existing `add-media-overlay` operation.
6. Confirmed the same image display name in Media, Timeline, Canvas, and Inspector.
7. Moved, uniformly resized, and cropped the image through Canvas; pointer movement stayed local and each completed gesture created one accepted revision.
8. Undid and redid crop.
9. Imported a secondary MP4 and added it as B-roll on V2.
10. Imported WAV audio and added it as music on A2 using `add-music`.
11. Adjusted music gain/fades through one `set-music` repair; Undo/Redo retained the imported audio asset.
12. Verified used-media removal refusal and the truthful deferred explanation for unused removal.
13. Temporarily renamed the isolated stored image and audio files. The project identities and usage remained; source probes settled to Missing.
14. Verified export failed durably with `RENDER_INPUT_INVALID` while required media was missing.
15. Restored the files, performed reversible Undo→Redo to create a fresh project revision, exported successfully, downloaded the MP4, probed it, and inspected frames/audio.
16. Returned Home and confirmed no hidden media elements or blob URLs remained.

## Responsive result

Validated at 1440×900, 1280×800, 1024×768, and 390×844. Body/document width always matched viewport width. The Media panel remained reachable, the video preview did not collapse, the Timeline retained five lanes, and the image never tiled or malformed.

## Error result

- Page errors: 0.
- Unexpected console errors: 0.
- Unexpected failed HTTP responses: 0.
- Expected 404s: only the deliberately renamed missing image/audio sources.

Machine-readable detail: `browser-report.json`.
