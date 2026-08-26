import {
  BACKGROUND_TREATMENTS_V1,
  MOTION_PRESENTATION_MODES_V1,
  SOURCE_TREATMENTS_V1,
  creativeRefusal,
  creativeValidationOk,
  validateCreativeTickRangeV1,
  type BackgroundTreatmentV1,
  type CreativeValidationResultV1,
  type MotionPresentationModeV1,
  type SourceTreatmentV1,
} from '@sanverse/motion-contract'

export interface MotionOpportunityV1 {
  readonly id: string
  readonly sourceStartTick: number
  readonly sourceEndTick: number
  readonly communicationGoal: string
  readonly recommendedPresentationMode: MotionPresentationModeV1
  readonly recommendedSourceTreatment: SourceTreatmentV1
  readonly recommendedBackgroundTreatment: BackgroundTreatmentV1
  readonly preserveSourceAudio: boolean
  readonly preserveSourceVideo: boolean
  readonly suggestedPlacement?: string
  readonly rationale: string
  readonly confidence: number
  readonly requiredCapabilities: readonly string[]
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const boundedText = (value: unknown, max = 2_000): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max

export const validateMotionOpportunityV1 = (input: unknown): CreativeValidationResultV1<MotionOpportunityV1> => {
  if (!record(input) || !boundedText(input.id, 240)) return creativeRefusal('INVALID_MOTION_OPPORTUNITY', 'MotionOpportunityV1 requires a bounded id.')
  const range = validateCreativeTickRangeV1({ startTick: input.sourceStartTick, endTick: input.sourceEndTick })
  if (!range.ok) return creativeRefusal('INVALID_MOTION_OPPORTUNITY_RANGE', range.refusal.message)
  if (!boundedText(input.communicationGoal) || !boundedText(input.rationale)) return creativeRefusal('INVALID_MOTION_OPPORTUNITY', 'communicationGoal and rationale are required.')
  if (!MOTION_PRESENTATION_MODES_V1.includes(input.recommendedPresentationMode as MotionPresentationModeV1)) return creativeRefusal('UNSUPPORTED_PRESENTATION_MODE', 'recommendedPresentationMode is unsupported.')
  if (!SOURCE_TREATMENTS_V1.includes(input.recommendedSourceTreatment as SourceTreatmentV1)) return creativeRefusal('INVALID_SOURCE_TREATMENT', 'recommendedSourceTreatment is unsupported.')
  if (!BACKGROUND_TREATMENTS_V1.includes(input.recommendedBackgroundTreatment as BackgroundTreatmentV1)) return creativeRefusal('INVALID_BACKGROUND_TREATMENT', 'recommendedBackgroundTreatment is unsupported.')
  if (typeof input.preserveSourceAudio !== 'boolean' || typeof input.preserveSourceVideo !== 'boolean') return creativeRefusal('INVALID_MOTION_OPPORTUNITY', 'Source-preservation flags must be boolean.')
  if (typeof input.confidence !== 'number' || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) return creativeRefusal('INVALID_MOTION_OPPORTUNITY_CONFIDENCE', 'confidence must be a finite value from 0 through 1.')
  if (!Array.isArray(input.requiredCapabilities) || !input.requiredCapabilities.every((item) => boundedText(item, 240))) return creativeRefusal('INVALID_MOTION_OPPORTUNITY', 'requiredCapabilities must contain bounded strings.')
  if (input.suggestedPlacement !== undefined && !boundedText(input.suggestedPlacement, 240)) return creativeRefusal('INVALID_MOTION_OPPORTUNITY', 'suggestedPlacement must be a bounded string when present.')
  return creativeValidationOk(Object.freeze({
    ...(input as unknown as MotionOpportunityV1),
    requiredCapabilities: Object.freeze([...(input.requiredCapabilities as string[])]),
  }))
}

export const createMotionOpportunityV1 = (input: MotionOpportunityV1): MotionOpportunityV1 => {
  const result = validateMotionOpportunityV1(input)
  if (!result.ok) throw new RangeError(`${result.refusal.code}: ${result.refusal.message}`)
  return result.value
}
