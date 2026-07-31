# P1-E export verification

Final downloaded file: `p1e-media-bin-export.mp4` (kept outside Git; metadata and derived evidence are committed).

## Probe

- Container: MP4.
- Video: H.264 High, 1920×1080, 30 fps.
- Audio: AAC LC, 48 kHz, stereo.
- Duration: 30.033008 seconds.
- Size: 15,004,476 bytes.

Raw probe: `export-probe.json`. File metadata: `export-file.json`.

## Frame evidence

- `export-frames/01-before-image.png`: no media overlay before its interval.
- `export-frames/02-image-overlay.png`: transformed/cropped image visible inside its interval.
- `export-frames/03-secondary-broll.png`: secondary video visible on V2 inside its interval.
- `export-frames/04-after-broll.png`: overlays absent after their intervals.

This re-proves P1-D `FAIL-031` remains resolved for Media Bin placement and Canvas crop.

## Audio evidence

- Before music, 10–12 seconds: mean -17.0 dB, max -1.5 dB.
- Music active, 13–15 seconds: mean -17.1 dB, max -1.5 dB.
- Waveform images differ, proving the active audio mix changes while peak level remains controlled.

## Missing-source behavior

With the accepted image/audio files temporarily renamed inside the isolated project data root, source probes returned expected 404s and export terminated with `RENDER_INPUT_INVALID`. Accepted edits and asset identities remained intact. After restoration and a fresh project revision, export completed successfully.
