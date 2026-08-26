import { creativeValidationOk, creativeRefusal, type CreativeEditabilityV1, type CreativeValidationResultV1 } from '@sanverse/motion-contract'

export const EXTERNAL_RIGHTS_CLASSES_V1 = Object.freeze(['owner-authored','permissive-oss','cc-licensed','commercial-stock','reference-derived','restricted-runtime','unknown'] as const)
export type ExternalRightsClassV1 = (typeof EXTERNAL_RIGHTS_CLASSES_V1)[number]
export const EXTERNAL_MOTION_SOURCE_KINDS_V1 = Object.freeze(['svg','lottie','rive','react-svg','remotion','procedural','shader','three-webgl','alpha-video','aep','mogrt','foreign'] as const)
export type ExternalMotionSourceKindV1 = (typeof EXTERNAL_MOTION_SOURCE_KINDS_V1)[number]
export type ExternalEditabilityV1 = CreativeEditabilityV1

export interface ExternalMotionProvenanceV1 {
  readonly schemaVersion: 'sanverse.external-motion-provenance/v1'
  readonly sourceKind: ExternalMotionSourceKindV1
  readonly creatorName?: string
  readonly sourceName: string
  readonly sourceUrl?: string
  readonly sourceVersion?: string
  readonly rightsClass: ExternalRightsClassV1
  readonly licenseName?: string
  readonly licenseEvidence?: string
  readonly attributionRequired: boolean
  readonly attributionText?: string
  readonly reusableLibraryAllowed: boolean
  readonly projectUseAllowed: boolean
  readonly aiModificationAllowed: boolean
  readonly restrictions: readonly string[]
}

export type ExternalRightsDecisionV1 = 'REUSABLE_LIBRARY' | 'PROJECT_ONLY' | 'BLOCKED'
export interface ExternalRightsEvaluationV1 { readonly decision: ExternalRightsDecisionV1; readonly reasons: readonly string[] }

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
export const validateExternalMotionProvenanceV1 = (input: unknown): CreativeValidationResultV1<ExternalMotionProvenanceV1> => {
  if (!record(input) || input.schemaVersion !== 'sanverse.external-motion-provenance/v1') return creativeRefusal('UNSUPPORTED_PROVENANCE_VERSION','External provenance must use sanverse.external-motion-provenance/v1.')
  if (!EXTERNAL_MOTION_SOURCE_KINDS_V1.includes(input.sourceKind as ExternalMotionSourceKindV1)) return creativeRefusal('INVALID_PROVENANCE','External sourceKind is unsupported.')
  if (!EXTERNAL_RIGHTS_CLASSES_V1.includes(input.rightsClass as ExternalRightsClassV1)) return creativeRefusal('INVALID_PROVENANCE','External rightsClass is unsupported.')
  if (typeof input.sourceName !== 'string' || !input.sourceName.trim()) return creativeRefusal('INVALID_PROVENANCE','External sourceName is required.')
  for (const key of ['attributionRequired','reusableLibraryAllowed','projectUseAllowed','aiModificationAllowed'] as const) if (typeof input[key] !== 'boolean') return creativeRefusal('INVALID_PROVENANCE',`${key} must be boolean.`)
  if (!Array.isArray(input.restrictions) || !input.restrictions.every((item) => typeof item === 'string')) return creativeRefusal('INVALID_PROVENANCE','restrictions must be a string array.')
  if (input.attributionRequired === true && (typeof input.attributionText !== 'string' || !input.attributionText.trim())) return creativeRefusal('ATTRIBUTION_EVIDENCE_REQUIRED','Attribution-required sources need attributionText before registration.')
  return creativeValidationOk(Object.freeze({ ...(input as unknown as ExternalMotionProvenanceV1), restrictions: Object.freeze([...(input.restrictions as string[])]) }))
}

export const evaluateExternalRights = (provenance: ExternalMotionProvenanceV1): ExternalRightsEvaluationV1 => {
  const validated = validateExternalMotionProvenanceV1(provenance)
  if (!validated.ok) return Object.freeze({ decision: 'BLOCKED', reasons: Object.freeze([validated.refusal.message]) })
  const value = validated.value
  if (value.rightsClass === 'unknown') return Object.freeze({ decision: 'BLOCKED', reasons: Object.freeze(['Unknown rights fail closed.']) })
  if (!value.projectUseAllowed && !value.reusableLibraryAllowed) return Object.freeze({ decision: 'BLOCKED', reasons: Object.freeze(['Neither project use nor reusable Library use is permitted.']) })
  if (value.rightsClass === 'reference-derived') return value.projectUseAllowed
    ? Object.freeze({ decision: 'PROJECT_ONLY', reasons: Object.freeze(['Reference-derived motion is not reusable by default.']) })
    : Object.freeze({ decision: 'BLOCKED', reasons: Object.freeze(['Reference-derived source lacks project-use permission.']) })
  if (value.attributionRequired && !value.attributionText) return Object.freeze({ decision: 'BLOCKED', reasons: Object.freeze(['Required attribution cannot be satisfied.']) })
  if (value.reusableLibraryAllowed && (value.rightsClass === 'owner-authored' || value.rightsClass === 'permissive-oss' || value.rightsClass === 'cc-licensed' || value.rightsClass === 'commercial-stock' || value.rightsClass === 'restricted-runtime')) return Object.freeze({ decision: 'REUSABLE_LIBRARY', reasons: Object.freeze(['Explicit reusable-Library permission is present and declared conditions are satisfiable.']) })
  if (value.projectUseAllowed) return Object.freeze({ decision: 'PROJECT_ONLY', reasons: Object.freeze([value.rightsClass === 'commercial-stock' ? 'Commercial stock is project-only without explicit redistribution permission.' : value.rightsClass === 'restricted-runtime' ? 'Restricted runtime is project-only under the declared rights.' : 'Only project use is permitted.']) })
  return Object.freeze({ decision: 'BLOCKED', reasons: Object.freeze(['Rights do not permit this integration.']) })
}
