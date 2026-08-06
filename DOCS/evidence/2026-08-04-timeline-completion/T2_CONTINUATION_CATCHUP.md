# T2 CONTINUATION CATCH-UP

Written before new T2 code at required baseline
`e257e0c098da63f76e4310aae101153f49586965` on
`agent/g6-g8-local-alpha`.

This document records the executable project as it exists now. It deliberately
supersedes older handoffs that mention `d60e7bbc`, 1,145 tests, or P1-F.1 not
started. Those are historical only.

## 1. Verified baseline

```text
branch       agent/g6-g8-local-alpha
HEAD         e257e0c098da63f76e4310aae101153f49586965
remote       e257e0c098da63f76e4310aae101153f49586965
worktree     clean
project      sanverse.project/v4
render plan  sanverse.render-plan/v7
tests        2,215 passing
build        exit 0
```

No reset, rebase, force-push, or migration was performed during catch-up.

## 2. Exact current project shape

`EditProject` is still one closed `sanverse.project/v4` document:

```text
EditProject
├── schemaVersion
├── projectId
├── revision
├── timescale = 1,440,000 ticks/second
├── assets[]
├── composition
├── changeSets[]
├── redoStack[]
├── issuedChangeSetIds[]
└── extensions
```

`project.composition` is the immutable imported composition. The visible and
exported result is `effectiveComposition(project)`, produced by replaying the
one accepted history. There is no second Timeline document.

A composition is still tracks containing `Clip` values. One V1 track may now
hold clips from several video assets. A clip currently owns:

```text
clipId
assetId
sourceRange
compositionStart
enabled
timeTransform
  playbackRate { numerator, denominator }
  direction forward | reverse
  maintainAudioPitch
gainDb
fadeIn
fadeOut
pan
```

`timeTransform` and `pan` are optional on stored legacy input and become their
documented defaults during validation. This is why speed and pan did not require
a project migration.

The semantic presentation order remains exactly:

```text
V2  overlays / B-roll
V1  primary picture sequence
C1  captions
A1  linked embedded dialogue
A2  music / additional audio
```

## 3. Exact render-plan shape and version

The current render contract is `sanverse.render-plan/v7`.

```text
RenderPlan
├── schemaVersion
├── projectId
├── projectRevision
├── compositionId
├── width / height
├── optional framing
├── durationTicks
├── sources[]
├── segments[]
├── overlays[]
├── visuals[]
└── music[]
```

Each `SourceSegmentNode` currently carries:

```text
nodeId, interval, assetId, sourceStartTicks
videoEnabled, audioEnabled
footageMotions
gainDb, fadeInTicks, fadeOutTicks
videoFadeInTicks, videoFadeOutTicks
transitionAudioFadeInTicks, transitionAudioFadeOutTicks
optional sourceDurationTicks
optional playbackRateNumerator / playbackRateDenominator
optional direction
optional maintainAudioPitch
optional pan
optional transitionColor
```

The optional retiming/pan/transition-color fields are written only when their
meaning differs from the old default. An untouched project therefore compiles
to the old byte-identical plan and keeps its export cache entry.

The current compiler maps accepted `set-clip-transition` operations into ramps
on adjacent source segments. It does not yet carry a first-class two-source
transition node. Freeze segments and linked-audio windows also do not exist in
v7.

## 4. Current clip-time authority

`packages/edit-domain/src/clip-time.ts` is the sole retiming arithmetic.

Canonical rate:

```text
source ticks consumed / composition ticks elapsed
```

It is a reduced rational fraction, never a stored decimal. Supported range is
0.1x through 16x. Terms are capped at 10,000; Rate Stretch approximation uses a
continued fraction with a default maximum term of 1,000 and reports absolute
error.

The authoritative functions already include:

- `clipCompositionDurationTicks`;
- `anchoredCompositionDuration`;
- composition-to-source and source-to-composition mapping;
- edge-based half-up rounding;
- `rateThatFits` / the existing target-duration rate planner;
- reverse-aware source mapping;
- speed-aware split, trim, ripple, preserve-start, source anchoring, captions,
  overlays, and linked A1 duration.

No new rate model is required for Rate Stretch or Fit Source to Duration.

## 5. Current main-video Preview path

Studio still owns exactly one mounted `HTMLVideoElement`.

`segment-playback.ts` projects render-plan segments into one playback list. The
shared playhead stays on composition time. The element uses source time and is
reconciled by the exact rational mapping.

Current execution path:

1. `compilePreviewPlan(editProject)` uses the same render compiler as export.
2. `playbackSegments(plan)` creates source stretches.
3. `sourceTimeFor`, `advancePlayback`, and `assetAt` decide source and seek.
4. The one element changes `src` only when the active asset changes.
5. `playbackRateAt` sets the browser decimal rate at the last possible step.
6. `maintainPitchAt` sets `preservesPitch` or `webkitPreservesPitch` where the
   browser supports it.
