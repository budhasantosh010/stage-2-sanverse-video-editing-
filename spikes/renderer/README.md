# Renderer Feasibility Spike

This folder is an isolated G1 experiment. Its request format and adapters are not the production project model.

## Question

Which rendering architecture best supports fast non-editor previews, expressive motion, exact timing, deterministic exports, Windows development, and future deployment without coupling the domain engine to one renderer?

## Candidates

1. FFmpeg-native filters and composition
2. HyperFrames as the HTML/Chromium candidate
3. Hybrid browser-rendered design layers with FFmpeg media assembly

## Current evidence

- Common renderer-neutral static-nameplate contract: implemented and fail-closed for finite positive canvas/source values, supported kinds, canvas bounds, and source timing.
- FFmpeg-native static nameplate: rendered, probed, visually inspected, repeated three times with identical output hashes, and tested against hostile drawtext/font-path characters.
- HyperFrames: primary-source research complete; local package evaluation pending.
- Hybrid: pending.

## Run tests

    python -m pytest spikes/renderer/tests -q

## Run the FFmpeg-native fixture

    python -m spikes.renderer.run_ffmpeg_native --request spikes/renderer/fixtures/static-nameplate-v1.json --work-dir spikes/renderer/work/ffmpeg-native-static --font C:/Windows/Fonts/arial.ttf --repeat 3

Generated media and raw measurement reports live under spikes/renderer/work and are intentionally ignored by Git. Sanitized commands, measurements, hashes, and limitations are committed under DOCS/runs.
