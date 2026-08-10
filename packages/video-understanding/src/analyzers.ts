import type { VideoSourceDescriptorV1 } from './source.ts'
import type { TranscriptSegmentV1 } from './transcript.ts'
import type { AnalysisProvenanceV1 } from './provenance.ts'
import type { SemanticMomentKindV1, SemanticMomentV1, SpatialObservationV1, TemporalVisualRegionV1, VideoObservationV1, VideoShotV1 } from './observations.ts'
import type { VideoUnderstandingDocumentV1 } from './document.ts'
import { VIDEO_UNDERSTANDING_SCHEMA_VERSION } from './document.ts'

export interface VideoAnalysisInputV1 {
  readonly source: VideoSourceDescriptorV1
  readonly transcript: readonly TranscriptSegmentV1[]
}
export interface ShotAnalyzerV1 { analyze(input: VideoAnalysisInputV1): Promise<readonly VideoShotV1[]> }
export interface VisualRegionAnalyzerV1 { analyze(input: VideoAnalysisInputV1): Promise<readonly TemporalVisualRegionV1[]> }
export interface SpatialAnalyzerV1 { analyze(input: VideoAnalysisInputV1): Promise<readonly SpatialObservationV1[]> }
export interface SemanticAnalyzerV1 { analyze(input: VideoAnalysisInputV1): Promise<readonly SemanticMomentV1[]> }

const percentPattern = /\b(\d+(?:\.\d+)?)\s*(%|percent\b)/iu
const moneyPattern = /(?:\$|USD\s*)(\d+(?:\.\d+)?)(\s*[kmb])?\b/iu
const questionPattern = /\?|\b(?:why|how|what if|what|when|where|who)\b/iu
const comparisonPattern = /\b(?:versus|vs\.?|compared to|whereas|while|separate from|different from)\b/iu
const processPattern = /\b(?:here(?:'s| is) how|how it works|step\s+(?:one|two|three|\d+)|first\b|second\b|third\b)/iu
const listPattern = /\b(?:first|second|third|three things|\d+\s+(?:ways|steps|reasons))\b/iu
const ctaPattern = /\b(?:subscribe|download|try it|try this|sign up|let us know|join us|get started)\b/iu
const securityPattern = /\b(?:security|permission|private|workspace stays separate|access boundary|scoped access)\b/iu
const featurePattern = /\b(?:feature|biggest change|shared project context|now (?:can|does|supports)|introducing)\b/iu
const benefitPattern = /\b(?:faster|saves? time|benefit|easier|less work|automatically)\b/iu

const semanticId = (segmentId: string, kind: SemanticMomentKindV1, index: number): string => `semantic:${segmentId}:${kind}:${index}`

export class DeterministicTranscriptSemanticAnalyzer implements SemanticAnalyzerV1 {
  readonly provenanceId: string
  constructor(provenanceId = 'provenance:semantic-rules:v1') { this.provenanceId = provenanceId }
  async analyze(input: VideoAnalysisInputV1): Promise<readonly SemanticMomentV1[]> {
    const moments: SemanticMomentV1[] = []
    for (const segment of input.transcript) {
      const candidates: Array<{ kind: SemanticMomentKindV1; value?: string | number; unit?: string; importance: 'low' | 'medium' | 'high'; confidence: number; subject?: string }> = []
      const percent = segment.text.match(percentPattern)
      if (percent) candidates.push({ kind: 'percentage', value: Number(percent[1]), unit: '%', importance: 'high', confidence: 0.98, subject: percent[0] })
      const money = segment.text.match(moneyPattern)
      if (money) candidates.push({ kind: 'money', value: money[0], unit: 'currency', importance: 'high', confidence: 0.97, subject: money[0] })
      if (questionPattern.test(segment.text)) candidates.push({ kind: 'question', importance: 'medium', confidence: segment.text.includes('?') ? 0.96 : 0.76 })
      if (comparisonPattern.test(segment.text)) candidates.push({ kind: 'comparison', importance: 'high', confidence: 0.86 })
      if (processPattern.test(segment.text)) candidates.push({ kind: 'process', importance: 'medium', confidence: 0.9 })
      else if (listPattern.test(segment.text)) candidates.push({ kind: 'list', importance: 'medium', confidence: 0.82 })
      if (securityPattern.test(segment.text)) candidates.push({ kind: 'security', importance: 'high', confidence: 0.91 })
      if (featurePattern.test(segment.text)) candidates.push({ kind: 'feature', importance: 'high', confidence: 0.84 })
      if (benefitPattern.test(segment.text)) candidates.push({ kind: 'benefit', importance: 'medium', confidence: 0.8 })
      if (ctaPattern.test(segment.text)) candidates.push({ kind: 'cta', importance: 'high', confidence: 0.95 })
      candidates.forEach((candidate, index) => moments.push(Object.freeze({
        id: semanticId(segment.id, candidate.kind, index), startTicks: segment.startTicks, endTicks: segment.endTicks,
        kind: candidate.kind, transcriptSegmentIds: Object.freeze([segment.id]), ...(candidate.subject ? { subject: candidate.subject } : {}),
        ...(candidate.value !== undefined ? { value: candidate.value } : {}), ...(candidate.unit ? { unit: candidate.unit } : {}),
        importance: candidate.importance, confidence: candidate.confidence, provenance: this.provenanceId,
      })))
    }
    return Object.freeze(moments)
  }
}

export interface VideoUnderstandingPipelineV1 {
  readonly semanticAnalyzer?: SemanticAnalyzerV1
  readonly shotAnalyzer?: ShotAnalyzerV1
  readonly visualRegionAnalyzer?: VisualRegionAnalyzerV1
  readonly spatialAnalyzer?: SpatialAnalyzerV1
}

export const analyzeVideoUnderstanding = async (input: VideoAnalysisInputV1, pipeline: VideoUnderstandingPipelineV1, provenance: readonly AnalysisProvenanceV1[]): Promise<VideoUnderstandingDocumentV1> => {
  const [semanticMoments, shots, visualRegions, spatialObservations] = await Promise.all([
    pipeline.semanticAnalyzer?.analyze(input) ?? Object.freeze([]),
    pipeline.shotAnalyzer?.analyze(input) ?? Object.freeze([]),
    pipeline.visualRegionAnalyzer?.analyze(input) ?? Object.freeze([]),
    pipeline.spatialAnalyzer?.analyze(input) ?? Object.freeze([]),
  ])
  const observations: readonly VideoObservationV1[] = input.transcript.length ? Object.freeze([{ id: 'observation:speech-present', startTicks: input.transcript[0]!.startTicks, endTicks: input.transcript.at(-1)!.endTicks, kind: 'speech-present', confidence: 1, provenance: 'provenance:system-derived:v1' }]) : Object.freeze([])
  return Object.freeze({ schemaVersion: VIDEO_UNDERSTANDING_SCHEMA_VERSION, source: input.source, transcript: Object.freeze([...input.transcript]), shots, visualRegions, spatialObservations, semanticMoments, observations, provenance: Object.freeze([...provenance]) })
}
