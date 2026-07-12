# Renderer Candidate Research

Research checked on 2026-07-12. Candidate selection is not the final renderer decision.

## OpenDesign and HyperFrames

OpenDesign currently presents HyperFrames as its first-class video path. Its public description says agents author HTML, CSS, and seekable animation timelines; headless Chrome captures frames and FFmpeg encodes the MP4.

Primary sources:

- https://github.com/nexu-io/open-design
- https://github.com/heygen-com/hyperframes
- https://github.com/heygen-com/hyperframes/blob/main/docs/guides/open-design-hyperframes.md
- https://github.com/heygen-com/hyperframes/blob/main/LICENSE

Verified properties from those sources:

- Plain HTML authoring with no React requirement
- Frame-seekable browser capture rather than wall-clock timing
- Headless Chrome plus FFmpeg rendering
- Node.js 22+ and FFmpeg requirements
- Apache License 2.0
- CLI support for lint, preview, and render

## Current inference

HyperFrames is a serious implementation of the planned HTML/Chromium candidate and should be measured directly rather than re-creating a weaker browser renderer from scratch.

That does not prove it should own the production renderer. Talking-head editorial operations, preview latency, existing-video compositing, audio, long-form scaling, and integration boundaries still require measured comparison with FFmpeg-native and hybrid paths.
