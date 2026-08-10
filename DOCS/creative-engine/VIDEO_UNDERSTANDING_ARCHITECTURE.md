# Sanverse Video Understanding — B1 Architecture

Date: 2026-08-10
Status: B1 implementation architecture

## Purpose

B1 gives the Creative Engine a typed, traceable description of what exists in source material. It observes; it does not choose final graphics or mutate Motion Graph state.

```text
source descriptor + timed transcript
              │
              ▼
      analyzer boundaries
      ├─ semantic
      ├─ shots
      ├─ visual regions
      └─ spatial observations
              │
              ▼
sanverse.video-understanding/v1
              │
              ▼
      B0 Creative Direction
```

## Authority boundaries

- Time uses the existing `@sanverse/edit-domain/time` project/source tick authority. B1 owns no milliseconds timescale.
- Media bytes and local filesystem paths are not part of the portable understanding document. `sourceId` is the portable source identity.
- Normalized spatial coordinates are source-resolution independent: x/y/width/height each use 0..1 and the rectangle must remain inside the source frame.
- Confidence is finite 0..1 metadata. It is not claimed to be calibrated across analyzers.
- Provenance is required for meaningful observations so future debugging can answer where an observation came from.
- Shot coverage may contain gaps. B1 refuses overlapping shots but does not invent missing boundaries.
- Visual regions may overlap because picture-in-picture/mixed layouts can truthfully contain more than one visual mode.

## V1 document

`VideoUnderstandingDocumentV1` contains source descriptor, timed transcript segments with optional word timing, shots, temporal visual regions, normalized spatial observations, closed semantic moments, generic source observations and provenance records.

Semantic V1 includes question, claim, statistic, money, percentage, comparison, before-after, problem, solution, process, list, quote, definition, product-mention, feature, benefit, security, warning, achievement, social-proof, CTA, chapter-transition, emphasis and unknown.

## Analyzer boundary

The package defines vendor-neutral `ShotAnalyzerV1`, `VisualRegionAnalyzerV1`, `SpatialAnalyzerV1` and `SemanticAnalyzerV1`. An analyzer may be absent without invalidating the rest of the document. No provider SDK, network call, OpenCV, TensorFlow or large vision runtime is required by B1.

The offline baseline `DeterministicTranscriptSemanticAnalyzer` conservatively detects explicit percentages, money, questions, comparisons, process/list language, CTA language, security language, feature language and clear benefits. Returning no semantic moment is preferred over fabricating a weak match.

## Ingestion and validation

B1 supports structured JSON transcript input plus SRT/VTT parsing. Parser clock strings are immediately converted into canonical exact ticks. Normalization collapses whitespace and normalizes stable IDs without rewriting transcript meaning.

Validation fails closed on duplicate IDs, invalid source geometry/frame rate, negative/fractional/reversed/out-of-source ticks, illegal word timing, unknown closed enum values, confidence outside 0..1, missing provenance, invalid normalized bounds, semantic references to missing transcript segments and overlapping shots.

## B1 → B0 traceability

B0 directives and proposal items may carry `sourceObservationIds`. These IDs remain opaque to the Creative Direction package: B0 validates stable bounded reference syntax without importing B1. The integration seam owns cross-document existence checks. This keeps dependency direction one-way.

```text
transcript:1
   ↓
semantic:transcript:1:percentage:0
   ↓ sourceObservationIds
CreativeDirective
   ↓
CreativeProposal placement
```

## Development UI

The internal Creative Direction Lab now includes a Source Understanding panel with SHOTS, VISUAL, TRANSCRIPT, SEMANTICS and SPATIAL lanes. Clicking an observation reveals type, time range, confidence, provenance, transcript references, semantic value and spatial bounds when relevant. This is developer tooling, not production `apps/web` navigation.

## Deferred intentionally

B1 does not implement B2 component retrieval/ranking, B3 automatic placement, autonomous creative direction, production media integration, tracking/segmentation, or vendor-specific multimodal inference.
