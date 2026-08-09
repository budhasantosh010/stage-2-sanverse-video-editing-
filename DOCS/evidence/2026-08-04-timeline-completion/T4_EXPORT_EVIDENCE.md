# T4 Real Export Evidence

Date: 2026-08-10
Project revision: **7**
Export job: `job_376a64700126082fc9449ebd621a9b4f`
Export id: `export_c95293023a5970f76939eb996a7de3f2`
Idempotency key: `4d301d09c47e208093700832c4033e78ffb15ed5388aa1a5bf9e6eb6ab036175`

The actual Studio Export action created a succeeded local render job in one attempt.

## Output

- container: MP4
- video: H.264 High
- pixel format: yuv420p
- resolution: 1920 × 1080
- frame rate: 30/1 fps
- video frames: 901
- audio: AAC-LC
- channels: stereo / 2
- sample rate: 48,000 Hz
- duration: 30.033333 s (`durationMs=30033` in renderer result)
- size: 10,977,559 bytes
- SHA-256: `6d4c704fad146f312c63b047a7b53f53f14207ecf7aece7662bfa430123b9f7d`

The renderer SHA and an independent filesystem SHA match exactly.

Machine-readable probe: `t4-export-ffprobe.json`.

## Decoded-frame inspection

Representative decoded frames are under `t4-export-frames/`:

- `frame-5.png`: the primary image is horizontally translated, exposing intentional black canvas at the left.
- `frame-15.png`: the image is near the authored maximum horizontal displacement around the midpoint keyframe.
- `frame-25.png`: the image has moved back toward its original position.

All three frames decoded cleanly. The exposed black area is the expected result of moving the entire primary frame with Position X, not a missing-frame or render failure. No malformed geometry, decode corruption or unexpected black-frame failure was observed.

This real export therefore proves the accepted T4 primary-footage keyframes and Bezier easing reach the production FFmpeg path rather than existing only in Timeline presentation state.
