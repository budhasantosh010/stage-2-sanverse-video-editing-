export const MOTION_PRESENTATION_MODES_V1 = Object.freeze([
  'overlay','split','picture-in-picture','full-screen-motion','tracked-attached','surface-embedded','subject-environment','bridge-takeover',
] as const)
export type MotionPresentationModeV1 = (typeof MOTION_PRESENTATION_MODES_V1)[number]

export const SOURCE_TREATMENTS_V1 = Object.freeze(['normal','dim','blur','reframe','mask','subject-only','hidden'] as const)
export type SourceTreatmentV1 = (typeof SOURCE_TREATMENTS_V1)[number]

export const BACKGROUND_TREATMENTS_V1 = Object.freeze(['source-video','solid','gradient','image','video','graphical','procedural','transparent'] as const)
export type BackgroundTreatmentV1 = (typeof BACKGROUND_TREATMENTS_V1)[number]

export const LIBRARY_SCOPES_V1 = Object.freeze(['sanverse','external','generated','project'] as const)
export type LibraryScopeV1 = (typeof LIBRARY_SCOPES_V1)[number]

export const CAPABILITY_ORIGINS_V1 = Object.freeze(['curated','external','generated'] as const)
export type CapabilityOriginV1 = (typeof CAPABILITY_ORIGINS_V1)[number]

export const CAPABILITY_REUSE_STATUSES_V1 = Object.freeze(['project-only','promotion-candidate','promoted-reusable','deprecated'] as const)
export type CapabilityReuseStatusV1 = (typeof CAPABILITY_REUSE_STATUSES_V1)[number]

export const CREATIVE_LOCK_SCOPES_V1 = Object.freeze(['content','style','storyboard','animatic','motion'] as const)
export type CreativeLockScopeV1 = (typeof CREATIVE_LOCK_SCOPES_V1)[number]

export const CREATIVE_EDITABILITY_LEVELS_V1 = Object.freeze(['full','high','medium','partial','flattened'] as const)
export type CreativeEditabilityV1 = (typeof CREATIVE_EDITABILITY_LEVELS_V1)[number]

export interface CreativeTickRangeV1 { readonly startTick: number; readonly endTick: number }

export interface CreativeRefusalV1 {
  readonly code: string
  readonly message: string
  readonly details?: unknown
}

export type CreativeValidationResultV1<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; refusal: CreativeRefusalV1 }>

export type CreativeOperationResultV1<T> =
  | Readonly<{ ok: true; value: T; revision: number }>
  | Readonly<{ ok: false; refusal: CreativeRefusalV1 }>

export const creativeValidationOk = <T>(value: T): CreativeValidationResultV1<T> => Object.freeze({ ok: true, value })
export const creativeRefusal = <T = never>(code: string, message: string, details?: unknown): CreativeValidationResultV1<T> => Object.freeze({ ok: false, refusal: Object.freeze({ code, message, ...(details === undefined ? {} : { details }) }) })
export const creativeOperationOk = <T>(value: T, revision: number): CreativeOperationResultV1<T> => Object.freeze({ ok: true, value, revision })
export const creativeOperationRefusal = <T = never>(code: string, message: string, details?: unknown): CreativeOperationResultV1<T> => Object.freeze({ ok: false, refusal: Object.freeze({ code, message, ...(details === undefined ? {} : { details }) }) })

export const validateCreativeTickRangeV1 = (input: unknown): CreativeValidationResultV1<CreativeTickRangeV1> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return creativeRefusal('INVALID_TICK_RANGE','Tick range must be an object.')
  const value = input as Record<string, unknown>
  if (!Number.isSafeInteger(value.startTick) || !Number.isSafeInteger(value.endTick) || Number(value.startTick) < 0 || Number(value.endTick) <= Number(value.startTick)) return creativeRefusal('INVALID_TICK_RANGE','Tick range must satisfy 0 <= startTick < endTick using safe integers.')
  return creativeValidationOk(Object.freeze({ startTick: Number(value.startTick), endTick: Number(value.endTick) }))
}

export interface PresentationCapabilityAssessmentV1 {
  readonly supported: boolean
  readonly requiredCapabilities: readonly string[]
  readonly unsupportedCapabilities: readonly string[]
  readonly recommendedFallback?: MotionPresentationModeV1
}

const advancedModeRequirements: Readonly<Partial<Record<MotionPresentationModeV1, readonly string[]>>> = Object.freeze({
  'tracked-attached': Object.freeze(['tracking']),
  'surface-embedded': Object.freeze(['tracking','masks','perspective']),
  'subject-environment': Object.freeze(['subject-segmentation','masks']),
})

export const assessPresentationModeCapabilitiesV1 = (mode: MotionPresentationModeV1, availableCapabilities: readonly string[]): PresentationCapabilityAssessmentV1 => {
  const requiredCapabilities = advancedModeRequirements[mode] ?? Object.freeze([])
  const available = new Set(availableCapabilities)
  const unsupportedCapabilities = requiredCapabilities.filter((capability) => !available.has(capability))
  const fallback: MotionPresentationModeV1 | undefined = unsupportedCapabilities.length > 0
    ? mode === 'surface-embedded' ? 'picture-in-picture' : mode === 'subject-environment' || mode === 'tracked-attached' ? 'overlay' : undefined
    : undefined
  return Object.freeze({ supported: unsupportedCapabilities.length === 0, requiredCapabilities: Object.freeze([...requiredCapabilities]), unsupportedCapabilities: Object.freeze(unsupportedCapabilities), ...(fallback ? { recommendedFallback: fallback } : {}) })
}

export const assessSourceTreatmentCapabilitiesV1 = (treatment: SourceTreatmentV1, availableCapabilities: readonly string[]): PresentationCapabilityAssessmentV1 => {
  const requiredCapabilities = treatment === 'subject-only' ? Object.freeze(['subject-segmentation','masks']) : treatment === 'mask' ? Object.freeze(['masks']) : Object.freeze([])
  const available = new Set(availableCapabilities)
  const unsupportedCapabilities = requiredCapabilities.filter((capability) => !available.has(capability))
  return Object.freeze({ supported: unsupportedCapabilities.length === 0, requiredCapabilities, unsupportedCapabilities: Object.freeze(unsupportedCapabilities) })
}
