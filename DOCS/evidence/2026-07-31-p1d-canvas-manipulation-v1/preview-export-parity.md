# P1-D preview/export parity

## Shared contract

Canvas changes the same `VisualProperties` full state already consumed by preview and export. Detached Canvas preview calls the existing visual evaluator directly; accepted state compiles through the existing render plan. No Canvas-only geometry is persisted.

Automated preview coverage proves translation, scale, rotation, crop, opacity, combined transform/crop, entrance transition, effects, and simple keyframe motion. The P1-C entrance-fade regression remains green.

## Crop export defect and repair

The first final export failed after cropping an imported image. FFmpeg contain scaling had rounded the actual image to 806×452 for yuv420p, but the crop filter requested height 454 from the planned target box.

The renderer now derives crop dimensions and offsets from FFmpeg's actual post-scale `iw` and `ih`, and rounds width/height to valid even values. It no longer guesses crop pixels from the target box.

Evidence:
- FFmpeg filter-graph suite: 33/33 passed.
- Exact failed project revision rendered successfully after repair.
- Fresh Edge export downloaded successfully.
- `export-frames/01-title.png` shows moved, enlarged, 45-degree rotated title plus callout.
- `export-frames/03-cropped-image.png` shows the moved, resized, left-cropped image.
- `export-frames/04-proposal-nameplate.png` shows the accepted proposal.
- `export-frames/05-clean-footage.png` shows later footage with only the accepted timed nameplate still active.

## Final MP4

- codec: H.264 High;
- pixel format: yuv420p;
- size: 1920×1080;
- frame rate: 30 fps;
- audio: AAC LC, 48 kHz stereo;
- duration: 30.033008 seconds;
- bytes: 14,832,356.

Metadata is in `export-metadata.json`.
