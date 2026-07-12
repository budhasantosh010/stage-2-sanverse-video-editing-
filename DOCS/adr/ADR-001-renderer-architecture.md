# ADR-001: Renderer architecture for the first edit loop

- Status: Accepted for the static-nameplate first loop
- Date: 2026-07-13
- Goal: G1
- Requirements: REQ-003, REQ-004, REQ-005, REQ-007, REQ-009
- Decisions extended: DEC-005, DEC-006

## Context

The first closed edit loop needs a responsive browser preview and a
reproducible MP4 export without coupling the canonical edit action to React,
an AI provider, or one rendering SDK. The current representative edit is one
static nameplate over a five-second synthetic talking-head fixture.

Three approaches were considered:

1. FFmpeg-native preview and export
2. HTML/Chromium preview and export through HyperFrames
3. Browser-native preview with FFmpeg-native export

## Decision

Use the minimum hybrid architecture for the first static-nameplate loop:

- renderer-neutral, validated edit data is the source of truth;
- the browser renders the interactive preview from that data;
- an FFmpeg adapter renders the approved export from the same data;
- preview and export adapters remain replaceable behind explicit contracts;
- production code must not accept HTML or FFmpeg command text from AI output;
- FFmpeg execution uses argument arrays with no shell invocation;
- source media remains immutable.

This decision does not select a permanent renderer for all future editing
primitives. Re-evaluate when G6 introduces expressive motion, springs,
transitions, or composition behavior outside the demonstrated FFmpeg envelope.

## Evidence

### FFmpeg-native

The committed 2026-07-12 run rendered and probed the static fixture. Three
outputs had identical hashes, averaged 0.7155 seconds for the edit render, and
preserved 1280 x 720, 30 fps, and five-second duration. That run did not test
audio, real footage, motion, or browser preview fidelity.

### HTML/Chromium and HyperFrames

The pinned HyperFrames package received static inspection. A project-owned
offline composition generator passes contract and escaping tests, and a
system-Chrome screenshot supplied a static layout sanity check.

HyperFrames itself has not been installed or executed. Its lint, render,
timing, audio, performance, determinism, and deployment behavior are therefore
unverified and cannot support choosing it for the first production loop.

### Hybrid

The 2026-07-13 run used the same validated fixture for both browser markup and
FFmpeg export arguments. Three preview documents had identical hashes and
averaged 0.0015684 seconds to generate. Three exports had identical hashes and
averaged 0.9173232 seconds. The output probed as 1280 x 720, 30 fps, and five
seconds. Source hashes were unchanged.

The hybrid test proves contract-level correspondence for text, placement, and
timing. It does not prove pixel-identical preview and export.

## Why this is the minimum supported choice

- It uses the existing browser already required by the web product for the
  low-latency interactive preview.
- It uses the already measured FFmpeg adapter for the approved file export.
- It introduces no HyperFrames runtime or browser-capture dependency before
  those costs are justified by a motion primitive.
- It keeps the canonical action independent from both preview and export.
- It makes divergence explicit and testable instead of claiming unmeasured
  preview fidelity.

## Consequences

Positive:

- The first loop can proceed without an additional third-party runtime.
- Preview interaction stays in the web application.
- Export remains deterministic for the measured fixture.
- Either adapter can later be replaced without changing edit history.

Costs and risks:

- Browser CSS and FFmpeg filters are two implementations of visual semantics.
- Pixel drift is possible and remains unmeasured.
- Every supported primitive needs contract tests and preview/export comparison
  evidence before it can be called faithful.
- FFmpeg drawtext is not sufficient evidence for advanced motion or every text
  layout case.

## Required follow-up gates

Before the first static nameplate is called complete:

1. Run preview-versus-export comparison on the integrated browser surface.
2. Verify a representative owner MP4, including audio preservation.
3. Verify accepted placement, timing, undo/redo, and export from recorded actions.
4. Fail visibly when preview or export cannot honor the action contract.

Before adopting HyperFrames:

1. Obtain explicit approval to install and execute the pinned dependency.
2. Measure lint, render, seek, audio, output, repeatability, and Windows behavior.
3. Compare its deployment and security cost against a demonstrated motion need.

## Revisit triggers

- A representative edit shows unacceptable preview/export drift.
- Audio, font shaping, performance, or deployment fails its acceptance gate.
- A new primitive cannot be represented faithfully by the current adapters.
- Measured HyperFrames evidence materially reduces complexity or improves
  fidelity for approved motion requirements.
