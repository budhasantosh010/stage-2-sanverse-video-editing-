import type { AnalysisProvenanceRefV1 } from './provenance.ts'
import type { NormalizedRectV1 } from './source.ts'

export const VIDEO_SHOT_TRANSITIONS = Object.freeze(['cut', 'fade', 'dissolve', 'unknown'] as const)
export type VideoShotTransitionV1 = (typeof VIDEO_SHOT_TRANSITIONS)[number]
export interface VideoShotV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly transitionIn: VideoShotTransitionV1
  readonly confidence?: number
  readonly provenance: AnalysisProvenanceRefV1
}

export const TEMPORAL_VISUAL_REGION_KINDS = Object.freeze(['talking-head', 'screen-demo', 'b-roll', 'product-demo', 'graphic-heavy', 'presentation', 'mixed', 'unknown'] as const)
export type TemporalVisualRegionKindV1 = (typeof TEMPORAL_VISUAL_REGION_KINDS)[number]
export interface TemporalVisualRegionV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly kind: TemporalVisualRegionKindV1
  readonly confidence: number
  readonly provenance: AnalysisProvenanceRefV1
}

export const SPATIAL_OBSERVATION_KINDS = Object.freeze(['face', 'speaker', 'screen-content', 'existing-text', 'important-object', 'safe-region', 'busy-region', 'unknown'] as const)
export type SpatialObservationKindV1 = (typeof SPATIAL_OBSERVATION_KINDS)[number]
export interface SpatialObservationV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly kind: SpatialObservationKindV1
  readonly bounds: NormalizedRectV1
  readonly confidence: number
  readonly provenance: AnalysisProvenanceRefV1
}

export const SEMANTIC_MOMENT_KINDS = Object.freeze([
  'question', 'claim', 'statistic', 'money', 'percentage', 'comparison', 'before-after', 'problem', 'solution', 'process', 'list', 'quote', 'definition', 'product-mention', 'feature', 'benefit', 'security', 'warning', 'achievement', 'social-proof', 'cta', 'chapter-transition', 'emphasis', 'unknown',
] as const)
export type SemanticMomentKindV1 = (typeof SEMANTIC_MOMENT_KINDS)[number]
export type SemanticImportanceV1 = 'low' | 'medium' | 'high'
export interface SemanticMomentV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly kind: SemanticMomentKindV1
  readonly transcriptSegmentIds: readonly string[]
  readonly subject?: string
  readonly value?: string | number
  readonly unit?: string
  readonly importance: SemanticImportanceV1
  readonly confidence: number
  readonly provenance: AnalysisProvenanceRefV1
}

export type VideoObservationKindV1 = 'audio-present' | 'speech-present' | 'silence' | 'source-note'
export interface VideoObservationV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly kind: VideoObservationKindV1
  readonly value?: string
  readonly confidence: number
  readonly provenance: AnalysisProvenanceRefV1
}
