import type { VideoSourceDescriptorV1 } from './source.ts'
import type { TranscriptSegmentV1 } from './transcript.ts'
import type { AnalysisProvenanceV1 } from './provenance.ts'
import type { SemanticMomentV1, SpatialObservationV1, TemporalVisualRegionV1, VideoObservationV1, VideoShotV1 } from './observations.ts'

export const VIDEO_UNDERSTANDING_SCHEMA_VERSION = 'sanverse.video-understanding/v1' as const

export interface VideoUnderstandingDocumentV1 {
  readonly schemaVersion: typeof VIDEO_UNDERSTANDING_SCHEMA_VERSION
  readonly source: VideoSourceDescriptorV1
  readonly transcript: readonly TranscriptSegmentV1[]
  readonly shots: readonly VideoShotV1[]
  readonly visualRegions: readonly TemporalVisualRegionV1[]
  readonly spatialObservations: readonly SpatialObservationV1[]
  readonly semanticMoments: readonly SemanticMomentV1[]
  readonly observations: readonly VideoObservationV1[]
  readonly provenance: readonly AnalysisProvenanceV1[]
}