7. Deliberate holes pause the element and advance the one composition clock.
8. One requestVideoFrameCallback loop, with media-event fallback, drives the
   shared playhead and footage-motion projection.

Reverse intent is represented, but `unpreviewableSegmentIndexes` currently
refuses it because no truthful derived reverse artifact exists. Negative browser
playback rate is not used.

## 6. Current Preview audio ownership

A1 currently comes from the same main video element as V1. The render plan tells
Preview whether the embedded audio is enabled, but the browser does not yet have
a separate composition-audio mixer for gain, fades, pan, overlapping linked
windows, or A2 music.

No `AudioContext`, `createMediaElementSource`, or managed composition-audio graph
exists in the current web code. Therefore:

- speed and browser pitch preservation apply to embedded A1 through the one main
  video element;
- current gain/fade/pan values are authoritative in project/render/export but are
  not yet fully reproduced by a browser mixing graph;
- A2 is shown and editable on the Timeline and Inspector and is exported, but is
  not audibly mixed into Preview;
- J/L cuts would require one shared composition-audio authority, not one context
  per clip and not a second playback clock;
- when that graph is active, embedded element audio must be muted exactly once to
  prevent duplicate sound.

This is a parity gap T2 must close rather than hide.

## 7. Current horizontal zoom authority

There is one `TimelineViewportState`:

```text
pixelsPerSecond
scrollLeftPx
viewportWidthPx
```

Bounds are 10–1,000 px/s; default is 100 px/s. Ruler, playhead, clips, gaps,
markers, overlays, captions, audio, snap guides, selection, ghosts, filmstrips,
and waveforms already consume this same state.

Existing horizontal controls call `changeZoom`, which uses
`zoomTimelineAtAnchor`. Fit uses `fitTimelineToViewport`. The existing anchor
math preserves the timeline instant under a supplied viewport X and clamps
scroll afterward. Current toolbar has Zoom Out, Fit, Zoom In, and a numeric
`px/s` output. It has no range slider, no discrete perceptual mapping, and no
persisted horizontal zoom yet.

T2 will add the requested pure `calculateHorizontalZoomScroll` contract while
keeping this one viewport state as authority.

## 8. Current track-height authority

T1 presentation state is
`sanverse.timeline-track-presentation/v1`, stored per project in localStorage.

It already owns:

- compact 34 px;
- standard 56 px;
- tall 96 px;
- custom heights bounded 24–240 px;
- collapsed/folded tracks at a fixed 14 px;
- Fit Tracks;
- exact per-project persistence.

`trackHeightPx` chooses the stored base height or responsive fallback. No global
vertical multiplier exists. T2 must add one multiplier without overwriting these
base settings. Collapsed tracks remain fixed at 14 px.

Track height and zoom are presentation only. They must create no operation,
revision, history entry, render-plan change, or export-identity change.

## 9. Current derived-media infrastructure and bounds

Derived media is outside `EditProject` under the existing project-owned cache.
The browser plans visible work; the API resolves trusted assets and runs FFmpeg.

Current server bounds:

```text
frame jobs concurrently       2
waveform jobs concurrently    1
waiting queue                 64
timeout per job           20,000 ms
cache entries/project      4,000
sweep cadence               200 writes
maximum artifact size         4 MiB
```

The coordinator deduplicates identical in-flight keys, aborts abandoned work,
kills timeouts, exposes diagnostics, and keeps frame/waveform lanes separate.
The cache uses hashed names, project containment, link checks, temporary writes,
flush + atomic rename, corrupt-entry deletion/regeneration, LRU-style access
touching, and bounded sweeps.

Current request kinds are frame thumbnails and waveform blocks. Reverse preview,
freeze stills, two-source transition previews, and normalization evidence require
new closed derived-media request/result kinds behind this same coordinator and
security boundary. They must not be eagerly generated for the whole project.

## 10. Current transition model

The one accepted authority remains `set-clip-transition`.

Current fields:

```text
clipId          outgoing clip
nextClipId      immediately adjacent clip
style           none | dip-to-black | dip-to-white
duration        one ramp length, max 2 seconds
audio           cut | fade-through-silence
```

A transition does not consume composition time. `none` removes the transition.
The compiler maps the operation to segment fade-in/fade-out fields and optional
white color. Preview and FFmpeg both support the two single-source dip styles.

There is currently no chooser, numeric duration input, Timeline duration handle,
alignment, typed two-source parameters, source-handle model, or derived
transition-preview artifact.

## 11. Current source-handle availability

