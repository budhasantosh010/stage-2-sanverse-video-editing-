export const ANALYSIS_PROVENANCE_KINDS = Object.freeze([
  'manual', 'transcript-rule', 'fixture-analyzer', 'shot-analyzer', 'vision-model', 'language-model', 'imported-metadata', 'system-derived',
] as const)
export type AnalysisProvenanceKindV1 = (typeof ANALYSIS_PROVENANCE_KINDS)[number]
export type AnalysisProvenanceRefV1 = string

export interface AnalysisProvenanceV1 {
  readonly id: string
  readonly kind: AnalysisProvenanceKindV1
  readonly analyzerId: string
  readonly evidenceIds?: readonly string[]
  readonly detail?: string
}
