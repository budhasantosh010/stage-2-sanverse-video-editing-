# Gate T5 — Real Export Evidence

Date: 2026-08-10
Project revision: **13**
Export ID: `export_fef7f7b832bfe300cd01bbd340696591`

The visible Studio Export action completed successfully after the full T5 real-browser workflow.

## ffprobe result

- container: MP4 / ISO BMFF
- video: H.264 / AVC, **High** profile
- dimensions: **1280×720**
- sample aspect ratio: **1:1**
- pixel format: **yuv420p**
- frame rate: **30/1 fps**
- video frames: **900**
- audio: AAC, **LC** profile
- sample rate: **48,000 Hz**
- channels: **2, stereo**
- duration: **30.000000 s**
- file size: **16,338,429 bytes**
- SHA-256: `d7ef76f49d80021e2a8798519fb1f723e1cebbd15b2e892c927abc31edf6ea10`

The source fixture itself is 1280×720 at 30 fps, so this 1280×720 export is the truthful output for this single-source project; no upscaling claim is made.

The server-side export artifact and the downloaded MP4 have the same byte count and the same SHA-256 above.

Machine-readable metadata: `t5-export-metadata.json`.

Representative decoded frames:

- `t5-browser-screenshots/t5-export-frame-00.png`
- `t5-browser-screenshots/t5-export-frame-15.png`
- `t5-browser-screenshots/t5-export-frame-29.png`

The frames were visually inspected and contain the expected source image at the sampled moments. The complete exported MP4 is deliberately not committed.
