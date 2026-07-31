# P1-C Export Review

Export file itself was kept in `tmp` only and removed after inspection. Metadata and representative frames are committed as evidence.

## Probe

- Container: MP4.
- Video: H.264 High, 1920×1080, 30 fps, yuv420p, BT.709.
- Video duration: 30.033008 seconds.
- Video frames: 901.
- Audio: AAC LC, 48 kHz, stereo.
- Audio duration: 30.016 seconds.
- Final file size: 15,054,265 bytes.

See `export-metadata.json` for the raw probe.

## Frame inspection

| Frame | Expected | Observed |
|---|---|---|
| `00-start.png` | No title before its interval | Clean source frame; no title |
| `04-title-enter.png` | Title partially visible during 0.5-second fade-in | Repaired title and subtitle visibly fading in |
| `06-title-keyframe.png` | Repaired title fully visible with authored transform | `P1-C Revised Title` and `Inspector proof` visible at scaled/offset placement |
| `08-title-exit.png` | Title still visible before the interval ends | Repaired title and subtitle visible |
| `29-end.png` | No title after its interval | Clean source frame; no title |

## Preview and export agreement

The selected title preview showed the repaired words, scale, X offset, left crop, entrance fade, and scale keyframes. The saved render plan contains the same title and visual state. The first export attempt exposed a renderer alpha bug and was rejected. After the FFmpeg repair, a fresh project was run through the complete browser workflow and exported again. The final frames above agree with the accepted project state.
