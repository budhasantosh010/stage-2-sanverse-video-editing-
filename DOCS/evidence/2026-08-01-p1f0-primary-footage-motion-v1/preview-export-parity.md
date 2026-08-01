# P1-F.0 Preview and Export Parity

## Shared authority

Both renderers consume `sanverse.render-plan/v6` and the same source-time motion evaluator.

```text
accepted set-footage-motion
          ↓
effective source-anchored state
          ↓
render-plan segment footageMotions
          ↓
shared evaluator
     ↙             ↘
Canvas draw        FFmpeg expressions
```

## Browser result

The real Edge Inspector reported:

- 0.25 s: 100% scale, X 9%, Y 7%.
- 15.0 s: 118% scale, X 9%, Y 7%.
- 29.8 s: 120% scale, X 9%, Y 7%.

The browser continued to use one native video with native controls; the motion canvas was a picture projection only.

## Export result

The exported MP4 was probed as 1920×1080 H.264 at 30 fps with AAC stereo audio and 30.033008-second duration. Extracted frames are:

- `export-frames/00-start.png`
- `export-frames/50-middle.png`
- `export-frames/99-end.png`

Visual inspection confirmed progressive zoom and stable pan with no missing picture, alpha corruption, unexpected rotation, broken join, or overlaid UI. Source audio remained present as AAC-LC stereo at 48 kHz.

The exported media itself remains in ignored `tmp/p1f0-browser/run/`; evidence commits metadata, hash, and extracted frames rather than the 17 MB MP4.
