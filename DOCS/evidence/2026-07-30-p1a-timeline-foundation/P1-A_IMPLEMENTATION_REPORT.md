# P1-A IMPLEMENTATION REPORT

Branch: `agent/g6-g8-local-alpha`
Start commit: `d48aabf34fdadbd6899807fa0c6de0c854a5dc5f`
End commit: this focused P1-A commit
Working tree at report drafting: reviewed before commit

## Objective

Build the pure deterministic timeline presentation foundation that P1-B can render, without changing production UI, project schema, renderer, persistence, history, or editing authority.

## Implemented

- immutable timeline contract;
- one deterministic `EditProject → TimelineViewModel` projection;
- semantic overlay, video, caption, dialogue, and music lanes;
- deterministic per-domain-video-track lanes when more than one canonical video track exists;
- derived gaps;
- accepted/effective clips, folded captions and overlays, and accepted music;
- detached pending proposal items and stale-proposal diagnostics;
- blocked and unsupported-operation diagnostics;
- stable IDs that survive overlay/caption repairs by using stable domain entity IDs;
- pure bounded viewport/zoom/scroll math;
- pure gesture adapter that emits only existing typed operations;
- representative 50-video/100-caption/20-overlay/1-music fixture;
- focused tests and documentation.

## Not implemented

No React timeline, ruler, clip blocks, waveform UI, drag interactions, keyboard timeline UI, Studio integration, CSS, project schema, renderer change, application-service call, persistence model, new operation kind, or P1-B work.

## Files created

- `apps/web/src/features/timeline/timeline-contract.ts`
- `apps/web/src/features/timeline/timeline-view-model.ts`
- `apps/web/src/features/timeline/timeline-viewport-state.ts`
- `apps/web/src/features/timeline/timeline-gesture-adapter.ts`
- `apps/web/src/features/timeline/timeline-test-fixtures.ts`
- three focused test files
- `apps/web/src/features/timeline/index.ts`
- this evidence folder

## Canonical authority used

```text
EditProject
  → evaluateProject once
      ├─ effective composition
      ├─ active accepted operations
      ├─ blocked records
      ├─ foldCaptionOperations
      └─ foldOverlayOperations
  → TimelineViewModel (presentation only)
```

Source-anchored placement uses the domain's `placeSourceSpan`. Time remains safe integer project ticks at timescale 1,440,000. Gaps are presentation items only and are never persisted.

## Timeline contract

Lane kinds: `overlay`, `video`, `caption`, `dialogue`, `music`.

Item kinds: `clip`, `gap`, `caption`, `nameplate`, `title`, `callout`, `media-overlay`, `music`.

States: `committed`, `proposed`, `blocked`.

Diagnostics: placement unavailable, blocked operation, unsupported operation, stale proposal, outside composition, invalid duration, duplicate presentation ID.

## Projection behavior

- Video uses effective composition clips, not the imported composition.
- Each video clip has a linked dialogue mirror; no new audio track or asset is created.
- Gaps are derived between non-overlapping video items; no zero, negative, or trailing invented gap is emitted.
- Captions use folded effective sets and authoritative source-to-composition placement. Split surviving placements become separate deterministic items; deleted placements produce diagnostics, never guessed timestamps.
- Nameplates and folded title/callout/media overlays use authoritative placement and stable entity identity.
- Music uses accepted operation placement and actual playable duration bounded by project and audio asset duration. Unused assets remain Media-only.
- Pending work never enters accepted history. A stale proposal is omitted and diagnosed.
- Blocked operations are never shown as successful committed output. Timing is not invented.

## Stable IDs and sorting

Clip: `clip:<clipId>`; dialogue: `dialogue:<clipId>`; gap: `gap:<laneId>:<start>:<duration>`; caption: stable caption-set/cue plus placement; overlays/music: stable entity ID plus placement; proposal: proposal and operation IDs plus placement.

Lanes sort by order then ID. Items sort by start, duration, kind rank, then stable ID. Diagnostics sort by history/proposal order, code, then message. Canonical arrays are copied before sorting.

## Viewport

Zoom bounds: 8–640 pixels/second; default 80. Invalid finite contracts fail safely. Tick-to-pixel is derived only. Pixel-to-tick uses nearest tick; visible start uses floor and visible end uses ceil. Scroll is clamped. Anchor time remains under the pointer/playhead during zoom. Zero-duration and zero-width cases return bounded safe values.

## Gesture matrix

See `gesture-matrix.md`. Every gesture maps through existing builders, existing validation, and a pure domain dry run. Pending proposal and export-in-progress states refuse direct edits. The adapter never applies or persists.

## Verification

- Web timeline and existing helper tests: **71/71 passed**.
- Affected edit-domain tests: **77/77 passed**.
- All-workspace build: **passed**.
- Production bundle: unchanged from P0-E—104 modules, CSS 48.47/8.78 gzip, JS 374.08/106.78 gzip.
- Large fixture: passed deterministic, count, ordering, identity, and immutability checks.

## Third-party provenance

No external code copied. OpenCut Decision C remains unchanged; the viewport math was implemented directly behind Sanverse contracts.

## Issue registry

P0-E owner-layout gate `UX-007` is resolved by the owner's approval linked to `d48aabf…`. No new open product issue was found. `FAIL-021` remains monitoring; `FEATURE-001` remains planned. Implementation-time tool/type mistakes are fully recorded in `test-results.md` with what/where/how/attempt/status/one-line solution.

## Production UI

Confirmed unchanged. P1-A modules are not imported by `StudioScreen`; unchanged bundle output supports that claim. Browser screenshots are not P1-A evidence because no visible UI changed.

## Exact next task

P1-B — Production Timeline V1.

## Stop confirmation

P1-B was not started.