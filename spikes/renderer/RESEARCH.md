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

## Pinned package inspection

The npm package hyperframes@0.7.54 was downloaded as a tarball with lifecycle scripts disabled and inspected statically. Package metadata reports Apache-2.0, Node.js 22 or newer, the CLI entry point dist/cli.js, npm provenance, and no package-level install/postinstall script. Its dependency graph still includes native and browser tooling, so installing or executing it remains third-party code execution.

Static inspection verified these controls for a bounded local probe:

- HYPERFRAMES_NO_TELEMETRY=1
- HYPERFRAMES_NO_UPDATE_CHECK=1
- HYPERFRAMES_NO_AUTO_INSTALL=1
- HYPERFRAMES_BROWSER_PATH pointed to an existing browser

The package defaults telemetry to enabled, can check for and install updates, and can download a browser when one is unavailable. Therefore the probe must not execute until the owner explicitly accepts that external-code risk with the controls above.

## Safe local preparation evidence

The project-owned adapter converts the renderer-neutral static-nameplate request into offline HTML using HyperFrames' documented composition and clip attributes. It rejects non-local media paths, escapes visible user text, contains no CDN or wall-clock animation calls, and writes byte-reproducible HTML.

A direct system-Chrome screenshot confirmed the intended static geometry and text layout. This is only a layout sanity check; it does not prove HyperFrames linting, clip timing, audio behavior, MP4 output, performance, or determinism.