Every video asset carries immutable duration and each clip carries an exact
half-open `sourceRange`. Therefore available handles are derivable without a new
stored field:

```text
earlier handle = sourceRange.start
later handle   = asset.duration - sourceRange.end
```

Speed and reverse mapping must be applied when converting requested transition
or linked-audio composition time into source time. Current transition validation
only checks adjacency and duration against visible clip lengths; it does not yet
validate two-source handles.

## 12. Current A1 and A2 behavior

A1 is a linked view of the primary clip and shares its clip identity. Existing
split, trim, move, remove, reorder, speed, reverse intent, enabled state, gain,
fades, and pan are stored on that one clip. A1 cannot currently have independent
visible composition edges.

A2 remains independent `add-music` operations anchored to the final composition
clock. It has source start, composition interval, gain, and fades, is compiled
into `music[]`, mixed by FFmpeg, and remains unaffected by source-anchored cuts.
It is not currently audible in browser Preview.

Freeze must create an intentional silent A1 interval. J/L cuts must retain one
V1/A1 identity while allowing only the linked audio window to differ.

## 13. Which T2 work changes which layer

### UI/presentation only

No project or render schema change:

- horizontal zoom slider and popover;
- vertical zoom multiplier and persistence;
- horizontal/vertical scroll anchoring;
- Rate Stretch pointer draft and handle;
- gain-line drag;
- fade-handle drag;
- complete pan control;
- transition chooser shell for styles already implemented;
- transition numeric/handle editing when it still maps to the existing operation;
- placement menus and ghosts once backed by pure planners.

### Existing operation / planner only

No second operation family:

- Rate Stretch and Fit Source to Duration reuse `set-clip-time-transform`;
- gain/fades/pan and normalization acceptance reuse `set-clip-audio`;
- all transition edits reuse `set-clip-transition`;
- placement extensions produce existing validated operations in one atomic plan;
- Place on Top reuses the current V2 overlay operation and current single-lane
  collision truth.

### Derived media required

Outside EditProject:

- loudness normalization evidence;
- reverse Preview artifact;
- exact freeze-frame still resource;
- two-source transition Preview artifacts;
- real pitch-analysis fixtures/evidence;
- owner-reviewable browser recording.

### Project schema change required

Freeze frame and linked-audio windows cannot be represented truthfully by the
current `Clip` shape.

Preferred coordinated T2 migration:

- move `sanverse.project/v4` to one deliberate next version;
- introduce a discriminated primary segment representation or an equally closed
  freeze representation;
- add an optional validated linked-audio window to ordinary primary clips;
- migrate every v4 clip to the ordinary-video branch with absent/default linked
  audio;
- preserve IDs, source ranges, composition starts, time transforms, audio state,
  groups, markers, history, and extensions;
- prove old projects compile to the same output and duration.

### Render-plan bump required

The remaining shape changes need one coordinated bump from
`sanverse.render-plan/v7`:

- a freeze segment must be distinguishable from a native source segment and a
  true gap;
- an independent linked-audio window must be expressible;
- two-source transition semantics need a closed node/edge contract rather than
  overloading single-source fade fields;
- reverse intent may continue using optional segment fields, while its Preview
  artifact remains derived.

The version should move exactly once for the coordinated remaining T2 shape.
Old projects migrated without these features must render equivalently, even
though the version bump intentionally changes export identity because the
renderer contract has changed.

## 14. Exact migration consequences

1. Existing v4 projects must open deterministically and become the new project
   shape with ordinary video clips only.
2. No old project receives a freeze, linked-audio offset, normalization gain,
   reverse direction, or new transition by migration.
3. Existing speed/pan/dip fields retain exact values.
4. Existing operations remain replayable; new optional fields default to old
   behavior.
5. Old projects must preserve duration, source mapping, track order, rendered
   frames/audio, group/marker behavior, and accepted history.
6. Unknown future keys continue to refuse under the closed-contract policy.
7. Presentation preferences are not migrated with project data.
8. Derived artifacts are invalidated by request/version keys, never written into
   the project.
9. Export identity changes only for rendered contract/output changes; zoom,
   folding, track height, groups, and notes remain outside it.

## 15. Implementation order fixed by this catch-up

1. Dual-axis zoom: presentation-only, no schema change.
2. Rate Stretch/direct audio/normalization: reuse current operations and derived
   analysis; no second speed or audio authority.
3. Reverse: derived Preview plus deterministic export; accepted intent already
   exists.
4. One coordinated project/render migration for freeze and linked-audio windows.
5. Complete transitions and placement planners on the migrated shape.
6. Long-form/resource/browser/export proof and final verified T2 closure.

No T3, other panel expansion, AI execution, track-topology change, or Studio
layout change is permitted in this program.