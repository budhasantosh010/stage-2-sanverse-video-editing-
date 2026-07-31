# P1-C — Inspector V1 Implementation Report

Date: 2026-07-31  
Status: technically complete; owner visual and interaction approval remains open  
Branch: `agent/g6-g8-local-alpha`  
Starting commit: `7aadf1b8c04bc032eeb77284d31043290f947e8e`

## Outcome

Studio now has one contextual Inspector driven by the selected Production Timeline item. It reads the current server-authoritative `EditProject`, keeps unapplied form values local, and turns each supported Apply into exactly one existing typed `EditOperation`. App sends that operation through the existing revision-fenced change-set route.

```text
Timeline selection
  -> immutable Inspector selection resolver
  -> local section draft
  -> pure existing-operation builder
  -> current domain validator
  -> App change-set request
  -> server-authoritative project revision
  -> shared preview and export compiler
```

The browser does not own a second project, history, proposal store, playhead, or video element.

## Implemented surfaces

- Explicit nothing-selected, gap, blocked, pending-proposal, and committed-item states.
- Human-readable media labels in Timeline and Inspector while stable IDs remain internal.
- Contextual header with item type, media name, timing, and state.
- Collapsible sections, section-level Apply and Reset, validation notices, and dirty-selection protection.
- `Stay`, `Discard and continue`, and Escape-to-stay behavior for unapplied drafts.
- Proposal Accept, Reject, and Open actions reuse the existing proposal authority.
- Clip enabled, gain, fades, and adjacent clip transition.
- Caption cue text and timing plus caption style.
- Title text, subtitle, placement, style, and timing.
- Callout label, region, and timing.
- Media-overlay asset, region, opacity, audio, source timing, and overlay source start.
- Music start, source start, gain, fades, and mute mapped to the existing `-60 dB` minimum.
- Shared visual-properties draft for transform, crop, layer, mask, effects, entrance and exit, easing, and Keyframes V1.
- Keyframes V1 supports property selection, enable or disable, previous and next, add at playhead, time, value, easing, and removal. No curve editor was added.

## Existing operation map

| Inspector action | Existing operation |
|---|---|
| Show or hide clip | `set-clip-enabled` |
| Clip gain and fades | `set-clip-audio` |
| Adjacent transition | `set-clip-transition` |
| Caption words and timing | `set-caption-cue` |
| Caption look | `set-caption-style` |
| Title repair | `set-title` |
| Callout repair | `set-callout` |
| B-roll or image repair | `set-media-overlay` |
| Music repair and mute | `set-music` |
| Transform, crop, layer, mask, effects, transitions, and keyframes | `set-visual-properties` |

Each Apply carries the complete state required by the existing operation contract and becomes one Undo step.

## Truthful capability boundaries

- Accepted nameplate text remains read-only because the domain has no `set-nameplate` operation. Visual properties remain editable.
- Source video clips have no current `visualId`; the Inspector does not invent transform or crop controls for them.
- Caption placement, safe margins, grouping, and independent line-width controls do not exist as accepted properties yet.
- Music has no independent end field; its audible end remains derived from the remaining song and finished video.
- Asset filenames are not added to `MediaAsset`. Studio passes derived display labels without changing project schema.

## No scope expansion

P1-C added no operation kind, schema version, API route, persistence format, runtime dependency, second timeline document, browser-owned project mutation, second history, second proposal store, second playhead, or second video. P1-D canvas direct manipulation was not started.

## Browser-found defects repaired

1. **Visual Apply footer intercepted other Apply buttons.** A sticky footer covered the Title section inside the short desktop Inspector. It now participates in normal flow; a CSS contract prevents sticky, fixed, z-index, or negative-margin regression.
2. **Proposal resolution actions were disabled.** Studio passed the broad timeline-busy flag into proposal controls. Proposal action busy state is now separate: a pending proposal pauses unrelated edits but does not disable Accept or Reject.
3. **Export entrance fade made written overlays invisible.** The FFmpeg adapter evaluated an enter fade at relative time zero, wrote permanent alpha zero, then asked FFmpeg to fade those already-transparent pixels in. Base visual evaluation now neutralizes transitions; FFmpeg applies the frame-timed fade once. A red/green filter-graph test and fresh exported frames prove the repair.

## Evidence summary

- Real Microsoft Edge walkthrough on `resources/test video/test-30s.mp4`.
- Revision chain: `0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8`; proposal rejection remained at revision `8`.
- Page errors: 0.
- Console errors: 0.
- Failed HTTP responses: 0.
- One video element and five semantic lanes remained authoritative.
- No page-level horizontal overflow at 1440×900, 1024×768, or 390×844.
- Export downloaded, probed, and inspected at five frames.
- Final suites: web 380/380, edit-domain 265/265, API 234/234, render-contract 51/51, intent-domain 27/27.
- All-workspace production build passed.

See `browser-walkthrough.md`, `test-results.md`, `export-frame-review.md`, `browser-report.json`, `export-metadata.json`, `render-plan.json`, screenshots, and extracted frames in this directory.
