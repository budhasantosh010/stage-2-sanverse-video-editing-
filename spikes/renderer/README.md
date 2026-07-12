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
- HyperFrames: pinned-package static inspection complete; local-only static composition adapter passes tests and a system-Chrome layout sanity check. HyperFrames itself has not been installed or executed.
- Hybrid static-nameplate adapter: the same validated request now produces a
  byte-reproducible local browser preview document and a safe FFmpeg argument
  list. Three measured preview generations and three measured exports were
  repeatable on this Windows machine. Parsed translations have exactly equal
  text/timing and a maximum 0.0005556 normalized placement delta caused by
  integer-pixel export rounding. Source bytes were unchanged.
- Adversarial valid text containing apostrophes, commas, colons, backslashes,
  and HTML-like characters round-trips through both inspected translations.
- Hybrid export rejects canonical path collisions, existing hard-link aliases,
  and output outside its explicit trusted work directory. FFmpeg is resolved
  to an existing executable rather than left as a shell-resolved command.

## First-loop decision

ADR-001 selects the minimum hybrid architecture for the first closed edit
loop: browser-native preview plus FFmpeg-native export behind renderer-neutral
contracts. This is a narrow decision for the static nameplate, not a claim
that one renderer will cover every future primitive.

HyperFrames remains a candidate for later expressive motion. Its package was
inspected and its generated layout received a system-Chrome sanity check, but
the HyperFrames runtime itself has not been installed or executed. Preview to
export pixel fidelity also remains unmeasured.

The broader comparison remains open for real-video/audio behavior, pixel
fidelity, approved motion primitives, and HyperFrames runtime evidence.

## Run tests

    python -m pytest spikes/renderer/tests -q

## Run the FFmpeg-native fixture

    python -m spikes.renderer.run_ffmpeg_native --request spikes/renderer/fixtures/static-nameplate-v1.json --work-dir spikes/renderer/work/ffmpeg-native-static --font C:/Windows/Fonts/arial.ttf --repeat 3

Generated media and raw measurement reports live under spikes/renderer/work and are intentionally ignored by Git. Sanitized commands, measurements, hashes, and limitations are committed under DOCS/runs.
