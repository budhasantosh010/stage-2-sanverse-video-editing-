# P1-F.0 Implementation Report — Primary-Footage Motion V1

## Objective

Make the main talking-head footage editable with position, uniform scale, rotation, crop, and bounded keyframes while preserving Sanverse's core promise:

```text
one accepted project
        ↓
one source-anchored motion identity
        ↓
one render plan
   ↙             ↘
browser preview   FFmpeg export
```

P1-F.0 ends before P1-F.1 and P1-F.2.

## Architecture

Primary-footage motion is not attached to a temporary clip ID. It is stored against the immutable source asset and source interval:

```text
motionId + assetId + sourceInterval + full transform/crop/tracks
```

That state survives split, trim, gap removal, and reorder because the composition translates surviving source moments into their current placements. A repair keeps the same `motionId`; Undo and Redo use ordinary change sets. The accepted decision is recorded in `DOCS/decisions/ADR-PRIMARY-FOOTAGE-MOTION.md`.

## Implemented

### Domain and history

- Added the closed, full-state `set-footage-motion` operation.
- Added stable `motionId`, immutable source anchoring, bounded transform/crop/tracks, overlap refusal, compatibility validation, folding, removal-by-default-state repair, and capability registration.
- Preserved deterministic behavior across split, trim, remove, gap, reorder, repeated source placements, Undo, Redo, and selective deactivation.
- Reused the existing exact-time keyframe and easing model: linear, cubic-Bezier, spring, and bounce.
- Fixed primary opacity at 1; P1-F.0 does not expose layer, mask, effect, or transition controls.

### Shared render authority

- Raised the render plan to `sanverse.render-plan/v6` with `footageMotions` on source segments.
- Compiled source-anchored motion only onto surviving source placements.
- Added one shared source-time evaluator consumed by browser preview and FFmpeg expression generation.
- Kept the original footage as FFmpeg input 0 and kept audio on the existing trim/concat path.
- Preserved overlay order above the transformed primary footage.

### Browser and Studio

- Added a Motion Inspector with position, scale, rotation, four-sided crop, presets, keyframes, easing, Apply, Reset, and Remove.
- Added a V1 Timeline `Motion` indicator with static framing or keyframe count.
- Added primary-footage Canvas move, scale, rotate, crop, keyboard nudge, detached movement, one commit on release, Escape cancellation, and Point-mode precedence.
- Kept one native `<video>` element and its native controls. A canvas draws only the transformed picture while motion is active.
- Removed the unrelated legacy overlay Canvas layer for video selection, so the UI no longer falsely says that primary footage has no Canvas controls.
- At narrow widths, precise handles are replaced with an explicit message while numeric Inspector controls remain usable.

### FFmpeg

- Added static and animated primary-footage scale, pan, crop, rotation, and source-time easing evaluation.
- Fixed an invalid empty-filter graph sequence discovered by the real export walkthrough.
- Skipped expensive per-pixel crop masking and rotation when crop and rotation are mathematically zero. The representative 30-second animated zoom/pan export completed in 53.3 seconds after this repair.

## Browser-found defects resolved

- `FAIL-034`: the graph emitted `[motion_video],format=...`, which FFmpeg parsed as an empty filter.
- `FAIL-035`: scale/pan-only motion still ran full-frame GEQ masking and expanded rotation, causing impractical render time.
- `UX-014`: the old overlay Canvas layer displayed a false “no canvas controls yet” message over the new primary-footage controls.

All three are resolved and regression-tested.

## Verification

Final automated gates:

- API: 239/239.
- Web: 484/484.
- Edit domain: 299/299.
- Intent domain: 27/27.
- Render contract: 65/65.
- Total: 1,114/1,114.
- All-workspace production build: passed.

Real Microsoft Edge evidence is in this directory. The walkthrough completed static motion, Canvas movement, Undo/Redo, Point precedence, animated keyframes, split, split Undo/Redo, export/download, tablet/mobile layouts, and Home cleanup with zero page errors, zero console errors, and zero failed HTTP responses.

## Export result

- H.264 High, 1920×1080, 30 fps, 901 frames.
- AAC-LC stereo, 48 kHz.
- Duration: 30.033008 seconds.
- Size: 17,261,471 bytes.
- SHA-256: `d83affb96647276b058404f828b8a7e8e2cfa9efeb10a3cba60bc948a91b2fcd`.
- Start/middle/end extracted frames were visually inspected and show the authored 100% → 118% → 120% zoom with preserved pan.

## Stop boundary

P1-F.0 is complete. No P1-F.1 or P1-F.2 implementation is included in this milestone.
